// Offline calibration pass for roadmap #7 — the model-level half of the feedback loop.
//
// Turns captured `condition_feedback` into CONSERVATIVE, human-reviewable proposals. There
// is no app backend, so this runs by hand over an export of the feedback (the GA4
// `condition_feedback` events, or the app's local FEEDBACK_KEY records) — a JSON array of
// FeedbackData { beachId, feedback, timestamp, conditions:{ exposureLevel, beaufort, windDir, date, live } }.
//
// Οι εγγραφές με `conditions.live === false` ΔΕΝ μπαίνουν στο άθροισμα: εκεί η οθόνη ήταν
// γυρισμένη σε άλλη μέρα ή ώρα, οπότε αυτό που είδε ο επισκέπτης και αυτό που δείξαμε δεν
// αφορούν την ίδια στιγμή (αναλυτικά στο σχόλιο του `isComparable` πιο κάτω).
//
//   node scripts/calibrateFromFeedback.mjs --input .tmp/feedback-export.json
//   node scripts/calibrateFromFeedback.mjs --demo        # synthetic example, proves the pipeline
//
// Policy (matches the project's evidence rule): wrong-"calm" is the dangerous error, so an
// UNDER-warn signal (visitors report waves/wind where the model showed calm/partial) is the
// safe direction and is proposed readily; an OVER-warn signal (visitors report calmer than
// shown) only proposes a SOFTENING for manual review and only with extra evidence.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const argVal = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1]; };
const DEMO = process.argv.includes('--demo');
const inputPath = argVal('--input') || '.tmp/feedback-export.json';
const outPath = argVal('--out') || '.tmp/feedback-calibration-report.json';

const MIN_SAMPLES = 3;            // a (beach,sector) needs this many reports before we propose anything
const UNDER_WARN_FRACTION = 0.5; // >= half "worse than shown" -> propose raising exposure (safe)
const SOFTEN_MIN_SAMPLES = 6;    // softening is the less-conservative direction -> demand more
const SOFTEN_FRACTION = 0.66;
const NEGATIVE = new Set(['had_waves', 'too_windy', 'not_accurate']);

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

// ΜΙΑ ΑΝΑΦΟΡΑ ΠΟΥ ΔΕΝ ΑΝΤΙΠΑΡΑΤΙΘΕΤΑΙ ΔΕΝ ΒΑΘΜΟΝΟΜΕΙ ΤΙΠΟΤΑ (29/08/2026).
//
// Κάθε εγγραφή κουβαλάει ΔΥΟ μισά: τι είδε ο άνθρωπος, και τι έλεγε η οθόνη. Το δεύτερο μισό
// (`exposureLevel`, `beaufort`, `windDir`, το κύμα) ανήκει στην ώρα ΤΟΥ ΔΙΑΚΟΠΤΗ, όχι στην ώρα
// της παρατήρησης. Όταν ο διακόπτης ήταν αλλού, τα δύο μισά μιλάνε για διαφορετικές στιγμές
// και η διαφορά τους δεν είναι σφάλμα του μοντέλου — είναι απλώς άλλη ώρα.
//
// Κολοκύθα 747, 29/08/2026: «είχε πιο πολύ κύμα» από επισκέπτη που ήταν εκεί το απόγευμα, με
// τη σελίδα γυρισμένη στις 10:00 της ΕΠΟΜΕΝΗΣ μέρας. Μετρημένο αθροιστικά αυτό θα μετρούσε
// σαν κανονικό αρνητικό δείγμα και θα έσπρωχνε πρόταση «βάλε NW στο exposedToWindDirections»
// για μια παραλία που εκείνη τη στιγμή είχε ήδη κόψει το κύμα στο μισό (K_d = 0,5). Δηλαδή θα
// σκλήραινε το μοντέλο με βάση σύγκριση που δεν έγινε ποτέ.
//
// ΓΙΑΤΙ ΑΠΟΚΛΕΙΣΜΟΣ ΚΑΙ ΟΧΙ ΜΙΚΡΟΤΕΡΟ ΒΑΡΟΣ: με τα σημερινά κατώφλια (3 δείγματα) ένα βάρος
// 0,3 απλώς καθυστερεί την ίδια λάθος πρόταση. Και ΓΙΑΤΙ ΜΟΝΟ `live === false`: το `undefined`
// είναι εγγραφή από έκδοση της σελίδας πριν υπάρξει το πεδίο — άγνωστο, όχι μη-συγκρίσιμο, και
// πετώντας το θα σβήναμε όλο το ιστορικό. Οι αποκλεισμένες μετριούνται και τυπώνονται, ώστε να
// φαίνεται πόσα δεδομένα κοστίζει ο κανόνας αντί να εξαφανίζονται σιωπηλά.
const isComparable = (fb) => fb?.conditions?.live !== false;
const skippedNotComparable = feedback.filter(fb => typeof fb?.beachId === 'number' && !isComparable(fb)).length;

// aggregate per (beachId, wind sector)
const agg = new Map();
for (const fb of feedback) {
  if (typeof fb?.beachId !== 'number') continue;
  if (!isComparable(fb)) continue;
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
console.log(`records: ${feedback.length} | (beach,sector) cells: ${agg.size} | proposals: ${proposals.length}`);
if (skippedNotComparable > 0) {
  console.log(`  skipped (η οθόνη ήταν σε άλλη μέρα/ώρα — δεν αντιπαρατίθεται): ${skippedNotComparable}`);
}
console.log(`  UNDER-WARN (safe, conservative): ${proposals.filter(p => p.type === 'UNDER_WARN').length}`);
console.log(`  OVER-WARN  (soften, needs 2nd source): ${proposals.filter(p => p.type === 'OVER_WARN').length}`);
for (const p of proposals.slice(0, 40)) {
  console.log(`  [${p.type}] #${p.beachId} ${p.name} (${p.region}) ${p.sector}: ${p.negative ?? p.calmer}/${p.samples}\n     -> ${p.action}`);
}
writeFileSync(outPath, JSON.stringify({ generatedFrom: DEMO ? 'demo' : inputPath, recordCount: feedback.length, skippedNotComparable, proposals }, null, 2), 'utf8');
console.log(`\nReport: ${outPath}`);
if (feedback.length === 0 && !DEMO) {
  console.log('No feedback records yet — the pipeline is READY. Once GA `condition_feedback` data exists,');
  console.log('export it to a JSON array and run with --input <export.json>. Try --demo to see example output.');
}
