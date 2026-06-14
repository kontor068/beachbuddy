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
  getTopRecommendedBeaches,
  getTopRecommendationDisplayLimit,
  getSuitableBeaches,
  hasHourlyRainRisk,
  isTrustedTopRecommendationCandidate,
} = require('../services/recommendationService.ts');
const {
  calculateSeaConditionScore,
  hasPoorSeaConditions,
} = require('../utils/seaConditions.ts');
const {
  degToCompass,
  getBeaufortLevel,
} = require('../utils/weatherUtils.ts');
const {
  hasMainstreamTopPickAccess,
} = require('../utils/access.ts');

const windSectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const scenarios = {
  Paros_N_3BFT: {
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 4.5,
    windGustMs: 6.5,
    waveHeightM: 0.3,
    waveDirectionDeg: 0,
  },
  Paros_N_3BFT_CHOPPY: {
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 4.5,
    windGustMs: 6.5,
    waveHeightM: 0.6,
    waveDirectionDeg: 0,
  },
  Paros_N_5BFT: {
    targetRegionId: 'south-aegean-paros',
    windDirectionDeg: 0,
    windSpeedMs: 9.5,
    windGustMs: 13.0,
    waveHeightM: 1.4,
    waveDirectionDeg: 0,
  },
  Andros_N_3BFT: {
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 4.8,
    windGustMs: 7.0,
    waveHeightM: 0.35,
    waveDirectionDeg: 0,
  },
  Andros_N_3BFT_CHOPPY: {
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 4.8,
    windGustMs: 7.0,
    waveHeightM: 0.7,
    waveDirectionDeg: 0,
  },
  Naxos_N_3BFT: {
    targetRegionId: 'south-aegean-naxos',
    windDirectionDeg: 0,
    windSpeedMs: 4.8,
    windGustMs: 7.0,
    waveHeightM: 0.35,
    waveDirectionDeg: 0,
  },
  Naxos_N_5BFT: {
    targetRegionId: 'south-aegean-naxos',
    windDirectionDeg: 0,
    windSpeedMs: 9.8,
    windGustMs: 13.5,
    waveHeightM: 1.5,
    waveDirectionDeg: 0,
  },
  Naxos_W_4BFT: {
    targetRegionId: 'south-aegean-naxos',
    windDirectionDeg: 270,
    windSpeedMs: 6.2,
    windGustMs: 8.5,
    waveHeightM: 0.5,
    waveDirectionDeg: 270,
  },
  // Genuine meltemi at 4 Bft north: the false-protected trap. At this strength the
  // only surviving Naxos pick (Ψιλή Άμμος, ESE quartering) degrades to caution while
  // still being surfaced as #1. Pre-registered for the best-available-shelter gate.
  Naxos_N_4BFT: {
    targetRegionId: 'south-aegean-naxos',
    windDirectionDeg: 0,
    windSpeedMs: 5.8,
    windGustMs: 8.0,
    waveHeightM: 0.4,
    waveDirectionDeg: 0,
  },
  Naxos_S_4BFT: {
    targetRegionId: 'south-aegean-naxos',
    windDirectionDeg: 180,
    windSpeedMs: 6.2,
    windGustMs: 8.5,
    waveHeightM: 0.5,
    waveDirectionDeg: 180,
  },
  Andros_N_5BFT: {
    targetRegionId: 'south-aegean-andros',
    windDirectionDeg: 0,
    windSpeedMs: 10.0,
    windGustMs: 14.0,
    waveHeightM: 1.8,
    waveDirectionDeg: 0,
  },
  Milos_N_3BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 4.7,
    windGustMs: 6.8,
    waveHeightM: 0.3,
    waveDirectionDeg: 0,
  },
  Milos_N_3BFT_CHOPPY: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 0,
    windSpeedMs: 4.7,
    windGustMs: 7.0,
    waveHeightM: 0.7,
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
  Milos_SW_4BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 225,
    windSpeedMs: 6.2,
    windGustMs: 8.5,
    waveHeightM: 0.5,
    waveDirectionDeg: 225,
  },
  Milos_S_4BFT: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 180,
    windSpeedMs: 6.2,
    windGustMs: 8.5,
    waveHeightM: 0.5,
    waveDirectionDeg: 180,
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
};

const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;
const MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE = 5;
const badRoadAccessTypes = new Set(['4x4_only', 'hiking_path_difficult']);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// min(3, qualified): show up to 3, capped only by how many cleared the Tier 0 gate.
[
  [0, 0],
  [1, 1],
  [2, 2],
  [3, 3],
  [5, 3],
  [6, 3],
  [8, 3],
  [9, 3],
  [20, 3],
].forEach(([input, expected]) => {
  const actual = getTopRecommendationDisplayLimit(input);
  assert(actual === expected, `Top recommendation limit ${input} expected ${expected}, received ${actual}.`);
});

const normalizeText = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const beachNameMatches = (item, pattern) => {
  const beach = item.beach || item;
  return pattern.test(normalizeText(`${beach.name?.en || ''} ${beach.name?.gr || ''}`));
};

const findByName = (items, pattern) => items.find(item => beachNameMatches(item, pattern));

const hasWarning = (item, predicate) => (item.warnings || []).some(predicate);

const hasHardMildScenarioWarning = item => hasWarning(item, warning =>
  warning.severity === 'critical' ||
  warning.type === 'strong_wind' ||
  (warning.type === 'rough_sea' && warning.severity !== 'info') ||
  (warning.type === 'wind_sport_spot' && warning.severity !== 'info')
);

const hasBadRoadAccess = beach => (
  beach.accessibility === Accessibility.DIFFICULT ||
  badRoadAccessTypes.has(beach.metadata?.access?.type || '')
);

const hasMainstreamTopRecommendationAccess = item => hasMainstreamTopPickAccess(item.beach || item);

const exposurePriority = item => {
  if (item.exposureLevel === 'protected' && item.canClaimWindProtection === true) return 0;
  if (item.exposureLevel === 'partial') return 1;
  return 2;
};

const visibleTopRecommendationPriority = item => (
  item.exposureLevel === 'protected' && item.canClaimWindProtection === false ? 1 : exposurePriority(item)
);

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

const isUsableGeneratedProfile = profile => {
  const levels = windSectors.map(sector => profile.sectors?.[sector]?.level);
  if (levels.some(level => !level)) return false;

  const allProtected = levels.every(level => level === 'protected');
  if (allProtected && (profile.facingDeg === null || profile.facingDeg === undefined)) return false;

  return true;
};

const loadGeospatialProfiles = regionId => {
  const dataPath = path.join(root, 'public', 'data', 'geospatial', 'exposure', `${regionId}.json`);
  const payload = JSON.parse(readFileSync(dataPath, 'utf8'));

  return Object.values(payload.profiles || {}).reduce((lookup, profile) => {
    if (!profile.beachId || !profile.sectors || !isUsableGeneratedProfile(profile)) return lookup;

    lookup[profile.beachId] = {
      beachId: profile.beachId,
      facingDeg: profile.facingDeg ?? null,
      sectors: profile.sectors,
      confidence: profile.confidence,
      source: profile.confidence === 'high' ? 'high-res-coastline' : 'natural-earth-baseline',
    };
    return lookup;
  }, {});
};

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

const scoreAllBeaches = (beaches, forecast, geospatialProfiles) => beaches.map(beach => {
  const score = calculateBeachScore(beach, forecast, undefined, undefined, {
    hourlyForecast: forecast.hourly,
    geospatialProfile: geospatialProfiles?.[beach.id],
  });
  const isExposed = score.exposureLevel ? score.exposureLevel !== 'protected' : true;

  return {
    beachId: beach.id,
    name: beachName(beach),
    score: score.score,
    swimmingScore: score.swimmingScore,
    beach: { ...beach, crowdLevel: score.crowdLevel, crowdScore: score.crowdScore },
    isExposed,
    exposureLevel: score.exposureLevel,
    waveHeightM: score.waveHeightM,
    warnings: score.warnings,
    confidence: score.confidence,
    swimmingComfort: score.swimmingComfort,
    hourlySeaScore: score.hourlySeaScore,
    windProfile: score.windProfile,
    windProfileSource: score.windProfileSource,
    windSector: score.windSector,
    canClaimWindProtection: score.canClaimWindProtection,
    seaCalmClaimAllowed: score.seaCalmClaimAllowed,
    geospatialExposure: geospatialProfiles?.[beach.id],
  };
});

const addSurfaceConsistencyMismatch = (mismatches, scenarioId, surface, beach, field, expected, actual) => {
  mismatches.push({
    scenarioId,
    surface,
    beachId: beach.id,
    beachName: beachName(beach),
    field,
    expected,
    actual,
  });
};

const compareRecommendationSurface = (mismatches, scenarioId, surface, item, directItem) => {
  const beach = item.beach || directItem?.beach;
  if (!beach || !directItem) {
    addSurfaceConsistencyMismatch(mismatches, scenarioId, surface, beach || { id: item.beachId, name: item.name }, 'directScore', 'present', 'missing');
    return;
  }

  const fields = [
    'score',
    'exposureLevel',
    'swimmingComfort',
    'canClaimWindProtection',
    'seaCalmClaimAllowed',
  ];

  fields.forEach(field => {
    if (item[field] !== directItem[field]) {
      addSurfaceConsistencyMismatch(mismatches, scenarioId, surface, beach, field, directItem[field], item[field]);
    }
  });
};

const buildSurfaceConsistencyMismatches = (scenarioId, forecast, geospatialProfiles, topRecommendations, dailySuitable, allScored) => {
  const mismatches = [];
  const directById = new Map(allScored.map(item => [item.beach.id, item]));

  topRecommendations.forEach(item => {
    compareRecommendationSurface(mismatches, scenarioId, 'topRecommendations', item, directById.get(item.beach.id));

    const detailScore = calculateBeachScore(item.beach, forecast, undefined, undefined, {
      hourlyForecast: forecast.hourly,
      geospatialProfile: geospatialProfiles?.[item.beach.id],
    });
    compareRecommendationSurface(mismatches, scenarioId, 'detailScore', {
      beach: item.beach,
      score: detailScore.score,
      exposureLevel: detailScore.exposureLevel,
      swimmingComfort: detailScore.swimmingComfort,
      canClaimWindProtection: detailScore.canClaimWindProtection,
      seaCalmClaimAllowed: detailScore.seaCalmClaimAllowed,
    }, directById.get(item.beach.id));
  });

  dailySuitable.forEach(item => {
    compareRecommendationSurface(mismatches, scenarioId, 'dailySuitable', item, directById.get(item.beach.id));
    if (geospatialProfiles?.[item.beach.id] && item.geospatialExposure?.beachId !== item.beach.id) {
      addSurfaceConsistencyMismatch(
        mismatches,
        scenarioId,
        'dailySuitable',
        item.beach,
        'geospatialExposure',
        item.beach.id,
        item.geospatialExposure?.beachId
      );
    }
  });

  return mismatches;
};

const buildScenarioResult = scenario => {
  const dataPath = path.join(root, 'public', 'data', 'beaches', 'app', `${scenario.targetRegionId}.json`);
  const beaches = JSON.parse(readFileSync(dataPath, 'utf8')).island.beaches;
  const beachById = new Map(beaches.map(beach => [beach.id, beach]));
  const geospatialProfiles = loadGeospatialProfiles(scenario.targetRegionId);
  const forecast = createDailyForecast(scenario);
  const windSpeedKmph = forecast.wind.speed * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmph);
  const waveHeightM = forecast.marine?.waveHeightM;
  const beachHours = forecast.hourly.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 10 && hour <= 18;
  });
  const allBeachHoursRainy = beachHours.length > 0 && beachHours.every(hasHourlyRainRisk);
  const topRecommendations = getTopRecommendedBeaches(
    beaches,
    forecast,
    undefined,
    forecast.hourly,
    undefined,
    'gr',
    undefined,
    geospatialProfiles
  ).map(item => ({
    ...item,
    beach: beachById.get(item.beachId),
    isExposed: item.exposureLevel ? item.exposureLevel !== 'protected' : true,
  })).filter(item => Boolean(item.beach));
  const dailySuitable = getSuitableBeaches(beaches, forecast, 'gr', undefined, forecast.hourly, undefined, undefined, geospatialProfiles);
  const allScored = scoreAllBeaches(beaches, forecast, geospatialProfiles).sort((a, b) => b.score - a.score);
  const surfaceConsistencyMismatches = buildSurfaceConsistencyMismatches(
    scenario.targetRegionId,
    forecast,
    geospatialProfiles,
    topRecommendations,
    dailySuitable,
    allScored
  );

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
  const qualifiedTopCandidates = allScored.filter(item => {
    if (!isTrustedTopRecommendationCandidate(item, beachById, beaufort)) return false;
    if (item.swimmingComfort === 'avoid_swimming') return false;
    if (item.warnings?.some(warning => warning.type === 'official_warning' && warning.severity === 'critical')) return false;
    if (typeof item.swimmingScore === 'number' && item.swimmingScore < 50) return false;

    const itemWaveHeightM = item.waveHeightM ?? waveHeightM;
    let seaScore = calculateSeaConditionScore(item.isExposed, windSpeedKmph, item.exposureLevel, itemWaveHeightM);
    if (beaufort <= 3 && (item.waveHeightM === undefined || item.waveHeightM <= 0.5)) {
      const lightWindFloor = item.exposureLevel === 'protected' ? 9 : item.exposureLevel === 'partial' ? 8 : 7;
      seaScore = Math.max(seaScore, lightWindFloor);
    }

    return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
      (typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE);
  });
  const prioritizedQualifiedTopCandidates = (() => {
    if (beaufort < 3 || qualifiedTopCandidates.length === 0) return qualifiedTopCandidates;

    const bestPriority = Math.min(...qualifiedTopCandidates.map(visibleTopRecommendationPriority));
    return qualifiedTopCandidates.filter(item => visibleTopRecommendationPriority(item) === bestPriority);
  })();

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
    topRecommendations,
    dailySuitable,
    recommendedSuitable,
    qualifiedTopCandidateCount: prioritizedQualifiedTopCandidates.length,
    strongSuitable,
    hasNoIdealSwimming,
    allBeachHoursRainy,
    lessExposedCandidates,
    noIdealFallback,
    allScored,
    surfaceConsistencyMismatches,
    geospatialProfileCount: Object.keys(geospatialProfiles).length,
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

Object.entries(results).forEach(([id, result]) => {
  assert(
    result.surfaceConsistencyMismatches.length === 0,
    `${id} has recommendation surface scoring mismatches:\n${JSON.stringify(result.surfaceConsistencyMismatches.slice(0, 10), null, 2)}`
  );
});

const assertMildScenario = id => {
  const result = results[id];
  const expectedTopCount = getTopRecommendationDisplayLimit(result.qualifiedTopCandidateCount);
  assert(expectedTopCount > 0, `${id} should keep top recommendations available.`);
  assert(
    result.topRecommendations.length === expectedTopCount,
    `${id} should show ${expectedTopCount} proportional top recommendations for ${result.qualifiedTopCandidateCount} qualified candidates, received ${result.topRecommendations.length}.`
  );
  assert(result.dailySuitable.length > 0, `${id} should keep normal suitable beach behavior.`);
  assert(result.strongSuitable.length > 0, `${id} should keep usable candidate recommendations.`);
  assert(!result.hasNoIdealSwimming, `${id} must not be treated as no-ideal swimming.`);
  assert(!result.topRecommendations.some(hasHardMildScenarioWarning), `${id} top recommendations must not show hard wind/sea warnings.`);
  assert(!result.topRecommendations.some(item => item.swimmingComfort === 'avoid_swimming'), `${id} top recommendations must not be avoid-swimming.`);
  assert(result.topRecommendations.every(hasMainstreamTopRecommendationAccess), `${id} top recommendations must only use easy-access mainstream beaches.`);
  assert(!result.strongSuitable.slice(0, 5).some(hasHardMildScenarioWarning), `${id} top candidates must not show hard wind/sea warnings.`);
  assert(!result.strongSuitable.slice(0, 5).some(item => item.swimmingComfort === 'avoid_swimming'), `${id} top candidates must not be avoid-swimming.`);
};

const assertCautionScenario = id => {
  const result = results[id];
  assert(result.dailySuitable.length > 0, `${id} should keep some suitable beach options available.`);
  assert(result.strongSuitable.length > 0, `${id} should keep less exposed / more manageable candidates available.`);
  assert(result.lessExposedCandidates.length > 0, `${id} less exposed filter should not be empty.`);
  assert(!result.hasNoIdealSwimming, `${id} must not be treated as no-ideal swimming.`);
  assert(!result.strongSuitable.some(item => item.exposureLevel === 'exposed'), `${id} strong candidates must not include exposed beaches when less exposed options exist.`);
  assert(!result.strongSuitable.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), `${id} strong candidates must not include wind-sport spots.`);
  assert(!result.topRecommendations.some(hasHardMildScenarioWarning), `${id} top recommendations must not show hard wind/sea warnings.`);
  assert(!result.topRecommendations.some(item => item.swimmingComfort === 'avoid_swimming'), `${id} top recommendations must not be avoid-swimming.`);
  assert(!result.topRecommendations.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), `${id} top recommendations must not include wind-sport spots.`);
};

const assertNoIdealScenario = id => {
  const result = results[id];
  assert(result.hasNoIdealSwimming, `${id} should be no-ideal swimming with current full scoring.`);
  assert(result.topRecommendations.length === 0, `${id} must not expose fake top recommendations.`);
  assert(result.strongSuitable.length === 0, `${id} must not expose fake Most suitable candidates.`);
  assert(!result.noIdealFallback.some(item => item.exposureLevel === 'exposed'), `${id} fallback must not include exposed beaches.`);
  assert(!result.noIdealFallback.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), `${id} fallback must not include wind-sport spots.`);
};

[
  'Paros_N_3BFT',
  'Paros_N_3BFT_CHOPPY',
  'Andros_N_3BFT',
  'Andros_N_3BFT_CHOPPY',
  'Naxos_N_3BFT',
  'Milos_N_3BFT',
  'Milos_N_3BFT_CHOPPY',
].forEach(assertMildScenario);

[
  'Naxos_W_4BFT',
  'Naxos_S_4BFT',
  'Milos_N_4BFT',
  'Milos_SW_4BFT',
  'Milos_S_4BFT',
].forEach(assertCautionScenario);

[
  'Paros_N_5BFT',
  'Andros_N_5BFT',
  'Naxos_N_5BFT',
  'Milos_N_5BFT',
  'Milos_S_5BFT',
].forEach(assertNoIdealScenario);

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
assert(results.Milos_N_5BFT.topRecommendations.length === 0, 'Milos_N_5BFT must not expose fake top recommendations.');
assert(results.Milos_N_5BFT.strongSuitable.length === 0, 'Milos_N_5BFT must not expose fake Most suitable candidates.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => item.beach.id === 1908), 'Milos_N_5BFT fallback must not include Kapros.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => beachNameMatches(item, /sarakiniko|σαρα[\u03baκ]ηνι[\u03baκ]ο|papafragkas|παπαφραγ[\u03baκ]ας|achivadolimni|αχιβαδολιμνη/)), 'Milos_N_5BFT fallback must not include known north/open or wind-sport risk beaches.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => item.exposureLevel === 'exposed'), 'Milos_N_5BFT fallback must not include exposed beaches.');
assert(!results.Milos_N_5BFT.noIdealFallback.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), 'Milos_N_5BFT fallback must not include wind-sport spots.');

assert(!results.Naxos_N_5BFT.noIdealFallback.some(item => item.beach.id === 2006), 'Naxos_N_5BFT fallback must not include Mikri Vigla wind-sport area.');
assert(!results.Milos_S_5BFT.noIdealFallback.some(item => item.exposureLevel === 'exposed'), 'Milos_S_5BFT fallback must not include exposed beaches.');
assert(results.Paros_N_5BFT.topRecommendations.length === 0, 'Paros_N_5BFT must not expose fake top recommendations.');
assert(!results.Paros_N_5BFT.noIdealFallback.some(item => item.warnings?.some(warning => warning.type === 'wind_sport_spot')), 'Paros_N_5BFT fallback must not include wind-sport spots.');
assert(!results.Paros_N_5BFT.noIdealFallback.some(item => beachNameMatches(item, /chrysi akti|golden beach|pounta|tserdakia|χρυση ακτη|πουντα|τσερδα[\u03baκ]ια/)), 'Paros_N_5BFT fallback must not include Golden Beach/Pounta/Tserdakia wind-exposed spots.');
assert(results.Andros_N_5BFT.topRecommendations.length === 0, 'Andros_N_5BFT must not expose fake top recommendations.');
assert(!results.Andros_N_5BFT.noIdealFallback.some(item => item.exposureLevel === 'exposed'), 'Andros_N_5BFT fallback must not include exposed beaches.');

const androsPisoGyalia = findByName(results.Andros_N_5BFT.allScored, /piso gyalia|πισω γυαλια/);
const androsSyneti = findByName(results.Andros_N_5BFT.allScored, /syneti|συνετι/);
assert(androsPisoGyalia, 'Andros_N_5BFT should include Piso Gyalia in scored beaches.');
assert(androsSyneti, 'Andros_N_5BFT should include Syneti in scored beaches.');
assert(androsPisoGyalia.score > androsSyneti.score, 'Andros_N_5BFT should rate Piso Gyalia above Syneti in north wind.');

// ── Pre-registered meltemi invariant (declared 2026-06-14, BEFORE the tiered
// ranking redesign runs). The top-1 on a meltemi (north-wind) day must ALWAYS be
// the best-available leeward refuge, NEVER a windward/exposed beach.
//
// Why it is checked at 4 Bft (not 5): the harness applies ONE uniform wave height
// to every beach, so at 5 Bft even genuine south-coast refuges hit avoid_swimming
// and the honest output is 0 picks (already enforced by assertNoIdealScenario).
// The "is the top pick a refuge?" ordering is therefore only executable at 4 Bft,
// where leeward beaches stay swimmable. See [[top3-ranking-redesign]].
// Smallest angle (0–180°) between two compass headings.
const angularDistance = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

// A genuine leeward refuge faces broadly the same way the wind blows TOWARD (away from
// the wind's source) — within ±60° of windToward, i.e. the SE–SW arc for a north wind.
// 60° (not 90°) is deliberate: a 90° window would admit due-east/due-west cross-shore
// beaches as "lee", which is exactly the false-protected trap. E.g. for a north wind
// (windToward 180°): Palaiochori 180° → 0° (perfect lee, OK); Fyriplaka 205° → 25° (OK);
// Ψιλή Άμμος 119° (ESE quartering) → 61° → NOT leeward. Unknown facing is skipped.
const LEEWARD_ARC_DEG = 60;
const facesAwayFromWind = (facingDeg, windOriginDeg) => {
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return true;
  const windTowardDeg = (windOriginDeg + 180) % 360;
  return angularDistance(facingDeg, windTowardDeg) <= LEEWARD_ARC_DEG;
};

const topPickFacingDeg = item => {
  const fromProfile = item.geospatialExposure?.facingDeg;
  if (typeof fromProfile === 'number') return fromProfile;
  const fromWindProfile = item.windProfile?.facingDeg ?? item.windProfile?.beachFacingDirection;
  return typeof fromWindProfile === 'number' ? fromWindProfile : undefined;
};

// A meltemi top pick is "false-protected" when it is shown as a confident swim pick
// while it neither genuinely claims wind protection NOR faces leeward — i.e. a
// quartering/cross-shore beach (canClaim=false) carried only by a caution-grade score.
// This is the exact failure the best-available-shelter gate must remove.
const isFalseProtectedMeltemiPick = (item, windOriginDeg) => (
  item.canClaimWindProtection === false &&
  item.swimmingComfort === 'caution' &&
  !facesAwayFromWind(topPickFacingDeg(item), windOriginDeg)
);

const assertMeltemiTopPickIsRefuge = (id, windOriginDeg) => {
  const result = results[id];
  if (result.topRecommendations.length === 0) return;

  // (1) Best-available-shelter: the #1 pick — and every pick — is never exposed.
  assert(
    result.topRecommendations[0].exposureLevel !== 'exposed',
    `${id} (meltemi) top-1 must never be exposed.`
  );
  assert(
    !result.topRecommendations.some(item => item.exposureLevel === 'exposed'),
    `${id} (meltemi) top picks must not include any exposed beach.`
  );

  // (2) False-protected doctrine: no pick may be a cross-shore caution beach dressed
  // up as a confident choice. Where geometry is known, picks must face leeward.
  result.topRecommendations.forEach(item => {
    assert(
      !isFalseProtectedMeltemiPick(item, windOriginDeg),
      `${id} (meltemi) top pick "${beachName(item.beach)}" is false-protected: canClaim=false, caution, facing ${topPickFacingDeg(item)}° into the ${windOriginDeg}° wind.`
    );
  });
};

// Regression guard (must stay green): Milos already behaves correctly today — its
// 4 Bft north picks are true south-coast refuges (Fyriplaka 205°, Palaiochori 180°).
// The redesign must not break this.
assertMeltemiTopPickIsRefuge('Milos_N_4BFT', 0);

// Sanity guard: a genuinely mild 3 Bft north day on Naxos is allowed to surface a
// partial/good pick (Ψιλή Άμμος) — that is NOT the defect, so it must keep passing.
assertMeltemiTopPickIsRefuge('Naxos_N_3BFT', 0);

// CLOSED DEFECT (was pre-registered 2026-06-14, now enforced by the Tier 0
// best-available-shelter gate): at a true 4 Bft north meltemi, Naxos used to surface
// "Ψιλή Άμμος" (facing 119° ESE, partial, canClaim=false, comfort=caution) as the #1
// pick — a quartering cross-shore beach carried by a caution-grade score, i.e. the
// false-protected trap. The gate now drops it. This is a hard assert: if it regresses,
// the gate has been weakened.
assertMeltemiTopPickIsRefuge('Naxos_N_4BFT', 0);

// Honest no-fake-greens invariant at full meltemi strength (uniform-wave harness).
['Naxos_N_5BFT', 'Milos_N_5BFT', 'Paros_N_5BFT', 'Andros_N_5BFT'].forEach(id => {
  assert(results[id].topRecommendations.length === 0, `${id} (full meltemi) must show no fake top picks.`);
});

// ── Tier 1 variety de-dup: when more than one top pick is shown, no two may share a
// coastal sector (same island + same 45° facing bucket) — three beaches of one bay
// must not fill the top-3. Mirrors coastalSectorKey in recommendationService.ts.
const COASTAL_SECTOR_BUCKET_DEG = 45;
const coastalSectorKey = beach => {
  if (!beach) return 'unknown';
  const island = beach.location?.island || beach.location?.region || 'unknown';
  const facing = beach.orientation?.degrees;
  if (typeof facing !== 'number' || !Number.isFinite(facing)) return `${island}#beach-${beach.id}`;
  const bucket = Math.floor((((facing % 360) + 360) % 360) / COASTAL_SECTOR_BUCKET_DEG);
  return `${island}#sector-${bucket}`;
};
// Variety is "distinct sectors first": a repeated sector may appear only after every
// distinct sector already shown has been used — i.e. repeats are the relaxed-variety
// fallback when distinct sectors run out, never a same-sector pick jumping ahead of an
// unshown distinct one. So the de-duped prefix (picks before the first repeat) must all
// be distinct, which is what dedupeByCoastalSector guarantees for the `kept` head.
Object.entries(results).forEach(([id, result]) => {
  const sectors = result.topRecommendations.map(item => coastalSectorKey(item.beach));
  const seen = new Set();
  let inDistinctPrefix = true;
  sectors.forEach(sector => {
    if (seen.has(sector)) {
      inDistinctPrefix = false; // relaxed-variety tail begins here
    } else {
      assert(
        inDistinctPrefix,
        `${id} top picks surface a new distinct sector (${sector}) AFTER a same-sector repeat — variety de-dup must show all distinct sectors first: ${sectors.join(', ')}.`
      );
      seen.add(sector);
    }
  });
});

console.log('App Recommendation Scenario Validation');
Object.entries(results).forEach(([id, result]) => {
  console.log(`\n${id}: ${result.beaufort} Bft ${WindDirection[result.windDirection] || result.windDirection}, wave ${result.waveHeightM}m`);
  console.log(`topRecommendations=${result.topRecommendations.length}, qualifiedTopCandidates=${result.qualifiedTopCandidateCount}, dailySuitable=${result.dailySuitable.length}, strongSuitable=${result.strongSuitable.length}, lessExposed=${result.lessExposedCandidates.length}, noIdeal=${result.hasNoIdealSwimming}, rainBlocked=${result.allBeachHoursRainy}, fallback=${result.noIdealFallback.length}, geospatial=${result.geospatialProfileCount}, surfaceMismatches=${result.surfaceConsistencyMismatches.length}`);
  console.table((result.hasNoIdealSwimming ? result.noIdealFallback : result.strongSuitable).slice(0, 5).map(summarize));
});
console.log('\nRecommendation scenario validation passed.');
