// Tier-2 automated amenity cross-check (approved 2026-06-12). Region-agnostic.
// Read-only: fetches food/sunbed/parking POIs near each beach pin and FLAGS contradictions
// between the app's amenity claims and OSM ground truth. Never writes the dataset.
//
// Usage:
//   node scripts/auditAmenitiesOsm.mjs --all                 # every region (national run)
//   node scripts/auditAmenitiesOsm.mjs --region <regionId>   # one region file (id, no extension)
//   node scripts/auditAmenitiesOsm.mjs --group <groupId>     # all regions in a group (e.g. cyclades)
//   [--radius 800] [--out .tmp/tier2-amenity-audit] [--only-organized]
//
// Output: <out>.csv (per-beach flags) + <out>-by-region.csv (flag rates) + <out>.json.
// One Overpass query per region; radius 800 m around each pin (de-censored, per the pilot
// lesson that around:300 hid access/POI distances). A "season pass" diff can compare two
// JSON runs to catch new closures (e.g. a vanished beach club).
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  TAVERNA_AMENITY_TERMS, RESTAURANT_AMENITY_TERMS, CAFE_AMENITY_TERMS,
  SNACK_CANTEEN_AMENITY_TERMS, SUNBED_AMENITY_TERMS, PARKING_AMENITY_TERMS,
  BEACH_BAR_AMENITY_TERMS, amenityTextIncludesAny,
} from '../utils/amenityMatching.js';

const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const radius = Number(getArg('--radius', '800'));
const outBase = getArg('--out', '.tmp/tier2-amenity-audit');
const onlyOrganized = args.includes('--only-organized');
const all = args.includes('--all');
const regionFilter = getArg('--region', null);
const groupFilter = getArg('--group', null);

const appDir = 'public/data/beaches/app';
const regionFiles = readdirSync(appDir).filter(n => n.endsWith('.json'));
const regions = [];
for (const f of regionFiles) {
  let d; try { d = JSON.parse(readFileSync(path.join(appDir, f), 'utf8')); } catch { continue; }
  if (!d.region || !d.island?.beaches) continue;
  if (all) regions.push(d);
  else if (regionFilter && d.region.id === regionFilter) regions.push(d);
  else if (groupFilter && d.region.group === groupFilter) regions.push(d);
}
if (!regions.length) { console.error('No matching regions. Use --all, --region <id>, or --group <id>.'); process.exit(1); }

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const chunk = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
// Resilient fetch: cycle all mirrors, retry the whole cycle with backoff on 429/5xx/timeout.
const fetchOverpass = async (query, attempts = 4) => {
  for (let a = 0; a < attempts; a++) {
    for (const url of MIRRORS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': 'CalmBeachNavAudit/0.1 (calmbeach.gr; marismiltos@gmail.com)', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
        const text = await res.text();
        if (res.status === 429 || res.status >= 500) continue;                 // overloaded → next mirror
        if (!res.ok || text.trimStart().startsWith('<')) continue;             // HTML error page
        return JSON.parse(text);
      } catch { /* network error → next mirror */ }
    }
    await sleep(2500 * (a + 1));                                               // backoff before retrying the cycle
  }
  return null;
};

const M = 111320;
const distM = (aLat, aLon, bLat, bLon) => Math.sqrt(((bLat - aLat) * M) ** 2 + ((bLon - aLon) * M * Math.cos(aLat * Math.PI / 180)) ** 2);
const FOOD_TERMS = [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS, ...CAFE_AMENITY_TERMS, ...SNACK_CANTEEN_AMENITY_TERMS, ...BEACH_BAR_AMENITY_TERMS];

// Per-beach nearby POIs in the SAME shape as reports/amenity-evidence/google-nearby-cache.json
// ({ id: [{name, primaryType, d}] }) so reverseAmenitySweep/applyAmenityFixes can consume OSM
// exactly like the (paid, partial) Google cache — giving national physical-evidence coverage.
const osmNearby = {};
const KIND_TO_TYPE = { bar: 'bar', pub: 'pub', cafe: 'cafe', restaurant: 'restaurant', fast_food: 'fast_food_restaurant', taverna: 'restaurant', beach_resort: 'beach_resort' };

const rows = [];
for (const d of regions) {
  let beaches = d.island.beaches;
  if (onlyOrganized) beaches = beaches.filter(b => b.metadata?.organized === true);
  if (!beaches.length) continue;
  // Chunk into small batches so no single Overpass query is heavy enough to 504/time out.
  const batches = chunk(beaches, 15);
  const elements = [];
  let failedBatches = 0;
  for (let bi = 0; bi < batches.length; bi++) {
    const around = batches[bi].map(b => {
      const { lat, lon } = b.coordinates;
      return `node(around:${radius},${lat},${lon})[~"^(amenity|tourism|leisure)$"~"restaurant|bar|cafe|fast_food|taverna|pub|parking|beach_resort|shower|toilets"];way(around:${radius},${lat},${lon})[~"^(amenity|leisure)$"~"restaurant|bar|cafe|parking|beach_resort"];`;
    }).join('\n');
    const query = `[out:json][timeout:60];(\n${around}\n);out center tags;`;
    console.error(`[${d.region.id}] batch ${bi + 1}/${batches.length} (${batches[bi].length} beaches)...`);
    const data = await fetchOverpass(query);
    if (!data) { failedBatches++; console.error('  batch FAILED after retries'); continue; }
    if (data.elements) elements.push(...data.elements);
    await sleep(600);
  }
  if (failedBatches) console.error(`  ${d.region.id}: ${failedBatches}/${batches.length} batches failed`);
  const data = { elements };
  for (const b of beaches) {
    const { lat, lon } = b.coordinates;
    const pois = [];
    for (const el of data.elements) {
      const elat = el.lat ?? el.center?.lat, elon = el.lon ?? el.center?.lon;
      if (elat == null) continue;
      const dist = distM(lat, lon, elat, elon);
      if (dist > radius) continue;
      const t = el.tags || {};
      pois.push({ d: Math.round(dist), kind: t.amenity || t.tourism || t.leisure, name: t.name || '' });
    }
    // record the close, relevant POIs (≤250m) for the shared nearby-cache output
    const cachePois = pois
      .filter(p => p.d <= 250 && KIND_TO_TYPE[p.kind])
      .map(p => ({ name: p.name || '', primaryType: KIND_TO_TYPE[p.kind], d: p.d }))
      .sort((a, b) => a.d - b.d);
    if (cachePois.length) osmNearby[b.id] = cachePois;

    const foodPois = pois.filter(p => /restaurant|bar|cafe|fast_food|pub|taverna/.test(p.kind || ''));
    const resortPois = pois.filter(p => p.kind === 'beach_resort');
    const nearestFood = foodPois.length ? Math.min(...foodPois.map(p => p.d)) : null;
    const nearestResort = resortPois.length ? Math.min(...resortPois.map(p => p.d)) : null;

    const amen = b.metadata?.amenities || [];
    const claimsFood = amenityTextIncludesAny(amen, FOOD_TERMS);
    const claimsSunbeds = amenityTextIncludesAny(amen, SUNBED_AMENITY_TERMS);
    const claimsParking = amenityTextIncludesAny(amen, PARKING_AMENITY_TERMS);
    const organized = b.metadata?.organized === true;
    const hasOfficialSource = (b.metadata?.verification_sources?.length || b.metadata?.sourceUrls?.length || 0) > 0;
    // Already passed a manual evidence/source audit: OSM POI absence is then just rural mapping
    // sparsity (village tavernas/rural canteens are not in OSM), NOT a contradiction. Re-flagging
    // groomed data wastes review time (proven by the Euboea batch, where every "ταβέρνες κοντά"
    // claim matched its source verbatim). Detect the evidence-pass sourceNotes signature.
    // Audit evidence is EITHER an evidence-pass sourceNote signature OR the presence of
    // verification_sources/sourceUrls (the Messinia batch proved beaches with real source
    // URLs but differently-worded notes were leaking into the "unaudited" queue and getting
    // re-flagged on OSM POI absence — a false positive, since the claim is sourced).
    const sn = b.metadata?.sourceNotes;
    const notes = Array.isArray(sn) ? sn : (typeof sn === 'string' && sn ? [sn] : []);
    const hasEvidencePassNote = notes.some(n => /evidence pass|source check|source-backed|tourist-priority|amenities audit|confidence (pass|continuation)/i.test(n));
    const hasSourceUrls = ((b.metadata?.verification_sources?.length || 0) + (b.metadata?.sourceUrls?.length || 0)) > 0;
    const isAudited = hasEvidencePassNote || hasSourceUrls;

    const flags = [];
    // Contradiction A: claims food/taverna/bar but no food POI anywhere in radius.
    // Suppressed when the beach is already evidence-audited (the claim was verified at source).
    if (claimsFood && nearestFood === null && !isAudited) flags.push('food-claim-no-osm');
    // Contradiction B: organized (or sunbed claim) but no beach_resort AND no food POI AND no official source.
    if ((organized || claimsSunbeds) && nearestResort === null && nearestFood === null && !hasOfficialSource && !isAudited) flags.push('organized-no-osm-no-source');
    // Opportunity C: a beach_resort sits right on the pin but we list no food/organized claim.
    // This is an ADDITION opportunity, not a groomed-data false positive — keep it regardless of audit status.
    if (nearestResort !== null && nearestResort <= 100 && !organized && !claimsFood) flags.push('osm-resort-not-claimed');
    // Sanity D: claims parking but neither a parking POI nor any POI at all (weak signal — OSM sparsity).
    if (claimsParking && !pois.some(p => p.kind === 'parking') && pois.length === 0 && !isAudited) flags.push('parking-claim-no-osm-poi');

    rows.push({
      region: d.region.id, group: d.region.group, id: b.id, name: b.name?.en,
      organized, claimsFood, claimsSunbeds, hasOfficialSource, audited: isAudited,
      nearestFoodM: nearestFood, nearestResortM: nearestResort, poiCount: pois.length,
      flags: flags.join('|'),
    });
  }
}

// Outputs
const csvEscape = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const headers = ['region', 'group', 'id', 'name', 'organized', 'claimsFood', 'claimsSunbeds', 'hasOfficialSource', 'audited', 'nearestFoodM', 'nearestResortM', 'poiCount', 'flags'];
const csv = [headers.join(','), ...rows.map(r => headers.map(h => csvEscape(r[h])).join(','))].join('\n');
// The Overpass queries above cost ~2 min per region; a missing --out folder must not throw them away.
mkdirSync(path.dirname(path.resolve(outBase)), { recursive: true });
writeFileSync(outBase + '.csv', csv, 'utf8');
writeFileSync(outBase + '.json', JSON.stringify(rows, null, 1), 'utf8');
// shared nearby-cache (only on a full national run, so partial runs don't overwrite it)
if (all) {
  writeFileSync('reports/amenity-evidence/osm-nearby-cache.json', JSON.stringify(osmNearby), 'utf8');
  console.log(`Wrote reports/amenity-evidence/osm-nearby-cache.json (${Object.keys(osmNearby).length} beaches with POIs)`);
} else {
  // A scoped run must not overwrite the national cache, but throwing its POI names away means
  // re-querying Overpass to answer "what kind of food is that?" — so keep them beside the report.
  writeFileSync(outBase + '-nearby.json', JSON.stringify(osmNearby), 'utf8');
  console.log(`Wrote ${outBase}-nearby.json (${Object.keys(osmNearby).length} beaches with POIs)`);
}

// Per-region flag rates
const byRegion = new Map();
for (const r of rows) {
  if (!byRegion.has(r.region)) byRegion.set(r.region, { region: r.region, group: r.group, total: 0, flagged: 0, cats: {} });
  const e = byRegion.get(r.region); e.total += 1;
  if (r.flags) { e.flagged += 1; for (const f of r.flags.split('|')) e.cats[f] = (e.cats[f] || 0) + 1; }
}
const catNames = ['food-claim-no-osm', 'organized-no-osm-no-source', 'osm-resort-not-claimed', 'parking-claim-no-osm-poi'];
const regHeaders = ['region', 'group', 'total', 'flagged', 'flagRatePct', ...catNames];
const regCsv = [regHeaders.join(','), ...[...byRegion.values()].sort((a, b) => (b.flagged / b.total) - (a.flagged / a.total)).map(e =>
  [e.region, e.group, e.total, e.flagged, (100 * e.flagged / e.total).toFixed(1), ...catNames.map(c => e.cats[c] || 0)].map(csvEscape).join(','))].join('\n');
writeFileSync(outBase + '-by-region.csv', regCsv, 'utf8');

const totalFlagged = rows.filter(r => r.flags).length;
const catTotals = {}; for (const r of rows) for (const f of (r.flags ? r.flags.split('|') : [])) catTotals[f] = (catTotals[f] || 0) + 1;
console.log(`\nDONE: ${rows.length} beaches across ${byRegion.size} regions; ${totalFlagged} flagged (${(100 * totalFlagged / rows.length).toFixed(1)}%).`);
console.log('By category:', JSON.stringify(catTotals));
console.log(`Wrote ${outBase}.csv, ${outBase}-by-region.csv, ${outBase}.json`);
