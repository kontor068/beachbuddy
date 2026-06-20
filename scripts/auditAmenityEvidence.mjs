// Amenity-claim evidence audit (report-only). Verifies "organized + beach bar / sunbeds"
// claims against Google evidence, the amenity analog of the access-road audit.
//
// Hybrid, cost-aware:
//   STAGE 1 (free, always): screen every beach with an on-beach amenity claim using cached
//     Google signal — metadata.popularity.ratingCount + place types from google-upgrade.json.
//     Strong review/type footprint => claim SUPPORTED (skip). Few/no reviews + no food type
//     => SUSPECT (shortlist).
//   STAGE 2 (--confirm, paid ~$0.032/call): for the shortlist only, Google Places searchNearby
//     for food/drink POIs within --radius of the pin. Zero nearby food/drink => UNSUPPORTED.
//
// Never writes to the dataset. Produces reports/amenity-evidence/report-*.json for human review.
//
// Usage:
//   node scripts/auditAmenityEvidence.mjs                 # Stage 1 only (free)
//   node scripts/auditAmenityEvidence.mjs --confirm       # Stage 1 + Stage 2 (spends API budget)
//   [--region <substr>] [--radius 180] [--max-reviews 50] [--limit N] [--refresh]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hasExplicitBeachBarAmenityInList, amenityTextIncludesAny,
  SUNBED_AMENITY_TERMS, TAVERNA_AMENITY_TERMS, RESTAURANT_AMENITY_TERMS,
} from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const upgradePath = path.join(rootDir, 'reports', 'place-resolution', 'google-upgrade.json');
const outDir = path.join(rootDir, 'reports', 'amenity-evidence');
const cachePath = path.join(outDir, 'google-nearby-cache.json');

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const confirm = args.includes('--confirm');
const refresh = args.includes('--refresh');
const regionFilter = (getArg('--region', '') || '').toLowerCase();
const radius = Number(getArg('--radius', '180'));
const maxReviews = Number(getArg('--max-reviews', '50'));
// which claim categories to screen: strong = organized+(bar|sunbeds); bar = explicit beach bar;
// sunbed; taverna = taverna/restaurant; organized = organized flag; all = any of the above.
const claimSel = new Set((getArg('--claims', 'strong') || 'strong').split(',').map(s => s.trim()).filter(Boolean));
const limit = getArg('--limit') ? Number(getArg('--limit')) : Infinity;
const outPath = getArg('--out', path.join(outDir, `report-${new Date().toISOString().slice(0, 10)}.json`));

// --- env / key (mirrors auditCycladesGooglePlaces.mjs) ---------------------------------------
const stripQuotes = (v) => v.replace(/^["']|["']$/g, '');
const loadEnv = (file) => {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (line.trimStart().startsWith('#')) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = stripQuotes(m[2]);
  }
};
loadEnv(path.join(rootDir, '.env')); loadEnv(path.join(rootDir, '.env.local'));
const apiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;

// --- region attribution (mirrors buildBeachRegionData.mjs) -----------------------------------
const regionId = (region, prefecture) =>
  `${region || 'Unknown'}-${prefecture || region || 'Unknown'}`.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'unknown';
const flatten = (data) => {
  const out = [];
  const walk = (node, region, parts) => {
    if (Array.isArray(node)) {
      for (const it of node) {
        const lat = Number(it?.lat), lon = Number(it?.lon);
        if (Number.isInteger(it?.id) && Number.isFinite(lat) && Number.isFinite(lon))
          out.push({ id: it.id, name: it.name, lat, lon, metadata: it.metadata, regionId: regionId(region, parts[parts.length - 1] || region) });
      }
      return;
    }
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, region, [...parts, k]);
  };
  for (const [region, node] of Object.entries(data)) walk(node, region, []);
  return out;
};

// --- cached Google place types ---------------------------------------------------------------
const FOOD_TYPES = new Set(['restaurant', 'bar', 'cafe', 'coffee_shop', 'food', 'meal_takeaway', 'fast_food', 'bakery', 'night_club', 'beach_resort', 'resort_hotel']);
const NEARBY_TYPES = ['restaurant', 'bar', 'cafe', 'coffee_shop', 'bakery', 'meal_takeaway', 'fast_food_restaurant', 'night_club'];
const typeById = new Map();
if (existsSync(upgradePath)) for (const r of JSON.parse(readFileSync(upgradePath, 'utf8'))) {
  typeById.set(r.id, new Set((r?.top?.types || []).map(t => String(t).toLowerCase())));
}

// --- Google Places searchNearby --------------------------------------------------------------
const R = 6371000, T = Math.PI / 180;
const dist = (la1, lo1, la2, lo2) => { const x = (la2 - la1) * T, y = (lo2 - lo1) * T; const a = Math.sin(x / 2) ** 2 + Math.cos(la1 * T) * Math.cos(la2 * T) * Math.sin(y / 2) ** 2; return Math.round(2 * R * Math.asin(Math.sqrt(a))); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const searchNearby = async (lat, lon) => {
  const body = { includedTypes: NEARBY_TYPES, maxResultCount: 8, rankPreference: 'DISTANCE',
    locationRestriction: { circle: { center: { latitude: lat, longitude: lon }, radius } } };
  for (let a = 0; a < 4; a++) {
    const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'places.displayName,places.types,places.primaryType,places.location' },
      body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) { await sleep(2000 * (a + 1)); continue; }
    if (!res.ok) throw new Error(`places ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const places = (await res.json()).places || [];
    return places.map(p => ({ name: p.displayName?.text || '', primaryType: p.primaryType || '', d: p.location ? dist(lat, lon, p.location.latitude, p.location.longitude) : null }))
      .filter(p => p.d == null || p.d <= radius).sort((x, y) => (x.d ?? 1e9) - (y.d ?? 1e9));
  }
  throw new Error('places retries exhausted');
};

// --- Stage 1: screen claims ------------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
const beaches = flatten(JSON.parse(readFileSync(sourcePath, 'utf8')))
  .filter(b => !regionFilter || b.regionId.includes(regionFilter));

const rows = [];
for (const b of beaches) {
  const m = b.metadata; if (!m) continue;
  const am = m.amenities || [];
  const organized = m.organized === true;
  const bar = hasExplicitBeachBarAmenityInList(am);
  const sunbed = amenityTextIncludesAny(am, SUNBED_AMENITY_TERMS);
  const taverna = amenityTextIncludesAny(am, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS]);
  const strongClaim = organized && (bar || sunbed);
  const claimMatch =
    (claimSel.has('strong') && strongClaim) ||
    (claimSel.has('bar') && bar) ||
    (claimSel.has('sunbed') && sunbed) ||
    (claimSel.has('taverna') && taverna) ||
    (claimSel.has('organized') && organized) ||
    (claimSel.has('all') && (strongClaim || bar || sunbed || taverna || organized));
  if (!claimMatch) continue;
  const rc = m.popularity?.ratingCount ?? null;
  const types = typeById.get(b.id);
  const cachedFood = types ? [...types].some(t => FOOD_TYPES.has(t)) : false;
  // free support verdict
  let support;
  if (cachedFood || (rc != null && rc >= 100)) support = 'supported';
  else if (rc != null && rc >= maxReviews) support = 'likely';
  else support = 'suspect';                        // few/no reviews and no cached food type
  rows.push({ id: b.id, name: b.name, regionId: b.regionId, lat: b.lat, lon: b.lon,
    claims: { organized, bar, sunbed, taverna }, ratingCount: rc, cachedFood, support });
}
const shortlist = rows.filter(r => r.support === 'suspect').sort((a, b) => (a.ratingCount ?? -1) - (b.ratingCount ?? -1));
console.log(`Stage 1 [claims: ${[...claimSel].join(',')}]: claim beaches: ${rows.length} | supported ${rows.filter(r => r.support === 'supported').length} | likely ${rows.filter(r => r.support === 'likely').length} | SUSPECT ${shortlist.length}`);

// --- Stage 2: confirm shortlist with Google ---------------------------------------------------
let confirmed = [];
if (confirm) {
  if (!apiKey) { console.error('Missing GOOGLE_PLACES_API_KEY (env or .env.local).'); process.exit(1); }
  const cache = !refresh && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, 'utf8')) : {};
  const targets = shortlist.slice(0, limit);
  console.log(`Stage 2: querying Google Nearby for ${targets.length} suspects (radius ${radius}m)…`);
  let i = 0;
  for (const r of targets) {
    let near = cache[r.id];
    if (!near) { near = await searchNearby(r.lat, r.lon); cache[r.id] = near; writeFileSync(cachePath, JSON.stringify(cache), 'utf8'); await sleep(150); }
    r.nearbyFoodDrink = near.length;
    r.nearest = near[0] || null;
    r.verdict = near.length === 0 ? 'UNSUPPORTED' : 'supported';
    confirmed.push(r);
    if (++i % 25 === 0) console.log(`  …${i}/${targets.length}`);
  }
}

const unsupported = confirmed.filter(r => r.verdict === 'UNSUPPORTED').sort((a, b) => a.regionId.localeCompare(b.regionId));
const report = {
  generatedAt: new Date().toISOString(),
  params: { claims: [...claimSel], regionFilter: regionFilter || null, radius, maxReviews, confirm },
  stage1: { strongClaim: rows.length, supported: rows.filter(r => r.support === 'supported').length, likely: rows.filter(r => r.support === 'likely').length, suspect: shortlist.length },
  stage2: confirm ? { checked: confirmed.length, unsupported: unsupported.length, supported: confirmed.length - unsupported.length } : null,
  unsupported, shortlist, all: rows,
};
writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
if (confirm) {
  console.log(`\nUNSUPPORTED (claims organized+bar/sunbeds, but ZERO food/drink POI within ${radius}m): ${unsupported.length}`);
  for (const r of unsupported) console.log(`  #${r.id}  rc:${String(r.ratingCount ?? '—').padStart(4)}  ${r.name} [${r.regionId}]`);
}
console.log(`\nreport → ${path.relative(rootDir, outPath)}`);
