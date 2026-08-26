// Keep build-time inputs OFF the CDN.
//
// `public/` is Vite's static copy directory, so anything that has to live there for the
// build scripts to read it FROM DISK is also published to the CDN — whether or not the app
// ever requests it. Two datasets fell into that gap; this step deletes them from dist/
// after the build and, more importantly, FAILS THE BUILD if shipped code still references
// them, so a future fetch cannot turn into a production-only 404.
//
// 1. `public/greek_beaches.json` — the canonical curated dataset, 2.850 beaches with wind
//    profiles, curated coves, amenities and stories. It is the moat: the React code is
//    replaceable, this file is not. ~55 build scripts read it by disk path
//    (`buildBeachRegionData.mjs:18` and friends), so it has to stay in `public/`. But until
//    13/08/2026 `https://calmbeach.gr/greek_beaches.json` returned 200 OK and 9,9 MB — the
//    entire dataset in a single `curl`. `robots.txt` disallowed it, but robots.txt is a
//    request to polite crawlers, not access control. Measured before deleting: the string
//    `greek_beaches` appears in ZERO built JS chunks — the app reads the per-region shards
//    under `/data/beaches/`. (The 2026-07-21 anti-scraping pass could not do this: back
//    then the note said it was a live fallback. It stopped being one, and nobody noticed.)
//
// 2. `public/data/coastline/<region>.json` — 109 files, 2,5 MB of real OSM shoreline
//    chains annotated with the nearest beach. `buildShorelineThumbs.mjs` reads them during
//    `npm run build` to draw the `shape/` thumbnails, which ARE requested by the app
//    (`services/shorelineShapeService.ts`). The chains themselves were only ever fetched by
//    the map's coloured-coastline layer, which nothing had imported for weeks before it was
//    deleted on 26/08/2026 — so every deploy was publishing 2,5 MB nobody asked for, and
//    another open dataset to scrape. Only `shape/` stays.
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = 'dist';

/** Every file under a directory, recursively. */
const walk = async (dir) => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
};

const assets = (await walk(path.join(distDir, 'assets'))).filter(f => f.endsWith('.js') || f.endsWith('.css'));
const shipped = await Promise.all(assets.map(async file => [file, await readFile(file, 'utf8')]));

/** Stop the build if any shipped asset still references a path we are about to delete. */
const guard = (label, pattern, advice) => {
  const referencing = shipped.filter(([, text]) => pattern.test(text)).map(([file]) => file);
  if (referencing.length === 0) return;
  console.error(`\n[${label}] ✗ BUILD STOPPED — shipped code still fetches a path this step removes from the CDN.`);
  console.error('  Removing it would make that request 404 in production only.');
  console.error(`  ${advice}`);
  for (const file of referencing) console.error(`    ${file}`);
  process.exit(1);
};

const mb = bytes => (bytes / (1024 * 1024)).toFixed(1);

// ---- 1. the national dump --------------------------------------------------------------
// Match the served path, not the bare filename: a build script naming the source file in a
// comment is not the same as shipped code fetching the URL.
guard('national-dump', /\/greek_beaches\.json/, 'Point the code at the per-region shards under /data/beaches/ instead.');
{
  const dump = path.join(distDir, 'greek_beaches.json');
  try {
    const info = await stat(dump);
    await rm(dump);
    console.log(`[national-dump] ✓ removed dist/greek_beaches.json (${mb(info.size)} MB) — on disk for the build scripts, off the CDN for everyone else.`);
  } catch {
    console.log('[national-dump] ✓ nothing to remove — greek_beaches.json was not published.');
  }
}

// ---- 2. the coastline chains -----------------------------------------------------------
// Anything under /data/coastline/ that is not shape/ — the chain URLs are built as
// `/data/coastline/${regionId}.json`, so the prefix alone is the signature.
guard('coastline-chains', /\/data\/coastline\/(?!shape\/)/, 'Only /data/coastline/shape/ is published; the chains are a build input (buildShorelineThumbs.mjs).');
{
  const coastDir = path.join(distDir, 'data', 'coastline');
  let entries = [];
  try {
    entries = await readdir(coastDir, { withFileTypes: true });
  } catch {
    // no coastline directory in this build — nothing to strip
  }
  let removed = 0;
  let bytes = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
    const full = path.join(coastDir, entry.name);
    bytes += (await stat(full)).size;
    await rm(full);
    removed += 1;
  }
  console.log(removed > 0
    ? `[coastline-chains] ✓ removed ${removed} chain file(s) from dist/data/coastline/ (${mb(bytes)} MB) — shape/ stays.`
    : '[coastline-chains] ✓ nothing to remove — no chain files were published.');
}
