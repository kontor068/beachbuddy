/**
 * Photo-candidate helper for the autonomous coverage work.
 *
 * Given a Commons category, returns its files (and optionally picks the Nth).
 * Downloads chosen files and builds a montage contact-sheet for one-look QA.
 *
 * Usage:
 *   node scripts/photoCandidates.mjs cat "Category:Beaches of Zakynthos"      # list files
 *   node scripts/photoCandidates.mjs sheet out.jpg "File A.jpg" "File B.jpg"  # montage given files
 *   node scripts/photoCandidates.mjs lic "File A.jpg"                          # license+author
 *   node scripts/photoCandidates.mjs http "File A.jpg"                         # render HTTP status
 */
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const UA = 'CalmBeachImageOptimizer/1.0 (https://calmbeach.gr)';
const tmp = path.resolve('.tmp/cand');

const api = async params => {
  const url = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({ format: 'json', ...params });
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  return r.json();
};

const redirectUrl = (file, width = 320) =>
  `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(file)}&width=${width}`;

const download = async (file, dest, width = 320) => {
  const r = await fetch(redirectUrl(file, width), { headers: { 'User-Agent': UA } });
  if (!r.ok) return false;
  await writeFile(dest, Buffer.from(await r.arrayBuffer()));
  return true;
};

const catFiles = async (category, limit = 8) => {
  const d = await api({ action: 'query', list: 'categorymembers', cmtitle: category, cmtype: 'file', cmlimit: String(limit) });
  return (d.query?.categorymembers || []).map(x => x.title.replace('File:', ''));
};

const license = async file => {
  const d = await api({ action: 'query', prop: 'imageinfo', iiprop: 'url|size|extmetadata', titles: 'File:' + file });
  const p = Object.values(d.query?.pages || {})[0];
  if (!p?.imageinfo) return { file, missing: true };
  const em = p.imageinfo[0].extmetadata || {};
  const g = k => (em[k]?.value || '').replace(/<[^>]+>/g, '').trim();
  return { file, license: g('LicenseShortName'), author: g('Artist').slice(0, 30), w: p.imageinfo[0].width, h: p.imageinfo[0].height };
};

const sheet = async (out, files) => {
  await mkdir(tmp, { recursive: true });
  const cell = 250, ch = 165, cols = 4;
  const comp = [];
  const labels = [];
  let i = 0;
  for (const f of files) {
    const dest = path.join(tmp, `c${i}.img`);
    const ok = await download(f, dest, 300);
    if (!ok) { labels.push(`${i}: [404] ${f}`); i++; continue; }
    try {
      const buf = await sharp(dest).resize(cell, ch, { fit: 'cover' }).toBuffer();
      comp.push({ input: buf, left: (i % cols) * cell, top: Math.floor(i / cols) * ch });
      labels.push(`${i}: ${f}`);
    } catch { labels.push(`${i}: [badimg] ${f}`); }
    i++;
  }
  const rows = Math.ceil(i / cols);
  await sharp({ create: { width: cols * cell, height: Math.max(1, rows) * ch, channels: 3, background: '#222' } })
    .composite(comp).jpeg().toFile(out);
  return labels;
};

const main = async () => {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === 'cat') {
    const files = await catFiles(rest[0], Number(rest[1]) || 8);
    files.forEach(f => console.log(f));
  } else if (cmd === 'sheet') {
    const [out, ...files] = rest;
    const labels = await sheet(out, files);
    console.log(labels.join('\n'));
    console.log('-> ' + out);
  } else if (cmd === 'lic') {
    for (const f of rest) {
      const l = await license(f);
      console.log(l.missing ? `MISSING ${f}` : `${l.license} | ${l.author} | ${l.w}x${l.h} | ${f}`);
    }
  } else if (cmd === 'http') {
    for (const f of rest) {
      const r = await fetch(redirectUrl(f, 200), { headers: { 'User-Agent': UA }, redirect: 'follow' });
      console.log(`${r.status}  ${f}`);
    }
  } else {
    console.error('unknown cmd', cmd);
    process.exitCode = 1;
  }
};

main().catch(e => { console.error(e); process.exitCode = 1; });
