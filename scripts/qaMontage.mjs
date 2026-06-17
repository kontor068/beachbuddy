/**
 * Full visual-QA montage of EVERY displayed beach photo (by-id + name-map + Milos).
 * Reads reports/photo-coverage/displayed-photos.json (from auditBeachPhotoCoverage.mjs).
 *
 * Phase 1: resolve Commons thumbnail URLs (cached) and download each photo to
 *          reports/photo-coverage/qa-img/<urlhash>.jpg (parallel, resumable, deduped by URL).
 * Phase 2: composite labeled contact sheets (48/sheet) + write qa-index.json mapping
 *          global cell index -> {beachId, nameGr, isl, src}. Use idPhotoPrune/pruneAndBlock
 *          (by-id) or hand-edit beachPhotos.ts (name-map) for the flagged cells.
 *
 * Usage: node scripts/qaMontage.mjs [startSheet] [endSheet]   (sheet range optional)
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const UA = 'CalmBeachQA/1.0 (https://calmbeach.gr; contact dev)';
const ROOT = path.resolve('.');
const REPORT = path.join(ROOT, 'reports', 'photo-coverage');
const OUTDIR = path.join(REPORT, 'qa');
const IMGDIR = path.join(REPORT, 'qa-img');
const CACHE = path.join(REPORT, 'idqa-thumbs-cache.json'); // filename -> CDN thumburl
const sleep = ms => new Promise(r => setTimeout(r, ms));
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 16);
const commonsFile = u => decodeURIComponent((u.match(/Special:Redirect\/file\/([^&]+)/) || [])[1] || '');

const main = async () => {
  await mkdir(IMGDIR, { recursive: true });
  await mkdir(OUTDIR, { recursive: true });
  const rows = JSON.parse(await readFile(path.join(REPORT, 'displayed-photos.json'), 'utf8'));
  let fcache = {};
  try { fcache = JSON.parse(await readFile(CACHE, 'utf8')); } catch {}

  // Resolve Commons files -> CDN thumb URL (batch, cache). Raw URLs used directly.
  const commonsNeeded = [...new Set(rows.map(r => commonsFile(r.url)).filter(f => f && !fcache[f]))];
  process.stderr.write(`commons thumbs: ${commonsNeeded.length} to resolve\n`);
  for (let i = 0; i < commonsNeeded.length; i += 40) {
    const titles = commonsNeeded.slice(i, i + 40).map(f => 'File:' + f).join('|');
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url&iiurlwidth=240&titles=${encodeURIComponent(titles)}`;
    let d = null;
    for (let a = 0; a < 4; a++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) { d = await r.json(); break; } await sleep(1500); } catch { await sleep(800); } }
    const norm = {}; for (const n of d?.query?.normalized || []) norm[n.to] = n.from;
    for (const p of Object.values(d?.query?.pages || {})) {
      const t = p.imageinfo?.[0]?.thumburl; if (!t) continue;
      fcache[(norm[p.title] || p.title).replace('File:', '')] = t;
    }
    await writeFile(CACHE, JSON.stringify(fcache));
    process.stderr.write(`  resolved ${Math.min(i + 40, commonsNeeded.length)}/${commonsNeeded.length}\n`);
    await sleep(150);
  }

  // fetch URL per row: Commons -> cached thumb; raw -> direct
  const fetchUrlOf = r => { const f = commonsFile(r.url); return f ? fcache[f] : r.url; };
  const imgPathOf = r => { const fu = fetchUrlOf(r); return fu ? path.join(IMGDIR, hash(fu) + '.jpg') : null; };

  // Phase 1: parallel resumable download (dedup by fetch URL)
  const todo = rows.filter(r => { const fu = fetchUrlOf(r); const p = imgPathOf(r); return fu && p && !(existsSync(p) && statSync(p).size > 0); });
  const uniq = [...new Map(todo.map(r => [fetchUrlOf(r), r])).values()];
  process.stderr.write(`download: ${uniq.length} unique imgs to fetch (of ${rows.length} rows)\n`);
  const dl = async r => {
    const fu = fetchUrlOf(r), p = imgPathOf(r);
    for (let a = 0; a < 4; a++) {
      try {
        const ac = new AbortController(); const to = setTimeout(() => ac.abort(), 9000);
        const res = await fetch(fu, { headers: { 'User-Agent': UA }, signal: ac.signal });
        clearTimeout(to);
        if (res.ok) { await writeFile(p, Buffer.from(await res.arrayBuffer())); return true; }
        if (res.status === 429) { await sleep(1500 * (a + 1)); continue; }
        return false;
      } catch { await sleep(500 * (a + 1)); }
    }
    return false;
  };
  // Low concurrency + inter-batch spacing keeps under the CDN rate limit (high
  // concurrency trips it and everything 429s). Slower bursts = higher success rate.
  let done = 0, ok = 0; const CONC = 4;
  for (let i = 0; i < uniq.length; i += CONC) {
    const res = await Promise.all(uniq.slice(i, i + CONC).map(dl));
    ok += res.filter(Boolean).length; done += res.length;
    await sleep(350);
    if (done % 100 < CONC || done >= uniq.length) process.stderr.write(`  ${done}/${uniq.length} (ok ${ok})\n`);
  }

  // Phase 2: build sheets
  const cell = 200, ch = 138, cols = 6, rowsN = 8, per = cols * rowsN;
  const startSheet = Number(process.argv[2]) || 0;
  const endSheet = Number(process.argv[3]) || Math.ceil(rows.length / per) - 1;
  const indexOut = [];
  let i = 0, comp = [];
  const flush = async (sheetNo) => {
    if (comp.length) await sharp({ create: { width: cols * cell, height: rowsN * ch, channels: 3, background: '#111' } })
      .composite(comp).jpeg({ quality: 80 }).toFile(path.join(OUTDIR, `sheet_${String(sheetNo).padStart(2, '0')}.jpg`));
    comp = [];
  };
  for (const r of rows) {
    const gi = i, sheetNo = Math.floor(i / per), pos = i % per;
    indexOut.push({ gi, beachId: r.beachId, name: r.nameGr, isl: r.isl, src: r.src });
    i++;
    if (sheetNo < startSheet || sheetNo > endSheet) { if (i % per === 0) await flush(sheetNo); continue; }
    const p = imgPathOf(r);
    if (p && existsSync(p) && statSync(p).size > 0) {
      try {
        const base = await sharp(p).resize(cell, ch, { fit: 'cover' }).toBuffer();
        const tag = r.src === 'name-map' ? '*' : '';
        const label = `${gi}${tag} ${r.nameGr}`.slice(0, 26).replace(/[&<>]/g, '');
        const svg = Buffer.from(`<svg width="${cell}" height="${ch}"><rect x="0" y="${ch - 16}" width="${cell}" height="16" fill="rgba(0,0,0,.7)"/><text x="3" y="${ch - 4}" font-family="sans-serif" font-size="11" fill="#fff">${label}</text></svg>`);
        comp.push({ input: await sharp(base).composite([{ input: svg }]).toBuffer(), left: pos % cols * cell, top: Math.floor(pos / cols) * ch });
      } catch {}
    }
    if (i % per === 0) await flush(sheetNo);
  }
  await flush(Math.floor((i - 1) / per));
  await writeFile(path.join(OUTDIR, 'qa-index.json'), JSON.stringify(indexOut, null, 0) + '\n');
  console.log(`Done. ${rows.length} rows, ${Math.ceil(rows.length / per)} sheets (${startSheet}..${endSheet}), downloaded ok ${ok}. -> ${path.relative(ROOT, OUTDIR)}`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
