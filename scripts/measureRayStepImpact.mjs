#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΟΘΟΝΗ αν οι ακτίνες γεωμετρίας ριχτούν κάθε 50 μ. αντί για κάθε 200 μ.
 *
 * ΓΙΑΤΙ ΤΡΕΧΕΙ. Το `scripts/auditRayStepAliasing.mjs` έδειξε ότι το βήμα των 200 μ. κρύβει στεριά
 * σε **4.861 τομείς** και ότι η διόρθωση κάνει **650 τομείς πιο προστατευμένους** έναντι **11** πιο
 * εκτεθειμένων — μονόδρομα προς την ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση (σκανδάλη #1 της §9). Η αλλαγή είναι
 * διόρθωση ΔΕΔΟΜΕΝΩΝ, όχι κανόνα, αλλά η §7δ δεν κάνει αυτή τη διάκριση: ό,τι κάνει παραλίες να
 * φαίνονται πιο ήρεμες μετριέται εθνικά ΠΡΙΝ, και αποφασίζει ο Μίλτος.
 *
 * ΠΩΣ ΜΕΤΡΑΕΙ. Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ calculateBeachScore δύο φορές στα ΙΔΙΑ ζωντανά δεδομένα:
 * μία με το προφίλ που στέλνεται σήμερα και μία με το προφίλ των 50 μ. Καμία λογική δεν αντιγράφεται
 * — αλλάζει μόνο η γεωμετρία που δίνεται στη συνάρτηση.
 *
 * ΠΡΟΫΠΟΘΕΣΗ (αλλιώς μετράς δύο αλλαγές αντί για μία): το `.tmp/exposure-fine` πρέπει να έχει τα
 * ΙΔΙΑ `marineSamplePoint` με τα αποστελλόμενα, γιατί ο builder δεν τα παράγει.
 *
 *   node scripts/buildGeospatialExposureProfiles.mjs --land-geojson <mask> --no-download \
 *     --ray-step-km 0.05 --land-grace-km 0 --output-dir .tmp/exposure-fine
 *   node scripts/measureRayStepImpact.mjs
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

const WITNESS_ID = 636; // Λυγαριά Ηρακλείου — ΒΔ τομέας 5,00 → 0,14 χλμ.
const MIN_SCORED = 20000;
const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const shippedDir = path.join(root, 'public/data/geospatial/exposure');
const fineDir = path.join(root, '.tmp/exposure-fine');

if (!existsSync(fineDir)) {
  console.error('ΑΚΥΡΟ: λείπει το .tmp/exposure-fine — δες την επικεφαλίδα του αρχείου.');
  process.exit(1);
}

const regions = [];
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  if (!island?.beaches?.length) continue;
  let shipped = {};
  let fine = {};
  try { shipped = JSON.parse(readFileSync(path.join(shippedDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  try { fine = JSON.parse(readFileSync(path.join(fineDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  regions.push({ id: file.replace('.json', ''), beaches: island.beaches, shipped, fine });
}

// Ο ΜΑΡΤΥΡΑΣ ΤΗΣ ΚΑΛΩΔΙΩΣΗΣ, ΠΡΙΝ ΚΑΕΙ ΕΝΑ ΑΙΤΗΜΑ. Αν τα δύο σύνολα προφίλ είναι ταυτόσημα, η
// μέτρηση θα έβγαζε «καμία αλλαγή» και θα ήταν ψέμα (§Μ4: δύο άκυρες μετρήσεις με ακριβώς αυτό).
let differing = 0;
for (const region of regions) {
  for (const id of Object.keys(region.shipped)) {
    if (!region.fine[id]) continue;
    if (JSON.stringify(region.shipped[id].sectors) !== JSON.stringify(region.fine[id].sectors)) differing += 1;
  }
}
console.log(`περιοχές ${regions.length} · παραλίες με διαφορετική γεωμετρία ${differing}`);
if (differing < 100) {
  console.error('ΑΚΥΡΟ: τα δύο σύνολα προφίλ είναι σχεδόν ίδια — λάθος φάκελος ή λάθος build.');
  process.exit(1);
}

const rows = [];
let scored = 0;
let comfortChanged = 0;
let avoidCrossed = 0;
let calmer = 0;
let rougher = 0;

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
    const after = region.fine[String(beach.id)];
    if (!before || !after) continue;
    const windData = byBeach.get(beach.id);
    if (!windData) continue;
    const mp = before.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));

    for (const hour of HOURS) {
      const day = days?.[0];
      if (!day?.hourly?.[hour]) continue;
      const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
      const base = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly };

      const scoreBefore = calculateBeachScore(beach, slice, undefined, undefined, { ...base, geospatialProfile: before });
      const scoreAfter = calculateBeachScore(beach, slice, undefined, undefined, { ...base, geospatialProfile: after });
      scored += 1;

      const sameWave = scoreBefore.shoreDisplayWaveM === scoreAfter.shoreDisplayWaveM;
      const sameComfort = scoreBefore.swimmingComfort === scoreAfter.swimmingComfort;
      const sameExposure = scoreBefore.exposureLevel === scoreAfter.exposureLevel;
      if (sameWave && sameComfort && sameExposure) continue;

      if (!sameComfort) comfortChanged += 1;
      if ((scoreBefore.swimmingComfort === 'avoid_swimming') !== (scoreAfter.swimmingComfort === 'avoid_swimming')) {
        avoidCrossed += 1;
      }
      if (typeof scoreBefore.shoreDisplayWaveM === 'number' && typeof scoreAfter.shoreDisplayWaveM === 'number') {
        if (scoreAfter.shoreDisplayWaveM < scoreBefore.shoreDisplayWaveM - 0.005) calmer += 1;
        if (scoreAfter.shoreDisplayWaveM > scoreBefore.shoreDisplayWaveM + 0.005) rougher += 1;
      }

      rows.push({
        id: beach.id, region: region.id, hour,
        name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
        waveBefore: scoreBefore.shoreDisplayWaveM, waveAfter: scoreAfter.shoreDisplayWaveM,
        comfortBefore: scoreBefore.swimmingComfort, comfortAfter: scoreAfter.swimmingComfort,
        exposureBefore: scoreBefore.exposureLevel, exposureAfter: scoreAfter.exposureLevel,
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
  console.error(`\nΠΡΟΣΟΧΗ: ο μάρτυρας #${WITNESS_ID} (Λυγαριά) ΔΕΝ άλλαξε σε καμία ώρα.`);
  console.error('Δεν ακυρώνει τη μέτρηση — αλλά σημαίνει ότι η διόρθωση γεωμετρίας ΔΕΝ λύνει το πρόβλημα που τη γέννησε.');
} else {
  console.log(`μάρτυρας #${WITNESS_ID}: ${witness.length} ώρες αλλάζουν`);
  witness.slice(0, 3).forEach(r => console.log(
    `    ${r.hour}:00  ${r.waveBefore} → ${r.waveAfter} μ.  ·  ${r.exposureBefore} → ${r.exposureAfter}  ·  ${r.comfortBefore} → ${r.comfortAfter}`
  ));
}

const distinct = new Set(rows.map(r => `${r.region}#${r.id}`));
console.log('\n============ ΑΚΤΙΝΕΣ ΚΑΘΕ 50 μ. ΑΝΤΙ ΓΙΑ 200 μ. — ΤΙ ΒΛΕΠΕΙ Ο ΚΟΣΜΟΣ ============');
console.log(`βαθμολογήσεις (παραλία × ώρα, δύο φορές)              ${scored}`);
console.log(`αλλάζει κάτι                                          ${rows.length}  (${distinct.size} παραλίες)`);
console.log(`  — ο αριθμός πέφτει (πιο ήρεμο)                      ${calmer}`);
console.log(`  — ο αριθμός ανεβαίνει (πιο άγριο)                   ${rougher}`);
console.log(`αλλάζει η ΑΝΕΣΗ ΚΟΛΥΜΒΗΣΗΣ                            ${comfortChanged}`);
console.log(`ΠΕΡΝΑΕΙ ΤΟ ΟΡΙΟ «μην κολυμπήσεις» (ΣΙΓΟΥΡΑ χρώμα)     ${avoidCrossed}`);

mkdirSync(path.join(root, 'reports/geometry'), { recursive: true });
writeFileSync(path.join(root, 'reports/geometry/ray-step-impact.json'), `${JSON.stringify({
  measuredAt: new Date().toISOString(), scored,
  changed: rows.length, distinct: distinct.size,
  calmer, rougher, comfortChanged, avoidCrossed, rows,
}, null, 2)}\n`, 'utf8');
console.log('\nγράφτηκε reports/geometry/ray-step-impact.json');
