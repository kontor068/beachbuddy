/**
 * ONE CONDITION COLOUR PER BEACH — gate.
 *
 * The region map pin and the card/list chip state the same thing ("how are conditions here
 * right now") and for a long time they were two independent colour ladders, written at
 * different times:
 *
 *   1. map pin     components/BeachMap.tsx getExposureMarkerTone   5 tones, read the sea state
 *   2. card chip   utils/windExposureEngine.ts getSimpleWindColor  4 tones, NEVER read the sea
 *
 * Measured over this grid before utils/suitabilityTone existed (192 combinations):
 *
 *   75 (39%)  disagreed on the colour band
 *   72 (38%)  had the CARD claiming calmer water than the pin beside it
 *
 * Two classes dominated, both of them things a swimmer would see:
 *   • any shore at 0–3 Bft with a ≥0.8 m sea still running — the day after a meltemi, when the
 *     wind has dropped and the swell has not — card GREEN + shield icon, pin YELLOW/ORANGE
 *   • every protected shore at 4 Bft whatever the sea — card GREEN, pin YELLOW
 *
 * And one hard self-contradiction: an enclosed cove held GREEN from 5 Bft on both surfaces,
 * while swimmingComfortFromScore returns avoid_swimming from an effective Beaufort of 6 — and
 * the −1 shelter discount only applies at ≤5 Bft, so a cove at 6 Bft is always avoid_swimming.
 * 202 cove-shaped beaches, 1,010 beach × wind-direction combinations nationally.
 *
 * Both surfaces now derive from utils/suitabilityTone.resolveConditionTone. This gate re-runs
 * the REAL entry points — the map's tone resolver and the scoring layer's chip resolver — over
 * the same grid, and fails if any of it comes back.
 *
 * Run: node scripts/validateConditionToneAgreement.mjs
 */
import { readFileSync } from 'node:fs';
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

// The map pin's resolver (components/BeachMap.tsx getExposureMarkerTone delegates to this).
const { resolveConditionTone, COVE_CALM_MAX_BEAUFORT } = require(path.join(root, 'utils/suitabilityTone.ts'));
// The card chip's resolver (services/recommendationService.ts calls exactly this before returning).
const { applySeaStateToWindSuitability } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { seaStateSeverityM, SEA_STATE_AMBER_M } = require(path.join(root, 'utils/waveCharacter.ts'));

const LEVELS = ['protected', 'partial', 'exposed'];
const BEAUFORTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const WAVES_M = [undefined, 0.1, 0.3, 0.45, 0.6, 0.79, 0.85, 1.0, 1.25, 1.6, 2.1];
const PERIODS_S = [undefined, 2.5, 4, 7];
const CALM_TONES = new Set(['blue', 'green']);

/** The chip as the app actually builds it: engine shape in, scoring-layer sea state applied. */
const chipColor = (exposureStatus, beaufort, enclosedCove, seaStateM) => applySeaStateToWindSuitability(
  {
    // Only these two fields drive the colour; the rest is carried through untouched.
    suitabilityColor: 'red',
    exposureStatus,
    confidence: 'medium',
    explanationKey: 'partly_exposed',
    explanationText: '',
    windSector: 'N',
    windBeaufort: beaufort,
  },
  seaStateM,
  enclosedCove,
).suitabilityColor;

const RULES = [
  {
    id: 'card-and-pin-agree',
    check: ({ pin, chip }) => (pin === chip
      ? null
      : `map pin "${pin}" vs card chip "${chip}"`),
  },
  {
    id: 'no-calm-colour-over-a-running-sea',
    // The one sanctioned exception is a verified cove holding calm water: the marine grid cell
    // cannot resolve a 50 m pocket, so it must not overrule an operator-verified morphology.
    check: ({ chip, seaStateM, enclosedCove, exposureStatus, beaufort }) => {
      if (!CALM_TONES.has(chip)) return null;
      if (seaStateM === undefined || seaStateM < SEA_STATE_AMBER_M) return null;
      const coveExempt = enclosedCove && exposureStatus === 'protected' && beaufort >= COVE_CALM_MAX_BEAUFORT;
      return coveExempt ? null : `"${chip}" over a ${seaStateM.toFixed(2)} m swell-equivalent sea`;
    },
  },
  {
    id: 'cove-green-never-over-avoid-swimming',
    // swimmingComfortFromScore: effectiveBeaufort >= 6 is avoid_swimming, unconditionally, and a
    // cove at 6 Bft cannot get the −1 shelter discount (it is gated to <= 5 Bft). So a calm
    // colour at 6+ Bft is the app contradicting its own verdict.
    check: ({ chip, beaufort }) => (
      CALM_TONES.has(chip) && beaufort >= 6
        ? `"${chip}" at ${beaufort} Bft, where the verdict is always avoid_swimming`
        : null
    ),
  },
];

const failures = [];
let combinations = 0;

for (const exposureStatus of LEVELS) {
  for (const beaufort of BEAUFORTS) {
    for (const enclosedCove of [false, true]) {
      // Geometry gates the cove flag to its protected sectors; an "exposed cove" is not a state
      // the app can produce, so asserting over it would test fiction.
      if (enclosedCove && exposureStatus !== 'protected') continue;
      for (const waveHeightM of WAVES_M) {
        for (const periodS of PERIODS_S) {
          if (waveHeightM === undefined && periodS !== undefined) continue;
          const seaStateM = seaStateSeverityM(waveHeightM, periodS);
          const row = {
            exposureStatus,
            beaufort,
            enclosedCove,
            waveHeightM,
            periodS,
            seaStateM,
            pin: resolveConditionTone({ exposureLevel: exposureStatus, beaufort, isEnclosedCove: enclosedCove, seaStateM }),
            chip: chipColor(exposureStatus, beaufort, enclosedCove, seaStateM),
          };
          combinations += 1;
          for (const rule of RULES) {
            const reason = rule.check(row);
            if (reason) failures.push({ rule: rule.id, reason, row });
          }
        }
      }
    }
  }
}

const byRule = new Map();
for (const failure of failures) {
  if (!byRule.has(failure.rule)) byRule.set(failure.rule, []);
  byRule.get(failure.rule).push(failure);
}

console.log(`Grid: ${combinations} condition combinations · ${RULES.length} rules\n`);

for (const rule of RULES) {
  const hits = byRule.get(rule.id) ?? [];
  console.log(`${hits.length === 0 ? 'OK  ' : 'FAIL'} ${rule.id}: ${hits.length}`);
  for (const hit of hits.slice(0, 5)) {
    const { exposureStatus, beaufort, enclosedCove, waveHeightM, periodS } = hit.row;
    console.log(`       ${exposureStatus}${enclosedCove ? '+cove' : ''} @ ${beaufort} Bft, wave ${waveHeightM ?? '—'} m / ${periodS ?? '—'} s → ${hit.reason}`);
  }
  if (hits.length > 5) console.log(`       … and ${hits.length - 5} more`);
}

// ── The wiring, not just the resolvers ───────────────────────────────────────────────────────
//
// The three rules above prove the two RESOLVERS agree. They cannot see whether the scoring layer
// still feeds the sea state in — deleting that one argument in calculateBeachScore restores the
// original bug in full and leaves the grid above completely green. (Verified by doing exactly
// that, 2026-07-31.) So this section drives the real function end to end.
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { Accessibility } = require(path.join(root, 'types.ts'));

const syntheticBeach = {
  id: 9001,
  rating: 4.5,
  name: { en: 'Tone Wiring', gr: 'Tone Wiring', fr: 'Tone Wiring', de: 'Tone Wiring', it: 'Tone Wiring' },
  description: { en: '', gr: '', fr: '', de: '', it: '' },
  protectedFrom: [],
  accessibility: Accessibility.EASY,
  amenities: { organized: false, naturalShade: false, taverna: false, beachBar: false, sunbeds: false, restaurant: false, parking: true, shower: false },
  characteristics: { shallowWaters: true, deepWaters: false },
  beachType: 'sandy',
  waterDepth: 'shallow',
  activities: { snorkeling: false, surfing: false },
  environment: { quiet: false, remote: false, familyFriendly: true },
  popularityScore: 50,
  coordinates: { lat: 37, lon: 25 },
  location: { island: 'Generic', region: 'Generic' },
  windProfile: {
    beachFacingDirection: 180,
    shelterLevel: 'sheltered',
    fetchExposure: 'low',
    exposedToWindDirections: [],
    protectedFromWindDirections: ['N'],
    knownWindSportSpot: false,
    localWindAmplification: 'low',
    confidence: 'medium',
    notes: '',
  },
};

const dailyForecast = ({ windSpeedMs, windDirectionDeg, marine }) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  return {
    date,
    wind: { speed: windSpeedMs, deg: windDirectionDeg, gust: windSpeedMs * 1.2 },
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    temp_min: 22,
    temp_max: 26,
    hourly: [],
    marine,
  };
};

const WIRING_CASES = [
  {
    id: 'ground-swell-on-a-calm-day',
    // The pattern this whole fix exists for: the wind has dropped, the sea has not. A long-period
    // swell is exempt from the light-wind cap on purpose, so the 1.3 m reaches the score intact.
    forecast: dailyForecast({
      windSpeedMs: 3,
      windDirectionDeg: 0,
      marine: { waveHeightM: 1.3, wavePeriodS: 8, waveDirectionDeg: 180, swellWaveHeightM: 1.2, swellWavePeriodS: 8, swellWaveDirectionDeg: 180 },
    }),
    expectCalm: false,
    why: 'a 1.3 m swell-equivalent sea must take the chip off a calm colour even at 2 Bft',
  },
  {
    id: 'genuinely-calm-day',
    // The control. Without it, deleting the sea state entirely would still "pass" the case above
    // if some unrelated change made every chip amber.
    forecast: dailyForecast({
      windSpeedMs: 3,
      windDirectionDeg: 0,
      marine: { waveHeightM: 0.12, wavePeriodS: 4, waveDirectionDeg: 180 },
    }),
    expectCalm: true,
    why: 'a flat sea at 2 Bft must still read calm — the ceiling may never invent chop',
  },
];

for (const testCase of WIRING_CASES) {
  const result = calculateBeachScore(syntheticBeach, testCase.forecast, undefined, undefined, {
    hourlyForecast: testCase.forecast.hourly,
  });
  const chip = result.simpleWindSuitability?.suitabilityColor;
  const isCalm = CALM_TONES.has(chip);
  if (isCalm !== testCase.expectCalm) {
    failures.push({
      rule: 'scoring-layer-feeds-the-sea-state',
      reason: `${testCase.id}: chip came back "${chip}" — ${testCase.why}`,
      row: { seaStateWaveM: result.seaStateWaveM, seaStatePeriodS: result.seaStatePeriodS },
    });
  }
}

const wiringFailures = failures.filter(failure => failure.rule === 'scoring-layer-feeds-the-sea-state');
console.log(`${wiringFailures.length === 0 ? 'OK  ' : 'FAIL'} scoring-layer-feeds-the-sea-state: ${wiringFailures.length}`);
for (const hit of wiringFailures) console.log(`       ${hit.reason} (seaStateWaveM=${hit.row.seaStateWaveM})`);

if (failures.length > 0) {
  console.error('\nFAILED: the map pin and the card chip do not describe the same conditions.');
  console.error('Fix utils/suitabilityTone.resolveConditionTone, or whichever surface stopped reading it.');
  console.error('Never relax a rule here to make a combination pass — that is how the two ladders drifted apart the first time.');
  process.exit(1);
}

console.log('\nPASSED: every surface paints the same conditions the same colour.');
