// Splits the monolithic editorial corpus (data/beachStories.data.json, ~1.6 MB) into
// per-region files under data/beachStories/{regionId}.json, so the beach-detail page
// lazy-loads ONLY the stories for the island being viewed instead of the whole country.
//
// data/beachStories.data.json stays the single source of truth (the prerender script and
// the audit scripts read it directly). This script is a pure, deterministic projection:
// the text is copied verbatim, only physically partitioned by region id. Wired into
// `npm run build:beach-data` so the split regenerates whenever the corpus changes.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'data', 'beachStories.data.json');
const outDir = path.join(rootDir, 'data', 'beachStories');

const corpus = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

fs.mkdirSync(outDir, { recursive: true });
// Clear stale region files so a removed/renamed region never lingers in the bundle.
for (const file of fs.readdirSync(outDir)) {
  if (file.endsWith('.json')) fs.rmSync(path.join(outDir, file));
}

let regions = 0;
let stories = 0;
for (const [regionId, regionStories] of Object.entries(corpus)) {
  if (!regionStories || typeof regionStories !== 'object') continue;
  const count = Object.keys(regionStories).length;
  if (count === 0) continue;
  fs.writeFileSync(
    path.join(outDir, `${regionId}.json`),
    JSON.stringify(regionStories),
  );
  regions += 1;
  stories += count;
}

console.log(`Split beachStories: ${stories} stories across ${regions} region files -> data/beachStories/`);
