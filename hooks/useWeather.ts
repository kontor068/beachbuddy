import { useState, useCallback, useEffect, useRef } from 'react';
import { WeatherData, DailyForecast, Island, LanguageCode, Beach, BeachForecastContext } from '../types';
import {
  fetchWeatherData,
  fetchForecastData,
  fetchMarineForecastData,
  mergeMarineForecastData,
} from '../services/weatherService';
import { processForecastData } from '../utils/weatherUtils'; // Assuming I move this helper or recreate it
import { getLocalWeatherFixture } from '../utils/weatherFixtures';

const BEACH_FORECAST_CLUSTER_STEPS = [0.05, 0.08, 0.12];
const MAX_BEACH_FORECAST_CLUSTERS = 6;
const BEACH_FORECAST_BACKGROUND_DELAY_MS = 6000;
const EVENING_TODAY_CUTOFF_HOUR = 21;

interface BeachForecastCluster {
  key: string;
  lat: number;
  lon: number;
  beachIds: number[];
}

const roundToCluster = (value: number, step: number): number => Math.round(value / step) * step;

const shouldSkipTodayAfterEvening = (now: Date = new Date()): boolean =>
  now.getHours() >= EVENING_TODAY_CUTOFF_HOUR;

const getDefaultDayIndex = (forecastLength?: number, now: Date = new Date()): number => {
  if (shouldSkipTodayAfterEvening(now) && (forecastLength || 0) > 1) return 1;
  return 0;
};

const clampSelectedDayIndex = (index: number, forecastLength?: number, now: Date = new Date()): number => {
  const maxIndex = Math.max(0, (forecastLength || 1) - 1);
  const minIndex = getDefaultDayIndex(forecastLength, now);
  return Math.min(maxIndex, Math.max(minIndex, index));
};

const getNextDaySelectionBoundaryDelay = (now: Date = new Date()): number => {
  const nextBoundary = new Date(now);

  if (now.getHours() < EVENING_TODAY_CUTOFF_HOUR) {
    nextBoundary.setHours(EVENING_TODAY_CUTOFF_HOUR, 0, 0, 0);
  } else {
    nextBoundary.setDate(nextBoundary.getDate() + 1);
    nextBoundary.setHours(0, 0, 0, 0);
  }

  return Math.max(1000, nextBoundary.getTime() - now.getTime() + 1000);
};

const buildBeachForecastClusters = (beaches: Beach[]): BeachForecastCluster[] => {
  for (const step of BEACH_FORECAST_CLUSTER_STEPS) {
    const grouped = new Map<string, Beach[]>();

    beaches.forEach(beach => {
      const lat = roundToCluster(beach.coordinates.lat, step);
      const lon = roundToCluster(beach.coordinates.lon, step);
      const key = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
      grouped.set(key, [...(grouped.get(key) || []), beach]);
    });

    if (grouped.size <= MAX_BEACH_FORECAST_CLUSTERS || step === BEACH_FORECAST_CLUSTER_STEPS[BEACH_FORECAST_CLUSTER_STEPS.length - 1]) {
      return Array.from(grouped.entries()).map(([key, clusterBeaches]) => {
        const lat = clusterBeaches.reduce((sum, beach) => sum + beach.coordinates.lat, 0) / clusterBeaches.length;
        const lon = clusterBeaches.reduce((sum, beach) => sum + beach.coordinates.lon, 0) / clusterBeaches.length;
        return {
          key,
          lat,
          lon,
          beachIds: clusterBeaches.map(beach => beach.id),
        };
      });
    }
  }

  return [];
};

const scheduleBackgroundTask = (task: () => void) => {
  if (typeof window === 'undefined') {
    task();
    return;
  }

  window.setTimeout(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };

    if (idleWindow.requestIdleCallback) {
      idleWindow.requestIdleCallback(task, { timeout: 2500 });
      return;
    }

    task();
  }, BEACH_FORECAST_BACKGROUND_DELAY_MS);
};

const weatherFallbackMessage: Record<LanguageCode, string> = {
  gr: 'Δεν ήταν δυνατή η ανανέωση των δεδομένων καιρού. Δείχνουμε προσωρινή εκτίμηση.',
  en: 'We could not refresh the weather data. Showing a temporary estimate.',
  fr: 'Impossible d actualiser la météo. Affichage d une estimation temporaire.',
  de: 'Die Wetterdaten konnten nicht aktualisiert werden. Wir zeigen vorübergehend eine Schätzung.',
  it: 'Non è stato possibile aggiornare il meteo. Mostriamo una stima temporanea.',
};

const fetchBeachForecastContexts = async (island: Island): Promise<Record<number, BeachForecastContext>> => {
  const clusters = buildBeachForecastClusters(island.beaches);
  if (clusters.length === 0) return {};

  const entries = await Promise.all(clusters.map(async cluster => {
    const [forecastItems, marineItems] = await Promise.all([
      fetchForecastData(cluster.lat, cluster.lon),
      fetchMarineForecastData(cluster.lat, cluster.lon).catch(error => {
        console.warn('Cluster marine forecast unavailable; using wind-based sea estimates.', error);
        return [];
      }),
    ]);
    const forecast = processForecastData(mergeMarineForecastData(forecastItems, marineItems));
    return cluster.beachIds.map(beachId => [
      beachId,
      {
        forecast,
        source: 'beach-cluster' as const,
        clusterKey: cluster.key,
      },
    ] as const);
  }));

  return Object.fromEntries(entries.flat());
};

export const useWeather = (selectedIsland: Island | undefined, language: LanguageCode) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  const [beachForecasts, setBeachForecasts] = useState<Record<number, BeachForecastContext>>({});
  const [beachForecastsLoading, setBeachForecastsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const requestIdRef = useRef(0);
  const activeIslandIdRef = useRef<string | null>(null);

  const loadWeatherData = useCallback(async () => {
    if (!selectedIsland) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const isSameIsland = activeIslandIdRef.current === selectedIsland.id;

    if (!isSameIsland) {
      setWeather(null);
      setForecast(null);
      setSelectedDayIndex(getDefaultDayIndex());
    }

    setLoading(true);
    setError(null);
    setBeachForecasts({});
    setBeachForecastsLoading(false);

    const fixture = getLocalWeatherFixture(selectedIsland);
    if (fixture) {
      setWeather(fixture.weather);
      setForecast(fixture.forecast);
      setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, fixture.forecast.length));
      setLastUpdated(new Date());
      activeIslandIdRef.current = selectedIsland.id;
      setLoading(false);
      setBeachForecastsLoading(false);
      console.info('[weather] Local fixture active', {
        islandId: selectedIsland.id,
        scenarioId: fixture.scenario.id,
        scenarioLabel: fixture.scenario.label,
        windSpeedKmh: fixture.weather.wind.speed * 3.6,
      });
      return;
    }

    const lat = selectedIsland.coordinates.lat;
    const lon = selectedIsland.coordinates.lon;

    const [weatherResult, forecastResult, marineResult] = await Promise.allSettled([
      fetchWeatherData(lat, lon),
      fetchForecastData(lat, lon),
      fetchMarineForecastData(lat, lon).catch(error => {
        console.warn('Marine forecast unavailable; using wind-based sea estimates.', error);
        return [];
      }),
    ]);

    if (requestIdRef.current !== requestId) return;

    const failures: string[] = [];

    if (weatherResult.status === 'fulfilled') {
      setWeather(weatherResult.value);
    } else {
      failures.push('current-weather');
      if (!isSameIsland) setWeather(null);
    }

    if (forecastResult.status === 'fulfilled') {
      const marine = marineResult.status === 'fulfilled' ? marineResult.value : [];
      if (marineResult.status === 'rejected') failures.push('marine-forecast');
      const nextForecast = processForecastData(mergeMarineForecastData(forecastResult.value, marine));
      setForecast(nextForecast);
      setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, nextForecast.length));
    } else {
      failures.push('hourly-forecast');
      if (!isSameIsland) setForecast(null);
    }

    setLastUpdated(new Date());
    activeIslandIdRef.current = selectedIsland.id;
    setLoading(false);

    if (failures.length > 0) {
      setBeachForecastsLoading(false);
      console.warn('[weather] Selected area weather loaded with fallback UI', {
        islandId: selectedIsland.id,
        islandName: selectedIsland.name.en,
        failures,
        hasCurrentWeather: weatherResult.status === 'fulfilled',
        hasForecast: forecastResult.status === 'fulfilled',
      });
      setError(weatherFallbackMessage[language]);
      return;
    }

    setError(null);

    const islandForBackgroundForecasts = selectedIsland;
    setBeachForecastsLoading(true);
    scheduleBackgroundTask(() => {
      fetchBeachForecastContexts(islandForBackgroundForecasts)
        .then(localBeachForecasts => {
          if (requestIdRef.current !== requestId) return;
          setBeachForecasts(localBeachForecasts);
          setBeachForecastsLoading(false);
        })
        .catch(error => {
          if (requestIdRef.current !== requestId) return;
          console.warn('Beach-area forecasts unavailable; falling back to island forecast.', error);
          setBeachForecastsLoading(false);
        });
    });
  }, [selectedIsland, language]);

  useEffect(() => {
    if (selectedIsland) {
      loadWeatherData();
    } else {
      requestIdRef.current += 1;
      activeIslandIdRef.current = null;
      setWeather(null);
      setForecast(null);
      setBeachForecasts({});
      setBeachForecastsLoading(false);
      setLoading(false);
    }
  }, [selectedIsland, loadWeatherData]);

  useEffect(() => {
    setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, forecast?.length));
  }, [forecast?.length]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, forecast?.length));
    }, getNextDaySelectionBoundaryDelay());

    return () => window.clearTimeout(timeoutId);
  }, [forecast?.length, selectedDayIndex]);

  const selectDayIndex = useCallback((index: number | ((current: number) => number)) => {
    setSelectedDayIndex(currentIndex => {
      const requestedIndex = typeof index === 'function' ? index(currentIndex) : index;
      return clampSelectedDayIndex(requestedIndex, forecast?.length);
    });
  }, [forecast?.length]);

  return {
    weather,
    forecast,
    beachForecasts,
    beachForecastsLoading,
    loading,
    error,
    selectedDayIndex,
    setSelectedDayIndex: selectDayIndex,
    loadWeatherData,
    lastUpdated
  };
};
