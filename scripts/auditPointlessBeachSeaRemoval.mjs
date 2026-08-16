/**
 * WHAT CHANGES ON SCREEN WHEN A COVE STOPS BORROWING THE REGION'S WAVE — measurement, not a gate.
 *
 * THE CHANGE BEING MEASURED (16/08/2026). `buildMarineSamplePoints` gives no marine sample point to
 * a beach with no meaningful fetch in any direction, and says such a beach "should fall back to the
 * modelled wave rather than import a number from outside". The runtime did the opposite: it handed
 * that beach the region key and let it keep the area sea. 297 beaches nationally, and
 * scripts/auditMarineCellTrust.mjs measured — against ewam, the model that actually decides the
 * wave — that for 277 of them the cell the region point is served describes water the beach does
 * not face. The worst, Πόρτο Πεύκο, was reading a cell 104 km away across 1.2 km of open water.
 *
 * utils/weatherUtils.dropMarineWaveFromDailyForecast now takes that imported wave away, so those
 * beaches run on their own fetch-limited SMB estimate under the geometric ceiling.
 *
 * THE QUESTION THIS ANSWERS, and the only one that decides whether it ships: the displayed wave is
 * max(imported, modelled), so removing the imported term can only ever LOWER a number. How far, on
 * how many beaches, and how many of them cross a band boundary and start LOOKING SAFER than they
 * did yesterday? A beach that goes 0.45 m → 0.40 m costs nothing. A beach that goes 1.30 m → 0.35 m
 * and turns from amber to calm has been made to look safe by a change we made for honesty, and
 * that direction needs a reason, not an average.
 *
 * WHY IT IS CHEAP. Only the region point is ever fetched — 2 point-calls per region, ~220
 * nationally — because both arms of the comparison read the SAME region day. The "before" arm is
 * that day as-is; the "after" arm is the same object with the wave stripped. Nothing about the
 * own-shore beaches is touched or needed, so there is no per-beach marine leg at all.
 *
 * THE LIMIT OF THIS TEST, stated before the result:
 *  - Day level (the day's max wave, which is what the page opens on), not a slider hour. Hour
 *    deltas differ in size; they cannot differ in direction, because both arms read the same hours
 *    through the same summariser.
 *  - One snapshot of one forecast run. It measures blast radius on a calm-or-rough August day, not
 *    the worst day of the year. Re-run it in a meltemi to see the tail.
 *  - It does NOT claim the new number is closer to the truth. The argument for that is geometric:
 *    a cove with under 8 km of fetch in every direction cannot hold the sea that a cell in the next
 *    basin is describing. This script only bounds what the change does.
 *
 * Run: node scripts/auditPointlessBeachSeaRemoval.mjs
 *      node scripts/auditPointlessBeachSeaRemoval.mjs --regions=attica-east-attica-mainland
 */
// Routes this script through the PAID Open-Meteo plan when OPEN_METEO_API_KEY is in the
// environment, and changes nothing when it is not. See scripts/lib/paidOpenMeteo.mjs.
import './lib/paidOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// services/weatherService.ts arms its request timeout with window.setTimeout. Node has the timer
// but not the object, so point `window` at the global scope rather than fork the fetch path — a
// measurement that runs different networking code from the app measures the wrong thing.
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
  // The analytics module counts real user calls; a measurement script is not a user.
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile(
      'exports.getNegativeFeedbackCount = function () { return 0; };\n'
      + 'exports.recordOpenMeteoCall = function () {};\n',
      filename
    );
    return;
  }
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
    // DEV:true, unlike the gates. services/forecast/openMeteoProvider.ts refuses to build a URL
    // outside Vite dev unless VITE_FORECAST_PROXY_BASE is set, and routing a measurement through
    // our own edge proxy would read its 30-minute cache instead of the model.
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, dropMarineWaveFromDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } = require(path.join(root, 'utils/waveCharacter.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));


const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const reportPath = path.join(reportDir, 'pointless-beach-sea-removal.json');

/** Day 0 — the figure the page opens on. Pinned, not chosen per run. */
const DAY_INDEX = 0;
const REGION_DELAY_MS = 250;
/**
 * Open-Meteo counts POINTS, not requests, and the binding limit is per minute. This sweep spends
 * exactly 2 per region, so the window below never actually bites — it is here so that adding a leg
 * later cannot quietly turn a polite script into a 429 machine.
 */
const POINTS_PER_MINUTE = 450;
const pointWindow = [];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const paceForPoints = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60_000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    await sleep(Math.max(1000, pointWindow[0].at + 60_000 - performance.now()));
  }
  pointWindow.push({ at: performance.now(), count });
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * How much open water this beach actually has — the question "is it really a cove?".
 *
 * `buildMarineSamplePoints` declines to place a point when no sector reaches 8 km, and that 8 km is
 * arithmetic from ITS own push rule (MIN_PUSH_KM / PUSH_FRACTION), not a statement about the sea. A
 * beach facing 7 km of open water is not an enclosed cove, and treating it as one is how a change
 * made for honesty turns into a false calm. So every row carries its fetch and the report can be
 * read by how enclosed the beach truly is.
 */
const fetchProfile = (profile) => {
  const values = SECTORS.map(s => profile?.sectors?.[s]?.fetchKm).filter(v => Number.isFinite(v));
  const maxFetchKm = values.length ? Math.max(...values) : 0;
  let facingFetchKm = null;
  const facing = profile?.facingDeg;
  if (Number.isFinite(facing)) {
    const pos = ((((facing % 360) + 360) % 360)) / 45;
    const lo = Math.floor(pos) % 8;
    const hi = (lo + 1) % 8;
    const t = pos - Math.floor(pos);
    const a = profile?.sectors?.[SECTORS[lo]]?.fetchKm;
    const b = profile?.sectors?.[SECTORS[hi]]?.fetchKm;
    if (Number.isFinite(a) && Number.isFinite(b)) facingFetchKm = Number((a + (b - a) * t).toFixed(2));
  }
  return { maxFetchKm: Number(maxFetchKm.toFixed(2)), facingFetchKm };
};

const band = (waveM, periodS) => {
  const severity = seaStateSeverityM(waveM, periodS);
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'rough';
  if (severity >= SEA_STATE_AMBER_M) return 'amber';
  return 'calm';
};

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return {
      regionId: file.replace(/\.json$/, ''),
      beaches: app.island.beaches,
      regionPoint: app.island.coordinates,
      profiles,
    };
  } catch {
    return null;
  }
};

const regions = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .map(loadRegion)
  .filter(Boolean)
  .filter(region => region.regionPoint && Number.isFinite(region.regionPoint.lat))
  .filter(region => !regionFilter || regionFilter.includes(region.regionId));

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  const affected = new Set(resolution.regionFallbackBeachIds);
  if (affected.size === 0) return { regionId: region.regionId, rows: [] };

  await paceForPoints(2);
  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch([region.regionPoint]),
  ]);

  const pointKey = marinePointKey(region.regionPoint.lat, region.regionPoint.lon);
  const wind = windByPoint.get(pointKey);
  if (!wind) return { regionId: region.regionId, skipped: 'no wind' };
  const regionMarine = marineByPoint.get(pointKey)?.data ?? [];

  const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  // The one object every affected beach in this region is scored against. Built once, exactly as
  // App.tsx builds it once per region.
  const strippedDay = dropMarineWaveFromDailyForecast(regionDay);

  const scoreWith = (beach, dayForecast) => calculateBeachScore(beach, dayForecast, undefined, undefined, {
    weatherSource: 'island-fallback',
    hourlyForecast: dayForecast.hourly,
    geospatialProfile: region.profiles[beach.id],
  });

  const rows = [];
  for (const beach of region.beaches) {
    if (!affected.has(beach.id)) continue;
    const before = scoreWith(beach, regionDay);
    const after = scoreWith(beach, strippedDay);
    rows.push({
      beachId: beach.id,
      name: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
      ...fetchProfile(region.profiles[beach.id]),
      seaBefore: before.seaStateWaveM ?? null,
      seaAfter: after.seaStateWaveM ?? null,
      bandBefore: band(before.seaStateWaveM, before.seaStatePeriodS),
      bandAfter: band(after.seaStateWaveM, after.seaStatePeriodS),
      exposureBefore: before.exposureLevel ?? null,
      exposureAfter: after.exposureLevel ?? null,
      comfortBefore: before.swimmingComfort ?? null,
      comfortAfter: after.swimmingComfort ?? null,
      scoreBefore: before.score ?? null,
      scoreAfter: after.score ?? null,
    });
  }

  return {
    regionId: region.regionId,
    windKmh: Number((regionDay.wind.speed * 3.6).toFixed(1)),
    regionSeaM: regionDay.marine?.waveHeightM ?? null,
    strippedSeaM: strippedDay.marine?.waveHeightM ?? null,
    rows,
  };
};

console.log(`Cove sea-removal impact — ${regions.length} regions`);

const results = [];
for (let index = 0; index < regions.length; index += 1) {
  const region = regions[index];
  try {
    results.push(await measureRegion(region));
  } catch (error) {
    results.push({ regionId: region.regionId, skipped: error.message });
  }
  process.stderr.write(`\r  ${index + 1}/${regions.length} regions            `);
  await sleep(REGION_DELAY_MS);
}
process.stderr.write('\n');

const totals = {
  affected: 0, changed: 0, unchanged: 0, skippedRegions: 0,
  bandChanged: 0, bandCalmer: 0, bandRougher: 0,
  exposureChanged: 0, comfortChanged: 0, scoreRose: 0,
};
const deltas = [];
const movers = [];
const allRows = [];

for (const result of results) {
  if (!result || result.skipped) { totals.skippedRegions += 1; continue; }
  for (const row of result.rows) {
    totals.affected += 1;
    allRows.push({ regionId: result.regionId, windKmh: result.windKmh, regionSeaM: result.regionSeaM, ...row });

    const before = typeof row.seaBefore === 'number' ? row.seaBefore : null;
    const after = typeof row.seaAfter === 'number' ? row.seaAfter : null;
    const delta = before !== null && after !== null ? Number((after - before).toFixed(2)) : 0;
    if (delta === 0 && row.bandBefore === row.bandAfter) { totals.unchanged += 1; continue; }
    totals.changed += 1;
    deltas.push(Math.abs(delta));

    if (row.bandBefore !== row.bandAfter) {
      totals.bandChanged += 1;
      const order = { calm: 0, amber: 1, rough: 2, unknown: -1 };
      if (order[row.bandAfter] < order[row.bandBefore]) totals.bandCalmer += 1;
      else totals.bandRougher += 1;
    }
    if (row.exposureBefore !== row.exposureAfter) totals.exposureChanged += 1;
    if (row.comfortBefore !== row.comfortAfter) totals.comfortChanged += 1;
    if (typeof row.scoreBefore === 'number' && typeof row.scoreAfter === 'number'
      && row.scoreAfter > row.scoreBefore) totals.scoreRose += 1;

    movers.push({ regionId: result.regionId, windKmh: result.windKmh, regionSeaM: result.regionSeaM, delta, ...row });
  }
}

movers.sort((a, b) => a.delta - b.delta);

/**
 * The calmer moves, split by how much open water the beach actually has.
 *
 * This is the split that decides whether the change is safe. A beach with 1 km of fetch that drops
 * from the region's 1.6 m to its own 0.3 m has been corrected. A beach with 7 km of fetch that
 * makes the same drop may simply have been made to look safe: 7 km is enough water for a real sea,
 * and our SMB estimate only knows the wind blowing over it, not the swell walking in from outside.
 */
const FETCH_BANDS = [
  { label: '< 2 km  (truly enclosed)', min: 0, max: 2 },
  { label: '2 - 4 km', min: 2, max: 4 },
  { label: '4 - 6 km', min: 4, max: 6 },
  { label: '6 - 8 km  (real fetch)', min: 6, max: Infinity },
];
const byFetch = FETCH_BANDS.map(b => ({ ...b, affected: 0, calmer: 0, worstDelta: 0 }));
for (const row of allRows) {
  const bucket = byFetch.find(b => row.maxFetchKm >= b.min && row.maxFetchKm < b.max);
  if (!bucket) continue;
  bucket.affected += 1;
}
for (const row of movers) {
  const bucket = byFetch.find(b => row.maxFetchKm >= b.min && row.maxFetchKm < b.max);
  if (!bucket) continue;
  const order = { calm: 0, amber: 1, rough: 2, unknown: -1 };
  if (order[row.bandAfter] < order[row.bandBefore]) bucket.calmer += 1;
  bucket.worstDelta = Math.min(bucket.worstDelta, row.delta);
}

console.log('\n── What changes on screen ──────────────────────────────────────────');
console.log(`${totals.affected} beaches have no shore of their own and were reading the region's wave.`);
console.log(`  ${totals.changed} move, ${totals.unchanged} do not (${totals.skippedRegions} regions skipped).`);
if (deltas.length) {
  console.log(`  |Δ| median ${percentile(deltas, 0.5).toFixed(2)} m, p90 ${percentile(deltas, 0.9).toFixed(2)} m, max ${Math.max(...deltas).toFixed(2)} m.`);
}
console.log(`  Sea-state band (pin colour + chip) changed on ${totals.bandChanged}: ${totals.bandCalmer} CALMER, ${totals.bandRougher} rougher.`);
console.log(`  Exposure level changed on ${totals.exposureChanged}, swimming comfort on ${totals.comfortChanged}.`);
console.log(`  Recommendation score ROSE on ${totals.scoreRose} — the beaches this change makes look better.`);

console.log('\n  Split by how much open water the beach actually has:');
console.log(`    ${'fetch'.padEnd(26)} beaches   turned CALMER   worst Δ`);
for (const b of byFetch) {
  console.log(`    ${b.label.padEnd(26)} ${String(b.affected).padStart(7)} ${String(b.calmer).padStart(15)}   ${b.worstDelta.toFixed(2)} m`);
}

console.log('\n  Largest moves toward CALM — the direction that needs a reason:');
for (const row of movers.slice(0, 12)) {
  console.log(`    ${row.regionId} ${row.name}: ${row.seaBefore} → ${row.seaAfter} m `
    + `(${row.bandBefore}→${row.bandAfter}, fetch ${row.maxFetchKm} km, wind ${row.windKmh} km/h, region sea ${row.regionSeaM} m)`);
}

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({
  question: 'How far does the displayed wave fall on the beaches that have no marine sample point, '
    + "when they stop inheriting the region's wave and run on their own modelled sea?",
  oneDirectional: 'The displayed wave is max(imported, modelled), so this change can only lower a '
    + 'number. Any beach in bandCalmer is a beach that now looks safer than it did yesterday.',
  dayIndex: DAY_INDEX,
  totals,
  byFetch,
  absDeltaMedianM: Number(percentile(deltas, 0.5).toFixed(2)),
  absDeltaP90M: Number(percentile(deltas, 0.9).toFixed(2)),
  absDeltaMaxM: deltas.length ? Number(Math.max(...deltas).toFixed(2)) : 0,
  calmestMovers: movers.slice(0, 50),
  rows: allRows,
}, null, 2)}\n`, 'utf8');
console.log(`\nWritten: ${path.relative(root, reportPath)}`);
