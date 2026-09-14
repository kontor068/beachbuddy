#!/usr/bin/env node
/**
 * ΜΙΣΟ ΜΕΤΡΟ ΚΑΤΑΜΟΥΤΡΑ — ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ-ΩΡΕΣ ΑΛΛΑΖΟΥΝ ΛΕΞΗ (14/09/2026, βίβλος §Γ85).
 *
 * Αφορμή: Πευκούλια #1169, 11:00 — «είχε πιο πολύ κύμα απ' όσο δείχνατε». Η σελίδα έγραφε 0,58 μ.
 * που μπαίνει ίσια και «Καλή». Ο αριθμός ήταν σωστός (Copernicus 0,55-0,60)· η λέξη όχι. Απόφαση
 * Μίλτου Α: «πρόσεχε» όταν τυπώνουμε ≥0,5 μ. και η θάλασσα έρχεται κατάμουτρα από ανοιχτό τομέα.
 *
 * Το εργαλείο οδηγεί την ΠΡΑΓΜΑΤΙΚΗ `calculateBeachScore` σε κάθε παραλία της χώρας, ώρα-ώρα 10-18,
 * και γράφει ετυμηγορία, τυπωμένο νερό ακτής και άφιξη θάλασσας. Τρέχει δύο φορές πάνω στον ΙΔΙΟ
 * καιρό — μία πριν από τον κανόνα, μία μετά — και το `--compare` λέει τι άλλαξε. ΑΠΑΙΤΗΣΗ (αλλιώς
 * exit 1): κάθε αλλαγή είναι «Καλή/Ιδανική → πρόσεχε», σε άφιξη 'exposed', με τυπωμένο ≥0,5 μ.
 *
 *   node scripts/measureStraightInCaution.mjs --record=.tmp/sic-today-weather.json --out=.tmp/sic-today-before.json
 *   (κανόνας)
 *   node scripts/measureStraightInCaution.mjs --replay=.tmp/sic-today-weather.json --out=.tmp/sic-today-after.json
 *   node scripts/measureStraightInCaution.mjs --compare=.tmp/sic-today-before.json,.tmp/sic-today-after.json
 *
 * Παλιά μέρα: OPEN_METEO_REPLAY=2025-07-10 OPEN_METEO_REPLAY_SHIFT=1 μπροστά από το --record
 * (lib/replayOpenMeteo — η μέρα «μετακομίζει» στο σήμερα, το ρολόι μένει αληθινό). Η ηχογράφηση
 * ξαναπαίζεται ΜΟΝΟ την ίδια μέρα που γράφτηκε (οι ώρες της είναι μετατοπισμένες στο σήμερα).
 *
 * Όρια, δηλωμένα: άνεμος από το σημείο της περιοχής (όπως το measureConservatismDrift), όχι από το
 * cluster της παραλίας· μόνο η ημέρα 0· ώρες 10-18.
 */
import './lib/replayOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : fallback; };
const RECORD = argVal('--record');
const REPLAY = argVal('--replay');
const OUT = argVal('--out');
const COMPARE = argVal('--compare');
const HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18];
const COLS = ['id', 'region', 'hour', 'verdict', 'shore', 'open', 'arrival', 'bft', 'onshore'];
const STRAIGHT = 0.8; // utils/seaArrival.STRAIGHT_IN_MIN_ONSHORE — αντίγραφο για να τρέχει το --compare χωρίς TS
const MILD = new Set(['good', 'excellent']);
const printed = (m) => (typeof m === 'number' && Number.isFinite(m) ? Math.round(m / 0.1) * 0.1 : null);

// ── Σύγκριση δύο εκτελέσεων ──────────────────────────────────────────────────────────────────
if (COMPARE) {
  const [a, b] = COMPARE.split(',').map(f => JSON.parse(readFileSync(path.resolve(root, f), 'utf8')));
  const toMap = (run) => new Map(run.rows.map(r => { const o = Object.fromEntries(COLS.map((c, i) => [c, r[i]])); return [`${o.id}|${o.hour}`, o]; }));
  const A = toMap(a), B = toMap(b);
  const moves = {}; const changed = []; const violations = [];
  let mildBefore = 0;
  for (const [k, x] of A) {
    if (MILD.has(x.verdict)) mildBefore += 1;
    const y = B.get(k);
    if (!y || x.verdict === y.verdict) continue;
    const m = `${x.verdict}→${y.verdict}`; moves[m] = (moves[m] || 0) + 1;
    changed.push(y);
    const ok = MILD.has(x.verdict) && y.verdict === 'caution' && y.arrival === 'exposed' && (y.onshore ?? -1) >= STRAIGHT - 1e-9 && (printed(y.shore) ?? 0) >= 0.5 - 1e-9;
    if (!ok) violations.push({ ...y, before: x.verdict });
  }
  const beaches = new Set(changed.map(r => r.id));
  const byRegion = {}; changed.forEach(r => { byRegion[r.region] = (byRegion[r.region] || 0) + 1; });
  const byPrinted = {}; changed.forEach(r => { const p = (printed(r.shore) ?? 0).toFixed(1); byPrinted[p] = (byPrinted[p] || 0) + 1; });
  const out = {
    before: a.label, after: b.label, weather: a.weather, comparedHours: A.size, mildHoursBefore: mildBefore,
    changedHours: changed.length, changedBeaches: beaches.size,
    changedShareOfMildPct: Number((changed.length / Math.max(1, mildBefore) * 100).toFixed(2)),
    moves, byPrinted, topRegions: Object.entries(byRegion).sort((p, q) => q[1] - p[1]).slice(0, 12),
    violations: violations.slice(0, 20), violationCount: violations.length,
  };
  console.log(`\n=== ΜΙΣΟ ΜΕΤΡΟ ΚΑΤΑΜΟΥΤΡΑ: ${a.label} → ${b.label} (${a.weather}) ===`);
  console.log(`  παραλίες-ώρες ${A.size.toLocaleString('el')} · «Καλή/Ιδανική» πριν ${mildBefore.toLocaleString('el')}`);
  console.log(`  ΑΛΛΑΞΑΝ ${changed.length} ώρες (${out.changedShareOfMildPct}% των «Καλή/Ιδανική») σε ${beaches.size} παραλίες · ${JSON.stringify(moves)}`);
  console.log(`  ανά τυπωμένο ύψος: ${JSON.stringify(byPrinted)}`);
  console.log(`  ανά περιοχή: ${out.topRegions.map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  console.log(`  ΠΑΡΑΒΙΑΣΕΙΣ ΣΥΜΒΟΛΑΙΟΥ: ${violations.length}`);
  const reportDir = path.join(root, 'reports/weather'); mkdirSync(reportDir, { recursive: true });
  const outFile = argVal('--report', path.join(reportDir, `straight-in-caution-${a.weather}.json`));
  writeFileSync(path.resolve(root, outFile), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`→ ${path.relative(root, path.resolve(root, outFile))}`);
  process.exit(violations.length ? 1 : 0);
}

// ── Μηχανή ───────────────────────────────────────────────────────────────────────────────────
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\nexports.recordOpenMeteoCall = function () {};\n', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

// Ηχογράφηση/επανάληψη ΑΝΑ ΣΗΜΕΙΟ ΚΑΙ ΑΝΑ ΑΙΤΗΜΑ (14/09/2026). Το measureConservatismDrift κλειδώνει
// μόνο με διαδρομή + σημείο — αλλά για ΚΑΘΕ σημείο θάλασσας η σελίδα κάνει ΤΡΙΑ αιτήματα στο /v1/marine
// (ewam, ουρά meteofrance_wave, θερμοκρασία νερού· services/weatherService fetchMarineForecastData) και
// κρατιέται όποιο έφτασε τελευταίο. Μετρημένο στην ηχογράφηση της 14/09 10:21: 604/2.867 σημεία (21%)
// κράτησαν ΜΟΝΟ θερμοκρασία νερού — στο ξαναπαίξιμο η σελίδα έχανε το κύμα και έπεφτε σε εκτίμηση.
// Γι' αυτό το κλειδί κουβαλάει και το υπόλοιπο ερώτημα (χωρίς συντεταγμένες, κλειδί API, ημερομηνίες).
const requestSignature = (u) => [...u.searchParams.entries()]
  .filter(([k]) => !['latitude', 'longitude', 'apikey', 'start_date', 'end_date'].includes(k))
  .sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
const pointKey = (u, lat, lon) => `${u.pathname}|${requestSignature(u)}|${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
const store = REPLAY ? JSON.parse(readFileSync(path.resolve(root, REPLAY), 'utf8')) : {};
const originalFetch = globalThis.fetch;
// Σε replay ο άνεμος πάει στο ΔΩΡΕΑΝ αρχείο (lib/replayOpenMeteo): το κλειδί μας απαντά 403 «θέλει
// Professional» στο customer-historical-forecast (μετρήθηκε 14/09/2026). Το θαλάσσιο αρχείο δουλεύει με το κλειδί.
const PAID_HOST = process.env.OPEN_METEO_REPLAY
  ? { 'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com' }
  : { 'https://api.open-meteo.com': 'https://customer-api.open-meteo.com', 'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com' };
if (RECORD || REPLAY) {
  const apiKey = RECORD ? (process.env.OPEN_METEO_API_KEY?.trim() || (await import('./lib/openMeteoKey.mjs').then(m => m.resolveOpenMeteoKey()).catch(() => null))) : null;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url !== 'string' || !/open-meteo\.com/.test(url)) return originalFetch(input, init);
    const u = new URL(url);
    const lats = (u.searchParams.get('latitude') || '').split(',').filter(Boolean);
    const lons = (u.searchParams.get('longitude') || '').split(',').filter(Boolean);
    if (REPLAY) {
      const rows = lats.map((la, i) => store[pointKey(u, la, lons[i])] ?? null);
      if (rows.some(r => r === null)) throw new Error(`λείπουν ${rows.filter(r => r === null).length}/${rows.length} σημεία από την ηχογράφηση (${u.pathname})`);
      return new Response(JSON.stringify(rows.length === 1 ? rows[0] : rows), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    let target = url;
    if (apiKey) for (const [free, paid] of Object.entries(PAID_HOST)) if (target.startsWith(free)) target = `${paid}${target.slice(free.length)}&apikey=${encodeURIComponent(apiKey)}`;
    const res = await originalFetch(target, init);
    const json = await res.clone().json();
    (Array.isArray(json) ? json : [json]).forEach((r, i) => { if (lats[i] !== undefined) store[pointKey(u, lats[i], lons[i])] = r; });
    return new Response(JSON.stringify(json), { status: res.status, headers: { 'content-type': 'application/json' } });
  };
}

const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } = require(path.join(root, 'services/weatherService.ts'));

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const regions = readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json').map((file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profiles = {};
    for (const p of Object.values(JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {})) if (p?.beachId != null) profiles[p.beachId] = p;
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch { return null; }
}).filter(r => r && r.regionPoint && Number.isFinite(r.regionPoint.lat))
  .filter(r => !argVal('--regions') || argVal('--regions').split(',').includes(r.regionId));

const r2 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const rows = [];
const skipped = [];
for (const region of regions) {
  try {
    const res = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
    const [windByPoint, marineByPoint] = await Promise.all([fetchForecastDataBatch([region.regionPoint]), fetchMarineForecastDataBatch(res.points)]);
    const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
    if (!wind) { skipped.push(`${region.regionId}: χωρίς άνεμο`); continue; }
    const regionDay = processForecastData(mergeMarineForecastData(wind.data, marineByPoint.get(res.regionKey)?.data ?? []))[0];
    if (!regionDay) { skipped.push(`${region.regionId}: χωρίς μέρα`); continue; }
    for (const beach of region.beaches) {
      const key = res.keyByBeachId.get(beach.id);
      const bm = key !== res.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const day = bm.length ? applyMarineToDailyForecast(regionDay, bm) : regionDay;
      const profile = region.profiles[beach.id];
      for (const hour of HOURS) {
        if (!day.hourly?.[hour]) continue;
        const slice = { ...day, ...day.hourly[hour], hourly: day.hourly };
        const s = calculateBeachScore(beach, slice, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: day.hourly, geospatialProfile: profile });
        const dir = slice.marine?.waveDirectionDeg;
        const facing = s?.facingDeg;
        const onshore = typeof dir === 'number' && typeof facing === 'number' ? Math.cos(((dir - facing) * Math.PI) / 180) : null;
        rows.push([beach.id, region.regionId, hour, s?.swimmingComfort ?? null, r2(s?.shoreDisplayWaveM), r2(s?.seaStateWaveM), s?.seaArrivalExposureLevel ?? null, s?.windBeaufort ?? null, r2(onshore)]);
      }
    }
    process.stderr.write(`\r  ${regions.indexOf(region) + 1}/${regions.length} περιοχές · ${rows.length} παραλίες-ώρες`);
    if (RECORD) await new Promise(r => setTimeout(r, 150));
  } catch (e) { skipped.push(`${region.regionId}: ${e.message}`); }
}
process.stderr.write('\n');
if (RECORD) { mkdirSync(path.dirname(path.resolve(root, RECORD)), { recursive: true }); writeFileSync(path.resolve(root, RECORD), JSON.stringify(store)); }
const weather = process.env.OPEN_METEO_REPLAY ? `replay-${process.env.OPEN_METEO_REPLAY}` : new Date().toISOString().slice(0, 10);
const label = argVal('--label', REPLAY ? 'μετά' : 'πριν');
if (OUT) { mkdirSync(path.dirname(path.resolve(root, OUT)), { recursive: true }); writeFileSync(path.resolve(root, OUT), JSON.stringify({ label, weather, generatedAt: new Date().toISOString(), cols: COLS, skipped, rows })); }
const mild = rows.filter(r => MILD.has(r[3])).length;
const edge = rows.filter(r => MILD.has(r[3]) && r[6] === 'exposed' && (r[8] ?? -1) >= STRAIGHT - 1e-9 && (printed(r[4]) ?? 0) >= 0.5 - 1e-9);
console.log(`${label} · ${weather} · περιοχές ${regions.length - skipped.length}/${regions.length} · παραλίες-ώρες ${rows.length} · «Καλή/Ιδανική» ${mild} · από αυτές ίσια (≥${STRAIGHT}) ≥0,5 τυπωμένο: ${edge.length} (${new Set(edge.map(r => r[0])).size} παραλίες)`);
if (skipped.length) console.log(`  παραλείφθηκαν: ${skipped.slice(0, 5).join(' · ')}`);
