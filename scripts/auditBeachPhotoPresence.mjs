/**
 * Audit which beaches served by the app have a curated photo and which do not.
 *
 * It reads the BUILT app region files in public/data/beaches/app/*.json (the
 * exact beaches + final names + island label the UI renders) and asks the REAL
 * resolver — `getBeachPhotoLookup` from services/beachPhotos.ts, bundled with
 * esbuild — exactly what the app asks it.
 *
 * WHY IT NO LONGER MIRRORS THE RESOLVER (09/09/2026). This script used to
 * re-implement the matching rules by scraping the table literals out of
 * services/beachPhotos.ts and re-evaluating them in a sandbox. That copy drifted
 * and then broke outright: it threw a SyntaxError on CYCLADES_BEACH_PHOTOS_BY_ISLAND,
 * so reports/photo-coverage/beach-photo-presence.json went stale — and the admin
 * Quality board reads that file for its photo axis, so every region's photo
 * percentage was frozen at whatever the last successful run produced. The copy was
 * also plainly wrong about the Ionian ("app intentionally renders no beach photo"),
 * while the real resolver serves per-beach Ionian photos. A hand-written mirror of
 * a 1,600-line resolver cannot be kept honest; asking the resolver can.
 *
 * Output: reports/photo-coverage/beach-photo-presence.csv  (+ .json + summary)
 * Each row: region file, island, beach id, Greek name, English name,
 *           has_photo (yes/no), photo_source.
 *
 * `photo_source` keeps the vocabulary its consumers expect:
 *   by-id:geo-verified — data/beachPhotosById.generated.json (checked first)
 *   global             — the global name-keyed BEACH_PHOTOS table is what serves it
 *   area-or-island     — an area/island-scoped table serves it
 *   ''                 — no photo
 * `global` is what scripts/auditNameCollisionPhotos.mjs looks for: those are the
 * beaches a name collision could hand another island's picture to.
 *
 * Run:  node scripts/auditBeachPhotoPresence.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'public', 'data', 'beaches', 'app');
const byIdPath = path.join(rootDir, 'data', 'beachPhotosById.generated.json');
const outDir = path.join(rootDir, 'reports', 'photo-coverage');

const BEACH_PHOTOS_BY_ID = JSON.parse(fs.readFileSync(byIdPath, 'utf8'));

// An island name no alias resolver can match, so the lookup skips every
// area/island-scoped table and falls through to the global BEACH_PHOTOS table.
// Comparing that answer with the real-island answer tells us which table serves
// the beach without re-implementing a single matching rule.
const NO_SUCH_ISLAND = '__calmbeach_audit_no_such_island__';

const bundleResolver = async () => {
  const outFile = path.join(rootDir, '.tmp', 'beachPhotos.presence.bundle.cjs');
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await build({
    entryPoints: [path.join(rootDir, 'services', 'beachPhotos.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: outFile,
    logLevel: 'error',
    loader: { '.json': 'json' },
  });
  const mod = await import(`file://${outFile}?t=${Date.now()}`);
  if (typeof mod.getBeachPhotoLookup !== 'function') {
    throw new Error('services/beachPhotos.ts no longer exports getBeachPhotoLookup');
  }
  return { getBeachPhotoLookup: mod.getBeachPhotoLookup, outFile };
};

const { getBeachPhotoLookup, outFile } = await bundleResolver();

const sameUrls = (a, b) => a.length === b.length && a.every((url, i) => url === b[i]);

const classify = (gr, en, beachId, islandName) => {
  const real = getBeachPhotoLookup(gr, en, beachId, 3, islandName);
  if (real.source !== 'exact') return { has: false, source: '' };

  const byId = BEACH_PHOTOS_BY_ID[String(beachId)];
  if (byId && byId.length) return { has: true, source: 'by-id:geo-verified' };

  const global = getBeachPhotoLookup(gr, en, beachId, 3, NO_SUCH_ISLAND);
  const servedByGlobal =
    global.source === 'exact' && sameUrls(real.photos ?? [], global.photos ?? []);

  return { has: true, source: servedByGlobal ? 'global' : 'area-or-island' };
};

// ---------------------------------------------------------------------------
// Walk every built app region file and classify each beach.
// ---------------------------------------------------------------------------
const files = fs.readdirSync(appDir).filter((f) => f.endsWith('.json'));
const rows = [];
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(appDir, file), 'utf8'));
  const island = data.island;
  if (!island || !Array.isArray(island.beaches)) continue;
  const islandNameEn = island.name?.en || island.id || '';
  const islandNameGr = island.name?.gr || islandNameEn;
  for (const b of island.beaches) {
    const gr = b.name?.gr || '';
    const en = b.name?.en || '';
    // App passes island.name[language]; English form resolves the same alias key.
    const res = classify(gr, en, b.id, islandNameEn);
    rows.push({
      regionFile: file.replace(/\.json$/, ''),
      island: islandNameGr,
      id: b.id,
      nameGr: gr,
      nameEn: en,
      hasPhoto: res.has,
      photoSource: res.source,
    });
  }
}

rows.sort((a, b) =>
  a.island.localeCompare(b.island, 'el') || a.nameGr.localeCompare(b.nameGr, 'el'));

// ---------------------------------------------------------------------------
// Write CSV + JSON + summary.
// ---------------------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });
const csvEsc = (v) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const header = ['id', 'beach_gr', 'beach_en', 'island', 'region_file', 'has_photo', 'photo_source'];
const csv = [
  '﻿' + header.join(','), // BOM so Excel reads Greek as UTF-8
  ...rows.map((r) =>
    [r.id, r.nameGr, r.nameEn, r.island, r.regionFile, r.hasPhoto ? 'yes' : 'no', r.photoSource]
      .map(csvEsc).join(',')),
].join('\r\n');
fs.writeFileSync(path.join(outDir, 'beach-photo-presence.csv'), csv, 'utf8');
fs.writeFileSync(path.join(outDir, 'beach-photo-presence.json'), JSON.stringify(rows, null, 2), 'utf8');

const total = rows.length;
const withPhoto = rows.filter((r) => r.hasPhoto).length;
const perIsland = {};
for (const r of rows) {
  perIsland[r.island] ??= { total: 0, withPhoto: 0 };
  perIsland[r.island].total++;
  if (r.hasPhoto) perIsland[r.island].withPhoto++;
}
const summaryLines = [
  `Beach photo coverage — ${new Date().toISOString().slice(0, 10)}`,
  `Total beaches: ${total}`,
  `With photo:    ${withPhoto} (${((withPhoto / total) * 100).toFixed(1)}%)`,
  `Without photo: ${total - withPhoto} (${(((total - withPhoto) / total) * 100).toFixed(1)}%)`,
  '',
  'Per island/region (withPhoto / total):',
  ...Object.entries(perIsland)
    .sort((a, b) => a[0].localeCompare(b[0], 'el'))
    .map(([island, s]) => `  ${island}: ${s.withPhoto}/${s.total}`),
];
const summary = summaryLines.join('\n');
fs.writeFileSync(path.join(outDir, 'beach-photo-presence-summary.txt'), summary, 'utf8');

fs.rmSync(outFile, { force: true });

console.log(summary);
console.log('');
console.log('Wrote:');
console.log('  reports/photo-coverage/beach-photo-presence.csv');
console.log('  reports/photo-coverage/beach-photo-presence.json');
console.log('  reports/photo-coverage/beach-photo-presence-summary.txt');
