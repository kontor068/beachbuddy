/**
 * WHAT CHANGES ON SCREEN WHEN EACH BEACH READS ITS OWN SEA — measurement, not a gate.
 *
 * THE QUESTION: giving every beach its own marine sample point moves the wave figure, and the
 * wave figure moves the sea-state band, the map pin colour, the swimming comfort and the
 * ranking. How many beaches, in which direction, and how many of them become LESS cautious?
 *
 * That last number is the one that decides whether the change ships. A beach that goes from
 * "1,3 m, orange" to "1,8 m, orange" costs nothing. A beach that goes from 1,3 m to 0,7 m and
 * turns green has been made to look safer by a change we made for accuracy, and that direction
 * needs a reason, not an average.
 *
 * BOTH ARMS COME FROM ONE SWEEP. The region cell and every beach's own cell are fetched in the
 * same pass and scored against the same wind at the same hour, then compared. Running "before"
 * and "after" as two separate runs would let the sea itself move between them — and
 * scripts/validateEffectiveRanking.ts:24-27 already records two runs lost to a re-picked sample.
 *
 * THE LIMIT OF THIS TEST, stated before the result:
 *  - It scores at DAY level (the day's max wave, which is what the page opens on), not at a
 *    slider hour. Hour-level deltas will differ in size; they cannot differ in direction,
 *    because both arms read the same hours through the same summariser.
 *  - It is one snapshot of one forecast run. It measures blast radius, not whether the new
 *    number is closer to the truth — that is what the ewam-vs-buoy work already answered
 *    (utils/marineForecastParsing.ts) and what scripts/auditPerBeachWaveSpread.mjs checks.
 *  - Beaches with no marineSamplePoint are unchanged by construction and are excluded from the
 *    percentages, then reported separately so the denominator is honest.
 *
 * Offline half needs no network and always runs. `--live` adds the sweep.
 *
 * Run: node scripts/auditPerBeachWaveImpact.mjs
 *      node scripts/auditPerBeachWaveImpact.mjs --live
 *      node scripts/auditPerBeachWaveImpact.mjs --live --regions=north-aegean-lemnos
 */
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
// localStorage stays undefined on purpose: saveToCache already guards on it, so this run is
// memory-only and cannot leave a cache behind that a later run would silently read.
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
    // our own edge proxy would read its 30-minute cache instead of the model. A script is not a
    // visitor: it asks Open-Meteo directly, exactly as `vite dev` does.
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { resolveBeachMarinePoints, marinePointKey, marinePointDistanceKm } =
  require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } = require(path.join(root, 'utils/waveCharacter.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
/**
 * Completed regions, so a second pass only fetches the gaps.
 *
 * Open-Meteo's binding limits are per minute AND per hour, and a full sweep is ~2.700 point-calls.
 * Two sweeps inside an hour therefore fail no matter how gently the second one is paced — which is
 * what happened here: the third run of the day took sustained 429s through a 40 s backoff and
 * landed at 88,4% coverage, under its own 90% floor. Throttling harder does not fix an hourly
 * bucket; not asking twice for the same region does.
 *
 * Region RESULTS are cached, not raw hourly series: the series would be ~90 MB, and caching the
 * scored rows keeps a resumed run honest — it never re-scores old data against new code, because
 * `codeStamp` invalidates the whole cache whenever the scoring path changes.
 */
const cachePath = path.join(root, '.tmp/per-beach-wave-impact-cache.json');

/** Day 0 — the figure the page opens on. Pinned, not chosen per run. */
const DAY_INDEX = 0;
/**
 * Sequential, with a pause between regions and a retry ladder.
 *
 * The first attempt at this ran four regions at a time and took 429 Too Many Requests across most
 * of the country: 287 of 2.555 beaches came back with a sea, and the run reported confident
 * percentages over the 11% that answered. The binding Open-Meteo limit is ~600 requests per
 * MINUTE, and a burst of ~150 batched marine calls plus 110 hourly ones crosses it easily.
 *
 * A partial sweep is not a small version of the answer, it is a biased one — the regions that
 * fail are whichever happened to be in flight when the bucket emptied. So this is deliberately
 * slower than it could be, and it refuses to publish below MIN_COVERAGE.
 */
const CONCURRENCY = 1;
const REGION_DELAY_MS = 1200;
const RETRY_BACKOFF_MS = [5000, 15000, 40000];
/** Below this share of own-shore beaches carrying a sea, the run is not an answer. */
const MIN_COVERAGE = 0.9;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
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

// ─────────────────────────────────────────────────────────────────────────────
// OFFLINE HALF — the population at risk. No sea is invented here; this counts how far the
// question moves, not how far the answer does.
// ─────────────────────────────────────────────────────────────────────────────
const offline = { beaches: 0, ownShore: 0, regionFallback: 0, distancesKm: [], over5km: 0, over15km: 0, requestsBefore: 0, requestsAfter: 0 };

for (const region of regions) {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  offline.beaches += region.beaches.length;
  offline.ownShore += resolution.ownShoreBeachIds.length;
  offline.regionFallback += resolution.regionFallbackBeachIds.length;
  // Before: one marine request per region (every beach was scored from the area forecast).
  offline.requestsBefore += 1;
  offline.requestsAfter += Math.ceil(resolution.points.length / 32);

  for (const beachId of resolution.ownShoreBeachIds) {
    const sample = region.profiles[beachId].marineSamplePoint;
    const km = marinePointDistanceKm(region.regionPoint, sample);
    offline.distancesKm.push(km);
    if (km > 5) offline.over5km += 1;
    if (km > 15) offline.over15km += 1;
  }
}

console.log('── Offline: how far the question moves ──────────────────────────────');
console.log(`${offline.beaches} beaches in ${regions.length} regions.`);
console.log(`  ${offline.ownShore} switch to their own shore, ${offline.regionFallback} keep the region cell (unchanged by construction).`);
console.log(`  Distance region cell → own shore: median ${percentile(offline.distancesKm, 0.5).toFixed(1)} km, `
  + `p90 ${percentile(offline.distancesKm, 0.9).toFixed(1)} km, max ${Math.max(...offline.distancesKm).toFixed(1)} km.`);
console.log(`  ${offline.over5km} beaches move more than 5 km (one ewam cell), ${offline.over15km} more than 15 km.`);
console.log(`  Marine requests per full national sweep: ${offline.requestsBefore} → ${offline.requestsAfter}.`);

if (!LIVE) {
  console.log('\nRun with --live to measure what changes on screen.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVE HALF — score every beach twice from the same wind, at the same hours.
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The three bands the user actually sees: green pin, amber pin, red pin — and the chip word
 * beside them. seaStateSeverityM returns swell-equivalent METRES, not a label, so the boundaries
 * come from the module that owns them (utils/waveCharacter) rather than from two numbers copied
 * into this script, which is how a threshold drifts in one place and not the other.
 */
const BAND_ORDER = { unknown: -1, calm: 0, amber: 1, rough: 2 };
const band = (waveM, periodS) => {
  const severity = seaStateSeverityM(waveM, periodS);
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'rough';
  if (severity >= SEA_STATE_AMBER_M) return 'amber';
  return 'calm';
};

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);

  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);

  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { regionId: region.regionId, skipped: 'no wind' };

  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const regionDays = processForecastData(mergeMarineForecastData(wind.data, regionMarine));
  const regionDay = regionDays[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  const scoreWith = (beach, dayForecast) => calculateBeachScore(beach, dayForecast, undefined, undefined, {
    weatherSource: 'island-fallback',
    hourlyForecast: dayForecast.hourly,
    geospatialProfile: region.profiles[beach.id],
  });

  const before = new Map();
  const after = new Map();
  const rows = [];

  for (const beach of region.beaches) {
    const beforeScore = scoreWith(beach, regionDay);
    before.set(beach.id, beforeScore);

    const key = resolution.keyByBeachId.get(beach.id);
    const isOwnShore = key !== resolution.regionKey;
    const beachMarine = isOwnShore ? (marineByPoint.get(key)?.data ?? []) : [];
    const beachDay = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;
    const afterScore = scoreWith(beach, beachDay);
    after.set(beach.id, afterScore);

    if (!isOwnShore) continue;
    if (!beachMarine.length) {
      rows.push({ beachId: beach.id, name: beach.name?.gr, noData: true });
      continue;
    }

    rows.push({
      beachId: beach.id,
      name: beach.name?.gr,
      facingDeg: region.profiles[beach.id]?.facingDeg ?? null,
      seaBefore: beforeScore.seaStateWaveM ?? null,
      seaAfter: afterScore.seaStateWaveM ?? null,
      bandBefore: band(beforeScore.seaStateWaveM, beforeScore.seaStatePeriodS),
      bandAfter: band(afterScore.seaStateWaveM, afterScore.seaStatePeriodS),
      exposureBefore: beforeScore.exposureLevel ?? null,
      exposureAfter: afterScore.exposureLevel ?? null,
      comfortBefore: beforeScore.swimmingComfort ?? null,
      comfortAfter: afterScore.swimmingComfort ?? null,
    });
  }

  const rank = (scores) => getSuitableBeaches(
    region.beaches, regionDay, 'gr', undefined, regionDay.hourly, undefined, undefined, region.profiles, scores
  ).slice(0, 3).map(item => item.beach.id);

  return {
    regionId: region.regionId,
    windKmh: Number((regionDay.wind.speed * 3.6).toFixed(1)),
    regionSeaM: regionDay.marine?.waveHeightM ?? null,
    rows,
    top3Before: rank(before),
    top3After: rank(after),
  };
};

/** A region counts as answered when every own-shore beach in it came back with a sea. */
const regionComplete = (result) =>
  Boolean(result) && !result.skipped && (result.rows ?? []).every(row => !row.noData);

const runPool = async (items, worker) => {
  const out = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];

      // Points already fetched stay in weatherService's memory cache, so a retry only re-asks for
      // what is actually missing. That makes backing off cheap and makes giving up unnecessary.
      for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
        try {
          out[index] = await worker(item);
        } catch (error) {
          out[index] = { regionId: item.regionId, skipped: error.message };
        }
        if (regionComplete(out[index]) || attempt === RETRY_BACKOFF_MS.length) break;
        process.stderr.write(`\r  ${item.regionId}: incomplete, backing off ${RETRY_BACKOFF_MS[attempt] / 1000}s…            `);
        await sleep(RETRY_BACKOFF_MS[attempt]);
      }

      process.stderr.write(`\r  fetched ${out.filter(Boolean).length}/${items.length} regions                              `);
      await sleep(REGION_DELAY_MS);
    }
  }));
  process.stderr.write('\n');
  return out;
};

// A resumed run must not mix seas from different forecast cycles or scores from different code.
// The stamp covers both: the scoring modules' bytes, and the day the sea was fetched for.
const codeStamp = [
  'services/recommendationService.ts',
  'utils/waveModel.ts',
  'utils/weatherUtils.ts',
  'utils/marineSamplePoints.ts',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + '@' + new Date().toISOString().slice(0, 10);

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
  else console.log('  Cache discarded: scoring code or forecast day changed since it was written.');
} catch { /* first run */ }

const cachedIds = regions.filter(region => regionComplete(cache[region.regionId])).map(r => r.regionId);
const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));

console.log(`\n── Live: ${cachedIds.length} regions resumed from cache, fetching ${toFetch.length} ──────────`);
const fetched = (await runPool(toFetch, measureRegion)).filter(Boolean);

for (const result of fetched) {
  if (result?.regionId) cache[result.regionId] = result;
}
mkdirSync(path.dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify({ codeStamp, regions: cache }));

const results = regions.map(region => cache[region.regionId]).filter(Boolean);

const totals = {
  measured: 0, noData: 0, skippedRegions: 0,
  seaChanged: 0, calmer: 0, rougher: 0, deltas: [],
  bandChanged: 0, bandCalmer: 0, bandRougher: 0,
  exposureChanged: 0, comfortChanged: 0,
  top3Changed: 0, regionsRanked: 0,
};
const worstCalmer = [];

for (const result of results) {
  if (result.skipped) { totals.skippedRegions += 1; continue; }
  totals.regionsRanked += 1;
  if (result.top3Before.join() !== result.top3After.join()) totals.top3Changed += 1;

  for (const row of result.rows ?? []) {
    if (row.noData) { totals.noData += 1; continue; }
    totals.measured += 1;

    if (typeof row.seaBefore === 'number' && typeof row.seaAfter === 'number') {
      const delta = Number((row.seaAfter - row.seaBefore).toFixed(2));
      if (delta !== 0) {
        totals.seaChanged += 1;
        totals.deltas.push(delta);
        if (delta < 0) {
          totals.calmer += 1;
          worstCalmer.push({ ...row, delta, regionId: result.regionId, windKmh: result.windKmh });
        } else {
          totals.rougher += 1;
        }
      }
    }
    if (row.bandBefore !== row.bandAfter) {
      totals.bandChanged += 1;
      const moved = BAND_ORDER[row.bandAfter] - BAND_ORDER[row.bandBefore];
      if (moved < 0) totals.bandCalmer += 1; else totals.bandRougher += 1;
    }
    if (row.exposureBefore !== row.exposureAfter) totals.exposureChanged += 1;
    if (row.comfortBefore !== row.comfortAfter) totals.comfortChanged += 1;
  }
}

worstCalmer.sort((a, b) => a.delta - b.delta);
const absDeltas = totals.deltas.map(Math.abs);

const coverage = totals.measured / Math.max(1, totals.measured + totals.noData);

console.log('\n── What changes on screen ──────────────────────────────────────────');
console.log(`${totals.measured} beaches measured on their own shore (${totals.noData} had no sea data, ${totals.skippedRegions} regions skipped).`);
console.log(`  Coverage ${(coverage * 100).toFixed(1)}% (floor ${(MIN_COVERAGE * 100).toFixed(0)}%).`);
console.log(`  Sea state moved on ${totals.seaChanged} (${(100 * totals.seaChanged / Math.max(1, totals.measured)).toFixed(1)}%): `
  + `${totals.rougher} rougher, ${totals.calmer} CALMER.`);
console.log(`  |Δ| median ${percentile(absDeltas, 0.5).toFixed(2)} m, p90 ${percentile(absDeltas, 0.9).toFixed(2)} m, max ${Math.max(0, ...absDeltas).toFixed(2)} m.`);
console.log(`  Sea-state band (pin colour + chip) changed on ${totals.bandChanged}: ${totals.bandRougher} rougher, ${totals.bandCalmer} CALMER.`);
console.log(`  Exposure level changed on ${totals.exposureChanged}, swimming comfort on ${totals.comfortChanged}.`);
console.log(`  Top-3 membership changed in ${totals.top3Changed} of ${totals.regionsRanked} regions.`);

if (worstCalmer.length) {
  console.log('\n  Largest moves toward CALM — the direction that needs a reason:');
  worstCalmer.slice(0, 10).forEach(row => {
    console.log(`    ${row.regionId} ${row.name ?? row.beachId} (${Math.round(row.facingDeg ?? 0)}°, wind ${row.windKmh} km/h): `
      + `${row.seaBefore} → ${row.seaAfter} m (${row.delta}), band ${row.bandBefore} → ${row.bandAfter}`);
  });
}

const incident = results.find(r => r.regionId === 'north-aegean-lemnos');
if (incident?.rows) {
  console.log('\n  The incident pair:');
  for (const id of [1433, 1435]) {
    const row = incident.rows.find(r => r.beachId === id);
    if (row) console.log(`    ${row.name} (${Math.round(row.facingDeg ?? 0)}°): ${row.seaBefore} → ${row.seaAfter} m`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'per-beach-wave-impact.json');
writeFileSync(reportPath, JSON.stringify({
  question: 'What changes on screen when each beach reads its own sea instead of the region cell?',
  method: 'One sweep: region cell and every beach\'s own cell fetched together, scored twice against the same wind at day level (DAY_INDEX 0) through the real calculateBeachScore and getSuitableBeaches.',
  limits: [
    'Day level, not a slider hour: sizes will differ hour by hour, directions cannot.',
    'One forecast run. Measures blast radius, not which number is closer to the truth.',
    'Beaches with no marineSamplePoint are unchanged by construction and excluded from the percentages.',
  ],
  offline: {
    beaches: offline.beaches,
    ownShore: offline.ownShore,
    regionFallback: offline.regionFallback,
    medianMoveKm: Number(percentile(offline.distancesKm, 0.5).toFixed(2)),
    p90MoveKm: Number(percentile(offline.distancesKm, 0.9).toFixed(2)),
    maxMoveKm: Number(Math.max(...offline.distancesKm).toFixed(2)),
    marineRequestsBefore: offline.requestsBefore,
    marineRequestsAfter: offline.requestsAfter,
  },
  complete: coverage >= MIN_COVERAGE,
  coverage: Number(coverage.toFixed(4)),
  live: totals,
  worstCalmer: worstCalmer.slice(0, 25),
  perRegion: results.map(r => ({
    regionId: r.regionId,
    skipped: r.skipped ?? null,
    windKmh: r.windKmh ?? null,
    regionSeaM: r.regionSeaM ?? null,
    top3Changed: r.top3Before ? r.top3Before.join() !== r.top3After.join() : null,
  })),
}, null, 2));
console.log(`\nWritten: ${path.relative(root, reportPath)}`);

if (coverage < MIN_COVERAGE) {
  console.error(
    `\nTHIS RUN IS NOT AN ANSWER. Only ${(coverage * 100).toFixed(1)}% of own-shore beaches came back `
    + `with a sea (floor ${(MIN_COVERAGE * 100).toFixed(0)}%). The regions that fail are whichever `
    + 'happened to be in flight when the rate limit hit, so the percentages above are biased, not '
    + 'merely noisy. Re-run — the points already fetched are cached in memory for this process '
    + 'only, so a fresh run pays for them again; raise the backoff rather than the concurrency.'
  );
  process.exit(1);
}
