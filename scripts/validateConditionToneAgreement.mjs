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
const { resolveConditionTone, showsCoveBadge, COVE_BADGE_MAX_BEAUFORT, CALMNESS_ORDER, LEGEND_TONE_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
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
const NON_GRID_RULES = 5;
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
  // 1800, not 900: the function carries the reasoning for each input it feeds the resolver, and
  // the window has to fit the comments as well as the code — a guard that fails because someone
  // explained themselves teaches people to delete the explanation.
  const resolver = mapSource.match(/const\s+beachConditionTone\s*=[\s\S]{0,1800}?\n\s*\}\);/);
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

  if (/\bresolveConditionTone\b/.test(appSource)) {
    fail('App.tsx calls resolveConditionTone. The list must read the tones the map reported '
      + '(mapBeachTones), never paint its own — that is how the list and the legend became two '
      + 'rules over the same evidence in the first place.');
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
  if (!sheetButton || !/isUnavailable\s*=\s*!isSelected\s*&&\s*unavailableFilterSet\.has\(filter\)/.test(sheetSource)
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

if (failures.length > 0) {
  console.error('\nFAILED: the map pin and the card chip do not describe the same conditions.');
  console.error('Fix utils/suitabilityTone.resolveConditionTone, or whichever surface stopped reading it.');
  console.error('Never relax a rule here to make a combination pass — that is how the two ladders drifted apart the first time.');
  process.exit(1);
}

console.log('\nPASSED: every surface paints the same conditions the same colour.');
