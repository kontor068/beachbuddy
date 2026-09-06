// ─────────────────────────────────────────────────────────────────────────────
// ΑΥΤΟΜΑΤΟΣ ΕΛΕΓΧΟΣ ΑΡΝΗΤΙΚΩΝ ΣΧΟΛΙΩΝ — κάθε πρωί, στο Telegram.
//
// Κάθε σχόλιο επισκέπτη φτάνει ήδη στο Telegram τη στιγμή που πατιέται
// (feedback-email.mjs). Αυτό όμως απαντάει σε άλλο ερώτημα: ένα μεμονωμένο
// «είχε πιο πολύ αέρα» δεν είναι σφάλμα — μπορεί να είναι απόγειος άνεμος, λάθος
// ώρα, ή απλώς μια κακή μέρα. Σφάλμα είναι το ΜΟΤΙΒΟ: η ίδια παραλία, ο ίδιος
// άνεμος, τρεις και τέσσερις φορές. Αυτό δεν φαίνεται σε μια ροή μηνυμάτων που
// έρχονται με βδομάδες διαφορά — φαινόταν μόνο αν κατέβαζες το αρχείο με το χέρι
// και έτρεχες τη βαθμονόμηση, δηλαδή αν το θυμόσουν.
//
// ΙΔΙΑ ΑΡΙΘΜΗΤΙΚΗ ΜΕ ΤΟ ΧΕΙΡΟΚΙΝΗΤΟ ΠΕΡΑΣΜΑ. Τα κατώφλια και τα σήματα βγαίνουν
// από το lib/feedbackSignals.mjs, που είναι ΚΑΙ ο κριτής του
// scripts/calibrateFromFeedback.mjs. Ένα μήνυμα που ονομάζει άλλη παραλία από την
// αναφορά είναι χειρότερο από κανένα μήνυμα.
//
// ΔΕΝ ΣΤΕΛΝΕΙ ΓΙΑ ΝΑ ΣΤΕΙΛΕΙ. Μιλάει μόνο για σήματα που δεν έχει ξαναπεί, ή που
// μεγάλωσαν αισθητά από την τελευταία φορά (μνήμη στα Blobs). Ένα καθημερινό
// «όλα καλά» — ή η ίδια παραλία κάθε πρωί — εκπαιδεύει το μάτι να το προσπερνά,
// και τότε χάνεται και το μήνυμα που μετρούσε. Ίδιος κανόνας με το quality-digest.
//
// Ρύθμιση: schedule στο netlify.toml. Χωρίς TELEGRAM token/chat δεν κάνει τίποτα.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';
import LEDGER from './lib/qualityLedger.generated.mjs';
import {
  MIN_SAMPLES,
  aggregateFeedback,
  buildProposals,
  windDirLabel,
} from './lib/feedbackSignals.mjs';

const FEEDBACK_STORE = 'feedback-log';
/** Η μνήμη του ελέγχου: τι έχει ήδη ειπωθεί και με πόσα δείγματα. */
const STATE_KEY = 'watch/alerted';

/** Πόσο πίσω κοιτάει. Τα σχόλια είναι λίγα και αραιά — ένα σύντομο παράθυρο δεν θα έβγαζε ποτέ μοτίβο. */
const WINDOW_DAYS = 90;
/** Φρένο κόστους/χρόνου: πάνω από τόσες εγγραφές το παράθυρο κόβεται από τις πιο πρόσφατες μέρες. */
const MAX_RECORDS = 4_000;
/** Πόσα ΝΕΑ δείγματα χρειάζεται ένα ήδη ειπωμένο σήμα για να ξαναειπωθεί. */
const REALERT_SAMPLE_STEP = 3;
/** Πόσα σήματα ονομάζει το μήνυμα. Περισσότερα είναι λίστα, όχι σκουντιά. */
const SIGNALS_IN_MESSAGE = 5;
/** Πόσο παλιό σήμα ξεχνιέται εντελώς (καθαρίζει τη μνήμη από κελιά εκτός παραθύρου). */
const STATE_TTL_DAYS = 180;

const SITE_URL = 'https://calmbeach.gr';

const telegram = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const esc = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const utcDayKey = (ms) => new Date(ms).toISOString().slice(0, 10);

/** «πριν 3 μέρες» / «σήμερα» — το μήνυμα διαβάζεται από άνθρωπο σε κινητό. */
const agoLabel = (iso) => {
  const at = Date.parse(iso || '');
  if (!Number.isFinite(at)) return '';
  const days = Math.floor((Date.now() - at) / 86_400_000);
  if (days <= 0) return 'σήμερα';
  if (days === 1) return 'χθες';
  if (days < 30) return `πριν ${days} μέρες`;
  const months = Math.round(days / 30);
  return months === 1 ? 'πριν έναν μήνα' : `πριν ${months} μήνες`;
};

/**
 * id -> { name, region } από το ημερολόγιο ποιότητας. Καλύπτει μόνο τις παραλίες που
 * έχουν κάποιο κενό — γι' αυτό ΔΕΝ είναι η κύρια πηγή: το όνομα ταξιδεύει πλέον μαζί
 * με την ίδια την αναφορά (feedback-email.mjs). Αυτό εδώ σώζει τις παλιές εγγραφές.
 */
const LEDGER_NAMES = new Map(
  (LEDGER.beachGaps || []).map(([id, name, regionIndex]) => [
    id,
    { name, region: LEDGER.regions?.[regionIndex]?.label || '' },
  ])
);

/**
 * Το παράθυρο των αναφορών. ΜΙΑ list() πάνω στο πρόθεμα `f/` και φιλτράρισμα από το
 * κλειδί, όχι ενενήντα ξεχωριστές κλήσεις μία ανά μέρα: η μέρα είναι γραμμένη μέσα στο
 * ίδιο το κλειδί (`f/<μέρα>/<uuid>`), οπότε ποιες εγγραφές θέλουμε φαίνεται χωρίς να
 * τις κατεβάσουμε. Κατεβαίνουν μόνο όσες πέφτουν μέσα στο παράθυρο, από τις πιο
 * πρόσφατες προς τα πίσω, ώστε το φρένο του MAX_RECORDS να κόβει το παλιό και όχι το νέο.
 */
const readWindow = async (store) => {
  const cutoff = utcDayKey(Date.now() - (WINDOW_DAYS - 1) * 86_400_000);

  const keys = [];
  for await (const page of store.list({ prefix: 'f/', paginate: true })) {
    for (const blob of page.blobs || []) {
      const dayKey = blob.key.slice('f/'.length, 'f/'.length + 10);
      if (dayKey >= cutoff) keys.push(blob.key);
    }
  }
  // Τα κλειδιά ξεκινούν με τη μέρα, άρα η αλφαβητική σειρά ΕΙΝΑΙ η χρονολογική.
  keys.sort().reverse();
  const truncated = keys.length > MAX_RECORDS;
  const wanted = truncated ? keys.slice(0, MAX_RECORDS) : keys;

  const records = [];
  for (const record of await Promise.all(
    wanted.map((key) => store.get(key, { type: 'json' }).catch(() => null))
  )) {
    if (record) records.push(record);
  }
  return { records, truncated };
};

/** Ένα πάτημα που ανοίγει την παραλία — μόνο αν το μονοπάτι είναι δικό μας και δείχνει σελίδα παραλίας. */
const beachLink = (pagePath) => {
  if (!pagePath) return '';
  let url;
  try {
    url = new URL(pagePath, SITE_URL);
  } catch {
    return '';
  }
  const host = url.hostname.toLowerCase();
  if (host !== 'calmbeach.gr' && host !== 'www.calmbeach.gr') return '';
  if (!/\/beaches\/[^/]+\/\d+-/.test(url.pathname)) return '';
  return url.href;
};

/**
 * Ποια σήματα αξίζουν μήνυμα ΣΗΜΕΡΑ: όσα δεν έχουν ειπωθεί, όσα άλλαξαν είδος, και
 * όσα μάζεψαν άλλα τρία δείγματα από την τελευταία φορά. Η μνήμη είναι το μόνο που
 * χωρίζει έναν αυτόματο έλεγχο από έναν καθημερινό θόρυβο.
 */
export const selectNewSignals = (proposals, state) => {
  const known = (state && typeof state === 'object' && state.cells) || {};
  return proposals.filter((p) => {
    const seen = known[p.key];
    if (!seen) return true;
    if (seen.type !== p.type) return true;
    return p.samples >= (seen.samples || 0) + REALERT_SAMPLE_STEP;
  });
};

/** Η νέα μνήμη: ό,τι μόλις ειπώθηκε, συν ό,τι παλιό δεν έχει ακόμη ξεχαστεί. */
export const nextState = (state, reported, now = Date.now()) => {
  const cells = {};
  const previous = (state && typeof state === 'object' && state.cells) || {};
  const cutoff = now - STATE_TTL_DAYS * 86_400_000;
  for (const [key, value] of Object.entries(previous)) {
    const at = Date.parse(value?.at || '');
    if (Number.isFinite(at) && at < cutoff) continue;
    cells[key] = value;
  }
  const at = new Date(now).toISOString();
  for (const p of reported) cells[p.key] = { type: p.type, samples: p.samples, at };
  return { updatedAt: at, cells };
};

/**
 * Το μήνυμα. Γράφεται ολόκληρο εδώ γιατί πρώτα είναι κείμενο και μετά δεδομένα: αν
 * δεν διαβάζεται στο κινητό σε δέκα δευτερόλεπτα, δεν έχει νόημα να σταλεί.
 */
export const composeWatchMessage = ({ signals, records, cells, truncated }) => {
  const under = signals.filter((s) => s.type === 'UNDER_WARN');
  const over = signals.filter((s) => s.type === 'OVER_WARN');

  const lines = [
    '🟡 <b>Σχόλια επισκεπτών: βγήκε μοτίβο</b>',
    `<i>Ίδια παραλία, ίδιος άνεμος, τουλάχιστον ${MIN_SAMPLES} αναφορές — όχι μεμονωμένο παράπονο.</i>`,
  ];

  if (under.length) {
    lines.push('', '<b>Δείχναμε πιο ήρεμα απ\' ό,τι βρήκαν</b>');
    for (const [i, s] of under.slice(0, SIGNALS_IN_MESSAGE).entries()) {
      const where = [esc(s.name), s.region ? `<i>(${esc(s.region)})</i>` : ''].filter(Boolean).join(' ');
      lines.push(
        `${i + 1}. ${where} — ${esc(windDirLabel(s.sector))}: ` +
          `${s.negative} από ${s.samples} αναφορές «χειρότερα απ' ό,τι δείχναμε»`
      );
      const link = beachLink(s.pagePath);
      const tail = [s.lastAt ? `τελευταία ${agoLabel(s.lastAt)}` : '', link ? `<a href="${esc(link)}">άνοιξέ την</a>` : '']
        .filter(Boolean)
        .join(' · ');
      if (tail) lines.push(`   ${tail}`);
    }
    lines.push(
      '',
      '<i>Η ασφαλής φορά: αν ισχύει, η παραλία θέλει αυτόν τον άνεμο στο ' +
        '<code>exposedToWindDirections</code> (utils/windProfileOverrides.ts).</i>'
    );
  }

  if (over.length) {
    lines.push('', '<b>Το βρήκαν πιο ήρεμο απ\' ό,τι δείχναμε</b>');
    for (const s of over.slice(0, SIGNALS_IN_MESSAGE)) {
      const where = [esc(s.name), s.region ? `<i>(${esc(s.region)})</i>` : ''].filter(Boolean).join(' ');
      lines.push(`• ${where} — ${esc(windDirLabel(s.sector))}: ${s.calmer} από ${s.samples} «πιο ήρεμα»`);
    }
    // Το μαλάκωμα είναι η επικίνδυνη φορά: λέγεται, δεν εφαρμόζεται μόνο του.
    lines.push('', '<i>Μη μαλακώσεις με αυτό μόνο — θέλει δεύτερη, ανεξάρτητη πηγή.</i>');
  }

  lines.push(
    '',
    `<i>Παράθυρο ${WINDOW_DAYS} ημερών: ${records} ${records === 1 ? 'αναφορά' : 'αναφορές'}, ` +
      `${cells} ${cells === 1 ? 'συνδυασμός' : 'συνδυασμοί'} παραλίας-ανέμου.` +
      `${truncated ? ' Κόπηκε στο όριο ανάγνωσης.' : ''}</i>`,
    'Ολόκληρη η εικόνα: <code>npm run calibrate:feedback -- --input &lt;export.json&gt;</code>'
  );

  return lines.join('\n');
};

export const handler = async (event) => {
  try {
    connectLambda(event);
  } catch {
    /* Ο προγραμματισμένος χρόνος δεν περνά Lambda context· τα Blobs διαβάζονται
       από το περιβάλλον του site και χωρίς αυτό. Ίδιο με το quality-digest. */
  }

  const { botToken, chatId } = telegram();
  const manual = (event?.queryStringParameters || {}).preview === '1';

  try {
    const store = getStore(FEEDBACK_STORE);
    const [{ records, truncated }, state] = await Promise.all([
      readWindow(store),
      store.get(STATE_KEY, { type: 'json' }).catch(() => null),
    ]);

    const cells = aggregateFeedback(records);
    const proposals = buildProposals(cells, (id) => LEDGER_NAMES.get(id));
    const signals = selectNewSignals(proposals, state);
    const text = composeWatchMessage({ signals, records: records.length, cells: cells.size, truncated });

    if (manual) {
      // Το Netlify απαντά 403 στις προγραμματισμένες συναρτήσεις, οπότε αυτή η πόρτα
      // δεν είναι προσβάσιμη από το internet· μένει για `netlify dev` και για δοκιμή
      // του κειμένου πριν φύγει σε κανέναν.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body:
          `records=${records.length} cells=${cells.size} proposals=${proposals.length} new=${signals.length}\n\n` +
          (signals.length ? text : '(τίποτα νέο — δεν θα σταλεί μήνυμα)'),
      };
    }

    if (!signals.length) {
      console.log(`feedback-watch: ${proposals.length} σήματα, κανένα νέο — δεν στάλθηκε μήνυμα.`);
      return { statusCode: 200, body: 'nothing new' };
    }
    if (!botToken || !chatId) {
      console.warn('feedback-watch: λείπει TELEGRAM token/chat — δεν στάλθηκε τίποτα.');
      return { statusCode: 200, body: 'not configured' };
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) {
      // ΧΩΡΙΣ ενημέρωση της μνήμης: ένα σήμα που δεν έφτασε ποτέ δεν πρέπει να
      // θεωρηθεί ειπωμένο, αλλιώς χάνεται σιωπηλά για πάντα.
      console.error('feedback-watch: Telegram', response.status, await response.text());
      return { statusCode: 200, body: 'telegram failed' };
    }

    try {
      await store.setJSON(STATE_KEY, nextState(state, signals));
    } catch (error) {
      // Το μήνυμα έφυγε· η μνήμη θα ξαναγραφτεί αύριο. Το χειρότερο που μπορεί να
      // γίνει είναι ένα διπλό μήνυμα, όχι ένα χαμένο σήμα.
      console.error('feedback-watch: δεν αποθηκεύτηκε η μνήμη.', error && error.message);
    }

    return { statusCode: 200, body: `sent ${signals.length}` };
  } catch (error) {
    // Ένας έλεγχος που σκάει δεν πρέπει να φαίνεται σαν «όλα καλά».
    console.error('feedback-watch failed.', error && error.message, error && error.stack);
    return { statusCode: 200, body: `error: ${error && error.message}` };
  }
};

export default handler;
