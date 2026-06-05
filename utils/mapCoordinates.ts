import type { Beach } from '../types';
import { destinationPoint } from './geospatialExposureModel';

export interface MapCoordinate {
  lat: number;
  lon: number;
}

const DISPLAY_MARKER_LANDWARD_NUDGE_KM = 0.045;
const EARTH_RADIUS_KM = 6371;

const isValidCoordinate = (coordinate?: Partial<MapCoordinate>): coordinate is MapCoordinate => (
  Number.isFinite(coordinate?.lat) &&
  Number.isFinite(coordinate?.lon)
);

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

const normalizeDegrees = (degrees: number) => ((degrees % 360) + 360) % 360;

const getDistanceKm = (from: MapCoordinate, to: MapCoordinate): number => {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const getBearingBetweenCoordinates = (
  from: MapCoordinate,
  to: MapCoordinate
): number => {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return normalizeDegrees(toDegrees(Math.atan2(y, x)));
};

export const nudgeCoordinateTowardFallbackCenter = (
  coordinate: MapCoordinate,
  fallbackCenter?: MapCoordinate,
  distanceKm = DISPLAY_MARKER_LANDWARD_NUDGE_KM
): MapCoordinate => {
  if (!isValidCoordinate(fallbackCenter) || distanceKm <= 0) {
    return coordinate;
  }

  if (getDistanceKm(coordinate, fallbackCenter) <= distanceKm * 1.5) {
    return coordinate;
  }

  return destinationPoint(
    coordinate,
    getBearingBetweenCoordinates(coordinate, fallbackCenter),
    distanceKm
  );
};

export const getBeachMapCoordinates = (
  beach: Pick<Beach, 'coordinates' | 'mapCoordinates'>,
  fallbackCenter?: MapCoordinate
): MapCoordinate => {
  if (isValidCoordinate(beach.mapCoordinates)) {
    return {
      lat: beach.mapCoordinates.lat,
      lon: beach.mapCoordinates.lon,
    };
  }

  return nudgeCoordinateTowardFallbackCenter(beach.coordinates, fallbackCenter);
};
