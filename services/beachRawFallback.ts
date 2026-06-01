import { Accessibility, Beach, BeachAccessType, BeachOrientation, BeachTerrainType, BeachType, Island, WaterDepth, WindDirection } from '../types';
import * as beachService from './beachService';
import type { RawBeach } from './beachService';
import { loadRawRegionBeaches } from './beachDataLoader';
import {
  CAFE_AMENITY_TERMS,
  RESTAURANT_AMENITY_TERMS,
  PARKING_AMENITY_TERMS,
  SNACK_CANTEEN_AMENITY_TERMS,
  SUNBED_AMENITY_TERMS,
  TAVERNA_AMENITY_TERMS,
  amenityTextIncludesAny,
  hasExplicitBeachBarAmenityInList,
} from '../utils/amenityMatching.js';

const metadataAccessToAccessibility = (type?: BeachAccessType): Accessibility => {
  switch (type) {
    case 'asphalt_road':
      return Accessibility.EASY;
    case 'unknown':
      return Accessibility.MODERATE;
    case 'passable_dirt_road':
    case 'hiking_path_easy':
      return Accessibility.MODERATE;
    case '4x4_only':
    case 'hiking_path_difficult':
      return Accessibility.DIFFICULT;
    case 'boat_only':
      return Accessibility.BOAT_ONLY;
    default:
      return Accessibility.EASY;
  }
};

const metadataTerrainToBeachType = (types?: BeachTerrainType[]): BeachType => {
  if (!types || types.length === 0) return 'sandy';
  const hasFineSand = types.includes('fine_sand');
  const hasCoarseSand = types.includes('coarse_sand');
  const hasPebbles = types.includes('pebbles');
  const hasStones = types.includes('large_stones');
  const hasRocks = types.includes('rocks');

  if (hasRocks && !hasFineSand && !hasCoarseSand && !hasPebbles) return 'rocky';
  if ((hasFineSand || hasCoarseSand) && (hasPebbles || hasStones || hasRocks)) return 'sandy-pebbles';
  if (hasPebbles || hasStones) return 'pebbles';
  return 'sandy';
};

const metadataTerrainToDepth = (types?: BeachTerrainType[]) => {
  if (!types || types.length === 0) return { deepWaters: false, shallowWaters: true, waterDepth: 'shallow' as const };
  if (types.includes('large_stones') || types.includes('rocks')) {
    return { deepWaters: true, shallowWaters: false, waterDepth: 'deep' as const };
  }
  if (types.includes('pebbles') && !types.includes('fine_sand')) {
    return { deepWaters: false, shallowWaters: false, waterDepth: 'medium' as const };
  }
  return { deepWaters: false, shallowWaters: true, waterDepth: 'shallow' as const };
};

const metadataWaterDepthToCharacteristics = (waterDepth?: WaterDepth) => {
  switch (waterDepth) {
    case 'deep':
      return { deepWaters: true, shallowWaters: false, waterDepth: 'deep' as const };
    case 'medium':
      return { deepWaters: false, shallowWaters: false, waterDepth: 'medium' as const };
    case 'shallow':
    default:
      return { deepWaters: false, shallowWaters: true, waterDepth: 'shallow' as const };
  }
};

const hardQuietAccessTypes = new Set<BeachAccessType>(['4x4_only', 'difficult_dirt_road', 'hiking_path_difficult', 'boat_only']);

const terrainSupportsSnorkeling = (types?: BeachTerrainType[]) =>
  (types || []).some(type => type === 'rocks' || type === 'large_stones');

const inferQuietFromMetadata = ({
  metadata,
  accessType,
  hasBar,
  organized,
  hasSunbeds,
  hasTaverna,
  hasRestaurant,
}: {
  metadata: NonNullable<Beach['metadata']>;
  accessType: BeachAccessType;
  hasBar: boolean;
  organized: boolean;
  hasSunbeds: boolean;
  hasTaverna: boolean;
  hasRestaurant: boolean;
}) => {
  const amenities = metadata.amenities || [];
  const hasCafe = amenityTextIncludesAny(amenities, CAFE_AMENITY_TERMS);
  const hasSnackOrCanteen = amenityTextIncludesAny(amenities, SNACK_CANTEEN_AMENITY_TERMS);
  const hasVisitorServices = hasBar || organized || hasSunbeds || hasTaverna || hasRestaurant || hasCafe || hasSnackOrCanteen;

  if (hasVisitorServices) return false;
  return amenities.length === 0 || hardQuietAccessTypes.has(accessType);
};

const isWindDirection = (value: unknown): value is WindDirection => {
  return Object.values(WindDirection).includes(value as WindDirection);
};

const getVerifiedOrientation = (metadata: Beach['metadata']): BeachOrientation | undefined => {
  const orientation = metadata?.orientation;
  if (!orientation) return undefined;

  const protectedFrom = (orientation.protectedFrom || []).filter(isWindDirection);
  const faces = (orientation.faces || []).filter(isWindDirection);
  const degrees = typeof orientation.degrees === 'number' && Number.isFinite(orientation.degrees)
    ? orientation.degrees
    : null;

  if (degrees === null && protectedFrom.length === 0 && faces.length === 0) {
    return undefined;
  }

  return {
    degrees,
    faces,
    protectedFrom,
    confidence: orientation.confidence || metadata?.confidence || 'medium',
    notes: orientation.notes,
  };
};

const buildIslandsFromRawBeaches = (rawBeaches: RawBeach[]): Island[] => {
  const islandsMap: Record<string, Island> = {};

  rawBeaches.forEach((rb) => {
    const areaName = rb.prefecture || rb.region || 'Unknown';
    const regionName = rb.region || 'Unknown';
    const islandId = beachService.getBeachRegionId(regionName, areaName, rb.id);

    if (!islandsMap[islandId]) {
      const trans = beachService.getRegionTranslation(areaName);
      islandsMap[islandId] = {
        id: islandId,
        name: {
          en: trans.en,
          gr: trans.gr,
          fr: trans.en,
          de: trans.en,
          it: trans.en,
        },
        group: beachService.mapRegionToGroup(rb.region, areaName),
        coordinates: { lat: rb.lat, lon: rb.lon },
        beaches: [],
      };
    }

    const centerLat = islandsMap[islandId].coordinates.lat;
    const centerLon = islandsMap[islandId].coordinates.lon;
    const verifiedOrientation = getVerifiedOrientation(rb.metadata);
    const autoProtection = beachService.getAutoProt(rb.lat, rb.lon, centerLat, centerLon);
    const protection = verifiedOrientation?.protectedFrom.length
      ? verifiedOrientation.protectedFrom
      : autoProtection;

    // Fallback only: keep deterministic values stable if app-ready data is unavailable.
    const isDeepWater = beachService.getDeterministicValue(rb.id, 'depth') > 0.5;
    const greekName = beachService.getGreekDisplayBeachName(rb.name);
    const metadata = rb.metadata;
    const access = metadata ? metadataAccessToAccessibility(metadata.access.type) : beachService.determineAccessibility(rb.name, rb.name);
    const narrative = beachService.getBeachNarrative(rb.name, areaName);

    const hasBar = metadata
      ? hasExplicitBeachBarAmenityInList(metadata.amenities)
      : /beach\s*bar|beachbar|beach club|bar|resort/i.test(rb.name);
    const organized = metadata ? metadata.organized : hasBar || beachService.getDeterministicValue(rb.id, 'organized') > 0.6;
    const hasShade = metadata ? metadata.shade : beachService.getDeterministicValue(rb.id, 'shade') > 0.5;
    const hasTaverna = metadata ? amenityTextIncludesAny(metadata.amenities, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS]) : beachService.getDeterministicValue(rb.id, 'taverna') > 0.5;
    const hasParking = metadata ? amenityTextIncludesAny(metadata.amenities, PARKING_AMENITY_TERMS) : beachService.getDeterministicValue(rb.id, 'parking') > 0.4;
    const hasSunbeds = metadata ? metadata.organized && amenityTextIncludesAny(metadata.amenities, SUNBED_AMENITY_TERMS) : organized || beachService.getDeterministicValue(rb.id, 'sunbeds') > 0.5;
    const hasRestaurant = metadata ? hasTaverna || amenityTextIncludesAny(metadata.amenities, RESTAURANT_AMENITY_TERMS) : hasTaverna || beachService.getDeterministicValue(rb.id, 'restaurant') > 0.7;
    const quiet = metadata
      ? inferQuietFromMetadata({ metadata, accessType: metadata.access.type, hasBar, organized, hasSunbeds, hasTaverna, hasRestaurant })
      : !hasBar && beachService.getDeterministicValue(rb.id, 'quiet') > 0.6;

    const typeVal = beachService.getDeterministicValue(rb.id, 'type');
    const beachType: BeachType = metadata ? metadataTerrainToBeachType(metadata.terrain.types) : (typeVal > 0.85 ? 'rocky' : (typeVal > 0.65 ? 'pebbles' : (typeVal > 0.45 ? 'sandy-pebbles' : 'sandy')));
    const depth = metadata?.waterDepth?.type
      ? metadataWaterDepthToCharacteristics(metadata.waterDepth.type)
      : metadata ? metadataTerrainToDepth(metadata.terrain.types) : {
        deepWaters: isDeepWater,
        shallowWaters: !isDeepWater,
        waterDepth: isDeepWater ? 'deep' as const : (beachService.getDeterministicValue(rb.id, 'depth2') > 0.5 ? 'medium' as const : 'shallow' as const),
      };

    const beach: Beach = {
      id: rb.id,
      rating: 4.0 + (beachService.getDeterministicValue(rb.id, 'rating') * 1.0),
      name: { en: beachService.toGreeklish(rb.name), gr: greekName, fr: rb.name, de: rb.name, it: rb.name },
      description: narrative.description,
      detailedDescription: narrative.detailedDescription,
      accessNotes: narrative.accessNotes,
      protectedFrom: protection,
      orientation: verifiedOrientation,
      accessibility: access,
      amenities: {
        organized,
        naturalShade: hasShade,
        taverna: hasTaverna,
        beachBar: hasBar,
        sunbeds: hasSunbeds,
        restaurant: hasRestaurant,
        parking: hasParking,
      },
      beachType,
      characteristics: { deepWaters: depth.deepWaters, shallowWaters: depth.shallowWaters },
      waterDepth: depth.waterDepth,
      activities: {
        snorkeling: metadata ? terrainSupportsSnorkeling(metadata.terrain.types) : beachService.getDeterministicValue(rb.id, 'snorkeling') > 0.4,
        surfing: beachService.getDeterministicValue(rb.id, 'surfing') > 0.8,
      },
      environment: {
        quiet,
        remote: access === Accessibility.DIFFICULT || access === Accessibility.BOAT_ONLY,
        familyFriendly: depth.shallowWaters && organized && !hardQuietAccessTypes.has(metadata?.access?.type),
      },
      popularityScore: Math.floor(beachService.getDeterministicValue(rb.id, 'pop') * 100),
      coordinates: { lat: rb.lat, lon: rb.lon },
      metadata,
    };

    islandsMap[islandId].beaches.push(beach);
  });

  Object.values(islandsMap).forEach(island => {
    if (island.beaches.length > 0) {
      island.coordinates.lat = island.beaches.reduce((acc, b) => acc + b.coordinates.lat, 0) / island.beaches.length;
      island.coordinates.lon = island.beaches.reduce((acc, b) => acc + b.coordinates.lon, 0) / island.beaches.length;
    }
  });

  return Object.values(islandsMap);
};

export const loadRegionFromRawFallback = async (regionId: string): Promise<Island> => {
  const rawBeaches = await loadRawRegionBeaches(regionId);
  const loadedIsland = buildIslandsFromRawBeaches(rawBeaches).find(island => island.id === regionId);

  if (!loadedIsland) {
    throw new Error(`No beach data found for region ${regionId}`);
  }

  return loadedIsland;
};
