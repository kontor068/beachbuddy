#!/usr/bin/env node
/**
 * ΤΟ ΝΕΡΟ ΠΟΥ ΠΕΡΝΑΕΙ ΞΥΣΤΑ — ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΤΥΠΩΝΟΥΝ ΟΛΟΚΛΗΡΟ ΤΟ ΑΝΟΙΧΤΟ ΝΕΡΟ ΣΕ ΑΚΤΗ
 * ΠΟΥ Η ΙΔΙΑ Η ΕΦΑΡΜΟΓΗ ΕΧΕΙ ΗΔΗ ΚΡΙΝΕΙ ΟΤΙ ΔΕΝ ΤΟ ΔΕΧΕΤΑΙ;
 *
 * Η ΑΦΟΡΜΗ (αναφορά Μίλτου, 22/08/2026, ζωντανή κάμερα). Καραβοστάσι Ρεθύμνου #680 (κοιτάει
 * 35,4°) και Λυγαριά Ηρακλείου #636 (κοιτάει 30,1°). Και οι δύο τυπώνουν 0,44-0,58 μ. με τη
 * θάλασσα να έρχεται από 299-300°, δηλαδή **90-95° από την κάθετο της ακτής**: περνάει
 * παράλληλα, δεν μπαίνει. Ο άνεμος το ίδιο (onshore −0,11 ως +0,16).
 *
 * ΤΟ ΤΥΦΛΟ ΣΗΜΕΙΟ, ΑΚΡΙΒΩΣ. Η `utils/seaArrival.resolveSeaArrivalExposureLevel` ΗΔΗ απαντά
 * `undefined` σε αυτές τις δύο, και το σχόλιό της το λέει ρητά: «a sea running along or away from
 * this shore is not the sea that lands on it». Αλλά η `utils/waveCharacter.shoreSeaStateM`
 * χρησιμοποιεί αυτή τη γνώση **μόνο για να ΑΡΝΗΘΕΙ** την έκπτωση ×0,5 — ποτέ για να τη δώσει.
 * Η έκπτωση απαιτεί ο ΑΝΕΜΟΣ να έχει βγάλει `protected`. Και οι δύο παραλίες είναι `partial`.
 * Άρα: η εφαρμογή ξέρει ότι το νερό δεν έρχεται, και τυπώνει ολόκληρο το νούμερο των 10 χλμ.
 *
 * ΔΕΝ ΕΦΕΥΡΙΣΚΕΤΑΙ ΝΟΥΜΕΡΟ. Η υποψήφια αλλαγή δίνει το ΗΔΗ ΥΠΑΡΧΟΝ ×0,5
 * (SHORE_DAMPING_BY_EXPOSURE.protected, ζωντανό από 01/08) και σε αυτή την περίπτωση. Καμία νέα
 * σταθερά, κανένα νέο κατώφλι πέρα από τα δύο που ήδη υπάρχουν (0,0 και 0,3).
 *
 * ⚠️ ΚΑΤΕΥΘΥΝΣΗ ΚΙΝΔΥΝΟΥ: αυτή η αλλαγή κάνει παραλίες να φαίνονται **ΠΙΟ ΗΡΕΜΕΣ**. Είναι η
 * επικίνδυνη μεριά. Γι' αυτό μετριούνται τέσσερα παράθυρα από το αυστηρότερο προς το φαρδύτερο
 * και αναφέρεται ΞΕΧΩΡΙΣΤΑ πόσες πινέζες περνάνε το όριο «μην κολυμπήσεις».
 *
 * ΑΝΤΙΘΕΤΗ ΦΟΡΑ ΑΠΟ ΤΟ ΑΝΟΙΧΤΟ ΝΗΜΑ ΤΗΣ ΒΙΒΛΟΥ (§20/08, «ΤΟ ΑΝΟΙΧΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΜΕΝΕΙ»): εκείνο
 * ρωτά μήπως το 0,3 δίνει την έκπτωση πολύ γενναιόδωρα (η διάθλαση σε ρηχά στρέφει το λοξό κύμα
 * προς την ακτή). Αυτό εδώ ρωτά το αντίστροφο. ΤΟ ΙΔΙΟ ΚΟΥΜΠΙ — γι' αυτό μετρώνται και τα δύο
 * παράθυρα, ώστε η επόμενη απόφαση να τα δει μαζί αντί να τα κουνήσει χωριστά.
 *
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" \
 *     node scripts/measureGrazingSeaImpact.mjs
 *
 * Report-only. Δεν γράφει κώδικα, δεν αλλάζει δεδομένα.
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
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const waveCharacter = require(path.join(root, 'utils/waveCharacter.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const HOURS = Array.from({ length: 14 }, (_, index) => index + 7);

/**
 * ΤΑ ΤΕΣΣΕΡΑ ΠΑΡΑΘΥΡΑ. `maxOnshore` = πόσο λοξά επιτρέπεται να έρχεται η θάλασσα για να πούμε
 * «δεν μπαίνει». 0,0 = αυστηρά ≥90° (περνάει ξυστά ή φεύγει). 0,3 = το ήδη ζωντανό
 * SEA_ARRIVAL_ONSHORE_MIN, δηλαδή ως 72,5° λοξά. `levels` = σε ποια έκθεση ανέμου δίνεται.
 */
const VARIANTS = [
  { key: 'A0', maxOnshore: 0.0, levels: ['partial'], label: '90+ λοξά, μόνο μερική' },
  { key: 'A3', maxOnshore: 0.3, levels: ['partial'], label: '72,5+ λοξά, μόνο μερική' },
  { key: 'B0', maxOnshore: 0.0, levels: ['partial', 'exposed'], label: '90+ λοξά, + εκτεθειμένες' },
  { key: 'B3', maxOnshore: 0.3, levels: ['partial', 'exposed'], label: '72,5+ λοξά, + εκτεθειμένες' },
];

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

// Η ΜΟΝΗ ΠΑΡΕΜΒΑΣΗ: επιβάλλει την έκπτωση ×0,5 στην ΙΔΙΑ συνάρτηση που τρέχει η σελίδα.
// Καμία αντιγραφή λογικής — μόνο ο ένας πολλαπλασιαστής που η υποψήφια αλλαγή θα άνοιγε.
const realShoreSeaStateM = waveCharacter.shoreSeaStateM;
const forceDiscount = (openM) =>
  (typeof openM === 'number' && Number.isFinite(openM) ? Number((openM * 0.5).toFixed(2)) : undefined);

const rows = [];
let scored = 0;
let qualifiedHours = 0;

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

      const before = calculateBeachScore(beach, slice, undefined, undefined, opts);
      scored += 1;

      // Η ΙΔΙΑ Η ΕΦΑΡΜΟΓΗ ΛΕΕΙ «δεν έρχεται»: undefined σημαίνει onshore ≤ 0,3 ΜΕ πλήρη γεωμετρία.
      // Το 'unknown' (τυφλότητα) ΔΕΝ πιάνεται εδώ — σκόπιμα, ίδια αρχή με τη βίβλο 20/08.
      if (before.seaArrivalExposureLevel !== undefined) continue;
      // Παίρνει ήδη την έκπτωση; τότε δεν έχει τι να κερδίσει.
      if (before.exposureLevel === 'protected') continue;
      const shown = before.shoreDisplayWaveM;
      if (typeof shown !== 'number' || shown < 0.15) continue;

      const waveDirectionDeg = slice.marine?.waveDirectionDeg;
      if (typeof waveDirectionDeg !== 'number' || !Number.isFinite(waveDirectionDeg)) continue;
      const onshore = Math.cos(((waveDirectionDeg - facingDeg) * Math.PI) / 180);

      const applies = VARIANTS.filter(v => onshore <= v.maxOnshore && v.levels.includes(before.exposureLevel));
      if (applies.length === 0) continue;
      qualifiedHours += 1;

      waveCharacter.shoreSeaStateM = forceDiscount;
      const after = calculateBeachScore(beach, slice, undefined, undefined, opts);
      waveCharacter.shoreSeaStateM = realShoreSeaStateM;

      if (before.shoreDisplayWaveM === after.shoreDisplayWaveM
        && before.swimmingComfort === after.swimmingComfort) continue;

      rows.push({
        id: beach.id, region: region.id,
        name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
        hour, facingDeg, waveDirectionDeg, onshore: Number(onshore.toFixed(3)),
        level: before.exposureLevel,
        waveBefore: before.shoreDisplayWaveM, waveAfter: after.shoreDisplayWaveM,
        comfortBefore: before.swimmingComfort, comfortAfter: after.swimmingComfort,
        crossedAvoid: (before.swimmingComfort === 'avoid_swimming') !== (after.swimmingComfort === 'avoid_swimming'),
        variants: applies.map(v => v.key),
      });
    }
  }
  process.stdout.write(`\r  ${region.id.padEnd(42)} βαθμολογηθηκαν ${scored}`);
}
console.log('');

// ─── ΠΥΛΕΣ ΕΓΚΥΡΟΤΗΤΑΣ ΤΗΣ ΙΔΙΑΣ ΤΗΣ ΜΕΤΡΗΣΗΣ ───────────────────────────────────────────────
// «Μέτρηση που δεν μέτρησε τίποτα είναι ψέμα» — ίδιες πύλες με measureDepartingSeaVerdictImpact.
const MIN_SCORED = 20000;
if (scored < MIN_SCORED) {
  console.error(`\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: βαθμολογηθηκαν μονο ${scored} συνδυασμοι (ελαχιστο ${MIN_SCORED}).`);
  process.exit(1);
}
// ΘΕΤΙΚΟΙ ΜΑΡΤΥΡΕΣ: οι ΔΥΟ παραλίες που γέννησαν τη μέτρηση πρέπει να πιάνονται από το
// ΑΥΣΤΗΡΟΤΕΡΟ παράθυρο. Αν δεν πιάνονται, η καλωδίωση είναι σπασμένη — όχι το εύρημα.
for (const witness of [680, 636]) {
  const hit = rows.filter(r => r.id === witness && r.variants.includes('A0') && r.waveAfter < r.waveBefore);
  if (hit.length === 0) {
    console.error(`\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: ο μαρτυρας #${witness} δεν αλλαξε σε καμια ωρα στο παραθυρο A0.`);
    process.exit(1);
  }
  console.log(`θετικος μαρτυρας #${witness}: ${hit.length} ωρες αλλαζουν OK`);
}

console.log(`\nβαθμολογησεις (παραλια x ωρα)      ${scored}`);
console.log(`ωρες που πληρουν εστω ενα παραθυρο ${qualifiedHours}`);
console.log(`\n${'παραθυρο'.padEnd(36)} ${'ωρες'.padStart(6)} ${'παραλιες'.padStart(9)} ${'διαμ.'.padStart(7)} ${'μεγ.'.padStart(6)} ${'ανεση'.padStart(7)} ${'AVOID'.padStart(6)}`);
console.log('-'.repeat(84));

const summary = {};
for (const v of VARIANTS) {
  const vr = rows.filter(r => r.variants.includes(v.key));
  const drops = vr.map(r => Number((r.waveBefore - r.waveAfter).toFixed(2))).sort((a, b) => a - b);
  const beaches = new Set(vr.map(r => `${r.region}#${r.id}`));
  const comfort = vr.filter(r => r.comfortBefore !== r.comfortAfter).length;
  const avoid = vr.filter(r => r.crossedAvoid).length;
  const median = drops.length ? drops[Math.floor(drops.length / 2)] : 0;
  const max = drops.length ? drops[drops.length - 1] : 0;
  summary[v.key] = {
    label: v.label, beachHours: vr.length, beaches: beaches.size,
    dropMedian: median, dropMax: max, comfortChanged: comfort, crossedAvoid: avoid,
  };
  console.log(`${(v.key + ' ' + v.label).padEnd(36)} ${String(vr.length).padStart(6)} ${String(beaches.size).padStart(9)} ${String(median).padStart(7)} ${String(max).padStart(6)} ${String(comfort).padStart(7)} ${String(avoid).padStart(6)}`);
}
console.log('\nAVOID = περνaει το οριο «μην κολυμπησεις» = ΣΙΓΟΥΡΗ αλλαγη χρωματος, προς το ηρεμοτερο.');

const witnesses = rows.filter(r => r.id === 680 || r.id === 636).sort((a, b) => a.id - b.id || a.hour - b.hour);
console.log('\nΟΙ ΔΥΟ ΠΟΥ ΤΟ ΓΕΝΝΗΣΑΝ:');
witnesses.forEach(r => console.log(`  #${r.id} ${r.name.padEnd(13)} ${String(r.hour).padStart(2)}:00  `
  + `κυμα απο ${String(Math.round(r.waveDirectionDeg)).padStart(3)} onshore ${String(r.onshore).padStart(6)} ${r.level.padEnd(8)} `
  + `${String(r.waveBefore).padStart(4)} -> ${String(r.waveAfter).padStart(4)} μ.  [${r.variants.join(',')}]`));

mkdirSync(path.join(root, 'reports/weather'), { recursive: true });
const out = path.join(root, 'reports/weather/grazing-sea-impact-live.json');
writeFileSync(out, JSON.stringify({
  measuredAt: new Date().toISOString(), scored, qualifiedHours,
  variants: VARIANTS, summary, rows,
}, null, 2), 'utf8');
console.log(`\nγραφτηκε ${path.relative(root, out)}`);
