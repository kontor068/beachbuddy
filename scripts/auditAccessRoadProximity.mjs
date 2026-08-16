// Access-vs-road-network audit (region-agnostic, report-only).
//
// Cross-checks beaches that CLAIM easy road access (metadata.access.type === 'asphalt_road',
// rendered to users as "Εύκολη πρόσβαση") against the real OSM road network. A genuine
// asphalt-access beach should have a paved, drivable road close to its pin. When the nearest
// paved road is far (or absent) and only unpaved tracks / foot paths approach, the easy-access
// claim is SUSPECT — exactly the Φυρλίνγκος (Firligos) class of unverified batch defaults.
//
// This never writes to the dataset. It produces a review report; corrections stay a human call
// (OSM coverage on small islands is incomplete, so absence of a mapped road is a signal, not proof).
//
// Usage:
//   node scripts/auditAccessRoadProximity.mjs [--region milos] [--types asphalt_road]
//        [--radius 300] [--paved-threshold 120] [--limit N] [--offset N]
//        [--refresh] [--out <path>]
//   --region        substring match on the derived region id (e.g. "milos", "south-aegean")
//   --types         comma list of access.type values to check (default: asphalt_road)
//   --radius        Overpass search radius in metres (default 300)
//   --paved-threshold  max metres a paved road may be from the pin before it's SUSPECT (default 120)
//   --refresh       ignore the on-disk OSM cache and re-query everything
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const outDir = path.join(rootDir, 'reports', 'access-road-proximity');
const cachePath = path.join(outDir, 'osm-cache.json');

const args = process.argv.slice(2);
const getArg = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const regionFilter = (getArg('--region', '') || '').toLowerCase();
const types = new Set((getArg('--types', 'asphalt_road')).split(',').map(s => s.trim()).filter(Boolean));
const radius = Number(getArg('--radius', '300'));
const pavedThreshold = Number(getArg('--paved-threshold', '120'));
const limit = getArg('--limit') ? Number(getArg('--limit')) : Infinity;
const offset = Number(getArg('--offset', '0'));
const refresh = args.includes('--refresh');
// A scoped run must never share a filename with a wider one. Before this, `--region X` wrote the
// same `report-<date>.json` as a national sweep, so the next region silently replaced the last —
// the same class of loss as the auditPlaceResolution partial-file trap (14/08/2026). Region-scoped
// runs now default to their own `region-<id>-<date>.json`; `--out` still overrides either way.
const stamp = new Date().toISOString().slice(0, 10);
const defaultOut = regionFilter
  ? path.join(outDir, `region-${regionFilter}-${stamp}.json`)
  : path.join(outDir, `report-${stamp}.json`);
const outPath = getArg('--out', defaultOut);

// --- region attribution: mirrors scripts/buildBeachRegionData.mjs exactly -------------------
const getBeachRegionId = (region, prefecture) => {
  const base = `${region || 'Unknown'}-${prefecture || region || 'Unknown'}`;
  return base.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'unknown';
};
const flatten = (data) => {
  const out = [];
  const walk = (node, region, pathParts) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const lat = Number(item?.lat), lon = Number(item?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
          id: item.id, name: item.name, lat, lon, metadata: item.metadata,
          region, prefecture: pathParts[pathParts.length - 1] || region || 'Unknown',
        });
      }
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) walk(v, region, [...pathParts, k]);
  };
  for (const [region, node] of Object.entries(data)) walk(node, region, []);
  return out;
};

// --- OSM classification ----------------------------------------------------------------------
const DRIVABLE = new Set(['motorway','trunk','primary','secondary','tertiary','unclassified','residential','living_street','service','road','motorway_link','trunk_link','primary_link','secondary_link','tertiary_link']);
const FOOT = new Set(['path','footway','steps','pedestrian','bridleway','cycleway','corridor']);
const UNPAVED = new Set(['unpaved','ground','dirt','gravel','fine_gravel','compacted','sand','earth','grass','mud','pebblestone','rock']);
const PAVED = new Set(['asphalt','paved','concrete','paving_stones','sett','cobblestone','chipseal','concrete:plates']);
const classify = (tags) => {
  const h = tags?.highway, s = tags?.surface;
  if (FOOT.has(h)) return 'foot';
  if (h === 'track') return 'track';
  if (DRIVABLE.has(h)) {
    if (s && PAVED.has(s)) return 'paved';
    if (s && UNPAVED.has(s)) return 'track';
    if (h === 'service') return 'service';       // unknown surface: don't credit as paved access
    return 'paved';                              // residential/unclassified/tertiary+ default paved
  }
  return 'other';
};

const R = 6371000, T = Math.PI / 180;
const haversine = (la1, lo1, la2, lo2) => {
  const dLa = (la2 - la1) * T, dLo = (lo2 - lo1) * T;
  const a = Math.sin(dLa/2)**2 + Math.cos(la1*T)*Math.cos(la2*T)*Math.sin(dLo/2)**2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const queryOverpass = async (lat, lon) => {
  const q = `[out:json][timeout:25];way(around:${radius},${lat},${lon})[highway];out tags center;`;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'calmbeach-access-audit/1.0 (data-quality)', 'Accept': 'application/json' } });
      if (res.status === 429 || res.status === 504) { await sleep(3000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      const els = (await res.json()).elements || [];
      let paved = Infinity, track = Infinity, foot = Infinity;
      for (const w of els) {
        if (!w.center) continue;
        const d = haversine(lat, lon, w.center.lat, w.center.lon);
        const c = classify(w.tags);
        if (c === 'paved') paved = Math.min(paved, d);
        else if (c === 'track') track = Math.min(track, d);
        else if (c === 'foot') foot = Math.min(foot, d);
      }
      return { paved, track, foot, radius };
    } catch (e) {
      if (attempt === 4) throw e;
      await sleep(2000 * (attempt + 1));
    }
  }
  // Every attempt was rate-limited (429/504) and took the `continue` path, so the loop fell
  // through without returning. Before this, that returned `undefined`, the caller cached it and
  // died on `osm.paved` with a TypeError that looked like a data bug — after spending the whole
  // run's Overpass budget. Same class as the auditAmenitiesOsm ENOENT trap (14/08/2026).
  throw new Error(`overpass rate-limited 5/5 attempts at ${lat},${lon} — rerun later (cache keeps finished beaches)`);
};

// --- run -------------------------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const cache = !refresh && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
const data = JSON.parse(readFileSync(sourcePath, 'utf8'));

let candidates = flatten(data)
  .map(b => ({ ...b, regionId: getBeachRegionId(b.region, b.prefecture) }))
  .filter(b => types.has(b.metadata?.access?.type))
  .filter(b => !regionFilter || b.regionId.includes(regionFilter))
  .sort((a, b) => a.id - b.id);

const totalCandidates = candidates.length;
candidates = candidates.slice(offset, offset + limit);
console.log(`access.type in {${[...types].join(',')}}${regionFilter ? `, region~"${regionFilter}"` : ''}: ${totalCandidates} candidates; checking ${candidates.length} (offset ${offset}).`);

const rows = [];
let done = 0;
for (const b of candidates) {
  let osm = cache[b.id];
  if (!osm || osm.radius !== radius) {
    osm = await queryOverpass(b.lat, b.lon);
    cache[b.id] = osm;
    writeFileSync(cachePath, JSON.stringify(cache), 'utf8');
    await sleep(1100);
  }
  const suspect = osm.paved > pavedThreshold;
  rows.push({
    id: b.id, name: b.name, regionId: b.regionId,
    accessType: b.metadata?.access?.type, batch: b.metadata?.batch || null,
    pavedM: osm.paved === Infinity ? null : osm.paved,
    trackM: osm.track === Infinity ? null : osm.track,
    footM: osm.foot === Infinity ? null : osm.foot,
    suspect,
    osm: `https://www.openstreetmap.org/#map=18/${b.lat}/${b.lon}`,
  });
  done += 1;
  if (done % 10 === 0) console.log(`  …${done}/${candidates.length}`);
}

const suspects = rows.filter(r => r.suspect).sort((a, b) => (a.pavedM ?? 1e9) - (b.pavedM ?? 1e9));
const byRegion = {};
for (const r of rows) {
  byRegion[r.regionId] ??= { checked: 0, suspect: 0 };
  byRegion[r.regionId].checked += 1;
  if (r.suspect) byRegion[r.regionId].suspect += 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  params: { types: [...types], regionFilter: regionFilter || null, radius, pavedThreshold },
  totals: { candidates: totalCandidates, checked: rows.length, suspect: suspects.length },
  byRegion, suspects, all: rows,
};
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');

const f = (v) => v == null ? '  —  ' : `${String(v).padStart(4)}m`;
console.log(`\nSUSPECT (no paved road ≤${pavedThreshold}m): ${suspects.length}/${rows.length}`);
for (const s of suspects) console.log(`  #${s.id} paved:${f(s.pavedM)} track:${f(s.trackM)} foot:${f(s.footM)}  ${s.name} [${s.regionId}]`);
console.log(`\nper-region: ${JSON.stringify(byRegion)}`);
console.log(`report → ${path.relative(rootDir, outPath)}`);
