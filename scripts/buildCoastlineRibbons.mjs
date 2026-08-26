/**
 * Build per-region coastline "ribbon" slices for the map's coloured-coastline layer.
 *
 * For every region in public/data/beaches/index.json this extracts the stretches of
 * real OSM coastline that lie within RIBBON_MAX_DIST_M of at least one of the
 * region's live beaches, simplifies them, and annotates every vertex with the
 * nearest beach id + distance. Coastline farther than the cutoff is deliberately
 * NOT emitted so nothing downstream can paint a verdict where we have no beach data.
 *
 * The map layer that coloured these chains at runtime (CoastlineRibbonLayer) was
 * removed on 26/08/2026 — nothing had imported it for weeks. The output is still
 * required: buildShorelineThumbs.mjs reads it during `npm run build` to draw the
 * shape/ thumbnails, which is the only coastline data that reaches the CDN now
 * (scripts/stripBuildInputsFromDist.mjs deletes the flat chains from dist/).
 *
 * Input:  .tmp/geospatial/greece-land-osm-split.geojson  (fetchHighResLandMask.mjs)
 *         public/data/beaches/index.json + per-region beach files
 * Output: public/data/coastline/<regionId>.json
 *         { v, region, generatedAt, lines: [ [ [lat, lon, beachId, distM], ... ], ... ] }
 *
 * Run:  node scripts/buildCoastlineRibbons.mjs            (all regions)
 *       node scripts/buildCoastlineRibbons.mjs --region south-aegean-milos,south-aegean-naxos
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LAND_GEOJSON = path.join(ROOT, '.tmp', 'geospatial', 'greece-land-osm-split.geojson');
const BEACH_INDEX = path.join(ROOT, 'public', 'data', 'beaches', 'index.json');
const OUT_DIR = path.join(ROOT, 'public', 'data', 'coastline');

/** Coastline farther than this from every beach is not part of any ribbon. */
const RIBBON_MAX_DIST_M = 2000;
/** Douglas-Peucker simplification tolerance (metres) — keeps slices small. */
const SIMPLIFY_TOLERANCE_M = 18;
/** Drop chains shorter than this (metres) — isolated slivers add bytes, not signal. */
const MIN_CHAIN_LENGTH_M = 120;

const onlyRegions = (() => {
  const i = process.argv.indexOf('--region');
  if (i === -1) return null;
  return new Set(String(process.argv[i + 1] || '').split(',').map(s => s.trim()).filter(Boolean));
})();

// ---- small geo helpers (equirectangular approximations are fine at ribbon scale) ----
const M_PER_DEG_LAT = 111320;
const mPerDegLon = lat => Math.cos((lat * Math.PI) / 180) * M_PER_DEG_LAT;

const distM = (lat1, lon1, lat2, lon2) => {
  const kx = mPerDegLon((lat1 + lat2) / 2);
  const dx = (lon1 - lon2) * kx;
  const dy = (lat1 - lat2) * M_PER_DEG_LAT;
  return Math.sqrt(dx * dx + dy * dy);
};

/** Perpendicular distance (m) of point p from segment ab, all [lat, lon]. */
const segmentDistM = (p, a, b) => {
  const kx = mPerDegLon(p[0]);
  const ax = a[1] * kx, ay = a[0] * M_PER_DEG_LAT;
  const bx = b[1] * kx, by = b[0] * M_PER_DEG_LAT;
  const px = p[1] * kx, py = p[0] * M_PER_DEG_LAT;
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.sqrt((px - cx) ** 2 + (py - cy) ** 2);
};

/** Iterative Douglas-Peucker on [lat, lon] points. */
const simplify = (points, toleranceM) => {
  if (points.length <= 2) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let maxD = 0, maxI = -1;
    for (let i = s + 1; i < e; i++) {
      const d = segmentDistM(points[i], points[s], points[e]);
      if (d > maxD) { maxD = d; maxI = i; }
    }
    if (maxD > toleranceM && maxI !== -1) {
      keep[maxI] = true;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
};

// ---- beach lookup grid (cheap nearest-beach queries) ----
const CELL_DEG = 0.02; // ~2.2 km
const buildBeachGrid = beaches => {
  const grid = new Map();
  for (const b of beaches) {
    const key = `${Math.floor(b.lat / CELL_DEG)}:${Math.floor(b.lon / CELL_DEG)}`;
    (grid.get(key) || grid.set(key, []).get(key)).push(b);
  }
  return {
    /** nearest beach within maxM, or null. */
    nearest(lat, lon, maxM) {
      const reach = Math.ceil(maxM / (CELL_DEG * M_PER_DEG_LAT)) + 1;
      const ci = Math.floor(lat / CELL_DEG), cj = Math.floor(lon / CELL_DEG);
      let best = null, bestD = maxM;
      for (let i = ci - reach; i <= ci + reach; i++) {
        for (let j = cj - reach; j <= cj + reach; j++) {
          const cell = grid.get(`${i}:${j}`);
          if (!cell) continue;
          for (const b of cell) {
            const d = distM(lat, lon, b.lat, b.lon);
            if (d <= bestD) { bestD = d; best = b; }
          }
        }
      }
      return best ? { beach: best, d: bestD } : null;
    },
  };
};

// ---- load inputs ----
if (!fs.existsSync(LAND_GEOJSON)) {
  console.error(`Missing ${LAND_GEOJSON} — run scripts/fetchHighResLandMask.mjs first.`);
  process.exit(1);
}
console.log('Loading land polygons…');
const land = JSON.parse(fs.readFileSync(LAND_GEOJSON, 'utf8'));
const features = land.features.map(f => {
  // Precompute each feature's bbox once; used to pre-filter per region.
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    for (const [lon, lat] of poly[0]) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  }
  return { polys, minLat, maxLat, minLon, maxLon };
});
console.log(`${features.length} land features indexed.`);

const index = JSON.parse(fs.readFileSync(BEACH_INDEX, 'utf8'));
fs.mkdirSync(OUT_DIR, { recursive: true });

const round5 = x => Math.round(x * 1e5) / 1e5;
let totalBytes = 0, built = 0, skipped = 0;

for (const region of index.regions) {
  if (onlyRegions && !onlyRegions.has(region.id)) continue;
  const regionFile = path.join(ROOT, 'public', 'data', 'beaches', `${region.id}.json`);
  if (!fs.existsSync(regionFile)) { skipped++; continue; }
  const data = JSON.parse(fs.readFileSync(regionFile, 'utf8'));
  const beaches = (Array.isArray(data) ? data : data.beaches)
    .map(b => ({ id: b.id, lat: b.lat, lon: b.lon }))
    .filter(b => Number.isFinite(b.lat) && Number.isFinite(b.lon));
  if (beaches.length === 0) { skipped++; continue; }

  const grid = buildBeachGrid(beaches);
  const margin = (RIBBON_MAX_DIST_M * 1.5) / M_PER_DEG_LAT;
  const bb = beaches.reduce(
    (acc, b) => ({
      minLat: Math.min(acc.minLat, b.lat), maxLat: Math.max(acc.maxLat, b.lat),
      minLon: Math.min(acc.minLon, b.lon), maxLon: Math.max(acc.maxLon, b.lon),
    }),
    { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity },
  );
  const rMinLat = bb.minLat - margin, rMaxLat = bb.maxLat + margin;
  const rMinLon = bb.minLon - margin * 2, rMaxLon = bb.maxLon + margin * 2;

  const lines = [];
  for (const f of features) {
    if (f.maxLat < rMinLat || f.minLat > rMaxLat || f.maxLon < rMinLon || f.minLon > rMaxLon) continue;
    for (const poly of f.polys) {
      // Outer ring only (index 0): inner rings are lakes/lagoons, not swim coastline.
      const ring = poly[0];
      let chain = [];
      const flush = () => {
        if (chain.length >= 2) {
          let len = 0;
          for (let i = 1; i < chain.length; i++) len += distM(chain[i - 1][0], chain[i - 1][1], chain[i][0], chain[i][1]);
          if (len >= MIN_CHAIN_LENGTH_M) {
            const simplified = simplify(chain, SIMPLIFY_TOLERANCE_M);
            const annotated = simplified.map(([lat, lon]) => {
              const hit = grid.nearest(lat, lon, RIBBON_MAX_DIST_M * 1.25);
              return [round5(lat), round5(lon), hit ? hit.beach.id : -1, hit ? Math.round(hit.d) : -1];
            });
            lines.push(annotated);
          }
        }
        chain = [];
      };
      for (let i = 1; i < ring.length; i++) {
        const [lon1, lat1] = ring[i - 1];
        const [lon2, lat2] = ring[i];
        const midLat = (lat1 + lat2) / 2, midLon = (lon1 + lon2) / 2;
        const near = grid.nearest(midLat, midLon, RIBBON_MAX_DIST_M);
        if (near) {
          if (chain.length === 0) chain.push([lat1, lon1]);
          chain.push([lat2, lon2]);
        } else {
          flush();
        }
      }
      flush();
    }
  }

  if (lines.length === 0) { skipped++; continue; }
  const payload = { v: 1, region: region.id, generatedAt: new Date().toISOString(), lines };
  const outPath = path.join(OUT_DIR, `${region.id}.json`);
  const json = JSON.stringify(payload);
  fs.writeFileSync(outPath, json, 'utf8');
  totalBytes += json.length;
  built++;
  console.log(`${region.id}: ${lines.length} lines, ${(json.length / 1024).toFixed(1)} KB`);
}

console.log(`\nBuilt ${built} regions (${skipped} skipped), total ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
