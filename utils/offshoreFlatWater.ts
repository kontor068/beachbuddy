import type { GeospatialExposureProfile } from '../types';
import { onshoreComponent } from './geospatialExposureModel';
import { windSectorFromDegrees } from './windExposure';
import { estimateFetchLimitedWaveHeightM } from './waveModel';

/**
 * Top of the 5 Bft band in km/h (utils/weatherUtils.getBeaufortLevel: 5 Bft is ≤38). The gate
 * only ever runs at exactly 5 Bft, and taking the WORST wind in the band keeps the physical
 * assertion below conservative — a fetch that is flat at 38 km/h is flat at 30.
 */
const BEAUFORT_5_REFERENCE_WIND_KMH = 38;

/**
 * THE ONE CASE WHERE 5 BEAUFORT DOES NOT MEAN CHOP.
 *
 * The tone ladder (utils/suitabilityTone.resolveWindTone) reads wind SPEED at 5 Bft and gives
 * every shore that is not 'exposed' the same orange — shelter buys you "not red", never "good".
 * That is right for a shore the wind grazes, and wrong for a shore the wind blows OFF: with the
 * land upwind there is no fetch to build a wave on, and the water in front of the beach is
 * glass. Vai, 02/08/2026: 30 km/h from 295° onto an 85°-facing shore with 0 km of fetch, the
 * live camera showing a flat sea and a full beach, and our map calling it «Μέτρια».
 *
 * WHAT THE GATE ASKS, and why each clause is here rather than in a comment about future work:
 *
 *   • the sector's own geometry must already pass the strict green-pin test — fully blocked rays,
 *     low intensity, protected level, a profile we trust. This is the same evidence bar
 *     utils/mapExposure.isStableProtectedSector applies before painting a pin green, and reusing
 *     it means this rule can never be the FIRST thing to trust a weak profile;
 *   • zero modelled fetch in that sector. Not "short" — zero. A kilometre of open water at 5 Bft
 *     builds a real 30 cm chop, and the whole claim here is that there is nothing to build on;
 *   • the wind must meet the shore at more than 143° off head-on, measured from the beach's OWN
 *     facing against the LIVE bearing. Measured from the sector centre instead, Vai reads −0,65
 *     and fails its own case — the 45° bucket is too coarse for a question about angle.
 *
 * WHY IT STOPS AT 5 BFT. At 6 the app is already unconditionally avoid_swimming
 * (swimmingComfortFromScore), so lifting the colour there would print "good" over "do not swim" —
 * the same contradiction that cost the enclosed cove its own colour on 02/08. Below 5 there is
 * nothing to fix: a protected shore is already blue or yellow.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not touch the exposure level, the verdict word, the
 * score, or the ranking — only how calm the surface is allowed to LOOK. And it is not the last
 * word: the sea-state ceiling in capToneBySeaState still runs after it, so a beach with a real
 * running sea offshore goes back to orange even when this gate passes. That is the safety net
 * that keeps a swell wrapping into a lee shore from being painted calm, and it is why this rule
 * did not need one of its own.
 *
 * MEASURED BEFORE SHIPPING (02/08/2026, 501-beach national sample against live wind and live
 * marine data): 8% of beaches were at 5 Bft at all, and 13 of the 501 (2,6%) actually changed
 * colour — ~74 nationally on that day's weather. The geometry alone would allow 19,6% of the
 * country; the reason the real number is a seventh of that is that most beaches are not at 5 Bft
 * on any given day. Judge future changes to these constants against the LIVE number, not the
 * geometric one — the geometric count answers a question no user ever asks.
 */

/** Fully blocked rays. Mirrors utils/mapExposure.GEOMETRY_PROTECTION_BLOCKED_RATIO, stricter. */
export const OFFSHORE_FLAT_MIN_BLOCKED_RATIO = 1;
/** Sector intensity ceiling — less than half the 33 the green-pin test allows. */
export const OFFSHORE_FLAT_MAX_INTENSITY = 15;
/**
 * Short enough that our OWN wave model calls it nothing — not "exactly zero".
 *
 * ⚠️ 05/08/2026 — this was `0`, an exact-equality test against a number that is a MEAN of a
 * five-ray fan. A ray fan almost never averages to a clean zero, so the gate was rejecting the
 * very shores it was written for. Measured nationally at 5 Bft: 322 beach × sector combinations
 * across 258 beaches passed every other test — fully land-blocked, intensity under 15, wind more
 * than 143° off head-on — and were denied on fetch alone. Their denied fetch: minimum 0,04 km,
 * MEDIAN 0,12 km, p90 0,64 km. 302 of them also carry engine level 'protected', i.e. they would
 * genuinely have gone orange → yellow. Σχινιάς N (0,2 km, intensity 0,2/100) was one, with a
 * webcam showing glass while the page said otherwise.
 *
 * 0,5 km is not a tuned number and must not become one — it is READ OFF the physics. At the top
 * of the 5 Bft band our own SMB model (utils/waveModel.estimateFetchLimitedWaveHeightM) returns
 * 0,197 m over 0,5 km and crosses 0,20 m at ≈0,52 km. The assertion below re-derives that at
 * runtime, so if either the constant or the wave model moves, the gate closes rather than
 * silently widening.
 */
export const OFFSHORE_FLAT_MAX_FETCH_KM = 0.5;
/**
 * The modelled fetch-limited height this gate may still call flat, in metres.
 *
 * Anchored to the app's own vocabulary rather than picked: 0,20 m is BELOW THE LOWEST WIND-CHOP
 * FLOOR the app applies anywhere (0,30 m — utils/waveModel.getWindChopWaveFloorM, protected shore
 * at 4 Bft). A height the app already refuses to call chop is a height this gate may call flat.
 *
 * It was 0,10 m for one draft — the cove DISPLAY floor — and that was wrong: measured against the
 * real SMB it rejected 0,12 km of fetch, i.e. it would have thrown out Σχινιάς (0,2 km → 0,134 m)
 * and every other beach this fix exists for. The display floor answers "what is too small to
 * print"; this answers "what is too small to be chop". Different questions.
 */
export const OFFSHORE_FLAT_MAX_MODELLED_WAVE_M = 0.2;
/**
 * cos(windFrom − facing) ≤ this, i.e. more than 143° off head-on. The same `onshoreComponent`
 * the cove guard and the wave model read, so three parts of the app cannot disagree about which
 * way the wind meets a shore.
 */
export const OFFSHORE_FLAT_MAX_ONSHORE = -0.8;
/** Below this a protected shore is already blue or yellow; above it, avoid_swimming. */
export const OFFSHORE_FLAT_BEAUFORT = 5;

export interface OffshoreFlatWaterInput {
  profile?: GeospatialExposureProfile;
  /** Degrees the wind comes FROM, at THIS beach — not the region's. */
  windDirectionDeg?: number;
  beaufort?: number;
}

/**
 * True when the water in front of this beach is flat because the wind is blowing off the land
 * behind it, at the one wind strength where saying so changes the colour.
 */
export const holdsFlatWaterUnderOffshoreWind = ({
  profile,
  windDirectionDeg,
  beaufort,
}: OffshoreFlatWaterInput): boolean => {
  if (beaufort !== OFFSHORE_FLAT_BEAUFORT) return false;
  if (!profile) return false;
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return false;

  const facingDeg = profile.facingDeg;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return false;
  if (profile.confidence !== 'high' && profile.confidence !== 'medium') return false;

  const sector = profile.sectors?.[windSectorFromDegrees(windDirectionDeg)];
  if (!sector || sector.level !== 'protected') return false;
  if (sector.blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return false;
  if (typeof sector.intensity !== 'number' || sector.intensity >= OFFSHORE_FLAT_MAX_INTENSITY) return false;
  if (sector.fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return false;
  // The physical half of the fetch test: whatever the constant says, the water is only "flat" if
  // our own fetch-limited model agrees it is. This keeps the 0,6 km above honest — raise it and
  // this line starts rejecting, instead of silently widening a false-calm.
  const modelledM = estimateFetchLimitedWaveHeightM({
    windSpeedKmh: BEAUFORT_5_REFERENCE_WIND_KMH,
    fetchKm: sector.fetchKm,
  });
  if (typeof modelledM === 'number' && modelledM > OFFSHORE_FLAT_MAX_MODELLED_WAVE_M) return false;

  return onshoreComponent(windDirectionDeg, facingDeg) <= OFFSHORE_FLAT_MAX_ONSHORE;
};
