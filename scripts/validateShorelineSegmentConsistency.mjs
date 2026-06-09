import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
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

const { calculateBeachScore } = require('../services/recommendationService.ts');
const {
  getConsistentVisibleMapExposureLevels,
  getVisibleMapExposureLevel,
} = require('../utils/mapExposure.ts');
const {
  SHORELINE_SEGMENTS,
} = require('../utils/shorelineSegments.ts');
const { hasHourlyRainRisk } = require('../services/recommendationService.ts');

const regionId = process.argv.find(arg => arg.startsWith('--region='))
  ?.split('=')[1] || 'south-aegean-naxos';
const outDir = process.argv.find(arg => arg.startsWith('--out-dir='))
  ?.split('=')[1] || path.join('reports', 'shoreline-segment-consistency');

const loadJson = filePath => JSON.parse(readFileSync(path.join(root, filePath), 'utf8'));

const appPayload = loadJson(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`));
const beaches = appPayload.island?.beaches || appPayload.beaches || [];
const geospatialProfiles = loadJson(path.join('public', 'data', 'geospatial', 'exposure', `${regionId}.json`)).profiles || {};
const segments = SHORELINE_SEGMENTS.filter(segment => segment.regionId === regionId);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const getSwellHeight = waveHeightM => Math.max(0.1, Number((waveHeightM * 0.55).toFixed(2)));
const toDateKey = date => date.toISOString().slice(0, 10);

const createForecastItem = (date, hour, scenario) => {
  const itemDate = new Date(date);
  itemDate.setHours(hour, 0, 0, 0);

  return {
    dt: Math.floor(itemDate.getTime() / 1000),
    main: {
      temp: 25,
      feels_like: 25,
      temp_min: 22,
      temp_max: 26,
      pressure: 1014,
      sea_level: 1014,
      grnd_level: 1014,
      humidity: 58,
      temp_kf: 0,
    },
    weather: [{
      id: 800,
      main: 'Clear',
      description: 'clear sky',
      icon: '01d',
    }],
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

const scenarios = [
  { id: 'Naxos_N_3BFT', windDirectionDeg: 0, windSpeedMs: 4.8, windGustMs: 7.0, waveHeightM: 0.35, waveDirectionDeg: 0 },
  { id: 'Naxos_N_5BFT', windDirectionDeg: 0, windSpeedMs: 9.8, windGustMs: 13.5, waveHeightM: 1.5, waveDirectionDeg: 0 },
  { id: 'Naxos_W_4BFT', windDirectionDeg: 270, windSpeedMs: 6.2, windGustMs: 8.5, waveHeightM: 0.5, waveDirectionDeg: 270 },
  { id: 'Naxos_S_4BFT', windDirectionDeg: 180, windSpeedMs: 6.2, windGustMs: 8.5, waveHeightM: 0.5, waveDirectionDeg: 180 },
  { id: 'Naxos_E_4BFT', windDirectionDeg: 90, windSpeedMs: 6.2, windGustMs: 8.5, waveHeightM: 0.5, waveDirectionDeg: 90 },
];

const beachName = beach => beach.name?.gr || beach.name?.en || String(beach.id);

const scoreItems = (forecast) => beaches.map(beach => {
  const score = calculateBeachScore(beach, forecast, undefined, undefined, {
    hourlyForecast: forecast.hourly,
    geospatialProfile: geospatialProfiles[String(beach.id)],
  });

  return {
    beachId: beach.id,
    beach,
    exposureLevel: score.exposureLevel,
    orientation: score.orientation,
    warnings: score.warnings,
    windProfile: score.windProfile,
    windProfileSource: score.windProfileSource,
    windSector: score.windSector,
    geospatialExposure: geospatialProfiles[String(beach.id)],
  };
});

const levelsForSegment = (segment, items, levels) => segment.beachIds
  .map(beachId => {
    const item = items.find(candidate => candidate.beach.id === beachId);
    if (!item) return undefined;
    return {
      beachId,
      name: beachName(item.beach),
      level: levels.get(beachId),
      windProfileConfidence: item.windProfile?.confidence || 'unknown',
      knownWindSportSpot: Boolean(item.windProfile?.knownWindSportSpot),
    };
  })
  .filter(Boolean);

const uniqueLevels = rows => [...new Set(rows.map(row => row.level).filter(Boolean))];

const isWindSportException = (segment, scenario) => {
  if (!scenario) return false;
  if (!segment.consistentLevels.includes('exposed')) return false;
  const windBeaufort = Math.round(scenario.windSpeedMs * 3.6 / 5.5);
  if (windBeaufort < 4) return false;

  const exposedRows = segment.rows.filter(row => row.level === 'exposed');
  const nonExposedRows = segment.rows.filter(row => row.level !== 'exposed');
  return (
    exposedRows.length > 0 &&
    nonExposedRows.length > 0 &&
    exposedRows.every(row => row.knownWindSportSpot)
  );
};

const results = scenarios.map(scenario => {
  const forecast = createDailyForecast(scenario);
  const items = scoreItems(forecast);
  const rawLevels = new Map(items.map(item => [
    item.beach.id,
    getVisibleMapExposureLevel(item, undefined, scenario.windDirectionDeg),
  ]));
  const consistentLevels = getConsistentVisibleMapExposureLevels(
    items,
    Math.round(scenario.windSpeedMs * 3.6 / 5.5),
    scenario.windDirectionDeg
  );

  const segmentResults = segments.map(segment => {
    const rawRows = levelsForSegment(segment, items, rawLevels);
    const consistentRows = levelsForSegment(segment, items, consistentLevels);
    return {
      segmentId: segment.id,
      reason: segment.reason,
      rawLevels: uniqueLevels(rawRows),
      consistentLevels: uniqueLevels(consistentRows),
      rows: consistentRows,
      rawRows,
      notes: segment.notes,
    };
  });

  return {
    scenarioId: scenario.id,
    windDirectionDeg: scenario.windDirectionDeg,
    segments: segmentResults,
  };
});

const divergentSegments = results.flatMap(result => result.segments
  .filter(segment => segment.consistentLevels.length > 1)
  .map(segment => ({
    scenarioId: result.scenarioId,
    segmentId: segment.segmentId,
    consistentLevels: segment.consistentLevels,
    rows: segment.rows,
    allowedException: isWindSportException(segment, scenarios.find(scenario => scenario.id === result.scenarioId)),
  })));

const allowedExceptions = divergentSegments.filter(segment => segment.allowedException);
const unresolved = divergentSegments.filter(segment => !segment.allowedException);

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  regionId,
  policy: {
    sameSegment: 'Beaches in the same curated shoreline segment should render the same visible exposure level unless a verified local morphology or wind-sport exception locks a stricter level.',
    confidence: 'Segment propagation may support map-color consistency and medium review, but it never creates high confidence by itself.',
  },
  summary: {
    scenarioCount: results.length,
    segmentCount: segments.length,
    allowedExceptions: allowedExceptions.length,
    unresolvedContradictions: unresolved.length,
  },
  allowedExceptions,
  unresolved,
  results,
};

const absoluteOutDir = path.join(root, outDir);
mkdirSync(absoluteOutDir, { recursive: true });
const outPath = path.join(absoluteOutDir, `${regionId}.json`);
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

assert(unresolved.length === 0, `Unresolved shoreline segment exposure contradictions:\n${JSON.stringify(unresolved, null, 2)}`);

console.log(JSON.stringify({ outPath, summary: payload.summary }, null, 2));
