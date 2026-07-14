import type { GeospatialExposureProfile } from '../types';
import { estimateFetchLimitedWaveHeightM, resolveEffectiveWaveHeightM } from './waveModel';
import { onshoreComponent } from './geospatialExposureModel';
import { interpolateSectorGeometry } from './windExposureModel';

/**
 * Cove-aware wave-height selection for DISPLAY ONLY (detail page). No scoring, level, colour,
 * filter or ranking depends on this — it only decides which wave NUMBER the user reads.
 *
 * Why this exists: the displayed wave is normally `max(live-marine, modeled)`. In a genuinely
 * enclosed cove the live-marine (Open-Meteo) grid cell sits in open water offshore and OVER-reads
 * the near-shore height (proven: 34/43 rough-side + 60/60 calm-side dense re-scans certified the
 * stored fetch, so SMB on it is the trustworthy near-shore figure while Open-Meteo is cove-blind).
 * There, `max()` is guaranteed to surface the wrong (larger) number. The guard replaces it with
 * the fetch-limited SMB estimate on the certified fetch.
 *
 * SWELL GUARD (mandatory). SMB models only local wind-sea. A 0-fetch cove can still receive
 * distant ground swell that wraps into the bay mouth — the ONE genuine false-calm risk. So the
 * cove path is taken only when NO meaningful swell is present. NOTE: the gate is swell PRESENCE
 * (`hasSwell`: swell height >= 0.5 m), NOT the geometric `exposed` flag. `exposed` requires the
 * swell-facing sector to be open (blockedRayRatio < 0.6); for a deeply enclosed cove that sector
 * is itself blocked, so `exposed` is structurally false even while swell wraps in — using it would
 * reopen the exact false-calm we must prevent. Presence is strictly the safer gate.
 */

/** Blockage at/above which the cove's own shore, not open fetch, sets the near-shore height. */
export const COVE_BLOCKED_MIN = 0.8;
/**
 * The cove's fetch must be SHORT — this is where the dense re-scan certified the geometry (the
 * validated calm regime is fetch < ~1 km; 2 km is a modest, still-calm extension, SMB <= ~0.35 m
 * at 6 Bft). NOT the 8 km "serious fetch" threshold: at 2-8 km with blocked>=0.8 the average fetch
 * hides a longer channel ray (the mean-hides-channel case), so the near-shore wave is not reliably
 * small there and max() must stand (e.g. Kythira Vlychada N, fetch 5.5 km / SMB 0.64 m).
 */
export const COVE_FETCH_MAX_KM = 2;
/**
 * MANDATORY. blocked>=0.8 & fetch<8 alone is ALSO true for every OFFSHORE sector of every beach
 * (rays fired toward the land the wind blows from hit it at ~0 km → blocked=1, fetch=0). An
 * offshore wind leaves the local wind-sea ~0, but NOT the sea — residual wave / swell the offshore
 * SMB cannot see, which max(live-marine, modeled) correctly keeps. Without this gate the guard
 * fires on ~12x too many sectors and writes false-calm on open beaches. The cove path applies ONLY
 * when the live wind actually blows ONTO the shore (onshore component positive and non-grazing).
 */
export const COVE_ONSHORE_MIN = 0.2;
/**
 * Display floor. A near-zero SMB (fully-enclosed 0-fetch corner) reads as "0.00 m", which looks
 * like a broken figure, not calm water — the sea is never perfectly flat. Below this, do NOT
 * override; keep max() (its small residual is more honest than a bare zero).
 */
export const COVE_DISPLAY_FLOOR_M = 0.10;

export interface CoveWaveInput {
  geospatialProfile?: GeospatialExposureProfile;
  /** Seaward facing (deg) for the onshore read shown in the breakdown; from scoreResult.facingDeg. */
  facingDeg: number | null;
  windDirectionDeg: number;
  windSpeedKmh: number;
  /** Live marine grid wave height (m), if any. */
  measuredWaveHeightM?: number;
  /** The app's existing damped modeled height (scoreResult.modeledWaveHeightM) — used only for the
   *  unchanged non-cove `max(measured, modeled)` path. */
  appModeledWaveHeightM: number;
  /** True when meaningful swell is present (assessSwellExposure().hasSwell). Blocks the cove path. */
  swellPresent: boolean;
}

export interface CoveWave {
  /** The wave height to DISPLAY (big meter, hourly strip, copy, and the component). */
  waveHeightM: number;
  source: 'cove-calm-smb' | 'standard-max';
  /** True when the geometry qualifies as an enclosed cove (blocked >= MIN and fetch < MAX). */
  isCove: boolean;
  /** True when the cove path was actually taken (isCove AND no swell). */
  coveApplied: boolean;
  /** Raw fetch-limited SMB height on the interpolated live-wind fetch (the cove-calm number). */
  smbWaveHeightM: number;
  fetchKm?: number;
  blockedRayRatio?: number;
  /** Onshore component in [-1,1] at the live wind, for the "κατάμουτρα/πλάγιος/από τη στεριά" read. */
  onshore?: number;
}

export const resolveCoveAwareWaveHeightM = (input: CoveWaveInput): CoveWave => {
  const geom = input.geospatialProfile
    ? interpolateSectorGeometry(input.geospatialProfile, input.windDirectionDeg)
    : undefined;
  const smbWaveHeightM = estimateFetchLimitedWaveHeightM({
    windSpeedKmh: input.windSpeedKmh,
    fetchKm: geom?.fetchKm ?? 0,
  });
  const standardMax = resolveEffectiveWaveHeightM(input.measuredWaveHeightM, input.appModeledWaveHeightM);
  const onshore = input.facingDeg !== null && Number.isFinite(input.facingDeg)
    ? Number(onshoreComponent(input.windDirectionDeg, input.facingDeg).toFixed(3))
    : undefined;

  // Geometry+direction qualifier: an enclosed shore (blocked, short fetch) that the live wind
  // actually blows ONTO. The onshore gate is what separates a genuine cove from any beach's
  // offshore sectors (which also read blocked=1/fetch=0 but face a sea max() must not erase).
  const isCove = geom !== undefined
    && geom.blockedRayRatio >= COVE_BLOCKED_MIN
    && geom.fetchKm < COVE_FETCH_MAX_KM
    && onshore !== undefined
    && onshore > COVE_ONSHORE_MIN;
  // Take the cove path only when it is also swell-free and the SMB figure is a believable
  // non-zero height (see COVE_DISPLAY_FLOOR_M).
  const coveApplied = isCove && !input.swellPresent && smbWaveHeightM >= COVE_DISPLAY_FLOOR_M;

  return {
    waveHeightM: coveApplied ? smbWaveHeightM : standardMax,
    source: coveApplied ? 'cove-calm-smb' : 'standard-max',
    isCove,
    coveApplied,
    smbWaveHeightM,
    fetchKm: geom ? Number(geom.fetchKm.toFixed(2)) : undefined,
    blockedRayRatio: geom ? Number(geom.blockedRayRatio.toFixed(2)) : undefined,
    onshore,
  };
};
