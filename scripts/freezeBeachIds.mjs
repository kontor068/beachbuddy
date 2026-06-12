// One-time codemod (approved 2026-06-12): writes the current POSITIONAL beach id into each
// source entry as an explicit `id` field, freezing the id assignment forever. After this,
// the builder reads `id` from the entry (with validation) instead of a positional counter,
// so new beaches can be inserted anywhere with id >= 3000 without shifting existing ids
// (ids are embedded in indexed beach-page URLs, exposure profiles, overrides and GT cases).
import { readFileSync, writeFileSync } from 'node:fs';

const sourcePath = 'public/greek_beaches.json';
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

let idCounter = 0;
let stamped = 0;
const walk = (node, mutateParent) => {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i += 1) {
      const item = node[i];
      const lat = typeof item?.lat === 'number' ? item.lat : Number(item?.lat);
      const lon = typeof item?.lon === 'number' ? item.lon : Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const id = idCounter++;
      if (item.id !== undefined && item.id !== id) throw new Error(`entry already has different id: ${item.id} vs positional ${id} ("${item.name}")`);
      // id as first key, matching the app-data shape.
      node[i] = { id, ...item };
      stamped += 1;
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) walk(value);
};
for (const value of Object.values(source)) walk(value);

writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
console.log(`stamped ${stamped} entries with frozen ids (0..${idCounter - 1})`);
