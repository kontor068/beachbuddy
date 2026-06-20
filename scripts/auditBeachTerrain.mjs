// Terrain / sand-type audit (report-only). Cross-checks our terrain.types (sand vs pebbles vs
// rocks) against the OSM natural=beach `surface` tag — crowd-verified ground truth where present
// (~33% of beaches). Flags contradictions (esp. sand↔pebbles, the key decision factor). Never edits
// data. Cached/resumable, rate-limited.
//
//   node scripts/auditBeachTerrain.mjs [--region <substr>] [--limit N] [--refresh]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const outDir = path.join(rootDir, 'reports', 'terrain');
const cachePath = path.join(outDir, 'osm-surface-cache.json');
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const regionFilter = (getArg('--region', '') || '').toLowerCase();
const limit = getArg('--limit') ? Number(getArg('--limit')) : Infinity;
const refresh = args.includes('--refresh');

const regionId = (r, p) => `${r || 'Unknown'}-${p || r || 'Unknown'}`.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'unknown';
const flatten = (data) => { const out = []; const walk = (n, reg, parts) => { if (Array.isArray(n)) { for (const it of n) { if (Number.isInteger(it?.id) && Number.isFinite(it?.lat)) out.push({ id: it.id, name: it.name, lat: it.lat, lon: it.lon, types: it.metadata?.terrain?.types || [], regionId: regionId(reg, parts[parts.length - 1] || reg) }); } return; } if (n && typeof n === 'object') for (const [k, v] of Object.entries(n)) walk(v, parts.length ? reg : k, [...parts, k]); }; for (const [k, v] of Object.entries(data)) walk(v, k, [k]); return out; };

// category mappers
const ourCat = (t) => { if (/sand/.test(t)) return 'SAND'; if (/pebble|gravel|shingle/.test(t)) return 'PEBBLES'; if (/rock|stone/.test(t)) return 'ROCKS'; return null; };
const osmCat = (s) => { s = String(s || '').toLowerCase(); if (s === 'sand') return 'SAND'; if (/pebble|gravel|shingle/.test(s)) return 'PEBBLES'; if (/rock|stone/.test(s)) return 'ROCKS'; return null; };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const queryOsm = async (lat, lon) => {
  const q = `[out:json][timeout:25];(way(around:120,${lat},${lon})[natural=beach];node(around:120,${lat},${lon})[natural=beach];);out tags;`;
  const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(q);
  for (let a = 0; a < 5; a++) { const res = await fetch(url, { headers: { 'User-Agent': 'calmbeach-terrain-audit/1.0', 'Accept': 'application/json' } }); if (res.status === 429 || res.status === 504) { await sleep(3000 * (a + 1)); continue; } if (!res.ok) throw new Error('overpass ' + res.status); const els = (await res.json()).elements || []; const hasBeach = els.some(e => e.tags?.natural === 'beach'); const surface = els.map(e => e.tags?.surface).find(Boolean) || null; return { hasBeach, surface }; }
  throw new Error('overpass retries');
};

mkdirSync(outDir, { recursive: true });
const cache = !refresh && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
let beaches = flatten(JSON.parse(readFileSync(sourcePath, 'utf8'))).filter(b => !regionFilter || b.regionId.includes(regionFilter)).sort((a, b) => a.id - b.id).slice(0, limit);
console.log(`terrain audit: ${beaches.length} beaches${regionFilter ? ` (region~${regionFilter})` : ''}`);

const rows = [];
let i = 0;
for (const b of beaches) {
  let osm = cache[b.id];
  if (!osm || osm.v !== 2) { try { osm = { ...(await queryOsm(b.lat, b.lon)), v: 2 }; } catch (e) { osm = { error: String(e.message), v: 2 }; } cache[b.id] = osm; writeFileSync(cachePath, JSON.stringify(cache), 'utf8'); await sleep(1100); }
  if (osm.error || !osm.surface) { rows.push({ id: b.id, name: b.name, regionId: b.regionId, ourTypes: b.types, osmSurface: osm.surface || null, status: osm.error ? 'error' : (osm.hasBeach ? 'no-surface' : 'no-osm-beach') }); }
  else {
    const oc = osmCat(osm.surface); const ours = new Set(b.types.map(ourCat).filter(Boolean));
    const status = !oc ? 'osm-other' : ours.has(oc) ? 'match' : 'MISMATCH';
    rows.push({ id: b.id, name: b.name, regionId: b.regionId, ourTypes: b.types, osmSurface: osm.surface, osmCat: oc, status });
  }
  if (++i % 50 === 0) console.log(`  …${i}/${beaches.length}`);
}

const withSurface = rows.filter(r => r.osmCat);
const mism = rows.filter(r => r.status === 'MISMATCH');
const report = { generatedAt: new Date().toISOString(), totals: { beaches: rows.length, osmHasSurface: withSurface.length, match: rows.filter(r => r.status === 'match').length, mismatch: mism.length }, mismatches: mism, all: rows };
writeFileSync(path.join(outDir, `report-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(`\nOSM surface present: ${withSurface.length} | MATCH: ${report.totals.match} | MISMATCH: ${mism.length}`);
const bySev = {}; for (const m of mism) { const k = `our:${[...new Set(m.ourTypes.map(ourCat).filter(Boolean))].join('+') || '?'} vs osm:${m.osmCat}`; bySev[k] = (bySev[k] || 0) + 1; }
console.log('mismatch breakdown:', JSON.stringify(bySev, null, 1));
console.log(`report → reports/terrain/report-${new Date().toISOString().slice(0, 10)}.json`);
