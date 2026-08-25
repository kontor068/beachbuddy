#!/usr/bin/env node
/**
 * ΤΟ ΣΟΥΤΡΑΛΙ ΗΤΑΝ ΓΡΑΜΜΕΝΟ ΔΥΟ ΦΟΡΕΣ, ΚΑΙ ΤΟ ΕΔΕΙΞΕ Η ΔΙΟΡΘΩΣΗ ΤΗΣ ΠΙΝΕΖΑΣ
 *
 * ΤΙ ΕΓΙΝΕ. Η #2720 «Σουτραλί (Αγριά)» είχε πινέζα 3,1 χλμ μακριά από την παραλία. Τον
 * Ιούνιο του 2026 ένα coverage-gap πέρασμα ρώτησε το OpenStreetMap «ποιες παραλίες έχει ο
 * χάρτης που δεν έχουμε εμείς», βρήκε το way/320087252 «Σουτραλί», δεν είδε καμία δική μας
 * εγγραφή κοντά — γιατί η δική μας ήταν 3 χλμ αλλού — και δημιούργησε τη #3094 ως νέα
 * παραλία. Δύο κάρτες για την ίδια αμμουδιά.
 *
 * Στις 25/08/2026 η #2720 μετακινήθηκε στο σωστό σημείο (scripts/movePinSoutrali2026-08.mjs)
 * με στόχο ΑΚΡΙΒΩΣ αυτό το way — και οι δύο εγγραφές έπεσαν στην ίδια συντεταγμένη. Ο
 * auditBeachDataset το ανέφερε αμέσως ως HIGH duplicate_exact_coordinates. Το διπλότυπο δεν
 * το δημιούργησε η μετακίνηση· το αποκάλυψε.
 *
 * ΠΟΙΑ ΜΕΝΕΙ. Η #2720, γιατί έχει τις θεσμικές πηγές (δήμος Βόλου, Blue Flag), τρεις
 * γραμμένες παροχές και πλήρες έδαφος. Η #3094 είναι import ενός OSM πολυγώνου.
 *
 * ΤΙ ΜΕΤΑΦΕΡΕΤΑΙ ΠΡΙΝ ΚΡΥΦΤΕΙ Η #3094. Ό,τι έχει και δεν έχει η άλλη — αλλιώς η
 * συγχώνευση θα ήταν απώλεια:
 *   · googleMapsNavigation (verified, με σταθερό Google placeId) — η #2720 δεν είχε καθόλου·
 *   · popularity (moderate, 4,3 από 187 κριτικές)·
 *   · η παροχή «ξαπλώστρες, ομπρέλες εποχικά», που δεν υπάρχει στη λίστα της #2720·
 *   · το OSM sourceUrl, ως δεύτερη ανεξάρτητη πηγή ταυτότητας.
 *
 * Χρήση:  node scripts/mergeSoutraliDuplicate2026-08.mjs            (dry-run)
 *         node scripts/mergeSoutraliDuplicate2026-08.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));

const KEEP = 2720;
const DROP = 3094;

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const appendNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = m.sourceNotes ? `${m.sourceNotes} ${line}` : line;
};

let keep = null; let drop = null;
(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (Number(node.id) === KEEP && node.lat !== undefined) keep = node;
  if (Number(node.id) === DROP && node.lat !== undefined) drop = node;
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (!keep || !drop) { console.error('Δεν βρέθηκαν και οι δύο εγγραφές.'); process.exit(1); }

const gained = [];
const km = keep.metadata; const dm = drop.metadata;

if (!km.googleMapsNavigation && dm.googleMapsNavigation) {
  km.googleMapsNavigation = { ...dm.googleMapsNavigation };
  gained.push(`οδηγίες (${dm.googleMapsNavigation.status}, placeId ${dm.googleMapsNavigation.placeId || '—'})`);
}
if (!km.popularity && dm.popularity) {
  km.popularity = { ...dm.popularity };
  gained.push(`δημοτικότητα (${dm.popularity.tier}, ${dm.popularity.rating}/${dm.popularity.ratingCount})`);
}
for (const a of dm.amenities || []) {
  if (!(km.amenities || []).includes(a)) { (km.amenities ||= []).push(a); gained.push(`παροχή «${a}»`); }
}
for (const u of dm.sourceUrls || []) {
  if (!(km.sourceUrls || []).includes(u)) { (km.sourceUrls ||= []).push(u); gained.push('πηγή OSM'); }
}

appendNote(km, `Merged duplicate #${DROP} on ${STAMP}: the same beach existed twice because this record's `
  + `pin was 3,1 km away, so the June 2026 OSM coverage-gap pass created #${DROP} from way/320087252 as a `
  + `"new" beach. After the pin was corrected both landed on the same coordinate. Carried over from #${DROP}: `
  + `${gained.join(', ') || 'nothing new'}. #${DROP} is now hidden.`);

dm.excludeFromApp = true;
dm.excludeReason = `duplicate_of_${KEEP}_soutrali_agria`;
appendNote(dm, `Excluded ${STAMP}: duplicate of #${KEEP} «${keep.name}». Created by the June 2026 OSM `
  + `coverage-gap import because #${KEEP}'s pin sat 3,1 km away and nothing of ours was mapped nearby. `
  + `Once that pin was corrected the two records shared one coordinate. Everything this record carried that `
  + `#${KEEP} lacked was copied across first. Coordinates and sources left untouched for the audit trail.`);

if (write) writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`mergeSoutraliDuplicate — ${write ? 'WRITE' : 'DRY-RUN'}`);
console.log(`  κρατιέται  #${KEEP} ${keep.name}`);
console.log(`  κρύβεται   #${DROP} ${drop.name}`);
console.log(`  μεταφέρθηκαν: ${gained.length ? gained.join(', ') : '—'}`);
if (!write) console.log('— ξανατρέξε με --write');
