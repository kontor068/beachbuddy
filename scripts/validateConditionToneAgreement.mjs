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
const { resolveConditionTone, capToneBySeaState, showsCoveBadge, COVE_BADGE_MAX_BEAUFORT, CALMNESS_ORDER, LEGEND_TONE_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
// The card chip's resolver (services/recommendationService.ts calls exactly this before returning).
const { applySeaStateToWindSuitability } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { seaStateSeverityM, SEA_STATE_AMBER_M } = require(path.join(root, 'utils/waveCharacter.ts'));

const LEVELS = ['protected', 'partial', 'exposed'];
const BEAUFORTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const WAVES_M = [undefined, 0.1, 0.3, 0.45, 0.6, 0.79, 0.85, 1.0, 1.25, 1.6, 2.1];
const PERIODS_S = [undefined, 2.5, 4, 7];
// 'green' left this set on 02/08/2026 with the tone itself — the enclosed cove is a badge on the
// marker now, not a rung on the severity scale. Blue is the only calm colour the ladder can paint.
const CALM_TONES = new Set(['blue']);

/** The chip as the app actually builds it: engine shape in, scoring-layer sea state applied. */
const chipColor = (exposureStatus, beaufort, enclosedCove, seaStateM, offshoreFlatWater, downwindSeaSample) => applySeaStateToWindSuitability(
  {
    // Only these three fields drive the colour; the rest is carried through untouched.
    suitabilityColor: 'red',
    exposureStatus,
    confidence: 'medium',
    explanationKey: 'partly_exposed',
    explanationText: '',
    windSector: 'N',
    windBeaufort: beaufort,
    offshoreFlatWater,
  },
  seaStateM,
  enclosedCove,
  downwindSeaSample,
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
    // The cove exemption that used to live here is GONE (02/08/2026), and deleting it made this
    // rule strictly stricter rather than weaker. It existed because a cove could paint 'green'
    // over a running sea; a cove now reads orange at 5 Bft, which is not a calm colour, so the
    // exception can no longer be reached. Do not re-add it without a case that needs it — the
    // sea-ceiling exemption in suitabilityTone still protects the cove from being painted RED,
    // which is the part that was ever about measurement.
    check: ({ chip, seaStateM }) => {
      if (!CALM_TONES.has(chip)) return null;
      if (seaStateM === undefined || seaStateM < SEA_STATE_AMBER_M) return null;
      return `"${chip}" over a ${seaStateM.toFixed(2)} m swell-equivalent sea`;
    },
  },
  {
    id: 'no-calm-colour-over-avoid-swimming',
    // swimmingComfortFromScore: effectiveBeaufort >= 6 is avoid_swimming, unconditionally, and a
    // cove at 6 Bft cannot get the −1 shelter discount (it is gated to <= 5 Bft). So a calm
    // colour at 6+ Bft is the app contradicting its own verdict. Structurally unreachable since
    // the cove lost its tone — which is the point: this is the tripwire for anyone adding a new
    // calm branch above 5 Bft, and it was named after the cove only because the cove got there
    // first.
    check: ({ chip, beaufort }) => (
      CALM_TONES.has(chip) && beaufort >= 6
        ? `"${chip}" at ${beaufort} Bft, where the verdict is always avoid_swimming`
        : null
    ),
  },
  {
    id: 'cove-badge-never-over-avoid-swimming',
    // The colour contradiction the green tone created must not come back wearing a badge. Driven
    // through the exported predicate, not a source regex, so changing the rule changes the test.
    check: ({ exposureStatus, beaufort, enclosedCove }) => {
      if (!showsCoveBadge(enclosedCove, exposureStatus, beaufort)) return null;
      if (beaufort > COVE_BADGE_MAX_BEAUFORT) {
        return `cove badge shown at ${beaufort} Bft, where the verdict is always avoid_swimming`;
      }
      return exposureStatus === 'protected'
        ? null
        : `cove badge shown on a "${exposureStatus}" shore — the bay is not a refuge from this wind`;
    },
  },
  {
    id: 'offshore-lift-only-where-it-is-earned',
    // The 02/08/2026 offshore-flat-water rule (utils/offshoreFlatWater) is the ONLY thing that may
    // make a 5 Bft shore read calmer than orange, and it may do it only on a shore the engine
    // itself calls protected, only at exactly 5 Bft, and never past yellow. Anything else means a
    // new calm branch has been opened above 4 Bft without the measurement that justified this one.
    // `downwindSeaSample` is held EQUAL on both sides of the comparison, so this rule keeps
    // isolating the lift's own effect — without that, every downwind-relieved row would read as
    // an illegal lift at the wrong Beaufort.
    check: ({ pin, offshoreFlatWater, exposureStatus, beaufort, seaStateM, downwindSeaSample }) => {
      if (!offshoreFlatWater) return null;
      const withoutLift = resolveConditionTone({ exposureLevel: exposureStatus, beaufort, seaStateM, downwindSeaSample });
      if (pin === withoutLift) return null;
      if (beaufort !== 5) return `lifted the colour at ${beaufort} Bft — the rule is 5 Bft only`;
      if (exposureStatus !== 'protected') return `lifted a "${exposureStatus}" shore, not a protected one`;
      if (pin !== 'yellow') return `lifted to "${pin}" — the rule may only reach yellow`;
      return null;
    },
  },
  {
    id: 'offshore-lift-still-obeys-the-sea',
    // The offshore flag says the WIND is not building a wave here. It says nothing about a swell
    // already running outside, which wraps into lee shores — so unlike the cove, this rule gets
    // no exemption from the sea-state ceiling. If the lifted colour is ever calmer than what the
    // sea alone permits, the exemption has been added by accident. The ceiling is re-applied with
    // the row's OWN downwind flag: the relief is part of the ceiling, not an escape from it.
    check: ({ pin, offshoreFlatWater, exposureStatus, beaufort, seaStateM, downwindSeaSample }) => {
      if (!offshoreFlatWater) return null;
      const ceilinged = capToneBySeaState(pin, seaStateM, false, exposureStatus, downwindSeaSample);
      return ceilinged === pin
        ? null
        : `"${pin}" survived a sea that permits only "${ceilinged}"`;
    },
  },
  {
    id: 'downwind-relief-is-one-rung-and-never-blue',
    // The «δεύτερο σκαλοπάτι, ποτέ μπλε» decision (10/08/2026): a downwind marine sample may
    // soften the sea ceiling by exactly ONE extra rung — red→yellow at most — and may never
    // delete it. Two asserts: (a) the flag's whole effect on any row is at most one tone step
    // toward calm and never toward rough; (b) over a sea at or above the amber line the result
    // is never blue, whatever the flag says. (b) is also covered by no-calm-colour-over-a-
    // running-sea sweeping the widened grid, but it is restated here so a future exemption for
    // the downwind flag specifically (the Κεδρόδασος temptation — 426 live hour-combinations
    // measured on 10/08/2026) fails a rule whose name says why.
    check: ({ pin, exposureStatus, beaufort, enclosedCove, seaStateM, offshoreFlatWater, downwindSeaSample }) => {
      if (!downwindSeaSample) return null;
      if (seaStateM !== undefined && seaStateM >= SEA_STATE_AMBER_M && CALM_TONES.has(pin)) {
        return `"${pin}" over a ${seaStateM.toFixed(2)} m sea because the sample is downwind — the relief must never delete the ceiling`;
      }
      const withoutRelief = resolveConditionTone({ exposureLevel: exposureStatus, beaufort, isEnclosedCove: enclosedCove, seaStateM, offshoreFlatWater });
      const step = CALMNESS_ORDER.indexOf(pin) - CALMNESS_ORDER.indexOf(withoutRelief);
      if (step < 0) return `the downwind flag made the pin ROUGHER ("${withoutRelief}" → "${pin}")`;
      if (step > 1) return `the downwind flag lifted "${withoutRelief}" to "${pin}" — more than one rung`;
      return null;
    },
  },
];

const failures = [];
let combinations = 0;

/**
 * «ΟΤΑΝ ΛΕΕΙ ΚΑΛΗ ΘΕΛΩ ΝΑ ΜΠΟΡΕΙΣ ΝΑ ΚΟΛΥΜΠΗΣΕΙΣ ΚΙΟΛΑΣ» (Μίλτος, 10/08/2026).
 *
 * Measured that night over 136.992 beach × wind × sea combinations: 5.863 of the 49.514 blue or
 * yellow readings (11,8%) sat on a beach the same engine had marked `avoid_swimming`. The legend
 * called it ΙΔΑΝΙΚΗ or ΚΑΛΗ; the card under it said do not swim.
 *
 * Two assertions, and the second one matters as much as the first: the ceiling must DARKEN a calm
 * colour, and it must never LIGHTEN anything — a ceiling that could raise a tone would be a false
 * calm with extra steps.
 */
let swimCeilingChecks = 0;
for (const exposureStatus of LEVELS) {
  for (const beaufort of BEAUFORTS) {
    for (const seaStateM of [undefined, 0.2, 0.9, 1.4]) {
      for (const enclosedCove of [false, true]) {
        for (const offshoreFlatWater of [false, true]) {
          const base = resolveConditionTone({ exposureLevel: exposureStatus, beaufort, isEnclosedCove: enclosedCove, seaStateM, offshoreFlatWater });
          const capped = resolveConditionTone({ exposureLevel: exposureStatus, beaufort, isEnclosedCove: enclosedCove, seaStateM, offshoreFlatWater, swimVerdictAvoid: true });
          swimCeilingChecks += 1;
          if (capped === 'blue' || capped === 'yellow') {
            failures.push(`Άρνηση μπάνιου με χρώμα «${capped}»: ${exposureStatus} @ ${beaufort} Bft, θάλασσα ${seaStateM ?? '—'}, cove=${enclosedCove}, offshore=${offshoreFlatWater}`);
          }
          if (CALMNESS_ORDER.indexOf(capped) > CALMNESS_ORDER.indexOf(base)) {
            failures.push(`Η πύλη άρνησης μπάνιου ΦΩΤΙΣΕ χρώμα (${base} → ${capped}): ${exposureStatus} @ ${beaufort} Bft, θάλασσα ${seaStateM ?? '—'}`);
          }
        }
      }
    }
  }
}
if (swimCeilingChecks === 0) failures.push('Η πύλη άρνησης μπάνιου δεν μέτρησε καμία περίπτωση');

for (const exposureStatus of LEVELS) {
  for (const beaufort of BEAUFORTS) {
    for (const enclosedCove of [false, true]) {
      // Geometry gates the cove flag to its protected sectors; an "exposed cove" is not a state
      // the app can produce, so asserting over it would test fiction.
      if (enclosedCove && exposureStatus !== 'protected') continue;
      for (const waveHeightM of WAVES_M) {
        for (const periodS of PERIODS_S) {
          if (waveHeightM === undefined && periodS !== undefined) continue;
          // Both values of the offshore-flat-water flag, over the WHOLE grid rather than only its
          // own Beaufort: the rules below have to be able to catch it firing where it should not.
          for (const offshoreFlatWater of [false, true]) {
            // Same treatment for the downwind-sample flag (10/08/2026): in production it is gated
            // by geometry and swell, but the grid asserts the ladder holds even where the gates
            // would never send it.
            for (const downwindSeaSample of [false, true]) {
              const seaStateM = seaStateSeverityM(waveHeightM, periodS);
              const row = {
                exposureStatus,
                beaufort,
                enclosedCove,
                waveHeightM,
                periodS,
                seaStateM,
                offshoreFlatWater,
                downwindSeaSample,
                pin: resolveConditionTone({ exposureLevel: exposureStatus, beaufort, isEnclosedCove: enclosedCove, seaStateM, offshoreFlatWater, downwindSeaSample }),
                chip: chipColor(exposureStatus, beaufort, enclosedCove, seaStateM, offshoreFlatWater, downwindSeaSample),
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
  }
}

const byRule = new Map();
for (const failure of failures) {
  if (!byRule.has(failure.rule)) byRule.set(failure.rule, []);
  byRule.get(failure.rule).push(failure);
}

// RULES covers the grid sweep; the wiring rule and the slider rule are asserted after it, so the
// headline counts all of them — a gate that under-reports its own coverage invites the assumption
// that something is checked when it is not.
const NON_GRID_RULES = 7;
console.log(`Grid: ${combinations} condition combinations · ${RULES.length + NON_GRID_RULES} rules\n`);

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

// ─────────────────────────────────────────────────────────────────────────────
// RULE 5 — neither the hour slider nor the legend has a colour ladder of its own.
//
// Both sit on the same screen as the pins and are compared at a glance, and both had the same
// defect:
//
//   • the slider thumb carried a private `getWindSliderTone` — `beaufort >= 7 red / >= 5 orange
//     / >= 3 yellow / else blue` — reading the wind and nothing else;
//   • the legend was five hard-coded rows keyed by Beaufort whose swatches called
//     getExposureMarkerTone WITHOUT the sea argument, so it could not print a colour the sea had
//     caused. Measured against the real ladder it was wrong on two of its three everyday rows:
//     red is reachable at both 3 and 4 Bft and the legend mentioned it at neither.
//
// Miltos ruled on 01/08/2026 that the slider, the legend and the beaches may never show
// different colours. Both now read one tally (`mapToneTally`) built from resolveConditionTone.
//
// SOURCE checks, not grid checks: the defect is structural — a second ladder existing at all —
// so the assertion is that no private ladder has grown back and that both surfaces read the
// shared tally. The one grid check at the end covers the other half: every colour the ladder can
// emit must have a word in all five languages, or a pin appears the legend cannot explain.
// ─────────────────────────────────────────────────────────────────────────────
const mapSource = readFileSync(path.join(root, 'components/BeachMap.tsx'), 'utf8');

if (/const\s+getWindSliderTone\s*=/.test(mapSource)) {
  failures.push({
    rule: 'slider-has-no-ladder-of-its-own',
    reason: 'components/BeachMap.tsx has re-grown getWindSliderTone — a private beaufort→colour '
      + 'ladder for the slider thumb. The thumb must come from resolveConditionTone like the pins.',
    row: {},
  });
}
if (!/sliderTone\s*=\s*windSliderTones\[/.test(mapSource) || !/mapToneTally/.test(mapSource)) {
  failures.push({
    rule: 'slider-has-no-ladder-of-its-own',
    reason: 'components/BeachMap.tsx no longer derives the slider thumb from the pins\' own tones '
      + '(expected mapToneTally → windSliderTones). The slider can drift from the map again.',
    row: {},
  });
}
{
  // The tone it aggregates must be the shared resolver, fed the same inputs the pins get.
  //
  // 02/08/2026: the ladder moved out of the tally expression into `beachConditionTone`, because
  // the legend rows became filter buttons and the same per-beach tone is now needed in four
  // places (pins, counts, the filter, and the tone table reported to the cards). The rule is
  // unchanged — it just follows the expression to where it lives. If beachConditionTone is gone,
  // the tally expression itself must carry the inputs, which is what the fallback checks.
  // 2400, not 1800 and not 900: the function carries the reasoning for each input it feeds the
  // resolver, and the window has to fit the comments as well as the code — a guard that fails
  // because someone explained themselves teaches people to delete the explanation. Raised on
  // 14/08/2026 when `partialIsMeasured` arrived with its three-line note and pushed the closing
  // brace past 1800: the rule below was reporting all four needles missing, which reads like the
  // tally lost the shared ladder when in fact only the window was too small. Widen it again for
  // the same reason if it ever happens — never by deleting the explanation.
  const resolver = mapSource.match(/const\s+beachConditionTone\s*=[\s\S]{0,2400}?\n\s*\}\);/);
  const crowd = resolver || mapSource.match(/const\s+mapToneTally\s*=[\s\S]{0,900}?\n\s*\);/);
  const body = crowd ? crowd[0] : '';
  if (resolver && !/tallyMapTones\([^)]*beachConditionTone|beachTonesById[\s\S]{0,400}?tallyMapTones/.test(mapSource)) {
    failures.push({
      rule: 'slider-has-no-ladder-of-its-own',
      reason: 'beachConditionTone exists but the tally no longer reads it — the legend counts and '
        + 'the pins are being coloured by two different expressions again.',
      row: {},
    });
  }
  for (const needle of ['resolveConditionTone', 'exposureLevel', 'seaStateM', 'isEnclosedCove']) {
    if (!body.includes(needle)) {
      failures.push({
        rule: 'slider-has-no-ladder-of-its-own',
        reason: `the map tone tally is computed without "${needle}" — it is no longer the same `
          + 'judgement the pins make, so the thumb, the legend and the map can disagree.',
        row: {},
      });
    }
  }
}

// The legend must COUNT the pins, not describe Beaufort bands.
if (/\brange:\s*['"`]\s*\d/.test(mapSource) || /windColorGuideCopy\.rows\b/.test(mapSource)) {
  failures.push({
    rule: 'slider-has-no-ladder-of-its-own',
    reason: 'the map legend has re-grown hard-coded Beaufort rows (range: "4 Bft" / '
      + 'windColorGuideCopy.rows). It must be generated from mapToneTally, so it cannot describe '
      + 'a colour the map does not contain — or omit one it does.',
    row: {},
  });
}
// The legend lists calmest-first (LEGEND_TONE_ORDER) while the severity scale runs roughest-first
// (CALMNESS_ORDER). Two constants on purpose: resolveConditionTone compares indexOf() against the
// severity one so a small wave can never lift a pin past the tone the wind earned, and the map's
// dominant-tone scan walks it roughest-first. A `.reverse()` on the shared constant would invert
// both silently — the sea-state ceiling would start making pins CALMER.
if (!/visibleWindColorGuideRows\s*=\s*LEGEND_TONE_ORDER/.test(mapSource)) {
  failures.push({
    rule: 'slider-has-no-ladder-of-its-own',
    reason: 'the legend rows are no longer derived from LEGEND_TONE_ORDER over mapToneTally.counts — '
      + 'the legend and the pins can drift apart again.',
    row: {},
  });
}
{
  const reversedSeverity = [...CALMNESS_ORDER].reverse();
  const sameLength = LEGEND_TONE_ORDER.length === CALMNESS_ORDER.length;
  const isExactMirror = sameLength && LEGEND_TONE_ORDER.every((tone, index) => tone === reversedSeverity[index]);
  if (!isExactMirror) {
    failures.push({
      rule: 'legend-order-mirrors-severity',
      reason: `LEGEND_TONE_ORDER (${LEGEND_TONE_ORDER.join('→')}) is not the exact reverse of `
        + `CALMNESS_ORDER (${CALMNESS_ORDER.join('→')}). A tone added to one and forgotten in the `
        + 'other either vanishes from the legend or from the severity ladder.',
      row: {},
    });
  }
}
{
  // The swatches must never again be resolved without the sea, which was the original defect.
  const swatch = mapSource.match(/const\s+protectedTone\s*=\s*getExposureMarkerTone\([^;]*;/);
  if (!swatch || !/medianSeaOfGroup/.test(swatch[0])) {
    failures.push({
      rule: 'slider-has-no-ladder-of-its-own',
      reason: 'the grouped legend swatches call getExposureMarkerTone without a sea state again. '
        + 'They must pass the group\'s real sea (medianSeaOfGroup), or they can show a colour no '
        + 'pin on the map is wearing.',
      row: {},
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 5b — the detail map is fed everything the colour depends on.
//
// The beach page builds its own one-element `beaches` array for the small map. Every field the
// colour reads has to be in it, and a MISSING field is silent: resolveConditionTone just sees
// `undefined` and skips that input. On 01/08/2026 the array omitted seaStateWaveM,
// seaStatePeriodS and enclosedCove, so the running-sea ceiling never fired on the detail map
// while it did on the region map — the same beach showed one colour outside and another inside,
// on every beach whose sea was at or above the amber threshold ("άλλα μέσα, άλλα έξω, σε
// πολλές"). No grid check could catch it: the resolver was correct, it was being starved.
// ─────────────────────────────────────────────────────────────────────────────
{
  const detailSource = readFileSync(path.join(root, 'pages/BeachDetailPage.tsx'), 'utf8');
  const literal = detailSource.match(/<BeachMap[\s\S]{0,200}?beaches=\{\[\{[\s\S]*?\}\]\}/);
  const body = literal ? literal[0] : '';
  if (!body) {
    failures.push({
      rule: 'detail-map-gets-the-same-inputs',
      reason: 'could not find the detail map\'s inline beaches array in pages/BeachDetailPage.tsx — '
        + 'if it moved, move this check with it rather than deleting it.',
      row: {},
    });
  } else {
    // Every input resolveConditionTone reads, plus the wind that keys the tone band.
    // `marine` and `geospatialExposure` joined 10/08/2026: the downwind-sample flag is computed
    // inside BeachMap from item.marine.swellWaveHeightM + item.geospatialExposure, so stripping
    // either starves the relief silently and the detail pin goes back to orange while the region
    // pin reads yellow.
    for (const field of ['seaStateWaveM', 'seaStatePeriodS', 'enclosedCove', 'exposureLevel', 'marine', 'geospatialExposure']) {
      if (!body.includes(field)) {
        failures.push({
          rule: 'detail-map-gets-the-same-inputs',
          reason: `the detail map's beach object omits "${field}" — the colour silently drops that `
            + 'input and can differ from the region map for the same beach.',
          row: {},
        });
      }
    }
  }
  // Not just "the word appears somewhere" — the wind props the marker is toned from must
  // actually read mapWind. A first version of this rule only grepped for the identifier and a
  // sabotage run that stripped the prop still passed, because the JSX kept mentioning it.
  if (!/windSpeed=\{[^}]*mapWind/.test(detailSource)
    || !/windDirectionDeg=\{[^}]*mapWind/.test(detailSource)) {
    failures.push({
      rule: 'detail-map-gets-the-same-inputs',
      reason: 'the detail map\'s windSpeed/windDirectionDeg are no longer resolved from mapWind — '
        + 'it is back on the region wind while the region map uses per-beach wind, so the same '
        + 'beach can be one colour outside and another inside.',
      row: {},
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 5c — the REGION map's items carry the marine forecast.
//
// Same starvation class as 5b, other map. App.tsx builds mapSuitableBeaches by hand-picking
// fields off the scoring result; `marine` was not among them, so the pin's downwind-sample flag
// read swellWaveHeightM === undefined and vetoed ("no relief without evidence") while the card
// chip — coloured inside scoring, where marine exists — granted it. Σχοινιάς 10/08/2026: orange
// pin beside a yellow card, found live by Miltos, invisible to the same-inputs grid above
// because the two surfaces were fed DIFFERENT inputs.
// ─────────────────────────────────────────────────────────────────────────────
{
  const appSourceForMarine = readFileSync(path.join(root, 'App.tsx'), 'utf8');
  const builder = appSourceForMarine.match(/seaStateWaveM:\s*scoreResult\.seaStateWaveM[\s\S]{0,1600}?geospatialExposure,/);
  if (!builder || !/marine:\s*scoreResult\.marine/.test(builder[0])) {
    failures.push({
      rule: 'region-map-gets-the-marine',
      reason: 'the mapSuitableBeaches builder in App.tsx no longer passes `marine: scoreResult.marine` — '
        + 'the pin\'s downwind-sample flag silently vetoes on missing swell and the pin can wear a '
        + 'rougher colour than the card chip built from the same score.',
      row: {},
    });
  }
  const marineFailures = failures.filter(failure => failure.rule === 'region-map-gets-the-marine');
  console.log(`${marineFailures.length === 0 ? 'OK  ' : 'FAIL'} region-map-gets-the-marine: ${marineFailures.length}`);
  for (const hit of marineFailures) console.log(`       ${hit.reason}`);
}

const detailFailures = failures.filter(failure => failure.rule === 'detail-map-gets-the-same-inputs');
console.log(`${detailFailures.length === 0 ? 'OK  ' : 'FAIL'} detail-map-gets-the-same-inputs: ${detailFailures.length}`);
for (const hit of detailFailures) console.log(`       ${hit.reason}`);

const sliderFailures = failures.filter(failure => failure.rule === 'slider-has-no-ladder-of-its-own');
console.log(`${sliderFailures.length === 0 ? 'OK  ' : 'FAIL'} slider-has-no-ladder-of-its-own: ${sliderFailures.length}`);
for (const hit of sliderFailures) console.log(`       ${hit.reason}`);

// ─────────────────────────────────────────────────────────────────────────────
// RULE 6 — every colour the ladder can emit has a legend word, in all five languages.
//
// The legend now renders one row per tone PRESENT on the map. That guarantees it never invents a
// colour — but not that it can name one. A tone with no entry in `toneLabel` would render an
// empty row beside a coloured dot: a pin the legend cannot explain. This drives the real ladder
// over the condition grid, collects every tone it actually produces, and checks each has a word
// in en/gr/de/fr/it.
// ─────────────────────────────────────────────────────────────────────────────
const LANGS = ['en', 'gr', 'fr', 'de', 'it'];
const emittedTones = new Set();
for (const exposureStatus of ['protected', 'partial', 'exposed']) {
  for (const beaufort of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const seaStateM of [undefined, 0.2, 0.5, 0.79, 0.9, 1.19, 1.3, 1.6, 2.6, 4]) {
      for (const enclosedCove of [false, true]) {
        emittedTones.add(resolveConditionTone({ exposureLevel: exposureStatus, beaufort, isEnclosedCove: enclosedCove, seaStateM }));
      }
    }
  }
}
// The words moved out of BeachMap.tsx into utils/conditionToneLabels.ts on 05/08/2026, so the
// beach card could show the SAME word as the pin instead of deriving one of its own. This check
// follows them — and gets stronger for it: it reads the real exported table instead of
// regex-scraping JSX, so an empty word, or a locale that silently lost a key, fails here rather
// than passing a text match.
const { conditionToneLabels } = require(path.join(root, 'utils/conditionToneLabels.ts'));

for (const tone of emittedTones) {
  for (const lang of LANGS) {
    const word = conditionToneLabels?.[lang]?.[tone]?.label;
    if (typeof word !== 'string' || word.trim() === '') {
      failures.push({
        rule: 'every-pin-colour-has-a-legend-word',
        reason: `the ladder can paint a "${tone}" pin, but utils/conditionToneLabels.ts has no ${lang} `
          + 'word for it — that pin would appear with a coloured dot and no explanation, and the card '
          + 'chip beside it would be blank too.',
        row: {},
      });
    }
    // The legend row shows the COUNTED phrase, not the bare word (12/08/2026): «Ιδανικές 4
    // παραλίες». Both forms must exist and both must contain the {n} slot — a phrase without it
    // renders a noun with no number, which is exactly the ambiguity the change removed.
    for (const form of ['countOne', 'countMany']) {
      const phrase = conditionToneLabels?.[lang]?.[tone]?.[form];
      if (typeof phrase !== 'string' || !phrase.includes('{n}')) {
        failures.push({
          rule: 'every-pin-colour-has-a-legend-word',
          reason: `utils/conditionToneLabels.ts has no usable ${lang} "${form}" for a "${tone}" pin `
            + '— the legend row would print a beach count with no number, or fall back to English.',
          row: {},
        });
      }
    }
  }
}

// The map must stay a READER of that table, not keep a private copy. If the words get pasted back
// into BeachMap.tsx the two surfaces can drift apart again while every check above still passes.
if (!/conditionToneLabels/.test(mapSource) || /toneLabel:\s*\{\s*blue:/.test(mapSource)) {
  failures.push({
    rule: 'every-pin-colour-has-a-legend-word',
    reason: 'components/BeachMap.tsx has stopped reading utils/conditionToneLabels.ts, or has grown '
      + 'its own toneLabel block again. The legend and the card chip must name a colour from one table.',
    row: {},
  });
}

// The legend rows double as a filter (02/08/2026): picking one retitles the list below the map
// («Δύσκολες παραλίες στις 17:00»). That heading is a separate string from the legend word — the
// legend needs a singular adjective and the heading a plural noun phrase, and forcing one string
// to be both produces broken Greek. What CAN'T differ is the coverage: a tone the ladder paints
// but the heading cannot name would leave the user filtered into a list with no title.
{
  const homeSource = readFileSync(path.join(root, 'components/BeachSearcherHome.tsx'), 'utf8');
  const headings = homeSource.match(/const\s+getToneFilterLabel\s*=[\s\S]*?\n\s*return headings\[tone\];/);
  const body = headings ? headings[0] : '';
  if (!body) {
    failures.push({
      rule: 'every-pin-colour-has-a-legend-word',
      reason: 'getToneFilterLabel is gone from components/BeachSearcherHome.tsx — the list below the '
        + 'map can no longer name the colour the user filtered by. If it moved, move this check too.',
      row: {},
    });
  } else {
    for (const tone of emittedTones) {
      for (const lang of LANGS) {
        // Non-greedy up to the block's own closing brace: these values are template literals
        // carrying ${day}, so a [^}] scan would stop inside the first interpolation.
        const block = body.match(new RegExp(`\\n\\s*${lang}:\\s*\\{([\\s\\S]*?)\\n\\s*\\},`));
        const langBody = block ? block[1] : '';
        if (!new RegExp(`\\b${tone}\\s*:\\s*['"\`][^'"\`]*['"\`]`).test(langBody)) {
          failures.push({
            rule: 'every-pin-colour-has-a-legend-word',
            reason: `the ladder can paint a "${tone}" pin and the legend can filter by it, but there `
              + `is no ${lang} heading for that list — the cards would sit under an empty title.`,
            row: {},
          });
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 7 — «Καταλληλότερες» is the map's own arithmetic, not a second opinion.
//
// The list used to be built from "this beach's exposure level is protected" while the pins were
// coloured by wind + sea + geometry, so the page could offer a beach the map beside it had just
// painted orange. It is now the ΙΔΑΝΙΚΕΣ plus the ΚΑΛΕΣ, selected by looking each beach up in the
// tones the map REPORTED — App must never resolve a tone itself, because the moment it does the
// two surfaces are two rules again and nothing here can tell.
// ─────────────────────────────────────────────────────────────────────────────
{
  const appSource = readFileSync(path.join(root, 'App.tsx'), 'utf8');
  const toneSource = readFileSync(path.join(root, 'utils/suitabilityTone.ts'), 'utf8');
  const fail = reason => failures.push({ rule: 'the-list-does-not-colour-its-own-beaches', reason, row: {} });

  // ONE exception, and it is not a loophole: `harshestStayHourByBeachId` asks "which hour of the
  // window is roughest", so it must evaluate hours the map has NOT painted — mapBeachTones only
  // holds the hour currently on screen, so there is nothing there to look up. It picks a MOMENT;
  // it never decides a colour, because the hour it returns is then painted by the same
  // resolveConditionTone every other surface uses. The ban stands for everything else: the moment
  // a SECOND call appears, or this one leaves that memo, the list and the legend are two rules
  // again and this gate is the only thing that can tell. Blanket-banning the name was the original
  // shape and it failed the day the stay window landed (05/08/2026).
  const stayWindowMemo = appSource.match(
    /const harshestStayHourByBeachId\s*=\s*useMemo[\s\S]*?\n\s*\}, \[[^\]]*\]\);/,
  );
  if (!stayWindowMemo) {
    fail('harshestStayHourByBeachId is gone from App.tsx, or no longer a useMemo this gate can '
      + 'delimit. Re-anchor the exception below before trusting it — an exception whose boundary '
      + 'cannot be found permits everything.');
  }
  const toneCalls = appSource.match(/\bresolveConditionTone\s*\(/g) || [];
  const callsInsideWindow = stayWindowMemo
    ? (stayWindowMemo[0].match(/\bresolveConditionTone\s*\(/g) || []).length
    : 0;
  if (toneCalls.length !== callsInsideWindow) {
    fail(`App.tsx calls resolveConditionTone ${toneCalls.length} time(s), ${callsInsideWindow} of `
      + 'them inside harshestStayHourByBeachId. Every other call paints a colour App has no '
      + 'business painting: the list must read the tones the map reported (mapBeachTones) — that '
      + 'is how the list and the legend became two rules over the same evidence in the first place.');
  }
  if (callsInsideWindow > 1) {
    fail('harshestStayHourByBeachId resolves a tone more than once. It picks ONE hour from one '
      + 'ladder; a second call there is a second ladder in the place hardest to notice.');
  }
  if (!/selectSuitableByTone\(/.test(appSource) || !/mapBeachTones\[/.test(appSource)) {
    fail('App.tsx no longer selects the suitable list with selectSuitableByTone over mapBeachTones '
      + '— «Καταλληλότερες» has stopped being the sum of the colours on the map.');
  }
  const rule = toneSource.match(/export const SUITABLE_LIST_TONES[\s\S]{0,400}?\n\s*\};/)
    || toneSource.match(/export const SUITABLE_LIST_TONES[^\n]*\n/);
  if (!rule) {
    fail('SUITABLE_LIST_TONES is gone from utils/suitabilityTone.ts — the rule that decides which '
      + 'colours may be offered has moved somewhere this gate cannot see.');
  } else if (/['"`]red['"`]/.test(rule[0])) {
    fail('"red" appears in the suitable-list rule. The app must not offer a beach it has just '
      + 'called ΔΥΣΚΟΛΗ; red is unreachable there by construction and must stay so.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 7b — a collapsed legend must keep a way out.
//
// Miltos, 02/08/2026: with a colour picked, the other three rows are two lines each of advice
// about colours he has just rejected, and they push the beach cards below the fold. So the legend
// now shows ONLY the picked row.
//
// That turns the «Δείξε όλες τις παραλίες» button from a convenience into the ONLY way back: the
// rows a user would otherwise tap are no longer on screen. Delete it — or make it render only
// when no filter is active, which is how such buttons are usually written — and the map is a trap
// with one colour on it and no exit. The two changes are one feature and this gate holds them
// together.
// ─────────────────────────────────────────────────────────────────────────────
{
  const mapSource = readFileSync(path.join(root, 'components/BeachMap.tsx'), 'utf8');
  const fail = reason => failures.push({ rule: 'a-collapsed-legend-has-a-way-out', reason, row: {} });

  const collapses = /\.filter\(row => !activeToneFilter \|\| row\.tone === activeToneFilter\)/.test(mapSource);
  // The button must be reachable exactly WHILE a filter is on. Both JSX shapes say that —
  // `activeToneFilter ? (button) : (something)` and the plain `activeToneFilter && (button)`
  // once there is no longer an else-branch to render. Matching only the ternary made this rule
  // fail on 05/08/2026 over a hint line being dropped, with the exit button untouched and
  // working: a gate that fires on syntax instead of behaviour teaches people to ignore it.
  // The negative lookbehind is the part that must stay strict — `!activeToneFilter && (button)`
  // is the real defect this rule exists to catch (an exit that only shows with no filter on).
  const hasExit = /(?<!!)activeToneFilter\s*(?:\?|&&)\s*\(\s*<button/.test(mapSource)
    && /onClick=\{\(\) => onToneFilterChange\?\.\(null\)\}/.test(mapSource)
    && /toneFilterCopy\.showAll/.test(mapSource);

  if (collapses && !hasExit) {
    fail('The legend hides every unpicked colour but the «show all» button that clears the filter '
      + 'is gone or no longer renders while a filter is active. The user would be left on a map '
      + 'showing one colour with no way back to the others.');
  }
  if (!collapses && hasExit) {
    fail('The legend no longer collapses to the picked row. Not a bug on its own — but the row '
      + 'filter was removed without removing this note, so update the gate deliberately rather '
      + 'than leaving it describing behaviour the code does not have.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE 8 — the filters describe the COLOUR GROUP, not the region.
//
// Miltos, 02/08/2026: «όταν επιλέγω ομάδα παραλιών, στα φίλτρα να μη μου εμφανίζεις
// χαρακτηριστικά που δεν έχουν». Pick «Καλή 31» and the chips below must count inside those 31,
// so a chip nothing in the group has reads 0 and goes dead instead of leading to an empty list.
//
// Every check below is a CONNECTION check, never an existence check — the lesson written three
// times over on 01–02/08: the range was computed, printed into a string, and never reached the
// screen, and the rule that only asked «is the word in the file?» passed anyway.
//
// Two of them exist because this feature has a specific way of failing quietly:
//  • the tone table the counts read is reported by the map, and the map's `beaches` prop is
//    ALREADY narrowed by the active chips. Report over that and every chip describes itself:
//    filter to «Ξαπλώστρες» and the only beaches wearing a colour at all are the ones with
//    sunbeds. Hence `toneSourceBeaches` must be the unfiltered list.
//  • both count memos are near-identical, so a rule that scans the whole file passes with one of
//    the two reverted. They are matched one at a time, by name.
// ─────────────────────────────────────────────────────────────────────────────
{
  const appSource = readFileSync(path.join(root, 'App.tsx'), 'utf8');
  const homeSource = readFileSync(path.join(root, 'components/BeachSearcherHome.tsx'), 'utf8');
  const sheetSource = readFileSync(path.join(root, 'components/AmenityFilter.tsx'), 'utf8');
  const fail = reason => failures.push({ rule: 'chips-describe-the-picked-colour', reason, row: {} });

  // (1) The map reports colours for every beach in the region, not for the surviving pins.
  const reported = mapSource.match(/const\s+reportedToneEntries\s*=[\s\S]{0,400}?;\n/);
  if (!reported || !/toneSourceBeaches[\s\S]*beachConditionTone/.test(reported[0])) {
    fail('components/BeachMap.tsx no longer builds reportedToneEntries from toneSourceBeaches via '
      + 'beachConditionTone. The reported tone table falls back to the filtered pins, and every '
      + 'filter chip below the map starts describing itself.');
  }
  for (const site of ['beachTonesSignature = reportedToneEntries', 'useRef(reportedToneEntries)',
    'beachTonesRef.current = reportedToneEntries']) {
    if (!mapSource.includes(`const ${site}`) && !mapSource.includes(site)) {
      fail(`components/BeachMap.tsx: "${site}" is gone — the fuller tone table is computed but no `
        + 'longer the one onBeachTonesChange reports upward. Computed is not connected.');
    }
  }
  // (2) App hands the map the UNFILTERED list for that job.
  if (!/toneSourceBeaches=\{mapSuitableBeaches\}/.test(appSource)) {
    fail('App.tsx no longer passes toneSourceBeaches={mapSuitableBeaches} to the directory map. '
      + 'Anything narrower (directoryMapPinBeaches / filteredMapSuitableBeaches) is already '
      + 'filtered, and the chip counts silently become circular.');
  }
  // (3) The pool is looked up in the reported tones, never coloured here.
  const pool = appSource.match(/const\s+toneScopedBeaches\s*=[\s\S]{0,700}?\n\s*\}, \[/);
  if (!pool || !/mapBeachTones\[beach\.id\]\s*===\s*mapToneFilter/.test(pool[0])) {
    fail('App.tsx: toneScopedBeaches no longer selects by mapBeachTones[beach.id] === mapToneFilter. '
      + 'The chips must read the colour the map painted, not re-derive one.');
  }
  // (4) BOTH count memos read the pool. Matched one at a time: they are near-identical, and a
  //     whole-file scan passes with either one reverted to selectedIsland.beaches.
  for (const memo of ['preferenceFilterResultCounts', 'desktopAdvancedFilterResultCounts']) {
    const body = appSource.match(new RegExp(`const\\s+${memo}\\s*=\\s*useMemo\\(\\(\\) => \\{[\\s\\S]{0,1800}?\\n  \\}, \\[[^\\]]*\\]\\);`));
    if (!body) {
      fail(`App.tsx: ${memo} is gone or no longer a useMemo — this gate cannot see whether the `
        + 'chip counts still follow the picked colour.');
      continue;
    }
    if (!body[0].includes('toneScopedBeaches')) {
      fail(`App.tsx: ${memo} no longer counts over toneScopedBeaches. Its chips are back to `
        + 'describing the whole region while the user is looking at one colour of it.');
    }
    if (/selectedIsland\.beaches/.test(body[0])) {
      fail(`App.tsx: ${memo} reads selectedIsland.beaches again — the region, not the selection.`);
    }
    if (!/\]\);$/.test(body[0]) || !body[0].slice(body[0].lastIndexOf('}, [')).includes('toneScopedBeaches')) {
      fail(`App.tsx: toneScopedBeaches is missing from ${memo}'s dependency list, so the counts `
        + 'freeze on whichever colour was picked first.');
    }
  }
  // (5) A chip with nothing behind it fades — it is never removed. Chips that disappear move the
  //     ones after them, and a thumb already travelling lands on whatever slid into the gap.
  const sheetButton = sheetSource.match(/const\s+renderFilterButton\s*=[\s\S]{0,900}?disabled=\{[^}]*\}/);
  /**
   * The test allows the condition to be one term of a wider OR. It was pinned to
   * `!isSelected && unavailableFilterSet.has(filter)` with nothing allowed between, and commit
   * 3eda6df2 («Στο κινητό δεν πατιέται πια φίλτρο που αδειάζει τη λίστα») made the rule STRICTER
   * — `!isSelected && (unavailableFilterSet.has(filter) || emptyingFilters.has(filter))` — which
   * the old pattern read as the rule being gone. A gate that goes red when the code gets safer is
   * a gate that gets switched off, so it now asserts what actually matters: the unavailable set
   * still reaches `isUnavailable`, and `isUnavailable` still drives `disabled`.
   */
  if (!sheetButton || !/isUnavailable\s*=\s*!isSelected\s*&&[^;]*unavailableFilterSet\.has\(filter\)/.test(sheetSource)
    || !/disabled=\{isUnavailable\}/.test(sheetSource)) {
    fail('components/AmenityFilter.tsx no longer disables a chip from unavailableFilters. Either '
      + 'the fade is gone (dead chips lead to an empty list) or the chip is being hidden instead, '
      + 'which reshuffles the sheet under the user\'s thumb.');
  }
  if (/\.filter\([^)]*!unavailableFilter/.test(sheetSource)) {
    fail('components/AmenityFilter.tsx filters unavailable chips OUT of the list. Miltos chose '
      + 'faded-in-place over hidden precisely so nothing moves.');
  }
  // (6) The "your filter was dropped" line actually reaches the screen. This is the (στ) failure
  //     mode verbatim: computed, formatted, and never rendered.
  if (!/toneFilterDropCopy\[language\]\(/.test(appSource) || !/toneFilterDropNote=\{toneDroppedFilterNote\}/.test(appSource)) {
    fail('App.tsx computes no drop note, or stops passing it to BeachSearcherHome. A filter that '
      + 'switches itself off in silence takes away a choice the user made without a word.');
  }
  if (!/\{toneFilterDropNote\}/.test(homeSource)) {
    fail('components/BeachSearcherHome.tsx receives toneFilterDropNote but never renders it. The '
      + 'message exists and no one can read it.');
  }
}

const chipScopeFailures = failures.filter(failure => failure.rule === 'chips-describe-the-picked-colour');
console.log(`${chipScopeFailures.length === 0 ? 'OK  ' : 'FAIL'} chips-describe-the-picked-colour: ${chipScopeFailures.length}`);
for (const hit of chipScopeFailures) console.log(`       ${hit.reason}`);

const listRuleFailures = failures.filter(failure => failure.rule === 'the-list-does-not-colour-its-own-beaches');
console.log(`${listRuleFailures.length === 0 ? 'OK  ' : 'FAIL'} the-list-does-not-colour-its-own-beaches: ${listRuleFailures.length}`);
for (const hit of listRuleFailures) console.log(`       ${hit.reason}`);

const legendWordFailures = failures.filter(failure => failure.rule === 'every-pin-colour-has-a-legend-word');
console.log(`${legendWordFailures.length === 0 ? 'OK  ' : 'FAIL'} every-pin-colour-has-a-legend-word: ${legendWordFailures.length}`);
for (const hit of legendWordFailures) console.log(`       ${hit.reason}`);

const legendExitFailures = failures.filter(failure => failure.rule === 'a-collapsed-legend-has-a-way-out');
console.log(`${legendExitFailures.length === 0 ? 'OK  ' : 'FAIL'} a-collapsed-legend-has-a-way-out: ${legendExitFailures.length}`);
for (const hit of legendExitFailures) console.log(`       ${hit.reason}`);

if (failures.length > 0) {
  console.error('\nFAILED: the map pin and the card chip do not describe the same conditions.');
  console.error('Fix utils/suitabilityTone.resolveConditionTone, or whichever surface stopped reading it.');
  console.error('Never relax a rule here to make a combination pass — that is how the two ladders drifted apart the first time.');
  process.exit(1);
}

console.log('\nPASSED: every surface paints the same conditions the same colour.');
