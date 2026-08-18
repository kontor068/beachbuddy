#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΣΤΟ ΙΔΙΟ ΤΟ SITE Ο ΔΑΠΕΔΟΣ ΡΙΠΗΣ — μέτρηση πριν πάει live, όχι πύλη.
 *
 * Το `utils/windGustFloor.ts` δικαιολογείται από 32.000 μετρήσεις έναντι ανεμομέτρων. Αυτό εδώ
 * απαντά την ΑΛΛΗ ερώτηση, που καμία μέτρηση ακρίβειας δεν απαντά: πόσες παραλίες αλλάζουν
 * χρώμα στον χάρτη, και προς τα πού.
 *
 *   node scripts/measureGustFloorImpact.mjs [--national]
 *
 * Τρέχει ΤΟΝ ΙΔΙΟ κώδικα χρώματος με την εφαρμογή (utils/suitabilityTone) πάνω στα ΙΔΙΑ σημεία
 * ανέμου (utils/beachForecastClusters), μία φορά με τον ωμό μέσο και μία με τον δάπεδο ριπής.
 * Καμία επανυλοποίηση — scripts/validateEffectiveRanking.ts καταγράφει τι κοστίζει αυτό.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/gust-floor-impact-<ημερομηνία>.json.
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
const { applyGustFloor, GUST_FLOOR_FACTOR } = require(path.join(root, 'utils/windGustFloor.ts'));

const NATIONAL = process.argv.includes('--national');
const HOURS = ['T09:00', 'T12:00', 'T15:00', 'T18:00'];
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = deg => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);

const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
const API_KEY = ((await envRes.json()).values || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('χωρίς κλειδί'); process.exit(1); }

// ── σχέδιο: κάθε παραλία με το σημείο ανέμου της και τη γεωμετρία της ─────────
const beachDir = path.join(root, 'public/data/beaches/app');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));

const regions = fs.readdirSync(beachDir).filter(f => f.endsWith('.json')).map(f => {
  const id = f.replace(/\.json$/, '');
  let raw;
  try { raw = readJson(path.join(beachDir, f)); } catch { return null; }
  const beaches = raw.island?.beaches ?? [];
  return beaches.length ? { id, beaches } : null;
}).filter(Boolean);

const sample = NATIONAL ? regions
  : [...regions].sort((a, b) => b.beaches.length - a.beaches.length).slice(0, 20);

const points = new Map();
const plan = [];
for (const region of sample) {
  let profiles = {};
  try { profiles = readJson(path.join(exposureDir, `${region.id}.json`)).profiles ?? {}; } catch { /* χωρίς γεωμετρία */ }
  for (const cluster of buildBeachForecastClusters(region.beaches)) {
    const key = `${cluster.lat.toFixed(4)},${cluster.lon.toFixed(4)}`;
    if (!points.has(key)) points.set(key, { key, lat: cluster.lat, lon: cluster.lon, hourly: null, elevation: null });
    for (const id of cluster.beachIds) {
      plan.push({ region: region.id, beachId: id, pointKey: key, profile: profiles[String(id)] ?? null });
    }
  }
}
const pointList = [...points.values()];
console.log(`${sample.length} περιοχές · ${plan.length} παραλίες · ${pointList.length} σημεία ανέμου · δάπεδο ${GUST_FLOOR_FACTOR}`);

// ── λήψη ──────────────────────────────────────────────────────────────────────
const BATCH = 20;
for (let i = 0; i < pointList.length; i += BATCH) {
  const slice = pointList.slice(i, i + BATCH);
  const url = 'https://customer-api.open-meteo.com/v1/forecast'
    + `?latitude=${slice.map(p => p.lat).join(',')}&longitude=${slice.map(p => p.lon).join(',')}`
    + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh'
    + `&timezone=Europe%2FAthens&forecast_days=3&apikey=${encodeURIComponent(API_KEY)}`;
  let data = null;
  for (let a = 0; a < 3 && !data; a++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (e) {
      if (a === 2) { console.error('αποτυχία λήψης:', e.message); process.exit(1); }
      await new Promise(r => setTimeout(r, 1500 * (a + 1)));
    }
  }
  (Array.isArray(data) ? data : [data]).forEach((entry, k) => {
    if (!slice[k]) return;
    slice[k].hourly = entry.hourly;
    // Το υψόμετρο του ΚΕΛΙΟΥ — ο δάπεδος ριπής δεν επιτρέπεται πάνω από νερό (utils/windGustFloor).
    slice[k].elevation = typeof entry.elevation === 'number' ? entry.elevation : null;
  });
  process.stdout.write(`\r  ${Math.min(i + BATCH, pointList.length)}/${pointList.length}`);
}
console.log('');

// ── σύγκριση χρώματος ─────────────────────────────────────────────────────────
let slots = 0, changed = 0, worse = 0, better = 0, bftChanged = 0;
const CALM = new Set(['blue']);
let calmLost = 0;                 // ήταν «πάμε» και έγινε κάτι άλλο
let calmGained = 0;
const moves = new Map();          // «από→προς» -> πλήθος
const byRegion = new Map();
const beachesTouched = new Set();

for (const item of plan) {
  const point = points.get(item.pointKey);
  if (!point?.hourly) continue;
  const h = point.hourly;
  for (let idx = 0; idx < h.time.length; idx++) {
    if (!HOURS.some(suffix => h.time[idx].endsWith(suffix))) continue;
    const raw = h.wind_speed_10m[idx];
    const gust = h.wind_gusts_10m?.[idx];
    const deg = h.wind_direction_10m[idx];
    if (typeof raw !== 'number' || typeof deg !== 'number') continue;
    const corrected = applyGustFloor(raw, gust, point.elevation);
    slots++;
    const bOld = getBeaufortLevel(raw), bNew = getBeaufortLevel(corrected);
    if (bOld !== bNew) bftChanged++;
    const exposureLevel = item.profile?.sectors?.[sectorOf(deg)]?.level ?? 'partial';
    const toneOld = resolveConditionTone({ exposureLevel, beaufort: bOld, isEnclosedCove: false, seaStateM: undefined });
    const toneNew = resolveConditionTone({ exposureLevel, beaufort: bNew, isEnclosedCove: false, seaStateM: undefined });
    if (toneOld === toneNew) continue;
    changed++;
    beachesTouched.add(item.beachId);
    moves.set(`${toneOld}→${toneNew}`, (moves.get(`${toneOld}→${toneNew}`) ?? 0) + 1);
    if (CALM.has(toneOld) && !CALM.has(toneNew)) calmLost++;
    if (!CALM.has(toneOld) && CALM.has(toneNew)) calmGained++;
    if (bNew > bOld) worse++; else better++;
    const rg = byRegion.get(item.region) ?? { slots: 0, changed: 0 };
    rg.changed++; byRegion.set(item.region, rg);
  }
  const rg = byRegion.get(item.region) ?? { slots: 0, changed: 0 };
  byRegion.set(item.region, rg);
}

console.log(`\n=== ΕΠΙΠΤΩΣΗ (${slots} παραλία-ώρες, 3 ημέρες × 4 ώρες) ===`);
console.log(`  αλλάζει το Μποφόρ            ${bftChanged} = ${pct(bftChanged, slots)}%`);
console.log(`  ΑΛΛΑΖΕΙ ΤΟ ΧΡΩΜΑ             ${changed} = ${pct(changed, slots)}%`);
console.log(`  παραλίες που αγγίζονται      ${beachesTouched.size} από ${new Set(plan.map(p => p.beachId)).size}`);
console.log(`  προς το αυστηρότερο          ${worse} (${pct(worse, changed)}% των αλλαγών)`);
console.log(`  προς το ηπιότερο             ${better}`);
console.log(`\n  χάνει το «πάμε» (μπλε→άλλο) ${calmLost} = ${pct(calmLost, slots)}% των παραλία-ωρών`);
console.log(`  κερδίζει «πάμε»              ${calmGained}`);

console.log('\n=== ΠΟΙΕΣ ΜΕΤΑΚΙΝΗΣΕΙΣ ===');
for (const [move, count] of [...moves.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`  ${String(count).padStart(6)} · ${move}`);
}

const worstRegions = [...byRegion.entries()].map(([id, v]) => ({ region: id, changed: v.changed }))
  .sort((a, b) => b.changed - a.changed).slice(0, 8);
console.log('\n=== ΠΕΡΙΟΧΕΣ ΜΕ ΤΙΣ ΠΕΡΙΣΣΟΤΕΡΕΣ ΑΛΛΑΓΕΣ ===');
for (const r of worstRegions) console.log(`  ${String(r.changed).padStart(6)} αλλαγές · ${r.region}`);

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `gust-floor-impact-${new Date().toISOString().slice(0, 10)}.json`);
const tmp = `${out}.tmp`;
fs.writeFileSync(tmp, JSON.stringify({
  generatedAt: new Date().toISOString(), national: NATIONAL, factor: GUST_FLOOR_FACTOR,
  regions: sample.length, beaches: new Set(plan.map(p => p.beachId)).size, points: pointList.length,
  slots, bftChanged, bftChangedPct: pct(bftChanged, slots),
  toneChanged: changed, toneChangedPct: pct(changed, slots), beachesTouched: beachesTouched.size,
  stricter: worse, milder: better, calmLost, calmLostPct: pct(calmLost, slots), calmGained,
  moves: Object.fromEntries(moves), worstRegions,
}, null, 2), 'utf8');
fs.renameSync(tmp, out);
console.log(`\nαναφορά: ${path.relative(root, out)}`);
