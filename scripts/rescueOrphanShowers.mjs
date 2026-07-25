// Rescue orphan showers by matching them to beach POLYGONS instead of label pins.
//
//   node scripts/rescueOrphanShowers.mjs
//
// Why: linkShowersToBeaches attributes a shower to a beach only when the beach's PIN is within
// 250 m. On long beaches (Elafonisi, Plakias, Kouremenos…) the shower sits at the far end, 250-
// 800 m from the pin, so it was dropped as an "orphan" even though it is plainly on OUR beach.
// This queries the real natural=beach polygons around every orphan shower, then asks:
//   - is the shower ON a beach polygon (inside / ≤ ON_BEACH_M)?          → it IS a beach shower
//   - does one of OUR beach pins sit on that same polygon?               → attribute it there
//   - no beach of ours on that polygon?                                  → genuinely missing beach
// Output feeds linkShowersToBeaches (rescue map) and a missing-beach candidate list.
//
// Writes: scripts/data/shower-orphan-rescue-raw.json  (raw polygons — never re-fetch)
//         scripts/data/shower-orphan-rescue.json      ({ [showerOsmUrl]: beachId })
//         reports/showers/missing-beach-candidates.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { overpassMirrors, USER_AGENT, sleep, distanceMeters } from './lib/placeResolution.mjs';

const showers = JSON.parse(readFileSync(new URL('./data/showers-osm.json', import.meta.url), 'utf8'));
const data = JSON.parse(readFileSync(new URL('../public/greek_beaches.json', import.meta.url), 'utf8'));

const ATTRIB_RADIUS_M = 250;   // what the linker already covers
const SEARCH_M = 500;          // how far out we look for a beach polygon
const ON_BEACH_M = 40;         // shower this close to a polygon ⇒ it is on that beach
const OUR_PIN_ON_POLY_M = 60;  // our pin this close to the polygon ⇒ that polygon is our beach

function* iter(o) {
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) { for (const b of v) yield b; }
    else if (v && typeof v === 'object') yield* iter(v);
  }
}
const ours = [...iter(data)].filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lon));

// Orphans = showers with no beach pin within ATTRIB_RADIUS_M.
const orphans = showers.filter(s => {
  const { lat, lon } = s.coordinates;
  return !ours.some(b => Math.abs(b.lat - lat) <= 0.01 && Math.abs(b.lon - lon) <= 0.01
    && distanceMeters({ lat, lon }, { lat: b.lat, lon: b.lon }) <= ATTRIB_RADIUS_M);
});
console.log(`${orphans.length} orphan showers → fetching nearby beach polygons.`);

const chunk = (a, n) => { const o = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const fetchOverpass = async (q) => {
  for (let a = 0; a < 4; a++) {
    for (const m of overpassMirrors) {
      try {
        const r = await fetch(m, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(q) });
        if (r.status === 429 || r.status >= 500) continue;
        const t = await r.text();
        if (!r.ok || t.trimStart().startsWith('<')) continue;
        return JSON.parse(t);
      } catch { /* next */ }
    }
    await sleep(2000 * (a + 1));
  }
  return null;
};

const raw = [];
const batches = chunk(orphans, 25);
for (let i = 0; i < batches.length; i++) {
  const around = batches[i].map(s => `way(around:${SEARCH_M},${s.coordinates.lat},${s.coordinates.lon})["natural"="beach"];rel(around:${SEARCH_M},${s.coordinates.lat},${s.coordinates.lon})["natural"="beach"];`).join('\n');
  console.error(`rescue batch ${i + 1}/${batches.length}…`);
  const d = await fetchOverpass(`[out:json][timeout:120];(\n${around}\n);out geom;`);
  if (d?.elements) raw.push(...d.elements);
  await sleep(700);
}
writeFileSync(new URL('./data/shower-orphan-rescue-raw.json', import.meta.url), JSON.stringify({ generatedAt: new Date().toISOString(), elements: raw }, null, 1) + '\n', 'utf8');
console.log(`Fetched ${raw.length} beach polygons.`);

// --- geometry ------------------------------------------------------------------------
const M = 111320;
const toXY = (lat, lon, lat0) => ({ x: lon * M * Math.cos(lat0 * Math.PI / 180), y: lat * M });
const inRing = (px, py, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const xi = r[i].x, yi = r[i].y, xj = r[j].x, yj = r[j].y; if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) c = !c; } return c; };
const segD = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy; let t = l ? ((px - ax) * dx + (py - ay) * dy) / l : 0; t = Math.max(0, Math.min(1, t)); return Math.hypot(px - (ax + t * dx), py - (ay + t * dy)); };
const ringsOf = (el) => Array.isArray(el.geometry) ? [el.geometry] : Array.isArray(el.members) ? el.members.filter(m => m.role !== 'inner' && Array.isArray(m.geometry)).map(m => m.geometry) : [];
const ptToPoly = (lat, lon, rings) => {
  const { x: px, y: py } = toXY(lat, lon, lat);
  for (const r of rings) if (inRing(px, py, r.map(p => toXY(p.lat, p.lon, lat)))) return 0;
  let best = Infinity;
  for (const r of rings) { const xy = r.map(p => toXY(p.lat, p.lon, lat)); for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) best = Math.min(best, segD(px, py, xy[j].x, xy[j].y, xy[i].x, xy[i].y)); }
  return best;
};
const polys = raw.map(el => ({ rings: ringsOf(el), osm: `${el.type}/${el.id}`, name: el.tags?.name || el.tags?.['name:el'] || null }))
  .filter(p => p.rings.length);

const rescue = {};       // showerOsmUrl -> beachId
const missing = [];      // beach polygons with a shower but no beach of ours
let onBeach = 0, notBeach = 0;

for (const s of orphans) {
  const { lat, lon } = s.coordinates;
  // nearest beach polygon to this shower
  let poly = null, pd = Infinity;
  for (const p of polys) {
    const d = ptToPoly(lat, lon, p.rings);
    if (d < pd) { pd = d; poly = p; }
  }
  if (!poly || pd > ON_BEACH_M) { notBeach++; continue; }  // pool / urban / marina shower
  onBeach++;
  // which of OUR beaches sits on that same polygon?
  let mine = null, md = Infinity;
  for (const b of ours) {
    if (Math.abs(b.lat - lat) > 0.02 || Math.abs(b.lon - lon) > 0.02) continue;
    const d = ptToPoly(b.lat, b.lon, poly.rings);
    if (d < md) { md = d; mine = b; }
  }
  if (mine && md <= OUR_PIN_ON_POLY_M) {
    rescue[s.osmUrl] = mine.id;
  } else {
    missing.push({ shower: s.osmUrl, showerName: s.name || null, beachPolygon: poly.osm, beachName: poly.name, showerToPolyM: Math.round(pd), coordinates: s.coordinates });
  }
}

writeFileSync(new URL('./data/shower-orphan-rescue.json', import.meta.url), JSON.stringify(rescue, null, 1) + '\n', 'utf8');
mkdirSync(new URL('../reports/showers/', import.meta.url), { recursive: true });
writeFileSync(new URL('../reports/showers/missing-beach-candidates.json', import.meta.url), JSON.stringify(missing, null, 1) + '\n', 'utf8');

console.log(`\nOrphans on a real beach polygon: ${onBeach} | not on any beach (pool/urban/marina): ${notBeach}`);
console.log(`  RESCUED to one of our beaches: ${Object.keys(rescue).length}`);
console.log(`  on a beach we do NOT have (missing-beach candidates): ${missing.length}`);
console.log(`Wrote scripts/data/shower-orphan-rescue.json + reports/showers/missing-beach-candidates.json`);
