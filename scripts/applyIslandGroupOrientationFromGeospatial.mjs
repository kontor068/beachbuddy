import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const beachesPath = path.join(rootDir, 'public', 'greek_beaches.json');
const exposureDir = path.join(rootDir, 'public', 'data', 'geospatial', 'exposure');

const args = new Map(process.argv.slice(2).map(arg => {
  const [key, ...valueParts] = arg.replace(/^--/, '').split('=');
  return [key, valueParts.join('=') || '1'];
}));

const group = (args.get('group') || 'cyclades').toLowerCase();
const write = args.get('write') !== 'false';
const allowMissing = args.get('allow-missing') === 'true';

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

const groupMatchers = {
  cyclades: (region, pathParts) => region === 'South Aegean' && pathParts[0] === 'Cyclades',
  dodecanese: (region, pathParts) => region === 'South Aegean' && pathParts[0] === 'Dodecanese',
  ionian: (region, pathParts) => (
    region === 'Ionian Islands' ||
    (region === 'Attica' && pathParts.includes('Kythira'))
  ),
  argosaronic: (region, pathParts) => (
    region === 'Attica' &&
    pathParts.includes('Islands (Saronic & Kythira)') &&
    ['Aegina', 'Agistri', 'Hydra', 'Poros', 'Salamina', 'Spetses', 'Methana'].some(island => pathParts.includes(island))
  ),
  attica: (region, pathParts) => (
    region === 'Attica' &&
    !pathParts.includes('Islands (Saronic & Kythira)')
  ),
  mainland_central: (region, pathParts) => (
    (region === 'Central Greece' && ['Fokida', 'Fthiotida', 'Viotia'].includes(pathParts[0])) ||
    (region === 'West Greece' && ['Aetolia-Acarnania', 'Ileia'].includes(pathParts[0]))
  ),
  crete: (region) => region === 'Crete',
  euboea: (region, pathParts) => region === 'Central Greece' && pathParts[0] === 'Evia' && pathParts[1] === 'Evia',
  thasos: (region, pathParts) => region === 'East Macedonia and Thrace' && pathParts[0] === 'Thasos' && pathParts[1] === 'Thasos',
  standalone_islands: (region, pathParts) => (
    (region === 'Central Greece' && pathParts[0] === 'Evia' && pathParts[1] === 'Evia') ||
    (region === 'East Macedonia and Thrace' && pathParts[0] === 'Thasos' && pathParts[1] === 'Thasos')
  ),
  sporades: (region, pathParts) => (
    (region === 'Thessaly' && ['Alonissos', 'Skiathos', 'Skopelos'].some(island => pathParts.includes(island))) ||
    (region === 'Central Greece' && pathParts.includes('Skyros'))
  ),
  north_aegean: (region, pathParts) => (
    region === 'North Aegean' ||
    (region === 'East Macedonia and Thrace' && pathParts.includes('Samothraki'))
  ),
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

const matchesGroup = (region, pathParts) => {
  const matcher = groupMatchers[group];
  if (!matcher) {
    throw new Error(`Unsupported --group=${group}. Supported: ${Object.keys(groupMatchers).join(', ')}`);
  }
  return matcher(region, pathParts);
};

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
let groupTotal = 0;
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

        if (matchesGroup(region, pathParts)) {
          groupTotal += 1;
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

if (write) {
  fs.writeFileSync(beachesPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
}

const report = {
  group,
  write,
  allowMissing,
  groupTotal,
  alreadyHadOrientation,
  addedOrientation,
  withOrientation: alreadyHadOrientation + addedOrientation,
  missingOrientation: groupTotal - alreadyHadOrientation - addedOrientation,
  skippedNoMetadata,
  skippedNoExposureProfile,
  skippedNoFacing,
  touchedRegions: Object.fromEntries([...touchedRegions.entries()].sort()),
  missing,
};

console.log(JSON.stringify(report, null, 2));

if (report.missingOrientation > 0 && !allowMissing) {
  process.exitCode = 1;
}
