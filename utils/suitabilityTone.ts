import type { WindSuitabilityColor } from '../types';
import type { ExposureLevel } from './windExposure';
import { seaStateToneCeiling } from './waveCharacter';

/** Shared visual tokens for the map marker and the compact card wave glyph. */
export const WIND_SUITABILITY_TONE_CLASSES: Record<WindSuitabilityColor, {
  marker: string;
  ring: string;
  badge: string;
  wave: string;
}> = {
  blue: {
    marker: 'bg-sky-500',
    ring: 'ring-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    wave: 'text-sky-500',
  },
  green: {
    marker: 'bg-emerald-500',
    ring: 'ring-emerald-200',
    badge: 'bg-emerald-100 text-emerald-700',
    wave: 'text-emerald-500',
  },
  yellow: {
    marker: 'bg-yellow-400',
    ring: 'ring-yellow-200',
    badge: 'bg-yellow-100 text-yellow-700',
    wave: 'text-yellow-400',
  },
  orange: {
    marker: 'bg-orange-500',
    ring: 'ring-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    wave: 'text-orange-500',
  },
  red: {
    marker: 'bg-rose-600',
    ring: 'ring-rose-300',
    badge: 'bg-rose-100 text-rose-700',
    wave: 'text-rose-600',
  },
};

/**
 * ONE CONDITION-COLOUR LADDER FOR THE WHOLE APP.
 *
 * There used to be two, built at different times, and they disagreed on 38% of the
 * (exposure × Beaufort × cove × sea) grid — always with the CARD more optimistic than
 * the map pin (measured 2026-07-31, 192 combinations):
 *
 *   • the region map pin      components/BeachMap.tsx getExposureMarkerTone
 *                             — 5 tones, and it read the sea state as a ceiling
 *   • the card / list chip    utils/windExposureEngine.ts getSimpleWindColor
 *                             — 4 tones, and it NEVER read the sea at all
 *
 * Two classes dominated, both user-visible:
 *   • 0–3 Bft with a running sea ≥0.8 m (the day after a meltemi — the swell outlives the
 *     wind by 12–24 h): card GREEN + shield icon, pin YELLOW/ORANGE. Every exposure level.
 *   • every protected shore at 4 Bft, whatever the sea: card GREEN, pin YELLOW.
 *
 * `seaStateToneCeiling` was written in utils/waveCharacter precisely so that "sea state →
 * colour" lives in exactly one place, "because the pin, the chip and the verdict word have
 * drifted apart before". The chip never called it. This module closes the same hole one
 * level up: BOTH surfaces now derive their tone here, so the drift cannot come back by
 * someone editing one ladder.
 *
 * The map's 5-tone ladder is the survivor — it was the more considered one, and it is the one
 * that already read the sea. The card palette gained the missing 'blue' rather than the ladder
 * being squashed into four tones: collapsing blue into green would have made an uncertain
 * 'partial' shore at 3 Bft look exactly like a verified protected one, a distinction the
 * validation suite pins deliberately.
 */
export type CalmnessTone = 'red' | 'orange' | 'yellow' | 'green' | 'blue';

/** Roughest → calmest. Index order is the comparison used by every ceiling below. */
export const CALMNESS_ORDER: readonly CalmnessTone[] = ['red', 'orange', 'yellow', 'green', 'blue'];

/**
 * An enclosed cove (όρμος) protected from the LIVE wind keeps its water flat as the wind
 * builds, so at 5 Bft it holds green where a classic protected shore drops to orange
 * (operator-verified at Άγιος Ερμογένης).
 *
 * It STOPS at 5, and that upper bound is the load-bearing part. The rule used to be
 * `beaufort >= 5`, while `swimmingComfortFromScore` returns `avoid_swimming` from an
 * effective Beaufort of 6 — and the −1 shelter discount in `getEffectiveBeaufortForComfort`
 * only applies at ≤5 Bft, so a cove at 6 Bft is ALWAYS avoid_swimming. The result was a
 * green pin and a green chip sitting directly above the app's own "better not to swim":
 * measured 2026-07-31 over the shipped geometry, 202 cove-shaped beaches and 1,010
 * beach × wind-direction combinations (4.4% of the national 22,800).
 *
 * The 29/07 research decided deliberately that `avoid_swimming` stays at 6 Bft (ISO 20712-2
 * offshore-wind flag, 0.36 m/s leeway on an unattended inflatable). The colour was simply
 * never aligned with that decision. It is now.
 *
 * Below 5 Bft a cove is NOT special-cased — it colours exactly like any protected shore,
 * because the distinction only means something once the wind threatens a swim.
 */
export const COVE_CALM_MIN_BEAUFORT = 5;
export const COVE_CALM_MAX_BEAUFORT = 5;

export const coveHoldsCalmWater = (
  isEnclosedCove: boolean,
  isProtected: boolean,
  beaufort: number
): boolean => (
  isEnclosedCove &&
  isProtected &&
  beaufort >= COVE_CALM_MIN_BEAUFORT &&
  beaufort <= COVE_CALM_MAX_BEAUFORT
);

/**
 * Wind-and-exposure tone, before the sea has its say.
 *
 * Each exposure column climbs cleanly through the tones as wind builds, so the same colour
 * never repeats down a column. Blue means genuinely calm (0–2 Bft, plus protected/partial
 * shores at 3 Bft where only open coasts feel it) — from 4 Bft up even sheltered shores get
 * visible chop.
 */
export const resolveWindTone = (
  exposureLevel: ExposureLevel | string | undefined,
  beaufort: number,
  isEnclosedCove = false
): CalmnessTone => {
  const isProtected = exposureLevel === 'protected';
  const isExposed = exposureLevel === 'exposed';

  if (beaufort >= 7) return 'red';
  if (coveHoldsCalmWater(isEnclosedCove, isProtected, beaufort)) return 'green';
  if (beaufort >= 5) return isExposed ? 'red' : 'orange';
  // At 4 Bft only genuinely exposed shores escalate to orange; protected and the uncertain
  // "partial" middle get a yellow "mild chop" heads-up.
  if (beaufort >= 4) return isExposed ? 'orange' : 'yellow';
  // At 3 Bft only genuinely exposed coasts feel a real chop; protected and the uncertain
  // "partial" middle stay calm enough to read as blue — this keeps the "uncertain partial"
  // from looking worse than a sheltered neighbour.
  if (beaufort >= 3) return isExposed ? 'yellow' : 'blue';
  return 'blue';
};

/**
 * A running sea sets a CEILING on how calm a surface may look. The wind ladder above cannot
 * see a sea built by wind over the water, earlier in the day, or further down the fetch —
 * which is why a light-wind day on an open shore was calm by construction.
 *
 * Ceiling only: it can never make something look calmer, and never pulls back an escalation
 * the wind already made. A cove that genuinely holds calm water is exempt — the grid cell
 * reporting the sea cannot resolve a 50 m pocket, and letting it overrule an operator-verified
 * morphology would be the marine model overruling the geometry.
 */
export const capToneBySeaState = (
  windTone: CalmnessTone,
  seaStateM: number | undefined,
  exempt = false
): CalmnessTone => {
  if (exempt) return windTone;
  const ceiling = seaStateToneCeiling(seaStateM);
  if (!ceiling) return windTone;
  return CALMNESS_ORDER.indexOf(windTone) > CALMNESS_ORDER.indexOf(ceiling) ? ceiling : windTone;
};

/**
 * The single entry point. Everything that paints "how are conditions here right now"
 * — map pin, card chip, list dot, saved-beaches row — must come through this.
 *
 * @param seaStateM swell-equivalent sea state in metres (utils/waveCharacter.seaStateSeverityM),
 *                  NOT the raw height: a 0.45 m 2.5 s chop and a 0.45 m 8 s roll are different water.
 */
export const resolveConditionTone = ({
  exposureLevel,
  beaufort,
  isEnclosedCove = false,
  seaStateM,
}: {
  exposureLevel: ExposureLevel | string | undefined;
  beaufort: number;
  isEnclosedCove?: boolean;
  seaStateM?: number;
}): CalmnessTone => capToneBySeaState(
  resolveWindTone(exposureLevel, beaufort, isEnclosedCove),
  seaStateM,
  coveHoldsCalmWater(isEnclosedCove, exposureLevel === 'protected', beaufort)
);

/**
 * Identity: the card/list palette carries all five tones, so nothing is lost on the way from the
 * shared ladder to a chip. Kept as a named conversion (rather than the raw tone) so the two types
 * stay documented as the same set — if they ever diverge again, it breaks here and nowhere else.
 */
export const toWindSuitabilityColor = (tone: CalmnessTone): WindSuitabilityColor => tone;
