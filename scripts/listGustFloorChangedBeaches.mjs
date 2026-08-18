#!/usr/bin/env node
/**
 * ΠΟΙΕΣ ΠΑΡΑΛΙΕΣ ΔΕΙΧΝΟΥΝ ΑΛΛΟ ΠΡΑΓΜΑ ΤΩΡΑ — λίστα για έλεγχο με το μάτι, όχι πύλη.
 *
 * Το scripts/measureGustFloorImpact.mjs δίνει ποσοστά. Αυτό δίνει ΟΝΟΜΑΤΑ: ποια παραλία, ποια
 * ώρα, τι έδειχνε πριν τον δάπεδο ριπής και τι δείχνει μετά — ταξινομημένα ώστε πρώτες να
 * βγαίνουν οι αναγνωρίσιμες, γιατί μια λίστα που δεν μπορείς να ελέγξεις δεν αξίζει τίποτα.
 *
 *   node scripts/listGustFloorChangedBeaches.mjs [πλήθος]
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
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

const WANTED = Number(process.argv[2] || 20);
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = deg => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
const TONE_GR = { blue: 'ΙΔΑΝΙΚΗ (μπλε)', yellow: 'προσοχή (κίτρινο)', orange: 'δύσκολη (πορτοκαλί)', red: 'απόφυγε (κόκκινο)' };

const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
const API_KEY = ((await envRes.json()).values || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('χωρίς κλειδί'); process.exit(1); }

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
      const beach = byId.get(id);
      if (!beach) continue;
      const pop = beach.metadata?.popularity;
      plan.push({
        regionId, beachId: id,
        name: typeof beach.name === 'string' ? beach.name : (beach.name?.gr || beach.name?.en || `#${id}`),
        // Η αναγνωρισιμότητα βγαίνει από τα ΥΠΑΡΧΟΝΤΑ σήματα φήμης — καμία νέα κρίση εδώ.
        fame: (pop?.ratingCount ?? 0) + (pop?.tier === 'popular' ? 5000 : 0),
        pointKey: key, profile: profiles[String(id)] ?? null,
      });
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
  process.stdout.write(`\r  ${Math.min(i + BATCH, pointList.length)}/${pointList.length}`);
}
console.log('');

const hits = [];
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
    const corrected = applyGustFloor(raw, gust, point.elevation);
    if (corrected === raw) continue;
    const exposureLevel = item.profile?.sectors?.[sectorOf(deg)]?.level ?? 'partial';
    const bOld = getBeaufortLevel(raw), bNew = getBeaufortLevel(corrected);
    const toneOld = resolveConditionTone({ exposureLevel, beaufort: bOld, isEnclosedCove: false, seaStateM: undefined });
    const toneNew = resolveConditionTone({ exposureLevel, beaufort: bNew, isEnclosedCove: false, seaStateM: undefined });
    if (toneOld === toneNew) continue;
    hits.push({
      ...item, when: h.time[idx], toneOld, toneNew, bOld, bNew,
      rawKmh: Math.round(raw), newKmh: Math.round(corrected), gustKmh: Math.round(gust ?? 0),
    });
  }
}

// Μία γραμμή ανά παραλία: η ώρα με τη μεγαλύτερη αλλαγή, ώστε η λίστα να μη γεμίσει με διπλότυπα.
const best = new Map();
for (const hit of hits) {
  const prev = best.get(hit.beachId);
  if (!prev || (hit.bNew - hit.bOld) > (prev.bNew - prev.bOld)) best.set(hit.beachId, hit);
}
const list = [...best.values()].sort((a, b) => b.fame - a.fame || b.newKmh - a.newKmh).slice(0, WANTED);

console.log(`\n=== ${best.size} ΠΑΡΑΛΙΕΣ ΑΛΛΑΖΟΥΝ ΧΡΩΜΑ — οι ${list.length} πιο αναγνωρίσιμες ===\n`);
for (const b of list) {
  const day = b.when.slice(0, 10) === new Date().toISOString().slice(0, 10) ? 'σήμερα' : 'αύριο';
  console.log(`${b.name} — ${b.regionId.replace(/-mainland.*/, '').replace(/^[a-z-]+?-/, '')}`);
  console.log(`   ${day} ${b.when.slice(11, 16)} · ${TONE_GR[b.toneOld] ?? b.toneOld} → ${TONE_GR[b.toneNew] ?? b.toneNew}`);
  console.log(`   άνεμος ${b.rawKmh} → ${b.newKmh} χλμ/ώ (${b.bOld} → ${b.bNew} Μποφόρ) · ριπές ${b.gustKmh}`);
  console.log(`   https://calmbeach.gr/beach/${b.beachId}`);
  console.log('');
}
