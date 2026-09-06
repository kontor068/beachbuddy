// ─────────────────────────────────────────────────────────────────────────────
// CLIENT ERROR + CSP REPORT SINK → Telegram.
//
// Until 30/07/2026 a crash on a visitor's phone was completely invisible: the
// RootErrorBoundary in index.tsx called console.error and that was the end of it.
// The audience is ~86% mobile tourists on island 4G — the single population least
// likely to report a blank screen and most likely to just close the tab.
//
// Deliberately NOT Sentry. Zero cost, no new account, no third-party processor to
// declare in the privacy policy, and no extra kilobytes in a bundle already at
// 3.6 MB. The trade is that we get "something broke, here it is" rather than
// dashboards and history — which is the whole distance between blind and not.
//
// The same endpoint receives Content-Security-Policy violation reports, because
// they arrive in the same shape (a thing the browser refused to do) and want the
// same treatment. That is what makes shipping CSP in Report-Only mode useful: the
// reports have somewhere to land.
//
// WHAT IS NEVER SENT: no IP, no visitor id, no cookies, nothing that identifies a
// person. Message, stack, page path, user-agent, build id. That is why this needs
// no consent gate and does not change the privacy policy.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';

const SEEN_STORE = 'client-errors';
const MAX_BODY_LENGTH = 16_000;
const MAX_FIELD = 500;
const MAX_STACK = 1_400;

/**
 * How many DISTINCT errors we will report per UTC day. A broken deploy produces one
 * error per visitor, not one error — the first version of this idea would have sent
 * a Telegram message per crash and made the channel unusable exactly when it mattered
 * most. Distinct signatures are cheap; repeats of a signature are free.
 */
const MAX_DISTINCT_PER_DAY = 25;

const ALLOWED_HOSTS = new Set(['calmbeach.gr', 'www.calmbeach.gr', 'localhost', '127.0.0.1']);

const hostOf = (value) => {
  if (!value) return '';
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
};

const isOwnHost = (host) => Boolean(host) && (ALLOWED_HOSTS.has(host) || host.endsWith('.netlify.app'));

// Same shape as feedback-email.mjs. Origin is authoritative when present; browsers
// omit it on some same-origin POSTs, and CSP reports are sent by the browser itself
// with no Origin at all — hence the Referer fallback rather than a hard refusal.
const isTrustedOrigin = (event) => {
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || '';
  const referer = headers.referer || headers.Referer || '';
  if (origin) return isOwnHost(hostOf(origin));
  if (referer) return isOwnHost(hostOf(referer));
  return false;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const recentByIp = new Map();

const isRateLimited = (event) => {
  const headers = event.headers || {};
  const ip = (headers['x-nf-client-connection-ip'] || headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();
  if (!ip) return false;

  const now = Date.now();
  const hits = (recentByIp.get(ip) || []).filter(at => now - at < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  recentByIp.set(ip, hits);

  if (recentByIp.size > 500) {
    for (const [key, times] of recentByIp) {
      if (!times.some(at => now - at < RATE_LIMIT_WINDOW_MS)) recentByIp.delete(key);
    }
  }

  return hits.length > RATE_LIMIT_MAX;
};

const clamp = (value, max = MAX_FIELD) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const escapeTelegram = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const getConfig = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const parseBody = (event) => {
  if (!event.body) return {};
  if (event.body.length > MAX_BODY_LENGTH) return null;
  try {
    return JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body);
  } catch {
    return null;
  }
};

/**
 * Normalise both shapes into one report.
 *
 * A CSP violation arrives as {"csp-report": {...}} (the classic report-uri form) or
 * as a `application/reports+json` array. Our own crashes arrive as a flat object we
 * control. Everything downstream — signature, dedup, formatting — sees one shape.
 */
const normalize = (body) => {
  const csp = body?.['csp-report'] || (Array.isArray(body) ? body[0]?.body : null);
  if (csp) {
    const directive = clamp(csp['effective-directive'] || csp['violated-directive'] || csp.effectiveDirective || '', 80);
    const blocked = clamp(csp['blocked-uri'] || csp.blockedURL || '', 200);
    return {
      kind: 'csp',
      message: `CSP blocked ${blocked || 'something'} (${directive || 'unknown directive'})`,
      source: clamp(csp['document-uri'] || csp.documentURL || '', 200),
      line: 0,
      stack: '',
      disposition: clamp(csp.disposition || 'enforce', 20),
      // One CSP problem is one ORIGIN being refused for one directive, not one URL.
      // The first version signed on the full blocked URL, so every map tile was a
      // brand-new "distinct error": 128 signatures in an afternoon, the 25/day
      // budget gone by the evening, and a real crash that day would have been
      // silently dropped. The message still shows the exact URL — only the identity
      // is coarser.
      groupKey: `${originOf(blocked)}|${directive}`,
    };
  }

  const message = clamp(body?.message, 300);
  const source = clamp(body?.source, 200);
  const stack = clamp(body?.stack, MAX_STACK);
  const foreign = isForeignInlineScript(source) || isForeignInlineStack(stack);

  return {
    kind: 'error',
    message,
    source,
    line: Number.isFinite(Number(body?.line)) ? Number(body.line) : 0,
    stack,
    disposition: '',
    foreign,
    // Ένα ξένο script που σκάει σε 300 σελίδες παραλιών είναι ΕΝΑ πράγμα, όχι 300.
    // Το `source` εδώ ΕΙΝΑΙ η διεύθυνση της σελίδας, οπότε η κανονική υπογραφή
    // (message|source|line) θα έφτιαχνε καινούρια «διαφορετικό σφάλμα» σε κάθε
    // παραλία και θα έκαιγε μόνη της το όριο των 25 της ημέρας — το ίδιο ακριβώς
    // λάθος που είχε γίνει με τα CSP reports και τα πλακίδια του χάρτη.
    groupKey: foreign ? `inline|${message}` : undefined,
  };
};

/**
 * ΞΕΝΟ INLINE SCRIPT ΜΕΣΑ ΣΤΗ ΣΕΛΙΔΑ ΜΑΣ (27/08/2026) — καταγράφεται, δεν χτυπάει
 * το τηλέφωνο.
 *
 * Ολόκληρη η JavaScript που στέλνουμε φεύγει ως module από `/assets/*.js`· το μόνο
 * inline script στο HTML μας είναι το τετράγραμμο χρονόμετρο του fallback. Άρα ένα
 * σφάλμα που ο browser χρεώνει στην ΙΔΙΑ ΤΗ ΣΕΛΙΔΑ (`…/1433-gomati/:1`) και όχι σε
 * αρχείο .js έρχεται από script που φύτεψε κάποιος άλλος μέσα στη σελίδα αφού
 * φόρτωσε: επέκταση browser, ή ο ενσωματωμένος browser του Facebook/Instagram.
 *
 * Το ίδιο φίλτρο υπάρχει και στο services/errorReporter.ts, ώστε να μη στέλνονται
 * καν. Μένει ΚΑΙ εδώ επειδή ο service worker κρατάει το παλιό build στα κινητά για
 * μέρες μετά το deploy: χωρίς αυτό, οι ειδοποιήσεις θα συνέχιζαν να έρχονται από
 * επισκέπτες που δεν έχουν πάρει ακόμα τη διόρθωση.
 */
const isForeignInlineScript = (source) => {
  if (!source) return false;
  let url;
  try {
    url = new URL(source);
  } catch {
    // «RootErrorBoundary», «unhandledrejection» — δικές μας λέξεις, όχι διευθύνσεις.
    return false;
  }
  if (!isOwnHost(url.hostname.toLowerCase())) return false;
  return !/\.m?js$/i.test(url.pathname);
};

/**
 * ΤΟ ΙΔΙΟ ΞΕΝΟ SCRIPT, ΑΠΟ ΤΗΝ ΑΛΛΗ ΠΟΡΤΑ (31/08/2026).
 *
 * Ήρθε 🔴 «έσπασε σελίδα σε επισκέπτη» με μήνυμα «Ea» από /beaches/astypalaia/ σε
 * Chrome iPhone, και η στοίβα του ονόμαζε τρεις φορές την ΙΔΙΑ ΤΗ ΣΕΛΙΔΑ
 * (…/astypalaia/:453:350, :194:41, :195:338) — ούτε μία φορά αρχείο /assets/*.js.
 * Δηλαδή ακριβώς η isForeignInlineScript() από πάνω, αλλά αόρατη σε αυτήν: η
 * αναφορά ήρθε από `unhandledrejection`, όπου το `source` δεν είναι διεύθυνση αλλά
 * η δική μας λέξη «unhandledrejection», οπότε ο έλεγχος έβγαινε αμέσως false.
 *
 * ΔΕΝ είναι το «Error: Ea» της 29/08 με άλλο ρούχο. Εκείνο ΑΠΕΤΥΧΕ το instanceof,
 * δηλαδή γεννήθηκε σε ξεχωριστό περιβάλλον JavaScript (πρόσθετο browser), και το
 * πιάνει ο δομικός έλεγχος στο services/errorReporter.ts. Αυτό εδώ ΠΕΡΑΣΕ το
 * instanceof — γεννήθηκε στο ίδιο περιβάλλον με τη σελίδα, που είναι ακριβώς ό,τι
 * κάνει ένα script φυτεμένο μέσα στο HTML μας (το CSP μας επιτρέπει
 * 'unsafe-inline'). Δύο διαφορετικές πόρτες για την ίδια οικογένεια· η μία ήταν
 * κλειστή, η άλλη ορθάνοιχτη.
 *
 * Ο κανόνας είναι δομικός, όχι άλλη μια φράση σε λίστα: κάθε σφάλμα δικού μας
 * κώδικα έχει ΤΟΥΛΑΧΙΣΤΟΝ μία γραμμή στοίβας σε /assets/*.js, γιατί από εκεί φεύγει
 * ολόκληρη η JavaScript μας. Στοίβα που ονομάζει μόνο σελίδες μας και κανένα δικό
 * μας αρχείο δεν μπορεί να είναι δική μας.
 *
 * Δύο ασφάλειες ώστε να μη σωπάσει ποτέ αληθινό σφάλμα:
 *   • ΕΝΑ και μόνο δικό μας αρχείο οπουδήποτε στη στοίβα ακυρώνει την απόφαση.
 *   • «Σελίδα μας» μετράει μόνο διαδρομή που τελειώνει σε «/» και δεν ξεκινάει από
 *     «/assets/» — έτσι είναι όλες οι σελίδες μας, και κανένα δικό μας αρχείο. Η
 *     στοίβα κόβεται στους 1.400 χαρακτήρες: ούτε το μισοκομμένο
 *     «/assets/index-Dop3» ούτε το «/assets/» επιτρέπεται να περάσουν για σελίδα.
 * Χωρίς στοίβα δεν αποφασίζει τίποτα.
 *
 * Μπαίνει ΜΟΝΟ εδώ κι όχι και στον πελάτη, σε αντίθεση με το φίλτρο από πάνω: έτσι
 * ισχύει από την πρώτη στιγμή για ΟΛΑ τα κινητά — και για όσα κρατάνε ακόμα παλιό
 * build στον service worker — και η αναφορά εξακολουθεί να μετριέται στον κάδο
 * `muted/` αντί να χάνεται εντελώς.
 */
const STACK_FRAME_URL = /\bhttps?:\/\/[^\s)'"]+/g;

const isForeignInlineStack = (stack) => {
  if (!stack) return false;

  let sawOwnDocument = false;
  for (const raw of stack.match(STACK_FRAME_URL) || []) {
    let url;
    try {
      // «…/astypalaia/:194:41» → η διεύθυνση χωρίς γραμμή/στήλη.
      url = new URL(raw.replace(/[)\]]+$/, '').replace(/:\d+(?::\d+)?$/, ''));
    } catch {
      continue;
    }
    if (!isOwnHost(url.hostname.toLowerCase())) continue;
    // Ό,τι ζει κάτω από /assets/ είναι δικό μας αρχείο, ακόμα κι αν η κομμένη
    // στοίβα δεν πρόλαβε να γράψει την κατάληξη .js.
    if (/\.m?js$/i.test(url.pathname) || url.pathname.startsWith('/assets/')) return false;
    if (url.pathname.endsWith('/')) sawOwnDocument = true;
  }
  return sawOwnDocument;
};

/** Scheme+host of a URL, for grouping. Falls back to the raw value for the
 *  keywords CSP uses instead of a URL ("inline", "eval", "data"). */
const originOf = (value) => {
  try {
    return new URL(value).origin;
  } catch {
    return clamp(value, 60) || 'unknown';
  }
};

/** What makes two reports "the same problem". Line included so two failures in one
 *  file stay distinct; the page URL deliberately is NOT, or the same bug on 300
 *  beach pages would read as 300 bugs. CSP reports carry their own coarser
 *  groupKey — see normalize(). */
const signatureOf = (report) => (
  report.groupKey
    ? `${report.kind}|${report.groupKey}`
    : `${report.kind}|${report.message}|${report.source}|${report.line}`
)
  .toLowerCase()
  .replace(/[^a-z0-9|.:_/-]+/g, '')
  .slice(0, 180);

const sendTelegram = async (text) => {
  const config = getConfig();
  if (!config.botToken || !config.chatId) return;
  await fetch(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: config.chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
};

// Requests that are not a person. AdsBot-Google renders pages on a hard time budget
// and abandons subresources when it runs out — which surfaces here as a missing chunk
// and, until 04/08/2026, as "🔴 έσπασε σελίδα σε επισκέπτη" for a visitor that does
// not exist. Their reports are still counted in the blob store (worth knowing if a
// crawler cannot render the site at all); they just never ring the phone.
// `HeadlessChrome` προστέθηκε 28/08/2026: παραβίαση CSP από /el/beach-guides/ με
// HeadlessChrome/146 σε Windows. Ένας browser χωρίς οθόνη ΔΕΝ είναι επισκέπτης — είναι
// εργαλείο (δικός μας έλεγχος, υπηρεσία παρακολούθησης, κάποιος που σαρώνει το site).
// Δεν έχει μάτια να δει σπασμένη σελίδα, οπότε δεν δικαιολογεί ειδοποίηση· μετριέται
// κανονικά όπως όλα τα ρομπότ.
const CRAWLER_UA = /AdsBot|Googlebot|bingbot|Applebot|YandexBot|DuckDuckBot|Baiduspider|SemrushBot|AhrefsBot|PetalBot|facebookexternalhit|Bytespider|GPTBot|ClaudeBot|HeadlessChrome|crawler|spider/i;

/**
 * Ο ΜΕΤΡΗΤΗΣ ΤΑΧΥΤΗΤΑΣ ΠΟΥ ΒΑΖΕΙ ΤΟ ΙΔΙΟ ΤΟ NETLIFY (28/08/2026).
 *
 * Το Netlify εμφυτεύει `/.netlify/scripts/rum` σε κάθε σελίδα που σερβίρει (Real User
 * Metrics). Δεν υπάρχει σε καμία γραμμή του κώδικά μας ούτε στο dist/ — μπαίνει τη
 * στιγμή του σερβιρίσματος. Το beacon του πάει στο ingesteer.services-prod.nsvcs.net,
 * που δεν είναι στο connect-src μας: ο browser το κόβει, η fetch απορρίπτεται, κανείς
 * δεν την πιάνει, και έφτανε ως 🔴 «έσπασε σελίδα σε επισκέπτη» ενώ η σελίδα ήταν
 * ολοκάθαρη. Ένα αίτιο, τρεις ειδοποιήσεις την ίδια νύχτα.
 *
 * Αναγνωρίζεται από τη ΣΤΟΙΒΑ, όχι από το μήνυμα: το μήνυμα είναι σκέτο «Failed to
 * fetch» / «Load failed», λέξεις που τις λέει και ένα δικό ΜΑΣ αίτημα που απέτυχε.
 * Το ίδιο φίλτρο υπάρχει και στο services/errorReporter.ts· μένει και εδώ για τα
 * κινητά που κρατούν το παλιό build στη μνήμη του service worker.
 */
const NETLIFY_RUM = /\/\.netlify\/scripts\/rum/i;

/**
 * ΤΟ ΔΙΚΤΥΟ ΔΕΝ ΠΕΡΑΣΕ — ΔΕΝ ΕΙΝΑΙ ΣΠΑΣΜΕΝΗ ΣΕΛΙΔΑ (απόφαση Μίλτου, 29/08/2026).
 *
 * «Load failed» (Safari), «Failed to fetch» (Chrome), «NetworkError…» (Firefox): έτσι
 * λέει ο κάθε browser ότι ένα αίτημα δεν ολοκληρώθηκε. Το κοινό μας είναι ~86% κινητά,
 * τουρίστες σε νησιά με 4G — μια χαμένη κλήση εκεί είναι καθημερινότητα, όχι συμβάν, και
 * η εφαρμογή έχει εφεδρείες. Έφτανε όμως ως 🔴 «ΚΡΙΣΙΜΟ — δράσε τώρα», δηλαδή ακριβώς η
 * κραυγή λύκου που κάνει κάποιον να σταματήσει να διαβάζει το κανάλι.
 *
 * ΟΙ ΑΓΚΥΡΕΣ ΕΙΝΑΙ Η ΟΥΣΙΑ, ΟΧΙ ΔΙΑΚΟΣΜΗΣΗ. Ταιριάζει ΜΟΝΟ όταν το μήνυμα είναι εξ
 * ολοκλήρου αυτό. Το «Failed to fetch dynamically imported module» ΠΕΡΙΕΧΕΙ το «Failed
 * to fetch», αλλά είναι άλλο πράγμα — κομμάτι κώδικα που δεν κατέβηκε — και έχει δικό
 * του χειρισμό (CHUNK_LOAD_MESSAGE, 🟠 με δικές του οδηγίες). Χωρίς τις άγκυρες αυτή η
 * σίγαση θα το κατάπινε μαζί, δηλαδή θα έκρυβε χαλασμένο deploy.
 *
 * Καταγράφονται κανονικά στον κάδο muted/ με τον λόγο δίπλα: αν κάποια μέρα ο αριθμός
 * τους εκτοξευθεί, φαίνεται εκεί χωρίς να έχει χτυπήσει ποτέ το τηλέφωνο.
 */
const BARE_NETWORK_FAILURE = [
  /^(?:TypeError:\s*)?Load failed\.?$/i,
  /^(?:TypeError:\s*)?Failed to fetch\.?$/i,
  /^(?:TypeError:\s*)?NetworkError when attempting to fetch resource\.?$/i,
  /^(?:TypeError:\s*)?The network connection was lost\.?$/i,
  /^(?:TypeError:\s*)?The request timed out\.?$/i,
];

const isCrawler = (userAgent) => CRAWLER_UA.test(userAgent || '');

// A missing JS/CSS chunk is not a broken site: services/errorReporter.ts only forwards
// the ones where the automatic recovery ALREADY reloaded and still failed. Even those
// are a deploy/CDN question, not "a visitor is looking at a white screen right now", so
// they get 🟠 and an instruction that matches what actually helps.
const CHUNK_LOAD_MESSAGE = /dynamically imported module|Importing a module script failed|Loading chunk \S+ failed|Unable to preload CSS/i;

// Greek, severity-tagged Telegram body with an explicit "what to do" line — a crash
// is 🔴 (a visitor actually hit a broken page), an enforced CSP block or a chunk that
// would not load is 🟠 (worth a look, the site itself did not necessarily break).
const formatMessage = (report, context, repeats) => {
  const isCsp = report.kind === 'csp';
  const isChunk = !isCsp && CHUNK_LOAD_MESSAGE.test(report.message || '');
  const tag = isCsp || isChunk ? '🟠 ΠΡΟΣΟΧΗ — έλεγξε' : '🔴 ΚΡΙΣΙΜΟ — δράσε τώρα';
  const header = isCsp
    ? `🛡️ <b>Μπλοκαρίστηκε κάτι στη σελίδα (CSP ${report.disposition === 'report' ? 'δοκιμαστικά' : 'ενεργό'})</b>`
    : isChunk
      ? '📦 <b>Δεν κατέβηκε κομμάτι του κώδικα (και μετά από επαναφόρτωση)</b>'
      : '💥 <b>Έσπασε σελίδα σε επισκέπτη</b>';
  const whatToDo = isCsp
    ? 'Τι να κάνεις: έλεγξε αν αυτό το resource είναι απαραίτητο. Αν ναι, πρόσθεσέ το στη λίστα επιτρεπόμενων του CSP· αν όχι, αγνόησέ το.'
    : isChunk
      ? 'Τι να κάνεις: συνήθως κακό δίκτυο στο κινητό του επισκέπτη — τίποτα. Αν έρχεται πολλές φορές την ίδια ώρα με το ίδιο build, τότε λείπει αρχείο από το deploy: ξανακάνε deploy.'
      : `Τι να κάνεις: άνοιξε τη σελίδα${context.page ? ` (${escapeTelegram(context.page)})` : ''} σε κινητό. Αν είναι λευκή ή σπασμένη, κάνε rollback στο προηγούμενο deploy.`;

  const rows = [
    `<b>${escapeTelegram(report.message) || 'Άγνωστο σφάλμα'}</b>`,
    report.source ? `σε <code>${escapeTelegram(report.source)}${report.line ? `:${report.line}` : ''}</code>` : '',
    context.page ? `σελίδα: ${escapeTelegram(context.page)}` : '',
    context.userAgent ? `συσκευή: ${escapeTelegram(context.userAgent)}` : '',
    context.buildId ? `build: ${escapeTelegram(context.buildId)}` : '',
    repeats > 1 ? `εμφανίστηκε ${repeats}× σήμερα` : '',
    '',
    whatToDo,
    report.stack ? `\n<pre>${escapeTelegram(report.stack)}</pre>` : '',
  ].filter(Boolean);

  return [tag, header, '', ...rows].join('\n').slice(0, 3_800);
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { Allow: 'POST, OPTIONS' }, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }
  if (!isTrustedOrigin(event)) {
    return { statusCode: 403, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }
  if (isRateLimited(event)) {
    // 204 rather than 429: this is fire-and-forget telemetry and there is nothing
    // useful for a crashing page to do with an error about its error.
    return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }

  const body = parseBody(event);
  if (!body) return { statusCode: 400, headers: { 'Cache-Control': 'no-store' }, body: '' };

  const report = normalize(body);
  if (!report.message) return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };

  const context = {
    page: clamp(body?.page || event.headers?.referer || '', 200),
    userAgent: clamp(event.headers?.['user-agent'] || '', 180),
    buildId: clamp(body?.buildId, 60),
  };

  // ΠΡΩΤΑ ΑΠΟΦΑΣΙΖΟΥΜΕ ΑΝ ΘΑ ΧΤΥΠΗΣΕΙ ΤΟ ΤΗΛΕΦΩΝΟ, ΜΕΤΑ ΜΕΤΡΑΜΕ (28/08/2026).
  //
  // Η σειρά αυτή ΔΕΝ είναι αισθητική. Ο μετρητής ανά υπογραφή απαντάει σε μία μόνο
  // ερώτηση — «το έχουμε ήδη πει σήμερα αυτό;» — και μόνο η πρώτη εμφάνιση στέλνεται.
  // Όσο οι σιωπηλές αναφορές μετριούνταν στον ΙΔΙΟ κάδο με τις κανονικές, μια σιωπηλή
  // «έκαιγε» την πρώτη εμφάνιση και η επόμενη ΙΔΙΑ αναφορά από πραγματικό επισκέπτη
  // έβρισκε μετρητή 2 και δεν έφευγε ποτέ.
  //
  // Δεν είναι θεωρητικό: το «Failed to fetch» του μετρητή ταχύτητας του Netlify έχει
  // ακριβώς την ίδια υπογραφή (μήνυμα|unhandledrejection|0) με ένα δικό ΜΑΣ αίτημα
  // που απέτυχε — η στοίβα, που τα ξεχωρίζει, δεν μπαίνει στην υπογραφή. Το ίδιο
  // ίσχυε ήδη και για τα ρομπότ: ένα σφάλμα του Googlebot έκρυβε το πρώτο ίδιο
  // σφάλμα ενός ανθρώπου. Δύο ξεχωριστοί κάδοι, `seen/` και `muted/`, το λύνουν:
  // όλα μετριούνται, κανένα δεν κρύβει το άλλο.
  const mutedReason = (() => {
    // Μια αναφορά CSP σε δοκιμαστική λειτουργία δεν μπλόκαρε ΤΙΠΟΤΑ — εξ ορισμού.
    // Είναι σημείωμα ότι η πολιτική θα εμπόδιζε κάτι αν ήταν ενεργή: χρήσιμο όταν
    // πας να το κοιτάξεις, άχρηστο ως ειδοποίηση στις 9 το πρωί. Οι ΕΝΕΡΓΕΣ
    // παραβιάσεις φτάνουν κανονικά — εκεί ο επισκέπτης όντως έχασε κάτι.
    if (report.kind === 'csp' && report.disposition !== 'enforce') return 'csp-report-only';

    // Το `object-src` αφορά Flash/Java/PDF plugins — πράγματα που το site ΔΕΝ
    // χρησιμοποιεί πουθενά. Άρα ένα μπλοκάρισμα εκεί είναι πάντα κάτι που έβαλε ο
    // ΞΕΝΟΣ browser μέσα στη σελίδα (20/08/2026: browser τηλεόρασης Vestel σε
    // /el/organized-beaches/ithaca/) και δεν υπάρχει τίποτα να διορθώσουμε. Η
    // πολιτική δούλεψε ακριβώς όπως πρέπει.
    if (report.kind === 'csp' && /object-src/i.test(report.message)) return 'csp-object-src';

    // ΙΔΙΑ ΟΙΚΟΓΕΝΕΙΑ, ΑΛΛΗ ΤΕΧΝΟΛΟΓΙΑ (28/08/2026): «CSP blocked wasm-eval (script-src)»
    // από /beaches/rethymno/ σε Chrome 152. Το WebAssembly είναι ο τρόπος που τρέχουν
    // βαρύ κώδικα οι αποκλειστές διαφημίσεων και οι διαχειριστές κωδικών μέσα στη σελίδα.
    // Μετρήθηκε πριν σιωπήσει: ΜΗΔΕΝ αρχεία .wasm στο dist/, μηδέν αναφορές
    // «WebAssembly» στο χτισμένο bundle, μηδέν στον πηγαίο κώδικα. Δεν είναι δικό μας
    // και δεν υπάρχει τίποτα να διορθωθεί.
    //
    // ΔΕΝ επιτρέπεται στο CSP, σε αντίθεση με το `data:` των γραμματοσειρών: το
    // 'wasm-unsafe-eval' ανοίγει ΕΚΤΕΛΕΣΗ κώδικα, δηλαδή ακριβώς αυτό που κρατάει
    // κλειστό το script-src. Η σίγαση είναι εδώ ασφαλής επειδή, αν κάποτε βάλουμε
    // WebAssembly, δεν θα χαλάσει σιωπηλά — απλώς δεν θα τρέχει, και θα φανεί στην
    // πρώτη δοκιμή. Το ίδιο ΔΕΝ ίσχυε για τη γραμματοσειρά, που θα εξαφανιζόταν
    // αθόρυβα από τη σελίδα· γι' αυτό εκείνη επιτράπηκε αντί να σιγηθεί.
    if (report.kind === 'csp' && /\bwasm-(?:unsafe-)?eval\b/i.test(report.message)) return 'csp-wasm-eval';

    // ΑΝΑΦΟΡΑ ΑΠΟ ΣΕΛΙΔΑ ΠΟΥ ΚΟΥΒΑΛΑΕΙ ΠΑΛΙΑ ΠΟΛΙΤΙΚΗ (29/08/2026).
    //
    // Το ingesteer.services-prod.nsvcs.net (ο συλλέκτης του μετρητή ταχύτητας του
    // Netlify) ΕΠΙΤΡΕΠΕΤΑΙ ρητά στο connect-src από τις 28/08 08:33 ώρα Ελλάδας. Παρ'
    // όλα αυτά ήρθε παραβίαση 19 ώρες αργότερα, από /el/beaches/tinos/. Ελέγχθηκε ότι
    // η άδεια είναι όντως ζωντανή: υπάρχει στο netlify.toml του main, καμία σελίδα δεν
    // κουβαλάει δικό της <meta> CSP, δεν υπάρχει αρχείο _headers, και κανένα script του
    // build δεν ξαναγράφει τα headers.
    //
    // Ένα έγγραφο κρατάει για ΠΑΝΤΑ την πολιτική με την οποία φορτώθηκε. Στο κινητό οι
    // καρτέλες ζουν μέρες (και το bfcache τις επαναφέρει ζωντανές), ενώ ο μετρητής
    // στέλνει σήμα και σε επόμενες πλοηγήσεις μέσα στο ίδιο έγγραφο — οπότε μια
    // καρτέλα ανοιχτή από πριν τη διόρθωση παράγει ακόμα παραβιάσεις με την παλιά
    // πολιτική, και το παλιό report-uri μας τις φέρνει.
    //
    // Γιατί είναι ασφαλές να σιωπήσει: για μια διεύθυνση που η ΤΡΕΧΟΥΣΑ πολιτική μας
    // επιτρέπει, καμία αναφορά δεν μπορεί να είναι πράξιμη — ή έρχεται από παλιό
    // έγγραφο, ή η άδεια έχει αφαιρεθεί επίτηδες, που είναι επίσης απόφασή μας. Ο
    // κανόνας πρέπει να φύγει από εδώ αν φύγει και η διεύθυνση από το connect-src.
    if (report.kind === 'csp' && /ingesteer\.services-prod\.nsvcs\.net/i.test(report.message)) {
      return 'csp-stale-policy-netlify-rum';
    }

    // Ένα ρομπότ δεν είναι επισκέπτης. Βλ. CRAWLER_UA.
    if (isCrawler(context.userAgent)) return 'crawler';

    // Ξένο script μέσα στη σελίδα μας. Βλ. isForeignInlineScript().
    if (report.foreign) return 'foreign-inline-script';

    // Ο μετρητής ταχύτητας του Netlify. Βλ. NETLIFY_RUM.
    if (report.kind === 'error' && (NETLIFY_RUM.test(report.stack) || NETLIFY_RUM.test(report.source))) {
      return 'netlify-rum';
    }

    // Αίτημα που δεν πέρασε από το δίκτυο. Βλ. BARE_NETWORK_FAILURE.
    if (report.kind === 'error' && BARE_NETWORK_FAILURE.some(p => p.test(report.message))) {
      return 'network-failure';
    }

    return '';
  })();

  try {
    connectLambda(event);
    const store = getStore(SEEN_STORE);
    const dayKey = new Date().toISOString().slice(0, 10);
    const signature = signatureOf(report);
    const key = `${mutedReason ? 'muted' : 'seen'}/${dayKey}/${encodeURIComponent(signature)}`;

    const prev = await store.get(key, { type: 'json' });
    const repeats = (prev?.count || 0) + 1;
    await store.setJSON(key, {
      count: repeats,
      message: report.message,
      lastSeen: new Date().toISOString(),
      ...(mutedReason ? { muted: mutedReason } : {}),
    });

    // Καταγράφηκε παραπάνω, δεν χτυπάει το τηλέφωνο. Το `netlify blobs:list
    // client-errors` δείχνει και τους δύο κάδους, με τον λόγο σιωπής δίπλα.
    if (mutedReason) {
      return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
    }

    if (repeats === 1) {
      // A day-level counter of DISTINCT signatures, so a pathological page that
      // manufactures unique messages cannot turn the channel into a firehose.
      const budgetKey = `budget/${dayKey}`;
      const budget = (await store.get(budgetKey, { type: 'json' }))?.distinct || 0;
      if (budget < MAX_DISTINCT_PER_DAY) {
        await store.setJSON(budgetKey, { distinct: budget + 1 });
        await sendTelegram(formatMessage(report, context, repeats));
      } else if (budget === MAX_DISTINCT_PER_DAY) {
        await store.setJSON(budgetKey, { distinct: budget + 1 });
        await sendTelegram(`🟠 ΠΡΟΣΟΧΗ — έλεγξε\n🔇 <b>${MAX_DISTINCT_PER_DAY} διαφορετικά σφάλματα σήμερα</b>\nΤα επόμενα καινούρια σφάλματα καταγράφονται αλλά δεν στέλνονται πια εδώ.\nΤι να κάνεις: κάτι πάει σοβαρά στραβά — άνοιξε μια πραγματική σελίδα να δεις τι συμβαίνει.`);
      }
    }
  } catch (error) {
    // Never let telemetry break the page that is already broken.
    console.error('client-error sink failed.', error && error.message);
  }

  return { statusCode: 204, headers: { 'Cache-Control': 'no-store' }, body: '' };
};
