/**
 * Targeted re-check of beaches that an earlier nav-audit routed by COORDINATE due to a
 * "name-collision risk" (the same beach name exists on several islands, so a place query
 * could land on the wrong island). With today's prefix-free, island-qualified queries the
 * risk is often gone — "Λαγκάδα, Milos" resolves to the Milos beach, not another island.
 *
 * For each collision-flagged beach we run the SAME query the app now sends and only clear it
 * for place-routing when the geocoder hit is UNAMBIGUOUSLY this beach:
 *   - within SAFE_DIST_M of the pin, AND
 *   - the result's island matches (no wrong-island signal).
 * Conservative: anything that doesn't clearly resolve to THIS spot stays on coordinates.
 *
 * Read-only. Emits reports/place-resolution/collision-recheck.json (full) and
 * reports/place-resolution/collision-flips.json (applyNavigationAudit --apply-status rows,
 * place-mode) for the ones that are safe to flip. Apply separately after review.
 *
 * Usage: node scripts/verifyCollisionBeaches.mjs [--sleep-ms=1300] [--dist=2000] [--limit=N]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBeachName, getCoordinate, buildPlaceQuery, resolveBeachName,
  hasWrongIslandSignal, openPlaceCache,
} from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');
const cachePath = path.join(rootDir, '.tmp', 'place-resolution-cache.json');

const args = { sleepMs: 1300, dist: 2000, limit: undefined };
for (const a of process.argv.slice(2)) {
  if (a.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(a.slice(11), 10);
  else if (a.startsWith('--dist=')) args.dist = Number.parseInt(a.slice(7), 10);
  else if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.slice(8), 10);
}

const COLLISION_RE = /collision|cross-island/i;
const date = new Date().toISOString().slice(0, 10);

const run = async () => {
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  // Gather collision-flagged beaches across the whole dataset, keyed to their region row so
  // the island token / scoring is correct.
  const targets = [];
  for (const region of index.regions) {
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data;
    try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    const beaches = Array.isArray(data) ? data : (data?.island?.beaches || []);
    for (const beach of beaches) {
      const nav = beach?.metadata?.googleMapsNavigation;
      if (nav?.mode === 'coordinates' && COLLISION_RE.test(String(nav?.reason || ''))) {
        targets.push({ region, beach });
      }
    }
  }
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? targets.slice(0, args.limit) : targets;
  console.log(`Collision-flagged coordinate-routed beaches: ${scoped.length}`);

  const cache = openPlaceCache(cachePath);
  const rows = [];
  let done = 0;
  for (const { region, beach } of scoped) {
    const { name, pin, nameQuery, query, coordinate } = await resolveBeachName({
      beach, region, radiusMeters: 3000, sleepMs: args.sleepMs, maxNameQueries: 2, cache,
    });
    // SAFE to flip only if the best hit is verified, close to the pin, right island.
    const hit = name?.evaluation;
    const place = name?.place;
    const wrongIsland = place ? hasWrongIslandSignal(region, place) : false;
    const near = Number.isFinite(hit?.distanceMeters) && hit.distanceMeters <= args.dist;
    const safe = Boolean(hit && hit.status === 'verified' && near && !wrongIsland);
    rows.push({
      id: beach.id, name: getBeachName(beach), regionId: region.id, island: region.prefecture,
      query, resolvedVia: nameQuery, coordinate,
      hit: hit ? { name: place?.displayName?.text, distM: hit.distanceMeters, status: hit.status, wrongIsland } : null,
      safeToFlip: safe,
    });
    if (++done % 10 === 0) { cache.flush(); process.stderr.write(`...${done}/${scoped.length}\n`); }
  }
  cache.flush();

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'collision-recheck.json'), JSON.stringify(rows, null, 1), 'utf8');

  // Ship the verified island-qualified string as an EXPLICIT query — that is the only thing
  // the coordinate-first nav policy trusts for place-routing (a bare mode:place would fall back
  // to coordinates). The applier writes metadata.googleMapsNavigation.query from this field.
  const flips = rows.filter(r => r.safeToFlip).map(r => ({
    id: r.id, name: r.name, lat: r.coordinate?.lat, lon: r.coordinate?.lon,
    navMode: 'place', status: 'verified', query: r.query,
    why: `Collision recheck ${date}: the island-qualified query "${r.query}" resolves unambiguously to this beach (${r.hit.distM} m, right island), so name-collision risk no longer applies — route by this verified place query for the Google beach card.`,
  }));
  await writeFile(path.join(outDir, 'collision-flips.json'), JSON.stringify(flips, null, 1), 'utf8');

  console.log(`Safe to flip to place: ${flips.length} / ${rows.length}`);
  console.log(`Stay on coordinates (still ambiguous/unresolved): ${rows.length - flips.length}`);
  console.log(`Wrote reports/place-resolution/collision-recheck.json and collision-flips.json`);
};

run().catch(err => { console.error(err); process.exit(1); });
