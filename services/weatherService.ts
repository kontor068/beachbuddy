
import { WeatherData, ForecastItem } from '../types';

const CACHE_DURATION = 15 * 60 * 1000; // 15 λεπτά σε milliseconds

interface CacheEntry<T> {
  timestamp: number;
  data: T;
}

// Helper to manage local storage caching
const getFromCache = <T>(key: string): T | null => {
  const cached = localStorage.getItem(key);
  if (!cached) return null;

  try {
    const entry: CacheEntry<T> = JSON.parse(cached);
    const isExpired = Date.now() - entry.timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch (e) {
    return null;
  }
};

const saveToCache = <T>(key: string, data: T) => {
  const entry: CacheEntry<T> = {
    timestamp: Date.now(),
    data
  };
  localStorage.setItem(key, JSON.stringify(entry));
};

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
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Weather fetch failed: ${response.statusText}`);
    
    const data = await response.json();
    const current = data.current;

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
    console.error('Weather Service Error:', error);
    throw error;
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
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`Forecast fetch failed: ${response.statusText}`);
    
    const data = await response.json();
    const hourly = data.hourly;

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
    console.error('Forecast Service Error:', error);
    throw error;
  }
};

export const getMockForecastData = (): ForecastItem[] => {
    return [];
};
