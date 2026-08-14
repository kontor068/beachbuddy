// Adds the food that is demonstrably there, 14/08/2026 — no API, dry-run by default.
//
// The 6-region recheck measured the amenity claims in BOTH directions. Over-claiming came out
// at 1/402. Under-claiming is the real gap: beaches whose card says nothing about food while a
// NAMED taverna/canteen/cafe sits within 150 m of the pin (OSM, scripts/auditAmenitiesOsm.mjs
// --out .tmp/recheck/amen-<region>-nearby.json).
//
// Only the food phrase is added. Nothing here sets `organized` or invents a beach bar — a named
// canteen proves food, not sunbeds, and per the amenity mandate a false "beach bar" is worse
// than a miss. Wording comes from the vocabulary utils/localization.ts already renders:
//   "ταβέρνα κοντά" → «Ταβέρνες κοντά» · "καφέ κοντά" → «Καφέ κοντά» · "καντίνα κοντά" → «Καντίνα κοντά»
// A bar/pub is deliberately written as the weaker "καντίνα κοντά".
//
//   node scripts/applyFoodNearby2026-08.mjs           # dry run
//   node scripts/applyFoodNearby2026-08.mjs --write   # persist, then npm run build:beach-data
// Reverse by deleting the added phrase and its sourceNotes entry (both are dated 2026-08-14).
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-08-14';
const MAX_M = 150;
const REGIONS = ['peloponnese-lakonia-mainland', 'central-greece-evia', 'north-aegean-lesvos',
  'attica-kythira', 'attica-east-attica-mainland', 'south-aegean-kythnos'];

const PHRASE = {
  restaurant: 'ταβέρνα κοντά', fast_food_restaurant: 'ταβέρνα κοντά',
  cafe: 'καφέ κοντά', coffee_shop: 'καφέ κοντά',
  bar: 'καντίνα κοντά', pub: 'καντίνα κοντά',
};

// audit rows carry claimsFood (does our text already mention food?); the -nearby files carry the POIs
const rows = [], nearby = {};
for (const region of REGIONS) {
  const base = path.join(rootDir, '.tmp', 'recheck', `amen-${region}`);
  rows.push(...JSON.parse(readFileSync(`${base}.json`, 'utf8')));
  Object.assign(nearby, JSON.parse(readFileSync(`${base}-nearby.json`, 'utf8')));
}

const plan = new Map();
for (const row of rows) {
  if (row.claimsFood) continue;                                   // already says it
  const pois = (nearby[row.id] || [])
    .filter(p => PHRASE[p.primaryType] && p.d <= MAX_M && String(p.name || '').trim())
    .sort((a, b) => a.d - b.d);
  if (!pois.length) continue;
  const best = pois[0];
  // The OSM type is coarse: a canteen and a patisserie are both tagged "restaurant". The name is
  // the better witness, so it overrides — «Ταβέρνες κοντά» for a place called Kantina is a lie.
  const name = String(best.name);
  const phrase = /καντίν|καντιν|kantin|canteen/i.test(name) ? 'καντίνα κοντά'
    : /πίτσα|πιτσα|pizza|ζαχαροπλαστ|φούρνο|φουρνο|bakery/i.test(name) ? 'φαγητό κοντά'
    : PHRASE[best.primaryType];
  plan.set(row.id, { phrase, best, count: pois.length });
}

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = JSON.parse(readFileSync(sourcePath, 'utf8').replace(/^﻿/, ''));
const applied = [], skipped = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const item of node) walk(item); return; }
  if (!node || typeof node !== 'object') return;
  const p = plan.get(node.id);
  if (p && node.metadata) {
    const m = node.metadata;
    if (!Array.isArray(m.amenities)) m.amenities = [];
    if (m.amenities.some(a => String(a).includes(p.phrase.split(' ')[0]))) {
      skipped.push({ id: node.id, why: 'το λέει ήδη' });
    } else {
      m.amenities.push(p.phrase);
      const note = `Food-nearby ${STAMP} (OSM, no API): "${p.best.name}" (${p.best.primaryType}, ${p.best.d} m)${p.count > 1 ? ` +${p.count - 1} more` : ''} within ${MAX_M} m of the pin while the record claimed no food. Added "${p.phrase}" only — organized/beach-bar untouched.`;
      if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(note);
      else m.sourceNotes = (m.sourceNotes ? m.sourceNotes + ' ' : '') + note;
      applied.push({ id: node.id, name: node.name?.gr || node.name, phrase: p.phrase, poi: p.best });
    }
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(data);

for (const a of applied) console.log(`  #${a.id} ${String(a.name).padEnd(28)} + "${a.phrase}"   ← ${a.poi.name} (${a.poi.d}μ)`);
for (const s of skipped) console.log(`  #${s.id} παραλείφθηκε — ${s.why}`);
console.log(`\nΥποψήφιες: ${plan.size} · θα αλλάξουν: ${applied.length}`);

if (!applied.length) process.exit(0);
if (write) {
  writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Γράφτηκε ${path.relative(rootDir, sourcePath)}. Τρέξε npm run build:beach-data.`);
} else {
  console.log('Dry run — ξανατρέξε με --write.');
}
