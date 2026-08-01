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

const { getExperienceTier, getExperienceTierLabel } = require(path.join(root, 'utils/experienceTier.ts'));
const { buildWeatherNowContent } = require(path.join(root, 'utils/weatherNowCopy.ts'));
const { calculateSeaConditionScore } = require(path.join(root, 'utils/seaConditions.ts'));
const { getSeaSeverity, getSeaStateSeverity } = require(path.join(root, 'utils/seaVerdict.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { WindDirection } = require(path.join(root, 'types.ts'));

const BEAUFORTS = [0, 1, 2, 3, 4, 5, 6, 7];
const WAVES_M = [0.1, 0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 1.0, 1.3, 1.6];
const PERIODS_S = [2.5, 4, 7];
const LEVELS = ['protected', 'partial', 'exposed'];
const SCORES = [45, 65, 85];
/** Representative wind speed (km/h) at the middle of each Beaufort step. */
const BFT_KMH = { 0: 1, 1: 4, 2: 9, 3: 15, 4: 24, 5: 34, 6: 44, 7: 55 };

/**
 * The rules. Each returns a reason string when the combination is a contradiction the user
 * would actually see on one screen, or null when it is fine.
 */
const RULES = [
  {
    id: 'excellent-over-running-sea',
    // Blue "Excellent today" is the strongest thing we say. It cannot sit above a wave figure
    // the same page paints amber or rough.
    check: ({ tier, severity }) =>
      tier === 'excellent' && severity !== 'calm'
        ? `badge "excellent" over a ${severity} sea`
        : null,
  },
  {
    id: 'calm-chip-over-running-sea',
    // "Calm right now" beside an amber/rough wave graphic — the Avlonas class, and in its worst
    // form a 1,3 m sea described as calm.
    check: ({ tone, severity }) =>
      tone === 'calm' && severity !== 'calm'
        ? `chip "calm" over a ${severity} sea`
        : null,
  },
  {
    id: 'choppy-chip-under-excellent-badge',
    // The two verdicts the user reads first must not disagree with each other.
    check: ({ tier, tone }) =>
      tier === 'excellent' && tone !== 'calm'
        ? `badge "excellent" with chip "${tone}"`
        : null,
  },
  {
    id: 'rough-sea-still-good',
    // A measured rough sea (>= SEA_STATE_ROUGH_M) may never read better than "OK".
    check: ({ tier, severity }) =>
      severity === 'rough' && (tier === 'excellent' || tier === 'good')
        ? `badge "${tier}" over a rough sea`
        : null,
  },
  {
    id: 'badge-endorses-a-day-the-swim-chip-refuses',
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
];

const failures = [];
let combinations = 0;

for (const beaufort of BEAUFORTS) {
  for (const waveHeightM of WAVES_M) {
    for (const wavePeriodS of PERIODS_S) {
      for (const exposureLevel of LEVELS) {
        for (const canClaimWindProtection of [true, false]) {
          // Only a protected profile can claim wind protection — the other pairs never occur.
          if (exposureLevel !== 'protected' && canClaimWindProtection) continue;
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

            const tier = getExperienceTier({
              score,
              windBeaufort: beaufort,
              dayBeaufort: beaufort,
              waveHeightM,
              wavePeriodS,
              exposureLevel,
              seaConditionScore,
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
            // The pin's own colour, from the shared ladder — so rule 6 can compare the dot on the
            // map with the word printed beside it instead of trusting they were kept in step.
            const pinTone = resolveConditionTone({
              exposureLevel,
              beaufort,
              seaStateM: seaStateSeverityM(waveHeightM, wavePeriodS),
            });
            const row = { beaufort, waveHeightM, wavePeriodS, exposureLevel, canClaimWindProtection, score, tier, tone, severity, seaStateSeverity, pinTone };
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

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} contradicting combination(s).`);
  console.error('The page would state the same sea two different ways. Fix the ladder in');
  console.error('utils/seaVerdict.ts, or the surface that stopped reading it.');
  process.exit(1);
}

console.log('\nPASSED: every surface tells the same story about the same sea.');
