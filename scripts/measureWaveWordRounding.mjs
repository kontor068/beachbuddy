#!/usr/bin/env node
/**
 * ΠΟΣΕΣ ΩΡΕΣ Η ΛΕΞΗ ΤΗΣ ΚΑΡΤΑΣ ΔΙΕΨΕΥΔΕ ΤΟ ΝΟΥΜΕΡΟ ΔΙΠΛΑ ΤΗΣ — εθνική μέτρηση, report-only.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (02/09/2026, Αρίλλα Θεσπρωτίας #890, 15:00). Κάρτα «θάλασσα λάδι», σελίδα
 * «0,2 μ.», άμμος με κυματάκι. Ο ίδιος αριθμός (0,15–0,199) τυπωνόταν στρογγυλεμένος στο 0,1 και
 * κρινόταν ωμός από τη βαθμίδα της λέξης. Η διόρθωση (utils/conditionsFeelPhrase.waveFeelLevel
 * κρίνει στο atDisplayedPrecisionM) αγγίζει ΜΟΝΟ τις ωμές τιμές στα 0,05 μ. κάτω από κάθε κατώφλι
 * (0,15–0,199 · 0,35–0,399 · 0,75–0,799 · 1,15–1,199), και μόνο προς την προσοχή. Αυτό εδώ λέει
 * ΠΟΣΕΣ ώρες-παραλίας είναι αυτές, ανά ζώνη και ανά περιοχή, ώστε το αποτύπωμα να είναι μετρημένο
 * και όχι υποθετικό (η βίβλος ζητά 5–15% για «πληροφορία, όχι ταπετσαρία»).
 *
 * ΔΕΔΟΜΕΝΑ: οι ΙΔΙΕΣ cache ημέρας με το scripts/measureWaveWordArrivalGate.mjs (άνεμος από
 * measureShelterWordLandGate.mjs, κύμα ewam στο marineSamplePoint). Δεν κάνει καμία κλήση αν οι
 * cache υπάρχουν· αλλιώς φέρνει το κύμα (paid/proxied) και το γράφει στον δίσκο.
 *
 *   node scripts/measureShelterWordLandGate.mjs --days=3     # (μία φορά, γεμίζει τον άνεμο)
 *   node scripts/measureWaveWordRounding.mjs --days=3 [--limit=400]
 *
 * Η ΠΡΟΣΕΓΓΙΣΗ ΤΟΥ ΤΥΠΩΜΕΝΟΥ ΑΡΙΘΜΟΥ είναι ίδια με του measureWaveWordArrivalGate: max(πλέγμα, SMB
 * στη γωνία όταν ο άνεμος μπαίνει), χωρίς γκρεμό/όρμο — δηλαδή ελαφρά ΑΝΩ εκτίμηση των ωρών.
 */
import './lib/paidOpenMeteo.mjs';
import './lib/proxiedOpenMeteo.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { waveFeelLevel } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
const { estimateFetchLimitedWaveHeightM, printedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { atDisplayedPrecisionM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } = require(path.join(root, 'utils/waveCharacter.ts'));

const arg = (name, dflt) => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? hit.split('=')[1] : dflt; };
const DAYS = Number(arg('days', '3'));
const LIMIT = Number(arg('limit', '0'));
const PACE_MS = Number(arg('pace', '1500'));
const DAY_START = 9, DAY_END = 19;
const TODAY = new Date().toISOString().slice(0, 10);
const WITNESS_IDS = new Set([890, 445, 1165, 636]);
const WAVE_WORDS = ['θάλασσα λάδι', 'σχεδόν χωρίς κύμα', 'λίγο κύμα', 'αρκετό κύμα', 'μεγάλο κύμα'];
const THRESHOLDS = [0.2, 0.4, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M];

/** Η ΠΑΛΙΑ βαθμίδα (ωμή τιμή) — γραμμένη εδώ ως μάρτυρας του «πριν», όχι ως δεύτερη υλοποίηση. */
const rawLevel = m => (m < 0.2 ? 0 : m < 0.4 ? 1 : m < SEA_STATE_AMBER_M ? 2 : m < SEA_STATE_ROUGH_M ? 3 : 4);

const sleep = ms => new Promise(r => setTimeout(r, ms));
const pct = (n, d) => (d ? Math.round(10000 * n / d) / 100 : 0);
const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      const j = await res.json();
      if (j?.error) throw new Error(j.reason || 'upstream error');
      return j;
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
};

// ── 1. ΠΑΡΑΛΙΕΣ — ίδια σειρά φόρτωσης με measureShelterWordLandGate (η cache είναι πίνακες) ──
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const bakedCells = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells;
const seaCellGate = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8')).cells || {};
const beaches = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload; try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const list = payload.island?.beaches || []; if (!list.length) continue;
  const profiles = {};
  try { const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8')); for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' }; } catch { /* χωρίς γεωμετρία */ }
  for (const beach of list) {
    const lat = beach.coordinates?.lat, lon = beach.coordinates?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cell = beach.forecastCell || bakedCells[String(beach.id)]; if (!cell) continue;
    beaches.push({ beach, regionId, lat, lon, cell, profile: profiles[beach.id], usesSeaCell: Boolean(seaCellGate[String(beach.id)]), waterDepth: beach.waterDepth });
  }
}
const cellKeysAll = [...new Set(beaches.map(b => b.cell))];
const seaAll = beaches.filter(b => b.usesSeaCell);

// ── 2. ΑΝΕΜΟΣ ΑΠΟ ΤΗ CACHE ΤΗΣ ΗΜΕΡΑΣ ────────────────────────────────────────────────────
const cacheDir = path.join(root, '.tmp');
const landFile = path.join(cacheDir, `shelter-word-land-${DAYS}d-${TODAY}.json`);
const seaFile = path.join(cacheDir, `shelter-word-sea-${DAYS}d-${TODAY}.json`);
if (!fs.existsSync(landFile) || !fs.existsSync(seaFile)) { console.error(`Λείπει η cache ανέμου της ημέρας (${landFile}). Τρέξε πρώτα measureShelterWordLandGate.mjs --days=${DAYS}.`); process.exit(1); }
const landRows = JSON.parse(fs.readFileSync(landFile, 'utf8'));
const seaRows = JSON.parse(fs.readFileSync(seaFile, 'utf8'));
if (landRows.length !== cellKeysAll.length || seaRows.length !== seaAll.length) { console.error(`Η cache δεν ταιριάζει: land ${landRows.length}/${cellKeysAll.length}, sea ${seaRows.length}/${seaAll.length}`); process.exit(1); }
const landByCell = new Map(cellKeysAll.map((k, i) => [k, { time: landRows[i].hourly.time, speed: landRows[i].hourly.wind_speed_10m, dir: landRows[i].hourly.wind_direction_10m, gust: landRows[i].hourly.wind_gusts_10m, elevation: landRows[i].elevation }]));
const seaByBeachId = new Map(seaAll.map((b, i) => [b.beach.id, { time: seaRows[i].hourly.time, speed: seaRows[i].hourly.wind_speed_10m, dir: seaRows[i].hourly.wind_direction_10m, gust: seaRows[i].hourly.wind_gusts_10m, elevation: seaRows[i].elevation ?? 0 }]));
console.log(`Άνεμος: από cache (${path.relative(root, landFile)} + sea)`);

// ── 3. ΔΕΙΓΜΑ + ΚΥΜΑ (ewam, sea cell, στο marineSamplePoint) — ίδια cache με το arrival gate ──
const withGeom = beaches.filter(b => b.profile?.marineSamplePoint && Number.isFinite(b.profile.facingDeg));
const sample = LIMIT
  ? withGeom.filter(b => WITNESS_IDS.has(b.beach.id)).concat(withGeom.filter((b, i) => !WITNESS_IDS.has(b.beach.id) && i % Math.max(1, Math.floor(withGeom.length / LIMIT)) === 0).slice(0, LIMIT))
  : withGeom;
const pointKey = p => `${p.lat.toFixed(3)}_${p.lon.toFixed(3)}`;
const points = []; const seenPt = new Map();
for (const b of sample) { const k = pointKey(b.profile.marineSamplePoint); if (!seenPt.has(k)) { seenPt.set(k, points.length); points.push({ lat: b.profile.marineSamplePoint.lat, lon: b.profile.marineSamplePoint.lon }); } b.ptIndex = seenPt.get(k); }
console.log(`Παραλίες: ${sample.length.toLocaleString('el-GR')} · θαλάσσια σημεία: ${points.length.toLocaleString('el-GR')} · ${DAYS} ημέρες`);

const marineFile = path.join(cacheDir, `wave-word-marine-${DAYS}d-${TODAY}-${LIMIT || 'all'}.json`);
let marineRows;
if (fs.existsSync(marineFile)) { marineRows = JSON.parse(fs.readFileSync(marineFile, 'utf8')); console.log(`  κύμα: από τον δίσκο (${path.relative(root, marineFile)})`); }
else {
  marineRows = [];
  const CHUNK = 32;
  for (let i = 0; i < points.length; i += CHUNK) {
    if (i) await sleep(PACE_MS);
    const c = points.slice(i, i + CHUNK);
    const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=wave_height,wave_direction,wave_period&forecast_days=${DAYS}&timezone=Europe%2FAthens&cell_selection=sea&models=ewam`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`Το marine γύρισε ${rows.length} για ${c.length}`);
    marineRows.push(...rows);
    process.stdout.write(`\r  κύμα: ${marineRows.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  fs.writeFileSync(marineFile, JSON.stringify(marineRows));
}

// ── 4. Η ΜΕΤΡΗΣΗ ────────────────────────────────────────────────────────────────────────
const blank = () => ({ hours: 0, changed: 0, byBand: Object.fromEntries(THRESHOLDS.map(t => [String(t), 0])) });
const total = blank(); const byRegion = new Map();
const histBefore = [0, 0, 0, 0, 0], histAfter = [0, 0, 0, 0, 0];
const changedBeaches = new Set();
const witnessLog = new Map();
const samples = [];
let lowered = 0, jumpedTwo = 0;

for (const b of sample) {
  const m = marineRows[b.ptIndex]?.hourly; if (!m?.time) continue;
  const feed = (b.usesSeaCell && seaByBeachId.get(b.beach.id)) || null;
  const land = landByCell.get(b.cell); if (!land) continue;
  const region = byRegion.get(b.regionId) || blank(); byRegion.set(b.regionId, region);
  for (let h = 0; h < m.time.length; h++) {
    const hour = Number(m.time[h].slice(11, 13)); if (hour < DAY_START || hour > DAY_END) continue;
    const hs = m.wave_height?.[h];
    if (!Number.isFinite(hs)) continue;
    const wi = land.time.indexOf(m.time[h]); if (wi < 0) continue;
    let speed, deg;
    if (feed && Number.isFinite(feed.speed?.[wi]) && Number.isFinite(feed.dir?.[wi])) { speed = applyGustFloor(feed.speed[wi], feed.gust?.[wi], feed.elevation ?? 0); deg = feed.dir[wi]; }
    else if (Number.isFinite(land.speed?.[wi]) && Number.isFinite(land.dir?.[wi])) { speed = applyGustFloor(land.speed[wi], land.gust?.[wi], land.elevation); deg = land.dir[wi]; }
    else continue;
    const bft = getBeaufortLevel(speed);
    let modeled = 0;
    try { const g = interpolateSectorGeometry(b.profile, deg); if (onshoreComponent(deg, b.profile.facingDeg) > 0.2) modeled = estimateFetchLimitedWaveHeightM({ windSpeedKmh: speed, fetchKm: g.fetchKm }); } catch { /* χωρίς τομείς */ }
    const printedRaw = printedWaveHeightM(Math.max(hs, modeled)) ?? Math.max(hs, modeled);
    const before = rawLevel(printedRaw);           // η λέξη ΠΡΙΝ (ωμή τιμή)
    const after = waveFeelLevel(printedRaw);       // η λέξη ΤΩΡΑ (κώδικας παραγωγής)
    histBefore[before] += 1; histAfter[after] += 1;
    total.hours += 1; region.hours += 1;
    if (after < before) lowered += 1;
    if (after > before + 1) jumpedTwo += 1;
    if (after === before) continue;
    total.changed += 1; region.changed += 1; changedBeaches.add(b.beach.id);
    const band = THRESHOLDS.find(t => printedRaw < t && printedRaw >= t - 0.05);
    const bandKey = String(band ?? 'other');
    total.byBand[bandKey] = (total.byBand[bandKey] || 0) + 1; region.byBand[bandKey] = (region.byBand[bandKey] || 0) + 1;
    if (samples.length < 400) samples.push({ id: b.beach.id, name: b.beach.name?.gr || b.beach.name?.en, region: b.regionId, time: m.time[h], hs, printedRaw, shown: atDisplayedPrecisionM(printedRaw), bft, before: WAVE_WORDS[before], after: WAVE_WORDS[after], waterDepth: b.waterDepth });
    if (WITNESS_IDS.has(b.beach.id)) {
      const arr = witnessLog.get(b.beach.id) || []; witnessLog.set(b.beach.id, arr);
      arr.push({ time: m.time[h], hs, printedRaw, shown: atDisplayedPrecisionM(printedRaw), bft, before: WAVE_WORDS[before], after: WAVE_WORDS[after] });
    }
  }
}

// ── 5. ΑΝΑΦΟΡΑ ──────────────────────────────────────────────────────────────────────────
const line = (label, n, d) => `  ${label.padEnd(46)} ${String(n).padStart(7)}  (${pct(n, d)}%)`;
console.log(`\nΩΡΕΣ-ΠΑΡΑΛΙΑΣ 9-19 με μέτρηση: ${total.hours.toLocaleString('el-GR')} σε ${sample.length.toLocaleString('el-GR')} παραλίες`);
console.log('\nΚΑΤΑΝΟΜΗ ΛΕΞΕΩΝ ΠΡΙΝ → ΜΕΤΑ:');
WAVE_WORDS.forEach((w, i) => console.log(`  «${w}»`.padEnd(28) + `${String(histBefore[i]).padStart(7)} (${pct(histBefore[i], total.hours)}%) → ${String(histAfter[i]).padStart(7)} (${pct(histAfter[i], total.hours)}%)`));
console.log(`\nΩΡΕΣ ΠΟΥ Η ΛΕΞΗ ΔΙΕΨΕΥΔΕ ΤΟ ΤΥΠΩΜΕΝΟ ΝΟΥΜΕΡΟ (αλλάζουν, όλες κατά ένα σκαλί προς την προσοχή):`);
console.log(line('σύνολο', total.changed, total.hours));
for (const t of THRESHOLDS) console.log(line(`ζώνη ${(t - 0.05).toFixed(2)}–${t.toFixed(2)} → «${WAVE_WORDS[rawLevel(t)]}»`, total.byBand[String(t)] || 0, total.hours));
console.log(`  παραλίες με ≥1 τέτοια ώρα: ${changedBeaches.size} / ${sample.length}`);
console.log(`  ΑΣΦΑΛΕΙΑ: προς το ηρεμότερο ${lowered} (πρέπει 0) · πάνω από ένα σκαλί ${jumpedTwo} (πρέπει 0)`);

console.log('\nΜΑΡΤΥΡΕΣ:');
for (const id of WITNESS_IDS) {
  const b = sample.find(x => x.beach.id === id); const log = witnessLog.get(id) || [];
  if (!b) { console.log(`  #${id}: εκτός δείγματος`); continue; }
  console.log(`  #${id} ${b.beach.name?.gr || b.beach.name?.en} (βλέπει ${b.profile.facingDeg}°): ${log.length} ώρες αλλάζουν λέξη`);
  for (const l of log.slice(0, 4)) console.log(`     ${l.time.slice(5, 16)}  ωμό ${l.printedRaw} → τυπ. ${l.shown}  ${l.bft} Μπφ  «${l.before}» → «${l.after}»`);
}

const regionTable = [...byRegion.entries()].filter(([, r]) => r.hours >= 100).map(([id, r]) => ({ id, ...r, changedPct: pct(r.changed, r.hours) })).sort((a, b) => b.changedPct - a.changedPct);
console.log('\nΠΕΡΙΟΧΕΣ με τις περισσότερες αλλαγές (≥100 ώρες):');
for (const r of regionTable.slice(0, 12)) console.log(`  ${r.id.padEnd(42)} ώρες ${String(r.hours).padStart(6)}  αλλάζουν ${String(r.changed).padStart(5)} (${r.changedPct}%)`);

const outDir = path.join(root, 'reports/weather'); fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `wave-word-rounding-${TODAY}${LIMIT ? `-sample${LIMIT}` : ''}.json`);
fs.writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(), days: DAYS, limit: LIMIT || null, beaches: sample.length, marinePoints: points.length,
  approximation: 'printed ≈ max(ewam wave_height, SMB στη γωνία όταν ο άνεμος μπαίνει)· χωρίς γκρεμό/όρμο· άνεμος από cache της ημέρας (θαλάσσιο κελί όπου υπάρχει)',
  total, safety: { lowered, jumpedTwo }, histBefore: Object.fromEntries(WAVE_WORDS.map((w, i) => [w, histBefore[i]])), histAfter: Object.fromEntries(WAVE_WORDS.map((w, i) => [w, histAfter[i]])),
  changedBeaches: changedBeaches.size, byRegion: Object.fromEntries(byRegion), witnesses: Object.fromEntries(witnessLog), samples,
}, null, 2));
console.log(`\nΑναφορά: ${path.relative(root, out)}`);
