/**
 * Find beach photos served on NAME alone to a beach the photo does not depict.
 *
 * The national table BEACH_PHOTOS in services/beachPhotos.ts is keyed by beach
 * name, not by beach id. It is the last resort in getBeachPhotoLookup: every
 * region with its own table returns before reaching it. So a beach called 'Βάι'
 * on Astypalaia — which has no regional table — is served the photo of 'Βάι' in
 * Crete. A photo shows ONE place; a name that exists on several islands cannot
 * decide which.
 *
 * This script names the unsafe keys instead of guessing at a count. A key is:
 *   ambiguous — its name matches beaches on more than one island. Unsafe: we
 *               cannot know which of them the photo depicts. REMOVE.
 *   unique    — matches beaches on exactly one island. Safe to keep.
 *   dead      — matches no beach we serve. Harmless, but it is dead weight.
 *
 * Matching is the same rule the app uses (services/beachPhotos.ts findPhotos):
 * exact key, then normalizeLookup equality. No substrings — copied verbatim so
 * the audit cannot drift from what users are actually shown.
 *
 * Reads reports/photo-coverage/beach-photo-presence.json to report which
 * beaches are *actually* being served by this table right now. Run
 * `npm run quality:photo-coverage` first if that file is stale.
 *
 * Output: reports/photo-coverage/name-collision-photos.json
 * Run:    node scripts/auditNameCollisionPhotos.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'public', 'data', 'beaches', 'app');
const photosSrc = path.join(rootDir, 'services', 'beachPhotos.ts');
const outDir = path.join(rootDir, 'reports', 'photo-coverage');
const presencePath = path.join(outDir, 'beach-photo-presence.json');

// --- verbatim from services/beachPhotos.ts -------------------------------
const normalizeLookup = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]+/gi, '');

// --- 1. the keys of the national table -----------------------------------
const ts = fs.readFileSync(photosSrc, 'utf8');

const grabBlock = (name) => {
  const re = new RegExp(`const ${name}[^=]*=\\s*`, 'm');
  const m = re.exec(ts);
  if (!m) throw new Error(`Could not locate ${name} in beachPhotos.ts`);
  const start = m.index + m[0].length;
  if (ts[start] !== '{') throw new Error(`${name} is not an object literal`);
  let depth = 0;
  let inStr = null;
  let i = start;
  for (; i < ts.length; i++) {
    const c = ts[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return ts.slice(start, i);
};

const nationalBlock = grabBlock('BEACH_PHOTOS');
// Only top-level keys of this object; the values are identifiers or [wm(...)]
// arrays, never nested objects, so a line-anchored match is exact here.
const keys = [...nationalBlock.matchAll(/^ {2}'([^']+)':/gm)].map((m) => m[1]);
if (!keys.length) throw new Error('No keys parsed out of BEACH_PHOTOS');

// --- 2. every beach the app serves ---------------------------------------
const beaches = [];
for (const file of fs.readdirSync(appDir).filter((f) => f.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(appDir, file), 'utf8'));
  const island = data.island;
  if (!island || !Array.isArray(island.beaches)) continue;
  const islandNameEn = island.name?.en || island.id || '';
  const islandNameGr = island.name?.gr || islandNameEn;
  for (const b of island.beaches) {
    beaches.push({
      id: b.id,
      nameGr: b.name?.gr || '',
      nameEn: b.name?.en || '',
      island: islandNameGr,
      regionFile: file.replace(/\.json$/, ''),
    });
  }
}
if (!beaches.length) throw new Error(`No beaches found under ${appDir}`);

const byNormalizedName = new Map();
for (const b of beaches) {
  for (const n of [normalizeLookup(b.nameGr), normalizeLookup(b.nameEn)]) {
    if (!n) continue;
    if (!byNormalizedName.has(n)) byNormalizedName.set(n, []);
    const bucket = byNormalizedName.get(n);
    if (!bucket.some((x) => x.id === b.id)) bucket.push(b);
  }
}

// --- 3. who is actually being served by this table right now --------------
let servedByGlobal = new Map();
if (fs.existsSync(presencePath)) {
  const presence = JSON.parse(fs.readFileSync(presencePath, 'utf8'));
  const rows = Array.isArray(presence) ? presence : (presence.rows ?? presence.beaches ?? []);
  servedByGlobal = new Map(
    rows.filter((r) => r.photoSource === 'global').map((r) => [r.id, r]),
  );
} else {
  console.warn(`! ${path.relative(rootDir, presencePath)} missing — run npm run quality:photo-coverage`);
}

// --- 4. classify ----------------------------------------------------------
const ambiguous = [];
const unique = [];
const dead = [];

for (const key of keys) {
  const matches = byNormalizedName.get(normalizeLookup(key)) ?? [];
  const islands = [...new Set(matches.map((b) => b.island).filter(Boolean))];
  const served = matches.filter((b) => servedByGlobal.has(b.id));
  const entry = {
    key,
    matchCount: matches.length,
    islands,
    beaches: matches.map((b) => ({ id: b.id, nameGr: b.nameGr, island: b.island, regionFile: b.regionFile })),
    servedByThisTable: served.map((b) => ({ id: b.id, nameGr: b.nameGr, island: b.island })),
  };
  if (islands.length > 1) ambiguous.push(entry);
  else if (matches.length) unique.push(entry);
  else dead.push(entry);
}

// A beach can match two ambiguous keys (its Greek name and its English name),
// so dedupe by id or the count reads higher than the number of wrong photos.
const affectedBeaches = [
  ...new Map(
    ambiguous.flatMap((e) => e.servedByThisTable).map((b) => [b.id, b]),
  ).values(),
].sort((a, b) => a.island.localeCompare(b.island, 'el') || a.nameGr.localeCompare(b.nameGr, 'el'));

// --- 5. report ------------------------------------------------------------
fs.mkdirSync(outDir, { recursive: true });
const report = {
  generatedFrom: 'services/beachPhotos.ts BEACH_PHOTOS',
  rule: 'a key whose name matches beaches on more than one island cannot identify the beach its photo depicts',
  totals: {
    keys: keys.length,
    ambiguous: ambiguous.length,
    unique: unique.length,
    dead: dead.length,
    beachesCurrentlyServedByThisTable: servedByGlobal.size,
    beachesCurrentlyShownAWrongPhoto: affectedBeaches.length,
  },
  ambiguous,
  unique,
  dead,
};
const outPath = path.join(outDir, 'name-collision-photos.json');
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Keys in the national table: ${keys.length}`);
console.log(`  ambiguous (remove): ${ambiguous.length}`);
console.log(`  unique (keep):      ${unique.length}`);
console.log(`  dead (match no beach we serve): ${dead.length}`);
console.log('');
console.log(`Beaches served by this table today: ${servedByGlobal.size}`);
console.log(`Of those, shown a photo we cannot vouch for: ${affectedBeaches.length}`);
if (affectedBeaches.length) {
  console.log('');
  for (const b of affectedBeaches) console.log(`  ${b.id}  ${b.nameGr} — ${b.island}`);
}
console.log('');
console.log(`→ ${path.relative(rootDir, outPath)}`);

// A gate, not just a report. Adding a beach called 'Πλάκα' to a region with no
// table of its own silently re-creates the bug this script was written to close:
// the beach would be handed whichever 'Πλάκα' the national table happens to hold.
// Fail the build instead, and let whoever adds the beach decide — a photo tied to
// its id, or no photo. Never a photo tied to its name.
if (ambiguous.length) {
  console.error('');
  console.error(`FAIL: ${ambiguous.length} name(s) in the national photo table match beaches on more than`);
  console.error('one island. A photo shows one place; these keys cannot say which.');
  console.error('Remove the key from BEACH_PHOTOS, or give the beach a geo-verified photo by id');
  console.error('in data/beachPhotosById.generated.json.');
  process.exitCode = 1;
}
