import type { Beach, SuitableBeach, WindProfile, WindProfileSource, WindSector } from '../types';
import { WindDirection } from '../types';
import { calculateDistance } from './weatherUtils';
import { calculateWindExposure, estimateBeachOrientation, type ExposureLevel } from './windExposure';

const windSectors: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const windSectorToDirection: Record<WindSector, WindDirection> = {
  N: WindDirection.N,
  NE: WindDirection.NE,
  E: WindDirection.E,
  SE: WindDirection.SE,
  S: WindDirection.S,
  SW: WindDirection.SW,
  W: WindDirection.W,
  NW: WindDirection.NW,
};

const normalizeDegrees = (degrees: number): number => ((degrees % 360) + 360) % 360;
const ADJACENT_BEACH_MAX_DISTANCE_KM = 0.65;
const SIMILAR_BEACH_FRONT_MAX_DEGREES = 45;

const getWindSectorFromDegrees = (degrees?: number): WindSector | undefined => {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) return undefined;
  return windSectors[Math.round(normalizeDegrees(degrees) / 45) % windSectors.length];
};

type MapExposureItem = Pick<
  SuitableBeach,
  'exposureLevel' | 'geospatialExposure' | 'orientation' | 'windProfile' | 'windProfileSource' | 'windSector' | 'warnings'
> & {
  beach: Pick<Beach, 'id' | 'coordinates' | 'protectedFrom'>;
};

const hasAuthoritativeWindProfileSource = (source?: WindProfileSource): boolean => (
  source === 'override' || source === 'beach' || source === 'metadata'
);

const hasUsableWindProfile = (profile?: WindProfile): profile is WindProfile => Boolean(
  profile &&
  (
    profile.knownWindSportSpot ||
    profile.exposedToWindDirections.length > 0 ||
    profile.protectedFromWindDirections.length > 0 ||
    profile.shelterLevel !== 'unknown' ||
    profile.fetchExposure !== 'unknown' ||
    typeof profile.beachFacingDirection === 'number'
  )
);

const exposureFromWindProfile = (
  profile: WindProfile,
  sector?: WindSector,
  windBeaufort = 0,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  if (profile.knownWindSportSpot && windBeaufort >= 4) return 'exposed';
  if (sector && profile.exposedToWindDirections.includes(sector)) return 'exposed';
  if (sector && profile.protectedFromWindDirections.includes(sector)) return 'protected';

  if (
    typeof profile.beachFacingDirection === 'number' &&
    Number.isFinite(profile.beachFacingDirection) &&
    typeof windDirectionDeg === 'number' &&
    Number.isFinite(windDirectionDeg)
  ) {
    return calculateWindExposure(profile.beachFacingDirection, windDirectionDeg).exposureLevel;
  }

  if (profile.shelterLevel === 'open') return 'exposed';
  if (profile.shelterLevel === 'semi_sheltered') return 'partial';
  if (profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered') return 'protected';
  if (profile.fetchExposure === 'high') return 'exposed';
  if (profile.fetchExposure === 'medium' || profile.fetchExposure === 'low') return 'partial';

  return undefined;
};

const exposureFromHighPriorityWindProfile = (
  profile: WindProfile,
  sector?: WindSector,
  windBeaufort = 0,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  if (profile.knownWindSportSpot && windBeaufort >= 4) return 'exposed';
  if (sector && profile.exposedToWindDirections.includes(sector)) return 'exposed';
  if (profile.confidence !== 'low') {
    return exposureFromWindProfile(profile, sector, windBeaufort, windDirectionDeg);
  }

  return undefined;
};

const exposureFromExplicitOrientation = (
  orientation?: number | null,
  windDirectionDeg?: number
): ExposureLevel | undefined => (
  typeof orientation === 'number' &&
  Number.isFinite(orientation) &&
  typeof windDirectionDeg === 'number' &&
  Number.isFinite(windDirectionDeg)
    ? calculateWindExposure(orientation, windDirectionDeg).exposureLevel
    : undefined
);

const exposureFromLegacyProtectedFrom = (
  protectedFrom: WindDirection[] | undefined,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  const legacyOrientation = estimateBeachOrientation(protectedFrom || []);
  return exposureFromExplicitOrientation(legacyOrientation, windDirectionDeg);
};

const getMapOrientation = (item: MapExposureItem): number | null => (
  typeof item.orientation === 'number' && Number.isFinite(item.orientation)
    ? item.orientation
    : typeof item.windProfile?.beachFacingDirection === 'number' && Number.isFinite(item.windProfile.beachFacingDirection)
      ? item.windProfile.beachFacingDirection
      : estimateBeachOrientation(item.beach.protectedFrom)
);

const angularDistanceDegrees = (a: number, b: number): number => {
  const diff = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return diff > 180 ? 360 - diff : diff;
};

const protectedFromSignature = (item: MapExposureItem): string => (
  item.beach.protectedFrom || []
).map(String).sort().join('|');

const hasReliableExplicitMorphology = (
  item: MapExposureItem,
  sector?: WindSector,
  windBeaufort = 0
): boolean => {
  const profile = item.windProfile;
  if (!hasAuthoritativeWindProfileSource(item.windProfileSource)) return false;
  if (!profile || profile.confidence === 'low') return false;

  if (profile.knownWindSportSpot && windBeaufort >= 4) return true;
  if (sector && profile.exposedToWindDirections.includes(sector)) return true;
  if (sector && profile.protectedFromWindDirections.includes(sector)) return true;
  if (profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered') return true;
  if (profile.shelterLevel === 'open' && profile.fetchExposure === 'high') return true;

  return false;
};

const areLikelySameBeachFront = (a: MapExposureItem, b: MapExposureItem): boolean => {
  const distanceKm = calculateDistance(
    a.beach.coordinates.lat,
    a.beach.coordinates.lon,
    b.beach.coordinates.lat,
    b.beach.coordinates.lon
  );

  if (distanceKm > ADJACENT_BEACH_MAX_DISTANCE_KM) return false;

  const aOrientation = getMapOrientation(a);
  const bOrientation = getMapOrientation(b);

  if (typeof aOrientation === 'number' && typeof bOrientation === 'number') {
    return angularDistanceDegrees(aOrientation, bOrientation) <= SIMILAR_BEACH_FRONT_MAX_DEGREES;
  }

  const aSignature = protectedFromSignature(a);
  return aSignature.length > 0 && aSignature === protectedFromSignature(b);
};

const exposurePriority = (level: ExposureLevel): number => {
  if (level === 'exposed') return 2;
  if (level === 'partial') return 1;
  return 0;
};

const getMoreConservativeExposure = (levels: ExposureLevel[]): ExposureLevel => (
  levels.reduce((current, next) => (
    exposurePriority(next) > exposurePriority(current) ? next : current
  ), 'protected' as ExposureLevel)
);

export const getVisibleMapExposureLevel = (
  item: Pick<SuitableBeach, 'exposureLevel' | 'geospatialExposure' | 'orientation' | 'windProfile' | 'windProfileSource' | 'windSector' | 'warnings'> & { beach: Pick<Beach, 'protectedFrom'> },
  windBeaufort?: number,
  windDirectionDeg?: number
) => {
  const sector = item.windSector ?? getWindSectorFromDegrees(windDirectionDeg);
  const canUseWindProfile = hasAuthoritativeWindProfileSource(item.windProfileSource) && hasUsableWindProfile(item.windProfile);
  const highPriorityProfileExposure = canUseWindProfile
    ? exposureFromHighPriorityWindProfile(item.windProfile, sector, windBeaufort ?? 0, windDirectionDeg)
    : undefined;
  if (highPriorityProfileExposure) return highPriorityProfileExposure;

  const fallbackProfileExposure = canUseWindProfile
    ? exposureFromWindProfile(item.windProfile, sector, windBeaufort ?? 0, windDirectionDeg)
    : undefined;
  const explicitOrientationExposure = exposureFromExplicitOrientation(item.orientation, windDirectionDeg);
  const legacyExposure = exposureFromLegacyProtectedFrom(item.beach.protectedFrom, windDirectionDeg);
  const directionalFallbackExposure = fallbackProfileExposure || explicitOrientationExposure || legacyExposure;

  const geospatialExposure = sector
    ? item.geospatialExposure?.sectors?.[sector]?.level
    : undefined;

  if (geospatialExposure === 'exposed' || geospatialExposure === 'protected') return geospatialExposure;
  if (directionalFallbackExposure === 'exposed' || directionalFallbackExposure === 'protected') {
    return directionalFallbackExposure;
  }
  if (geospatialExposure) return geospatialExposure;
  if (directionalFallbackExposure) return directionalFallbackExposure;

  if (sector && item.beach.protectedFrom?.includes(windSectorToDirection[sector])) return 'partial';

  if (item.exposureLevel) return item.exposureLevel;

  return 'partial';
};

export const getConsistentVisibleMapExposureLevels = (
  items: MapExposureItem[],
  windBeaufort?: number,
  windDirectionDeg?: number
): Map<number, ExposureLevel> => {
  const levels = new Map<number, ExposureLevel>();
  items.forEach(item => {
    levels.set(item.beach.id, getVisibleMapExposureLevel(item, windBeaufort, windDirectionDeg));
  });

  if (items.length < 2) return levels;

  const parent = new Map<number, number>();
  items.forEach(item => parent.set(item.beach.id, item.beach.id));

  const find = (id: number): number => {
    const current = parent.get(id) ?? id;
    if (current === id) return id;
    const root = find(current);
    parent.set(id, root);
    return root;
  };

  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent.set(rootB, rootA);
  };

  const sector = getWindSectorFromDegrees(windDirectionDeg);
  const beaufort = windBeaufort ?? 0;

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!areLikelySameBeachFront(a, b)) continue;

      const aLocked = hasReliableExplicitMorphology(a, sector, beaufort);
      const bLocked = hasReliableExplicitMorphology(b, sector, beaufort);
      if (aLocked && bLocked && levels.get(a.beach.id) !== levels.get(b.beach.id)) continue;

      union(a.beach.id, b.beach.id);
    }
  }

  const groups = new Map<number, MapExposureItem[]>();
  items.forEach(item => {
    const root = find(item.beach.id);
    const group = groups.get(root) || [];
    group.push(item);
    groups.set(root, group);
  });

  groups.forEach(group => {
    if (group.length < 2) return;

    const currentLevels = group
      .map(item => levels.get(item.beach.id))
      .filter((level): level is ExposureLevel => Boolean(level));
    const uniqueLevels = new Set(currentLevels);
    if (uniqueLevels.size <= 1) return;

    const lockedLevels = group
      .filter(item => hasReliableExplicitMorphology(item, sector, beaufort))
      .map(item => levels.get(item.beach.id))
      .filter((level): level is ExposureLevel => Boolean(level));
    const uniqueLockedLevels = new Set(lockedLevels);

    const targetLevel = uniqueLockedLevels.size === 1
      ? lockedLevels[0]
      : getMoreConservativeExposure(currentLevels);

    group.forEach(item => {
      if (uniqueLockedLevels.size > 1 && hasReliableExplicitMorphology(item, sector, beaufort)) return;
      levels.set(item.beach.id, targetLevel);
    });
  });

  return levels;
};
