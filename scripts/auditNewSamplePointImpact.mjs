/**
 * WHAT CHANGES ON SCREEN FOR THE BEACHES THAT JUST GOT A SHORE OF THEIR OWN — measurement.
 *
 * THE CHANGE BEING MEASURED (16/08/2026). `buildMarineSamplePoints.MIN_SECTOR_FETCH_KM` was
 * MIN_PUSH_KM / PUSH_FRACTION × 2 = 8 km, and nothing justified the factor of 2 — 4 km of open
 * water is already enough to place a point at the shortest push the builder will make. Dropping it
 * to 4 km gave a sample point to 202 beaches that had none, taking the national region-fallback
 * population from 297 to 99.
 *
 * WHY IT MATTERED. Those 297 read the region's cell, and scripts/auditMarineCellTrust.mjs measured
 * against ewam that 277 of them were being served a cell describing water they do not face — the
 * worst, Πόρτο Πεύκο, 104 km away.
 *
 * WHY THE OBVIOUS ALTERNATIVE WAS REJECTED FIRST. Taking the borrowed wave away and letting them
 * run on their own SMB estimate was built and measured on the same day
 * (reports/quality/pointless-beach-sea-removal.json): 134 of 297 turned a whole sea-state band
 * CALMER with none turning rougher. That is the wave judged against LOCAL fetch, which says nothing
 * about a wave arriving from outside — the reasoning §Γ1 of the bible records as tested and killed
 * on 13/08/2026. So the fix is a better question, not a deleted answer.
 *
 * ⚠️ AND A POINT OF ONE'S OWN IS NOT AUTOMATICALLY A BETTER POINT. §Γ3 of the bible: Παραλία
 * Μαραθώνα reads 1.48-1.70 m from a sample point 10 km SE while its own north sector has zero
 * fetch. Both numbers are right; they describe different water. That is exactly what this script
 * is for — it reports the moves toward CALM, which is the direction that needs a reason, and the
 * moves toward rough, which is the direction that costs traffic but never safety.
 *
 * WHO IS MEASURED. Every beach that has a sample point and under 8 km of fetch in every sector:
 * derivable from the committed data alone, and exactly the population the threshold change
 * admitted. No .tmp file, no before/after run to compare against.
 *
 * BOTH ARMS COME FROM ONE SWEEP. The region cell and the new points are fetched in the same pass
 * and scored against the same wind at the same hour.
 *
 * ALL SIX FORECAST DAYS, not just today — and that turned out to be the whole point. The six days
 * arrive in the same response, so sweeping them costs nothing, and pinning day 0 had been hiding
 * the answer: on a flat day the region cell and the beach's own cell describe the same water and
 * the change looks free. Measured nationally 16/08/2026 over 1,200 beach-days, the movement is
 * concentrated in the windy days and points the safe way — day +0 (39 km/h) 32 rougher / 16 calmer,
 * day +5 (24 km/h) 14 / 0, while days +2 and +3 at 15-17 km/h move almost nothing.
 *
 * THE LIMIT OF THIS TEST, stated before the result: day level (the figure the page opens on), and
 * one forecast run — six days of it, but still one week of weather. It measures blast radius, not
 * which number is closer to the truth.
 *
 * Run: node scripts/auditNewSamplePointImpact.mjs
 *      OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --context production --json …)" \
 *        node scripts/auditNewSamplePointImpact.mjs   # paid plan, no daily ceiling
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

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
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
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } = require(path.join(root, 'utils/waveCharacter.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));


const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const reportPath = path.join(reportDir, 'new-sample-point-impact.json');

/** Every day the forecast carries. Free: the same response already holds all of them. */
const MAX_DAYS = 6;
const REGION_DELAY_MS = 250;
/** The fetch below which the old threshold refused a point. Everything under it is the new group. */
const OLD_MIN_SECTOR_FETCH_KM = 8;
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

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

const maxFetchKm = (profile) => {
  const values = SECTORS.map(s => profile?.sectors?.[s]?.fetchKm).filter(v => Number.isFinite(v));
  return values.length ? Math.max(...values) : 0;
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
  // The newly-admitted group: a point of their own, and less open water than the old gate demanded.
  const subjects = region.beaches.filter(beach => {
    const profile = region.profiles[beach.id];
    return Boolean(profile?.marineSamplePoint) && maxFetchKm(profile) < OLD_MIN_SECTOR_FETCH_KM;
  });
  if (subjects.length === 0) return { regionId: region.regionId, rows: [] };

  const points = [];
  const seen = new Set();
  for (const beach of subjects) {
    const sample = region.profiles[beach.id].marineSamplePoint;
    const key = marinePointKey(sample.lat, sample.lon);
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ lat: sample.lat, lon: sample.lon });
  }

  await paceForPoints(points.length + 2);
  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch([region.regionPoint, ...points]),
  ]);

  const regionKey = marinePointKey(region.regionPoint.lat, region.regionPoint.lon);
  const wind = windByPoint.get(regionKey);
  if (!wind) return { regionId: region.regionId, skipped: 'no wind' };

  const regionDays = processForecastData(
    mergeMarineForecastData(wind.data, marineByPoint.get(regionKey)?.data ?? [])
  ).slice(0, MAX_DAYS);
  if (regionDays.length === 0) return { regionId: region.regionId, skipped: 'no forecast day' };

  const scoreWith = (beach, dayForecast) => calculateBeachScore(beach, dayForecast, undefined, undefined, {
    weatherSource: 'island-fallback',
    hourlyForecast: dayForecast.hourly,
    geospatialProfile: region.profiles[beach.id],
  });

  const rows = [];
  for (const beach of subjects) {
    const profile = region.profiles[beach.id];
    const sample = profile.marineSamplePoint;
    const own = marineByPoint.get(marinePointKey(sample.lat, sample.lon))?.data ?? [];
    if (!own.length) { rows.push({ beachId: beach.id, name: beach.name?.gr, noData: true }); continue; }

    // EVERY forecast day, not just today. The whole point of a beach reading its own shore is what
    // happens when it BLOWS: on a calm day the region cell and the beach's own cell agree and the
    // change looks free. All six days are already in the same response, so this costs no extra
    // call — pinning day 0 was throwing five sixths of the evidence away.
    for (let day = 0; day < regionDays.length; day += 1) {
      const regionDay = regionDays[day];
      const before = scoreWith(beach, regionDay);
      const after = scoreWith(beach, applyMarineToDailyForecast(regionDay, own));
      rows.push({
        day,
        beachId: beach.id,
        name: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
        maxFetchKm: Number(maxFetchKm(profile).toFixed(2)),
        pushKm: sample.distanceKm ?? null,
        windKmh: Number((regionDay.wind.speed * 3.6).toFixed(1)),
        seaBefore: before.seaStateWaveM ?? null,
        seaAfter: after.seaStateWaveM ?? null,
        bandBefore: band(before.seaStateWaveM, before.seaStatePeriodS),
        bandAfter: band(after.seaStateWaveM, after.seaStatePeriodS),
        comfortBefore: before.swimmingComfort ?? null,
        comfortAfter: after.swimmingComfort ?? null,
        scoreBefore: before.score ?? null,
        scoreAfter: after.score ?? null,
      });
    }
  }

  return {
    regionId: region.regionId,
    days: regionDays.length,
    windKmh: Number((regionDays[0].wind.speed * 3.6).toFixed(1)),
    regionSeaM: regionDays[0].marine?.waveHeightM ?? null,
    rows,
  };
};

console.log(`New sample-point impact — scanning ${regions.length} regions`);

const results = [];
for (let index = 0; index < regions.length; index += 1) {
  try {
    results.push(await measureRegion(regions[index]));
  } catch (error) {
    results.push({ regionId: regions[index].regionId, skipped: error.message });
  }
  process.stderr.write(`\r  ${index + 1}/${regions.length} regions            `);
  await sleep(REGION_DELAY_MS);
}
process.stderr.write('\n');

const totals = {
  subjects: 0, noData: 0, changed: 0, unchanged: 0, skippedRegions: 0,
  bandChanged: 0, bandCalmer: 0, bandRougher: 0, comfortChanged: 0,
  scoreRose: 0, scoreFell: 0,
};
const absDeltas = [];
const calmer = [];
const rougher = [];
const allRows = [];
const order = { calm: 0, amber: 1, rough: 2, unknown: -1 };

for (const result of results) {
  if (!result || result.skipped) { if (result?.skipped) totals.skippedRegions += 1; continue; }
  for (const row of result.rows) {
    if (row.noData) { totals.noData += 1; continue; }
    totals.subjects += 1;
    const entry = { regionId: result.regionId, windKmh: result.windKmh, regionSeaM: result.regionSeaM, ...row };
    allRows.push(entry);

    const delta = typeof row.seaBefore === 'number' && typeof row.seaAfter === 'number'
      ? Number((row.seaAfter - row.seaBefore).toFixed(2))
      : 0;
    entry.delta = delta;
    if (delta === 0 && row.bandBefore === row.bandAfter) { totals.unchanged += 1; continue; }
    totals.changed += 1;
    absDeltas.push(Math.abs(delta));

    if (row.bandBefore !== row.bandAfter) {
      totals.bandChanged += 1;
      if (order[row.bandAfter] < order[row.bandBefore]) { totals.bandCalmer += 1; calmer.push(entry); }
      else { totals.bandRougher += 1; rougher.push(entry); }
    }
    if (row.comfortBefore !== row.comfortAfter) totals.comfortChanged += 1;
    if (typeof row.scoreBefore === 'number' && typeof row.scoreAfter === 'number') {
      if (row.scoreAfter > row.scoreBefore) totals.scoreRose += 1;
      else if (row.scoreAfter < row.scoreBefore) totals.scoreFell += 1;
    }
  }
}

calmer.sort((a, b) => a.delta - b.delta);
rougher.sort((a, b) => b.delta - a.delta);

console.log('\n── What changes on screen ──────────────────────────────────────────');
console.log(`${totals.subjects} newly-pointed beaches measured (${totals.noData} had no sea at their point, ${totals.skippedRegions} regions skipped).`);
console.log(`  ${totals.changed} move, ${totals.unchanged} do not.`);
if (absDeltas.length) {
  console.log(`  |Δ| median ${percentile(absDeltas, 0.5).toFixed(2)} m, p90 ${percentile(absDeltas, 0.9).toFixed(2)} m, max ${Math.max(...absDeltas).toFixed(2)} m.`);
}
console.log(`  Sea-state band changed on ${totals.bandChanged}: ${totals.bandCalmer} CALMER, ${totals.bandRougher} rougher.`);
console.log(`  Swimming comfort changed on ${totals.comfortChanged}.`);
console.log(`  Recommendation score rose on ${totals.scoreRose}, fell on ${totals.scoreFell}.`);

/**
 * The per-day table is the point of the six-day sweep. A calm day makes this change look free
 * because the region cell and the beach's own cell describe the same flat water; the day the
 * meltemi lands is the day a windward shore and a lee shore stop agreeing, and that is when a
 * wrong sample point would actually hurt someone.
 */
const perDay = {};
for (const row of allRows) {
  const d = (perDay[row.day] ??= { day: row.day, beaches: 0, calmer: 0, rougher: 0, maxWindKmh: 0 });
  d.beaches += 1;
  d.maxWindKmh = Math.max(d.maxWindKmh, row.windKmh ?? 0);
  if (row.bandBefore !== row.bandAfter) {
    if (order[row.bandAfter] < order[row.bandBefore]) d.calmer += 1; else d.rougher += 1;
  }
}
console.log('\n  Ανά ημέρα πρόγνωσης — εδώ φαίνεται τι κάνει η αλλαγή όταν φυσάει:');
console.log(`    ${'ημέρα'.padEnd(6)} ${'δυνατότερος άνεμος'.padEnd(20)} πιο άγριες   πιο ήρεμες`);
for (const d of Object.values(perDay)) {
  console.log(`    +${String(d.day).padEnd(5)} ${(d.maxWindKmh.toFixed(0) + ' km/h').padEnd(20)} ${String(d.rougher).padStart(10)} ${String(d.calmer).padStart(12)}`);
}

console.log('\n  Moves toward CALM — the direction that needs a reason:');
for (const row of calmer.slice(0, 12)) {
  console.log(`    ${row.regionId} ${row.name}: ${row.seaBefore} → ${row.seaAfter} m `
    + `(${row.bandBefore}→${row.bandAfter}, fetch ${row.maxFetchKm} km, push ${row.pushKm} km, wind ${row.windKmh} km/h)`);
}
console.log('\n  Moves toward ROUGH — costs traffic, never safety:');
for (const row of rougher.slice(0, 6)) {
  console.log(`    ${row.regionId} ${row.name}: ${row.seaBefore} → ${row.seaAfter} m `
    + `(${row.bandBefore}→${row.bandAfter}, fetch ${row.maxFetchKm} km, push ${row.pushKm} km)`);
}

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({
  question: 'What moves on screen for the 202 beaches that got a marine sample point when '
    + 'MIN_SECTOR_FETCH_KM dropped from 8 km to 4 km?',
  population: `Beaches with a marineSamplePoint and under ${OLD_MIN_SECTOR_FETCH_KM} km of fetch in `
    + 'every sector — exactly what the lowered threshold admitted, derived from committed data.',
  days: MAX_DAYS,
  totals,
  absDeltaMedianM: Number(percentile(absDeltas, 0.5).toFixed(2)),
  absDeltaP90M: Number(percentile(absDeltas, 0.9).toFixed(2)),
  absDeltaMaxM: absDeltas.length ? Number(Math.max(...absDeltas).toFixed(2)) : 0,
  perDay: Object.values(perDay),
  calmest: calmer.slice(0, 50),
  roughest: rougher.slice(0, 50),
  rows: allRows,
}, null, 2)}\n`, 'utf8');
console.log(`\nWritten: ${path.relative(root, reportPath)}`);
