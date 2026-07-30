/**
 * Audit which beaches served by the app have a curated photo and which do not.
 *
 * It reads the BUILT app region files in public/data/beaches/app/*.json (the
 * exact beaches + final names + island label the UI renders) and replays the
 * photo-matching rules from services/beachPhotos.ts (verbatim: the same
 * normalizeLookup, the same alias resolvers, the same UNVERIFIED/strict gates,
 * and the same Milos verified-image branch).
 *
 * Output: reports/photo-coverage/beach-photo-presence.csv  (+ .json + summary)
 * Each row: region file, island, beach id, Greek name, English name,
 *           has_photo (yes/no), photo_source (table that matched, or '').
 *
 * Run:  node scripts/auditBeachPhotoPresence.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'public', 'data', 'beaches', 'app');
const photosSrc = path.join(rootDir, 'services', 'beachPhotos.ts');
const milosImagesPath = path.join(rootDir, 'src', 'data', 'beachImages.milos.json');
const byIdPath = path.join(rootDir, 'data', 'beachPhotosById.generated.json');
const outDir = path.join(rootDir, 'reports', 'photo-coverage');

const BEACH_PHOTOS_BY_ID = JSON.parse(fs.readFileSync(byIdPath, 'utf8'));

// ---------------------------------------------------------------------------
// 1. Pull the photo data tables straight out of services/beachPhotos.ts so the
//    key sets can never drift from the app. We evaluate the file in a sandbox
//    where `wm()` and the external image URLs are stubbed to harmless markers —
//    we only care about *which beach-name keys exist*, not the URLs.
// ---------------------------------------------------------------------------
const ts = fs.readFileSync(photosSrc, 'utf8');

const grab = (name) => {
  // Match `const NAME ... = {  ... };` or `= [ ... ];` at top level.
  const re = new RegExp(`const ${name}[^=]*=\\s*`, 'm');
  const m = re.exec(ts);
  if (!m) throw new Error(`Could not locate ${name} in beachPhotos.ts`);
  let start = m.index + m[0].length;
  // `const X = new Set([ ... ])` — skip to the inner array literal.
  if (ts.slice(start, start + 8).startsWith('new Set(')) {
    start = ts.indexOf('[', start);
  }
  // Walk braces/brackets to find the matching close.
  const open = ts[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let i = start;
  let inStr = null;
  for (; i < ts.length; i++) {
    const c = ts[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { i++; break; } }
  }
  return ts.slice(start, i);
};

// Sandbox helpers: wm()/URLs collapse to a single marker so arrays become
// truthy non-empty lists of strings (length is all the matcher checks).
const wm = () => 'PHOTO';
const MILOS_UNSPLASH_COVE = 'PHOTO';
const MILOS_PEXELS_SOUTH_BAY = 'PHOTO';
const MILOS_PEXELS_GERAKAS = 'PHOTO';
const MILOS_PEXELS_BOATS_CLIFFS = 'PHOTO';
const MILOS_FLICKR_KLEFTIKO = 'PHOTO';
const MILOS_FLICKR_PIRATES_LAIR = 'PHOTO';

// The big lookup tables reference named photo-array constants declared above
// them (e.g. ATTICA_VOULA_A_PLAZ_PHOTOS = [wm(...)]). Collect every such
// top-level `const NAME = [ ... ];` photo array and stub it in the sandbox.
const photoArrayConsts = {};
{
  const re = /const ([A-Z][A-Z0-9_]*_PHOTOS)\s*=\s*\[/g;
  let m;
  while ((m = re.exec(ts))) {
    const name = m[1];
    const start = m.index + m[0].length - 1; // at '['
    let depth = 0;
    let i = start;
    let inStr = null;
    for (; i < ts.length; i++) {
      const c = ts[i];
      if (inStr) { if (c === '\\') { i++; continue; } if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
    }
    const literal = ts.slice(start, i);
    // eslint-disable-next-line no-new-func
    photoArrayConsts[name] = Function(
      'wm', 'MILOS_UNSPLASH_COVE', 'MILOS_PEXELS_SOUTH_BAY', 'MILOS_PEXELS_GERAKAS',
      'MILOS_PEXELS_BOATS_CLIFFS', 'MILOS_FLICKR_KLEFTIKO', 'MILOS_FLICKR_PIRATES_LAIR',
      `return (${literal});`,
    )(wm, MILOS_UNSPLASH_COVE, MILOS_PEXELS_SOUTH_BAY, MILOS_PEXELS_GERAKAS,
      MILOS_PEXELS_BOATS_CLIFFS, MILOS_FLICKR_KLEFTIKO, MILOS_FLICKR_PIRATES_LAIR);
  }
}
const sandboxNames = [
  'wm', 'MILOS_UNSPLASH_COVE', 'MILOS_PEXELS_SOUTH_BAY', 'MILOS_PEXELS_GERAKAS',
  'MILOS_PEXELS_BOATS_CLIFFS', 'MILOS_FLICKR_KLEFTIKO', 'MILOS_FLICKR_PIRATES_LAIR',
  ...Object.keys(photoArrayConsts),
];
const sandboxValues = [
  wm, MILOS_UNSPLASH_COVE, MILOS_PEXELS_SOUTH_BAY, MILOS_PEXELS_GERAKAS,
  MILOS_PEXELS_BOATS_CLIFFS, MILOS_FLICKR_KLEFTIKO, MILOS_FLICKR_PIRATES_LAIR,
  ...Object.values(photoArrayConsts),
];

const evalLiteral = (name) => {
  const literal = grab(name);
  // eslint-disable-next-line no-new-func
  return Function(...sandboxNames, `return (${literal});`)(...sandboxValues);
};

const BEACH_PHOTOS = evalLiteral('BEACH_PHOTOS');
const ATTICA_BEACH_PHOTOS_BY_AREA = evalLiteral('ATTICA_BEACH_PHOTOS_BY_AREA');
const CRETE_BEACH_PHOTOS_BY_AREA = evalLiteral('CRETE_BEACH_PHOTOS_BY_AREA');
const MACEDONIA_BEACH_PHOTOS_BY_AREA = evalLiteral('MACEDONIA_BEACH_PHOTOS_BY_AREA');
const THRACE_BEACH_PHOTOS_BY_AREA = evalLiteral('THRACE_BEACH_PHOTOS_BY_AREA');
const NORTH_AEGEAN_BEACH_PHOTOS_BY_AREA = evalLiteral('NORTH_AEGEAN_BEACH_PHOTOS_BY_AREA');
const MILOS_BEACH_PHOTOS = evalLiteral('MILOS_BEACH_PHOTOS');
// CYCLADES_BEACH_PHOTOS_BY_ISLAND references MILOS_BEACH_PHOTOS by identity.
sandboxNames.push('MILOS_BEACH_PHOTOS');
sandboxValues.push(MILOS_BEACH_PHOTOS);
const CYCLADES_BEACH_PHOTOS_BY_ISLAND = evalLiteral('CYCLADES_BEACH_PHOTOS_BY_ISLAND');
const UNVERIFIED_BEACH_PHOTO_KEYS = new Set(evalLiteral('UNVERIFIED_BEACH_PHOTO_KEYS'));
const VERIFIED_MILOS_BEACH_PHOTO_KEYS = new Set(evalLiteral('VERIFIED_MILOS_BEACH_PHOTO_KEYS'));
const CYCLADES_ISLAND_ALIASES = evalLiteral('CYCLADES_ISLAND_ALIASES');
const ATTICA_AREA_ALIASES = evalLiteral('ATTICA_AREA_ALIASES');
const MACEDONIA_AREA_ALIASES = evalLiteral('MACEDONIA_AREA_ALIASES');
const CRETE_AREA_ALIASES = evalLiteral('CRETE_AREA_ALIASES');
const THRACE_AREA_ALIASES = evalLiteral('THRACE_AREA_ALIASES');
const NORTH_AEGEAN_AREA_ALIASES = evalLiteral('NORTH_AEGEAN_AREA_ALIASES');
const IONIAN_ISLAND_ALIASES = evalLiteral('IONIAN_ISLAND_ALIASES');

// Milos verified images (the special branch).
const milosImages = JSON.parse(fs.readFileSync(milosImagesPath, 'utf8'));

// ---------------------------------------------------------------------------
// 2. Re-implementation of the lookup helpers — copied 1:1 from beachPhotos.ts.
// ---------------------------------------------------------------------------
const normalizeLookup = (value) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]+/gi, '');

const aliasKey = (aliases, name) => {
  if (!name) return null;
  const n = normalizeLookup(name);
  if (aliases[n]) return aliases[n];
  for (const [alias, key] of Object.entries(aliases)) {
    if (n.includes(alias) || alias.includes(n)) return key;
  }
  return null;
};

const findPhotos = (photosByName, gr, en, strictAllowedKeys) => {
  const ng = normalizeLookup(gr);
  const ne = normalizeLookup(en);
  if (strictAllowedKeys && !strictAllowedKeys.has(ng) && !strictAllowedKeys.has(ne)) return [];
  if (UNVERIFIED_BEACH_PHOTO_KEYS.has(ng) || UNVERIFIED_BEACH_PHOTO_KEYS.has(ne)) return [];
  if (photosByName[gr]?.length) return photosByName[gr];
  if (photosByName[en]?.length) return photosByName[en];
  for (const [key, photos] of Object.entries(photosByName)) {
    const nk = normalizeLookup(key);
    if (nk === ng || nk === ne) return photos;
  }
  return [];
};

const isMilosIsland = (island) => {
  const n = normalizeLookup(island || '');
  return n === 'milos' || n === 'μηλος';
};

// Mirror of getBeachPhotoLookup → returns { has: bool, source: string }.
// BEACH_PHOTOS_BY_ID is checked FIRST in services/beachPhotos.ts (GPS-verified,
// keyed by beachId — see scripts/harvestGeoPhotos.mjs) and must be checked first
// here too: this branch was missing until 30/07/2026, which made this script
// undercount coverage by ~1,000 beaches (reported 12% has-photo vs the real ~50%).
const lookup = (gr, en, beachId, islandName) => {
  const byId = BEACH_PHOTOS_BY_ID[String(beachId)];
  if (byId && byId.length) return { has: true, source: 'by-id:geo-verified' };

  const atticaKey = aliasKey(ATTICA_AREA_ALIASES, islandName);
  if (atticaKey) {
    const t = ATTICA_BEACH_PHOTOS_BY_AREA[atticaKey];
    if (t && findPhotos(t, gr, en).length) return { has: true, source: `attica:${atticaKey}` };
    if (t) return { has: false, source: '' };
  }
  const creteKey = aliasKey(CRETE_AREA_ALIASES, islandName);
  if (creteKey) {
    const t = CRETE_BEACH_PHOTOS_BY_AREA[creteKey];
    if (t && findPhotos(t, gr, en).length) return { has: true, source: `crete:${creteKey}` };
    if (t) return { has: false, source: '' };
  }
  const macKey = aliasKey(MACEDONIA_AREA_ALIASES, islandName);
  if (macKey) {
    const t = MACEDONIA_BEACH_PHOTOS_BY_AREA[macKey];
    if (t && findPhotos(t, gr, en).length) return { has: true, source: `macedonia:${macKey}` };
    if (t) return { has: false, source: '' };
  }
  const thraceKey = aliasKey(THRACE_AREA_ALIASES, islandName);
  if (thraceKey) {
    const t = THRACE_BEACH_PHOTOS_BY_AREA[thraceKey];
    if (t && findPhotos(t, gr, en).length) return { has: true, source: `thrace:${thraceKey}` };
    if (t) return { has: false, source: '' };
  }
  const naKey = aliasKey(NORTH_AEGEAN_AREA_ALIASES, islandName);
  if (naKey) {
    const t = NORTH_AEGEAN_BEACH_PHOTOS_BY_AREA[naKey];
    if (t && findPhotos(t, gr, en).length) return { has: true, source: `north-aegean:${naKey}` };
    if (t) return { has: false, source: '' };
  }
  const cycKey = aliasKey(CYCLADES_ISLAND_ALIASES, islandName);
  if (cycKey) {
    if (cycKey === 'milos') {
      const byId = isMilosIsland(islandName)
        ? milosImages.find((e) => String(e.beachId) === String(beachId) && e.imageStatus === 'verified')
        : undefined;
      const ng = normalizeLookup(gr);
      const ne = normalizeLookup(en);
      const byName = !byId && isMilosIsland(islandName)
        ? milosImages.find((e) =>
            e.imageStatus === 'verified' &&
            (normalizeLookup(e.beachName || '') === ng ||
             normalizeLookup(e.beachName || '') === ne ||
             normalizeLookup(e.beachNameEl || '') === ng ||
             normalizeLookup(e.beachNameEl || '') === ne))
        : undefined;
      const hit = byId || byName;
      return hit?.imageUrl ? { has: true, source: 'milos:verified-image' } : { has: false, source: '' };
    }
    const t = CYCLADES_BEACH_PHOTOS_BY_ISLAND[cycKey];
    const allowed = cycKey === 'milos' ? VERIFIED_MILOS_BEACH_PHOTO_KEYS : undefined;
    if (t && findPhotos(t, gr, en, allowed).length) return { has: true, source: `cyclades:${cycKey}` };
    return { has: false, source: '' };
  }
  // Ionian: app intentionally renders no beach photo.
  if (aliasKey(IONIAN_ISLAND_ALIASES, islandName)) return { has: false, source: '' };

  if (findPhotos(BEACH_PHOTOS, gr, en).length) return { has: true, source: 'global' };
  return { has: false, source: '' };
};

// ---------------------------------------------------------------------------
// 3. Walk every built app region file and classify each beach.
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
    const res = lookup(gr, en, b.id, islandNameEn);
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
// 4. Write CSV + JSON + summary.
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

console.log(summary);
console.log('');
console.log('Wrote:');
console.log('  reports/photo-coverage/beach-photo-presence.csv');
console.log('  reports/photo-coverage/beach-photo-presence.json');
console.log('  reports/photo-coverage/beach-photo-presence-summary.txt');
