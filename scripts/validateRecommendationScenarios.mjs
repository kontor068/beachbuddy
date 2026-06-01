import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\n', filename);
    return;
  }

  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const {
  Accessibility,
  WindDirection,
} = require('../types.ts');
const {
  calculateBeachScore,
  getSuitableBeaches,
  hasHourlyRainRisk,
} = require('../services/recommendationService.ts');
const {
  calculateSeaConditionScore,
  hasPoorSeaConditions,
} = require('../utils/seaConditions.ts');
const {
  degToCompass,
  getBeaufortLevel,
} = require('../utils/weatherUtils.ts');

const scenarios = {
  Milos_N_3BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 4.7,
    windGustMs: 6.8,
    waveHeightM: 0.3,
    waveDirectionDeg: 0,
  },
  Milos_RAIN_3BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 4.7,
    windGustMs: 6.8,
    waveHeightM: 0.3,
    waveDirectionDeg: 0,
    rainyHours: [10, 12, 14, 16, 18],
  },
  Milos_N_4BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 5.8,
    windGustMs: 8.0,
    waveHeightM: 0.4,
    waveDirectionDeg: 0,
  },
  Milos_N_5BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 9.8,
    windGustMs: 13.5,
    waveHeightM: 1.5,
    waveDirectionDeg: 0,
  },
  Milos_S_5BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 180,
    windSpeedMs: 9.5,
    windGustMs: 13.0,
    waveHeightM: 1.4,
    waveDirectionDeg: 180,
  },
  Paros_N_5BFT: {
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 9.5,
    windGustMs: 13.0,
    waveHeightM: 1.4,
    waveDirectionDeg: 0,
  },
  Andros_N_5BFT: {
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 10.0,
    windGustMs: 14.0,
    waveHeightM: 1.8,
    waveDirectionDeg: 0,
  },
};

const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;
const MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE = 5;
const badRoadAccessTypes = new Set(['4x4_only', 'hiking_path_difficult']);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const hasBadRoadAccess = beach => (
  beach.accessibility === Accessibility.DIFFICULT ||
  badRoadAccessTypes.has(beach.metadata?.access?.type || '')
);

const exposurePriority = item => {
  if (item.exposureLevel === 'protected' && item.canClaimWindProtection === true) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

const bestShelteredRecommendationGroup = items => {
  const protectedItems = items.filter(item => exposurePriority(item) === 0);
  if (protectedItems.length > 0) return protectedItems;

  const partialItems = items.filter(item => exposurePriority(item) === 1);
  if (partialItems.length > 0) return partialItems;

  return [];
};

const hasBlockingSuitableWarning = item => item.warnings?.some(warning =>
  warning.severity === 'critical' ||
  warning.type === 'rough_sea' ||
  warning.type === 'wind_sport_spot' ||
  (warning.type === 'exposed_to_wind' && item.exposureLevel === 'exposed')
);

const hasFallbackExclusion = item => item.warnings?.some(warning =>
  warning.type === 'wind_sport_spot' ||
  (warning.type === 'exposed_to_wind' && item.exposureLevel === 'exposed')
);

const isStrongSuitableCandidate = (item, windSpeedKmph, fallbackWaveHeightM) => {
  const waveHeightM = item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, waveHeightM);

  return !hasBadRoadAccess(item.beach) &&
    item.score >= 60 &&
    item.swimmingComfort !== 'avoid_swimming' &&
    seaScore >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE &&
    !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, waveHeightM) &&
    !hasBlockingSuitableWarning(item);
};

const isNoIdealFallbackCandidate = (item, windSpeedKmph, fallbackWaveHeightM) => {
  const waveHeightM = item.waveHeightM ?? fallbackWaveHeightM;
  const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, waveHeightM);

  return !hasBadRoadAccess(item.beach) &&
    item.exposureLevel !== 'exposed' &&
    seaScore >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE &&
    !hasFallbackExclusion(item);
};

const toDateKey = date => date.toISOString().slice(0, 10);
const getSwellHeight = waveHeightM => Number(Math.max(0.2, waveHeightM * 0.35).toFixed(2));

const createForecastItem = (date, hour, scenario) => {
  const itemDate = new Date(date);
  itemDate.setHours(hour, 0, 0, 0);
  const isRainy = scenario.rainyHours?.includes(hour) === true;

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
    weather: [{
      id: isRainy ? 500 : 800,
      main: isRainy ? 'Rain' : 'Clear',
      description: isRainy ? 'light rain' : 'clear sky',
      icon: isRainy ? '10d' : '01d',
    }],
    clouds: { all: isRainy ? 75 : 5 },
    wind: {
      speed: scenario.windSpeedMs,
      deg: scenario.windDirectionDeg,
      gust: scenario.windGustMs,
    },
    visibility: 10000,
    pop: isRainy ? 0.85 : 0,
    rain: isRainy ? { '3h': 0.8 } : undefined,
    sys: { pod: 'd' },
    dt_txt: `${toDateKey(itemDate)} ${String(hour).padStart(2, '0')}:00:00`,
    marine: {
      waveHeightM: scenario.waveHeightM,
      waveDirectionDeg: scenario.waveDirectionDeg,
      wavePeriodS: scenario.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: getSwellHeight(scenario.waveHeightM),
      swellWaveDirectionDeg: scenario.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };
};

const createDailyForecast = scenario => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  const hourly = [8, 10, 12, 14, 16, 18, 20].map(hour => createForecastItem(date, hour, scenario));
  const hasRain = hourly.some(hasHourlyRainRisk);

  return {
    date,
    wind: {
      speed: scenario.windSpeedMs,
      deg: scenario.windDirectionDeg,
      gust: scenario.windGustMs,
    },
    weather: {
      main: hasRain ? 'Rain' : 'Clear',
      description: hasRain ? 'light rain' : 'clear sky',
      icon: hasRain ? '10d' : '01d',
    },
    temp_min: 22,
    temp_max: 26,
    hourly,
    marine: {
      waveHeightM: scenario.waveHeightM,
      waveDirectionDeg: scenario.waveDirectionDeg,
      wavePeriodS: scenario.waveHeightM >= 1 ? 5 : 4,
      swellWaveHeightM: getSwellHeight(scenario.waveHeightM),
      swellWaveDirectionDeg: scenario.waveDirectionDeg,
      seaSurfaceTemperatureC: 23,
      source: 'open-meteo-marine',
    },
  };
};

const beachName = beach => beach.name.gr || beach.name.en || String(beach.id);

const scoreAllBeaches = (beaches, forecast) => beaches.map(beach => {
  const score = calculateBeachScore(beach, forecast, undefined, undefined, {
    hourlyForecast: forecast.hourly,
  });
  const isExposed = score.exposureLevel ? score.exposureLevel !== 'protected' : true;

  return {
    beachId: beach.id,
    name: beachName(beach),
    score: score.score,
    beach: { ...beach, crowdLevel: score.crowdLevel, crowdScore: score.crowdScore },
    isExposed,
    exposureLevel: score.exposureLevel,
    waveHeightM: score.waveHeightM,
    warnings: score.warnings,
    confidence: score.confidence,
    swimmingComfort: score.swimmingComfort,
    canClaimWindProtection: score.canClaimWindProtection,
    seaCalmClaimAllowed: score.seaCalmClaimAllowed,
  };
});

const buildScenarioResult = scenario => {
  const dataPath = path.join(root, 'public', 'data', 'beaches', 'app', `${scenario.targetRegionId}.json`);
  const beaches = JSON.parse(readFileSync(dataPath, 'utf8')).island.beaches;
  const forecast = createDailyForecast(scenario);
  const windSpeedKmph = forecast.wind.speed * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmph);
  const waveHeightM = forecast.marine?.waveHeightM;
  const beachHours = forecast.hourly.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 10 && hour <= 18;
  });
  const allBeachHoursRainy = beachHours.length > 0 && beachHours.every(hasHourlyRainRisk);
  const dailySuitable = getSuitableBeaches(beaches, forecast, 'gr', undefined, forecast.hourly, undefined, {});
  const allScored = scoreAllBeaches(beaches, forecast).sort((a, b) => b.score - a.score);

  const recommendedSuitable = dailySuitable.filter(item => {
    const itemWaveHeightM = item.waveHeightM ?? waveHeightM;
    const seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
    const hasGoodHourlySea = typeof item.hourlySeaScore !== 'number' ||
      item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE;

    return !hasBadRoadAccess(item.beach) &&
      seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
      hasGoodHourlySea &&
      !hasPoorSeaConditions(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
  });

  const strongSuitable = bestShelteredRecommendationGroup(
    [...recommendedSuitable, ...dailySuitable]
      .filter((item, index, list) => list.findIndex(other => other.beach.id === item.beach.id) === index)
      .filter(item => isStrongSuitableCandidate(item, windSpeedKmph, waveHeightM))
  );

  const hasSevereWeather = beaufort >= 5 || (typeof waveHeightM === 'number' && waveHeightM >= 1);
  const hasNoIdealSwimming = hasSevereWeather && strongSuitable.length === 0;
  const lessExposedCandidates = allScored.filter(item =>
    (item.exposureLevel === 'protected' && item.canClaimWindProtection === true) ||
    item.exposureLevel === 'partial'
  );
  const noIdealFallback = bestShelteredRecommendationGroup(
    allScored
      .filter(item => isNoIdealFallbackCandidate(item, windSpeedKmph, waveHeightM))
      .sort((a, b) => exposurePriority(a) - exposurePriority(b) || b.score - a.score)
  );

  return {
    beaufort,
    windDirection: degToCompass(forecast.wind.deg),
    waveHeightM,
    dailySuitable,
    recommendedSuitable,
    strongSuitable,
    hasNoIdealSwimming,
    allBeachHoursRainy,
    lessExposedCandidates,
    noIdealFallback,
    allScored,
  };
};

const summarize = item => ({
  id: item.beach.id,
  name: beachName(item.beach),
  score: item.score,
  exposure: item.exposureLevel || 'unknown',
  comfort: item.swimmingComfort,
  warnings: (item.warnings || []).map(warning => `${warning.type}:${warning.severity}`).join(',') || '-',
});

const results = Object.fromEntries(
  Object.entries(scenarios).map(([id, scenario]) => [id, buildScenarioResult(scenario)])
);

assert(results.Milos_N_3BFT.dailySuitable.length > 0, 'Milos_N_3BFT should keep normal suitable beach behavior.');
assert(!results.Milos_N_3BFT.hasNoIdealSwimming, 'Milos_N_3BFT must not be treated as no-ideal swimming.');

assert(results.Milos_RAIN_3BFT.allBeachHoursRainy, 'Milos_RAIN_3BFT should mark all main beach hours as rainy.');
assert(results.Milos_RAIN_3BFT.dailySuitable.length === 0, 'Milos_RAIN_3BFT must not recommend beaches for swimming during rainy beach hours.');

assert(results.Milos_N_4BFT.dailySuitable.length > 0, 'Milos_N_4BFT should keep beach options available.');
assert(results.Milos_N_4BFT.lessExposedCandidates.length > 0, 'Milos_N_4BFT less exposed filter should not be empty.');
assert(results.Milos_N_4BFT.strongSuitable.length > 0, 'Milos_N_4BFT should have less exposed top candidates.');
assert(results.Milos_N_4BFT.strongSuitable[0].exposureLevel !== 'exposed', 'Milos_N_4BFT top candidate should not be exposed when less exposed options exist.');
assert(!results.Milos_N_4BFT.hasNoIdealSwimming, 'Milos_N_4BFT must not be treated as severe no-ideal weather.');

assert(results.Milos_N_5BFT.hasNoIdealSwimming, 'Milos_N_5BFT should be no-ideal swimming with current full scoring.');
assert(results.Milos_N_5BFT.strongSuitable.length === 0, 'Milos_N_5BFT must not expose fake Most suitable candidates.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => item.beach.id === 1736), 'Milos_N_5BFT fallback must not include Kapros.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => item.exposureLevel === 'exposed'), 'Milos_N_5BFT fallback must not include exposed beaches.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), 'Milos_N_5BFT fallback must not include wind-sport spots.');

assert(!results.Milos_S_5BFT.noIdealFallback.some(item => item.exposureLevel === 'exposed'), 'Milos_S_5BFT fallback must not include exposed beaches.');
assert(!results.Paros_N_5BFT.noIdealFallback.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), 'Paros_N_5BFT fallback must not include wind-sport spots.');
assert(!results.Andros_N_5BFT.noIdealFallback.some(item => item.exposureLevel === 'exposed'), 'Andros_N_5BFT fallback must not include exposed beaches.');

console.log('App Recommendation Scenario Validation');
Object.entries(results).forEach(([id, result]) => {
  console.log(`\n${id}: ${result.beaufort} Bft ${WindDirection[result.windDirection] || result.windDirection}, wave ${result.waveHeightM}m`);
  console.log(`dailySuitable=${result.dailySuitable.length}, strongSuitable=${result.strongSuitable.length}, lessExposed=${result.lessExposedCandidates.length}, noIdeal=${result.hasNoIdealSwimming}, rainBlocked=${result.allBeachHoursRainy}, fallback=${result.noIdealFallback.length}`);
  console.table((result.hasNoIdealSwimming ? result.noIdealFallback : result.strongSuitable).slice(0, 5).map(summarize));
});
console.log('\nRecommendation scenario validation passed.');
