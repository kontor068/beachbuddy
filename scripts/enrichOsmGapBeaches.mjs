// Follow-up enrichment for the OSM coverage-gap beaches (batch osm_coverage_gap_2026_06):
// upgrade the clean ones from coordinate-routing to Google PLACE routing (the beach card) and
// attach a popularity/crowd badge — using the Google identity already collected during the
// gap report's confirmation pass. Scoped: ONLY touches beaches with the batch tag.
//
//   node scripts/enrichOsmGapBeaches.mjs            # dry run (report only)
//   node scripts/enrichOsmGapBeaches.mjs --apply    # write googleMapsNavigation.place + popularity
//
// A beach is UPGRADED to place routing only if (same bar as auditGooglePlaceRouting --upgrade-scan):
//   - the seed's Google match is a beach/natural_feature (isBeachType) within 400 m of the pin,
//   - it has a placeId, and
//   - that placeId is not already used by another beach (collision guard).
// Otherwise it stays on coordinate routing (e.g. Porto Fino=service, Korfovonia=other, no match).
// Popularity is fetched fresh (rating + userRatingCount) only for the upgraded placeIds.
//
// After: npm run build:beach-data -> npm run quality:critical.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPlaceCache } from './lib/placeResolution.mjs';

// Same 5-tier thresholds as scripts/fetchBeachPopularity.mjs (inlined to avoid running its
// top-level main() on import).
const popularityTier = (count) => {
  const n = Number.isFinite(count) ? count : 0;
  if (n >= 1500) return 'crowded';
  if (n >= 400) return 'popular';
  if (n >= 100) return 'moderate';
  if (n >= 20) return 'quiet';
  return 'secluded';
};

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedArg = process.argv.find((a) => a.startsWith('--seed='));
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');
const SEED = seedArg ? path.resolve(rootDir, seedArg.slice('--seed='.length)) : path.join(rootDir, 'scripts', 'data', 'osm-gap-verified.json');
const popCachePath = path.join(rootDir, 'data', 'places-cache', 'google-popularity-cache.json'); // committed cache so re-runs never re-bill (was .tmp/, which gets wiped)

const BATCH = 'osm_coverage_gap_2026_06';
const NEAR_M = 400;
const CHECKED_AT = '2026-06-26';
const apply = process.argv.includes('--apply');

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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const placeDetails = async (placeId, key, cache) => {
  const cacheKey = `pop:${placeId}`;
  const hit = cache.get(cacheKey);
  if (hit !== undefined) return { ...hit, cached: true };
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=el&fields=rating,userRatingCount`, { headers: { 'X-Goog-Api-Key': key } });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));
  const out = { rating: json.rating ?? null, ratingCount: json.userRatingCount ?? 0 };
  cache.set(cacheKey, out);
  return { ...out, cached: false };
};

function* iterBeaches(data) {
  for (const sub of Object.values(data))
    for (const subSub of Object.values(sub))
      for (const arr of Object.values(subSub))
        if (Array.isArray(arr)) for (const beach of arr) yield beach;
}

const queryFor = (name, municipality) => `${name}, ${String(municipality || '').replace(/\s*\(.*\)\s*/g, '').trim()}`.replace(/,\s*$/, '');

const main = async () => {
  const data = JSON.parse(readFileSync(DATA, 'utf8'));
  const seed = JSON.parse(readFileSync(SEED, 'utf8')).beaches;
  const seedByUrl = new Map(seed.map((s) => [s.osmUrl, s]));

  // placeIds already in use by OTHER beaches (collision guard).
  const usedPlaceIds = new Set();
  for (const b of iterBeaches(data)) {
    const pid = b?.metadata?.googleMapsNavigation?.placeId;
    if (pid && b?.metadata?.batch !== BATCH) usedPlaceIds.add(pid);
  }

  const targets = [...iterBeaches(data)].filter((b) => b?.metadata?.batch === BATCH);
  console.log(`Batch ${BATCH}: ${targets.length} beaches.`);

  const key = readKey();
  if (apply && !key) { console.error('Missing GOOGLE_PLACES_API_KEY (env or .env.local).'); process.exit(1); }
  const cache = apply ? openPlaceCache(popCachePath) : null;

  const planned = [];
  let billed = 0;
  for (const b of targets) {
    const src = (b.metadata.sourceUrls || []).find((u) => seedByUrl.has(u));
    const seedRow = src ? seedByUrl.get(src) : null;
    const g = seedRow?.google;
    const reasonSkip = !g ? 'no-google-match'
      : !g.isBeachType ? `not-beach-type(${g.primaryType || 'other'})`
        : !g.placeId ? 'no-placeId'
          : g.distM > NEAR_M ? `too-far(${g.distM}m)`
            : usedPlaceIds.has(g.placeId) ? 'placeId-collision'
              : null;
    if (reasonSkip) { planned.push({ id: b.id, name: b.name, action: 'keep-coordinates', why: reasonSkip }); continue; }

    let pop = null;
    if (apply) {
      try {
        const d = await placeDetails(g.placeId, key, cache);
        if (!d.cached) { billed += 1; await sleep(120); }
        pop = { tier: popularityTier(d.ratingCount), rating: d.rating, ratingCount: d.ratingCount, source: 'google-places', checkedAt: CHECKED_AT };
      } catch (e) { process.stderr.write(`#${b.id} ${b.name}: ${e.message}\n`); }
    }

    if (apply) {
      b.metadata.googleMapsNavigation = { status: 'verified', mode: 'place', checkedAt: CHECKED_AT, method: 'osm-coverage-gap-google-v1', placeId: g.placeId, query: queryFor(b.name, seedRow.municipality) };
      if (pop) b.metadata.popularity = pop;
      usedPlaceIds.add(g.placeId);
    }
    planned.push({ id: b.id, name: b.name, action: 'place-route', placeId: g.placeId, ratingCount: pop?.ratingCount ?? g.ratingCount, tier: pop?.tier ?? popularityTier(g.ratingCount) });
  }

  if (apply) { cache.flush(); writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8'); }

  const upgraded = planned.filter((p) => p.action === 'place-route');
  const kept = planned.filter((p) => p.action === 'keep-coordinates');
  console.log(`\nPlace-routed (placeId + popularity): ${upgraded.length}`);
  for (const p of upgraded) console.log(`  ✓ #${p.id} ${p.name} — ${p.tier} (${p.ratingCount}★)`);
  console.log(`Kept on coordinates: ${kept.length}`);
  for (const p of kept) console.log(`  • #${p.id} ${p.name} — ${p.why}`);
  console.log(apply ? `\nApplied. Billed ~${billed} Place Details calls. Next: npm run build:beach-data -> npm run quality:critical` : `\n(dry run — pass --apply to write)`);
};

main().catch((e) => { console.error(e); process.exit(1); });
