// Re-resolve CORRECT Google Place IDs for the 58 collision non-owners stripped on 2026-06-21
// (they had carried a *different* nearby beach's placeId). The original upgrade scan grabbed the
// nearest beach within 1500 m with NO name check — which is exactly how the collisions formed.
// This resolver is strict, so it never re-introduces a collision:
//   - candidate must be a beach (looksLikeBeach) within TIGHT_M of the pin,
//   - its name must MATCH the beach (scoreNameMatch) AND pass a qualifier guard
//     (a "Μικρό/Γυμνιστών/Βόρειος…" beach can only match a candidate with the same qualifier),
//   - stable across two calls (same place id),
//   - the placeId must NOT already be assigned to another beach in the dataset (anti-collision),
//   - and not the owner's id.
// Accepted -> place routing (placeId+query). Unresolved -> stay on coordinate routing (safe).
//
// Run: node scripts/resolveCollisionPlaceIds.mjs           (dry-run, writes report only)
//      node scripts/resolveCollisionPlaceIds.mjs --apply   (writes placeIds into public/greek_beaches.json)
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
const cachePath = path.join(rootDir, 'data', 'places-cache', 'google-places-cache.json'); // committed cache so re-runs never re-bill (was .tmp/, which gets wiped)
const APPLY = process.argv.includes('--apply');
// Accept a placeId only when the correctly-named Google beach sits within ACCEPT_M of our pin (so the
// Maps card and the in-app pin agree). A correctly-named beach 400 m–FAR_M away means our PIN is
// misplaced — recorded separately as a pin-fix follow-up, NOT silently assigned.
const ACCEPT_M = Number(process.env.ACCEPT_M || 400);
const FAR_M = 1500;
const date = '2026-06-21';

const readKey = () => {
  for (const k of ['GOOGLE_PLACES_API_KEY', 'GOOGLE_MAPS_API_KEY', 'GOOGLE_API_KEY']) if (process.env[k]) return process.env[k].trim();
  try { const m = readFileSync(path.join(rootDir, '.env.local'), 'utf8').match(/^(?:GOOGLE_PLACES_API_KEY|GOOGLE_MAPS_API_KEY|GOOGLE_API_KEY)=(.+)$/m); if (m) return m[1].trim(); } catch { /* */ }
  return undefined;
};

// --- beach-type gate (mirrors auditGooglePlaceRouting.mjs) -------------------
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

// --- qualifier guard --------------------------------------------------------
// If the beach name carries a distinguishing qualifier, the candidate name must carry the same one
// (gr OR en synonym). Prevents "Μικρό Χ" / "Χ Γυμνιστών" from matching the plain "Χ".
const QUALIFIER_GROUPS = [
  ['mikro', 'mikri', 'mikros', 'small', 'little'],          // and the Greek forms below (normalized greek kept too)
  ['megalo', 'megali', 'megas', 'big', 'large'],
  ['voreios', 'voreia', 'vorios', 'north', 'northern'],
  ['notios', 'notia', 'notio', 'south', 'southern'],
  ['anatolikos', 'anatoliki', 'anatoliko', 'east', 'eastern'],
  ['dytikos', 'dytiki', 'dytiko', 'west', 'western'],
  ['gymniston', 'gymnistiki', 'gymniston', 'nudist', 'nude', 'naturist'],
];
// add normalized-greek variants (normalizeText keeps greek letters, lowercased, accents stripped)
const QUAL_GR = [
  ['μικρο', 'μικρη', 'μικρος', 'μικρα'],
  ['μεγαλο', 'μεγαλη', 'μεγας', 'μεγαλα'],
  ['βορειος', 'βορεια', 'βορειο'],
  ['νοτιος', 'νοτια', 'νοτιο'],
  ['ανατολικος', 'ανατολικη', 'ανατολικο'],
  ['δυτικος', 'δυτικη', 'δυτικο'],
  ['γυμνιστων', 'γυμνιστικη', 'γυμνιστων', 'γυμνιστικης'],
];
const groupTokens = QUALIFIER_GROUPS.map((g, i) => new Set([...g, ...QUAL_GR[i]]));
const tokensOf = (s) => new Set(normalizeText(s).split(' ').filter(Boolean));
const qualifierGuardOk = (beachNames, candidateName) => {
  const bt = new Set(); for (const n of beachNames) for (const t of tokensOf(n)) bt.add(t);
  const ct = tokensOf(candidateName);
  for (const grp of groupTokens) {
    const beachHas = [...grp].some(t => bt.has(t));
    if (!beachHas) continue;
    const candHas = [...grp].some(t => ct.has(t));
    if (!candHas) return false; // beach is qualified but candidate is not -> reject
  }
  return true;
};

// scoreNameMatch-style: candidate name must reasonably contain the beach name
const nameMatchesBeach = (beachNames, candidateName) => {
  const cand = normalizeText(candidateName);
  return beachNames.some(n => { const nn = normalizeText(n); return nn && nn.length >= 3 && (cand.includes(nn) || nn.includes(cand)); });
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

const run = async () => {
  const key = readKey();
  if (!key) { console.error('Missing GOOGLE_PLACES_API_KEY'); process.exit(1); }

  // The 58 = source beaches stripped on 2026-06-21 (reason marker).
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  const usedPlaceIds = new Set();
  const ownerIdByStripped = new Map();
  const strippedIds = new Set();
  const walk = (n) => {
    if (Array.isArray(n)) { for (const i of n) { collect(i); walk(i); } return; }
    if (n && typeof n === 'object') for (const v of Object.values(n)) walk(v);
  };
  const collect = (i) => {
    if (!i || !Number.isInteger(i.id)) return;
    const nav = i.metadata?.googleMapsNavigation;
    if (nav?.placeId) usedPlaceIds.add(nav.placeId);
    if (nav?.mode === 'coordinates' && typeof nav?.reason === 'string' && nav.reason.includes('placeId removed 2026-06-21')) strippedIds.add(i.id);
  };
  walk(source);
  console.log(`stripped (target) beaches: ${strippedIds.size} | placeIds currently in use: ${usedPlaceIds.size}`);

  // Region context (island token) + coordinates come from the built app data.
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const targets = [];
  for (const region of index.regions) {
    const dataPath = path.join(publicDir, (region.appDataPath || region.dataPath).replace(/^\//, ''));
    let data; try { data = JSON.parse(await readFile(dataPath, 'utf8')); } catch { continue; }
    for (const beach of (data?.island?.beaches || [])) if (strippedIds.has(beach.id)) targets.push({ region, beach });
  }
  console.log(`matched in app data: ${targets.length}`);

  const cache = openPlaceCache(cachePath);
  const rows = [];
  let billed = 0;
  for (const { region, beach } of targets) {
    const coord = getCoordinate(beach);
    const beachNames = [beach.name?.gr, beach.name?.en, getBeachName(beach)].filter(Boolean);
    const ladder = buildNameQueryLadder(beach, region);
    // Find the nearest correctly-named, collision-free beach candidate within FAR_M (any ladder form).
    const nameMatched = (p) => looksLikeBeach(p) && nameMatchesBeach(beachNames, p.displayName?.text) && qualifierGuardOk(beachNames, p.displayName?.text) && p.id && !usedPlaceIds.has(p.id);
    let best = null;     // nearest name-matched candidate (for accept or far-report)
    for (const q of ladder) {
      const ck = `col:${q}`;
      let listA = cache.get(ck);
      if (listA === undefined) { listA = await searchOnce(q, key); billed += 1; cache.set(ck, listA); await sleep(260); }
      const cands = (listA || []).map(p => ({ p, d: (coord && p.location) ? distanceMeters(coord, { lat: p.location.latitude, lon: p.location.longitude }) : Infinity }))
        .filter(x => Number.isFinite(x.d) && x.d <= FAR_M && nameMatched(x.p))
        .sort((a, b) => a.d - b.d);
      if (cands.length && (!best || cands[0].d < best.d)) best = { p: cands[0].p, d: cands[0].d, query: q };
      if (best && best.d <= ACCEPT_M) break; // good enough — a close, correctly-named place
    }
    let chosen = null; let farCandidate = null;
    if (best && best.d <= ACCEPT_M) {
      // stability: a second call on the winning query must return the same id near the pin
      const ckB = `col2:${best.query}`;
      let listB = cache.get(ckB);
      if (listB === undefined) { listB = await searchOnce(best.query, key); billed += 1; cache.set(ckB, listB); await sleep(260); }
      const ok = (listB || []).some(p => p.id === best.p.id && p.location && distanceMeters(coord, { lat: p.location.latitude, lon: p.location.longitude }) <= FAR_M);
      if (ok) chosen = { placeId: best.p.id, gname: best.p.displayName?.text, d: Math.round(best.d), query: best.query };
    } else if (best) {
      farCandidate = { placeId: best.p.id, gname: best.p.displayName?.text, d: Math.round(best.d), query: best.query };
    }
    if (chosen) usedPlaceIds.add(chosen.placeId); // prevent two targets grabbing the same id
    rows.push({ id: beach.id, name: getBeachName(beach), island: region.prefecture, resolved: Boolean(chosen), ...(chosen || {}), farCandidate });
    cache.flush();
  }
  cache.flush();

  const resolved = rows.filter(r => r.resolved);
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'collision-placeid-reresolve.json'), JSON.stringify(rows, null, 1), 'utf8');
  const farOnes = rows.filter(r => !r.resolved && r.farCandidate);
  console.log(`\nGoogle calls billed: ~${billed}`);
  console.log(`RESOLVED ${resolved.length}/${rows.length} with a correct, collision-free placeId (<=${ACCEPT_M}m, pin & card agree):`);
  for (const r of resolved) console.log(`  id${r.id} ${r.name} [${r.island}] -> ${r.placeId}  (google "${r.gname}", ${r.d}m)`);
  console.log(`\nPIN-MISPLACED follow-up — correctly-named Google beach exists but ${ACCEPT_M}-${FAR_M}m from our pin (needs a pin fix, NOT auto-assigned): ${farOnes.length}`);
  for (const r of farOnes) console.log(`  id${r.id} ${r.name} [${r.island}] -> google "${r.farCandidate.gname}" ${r.farCandidate.d}m (${r.farCandidate.placeId})`);
  const noPlace = rows.filter(r => !r.resolved && !r.farCandidate);
  console.log(`\nNO distinct Google beach place (coordinate routing is correct): ${noPlace.length}`);
  for (const r of noPlace) console.log(`  id${r.id} ${r.name} [${r.island}]`);

  if (APPLY && resolved.length) {
    const byId = new Map();
    const w2 = (n) => { if (Array.isArray(n)) { for (const i of n) { if (Number.isInteger(i?.id)) byId.set(i.id, i); w2(i); } return; } if (n && typeof n === 'object') for (const v of Object.values(n)) w2(v); };
    w2(source);
    for (const r of resolved) {
      const b = byId.get(r.id); if (!b?.metadata) continue;
      b.metadata.googleMapsNavigation = { status: 'verified', mode: 'place', checkedAt: date, method: 'osm-nav-audit-v1', placeId: r.placeId, query: r.query };
    }
    writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
    console.log(`\nWROTE ${resolved.length} placeIds into public/greek_beaches.json`);
  } else console.log('\n(dry-run; pass --apply to write)');
};
run().catch(e => { console.error(e); process.exit(1); });
