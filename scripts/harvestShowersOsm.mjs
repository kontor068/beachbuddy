// Harvest public showers in Greece from OpenStreetMap (Overpass) — ONE-SHOT.
//
//   node scripts/harvestShowersOsm.mjs
//
// This is the network-expensive step. It runs a single area=GR query, caches the
// RAW Overpass response AND a cleaned seed to disk, and is meant to be run ONCE.
// Everything downstream (scripts/linkShowersToBeaches.mjs) reads these files and
// runs fully offline, so we never have to re-hit Overpass to iterate on matching.
//
// The reliable "this beach has a shower" signal in OSM is a dedicated
// `amenity=shower` node — usually the beach-entrance rinse shower. We also pick up
// beaches / beach_resorts that self-declare `shower=yes|hot|cold|outdoor` on their
// own element. Both collapse to a flat list of shower POINTS (lat/lon) that the
// linker snaps to the nearest beach pin.
//
// Output:
//   scripts/data/showers-osm-raw.json   (raw Overpass elements — so we never re-fetch)
//   scripts/data/showers-osm.json       (the seed: one record per shower point)
//   reports/showers/harvest-summary.json (counts + a sample for a human glance)
//
// Mirrors scripts/harvestCampsitesOsm.mjs (same mirror failover + area/bbox fallback).
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';

const RAW_OUT = new URL('./data/showers-osm-raw.json', import.meta.url);
const SEED_OUT = new URL('./data/showers-osm.json', import.meta.url);
const REPORT_OUT = new URL('../reports/showers/harvest-summary.json', import.meta.url);
const CHECKED_AT = new Date().toISOString().slice(0, 10);

// nwr = node/way/relation; `out center tags` collapses ways/relations to a centroid.
// Broadened national sweep: dedicated shower facilities (amenity=shower) AND any element
// carrying an affirmative shower= tag (a beach/resort/pool/standalone that declares a shower).
// The linker's proximity gate keeps only the ones actually at a beach, so casting wide here
// costs nothing in reliability but catches showers that lack the amenity=shower tag.
const AREA_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="GR"][admin_level=2]->.gr;
(
  nwr["amenity"="shower"](area.gr);
  nwr["shower"~"^(yes|hot|cold|outdoor|1|true)$",i](area.gr);
);
out center tags;`;

const BBOX = '34.7,19.2,41.8,29.8'; // south,west,north,east — Greece incl. islands
const BBOX_QUERY = `[out:json][timeout:180];
(
  nwr["amenity"="shower"](${BBOX});
  nwr["shower"~"^(yes|hot|cold|outdoor|1|true)$",i](${BBOX});
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

// Affirmative shower= values. `no`/`none`/`0`/`false` means explicitly NO shower —
// a beach tagged shower=no must never become a shower point.
const NEG = new Set(['no', 'none', '0', 'false']);
const isAffirmative = (v) => typeof v === 'string' && v.trim() && !NEG.has(v.trim().toLowerCase());

const main = async () => {
  console.log('Querying Overpass for Greek showers (area=GR)…');
  let elements = await fetchOverpass(AREA_QUERY);
  if (!elements) {
    console.warn('Area query failed on all mirrors; falling back to bbox query…');
    elements = await fetchOverpass(BBOX_QUERY);
  }
  if (!elements) {
    console.error('All Overpass mirrors failed for both queries. Try again later.');
    process.exit(1);
  }

  // Cache raw first — this is the thing we never want to fetch twice.
  mkdirSync(dirname(fileURLToPath(RAW_OUT)), { recursive: true });
  writeFileSync(RAW_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'national', query: 'amenity=shower | (natural=beach|beach_resort)[shower], area=GR', elements }, null, 1) + '\n', 'utf8');

  let droppedNoCoord = 0;
  const dropReasons = {};
  const byId = new Map();

  for (const el of elements) {
    const tags = el.tags || {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) { droppedNoCoord += 1; continue; }

    // Classify the source of the signal.
    let kind;
    if (tags.amenity === 'shower') {
      kind = 'shower-node';                          // dedicated shower facility
    } else if (isAffirmative(tags.shower)) {
      kind = tags.natural === 'beach' ? 'beach-tag'  // beach self-declares a shower
        : tags.leisure === 'beach_resort' ? 'resort-tag'
        : 'shower-tag';                              // standalone element with shower=yes
    } else {
      dropReasons['shower-negated-or-absent'] = (dropReasons['shower-negated-or-absent'] || 0) + 1;
      continue;                                      // e.g. a beach tagged shower=no
    }

    const id = `osm-${el.type}-${el.id}`;
    const record = {
      id,
      kind,
      coordinates: { lat, lon },
      name: firstTag(tags, ['name:el', 'name', 'name:en']) || null,
      // Useful facility qualifiers when present (hot water, fee, seasonal).
      ...(tags.shower && tags.shower !== 'yes' ? { showerType: tags.shower } : {}),
      ...(tags.fee ? { fee: tags.fee } : {}),
      ...(tags.access ? { access: tags.access } : {}),
      ...(tags.seasonal ? { seasonal: tags.seasonal } : {}),
      source: 'osm',
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      checkedAt: CHECKED_AT,
    };
    byId.set(id, record); // dedup by stable OSM id
  }

  const showers = [...byId.values()].sort((a, b) => a.coordinates.lat - b.coordinates.lat);
  const byKind = {};
  for (const s of showers) byKind[s.kind] = (byKind[s.kind] || 0) + 1;

  mkdirSync(dirname(fileURLToPath(SEED_OUT)), { recursive: true });
  writeFileSync(SEED_OUT, JSON.stringify(showers, null, 2) + '\n', 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    query: 'overpass amenity=shower | (natural=beach|beach_resort)[shower], area=GR',
    rawElements: elements.length,
    kept: showers.length,
    byKind,
    droppedNoCoord,
    dropReasons,
    withFee: showers.filter((s) => s.fee).length,
    hotWater: showers.filter((s) => s.showerType === 'hot').length,
    sampleNamed: showers.filter((s) => s.name).slice(0, 20).map((s) => s.name),
  };
  mkdirSync(dirname(fileURLToPath(REPORT_OUT)), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(summary, null, 2) + '\n', 'utf8');

  console.log(`\nKept ${showers.length} shower points (raw ${elements.length}).`);
  console.log(`  by kind: ${JSON.stringify(byKind)}`);
  console.log(`  dropped: ${droppedNoCoord} no-coord, ${JSON.stringify(dropReasons)}.`);
  console.log(`Wrote raw   -> scripts/data/showers-osm-raw.json`);
  console.log(`Wrote seed  -> scripts/data/showers-osm.json`);
  console.log(`Wrote report-> reports/showers/harvest-summary.json`);
};

main().catch((err) => { console.error(err); process.exit(1); });
