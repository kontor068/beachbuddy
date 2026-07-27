import type { GeospatialExposureProfile, WindSector } from '../types';
import { calculateWindExposure } from './windExposure';

/**
 * Direct-swell exposure geometry (single source of truth).
 *
 * Background swell arrives independently of the local wind, so a beach can read "calm"
 * (low wind) yet be breaking from an Atlantic ground swell. Whether the swell actually
 * reaches THIS cove is a geometry question: it hits only if it comes onshore
 * (cos(swellDir - facing) > 0.3) AND the sector facing the swell is open
 * (blockedRayRatio < 0.6). A closed bay whose mouth points away is not charged.
 *
 * `exposed` mirrors exactly the directSwell boolean used by recommendationService to dock
 * the score; `meaningful` is the stricter ground-swell gate (long period + real height)
 * used to decide whether the swell is worth SURFACING to the user — so the UI stays a
 * strict no-op on the short-period wind-sea that dominates the Aegean summer.
 */

const SECTOR_ORDER: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/** Swell height (m) at/above which onshore geometry is worth judging (matches scoring gate). */
export const SWELL_MIN_HEIGHT_M = 0.5;
/** Period (s) at/above which a swell is genuine long-period ground swell (worth surfacing). */
export const GROUND_SWELL_MIN_PERIOD_S = 7;

export interface SwellExposureInput {
  swellDirectionDeg?: number;
  swellHeightM?: number;
  swellPeriodS?: number;
}

export interface SwellExposure {
  /** Onshore swell of real height is present, so the cove geometry can be judged. */
  hasSwell: boolean;
  /** This cove faces the swell through an open sector (the canonical directSwell). */
  exposed: boolean;
  /** Genuine long-period ground swell — worth surfacing to the user. */
  meaningful: boolean;
  heightM: number;
  periodS?: number;
  directionDeg?: number;
}

export const assessSwellExposure = (
  profile: GeospatialExposureProfile | undefined,
  beachOrientationDeg: number | null,
  input: SwellExposureInput
): SwellExposure => {
  const heightM = typeof input.swellHeightM === 'number' && Number.isFinite(input.swellHeightM) ? input.swellHeightM : 0;
  const directionDeg = typeof input.swellDirectionDeg === 'number' && Number.isFinite(input.swellDirectionDeg) ? input.swellDirectionDeg : undefined;
  const periodS = typeof input.swellPeriodS === 'number' && Number.isFinite(input.swellPeriodS) ? input.swellPeriodS : undefined;

  const hasSwell = directionDeg !== undefined && heightM >= SWELL_MIN_HEIGHT_M;

  let exposed = false;
  if (hasSwell) {
    const facingDeg = typeof profile?.facingDeg === 'number' ? profile.facingDeg : null;
    if (facingDeg !== null && profile) {
      const onshore = Math.cos((directionDeg! - facingDeg) * Math.PI / 180);
      const nearestSector = SECTOR_ORDER[((Math.round(directionDeg! / 45) % 8) + 8) % 8];
      // Use the engine's own verdict for the sector, not a raw blockedRayRatio threshold.
      // blockedRayRatio only means "the ray terminated on land inside the 25 km cap", which is
      // true almost everywhere in the Aegean — geospatialExposureModel already knows this and
      // applies an 8→12 km saturation ramp so distant land does not discount an open sector.
      // This gate never got that fix, so it read a wide-open sector as closed whenever the far
      // shore happened to sit inside the cap. Σχινιάς is the exact boundary case: its S sector
      // is 18.7 km of open water, `exposed`, intensity 99.7 — and blockedRayRatio 0.60, so
      // `0.60 < 0.60` was false and the beach could never be charged a southerly swell on its
      // own most exposed side, while SwellRouterSection told the user it "stays flat".
      const sectorOpen = (profile.sectors?.[nearestSector]?.level ?? 'protected') !== 'protected';
      exposed = onshore > 0.3 && sectorOpen;
    } else if (beachOrientationDeg !== null) {
      exposed = calculateWindExposure(beachOrientationDeg, directionDeg!).exposureLevel === 'exposed';
    }
  }

  const meaningful = hasSwell && periodS !== undefined && periodS >= GROUND_SWELL_MIN_PERIOD_S;

  return { hasSwell, exposed, meaningful, heightM, periodS, directionDeg };
};
