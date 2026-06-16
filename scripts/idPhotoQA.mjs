/**
 * Bulk visual-QA for the GPS-harvested by-ID photos.
 * Builds big labeled montage sheets (48/sheet) of data/beachPhotosById.generated.json
 * so the whole harvest can be eyeballed quickly. Writes an index mapping each global
 * cell number -> beachId. Use idPhotoPrune.mjs to drop bad cells/ids.
 *
 * Usage: node scripts/idPhotoQA.mjs
 * Output: reports/photo-coverage/idqa/sheet_00.jpg ... + idqa-index.json
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const UA = 'CalmBeachIDQA/1.0';
const ROOT = path.resolve('.');
const OUTDIR = path.join(ROOT, 'reports', 'photo-coverage', 'idqa');

const main = async () => {
  // id -> nameGr/region
  const idMap = {};
  const appDir = path.join(ROOT, 'public/data/beaches/app');
  for (const f of readdirSync(appDir).filter(x => x.endsWith('.json'))) {
    try {
      const d = JSON.parse(await readFile(path.join(appDir, f), 'utf8'));
      const isl = d.island?.name?.gr || d.region?.name?.gr || f;
      for (const b of d.island?.beaches || []) idMap[b.id] = { name: b.name?.gr || b.name?.en || '?', isl };
    } catch {}
  }
  const photos = JSON.parse(await readFile(path.join(ROOT, 'data/beachPhotosById.generated.json'), 'utf8'));
  const ids = Object.keys(photos);

  // Resolve real CDN thumbnail URLs (upload.wikimedia.org) via API — avoids the
  // Special:Redirect rate-limit. Map beachId -> thumbUrl.
  const sleepA = ms => new Promise(r => setTimeout(r, ms));
  const fileOf = id => decodeURIComponent((photos[id][0].match(/file\/([^&]+)/) || [])[1] || '');
  // Cache resolved file -> thumbUrl across runs (the API resolution is the slow,
  // throttled part). Re-runs only resolve files not already cached.
  const CACHE = path.join(ROOT, 'reports', 'photo-coverage', 'idqa-thumbs-cache.json');
  let fcache = {};
  try { fcache = JSON.parse(await readFile(CACHE, 'utf8')); } catch {}
  const thumbUrl = {};
  const idsByFile = {};
  for (const id of ids) { const f = fileOf(id); if (f) (idsByFile[f] = idsByFile[f] || []).push(id); }
  const allFiles = Object.keys(idsByFile);
  const need = allFiles.filter(f => !fcache[f]);
  process.stderr.write(`thumbs: ${allFiles.length - need.length} cached, ${need.length} to resolve\n`);
  for (let i = 0; i < need.length; i += 40) {
    const titles = need.slice(i, i + 40).map(f => 'File:' + f).join('|');
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=220&titles=${encodeURIComponent(titles)}`;
    let d = null;
    for (let a = 0; a < 4; a++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) { d = await r.json(); break; } await sleepA(1500); } catch { await sleepA(800); } }
    const norm = {}; for (const n of d?.query?.normalized || []) norm[n.to] = n.from;
    for (const p of Object.values(d?.query?.pages || {})) {
      const t = p.imageinfo?.[0]?.thumburl; if (!t) continue;
      const f = (norm[p.title] || p.title).replace('File:', '');
      fcache[f] = t;
    }
    await writeFile(CACHE, JSON.stringify(fcache));
    await sleepA(150);
    process.stderr.write(`  resolved ${Math.min(i + 40, need.length)}/${need.length}\n`);
  }
  for (const f of allFiles) { const t = fcache[f]; if (t) for (const id of idsByFile[f]) thumbUrl[id] = t; }
  process.stderr.write(`thumbUrl mapped for ${Object.keys(thumbUrl).length}/${ids.length} ids; clearing OUTDIR...\n`);
  await rm(OUTDIR, { recursive: true, force: true });
  await mkdir(OUTDIR, { recursive: true });
  process.stderr.write(`OUTDIR ready; starting build loop\n`);

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const fetchBuf = async url => {
    for (let a = 0; a < 2; a++) {
      try {
        const ac = new AbortController();
        const to = setTimeout(() => ac.abort(), 5000);
        const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
        clearTimeout(to);
        if (r.ok) return Buffer.from(await r.arrayBuffer());
        if (r.status === 429) { await sleep(1000); continue; }
        return null;
      } catch { return null; }
    }
    return null;
  };

  const cell = 200, ch = 134, cols = 6, rows = 8, per = cols * rows;
  const indexOut = [];
  let i = 0, comp = [];
  const flush = async (sheetNo) => {
    await sharp({ create: { width: cols * cell, height: rows * ch, channels: 3, background: '#111' } })
      .composite(comp).jpeg({ quality: 78 }).toFile(path.join(OUTDIR, `sheet_${String(sheetNo).padStart(2, '0')}.jpg`));
    comp = [];
  };
  for (const id of ids) {
    const gi = i;
    const pos = i % per;
    const buf = thumbUrl[id] ? await fetchBuf(thumbUrl[id]) : null;
    if (buf) {
      try {
        const meta = idMap[id] || { name: '?', isl: '' };
        const base = await sharp(buf).resize(cell, ch, { fit: 'cover' }).toBuffer();
        const label = `${gi} ${meta.name}`.slice(0, 26).replace(/[&<>]/g, '');
        const svg = Buffer.from(`<svg width="${cell}" height="${ch}"><rect x="0" y="${ch - 16}" width="${cell}" height="16" fill="rgba(0,0,0,.65)"/><text x="3" y="${ch - 4}" font-family="sans-serif" font-size="11" fill="#fff">${label}</text></svg>`);
        comp.push({ input: await sharp(base).composite([{ input: svg }]).toBuffer(), left: (pos % cols) * cell, top: Math.floor(pos / cols) * ch });
      } catch {}
    }
    indexOut.push({ gi, id, name: (idMap[id] || {}).name, isl: (idMap[id] || {}).isl });
    i++;
    if (i % 25 === 0) process.stderr.write(`  ..${i}/${ids.length}\n`);
    if (i % per === 0) { await flush(Math.floor((i - 1) / per)); process.stderr.write(`  sheet ${Math.floor((i - 1) / per)} done (${i}/${ids.length})\n`); }
  }
  if (comp.length) await flush(Math.floor((i - 1) / per));
  await writeFile(path.join(OUTDIR, 'idqa-index.json'), JSON.stringify(indexOut, null, 0) + '\n');
  const sheetCount = Math.ceil(ids.length / per);
  console.log(`Wrote ~${sheetCount} sheets for ${ids.length} photos -> ${path.relative(ROOT, OUTDIR)}`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
