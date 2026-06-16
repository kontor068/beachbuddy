/**
 * Prune harvested by-ID photos AND record them in the durable blocklist so future
 * harvest passes never re-add the same junk.
 *   - Commons picks  -> add the FILE to blocklist.files (file stays out, but the
 *     beach can still get a different correct photo later).
 *   - Openverse/Flickr or wrong-adjacent picks (--id) -> add the BEACHID to
 *     blocklist.ids (beach is skipped entirely — no acceptable nearby photo).
 *
 * Usage:
 *   node scripts/pruneAndBlock.mjs <id> [id...]            # block the FILE of each id, delete entry
 *   node scripts/pruneAndBlock.mjs --id <id> [id...]       # block the BEACHID itself, delete entry
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'data/beachPhotosById.generated.json');
const BLOCK = path.join(ROOT, 'data/beachPhotoBlocklist.json');

const main = async () => {
  const args = process.argv.slice(2);
  const blockId = args[0] === '--id';
  const ids = (blockId ? args.slice(1) : args).map(String);
  const photos = JSON.parse(await readFile(OUT, 'utf8'));
  const bl = existsSync(BLOCK) ? JSON.parse(await readFile(BLOCK, 'utf8')) : { ids: [], files: [] };
  bl.ids = bl.ids || []; bl.files = bl.files || [];
  const fileSet = new Set(bl.files), idSet = new Set(bl.ids);
  let removed = 0;
  for (const id of ids) {
    if (!photos[id]) continue;
    if (blockId) idSet.add(id);
    else {
      const f = decodeURIComponent((photos[id][0].match(/file\/([^&]+)/) || [])[1] || '');
      if (f) fileSet.add(f); else idSet.add(id); // raw URL pick -> block the beach
    }
    delete photos[id];
    removed++;
  }
  bl.ids = [...idSet].sort(); bl.files = [...fileSet].sort();
  await writeFile(OUT, JSON.stringify(photos, null, 0) + '\n');
  await writeFile(BLOCK, JSON.stringify(bl, null, 2) + '\n');
  console.log(`Removed ${removed}. Blocklist now: ${bl.ids.length} ids, ${bl.files.length} files. by-id left: ${Object.keys(photos).length}`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
