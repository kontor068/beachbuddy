import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const beachesPath = path.join(rootDir, 'public', 'greek_beaches.json');
const exposureDir = path.join(rootDir, 'public', 'data', 'geospatial', 'exposure');

const windDirectionBySector = {
  N: 'North',
  NE: 'Northeast',
  E: 'East',
  SE: 'Southeast',
  S: 'South',
  SW: 'Southwest',
  W: 'West',
  NW: 'Northwest',
};

const sectors = Object.keys(windDirectionBySector);

const normalizeDegrees = value => ((value % 360) + 360) % 360;

const sectorFromDegrees = degrees => {
  const normalized = normalizeDegrees(degrees);
  return sectors[Math.round(normalized / 45) % sectors.length];
};

const slug = value => String(value || 'unknown')
  .toLowerCase()
  .trim()
  .replace(/\s+/g, '-')
  .replace(/[^a-z0-9-]/g, '');

const regionIdFor = (region, prefecture, fallbackId) => {
  const base = `${region || 'Unknown'}-${prefecture || region || 'Unknown'}`;
  return slug(base) || `unknown-${fallbackId}`;
};

const readExposureProfiles = regionId => {
  const filePath = path.join(exposureDir, `${regionId}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return data.profiles || {};
};

const isCycladesBeach = (region, pathParts) => (
  region === 'South Aegean' && pathParts[0] === 'Cyclades'
);

const hasCoordinates = item => {
  const lat = typeof item?.lat === 'number' ? item.lat : Number(item?.lat);
  const lon = typeof item?.lon === 'number' ? item.lon : Number(item?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon);
};

const source = JSON.parse(fs.readFileSync(beachesPath, 'utf8'));
const exposureByRegion = new Map();
const missing = [];
const touchedRegions = new Map();

let idCounter = 0;
let cycladesTotal = 0;
let alreadyHadOrientation = 0;
let addedOrientation = 0;
let skippedNoMetadata = 0;
let skippedNoExposureProfile = 0;
let skippedNoFacing = 0;

const getProfiles = (regionId) => {
  if (!exposureByRegion.has(regionId)) {
    exposureByRegion.set(regionId, readExposureProfiles(regionId));
  }
  return exposureByRegion.get(regionId);
};

const addMissing = (reason, beach) => {
  missing.push({
    reason,
    id: beach.id,
    regionId: beach.regionId,
    prefecture: beach.prefecture,
    name: beach.name,
  });
};

const walk = (node, region, pathParts) => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const currentId = idCounter;
      if (hasCoordinates(item)) {
        const prefecture = pathParts[pathParts.length - 1] || pathParts[0] || 'Unknown';
        const regionId = regionIdFor(region, prefecture, currentId);

        if (isCycladesBeach(region, pathParts)) {
          cycladesTotal += 1;
          const beachInfo = {
            id: currentId,
            regionId,
            prefecture,
            name: item.name || 'Unknown',
          };

          if (item.metadata?.orientation) {
            alreadyHadOrientation += 1;
          } else if (!item.metadata || typeof item.metadata !== 'object') {
            skippedNoMetadata += 1;
            addMissing('missing metadata object', beachInfo);
          } else {
            const profiles = getProfiles(regionId);
            const profile = profiles?.[String(currentId)];

            if (!profile) {
              skippedNoExposureProfile += 1;
              addMissing('missing geospatial exposure profile', beachInfo);
            } else if (typeof profile.facingDeg !== 'number' || !Number.isFinite(profile.facingDeg)) {
              skippedNoFacing += 1;
              addMissing('missing geospatial facingDeg', beachInfo);
            } else {
              const degrees = Math.round(normalizeDegrees(profile.facingDeg) * 10) / 10;
              const faceSector = sectorFromDegrees(degrees);
              item.metadata.orientation = {
                degrees,
                faces: [windDirectionBySector[faceSector]],
                protectedFrom: [],
                confidence: 'medium',
                notes: 'Generated from Natural Earth geospatial exposure facingDeg. This records shoreline-facing direction only; it does not verify shelter, low-wave behavior, or live sea conditions.',
              };
              addedOrientation += 1;
              touchedRegions.set(regionId, (touchedRegions.get(regionId) || 0) + 1);
            }
          }
        }

        idCounter += 1;
      }
    }
    return;
  }

  if (!node || typeof node !== 'object') return;

  for (const [key, value] of Object.entries(node)) {
    walk(value, region, [...pathParts, key]);
  }
};

for (const [region, regionNode] of Object.entries(source)) {
  walk(regionNode, region, []);
}

fs.writeFileSync(beachesPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

const report = {
  cycladesTotal,
  alreadyHadOrientation,
  addedOrientation,
  withOrientation: alreadyHadOrientation + addedOrientation,
  missingOrientation: cycladesTotal - alreadyHadOrientation - addedOrientation,
  skippedNoMetadata,
  skippedNoExposureProfile,
  skippedNoFacing,
  touchedRegions: Object.fromEntries([...touchedRegions.entries()].sort()),
  missing,
};

console.log(JSON.stringify(report, null, 2));
