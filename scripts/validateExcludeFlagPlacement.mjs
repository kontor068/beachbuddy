#!/usr/bin/env node
/**
 * ΠΥΛΗ: η σημαία απόκρυψης πρέπει να είναι εκεί που τη διαβάζει ο κώδικας.
 *
 * Το `excludeFromApp` κρύβει μια παραλία από όλο το site. Ο μόνος αναγνώστης του είναι το
 * buildBeachRegionData.mjs:1001 — `beach.metadata?.excludeFromApp === true`. Γραμμένο ένα
 * επίπεδο πιο πάνω, στη ρίζα της εγγραφής δίπλα στο lat/lon, δεν το βλέπει κανείς.
 *
 * Μετρημένο 25/08/2026: εννιά εγγραφές είχαν ακριβώς αυτό — ανάμεσά τους ένα διπλότυπο
 * («Ακτή Παναγίας Φανερωμένης», ίδια παραλία με την κάρτα Φανερωμένης Αντιπάρου) και μία
 * που οι πηγές τη βάζουν σε άλλο νησί. Σερβίρονταν κανονικά για μήνες. Το σφάλμα είναι
 * αόρατο σε ανάγνωση — η εγγραφή φαίνεται σωστή, απλώς ο κώδικας κοιτάει αλλού — γι' αυτό
 * χρειάζεται πύλη και όχι προσοχή.
 *
 * Χρήση:  node scripts/validateExcludeFlagPlacement.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = JSON.parse(readFileSync(path.join(rootDir, 'public', 'greek_beaches.json'), 'utf8'));

const orphaned = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (node.excludeFromApp === true && node.id !== undefined && node.lat !== undefined
      && node.metadata?.excludeFromApp !== true) {
    orphaned.push({ id: node.id, name: node.name, reason: node.excludeReason || node.exclusionReason || '' });
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (!orphaned.length) {
  console.log('Σημαίες απόκρυψης: όλες μέσα στο metadata, εκεί που τις διαβάζει ο builder.');
  process.exit(0);
}

console.error(`${orphaned.length} σημαία/ες excludeFromApp στη ΡΙΖΑ της εγγραφής — ο builder δεν τις βλέπει:`);
for (const o of orphaned) {
  console.error(`  #${o.id} ${o.name}${o.reason ? ` — «${o.reason}»` : ' — χωρίς γραμμένο λόγο'}`);
}
console.error('\nΜετακίνησέ τες με: node scripts/fixRootLevelExcludeFlag.mjs --write');
console.error('Αν μια σημαία δεν έχει λόγο, γράψε πρώτα τον λόγο — απόκρυψη χωρίς αιτιολογία δεν είναι απόφαση.');
process.exit(1);
