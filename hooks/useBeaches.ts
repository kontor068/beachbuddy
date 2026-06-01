import { useState, useEffect, useMemo, useCallback } from 'react';
import { Island, Beach, FilterKey, SortOption, WindDirection, LanguageCode, WeatherData, DailyForecast, UserPreferences } from '../types';
import { filterBeaches, sortBeaches, calculateBeachScore } from '../services/recommendationService';
import { getBeaufortLevel } from '../utils/weatherUtils';
import { calculateWindExposure } from '../utils/windExposure';
import {
  buildIslandShellFromIndexEntry,
  getPreferredInitialRegionId,
  loadAppReadyRegion,
  loadBeachRegionIndex,
} from '../services/beachDataLoader';
import type { BeachRegionIndexEntry } from '../services/beachDataLoader';

const windSectorToDirection: Record<string, WindDirection> = {
  N: WindDirection.N,
  NE: WindDirection.NE,
  E: WindDirection.E,
  SE: WindDirection.SE,
  S: WindDirection.S,
  SW: WindDirection.SW,
  W: WindDirection.W,
  NW: WindDirection.NW,
};

const loadRegionIsland = async (
  regionId: string,
  paths?: Pick<BeachRegionIndexEntry, 'summaryDataPath' | 'appDataPath'>
): Promise<Island> => {
  try {
    return await loadAppReadyRegion(regionId, paths);
  } catch (appDataError) {
    console.warn('App-ready beach region unavailable; falling back to raw regional data.', {
      regionId,
      appDataError,
    });

    const { loadRegionFromRawFallback } = await import('../services/beachRawFallback');
    return loadRegionFromRawFallback(regionId);
  }
};

type BeachDataErrorKey = 'region' | 'empty' | 'app';

const beachDataErrorMessages: Record<'en' | 'gr', Record<BeachDataErrorKey, string>> = {
  en: {
    region: 'Beach data for this region could not be loaded. Please try again.',
    empty: 'No beach data was found. Please try again in a moment.',
    app: 'Application beach data could not be loaded. Please try again.',
  },
  gr: {
    region: 'Δεν φορτώθηκαν τα δεδομένα παραλιών για αυτή την περιοχή. Δοκίμασε ξανά.',
    empty: 'Δεν βρέθηκαν δεδομένα παραλιών. Δοκίμασε ξανά σε λίγο.',
    app: 'Δεν φορτώθηκαν τα δεδομένα της εφαρμογής. Δοκίμασε ξανά.',
  },
};

const getBeachDataErrorMessage = (language: LanguageCode, key: BeachDataErrorKey) => (
  beachDataErrorMessages[language === 'gr' ? 'gr' : 'en'][key]
);

export const useBeaches = (language: LanguageCode) => {
  const [staticIslands, setStaticIslands] = useState<Island[]>([]);
  const [customIslands] = useState<Island[]>(() => {
    const saved = localStorage.getItem('customIslands');
    try {
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error('Failed to parse customIslands', e);
      return [];
    }
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const allIslands = useMemo(() => {
    const customIds = new Set(customIslands.map(i => i.id));
    return [...customIslands, ...staticIslands.filter(i => !customIds.has(i.id))];
  }, [customIslands, staticIslands]);

  const ensureIslandBeachesLoaded = useCallback(async (regionId: string) => {
    const existingIsland = staticIslands.find(island => island.id === regionId);
    if (!existingIsland || existingIsland.beaches.length > 0) return;

    try {
      const loadedIsland = await loadRegionIsland(regionId);
      setStaticIslands(prev => prev.map(island => island.id === regionId ? loadedIsland : island));
    } catch (err) {
      console.error('Failed to load region beach data', { regionId, err });
      setError(getBeachDataErrorMessage(language, 'region'));
    }
  }, [staticIslands, language]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const regionIndex = await loadBeachRegionIndex();
        const shellIslands = regionIndex.map(buildIslandShellFromIndexEntry);
        const initialRegionId = getPreferredInitialRegionId(shellIslands);

        if (!initialRegionId) {
          throw new Error('No beach regions found in split beach data index.');
        }

        const initialEntry = regionIndex.find(entry => entry.id === initialRegionId);
        const initialIsland = await loadRegionIsland(initialRegionId, {
          summaryDataPath: initialEntry?.summaryDataPath,
          appDataPath: initialEntry?.appDataPath,
        });
        const loadedIslands = shellIslands.map(island => island.id === initialRegionId ? initialIsland : island);

        if (cancelled) return;

        if (loadedIslands.length === 0) {
          console.warn('No beaches loaded from beach dataset.');
          setError(getBeachDataErrorMessage(language, 'empty'));
        } else {
          setStaticIslands(loadedIslands);
          setError(null);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Failed to load beach data', err);
        setError(getBeachDataErrorMessage(language, 'app'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const getFilteredBeaches = useCallback((
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
      const scoreResult = calculateBeachScore(beach, weather, userLocation, preferences);
      return {
        ...beach,
        crowdLevel: scoreResult.crowdLevel,
        crowdScore: scoreResult.crowdScore,
        exposureLevel: scoreResult.exposureLevel,
        waveHeightM: scoreResult.waveHeightM,
        warnings: scoreResult.warnings,
        confidence: scoreResult.confidence,
        todayScore: scoreResult.score,
        windOrientationDeg: scoreResult.orientation,
        windProfile: scoreResult.windProfile,
        windSector: scoreResult.windSector,
        canClaimWindProtection: scoreResult.canClaimWindProtection,
        seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed,
      };
    }) : beaches;

    const filtered = filterBeaches(beachesWithCrowd, filters, searchQuery, language) as Array<Beach & {
      exposureLevel?: string;
      canClaimWindProtection?: boolean;
      todayScore?: number;
      windOrientationDeg?: number;
      warnings?: Array<{ type?: string }>;
      windProfile?: {
        protectedFromWindDirections?: string[];
        exposedToWindDirections?: string[];
        shelterLevel?: string;
        fetchExposure?: string;
        beachFacingDirection?: number;
        confidence?: string;
      };
      windSector?: string;
      protectedFrom?: WindDirection[];
    }>;
    const weatherBeaufort = weather ? getBeaufortLevel(weather.wind.speed * 3.6) : 0;
    const windMattersForProtection = weatherBeaufort >= 4;
    const isLessExposed = (beach: {
      exposureLevel?: string;
      canClaimWindProtection?: boolean;
      windOrientationDeg?: number;
      warnings?: Array<{ type?: string }>;
      windProfile?: {
        protectedFromWindDirections?: string[];
        exposedToWindDirections?: string[];
        shelterLevel?: string;
        fetchExposure?: string;
        beachFacingDirection?: number;
        confidence?: string;
      };
      windSector?: string;
      protectedFrom?: WindDirection[];
    }) => {
      const hasCurrentWindExposureWarning = beach.warnings?.some(warning => (
        warning.type === 'exposed_to_wind' ||
        warning.type === 'onshore_chop' ||
        warning.type === 'wind_sport_spot'
      ));
      if (hasCurrentWindExposureWarning) return false;

      const angularExposure = (
        typeof beach.windOrientationDeg === 'number' &&
        Number.isFinite(beach.windOrientationDeg) &&
        weather
      )
        ? calculateWindExposure(beach.windOrientationDeg, weather.wind.deg).exposureLevel
        : undefined;
      const hasReliableExposureProfile = Boolean(
        beach.windProfile &&
        beach.windProfile.confidence !== 'low' &&
        (
          (beach.windProfile.exposedToWindDirections?.length ?? 0) > 0 ||
          (beach.windProfile.protectedFromWindDirections?.length ?? 0) > 0 ||
          beach.windProfile.shelterLevel === 'sheltered' ||
          beach.windProfile.shelterLevel === 'very_sheltered'
        )
      );
      const canUseMildWindGeometryFallback = weatherBeaufort <= 3 && angularExposure === 'protected';
      const mildWindLegacyProtectionFallback = Boolean(
        weatherBeaufort <= 3 &&
        !hasReliableExposureProfile &&
        beach.windSector &&
        beach.protectedFrom?.includes(windSectorToDirection[beach.windSector])
      );

      if (
        beach.windSector &&
        beach.windProfile?.exposedToWindDirections?.includes(beach.windSector) &&
        hasReliableExposureProfile
      ) return false;
      if (beach.exposureLevel === 'exposed' && !(canUseMildWindGeometryFallback && !hasReliableExposureProfile)) return false;
      if (beach.windSector && beach.windProfile?.protectedFromWindDirections?.includes(beach.windSector)) return true;
      if (mildWindLegacyProtectionFallback) return true;

      if (beach.exposureLevel === 'protected' && beach.canClaimWindProtection === true) return true;

      if (angularExposure) return angularExposure === 'protected';

      return false;
    };
    const exposureSortRank = (beach: { exposureLevel?: string; canClaimWindProtection?: boolean }) => {
      if (beach.exposureLevel === 'protected' && beach.canClaimWindProtection === true) return 0;
      if (beach.exposureLevel === 'partial') return 1;
      return 2;
    };
    const lessExposedBeaches = sortBy === 'protected' && weather
      ? filtered.filter(isLessExposed)
      : [];
    const visibleBeaches = sortBy === 'protected' && weather
      ? lessExposedBeaches
      : filtered;

    if ((sortBy === 'recommended' || sortBy === 'protected') && weather) {
      return [...visibleBeaches].sort((a, b) => {
        const aProtected = a.exposureLevel === 'protected' && a.canClaimWindProtection === true;
        const bProtected = b.exposureLevel === 'protected' && b.canClaimWindProtection === true;
        if (windMattersForProtection && aProtected !== bProtected) return aProtected ? -1 : 1;

        const exposureRank = (level?: string) => level === 'protected' ? 2 : level === 'partial' ? 1 : 0;
        const exposureDiff = exposureRank(b.exposureLevel) - exposureRank(a.exposureLevel);
        if (windMattersForProtection && exposureDiff !== 0) return exposureDiff;

        return (b.todayScore ?? b.rating) - (a.todayScore ?? a.rating);
      });
    }

    if (sortBy === 'all' && weather && windMattersForProtection) {
      return [...visibleBeaches].sort((a, b) => {
        const exposureDiff = exposureSortRank(a) - exposureSortRank(b);
        if (exposureDiff !== 0) return exposureDiff;
        return (b.todayScore ?? b.rating) - (a.todayScore ?? a.rating);
      });
    }

    return sortBeaches(visibleBeaches, sortBy, windDirection);
  }, [language]);

  return {
    allIslands,
    loading,
    error,
    getFilteredBeaches,
    ensureIslandBeachesLoaded,
  };
};
