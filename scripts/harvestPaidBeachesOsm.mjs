// Harvest candidate "you pay to be here" beaches in Greece from OpenStreetMap (Overpass).
//
//   node scripts/harvestPaidBeachesOsm.mjs
//
// Greek foreshore is public/free by law, so the paid exceptions are flagged in OSM via:
//   leisure=beach_resort           -> a managed beach that MAY charge admission/be private
//   natural=beach + fee=yes        -> an explicit entrance fee
//   natural=beach + access=private|customers|permit  -> a private/customers-only beach
// This is a CANDIDATE seed only: the result is reviewed by a human in
// scripts/importPaidEntry.mjs (match -> adjudication report -> apply). We never write a
// "paid" flag straight from OSM, because the cost of a false positive (calling a free
// beach paid) is high.
//
// Output:
//   scripts/data/paid-beaches-osm.json        (the seed: one record per candidate)
//   reports/paid-entry/harvest-summary.json   (counts + a sample for a human glance)
//
// Mirrors scripts/harvestCampsitesOsm.mjs (same mirror failover + User-Agent); one-shot, no cache.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { overpassMirrors, USER_AGENT, sleep } from './lib/placeResolution.mjs';

const SEED_OUT = new URL('./data/paid-beaches-osm.json', import.meta.url);
const REPORT_OUT = new URL('../reports/paid-entry/harvest-summary.json', import.meta.url);
const CHECKED_AT = new Date().toISOString().slice(0, 10);

// Greece as an OSM area; nwr = node/way/relation. `out center tags` gives one point per
// element (ways/relations collapse to their centroid).
const AREA_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="GR"][admin_level=2]->.gr;
(
  nwr["leisure"="beach_resort"](area.gr);
  nwr["natural"="beach"]["fee"="yes"](area.gr);
  nwr["natural"="beach"]["access"~"^(private|customers|permit)$"](area.gr);
);
out center tags;`;

// Fallback: a bounding box over Greece (incl. islands) if the area lookup times out.
const BBOX = '34.7,19.2,41.8,29.8'; // south,west,north,east
const BBOX_QUERY = `[out:json][timeout:180];
(
  nwr["leisure"="beach_resort"](${BBOX});
  nwr["natural"="beach"]["fee"="yes"](${BBOX});
  nwr["natural"="beach"]["access"~"^(private|customers|permit)$"](${BBOX});
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

const PRIVATE_ACCESS = new Set(['private', 'customers', 'permit']);

// Decide the paid-entry kind from OSM tags, or a drop reason. Only EXPLICIT signals survive:
//   fee=yes / charge present  -> entrance_fee
//   access=private|customers  -> private_club
// A bare leisure=beach_resort is DROPPED: in Greece that tag is routinely slapped on a beach
// bar / hotel sitting on an otherwise FREE public beach (e.g. "Antisamos Beach Bar"), so it is
// not trustworthy evidence that you pay — and a false "you pay here" is the costly error.
const classify = (tags) => {
  const fee = (tags.fee || '').trim().toLowerCase();
  const access = (tags.access || '').trim().toLowerCase();
  const isResort = tags.leisure === 'beach_resort';
  const hasCharge = typeof tags.charge === 'string' && tags.charge.trim();

  if (fee === 'yes' || (hasCharge && fee !== 'no')) return { kind: 'entrance_fee' };
  if (PRIVATE_ACCESS.has(access)) return { kind: 'private_club' };
  return { drop: isResort ? 'drop-resort-unconfirmed' : 'drop-no-signal' };
};

const normalizeWebsite = (url) => {
  if (!url) return undefined;
  const t = url.trim();
  if (!t) return undefined;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
};

const main = async () => {
  console.log('Querying Overpass for Greek paid/private beaches (area)…');
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

    const verdict = classify(tags);
    if (verdict.drop) {
      dropReasons[verdict.drop] = (dropReasons[verdict.drop] || 0) + 1;
      dropped.push({ name: tags['name:el'] || tags.name, reason: verdict.drop, osm: `${el.type}/${el.id}` });
      continue;
    }

    const nameEl = firstTag(tags, ['name:el', 'name']);
    const nameEn = firstTag(tags, ['name:en']);
    const name = nameEl || nameEn || tags.name;
    const website = normalizeWebsite(firstTag(tags, ['website', 'contact:website', 'url', 'operator:website']));
    const charge = firstTag(tags, ['charge', 'fee:conditional']);

    const id = `osm-${el.type}-${el.id}`;
    const record = {
      id,
      name,
      ...(nameEn && nameEn !== nameEl ? { nameEn } : {}),
      coordinates: { lat, lon },
      kind: verdict.kind,
      ...(charge ? { priceText: charge } : {}),
      ...(website ? { sourceUrls: [website] } : {}),
      // raw tags kept for the human reviewer (audit trail)
      tags: {
        ...(tags.leisure ? { leisure: tags.leisure } : {}),
        ...(tags.fee ? { fee: tags.fee } : {}),
        ...(tags.access ? { access: tags.access } : {}),
        ...(tags.operator ? { operator: tags.operator } : {}),
      },
      source: 'osm',
      osmUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      checkedAt: CHECKED_AT,
    };
    byId.set(id, record); // dedup by stable OSM id
  }

  const beaches = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'el'));
  const byKind = beaches.reduce((acc, b) => { acc[b.kind] = (acc[b.kind] || 0) + 1; return acc; }, {});

  mkdirSync(dirname(fileURLToPath(SEED_OUT)), { recursive: true });
  writeFileSync(SEED_OUT, JSON.stringify(beaches, null, 2) + '\n', 'utf8');

  const summary = {
    generatedAt: new Date().toISOString(),
    query: 'overpass leisure=beach_resort | natural=beach+(fee=yes|access=private/customers/permit), area=GR',
    rawElements: elements.length,
    kept: beaches.length,
    byKind,
    droppedNoName,
    droppedNoCoord,
    dropReasons,
    withPrice: beaches.filter((b) => b.priceText).length,
    sampleKept: beaches.slice(0, 40).map((b) => `${b.name} [${b.kind}]`),
    droppedSample: dropped.slice(0, 60),
  };
  mkdirSync(dirname(fileURLToPath(REPORT_OUT)), { recursive: true });
  writeFileSync(REPORT_OUT, JSON.stringify(summary, null, 2) + '\n', 'utf8');

  console.log(`\nKept ${beaches.length} candidates (raw ${elements.length}). byKind: ${JSON.stringify(byKind)}`);
  console.log(`  dropped: ${droppedNoName} unnamed, ${droppedNoCoord} no-coord, ${JSON.stringify(dropReasons)}.`);
  console.log(`Wrote seed -> scripts/data/paid-beaches-osm.json`);
  console.log(`Wrote summary -> reports/paid-entry/harvest-summary.json`);
  console.log(`Next: node scripts/importPaidEntry.mjs match`);
};

main().catch((err) => { console.error(err); process.exit(1); });
