
import { WeatherData, ForecastItem, MarineForecast } from '../types';
import { recordOpenMeteoCall, OpenMeteoEndpoint } from './analyticsService';
import { activeForecastProvider } from './forecast';
import type { ForecastPoint } from './forecast/ForecastProvider';
import { syncClockFromTrustedInstant } from '../utils/athensTime';
import { parseMarineHourly } from '../utils/marineForecastParsing';
import { marinePointKey } from '../utils/marineSamplePoints';

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
//
// The cutoff was 3 h until 2026-08-02, when it was raised to 12 h. The reasoning that
// moved it: 3 h is the right number for a MEASUREMENT and too strict for a FORECAST.
// What we hold is Open-Meteo's hourly prediction for the whole day ahead, so a payload
// fetched at 09:00 already contains what the model expects at 17:00. Refusing to show
// it at 12:01 does not protect anyone — it just blanks the page for a tourist standing
// outside their hotel, which is the outcome the fail-closed rule was meant to avoid
// being *worse* than. Twelve hours is where a run stops being worth showing at all,
// even labelled (product decision, Miltos, 2026-08-02).
//
// This is only safe because the soft window is genuinely visible: everything past
// FRESH_TTL_MS renders with the "βάσει πρόγνωσης HH:MM" stamp, so a longer window
// means more honestly-labelled data, never more silently-old data.
export const FRESH_TTL_MS = 60 * 60 * 1000;           // 60 min — matches Open-Meteo refresh cadence
export const SOFT_STALE_LIMIT_MS = 12 * 60 * 60 * 1000; // 12 h — hard cutoff; older is never served
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

/**
 * `persist: false` keeps an entry in memory for this page only.
 *
 * One marine point is ~35 KB of JSON (144 hours). Since 01/08/2026 a region view asks for one
 * point PER BEACH, so Evia alone would write ~4 MB — and the quota handler below reacts to
 * overflow by deleting EVERY weather key there is, which would turn the next region view cold
 * and walk us back toward the 429 of 29/07. Per-beach seas therefore live in memory, where they
 * cost a re-fetch on reload (2-5 batched requests) instead of the whole cache.
 */
const saveToCache = <T>(key: string, data: T, timestamp: number, persist: boolean = true) => {
  const entry: CacheEntry<T> = { timestamp, data };
  memoryCache.set(key, entry);

  try {
    if (!persist) return;
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

/**
 * How old the payload we just received already was at the origin, keyed by request URL.
 *
 * Normally zero and absent: a forecast fetched now was produced now. It is non-zero only
 * when our edge proxy could not reach Open-Meteo and answered from its own last-good
 * store (netlify/functions/forecast.mjs, FALLBACK_STORE) — then it sends
 * X-Forecast-Age-Seconds saying how stale that rescue is.
 *
 * This exists because `fetchedAt` is otherwise stamped with Date.now() at the moment the
 * bytes land, which is the right answer for a live fetch and the WRONG one for a rescue:
 * an 8-hour-old forecast would be presented as live, with no stamp and no cutoff. That
 * would be worse than the blank page the rescue replaces. Read once, then dropped, so a
 * later fetch of the same URL can never inherit an earlier response's age.
 */
const originAgeMsByUrl = new Map<string, number>();

/** Consume the recorded origin age for a URL (0 if the response was live). */
const takeOriginAgeMs = (url: string): number => {
  const age = originAgeMsByUrl.get(url) ?? 0;
  originAgeMsByUrl.delete(url);
  return age;
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

    // Clear first, so a live response after a rescued one never keeps the old age.
    originAgeMsByUrl.delete(url);
    const originAge = Number(response.headers.get('x-forecast-age-seconds'));
    if (Number.isFinite(originAge) && originAge > 0) {
      originAgeMsByUrl.set(url, originAge * 1000);
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
      // Not simply Date.now(): if the proxy rescued this from its last-good store, the
      // forecast is older than the delivery. Back-dating here is what keeps the stamp
      // and the hard cutoff honest all the way down the chain.
      const fetchedAt = Date.now() - takeOriginAgeMs(meta.url);
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
    return parseHourlyForecast(data?.hourly);
  });
};

/** Shape one Open-Meteo `hourly` block into our ForecastItem[]. Shared by the
 *  single-point fetcher and the batch one — one parser, one set of quirks. */
const parseHourlyForecast = (hourly: any): ForecastItem[] => {
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
    return parseMarineHourly(data?.hourly);
  });
};

// The per-hour model choice lives in utils/marineForecastParsing — decision-grade logic that
// decides the number behind every sea verdict, kept importable without this module's network
// and analytics dependencies so a build gate can exercise it directly.


// ── Multi-point fetching ─────────────────────────────────────────────────────
//
// WHY: a region view used to fire one request per cluster (Evia: 34 clusters × 2
// endpoints = 68 requests, plus 3 for the region itself). Open-Meteo's binding
// ceiling is ~600 requests/MINUTE, so nine simultaneous Evia visitors crossed it
// while the daily bucket was a quarter full — which is exactly the 429 we took on
// 29/07/2026. Batched, the same 34 clusters cost 2 requests per endpoint.
//
// Nothing about the DATA changes: same coordinates, same values, same per-point
// cache entries and the same 60-min TTL / 12-hour cutoff. We are not sampling fewer
// places — hooks/useWeather.ts explains at length why that is forbidden.

/** Mirrors MAX_COORDINATE_LIST_ITEMS in netlify/functions/forecast.mjs. Going over
 *  it makes the proxy answer 400, so the two numbers must stay equal. */
const BATCH_MAX_POINTS = 32;
/**
 * How far the echoed coordinate may sit from the requested one before we stop
 * believing the response describes our point at all.
 *
 * This is a SANITY check, not the matching rule, and the difference matters.
 * Open-Meteo snaps to its own model grid: asking for 24.42 returns 24.5, and 23.60
 * returns 23.625 — measured, not assumed. That snap (up to ~0.08°) is LARGER than
 * the gap between two of our clusters (BEACH_FORECAST_CLUSTER_STEPS starts at
 * 0.05°), so coordinate-matching cannot tell neighbouring clusters apart the way
 * nationalConditions.ts can with its 13 far-apart region points. Order is the only
 * reliable identity here; this bound only catches a response that is wrong by
 * kilometres rather than by grid rounding.
 *
 * Marine gets a much looser bound on purpose. `cell_selection=sea` does not round
 * to the nearest cell — it walks to the nearest cell that is actually WATER, and a
 * beach at the head of a closed bay can be pulled a long way out: asking marine for
 * 38.50 on the Evian gulf returned 38.708, i.e. 0.21° away, which the wind bound
 * would have rejected. That displacement is the feature working, not a fault, so
 * the marine check only exists to catch a grossly reordered response.
 */
const COORD_SANITY_TOLERANCE_DEG = { forecast: 0.2, marine: 1.0 } as const;

/**
 * Stable key for a point, at the same 3-decimal precision as the cache keys.
 *
 * Re-exported, not re-declared. utils/marineSamplePoints decides which coordinates are distinct
 * and this module decides which response belongs to which coordinate; the day those two use
 * different rules, a beach silently reads another beach's water. One definition, two users.
 */
export const forecastPointKey = marinePointKey;

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Fetch many points with as few requests as possible, reusing the per-point cache.
 *
 * Points already fresh in cache cost nothing. The rest are split into groups of 32,
 * one request each. Every point that comes back is written to the SAME cache key a
 * single-point fetch would have used, so a later `fetchForecastData(lat, lon)` for
 * one of these clusters is a cache hit rather than a new call.
 *
 * A failed group falls back to each point's own cached copy while it is inside the
 * SOFT_STALE_LIMIT_MS cutoff, exactly like the single-point path. Points with nothing usable are
 * simply absent from the returned map — the caller treats a missing cluster the same
 * way it already treats a failed one.
 */
const fetchPointsBatched = async <T>(
  points: ForecastPoint[],
  options: {
    cachePrefix: 'forecast' | 'marine';
    endpoint: OpenMeteoEndpoint;
    source: string;
    buildUrl: (batch: ForecastPoint[]) => string;
    parse: (entry: any) => T;
    /** Default true. See saveToCache — per-beach seas stay in memory. */
    persist?: boolean;
  },
): Promise<Map<string, FetchResult<T>>> => {
  const results = new Map<string, FetchResult<T>>();
  if (!points.length) return results;

  // Two clusters can round to the same key; ask for each coordinate once.
  const unique = new Map<string, ForecastPoint>();
  for (const point of points) {
    const key = forecastPointKey(point.lat, point.lon);
    if (!unique.has(key)) unique.set(key, point);
  }

  const cacheKeyOf = (point: ForecastPoint) =>
    `${options.cachePrefix}_${point.lat.toFixed(3)}_${point.lon.toFixed(3)}`;

  const missing: ForecastPoint[] = [];
  for (const [key, point] of unique) {
    const fresh = getFreshEntry<T>(cacheKeyOf(point));
    if (fresh) results.set(key, { data: fresh.data, fetchedAt: fresh.timestamp });
    else missing.push(point);
  }
  if (!missing.length) return results;

  await Promise.all(chunk(missing, BATCH_MAX_POINTS).map(async batch => {
    const url = options.buildUrl(batch);
    try {
      const json = await fetchJson<any>(url, options.source);
      // One point in, object out; many points in, array out.
      const entries: any[] = Array.isArray(json) ? json : [json];

      // Results come back in request order, one per coordinate. If that is not what
      // arrived, we do not try to guess which entry belongs to which cluster — with
      // clusters 0.05° apart and grid snapping up to 0.08°, a guess would silently
      // hand a beach its neighbour's wind. Drop the group; those beaches keep the
      // island forecast, which is honest.
      if (entries.length !== batch.length) {
        console.warn('[weather] Batched response length mismatch; group discarded', {
          source: options.source,
          requested: batch.length,
          received: entries.length,
        });
        return;
      }

      // Same back-dating as the single-point path: a rescued batch is as old as the
      // proxy says it is, not as young as its delivery.
      const fetchedAt = Date.now() - takeOriginAgeMs(url);

      batch.forEach((point, index) => {
        const entry = entries[index];
        const tolerance = COORD_SANITY_TOLERANCE_DEG[options.cachePrefix];
        const echoedFar =
          typeof entry?.latitude === 'number' && typeof entry?.longitude === 'number' &&
          (Math.abs(entry.latitude - point.lat) > tolerance ||
            Math.abs(entry.longitude - point.lon) > tolerance);
        if (!entry || echoedFar) {
          console.warn('[weather] Batched entry does not match its point; skipped', {
            source: options.source,
            asked: forecastPointKey(point.lat, point.lon),
            got: entry ? forecastPointKey(entry.latitude, entry.longitude) : 'none',
          });
          return;
        }

        try {
          const data = options.parse(entry?.hourly);
          saveToCache(cacheKeyOf(point), data, fetchedAt, options.persist !== false);
          results.set(forecastPointKey(point.lat, point.lon), { data, fetchedAt });
          // Counted per POINT, not per request: the provider's own limits are what
          // this number is compared against, and it almost certainly charges each
          // coordinate. Counting one per request would make us look 32× safer than
          // we are — the same optimism the server-side meter used to have.
          recordOpenMeteoCall(options.endpoint);
        } catch {
          // One unparseable point must not discard the other 31.
        }
      });
    } catch (error) {
      console.warn('[weather] Batched Open-Meteo request failed', {
        source: options.source,
        points: batch.length,
        url,
        error: describeError(error),
      });

      for (const point of batch) {
        const stale = getStaleFallbackEntry<T>(cacheKeyOf(point));
        if (stale) {
          results.set(forecastPointKey(point.lat, point.lon), {
            data: stale.data,
            fetchedAt: stale.timestamp,
          });
        }
      }
    }
  }));

  return results;
};

/** Hourly wind/weather for many points. Key the result with `forecastPointKey`. */
export const fetchForecastDataBatch = (
  points: ForecastPoint[],
): Promise<Map<string, FetchResult<ForecastItem[]>>> =>
  fetchPointsBatched<ForecastItem[]>(points, {
    cachePrefix: 'forecast',
    endpoint: 'hourly',
    source: 'hourly-forecast-batch',
    buildUrl: batch => activeForecastProvider.hourlyForecastUrlBatch(batch),
    parse: parseHourlyForecast,
  });

/**
 * Marine (wave/swell/SST) for many points. Key the result with `forecastPointKey`.
 *
 * `persist: false` for the per-beach sweep — see saveToCache. The REGION point keeps its
 * localStorage entry (it is fetched through this same call, so pass persist only when the batch
 * is the per-beach one).
 */
export const fetchMarineForecastDataBatch = (
  points: ForecastPoint[],
  options?: { persist?: boolean },
): Promise<Map<string, FetchResult<MarineForecastItem[]>>> =>
  fetchPointsBatched<MarineForecastItem[]>(points, {
    cachePrefix: 'marine',
    endpoint: 'marine',
    source: 'marine-forecast-batch',
    buildUrl: batch => activeForecastProvider.marineForecastUrlBatch(batch),
    parse: parseMarineHourly,
    persist: options?.persist,
  });

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
