#!/usr/bin/env node
/**
 * Builds the per-beach shoreline thumbnail geometry used wherever a beach has no photo.
 *
 * Input (both already shipped to the client):
 *   public/data/coastline/<regionId>.json          real OSM shoreline chains, vertices [lat, lon, beachId, distM]
 *   public/data/geospatial/exposure/<regionId>.json  per-beach facingDeg (shoreline normal, pointing seaward)
 *   public/data/beaches/app/summary/<regionId>.json  beach coordinates + orientation fallback
 *
 * Output:
 *   public/data/coastline/shape/<regionId>.json
 *
 * The shape is drawn in a 200x120 viewBox, rotated so the seaward direction is UP.
 * The beach sits at a fixed point (PIN_X, PIN_Y), so the component never has to know
 * anything about projections: it just fills above the line with sea and below with land.
 *
 * Usage:
 *   node scripts/buildShorelineThumbs.mjs                    all regions
 *   node scripts/buildShorelineThumbs.mjs north-aegean-samos  one region
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COASTLINE_DIR = path.join(ROOT, 'public', 'data', 'coastline');
const EXPOSURE_DIR = path.join(ROOT, 'public', 'data', 'geospatial', 'exposure');
const SUMMARY_DIR = path.join(ROOT, 'public', 'data', 'beaches', 'app', 'summary');
const OUT_DIR = path.join(COASTLINE_DIR, 'shape');
const INDEX_PATH = path.join(ROOT, 'public', 'data', 'beaches', 'index.json');

/** Drawing box. Sea is above the shoreline, land below. */
const BOX_W = 200;
const BOX_H = 120;
const PIN_X = 100;
const PIN_Y = 78;

/** How far around the beach we are willing to draw. */
const GATHER_RADIUS_M = 1600;
/**
 * Half of the drawn width, in metres. The ceiling is deliberately tight: at 1km+ the frame
 * stops being "this beach" and becomes "this stretch of municipality", which looks
 * informative and says nothing.
 */
const MIN_HALF_WIDTH_M = 180;
const MAX_HALF_WIDTH_M = 550;
/** A coastline vertex counts as this beach's own frontage only within this range of it. */
const FRONTAGE_DIST_M = 250;
/** How much coast to show either side of the frontage, so the bay reads as a bay. */
const FRONTAGE_ZOOM_OUT = 2.2;

/**
 * Refusal gates. A wrong map is worse than no map, so a beach that fails any of these
 * emits nothing and the UI keeps its neutral fallback.
 */
const MAX_PIN_TO_SHORE_M = 400; // pin further than this from any shoreline: we do not trust it
const MIN_CHAIN_SPAN_M = 260; // a stub this short says nothing about the shape of the bay
const MIN_POINTS = 4;
/**
 * The land mask is a *split* polygon, so its boundary contains artificial cut edges that are
 * not coast. They show up as a single segment with no intermediate vertex over a long
 * distance — real coast, simplified at 18m, always keeps vertices. Judged in metres, not in
 * frame fractions: a genuinely straight sandy shore should not be punished for being straight.
 */
const MAX_STRAIGHT_SEGMENT_M = 750;

/** Simplification + trimming in viewBox units. */
const SIMPLIFY_TOLERANCE = 1.1;
const MAX_POINTS = 22;
const EDGE_X = [-10, BOX_W + 10];
/** Off-frame either way, but bounded — an unclamped headland reached y = 1695. */
const CLAMP_Y = [-45, BOX_H + 45];

const DEG = Math.PI / 180;
const M_PER_DEG_LAT = 110574;

function metresPerDegLon(lat) {
  return 111320 * Math.cos(lat * DEG);
}

function haversine(aLat, aLon, bLat, bLon) {
  const dLat = (bLat - aLat) * M_PER_DEG_LAT;
  const dLon = (bLon - aLon) * metresPerDegLon((aLat + bLat) / 2);
  return Math.hypot(dLat, dLon);
}

/** Closest point on segment ab to p, in local metre space. */
function closestOnSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay, t: 0 };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: ax + t * dx, y: ay + t * dy, t };
}

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lenSq));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(points, tolerance) {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const first = points[0];
  const last = points[points.length - 1];
  for (let i = 1; i < points.length - 1; i += 1) {
    const dist = perpendicularDistance(points[i], first, last);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist <= tolerance) return [first, last];
  const left = douglasPeucker(points.slice(0, index + 1), tolerance);
  const right = douglasPeucker(points.slice(index), tolerance);
  return left.slice(0, -1).concat(right);
}

/** Drops the least significant vertices until the point budget is met. */
function capPoints(points, limit) {
  let result = points;
  let tolerance = SIMPLIFY_TOLERANCE;
  while (result.length > limit && tolerance < 40) {
    tolerance *= 1.6;
    result = douglasPeucker(points, tolerance);
  }
  return result.length > limit ? result.slice(0, limit) : result;
}

/**
 * Fingerprints the inputs a region's shapes were built from. A pin correction, a new beach,
 * or a coastline rebuild changes this, so `validateShorelineShapes.mjs` can tell that the
 * committed shapes no longer describe the committed data instead of silently drawing a
 * shoreline for where a beach used to be.
 */
export function sourceFingerprint(beaches, coastline) {
  const beachPart = beaches
    .map((beach) => `${beach.id}:${beach.coordinates?.lat?.toFixed(5)},${beach.coordinates?.lon?.toFixed(5)}`)
    .sort()
    .join('|');
  return crypto
    .createHash('sha1')
    .update(`${beachPart}#${coastline.generatedAt ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listBeaches(summary) {
  if (Array.isArray(summary?.island?.beaches)) return summary.island.beaches;
  if (Array.isArray(summary?.beaches)) return summary.beaches;
  return [];
}

/**
 * Contiguous runs of a line whose vertices sit within the gather radius of the beach.
 * Runs must stay contiguous in the source line so the drawn shoreline never jumps
 * across a bay to a different stretch of coast.
 */
function extractRuns(line, lat0, lon0) {
  const runs = [];
  let current = null;
  for (let i = 0; i < line.length; i += 1) {
    const [lat, lon, vertexBeachId, vertexDistM] = line[i];
    const within = haversine(lat0, lon0, lat, lon) <= GATHER_RADIUS_M;
    if (within) {
      if (!current) current = [];
      current.push([lat, lon, vertexBeachId, vertexDistM]);
    } else if (current) {
      // keep the first vertex outside the radius so the chain reaches past the frame
      current.push([lat, lon, vertexBeachId, vertexDistM]);
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs.filter((run) => run.length >= 2);
}

/**
 * Clips an x-monotone polyline to the drawable width, interpolating a new vertex exactly on
 * each edge. Keeping the first vertex *past* the edge instead would drag a segment in from
 * up to 3km away and skew the land fill across the whole frame.
 */
function clipToFrame(points) {
  const [minX, maxX] = EDGE_X;
  const clipped = [];
  for (let i = 0; i < points.length; i += 1) {
    const [x, y] = points[i];
    if (x < minX) {
      const next = points[i + 1];
      if (next && next[0] > minX) {
        const t = (minX - x) / (next[0] - x);
        clipped.push([minX, y + (next[1] - y) * t]);
      }
      continue;
    }
    if (x > maxX) {
      const prev = points[i - 1];
      if (prev && prev[0] < maxX) {
        const t = (maxX - prev[0]) / (x - prev[0]);
        clipped.push([maxX, prev[1] + (y - prev[1]) * t]);
      }
      break;
    }
    clipped.push([x, y]);
  }
  return clipped.map(([x, y]) => [x, Math.max(CLAMP_Y[0], Math.min(CLAMP_Y[1], y))]);
}

function chainSpanMetres(run) {
  let total = 0;
  for (let i = 1; i < run.length; i += 1) {
    total += haversine(run[i - 1][0], run[i - 1][1], run[i][0], run[i][1]);
  }
  return total;
}

function buildBeachShape(beach, coastline, facingDeg) {
  const lat0 = beach.coordinates?.lat;
  const lon0 = beach.coordinates?.lon;
  if (typeof lat0 !== 'number' || typeof lon0 !== 'number') return { skip: 'no-coordinates' };
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return { skip: 'no-facing' };

  const mPerLon = metresPerDegLon(lat0);
  const toLocal = (lat, lon) => [(lon - lon0) * mPerLon, (lat - lat0) * M_PER_DEG_LAT];

  // Pick the run whose closest approach to the beach is nearest.
  let best = null;
  for (const line of coastline.lines) {
    for (const run of extractRuns(line, lat0, lon0)) {
      const local = run.map(([lat, lon]) => toLocal(lat, lon));
      // "Frontage" = vertices the coastline build tied to THIS beach from close range.
      const frontage = run.map(
        ([, , vertexBeachId, vertexDistM]) =>
          vertexBeachId === beach.id && typeof vertexDistM === 'number' && vertexDistM <= FRONTAGE_DIST_M
      );
      let nearest = { dist: Infinity, x: 0, y: 0, index: 0 };
      for (let i = 1; i < local.length; i += 1) {
        const hit = closestOnSegment(0, 0, local[i - 1][0], local[i - 1][1], local[i][0], local[i][1]);
        const dist = Math.hypot(hit.x, hit.y);
        if (dist < nearest.dist) nearest = { dist, x: hit.x, y: hit.y, index: i };
      }
      if (nearest.dist < (best?.nearest.dist ?? Infinity)) {
        best = { local, frontage, nearest, span: chainSpanMetres(run) };
      }
    }
  }

  if (!best) return { skip: 'no-chain' };
  if (best.nearest.dist > MAX_PIN_TO_SHORE_M) return { skip: 'pin-far-from-shore' };
  if (best.span < MIN_CHAIN_SPAN_M) return { skip: 'chain-too-short' };

  // Re-origin on the shoreline point nearest the beach so the pin always sits on the line.
  const ox = best.nearest.x;
  const oy = best.nearest.y;

  // Rotate so the seaward normal points up. `along` is seaward, `cross` runs along the coast.
  const theta = facingDeg * DEG;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  const rotated = best.local.map(([east, north]) => {
    const e = east - ox;
    const n = north - oy;
    return [e * cos - n * sin, e * sin + n * cos]; // [cross, along]
  });

  // Zoom to the stretch of coast the coastline build actually assigned to THIS beach, not
  // to everything we gathered — otherwise every frame is the same 2km of municipality.
  const frontageCross = rotated.reduce(
    (acc, [cross], i) => (best.frontage[i] ? Math.max(acc, Math.abs(cross)) : acc),
    0
  );
  const halfWidthM = Math.min(
    MAX_HALF_WIDTH_M,
    Math.max(MIN_HALF_WIDTH_M, frontageCross * FRONTAGE_ZOOM_OUT)
  );
  const scale = (BOX_W / 2) / halfWidthM;

  const projected = rotated.map(([cross, along]) => [PIN_X + cross * scale, PIN_Y - along * scale]);
  // The nearest point sits on segment [index-1, index] and lands exactly on the pin.
  projected.splice(best.nearest.index, 0, [PIN_X, PIN_Y]);
  const pinIndex = best.nearest.index;

  /**
   * Trace the coast outward from the beach in both directions, keeping only vertices that
   * keep moving away along the shore. Whatever doubles back is coast hidden behind a
   * headland from where you stand — dropping it is what makes "sea above, land below" a
   * well-defined statement instead of a self-intersecting polygon.
   */
  const leftward = [];
  let leftEdge = PIN_X;
  for (let i = pinIndex - 1; i >= 0; i -= 1) {
    if (projected[i][0] < leftEdge) {
      leftward.push(projected[i]);
      leftEdge = projected[i][0];
    }
  }
  const rightward = [];
  let rightEdge = PIN_X;
  for (let i = pinIndex + 1; i < projected.length; i += 1) {
    if (projected[i][0] > rightEdge) {
      rightward.push(projected[i]);
      rightEdge = projected[i][0];
    }
  }

  let points = [...leftward.reverse(), [PIN_X, PIN_Y], ...rightward];

  points = clipToFrame(points);
  if (points.length < MIN_POINTS) return { skip: 'too-few-points' };

  // Simplify each side of the beach separately so the pin always survives as a vertex.
  const pinAt = points.findIndex(([x, y]) => x === PIN_X && y === PIN_Y);
  if (pinAt <= 0 || pinAt >= points.length - 1) return { skip: 'pin-at-edge' };
  const half = Math.floor(MAX_POINTS / 2);
  points = [
    ...capPoints(douglasPeucker(points.slice(0, pinAt + 1), SIMPLIFY_TOLERANCE), half).slice(0, -1),
    ...capPoints(douglasPeucker(points.slice(pinAt), SIMPLIFY_TOLERANCE), half),
  ];
  if (points.length < 3) return { skip: 'too-few-points' };

  if (points[0][0] > EDGE_X[0]) points.unshift([EDGE_X[0], points[0][1]]);
  if (points[points.length - 1][0] < EDGE_X[1]) {
    points.push([EDGE_X[1], points[points.length - 1][1]]);
  }

  // Ignore the two synthetic edge points: they are ours, not the coastline's.
  const interior = points.slice(1, -1);
  const longestSegmentUnits = interior.reduce(
    (acc, point, i) => (i === 0 ? acc : Math.max(acc, Math.hypot(point[0] - interior[i - 1][0], point[1] - interior[i - 1][1]))),
    0
  );
  if (longestSegmentUnits / scale > MAX_STRAIGHT_SEGMENT_M) return { skip: 'straight-cut-edge' };

  const round = (n) => Math.round(n * 10) / 10;
  const serialized = points.map(([x, y]) => `${round(x)},${round(y)}`).join(' ');

  return {
    shape: {
      s: serialized,
      f: Math.round(facingDeg),
      d: Math.round(best.nearest.dist),
      // Metres across the full frame — lets the UI draw an honest scale bar.
      w: Math.round(halfWidthM * 2),
    },
  };
}

function buildRegion(regionId) {
  const coastlinePath = path.join(COASTLINE_DIR, `${regionId}.json`);
  const summaryPath = path.join(SUMMARY_DIR, `${regionId}.json`);
  if (!fs.existsSync(coastlinePath) || !fs.existsSync(summaryPath)) {
    return { regionId, skipped: 'missing-input' };
  }

  const coastline = readJson(coastlinePath);
  const summary = readJson(summaryPath);
  const exposurePath = path.join(EXPOSURE_DIR, `${regionId}.json`);
  const exposure = fs.existsSync(exposurePath) ? readJson(exposurePath) : { profiles: {} };

  const beaches = listBeaches(summary);
  const shapes = {};
  const skips = {};

  for (const beach of beaches) {
    const profile = exposure.profiles?.[String(beach.id)];
    const facingDeg = typeof profile?.facingDeg === 'number'
      ? profile.facingDeg
      : beach.orientation?.degrees;
    const result = buildBeachShape(beach, coastline, facingDeg);
    if (result.shape) {
      shapes[String(beach.id)] = result.shape;
    } else {
      skips[result.skip] = (skips[result.skip] ?? 0) + 1;
    }
  }

  const payload = {
    v: 1,
    region: regionId,
    generatedAt: new Date().toISOString(),
    srcHash: sourceFingerprint(beaches, coastline),
    box: [BOX_W, BOX_H],
    pin: [PIN_X, PIN_Y],
    beaches: shapes,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${regionId}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(payload)}\n`, 'utf8');

  return {
    regionId,
    total: beaches.length,
    drawn: Object.keys(shapes).length,
    skips,
    bytes: fs.statSync(outPath).size,
  };
}

/**
 * A beach knows its coordinates but not its region, and several surfaces show beaches from
 * more than one region at once ("Κοντά μου", saved beaches) or from none in particular (the
 * map hover). Without this index those surfaces can never find their geometry, so the
 * drawing silently never appears — which is exactly what happened before it existed.
 */
function writeRegionIndex() {
  const regions = {};
  for (const file of fs.readdirSync(OUT_DIR)) {
    if (!file.endsWith('.json') || file === 'index.json') continue;
    const payload = readJson(path.join(OUT_DIR, file));
    if (!payload?.region || !payload.beaches) continue;
    regions[payload.region] = Object.keys(payload.beaches)
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
  }

  const indexPath = path.join(OUT_DIR, 'index.json');
  fs.writeFileSync(indexPath, `${JSON.stringify({ v: 1, regions })}
`, 'utf8');
  const beachCount = Object.values(regions).reduce((total, ids) => total + ids.length, 0);
  console.log(
    `- index.json: ${beachCount} beaches across ${Object.keys(regions).length} regions ` +
      `(${(fs.statSync(indexPath).size / 1024).toFixed(1)}KB)`
  );
}

export { buildRegion };

function main() {
  const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
  const index = readJson(INDEX_PATH);
  const regionIds = args.length > 0 ? args : index.regions.map((region) => region.id);

  let total = 0;
  let drawn = 0;
  let bytes = 0;
  const allSkips = {};

  for (const regionId of regionIds) {
    const result = buildRegion(regionId);
    if (result.skipped) {
      console.log(`- ${regionId}: skipped (${result.skipped})`);
      continue;
    }
    total += result.total;
    drawn += result.drawn;
    bytes += result.bytes;
    for (const [reason, count] of Object.entries(result.skips)) {
      allSkips[reason] = (allSkips[reason] ?? 0) + count;
    }
    const pct = ((result.drawn / result.total) * 100).toFixed(1);
    const skipText = Object.entries(result.skips).map(([k, v]) => `${k}=${v}`).join(' ') || 'none';
    console.log(`- ${regionId}: ${result.drawn}/${result.total} (${pct}%) ${(result.bytes / 1024).toFixed(1)}KB  skips: ${skipText}`);
  }

  // Always rebuilt from what is on disk, so a single-region run cannot truncate it.
  writeRegionIndex();

  if (regionIds.length > 1) {
    console.log(`\nTotal: ${drawn}/${total} (${((drawn / total) * 100).toFixed(1)}%), ${(bytes / 1024).toFixed(1)}KB`);
    console.log(`Skips: ${JSON.stringify(allSkips)}`);
  }
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  main();
}
