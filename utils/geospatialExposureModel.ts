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
