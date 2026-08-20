#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΟΘΟΝΗ αν οι ακτίνες ξεκινήσουν από το νερό που ΑΚΟΥΜΠΑΕΙ η παραλία,
 * αντί για ~100 μ. έξω από την ακτή.
 *
 * ΓΙΑΤΙ ΤΡΕΧΕΙ. Η γεωμετρική μέτρηση έγινε (`scripts/measureRayOriginImpact.mjs`, βίβλος §Μ9) και
 * ΠΕΡΑΣΕ τον δεύτερο μάρτυρα: 422 από 467 νέους τομείς (90,4%) φράζονται από στεριά ≥150 μ. —
 * πραγματικοί βραχίονες, διάμεσο πάχος 450 μ. — έναντι 99,1% θορύβου που είχε το ΒΗΜΑ (§Μ7).
 * Η γεωμετρία όμως δεν είναι η οθόνη. Η §7δ απαιτεί εθνική μέτρηση οθόνης ΠΡΙΝ, γιατί η φορά
 * είναι προς το ηρεμότερο — **σκανδάλη #1 της §9**.
 *
 * ΠΩΣ ΜΕΤΡΑΕΙ. Ίδια μέθοδος με `scripts/measureRayStepImpact.mjs`, ώστε τα δύο νούμερα να είναι
 * συγκρίσιμα: τρέχει τον ΠΡΑΓΜΑΤΙΚΟ `calculateBeachScore` δύο φορές στα ΙΔΙΑ ζωντανά δεδομένα,
 * αλλάζοντας ΜΟΝΟ το προφίλ γεωμετρίας. Καμία λογική δεν αντιγράφεται.
 *
 * ⚠️ ΚΑΙ ΜΕΤΡΑΕΙ ΚΑΙ ΤΟ ΧΡΩΜΑ. Το `measureRayStepImpact` σταματούσε στο `exposureLevel`. Εδώ
 * υπολογίζεται η ΠΡΑΓΜΑΤΙΚΗ απόχρωση πινέζας με `utils/suitabilityTone.resolveConditionTone`,
 * τροφοδοτημένη και με το `seaStateM` — γιατί η αλλαγή αφετηρίας κουνάει ΚΑΙ το κύμα ΚΑΙ την
 * έκθεση, και μια μέτρηση που κοιτάει μόνο το ένα υποτιμά το αποτέλεσμα.
 *
 * ΠΡΟΫΠΟΘΕΣΗ (αλλιώς μετράς δύο αλλαγές αντί για μία): το `.tmp/exposure-own-origin` πρέπει να έχει
 * τα ΙΔΙΑ `marineSamplePoint` με τα αποστελλόμενα. Ο builder τα μεταφέρει αυτούσια από το ίδιο του
 * το output dir, οπότε αντίγραψε ΠΡΩΤΑ τα shipped εκεί μέσα:
 *
 *   mkdir -p .tmp/exposure-own-origin && cp public/data/geospatial/exposure/*.json .tmp/exposure-own-origin/
 *   node scripts/buildGeospatialExposureProfiles.mjs --land-geojson .tmp/geospatial/greece-land-osm-split.geojson \
 *     --no-download --water-search-step-km 0.01 --min-open-water-km 0 --output-dir .tmp/exposure-own-origin
 *   node scripts/measureRayOriginScreenImpact.mjs
 */
import './lib/paidOpenMeteo.mjs';
import './lib/proxiedOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
// ΤΟ ΜΠΟΦΟΡ ΒΓΑΙΝΕΙ ΟΠΩΣ ΤΟ ΒΓΑΖΕΙ Ο ΒΑΘΜΟΛΟΓΗΤΗΣ (recommendationService:2690-2698): m/s × 3,6 →
// getBeaufortLevel. Το πρώτο τρέξιμο διάβαζε `score.beaufort`, που ΔΕΝ επιστρέφεται — έβγαζε 0
// παντού και το χρώμα υπολογιζόταν με beaufort undefined, δηλαδή ΑΚΥΡΟ.
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

/** Καραβοστάσι Μπαλίου — η παραλία που γέννησε το §Μ5 και ξανά το §Μ9. */
const WITNESS_ID = 680;
/**
 * ΠΟΙΑ ΜΕΡΑ ΤΗΣ ΠΡΟΓΝΩΣΗΣ ΜΕΤΡΑΜΕ. `--day 0` = σήμερα (προεπιλογή).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το πρώτο τρέξιμο (18/08) έπεσε σε άπνοια: σε 3.352 ώρες που άλλαξαν εμφανίστηκαν
 * ΜΟΝΟ blue και yellow, καμία orange/red — δηλαδή η ζώνη όπου το χρώμα γυρίζει ευκολότερα δεν
 * δοκιμάστηκε ΚΑΘΟΛΟΥ, και το «0 αλλαγές χρώματος» δεν αποδείκνυε τίποτα για μέρα μελτεμιού.
 * Το ίδιο έπαθε και η βεντάλια του §Γ22.
 *
 * ⚠️ ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ ΘΕΜΙΤΟ, ΠΑΡΟΛΟ ΠΟΥ Η ΠΡΟΓΝΩΣΗ +6 ΗΜΕΡΩΝ ΕΙΝΑΙ ΑΝΑΚΡΙΒΗΣ. Δεν μας
 * ενδιαφέρει αν ο καιρός της 24/08 θα επαληθευτεί. Η μέτρηση συγκρίνει ΔΥΟ ΓΕΩΜΕΤΡΙΕΣ πάνω στον
 * ΙΔΙΟ καιρό· το μόνο που χρειάζεται ο καιρός είναι να είναι **δυνατός και φυσικά εύλογος**, ώστε
 * να δοκιμαστεί η πορτοκαλί/κόκκινη ζώνη. Λάθος πρόγνωση δεν αλλοιώνει τη σύγκριση.
 */
const DAY_INDEX = (() => {
  const i = process.argv.indexOf('--day');
  const n = i > -1 ? Number(process.argv[i + 1]) : 0;
  return Number.isFinite(n) && n >= 0 ? n : 0;
})();
const MIN_SCORED = 20000;
const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);
/**
 * Η ΣΕΙΡΑ ΤΩΝ ΑΠΟΧΡΩΣΕΩΝ, από την ηρεμότερη προς την αυστηρότερη.
 * ⚠️ Η πρώτη γραφή χρησιμοποιούσε ένα σύνολο {ideal, good} — λέξεις που ΔΕΝ ανήκουν σε αυτό το
 * λεξιλόγιο (`resolveConditionTone` γυρίζει blue/yellow/orange/red), οπότε και τα δύο μετρητές
 * έβγαζαν πάντα 0. Η φορά μετριέται πλέον με κατάταξη, όχι με ανήκειν.
 */
const TONE_RANK = { blue: 0, yellow: 1, orange: 2, red: 3 };

const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const shippedDir = path.join(root, 'public/data/geospatial/exposure');
const ownDir = path.join(root, '.tmp/exposure-own-origin');

if (!existsSync(ownDir)) {
  console.error('ΑΚΥΡΟ: λείπει το .tmp/exposure-own-origin — δες την επικεφαλίδα του αρχείου.');
  process.exit(1);
}

const regions = [];
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  if (!island?.beaches?.length) continue;
  let shipped = {};
  let own = {};
  try { shipped = JSON.parse(readFileSync(path.join(shippedDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  try { own = JSON.parse(readFileSync(path.join(ownDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  regions.push({ id: file.replace('.json', ''), beaches: island.beaches, shipped, own });
}

// Ο ΜΑΡΤΥΡΑΣ ΤΗΣ ΚΑΛΩΔΙΩΣΗΣ, ΠΡΙΝ ΚΑΕΙ ΕΝΑ ΑΙΤΗΜΑ (§Μ4: δύο άκυρες μετρήσεις με ακριβώς αυτό).
let differing = 0;
let samePoint = 0;
let movedPoint = 0;
for (const region of regions) {
  for (const id of Object.keys(region.shipped)) {
    if (!region.own[id]) continue;
    if (JSON.stringify(region.shipped[id].sectors) !== JSON.stringify(region.own[id].sectors)) differing += 1;
    const a = JSON.stringify(region.shipped[id].marineSamplePoint ?? null);
    const b = JSON.stringify(region.own[id].marineSamplePoint ?? null);
    if (a === b) samePoint += 1; else movedPoint += 1;
  }
}
console.log(`περιοχές ${regions.length} · παραλίες με διαφορετική γεωμετρία ${differing}`);
console.log(`σημεία θάλασσας: ίδια ${samePoint} · ΜΕΤΑΚΙΝΗΘΗΚΑΝ ${movedPoint}`);
if (differing < 100) {
  console.error('ΑΚΥΡΟ: τα δύο σύνολα προφίλ είναι σχεδόν ίδια — λάθος φάκελος ή λάθος build.');
  process.exit(1);
}
if (movedPoint > 0) {
  console.error(`ΑΚΥΡΟ: ${movedPoint} σημεία θάλασσας μετακινήθηκαν — θα μετρούσαμε ΔΥΟ αλλαγές.`);
  process.exit(1);
}

const rows = [];
let scored = 0;
let comfortChanged = 0;
let avoidCrossed = 0;
let calmer = 0;
let rougher = 0;
let coveGained = 0;
let coveLost = 0;
const coveGainedBeaches = new Set();
let toneChanged = 0;
let calmGained = 0;
let calmLost = 0;
const toneMoves = new Map();
/** Κατανομή Μποφόρ σε ΟΛΕΣ τις βαθμολογήσεις — η απόδειξη ότι δοκιμάστηκε δυνατός άνεμος. */
const bftSeen = new Map();

for (const region of regions) {
  const clusters = buildBeachForecastClusters(region.beaches);
  const byBeach = new Map();
  let windByPoint;
  try {
    windByPoint = await fetchForecastDataBatch(clusters.map(c => ({ lat: c.lat, lon: c.lon })));
  } catch (error) { console.log(`  ${region.id}: άνεμος απέτυχε (${error.message})`); continue; }

  const marinePoints = [];
  for (const beach of region.beaches) {
    const mp = region.shipped[String(beach.id)]?.marineSamplePoint;
    if (mp) marinePoints.push({ lat: mp.lat, lon: mp.lon });
  }
  let marineByPoint = new Map();
  try { marineByPoint = await fetchMarineForecastDataBatch(marinePoints); } catch { /* κενό */ }

  for (const cluster of clusters) {
    const wind = windByPoint.get(forecastPointKey(cluster.lat, cluster.lon));
    if (!wind?.data) continue;
    for (const id of cluster.beachIds) byBeach.set(id, wind.data);
  }

  for (const beach of region.beaches) {
    const before = region.shipped[String(beach.id)];
    const after = region.own[String(beach.id)];
    if (!before || !after) continue;
    const windData = byBeach.get(beach.id);
    if (!windData) continue;
    const mp = before.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));

    for (const hour of HOURS) {
      const day = days?.[DAY_INDEX];
      if (!day?.hourly?.[hour]) continue;
      const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
      const base = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly };

      const a = calculateBeachScore(beach, slice, undefined, undefined, { ...base, geospatialProfile: before });
      const b = calculateBeachScore(beach, slice, undefined, undefined, { ...base, geospatialProfile: after });
      scored += 1;

      // Η ΠΙΝΕΖΑ. Το Μποφόρ δεν αλλάζει (ίδιος άνεμος), αλλάζουν η έκθεση και το κύμα.
      const bft = getBeaufortLevel((slice.wind?.speed ?? 0) * 3.6);
      bftSeen.set(bft, (bftSeen.get(bft) ?? 0) + 1);
      const toneA = resolveConditionTone({
        exposureLevel: a.exposureLevel, beaufort: bft,
        isEnclosedCove: Boolean(a.enclosedCove), seaStateM: a.shoreDisplayWaveM,
      });
      const toneB = resolveConditionTone({
        exposureLevel: b.exposureLevel, beaufort: bft,
        isEnclosedCove: Boolean(b.enclosedCove), seaStateM: b.shoreDisplayWaveM,
      });

      // Ο όρμος εξαιρείται ΟΛΟΚΛΗΡΩΤΙΚΑ από το ταβάνι θάλασσας (suitabilityTone.ts:312),
      // άρα ένας νέος όρμος από την αφετηρία είναι σκανδάλη #1 — μετριέται χωριστά.
      if (!a.enclosedCove && b.enclosedCove) { coveGained += 1; coveGainedBeaches.add(beach.id); }
      if (a.enclosedCove && !b.enclosedCove) coveLost += 1;

      const sameWave = a.shoreDisplayWaveM === b.shoreDisplayWaveM;
      const sameComfort = a.swimmingComfort === b.swimmingComfort;
      const sameExposure = a.exposureLevel === b.exposureLevel;
      const sameTone = toneA === toneB;
      if (sameWave && sameComfort && sameExposure && sameTone) continue;

      if (!sameComfort) comfortChanged += 1;
      if ((a.swimmingComfort === 'avoid_swimming') !== (b.swimmingComfort === 'avoid_swimming')) avoidCrossed += 1;
      if (typeof a.shoreDisplayWaveM === 'number' && typeof b.shoreDisplayWaveM === 'number') {
        if (b.shoreDisplayWaveM < a.shoreDisplayWaveM - 0.005) calmer += 1;
        if (b.shoreDisplayWaveM > a.shoreDisplayWaveM + 0.005) rougher += 1;
      }
      if (!sameTone) {
        toneChanged += 1;
        toneMoves.set(`${toneA}→${toneB}`, (toneMoves.get(`${toneA}→${toneB}`) ?? 0) + 1);
        const rankA = TONE_RANK[toneA] ?? -1;
        const rankB = TONE_RANK[toneB] ?? -1;
        if (rankB > rankA) calmLost += 1;
        if (rankB < rankA) calmGained += 1;
      }

      rows.push({
        id: beach.id, region: region.id, hour,
        name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
        waveBefore: a.shoreDisplayWaveM, waveAfter: b.shoreDisplayWaveM,
        comfortBefore: a.swimmingComfort, comfortAfter: b.swimmingComfort,
        exposureBefore: a.exposureLevel, exposureAfter: b.exposureLevel,
        toneBefore: toneA, toneAfter: toneB,
      });
    }
  }
  process.stdout.write(`\r  ${region.id.padEnd(42)} βαθμολογήθηκαν ${scored}`);
}
console.log('');

if (scored < MIN_SCORED) {
  console.error(`\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: μόνο ${scored} βαθμολογήσεις (ελάχιστο ${MIN_SCORED}).`);
  process.exit(1);
}

const witness = rows.filter(r => r.id === WITNESS_ID);
if (witness.length === 0) {
  console.error(`\nΠΡΟΣΟΧΗ: ο μάρτυρας #${WITNESS_ID} (Καραβοστάσι) ΔΕΝ άλλαξε σε καμία ώρα.`);
  console.error('Δεν ακυρώνει τη μέτρηση — σημαίνει ότι η διόρθωση ΔΕΝ λύνει το πρόβλημα που τη γέννησε.');
} else {
  console.log(`μάρτυρας #${WITNESS_ID} Καραβοστάσι: ${witness.length} ώρες αλλάζουν`);
  witness.slice(0, 4).forEach(r => console.log(
    `    ${r.hour}:00  ${r.waveBefore} → ${r.waveAfter} μ.  ·  ${r.exposureBefore} → ${r.exposureAfter}  ·  ${r.toneBefore} → ${r.toneAfter}`
  ));
}

const distinct = new Set(rows.map(r => `${r.region}#${r.id}`));
const toneBeaches = new Set(rows.filter(r => r.toneBefore !== r.toneAfter).map(r => `${r.region}#${r.id}`));
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : '—');

console.log('\n====== ΑΦΕΤΗΡΙΑ ΑΚΤΙΝΩΝ ΣΤΟ ΝΕΡΟ ΤΗΣ ΠΑΡΑΛΙΑΣ — ΤΙ ΒΛΕΠΕΙ Ο ΚΟΣΜΟΣ ======');
console.log(`ημέρα πρόγνωσης                                       ${DAY_INDEX === 0 ? 'σήμερα' : `+${DAY_INDEX}`}`);
const strong = [...bftSeen].filter(([b]) => b >= 5).reduce((s2, [, n]) => s2 + n, 0);
console.log(`κατανομή Μποφόρ  ${[...bftSeen].sort((x, y) => x[0] - y[0]).map(([b, n]) => `${b}Μπφ:${n}`).join('  ')}`);
console.log(`ώρες με >=5 Μποφόρ                                    ${strong}  ${strong === 0 ? '⛔ ΑΚΥΡΗ ΓΙΑ ΧΡΩΜΑ — δεν δοκιμάστηκε δυνατός άνεμος' : '✅'}`);
console.log(`βαθμολογήσεις (παραλία × ώρα, δύο φορές)              ${scored}`);
console.log(`αλλάζει κάτι                                          ${rows.length}  (${distinct.size} παραλίες)`);
console.log(`  — ο αριθμός πέφτει (πιο ήρεμο)                      ${calmer}`);
console.log(`  — ο αριθμός ανεβαίνει (πιο άγριο)                   ${rougher}`);
console.log(`αλλάζει η ΑΝΕΣΗ ΚΟΛΥΜΒΗΣΗΣ                            ${comfortChanged}`);
console.log(`ΠΕΡΝΑΕΙ ΤΟ ΟΡΙΟ «μην κολυμπήσεις»                     ${avoidCrossed}`);
console.log(`ΝΕΟΣ ΟΡΜΟΣ (εξαιρείται από το ταβάνι θάλασσας)        ${coveGained}  (${coveGainedBeaches.size} παραλίες) ${coveGained === 0 ? '✅' : '⚠️ σκανδάλη #1'}`);
console.log(`ΧΑΝΕΙ ΤΟΝ ΟΡΜΟ                                        ${coveLost}`);
console.log(`\nΧΡΩΜΑ ΠΙΝΕΖΑΣ`);
console.log(`  αλλάζει                                            ${toneChanged}  (${pct(toneChanged, scored)} των ωρών, ${toneBeaches.size} παραλίες)`);
console.log(`  προς ΗΡΕΜΟΤΕΡΟ χρώμα (η επικίνδυνη φορά)           ${calmGained}`);
console.log(`  προς ΑΥΣΤΗΡΟΤΕΡΟ χρώμα (η ασφαλής φορά)            ${calmLost}`);
for (const [move, n] of [...toneMoves].sort((x, y) => y[1] - x[1]).slice(0, 8)) {
  console.log(`    ${move.padEnd(24)} ${n}`);
}

mkdirSync(path.join(root, 'reports/geometry'), { recursive: true });
writeFileSync(path.join(root, 'reports/geometry/ray-origin-screen-impact.json'), `${JSON.stringify({
  measuredAt: new Date().toISOString(), scored,
  changed: rows.length, distinct: distinct.size,
  calmer, rougher, comfortChanged, avoidCrossed,
  toneChanged, toneBeaches: toneBeaches.size, calmGained, calmLost,
  toneMoves: Object.fromEntries(toneMoves),
  dayIndex: DAY_INDEX, beaufortHistogram: Object.fromEntries([...bftSeen].sort((x, y) => x[0] - y[0])),
  rows,
}, null, 2)}\n`, 'utf8');
console.log('\nγράφτηκε reports/geometry/ray-origin-screen-impact.json');
console.log('\nΣΥΓΚΡΙΣΗ: το ΒΗΜΑ (§Μ6/§Μ7, απορρίφθηκε) γύριζε 208 ώρες πάνω από το όριο κολύμβησης.');
console.log('Απόφαση Μίλτου κατά §9 — τίποτα δεν έχει αλλάξει στα αποστελλόμενα δεδομένα.');
