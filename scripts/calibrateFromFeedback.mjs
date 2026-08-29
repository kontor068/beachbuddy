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
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
// Η αριθμητική ζει σε ΕΝΑ μέρος: την ίδια τη μοιράζεται ο αυτόματος έλεγχος
// (netlify/functions/feedback-watch.mjs), ώστε το μήνυμα στο Telegram και αυτή η
// αναφορά να μη λένε ποτέ διαφορετικά πράγματα για τα ίδια δεδομένα.
import { aggregateFeedback, buildProposals } from '../netlify/functions/lib/feedbackSignals.mjs';

const argVal = (name) => { const i = process.argv.indexOf(name); return i === -1 ? undefined : process.argv[i + 1]; };
const DEMO = process.argv.includes('--demo');
const inputPath = argVal('--input') || '.tmp/feedback-export.json';
const outPath = argVal('--out') || '.tmp/feedback-calibration-report.json';

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

// Το άθροισμα και τα κατώφλια ζουν στο lib/feedbackSignals.mjs (βλ. πιο πάνω).
const agg = aggregateFeedback(feedback);
const proposals = buildProposals(agg, (id) => beachInfo.get(id));

console.log(`=== FEEDBACK CALIBRATION ${DEMO ? '(demo)' : ''} ===`);
console.log(`records: ${feedback.length} | (beach,sector) cells: ${agg.size} | proposals: ${proposals.length}`);
console.log(`  UNDER-WARN (safe, conservative): ${proposals.filter(p => p.type === 'UNDER_WARN').length}`);
console.log(`  OVER-WARN  (soften, needs 2nd source): ${proposals.filter(p => p.type === 'OVER_WARN').length}`);
for (const p of proposals.slice(0, 40)) {
  console.log(`  [${p.type}] #${p.beachId} ${p.name} (${p.region}) ${p.sector}: ${p.negative ?? p.calmer}/${p.samples}\n     -> ${p.action}`);
}
writeFileSync(outPath, JSON.stringify({ generatedFrom: DEMO ? 'demo' : inputPath, recordCount: feedback.length, proposals }, null, 2), 'utf8');
console.log(`\nReport: ${outPath}`);
if (feedback.length === 0 && !DEMO) {
  console.log('No feedback records yet — the pipeline is READY. Once GA `condition_feedback` data exists,');
  console.log('export it to a JSON array and run with --input <export.json>. Try --demo to see example output.');
}
