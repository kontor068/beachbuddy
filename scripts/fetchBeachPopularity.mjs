/**
 * Popularity/crowd badge data from Google. For every beach that already carries a verified Google
 * Place ID (metadata.googleMapsNavigation.placeId — collected by auditGooglePlaceRouting), fetch
 * Place Details (rating + userRatingCount) and derive a 5-tier crowd badge:
 *
 *   userRatingCount  | tier        | label (el)
 *   < 20 (or none)   | secluded    | Απομονωμένη
 *   20 – 99          | quiet       | Ήσυχη
 *   100 – 399        | moderate    | Μέτρια κίνηση
 *   400 – 1499       | popular     | Δημοφιλής
 *   >= 1500          | crowded     | Πολυσύχναστη
 *
 * The review count is a stable proxy for how visited a beach is ("θα έχει κόσμο;") — not live, but
 * reliable and free given we already hold the Place IDs. Only beaches with a verified placeId get a
 * badge (trustworthy Google identity); others are left without popularity data.
 *
 * Writes metadata.popularity = { tier, rating, ratingCount, source:'google-places', checkedAt }.
 * Cached in .tmp/google-popularity-cache.json (gitignored) so re-runs are free. Place Details
 * rating/userRatingCount is the Pro SKU.
 *
 * Usage:
 *   node scripts/fetchBeachPopularity.mjs            # fetch + cache (no write)
 *   node scripts/fetchBeachPopularity.mjs --apply    # also write metadata.popularity into greek_beaches.json
 *   node scripts/fetchBeachPopularity.mjs --limit=50 [--sleep-ms=120]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPlaceCache } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const cachePath = path.join(rootDir, '.tmp', 'google-popularity-cache.json');

const args = { apply: false, limit: undefined, sleepMs: 120 };
for (const a of process.argv.slice(2)) {
  if (a === '--apply') args.apply = true;
  else if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.slice(8), 10);
  else if (a.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(a.slice(11), 10);
}

const readKey = () => {
  for (const k of ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY']) {
    if (process.env[k]) return process.env[k].trim();
  }
  try {
    const m = readFileSync(path.join(rootDir, '.env.local'), 'utf8').match(/^(?:GOOGLE_PLACES_API_KEY|GOOGLE_MAPS_API_KEY|GOOGLE_API_KEY)=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* none */ }
  return undefined;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const date = new Date().toISOString().slice(0, 10);

// 5-tier thresholds (user-approved, derived from the real nationwide distribution).
export const popularityTier = (count) => {
  const n = Number.isFinite(count) ? count : 0;
  if (n >= 1500) return 'crowded';
  if (n >= 400) return 'popular';
  if (n >= 100) return 'moderate';
  if (n >= 20) return 'quiet';
  return 'secluded';
};

const placeDetails = async (placeId, key, cache) => {
  const cacheKey = `pop:${placeId}`;
  if (cache) {
    const hit = cache.get(cacheKey);
    if (hit !== undefined) return { ...hit, cached: true };
  }
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=el&fields=rating,userRatingCount`, {
    headers: { 'X-Goog-Api-Key': key },
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));
  const out = { rating: json.rating ?? null, ratingCount: json.userRatingCount ?? 0 };
  if (cache) cache.set(cacheKey, out);
  return { ...out, cached: false };
};

const run = async () => {
  const key = readKey();
  if (!key) { console.error('Missing GOOGLE_PLACES_API_KEY (env or .env.local).'); process.exit(1); }

  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const targets = [];
  const walk = (n) => {
    if (Array.isArray(n)) {
      for (const b of n) {
        const pid = b?.metadata?.googleMapsNavigation?.placeId;
        if (pid && Number.isInteger(b.id)) targets.push(b);
      }
      return;
    }
    if (n && typeof n === 'object') for (const v of Object.values(n)) walk(v);
  };
  walk(source);
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? targets.slice(0, args.limit) : targets;
  console.log(`Beaches with a Place ID: ${targets.length}${scoped.length !== targets.length ? ` (limited to ${scoped.length})` : ''}`);

  const cache = openPlaceCache(cachePath);
  if (cache.size() > 0) console.log(`Popularity cache: ${cache.size()} entries (reused, no re-bill).`);

  let billed = 0; let done = 0; let applied = 0;
  const tierCounts = {};
  for (const beach of scoped) {
    const pid = beach.metadata.googleMapsNavigation.placeId;
    try {
      const d = await placeDetails(pid, key, cache);
      if (!d.cached) { billed += 1; await sleep(args.sleepMs); }
      const tier = popularityTier(d.ratingCount);
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
      if (args.apply) {
        beach.metadata.popularity = {
          tier,
          rating: d.rating,
          ratingCount: d.ratingCount,
          source: 'google-places',
          checkedAt: date,
        };
        applied += 1;
      }
    } catch (e) {
      process.stderr.write(`#${beach.id} ${e.message}\n`);
    }
    if (++done % 100 === 0) { cache.flush(); process.stderr.write(`...${done}/${scoped.length} (billed ~${billed})\n`); }
  }
  cache.flush();

  console.log('Tier distribution:', JSON.stringify(tierCounts));
  console.log(`Billed (new Place Details calls): ~${billed}`);
  if (args.apply) {
    writeFileSync(sourcePath, JSON.stringify(source, null, 2));
    console.log(`Applied metadata.popularity to ${applied} beaches -> ${path.relative(rootDir, sourcePath)}`);
  } else {
    console.log('(dry run — pass --apply to write metadata.popularity)');
  }
};

run().catch(err => { console.error(err); process.exit(1); });
