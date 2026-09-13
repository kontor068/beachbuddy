#!/usr/bin/env node
/**
 * Δ9-Α — ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΟΘΟΝΗ ΑΝ ΤΑ 98 ΚΕΛΙΑ ΠΙΣΩ ΑΠΟ ΒΟΥΝΟ ΠΑΡΟΥΝ ΤΟ ΕΝΑΛΛΑΚΤΙΚΟ ΤΟΥΣ (13/09/2026).
 *
 * Μέτρηση ΠΡΙΝ το ψήσιμο, με το ledger εφαρμοσμένο στη μνήμη. Αναπαράγει την παραγωγή όπως το
 * hooks/useWeather.ts: ομάδες στεριάς (`buildBeachForecastClusters`), veto ανά περιοχή
 * (`anyHourReachesOverWaterMinimum` στον άνεμο ΣΤΕΡΙΑΣ — άρα ίδιο και στις δύο εκδοχές),
 * ΕΝΑ αίτημα ανά κελί νερού μέσω του ΠΡΑΓΜΑΤΙΚΟΥ `fetchOverWaterWindBatch` (με τον έλεγχο echo 0,2°
 * του service — αν ένα νέο κελί δεν γυρίσει, θα το δούμε ΕΔΩ και όχι σιωπηλά στον χρήστη),
 * `applyOverWaterWindToDays` ανά παραλία, και μετά η αληθινή μηχανή `calculateBeachScore`.
 *
 * Δύο εκδοχές ανά παραλία: Α = το ψημένο κελί σήμερα, Β = το κελί του ledger (ίδιο με το Α για όποια
 * παραλία δεν είναι στο ledger). Πληθυσμός: οι παραλίες του ledger + όσες μοιράζονται τα παλιά ή τα νέα
 * κελιά — αυτές είναι η ενσωματωμένη ομάδα ελέγχου (πρέπει να μη κουνηθούν καθόλου).
 *
 * Κριτήρια (γραμμένα πριν τρέξει — βίβλος §Γ81 Δ9-Γ):
 *   P1 μηδέν αλλαγές έξω από τις παραλίες του ledger·
 *   P2 κάθε νέο κελί επιστρέφει από το service (κανένα «skipped» 0,2°)·
 *   P3 φυσική συνέπεια: στις ώρες ≥3 Μπφ το νέο κελί δίνει άνεμο πάνω από νερό που βλέπει η παραλία
 *      τουλάχιστον όσο το παλιό, και η ταχύτητα κατά μέσο όρο ίση ή πιο δυνατή (το κελί στη σκιά του
 *      βουνού υπο-δείχνει)· αν ≥60% των αλλαγμένων ωρών πάει ΠΙΟ ΗΡΕΜΑ, η υπόθεση είναι λάθος → στοπ·
 *   P4 το veto περιοχής δεν αλλάζει (διαβάζει στεριά)·
 *   P5 κάθε ΠΙΟ ΗΡΕΜΗ ετυμηγορία στους 98, με όνομα.
 *
 *   node scripts/measureSeaWindCellSwap.mjs [--ledger data/sea-wind-cell-overrides.json] [--days 0,1]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';
import { interpolatedFetchKm, bearingGapDeg } from './lib/marineCellTrust.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
const openMeteoKey = await resolveOpenMeteoKey();
const PAID_HOST = { 'https://api.open-meteo.com': 'https://customer-api.open-meteo.com', 'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com' };
if (openMeteoKey) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url === 'string') for (const [free, paid] of Object.entries(PAID_HOST)) if (url.startsWith(free)) return originalFetch(`${paid}${url.slice(free.length)}&apikey=${encodeURIComponent(openMeteoKey)}`, init);
    return originalFetch(input, init);
  };
}
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) { module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.trackEvent = function () {};\n', filename); return; }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React }, fileName: filename }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { applyOverWaterWindToDays, anyHourReachesOverWaterMinimum, OVER_WATER_MIN_BEAUFORT } = require(path.join(root, 'utils/overWaterWind.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, fetchOverWaterWindBatch, mergeMarineForecastData, forecastPointKey } = require(path.join(root, 'services/weatherService.ts'));

const argVal = (name, fallback) => { const i = process.argv.indexOf(name); return i === -1 || !process.argv[i + 1] ? fallback : process.argv[i + 1]; };
const ledgerPath = argVal('--ledger', 'data/sea-wind-cell-overrides.json');
const DAYS = argVal('--days', '0,1').split(',').map(Number);
const today = new Date().toISOString().slice(0, 10);
const outPath = argVal('--out', `reports/quality/sea-wind-cell-swap-${today}.json`);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null);

const ledger = JSON.parse(readFileSync(path.resolve(root, ledgerPath), 'utf8'));
const overrideById = new Map((ledger.overrides ?? []).map(o => [o.beachId, o]));
const excludedCells = new Set((ledger.overrides ?? []).map(o => o.excludedCell));
const chosenCells = new Set((ledger.overrides ?? []).map(o => o.chosenCell));
const seaMap = JSON.parse(readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8')).cells ?? {};
const bakedLand = JSON.parse(readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells ?? {};
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

// ── Πληθυσμός και περιοχές ────────────────────────────────────────────────────────────────
const regions = new Map();
for (const rf of readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let app; try { app = JSON.parse(readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const beaches = (app.island?.beaches ?? []).filter(b => Number.isFinite(b.coordinates?.lat) && Number.isFinite(b.coordinates?.lon));
  const profiles = {};
  try { for (const p of Object.values(JSON.parse(readFileSync(path.join(expDir, rf), 'utf8')).profiles ?? {})) if (p?.beachId != null) profiles[p.beachId] = p; } catch { /* χωρίς προφίλ */ }
  const population = beaches.filter(b => overrideById.has(b.id) || excludedCells.has(seaMap[String(b.id)]) || chosenCells.has(seaMap[String(b.id)]));
  if (!population.length) continue;
  regions.set(regionId, { regionId, beaches, profiles, regionPoint: app.island?.coordinates, population });
}
const populationSize = [...regions.values()].reduce((s, r) => s + r.population.length, 0);
console.log(`Περιοχές ${regions.size} · παραλίες υπό μέτρηση ${populationSize} (ledger ${overrideById.size}, έλεγχος ${populationSize - overrideById.size}) · μέρες ${DAYS.join(',')}`);

// ── Ένα αίτημα ανά κελί νερού (παλιά + νέα), με το πραγματικό service ─────────────────────
const cellKeys = new Set();
for (const r of regions.values()) for (const b of r.population) { const cur = seaMap[String(b.id)]; if (cur) cellKeys.add(cur); const o = overrideById.get(b.id); if (o) cellKeys.add(o.chosenCell); }
const cellPoints = [...cellKeys].map(k => { const [lat, lon] = k.split('_').map(Number); return { key: k, lat, lon }; }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
console.log(`Κελιά νερού προς λήψη: ${cellPoints.length} (παλιά ${excludedCells.size} + νέα ${chosenCells.size} + κοινά)`);
const overWaterByCell = new Map();
const byPoint = await fetchOverWaterWindBatch(cellPoints.map(p => ({ lat: p.lat, lon: p.lon })));
for (const p of cellPoints) { const e = byPoint.get(forecastPointKey(p.lat, p.lon)); if (e?.data) overWaterByCell.set(p.key, e.data); }
const missingChosen = [...chosenCells].filter(k => !overWaterByCell.has(k));
const missingCurrent = [...excludedCells].filter(k => !overWaterByCell.has(k));
console.log(`Επέστρεψαν ${overWaterByCell.size}/${cellPoints.length} κελιά · νέα που ΛΕΙΠΟΥΝ: ${missingChosen.length} · παλιά που λείπουν: ${missingCurrent.length}`);

// ── Ανά περιοχή: στεριά, θάλασσα, veto, δύο εκδοχές, μηχανή ───────────────────────────────
const rows = [];
const regionNotes = [];
let done = 0;
for (const region of regions.values()) {
  try {
    const withCells = region.beaches.map(b => ({ ...b, forecastCell: b.forecastCell || bakedLand[String(b.id)] })).filter(b => b.forecastCell);
    const clusters = buildBeachForecastClusters(withCells);
    const clusterOfBeach = new Map();
    for (const c of clusters) for (const id of c.beachIds) clusterOfBeach.set(id, c);
    const needed = new Map();
    for (const b of region.population) { const c = clusterOfBeach.get(b.id); if (c) needed.set(c.key, c); }
    const clusterPoints = [...needed.values()].map(c => ({ lat: c.lat, lon: c.lon }));
    const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch(clusterPoints), fetchMarineForecastDataBatch(resolution.points)]);
    // Το veto της παραγωγής κρίνεται σε ΟΛΕΣ τις ομάδες της περιοχής (στεριά)· εδώ έχουμε μόνο τις ομάδες του
    // πληθυσμού. Αν αυτές δεν φτάνουν το όριο, ζητάμε και τις υπόλοιπες πριν πούμε «σβηστό».
    let vetoPassed = [...needed.values()].some(c => anyHourReachesOverWaterMinimum(windByPoint.get(forecastPointKey(c.lat, c.lon))?.data));
    if (!vetoPassed) {
      const rest = clusters.filter(c => !needed.has(c.key)).map(c => ({ lat: c.lat, lon: c.lon }));
      if (rest.length) { const more = await fetchForecastDataBatch(rest); vetoPassed = [...more.values()].some(e => anyHourReachesOverWaterMinimum(e?.data)); }
    }
    regionNotes.push({ region: region.regionId, population: region.population.length, vetoPassed });
    for (const b of region.population) {
      const cluster = clusterOfBeach.get(b.id);
      const wind = cluster && windByPoint.get(forecastPointKey(cluster.lat, cluster.lon));
      if (!wind?.data) { rows.push({ beachId: b.id, region: region.regionId, skipped: 'χωρίς άνεμο ομάδας' }); continue; }
      const marineKey = resolution.keyByBeachId.get(b.id) ?? marinePointKey(region.regionPoint.lat, region.regionPoint.lon);
      const marineItems = marineByPoint.get(marineKey)?.data ?? [];
      const forecast = processForecastData(mergeMarineForecastData(wind.data, marineItems));
      const currentCell = seaMap[String(b.id)] ?? null;
      const override = overrideById.get(b.id) ?? null;
      const newCell = override ? override.chosenCell : currentCell;
      const A = vetoPassed ? applyOverWaterWindToDays(forecast, overWaterByCell.get(currentCell ?? '')) : forecast;
      const B = vetoPassed ? applyOverWaterWindToDays(forecast, overWaterByCell.get(newCell ?? '')) : forecast;
      const profile = region.profiles[b.id];
      const row = { beachId: b.id, name: b.name?.en ?? String(b.id), region: region.regionId, inLedger: Boolean(override), currentCell, newCell, vetoPassed, days: {} };
      for (const d of DAYS) {
        const dayA = A[d], dayB = B[d];
        if (!dayA || !dayB) continue;
        const score = (day) => {
          const s = calculateBeachScore(b, day, undefined, undefined, { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: profile });
          return { comfort: s.swimmingComfort ?? null, score: num(s.swimmingScore, 0), colour: s.simpleWindSuitability?.suitabilityColor ?? null, exposure: s.exposureLevel ?? null, sector: s.windSector ?? null, windKmh: num((day.wind?.speed ?? 0) * 3.6, 1), windDeg: num(day.wind?.deg, 0), bft: getBeaufortLevel((day.wind?.speed ?? 0) * 3.6), shoreM: num(s.shoreDisplayWaveM), seaM: num(s.seaStateWaveM) };
        };
        const a = score(dayA), bb = score(dayB);
        // Φυσική συνέπεια ανά ώρα 10-18: ταχύτητα/κατεύθυνση παλιού vs νέου κελιού, και αν η κατεύθυνση
        // «βλέπει» νερό της παραλίας (fetch ≥ 2 χλμ στο προφίλ).
        const hours = [];
        (dayA.hourly ?? []).forEach((ha, i) => {
          const hb = dayB.hourly?.[i]; if (!hb) return;
          const hh = Number(String(ha.dt_txt ?? '').slice(11, 13)); if (!(hh >= 10 && hh <= 18)) return;
          const kA = (ha.wind?.speed ?? 0) * 3.6, kB = (hb.wind?.speed ?? 0) * 3.6;
          if (getBeaufortLevel(Math.max(kA, kB)) < OVER_WATER_MIN_BEAUFORT) return;
          const fA = interpolatedFetchKm(profile?.sectors ?? {}, ha.wind?.deg ?? 0), fB = interpolatedFetchKm(profile?.sectors ?? {}, hb.wind?.deg ?? 0);
          hours.push({ hh, kA: num(kA, 1), kB: num(kB, 1), dA: num(ha.wind?.deg, 0), dB: num(hb.wind?.deg, 0), seesA: Number.isFinite(fA) ? fA >= 2 : null, seesB: Number.isFinite(fB) ? fB >= 2 : null, gap: num(bearingGapDeg(ha.wind?.deg ?? 0, hb.wind?.deg ?? 0), 0) });
        });
        const changedHours = hours.filter(h => h.kA !== h.kB || h.dA !== h.dB);
        row.days[d] = {
          A: a, B: bb,
          changed: a.comfort !== bb.comfort || a.colour !== bb.colour || a.score !== bb.score || a.bft !== bb.bft || a.windDeg !== bb.windDeg,
          hoursCompared: hours.length, hoursChanged: changedHours.length,
          calmerHours: changedHours.filter(h => getBeaufortLevel(h.kB) < getBeaufortLevel(h.kA)).length,
          rougherHours: changedHours.filter(h => getBeaufortLevel(h.kB) > getBeaufortLevel(h.kA)).length,
          seesWaterA: hours.filter(h => h.seesA).length, seesWaterB: hours.filter(h => h.seesB).length,
          meanSpeedRatio: changedHours.length ? num(changedHours.reduce((s, h) => s + (h.kA ? h.kB / h.kA : 1), 0) / changedHours.length) : null,
          meanGapDeg: changedHours.length ? num(changedHours.reduce((s, h) => s + h.gap, 0) / changedHours.length, 0) : null,
        };
      }
      rows.push(row);
    }
  } catch (e) { regionNotes.push({ region: region.regionId, error: String(e.message) }); }
  done += 1; process.stderr.write(`\r  περιοχές ${done}/${regions.size}   `);
  await sleep(200);
}
process.stderr.write('\n');

// ── Κριτήρια ─────────────────────────────────────────────────────────────────────────────
const ORDER = { excellent: 3, good: 2, caution: 1, avoid_swimming: 0 };
const COLOUR = { blue: 3, green: 2, yellow: 1, orange: 0, red: -1 };
const perDay = {};
for (const d of DAYS) {
  const p = perDay[d] = { ledger: 0, ledgerChanged: 0, controlChanged: 0, verdictSofter: [], verdictStricter: [], colourCalmer: [], colourRougher: [], bftUp: 0, bftDown: 0, calmerHours: 0, rougherHours: 0, seesWaterA: 0, seesWaterB: 0, hoursCompared: 0, vetoOff: 0 };
  for (const r of rows) {
    const dd = r.days?.[d]; if (!dd) continue;
    if (!r.vetoPassed) { if (r.inLedger) p.vetoOff += 1; }
    if (!r.inLedger) { if (dd.changed) p.controlChanged += 1; continue; }
    p.ledger += 1; if (dd.changed) p.ledgerChanged += 1;
    const tag = `#${r.beachId} ${r.name} (${r.region}) ${d === 0 ? 'σήμερα' : `+${d}`}`;
    if (ORDER[dd.B.comfort] > ORDER[dd.A.comfort]) p.verdictSofter.push(`${tag}: ${dd.A.comfort} → ${dd.B.comfort}`);
    if (ORDER[dd.B.comfort] < ORDER[dd.A.comfort]) p.verdictStricter.push(`${tag}: ${dd.A.comfort} → ${dd.B.comfort}`);
    if (COLOUR[dd.B.colour] > COLOUR[dd.A.colour]) p.colourCalmer.push(`${tag}: ${dd.A.colour} → ${dd.B.colour}`);
    if (COLOUR[dd.B.colour] < COLOUR[dd.A.colour]) p.colourRougher.push(`${tag}: ${dd.A.colour} → ${dd.B.colour}`);
    if (dd.B.bft > dd.A.bft) p.bftUp += 1; if (dd.B.bft < dd.A.bft) p.bftDown += 1;
    p.calmerHours += dd.calmerHours; p.rougherHours += dd.rougherHours; p.seesWaterA += dd.seesWaterA; p.seesWaterB += dd.seesWaterB; p.hoursCompared += dd.hoursCompared;
  }
}
const totalChangedHours = Object.values(perDay).reduce((s, p) => s + p.calmerHours + p.rougherHours, 0);
const calmerShare = totalChangedHours ? Object.values(perDay).reduce((s, p) => s + p.calmerHours, 0) / totalChangedHours : 0;
const criteria = {
  P1_noControlChange: Object.values(perDay).every(p => p.controlChanged === 0),
  P2_allChosenCellsReturned: missingChosen.length === 0,
  P3_physicallyConsistent: Object.values(perDay).every(p => p.seesWaterB >= p.seesWaterA) && calmerShare < 0.6,
  P3_calmerHourShare: num(calmerShare, 3),
  P4_vetoLandOnly: true,
  P5_softerVerdicts: Object.values(perDay).reduce((s, p) => s + p.verdictSofter.length, 0),
};
mkdirSync(path.dirname(path.resolve(root, outPath)), { recursive: true });
writeFileSync(path.resolve(root, outPath), JSON.stringify({ generatedAt: new Date().toISOString(), ledger: ledgerPath, days: DAYS, population: populationSize, ledgerBeaches: overrideById.size, cellsFetched: cellPoints.length, cellsReturned: overWaterByCell.size, missingChosen, missingCurrent, criteria, perDay, regions: regionNotes, rows }, null, 2), 'utf8');

console.log(`\n=== Δ9-Α ΠΡΙΝ/ΜΕΤΑ (${populationSize} παραλίες, ${overrideById.size} στο ledger) ===`);
for (const d of DAYS) {
  const p = perDay[d];
  console.log(`  ${d === 0 ? 'σήμερα' : `+${d}`}: ledger ${p.ledger} → άλλαξαν ${p.ledgerChanged} · έλεγχος άλλαξε ${p.controlChanged} · veto σβηστό για ${p.vetoOff} · Μπφ ↑${p.bftUp} ↓${p.bftDown} · ώρες ≥3 Μπφ ${p.hoursCompared}: πιο δυνατά ${p.rougherHours} / πιο ήρεμα ${p.calmerHours} · βλέπει νερό Α ${p.seesWaterA} → Β ${p.seesWaterB}`);
  console.log(`     ετυμηγορία αυστηρότερη ${p.verdictStricter.length} / ηπιότερη ${p.verdictSofter.length} · χρώμα προς προσοχή ${p.colourRougher.length} / προς ήρεμο ${p.colourCalmer.length}`);
  for (const s of p.verdictSofter.slice(0, 10)) console.log(`       ΗΠΙΟΤΕΡΗ: ${s}`);
  for (const s of p.verdictStricter.slice(0, 6)) console.log(`       αυστηρότερη: ${s}`);
}
console.log(`  Κριτήρια: ${JSON.stringify(criteria)}`);
if (missingChosen.length) console.log(`  ⚠️ νέα κελιά που ΔΕΝ γύρισαν από το service: ${missingChosen.join(', ')}`);
console.log(`Αναφορά: ${outPath}`);
