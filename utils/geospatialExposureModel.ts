import type { ExposureLevel } from './windExposure';

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface LandMask {
  isLand(point: GeoPoint): boolean;
  source: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface FetchRaySample {
  bearingDeg: number;
  openWaterKm: number;
  blockedByLand: boolean;
}

export interface GeospatialExposureInput {
  beach: GeoPoint;
  windDirectionDeg: number;
  landMask: LandMask;
  maxFetchKm?: number;
  stepKm?: number;
  nearshoreLandGraceKm?: number;
  nearshoreWaterSearchKm?: number;
  nearshoreWaterSearchStepKm?: number;
  sampleOrigin?: GeoPoint;
  sampleOriginAdjustedKm?: number;
  fanAnglesDeg?: number[];
}

export interface GeospatialExposureResult {
  exposureLevel: ExposureLevel;
  openWaterFetchKm: number;
  blockedRayRatio: number;
  samples: FetchRaySample[];
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  sampleOrigin: GeoPoint;
  sampleOriginAdjustedKm: number;
}

const EARTH_RADIUS_KM = 6371;
const DEFAULT_MAX_FETCH_KM = 20;
const DEFAULT_STEP_KM = 0.25;
const DEFAULT_NEARSHORE_WATER_SEARCH_KM = 4;
const DEFAULT_NEARSHORE_WATER_SEARCH_STEP_KM = 0.25;
const DEFAULT_FAN_ANGLES_DEG = [-30, -15, 0, 15, 30];
const NEARSHORE_SEARCH_BEARING_STEP_DEG = 15;

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;

export const destinationPoint = (
  point: GeoPoint,
  bearingDeg: number,
  distanceKm: number
): GeoPoint => {
  const bearing = normalizeDegrees(bearingDeg) * Math.PI / 180;
  const distance = distanceKm / EARTH_RADIUS_KM;
  const lat1 = point.lat * Math.PI / 180;
  const lon1 = point.lon * Math.PI / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distance) +
    Math.cos(lat1) * Math.sin(distance) * Math.cos(bearing)
  );
  const lon2 = lon1 + Math.atan2(
    Math.sin(bearing) * Math.sin(distance) * Math.cos(lat1),
    Math.cos(distance) - Math.sin(lat1) * Math.sin(lat2)
  );

  return {
    lat: lat2 * 180 / Math.PI,
    lon: normalizeLongitude(lon2 * 180 / Math.PI),
  };
};

const normalizeLongitude = (longitude: number): number => {
  let normalized = longitude;
  while (normalized > 180) normalized -= 360;
  while (normalized < -180) normalized += 360;
  return normalized;
};

const sampleFetchRay = (
  beach: GeoPoint,
  bearingDeg: number,
  landMask: LandMask,
  maxFetchKm: number,
  stepKm: number,
  nearshoreLandGraceKm: number
): FetchRaySample => {
  for (let distanceKm = stepKm; distanceKm <= maxFetchKm; distanceKm += stepKm) {
    const samplePoint = destinationPoint(beach, bearingDeg, distanceKm);
    if (landMask.isLand(samplePoint) && distanceKm > nearshoreLandGraceKm) {
      return {
        bearingDeg: normalizeDegrees(bearingDeg),
        openWaterKm: Number(Math.max(0, distanceKm - stepKm).toFixed(2)),
        blockedByLand: true,
      };
    }
  }

  return {
    bearingDeg: normalizeDegrees(bearingDeg),
    openWaterKm: maxFetchKm,
    blockedByLand: false,
  };
};

const classifyFetchExposure = (
  averageFetchKm: number,
  blockedRayRatio: number
): ExposureLevel => {
  if (averageFetchKm >= 8 && blockedRayRatio < 0.4) return 'exposed';
  if (averageFetchKm <= 2 && blockedRayRatio >= 0.6) return 'protected';
  return 'partial';
};

export const resolveNearshoreWaterOrigin = (
  beach: GeoPoint,
  landMask: LandMask,
  maxSearchKm: number,
  searchStepKm: number
): { point: GeoPoint; adjustedKm: number } => {
  if (!landMask.isLand(beach)) {
    return { point: beach, adjustedKm: 0 };
  }

  for (let distanceKm = searchStepKm; distanceKm <= maxSearchKm; distanceKm += searchStepKm) {
    for (let bearingDeg = 0; bearingDeg < 360; bearingDeg += NEARSHORE_SEARCH_BEARING_STEP_DEG) {
      const candidate = destinationPoint(beach, bearingDeg, distanceKm);
      if (!landMask.isLand(candidate)) {
        return {
          point: candidate,
          adjustedKm: Number(distanceKm.toFixed(2)),
        };
      }
    }
  }

  return { point: beach, adjustedKm: 0 };
};

const DEFAULT_ORIENTATION_MAX_KM = 3;
const DEFAULT_ORIENTATION_STEP_KM = 0.1;
const DEFAULT_ORIENTATION_BEARING_STEP_DEG = 10;

/** Open-water distance (km) from an origin along one bearing, capped at maxKm. */
const openWaterAlongBearing = (
  origin: GeoPoint,
  bearingDeg: number,
  landMask: LandMask,
  maxKm: number,
  stepKm: number
): number => {
  for (let distanceKm = stepKm; distanceKm <= maxKm; distanceKm += stepKm) {
    if (landMask.isLand(destinationPoint(origin, bearingDeg, distanceKm))) {
      return Number(Math.max(0, distanceKm - stepKm).toFixed(2));
    }
  }
  return maxKm;
};

/**
 * Derives the direction a beach faces (its seaward shoreline normal) purely
 * from coastline geometry, replacing the old "faces away from island centre"
 * heuristic. Casts short rays in every direction from the nearshore water
 * origin and takes the open-water-weighted resultant vector: it points toward
 * the open sea, which is exactly the direction the beach looks out to.
 *
 * Returns a compass bearing 0-360 (0 = N), or null when the geometry is
 * degenerate (e.g. an offshore point with open water on every side).
 */
export const computeShorelineOrientation = (
  origin: GeoPoint,
  landMask: LandMask,
  maxKm: number = DEFAULT_ORIENTATION_MAX_KM,
  bearingStepDeg: number = DEFAULT_ORIENTATION_BEARING_STEP_DEG,
  stepKm: number = DEFAULT_ORIENTATION_STEP_KM
): number | null => {
  let sumX = 0;
  let sumY = 0;
  let totalWeight = 0;

  for (let bearingDeg = 0; bearingDeg < 360; bearingDeg += bearingStepDeg) {
    const openKm = openWaterAlongBearing(origin, bearingDeg, landMask, maxKm, stepKm);
    const rad = normalizeDegrees(bearingDeg) * Math.PI / 180;
    sumX += openKm * Math.sin(rad);
    sumY += openKm * Math.cos(rad);
    totalWeight += openKm;
  }

  if (totalWeight === 0) return null;

  const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
  // Near-symmetric openness (islet / open sea) yields no meaningful normal.
  if (magnitude / totalWeight < 0.08) return null;

  const facing = (Math.atan2(sumX, sumY) * 180 / Math.PI + 360) % 360;
  return Number(facing.toFixed(1));
};

/**
 * Onshore component of the wind for a beach with the given facing direction.
 * Wind direction is where the wind comes FROM.
 *   +1 = fully onshore (blowing from the sea straight onto the beach -> waves)
 *    0 = along-shore
 *   -1 = fully offshore (blowing from the land out to sea -> flat water)
 */
export const onshoreComponent = (windFromDeg: number, facingDeg: number): number => (
  Math.cos((normalizeDegrees(windFromDeg) - normalizeDegrees(facingDeg)) * Math.PI / 180)
);

export interface DirectionalExposureInput {
  fetchKm: number;
  blockedRayRatio: number;
  /** Onshore component in [-1, 1] from {@link onshoreComponent}. */
  onshore: number;
}

export interface DirectionalExposure {
  /** Exposure intensity 0-100 (0 = calm/protected, 100 = fully exposed). */
  intensity: number;
  level: ExposureLevel;
}

const FETCH_SATURATION_KM = 12;
const EXPOSED_INTENSITY = 60;
const PROTECTED_INTENSITY = 33;

/**
 * Combines upwind fetch, land blockage and the onshore wind component into a
 * single continuous exposure intensity. Offshore winds keep the swimming area
 * flat regardless of the fetch behind them, so the onshore component gates the
 * result; fetch and openness then scale how rough an onshore wind gets.
 */
export const computeDirectionalExposure = ({ fetchKm, blockedRayRatio, onshore }: DirectionalExposureInput): DirectionalExposure => {
  const onshoreFactor = (Math.max(-1, Math.min(1, onshore)) + 1) / 2;
  const fetchFactor = Math.max(0, Math.min(1, fetchKm / FETCH_SATURATION_KM));
  const openness = 1 - Math.max(0, Math.min(1, blockedRayRatio));
  const intensity = Number((100 * onshoreFactor * (0.6 + 0.4 * fetchFactor * openness)).toFixed(1));

  const level: ExposureLevel = intensity >= EXPOSED_INTENSITY
    ? 'exposed'
    : intensity >= PROTECTED_INTENSITY
      ? 'partial'
      : 'protected';

  return { intensity, level };
};

export const assessGeospatialWindExposure = ({
  beach,
  windDirectionDeg,
  landMask,
  maxFetchKm = DEFAULT_MAX_FETCH_KM,
  stepKm = DEFAULT_STEP_KM,
  nearshoreLandGraceKm = 0,
  nearshoreWaterSearchKm = DEFAULT_NEARSHORE_WATER_SEARCH_KM,
  nearshoreWaterSearchStepKm = DEFAULT_NEARSHORE_WATER_SEARCH_STEP_KM,
  sampleOrigin: providedSampleOrigin,
  sampleOriginAdjustedKm,
  fanAnglesDeg = DEFAULT_FAN_ANGLES_DEG,
}: GeospatialExposureInput): GeospatialExposureResult => {
  const sampleOrigin = providedSampleOrigin
    ? {
      point: providedSampleOrigin,
      adjustedKm: sampleOriginAdjustedKm ?? 0,
    }
    : resolveNearshoreWaterOrigin(
      beach,
      landMask,
      nearshoreWaterSearchKm,
      nearshoreWaterSearchStepKm
    );
  const samples = fanAnglesDeg.map(offsetDeg => sampleFetchRay(
    sampleOrigin.point,
    windDirectionDeg + offsetDeg,
    landMask,
    maxFetchKm,
    stepKm,
    nearshoreLandGraceKm
  ));
  const averageFetchKm = samples.reduce((sum, sample) => sum + sample.openWaterKm, 0) / samples.length;
  const blockedRayRatio = samples.filter(sample => sample.blockedByLand).length / samples.length;
  const exposureLevel = classifyFetchExposure(averageFetchKm, blockedRayRatio);

  return {
    exposureLevel,
    openWaterFetchKm: Number(averageFetchKm.toFixed(2)),
    blockedRayRatio: Number(blockedRayRatio.toFixed(2)),
    samples,
    confidence: landMask.confidence,
    reason: `${landMask.source}: ${samples.length} upwind fetch rays, average open water ${averageFetchKm.toFixed(1)} km, ${(blockedRayRatio * 100).toFixed(0)}% blocked by land${sampleOrigin.adjustedKm > 0 ? `, sampled from nearest water ${sampleOrigin.adjustedKm.toFixed(1)} km from beach coordinate` : ''}.`,
    sampleOrigin: sampleOrigin.point,
    sampleOriginAdjustedKm: sampleOrigin.adjustedKm,
  };
};
