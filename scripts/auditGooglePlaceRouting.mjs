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
 * Read-only on beach data. Emits reports/place-resolution/google-routing.json (full) and
 * google-routing-fixes.json (applyNavigationAudit --apply-status rows): WRONG_TYPE / WRONG_PLACE
 * / NO_RESULT → coordinates. Apply separately after review. Needs GOOGLE_PLACES_API_KEY.
 *
 * Usage: node scripts/auditGooglePlaceRouting.mjs [--region=ID] [--island=NAME] [--limit=N]
 *                                                 [--near=400] [--far=1500] [--sleep-ms=300]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBeachName, getCoordinate, buildPlaceQuery, distanceMeters } from './lib/placeResolution.mjs';
import { TOURISTIC_TIER } from './lib/touristicTier.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');

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

const args = { regions: [], islands: [], limit: undefined, near: 400, far: 1500, sleepMs: 300 };
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--region=')) args.regions.push(a.slice(9).trim().toLowerCase());
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
const SOFT_BEACHY = new Set(['tourist_attraction', 'point_of_interest', 'locality', 'natural_feature']);
const nameSaysBeach = (name) => /(^|\s)(παραλία|παραλια|beach)(\s|$)|beach$/i.test(String(name || '').trim());
const looksLikeBeach = (place) => {
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  if ([...types].some(t => BEACHY.has(t))) return true;
  if (nameSaysBeach(place.displayName?.text) && [...types].some(t => SOFT_BEACHY.has(t))) return true;
  return false;
};

const googleSearch = async (query, key) => {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.primaryType,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'el' }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));
  return (json.places || [])[0] || null;
};

const run = async () => {
  const key = readKey();
  if (!key) { console.error('Missing GOOGLE_PLACES_API_KEY (env or .env.local).'); process.exit(1); }

  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const wantRegion = (r) => {
    if (args.regions.length) return args.regions.includes(r.id.toLowerCase());
    if (args.islands.length) return args.islands.some(i => r.id.toLowerCase().includes(i) || String(r.prefecture || '').toLowerCase() === i);
    return TOURISTIC_TIER.includes(r.id);
  };

  const targets = [];
  for (const region of index.regions) {
    if (!wantRegion(region)) continue;
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data; try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    const beaches = Array.isArray(data) ? data : (data?.island?.beaches || []);
    for (const beach of beaches) {
      const nav = beach?.metadata?.googleMapsNavigation;
      // In scope: beaches that route by PLACE (explicit query, or verified place mode). These are
      // the ones a user resolves by NAME on Google — exactly where a wrong POI would bite.
      const placeRouted = nav?.status === 'verified' && (nav?.query || nav?.mode === 'place' || nav?.mode === undefined) && nav?.mode !== 'coordinates';
      if (placeRouted) targets.push({ region, beach, query: nav?.query || buildPlaceQuery(beach, region) });
    }
  }
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? targets.slice(0, args.limit) : targets;
  console.log(`Place-routed beaches to ground-truth against Google: ${scoped.length}`);

  const rows = [];
  let done = 0;
  for (const { region, beach, query } of scoped) {
    const coord = getCoordinate(beach);
    let status = 'NO_RESULT'; let top = null; let distM = null; let error = null;
    if (query) {
      try {
        const p = await googleSearch(query, key);
        await sleep(args.sleepMs);
        if (p) {
          const loc = { lat: p.location.latitude, lon: p.location.longitude };
          distM = coord ? Math.round(distanceMeters(coord, loc)) : null;
          const isBeachy = looksLikeBeach(p);
          top = { name: p.displayName?.text, primaryType: p.primaryType, types: p.types, loc };
          if (!Number.isFinite(distM)) status = 'NO_RESULT';
          else if (isBeachy && distM <= args.far) status = 'PASS';      // a beach at/near the pin
          else if (!isBeachy && distM <= args.far) status = 'WRONG_TYPE'; // a non-beach POI nearby
          else status = 'WRONG_PLACE';                                    // anything far away
        }
      } catch (e) { error = String(e.message || e); status = 'API_ERROR'; }
    }
    rows.push({ id: beach.id, name: getBeachName(beach), regionId: region.id, island: region.prefecture, query, coordinate: coord, status, distM, top, error });
    if (++done % 20 === 0) process.stderr.write(`...${done}/${scoped.length}\n`);
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'google-routing.json'), JSON.stringify(rows, null, 1), 'utf8');

  // Fix rows: anything that is NOT a clean PASS (and not an API error) should route by the pin.
  const fixes = rows.filter(r => ['WRONG_TYPE', 'WRONG_PLACE', 'NO_RESULT'].includes(r.status) && r.coordinate).map(r => ({
    id: r.id, name: r.name, lat: r.coordinate.lat, lon: r.coordinate.lon,
    navMode: 'coordinates', status: 'verified',
    why: `Google ground-truth ${date}: place query "${r.query}" returned ${r.status === 'WRONG_TYPE' ? `a non-beach (${r.top?.primaryType}) ${r.distM} m away` : r.status === 'WRONG_PLACE' ? `a result ${r.distM} m from the pin` : 'no result'} on Google Maps — route by coordinate pin instead.`,
  }));
  await writeFile(path.join(outDir, 'google-routing-fixes.json'), JSON.stringify(fixes, null, 1), 'utf8');

  const byStatus = rows.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  console.log('Status:', JSON.stringify(byStatus));
  console.log(`Fixes -> coordinates: ${fixes.length}`);
  console.log('Wrote reports/place-resolution/google-routing.json and google-routing-fixes.json');
};

run().catch(err => { console.error(err); process.exit(1); });
