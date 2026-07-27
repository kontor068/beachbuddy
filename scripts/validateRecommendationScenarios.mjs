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
  capLightWindMeasuredWaveM,
} = require('../utils/waveModel.ts');
const {
  seaStateToneCeiling,
  SEA_STATE_AMBER_M,
  SEA_STATE_ROUGH_M,
} = require('../utils/waveCharacter.ts');
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

  // ── ≤2 Bft regime (added 2026-07-27) ────────────────────────────────────────
  // Until now EVERY scenario here was 3/4/5 Bft, so the entire light-wind regime was
  // untested — which is exactly how "calm wind, real waves" shipped. Field report:
  // Σχινιάς (id 32, facing 173.5°, S sector 18.72 km fetch, `exposed`) read blue/ideal
  // at 2 Bft while the sea was visibly running from the SSE, and again at 19:48 with
  // almost no wind at all.
  //
  // The wind here is deliberately OFFSHORE (NNE onto a south-facing shore): the whole
  // point is that local wind carries no information about this sea.
  Schinias_S_2BFT_CHOP: {
    targetRegionId: 'attica-east-attica-mainland',
    windDirectionDeg: 20,
    windSpeedMs: 2.8,          // 10.1 km/h → 2 Bft
    windGustMs: 4.0,
    waveHeightM: 0.45,
    waveDirectionDeg: 155,     // SSE — straight down the 18.7 km S/SE corridor
    wavePeriodS: 2.5,          // short-period chop: steep, breaking, ~1440 waves/hour
    swellWaveHeightM: 0.2,
    swellWavePeriodS: 2.5,
  },
  // Over-correction guard. Same wind, same geometry, genuinely flat sea. If this stops
  // reading as an ideal light-wind day, the recalibration has gone too far and the app
  // has lost the thing it exists to do.
  Schinias_S_2BFT_CALM: {
    targetRegionId: 'attica-east-attica-mainland',
    windDirectionDeg: 20,
    windSpeedMs: 2.8,
    windGustMs: 4.0,
    waveHeightM: 0.15,
    waveDirectionDeg: 155,
    wavePeriodS: 2.5,
    swellWaveHeightM: 0.2,
    swellWavePeriodS: 2.5,
  },
  // Steepness axis, isolated: IDENTICAL Hs and identical swell channel, only the total-sea
  // period differs. 0.55 m at 2.5 s is steepness 0.056 — steep, continuously breaking.
  // 0.55 m at 8.0 s is steepness 0.0055 — a gentle roll. Same number, different swim.
  Milos_S_2BFT_CHOP: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 20,
    windSpeedMs: 2.8,
    windGustMs: 4.0,
    waveHeightM: 0.55,
    waveDirectionDeg: 180,
    wavePeriodS: 2.5,
    swellWaveHeightM: 0.2,
    swellWavePeriodS: 2.5,
  },
  Milos_S_2BFT_SWELL: {
    targetRegionId: 'south-aegean-milos',
    windDirectionDeg: 20,
    windSpeedMs: 2.8,
    windGustMs: 4.0,
    waveHeightM: 0.55,
    waveDirectionDeg: 180,
    wavePeriodS: 8.0,
    swellWaveHeightM: 0.2,
    swellWavePeriodS: 8.0,
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

// Marine block for a scenario. Period and swell height are overridable so a scenario can
// isolate wave CHARACTER (steepness = Hs/L0, L0 = g·T²/2π) from wave HEIGHT: two scenarios
// with the same Hs and different T describe genuinely different water.
const createMarineBlock = scenario => ({
  waveHeightM: scenario.waveHeightM,
  waveDirectionDeg: scenario.waveDirectionDeg,
  wavePeriodS: scenario.wavePeriodS ?? (scenario.waveHeightM >= 1 ? 5 : 4),
  swellWaveHeightM: scenario.swellWaveHeightM ?? getSwellHeight(scenario.waveHeightM),
  swellWaveDirectionDeg: scenario.waveDirectionDeg,
  swellWavePeriodS: scenario.swellWavePeriodS,
  seaSurfaceTemperatureC: 23,
  source: 'open-meteo-marine',
});

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

    // Must mirror normalizeProfiles in services/geospatialExposureService.ts field for field.
    // A field the runtime reads and this harness drops is a scenario that passes for a beach the
    // app scores differently — the suite would be validating a profile shape that never ships.
    lookup[profile.beachId] = {
      beachId: profile.beachId,
      facingDeg: profile.facingDeg ?? null,
      sectors: profile.sectors,
      confidence: profile.confidence,
      source: profile.confidence === 'high' ? 'high-res-coastline' : 'natural-earth-baseline',
      marineSamplePoint: profile.marineSamplePoint,
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
    marine: createMarineBlock(scenario),
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
    marine: createMarineBlock(scenario),
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
    seaStateWaveM: score.seaStateWaveM,
    seaStateSource: score.seaStateSource,
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
    windSpeedKmph,
    windDirection: degToCompass(forecast.wind.deg),
    waveHeightM,
    wavePeriodS: forecast.marine?.wavePeriodS,
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

// ── Light-wind sea-state invariants (pre-registered 2026-07-27) ──────────────────
// The defect: at ≤2 Bft the app answered "ideal" from the wind alone. Five gates in
// series each independently forced that answer, so these assertions are written against
// the OUTCOME (what the user is told) rather than any one gate, and must survive a
// rewrite of any of them.
const scoredById = (id, beachId) => results[id].allScored.find(item => item.beach.id === beachId);

const seaScoreOf = (id, beachId) => {
  const item = scoredById(id, beachId);
  assert(item, `${id} should score beach ${beachId}.`);
  const windSpeedKmph = results[id].windSpeedKmph;
  return calculateSeaConditionScore(
    item.isExposed,
    windSpeedKmph,
    item.exposureLevel,
    item.seaStateWaveM ?? item.waveHeightM,
    undefined,
    results[id].wavePeriodS
  );
};

// ── The light-wind cap may only ever RAISE the number (pre-registered 2026-07-27) ──
// The directional rule exists so a real onshore sea is not capped away at light wind. An earlier
// draft also had a branch that LOWERED the number when the sea appeared to arrive through land;
// it was removed because it fired on 2846/2850 beaches over a median 153° window, its two
// conditions both derived from the same facingDeg, and the flag meant to gate it was measured
// against a coordinate the app never requests. Any future direction-aware branch must not be able
// to reduce a measured sea: that is the one direction that can put someone in water we called flat.
{
  const MEASURED = 0.9;
  const onshoreOpen = { onshore: 0.95, fetchKm: 18 };
  const offshoreBlocked = { onshore: -0.9, fetchKm: 0.0 };
  const baseline = capLightWindMeasuredWaveM(MEASURED, 2, undefined, undefined);

  assert(
    capLightWindMeasuredWaveM(MEASURED, 2, undefined, onshoreOpen) === MEASURED,
    'Light-wind cap: an onshore sea through an open corridor must pass through uncapped.'
  );
  [
    ['sea arriving through land', offshoreBlocked],
    ['same, on an untrusted cell', { ...offshoreBlocked, cellTrusted: false }],
    ['glancing arrival', { onshore: 0.1, fetchKm: 0.5 }],
  ].forEach(([label, arrival]) => {
    assert(
      capLightWindMeasuredWaveM(MEASURED, 2, undefined, arrival) >= baseline,
      `Light-wind cap: arrival geometry must never lower the measured sea below the direction-blind cap (${label}).`
    );
  });
  assert(
    capLightWindMeasuredWaveM(MEASURED, 3, undefined, offshoreBlocked) === MEASURED,
    'Light-wind cap: above 2 Bft none of this applies and the measured value stands.'
  );
}

// ── Light wind must never score a sea more kindly than a breeze would ──────────
// The ≤2 Bft path uses its own ramp so an open shore is not marked down for wind that is not
// blowing. Used alone that ramp was the MORE GENEROUS instrument for a big long-period sea:
// an exposed shore under 1.2 m of groundswell in dead calm scored 4/10 by the general formula
// (poor enough to be dropped from recommendations) and 5/10 by the ramp, which put it back.
{
  const bigSwellOnExposed = calculateSeaConditionScore(true, 8, 'exposed', 1.2, false, 8);
  assert(
    bigSwellOnExposed < 5,
    `Light wind + 1.2 m groundswell on an exposed shore scored ${bigSwellOnExposed}/10 — it must stay below the recommendation gate. Dead calm air is not a reason to wave a big sea through.`
  );
  // Monotonic in the sea: a bigger sea can never score better, at any wind.
  [3, 8, 11, 12, 20, 30].forEach(wind => {
    ['protected', 'partial', 'exposed'].forEach(level => {
      let previous = 11;
      [0.1, 0.3, 0.5, 0.8, 1.0, 1.2, 1.5, 2.0].forEach(hs => {
        const score = calculateSeaConditionScore(level !== 'protected', wind, level, hs, false, 4);
        assert(
          score <= previous,
          `Sea score is not monotonic: ${level} at ${wind} km/h scored ${score}/10 for ${hs} m after ${previous}/10 for the smaller sea.`
        );
        previous = score;
      });
    });
  });
}

// ── The 2/3 Bft seam must not be a cliff ────────────────────────────────────────
// ≤2 Bft takes an extra sea ladder that 3 Bft does not, so the two regimes meet at 11 vs 12 km/h.
// A draft where the ladder ignored the measured-wave floors opened a +5 gap there — a protected
// shore under a steep 0.9 m sea read 3/10 at 11 km/h and 8/10 at 12. One extra km/h of wind must
// never rewrite the day.
//
// Cases with no wave reading at all are excluded: those jump 8 → 5 across the seam and always have,
// because the calm short-circuit simply stops applying. That is pre-existing behaviour, not this
// ladder's, and pinning it here would be pinning someone else's bug.
{
  const MAX_SEAM_JUMP = 3;
  let worst = 0;
  let worstCase = null;
  [0.1, 0.3, 0.45, 0.6, 0.8, 0.9, 1.0, 1.2, 1.5, 2.0].forEach(hs => {
    [2.0, 2.5, 3.0, 4.0, 5.0, 8.0].forEach(periodS => {
      ['protected', 'partial', 'exposed'].forEach(level => {
        const isExposed = level !== 'protected';
        const below = calculateSeaConditionScore(isExposed, 11, level, hs, false, periodS);
        const above = calculateSeaConditionScore(isExposed, 12, level, hs, false, periodS);
        if (Math.abs(above - below) > Math.abs(worst)) {
          worst = above - below;
          worstCase = `${level}, Hs ${hs} m, T ${periodS} s: ${below}/10 at 11 km/h -> ${above}/10 at 12 km/h`;
        }
      });
    });
  });
  assert(
    Math.abs(worst) <= MAX_SEAM_JUMP,
    `Sea score jumps ${worst > 0 ? '+' : ''}${worst} points across the 2/3 Bft seam — ${worstCase}.`
  );
}

const SCHINIAS = 32;
// North-facing Αν. Αττικής shores (facing 0.4° / 342.9° / 349.7°) whose S sector has
// fetchKm 0.00: a southerly sea physically cannot reach them. If these move, the
// escalation is firing on the raw number instead of on the geometry.
const EAST_ATTICA_SOUTH_SHELTERED = [25, 26, 27];
// Μήλος: Παλαιοχώρι faces 179.7° into a 25 km southern fetch; Αχιβαδολίμνη faces 345.8°
// with S fetch 0.00 and is one of the roadmap's pre-registered closed-bay controls.
const PALAIOCHORI = 1915;
const ACHIVADOLIMNI = 1903;

// (1) The reported failure. An onshore short-period sea on a beach whose own geometry
// calls that sector `exposed` must not read as an ideal light-wind day.
assert(
  seaScoreOf('Schinias_S_2BFT_CHOP', SCHINIAS) <= 7,
  `Schinias_S_2BFT_CHOP: Σχινιάς scores ${seaScoreOf('Schinias_S_2BFT_CHOP', SCHINIAS)}/10 on a 0.45 m / 2.5 s onshore sea at 2 Bft — the light-wind gates are still answering from the wind alone.`
);
assert(
  typeof scoredById('Schinias_S_2BFT_CHOP', SCHINIAS)?.seaStateWaveM === 'number',
  'Schinias_S_2BFT_CHOP: BeachScore must expose seaStateWaveM as the decision-grade sea state (waveHeightM stays display-only).'
);

// (2) Over-correction guard. Flat sea, same wind, same geometry → still an ideal day.
assert(
  seaScoreOf('Schinias_S_2BFT_CALM', SCHINIAS) >= 8,
  `Schinias_S_2BFT_CALM: Σχινιάς dropped to ${seaScoreOf('Schinias_S_2BFT_CALM', SCHINIAS)}/10 on a genuinely flat 0.15 m sea — the recalibration is over-firing and the app has stopped being able to say "go swimming".`
);

// (3) A sea a shore cannot receive must not cost it its place in the recommendations.
//
// KNOWN OPEN DEFECT, bounded here rather than fixed. The measured-wave floors in
// calculateSeaConditionScore key off exposure to the WIND, not to the wave's own bearing. So a
// north-facing shore under a light northerly counts as "exposed" — losing its floor — while being
// completely shielded from a southerly sea, and is then charged for that sea. Σχινιάς, which the
// sea is actually breaking on, is offshore of the same northerly and keeps its floor. The ordering
// therefore inverts at light wind.
//
// Not fixed in this pass because the two available fixes both reintroduce something worse:
// capping the height by geometry is the false-calm path removed above, and neutralising the wind
// term at ≤2 Bft lets a 1.2 m groundswell back through the recommendation gate on an open shore.
// The real fix is a wave-direction exposure axis, which needs its own measurement.
//
// What must hold meanwhile — and what this asserts — is that the harm stays bounded: a shore may
// read lower than it deserves, but a sea it cannot receive must never remove it from the list.
EAST_ATTICA_SOUTH_SHELTERED.forEach(beachId => {
  const sheltered = seaScoreOf('Schinias_S_2BFT_CHOP', beachId);
  assert(
    sheltered >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE,
    `Schinias_S_2BFT_CHOP: beach ${beachId} (S fetch 0.00 km, shielded from this southerly sea) fell to ${sheltered}/10 and would be dropped from the recommendations by a sea that cannot reach it.`
  );
});

// (4) Steepness axis. Identical Hs, identical swell channel, only the period differs.
// This is an ORDERING, not a threshold: whatever the absolute scores, steep breaking chop
// must never be scored as kindly as the same height of long-period roll.
const choppyMilos = seaScoreOf('Milos_S_2BFT_CHOP', PALAIOCHORI);
const swellyMilos = seaScoreOf('Milos_S_2BFT_SWELL', PALAIOCHORI);
assert(
  choppyMilos < swellyMilos,
  `Milos 2 Bft: 0.55 m at 2.5 s scored ${choppyMilos}/10 and the SAME 0.55 m at 8.0 s scored ${swellyMilos}/10 — the model cannot tell steep breaking chop from a gentle roll.`
);

// (5) Closed-bay control (roadmap Mod-2). Same bounded-harm rule as (3): Αχιβαδολίμνη faces
// 345.8° with 0.00 km of southern fetch, so a southerly sea cannot enter it. Until the
// wave-direction exposure axis exists it will still be charged for one — but it must never be
// charged enough to lose its place, and the two scenarios must stay ordered by steepness.
{
  const chop = seaScoreOf('Milos_S_2BFT_CHOP', ACHIVADOLIMNI);
  const swell = seaScoreOf('Milos_S_2BFT_SWELL', ACHIVADOLIMNI);
  assert(
    chop >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE && swell >= MIN_STRONG_SUITABLE_SEA_CONDITION_SCORE,
    `Milos 2 Bft: Αχιβαδολίμνη (closed bay, S fetch 0.00) scored ${chop}/10 chop and ${swell}/10 swell — a southerly sea cannot enter this bay and must never cost it its place in the recommendations.`
  );
  assert(
    chop <= swell,
    `Milos 2 Bft: Αχιβαδολίμνη scored the steep 2.5 s sea (${chop}/10) more kindly than the 8 s roll of the same height (${swell}/10).`
  );
}

console.log('App Recommendation Scenario Validation');
Object.entries(results).forEach(([id, result]) => {
  console.log(`\n${id}: ${result.beaufort} Bft ${WindDirection[result.windDirection] || result.windDirection}, wave ${result.waveHeightM}m`);
  console.log(`topRecommendations=${result.topRecommendations.length}, qualifiedTopCandidates=${result.qualifiedTopCandidateCount}, dailySuitable=${result.dailySuitable.length}, strongSuitable=${result.strongSuitable.length}, lessExposed=${result.lessExposedCandidates.length}, noIdeal=${result.hasNoIdealSwimming}, rainBlocked=${result.allBeachHoursRainy}, fallback=${result.noIdealFallback.length}, geospatial=${result.geospatialProfileCount}, surfaceMismatches=${result.surfaceConsistencyMismatches.length}`);
  console.table((result.hasNoIdealSwimming ? result.noIdealFallback : result.strongSuitable).slice(0, 5).map(summarize));
});
console.log('\nRecommendation scenario validation passed.');
