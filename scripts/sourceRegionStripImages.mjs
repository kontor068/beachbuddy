// Sources a representative, aesthetic, free-licensed BEACH photo per region from Wikimedia
// Commons. For each region it tries specific named-beach search terms first (best quality),
// then the Wikipedia lead image, then a generic "<place> Greece beach" search. Verifies the
// licence, downloads the 1600px thumbnail, crops to a wide-short strip, records attribution,
// and MERGES into data/sourcedRegionStripPhotos.generated.json (the adapter's override map).
//
// Run: node scripts/sourceRegionStripImages.mjs
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const OUT_DIR = path.join('public', 'images', 'regions');
const OUT_JSON = path.join('data', 'sourcedRegionStripPhotos.generated.json');
const UA = 'CalmBeachGreece/1.0 (region strip sourcing; contact: site admin)';
const BAND_ASPECT = 3.6, MAX_WIDTH = 1600, WEBP_QUALITY = 74;

// Each region: specific beach searches (best first), Wikipedia title (lead fallback), gr label.
const TARGETS = [
  { id: 'south-aegean-naxos', wiki: 'Naxos', label: 'Νάξος', terms: ['Plaka beach Naxos', 'Agios Prokopios beach Naxos', 'Agia Anna beach Naxos'] },
  { id: 'north-aegean-ikaria', wiki: 'Icaria', label: 'Ικαρία', terms: ['Seychelles beach Ikaria', 'Nas Ikaria beach', 'Mesakti beach Ikaria'] },
  { id: 'attica-athens-area-mainland', wiki: 'Athens Riviera', label: 'Αθηναϊκή Ριβιέρα', terms: ['Vouliagmeni beach', 'Astir beach Vouliagmeni', 'Kavouri beach'] },
  { id: 'attica-piraeus-area', wiki: 'Piraeus', label: 'Πειραιάς', terms: ['Mikrolimano Piraeus', 'Kastella Piraeus', 'Peiraiki coast'] },
  { id: 'central-greece-fokida-mainland', wiki: 'Galaxidi', label: 'Φωκίδα', terms: ['Galaxidi waterfront', 'Galaxidi harbour', 'Trizonia island'] },
  { id: 'central-greece-fthiotida-mainland', wiki: 'Phthiotis', label: 'Φθιώτιδα', terms: ['Kamena Vourla beach', 'Agios Serafeim beach Fthiotida', 'Glyfa beach Fthiotida'] },
  { id: 'central-greece-viotia-mainland', wiki: 'Antikyra', label: 'Βοιωτία', terms: ['Antikyra Boeotia', 'Agios Isidoros Boeotia', 'Paralia Distomo'] },
  { id: 'central-macedonia-pieria-mainland', wiki: 'Pieria (regional unit)', label: 'Πιερία', terms: ['Paralia Katerini beach', 'Olympic Beach Pieria', 'Platamonas beach'] },
  { id: 'east-macedonia-and-thrace-evros-mainland', wiki: 'Evros (regional unit)', label: 'Έβρος', terms: ['Makri beach Alexandroupoli', 'Alexandroupoli beach', 'Dikella beach Evros'] },
  { id: 'east-macedonia-and-thrace-rodopi-mainland', wiki: 'Rhodope (regional unit)', label: 'Ροδόπη', terms: ['Fanari Rodopi beach', 'Arogi beach', 'Maroneia beach'] },
  { id: 'east-macedonia-and-thrace-xanthi-mainland', wiki: 'Avdira', label: 'Ξάνθη', terms: ['Avdira beach Xanthi', 'Myrodato beach', 'Porto Lagos'] },
  { id: 'north-aegean-agios-efstratios', wiki: 'Agios Efstratios', label: 'Άγιος Ευστράτιος', terms: ['Agios Efstratios harbour', 'Agios Efstratios village', 'Agios Efstratios island'] },
  { id: 'epirus-arta-mainland', wiki: 'Arta, Greece', label: 'Άρτα', terms: ['Koronisia Amvrakikos', 'Kommeno Amvrakikos', 'Amvrakikos Gulf'] },
  { id: 'thessaly-larissa-coast-agia---kissavos', wiki: 'Agia, Larissa', label: 'Παραλία Λάρισας', terms: ['Agiokampos beach', 'Stomio beach Larissa', 'Velika beach'] },
  { id: 'west-greece-achaia-mainland', wiki: 'Achaea (regional unit)', label: 'Αχαΐα', terms: ['Kalogria beach Achaia', 'Niforeika beach', 'Kalamaki beach Achaia'] },
  { id: 'west-greece-aetolia-acarnania-mainland', wiki: 'Nafpaktos', label: 'Αιτωλοακαρνανία', terms: ['Nafpaktos harbour', 'Nafpaktos beach', 'Vonitsa waterfront'] },
  { id: 'west-greece-ileia-mainland', wiki: 'Elis (regional unit)', label: 'Ηλεία', terms: ['Kourouta beach', 'Zacharo beach', 'Kaiafas beach'] },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stripHtml = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/\s+/g, ' ').trim();
const isFree = (l) => !!l && /(^cc[\s-]|creative commons|^cc0|public domain|^pdm|gfdl|attribution)/i.test(l) && !/fair use|non-free|all rights/i.test(l);
const looksNonPhoto = (s) => /\.svg\b|\bmaps?\b|numbered|municipalit|periferia|\bnomos\b|prefecture|\bdimos?\b|\bdimi\b|flag|coat[_ ]of[_ ]arms|location|seal|logo|icon|blason|escudo|wappen|topograph|diagram|\bplan\b|engraving|painting|\bbattle\b|swimming pool|\bpool\b|\bmt\.?\b|\bmountain\b|summit|\bpeak\b|olympus|1[6-8]\d\d/i.test(s);
const looksSatellite = (s) => /nasa|satellite|sentinel|landsat|from space|\biss\b|copernicus/i.test(s);
const attributionRequired = (l) => !/(public\s*domain|cc0|^pdm|pexels)/i.test(l || '');
const isValid = (c) => !!c && !!c.url && c.width >= 1000 && c.width >= c.height * 0.95 && isFree(c.license)
  && !looksNonPhoto(`${c.title || ''} ${c.author} ${c.description}`) && !looksSatellite(`${c.title || ''} ${c.author} ${c.description}`);

let lastCall = 0;
const rlFetch = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    const wait = Math.max(0, 1400 - (Date.now() - lastCall));
    if (wait) await sleep(wait);
    lastCall = Date.now();
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (r.status === 429) { await sleep(8000 * (i + 1)); continue; }
    return r;
  }
  throw new Error('rate-limited');
};
const toInfo = (title, ii) => {
  const ext = ii?.extmetadata || {};
  return ii ? { title, url: ii.thumburl || ii.url, width: ii.width, height: ii.height, license: stripHtml(ext.LicenseShortName?.value || ''), author: stripHtml(ext.Artist?.value || '') || 'Unknown', sourceUrl: ii.descriptionurl, description: stripHtml(ext.ImageDescription?.value || '') } : null;
};
const searchBest = async (term) => {
  const r = await rlFetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=16&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json`);
  if (!r.ok) return null;
  const j = await r.json();
  const cands = Object.values(j.query?.pages || {}).map((p) => toInfo(p.title, p.imageinfo?.[0])).filter(isValid);
  cands.sort((a, b) => b.width - a.width);
  return cands[0] || null;
};
const leadInfo = async (wiki) => {
  const r = await rlFetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wiki)}`);
  if (!r.ok) return null;
  const j = await r.json();
  const src = j.originalimage?.source || j.thumbnail?.source;
  const m = src && src.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/]+)/);
  if (!m) return null;
  const title = 'File:' + decodeURIComponent(m[1]).replace(/_/g, ' ');
  const k = await rlFetch(`https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1600&format=json`);
  const kj = await k.json();
  const page = Object.values(kj.query?.pages || {})[0];
  return toInfo(page?.title, page?.imageinfo?.[0]);
};

const main = async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const map = fs.existsSync(OUT_JSON) ? JSON.parse(fs.readFileSync(OUT_JSON, 'utf8')) : {};
  const force = process.argv.includes('--force');

  for (const t of TARGETS) {
    if (map[t.id] && !force) { console.log(`skip ${t.id} (exists)`); continue; }
    try {
      let ci = null;
      for (const term of (t.terms || [])) { const c = await searchBest(term); if (isValid(c)) { ci = c; break; } }
      if (!isValid(ci)) { const l = await leadInfo(t.wiki).catch(() => null); if (isValid(l)) ci = l; }
      if (!isValid(ci)) ci = await searchBest(`${t.wiki} Greece beach`);
      if (!isValid(ci)) { console.log(`SKIP ${t.id}: no suitable image`); continue; }

      const res = await rlFetch(ci.url);
      const buf = Buffer.from(await res.arrayBuffer());
      const m = await sharp(buf).metadata();
      const bandH = Math.min(Math.round(m.width / BAND_ASPECT), m.height); // clamp for ultra-wide panoramas
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
