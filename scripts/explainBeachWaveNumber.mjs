#!/usr/bin/env node
/**
 * ΠΟΙΟΣ ΤΥΠΩΝΕΙ ΤΟΝ ΑΡΙΘΜΟ — ΓΙΑ ΜΙΑ ΠΑΡΑΛΙΑ, ΩΡΑ ΠΡΟΣ ΩΡΑ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Πέντε μέρες κυνηγούσαμε την ένδειξη του πλέγματος για τη Λυγαριά (§Μ6), επειδή
 * η αρχική αναφορά (1,38 μ.) ΗΤΑΝ του πλέγματος. Η σάρωση περιόδου της 21/08 έδειξε κατά λάθος
 * κάτι άλλο: πετώντας εντελώς την ένδειξη, ο αριθμός ΔΕΝ αλλάζει σε 9 από 14 ώρες. Άρα σήμερα
 * τον αριθμό δεν τον βγάζει το πλέγμα — τον βγάζει κάτι δικό μας, και δεν ξέραμε ποιο.
 *
 * «Ο αριθμός είναι max(πλέγμα, δικό μας μοντέλο)» είναι σωστή πρόταση που ΔΕΝ λέει ποιος από τους
 * δύο κέρδισε σε συγκεκριμένη ώρα. Αυτό το εργαλείο το λέει, χωρίς να μαντεύει: καλεί τις ΙΔΙΕΣ
 * συναρτήσεις που τρέχει η σελίδα και τυπώνει κάθε όρο ξεχωριστά.
 *
 * ΧΡΗΣΗ:  node scripts/explainBeachWaveNumber.mjs <beachId> [regionFile]
 *         node scripts/explainBeachWaveNumber.mjs 636 crete-crete-heraklion
 *
 * Report-only. Δεν γράφει τίποτα, δεν αλλάζει τίποτα.
 */
import './lib/paidOpenMeteo.mjs';
import './lib/proxiedOpenMeteo.mjs';
import { readFileSync, readdirSync } from 'node:fs';
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
const { processForecastData, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { getWindChopWaveFloorM, estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const { resolveWindExposure } = require(path.join(root, 'utils/windExposureModel.ts'));

const beachId = Number(process.argv[2] || 636);
const regionHint = process.argv[3];

const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

let found;
for (const file of readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  if (regionHint && !file.startsWith(regionHint)) continue;
  const island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island;
  const beach = island?.beaches?.find(b => b.id === beachId);
  if (!beach) continue;
  let profiles = {};
  try { profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  found = { regionId: file.replace('.json', ''), beaches: island.beaches, beach, profile: profiles[String(beachId)] };
  break;
}
if (!found) {
  console.error(`Δεν βρέθηκε παραλία #${beachId}.`);
  process.exit(1);
}

const { regionId, beaches, beach, profile } = found;
console.log(`\n#${beachId} ${beach.name} — ${regionId}`);
console.log(`facingDeg ${profile?.facingDeg}  confidence ${profile?.confidence}`);
console.log(`marineSamplePoint ${profile?.marineSamplePoint?.lat}, ${profile?.marineSamplePoint?.lon} `
  + `(${profile?.marineSamplePoint?.distanceKm} χλμ στις ${profile?.marineSamplePoint?.bearingDeg}°)`);

const clusters = buildBeachForecastClusters(beaches);
const cluster = clusters.find(c => c.beachIds.includes(beachId));
const windByPoint = await fetchForecastDataBatch([{ lat: cluster.lat, lon: cluster.lon }]);
const windData = windByPoint.get(forecastPointKey(cluster.lat, cluster.lon))?.data;
const mp = profile?.marineSamplePoint;
const marineByPoint = mp ? await fetchMarineForecastDataBatch([{ lat: mp.lat, lon: mp.lon }]) : new Map();
const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
const days = processForecastData(mergeMarineForecastData(windData, marine));
const day = days[0];

console.log(`\nσημείο ανέμου (cluster): ${cluster.lat.toFixed(3)}, ${cluster.lon.toFixed(3)}\n`);
console.log(' ώρα │ άνεμος   ριπή  από   Μπφ │ τομέας/επίπεδο  fetch │  SMB  δάπεδο │ πλέγμα  T   από │ ΤΥΠΩΝΕΤΑΙ  ποιος κέρδισε');
console.log('─────┼─────────────────────────┼───────────────────────┼──────────────┼─────────────────┼────────────────────────');

for (let hour = 7; hour <= 20; hour += 1) {
  const h = day?.hourly?.[hour];
  if (!h) continue;
  const slice = { ...day, ...h, hourly: day.hourly };
  const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile };
  const score = calculateBeachScore(beach, slice, undefined, undefined, opts);

  // ⚠️ ΜΟΝΑΔΕΣ: `wind.speed` / `wind.gust` είναι ΜΕΤΡΑ ΤΟ ΔΕΥΤΕΡΟΛΕΠΤΟ — ο ίδιος ο
  // services/recommendationService.ts τα πολλαπλασιάζει επί 3,6 πριν τα δώσει στο μοντέλο.
  // Η πρώτη γραφή αυτού του εργαλείου τα πέρασε ως χλμ/ώρα και έβγαλε 1-2 Μποφόρ αντί για 3-4,
  // δηλαδή «το δικό μας μοντέλο δίνει 0,02 μ.» — καθαρό δικό μου σφάλμα, όχι εύρημα.
  const windKmh = typeof h.wind?.speed === 'number' ? h.wind.speed * 3.6 : undefined;
  const gust = typeof h.wind?.gust === 'number' ? h.wind.gust * 3.6 : undefined;
  const windDir = h.wind?.deg;
  const meanBefore = typeof h.wind?.speedBeforeGustFloor === 'number' ? h.wind.speedBeforeGustFloor * 3.6 : undefined;
  const bft = getBeaufortLevel(windKmh);

  const assessment = resolveWindExposure({
    geospatialProfile: profile,
    orientationDeg: beach.metadata?.orientation?.degrees ?? null,
    windDirectionDeg: windDir,
    windSpeedKmh: windKmh,
    measuredWaveHeightM: h.marine?.waveHeightM,
  });
  const level = assessment?.level ?? '—';
  const sectorFetch = assessment?.effectiveFetchKm ?? assessment?.fetchKm;
  const smb = typeof sectorFetch === 'number'
    ? estimateFetchLimitedWaveHeightM({ windSpeedKmh: windKmh, fetchKm: sectorFetch }) : undefined;
  const damping = level === 'protected' ? 0.5 : level === 'partial' ? 0.75 : 1;
  const smbDamped = typeof smb === 'number' ? Number((smb * damping).toFixed(2)) : undefined;
  const floor = getWindChopWaveFloorM(level, bft, windKmh, gust, meanBefore);

  const gridM = h.marine?.waveHeightM;
  const gridT = h.marine?.wavePeriodS;
  const gridDir = h.marine?.waveDirectionDeg;
  const printed = score.shoreDisplayWaveM;

  const ourModel = Math.max(smbDamped ?? 0, floor ?? 0);
  let winner;
  if (typeof gridM !== 'number') winner = 'μόνο δικό μας';
  else if (Math.abs(ourModel - (printed ?? -1)) < 0.06 && ourModel >= gridM - 0.02) winner = 'ΔΙΚΟ ΜΑΣ ΜΟΝΤΕΛΟ';
  else if (Math.abs(gridM - (printed ?? -1)) < 0.06) winner = 'πλέγμα';
  else winner = 'μεικτό/μετά από ταβάνι';

  console.log(
    `${String(hour).padStart(4)} │ ${String(windKmh?.toFixed?.(0) ?? windKmh).padStart(5)}  ${String(gust?.toFixed?.(0) ?? gust).padStart(5)}  `
    + `${String(windDir).padStart(4)}°  ${String(bft).padStart(2)} │ `
    + `${String(level).padEnd(10)} ${String(sectorFetch ?? '—').padStart(6)} │ `
    + `${String(smbDamped ?? '—').padStart(5)} ${String(floor ?? '—').padStart(6)} │ `
    + `${String(gridM ?? '—').padStart(5)} ${String(gridT ?? '—').padStart(4)} ${String(gridDir ?? '—').padStart(4)}° │ `
    + `${String(printed ?? '—').padStart(6)}   ${winner}`
  );
}

console.log('\nΔΙΑΒΑΣΜΑ: «δάπεδο» = utils/waveModel.getWindChopWaveFloorM — το κατώτατο κυματάκι που');
console.log('η εφαρμογή δέχεται για αυτή την έκθεση σε αυτό το μποφόρ. Αν κερδίζει αυτό, ο αριθμός');
console.log('ΔΕΝ έρχεται από το πλέγμα και καμία δουλειά πάνω στο πλέγμα δεν τον αλλάζει.');
