// Harvest ALL OpenStreetMap beaches in Greece, nationally, as the coverage baseline.
//
//   npm run coverage:harvest                 # full national sweep
//   npm run coverage:harvest -- --region=south-aegean
//   npm run coverage:harvest -- --island=milos          # one island/municipality (fast smoke test)
//   npm run coverage:harvest -- --refresh               # ignore cache, re-query
//
// Nesting in public/greek_beaches.json is Region -> Prefecture (e.g. Cyclades) ->
// Municipality (e.g. Milos, the island) -> Beach[]. Tiles always group by the
// municipality (tightest envelope, fewest empty-sea cells); --region/--prefecture/
// --island just narrow which municipalities are in scope.
//
// Why this exists: a competitor lists ~2x our beach count. To find what we are
// genuinely MISSING we first need the full OSM picture (natural=beach +
// leisure=beach_resort), then buildNationalGapReport.mjs matches it against our
// dataset. This script ONLY reads OSM + writes a candidate seed; it never touches
// public/greek_beaches.json.
//
// Strategy: a single national `natural=beach` query times out, so we tile. We take
// each of the 12 source regions, build a padded envelope around its existing
// beaches, grid that envelope into <=0.6 deg cells, and query Overpass per cell.
// Each cell's RAW payload is cached under .tmp/beach-audit-cache/osm-national/ so a
// throttled or interrupted run resumes for free. Candidates are deduped by OSM id
// and then by the shared near-duplicate rule.
//
// Output:
//   scripts/data/osm-beaches-national.json    (deduped candidate list)
//   reports/coverage/harvest-summary.json      (counts + tile manifest + sample)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';
import {
  greeceBounds,
  isFiniteNumber,
  toCoverageCandidate,
  dedupeCoverageCandidates,
} from './lib/beachCoverage.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
// Cache version is bumped when the Overpass query changes (so stale results aren't reused).
// gr2: queries are constrained to Greek territory via area["ISO3166-1"="GR"], which excludes
// Turkish/Albanian beaches that border-island bboxes (Kastellorizo, Symi, Corfu…) otherwise pull in.
const CACHE_VERSION = 'gr2';
const cacheDir = path.join(rootDir, '.tmp', 'beach-audit-cache', `osm-national-${CACHE_VERSION}`);
const seedOutPath = path.join(rootDir, 'scripts', 'data', 'osm-beaches-national.json');
const summaryOutPath = path.join(rootDir, 'reports', 'coverage', 'harvest-summary.json');

const MAX_CELL_DEG = 0.6;   // largest Overpass query cell (keeps element counts + timeouts bounded)
const REGION_PAD_DEG = 0.2; // pad each region envelope so beaches just outside our cluster are caught
const TILE_SLEEP_MS = 1200; // polite gap between Overpass calls
const CELL_TIMEOUT = 90;

const slugify = value => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const parseArgs = argv => {
  const args = { region: null, prefecture: null, municipality: null, refresh: false };
  for (const raw of argv.slice(2)) {
    if (raw === '--refresh' || raw === '--refresh-external') args.refresh = true;
    else if (raw.startsWith('--region=')) args.region = slugify(raw.slice('--region='.length));
    else if (raw.startsWith('--prefecture=')) args.prefecture = slugify(raw.slice('--prefecture='.length));
    else if (raw.startsWith('--municipality=')) args.municipality = slugify(raw.slice('--municipality='.length));
    else if (raw.startsWith('--island=')) args.municipality = slugify(raw.slice('--island='.length));
  }
  return args;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const round = value => Number(value.toFixed(4));

// One padded bbox around a set of coordinates, clamped to Greece.
const envelopeOf = coordinates => {
  const lats = coordinates.map(c => c.lat);
  const lons = coordinates.map(c => c.lon);
  return {
    south: round(clamp(Math.min(...lats) - REGION_PAD_DEG, greeceBounds.south, greeceBounds.north)),
    north: round(clamp(Math.max(...lats) + REGION_PAD_DEG, greeceBounds.south, greeceBounds.north)),
    west: round(clamp(Math.min(...lons) - REGION_PAD_DEG, greeceBounds.west, greeceBounds.east)),
    east: round(clamp(Math.max(...lons) + REGION_PAD_DEG, greeceBounds.west, greeceBounds.east)),
  };
};

// Grid a bbox into <=MAX_CELL_DEG cells.
const gridCells = bbox => {
  const cells = [];
  for (let s = bbox.south; s < bbox.north; s += MAX_CELL_DEG) {
    const n = round(Math.min(s + MAX_CELL_DEG, bbox.north));
    for (let w = bbox.west; w < bbox.east; w += MAX_CELL_DEG) {
      const e = round(Math.min(w + MAX_CELL_DEG, bbox.east));
      cells.push({ south: round(s), west: round(w), north: n, east: e });
    }
  }
  return cells;
};

const cellKey = cell => `${cell.south}_${cell.west}_${cell.north}_${cell.east}`;

// Walk Region -> Prefecture -> Municipality -> Beach[].
const flattenBeaches = data => {
  const rows = [];
  for (const [region, prefectures] of Object.entries(data)) {
    for (const [prefecture, municipalities] of Object.entries(prefectures || {})) {
      for (const [municipality, beaches] of Object.entries(municipalities || {})) {
        for (const beach of beaches || []) {
          if (isFiniteNumber(beach?.lat) && isFiniteNumber(beach?.lon)) {
            rows.push({ region, prefecture, municipality, lat: beach.lat, lon: beach.lon });
          }
        }
      }
    }
  }
  return rows;
};

const buildTiles = (rows, args) => {
  const filtered = rows.filter(row => {
    if (args.region && slugify(row.region) !== args.region) return false;
    if (args.prefecture && slugify(row.prefecture) !== args.prefecture) return false;
    if (args.municipality && slugify(row.municipality) !== args.municipality) return false;
    return true;
  });
  if (filtered.length === 0) return { tiles: [], scopeBeachCount: 0 };

  // Always envelope per municipality (island) — tightest boxes, fewest empty-sea cells.
  const groups = new Map();
  for (const row of filtered) {
    const key = `${row.region}::${row.prefecture}::${row.municipality}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  const seen = new Set();
  const tiles = [];
  for (const [label, groupRows] of groups) {
    for (const cell of gridCells(envelopeOf(groupRows))) {
      const key = cellKey(cell);
      if (seen.has(key)) continue;       // dedup cells shared by adjacent scopes
      seen.add(key);
      tiles.push({ key, label, bbox: cell });
    }
  }
  return { tiles, scopeBeachCount: filtered.length };
};

// Each query is constrained to Greek territory: area(.gr) AND the tile bbox. This drops
// foreign (Turkish/Albanian) beaches that border-island envelopes would otherwise include.
const buildQuery = ({ south, west, north, east }) => `[out:json][timeout:${CELL_TIMEOUT}];
area["ISO3166-1"="GR"][admin_level=2]->.gr;
(
  node["natural"="beach"](area.gr)(${south},${west},${north},${east});
  way["natural"="beach"](area.gr)(${south},${west},${north},${east});
  relation["natural"="beach"](area.gr)(${south},${west},${north},${east});
  node["leisure"="beach_resort"](area.gr)(${south},${west},${north},${east});
  way["leisure"="beach_resort"](area.gr)(${south},${west},${north},${east});
  relation["leisure"="beach_resort"](area.gr)(${south},${west},${north},${east});
  node["tourism"="beach_resort"](area.gr)(${south},${west},${north},${east});
  way["tourism"="beach_resort"](area.gr)(${south},${west},${north},${east});
  relation["tourism"="beach_resort"](area.gr)(${south},${west},${north},${east});
);
out center tags;`;

const fetchOverpass = async query => {
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(query),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) {
        console.warn(`  mirror ${mirror} -> HTTP ${res.status}, trying next`);
        await sleep(1500);
        continue;
      }
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.elements)) return json.elements;
    } catch (err) {
      console.warn(`  mirror ${mirror} failed: ${err.message}`);
    }
    await sleep(1500);
  }
  return null;
};

const readJsonIfExists = async filePath => {
  try { return JSON.parse(await readFile(filePath, 'utf8')); } catch { return null; }
};

const fetchTile = async (tile, args) => {
  const cachePath = path.join(cacheDir, `${tile.key}.json`);
  if (!args.refresh) {
    const cached = await readJsonIfExists(cachePath);
    if (cached && Array.isArray(cached.elements)) {
      return { elements: cached.elements, fromCache: true };
    }
  }
  const elements = await fetchOverpass(buildQuery(tile.bbox));
  if (elements == null) return { elements: null, fromCache: false };
  await mkdir(cacheDir, { recursive: true });
  await writeFile(cachePath, `${JSON.stringify({ bbox: tile.bbox, label: tile.label, fetchedAt: new Date().toISOString(), elements }, null, 2)}\n`, 'utf8');
  return { elements, fromCache: false };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const data = JSON.parse(await readFile(sourcePath, 'utf8'));
  const rows = flattenBeaches(data);
  const { tiles, scopeBeachCount } = buildTiles(rows, args);

  if (tiles.length === 0) {
    console.error('No tiles to query. Check spelling (use slugs, e.g. --region=south-aegean, --island=milos).');
    process.exit(1);
  }

  const scopeLabel = args.municipality || args.prefecture || args.region || 'national';
  console.log(`Harvesting OSM beaches: scope=${scopeLabel}, ${tiles.length} tiles, ${scopeBeachCount} existing beaches in scope.`);

  const elementById = new Map(); // dedup raw OSM elements by stable id across overlapping cells
  let failedTiles = 0;
  let cachedTiles = 0;
  const tileManifest = [];

  for (let i = 0; i < tiles.length; i += 1) {
    const tile = tiles[i];
    const { elements, fromCache } = await fetchTile(tile, args);
    if (elements == null) {
      failedTiles += 1;
      tileManifest.push({ ...tile.bbox, label: tile.label, status: 'failed' });
      console.warn(`  [${i + 1}/${tiles.length}] ${tile.label} ${cellKey(tile)} -> FAILED (all mirrors)`);
      continue;
    }
    if (fromCache) cachedTiles += 1;
    for (const el of elements) {
      if (el && el.type && el.id != null) elementById.set(`${el.type}/${el.id}`, el);
    }
    tileManifest.push({ ...tile.bbox, label: tile.label, status: fromCache ? 'cache' : 'fetched', elements: elements.length });
    if ((i + 1) % 10 === 0 || i === tiles.length - 1) {
      console.log(`  [${i + 1}/${tiles.length}] tiles done (${elementById.size} unique OSM elements so far)`);
    }
    if (!fromCache && i < tiles.length - 1) await sleep(TILE_SLEEP_MS);
  }

  // Raw OSM elements -> coverage candidates (drops unnamed / generic-name / coordinate-less).
  const rawCandidates = [...elementById.values()].map(toCoverageCandidate).filter(Boolean);
  const candidates = dedupeCoverageCandidates(rawCandidates)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'el'));

  await mkdir(path.dirname(seedOutPath), { recursive: true });
  await writeFile(seedOutPath, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    scope: scopeLabel,
    source: 'OpenStreetMap Overpass (natural=beach | leisure/tourism=beach_resort)',
    uniqueOsmElements: elementById.size,
    namedCandidates: rawCandidates.length,
    dedupedCandidates: candidates.length,
    candidates,
  }, null, 2)}\n`, 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    scope: scopeLabel,
    tiles: tiles.length,
    cachedTiles,
    fetchedTiles: tiles.length - cachedTiles - failedTiles,
    failedTiles,
    uniqueOsmElements: elementById.size,
    namedCandidates: rawCandidates.length,
    dedupedCandidates: candidates.length,
    sample: candidates.slice(0, 40).map(c => `${c.displayName} (${c.coordinates.lat.toFixed(4)},${c.coordinates.lon.toFixed(4)})`),
    tileManifest,
  };
  await mkdir(path.dirname(summaryOutPath), { recursive: true });
  await writeFile(summaryOutPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');

  console.log(`\nUnique OSM elements: ${elementById.size}`);
  console.log(`Named candidates: ${rawCandidates.length} -> deduped: ${candidates.length}`);
  if (failedTiles > 0) console.warn(`WARNING: ${failedTiles} tile(s) failed on all mirrors; re-run to fill gaps (cache keeps successes).`);
  console.log(`Wrote seed   -> ${path.relative(rootDir, seedOutPath)}`);
  console.log(`Wrote summary -> ${path.relative(rootDir, summaryOutPath)}`);
  console.log(`Next: npm run coverage:report`);
};

main().catch(err => { console.error(err); process.exit(1); });
