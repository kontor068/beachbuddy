// Offline calibration pass for roadmap #7 — the model-level half of the feedback loop.
//
// Turns captured `condition_feedback` into CONSERVATIVE, human-reviewable proposals. There
// is no app backend, so this runs by hand over an export of the feedback (the GA4
// `condition_feedback` events, or the app's local FEEDBACK_KEY records) — a JSON array of
// FeedbackData { beachId, feedback, timestamp, conditions:{ exposureLevel, beaufort, windDir, date } }.
//
//   node scripts/calibrateFromFeedback.mjs --input .tmp/feedback-export.json
//   node scripts/calibrateFromFeedback.mjs --demo        # synthetic example, proves the pipeline
//
// Policy (matches the project's evidence rule): wrong-"calm" is the dangerous error, so an
// UNDER-warn signal (visitors report waves/wind where the model showed calm/partial) is the
// safe direction and is proposed readily; an OVER-warn signal (visitors report calmer than
// shown) only proposes a SOFTENING for manual review and only with extra evidence.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argVal = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1]; };
const DEMO = process.argv.includes('--demo');
// Διαγνωστικό: κρατά ΚΑΙ τις αναφορές που κοιτούσαν άλλη μέρα/ώρα, για να φαίνεται τι
// ακριβώς κόβει το φίλτρο. ΠΟΤΕ για πραγματική βαθμονόμηση — βλ. `timingMismatch`.
const KEEP_MISMATCHED = process.argv.includes('--keep-mismatched');
const inputPath = argVal('--input') || '.tmp/feedback-export.json';
const outPath = argVal('--out') || '.tmp/feedback-calibration-report.json';

const MIN_SAMPLES = 3;            // a (beach,sector) needs this many reports before we propose anything
const UNDER_WARN_FRACTION = 0.5; // >= half "worse than shown" -> propose raising exposure (safe)
const SOFTEN_MIN_SAMPLES = 6;    // softening is the less-conservative direction -> demand more
const SOFTEN_FRACTION = 0.66;
const NEGATIVE = new Set(['had_waves', 'too_windy', 'not_accurate']);

/**
 * ΤΑ ΝΟΥΜΕΡΑ ΤΗΣ ΟΘΟΝΗΣ ΚΑΙ Η ΜΝΗΜΗ ΤΟΥ ΕΠΙΣΚΕΠΤΗ ΠΡΕΠΕΙ ΝΑ ΜΙΛΑΝΕ ΓΙΑ ΤΗΝ ΙΔΙΑ ΩΡΑ.
 *
 * Ένα «είχε πιο πολύ κύμα» βαθμονομεί το μοντέλο ΜΟΝΟ αν τα `seaStateWaveM`/`beaufort` που
 * ταξιδεύουν μαζί του ανήκουν στη στιγμή που ο άνθρωπος ήταν όντως στο νερό. Τα πεδία που
 * το αποδεικνύουν μπαίνουν στην εγγραφή από τις 29/08/2026 (`services/analyticsService.ts`),
 * αλλά αυτό το script δεν τα διάβαζε ποτέ — τα μετρούσε όλα σαν ισοδύναμη παρατήρηση.
 *
 * ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: Τιγκάκι Κω (2335), 01/09/2026. Ο επισκέπτης ήταν στην παραλία το ΑΠΟΓΕΥΜΑ
 * ΤΗΣ 1ης, με τη σελίδα γυρισμένη στις 10:00 ΤΗΣ 2ας — απόσταση ~20 ώρες, άλλη μέρα κι άλλη
 * ώρα της μέρας. Έκρινε το «0,22 μ. / 2 Μποφόρ» ενός πρωινού απέναντι σε ένα απόγευμα που
 * δεν είδε ποτέ η σελίδα. Εκεί σώθηκε από την πύλη `modeledCalm > 0` (το μοντέλο έλεγε ήδη
 * `exposed`), αλλά σε παραλία χαρακτηρισμένη `partial` τρία τέτοια σχόλια περνάνε το κατώφλι
 * και προτείνουν χειροκίνητο override που δεν χρειάζεται. Η βαθμονόμηση δηλητηριάζεται από
 * παρατηρήσεις που ποτέ δεν αντιπαρατέθηκαν με τον σωστό αριθμό.
 *
 * ⚠️ ΠΕΤΑΜΕ ΜΟΝΟ Ο,ΤΙ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΑΤΑΙΡΙΑΣΤΟ, ΠΟΤΕ Ο,ΤΙ ΑΠΛΩΣ ΔΕΝ ΞΕΡΟΥΜΕ. Οι εγγραφές
 * πριν από τις 29/08 δεν έχουν καθόλου αυτά τα πεδία, και το «δεν θυμάμαι» είναι έγκυρη
 * απάντηση του χρήστη. Άγνωστο ⇒ κρατιέται (και το `--demo` συνεχίζει να δουλεύει).
 */
const OBSERVED_HOUR_BANDS = { morning: [6, 12], midday: [11, 16], evening: [16, 22] };
const NOW_TOLERANCE_H = 2; // «τώρα είμαι εκεί»: ο διακόπτης επιτρέπεται να απέχει ±2 ώρες

// `en-CA` δίνει YYYY-MM-DD, ίδια μορφή με το `conditions.date` (wallClockDayKey).
const athensDayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Athens', year: 'numeric', month: '2-digit', day: '2-digit',
});
const athensDayKey = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : athensDayFmt.format(d);
};

/**
 * Επιστρέφει τον ΛΟΓΟ που η εγγραφή δεν μπορεί να βαθμονομήσει, ή `null` αν είναι χρήσιμη.
 *
 * Το `observedTiming` ('morning'/'midday'/'evening') αναφέρεται ΠΑΝΤΑ στη σημερινή μέρα του
 * επισκέπτη — έτσι το ρωτάει η σελίδα («Το πρωί», «This morning»), οπότε η μέρα της
 * παρατήρησης είναι η μέρα του κλικ σε ώρα Ελλάδας.
 *
 * ΣΗΜΕΙΩΣΗ ΖΩΝΗΣ: το `shownHour` γεννιέται στη ζώνη ΤΗΣ ΣΥΣΚΕΥΗΣ ενώ το `hour` σε ώρα
 * Ελλάδας. Για κάποιον που στέκεται σε ελληνική παραλία ταυτίζονται· τα εύρη από πάνω είναι
 * ούτως ή άλλως πλατιά ώστε μια ώρα διαφορά να μην πετάει έγκυρη αναφορά.
 */
const timingMismatch = (fb) => {
  const c = fb?.conditions;
  if (!c) return null;
  const timing = c.observedTiming;
  if (!timing || timing === 'unsure') return null; // ο χρήστης είπε ρητά ότι δεν ξέρει

  // Α. Άλλη ΜΕΡΑ — η οθόνη έδειχνε πρόβλεψη, ο άνθρωπος θυμάται άλλη μέρα.
  const visitDay = athensDayKey(fb.timestamp);
  if (c.date && visitDay && c.date !== visitDay) {
    return `screen was on ${c.date}, the visit was ${visitDay}`;
  }

  // Β. Ίδια μέρα, άλλη ΩΡΑ. `shownHour: undefined` ⇒ ο διακόπτης ήταν στο «τώρα», άρα η
  // ώρα της οθόνης ΕΙΝΑΙ η ώρα του κλικ.
  const screenHour = typeof c.shownHour === 'number' ? c.shownHour : c.hour;
  if (typeof screenHour !== 'number') return null;
  const band = timing === 'now'
    ? (typeof c.hour === 'number' ? [c.hour - NOW_TOLERANCE_H, c.hour + NOW_TOLERANCE_H] : undefined)
    : OBSERVED_HOUR_BANDS[timing];
  if (!band) return null;
  if (screenHour < band[0] || screenHour > band[1]) {
    const hh = String(screenHour).padStart(2, '0');
    return `screen was on ${hh}:00, the visit was "${timing}" (${band[0]}:00-${band[1]}:00)`;
  }
  return null;
};

// beachId -> { name, region }
const APP = 'public/data/beaches/app';
const beachInfo = new Map();
for (const f of readdirSync(APP).filter(f => f.endsWith('.json'))) {
  const app = JSON.parse(readFileSync(path.join(APP, f), 'utf8'));
  for (const b of (app.island?.beaches || [])) {
    if (typeof b.id === 'number') beachInfo.set(b.id, { name: b.name?.en || String(b.id), region: f.replace('.json', '') });
  }
}

let feedback = [];
if (DEMO) {
  // Synthetic: one beach repeatedly reported rough from the N sector where the model showed
  // partial (a clear UNDER-warn), plus noise, to exercise the pipeline end-to-end.
  const id = [...beachInfo.keys()][0];
  const day = new Date().toISOString().slice(0, 10);
  const mk = (feedbackV, exposureLevel, windDir) => ({ beachId: id, feedback: feedbackV, timestamp: new Date().toISOString(), conditions: { exposureLevel, beaufort: 5, windDir, date: day } });
  feedback = [
    mk('had_waves', 'partial', 'N'), mk('too_windy', 'partial', 'N'), mk('had_waves', 'partial', 'N'),
    mk('had_waves', 'partial', 'N'), mk('accurate', 'partial', 'N'),
    mk('accurate', 'exposed', 'S'), mk('calmer', 'exposed', 'S'),
  ];
} else {
  try { feedback = JSON.parse(readFileSync(inputPath, 'utf8')); } catch { feedback = []; }
  if (!Array.isArray(feedback)) feedback = [];
}

// aggregate per (beachId, wind sector)
const agg = new Map();
const excluded = [];
for (const fb of feedback) {
  if (typeof fb?.beachId !== 'number') continue;
  // Πριν από κάθε μέτρημα: μιλάει η αναφορά για την ώρα των αριθμών που κουβαλάει;
  const mismatch = KEEP_MISMATCHED ? null : timingMismatch(fb);
  if (mismatch) {
    excluded.push({ beachId: fb.beachId, feedback: fb.feedback, timestamp: fb.timestamp, reason: mismatch });
    continue;
  }
  const sector = fb.conditions?.windDir || '?';
  const key = `${fb.beachId}|${sector}`;
  if (!agg.has(key)) agg.set(key, { beachId: fb.beachId, sector, verdicts: {}, modeled: {}, n: 0 });
  const a = agg.get(key);
  a.verdicts[fb.feedback] = (a.verdicts[fb.feedback] || 0) + 1;
  if (fb.conditions?.exposureLevel) a.modeled[fb.conditions.exposureLevel] = (a.modeled[fb.conditions.exposureLevel] || 0) + 1;
  a.n++;
}

const proposals = [];
for (const a of agg.values()) {
  const neg = Object.entries(a.verdicts).filter(([k]) => NEGATIVE.has(k)).reduce((s, [, v]) => s + v, 0);
  const calmer = a.verdicts['calmer'] || 0;
  const modeledCalm = (a.modeled['protected'] || 0) + (a.modeled['partial'] || 0);
  const info = beachInfo.get(a.beachId) || {};
  if (a.n >= MIN_SAMPLES && neg / a.n >= UNDER_WARN_FRACTION && modeledCalm > 0) {
    proposals.push({
      type: 'UNDER_WARN', beachId: a.beachId, name: info.name, region: info.region, sector: a.sector,
      samples: a.n, negative: neg, autoSafe: true,
      action: `Model showed calm/partial but ${neg}/${a.n} reported waves/wind from ${a.sector}. Add '${a.sector}' to exposedToWindDirections (or raise localWindAmplification) in utils/windProfileOverrides.ts, and lock a 'rough' anchor in scripts/validateWindExposureGroundTruth.mjs.`,
    });
  } else if (a.n >= SOFTEN_MIN_SAMPLES && calmer / a.n >= SOFTEN_FRACTION) {
    proposals.push({
      type: 'OVER_WARN', beachId: a.beachId, name: info.name, region: info.region, sector: a.sector,
      samples: a.n, calmer, autoSafe: false,
      action: `Model showed exposed but ${calmer}/${a.n} reported calmer from ${a.sector}. SOFTEN ONLY with a 2nd independent source (manual review per the evidence rule) — never auto-applied.`,
    });
  }
}
proposals.sort((x, y) => y.samples - x.samples);

console.log(`=== FEEDBACK CALIBRATION ${DEMO ? '(demo)' : ''} ===`);
console.log(`records: ${feedback.length} | usable: ${feedback.length - excluded.length} | (beach,sector) cells: ${agg.size} | proposals: ${proposals.length}`);
if (excluded.length > 0) {
  // Ρητά, όχι σιωπηλά: ένα φίλτρο που τρώει τα μισά δεδομένα χωρίς να το πει είναι
  // χειρότερο από το να μην υπάρχει.
  console.log(`  EXCLUDED (screen hour/day did not match the visit): ${excluded.length}`);
  for (const e of excluded.slice(0, 10)) {
    const info = beachInfo.get(e.beachId) || {};
    console.log(`    #${e.beachId} ${info.name || ''} [${e.feedback}] — ${e.reason}`);
  }
  if (excluded.length > 10) console.log(`    …and ${excluded.length - 10} more (full list in the report)`);
}
console.log(`  UNDER-WARN (safe, conservative): ${proposals.filter(p => p.type === 'UNDER_WARN').length}`);
console.log(`  OVER-WARN  (soften, needs 2nd source): ${proposals.filter(p => p.type === 'OVER_WARN').length}`);
for (const p of proposals.slice(0, 40)) {
  console.log(`  [${p.type}] #${p.beachId} ${p.name} (${p.region}) ${p.sector}: ${p.negative ?? p.calmer}/${p.samples}\n     -> ${p.action}`);
}
// Ο προεπιλεγμένος φάκελος (`.tmp/`) είναι gitignored, άρα λείπει σε κάθε καθαρό checkout
// και το script πέθαινε με ENOENT ΑΦΟΥ είχε ήδη τυπώσει τις προτάσεις.
mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
writeFileSync(outPath, JSON.stringify({
  generatedFrom: DEMO ? 'demo' : inputPath,
  recordCount: feedback.length,
  usableCount: feedback.length - excluded.length,
  excluded,
  proposals,
}, null, 2), 'utf8');
console.log(`\nReport: ${outPath}`);
if (feedback.length === 0 && !DEMO) {
  console.log('No feedback records yet — the pipeline is READY. Once GA `condition_feedback` data exists,');
  console.log('export it to a JSON array and run with --input <export.json>. Try --demo to see example output.');
}
