/**
 * MEROS 1 (read-only): national measurement of intra-island wind-direction spread.
 * Replicates the app's per-beach cluster builder (hooks/useWeather.ts), then for
 * each island fetches one Open-Meteo call covering ALL its clusters across several
 * days/hours, and measures the MAX angular spread between cluster wind directions
 * per time slot. Aggregates: how many islands exceed thresholds, how often.
 */
import { readFileSync, readdirSync } from 'node:fs';

const APP_DIR = 'public/data/beaches/app';
const STEPS = [0.05, 0.08, 0.12];
const MAX_CLUSTERS = 6;
const roundTo = (v, s) => Math.round(v / s) * s;

// Replicate buildBeachForecastClusters exactly.
const buildClusters = (beaches) => {
  for (const step of STEPS) {
    const grouped = new Map();
    for (const b of beaches) {
      const key = `${roundTo(b.coordinates.lat, step).toFixed(3)}_${roundTo(b.coordinates.lon, step).toFixed(3)}`;
      grouped.set(key, [...(grouped.get(key) || []), b]);
    }
    if (grouped.size <= MAX_CLUSTERS || step === STEPS[STEPS.length - 1]) {
      return [...grouped.values()].map(cb => ({
        lat: cb.reduce((s, b) => s + b.coordinates.lat, 0) / cb.length,
        lon: cb.reduce((s, b) => s + b.coordinates.lon, 0) / cb.length,
        n: cb.length,
      }));
    }
  }
  return [];
};

const angularSpread = (degs) => {
  let max = 0;
  for (let i = 0; i < degs.length; i++)
    for (let j = i + 1; j < degs.length; j++) {
      let d = Math.abs(degs[i] - degs[j]) % 360;
      if (d > 180) d = 360 - d;
      max = Math.max(max, d);
    }
  return max;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Sample hours: midday + afternoon across 3 forecast days (covers calm + windy days).
const SAMPLE_HOURS = ['10:00', '13:00', '16:00'];

const files = readdirSync(APP_DIR).filter(f => f.endsWith('.json'));
const results = [];
let done = 0;

for (const file of files) {
  const app = JSON.parse(readFileSync(`${APP_DIR}/${file}`, 'utf8'));
  const beaches = app.island?.beaches || app.beaches || [];
  const name = app.region?.prefecture || app.island?.name?.en || file.replace('.json', '');
  if (beaches.length === 0) continue;
  const clusters = buildClusters(beaches);
  if (clusters.length < 2) { // single cluster => no intra-island spread possible
    results.push({ name, clusters: clusters.length, beaches: beaches.length, single: true, slots: [], maxEver: 0, exceed45: 0, exceed30: 0, totalSlots: 0 });
    done++;
    continue;
  }
  const lats = clusters.map(c => c.lat.toFixed(4)).join(',');
  const lons = clusters.map(c => c.lon.toFixed(4)).join(',');
  let data;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&hourly=wind_direction_10m,wind_speed_10m&wind_speed_unit=kmh&forecast_days=3&timezone=Europe%2FAthens`);
      if (r.status === 429 || r.status >= 500) { await sleep(2000 * (attempt + 1)); continue; }
      data = await r.json();
      break;
    } catch { await sleep(1500 * (attempt + 1)); }
  }
  if (!data) { results.push({ name, error: true }); done++; continue; }
  const locs = Array.isArray(data) ? data : [data];
  // For each sampled time slot, gather each cluster's direction, but only count slots
  // where at least one cluster has meaningful wind (>=12 km/h ~ 2-3 Bft) — colour only
  // diverges when there's actual wind. Calm slots are irrelevant.
  const times = locs[0].hourly.time;
  const slotSpreads = [];
  for (let day = 0; day < 3; day++) {
    for (const hh of SAMPLE_HOURS) {
      const idx = times.findIndex((t, i) => t.endsWith(hh) && Math.floor(i / 24) === day);
      if (idx === -1) continue;
      const degs = [], spds = [];
      for (const loc of locs) {
        degs.push(loc.hourly.wind_direction_10m[idx]);
        spds.push(loc.hourly.wind_speed_10m[idx]);
      }
      const maxSpd = Math.max(...spds);
      if (maxSpd < 12) continue; // calm slot, skip
      slotSpreads.push({ day, hh, spread: Math.round(angularSpread(degs)), maxSpd: Math.round(maxSpd) });
    }
  }
  const spreads = slotSpreads.map(s => s.spread);
  results.push({
    name, clusters: clusters.length, beaches: beaches.length,
    totalSlots: slotSpreads.length,
    exceed45: spreads.filter(s => s > 45).length,
    exceed30: spreads.filter(s => s > 30).length,
    maxEver: spreads.length ? Math.max(...spreads) : 0,
    medianSpread: spreads.length ? spreads.sort((a, b) => a - b)[Math.floor(spreads.length / 2)] : 0,
  });
  done++;
  if (done % 15 === 0) process.stderr.write(`...${done}/${files.length}\n`);
  await sleep(250);
}

// ---- Aggregate report ----
const measured = results.filter(r => !r.error && !r.single && r.totalSlots > 0);
const single = results.filter(r => r.single);
console.log(`\n=== NATIONAL WIND-SPREAD (${results.length} islands, ${measured.length} multi-cluster measured, ${single.length} single-cluster) ===`);

// How often does spread exceed 45 across all measured slots nationally?
const allSlots = measured.reduce((s, r) => s + r.totalSlots, 0);
const allExceed45 = measured.reduce((s, r) => s + r.exceed45, 0);
const allExceed30 = measured.reduce((s, r) => s + r.exceed30, 0);
console.log(`Total windy slots sampled: ${allSlots}`);
console.log(`  slots with spread >45°: ${allExceed45} (${Math.round(100 * allExceed45 / allSlots)}%)`);
console.log(`  slots with spread >30°: ${allExceed30} (${Math.round(100 * allExceed30 / allSlots)}%)`);

// Islands that EVER exceed 45 in the sample
const everExceed45 = measured.filter(r => r.exceed45 > 0);
const oftenExceed45 = measured.filter(r => r.totalSlots >= 3 && r.exceed45 / r.totalSlots >= 0.4);
console.log(`\nIslands that exceed 45° in >=1 sampled slot: ${everExceed45.length}/${measured.length}`);
console.log(`Islands that exceed 45° in >=40% of their windy slots: ${oftenExceed45.length}`);

console.log(`\n--- Top 25 islands by max spread (name | beaches | clusters | maxSpread | %slots>45 | median) ---`);
measured.sort((a, b) => b.maxEver - a.maxEver);
for (const r of measured.slice(0, 25)) {
  console.log(`${r.name.padEnd(26)} b=${String(r.beaches).padStart(3)} c=${r.clusters} max=${String(r.maxEver).padStart(3)}° >45:${Math.round(100 * r.exceed45 / r.totalSlots)}% med=${r.medianSpread}°`);
}

console.log(`\n--- Distribution of max-spread across measured islands ---`);
const buckets = { '0-30': 0, '30-45': 0, '45-90': 0, '90-135': 0, '135+': 0 };
for (const r of measured) {
  const m = r.maxEver;
  if (m < 30) buckets['0-30']++; else if (m < 45) buckets['30-45']++;
  else if (m < 90) buckets['45-90']++; else if (m < 135) buckets['90-135']++; else buckets['135+']++;
}
for (const [k, v] of Object.entries(buckets)) console.log(`  ${k}°: ${v} islands`);

import('node:fs').then(fs => fs.writeFileSync('.tmp/windSpreadNational.json', JSON.stringify(results, null, 2)));
console.log('\nFull data: .tmp/windSpreadNational.json');
