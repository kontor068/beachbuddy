import type { GeospatialExposureProfile } from '../types';
import { onshoreComponent } from './geospatialExposureModel';
import { windSectorFromDegrees } from './windExposure';

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
/** Zero, not "short": a kilometre of open water at 5 Bft is a real chop. */
export const OFFSHORE_FLAT_MAX_FETCH_KM = 0;
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

  return onshoreComponent(windDirectionDeg, facingDeg) <= OFFSHORE_FLAT_MAX_ONSHORE;
};
