// ─────────────────────────────────────────────────────────────────────────────
// Client-side crash reporting — the sending half of netlify/functions/client-error.mjs.
//
// Before this existed, a crash on a visitor's phone left no trace anywhere. ~86% of
// the audience is mobile, mostly tourists on island 4G: the people least likely to
// report a white screen and most likely to close the tab and use Google instead.
//
// Rules this file keeps:
//   • Never send anything that identifies a person. Message, stack, path, build id.
//     The page PATH only — not the query string, which can carry `?near=1` and
//     coordinates the user chose to share with their browser and not with us.
//   • Never break the page it is reporting on. Every path is guarded and silent.
//   • Never become the problem: identical errors are collapsed in-session, and the
//     function collapses them again per day.
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT = '/.netlify/functions/client-error';

/** Signatures already sent by THIS page view. A render loop can throw the same error
 *  hundreds of times a second; the server dedups per day, but there is no reason to
 *  spend the visitor's bandwidth finding that out. */
const sentThisSession = new Set<string>();
const MAX_PER_SESSION = 5;

const trimmed = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

/**
 * Errors that are NOT ours, or are ours but harmless. Every one of these was
 * observed in the first 24 hours of reporting (31/07/2026) and none of them
 * describes something a visitor could see go wrong. An alert channel that cries
 * wolf gets muted, and then the one real crash arrives to a muted channel.
 *
 * 1. Browser extensions. `Cannot destructure property 'tabId' from null` came in
 *    twice from an iPhone on the homepage: `tabId` is a browser-extension API, not
 *    anything this codebase has ever referenced. Content scripts run in the page
 *    and their rejections surface as ours. We cannot fix them and the visitor is
 *    not affected.
 * 2. Leaflet's zoom race. `_leaflet_pos` is read off a pane that the library has
 *    already detached mid zoom-transition — a known internal race in
 *    react-leaflet/leaflet teardown. The map keeps working; it is noise from
 *    inside map-vendor, not a broken screen.
 * 3. ResizeObserver loop notices, which browsers report as errors and which every
 *    project on earth ignores.
 * 4. More extension plumbing, seen 03-04/08/2026 on build 7a370781: `Invalid call to
 *    runtime.sendMessage(). Tab not found.` and `Extension context invalidated`.
 *    Same family as (1) — the `tabId` pattern did not happen to match their wording,
 *    which is the whole problem with matching on one phrase per symptom.
 */
const IGNORED_ERROR_PATTERNS: RegExp[] = [
  /\btabId\b/i,
  /chrome-extension:|moz-extension:|safari-web-extension:/i,
  /runtime\.sendMessage/i,
  /Tab not found/i,
  /Extension context invalidated/i,
  /_leaflet_pos/,
  /ResizeObserver loop/i,
  // 5. Ο ΕΝΣΩΜΑΤΩΜΕΝΟΣ BROWSER ΤΟΥ FACEBOOK/INSTAGRAM (20/08/2026). Έστειλε
  //    «Error invoking postMessage: Java object is gone» από
  //    `iabjs://navigation_performance_logger_android` — δικό ΤΟΥΣ script που μετράει
  //    ταχύτητα και μιλάει με το Android app· σκάει όταν ο χρήστης κλείνει την καρτέλα.
  //    Έφτανε ως 🔴 «έσπασε σελίδα σε επισκέπτη» ενώ η σελίδα ήταν μια χαρά.
  /^iabjs:/i,
  /Java object is gone/i,
  /navigation_performance_logger/i,
  // 6. ΤΟ ΜΕΤΡΗΤΗ ΤΑΧΥΤΗΤΑΣ ΠΟΥ ΒΑΖΕΙ ΤΟ ΙΔΙΟ ΤΟ NETLIFY (28/08/2026). Το Netlify
  //    εμφυτεύει `/.netlify/scripts/rum` σε κάθε σελίδα που σερβίρει (Real User
  //    Metrics) — δεν υπάρχει σε καμία γραμμή του κώδικά μας ούτε στο dist/. Το
  //    beacon του πάει στο ingesteer.services-prod.nsvcs.net, που ΔΕΝ είναι στο
  //    connect-src μας, οπότε ο browser το κόβει· η fetch απορρίπτεται, κανείς δεν
  //    την πιάνει, και έφτανε εδώ ως 🔴 «έσπασε σελίδα σε επισκέπτη» με σελίδα
  //    ολοκάθαρη. Το μήνυμα είναι σκέτο «Failed to fetch» (Chrome) ή «Load failed»
  //    (Safari) — λέξεις που δεν επιτρέπεται να τις μπλοκάρουμε γενικά, γιατί τις
  //    λέει και ένα δικό μας αίτημα που απέτυχε. Γι' αυτό το αναγνωριστικό είναι η
  //    ΣΤΟΙΒΑ, που ονομάζει το script — και γι' αυτό η isIgnorable() κοιτάει πλέον
  //    και τη στοίβα.
  /\/\.netlify\/scripts\/rum/i,
  // 7. ΤΟ ΛΕΞΙΛΟΓΙΟ ΤΩΝ ΠΡΟΣΘΕΤΩΝ, ΟΧΙ ΑΛΛΗ ΜΙΑ ΦΡΑΣΗ (28/08/2026). Ήρθε
  //    «Error: No Listener: tabs:outgoing.message.ready» από Safari 26.6 σε
  //    /beaches/kos/2330-paralia-paradisos/ — τέταρτη διαφορετική διατύπωση του ΙΔΙΟΥ
  //    πράγματος μέσα σε έναν μήνα, μετά τα tabId, runtime.sendMessage και Extension
  //    context invalidated. Το ίδιο το σχόλιο (4) παραπάνω το είχε προβλέψει: «αυτό
  //    ακριβώς είναι το πρόβλημα με το να ταιριάζεις μία φράση ανά σύμπτωμα».
  //
  //    Οπότε εδώ δεν μπαίνει μία φράση αλλά ΤΟ ΛΕΞΙΛΟΓΙΟ του διαύλου μηνυμάτων που
  //    χρησιμοποιούν τα πρόσθετα του browser — σταθερά αλφαριθμητικά που τα παράγουν
  //    Chrome και Safari, όχι εμείς. Μετρημένο πριν μπουν: μηδέν εμφανίσεις και στον
  //    πηγαίο κώδικα και σε ολόκληρο το χτισμένο bundle (dist/assets/*.js).
  //
  //    Το «tabs:» ΔΕΝ μπήκε επίτηδες, όσο κι αν ταιριάζει σε αυτή την αναφορά: η
  //    σελίδα παραλίας έχει δικές της καρτέλες (tabWave/tabStory/tabNearby) και σε
  //    ελαχιστοποιημένο κώδικα το `tabs:` είναι κλειδί αντικειμένου — θα μπορούσε να
  //    βρεθεί μέσα σε ΔΙΚΟ μας μήνυμα σφάλματος και να το σβήσει.
  /\bNo Listener\b/i,
  /Receiving end does not exist/i,
  /message port closed/i,
  /Could not establish connection/i,
];

/**
 * Missing-chunk failures. These are NOT a broken site and must not fire "🔴 ΚΡΙΣΙΜΟ".
 *
 * utils/chunkLoadRecovery.ts already treats them as self-healing: clear the runtime
 * caches, reload once, land on the current build. index.tsx's RootErrorBoundary has
 * deliberately not reported them since day one for exactly that reason — but the
 * SAME error also arrives at the global `unhandledrejection` listener below, which
 * had no such filter. That gap is what filled Telegram on 03-04/08/2026 with
 * "έσπασε σελίδα σε επισκέπτη" for pages that were, in fact, fine: every asset the
 * alerts named (south-aegean-mykonos-jgY9YB5b.js, BeachDetailPage-BA_gNNyJ.js,
 * map-vendor-CIGW-MKW.css, index-Dop3pvh4.js) answered 200 on the live site while
 * the alerts were still arriving, and the build id in them was the live build.
 *
 * What a chunk failure really means is one of three harmless things: a deploy landed
 * while a tab was open, a phone on island 4G dropped one request, or AdsBot-Google
 * gave up on a subresource.
 *
 * The one version worth waking up for is the SECOND failure — recovery ran, reloaded,
 * and the chunk STILL would not load. That is a broken deploy. chunkLoadRecovery
 * stamps sessionStorage immediately before reloading, so a stamp younger than its own
 * cooldown means "the reload already happened and did not help". Keep those.
 */
const CHUNK_LOAD_PATTERNS: RegExp[] = [
  /dynamically imported module/i,
  /Importing a module script failed/i,
  /Loading chunk \S+ failed/i,
  /Unable to preload CSS/i,
];

/** Must match utils/chunkLoadRecovery.ts — same key, same cooldown. */
const CHUNK_RELOAD_KEY = 'calmBeachChunkReloadAttemptedAt';
const CHUNK_RELOAD_COOLDOWN_MS = 10_000;

const isSelfHealingChunkError = (message: string): boolean => {
  if (!CHUNK_LOAD_PATTERNS.some(pattern => pattern.test(message))) return false;

  try {
    const lastAttempt = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0);
    // Η ΣΦΡΑΓΙΔΑ ΜΠΑΙΝΕΙ ΠΡΙΝ ΤΗΝ ΕΠΑΝΑΦΟΡΤΩΣΗ, ΟΧΙ ΜΕΤΑ (διορθώθηκε 20/08/2026).
    // Ανάμεσα στη σφραγίδα και στο πραγματικό reload μεσολαβεί καθάρισμα μνήμης — και
    // σε κακό δίκτυο συνήθως πέφτουν ΠΟΛΛΑ κομμάτια μαζί. Κάθε επόμενο έβλεπε φρέσκια
    // σφραγίδα και αναφερόταν σαν «η επαναφόρτωση έγινε και δεν βοήθησε», δηλαδή 🟠
    // ειδοποίηση για κάτι που δεν είχε καν προλάβει να ξαναδοκιμαστεί.
    // `performance.timeOrigin` είναι η στιγμή που ξεκίνησε ΑΥΤΗ η φόρτωση: αν η σφραγίδα
    // είναι παλιότερη, η επαναφόρτωση όντως έγινε και είμαστε ήδη στη νέα σελίδα.
    const reloadActuallyHappened = lastAttempt < performance.timeOrigin;
    const recoveryAlreadyFailed =
      Number.isFinite(lastAttempt) &&
      lastAttempt > 0 &&
      reloadActuallyHappened &&
      // athens-clock-exempt: elapsed time since the last reload attempt, not a time of day.
      // Both sides are raw epoch instants and only their DIFFERENCE is read, so the viewer's
      // timezone cannot move it. Using athensNow() here would compare a wall-clock-shifted
      // value against a raw stored one and make the cooldown wrong by the UTC offset.
      Date.now() - lastAttempt < CHUNK_RELOAD_COOLDOWN_MS;
    return !recoveryAlreadyFailed;
  } catch {
    // No sessionStorage (private mode, embedded webview) — we cannot tell a first
    // failure from a second, so stay quiet rather than cry wolf.
    return true;
  }
};

const isIgnorable = (message: string, source: string, stack: string): boolean =>
  IGNORED_ERROR_PATTERNS.some(
    pattern => pattern.test(message) || pattern.test(source) || pattern.test(stack),
  ) ||
  isSelfHealingChunkError(message);

/**
 * ΞΕΝΟΣ ΚΩΔΙΚΑΣ ΠΟΥ ΤΡΕΧΕΙ ΜΕΣΑ ΣΤΗ ΣΕΛΙΔΑ ΜΑΣ (27/08/2026).
 *
 * Το Telegram γέμισε 🔴 «έσπασε σελίδα σε επισκέπτη» από τρία σφάλματα που δεν
 * μπορούν να είναι δικά μας:
 *   • `SyntaxError: Unexpected token 'else'` και `Unexpected identifier 'https'`
 *     στο /beaches/lemnos/1433-gomati/:1, από ενσωματωμένο browser εφαρμογής
 *     (Android `wv`, SM-S936B).
 *   • `undefined is not an object (evaluating 'r["@context"].toLowerCase')` στο
 *     :3:185 σε δύο σελίδες παραλιών, από Safari macOS. Πουθενά στον κώδικά μας
 *     δεν διαβάζεται το `@context` — είναι script που ψάχνει το JSON-LD μας.
 *
 * Αυτό που τα ενώνει: το `filename` του σφάλματος είναι η ΙΔΙΑ Η ΣΕΛΙΔΑ (.../:1),
 * όχι κάποιο `/assets/*.js`. Όλη η JavaScript που στέλνουμε φεύγει ως module από
 * `/assets/`, και το μόνο inline script που έχει η σελίδα μας είναι το τετράγραμμο
 * χρονόμετρο του fallback στο index.html — που δεν κάνει τίποτα από τα παραπάνω.
 * Άρα: αν ο browser δείχνει το ίδιο το HTML, το script το φύτεψε κάποιος άλλος
 * (επέκταση browser, ή ο in-app browser του Facebook/Instagram) αφού φόρτωσε η
 * σελίδα. Δεν το ελέγχουμε, δεν το διορθώνουμε, και ο επισκέπτης βλέπει κανονικά
 * τη σελίδα του.
 *
 * Ένα συντακτικό λάθος στο ΔΙΚΟ μας bundle δεν θα εμφανιζόταν έτσι ούτε θα ήταν
 * θέμα μιας συσκευής: το bundle χτίζεται μία φορά και θα έσπαγε σε όλους.
 *
 * Ελέγχεται ΜΟΝΟ εδώ, στον listener του `error`, όπου το `filename` το γράφει ο
 * browser. Δεν μπαίνει στο isIgnorable(): εκεί το `source` είναι δικές μας λέξεις
 * («RootErrorBoundary», «unhandledrejection») που ένα URL parse θα τις δεχόταν ως
 * σχετικές διαδρομές και θα έσβηνε τα πραγματικά σφάλματα.
 */
const isForeignInlineScript = (filename: string): boolean => {
  if (!filename) return false;
  try {
    const url = new URL(filename, window.location.href);
    if (url.origin !== window.location.origin) return false;
    return !/\.m?js$/i.test(url.pathname);
  } catch {
    return false;
  }
};

/** Path without query or hash: `?near=1` and friends can carry location intent. */
const currentPath = (): string => {
  try {
    return window.location.pathname.slice(0, 200);
  } catch {
    return '';
  }
};

const buildId = (): string => {
  try {
    return document.querySelector('meta[name="cb-build"]')?.getAttribute('content')?.slice(0, 60) || '';
  } catch {
    return '';
  }
};

export const reportClientError = (
  error: unknown,
  context?: { source?: string; line?: number },
): void => {
  try {
    if (import.meta.env?.DEV) return; // dev noise stays in the console

    const err = error as { message?: string; stack?: string } | undefined;
    const message = trimmed(err?.message, 300) || trimmed(error as string, 300) || 'Unknown error';
    const source = trimmed(context?.source, 200);
    const line = Number.isFinite(context?.line) ? Number(context?.line) : 0;
    const stack = trimmed(err?.stack, 1400);

    if (isIgnorable(message, source, stack)) return;

    const signature = `${message}|${source}|${line}`;
    if (sentThisSession.has(signature) || sentThisSession.size >= MAX_PER_SESSION) return;
    sentThisSession.add(signature);

    const payload = JSON.stringify({
      message,
      source,
      line,
      stack,
      page: currentPath(),
      buildId: buildId(),
    });

    // keepalive so the report survives the navigation away from a broken page.
    // sendBeacon would be tidier but cannot set Content-Type: application/json,
    // and the function needs to tell a crash from a CSP report by its body shape.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => { /* reporting must never surface an error of its own */ });
  } catch {
    /* never throw from the error reporter */
  }
};

/**
 * Catch what React's error boundary cannot: throws outside the component tree, and
 * rejected promises nobody handled. Both are how a fetch/parse bug actually shows up.
 */
export const installGlobalErrorReporting = (): void => {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', event => {
    // Failed <img>/<script> loads also fire this with no `error` object. A dead
    // Wikimedia photo is not a crash, and reporting them would drown the channel.
    if (!event.error) return;
    // Ξένο inline script μέσα στη σελίδα μας — βλ. isForeignInlineScript().
    if (isForeignInlineScript(event.filename)) return;
    reportClientError(event.error, { source: event.filename, line: event.lineno });
  });

  window.addEventListener('unhandledrejection', event => {
    const reason = event.reason;
    if (reason instanceof Error) {
      reportClientError(reason, { source: 'unhandledrejection' });
      return;
    }

    // ΣΦΑΛΜΑ ΑΠΟ ΑΛΛΟ «ΣΥΜΠΑΝ» JAVASCRIPT — ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ ΔΙΚΟ ΜΑΣ (29/08/2026).
    //
    // Ήρθε «Error: Ea» από /beaches/naxos/ σε Chrome iPhone: δύο γράμματα, καμία στοίβα,
    // τίποτα να πιαστεί. Το ίδιο το σχήμα του όμως το προδίδει. Το μήνυμα διαβάζεται
    // «Error: Ea» και όχι σκέτο «Ea», που σημαίνει ότι πέρασε από αυτόν εδώ τον κλάδο
    // — δηλαδή το `instanceof Error` είπε ΟΧΙ — ενώ το αντικείμενο είναι ΚΑΝΟΝΙΚΟ
    // Error, όπως το βεβαιώνει το Object.prototype.toString.
    //
    // Αυτά τα δύο μαζί γίνονται μόνο με έναν τρόπο: το Error φτιάχτηκε σε ΞΕΧΩΡΙΣΤΟ
    // περιβάλλον JavaScript. Το `instanceof` συγκρίνει με τον δικό ΜΑΣ κατασκευαστή
    // Error, οπότε αστοχεί σε οτιδήποτε γεννήθηκε αλλού. Κώδικας του δικού μας bundle
    // τρέχει πάντα στο ίδιο περιβάλλον με τη σελίδα και περνάει πάντα το instanceof·
    // δεν έχουμε ούτε ένα <iframe> πουθενά, και τα σφάλματα ενός worker δεν φτάνουν
    // εδώ. Άρα μένει μόνο κώδικας που φύτεψε ο browser ή κάποιο πρόσθετο στο δικό του
    // απομονωμένο περιβάλλον μέσα στη σελίδα μας.
    //
    // Δομικός έλεγχος, όχι ακόμα μια φράση σε λίστα: πιάνει κάθε μελλοντικό μήνυμα
    // αυτής της οικογένειας, όποιο κι αν είναι το κείμενό του.
    const isCrossRealmError = Object.prototype.toString.call(reason) === '[object Error]';
    if (isCrossRealmError) return;

    // ΚΑΙ ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ ΠΟΥ ΞΕΣΚΕΠΑΣΕ Η ΙΔΙΑ ΑΝΑΦΟΡΑ: εδώ γραφόταν `stack: ''`,
    // δηλαδή πετούσαμε τη στοίβα ακόμα κι όταν υπήρχε. Γι' αυτό το «Error: Ea» έφτασε
    // γυμνό και δεν μπορούσε να αποδοθεί σε κανέναν. Ό,τι μας δίνει η αιτία, το
    // κρατάμε — τα φίλτρα εξετάζουν πλέον και τη στοίβα, οπότε μια στοίβα που
    // ονομάζει επέκταση ή ξένο script αναγνωρίζεται από μόνη της.
    const stack = typeof (reason as { stack?: unknown })?.stack === 'string'
      ? (reason as { stack: string }).stack
      : '';
    reportClientError({ message: String(reason), stack }, { source: 'unhandledrejection' });
  });
};
