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

const { WindDirection } = require('../types.ts');
const { assessBeachWindExposure } = require('../utils/windExposureEngine.ts');

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

const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const scenario = {
  windDirectionDeg: 0,
  windDirection: WindDirection.N,
  windSpeedKmh: 25,
  beaufort: 4,
  waveHeightMeters: 0.5,
};

const loadJson = relativePath => JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));

const sectorCounts = (profile, level) => sectors.filter(sector => profile?.sectors?.[sector]?.level === level).length;

const stableProtectedSectors = profile => sectors.filter(sector => {
  const sectorProfile = profile?.sectors?.[sector];
  return (
    sectorProfile?.level === 'protected' &&
    sectorProfile.blockedRayRatio >= 0.95 &&
    (typeof sectorProfile.intensity !== 'number' || sectorProfile.intensity < 33)
  );
});

const sourceUrlsFor = beach => [
  ...(beach.sourceUrls || []),
  ...(beach.metadata?.sourceUrls || []),
  ...(beach.verification_sources || []),
  ...(beach.metadata?.verification_sources || []),
];

const officialUrlCount = urls => urls.filter(url => (
  /\.(gov|gr)\b/i.test(url) ||
  /blueflag\.gr|visit|municipality|dimos|eot|gnto/i.test(url)
)).length;

const manualHighBlockersByBeachId = {
  2049: 'Pounta/Punda identity ambiguity: app coordinates match the east/southeast Punda Coast beach, while many kite references describe the west Pounda channel opposite Antiparos.',
};

const classifyPotential = ({ beach, assessment, geospatialProfile }) => {
  const urls = sourceUrlsFor(beach);
  const stableProtected = stableProtectedSectors(geospatialProfile);
  const exposedSectorCount = sectorCounts(geospatialProfile, 'exposed');
  const protectedSectorCount = sectorCounts(geospatialProfile, 'protected');
  const reasons = [];
  const blockers = [];

  if (assessment.windProfile.knownWindSportSpot) {
    reasons.push('known-wind-sport-profile');
  }

  if (assessment.windProfile.localWindAmplification === 'high') {
    reasons.push('high-local-wind-amplification');
  }

  if (assessment.windProfile.shelterLevel === 'sheltered' || assessment.windProfile.shelterLevel === 'very_sheltered') {
    reasons.push('authored-sheltered-profile');
  }

  if (stableProtected.length >= 3) {
    reasons.push('multiple-stable-protected-geospatial-sectors');
  }

  if (exposedSectorCount >= 3 && assessment.windProfile.fetchExposure === 'high') {
    reasons.push('multiple-exposed-geospatial-sectors-with-high-fetch-profile');
  }

  if (officialUrlCount(urls) > 0) {
    reasons.push('has-official-static-source-url');
  }

  if (assessment.source === 'geospatial') {
    blockers.push('geospatial-only-medium: high requires external/local/nautical/watersports evidence');
  }

  if (urls.length === 0) {
    blockers.push('no-source-urls-on-record');
  }

  if (!assessment.windProfile.knownWindSportSpot && stableProtected.length === 0 && protectedSectorCount < 3) {
    blockers.push('no-strong-shelter-or-windsport-signal');
  }

  if (beach.metadata?.googleMapsNavigation?.status === 'unresolved') {
    blockers.push('google-navigation-identity-unresolved');
  }

  if (manualHighBlockersByBeachId[beach.id]) {
    blockers.push(manualHighBlockersByBeachId[beach.id]);
  }

  const candidateTier = blockers.length === 0 && reasons.length >= 2
    ? 'ready-for-external-evidence-review'
    : reasons.length >= 1
      ? 'possible-high-after-evidence'
      : 'keep-medium';

  return {
    candidateTier,
    reasons,
    blockers,
    geospatialSignals: {
      stableProtectedSectors: stableProtected,
      protectedSectorCount,
      exposedSectorCount,
      partialSectorCount: sectorCounts(geospatialProfile, 'partial'),
      confidence: geospatialProfile?.confidence || 'missing',
    },
  };
};

const regionReports = validatedRegions.map(regionId => {
  const appPayload = loadJson(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`));
  const geospatialPayload = loadJson(path.join('public', 'data', 'geospatial', 'exposure', `${regionId}.json`));
  const beaches = appPayload.island?.beaches || appPayload.beaches || [];
  const geospatialProfiles = geospatialPayload.profiles || {};
  const mediumRecords = [];

  beaches.forEach(beach => {
    const geospatialProfile = geospatialProfiles[String(beach.id)];
    const assessment = assessBeachWindExposure({
      beach,
      geospatialProfile,
      ...scenario,
    });

    if (assessment.windProfile.confidence !== 'medium') return;

    const classification = classifyPotential({ beach, assessment, geospatialProfile });
    mediumRecords.push({
      beachId: beach.id,
      name: beach.name?.en || String(beach.id),
      greekName: beach.name?.gr || null,
      windProfileSource: assessment.source,
      shelterLevel: assessment.windProfile.shelterLevel,
      fetchExposure: assessment.windProfile.fetchExposure,
      knownWindSportSpot: assessment.windProfile.knownWindSportSpot,
      localWindAmplification: assessment.windProfile.localWindAmplification,
      exposedToWindDirections: assessment.windProfile.exposedToWindDirections,
      protectedFromWindDirections: assessment.windProfile.protectedFromWindDirections,
      notes: assessment.windProfile.notes,
      sourceUrls: sourceUrlsFor(beach),
      ...classification,
    });
  });

  const summary = mediumRecords.reduce((acc, record) => {
    acc.total += 1;
    acc[record.candidateTier] = (acc[record.candidateTier] || 0) + 1;
    if (record.knownWindSportSpot) acc.knownWindSportSpots += 1;
    if (record.windProfileSource === 'geospatial') acc.geospatialOnly += 1;
    return acc;
  }, {
    total: 0,
    'ready-for-external-evidence-review': 0,
    'possible-high-after-evidence': 0,
    'keep-medium': 0,
    knownWindSportSpots: 0,
    geospatialOnly: 0,
  });

  return { regionId, summary, records: mediumRecords };
});

const summary = regionReports.reduce((acc, region) => {
  Object.entries(region.summary).forEach(([key, value]) => {
    acc[key] = (acc[key] || 0) + value;
  });
  return acc;
}, {
  total: 0,
  'ready-for-external-evidence-review': 0,
  'possible-high-after-evidence': 0,
  'keep-medium': 0,
  knownWindSportSpots: 0,
  geospatialOnly: 0,
});

const payload = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policy: {
    scope: 'Validated Cyclades medium wind profiles only.',
    mediumToHigh: [
      'High is not granted by this audit alone.',
      'High requires beach-specific trusted evidence: local/nautical/watersports/official/repeated observed behavior.',
      'Geospatial-only medium profiles stay medium until external/local evidence is attached.',
      'Known wind-sport high confidence can prove exposure/wind risk, not calm/protected swimming.',
    ],
  },
  summary,
  regions: regionReports,
};

const outDir = path.join(root, 'reports', 'wind-profile-high-upgrade');
mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'validated-cyclades-medium-high-candidates.json');
writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ outPath, summary }, null, 2));
