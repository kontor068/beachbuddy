/**
 * Long-period swell surge (roadmap #2, 2026-06-27). Wave power scales with period as
 * well as height: the same 0.7 m breaks far harder as 9 s ground swell than as 4 s
 * wind-sea. The gate g(T)=clamp((T-FLOOR)/(FULL-FLOOR),0,1) keeps the term a strict
 * no-op on short seas (Greek summer wind-sea is ~3-6 s; a 42-beach probe maxed at 6.0 s)
 * and escalates only on genuine Atlantic ground swell (>=~7 s, episodic in the Ionian/west).
 *
 * Pure module so both services/recommendationService and scripts/validateMeltemiMatrix
 * share one source of truth without the validation script importing the whole service.
 */
export const SWELL_SURGE_PERIOD_FLOOR_S = 6;    // g(T)=0 at/below this — dormant on all wind-sea
export const SWELL_SURGE_PERIOD_FULL_S = 9;     // g(T)=1 — genuine ground swell
export const SWELL_SURGE_TIER_HIGH_M = 0.9;     // surge = H*g(T) tiers, on the wave-penalty altitude
export const SWELL_SURGE_TIER_MID_M = 0.6;
export const SWELL_SURGE_TIER_LOW_M = 0.35;
export const SWELL_SURGE_PENALTY_HIGH = 22;
export const SWELL_SURGE_PENALTY_MID = 14;
export const SWELL_SURGE_PENALTY_LOW = 7;

/**
 * Period-gated swell-surge comfort penalty (points off the swimming score). Returns 0
 * (no-op) unless BOTH period and height are finite AND the period clears the floor — so
 * missing or short-period seas never make a beach look calmer OR rougher than the
 * height-only logic.
 */
export const computeSwellSurgePenalty = (periodS?: number, heightM?: number): number => {
  if (!Number.isFinite(periodS) || !Number.isFinite(heightM)) return 0;
  const span = SWELL_SURGE_PERIOD_FULL_S - SWELL_SURGE_PERIOD_FLOOR_S;
  const gate = Math.max(0, Math.min(1, ((periodS as number) - SWELL_SURGE_PERIOD_FLOOR_S) / span));
  const surge = (heightM as number) * gate;
  if (surge >= SWELL_SURGE_TIER_HIGH_M) return SWELL_SURGE_PENALTY_HIGH;
  if (surge >= SWELL_SURGE_TIER_MID_M) return SWELL_SURGE_PENALTY_MID;
  if (surge >= SWELL_SURGE_TIER_LOW_M) return SWELL_SURGE_PENALTY_LOW;
  return 0;
};
