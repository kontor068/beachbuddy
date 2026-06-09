import type {
  DataConfidence,
  GeospatialExposureProfile,
  WindExposureResult,
  WindSector,
} from '../types';
import { WindDirection } from '../types';
import {
  computeDirectionalExposure,
  onshoreComponent,
} from './geospatialExposureModel';
import {
  estimateFetchLimitedWaveHeightM,
  resolveEffectiveWaveHeightM,
} from './waveModel';
import {
  calculateWindExposure,
  estimateBeachOrientation,
  windDirectionToDegrees,
  type ExposureLevel,
} from './windExposure';

/**
 * Unified wind-exposure resolver.
 *
 * Produces a single, always-definite {@link WindExposureResult} for a beach
 * under one live wind, used identically by the scoring engine and the map/card
 * display so they can never disagree. It understands *where* the beach is (its
 * seaward facing direction from coastline geometry) and *how exposed* it is
 * (onshore/offshore wind, upwind fetch, and the resulting expected wave),
 * interpolated to the exact live wind direction.
 *
 * The user never sees "unknown": when geometry is missing we fall back to the
 * plain common-sense rule "wind blowing onto the shore = exposed, off the shore
 * = sheltered" and still return a concrete level. `confidence` is retained only
 * for internal sorting/tie-breaks and is never surfaced as doubt.
 */

const SECTORS: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// Neutral fetch assumptions (km) when no geospatial profile exists, so the wave
// model still yields a sensible figure from the resolved exposure level.
const FALLBACK_FETCH_KM: Record<ExposureLevel, number> = {
  exposed: 15,
  partial: 6,
  protected: 1.5,
};

export interface ResolveWindExposureInput {
  geospatialProfile?: GeospatialExposureProfile;
  /** Authored beach-facing direction (windProfile), highest-trust geometry. */
  authoredFacingDeg?: number | null;
  /** Verified orientation degrees from beach metadata. */
  orientationDeg?: number | null;
  /** Legacy protected-from directions, last-resort orientation source. */
  protectedFrom?: WindDirection[];
  windDirectionDeg: number;
  windSpeedKmh?: number;
  measuredWaveHeightM?: number;
  /** Authored windProfile explicitly marks this sector exposed. */
  explicitExposed?: boolean;
  /** Authored windProfile lets the beach claim shelter for this sector. */
  explicitProtected?: boolean;
}

interface InterpolatedSector {
  fetchKm: number;
  blockedRayRatio: number;
  intensity?: number;
  levels: [ExposureLevel, ExposureLevel];
}

const interpolateSector = (
  profile: GeospatialExposureProfile,
  windDirectionDeg: number
): InterpolatedSector => {
  const position = normalizeDegrees(windDirectionDeg) / 45;
  const lower = Math.floor(position) % SECTORS.length;
  const upper = (lower + 1) % SECTORS.length;
  const t = position - Math.floor(position);

  const a = profile.sectors[SECTORS[lower]];
  const b = profile.sectors[SECTORS[upper]];

  const intensity = typeof a.intensity === 'number' && typeof b.intensity === 'number'
    ? lerp(a.intensity, b.intensity, t)
    : undefined;

  return {
    fetchKm: lerp(a.fetchKm, b.fetchKm, t),
    blockedRayRatio: lerp(a.blockedRayRatio, b.blockedRayRatio, t),
    intensity,
    levels: [a.level, b.level],
  };
};

const resolveFacingDeg = (input: ResolveWindExposureInput): number | null => {
  if (typeof input.authoredFacingDeg === 'number' && Number.isFinite(input.authoredFacingDeg)) {
    return input.authoredFacingDeg;
  }
  const geo = input.geospatialProfile?.facingDeg;
  if (typeof geo === 'number' && Number.isFinite(geo)) return geo;
  if (typeof input.orientationDeg === 'number' && Number.isFinite(input.orientationDeg)) {
    return input.orientationDeg;
  }
  return estimateBeachOrientation(input.protectedFrom || []);
};

const directionLabel = (facingDeg: number): string => {
  const index = Math.round(normalizeDegrees(facingDeg) / 45) % SECTORS.length;
  return SECTORS[index];
};

const moreExposed = (a: ExposureLevel, b: ExposureLevel): ExposureLevel => {
  const rank: Record<ExposureLevel, number> = { protected: 0, partial: 1, exposed: 2 };
  return rank[a] >= rank[b] ? a : b;
};

export const resolveWindExposure = (input: ResolveWindExposureInput): WindExposureResult => {
  const windDeg = normalizeDegrees(input.windDirectionDeg);
  const facingDeg = resolveFacingDeg(input);
  const interpolated = input.geospatialProfile
    ? interpolateSector(input.geospatialProfile, windDeg)
    : undefined;

  let level: ExposureLevel;
  let intensity: number;
  let onshore = 0;
  let effectiveFetchKm = interpolated?.fetchKm ?? 0;
  let confidence: DataConfidence = input.geospatialProfile?.confidence || 'low';
  let reason: string;

  if (input.explicitExposed) {
    level = 'exposed';
    onshore = facingDeg !== null ? onshoreComponent(windDeg, facingDeg) : 1;
    effectiveFetchKm = interpolated?.fetchKm ?? FALLBACK_FETCH_KM.exposed;
    intensity = Math.max(interpolated?.intensity ?? 0, 70);
    confidence = 'high';
    reason = 'Open to the live wind direction (verified exposure)';
  } else if (input.explicitProtected) {
    level = 'protected';
    onshore = facingDeg !== null ? onshoreComponent(windDeg, facingDeg) : -1;
    effectiveFetchKm = interpolated?.fetchKm ?? FALLBACK_FETCH_KM.protected;
    intensity = Math.min(interpolated?.intensity ?? 100, 20);
    confidence = 'high';
    reason = 'Sheltered from the live wind direction (verified shelter)';
  } else if (facingDeg !== null) {
    // Primary path: real shoreline normal + onshore/offshore physics.
    onshore = onshoreComponent(windDeg, facingDeg);
    effectiveFetchKm = interpolated?.fetchKm ?? FALLBACK_FETCH_KM.partial;
    const directional = computeDirectionalExposure({
      fetchKm: effectiveFetchKm,
      blockedRayRatio: interpolated?.blockedRayRatio ?? 0.5,
      onshore,
    });
    level = directional.level;
    intensity = directional.intensity;
    if (interpolated) confidence = input.geospatialProfile?.confidence || 'medium';
    const face = directionLabel(facingDeg);
    reason = onshore > 0.25
      ? `Faces ${face}; wind blows onto the shore over ~${effectiveFetchKm.toFixed(0)} km fetch — exposed`
      : onshore < -0.25
        ? `Faces ${face}; wind blows offshore — sheltered surface`
        : `Faces ${face}; cross-shore wind — partial chop`;
  } else if (interpolated) {
    // Geometry-less profile: use stored intensity or the more exposed of the
    // two bracketing sector levels (never under-warn).
    intensity = interpolated.intensity ?? (
      moreExposed(interpolated.levels[0], interpolated.levels[1]) === 'exposed' ? 70
        : moreExposed(interpolated.levels[0], interpolated.levels[1]) === 'partial' ? 45 : 15
    );
    level = intensity >= 60 ? 'exposed' : intensity >= 33 ? 'partial' : 'protected';
    effectiveFetchKm = interpolated.fetchKm;
    reason = `Directional fetch profile — ${level}`;
  } else {
    // Last resort: pure common-sense from legacy protected-from directions.
    const legacyOrientation = estimateBeachOrientation(input.protectedFrom || []);
    const legacyLevel: ExposureLevel = legacyOrientation !== null
      ? calculateWindExposure(legacyOrientation, windDeg).exposureLevel
      : 'partial';
    level = legacyLevel;
    intensity = legacyLevel === 'exposed' ? 70 : legacyLevel === 'partial' ? 45 : 15;
    onshore = legacyOrientation !== null ? onshoreComponent(windDeg, legacyOrientation) : 0;
    effectiveFetchKm = FALLBACK_FETCH_KM[legacyLevel];
    reason = legacyLevel === 'protected'
      ? 'Wind blows off the shore — sheltered'
      : legacyLevel === 'exposed'
        ? 'Wind blows onto the shore — exposed'
        : 'Cross-shore wind — partial chop';
  }

  const modeledWaveHeightM = estimateFetchLimitedWaveHeightM({
    windSpeedKmh: input.windSpeedKmh ?? 0,
    fetchKm: effectiveFetchKm,
  });

  return {
    level,
    intensity: Number(intensity.toFixed(1)),
    facingDeg,
    effectiveFetchKm: Number(effectiveFetchKm.toFixed(2)),
    onshore: Number(onshore.toFixed(3)),
    modeledWaveHeightM,
    reason,
    confidence,
  };
};

/**
 * Convenience: the wave height to display, blending the modeled value with any
 * live marine measurement (so the user always sees a concrete figure).
 */
export const resolveDisplayWaveHeightM = (
  result: WindExposureResult,
  measuredWaveHeightM?: number
): number => resolveEffectiveWaveHeightM(measuredWaveHeightM, result.modeledWaveHeightM);

/** Maps a WindDirection enum (where the wind comes from) to degrees. */
export const windDirectionEnumToDegrees = (direction: WindDirection): number => windDirectionToDegrees(direction);
