import { DailyForecast, ForecastItem, Island, WeatherData } from '../types';

const LOCAL_FIXTURE_PARAM = 'bbWeatherFixture';

export interface WeatherFixtureScenario {
  id: string;
  label: string;
  targetRegionId?: string;
  windDirectionDeg: number;
  windSpeedMs: number;
  windGustMs: number;
  waveHeightM: number;
  waveDirectionDeg: number;
}

const SCENARIOS: Record<string, WeatherFixtureScenario> = {
  Paros_N_3BFT: {
    id: 'Paros_N_3BFT',
    label: 'Paros - North wind - 3 Bft',
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 4.5,
    windGustMs: 6.5,
    waveHeightM: 0.3,
    waveDirectionDeg: 0,
  },
  Paros_N_3BFT_CHOPPY: {
    id: 'Paros_N_3BFT_CHOPPY',
    label: 'Paros - North wind - 3 Bft with leftover/choppy sea',
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 4.5,
    windGustMs: 6.5,
    waveHeightM: 0.6,
    waveDirectionDeg: 0,
  },
  Paros_N_5BFT: {
    id: 'Paros_N_5BFT',
    label: 'Paros - North wind - 5 Bft',
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 9.5,
    windGustMs: 13.0,
    waveHeightM: 1.4,
    waveDirectionDeg: 0,
  },
  Andros_N_3BFT: {
    id: 'Andros_N_3BFT',
    label: 'Andros - North wind - 3 Bft',
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 4.8,
    windGustMs: 7.0,
    waveHeightM: 0.35,
    waveDirectionDeg: 0,
  },
  Andros_N_3BFT_CHOPPY: {
    id: 'Andros_N_3BFT_CHOPPY',
    label: 'Andros - North wind - 3 Bft with leftover/choppy sea',
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 4.8,
    windGustMs: 7.0,
    waveHeightM: 0.7,
    waveDirectionDeg: 0,
  },
  Andros_N_5BFT: {
    id: 'Andros_N_5BFT',
    label: 'Andros - North wind - 5 Bft',
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 10.0,
    windGustMs: 14.0,
    waveHeightM: 1.8,
    waveDirectionDeg: 0,
  },
  Milos_N_3BFT: {
    id: 'Milos_N_3BFT',
    label: 'Milos - North wind - 3 Bft',
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 4.7,
    windGustMs: 6.8,
    waveHeightM: 0.3,
    waveDirectionDeg: 0,
  },
  Milos_N_3BFT_CHOPPY: {
    id: 'Milos_N_3BFT_CHOPPY',
    label: 'Milos - North wind - 3 Bft with leftover/choppy sea',
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 4.7,
    windGustMs: 7.0,
    waveHeightM: 0.7,
    waveDirectionDeg: 0,
  },
  Milos_N_5BFT: {
    id: 'Milos_N_5BFT',
    label: 'Milos - North wind - 5 Bft',
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 9.8,
    windGustMs: 13.5,
    waveHeightM: 1.5,
    waveDirectionDeg: 0,
  },
  Milos_S_5BFT: {
    id: 'Milos_S_5BFT',
    label: 'Milos - South wind - 5 Bft',
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 180,
    windSpeedMs: 9.5,
    windGustMs: 13.0,
    waveHeightM: 1.4,
    waveDirectionDeg: 180,
  },
  Unknown_Profile_N_5BFT: {
    id: 'Unknown_Profile_N_5BFT',
    label: 'Unknown profile - North wind - 5 Bft',
    windDirectionDeg: 0,
    windSpeedMs: 9.5,
    windGustMs: 13.5,
    waveHeightM: 1.6,
    waveDirectionDeg: 0,
  },
  windy4: {
    id: 'windy4',
    label: 'Legacy windy north fixture - 4 Bft',
    windDirectionDeg: 0,
    windSpeedMs: 6.2,
    windGustMs: 7.75,
    waveHeightM: 0.75,
    waveDirectionDeg: 0,
  },
};

const isLocalHost = () => {
  if (typeof window === 'undefined') return false;
  return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(window.location.hostname);
};

export const getActiveWeatherFixtureScenario = (): WeatherFixtureScenario | null => {
  if (!import.meta.env.DEV || !isLocalHost()) return null;
  const scenarioId = new URLSearchParams(window.location.search).get(LOCAL_FIXTURE_PARAM);
  if (!scenarioId) return null;
  return SCENARIOS[scenarioId] || null;
};

export const getActiveWeatherFixtureTargetRegionId = (): string | undefined => (
  getActiveWeatherFixtureScenario()?.targetRegionId
);

const toDateKey = (date: Date) => date.toISOString().slice(0, 10);

const getSwellHeight = (scenario: WeatherFixtureScenario): number => (
  Number(Math.max(0.2, scenario.waveHeightM * 0.35).toFixed(2))
);

const createForecastItem = (date: Date, hour: number, scenario: WeatherFixtureScenario): ForecastItem => {
  const itemDate = new Date(date);
  itemDate.setHours(hour, 0, 0, 0);

  return {
    dt: Math.floor(itemDate.getTime() / 1000),
    main: {
      temp: hour < 10 || hour > 18 ? 23 : 26,
      temp_min: 22,
      temp_max: 26,
      pressure: 1014,
      sea_level: 1014,
      grnd_level: 1014,
      humidity: 58,
      temp_kf: 0,
    },
    weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
    clouds: { all: 5 },
    wind: {
      speed: scenario.windSpeedMs,
      deg: scenario.windDirectionDeg,
      gust: scenario.windGustMs,
    },
    visibility: 10000,
    pop: 0,
    sys: { pod: 'd' },
    dt_txt: `${toDateKey(itemDate)} ${String(hour).padStart(2, '0')}:00:00`,
    marine: {
      waveHeightM: scenario.waveHeightM,
      waveDirectionDeg: scenario.waveDirectionDeg,
      wavePeriodS: scenario.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: getSwellHeight(scenario),
      swellWaveDirectionDeg: scenario.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };
};

const createDailyForecast = (dayOffset: number, scenario: WeatherFixtureScenario): DailyForecast => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(12, 0, 0, 0);

  const hourly = [8, 10, 12, 14, 16, 18, 20].map(hour => createForecastItem(date, hour, scenario));

  return {
    date,
    wind: {
      speed: scenario.windSpeedMs,
      deg: scenario.windDirectionDeg,
      gust: scenario.windGustMs,
    },
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    temp_min: 22,
    temp_max: 26,
    hourly,
    marine: {
      waveHeightM: scenario.waveHeightM,
      waveDirectionDeg: scenario.waveDirectionDeg,
      wavePeriodS: scenario.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: getSwellHeight(scenario),
      swellWaveDirectionDeg: scenario.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };
};

export const getLocalWeatherFixture = (
  selectedIsland: Island | undefined
): { weather: WeatherData; forecast: DailyForecast[]; scenario: WeatherFixtureScenario } | null => {
  const scenario = getActiveWeatherFixtureScenario();
  if (!selectedIsland || !scenario) return null;

  const weather: WeatherData = {
    wind: {
      speed: scenario.windSpeedMs,
      deg: scenario.windDirectionDeg,
      gust: scenario.windGustMs,
    },
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    main: { temp: 25 },
    marine: {
      waveHeightM: scenario.waveHeightM,
      waveDirectionDeg: scenario.waveDirectionDeg,
      wavePeriodS: scenario.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: getSwellHeight(scenario),
      swellWaveDirectionDeg: scenario.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };

  return {
    weather,
    forecast: Array.from({ length: 6 }, (_, index) => createDailyForecast(index, scenario)),
    scenario,
  };
};
