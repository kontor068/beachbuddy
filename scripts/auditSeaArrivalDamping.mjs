/**
 * ΤΟ ΚΥΜΑ ΔΕΝ ΕΡΧΕΤΑΙ ΑΠΟ ΕΚΕΙ ΠΟΥ ΦΥΣΑΕΙ — how much does that change?
 *
 * On 13/08/2026 a user standing on Καβαλικευτά (Λευκάδα) reported wave while the app was calling
 * the beach good. The wind was NE, straight off the land, so every wind test in the app called the
 * shore 'protected' — and `utils/waveCharacter.shoreSeaStateM` then halved the sea before the
 * colour ceiling ever saw it. The sea was arriving from 306–320° into a shore facing 284,8°,
 * through W/NW sectors with 25 km of fetch and zero blocked rays.
 *
 * The fix (utils/seaArrival.resolveSeaArrivalExposureLevel) refuses the ×0,5 discount when the
 * sector the SEA arrives through is not itself protected. It is one-directional by construction:
 * it can only ever take a discount away, so nothing in Greece can come out of it looking calmer.
 * This script measures the other half of the question — how much of the country it moves.
 *
 * TWO MEASUREMENTS, because they answer different things.
 *
 *  1. OFFLINE GRID (default). Every beach with shipped geometry × 8 wind bearings × 5 Beaufort
 *     × 8 wave bearings × 4 open-water sea states. Deterministic, no network, and it describes
 *     the STRUCTURE: which cells of the ladder move at all, and how many beaches can ever land
 *     in them. It is not a forecast — a combination counted here may never occur in July.
 *
 *  2. LIVE SWEEP (--live). Today's real wind and today's real sea, every region, scored through
 *     the actual calculateBeachScore. This is the number that answers "how many beaches change
 *     colour today". It reads each region's own marine cell rather than each beach's, so it is a
 *     floor on the effect, not a ceiling — a beach whose own cell is rougher moves at least as
 *     much. Stated rather than hidden, because a partial sweep reported as a total is the defect
 *     this project keeps paying for.
 *
 * Run: node scripts/auditSeaArrivalDamping.mjs [--live] [--regions=a,b]
 */
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

const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveSeaArrivalExposureLevel } = require(path.join(root, 'utils/seaArrival.ts'));

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');

const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorForBearing = (deg) => SECTOR_ORDER[((Math.round(deg / 45) % 8) + 8) % 8];

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
// 1. OFFLINE GRID
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Wave HEIGHTS, not severities — `seaStateSeverityM` is what the ladder actually reads, and it
 * lifts a short-period sea well above its raw height. Feeding severities straight in would have
 * measured a sea that the Aegean does not produce. 4 s is the summer wind-sea the marine models
 * report almost everywhere; the four heights straddle the two thresholds that matter
 * (SEA_STATE_AMBER_M 0,8 and SEA_STATE_ROUGH_M 1,2).
 */
const SEA_HEIGHTS_M = [0.5, 0.8, 1.1, 1.6];
const SEA_PERIOD_S = 4;
const BEAUFORTS = [1, 3, 4, 5, 6];
const BEARINGS = [0, 45, 90, 135, 180, 225, 270, 315];

const grid = {
  beaches: 0,
  profiled: 0,
  combos: 0,
  /** The arrival test had an opinion AND the wind called the shore protected. */
  discountAtStake: 0,
  changed: 0,
  transitions: new Map(),
  beachesEverChanged: new Set(),
  byRegion: new Map(),
  examples: [],
};

for (const region of regions) {
  for (const beach of region.beaches) {
    grid.beaches += 1;
    const profile = region.profiles[beach.id];
    if (!profile?.sectors || typeof profile.facingDeg !== 'number') continue;
    grid.profiled += 1;

    for (const windDeg of BEARINGS) {
      // The wind exposure the engine would land on for this bearing. The real engine adds curated
      // overrides and suspect-pin demotions on top; using the raw sector level here measures the
      // GEOMETRY's own answer, which is what the discount is keyed to for the ~95% of beaches
      // with no authored profile.
      const windExposure = profile.sectors[sectorForBearing(windDeg)]?.level ?? 'partial';
      for (const beaufort of BEAUFORTS) {
        for (const waveDeg of BEARINGS) {
          const arrival = resolveSeaArrivalExposureLevel(profile, waveDeg);
          for (const heightM of SEA_HEIGHTS_M) {
            const seaStateM = seaStateSeverityM(heightM, SEA_PERIOD_S);
            grid.combos += 1;
            if (windExposure === 'protected' && arrival !== undefined && arrival !== 'protected') {
              grid.discountAtStake += 1;
            }
            const base = {
              exposureLevel: windExposure,
              beaufort,
              isEnclosedCove: false,
              seaStateM,
            };
            const before = resolveConditionTone(base);
            const after = resolveConditionTone({ ...base, seaArrivalExposureLevel: arrival });
            if (before === after) continue;
            grid.changed += 1;
            grid.beachesEverChanged.add(`${region.regionId}#${beach.id}`);
            const key = `${before} → ${after}`;
            grid.transitions.set(key, (grid.transitions.get(key) ?? 0) + 1);
            grid.byRegion.set(region.regionId, (grid.byRegion.get(region.regionId) ?? 0) + 1);
            if (grid.examples.length < 8) {
              grid.examples.push({
                beach: beach.name?.gr ?? beach.name?.en ?? beach.name,
                region: region.regionId,
                facingDeg: profile.facingDeg,
                windDeg, beaufort, waveDeg, heightM,
                windExposure, arrival, before, after,
              });
            }
          }
        }
      }
    }
  }
}

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');

console.log('── OFFLINE GRID — what the change can reach ─────────────────────────');
console.log(`${grid.beaches} beaches in ${regions.length} regions, ${grid.profiled} with shipped geometry.`);
console.log(`${grid.combos.toLocaleString('el-GR')} combinations (8 winds × 5 Bft × 8 wave bearings × 4 seas).`);
console.log(`  Shelter discount at stake (wind says protected, the sea arrives through a sector that is not): `
  + `${grid.discountAtStake.toLocaleString('el-GR')} (${pct(grid.discountAtStake, grid.combos)}).`);
console.log(`  COLOUR ACTUALLY CHANGES: ${grid.changed.toLocaleString('el-GR')} (${pct(grid.changed, grid.combos)}) `
  + `across ${grid.beachesEverChanged.size} beaches (${pct(grid.beachesEverChanged.size, grid.profiled)} of the profiled ones).`);
console.log('  Transitions:');
for (const [key, count] of [...grid.transitions].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${key.padEnd(20)} ${count.toLocaleString('el-GR')}`);
}
console.log('  Worst-hit regions:');
for (const [regionId, count] of [...grid.byRegion].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
  console.log(`    ${regionId.padEnd(38)} ${count.toLocaleString('el-GR')}`);
}
console.log('  Examples:');
for (const e of grid.examples) {
  console.log(`    ${e.beach} (${e.region}) facing ${e.facingDeg}° — wind ${e.windDeg}°/${e.beaufort}Bft `
    + `→ ${e.windExposure}; sea ${e.heightM}m from ${e.waveDeg}° → ${e.arrival}. ${e.before} → ${e.after}`);
}

if (!LIVE) {
  console.log('\nRun with --live to measure how many beaches change colour TODAY.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. LIVE SWEEP
// ─────────────────────────────────────────────────────────────────────────────
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));
const { marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const RETRY_BACKOFF_MS = [15000, 40000, 80000];
/** Below this share of regions answering, the sweep is not an answer — see the header. */
const MIN_COVERAGE = 0.9;

const live = {
  regionsAsked: 0,
  regionsAnswered: 0,
  beaches: 0,
  arrivalKnown: 0,
  discountRefused: 0,
  changed: 0,
  shoreBreakNote: 0,
  shoreBreakBeaches: [],
  transitions: new Map(),
  rows: [],
};

const toneOf = (score, withArrival) => resolveConditionTone({
  exposureLevel: score.exposureLevel,
  beaufort: score.simpleWindSuitability?.windBeaufort ?? 0,
  isEnclosedCove: Boolean(score.enclosedCove),
  seaStateM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
  offshoreFlatWater: Boolean(score.simpleWindSuitability?.offshoreFlatWater),
  swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
  seaArrivalExposureLevel: withArrival ? score.seaArrivalExposureLevel : undefined,
});

for (const region of regions) {
  live.regionsAsked += 1;
  let wind;
  let marine;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
    try {
      const [w, m] = await Promise.all([
        fetchForecastDataBatch([region.regionPoint]),
        fetchMarineForecastDataBatch([region.regionPoint]),
      ]);
      wind = w.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
      marine = m.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
      break;
    } catch {
      if (attempt === RETRY_BACKOFF_MS.length) break;
      await sleep(RETRY_BACKOFF_MS[attempt]);
    }
  }
  if (!wind) {
    process.stderr.write(`\r  ${region.regionId}: no wind, skipped                    \n`);
    continue;
  }
  const day = processForecastData(mergeMarineForecastData(wind.data, marine?.data ?? []))[0];
  if (!day) continue;
  live.regionsAnswered += 1;

  for (const beach of region.beaches) {
    const score = calculateBeachScore(beach, day, undefined, undefined, {
      weatherSource: 'island-fallback',
      hourlyForecast: day.hourly,
      geospatialProfile: region.profiles[beach.id],
    });
    live.beaches += 1;
    if (score.seaArrivalExposureLevel !== undefined) live.arrivalKnown += 1;
    if (score.exposureLevel === 'protected'
      && score.seaArrivalExposureLevel !== undefined
      && score.seaArrivalExposureLevel !== 'protected') live.discountRefused += 1;

    if (score.warnings?.some(w => w.type === 'shore_break')) {
      live.shoreBreakNote += 1;
      if (live.shoreBreakBeaches.length < 20) live.shoreBreakBeaches.push(`${beach.name?.gr ?? beach.id} (${region.regionId}) ${score.seaStateWaveM}m`);
    }

    const before = toneOf(score, false);
    const after = toneOf(score, true);
    if (before === after) continue;
    live.changed += 1;
    const key = `${before} → ${after}`;
    live.transitions.set(key, (live.transitions.get(key) ?? 0) + 1);
    live.rows.push({
      region: region.regionId,
      beachId: beach.id,
      name: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
      before, after,
      seaM: score.seaStateWaveM,
      periodS: score.seaStatePeriodS,
      waveDirDeg: score.marine?.waveDirectionDeg,
      facingDeg: score.facingDeg,
      windExposure: score.exposureLevel,
      arrival: score.seaArrivalExposureLevel,
    });
  }
  process.stderr.write(`\r  ${live.regionsAnswered}/${regions.length} regions…            `);
}
process.stderr.write('\r                                             \r');

const coverage = live.regionsAnswered / Math.max(1, live.regionsAsked);
console.log('\n── LIVE — what changes TODAY ────────────────────────────────────────');
console.log(`Regions answered: ${live.regionsAnswered}/${live.regionsAsked} (${pct(live.regionsAnswered, live.regionsAsked)}).`);
console.log(`${live.beaches} beaches scored. Sea direction known for ${live.arrivalKnown} (${pct(live.arrivalKnown, live.beaches)}).`);
console.log(`Shelter discount refused today: ${live.discountRefused} (${pct(live.discountRefused, live.beaches)}).`);
console.log(`COLOUR CHANGES TODAY: ${live.changed} (${pct(live.changed, live.beaches)}).`);
console.log(`Shore-break note shown today (display only, no colour): ${live.shoreBreakNote} (${pct(live.shoreBreakNote, live.beaches)}).`);
for (const b of live.shoreBreakBeaches.slice(0, 10)) console.log(`    ${b}`);
for (const [key, count] of [...live.transitions].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${key.padEnd(20)} ${count}`);
}
for (const row of live.rows.slice(0, 15)) {
  console.log(`    ${row.name} (${row.region}) — sea ${row.seaM}m/${row.periodS}s from ${row.waveDirDeg}°, `
    + `facing ${row.facingDeg}°, wind ${row.windExposure}, arrival ${row.arrival}: ${row.before} → ${row.after}`);
}

mkdirSync(reportDir, { recursive: true });
writeFileSync(path.join(reportDir, 'sea-arrival-damping.json'), `${JSON.stringify({
  question: 'The ×0,5 shore-damping discount was keyed to the WIND\'s exposure. How much does keying it to the SEA\'s arrival sector change?',
  method: 'Offline: every profiled beach × 8 wind bearings × 5 Bft × 8 wave bearings × 4 sea heights at 4 s, through the real resolveConditionTone. Live: today\'s region wind + region marine cell, every beach through the real calculateBeachScore, tone computed with and without the arrival level.',
  caveats: [
    'The live half reads each REGION\'s marine cell, not each beach\'s own. A beach whose own cell is rougher moves at least as much, so this is a floor.',
    'The offline half uses the profile\'s raw sector level as the wind exposure; the live engine adds curated overrides and suspect-pin demotions on top.',
  ],
  offline: {
    beaches: grid.beaches,
    profiled: grid.profiled,
    combinations: grid.combos,
    discountAtStake: grid.discountAtStake,
    colourChanged: grid.changed,
    beachesEverChanged: grid.beachesEverChanged.size,
    transitions: Object.fromEntries(grid.transitions),
    examples: grid.examples,
  },
  live: {
    regionsAnswered: live.regionsAnswered,
    regionsAsked: live.regionsAsked,
    beaches: live.beaches,
    arrivalKnown: live.arrivalKnown,
    discountRefused: live.discountRefused,
    colourChanged: live.changed,
    shoreBreakNote: live.shoreBreakNote,
    transitions: Object.fromEntries(live.transitions),
    rows: live.rows,
  },
}, null, 2)}\n`);
console.log(`\nWritten reports/quality/sea-arrival-damping.json`);

if (coverage < MIN_COVERAGE) {
  console.error(`\nFAILED — only ${pct(live.regionsAnswered, live.regionsAsked)} of regions answered. A partial sweep is a biased sweep, not a small one.`);
  process.exit(1);
}
