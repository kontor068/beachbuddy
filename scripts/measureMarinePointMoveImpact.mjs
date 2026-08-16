#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΓΙΑ ΤΟΝ ΕΠΙΣΚΕΠΤΗ ΑΝ ΜΕΤΑΚΙΝΗΘΕΙ ΤΟ ΣΗΜΕΙΟ ΟΠΟΥ ΡΩΤΑΜΕ ΓΙΑ ΤΟ ΚΥΜΑ.
 *
 * ΓΙΑΤΙ. Στον φάκελο εργασίας υπήρχε εθνική αλλαγή: 46 παραλίες μετακινούν το `marineSamplePoint`
 * τους (διάμεσος 3,28 χλμ, μέγιστο 7,96 χλμ· μέση απόσταση από την ακτή 6,7 → 5,6 χλμ), από
 * scripts/buildMarineSamplePoints.mjs + scripts/optimiseMarineSamplePoints.mjs. Κρατήθηκε πίσω
 * στο commit cfaf9166 επειδή ΔΕΝ είχε μετρηθεί: αλλάζει τον αριθμό κύματος εθνικά, και ο αριθμός
 * κύματος φτάνει στην ετυμηγορία και στο χρώμα της πινέζας.
 *
 * Τα utils/waveCharacter.ts και utils/geometricWaveCeiling.ts της ίδιας δουλειάς ελέγχθηκαν
 * ξεχωριστά: αφαιρώντας σχόλια είναι ΠΑΝΟΜΟΙΟΤΥΠΑ με το HEAD (διόρθωση χαλασμένων ελληνικών),
 * άρα δεν χρειάζονται μέτρηση.
 *
 * ΠΩΣ. Τρέχει τον ΠΡΑΓΜΑΤΙΚΟ calculateBeachScore δύο φορές πάνω στον ΙΔΙΟ ζωντανό άνεμο: μία με
 * τη θάλασσα του ΠΑΛΙΟΥ σημείου (και το παλιό προφίλ) και μία με τη θάλασσα του ΝΕΟΥ. Καμία
 * λογική δεν αντιγράφεται.
 *
 * ΔΥΟ ΦΡΑΓΜΟΙ, από τα μαθήματα της ίδιας μέρας: ελάχιστο πλήθος βαθμολογήσεων, και ΘΕΤΙΚΟΣ
 * ΜΑΡΤΥΡΑΣ — αν καμία από τις μετακινημένες δεν αλλάξει ούτε στο δεύτερο δεκαδικό, η μέτρηση
 * αυτοακυρώνεται αντί να αναφέρει «καμία επίπτωση».
 *
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" \
 *     node scripts/measureMarinePointMoveImpact.mjs
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);
const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

const R = 6371, tr = d => (d * Math.PI) / 180;
const distKm = (a, b, c, e) => {
  const dLa = tr(c - a), dLo = tr(e - b);
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(tr(a)) * Math.cos(tr(c)) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// ── ποιες παραλίες μετακίνησαν σημείο, και ποια ήταν τα δύο σημεία ──────────────────────────
const moved = [];
for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json')) continue;
  const region = file.replace('.json', '');
  let head;
  try { head = JSON.parse(execSync(`git show HEAD:public/data/geospatial/exposure/${file}`, { encoding: 'utf8', maxBuffer: 1e9 })); }
  catch { continue; }
  const now = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  // Ο φάκελος έκθεσης έχει και αρχεία που δεν είναι περιοχές (index.json) — αγνοούνται σιωπηλά
  // ΜΟΝΟ εδώ, όπου η απουσία summary σημαίνει «δεν είναι περιοχή», ποτέ στη μέτρηση.
  let island;
  try { island = JSON.parse(readFileSync(path.join(summaryDir, file), 'utf8')).island; } catch { continue; }
  if (!island?.beaches?.length) continue;
  for (const [id, np] of Object.entries(now.profiles || {})) {
    const op = (head.profiles || {})[id];
    if (!op?.marineSamplePoint || !np.marineSamplePoint) continue;
    const a = op.marineSamplePoint, b = np.marineSamplePoint;
    if (a.lat === b.lat && a.lon === b.lon) continue;
    const beach = island.beaches.find(x => x.id === Number(id));
    if (!beach) continue;
    moved.push({
      id: Number(id), region, beach, oldProfile: op, newProfile: np,
      km: distKm(a.lat, a.lon, b.lat, b.lon),
      name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || ''),
      islandBeaches: island.beaches,
    });
  }
}
console.log(`παραλίες που μετακινούν σημείο κύματος: ${moved.length}`);
if (!moved.length) { console.error('ΑΚΥΡΗ: δεν βρέθηκε καμία μετακίνηση — δεν υπάρχει τι να μετρηθεί.'); process.exit(1); }

// ── ζωντανά δεδομένα ────────────────────────────────────────────────────────────────────────
const byRegion = new Map();
for (const m of moved) {
  if (!byRegion.has(m.region)) byRegion.set(m.region, []);
  byRegion.get(m.region).push(m);
}

const rows = [];
let scored = 0, numberChanged = 0, comfortChanged = 0, avoidCrossed = 0;

for (const [region, items] of byRegion) {
  const clusters = buildBeachForecastClusters(items[0].islandBeaches);
  let windByPoint;
  try { windByPoint = await fetchForecastDataBatch(clusters.map(c => ({ lat: c.lat, lon: c.lon }))); }
  catch (e) { console.log(`  ${region}: άνεμος απέτυχε`); continue; }

  const pts = [];
  for (const m of items) { pts.push(m.oldProfile.marineSamplePoint, m.newProfile.marineSamplePoint); }
  let marineByPoint = new Map();
  try { marineByPoint = await fetchMarineForecastDataBatch(pts.map(p => ({ lat: p.lat, lon: p.lon }))); } catch { /* κενό */ }

  for (const m of items) {
    const cluster = clusters.find(c => c.beachIds.includes(m.id));
    const wind = cluster && windByPoint.get(forecastPointKey(cluster.lat, cluster.lon));
    if (!wind?.data) continue;
    const oldSea = marineByPoint.get(forecastPointKey(m.oldProfile.marineSamplePoint.lat, m.oldProfile.marineSamplePoint.lon))?.data ?? [];
    const newSea = marineByPoint.get(forecastPointKey(m.newProfile.marineSamplePoint.lat, m.newProfile.marineSamplePoint.lon))?.data ?? [];
    if (!oldSea.length || !newSea.length) continue;

    const daysOld = processForecastData(mergeMarineForecastData(wind.data, oldSea));
    const daysNew = processForecastData(mergeMarineForecastData(wind.data, newSea));
    const dOld = daysOld?.[0], dNew = daysNew?.[0];
    if (!dOld?.hourly || !dNew?.hourly) continue;

    for (const hour of HOURS) {
      if (!dOld.hourly[hour] || !dNew.hourly[hour]) continue;
      const before = calculateBeachScore(m.beach, { ...dOld, ...dOld.hourly[hour], hourly: dOld.hourly }, undefined, undefined,
        { weatherSource: 'beach-cluster', hourlyForecast: dOld.hourly, geospatialProfile: m.oldProfile });
      const after = calculateBeachScore(m.beach, { ...dNew, ...dNew.hourly[hour], hourly: dNew.hourly }, undefined, undefined,
        { weatherSource: 'beach-cluster', hourlyForecast: dNew.hourly, geospatialProfile: m.newProfile });
      scored += 1;

      const waveMoved = before.shoreDisplayWaveM !== after.shoreDisplayWaveM;
      const comfortMoved = before.swimmingComfort !== after.swimmingComfort;
      if (!waveMoved && !comfortMoved) continue;
      if (waveMoved) numberChanged += 1;
      if (comfortMoved) comfortChanged += 1;
      const crossed = (before.swimmingComfort === 'avoid_swimming') !== (after.swimmingComfort === 'avoid_swimming');
      if (crossed) avoidCrossed += 1;
      rows.push({
        id: m.id, name: m.name, region, hour, km: m.km,
        waveBefore: before.shoreDisplayWaveM, waveAfter: after.shoreDisplayWaveM,
        comfortBefore: before.swimmingComfort, comfortAfter: after.swimmingComfort, crossed,
      });
    }
  }
  process.stdout.write(`\r  ${region.padEnd(42)} βαθμολογήθηκαν ${scored}`);
}
console.log('');

const MIN_SCORED = 300;
if (scored < MIN_SCORED) {
  console.error(`\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: μόνο ${scored} βαθμολογήσεις (ελάχιστο ${MIN_SCORED}).`);
  process.exit(1);
}
if (rows.length === 0) {
  console.error('\nΑΚΥΡΗ ΜΕΤΡΗΣΗ: καμία παραλία δεν άλλαξε ούτε στο δεύτερο δεκαδικό.');
  console.error('Μετακίνηση σημείου κατά χιλιόμετρα ΠΡΕΠΕΙ να αλλάξει κάτι — η καλωδίωση είναι σπασμένη.');
  process.exit(1);
}

const distinct = new Set(rows.map(r => r.id));
const deltas = rows.filter(r => typeof r.waveBefore === 'number' && typeof r.waveAfter === 'number')
  .map(r => r.waveAfter - r.waveBefore).sort((a, b) => a - b);
const q = p => (deltas.length ? deltas[Math.min(deltas.length - 1, Math.floor(p * deltas.length))] : 0);

console.log(`\n============ ΕΠΙΠΤΩΣΗ ΤΗΣ ΜΕΤΑΚΙΝΗΣΗΣ ΣΗΜΕΙΟΥ ============`);
console.log(`παραλίες που μετακινούν σημείο            ${moved.length}`);
console.log(`βαθμολογήσεις (παραλία × ώρα, δύο φορές)  ${scored}`);
console.log(`αλλάζει ο ΑΡΙΘΜΟΣ                         ${numberChanged}  (${distinct.size} παραλίες)`);
console.log(`αλλάζει η ΕΤΥΜΗΓΟΡΙΑ                      ${comfortChanged}`);
console.log(`ΠΕΡΝΑΕΙ ΤΟ ΟΡΙΟ «μην κολυμπήσεις»          ${avoidCrossed}`);
if (deltas.length) {
  console.log(`\nΜΕΤΑΒΟΛΗ ΑΡΙΘΜΟΥ (μ.): p10 ${q(0.1).toFixed(2)} · διάμεσος ${q(0.5).toFixed(2)} · p90 ${q(0.9).toFixed(2)}`);
  console.log(`  πιο ΗΡΕΜΟ: ${deltas.filter(d => d < 0).length} · πιο ΑΓΡΙΟ: ${deltas.filter(d => d > 0).length}`);
}
const verdicts = rows.filter(r => r.comfortBefore !== r.comfortAfter);
if (verdicts.length) {
  console.log('\nΚΑΘΕ ΑΛΛΑΓΗ ΕΤΥΜΗΓΟΡΙΑΣ:');
  verdicts.slice(0, 25).forEach(r => console.log(`  #${String(r.id).padEnd(5)} ${r.name.slice(0, 20).padEnd(21)} ${String(r.hour).padStart(2)}:00  `
    + `${r.waveBefore} → ${r.waveAfter} μ.  ·  ${r.comfortBefore} → ${r.comfortAfter}${r.crossed ? '  ⚠ ΧΡΩΜΑ' : ''}`));
  if (verdicts.length > 25) console.log(`  ... και άλλες ${verdicts.length - 25}`);
}

mkdirSync(path.join(root, 'reports/marine-point-move'), { recursive: true });
writeFileSync(path.join(root, 'reports/marine-point-move/impact.json'),
  JSON.stringify({ measuredAt: new Date().toISOString(), movedBeaches: moved.length, scored, numberChanged, comfortChanged, avoidCrossed, rows }, null, 2), 'utf8');
console.log('\nγράφτηκε reports/marine-point-move/impact.json');
