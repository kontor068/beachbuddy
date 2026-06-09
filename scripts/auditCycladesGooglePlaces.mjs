import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const defaultOutputDir = path.join(rootDir, '.tmp', 'cyclades-google-places-audit');
const placesTextSearchUrl = 'https://places.googleapis.com/v1/places:searchText';

const fieldMask = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.googleMapsUri',
].join(',');

const cycladesIslandAliases = new Map([
  ['south-aegean-amorgos', ['amorgos']],
  ['south-aegean-anafi', ['anafi']],
  ['south-aegean-andros', ['andros']],
  ['south-aegean-antiparos', ['antiparos']],
  ['south-aegean-folegandros', ['folegandros']],
  ['south-aegean-ios', ['ios']],
  ['south-aegean-kea', ['kea', 'tzia']],
  ['south-aegean-kimolos', ['kimolos']],
  ['south-aegean-kythnos', ['kythnos']],
  ['south-aegean-milos', ['milos', 'melos']],
  ['south-aegean-mykonos', ['mykonos']],
  ['south-aegean-naxos', ['naxos']],
  ['south-aegean-paros', ['paros']],
  ['south-aegean-santorini', ['santorini', 'thira']],
  ['south-aegean-serifos', ['serifos']],
  ['south-aegean-sifnos', ['sifnos']],
  ['south-aegean-sikinos', ['sikinos']],
  ['south-aegean-syros', ['syros']],
  ['south-aegean-tinos', ['tinos']],
  ['south-aegean-donousa', ['donousa', 'donoussa']],
  ['south-aegean-koufonisia', ['koufonisia', 'koufonisi', 'kato koufonisi', 'pano koufonisi']],
  ['south-aegean-schinoussa', ['schinoussa', 'schoinousa', 'schoinoussa']],
  ['south-aegean-iraklia', ['iraklia', 'heraklia']],
  ['south-aegean-polyaigos', ['polyaigos', 'polyegos']],
]);

const allOtherIslandAliases = (regionId) => {
  const aliases = [];
  for (const [id, values] of cycladesIslandAliases.entries()) {
    if (id !== regionId) {
      aliases.push(...values);
    }
  }
  return aliases;
};

const parseArgs = () => {
  const args = {
    island: undefined,
    limit: undefined,
    outDir: defaultOutputDir,
    dryRun: false,
    sleepMs: 120,
    radiusMeters: 3000,
    maxCandidates: 5,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--island=')) {
      args.island = arg.slice('--island='.length).trim().toLowerCase();
    } else if (arg.startsWith('--limit=')) {
      args.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    } else if (arg.startsWith('--out-dir=')) {
      args.outDir = path.resolve(rootDir, arg.slice('--out-dir='.length));
    } else if (arg.startsWith('--sleep-ms=')) {
      args.sleepMs = Number.parseInt(arg.slice('--sleep-ms='.length), 10);
    } else if (arg.startsWith('--radius-meters=')) {
      args.radiusMeters = Number.parseInt(arg.slice('--radius-meters='.length), 10);
    } else if (arg.startsWith('--max-candidates=')) {
      args.maxCandidates = Number.parseInt(arg.slice('--max-candidates='.length), 10);
    }
  }

  return args;
};

const stripQuotes = (value) => {
  const text = value.trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  return text;
};

const loadEnvFile = async (filePath) => {
  if (!existsSync(filePath)) {
    return;
  }

  const content = await readFile(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith('#')) {
      continue;
    }

    const [, key, value] = match;
    if (!process.env[key]) {
      process.env[key] = stripQuotes(value);
    }
  }
};

const loadLocalEnv = async () => {
  await loadEnvFile(path.join(rootDir, '.env'));
  await loadEnvFile(path.join(rootDir, '.env.local'));
};

const getApiKey = () => (
  process.env.GOOGLE_PLACES_API_KEY ||
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.GOOGLE_API_KEY
);

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\u0370-\u03ff]+/g, ' ')
  .replace(/\b(paralia|beach|plaz|plaka|the|of|greece|grecia|grece)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getTextValue = (value) => {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value && typeof value === 'object') {
    return value.gr || value.en || Object.values(value).find(item => typeof item === 'string') || '';
  }
  return '';
};

const unique = (values) => {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || '').trim();
    const key = normalizeText(text);
    if (!text || !key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(text);
  }
  return result;
};

const getBeachName = (beach) => getTextValue(beach.name);

const getBeachAliases = (beach) => unique([
  ...(Array.isArray(beach.aliases) ? beach.aliases : []),
  ...(Array.isArray(beach.metadata?.aliases) ? beach.metadata.aliases : []),
]);

const getCoordinate = (beach) => {
  if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) {
    return { lat: beach.lat, lon: beach.lon };
  }
  if (Number.isFinite(beach.coordinates?.lat) && Number.isFinite(beach.coordinates?.lon)) {
    return { lat: beach.coordinates.lat, lon: beach.coordinates.lon };
  }
  return undefined;
};

const toRadians = (degrees) => degrees * Math.PI / 180;

const distanceMeters = (from, to) => {
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(from.lon) || !Number.isFinite(to.lat) || !Number.isFinite(to.lon)) {
    return undefined;
  }

  const earthRadiusMeters = 6371000;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tokenSet = (value) => new Set(normalizeText(value).split(' ').filter(token => token.length >= 3));

const tokenOverlapScore = (a, b) => {
  const aTokens = tokenSet(a);
  const bTokens = tokenSet(b);
  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.max(aTokens.size, bTokens.size);
};

const scoreNameMatch = (beach, place) => {
  const candidateText = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  const candidateNorm = normalizeText(candidateText);
  const names = unique([getBeachName(beach), ...getBeachAliases(beach)]);

  let best = 0;
  let bestName = '';
  for (const name of names) {
    const nameNorm = normalizeText(name);
    if (!nameNorm) {
      continue;
    }

    let score = Math.round(tokenOverlapScore(name, candidateText) * 24);
    if (candidateNorm.includes(nameNorm) || nameNorm.includes(normalizeText(place.displayName?.text))) {
      score = Math.max(score, 35);
    } else if (candidateNorm.includes(`paralia ${nameNorm}`) || candidateNorm.includes(`${nameNorm} beach`)) {
      score = Math.max(score, 32);
    }

    if (score > best) {
      best = score;
      bestName = name;
    }
  }

  return { score: Math.min(best, 35), matchedName: bestName };
};

const scoreDistance = (meters) => {
  if (!Number.isFinite(meters)) {
    return 0;
  }
  if (meters <= 80) return 50;
  if (meters <= 200) return 44;
  if (meters <= 350) return 34;
  if (meters <= 750) return 20;
  if (meters <= 1500) return 8;
  return 0;
};

const getIslandAliases = (region) => unique([
  region.prefecture,
  region.name?.en,
  ...(cycladesIslandAliases.get(region.id) || []),
]);

const includesAlias = (text, aliases) => {
  const normalized = ` ${normalizeText(text)} `;
  return aliases.some(alias => {
    const normalizedAlias = normalizeText(alias);
    return normalizedAlias && normalized.includes(` ${normalizedAlias} `);
  });
};

const scoreIsland = (region, place, meters) => {
  const candidateText = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  if (includesAlias(candidateText, getIslandAliases(region))) {
    return 15;
  }
  return Number.isFinite(meters) && meters <= 500 ? 6 : 0;
};

const hasWrongIslandSignal = (region, place) => {
  const text = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  return includesAlias(text, allOtherIslandAliases(region.id));
};

const scoreType = (place) => {
  const types = new Set([place.primaryType, ...(Array.isArray(place.types) ? place.types : [])].filter(Boolean));
  if (types.has('beach') || types.has('natural_feature')) {
    return 5;
  }
  if (types.has('tourist_attraction') || types.has('point_of_interest')) {
    return 3;
  }
  return 0;
};

const evaluatePlace = ({ beach, region, place }) => {
  const beachCoordinate = getCoordinate(beach);
  const placeCoordinate = place.location
    ? { lat: place.location.latitude, lon: place.location.longitude }
    : undefined;
  const meters = distanceMeters(beachCoordinate, placeCoordinate);
  const nameMatch = scoreNameMatch(beach, place);
  const islandScore = scoreIsland(region, place, meters);
  const typeScore = scoreType(place);
  const wrongIsland = hasWrongIslandSignal(region, place);
  const score = scoreDistance(meters) + nameMatch.score + islandScore + typeScore;

  const flags = [];
  if (!Number.isFinite(meters)) flags.push('missing_candidate_location');
  if (Number.isFinite(meters) && meters > 1000) flags.push('far_from_existing_coordinate');
  if (nameMatch.score < 18) flags.push('weak_name_match');
  if (islandScore === 0) flags.push('island_not_present_or_not_nearby');
  if (wrongIsland) flags.push('other_cyclades_island_in_result');

  let status = 'needs_review';
  if (wrongIsland) {
    status = 'rejected';
  } else if (score >= 78 && Number.isFinite(meters) && meters <= 350 && nameMatch.score >= 24 && islandScore > 0) {
    status = 'verified';
  } else if (Number.isFinite(meters) && meters > 3000 && nameMatch.score < 24) {
    status = 'rejected';
  }

  return {
    status,
    score,
    distanceMeters: Number.isFinite(meters) ? Math.round(meters) : null,
    nameScore: nameMatch.score,
    matchedName: nameMatch.matchedName,
    islandScore,
    typeScore,
    flags,
  };
};

const buildQueries = (beach, region) => {
  const name = getBeachName(beach);
  const aliases = getBeachAliases(beach);
  const island = region.prefecture || region.name?.en;

  return unique([
    `Paralia ${name}, ${island}, Cyclades, Greece`,
    `${name} beach, ${island}, Greece`,
    `${name}, ${island}, Greece`,
    ...aliases.slice(0, 2).flatMap(alias => [
      `${alias} beach, ${island}, Greece`,
      `${alias}, ${island}, Greece`,
    ]),
  ]);
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const requestTextSearch = async ({ apiKey, query, coordinate, radiusMeters, maxCandidates }) => {
  const body = {
    textQuery: query,
    languageCode: 'en',
    regionCode: 'GR',
    pageSize: maxCandidates,
  };

  if (coordinate) {
    body.locationBias = {
      circle: {
        center: {
          latitude: coordinate.lat,
          longitude: coordinate.lon,
        },
        radius: radiusMeters,
      },
    };
  }

  const response = await fetch(placesTextSearchUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }

  return Array.isArray(payload.places) ? payload.places : [];
};

const loadCycladesBeaches = async (args) => {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const regions = index.regions
    .filter(region => region.group === 'cyclades')
    .filter(region => !args.island || region.id.toLowerCase().includes(args.island) || String(region.prefecture || '').toLowerCase() === args.island);

  const records = [];
  for (const region of regions) {
    const dataPath = path.join(publicDir, region.dataPath.replace(/^\//, ''));
    const beaches = JSON.parse(await readFile(dataPath, 'utf8'));
    for (const beach of beaches) {
      records.push({ region, beach });
    }
  }

  return Number.isInteger(args.limit) && args.limit > 0 ? records.slice(0, args.limit) : records;
};

const placeKey = (place) => place.id || `${place.displayName?.text || ''}|${place.formattedAddress || ''}`;

const auditBeach = async ({ apiKey, args, record }) => {
  const { beach, region } = record;
  const coordinate = getCoordinate(beach);
  const queries = buildQueries(beach, region);

  if (args.dryRun) {
    return {
      beachId: beach.id,
      beachName: getBeachName(beach),
      island: region.prefecture,
      regionId: region.id,
      coordinate,
      status: 'dry_run',
      queries,
      candidates: [],
      bestCandidate: null,
    };
  }

  const candidates = new Map();
  const errors = [];

  for (const query of queries) {
    try {
      const places = await requestTextSearch({
        apiKey,
        query,
        coordinate,
        radiusMeters: args.radiusMeters,
        maxCandidates: args.maxCandidates,
      });
      for (const place of places) {
        candidates.set(placeKey(place), { ...place, query });
      }
    } catch (error) {
      errors.push({ query, message: error.message });
    }
    if (args.sleepMs > 0) {
      await sleep(args.sleepMs);
    }
  }

  const evaluatedCandidates = [...candidates.values()]
    .map(place => ({
      place,
      evaluation: evaluatePlace({ beach, region, place }),
    }))
    .sort((a, b) => {
      const statusRank = { verified: 0, needs_review: 1, rejected: 2 };
      return (statusRank[a.evaluation.status] - statusRank[b.evaluation.status]) ||
        (b.evaluation.score - a.evaluation.score) ||
        ((a.evaluation.distanceMeters ?? 999999) - (b.evaluation.distanceMeters ?? 999999));
    });

  const best = evaluatedCandidates[0];
  let status = best?.evaluation.status || 'no_result';
  if (errors.length > 0 && evaluatedCandidates.length === 0) {
    status = 'api_error';
  }

  return {
    beachId: beach.id,
    beachName: getBeachName(beach),
    island: region.prefecture,
    regionId: region.id,
    coordinate,
    status,
    queries,
    errors,
    candidates: evaluatedCandidates,
    bestCandidate: best || null,
  };
};

const csvEscape = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const toCsv = (rows) => {
  const headers = [
    'region_id',
    'island',
    'beach_id',
    'beach_name',
    'status',
    'place_id',
    'place_name',
    'formatted_address',
    'distance_m',
    'score',
    'name_score',
    'island_score',
    'flags',
    'google_maps_uri',
    'query',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const best = row.bestCandidate;
    const place = best?.place;
    const evaluation = best?.evaluation;
    lines.push([
      row.regionId,
      row.island,
      row.beachId,
      row.beachName,
      row.status,
      place?.id || '',
      place?.displayName?.text || '',
      place?.formattedAddress || '',
      evaluation?.distanceMeters ?? '',
      evaluation?.score ?? '',
      evaluation?.nameScore ?? '',
      evaluation?.islandScore ?? '',
      evaluation?.flags?.join('|') || '',
      place?.googleMapsUri || '',
      place?.query || row.queries?.[0] || '',
    ].map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
};

const summarize = (rows) => {
  const summary = {
    total: rows.length,
    verified: 0,
    needs_review: 0,
    rejected: 0,
    no_result: 0,
    api_error: 0,
    dry_run: 0,
  };
  for (const row of rows) {
    summary[row.status] = (summary[row.status] || 0) + 1;
  }
  return summary;
};

const writeReports = async ({ args, rows, apiKeyPresent }) => {
  await mkdir(args.outDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const summary = summarize(rows);
  const byIsland = new Map();
  for (const row of rows) {
    if (!byIsland.has(row.regionId)) {
      byIsland.set(row.regionId, []);
    }
    byIsland.get(row.regionId).push(row);
  }

  const jsonReport = {
    generatedAt: startedAt,
    scope: args.island ? `cyclades:${args.island}` : 'cyclades',
    apiKeyPresent,
    dryRun: args.dryRun,
    matchingPolicy: {
      verified: 'score >= 78, distance <= 350m, name score >= 24, island signal present, no other Cyclades island signal',
      needsReview: 'candidate exists but does not meet verified policy',
      rejected: 'wrong island signal or very distant weak-name candidate',
      noResult: 'Google returned no candidates for the generated queries',
    },
    summary,
    rows,
  };

  await writeFile(path.join(args.outDir, 'cyclades-google-places-report.json'), JSON.stringify(jsonReport, null, 2));
  await writeFile(path.join(args.outDir, 'cyclades-google-places-report.csv'), toCsv(rows));

  for (const [regionId, islandRows] of byIsland.entries()) {
    await writeFile(path.join(args.outDir, `${regionId}.csv`), toCsv(islandRows));
  }

  const lines = [
    '# Cyclades Google Places Audit',
    '',
    `Generated: ${startedAt}`,
    `Scope: ${args.island ? `cyclades:${args.island}` : 'cyclades'}`,
    `Dry run: ${args.dryRun ? 'yes' : 'no'}`,
    `Google API key present: ${apiKeyPresent ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    `- total: ${summary.total}`,
    `- verified: ${summary.verified}`,
    `- needs_review: ${summary.needs_review}`,
    `- rejected: ${summary.rejected}`,
    `- no_result: ${summary.no_result}`,
    `- api_error: ${summary.api_error}`,
    `- dry_run: ${summary.dry_run}`,
    '',
    '## Strict Matching Policy',
    '',
    '- verified requires close distance, strong name match, island signal, and no wrong-island signal.',
    '- needs_review is intentionally conservative and must not be written into beach JSON automatically.',
    '- no_result is acceptable for remote beaches; do not invent a Place ID.',
    '',
    '## Reports',
    '',
    '- cyclades-google-places-report.json',
    '- cyclades-google-places-report.csv',
    '- per-island CSV files named by region id',
  ];

  await writeFile(path.join(args.outDir, 'cyclades-google-places-report.md'), `${lines.join('\n')}\n`);
};

const main = async () => {
  const args = parseArgs();
  await loadLocalEnv();
  const apiKey = getApiKey();
  const apiKeyPresent = Boolean(apiKey);

  if (!apiKeyPresent && !args.dryRun) {
    console.error('Missing GOOGLE_PLACES_API_KEY, GOOGLE_MAPS_API_KEY, or GOOGLE_API_KEY. Use --dry-run to generate inventory without live Google calls.');
    process.exitCode = 1;
    return;
  }

  const records = await loadCycladesBeaches(args);
  const rows = [];

  for (const [index, record] of records.entries()) {
    const row = await auditBeach({ apiKey, args, record });
    rows.push(row);
    console.log(`[${index + 1}/${records.length}] ${row.regionId} ${row.beachId} ${row.beachName}: ${row.status}`);
  }

  await writeReports({ args, rows, apiKeyPresent });

  const summary = summarize(rows);
  console.log('Cyclades Google Places Audit');
  console.log(`Rows: ${summary.total}`);
  console.log(`verified: ${summary.verified}, needs_review: ${summary.needs_review}, rejected: ${summary.rejected}, no_result: ${summary.no_result}, api_error: ${summary.api_error}, dry_run: ${summary.dry_run}`);
  console.log(`Reports: ${args.outDir}`);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
