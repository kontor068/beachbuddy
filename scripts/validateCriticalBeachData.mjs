import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appBeachDir = path.join(rootDir, 'public', 'data', 'beaches', 'app');
const photoDataDir = path.join(rootDir, 'src', 'data');

const allowedBeachTypes = new Set(['sandy', 'pebbles', 'sandy-pebbles', 'rocky', 'unknown']);
const allowedAccessibility = new Set(['EASY', 'MODERATE', 'DIFFICULT', 'BOAT_ONLY']);
const allowedWindDirections = new Set([
  'North',
  'Northeast',
  'East',
  'Southeast',
  'South',
  'Southwest',
  'West',
  'Northwest',
]);

const findings = [];

const addFinding = (severity, file, message, context = '') => {
  findings.push({
    severity,
    file: path.relative(rootDir, file).replaceAll(path.sep, '/'),
    message,
    context,
  });
};

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;

const isGreeceCoordinate = coordinates => (
  coordinates &&
  isFiniteNumber(coordinates.lat) &&
  isFiniteNumber(coordinates.lon) &&
  coordinates.lat >= 34 &&
  coordinates.lat <= 42.5 &&
  coordinates.lon >= 19 &&
  coordinates.lon <= 30.5
);

const knownIslandCoordinateBounds = {
  'south-aegean-milos': {
    label: 'Milos',
    minLat: 36.63,
    maxLat: 36.78,
    minLon: 24.29,
    maxLon: 24.56,
  },
  'south-aegean-kimolos': {
    label: 'Kimolos',
    minLat: 36.77,
    maxLat: 36.845,
    minLon: 24.515,
    maxLon: 24.605,
  },
  'south-aegean-polyaigos': {
    label: 'Polyaigos',
    minLat: 36.755,
    maxLat: 36.795,
    minLon: 24.606,
    maxLon: 24.685,
  },
  'south-aegean-andros': {
    label: 'Andros',
    areas: [
      { minLat: 37.70, maxLat: 38.05, minLon: 24.62, maxLon: 25.02 },
    ],
  },
  'south-aegean-tinos': {
    label: 'Tinos',
    areas: [
      { minLat: 37.50, maxLat: 37.69, minLon: 24.98, maxLon: 25.28 },
    ],
  },
  'south-aegean-mykonos': {
    label: 'Mykonos',
    areas: [
      { minLat: 37.39, maxLat: 37.50, minLon: 25.29, maxLon: 25.48 },
    ],
  },
  'south-aegean-serifos': {
    label: 'Serifos',
    areas: [
      { minLat: 37.10, maxLat: 37.215, minLon: 24.40, maxLon: 24.56 },
    ],
  },
  'south-aegean-sifnos': {
    label: 'Sifnos',
    areas: [
      { minLat: 36.89, maxLat: 37.04, minLon: 24.64, maxLon: 24.78 },
    ],
  },
  'south-aegean-syros': {
    label: 'Syros',
    areas: [
      { minLat: 37.36, maxLat: 37.52, minLon: 24.86, maxLon: 25.02 },
    ],
  },
  'crete-crete-heraklion': {
    label: 'Crete (Heraklion)',
    areas: [
      { minLat: 35.28, maxLat: 35.43, minLon: 24.90, maxLon: 25.50 },
      { minLat: 34.90, maxLat: 35.10, minLon: 24.70, maxLon: 25.15 },
      { minLat: 34.95, maxLat: 35.03, minLon: 25.20, maxLon: 25.43 },
    ],
  },
  'crete-crete-rethymno': {
    label: 'Crete (Rethymno)',
    areas: [
      { minLat: 35.25, maxLat: 35.45, minLon: 24.30, maxLon: 24.85 },
      { minLat: 34.90, maxLat: 35.25, minLon: 24.28, maxLon: 24.72 },
    ],
  },
  'crete-crete-chania': {
    label: 'Crete (Chania)',
    areas: [
      { minLat: 35.15, maxLat: 35.70, minLon: 23.45, maxLon: 24.285 },
    ],
  },
  'crete-crete-lasithi': {
    label: 'Crete (Lasithi)',
    areas: [
      { minLat: 34.80, maxLat: 35.38, minLon: 25.50, maxLon: 26.36 },
    ],
  },
  'epirus-arta-mainland': {
    label: 'Arta (mainland)',
    areas: [
      { minLat: 38.99, maxLat: 39.09, minLon: 20.74, maxLon: 20.98 },
    ],
  },
  'epirus-thesprotia-mainland': {
    label: 'Thesprotia (mainland)',
    areas: [
      { minLat: 39.31, maxLat: 39.66, minLon: 20.13, maxLon: 20.34 },
    ],
  },
  'epirus-preveza-mainland': {
    label: 'Preveza (mainland)',
    areas: [
      { minLat: 39.10, maxLat: 39.31, minLon: 20.32, maxLon: 20.62 },
      { minLat: 38.93, maxLat: 39.13, minLon: 20.58, maxLon: 20.78 },
    ],
  },
  'south-aegean-naxos': {
    label: 'Naxos',
    areas: [
      { minLat: 36.88, maxLat: 37.24, minLon: 25.32, maxLon: 25.61 },
    ],
    exclusions: [
      { minLat: 36.895, maxLat: 36.922, minLon: 25.55, maxLon: 25.595 },
      { minLat: 36.925, maxLat: 36.955, minLon: 25.59, maxLon: 25.66 },
      { minLat: 36.84, maxLat: 36.90, minLon: 25.49, maxLon: 25.55 },
      { minLat: 36.81, maxLat: 36.89, minLon: 25.38, maxLon: 25.50 },
    ],
  },
  'peloponnese-argolida-mainland': {
    label: 'Argolida (mainland)',
    areas: [
      { minLat: 37.50, maxLat: 37.665, minLon: 22.70, maxLon: 23.01 },
      { minLat: 37.47, maxLat: 37.52, minLon: 23.00, maxLon: 23.08 },
      { minLat: 37.60, maxLat: 37.67, minLon: 23.10, maxLon: 23.19 },
      { minLat: 37.29, maxLat: 37.47, minLon: 23.08, maxLon: 23.36 },
      { minLat: 37.38, maxLat: 37.47, minLon: 23.30, maxLon: 23.43 },
    ],
  },
  'south-aegean-koufonisia': {
    label: 'Koufonisia',
    areas: [
      { minLat: 36.895, maxLat: 36.922, minLon: 25.55, maxLon: 25.595 },
      { minLat: 36.925, maxLat: 36.955, minLon: 25.59, maxLon: 25.66 },
    ],
  },
  'south-aegean-paros': {
    label: 'Paros',
    areas: [
      { minLat: 36.97, maxLat: 37.155, minLon: 25.095, maxLon: 25.31 },
    ],
  },
  'south-aegean-antiparos': {
    label: 'Antiparos',
    areas: [
      { minLat: 36.93, maxLat: 37.055, minLon: 24.98, maxLon: 25.095 },
    ],
  },
  'south-aegean-rhodes': {
    label: 'Rhodes',
    areas: [
      { minLat: 35.86, maxLat: 36.53, minLon: 27.67, maxLon: 28.28 },
    ],
  },
  'south-aegean-kos': {
    label: 'Kos',
    areas: [
      { minLat: 36.68, maxLat: 36.915, minLon: 26.88, maxLon: 27.39 },
    ],
  },
  'ionian-islands-ithaca': {
    label: 'Ithaca',
    minLat: 38.30,
    maxLat: 38.49,
    minLon: 20.625,
    maxLon: 20.76,
  },
  'ionian-islands-kefalonia': {
    label: 'Kefalonia',
    areas: [
      { minLat: 38.04, maxLat: 38.50, minLon: 20.34, maxLon: 20.825 },
    ],
    exclusions: [
      { minLat: 38.30, maxLat: 38.49, minLon: 20.625, maxLon: 20.76 },
    ],
  },
  'central-greece-evia': {
    label: 'Evia',
    areas: [
      { minLat: 38.62, maxLat: 39.08, minLon: 22.88, maxLon: 23.98 },
      { minLat: 38.22, maxLat: 38.82, minLon: 23.18, maxLon: 24.24 },
      { minLat: 37.88, maxLat: 38.25, minLon: 24.18, maxLon: 24.66 },
    ],
    exclusions: [
      { minLat: 38.60, maxLat: 38.78, minLon: 22.88, maxLon: 23.22 },
      { minLat: 38.90, maxLat: 39.08, minLon: 22.88, maxLon: 23.02 },
      { minLat: 38.20, maxLat: 38.37, minLon: 23.60, maxLon: 24.05 },
      { minLat: 38.65, maxLat: 39.05, minLon: 24.20, maxLon: 24.80 },
    ],
  },
  'central-macedonia-halkidiki-mainland': {
    label: 'Halkidiki (mainland)',
    areas: [
      { minLat: 39.90, maxLat: 40.36, minLon: 23.02, maxLon: 23.58 },
      { minLat: 39.90, maxLat: 40.26, minLon: 23.55, maxLon: 24.05 },
      { minLat: 40.22, maxLat: 40.43, minLon: 23.65, maxLon: 24.08 },
      { minLat: 40.35, maxLat: 40.62, minLon: 23.76, maxLon: 24.05 },
    ],
    exclusions: [
      { minLat: 40.62, maxLat: 40.80, minLon: 23.65, maxLon: 24.20 },
    ],
  },
  'central-macedonia-thessaloniki-area': {
    label: 'Thessaloniki area',
    areas: [
      { minLat: 40.33, maxLat: 40.66, minLon: 22.75, maxLon: 23.04 },
      { minLat: 40.61, maxLat: 40.78, minLon: 23.64, maxLon: 23.82 },
    ],
  },
};

const isCoordinateInsideBox = (coordinates, bounds) => (
  isFiniteNumber(coordinates?.lat) &&
  isFiniteNumber(coordinates?.lon) &&
  coordinates.lat >= bounds.minLat &&
  coordinates.lat <= bounds.maxLat &&
  coordinates.lon >= bounds.minLon &&
  coordinates.lon <= bounds.maxLon
);

const isWithinKnownIslandBounds = (regionId, coordinates) => {
  const bounds = knownIslandCoordinateBounds[regionId];
  if (!bounds) return true;
  const areas = Array.isArray(bounds.areas) ? bounds.areas : [bounds];
  const exclusions = Array.isArray(bounds.exclusions) ? bounds.exclusions : [];
  return areas.some(area => isCoordinateInsideBox(coordinates, area)) &&
    !exclusions.some(exclusion => isCoordinateInsideBox(coordinates, exclusion));
};

const getKnownIslandCoordinateRegion = coordinates => {
  for (const regionId of Object.keys(knownIslandCoordinateBounds)) {
    if (isWithinKnownIslandBounds(regionId, coordinates)) {
      return regionId;
    }
  }
  return '';
};

const beachLabel = beach => {
  const name = beach?.name?.en || beach?.name?.gr || 'unknown beach';
  return `id=${beach?.id ?? 'missing'}, name=${name}`;
};

const readJson = async filePath => {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
};

const listTopLevelJsonFiles = async dirPath => {
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json'))
    .map(entry => path.join(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
};

const listMatchingJsonFiles = async (dirPath, pattern) => {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile() && pattern.test(entry.name))
      .map(entry => path.join(dirPath, entry.name))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    return [];
  }
};

const validateBeach = (filePath, regionId, beach, regionIds) => {
  if (!Number.isInteger(beach?.id)) {
    addFinding('critical', filePath, 'Beach is missing a numeric id.', beachLabel(beach));
  }

  if (!isNonEmptyString(beach?.name?.en) && !isNonEmptyString(beach?.name?.gr)) {
    addFinding('critical', filePath, 'Beach is missing both English and Greek names.', beachLabel(beach));
  }

  if (!isGreeceCoordinate(beach?.coordinates)) {
    addFinding('critical', filePath, 'Beach coordinates are missing, invalid, or outside the Greece bounding box.', beachLabel(beach));
  } else if (!isWithinKnownIslandBounds(regionId, beach.coordinates)) {
    const matchingRegionId = getKnownIslandCoordinateRegion(beach.coordinates);
    const target = matchingRegionId ? ` Likely region: ${matchingRegionId}.` : '';
    addFinding(
      'high',
      filePath,
      `Beach coordinates are outside the known bounds for ${regionId}.${target}`,
      `${beachLabel(beach)}, coordinates=${beach.coordinates.lat},${beach.coordinates.lon}`
    );
  }

  if (!allowedBeachTypes.has(beach?.beachType)) {
    addFinding('high', filePath, `Invalid beachType "${beach?.beachType}".`, beachLabel(beach));
  }

  if (!allowedAccessibility.has(beach?.accessibility)) {
    addFinding('high', filePath, `Invalid accessibility "${beach?.accessibility}".`, beachLabel(beach));
  }

  if (!Array.isArray(beach?.protectedFrom)) {
    addFinding('high', filePath, 'protectedFrom must be an array, even when it is only legacy fallback data.', beachLabel(beach));
  } else {
    const invalidDirections = beach.protectedFrom.filter(direction => !allowedWindDirections.has(direction));
    if (invalidDirections.length > 0) {
      addFinding('high', filePath, `protectedFrom contains invalid wind directions: ${invalidDirections.join(', ')}.`, beachLabel(beach));
    }
  }

  if (beach?.environment?.quiet === true && beach?.amenities?.beachBar === true) {
    addFinding('high', filePath, 'Beach is marked quiet while also having a beach bar.', beachLabel(beach));
  }

  if (beach?.characteristics?.shallowWaters === true && beach?.characteristics?.deepWaters === true) {
    addFinding('medium', filePath, 'Beach is marked as both shallow and deep water.', beachLabel(beach));
  }

  if (beach?.location?.island && isNonEmptyString(regionId)) {
    regionIds.add(`${regionId}:${beach.location.island}`);
  }
};

const validateBeachRegionFile = async (filePath, seenBeachIds) => {
  let data;
  try {
    data = await readJson(filePath);
  } catch (error) {
    addFinding('critical', filePath, `Invalid JSON: ${error.message}`);
    return;
  }

  const regionId = data?.region?.id || data?.island?.id || path.basename(filePath, '.json');
  const beaches = data?.island?.beaches;

  if (!isNonEmptyString(regionId)) {
    addFinding('critical', filePath, 'Region file is missing region/island id.');
  }

  if (!Array.isArray(beaches) || beaches.length === 0) {
    addFinding('critical', filePath, 'Region file has no island.beaches array.');
    return;
  }

  if (isFiniteNumber(data?.region?.beachCount) && data.region.beachCount !== beaches.length) {
    addFinding('high', filePath, `region.beachCount is ${data.region.beachCount}, but island.beaches has ${beaches.length} items.`);
  }

  const regionBeachIds = new Set();
  const regionIds = new Set();

  for (const beach of beaches) {
    validateBeach(filePath, regionId, beach, regionIds);

    if (!Number.isInteger(beach?.id)) {
      continue;
    }

    if (regionBeachIds.has(beach.id)) {
      addFinding('critical', filePath, `Duplicate beach id inside region: ${beach.id}.`, beachLabel(beach));
    }
    regionBeachIds.add(beach.id);

    const previousFile = seenBeachIds.get(beach.id);
    if (previousFile && previousFile !== filePath) {
      addFinding('critical', filePath, `Beach id ${beach.id} also appears in ${path.relative(rootDir, previousFile).replaceAll(path.sep, '/')}.`, beachLabel(beach));
    } else {
      seenBeachIds.set(beach.id, filePath);
    }
  }
};

const validateVerifiedPhoto = (filePath, photo) => {
  const context = `beachId=${photo?.beachId ?? 'missing'}, name=${photo?.beachName ?? photo?.name ?? 'unknown'}`;
  if (photo?.imageStatus !== 'verified') {
    return;
  }

  if (!isNonEmptyString(photo.imageUrl)) {
    addFinding('critical', filePath, 'Verified photo is missing imageUrl.', context);
  }
  if (!isNonEmptyString(photo.license) || photo.license === 'unknown') {
    addFinding('critical', filePath, 'Verified photo is missing a usable license.', context);
  }
  if (!isNonEmptyString(photo.licenseUrl)) {
    addFinding('high', filePath, 'Verified photo is missing licenseUrl.', context);
  }
  if (!isNonEmptyString(photo.attributionText)) {
    addFinding('high', filePath, 'Verified photo is missing attributionText.', context);
  }
};

const validatePhotoData = async () => {
  const photoFiles = await listMatchingJsonFiles(photoDataDir, /^beachImages\..+\.json$/);

  for (const filePath of photoFiles) {
    let data;
    try {
      data = await readJson(filePath);
    } catch (error) {
      addFinding('critical', filePath, `Invalid photo JSON: ${error.message}`);
      continue;
    }

    const photos = Array.isArray(data) ? data : Object.values(data).flat();
    photos.forEach(photo => validateVerifiedPhoto(filePath, photo));
  }
};

const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };

const printReport = (regionFileCount, beachCount) => {
  findings.sort((a, b) => {
    const severityDelta = severityRank[a.severity] - severityRank[b.severity];
    if (severityDelta !== 0) return severityDelta;
    const fileDelta = a.file.localeCompare(b.file);
    if (fileDelta !== 0) return fileDelta;
    return a.message.localeCompare(b.message);
  });

  const counts = findings.reduce((acc, finding) => {
    acc[finding.severity] = (acc[finding.severity] || 0) + 1;
    return acc;
  }, {});

  console.log('Critical Beach Data Quality Validation');
  console.log(`Region files: ${regionFileCount}`);
  console.log(`Beaches scanned: ${beachCount}`);
  console.log(`Findings: ${findings.length} (critical ${counts.critical || 0}, high ${counts.high || 0}, medium ${counts.medium || 0}, low ${counts.low || 0})`);

  if (findings.length === 0) {
    console.log('No critical beach data issues found.');
    return;
  }

  console.log('');
  findings.slice(0, 80).forEach(finding => {
    console.log(`- ${finding.severity.toUpperCase()} ${finding.file}`);
    console.log(`  ${finding.message}`);
    if (finding.context) {
      console.log(`  ${finding.context}`);
    }
  });

  if (findings.length > 80) {
    console.log(`... ${findings.length - 80} more findings omitted from console output.`);
  }
};

const main = async () => {
  const regionFiles = await listTopLevelJsonFiles(appBeachDir);
  const seenBeachIds = new Map();

  for (const filePath of regionFiles) {
    await validateBeachRegionFile(filePath, seenBeachIds);
  }

  await validatePhotoData();

  printReport(regionFiles.length, seenBeachIds.size);

  const blockingFindings = findings.filter(finding => finding.severity === 'critical' || finding.severity === 'high');
  if (blockingFindings.length > 0) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error('Critical beach data validation failed to run.');
  console.error(error);
  process.exitCode = 1;
});
