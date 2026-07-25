// Discover "hidden" beaches a region is MISSING — the ones the OSM coverage-gap pipeline
// (scripts/harvestBeachesOsm.mjs) structurally cannot find because OSM either doesn't tag
// them at all or tags them only as an UNNAMED natural=beach polygon (dropped for having no
// name-key). This flips the model: instead of "what does OSM have that we lack", it asks
// "what beach exists on the ground (per human guides / OSM unnamed geometry) that we lack".
//
// Two independent signals, cross-referenced:
//   1. OSM bbox harvest (named AND unnamed natural=beach) masked to the region -> gaps vs us.
//   2. Optional candidate NAMES from guides/blogs/Wikidata -> geocoded, deduped, OSM-gap tested.
// The sweet spot = a guide NAME landing on an OSM UNNAMED polygon we lack (e.g. Kastri/Geraistos).
//
//   node scripts/discoverHiddenBeaches.mjs \
//     --bbox=37.90,24.00,38.35,24.70 --mask=37.88,38.28,24.18,24.66 \
//     --region="Central Greece" --prefecture=Evia --municipality=Evia \
//     [--candidates=scripts/data/<region>-candidates.json] [--out=reports/coverage/<region>-discovery.json]
//
// Free: OSM Overpass + Nominatim only (no paid API). Reuses the shared place-resolution
// primitives (User-Agent, mirror failover, disk cache). Read-only: writes a report, never data.
// Promote survivors with scripts/insertDiscoveredBeaches.mjs after human/AI verification.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  overpassMirrors, USER_AGENT, fetchOverpassBeaches, fetchNominatim, distanceMeters, openPlaceCache,
} from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const nums = (s) => (s ? s.split(',').map(Number) : null);

const BBOX = nums(arg('bbox'));            // S,W,N,E  (Overpass order)
const MASK = nums(arg('mask'));            // minLat,maxLat,minLon,maxLon (region-only clamp)
const REGION = arg('region');
const PREFECTURE = arg('prefecture');
const MUNICIPALITY = arg('municipality');
const CANDIDATES = arg('candidates');
const OUT = path.resolve(rootDir, arg('out', `reports/coverage/hidden-discovery-${(REGION || 'region').toLowerCase().replace(/\s+/g, '-')}.json`));
if (!BBOX || BBOX.length !== 4 || !MASK || MASK.length !== 4) { console.error('Need --bbox=S,W,N,E and --mask=minLat,maxLat,minLon,maxLon'); process.exit(1); }

const cache = openPlaceCache(path.join(rootDir, '.tmp', 'discovery-cache.json'));
const inMask = (lat, lon) => lat > MASK[0] && lat < MASK[1] && lon > MASK[2] && lon < MASK[3];

// --- existing beaches for the target region (dedup + gap baseline) -----------------
const data = JSON.parse(readFileSync(path.join(rootDir, 'public', 'greek_beaches.json'), 'utf8'));
const existing = [];
for (const [rName, sub] of Object.entries(data)) {
  if (REGION && rName !== REGION) continue;
  for (const [pName, subSub] of Object.entries(sub)) {
    if (PREFECTURE && pName !== PREFECTURE) continue;
    for (const [mName, arr] of Object.entries(subSub)) {
      if (MUNICIPALITY && mName !== MUNICIPALITY) continue;
      if (Array.isArray(arr)) for (const b of arr) if (Number.isFinite(b.lat) && Number.isFinite(b.lon)) existing.push({ id: b.id, name: b.name, lat: b.lat, lon: b.lon });
    }
  }
}
console.log(`Existing beaches in scope: ${existing.length}`);

// --- Signal 1: OSM bbox harvest (named + unnamed), masked to region ----------------
const q = `[out:json][timeout:90];area["ISO3166-1"="GR"][admin_level=2]->.gr;(node["natural"="beach"](${BBOX.join(',')})(area.gr);way["natural"="beach"](${BBOX.join(',')})(area.gr););out center tags;`;
let osmJson = null;
for (const mirror of overpassMirrors) {
  try {
    const res = await fetch(mirror, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(q) });
    if (res.status === 429 || res.status === 504 || res.status >= 500) continue;
    osmJson = await res.json(); break;
  } catch { /* next mirror */ }
}
if (!osmJson) { console.error('OSM harvest: all mirrors failed'); process.exit(1); }
const osm = (osmJson.elements || []).map((e) => ({ type: e.type, id: e.id, name: e.tags?.name || e.tags?.['name:el'] || e.tags?.['name:en'] || null, lat: e.lat ?? e.center?.lat, lon: e.lon ?? e.center?.lon }))
  .filter((o) => Number.isFinite(o.lat) && Number.isFinite(o.lon) && inMask(o.lat, o.lon));
for (const o of osm) { let nd = Infinity, near = null; for (const b of existing) { const d = distanceMeters(o, b); if (d < nd) { nd = d; near = b; } } o.nearestDistM = Math.round(nd); o.nearest = near ? `${near.name} (#${near.id})` : null; }
const osmGaps = osm.filter((o) => o.nearestDistM > 150);
const namedGaps = osmGaps.filter((o) => o.name);
const unnamedGaps = osmGaps.filter((o) => !o.name);
console.log(`OSM in region: ${osm.length} (named ${osm.filter((o) => o.name).length}, unnamed ${osm.filter((o) => !o.name).length}) | gaps>150m: ${osmGaps.length} (named ${namedGaps.length}, unnamed ${unnamedGaps.length})`);

// --- Signal 2 (optional): candidate names -> geocode + dedup + OSM-gap classify -----
let triage = [];
if (CANDIDATES) {
  const cands = JSON.parse(readFileSync(path.resolve(rootDir, CANDIDATES), 'utf8'));
  for (const c of cands) {
    const rec = { nameGr: c.nameGr, locality: c.locality || '', sources: c.sources || [] };
    let coord = Number.isFinite(c.lat) && Number.isFinite(c.lon) ? { lat: c.lat, lon: c.lon, src: 'provided' } : null;
    if (!coord) {
      for (const query of [`${c.nameGr}, ${c.locality || REGION}`, `${c.nameGr}, ${REGION}`, ...(c.aliases || []).map((a) => `${a}, ${REGION}`)]) {
        let hits; try { hits = await fetchNominatim(query, 1100, { cache }); } catch { continue; }
        const good = hits.map((h) => ({ lat: h.location.latitude, lon: h.location.longitude })).filter((h) => inMask(h.lat, h.lon));
        if (good.length) { coord = { ...good[0], src: `nominatim:${query}` }; break; }
      }
    }
    if (!coord && Number.isFinite(c.estLat)) coord = { lat: c.estLat, lon: c.estLon, src: 'estimate' };
    if (!coord) { rec.status = 'NO_GEOCODE'; triage.push(rec); continue; }
    rec.coord = { lat: +coord.lat.toFixed(5), lon: +coord.lon.toFixed(5) }; rec.coordSrc = coord.src;
    let nd = Infinity, near = null; for (const b of existing) { const d = distanceMeters(rec.coord, b); if (d < nd) { nd = d; near = b; } }
    rec.nearestDistM = Math.round(nd); rec.nearest = near ? `${near.name} (#${near.id})` : null;
    const nearby = await fetchOverpassBeaches(rec.coord, 250, cache);
    rec.osmWithin250 = nearby === null ? 'MIRROR_FAIL' : nearby.length;
    rec.status = rec.nearestDistM <= 150 ? 'DUP' : nearby === null ? 'RETRY' : nearby.length > 0 ? 'NEW_but_OSM_KNOWS' : 'NEW_OSM_INVISIBLE';
    triage.push(rec);
  }
  cache.flush();
}

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ scope: { region: REGION, prefecture: PREFECTURE, municipality: MUNICIPALITY }, existing: existing.length, osm: { total: osm.length, namedGaps, unnamedGaps }, triage }, null, 2));
console.log(`\nNAMED OSM gaps (easy wins): ${namedGaps.map((g) => `«${g.name}»@${g.lat.toFixed(4)},${g.lon.toFixed(4)}`).join(' | ') || 'none'}`);
if (triage.length) { const t = {}; for (const r of triage) t[r.status] = (t[r.status] || 0) + 1; console.log(`Candidate triage: ${JSON.stringify(t)}`); }
console.log(`Wrote ${path.relative(rootDir, OUT)}`);
