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

// iNaturalist species observations (Latin binomial + obs number) & museum artifacts
// iNaturalist obs ids are 9-10 digits; 8-digit numbers are usually dates (20210607) so excluded
const SPECIES_NUM = /\b\d{9,10}\.(jpe?g|png)$/i;
const LATIN = /\b(Posidonia|Pinna|Pecten|Flexopecten|Bulla|Dasycladus|Sarpa|Salpa|Diplodus|Charonia|Hexaplex|Aplysia|Holothuria|Paracentrotus|Diadema|Arbacia|Actinia|Anemonia|Cerithium|Patella|Cymbula|Octopus|Sepia|Caretta|Larus|Tursiops|Felis|Spondylus|Lima|Limaria|Tethya|Agelas|Pterois|Cymodocea|Eryngium|Malcolmia|Mantis|Amegilla|Oxythyrea|Metaphalangium|Electrophorus|Curruca|Gonepteryx|Antedon|Cladocora|Aurelia)\b/i;
const ARCH = /\bmuseum\b|μουσε[ίι]ο|archnmus|archmus|\bAM \b|\bBC\b|π\.?Χ|funeral|burial|ταφικ|pyxis|amphora|αμφορ|\bvase\b|αγγείο|terracotta|sculpture|γλυπτ|figurine|ειδώλι|Minoan|μινωικ|Mycenaean|μυκηνα|pottery|κεραμικ|sarcophag|σαρκοφάγ|exhibit|\btomb\b|τάφος|τύμβ|mausoleum|temple|\bnaos\b|cathedral|cathedrale|καθεδρικ|acropol|ακρόπολ|amphithea|αμφιθέ|\bruins?\b|ερείπ|ανάκτορ|anaktor|\bstadium\b|aqueduct|aquaduct|υδραγωγ|sacred way|ιερά οδ|\bancient\b|αρχαί/i;
// other non-beach subjects seen in wide-radius geosearch
const EXTRA = /\bislet\b|νησίδ|Ammouliani Island|Aponissos|Atsitsa island|ferry|\bport\b|harbour|harbor|λιμάν|marina|μαρίν|breakwater|κυματοθρ|remparts|rampart|\bboat trip\b|\byacht\b|θαλαμηγ|\bbarca\b|memorial|μνημε[ίι]|cemeter|cementery|νεκροταφ|\btank\b|Κτήμα|estate|winery|οινοποι|unnamed road|\bvillage\b|χωριό|chora village|\bhotel\b|ξενοδοχ|\bresort\b|restaurant|εστιατόρ|taverna|ταβέρν|\bcafe\b|καφέ|\bbar\b|depot|αποθήκη|factory|εργοστ|\bmine\b|μεταλλε|ορυχ|\bagora\b|αγορά|\bmarket\b|\bsquare\b|πλατεία|\bstation\b|σταθμ|werft|πύργος|kastro\b|fortosis|φόρτωσ/i;
const bad = f => NEG.test(f) || SPECIES_NUM.test(f) || LATIN.test(f) || ARCH.test(f) || EXTRA.test(f);

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

  // Durable blocklist of files (and beachIds) that failed QA — never re-add them.
  const BLOCK = path.join(ROOT, 'data', 'beachPhotoBlocklist.json');
  let blocklist = { files: [], ids: [] };
  if (existsSync(BLOCK)) { try { blocklist = JSON.parse(await readFile(BLOCK, 'utf8')); } catch {} }
  const blockedFiles = new Set((blocklist.files || []).map(f => decodeURIComponent(f)));
  const blockedIds = new Set((blocklist.ids || []).map(String));
  for (const f of blockedFiles) usedFiles.add(f); // treat as already-consumed

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
      if (blockedIds.has(String(b.id))) continue; // QA'd: no acceptable nearby photo
      scanned++;
      let cands = (await geo(lat, lon, MAXDIST)).filter(g => isImg(g.file) && !bad(g.file));
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
