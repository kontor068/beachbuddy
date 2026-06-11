/**
 * National pin-distance sanity check (playbook tooling): every beach pin in
 * every region vs the high-res OSM coastline, with severity classification.
 *
 * Signals per pin:
 *  - on land / in water, distance to the waterline
 *  - water-pocket width when the pin is in water
 *  - builder origin-search displacement
 *  - dFacing: authored override facing vs the stored geometry facing
 *    (Kolona anti-pattern: gross disagreement + narrow pocket = the pin is
 *    probably on the wrong side / wrong cove / name collision)
 *
 * Severity:
 *  CRITICAL  no water within 2 km, or pin >500 m inland (wrong island/sea?)
 *  HIGH      pin >150 m inland, origin jump >=0.3 km, or Kolona signature
 *            (dFacing >90 with a <100 m pocket)
 *  MEDIUM    dFacing >90 alone (suspect facing provenance)
 *  LOW       narrow pocket (<100 m) alone — verify the seaward side once
 *  KNOWN     already flagged suspectPin in the overrides (validation hits)
 *
 * Run via wrapper: node scripts/auditNationalPins.mjs [--json <out>]
 * Requires .tmp/geospatial/greece-land-osm-split.geojson (fetchHighResLandMask.mjs).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { resolveBeachWindProfile } from '../utils/windExposureEngine';
import type { Beach, GeospatialExposureProfile } from '../types';

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const jsonOutPath = parseArgValue('--json') || '.tmp/geospatial/national-pin-audit.json';

// ---- Grid-indexed land mask (same approach as the exposure builder) ----
type FlatRing = Float64Array;
type IndexedPolygon = { outer: FlatRing; holes: FlatRing[]; bbox: { minLat: number; maxLat: number; minLon: number; maxLon: number } };

const bounds = { minLat: 33, maxLat: 43, minLon: 18, maxLon: 31 };
const CELL = 0.05;

const flatten = (ring: number[][]): FlatRing => {
  const flat = new Float64Array(ring.length * 2);
  for (let i = 0; i < ring.length; i += 1) { flat[i * 2] = ring[i][0]; flat[i * 2 + 1] = ring[i][1]; }
  return flat;
};
const ringBbox = (ring: FlatRing) => {
  const bbox = { minLat: Infinity, maxLat: -Infinity, minLon: Infinity, maxLon: -Infinity };
  for (let i = 0; i < ring.length; i += 2) {
    const lon = ring[i]; const lat = ring[i + 1];
    if (lat < bbox.minLat) bbox.minLat = lat;
    if (lat > bbox.maxLat) bbox.maxLat = lat;
    if (lon < bbox.minLon) bbox.minLon = lon;
    if (lon > bbox.maxLon) bbox.maxLon = lon;
  }
  return bbox;
};
const pointInRing = (x: number, y: number, ring: FlatRing): boolean => {
  let inside = false;
  const count = ring.length / 2;
  for (let i = 0, j = count - 1; i < count; j = i++) {
    const xi = ring[i * 2]; const yi = ring[i * 2 + 1];
    const xj = ring[j * 2]; const yj = ring[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi)) inside = !inside;
  }
  return inside;
};

const geojson = JSON.parse(readFileSync('.tmp/geospatial/greece-land-osm-split.geojson', 'utf8'));
const polygons: IndexedPolygon[] = [];
for (const feature of geojson.features) {
  const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const rings of polys) {
    const outer = flatten(rings[0]);
    polygons.push({ outer, holes: rings.slice(1).map(flatten), bbox: ringBbox(outer) });
  }
}
const cols = Math.ceil((bounds.maxLon - bounds.minLon) / CELL);
const gridRows = Math.ceil((bounds.maxLat - bounds.minLat) / CELL);
const cells = new Map<number, number[]>();
polygons.forEach((polygon, index) => {
  const minCol = Math.max(0, Math.floor((polygon.bbox.minLon - bounds.minLon) / CELL));
  const maxCol = Math.min(cols - 1, Math.floor((polygon.bbox.maxLon - bounds.minLon) / CELL));
  const minRow = Math.max(0, Math.floor((polygon.bbox.minLat - bounds.minLat) / CELL));
  const maxRow = Math.min(gridRows - 1, Math.floor((polygon.bbox.maxLat - bounds.minLat) / CELL));
  for (let row = minRow; row <= maxRow; row += 1) {
    for (let col = minCol; col <= maxCol; col += 1) {
      const key = row * cols + col;
      const bucket = cells.get(key);
      if (bucket) bucket.push(index); else cells.set(key, [index]);
    }
  }
});
const isLand = (lat: number, lon: number): boolean => {
  const col = Math.floor((lon - bounds.minLon) / CELL);
  const row = Math.floor((lat - bounds.minLat) / CELL);
  if (col < 0 || col >= cols || row < 0 || row >= gridRows) return false;
  const candidates = cells.get(row * cols + col);
  if (!candidates) return false;
  for (const index of candidates) {
    const polygon = polygons[index];
    if (lat < polygon.bbox.minLat || lat > polygon.bbox.maxLat || lon < polygon.bbox.minLon || lon > polygon.bbox.maxLon) continue;
    if (!pointInRing(lon, lat, polygon.outer)) continue;
    if (!polygon.holes.some(hole => pointInRing(lon, lat, hole))) return true;
  }
  return false;
};

const EARTH_R = 6371;
const dest = (lat: number, lon: number, bearingDeg: number, km: number): [number, number] => {
  const br = bearingDeg * Math.PI / 180; const d = km / EARTH_R;
  const la1 = lat * Math.PI / 180; const lo1 = lon * Math.PI / 180;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(d) + Math.cos(la1) * Math.sin(d) * Math.cos(br));
  const lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(d) * Math.cos(la1), Math.cos(d) - Math.sin(la1) * Math.sin(la2));
  return [la2 * 180 / Math.PI, lo2 * 180 / Math.PI];
};
const distToOtherState = (lat: number, lon: number, startState: boolean, maxKm: number, stepKm: number) => {
  let best: number | null = null; let bestBearing: number | null = null;
  for (let bearing = 0; bearing < 360; bearing += 15) {
    for (let km = stepKm; km <= maxKm; km += stepKm) {
      if (best !== null && km >= best) break;
      const [la, lo] = dest(lat, lon, bearing, km);
      if (isLand(la, lo) !== startState) { best = km; bestBearing = bearing; break; }
    }
  }
  return { km: best, bearing: bestBearing };
};
const openAlong = (lat: number, lon: number, bearing: number, maxKm: number, stepKm: number): number => {
  let open = 0;
  for (let km = stepKm; km <= maxKm; km += stepKm) {
    const [la, lo] = dest(lat, lon, bearing, km);
    if (isLand(la, lo)) break;
    open = km;
  }
  return open;
};
const angularDelta = (a: number, b: number): number => {
  const diff = Math.abs(((a - b) % 360 + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
};

// ---- Sweep all regions ----
const appDir = path.join('public', 'data', 'beaches', 'app');
const expDir = path.join('public', 'data', 'geospatial', 'exposure');
type Row = {
  regionId: string; id: number; name?: string; lat: number; lon: number;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'KNOWN';
  signals: string[];
  onLand: boolean; distToCoastM: number | null; pocketM: number | null;
  originJumpKm: number; authoredFacing: number | null; geoFacing: number | null; dFacing: number | null;
};
const rows: Row[] = [];
let scanned = 0;

for (const fileName of readdirSync(appDir).filter(name => name.endsWith('.json'))) {
  const regionId = fileName.replace(/\.json$/, '');
  const payload = JSON.parse(readFileSync(path.join(appDir, fileName), 'utf8'));
  const beaches = (payload.island?.beaches || []) as unknown as Beach[];
  let profiles: Record<string, GeospatialExposureProfile> = {};
  try { profiles = JSON.parse(readFileSync(path.join(expDir, fileName), 'utf8')).profiles || {}; } catch { /* no exposure data */ }

  for (const beach of beaches) {
    const coordinates = beach.coordinates as { lat?: number; lon?: number } | undefined;
    if (typeof coordinates?.lat !== 'number' || typeof coordinates?.lon !== 'number') continue;
    scanned += 1;
    const { lat, lon } = coordinates as { lat: number; lon: number };

    const onLand = isLand(lat, lon);
    const coast = distToOtherState(lat, lon, onLand, 2, 0.02);
    const distToCoastM = coast.km !== null ? Math.round(coast.km * 1000) : null;

    let pocketM: number | null = null;
    if (!onLand) {
      let minWidth = Infinity;
      for (let bearing = 0; bearing < 180; bearing += 30) {
        minWidth = Math.min(minWidth, openAlong(lat, lon, bearing, 1, 0.02) + openAlong(lat, lon, bearing + 180, 1, 0.02));
      }
      pocketM = Math.round(minWidth * 1000);
    }

    // Builder origin displacement (coarse replica: water + not immediately enclosed)
    let originJumpKm = 0;
    if (onLand) {
      originJumpKm = 12;
      outer:
      for (let km = 0.1; km <= 2; km += 0.1) {
        for (let bearing = 0; bearing < 360; bearing += 15) {
          const [la, lo] = dest(lat, lon, bearing, km);
          if (!isLand(la, lo)) { originJumpKm = km; break outer; }
        }
      }
      originJumpKm = Number(originJumpKm.toFixed(1));
    }

    const profile = profiles[String(beach.id)];
    const geoFacing = typeof profile?.facingDeg === 'number' ? profile.facingDeg : null;
    const resolved = resolveBeachWindProfile(beach);
    const authoredFacing = resolved.source !== 'unknown' && typeof resolved.profile.beachFacingDirection === 'number'
      ? resolved.profile.beachFacingDirection
      : null;
    const dFacing = authoredFacing !== null && geoFacing !== null ? Math.round(angularDelta(authoredFacing, geoFacing)) : null;

    const signals: string[] = [];
    if (onLand && distToCoastM === null) signals.push('NO_WATER_2KM');
    if (onLand && distToCoastM !== null && distToCoastM > 500) signals.push('FAR_INLAND_500M');
    else if (onLand && distToCoastM !== null && distToCoastM > 150) signals.push('FAR_FROM_COAST');
    if (originJumpKm >= 0.3) signals.push('ORIGIN_JUMP');
    if (pocketM !== null && pocketM < 100) signals.push('NARROW_POCKET');
    if (dFacing !== null && dFacing > 90) signals.push('DFACING_GT90');

    if (signals.length === 0) continue;

    let severity: Row['severity'];
    if (resolved.profile.suspectPin) severity = 'KNOWN';
    else if (signals.includes('NO_WATER_2KM') || signals.includes('FAR_INLAND_500M')) severity = 'CRITICAL';
    else if (signals.includes('FAR_FROM_COAST') || signals.includes('ORIGIN_JUMP') || (signals.includes('DFACING_GT90') && signals.includes('NARROW_POCKET'))) severity = 'HIGH';
    else if (signals.includes('DFACING_GT90')) severity = 'MEDIUM';
    else severity = 'LOW';

    rows.push({
      regionId, id: beach.id, name: (beach.name as { en?: string })?.en, lat, lon,
      severity, signals, onLand, distToCoastM, pocketM, originJumpKm, authoredFacing, geoFacing, dFacing,
    });
  }
}

const order: Record<Row['severity'], number> = { CRITICAL: 0, HIGH: 1, KNOWN: 2, MEDIUM: 3, LOW: 4 };
rows.sort((a, b) => order[a.severity] - order[b.severity] || a.regionId.localeCompare(b.regionId));
writeFileSync(jsonOutPath, JSON.stringify(rows, null, 1), 'utf8');

const counts = rows.reduce<Record<string, number>>((acc, row) => { acc[row.severity] = (acc[row.severity] || 0) + 1; return acc; }, {});
console.log(`Scanned ${scanned} pins. Flagged: ${rows.length} (${Object.entries(counts).map(([k, v]) => `${k}:${v}`).join(' ')})`);
for (const row of rows.filter(r => r.severity === 'CRITICAL' || r.severity === 'HIGH' || r.severity === 'KNOWN')) {
  console.log(`${row.severity} [${row.regionId}] #${row.id} ${row.name}: ${row.signals.join(',')} dist=${row.distToCoastM}m pocket=${row.pocketM ?? '-'}m jump=${row.originJumpKm}km dFacing=${row.dFacing ?? '-'} (${row.lat},${row.lon})`);
}
const mediumByRegion = new Map<string, number>();
rows.filter(r => r.severity === 'MEDIUM' || r.severity === 'LOW').forEach(r => mediumByRegion.set(r.regionId, (mediumByRegion.get(r.regionId) || 0) + 1));
console.log(`MEDIUM/LOW by region: ${[...mediumByRegion.entries()].sort((a, b) => b[1] - a[1]).map(([region, count]) => `${region}:${count}`).join(' ')}`);
console.log(`Full list: ${jsonOutPath}`);
