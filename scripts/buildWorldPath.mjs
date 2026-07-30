// ─────────────────────────────────────────────────────────────────────────────
// ONE-OFF GENERATOR — world land silhouette for the private traffic console.
//
// The traffic dashboard (netlify/functions/traffic-stats.mjs) draws visitors on a
// world map. It runs inside a Netlify function and must be fully self-contained —
// no CDN, no map tiles, no runtime fetch — so the coastline ships as ONE inlined
// SVG path string in netlify/functions/lib/worldPath.mjs.
//
// Source: Natural Earth 110m land, via the public-domain `world-atlas` build:
//   https://unpkg.com/world-atlas@2/land-110m.json
//
// Re-generate (only needed if the outline ever has to change):
//   curl -sL -o /tmp/land-110m.json https://unpkg.com/world-atlas@2/land-110m.json
//   node scripts/buildWorldPath.mjs /tmp/land-110m.json
//
// Projection is plain equirectangular so the dashboard can place a visitor with two
// lines of arithmetic:  x = (lon + 180) / 360 * W ,  y = (LAT_TOP - lat) / 360 * W
// Antarctica is dropped (no visitors, and it wastes a third of the canvas).
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const W = 1000; // canvas width in SVG units; 360° of longitude
const LAT_TOP = 83; // top edge of the canvas
const LAT_BOTTOM = -56; // bottom edge (cuts Antarctica off)
const H = Math.round(((LAT_TOP - LAT_BOTTOM) / 360) * W); // keeps 2:1 equirectangular aspect

const projX = (lon) => ((lon + 180) / 360) * W;
const projY = (lat) => ((LAT_TOP - lat) / 360) * W;

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/buildWorldPath.mjs <path-to-land-110m.json>');
  process.exit(1);
}

const topo = JSON.parse(readFileSync(src, 'utf8'));
const { scale, translate } = topo.transform;

/** Decode one delta-encoded topojson arc into absolute [lon, lat] pairs. */
const decodeArc = (arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
};
const arcs = topo.arcs.map(decodeArc);

/** Stitch an arc index list (negative = that arc, reversed) into one ring. */
const ringFromArcs = (idxs) => {
  const pts = [];
  for (const i of idxs) {
    const arc = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    // The shared endpoint between consecutive arcs is duplicated — drop it.
    for (let k = pts.length ? 1 : 0; k < arc.length; k++) pts.push(arc[k]);
  }
  return pts;
};

/** Shoelace area in square degrees — used only to drop specks. */
const ringArea = (ring) => {
  let a = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
};

const MIN_AREA_DEG2 = 2.2; // drops islet noise; keeps e.g. Crete, Cyprus, Corfu
const EPS = 0.55; // point-thinning distance in SVG units (~0.2° of longitude)

/**
 * Cut a ring at the ±180° seam. Eurasia is one polygon that wraps past the
 * antimeridian (Chukotka), and projecting it whole draws a hairline stripe right
 * across the map. Splitting at the seam — with a point added on each edge so both
 * halves close along the border — is the standard fix.
 */
const splitAtAntimeridian = (ring) => {
  const crossings = [];
  for (let i = 0; i < ring.length; i++) {
    if (Math.abs(ring[(i + 1) % ring.length][0] - ring[i][0]) > 180) crossings.push(i);
  }
  if (!crossings.length) return [ring];

  // Rotate so the ring starts immediately after a seam crossing — then every piece
  // both starts and ends on an edge.
  const start = (crossings[0] + 1) % ring.length;
  const r = ring.slice(start).concat(ring.slice(0, start));

  const pieces = [];
  let cur = [];
  for (let i = 0; i < r.length; i++) {
    const a = r[i];
    const b = r[(i + 1) % r.length];
    cur.push(a);
    if (Math.abs(b[0] - a[0]) <= 180) continue;
    const sign = a[0] > 0 ? 1 : -1; // which edge we exit through
    const t = (sign * 180 - a[0]) / (b[0] + 360 * sign - a[0]);
    const lat = a[1] + t * (b[1] - a[1]);
    cur.push([sign * 180, lat]);
    pieces.push(cur);
    cur = [[-sign * 180, lat]];
  }
  if (cur.length > 2) pieces.push(cur);
  return pieces.filter((p) => p.length >= 4);
};

const parts = [];
let kept = 0;
let dropped = 0;

for (const geom of topo.objects.land.geometries) {
  const polygons = geom.type === 'Polygon' ? [geom.arcs] : geom.arcs;
  for (const poly of polygons) {
    for (const ringIdxs of poly) {
      const ring = ringFromArcs(ringIdxs);
      if (ring.length < 4) continue;

      const lats = ring.map((p) => p[1]);
      // Antarctica (and any all-southern ring) never holds a visitor.
      if (Math.max(...lats) < LAT_BOTTOM + 2) {
        dropped++;
        continue;
      }
      if (ringArea(ring) < MIN_AREA_DEG2) {
        dropped++;
        continue;
      }

      for (const piece of splitAtAntimeridian(ring)) {
        // Project, clamp to the canvas, thin out near-duplicate points.
        const out = [];
        for (const [lon, lat] of piece) {
          const x = projX(lon);
          const y = projY(Math.max(LAT_BOTTOM, Math.min(LAT_TOP, lat)));
          const last = out[out.length - 1];
          if (last && Math.abs(last[0] - x) < EPS && Math.abs(last[1] - y) < EPS) continue;
          out.push([x, y]);
        }
        if (out.length < 4) continue;

        const n = (v) => Number(v.toFixed(1));
        parts.push(
          `M${n(out[0][0])} ${n(out[0][1])}` +
            out
              .slice(1)
              .map(([x, y]) => `L${n(x)} ${n(y)}`)
              .join('') +
            'Z'
        );
        kept++;
      }
    }
  }
}

const d = parts.join('');
const outFile = resolve('netlify/functions/lib/worldPath.mjs');

writeFileSync(
  outFile,
  `// GENERATED by scripts/buildWorldPath.mjs — do not edit by hand.
// Natural Earth 110m land (public domain), equirectangular, Antarctica removed.
// Place a point with:  x = (lon + 180) / 360 * WORLD_W ,  y = (WORLD_LAT_TOP - lat) / 360 * WORLD_W
export const WORLD_W = ${W};
export const WORLD_H = ${H};
export const WORLD_LAT_TOP = ${LAT_TOP};
export const WORLD_LAT_BOTTOM = ${LAT_BOTTOM};
export const WORLD_PATH = '${d}';
`,
  'utf8'
);

console.log(
  `world path → ${outFile}\n  rings kept ${kept}, dropped ${dropped}\n  path length ${d.length} chars (${(d.length / 1024).toFixed(1)} KB)\n  viewBox 0 0 ${W} ${H}`
);
