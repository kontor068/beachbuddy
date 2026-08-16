/**
 * WHAT CHANGES ON SCREEN WHEN A BEACH'S QUESTION IS RE-AIMED — measurement.
 *
 * THE CHANGE. scripts/optimiseMarineSamplePoints.mjs moved the marine sample point of 60 beaches
 * whose old coordinate was served a cell in water they do not face, to a coordinate that passes the
 * shared trust test (scripts/lib/marineCellTrust.mjs). Nothing else moved: the wind, the geometry,
 * the thresholds and the other 2806 beaches are untouched.
 *
 * WHY IT STILL HAS TO BE MEASURED even though the new point is provably better water. §Γ3 of the
 * bible: Παραλία Μαραθώνα reads 1.48-1.70 m from a point 10 km SE while its own north sector has
 * zero fetch — both numbers honest, describing different water. "Passes the fetch test" says the
 * cell is reachable across open water; it does not say the number will be kind. And 47 of the 60
 * winners are NOT on the beach's facing bearing, so they describe water round the corner. If this
 * mostly turns beaches green it is a false-calm machine whatever the geometry says.
 *
 * BOTH ARMS IN ONE SWEEP, from the coordinates the optimiser recorded: `beforePoint` is what the
 * runtime actually sent before, `point` is what it sends now, and both are scored against the same
 * region wind at the same hour.
 *
 * THE LIMIT: day level, one forecast run. Blast radius, not truth.
 *
 * Run: node scripts/auditOptimisedPointImpact.mjs
 */
// Routes this script through the PAID Open-Meteo plan when OPEN_METEO_API_KEY is in the
// environment, and changes nothing when it is not. See scripts/lib/paidOpenMeteo.mjs.
import './lib/paidOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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


const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const reportPath = path.join(reportDir, 'optimised-point-impact.json');
const sourcePath = path.join(reportDir, 'marine-sample-point-optimisation.json');

const DAY_INDEX = 0;
const REGION_DELAY_MS = 250;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};

const band = (waveM, periodS) => {
  const severity = seaStateSeverityM(waveM, periodS);
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'rough';
  if (severity >= SEA_STATE_AMBER_M) return 'amber';
  return 'calm';
};

if (!existsSync(sourcePath)) {
  console.error(`No optimisation report at ${path.relative(root, sourcePath)} — run scripts/optimiseMarineSamplePoints.mjs first.`);
  process.exit(1);
}
const fixes = JSON.parse(readFileSync(sourcePath, 'utf8')).fixes ?? [];
const byRegion = new Map();
for (const fix of fixes) {
  if (!byRegion.has(fix.region)) byRegion.set(fix.region, []);
  byRegion.get(fix.region).push(fix);
}

const loadRegion = (regionId) => {
  const file = `${regionId}.json`;
  const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
  const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
  const profiles = {};
  for (const profile of Object.values(profilesRaw ?? {})) {
    if (profile?.beachId != null) profiles[profile.beachId] = profile;
  }
  return { regionId, beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
};

const measureRegion = async (regionId, regionFixes) => {
  const region = loadRegion(regionId);
  const points = [region.regionPoint];
  const seen = new Set([marinePointKey(region.regionPoint.lat, region.regionPoint.lon)]);
  for (const fix of regionFixes) {
    for (const point of [fix.beforePoint, fix.point]) {
      const key = marinePointKey(point.lat, point.lon);
      if (seen.has(key)) continue;
      seen.add(key);
      points.push(point);
    }
  }

  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(points),
  ]);

  const regionKey = marinePointKey(region.regionPoint.lat, region.regionPoint.lon);
  const wind = windByPoint.get(regionKey);
  if (!wind) return { regionId, skipped: 'no wind' };

  const regionDay = processForecastData(
    mergeMarineForecastData(wind.data, marineByPoint.get(regionKey)?.data ?? [])
  )[DAY_INDEX];
  if (!regionDay) return { regionId, skipped: 'no forecast day' };

  const beachById = new Map(region.beaches.map(b => [b.id, b]));
  const scoreWith = (beach, dayForecast) => calculateBeachScore(beach, dayForecast, undefined, undefined, {
    weatherSource: 'island-fallback',
    hourlyForecast: dayForecast.hourly,
    geospatialProfile: region.profiles[beach.id],
  });

  const rows = [];
  for (const fix of regionFixes) {
    const beach = beachById.get(fix.beachId);
    if (!beach) continue;
    const dayFor = (point) => {
      const items = marineByPoint.get(marinePointKey(point.lat, point.lon))?.data ?? [];
      return items.length ? applyMarineToDailyForecast(regionDay, items) : regionDay;
    };
    const before = scoreWith(beach, dayFor(fix.beforePoint));
    const after = scoreWith(beach, dayFor(fix.point));
    rows.push({
      beachId: fix.beachId,
      name: fix.name,
      via: fix.via,
      pushKm: fix.pushKm,
      hadOwnPoint: fix.hadOwnPoint,
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
  return { regionId, windKmh: Number((regionDay.wind.speed * 3.6).toFixed(1)), rows };
};

console.log(`Optimised sample-point impact — ${fixes.length} beaches in ${byRegion.size} regions`);

const results = [];
let index = 0;
for (const [regionId, regionFixes] of byRegion) {
  index += 1;
  try {
    results.push(await measureRegion(regionId, regionFixes));
  } catch (error) {
    results.push({ regionId, skipped: error.message });
  }
  process.stderr.write(`\r  ${index}/${byRegion.size} regions            `);
  await sleep(REGION_DELAY_MS);
}
process.stderr.write('\n');

const totals = {
  measured: 0, changed: 0, unchanged: 0, skippedRegions: 0,
  bandChanged: 0, bandCalmer: 0, bandRougher: 0,
  comfortChanged: 0, scoreRose: 0, scoreFell: 0,
};
const absDeltas = [];
const calmer = [];
const rougher = [];
const allRows = [];
const order = { calm: 0, amber: 1, rough: 2, unknown: -1 };

for (const result of results) {
  if (!result || result.skipped) { totals.skippedRegions += 1; continue; }
  for (const row of result.rows) {
    totals.measured += 1;
    const entry = { regionId: result.regionId, windKmh: result.windKmh, ...row };
    const delta = typeof row.seaBefore === 'number' && typeof row.seaAfter === 'number'
      ? Number((row.seaAfter - row.seaBefore).toFixed(2))
      : 0;
    entry.delta = delta;
    allRows.push(entry);
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
console.log(`${totals.measured} re-aimed beaches measured (${totals.skippedRegions} regions skipped).`);
console.log(`  ${totals.changed} move, ${totals.unchanged} do not.`);
if (absDeltas.length) {
  console.log(`  |Δ| median ${percentile(absDeltas, 0.5).toFixed(2)} m, p90 ${percentile(absDeltas, 0.9).toFixed(2)} m, max ${Math.max(...absDeltas).toFixed(2)} m.`);
}
console.log(`  Sea-state band changed on ${totals.bandChanged}: ${totals.bandCalmer} CALMER, ${totals.bandRougher} rougher.`);
console.log(`  Swimming comfort changed on ${totals.comfortChanged}.`);
console.log(`  Recommendation score rose on ${totals.scoreRose}, fell on ${totals.scoreFell}.`);

console.log('\n  Moves toward CALM — the direction that needs a reason:');
for (const row of calmer.slice(0, 10)) {
  console.log(`    ${row.regionId} ${row.name}: ${row.seaBefore} → ${row.seaAfter} m (${row.bandBefore}→${row.bandAfter}, ${row.via}, push ${row.pushKm} km)`);
}
console.log('\n  Moves toward ROUGH:');
for (const row of rougher.slice(0, 6)) {
  console.log(`    ${row.regionId} ${row.name}: ${row.seaBefore} → ${row.seaAfter} m (${row.bandBefore}→${row.bandAfter}, ${row.via}, push ${row.pushKm} km)`);
}

mkdirSync(reportDir, { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({
  question: 'What moves on screen for the beaches whose marine sample point the optimiser re-aimed?',
  source: path.relative(root, sourcePath),
  dayIndex: DAY_INDEX,
  totals,
  absDeltaMedianM: Number(percentile(absDeltas, 0.5).toFixed(2)),
  absDeltaP90M: Number(percentile(absDeltas, 0.9).toFixed(2)),
  absDeltaMaxM: absDeltas.length ? Number(Math.max(...absDeltas).toFixed(2)) : 0,
  calmest: calmer.slice(0, 30),
  roughest: rougher.slice(0, 30),
  rows: allRows,
}, null, 2)}\n`, 'utf8');
console.log(`\nWritten: ${path.relative(root, reportPath)}`);
