import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
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

const { WindDirection } = require('../types.ts');
const {
  getConsistentVisibleMapExposureLevels,
} = require('../utils/mapExposure.ts');
const {
  assessBeachWindExposure,
} = require('../utils/windExposureEngine.ts');
const {
  areInSameShorelineSegment,
} = require('../utils/shorelineSegments.ts');

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.join('=') || '1'];
}));

const group = args.get('group') || 'cyclades';
const outDir = args.get('out-dir') || path.join('reports', 'map-exposure-integrity');

const scenarios = [
  { sector: 'N', direction: WindDirection.N, degrees: 0 },
  { sector: 'NE', direction: WindDirection.NE, degrees: 45 },
  { sector: 'E', direction: WindDirection.E, degrees: 90 },
  { sector: 'SE', direction: WindDirection.SE, degrees: 135 },
  { sector: 'S', direction: WindDirection.S, degrees: 180 },
  { sector: 'SW', direction: WindDirection.SW, degrees: 225 },
  { sector: 'W', direction: WindDirection.W, degrees: 270 },
  { sector: 'NW', direction: WindDirection.NW, degrees: 315 },
];

const loadJson = relativePath => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

const loadGroupRegions = () => {
  const index = loadJson(path.join('public', 'data', 'beaches', 'index.json'));
  return (index.regions || [])
    .filter(region => (
      region.group === group ||
      (group === 'thasos' && region.id === 'east-macedonia-and-thrace-thasos') ||
      (group === 'standalone_islands' && ['central-greece-evia', 'east-macedonia-and-thrace-thasos'].includes(region.id))
    ))
    .map(region => ({
      regionId: region.id,
      slug: region.id.replace(/^[a-z-]+-/, ''),
      name: region.name?.en || region.prefecture || region.id,
    }));
};

const loadAppRegionBeaches = regionId => {
  const payload = loadJson(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`));
  return payload.island?.beaches || [];
};

const loadGeneratedGeospatialProfiles = regionId => {
  const payload = loadJson(path.join('public', 'data', 'geospatial', 'exposure', `${regionId}.json`));
  return Object.values(payload.profiles || {}).reduce((lookup, profile) => {
    lookup[profile.beachId] = {
      ...profile,
      source: 'natural-earth-baseline',
    };
    return lookup;
  }, {});
};

const hasTrustedAuthoredProtection = (item, sector) => {
  const source = item.windProfileSource;
  const profile = item.windProfile;
  if (!profile || profile.confidence === 'low') return false;
  if (source !== 'override' && source !== 'beach' && source !== 'metadata') return false;
  if (profile.knownWindSportSpot) return false;
  if (profile.exposedToWindDirections?.includes(sector)) return false;
  if (profile.protectedFromWindDirections?.includes(sector)) return true;
  if (item.exposureLevel !== 'protected') return false;
  return profile.shelterLevel === 'sheltered' || profile.shelterLevel === 'very_sheltered';
};

const hasStableGeospatialProtection = (item, sector) => {
  const sectorExposure = item.geospatialExposure?.sectors?.[sector];
  if (!sectorExposure || sectorExposure.level !== 'protected') return false;
  if (item.geospatialExposure?.confidence !== 'medium' && item.geospatialExposure?.confidence !== 'high') return false;
  return (
    sectorExposure.blockedRayRatio >= 0.95 &&
    (typeof sectorExposure.intensity !== 'number' || sectorExposure.intensity < 33)
  );
};

const hasSegmentProtectionSupport = (item, items, sector) => items.some(candidate => (
  candidate.beach.id !== item.beach.id &&
  areInSameShorelineSegment(candidate.beach.id, item.beach.id) &&
  (
    hasStableGeospatialProtection(candidate, sector) ||
    hasTrustedAuthoredProtection(candidate, sector)
  )
));

const scenarioInput = scenario => ({
  windDirectionDeg: scenario.degrees,
  windDirection: scenario.direction,
  windSpeedKmh: 25,
  beaufort: 4,
  waveHeightMeters: 0.5,
});

const buildMapItems = (beaches, geospatialProfiles, scenario) => beaches.map(beach => {
  const geospatialExposure = geospatialProfiles[beach.id];
  const assessment = assessBeachWindExposure({
    beach,
    geospatialProfile: geospatialExposure,
    ...scenarioInput(scenario),
  });

  return {
    beach,
    exposureLevel: assessment.exposureLevel,
    orientation: assessment.facingDeg,
    windProfile: assessment.windProfile,
    windProfileSource: assessment.source,
    windSector: assessment.windSector,
    warnings: assessment.warnings,
    geospatialExposure,
  };
});

const validatedRegions = loadGroupRegions();
if (validatedRegions.length === 0) {
  throw new Error(`No regions found for group ${group}`);
}

const rows = [];
const unsupportedBlue = [];

for (const region of validatedRegions) {
  const beaches = loadAppRegionBeaches(region.regionId);
  const geospatialProfiles = loadGeneratedGeospatialProfiles(region.regionId);

  for (const scenario of scenarios) {
    const items = buildMapItems(beaches, geospatialProfiles, scenario);
    const levels = getConsistentVisibleMapExposureLevels(items, 4, scenario.degrees);
    let blue = 0;
    let yellow = 0;
    let rawGeoBlue = 0;
    let trustedAuthoredBlue = 0;
    let segmentSupportedBlue = 0;

    for (const item of items) {
      const visibleLevel = levels.get(item.beach.id);
      const sectorExposure = item.geospatialExposure?.sectors?.[scenario.sector];
      const rawLevel = sectorExposure?.level;
      const isBlue = visibleLevel === 'protected';
      if (isBlue) blue += 1;
      else yellow += 1;

      if (!isBlue) continue;

      if (rawLevel === 'protected') {
        rawGeoBlue += 1;
        continue;
      }

      if (hasTrustedAuthoredProtection(item, scenario.sector)) {
        trustedAuthoredBlue += 1;
        continue;
      }

      if (hasSegmentProtectionSupport(item, items, scenario.sector)) {
        segmentSupportedBlue += 1;
        continue;
      }

      unsupportedBlue.push({
        regionId: region.regionId,
        slug: region.slug,
        sector: scenario.sector,
        beachId: item.beach.id,
        name: item.beach.name,
        visibleLevel,
        rawLevel: rawLevel || 'missing',
        fetchKm: sectorExposure?.fetchKm ?? null,
        blockedRayRatio: sectorExposure?.blockedRayRatio ?? null,
        intensity: sectorExposure?.intensity ?? null,
        windProfileSource: item.windProfileSource,
        windProfileConfidence: item.windProfile?.confidence || null,
      });
    }

    rows.push({
      regionId: region.regionId,
      slug: region.slug,
      sector: scenario.sector,
      total: items.length,
      blue,
      yellow,
      rawGeoBlue,
      trustedAuthoredBlue,
      segmentSupportedBlue,
    });
  }
}

const absoluteOutDir = path.join(root, outDir);
mkdirSync(absoluteOutDir, { recursive: true });
const outPath = path.join(absoluteOutDir, `validated-${group}-map-exposure-integrity.json`);
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  group,
  policy: {
    windBeaufort: 4,
    checkedSectors: scenarios.map(scenario => scenario.sector),
    rule: 'A visible protected/blue map marker must be supported by that beach own protected geospatial sector, by a trusted authored non-low wind profile, or by stable protected evidence from the same curated shoreline segment. Random distance-only adjacency may not create unsupported blue markers.',
  },
  summary: {
    regions: validatedRegions.length,
    scenarios: rows.length,
    beachesPerScenario: rows.reduce((sum, row) => sum + row.total, 0),
    blue: rows.reduce((sum, row) => sum + row.blue, 0),
    yellow: rows.reduce((sum, row) => sum + row.yellow, 0),
    rawGeoBlue: rows.reduce((sum, row) => sum + row.rawGeoBlue, 0),
    trustedAuthoredBlue: rows.reduce((sum, row) => sum + row.trustedAuthoredBlue, 0),
    segmentSupportedBlue: rows.reduce((sum, row) => sum + row.segmentSupportedBlue, 0),
    unsupportedBlue: unsupportedBlue.length,
  },
  rows,
  unsupportedBlue,
};

writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  outPath,
  summary: report.summary,
}, null, 2));

if (unsupportedBlue.length > 0) {
  console.error(JSON.stringify({ unsupportedBlue: unsupportedBlue.slice(0, 25) }, null, 2));
  process.exit(1);
}
