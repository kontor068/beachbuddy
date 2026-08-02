/**
 * ONE SEA VERDICT PER PAGE — gate.
 *
 * The beach detail page states the same sea three times, in three different vocabularies:
 *
 *   1. TodayScoreBadge      getExperienceTier()       excellent | good | fair | skip
 *   2. "weather now" chip   buildWeatherNowContent()  calm | mixed | choppy
 *   3. wave graphic         getSeaSeverity()          calm | moderate | rough
 *
 * They used to be three independent ladders built at different times against different
 * thresholds, and the drift was visible on screen. Measured over this grid before
 * utils/seaVerdict existed (3.168 combinations):
 *
 *   663 (20,9%)  "Calm right now" printed beside an amber or rough wave figure
 *   126          of those sat directly above a 1,3–1,6 m sea — the protected-cove floor in
 *                calculateSeaConditionScore hid the measurement from the wording
 *   144 (4,5%)   "Excellent today" over an amber sea, ALL between 0,50 and 0,79 m, where only
 *                the wave graphic escalated (reported from Avlonas, Lemnos, 29/07/2026)
 *
 * This gate re-runs the real functions over the same grid and fails if any of those
 * contradictions come back. It is pure computation — no network, no data files.
 *
 * Run: node scripts/validateVerdictConsistency.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
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

const { getExperienceTier, getExperienceTierLabel, TONE_TIER_CEILING } = require(path.join(root, 'utils/experienceTier.ts'));
const { buildWeatherNowContent } = require(path.join(root, 'utils/weatherNowCopy.ts'));
const { calculateSeaConditionScore } = require(path.join(root, 'utils/seaConditions.ts'));
const { getSeaSeverity, getSeaStateSeverity } = require(path.join(root, 'utils/seaVerdict.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { WindDirection } = require(path.join(root, 'types.ts'));

const BEAUFORTS = [0, 1, 2, 3, 4, 5, 6, 7];
const WAVES_M = [0.1, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 1.0, 1.3, 1.6];
const PERIODS_S = [2.5, 4, 7];
// `undefined` is a real class nothing in this repo swept until 02/08/2026: a beach whose exposure
// was never resolved. The two ladders disagree about it on purpose — resolveWindTone tests only
// `=== 'exposed'`, so unknown reads as sheltered, while getExperienceTier's own fallback treats it
// as exposed. Sweeping it is what proves the minimum of the two lands on the cautious side.
const LEVELS = ['protected', 'partial', 'exposed', undefined];
const SCORES = [45, 65, 85];
/** Representative wind speed (km/h) at the middle of each Beaufort step. */
const BFT_KMH = { 0: 1, 1: 4, 2: 9, 3: 15, 4: 24, 5: 34, 6: 44, 7: 55 };

const TIER_RANK = { excellent: 3, good: 2, fair: 1, skip: 0 };

/**
 * The three shapes `getExperienceTier` is really called in. Sweeping only one would leave the
 * others unguarded, and they differ in ways that matter:
 *
 *   card        — components/BeachCard.tsx ×3. No seaConditionScore, no dayBeaufort. This is the
 *                 configuration ~all users see, and the one the 7,1% drift was measured in.
 *   detail-hero — pages/BeachDetailPage.tsx:1849, which DOES pass seaConditionScore.
 *   fallback    — no colour supplied, so the wind-only ladder inside getExperienceTier answers.
 *                 Keeps the path a future caller might land on under the same invariant.
 */
const CONFIGS = ['card', 'detail-hero', 'fallback'];

/**
 * The rules. Each returns a reason string when the combination is a contradiction the user
 * would actually see on one screen, or null when it is fine.
 *
 * `configs` says WHICH SCREEN. Rules 1-5 compare the badge against the "weather now" chip and the
 * wave graphic — three things that only ever appear TOGETHER on the beach detail page, which is
 * also the only surface that passes `seaConditionScore`. Running them over the card configuration
 * would assert a contradiction between two elements that are never on screen at the same time,
 * and would fail on 108 combinations for that reason alone. Rules 6-7 compare the word with its
 * own dot, which travels with the beach onto every surface, so they run everywhere.
 */
const ALL_CONFIGS = ['card', 'detail-hero', 'fallback'];
const DETAIL_ONLY = ['detail-hero'];

const RULES = [
  {
    id: 'excellent-over-running-sea',
    configs: DETAIL_ONLY,
    // Blue "Excellent today" is the strongest thing we say. It cannot sit above a wave figure
    // the same page paints amber or rough.
    check: ({ tier, severity }) =>
      tier === 'excellent' && severity !== 'calm'
        ? `badge "excellent" over a ${severity} sea`
        : null,
  },
  {
    id: 'calm-chip-over-running-sea',
    configs: DETAIL_ONLY,
    // "Calm right now" beside an amber/rough wave graphic — the Avlonas class, and in its worst
    // form a 1,3 m sea described as calm.
    check: ({ tone, severity }) =>
      tone === 'calm' && severity !== 'calm'
        ? `chip "calm" over a ${severity} sea`
        : null,
  },
  {
    id: 'choppy-chip-under-excellent-badge',
    configs: DETAIL_ONLY,
    // The two verdicts the user reads first must not disagree with each other.
    check: ({ tier, tone }) =>
      tier === 'excellent' && tone !== 'calm'
        ? `badge "excellent" with chip "${tone}"`
        : null,
  },
  {
    id: 'rough-sea-still-good',
    configs: DETAIL_ONLY,
    // A measured rough sea (>= SEA_STATE_ROUGH_M) may never read better than "OK".
    check: ({ tier, severity }) =>
      severity === 'rough' && (tier === 'excellent' || tier === 'good')
        ? `badge "${tier}" over a rough sea`
        : null,
  },
  {
    id: 'badge-endorses-a-day-the-swim-chip-refuses',
    configs: DETAIL_ONLY,
    // THE FIFTH LADDER. The four rules above compare the badge and the "weather now" chip; the
    // swim-feel chip inside the wave graphic was never in this grid, and it is the one that
    // prints "Difficult for swimming" / «Δύσκολη για μπάνιο» right under the metre figure.
    //
    // Reported from Ίος 29/07/2026: "OK at 11:00" at the top of the page, "Difficult for
    // swimming" a few centimetres below it, on the same 1,28 m sea. Two causes, both silent
    // here: getExperienceTier called a sea rough only from 1,5 m while every other surface uses
    // SEA_STATE_ROUGH_M (1,2), and it read the HEIGHT while the chip reads the shared sea-OR-wind
    // verdict. Measured over a 4.800-combination grid before the fix: 1.854 combinations (38,6%)
    // showed Excellent/Good/OK above a sea the shared ladder called rough.
    //
    // The condition below reproduces getSwimmingFeel's own rough branch verbatim
    // (components/WaveHeightGraphic.tsx:355-358): shelter softens the wording only when the
    // roughness comes from the WIND, never when the sea itself is rough.
    // Asserts on the LABEL the user reads, not the tier: a 'fair' beach in a running sea prints
    // "Sheltered, but rough water", which agrees with the chip. Only the three endorsing words
    // are forbidden there.
    check: ({ tier, severity, seaStateSeverity, exposureLevel, canClaimWindProtection, beaufort }) => {
      const isProtected = exposureLevel === 'protected' || canClaimWindProtection === true;
      const chipRefusesTheWater = severity === 'rough' && !(isProtected && seaStateSeverity !== 'rough');
      if (!chipRefusesTheWater) return null;
      const label = getExperienceTierLabel(tier, 'en', { windBeaufort: beaufort, seaIsRough: severity === 'rough' });
      return /^(Excellent|Good|OK)/.test(label)
        ? `badge "${label}" above a swim chip that says the water is difficult`
        : null;
    },
  },
  {
    id: 'red-pin-under-a-word-that-is-not-skip',
    configs: ALL_CONFIGS,
    // THE SIXTH LADDER, and the one that was missing entirely: the DOT versus the WORD.
    //
    // Rules 1-5 all compare text with text. Nothing compared the verdict with the colour the map
    // actually paints, so the two could drift a whole tier apart in silence — and they had.
    // Measured 01/08/2026 over a 60-combination sample: 26 printed «Μέτρια σήμερα» under a RED
    // pin. Part of that was pre-existing (an exposed shore at 5-6 Bft only skipped when its score
    // also fell below 25), part was introduced the same day when a rough sea was finally allowed
    // to redden a pin.
    //
    // Direction matters: a red pin MUST carry 'skip'. The reverse is deliberately not asserted —
    // a beach may read 'skip' for reasons the colour ladder does not model (an official warning,
    // a swim advisory), and refusing to recommend something we painted amber is the safe way to
    // be wrong.
    check: ({ pinTone, tier }) =>
      pinTone === 'red' && tier !== 'skip'
        ? `map pin is RED but the verdict is "${tier}" — the word sits a tier above its own dot`
        : null,
  },
  {
    id: 'word-above-its-own-pin',
    configs: ALL_CONFIGS,
    // RULE 6 GENERALISED (02/08/2026). Rule 6 only ever asked about RED. Everything softer went
    // unchecked, and that is where the drift actually lived: measured with the inputs a BeachCard
    // really passes, 169 of 2.376 combinations (7,1%) printed a word ABOVE its dot — «Καλή» over
    // an orange dot on EVERY protected shore at 5-6 Bft, i.e. every card on the home page on a
    // windy day, plus «Ιδανική» over a yellow dot at 4 Bft. The cause was a second, hand-written
    // wind ladder inside getExperienceTier whose own comment described a colour scale that had
    // stopped existing the previous morning.
    //
    // ONE DIRECTION ONLY. The reverse — a word more cautious than the dot — is legitimate and
    // common (1.019 of 3.024, 33,7%): the word folds in the composite score (access, amenities,
    // a swim advisory) and the colour describes conditions alone. This rule must therefore NEVER
    // assert equality, never "blue ⇒ excellent", never "yellow ⇒ at least good", and never
    // "orange ⇒ fair". Tightening it in any of those directions turns a thousand correct rows
    // red. `legitimatelyBelow` below counts them so an accidentally bidirectional rule shows up
    // as a suspiciously empty count rather than as silence.
    check: ({ pinTone, tier }) => (
      TIER_RANK[tier] > TONE_TIER_CEILING[pinTone]
        ? `verdict "${tier}" over a ${pinTone.toUpperCase()} dot — the word may read more cautiously than the colour, never better`
        : null
    ),
  },
];

const failures = [];
let combinations = 0;
/** Rows where the word is CALMER than the dot — the legitimate direction. See rule 7. */
let legitimatelyBelow = 0;

for (const beaufort of BEAUFORTS) {
  for (const waveHeightM of WAVES_M) {
    for (const wavePeriodS of PERIODS_S) {
      for (const exposureLevel of LEVELS) {
        for (const canClaimWindProtection of [true, false]) {
          // Only a protected profile can claim wind protection — the other pairs never occur.
          if (exposureLevel !== 'protected' && canClaimWindProtection) continue;
          // Geometry gates both flags to protected shores, and the offshore lift to exactly
          // 5 Bft (utils/offshoreFlatWater). Sweeping them wider would assert over states the
          // app cannot produce; sweeping them not at all — which is what this gate did until
          // 02/08 — asserts against a dot the app never paints for a cove or a lee shore.
          const COVES = exposureLevel === 'protected' ? [false, true] : [false];
          const LIFTS = exposureLevel === 'protected' && beaufort === 5 ? [false, true] : [false];
          for (const isEnclosedCove of COVES) {
          for (const offshoreFlatWater of LIFTS) {
          for (const config of CONFIGS) {
          for (const score of SCORES) {
            combinations += 1;
            const windSpeedKmh = BFT_KMH[beaufort];
            const seaConditionScore = calculateSeaConditionScore(
              exposureLevel !== 'protected',
              windSpeedKmh,
              exposureLevel,
              waveHeightM,
              false,
              wavePeriodS
            );

            // The dot this beach is actually wearing — full argument set, so the word is compared
            // against the colour the app paints rather than a simplified stand-in.
            const pinTone = resolveConditionTone({
              exposureLevel,
              beaufort,
              seaStateM: seaStateSeverityM(waveHeightM, wavePeriodS),
              isEnclosedCove,
              offshoreFlatWater,
            });

            const tier = getExperienceTier({
              score,
              windBeaufort: beaufort,
              // Only the pre-02/08 configuration passed these. Cards never have either.
              ...(config === 'detail-hero' ? { dayBeaufort: beaufort, seaConditionScore } : {}),
              waveHeightM,
              wavePeriodS,
              exposureLevel,
              // 'fallback' deliberately withholds it so the internal ladder answers instead.
              ...(config === 'fallback' ? {} : { conditionTone: pinTone }),
            });

            const { tone } = buildWeatherNowContent({
              beachName: 'Test', language: 'en', isToday: true, dataReady: true,
              windDir: WindDirection.NE,
              beaufort,
              waveHeightM,
              wavePeriodS,
              isWaveEstimate: false,
              protectedFrom: [],
              faces: [],
              canClaimWindProtection,
              isExposedToTodayWind: exposureLevel === 'exposed',
              mapExposureLevel: exposureLevel,
              seaConditionScore,
            });

            const severity = getSeaSeverity({
              waveHeightM, wavePeriodS, windBeaufort: beaufort, exposureLevel, canClaimWindProtection,
            });

            const seaStateSeverity = getSeaStateSeverity(seaStateSeverityM(waveHeightM, wavePeriodS));
            if (TIER_RANK[tier] < TONE_TIER_CEILING[pinTone]) legitimatelyBelow += 1;
            const row = { beaufort, waveHeightM, wavePeriodS, exposureLevel, canClaimWindProtection, score, tier, tone, severity, seaStateSeverity, pinTone, isEnclosedCove, offshoreFlatWater, config };
            for (const rule of RULES) {
              if (!rule.configs.includes(config)) continue;
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
  }
}

const byRule = new Map();
for (const failure of failures) {
  if (!byRule.has(failure.rule)) byRule.set(failure.rule, []);
  byRule.get(failure.rule).push(failure);
}

console.log('One sea verdict per page — consistency gate');
console.log(`Grid: ${combinations} condition combinations · ${RULES.length} rules\n`);

for (const rule of RULES) {
  const hits = byRule.get(rule.id) ?? [];
  const mark = hits.length === 0 ? 'OK  ' : 'FAIL';
  console.log(`${mark} ${rule.id}: ${hits.length}`);
  for (const hit of hits.slice(0, 3)) {
    const r = hit.row;
    console.log(`       ${hit.reason} — ${r.beaufort} Bft, ${r.waveHeightM} m @ ${r.wavePeriodS} s, ${r.exposureLevel}, score ${r.score}`);
  }
  if (hits.length > 3) console.log(`       …and ${hits.length - 3} more`);
}

/**
 * PROOF THAT RULE 7 DID NOT BECOME BIDIRECTIONAL.
 *
 * A word CALMER than its dot is correct and common — the word folds in the composite score, the
 * colour does not. If someone tightens rule 7 into an equality, every one of these rows starts
 * failing; but if they tighten it the other way (asserting the word must be at least as calm as
 * the dot) the failure list stays empty and the gate looks healthier than it is. Printing the
 * count makes that second mistake visible: a sudden zero here means the legitimate direction has
 * been outlawed, not that the app got better.
 */
const belowShare = (100 * legitimatelyBelow / combinations).toFixed(1);
console.log(`\nWord more cautious than its dot (legitimate): ${legitimatelyBelow} of ${combinations} (${belowShare}%)`);
if (legitimatelyBelow === 0) {
  console.error('FAILED: not one row has the word reading calmer than its dot.');
  console.error('That is not possible over this grid — rule 7 has been made bidirectional.');
  process.exit(1);
}

// ── Source wiring ────────────────────────────────────────────────────────────────────────────
//
// The grid above proves a pure function. It cannot see a SURFACE that forgot to pass the colour —
// which is the exact failure being fixed: for three days the word and the dot disagreed on every
// card while every gate stayed green, because no gate read the JSX. Same shape as
// `detail-map-gets-the-same-inputs` in scripts/validateConditionToneAgreement.mjs.
const wiringFailures = [];
const BADGE_FILES = ['components/BeachCard.tsx', 'pages/BeachDetailPage.tsx'];
for (const file of BADGE_FILES) {
  const source = readFileSync(path.join(root, file), 'utf8');
  const badges = source.split('<TodayScoreBadge').length - 1;
  const wired = source.split('conditionTone=').length - 1;
  if (badges !== wired) {
    wiringFailures.push(`${file}: ${badges} <TodayScoreBadge but ${wired} conditionTone= — a surface is on the old ladder`);
  }
}
const badgeSource = readFileSync(path.join(root, 'components/TodayScoreBadge.tsx'), 'utf8');
if (!badgeSource.includes('conditionTone,')) {
  wiringFailures.push('components/TodayScoreBadge.tsx: does not forward conditionTone into getExperienceTier');
}
const tierSource = readFileSync(path.join(root, 'utils/experienceTier.ts'), 'utf8');
if (!tierSource.includes("from './suitabilityTone'")) {
  wiringFailures.push('utils/experienceTier.ts: no longer reads the shared ladder — a second ladder has grown back');
}
// The explicit Record must agree with the severity scale it mirrors, or the two can drift apart
// exactly the way the ladder and the word did.
const { CALMNESS_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
for (const tone of CALMNESS_ORDER) {
  if (TONE_TIER_CEILING[tone] !== CALMNESS_ORDER.indexOf(tone)) {
    wiringFailures.push(`TONE_TIER_CEILING.${tone} = ${TONE_TIER_CEILING[tone]} but CALMNESS_ORDER puts it at ${CALMNESS_ORDER.indexOf(tone)}`);
  }
}

const wiringMark = wiringFailures.length === 0 ? 'OK  ' : 'FAIL';
console.log(`${wiringMark} every-verdict-knows-its-own-colour: ${wiringFailures.length}`);
for (const reason of wiringFailures) console.log(`       ${reason}`);

if (failures.length > 0 || wiringFailures.length > 0) {
  console.error(`\nFAILED: ${failures.length} contradicting combination(s), ${wiringFailures.length} wiring problem(s).`);
  console.error('Either the ladder in utils/seaVerdict.ts / utils/experienceTier.ts drifted, or a');
  console.error('surface stopped passing the colour it is painted. Never re-derive the wind');
  console.error('ceiling locally — that second ladder is what this gate exists to prevent.');
  process.exit(1);
}

console.log('\nPASSED: every surface tells the same story about the same sea.');
