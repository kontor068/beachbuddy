import { DailyForecast, ForecastItem, Island, WeatherData } from '../types';

const LOCAL_FIXTURE_PARAM = 'bbWeatherFixture';

/** Per-day override for multi-day scenarios (trip-planner testing needs a
 *  rotating wind — a single repeated day can never exercise it). */
export interface WeatherFixtureDay {
  windDirectionDeg: number;
  windSpeedMs: number;
  windGustMs: number;
  waveHeightM: number;
  waveDirectionDeg: number;
  /**
   * Optional per-hour wind (m/s). Every other fixture holds one speed from
   * 08:00 to 20:00, which cannot exercise anything that depends on the wind
   * CHANGING through the day — the planner's best-time window, the afternoon
   * build escalation, the hour slider. Give this to test those.
   */
  hourlyWindMs?: (hour: number) => number;
}

export interface WeatherFixtureScenario {
  id: string;
  label: string;
  targetRegionId?: string;
  windDirectionDeg: number;
  windSpeedMs: number;
  windGustMs: number;
  waveHeightM: number;
  waveDirectionDeg: number;
  /** Optional per-day rotation; day N uses days[N], falling back to the base
   *  fields above when absent. DEV/localhost fixtures only — never production. */
  days?: WeatherFixtureDay[];
  /** Base-level per-hour wind, and the merged value resolveFixtureDay produces
   *  when the chosen day carries one. See WeatherFixtureDay.hourlyWindMs. */
  hourlyWindMs?: (hour: number) => number;
}

/** The trip's day-N conditions: the per-day override when present, else the base. */
const resolveFixtureDay = (scenario: WeatherFixtureScenario, dayOffset: number): WeatherFixtureScenario => (
  scenario.days?.[dayOffset] ? { ...scenario, ...scenario.days[dayOffset] } : scenario
);

// The rotation the planner exists for: two hard meltemi days, a lighter NE day,
// a southerly flip, a SW day, then the meltemi returns. Exercises side-flipping,
// the caution tier and provisional days in one URL.
const MELTEMI_WEEK_DAYS: WeatherFixtureDay[] = [
  { windDirectionDeg: 0, windSpeedMs: 9.5, windGustMs: 13.0, waveHeightM: 1.4, waveDirectionDeg: 0 },   // N 5 Bft
  { windDirectionDeg: 0, windSpeedMs: 12.5, windGustMs: 17.0, waveHeightM: 2.0, waveDirectionDeg: 0 },  // N 6 Bft
  { windDirectionDeg: 45, windSpeedMs: 6.5, windGustMs: 9.0, waveHeightM: 0.7, waveDirectionDeg: 45 },  // NE 4 Bft
  { windDirectionDeg: 180, windSpeedMs: 4.5, windGustMs: 6.5, waveHeightM: 0.3, waveDirectionDeg: 180 },// S 3 Bft
  { windDirectionDeg: 225, windSpeedMs: 6.5, windGustMs: 9.0, waveHeightM: 0.6, waveDirectionDeg: 225 },// SW 4 Bft
  { windDirectionDeg: 0, windSpeedMs: 9.5, windGustMs: 13.0, waveHeightM: 1.4, waveDirectionDeg: 0 },   // N 5 Bft
];

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
  // Trip-planner rotations: base fields = day 0, so non-planner surfaces (current
  // conditions, header) stay coherent with the plan's first day.
  // Quiet morning, meltemi filling in after lunch — the only shape here where
  // the HOUR of the visit matters, and the one that exercises the planner's
  // best-time window ("better 10:00-14:00, it freshens after that").
  Naxos_AFTERNOON_BUILD: {
    id: 'Naxos_AFTERNOON_BUILD',
    label: 'Naxos - calm morning, afternoon meltemi (best-time window)',
    targetRegionId: 'south-aegean-naxos',
    windDirectionDeg: 0,
    windSpeedMs: 9.0,
    windGustMs: 12.0,
    waveHeightM: 0.5,
    waveDirectionDeg: 0,
    days: Array.from({ length: 6 }, () => ({
      windDirectionDeg: 0,
      windSpeedMs: 9.0,
      windGustMs: 12.0,
      waveHeightM: 0.5,
      waveDirectionDeg: 0,
      hourlyWindMs: (hour: number) => (hour <= 12 ? 3.2 : 9.0),
    })),
  },
  Naxos_MELTEMI_WEEK: {
    id: 'Naxos_MELTEMI_WEEK',
    label: 'Naxos - rotating meltemi week (N5, N6, NE4, S3, SW4, N5)',
    targetRegionId: 'south-aegean-naxos',
    ...MELTEMI_WEEK_DAYS[0],
    days: MELTEMI_WEEK_DAYS,
  },
  Halkidiki_MELTEMI_WEEK: {
    id: 'Halkidiki_MELTEMI_WEEK',
    label: 'Halkidiki - rotating meltemi week (N5, N6, NE4, S3, SW4, N5)',
    targetRegionId: 'central-macedonia-halkidiki-mainland',
    ...MELTEMI_WEEK_DAYS[0],
    days: MELTEMI_WEEK_DAYS,
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
    // Per-hour wind when the fixture defines a shape (WeatherFixtureDay
    // .hourlyWindMs), flat otherwise — so a fixture can exercise anything that
    // depends on the wind changing through the day (best-time window, the
    // afternoon build, the hour slider).
    wind: {
      speed: scenario.hourlyWindMs ? scenario.hourlyWindMs(hour) : scenario.windSpeedMs,
      deg: scenario.windDirectionDeg,
      gust: (scenario.hourlyWindMs ? scenario.hourlyWindMs(hour) : scenario.windSpeedMs) * 1.35,
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
  const day = resolveFixtureDay(scenario, dayOffset);
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(12, 0, 0, 0);

  const hourly = [8, 10, 12, 14, 16, 18, 20].map(hour => createForecastItem(date, hour, day));

  return {
    date,
    wind: {
      speed: day.windSpeedMs,
      deg: day.windDirectionDeg,
      gust: day.windGustMs,
    },
    weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    temp_min: 22,
    temp_max: 26,
    hourly,
    marine: {
      waveHeightM: day.waveHeightM,
      waveDirectionDeg: day.waveDirectionDeg,
      wavePeriodS: day.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: getSwellHeight(day),
      swellWaveDirectionDeg: day.waveDirectionDeg,
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
