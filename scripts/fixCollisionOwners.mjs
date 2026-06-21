// Correct placeId ownership across ALL 84 collision groups by NAME (not by nearest pin).
// A placeId belongs to the colliding member whose NAME matches the Google place; the original
// upgrade pass assigned it to the nearest PIN, which mis-fired on name-swaps (e.g. "Μούντα" #1112
// sits 60 m from "Παραλία Καμίνια" so it grabbed that card, while the real "Καμίνια" #1096 was left
// out). Rule per group: the member(s) whose name matches the place name are the rightful owners.
//   exactly 1 matcher -> that member holds the placeId (place mode); every other member -> coordinate.
//   0 or >1 matchers  -> leave the group as-is (current state is already safe: closest holds it,
//                        the rest were stripped to coordinate on 2026-06-21).
// Uses reports/place-resolution/google-upgrade{,-fixes}.json (place name+loc) — no Google calls.
//
// Run: node scripts/fixCollisionOwners.mjs           (dry-run)
//      node scripts/fixCollisionOwners.mjs --apply
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeText, distanceMeters } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const upDir = path.join(rootDir, 'reports', 'place-resolution');
const APPLY = process.argv.includes('--apply');
const date = '2026-06-21';

const fixes = JSON.parse(readFileSync(path.join(upDir, 'google-upgrade-fixes.json'), 'utf8'));
const up = JSON.parse(readFileSync(path.join(upDir, 'google-upgrade.json'), 'utf8'));
const upById = new Map(up.map(e => [e.id, e]));
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const byId = new Map();
const walk = (n) => { if (Array.isArray(n)) { for (const i of n) { if (Number.isInteger(i?.id)) byId.set(i.id, i); walk(i); } return; } if (n && typeof n === 'object') for (const v of Object.values(n)) walk(v); };
walk(source);

// qualifier guard (mirror resolveCollisionPlaceIds): a qualified beach only matches a same-qualifier place
const QGROUPS = [
  ['μικρο', 'μικρη', 'μικρος', 'μικρα', 'mikro', 'mikri', 'small', 'little'],
  ['μεγαλο', 'μεγαλη', 'μεγας', 'μεγαλα', 'megalo', 'megali', 'big', 'large'],
  ['βορειος', 'βορεια', 'βορειο', 'voreios', 'north'],
  ['νοτιος', 'νοτια', 'νοτιο', 'notios', 'south'],
  ['ανατολικος', 'ανατολικη', 'ανατολικο', 'east'],
  ['δυτικος', 'δυτικη', 'δυτικο', 'west'],
  ['γυμνιστων', 'γυμνιστικη', 'γυμνιστικης', 'nudist', 'nude', 'naturist'],
].map(g => new Set(g));
const toks = (s) => new Set(normalizeText(s).split(' ').filter(Boolean));
const qualifierOk = (beachName, placeName) => {
  const bt = toks(beachName), ct = toks(placeName);
  for (const g of QGROUPS) { if ([...g].some(t => bt.has(t)) && ![...g].some(t => ct.has(t))) return false; }
  return true;
};
const nameMatches = (beachName, placeName) => {
  const b = normalizeText(beachName), c = normalizeText(placeName);
  if (!b || !c) return false;
  return (c.includes(b) || b.includes(c)) && qualifierOk(beachName, placeName);
};
const beachName = (b) => (b?.name?.gr || b?.name?.en || b?.name || '').toString?.() || (typeof b?.name === 'string' ? b.name : '') ;
const grName = (b) => (b?.name && typeof b.name === 'object' ? (b.name.gr || b.name.en) : b?.name) || '';

// group fixes by placeId
const groups = new Map();
for (const f of fixes) { if (!f.placeId) continue; if (!groups.has(f.placeId)) groups.set(f.placeId, []); groups.get(f.placeId).push(f.id); }

const swaps = []; const stripsExtra = []; const ownerOk = []; const ambiguous = []; const farWarn = [];
for (const [placeId, ids] of groups) {
  if (ids.length < 2) continue;
  // canonical place = the member entry with min distM (its Google top is the place itself)
  const cents = ids.map(id => upById.get(id)).filter(e => e && e.placeId === placeId && e.top);
  if (!cents.length) continue;
  const place = cents.slice().sort((a, b) => (a.distM ?? 9e9) - (b.distM ?? 9e9))[0];
  const placeName = place.top.name; const placeLoc = place.top.loc;
  const members = ids.map(id => byId.get(id)).filter(Boolean);
  const matchers = members.filter(m => nameMatches(grName(m), placeName));
  const holder = members.find(m => m.metadata?.googleMapsNavigation?.placeId === placeId);
  if (matchers.length === 1) {
    const m = matchers[0];
    if (holder && holder.id === m.id) { ownerOk.push({ placeId, id: m.id, name: grName(m), placeName }); continue; }
    // SWAP: matcher should hold it; current holder (if any) loses it.
    const dM = placeLoc ? Math.round(distanceMeters({ lat: m.lat, lon: m.lon }, { lat: placeLoc.lat, lon: placeLoc.lon })) : null;
    swaps.push({ placeId, placeName, to: { id: m.id, name: grName(m), dM, query: `${grName(m)}, ${islandOf(m)}` }, from: holder ? { id: holder.id, name: grName(holder) } : null });
    if (dM != null && dM > 400) farWarn.push({ id: m.id, name: grName(m), placeName, dM });
  } else if (matchers.length === 0) {
    ambiguous.push({ placeId, placeName, members: members.map(m => `${m.id}:${grName(m)}`), reason: 'no member name matches place' });
  } else {
    ambiguous.push({ placeId, placeName, members: matchers.map(m => `${m.id}:${grName(m)}`), reason: 'multiple members match (same beach area)' });
  }
}

function islandOf(b) {
  return b.location?.island || b.location?.region || (b.metadata?.googleMapsNavigation?.query || '').split(',')[1]?.trim() || '';
}

console.log(`collision groups: ${[...groups.values()].filter(a => a.length > 1).length}`);
console.log(`OWNER_OK (correct member already holds it): ${ownerOk.length}`);
console.log(`AMBIGUOUS / multi-match (left as-is): ${ambiguous.length}`);
console.log(`\nSWAPS — placeId reassigned to the correctly-named member: ${swaps.length}`);
for (const s of swaps) console.log(`  ${s.placeId} "${s.placeName}"  ->  id${s.to.id} ${s.to.name} (${s.to.dM}m)   [was: ${s.from ? 'id' + s.from.id + ' ' + s.from.name : 'unowned'}]`);
console.log(`\n  of which pin is >400m from the card (pin-fix follow-up): ${farWarn.length}`);
for (const w of farWarn) console.log(`    id${w.id} ${w.name} -> "${w.placeName}" ${w.dM}m`);

if (APPLY && swaps.length) {
  let assigned = 0; let stripped = 0;
  const stripHolder = (s) => {
    if (!s.from) return; const h = byId.get(s.from.id);
    if (h?.metadata?.googleMapsNavigation?.placeId === s.placeId) {
      h.metadata.googleMapsNavigation = { status: 'verified', mode: 'coordinates', checkedAt: date, method: 'osm-nav-audit-v1', reason: `placeId removed 2026-06-21: this pin held "${s.placeName}", which by name belongs to ${s.to.name}; reverted to coordinate routing.` };
      stripped++;
    }
  };
  for (const s of swaps) {
    const clean = s.to.dM != null && s.to.dM <= 400;
    if (clean) {
      const m = byId.get(s.to.id);
      if (m?.metadata) { m.metadata.googleMapsNavigation = { status: 'verified', mode: 'place', checkedAt: date, method: 'osm-nav-audit-v1', placeId: s.placeId, query: s.to.query }; assigned++; }
      stripHolder(s);
    } else {
      // pin-far: do NOT assign a card the pin disagrees with; just remove the wrong card from the holder.
      stripHolder(s);
    }
  }
  writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
  console.log(`\nWROTE: ${assigned} placeIds reassigned to the correctly-named beach, ${stripped} wrong holders stripped. (${farWarn.length} pin-far matchers left on coordinate — pin-fix follow-up.)`);
} else console.log('\n(dry-run; pass --apply to write)');
