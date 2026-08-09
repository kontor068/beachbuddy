// Builds public/data/beaches/favorite-region-map.json — a flat {beachId: regionId}.
//
// WHY IT EXISTS. Saved beaches live in localStorage today as a bare list of numeric
// ids (`localStorage['favorites'] = [80, 1352, …]`), because the browser only ever
// needed to compare them against beaches it had already loaded. The server schema
// stores (region_id, beach_id) — the pair the URLs and the prerender are built on.
// So the one-time merge at first sign-in has to answer "which region is beach 1352
// in?" for beaches whose region file may never have been opened on this device.
//
// WHY IT IS FETCHED, NOT BUNDLED. It is ~55 KB raw / ~18 KB gzipped. Bundling it
// would put that on every visitor to pay for a migration that runs once, for the
// small minority who sign in. It is requested only by hooks/useFavoritesSync.ts,
// only during that merge.
//
// Ids are globally unique across all 110 region files (the prerender relies on the
// same property to key beachPhotosById flat). This script FAILS if that ever stops
// being true, because a duplicate id would silently file someone's saved beach
// under the wrong region.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachesDir = path.join(projectRoot, 'public', 'data', 'beaches');
const outputPath = path.join(beachesDir, 'favorite-region-map.json');

const main = async () => {
  const entries = await readdir(beachesDir, { withFileTypes: true });
  const regionFiles = entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'index.json' && entry.name !== 'favorite-region-map.json')
    .map(entry => entry.name)
    .sort();

  const map = {};
  const collisions = [];
  let beachCount = 0;

  for (const file of regionFiles) {
    const regionId = file.replace(/\.json$/, '');
    const raw = await readFile(path.join(beachesDir, file), 'utf8');
    const beaches = JSON.parse(raw);
    if (!Array.isArray(beaches)) continue;

    for (const beach of beaches) {
      const id = Number(beach?.id);
      if (!Number.isFinite(id)) continue;
      beachCount += 1;
      if (map[id] && map[id] !== regionId) {
        collisions.push({ id, first: map[id], second: regionId });
        continue;
      }
      map[id] = regionId;
    }
  }

  if (collisions.length > 0) {
    console.error(`Beach ids are NOT globally unique — ${collisions.length} collision(s). A favourite would be filed under the wrong region.`);
    for (const c of collisions.slice(0, 10)) console.error(`  id ${c.id}: ${c.first} vs ${c.second}`);
    process.exitCode = 1;
    return;
  }

  // Sorted keys so the file is byte-stable between builds — a map that reshuffles
  // on every build produces a pointless diff and a pointless cache miss.
  const sorted = Object.fromEntries(
    Object.keys(map).map(Number).sort((a, b) => a - b).map(id => [id, map[id]]),
  );

  await writeFile(outputPath, `${JSON.stringify(sorted)}\n`, 'utf8');
  console.log(`favorite-region-map.json — ${Object.keys(sorted).length} beaches across ${regionFiles.length} regions (${beachCount} rows read, 0 collisions).`);
};

main().catch(error => {
  console.error('Failed to build the favourite region map.', error);
  process.exitCode = 1;
});
