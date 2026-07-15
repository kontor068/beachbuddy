/**
 * Recover Google Place IDs for the FALSE-NEGATIVE class of coordinate-routed beaches.
 *
 * Background: the nationwide Google ground-truth pass (reports/place-resolution/google-upgrade.json)
 * queried each beach as "<name>, <island>" and UPGRADED to Place-ID routing only on a clean beach
 * PASS. 674 beaches stayed on coordinates: 228 WRONG_TYPE (query hit a non-beach near the pin),
 * 420 WRONG_PLACE (a beach, but far), 14 UNSTABLE, 12 NO_RESULT. Some of those are FALSE negatives:
 * a real Google beach place DOES exist, but our query missed it because our dataset spells the name
 * differently from Google. The canonical case is "Σίσσια" (double sigma, the MONASTERY's spelling) —
 * Google returns the monastery (place_of_worship), we correctly reject it, and fall back to a bare
 * coordinate. The real beach card is "Σίσια FKK" (single sigma), a string our ladder never tried.
 *
 * This script re-queries ONLY those coordinate-routed non-PASS beaches with a wider spelling ladder
 * (double-consonant collapse σσ→σ etc., latin/beach-word variants) and upgrades a beach to Place-ID
 * routing ONLY when a NEW variant yields a STABLE beach Place ID within --far of the pin.
 *
 * COST SAFETY (this key was disabled after a runaway-billing incident):
 *   - DRY RUN by default: no API key needed, no calls. Reports reuse vs. would-bill counts.
 *   - Reuses the ALREADY-PAID results in google-upgrade.json (keyed by query string) — a query we
 *     already ran never re-bills.
 *   - --live requires GOOGLE_PLACES_API_KEY in the ENV (never read from the disabled .env.local line)
 *     and is HARD-CAPPED by --max-calls. Every new call is disk-cached (gpq: keys) so a resumed run
 *     never re-bills. The cap is a categorical backstop against another runaway.
 *
 * Read-only on beach data. Emits reports/place-resolution/placeid-recovery-fixes.json (apply via
 * scripts/applyNavigationAudit.mjs --apply-status) + placeid-recovery-report.json (full trace).
 *
 * Usage:
 *   node scripts/recoverPlaceIdFalseNegatives.mjs                # dry run, all target statuses
 *   node scripts/recoverPlaceIdFalseNegatives.mjs --status=WRONG_TYPE,UNSTABLE
 *   GOOGLE_PLACES_API_KEY=... node scripts/recoverPlaceIdFalseNegatives.mjs --live --max-calls=400
 *     [--near=400] [--far=800] [--limit=N] [--sleep-ms=250] [--max-variants=3]
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getBeachName, getCoordinate, buildPlaceQuery, distanceMeters, openPlaceCache,
  scoreNameMatch, normalizeText,
} from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');
const upgradeReportPath = path.join(outDir, 'google-upgrade.json');
const cachePath = path.join(rootDir, 'data', 'places-cache', 'google-places-cache.json');

const args = { live: false, maxCalls: 400, near: 400, far: 800, limit: undefined, onlyId: undefined, sleepMs: 250, maxVariants: 3, statuses: ['WRONG_TYPE', 'UNSTABLE', 'WRONG_PLACE', 'NO_RESULT'] };
for (const a of process.argv.slice(2)) {
  if (a === '--live') args.live = true;
  else if (a.startsWith('--max-calls=')) args.maxCalls = Number.parseInt(a.slice(12), 10);
  else if (a.startsWith('--near=')) args.near = Number.parseInt(a.slice(7), 10);
  else if (a.startsWith('--far=')) args.far = Number.parseInt(a.slice(6), 10);
  else if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.slice(8), 10);
  else if (a.startsWith('--only-id=')) args.onlyId = Number.parseInt(a.slice(10), 10);
  else if (a.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(a.slice(11), 10);
  else if (a.startsWith('--max-variants=')) args.maxVariants = Number.parseInt(a.slice(15), 10);
  else if (a.startsWith('--status=')) args.statuses = a.slice(9).split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const date = new Date().toISOString().slice(0, 10);

// Key ONLY from the environment. We deliberately do NOT read .env.local: the key there is commented
// out to keep billing off, and this script must never silently re-enable it.
const readKey = () => {
  for (const k of ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY']) {
    if (process.env[k] && process.env[k].trim()) return process.env[k].trim();
  }
  return undefined;
};

// ---- beach-type classification (verbatim policy from auditGooglePlaceRouting.mjs) ----------------
const SOFT_BEACHY = new Set(['tourist_attraction', 'point_of_interest', 'locality', 'natural_feature', 'scenic_spot']);
const NON_BEACH_FEATURE = new Set(['lake', 'river', 'mountain', 'mountain_peak', 'plateau', 'volcano', 'cape']);
const BUSINESS_TYPES = new Set([
  'bar', 'restaurant', 'cafe', 'night_club', 'resort_hotel', 'hotel', 'lodging', 'food',
  'sports_club', 'sports_complex', 'sports_activity_location', 'service', 'store', 'spa', 'gym',
  'banquet_hall', 'event_venue', 'bus_stop', 'transit_station', 'transportation_service',
  'parking', 'travel_agency', 'real_estate_agency',
]);
const nameSaysBeach = (name) => /(^|\s)(παραλία|παραλια|beach)(\s|$)|beach$/i.test(String(name || '').trim());
const looksLikeBeach = (place) => {
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  if ([...types].some(t => BUSINESS_TYPES.has(t))) return false;
  if ([...types].some(t => NON_BEACH_FEATURE.has(t))) return false;
  if (place.primaryType === 'beach' || types.has('beach')) return true;
  if (nameSaysBeach(place.displayName?.text) && [...types].some(t => SOFT_BEACHY.has(t))) return true;
  return false;
};

// ---- one Text Search call (same field mask / SKU tier as the main audit) -------------------------
const callBilled = { n: 0 };
const googleSearchOnce = async (query, key) => {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.types',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'el' }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 140));
  return json.places || [];
};

// nearest actual beach within `far` of the pin (falls back to nearest of any type)
const pickBeachCandidate = (places, coord, far) => {
  if (!places || !places.length) return null;
  const withDist = places.map(p => ({
    p,
    distM: coord && p.location ? Math.round(distanceMeters(coord, { lat: p.location.latitude, lon: p.location.longitude })) : null,
  }));
  const beaches = withDist
    .filter(x => looksLikeBeach(x.p) && Number.isFinite(x.distM) && x.distM <= far)
    .sort((a, b) => a.distM - b.distM);
  if (beaches.length) return beaches[0];
  return withDist.slice().sort((a, b) => (a.distM ?? 9e9) - (b.distM ?? 9e9))[0] || null;
};

// ---- spelling / latin variant ladder -------------------------------------------------------------
// The double-consonant collapse (σσ→σ, λλ→λ, …) is the Σίσσια→Σίσια fix; the latin+beach forms catch
// beaches whose Google card is titled in English. All variants are validated against the pin before
// anything is upgraded, so a loose variant can only ever CONFIRM a real nearby beach, never invent one.
const GREEK_DOUBLES = /(σσ|λλ|νν|ππ|ττ|κκ|μμ|ρρ|ββ|φφ|θθ|δδ)/g;
const LATIN_DOUBLES = /(ss|ll|nn|pp|tt|kk|mm|rr|bb|ff|zz|cc|dd)/gi;
const collapseDoubles = (s, re) => String(s || '').replace(re, m => m[0]);

// Reuse the CLEANED location suffix from the base query (buildPlaceQuery already stripped dataset
// noise like "(mainland)"), so variants inherit a Maps-parseable "..., <island>" tail.
const locationSuffix = (baseQuery, beach, region) => {
  const i = String(baseQuery || '').indexOf(',');
  if (i > 0) return baseQuery.slice(i); // ", Kefalonia"
  const island = (beach.location?.island || beach.location?.region || region.prefecture || region.name?.en || '').trim();
  return island ? `, ${island}` : '';
};

const buildVariantQueries = (beach, region, baseQuery, alreadyTried) => {
  const suffix = locationSuffix(baseQuery, beach, region);
  if (!suffix) return [];
  const gr = (beach.name?.gr || '').trim();
  const en = (beach.name?.en || '').trim();
  const grCollapsed = collapseDoubles(gr, GREEK_DOUBLES);
  const enCollapsed = collapseDoubles(en, LATIN_DOUBLES);

  const nameForms = [];
  if (grCollapsed && grCollapsed !== gr) nameForms.push(grCollapsed);            // Σίσσια -> Σίσια  (top yield)
  if (en && normalizeText(en) !== normalizeText(gr)) nameForms.push(en);         // latin name as-is
  if (enCollapsed && enCollapsed.toLowerCase() !== en.toLowerCase()) nameForms.push(enCollapsed); // Sissia -> Sisia

  const queries = [];
  const seen = new Set([normalizeText(baseQuery), ...alreadyTried.map(q => normalizeText(q))]);
  const pushQ = (q) => {
    const key = normalizeText(q);
    if (!key || seen.has(key)) return;
    seen.add(key);
    queries.push(q);
  };
  // Plain name forms first (highest yield), then a "<name> beach" fallback for cards titled "X Beach".
  for (const form of nameForms) pushQ(`${form}${suffix}`);
  for (const form of nameForms) pushQ(`${form} beach${suffix}`);
  return queries.slice(0, args.maxVariants);
};

const run = async () => {
  const key = args.live ? readKey() : undefined;
  if (args.live && !key) {
    console.error('--live needs GOOGLE_PLACES_API_KEY in the environment (never read from .env.local).');
    process.exit(1);
  }

  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const regionById = new Map(index.regions.map(r => [r.id, r]));

  // Load every beach so we can read live nav state + names.
  const beachById = new Map();
  for (const region of index.regions) {
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data; try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    const beaches = Array.isArray(data) ? data : (data?.island?.beaches || []);
    for (const b of beaches) beachById.set(b.id, { beach: b, region });
  }

  // Reuse map: every query string we've ALREADY paid for -> its stored result. A query in here never
  // re-bills. Reconstruct a place object from the report's `top` + `placeId`.
  const report = JSON.parse(await readFile(upgradeReportPath, 'utf8'));
  const reuseByQuery = new Map();
  const reportById = new Map();
  for (const r of report) {
    reportById.set(r.id, r);
    if (r.query && !reuseByQuery.has(r.query)) {
      reuseByQuery.set(r.query, {
        place: r.placeId ? {
          id: r.placeId,
          displayName: { text: r.top?.name },
          primaryType: r.top?.primaryType,
          types: r.top?.types || [],
          location: r.top?.loc ? { latitude: r.top.loc.lat, longitude: r.top.loc.lon } : undefined,
        } : null,
        distM: r.distM ?? null,
      });
    }
  }

  // Candidates: report rows in a target status whose beach is STILL coordinate-routed (no placeId).
  const candidates = [];
  for (const r of report) {
    if (args.onlyId != null && r.id !== args.onlyId) continue;   // single-beach probe
    if (!args.onlyId && !args.statuses.includes(r.status)) continue;
    const entry = beachById.get(r.id);
    if (!entry) continue;
    const nav = entry.beach.metadata?.googleMapsNavigation;
    if (nav?.placeId) continue;               // already fixed elsewhere
    candidates.push(entry);
  }
  const scoped = Number.isInteger(args.limit) && args.limit > 0 ? candidates.slice(0, args.limit) : candidates;
  console.log(`Target statuses: ${args.statuses.join(',')}`);
  console.log(`Coordinate-routed non-PASS candidates: ${scoped.length}${args.live ? '' : '  (DRY RUN — no API calls)'}`);

  const cache = openPlaceCache(cachePath);
  const cacheKey = (q) => `gpq:el:${q}`;

  // Resolve one query: reuse (free) | disk-cache (free) | live call (billed, capped). Returns
  // { list, source } where list is the candidate places (single reconstructed place for reuse).
  const resolveQuery = async (q) => {
    if (reuseByQuery.has(q)) {
      const hit = reuseByQuery.get(q);
      return { list: hit.place ? [hit.place] : [], source: 'reuse' };
    }
    const ck = cacheKey(q);
    const cached = cache.get(ck);
    if (cached !== undefined) return { list: cached, source: 'cache' };
    if (!args.live) return { list: null, source: 'would-bill' };
    if (callBilled.n >= args.maxCalls) return { list: null, source: 'cap-reached' };
    const list = await googleSearchOnce(q, key); callBilled.n += 1;
    cache.set(ck, list); cache.flush();
    await sleep(args.sleepMs);
    return { list, source: 'billed' };
  };

  const results = [];
  let recovered = 0; let wouldBill = 0; let reuseHits = 0; let capHit = false;
  let done = 0;
  for (const { beach, region } of scoped) {
    const coord = getCoordinate(beach);
    const base = buildPlaceQuery(beach, region);
    const priorQuery = reportById.get(beach.id)?.query;
    const variants = buildVariantQueries(beach, region, base, [base, priorQuery].filter(Boolean));
    const trace = { id: beach.id, name: getBeachName(beach), region: region.id, status: reportById.get(beach.id)?.status, base, variants, outcome: 'no-new-place', tried: [] };

    if (!coord || !variants.length) { trace.outcome = variants.length ? 'no-coord' : 'no-variant'; results.push(trace); if (++done % 50 === 0) process.stderr.write(`...${done}/${scoped.length} (billed ${callBilled.n})\n`); continue; }

    let picked = null;
    for (const q of variants) {
      const { list, source } = await resolveQuery(q);
      if (source === 'would-bill') { wouldBill += 1; trace.tried.push({ q, source }); continue; }
      if (source === 'cap-reached') { capHit = true; trace.tried.push({ q, source }); break; }
      if (source === 'reuse') reuseHits += 1;
      const cand = pickBeachCandidate(list, coord, args.far);
      const isBeach = cand && looksLikeBeach(cand.p) && Number.isFinite(cand.distM) && cand.distM <= args.far && cand.p.id;
      trace.tried.push({ q, source, got: cand?.p?.displayName?.text, type: cand?.p?.primaryType, distM: cand?.distM, isBeach: Boolean(isBeach) });
      if (!isBeach) continue;

      // Confirm the Place ID is stable (second live call) unless it came from paid/cached data,
      // which we already trust. A wrong Place ID is worse than a coordinate, so name similarity or a
      // very close pin is required too.
      let stable = source !== 'billed';
      if (source === 'billed') {
        const { list: listB } = await resolveQuery(q);
        const candB = pickBeachCandidate(listB, coord, args.far);
        stable = Boolean(candB?.p?.id && candB.p.id === cand.p.id);
      }
      const nameScore = scoreNameMatch(beach, cand.p).score;
      const nameOk = nameScore >= 18 || cand.distM <= 150;
      if (stable && nameOk) {
        picked = { q, place: cand.p, distM: cand.distM, nameScore };
        break;
      }
      trace.tried[trace.tried.length - 1].rejected = !stable ? 'unstable' : 'weak-name';
    }

    if (picked) {
      recovered += 1;
      trace.outcome = 'recovered';
      trace.recovered = { placeId: picked.place.id, name: picked.place.displayName?.text, query: picked.q, distM: picked.distM, nameScore: picked.nameScore };
    }
    results.push(trace);
    if (++done % 50 === 0) process.stderr.write(`...${done}/${scoped.length} (billed ${callBilled.n})\n`);
    if (capHit) { console.error(`\nHIT --max-calls cap (${args.maxCalls}) — stopping early, partial result written.`); break; }
  }
  cache.flush();

  const fixes = results.filter(t => t.outcome === 'recovered').map(t => {
    const { beach } = beachById.get(t.id);
    const coord = getCoordinate(beach);
    return {
      id: t.id, name: t.name, lat: coord.lat, lon: coord.lon,
      navMode: 'place', status: 'verified', query: t.recovered.query, placeId: t.recovered.placeId,
      why: `Place-ID recovery ${date}: base query "${t.base}" was ${t.status} on Google, but variant "${t.recovered.query}" resolved to the beach card ${t.recovered.name} (Place ID ${t.recovered.placeId}, ${t.recovered.distM} m from the pin) — route to the exact Google card via query_place_id.`,
    };
  });

  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'placeid-recovery-report.json'), JSON.stringify(results, null, 1), 'utf8');
  await writeFile(path.join(outDir, 'placeid-recovery-fixes.json'), JSON.stringify(fixes, null, 1), 'utf8');

  console.log('\n---- summary ----');
  console.log(`candidates scanned : ${done}`);
  console.log(`reuse hits (free)  : ${reuseHits}`);
  if (args.live) console.log(`NEW calls billed   : ${callBilled.n} (cap ${args.maxCalls})`);
  else console.log(`would bill (new)   : ${wouldBill} distinct-variant lookups  ->  est. $${(wouldBill * 0.035).toFixed(2)} at ~$0.035/call`);
  console.log(`Place IDs recovered: ${recovered}`);
  console.log(`Wrote reports/place-resolution/placeid-recovery-{report,fixes}.json`);
  if (!args.live) console.log('\nDRY RUN. To execute: GOOGLE_PLACES_API_KEY=... node scripts/recoverPlaceIdFalseNegatives.mjs --live --max-calls=<N>');
};

run().catch(err => { console.error(err); process.exit(1); });
