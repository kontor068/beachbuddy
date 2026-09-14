#!/usr/bin/env node
/**
 * ΘΕΜΑ 22 — ΤΟ ΔΑΠΕΔΟ ΨΙΛΟΚΥΜΑΤΟΣ ΣΤΟΥΣ ΟΡΜΟΥΣ, ΜΠΡΟΣΤΑ ΣΤΟΝ ΚΡΙΤΗ ΤΗΣ ΑΜΜΟΥ (Sentinel-2) — 13/09/2026.
 *
 * ΤΟ ΕΡΩΤΗΜΑ. Στα 5 Μποφόρ κάθε «εκτεθειμένη» ακτή παίρνει δάπεδο 0,80 μ. (utils/waveModel.getWindChopWaveFloorM)
 * χωρίς να ρωτάμε πόσο νερό έχει μπροστά της. Σε μέρα μελτεμιού (Δ6-Β, 29/07) το δάπεδο αποφασίζει το τυπωμένο ύψος
 * στο 27% — και η υποψήφια «δάπεδο ≤ SMB της ριπής στο fetch» θα έριχνε 231 ώρες κάτω από το κίτρινο, σχεδόν όλες σε
 * όρμους < 3 χλμ. Απόφαση 13/09: όχι χωρίς κριτή. Εδώ ο κριτής: ο ίδιος Sentinel-2 του §Γ75/§Γ76 — σκάει κύμα που
 * αφήνει αφρό στην άμμο τις μέρες που το δάπεδο λέει 0,80 μ. σε όρμο με < 3 χλμ νερό;
 *
 * ΠΩΣ. Για κάθε παραλία-μέρα του πανελλαδικού κριτή (.tmp/s2judge/national-days.json, μέρες με μέτρηση αφρού,
 * Μάι-Οκτ 2022-2026) ξαναπαίζεται η απόφαση του max():
 *   - άνεμος 09:00 UTC (η ώρα του δορυφόρου ~09:10-09:30 UTC) από το αρχείο προγνώσεων της Open-Meteo (best_match,
 *     historical-forecast-api, χωρίς κλειδί) στο ΙΔΙΟ σημείο που ρωτά η σελίδα: το κελί νερού `seaWindCell` όπου υπάρχει
 *     (cell_selection=sea), αλλιώς οι συντεταγμένες της παραλίας (στεριανό κελί)·
 *   - βαθμός έκθεσης από την ΑΛΗΘΙΝΗ μηχανή (utils/windExposureEngine.assessBeachWindExposure) για αυτή τη διεύθυνση,
 *     όχι από τον τομέα του χάρτη (μόνο 14 παραλίες έχουν τομέα «εκτεθειμένο» < 3 χλμ — η μηχανή δίνει πολύ περισσότερες)·
 *   - δάπεδο = getWindChopWaveFloorM(έκθεση, Μποφόρ, άνεμος, ριπή)· SMB = estimateFetchLimitedWaveHeightM στο fetch του
 *     τομέα του ανέμου· «μέτρηση» = Hs Copernicus της μέρας × K_d γεωμετρίας για τη διεύθυνση του κύματος (το ίδιο K_d
 *     που τυπώνει η σελίδα, .tmp/shadow-kd-geometric.json). Νικητής = ο μεγαλύτερος, όπως στο resolveDisplayWaveHeightM.
 *     ΠΡΟΣΕΓΓΙΣΗ: λείπουν το γεωμετρικό ταβάνι και οι πύλες άφιξης· κρίνει ποιος θα ΑΠΟΦΑΣΙΖΕ, με τις ίδιες συναρτήσεις.
 * Κλάσεις μέρας (ανά παραλία):
 *   ΔΑΠΕΔΟ-0,8-ΟΡΜΟΣ   νικά το δάπεδο, δάπεδο ≥ 0,80 (κίτρινο εξ ορισμού), fetch τομέα < 3 χλμ   ← το ερώτημα
 *   ΔΑΠΕΔΟ-0,5-ΟΡΜΟΣ   νικά το δάπεδο, 0,45 ≤ δάπεδο < 0,80, fetch < 3 χλμ                         (4 Μπφ εκτεθειμένη κ.λπ.)
 *   ΔΑΠΕΔΟ-0,8-ΑΝΟΙΧΤΑ νικά το δάπεδο, δάπεδο ≥ 0,80, fetch ≥ 8 χλμ                                 (σύγκριση: ίδιο δάπεδο, ανοιχτό νερό)
 *   ΗΡΕΜΗ              άνεμος < 12 χλμ/ώ ΚΑΙ Hs < 0,25 (η κλάση «calm» του κριτή)                   ← ψεύτικος αφρός της ίδιας άμμου
 *   ΜΕΤΡΗΣΗ-0,8        νικά η μέτρηση με ≥ 0,80 μ. (πραγματικό κύμα από ανοιχτή πόρτα)              ← θετικός έλεγχος
 * «Αφρός» = ίδιο κατώφλι με τον πανελλαδικό (summarizeShoreSurfNational.py): εξωτερική λωρίδα ≥ 20% φωτεινά pixel
 * (surf) και ολόκληρη λωρίδα ≥ 20% (strip). Παραλίες που αφρίζουν > 25% των ήρεμων ημερών = θορυβώδεις, έξω.
 *
 * ΤΙ ΑΠΟΔΕΙΚΝΥΕΙ ΚΑΙ ΤΙ ΟΧΙ, ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ. Ο δορυφόρος είναι τυφλός κάτω από ~0,4 μ. θραύσης (Δ7-Β). Άρα
 * «καθόλου αφρός στους όρμους με δάπεδο 0,80» σημαίνει «δεν σκάει κύμα ≥ ~0,5 μ. — το 0,80 δεν είναι πραγματικό στην
 * άμμο», ΟΧΙ «το κύμα είναι 0,25». Αν οι όρμοι με δάπεδο 0,80 αφρίζουν όσο η ΗΡΕΜΗ τους μέρα → το δάπεδο λέει ψέματα
 * εκεί. Αν αφρίζουν όσο η ΜΕΤΡΗΣΗ-0,8 → το δάπεδο έχει δίκιο. Ένας αριθμός για τον Μίλτο: αφρός στους όρμους με δάπεδο
 * 0,8 vs στις ανοιχτές με 0,8 vs στις ήρεμες μέρες των ίδιων όρμων.
 *
 *   node scripts/judgeChopFloorSentinel2.mjs [--fetch-only] [--limit=N] [--years=2026]
 *   Άνεμος: 2026 από την ΠΛΗΡΩΜΕΝΗ πόρτα της σελίδας (past_days=92, φτάνει ~αρχές Ιουλίου, λεπτά)· 2022-2025 από το δωρεάν
 *   historical-forecast-api (best_match) — ~1 κλήση/λεπτό πριν το 429 με 20 σημεία × 6 μήνες = ώρες, με cache ανά σημείο×καλοκαίρι,
 *   άρα τρέχει χωριστά (`--years=2022,2023,2024,2025 --fetch-only`) και το κύριο τρέξιμο τα βρίσκει έτοιμα.
 *   CB_DATA_ROOT=C:/Users/Miltos/Desktop/beach   (όπου ζει το .tmp/s2judge)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = process.env.CB_DATA_ROOT || (existsSync(path.join(root, '.tmp/s2judge')) ? root : 'C:/Users/Miltos/Desktop/beach');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename);
    return;
  }
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};
const { getWindChopWaveFloorM, estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : fallback; };
const FETCH_ONLY = process.argv.includes('--fetch-only');
const CACHED_ONLY = process.argv.includes('--cached-only'); // κρίνε μόνο με ό,τι υπάρχει στο cache — όταν η δωρεάν πόρτα έχει κλείσει για τη μέρα
const LIMIT = Number(argVal('--limit', '0'));
const YEARS = argVal('--years', '2026').split(',').map(Number);
const today = new Date().toISOString().slice(0, 10);
const OUT = path.join(root, 'reports/wave-model', `chop-floor-sentinel2-judge-${today}.json`);
const WIND_CACHE = path.join(dataRoot, '.tmp/s2judge/wind-09utc');
const FOAM_DAY = 0.2, NOISY_CALM = 0.25, AMBER_M = 0.8, MID_M = 0.45, COVE_KM = 3, OPEN_KM = 8, CALM_WIND_KMH = 12, CALM_HS_M = 0.25, EPS = 0.006;
const num = (v, d = 3) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const median = arr => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };

// ── 1. Παραλίες: κριτής Sentinel-2 + προφίλ έκθεσης + κελί ανέμου + K_d ─────────────────────────────────────
const nd = JSON.parse(readFileSync(path.join(dataRoot, '.tmp/s2judge/national-days.json'), 'utf8'));
const kdFile = JSON.parse(readFileSync(path.join(dataRoot, '.tmp/shadow-kd-geometric.json'), 'utf8'));
const KD_STEP = kdFile.stepDeg || 5;
const seaCells = JSON.parse(readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8')).cells || {};
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const appDir = path.join(root, 'public/data/beaches/app');
const regionCache = new Map();
const loadRegion = regionId => {
  if (regionCache.has(regionId)) return regionCache.get(regionId);
  let out = null;
  try {
    const app = JSON.parse(readFileSync(path.join(appDir, `${regionId}.json`), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, `${regionId}.json`), 'utf8')).profiles;
    const profiles = {};
    for (const p of Object.values(profilesRaw ?? {})) if (p?.beachId != null) profiles[p.beachId] = p;
    out = { beaches: new Map((app.island?.beaches || []).map(b => [b.id, b])), profiles };
  } catch { out = null; }
  regionCache.set(regionId, out);
  return out;
};
const targets = []; // παραλίες με τουλάχιστον έναν τομέα (όχι protected) με fetch < 3 χλμ και μέρες δορυφόρου Μάι-Οκτ
let noProfile = 0;
for (const [idStr, b] of Object.entries(nd.beaches || {})) {
  const id = Number(idStr);
  const days = (b.days || []).filter(d => !d.skipped && typeof d.beachFoam === 'number' && [5, 6, 7, 8, 9, 10].includes(Number(d.day.slice(5, 7))) && YEARS.includes(Number(d.day.slice(0, 4))));
  if (!days.length) continue;
  const region = loadRegion(b.region);
  const profile = region?.profiles?.[id], beach = region?.beaches?.get(id);
  if (!profile || !beach) { noProfile += 1; continue; }
  const shortSector = Object.values(profile.sectors || {}).some(s => s && s.level !== 'protected' && typeof s.fetchKm === 'number' && s.fetchKm < COVE_KM);
  if (!shortSector) continue;
  const cell = seaCells[String(id)];
  const point = cell ? { key: `sea_${cell}`, lat: Number(cell.split('_')[0]), lon: Number(cell.split('_')[1]), sea: true } : { key: `land_${b.lat}_${b.lon}`, lat: b.lat, lon: b.lon, sea: false };
  targets.push({ id, name: b.name, region: b.region, lat: b.lat, lon: b.lon, days, beach, profile, kd: kdFile.beaches?.[idStr]?.kd ?? null, point });
}
const targetList = LIMIT ? targets.slice(0, LIMIT) : targets;
console.log(`Στόχοι (τομέας < ${COVE_KM} χλμ όχι protected, με μέρες δορυφόρου): ${targetList.length}${LIMIT ? ` (όριο ${LIMIT})` : ''} · χωρίς προφίλ ${noProfile} · με κελί νερού ${targetList.filter(t => t.point.sea).length}`);

// ── 2. Άνεμος 08-10 UTC ανά σημείο και καλοκαίρι, με cache — μόνο τις μέρες του δορυφόρου ────────────────────
mkdirSync(WIND_CACHE, { recursive: true });
const s2Days = new Set(targetList.flatMap(t => t.days.map(d => d.day)));
const pointsNeeded = new Map();
for (const t of targetList) pointsNeeded.set(t.point.key, t.point);
const cachePathFor = (key, year) => path.join(WIND_CACHE, `${key.replace(/[^A-Za-z0-9_.-]/g, '_')}-${year}.json`);
const missing = [];
for (const p of pointsNeeded.values()) for (const y of YEARS) if (!CACHED_ONLY && !existsSync(cachePathFor(p.key, y))) missing.push({ ...p, year: y });
console.log(`Σημεία ανέμου: ${pointsNeeded.size} · λείπουν από cache: ${missing.length} (σημείο×καλοκαίρι)`);
const { resolveOpenMeteoKey } = await import('./lib/openMeteoKey.mjs');
const apiKey = await resolveOpenMeteoKey();
const PAID_PAST_DAYS = 92;
const yearRange = y => ({ start: `${y}-05-01`, end: y === 2026 ? new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10) : `${y}-10-31` });
const groups = new Map(); // `${year}|${sea}` → [points]
for (const m of missing) { const k = `${m.year}|${m.sea}`; (groups.get(k) || groups.set(k, []).get(k)).push(m); }
let calls = 0;
const storeBatch = (batch, rows, source) => {
  batch.forEach((p, j) => {
    const r = rows[j];
    const perDay = {};
    r.hourly.time.forEach((t, idx) => {
      const day = t.slice(0, 10), hour = t.slice(11, 13);
      if (!s2Days.has(day) || !['08', '09', '10'].includes(hour)) return;
      (perDay[day] ||= {})[hour] = [r.hourly.wind_speed_10m[idx], r.hourly.wind_direction_10m[idx], r.hourly.wind_gusts_10m[idx]];
    });
    writeFileSync(cachePathFor(p.key, p.year), JSON.stringify({ point: p.key, year: p.year, source, echo: { lat: r.latitude, lon: r.longitude, elevation: r.elevation }, days: perDay }), 'utf8');
  });
};
const fetchRows = async (url, label) => {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      calls += 1;
      if (res.status === 429) { process.stderr.write(`\n  429 (${label}) — παύση 65 δευτ.`); await sleep(65000); continue; }
      const json = await res.json();
      if (json.error) { process.stderr.write(`\n  μοντέλο (${label}): ${json.reason}`); await sleep(10000); continue; }
      return Array.isArray(json) ? json : [json];
    } catch (e) { process.stderr.write(`\n  ${e.message} — ξανά`); await sleep(10000); }
  }
  console.error('\nΗ λήψη ανέμου απέτυχε επανειλημμένα — σταματώ.');
  process.exit(1);
};
for (const [gk, list] of groups) {
  const [yearStr, sea] = gk.split('|');
  const year = Number(yearStr);
  const paid = year === 2026 && Boolean(apiKey);
  const BATCH = paid ? 50 : 20, PACE_MS = paid ? 1500 : 2500;
  const { start, end } = yearRange(year);
  for (let i = 0; i < list.length; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const coords = `latitude=${batch.map(p => p.lat).join(',')}&longitude=${batch.map(p => p.lon).join(',')}`;
    const vars = 'hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC';
    const cell = sea === 'true' ? '&cell_selection=sea' : '';
    const url = paid
      ? `https://customer-api.open-meteo.com/v1/forecast?${coords}&${vars}&past_days=${PAID_PAST_DAYS}&forecast_days=1${cell}&apikey=${encodeURIComponent(apiKey)}`
      : `https://historical-forecast-api.open-meteo.com/v1/forecast?${coords}&${vars}&start_date=${start}&end_date=${end}&models=best_match${cell}`;
    const rows = await fetchRows(url, gk);
    storeBatch(batch, rows, paid ? `customer-api past_days=${PAID_PAST_DAYS}` : 'historical-forecast-api best_match');
    process.stderr.write(`\r  άνεμος: ${calls} κλήσεις · ${gk}${paid ? ' (πληρωμένη πόρτα)' : ''} ${Math.min(i + BATCH, list.length)}/${list.length}`);
    await sleep(PACE_MS);
  }
}
if (missing.length) process.stderr.write('\n');
if (FETCH_ONLY) { console.log('--fetch-only: τέλος.'); process.exit(0); }
const windAt = (point, day) => {
  const f = cachePathFor(point.key, Number(day.slice(0, 4)));
  if (!existsSync(f)) return null;
  const d = JSON.parse(readFileSync(f, 'utf8')).days?.[day];
  if (!d) return null;
  const h = d['09'] || d['10'] || d['08'];
  if (!h || typeof h[0] !== 'number') return null;
  return { kmh: h[0], deg: h[1], gust: typeof h[2] === 'number' ? h[2] : undefined, hour: d['09'] ? '09' : d['10'] ? '10' : '08' };
};

// ── 3. Η απόφαση του max() ανά παραλία-μέρα, με τις συναρτήσεις της σελίδας ───────────────────────────────────
const rows = [];
const noisyBeaches = new Set();
for (const t of targetList) {
  const calm = t.days.filter(d => d.class === 'calm');
  if (calm.length >= 3 && calm.filter(d => d.beachFoam >= FOAM_DAY).length / calm.length > NOISY_CALM) noisyBeaches.add(t.id);
}
let noWind = 0;
for (const t of targetList) {
  if (noisyBeaches.has(t.id)) continue;
  for (const d of t.days) {
    const w = windAt(t.point, d.day);
    if (!w) { noWind += 1; continue; }
    const [hs, waveDir] = d.wave || [];
    const bft = getBeaufortLevel(w.kmh);
    const sectorKey = windSectorFromDegrees(w.deg);
    const sector = t.profile.sectors?.[sectorKey] ?? null;
    const fetchKm = typeof sector?.fetchKm === 'number' ? sector.fetchKm : null;
    let exposure = null;
    try {
      exposure = assessBeachWindExposure({ beach: t.beach, windDirectionDeg: w.deg, windSpeedKmh: w.kmh, beaufort: bft, waveHeightMeters: typeof hs === 'number' ? hs : undefined, geospatialProfile: t.profile }).exposureLevel ?? null;
    } catch { exposure = null; }
    if (!exposure) continue;
    const floor = getWindChopWaveFloorM(exposure, bft, w.kmh, w.gust);
    const smb = fetchKm !== null ? estimateFetchLimitedWaveHeightM({ windSpeedKmh: w.kmh, fetchKm }) : 0;
    const kd = t.kd && typeof waveDir === 'number' ? (t.kd[Math.round(waveDir / KD_STEP) % t.kd.length] ?? 1) : 1;
    const measured = typeof hs === 'number' ? hs * (typeof kd === 'number' ? kd : 1) : null;
    const others = Math.max(measured ?? 0, smb);
    const winner = floor > others + EPS ? 'floor' : (measured ?? 0) >= smb ? 'measured' : 'smb';
    let cls = 'other';
    if (winner === 'floor' && fetchKm !== null && fetchKm < COVE_KM && floor >= AMBER_M) cls = 'floor-0.8-cove';
    else if (winner === 'floor' && fetchKm !== null && fetchKm < COVE_KM && floor >= MID_M) cls = 'floor-0.5-cove';
    else if (winner === 'floor' && fetchKm !== null && fetchKm >= COVE_KM && fetchKm < OPEN_KM && floor >= AMBER_M) cls = 'floor-0.8-mid';
    else if (winner === 'floor' && fetchKm !== null && fetchKm >= COVE_KM && fetchKm < OPEN_KM && floor >= MID_M) cls = 'floor-0.5-mid';
    else if (winner === 'floor' && fetchKm !== null && fetchKm >= OPEN_KM && floor >= AMBER_M) cls = 'floor-0.8-open';
    else if (winner === 'floor' && fetchKm !== null && fetchKm >= OPEN_KM && floor >= MID_M) cls = 'floor-0.5-open';
    else if (w.kmh < CALM_WIND_KMH && typeof hs === 'number' && hs < CALM_HS_M) cls = 'calm';
    else if (winner === 'measured' && measured >= AMBER_M) cls = 'measured-0.8';
    rows.push({
      id: t.id, name: t.name, region: t.region, day: d.day, hourUtc: w.hour, seaCell: t.point.sea, windKmh: num(w.kmh, 1), windDeg: Math.round(w.deg), gustKmh: num(w.gust, 1), bft, sector: sectorKey, fetchKm: num(fetchKm, 2), exposure,
      hs: num(hs, 2), waveDir: typeof waveDir === 'number' ? Math.round(waveDir) : null, kd: num(kd, 2), measured: num(measured, 2), smb: num(smb, 2), floor: num(floor, 2), winner, cls, s2class: d.class,
      surf: (d.beachFoamOuter ?? 0) >= FOAM_DAY, strip: d.beachFoam >= FOAM_DAY, beachFoam: d.beachFoam, beachFoamOuter: d.beachFoamOuter ?? null, exposedFoam: d.exposedFoam ?? null,
    });
  }
}
console.log(`Παραλίες-μέρες κριθείσες: ${rows.length} · χωρίς άνεμο ${noWind} · θορυβώδεις παραλίες έξω: ${noisyBeaches.size}`);

// ── 4. Άθροισμα: ο ένας αριθμός, και οι στρώσεις του ──────────────────────────────────────────────────────────
const rate = (rs, f) => (rs.length ? num(rs.filter(f).length / rs.length) : null);
const stat = rs => ({
  days: rs.length, beaches: new Set(rs.map(r => r.id)).size, surfRate: rate(rs, r => r.surf), stripRate: rate(rs, r => r.strip),
  medianFoamOuter: num(median(rs.map(r => r.beachFoamOuter).filter(v => typeof v === 'number'))), medianFoam: num(median(rs.map(r => r.beachFoam))),
  medianWindKmh: num(median(rs.map(r => r.windKmh)), 1), medianFetchKm: num(median(rs.map(r => r.fetchKm).filter(v => typeof v === 'number')), 2), medianHs: num(median(rs.map(r => r.hs).filter(v => typeof v === 'number')), 2),
});
const by = (rs, keyFn) => { const m = {}; for (const r of rs) (m[keyFn(r)] ||= []).push(r); return Object.fromEntries(Object.entries(m).sort().map(([k, v]) => [k, stat(v)])); };
const classes = {};
for (const c of ['floor-0.8-cove', 'floor-0.5-cove', 'floor-0.8-mid', 'floor-0.5-mid', 'floor-0.8-open', 'floor-0.5-open', 'calm', 'measured-0.8', 'other']) classes[c] = stat(rows.filter(r => r.cls === c));
const coveIds = new Set(rows.filter(r => r.cls === 'floor-0.8-cove').map(r => r.id));
const calmSameCoves = rows.filter(r => r.cls === 'calm' && coveIds.has(r.id));
const measuredSameCoves = rows.filter(r => r.cls === 'measured-0.8' && coveIds.has(r.id));
const cove08 = rows.filter(r => r.cls === 'floor-0.8-cove');
const fetchBand = km => (km === null ? 'άγνωστο' : km < 1 ? '<1' : km < 2 ? '1-2' : km < 3 ? '2-3' : km < 8 ? '3-8' : '≥8');
const perBeach = [];
for (const id of coveIds) {
  const mine = cove08.filter(r => r.id === id), calm = rows.filter(r => r.cls === 'calm' && r.id === id);
  if (mine.length < 3) continue;
  perBeach.push({ id, name: mine[0].name, region: mine[0].region, seaCell: mine[0].seaCell, floorDays: mine.length, surfDays: mine.filter(r => r.surf).length, stripDays: mine.filter(r => r.strip).length, calmDays: calm.length, calmSurfDays: calm.filter(r => r.surf).length, medianFetchKm: num(median(mine.map(r => r.fetchKm)), 2), medianWindKmh: num(median(mine.map(r => r.windKmh)), 1), days: mine.map(r => `${r.day} ${r.windKmh}km/h ${r.sector} f${r.fetchKm} ${r.exposure} floor${r.floor} Hs${r.hs}×${r.kd} outer${r.beachFoamOuter}`) });
}
perBeach.sort((a, b) => b.floorDays - a.floorDays);
// ── Το κριτήριο «κρατάει» της απόφασης Α (Μίλτος, 13/09 βράδυ), γραμμένο ΠΡΙΝ μπουν τα 2022-2025 ──────────────
// Καθαρή κλάση = δάπεδο ≥0,8 σε όρμο <3 χλμ ΚΑΙ μέρα «closed» του κριτή (η σκιά αληθινή, το 0,8 βγαίνει ΜΟΝΟ από το δάπεδο).
// Κρατάει αν: (1) ≥150 τέτοιες μέρες συνολικά, (2) αφρός θραύσης ≤10% (η ήρεμη άμμος έχει ~1%), (3) λωρίδα ≤ 2× της ήρεμης
// βάσης + 2 μονάδες — βάση = η ήρεμη άμμος ΟΛΩΝ των όρμων-στόχων (1.703 μέρες, σταθερή· η ήρεμη των ίδιων 19 όρμων είναι 0% σε
// λίγες μέρες και θα έκοβε το κριτήριο από θόρυβο — διορθώθηκε ΠΡΙΝ φορτωθούν τα 2022-2025), (4) ο θετικός έλεγχος στέκει (πραγματικό ≥0,8: θραύση ≥25%, λωρίδα ≥60%) — αλλιώς το όργανο
// δεν βλέπει και το «όχι αφρός» δεν λέει τίποτα. Αν κρατάει → η υποψήφια «δάπεδο ≤ SMB(ριπή, fetch)» ΜΟΝΟ για fetch < 3 χλμ.
const clean = cove08.filter(r => r.s2class === 'closed');
const cleanIds = new Set(clean.map(r => r.id));
const calmClean = rows.filter(r => r.cls === 'calm' && cleanIds.has(r.id));
const cleanStat = stat(clean), calmCleanStat = stat(calmClean), posStat = classes['measured-0.8'];
const decisionA = {
  rule: 'Α (13/09): κόψιμο του δαπέδου μόνο σε όρμους <3 χλμ, ΑΝ κρατήσει στα 4 καλοκαίρια — κριτήριο δηλωμένο πριν τα δεδομένα',
  clean: cleanStat, calmSameCleanCoves: calmCleanStat, positiveControl: posStat,
  checks: {
    enoughDays: { need: '≥150', got: cleanStat.days, ok: cleanStat.days >= 150 },
    surfLow: { need: '≤0.10', got: cleanStat.surfRate, ok: cleanStat.surfRate !== null && cleanStat.surfRate <= 0.10 },
    stripLikeCalm: { need: `≤${num(2 * (classes.calm.stripRate ?? 0) + 0.02)} (2× ήρεμη όλων των όρμων ${classes.calm.stripRate} + 0,02)`, got: cleanStat.stripRate, ok: cleanStat.stripRate !== null && classes.calm.stripRate !== null && cleanStat.stripRate <= 2 * classes.calm.stripRate + 0.02 },
    instrumentSees: { need: 'surf ≥0.25 & strip ≥0.60', got: `${posStat.surfRate} / ${posStat.stripRate}`, ok: posStat.surfRate !== null && posStat.surfRate >= 0.25 && posStat.stripRate >= 0.60 },
  },
};
decisionA.holds = Object.values(decisionA.checks).every(c => c.ok);
decisionA.verdict = decisionA.holds ? 'ΚΡΑΤΑΕΙ — η υποψήφια μπαίνει για fetch < 3 χλμ (θέλει υλοποίηση + μέτρηση επίπτωσης + πύλες)' : decisionA.checks.enoughDays.ok ? 'ΔΕΝ ΚΡΑΤΑΕΙ — το δάπεδο μένει' : 'ΛΙΓΑ ΑΚΟΜΑ — περιμένει τα 2022-2025';

const report = {
  decisionA,
  generatedAt: new Date().toISOString(), years: YEARS, targets: targetList.length, targetsWithSeaCell: targetList.filter(t => t.point.sea).length, noisyExcluded: noisyBeaches.size, rowsJudged: rows.length, noWind,
  question: 'αφρός στην άμμο τις μέρες που το δάπεδο ψιλοκύματος δίνει ≥0,80 μ. σε όρμο με fetch < 3 χλμ — σαν τις ήρεμες μέρες της ίδιας άμμου, ή σαν τις μέρες με πραγματικό κύμα 0,8;',
  foamRule: `surf = εξωτερική λωρίδα ≥ ${FOAM_DAY} · strip = όλη η λωρίδα ≥ ${FOAM_DAY} · θορυβώδεις (ήρεμες μέρες με strip > ${NOISY_CALM}) έξω`,
  caveats: ['2026 από past_days=92 της πληρωμένης πόρτας: μέρες πριν τις αρχές Ιουλίου δεν έχουν άνεμο και μένουν έξω (μετριούνται στο noWind)', 'ο δορυφόρος είναι τυφλός κάτω από ~0,4 μ. θραύσης: «όχι αφρός» = «όχι κύμα που σκάει ≥ ~0,5 μ.», όχι «0,25 μ.»', 'άνεμος 09 UTC από αρχείο best_match, όχι όργανο· έκθεση από τη μηχανή· max() χωρίς ταβάνι/πύλες άφιξης (προσέγγιση)', 'στιγμιότυπο μεσημεριού — το απόγευμα του μελτεμιού δεν φαίνεται'],
  headline: {
    coveFloor08: stat(cove08), calmSameCoves: stat(calmSameCoves), measured08SameCoves: stat(measuredSameCoves), openFloor08: classes['floor-0.8-open'], measured08All: classes['measured-0.8'], calmAll: classes.calm,
  },
  classes,
  coveFloor08ByFetchBand: by(cove08, r => fetchBand(r.fetchKm)), coveFloor08ByBeaufort: by(cove08, r => String(r.bft)), coveFloor08ByExposure: by(cove08, r => r.exposure), coveFloor08ByS2Class: by(cove08, r => r.s2class),
  coveFloor08BySeaCell: by(cove08, r => (r.seaCell ? 'κελί νερού' : 'στεριανό κελί')),
  coveFloor05ByFetchBand: by(rows.filter(r => r.cls === 'floor-0.5-cove'), r => fetchBand(r.fetchKm)),
  midFloor08ByFetchBand: by(rows.filter(r => r.cls === 'floor-0.8-mid'), r => (r.fetchKm < 5 ? '3-5' : '5-8')),
  perBeach: perBeach.slice(0, 80),
  perBeachCount: perBeach.length,
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
const line = (label, s) => `  ${label.padEnd(34)} μέρες ${String(s.days).padStart(5)} · παραλίες ${String(s.beaches).padStart(4)} · αφρός έξω ${s.surfRate === null ? '—' : (100 * s.surfRate).toFixed(1) + '%'} · λωρίδα ${s.stripRate === null ? '—' : (100 * s.stripRate).toFixed(1) + '%'} · άνεμος ${s.medianWindKmh} · fetch ${s.medianFetchKm} · Hs ${s.medianHs}`;
console.log('\n=== Θέμα 22 · δάπεδο ψιλοκύματος μπροστά στον δορυφόρο ===');
console.log(line('ΔΑΠΕΔΟ ≥0,8 σε ΟΡΜΟ <3 χλμ', report.headline.coveFloor08));
console.log(line('  ίδιοι όρμοι, ΗΡΕΜΗ μέρα', report.headline.calmSameCoves));
console.log(line('  ίδιοι όρμοι, ΜΕΤΡΗΣΗ ≥0,8', report.headline.measured08SameCoves));
console.log(line('ΔΑΠΕΔΟ ≥0,8 σε 3-8 χλμ (ΑΜΕΤΡΗΤΗ ΖΩΝΗ)', classes['floor-0.8-mid']));
console.log(line('ΔΑΠΕΔΟ 0,45-0,79 σε 3-8 χλμ', classes['floor-0.5-mid']));
console.log(line('ΔΑΠΕΔΟ ≥0,8 σε ΑΝΟΙΧΤΑ ≥8 χλμ', report.headline.openFloor08));
console.log(line('ΜΕΤΡΗΣΗ ≥0,8 (όλοι οι στόχοι)', report.headline.measured08All));
console.log(line('ΗΡΕΜΗ (όλοι οι στόχοι)', report.headline.calmAll));
console.log(line('ΔΑΠΕΔΟ 0,45-0,79 σε ΟΡΜΟ', classes['floor-0.5-cove']));
console.log('  ανά fetch (όρμοι ≥0,8): ' + Object.entries(report.coveFloor08ByFetchBand).map(([k, v]) => `${k}: ${v.days} μέρες, αφρός ${v.surfRate === null ? '—' : (100 * v.surfRate).toFixed(0) + '%'}`).join(' · '));
console.log('  ανά Μποφόρ (όρμοι ≥0,8): ' + Object.entries(report.coveFloor08ByBeaufort).map(([k, v]) => `${k}: ${v.days}, ${v.surfRate === null ? '—' : (100 * v.surfRate).toFixed(0) + '%'}`).join(' · '));
console.log('  ανά έκθεση (όρμοι ≥0,8): ' + Object.entries(report.coveFloor08ByExposure).map(([k, v]) => `${k}: ${v.days}, ${v.surfRate === null ? '—' : (100 * v.surfRate).toFixed(0) + '%'}`).join(' · '));
console.log('  ανά πηγή ανέμου (όρμοι ≥0,8): ' + Object.entries(report.coveFloor08BySeaCell).map(([k, v]) => `${k}: ${v.days}, ${v.surfRate === null ? '—' : (100 * v.surfRate).toFixed(0) + '%'}`).join(' · '));
console.log(`  όρμοι με ≥3 μέρες δαπέδου 0,8: ${perBeach.length}`);
for (const b of perBeach.slice(0, 15)) console.log(`    #${String(b.id).padEnd(5)} ${String(b.name).slice(0, 26).padEnd(26)} ${b.region.slice(0, 26).padEnd(26)} δάπεδο ${b.floorDays} μέρες → αφρός ${b.surfDays} · ήρεμες ${b.calmDays} → αφρός ${b.calmSurfDays} · fetch ${b.medianFetchKm} · άνεμος ${b.medianWindKmh}`);
console.log(`
  ΑΠΟΦΑΣΗ Α — κριτήριο: ${Object.entries(decisionA.checks).map(([k, c]) => `${k} ${c.ok ? '✅' : '❌'} (${c.got} / ${c.need})`).join(' · ')}`);
console.log(`  → ${decisionA.verdict}`);
console.log(`→ ${path.relative(root, OUT)}`);
