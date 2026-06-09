import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const defaultOutputDir = path.join(rootDir, '.tmp', 'cyclades-map-evidence-audit');
const defaultCacheDir = path.join(rootDir, '.tmp', 'map-evidence-cache');
const userAgent = 'CalmBeachDataAudit/1.0 (local development; map point verification)';

const parseArgs = () => {
  const args = {
    island: undefined,
    limit: undefined,
    outDir: defaultOutputDir,
    cacheDir: defaultCacheDir,
    nominatim: false,
    nominatimLimit: undefined,
    nominatimSleepMs: 1150,
  };

  for (const arg of process.argv.slice(2)) {
    if (arg === '--nominatim') {
      args.nominatim = true;
    } else if (arg.startsWith('--island=')) {
      args.island = arg.slice('--island='.length).trim().toLowerCase();
    } else if (arg.startsWith('--limit=')) {
      args.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    } else if (arg.startsWith('--nominatim-limit=')) {
      args.nominatimLimit = Number.parseInt(arg.slice('--nominatim-limit='.length), 10);
    } else if (arg.startsWith('--nominatim-sleep-ms=')) {
      args.nominatimSleepMs = Number.parseInt(arg.slice('--nominatim-sleep-ms='.length), 10);
    } else if (arg.startsWith('--out-dir=')) {
      args.outDir = path.resolve(rootDir, arg.slice('--out-dir='.length));
    } else if (arg.startsWith('--cache-dir=')) {
      args.cacheDir = path.resolve(rootDir, arg.slice('--cache-dir='.length));
    }
  }

  return args;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9\u0370-\u03ff]+/g, ' ')
  .replace(/\b(paralia|beach|plaz|greece|cyclades|kyklades|nisos|island|ormos|bay)\b/g, ' ')
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

const tokenSet = (value) => new Set(normalizeText(value).split(' ').filter(token => token.length >= 3));

const normalizeTagValue = (value) => String(value || '').trim().toLowerCase();

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

const getSourceUrls = (beach) => unique([
  ...(Array.isArray(beach.sourceUrls) ? beach.sourceUrls : []),
  ...(Array.isArray(beach.metadata?.sourceUrls) ? beach.metadata.sourceUrls : []),
]);

const parseOsmUrl = (url) => {
  const match = String(url).match(/openstreetmap\.org\/(?:.*?\/)?(node|way|relation)\/(\d+)/i);
  if (!match) {
    return undefined;
  }
  return { type: match[1].toLowerCase(), id: match[2], url };
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

const cachePath = (cacheDir, key) => path.join(cacheDir, `${key.replace(/[^a-z0-9_.-]/gi, '_')}.json`);

const readJsonCache = async (cacheDir, key) => {
  const file = cachePath(cacheDir, key);
  if (!existsSync(file)) {
    return undefined;
  }
  return JSON.parse(await readFile(file, 'utf8'));
};

const writeJsonCache = async (cacheDir, key, value) => {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath(cacheDir, key), JSON.stringify(value, null, 2));
};

const fetchJsonWithCache = async ({ cacheDir, key, url, headers = {} }) => {
  const cached = await readJsonCache(cacheDir, key);
  if (cached) {
    return cached;
  }
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      ...headers,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
  }
  const payload = JSON.parse(text);
  await writeJsonCache(cacheDir, key, payload);
  return payload;
};

const getOsmApiUrl = ({ type, id }) => {
  if (type === 'node') {
    return `https://www.openstreetmap.org/api/0.6/node/${id}.json`;
  }
  return `https://www.openstreetmap.org/api/0.6/${type}/${id}/full.json`;
};

const centerOfCoordinates = (coordinates) => {
  if (coordinates.length === 0) {
    return undefined;
  }
  const totals = coordinates.reduce((acc, coordinate) => ({
    lat: acc.lat + coordinate.lat,
    lon: acc.lon + coordinate.lon,
  }), { lat: 0, lon: 0 });
  return {
    lat: totals.lat / coordinates.length,
    lon: totals.lon / coordinates.length,
  };
};

const extractOsmGeometry = (payload, objectRef) => {
  const elements = Array.isArray(payload.elements) ? payload.elements : [];
  const primary = elements.find(element => element.type === objectRef.type && String(element.id) === String(objectRef.id)) ||
    elements.find(element => String(element.id) === String(objectRef.id));
  const nodeCoordinates = elements
    .filter(element => element.type === 'node' && Number.isFinite(element.lat) && Number.isFinite(element.lon))
    .map(element => ({ lat: element.lat, lon: element.lon }));

  if (objectRef.type === 'node' && primary && Number.isFinite(primary.lat) && Number.isFinite(primary.lon)) {
    return {
      center: { lat: primary.lat, lon: primary.lon },
      nearestCoordinates: [{ lat: primary.lat, lon: primary.lon }],
      tags: primary.tags || {},
    };
  }

  return {
    center: centerOfCoordinates(nodeCoordinates),
    nearestCoordinates: nodeCoordinates,
    tags: primary?.tags || {},
  };
};

const scoreName = (beach, candidateText) => {
  const names = unique([getBeachName(beach), ...getBeachAliases(beach)]);
  let bestScore = 0;
  let matchedName = '';
  for (const name of names) {
    const score = tokenOverlapScore(name, candidateText);
    if (score > bestScore) {
      bestScore = score;
      matchedName = name;
    }
  }
  return {
    score: Math.round(bestScore * 100),
    matchedName,
  };
};

const classifyOsmSource = ({ beach, geometry }) => {
  const coordinate = getCoordinate(beach);
  const centerDistance = distanceMeters(coordinate, geometry.center);
  const nearestDistance = Math.min(
    ...geometry.nearestCoordinates
      .map(candidate => distanceMeters(coordinate, candidate))
      .filter(Number.isFinite)
  );
  const finiteNearest = Number.isFinite(nearestDistance) ? nearestDistance : undefined;
  const candidateName = [
    geometry.tags.name,
    geometry.tags['name:el'],
    geometry.tags['name:en'],
    geometry.tags.alt_name,
    geometry.tags.place,
    geometry.tags.natural,
    geometry.tags.tourism,
  ].filter(Boolean).join(' ');
  const nameMatch = scoreName(beach, candidateName);
  const beachTypeSignal = [
    geometry.tags.natural,
    geometry.tags.tourism,
    geometry.tags.leisure,
  ].some(value => normalizeTagValue(value) === 'beach');
  const bestDistance = Math.min(
    Number.isFinite(centerDistance) ? centerDistance : Infinity,
    Number.isFinite(finiteNearest) ? finiteNearest : Infinity
  );

  const flags = [];
  if (!Number.isFinite(centerDistance)) flags.push('missing_osm_center');
  if (!Number.isFinite(finiteNearest)) flags.push('missing_osm_nodes');
  if (Number.isFinite(bestDistance) && bestDistance > 750) flags.push('far_from_osm_geometry');
  if (candidateName && nameMatch.score < 35) flags.push('weak_osm_name_match');
  if (!beachTypeSignal) flags.push('weak_osm_type_signal');

  let status = 'needs_review_osm_source';
  if (beachTypeSignal && Number.isFinite(bestDistance) && bestDistance <= 150) {
    status = 'verified_osm_source';
  } else if (beachTypeSignal && Number.isFinite(bestDistance) && bestDistance <= 350) {
    status = 'near_osm_source';
  } else if (Number.isFinite(bestDistance) && bestDistance > 1000) {
    status = 'coordinate_mismatch_osm_source';
  }

  return {
    status,
    centerDistanceMeters: Number.isFinite(centerDistance) ? Math.round(centerDistance) : null,
    nearestDistanceMeters: Number.isFinite(finiteNearest) ? Math.round(finiteNearest) : null,
    nameScore: nameMatch.score,
    matchedName: nameMatch.matchedName,
    candidateName,
    flags,
  };
};

const auditOsmSources = async ({ beach, cacheDir }) => {
  const osmRefs = getSourceUrls(beach).map(parseOsmUrl).filter(Boolean);
  const checks = [];

  for (const ref of osmRefs) {
    try {
      const payload = await fetchJsonWithCache({
        cacheDir,
        key: `osm_${ref.type}_${ref.id}`,
        url: getOsmApiUrl(ref),
      });
      const geometry = extractOsmGeometry(payload, ref);
      checks.push({
        sourceUrl: ref.url,
        osmType: ref.type,
        osmId: ref.id,
        ...classifyOsmSource({ beach, geometry }),
      });
    } catch (error) {
      checks.push({
        sourceUrl: ref.url,
        osmType: ref.type,
        osmId: ref.id,
        status: 'osm_source_error',
        error: error.message,
        flags: ['osm_fetch_error'],
      });
    }
  }

  return checks;
};

const islandAliases = new Map([
  ['south-aegean-kea', ['kea', 'tzia']],
  ['south-aegean-milos', ['milos', 'melos']],
  ['south-aegean-santorini', ['santorini', 'thira']],
  ['south-aegean-koufonisia', ['koufonisia', 'koufonisi']],
  ['south-aegean-schinoussa', ['schinoussa', 'schoinousa', 'schoinoussa']],
  ['south-aegean-iraklia', ['iraklia', 'heraklia']],
  ['south-aegean-polyaigos', ['polyaigos', 'polyegos']],
]);

const getIslandSearchParts = (region) => unique([
  region.prefecture,
  region.name?.en,
  ...(islandAliases.get(region.id) || []),
]);

const buildNominatimQuery = (beach, region) => {
  const name = getBeachName(beach);
  const aliases = getBeachAliases(beach);
  const island = region.prefecture || region.name?.en;
  return unique([
    `Paralia ${name}, ${island}, Greece`,
    `${name} beach, ${island}, Greece`,
    `${name}, ${island}, Cyclades, Greece`,
    ...aliases.slice(0, 2).map(alias => `${alias}, ${island}, Greece`),
  ])[0];
};

const nominatimSearch = async ({ beach, region, cacheDir }) => {
  const coordinate = getCoordinate(beach);
  const query = buildNominatimQuery(beach, region);
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    addressdetails: '1',
    namedetails: '1',
    dedupe: '1',
    countrycodes: 'gr',
  });

  if (coordinate) {
    const delta = 0.08;
    params.set('viewbox', [
      coordinate.lon - delta,
      coordinate.lat + delta,
      coordinate.lon + delta,
      coordinate.lat - delta,
    ].join(','));
    params.set('bounded', '0');
  }

  return fetchJsonWithCache({
    cacheDir,
    key: `nominatim_${normalizeText(query)}_${coordinate?.lat || ''}_${coordinate?.lon || ''}`,
    url: `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    headers: {
      Accept: 'application/json',
    },
  });
};

const classifyNominatim = ({ beach, region, results }) => {
  const coordinate = getCoordinate(beach);
  const islandText = getIslandSearchParts(region).map(normalizeText);
  const candidates = results.map(result => {
    const candidateCoordinate = {
      lat: Number.parseFloat(result.lat),
      lon: Number.parseFloat(result.lon),
    };
    const meters = distanceMeters(coordinate, candidateCoordinate);
    const primaryDisplayName = [
      result.name,
      result.namedetails?.name,
      result.namedetails?.['name:el'],
      result.namedetails?.['name:en'],
      String(result.display_name || '').split(',')[0],
    ].filter(Boolean).join(' ');
    const displayText = [
      result.display_name,
      result.name,
      result.namedetails?.name,
      result.namedetails?.['name:el'],
      result.namedetails?.['name:en'],
      result.class,
      result.type,
    ].filter(Boolean).join(' ');
    const primaryNameMatch = scoreName(beach, primaryDisplayName);
    const fullNameMatch = scoreName(beach, displayText);
    const nameMatch = primaryNameMatch.score >= fullNameMatch.score ? primaryNameMatch : fullNameMatch;
    const normalizedDisplay = normalizeText(displayText);
    const islandSignal = islandText.some(alias => alias && normalizedDisplay.includes(alias));
    const typeSignal = ['beach', 'coastline', 'bay'].some(token => normalizedDisplay.includes(token)) ||
      result.class === 'natural' ||
      result.type === 'beach';
    const score = Math.round(
      (Number.isFinite(meters) && meters <= 150 ? 45 : Number.isFinite(meters) && meters <= 350 ? 34 : Number.isFinite(meters) && meters <= 750 ? 18 : 0) +
      Math.min(35, nameMatch.score * 0.35) +
      (islandSignal ? 12 : Number.isFinite(meters) && meters <= 150 ? 6 : 0) +
      (typeSignal ? 8 : 0)
    );
    const flags = [];
    if (!Number.isFinite(meters)) flags.push('missing_nominatim_coordinate');
    if (Number.isFinite(meters) && meters > 1000) flags.push('far_from_existing_coordinate');
    if (nameMatch.score < 40) flags.push('weak_name_match');
    if (!islandSignal && Number.isFinite(meters) && meters > 150) flags.push('missing_island_signal');
    if (!typeSignal) flags.push('weak_type_signal');

    return {
      osmType: result.osm_type,
      osmId: result.osm_id,
      displayName: result.display_name,
      lat: candidateCoordinate.lat,
      lon: candidateCoordinate.lon,
      class: result.class,
      type: result.type,
      distanceMeters: Number.isFinite(meters) ? Math.round(meters) : null,
      nameScore: nameMatch.score,
      islandSignal,
      typeSignal,
      score,
      flags,
    };
  }).sort((a, b) => b.score - a.score || ((a.distanceMeters ?? 999999) - (b.distanceMeters ?? 999999)));

  const best = candidates[0];
  if (!best) {
    return {
      status: 'no_map_evidence',
      candidates,
    };
  }

  let status = 'needs_review_nominatim';
  if (best.distanceMeters !== null && best.distanceMeters <= 150 && best.nameScore >= 75 && best.typeSignal) {
    status = 'verified_nominatim_nearby';
  } else if (best.score >= 78 && best.distanceMeters !== null && best.distanceMeters <= 350 && best.nameScore >= 55 && (best.islandSignal || best.distanceMeters <= 120)) {
    status = 'verified_nominatim_nearby';
  } else if (best.distanceMeters !== null && best.distanceMeters > 1500 && best.nameScore < 50) {
    status = 'rejected_nominatim';
  }

  return {
    status,
    candidates,
  };
};

const loadCycladesRecords = async (args) => {
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

const chooseStatus = (osmChecks, nominatimResult) => {
  const statusPriority = [
    'verified_osm_source',
    'near_osm_source',
    'verified_nominatim_nearby',
    'needs_review_osm_source',
    'needs_review_nominatim',
    'coordinate_mismatch_osm_source',
    'rejected_nominatim',
    'osm_source_error',
    'no_map_evidence',
    'not_checked_nominatim',
  ];
  const statuses = [
    ...osmChecks.map(check => check.status),
    nominatimResult?.status,
  ].filter(Boolean);
  return statuses.sort((a, b) => statusPriority.indexOf(a) - statusPriority.indexOf(b))[0] || 'no_map_evidence';
};

const auditRecord = async ({ record, args, nominatimCounter }) => {
  const { region, beach } = record;
  const osmChecks = await auditOsmSources({ beach, cacheDir: args.cacheDir });
  let nominatimResult = { status: 'not_checked_nominatim', candidates: [] };

  if (args.nominatim && osmChecks.length === 0) {
    const canRunNominatim = !Number.isInteger(args.nominatimLimit) || nominatimCounter.count < args.nominatimLimit;
    if (canRunNominatim) {
      if (nominatimCounter.count > 0 && args.nominatimSleepMs > 0) {
        await sleep(args.nominatimSleepMs);
      }
      nominatimCounter.count += 1;
      try {
        const results = await nominatimSearch({ beach, region, cacheDir: args.cacheDir });
        nominatimResult = classifyNominatim({ beach, region, results });
      } catch (error) {
        nominatimResult = {
          status: 'nominatim_error',
          error: error.message,
          candidates: [],
        };
      }
    }
  }

  return {
    regionId: region.id,
    island: region.prefecture,
    beachId: beach.id,
    beachName: getBeachName(beach),
    lat: getCoordinate(beach)?.lat,
    lon: getCoordinate(beach)?.lon,
    status: chooseStatus(osmChecks, nominatimResult),
    osmChecks,
    nominatim: nominatimResult,
  };
};

const summarize = (rows) => {
  const summary = { total: rows.length };
  for (const row of rows) {
    summary[row.status] = (summary[row.status] || 0) + 1;
  }
  return summary;
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
    'lat',
    'lon',
    'osm_status',
    'osm_url',
    'osm_nearest_m',
    'osm_center_m',
    'osm_name_score',
    'nominatim_status',
    'nominatim_osm_type',
    'nominatim_osm_id',
    'nominatim_distance_m',
    'nominatim_score',
    'nominatim_name_score',
    'nominatim_display_name',
  ];
  const lines = [headers.join(',')];
  for (const row of rows) {
    const bestOsm = row.osmChecks?.[0];
    const bestNom = row.nominatim?.candidates?.[0];
    lines.push([
      row.regionId,
      row.island,
      row.beachId,
      row.beachName,
      row.status,
      row.lat,
      row.lon,
      bestOsm?.status || '',
      bestOsm?.sourceUrl || '',
      bestOsm?.nearestDistanceMeters ?? '',
      bestOsm?.centerDistanceMeters ?? '',
      bestOsm?.nameScore ?? '',
      row.nominatim?.status || '',
      bestNom?.osmType || '',
      bestNom?.osmId || '',
      bestNom?.distanceMeters ?? '',
      bestNom?.score ?? '',
      bestNom?.nameScore ?? '',
      bestNom?.displayName || '',
    ].map(csvEscape).join(','));
  }
  return `${lines.join('\n')}\n`;
};

const writeReports = async ({ args, rows }) => {
  await mkdir(args.outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const summary = summarize(rows);

  await writeFile(path.join(args.outDir, 'cyclades-map-evidence-report.json'), JSON.stringify({
    generatedAt,
    scope: args.island ? `cyclades:${args.island}` : 'cyclades',
    nominatimEnabled: args.nominatim,
    summary,
    policy: {
      verified_osm_source: 'stored coordinate is within 150m of a cited OSM object geometry node/center',
      near_osm_source: 'stored coordinate is within 350m of cited OSM geometry and should be reviewed for long beaches',
      verified_nominatim_nearby: 'Nominatim candidate has close distance, strong name match, and island/nearby signal',
      no_map_evidence: 'no direct OSM source and no accepted Nominatim candidate',
    },
    rows,
  }, null, 2));
  await writeFile(path.join(args.outDir, 'cyclades-map-evidence-report.csv'), toCsv(rows));

  const byIsland = new Map();
  for (const row of rows) {
    if (!byIsland.has(row.regionId)) {
      byIsland.set(row.regionId, []);
    }
    byIsland.get(row.regionId).push(row);
  }
  for (const [regionId, islandRows] of byIsland.entries()) {
    await writeFile(path.join(args.outDir, `${regionId}.csv`), toCsv(islandRows));
  }

  const lines = [
    '# Cyclades Map Evidence Audit',
    '',
    `Generated: ${generatedAt}`,
    `Scope: ${args.island ? `cyclades:${args.island}` : 'cyclades'}`,
    `Nominatim enabled: ${args.nominatim ? 'yes' : 'no'}`,
    '',
    '## Summary',
    '',
    ...Object.entries(summary).map(([key, value]) => `- ${key}: ${value}`),
    '',
    '## Policy',
    '',
    '- OSM source verification is strongest because it checks a cited map object URL already attached to the beach record.',
    '- Nominatim verification is useful but lower confidence; ambiguous search hits remain review items.',
    '- A map point pass does not verify road access, amenities, safety, sea conditions, or parking.',
  ];
  await writeFile(path.join(args.outDir, 'cyclades-map-evidence-report.md'), `${lines.join('\n')}\n`);
};

const main = async () => {
  const args = parseArgs();
  const records = await loadCycladesRecords(args);
  const rows = [];
  const nominatimCounter = { count: 0 };

  for (const [index, record] of records.entries()) {
    const row = await auditRecord({ record, args, nominatimCounter });
    rows.push(row);
    console.log(`[${index + 1}/${records.length}] ${row.regionId} ${row.beachId} ${row.beachName}: ${row.status}`);
  }

  await writeReports({ args, rows });
  const summary = summarize(rows);
  console.log('Cyclades Map Evidence Audit');
  console.log(Object.entries(summary).map(([key, value]) => `${key}: ${value}`).join(', '));
  console.log(`Nominatim requests: ${nominatimCounter.count}`);
  console.log(`Reports: ${args.outDir}`);
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
