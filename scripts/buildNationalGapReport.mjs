// Build the national beach-coverage GAP report: which OSM beaches we are missing, and where.
//
//   npm run coverage:report                  # match + classify + prioritise (no billing)
//   npm run coverage:report -- --google      # + Google Places confirm on genuine gaps (bills)
//   npm run coverage:report -- --google --google-limit=300
//
// Reads the OSM harvest (scripts/data/osm-beaches-national.json) and our dataset
// (public/greek_beaches.json), matches every OSM candidate against our beaches using
// the SAME thresholds + classifier as `audit:beaches` (via scripts/lib/beachCoverage.mjs),
// and emits a prioritised gap report. Read-only: it never writes greek_beaches.json.
//
// Classification (shared with the audit):
//   nearest <= 250m                      -> covered          (drop)
//   same-name but > 1000m away           -> coordinate_mismatch (our pin may be wrong; NOT a new beach)
//   different name <= 750m               -> possible_alias_or_nearby_section
//   different name <= 1500m              -> possible_nearby_missing_or_alias
//   nothing within 1500m                 -> likely_missing_beach_candidate   (the real gap)
// Plus: OSM candidates already adjudicated as accepted sections / deferred (nudist) are
// suppressed so the report doesn't re-surface decisions the team already made.
//
// Output:
//   reports/coverage/national-gap-report.json
//   reports/coverage/national-gap-report.md
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPlaceCache } from './lib/placeResolution.mjs';
import {
  coverageNearbyMatchMeters,
  coveragePossibleAliasMeters,
  coverageNeedsSourceReviewMeters,
  coverageCoordinateMismatchMeters,
  isFiniteNumber,
  getLocalizedName,
  getCoverageNameKeys,
  hasSpecificCoverageName,
  nameKeySetsOverlap,
  haversineMeters,
  getExternalCandidateReview,
  externalCoverageReviewDecisions,
  halkidikiAcceptedSectionUrls,
  rhodesAcceptedSectionUrls,
  thesprotiaAcceptedSectionUrls,
  thessalonikiAcceptedSectionUrls,
} from './lib/beachCoverage.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const harvestPath = path.join(rootDir, 'scripts', 'data', 'osm-beaches-national.json');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const cachePath = path.join(rootDir, 'data', 'places-cache', 'google-coverage-cache.json'); // committed cache so re-runs never re-bill (was .tmp/, which gets wiped)
const jsonOutPath = path.join(rootDir, 'reports', 'coverage', 'national-gap-report.json');
const mdOutPath = path.join(rootDir, 'reports', 'coverage', 'national-gap-report.md');

const GOOGLE_CONFIRM_METERS = 400; // a Google place this close to the OSM pin confirms a real beach
const ISOLATED_METERS = 3000;      // gap this far from any of our beaches -> flag for extra scrutiny

// Tier-1 tourism units (island/area names as they appear at the municipality level). A gap on a
// heavily-visited island matters more than one on a remote islet, so these get a priority boost.
const TIER1_UNITS = new Set([
  'milos', 'naxos', 'paros', 'mykonos', 'santorini', 'thira', 'ios', 'syros', 'tinos', 'andros',
  'rhodes', 'rodos', 'kos', 'karpathos', 'corfu', 'kerkyra', 'kefalonia', 'cephalonia', 'zakynthos',
  'zante', 'lefkada', 'lefkas', 'chania', 'rethymno', 'heraklion', 'irakleio', 'lasithi',
  'halkidiki', 'chalkidiki', 'kassandra', 'sithonia', 'thassos', 'thasos', 'skiathos', 'skopelos',
  'crete', 'lefkimmi',
]);

const slugify = value => String(value || '')
  .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const parseArgs = argv => {
  const args = { google: false, googleLimit: Infinity };
  for (const raw of argv.slice(2)) {
    if (raw === '--google') args.google = true;
    else if (raw.startsWith('--google-limit=')) args.googleLimit = Number.parseInt(raw.slice('--google-limit='.length), 10) || Infinity;
  }
  return args;
};

const readKey = () => {
  for (const k of ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY']) {
    if (process.env[k]) return process.env[k].trim();
  }
  try {
    const m = readFileSync(path.join(rootDir, '.env.local'), 'utf8')
      .match(/^(?:GOOGLE_PLACES_API_KEY|GOOGLE_MAPS_API_KEY|GOOGLE_API_KEY)=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* none */ }
  return undefined;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Flatten Region -> Prefecture -> Municipality -> Beach[] into matchable rows.
const buildExistingIndex = data => {
  const rows = [];
  for (const [region, prefectures] of Object.entries(data)) {
    for (const [prefecture, municipalities] of Object.entries(prefectures || {})) {
      for (const [municipality, beaches] of Object.entries(municipalities || {})) {
        for (const beach of beaches || []) {
          if (!isFiniteNumber(beach?.lat) || !isFiniteNumber(beach?.lon)) continue;
          const aliases = Array.isArray(beach?.metadata?.aliases) ? beach.metadata.aliases : [];
          rows.push({
            beach,
            region,
            prefecture,
            municipality,
            coordinates: { lat: beach.lat, lon: beach.lon },
            nameKeys: getCoverageNameKeys([getLocalizedName(beach.name), ...aliases]),
          });
        }
      }
    }
  }
  return rows;
};

const adjudicatedUrls = new Set([
  ...externalCoverageReviewDecisions.keys(),
  ...halkidikiAcceptedSectionUrls,
  ...rhodesAcceptedSectionUrls,
  ...thesprotiaAcceptedSectionUrls,
  ...thessalonikiAcceptedSectionUrls,
]);

const getCandidateFlags = candidate => {
  const flags = [];
  const tags = candidate.tags || {};
  const name = `${candidate.displayName || ''} ${candidate.name || ''}`.toLowerCase();
  if (tags.nudism || /gymniston|gymnistion|nudist/.test(name)) flags.push('nudist');
  const access = String(tags.access || '').toLowerCase();
  if (tags.fee === 'yes' || access === 'private' || access === 'customers' || access === 'permit') flags.push('private');
  const isNaturalBeach = tags.natural === 'beach';
  if (!isNaturalBeach && (tags.leisure === 'beach_resort' || tags.tourism === 'beach_resort')) flags.push('resort_only');
  if (!hasSpecificCoverageName(candidate.name)) flags.push('generic_name');
  return flags;
};

// Google Text Search near the OSM pin: confirms a real, visited beach and yields ratingCount + placeId.
const googleConfirm = async (candidate, key, cache) => {
  const cacheKey = `cov:${candidate.osmId || candidate.id}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return { ...hit, cached: true };

  const { lat, lon } = candidate.coordinates;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.types,places.userRatingCount',
    },
    body: JSON.stringify({
      textQuery: `${candidate.name} παραλία`,
      languageCode: 'el',
      locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 1500 } },
      maxResultCount: 5,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));

  let best = null;
  for (const place of json.places || []) {
    const ploc = place.location;
    if (!ploc) continue;
    const dist = haversineMeters({ lat, lon }, { lat: ploc.latitude, lon: ploc.longitude });
    const isBeachy = place.primaryType === 'beach'
      || (Array.isArray(place.types) && place.types.some(t => t === 'beach' || t === 'natural_feature'));
    if (dist <= GOOGLE_CONFIRM_METERS && (best === null || dist < best.distanceMeters)) {
      best = {
        confirmed: true,
        placeId: place.id,
        googleName: place.displayName?.text || null,
        ratingCount: place.userRatingCount ?? 0,
        primaryType: place.primaryType || null,
        isBeachType: isBeachy,
        distanceMeters: Number(dist.toFixed(1)),
      };
    }
  }
  const out = best || { confirmed: false, placeId: null, googleName: null, ratingCount: 0, isBeachType: false };
  cache.set(cacheKey, out);
  return { ...out, cached: false };
};

const priorityFor = (record) => {
  let score = 0;
  if (TIER1_UNITS.has(slugify(record.assignedMunicipality))) score += 30;
  if (!record.flags.includes('generic_name')) score += 15;
  if (record.nearestExistingBeach && record.nearestExistingBeach.distanceMeters <= 1200) score += 10; // near our existing coverage -> safe add
  if (record.flags.includes('nudist')) score -= 25;
  if (record.flags.includes('private')) score -= 20;
  if (record.flags.includes('resort_only')) score -= 25;
  if (record.flags.includes('isolated')) score -= 10;
  if (record.google) {
    if (record.google.confirmed && record.google.isBeachType) score += 30;
    else if (record.google.confirmed) score += 15;
    if (record.google.ratingCount >= 200) score += 20;
    else if (record.google.ratingCount >= 30) score += 10;
    if (record.google.confirmed === false) score -= 15; // searched but Google has no beach there
  }
  const tier = score >= 45 ? 'high' : score >= 20 ? 'medium' : 'low';
  return { score, tier };
};

const classify = (candidate, existing) => {
  let nearest = null;
  let sameName = null;
  const candidateNameKeys = new Set(candidate.nameKeys || []);
  for (const row of existing) {
    const distanceMeters = haversineMeters(candidate.coordinates, row.coordinates);
    if (nearest === null || distanceMeters < nearest.distanceMeters) {
      nearest = { ...row, distanceMeters };
    }
    if (candidateNameKeys.size && nameKeySetsOverlap(row.nameKeys, candidateNameKeys)) {
      if (sameName === null || distanceMeters < sameName.distanceMeters) {
        sameName = { ...row, distanceMeters };
      }
    }
  }

  if (adjudicatedUrls.has(candidate.sourceUrl)) {
    return { classification: 'pre_adjudicated_section', nearest, sameName };
  }
  if (nearest && nearest.distanceMeters <= coverageNearbyMatchMeters) {
    return { classification: 'covered', nearest, sameName };
  }
  const review = getExternalCandidateReview({ candidate, nearestBeach: nearest, sameNameBeach: sameName });
  return { classification: review.issueType, nearest, sameName };
};

const blank = () => ({ existing: 0, osmInArea: 0, covered: 0, likelyMissing: 0, possibleAlias: 0, coordinateMismatch: 0, sourceReview: 0, preAdjudicated: 0 });

const tallyInto = (bucket, classification) => {
  bucket.osmInArea += 1;
  if (classification === 'covered') bucket.covered += 1;
  else if (classification === 'likely_missing_beach_candidate') bucket.likelyMissing += 1;
  else if (classification === 'possible_alias_or_nearby_section') bucket.possibleAlias += 1;
  else if (classification === 'possible_nearby_missing_or_alias') bucket.sourceReview += 1;
  else if (classification === 'external_coordinate_mismatch_candidate' || classification === 'external_coordinate_precision_candidate') bucket.coordinateMismatch += 1;
  else if (classification === 'pre_adjudicated_section') bucket.preAdjudicated += 1;
};

const main = async () => {
  const args = parseArgs(process.argv);
  const harvest = JSON.parse(await readFile(harvestPath, 'utf8'));
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const existing = buildExistingIndex(source);
  const candidates = harvest.candidates || [];
  console.log(`Matching ${candidates.length} OSM candidates (scope=${harvest.scope}) against ${existing.length} existing beaches…`);

  const byRegion = new Map();
  const byMunicipality = new Map();
  // seed existing counts so coverage% is meaningful even where OSM found nothing
  for (const row of existing) {
    if (!byRegion.has(row.region)) byRegion.set(row.region, blank());
    byRegion.get(row.region).existing += 1;
    const mKey = `${row.region} › ${row.municipality}`;
    if (!byMunicipality.has(mKey)) byMunicipality.set(mKey, { region: row.region, municipality: row.municipality, ...blank() });
    byMunicipality.get(mKey).existing += 1;
  }

  const records = [];
  for (const candidate of candidates) {
    const { classification, nearest, sameName } = classify(candidate, existing);
    const assignedRegion = nearest?.region || 'Unknown';
    const assignedPrefecture = nearest?.prefecture || 'Unknown';
    const assignedMunicipality = nearest?.municipality || 'Unknown';

    if (!byRegion.has(assignedRegion)) byRegion.set(assignedRegion, blank());
    tallyInto(byRegion.get(assignedRegion), classification);
    const mKey = `${assignedRegion} › ${assignedMunicipality}`;
    if (!byMunicipality.has(mKey)) byMunicipality.set(mKey, { region: assignedRegion, municipality: assignedMunicipality, ...blank() });
    tallyInto(byMunicipality.get(mKey), classification);

    const flags = getCandidateFlags(candidate);
    if (nearest && nearest.distanceMeters > ISOLATED_METERS) flags.push('isolated');

    records.push({
      osmId: candidate.id,
      osmUrl: candidate.sourceUrl,
      name: candidate.name,
      displayName: candidate.displayName,
      coordinates: candidate.coordinates,
      classification,
      assignedRegion,
      assignedPrefecture,
      assignedMunicipality,
      nearestExistingBeach: nearest ? {
        id: nearest.beach.id,
        name: getLocalizedName(nearest.beach.name),
        distanceMeters: Number(nearest.distanceMeters.toFixed(1)),
      } : null,
      sameNameBeach: sameName ? {
        id: sameName.beach.id,
        name: getLocalizedName(sameName.beach.name),
        distanceMeters: Number(sameName.distanceMeters.toFixed(1)),
      } : null,
      tags: candidate.tags || {},
      flags,
      google: null,
    });
  }

  const genuineGaps = records.filter(r => r.classification === 'likely_missing_beach_candidate');

  // Optional Google confirmation, only on genuine gaps (cost control).
  let googleBilled = 0;
  if (args.google) {
    const key = readKey();
    if (!key) { console.error('Missing GOOGLE_PLACES_API_KEY (env or .env.local).'); process.exit(1); }
    const cache = openPlaceCache(cachePath);
    if (cache.size() > 0) console.log(`Google cache: ${cache.size()} entries reused.`);
    const targets = Number.isFinite(args.googleLimit) ? genuineGaps.slice(0, args.googleLimit) : genuineGaps;
    console.log(`Google-confirming ${targets.length} genuine-gap candidates…`);
    let done = 0;
    for (const record of targets) {
      try {
        const g = await googleConfirm(record, key, cache);
        record.google = g;
        if (!g.cached) { googleBilled += 1; await sleep(120); }
      } catch (e) { process.stderr.write(`${record.displayName}: ${e.message}\n`); }
      if (++done % 100 === 0) { cache.flush(); process.stderr.write(`...${done}/${targets.length} (billed ~${googleBilled})\n`); }
    }
    cache.flush();
  }

  // Prioritise every record (genuine gaps drive the report; others kept for completeness).
  for (const record of records) {
    const { score, tier } = priorityFor(record);
    record.priorityScore = score;
    record.priorityTier = tier;
  }
  records.sort((a, b) => b.priorityScore - a.priorityScore || a.assignedRegion.localeCompare(b.assignedRegion));

  const summaryByRegion = [...byRegion.entries()]
    .map(([region, b]) => ({ region, ...b, coveragePct: b.osmInArea ? Number(((b.covered / b.osmInArea) * 100).toFixed(1)) : null }))
    .sort((a, b) => b.likelyMissing - a.likelyMissing);
  const summaryByMunicipality = [...byMunicipality.values()]
    .map(b => ({ ...b, coveragePct: b.osmInArea ? Number(((b.covered / b.osmInArea) * 100).toFixed(1)) : null }))
    .sort((a, b) => b.likelyMissing - a.likelyMissing);

  const counts = records.reduce((acc, r) => { acc[r.classification] = (acc[r.classification] || 0) + 1; return acc; }, {});
  const tierCounts = genuineGaps.reduce((acc, r) => { acc[r.priorityTier] = (acc[r.priorityTier] || 0) + 1; return acc; }, {});

  const meta = {
    generatedAt: new Date().toISOString(),
    harvestScope: harvest.scope,
    harvestGeneratedAt: harvest.generatedAt,
    existingBeaches: existing.length,
    osmCandidates: candidates.length,
    classifications: counts,
    genuineGaps: genuineGaps.length,
    genuineGapTiers: tierCounts,
    googleConfirmed: args.google,
    googleBilled,
    thresholds: { coverageNearbyMatchMeters, coveragePossibleAliasMeters, coverageNeedsSourceReviewMeters, coverageCoordinateMismatchMeters },
  };

  await mkdir(path.dirname(jsonOutPath), { recursive: true });
  await writeFile(jsonOutPath, `${JSON.stringify({ _meta: meta, summaryByRegion, summaryByMunicipality, candidates: records }, null, 2)}\n`, 'utf8');
  await writeFile(mdOutPath, renderMarkdown({ meta, summaryByRegion, summaryByMunicipality, records, genuineGaps }), 'utf8');

  console.log(`\nExisting: ${existing.length} | OSM candidates: ${candidates.length}`);
  console.log(`Covered: ${counts.covered || 0} | Genuine gaps: ${genuineGaps.length} (${JSON.stringify(tierCounts)})`);
  console.log(`Aliases/sections: ${(counts.possible_alias_or_nearby_section || 0) + (counts.possible_nearby_missing_or_alias || 0)} | Coordinate review: ${(counts.external_coordinate_mismatch_candidate || 0) + (counts.external_coordinate_precision_candidate || 0)} | Pre-adjudicated: ${counts.pre_adjudicated_section || 0}`);
  console.log(`Wrote -> ${path.relative(rootDir, mdOutPath)}`);
  console.log(`Wrote -> ${path.relative(rootDir, jsonOutPath)}`);
};

const renderMarkdown = ({ meta, summaryByRegion, summaryByMunicipality, records, genuineGaps }) => {
  const lines = [];
  const osmLink = r => `[OSM](${r.osmUrl})`;
  lines.push('# National Beach-Coverage Gap Report');
  lines.push('');
  lines.push(`Generated ${meta.generatedAt} · harvest scope: \`${meta.harvestScope}\``);
  lines.push('');
  lines.push('## Εθνικά σύνολα');
  lines.push('');
  lines.push(`- Δικές μας παραλίες: **${meta.existingBeaches}**`);
  lines.push(`- OSM υποψήφιοι (named) στη σάρωση: **${meta.osmCandidates}**`);
  lines.push(`- Ήδη καλυμμένες (≤${meta.thresholds.coverageNearbyMatchMeters}m): **${meta.classifications.covered || 0}**`);
  lines.push(`- **Γνήσια κενά (likely missing): ${meta.genuineGaps}** — high: ${meta.genuineGapTiers.high || 0}, medium: ${meta.genuineGapTiers.medium || 0}, low: ${meta.genuineGapTiers.low || 0}`);
  lines.push(`- Πιθανά aliases/τμήματα: ${(meta.classifications.possible_alias_or_nearby_section || 0) + (meta.classifications.possible_nearby_missing_or_alias || 0)}`);
  lines.push(`- Για έλεγχο συντεταγμένων (same-name μακριά): ${(meta.classifications.external_coordinate_mismatch_candidate || 0) + (meta.classifications.external_coordinate_precision_candidate || 0)}`);
  lines.push(`- Ήδη αξιολογημένα τμήματα (suppressed): ${meta.classifications.pre_adjudicated_section || 0}`);
  if (!meta.googleConfirmed) lines.push(`- _Google confirmation: off (τρέξε \`-- --google\` για επιβεβαίωση + ratingCount στα γνήσια κενά)_`);
  lines.push('');

  lines.push('## Πού υστερούμε — ανά νησί/δήμο (top 40 by likely-missing)');
  lines.push('');
  lines.push('| Νησί/Δήμος | Περιφέρεια | Δικές μας | OSM | Καλυμμένες | **Λείπουν** | Aliases | Coord-review |');
  lines.push('|---|---|--:|--:|--:|--:|--:|--:|');
  for (const m of summaryByMunicipality.filter(x => x.likelyMissing > 0).slice(0, 40)) {
    lines.push(`| ${m.municipality} | ${m.region} | ${m.existing} | ${m.osmInArea} | ${m.covered} | **${m.likelyMissing}** | ${m.possibleAlias + m.sourceReview} | ${m.coordinateMismatch} |`);
  }
  lines.push('');

  lines.push('## Ανά περιφέρεια');
  lines.push('');
  lines.push('| Περιφέρεια | Δικές μας | OSM | Καλυμμένες | **Λείπουν** | Aliases | Coord-review | Coverage % |');
  lines.push('|---|--:|--:|--:|--:|--:|--:|--:|');
  for (const r of summaryByRegion) {
    lines.push(`| ${r.region} | ${r.existing} | ${r.osmInArea} | ${r.covered} | **${r.likelyMissing}** | ${r.possibleAlias + r.sourceReview} | ${r.coordinateMismatch} | ${r.coveragePct ?? '—'} |`);
  }
  lines.push('');

  lines.push('## Top γνήσια κενά (priority high → low)');
  lines.push('');
  const top = genuineGaps.slice().sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 80);
  lines.push('| Όνομα | Νησί/Δήμος | Tier | Score | Κοντινότερη δική μας | Flags | Google | Link |');
  lines.push('|---|---|---|--:|---|---|---|---|');
  for (const r of top) {
    const near = r.nearestExistingBeach ? `${r.nearestExistingBeach.name} (${Math.round(r.nearestExistingBeach.distanceMeters)}m)` : '—';
    const g = r.google ? (r.google.confirmed ? `✓ ${r.google.ratingCount}★` : '✗') : '';
    lines.push(`| ${r.displayName} | ${r.assignedMunicipality} | ${r.priorityTier} | ${r.priorityScore} | ${near} | ${r.flags.join(',') || '—'} | ${g} | ${osmLink(r)} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('_Report-only. No beach was added. Promote per region with the (future) `coverage:insert` step after human review._');
  lines.push('');
  return lines.join('\n');
};

main().catch(err => { console.error(err); process.exit(1); });
