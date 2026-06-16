/**
 * Build ONE labeled overview montage per region from a discover candidates.json:
 * picks the best-verified tile per beach (prefer geo<=180m, else openverse-titled,
 * else first), draws the beach name on each cell. Lets a whole region be QA'd in
 * one image. Prints an index mapping cell -> beach + chosen tile url/license.
 *
 * Usage: node scripts/regionOverviewSheet.mjs <regionId>
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const UA = 'CalmBeachPhotoDiscovery/1.0 (https://calmbeach.gr)';
const region = process.argv[2];
const dir = path.resolve('reports/photo-coverage/discover', region);

const tokens = s => (s || '').toLowerCase().split(/[^a-zα-ω0-9]+/).filter(w => w.length > 3);

const pickTile = (b) => {
  const nm = tokens(b.nameEn + ' ' + b.nameGr);
  const score = t => {
    const m = t.source.match(/geo\((\d+)m\)/);
    if (m) return Number(m[1]) <= 180 ? 100 - Number(m[1]) / 10 : 5;
    const titleHit = nm.some(w => (t.title || '').toLowerCase().includes(w));
    if (t.source.startsWith('openverse') && titleHit) return 90;
    if (t.source === 'commons-name' && titleHit) return 80;
    if (t.source.startsWith('openverse')) return 40;
    return 10;
  };
  return b.tiles.slice().sort((a, c) => score(c) - score(a))[0];
};

const main = async () => {
  const d = JSON.parse(await readFile(path.join(dir, 'candidates.json'), 'utf8'));
  const cell = 300, ch = 200, cols = 4;
  const comp = [];
  const idx = [];
  let i = 0;
  for (const b of d) {
    const t = pickTile(b);
    if (!t) continue;
    try {
      const r = await fetch(t.thumb || t.src, { headers: { 'User-Agent': UA } });
      if (!r.ok) { i++; continue; }
      const base = await sharp(Buffer.from(await r.arrayBuffer())).resize(cell, ch, { fit: 'cover' }).toBuffer();
      const label = `${i}: ${(b.nameEn || b.nameGr).slice(0, 24)}`;
      const svg = Buffer.from(`<svg width="${cell}" height="${ch}"><rect x="0" y="${ch - 22}" width="${cell}" height="22" fill="rgba(0,0,0,0.6)"/><text x="5" y="${ch - 6}" font-family="sans-serif" font-size="14" fill="#fff">${label.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text></svg>`);
      const tile = await sharp(base).composite([{ input: svg }]).toBuffer();
      comp.push({ input: tile, left: (i % cols) * cell, top: Math.floor(i / cols) * ch });
      idx.push({ cell: i, beach: b.nameEn || b.nameGr, nameGr: b.nameGr, nameEn: b.nameEn, src: t.src, license: t.license, creator: t.creator, source: t.source, commonsFile: t.commonsFile || null });
    } catch { /* skip */ }
    i++;
  }
  const rows = Math.ceil(i / cols);
  const out = path.join(dir, '_overview.jpg');
  await sharp({ create: { width: cols * cell, height: Math.max(1, rows) * ch, channels: 3, background: '#111' } })
    .composite(comp).jpeg().toFile(out);
  await writeFile(path.join(dir, '_overview.json'), JSON.stringify(idx, null, 1));
  console.log('cells:', i, '->', path.relative(process.cwd(), out));
  idx.forEach(x => console.log(`  ${x.cell}: ${x.beach}  [${x.source}|${x.license}]`));
};
main().catch(e => { console.error(e); process.exitCode = 1; });
