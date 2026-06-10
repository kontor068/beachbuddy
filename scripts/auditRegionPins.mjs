/**
 * Region pin audit against the high-res OSM coastline (playbook step 1).
 *
 * For every beach pin in a region: is it on land or water, how far is the
 * coastline, how wide is the water pocket it sits in, where does the builder's
 * origin search land, what facing does the shoreline geometry produce, and is
 * the local normal degenerate (tombolo). Flags:
 *   FAR_FROM_COAST  pin on land >150 m from the waterline
 *   NARROW_POCKET   pin in a water pocket <100 m wide (verify seaward side!)
 *   ORIGIN_JUMP     origin search displaced the sample >=0.3 km
 *   WEAK_NORMAL     orientation magnitude <0.15 (tombolo / degenerate)
 *
 * Usage:
 *   node scripts/auditRegionPins.mjs --region south-aegean-milos [--mask <geojson>] [--json <out>]
 * Requires the Greece land GeoJSON from scripts/fetchHighResLandMask.mjs.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const parseArgValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const regionId = parseArgValue('--region');
if (!regionId) {
  console.error('Usage: node scripts/auditRegionPins.mjs --region <regionId> [--mask <geojson>] [--json <out>]');
  process.exit(1);
}
const maskPath = parseArgValue('--mask') || '.tmp/geospatial/greece-land-osm-split.geojson';
const jsonOutPath = parseArgValue('--json');

const geojson = JSON.parse(readFileSync(maskPath, 'utf8'));
const polygons = [];
for (const feature of geojson.features) {
  const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const rings of polys) {
    const outer = rings[0];
    let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
    for (const [lon, lat] of outer) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
    polygons.push({ rings, bbox: { minLat, maxLat, minLon, maxLon } });
  }
}

const pointInRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi)) inside = !inside;
  }
  return inside;
};
const isLand = (lat, lon) => polygons.some(p => {
  if (lat < p.bbox.minLat || lat > p.bbox.maxLat || lon < p.bbox.minLon || lon > p.bbox.maxLon) return false;
  if (!pointInRing(lon, lat, p.rings[0])) return false;
  return !p.rings.slice(1).some(hole => pointInRing(lon, lat, hole));
});

const EARTH_R = 6371;
const dest = (lat, lon, bearingDeg, km) => {
  const br = bearingDeg * Math.PI / 180, d = km / EARTH_R;
  const la1 = lat * Math.PI / 180, lo1 = lon * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI];
};
const distToOther = (lat, lon, startState, maxKm, step) => {
  let best = null, bestB = null;
  for (let b = 0; b < 360; b += 15) {
    for (let kk = step; kk <= maxKm; kk += step) {
      const [l2, o2] = dest(lat, lon, b, kk);
      if (isLand(l2, o2) !== startState) { if (best === null || kk < best) { best = kk; bestB = b; } break; }
    }
  }
  return { km: best, bearing: bestB };
};
const openAlong = (lat, lon, b, maxKm, step) => {
  let open = 0;
  for (let kk = step; kk <= maxKm; kk += step) {
    const [l2, o2] = dest(lat, lon, b, kk);
    if (isLand(l2, o2)) break;
    open = kk;
  }
  return open;
};
const hasPassage = (lat, lon) => {
  for (let bb = 0; bb < 360; bb += 30) {
    let open = 0;
    for (let kk = 0.05; kk <= 0.5; kk += 0.05) {
      const [l2, o2] = dest(lat, lon, bb, kk);
      if (isLand(l2, o2)) break;
      open = kk;
    }
    if (open >= 0.475) return true;
  }
  return false;
};
const resolveOrigin = (lat, lon) => {
  const qualifies = (la, lo) => !isLand(la, lo) && hasPassage(la, lo);
  if (qualifies(lat, lon)) return { lat, lon, adjKm: 0, bearing: null };
  for (let km = 0.1; km <= 12; km += 0.1) {
    for (let b = 0; b < 360; b += 15) {
      const [la, lo] = dest(lat, lon, b, km);
      if (qualifies(la, lo)) return { lat: la, lon: lo, adjKm: Number(km.toFixed(1)), bearing: b };
    }
  }
  return { lat, lon, adjKm: 0, bearing: null };
};
const orientation = (lat, lon) => {
  let sx = 0, sy = 0, tw = 0;
  const open30 = [];
  for (let b = 0; b < 360; b += 10) {
    const d = openAlong(lat, lon, b, 3, 0.1);
    const o = d === 3 ? 3 : Math.max(0, d - 0.1);
    const rad = b * Math.PI / 180;
    sx += o * Math.sin(rad); sy += o * Math.cos(rad); tw += o;
  }
  for (let b = 0; b < 360; b += 30) {
    const d = openAlong(lat, lon, b, 3, 0.1);
    open30.push(Number((d === 3 ? 3 : Math.max(0, d - 0.1)).toFixed(1)));
  }
  const mag = Math.sqrt(sx * sx + sy * sy);
  const facing = tw > 0 ? Number(((Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360).toFixed(1)) : null;
  return { facing, magRatio: Number((tw > 0 ? mag / tw : 0).toFixed(3)), open30 };
};

const regionPayload = JSON.parse(readFileSync(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`), 'utf8'));
const beaches = regionPayload.island?.beaches || [];
const results = [];

for (const beach of beaches) {
  const { lat, lon } = beach.coordinates || {};
  if (typeof lat !== 'number') continue;
  const onLand = isLand(lat, lon);
  const coast = distToOther(lat, lon, onLand, 2, 0.02);
  let pocketM = null;
  if (!onLand) {
    let minW = Infinity;
    for (let b = 0; b < 180; b += 15) {
      minW = Math.min(minW, openAlong(lat, lon, b, 2, 0.02) + openAlong(lat, lon, b + 180, 2, 0.02));
    }
    pocketM = Math.round(minW * 1000);
  }
  const origin = resolveOrigin(lat, lon);
  const ori = orientation(origin.lat, origin.lon);
  const flags = [];
  if (onLand && coast.km !== null && coast.km * 1000 > 150) flags.push('FAR_FROM_COAST');
  if (!onLand && pocketM !== null && pocketM < 100) flags.push('NARROW_POCKET');
  if (origin.adjKm >= 0.3) flags.push('ORIGIN_JUMP');
  if (ori.magRatio < 0.15) flags.push('WEAK_NORMAL');

  results.push({
    id: beach.id, name: beach.name?.en, lat, lon, onLand,
    distToCoastM: coast.km !== null ? Math.round(coast.km * 1000) : null,
    coastBearing: coast.bearing, pocketM,
    originAdjKm: origin.adjKm, originBearing: origin.bearing,
    recomputedFacing: ori.facing, magRatio: ori.magRatio, open30: ori.open30,
    flags,
  });
  console.log(`#${beach.id} ${beach.name?.en}: land=${onLand} dist=${coast.km !== null ? Math.round(coast.km * 1000) : '?'}m pocket=${pocketM ?? '-'}m orgAdj=${origin.adjKm}km facing=${ori.facing} mag=${ori.magRatio} ${flags.join(' ')}`);
}

const flagged = results.filter(r => r.flags.length > 0);
console.log(`\n${regionId}: ${results.length} beaches, ${flagged.length} flagged`);
if (jsonOutPath) {
  writeFileSync(jsonOutPath, JSON.stringify(results, null, 1), 'utf8');
  console.log(`Written to ${jsonOutPath}`);
}
