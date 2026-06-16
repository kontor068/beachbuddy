/**
 * Reclaim PLACE routing for beaches stuck on coordinates because OUR stored name doesn't
 * geocode — by adopting the name OSM already has AT THE PIN.
 *
 * Many coordinate-routed beaches fail only because our dataset name is greeklish/English or a
 * generic local label (e.g. "Dimotiki Plaz 1") while OSM tags the very same spot with a proper
 * Greek name ("Δημοτική Πλαζ 1") that a geocoder DOES resolve. Since the pin is trusted, the
 * OSM feature sitting on it is authoritative for the name.
 *
 * For each coordinate-routed beach (no explicit query) we:
 *   1. Overpass: nearest NAMED natural=beach within NEAR_M of the pin (skip "(unnamed)" and
 *      obvious non-beach POIs the audit already filters out — only natural=beach is queried).
 *   2. Confirm that OSM name is geocodable: Nominatim "<osmName>, <island>" must return a hit
 *      within VERIFY_M of the pin on the right island (no wrong-island signal).
 *   3. If so, propose an explicit verified query "<osmName>, <island>" (place routing, Google
 *      card). Otherwise leave it on coordinates.
 *
 * Read-only. Emits reports/place-resolution/name-resolve.json (full, with decisions) and
 * reports/place-resolution/name-fixes.json (applyNavigationAudit --apply-status rows carrying
 * `query`). Apply separately after review. Conservative: anything not clearly the same place
 * stays on coordinates (never sends a user to the wrong spot).
 *
 * Usage: node scripts/resolveCoordinateRoutedNames.mjs [--region=ID] [--near=120] [--verify=300] [--limit=N] [--sleep-ms=1300]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBeachName, getCoordinate, fetchOverpassBeaches, fetchNominatim, evaluatePlace,
  hasWrongIslandSignal, distanceMeters, normalizeText, sleep, openPlaceCache,
} from './lib/placeResolution.mjs';
import { TOURISTIC_TIER } from './lib/touristicTier.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');
const cachePath = path.join(rootDir, '.tmp', 'place-resolution-cache.json');

const args = { regions: [], near: 120, verify: 300, limit: undefined, sleepMs: 1300 };
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--region=')) args.regions.push(a.slice(9).trim().toLowerCase());
  else if (a.startsWith('--near=')) args.near = Number.parseInt(a.slice(7), 10);
  else if (a.startsWith('--verify=')) args.verify = Number.parseInt(a.slice(9), 10);
  else if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.slice(8), 10);
  else if (a.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(a.slice(11), 10);
}

const date = new Date().toISOString().slice(0, 10);
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
const islandToken = (region) => cleanRegionToken(region.prefecture || region.name?.en)[0] || region.name?.en || '';

// A usable OSM name: present, not the unnamed placeholder, an actual place NAME (not a POI like
// a bar/hotel, and not a generic description the geocoder can't resolve to this spot). Reject:
//   - bar/restaurant/cafe/hotel/club/resort POIs
//   - generic descriptions with no proper name: "Beach", "unorganized beach", "sandy beach",
//     "public beach", etc. (English generic-only labels). A name with a real toponym is fine
//     even if it ends in "beach" (e.g. "Pyrgaki Beach").
const NON_BEACH_NAME = /\b(bar|restaurant|cafe|caf[eé]|hotel|taverna|beach bar|club|resort)\b/i;
const GENERIC_ONLY = /^(the\s+)?(un)?organized\s+beach$|^(small|big|public|private|sandy|pebble|nudist|nude|main|municipal)?\s*beach$/i;
const isUsableOsmName = (name) => {
  const t = (name || '').trim();
  if (!t || t === '(unnamed)') return false;
  if (NON_BEACH_NAME.test(t)) return false;
  if (GENERIC_ONLY.test(t)) return false; // pure description, no toponym
  return true;
};

const run = async () => {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const wantRegion = (r) => args.regions.length === 0
    ? TOURISTIC_TIER.includes(r.id)
    : args.regions.includes(r.id.toLowerCase());

  const targets = [];
  for (const region of index.regions) {
    if (!wantRegion(region)) continue;
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data;
    try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    const beaches = Array.isArray(data) ? data : (data?.island?.beaches || []);
    for (const beach of beaches) {
      const nav = beach?.metadata?.googleMapsNavigation;
      if (nav?.status === 'verified' && nav?.mode === 'coordinates' && !nav?.query) {
        targets.push({ region, beach });
      }
    }
  }
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? targets.slice(0, args.limit) : targets;
  console.log(`Coordinate-routed candidates: ${scoped.length}`);

  const cache = openPlaceCache(cachePath);
  const rows = [];
  let done = 0;
  for (const { region, beach } of scoped) {
    const coord = getCoordinate(beach);
    const island = islandToken(region);
    let decision = 'keep-coordinates';
    let osmName = null; let verifyHit = null; let proposedQuery = null;

    if (coord) {
      // 1) nearest usable named OSM beach on the pin
      const osm = await fetchOverpassBeaches(coord, Math.max(args.near, 60), cache).catch(() => null);
      const named = (osm || [])
        .filter(c => isUsableOsmName(c.displayName?.text) && c.location)
        .map(c => ({ c, d: distanceMeters(coord, { lat: c.location.latitude, lon: c.location.longitude }) }))
        .filter(x => Number.isFinite(x.d) && x.d <= args.near)
        .sort((a, b) => a.d - b.d);
      if (named.length) osmName = named[0].c.displayName.text;

      // 2) verify that OSM name geocodes back to the pin on the right island
      if (osmName && island) {
        const q = `${osmName}, ${island}`;
        const hits = await fetchNominatim(q, args.sleepMs, { cache }).catch(() => []);
        const ranked = hits
          .map(place => ({ place, evaluation: evaluatePlace({ beach, region, place }) }))
          .sort((a, b) => (a.evaluation.distanceMeters ?? 9e9) - (b.evaluation.distanceMeters ?? 9e9));
        const top = ranked[0];
        if (top && Number.isFinite(top.evaluation.distanceMeters) && top.evaluation.distanceMeters <= args.verify
            && !hasWrongIslandSignal(region, top.place)) {
          verifyHit = { name: top.place.displayName?.text, distM: top.evaluation.distanceMeters };
          // Only adopt if the OSM name differs from our (failing) stored name — else no point.
          if (normalizeText(osmName) !== normalizeText(getBeachName(beach))) {
            proposedQuery = q;
            decision = 'adopt-osm-name';
          } else {
            decision = 'name-already-matches'; // our name == OSM name yet still failed; leave it
          }
        }
      }
    }

    rows.push({
      id: beach.id, name: getBeachName(beach), regionId: region.id, island,
      coordinate: coord, osmName, verifyHit, proposedQuery, decision,
    });
    if (++done % 10 === 0) { cache.flush(); process.stderr.write(`...${done}/${scoped.length}\n`); }
  }
  cache.flush();

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'name-resolve.json'), JSON.stringify(rows, null, 1), 'utf8');

  const fixes = rows.filter(r => r.decision === 'adopt-osm-name').map(r => ({
    id: r.id, name: r.name, lat: r.coordinate?.lat, lon: r.coordinate?.lon,
    navMode: 'place', status: 'verified', query: r.proposedQuery,
    why: `Name resolve ${date}: stored name "${r.name}" did not geocode, but OSM tags this pin as "${r.osmName}" which resolves to the spot (${r.verifyHit.distM} m, right island). Route by the verified place query for the Google beach card.`,
  }));
  await writeFile(path.join(outDir, 'name-fixes.json'), JSON.stringify(fixes, null, 1), 'utf8');

  const byDecision = rows.reduce((a, r) => { a[r.decision] = (a[r.decision] || 0) + 1; return a; }, {});
  console.log('Decisions:', JSON.stringify(byDecision));
  console.log(`Adopt OSM name -> place: ${fixes.length}`);
  console.log('Wrote reports/place-resolution/name-resolve.json and name-fixes.json');
};

run().catch(err => { console.error(err); process.exit(1); });
