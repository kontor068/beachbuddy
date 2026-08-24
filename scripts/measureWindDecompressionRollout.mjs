#!/usr/bin/env node
/**
 * ΤΟ ΕΘΝΙΚΟ ΠΡΙΝ/ΜΕΤΑ ΤΗΣ ΑΠΟΣΥΜΠΙΕΣΗΣ ΑΝΕΜΟΥ (24/08/2026) — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * Η διόρθωση μπήκε με τη σειρά της βίβλου: μέτρηση (measureWindDecompression, 4 παράθυρα,
 * 30 σταθμοί) → απόφαση Μίλτου → ΑΥΤΟ το εθνικό πριν/μετά → πύλη (validateGustFloorContract).
 * Εδώ απαντιέται το «τι θα δει αύριο ο επισκέπτης που έβλεπε κάτι άλλο χθες»: κάθε παραλία,
 * κάθε ώρα ημέρας (10:00-19:00, σήμερα+αύριο), σκοράρεται με ΤΟΝ ΧΘΕΣΙΝΟ κανόνα και με τον
 * σημερινό, και μετριούνται οι διαφορές σε χλμ/ώ, Μποφόρ και χρώμα πινέζας.
 *
 * Ο «χθεσινός κανόνας» είναι ΠΑΓΩΜΕΝΟ ΑΝΤΙΓΡΑΦΟ του applyGustFloor όπως ήταν πριν τις
 * 24/08/2026 (δάπεδος ριπής και στα χερσαία) — επίτηδες αντίγραφο και όχι import: το ζωντανό
 * αρχείο πλέον ΕΙΝΑΙ ο νέος κανόνας, και ένα πριν/μετά που διαβάζει δύο φορές το «μετά»
 * μετράει πάντα μηδέν. Δεν στηρίζει κανένα συμπέρασμα της βίβλου πέρα από αυτό το rollout.
 *
 * ΟΡΙΑ: στιγμιότυπο ενός κύκλου πρόγνωσης, μόνο άνεμος → χρώμα (χωρίς θάλασσα/όρμο — ίδια
 * απλοποίηση με το listGustFloorChangedBeaches)· λέει την ΕΜΒΕΛΕΙΑ της αλλαγής, όχι αν το νέο
 * νούμερο είναι σωστότερο — αυτό το είπαν τα 3 ξένα παράθυρα της μέτρησης.
 *
 *   OPEN_METEO_API_KEY=… node scripts/measureWindDecompressionRollout.mjs
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
  }).outputText, filename);
};

const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor, GUST_FLOOR_FACTOR, INCOHERENT_GUST_RATIO } = require(path.join(root, 'utils/windGustFloor.ts'));

/** Ο ΧΘΕΣΙΝΟΣ κανόνας (πριν 24/08/2026), παγωμένος — δες την κεφαλίδα για το γιατί αντίγραφο. */
const oldProduction = (speed, gust, elev) => {
  if (!Number.isFinite(speed)) return speed;
  if (typeof gust !== 'number' || !Number.isFinite(gust) || gust <= 0) return speed;
  if (typeof elev !== 'number' || !Number.isFinite(elev)) return speed;
  if (elev <= 0 && !(speed > 0 && gust / speed >= INCOHERENT_GUST_RATIO)) return speed;
  return Math.max(speed, gust * GUST_FLOOR_FACTOR);
};

const API_KEY = process.env.OPEN_METEO_API_KEY?.trim() || null;
if (!API_KEY) { console.error('Θέλει OPEN_METEO_API_KEY στο περιβάλλον (εθνική λήψη).'); process.exit(1); }

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = deg => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const beachDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const points = new Map();
const plan = [];
for (const file of fs.readdirSync(beachDir).filter(f => f.endsWith('.json'))) {
  const regionId = file.replace(/\.json$/, '');
  let beaches;
  try { beaches = readJson(path.join(beachDir, file)).island?.beaches ?? []; } catch { continue; }
  if (!beaches.length) continue;
  let profiles = {};
  try { profiles = readJson(path.join(exposureDir, `${regionId}.json`)).profiles ?? {}; } catch { /* χωρίς γεωμετρία */ }
  const byId = new Map(beaches.map(b => [b.id, b]));
  for (const cluster of buildBeachForecastClusters(beaches)) {
    const key = `${cluster.lat.toFixed(4)},${cluster.lon.toFixed(4)}`;
    if (!points.has(key)) points.set(key, { key, lat: cluster.lat, lon: cluster.lon, hourly: null, elevation: null });
    for (const id of cluster.beachIds) {
      if (!byId.has(id)) continue;
      plan.push({ regionId, beachId: id, pointKey: key, profile: profiles[String(id)] ?? null });
    }
  }
}

const pointList = [...points.values()];
console.log(`${plan.length} παραλίες · ${pointList.length} σημεία ανέμου — λήψη...`);
const BATCH = 20;
for (let i = 0; i < pointList.length; i += BATCH) {
  const slice = pointList.slice(i, i + BATCH);
  const url = 'https://customer-api.open-meteo.com/v1/forecast'
    + `?latitude=${slice.map(p => p.lat).join(',')}&longitude=${slice.map(p => p.lon).join(',')}`
    + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh'
    + `&timezone=Europe%2FAthens&forecast_days=2&apikey=${encodeURIComponent(API_KEY)}`;
  let data = null;
  for (let a = 0; a < 3 && !data; a++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      if (a === 2) { console.error('αποτυχία:', e.message); process.exit(1); }
      await new Promise(r => setTimeout(r, 1500 * (a + 1)));
    }
  }
  (Array.isArray(data) ? data : [data]).forEach((entry, k) => {
    if (!slice[k]) return;
    slice[k].hourly = entry.hourly;
    slice[k].elevation = typeof entry.elevation === 'number' ? entry.elevation : null;
  });
  process.stderr.write(`\r  ${Math.min(i + BATCH, pointList.length)}/${pointList.length}`);
}
process.stderr.write('\n');

// Δίχτυ πάνω στο εργαλείο: το αντίγραφο του χθεσινού κανόνα πρέπει να ΔΙΑΦΕΡΕΙ από τον
// ζωντανό σε χερσαίο κελί (αλλιώς μετράμε το «μετά» δύο φορές και η αναφορά λέει ψέματα ήσυχα).
if (oldProduction(10, 12, 120) === applyGustFloor(10, 12, 120)) {
  console.error('ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: ο «χθεσινός» και ο σημερινός κανόνας συμπίπτουν σε χερσαίο κελί.');
  process.exit(1);
}

const stats = {
  hours: 0, changedKmh: 0, up: 0, down: 0, deltas: [],
  bftChanged: 0, bftUp: 0, bftDown: 0,
  toneChanged: 0, toneStricter: 0, toneSofter: 0, toneMoves: {},
  beachesTone: new Set(), beachesToneSofter: new Set(), beachesBft: new Set(), beachesAll: new Set(),
  seaCellHours: 0, seaCellChanged: 0,
  byExposure: {},
};
const TONE_ORDER = ['blue', 'yellow', 'orange', 'red'];

for (const item of plan) {
  const point = points.get(item.pointKey);
  if (!point?.hourly) continue;
  const h = point.hourly;
  for (let idx = 0; idx < h.time.length; idx++) {
    const hour = Number(h.time[idx].slice(11, 13));
    if (hour < 10 || hour > 19) continue;
    const raw = h.wind_speed_10m[idx];
    const gust = h.wind_gusts_10m?.[idx];
    const deg = h.wind_direction_10m[idx];
    if (typeof raw !== 'number' || typeof deg !== 'number') continue;
    stats.hours += 1;
    stats.beachesAll.add(item.beachId);
    const isSea = typeof point.elevation === 'number' && point.elevation <= 0;
    if (isSea) stats.seaCellHours += 1;

    const before = oldProduction(raw, gust, point.elevation);
    const after = applyGustFloor(raw, gust, point.elevation);
    const delta = after - before;
    if (Math.abs(delta) > 0.005) {
      stats.changedKmh += 1;
      stats.deltas.push(delta);
      if (delta > 0) stats.up += 1; else stats.down += 1;
      if (isSea) stats.seaCellChanged += 1;
    }

    const bBefore = getBeaufortLevel(before), bAfter = getBeaufortLevel(after);
    const exposureLevel = item.profile?.sectors?.[sectorOf(deg)]?.level ?? 'partial';
    stats.byExposure[exposureLevel] ??= { hours: 0, bftChanged: 0, toneChanged: 0 };
    stats.byExposure[exposureLevel].hours += 1;
    if (bBefore !== bAfter) {
      stats.bftChanged += 1;
      stats.beachesBft.add(item.beachId);
      stats.byExposure[exposureLevel].bftChanged += 1;
      if (bAfter > bBefore) stats.bftUp += 1; else stats.bftDown += 1;

      // Το χρώμα κρίνεται ΜΟΝΟ όταν άλλαξε το Μποφόρ — αλλιώς είναι ίδιο εξ ορισμού εδώ.
      const toneBefore = resolveConditionTone({ exposureLevel, beaufort: bBefore, isEnclosedCove: false, seaStateM: undefined });
      const toneAfter = resolveConditionTone({ exposureLevel, beaufort: bAfter, isEnclosedCove: false, seaStateM: undefined });
      if (toneBefore !== toneAfter) {
        stats.toneChanged += 1;
        stats.beachesTone.add(item.beachId);
        stats.byExposure[exposureLevel].toneChanged += 1;
        const move = `${toneBefore} → ${toneAfter}`;
        stats.toneMoves[move] = (stats.toneMoves[move] ?? 0) + 1;
        if (TONE_ORDER.indexOf(toneAfter) > TONE_ORDER.indexOf(toneBefore)) stats.toneStricter += 1;
        else { stats.toneSofter += 1; stats.beachesToneSofter.add(item.beachId); }
      }
    }
  }
}

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};
const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

console.log(`\nΏρες ημέρας που κρίθηκαν: ${stats.hours} σε ${stats.beachesAll.size} παραλίες (σήμερα+αύριο).`);
console.log(`\n── ΤΟ ΝΟΥΜΕΡΟ ────────────────────────────────────────────────────────`);
console.log(`  αλλάζει σε ${stats.changedKmh} ώρες (${pct(stats.changedKmh, stats.hours)}) · πάνω ${stats.up} · κάτω ${stats.down}`);
console.log(`  διάμεση μεταβολή ${percentile(stats.deltas.map(Math.abs), 0.5).toFixed(1)} χλμ/ώ · p90 ${percentile(stats.deltas.map(Math.abs), 0.9).toFixed(1)} · max ${(stats.deltas.length ? Math.max(...stats.deltas.map(Math.abs)) : 0).toFixed(1)}`);
console.log(`  θαλάσσια κελιά: ${stats.seaCellChanged}/${stats.seaCellHours} ώρες αλλάζουν (πρέπει να είναι 0 — η εξαίρεση μένει)`);
console.log(`\n── ΤΟ ΜΠΟΦΟΡ ─────────────────────────────────────────────────────────`);
console.log(`  αλλάζει σε ${stats.bftChanged} ώρες (${pct(stats.bftChanged, stats.hours)}) σε ${stats.beachesBft.size} παραλίες · πάνω ${stats.bftUp} · κάτω ${stats.bftDown}`);
console.log(`\n── ΤΟ ΧΡΩΜΑ (μόνο άνεμος, χωρίς θάλασσα) ─────────────────────────────`);
console.log(`  αλλάζει σε ${stats.toneChanged} ώρες σε ${stats.beachesTone.size} παραλίες · αυστηρότερο ${stats.toneStricter} · ηπιότερο ${stats.toneSofter} (σε ${stats.beachesToneSofter.size} παραλίες)`);
for (const [move, count] of Object.entries(stats.toneMoves).sort((a, b) => b[1] - a[1])) console.log(`    ${move}: ${count}`);
console.log(`\n── ΑΝΑ ΕΚΘΕΣΗ ────────────────────────────────────────────────────────`);
for (const [level, d] of Object.entries(stats.byExposure).sort((a, b) => b[1].hours - a[1].hours)) {
  console.log(`  ${level}: ${d.hours} ώρες · Μποφόρ αλλάζει ${d.bftChanged} · χρώμα ${d.toneChanged}`);
}

if (stats.seaCellChanged > 0) {
  console.error('\nΑΠΕΤΥΧΕ: η αποσυμπίεση άγγιξε θαλάσσιο κελί — η εξαίρεση έσπασε.');
  process.exit(1);
}

const reportPath = path.join(root, 'reports/weather', `wind-decompression-rollout-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  hours: stats.hours,
  beaches: stats.beachesAll.size,
  changedKmhHours: stats.changedKmh, up: stats.up, down: stats.down,
  medianAbsDeltaKmh: Number(percentile(stats.deltas.map(Math.abs), 0.5).toFixed(1)),
  p90AbsDeltaKmh: Number(percentile(stats.deltas.map(Math.abs), 0.9).toFixed(1)),
  seaCellHours: stats.seaCellHours, seaCellChanged: stats.seaCellChanged,
  bftChangedHours: stats.bftChanged, bftUp: stats.bftUp, bftDown: stats.bftDown, beachesBftChanged: stats.beachesBft.size,
  toneChangedHours: stats.toneChanged, toneStricter: stats.toneStricter, toneSofter: stats.toneSofter,
  beachesToneChanged: stats.beachesTone.size, beachesToneSofter: stats.beachesToneSofter.size,
  toneMoves: stats.toneMoves,
  byExposure: stats.byExposure,
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
