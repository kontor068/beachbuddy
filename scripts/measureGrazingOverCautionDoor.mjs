#!/usr/bin/env node
/**
 * Η ΠΟΡΤΑ ΤΩΝ 4 ΜΠΟΦΟΡ ΑΝΟΙΓΕΙ ΓΙΑ ΝΕΡΟ ΠΟΥ ΦΕΥΓΕΙ — ΟΧΙ ΓΙΑ ΝΕΡΟ ΠΟΥ ΠΕΡΝΑΕΙ ΞΥΣΤΑ.
 * ΠΟΣΟ ΚΟΣΤΙΖΕΙ ΑΥΤΗ Η ΑΣΥΜΜΕΤΡΙΑ, ΕΘΝΙΚΑ;
 *
 * Η ΑΦΟΡΜΗ, ΜΕ ΝΟΥΜΕΡΑ ΠΟΥ ΕΠΑΛΗΘΕΥΤΗΚΑΝ ΣΗΜΕΡΑ. Λυγαριά Ηρακλείου #636, 22/08/2026 15:00-18:00:
 * μετά το §Γ59 το νερό στην ακτή τυπώνεται **0,28-0,29 μ.** — λάδι — και η ετυμηγορία μένει
 * «ΜΗΝ ΚΟΛΥΜΠΗΣΕΙΣ». Ο λόγος είναι μία γραμμή: `utils/overCautionRelief.relievesOverCaution`
 * επιστρέφει `beaufort < ceiling`, με `ceiling = departingSea ? 5 : 4`. Ο άνεμος είναι ΑΚΡΙΒΩΣ
 * 4 Μποφ., άρα `4 < 4` = false και η ανακούφιση αρνείται.
 *
 * ΚΑΙ Ο ΑΝΕΜΟΣ ΔΕΝ ΕΙΝΑΙ ΛΑΘΟΣ — ΜΕΤΡΗΘΗΚΕ (`scripts/inspectLygariaWindTruth.mjs`, 22/08):
 * το στεριανό κελί δίνει 23/48 χλμ/ώρα, το ΘΑΛΑΣΣΙΝΟ κελί 4,2 χλμ έξω δίνει 23/42, και το σημείο
 * 3 χλμ ανοιχτά δίνει 23/48. Διαφορά στεριάς−θάλασσας: **0 ως −2 χλμ/ώρα** στις κρίσιμες ώρες.
 * Άρα η «ρίζα Α» (ο άνεμος που φουσκώνει) ΔΕΝ ισχύει εδώ: ο αέρας είναι όντως εκεί. Αυτό που
 * λείπει δεν είναι μικρότερος άνεμος — είναι να αναγνωριστεί ότι **αέρας χωρίς κύμα δεν είναι
 * λόγος να απαγορεύσεις το μπάνιο**, που είναι ακριβώς αυτό που η πόρτα ήδη δέχεται για το νερό
 * που φεύγει.
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Α (σήμερα) vs Β (υποψήφια): η ίδια πόρτα ανοίγει ως τα 5 Μποφ. και όταν η θάλασσα
 * **περνάει ξυστά** — με ΤΙΣ ΙΔΙΕΣ πύλες που κέρδισε το §Γ59 (`-0,65 < onshore <= 0`), όχι με
 * καινούργιες. Οι δύο ΠΡΑΓΜΑΤΙΚΕΣ πόρτες μένουν άθικτες και στα δύο σκέλη: τίποτα δεν ανάβει
 * στα ≥5 Μποφ., τίποτα δεν ανάβει πάνω από 0,6 μ. νερό στην ακτή, και η επίσημη προειδοποίηση,
 * η αποθαλασσιά και η βροχή υπερισχύουν όπως πάντα.
 *
 * ⚠️ ΚΑΤΕΥΘΥΝΣΗ ΚΙΝΔΥΝΟΥ: αφαιρεί τη λέξη «μην κολυμπήσεις». Ένα σκαλί, ποτέ σε «Καλή» — αλλά
 * είναι η επικίνδυνη μεριά και το νούμερο που μετράει είναι ΠΟΣΕΣ φορές συμβαίνει και ΜΕ ΠΟΣΟ
 * αέρα. Γι' αυτό τυπώνεται η κατανομή ριπής, όχι μόνο το πλήθος.
 *
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" \
 *     node scripts/measureGrazingOverCautionDoor.mjs
 *
 * Report-only.
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
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

const overCaution = require(path.join(root, 'utils/overCautionRelief.ts'));
// Η ΣΗΜΑΙΑ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΕΦΑΡΜΟΓΗΣ, ΟΧΙ ΔΙΚΟΣ ΜΑΣ ΥΠΟΛΟΓΙΣΜΟΣ. Το §Γ59 έφτιαξε τρίτη τιμή
// `'grazing'` που ταξιδεύει στο ΙΔΙΟ πεδίο `seaArrivalExposureLevel` ως την πινέζα. Η πρώτη
// εκδοχή αυτού του αρχείου ξαναϋπολόγιζε το συνημίτονο με σταθερά που ΔΕΝ υπάρχει
// (`GRAZING_MAX_ONSHORE`) — βγήκε `undefined`, καμία παραλία δεν πέρασε ποτέ, και η μέτρηση
// θα έλεγε «καμία αλλαγή» από άδειο σύνολο. Την έπιασε ο θετικός μάρτυρας. Ρώτα την πηγή.
const { SEA_ARRIVAL_GRAZING } = require(path.join(root, 'utils/waveCharacter.ts'));
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

// Η ΜΟΝΗ ΠΑΡΕΜΒΑΣΗ: η ΙΔΙΑ συνάρτηση, με τη σημαία «η θάλασσα περνάει ξυστά» να μετράει όσο και
// η «η θάλασσα φεύγει». Καμία αντιγραφή λογικής — το κατώφλι και οι άλλες πόρτες μένουν δικές της.
const realRelieves = overCaution.relievesOverCaution;
let grazingNow = false;
const patched = (input) => realRelieves({ ...input, departingSea: input.departingSea || grazingNow });

const rows = [];
let scored = 0;
let grazingHours = 0;

for (const region of regions) {
  const clusters = buildBeachForecastClusters(region.beaches);
  const byBeach = new Map();
  let windByPoint;
  try {
    windByPoint = await fetchForecastDataBatch(clusters.map(c => ({ lat: c.lat, lon: c.lon })));
  } catch (error) { console.log(`\n  ${region.id}: ανεμος απετυχε (${error.message})`); continue; }

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
    const facingDeg = profile.facingDeg;
    if (typeof facingDeg !== 'number') continue;
    const windData = byBeach.get(beach.id);
    if (!windData) continue;
    const mp = profile.marineSamplePoint;
    const marine = mp ? (marineByPoint.get(forecastPointKey(mp.lat, mp.lon))?.data ?? []) : [];
    const days = processForecastData(mergeMarineForecastData(windData, marine));
    const day = days?.[0];
    if (!day?.hourly) continue;

    for (const hour of HOURS) {
      if (!day.hourly[hour]) continue;
      const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
      const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile };

      const waveDirectionDeg = slice.marine?.waveDirectionDeg;
      const onshore = typeof waveDirectionDeg === 'number' && Number.isFinite(waveDirectionDeg)
        ? Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180)
        : undefined;
      overCaution.relievesOverCaution = realRelieves;
      grazingNow = false;
      const before = calculateBeachScore(beach, slice, undefined, undefined, opts);
      scored += 1;
      if (before.seaArrivalExposureLevel !== SEA_ARRIVAL_GRAZING) continue;
      grazingHours += 1;

      overCaution.relievesOverCaution = patched;
      grazingNow = true;
      const after = calculateBeachScore(beach, slice, undefined, undefined, opts);
      overCaution.relievesOverCaution = realRelieves;
      grazingNow = false;

      if (before.swimmingComfort === after.swimmingComfort) continue;
      rows.push({
        id: beach.id, region: region.id,
        name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
        hour, onshore: Number(onshore.toFixed(3)),
        level: before.exposureLevel,
        shoreWaveM: before.shoreDisplayWaveM,
        windKmh: Math.round((slice.wind?.speed ?? 0) * 3.6),
        gustKmh: Math.round((slice.wind?.gust ?? 0) * 3.6),
        comfortBefore: before.swimmingComfort, comfortAfter: after.swimmingComfort,
      });
    }
  }
  process.stdout.write(`\r  ${region.id.padEnd(42)} βαθμολογηθηκαν ${scored}`);
}
console.log('');

const MIN_SCORED = 20000;
if (scored < MIN_SCORED) {
  console.error(`\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: βαθμολογηθηκαν μονο ${scored} (ελαχιστο ${MIN_SCORED}).`);
  process.exit(1);
}
// ΘΕΤΙΚΟΣ ΜΑΡΤΥΡΑΣ: η Λυγαριά ΠΡΕΠΕΙ να κινηθεί, αλλιώς η καλωδίωση είναι σπασμένη.
const witness = rows.filter(r => r.id === 636);
if (witness.length === 0) {
  console.error('\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: ο μαρτυρας #636 Λυγαρια δεν αλλαξε σε καμια ωρα.');
  process.exit(1);
}
console.log(`θετικος μαρτυρας #636: ${witness.length} ωρες αλλαζουν OK`);

const beaches = new Set(rows.map(r => `${r.region}#${r.id}`));
const lifted = rows.filter(r => r.comfortBefore === 'avoid_swimming');
const harsher = rows.filter(r => r.comfortAfter === 'avoid_swimming');
console.log(`\nβαθμολογησεις                         ${scored}`);
console.log(`ωρες με θαλασσα που περναει ξυστα     ${grazingHours}`);
console.log(`ΑΛΛΑΖΕΙ ΕΤΥΜΗΓΟΡΙΑ                    ${rows.length}  (${beaches.size} παραλιες)`);
console.log(`  εκ των οποιων ΣΒΗΝΕΙ «μην κολυμπησεις» ${lifted.length}`);
console.log(`  αυστηροτερα (δεν πρεπει να υπαρχει)    ${harsher.length}`);

const t = {};
rows.forEach(r => { const k = `${r.comfortBefore} -> ${r.comfortAfter}`; t[k] = (t[k] || 0) + 1; });
console.log(`\nμεταβασεις: ${Object.entries(t).map(([k, v]) => `${k} (${v})`).join(' · ')}`);

if (lifted.length) {
  const g = lifted.map(r => r.gustKmh).sort((a, b) => a - b);
  const w = lifted.map(r => r.shoreWaveM).sort((a, b) => a - b);
  console.log(`\nΣΤΙΣ ΩΡΕΣ ΠΟΥ ΣΒΗΝΕΙ Η ΑΡΝΗΣΗ — τι αερα και τι νερο εχει:`);
  console.log(`  ριπη   ελαχ ${g[0]} · διαμ ${g[Math.floor(g.length / 2)]} · μεγ ${g[g.length - 1]} χλμ/ωρα`);
  console.log(`  νερο   ελαχ ${w[0]} · διαμ ${w[Math.floor(w.length / 2)]} · μεγ ${w[w.length - 1]} μ.`);
  const byBeach = {};
  lifted.forEach(r => { byBeach[`#${r.id} ${r.name}`] = (byBeach[`#${r.id} ${r.name}`] || 0) + 1; });
  console.log(`  παραλιες: ${Object.entries(byBeach).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k} (${v})`).join(' · ')}`);
}

console.log('\nΛΥΓΑΡΙΑ #636:');
witness.sort((a, b) => a.hour - b.hour).forEach(r => console.log(
  `  ${String(r.hour).padStart(2)}:00  ανεμος ${r.windKmh}/${r.gustKmh} χλμ/ωρα · νερο ${r.shoreWaveM} μ. · onshore ${r.onshore}  ${r.comfortBefore} -> ${r.comfortAfter}`));

mkdirSync(path.join(root, 'reports/weather'), { recursive: true });
const out = path.join(root, 'reports/weather/grazing-over-caution-door-live.json');
writeFileSync(out, JSON.stringify({
  measuredAt: new Date().toISOString(), scored, grazingHours,
  verdictChanged: rows.length, beaches: beaches.size, lifted: lifted.length, harsher: harsher.length, rows,
}, null, 2), 'utf8');
console.log(`\nγραφτηκε ${path.relative(root, out)}`);
