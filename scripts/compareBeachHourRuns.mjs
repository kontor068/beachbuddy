#!/usr/bin/env node
/**
 * ΣΥΓΚΡΙΣΗ ΔΥΟ ΕΘΝΙΚΩΝ ΤΡΕΞΙΜΑΤΩΝ ΠΑΡΑΛΙΑ × ΩΡΑ — τι άλλαξε για τον επισκέπτη (14/09/2026).
 *
 * Διαβάζει δύο αρχεία γραμμών του scripts/measureStraightInCaution.mjs (ίδια ηχογράφηση καιρού, δύο
 * εκδόσεις κώδικα) και λέει: πόσες ώρες άλλαξαν λέξη και προς ποια μεριά, πόσο κουνήθηκε ο αριθμός
 * κύματος που τυπώνεται (στην ακρίβεια της οθόνης), πού. Γενικό — δεν ξέρει ποια αλλαγή κρίνει.
 * Γεννήθηκε για τον κανόνα «το μεγαλύτερο από τα δύο μοντέλα κύματος» (βίβλος §Γ85).
 *
 *   node scripts/compareBeachHourRuns.mjs --before=.tmp/a.json --after=.tmp/b.json [--report=reports/…json]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const arg = (n) => process.argv.find(a => a.startsWith(`${n}=`))?.slice(n.length + 1);
const A = JSON.parse(readFileSync(arg('--before'), 'utf8'));
const B = JSON.parse(readFileSync(arg('--after'), 'utf8'));
const ORDER = ['avoid_swimming', 'caution', 'good', 'excellent'];
const printed = (m) => (typeof m === 'number' && Number.isFinite(m) ? Math.round(m / 0.1) / 10 : null);
const obj = (run, r) => Object.fromEntries(run.cols.map((c, i) => [c, r[i]]));
const bMap = new Map(B.rows.map(r => { const o = obj(B, r); return [`${o.id}|${o.hour}`, o]; }));

let n = 0, stricter = 0, milder = 0, mildBefore = 0, printedUp = 0, printedDown = 0, sumDelta = 0, nDelta = 0;
const moves = {}, regionStricter = {}, beachesStricter = new Set(), beachesMilder = new Set(), deltaHist = {};
for (const r of A.rows) {
  const a = obj(A, r); const b = bMap.get(`${a.id}|${a.hour}`);
  if (!b) continue;
  n += 1;
  if (a.verdict === 'good' || a.verdict === 'excellent') mildBefore += 1;
  const pa = printed(a.shore), pb = printed(b.shore);
  if (pa !== null && pb !== null) {
    const d = Math.round((pb - pa) * 10) / 10;
    nDelta += 1; sumDelta += d;
    if (d > 0) printedUp += 1; else if (d < 0) printedDown += 1;
    const k = d >= 0.5 ? '≥+0,5' : d <= -0.5 ? '≤−0,5' : (d > 0 ? '+' : '') + d.toFixed(1).replace('.', ',');
    deltaHist[k] = (deltaHist[k] || 0) + 1;
  }
  if (a.verdict === b.verdict) continue;
  const m = `${a.verdict}→${b.verdict}`; moves[m] = (moves[m] || 0) + 1;
  if (ORDER.indexOf(b.verdict) < ORDER.indexOf(a.verdict)) {
    stricter += 1; beachesStricter.add(a.id); regionStricter[a.region] = (regionStricter[a.region] || 0) + 1;
  } else { milder += 1; beachesMilder.add(a.id); }
}
const pct = (x, d) => Number((100 * x / Math.max(1, d)).toFixed(2));
const out = {
  before: arg('--before'), after: arg('--after'), weather: A.weather, comparedHours: n, mildHoursBefore: mildBefore,
  stricterHours: stricter, stricterPctOfAll: pct(stricter, n), milderHours: milder, milderPctOfAll: pct(milder, n),
  netStricterPctOfAll: pct(stricter - milder, n), stricterBeaches: beachesStricter.size, milderBeaches: beachesMilder.size,
  moves: Object.fromEntries(Object.entries(moves).sort((x, y) => y[1] - x[1])),
  printedShoreWave: { up: printedUp, down: printedDown, unchanged: nDelta - printedUp - printedDown, meanDeltaM: Number((sumDelta / Math.max(1, nDelta)).toFixed(3)), histogram: deltaHist },
  topRegionsStricter: Object.entries(regionStricter).sort((x, y) => y[1] - x[1]).slice(0, 12),
};
console.log(`\n=== ${A.weather}: ${n.toLocaleString('el')} παραλίες-ώρες ===`);
console.log(`  αυστηρότερα ${stricter} (${out.stricterPctOfAll}%) σε ${beachesStricter.size} παραλίες · ηπιότερα ${milder} (${out.milderPctOfAll}%) σε ${beachesMilder.size} · καθαρά ${out.netStricterPctOfAll}% προς το αυστηρότερο`);
console.log(`  κινήσεις: ${JSON.stringify(out.moves)}`);
console.log(`  τυπωμένο κύμα ακτής: πάνω ${printedUp} · κάτω ${printedDown} · ίδιο ${out.printedShoreWave.unchanged} · μέση μεταβολή ${out.printedShoreWave.meanDeltaM} μ. · ${JSON.stringify(deltaHist)}`);
console.log(`  περιοχές (αυστηρότερα): ${out.topRegionsStricter.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
const report = arg('--report');
if (report) { mkdirSync(path.dirname(report), { recursive: true }); writeFileSync(report, `${JSON.stringify(out, null, 2)}\n`); console.log(`→ ${report}`); }
