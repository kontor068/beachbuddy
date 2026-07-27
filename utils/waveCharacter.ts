/**
 * Wave CHARACTER — the missing axis.
 *
 * Every wave threshold in this app was a bare height in metres. That works for ocean swell,
 * which is what those numbers were calibrated against. It does not work for the Greek gulfs,
 * where almost all the energy is short-period wind chop, because two seas of the SAME
 * significant height are completely different water:
 *
 *              Hs 0.45 m @ 2.5 s          Hs 0.45 m @ 8 s
 *   wavelength        9.8 m                    99.9 m
 *   steepness         0.046                    0.0045
 *   waves per hour    1440                     450
 *
 * The first is steep, continuously breaking, and hits you three times as often. The second is
 * a gentle roll. Reported from Σχινιάς on 2026-07-27: a 0.45 m 2.5 s southerly sea at 2 Bft
 * that the app scored 9/10 and coloured blue.
 *
 * Rather than fork every threshold into a chop pair and a swell pair — which is exactly how
 * the map pin and the verdict word drift apart — this module converts (height, period) into
 * ONE swell-equivalent height. Every existing boundary (0.3 / 0.5 / 0.8 / 1.2 / 1.5 m) keeps
 * its meaning and its number; it just reads the equivalent instead of the raw height.
 *
 * The conversion:
 *
 *   equivalent = Hs · clamp((T_ref / T)^EXP, 1, MAX)
 *
 * T_ref is 4 s, and that choice is the whole design. It is NOT the ground-swell boundary (7 s):
 * referencing against ocean swell would multiply every ordinary Aegean sea by ~1.5 and silently
 * re-tune the entire app, when the existing height thresholds were validated against exactly
 * those ordinary 4–5 s seas over 128 ground-truth cases. 4 s is that norm. At or above it the
 * factor is exactly 1 and nothing in the app moves. Below it the sea is a young, steep, locally
 * forced chop the calibration never saw — and that, precisely, is the regime that was failing.
 *
 * What a swimmer feels sits between the encounter rate (∝ T⁻¹) and the steepness (∝ T⁻²), so the
 * exponent is taken between them, and the factor is capped so this can never become the dominant
 * term. Note the constants are calibrated against the period Open-Meteo REPORTS (a mean period,
 * not a peak period); they absorb that definition and should not be re-derived from a textbook.
 */

const GRAVITY = 9.81;
const TWO_PI = Math.PI * 2;

/** The ordinary Aegean wind-sea period the app's height thresholds were calibrated against. */
export const SEA_REFERENCE_PERIOD_S = 4;
/** Between encounter rate (T^-1) and steepness (T^-2). */
const CHOP_EXPONENT = 0.75;
/** Bounded so wave character adjusts the height, never overwhelms it. */
const MAX_CHOP_FACTOR = 1.75;

/**
 * Sea-state boundaries, in swell-equivalent metres. These are the ONLY pair — the map pin, the
 * card chip, the verdict word and the wave graphic all read them, so they cannot drift apart.
 * The values are unchanged from the height thresholds they replace.
 */
export const SEA_STATE_AMBER_M = 0.8;
export const SEA_STATE_ROUGH_M = 1.2;

/** Deep-water wavelength (m) for a period: L0 = g·T²/(2π). Exported for the UI's "why". */
export const deepWaterWavelengthM = (periodS: number): number => {
  if (!Number.isFinite(periodS) || periodS <= 0) return 0;
  return (GRAVITY * periodS * periodS) / TWO_PI;
};

/** Wave steepness Hs/L0. Exported so copy can describe the sea, not just measure it. */
export const waveSteepness = (heightM: number, periodS: number): number => {
  const l0 = deepWaterWavelengthM(periodS);
  if (l0 <= 0 || !Number.isFinite(heightM) || heightM <= 0) return 0;
  return heightM / l0;
};

/**
 * How much harsher this sea is than a long-period sea of the same height. 1 = no difference.
 *
 * A missing or non-finite period returns 1, so a beach with no period data behaves exactly as
 * it did before. That is deliberate: without the period we cannot tell chop from swell, and
 * inventing an escalation from a number we do not have is how false amber days get shipped.
 */
export const choppinessFactor = (periodS: number | undefined): number => {
  if (typeof periodS !== 'number' || !Number.isFinite(periodS) || periodS <= 0) return 1;
  if (periodS >= SEA_REFERENCE_PERIOD_S) return 1;
  const factor = Math.pow(SEA_REFERENCE_PERIOD_S / periodS, CHOP_EXPONENT);
  return Math.min(MAX_CHOP_FACTOR, Math.max(1, factor));
};

/**
 * The swell-equivalent height (m) every threshold in the app should compare against — i.e.
 * "a long-period sea this tall would feel the same". With no period it is the raw height.
 */
export const seaStateSeverityM = (
  waveHeightM: number | undefined,
  periodS: number | undefined
): number | undefined => {
  if (typeof waveHeightM !== 'number' || !Number.isFinite(waveHeightM)) return undefined;
  return Number((waveHeightM * choppinessFactor(periodS)).toFixed(2));
};

/**
 * True when the sea is short-period enough that its character, not just its height, is what
 * the user needs told. Used only to choose wording — never to escalate a score on its own.
 */
export const isShortPeriodSea = (periodS: number | undefined): boolean =>
  typeof periodS === 'number' && Number.isFinite(periodS) && periodS > 0 && periodS < 4;

export type SeaToneCeiling = 'yellow' | 'orange' | null;

/**
 * The calmest tone a running sea permits, or null when the sea has nothing to say.
 *
 * This lives here, beside the thresholds it reads, rather than inside the map component — the map
 * pin, the card chip and the verdict word have drifted apart before, and they only stay together
 * if there is exactly one place that turns a sea state into a colour. It is a CEILING: callers
 * apply it only when their own wind-derived tone is calmer, so it can never make a pin look better
 * than the wind already said, and never pull back an escalation the wind already made.
 */
export const seaStateToneCeiling = (seaStateM: number | undefined): SeaToneCeiling => {
  if (typeof seaStateM !== 'number' || !Number.isFinite(seaStateM)) return null;
  if (seaStateM >= SEA_STATE_ROUGH_M) return 'orange';
  if (seaStateM >= SEA_STATE_AMBER_M) return 'yellow';
  return null;
};
