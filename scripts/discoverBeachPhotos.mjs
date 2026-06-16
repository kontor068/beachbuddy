/**
 * Multi-source beach-photo discovery (coordinate-first + Openverse).
 *
 * For each MISSING beach in a region (from reports/photo-coverage/missing-beaches.csv,
 * coords from the app data file), it queries free-licensed sources:
 *   1. Openverse  — text "<EN> <island> beach" / "<GR> παραλία" (license cc0,by,by-sa,pdm)
 *                   = the whole Flickr CC corpus + Commons + museums, no API key.
 *   2. Commons geosearch — files with GPS within a radius of the beach coords.
 *   3. Commons name search — title contains the beach name.
 *
 * It downloads thumbnails and builds ONE montage contact-sheet per beach (a row),
 * so the photos can be visually QA'd in a single image, and writes a candidates
 * JSON with url/license/creator/source for every shown tile.
 *
 * Usage:
 *   node scripts/discoverBeachPhotos.mjs <regionIdSubstring> [maxBeaches] [perBeach]
 *   e.g. node scripts/discoverBeachPhotos.mjs crete-crete-chania 12 4
 *
 * Outputs:
 *   reports/photo-coverage/discover/<region>/<NN>_<slug>.jpg   (montage per beach)
 *   reports/photo-coverage/discover/<region>/candidates.json   (tile index)
 */
import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const UA = 'CalmBeachPhotoDiscovery/1.0 (https://calmbeach.gr; local dev)';
const ROOT = path.resolve('.');
const OUT_ROOT = path.join(ROOT, 'reports', 'photo-coverage', 'discover');

const FREE = new Set(['cc0', 'by', 'by-sa', 'pdm']); // commercial-OK only

// Auto-reject obviously-non-beach subjects (cuts the noise I was rejecting by hand).
const NEG = /church|chapel|μον[ήη]|μοναστ|εκκλησ|ναός|castle|κάστρο|fortress|φρούριο|tower|museum|μουσε[ίι]ο|windmill|ανεμόμυλ|fingerpost|σήμα|πινακίδα|road sign|fresco|τοιχογ|\bISS\b|earth\.jpg|view of earth|butterfly|πεταλούδ|flower|λουλούδ|orchid|cemetery|νεκροταφ|ruins|ερείπ|aerial view of greece|panorama of earth|shipyard|ναυπηγ|excavation|ανασκαφ/i;

const stripAccents = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => stripAccents(String(s || '')).toLowerCase();

// island-token guard: a name/openverse tile must mention the island (EN or GR) or
// the beach's own name, else it's likely a cross-island collision (Vai/Crete/Germany).
const mentionsAny = (text, tokens) => {
  const t = norm(text);
  return tokens.some(tok => tok && tok.length >= 4 && t.includes(norm(tok)));
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

const getJson = async url => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return r.json();
      if (r.status === 429) { await sleep(1500); continue; }
      return null;
    } catch { await sleep(800); }
  }
  return null;
};

// --- Sources -------------------------------------------------------------

const openverse = async (query) => {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,by,by-sa,pdm&page_size=10`;
  const d = await getJson(url);
  if (!d?.results) return [];
  return d.results.map(r => ({
    src: r.url,
    thumb: r.thumbnail || r.url,
    title: r.title || '',
    license: r.license + (r.license_version ? ` ${r.license_version}` : ''),
    licenseKey: r.license,
    creator: r.creator || '',
    sourcePage: r.foreign_landing_url || '',
    source: `openverse:${r.source || ''}`,
  })).filter(x => x.src);
};

const commonsThumb = (file, w = 360) =>
  `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(file)}&width=${w}`;

const commonsExtmeta = async (titles) => {
  // titles: array of 'File:...'; return map file->{license,creator}
  const out = {};
  for (let i = 0; i < titles.length; i += 25) {
    const chunk = titles.slice(i, i + 25);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata|url&titles=${encodeURIComponent(chunk.join('|'))}`;
    const d = await getJson(url);
    const pages = d?.query?.pages || {};
    for (const p of Object.values(pages)) {
      const em = p.imageinfo?.[0]?.extmetadata || {};
      const g = k => (em[k]?.value || '').replace(/<[^>]+>/g, '').trim();
      out[p.title] = {
        license: g('LicenseShortName'),
        licenseKey: (g('License') || '').toLowerCase(),
        creator: g('Artist').slice(0, 40),
      };
    }
  }
  return out;
};

const commonsGeo = async (lat, lon, radius) => {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${radius}&gsnamespace=6&gslimit=10`;
  const d = await getJson(url);
  const gs = d?.query?.geosearch || [];
  return gs.map(x => ({ file: x.title, dist: Math.round(x.dist) }));
};

const commonsName = async (query) => {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=6&srsearch=${encodeURIComponent(query)}`;
  const d = await getJson(url);
  return (d?.query?.search || []).map(x => x.title);
};

const isImageFile = t => /\.(jpe?g|png)$/i.test(t);

// --- Per-beach candidate gathering --------------------------------------

const gatherForBeach = async (beach, island, islandGr) => {
  const { nameEn, nameGr, lat, lon } = beach;
  // tokens that confirm the right location for NON-geo sources
  const locTokens = [island, islandGr, nameEn, nameGr].filter(Boolean);
  const cands = [];
  const seen = new Set();
  const add = c => { const k = c.src || c.file; if (k && !seen.has(k)) { seen.add(k); cands.push(c); } };

  // 1. Openverse (3 queries). Require island/beach token AND not a negative subject.
  for (const q of [`${nameEn} ${island} beach`, `${nameGr} ${island}`, `${nameEn} beach Greece`]) {
    for (const r of await openverse(q)) {
      if (!FREE.has(r.licenseKey)) continue;
      if (NEG.test(r.title)) continue;
      if (!mentionsAny(r.title, locTokens)) continue; // anti-collision
      add(r);
    }
    if (cands.length >= 12) break;
  }

  // 2. Commons geosearch (escalating radius) — GPS-verified, exempt from token guard.
  const geoFiles = [];
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    for (const radius of [120, 350, 700]) {
      for (const g of await commonsGeo(lat, lon, radius)) {
        if (isImageFile(g.file) && !NEG.test(g.file)) geoFiles.push(g);
      }
      if (geoFiles.length >= 8) break;
    }
  }

  // 3. Commons name search — require island/beach token in filename.
  const nameFiles = [];
  for (const q of [`${nameEn} ${island} beach`, `${nameGr} παραλία`, `${nameGr} ${islandGr}`]) {
    for (const f of await commonsName(q)) {
      if (isImageFile(f) && !NEG.test(f) && mentionsAny(f, locTokens)) nameFiles.push(f);
    }
    if (nameFiles.length >= 6) break;
  }

  // resolve Commons licenses for geo+name files
  const commonsTitles = [...new Set([...geoFiles.map(g => g.file), ...nameFiles])].slice(0, 14);
  if (commonsTitles.length) {
    const meta = await commonsExtmeta(commonsTitles);
    const freeLic = m => /^cc-?(by|by-sa|0|zero|pdm)/.test(m.licenseKey) || /public domain|cc0/i.test(m.license);
    for (const g of geoFiles) {
      const m = meta[g.file]; if (!m || !freeLic(m)) continue;
      const file = g.file.replace('File:', '');
      add({ src: commonsThumb(file, 800), thumb: commonsThumb(file, 360), title: file, license: m.license, creator: m.creator, sourcePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(g.file)}`, source: `commons-geo(${g.dist}m)`, commonsFile: file });
    }
    for (const f of nameFiles) {
      const m = meta[f]; if (!m || !freeLic(m)) continue;
      const file = f.replace('File:', '');
      add({ src: commonsThumb(file, 800), thumb: commonsThumb(file, 360), title: file, license: m.license, creator: m.creator, sourcePage: `https://commons.wikimedia.org/wiki/${encodeURIComponent(f)}`, source: 'commons-name', commonsFile: file });
    }
  }

  return cands.slice(0, 8);
};

// --- Montage -------------------------------------------------------------

const buildMontage = async (outFile, tiles) => {
  const cell = 240, ch = 160, cols = 4;
  const comp = [];
  let i = 0;
  for (const t of tiles) {
    try {
      const r = await fetch(t.thumb || t.src, { headers: { 'User-Agent': UA } });
      if (!r.ok) { i++; continue; }
      const buf = Buffer.from(await r.arrayBuffer());
      const img = await sharp(buf).resize(cell, ch, { fit: 'cover' }).toBuffer();
      comp.push({ input: img, left: (i % cols) * cell, top: Math.floor(i / cols) * ch });
    } catch { /* skip bad */ }
    i++;
  }
  if (!comp.length) return false;
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * cell, height: rows * ch, channels: 3, background: '#222' } })
    .composite(comp).jpeg().toFile(outFile);
  return true;
};

// --- Main ----------------------------------------------------------------

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30);

const main = async () => {
  const regionSub = process.argv[2];
  const maxBeaches = Number(process.argv[3]) || 15;
  if (!regionSub) { console.error('usage: discoverBeachPhotos.mjs <regionIdSubstring> [maxBeaches]'); process.exit(1); }

  const index = JSON.parse(await readFile(path.join(ROOT, 'public/data/beaches/index.json'), 'utf8'));
  const region = index.regions.find(r => r.id.includes(regionSub));
  if (!region) { console.error('region not found:', regionSub); process.exit(1); }

  const missingCsv = await readFile(path.join(ROOT, 'reports/photo-coverage/missing-beaches.csv'), 'utf8');
  const missingIds = new Set(
    missingCsv.split('\n').slice(1).filter(Boolean)
      .filter(l => l.includes(region.id))
      .map(l => l.split(',')[3]),
  );

  const appPath = path.join(ROOT, 'public', region.appDataPath.replace(/^\/+/, ''));
  if (!existsSync(appPath)) { console.error('no app file', appPath); process.exit(1); }
  const app = JSON.parse(await readFile(appPath, 'utf8'));
  const island = region.name.en;
  const islandGr = region.name.gr || '';
  const beaches = (app.island?.beaches || [])
    .filter(b => missingIds.has(String(b.id)))
    .map(b => ({ id: b.id, nameEn: b.name?.en || '', nameGr: b.name?.gr || '', lat: b.coordinates?.lat, lon: b.coordinates?.lon, pop: b.popularityScore ?? (b.rating ? b.rating * 20 : 0) }))
    .sort((a, b) => b.pop - a.pop) // hottest missing beaches first
    .slice(0, maxBeaches);

  const outDir = path.join(OUT_ROOT, region.id);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  console.log(`Region ${region.id} (${island}) — discovering for ${beaches.length} missing beaches...`);
  const indexOut = [];
  let n = 0;
  for (const b of beaches) {
    const cands = await gatherForBeach(b, island, islandGr);
    if (!cands.length) { console.log(`  [${b.nameEn || b.nameGr}] no candidates`); continue; }
    const file = `${String(n).padStart(2, '0')}_${slugify(b.nameEn || b.nameGr)}.jpg`;
    const ok = await buildMontage(path.join(outDir, file), cands);
    if (ok) {
      indexOut.push({ montage: file, beachId: b.id, nameGr: b.nameGr, nameEn: b.nameEn, lat: b.lat, lon: b.lon, tiles: cands.map((c, idx) => ({ idx, ...c })) });
      console.log(`  ${file}: ${cands.length} tiles  (${b.nameGr})`);
      n++;
    }
  }
  await writeFile(path.join(outDir, 'candidates.json'), JSON.stringify(indexOut, null, 1));
  console.log(`\nWrote ${n} montages + candidates.json to ${path.relative(ROOT, outDir)}`);
};

main().catch(e => { console.error(e); process.exitCode = 1; });
