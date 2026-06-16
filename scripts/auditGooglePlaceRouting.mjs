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
 * Results are disk-cached (.tmp/google-places-cache.json, gitignored) so batched/re-runs never
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
const cachePath = path.join(rootDir, '.tmp', 'google-places-cache.json'); // gitignored; re-runs free

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
const BEACHY = new Set(['beach', 'natural_feature']);
// Google sometimes classifies a genuine beach as tourist_attraction/point_of_interest/locality.
// Treat those as beach-like ONLY when the returned NAME says it's a beach ("Παραλία …"/"… Beach")
// — that keeps real beaches (Κάπρος → "Παραλία Κάπρος" [tourist_attraction]) as PASS while still
// catching a true wrong POI (a lodging/cafe/church named after the spot).
const SOFT_BEACHY = new Set(['tourist_attraction', 'point_of_interest', 'locality', 'natural_feature', 'scenic_spot']);
// Business / POI types that mean Google resolved to an ESTABLISHMENT, not the beach itself —
// even if its name contains "Beach" (e.g. "Kamares Beach Bar", "Astir Beach [resort_hotel]").
// Never accept these: routing there sends the user to a bar/hotel, not the sand. Stay coordinates.
const BUSINESS_TYPES = new Set([
  'bar', 'restaurant', 'cafe', 'night_club', 'resort_hotel', 'hotel', 'lodging', 'food',
  'sports_club', 'sports_complex', 'sports_activity_location', 'service', 'store', 'spa', 'gym',
]);
const nameSaysBeach = (name) => /(^|\s)(παραλία|παραλια|beach)(\s|$)|beach$/i.test(String(name || '').trim());
const looksLikeBeach = (place) => {
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  if ([...types].some(t => BUSINESS_TYPES.has(t))) return false; // a business POI, not the beach
  if ([...types].some(t => BEACHY.has(t))) return true;
  if (nameSaysBeach(place.displayName?.text) && [...types].some(t => SOFT_BEACHY.has(t))) return true;
  return false;
};

// Minimal field mask — only what the classifier needs (location/types tier the request, so we
// avoid pulling anything extra). Cache the top result by query so re-runs/batches never re-bill.
const googleSearch = async (query, key, cache) => {
  const cacheKey = `gplace:${query}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return hit; // cached top place (or null)
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.location,places.primaryType,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'el' }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));
  const top = (json.places || [])[0] || null;
  if (cache) cache.set(cacheKey, top); // cache genuine results (incl. null); errors throw and aren't cached
  return top;
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
        // Candidates currently routed by coordinate that we might safely upgrade to a place card.
        if (!isUpgradeCandidate(beach)) continue;
        const query = buildPlaceQuery(beach, region);
        if (query) targets.push({ region, beach, query });
      } else {
        // Original mode: ground-truth the beaches that already emit a NAME query (wrong-POI risk).
        if (isPlaceRouted(nav)) targets.push({ region, beach, query: nav?.query || buildPlaceQuery(beach, region) });
      }
    }
  }
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? targets.slice(0, args.limit) : targets;
  console.log(`${args.upgradeScan ? 'Coordinate-routed upgrade candidates' : 'Place-routed beaches'} to check against Google: ${scoped.length}`);

  const cache = openPlaceCache(cachePath);
  if (cache.size() > 0) console.log(`Google cache: ${cache.size()} entries (reused, no re-bill).`);

  const rows = [];
  let done = 0; let billed = 0;
  for (const { region, beach, query } of scoped) {
    const coord = getCoordinate(beach);
    let status = 'NO_RESULT'; let top = null; let distM = null; let error = null;
    if (query) {
      const wasCached = cache.get(`gplace:${query}`) !== undefined;
      try {
        const p = await googleSearch(query, key, cache);
        if (!wasCached) { billed += 1; await sleep(args.sleepMs); } // pace only real network calls
        if (p) {
          const loc = { lat: p.location.latitude, lon: p.location.longitude };
          distM = coord ? Math.round(distanceMeters(coord, loc)) : null;
          const isBeachy = looksLikeBeach(p);
          top = { name: p.displayName?.text, primaryType: p.primaryType, types: p.types, loc };
          if (!Number.isFinite(distM)) status = 'NO_RESULT';
          else if (isBeachy && distM <= args.far) status = 'PASS';        // a beach at/near the pin
          else if (!isBeachy && distM <= args.far) status = 'WRONG_TYPE'; // a non-beach POI nearby
          else status = 'WRONG_PLACE';                                    // anything far away
        }
      } catch (e) { error = String(e.message || e); status = 'API_ERROR'; }
    }
    rows.push({ id: beach.id, name: getBeachName(beach), regionId: region.id, island: region.prefecture, query, coordinate: coord, status, distM, top, error });
    if (++done % 25 === 0) { cache.flush(); process.stderr.write(`...${done}/${scoped.length} (billed ~${billed})\n`); }
  }
  cache.flush();

  await mkdir(outDir, { recursive: true });
  const fullName = args.upgradeScan ? 'google-upgrade.json' : 'google-routing.json';
  const fixName = args.upgradeScan ? 'google-upgrade-fixes.json' : 'google-routing-fixes.json';
  await writeFile(path.join(outDir, fullName), JSON.stringify(rows, null, 1), 'utf8');

  let fixes;
  if (args.upgradeScan) {
    // UPGRADE: only PASS rows get a place query (the Google beach card). Everything else stays
    // coordinate-routed exactly as it is — no change, no risk.
    fixes = rows.filter(r => r.status === 'PASS' && r.coordinate && r.query).map(r => ({
      id: r.id, name: r.name, lat: r.coordinate.lat, lon: r.coordinate.lon,
      navMode: 'place', status: 'verified', query: r.query,
      why: `Google ground-truth ${date}: query "${r.query}" resolves to this beach on Google Maps (${r.top?.name || ''}, ${r.distM} m from the pin) — upgrade to a place query for the Google beach card.`,
    }));
    // Visibility: the non-PASS candidates that stay on coordinates and why.
    const skipped = rows.filter(r => r.status !== 'PASS');
    const csv = ['id,name,island,status,distM,googleResult,googleType,query'];
    for (const r of skipped) csv.push([r.id, r.name, r.island, r.status, r.distM ?? '', r.top?.name ?? '', r.top?.primaryType ?? '', r.query].map(v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(','));
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
  console.log(`Billed (new Google calls this run): ~${billed}`);
  console.log(`${args.upgradeScan ? 'Upgrades -> place' : 'Fixes -> coordinates'}: ${fixes.length}`);
  console.log(`Wrote reports/place-resolution/${fullName} and ${fixName}${args.upgradeScan ? ' and google-upgrade-skipped.csv' : ''}`);
};

run().catch(err => { console.error(err); process.exit(1); });
