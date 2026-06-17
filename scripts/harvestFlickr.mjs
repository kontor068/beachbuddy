/**
 * Flickr GPS harvester — the big untapped source. For every still-MISSING beach (with
 * coords), searches Flickr for CC-licensed photos GEOTAGGED within a small radius of the
 * beach (regardless of title — far more than Openverse exposes). Writes the best candidate
 * to data/beachPhotosById.generated.json and its attribution to data/flickrCredits.json.
 *
 * Commercial-OK CC only (license 4=BY,5=BY-SA,7=PD,9=CC0,10=PDM; NO NC, NO ND).
 * Title NEG-filter cuts obvious non-beach; FULL visual QA via qaMontage afterwards is
 * REQUIRED (geo-near != a beach). Respects data/beachPhotoBlocklist.json.
 *
 * Setup: add to .env.local ->  FLICKR_API_KEY=xxxxx   (free: flickr.com/services/apps/create)
 * Usage: node scripts/harvestFlickr.mjs [radiusKm=0.4] [regionSubstr]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'data', 'beachPhotosById.generated.json');
const CRED = path.join(ROOT, 'data', 'flickrCredits.json');
const BLOCK = path.join(ROOT, 'data', 'beachPhotoBlocklist.json');
const UA = 'CalmBeachFlickr/1.0 (https://calmbeach.gr; dev)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LIC = { 4: 'CC BY 2.0', 5: 'CC BY-SA 2.0', 7: 'No known copyright (PD)', 9: 'CC0', 10: 'Public Domain Mark' };
// non-beach subjects in Flickr titles (geo-near can be anything)
const NEG = /church|chapel|μον[ήη]|μοναστ|εκκλησ|temple|cathedral|museum|μουσε|ruins?|ερείπ|castle|κάστρο|fortress|windmill|ανεμόμυλ|lighthouse|φάρος|\bport\b|harbour|harbor|λιμάν|marina|μαρίν|\bboat\b|βάρκ|yacht|ferry|\bship\b|wreck|\bcar\b|\bbike\b|\bplane\b|hotel|ξενοδοχ|resort|restaurant|ταβέρν|\bcafe\b|\bbar\b|\bchurch\b|\bcat\b|\bdog\b|\bbird\b|butterfly|insect|flower|λουλούδ|\btree\b|\bfish\b|portrait|selfie|\bme\b|wedding|γάμος|food|φαγητό|sunset only|\bmap\b|statue|άγαλμα|monument|μνημ/i;

const main = async () => {
  const env = await readFile(path.join(ROOT, '.env.local'), 'utf8');
  const KEY = (env.match(/FLICKR_API_KEY=(.+)/) || [])[1]?.trim();
  if (!KEY || /YOUR|xxxx/i.test(KEY)) { console.error('No valid FLICKR_API_KEY in .env.local. Get a free key at https://www.flickr.com/services/apps/create'); process.exit(1); }
  const radiusKm = Number(process.argv[2]) || 0.4;
  const regionSub = process.argv[3] || '';

  const result = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {};
  const cred = existsSync(CRED) ? JSON.parse(await readFile(CRED, 'utf8')) : {};
  let bl = { ids: [], files: [] }; if (existsSync(BLOCK)) bl = JSON.parse(await readFile(BLOCK, 'utf8'));
  const blockedIds = new Set((bl.ids || []).map(String));
  const usedUrls = new Set(Object.values(result).flat());

  const index = JSON.parse(await readFile(path.join(ROOT, 'public/data/beaches/index.json'), 'utf8'));
  const missingCsv = await readFile(path.join(ROOT, 'reports/photo-coverage/missing-beaches.csv'), 'utf8');
  const missingByRegion = {};
  for (const l of missingCsv.split('\n').slice(1).filter(Boolean)) { const c = l.split(','); (missingByRegion[c[1]] = missingByRegion[c[1]] || new Set()).add(c[3]); }

  const search = async (lat, lon) => {
    const u = `https://www.flickr.com/services/rest/?method=flickr.photos.search&api_key=${KEY}&format=json&nojsoncallback=1`
      + `&lat=${lat}&lon=${lon}&radius=${radiusKm}&radius_units=km&has_geo=1&license=4,5,7,9,10`
      + `&sort=interestingness-desc&content_type=1&media=photos&per_page=6&extras=geo,license,owner_name,url_l,url_c,url_z`;
    for (let a = 0; a < 4; a++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA } }); if (r.ok) { const j = await r.json(); if (j.stat === 'ok') return j.photos.photo || []; } await sleep(1500); } catch { await sleep(800); } }
    return [];
  };

  let added = 0, scanned = 0;
  for (const region of index.regions.filter(r => !regionSub || r.id.includes(regionSub))) {
    const missing = missingByRegion[region.id]; if (!missing?.size) continue;
    const appPath = path.join(ROOT, 'public', region.appDataPath.replace(/^\/+/, '')); if (!existsSync(appPath)) continue;
    const app = JSON.parse(await readFile(appPath, 'utf8'));
    let regionAdded = 0;
    for (const b of (app.island?.beaches || [])) {
      if (!missing.has(String(b.id)) || result[b.id] || blockedIds.has(String(b.id))) continue;
      const lat = b.coordinates?.lat, lon = b.coordinates?.lon; if (!Number.isFinite(lat)) continue;
      scanned++;
      const photos = await search(lat, lon); await sleep(200);
      const cand = photos.find(p => { const t = p.title || ''; return (p.url_l || p.url_c || p.url_z) && !NEG.test(t); });
      if (cand) {
        const url = cand.url_l || cand.url_c || cand.url_z;
        if (usedUrls.has(url)) continue;
        result[b.id] = [url]; usedUrls.add(url);
        cred[url] = { creator: cand.ownername || '', license: LIC[cand.license] || ('Flickr lic ' + cand.license), page: `https://www.flickr.com/photos/${cand.owner}/${cand.id}` };
        added++; regionAdded++;
      }
    }
    if (regionAdded) { console.log(`${region.id}: +${regionAdded} (total ${added})`); await writeFile(OUT, JSON.stringify(result, null, 0) + '\n'); await writeFile(CRED, JSON.stringify(cred, null, 1)); }
  }
  await writeFile(OUT, JSON.stringify(result, null, 0) + '\n');
  await writeFile(CRED, JSON.stringify(cred, null, 1));
  console.log(`\nDONE. scanned ${scanned}, added ${added} Flickr-geo candidates. total by-id ${Object.keys(result).length}. -> RUN qaMontage NEXT to visually verify.`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
