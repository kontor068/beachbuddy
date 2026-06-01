#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { getPexelsStatus, searchPexelsImages } from '../services/photoApiConnectors/pexelsConnector.mjs';
import { getPixabayStatus, localizePixabayCandidate, searchPixabayImages } from '../services/photoApiConnectors/pixabayConnector.mjs';
import { getUnsplashStatus, searchUnsplashImages } from '../services/photoApiConnectors/unsplashConnector.mjs';
import { getWikimediaEnterpriseStatus, lookupWikimediaEnterpriseImageHints } from '../services/photoApiConnectors/wikimediaEnterpriseConnector.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

const SUMMARY_JSON = path.join(ROOT_DIR, 'public', 'data', 'beaches', 'app', 'summary', 'south-aegean-milos.json');
const DETAIL_JSON = path.join(ROOT_DIR, 'public', 'data', 'beaches', 'app', 'detail', 'south-aegean-milos.json');
const OUTPUT_JSON = path.join(ROOT_DIR, 'public', 'data', 'beaches', 'photos', 'south-aegean-milos.json');
const COMPAT_OUTPUT_JSON = path.join(ROOT_DIR, 'src', 'data', 'beachImages.milos.json');
const OUTPUT_CSV = path.join(ROOT_DIR, 'reports', 'milos-photo-review.csv');
const API_RUN_JSON = path.join(ROOT_DIR, 'reports', 'milos-photo-api-run.json');
const MANUAL_REVIEW_CSV = path.join(ROOT_DIR, 'reports', 'milos-photo-manual-review.csv');
const MANUAL_OVERRIDE_JSON = path.join(ROOT_DIR, 'public', 'data', 'beaches', 'photos', 'manual-overrides.json');
const MANUAL_OVERRIDE_EXAMPLE_JSON = path.join(ROOT_DIR, 'public', 'data', 'beaches', 'photos', 'manual-overrides.example.json');
const CACHE_DIR = path.join(ROOT_DIR, '.cache', 'beach-images');
const PIXABAY_ASSET_DIR = path.join(ROOT_DIR, 'public', 'images', 'beaches', 'pixabay', 'milos');
const PIXABAY_PUBLIC_URL_PREFIX = '/images/beaches/pixabay/milos';

const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const OPENVERSE_API_URL = 'https://api.openverse.engineering/v1/images/';

const REFRESH_CACHE = process.argv.includes('--refresh-cache');
const REFRESH_VERIFIED = process.argv.includes('--refresh-verified');
const LIMIT_ARG = process.argv.find(arg => arg.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? Number(LIMIT_ARG.split('=')[1]) : undefined;
const STOCK_QUERY_LIMIT_ARG = process.argv.find(arg => arg.startsWith('--stock-query-limit='));
const STOCK_QUERY_LIMIT = Number(STOCK_QUERY_LIMIT_ARG?.split('=')[1] ?? process.env.PHOTO_STOCK_QUERY_LIMIT ?? 6);
const ENTERPRISE_QUERY_LIMIT_ARG = process.argv.find(arg => arg.startsWith('--enterprise-query-limit='));
const ENTERPRISE_QUERY_LIMIT = Number(ENTERPRISE_QUERY_LIMIT_ARG?.split('=')[1] ?? process.env.WIKIMEDIA_ENTERPRISE_QUERY_LIMIT ?? 3);

const DEFAULT_HEADERS = {
  'User-Agent': 'CalmBeachMilosPhotoDiscovery/1.0 (local development; Calm Beach Greece)',
};

const runStats = {
  apiRequestCounts: {},
  cacheHits: {},
  riskyMatchesExcluded: 0,
  errors: [],
  skippedRequests: 0,
};

const MILOS_ALIASES = ['milos', 'milo', 'melos', 'milos island', 'μήλος', 'μηλος'];
const BEACH_TERMS = [
  'beach',
  'paralia',
  'παραλια',
  'παραλία',
  'coast',
  'coastal',
  'sea',
  'aegean',
  'bay',
  'cove',
  'shore',
  'plage',
  'strand',
];
const IRRELEVANT_PLACE_TERMS = [
  'crete',
  'santorini',
  'mykonos',
  'paros',
  'naxos',
  'rhodes',
  'corfu',
  'lefkada',
  'zakynthos',
  'kefalonia',
  'athens',
  'attica',
  'samos',
  'chios',
  'lesvos',
  'ios',
  'serifos',
  'sifnos',
  'folegandros',
  'kimolos',
  'polyaigos',
  'poliegos',
  'κρητη',
  'σαντορινη',
  'μυκονος',
  'παρος',
  'ναξος',
  'ροδος',
  'κερκυρα',
  'κιμωλος',
];
const NON_BEACH_CONTEXT_TERMS = [
  'bridge',
  'hill',
  'cape',
  'road',
  'street',
  'village',
  'town',
  'port',
  'harbor',
  'harbour',
  'marina',
  'church',
  'chapel',
  'monastery',
  'museum',
  'settlement',
  'archaeological',
  'site',
  'mine',
  'mines',
  'quarry',
];
const PRIVATE_SUBJECT_TERMS = [
  'portrait',
  'selfie',
  'person',
  'people',
  'woman',
  'women',
  'man',
  'men',
  'girl',
  'boy',
  'model',
  'couple',
  'family',
  'wedding',
  'bikini',
  'swimsuit',
  'fashion',
];
const BRAND_LOGO_TERMS = [
  'logo',
  'brand',
  'branded',
  'advertisement',
  'billboard',
  'signage',
  'sponsored',
];
const STOP_WORDS = new Set([
  'beach',
  'paralia',
  'παραλια',
  'παραλία',
  'milos',
  'milo',
  'melos',
  'island',
  'greece',
  'greek',
  'aegean',
  'plage',
  'strand',
  'the',
  'and',
  'of',
  'at',
  'near',
  'view',
  'bay',
  'cove',
]);
const ALLOWED_MANUAL_OVERRIDE_SOURCES = new Set([
  'manual_permission',
  'own_photo',
  'wikimedia_commons',
  'openverse_source',
]);
const BEACH_SPECIFIC_ALIASES = new Map([
  ['1731', ['Achivadolimni', 'Hivadolimni', 'Chivadolimni', 'Αχιβαδολίμνη']],
  ['1729', ['Agia Kyriaki', 'Ayia Kyriaki', 'Αγία Κυριακή']],
  ['1726', ['Agios Dimitrios', 'Άγιος Δημήτριος']],
  ['1727', ['Agios Ioannis', 'Άγιος Ιωάννης']],
  ['1728', ['Agios Sostis', 'Άγιος Σώστης']],
  ['1730', ['Ammoudaraki', 'Ammoudaraki beach']],
  ['1754', ['Fatourena', 'Fatoyrena', 'Φατούρενα']],
  ['1755', ['Firiplaka', 'Paralia Firiplaka']],
  ['1756', ['Fyrlingkos', 'Fyrlingos', 'Fyrlinkos', 'Φυρλίνγκος']],
  ['1757', ['Firopotamos', 'Fyropotamos', 'Φυροπόταμος']],
  ['1732', ['Gerontas', 'Gerontas beach', 'Γέροντας']],
  ['1735', ['Kalamos', 'Κάλαμος']],
  ['1739', ['Kampanes', 'Καμπάνες']],
  ['1736', ['Kapros', 'Κάπρος']],
  ['1737', ['Katergo', 'Katergo beach', 'Κάτεργο']],
  ['1738', ['Kipoi', 'Kipos', 'Κήποι']],
  ['1740', ['Lagkada', 'Lagada', 'Langada', 'Λαγκάδα']],
  ['1741', ['Navtikos Omilos Milou', 'Nautikos Omilos Milou', 'Nautical Club Milos']],
  ['1742', ['Nerodafni', 'Νεροδάφνη']],
  ['1743', ['Paleochori', 'Paliochori', 'Palaiochori', 'Παλαιοχώρι']],
  ['1744', ['Papafragas', 'Papafragkas', 'Παπάφραγκας']],
  ['1745', ['Papikinou', 'Papikinoy', 'Παπικινού']],
  ['1746', ['Agkathia', 'Agathia', 'Aggathia', 'Αγκαθιά', 'Αγγαθια']],
  ['1747', ['Plathiena', 'Plathiena beach', 'Πλάθιενα']],
  ['1748', ['Provatas', 'Προβατάς']],
  ['1759', ['Psarovolada', 'Ψαροβολάδα']],
  ['1758', ['Psathi', 'Ψαθί']],
  ['1749', ['Rivari', 'Ριβάρι']],
  ['1750', ['Sarakiniko', 'Σαρακήνικο']],
  ['1734', ['Thiafes', 'Theiafes', 'Sulfur Mines Milos', 'Sulphur Mines Milos', 'Paliorema', 'Θειάφες']],
  ['1751', ['Tourkothalassa', 'Tourkothalasa', 'Τουρκοθάλασσα']],
  ['1752', ['Triades', 'Τριάδες']],
  ['1753', ['Tsigrado', 'Tsigkrado', 'Τσιγκράδο']],
]);
const PREFERRED_COMMONS_FILE_TITLES = new Map([
  ['1755', ['Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg']],
]);
const VERIFIED_PRESERVE_REJECT_PATTERNS = new Map([
  ['1741', [/papikinou/i, /papikinoy/i]],
]);

const GREEK_CHAR_MAP = new Map(Object.entries({
  α: 'a',
  β: 'v',
  γ: 'g',
  δ: 'd',
  ε: 'e',
  ζ: 'z',
  η: 'i',
  θ: 'th',
  ι: 'i',
  κ: 'k',
  λ: 'l',
  μ: 'm',
  ν: 'n',
  ξ: 'x',
  ο: 'o',
  π: 'p',
  ρ: 'r',
  σ: 's',
  ς: 's',
  τ: 't',
  υ: 'y',
  φ: 'f',
  χ: 'ch',
  ψ: 'ps',
  ω: 'o',
}));

const htmlEntities = new Map([
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
  ['lt', '<'],
  ['gt', '>'],
  ['nbsp', ' '],
]);

const ensureDir = async fileOrDir => {
  const dir = path.extname(fileOrDir) ? path.dirname(fileOrDir) : fileOrDir;
  await fs.mkdir(dir, { recursive: true });
};

const readJson = async filePath => JSON.parse(await fs.readFile(filePath, 'utf8'));

const loadEnvFile = async filePath => {
  let contents = '';
  try {
    contents = await fs.readFile(filePath, 'utf8');
  } catch {
    return;
  }

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.trim().replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
};

const loadLocalEnv = async () => {
  await loadEnvFile(path.join(ROOT_DIR, '.env'));
  await loadEnvFile(path.join(ROOT_DIR, '.env.local'));
};

const stripHtml = (value = '') => String(value)
  .replace(/<[^>]*>/g, ' ')
  .replace(/&([a-z]+);/gi, (_, entity) => htmlEntities.get(entity.toLowerCase()) || ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
  .replace(/\s+/g, ' ')
  .trim();

const normalizeLicenseUrl = (url = '') => {
  const text = String(url || '').trim();
  if (/^https:\/\/creativecommons\.org\/(?:licenses|publicdomain)\/[^/]+\/[\d.]+$/i.test(text)) {
    return `${text}/`;
  }
  return text;
};

const normalizeText = (value = '') => stripHtml(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .trim();

const compactText = (value = '') => normalizeText(value).replace(/\s+/g, '');

const titleCase = value => value
  .split(/\s+/)
  .filter(Boolean)
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const transliterateGreek = (value = '') => {
  let normalized = normalizeText(value)
    .replace(/αι/g, 'ai')
    .replace(/ει/g, 'ei')
    .replace(/οι/g, 'oi')
    .replace(/ου/g, 'ou')
    .replace(/μπ/g, 'b')
    .replace(/ντ/g, 'd')
    .replace(/γκ/g, 'g')
    .replace(/γγ/g, 'g')
    .replace(/τσ/g, 'ts')
    .replace(/τζ/g, 'tz');

  let output = '';
  for (const char of normalized) {
    output += GREEK_CHAR_MAP.get(char) ?? char;
  }

  output = output
    .replace(/\s+/g, ' ')
    .trim();

  return titleCase(output);
};

const unique = values => [...new Set(values.filter(Boolean))];

const meaningfulTokens = (value = '') => normalizeText(value)
  .split(/\s+/)
  .filter(token => token.length >= 3 && !STOP_WORDS.has(token));

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

const getBeachSpecificAliases = beach => unique([
  ...(BEACH_SPECIFIC_ALIASES.get(String(beach.beachId)) || []),
]);

const getPreferredCommonsFileTitles = beach => unique([
  ...(PREFERRED_COMMONS_FILE_TITLES.get(String(beach.beachId)) || []),
]);

const isPreferredCommonsFileTitle = (beach, fileTitle = '') => {
  const normalizedTitle = compactText(fileTitle);
  return getPreferredCommonsFileTitles(beach)
    .map(compactText)
    .some(title => title && title === normalizedTitle);
};

const safeReadJson = async filePath => {
  try {
    return await readJson(filePath);
  } catch (error) {
    throw new Error(`Could not read ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
  }
};

const optionalReadJson = async filePath => {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
};

const extractBeachList = payload => {
  if (Array.isArray(payload?.island?.beaches)) return payload.island.beaches;
  if (Array.isArray(payload?.beaches)) return payload.beaches;
  if (Array.isArray(payload)) return payload;
  return [];
};

const extractMilosBeaches = (summaryPayload, detailPayload) => {
  const summaryBeaches = extractBeachList(summaryPayload);
  const detailById = new Map(extractBeachList(detailPayload).map(beach => [String(beach.id), beach]));
  const seen = new Map();

  for (const beach of summaryBeaches) {
    const id = String(beach.id ?? '').trim();
    const detail = detailById.get(id);
    const island = beach.location?.island || summaryPayload?.island?.name || 'Milos';
    const normalizedIsland = normalizeText(island);

    if (!MILOS_ALIASES.some(alias => normalizedIsland === normalizeText(alias))) {
      continue;
    }

    const englishName = beach.name?.en || detail?.name?.en || transliterateGreek(beach.name?.gr || '');
    const greekName = beach.name?.gr || detail?.name?.gr || '';
    const lat = Number(beach.coordinates?.lat ?? detail?.coordinates?.lat);
    const lon = Number(beach.coordinates?.lon ?? detail?.coordinates?.lon);
    const dedupeKey = id || `${compactText(englishName || greekName)}|${Number.isFinite(lat) ? lat.toFixed(5) : 'na'}|${Number.isFinite(lon) ? lon.toFixed(5) : 'na'}`;

    if (!seen.has(dedupeKey)) {
      seen.set(dedupeKey, {
        beachId: id,
        beachName: englishName,
        beachNameEl: greekName,
        lat,
        lon,
        aliases: unique([
          englishName,
          greekName,
          transliterateGreek(greekName),
          ...(beach.aliases || []),
          ...(detail?.aliases || []),
        ]),
      });
    }
  }

  return [...seen.values()].sort((a, b) => a.beachName.localeCompare(b.beachName));
};

const buildQueries = beach => {
  const latinName = beach.beachName || transliterateGreek(beach.beachNameEl);
  const transliteratedGreekName = transliterateGreek(beach.beachNameEl);
  const bareLatinName = latinName.replace(/^paralia\s+/i, '').trim();
  const bareTransliteratedName = transliteratedGreekName.replace(/^paralia\s+/i, '').trim();
  const specificAliases = getBeachSpecificAliases(beach);
  return unique([
    beach.beachNameEl ? `${beach.beachNameEl} Milos` : '',
    `${latinName} Milos`,
    `${latinName} Milos Greece`,
    transliteratedGreekName !== latinName ? `${transliteratedGreekName} Milos` : '',
    transliteratedGreekName !== latinName ? `${transliteratedGreekName} Milos Greece` : '',
    ...specificAliases.map(alias => `${alias} Milos`),
    ...specificAliases.map(alias => `${alias} Milos Greece`),
    `${latinName} Milos beach`,
    transliteratedGreekName !== latinName ? `${transliteratedGreekName} Milos beach` : '',
    ...specificAliases.map(alias => `${alias} Milos beach`),
    `Paralia ${bareLatinName || latinName} Milos`,
    transliteratedGreekName !== latinName ? `Paralia ${bareTransliteratedName || transliteratedGreekName} Milos` : '',
    beach.beachNameEl ? `${beach.beachNameEl} Μήλος` : '',
  ]);
};

const buildManualReviewQueries = beach => {
  const latinName = beach.beachName || transliterateGreek(beach.beachNameEl);
  const transliteratedGreekName = transliterateGreek(beach.beachNameEl);
  const bareLatinName = latinName.replace(/^paralia\s+/i, '').trim();
  const specificAliases = getBeachSpecificAliases(beach);
  return unique([
    `Wikimedia Commons: ${latinName} Milos beach`,
    ...specificAliases.map(alias => `Wikimedia Commons: ${alias} Milos beach`),
    `Openverse: ${latinName} Milos beach`,
    ...specificAliases.map(alias => `Openverse: ${alias} Milos beach`),
    `Pixabay: ${latinName} Milos beach`,
    ...specificAliases.map(alias => `Pixabay: ${alias} Milos beach`),
    beach.beachNameEl ? `${beach.beachNameEl} Milos` : '',
    `${latinName} Milos`,
    transliteratedGreekName !== latinName ? `${transliteratedGreekName} Milos` : '',
    ...specificAliases.map(alias => `${alias} Milos`),
    `Paralia ${bareLatinName || latinName} Milos`,
  ]);
};

const cachePathFor = (source, url) => {
  const hash = crypto.createHash('sha256').update(`${source}:${url}`).digest('hex');
  return path.join(CACHE_DIR, source, `${hash}.json`);
};

const cachedJsonFetch = async (source, url, options = {}) => {
  const cachePath = cachePathFor(source, url);
  if (!REFRESH_CACHE) {
    try {
      const data = JSON.parse(await fs.readFile(cachePath, 'utf8'));
      runStats.cacheHits[source] = (runStats.cacheHits[source] || 0) + 1;
      return data;
    } catch {
      // Cache miss; fetch and persist the response below.
    }
  }

  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    runStats.apiRequestCounts[source] = (runStats.apiRequestCounts[source] || 0) + 1;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...(options.headers || {}),
      },
    });

    if (response.ok) {
      const data = await response.json();
      await ensureDir(cachePath);
      await fs.writeFile(cachePath, JSON.stringify(data, null, 2), 'utf8');
      await delay(source === 'wikimedia_commons' ? 450 : 200);
      return data;
    }

    lastError = new Error(`${source} request failed ${response.status}: ${url}`);
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 5) {
      throw lastError;
    }

    const retryAfter = Number(response.headers.get('retry-after'));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 1500 * attempt * attempt;
    console.warn(`${source} throttled (${response.status}); retrying in ${Math.round(waitMs / 1000)}s.`);
    await delay(waitMs);
  }

  throw lastError;
};

const commonsValue = (extmetadata, key) => stripHtml(extmetadata?.[key]?.value || '');

const isCompatibleCommonsLicense = (licenseName, licenseUrl, usageTerms) => {
  const rawText = String(`${licenseName} ${licenseUrl} ${usageTerms}`).toLowerCase();
  const text = normalizeText(`${licenseName} ${licenseUrl} ${usageTerms}`);

  // License safety gate: commercial app usage must reject NC/ND/editorial/unknown rights.
  if (!text || /noncommercial|non commercial|\bnc\b|no derivatives|\bnd\b|editorial|all rights reserved|copyrighted/.test(text)) {
    return null;
  }

  if (/public domain|pd old|pd user|pd self|publicdomain|cc pd mark/.test(text)) {
    return { license: 'Public Domain', requiresAttribution: false };
  }
  if (/\bcc0\b|creative commons zero/.test(text)) {
    return { license: 'CC0', requiresAttribution: false };
  }
  if (/cc by sa|cc by-sa|creative commons attribution share alike/.test(text)) {
    const version = rawText.match(/\b([1-4]\.0)\b/)?.[1] || '4.0';
    return { license: `CC BY-SA ${version}`, requiresAttribution: true };
  }
  if (/cc by|cc-by|creative commons attribution/.test(text)) {
    const version = rawText.match(/\b([1-4]\.0)\b/)?.[1] || '4.0';
    return { license: `CC BY ${version}`, requiresAttribution: true };
  }

  return null;
};

const normalizeOpenLicense = (licenseName, licenseUrl, licenseVersion = '') => {
  const rawText = String(`${licenseName} ${licenseUrl} ${licenseVersion}`).toLowerCase();
  const text = normalizeText(`${licenseName} ${licenseUrl} ${licenseVersion}`);

  if (!text || /noncommercial|non commercial|\bnc\b|no derivatives|\bnd\b|editorial|all rights reserved|copyrighted/.test(text)) {
    return null;
  }

  const version = rawText.match(/\b([1-4]\.0)\b/)?.[1] || String(licenseVersion || '').match(/\b([1-4]\.0)\b/)?.[1] || '4.0';

  if (/\bcc0\b|creative commons zero/.test(text)) {
    return { license: 'CC0', requiresAttribution: false };
  }
  if (/public domain|publicdomain|\bpdm\b|pd mark/.test(text)) {
    return { license: 'Public Domain', requiresAttribution: false };
  }
  if (/by sa|by-sa|cc by sa|cc-by-sa|creative commons attribution share alike/.test(text)) {
    return { license: `CC BY-SA ${version}`, requiresAttribution: true };
  }
  if (/\bby\b|cc by|cc-by|creative commons attribution/.test(text)) {
    return { license: `CC BY ${version}`, requiresAttribution: true };
  }

  return null;
};

const filePageUrl = title =>
  `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/g, ':')}`;

const normalizeCommonsPage = (page, searchQueryUsed) => {
  const imageInfo = page.imageinfo?.[0] || {};
  const extmetadata = imageInfo.extmetadata || {};
  const fileTitle = page.title || '';
  const licenseName = commonsValue(extmetadata, 'LicenseShortName') || commonsValue(extmetadata, 'UsageTerms');
  const licenseUrl = normalizeLicenseUrl(commonsValue(extmetadata, 'LicenseUrl'));
  const license = isCompatibleCommonsLicense(licenseName, licenseUrl, commonsValue(extmetadata, 'UsageTerms'));

  if (!license || !imageInfo.url || !String(imageInfo.mime || '').startsWith('image/')) {
    return null;
  }

  const cleanTitle = fileTitle.replace(/^File:/, '');
  const author = commonsValue(extmetadata, 'Artist') || commonsValue(extmetadata, 'Credit') || 'Unknown author';
  const description = commonsValue(extmetadata, 'ImageDescription');
  const objectName = commonsValue(extmetadata, 'ObjectName');
  const categories = commonsValue(extmetadata, 'Categories');
  const sourcePageUrl = imageInfo.descriptionurl || filePageUrl(fileTitle);
  const attributionTitle = objectName || cleanTitle;
  const attributionText = license.requiresAttribution
    ? `${author}, "${attributionTitle}", ${license.license}, via Wikimedia Commons`
    : `${attributionTitle}, ${license.license}, via Wikimedia Commons`;

  return {
    source: 'wikimedia_commons',
    fileTitle: cleanTitle,
    imageUrl: imageInfo.url,
    thumbnailUrl: imageInfo.thumburl || imageInfo.url,
    sourcePageUrl,
    license: license.license,
    licenseUrl: licenseUrl || sourcePageUrl,
    author,
    attributionText,
    requiresAttribution: license.requiresAttribution,
    width: Number(imageInfo.width) || 0,
    height: Number(imageInfo.height) || 0,
    candidateText: `${cleanTitle} ${objectName} ${description} ${categories}`,
    searchQueryUsed,
  };
};

const searchWikimediaCommons = async query => {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    generator: 'search',
    gsrnamespace: '6',
    gsrlimit: '12',
    gsrsearch: query,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '800',
  });
  const data = await cachedJsonFetch('wikimedia_commons', `${COMMONS_API_URL}?${params.toString()}`);
  return Object.values(data.query?.pages || {})
    .map(page => normalizeCommonsPage(page, query))
    .filter(Boolean);
};

const filenameFromWikimediaUploadUrl = url => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'upload.wikimedia.org') return '';
    const parts = parsed.pathname.split('/').filter(Boolean);
    const thumbIndex = parts.indexOf('thumb');
    const filename = thumbIndex >= 0
      ? parts[thumbIndex + 3]
      : parts.at(-1);
    return decodeURIComponent(filename || '').replace(/_/g, ' ');
  } catch {
    return '';
  }
};

const getWikimediaCommonsFile = async (fileTitle, searchQueryUsed, extraCandidateText = '') => {
  const cleanTitle = String(fileTitle || '').replace(/^File:/i, '').trim();
  if (!cleanTitle) return [];

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    origin: '*',
    titles: `File:${cleanTitle}`,
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: '800',
  });
  const data = await cachedJsonFetch('wikimedia_commons', `${COMMONS_API_URL}?${params.toString()}`);
  return Object.values(data.query?.pages || {})
    .map(page => normalizeCommonsPage(page, searchQueryUsed))
    .filter(Boolean)
    .map(candidate => ({
      ...candidate,
      candidateText: `${candidate.candidateText || ''} ${extraCandidateText}`.trim(),
      searchQueryUsed,
    }));
};

const searchWikimediaEnterpriseViaCommons = async query => {
  const hints = await lookupWikimediaEnterpriseImageHints(query, {
    cacheDir: CACHE_DIR,
    refreshCache: REFRESH_CACHE,
    stats: runStats,
  });
  const candidates = [];

  for (const hint of hints) {
    const fileTitle = filenameFromWikimediaUploadUrl(hint.contentUrl);
    if (!fileTitle) {
      runStats.riskyMatchesExcluded += 1;
      continue;
    }
    const extraText = [
      hint.articleName,
      hint.articleUrl,
      hint.caption,
      hint.alternativeText,
      hint.projectIdentifier,
      hint.projectName,
    ].filter(Boolean).join(' ');
    const commonsCandidates = await getWikimediaCommonsFile(fileTitle, `Wikimedia Enterprise: ${query}`, extraText);
    candidates.push(...commonsCandidates);
  }

  return candidates;
};

const normalizeOpenverseResult = (raw, searchQueryUsed) => {
  const license = normalizeOpenLicense(raw.license, raw.license_url, raw.license_version);
  const imageUrl = raw.url || '';
  const thumbnailUrl = raw.thumbnail || imageUrl;
  const sourcePageUrl = raw.foreign_landing_url || '';
  const author = stripHtml(raw.creator || '');

  // Openverse indexes many providers. Keep only records where the landing page,
  // author, and license metadata are explicit enough for commercial app review.
  if (!license || !imageUrl || !sourcePageUrl || !author) {
    return null;
  }

  const title = stripHtml(raw.title || '');
  const sourceName = stripHtml(raw.source || raw.provider || 'Openverse indexed source');
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map(tag => (typeof tag === 'string' ? tag : tag?.name)).filter(Boolean).join(' ')
    : '';
  const attributionTitle = title || raw.id || 'Openverse image';
  const attributionText = license.requiresAttribution
    ? `${author}, "${attributionTitle}", ${license.license}, via ${sourceName}`
    : `${attributionTitle}, ${license.license}, via ${sourceName}`;

  return {
    source: 'openverse_source',
    fileTitle: attributionTitle,
    imageUrl,
    thumbnailUrl,
    sourcePageUrl,
    license: license.license,
    licenseUrl: normalizeLicenseUrl(raw.license_url) || sourcePageUrl,
    author,
    attributionText,
    requiresAttribution: license.requiresAttribution,
    width: Number(raw.width) || 0,
    height: Number(raw.height) || 0,
    candidateText: `${title} ${raw.description || ''} ${tags} ${sourceName} ${sourcePageUrl}`,
    searchQueryUsed,
  };
};

const searchOpenverse = async query => {
  const params = new URLSearchParams({
    q: query,
    license: 'cc0,by,by-sa,pdm',
    extension: 'jpg,jpeg,png',
    mature: 'false',
    page_size: '12',
  });
  const data = await cachedJsonFetch('openverse_source', `${OPENVERSE_API_URL}?${params.toString()}`);
  return (data.results || [])
    .map(item => normalizeOpenverseResult(item, query))
    .filter(Boolean);
};

const stockProviderStatuses = () => [
  getWikimediaEnterpriseStatus(),
  getPexelsStatus(),
  getPixabayStatus(),
  getUnsplashStatus(),
];

const sourceKeyStatus = () => ({
  wikimedia_commons: true,
  wikimedia_enterprise: getWikimediaEnterpriseStatus().configured,
  pexels: getPexelsStatus().configured,
  pixabay: getPixabayStatus().configured,
  unsplash: getUnsplashStatus().configured,
});

const buildSpellingVariants = value => {
  const text = String(value || '').trim();
  return unique([
    text,
    text.replace(/ngk/gi, 'nk'),
    text.replace(/gk/gi, 'k'),
  ]);
};

const buildNameVariants = beach => unique([
  beach.beachName,
  beach.beachNameEl,
  transliterateGreek(beach.beachNameEl),
  ...getBeachSpecificAliases(beach),
  ...beach.aliases,
])
  .flatMap(buildSpellingVariants)
  .map(value => String(value).trim())
  .filter(value => value && !STOP_WORDS.has(normalizeText(value)));

const sourcePriority = source => ({
  wikimedia_commons: 60,
  pexels: 50,
  pixabay: 40,
  unsplash: 30,
  openverse_source: 20,
  manual_permission: 10,
  own_photo: 10,
}[source] || 0);

const STOCK_PHOTO_SOURCES = new Set(['pexels', 'pixabay', 'unsplash']);

const scoreCandidate = (candidate, beach) => {
  const titleText = normalizeText(candidate.fileTitle);
  const text = normalizeText(`${candidate.fileTitle} ${candidate.candidateText} ${candidate.sourcePageUrl}`);
  const compact = compactText(text);
  const variants = buildNameVariants(beach);
  const variantCompacts = variants.map(compactText).filter(value => value.length >= 4);
  const hasExactName = variantCompacts.some(value => compact.includes(value));
  const tokens = unique(variants.flatMap(meaningfulTokens));
  const tokenMatches = tokens.filter(token => text.includes(token) || compact.includes(token)).length;
  const hasMilos = MILOS_ALIASES.some(alias => text.includes(normalizeText(alias)) || compact.includes(compactText(alias)));
  const hasBeachTerm = BEACH_TERMS.some(term => text.includes(normalizeText(term)));
  const titleHasBeachTerm = BEACH_TERMS.some(term => titleText.includes(normalizeText(term)));
  const specificAliasCompacts = getBeachSpecificAliases(beach).map(compactText).filter(value => value.length >= 4);
  const hasSpecificAlias = specificAliasCompacts.some(value => compact.includes(value));
  const isPreferredCommonsFile = candidate.source === 'wikimedia_commons' && isPreferredCommonsFileTitle(beach, candidate.fileTitle);
  const hasNonBeachContext = NON_BEACH_CONTEXT_TERMS.some(term => text.includes(normalizeText(term)));
  const titleHasNonBeachContext = NON_BEACH_CONTEXT_TERMS.some(term => titleText.includes(normalizeText(term)));
  const hasWrongIsland = IRRELEVANT_PLACE_TERMS.some(term => text.includes(normalizeText(term)));
  const hasPrivateSubjectRisk = PRIVATE_SUBJECT_TERMS.some(term => text.includes(normalizeText(term)));
  const hasBrandLogoRisk = BRAND_LOGO_TERMS.some(term => text.includes(normalizeText(term)));
  const width = Number(candidate.width) || 0;
  const height = Number(candidate.height) || 0;

  let score = 0;
  let sortPriority = sourcePriority(candidate.source);
  const reasons = [];

  if (hasExactName) {
    score += 0.42;
    reasons.push('exact beach name match');
  } else if (tokens.length && tokenMatches === tokens.length) {
    score += 0.28;
    reasons.push('all meaningful name tokens matched');
  } else if (tokenMatches > 0) {
    score += Math.min(0.16, tokenMatches * 0.07);
    reasons.push(`${tokenMatches}/${tokens.length} meaningful name tokens matched`);
  }

  if (hasMilos) {
    score += 0.24;
    reasons.push('Milos match');
  }

  if (hasBeachTerm) {
    score += 0.08;
    reasons.push('beach/coast/sea term present');
  }

  score += 0.13;
  reasons.push('license accepted for commercial app use');

  if (width >= 1200 && height >= 700) {
    score += 0.06;
    reasons.push('good image dimensions');
  } else if (width >= 800 && height >= 500) {
    score += 0.03;
    reasons.push('usable image dimensions');
  }

  if (candidate.source === 'wikimedia_commons') {
    score += 0.03;
    reasons.push('preferred source: Wikimedia Commons');
  } else if (candidate.source === 'openverse_source') {
    score += 0.01;
    reasons.push('free Creative Commons source: Openverse');
  }

  if (hasSpecificAlias) {
    sortPriority += 20;
    reasons.push('specific beach alias match');
  }

  if (isPreferredCommonsFile) {
    sortPriority += 100;
    reasons.push('preferred verified Commons file match');
  }

  if (hasWrongIsland) {
    score -= 0.35;
    reasons.push('penalty: another island/place mentioned');
    runStats.riskyMatchesExcluded += 1;
  }

  if (hasPrivateSubjectRisk) {
    score = Math.min(score, 0.39);
    reasons.push('capped: metadata suggests private people may be the main subject');
    runStats.riskyMatchesExcluded += 1;
  }

  if (hasBrandLogoRisk) {
    score = Math.min(score, 0.39);
    reasons.push('capped: metadata suggests logo/brand risk');
    runStats.riskyMatchesExcluded += 1;
  }

  if (titleHasNonBeachContext && !titleHasBeachTerm) {
    score = Math.min(score, 0.69);
    reasons.push('capped: file title describes non-beach context');
    runStats.riskyMatchesExcluded += 1;
  }

  if (!hasExactName && !hasBeachTerm) {
    score = Math.min(score, 0.39);
    reasons.push('capped: no exact beach name and no beach/coast/sea term');
  } else if (hasNonBeachContext && !hasBeachTerm) {
    score = Math.min(score - 0.2, 0.39);
    reasons.push('capped: non-beach context without beach/coast/sea term');
  } else if (!hasBeachTerm) {
    score = Math.min(score, 0.69);
    reasons.push('capped: no beach/coast/sea term');
  }

  if (!hasExactName && !hasMilos) {
    score = Math.min(score, 0.39);
    reasons.push('capped: no exact beach name and no Milos match');
  } else if (!hasExactName) {
    score = Math.min(score, 0.69);
    reasons.push('capped: no exact beach name match');
  } else if (!hasMilos) {
    score = Math.min(score, 0.39);
    reasons.push('capped: exact name but no Milos match');
    runStats.riskyMatchesExcluded += 1;
  }

  if (STOCK_PHOTO_SOURCES.has(candidate.source) && !hasExactName && !titleHasBeachTerm) {
    score = Math.min(score, 0.39);
    reasons.push('capped: stock photo lacks exact beach name and beach title context');
    runStats.riskyMatchesExcluded += 1;
  }

  return {
    ...candidate,
    confidence: Math.max(0, Math.min(1, Number(score.toFixed(2)))),
    matchReason: reasons.join('; '),
    _sortPriority: sortPriority,
    _debug: { hasExactName, hasMilos, hasBeachTerm, hasSpecificAlias, isPreferredCommonsFile, hasNonBeachContext, hasWrongIsland, tokenMatches },
  };
};

const chooseStatus = confidence => {
  if (confidence >= 0.9) return { imageStatus: 'verified', needsHumanReview: false };
  if (confidence >= 0.4) return { imageStatus: 'candidate', needsHumanReview: true };
  return { imageStatus: 'missing', needsHumanReview: true };
};

const pickBestCandidate = candidates => candidates.reduce((best, candidate) => {
  if (!best) return candidate;
  if (candidate.confidence !== best.confidence) {
    return candidate.confidence > best.confidence ? candidate : best;
  }
  return (candidate._sortPriority || 0) > (best._sortPriority || 0) ? candidate : best;
}, undefined);

const emptyEntry = (beach, searchQueryUsed, matchReason = 'No compatible beach-specific image candidate reached confidence threshold.') => ({
  beachId: beach.beachId,
  beachName: beach.beachName,
  beachNameEl: beach.beachNameEl,
  island: 'Milos',
  imageStatus: 'missing',
  imageUrl: '',
  thumbnailUrl: '',
  source: 'local_placeholder',
  sourcePageUrl: '',
  license: 'unknown',
  licenseUrl: '',
  author: '',
  attributionText: '',
  requiresAttribution: false,
  confidence: 0,
  matchReason,
  searchQueryUsed,
  needsHumanReview: true,
  fileTitle: '',
  imageWidth: 0,
  imageHeight: 0,
});

const toOutputEntry = (beach, candidate) => {
  if (
    !candidate ||
    candidate.confidence < 0.4 ||
    !candidate.imageUrl ||
    !candidate.thumbnailUrl ||
    !candidate.sourcePageUrl ||
    !candidate.author
  ) {
    return emptyEntry(beach, candidate?.searchQueryUsed || buildQueries(beach)[0], candidate?.matchReason);
  }

  const status = chooseStatus(candidate.confidence);
  return {
    beachId: beach.beachId,
    beachName: beach.beachName,
    beachNameEl: beach.beachNameEl,
    island: 'Milos',
    imageStatus: status.imageStatus,
    imageUrl: candidate.imageUrl,
    thumbnailUrl: candidate.thumbnailUrl,
    source: candidate.source,
    sourcePageUrl: candidate.sourcePageUrl,
    license: candidate.license,
    licenseUrl: candidate.licenseUrl,
    author: candidate.author,
    attributionText: candidate.attributionText,
    requiresAttribution: candidate.requiresAttribution,
    confidence: candidate.confidence,
    matchReason: candidate.matchReason,
    searchQueryUsed: candidate.searchQueryUsed,
    needsHumanReview: status.needsHumanReview,
    fileTitle: candidate.fileTitle,
    imageWidth: candidate.width,
    imageHeight: candidate.height,
    providerImageId: candidate.providerImageId || '',
    altText: candidate.altText || candidate.fileTitle || '',
    photographer: candidate.photographer || candidate.author || '',
    photographerUrl: candidate.photographerUrl || '',
  };
};

const prepareCandidateForOutput = async (beach, candidate) => {
  if (candidate?.source !== 'pixabay') return candidate;
  return localizePixabayCandidate(candidate, {
    assetDir: PIXABAY_ASSET_DIR,
    publicUrlPrefix: PIXABAY_PUBLIC_URL_PREFIX,
    beachId: beach.beachId,
    beachName: beach.beachName,
    stats: runStats,
  });
};

const discoverBeachImage = async beach => {
  const queries = buildQueries(beach);
  const candidates = [];

  for (const query of queries) {
    try {
      const commonsResults = await searchWikimediaCommons(query);
      candidates.push(...commonsResults.map(candidate => scoreCandidate(candidate, beach)));
      const bestSoFar = pickBestCandidate(candidates);
      if (bestSoFar?.confidence >= 0.9) break;
    } catch (error) {
      console.warn(`Wikimedia search failed for "${query}": ${error.message}`);
    }
  }

  let best = pickBestCandidate(candidates);

  if (!best || best.confidence < 0.9) {
    const enterpriseQueries = Number.isFinite(ENTERPRISE_QUERY_LIMIT) && ENTERPRISE_QUERY_LIMIT > 0
      ? queries.slice(0, ENTERPRISE_QUERY_LIMIT)
      : queries;
    for (const query of enterpriseQueries) {
      try {
        const enterpriseResults = await searchWikimediaEnterpriseViaCommons(query);
        candidates.push(...enterpriseResults.map(candidate => scoreCandidate(candidate, beach)));
        best = pickBestCandidate(candidates);
        if (best?.confidence >= 0.9) break;
      } catch (error) {
        console.warn(`Wikimedia Enterprise search failed for "${query}": ${error.message}`);
      }
    }
    best = pickBestCandidate(candidates);
  }

  if (!best || best.confidence < 0.9) {
    const stockQueries = Number.isFinite(STOCK_QUERY_LIMIT) && STOCK_QUERY_LIMIT > 0
      ? queries.slice(0, STOCK_QUERY_LIMIT)
      : queries;
    for (const query of stockQueries) {
      const externalResults = [
        ...(await searchPexelsImages(query, { cacheDir: CACHE_DIR, refreshCache: REFRESH_CACHE, stats: runStats })),
        ...(await searchPixabayImages(query, { cacheDir: CACHE_DIR, refreshCache: REFRESH_CACHE, stats: runStats })),
        ...(await searchUnsplashImages(query, { cacheDir: CACHE_DIR, refreshCache: REFRESH_CACHE, stats: runStats })),
      ];
      candidates.push(...externalResults.map(candidate => scoreCandidate(candidate, beach)));
      best = pickBestCandidate(candidates);
      if (best?.confidence >= 0.9) break;
    }
    best = pickBestCandidate(candidates);
  }

  const preparedBest = await prepareCandidateForOutput(beach, best);
  return toOutputEntry(beach, preparedBest);
};

const csvEscape = value => {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const writeReviewCsv = async (entries, previousById = new Map()) => {
  const headers = [
    'beachId',
    'beachName',
    'previousStatus',
    'newStatus',
    'confidence',
    'source',
    'license',
    'author',
    'sourcePageUrl',
    'imageUrl',
    'thumbnailUrl',
    'matchReason',
    'searchQueryUsed',
    'needsHumanReview',
  ];
  const rows = [
    headers.join(','),
    ...entries.map(entry => {
      const previous = previousById.get(String(entry.beachId));
      return [
        entry.beachId,
        entry.beachName,
        previous?.imageStatus || 'missing',
        entry.imageStatus,
        entry.confidence,
        entry.source,
        entry.license,
        entry.author,
        entry.sourcePageUrl,
        entry.imageUrl,
        entry.thumbnailUrl,
        entry.matchReason,
        entry.searchQueryUsed,
        entry.needsHumanReview,
      ].map(csvEscape).join(',');
    }),
  ];
  await ensureDir(OUTPUT_CSV);
  await fs.writeFile(OUTPUT_CSV, `${rows.join('\n')}\n`, 'utf8');
};

const writeManualReviewCsv = async (entries, beaches) => {
  const beachById = new Map(beaches.map(beach => [String(beach.beachId), beach]));
  const headers = [
    'beachId',
    'beachName',
    'missingReason',
    'suggestedSearchQueries',
    'notes',
  ];
  const missingEntries = entries.filter(entry => entry.imageStatus === 'missing');
  const rows = [
    headers.join(','),
    ...missingEntries.map(entry => {
      const beach = beachById.get(String(entry.beachId)) || entry;
      return [
        entry.beachId,
        entry.beachName,
        entry.matchReason || 'No verified free/legal image found.',
        buildManualReviewQueries(beach).join(' | '),
        'Use a manual override only when image URL, thumbnail URL, source page, author, license URL, and commercial-use permission are all clear.',
      ].map(csvEscape).join(',');
    }),
  ];
  await ensureDir(MANUAL_REVIEW_CSV);
  await fs.writeFile(MANUAL_REVIEW_CSV, `${rows.join('\n')}\n`, 'utf8');
};

const writeManualOverrideExample = async () => {
  const example = [
    {
      beachId: '',
      beachName: '',
      imageUrl: '',
      thumbnailUrl: '',
      sourcePageUrl: '',
      source: 'manual_permission',
      license: '',
      licenseUrl: '',
      author: '',
      attributionText: '',
      requiresAttribution: true,
      permissionNotes: '',
      imageStatus: 'verified',
    },
  ];
  await ensureDir(MANUAL_OVERRIDE_EXAMPLE_JSON);
  await fs.writeFile(MANUAL_OVERRIDE_EXAMPLE_JSON, `${JSON.stringify(example, null, 2)}\n`, 'utf8');
};

const printSourceStatus = () => {
  console.log('Using Wikimedia Commons: public API; no key required.');
  for (const provider of stockProviderStatuses()) {
    if (provider.configured) {
      console.log(`Using ${provider.source}: ${provider.envVar} is set.`);
    } else {
      console.log(`Skipping ${provider.source}: ${provider.envVar} is not set.`);
    }
  }
};

const summarize = entries => {
  const counts = entries.reduce((acc, entry) => {
    acc[entry.imageStatus] = (acc[entry.imageStatus] || 0) + 1;
    return acc;
  }, {});
  const sources = entries.reduce((acc, entry) => {
    acc[entry.source] = (acc[entry.source] || 0) + 1;
    return acc;
  }, {});
  const licenses = entries.reduce((acc, entry) => {
    acc[entry.license] = (acc[entry.license] || 0) + 1;
    return acc;
  }, {});
  return { counts, sources, licenses };
};

const countStatuses = entries => entries.reduce((acc, entry) => {
  const status = entry?.imageStatus || 'missing';
  acc[status] = (acc[status] || 0) + 1;
  return acc;
}, {});

const previousEntriesForBeaches = (beaches, existingById) => beaches.map(beach =>
  existingById.get(String(beach.beachId)) || emptyEntry(beach, '', 'No previous photo metadata entry.')
);

const writeApiRunJson = async (payload) => {
  await ensureDir(API_RUN_JSON);
  await fs.writeFile(API_RUN_JSON, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const loadExistingPhotoEntries = async () => {
  const existing = await optionalReadJson(OUTPUT_JSON);
  if (!Array.isArray(existing)) return new Map();
  return new Map(existing.map(entry => [String(entry.beachId), entry]));
};

const isPreservableVerified = entry =>
  entry?.imageStatus === 'verified' &&
  Boolean(entry.imageUrl) &&
  Boolean(entry.thumbnailUrl) &&
  Boolean(entry.sourcePageUrl) &&
  Boolean(entry.author) &&
  Boolean(entry.license) &&
  entry.license !== 'unknown';

const hasPreserveRejectPattern = (beach, entry) => {
  const patterns = VERIFIED_PRESERVE_REJECT_PATTERNS.get(String(beach.beachId));
  if (!patterns?.length) return false;
  const text = [
    entry.fileTitle,
    entry.sourcePageUrl,
    entry.imageUrl,
    entry.thumbnailUrl,
    entry.searchQueryUsed,
    entry.matchReason,
  ].filter(Boolean).join(' ');
  return patterns.some(pattern => pattern.test(text));
};

const canPreserveVerifiedEntry = (beach, entry) => {
  if (!isPreservableVerified(entry)) return false;
  if (hasPreserveRejectPattern(beach, entry)) return false;
  const preferredTitles = getPreferredCommonsFileTitles(beach);
  if (!preferredTitles.length) return true;
  return isPreferredCommonsFileTitle(beach, entry.fileTitle) && entry.licenseUrl === normalizeLicenseUrl(entry.licenseUrl);
};

const isPreservableCandidateEntry = entry =>
  entry?.imageStatus === 'candidate' &&
  Boolean(entry.imageUrl) &&
  Boolean(entry.thumbnailUrl) &&
  Boolean(entry.sourcePageUrl) &&
  Boolean(entry.author) &&
  Boolean(entry.license) &&
  entry.license !== 'unknown' &&
  Number(entry.confidence || 0) >= 0.4 &&
  normalizeText(entry.matchReason).includes('milos match') &&
  !normalizeText(entry.matchReason).includes('no milos match') &&
  !normalizeText(entry.matchReason).includes('another island') &&
  !normalizeText(entry.matchReason).includes('private people') &&
  !normalizeText(entry.matchReason).includes('logo/brand') &&
  !normalizeText(entry.matchReason).includes('stock photo lacks');

const loadManualOverrides = async () => {
  const overrides = await optionalReadJson(MANUAL_OVERRIDE_JSON);
  if (!Array.isArray(overrides)) return new Map();
  return new Map(overrides.map(entry => [String(entry.beachId), entry]));
};

const hasCompleteManualOverride = entry => {
  if (!entry || entry.imageStatus !== 'verified') return false;
  if (!ALLOWED_MANUAL_OVERRIDE_SOURCES.has(entry.source)) return false;

  const requiredFields = [
    'beachId',
    'beachName',
    'imageUrl',
    'thumbnailUrl',
    'sourcePageUrl',
    'license',
    'licenseUrl',
    'author',
    'attributionText',
  ];
  if (!requiredFields.every(field => Boolean(String(entry[field] || '').trim()))) {
    return false;
  }

  if (entry.source === 'manual_permission' || entry.source === 'own_photo') {
    return Boolean(String(entry.permissionNotes || '').trim());
  }

  return Boolean(normalizeOpenLicense(entry.license, entry.licenseUrl));
};

const manualOverrideToOutputEntry = (beach, override) => ({
  beachId: beach.beachId,
  beachName: beach.beachName,
  beachNameEl: beach.beachNameEl,
  island: 'Milos',
  imageStatus: 'verified',
  imageUrl: override.imageUrl,
  thumbnailUrl: override.thumbnailUrl,
  source: override.source,
  sourcePageUrl: override.sourcePageUrl,
  license: override.license,
  licenseUrl: override.licenseUrl,
  author: override.author,
  attributionText: override.attributionText,
  requiresAttribution: Boolean(override.requiresAttribution),
  confidence: 1,
  matchReason: `Manual override with complete license/permission metadata.${override.permissionNotes ? ` ${override.permissionNotes}` : ''}`,
  searchQueryUsed: path.relative(ROOT_DIR, MANUAL_OVERRIDE_JSON),
  needsHumanReview: false,
  fileTitle: '',
  imageWidth: 0,
  imageHeight: 0,
});

const main = async () => {
  await loadLocalEnv();
  await ensureDir(CACHE_DIR);
  const summaryPayload = await safeReadJson(SUMMARY_JSON);
  const detailPayload = await safeReadJson(DETAIL_JSON);
  const allBeaches = extractMilosBeaches(summaryPayload, detailPayload);
  const beaches = Number.isFinite(LIMIT) && LIMIT > 0 ? allBeaches.slice(0, LIMIT) : allBeaches;
  const existingById = await loadExistingPhotoEntries();
  const manualOverridesById = await loadManualOverrides();
  const previousEntries = previousEntriesForBeaches(allBeaches, existingById);
  const previousCounts = countStatuses(previousEntries);
  const configuredProviders = stockProviderStatuses().filter(provider => provider.configured).map(provider => provider.source);
  const skippedProviders = stockProviderStatuses().filter(provider => !provider.configured).map(provider => ({
    source: provider.source,
    reason: `${provider.envVar} is not set`,
  }));

  console.log(`Summary JSON: ${path.relative(ROOT_DIR, SUMMARY_JSON)}`);
  console.log(`Detail JSON: ${path.relative(ROOT_DIR, DETAIL_JSON)}`);
  console.log(`Milos beaches after dedupe: ${allBeaches.length}`);
  if (beaches.length !== allBeaches.length) console.log(`Limited run: ${beaches.length}`);
  printSourceStatus();

  const entries = [];
  for (const [index, beach] of beaches.entries()) {
    process.stdout.write(`[${index + 1}/${beaches.length}] ${beach.beachName} / ${beach.beachNameEl}... `);
    const existingEntry = existingById.get(String(beach.beachId));
    if (!REFRESH_VERIFIED && canPreserveVerifiedEntry(beach, existingEntry)) {
      entries.push(existingEntry);
      console.log(`preserved verified (${existingEntry.confidence}) ${existingEntry.source}`);
      continue;
    }

    const manualOverride = manualOverridesById.get(String(beach.beachId));
    if (manualOverride) {
      if (hasCompleteManualOverride(manualOverride)) {
        const entry = manualOverrideToOutputEntry(beach, manualOverride);
        entries.push(entry);
        console.log(`manual override verified (${entry.confidence}) ${entry.source}`);
        continue;
      }
      console.warn(`manual override ignored for ${beach.beachName}: missing required metadata or clear permission.`);
    }

    try {
      let entry = await discoverBeachImage(beach);
      if (
        isPreservableCandidateEntry(existingEntry) &&
        entry.imageStatus !== 'verified' &&
        Number(existingEntry.confidence || 0) >= Number(entry.confidence || 0)
      ) {
        entry = existingEntry;
      }
      entries.push(entry);
      console.log(`${entry.imageStatus} (${entry.confidence}) ${entry.source}`);
    } catch (error) {
      entries.push(emptyEntry(beach, buildQueries(beach)[0], `Search failed: ${error.message}`));
      console.log(`missing (search failed: ${error.message})`);
    }
  }

  await ensureDir(OUTPUT_JSON);
  await ensureDir(COMPAT_OUTPUT_JSON);
  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  await fs.writeFile(COMPAT_OUTPUT_JSON, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  await writeReviewCsv(entries, existingById);
  await writeManualReviewCsv(entries, beaches);
  await writeManualOverrideExample();

  const { counts, sources, licenses } = summarize(entries);
  const newVerifiedImages = entries.filter(entry => {
    const previous = existingById.get(String(entry.beachId));
    return entry.imageStatus === 'verified' && previous?.imageStatus !== 'verified';
  }).map(entry => ({
    beachId: entry.beachId,
    beachName: entry.beachName,
    source: entry.source,
    license: entry.license,
    author: entry.author,
    sourcePageUrl: entry.sourcePageUrl,
  }));
  const apiRun = {
    timestamp: new Date().toISOString(),
    apisConfigured: configuredProviders,
    apisSkipped: skippedProviders,
    totalBeachesProcessed: beaches.length,
    totalMilosBeaches: allBeaches.length,
    stockQueryLimitPerBeach: Number.isFinite(STOCK_QUERY_LIMIT) && STOCK_QUERY_LIMIT > 0 ? STOCK_QUERY_LIMIT : null,
    wikimediaEnterpriseQueryLimitPerBeach: Number.isFinite(ENTERPRISE_QUERY_LIMIT) && ENTERPRISE_QUERY_LIMIT > 0 ? ENTERPRISE_QUERY_LIMIT : null,
    verifiedBefore: previousCounts.verified || 0,
    verifiedAfter: counts.verified || 0,
    candidatesBefore: previousCounts.candidate || 0,
    candidatesAfter: counts.candidate || 0,
    missingBefore: previousCounts.missing || 0,
    missingAfter: counts.missing || 0,
    apiRequestCounts: runStats.apiRequestCounts,
    cacheHits: runStats.cacheHits,
    rateLimits: runStats.rateLimits || {},
    riskyMatchesExcluded: runStats.riskyMatchesExcluded,
    errors: runStats.errors,
    stockApiRequestsSkippedBecauseMissingKeys: runStats.skippedRequests,
    pixabayAssetsDownloaded: runStats.pixabayAssetsDownloaded || 0,
    pixabayAssetCacheHits: runStats.pixabayAssetCacheHits || 0,
    newVerifiedImages,
    genericImagesAdded: false,
    uiRuntimePhotoApiCalls: false,
  };
  await writeApiRunJson(apiRun);

  console.log('\nDone.');
  console.log(`Processed: ${entries.length}`);
  console.log(`Verified: ${counts.verified || 0}`);
  console.log(`Candidates needing review: ${counts.candidate || 0}`);
  console.log(`Missing: ${counts.missing || 0}`);
  console.log(`Sources: ${JSON.stringify(sources)}`);
  console.log(`Licenses: ${JSON.stringify(licenses)}`);
  console.log(`JSON: ${path.relative(ROOT_DIR, OUTPUT_JSON)}`);
  console.log(`Compatibility JSON: ${path.relative(ROOT_DIR, COMPAT_OUTPUT_JSON)}`);
  console.log(`CSV: ${path.relative(ROOT_DIR, OUTPUT_CSV)}`);
  console.log(`API run JSON: ${path.relative(ROOT_DIR, API_RUN_JSON)}`);
  console.log(`Manual review CSV: ${path.relative(ROOT_DIR, MANUAL_REVIEW_CSV)}`);
  console.log(`Manual override example: ${path.relative(ROOT_DIR, MANUAL_OVERRIDE_EXAMPLE_JSON)}`);
  console.log(`Stock API keys present: ${JSON.stringify(sourceKeyStatus())}`);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
