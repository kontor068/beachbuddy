#!/usr/bin/env node
/**
 * ΤΙ ΛΕΕΙ Η ΚΑΡΤΑ ΓΙΑ ΜΙΑ ΠΑΡΑΛΙΑ, ΤΩΡΑ, ΩΡΑ ΠΡΟΣ ΩΡΑ — διάγνωση, όχι πύλη.
 *
 * Γεννήθηκε επειδή η μέτρηση της πόρτας των 4 Μποφόρ βγήκε ΑΚΥΡΗ στον δικό της μάρτυρα (η Λυγαριά
 * «δεν άλλαξε»), και το πρώτο ερώτημα σε τέτοια περίπτωση δεν είναι «γιατί δεν άλλαξε» αλλά
 * «τι λέει τώρα». Τυπώνει ό,τι κρίνει την ετυμηγορία, χωρίς καμία παρέμβαση.
 *
 *   node scripts/probeBeachVerdictNow.mjs <beachId> <regionFile>
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

// ΚΑΤΑΓΡΑΦΕΑΣ ΤΗΣ ΠΟΡΤΑΣ. Δεν αλλάζει τίποτα — μόνο δείχνει τι ΑΚΡΙΒΩΣ ρωτήθηκε ο φρουρός της
// υπερβολικής αυστηρότητας και τι απάντησε. Χωρίς αυτό, το «δεν άναψε» μένει εικασία.
const overCaution = require(path.join(root, 'utils/overCautionRelief.ts'));
const realRelieves = overCaution.relievesOverCaution;
let lastDoor = null;
overCaution.relievesOverCaution = (input) => {
  const answer = realRelieves(input);
  lastDoor = { ...input, answer };
  return answer;
};

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const beachId = Number(process.argv[2]);
const regionFile = process.argv[3];
const list = JSON.parse(readFileSync(path.join(root, `public/data/beaches/app/summary/${regionFile}.json`), 'utf8')).island.beaches;
const beach = list.find(b => b.id === beachId);
const profile = JSON.parse(readFileSync(path.join(root, `public/data/geospatial/exposure/${regionFile}.json`), 'utf8')).profiles[String(beachId)];

const cluster = buildBeachForecastClusters(list).find(c => c.beachIds.includes(beachId));
const windByPoint = await fetchForecastDataBatch([{ lat: cluster.lat, lon: cluster.lon }]);
const mp = profile.marineSamplePoint;
const marineByPoint = await fetchMarineForecastDataBatch(mp ? [{ lat: mp.lat, lon: mp.lon }] : []);
const windData = windByPoint.get(forecastPointKey(cluster.lat, cluster.lon)).data;
const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
const day = processForecastData(mergeMarineForecastData(windData, marine))[0];

console.log(`\n#${beachId} — κοιτάει ${profile.facingDeg}°`);
console.log(` ώρα │ άνεμος/ριπή  Μπφ │ νερό ακτής │ ανοιχτά │ έκθεση    │ ΕΤΥΜΗΓΟΡΙΑ      │ βαθμός`);
console.log(' ────┼──────────────────┼────────────┼─────────┼───────────┼─────────────────┼───────');
for (let hour = 10; hour <= 20; hour += 1) {
  if (!day.hourly[hour]) continue;
  const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
  const r = calculateBeachScore(beach, slice, undefined, undefined,
    { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile });
  const speed = Math.round((slice.wind?.speed ?? 0) * 3.6);
  const gust = Math.round((slice.wind?.gust ?? 0) * 3.6);
  console.log(` ${String(hour).padStart(3)} │ ${String(speed).padStart(6)}/${String(gust).padStart(3)} `
    + `${String(r.windBeaufort ?? '').padStart(6)} │ ${String(r.shoreDisplayWaveM ?? '—').padStart(10)} │ `
    + `${String(r.seaStateWaveM ?? '—').padStart(7)} │ ${String(r.exposureLevel ?? '—').padEnd(9)} │ `
    + `${String(r.swimmingComfort).padEnd(15)} │ ${String(Math.round(r.score))}`);
  if (r.swimmingComfort === 'avoid_swimming' && lastDoor) {
    console.log(`     └─ πόρτα 4 Μποφ: Μπφ ${lastDoor.beaufort} · νερό ακτής ${lastDoor.seaAtShoreM} · `
      + `φεύγει ${!!lastDoor.departingSea} · επίσημη ${!!lastDoor.officialWarning} · `
      + `αποθαλασσιά ${!!lastDoor.directSwell} · ποινή ${lastDoor.swellSurgePenalty ?? 0} → ΑΠΑΝΤΗΣΗ ${lastDoor.answer}`);
  }
  lastDoor = null;
}
