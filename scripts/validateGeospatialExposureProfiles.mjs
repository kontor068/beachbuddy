import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exposureDirectory = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const indexPath = path.join(exposureDirectory, 'index.json');
const validSectors = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const validLevels = new Set(['protected', 'partial', 'exposed']);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const readJson = filePath => JSON.parse(readFileSync(filePath, 'utf8'));

assert(existsSync(indexPath), `Missing geospatial exposure index: ${indexPath}`);

const index = readJson(indexPath);
assert(index.schemaVersion === 1, 'Geospatial exposure index schemaVersion must be 1.');
assert(index.summary?.regionCount > 0, 'Geospatial exposure index must include regions.');
assert(index.summary?.generatedProfiles === index.summary?.beachCount, 'All beaches should have generated exposure profiles.');
assert(index.summary?.missingCoordinates === 0, 'Generated exposure profiles should have no missing coordinates.');

let profileCount = 0;
let regionCount = 0;
const levelTotals = { protected: 0, partial: 0, exposed: 0 };

Object.entries(index.summary.regions || {}).forEach(([regionId, regionSummary]) => {
  const regionPath = path.join(exposureDirectory, `${regionId}.json`);
  assert(existsSync(regionPath), `Missing region exposure profile: ${regionId}`);

  const regionPayload = readJson(regionPath);
  assert(regionPayload.schemaVersion === 1, `${regionId}: schemaVersion must be 1.`);
  assert(regionPayload.region?.id === regionId, `${regionId}: region id mismatch.`);
  assert(regionPayload.summary?.generatedProfiles === regionSummary.generatedProfiles, `${regionId}: generated profile count mismatch.`);

  const profiles = Object.values(regionPayload.profiles || {});
  assert(profiles.length === regionSummary.generatedProfiles, `${regionId}: profile object count mismatch.`);

  profiles.forEach(profile => {
    assert(typeof profile.beachId === 'number', `${regionId}: profile beachId must be a number.`);
    assert(typeof profile.coordinates?.lat === 'number' && typeof profile.coordinates?.lon === 'number', `${regionId}/${profile.beachId}: coordinates missing.`);

    validSectors.forEach(sector => {
      const sectorProfile = profile.sectors?.[sector];
      assert(sectorProfile, `${regionId}/${profile.beachId}: missing ${sector} sector.`);
      assert(validLevels.has(sectorProfile.level), `${regionId}/${profile.beachId}: invalid ${sector} level.`);
      assert(typeof sectorProfile.fetchKm === 'number' && sectorProfile.fetchKm >= 0, `${regionId}/${profile.beachId}: invalid ${sector} fetchKm.`);
      assert(typeof sectorProfile.blockedRayRatio === 'number' && sectorProfile.blockedRayRatio >= 0 && sectorProfile.blockedRayRatio <= 1, `${regionId}/${profile.beachId}: invalid ${sector} blockedRayRatio.`);
      levelTotals[sectorProfile.level] += 1;
    });
  });

  profileCount += profiles.length;
  regionCount += 1;
});

const milos = readJson(path.join(exposureDirectory, 'south-aegean-milos.json')).profiles;
assert(milos['1922']?.sectors?.N?.level === 'exposed', 'Milos sanity: Sarakiniko should be north-exposed in the baseline model.');
assert(milos['1901']?.sectors?.S?.level === 'exposed', 'Milos sanity: Agia Kyriaki should be south-exposed in the baseline model.');
assert(milos['1917']?.sectors?.N?.level === 'protected', 'Milos sanity: Papikinou should be less exposed to north wind in the baseline model.');

console.log(JSON.stringify({
  regionCount,
  profileCount,
  expectedRegionCount: index.summary.regionCount,
  expectedProfileCount: index.summary.generatedProfiles,
  levelTotals,
  sourceConfidence: index.source?.landMask?.confidence,
}, null, 2));
