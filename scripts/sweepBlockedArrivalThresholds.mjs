#!/usr/bin/env node
/**
 * ΣΑΡΩΣΗ ΚΑΤΩΦΛΙΩΝ ΓΙΑ ΤΟΝ ΚΑΝΟΝΑ «ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΕΚΕΙ ΠΟΥ ΕΧΕΙ ΣΤΕΡΙΑ».
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Η πρώτη εθνική μέτρηση (±30°, 1 χλμ) βγήκε ΑΠΟΡΡΙΠΤΕΑ: ο κανόνας άναβε σε 20.463
 * από 40.166 ώρες, άλλαζε τον αριθμό σε 1.490 παραλίες και περνούσε το όριο «μην κολυμπήσεις» σε
 * 2.218 ώρες, με άλματα από 1,1 μ. κατευθείαν στο «καλή». Αυτό είναι μαζική ψεύτικη ηρεμία —
 * σκανδάλη #1 της §9, ίδιο μοτίβο με τον κανόνα σκίασης που είχε ήδη πεθάνει (2.846/2.850).
 *
 * ΤΙ ΚΑΝΕΙ. Κατεβάζει τα ζωντανά δεδομένα ΜΙΑ φορά και βαθμολογεί τις ίδιες ώρες με ΠΟΛΛΑ ζευγάρια
 * κατωφλίων, ώστε τα νούμερα να είναι συγκρίσιμα μεταξύ τους και όχι μετρήσεις διαφορετικών ημερών.
 * Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ calculateBeachScore· τα κατώφλια περνάνε στην αληθινή συνάρτηση.
 *
 * ΤΙ ΨΑΧΝΟΥΜΕ: ζευγάρι όπου η Λυγαριά (#636) διορθώνεται ΚΑΙ οι αλλαγές χρώματος μένουν στη
 * δεκάδα, όχι στις χιλιάδες. Αν δεν υπάρχει τέτοιο ζευγάρι, ο κανόνας ΔΕΝ βγαίνει.
 */
import './lib/paidOpenMeteo.mjs';
import './lib/proxiedOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
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


/**
 * ⛔ Ο ΑΠΟΡΡΙΦΘΕΙΣ ΚΑΝΟΝΑΣ, ΦΥΛΑΓΜΕΝΟΣ ΕΔΩ ΚΑΙ ΜΟΝΟ ΕΔΩ.
 *
 * Ζούσε για λίγες ώρες στο `utils/blockedArrivalSea.ts` και ήταν συνδεδεμένος στον
 * `resolveDisplayWaveHeightM`. Η μέτρηση παρακάτω τον σκότωσε πριν φύγει γραμμή προς τα έξω, οπότε
 * το αρχείο και η σύνδεση διαγράφηκαν. Ο κανόνας μένει ΜΟΝΟ μέσα στη μέτρηση που τον απέρριψε:
 * έτσι κανείς δεν μπορεί να τον καλέσει κατά λάθος από την εφαρμογή, και όποιος θελήσει να τον
 * ξαναπροτείνει έχει το εργαλείο να τον ξαναμετρήσει την ίδια μέρα.
 *
 * Η ΕΡΩΤΗΣΗ: «αν η γωνία απ' όπου δηλώνει το πλέγμα ότι έρχεται το κύμα βρίσκει στεριά, μπορεί
 * αυτό το κύμα να είναι εδώ;» Αν όχι, πετάμε την ένδειξη και ο αριθμός πέφτει στο δικό μας μοντέλο.
 */
const MOUTH_OPEN_KM = 3;
const ARRIVAL_FAN_STEP_DEG = 15;
const ARRIVAL_FAN_SLOTS = 24;

const isSeaArrivalLandBlocked = ({ fan, waveDirectionDeg, arrivingSwellPresent, fanDeg, maxFetchKm, maxOpenSlots }) => {
  if (arrivingSwellPresent) return false;
  if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) return false;
  if (!Array.isArray(fan) || fan.length !== ARRIVAL_FAN_SLOTS) return false;

  const openSlots = fan.filter(value => typeof value === 'number' && value > MOUTH_OPEN_KM).length;
  if (openSlots === 0 || openSlots > maxOpenSlots) return false;

  const centreSlot = Math.round((((waveDirectionDeg % 360) + 360) % 360) / ARRIVAL_FAN_STEP_DEG);
  const halfSlots = Math.round(fanDeg / ARRIVAL_FAN_STEP_DEG);
  for (let offset = -halfSlots; offset <= halfSlots; offset += 1) {
    const value = fan[(centreSlot + offset + ARRIVAL_FAN_SLOTS) % ARRIVAL_FAN_SLOTS];
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (value > maxFetchKm) return false;
  }
  return true;
};

/** Οι βεντάλιες ζουν εκτός public/ — δες scripts/geospatialExposureProfiles.ts --arrival-fan. */
const arrivalFanDir = path.join(root, 'reports/geometry/arrival-fan');
const fansByRegion = new Map();
for (const file of readdirSync(arrivalFanDir)) {
  if (!file.endsWith('.json')) continue;
  fansByRegion.set(file.replace('.json', ''), JSON.parse(readFileSync(path.join(arrivalFanDir, file), 'utf8')).fans || {});
}

const WITNESS_ID = 636;
const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

/** Από χαλαρό προς αυστηρό. Το «άνοιγμα ≈ 0» σημαίνει στεριά μέσα στα πρώτα 100-300 μ. */
const CANDIDATES = [
  // ΧΩΡΙΣ όρο στενότητας (maxOpenSlots 24 = κάθε παραλία) — η πρώτη, απορριφθείσα σχεδίαση.
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 24 },
  { fanDeg: 90, maxFetchKm: 0.3, maxOpenSlots: 24 },
  // ΜΕ όρο στενότητας: μόνο παραλίες που έχουν ΜΟΝΟ στόμιο, όχι ανοιχτή ακτή.
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 6 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 4 },
  { fanDeg: 30, maxFetchKm: 1, maxOpenSlots: 3 },
  { fanDeg: 15, maxFetchKm: 1, maxOpenSlots: 4 },
  { fanDeg: 45, maxFetchKm: 0.5, maxOpenSlots: 4 },
];

const regions = [];
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  if (!island?.beaches?.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  regions.push({ id: file.replace('.json', ''), beaches: island.beaches, profiles });
}

const stats = CANDIDATES.map(c => ({
  ...c, fired: 0, numberChanged: 0, comfortChanged: 0, avoidCrossed: 0,
  maxDrop: 0, beaches: new Set(), witnessHours: 0, wentUp: 0,
}));
let scored = 0;

for (const region of regions) {
  const clusters = buildBeachForecastClusters(region.beaches);
  const byBeach = new Map();
  let windByPoint;
  try {
    windByPoint = await fetchForecastDataBatch(clusters.map(c => ({ lat: c.lat, lon: c.lon })));
  } catch { continue; }

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

      const before = calculateBeachScore(beach, slice, undefined, undefined, opts);
      scored += 1;

      const fan = fansByRegion.get(region.id)?.[String(beach.id)];
      const waveDirectionDeg = day.hourly[hour]?.marine?.waveDirectionDeg;
      const swellHeightM = day.hourly[hour]?.marine?.swellWaveHeightM;
      const swellDirectionDeg = day.hourly[hour]?.marine?.swellWaveDirectionDeg;
      const arrivingSwellPresent = (swellHeightM ?? 0) >= 0.4 && typeof swellDirectionDeg !== 'number';

      for (const stat of stats) {
        const fired = profile.confidence === 'high' && isSeaArrivalLandBlocked({
          fan, waveDirectionDeg, arrivingSwellPresent,
          fanDeg: stat.fanDeg, maxFetchKm: stat.maxFetchKm, maxOpenSlots: stat.maxOpenSlots,
        });
        if (fired) stat.fired += 1;
        // Ο κανόνας πετάει την ένδειξη του πλέγματος: ισοδύναμα, βαθμολογούμε ΧΩΡΙΣ θάλασσα.
        const after = fired
          ? calculateBeachScore(beach, { ...slice, marine: undefined }, undefined, undefined, opts)
          : before;
        if (before.shoreDisplayWaveM === after.shoreDisplayWaveM
          && before.swimmingComfort === after.swimmingComfort) continue;
        stat.numberChanged += 1;
        stat.beaches.add(beach.id);
        if (beach.id === WITNESS_ID) stat.witnessHours += 1;
        if (typeof before.shoreDisplayWaveM === 'number' && typeof after.shoreDisplayWaveM === 'number') {
          stat.maxDrop = Math.max(stat.maxDrop, before.shoreDisplayWaveM - after.shoreDisplayWaveM);
          if (after.shoreDisplayWaveM > before.shoreDisplayWaveM + 0.005) stat.wentUp += 1;
        }
        if (before.swimmingComfort !== after.swimmingComfort) stat.comfortChanged += 1;
        if ((before.swimmingComfort === 'avoid_swimming') !== (after.swimmingComfort === 'avoid_swimming')) {
          stat.avoidCrossed += 1;
        }
      }
    }
  }
  process.stdout.write(`\r  ${region.id.padEnd(42)} ${scored}`);
}
console.log('');

if (scored < 20000) {
  console.error(`\nΑΚΥΡΗ ΣΑΡΩΣΗ: μόνο ${scored} βαθμολογήσεις.`);
  process.exit(1);
}

console.log('\n παράθυρο  άνοιγμα │  άναψε   αλλάζει ο αριθμός   παραλίες   ετυμηγορία   ΧΡΩΜΑ   μεγ.πτώση   Λυγαριά');
console.log('──────────────────┼────────────────────────────────────────────────────────────────────────────────');
for (const s of stats) {
  console.log(
    `  ±${String(s.fanDeg).padStart(2)}°  ${String(s.maxFetchKm).padStart(4)}χλμ  ${String(s.maxOpenSlots*15).padStart(3)}° │ `
    + `${String(s.fired).padStart(6)}   ${String(s.numberChanged).padStart(10)}   `
    + `${String(s.beaches.size).padStart(8)}   ${String(s.comfortChanged).padStart(10)}   `
    + `${String(s.avoidCrossed).padStart(5)}   ${s.maxDrop.toFixed(2).padStart(9)}   `
    + `${s.witnessHours ? String(s.witnessHours) + ' ώρες ✓' : 'ΟΧΙ ✗'}`
  );
}
console.log(`\nσυνολικές βαθμολογήσεις ανά ζευγάρι: ${scored}`);

mkdirSync(path.join(root, 'reports/blocked-arrival'), { recursive: true });
writeFileSync(path.join(root, 'reports/blocked-arrival/threshold-sweep.json'),
  JSON.stringify({
    measuredAt: new Date().toISOString(), scored,
    candidates: stats.map(s => ({ ...s, beaches: s.beaches.size })),
  }, null, 2), 'utf8');
console.log('γράφτηκε reports/blocked-arrival/threshold-sweep.json');
