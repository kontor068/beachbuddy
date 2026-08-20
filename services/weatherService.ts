
import { WeatherData, ForecastItem, MarineForecast } from '../types';
import { recordOpenMeteoCall, OpenMeteoEndpoint } from './analyticsService';
import { activeForecastProvider } from './forecast';
import type { ForecastPoint } from './forecast/ForecastProvider';
import { syncClockFromTrustedInstant } from '../utils/athensTime';
import { parseMarineHourly, mergeMarineLegs } from '../utils/marineForecastParsing';
import { marinePointKey } from '../utils/marineSamplePoints';
import { preferredMarineModelFor } from '../utils/marineModelPreference';
import { applyGustFloor } from '../utils/windGustFloor';
import type { OverWaterDirectionByTime } from '../utils/overWaterWind';

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
/**
 * How many persisted forecast entries this app is allowed to keep.
 *
 * WHY A CAP AT ALL. Until 08/08/2026 there was none. One marine point is ~35 KB
 * of JSON and a browser gives about 5 MB TOTAL for the whole origin, so a
 * visitor who browsed a few regions filled their own storage — and then every
 * OTHER feature that writes started failing: saving a beach threw and took the
 * whole app down to an error boundary, and signing in failed with a message
 * about a missing key. The quota handler below already recovered the weather
 * cache from its own overflow, which is exactly why the damage always landed
 * somewhere else.
 *
 * 48 entries ≈ 1.5 MB worst case, comfortably inside the budget while still
 * holding several regions' worth of a day's browsing.
 */
const MAX_PERSISTED_FORECASTS = 48;
const PERSISTED_PREFIXES = ['forecast_', 'marine_', 'weather_'];

const isForecastKey = (key: string): boolean => PERSISTED_PREFIXES.some(prefix => key.startsWith(prefix));

/**
 * Evict the oldest entries once the cap is passed. Key names are counted first
 * and the (expensive) JSON parse only happens on the rare write that actually
 * goes over, so the common path stays free.
 */
const enforceCacheCap = () => {
  try {
    const keys = Object.keys(localStorage).filter(isForecastKey);
    if (keys.length <= MAX_PERSISTED_FORECASTS) return;

    const dated = keys.map(key => {
      let timestamp = 0;
      try {
        timestamp = Number(JSON.parse(localStorage.getItem(key) || '{}')?.timestamp) || 0;
      } catch {
        /* unparseable entry — treat as oldest so it is the first to go */
      }
      return { key, timestamp };
    });

    dated.sort((a, b) => a.timestamp - b.timestamp);
    for (const { key } of dated.slice(0, dated.length - MAX_PERSISTED_FORECASTS)) {
      localStorage.removeItem(key);
    }
  } catch {
    /* storage unavailable — nothing to enforce */
  }
};

const saveToCache = <T>(key: string, data: T, timestamp: number, persist: boolean = true) => {
  const entry: CacheEntry<T> = { timestamp, data };
  memoryCache.set(key, entry);

  try {
    if (!persist) return;
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(entry));
    enforceCacheCap();
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
/**
 * The hour that is happening now, out of an hourly forecast.
 *
 * `dt` is absolute (unix seconds), so this needs no timezone reasoning at all — which is
 * the point. The item AT or BEFORE now is the hour we are inside; the first item is the
 * fallback for the one case that should not happen (a forecast starting in the future).
 */
const hourHappeningNow = (items: ForecastItem[]): ForecastItem | null => {
  if (!items.length) return null;
  const nowSeconds = Date.now() / 1000;
  let current: ForecastItem | null = null;
  for (const item of items) {
    if (item.dt <= nowSeconds) current = item;
    else break; // the array is chronological; nothing later can qualify
  }
  return current || items[0];
};

/**
 * Today's conditions at a point.
 *
 * NO LONGER ITS OWN NETWORK CALL (14/08/2026). It used to fetch Open-Meteo's `current=`
 * block, which cost a FULL API call per point — the provider's rule floors every request at
 * one call, so six variables cost exactly as much as sixty ("How Is One API Call Defined?",
 * quoted in netlify/functions/forecast.mjs). The hourly forecast we already fetch for the
 * same coordinate carries every one of those six fields, so that call bought nothing.
 *
 * It also removes a real inconsistency rather than only a cost. Every colour, verdict,
 * ranking and planner figure in this app is computed from the HOURLY data; only the headline
 * "right now" read from `current=`. The two are different samples of the same model — the
 * current block is the live instant, the hourly one is the top of the hour — so the headline
 * could name a wind the verdict beside it had not used. Now they are the same number by
 * construction.
 *
 * The hourly cache is shared, so a caller that later asks for the forecast at this point
 * pays nothing, and vice versa.
 */
export const fetchWeatherData = async (lat: number, lon: number): Promise<FetchResult<WeatherData>> => {
  const forecast = await fetchForecastData(lat, lon);
  const now = hourHappeningNow(forecast.data);
  if (!now) throw new Error('Weather fetch failed: hourly forecast carried no hours');

  return {
    data: {
      wind: { speed: now.wind.speed, deg: now.wind.deg, gust: now.wind.gust, speedBeforeGustFloor: now.wind.speedBeforeGustFloor },
      // Already mapped by parseHourlyForecast, day/night included.
      weather: now.weather[0],
      main: { temp: now.main.temp },
    },
    fetchedAt: forecast.fetchedAt,
  };
};

/**
 * Fetches forecast data using Open-Meteo with caching logic.
 */
export const fetchForecastData = async (lat: number, lon: number): Promise<FetchResult<ForecastItem[]>> => {
  const cacheKey = `forecast_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const API_URL = activeForecastProvider.hourlyForecastUrl(lat, lon);

  return withCache<ForecastItem[]>(cacheKey, 'hourly', 'hourly-forecast', { lat, lon, url: API_URL }, async () => {
    const data = await fetchJson<any>(API_URL, 'hourly-forecast');
    return parseHourlyForecast(data?.hourly, undefined, data);
  });
};

/** Shape one Open-Meteo `hourly` block into our ForecastItem[]. Shared by the
 *  single-point fetcher and the batch one — one parser, one set of quirks. */
const parseHourlyForecast = (hourly: any, _point?: ForecastPoint, envelope?: any): ForecastItem[] => {
  if (!hourly?.time || !Array.isArray(hourly.time)) {
    throw new Error('Forecast fetch failed: missing hourly data');
  }

  // Height of the POINT we asked about, from Open-Meteo's 90 m DEM — NOT the answering cell's.
  // Proven 18/08/2026: the same cell returns 0 / 242 / 264 depending on which coordinate you
  // send it. The name matters because the wrong one was tried and measured worse; see
  // utils/windGustFloor.ts. It decides whether the gust floor may fire: where the point sits on
  // flat ground at the water the hourly mean is already accurate (slope 1,104 against real
  // anemometers, and the SAR audit finds it OVER-reading at >6 m/s), so the floor would add wind
  // to a number that is already high. That exemption now has one exit — an incoherent
  // gust-to-mean ratio, which is a property of the answer, not of the place.
  const pointElevationM = optionalNumber(envelope?.elevation);

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
          // Gust floor applied HERE, at the one place raw Open-Meteo becomes a ForecastItem, so
          // every colour, verdict, filter and wave calculation downstream reads the same corrected
          // wind. See utils/windGustFloor.ts for the 32.000-hour measurement against real
          // anemometers that produced the 0,50 factor — the hourly mean compresses peaks and the
          // error was 2:1 towards "calmer than it is".
          speed: applyGustFloor(hourly.wind_speed_10m[index], optionalNumber(hourly.wind_gusts_10m?.[index]), pointElevationM),
          // Kept ONLY when the floor moved the number: everything that judges gustiness by
          // gust-minus-mean has to keep using the real mean, or the correction would erase the
          // very warnings it exists to strengthen. See types.ForecastItem.wind.
          speedBeforeGustFloor: applyGustFloor(hourly.wind_speed_10m[index], optionalNumber(hourly.wind_gusts_10m?.[index]), pointElevationM) !== hourly.wind_speed_10m[index]
            ? hourly.wind_speed_10m[index]
            : undefined,
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
// ── Water temperature, fetched apart and folded back in ──────────────────────
//
// Split off the wave request on 14/08/2026 because Open-Meteo prices MODELS per coordinate:
// the currents model that carries this single field was costing a third of the national marine
// bill. Callers are deliberately unaware of the split — every existing call site still asks for
// "the marine forecast" and still gets water temperature inside it.
//
// THE MERGE IS BY TIME, never by position. The two responses can differ in length (different
// models, different run cut-offs), so pairing them by array index would eventually hand a
// beach the wrong hour's temperature — silently, since both are plausible numbers.
//
// Kept as a PLAIN OBJECT rather than a Map on purpose: this value goes through the same
// localStorage cache as everything else, and `JSON.stringify(new Map())` is `{}` — a Map would
// come back empty after every reload, which on screen is indistinguishable from "this beach has
// no water temperature".
type SeaTemperatureByHour = Record<string, number>;

const parseSeaTemperatureHourly = (hourly: any): SeaTemperatureByHour => {
  const out: SeaTemperatureByHour = {};
  const times = hourly?.time;
  if (!Array.isArray(times)) return out;
  // One model is pinned on this route, so Open-Meteo returns the BARE field name. The suffixed
  // name is read first anyway: it is what comes back if a second model is ever added here, and
  // it costs one lookup to not regress silently the day that happens.
  const series = hourly[`sea_surface_temperature_${'meteofrance_currents'}`] ?? hourly.sea_surface_temperature;
  if (!Array.isArray(series)) return out;
  times.forEach((timeStr: string, index: number) => {
    const value = optionalNumber(series[index]);
    if (value !== undefined) out[String(timeStr).replace('T', ' ')] = value;
  });
  return out;
};

/**
 * Fold a temperature series into marine rows. Rows with no matching hour keep what they had.
 *
 * IT ALSO ADDS HOURS THE WAVE RESPONSE DOES NOT HAVE, and that is not a nicety. parseMarineHourly
 * drops any hour where every field is undefined, and sea temperature used to be one of the fields
 * keeping such an hour alive. In the enclosed basins neither wave model resolves — the Evian and
 * Saronic gulfs, exactly the coasts this app is most careful about — the wave columns come back
 * null while the currents model still reports a temperature. Merging only into existing rows
 * would therefore have deleted the water-temperature card from those beaches and nowhere else,
 * which is the kind of regression that gets found in September.
 */
const withSeaTemperature = (
  items: MarineForecastItem[],
  byHour: SeaTemperatureByHour | undefined,
): MarineForecastItem[] => {
  if (!byHour) return items;

  const seen = new Set<string>();
  const merged = items.map(item => {
    seen.add(item.dt_txt);
    const value = byHour[item.dt_txt];
    return typeof value !== 'number'
      ? item
      : { ...item, marine: { ...item.marine, seaSurfaceTemperatureC: value } };
  });

  for (const [dt_txt, value] of Object.entries(byHour)) {
    if (seen.has(dt_txt) || typeof value !== 'number') continue;
    // No waveModel: nothing here came from a wave model, and claiming one would be a lie in
    // the one field whose whole job is traceability.
    merged.push({ dt_txt, marine: { seaSurfaceTemperatureC: value, source: 'open-meteo-marine' } });
  }

  // Consumers look rows up by hour, but anything that scans (first usable hour, day grouping)
  // assumes chronological order, and appended rows would otherwise sit at the end.
  return merged.sort((a, b) => (a.dt_txt < b.dt_txt ? -1 : a.dt_txt > b.dt_txt ? 1 : 0));
};

/**
 * Fetches marine forecast data from Open-Meteo Marine.
 * This is intentionally separate from the weather forecast so a marine outage
 * does not force the app into mock weather mode.
 *
 * Water temperature rides a second request (see above). It is awaited alongside, never before:
 * a failure there must cost the comfort card, never the wave height that decides a verdict.
 */
export const fetchMarineForecastData = async (lat: number, lon: number): Promise<FetchResult<MarineForecastItem[]>> => {
  const cacheKey = `marine_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const API_URL = activeForecastProvider.marineForecastUrl(lat, lon);

  // Η ΟΥΡΑ ΕΙΝΑΙ ΔΕΥΤΕΡΟ ΑΙΤΗΜΑ ΑΠΟ 20/08/2026 (PORISMA §Γ43): `models=ewam` για τις πρώτες 94
  // ώρες με μνήμη 3 ω., `models=meteofrance_wave` για τις 95-144 με μνήμη 12 ω. Τα δύο ενώνονται
  // ΜΕ ΤΗ ΣΦΡΑΓΙΔΑ ΩΡΑΣ πριν φτάσουν στον parser, ώστε ο κανόνας ανά ώρα ΚΑΙ ο μάρτυρας κορυφών
  // να δουλεύουν όπως όταν τα μοντέλα έρχονταν μαζί.
  //
  // Η αποτυχία της ουράς ΚΑΤΑΠΙΝΕΤΑΙ επίτηδες, ίδιο δόγμα με τη θερμοκρασία νερού: το κύμα
  // αποφασίζει ετυμηγορίες και χρώματα, οι μέρες 4-6 όχι. Χωρίς ουρά ο parser διαβάζει τη μία
  // σειρά ως ηγέτη ΚΑΙ ως μάρτυρα, η επιβεβαίωση περνάει πάντα, και καμία ώρα δεν κόβεται —
  // δηλαδή χάνονται οι μακρινές μέρες, ποτέ δεν χαμηλώνει το σημερινό κύμα.
  const TAIL_URL = activeForecastProvider.marineTailForecastUrl(lat, lon);
  const waves = withCache<MarineForecastItem[]>(cacheKey, 'marine', 'marine-forecast', { lat, lon, url: API_URL }, async () => {
    const [data, tail] = await Promise.all([
      fetchJson<any>(API_URL, 'marine-forecast'),
      fetchJson<any>(TAIL_URL, 'marine-forecast-tail').catch(() => null),
    ]);
    return parseMarineHourly(mergeMarineLegs(data?.hourly, tail?.hourly), preferredMarineModelFor(lat, lon));
  });

  const sstKey = `sst_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const sstUrl = activeForecastProvider.seaTemperatureUrl(lat, lon);
  const temperature = withCache<SeaTemperatureByHour>(sstKey, 'marine', 'sea-temperature', { lat, lon, url: sstUrl }, async () => {
    const data = await fetchJson<any>(sstUrl, 'sea-temperature');
    return parseSeaTemperatureHourly(data?.hourly);
  }).catch(() => null);

  const [waveResult, temperatureResult] = await Promise.all([waves, temperature]);
  return { ...waveResult, data: withSeaTemperature(waveResult.data, temperatureResult?.data) };
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
// `sst` rides the marine tolerance for the same reason: it is fetched with the identical
// `cell_selection=sea` walk, so it is displaced exactly as far from the pin as the waves are.
// `overWaterWind` asks at the SEA CELL's own coordinates (data/forecast-sea-cells.generated.json),
// so a healthy answer echoes back the same cell and 0.2 deg is as generous here as on the weather
// route. It is NOT the marine tolerance: this route must not be allowed to silently answer from a
// cell in another basin, which is the exact failure the layer exists to fix.
const COORD_SANITY_TOLERANCE_DEG = { forecast: 0.2, marine: 1.0, sst: 1.0, marineTail: 1.0, overWaterWind: 0.2 } as const;

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
    cachePrefix: keyof typeof COORD_SANITY_TOLERANCE_DEG;
    endpoint: OpenMeteoEndpoint;
    source: string;
    buildUrl: (batch: ForecastPoint[]) => string;
    /**
     * `point` is passed so a parser can vary by coordinate — see the marine model preference.
     * `envelope` is the FULL per-point response, needed because `elevation` — the height of the
     * cell Open-Meteo actually answered from — lives beside `hourly`, not inside it, and the
     * gust floor is only allowed to fire over a cell that contains land (utils/windGustFloor).
     */
    parse: (entry: any, point: ForecastPoint, envelope?: any) => T;
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
          const data = options.parse(entry?.hourly, point, entry);
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
 * WIND DIRECTION OVER THE WATER, for many sea cells at once. Key the result with `forecastPointKey`.
 *
 * Returns a plain `dt_txt -> degrees` map per cell, NOT a ForecastItem[]: nothing about this
 * response is a forecast a beach could be rendered from — it carries one field and no speed, and
 * feeding it anywhere except utils/overWaterWind.applyOverWaterWindDirection would hand a surface
 * a direction with no wind behind it.
 *
 * KEYED BY TIME, NEVER BY INDEX. The two responses come from different cells and can differ in
 * length (different model cut-offs). Pairing them by array position would eventually give a beach
 * another hour's direction — silently, because both are plausible angles. `dt_txt` is built with
 * exactly the same transform parseHourlyForecast uses, so the two line up or they do not merge
 * at all.
 *
 * `persist: false` — this is a per-view sweep of up to 666 cells nationally. It has the same
 * in-memory cache as everything else, but writing every cell to localStorage would evict the
 * region forecasts that the app actually needs to survive a reload.
 */
export const fetchOverWaterWindBatch = (
  points: ForecastPoint[],
): Promise<Map<string, FetchResult<OverWaterDirectionByTime>>> =>
  fetchPointsBatched<OverWaterDirectionByTime>(points, {
    cachePrefix: 'overWaterWind',
    endpoint: 'over-water-wind',
    source: 'over-water-wind-batch',
    buildUrl: batch => activeForecastProvider.overWaterWindUrlBatch(batch),
    parse: hourly => {
      const times: string[] | undefined = hourly?.time;
      const degrees: Array<number | null> | undefined = hourly?.wind_direction_10m;
      if (!Array.isArray(times) || !Array.isArray(degrees)) {
        throw new Error('Over-water wind response has no hourly direction');
      }
      const out: Record<string, number> = {};
      times.forEach((timeStr, index) => {
        const deg = degrees[index];
        if (typeof deg === 'number' && Number.isFinite(deg)) out[timeStr.replace('T', ' ')] = deg;
      });
      if (!Object.keys(out).length) throw new Error('Over-water wind response is empty');
      return out;
    },
    persist: false,
  });

/**
 * Marine (wave/swell/SST) for many points. Key the result with `forecastPointKey`.
 *
 * `persist: false` for the per-beach sweep — see saveToCache. The REGION point keeps its
 * localStorage entry (it is fetched through this same call, so pass persist only when the batch
 * is the per-beach one).
 */
export const fetchMarineForecastDataBatch = async (
  points: ForecastPoint[],
  options?: { persist?: boolean },
): Promise<Map<string, FetchResult<MarineForecastItem[]>>> => {
  // ΤΟ ΣΚΕΛΟΣ ΤΗΣ ΟΥΡΑΣ ΠΡΩΤΑ, ΚΑΙ ΩΜΟ (PORISMA §Γ43). Πρέπει να υπάρχει ΠΡΙΝ γίνει το parse του
  // κοντινού, γιατί ο μάρτυρας κορυφών θέλει τις δύο σειρές ΜΑΖΙ — αν το ενώναμε μετά, σε έτοιμες
  // γραμμές, ο μάρτυρας θα πέθαινε σιωπηλά και θα χάναμε το φράγμα ψεύτικης κορυφής.
  //
  // Δική της μνήμη (`marineTail`), γιατί το `marine` κρατάει έτοιμες γραμμές για την ίδια
  // συντεταγμένη και τα δύο θα πατούσε το ένα το άλλο. ΠΟΤΕ persist: είναι σκέλος 12 ωρών που το
  // CDN δίνει τζάμπα, και ο χώρος του localStorage ανήκει στη σειρά που ξαναδιαβάζεται.
  //
  // Αποτυχία => άδειος χάρτης, ποτέ εξαίρεση: το κύμα των πρώτων ημερών δεν επιτρέπεται να πέσει
  // επειδή δεν απάντησαν οι μέρες 4-6.
  const tailByPoint = await fetchPointsBatched<any>(points, {
    cachePrefix: 'marineTail',
    endpoint: 'marine',
    source: 'marine-forecast-tail-batch',
    buildUrl: batch => activeForecastProvider.marineTailForecastUrlBatch(batch),
    parse: (hourly) => hourly,
    persist: false,
  }).catch(() => new Map<string, FetchResult<any>>());

  const waves = fetchPointsBatched<MarineForecastItem[]>(points, {
    cachePrefix: 'marine',
    endpoint: 'marine',
    source: 'marine-forecast-batch',
    buildUrl: batch => activeForecastProvider.marineForecastUrlBatch(batch),
    // Τα 56 σημεία που πρέπει να διαβαστούν από το άλλο μοντέλο κύματος: το κελί του ewam
    // εκεί περιγράφει νερό που η παραλία δεν βλέπει. Παντού αλλού δεν αλλάζει τίποτα.
    parse: (hourly, point) => parseMarineHourly(
      mergeMarineLegs(hourly, tailByPoint.get(forecastPointKey(point.lat, point.lon))?.data),
      preferredMarineModelFor(point.lat, point.lon),
    ),
    persist: options?.persist,
  });

  // The temperature leg. Its own cache prefix, because sharing 'marine' would collide with the
  // wave entry for the same coordinate and the two would overwrite each other.
  //
  // NEVER persisted: the wave series is what the app re-reads across sessions, while this is a
  // 12 h-cached comfort field that the CDN hands back for free. Keeping it out of localStorage
  // leaves that budget to the data that needs it.
  //
  // Failures are swallowed to an empty map ON PURPOSE. Waves decide verdicts and colours;
  // water temperature decides a card. One must never take down the other.
  const temperatures = fetchPointsBatched<SeaTemperatureByHour>(points, {
    cachePrefix: 'sst',
    endpoint: 'marine',
    source: 'sea-temperature-batch',
    buildUrl: batch => activeForecastProvider.seaTemperatureUrlBatch(batch),
    parse: parseSeaTemperatureHourly,
    persist: false,
  }).catch(() => new Map<string, FetchResult<SeaTemperatureByHour>>());

  const [waveByPoint, temperatureByPoint] = await Promise.all([waves, temperatures]);

  const merged = new Map<string, FetchResult<MarineForecastItem[]>>();
  for (const [key, result] of waveByPoint) {
    merged.set(key, {
      ...result,
      data: withSeaTemperature(result.data, temperatureByPoint.get(key)?.data),
    });
  }
  return merged;
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
