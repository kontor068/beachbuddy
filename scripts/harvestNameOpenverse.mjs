/**
 * Name-search + Openverse auto-harvester (scales coverage beyond GPS geosearch).
 *
 * For every beach still WITHOUT a photo (reports/photo-coverage/missing-beaches.csv),
 * finds a free-licensed photo whose TITLE/FILENAME explicitly identifies that beach:
 *   1. Commons name-search (list=search, namespace 6)
 *   2. Openverse (Flickr CC corpus + Commons + museums, keyless)
 *
 * STRICT anti-collision (no visual check here, so the text must prove identity):
 *   - filename/title must contain a distinctive beach-name token (>=5 chars) AND an
 *     island/region token (>=4 chars). Generic "beach.jpg" or island-only photos are
 *     rejected (they'd be guesses, not the specific beach).
 *   - free licence only (cc0/by/by-sa/pdm); NEG + species + landmark filters applied.
 *   - one file/URL is never reused for two beaches.
 *
 * Writes beachId -> [url] into data/beachPhotosById.generated.json (merged; existing
 * keys preserved). Run AFTER any geosearch harvest finishes (shared output file).
 *
 * Usage: node scripts/harvestNameOpenverse.mjs [regionSubstr] [maxPerRegion]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const UA = 'CalmBeachNameHarvest/1.0 (https://calmbeach.gr; local dev)';
const ROOT = path.resolve('.');
const OUT = path.join(ROOT, 'data', 'beachPhotosById.generated.json');

// non-beach subjects (filename or title)
const NEG = /church|chapel|chiesa|kirche|templom|μον[ήη]|μοναστ|εκκλησ|ναός|naos|castle|κάστρο|fortress|φρούριο|\btower\b|πύργος|museum|μουσε[ίι]ο|archnmus|archmus|banner|aquarium|ενυδρε[ίι]ο|signature\.jpg|windmill|ανεμόμυλ|fingerpost|πινακίδα|road sign|fresco|τοιχογ|\bISS\b|earth\.jpg|view of earth|butterfly|πεταλούδ|flower|λουλούδ|orchid|arbutus|κουμαρ|olive tree|cemetery|νεκροταφ|\bruins\b|ερείπ|shipyard|ναυπηγ|excavation|ανασκαφ|\bmap\b|χάρτης|stamp|coin|νόμισμα|harbour|harbor|λιμάνι|λιμάν|αεροδρόμ|airport|\bplane\b|αεροπλάν|statue|άγαλμα|engraving|χαλκογρ|\bwar\b|πόλεμ|\b19[0-6]\d\b|χιονισ|\bsnow\b|skoda|škoda|\bcar\b|αυτοκίν|vehicle|spondylus|urchin|αχιν|εχίν|mount athos|άθως|αθως|mollusc|mollusk|όστρακ|κοχύλ|nudibranch|\bspecies\b|insect|έντομο|\bbird\b|πουλί|jellyfish|μέδουσα|\bcave\b|σπήλαι|σπηλιά|\bfish\b|ψάρι|electricus|lizard|σαύρα|snake|φίδι|crab|καβούρ|\bplant\b|φυτό|herbarium|moth|σκαθάρ|beetle|mushroom|μανιτάρ|geological|γεωλογ|mineral|ορυκτ|fossil|απολίθ|monaster|grotto|temple|cathedral|καθεδρικ|acropol|ακρόπολ|amphithea|αμφιθέ|\btomb\b|τάφος|τύμβ|mausoleum|\bbridge\b|γέφυρα|γεφύρι|\bdam\b|φράγμα|waterfall|καταρράκτ|lighthouse|φάρος|\bcat\b|γάτα|\bdog\b|σκύλος|mantis|\bmoth\b|\bport\b|marina|μαρίν|stadium|στάδιο/i;
// iNaturalist-style species observation files
const SPECIES = /\b\d{8,10}\.(jpe?g|png)$/i;
const LATIN = /\b(Posidonia|Pinna|Pecten|Flexopecten|Bulla|Dasycladus|Sarpa|Salpa|Diplodus|Charonia|Hexaplex|Aplysia|Holothuria|Paracentrotus|Diadema|Arbacia|Actinia|Anemonia|Cerithium|Patella|Cymbula|Octopus|Sepia|Caretta|Larus|Tursiops|Felis|Spondylus|Lima|Tethya|Agelas|Pterois|Cymodocea|Eryngium|Malcolmia|Mantis)\b/i;
// museum / archaeology artifacts (place names on labels slip past beach matching)
const ARCH = /\bmuseum\b|μουσε[ίι]ο|\bAM \b|\bBC\b|\bAD\b|π\.?Χ|funeral|ceremony|burial|ταφικ|pyxis|amphora|αμφορ|\bvase\b|αγγείο|terracotta|πήλιν|sculpture|γλυπτ|\brelief\b|ανάγλυφ|artifact|artefact|figurine|ειδώλι|Minoan|μινωικ|Mycenaean|μυκηνα|pottery|κεραμικ|inscription|επιγραφ|sarcophag|σαρκοφάγ|\bcoin\b|fresco|mosaic|ψηφιδωτ|exhibit|έκθεμα|gallery|πινακοθήκ/i;
const bad = t => NEG.test(t) || SPECIES.test(t) || LATIN.test(t) || ARCH.test(t);

const stripAccents = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = s => stripAccents(String(s || '')).toLowerCase();
// distinctive tokens (>=minLen) from a name, ignoring generic beach words
const GENERIC = new Set(['paralia', 'beach', 'plaz', 'plage', 'spiaggia', 'ammos', 'ammoudia', 'akti', 'cove', 'bay', 'agios', 'agia', 'agioi', 'cape', 'megali', 'megalo', 'mikri', 'mikro', 'nea', 'neos', 'palaia', 'kato', 'ano', 'limni', 'porto', 'ormos', 'nisi', 'greece', 'island']);
const tokensOf = (name, minLen = 5) => norm(name).split(/[^a-z0-9]+/).filter(t => t.length >= minLen && !GENERIC.has(t));
const containsToken = (text, tokens) => { const t = norm(text); return tokens.some(tok => t.includes(tok)); };

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

const commonsName = async query => {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(query)}`;
  const d = await getJson(u);
  return (d?.query?.search || []).map(x => x.title).filter(isImg);
};
const commonsLic = async titles => {
  const out = {};
  for (let i = 0; i < titles.length; i += 25) {
    const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=extmetadata&titles=${encodeURIComponent(titles.slice(i, i + 25).join('|'))}`;
    const d = await getJson(u);
    for (const p of Object.values(d?.query?.pages || {})) {
      const em = p.imageinfo?.[0]?.extmetadata || {};
      const g = k => (em[k]?.value || '').replace(/<[^>]+>/g, '').trim();
      out[p.title] = { license: g('LicenseShortName'), lk: (g('License') || '').toLowerCase() };
    }
    await sleep(120);
  }
  return out;
};
const free = m => m && (/^cc-?(by|by-sa|0|zero|pdm)/.test(m.lk) || /public domain|cc0|cc by/i.test(m.license));

const FREE = new Set(['cc0', 'by', 'by-sa', 'pdm']);
const openverse = async query => {
  const u = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,by,by-sa,pdm&page_size=12`;
  const d = await getJson(u);
  return (d?.results || []).map(r => ({ src: r.url, title: r.title || '', lk: r.license })).filter(x => x.src && FREE.has(x.lk));
};

const main = async () => {
  const regionSub = process.argv[2] || '';
  const maxPerRegion = Number(process.argv[3]) || 0; // 0 = no cap

  const index = JSON.parse(await readFile(path.join(ROOT, 'public/data/beaches/index.json'), 'utf8'));
  const missingCsv = await readFile(path.join(ROOT, 'reports/photo-coverage/missing-beaches.csv'), 'utf8');
  const missingByRegion = {};
  for (const l of missingCsv.split('\n').slice(1).filter(Boolean)) {
    const c = l.split(',');
    (missingByRegion[c[1]] = missingByRegion[c[1]] || new Set()).add(c[3]);
  }

  // Global beach-name token frequency (across ALL beaches nationwide). A name token
  // unique to ONE beach can identify it alone; a repeated token (e.g. "Trachili"
  // exists on Euboea AND Crete) needs an island token to avoid cross-island grabs.
  const tokenFreq = {};
  for (const region of index.regions) {
    const ap = path.join(ROOT, 'public', region.appDataPath.replace(/^\/+/, ''));
    if (!existsSync(ap)) continue;
    try {
      const a = JSON.parse(await readFile(ap, 'utf8'));
      for (const b of a.island?.beaches || []) {
        const toks = new Set([...tokensOf(b.name?.en || '', 5), ...tokensOf(b.name?.gr || '', 5)]);
        for (const t of toks) tokenFreq[t] = (tokenFreq[t] || 0) + 1;
      }
    } catch {}
  }

  const result = existsSync(OUT) ? JSON.parse(await readFile(OUT, 'utf8')) : {};
  const usedFiles = new Set(Object.values(result).flat().map(u => decodeURIComponent((u.match(/file\/([^&]+)/) || [])[1] || '')).filter(Boolean));
  const usedUrls = new Set(Object.values(result).flat());

  let added = 0, scanned = 0, nameHits = 0, ovHits = 0;
  const regions = index.regions.filter(r => !regionSub || r.id.includes(regionSub));
  for (const region of regions) {
    const missing = missingByRegion[region.id];
    if (!missing || !missing.size) continue;
    const appPath = path.join(ROOT, 'public', region.appDataPath.replace(/^\/+/, ''));
    if (!existsSync(appPath)) continue;
    const app = JSON.parse(await readFile(appPath, 'utf8'));
    const island = region.name.en, islandGr = region.name.gr || '';
    const islandToks = [...tokensOf(island, 4), ...tokensOf(islandGr, 4)];
    let beaches = (app.island?.beaches || []).filter(b => missing.has(String(b.id)) && !result[b.id]);
    if (maxPerRegion) beaches = beaches.slice(0, maxPerRegion);
    let regionAdded = 0;

    for (const b of beaches) {
      const nameEn = b.name?.en || '', nameGr = b.name?.gr || '';
      const nameToks = [...new Set([...tokensOf(nameEn, 5), ...tokensOf(nameGr, 5)])];
      if (!nameToks.length) continue; // name too generic/short to verify safely
      // token stands alone only if >=7 chars AND globally unique to this one beach
      const distinctive = nameToks.filter(t => t.length >= 7 && tokenFreq[t] === 1);
      scanned++;
      // globally-unique distinctive token identifies the beach alone; any other
      // name token must be confirmed by an island token (anti cross-island grab).
      const ok = text => {
        if (bad(text)) return false;
        if (containsToken(text, distinctive)) return true;
        return containsToken(text, nameToks) && islandToks.length > 0 && containsToken(text, islandToks);
      };

      let picked = null;
      // 1. Commons name-search
      const queries = [`${nameEn} ${island} beach`, `${nameGr} ${islandGr}`, `${nameEn} ${island}`];
      const found = new Set();
      for (const q of queries) { for (const f of await commonsName(q)) found.add(f); await sleep(90); if (found.size >= 10) break; }
      const candFiles = [...found].filter(f => ok(f)).map(f => f.replace(/^File:/, '')).filter(f => !usedFiles.has(f));
      if (candFiles.length) {
        const meta = await commonsLic([...new Set(candFiles.map(f => 'File:' + f))]);
        const good = candFiles.find(f => free(meta['File:' + f]));
        if (good) { picked = { url: thumb(good), file: good }; nameHits++; }
      }
      // 2. Openverse (only if name-search failed)
      if (!picked) {
        for (const q of [`${nameEn} ${island} beach`, `${nameGr} παραλία ${islandGr}`]) {
          for (const r of await openverse(q)) {
            if (ok(r.title) && !usedUrls.has(r.src)) { picked = { url: r.src }; ovHits++; break; }
          }
          await sleep(120);
          if (picked) break;
        }
      }
      if (picked) {
        result[b.id] = [picked.url];
        if (picked.file) usedFiles.add(picked.file);
        usedUrls.add(picked.url);
        added++; regionAdded++;
      }
      await sleep(60);
    }
    if (regionAdded) { console.log(`${region.id}: +${regionAdded} (total ${added}; name ${nameHits}/ov ${ovHits})`); await writeFile(OUT, JSON.stringify(result, null, 0) + '\n'); }
  }
  await writeFile(OUT, JSON.stringify(result, null, 0) + '\n');
  console.log(`\nDONE. scanned ${scanned}, harvested ${added} (commons-name ${nameHits}, openverse ${ovHits}), total ids ${Object.keys(result).length}.`);
};
main().catch(e => { console.error(e); process.exitCode = 1; });
