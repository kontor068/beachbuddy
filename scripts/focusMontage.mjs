/**
 * Focused re-QA montage of a SUBSET of flagged cells (from a cls-*.json list),
 * larger cells (4x4=16/sheet) + clear gi labels, composited from already-downloaded
 * local images (reports/photo-coverage/qa-img). Lets me re-verify ambiguous flags
 * precisely (every cell is a candidate, so position drift is harmless).
 *
 * Usage: node scripts/focusMontage.mjs <cls-file.json> <outPrefix>
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const ROOT = path.resolve('.');
const REPORT = path.join(ROOT, 'reports', 'photo-coverage');
const IMGDIR = path.join(REPORT, 'qa-img');
const OUTDIR = path.join(REPORT, 'qa-focus');
const hash = s => crypto.createHash('md5').update(s).digest('hex').slice(0, 16);
const commonsFile = u => decodeURIComponent((u.match(/Special:Redirect\/file\/([^&]+)/) || [])[1] || '');

const main = async () => {
  await mkdir(OUTDIR, { recursive: true });
  const list = JSON.parse(await readFile(path.join(REPORT, process.argv[2]), 'utf8'));
  const rows = JSON.parse(await readFile(path.join(REPORT, 'displayed-photos.json'), 'utf8'));
  const fcache = JSON.parse(await readFile(path.join(REPORT, 'idqa-thumbs-cache.json'), 'utf8'));
  const fetchUrlOf = r => { const f = commonsFile(r.url); return f ? fcache[f] : r.url; };
  const imgPathOf = r => { const fu = fetchUrlOf(r); return fu ? path.join(IMGDIR, hash(fu) + '.jpg') : null; };

  const cell = 300, ch = 200, cols = 4, rowsN = 4, per = cols * rowsN;
  const prefix = process.argv[3] || 'focus';
  let i = 0, comp = [];
  const flush = async (n) => {
    if (comp.length) await sharp({ create: { width: cols * cell, height: rowsN * ch, channels: 3, background: '#111' } })
      .composite(comp).jpeg({ quality: 82 }).toFile(path.join(OUTDIR, `${prefix}_${String(n).padStart(2, '0')}.jpg`));
    comp = [];
  };
  for (const item of list) {
    const r = rows[item.gi]; const pos = i % per;
    const p = r ? imgPathOf(r) : null;
    if (p && existsSync(p) && statSync(p).size > 0) {
      try {
        const base = await sharp(p).resize(cell, ch, { fit: 'cover' }).toBuffer();
        const label = `${item.gi} ${item.id} ${(r.nameGr || '').slice(0, 18)}`.replace(/[&<>]/g, '');
        const svg = Buffer.from(`<svg width="${cell}" height="${ch}"><rect x="0" y="${ch - 20}" width="${cell}" height="20" fill="rgba(0,0,0,.75)"/><text x="4" y="${ch - 5}" font-family="sans-serif" font-size="14" fill="#fff">${label}</text></svg>`);
        comp.push({ input: await sharp(base).composite([{ input: svg }]).toBuffer(), left: pos % cols * cell, top: Math.floor(pos / cols) * ch });
      } catch {}
    }
    i++;
    if (i % per === 0) await flush(Math.floor((i - 1) / per));
  }
  await flush(Math.floor((i - 1) / per));
  console.log(`Wrote ${Math.ceil(i / per)} focus sheets for ${list.length} cells -> ${path.relative(ROOT, OUTDIR)}/${prefix}_*`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
