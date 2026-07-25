// Link OSM shower points to the beach they belong to — OFFLINE, re-runnable.
//
//   node scripts/linkShowersToBeaches.mjs match   # write report only (review this first)
//   node scripts/linkShowersToBeaches.mjs apply    # write metadata.hasShower into the dataset
//
// Seed:    scripts/data/showers-osm.json     (from harvestShowersOsm.mjs — run once)
// Target:  public/greek_beaches.json         (nested Region>Sub>Municipality>[beach])
// Report:  reports/showers/link-plan.json + .csv
//
// A shower is an ON-beach amenity, not a "nearby" POI: each shower point snaps to its
// SINGLE nearest beach, and only counts if within a tight radius. Distance sets a
// confidence tier (bias to UNDER-claim — a false "has shower" is worse than a miss):
//   high   ≤ HIGH_M         or the beach self-declares shower= on its own OSM element
//   medium ≤ MEDIUM_M
//   low    ≤ LOW_M          (review only — never auto-applied)
//   beyond LOW_M            the shower is attributed to no beach in our set
// `apply` writes metadata.hasShower=true + metadata.showerEvidence for HIGH confidence
// only, and is fully idempotent (recomputes from scratch, clearing stale flags).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceMeters } from './lib/placeResolution.mjs';

const SEED = new URL('./data/showers-osm.json', import.meta.url);
const DATA = new URL('../public/greek_beaches.json', import.meta.url);
const REPORT_JSON = new URL('../reports/showers/link-plan.json', import.meta.url);
const REPORT_CSV = new URL('../reports/showers/link-plan.csv', import.meta.url);

const HIGH_M = 80;    // essentially on the beach (distance to the beach's label pin)
const MEDIUM_M = 150; // very likely this beach
const LOW_M = 250;    // plausible — review, don't auto-apply
const PROMOTE_POLY_M = 35; // shower within this of the beach's REAL OSM polygon ⇒ promote to high.
// OSM natural=beach polygons are drawn at the waterline; rinse showers sit ~20-30 m up the
// backshore by the entrance, so a 35 m buffer still means "on the beach". Beyond it the shower
// is measurably in a different zone (road/parking/taverna) and we will NOT claim it (mandate:
// a false "has shower" is worse than a miss).
const DEG = 0.004;    // ~440 m lat — cheap bbox prefilter before haversine
const LINKED_AT = new Date().toISOString().slice(0, 10);

const mode = process.argv[2];
if (mode !== 'match' && mode !== 'apply') {
  console.error('Usage: node scripts/linkShowersToBeaches.mjs <match|apply>');
  process.exit(1);
}

function* iterBeaches(data) {
  for (const [region, sub] of Object.entries(data)) {
    for (const subSub of Object.values(sub)) {
      for (const arr of Object.values(subSub)) {
        if (Array.isArray(arr)) for (const beach of arr) yield { beach, region };
      }
    }
  }
}

const showers = JSON.parse(readFileSync(SEED, 'utf8'));
const data = JSON.parse(readFileSync(DATA, 'utf8'));

// Optional geometry cache (from enrichShowerGeometry.mjs): shower→beach-polygon distance.
// When a shower sits inside / at the edge of its beach's real OSM polygon, it's that beach's
// shower with high confidence even if the label pin is offset — so we promote it.
const GEOM = new URL('./data/shower-beach-geometry.json', import.meta.url);
const geom = existsSync(GEOM) ? JSON.parse(readFileSync(GEOM, 'utf8')) : {};
const geomConfirms = (s) => {
  const g = geom[s.osmUrl];
  return g && typeof g.polyDistM === 'number' && g.polyDistM <= PROMOTE_POLY_M;
};

// Name-match confirmation (the "do the 36" pass): a handful of residual showers sit just
// beyond the polygon buffer (45-59 m, in the campground backshore) but their OSM name names
// the beach itself, which unambiguously ties the shower to THIS beach → promote to high.
// Only cases where the facility name contains the beach name; campsite/wrong-beach names that
// did NOT match were deliberately left at medium/low (a false "has shower" is worse than a miss).
const NAME_CONFIRMED_HIGH = new Map([
  [922, 'shower way/1327618649 "Camping Sofas" — names Σοφάς beach'],
  [430, 'shower node/5081651699 "Ακτή ονείρου Camping-Bungalows" — names Oneiro/Ακτή ονείρου beach'],
  [1098, 'shower node/26860001 "Camping Karavomilos Beach" — names Καραβόμυλος beach'],
]);

// Flatten beaches once with coords for the nearest-beach search.
const beaches = [];
for (const { beach, region } of iterBeaches(data)) {
  if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) beaches.push({ beach, region });
}

const tierOf = (m, s) => {
  if (s.kind === 'beach-tag' || s.kind === 'resort-tag') return 'high'; // the beach itself declares it
  if (geomConfirms(s)) return 'high';                                   // confirmed on the beach polygon
  if (m <= HIGH_M) return 'high';
  if (m <= MEDIUM_M) return 'medium';
  if (m <= LOW_M) return 'low';
  return null;
};

// For each shower, find its single nearest beach; attribute it there if within LOW_M.
const perBeach = new Map(); // beachId -> { beach, region, showers:[{shower, m, tier}] }
let attributed = 0, orphaned = 0;
const orphans = [];

for (const s of showers) {
  const { lat, lon } = s.coordinates;
  let best = null, bestM = Infinity;
  for (const entry of beaches) {
    const { beach } = entry;
    if (Math.abs(beach.lat - lat) > DEG || Math.abs(beach.lon - lon) > DEG) continue;
    const m = distanceMeters({ lat, lon }, { lat: beach.lat, lon: beach.lon });
    if (Number.isFinite(m) && m < bestM) { bestM = m; best = entry; }
  }
  const tier = best ? tierOf(bestM, s) : null;
  if (!best || !tier) { orphaned += 1; orphans.push({ osmUrl: s.osmUrl, name: s.name, nearestBeachM: best ? Math.round(bestM) : null }); continue; }
  attributed += 1;
  const key = best.beach.id;
  if (!perBeach.has(key)) perBeach.set(key, { beach: best.beach, region: best.region, showers: [] });
  perBeach.get(key).showers.push({ shower: s, m: bestM, tier });
}

// Collapse to one verdict per beach: strongest tier + nearest distance + evidence list.
const TIER_RANK = { high: 3, medium: 2, low: 1 };
const beachVerdicts = [];
for (const { beach, region, showers: list } of perBeach.values()) {
  list.sort((a, b) => a.m - b.m);
  let bestTier = list.reduce((t, x) => (TIER_RANK[x.tier] > TIER_RANK[t] ? x.tier : t), 'low');
  if (NAME_CONFIRMED_HIGH.has(beach.id)) bestTier = 'high'; // curated name-match confirmation
  beachVerdicts.push({
    beachId: beach.id,
    beach: beach.name,
    region,
    tier: bestTier,
    showerCount: list.length,
    nearestM: Math.round(list[0].m),
    evidence: list.map(({ shower, m, tier }) => ({
      osmUrl: shower.osmUrl, kind: shower.kind, distanceMeters: Math.round(m), tier,
      ...(geom[shower.osmUrl] && typeof geom[shower.osmUrl].polyDistM === 'number' ? { polyDistM: geom[shower.osmUrl].polyDistM } : {}),
      ...(shower.name ? { name: shower.name } : {}),
      ...(shower.showerType ? { showerType: shower.showerType } : {}),
      ...(shower.fee ? { fee: shower.fee } : {}),
    })),
  });
  // stage the HIGH-confidence verdict for apply
  beach.__showerVerdict = bestTier === 'high' ? beachVerdicts[beachVerdicts.length - 1] : null;
}

const byTier = { high: 0, medium: 0, low: 0 };
for (const v of beachVerdicts) byTier[v.tier] += 1;

const byRegion = {};
for (const v of beachVerdicts) {
  byRegion[v.region] = byRegion[v.region] || { high: 0, medium: 0, low: 0 };
  byRegion[v.region][v.tier] += 1;
}

const report = {
  generatedAt: new Date().toISOString(),
  thresholds: { highM: HIGH_M, mediumM: MEDIUM_M, lowM: LOW_M },
  showersTotal: showers.length,
  showersAttributed: attributed,
  showersOrphaned: orphaned,
  beachesWithShower: beachVerdicts.length,
  byTier,
  autoApplyHigh: byTier.high,
  byRegion: Object.fromEntries(Object.entries(byRegion).sort((a, b) => (b[1].high + b[1].medium) - (a[1].high + a[1].medium))),
  verdicts: beachVerdicts.sort((a, b) => (TIER_RANK[b.tier] - TIER_RANK[a.tier]) || a.nearestM - b.nearestM),
  orphansSample: orphans.slice(0, 40),
};

const writeOut = (url, text) => { mkdirSync(dirname(fileURLToPath(url)), { recursive: true }); writeFileSync(url, text, 'utf8'); };
writeOut(REPORT_JSON, JSON.stringify(report, null, 2) + '\n');

const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const csvRows = ['beachId,region,beach,tier,showerCount,nearestM,osmUrls'];
for (const v of report.verdicts) {
  csvRows.push([v.beachId, csvEscape(v.region), csvEscape(v.beach), v.tier, v.showerCount, v.nearestM, csvEscape(v.evidence.map((e) => e.osmUrl).join(' '))].join(','));
}
writeOut(REPORT_CSV, csvRows.join('\n') + '\n');

console.log(`Showers: ${showers.length} total | attributed ${attributed} | orphaned ${orphaned}`);
console.log(`Beaches with a shower: ${beachVerdicts.length}  (high ${byTier.high}, medium ${byTier.medium}, low ${byTier.low})`);
console.log(`Report -> reports/showers/link-plan.json (+ .csv)`);

if (mode === 'apply') {
  let added = 0, cleared = 0;
  for (const { beach } of iterBeaches(data)) {
    const staged = beach.__showerVerdict;
    delete beach.__showerVerdict;
    if (staged) {
      beach.metadata = beach.metadata || {};
      beach.metadata.hasShower = true;
      beach.metadata.showerEvidence = { source: 'osm', nearestMeters: staged.nearestM, count: staged.showerCount, osm: staged.evidence.map((e) => e.osmUrl), checkedAt: LINKED_AT };
      added += 1;
    } else if (beach.metadata && ('hasShower' in beach.metadata || 'showerEvidence' in beach.metadata)) {
      delete beach.metadata.hasShower;
      delete beach.metadata.showerEvidence;
      cleared += 1;
    }
  }
  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nAPPLIED (HIGH only): hasShower set on ${added} beaches, cleared on ${cleared}.`);
  console.log(`Wrote public/greek_beaches.json — remember to rebuild app data.`);
} else {
  for (const { beach } of iterBeaches(data)) delete beach.__showerVerdict;
  console.log(`\nMATCH ONLY — no data written. Review the report, then run: node scripts/linkShowersToBeaches.mjs apply`);
}
