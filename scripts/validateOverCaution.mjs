/**
 * ΤΟ ΑΝΑΠΟΔΟ ΔΙΧΤΥ — gate.
 *
 * Every other gate asks "are we claiming calmer water than the truth?". This one asks the
 * question the PORISMA (§5, §7) demanded on 05/08/2026 and nobody wrote — until the cost
 * arrived: on 10/08/2026 Miltos found, by eye, 222 beaches wearing a rougher colour than
 * their own water (the Σχοινιάς class: offshore wind over zero fetch, sea reading taken
 * DOWNWIND of the shore). All 33 gates were green while it happened, because every one of
 * them looks in the safe direction only.
 *
 * THE QUESTION: does any surface claim ROUGHER conditions than the app's own committed
 * geometry proves? "Proves" is strict — this gate only asserts over the hard-core class
 * where the app's own physics leaves no room for a wind wave:
 *
 *   • the live-wind sector is fully land-blocked (blockedRayRatio = 1), intensity < 15,
 *     fetch <= 0,5 km, wind > 143° off head-on — the IDENTICAL exported constants the
 *     offshore-flat-water lift and the downwind-sample relief already trust;
 *   • geometry confidence high/medium, and NO authored human knowledge vetoing it
 *     (suspectPin, windsport spot, explicitly-exposed sector, venturi amplification,
 *     facing conflict) — a human veto is design, not over-caution;
 *   • no meaningful swell (0,1 m in every asserted scenario) — with swell running, extra
 *     caution is deliberate and this gate stays silent.
 *
 * WHAT IT ASSERTS, per beach in that class (offline, committed data, no network):
 *
 *   A. ENGINE — the scoring engine grants the protection its own geometry earned
 *      (the Κ3 lock: assessBeachWindExposure must answer 'protected', not 'partial').
 *   B. PIN — the map colour never exceeds the DELIBERATE maximum caution:
 *        quiet open sea (0,3 m):     <=3 Bft blue · 4-5 Bft yellow · 6 Bft orange
 *        running downwind sea (1,3): <=5 Bft yellow (the never-blue floor) · 6 Bft orange
 *      through the REAL map path: getVisibleMapExposureLevel + resolveConditionTone with
 *      the real holdsFlatWaterUnderOffshoreWind / hasDownwindSeaSample flags.
 *   C. THE OTHER DIRECTION, in the same rows — the relief must never overshoot: never blue
 *      over a running sea, never calmer than orange at 6 Bft. A gate built because all
 *      gates looked one way must not itself look one way.
 *
 * SELF-PROOF (--prove, runs in the critical set): three regressions are simulated in
 * memory and each must make the gate fail — (1) the downwind relief lost (Σχοινιάς goes
 * back to orange), (2) geometry starved out of the engine (the Κ3 regression), (3) the
 * sea ceiling deleted (blue over a running sea). If any simulation passes clean, the gate
 * exits 1: a net that cannot catch its own target is decoration.
 *
 * Run: node scripts/validateOverCaution.mjs [--prove]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\n', filename);
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
  }).outputText;
  module._compile(output, filename);
};

const { resolveConditionTone, CALMNESS_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
const {
  holdsFlatWaterUnderOffshoreWind,
  hasDownwindSeaSample,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const {
  assessBeachWindExposure,
  resolveBeachWindProfile,
  geospatialProfileConflictsWithAuthoredFacing,
} = require(path.join(root, 'utils/windExposureEngine.ts'));

const prove = process.argv.includes('--prove');

// Roughness comparison: CALMNESS_ORDER runs roughest → calmest, so a LOWER index is rougher.
const rougherThan = (a, b) => CALMNESS_ORDER.indexOf(a) < CALMNESS_ORDER.indexOf(b);

const SECTOR_TO_DIRECTION = {
  N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast',
  S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest',
};

// Representative wind speed (km/h) inside each Beaufort band — used only to feed the engine,
// which takes a speed as well as the Beaufort itself.
const BFT_SPEED_KMH = { 2: 9, 3: 15, 4: 25, 5: 35, 6: 45 };

// The two asserted seas. Short 4 s period = wind sea, the thing a downwind sample reports.
// Swell is 0,1 m everywhere: below SWELL_MIN_HEIGHT_M, so the relief's own veto stays open.
const QUIET_SEA = { waveM: 0.3, periodS: 4, swellM: 0.1 };
const RUNNING_SEA = { waveM: 1.3, periodS: 4, swellM: 0.1 };

// The deliberate maximum caution for a shore whose own geometry proves flat water.
// 6 Bft is orange BY DECISION (avoid_swimming ceiling); 7+ is red and not asserted at all.
const MAX_CAUTION_QUIET = { 2: 'blue', 3: 'blue', 4: 'yellow', 5: 'yellow', 6: 'orange' };
const MAX_CAUTION_RUNNING = { 2: 'yellow', 3: 'yellow', 4: 'yellow', 5: 'yellow', 6: 'orange' };

const EXPOSURE_DIR = path.join(root, 'public/data/geospatial/exposure');
const BEACH_DIR = path.join(root, 'public/data/beaches');

/** Collect the hard-core class: every beach whose pure-offshore sector passes the strict gates. */
const collectHardCore = () => {
  const entries = [];
  let profiled = 0;
  for (const file of readdirSync(EXPOSURE_DIR)) {
    if (!file.endsWith('.json')) continue;
    const geo = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
    let beachesRaw;
    try {
      beachesRaw = JSON.parse(readFileSync(path.join(BEACH_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    const byId = new Map(Object.values(beachesRaw).map(b => [b.id, b]));
    for (const key of Object.keys(geo.profiles ?? {})) {
      const profile = geo.profiles[key];
      profiled += 1;
      const beach = byId.get(profile.beachId);
      if (!beach || typeof profile.facingDeg !== 'number') continue;
      if (!beach.coordinates) beach.coordinates = { lat: beach.lat, lon: beach.lon };

      const dir = (profile.facingDeg + 180) % 360; // pure offshore wind for THIS shore
      const sector = windSectorFromDegrees(dir);

      // The strict geometry test IS the shipped entry point, not a restatement of it:
      // hasDownwindSeaSample carries every constant (blockage, intensity, fetch, SMB, onshore,
      // confidence) plus the swell veto we satisfy with 0,1 m.
      if (!hasDownwindSeaSample({ profile, windDirectionDeg: dir, swellWaveHeightM: 0.1 })) continue;

      // Authored human knowledge vetoes by DESIGN — those beaches are not over-caution.
      const { profile: windProfile, source } = resolveBeachWindProfile(beach);
      if (windProfile.suspectPin || windProfile.knownWindSportSpot) continue;
      if (windProfile.localWindAmplification === 'high') continue;
      if (windProfile.exposedToWindDirections?.includes(sector)) continue;
      if (geospatialProfileConflictsWithAuthoredFacing(profile, windProfile, source)) continue;

      entries.push({ beach, profile, windProfile, source, dir, sector, region: file.replace('.json', '') });
    }
  }
  return { entries, profiled };
};

/** The REAL map path for one beach at one Beaufort, optionally with sabotaged inputs. */
const pinTone = (entry, beaufort, sea, sabotage = {}) => {
  const item = {
    beach: entry.beach,
    geospatialExposure: entry.profile,
    windProfile: entry.windProfile,
    windProfileSource: entry.source,
    warnings: [],
    orientation: null,
  };
  const level = getVisibleMapExposureLevel(item, beaufort, entry.dir);
  const off = holdsFlatWaterUnderOffshoreWind({ profile: entry.profile, windDirectionDeg: entry.dir, beaufort });
  const dw = sabotage.noRelief
    ? false
    : hasDownwindSeaSample({ profile: entry.profile, windDirectionDeg: entry.dir, swellWaveHeightM: sea.swellM });
  const seaStateM = sabotage.noCeiling ? undefined : seaStateSeverityM(sea.waveM, sea.periodS);
  return {
    level,
    tone: resolveConditionTone({
      exposureLevel: level,
      beaufort,
      isEnclosedCove: false,
      seaStateM,
      offshoreFlatWater: off,
      downwindSeaSample: dw,
    }),
  };
};

/** The engine's answer for one beach, optionally starved of its geometry (the Κ3 sabotage). */
const engineLevel = (entry, sabotage = {}) => assessBeachWindExposure({
  beach: entry.beach,
  geospatialProfile: sabotage.noGeometry ? undefined : entry.profile,
  windDirectionDeg: entry.dir,
  windDirection: SECTOR_TO_DIRECTION[entry.sector],
  windSpeedKmh: BFT_SPEED_KMH[5],
  beaufort: 5,
}).simpleWindSuitability.exposureStatus;

const runAssertions = (entries, sabotage = {}) => {
  const failures = [];
  for (const entry of entries) {
    // A — the engine grants what the geometry earned.
    const level = engineLevel(entry, sabotage);
    if (level !== 'protected') {
      failures.push({ rule: 'engine-grants-earned-protection', id: entry.beach.id, name: entry.beach.name, region: entry.region, detail: `engine says "${level}" over a fully land-blocked offshore sector` });
    }
    // B + C — the pin, both directions, both seas.
    for (const [seaName, sea, maxTable] of [
      ['quiet', QUIET_SEA, MAX_CAUTION_QUIET],
      ['running', RUNNING_SEA, MAX_CAUTION_RUNNING],
    ]) {
      for (const beaufort of [2, 3, 4, 5, 6]) {
        const { tone } = pinTone(entry, beaufort, sea, sabotage);
        const max = maxTable[beaufort];
        if (rougherThan(tone, max)) {
          failures.push({ rule: 'pin-never-rougher-than-earned', id: entry.beach.id, name: entry.beach.name, region: entry.region, detail: `${seaName} sea @ ${beaufort} Bft → "${tone}" (deliberate max is "${max}")` });
        }
        if (seaName === 'running' && tone === 'blue') {
          failures.push({ rule: 'relief-never-overshoots', id: entry.beach.id, name: entry.beach.name, region: entry.region, detail: `running sea @ ${beaufort} Bft → BLUE — the ceiling has been deleted` });
        }
        if (beaufort === 6 && rougherThan('orange', tone)) {
          failures.push({ rule: 'relief-never-overshoots', id: entry.beach.id, name: entry.beach.name, region: entry.region, detail: `6 Bft → "${tone}" — calmer than the avoid_swimming decision allows` });
        }
      }
    }
  }
  return failures;
};

// ── Main ────────────────────────────────────────────────────────────────────────
const { entries, profiled } = collectHardCore();
console.log(`Hard-core class: ${entries.length} beaches (of ${profiled} profiled) whose own geometry proves flat water on a pure-offshore wind.`);

// A silent collapse of the class is itself a finding: ~258 beaches carry this geometry today
// (measured 05/08 and 10/08). If a rebuild shrinks that to a handful, the gate is asserting
// over nothing and must say so rather than print green.
if (entries.length < 50) {
  console.log(`FAIL class-size: only ${entries.length} beaches qualify — the geometry pipeline has changed under this gate; re-measure before trusting any colour.`);
  process.exit(1);
}

const failures = runAssertions(entries);
const byRule = new Map();
for (const f of failures) {
  if (!byRule.has(f.rule)) byRule.set(f.rule, []);
  byRule.get(f.rule).push(f);
}
for (const rule of ['engine-grants-earned-protection', 'pin-never-rougher-than-earned', 'relief-never-overshoots']) {
  const hits = byRule.get(rule) ?? [];
  console.log(`${hits.length === 0 ? 'OK  ' : 'FAIL'} ${rule}: ${hits.length}`);
  for (const hit of hits.slice(0, 6)) console.log(`       #${hit.id} ${hit.name} (${hit.region}): ${hit.detail}`);
}

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
writeFileSync(path.join(root, 'reports/quality/over-caution.json'), JSON.stringify({
  generatedAt: new Date().toISOString(),
  hardCoreClass: entries.length,
  profiled,
  failures: failures.slice(0, 200),
}, null, 2));

let proveFailed = false;
if (prove) {
  // (1) Σχοινιάς regression: the downwind relief lost → running sea @ 5 Bft must go rougher
  //     than yellow somewhere, and the gate must see it.
  const noRelief = runAssertions(entries, { noRelief: true }).filter(f => f.rule === 'pin-never-rougher-than-earned');
  // (2) Κ3 regression: geometry starved out of the engine → protection lost somewhere.
  const noGeometry = runAssertions(entries, { noGeometry: true }).filter(f => f.rule === 'engine-grants-earned-protection');
  // (3) ceiling deleted → blue over a running sea → the other direction fires.
  const noCeiling = runAssertions(entries, { noCeiling: true }).filter(f => f.rule === 'relief-never-overshoots');
  for (const [name, hits] of [['relief-lost', noRelief], ['geometry-starved', noGeometry], ['ceiling-deleted', noCeiling]]) {
    const ok = hits.length > 0;
    console.log(`${ok ? 'OK  ' : 'FAIL'} prove:${name}: simulated regression produced ${hits.length} failures${ok ? '' : ' — the net cannot catch its own target'}`);
    if (!ok) proveFailed = true;
  }
}

if (failures.length > 0 || proveFailed) {
  console.log('\nFAILED: a surface claims rougher conditions than the app\'s own geometry proves — or the net cannot catch its target.');
  console.log('Fix the surface the rule names. Never widen this gate\'s thresholds: the hard-core class is built from the SAME constants the shipped reliefs trust.');
  process.exit(1);
}
console.log('\nPASSED: nowhere does the app claim rougher water than its own geometry proves — and the net catches all three simulated regressions.');
