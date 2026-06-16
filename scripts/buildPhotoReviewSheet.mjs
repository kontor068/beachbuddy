/**
 * Visual QA contact sheet for curated beach photos.
 *
 * For every beach in every region it calls the REAL resolver
 * (getBeachPhotoLookup, source==='exact') and emits an HTML page showing the
 * actual rendered thumbnail next to the beach + region name. Use it to spot
 * images that are not a clean beach (ports, villages, plants, etc.).
 *
 * Usage:
 *   node scripts/buildPhotoReviewSheet.mjs            (all regions with photos)
 *   node scripts/buildPhotoReviewSheet.mjs naxos      (filter by region substring)
 *
 * Output: reports/photo-coverage/photo-review.html
 */
import { mkdir, writeFile, rm, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const beachesDir = path.join(projectRoot, 'public', 'data', 'beaches');
const indexPath = path.join(beachesDir, 'index.json');
const outPath = path.join(projectRoot, 'reports', 'photo-coverage', 'photo-review.html');

const bundleResolver = async () => {
  const outFile = path.join(projectRoot, '.tmp', 'beachPhotos.review.cjs');
  await mkdir(path.dirname(outFile), { recursive: true });
  await build({
    entryPoints: [path.join(projectRoot, 'services', 'beachPhotos.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    outfile: outFile,
    logLevel: 'error',
    loader: { '.json': 'json' },
  });
  const mod = await import(`file://${outFile}?t=${Date.now()}`);
  return { getBeachPhotoLookup: mod.getBeachPhotoLookup, outFile };
};

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const main = async () => {
  const filter = (process.argv[2] || '').toLowerCase();
  const { getBeachPhotoLookup, outFile } = await bundleResolver();
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const regions = index.regions.filter(
    r => !filter || r.id.toLowerCase().includes(filter) || r.name.en.toLowerCase().includes(filter),
  );

  const sections = [];
  let totalPhotos = 0;

  for (const region of regions) {
    const appPath = path.join(projectRoot, 'public', region.appDataPath.replace(/^\/+/, ''));
    if (!existsSync(appPath)) continue;
    const appData = JSON.parse(await readFile(appPath, 'utf8'));
    const beaches = appData.island?.beaches ?? [];
    const islandName = region.name.en;

    const cards = [];
    for (const beach of beaches) {
      const lookup = getBeachPhotoLookup(beach.name?.gr ?? '', beach.name?.en ?? '', beach.id, 1, islandName);
      if (lookup.source !== 'exact' || !lookup.photos.length) continue;
      const src = lookup.photos[0];
      totalPhotos += 1;
      cards.push(
        `<figure><img loading="lazy" src="${esc(src)}"><figcaption><b>${esc(beach.name?.gr ?? '')}</b><br>${esc(beach.name?.en ?? '')}</figcaption></figure>`,
      );
    }
    if (cards.length) {
      sections.push(`<h2>${esc(region.name.gr)} / ${esc(region.name.en)} <small>(${cards.length})</small></h2><div class=grid>${cards.join('')}</div>`);
    }
  }

  await rm(outFile, { force: true });

  const html = `<!doctype html><meta charset=utf-8><title>Beach photo QA</title>
<style>
  body{font-family:system-ui,sans-serif;background:#0f1115;color:#e8e8e8;margin:0;padding:16px}
  h1{font-size:18px} h2{font-size:15px;border-bottom:1px solid #333;padding-top:18px;color:#8ec}
  .grid{display:flex;flex-wrap:wrap;gap:8px}
  figure{margin:0;width:200px}
  img{width:200px;height:134px;object-fit:cover;border-radius:6px;background:#222;display:block}
  figcaption{font-size:11px;line-height:1.3;padding:3px 1px;word-break:break-word}
</style>
<h1>Curated beach photos — visual QA (${totalPhotos} rendered)</h1>
<p style="font-size:12px;color:#999">Σκόπος: εντόπισε εικόνες που ΔΕΝ δείχνουν καθαρά παραλία (λιμάνι, χωριό, φυτό, βράχια). Πες μου ποιες και τις αντικαθιστώ/αφαιρώ.</p>
${sections.join('\n')}`;

  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, html);
  console.log(`Wrote ${outPath} (${totalPhotos} photos${filter ? `, filter "${filter}"` : ''})`);
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
