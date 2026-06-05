import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exposureDirectory = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const appBeachDirectory = path.join(root, 'public', 'data', 'beaches', 'app');
const indexPath = path.join(exposureDirectory, 'index.json');

const sectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const validLevels = new Set(['protected', 'partial', 'exposed']);

const representativeRegionIds = [
  'south-aegean-milos',
  'south-aegean-naxos',
  'south-aegean-paros',
  'south-aegean-andros',
  'ionian-islands-lefkada',
  'ionian-islands-corfu',
  'ionian-islands-zakynthos',
  'ionian-islands-kefalonia',
  'crete-crete-chania',
  'crete-crete-heraklion',
  'south-aegean-rhodes',
  'central-macedonia-halkidiki-mainland',
  'attica-athens-area-mainland',
  'attica-aegina',
  'peloponnese-messinia-mainland',
  'north-aegean-ikaria',
  'north-aegean-lesvos',
  'north-aegean-samos',
];

const sectorByProtectedFrom = {
  North: 'N',
  Northeast: 'NE',
  East: 'E',
  Southeast: 'SE',
  South: 'S',
  Southwest: 'SW',
  West: 'W',
  Northwest: 'NW',
};

const sampleChecks = [
  {
    regionId: 'south-aegean-milos',
    name: 'Sarakiniko',
    sector: 'N',
    expected: 'exposed',
    critical: true,
    reason: 'Milos north-coast sanity check.',
  },
  {
    regionId: 'south-aegean-milos',
    name: 'Agia Kyriaki',
    sector: 'S',
    expected: 'exposed',
    critical: true,
    reason: 'Milos south-coast sanity check.',
  },
  {
    regionId: 'south-aegean-milos',
    name: 'Papikinoy',
    sector: 'N',
    expected: 'protected',
    critical: true,
    reason: 'Milos Adamas-bay local exception sanity check.',
  },
  {
    regionId: 'south-aegean-andros',
    name: 'Syneti',
    sector: 'N',
    expectedGroup: 'notProtected',
    critical: false,
    reason: 'Andros north-wind exposed-beach scenario from validation playbook; partial and exposed are both non-blue on the map.',
  },
  {
    regionId: 'south-aegean-andros',
    name: 'Piso Gyalia',
    sector: 'N',
    expectedGroup: 'notExposed',
    critical: false,
    reason: 'Andros north-wind sheltered alternative scenario from validation playbook; low-confidence geospatial output must not mark it exposed.',
  },
  {
    regionId: 'south-aegean-naxos',
    name: 'Mikri Vigla',
    sector: 'N',
    expectedGroup: 'notProtected',
    critical: false,
    reason: 'Known windy/watersports Naxos beach should not look sheltered in north wind; partial and exposed are both non-blue on the map.',
  },
];

const readJson = filePath => JSON.parse(readFileSync(filePath, 'utf8'));

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const isAllProtectedProfile = profile => (
  sectors.every(sector => profile.sectors?.[sector]?.level === 'protected')
);

const getRegionName = payload => (
  payload.region?.name?.en ||
  payload.region?.regionName ||
  payload.island?.name?.en ||
  payload.region?.id ||
  'Unknown'
);

const loadRegionExposure = regionId => {
  const filePath = path.join(exposureDirectory, `${regionId}.json`);
  assert(existsSync(filePath), `Missing geospatial exposure file for ${regionId}`);
  return readJson(filePath);
};

const loadAppRegion = regionId => {
  const filePath = path.join(appBeachDirectory, `${regionId}.json`);
  assert(existsSync(filePath), `Missing app beach file for ${regionId}`);
  return readJson(filePath);
};

const summarizeRegion = regionId => {
  const exposurePayload = loadRegionExposure(regionId);
  const appPayload = loadAppRegion(regionId);
  const beaches = appPayload.island?.beaches || [];
  const profiles = exposurePayload.profiles || {};
  const profileValues = Object.values(profiles);
  const hardIssues = [];
  const warnings = [];
  const levelTotals = { protected: 0, partial: 0, exposed: 0 };
  const sectorTotals = sectors.reduce((totals, sector) => {
    totals[sector] = { protected: 0, partial: 0, exposed: 0 };
    return totals;
  }, {});
  const uniformProfiles = [];
  const allProtectedProfiles = [];
  const legacyExposedConflicts = [];

  if (profileValues.length !== beaches.length) {
    hardIssues.push(`profile count ${profileValues.length} does not match app beach count ${beaches.length}`);
  }

  beaches.forEach(beach => {
    const profile = profiles[String(beach.id)];
    if (!profile) {
      hardIssues.push(`missing profile for beach ${beach.id} ${beach.name?.en || ''}`.trim());
      return;
    }

    const beachLevels = new Set();
    sectors.forEach(sector => {
      const sectorProfile = profile.sectors?.[sector];
      if (!sectorProfile || !validLevels.has(sectorProfile.level)) {
        hardIssues.push(`invalid ${sector} sector for beach ${beach.id} ${beach.name?.en || ''}`.trim());
        return;
      }

      beachLevels.add(sectorProfile.level);
      levelTotals[sectorProfile.level] += 1;
      sectorTotals[sector][sectorProfile.level] += 1;
    });

    if (beachLevels.size === 1) {
      const uniformLevel = Array.from(beachLevels)[0];
      uniformProfiles.push({
        beachId: beach.id,
        name: beach.name?.en || String(beach.id),
        level: uniformLevel,
      });

      if (uniformLevel === 'protected' && isAllProtectedProfile(profile)) {
        allProtectedProfiles.push({
          beachId: beach.id,
          name: beach.name?.en || String(beach.id),
        });
      }
    }

    (beach.protectedFrom || []).forEach(direction => {
      const sector = sectorByProtectedFrom[direction];
      if (!sector) return;

      const sectorProfile = profile.sectors?.[sector];
      if (sectorProfile?.level === 'exposed') {
        legacyExposedConflicts.push({
          beachId: beach.id,
          name: beach.name?.en || String(beach.id),
          sector,
          generatedLevel: sectorProfile.level,
        });
      }
    });
  });

  const distinctOverallLevels = Object.entries(levelTotals)
    .filter(([, count]) => count > 0)
    .map(([level]) => level);
  const totalSectorDecisions = profileValues.length * sectors.length;
  const uniformRate = beaches.length > 0 ? uniformProfiles.length / beaches.length : 0;

  if (beaches.length >= 8 && distinctOverallLevels.length < 3) {
    warnings.push(`only ${distinctOverallLevels.length} exposure levels appear across all sectors`);
  }

  if (beaches.length >= 8 && levelTotals.protected === 0) {
    warnings.push('no protected decisions across the region');
  }

  if (beaches.length >= 8 && levelTotals.exposed === 0) {
    warnings.push('no exposed decisions across the region');
  }

  if (beaches.length >= 8 && uniformRate > 0.35) {
    warnings.push(`${Math.round(uniformRate * 100)}% of beaches have the same level in all wind sectors`);
  }

  const flatSectors = sectors.filter(sector => (
    Object.values(sectorTotals[sector]).filter(count => count > 0).length === 1
  ));

  if (flatSectors.length >= 4 && beaches.length >= 8) {
    warnings.push(`${flatSectors.length}/8 wind sectors have a single level for every beach`);
  }

  const dominantLevelShare = totalSectorDecisions > 0
    ? Math.max(...Object.values(levelTotals)) / totalSectorDecisions
    : 0;

  if (dominantLevelShare > 0.78 && beaches.length >= 8) {
    warnings.push(`dominant exposure level covers ${Math.round(dominantLevelShare * 100)}% of decisions`);
  }

  if (allProtectedProfiles.length > 0) {
    warnings.push(`${allProtectedProfiles.length} generated profiles are protected in every wind sector and should be runtime-guarded`);
  }

  return {
    regionId,
    regionName: getRegionName(exposurePayload),
    beachCount: beaches.length,
    profileCount: profileValues.length,
    hardIssues,
    warnings,
    levelTotals,
    sectorTotals,
    uniformProfileCount: uniformProfiles.length,
    uniformProfileExamples: uniformProfiles.slice(0, 5),
    allProtectedProfileCount: allProtectedProfiles.length,
    allProtectedProfileExamples: allProtectedProfiles.slice(0, 5),
    legacyExposedConflictCount: legacyExposedConflicts.length,
    legacyExposedConflictExamples: legacyExposedConflicts.slice(0, 8),
    status: hardIssues.length > 0 ? 'fail' : warnings.length > 0 ? 'review' : 'pass',
  };
};

const evaluateGlobalProfileQuality = regionIds => {
  const allProtectedProfiles = [];
  const missingSectorProfiles = [];

  regionIds.forEach(regionId => {
    const exposurePayload = loadRegionExposure(regionId);
    Object.values(exposurePayload.profiles || {}).forEach(profile => {
      const missingSectors = sectors.filter(sector => !profile.sectors?.[sector]);
      if (missingSectors.length > 0) {
        missingSectorProfiles.push({
          regionId,
          beachId: profile.beachId,
          missingSectors,
        });
      }

      if (isAllProtectedProfile(profile)) {
        allProtectedProfiles.push({
          regionId,
          beachId: profile.beachId,
        });
      }
    });
  });

  return {
    allProtectedProfileCount: allProtectedProfiles.length,
    allProtectedAffectedRegionCount: new Set(allProtectedProfiles.map(profile => profile.regionId)).size,
    allProtectedExamples: allProtectedProfiles.slice(0, 12),
    missingSectorProfileCount: missingSectorProfiles.length,
    missingSectorExamples: missingSectorProfiles.slice(0, 12),
  };
};

const evaluateSampleChecks = () => sampleChecks.map(check => {
  const appPayload = loadAppRegion(check.regionId);
  const exposurePayload = loadRegionExposure(check.regionId);
  const beach = (appPayload.island?.beaches || []).find(item => item.name?.en === check.name);
  const actual = beach
    ? exposurePayload.profiles?.[String(beach.id)]?.sectors?.[check.sector]?.level
    : undefined;
  const expectedLevels = check.expected
    ? [check.expected]
    : check.expectedGroup === 'notExposed'
      ? ['protected', 'partial']
    : check.expectedGroup === 'notProtected'
      ? ['partial', 'exposed']
      : [];

  return {
    ...check,
    beachId: beach?.id,
    actual,
    expectedLevels,
    passed: expectedLevels.includes(actual),
  };
});

assert(existsSync(indexPath), `Missing geospatial exposure index: ${indexPath}`);

const index = readJson(indexPath);
assert(index.schemaVersion === 1, 'Geospatial exposure index schemaVersion must be 1.');
assert(index.summary?.generatedProfiles === index.summary?.beachCount, 'All generated profiles must match beach count.');
assert(index.summary?.missingCoordinates === 0, 'Geospatial exposure generation must have no missing coordinates.');
assert(index.source?.landMask?.confidence === 'low', 'Geospatial exposure source must remain low-confidence.');

const allRegionIds = Object.keys(index.summary?.regions || {});
const representativeReports = representativeRegionIds.map(summarizeRegion);
const globalProfileQuality = evaluateGlobalProfileQuality(allRegionIds);
const sampleResults = evaluateSampleChecks();
const failedCriticalSamples = sampleResults.filter(result => result.critical && !result.passed);
const failedReviewSamples = sampleResults.filter(result => !result.critical && !result.passed);
const failedRegions = representativeReports.filter(report => report.status === 'fail');
const reviewRegions = representativeReports.filter(report => report.status === 'review');

let rolloutRecommendation = 'safe_to_enable_low_confidence_map_fallback';
if (failedRegions.length > 0 || failedCriticalSamples.length > 0) {
  rolloutRecommendation = 'blocked_until_hard_failures_are_fixed';
} else if (reviewRegions.length > 0 || failedReviewSamples.length > 0) {
  rolloutRecommendation = 'review_needed_before_all_greece_rollout';
} else if (globalProfileQuality.allProtectedProfileCount > 0) {
  rolloutRecommendation = 'safe_to_enable_low_confidence_map_fallback_with_runtime_guard';
}

console.log(JSON.stringify({
  coverage: {
    regionCount: index.summary.regionCount,
    beachCount: index.summary.beachCount,
    generatedProfiles: index.summary.generatedProfiles,
    missingCoordinates: index.summary.missingCoordinates,
    sourceConfidence: index.source.landMask.confidence,
  },
  representativeRegionCount: representativeReports.length,
  representativeStatus: {
    pass: representativeReports.filter(report => report.status === 'pass').length,
    review: reviewRegions.length,
    fail: failedRegions.length,
  },
  sampleChecks: {
    pass: sampleResults.filter(result => result.passed).length,
    reviewFailures: failedReviewSamples.length,
    criticalFailures: failedCriticalSamples.length,
    results: sampleResults,
  },
  globalProfileQuality,
  rolloutRecommendation,
  representativeReports,
}, null, 2));
