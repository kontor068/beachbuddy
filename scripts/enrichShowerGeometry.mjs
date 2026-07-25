// Confirm shower↔beach membership against the beach's REAL OSM polygon — network ONCE, cached.
//
//   node scripts/enrichShowerGeometry.mjs
//
// Why: linkShowersToBeaches measures shower→beach PIN distance (a single label point), so a
// shower at the edge of a long beach reads as "150 m" only because the pin sits mid-beach.
// This fetches each beach's actual natural=beach geometry and measures shower→POLYGON distance
// (0 if the shower is inside the beach). A shower inside/at the edge of the polygon is that
// beach's shower with HIGH confidence regardless of pin offset — genuine promotion, not a
// loosened threshold. Showers that are NOT near any beach polygon stay unpromoted (honest).
//
// Reads:  scripts/data/showers-osm.json, public/greek_beaches.json
// Writes: scripts/data/shower-beach-geometry-raw.json  (raw OSM beach geometry — never re-fetch)
//         scripts/data/shower-beach-geometry.json      ({ [showerOsmUrl]: {beachId, polyDistM, inside} })
import { readFileSync, writeFileSync } from 'node:fs';
import { overpassMirrors, USER_AGENT, sleep, distanceMeters } from './lib/placeResolution.mjs';

const SEED = new URL('./data/showers-osm.json', import.meta.url);
const DATA = new URL('../public/greek_beaches.json', import.meta.url);
const RAW_OUT = new URL('./data/shower-beach-geometry-raw.json', import.meta.url);
const OUT = new URL('./data/shower-beach-geometry.json', import.meta.url);

const ATTRIB_RADIUS_M = 250;  // same window the linker attributes within
const DEG = 0.004;

const showers = JSON.parse(readFileSync(SEED, 'utf8'));
const data = JSON.parse(readFileSync(DATA, 'utf8'));

function* iterBeaches(d) {
  for (const sub of Object.values(d)) for (const subSub of Object.values(sub)) for (const arr of Object.values(subSub)) if (Array.isArray(arr)) for (const beach of arr) yield beach;
}
const beaches = [...iterBeaches(data)].filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lon));

// Attribute each shower to its single nearest beach (mirrors the linker) so we know which
// beach polygon to test it against. Only beaches that actually receive a shower need geometry.
const beachOf = new Map();       // showerIdx -> beach
const beachesNeedingGeom = new Map(); // beachId -> beach
showers.forEach((s, i) => {
  const { lat, lon } = s.coordinates;
  let best = null, bestM = Infinity;
  for (const b of beaches) {
    if (Math.abs(b.lat - lat) > DEG || Math.abs(b.lon - lon) > DEG) continue;
    const m = distanceMeters({ lat, lon }, { lat: b.lat, lon: b.lon });
    if (m < bestM) { bestM = m; best = b; }
  }
  if (best && bestM <= ATTRIB_RADIUS_M) { beachOf.set(i, best); beachesNeedingGeom.set(best.id, best); }
});
console.log(`${beachesNeedingGeom.size} beaches receive a shower → fetching their OSM geometry.`);

// --- Overpass: beach polygons with full geometry around each beach pin -----------------
const chunk = (arr, n) => { const o = []; for (let i = 0; i < arr.length; i += n) o.push(arr.slice(i, i + n)); return o; };
const fetchOverpass = async (query) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const mirror of overpassMirrors) {
      try {
        const res = await fetch(mirror, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(query) });
        if (res.status === 429 || res.status >= 500) continue;
        const text = await res.text();
        if (!res.ok || text.trimStart().startsWith('<')) continue;
        return JSON.parse(text);
      } catch { /* next mirror */ }
    }
    await sleep(2000 * (attempt + 1));
  }
  return null;
};

const beachList = [...beachesNeedingGeom.values()];
const rawElements = [];
const batches = chunk(beachList, 25);
for (let bi = 0; bi < batches.length; bi++) {
  const around = batches[bi].map(b => `way(around:${ATTRIB_RADIUS_M + 60},${b.lat},${b.lon})["natural"="beach"];rel(around:${ATTRIB_RADIUS_M + 60},${b.lat},${b.lon})["natural"="beach"];`).join('\n');
  const query = `[out:json][timeout:120];(\n${around}\n);out geom;`;
  console.error(`geometry batch ${bi + 1}/${batches.length} (${batches[bi].length} beaches)…`);
  const d = await fetchOverpass(query);
  if (d?.elements) rawElements.push(...d.elements);
  await sleep(700);
}
writeFileSync(RAW_OUT, JSON.stringify({ generatedAt: new Date().toISOString(), elements: rawElements }, null, 1) + '\n', 'utf8');
console.log(`Fetched ${rawElements.length} beach geometry elements.`);

// --- Geometry helpers (equirectangular metres about a local latitude) ------------------
const M = 111320;
const toXY = (lat, lon, lat0) => ({ x: lon * M * Math.cos(lat0 * Math.PI / 180), y: lat * M });
const pointInRing = (px, py, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].x, yi = ring[i].y, xj = ring[j].x, yj = ring[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
};
const distToSeg = (px, py, ax, ay, bx, by) => {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
};
// Ring geometry for an element: ways carry `geometry`; relations carry outer members' geometry.
const ringsOf = (el) => {
  if (Array.isArray(el.geometry)) return [el.geometry];
  if (Array.isArray(el.members)) return el.members.filter(m => m.role !== 'inner' && Array.isArray(m.geometry)).map(m => m.geometry);
  return [];
};
const centroid = (rings) => {
  let sx = 0, sy = 0, n = 0;
  for (const r of rings) for (const p of r) { sx += p.lon; sy += p.lat; n++; }
  return n ? { lat: sy / n, lon: sx / n } : null;
};
// distance (m) from a point to a polygon (0 if inside), across all its rings
const pointToPolygon = (lat, lon, rings) => {
  const lat0 = lat;
  const { x: px, y: py } = toXY(lat, lon, lat0);
  for (const ring of rings) {
    const xy = ring.map(p => toXY(p.lat, p.lon, lat0));
    if (pointInRing(px, py, xy)) return 0;
  }
  let best = Infinity;
  for (const ring of rings) {
    const xy = ring.map(p => toXY(p.lat, p.lon, lat0));
    for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
      best = Math.min(best, distToSeg(px, py, xy[j].x, xy[j].y, xy[i].x, xy[i].y));
    }
  }
  return best;
};

// Group beach polygons; for each beach pick the polygon that contains/ is nearest its pin.
const polys = rawElements.map(el => ({ rings: ringsOf(el), c: centroid(ringsOf(el)), osm: `${el.type}/${el.id}` })).filter(p => p.rings.length && p.c);
const polygonForBeach = (b) => {
  let chosen = null, bestScore = Infinity;
  for (const p of polys) {
    if (Math.abs(p.c.lat - b.lat) > DEG || Math.abs(p.c.lon - b.lon) > DEG) continue;
    const dPin = pointToPolygon(b.lat, b.lon, p.rings);          // pin inside polygon → 0
    const dCen = distanceMeters({ lat: b.lat, lon: b.lon }, p.c);
    const score = dPin * 2 + dCen;                               // prefer polygons that contain the pin
    if (score < bestScore) { bestScore = score; chosen = p; }
  }
  return chosen;
};

const out = {};
let confirmed = 0, unresolved = 0;
showers.forEach((s, i) => {
  const b = beachOf.get(i);
  if (!b) return;
  const poly = polygonForBeach(b);
  if (!poly) { out[s.osmUrl] = { beachId: b.id, polyDistM: null, inside: false, note: 'no-polygon' }; unresolved++; return; }
  const d = pointToPolygon(s.coordinates.lat, s.coordinates.lon, poly.rings);
  const rec = { beachId: b.id, polyDistM: Math.round(d), inside: d === 0, beachPolygon: poly.osm };
  out[s.osmUrl] = rec;
  if (d <= 20) confirmed++;
});
writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n', 'utf8');
console.log(`Wrote geometry cache: ${Object.keys(out).length} showers | ${confirmed} within 20 m of a beach polygon | ${unresolved} without polygon.`);
console.log(`  raw   -> scripts/data/shower-beach-geometry-raw.json`);
console.log(`  cache -> scripts/data/shower-beach-geometry.json`);
