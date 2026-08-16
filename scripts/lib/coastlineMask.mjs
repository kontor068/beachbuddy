/**
 * Η ΑΚΤΟΓΡΑΜΜΗ, ΜΙΑ ΦΟΡΑ — the split-OSM land mask the exposure build uses, loadable from any
 * offline audit.
 *
 * Extracted from scripts/auditEnclosedWater.mjs on 16/08/2026, unchanged line for line, when a
 * second audit (scripts/auditCoveOriginBlindSpot.mjs) needed the same mask. The repo has been
 * burned by exactly this before — scripts/validateEffectiveRanking.ts:16-18 records a gate that
 * passed green on deliberately sabotaged code because it had re-implemented what it was checking.
 * Two audits disagreeing about where the coast is would be the same failure in a new costume, so
 * there is ONE loader and both import it.
 *
 * Offline only. The mask is ~35 MB of GeoJSON; nothing on a page load may touch this.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const rad = x => (x * Math.PI) / 180;
export const KM_PER_DEG_LAT = 110.574;
export const kmPerDegLon = lat => 111.32 * Math.cos(rad(lat));

/** The high-resolution coastline written by scripts/fetchHighResLandMask.mjs. */
export const MASK_PATH = path.join(root, '.tmp/geospatial/greece-land-osm-split.geojson');

const GRID_DEG = 0.05;

export const loadMask = () => {
  const fc = JSON.parse(readFileSync(MASK_PATH, 'utf8'));
  const polys = [];
  for (const f of fc.features) {
    if (f.geometry?.type !== 'Polygon') continue;
    const ring = f.geometry.coordinates[0];
    if (!ring || ring.length < 4) continue;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    polys.push({ ring, holes: f.geometry.coordinates.slice(1), minLon, maxLon, minLat, maxLat });
  }
  const buckets = new Map();
  polys.forEach((p, i) => {
    for (let r = Math.floor(p.minLat / GRID_DEG); r <= Math.floor(p.maxLat / GRID_DEG); r++) {
      for (let c = Math.floor(p.minLon / GRID_DEG); c <= Math.floor(p.maxLon / GRID_DEG); c++) {
        const k = `${r}:${c}`;
        const b = buckets.get(k);
        if (b) b.push(i); else buckets.set(k, [i]);
      }
    }
  });
  return { polys, buckets };
};

export const inRing = (lon, lat, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const makeIsLand = mask => (lon, lat) => {
  const cands = mask.buckets.get(`${Math.floor(lat / GRID_DEG)}:${Math.floor(lon / GRID_DEG)}`);
  if (!cands) return false;
  for (const i of cands) {
    const p = mask.polys[i];
    if (lon < p.minLon || lon > p.maxLon || lat < p.minLat || lat > p.maxLat) continue;
    if (!inRing(lon, lat, p.ring)) continue;
    if (p.holes.some(h => inRing(lon, lat, h))) continue;
    return true;
  }
  return false;
};

/** Move `km` from a point along a compass bearing. Same flat-earth step the ray casters use. */
export const destination = (lat, lon, bearingDeg, km) => {
  const b = rad(bearingDeg);
  return {
    lat: lat + (km * Math.cos(b)) / KM_PER_DEG_LAT,
    lon: lon + (km * Math.sin(b)) / kmPerDegLon(lat),
  };
};
