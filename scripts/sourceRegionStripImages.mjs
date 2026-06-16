// Sources representative, free-licensed strip photos for regions with NO local photo.
// Uses each place's Wikipedia lead image via the REST summary endpoint (separate CDN infra,
// generous limits) and a single BATCHED Commons imageinfo call for licences (avoids the
// heavily rate-limited search generator). Downloads, crops to a wide-short strip, records
// attribution, and MERGES into data/sourcedRegionStripPhotos.generated.json.
//
// Run: node scripts/sourceRegionStripImages.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join('public', 'images', 'regions');
const OUT_JSON = path.join('data', 'sourcedRegionStripPhotos.generated.json');
const UA = 'CalmBeachGreece/1.0 (region strip sourcing; contact: site admin)';
const BAND_ASPECT = 3.6, MAX_WIDTH = 1600, WEBP_QUALITY = 74;

// islandId -> { wiki: Wikipedia article title, label: gr name }
const TARGETS = [
  // North Aegean islands
  { id: 'north-aegean-ikaria', wiki: 'Icaria', label: 'Ικαρία' },
  { id: 'north-aegean-fournoi', wiki: 'Fournoi Korseon', label: 'Φούρνοι' },
  { id: 'north-aegean-oinousses', wiki: 'Oinousses', label: 'Οινούσσες' },
  { id: 'north-aegean-psara', wiki: 'Psara', label: 'Ψαρά' },
  { id: 'north-aegean-agios-efstratios', wiki: 'Agios Efstratios', label: 'Άγιος Ευστράτιος' },
  { id: 'east-macedonia-and-thrace-samothraki', wiki: 'Samothrace', label: 'Σαμοθράκη' },
  // Other islands
  { id: 'attica-kythira', wiki: 'Kythira', label: 'Κύθηρα' },
  { id: 'crete-gavdos', wiki: 'Gavdos', label: 'Γαύδος' },
  { id: 'south-aegean-polyaigos', wiki: 'Polyaigos', label: 'Πολύαιγος' },
  // Mainland coastal prefectures (lead image may be a map -> skipped by filters)
  { id: 'attica-piraeus-area', wiki: 'Piraeus', label: 'Πειραιάς' },
  { id: 'central-greece-fokida-mainland', wiki: 'Phocis', label: 'Φωκίδα' },
  { id: 'central-greece-fthiotida-mainland', wiki: 'Phthiotis', label: 'Φθιώτιδα' },
  { id: 'central-greece-viotia-mainland', wiki: 'Boeotia', label: 'Βοιωτία' },
  { id: 'central-macedonia-pieria-mainland', wiki: 'Pieria (regional unit)', label: 'Πιερία' },
  { id: 'central-macedonia-thessaloniki-area', wiki: 'Thessaloniki', label: 'Θεσσαλονίκη' },
  { id: 'east-macedonia-and-thrace-evros-mainland', wiki: 'Evros (regional unit)', label: 'Έβρος' },
  { id: 'east-macedonia-and-thrace-kavala-mainland', wiki: 'Kavala', label: 'Καβάλα' },
  { id: 'east-macedonia-and-thrace-rodopi-mainland', wiki: 'Rhodope (regional unit)', label: 'Ροδόπη' },
  { id: 'east-macedonia-and-thrace-xanthi-mainland', wiki: 'Xanthi (regional unit)', label: 'Ξάνθη' },
  { id: 'epirus-preveza-mainland', wiki: 'Preveza (regional unit)', label: 'Πρέβεζα' },
  { id: 'epirus-thesprotia-mainland', wiki: 'Thesprotia', label: 'Θεσπρωτία' },
  { id: 'thessaly-magnesia-mainland---pelion', wiki: 'Pelion', label: 'Μαγνησία (Πήλιο)' },
  { id: 'west-greece-achaia-mainland', wiki: 'Achaea (regional unit)', label: 'Αχαΐα' },
  { id: 'west-greece-aetolia-acarnania-mainland', wiki: 'Aetolia-Acarnania', label: 'Αιτωλοακαρνανία' },
  { id: 'west-greece-ileia-mainland', wiki: 'Elis (regional unit)', label: 'Ηλεία' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const isFree = (l) => !!l && /(^cc[\s-]|creative commons|^cc0|public domain|^pdm|gfdl|attribution)/i.test(l) && !/fair use|non-free|all rights/i.test(l);
const looksNonPhoto = (s) => /\.svg\b|\bmaps?\b|numbered|municipalit|periferia|\bnomos\b|prefecture|\bdimos?\b|\bdimi\b|flag|coat[_ ]of[_ ]arms|location|seal|logo|icon|blason|escudo|wappen|topograph|diagram|\bplan\b/i.test(s);
const looksSatellite = (s) => /nasa|satellite|sentinel|landsat|from space|\biss\b|copernicus/i.test(s);
const attributionRequired = (l) => !/(public\s*domain|cc0|^pdm|pexels)/i.test(l || '');

let lastCall = 0;
const rlFetch = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const wait = Math.max(0, 1300 - (Date.now() - lastCall));
    if (wait) await sleep(wait);
    lastCall = Date.now();
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (r.status === 429) { await sleep(8000 * (i + 1)); continue; }
    return r;
  }
  throw new Error('rate-limited');
};

// Wikipedia REST summary -> Commons File title of the lead image (or null).
const leadFile = async (wiki) => {
  const r = await rlFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wiki)}`);
  if (!r.ok) return null;
  const j = await r.json();
  const src = j.originalimage?.source || j.thumbnail?.source;
  if (!src) return null;
  const m = src.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  // MediaWiki normalizes titles with spaces (not underscores) — match that for the lookup.
  return m ? 'File:' + decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
};

const isValid = (c) => !!c && !!c.url && c.width >= 1000 && c.width >= c.height * 0.9 && isFree(c.license)
  && !looksNonPhoto(`${c.title || ''} ${c.author} ${c.description}`) && !looksSatellite(`${c.title || ''} ${c.author} ${c.description}`);

// Commons search -> best free landscape photo for a term (downloads the 1600px thumbnail).
const searchBest = async (term) => {
  const r = await rlFetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=16&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json`);
  if (!r.ok) return null;
  const j = await r.json();
  const cands = Object.values(j.query?.pages || {}).map((p) => {
    const ii = p.imageinfo?.[0]; if (!ii) return null; const ext = ii.extmetadata || {};
    return { title: p.title, url: ii.thumburl || ii.url, width: ii.width, height: ii.height, license: stripHtml(ext.LicenseShortName?.value || ''), author: stripHtml(ext.Artist?.value || '') || 'Unknown', sourceUrl: ii.descriptionurl, description: stripHtml(ext.ImageDescription?.value || '') };
  }).filter(isValid);
  cands.sort((a, b) => b.width - a.width);
  return cands[0] || null;
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const map = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) : {};

  // 1) lead File per target (REST, light)
  const todo = TARGETS.filter((t) => !map[t.id]);
  const fileByTarget = {};
  for (const t of todo) {
    try { const f = await leadFile(t.wiki); if (f) fileByTarget[t.id] = f; else console.log(`no lead image: ${t.id}`); }
    catch (e) { console.log(`lead err ${t.id}: ${e.message}`); }
  }

  // 2) batched imageinfo (cheap query)
  const titles = [...new Set(Object.values(fileByTarget))];
  const info = {};
  for (let i = 0; i < titles.length; i += 25) {
    const chunk = titles.slice(i, i + 25);
    const r = await rlFetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(chunk.join('|'))}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json`);
    const j = await r.json();
    for (const p of Object.values(j.query?.pages || {})) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const ext = ii.extmetadata || {};
      // Download the 1600px CDN thumbnail (fast, not throttled) but validate on original dims.
      info[p.title] = { url: ii.thumburl || ii.url, width: ii.width, height: ii.height, license: stripHtml(ext.LicenseShortName?.value || ''), author: stripHtml(ext.Artist?.value || '') || 'Unknown', sourceUrl: ii.descriptionurl, description: stripHtml(ext.ImageDescription?.value || '') };
    }
  }

  // 3) pick (lead image if a real photo, else a beach/coast search), download, crop
  for (const t of todo) {
    const title = fileByTarget[t.id];
    let ci = title && info[title] ? { title, ...info[title] } : null;
    if (!isValid(ci)) { console.log(`lead unsuitable for ${t.id} -> searching`); ci = await searchBest(`${t.wiki} Greece beach`); }
    if (!isValid(ci)) ci = await searchBest(`${t.wiki} Greece coast`);
    if (!isValid(ci)) { console.log(`SKIP ${t.id}: no suitable free image`); continue; }
    try {
      const res = await rlFetch(ci.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const m = await sharp(buf).metadata();
      const bandH = Math.round(m.width / BAND_ASPECT);
      const top = Math.max(0, Math.min(m.height - bandH, Math.round(0.5 * m.height - bandH / 2)));
      let pipe = sharp(buf).extract({ left: 0, top, width: m.width, height: bandH });
      let outW = m.width, outH = bandH;
      if (m.width > MAX_WIDTH) { outW = MAX_WIDTH; outH = Math.round(bandH * (MAX_WIDTH / m.width)); pipe = pipe.resize(outW); }
      const outName = `${t.id}-strip.webp`;
      await pipe.webp({ quality: WEBP_QUALITY }).toFile(path.join(OUT_DIR, outName));
      map[t.id] = {
        src: `/images/regions/${outName}`, alt: ci.description?.slice(0, 120) || `${t.wiki}, Greece`,
        width: outW, height: outH, source: 'wikimedia', author: ci.author, license: ci.license, sourceUrl: ci.sourceUrl,
        attributionRequired: attributionRequired(ci.license), verifiedLocation: false, usageLabel: t.label, loading: 'eager', fetchPriority: 'high',
      };
      console.log(`OK ${t.id}: ${ci.title} (${m.width}x${m.height}) | ${ci.author} / ${ci.license}`);
    } catch (e) { console.log(`ERR ${t.id}: ${e.message}`); }
  }

  fs.writeFileSync(OUT_JSON, JSON.stringify(map, null, 2) + '\n');
  console.log(`\nTotal sourced region strips: ${Object.keys(map).length} -> ${OUT_JSON}`);
};
main().catch((e) => { console.error(e); process.exit(1); });
