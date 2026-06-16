/**
 * Two-phase visual-QA montage for the GPS-harvested by-ID photos.
 * Phase 1: download each beach's thumbnail to reports/photo-coverage/idqa/img/<id>.jpg
 *          (parallel, resumable — skips files already on disk, fail-fast per URL).
 * Phase 2: composite labeled contact sheets (48/sheet) purely from local files +
 *          write idqa-index.json mapping global cell index -> beachId.
 *
 * Usage: node scripts/idMontage.mjs
 */
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const UA = 'CalmBeachIDQA/1.0 (https://calmbeach.gr; contact dev)';
const ROOT = path.resolve('.');
const OUTDIR = path.join(ROOT, 'reports', 'photo-coverage', 'idqa');
const IMGDIR = path.join(OUTDIR, 'img');
const CACHE = path.join(ROOT, 'reports', 'photo-coverage', 'idqa-thumbs-cache.json');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const main = async () => {
  await mkdir(IMGDIR, { recursive: true });
  const photos = JSON.parse(await readFile(path.join(ROOT, 'data/beachPhotosById.generated.json'), 'utf8'));
  const fcache = JSON.parse(await readFile(CACHE, 'utf8'));
  const ids = Object.keys(photos);
  const idMap = {};
  const appDir = path.join(ROOT, 'public/data/beaches/app');
  for (const f of readdirSync(appDir).filter(x => x.endsWith('.json'))) {
    try {
      const d = JSON.parse(await readFile(path.join(appDir, f), 'utf8'));
      const isl = d.island?.name?.gr || d.region?.name?.gr || f;
      for (const b of d.island?.beaches || []) idMap[b.id] = { name: b.name?.gr || b.name?.en || '?', isl };
    } catch {}
  }
  const fileOf = id => decodeURIComponent((photos[id][0].match(/file\/([^&]+)/) || [])[1] || '');
  const imgPath = id => path.join(IMGDIR, `${id}.jpg`);

  // Phase 1: parallel download (skip existing non-empty files)
  const todo = ids.filter(id => fcache[fileOf(id)] && !(existsSync(imgPath(id)) && statSync(imgPath(id)).size > 0));
  process.stderr.write(`download: ${ids.length - todo.length} on disk, ${todo.length} to fetch\n`);
  const dl = async id => {
    const url = fcache[fileOf(id)];
    for (let a = 0; a < 2; a++) {
      try {
        const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 6000);
        const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ac.signal });
        clearTimeout(to);
        if (r.ok) { await writeFile(imgPath(id), Buffer.from(await r.arrayBuffer())); return true; }
        if (r.status === 429) { await sleep(1000); continue; }
        return false;
      } catch { return false; }
    }
    return false;
  };
  let done = 0, ok = 0;
  const CONC = 12;
  for (let i = 0; i < todo.length; i += CONC) {
    const batch = todo.slice(i, i + CONC);
    const res = await Promise.all(batch.map(dl));
    ok += res.filter(Boolean).length; done += batch.length;
    process.stderr.write(`  ${done}/${todo.length} (ok ${ok})\n`);
  }

  // Phase 2: build sheets from local files
  const cell = 200, ch = 134, cols = 6, rows = 8, per = cols * rows;
  const indexOut = [];
  let i = 0, comp = [];
  const flush = async (sheetNo) => {
    await sharp({ create: { width: cols * cell, height: rows * ch, channels: 3, background: '#111' } })
      .composite(comp).jpeg({ quality: 80 }).toFile(path.join(OUTDIR, `sheet_${String(sheetNo).padStart(2, '0')}.jpg`));
    comp = [];
    process.stderr.write(`  sheet ${sheetNo} written\n`);
  };
  for (const id of ids) {
    const gi = i, pos = i % per;
    if (existsSync(imgPath(id)) && statSync(imgPath(id)).size > 0) {
      try {
        const meta = idMap[id] || { name: '?', isl: '' };
        const base = await sharp(imgPath(id)).resize(cell, ch, { fit: 'cover' }).toBuffer();
        const label = `${gi} ${meta.name}`.slice(0, 26).replace(/[&<>]/g, '');
        const svg = Buffer.from(`<svg width="${cell}" height="${ch}"><rect x="0" y="${ch - 16}" width="${cell}" height="16" fill="rgba(0,0,0,.65)"/><text x="3" y="${ch - 4}" font-family="sans-serif" font-size="11" fill="#fff">${label}</text></svg>`);
        comp.push({ input: await sharp(base).composite([{ input: svg }]).toBuffer(), left: (pos % cols) * cell, top: Math.floor(pos / cols) * ch });
      } catch {}
    }
    indexOut.push({ gi, id, name: (idMap[id] || {}).name, isl: (idMap[id] || {}).isl });
    i++;
    if (i % per === 0) await flush(Math.floor((i - 1) / per));
  }
  if (comp.length) await flush(Math.floor((i - 1) / per));
  await writeFile(path.join(OUTDIR, 'idqa-index.json'), JSON.stringify(indexOut, null, 0) + '\n');
  console.log(`Wrote ${Math.ceil(ids.length / per)} sheets for ${ids.length} photos (downloaded ok ${ok}).`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
