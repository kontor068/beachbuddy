/**
 * GPS-verified photo harvester (scales coverage honestly).
 *
 * For every beach WITHOUT a photo (per reports/photo-coverage/missing-beaches.csv),
 * finds a Wikimedia Commons file geotagged within a tight radius of the beach's
 * exact coordinates. A photo within ~MAXDIST m of the beach IS that beach/coast
 * (location proven by GPS, not guessed). Filters out non-beach subjects (NEG) and
 * dedupes so one file is never reused for two beaches. Writes beachId -> [url] into
 * data/beachPhotosById.generated.json (merged; existing keys preserved).
 *
 * Usage: node scripts/harvestGeoPhotos.mjs [maxDist=110] [regionSubstr]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const UA = 'CalmBeachGeoHarvest/1.0 (https://calmbeach.gr; local dev)';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'data', 'beachPhotosById.generated.json');

const NEG = /church|chapel|chiesa|kirche|templom|μον[ήη]|μοναστ|monaster|εκκλησ|ναός|castle|κάστρο|fortress|φρούριο|tower|museum|μουσε[ίι]ο|archnmus|archmus|banner|aquarium|ενυδρε[ίι]ο|windmill|ανεμόμυλ|fingerpost|σήμα|πινακίδα|road sign|fresco|τοιχογ|\bISS\b|earth\.jpg|view of earth|butterfly|πεταλούδ|flower|λουλούδ|orchid|arbutus|κουμαρ|cemetery|νεκροταφ|\bruins\b|ερείπ|shipyard|ναυπηγ|excavation|ανασκαφ|\bmap\b|χάρτης|stamp|coin|νόμισμα|aerial view of earth|harbour|harbor|λιμάνι|αεροδρόμ|airport|plane|αεροπλάν|statue|άγαλμα|engraving|χαλκογρ|war|πόλεμ|1900|1910|1920|1930|1940|1950|1960|χιονισ|snow|skoda|škoda|\bcar\b|αυτοκίν|vehicle|spondylus|urchin|αχιν|εχίν|mount athos|άθως|αθως|scogliera|mollusc|mollusk|όστρακ|κοχύλ|nudibranch|species|insect|έντομο|\bbird\b|πουλί|jellyfish|μέδουσα|cave|σπήλαι|σπηλιά|fish\b|ψάρι|electricus|lizard|σαύρα|snake|φίδι|crab|καβούρ|plant|φυτό|herbarium|moth|σκαθάρ|beetle|mushroom|μανιτάρ|geological|γεωλογ|mineral|ορυκτ|rock formation|fossil|απολίθ/i;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJson = async url => {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok) return r.json();
      if (r.status === 429) { await sleep(2000 * (a + 1)); continue; }
      return null;
    } catch { await sleep(800 * (a + 1)); }
  }
  return null;
};

const thumb = file => `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(file)}&width=800`;
const isImg = t => /\.(jpe?g|png)$/i.test(t);

const geo = async (lat, lon, radius) => {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${radius}&gsnamespace=6&gslimit=12`;
  const d = await getJson(u);
  return (d?.query?.geosearch || []).map(x => ({ file: x.title, dist: Math.round(x.dist) }));
};

const extmeta = async titles => {
  const out = {};
  for (let i = 0; i < titles.length; i += 40) {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(titles.slice(i, i + 40).join('|'))}`;
    const d = await getJson(u);
    for (const p of Object.values(d?.query?.pages || {})) {
      const em = p.imageinfo?.[0]?.extmetadata || {};
      const g = k => (em[k]?.value || '').replace(/<[^>]+>/g, '').trim();
      out[p.title] = { license: g('LicenseShortName'), lk: (g('License') || '').toLowerCase() };
    }
    await sleep(150);
  }
  return out;
};
const free = m => m && (/^cc-?(by|by-sa|0|zero|pdm)/.test(m.lk) || /public domain|cc0|cc by/i.test(m.license));

const main = async () => {
  const MAXDIST = Number(process.argv[2]) || 110;
  const regionSub = process.argv[3] || '';

  const index = JSON.parse(await readFile(path.join(ROOT, 'public/data/beaches/index.json'), 'utf8'));
  const missingCsv = await readFile(path.join(ROOT, 'reports/photo-coverage/missing-beaches.csv'), 'utf8');
  const missingByRegion = {};
  for (const l of missingCsv.split('\n').slice(1).filter(Boolean)) {
    const c = l.split(',');
    (missingByRegion[c[1]] = missingByRegion[c[1]] || new Set()).add(c[3]);
  }

  const result = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {};
  const usedFiles = new Set(Object.values(result).flat().map(u => decodeURIComponent((u.match(/file\/([^&]+)/) || [])[1] || '')));

  let added = 0, scanned = 0;
  const regions = index.regions.filter(r => !regionSub || r.id.includes(regionSub));
  for (const region of regions) {
    const missing = missingByRegion[region.id];
    if (!missing || !missing.size) continue;
    const appPath = path.join(ROOT, 'public', region.appDataPath.replace(/^\/+/, ''));
    if (!existsSync(appPath)) continue;
    const app = JSON.parse(await readFile(appPath, 'utf8'));
    const beaches = (app.island?.beaches || []).filter(b => missing.has(String(b.id)));

    // gather geo candidates for all missing beaches in this region
    const perBeach = [];
    const allFiles = new Set();
    for (const b of beaches) {
      const lat = b.coordinates?.lat, lon = b.coordinates?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      scanned++;
      let cands = (await geo(lat, lon, MAXDIST)).filter(g => isImg(g.file) && !NEG.test(g.file));
      await sleep(120);
      perBeach.push({ id: b.id, cands });
      cands.forEach(g => allFiles.add(g.file));
    }
    if (!allFiles.size) continue;
    const meta = await extmeta([...allFiles]);

    for (const pb of perBeach) {
      if (result[pb.id]) continue;
      const ok = pb.cands
        .filter(g => free(meta[g.file]))
        .sort((a, b) => a.dist - b.dist);
      for (const g of ok) {
        const f = g.file.replace('File:', '');
        if (usedFiles.has(f)) continue;
        result[pb.id] = [thumb(f)];
        usedFiles.add(f);
        added++;
        break;
      }
    }
    console.log(`${region.id}: +${beaches.length ? added : 0} (running total ${added})`);
    await writeFile(OUT, JSON.stringify(result, null, 0) + '\n');
  }
  console.log(`\nDONE. scanned ${scanned} beaches, harvested ${added} new, total ids ${Object.keys(result).length}. -> ${path.relative(ROOT, OUT)}`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
