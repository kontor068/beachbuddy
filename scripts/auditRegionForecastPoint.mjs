// Is each region's forecast sampled somewhere that represents its beaches?
//
// WHY THIS EXISTS: `hooks/useWeather.ts` fetches every region's forecast at
// `selectedIsland.coordinates` — the MEAN of that region's beach pins. Beaches
// ring an island, so their mean lands INLAND. Measured: 84% of the 110 sample
// points are on land, mean elevation 175 m, worst 1,212 m (Achaia).
//
// READ reports/region-forecast-point-audit.md BEFORE ACTING ON THIS. The obvious
// fix — move the point to the coast — was measured and REJECTED twice over:
//   1. A single coastal point is no better. It can land in a sheltered bay; for
//      Messinia both the centroid and the coastal medoid read ~7 km/h while the
//      region's beaches sit at a 15.3 median.
//   2. `island.coordinates` is not just a forecast point. buildBeachRegionData.mjs
//      feeds it to getAutoProt(), which derives `protectedFrom` for ALL 2,842
//      beaches from their bearing relative to it. Moving it silently rewrites the
//      wind protection of the entire dataset on the next build.
//
// So this script is a MONITOR, not a migration tool. It answers "how wrong is the
// sample point today", which is worth knowing and was previously unmeasurable.
//
// Run: node scripts/auditRegionForecastPoint.mjs [--beaches N] [--json out.json]
//
// Beaches are sampled EVENLY across the region's list, never the first N: the
// dataset is stored alphabetically, and a first-N slice skews the coast mix (in
// Messinia it drops the sheltered gulf from 30/57 to 11/30). That flaw produced
// a materially wrong figure in the first version of this audit.

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const argVal = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const PER_REGION = Number(argVal('--beaches', 18));
const JSON_OUT = argVal('--json', '');
const MIN_BEACHES = 8;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Mirrors utils/weatherUtils.ts getBeaufortLevel — keep in step with it. */
const beaufort = kmh =>
  kmh < 2 ? 0 : kmh < 6 ? 1 : kmh < 12 ? 2 : kmh < 20 ? 3 : kmh < 29 ? 4
  : kmh < 39 ? 5 : kmh < 50 ? 6 : kmh < 62 ? 7 : 8;

const fetchPoints = async points => {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${points.map(p => p[0]).join(',')}`
    + `&longitude=${points.map(p => p[1]).join(',')}`
    + '&current=wind_speed_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens';
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(url);
      const json = await res.json();
      const arr = Array.isArray(json) ? json : [json];
      if (arr[0]?.current) return arr;
    } catch { /* retry */ }
    await sleep(2500);
  }
  return null;
};

const index = JSON.parse(await readFile(path.join(rootDir, 'public/data/beaches/index.json'), 'utf8'));
const rows = [];

for (const region of index.regions) {
  if (!region.coordinates) continue;
  let data;
  try {
    const rel = region.appDataPath || `/data/beaches/app/${region.id}.json`;
    data = JSON.parse(await readFile(path.join(rootDir, 'public', rel), 'utf8'));
  } catch { continue; }

  const beaches = (data.island?.beaches || []).filter(b => b.coordinates);
  if (beaches.length < MIN_BEACHES) continue;

  const stride = Math.max(1, Math.floor(beaches.length / PER_REGION));
  const sample = beaches.filter((_, i) => i % stride === 0).slice(0, PER_REGION);

  const beachReadings = await fetchPoints(sample.map(b => [b.coordinates.lat, b.coordinates.lon]));
  await sleep(1300);
  const pointReading = await fetchPoints([[region.coordinates.lat, region.coordinates.lon]]);
  await sleep(1300);
  if (!beachReadings || !pointReading) {
    console.warn(`  ${region.id}: fetch failed, skipped`);
    continue;
  }

  const winds = beachReadings.map(e => e.current?.wind_speed_10m).filter(v => typeof v === 'number').sort((a, b) => a - b);
  if (!winds.length) continue;

  const median = winds[Math.floor(winds.length / 2)];
  const point = pointReading[0].current.wind_speed_10m;
  rows.push({
    regionId: region.id,
    sampled: winds.length,
    elevationM: Math.round(pointReading[0].elevation),
    pointKmh: Number(point.toFixed(1)),
    beachMedianKmh: Number(median.toFixed(1)),
    beachMinKmh: Number(winds[0].toFixed(1)),
    beachMaxKmh: Number(winds[winds.length - 1].toFixed(1)),
    deltaBeaufort: beaufort(point) - beaufort(median),
  });
  console.log(`  ${rows.length}/${index.regions.length} ${region.id}`);
}

const offBy1 = rows.filter(r => Math.abs(r.deltaBeaufort) >= 1);
const inland = rows.filter(r => r.elevationM > 1);

console.log('\n=== region forecast point vs its own beaches ===');
console.log(`regions measured        : ${rows.length}`);
console.log(`sample point on land    : ${inland.length} (${(inland.length / rows.length * 100).toFixed(0)}%)`);
console.log(`mean sample elevation   : ${Math.round(rows.reduce((s, r) => s + r.elevationM, 0) / rows.length)} m`);
console.log(`WRONG BY >= 1 BEAUFORT  : ${offBy1.length} (${(offBy1.length / rows.length * 100).toFixed(0)}%)`);
console.log('\nworst offenders:');
offBy1.sort((a, b) => Math.abs(b.deltaBeaufort) - Math.abs(a.deltaBeaufort))
  .slice(0, 12)
  .forEach(r => console.log(
    `  ${r.regionId.slice(0, 38).padEnd(40)}${String(r.elevationM).padStart(5)} m`
    + `  point ${String(r.pointKmh).padStart(5)}  beaches ${String(r.beachMedianKmh).padStart(5)}`
    + `  ${r.deltaBeaufort > 0 ? '+' : ''}${r.deltaBeaufort} Bft`));

console.log('\nOne snapshot only. Wind spread within a region is largest on CALM days'
  + ' (see docs/wind-variability-banner-plan.md), so a calm-day run overstates the'
  + ' problem. Re-run across several days, including a meltemi, before concluding.');

if (JSON_OUT) {
  await writeFile(path.join(rootDir, JSON_OUT), JSON.stringify(rows, null, 2), 'utf8');
  console.log(`\nwrote ${JSON_OUT}`);
}
