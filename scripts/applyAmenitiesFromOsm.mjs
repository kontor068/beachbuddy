#!/usr/bin/env node
/**
 * ΚΕΝΗ ΛΙΣΤΑ ΠΑΡΟΧΩΝ ΔΕΝ ΣΗΜΑΙΝΕΙ «ΤΙΠΟΤΑ ΕΚΕΙ» — ΣΗΜΑΙΝΕΙ «ΔΕΝ ΚΟΙΤΑΞΕ ΚΑΝΕΙΣ»
 *
 * 102 από τις 185 παραλίες που μπήκαν πρόσφατα έχουν άδεια λίστα παροχών, και ο πίνακας
 * ποιότητας τις μετράει σωστά ως κενό. Ο έλεγχος auditAmenitiesOsm.mjs κατεβάζει ήδη τα σημεία
 * ενδιαφέροντος γύρω από κάθε πινέζα — απλώς τα χρησιμοποιούσε μόνο για να ΕΛΕΓΞΕΙ όσες
 * δηλώνουν κάτι, ποτέ για να συμπληρώσει όσες δεν δηλώνουν τίποτα. Μετρημένο στο Πήλιο 17/08:
 * 15 από τις 32 άδειες έχουν όντως μαγαζιά γύρω τους, η Αγιά Θυμιά 8 σημεία με το κοντινότερο
 * φαγητό στα 45 μέτρα.
 *
 * ΓΙΑΤΙ ΟΙ ΠΥΛΕΣ ΕΙΝΑΙ ΣΦΙΧΤΕΣ — Η ΕΝΤΟΛΗ ΑΞΙΟΠΙΣΤΙΑΣ ΛΕΕΙ «ΥΠΟ-ΔΗΛΩΝΕ».
 * Ένα μοναδικό ανώνυμο σημείο στα 600 m δεν είναι παροχή αυτής της παραλίας· είναι ένα μαγαζί
 * κάπου στο χωριό. Οπότε μια κατηγορία δηλώνεται μόνο όταν:
 *   · υπάρχουν ΤΟΥΛΑΧΙΣΤΟΝ ΔΥΟ σημεία της μέσα σε 250 m, Ή
 *   · υπάρχει ΕΝΑ ΜΕ ΟΝΟΜΑ μέσα σε 150 m (το όνομα είναι η απόδειξη ότι κάποιος το κατέγραψε,
 *     όχι ότι ο αλγόριθμος μάντεψε).
 * Το «κοντά» μπαίνει στο κείμενο όταν το σημείο είναι πάνω από 120 m — γιατί αυτό ακριβώς
 * ρωτάει ο επισκέπτης: «θα πρέπει να περπατήσω;».
 *
 * ΔΕΝ ΔΗΛΩΝΕΙ ΠΟΤΕ ΞΑΠΛΩΣΤΡΕΣ/ΟΜΠΡΕΛΕΣ. Ένα `beach_resort` στον OSM μπορεί να είναι ξενοδοχείο
 * με ιδιωτική πρόσβαση· «ξαπλώστρες» είναι υπόσχεση για την ΙΔΙΑ την άμμο και δεν βγαίνει από
 * σημείο σε χάρτη. Καταγράφεται στην αναφορά για ανθρώπινο μάτι.
 *
 * Χρήση: node scripts/applyAmenitiesFromOsm.mjs --in .tmp/amen-<region> [--write]
 *        (διαβάζει <in>.json και <in>-nearby.json)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));
const IN = arg('--in');
if (!IN) { console.error('usage: --in .tmp/amen-<region> [--write]'); process.exit(1); }

const MULTI_M = 250;   // δύο ή περισσότερα σημεία μέσα εδώ
const NAMED_M = 150;   // ένα με όνομα μέσα εδώ
const NEARBY_M = 120;  // πάνω από εδώ, το κείμενο λέει «κοντά»

// Οι λέξεις είναι ΑΚΡΙΒΩΣ αυτές που χρησιμοποιεί ήδη το υπόλοιπο σύνολο (μετρημένες συχνότητες
// εθνικά), ώστε μια συμπληρωμένη παραλία να μη διαβάζεται διαφορετικά από μια ελεγμένη.
const CATEGORIES = [
  { key: 'taverna', types: ['restaurant'], near: 'ταβέρνες κοντά', at: 'ταβέρνες' },
  { key: 'cafe', types: ['cafe'], near: 'καφέ κοντά', at: 'καφέ' },
  { key: 'bar', types: ['bar', 'pub'], near: 'beach bar', at: 'beach bar' },
  { key: 'fastfood', types: ['fast_food_restaurant', 'fast_food'], near: 'σνακ κοντά', at: 'σνακ' },
  { key: 'parking', types: ['parking'], near: 'parking κοντά', at: 'parking' },
];

const readJson = (p, d = null) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return d; } };
const base = path.isAbsolute(IN) ? IN : path.join(rootDir, IN);
const nearby = readJson(`${base}-nearby.json`, {});
const rows = readJson(`${base}.json`, []);
if (!existsSync(`${base}-nearby.json`)) { console.error(`δεν βρέθηκε ${base}-nearby.json`); process.exit(1); }

const decide = (pois) => {
  const claims = [];
  const notes = [];
  for (const cat of CATEGORIES) {
    const mine = (pois || []).filter((p) => cat.types.includes(p.primaryType)).sort((a, b) => a.d - b.d);
    if (!mine.length) continue;
    const multi = mine.filter((p) => p.d <= MULTI_M).length >= 2;
    const named = mine.find((p) => p.name && p.d <= NAMED_M);
    if (!multi && !named) { notes.push(`${cat.key}: ${mine.length} σημείο/α, κοντινότερο ${mine[0].d} m — αδύναμο σήμα`); continue; }
    const d = (named || mine[0]).d;
    claims.push(d > NEARBY_M ? cat.near : cat.at);
  }
  return { claims, notes };
};

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const applied = [];
const skipped = [];

(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  const id = Number(node.id);
  const pois = nearby[String(id)];
  if (pois && node.metadata) {
    const current = node.metadata.amenities;
    if (Array.isArray(current) && current.length) {
      // Καμία επέμβαση σε γραμμένη λίστα: αυτή είναι δουλειά του ελέγχου αντιφάσεων.
    } else {
      const { claims, notes } = decide(pois);
      if (claims.length) {
        node.metadata.amenities = claims;
        const line = `Amenities from OSM POIs ${STAMP}: ${claims.join(' · ')} (${pois.length} σημεία στα 800 m· πύλη: ≥2 εντός ${MULTI_M} m ή 1 με όνομα εντός ${NAMED_M} m). Ήταν κενή λίστα.`;
        if (Array.isArray(node.metadata.sourceNotes)) node.metadata.sourceNotes.push(line);
        else node.metadata.sourceNotes = [node.metadata.sourceNotes, line].filter(Boolean).join(' ');
        applied.push({ id, name: node.name, claims });
      } else if (notes.length) {
        skipped.push({ id, name: node.name, why: notes.join(' · ') });
      }
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (write && applied.length) writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');

console.log(`applyAmenitiesFromOsm — ${write ? 'WRITE' : 'DRY-RUN'} — ${path.basename(base)}`);
for (const a of applied) console.log(`  →#${a.id} ${a.name}: ${a.claims.join(' · ')}`);
for (const s of skipped) console.log(`  ·#${s.id} ${s.name}: ${s.why}`);
console.log(`${applied.length} συμπληρώθηκαν, ${skipped.length} έμειναν κενές (αδύναμο σήμα)${write || !applied.length ? '' : ' — ξανατρέξε με --write'}`);
