// ─────────────────────────────────────────────────────────────────────────────
// ΕΒΔΟΜΑΔΙΑΙΟ ΜΗΝΥΜΑ ΠΟΙΟΤΗΤΑΣ — Δευτέρα πρωί, στο Telegram.
//
// Η καρτέλα «Ποιότητα» απαντάει στο «ποια περιοχή σειρά έχει» — αλλά μόνο σε
// όποιον την ανοίξει. Μια σελίδα που πρέπει να τη θυμηθείς είναι σελίδα που δεν
// ανοίγεις· ακριβώς αυτό έπαθε και η παλιά σελίδα εγκρίσεων, γι' αυτό μετακόμισε
// μέσα στην κονσόλα. Εδώ η ίδια λογική πάει ένα βήμα παραπέρα: το ταμπλό έρχεται
// σ' εσένα.
//
// ΤΟ ΙΔΙΟ pipeline ΜΕ ΤΗΝ ΚΑΡΤΕΛΑ. Η σειρά βγαίνει από το lib/qualityPriority.mjs,
// που είναι ΚΑΙ ο μόνος κριτής της σελίδας. Δύο αντίγραφα της ίδιας αριθμητικής θα
// απέκλιναν μέσα σε έναν μήνα, και ένα μήνυμα που ονομάζει άλλο νησί από το ταμπλό
// είναι χειρότερο από κανένα μήνυμα.
//
// ΔΕΝ ΣΤΕΛΝΕΙ ΓΙΑ ΝΑ ΣΤΕΙΛΕΙ. Αν δεν υπάρχει τίποτα που να αξίζει, δεν φεύγει
// μήνυμα — ένα εβδομαδιαίο «όλα καλά» εκπαιδεύει το μάτι να το προσπερνά, και τότε
// χάνεται και το μήνυμα που μετρούσε.
//
// Ρύθμιση: schedule στο netlify.toml. Χωρίς TELEGRAM token/chat δεν κάνει τίποτα.
// ─────────────────────────────────────────────────────────────────────────────

import { connectLambda, getStore } from '@netlify/blobs';
import LEDGER from './lib/qualityLedger.generated.mjs';
import { agoLabel, buildQualityRows, buildBeachGapRows, daysSince } from './lib/qualityPriority.mjs';

const TRAFFIC_STORE = 'traffic';
const QUALITY_STORE = 'quality';

/** How many days of traffic the ranking looks at — the console's own window. */
const WINDOW_DAYS = 30;
/** How many regions the message names. More than three is a list, not a nudge. */
const REGIONS_IN_MESSAGE = 3;
/** How many individual beaches. Same reason. */
const BEACHES_IN_MESSAGE = 5;

const utcDayKey = (date) => date.toISOString().slice(0, 10);

const telegram = () => ({
  botToken: process.env.FEEDBACK_TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '',
  chatId: process.env.FEEDBACK_TELEGRAM_CHAT_ID || process.env.TELEGRAM_CHAT_ID || '',
});

const esc = (value) =>
  String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const num = (value) => (value || 0).toLocaleString('el-GR');

/**
 * The same rollups the stats tab merges, for the same window. Read directly by
 * key rather than listed: we know exactly which days we want, and a list() over
 * the whole store costs far more for the same answer.
 */
const readWindow = async (store) => {
  const today = Date.now();
  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => utcDayKey(new Date(today - i * 86400000)));
  const totals = await Promise.all(
    days.map((day) => store.get(`totals/${day}`, { type: 'json' }).catch(() => null))
  );

  const views = {};
  const pages = {};
  let measured = 0;
  for (const day of totals) {
    if (!day) continue;
    measured += 1;
    for (const [k, v] of Object.entries(day.views || {})) views[k] = (views[k] || 0) + v;
    for (const [k, v] of Object.entries(day.pages || {})) pages[k] = (pages[k] || 0) + v;
  }
  return { views, pages, measured };
};

/**
 * Το μήνυμα. Γράφεται ολόκληρο εδώ γιατί ένα digest είναι κείμενο πριν είναι
 * δεδομένα: αν δεν διαβάζεται στο κινητό σε δέκα δευτερόλεπτα, δεν έχει νόημα.
 *
 * Εξάγεται γιατί η κονσόλα το δείχνει κι εκείνη (`/api/traffic?key=…&digest=1`):
 * οι προγραμματισμένες συναρτήσεις του Netlify **δεν απαντούν σε HTTP** — γυρίζουν
 * 403 σε οποιονδήποτε, μαζί κι εμάς. Οπότε η μόνη πόρτα για να δεις το μήνυμα πριν
 * σταλεί είναι η κονσόλα, που έχει ήδη το κλειδί της. Ένα μήνυμα που δεν μπορείς να
 * το δοκιμάσεις πριν φύγει είναι μήνυμα που το διαβάζεις πρώτη φορά μαζί με όλους.
 */
export const composeDigest = ({ rows, beachRows, todos, measured, consoleUrl }) => {
  const top = rows.slice(0, REGIONS_IN_MESSAGE);
  const openTodos = Object.entries(todos || {}).flatMap(([regionId, list]) =>
    (Array.isArray(list) ? list : []).filter((t) => !t.done).map((t) => ({ ...t, regionId }))
  );
  const ledgerAge = daysSince(LEDGER.generatedAt);

  const lines = ['🔎 <b>Ποιότητα παραλιών — η βδομάδα που ξεκινάει</b>', ''];

  for (const [i, row] of top.entries()) {
    const worst = [...row.axes].sort((a, b) => a.pct - b.pct).slice(0, 2);
    lines.push(
      `${i + 1}. <b>${esc(row.label)}</b> — ${
        row.views ? `${num(row.views)} προβολές` : 'χωρίς προβολές'
      }, έλεγχος ${esc(agoLabel(row.lastAt))}`
    );
    lines.push(`   ${worst.map((a) => `${esc(a.short)} ${a.pct}%`).join(' · ')}`);
    if (row.gaps.length) lines.push(`   <i>${esc(row.gaps.slice(0, 2).join(' · '))}</i>`);
  }

  if (beachRows.length) {
    lines.push('', '<b>Σελίδες που τις βλέπουν και τους λείπει κάτι</b>');
    for (const beach of beachRows.slice(0, BEACHES_IN_MESSAGE)) {
      lines.push(
        `• ${esc(beach.name)} <i>(${esc(beach.region)})</i> — ${num(beach.views)} προβολές, ` +
          `λείπει: ${esc(beach.missing.map((a) => a.short).join(', '))}`
      );
    }
  }

  if (openTodos.length) {
    lines.push('', `<b>Ανοιχτές σημειώσεις: ${num(openTodos.length)}</b>`);
    for (const todo of openTodos.slice(0, 3)) {
      lines.push(`• ${todo.beachName ? `${esc(todo.beachName)}: ` : ''}${esc(todo.text)}`);
    }
  }

  // Ο αριθμός που κρατάει το μήνυμα τίμιο: αν το ημερολόγιο είναι μπαγιάτικο, ό,τι
  // γράφει από πάνω περιγράφει τον προηγούμενο μήνα, όχι αυτόν.
  if (ledgerAge !== null && ledgerAge > 21) {
    lines.push('', `⚠️ Το ημερολόγιο χτίστηκε ${esc(agoLabel(LEDGER.generatedAt))} — τρέξε <code>npm run quality:ledger</code>.`);
  }
  if (measured < WINDOW_DAYS) {
    lines.push(`<i>Η κίνηση μετρήθηκε σε ${measured} από ${WINDOW_DAYS} μέρες.</i>`);
  }

  lines.push('', `<a href="${consoleUrl}">Άνοιξε το ταμπλό</a>`);
  return lines.join('\n');
};

export const handler = async (event) => {
  try {
    connectLambda(event);
  } catch {
    /* Ο προγραμματισμένος χρόνος δεν περνά Lambda context· τα Blobs διαβάζονται
       από το περιβάλλον του site και χωρίς αυτό. */
  }

  const { botToken, chatId } = telegram();
  const manual = (event?.queryStringParameters || {}).preview === '1';

  try {
    const store = getStore(TRAFFIC_STORE);
    const quality = getStore(QUALITY_STORE);
    const [{ views, pages, measured }, checks, todos] = await Promise.all([
      readWindow(store),
      quality.get('checks', { type: 'json' }).catch(() => null),
      quality.get('todos', { type: 'json' }).catch(() => null),
    ]);

    const rows = buildQualityRows(views, checks || {});
    const beachRows = buildBeachGapRows(pages);

    // Τι κάνει μια εβδομάδα «να αξίζει μήνυμα»: κάτι έχει καθυστερήσει, ή κάποια
    // σελίδα με κίνηση έχει κενό, ή υπάρχει ανοιχτή σημείωση. Αλλιώς σιωπή.
    const late = rows.filter((r) => r.overdue > 0).length;
    const openTodos = Object.values(todos || {}).flat().filter((t) => t && !t.done).length;
    const worthSending = late > 0 || beachRows.length > 0 || openTodos > 0;

    const key = process.env.TRAFFIC_STATS_KEY || '';
    const consoleUrl = `https://calmbeach.gr/api/traffic?key=${encodeURIComponent(key)}&tab=quality`;
    const text = composeDigest({ rows, beachRows, todos: todos || {}, measured, consoleUrl });

    if (manual) {
      // Αδύνατο να φτάσει εδώ κάποιος από το internet (το Netlify απαντά 403 στις
      // προγραμματισμένες συναρτήσεις). Μένει για `netlify dev` και για κλήση από
      // άλλη συνάρτηση· η πραγματική προεπισκόπηση ζει στην κονσόλα.
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        body: `worthSending=${worthSending} (καθυστερούν ${late}, σελίδες ${beachRows.length}, σημειώσεις ${openTodos})\n\n${text}`,
      };
    }

    if (!worthSending) {
      console.log('quality-digest: τίποτα να πω αυτή τη βδομάδα, δεν στάλθηκε μήνυμα.');
      return { statusCode: 200, body: 'quiet week' };
    }
    if (!botToken || !chatId) {
      console.warn('quality-digest: λείπει TELEGRAM token/chat — δεν στάλθηκε τίποτα.');
      return { statusCode: 200, body: 'not configured' };
    }

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        // Το link κουβαλάει το μυστικό κλειδί της κονσόλας· καμία προεπισκόπηση.
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) console.error('quality-digest: Telegram', response.status, await response.text());
    return { statusCode: 200, body: response.ok ? 'sent' : 'telegram failed' };
  } catch (error) {
    // Ένα digest που σκάει δεν πρέπει να φαίνεται σαν να μην υπάρχει πρόβλημα.
    console.error('quality-digest failed.', error && error.message, error && error.stack);
    return { statusCode: 200, body: `error: ${error && error.message}` };
  }
};

export default handler;
