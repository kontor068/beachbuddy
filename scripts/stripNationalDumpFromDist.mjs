// Keep the whole-country beach dataset OFF the CDN.
//
// WHY THIS EXISTS. `public/greek_beaches.json` is the canonical curated dataset — 2.850
// beaches with wind profiles, curated coves, amenities and stories. It is the moat: the
// React code is replaceable, this file is not. It has to live in `public/` because ~55
// build scripts read it from there by disk path (`buildBeachRegionData.mjs:18` and
// friends), and moving it would mean editing all of them.
//
// But `public/` is also Vite's static copy directory. So a file that only ever needed to
// exist ON DISK AT BUILD TIME was being published to the CDN, where
// `https://calmbeach.gr/greek_beaches.json` returned 200 OK and 9,9 MB — the entire
// dataset in a single `curl`. `robots.txt` disallowed it, but robots.txt is a request to
// polite crawlers, not access control.
//
// Measured 13/08/2026 before writing this: the app does NOT need it. The string
// `greek_beaches` appears in ZERO of the built JS chunks, and `loadBeaches` /
// `loadBeachesForRegion` in `services/beachService.ts` are called by no component or
// hook — the app reads the per-region shards under `/data/beaches/`. So deleting the
// published copy costs visitors nothing and removes the one-request national scrape.
// (The 2026-07-21 anti-scraping pass could not do this: back then the note said it was a
// live fallback. It stopped being one, and nobody noticed.)
//
// THE GUARD MATTERS MORE THAN THE DELETE. If someone later writes code that fetches
// `/greek_beaches.json` again, silently deleting the file would break the site in
// production and nowhere else. So this step FAILS THE BUILD instead: if any built asset
// still references the path, we stop and say so, rather than shipping a 404 into a code
// path that expects data.
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const distDir = 'dist';
const DUMP_NAME = 'greek_beaches.json';
const DUMP_PATH = path.join(distDir, DUMP_NAME);

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

const files = await walk(path.join(distDir, 'assets'));
const codeFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.css'));

const referencing = [];
for (const file of codeFiles) {
  const text = await readFile(file, 'utf8');
  // Match the served path, not the bare filename: a build script naming the source file
  // in a comment is not the same as shipped code fetching the URL.
  if (text.includes(`/${DUMP_NAME}`)) referencing.push(file);
}

if (referencing.length > 0) {
  console.error(`\n[national-dump] ✗ BUILD STOPPED — shipped code still fetches /${DUMP_NAME}.`);
  console.error('  Removing it from the CDN would make that request 404 in production only.');
  console.error('  Point the code at the per-region shards under /data/beaches/ instead.');
  for (const file of referencing) console.error(`    ${file}`);
  process.exit(1);
}

let removedMb = 0;
try {
  const info = await stat(DUMP_PATH);
  removedMb = info.size / (1024 * 1024);
  await rm(DUMP_PATH);
} catch {
  console.log(`[national-dump] ✓ nothing to remove — ${DUMP_NAME} was not published.`);
  process.exit(0);
}

console.log(
  `[national-dump] ✓ removed dist/${DUMP_NAME} (${removedMb.toFixed(1)} MB) — ` +
  'the dataset stays on disk for the build scripts, off the CDN for everyone else.'
);
