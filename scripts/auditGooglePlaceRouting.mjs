/**
 * Ground-truth check of PLACE-routed beaches against the REAL Google Maps geocoder.
 *
 * Our place-resolution audit verified queries with Nominatim/OSM, but the user opens Google
 * Maps — and the two disagree (e.g. "Γερανιά, Milos" → the beach on OSM but a *lodging* on
 * Google; a query can also land on a cafe/landmark). This script sends the EXACT query each
 * beach currently ships (metadata.googleMapsNavigation.query, else the built place query) to
 * Google Places Text Search and judges the top result the way a user experiences it:
 *
 *   PASS         : top result is a beach/natural_feature within NEAR_M of the pin.
 *   WRONG_TYPE   : a result near the pin but NOT a beach (lodging/cafe/restaurant/...) —
 *                  the Gerania class; should route by coordinates instead.
 *   WRONG_PLACE  : result is a beach but FAR from the pin (>FAR_M) — wrong location.
 *   NO_RESULT    : Google returns nothing — coordinates is the safe choice.
 *
 * Two modes:
 *   (default)        ground-truth beaches that ALREADY emit a name query (touristic tier, or
 *                    --region/--island/--all-regions). Demotes non-PASS back to coordinates.
 *                    → google-routing.json + google-routing-fixes.json (navMode coordinates).
 *   --upgrade-scan   re-check COORDINATE-routed candidates (verified+coordinates, no-nav, or
 *                    low-conf) across all of Greece and UPGRADE only the clean PASS to an explicit
 *                    place query (the Google beach card). Non-PASS stay on coordinates untouched.
 *                    → google-upgrade.json + google-upgrade-fixes.json (navMode place, with query)
 *                      + google-upgrade-skipped.csv (the ones left on coordinates, for visibility).
 *
 * Results are disk-cached (data/places-cache/google-places-cache.json, committed) so batched/re-runs never
 * re-bill. Minimal field mask keeps requests in the cheap tier. Needs GOOGLE_PLACES_API_KEY.
 * Read-only on beach data — apply fixes separately via scripts/applyNavigationAudit.mjs.
 *
 * Usage: node scripts/auditGooglePlaceRouting.mjs [--upgrade-scan] [--all-regions]
 *          [--region=ID] [--island=NAME] [--limit=N] [--near=400] [--far=1500] [--sleep-ms=300]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBeachName, getCoordinate, buildPlaceQuery, distanceMeters, openPlaceCache } from './lib/placeResolution.mjs';
import { TOURISTIC_TIER } from './lib/touristicTier.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');
const cachePath = path.join(rootDir, 'data', 'places-cache', 'google-places-cache.json'); // committed cache so re-runs never re-bill

// API key: env or .env.local (same precedence as the other audit scripts).
const readKey = () => {
  for (const k of ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY']) {
    if (process.env[k]) return process.env[k].trim();
  }
  try {
    const env = readFileSync(path.join(rootDir, '.env.local'), 'utf8');
    const m = env.match(/^(?:GOOGLE_PLACES_API_KEY|GOOGLE_MAPS_API_KEY|GOOGLE_API_KEY)=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* none */ }
  return undefined;
};

const args = { regions: [], islands: [], limit: undefined, near: 400, far: 1500, sleepMs: 300, upgradeScan: false, allRegions: false };
for (const a of process.argv.slice(2)) {
  if (a === '--upgrade-scan') args.upgradeScan = true;       // re-evaluate coordinate-routed candidates for a safe place upgrade
  else if (a === '--all-regions') args.allRegions = true;    // scan every region in index.json (not just the touristic tier)
  else if (a.startsWith('--region=')) args.regions.push(a.slice(9).trim().toLowerCase());
  else if (a.startsWith('--island=')) args.islands.push(a.slice(9).trim().toLowerCase());
  else if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.slice(8), 10);
  else if (a.startsWith('--near=')) args.near = Number.parseInt(a.slice(7), 10);
  else if (a.startsWith('--far=')) args.far = Number.parseInt(a.slice(6), 10);
  else if (a.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(a.slice(11), 10);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const date = new Date().toISOString().slice(0, 10);
// `beach` is the only Google type that means "this is a beach". `natural_feature` is NOT enough on
// its own — lakes, capes, mountains, rivers all carry it (e.g. the lake "Αχιβαδόλιμνη" is
// [lake, natural_feature]). So natural_feature only counts when the NAME also says beach.
const BEACHY = new Set(['beach']);
// Types Google sometimes uses for a genuine beach — accept ONLY when the name says "Παραλία/Beach"
// (keeps "Παραλία Κάπρος" [tourist_attraction] as a beach, rejects a lake/landmark of the same name).
const SOFT_BEACHY = new Set(['tourist_attraction', 'point_of_interest', 'locality', 'natural_feature', 'scenic_spot']);
// Non-beach natural features that must never be accepted even if the name contains "beach".
const NON_BEACH_FEATURE = new Set(['lake', 'river', 'mountain', 'mountain_peak', 'plateau', 'volcano', 'cape']);
// Business / POI types that mean Google resolved to an ESTABLISHMENT, not the beach itself —
// even if its name contains "Beach" (e.g. "Kamares Beach Bar", "Astir Beach [resort_hotel]").
// Never accept these: routing there sends the user to a bar/hotel, not the sand. Stay coordinates.
const BUSINESS_TYPES = new Set([
  'bar', 'restaurant', 'cafe', 'night_club', 'resort_hotel', 'hotel', 'lodging', 'food',
  'sports_club', 'sports_complex', 'sports_activity_location', 'service', 'store', 'spa', 'gym',
  'banquet_hall', 'event_venue', 'bus_stop', 'transit_station', 'transportation_service',
  'parking', 'travel_agency', 'real_estate_agency',
]);
const nameSaysBeach = (name) => /(^|\s)(παραλία|παραλια|beach)(\s|$)|beach$/i.test(String(name || '').trim());
const looksLikeBeach = (place) => {
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  if ([...types].some(t => BUSINESS_TYPES.has(t))) return false;      // a business POI, not the beach
  if ([...types].some(t => NON_BEACH_FEATURE.has(t))) return false;   // a lake/cape/etc, not the beach
  if (place.primaryType === 'beach' || types.has('beach')) return true;
  if (nameSaysBeach(place.displayName?.text) && [...types].some(t => SOFT_BEACHY.has(t))) return true;
  return false;
};

// One raw Text Search call — returns ALL candidate places (not just the top). Field mask includes
// places.id (the Place ID we ship for reliable query_place_id routing); location/types tier the
// request at Pro, so id is free to add.
const googleSearchOnce = async (query, key) => {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'el' }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));
  return json.places || [];
};

// Pick the BEST candidate for a beach pin from a Google result list: the nearest actual beach
// within `far` of the pin. This rescues ambiguous names where the top result is a different place
// of the same name (e.g. "Αχιβαδολίμνη" → the lake is often #1, but "Παραλία Αχιβαδόλιμνη" [beach]
// is also returned). Falls back to the nearest result of any type if no beach is in range.
const pickBeachCandidate = (places, coord, far) => {
  if (!places || !places.length) return null;
  const withDist = places.map(p => ({
    p,
    distM: coord && p.location ? Math.round(distanceMeters(coord, { lat: p.location.latitude, lon: p.location.longitude })) : null,
  }));
  const beaches = withDist
    .filter(x => looksLikeBeach(x.p) && Number.isFinite(x.distM) && x.distM <= far)
    .sort((a, b) => a.distM - b.distM);
  if (beaches.length) return beaches[0];
  return withDist.slice().sort((a, b) => (a.distM ?? 9e9) - (b.distM ?? 9e9))[0] || null;
};

// STABILITY GATE: the Places API is non-deterministic / returns ambiguous lists, so we must not
// ship an unstable result. We try a short ladder of query forms (the bare app query, then a
// "Παραλία <name>" variant to surface a beach when the bare name resolves to a lake/landmark of the
// same name, e.g. Αχιβαδόλιμνη). The FIRST form that yields a beach near the pin is then verified
// TWICE — trustworthy only when both calls return the SAME beach Place ID. Returns
// { place, distM, stable, query }. Cached (keyed gp4:) so re-runs are free.
const callBilledRef = { n: 0 };
const googleSearchStable = async (queries, key, cache, sleepMs, coord, far) => {
  const cacheKey = `gp4:${queries.join('|')}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit;
  }
  let result = { place: null, distM: null, stable: false, query: queries[0] };
  for (const q of queries) {
    const listA = await googleSearchOnce(q, key); callBilledRef.n += 1;
    await sleep(Math.max(sleepMs, 250));
    const a = pickBeachCandidate(listA, coord, far);
    const aIsBeach = a && looksLikeBeach(a.p) && Number.isFinite(a.distM) && a.distM <= far;
    if (!aIsBeach) {
      // keep the nearest non-beach as a fallback record but try the next ladder form
      if (!result.place) result = { place: a?.p || null, distM: a?.distM ?? null, stable: false, query: q };
      continue;
    }
    const listB = await googleSearchOnce(q, key); callBilledRef.n += 1;
    await sleep(Math.max(sleepMs, 250));
    const b = pickBeachCandidate(listB, coord, far);
    const stable = Boolean(a.p.id && b?.p?.id && a.p.id === b.p.id);
    result = { place: a.p, distM: a.distM, stable, query: q };
    if (stable) break; // good enough; don't burn more ladder forms
  }
  if (cache) cache.set(cacheKey, result);
  return result;
};

// Is this beach currently a NAME/place-routed beach (the original audit scope: at risk of a wrong
// POI)? — explicit query, or verified place mode, but not coordinate mode.
const isPlaceRouted = (nav) => nav?.status === 'verified' && (nav?.query || nav?.mode === 'place' || nav?.mode === undefined) && nav?.mode !== 'coordinates';

// Is this beach currently COORDINATE-routed and therefore an upgrade candidate? Under the
// coordinate-first policy that's: verified+coordinates, no googleMapsNavigation at all, or
// low-confidence (those route by pin). Boat-only/blocked are excluded by the caller.
const isUpgradeCandidate = (beach) => {
  const nav = beach?.metadata?.googleMapsNavigation;
  if (nav?.query) return false;                       // already an explicit place query
  if (nav?.status === 'verified' && nav?.mode === 'coordinates') return true;
  if (nav?.status === 'needs-review') return false;   // intentionally degraded; leave alone
  if (nav?.status === 'blocked' || nav?.status === 'unresolved') return false;
  if (!nav) return true;                               // default/no-nav -> coordinate-routed
  if (beach?.metadata?.confidence === 'low') return true;
  return false;
};
const isBoatOnly = (beach) => {
  const t = String(beach?.metadata?.access?.type || '');
  return t === 'boat_only' || t === 'boat_or_difficult_path' || beach?.accessibility === 'BOAT_ONLY';
};

const run = async () => {
  const key = readKey();
  if (!key) { console.error('Missing GOOGLE_PLACES_API_KEY (env or .env.local).'); process.exit(1); }

  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const wantRegion = (r) => {
    if (args.regions.length) return args.regions.includes(r.id.toLowerCase());
    if (args.islands.length) return args.islands.some(i => r.id.toLowerCase().includes(i) || String(r.prefecture || '').toLowerCase() === i);
    if (args.allRegions || args.upgradeScan) return true; // upgrade scan defaults to all of Greece
    return TOURISTIC_TIER.includes(r.id);
  };

  const targets = [];
  for (const region of index.regions) {
    if (!wantRegion(region)) continue;
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data; try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    const beaches = Array.isArray(data) ? data : (data?.island?.beaches || []);
    for (const beach of beaches) {
      if (isBoatOnly(beach)) continue;
      const nav = beach?.metadata?.googleMapsNavigation;
      if (args.upgradeScan) {
        // Nationwide reliability pass: EVERY beach with a pin + a name is (re)checked — both the
        // coordinate-routed candidates AND the ones already place-routed (whose name queries we no
        // longer trust). They all get re-decided as Place-ID-or-coordinate.
        if (!getCoordinate(beach)) continue;
        const query = buildPlaceQuery(beach, region);
        if (query) targets.push({ region, beach, query });
      } else {
        // Original mode: ground-truth the beaches that already emit a NAME query (wrong-POI risk).
        if (isPlaceRouted(nav)) targets.push({ region, beach, query: nav?.query || buildPlaceQuery(beach, region) });
      }
    }
  }
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? targets.slice(0, args.limit) : targets;
  console.log(`${args.upgradeScan ? 'Beaches to (re)check for Place-ID routing' : 'Place-routed beaches'} to check against Google: ${scoped.length}`);

  const cache = openPlaceCache(cachePath);
  if (cache.size() > 0) console.log(`Google cache: ${cache.size()} entries (reused, no re-bill).`);

  // Query ladder: the bare app query, then a "Παραλία <name>" variant (and its mirror) that
  // surfaces the BEACH when the bare name resolves to a same-named lake/landmark (Αχιβαδόλιμνη).
  const buildQueryLadder = (beach, region) => {
    const base = buildPlaceQuery(beach, region); // "<name>, <island>, Greece"
    if (!base) return [];
    const gr = (beach.name?.gr || '').trim();
    const ladder = [base];
    if (gr && !/^παραλ/i.test(gr)) {
      // insert "Παραλία " in front of the name part of the base query
      const idx = base.indexOf(',');
      const withPrefix = idx > 0 ? `Παραλία ${base.slice(0, idx)}${base.slice(idx)}` : `Παραλία ${base}`;
      ladder.push(withPrefix);
    }
    return [...new Set(ladder)];
  };

  const rows = [];
  let done = 0;
  for (const { region, beach } of scoped) {
    const coord = getCoordinate(beach);
    const ladder = buildQueryLadder(beach, region);
    let status = 'NO_RESULT'; let top = null; let distM = null; let error = null; let placeId = null; let stable = false; let query = ladder[0] || null;
    if (ladder.length) {
      const wasCached = cache.get(`gp4:${ladder.join('|')}`) !== undefined;
      try {
        const before = callBilledRef.n;
        const { place: p, distM: d, stable: isStable, query: usedQ } = await googleSearchStable(ladder, key, cache, args.sleepMs, coord, args.far);
        query = usedQ;
        if (!wasCached) await sleep(args.sleepMs);
        void before;
        stable = isStable;
        if (p) {
          distM = d;
          const isBeachy = looksLikeBeach(p);
          placeId = p.id || null;
          top = { name: p.displayName?.text, primaryType: p.primaryType, types: p.types, loc: p.location ? { lat: p.location.latitude, lon: p.location.longitude } : null };
          // PASS requires: a real beach, near the pin, a stable Place ID across both calls.
          if (!Number.isFinite(distM)) status = 'NO_RESULT';
          else if (isBeachy && distM <= args.far && stable && placeId) status = 'PASS';
          else if (isBeachy && distM <= args.far && !(stable && placeId)) status = 'UNSTABLE';
          else if (!isBeachy && distM <= args.far) status = 'WRONG_TYPE';
          else status = 'WRONG_PLACE';
        }
      } catch (e) { error = String(e.message || e); status = 'API_ERROR'; }
    }
    rows.push({ id: beach.id, name: getBeachName(beach), regionId: region.id, island: region.prefecture, query, coordinate: coord, status, distM, placeId, stable, top, error, currentlyPlaceRouted: isPlaceRouted(beach?.metadata?.googleMapsNavigation) });
    if (++done % 25 === 0) { cache.flush(); process.stderr.write(`...${done}/${scoped.length} (Google calls ~${callBilledRef.n})\n`); }
  }
  cache.flush();

  await mkdir(outDir, { recursive: true });
  const fullName = args.upgradeScan ? 'google-upgrade.json' : 'google-routing.json';
  const fixName = args.upgradeScan ? 'google-upgrade-fixes.json' : 'google-routing-fixes.json';
  await writeFile(path.join(outDir, fullName), JSON.stringify(rows, null, 1), 'utf8');

  let fixes;
  if (args.upgradeScan) {
    // Reliability pass — EVERY scanned beach gets an explicit, trustworthy decision so no bare
    // name query survives:
    //   PASS (stable beach Place ID near pin) -> place routing WITH placeId (exact Google card).
    //   everything else                       -> coordinates (always the exact pin).
    // Re-validate the stored top against the CURRENT looksLikeBeach (catches types newly added to
    // the reject list — e.g. banquet_hall/bus_stop — without re-billing the cached scan).
    const passFixes = rows.filter(r => r.status === 'PASS' && r.coordinate && r.placeId
      && r.top && looksLikeBeach({ primaryType: r.top.primaryType, types: r.top.types, displayName: { text: r.top.name } })
    ).map(r => ({
      id: r.id, name: r.name, lat: r.coordinate.lat, lon: r.coordinate.lon,
      navMode: 'place', status: 'verified', query: r.query, placeId: r.placeId,
      why: `Google ground-truth ${date}: stable Place ID ${r.placeId} (${r.top?.name || ''}, ${r.distM} m from the pin) — route to the exact Google card via query_place_id.`,
    }));
    // Demote any beach that is CURRENTLY place-routed but is NOT in the upgraded set — these are the
    // unreliable name queries (the Νεροδάφνη class) or re-rejected types (banquet_hall/bus_stop).
    // Force them to coordinates (exact pin) so no bare/wrong place query survives.
    const upgradedIds = new Set(passFixes.map(f => f.id));
    const demoteFixes = rows.filter(r => r.coordinate && r.currentlyPlaceRouted && !upgradedIds.has(r.id)).map(r => ({
      id: r.id, name: r.name, lat: r.coordinate.lat, lon: r.coordinate.lon,
      navMode: 'coordinates', status: 'verified',
      why: `Google ground-truth ${date}: query "${r.query}" did not yield a stable beach Place ID on Google (${r.status}${r.top ? `, got ${r.top.name} [${r.top.primaryType}]` : ''}) — route by coordinate pin to avoid a wrong/failed Maps result.`,
    }));
    fixes = [...passFixes, ...demoteFixes];
    // Visibility CSV of everything NOT upgraded.
    const skipped = rows.filter(r => r.status !== 'PASS');
    const csv = ['id,name,island,status,distM,stable,googleResult,googleType,placeId,query'];
    for (const r of skipped) csv.push([r.id, r.name, r.island, r.status, r.distM ?? '', r.stable, r.top?.name ?? '', r.top?.primaryType ?? '', r.placeId ?? '', r.query].map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','));
    await writeFile(path.join(outDir, 'google-upgrade-skipped.csv'), csv.join('\n'), 'utf8');
  } else {
    // Original mode: demote anything that is NOT a clean PASS back to the pin.
    fixes = rows.filter(r => ['WRONG_TYPE', 'WRONG_PLACE', 'NO_RESULT'].includes(r.status) && r.coordinate).map(r => ({
      id: r.id, name: r.name, lat: r.coordinate.lat, lon: r.coordinate.lon,
      navMode: 'coordinates', status: 'verified',
      why: `Google ground-truth ${date}: place query "${r.query}" returned ${r.status === 'WRONG_TYPE' ? `a non-beach (${r.top?.primaryType}) ${r.distM} m away` : r.status === 'WRONG_PLACE' ? `a result ${r.distM} m from the pin` : 'no result'} on Google Maps — route by coordinate pin instead.`,
    }));
  }
  await writeFile(path.join(outDir, fixName), JSON.stringify(fixes, null, 1), 'utf8');

  const byStatus = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  console.log('Status:', JSON.stringify(byStatus));
  console.log(`Billed (new Google calls this run): ~${callBilledRef.n}`);
  if (args.upgradeScan) {
    const toPlace = fixes.filter(f => f.navMode === 'place').length;
    console.log(`Fixes: ${toPlace} -> Place-ID place routing, ${fixes.length - toPlace} -> coordinates (demoted unreliable name queries)`);
  } else {
    console.log(`Fixes -> coordinates: ${fixes.length}`);
  }
  console.log(`Wrote reports/place-resolution/${fullName} and ${fixName}${args.upgradeScan ? ' and google-upgrade-skipped.csv' : ''}`);
};

run().catch(err => { console.error(err); process.exit(1); });
