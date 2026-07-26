import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { WeatherData, DailyForecast, Island, LanguageCode, Beach, BeachForecastContext } from '../types';
import {
  fetchWeatherData,
  fetchForecastData,
  fetchMarineForecastData,
  mergeMarineForecastData,
  FRESH_TTL_MS,
  SOFT_STALE_LIMIT_MS,
} from '../services/weatherService';
import { processForecastData } from '../utils/weatherUtils'; // Assuming I move this helper or recreate it
import { athensNow } from '../utils/athensTime';
import { getLocalWeatherFixture } from '../utils/weatherFixtures';

/**
 * Freshness of the forecast currently held in state, derived from its real fetch time.
 *   • fresh   — age ≤ 60 min: render normally.
 *   • soft    — 60 min…3 h: render WITH a visible "βάσει πρόγνωσης HH:MM" stamp.
 *   • stale   — > 3 h: HARD CUTOFF; callers must blank wind colours / verdicts / scores.
 *   • unknown — no forecast loaded yet (loading / absent). Not a safety state.
 */
export type ForecastFreshness = 'fresh' | 'soft' | 'stale' | 'unknown';

const FRESHNESS_REEVAL_INTERVAL_MS = 60 * 1000;

const freshnessFromAge = (fetchedAt: number | null, now: number): ForecastFreshness => {
  if (fetchedAt == null) return 'unknown';
  const age = now - fetchedAt;
  if (age <= FRESH_TTL_MS) return 'fresh';
  if (age <= SOFT_STALE_LIMIT_MS) return 'soft';
  return 'stale';
};

const BEACH_FORECAST_CLUSTER_STEPS = [0.05, 0.08, 0.12];
const MAX_BEACH_FORECAST_CLUSTERS = 6;
// Per-beach cluster forecasts only refine scores; the map/list already render
// immediately from the island forecast. Keep a short delay so we don't compete
// with first paint, but land the refinement quickly instead of seconds later.
const BEACH_FORECAST_BACKGROUND_DELAY_MS = 1500;
const EVENING_TODAY_CUTOFF_HOUR = 21;

interface BeachForecastCluster {
  key: string;
  lat: number;
  lon: number;
  beachIds: number[];
}

const roundToCluster = (value: number, step: number): number => Math.round(value / step) * step;

const shouldSkipTodayAfterEvening = (now: Date = athensNow()): boolean =>
  now.getHours() >= EVENING_TODAY_CUTOFF_HOUR;

const getDefaultDayIndex = (forecastLength?: number, now: Date = athensNow()): number => {
  if (shouldSkipTodayAfterEvening(now) && (forecastLength || 0) > 1) return 1;
  return 0;
};

const clampSelectedDayIndex = (index: number, forecastLength?: number, now: Date = athensNow()): number => {
  const maxIndex = Math.max(0, (forecastLength || 1) - 1);
  const minIndex = getDefaultDayIndex(forecastLength, now);
  return Math.min(maxIndex, Math.max(minIndex, index));
};

const startOfLocalDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

// Drop forecast days that are now in the past. This keeps a tab left open across
// midnight from still offering yesterday as a selectable day.
const dropPastForecastDays = (
  forecast: DailyForecast[] | null,
  now: Date = athensNow(),
): DailyForecast[] | null => {
  if (!forecast || forecast.length === 0) return forecast;
  const todayStart = startOfLocalDay(now);
  const trimmed = forecast.filter(day => startOfLocalDay(day.date) >= todayStart);
  if (trimmed.length === 0 || trimmed.length === forecast.length) return forecast;
  return trimmed;
};

const getNextDaySelectionBoundaryDelay = (now: Date = athensNow()): number => {
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
    const [forecastResult, marineItems] = await Promise.all([
      fetchForecastData(cluster.lat, cluster.lon),
      fetchMarineForecastData(cluster.lat, cluster.lon)
        .then(result => result.data)
        .catch(error => {
          console.warn('Cluster marine forecast unavailable; using wind-based sea estimates.', error);
          return [];
        }),
    ]);
    const forecast = processForecastData(mergeMarineForecastData(forecastResult.data, marineItems));
    return cluster.beachIds.map(beachId => [
      beachId,
      {
        forecast,
        source: 'beach-cluster' as const,
        clusterKey: cluster.key,
        // Wind drives the safety-critical colours, so the cluster's freshness follows
        // its hourly-forecast fetch time (marine is supplementary).
        fetchedAt: forecastResult.fetchedAt,
      },
    ] as const);
  }));

  return Object.fromEntries(entries.flat());
};

export const useWeather = (selectedIsland: Island | undefined, language: LanguageCode) => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<DailyForecast[] | null>(null);
  // The island id the current `forecast`/`weather` belong to. `selectedIsland`
  // updates synchronously on a region switch, but the forecast for the new region
  // only loads in an effect AFTER paint — so for one frame the new region's
  // beaches would be scored with the previous region's wind (stale red "not ideal
  // today" cards, wrong map pin colours). Callers gate on this id to treat the
  // forecast as absent until it actually matches the selected region.
  const [forecastIslandId, setForecastIslandId] = useState<string | null>(null);
  const [beachForecasts, setBeachForecasts] = useState<Record<number, BeachForecastContext>>({});
  const [beachForecastsLoading, setBeachForecastsLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  // Real fetch time of the region forecast in state — the single source of truth for the
  // safety freshness gate (NOT "when loadWeatherData last ran").
  const [forecastFetchedAt, setForecastFetchedAt] = useState<number | null>(null);
  // Ticks every minute so a tab left open flips fresh→soft→stale even with no user action
  // and even if the day-boundary refetch fails.
  // athens-clock-exempt: freshness is an age in real ms against fetchedAt, never a wall clock.
  const [freshnessNow, setFreshnessNow] = useState<number>(() => Date.now());
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
      setForecastIslandId(null);
      setForecastFetchedAt(null);
      setSelectedDayIndex(getDefaultDayIndex());
    }

    setLoading(true);
    setError(null);
    setBeachForecasts({});
    setBeachForecastsLoading(false);

    const fixture = getLocalWeatherFixture(selectedIsland);
    if (fixture) {
      const fixtureFetchedAt = Date.now(); // athens-clock-exempt: real fetch instant
      setWeather(fixture.weather);
      setForecast(fixture.forecast);
      setForecastIslandId(selectedIsland.id);
      setForecastFetchedAt(fixtureFetchedAt);
      setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, fixture.forecast.length));
      setLastUpdated(new Date(fixtureFetchedAt));
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
      fetchMarineForecastData(lat, lon)
        .then(result => result.data)
        .catch(error => {
          console.warn('Marine forecast unavailable; using wind-based sea estimates.', error);
          return [];
        }),
    ]);

    if (requestIdRef.current !== requestId) return;

    const failures: string[] = [];

    if (weatherResult.status === 'fulfilled') {
      setWeather(weatherResult.value.data);
    } else {
      failures.push('current-weather');
      if (!isSameIsland) setWeather(null);
    }

    if (forecastResult.status === 'fulfilled') {
      const marine = marineResult.status === 'fulfilled' ? marineResult.value : [];
      if (marineResult.status === 'rejected') failures.push('marine-forecast');
      const nextForecast = processForecastData(mergeMarineForecastData(forecastResult.value.data, marine));
      setForecast(nextForecast);
      setForecastIslandId(selectedIsland.id);
      // Real data time (may be older than "now" if withCache served a within-cutoff
      // cached copy after a failed refresh) — drives the freshness gate + timestamp.
      setForecastFetchedAt(forecastResult.value.fetchedAt);
      setLastUpdated(new Date(forecastResult.value.fetchedAt));
      setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, nextForecast.length));
    } else {
      failures.push('hourly-forecast');
      if (!isSameIsland) {
        setForecast(null);
        setForecastFetchedAt(null);
      }
      // On a same-region refresh failure we keep the previous forecast in state, but we do
      // NOT touch forecastFetchedAt — its real (old) age lets the freshness gate blank it
      // once it crosses the 3 h cutoff.
    }

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
      setForecastIslandId(null);
      setForecastFetchedAt(null);
      setBeachForecasts({});
      setBeachForecastsLoading(false);
      setLoading(false);
    }
  }, [selectedIsland, loadWeatherData]);

  useEffect(() => {
    setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, forecast?.length));
  }, [forecast?.length]);

  // Re-evaluate freshness every minute so a long-open tab crosses fresh→soft→stale on its
  // own — the hard cutoff must fire even when nothing triggers a re-render or a refetch.
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFreshnessNow(Date.now()); // athens-clock-exempt: real instant for the age check
    }, FRESHNESS_REEVAL_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  const forecastFreshness = useMemo(
    () => freshnessFromAge(forecastFetchedAt, freshnessNow),
    [forecastFetchedAt, freshnessNow],
  );
  // Hard cutoff: forecast older than 3 h must not colour the map / score beaches / claim "calm".
  const isStaleBlocked = forecastFreshness === 'stale';

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const now = athensNow();
      // Drop the day that just rolled into the past so it can no longer be
      // selected, then refetch to extend the window with a fresh trailing day.
      setForecast(currentForecast => dropPastForecastDays(currentForecast, now));
      setSelectedDayIndex(currentIndex => clampSelectedDayIndex(currentIndex, forecast?.length, now));
      loadWeatherData();
    }, getNextDaySelectionBoundaryDelay());

    return () => window.clearTimeout(timeoutId);
  }, [forecast?.length, selectedDayIndex, loadWeatherData]);

  const selectDayIndex = useCallback((index: number | ((current: number) => number)) => {
    setSelectedDayIndex(currentIndex => {
      const requestedIndex = typeof index === 'function' ? index(currentIndex) : index;
      return clampSelectedDayIndex(requestedIndex, forecast?.length);
    });
  }, [forecast?.length]);

  return {
    weather,
    forecast,
    forecastIslandId,
    beachForecasts,
    beachForecastsLoading,
    loading,
    error,
    selectedDayIndex,
    setSelectedDayIndex: selectDayIndex,
    loadWeatherData,
    lastUpdated,
    // Freshness of the region forecast, derived from its real fetch time. `isStaleBlocked`
    // is the hard cutoff: when true, callers MUST treat the forecast as absent for
    // colouring/scoring and show the "conditions unavailable" state instead.
    forecastFreshness,
    isStaleBlocked,
    forecastFetchedAt,
  };
};
