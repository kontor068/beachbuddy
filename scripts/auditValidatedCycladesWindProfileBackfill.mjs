import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; }; exports.trackEvent = function () {};\n', filename);
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

const validatedRegions = [
  'south-aegean-naxos',
  'south-aegean-paros',
  'south-aegean-milos',
  'south-aegean-andros',
  'south-aegean-tinos',
  'south-aegean-syros',
  'south-aegean-mykonos',
  'south-aegean-santorini',
  'south-aegean-ios',
  'south-aegean-sifnos',
  'south-aegean-serifos',
  'south-aegean-kythnos',
  'south-aegean-kea',
];

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.join('=') || '1'];
}));

const outDir = args.get('out-dir') || path.join('reports', 'wind-profile-backfill');

const createNorthModerateForecast = () => ({
  date: new Date(),
  wind: { speed: 4.8, deg: 0, gust: 7 },
  weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
  temp_min: 22,
  temp_max: 26,
  hourly: [],
  marine: {
    waveHeightM: 0.35,
    waveDirectionDeg: 0,
    wavePeriodS: 4,
    swellWaveHeightM: 0.2,
    swellWaveDirectionDeg: 0,
    seaSurfaceTemperatureC: 23,
    source: 'open-meteo-marine',
  },
});

const loadJson = relativePath => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

const emptyCounts = () => ({
  total: 0,
  high: 0,
  medium: 0,
  low: 0,
  unknown: 0,
  override: 0,
  beach: 0,
  metadata: 0,
  geospatial: 0,
});

const forecast = createNorthModerateForecast();
const regionReports = validatedRegions.map(regionId => {
  const appPayload = loadJson(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`));
  const geospatialProfiles = loadJson(path.join('public', 'data', 'geospatial', 'exposure', `${regionId}.json`)).profiles || {};
  const beaches = appPayload.island?.beaches || [];
  const counts = emptyCounts();

  const records = beaches.map(beach => {
    const score = calculateBeachScore(beach, forecast, undefined, undefined, {
      hourlyForecast: [],
      geospatialProfile: geospatialProfiles[String(beach.id)],
    });
    const confidence = score.windProfile?.confidence || 'unknown';
    const source = score.windProfileSource || 'unknown';
    counts.total += 1;
    counts[confidence] = (counts[confidence] || 0) + 1;
    counts[source] = (counts[source] || 0) + 1;

    return {
      beachId: beach.id,
      name: beach.name?.en || String(beach.id),
      windProfileSource: source,
      windProfileConfidence: confidence,
      eligibleBackfill: source === 'geospatial' && confidence === 'medium',
      keptLowReason: confidence === 'low'
        ? 'existing curated low-confidence profile or unresolved local evidence; not upgraded by geospatial backfill'
        : undefined,
    };
  });

  return { regionId, summary: counts, records };
});

const totals = regionReports.reduce((acc, region) => {
  Object.entries(region.summary).forEach(([key, value]) => {
    acc[key] = (acc[key] || 0) + value;
  });
  return acc;
}, emptyCounts());

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    scope: 'Only validated Cyclades islands in the shoreline rollout receive geospatial wind-profile backfill.',
    lowToMedium: 'Allowed only for beaches with medium geospatial exposure on validated islands and no stronger authored profile.',
    high: 'Never granted by this backfill. High still requires trusted local/nautical/watersports or repeated observed evidence.',
    protectedClaims: 'Geospatial backfill is conservative and does not grant guaranteed calm/protected claims by itself.',
  },
  summary: totals,
  regions: regionReports,
};

mkdirSync(path.join(root, outDir), { recursive: true });
const outPath = path.join(root, outDir, 'validated-cyclades-wind-profile-backfill.json');
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

const unknownRegions = regionReports.filter(region => region.summary.unknown > 0);
if (unknownRegions.length > 0) {
  throw new Error(`Validated Cyclades regions still have unknown wind profile sources: ${unknownRegions.map(region => region.regionId).join(', ')}`);
}

const expectedHighConfidenceBeachKeys = new Set([
  'south-aegean-paros:2030',
  'south-aegean-paros:2039',
  'south-aegean-paros:2044',
  'south-aegean-paros:2053',
  'south-aegean-paros:2054',
  'south-aegean-paros:2055',
  'south-aegean-paros:2056',
  'south-aegean-milos:1903',
]);
const highConfidenceBeachKeys = regionReports
  .flatMap(region => region.records
    .filter(record => record.windProfileConfidence === 'high')
    .map(record => `${region.regionId}:${record.beachId}`))
  .sort();
const expectedHighConfidenceKeys = [...expectedHighConfidenceBeachKeys].sort();
if (JSON.stringify(highConfidenceBeachKeys) !== JSON.stringify(expectedHighConfidenceKeys)) {
  throw new Error(`Validated Cyclades high-confidence profiles changed unexpectedly. Expected ${expectedHighConfidenceKeys.join(', ')}, got ${highConfidenceBeachKeys.join(', ')}`);
}

console.log(JSON.stringify({ outPath, summary: totals }, null, 2));
