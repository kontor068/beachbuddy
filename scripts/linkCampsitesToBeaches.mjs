// Link OSM campsites to nearby beaches by distance.
//
//   node scripts/linkCampsitesToBeaches.mjs match   # write report only (review this first)
//   node scripts/linkCampsitesToBeaches.mjs apply    # write metadata.nearbyCamping into the dataset
//
// Seed:    scripts/data/campsites-osm.json            (from harvestCampsitesOsm.mjs)
// Target:  public/greek_beaches.json                  (nested Region>Sub>Municipality>[beach])
// Report:  reports/camping/link-plan.json + .csv
//
// A campsite attaches to a beach when it is within RADIUS_M; each beach keeps its
// MAX_PER_BEACH nearest, sorted by distance. Source-derived and fully idempotent:
// `apply` recomputes metadata.nearbyCamping from scratch every run (adds it where there
// are matches, removes a stale one where there are none). Touches no other field.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceMeters } from './lib/placeResolution.mjs';

const SEED = new URL('./data/campsites-osm.json', import.meta.url);
const DATA = new URL('../public/greek_beaches.json', import.meta.url);
const REPORT_JSON = new URL('../reports/camping/link-plan.json', import.meta.url);
const REPORT_CSV = new URL('../reports/camping/link-plan.csv', import.meta.url);

const RADIUS_M = 2500;
const MAX_PER_BEACH = 3;
const LINKED_AT = new Date().toISOString().slice(0, 10);
const DEG = 0.03; // ~3.3 km lat — cheap bbox prefilter before the haversine

const mode = process.argv[2];
if (mode !== 'match' && mode !== 'apply') {
  console.error('Usage: node scripts/linkCampsitesToBeaches.mjs <match|apply>');
  process.exit(1);
}

// data[region][sub][municipality] = [beach]; yield each beach with its region label.
function* iterBeaches(data) {
  for (const [region, sub] of Object.entries(data)) {
    for (const subSub of Object.values(sub)) {
      for (const arr of Object.values(subSub)) {
        if (Array.isArray(arr)) for (const beach of arr) yield { beach, region };
      }
    }
  }
}

const toEntry = (c, meters) => ({
  id: c.id,
  name: c.name,
  ...(c.nameEn ? { nameEn: c.nameEn } : {}),
  coordinates: { lat: c.coordinates.lat, lon: c.coordinates.lon },
  distanceMeters: Math.round(meters),
  ...(c.website ? { website: c.website } : {}),
  ...(c.phone ? { phone: c.phone } : {}),
  ...(c.caravans ? { caravans: true } : {}),
  source: 'osm',
  osmUrl: c.osmUrl,
  checkedAt: LINKED_AT,
});

const campsites = JSON.parse(readFileSync(SEED, 'utf8'));
const data = JSON.parse(readFileSync(DATA, 'utf8'));

const histogram = { '0-500': 0, '500-1000': 0, '1000-1500': 0, '1500-2000': 0, '2000-2500': 0 };
const bucket = (m) => (m < 500 ? '0-500' : m < 1000 ? '500-1000' : m < 1500 ? '1000-1500' : m < 2000 ? '1500-2000' : '2000-2500');

const byRegion = {};
const matches = [];
const usedCampsiteIds = new Set();
let totalBeaches = 0;
let totalLinks = 0;

for (const { beach, region } of iterBeaches(data)) {
  totalBeaches += 1;
  byRegion[region] = byRegion[region] || { beaches: 0, withCamping: 0 };
  byRegion[region].beaches += 1;

  if (!Number.isFinite(beach.lat) || !Number.isFinite(beach.lon)) continue;
  const from = { lat: beach.lat, lon: beach.lon };

  const near = [];
  for (const c of campsites) {
    if (Math.abs(c.coordinates.lat - beach.lat) > DEG || Math.abs(c.coordinates.lon - beach.lon) > DEG) continue;
    const m = distanceMeters(from, c.coordinates);
    if (Number.isFinite(m) && m <= RADIUS_M) near.push({ c, m });
  }
  if (near.length === 0) continue;

  near.sort((a, b) => a.m - b.m);
  const top = near.slice(0, MAX_PER_BEACH);
  const entries = top.map(({ c, m }) => toEntry(c, m));

  // record the chosen links for the beach (apply) + the report
  beach.__nearbyCamping = entries; // staged on the in-memory object; written only on apply
  byRegion[region].withCamping += 1;
  totalLinks += entries.length;
  for (const { c, m } of top) { usedCampsiteIds.add(c.id); histogram[bucket(m)] += 1; }
  matches.push({
    beachId: beach.id,
    beach: beach.name,
    region,
    campsites: top.map(({ c, m }) => ({ name: c.name, distanceMeters: Math.round(m), osmUrl: c.osmUrl, website: c.website || null })),
  });
}

const beachesWithCamping = matches.length;
const unmatchedCampsites = campsites.filter((c) => !usedCampsiteIds.has(c.id)).map((c) => c.name);

const report = {
  generatedAt: new Date().toISOString(),
  radiusMeters: RADIUS_M,
  maxPerBeach: MAX_PER_BEACH,
  totalBeaches,
  beachesWithCamping,
  coveragePct: Math.round((beachesWithCamping / totalBeaches) * 1000) / 10,
  totalLinks,
  campsitesTotal: campsites.length,
  campsitesUsed: usedCampsiteIds.size,
  campsitesUnmatchedCount: unmatchedCampsites.length,
  distanceHistogram: histogram,
  byRegion: Object.fromEntries(Object.entries(byRegion).sort((a, b) => b[1].withCamping - a[1].withCamping)),
  unmatchedCampsites,
  matches: matches.sort((a, b) => (a.region.localeCompare(b.region) || a.beach.localeCompare(b.beach, 'el'))),
};

const writeOut = (url, text) => { mkdirSync(dirname(fileURLToPath(url)), { recursive: true }); writeFileSync(url, text, 'utf8'); };
writeOut(REPORT_JSON, JSON.stringify(report, null, 2) + '\n');

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvRows = ['beachId,region,beach,campsite,distance_m,website'];
for (const m of report.matches) for (const c of m.campsites) {
  csvRows.push([m.beachId, csvEscape(m.region), csvEscape(m.beach), csvEscape(c.name), c.distanceMeters, csvEscape(c.website || '')].join(','));
}
writeOut(REPORT_CSV, csvRows.join('\n') + '\n');

console.log(`Beaches: ${totalBeaches} | with camping ≤${RADIUS_M}m: ${beachesWithCamping} (${report.coveragePct}%) | links: ${totalLinks}`);
console.log(`Campsites: ${campsites.length} total, ${usedCampsiteIds.size} matched to ≥1 beach, ${unmatchedCampsites.length} near no beach.`);
console.log(`Distance buckets: ${JSON.stringify(histogram)}`);
console.log(`Report -> reports/camping/link-plan.json (+ .csv)`);

if (mode === 'apply') {
  let added = 0;
  let removed = 0;
  for (const { beach } of iterBeaches(data)) {
    const staged = beach.__nearbyCamping;
    delete beach.__nearbyCamping;
    if (staged && staged.length) {
      beach.metadata = beach.metadata || {};
      beach.metadata.nearbyCamping = staged;
      added += 1;
    } else if (beach.metadata && 'nearbyCamping' in beach.metadata) {
      delete beach.metadata.nearbyCamping; // recompute: clear a stale link
      removed += 1;
    }
  }
  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nAPPLIED: nearbyCamping set on ${added} beaches, cleared on ${removed}.`);
  console.log(`Wrote public/greek_beaches.json`);
} else {
  // match-only: drop the staged field so nothing leaks into memory dumps
  for (const { beach } of iterBeaches(data)) delete beach.__nearbyCamping;
  console.log(`\nMATCH ONLY — no data written. Review the report, then run: node scripts/linkCampsitesToBeaches.mjs apply`);
}
