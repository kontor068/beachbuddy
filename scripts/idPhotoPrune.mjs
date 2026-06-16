/**
 * Remove harvested by-ID photos that failed visual QA.
 * Usage: node scripts/idPhotoPrune.mjs <globalIndex|beachId> ...
 *   - plain numbers <= some threshold are ambiguous, so prefix beachIds with 'id:'
 *   - default: treat args as GLOBAL INDEX (gi) from idqa-index.json
 *   - 'id:1234' removes by beachId directly
 * Example: node scripts/idPhotoPrune.mjs 3 7 12 id:2057
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'data/beachPhotosById.generated.json');
const main = async () => {
  let giToId = new Map();
  try {
    const idx = JSON.parse(await readFile(path.join(ROOT, 'reports/photo-coverage/idqa/idqa-index.json'), 'utf8'));
    giToId = new Map(idx.map(r => [r.gi, String(r.id)]));
  } catch { /* no QA index yet — only id: args will work */ }
  const photos = JSON.parse(await readFile(OUT, 'utf8'));
  const toDrop = new Set();
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('id:')) toDrop.add(a.slice(3));
    else { const id = giToId.get(Number(a)); if (id) toDrop.add(id); }
  }
  let n = 0;
  for (const id of toDrop) if (photos[id]) { delete photos[id]; n++; }
  await writeFile(OUT, JSON.stringify(photos, null, 0) + '\n');
  console.log(`Removed ${n}. Remaining ${Object.keys(photos).length}.`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
