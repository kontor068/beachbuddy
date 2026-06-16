/**
 * Generate attribution credits for the harvested by-ID photos and write them into
 * public/IMAGE_CREDITS.txt (CC-BY / CC-BY-SA require author credit).
 * Idempotent: replaces any existing harvested block (between the markers) instead
 * of appending a duplicate. Handles Commons files (fetch Artist+License) and
 * raw Openverse/Flickr CC URLs (logged with source URL).
 *
 * Usage: node scripts/genIdCredits.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
const ROOT = path.resolve('.');
const UA = 'CalmBeachCredits/1.0 (https://calmbeach.gr)';
const BEGIN = '## BEGIN harvested per-beach photo credits (auto-generated)';
const END = '## END harvested per-beach photo credits';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const main = async () => {
  const photos = JSON.parse(await readFile(path.join(ROOT, 'data/beachPhotosById.generated.json'), 'utf8'));
  const allUrls = [...new Set(Object.values(photos).flat())];
  const commonsFiles = [...new Set(allUrls
    .map(u => decodeURIComponent((u.match(/file\/([^&]+)/) || [])[1] || '')).filter(Boolean))];
  const rawUrls = allUrls.filter(u => !/commons\.wikimedia\.org\/w\/index\.php\?title=Special:Redirect/.test(u));

  const meta = {};
  for (let i = 0; i < commonsFiles.length; i += 40) {
    const titles = commonsFiles.slice(i, i + 40).map(f => 'File:' + f).join('|');
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(titles)}`;
    let d = null;
    for (let a = 0; a < 5; a++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) { d = await r.json(); break; } await sleep(1500 * (a + 1)); } catch { await sleep(800); } }
    const norm = {}; for (const n of d?.query?.normalized || []) norm[n.to] = n.from;
    for (const p of Object.values(d?.query?.pages || {})) {
      const em = p.imageinfo?.[0]?.extmetadata || {};
      const g = k => (em[k]?.value || '').replace(/<[^>]+>/g, '').trim();
      const f = (norm[p.title] || p.title).replace('File:', '');
      meta[f] = { author: g('Artist').slice(0, 50) || '(see source)', license: g('LicenseShortName') || 'CC' };
    }
    await sleep(200);
    process.stderr.write(`  resolved ${Math.min(i + 40, commonsFiles.length)}/${commonsFiles.length}\n`);
  }

  const block = [BEGIN,
    `Harvested per-beach photos (${new Date().toISOString().slice(0, 10)}).`,
    'GPS-geotagged near the beach coordinates OR title-identified; all free licences',
    '(CC0 / Public Domain / CC BY / CC BY-SA). Attribution below; source links given.',
    `Wikimedia Commons files: ${commonsFiles.length} | Openverse/Flickr CC URLs: ${rawUrls.length}`,
    ''];
  for (const f of commonsFiles.sort()) {
    const m = meta[f] || { author: '(see source)', license: 'CC' };
    block.push(`File: ${f} | ${m.author} | ${m.license} | https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f)}`);
  }
  if (rawUrls.length) {
    block.push('', '-- Openverse / Flickr CC (direct CC-licensed image URLs; attribution at source) --');
    for (const u of rawUrls.sort()) block.push(`URL: ${u}`);
  }
  block.push(END);

  const credPath = path.join(ROOT, 'public/IMAGE_CREDITS.txt');
  let text = await readFile(credPath, 'utf8');
  // remove any previous auto block (current markers) AND the legacy appended block
  const reBlock = new RegExp(`\\n*${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n*`, 'g');
  text = text.replace(reBlock, '\n');
  const legacy = /\n*={10,}\nGPS-harvested per-beach photos[\s\S]*$/;
  text = text.replace(legacy, '\n');
  text = text.replace(/\n{3,}$/, '\n').replace(/\s*$/, '\n');
  await writeFile(credPath, text + '\n' + block.join('\n') + '\n');
  console.log(`Wrote credits: ${commonsFiles.length} Commons files + ${rawUrls.length} Openverse/Flickr URLs.`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
