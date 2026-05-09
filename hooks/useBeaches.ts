import { useState, useEffect, useMemo } from 'react';
import { Island, Beach, FilterKey, SortOption, WindDirection, LanguageCode, WeatherData, DailyForecast, UserPreferences, Accessibility, BeachType, BeachAccessType, BeachTerrainType, WaterDepth } from '../types';
import { loadBeaches, getRegionTranslation, mapRegionToGroup, getAutoProt, getDeterministicValue, transliterateToGreek, determineAccessibility, getBeachNarrative, toGreeklish } from '../services/beachService';
import { filterBeaches, sortBeaches, calculateBeachScore } from '../services/recommendationService';

const metadataAccessToAccessibility = (type?: BeachAccessType): Accessibility => {
  switch (type) {
    case 'asphalt_road':
      return Accessibility.EASY;
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
    return { deepWaters: true, shallowWaters: false, waterDepth: 'medium' as const };
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

const amenityTextIncludes = (amenities: string[] | undefined, needles: string[]) => {
  const text = (amenities || []).join(' ').toLowerCase();
  return needles.some(needle => text.includes(needle));
};

export const useBeaches = (language: LanguageCode) => {
  const [staticIslands, setStaticIslands] = useState<Island[]>([]);
  const [customIslands, setCustomIslands] = useState<Island[]>(() => {
    const saved = localStorage.getItem('customIslands');
    try {
        return saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error("Failed to parse customIslands", e);
        return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allIslands = useMemo(() => {
    const customIds = new Set(customIslands.map(i => i.id));
    const merged = [...customIslands, ...staticIslands.filter(i => !customIds.has(i.id))];
    return merged;
  }, [customIslands, staticIslands]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const rawBeaches = await loadBeaches();
        
        if (!rawBeaches || rawBeaches.length === 0) {
            console.warn("No beaches loaded from greek_beaches.json.");
            setLoading(false);
            setError("No beach data found. Please ensure /greek_beaches.json exists.");
            return;
        }

        const islandsMap: Record<string, Island> = {};
        
        rawBeaches.forEach((rb) => {
            const areaName = rb.prefecture || rb.region || "Unknown";
            const regionName = rb.region || "Unknown";
            const islandIdBase = `${regionName}-${areaName}`;
            const islandId = islandIdBase.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `unknown-${rb.id}`;
            
            if (!islandsMap[islandId]) {
                const trans = getRegionTranslation(areaName);
                islandsMap[islandId] = {
                    id: islandId,
                    name: { 
                        en: trans.en, 
                        gr: trans.gr, 
                        fr: trans.en, 
                        de: trans.en, 
                        it: trans.en 
                    },
                    group: mapRegionToGroup(rb.region, areaName),
                    coordinates: { lat: rb.lat, lon: rb.lon },
                    beaches: []
                };
            }
            
            const centerLat = islandsMap[islandId].coordinates.lat;
            const centerLon = islandsMap[islandId].coordinates.lon;
            const protection = getAutoProt(rb.lat, rb.lon, centerLat, centerLon);

            // Deterministic characteristics for consistency across users
            const isDeepWater = getDeterministicValue(rb.id, 'depth') > 0.5;
            
            // Auto-transliterate beach names for Greek language support
            const greekName = transliterateToGreek(rb.name);
            
            // Prefer researched metadata from greek_beaches.json when present.
            const metadata = rb.metadata;
            const access = metadata ? metadataAccessToAccessibility(metadata.access.type) : determineAccessibility(rb.name, rb.name);
            const narrative = getBeachNarrative(rb.name, areaName);
            
            // Smarter amenities inference based on name
            const hasBar = metadata
              ? amenityTextIncludes(metadata.amenities, ['beach bar', 'bar', 'καφέ', 'καντίνα'])
              : rb.name.toLowerCase().includes('bar') || rb.name.toLowerCase().includes('club') || rb.name.toLowerCase().includes('resort');
            const organized = metadata ? metadata.organized : hasBar || getDeterministicValue(rb.id, 'organized') > 0.6;
            const hasShade = metadata ? metadata.shade : getDeterministicValue(rb.id, 'shade') > 0.5;
            const hasTaverna = metadata ? amenityTextIncludes(metadata.amenities, ['ταβέρνα', 'ταβέρνες', 'εστιατόριο', 'restaurant']) : hasBar || getDeterministicValue(rb.id, 'taverna') > 0.5;
            const hasParking = metadata ? amenityTextIncludes(metadata.amenities, ['parking', 'στάθμευση', 'χώρος στάθμευσης', 'παρκ']) : getDeterministicValue(rb.id, 'parking') > 0.4;
            const hasSunbeds = metadata ? metadata.organized && amenityTextIncludes(metadata.amenities, ['ξαπλώστρες', 'ομπρέλες', 'sunbeds']) : organized || getDeterministicValue(rb.id, 'sunbeds') > 0.5;
            const hasRestaurant = metadata ? hasTaverna || amenityTextIncludes(metadata.amenities, ['εστιατόριο', 'restaurant']) : hasTaverna || getDeterministicValue(rb.id, 'restaurant') > 0.7;

            const typeVal = getDeterministicValue(rb.id, 'type');
            const beachType: BeachType = metadata ? metadataTerrainToBeachType(metadata.terrain.types) : (typeVal > 0.85 ? 'rocky' : (typeVal > 0.65 ? 'pebbles' : (typeVal > 0.45 ? 'sandy-pebbles' : 'sandy')));
            const depth = metadata?.waterDepth?.type
              ? metadataWaterDepthToCharacteristics(metadata.waterDepth.type)
              : metadata ? metadataTerrainToDepth(metadata.terrain.types) : {
              deepWaters: isDeepWater,
              shallowWaters: !isDeepWater,
              waterDepth: isDeepWater ? 'deep' as const : (getDeterministicValue(rb.id, 'depth2') > 0.5 ? 'medium' as const : 'shallow' as const)
            };

            const beach: Beach = {
                id: rb.id,
                rating: 4.0 + (getDeterministicValue(rb.id, 'rating') * 1.0), // Rating between 4.0 and 5.0
                name: { en: toGreeklish(rb.name), gr: greekName, fr: rb.name, de: rb.name, it: rb.name },
                description: narrative.description,
                detailedDescription: narrative.detailedDescription,
                accessNotes: narrative.accessNotes,
                protectedFrom: protection,
                accessibility: access,
                amenities: { 
                  organized: organized, 
                  naturalShade: hasShade, 
                  taverna: hasTaverna,
                  beachBar: hasBar,
                  sunbeds: hasSunbeds,
                  restaurant: hasRestaurant,
                  parking: hasParking
                },
                beachType: beachType,
                characteristics: { deepWaters: depth.deepWaters, shallowWaters: depth.shallowWaters },
                waterDepth: depth.waterDepth,
                activities: {
                  snorkeling: metadata ? metadata.terrain.types.some(type => type === 'rocks' || type === 'pebbles' || type === 'large_stones') : getDeterministicValue(rb.id, 'snorkeling') > 0.4,
                  surfing: getDeterministicValue(rb.id, 'surfing') > 0.8,
                },
                environment: {
                  quiet: getDeterministicValue(rb.id, 'quiet') > 0.6,
                  remote: access === Accessibility.DIFFICULT || access === Accessibility.BOAT_ONLY,
                  familyFriendly: depth.shallowWaters && organized,
                },
                popularityScore: Math.floor(getDeterministicValue(rb.id, 'pop') * 100),
                coordinates: { lat: rb.lat, lon: rb.lon },
                metadata
            };
            
            islandsMap[islandId].beaches.push(beach);
        });

        Object.values(islandsMap).forEach(island => {
            if (island.beaches.length > 0) {
                island.coordinates.lat = island.beaches.reduce((acc, b) => acc + b.coordinates.lat, 0) / island.beaches.length;
                island.coordinates.lon = island.beaches.reduce((acc, b) => acc + b.coordinates.lon, 0) / island.beaches.length;
            }
        });

        const loadedIslands = Object.values(islandsMap);
        setStaticIslands(loadedIslands);
        setLoading(false);
      } catch (err) {
        console.error("Failed to load beach data", err);
        setLoading(false);
        setError("Failed to load application data.");
      }
    };
    loadData();
  }, []);

  const getFilteredBeaches = (
    beaches: Beach[],
    filters: FilterKey[],
    searchQuery: string,
    sortBy: SortOption,
    windDirection: WindDirection,
    weather?: WeatherData | DailyForecast,
    userLocation?: { lat: number; lon: number },
    preferences?: UserPreferences
  ) => {
    const beachesWithCrowd = weather ? beaches.map(beach => {
      const { crowdLevel, crowdScore } = calculateBeachScore(beach, weather, userLocation, preferences);
      return { ...beach, crowdLevel, crowdScore };
    }) : beaches;

    const filtered = filterBeaches(beachesWithCrowd, filters, searchQuery, language);
    return sortBeaches(filtered, sortBy, windDirection);
  };

  return {
    allIslands,
    loading,
    error,
    getFilteredBeaches
  };
};
