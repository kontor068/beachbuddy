// Cut every region's detail tier into one file per beach — in dist/ only, after `vite build`.
//
// WHY THIS EXISTS. `loadBeachDetailData(regionId, beachId)` in services/beachDataLoader.ts
// has only ever returned ONE beach's record, but the only file it could fetch was the whole
// region: /data/beaches/app/detail/<region>.json. Measured 26/08/2026 — Halkidiki is 723 KB
// raw / 74,5 KB gzipped for 133 beaches, and the one beach the visitor opened is ~2 KB of
// that; the national median region costs 11,9 KB gzipped for a ~1,9 KB answer. That is the
// route Google sends people down (search result → beach page), and the service worker
// re-fetches /data/beaches/ on every request by design (network-first, no-store — a
// corrected pin must never be outlived by a cache), so the region was paid again for
// every beach opened, not once per session.
//
// This step writes dist/data/beaches/app/detail/<region>/<id>.json for every beach, a
// verbatim copy of the record inside the region file. The region file is NOT removed: it is
// the loader's fallback for a build that did not run this step (build:mobile) and for any
// shard that is missing. Nothing is generated into public/ or tracked by git — 2.861 files
// that are a pure projection of files already committed would only be noise in the diff.
//
// It FAILS THE BUILD, rather than writing fewer files, if a region file is malformed: a
// beach without an integer id or two beaches sharing one would mean the fallback path
// silently serves every open for that region, and nobody would notice for months.
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DETAIL_DIR = path.join('dist', 'data', 'beaches', 'app', 'detail');

const fail = (message) => {
  console.error(`\n[detail-split] ✗ BUILD STOPPED — ${message}`);
  process.exit(1);
};

let entries;
try {
  entries = await readdir(DETAIL_DIR, { withFileTypes: true });
} catch {
  fail(`${DETAIL_DIR} does not exist — run this after \`vite build\`, which copies public/ into dist/.`);
}
const regionFiles = entries.filter(e => e.isFile() && e.name.endsWith('.json')).map(e => e.name);
if (regionFiles.length === 0) fail(`no region detail files in ${DETAIL_DIR}.`);

let beaches = 0;
let bytes = 0;
for (const file of regionFiles) {
  const regionId = file.slice(0, -'.json'.length);
  const payload = JSON.parse(await readFile(path.join(DETAIL_DIR, file), 'utf8'));
  if (!Array.isArray(payload?.beaches)) fail(`${file} has no beaches[] — the loader's fallback would break too.`);

  const outDir = path.join(DETAIL_DIR, regionId);
  await mkdir(outDir, { recursive: true });
  const seen = new Set();
  for (const beach of payload.beaches) {
    if (!Number.isInteger(beach?.id)) fail(`${file}: a beach record without an integer id.`);
    if (seen.has(beach.id)) fail(`${file}: beach id ${beach.id} appears twice — which record would the shard hold?`);
    seen.add(beach.id);
    const text = JSON.stringify(beach);
    await writeFile(path.join(outDir, `${beach.id}.json`), text);
    bytes += Buffer.byteLength(text);
    beaches += 1;
  }
}

console.log(
  `[detail-split] ✓ ${beaches} per-beach files across ${regionFiles.length} regions ` +
  `(${(bytes / (1024 * 1024)).toFixed(1)} MB raw) under dist/data/beaches/app/detail/<region>/ — the region files stay as the fallback.`
);
