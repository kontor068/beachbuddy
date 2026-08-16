#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΣΤΟ ΧΡΩΜΑ ΚΑΙ ΣΤΗΝ ΕΤΥΜΗΓΟΡΙΑ ο κανόνας «όλο το νερό φεύγει» — η μέτρηση που ΕΛΕΙΠΕ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το commit 196af2bb μετρήθηκε εθνικά ως προς τον ΑΡΙΘΜΟ (8 παραλίες, 44
 * ώρες×παραλία, μέγιστη πτώση 0,96 μ.) και μπήκε. Ο έλεγχος συμφωνίας με τη βίβλο βρήκε ότι αυτό
 * ΔΕΝ αρκεί: από τις 10/08/2026 το `shoreWaveM` δεν είναι display-only. Το διαβάζει το
 * `swimmingComfortFromScore` (recommendationService:2425) και το `components/BeachMap.tsx:2245`
 * βάφει την πινέζα με `swimVerdictAvoid = swimmingComfort === 'avoid_swimming'`. Άρα:
 *
 *     αριθμός ακτής → άνεση κολύμβησης → «μην κολυμπήσεις» → ΧΡΩΜΑ ΠΙΝΕΖΑΣ
 *
 * ΤΟ ΚΛΕΙΔΙ ΤΗΣ ΜΕΤΡΗΣΗΣ: το μόνο που αλλάζει ο κανόνας είναι το `shoreWaveM`, και η μόνη έξοδος
 * που αυτό μετακινεί είναι το `swimmingComfort`. Κάθε άλλο όρισμα του `resolveConditionTone`
 * (exposureLevel, beaufort, seaStateM, cove, offshoreFlatWater, downwindSeaSample,
 * seaArrivalExposureLevel) υπολογίζεται πριν και ΔΕΝ το αγγίζει. Άρα: ίδιο swimmingComfort
 * σημαίνει ίδιο χρώμα, κατασκευαστικά — και αρκεί να μετρηθεί το swimmingComfort.
 *
 * ΠΩΣ ΜΕΤΡΑΕΙ. Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ calculateBeachScore δύο φορές πάνω στα ΙΔΙΑ ζωντανά δεδομένα:
 * μία με τον κανόνα ενεργό και μία με το isSeaDepartingShore σταθερά false (δηλαδή ακριβώς η
 * συμπεριφορά πριν το 196af2bb). Δεν αντιγράφεται καμία λογική.
 *
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" \
 *     node scripts/measureDepartingSeaVerdictImpact.mjs
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// services/weatherService.ts οπλίζει το timeout με window.setTimeout. Ο Node έχει τον χρονιστή
// αλλά όχι το αντικείμενο — ίδιο shim με scripts/auditPerBeachWaveImpact.mjs:51, ώστε να τρέχει
// ΤΟΝ ΚΩΔΙΚΑ ΠΟΥ ΣΤΕΛΝΕΤΑΙ και όχι μια παραλλαγή του.
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

const shoreWaveModule = require(path.join(root, 'utils/shoreWave.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

const regions = [];
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  if (!island?.beaches?.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  regions.push({ id: file.replace('.json', ''), beaches: island.beaches, profiles });
}
console.log(`περιοχές: ${regions.length}`);

// ΟΙ ΥΠΟΨΗΦΙΕΣ ΜΟΝΟ. Ο κανόνας δεν μπορεί να αγγίξει παραλία χωρίς γεωμετρία high, και το
// να τρέξουμε 2.768 × 14 × 2 φορές τον κινητήρα για να δούμε 44 αλλαγές είναι σπατάλη — αλλά
// το ΣΥΝΟΛΟ που ελέγχεται μένει εθνικό: κάθε παραλία με προφίλ high μπαίνει.
const targets = [];
for (const region of regions) {
  for (const beach of region.beaches) {
    const profile = region.profiles[String(beach.id)];
    if (profile?.confidence === 'high') targets.push({ region, beach, profile });
  }
}
console.log(`παραλίες με γεωμετρία high: ${targets.length}`);

const rows = [];
let comfortChanged = 0;
let avoidCrossed = 0;
let scored = 0;

for (const region of regions) {
  const clusters = buildBeachForecastClusters(region.beaches);
  const byBeach = new Map();
  let windByPoint;
  try {
    windByPoint = await fetchForecastDataBatch(clusters.map(c => ({ lat: c.lat, lon: c.lon })));
  } catch (error) { console.log(`  ${region.id}: άνεμος απέτυχε (${error.message})`); continue; }

  const marinePoints = [];
  for (const beach of region.beaches) {
    const mp = region.profiles[String(beach.id)]?.marineSamplePoint;
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
    const profile = region.profiles[String(beach.id)];
    if (profile?.confidence !== 'high') continue;
    const windData = byBeach.get(beach.id);
    if (!windData) continue;
    const mp = profile.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));

    for (const hour of HOURS) {
      const day = days?.[0];
      if (!day?.hourly?.[hour]) continue;
      const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
      const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile };

      const real = shoreWaveModule.isSeaDepartingShore;
      const after = calculateBeachScore(beach, slice, undefined, undefined, opts);
      shoreWaveModule.isSeaDepartingShore = () => false;
      const before = calculateBeachScore(beach, slice, undefined, undefined, opts);
      shoreWaveModule.isSeaDepartingShore = real;
      scored += 1;

      if (before.swimmingComfort === after.swimmingComfort
        && before.shoreDisplayWaveM === after.shoreDisplayWaveM) continue;

      const crossedAvoid = (before.swimmingComfort === 'avoid_swimming')
        !== (after.swimmingComfort === 'avoid_swimming');
      if (before.swimmingComfort !== after.swimmingComfort) comfortChanged += 1;
      if (crossedAvoid) avoidCrossed += 1;

      rows.push({
        id: beach.id, region: region.id, hour,
        name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
        waveBefore: before.shoreDisplayWaveM, waveAfter: after.shoreDisplayWaveM,
        comfortBefore: before.swimmingComfort, comfortAfter: after.swimmingComfort,
        crossedAvoid,
      });
    }
  }
  process.stdout.write(`\r  ${region.id.padEnd(42)} βαθμολογήθηκαν ${scored}`);
}
console.log('');

// ΜΕΤΡΗΣΗ ΠΟΥ ΔΕΝ ΜΕΤΡΗΣΕ ΤΙΠΟΤΑ ΕΙΝΑΙ ΨΕΜΑ. Η πρώτη εκτέλεση αυτού του αρχείου βαθμολόγησε 0
// παραλίες (κάθε κλήση έσκασε σε `window is not defined`) και τύπωσε «καμία αλλαγή» — δηλαδή
// καθησυχαστικό συμπέρασμα από κενό σύνολο. Ό,τι κι αν βρεθεί παρακάτω, αν δεν βαθμολογήθηκε
// ουσιαστικός αριθμός παραλιών το αποτέλεσμα ΔΕΝ ανακοινώνεται.
const MIN_SCORED = 20000;
// ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ. Το Ελαφονήσι (#595) είναι η γνωστή περίπτωση: ο αριθμός του ΠΡΕΠΕΙ να πέσει
// σε τουλάχιστον μία ώρα. Μέτρηση που δεν μπορεί να βρει ό,τι ξέρουμε ότι υπάρχει δεν έχει δικαίωμα
// να πει «δεν βρήκα τίποτα» — η πρώτη εκτέλεση το έκανε ακριβώς αυτό, με σπασμένο κλειδί χάρτη.
const control = rows.filter(r => r.id === 595 && r.waveAfter < r.waveBefore);
if (control.length === 0) {
  console.error('\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: ο θετικός μάρτυρας (#595 Ελαφονήσι) δεν άλλαξε σε καμία ώρα.');
  console.error('Ο κανόνας δεν άναψε πουθενά — η καλωδίωση της μέτρησης είναι σπασμένη, όχι το αποτέλεσμα.');
  process.exit(1);
}
console.log(`θετικός μάρτυρας #595: ${control.length} ώρες αλλάζουν ✓`);
if (scored < MIN_SCORED) {
  console.error(`\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: βαθμολογήθηκαν μόνο ${scored} συνδυασμοί (ελάχιστο ${MIN_SCORED}).`);
  console.error('Δεν βγαίνει συμπέρασμα από κενό σύνολο — δες τα σφάλματα δικτύου παραπάνω.');
  process.exit(1);
}

const distinct = new Set(rows.map(r => `${r.region}#${r.id}`));
const comfortRows = rows.filter(r => r.comfortBefore !== r.comfortAfter);
console.log(`\n================ ΕΠΙΠΤΩΣΗ ΣΕ ΧΡΩΜΑ / ΕΤΥΜΗΓΟΡΙΑ ================`);
console.log(`βαθμολογήσεις (παραλία × ώρα, δύο φορές η καθεμία)   ${scored}`);
console.log(`αλλάζει ο ΑΡΙΘΜΟΣ                                    ${rows.length}  (${distinct.size} παραλίες)`);
console.log(`αλλάζει η ΑΝΕΣΗ ΚΟΛΥΜΒΗΣΗΣ (άρα ίσως το χρώμα)       ${comfortChanged}`);
console.log(`ΠΕΡΝΑΕΙ ΤΟ ΟΡΙΟ «μην κολυμπήσεις» (άρα ΣΙΓΟΥΡΑ χρώμα) ${avoidCrossed}`);

if (comfortRows.length) {
  console.log('\nΚΑΘΕ ΑΛΛΑΓΗ ΕΤΥΜΗΓΟΡΙΑΣ:');
  comfortRows.forEach(r => console.log(`  #${String(r.id).padEnd(5)} ${r.name.slice(0, 20).padEnd(21)} ${String(r.hour).padStart(2)}:00  `
    + `${String(r.waveBefore).padStart(5)} → ${String(r.waveAfter).padStart(5)} μ.  ·  ${r.comfortBefore} → ${r.comfortAfter}`
    + (r.crossedAvoid ? '   ⚠ ΑΛΛΑΖΕΙ ΧΡΩΜΑ' : '')));
} else {
  console.log('\nΚΑΜΙΑ αλλαγή ετυμηγορίας — το χρώμα μένει ΠΑΝΤΟΥ ίδιο, κατασκευαστικά.');
}

mkdirSync(path.join(root, 'reports/departing-sea'), { recursive: true });
writeFileSync(path.join(root, 'reports/departing-sea/verdict-impact.json'),
  JSON.stringify({ measuredAt: new Date().toISOString(), scored, numberChanged: rows.length, distinct: distinct.size, comfortChanged, avoidCrossed, rows }, null, 2), 'utf8');
console.log('\nγράφτηκε reports/departing-sea/verdict-impact.json');
