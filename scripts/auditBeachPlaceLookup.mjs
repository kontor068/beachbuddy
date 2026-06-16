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
import { getBeachName, getCoordinate, buildPlaceQuery, usesPlaceQuery, lookupBeachCandidates } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const defaultOutputDir = path.join(rootDir, '.tmp', 'place-lookup-audit');

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

// ---- audit one beach ---------------------------------------------------------
// All OSM/Nominatim lookup, Greek-aware normalization, query construction (mirrors
// utils/navigation.ts getPlaceQuery), place-query scope and scoring live in the
// shared module scripts/lib/placeResolution.mjs.
const auditBeach = async ({ args, record }) => {
  const { beach, region } = record;

  if (args.dryRun) {
    return {
      beachId: beach.id, beachName: getBeachName(beach), island: region.prefecture, regionId: region.id,
      coordinate: getCoordinate(beach), query: buildPlaceQuery(beach, region),
      inScope: true, status: 'dry_run', candidates: [], bestCandidate: null,
    };
  }

  const { coordinate, query, evaluated, overpassFailed } = await lookupBeachCandidates({
    beach, region, source: args.source, radiusMeters: args.radiusMeters, sleepMs: args.sleepMs,
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
