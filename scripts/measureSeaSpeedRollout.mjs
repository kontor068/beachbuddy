#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΟΘΟΝΗ ΟΤΑΝ Η ΤΑΧΥΤΗΤΑ ΕΡΘΕΙ ΑΠΟ ΤΟ ΝΕΡΟ — ΜΕ ΤΟΝ ΚΑΝΟΝΑ ΠΟΥ ΦΕΥΓΕΙ, ΟΧΙ ΜΕ ΠΡΟΧΕΙΡΟ.
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ (25/08/2026). Απόφαση Μίλτου: η ταχύτητα του θαλασσινού κελιού μπαίνει όπου το
 * στεριανό κελί απέχει ≥3 χλμ (§Γ51/§Γ52, ξανακριμένο την ίδια μέρα με τη σημερινή αποσυμπίεση:
 * `reports/weather/sea-cell-production-21d.json`). Το `measureSeaSpeedColourImpact.mjs` (21/08)
 * είχε μετρήσει το αποτύπωμα σε 150 παραλίες με ΑΛΛΟΝ κανόνα (θαλάσσια ριπή, κέντρα κελιών,
 * παλιός δάπεδος). Αυτό εδώ μετράει ΑΚΡΙΒΩΣ ό,τι φεύγει (utils/overWaterWind, 25/08):
 *
 *   Α (ως 25/08): ταχύτητα = στεριανό κελί μετά την αποσυμπίεση · ριπή στεριάς · διεύθυνση
 *                 θάλασσας από 3 Μπφ (κρινόμενα στη στεριανή ταχύτητα)
 *   Β (από 25/08): ταχύτητα = θαλασσινό κελί μετά τη θαλάσσια πόρτα του δαπέδου (υψόμετρο του
 *                 κελιού νερού) · ριπή ΣΤΕΡΙΑΣ (αμετάβλητη) · spread στον ωμό στεριανό μέσο ·
 *                 διεύθυνση θάλασσας από 3 Μπφ κρινόμενα στη ΘΑΛΑΣΣΙΑ ταχύτητα ·
 *                 ΜΟΝΟ σε παραλίες με seaWindCell, ΜΟΝΟ αν η περιοχή τους περνά τη φραγή
 *                 αιτήματος (κάποια ώρα ≥3 Μπφ στη στεριά — `anyHourReachesOverWaterMinimum`)
 *
 * Το στεριανό σκέλος ζητιέται στα ΣΗΜΕΙΑ ΔΕΙΓΜΑΤΟΛΗΨΙΑΣ των ομάδων της παραγωγής
 * (utils/beachForecastClusters), όχι στα κέντρα κελιών: το `elevation` της απάντησης — άρα το αν
 * θα εφαρμοστεί η αποσυμπίεση — εξαρτάται από το σημείο που ρωτάς, όχι από το κελί (18/08).
 *
 * ΚΑΝΟΝΕΣ ΓΡΑΜΜΕΝΟΙ ΠΡΙΝ ΤΡΕΞΕΙ (πλάνο 25/08):
 *   1. ROLLOUT: φεύγει ως έχει αν, όπου εφαρμόζεται, οι αλλαγές χρώματος προς πιο ΗΡΕΜΟ ≥ προς
 *      πιο ΑΓΡΙΟ, ΚΑΙ οι κάδοι ≥5 χλμ δεν αλλάζουν χρώμα ποσοστιαία πάνω από 1,5× τον κάδο 3-5
 *      (η μετρημένη ζώνη). Αλλιώς ο Μίλτος αποφασίζει με τον πίνακα — μοχλός: cap απόστασης.
 *   2. ΕΥΡΟΣ ΜΠΟΦΟΡ (utils/beaufortRange): επιλέγεται η παραλλαγή που ανάβει σε 5-15% των
 *      ωρών με τυπωμένο μέσο ≥3 Μπφ. Κάτω από 5% δεν αξίζει, πάνω από 15% είναι ταπετσαρία
 *      (§16: 52% = παντού). Η Νάξος #2017 είναι μάρτυρας, όχι κριτήριο.
 *
 * ΟΡΙΑ: κύμα ΜΟΝΤΕΛΟΠΟΙΗΜΕΝΟ με ουδέτερη θάλασσα (NEUTRAL_SEA_M), όρμοι χωρίς εξαίρεση → το
 * «χαμένο μπλε» είναι ταβάνι· μία ημερομηνία εκτέλεσης· ≥5 χλμ = προέκταση, όχι μέτρηση.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει `reports/weather/sea-speed-rollout-<ημερομηνία>.json`.
 *
 *   node scripts/measureSeaSpeedRollout.mjs [--days=6] [--limit=N] [--pace=13000]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { degToCompass, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { getWindChopWaveFloorM } = require(path.join(root, 'utils/waveModel.ts'));
const { capIdealByShoreSea } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { OVER_WATER_MIN_BEAUFORT } = require(path.join(root, 'utils/overWaterWind.ts'));
const { resolveBeaufortRange, BEAUFORT_RANGE_RULE } = require(path.join(root, 'utils/beaufortRange.ts'));

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const DAYS = Number(arg('days', '6'));
const LIMIT = Number(arg('limit', '0'));
const PACE_MS = Number(arg('pace', '13000'));
const DAY_START = 9;
const DAY_END = 19;
const GATE_KM = 3;
const NEUTRAL_SEA_M = 0.4;
const CHUNK = 100;

const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);
const pct = (n, d) => (d ? Math.round(10000 * n / d) / 100 : 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
};

// ── 1. ΠΑΡΑΛΙΕΣ, ΟΜΑΔΕΣ ΠΑΡΑΓΩΓΗΣ, ΚΕΛΙΑ ΝΕΡΟΥ ──────────────────────────────
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const bakedLand = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells;
const seaMap = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8'));

const beaches = [];      // { beach, regionId, lat, lon, landCell, seaCell, profile, clusterKey }
const clusterPoints = new Map(); // key → { lat, lon, regionId }
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const list = (payload.island?.beaches || []).filter(b => Number.isFinite(b.coordinates?.lat) && Number.isFinite(b.coordinates?.lon));
  if (!list.length) continue;
  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* περιοχή χωρίς γεωμετρία */ }
  // Ό,τι βλέπει το hooks/useWeather: η παραλία με το ψημένο στεριανό κελί της.
  const withCells = list.map(b => ({ ...b, forecastCell: b.forecastCell || bakedLand[String(b.id)] }));
  const clusters = buildBeachForecastClusters(withCells);
  const clusterOfBeach = new Map();
  for (const c of clusters) {
    clusterPoints.set(c.key, { lat: c.lat, lon: c.lon, regionId });
    for (const id of c.beachIds) clusterOfBeach.set(id, c.key);
  }
  for (const beach of withCells) {
    const clusterKey = clusterOfBeach.get(beach.id);
    if (!clusterKey || !beach.forecastCell) continue;
    beaches.push({
      beach, regionId, lat: beach.coordinates.lat, lon: beach.coordinates.lon,
      landCell: beach.forecastCell,
      seaCell: beach.seaWindCell || seaMap.cells?.[String(beach.id)] || null,
      profile: profiles[beach.id], clusterKey,
    });
  }
}
const sample = LIMIT ? beaches.filter((_, i) => i % Math.max(1, Math.floor(beaches.length / LIMIT)) === 0).slice(0, LIMIT) : beaches;
const clusterKeys = [...new Set(sample.map(b => b.clusterKey))];
const seaKeys = [...new Set(sample.map(b => b.seaCell).filter(Boolean))];
console.log(`Παραλίες: ${sample.length.toLocaleString('el-GR')} · ομάδες στεριάς: ${clusterKeys.length.toLocaleString('el-GR')} · κελιά νερού: ${seaKeys.length.toLocaleString('el-GR')} · ${DAYS} ημέρες, ώρες ${DAY_START}-${DAY_END}`);

// ── 2. ΤΑ ΔΥΟ ΣΚΕΛΗ ──────────────────────────────────────────────────────────
const VARS = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m';
const fetchArm = async (points, cellSelection) => {
  const out = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const c = points.slice(i, i + CHUNK);
    if (out.length) await sleep(PACE_MS);
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}`
      + `&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=${VARS}&forecast_days=${DAYS}&timezone=Europe%2FAthens&wind_speed_unit=kmh`
      + `&cell_selection=${cellSelection}`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`${cellSelection}: ${rows.length} για ${c.length}`);
    out.push(...rows);
    process.stdout.write(`\r  ${cellSelection}: ${out.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  return out;
};
const cacheDir = path.join(root, '.tmp');
fs.mkdirSync(cacheDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const cached = async (name, run) => {
  const f = path.join(cacheDir, `sea-speed-rollout-${name}-${DAYS}d-${today}${LIMIT ? `-l${LIMIT}` : ''}.json`);
  if (fs.existsSync(f)) { console.log(`  ${name}: από τον δίσκο`); return JSON.parse(fs.readFileSync(f, 'utf8')); }
  const rows = await run();
  fs.writeFileSync(f, JSON.stringify(rows));
  return rows;
};
const landPoints = clusterKeys.map(k => ({ key: k, ...clusterPoints.get(k) }));
const seaPoints = seaKeys.map(k => { const [lat, lon] = k.split('_').map(Number); return { key: k, lat, lon }; });
const landRows = await cached('land', () => fetchArm(landPoints, 'land'));
const seaRows = await cached('sea', () => fetchArm(seaPoints, 'sea'));

const series = r => ({
  time: r.hourly.time, speed: r.hourly.wind_speed_10m, dir: r.hourly.wind_direction_10m,
  gust: r.hourly.wind_gusts_10m, elevation: r.elevation, lat: r.latitude, lon: r.longitude,
});
const landByCluster = new Map(landPoints.map((p, i) => [p.key, series(landRows[i])]));
const seaByCell = new Map(seaPoints.map((p, i) => [p.key, series(seaRows[i])]));

// Η φραγή αιτήματος της παραγωγής: ανά ΠΕΡΙΟΧΗ, κάποια ώρα κάποιας ομάδας ≥3 Μπφ (στεριά, παραγωγή).
const regionPasses = new Map();
for (const p of landPoints) {
  const L = landByCluster.get(p.key);
  const passes = L.time.some((_, h) => {
    const v = applyGustFloor(L.speed[h], L.gust[h], L.elevation, 'kmh');
    return Number.isFinite(v) && getBeaufortLevel(v) >= OVER_WATER_MIN_BEAUFORT;
  });
  if (passes) regionPasses.set(p.regionId, true);
  else if (!regionPasses.has(p.regionId)) regionPasses.set(p.regionId, false);
}

// ── 3. Η ΜΕΤΡΗΣΗ ─────────────────────────────────────────────────────────────
const COLOUR_RANK = { blue: 0, yellow: 1, orange: 2, red: 3 };
const rank = c => (COLOUR_RANK[c] ?? 1);
const TONES = ['blue', 'yellow', 'orange', 'red'];

const assess = (b, deg, speedKmh, bft, gustKmh, rawMeanKmh) => {
  const a = assessBeachWindExposure({
    beach: b.beach, geospatialProfile: b.profile,
    windDirectionDeg: deg, windDirection: degToCompass(deg),
    windSpeedKmh: speedKmh, beaufort: bft, waveHeightMeters: NEUTRAL_SEA_M,
  });
  const pin = getVisibleMapExposureLevel({
    beach: b.beach, exposureLevel: a.exposureLevel, orientation: a.facingDeg,
    windProfile: a.windProfile, windProfileSource: a.source, windSector: a.windSector,
    warnings: a.warnings, geospatialExposure: b.profile,
  }, bft, deg);
  const damping = a.exposureLevel === 'protected' ? 0.5 : a.exposureLevel === 'partial' ? 0.75 : 1;
  const modelledWaveM = Number(Math.max(
    (a.modeledWaveHeightM || 0) * damping,
    getWindChopWaveFloorM(a.exposureLevel, bft, speedKmh, gustKmh, rawMeanKmh),
  ).toFixed(2));
  const colour = capIdealByShoreSea(a.simpleWindSuitability?.suitabilityColor, modelledWaveM, false);
  return { card: a.exposureLevel, colour, pin, sector: a.windSector, modelledWaveM };
};

const blank = () => ({
  hours: 0, colourChanged: 0, colourWorse: 0, colourBetter: 0,
  cardChanged: 0, pinChanged: 0, bftChanged: 0, bftUp: 0, bftDown: 0,
  toneA: Object.fromEntries(TONES.map(t => [t, 0])),
  toneB: Object.fromEntries(TONES.map(t => [t, 0])),
});
const total = blank();
const gatedOnly = blank();
const BUCKETS = [
  { key: '<3 χλμ', test: d => d < GATE_KM }, { key: '3-5 χλμ', test: d => d >= 3 && d < 5 },
  { key: '5-7 χλμ', test: d => d >= 5 && d < 7 }, { key: '≥7 χλμ', test: d => d >= 7 },
];
const byBucket = Object.fromEntries(BUCKETS.map(b => [b.key, blank()]));
const byBeaufortA = {};
const movers = [];
let hoursBehindFetchVeto = 0;
let beachesBehindFetchVeto = new Set();
let directionGateDisagreements = 0;
let mappedHours = 0;
let seaSpeedMissing = 0;

// Παραλλαγές εύρους Μποφόρ — ο ίδιος καθαρός κανόνας με την οθόνη, ανά παραλλαγή.
const RANGE_VARIANTS = {
  'R1 ριπή ≥1 σκαλί': { minBaseBeaufort: 0, maxStep: 1, minSpreadKmh: 0 },
  'R2 ριπή, cap +2': { minBaseBeaufort: 0, maxStep: 2, minSpreadKmh: 0 },
  'R3 spread ≥8': { minBaseBeaufort: 0, maxStep: 1, minSpreadKmh: 8 },
  'R3 spread ≥12': { minBaseBeaufort: 0, maxStep: 1, minSpreadKmh: 12 },
  'R3 spread ≥16': { minBaseBeaufort: 0, maxStep: 1, minSpreadKmh: 16 },
  'R3 spread ≥22': { minBaseBeaufort: 0, maxStep: 1, minSpreadKmh: 22 },
  'R4 μέσος ≥3': { minBaseBeaufort: 3, maxStep: 1, minSpreadKmh: 0 },
  'R4 μέσος ≥3 + spread ≥8': { minBaseBeaufort: 3, maxStep: 1, minSpreadKmh: 8 },
  'R4 μέσος ≥3 + spread ≥12': { minBaseBeaufort: 3, maxStep: 1, minSpreadKmh: 12 },
  'R4 μέσος ≥3 + spread ≥16': { minBaseBeaufort: 3, maxStep: 1, minSpreadKmh: 16 },
  'R4 μέσος ≥3 + spread ≥22': { minBaseBeaufort: 3, maxStep: 1, minSpreadKmh: 22 },
  // Ό,τι ισχύει στον κώδικα — `null` όσο το εύρος είναι απενεργό (απόφαση Μίλτου εκκρεμεί).
  ...(BEAUFORT_RANGE_RULE ? { 'ΣΤΑΘΕΡΕΣ ΚΩΔΙΚΑ (utils/beaufortRange)': BEAUFORT_RANGE_RULE } : {}),
};
const rangeStats = Object.fromEntries(Object.keys(RANGE_VARIANTS).map(k => [k, { firesA: 0, firesB: 0, firesB_base3: 0, stepsB: {} }]));
let rangeHours = 0;
let rangeHoursBase3 = 0;

sample.forEach(b => {
  const L = landByCluster.get(b.clusterKey);
  const S = b.seaCell ? seaByCell.get(b.seaCell) : null;
  if (!L?.time) return;
  const [cLat, cLon] = b.landCell.split('_').map(Number);
  const cellDist = distKm(b.lat, b.lon, cLat, cLon);
  const bucket = BUCKETS.find(x => x.test(cellDist))?.key;
  const mapped = Boolean(S?.time);
  const passes = regionPasses.get(b.regionId) === true;
  const applies = mapped && passes;
  if (mapped && !passes) beachesBehindFetchVeto.add(b.beach.id);
  const seaIdx = S ? new Map(S.time.map((t, k) => [t, k])) : null;
  let changed = 0, hrs = 0;

  for (let h = 0; h < L.time.length; h++) {
    const t = L.time[h];
    const hour = Number(t.slice(11, 13));
    if (hour < DAY_START || hour > DAY_END) continue;
    const lRaw = L.speed[h], lGust = L.gust[h], lDir = L.dir[h];
    if (![lRaw, lGust, lDir].every(Number.isFinite)) continue;
    const k = seaIdx?.get(t);
    const sRaw = k == null ? undefined : S.speed[k];
    const sGust = k == null ? undefined : S.gust[k];
    const sDir = k == null ? undefined : S.dir[k];
    if (mapped && !passes) hoursBehindFetchVeto += 1;
    if (applies && !Number.isFinite(sRaw)) seaSpeedMissing += 1;
    if (mapped) mappedHours += 1;

    // Α — η παραγωγή ως 25/08.
    const aSpeed = applyGustFloor(lRaw, lGust, L.elevation, 'kmh');
    const aBft = getBeaufortLevel(aSpeed);
    const aDir = (applies && Number.isFinite(sDir) && aBft >= OVER_WATER_MIN_BEAUFORT) ? sDir : lDir;
    // Β — ο κανόνας που φεύγει: θαλάσσια ταχύτητα με τη θαλάσσια πόρτα, ριπή στεριάς, διεύθυνση
    // κρινόμενη στο νούμερο που τυπώνεται.
    const bSpeed = (applies && Number.isFinite(sRaw)) ? applyGustFloor(sRaw, sGust, S.elevation ?? 0, 'kmh') : aSpeed;
    const bBft = getBeaufortLevel(bSpeed);
    const bDir = (applies && Number.isFinite(sDir) && bBft >= OVER_WATER_MIN_BEAUFORT) ? sDir : lDir;
    if (applies && ((aBft >= OVER_WATER_MIN_BEAUFORT) !== (bBft >= OVER_WATER_MIN_BEAUFORT))) directionGateDisagreements += 1;

    const A = assess(b, aDir, aSpeed, aBft, lGust, lRaw);
    const B = assess(b, bDir, bSpeed, bBft, lGust, lRaw);

    const targets = [total, byBucket[bucket]];
    if (applies) targets.push(gatedOnly);
    for (const tg of targets) {
      tg.hours += 1;
      tg.toneA[A.colour] = (tg.toneA[A.colour] ?? 0) + 1;
      tg.toneB[B.colour] = (tg.toneB[B.colour] ?? 0) + 1;
      if (aBft !== bBft) { tg.bftChanged += 1; if (bBft > aBft) tg.bftUp += 1; else tg.bftDown += 1; }
      if (A.card !== B.card) tg.cardChanged += 1;
      if (A.pin !== B.pin) tg.pinChanged += 1;
      if (A.colour !== B.colour) {
        tg.colourChanged += 1;
        if (rank(B.colour) > rank(A.colour)) tg.colourWorse += 1; else tg.colourBetter += 1;
      }
    }
    byBeaufortA[aBft] = byBeaufortA[aBft] || { hours: 0, colourChanged: 0, worse: 0, bftChanged: 0 };
    byBeaufortA[aBft].hours += 1;
    if (aBft !== bBft) byBeaufortA[aBft].bftChanged += 1;
    if (A.colour !== B.colour) { byBeaufortA[aBft].colourChanged += 1; if (rank(B.colour) > rank(A.colour)) byBeaufortA[aBft].worse += 1; }
    hrs += 1;
    if (A.colour !== B.colour) changed += 1;

    // Εύρος Μποφόρ: το άνω άκρο από τη ΣΤΕΡΙΑΝΗ ριπή της ώρας, spread στον ωμό στεριανό μέσο.
    rangeHours += 1;
    if (bBft >= 3) rangeHoursBase3 += 1;
    for (const [name, rule] of Object.entries(RANGE_VARIANTS)) {
      const st = rangeStats[name];
      if (resolveBeaufortRange({ speedKmh: aSpeed, gustKmh: lGust, spreadBaseKmh: lRaw }, rule)) st.firesA += 1;
      const rB = resolveBeaufortRange({ speedKmh: bSpeed, gustKmh: lGust, spreadBaseKmh: lRaw }, rule);
      if (rB) {
        st.firesB += 1;
        if (bBft >= 3) st.firesB_base3 += 1;
        const step = rB.high - rB.low;
        st.stepsB[step] = (st.stepsB[step] || 0) + 1;
      }
    }
  }
  if (changed) movers.push({
    id: b.beach.id, name: b.beach.name?.gr || b.beach.name?.en || `#${b.beach.id}`,
    region: b.regionId, cellDistKm: Math.round(cellDist * 100) / 100,
    hours: hrs, colourChanged: changed, changedPct: pct(changed, hrs),
  });
});

const shape = g => ({
  hours: g.hours,
  colourChangedPct: pct(g.colourChanged, g.hours),
  worse: g.colourWorse, better: g.colourBetter,
  beaufortChangedPct: pct(g.bftChanged, g.hours), beaufortUp: g.bftUp, beaufortDown: g.bftDown,
  cardChangedPct: pct(g.cardChanged, g.hours), pinChangedPct: pct(g.pinChanged, g.hours),
  toneBefore: Object.fromEntries(TONES.map(t => [t, `${g.toneA[t]} (${pct(g.toneA[t], g.hours)}%)`])),
  toneAfter: Object.fromEntries(TONES.map(t => [t, `${g.toneB[t]} (${pct(g.toneB[t], g.hours)}%)`])),
});
const applied = shape(gatedOnly);
const buckets = Object.fromEntries(Object.entries(byBucket).map(([k, v]) => [k, shape(v)]));
const ref = buckets['3-5 χλμ'].colourChangedPct;
const farBucketsOk = ['5-7 χλμ', '≥7 χλμ'].every(k => buckets[k].hours === 0 || buckets[k].colourChangedPct <= 1.5 * ref);
const calmerDominates = applied.better >= applied.worse;
const rolloutVerdict = calmerDominates && farBucketsOk
  ? 'ΦΕΥΓΕΙ ΩΣ ΕΧΕΙ: όπου εφαρμόζεται οι αλλαγές χρώματος είναι κυρίως προς πιο ήρεμο και οι κάδοι ≥5 χλμ δεν ξεφεύγουν από τη μετρημένη ζώνη.'
  : `ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ: ${calmerDominates ? '' : 'προς πιο άγριο > προς πιο ήρεμο· '}${farBucketsOk ? '' : `οι κάδοι ≥5 χλμ αλλάζουν χρώμα >1,5× τον κάδο 3-5 (${ref}%)· `}μοχλός: cap απόστασης στο fetchBeachForecastContexts.`;

const rangeTable = Object.fromEntries(Object.entries(rangeStats).map(([k, v]) => [k, {
  rule: RANGE_VARIANTS[k],
  firesPctAllHoursA: pct(v.firesA, rangeHours),
  firesPctAllHoursB: pct(v.firesB, rangeHours),
  firesPctOfBase3HoursB: pct(v.firesB_base3, rangeHoursBase3),
  inBand5to15: pct(v.firesB_base3, rangeHoursBase3) >= 5 && pct(v.firesB_base3, rangeHoursBase3) <= 15,
  stepDistributionB: v.stepsB,
}]));
const inBand = Object.entries(rangeTable).filter(([, v]) => v.inBand5to15).map(([k]) => k);

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Α = παραγωγή ως 25/08 (στεριανή ταχύτητα) · Β = ο κανόνας που φεύγει 25/08 (θαλάσσια ταχύτητα όπου seaWindCell, ριπή στεριάς, διεύθυνση στο τυπωμένο Μπφ, φραγή αιτήματος ανά περιοχή). Πόσο αλλάζει η οθόνη, και πόσο συχνά θα άναβε το εύρος «3–4 Μπφ»;',
  winRule: {
    rollout: 'better ≥ worse όπου εφαρμόζεται ΚΑΙ κάδοι ≥5 χλμ ≤ 1,5× τον κάδο 3-5 σε % αλλαγής χρώματος — γραμμένο πριν τρέξει (πλάνο 25/08).',
    beaufortRange: 'η παραλλαγή που ανάβει σε 5-15% των ωρών με τυπωμένο μέσο ≥3 Μπφ — γραμμένο πριν τρέξει (πλάνο 25/08).',
  },
  days: DAYS, beaches: sample.length, landClusters: clusterKeys.length, seaCells: seaKeys.length,
  fetchVeto: {
    regionsBlocked: [...regionPasses.entries()].filter(([, v]) => !v).map(([k]) => k),
    beachesBehind: beachesBehindFetchVeto.size,
    hoursBehind: hoursBehindFetchVeto,
    hoursBehindPctOfMapped: pct(hoursBehindFetchVeto, mappedHours),
  },
  directionGateDisagreements: { hours: directionGateDisagreements, pctOfApplied: pct(directionGateDisagreements, gatedOnly.hours) },
  seaSpeedMissingHours: seaSpeedMissing,
  total: shape(total),
  onlyWhereItApplies: applied,
  byLandCellDistance: buckets,
  byBeaufortBefore: Object.fromEntries(Object.entries(byBeaufortA).map(([k, v]) => [k, {
    hours: v.hours, beaufortChangedPct: pct(v.bftChanged, v.hours), colourChangedPct: pct(v.colourChanged, v.hours), worse: v.worse,
  }])),
  topMovers: movers.sort((a, b) => b.changedPct - a.changedPct).slice(0, 25),
  beachesTouched: movers.length,
  beaufortRangePrevalence: { hoursAll: rangeHours, hoursBase3: rangeHoursBase3, variants: rangeTable, inBand5to15: inBand },
  verdict: { rollout: rolloutVerdict, beaufortRange: inBand.length ? `Μέσα στη ζώνη 5-15%: ${inBand.join(' · ')}` : 'ΚΑΜΙΑ παραλλαγή στη ζώνη 5-15% — αποφασίζει ο Μίλτος.' },
  limits: [
    'Κύμα ΜΟΝΤΕΛΟΠΟΙΗΜΕΝΟ με ουδέτερη θάλασσα 0,40 μ. και χωρίς εξαίρεση όρμων — το χαμένο μπλε είναι ταβάνι.',
    'Μία ημερομηνία εκτέλεσης· ό,τι φυσάει σήμερα, όχι κλιματολογία.',
    'Πάνω από 5 χλμ κανένα αεροδρόμιο δεν έκρινε — οι κάδοι 5-7 και ≥7 δείχνουν αποτύπωμα, όχι ορθότητα.',
    'Η ριπή του εύρους είναι ριπή ΜΟΝΤΕΛΟΥ (στο 23% των ήρεμων ωρών φούσκα — §ΑΞ1/Α3).',
  ],
};

const outDir = path.join(root, 'reports', 'weather');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `sea-speed-rollout-${today}${LIMIT ? `-sample${LIMIT}` : ''}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

const show = (name, s) => {
  console.log(`\n${name} — ${s.hours.toLocaleString('el-GR')} παραλιο-ώρες`);
  console.log(`  Μποφόρ αλλάζει ${s.beaufortChangedPct}% (πάνω ${s.beaufortUp} / κάτω ${s.beaufortDown}) · χρώμα ${s.colourChangedPct}% · λέξη κάρτας ${s.cardChangedPct}% · πινέζα ${s.pinChangedPct}%`);
  console.log(`  προς πιο ΑΓΡΙΟ ${s.worse} · προς πιο ΗΡΕΜΟ ${s.better}`);
  for (const t of TONES) console.log(`    ${t.padEnd(7)} ${String(s.toneBefore[t]).padEnd(18)} → ${s.toneAfter[t]}`);
};
show('ΟΛΕΣ ΟΙ ΠΑΡΑΛΙΕΣ', report.total);
show('ΜΟΝΟ ΟΠΟΥ ΕΦΑΡΜΟΖΕΤΑΙ (seaWindCell + περιοχή περνά τη φραγή)', report.onlyWhereItApplies);
console.log('\nΑνά απόσταση στεριανού κελιού:');
for (const [k, s] of Object.entries(buckets)) {
  console.log(`  ${k.padEnd(9)} ώρες ${String(s.hours).padEnd(8)} Μπφ ${String(s.beaufortChangedPct + '%').padEnd(8)} χρώμα ${String(s.colourChangedPct + '%').padEnd(8)} άγριο ${String(s.worse).padEnd(6)} ήρεμο ${s.better}`);
}
console.log(`\nΦραγή αιτήματος: ${report.fetchVeto.regionsBlocked.length} περιοχές, ${report.fetchVeto.beachesBehind} παραλίες, ${hoursBehindFetchVeto} ώρες (${report.fetchVeto.hoursBehindPctOfMapped}% των ωρών με κελί νερού)`);
console.log(`Πύλη διεύθυνσης διαφωνεί (στεριανό vs τυπωμένο Μπφ): ${directionGateDisagreements} ώρες (${report.directionGateDisagreements.pctOfApplied}%)`);
console.log(`Παραλίες που κουνήθηκαν έστω μία ώρα: ${report.beachesTouched}`);
console.log(`\nΕΥΡΟΣ ΜΠΟΦΟΡ — πόσο συχνά ανάβει (Β, ${rangeHoursBase3.toLocaleString('el-GR')} ώρες με μέσο ≥3 Μπφ):`);
for (const [k, v] of Object.entries(rangeTable)) {
  console.log(`  ${(v.inBand5to15 ? '★ ' : '  ') + k.padEnd(38)} όλες ${String(v.firesPctAllHoursB + '%').padEnd(8)} ≥3 Μπφ ${String(v.firesPctOfBase3HoursB + '%').padEnd(8)} σκαλιά ${JSON.stringify(v.stepDistributionB)}`);
}
console.log(`\nΠΟΡΙΣΜΑ rollout: ${rolloutVerdict}`);
console.log(`ΠΟΡΙΣΜΑ εύρους: ${report.verdict.beaufortRange}`);
console.log(`→ ${path.relative(root, outPath)}\n`);
