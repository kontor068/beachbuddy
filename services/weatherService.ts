
import { WeatherData, ForecastItem, MarineForecast } from '../types';
import { recordOpenMeteoCall, OpenMeteoEndpoint } from './analyticsService';
import { activeForecastProvider } from './forecast';
import { syncClockFromTrustedInstant } from '../utils/athensTime';

// --- Freshness policy (safety-critical) --------------------------------------
// A forecast is a prediction for each hour, so a recently fetched payload still
// predicts "now" with full skill. But a payload we cannot refresh must never be
// shown silently as if fresh — a stale "calm" reading on a meltemi day is the
// worst possible bug. So we split age into three windows and let the UI gate on
// the real fetch time (see FetchResult.fetchedAt):
//   • fresh  (age ≤ FRESH_TTL_MS)      → serve from cache, no network, no warning
//   • soft   (FRESH_TTL_MS … SOFT_STALE_LIMIT_MS) → still usable WITH a visible
//                                         "βάσει πρόγνωσης HH:MM" stamp (UI concern)
//   • stale  (> SOFT_STALE_LIMIT_MS)   → unusable; the UI blanks colours/verdicts
// This module owns the fetch/cache half; the UI owns the display half. The one
// hard rule here: we NEVER return data older than SOFT_STALE_LIMIT_MS, and every
// value carries its real fetchedAt so the UI can tell how old it is.
export const FRESH_TTL_MS = 60 * 60 * 1000;          // 60 min — matches Open-Meteo refresh cadence
export const SOFT_STALE_LIMIT_MS = 3 * 60 * 60 * 1000; // 3 h — hard cutoff; older is never served
const WEATHER_REQUEST_TIMEOUT_MS = 8000;

/** A forecast payload plus the real epoch-ms time its data was fetched from Open-Meteo. */
export interface FetchResult<T> {
  data: T;
  /** epoch ms when this data was actually retrieved from the origin (NOT when the caller asked). */
  fetchedAt: number;
}

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

// In-memory mirror of the localStorage cache: instant same-session hits with no
// JSON parse, and it survives even if localStorage is unavailable/full.
const memoryCache = new Map<string, CacheEntry<unknown>>();

// In-flight request dedup: two beaches / re-renders asking for the same coordinate
// before the first response lands share ONE network call instead of double-fetching.
const inFlight = new Map<string, Promise<FetchResult<unknown>>>();

const readLocalStorageEntry = <T>(key: string): CacheEntry<T> | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    return JSON.parse(cached) as CacheEntry<T>;
  } catch {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return null;
  }
};

const getCacheEntry = <T>(key: string): CacheEntry<T> | null => {
  const inMemory = memoryCache.get(key) as CacheEntry<T> | undefined;
  if (inMemory) return inMemory;

  const fromStorage = readLocalStorageEntry<T>(key);
  if (fromStorage) memoryCache.set(key, fromStorage);
  return fromStorage;
};

/** A cache entry still inside the fresh TTL, or null. */
const getFreshEntry = <T>(key: string): CacheEntry<T> | null => {
  const entry = getCacheEntry<T>(key);
  if (!entry) return null;
  return Date.now() - entry.timestamp > FRESH_TTL_MS ? null : entry;
};

/**
 * A cache entry usable as a failure fallback: older than fresh but still within the
 * hard cutoff. Beyond SOFT_STALE_LIMIT_MS this returns null so expired data is never
 * served — the caller then surfaces "conditions unavailable" instead.
 */
const getStaleFallbackEntry = <T>(key: string): CacheEntry<T> | null => {
  const entry = getCacheEntry<T>(key);
  if (!entry) return null;
  return Date.now() - entry.timestamp > SOFT_STALE_LIMIT_MS ? null : entry;
};

const saveToCache = <T>(key: string, data: T, timestamp: number) => {
  const entry: CacheEntry<T> = { timestamp, data };
  memoryCache.set(key, entry);

  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(entry));
  } catch (error) {
    const isQuotaError = error instanceof DOMException && (
      error.name === 'QuotaExceededError' ||
      error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
    );

    if (!isQuotaError) {
      console.warn('Weather cache write skipped:', error);
      return;
    }

    Object.keys(localStorage)
      .filter(storageKey => storageKey.startsWith('forecast_') || storageKey.startsWith('marine_') || storageKey.startsWith('weather_'))
      .forEach(storageKey => localStorage.removeItem(storageKey));

    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      console.warn('Weather cache write skipped: browser storage quota exceeded.');
    }
  }
};

const optionalNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const describeError = (error: unknown): string => {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
};

const fetchJson = async <T>(url: string, source: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), WEATHER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`${source} fetch failed: ${response.status} ${response.statusText}`);
    }

    // Free, trustworthy clock reference: `Date` is a CORS-safelisted response header, so
    // every forecast response tells us the real UTC time. A device whose own clock is
    // badly wrong would otherwise be pointed at the wrong forecast hour (see athensTime).
    const serverDate = response.headers.get('date');
    if (serverDate) syncClockFromTrustedInstant(Date.parse(serverDate));

    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
};

/**
 * Shared cache/dedup/failure pipeline for every Open-Meteo fetcher.
 *
 * 1. Fresh cache hit (≤ FRESH_TTL_MS)          → return cached data + its real fetchedAt, no network.
 * 2. Identical request already in flight        → share that promise (no double fetch).
 * 3. Otherwise fetch once. On success: cache + count the origin call. On failure: fall
 *    back to cache ONLY if within SOFT_STALE_LIMIT_MS, still tagged with its real (old)
 *    fetchedAt so the UI can label/gate it. Older than the cutoff → throw (never serve).
 */
const withCache = async <T>(
  cacheKey: string,
  endpoint: OpenMeteoEndpoint,
  source: string,
  meta: { lat: number; lon: number; url: string },
  runFetch: () => Promise<T>,
): Promise<FetchResult<T>> => {
  const fresh = getFreshEntry<T>(cacheKey);
  if (fresh) {
    return { data: fresh.data, fetchedAt: fresh.timestamp };
  }

  const pending = inFlight.get(cacheKey) as Promise<FetchResult<T>> | undefined;
  if (pending) return pending;

  const request = (async (): Promise<FetchResult<T>> => {
    try {
      const data = await runFetch();
      const fetchedAt = Date.now();
      saveToCache(cacheKey, data, fetchedAt);
      // Count only real origin calls (cache misses) so the counter tracks how close
      // we are to the Open-Meteo rate limit.
      recordOpenMeteoCall(endpoint);
      return { data, fetchedAt };
    } catch (error) {
      const stale = getStaleFallbackEntry<T>(cacheKey);
      const staleAgeMs = stale ? Date.now() - stale.timestamp : null;

      console.warn('[weather] Open-Meteo request failed', {
        source,
        lat: meta.lat,
        lon: meta.lon,
        url: meta.url,
        error: describeError(error),
        staleFallbackAvailable: Boolean(stale),
        staleFallbackAgeMinutes: staleAgeMs === null ? null : Math.round(staleAgeMs / 60000),
      });

      if (stale) {
        // Within the hard cutoff: reuse it, but carry its REAL age so the UI shows the
        // stamp / applies the cutoff. Never presented as fresh.
        console.warn('[weather] Serving cached data after request failure (still within cutoff)', {
          source,
          cacheKey,
          ageMinutes: staleAgeMs === null ? null : Math.round(staleAgeMs / 60000),
        });
        return { data: stale.data, fetchedAt: stale.timestamp };
      }

      // No usable data within the cutoff → let the caller show "conditions unavailable".
      throw error;
    } finally {
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, request);
  return request;
};

export interface MarineForecastItem {
  dt_txt: string;
  marine: MarineForecast;
}

// Mapping WMO Weather codes to OpenWeather-style objects for UI compatibility
const mapWmoToWeather = (code: number, isDay: boolean = true) => {
  const suffix = isDay ? 'd' : 'n';
  const mapping: Record<number, { id: number; main: string; description: string; icon: string }> = {
    0: { id: 800, main: 'Clear', description: 'clear sky', icon: `01${suffix}` },
    1: { id: 801, main: 'Clouds', description: 'mainly clear', icon: `02${suffix}` },
    2: { id: 802, main: 'Clouds', description: 'partly cloudy', icon: `02${suffix}` },
    3: { id: 803, main: 'Clouds', description: 'overcast', icon: `03${suffix}` },
    45: { id: 741, main: 'Fog', description: 'fog', icon: `50${suffix}` },
    48: { id: 741, main: 'Fog', description: 'depositing rime fog', icon: `50${suffix}` },
    51: { id: 300, main: 'Rain', description: 'light drizzle', icon: `09${suffix}` },
    53: { id: 301, main: 'Rain', description: 'moderate drizzle', icon: `09${suffix}` },
    55: { id: 302, main: 'Rain', description: 'dense drizzle', icon: `09${suffix}` },
    61: { id: 500, main: 'Rain', description: 'slight rain', icon: `10${suffix}` },
    63: { id: 501, main: 'Rain', description: 'moderate rain', icon: `10${suffix}` },
    65: { id: 502, main: 'Rain', description: 'heavy rain', icon: `10${suffix}` },
    80: { id: 520, main: 'Rain', description: 'slight rain showers', icon: `09${suffix}` },
    81: { id: 521, main: 'Rain', description: 'moderate rain showers', icon: `09${suffix}` },
    82: { id: 522, main: 'Rain', description: 'violent rain showers', icon: `09${suffix}` },
    95: { id: 200, main: 'Thunderstorm', description: 'thunderstorm', icon: `11${suffix}` },
  };

  return mapping[code] || { id: 803, main: 'Clouds', description: 'scattered clouds', icon: `03${suffix}` };
};

export const getMockWeatherData = (): WeatherData => {
  return {
    wind: { speed: 5, deg: 0 },
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    main: { temp: 25 }
  };
};

/**
 * Fetches real weather data using Open-Meteo with caching logic.
 * Returns the data plus the real time it was fetched (fetchedAt) so callers can
 * apply the freshness/staleness policy.
 */
export const fetchWeatherData = async (lat: number, lon: number): Promise<FetchResult<WeatherData>> => {
  const cacheKey = `weather_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const API_URL = activeForecastProvider.currentWeatherUrl(lat, lon);

  return withCache<WeatherData>(cacheKey, 'current', 'current-weather', { lat, lon, url: API_URL }, async () => {
    const data = await fetchJson<any>(API_URL, 'current-weather');
    const current = data.current;
    if (!current) throw new Error('Weather fetch failed: missing current data');

    return {
      wind: {
        speed: current.wind_speed_10m,
        deg: current.wind_direction_10m,
        // Real measured gust (m/s); fall back to the old synthetic estimate only if the API omits it.
        gust: optionalNumber(current.wind_gusts_10m) ?? current.wind_speed_10m * 1.2,
      },
      weather: mapWmoToWeather(current.weather_code, current.is_day === 1),
      main: {
        temp: current.temperature_2m
      }
    };
  });
};

/**
 * Fetches forecast data using Open-Meteo with caching logic.
 */
export const fetchForecastData = async (lat: number, lon: number): Promise<FetchResult<ForecastItem[]>> => {
  const cacheKey = `forecast_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const API_URL = activeForecastProvider.hourlyForecastUrl(lat, lon);

  return withCache<ForecastItem[]>(cacheKey, 'hourly', 'hourly-forecast', { lat, lon, url: API_URL }, async () => {
    const data = await fetchJson<any>(API_URL, 'hourly-forecast');
    const hourly = data.hourly;
    if (!hourly?.time || !Array.isArray(hourly.time)) {
      throw new Error('Forecast fetch failed: missing hourly data');
    }

    return hourly.time.map((timeStr: string, index: number): ForecastItem => {
      const date = new Date(timeStr);
      const isDay = date.getHours() > 6 && date.getHours() < 20;

      return {
        dt: Math.floor(date.getTime() / 1000),
        dt_txt: timeStr.replace('T', ' '),
        main: {
          temp: hourly.temperature_2m[index],
          temp_min: hourly.temperature_2m[index],
          temp_max: hourly.temperature_2m[index],
          pressure: hourly.pressure_msl[index],
          sea_level: hourly.pressure_msl[index],
          grnd_level: hourly.pressure_msl[index],
          humidity: 50,
          temp_kf: 0
        },
        weather: [mapWmoToWeather(hourly.weather_code[index], isDay)],
        clouds: { all: 0 },
        wind: {
          speed: hourly.wind_speed_10m[index],
          deg: hourly.wind_direction_10m[index],
          // Real measured gust (m/s); fall back to the old synthetic estimate only if the API omits it.
          gust: optionalNumber(hourly.wind_gusts_10m?.[index]) ?? hourly.wind_speed_10m[index] * 1.2
        },
        visibility: 10000,
        pop: 0,
        precipitationProbability: (() => {
          const percent = optionalNumber(hourly.precipitation_probability?.[index]);
          return percent === undefined ? undefined : percent / 100;
        })(),
        sys: { pod: isDay ? 'd' : 'n' },
        uvIndex: optionalNumber(hourly.uv_index?.[index]),
      };
    });
  });
};

/**
 * Fetches marine forecast data from Open-Meteo Marine.
 * This is intentionally separate from the weather forecast so a marine outage
 * does not force the app into mock weather mode.
 */
export const fetchMarineForecastData = async (lat: number, lon: number): Promise<FetchResult<MarineForecastItem[]>> => {
  const cacheKey = `marine_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const API_URL = activeForecastProvider.marineForecastUrl(lat, lon);

  return withCache<MarineForecastItem[]>(cacheKey, 'marine', 'marine-forecast', { lat, lon, url: API_URL }, async () => {
    const data = await fetchJson<any>(API_URL, 'marine-forecast');
    const marineHourly = data.hourly;

    if (!marineHourly?.time || !Array.isArray(marineHourly.time)) {
      throw new Error('Marine fetch failed: missing hourly data');
    }

    return marineHourly.time
      .map((timeStr: string, index: number): MarineForecastItem => ({
        dt_txt: timeStr.replace('T', ' '),
        marine: {
          waveHeightM: optionalNumber(marineHourly.wave_height?.[index]),
          waveDirectionDeg: optionalNumber(marineHourly.wave_direction?.[index]),
          wavePeriodS: optionalNumber(marineHourly.wave_period?.[index]),
          swellWaveHeightM: optionalNumber(marineHourly.swell_wave_height?.[index]),
          swellWaveDirectionDeg: optionalNumber(marineHourly.swell_wave_direction?.[index]),
          swellWavePeriodS: optionalNumber(marineHourly.swell_wave_period?.[index]),
          seaSurfaceTemperatureC: optionalNumber(marineHourly.sea_surface_temperature?.[index]),
          source: 'open-meteo-marine',
        },
      }))
      .filter((item: MarineForecastItem) => (
        item.marine.waveHeightM !== undefined ||
        item.marine.waveDirectionDeg !== undefined ||
        item.marine.wavePeriodS !== undefined ||
        item.marine.swellWaveHeightM !== undefined ||
        item.marine.swellWaveDirectionDeg !== undefined ||
        item.marine.seaSurfaceTemperatureC !== undefined
      ));
  });
};

export const mergeMarineForecastData = (
  forecastItems: ForecastItem[],
  marineItems: MarineForecastItem[]
): ForecastItem[] => {
  if (!marineItems.length) return forecastItems;

  const marineByTime = new Map(marineItems.map(item => [item.dt_txt, item.marine]));
  return forecastItems.map(item => ({
    ...item,
    marine: marineByTime.get(item.dt_txt) || item.marine,
  }));
};

export const getMockForecastData = (): ForecastItem[] => {
    return [];
};
