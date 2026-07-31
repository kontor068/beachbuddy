import type { Beach, SuitableBeach, WindProfile, WindProfileSource, WindSector } from '../types';
import { WindDirection } from '../types';
import { areInSameShorelineSegment } from './shorelineSegments';
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

// Wind-exposure colours are always available; the map tone is decided by the
// current Beaufort band in BeachMap. Kept as a function for call-site compatibility.
export const shouldShowWindExposureColors = (_windBeaufort?: number): boolean => true;

type MapExposureItem = Pick<
  SuitableBeach,
  'exposureLevel' | 'geospatialExposure' | 'orientation' | 'windProfile' | 'windProfileSource' | 'windSector' | 'warnings'
> & {
  beach: Pick<Beach, 'id' | 'coordinates' | 'protectedFrom'>;
};

const hasAuthoritativeWindProfileSource = (source?: WindProfileSource): boolean => (
  source === 'override' || source === 'beach' || source === 'metadata' || source === 'geospatial'
);

const canUseMapWindProfile = (
  profile?: WindProfile,
  source?: WindProfileSource
): profile is WindProfile => (
  hasUsableWindProfile(profile) &&
  (
    hasAuthoritativeWindProfileSource(source) ||
    // Some UI paths pass already-scored beach items where the resolved profile is
    // present but the source field is omitted. Still use the profile so explicit
    // wind-sport/open-exposure warnings are not lost in the map path.
    source === undefined
  )
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

const canWindProfileClaimProtected = (
  profile: WindProfile,
  sector?: WindSector
): boolean => Boolean(
  sector &&
  profile.confidence !== 'low' &&
  !profile.knownWindSportSpot &&
  (profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered') &&
  profile.protectedFromWindDirections.includes(sector)
);

const exposureFromWindProfile = (
  profile: WindProfile,
  sector?: WindSector,
  windBeaufort = 0,
  windDirectionDeg?: number
): ExposureLevel | undefined => {
  if (profile.knownWindSportSpot && windBeaufort >= 4) return 'exposed';
  if (sector && profile.exposedToWindDirections.includes(sector)) return 'exposed';
  if (canWindProfileClaimProtected(profile, sector)) return 'protected';

  if (
    typeof profile.beachFacingDirection === 'number' &&
    Number.isFinite(profile.beachFacingDirection) &&
    typeof windDirectionDeg === 'number' &&
    Number.isFinite(windDirectionDeg)
  ) {
    const angularExposure = calculateWindExposure(profile.beachFacingDirection, windDirectionDeg).exposureLevel;
    return angularExposure === 'protected' && !canWindProfileClaimProtected(profile, sector)
      ? 'partial'
      : angularExposure;
  }

  if (profile.shelterLevel === 'open') return 'exposed';
  if (profile.shelterLevel === 'semi_sheltered') return 'partial';
  if (profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered') return 'partial';
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
  if (!canUseMapWindProfile(profile, item.windProfileSource)) return false;
  if (profile.confidence === 'low') return false;

  if (profile.knownWindSportSpot && windBeaufort >= 4) return true;
  if (sector && profile.exposedToWindDirections.includes(sector)) return true;
  if (sector && profile.protectedFromWindDirections.includes(sector)) return true;
  if (profile.shelterLevel === 'open' && profile.fetchExposure === 'high') return true;

  return false;
};

// Same two numbers the scoring engine uses to let geometry EARN a protected claim
// (utils/windExposureEngine.hasGeometryEnclosedProtection): near-total land blockage plus low
// residual wind energy. They live in both files because the two must agree — see
// isStableProtectedSector below for why that stopped being optional.
const GEOMETRY_PROTECTION_BLOCKED_RATIO = 0.95;
const GEOMETRY_PROTECTION_MAX_INTENSITY = 33;

/**
 * Whether the geometry is strong enough to call this sector protected on its own.
 *
 * The map used to paint a pin protected off the RAW sector level, while the engine additionally
 * required blockage ≥0.95 and intensity <33 before a geospatial-backfill beach could claim
 * shelter — otherwise its profile stays `semi_sheltered` and the level falls to 'partial'.
 * Measured 2026-07-31 across the shipped profiles: 459 of 22,800 beach × sector combinations
 * (2.0%) were geometry-'protected' without passing the strict test, i.e. a green pin over a card
 * that said "partial shelter". Concentrated in Halkidiki (26), Corfu (23), Chania (21), Kos and
 * Rhodes (16 each), Zakynthos (15).
 *
 * The deliberate map-vs-engine asymmetry documented further down is the OTHER direction (pin one
 * band REDDER than the card, 207 cases) — that one is intended and stays. This one never was.
 *
 * A missing `intensity` counts as NOT stable, matching the engine exactly (24 sectors nationally).
 * Under-claiming shelter is cheap; painting a pin green off geometry that cannot support it is the
 * expensive error.
 */
const isStableProtectedSector = (
  geospatialExposure: MapExposureItem['geospatialExposure'],
  sector?: WindSector
): boolean => {
  if (!sector) return false;
  const sectorExposure = geospatialExposure?.sectors?.[sector];
  const confidence = geospatialExposure?.confidence;
  if (!sectorExposure || sectorExposure.level !== 'protected') return false;
  if (confidence !== 'high' && confidence !== 'medium') return false;

  return sectorExposure.blockedRayRatio >= GEOMETRY_PROTECTION_BLOCKED_RATIO
    && typeof sectorExposure.intensity === 'number'
    && sectorExposure.intensity < GEOMETRY_PROTECTION_MAX_INTENSITY;
};

const hasStableGeospatialProtection = (
  item: MapExposureItem,
  sector?: WindSector
): boolean => isStableProtectedSector(item.geospatialExposure, sector);

const hasCuratedSegmentProtectionSupport = (
  item: MapExposureItem,
  group: MapExposureItem[],
  sector?: WindSector
): boolean => group.some(candidate => (
  candidate.beach.id !== item.beach.id &&
  areInSameShorelineSegment(candidate.beach.id, item.beach.id) &&
  hasStableGeospatialProtection(candidate, sector)
));

const areLikelySameBeachFront = (a: MapExposureItem, b: MapExposureItem): boolean => {
  const sameCuratedSegment = areInSameShorelineSegment(a.beach.id, b.beach.id);
  const distanceKm = calculateDistance(
    a.beach.coordinates.lat,
    a.beach.coordinates.lon,
    b.beach.coordinates.lat,
    b.beach.coordinates.lon
  );

  if (!sameCuratedSegment && distanceKm > ADJACENT_BEACH_MAX_DISTANCE_KM) return false;

  const aOrientation = getMapOrientation(a);
  const bOrientation = getMapOrientation(b);

  if (typeof aOrientation === 'number' && typeof bOrientation === 'number') {
    return angularDistanceDegrees(aOrientation, bOrientation) <= (
      sameCuratedSegment ? 65 : SIMILAR_BEACH_FRONT_MAX_DEGREES
    );
  }

  if (sameCuratedSegment) return true;

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
): ExposureLevel => {
  const sector = item.windSector ?? getWindSectorFromDegrees(windDirectionDeg);
  const canUseWindProfile = canUseMapWindProfile(item.windProfile, item.windProfileSource);
  // A curated suspectPin means "geometry from this pin is not trusted" (notch/
  // tombolo pins) — the map must not colour from it in ANY branch below; only
  // the authored profile speaks for these beaches.
  const geospatialExposure = sector && !item.windProfile?.suspectPin
    ? item.geospatialExposure?.sectors?.[sector]?.level
    : undefined;

  // Low confidence means the authored profile cannot create user-facing
  // protected/calm claims. It does not invalidate a direct geospatial protected
  // result from bay/headland geometry, which is what the map colour represents.
  // EXCEPT when the curated profile explicitly lists this sector as exposed:
  // explicit exposure claims are trusted at any confidence everywhere else in
  // the engine, and a wrong "protected" is the dangerous direction, so the map
  // must not contradict an explicit curated warning (e.g. the Milos-Kimolos
  // channel beaches, where straight-ray fetch cannot see wind funneling).
  // The same applies when the authored FACING says the live wind is onshore:
  // the engine's angular check calls that 'exposed' at any confidence (it
  // drives the card chip), so the map must not paint geometry-protected
  // against its own card.
  const authoredAngularExposed =
    typeof item.windProfile?.beachFacingDirection === 'number' &&
    Number.isFinite(item.windProfile.beachFacingDirection) &&
    typeof windDirectionDeg === 'number' &&
    Number.isFinite(windDirectionDeg) &&
    calculateWindExposure(item.windProfile.beachFacingDirection, windDirectionDeg).exposureLevel === 'exposed';
  if (
    geospatialExposure === 'protected' &&
    // Raw sector level is not enough to paint a pin green — the engine would score this
    // 'partial'. See isStableProtectedSector.
    isStableProtectedSector(item.geospatialExposure, sector) &&
    item.windProfile?.confidence === 'low' &&
    !authoredAngularExposed &&
    !(item.windProfile.knownWindSportSpot && (windBeaufort ?? 0) >= 4) &&
    !(sector && item.windProfile.exposedToWindDirections.includes(sector))
  ) {
    return 'protected';
  }

  // Curated authored profiles (incl. their known-wind-sport safety flag, handled
  // first inside exposureFromHighPriorityWindProfile) take priority over the raw
  // geometry, preserving the conservative shelter policy.
  const highPriorityProfileExposure = canUseWindProfile
    ? exposureFromHighPriorityWindProfile(item.windProfile, sector, windBeaufort ?? 0, windDirectionDeg)
    : undefined;
  if (highPriorityProfileExposure === 'protected' || highPriorityProfileExposure === 'exposed') {
    return highPriorityProfileExposure;
  }

  const fallbackProfileExposure = canUseWindProfile
    ? exposureFromWindProfile(item.windProfile, sector, windBeaufort ?? 0, windDirectionDeg)
    : undefined;

  // Authored profiles still protect clear wind-sport/open-exposure cases. For
  // low-confidence profiles, direct geospatial protected geometry has already
  // been allowed above; low confidence limits text claims, not map geometry.
  if (fallbackProfileExposure === 'protected' || fallbackProfileExposure === 'exposed') {
    if (
      fallbackProfileExposure === 'protected' &&
      item.windProfile?.confidence === 'low' &&
      geospatialExposure &&
      geospatialExposure !== 'protected'
    ) {
      return geospatialExposure;
    }

    if (
      item.windProfile?.confidence === 'low' &&
      geospatialExposure === 'exposed' &&
      fallbackProfileExposure !== 'exposed'
    ) {
      return 'exposed';
    }

    return fallbackProfileExposure;
  }

  const explicitOrientationExposure = exposureFromExplicitOrientation(item.orientation, windDirectionDeg);
  const legacyExposure = exposureFromLegacyProtectedFrom(item.beach.protectedFrom, windDirectionDeg);
  const directionalFallbackExposure = explicitOrientationExposure || legacyExposure;

  // Geometry signal: the regenerated geospatial profile now carries the improved
  // onshore/offshore-aware sector levels, so reading them here is enough.
  // DELIBERATE asymmetry vs scoring: the map follows a geometry-'exposed' sector at
  // ANY fetch, while the engine escalates authored-partial scoring only at >=8 km
  // high-confidence fetch (Solution B threshold, pinned in the suite). So for a
  // short-fetch open onshore sector the pin can read one band redder than the card —
  // the conservative direction, kept until a Solution-B-style false-positive pass
  // justifies lowering the scoring threshold.
  if (geospatialExposure === 'exposed') return geospatialExposure;
  // A geometry-'protected' sector only paints the pin protected when it passes the same strict
  // test the scoring engine applies; otherwise the pin says exactly what the card says.
  if (geospatialExposure === 'protected') {
    return isStableProtectedSector(item.geospatialExposure, sector)
      ? 'protected'
      : (fallbackProfileExposure || 'partial');
  }
  if (geospatialExposure === 'partial') return fallbackProfileExposure || 'partial';
  if (fallbackProfileExposure) return fallbackProfileExposure;
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

    const hasProtectedSegmentSupport = group.some(item => (
      levels.get(item.beach.id) === 'protected' &&
      hasStableGeospatialProtection(item, sector)
    ));
    const hasLockedNonProtectedLevel = group.some(item => (
      hasReliableExplicitMorphology(item, sector, beaufort) &&
      levels.get(item.beach.id) !== 'protected'
    ));

    const targetLevel = hasProtectedSegmentSupport && !hasLockedNonProtectedLevel
      ? 'protected'
      : uniqueLockedLevels.size === 1
      ? lockedLevels[0]
      : getMoreConservativeExposure(currentLevels);

    group.forEach(item => {
      if (uniqueLockedLevels.size > 1 && hasReliableExplicitMorphology(item, sector, beaufort)) return;
      if (
        targetLevel === 'protected' &&
        levels.get(item.beach.id) !== 'protected' &&
        (
          hasReliableExplicitMorphology(item, sector, beaufort) ||
          (
            !hasStableGeospatialProtection(item, sector) &&
            !hasCuratedSegmentProtectionSupport(item, group, sector)
          )
        )
      ) {
        return;
      }
      if (
        targetLevel !== 'protected' &&
        hasStableGeospatialProtection(item, sector)
      ) return;
      levels.set(item.beach.id, targetLevel);
    });
  });

  return levels;
};
