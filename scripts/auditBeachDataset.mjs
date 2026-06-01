import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const defaultOutputDir = path.join(rootDir, '.tmp', 'beach-audits');

const allowedBeachTypes = new Set(['sandy', 'pebbles', 'sandy-pebbles', 'rocky']);
const allowedAccessibility = new Set(['EASY', 'MODERATE', 'DIFFICULT', 'BOAT_ONLY']);
const allowedWaterDepth = new Set(['shallow', 'medium', 'deep']);
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
const allowedAccessTypes = new Set([
  'asphalt_road',
  'passable_dirt_road',
  '4x4_only',
  'hiking_path_easy',
  'hiking_path_difficult',
  'boat_only',
  'unknown',
]);
const allowedTerrainTypes = new Set(['fine_sand', 'coarse_sand', 'pebbles', 'large_stones', 'rocks']);
const allowedConfidence = new Set(['high', 'medium', 'low', 'unknown']);
const allowedBooleanFeatureKeys = {
  amenities: new Set(['organized', 'naturalShade', 'taverna', 'beachBar', 'sunbeds', 'restaurant', 'parking']),
  characteristics: new Set(['deepWaters', 'shallowWaters']),
  activities: new Set(['snorkeling', 'surfing']),
  environment: new Set(['quiet', 'remote', 'familyFriendly']),
};
const severityOrder = { BLOCKER: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const duplicateCoordinateDistanceMeters = 20;
const likelyDuplicateNameDistanceMeters = 100;
const possibleDuplicateNameDistanceMeters = 1000;
const coverageNearbyMatchMeters = 250;
const coveragePossibleAliasMeters = 750;
const coverageNeedsSourceReviewMeters = 1500;
const coverageCoordinateMismatchMeters = 1000;
const overpassUrl = 'https://overpass-api.de/api/interpreter';
const greeceBounds = { south: 34, west: 19, north: 42.5, east: 30.5 };

const acceptedSharedNamePairs = new Map([]);
const externalCoverageReviewDecisions = new Map([
  ['https://www.openstreetmap.org/way/374311369', {
    scopeIds: new Set(['crete-crete-chania']),
    issueType: 'external_candidate_accepted_existing_section',
    humanSummary: 'Accepted existing section: OSM Elafonisi point is a section of the already covered Elafonisi lagoon/beach area.',
    evidenceNote: 'Elafonisi is a broad lagoon/beach area; this OSM way is accepted as covered by the existing BeachBuddy Elafonisi record.',
  }],
  ['https://www.openstreetmap.org/way/839761934', {
    scopeIds: new Set(['crete-crete-chania']),
    issueType: 'external_candidate_accepted_existing_section',
    humanSummary: 'Accepted existing section: OSM Falasarna point is a section of the already covered Falasarna beach area.',
    evidenceNote: 'Falasarna is a long multi-section beach area; this OSM way is accepted as covered by the existing BeachBuddy Falasarna record.',
  }],
  ['https://www.openstreetmap.org/node/9880754911', {
    scopeIds: new Set(['crete-crete-chania']),
    issueType: 'external_candidate_ignored_low_quality_name',
    humanSummary: 'Ignored low-quality candidate: "Tiny beach pink sand" is too generic to show as a BeachBuddy beach.',
    evidenceNote: 'The OSM candidate name is generic and low-value for users, so it is intentionally ignored until a proper local beach name is verified.',
  }],
  ['https://www.openstreetmap.org/way/600407579', {
    scopeIds: new Set(['central-greece-evia']),
    issueType: 'external_candidate_accepted_existing_section',
    humanSummary: 'Accepted Evia section: OSM Paralia Dafnis way is covered by the existing BeachBuddy Paralia Dafnis record.',
    evidenceNote: 'Dafni is represented by two same-name OSM shoreline ways. The existing BeachBuddy point matches the companion Dafni OSM way and cites both OSM sources, so no coordinate move or duplicate beach card is needed.',
  }],
  ['https://www.openstreetmap.org/way/600437659', {
    scopeIds: new Set(['central-greece-evia']),
    issueType: 'external_candidate_accepted_existing_section',
    humanSummary: 'Accepted Evia section: second OSM Rodies way is covered by the existing BeachBuddy Rodies record.',
    evidenceNote: 'Rodies is represented by two nearby same-name OSM shoreline ways. The existing BeachBuddy point matches the companion Rodies OSM way, so no coordinate move or duplicate beach card is needed.',
  }],
]);

const halkidikiAcceptedSectionUrls = new Set([
  'https://www.openstreetmap.org/way/297788644',
  'https://www.openstreetmap.org/way/261535143',
  'https://www.openstreetmap.org/way/159549779',
  'https://www.openstreetmap.org/way/159549780',
  'https://www.openstreetmap.org/way/361446682',
  'https://www.openstreetmap.org/way/361446683',
  'https://www.openstreetmap.org/way/363018703',
  'https://www.openstreetmap.org/way/1152368510',
  'https://www.openstreetmap.org/way/258892583',
  'https://www.openstreetmap.org/way/258904060',
  'https://www.openstreetmap.org/way/35830332',
  'https://www.openstreetmap.org/way/35830387',
  'https://www.openstreetmap.org/way/261535133',
  'https://www.openstreetmap.org/way/280088224',
  'https://www.openstreetmap.org/node/3019063829',
  'https://www.openstreetmap.org/way/239652298',
  'https://www.openstreetmap.org/way/259921682',
  'https://www.openstreetmap.org/way/1201385671',
  'https://www.openstreetmap.org/way/1201637962',
  'https://www.openstreetmap.org/way/185501495',
  'https://www.openstreetmap.org/way/259925271',
  'https://www.openstreetmap.org/way/79447222',
  'https://www.openstreetmap.org/way/258892586',
  'https://www.openstreetmap.org/way/258904062',
  'https://www.openstreetmap.org/relation/5148471',
  'https://www.openstreetmap.org/way/371591216',
  'https://www.openstreetmap.org/way/259921683',
  'https://www.openstreetmap.org/way/363131320',
]);

const rhodesAcceptedSectionUrls = new Set([
  'https://www.openstreetmap.org/relation/3004547',
  'https://www.openstreetmap.org/way/182373652',
  'https://www.openstreetmap.org/way/182373660',
  'https://www.openstreetmap.org/relation/3079751',
  'https://www.openstreetmap.org/relation/16229897',
  'https://www.openstreetmap.org/relation/16229898',
  'https://www.openstreetmap.org/relation/16229899',
  'https://www.openstreetmap.org/relation/16229900',
  'https://www.openstreetmap.org/relation/16229901',
]);

const thesprotiaAcceptedSectionUrls = new Set([
  'https://www.openstreetmap.org/way/130301532',
  'https://www.openstreetmap.org/relation/2960372',
  'https://www.openstreetmap.org/way/570243145',
]);

const thessalonikiAcceptedSectionUrls = new Set([
  'https://www.openstreetmap.org/way/211041436',
  'https://www.openstreetmap.org/way/1302450029',
]);

const deepCoverageScopes = [
  {
    id: 'milos',
    regionIds: new Set(['south-aegean-milos']),
    aliases: new Set(['milos', 'μηλος', 'μήλος']),
    bbox: { south: 36.61, west: 24.27, north: 36.84, east: 24.62 },
  },
  {
    id: 'naxos',
    regionIds: new Set(['south-aegean-naxos']),
    aliases: new Set(['naxos']),
    bbox: { south: 36.88, west: 25.32, north: 37.24, east: 25.66 },
    candidateBounds: {
      areas: [
        { label: 'Naxos main island', minLat: 36.88, maxLat: 37.24, minLon: 25.32, maxLon: 25.61 },
      ],
      exclusions: [
        { label: 'Koufonisia west/south cluster', minLat: 36.895, maxLat: 36.922, minLon: 25.55, maxLon: 25.595 },
        { label: 'Koufonisia east/port cluster', minLat: 36.925, maxLat: 36.955, minLon: 25.59, maxLon: 25.66 },
        { label: 'Schinoussa', minLat: 36.84, maxLat: 36.90, minLon: 25.49, maxLon: 25.55 },
        { label: 'Iraklia', minLat: 36.81, maxLat: 36.89, minLon: 25.38, maxLon: 25.50 },
      ],
    },
  },
];

const args = process.argv.slice(2);

const getArgValue = name => {
  const prefix = `--${name}=`;
  const match = args.find(arg => arg.startsWith(prefix));
  return match ? match.slice(prefix.length).trim() : '';
};

const hasFlag = name => args.includes(`--${name}`);

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\u0370-\u03ff]+/g, ' ')
  .trim();

const slugify = value => normalize(value)
  .replace(/[^\w\u0370-\u03ff]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'all';

const isExactScopeMatch = (value, wanted) => {
  const normalizedValue = normalize(value);
  return Boolean(normalizedValue) && normalizedValue === wanted;
};

const isIslandScopeMatch = (entry, wanted) => [
  entry.id,
  entry.prefecture,
  entry.name?.en,
  entry.name?.gr,
].some(value => isExactScopeMatch(value, wanted));

const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;
const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const toRelativePath = filePath => path.relative(rootDir, filePath).replaceAll(path.sep, '/');

const publicUrlToFilePath = publicUrl => {
  const cleanPath = String(publicUrl || '').replace(/^\//, '');
  return path.join(publicDir, cleanPath.replace(/^public\//, ''));
};

const getSummaryPath = entry => publicUrlToFilePath(entry.summaryDataPath || `/data/beaches/app/summary/${entry.id}.json`);
const getDetailPath = entry => publicUrlToFilePath(entry.detailDataPath || `/data/beaches/app/detail/${entry.id}.json`);

const readJson = async filePath => {
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
};

const loadEnvFile = async filePath => {
  let text = '';
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.trim().replace(/^['"]|['"]$/g, '');
  }
};

const loadLocalEnv = async () => {
  await loadEnvFile(path.join(rootDir, '.env'));
  await loadEnvFile(path.join(rootDir, '.env.local'));
};

const readJsonIfExists = async filePath => {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
};

const getLocalizedName = name => {
  if (isNonEmptyString(name?.en)) return name.en.trim();
  if (isNonEmptyString(name?.gr)) return name.gr.trim();
  if (typeof name === 'string') return name.trim();
  return '';
};

const normalizeBeachNameForCoverage = value => normalize(value)
  .replace(/\b(paralia|beach|plage|spiaggia|strand)\b/g, ' ')
  .replace(/(^|\s)παραλια(?:ς)?(?=\s|$)/g, ' ')
  .replace(/\b(agios|agios|agia|ag)\b/g, match => match)
  .replace(/\bπαραλια\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const greeklishPairs = [
  ['αι', 'ai'], ['ει', 'ei'], ['οι', 'oi'], ['ου', 'ou'], ['αυ', 'av'], ['ευ', 'ev'],
  ['Αι', 'Ai'], ['Ει', 'Ei'], ['Οι', 'Oi'], ['Ου', 'Ou'], ['Αυ', 'Av'], ['Ευ', 'Ev'],
  ['ά', 'a'], ['έ', 'e'], ['ή', 'i'], ['ί', 'i'], ['ό', 'o'], ['ύ', 'y'], ['ώ', 'o'],
  ['ϊ', 'i'], ['ΐ', 'i'], ['ϋ', 'y'], ['ΰ', 'y'],
  ['Ά', 'A'], ['Έ', 'E'], ['Ή', 'I'], ['Ί', 'I'], ['Ό', 'O'], ['Ύ', 'Y'], ['Ώ', 'O'],
  ['Α', 'A'], ['Β', 'V'], ['Γ', 'G'], ['Δ', 'D'], ['Ε', 'E'], ['Ζ', 'Z'], ['Η', 'I'],
  ['Θ', 'Th'], ['Ι', 'I'], ['Κ', 'K'], ['Λ', 'L'], ['Μ', 'M'], ['Ν', 'N'], ['Ξ', 'X'],
  ['Ο', 'O'], ['Π', 'P'], ['Ρ', 'R'], ['Σ', 'S'], ['Τ', 'T'], ['Υ', 'Y'], ['Φ', 'F'],
  ['Χ', 'Ch'], ['Ψ', 'Ps'], ['Ω', 'O'],
  ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'i'],
  ['θ', 'th'], ['ι', 'i'], ['κ', 'k'], ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'],
  ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'], ['υ', 'y'],
  ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
  ['Ξ±ΞΉ', 'ai'], ['ΞµΞΉ', 'ei'], ['ΞΏΞΉ', 'oi'], ['ΞΏΟ…', 'ou'], ['Ξ±Ο…', 'av'], ['ΞµΟ…', 'ev'],
  ['Ξ¬', 'a'], ['Ξ­', 'e'], ['Ξ®', 'i'], ['Ξ―', 'i'], ['Ο', 'o'], ['Ο', 'y'], ['Ο', 'o'],
  ['Ο', 'i'], ['Ξ', 'i'], ['Ο‹', 'y'], ['Ξ°', 'y'],
  ['Ξ‘', 'A'], ['Ξ’', 'V'], ['Ξ“', 'G'], ['Ξ”', 'D'], ['Ξ•', 'E'], ['Ξ–', 'Z'], ['Ξ—', 'I'],
  ['Ξ', 'Th'], ['Ξ™', 'I'], ['Ξ', 'K'], ['Ξ›', 'L'], ['Ξ', 'M'], ['Ξ', 'N'], ['Ξ', 'X'],
  ['Ξ', 'O'], ['Ξ ', 'P'], ['Ξ΅', 'R'], ['Ξ£', 'S'], ['Ξ¤', 'T'], ['Ξ¥', 'Y'], ['Ξ¦', 'F'],
  ['Ξ§', 'Ch'], ['Ξ¨', 'Ps'], ['Ξ©', 'O'],
  ['Ξ±', 'a'], ['Ξ²', 'v'], ['Ξ³', 'g'], ['Ξ΄', 'd'], ['Ξµ', 'e'], ['Ξ¶', 'z'], ['Ξ·', 'i'],
  ['ΞΈ', 'th'], ['ΞΉ', 'i'], ['ΞΊ', 'k'], ['Ξ»', 'l'], ['ΞΌ', 'm'], ['Ξ½', 'n'], ['ΞΎ', 'x'],
  ['ΞΏ', 'o'], ['Ο€', 'p'], ['Ο', 'r'], ['Οƒ', 's'], ['Ο‚', 's'], ['Ο„', 't'], ['Ο…', 'y'],
  ['Ο†', 'f'], ['Ο‡', 'ch'], ['Ο', 'ps'], ['Ο‰', 'o'],
];

const toGreeklishLoose = value => {
  const input = String(value || '');
  if (!input) return '';
  return greeklishPairs.reduce((text, [from, to]) => text.split(from).join(to), input)
    .replace(/\s+/g, ' ')
    .trim();
};

const getCoverageNameKeys = values => {
  const list = Array.isArray(values) ? values : [values];
  const keys = new Set();

  for (const value of list) {
    if (!isNonEmptyString(value)) continue;
    const direct = normalizeBeachNameForCoverage(value);
    const greeklish = normalizeBeachNameForCoverage(toGreeklishLoose(value));
    if (direct) keys.add(direct);
    if (greeklish) keys.add(greeklish);
  }

  return keys;
};

const hasSpecificCoverageName = value => getCoverageNameKeys(value).size > 0;

const nameKeySetsOverlap = (left, right) => {
  for (const key of left) {
    if (right.has(key)) return true;
  }
  return false;
};

const beachLabel = beach => {
  const name = getLocalizedName(beach?.name) || 'unknown beach';
  return `${name} (id=${beach?.id ?? 'missing'})`;
};

const getAcceptedSharedNamePair = (region, leftBeach, rightBeach) => {
  const leftId = leftBeach?.id;
  const rightId = rightBeach?.id;
  if (!Number.isInteger(leftId) || !Number.isInteger(rightId)) return null;

  const [firstId, secondId] = [leftId, rightId].sort((left, right) => left - right);
  const key = `${region?.id || region}|${firstId}|${secondId}`;
  return acceptedSharedNamePairs.get(key) || null;
};

const getBeachCoverageNameKeys = beach => {
  const values = [
    beach?.name?.en,
    beach?.name?.gr,
    ...(Array.isArray(beach?.aliases) ? beach.aliases : []),
  ];
  return getCoverageNameKeys(values);
};

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

const isWithinScopeCandidateBounds = (scope, coordinates) => {
  const bounds = scope?.candidateBounds;
  if (!bounds) return true;
  const areas = Array.isArray(bounds.areas) ? bounds.areas : [bounds];
  const exclusions = Array.isArray(bounds.exclusions) ? bounds.exclusions : [];
  return areas.some(area => isCoordinateInsideBox(coordinates, area)) &&
    !exclusions.some(exclusion => isCoordinateInsideBox(coordinates, exclusion));
};

const filterCoverageCandidatesForScope = (scope, candidates) => (
  candidates.filter(candidate => isWithinScopeCandidateBounds(scope, candidate.coordinates))
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

const getReviewCategory = severity => {
  if (severity === 'BLOCKER' || severity === 'HIGH') return 'must_fix';
  if (severity === 'MEDIUM') return 'human_review';
  return 'informational';
};

const haversineMeters = (a, b) => {
  const earthRadiusMeters = 6371000;
  const toRadians = degrees => (degrees * Math.PI) / 180;
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);
  const h = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const roundCoordinate = value => Number(value.toFixed(6));

const getBboxKey = bbox => [
  bbox?.south,
  bbox?.west,
  bbox?.north,
  bbox?.east,
].map(value => Number(value).toFixed(6)).join(',');

const parseBbox = value => {
  if (!isNonEmptyString(value)) return null;
  const [south, west, north, east] = value.split(',').map(item => Number(item.trim()));
  const bbox = { south, west, north, east };
  if (
    !isFiniteNumber(south) ||
    !isFiniteNumber(west) ||
    !isFiniteNumber(north) ||
    !isFiniteNumber(east) ||
    south >= north ||
    west >= east ||
    south < greeceBounds.south ||
    north > greeceBounds.north ||
    west < greeceBounds.west ||
    east > greeceBounds.east
  ) {
    throw new Error('Invalid --bbox. Use --bbox=south,west,north,east inside Greece, for example --bbox=36.88,25.32,37.24,25.66.');
  }
  return bbox;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getAutoCoverageBbox = allBeaches => {
  const coordinates = allBeaches
    .map(row => row.coordinates)
    .filter(isGreeceCoordinate);

  if (coordinates.length === 0) return null;

  const lats = coordinates.map(coordinates => coordinates.lat);
  const lons = coordinates.map(coordinates => coordinates.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = maxLat - minLat;
  const lonSpan = maxLon - minLon;
  const latPadding = clamp(latSpan * 0.35, 0.03, 0.18);
  const lonPadding = clamp(lonSpan * 0.35, 0.03, 0.18);

  return {
    south: roundCoordinate(clamp(minLat - latPadding, greeceBounds.south, greeceBounds.north)),
    west: roundCoordinate(clamp(minLon - lonPadding, greeceBounds.west, greeceBounds.east)),
    north: roundCoordinate(clamp(maxLat + latPadding, greeceBounds.south, greeceBounds.north)),
    east: roundCoordinate(clamp(maxLon + lonPadding, greeceBounds.west, greeceBounds.east)),
  };
};

const getBboxFromCandidateBounds = bounds => {
  if (!bounds) return null;
  const areas = Array.isArray(bounds.areas) ? bounds.areas : [bounds];
  const validAreas = areas.filter(area => (
    isFiniteNumber(area?.minLat) &&
    isFiniteNumber(area?.maxLat) &&
    isFiniteNumber(area?.minLon) &&
    isFiniteNumber(area?.maxLon)
  ));

  if (validAreas.length === 0) return null;

  return {
    south: roundCoordinate(clamp(Math.min(...validAreas.map(area => area.minLat)), greeceBounds.south, greeceBounds.north)),
    west: roundCoordinate(clamp(Math.min(...validAreas.map(area => area.minLon)), greeceBounds.west, greeceBounds.east)),
    north: roundCoordinate(clamp(Math.max(...validAreas.map(area => area.maxLat)), greeceBounds.south, greeceBounds.north)),
    east: roundCoordinate(clamp(Math.max(...validAreas.map(area => area.maxLon)), greeceBounds.west, greeceBounds.east)),
  };
};

const parseOptions = () => {
  const mode = getArgValue('mode') || 'fast';
  if (!['fast', 'deep'].includes(mode)) {
    throw new Error(`Unsupported --mode="${mode}". Use fast or deep.`);
  }

  return {
    mode,
    region: getArgValue('region'),
    island: getArgValue('island'),
    outputDir: getArgValue('out-dir')
      ? path.resolve(rootDir, getArgValue('out-dir'))
      : defaultOutputDir,
    writeReports: !hasFlag('no-write'),
    emailReports: hasFlag('email') || hasFlag('email-dry-run'),
    emailDryRun: hasFlag('email-dry-run'),
    emailTo: getArgValue('email-to'),
    emailFrom: getArgValue('email-from'),
    strict: hasFlag('strict'),
    externalResearch: mode === 'deep' && !hasFlag('no-external'),
    refreshExternal: hasFlag('refresh-external'),
    bbox: parseBbox(getArgValue('bbox')),
  };
};

const createAudit = options => {
  const issues = [];
  const acceptedSharedNamePairs = [];
  const stats = {
    indexRegions: 0,
    regionsChecked: 0,
    beachesChecked: 0,
    beachesWithMetadata: 0,
    beachesWithOrientation: 0,
    beachesWithWindProfile: 0,
    externalCoverageCandidates: 0,
    externalCoverageSource: null,
    confidenceValues: {},
    metadataAmenityValues: {},
  };

  const addIssue = ({
    severity,
    issueType,
    file,
    beach,
    region,
    currentValue = null,
    suggestedValue = null,
    confidence = 1,
    evidenceNote,
    evidenceSourceName = 'local deterministic audit',
    evidenceSourceUrl = null,
    recommendedAction = 'needs_human_review',
    reviewCategory,
    humanSummary,
  }) => {
    issues.push({
      beach_id: beach?.id ?? null,
      beach_name: beach ? getLocalizedName(beach.name) || null : null,
      region: region?.id || region?.prefecture || region?.region || null,
      issue_type: issueType,
      severity,
      review_category: reviewCategory || getReviewCategory(severity),
      human_summary: humanSummary || evidenceNote,
      file: file ? toRelativePath(file) : null,
      current_value: currentValue,
      suggested_value: suggestedValue,
      confidence,
      evidence: [{
        source_name: evidenceSourceName,
        source_url: evidenceSourceUrl,
        quote_or_note: evidenceNote,
      }],
      recommended_action: recommendedAction,
    });
  };

  return { options, issues, acceptedSharedNamePairs, stats, addIssue };
};

const getConfiguredDeepCoverageScope = (selectedRegions, options) => {
  const optionValues = [options.island, options.region].map(normalize).filter(Boolean);

  return deepCoverageScopes.find(scope => {
    const hasMatchingRegion = selectedRegions.some(entry => scope.regionIds.has(entry.id));
    const hasMatchingOption = optionValues.some(value => scope.aliases.has(value) || value.includes(scope.id));
    return hasMatchingRegion && (options.island || options.region ? hasMatchingOption || hasMatchingRegion : false);
  }) || null;
};

const getDeepCoverageScope = (selectedRegions, allBeaches, options) => {
  if (!options.island && selectedRegions.length !== 1 && !options.bbox) {
    return null;
  }

  const configuredScope = getConfiguredDeepCoverageScope(selectedRegions, options);
  if (configuredScope) return { ...configuredScope, scopeSource: 'configured' };

  if (selectedRegions.length !== 1) {
    return null;
  }

  const region = selectedRegions[0];
  const candidateBounds = knownIslandCoordinateBounds[region.id] || null;
  const bbox = options.bbox || getBboxFromCandidateBounds(candidateBounds) || getAutoCoverageBbox(allBeaches);
  if (!bbox) return null;

  const id = slugify(region.id || options.island || options.region || 'custom-scope');

  return {
    id,
    regionIds: new Set([region.id]),
    aliases: new Set([region.id, region.prefecture, region.name?.en, region.name?.gr].map(normalize).filter(Boolean)),
    bbox,
    candidateBounds,
    scopeSource: options.bbox ? 'manual-bbox' : 'auto-bbox-from-current-beaches',
  };
};

const osmElementUrl = element => `https://www.openstreetmap.org/${element.type}/${element.id}`;

const getOsmElementCoordinates = element => {
  const lat = isFiniteNumber(element.lat) ? element.lat : element.center?.lat;
  const lon = isFiniteNumber(element.lon) ? element.lon : element.center?.lon;
  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) return null;
  return { lat, lon };
};

const getOsmElementName = element => {
  const tags = element.tags || {};
  const candidates = [
    tags.name,
    tags['name:el'],
    tags['name:en'],
    tags.int_name,
    tags['name:fr'],
  ].filter(isNonEmptyString);

  return candidates.find(hasSpecificCoverageName) || candidates[0] || '';
};

const toCoverageCandidate = element => {
  const coordinates = getOsmElementCoordinates(element);
  const name = getOsmElementName(element);
  if (!coordinates || !isNonEmptyString(name)) return null;
  const nameKeys = getCoverageNameKeys(name);
  if (nameKeys.size === 0) return null;
  const displayName = toGreeklishLoose(name) || name.trim();

  return {
    id: `${element.type}/${element.id}`,
    name: name.trim(),
    displayName,
    normalizedName: Array.from(nameKeys)[0],
    nameKeys: Array.from(nameKeys),
    coordinates,
    tags: element.tags || {},
    sourceName: 'OpenStreetMap Overpass',
    sourceUrl: osmElementUrl(element),
  };
};

const dedupeCoverageCandidates = candidates => {
  const deduped = [];

  for (const candidate of candidates) {
    const candidateKeys = new Set(candidate.nameKeys || [candidate.normalizedName].filter(Boolean));
    const existing = deduped.find(item => {
      const itemKeys = new Set(item.nameKeys || [item.normalizedName].filter(Boolean));
      return nameKeySetsOverlap(candidateKeys, itemKeys)
        && haversineMeters(candidate.coordinates, item.coordinates) <= likelyDuplicateNameDistanceMeters;
    });

    if (!existing) {
      deduped.push(candidate);
    }
  }

  return deduped;
};

const fetchOsmCoverageCandidates = async (scope, options) => {
  const cacheDir = path.join(rootDir, '.tmp', 'beach-audit-cache');
  const cachePath = path.join(cacheDir, `osm-${scope.id}.json`);

  if (!options.refreshExternal) {
    const cached = await readJsonIfExists(cachePath);
    if (
      cached?.candidates &&
      Array.isArray(cached.candidates) &&
      cached?.bbox &&
      getBboxKey(cached.bbox) === getBboxKey(scope.bbox) &&
      cached.candidates.every(candidate => Array.isArray(candidate.nameKeys) && isNonEmptyString(candidate.displayName))
    ) {
      const candidates = filterCoverageCandidatesForScope(scope, cached.candidates);
      return {
        ...cached,
        rawCandidateCount: cached.rawCandidateCount ?? cached.candidates.length,
        scopedCandidateCount: candidates.length,
        excludedByScopeCount: Math.max(0, cached.candidates.length - candidates.length),
        candidates,
        fromCache: true,
      };
    }
  }

  const { south, west, north, east } = scope.bbox;
  const query = `
[out:json][timeout:25];
(
  node["natural"="beach"](${south},${west},${north},${east});
  way["natural"="beach"](${south},${west},${north},${east});
  relation["natural"="beach"](${south},${west},${north},${east});
  node["tourism"="beach_resort"](${south},${west},${north},${east});
  way["tourism"="beach_resort"](${south},${west},${north},${east});
  relation["tourism"="beach_resort"](${south},${west},${north},${east});
);
out center tags;
`;

  const response = await fetch(overpassUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': 'CalmBeach local beach data audit',
    },
    body: new URLSearchParams({ data: query }),
  });

  if (!response.ok) {
    throw new Error(`Overpass responded with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const rawCandidates = dedupeCoverageCandidates((payload.elements || [])
    .map(toCoverageCandidate)
    .filter(Boolean)
    .filter(candidate => candidate.normalizedName.length > 0));
  const candidates = filterCoverageCandidatesForScope(scope, rawCandidates);

  const report = {
    generatedAt: new Date().toISOString(),
    sourceName: 'OpenStreetMap Overpass',
    sourceUrl: overpassUrl,
    scope: scope.id,
    scopeSource: scope.scopeSource || 'configured',
    bbox: scope.bbox,
    candidateBounds: scope.candidateBounds || null,
    rawCandidateCount: rawCandidates.length,
    scopedCandidateCount: candidates.length,
    excludedByScopeCount: rawCandidates.length - candidates.length,
    candidates,
  };

  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { ...report, fromCache: false };
};

const addDuplicateNameIssue = (audit, { file, beach, previousBeach, region }) => {
  const hasCurrentCoordinates = isGreeceCoordinate(beach?.coordinates);
  const hasPreviousCoordinates = isGreeceCoordinate(previousBeach?.coordinates);
  const distanceMeters = hasCurrentCoordinates && hasPreviousCoordinates
    ? haversineMeters(beach.coordinates, previousBeach.coordinates)
    : null;

  if (distanceMeters !== null && distanceMeters <= likelyDuplicateNameDistanceMeters) {
    audit.addIssue({
      severity: 'MEDIUM',
      issueType: 'likely_duplicate_name_near_coordinates',
      file,
      beach,
      region,
      currentValue: {
        name: getLocalizedName(beach.name),
        coordinates: beach.coordinates,
        similarBeach: beachLabel(previousBeach),
        similarBeachCoordinates: previousBeach.coordinates,
        distanceMeters: Number(distanceMeters.toFixed(1)),
      },
      suggestedValue: 'review whether these are the same beach, a named section, or need clearer aliases',
      confidence: 0.85,
      evidenceNote: `Same normalized name and coordinates are ${Number(distanceMeters.toFixed(1))}m apart from ${beachLabel(previousBeach)}.`,
      humanSummary: `Likely duplicate: same name and very close coordinates (${Number(distanceMeters.toFixed(1))}m).`,
    });
    return;
  }

  if (distanceMeters !== null && distanceMeters <= possibleDuplicateNameDistanceMeters) {
    audit.addIssue({
      severity: 'MEDIUM',
      issueType: 'possible_duplicate_name_same_area',
      file,
      beach,
      region,
      currentValue: {
        name: getLocalizedName(beach.name),
        coordinates: beach.coordinates,
        similarBeach: beachLabel(previousBeach),
        similarBeachCoordinates: previousBeach.coordinates,
        distanceMeters: Number(distanceMeters.toFixed(1)),
      },
      suggestedValue: 'check if these are separate nearby beaches or duplicate entries',
      confidence: 0.7,
      evidenceNote: `Same normalized name appears within ${Number(distanceMeters.toFixed(1))}m of ${beachLabel(previousBeach)}.`,
      humanSummary: `Possible duplicate: same name in the same area (${Number(distanceMeters.toFixed(1))}m apart).`,
    });
    return;
  }

  const acceptedSharedNamePair = getAcceptedSharedNamePair(region, beach, previousBeach);
  if (acceptedSharedNamePair) {
    audit.acceptedSharedNamePairs.push({
      region: region?.id || region,
      currentBeach: beachLabel(beach),
      previousBeach: beachLabel(previousBeach),
      distanceMeters: distanceMeters === null ? null : Number(distanceMeters.toFixed(1)),
      reviewedAt: acceptedSharedNamePair.reviewedAt,
      note: acceptedSharedNamePair.note,
    });
    return;
  }

  audit.addIssue({
    severity: 'LOW',
    issueType: 'shared_name_same_island_far_apart',
    file,
    beach,
    region,
    currentValue: {
      name: getLocalizedName(beach.name),
      coordinates: beach?.coordinates ?? null,
      similarBeach: beachLabel(previousBeach),
      similarBeachCoordinates: previousBeach?.coordinates ?? null,
      distanceMeters: distanceMeters === null ? null : Number(distanceMeters.toFixed(1)),
    },
    suggestedValue: 'usually safe; review only if this island should not have repeated local names',
    confidence: 0.55,
    evidenceNote: distanceMeters === null
      ? `Same normalized name also appears as ${beachLabel(previousBeach)}, but distance could not be calculated.`
      : `Same normalized name also appears as ${beachLabel(previousBeach)}, but the points are ${Number(distanceMeters.toFixed(1))}m apart.`,
    recommendedAction: 'needs_human_review',
    reviewCategory: 'informational',
    humanSummary: distanceMeters === null
      ? 'Shared name: needs review only because coordinate distance was unavailable.'
      : `Shared name, likely normal: same island but far apart (${Number(distanceMeters.toFixed(1))}m).`,
  });
};

const matchesScope = (entry, options) => {
  const values = [
    entry.id,
    entry.region,
    entry.prefecture,
    entry.group,
    entry.name?.en,
    entry.name?.gr,
  ].map(normalize).filter(Boolean);

  if (options.region) {
    const wanted = normalize(options.region);
    return values.some(value => value.includes(wanted));
  }

  if (options.island) {
    const wanted = normalize(options.island);
    return isIslandScopeMatch(entry, wanted);
  }

  return true;
};

const validateIndexEntry = (audit, entry, indexFile) => {
  if (!isNonEmptyString(entry?.id)) {
    audit.addIssue({
      severity: 'BLOCKER',
      issueType: 'missing_region_id',
      file: indexFile,
      region: entry,
      currentValue: entry,
      evidenceNote: 'Region index entry has no usable id.',
    });
  }

  if (!Number.isInteger(entry?.beachCount) || entry.beachCount < 0) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'invalid_region_beach_count',
      file: indexFile,
      region: entry,
      currentValue: entry?.beachCount,
      evidenceNote: 'Region index beachCount should be a non-negative integer.',
    });
  }

  if (!isGreeceCoordinate(entry?.coordinates)) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'invalid_region_coordinates',
      file: indexFile,
      region: entry,
      currentValue: entry?.coordinates ?? null,
      evidenceNote: 'Region center coordinates are missing, invalid, or outside the Greece bounding box.',
    });
  }
};

const validateEnum = (audit, { file, beach, region, field, value, allowed, severity = 'HIGH' }) => {
  if (!allowed.has(value)) {
    audit.addIssue({
      severity,
      issueType: `invalid_${field}`,
      file,
      beach,
      region,
      currentValue: value ?? null,
      suggestedValue: Array.from(allowed),
      confidence: 1,
      evidenceNote: `${field} is not in the controlled schema.`,
    });
  }
};

const validateBooleanObject = (audit, { file, beach, region, field, value }) => {
  if (!isObject(value)) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: `missing_${field}`,
      file,
      beach,
      region,
      currentValue: value ?? null,
      evidenceNote: `${field} should be an object of boolean feature flags.`,
    });
    return;
  }

  const allowedKeys = allowedBooleanFeatureKeys[field];
  for (const [key, flag] of Object.entries(value)) {
    if (allowedKeys && !allowedKeys.has(key)) {
      audit.addIssue({
        severity: 'LOW',
        issueType: 'new_feature_candidate',
        file,
        beach,
        region,
        currentValue: { field, key, value: flag },
        suggestedValue: 'decide whether this should become an official schema field before using it in recommendations',
        confidence: 1,
        evidenceNote: `${field}.${key} is not in the current controlled feature schema.`,
        recommendedAction: 'needs_human_review',
        reviewCategory: 'informational',
        humanSummary: `New feature candidate found: ${field}.${key}. Decide schema before using it.`,
      });
    }

    if (typeof flag !== 'boolean') {
      audit.addIssue({
        severity: 'MEDIUM',
        issueType: `invalid_${field}_flag`,
        file,
        beach,
        region,
        currentValue: { [key]: flag },
        evidenceNote: `${field}.${key} should be a boolean.`,
      });
    }
  }
};

const validateMetadata = (audit, { file, beach, region }) => {
  const metadata = beach?.metadata;
  if (!metadata) return;

  audit.stats.beachesWithMetadata += 1;

  const confidence = metadata.confidence || 'unknown';
  audit.stats.confidenceValues[confidence] = (audit.stats.confidenceValues[confidence] || 0) + 1;

  if (!allowedConfidence.has(confidence)) {
    audit.addIssue({
      severity: 'LOW',
      issueType: 'invalid_metadata_confidence',
      file,
      beach,
      region,
      currentValue: confidence,
      suggestedValue: Array.from(allowedConfidence),
      evidenceNote: 'metadata.confidence should use the controlled confidence values.',
    });
  }

  if (metadata.access?.type && !allowedAccessTypes.has(metadata.access.type)) {
    audit.addIssue({
      severity: 'MEDIUM',
      issueType: 'invalid_metadata_access_type',
      file,
      beach,
      region,
      currentValue: metadata.access.type,
      suggestedValue: Array.from(allowedAccessTypes),
      evidenceNote: 'metadata.access.type is not in the controlled access schema.',
    });
  }

  const terrainTypes = metadata.terrain?.types;
  if (Array.isArray(terrainTypes)) {
    const invalidTerrainTypes = terrainTypes.filter(type => !allowedTerrainTypes.has(type));
    if (invalidTerrainTypes.length > 0) {
      audit.addIssue({
        severity: 'MEDIUM',
        issueType: 'invalid_metadata_terrain_type',
        file,
        beach,
        region,
        currentValue: invalidTerrainTypes,
        suggestedValue: Array.from(allowedTerrainTypes),
        evidenceNote: 'metadata.terrain.types contains values outside the controlled terrain schema.',
      });
    }
  }

  if (Array.isArray(metadata.amenities)) {
    for (const value of metadata.amenities) {
      const key = String(value || '').trim();
      if (!key) continue;
      audit.stats.metadataAmenityValues[key] = (audit.stats.metadataAmenityValues[key] || 0) + 1;
    }
  }
};

const validateBeach = (audit, { file, beach, regionEntry, summaryPayload }) => {
  audit.stats.beachesChecked += 1;

  if (!Number.isInteger(beach?.id)) {
    audit.addIssue({
      severity: 'BLOCKER',
      issueType: 'missing_beach_id',
      file,
      beach,
      region: regionEntry,
      currentValue: beach?.id ?? null,
      evidenceNote: 'Beach id is missing or not an integer.',
    });
  }

  if (!isNonEmptyString(beach?.name?.en) && !isNonEmptyString(beach?.name?.gr)) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'missing_beach_name',
      file,
      beach,
      region: regionEntry,
      currentValue: beach?.name ?? null,
      evidenceNote: 'Beach is missing both English and Greek names.',
    });
  }

  if (!isGreeceCoordinate(beach?.coordinates)) {
    audit.addIssue({
      severity: 'BLOCKER',
      issueType: 'invalid_coordinates',
      file,
      beach,
      region: regionEntry,
      currentValue: beach?.coordinates ?? null,
      evidenceNote: 'Beach coordinates are missing, invalid, or outside a broad Greece bounding box.',
    });
  } else if (!isWithinKnownIslandBounds(regionEntry?.id, beach.coordinates)) {
    const matchingRegionId = getKnownIslandCoordinateRegion(beach.coordinates);
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'wrong_known_island_region',
      file,
      beach,
      region: regionEntry,
      currentValue: {
        regionId: regionEntry?.id,
        coordinates: beach.coordinates,
      },
      suggestedValue: matchingRegionId || 'needs nearby-island review',
      confidence: matchingRegionId ? 0.9 : 0.75,
      evidenceNote: matchingRegionId
        ? `Coordinates fall outside ${regionEntry?.id} known bounds and inside ${matchingRegionId} known bounds.`
        : `Coordinates fall outside ${regionEntry?.id} known bounds for this nearby-island cluster.`,
      recommendedAction: 'needs_human_review',
      reviewCategory: 'geospatial_review',
      humanSummary: `${beachLabel(beach)} appears assigned to the wrong nearby island.`,
    });
  }

  validateEnum(audit, {
    file,
    beach,
    region: regionEntry,
    field: 'beach_type',
    value: beach?.beachType,
    allowed: allowedBeachTypes,
  });

  validateEnum(audit, {
    file,
    beach,
    region: regionEntry,
    field: 'accessibility',
    value: beach?.accessibility,
    allowed: allowedAccessibility,
  });

  validateEnum(audit, {
    file,
    beach,
    region: regionEntry,
    field: 'water_depth',
    value: beach?.waterDepth,
    allowed: allowedWaterDepth,
    severity: 'MEDIUM',
  });

  if (!Array.isArray(beach?.protectedFrom)) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'invalid_protected_from',
      file,
      beach,
      region: regionEntry,
      currentValue: beach?.protectedFrom ?? null,
      evidenceNote: 'protectedFrom should be an array and is treated only as legacy fallback data.',
    });
  } else {
    const invalidDirections = beach.protectedFrom.filter(direction => !allowedWindDirections.has(direction));
    if (invalidDirections.length > 0) {
      audit.addIssue({
        severity: 'HIGH',
        issueType: 'invalid_protected_from_direction',
        file,
        beach,
        region: regionEntry,
        currentValue: invalidDirections,
        suggestedValue: Array.from(allowedWindDirections),
        evidenceNote: 'protectedFrom contains values outside the controlled wind direction schema.',
      });
    }
  }

  validateBooleanObject(audit, { file, beach, region: regionEntry, field: 'amenities', value: beach?.amenities });
  validateBooleanObject(audit, { file, beach, region: regionEntry, field: 'characteristics', value: beach?.characteristics });
  validateBooleanObject(audit, { file, beach, region: regionEntry, field: 'activities', value: beach?.activities });
  validateBooleanObject(audit, { file, beach, region: regionEntry, field: 'environment', value: beach?.environment });

  if (beach?.environment?.quiet === true && beach?.amenities?.beachBar === true) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'quiet_with_beach_bar',
      file,
      beach,
      region: regionEntry,
      currentValue: {
        quiet: beach.environment.quiet,
        beachBar: beach.amenities.beachBar,
      },
      suggestedValue: 'review quiet or beachBar value',
      confidence: 1,
      evidenceNote: 'Project rule says beach bar should override quiet-style wording.',
    });
  }

  if (beach?.characteristics?.shallowWaters === true && beach?.characteristics?.deepWaters === true) {
    audit.addIssue({
      severity: 'MEDIUM',
      issueType: 'shallow_and_deep_water',
      file,
      beach,
      region: regionEntry,
      currentValue: beach.characteristics,
      suggestedValue: 'review waterDepth and characteristics',
      evidenceNote: 'Beach is marked as both shallow and deep water.',
    });
  }

  if (
    beach?.environment?.familyFriendly === true &&
    (beach?.accessibility === 'DIFFICULT' || beach?.accessibility === 'BOAT_ONLY') &&
    beach?.characteristics?.shallowWaters !== true
  ) {
    audit.addIssue({
      severity: 'MEDIUM',
      issueType: 'family_friendly_with_hard_access_and_not_shallow',
      file,
      beach,
      region: regionEntry,
      currentValue: {
        familyFriendly: beach.environment.familyFriendly,
        accessibility: beach.accessibility,
        shallowWaters: beach.characteristics?.shallowWaters,
      },
      suggestedValue: 'needs human review',
      confidence: 0.8,
      evidenceNote: 'Family-friendly is questionable when access is hard and shallow water is not present.',
    });
  }

  const expectedRegion = summaryPayload?.region?.region || regionEntry?.region;
  const expectedIsland = summaryPayload?.region?.prefecture || regionEntry?.prefecture;

  if (!isObject(beach?.location)) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'missing_location',
      file,
      beach,
      region: regionEntry,
      currentValue: beach?.location ?? null,
      evidenceNote: 'Beach location should include region and island/prefecture.',
    });
  } else {
    if (expectedRegion && beach.location.region !== expectedRegion) {
      audit.addIssue({
        severity: 'MEDIUM',
        issueType: 'location_region_mismatch',
        file,
        beach,
        region: regionEntry,
        currentValue: beach.location.region,
        suggestedValue: expectedRegion,
        evidenceNote: 'Beach location.region differs from the region payload.',
      });
    }

    if (expectedIsland && beach.location.island !== expectedIsland) {
      audit.addIssue({
        severity: 'MEDIUM',
        issueType: 'location_island_mismatch',
        file,
        beach,
        region: regionEntry,
        currentValue: beach.location.island,
        suggestedValue: expectedIsland,
        evidenceNote: 'Beach location.island differs from the region payload prefecture.',
      });
    }
  }

  if (beach?.orientation) audit.stats.beachesWithOrientation += 1;
  if (beach?.windProfile) audit.stats.beachesWithWindProfile += 1;
  validateMetadata(audit, { file, beach, region: regionEntry });
};

const validateRegionPayload = async (audit, entry, seenBeachIds, allBeaches) => {
  const summaryPath = getSummaryPath(entry);
  const detailPath = getDetailPath(entry);
  let summaryPayload;
  let detailPayload;

  try {
    summaryPayload = await readJson(summaryPath);
  } catch (error) {
    audit.addIssue({
      severity: 'BLOCKER',
      issueType: 'missing_or_invalid_summary_file',
      file: summaryPath,
      region: entry,
      currentValue: error.message,
      evidenceNote: 'Runtime summary file could not be read or parsed.',
    });
    return;
  }

  const beaches = summaryPayload?.island?.beaches;
  if (!Array.isArray(beaches)) {
    audit.addIssue({
      severity: 'BLOCKER',
      issueType: 'missing_summary_beaches',
      file: summaryPath,
      region: entry,
      currentValue: summaryPayload?.island ?? null,
      evidenceNote: 'Summary payload does not contain island.beaches.',
    });
    return;
  }

  if (summaryPayload?.region?.id !== entry.id || summaryPayload?.island?.id !== entry.id) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'summary_region_id_mismatch',
      file: summaryPath,
      region: entry,
      currentValue: {
        indexId: entry.id,
        payloadRegionId: summaryPayload?.region?.id,
        payloadIslandId: summaryPayload?.island?.id,
      },
      evidenceNote: 'Summary payload ids should match the index entry id.',
    });
  }

  if (Number.isInteger(entry.beachCount) && entry.beachCount !== beaches.length) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'summary_beach_count_mismatch',
      file: summaryPath,
      region: entry,
      currentValue: beaches.length,
      suggestedValue: entry.beachCount,
      evidenceNote: 'Summary beach count differs from the index beachCount.',
    });
  }

  const regionBeachIds = new Set();
  const regionNameKeys = new Map();

  for (const beach of beaches) {
    validateBeach(audit, { file: summaryPath, beach, regionEntry: entry, summaryPayload });

    if (Number.isInteger(beach?.id)) {
      if (regionBeachIds.has(beach.id)) {
        audit.addIssue({
          severity: 'BLOCKER',
          issueType: 'duplicate_beach_id_in_region',
          file: summaryPath,
          beach,
          region: entry,
          currentValue: beach.id,
          evidenceNote: 'Same beach id appears more than once in one region summary.',
        });
      }
      regionBeachIds.add(beach.id);

      const previous = seenBeachIds.get(beach.id);
      if (previous && previous.file !== summaryPath) {
        audit.addIssue({
          severity: 'BLOCKER',
          issueType: 'duplicate_beach_id_global',
          file: summaryPath,
          beach,
          region: entry,
          currentValue: beach.id,
          evidenceNote: `Beach id already appeared in ${toRelativePath(previous.file)}.`,
        });
      } else {
        seenBeachIds.set(beach.id, { file: summaryPath, beach, region: entry });
      }
    }

    const nameKey = normalize(getLocalizedName(beach?.name));
    const islandKey = normalize(beach?.location?.island || entry.prefecture || entry.id);
    if (nameKey) {
      const scopedNameKey = `${islandKey}:${nameKey}`;
      const previousName = regionNameKeys.get(scopedNameKey);
      if (previousName && previousName.id !== beach.id) {
        addDuplicateNameIssue(audit, {
          file: summaryPath,
          beach,
          previousBeach: previousName,
          region: entry,
        });
      } else {
        regionNameKeys.set(scopedNameKey, beach);
      }
    }

    if (isGreeceCoordinate(beach?.coordinates)) {
      allBeaches.push({ file: summaryPath, beach, region: entry, coordinates: beach.coordinates });
    }
  }

  try {
    detailPayload = await readJson(detailPath);
  } catch (error) {
    audit.addIssue({
      severity: 'HIGH',
      issueType: 'missing_or_invalid_detail_file',
      file: detailPath,
      region: entry,
      currentValue: error.message,
      evidenceNote: 'Detail payload could not be read or parsed. Beach detail pages may lose data.',
    });
    return;
  }

  const detailBeaches = Array.isArray(detailPayload?.beaches) ? detailPayload.beaches : [];
  const detailIds = new Set(detailBeaches.map(beach => beach?.id).filter(Number.isInteger));

  for (const beach of beaches) {
    if (Number.isInteger(beach?.id) && !detailIds.has(beach.id)) {
      audit.addIssue({
        severity: 'HIGH',
        issueType: 'missing_detail_record',
        file: detailPath,
        beach,
        region: entry,
        currentValue: beach.id,
        evidenceNote: 'Summary beach id is missing from the detail payload.',
      });
    }
  }

  for (const detailBeach of detailBeaches) {
    if (!Number.isInteger(detailBeach?.id) || !regionBeachIds.has(detailBeach.id)) {
      audit.addIssue({
        severity: 'MEDIUM',
        issueType: 'orphan_detail_record',
        file: detailPath,
        beach: detailBeach,
        region: entry,
        currentValue: detailBeach?.id ?? null,
        evidenceNote: 'Detail record does not match a summary beach id for this region.',
      });
    }
  }
};

const addCoordinateOverlapIssues = (audit, allBeaches) => {
  const exactCoordinateMap = new Map();
  const nearPairs = [];

  for (const row of allBeaches) {
    const exactKey = `${row.coordinates.lat.toFixed(6)},${row.coordinates.lon.toFixed(6)}`;
    const previous = exactCoordinateMap.get(exactKey);
    if (previous && previous.beach.id !== row.beach.id) {
      audit.addIssue({
        severity: 'HIGH',
        issueType: 'duplicate_exact_coordinates',
        file: row.file,
        beach: row.beach,
        region: row.region,
        currentValue: row.coordinates,
        evidenceNote: `Exact coordinates also used by ${beachLabel(previous.beach)} in ${previous.region.id}.`,
      });
    } else {
      exactCoordinateMap.set(exactKey, row);
    }
  }

  for (let index = 0; index < allBeaches.length; index += 1) {
    const current = allBeaches[index];
    for (let nextIndex = index + 1; nextIndex < allBeaches.length; nextIndex += 1) {
      const next = allBeaches[nextIndex];
      if (current.beach.id === next.beach.id) continue;
      if (current.region.id !== next.region.id) continue;

      const distanceMeters = haversineMeters(current.coordinates, next.coordinates);
      if (distanceMeters > 0 && distanceMeters <= duplicateCoordinateDistanceMeters) {
        nearPairs.push({ current, next, distanceMeters });
      }
    }
  }

  for (const pair of nearPairs.slice(0, 80)) {
    audit.addIssue({
      severity: 'MEDIUM',
      issueType: 'near_duplicate_coordinates',
      file: pair.current.file,
      beach: pair.current.beach,
      region: pair.current.region,
      currentValue: {
        coordinates: pair.current.coordinates,
        nearBeach: beachLabel(pair.next.beach),
        nearBeachCoordinates: pair.next.coordinates,
        distanceMeters: Number(pair.distanceMeters.toFixed(1)),
      },
      evidenceNote: `Another beach in the same region is within ${duplicateCoordinateDistanceMeters}m. This may be valid, but it needs review.`,
    });
  }
};

const getExternalCandidateReview = ({ candidate, nearestBeach, sameNameBeach }) => {
  if (sameNameBeach && sameNameBeach.distanceMeters > coverageCoordinateMismatchMeters) {
    return {
      issueType: 'external_coordinate_mismatch_candidate',
      severity: 'MEDIUM',
      target: sameNameBeach,
      confidence: 0.7,
      reviewBucket: 'coordinate_review',
      suggestedValue: 'compare BeachBuddy coordinate with external source; do not auto-change without evidence',
      humanSummary: `Coordinate review: OSM same-name candidate is ${Number(sameNameBeach.distanceMeters.toFixed(1))}m away.`,
      evidenceNote: `OSM has a same-name candidate ${Number(sameNameBeach.distanceMeters.toFixed(1))}m from the BeachBuddy point.`,
    };
  }

  if (sameNameBeach) {
    return {
      issueType: 'external_coordinate_precision_candidate',
      severity: 'LOW',
      target: sameNameBeach,
      confidence: 0.55,
      reviewBucket: 'coordinate_precision_note',
      suggestedValue: 'review only if coordinate precision matters for this beach',
      humanSummary: `Coordinate precision note: ${candidate.displayName} is ${Number(sameNameBeach.distanceMeters.toFixed(1))}m from OSM.`,
      evidenceNote: `OSM has a same-name candidate ${Number(sameNameBeach.distanceMeters.toFixed(1))}m from the BeachBuddy point.`,
    };
  }

  if (nearestBeach && nearestBeach.distanceMeters <= coveragePossibleAliasMeters) {
    return {
      issueType: 'possible_alias_or_nearby_section',
      severity: 'MEDIUM',
      target: nearestBeach,
      confidence: 0.6,
      reviewBucket: 'likely_existing_or_section',
      suggestedValue: 'review whether this is an alias, small nearby section, or separate beach',
      humanSummary: `Likely existing nearby beach/section: ${candidate.displayName} is ${Number(nearestBeach.distanceMeters.toFixed(1))}m from ${beachLabel(nearestBeach.beach)}.`,
      evidenceNote: `OSM candidate "${candidate.displayName}" is near ${beachLabel(nearestBeach.beach)} but uses a different name.`,
    };
  }

  if (nearestBeach && nearestBeach.distanceMeters <= coverageNeedsSourceReviewMeters) {
    return {
      issueType: 'possible_nearby_missing_or_alias',
      severity: 'MEDIUM',
      target: nearestBeach,
      confidence: 0.62,
      reviewBucket: 'source_review',
      suggestedValue: 'review map/source context before deciding whether this is a new beach or nearby alias',
      humanSummary: `Source review: ${candidate.displayName} is ${Number(nearestBeach.distanceMeters.toFixed(1))}m from ${beachLabel(nearestBeach.beach)}.`,
      evidenceNote: `OSM candidate "${candidate.displayName}" is in the same broader area as ${beachLabel(nearestBeach.beach)}.`,
    };
  }

  return {
    issueType: 'likely_missing_beach_candidate',
    severity: 'MEDIUM',
    target: null,
    confidence: 0.68,
    reviewBucket: 'likely_missing_candidate',
    suggestedValue: 'review whether this external candidate should be added or intentionally ignored',
    humanSummary: `Likely missing candidate from OSM: ${candidate.displayName}.`,
    evidenceNote: `OSM has named beach candidate "${candidate.displayName}" with no BeachBuddy beach within ${coverageNeedsSourceReviewMeters}m.`,
  };
};

const getExternalCoverageReviewDecision = (candidate, selectedRegions) => {
  const decision = externalCoverageReviewDecisions.get(candidate.sourceUrl);
  const selectedIds = new Set(selectedRegions.map(region => region.id));
  const isHalkidikiScope = selectedIds.has('central-macedonia-halkidiki-mainland');
  const isRhodesScope = selectedIds.has('south-aegean-rhodes');
  const isThesprotiaScope = selectedIds.has('epirus-thesprotia-mainland');
  const isThessalonikiScope = selectedIds.has('central-macedonia-thessaloniki-area');

  if (!decision && isHalkidikiScope) {
    const displayName = normalize(candidate.displayName || candidate.name);
    const isNudistSection = candidate.tags?.nudism || displayName.includes('gymniston') || displayName.includes('gymnistion');
    if (isNudistSection) {
      return {
        issueType: 'external_candidate_deferred_nudist_section',
        humanSummary: 'Deferred Halkidiki nudist section: not added until BeachBuddy has an explicit nudism/FKK data model.',
        evidenceNote: 'The OSM candidate is marked or named as a nudist section. It is intentionally not added as a normal family/tourist beach card yet.',
      };
    }

    if (halkidikiAcceptedSectionUrls.has(candidate.sourceUrl)) {
      return {
        issueType: 'external_candidate_accepted_existing_section',
        humanSummary: 'Accepted Halkidiki section/venue: this OSM candidate is treated as a nearby section, alias, or venue of an existing BeachBuddy beach.',
        evidenceNote: 'The OSM candidate is close to an existing Halkidiki beach or represents a venue/section name. No separate BeachBuddy card is needed for the MVP.',
      };
    }
  }

  if (!decision && isRhodesScope && rhodesAcceptedSectionUrls.has(candidate.sourceUrl)) {
    return {
      issueType: 'external_candidate_accepted_existing_section',
      humanSummary: 'Accepted Rhodes section: this OSM candidate is treated as a section of an existing BeachBuddy beach.',
      evidenceNote: 'The OSM candidate is a named section of the broader Faliraki/Ixia beach area. No separate BeachBuddy card is needed for the MVP.',
    };
  }

  if (!decision && isThesprotiaScope && thesprotiaAcceptedSectionUrls.has(candidate.sourceUrl)) {
    return {
      issueType: 'external_candidate_accepted_existing_section',
      humanSummary: 'Accepted Thesprotia section: this OSM candidate is treated as a section of an existing broader beach area.',
      evidenceNote: 'The OSM candidate is a duplicate or nearby section of Drepano, Makrygiali, or Plataria. No separate BeachBuddy card is needed for the MVP.',
    };
  }

  if (!decision && isThessalonikiScope) {
    const displayName = normalize(candidate.displayName || candidate.name);
    const isNudistSection = candidate.tags?.nudism || displayName.includes('gymniston') || displayName.includes('gymnistion');
    if (isNudistSection) {
      return {
        issueType: 'external_candidate_deferred_nudist_section',
        humanSummary: 'Deferred Thessaloniki nudist section: not added until BeachBuddy has an explicit nudism/FKK data model.',
        evidenceNote: 'The OSM candidate is marked or named as a nudist section. It is intentionally not added as a normal family/tourist beach card yet.',
      };
    }

    if (thessalonikiAcceptedSectionUrls.has(candidate.sourceUrl)) {
      return {
        issueType: 'external_candidate_accepted_existing_section',
        humanSummary: 'Accepted Thessaloniki section: this OSM candidate is treated as a section, alias, or venue of an existing BeachBuddy beach.',
        evidenceNote: 'The OSM candidate is close to an existing Thessaloniki beach or represents a section name. No separate BeachBuddy card is needed for the MVP.',
      };
    }
  }

  if (!decision) return null;
  const appliesToScope = !decision.scopeIds || [...decision.scopeIds].some(id => selectedIds.has(id));
  return appliesToScope ? decision : null;
};

const addExternalCoverageIssues = async (audit, selectedRegions, allBeaches) => {
  if (!audit.options.externalResearch) return;

  const scope = getDeepCoverageScope(selectedRegions, allBeaches, audit.options);
  if (!scope) {
    return;
  }

  let externalReport;
  try {
    externalReport = await fetchOsmCoverageCandidates(scope, audit.options);
  } catch (error) {
    audit.addIssue({
      severity: 'LOW',
      issueType: 'external_coverage_source_unavailable',
      file: indexPath,
      currentValue: error.message,
      suggestedValue: 'Retry later or run fast local audit only.',
      confidence: 1,
      evidenceNote: 'OpenStreetMap Overpass coverage candidates could not be fetched.',
      recommendedAction: 'needs_external_research',
      reviewCategory: 'informational',
      humanSummary: 'External coverage source unavailable; local deterministic audit still ran.',
    });
    return;
  }

  const candidates = externalReport.candidates || [];
  audit.stats.externalCoverageCandidates = candidates.length;
  audit.stats.externalCoverageSource = `${externalReport.sourceName}${externalReport.fromCache ? ' cache' : ''}`;

  for (const candidate of candidates) {
    const decision = getExternalCoverageReviewDecision(candidate, selectedRegions);
    if (decision) {
      audit.addIssue({
        severity: 'LOW',
        issueType: decision.issueType,
        file: null,
        region: selectedRegions[0],
        currentValue: {
          externalName: candidate.name,
          externalDisplayName: candidate.displayName,
          externalCoordinates: candidate.coordinates,
          reviewBucket: 'accepted_or_ignored_candidate',
          sourceUrl: candidate.sourceUrl,
        },
        suggestedValue: 'no data change needed',
        confidence: 0.9,
        evidenceNote: decision.evidenceNote,
        evidenceSourceName: candidate.sourceName,
        evidenceSourceUrl: candidate.sourceUrl,
        recommendedAction: 'accepted_no_change',
        reviewCategory: 'informational',
        humanSummary: decision.humanSummary,
      });
      continue;
    }

    const nearestBeach = allBeaches
      .map(row => ({
        ...row,
        distanceMeters: haversineMeters(candidate.coordinates, row.coordinates),
        nameKeys: getBeachCoverageNameKeys(row.beach),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    const candidateNameKeys = new Set(candidate.nameKeys || [candidate.normalizedName].filter(Boolean));
    const sameNameBeach = allBeaches
      .filter(row => nameKeySetsOverlap(getBeachCoverageNameKeys(row.beach), candidateNameKeys))
      .map(row => ({
        ...row,
        distanceMeters: haversineMeters(candidate.coordinates, row.coordinates),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)[0];

    if (nearestBeach && nearestBeach.distanceMeters <= coverageNearbyMatchMeters) {
      continue;
    }

    const review = getExternalCandidateReview({ candidate, nearestBeach, sameNameBeach });
    const target = review.target;

    audit.addIssue({
      severity: review.severity,
      issueType: review.issueType,
      file: target?.file || null,
      beach: target?.beach,
      region: target?.region || selectedRegions[0],
      currentValue: {
        externalName: candidate.name,
        externalDisplayName: candidate.displayName,
        externalCoordinates: candidate.coordinates,
        nearestBeach: nearestBeach ? beachLabel(nearestBeach.beach) : null,
        nearestBeachDistanceMeters: nearestBeach ? Number(nearestBeach.distanceMeters.toFixed(1)) : null,
        matchedBeach: target?.beach ? beachLabel(target.beach) : null,
        matchedBeachCoordinates: target?.coordinates || null,
        matchedBeachDistanceMeters: target?.distanceMeters ? Number(target.distanceMeters.toFixed(1)) : null,
        reviewBucket: review.reviewBucket,
        sourceUrl: candidate.sourceUrl,
      },
      suggestedValue: review.suggestedValue,
      confidence: review.confidence,
      evidenceNote: review.evidenceNote,
      evidenceSourceName: candidate.sourceName,
      evidenceSourceUrl: candidate.sourceUrl,
      recommendedAction: 'needs_external_research',
      reviewCategory: review.severity === 'LOW' ? 'informational' : 'human_review',
      humanSummary: review.humanSummary,
    });
  }
};

const addSchemaCoverageIssues = audit => {
  const amenityEntries = Object.entries(audit.stats.metadataAmenityValues)
    .sort((a, b) => b[1] - a[1]);

  if (amenityEntries.length > 0) {
    const hasMixedFreeText = amenityEntries.some(([value]) => /[\/()]|\s{2,}|,|;/.test(value) || value !== normalize(value));
    if (hasMixedFreeText) {
      audit.addIssue({
        severity: 'LOW',
        issueType: 'metadata_amenities_free_text_schema',
        file: null,
        region: null,
        currentValue: amenityEntries.slice(0, 30).map(([value, count]) => ({ value, count })),
        suggestedValue: 'Move metadata.amenities toward controlled values while preserving source notes separately.',
        confidence: 0.9,
        evidenceNote: 'metadata.amenities currently contains free-text labels. This is acceptable for source notes but risky as a feature schema.',
        recommendedAction: 'needs_human_review',
      });
    }
  }
};

const getCountsBySeverity = issues => issues.reduce((acc, issue) => {
  acc[issue.severity] = (acc[issue.severity] || 0) + 1;
  return acc;
}, { BLOCKER: 0, HIGH: 0, MEDIUM: 0, LOW: 0 });

const sortIssues = issues => issues.sort((a, b) => {
  const severityDelta = severityOrder[a.severity] - severityOrder[b.severity];
  if (severityDelta !== 0) return severityDelta;
  const typeDelta = a.issue_type.localeCompare(b.issue_type);
  if (typeDelta !== 0) return typeDelta;
  return String(a.beach_name || '').localeCompare(String(b.beach_name || ''));
});

const buildReviewSummary = issues => {
  const byType = {};
  const byRegion = {};
  const byBucket = {};

  for (const issue of issues) {
    byType[issue.issue_type] = (byType[issue.issue_type] || 0) + 1;
    const bucket = issue.current_value?.reviewBucket;
    if (bucket) {
      byBucket[bucket] = (byBucket[bucket] || 0) + 1;
    }
    if (issue.region) {
      byRegion[issue.region] = (byRegion[issue.region] || 0) + 1;
    }
  }

  const counts = getCountsBySeverity(issues);
  const mustFixNow = (counts.BLOCKER || 0) + (counts.HIGH || 0);
  const humanReview = counts.MEDIUM || 0;
  const informational = counts.LOW || 0;

  return {
    mustFixNow,
    humanReview,
    informational,
    canUseAsGate: mustFixNow === 0,
    nextAction: mustFixNow > 0
      ? 'Fix BLOCKER/HIGH issues before trusting the dataset gate.'
      : humanReview > 0
        ? 'No blocking data issues found. Review MEDIUM findings gradually; do not auto-change beach facts.'
        : 'No blocking or review-level issues found.',
    issueCountsByType: Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .map(([issueType, count]) => ({ issueType, count })),
    externalReviewBuckets: Object.entries(byBucket)
      .sort((a, b) => b[1] - a[1])
      .map(([bucket, count]) => ({ bucket, count })),
    regionsWithMostIssues: Object.entries(byRegion)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([region, count]) => ({ region, count })),
  };
};

const formatMarkdownReport = report => {
  const counts = report.summary.issueCountsBySeverity;
  const issueLines = report.issues.slice(0, 120).map(issue => [
    `- ${issue.severity} ${issue.issue_type}`,
    `  - Meaning: ${issue.human_summary || 'n/a'}`,
    `  - Review category: ${issue.review_category || 'n/a'}`,
    `  - Beach: ${issue.beach_name || 'n/a'}${issue.beach_id !== null ? ` (${issue.beach_id})` : ''}`,
    `  - Region: ${issue.region || 'n/a'}`,
    `  - File: ${issue.file || 'n/a'}`,
    `  - Evidence: ${issue.evidence[0]?.quote_or_note || 'n/a'}`,
  ].join('\n'));

  if (report.issues.length > 120) {
    issueLines.push(`- ${report.issues.length - 120} more issues omitted from Markdown report. See JSON report for full details.`);
  }

  return [
    '# Beach Dataset Audit',
    '',
    `Generated at: ${report.generatedAt}`,
    `Mode: ${report.mode}`,
    `Scope: ${report.scope.label}`,
    '',
    '## Summary',
    '',
    `- Regions checked: ${report.summary.regionsChecked}`,
    `- Beaches checked: ${report.summary.beachesChecked}`,
    `- Issues: ${report.summary.totalIssues}`,
    `- BLOCKER: ${counts.BLOCKER || 0}`,
    `- HIGH: ${counts.HIGH || 0}`,
    `- MEDIUM: ${counts.MEDIUM || 0}`,
    `- LOW: ${counts.LOW || 0}`,
    `- Accepted shared-name pairs: ${report.summary.acceptedSharedNamePairs || 0}`,
    `- Must fix now: ${report.reviewSummary.mustFixNow}`,
    `- Human review: ${report.reviewSummary.humanReview}`,
    `- Informational: ${report.reviewSummary.informational}`,
    `- Gate status: ${report.reviewSummary.canUseAsGate ? 'pass for BLOCKER/HIGH issues' : 'blocked by BLOCKER/HIGH issues'}`,
    `- Next action: ${report.reviewSummary.nextAction}`,
    '',
    '## Issue Types',
    '',
    report.reviewSummary.issueCountsByType.length
      ? report.reviewSummary.issueCountsByType.map(item => `- ${item.issueType}: ${item.count}`).join('\n')
      : '- none',
    '',
    '## External Review Buckets',
    '',
    report.reviewSummary.externalReviewBuckets.length
      ? report.reviewSummary.externalReviewBuckets.map(item => `- ${item.bucket}: ${item.count}`).join('\n')
      : '- none',
    '',
    '## Regions With Most Issues',
    '',
    report.reviewSummary.regionsWithMostIssues.length
      ? report.reviewSummary.regionsWithMostIssues.map(item => `- ${item.region}: ${item.count}`).join('\n')
      : '- none',
    '',
    '## Accepted Shared-Name Pairs',
    '',
    report.acceptedSharedNamePairs?.length
      ? report.acceptedSharedNamePairs.map(item => [
        `- ${item.region}: ${item.previousBeach} / ${item.currentBeach}`,
        `  - Distance: ${item.distanceMeters ?? 'n/a'}m`,
        `  - Reviewed: ${item.reviewedAt}`,
        `  - Note: ${item.note}`,
      ].join('\n')).join('\n')
      : '- none',
    '',
    '## Coverage',
    '',
    `- Beaches with metadata: ${report.coverage.beachesWithMetadata}`,
    `- Beaches with orientation: ${report.coverage.beachesWithOrientation}`,
    `- Beaches with windProfile: ${report.coverage.beachesWithWindProfile}`,
    `- External coverage source: ${report.coverage.externalCoverageSource || 'not used'}`,
    `- External coverage candidates: ${report.coverage.externalCoverageCandidates}`,
    `- Metadata confidence values: ${JSON.stringify(report.coverage.confidenceValues)}`,
    '',
    '## Notes',
    '',
    '- This audit is deterministic and read-only.',
    '- It does not verify facts against external sources.',
    '- Deep mode currently means stricter local reporting only; external research is intentionally not automated yet.',
    '- Suggested fixes are review guidance, not automatic data changes.',
    '',
    '## Issues',
    '',
    issueLines.length ? issueLines.join('\n') : 'No issues found.',
    '',
  ].join('\n');
};

const getIssueTitle = issue => {
  const currentValue = issue.current_value || {};
  return issue.beach_name || currentValue.externalDisplayName || currentValue.externalName || issue.region || 'Dataset issue';
};

const getDistanceText = issue => {
  const currentValue = issue.current_value || {};
  const distance = currentValue.distanceMeters ||
    currentValue.matchedBeachDistanceMeters ||
    currentValue.nearestBeachDistanceMeters;
  return distance ? `${distance}m` : '';
};

const getGreekSeverity = severity => {
  switch (severity) {
    case 'BLOCKER':
      return 'BLOCKER - Σταματάει τον έλεγχο';
    case 'HIGH':
      return 'HIGH - Θέλει άμεση διόρθωση';
    case 'MEDIUM':
      return 'MEDIUM - Θέλει ανθρώπινο έλεγχο';
    case 'LOW':
      return 'LOW - Απλή σημείωση';
    default:
      return severity || 'Άγνωστη σοβαρότητα';
  }
};

const getGreekCategory = issue => {
  const value = issue.current_value?.reviewBucket || issue.issue_type;
  switch (value) {
    case 'coordinate_review':
    case 'external_coordinate_mismatch_candidate':
      return 'Συντεταγμένες για έλεγχο';
    case 'coordinate_precision_note':
    case 'external_coordinate_precision_candidate':
      return 'Μικρή απόκλιση συντεταγμένων';
    case 'likely_missing_candidate':
    case 'likely_missing_beach_candidate':
      return 'Πιθανή παραλία που λείπει';
    case 'likely_existing_or_section':
    case 'possible_alias_or_nearby_section':
      return 'Πιθανό alias ή μικρό κοντινό τμήμα';
    case 'source_review':
    case 'possible_nearby_missing_or_alias':
      return 'Θέλει έλεγχο πηγής';
    case 'new_feature_candidate':
      return 'Νέο χαρακτηριστικό/feature';
    case 'likely_duplicate_name_near_coordinates':
    case 'possible_duplicate_name_same_area':
      return 'Πιθανή διπλή εγγραφή';
    case 'shared_name_same_island_far_apart':
      return 'Ίδιο όνομα σε διαφορετικά σημεία';
    case 'external_coverage_scope_not_supported':
      return 'Το deep external coverage δεν υποστηρίζεται ακόμα για αυτό το scope';
    default:
      return value || 'Άλλο θέμα';
  }
};

const getGreekIssueSummary = issue => {
  const currentValue = issue.current_value || {};
  const externalName = currentValue.externalDisplayName || currentValue.externalName || getIssueTitle(issue);
  const distance = getDistanceText(issue);

  switch (issue.issue_type) {
    case 'external_coordinate_mismatch_candidate':
      return `Βρέθηκε ίδια/παρόμοια παραλία σε εξωτερική πηγή, αλλά το σημείο απέχει αρκετά${distance ? ` (${distance})` : ''} από το σημείο που έχουμε στο BeachBuddy.`;
    case 'external_coordinate_precision_candidate':
      return `Βρέθηκε ίδια/παρόμοια παραλία σε εξωτερική πηγή με μικρότερη απόκλιση${distance ? ` (${distance})` : ''}. Δεν είναι επείγον, αλλά μπορεί να βελτιώσει την ακρίβεια του χάρτη.`;
    case 'likely_missing_beach_candidate':
      return `Η εξωτερική πηγή έχει υποψήφια παραλία "${externalName}" που δεν ταιριάζει καθαρά με υπάρχουσα εγγραφή στο BeachBuddy. Μπορεί να λείπει ή μπορεί να μην αξίζει να προστεθεί.`;
    case 'possible_alias_or_nearby_section':
      return `Η εξωτερική πηγή έχει το "${externalName}" κοντά σε υπάρχουσα παραλία. Μπορεί να είναι άλλο όνομα, μικρό τμήμα της ίδιας παραλίας ή ξεχωριστή μικρή παραλία.`;
    case 'possible_nearby_missing_or_alias':
      return `Το "${externalName}" είναι στην ίδια ευρύτερη περιοχή με υπάρχουσα παραλία, αλλά δεν είναι αρκετά καθαρό αν είναι νέα παραλία ή alias.`;
    case 'external_coverage_scope_not_supported':
      return 'Ζητήθηκε deep external coverage για περιοχή που δεν υποστηρίζεται ακόμα. Το audit κράτησε τους εσωτερικούς ελέγχους και δεν έκανε εξωτερική κάλυψη.';
    case 'new_feature_candidate':
      return 'Βρέθηκε χαρακτηριστικό/feature που δεν είναι ακόμα στο ελεγχόμενο schema. Πρέπει να αποφασίσουμε αν το κρατάμε επίσημα ή το μετονομάζουμε.';
    case 'likely_duplicate_name_near_coordinates':
      return 'Υπάρχουν δύο εγγραφές με ίδιο/πολύ παρόμοιο όνομα και πολύ κοντινές συντεταγμένες. Πιθανόν είναι διπλή εγγραφή.';
    case 'possible_duplicate_name_same_area':
      return 'Υπάρχουν δύο εγγραφές με ίδιο/παρόμοιο όνομα στην ίδια περιοχή. Θέλει έλεγχο αν είναι διπλό ή διαφορετικά σημεία.';
    case 'shared_name_same_island_far_apart':
      return 'Υπάρχει ίδιο όνομα στο ίδιο νησί, αλλά τα σημεία είναι αρκετά μακριά. Συνήθως αυτό δεν είναι άμεσο πρόβλημα.';
    default:
      return issue.human_summary || issue.evidence?.[0]?.quote_or_note || 'Χρειάζεται ανθρώπινος έλεγχος.';
  }
};

const getSimpleAction = issue => {
  switch (issue.issue_type) {
    case 'external_coordinate_mismatch_candidate':
      return 'Σύγκρινε το σημείο στο BeachBuddy με το σημείο της πηγής. Μην αλλάξεις συντεταγμένες χωρίς επιβεβαίωση.';
    case 'external_coordinate_precision_candidate':
      return 'Χαμηλή προτεραιότητα. Έλεγξέ το μόνο αν θέλουμε μεγαλύτερη ακρίβεια στο χάρτη.';
    case 'likely_missing_beach_candidate':
      return 'Έλεγξε αν πρέπει να προστεθεί σαν νέα παραλία ή να αγνοηθεί.';
    case 'possible_alias_or_nearby_section':
      return 'Έλεγξε αν είναι άλλη παραλία, μικρό τμήμα, ή alias υπάρχουσας παραλίας.';
    case 'possible_nearby_missing_or_alias':
      return 'Χρειάζεται έλεγχος πηγής/χάρτη πριν αποφασίσουμε αν είναι νέα παραλία.';
    case 'possible_duplicate_name_same_area':
    case 'likely_duplicate_name_near_coordinates':
      return 'Έλεγξε αν είναι διπλή εγγραφή ή δύο ξεχωριστά σημεία με ίδιο όνομα.';
    case 'shared_name_same_island_far_apart':
      return 'Μάλλον φυσιολογικό ίδιο όνομα. Δεν χρειάζεται άμεση ενέργεια.';
    case 'new_feature_candidate':
      return 'Αποφασίζουμε αν αυτό το νέο feature πρέπει να μπει επίσημα στο schema.';
    default:
      return issue.suggested_value || 'Χρειάζεται ανθρώπινος έλεγχος.';
  }
};

const formatSimpleIssue = issue => {
  const currentValue = issue.current_value || {};
  const sourceUrl = issue.evidence?.[0]?.source_url || currentValue.sourceUrl;
  const distance = currentValue.distanceMeters ||
    currentValue.matchedBeachDistanceMeters ||
    currentValue.nearestBeachDistanceMeters;
  const lines = [
    `### ${getIssueTitle(issue)}`,
    '',
    `- Τι βρήκαμε: ${getGreekIssueSummary(issue)}`,
    `- Κατηγορία: ${getGreekCategory(issue)}`,
    `- Σοβαρότητα: ${getGreekSeverity(issue.severity)}`,
  ];

  if (currentValue.matchedBeach) {
    lines.push(`- Υπάρχουσα παραλία που ταιριάζει: ${currentValue.matchedBeach}`);
  } else if (currentValue.nearestBeach) {
    lines.push(`- Πιο κοντινή υπάρχουσα παραλία: ${currentValue.nearestBeach}`);
  }
  if (distance) {
    lines.push(`- Απόσταση: ${distance}m`);
  }
  if (sourceUrl) {
    lines.push(`- Πηγή: ${sourceUrl}`);
  }

  lines.push(`- Τι κάνουμε μετά: ${getSimpleAction(issue)}`);
  return `${lines.join('\n')}\n`;
};

const formatSimpleReviewReport = report => {
  const mustFix = report.issues.filter(issue => issue.severity === 'BLOCKER' || issue.severity === 'HIGH');
  const coordinateReview = report.issues.filter(issue => issue.current_value?.reviewBucket === 'coordinate_review');
  const likelyMissing = report.issues.filter(issue => issue.current_value?.reviewBucket === 'likely_missing_candidate');
  const nearbyOrAlias = report.issues.filter(issue => (
    issue.current_value?.reviewBucket === 'likely_existing_or_section' ||
    issue.current_value?.reviewBucket === 'source_review'
  ));
  const notes = report.issues.filter(issue => issue.severity === 'LOW');
  const otherReview = report.issues.filter(issue => (
    issue.severity === 'MEDIUM' &&
    !coordinateReview.includes(issue) &&
    !likelyMissing.includes(issue) &&
    !nearbyOrAlias.includes(issue)
  ));

  const section = (title, description, issues) => [
    `## ${title}`,
    '',
    description,
    '',
    issues.length ? issues.map(formatSimpleIssue).join('\n') : 'Δεν βρέθηκε κάτι σε αυτή την κατηγορία.',
    '',
  ].join('\n');

  return [
    '# Απλό Beach Data Report',
    '',
    `Ημερομηνία: ${report.generatedAt}`,
    `Περιοχή: ${report.scope.label}`,
    `Mode: ${report.mode}`,
    '',
    '## Γρήγορο συμπέρασμα',
    '',
    `- Παραλίες που ελέγχθηκαν: ${report.summary.beachesChecked}`,
    `- Άμεσα προβλήματα: ${report.reviewSummary.mustFixNow}`,
    `- Θέλουν ανθρώπινο έλεγχο: ${report.reviewSummary.humanReview}`,
    `- Απλές σημειώσεις: ${report.reviewSummary.informational}`,
    `- Gate status: ${report.reviewSummary.canUseAsGate ? 'Περνάει για BLOCKER/HIGH προβλήματα' : 'Μπλοκάρει λόγω σοβαρών προβλημάτων'}`,
    '',
    'Σημαντικό: αυτό το report δεν αλλάζει δεδομένα. Είναι λίστα για απόφαση.',
    '',
    section(
      '1. Άμεσα προβλήματα',
      'Αυτά πρέπει να διορθωθούν πριν εμπιστευτούμε το dataset.',
      mustFix
    ),
    section(
      '2. Συντεταγμένες που θέλουν έλεγχο',
      'Υπάρχει ίδια/παρόμοια παραλία σε εξωτερική πηγή, αλλά το σημείο απέχει αρκετά.',
      coordinateReview
    ),
    section(
      '3. Πιθανές παραλίες που λείπουν',
      'Αυτά είναι candidates από εξωτερική πηγή. Δεν σημαίνει ότι μπαίνουν αυτόματα.',
      likelyMissing
    ),
    section(
      '4. Ίσως είναι alias ή μικρό κοντινό τμήμα',
      'Αυτά μπορεί να υπάρχουν ήδη με άλλο όνομα ή να είναι μικρό section κοντά σε υπάρχουσα παραλία.',
      nearbyOrAlias
    ),
    section(
      '5. Άλλα θέματα για ανθρώπινο έλεγχο',
      'Υπόλοιπα medium findings που δεν ανήκουν στις παραπάνω κατηγορίες.',
      otherReview
    ),
    section(
      '6. Απλές σημειώσεις',
      'Δεν είναι άμεση δουλειά. Τα κρατάμε για καθάρισμα/βελτίωση αργότερα.',
      notes
    ),
    '## Προτεινόμενη σειρά δουλειάς',
    '',
    '1. Πρώτα κοιτάμε τις συντεταγμένες που θέλουν έλεγχο.',
    '2. Μετά αποφασίζουμε ποιες πιθανές missing παραλίες αξίζει να μπουν.',
    '3. Μετά κοιτάμε aliases/κοντινά sections.',
    '4. Τελευταίες μένουν οι απλές σημειώσεις.',
    '',
  ].join('\n');
};

const writeReports = async report => {
  const date = new Date().toISOString().slice(0, 10);
  const scopeSlug = slugify(report.scope.label);
  const baseName = `${date}-beaches-${scopeSlug}`;
  await mkdir(report.outputDir, { recursive: true });

  const jsonPath = path.join(report.outputDir, `${baseName}-issues.json`);
  const markdownPath = path.join(report.outputDir, `${baseName}-report.md`);
  const simpleReportPath = path.join(report.outputDir, `${baseName}-simple-report.md`);

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(markdownPath, formatMarkdownReport(report), 'utf8');
  await writeFile(simpleReportPath, formatSimpleReviewReport(report), 'utf8');

  return { jsonPath, markdownPath, simpleReportPath };
};

const splitEmailList = value => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const escapeHtml = value => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const getEmailConfig = options => ({
  apiKey: process.env.AUDIT_RESEND_API_KEY || process.env.RESEND_API_KEY || '',
  from: options.emailFrom || process.env.AUDIT_EMAIL_FROM || '',
  to: splitEmailList(options.emailTo || process.env.AUDIT_EMAIL_TO),
  cc: splitEmailList(process.env.AUDIT_EMAIL_CC),
  bcc: splitEmailList(process.env.AUDIT_EMAIL_BCC),
  subjectPrefix: process.env.AUDIT_EMAIL_SUBJECT_PREFIX || 'BeachBuddy Audit Report',
});

const getMissingEmailConfig = (config, { requireApiKey = true } = {}) => {
  const missing = [];
  if (requireApiKey && !config.apiKey) missing.push('RESEND_API_KEY or AUDIT_RESEND_API_KEY');
  if (!config.from) missing.push('AUDIT_EMAIL_FROM or --email-from');
  if (config.to.length === 0) missing.push('AUDIT_EMAIL_TO or --email-to');
  return missing;
};

const readAttachment = async filePath => ({
  filename: path.basename(filePath),
  content: (await readFile(filePath)).toString('base64'),
});

const formatEmailSubject = report => {
  const counts = report.summary.issueCountsBySeverity;
  const blockingCount = (counts.BLOCKER || 0) + (counts.HIGH || 0);
  const issuePart = `${report.summary.totalIssues} issues`;
  const gatePart = blockingCount > 0 ? `${blockingCount} blocking` : 'no blocking';
  return `${report.scope.label} - ${issuePart}, ${gatePart}`;
};

const sendAuditEmail = async ({ options, report, writtenReports }) => {
  if (!options.emailReports) {
    return { status: 'not-requested' };
  }

  if (!writtenReports) {
    return {
      status: 'skipped',
      reason: 'Reports were not written. Remove --no-write before using --email.',
    };
  }

  await loadLocalEnv();
  const config = getEmailConfig(options);
  const missing = getMissingEmailConfig(config, { requireApiKey: !options.emailDryRun });
  if (missing.length > 0) {
    return {
      status: 'skipped',
      reason: `Missing email config: ${missing.join(', ')}`,
    };
  }

  const simpleReportText = await readFile(writtenReports.simpleReportPath, 'utf8');
  const attachments = await Promise.all([
    readAttachment(writtenReports.simpleReportPath),
    readAttachment(writtenReports.markdownPath),
    readAttachment(writtenReports.jsonPath),
  ]);

  const payload = {
    from: config.from,
    to: config.to,
    subject: `${config.subjectPrefix} - ${formatEmailSubject(report)}`,
    text: simpleReportText,
    html: [
      '<div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.5;color:#0f172a">',
      '<h1 style="font-size:20px;margin:0 0 12px">BeachBuddy Audit Report</h1>',
      '<p style="margin:0 0 16px">Το απλό report είναι μέσα στο email. Τα πλήρη αρχεία είναι συνημμένα.</p>',
      '<pre style="white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;font-size:13px;line-height:1.45">',
      escapeHtml(simpleReportText),
      '</pre>',
      '</div>',
    ].join(''),
    attachments,
  };

  if (config.cc.length > 0) payload.cc = config.cc;
  if (config.bcc.length > 0) payload.bcc = config.bcc;

  if (options.emailDryRun) {
    return {
      status: 'dry-run',
      to: config.to,
      from: config.from,
      subject: payload.subject,
      attachments: attachments.map(item => item.filename),
    };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseBody = await response.json().catch(() => null);

  if (!response.ok) {
    return {
      status: 'failed',
      reason: responseBody?.message || responseBody?.error || `Resend returned HTTP ${response.status}`,
    };
  }

  return {
    status: 'sent',
    id: responseBody?.id || null,
    to: config.to,
  };
};

const main = async () => {
  const options = parseOptions();
  const audit = createAudit(options);
  const indexPayload = await readJson(indexPath);
  const indexRegions = Array.isArray(indexPayload?.regions) ? indexPayload.regions : [];
  const selectedRegions = indexRegions.filter(entry => matchesScope(entry, options));
  const seenBeachIds = new Map();
  const allBeaches = [];

  audit.stats.indexRegions = indexRegions.length;

  if (selectedRegions.length === 0) {
    audit.addIssue({
      severity: 'BLOCKER',
      issueType: 'empty_audit_scope',
      file: indexPath,
      currentValue: { region: options.region || null, island: options.island || null },
      evidenceNote: 'No region index entries matched the requested audit scope.',
    });
  }

  for (const entry of selectedRegions) {
    audit.stats.regionsChecked += 1;
    validateIndexEntry(audit, entry, indexPath);
    await validateRegionPayload(audit, entry, seenBeachIds, allBeaches);
  }

  addCoordinateOverlapIssues(audit, allBeaches);
  await addExternalCoverageIssues(audit, selectedRegions, allBeaches);
  addSchemaCoverageIssues(audit);
  sortIssues(audit.issues);

  const issueCountsBySeverity = getCountsBySeverity(audit.issues);
  const scopeLabel = options.region
    ? `region-${options.region}`
    : options.island
      ? `island-${options.island}`
      : 'all';

  const report = {
    generatedAt: new Date().toISOString(),
    mode: options.mode,
    scope: {
      label: scopeLabel,
      region: options.region || null,
      island: options.island || null,
    },
    outputDir: options.outputDir,
    dataset: {
      indexPath: toRelativePath(indexPath),
      source: indexPayload?.source || null,
      appSchemaVersion: indexPayload?.appSchemaVersion || null,
      totalBeachCountFromIndex: indexPayload?.totalBeachCount ?? null,
    },
    summary: {
      indexRegions: audit.stats.indexRegions,
      regionsChecked: audit.stats.regionsChecked,
      beachesChecked: audit.stats.beachesChecked,
      totalIssues: audit.issues.length,
      issueCountsBySeverity,
      acceptedSharedNamePairs: audit.acceptedSharedNamePairs.length,
    },
    reviewSummary: buildReviewSummary(audit.issues),
    coverage: {
      beachesWithMetadata: audit.stats.beachesWithMetadata,
      beachesWithOrientation: audit.stats.beachesWithOrientation,
      beachesWithWindProfile: audit.stats.beachesWithWindProfile,
      externalCoverageSource: audit.stats.externalCoverageSource,
      externalCoverageCandidates: audit.stats.externalCoverageCandidates,
      confidenceValues: audit.stats.confidenceValues,
      topMetadataAmenityValues: Object.entries(audit.stats.metadataAmenityValues)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50)
        .map(([value, count]) => ({ value, count })),
    },
    acceptedSharedNamePairs: audit.acceptedSharedNamePairs,
    issues: audit.issues,
  };

  let writtenReports = null;
  if (options.writeReports) {
    writtenReports = await writeReports(report);
  }
  const emailResult = await sendAuditEmail({ options, report, writtenReports });

  const counts = report.summary.issueCountsBySeverity;
  console.log('Beach Dataset Audit');
  console.log(`Mode: ${report.mode}`);
  console.log(`Scope: ${report.scope.label}`);
  console.log(`Index regions: ${report.summary.indexRegions}`);
  console.log(`Regions checked: ${report.summary.regionsChecked}`);
  console.log(`Beaches checked: ${report.summary.beachesChecked}`);
  console.log(`Issues: ${report.summary.totalIssues} (BLOCKER ${counts.BLOCKER || 0}, HIGH ${counts.HIGH || 0}, MEDIUM ${counts.MEDIUM || 0}, LOW ${counts.LOW || 0})`);
  if (report.summary.acceptedSharedNamePairs > 0) {
    console.log(`Accepted shared-name pairs: ${report.summary.acceptedSharedNamePairs}`);
  }
  console.log(`Gate status: ${report.reviewSummary.canUseAsGate ? 'pass for BLOCKER/HIGH issues' : 'blocked by BLOCKER/HIGH issues'}`);
  console.log(`Next action: ${report.reviewSummary.nextAction}`);
  if (report.coverage.externalCoverageSource) {
    console.log(`External coverage: ${report.coverage.externalCoverageCandidates} candidates from ${report.coverage.externalCoverageSource}`);
  }

  if (report.reviewSummary.issueCountsByType.length > 0) {
    console.log('Issue types:');
    for (const item of report.reviewSummary.issueCountsByType.slice(0, 8)) {
      console.log(`- ${item.issueType}: ${item.count}`);
    }
  }
  if (report.reviewSummary.externalReviewBuckets.length > 0) {
    console.log('External review buckets:');
    for (const item of report.reviewSummary.externalReviewBuckets.slice(0, 8)) {
      console.log(`- ${item.bucket}: ${item.count}`);
    }
  }

  if (writtenReports) {
    console.log('Reports:');
    console.log(`- ${toRelativePath(writtenReports.simpleReportPath)}`);
    console.log(`- ${toRelativePath(writtenReports.markdownPath)}`);
    console.log(`- ${toRelativePath(writtenReports.jsonPath)}`);
  }
  if (options.emailReports) {
    if (emailResult.status === 'sent') {
      console.log(`Email: sent to ${emailResult.to.join(', ')}${emailResult.id ? ` (id ${emailResult.id})` : ''}`);
    } else if (emailResult.status === 'dry-run') {
      console.log(`Email: dry run only to ${emailResult.to.join(', ')}`);
      console.log(`Email subject: ${emailResult.subject}`);
      console.log(`Email attachments: ${emailResult.attachments.join(', ')}`);
    } else {
      console.log(`Email: ${emailResult.status} - ${emailResult.reason}`);
    }
  }

  if (audit.issues.length > 0) {
    console.log('Top findings:');
    for (const issue of audit.issues.slice(0, 20)) {
      console.log(`- ${issue.severity} ${issue.issue_type}: ${issue.beach_name || issue.region || 'dataset'} - ${issue.human_summary || 'review needed'}`);
    }
  }

  const strictFailures = (counts.BLOCKER || 0) + (counts.HIGH || 0);
  if (options.strict && strictFailures > 0) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error('Beach dataset audit failed to run.');
  console.error(error);
  process.exitCode = 1;
});
