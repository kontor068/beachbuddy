/**
 * Shared place-resolution primitives: does the NAME the app sends to Google Maps
 * actually resolve to the right beach on the right island, or somewhere wrong?
 *
 * Extracted verbatim (behaviour-preserving) from scripts/auditBeachPlaceLookup.mjs
 * so both that script and scripts/auditPlaceResolution.mjs share one implementation
 * of: Greek-aware normalization, the query builder that mirrors utils/navigation.ts
 * getPlaceQuery, the OSM candidate sources (Overpass natural=beach + Nominatim), the
 * scoring (distance / name / island / wrong-island), and the place-query scope test.
 *
 * Pure/IO-free helpers are exported alongside the two network fetchers; callers own
 * rate-limiting and reporting. No module-level side effects.
 */

// ---- island aliases (Cyclades pilot set) -------------------------------------
// Used for the island-signal scoring. Keyed by region id (index.json scheme).
export const cycladesIslandAliases = new Map([
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

export const allOtherIslandAliases = (regionId) => {
  const aliases = [];
  for (const [id, values] of cycladesIslandAliases.entries()) {
    if (id !== regionId) aliases.push(...values);
  }
  return aliases;
};

export const overpassMirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
export const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
export const USER_AGENT = 'calmbeach-place-audit/1.0 (beach data validation)';

// ---- disk cache --------------------------------------------------------------
// Geocoder results are stable enough to cache for a run cycle, and the public APIs
// throttle hard, so we persist every lookup to a single JSON file under .tmp. This
// makes re-runs near-instant and lets a throttled run resume without re-hitting the
// network for beaches it already resolved. Opt-in: callers pass a cache object made
// by openPlaceCache(); when absent, fetchers behave exactly as before (live only).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export const openPlaceCache = (filePath) => {
  let store = {};
  try { store = JSON.parse(readFileSync(filePath, 'utf8')); } catch { /* fresh cache */ }
  let dirty = false;
  return {
    get: (key) => (Object.prototype.hasOwnProperty.call(store, key) ? store[key] : undefined),
    set: (key, value) => { store[key] = value; dirty = true; },
    flush: () => {
      if (!dirty) return;
      try { mkdirSync(dirname(filePath), { recursive: true }); writeFileSync(filePath, JSON.stringify(store), 'utf8'); dirty = false; }
      catch { /* best-effort cache; never fail the audit on a write error */ }
    },
    size: () => Object.keys(store).length,
  };
};

// ---- normalization & text helpers --------------------------------------------
export const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9Ͱ-Ͽ]+/g, ' ')
  .replace(/\b(paralia|beach|plaz|plaka|the|of|greece|grecia|grece)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const getTextValue = (value) => {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object') {
    return value.gr || value.en || Object.values(value).find(item => typeof item === 'string') || '';
  }
  return '';
};

export const unique = (values) => {
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

export const getBeachName = (beach) => getTextValue(beach.name);
export const getBeachAliases = (beach) => unique([
  ...(Array.isArray(beach.aliases) ? beach.aliases : []),
  ...(Array.isArray(beach.metadata?.aliases) ? beach.metadata.aliases : []),
]);

export const getCoordinate = (beach) => {
  if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) return { lat: beach.lat, lon: beach.lon };
  if (Number.isFinite(beach.coordinates?.lat) && Number.isFinite(beach.coordinates?.lon)) {
    return { lat: beach.coordinates.lat, lon: beach.coordinates.lon };
  }
  return undefined;
};

const toRadians = (degrees) => degrees * Math.PI / 180;
export const distanceMeters = (from, to) => {
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

// ---- scoring (distance / name / island / type / wrong-island) ----------------
export const scoreNameMatch = (beach, place) => {
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

export const scoreDistance = (meters) => {
  if (!Number.isFinite(meters)) return 0;
  if (meters <= 80) return 50;
  if (meters <= 200) return 44;
  if (meters <= 350) return 34;
  if (meters <= 750) return 20;
  if (meters <= 1500) return 8;
  return 0;
};

export const getIslandAliases = (region) => unique([
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
export const scoreIsland = (region, place, meters) => {
  const candidateText = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  if (includesAlias(candidateText, getIslandAliases(region))) return 15;
  return Number.isFinite(meters) && meters <= 500 ? 6 : 0;
};
export const hasWrongIslandSignal = (region, place) => {
  const text = `${place.displayName?.text || ''} ${place.formattedAddress || ''}`;
  return includesAlias(text, allOtherIslandAliases(region.id));
};
const scoreType = (place) => {
  const types = new Set([place.primaryType, ...(Array.isArray(place.types) ? place.types : [])].filter(Boolean));
  if (types.has('beach') || types.has('natural_feature')) return 5;
  if (types.has('tourist_attraction') || types.has('point_of_interest')) return 3;
  return 0;
};

export const evaluatePlace = ({ beach, region, place }) => {
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
// The bare beach name (qualified by island), with NO "Παραλία "/"Paralia " prefix —
// the prefix made the geocoder/Google return nothing even for known beaches and was the
// root cause the audit flagged. Names that already start with the beach word stay verbatim.
export const hasGreekLetters = (value) => /[Ͱ-Ͽ]/.test(value);
const getPrimaryName = (beach) => {
  const gr = (beach.name?.gr || '').trim();
  if (gr && hasGreekLetters(gr)) return gr;
  return (beach.name?.en || '').trim() || getBeachName(beach) || (getBeachAliases(beach)[0] || '');
};
// Mirror utils/navigation.ts cleanRegionToken: strip dataset-only "(mainland)" noise that
// makes a geocoder return nothing ("Halkidiki (mainland)" → "Halkidiki"), but keep a real
// parenthesised prefecture, most-specific first ("Crete (Chania)" → ["Chania","Crete"]).
const cleanRegionToken = (value) => {
  const text = (value || '').trim();
  if (!text) return [];
  const m = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  if (!m) return [text];
  const base = m[1].trim();
  const inner = m[2].trim();
  if (/^mainland\b/i.test(inner)) return base ? [base] : [];
  return [inner, base].filter(Boolean);
};
export const buildPlaceQuery = (beach, region) => {
  const explicit = (beach.metadata?.googleMapsNavigation?.query || '').trim();
  if (explicit) return explicit;
  const queryName = getPrimaryName(beach);
  if (!queryName) return undefined;
  const island = beach.location?.island || beach.location?.region || region.prefecture || region.name?.en;
  return unique([queryName, ...cleanRegionToken(island), 'Greece']).join(', ');
};

// ---- scope: which beaches actually use a PLACE query (the audit targets) ------
// Mirrors getNavigationAction (utils/navigation.ts): a beach routes by NAME only
// when it is NOT boat-only AND its status resolves to a place-query directions
// path. Coordinate-routed beaches (boat-only, blocked, low-conf, needs-review,
// verified-coordinates-mode) are out of scope (the pin, not the name, decides).
const BOAT_ONLY = new Set(['boat_only', 'boat_or_difficult_path']);
const isBoatOnly = (beach) => BOAT_ONLY.has(String(beach.metadata?.access?.type)) || beach.accessibility === 'BOAT_ONLY';
export const usesPlaceQuery = (beach) => {
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
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const fetchOverpassBeaches = async (coordinate, radiusMeters, cache) => {
  const cacheKey = `ovp:${radiusMeters}:${coordinate.lat.toFixed(5)},${coordinate.lon.toFixed(5)}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit; // cached array (or null for all-mirrors-failed)
  }
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
      const out = els.map(e => {
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
      if (cache) cache.set(cacheKey, out);
      return out;
    } catch { /* try next mirror */ }
  }
  return null; // all mirrors failed (not cached — transient, retry next run)
};

const mapNominatim = (arr) => (Array.isArray(arr) ? arr : []).map(r => ({
  source: 'nominatim',
  id: `nom-${r.osm_type}-${r.osm_id}`,
  displayName: { text: r.namedetails?.name || r.name || r.display_name?.split(',')[0] || '' },
  formattedAddress: r.display_name || '',
  location: { latitude: Number(r.lat), longitude: Number(r.lon) },
  types: [r.type, r.class].filter(Boolean),
}));

/**
 * Nominatim text search. Returns [] for a genuine empty result, but RETRIES on transient
 * HTTP errors (429/5xx/network) with backoff and THROWS after exhausting retries — so a
 * caller can tell "geocoder couldn't find it" (real signal) apart from "we got rate-limited"
 * (must not be read as a FAIL). Always sleeps >=sleepMs after a successful call (>=1 req/s).
 */
export const fetchNominatim = async (query, sleepMs, { retries = 3, cache } = {}) => {
  const cacheKey = `nom:${query}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit; // cached array (genuine result, incl. empty)
  }
  const url = `${nominatimUrl}?q=${encodeURIComponent(query)}&format=jsonv2&namedetails=1&addressdetails=1&limit=5&countrycodes=gr`;
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`nominatim HTTP ${res.status}`);
        await sleep(sleepMs * (attempt + 2)); // linear backoff: 2x,3x,4x
        continue;
      }
      if (!res.ok) { await sleep(sleepMs); const empty = []; if (cache) cache.set(cacheKey, empty); return empty; }
      const arr = await res.json().catch(() => []);
      await sleep(sleepMs); // respect 1 req/s
      const out = mapNominatim(arr);
      if (cache) cache.set(cacheKey, out); // cache genuine results only (never errors)
      return out;
    } catch (err) {
      lastErr = err;
      await sleep(sleepMs * (attempt + 2));
    }
  }
  throw lastErr || new Error('nominatim failed'); // errors are NOT cached → retried next run
};

export const candidateKey = (c) => c.id || `${c.displayName?.text}|${c.formattedAddress}`;

/**
 * Look up one beach's built place-query against OSM and return the ranked
 * candidates + best match evaluation. Caller passes a fetched-coordinate beach
 * and its region (index.json row). `opts`: { source, radiusMeters, sleepMs }.
 */
export const lookupBeachCandidates = async ({ beach, region, source = 'both', radiusMeters = 3000, sleepMs = 1100 }) => {
  const coordinate = getCoordinate(beach);
  const query = buildPlaceQuery(beach, region);
  const candidates = new Map();
  let overpassFailed = false;

  if ((source === 'overpass' || source === 'both') && coordinate) {
    const osm = await fetchOverpassBeaches(coordinate, radiusMeters);
    if (osm === null) overpassFailed = true;
    else for (const c of osm) candidates.set(candidateKey(c), c);
    await sleep(Math.min(sleepMs, 1100));
  }

  const needNominatim = (source === 'nominatim') || (source === 'both' && candidates.size === 0);
  if (needNominatim && query) {
    // Preserve the historical "swallow errors -> []" contract for this entry point.
    const hits = await fetchNominatim(query, sleepMs).catch(() => []);
    for (const c of hits) candidates.set(candidateKey(c), c);
  }

  const evaluated = [...candidates.values()]
    .map(place => ({ place, evaluation: evaluatePlace({ beach, region, place }) }))
    .sort((a, b) => {
      const rank = { verified: 0, needs_review: 1, rejected: 2 };
      return (rank[a.evaluation.status] - rank[b.evaluation.status]) ||
        (b.evaluation.score - a.evaluation.score) ||
        ((a.evaluation.distanceMeters ?? 999999) - (b.evaluation.distanceMeters ?? 999999));
    });

  return { coordinate, query, evaluated, overpassFailed };
};

// Region-level island token (for "<name>, <island>" forms). Prefers the Cyclades
// alias, else the prefecture/english region name.
const islandToken = (region) => (cycladesIslandAliases.get(region.id)?.[0]) || region.prefecture || region.name?.en;

/**
 * The ladder of free-text queries a geocoder (Google/Nominatim) might resolve a beach by,
 * from the exact app query down to looser forms. We try them in order and keep the best
 * hit. This matters because the app prepends "Παραλία " to the name, which a literal
 * geocoder often can't match even for famous beaches (e.g. "Παραλία Απόλλωνας" → 0 hits,
 * but "Απόλλωνας" or "Apollonas beach" → the right place). A beach only truly FAILS when
 * NONE of these forms resolve near the pin — the genuine Melino class.
 */
export const buildNameQueryLadder = (beach, region) => {
  const island = islandToken(region);
  const gr = (beach.name?.gr || '').trim();
  const en = (beach.name?.en || '').trim();
  const aliases = getBeachAliases(beach);
  const appQuery = buildPlaceQuery(beach, region); // "Παραλία <name>, <island>, Greece"

  const forms = [];
  if (appQuery) forms.push(appQuery);                                  // exact app query
  if (gr && island) forms.push(`${gr}, ${island}`);                    // bare Greek name + island
  if (en && island && normalizeText(en) !== normalizeText(gr)) {
    forms.push(`${en}, ${island}`);                                    // English/latin name + island
    forms.push(`${en} beach, ${island}`);                             // "<en> beach" + island
  }
  for (const alias of aliases) if (island) forms.push(`${alias}, ${island}`);
  return unique(forms);
};

/**
 * Two-signal place resolution for the "does a map find this name?" question.
 *
 *   pin  — best Overpass natural=beach near the pin: is the COORDINATE a real beach?
 *   name — best Nominatim hit across the query ladder: does ANY reasonable form of the
 *          beach's identity resolve to the right spot on the right island? (≈ Google).
 *
 * The Melino class = pin corroborated but NO ladder form resolves near it → route by
 * coordinates. Reuses evaluatePlace so name/island/distance scoring is identical for both.
 * `opts`: { radiusMeters, sleepMs, maxNameQueries }. 1 Overpass + up to N Nominatim calls.
 */
export const resolveBeachName = async ({ beach, region, radiusMeters = 3000, sleepMs = 1100, maxNameQueries = 4, cache }) => {
  const coordinate = getCoordinate(beach);
  const query = buildPlaceQuery(beach, region);

  // Signal 1: pin corroboration (spatial Overpass).
  // fetchers cache internally and sleep themselves on a network call. To keep a fully
  // cached beach fast we sleep here ONLY when the fetcher will actually hit the network —
  // and to avoid double-sleeping we pass sleepMs=0 to the fetcher and own the pacing here.
  const ovpCached = (c) => cache && cache.get(`ovp:${radiusMeters}:${c.lat.toFixed(5)},${c.lon.toFixed(5)}`) !== undefined;
  const nomCached = (q) => cache && cache.get(`nom:${q}`) !== undefined;

  let pin = null;
  let overpassFailed = false;
  if (coordinate) {
    const cached = ovpCached(coordinate);
    const osm = await fetchOverpassBeaches(coordinate, radiusMeters, cache);
    if (osm === null) overpassFailed = true;
    else {
      const ranked = osm
        .map(place => ({ place, evaluation: evaluatePlace({ beach, region, place }) }))
        .sort((a, b) => (a.evaluation.distanceMeters ?? 9e9) - (b.evaluation.distanceMeters ?? 9e9));
      pin = ranked[0] || null;
    }
    if (!cached) await sleep(Math.min(sleepMs, 1100)); // pace only real network calls
  }

  // Signal 2: name resolvability — walk the query ladder, stop early on a 'verified' hit.
  // Track whether every form ERRORED (rate-limit/network) vs genuinely returned nothing,
  // so the caller never reads a throttled run as a FAIL.
  let name = null;
  let nameQuery = null;     // the ladder form that produced the best hit
  let nameQueried = false;  // at least one form returned a definite result (hit or empty)
  let nameError = false;    // every attempted form errored out
  const ladder = buildNameQueryLadder(beach, region).slice(0, maxNameQueries);
  let errorCount = 0;
  for (const form of ladder) {
    let hits;
    const formSleep = nomCached(form) ? 0 : sleepMs; // fetcher sleeps itself only when networking
    try {
      hits = await fetchNominatim(form, formSleep, { cache });
      nameQueried = true;
    } catch {
      errorCount += 1;
      continue; // transient; try the next ladder form
    }
    const ranked = hits
      .map(place => ({ place, evaluation: evaluatePlace({ beach, region, place }) }))
      .sort((a, b) => {
        const rank = { verified: 0, needs_review: 1, rejected: 2 };
        return (rank[a.evaluation.status] - rank[b.evaluation.status]) || (b.evaluation.score - a.evaluation.score);
      });
    const top = ranked[0];
    if (top && (!name || top.evaluation.score > name.evaluation.score)) { name = top; nameQuery = form; }
    if (top && top.evaluation.status === 'verified') break; // good enough; don't burn more calls
  }
  // If we found NO positive hit AND at least one ladder form errored (throttle/network),
  // we cannot conclude the name is unfindable — that form might have been the one that
  // resolves it. Flag nameError so the caller treats it as LOOKUP_ERROR (re-run), never a
  // FAIL. Only a clean sweep (every form returned a definite empty) is a genuine no-hit.
  if (!name && errorCount > 0) nameError = true;

  return { coordinate, query, pin, name, nameQuery, overpassFailed, nameQueried, nameError };
};
