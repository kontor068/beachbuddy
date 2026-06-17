// Harvest organized campsites in Greece from OpenStreetMap (Overpass).
//
//   node scripts/harvestCampsitesOsm.mjs
//
// Wild camping is illegal in Greece, so we only keep real, named campgrounds
// (tourism=camp_site / caravan_site). The result is a flat seed consumed by
// scripts/linkCampsitesToBeaches.mjs, which snaps each site to nearby beaches.
//
// Output:
//   scripts/data/campsites-osm.json        (the seed: one record per campsite)
//   reports/camping/harvest-summary.json   (counts + a sample for a human glance)
//
// Mirrors fetchOverpassBeaches in scripts/lib/placeResolution.mjs (same mirror
// failover + User-Agent); no disk cache here — this is a one-shot harvest.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';

const SEED_OUT = new URL('./data/campsites-osm.json', import.meta.url);
const REPORT_OUT = new URL('../reports/camping/harvest-summary.json', import.meta.url);
const CHECKED_AT = new Date().toISOString().slice(0, 10);

// Greece as an OSM area; nwr = node/way/relation. `out center tags` gives one point
// per element (ways/relations collapse to their centroid).
const AREA_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="GR"][admin_level=2]->.gr;
(
  nwr["tourism"="camp_site"](area.gr);
  nwr["tourism"="caravan_site"](area.gr);
);
out center tags;`;

// Fallback: a bounding box over Greece (incl. islands) if the area lookup times out.
const BBOX = '34.7,19.2,41.8,29.8'; // south,west,north,east
const BBOX_QUERY = `[out:json][timeout:180];
(
  nwr["tourism"="camp_site"](${BBOX});
  nwr["tourism"="caravan_site"](${BBOX});
);
out center tags;`;

const fetchOverpass = async (query) => {
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetch(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(query),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) {
        console.warn(`  mirror ${mirror} -> HTTP ${res.status}, trying next`);
        await sleep(1500);
        continue;
      }
      const json = await res.json().catch(() => ({}));
      if (Array.isArray(json.elements)) return json.elements;
    } catch (err) {
      console.warn(`  mirror ${mirror} failed: ${err.message}`);
    }
    await sleep(1500);
  }
  return null;
};

const firstTag = (tags, keys) => {
  for (const k of keys) {
    const v = tags?.[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
};

const truthy = (v) => v === 'yes' || v === 'designated' || v === 'only';

// --- Name-based classification (the OSM camp_site tag is noisy in Greece) ----------
// Three things share tourism=camp_site here: tourist CAMPGROUNDS (what we want,
// "Κάμπινγκ X"/"Camping X"), youth/scout/religious/municipal summer CAMPS
// ("Κατασκήνωση …" — not for visitors), and informal WILD-camping pins ("…", emojis,
// "secret beach"). We keep a site only when the name says campground OR it carries an
// organized signal (website/phone) with a neutral name; youth/wild names are dropped.
const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hasCampingToken = (n) => /camping|kamping|campground|camp ?site|καμπινγκ|καμπιγκ|κεμπινγκ|къмпинг|кемпинг|кампинг/.test(n);
// WILD/informal: checked BEFORE the camping token, because "free camping" / "wild
// camping" contain the word "camping" yet are exactly what we must NOT list.
const isWild = (n) => /αγρια|wild ?camp|free ?camp|free camping|secret|night ?ride|night ?free|τροχοσπιτα|roma camp/.test(n);
// κατασκην* = youth/summer camp; προσκοπ/οδηγισμ = scouts/guides; μητροπολ/ενορ/χριστιαν
// = church; γεχα/χαεε/πικπα/τυπετ = org camps.
const isNonTourist = (n) => /κατασκην|προσκοπ|οδηγισμ|\bscout|μητροπολ|ενορ|χριστιαν|γεχα|χαεε|πικπα|τυπετ/.test(n);
// Accommodation mis-tagged as camp_site (rooms/studios/hotels). Dropped unless the
// name ALSO says camping (so "… Camping & Apartments" survives via the token check).
const isAccommodation = (n) => /\brooms?\b|studio|apartment|\bhotel\b|motel|\bvilla|guest ?house|pension|hostel|ξενων|ξενοδοχ|δωματ|διαμερισμ|ενοικιαζ/.test(n);

// An "organized signal": tags a real campground carries but a mis-tagged taverna /
// wild pin / rooms usually doesn't. Lets us keep "Karda Beach" / "Ipsos Beach"
// (genuine campgrounds with infra tags but no "camping" in the name) while still
// dropping bare junk that has only tourism=camp_site + a name.
const ORGANIZED_TAGS = [
  'website', 'contact:website', 'url', 'phone', 'contact:phone',
  'operator', 'operator:website', 'brand', 'stars', 'fee', 'reservation',
  'capacity', 'capacity:pitches', 'opening_hours', 'addr:street',
  'internet_access', 'shower', 'toilets', 'drinking_water', 'power_supply',
  'sanitary_dump_station', 'washing_machine', 'laundry',
  'caravans', 'tents', 'static_caravans', 'permanent_camping',
];
const NEG = new Set(['no', 'none', '0', 'false']);
const hasOrganizedSignal = (tags) => ORGANIZED_TAGS.some((k) => {
  const v = tags?.[k];
  return typeof v === 'string' && v.trim() && !NEG.has(v.trim().toLowerCase());
});

const PUBLIC_OK = new Set([undefined, 'yes', 'customers', 'permissive', 'public']);
// Returns 'keep' or a drop reason string.
const classify = (tags, name, hasSignal) => {
  if (truthy(tags.backcountry)) return 'drop-backcountry';
  if (truthy(tags.group_only)) return 'drop-group-only';
  if (!PUBLIC_OK.has(tags.access)) return 'drop-private';
  const n = norm(name);
  if (isWild(n)) return 'drop-wild';                     // free/wild/informal — never list
  if (hasCampingToken(n)) return 'keep';                 // unambiguous tourist campground
  if (isNonTourist(n)) return 'drop-non-tourist';        // youth/scout/church camp
  if (isAccommodation(n)) return 'drop-accommodation';   // rooms/studios/hotel mis-tagged
  if (hasSignal) return 'keep';                          // organized signal, neutral name
  return 'drop-unconfirmed';                             // no campground token, no signal
};

const normalizeWebsite = (url) => {
  if (!url) return undefined;
  const t = url.trim();
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const main = async () => {
  console.log('Querying Overpass for Greek campsites (area)…');
  let elements = await fetchOverpass(AREA_QUERY);
  if (!elements) {
    console.warn('Area query failed on all mirrors; falling back to bbox query…');
    elements = await fetchOverpass(BBOX_QUERY);
  }
  if (!elements) {
    console.error('All Overpass mirrors failed for both queries. Try again later.');
    process.exit(1);
  }

  let droppedNoName = 0;
  let droppedNoCoord = 0;
  const dropReasons = {};
  const dropped = [];
  const byId = new Map();

  for (const el of elements) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!tags.name && !tags['name:el'] && !tags['name:en']) { droppedNoName += 1; continue; }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { droppedNoCoord += 1; continue; }

    const nameEl = firstTag(tags, ['name:el', 'name']);
    const nameEn = firstTag(tags, ['name:en']);
    const name = nameEl || nameEn || tags.name;
    const website = normalizeWebsite(firstTag(tags, ['website', 'contact:website', 'url']));
    const phone = firstTag(tags, ['phone', 'contact:phone']);

    const verdict = classify(tags, name, hasOrganizedSignal(tags));
    if (verdict !== 'keep') {
      dropReasons[verdict] = (dropReasons[verdict] || 0) + 1;
      dropped.push({ name, reason: verdict, osm: `${el.type}/${el.id}` });
      continue;
    }

    const id = `osm-${el.type}-${el.id}`;
    const record = {
      id,
      name,
      ...(nameEn && nameEn !== nameEl ? { nameEn } : {}),
      coordinates: { lat, lon },
      ...(website ? { website } : {}),
      ...(phone ? { phone } : {}),
      ...(tags.caravans === 'yes' || tags.tents === 'yes' ? { caravans: tags.caravans === 'yes' } : {}),
      source: 'osm',
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      checkedAt: CHECKED_AT,
    };
    byId.set(id, record); // dedup by stable OSM id
  }

  const campsites = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));

  mkdirSync(dirname(fileURLToPath(SEED_OUT)), { recursive: true });
  writeFileSync(SEED_OUT, JSON.stringify(campsites, null, 2) + '\n', 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    query: 'overpass tourism=camp_site|caravan_site, area=GR',
    rawElements: elements.length,
    kept: campsites.length,
    droppedNoName,
    droppedNoCoord,
    dropReasons,
    withWebsite: campsites.filter((c) => c.website).length,
    withPhone: campsites.filter((c) => c.phone).length,
    sampleKept: campsites.slice(0, 30).map((c) => c.name),
    droppedSample: dropped.slice(0, 60),
  };
  mkdirSync(dirname(fileURLToPath(REPORT_OUT)), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(summary, null, 2) + '\n', 'utf8');

  console.log(`\nKept ${campsites.length} campsites (raw ${elements.length}).`);
  console.log(`  dropped: ${droppedNoName} unnamed, ${droppedNoCoord} no-coord, ${JSON.stringify(dropReasons)}.`);
  console.log(`  with website: ${summary.withWebsite}, with phone: ${summary.withPhone}.`);
  console.log(`Wrote seed -> scripts/data/campsites-osm.json`);
  console.log(`Wrote summary -> reports/camping/harvest-summary.json`);
};

main().catch((err) => { console.error(err); process.exit(1); });
