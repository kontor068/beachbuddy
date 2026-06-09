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

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.join('=') || '1'];
}));

const group = args.get('group') || 'cyclades';
const outDir = args.get('out-dir') || path.join('reports', 'wind-profile-backfill');
const failOnUnknown = args.get('fail-on-unknown') === 'true';

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

const loadGroupRegions = () => {
  const index = loadJson(path.join('public', 'data', 'beaches', 'index.json'));
  return (index.regions || []).filter(region => (
    region.group === group ||
    (group === 'thasos' && region.id === 'east-macedonia-and-thrace-thasos') ||
    (group === 'standalone_islands' && ['central-greece-evia', 'east-macedonia-and-thrace-thasos'].includes(region.id))
  ));
};

const forecast = createNorthModerateForecast();
const regions = loadGroupRegions();

if (regions.length === 0) {
  throw new Error(`No regions found for group ${group}`);
}

const regionReports = regions.map(region => {
  const appPayload = loadJson(path.join('public', 'data', 'beaches', 'app', `${region.id}.json`));
  const geospatialProfiles = loadJson(path.join('public', 'data', 'geospatial', 'exposure', `${region.id}.json`)).profiles || {};
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
      hasOrientation: Boolean(beach.orientation?.degrees),
      hasGeospatialFacing: typeof geospatialProfiles[String(beach.id)]?.facingDeg === 'number',
      eligibleBackfill: source === 'geospatial' && confidence === 'medium',
      keptLowReason: confidence === 'low'
        ? 'No authored profile and no eligible geospatial facing direction; keep conservative unknown/low until geometry or local evidence is reviewed.'
        : undefined,
    };
  });

  return { regionId: region.id, name: region.name?.en || region.prefecture || region.id, summary: counts, records };
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
  group,
  policy: {
    lowToMedium: 'Allowed only for beaches with medium geospatial exposure, valid facingDeg, all eight sector decisions, and no stronger authored profile.',
    high: 'Never granted by this backfill. High still requires trusted local/nautical/watersports or repeated observed evidence.',
    protectedClaims: 'Geospatial backfill is conservative and does not grant guaranteed calm/protected claims by itself.',
  },
  summary: totals,
  regions: regionReports,
};

mkdirSync(path.join(root, outDir), { recursive: true });
const outPath = path.join(root, outDir, `validated-${group}-wind-profile-backfill.json`);
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outPath, summary: totals }, null, 2));

if (failOnUnknown && totals.unknown > 0) {
  throw new Error(`${group} has ${totals.unknown} unknown wind profile sources.`);
}
