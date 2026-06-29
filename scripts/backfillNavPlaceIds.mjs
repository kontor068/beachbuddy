// Backfill Google Place IDs for beaches that currently drop a RAW COORDINATE pin in Google Maps
// instead of opening the named place card. Target set (no nav.placeId today):
//   - boat-access beaches (access.type boat_only / boat_or_difficult_path) — 123 of them, 0 had a
//     placeId, so "show on map" always landed a bare pin near (not on) the beach; and
//   - verified place-mode records (status='verified', mode='place') carrying no placeId/query —
//     they claim place routing but silently fall back to a coordinate (the validator now flags these).
// Surfaced by the Red Beach (Santorini) "the pin doesn't land on the real beach" report.
//
// Strictness mirrors scripts/resolveCollisionPlaceIds.mjs so we never assign a wrong/colliding id:
//   candidate must look like a beach, name-match (+ qualifier guard), sit within ACCEPT_M of our pin,
//   be stable across two calls, and not already be used by another beach. Accepted -> place routing
//   (placeId + query). A correctly-named beach ACCEPT_M..FAR_M away is reported as a PIN-FIX follow-up,
//   never auto-assigned. Everything else stays on safe coordinate routing.
//
// Run: node scripts/backfillNavPlaceIds.mjs            (dry-run, writes report only)
//      node scripts/backfillNavPlaceIds.mjs --apply    (writes placeIds into public/greek_beaches.json)
//      ACCEPT_M=250 node scripts/backfillNavPlaceIds.mjs   (override accept radius)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBeachName, getCoordinate, distanceMeters, normalizeText, openPlaceCache, buildNameQueryLadder } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(rootDir, 'public');
const indexPath = path.join(publicDir, 'data', 'beaches', 'index.json');
const sourcePath = path.join(publicDir, 'greek_beaches.json');
const outDir = path.join(rootDir, 'reports', 'place-resolution');
const cachePath = path.join(rootDir, '.tmp', 'google-places-cache.json');
const APPLY = process.argv.includes('--apply');
const ACCEPT_M = Number(process.env.ACCEPT_M || 250);
const FAR_M = 1500;
const date = new Date().toISOString().slice(0, 10);
const method = 'places-backfill-v1';

const readKey = () => {
  for (const k of ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY']) if (process.env[k]) return process.env[k].trim();
  try { const m = readFileSync(path.join(rootDir, '.env.local'), 'utf8').match(/^(?:GOOGLE_PLACES_API_KEY|GOOGLE_MAPS_API_KEY|GOOGLE_API_KEY)=(.+)$/m); if (m) return m[1].trim(); } catch { /* */ }
  return undefined;
};

// --- beach-type gate (mirrors resolveCollisionPlaceIds.mjs) -----------------
const SOFT_BEACHY = new Set(['tourist_attraction', 'point_of_interest', 'locality', 'natural_feature', 'scenic_spot']);
const NON_BEACH_FEATURE = new Set(['lake', 'river', 'mountain', 'mountain_peak', 'plateau', 'volcano', 'cape']);
const BUSINESS_TYPES = new Set(['bar', 'restaurant', 'cafe', 'night_club', 'resort_hotel', 'hotel', 'lodging', 'food', 'sports_club', 'sports_complex', 'sports_activity_location', 'service', 'store', 'spa', 'gym', 'banquet_hall', 'event_venue', 'bus_stop', 'transit_station', 'transportation_service', 'parking', 'travel_agency', 'real_estate_agency']);
const nameSaysBeach = (name) => /(^|\s)(παραλία|παραλια|beach)(\s|$)|beach$/i.test(String(name || '').trim());
const looksLikeBeach = (place) => {
  const types = new Set([place.primaryType, ...(place.types || [])].filter(Boolean));
  if ([...types].some(t => BUSINESS_TYPES.has(t))) return false;
  if ([...types].some(t => NON_BEACH_FEATURE.has(t))) return false;
  if (place.primaryType === 'beach' || types.has('beach')) return true;
  if (nameSaysBeach(place.displayName?.text) && [...types].some(t => SOFT_BEACHY.has(t))) return true;
  return false;
};

// --- name + qualifier guard (mirrors resolveCollisionPlaceIds.mjs) ----------
const nameMatchesBeach = (beachNames, candidateName) => {
  const cand = normalizeText(candidateName);
  return beachNames.some(n => { const nn = normalizeText(n); return nn && nn.length >= 3 && (cand.includes(nn) || nn.includes(cand)); });
};
const QUALIFIER_GROUPS = [
  ['mikro', 'mikri', 'mikros', 'small', 'little'],
  ['megalo', 'megali', 'megas', 'big', 'large'],
  ['voreios', 'voreia', 'vorios', 'north', 'northern'],
  ['notios', 'notia', 'notio', 'south', 'southern'],
  ['anatolikos', 'anatoliki', 'anatoliko', 'east', 'eastern'],
  ['dytikos', 'dytiki', 'dytiko', 'west', 'western'],
  ['gymniston', 'gymnistiki', 'nudist', 'nude', 'naturist'],
];
const QUAL_GR = [
  ['μικρο', 'μικρη', 'μικρος', 'μικρα'],
  ['μεγαλο', 'μεγαλη', 'μεγας', 'μεγαλα'],
  ['βορειος', 'βορεια', 'βορειο'],
  ['νοτιος', 'νοτια', 'νοτιο'],
  ['ανατολικος', 'ανατολικη', 'ανατολικο'],
  ['δυτικος', 'δυτικη', 'δυτικο'],
  ['γυμνιστων', 'γυμνιστικη', 'γυμνιστικης'],
];
const groupTokens = QUALIFIER_GROUPS.map((g, i) => new Set([...g, ...QUAL_GR[i]]));
const tokensOf = (s) => new Set(normalizeText(s).split(' ').filter(Boolean));
const qualifierGuardOk = (beachNames, candidateName) => {
  const bt = new Set(); for (const n of beachNames) for (const t of tokensOf(n)) bt.add(t);
  const ct = tokensOf(candidateName);
  for (const grp of groupTokens) {
    if (![...grp].some(t => bt.has(t))) continue;
    if (![...grp].some(t => ct.has(t))) return false;
  }
  return true;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const searchOnce = async (query, key) => {
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.primaryType,places.types' },
    body: JSON.stringify({ textQuery: query, languageCode: 'el' }),
  });
  const json = await res.json().catch(() => ({}));
  if (json.error) throw new Error(`${json.error.status}: ${json.error.message || ''}`.slice(0, 120));
  return json.places || [];
};

const isTarget = (b) => {
  const nav = b?.metadata?.googleMapsNavigation;
  if (nav?.placeId) return false; // already resolved
  const acc = b?.metadata?.access?.type;
  if (acc === 'boat_only' || acc === 'boat_or_difficult_path') return true;
  if (nav?.status === 'verified' && nav?.mode === 'place') return true; // place-mode, no placeId
  if (b?.id === 2062) return true; // Red Beach (Santorini) — explicitly in scope
  return false;
};

const run = async () => {
  const key = readKey();
  if (!key) { console.error('Missing GOOGLE_PLACES_API_KEY (.env.local)'); process.exit(1); }

  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const usedPlaceIds = new Set();
  const targetIds = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) { for (const i of n) { collect(i); walk(i); } return; }
    if (n && typeof n === 'object') for (const v of Object.values(n)) walk(v);
  };
  const collect = (i) => {
    if (!i || !Number.isInteger(i.id)) return;
    const pid = i.metadata?.googleMapsNavigation?.placeId;
    if (pid) usedPlaceIds.add(pid);
    if (isTarget(i)) targetIds.add(i.id);
  };
  walk(source);
  console.log(`target beaches (no placeId; boat-access or verified place-mode): ${targetIds.size} | placeIds in use: ${usedPlaceIds.size}`);

  // Region context (island token) + coordinates come from the built app data.
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const targets = [];
  for (const region of index.regions) {
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data; try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    for (const beach of (data?.island?.beaches || [])) if (targetIds.has(beach.id)) targets.push({ region, beach });
  }
  console.log(`matched in app data: ${targets.length}`);

  const cache = openPlaceCache(cachePath);
  const rows = [];
  let billed = 0;
  for (const { region, beach } of targets) {
    const coord = getCoordinate(beach);
    const beachNames = [beach.name?.gr, beach.name?.en, getBeachName(beach)].filter(Boolean);
    const ladder = buildNameQueryLadder(beach, region);
    const nameMatched = (p) => looksLikeBeach(p) && nameMatchesBeach(beachNames, p.displayName?.text) && qualifierGuardOk(beachNames, p.displayName?.text) && p.id && !usedPlaceIds.has(p.id);
    let best = null;
    for (const q of ladder) {
      const ck = `bf:${q}`;
      let listA = cache.get(ck);
      if (listA === undefined) { listA = await searchOnce(q, key); billed += 1; cache.set(ck, listA); await sleep(260); }
      const cands = (listA || []).map(p => ({ p, d: (coord && p.location) ? distanceMeters(coord, { lat: p.location.latitude, lon: p.location.longitude }) : Infinity }))
        .filter(x => Number.isFinite(x.d) && x.d <= FAR_M && nameMatched(x.p))
        .sort((a, b) => a.d - b.d);
      if (cands.length && (!best || cands[0].d < best.d)) best = { p: cands[0].p, d: cands[0].d, query: q };
      if (best && best.d <= ACCEPT_M) break;
    }
    let chosen = null; let farCandidate = null;
    if (best && best.d <= ACCEPT_M) {
      const ckB = `bf2:${best.query}`;
      let listB = cache.get(ckB);
      if (listB === undefined) { listB = await searchOnce(best.query, key); billed += 1; cache.set(ckB, listB); await sleep(260); }
      const ok = (listB || []).some(p => p.id === best.p.id && p.location && distanceMeters(coord, { lat: p.location.latitude, lon: p.location.longitude }) <= FAR_M);
      if (ok) chosen = { placeId: best.p.id, gname: best.p.displayName?.text, d: Math.round(best.d), query: best.query };
    } else if (best) {
      farCandidate = { placeId: best.p.id, gname: best.p.displayName?.text, d: Math.round(best.d), query: best.query };
    }
    if (chosen) usedPlaceIds.add(chosen.placeId);
    rows.push({ id: beach.id, name: getBeachName(beach), island: region.prefecture, resolved: Boolean(chosen), ...(chosen || {}), farCandidate });
    cache.flush();
  }
  cache.flush();

  const resolved = rows.filter(r => r.resolved);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'nav-placeid-backfill.json'), JSON.stringify(rows, null, 1), 'utf8');
  const farOnes = rows.filter(r => !r.resolved && r.farCandidate);
  const noPlace = rows.filter(r => !r.resolved && !r.farCandidate);
  console.log(`\nGoogle calls billed: ~${billed}`);
  console.log(`RESOLVED ${resolved.length}/${rows.length} (<=${ACCEPT_M}m, pin & card agree):`);
  for (const r of resolved) console.log(`  id${r.id} ${r.name} [${r.island}] -> ${r.placeId}  (google "${r.gname}", ${r.d}m)`);
  console.log(`\nPIN-MISPLACED follow-up — named beach exists ${ACCEPT_M}-${FAR_M}m from our pin (review, NOT auto-assigned): ${farOnes.length}`);
  for (const r of farOnes) console.log(`  id${r.id} ${r.name} [${r.island}] -> google "${r.farCandidate.gname}" ${r.farCandidate.d}m`);
  console.log(`\nNO distinct Google beach place (coordinate routing stays correct): ${noPlace.length}`);

  if (APPLY && resolved.length) {
    const byId = new Map();
    const w2 = (n) => { if (Array.isArray(n)) { for (const i of n) { if (Number.isInteger(i?.id)) byId.set(i.id, i); w2(i); } return; } if (n && typeof n === 'object') for (const v of Object.values(n)) w2(v); };
    w2(source);
    for (const r of resolved) {
      const b = byId.get(r.id); if (!b?.metadata) continue;
      b.metadata.googleMapsNavigation = { status: 'verified', mode: 'place', checkedAt: date, method, placeId: r.placeId, query: r.query };
    }
    writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
    console.log(`\nWROTE ${resolved.length} placeIds into public/greek_beaches.json (run npm run build:beach-data + quality:beach-data)`);
  } else console.log('\n(dry-run; pass --apply to write)');
};
run().catch(e => { console.error(e); process.exit(1); });
