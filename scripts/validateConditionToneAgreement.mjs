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

// RULES covers the grid sweep; the wiring rule and the slider rule are asserted after it, so the
// headline counts all of them — a gate that under-reports its own coverage invites the assumption
// that something is checked when it is not.
const NON_GRID_RULES = 4;
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
  const resolver = mapSource.match(/const\s+beachConditionTone\s*=[\s\S]{0,900}?\n\s*\}\);/);
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
if (!/visibleWindColorGuideRows\s*=\s*CALMNESS_ORDER/.test(mapSource)) {
  failures.push({
    rule: 'slider-has-no-ladder-of-its-own',
    reason: 'the legend rows are no longer derived from CALMNESS_ORDER over mapToneTally.counts — '
      + 'the legend and the pins can drift apart again.',
    row: {},
  });
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
    for (const field of ['seaStateWaveM', 'seaStatePeriodS', 'enclosedCove', 'exposureLevel']) {
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
for (const tone of emittedTones) {
  for (const lang of LANGS) {
    // Match the per-language toneLabel object and look for this tone key inside it.
    const block = mapSource.match(new RegExp(`${lang}:\\s*\\{\\s*toneLabel:\\s*\\{([^}]*)\\}`));
    const body = block ? block[1] : '';
    if (!new RegExp(`\\b${tone}\\s*:\\s*['"\`][^'"\`]+['"\`]`).test(body)) {
      failures.push({
        rule: 'every-pin-colour-has-a-legend-word',
        reason: `the ladder can paint a "${tone}" pin, but the legend has no ${lang} word for it — `
          + 'that pin would appear with a coloured dot and no explanation.',
        row: {},
      });
    }
  }
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

const legendWordFailures = failures.filter(failure => failure.rule === 'every-pin-colour-has-a-legend-word');
console.log(`${legendWordFailures.length === 0 ? 'OK  ' : 'FAIL'} every-pin-colour-has-a-legend-word: ${legendWordFailures.length}`);
for (const hit of legendWordFailures) console.log(`       ${hit.reason}`);

if (failures.length > 0) {
  console.error('\nFAILED: the map pin and the card chip do not describe the same conditions.');
  console.error('Fix utils/suitabilityTone.resolveConditionTone, or whichever surface stopped reading it.');
  console.error('Never relax a rule here to make a combination pass — that is how the two ladders drifted apart the first time.');
  process.exit(1);
}

console.log('\nPASSED: every surface paints the same conditions the same colour.');
