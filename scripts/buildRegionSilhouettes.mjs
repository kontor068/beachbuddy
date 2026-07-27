/**
 * Build tiny coastline sketches ("silhouettes") for the landing page's region tiles.
 *
 * Each tile gets a ~28px line drawing of the real coast of that place, traced from
 * the same OSM land mask the exposure geometry uses. It is not decoration for its
 * own sake: the whole product is about the shape of a coastline, so the shape is
 * the honest thing to draw next to the name.
 *
 * Input:  .tmp/geospatial/greece-land-osm-split.geojson  (fetchHighResLandMask.mjs)
 *         public/data/beaches/index.json + per-region beach files
 * Output: data/regionSilhouettes.generated.json  { v, generatedAt, regions: { <id>: { d, w, h } } }
 *
 * The 34 MB input is a build artefact and is NOT committed, so the OUTPUT is
 * committed instead and this script only needs re-running when the region list or
 * the land mask changes. Run:
 *
 *   node scripts/buildRegionSilhouettes.mjs
 *   node scripts/buildRegionSilhouettes.mjs --all      (all 110 regions, not just the landing set)
 *
 * WHY CLIPPING, NOT "find the island ring": a region is sometimes a whole island
 * (Naxos), sometimes a slice of one (Chania is a third of Crete), sometimes a piece
 * of mainland (Halkidiki). Clipping every land ring to the region's own beach
 * bounding box handles all three with one rule — an island that fits inside the box
 * comes out as a closed outline, a slice comes out as the coast arc that actually
 * belongs to that region.
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAND_GEOJSON = path.join(ROOT, '.tmp', 'geospatial', 'greece-land-osm-split.geojson');
const BEACH_INDEX = path.join(ROOT, 'public', 'data', 'beaches', 'index.json');
const OUT_FILE = path.join(ROOT, 'data', 'regionSilhouettes.generated.json');

/** The 13 regions the landing page links to — keep in step with services/nationalConditions.ts. */
const LANDING_REGIONS = [
  'ionian-islands-corfu', 'ionian-islands-lefkada', 'ionian-islands-kefalonia',
  'central-macedonia-halkidiki-mainland', 'thessaly-magnesia-mainland---pelion',
  'attica-east-attica-mainland', 'north-aegean-lemnos', 'north-aegean-lesvos',
  'south-aegean-paros', 'south-aegean-naxos', 'south-aegean-patmos',
  'south-aegean-rhodes', 'crete-crete-chania',
];

/** Padding around the beach bbox, as a fraction of its larger side. */
const PAD_FRACTION = 0.10;
/** Never pad less than this (degrees) — tiny regions would otherwise clip their own coast. */
const MIN_PAD_DEG = 0.012;
/** Rings shorter than this share of the longest kept ring are specks at 28px. */
const MIN_RING_SHARE = 0.10;
/** Hard cap on drawn chains — more than this reads as static, not as a place. */
const MAX_CHAINS = 10;
/** Total point budget for the whole drawing. */
const MAX_POINTS = 150;
/** Normalised viewBox side. */
const VIEW = 100;

const wantAll = process.argv.includes('--all');

// ---------------------------------------------------------------- regions ----
const index = JSON.parse(fs.readFileSync(BEACH_INDEX, 'utf8'));
const wanted = wantAll ? index.regions.map(r => r.id) : LANDING_REGIONS;

const regions = [];
for (const id of wanted) {
  const entry = index.regions.find(r => r.id === id);
  if (!entry) { console.warn(`! unknown region ${id}`); continue; }
  let beaches;
  try {
    beaches = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', entry.appDataPath), 'utf8')).island.beaches;
  } catch { console.warn(`! no beach file for ${id}`); continue; }
  const lats = beaches.map(b => b.coordinates.lat), lons = beaches.map(b => b.coordinates.lon);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const pad = Math.max(MIN_PAD_DEG, Math.max(maxLat - minLat, maxLon - minLon) * PAD_FRACTION);
  regions.push({
    id,
    box: { minLat: minLat - pad, maxLat: maxLat + pad, minLon: minLon - pad, maxLon: maxLon + pad },
    chains: [],
  });
}
console.log(`Regions: ${regions.length}`);

// ------------------------------------------------------------- clip helper ---
// Sutherland-Hodgman is for filled polygons; here the ring is a LINE we want to
// keep only inside the box, so walk it and cut it into open runs instead.
const inBox = (lon, lat, b) => lon >= b.minLon && lon <= b.maxLon && lat >= b.minLat && lat <= b.maxLat;

const clipRing = (ring, box) => {
  const runs = [];
  let cur = null;
  for (const [lon, lat] of ring) {
    if (inBox(lon, lat, box)) {
      if (!cur) { cur = []; runs.push(cur); }
      cur.push([lon, lat]);
    } else {
      cur = null;
    }
  }
  // A ring that never left the box is closed — stitch the wrap-around so the
  // island outline does not show a seam where the source ring happened to start.
  if (runs.length === 1 && runs[0].length === ring.length) {
    const r = runs[0];
    if (r.length > 2 && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1])) r.push(r[0]);
  }
  return runs.filter(r => r.length >= 3);
};

// -------------------------------------------------------------- streaming ----
if (!fs.existsSync(LAND_GEOJSON)) {
  console.error(`\nMissing ${path.relative(ROOT, LAND_GEOJSON)}`);
  console.error('Run scripts/fetchHighResLandMask.mjs first (see docs/methodology-wind-exposure-GR.md).');
  process.exit(1);
}

const rl = readline.createInterface({ input: fs.createReadStream(LAND_GEOJSON, { encoding: 'utf8' }), crlfDelay: Infinity });
let seen = 0;
for await (const line of rl) {
  const start = line.indexOf('{"type":"Feature"');
  if (start === -1) continue;
  let end = line.lastIndexOf('}');
  const text = line.slice(start, end + 1).replace(/,$/, '');
  let feature;
  try { feature = JSON.parse(text); } catch { continue; }
  const geom = feature.geometry;
  if (!geom) continue;
  const polys = geom.type === 'Polygon' ? [geom.coordinates]
    : geom.type === 'MultiPolygon' ? geom.coordinates : [];
  for (const poly of polys) {
    const ring = poly[0];
    if (!ring || ring.length < 4) continue;
    // Cheap reject on the ring bbox before any per-vertex work.
    let rMinLon = Infinity, rMaxLon = -Infinity, rMinLat = Infinity, rMaxLat = -Infinity;
    for (const [lon, lat] of ring) {
      if (lon < rMinLon) rMinLon = lon; if (lon > rMaxLon) rMaxLon = lon;
      if (lat < rMinLat) rMinLat = lat; if (lat > rMaxLat) rMaxLat = lat;
    }
    for (const region of regions) {
      const b = region.box;
      if (rMaxLon < b.minLon || rMinLon > b.maxLon || rMaxLat < b.minLat || rMinLat > b.maxLat) continue;
      for (const run of clipRing(ring, b)) region.chains.push(run);
    }
  }
  if (++seen % 200000 === 0) process.stderr.write(`${(seen / 1000) | 0}k `);
}
console.log(`\nFeatures scanned: ${seen}`);

// ------------------------------------------------------------- simplify -----
const perp = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const cx = a[0] + Math.max(0, Math.min(1, t)) * dx;
  const cy = a[1] + Math.max(0, Math.min(1, t)) * dy;
  return Math.hypot(p[0] - cx, p[1] - cy);
};
// Iterative Douglas-Peucker: island rings run to tens of thousands of vertices and
// the recursive form blows the stack on them.
const simplify = (pts, tol) => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop();
    let max = 0, idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perp(pts[i], pts[lo], pts[hi]);
      if (d > max) { max = d; idx = i; }
    }
    if (idx !== -1 && max > tol) { keep[idx] = 1; stack.push([lo, idx], [idx, hi]); }
  }
  return pts.filter((_, i) => keep[i]);
};

const out = {};
for (const region of regions) {
  if (!region.chains.length) { console.warn(`! no coast found for ${region.id}`); continue; }

  // Equirectangular projection so the shape is not stretched at 38N.
  const lat0 = (region.box.minLat + region.box.maxLat) / 2;
  const k = Math.cos(lat0 * Math.PI / 180);
  const proj = ([lon, lat]) => [lon * k, -lat];

  let chains = region.chains.map(c => c.map(proj));
  const len = c => c.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - c[i - 1][0], p[1] - c[i - 1][1]) : 0), 0);
  chains = chains.map(c => ({ c, l: len(c) })).sort((a, b) => b.l - a.l);
  const longest = chains[0].l;
  chains = chains.filter(x => x.l >= longest * MIN_RING_SHARE).slice(0, MAX_CHAINS).map(x => x.c);

  const pts = chains.flat();
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  // One shared scale for x and y, centred — squashing a coastline to fill a square
  // would draw a place that does not exist.
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const offX = (span - (maxX - minX)) / 2, offY = (span - (maxY - minY)) / 2;
  const norm = p => [((p[0] - minX + offX) / span) * VIEW, ((p[1] - minY + offY) / span) * VIEW];
  chains = chains.map(c => c.map(norm));

  let tol = 0.25, simplified = chains;
  for (let i = 0; i < 60; i++) {
    simplified = chains.map(c => simplify(c, tol)).filter(c => c.length >= 3);
    if (simplified.reduce((s, c) => s + c.length, 0) <= MAX_POINTS) break;
    tol *= 1.2;
  }

  const d = simplified
    .map(c => 'M' + c.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L'))
    .join('');
  out[region.id] = { d };
  console.log(`${region.id.padEnd(40)} chains=${String(simplified.length).padStart(2)} pts=${String(simplified.reduce((s, c) => s + c.length, 0)).padStart(3)} bytes=${d.length}`);
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify({ v: 1, view: VIEW, generatedAt: new Date().toISOString(), regions: out }, null, 2));
const total = Object.values(out).reduce((s, r) => s + r.d.length, 0);
console.log(`\n-> ${path.relative(ROOT, OUT_FILE)}  (${Object.keys(out).length} regions, ${(total / 1024).toFixed(1)} KB of path data)`);
