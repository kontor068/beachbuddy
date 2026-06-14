/**
 * Beach place-lookup audit (OSM edition) — does the name the app sends to Google
 * Maps resolve to the right beach / right island, or somewhere wrong?
 *
 * The app opens Google Maps for ~2,015 beaches via a PLACE query (a name string
 * like "Παραλία X, Naxos, Greece"); the rest route by coordinate (already
 * pin-audited). This script tests the SAME built query against OpenStreetMap
 * (Overpass natural=beach near the pin, then Nominatim text search as fallback)
 * and reuses the proven scoring from scripts/auditCycladesGooglePlaces.mjs:
 * distance from our pin, name match, island signal, wrong-island signal.
 *
 * Read-only: reads public/data/beaches/index.json + region JSONs, writes audit
 * artifacts under .tmp/. No beach data is modified.
 *
 * Usage:
 *   node scripts/auditBeachPlaceLookup.mjs --island=naxos --island=paros
 *   node scripts/auditBeachPlaceLookup.mjs --island=naxos --dry-run
 *   node scripts/auditBeachPlaceLookup.mjs --region=south-aegean-milos --source=nominatim
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const defaultOutputDir = path.join(rootDir, '.tmp', 'place-lookup-audit');

const overpassMirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'calmbeach-place-audit/1.0 (beach data validation)';

// ---- island aliases for the island-signal scoring (Cyclades pilot set) -------
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
    if (id !== regionId) aliases.push(...values);
  }
  return aliases;
};

const parseArgs = () => {
  const args = {
    islands: [],
    regions: [],
    limit: undefined,
    outDir: defaultOutputDir,
    dryRun: false,
    sleepMs: 1100, // Nominatim policy: >=1 req/s
    radiusMeters: 3000,
    source: 'both', // overpass | nominatim | both
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--island=')) args.islands.push(arg.slice('--island='.length).trim().toLowerCase());
    else if (arg.startsWith('--region=')) args.regions.push(arg.slice('--region='.length).trim().toLowerCase());
    else if (arg.startsWith('--limit=')) args.limit = Number.parseInt(arg.slice('--limit='.length), 10);
    else if (arg.startsWith('--out-dir=')) args.outDir = path.resolve(rootDir, arg.slice('--out-dir='.length));
    else if (arg.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(arg.slice('--sleep-ms='.length), 10);
    else if (arg.startsWith('--radius-meters=')) args.radiusMeters = Number.parseInt(arg.slice('--radius-meters='.length), 10);
    else if (arg.startsWith('--source=')) args.source = arg.slice('--source='.length).trim().toLowerCase();
  }
  return args;
};

// ---- shared helpers (copied verbatim from auditCycladesGooglePlaces.mjs) -----
const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9Ͱ-Ͽ]+/g, ' ')
  .replace(/\b(paralia|beach|plaz|plaka|the|of|greece|grecia|grece)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getTextValue = (value) => {
  if (typeof value === 'string') return value.trim();
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
    if (!text || !key || seen.has(key)) continue;
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
  if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) return { lat: beach.lat, lon: beach.lon };
  if (Number.isFinite(beach.coordinates?.lat) && Number.isFinite(beach.coordinates?.lon)) {
    return { lat: beach.coordinates.lat, lon: beach.coordinates.lon };
  }
  return undefined;
};

const toRadians = (degrees) => degrees * Math.PI / 180;
const distanceMeters = (from, to) => {
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(from.lon) || !Number.isFinite(to.lat) || !Number.isFinite(to.lon)) return undefined;
  const R = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const tokenSet = (value) => new Set(normalizeText(value).split(' ').filter(token => token.length >= 3));
const tokenOverlapScore = (a, b) => {
  const aTokens = tokenSet(a); const bTokens = tokenSet(b);
  if (aTokens.size === 0 || bTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of aTokens) if (bTokens.has(token)) overlap += 1;
  return overlap / Math.max(aTokens.size, bTokens.size);
};

const scoreNameMatch = (beach, place) => {
  const candidateText = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  const candidateNorm = normalizeText(candidateText);
  const names = unique([getBeachName(beach), ...getBeachAliases(beach)]);
  let best = 0; let bestName = '';
  for (const name of names) {
    const nameNorm = normalizeText(name);
    if (!nameNorm) continue;
    let score = Math.round(tokenOverlapScore(name, candidateText) * 24);
    if (candidateNorm.includes(nameNorm) || nameNorm.includes(normalizeText(place.displayName?.text))) score = Math.max(score, 35);
    else if (candidateNorm.includes(`paralia ${nameNorm}`) || candidateNorm.includes(`${nameNorm} beach`)) score = Math.max(score, 32);
    if (score > best) { best = score; bestName = name; }
  }
  return { score: Math.min(best, 35), matchedName: bestName };
};

const scoreDistance = (meters) => {
  if (!Number.isFinite(meters)) return 0;
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
  if (includesAlias(candidateText, getIslandAliases(region))) return 15;
  return Number.isFinite(meters) && meters <= 500 ? 6 : 0;
};
const hasWrongIslandSignal = (region, place) => {
  const text = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  return includesAlias(text, allOtherIslandAliases(region.id));
};
const scoreType = (place) => {
  const types = new Set([place.primaryType, ...(Array.isArray(place.types) ? place.types : [])].filter(Boolean));
  if (types.has('beach') || types.has('natural_feature')) return 5;
  if (types.has('tourist_attraction') || types.has('point_of_interest')) return 3;
  return 0;
};

const evaluatePlace = ({ beach, region, place }) => {
  const beachCoordinate = getCoordinate(beach);
  const placeCoordinate = place.location ? { lat: place.location.latitude, lon: place.location.longitude } : undefined;
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
  if (wrongIsland) flags.push('other_island_in_result');

  let status = 'needs_review';
  if (wrongIsland) status = 'rejected';
  else if (score >= 78 && Number.isFinite(meters) && meters <= 350 && nameMatch.score >= 24 && islandScore > 0) status = 'verified';
  else if (Number.isFinite(meters) && meters > 3000 && nameMatch.score < 24) status = 'rejected';

  return {
    status, score,
    distanceMeters: Number.isFinite(meters) ? Math.round(meters) : null,
    nameScore: nameMatch.score, matchedName: nameMatch.matchedName,
    islandScore, typeScore, flags,
  };
};

// ---- query construction: mirror utils/navigation.ts getPlaceQuery ------------
const hasGreekLetters = (value) => /[Ͱ-Ͽ]/.test(value);
const startsWithBeachWord = (value) => /^(παραλία|paralia|beach)(\s|,|$)/i.test(value.trim());
const getPrimaryName = (beach) => {
  const gr = (beach.name?.gr || '').trim();
  if (gr && hasGreekLetters(gr)) return gr;
  return (beach.name?.en || '').trim() || getBeachName(beach) || (getBeachAliases(beach)[0] || '');
};
const getQueryName = (beach) => {
  const primary = getPrimaryName(beach);
  if (!primary) return undefined;
  if (startsWithBeachWord(primary)) return primary;
  return hasGreekLetters(primary) ? `Παραλία ${primary}` : `Paralia ${primary}`;
};
const buildPlaceQuery = (beach, region) => {
  const explicit = (beach.metadata?.googleMapsNavigation?.query || '').trim();
  if (explicit) return explicit;
  const queryName = getQueryName(beach);
  if (!queryName) return undefined;
  const island = beach.location?.island || beach.location?.region || region.prefecture || region.name?.en;
  return unique([queryName, island, 'Greece']).join(', ');
};

// ---- scope: which beaches actually use a PLACE query (the audit targets) ------
// Mirrors getNavigationAction (utils/navigation.ts): a beach routes by NAME only
// when it is NOT boat-only AND its status resolves to a place-query directions
// path. Coordinate-routed beaches (boat-only, blocked, low-conf, needs-review,
// verified-coordinates-mode) are out of scope (the pin, not the name, decides).
const BOAT_ONLY = new Set(['boat_only', 'boat_or_difficult_path']);
const isBoatOnly = (beach) => BOAT_ONLY.has(String(beach.metadata?.access?.type)) || beach.accessibility === 'BOAT_ONLY';
const usesPlaceQuery = (beach) => {
  if (isBoatOnly(beach)) return false;
  const nav = beach.metadata?.googleMapsNavigation;
  const status = nav?.status ?? (beach.metadata?.confidence === 'low' ? 'low-conf-unaudited' : 'default');
  switch (status) {
    case 'blocked':
    case 'unresolved':
    case 'low-conf-unaudited':
      return false;
    case 'needs-review':
      return false; // place-mode → locate (coordinate); coordinate-mode → coordinate
    case 'verified':
      if (nav?.query) return true; // explicit place query
      if (nav?.mode === 'coordinates') return false;
      return true; // verified place-mode → built place query
    case 'default':
    default:
      return true; // the ~1.8k default bucket routes by built place query
  }
};

// ---- OSM candidate sources ---------------------------------------------------
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const fetchOverpassBeaches = async (coordinate, radiusMeters) => {
  const q = `[out:json][timeout:25];(node["natural"="beach"](around:${radiusMeters},${coordinate.lat},${coordinate.lon});way["natural"="beach"](around:${radiusMeters},${coordinate.lat},${coordinate.lon}););out tags center 8;`;
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(q),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) continue;
      const json = await res.json().catch(() => ({}));
      const els = Array.isArray(json.elements) ? json.elements : [];
      return els.map(e => {
        const lat = e.lat ?? e.center?.lat;
        const lon = e.lon ?? e.center?.lon;
        const name = e.tags?.name || e.tags?.['name:el'] || e.tags?.['name:en'] || '(unnamed)';
        const addr = [name, e.tags?.['addr:city'], e.tags?.['addr:place']].filter(Boolean).join(', ');
        return {
          source: 'overpass',
          id: `osm-${e.type}-${e.id}`,
          displayName: { text: name },
          formattedAddress: addr,
          location: Number.isFinite(lat) && Number.isFinite(lon) ? { latitude: lat, longitude: lon } : undefined,
          types: ['beach'],
        };
      }).filter(c => c.location);
    } catch { /* try next mirror */ }
  }
  return null; // all mirrors failed
};

const fetchNominatim = async (query, sleepMs) => {
  const url = `${nominatimUrl}?q=${encodeURIComponent(query)}&format=jsonv2&namedetails=1&addressdetails=1&limit=5&countrycodes=gr`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) { await sleep(sleepMs); return []; }
    const arr = await res.json().catch(() => []);
    await sleep(sleepMs); // respect 1 req/s
    return (Array.isArray(arr) ? arr : []).map(r => ({
      source: 'nominatim',
      id: `nom-${r.osm_type}-${r.osm_id}`,
      displayName: { text: r.namedetails?.name || r.name || r.display_name?.split(',')[0] || '' },
      formattedAddress: r.display_name || '',
      location: { latitude: Number(r.lat), longitude: Number(r.lon) },
      types: [r.type, r.class].filter(Boolean),
    }));
  } catch {
    await sleep(sleepMs);
    return [];
  }
};

// ---- audit one beach ---------------------------------------------------------
const candidateKey = (c) => c.id || `${c.displayName?.text}|${c.formattedAddress}`;

const auditBeach = async ({ args, record }) => {
  const { beach, region } = record;
  const coordinate = getCoordinate(beach);
  const query = buildPlaceQuery(beach, region);

  if (args.dryRun) {
    return {
      beachId: beach.id, beachName: getBeachName(beach), island: region.prefecture, regionId: region.id,
      coordinate, query, inScope: true, status: 'dry_run', candidates: [], bestCandidate: null,
    };
  }

  const candidates = new Map();
  let overpassFailed = false;

  if ((args.source === 'overpass' || args.source === 'both') && coordinate) {
    const osm = await fetchOverpassBeaches(coordinate, args.radiusMeters);
    if (osm === null) overpassFailed = true;
    else for (const c of osm) candidates.set(candidateKey(c), c);
    await sleep(Math.min(args.sleepMs, 1100));
  }

  // Nominatim fallback when no nearby OSM beach (or overpass disabled/failed).
  const needNominatim = (args.source === 'nominatim') ||
    (args.source === 'both' && candidates.size === 0);
  if (needNominatim && query) {
    for (const c of await fetchNominatim(query, args.sleepMs)) candidates.set(candidateKey(c), c);
  }

  const evaluated = [...candidates.values()]
    .map(place => ({ place, evaluation: evaluatePlace({ beach, region, place }) }))
    .sort((a, b) => {
      const rank = { verified: 0, needs_review: 1, rejected: 2 };
      return (rank[a.evaluation.status] - rank[b.evaluation.status]) ||
        (b.evaluation.score - a.evaluation.score) ||
        ((a.evaluation.distanceMeters ?? 999999) - (b.evaluation.distanceMeters ?? 999999));
    });

  const best = evaluated[0];
  let status = best?.evaluation.status || 'no_result';
  if (status === 'no_result' && overpassFailed && !query) status = 'lookup_error';

  return {
    beachId: beach.id, beachName: getBeachName(beach), island: region.prefecture, regionId: region.id,
    coordinate, query, inScope: true, status,
    bestCandidate: best ? {
      source: best.place.source,
      name: best.place.displayName?.text,
      address: best.place.formattedAddress,
      location: best.place.location,
      ...best.evaluation,
    } : null,
    candidateCount: evaluated.length,
  };
};

// ---- data loading ------------------------------------------------------------
const loadBeaches = async (args) => {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const wantIsland = (region) => args.islands.length === 0 ||
    args.islands.some(isl => region.id.toLowerCase().includes(isl) || String(region.prefecture || '').toLowerCase() === isl);
  const wantRegion = (region) => args.regions.length === 0 || args.regions.includes(region.id.toLowerCase());
  const regions = index.regions.filter(r => (args.islands.length || args.regions.length)
    ? (wantIsland(r) && (args.regions.length === 0 || wantRegion(r))) || (args.islands.length === 0 && wantRegion(r))
    : true);

  const records = [];
  for (const region of regions) {
    const dataPath = path.join(publicDir, region.dataPath.replace(/^\//, ''));
    let beaches;
    try { beaches = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    for (const beach of beaches) {
      if (!usesPlaceQuery(beach)) continue; // scope: only name-routed beaches
      records.push({ region, beach });
    }
  }
  return Number.isInteger(args.limit) && args.limit > 0 ? records.slice(0, args.limit) : records;
};

// ---- output writers ----------------------------------------------------------
const csvCell = (v) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const run = async () => {
  const args = parseArgs();
  await mkdir(args.outDir, { recursive: true });
  const records = await loadBeaches(args);
  console.log(`In-scope (place-query) beaches: ${records.length}${args.islands.length ? ` for ${args.islands.join(', ')}` : ''}${args.regions.length ? ` for ${args.regions.join(', ')}` : ''}`);

  if (args.dryRun) {
    for (const record of records) {
      const r = await auditBeach({ args, record });
      console.log(`#${r.beachId} ${r.beachName} -> query: "${r.query}"`);
    }
    console.log(`\nDry run: ${records.length} beaches would be looked up. (no API calls)`);
    return;
  }

  const rows = [];
  const summary = { verified: 0, needs_review: 0, rejected: 0, no_result: 0, lookup_error: 0 };
  let done = 0;
  for (const record of records) {
    const r = await auditBeach({ args, record });
    rows.push(r);
    summary[r.status] = (summary[r.status] ?? 0) + 1;
    done += 1;
    if (done % 10 === 0) process.stderr.write(`...${done}/${records.length}\n`);
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(args.outDir, `audit-${ts}.json`);
  const csvPath = path.join(args.outDir, `audit-${ts}.csv`);
  const summaryPath = path.join(args.outDir, 'summary.json');

  await writeFile(jsonPath, JSON.stringify(rows, null, 1), 'utf8');

  const header = ['id', 'name', 'island', 'status', 'distanceM', 'score', 'nameScore', 'islandScore', 'candidateSource', 'candidateName', 'flags'];
  const csv = [header.join(',')];
  for (const r of rows) {
    csv.push([
      r.beachId, r.beachName, r.island, r.status,
      r.bestCandidate?.distanceMeters ?? '', r.bestCandidate?.score ?? '',
      r.bestCandidate?.nameScore ?? '', r.bestCandidate?.islandScore ?? '',
      r.bestCandidate?.source ?? '', r.bestCandidate?.name ?? '',
      (r.bestCandidate?.flags || []).join('|'),
    ].map(csvCell).join(','));
  }
  await writeFile(csvPath, csv.join('\n'), 'utf8');

  await writeFile(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    islands: args.islands, regions: args.regions, source: args.source,
    total: rows.length, ...summary,
    policy: {
      verified: 'score>=78, distance<=350m, name score>=24, island signal present, no wrong-island signal',
      needs_review: 'a candidate exists but does not meet verified policy (far, weak name, or island not in result)',
      rejected: 'wrong island in result, or only a distant weak-name hit',
      no_result: 'OSM (Overpass beach near pin + Nominatim text search) returned no usable candidate',
    },
  }, null, 2), 'utf8');

  console.log(`\nStatus: verified=${summary.verified} needs_review=${summary.needs_review} rejected=${summary.rejected} no_result=${summary.no_result} lookup_error=${summary.lookup_error}`);
  console.log(`JSON: ${path.relative(rootDir, jsonPath)}`);
  console.log(`CSV:  ${path.relative(rootDir, csvPath)}`);
};

run().catch(err => { console.error(err); process.exit(1); });
