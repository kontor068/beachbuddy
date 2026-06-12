
import { WeatherData, ForecastItem, MarineForecast } from '../types';

const CACHE_DURATION = 15 * 60 * 1000;
const STALE_CACHE_DURATION = 6 * 60 * 60 * 1000;
const WEATHER_REQUEST_TIMEOUT_MS = 8000;

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

const getCacheEntry = <T>(key: string): CacheEntry<T> | null => {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as CacheEntry<T>;
  } catch (e) {
    localStorage.removeItem(key);
    return null;
  }
};

const getFromCache = <T>(key: string): T | null => {
  const entry = getCacheEntry<T>(key);
  if (!entry) return null;
  const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
  return isExpired ? null : entry.data;
};

const getStaleFromCache = <T>(key: string): { data: T; ageMs: number } | null => {
  const entry = getCacheEntry<T>(key);
  if (!entry) return null;

  const ageMs = Date.now() - entry.timestamp;
  if (ageMs > STALE_CACHE_DURATION) return null;

  return { data: entry.data, ageMs };
};

const saveToCache = <T>(key: string, data: T) => {
  const entry: CacheEntry<T> = {
    timestamp: Date.now(),
    data
  };

  try {
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

    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
};

const handleWeatherRequestFailure = <T>(
  source: string,
  url: string,
  lat: number,
  lon: number,
  cacheKey: string,
  error: unknown
): T => {
  const stale = getStaleFromCache<T>(cacheKey);

  console.warn('[weather] Open-Meteo request failed', {
    source,
    lat,
    lon,
    url,
    error: describeError(error),
    staleCacheAvailable: Boolean(stale),
    staleCacheAgeMinutes: stale ? Math.round(stale.ageMs / 60000) : null,
  });

  if (stale) {
    console.warn('[weather] Using stale cached weather data after request failure', {
      source,
      cacheKey,
      ageMinutes: Math.round(stale.ageMs / 60000),
    });
    return stale.data;
  }

  throw error;
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
 * Fetches real weather data using Open-Meteo with caching logic
 */
export const fetchWeatherData = async (lat: number, lon: number): Promise<WeatherData> => {
  const cacheKey = `weather_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cachedData = getFromCache<WeatherData>(cacheKey);
  
  if (cachedData) {
    console.log('Returning cached weather data');
    return cachedData;
  }

  const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,is_day,weather_code,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&timezone=auto`;

  try {
    const data = await fetchJson<any>(API_URL, 'current-weather');
    const current = data.current;
    if (!current) throw new Error('Weather fetch failed: missing current data');

    const weatherResult: WeatherData = {
      wind: {
        speed: current.wind_speed_10m,
        deg: current.wind_direction_10m,
      },
      weather: mapWmoToWeather(current.weather_code, current.is_day === 1),
      main: {
        temp: current.temperature_2m
      }
    };

    saveToCache(cacheKey, weatherResult);
    return weatherResult;
  } catch (error) {
    return handleWeatherRequestFailure<WeatherData>('current-weather', API_URL, lat, lon, cacheKey, error);
  }
};

/**
 * Fetches forecast data using Open-Meteo with caching logic
 */
export const fetchForecastData = async (lat: number, lon: number): Promise<ForecastItem[]> => {
  const cacheKey = `forecast_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cachedData = getFromCache<ForecastItem[]>(cacheKey);

  if (cachedData) {
    console.log('Returning cached forecast data');
    return cachedData;
  }

  const API_URL = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl&wind_speed_unit=ms&timezone=auto`;

  try {
    const data = await fetchJson<any>(API_URL, 'hourly-forecast');
    const hourly = data.hourly;
    if (!hourly?.time || !Array.isArray(hourly.time)) {
      throw new Error('Forecast fetch failed: missing hourly data');
    }

    const forecastResult: ForecastItem[] = hourly.time.map((timeStr: string, index: number): ForecastItem => {
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
          gust: hourly.wind_speed_10m[index] * 1.2
        },
        visibility: 10000,
        pop: 0,
        sys: { pod: isDay ? 'd' : 'n' }
      };
    });

    saveToCache(cacheKey, forecastResult);
    return forecastResult;
  } catch (error) {
    return handleWeatherRequestFailure<ForecastItem[]>('hourly-forecast', API_URL, lat, lon, cacheKey, error);
  }
};

/**
 * Fetches marine forecast data from Open-Meteo Marine.
 * This is intentionally separate from the weather forecast so a marine outage
 * does not force the app into mock weather mode.
 */
export const fetchMarineForecastData = async (lat: number, lon: number): Promise<MarineForecastItem[]> => {
  const cacheKey = `marine_${lat.toFixed(3)}_${lon.toFixed(3)}`;
  const cachedData = getFromCache<MarineForecastItem[]>(cacheKey);

  if (cachedData) {
    console.log('Returning cached marine data');
    return cachedData;
  }

  const hourly = [
    'wave_height',
    'wave_direction',
    'wave_period',
    'swell_wave_height',
    'swell_wave_direction',
    'swell_wave_period',
    'sea_surface_temperature',
  ].join(',');
  const API_URL = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=${hourly}&timezone=auto&forecast_days=6&cell_selection=sea`;

  try {
    const data = await fetchJson<any>(API_URL, 'marine-forecast');
    const marineHourly = data.hourly;

    if (!marineHourly?.time || !Array.isArray(marineHourly.time)) {
      throw new Error('Marine fetch failed: missing hourly data');
    }

    const marineResult: MarineForecastItem[] = marineHourly.time
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
      .filter(item => (
        item.marine.waveHeightM !== undefined ||
        item.marine.waveDirectionDeg !== undefined ||
        item.marine.wavePeriodS !== undefined ||
        item.marine.swellWaveHeightM !== undefined ||
        item.marine.swellWaveDirectionDeg !== undefined ||
        item.marine.seaSurfaceTemperatureC !== undefined
      ));

    saveToCache(cacheKey, marineResult);
    return marineResult;
  } catch (error) {
    return handleWeatherRequestFailure<MarineForecastItem[]>('marine-forecast', API_URL, lat, lon, cacheKey, error);
  }
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
