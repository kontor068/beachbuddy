#!/usr/bin/env node
/**
 * Η ΑΣΦΑΛΤΟΣ ΠΟΥ ΕΧΕΙ ΔΕΥΤΕΡΗ ΠΗΓΗ — ΚΑΙ ΜΟΝΟ ΑΥΤΗ
 *
 * Ο ΚΑΝΟΝΑΣ. Η απόφαση της 16/08 και 18/08/2026 (γραμμένη στο applyAccessFromOsm.mjs:31-49)
 * λέει ότι το `asphalt_road` χρειάζεται ΔΥΟ ανεξάρτητες πηγές, γιατί το ρίσκο είναι
 * ασύμμετρο: «άσφαλτος» είναι υπόσχεση — κάποιος βάζει χαμηλό αυτοκίνητο και πάει· λάθος
 * εκεί σημαίνει κολλημένο αμάξι. Ο χωματόδρομος είναι προειδοποίηση και περνάει με μία.
 * Ο κανόνας ΔΕΝ λέει «ποτέ άσφαλτος». Λέει «όχι από τον OSM μόνο του».
 *
 * Η ΔΕΥΤΕΡΗ ΠΗΓΗ ΠΟΥ ΥΠΑΡΧΕΙ ΗΔΗ ΣΤΑ ΔΕΔΟΜΕΝΑ. Δύο θεσμικές καταγραφές, καμία τους OSM:
 *
 *   · SEATRAC σε λειτουργία (`seatrac.status === 'online'`). Είναι ράμπα αυτόνομης
 *     πρόσβασης αναπηρικού αμαξιδίου στη θάλασσα, από επίσημο πρόγραμμα με δική του
 *     καταχώρηση και ημερομηνία επαλήθευσης. Το επιχείρημα δεν είναι «το λέει μια λίστα»
 *     — είναι φυσικό: **δεν στήνεται ράμπα αναπηρικού σε παραλία όπου δεν φτάνει
 *     στρωμένος δρόμος.** Το αμαξίδιο πρέπει να φτάσει ως εκεί.
 *   · ΓΑΛΑΖΙΑ ΣΗΜΑΙΑ 2026. Τα κριτήρια απαιτούν οργανωμένη πρόσβαση και υποδομές.
 *
 * ΤΙ ΔΕΝ ΜΕΤΡΑΕΙ ΩΣ ΔΕΥΤΕΡΗ ΠΗΓΗ, ΚΑΙ ΓΙΑΤΙ:
 *   · `seatrac.status === 'listed-unverified'` — καταχωρημένη αλλά ανεπιβεβαίωτη ράμπα δεν
 *     αποδεικνύει ότι υπάρχει εγκατάσταση επί τόπου (6 παραλίες μένουν έξω γι' αυτό)·
 *   · παροχές, «οργανωμένη», κριτικές Google, ντους — περιγράφουν τι υπάρχει ΣΤΗΝ παραλία,
 *     όχι πώς φτάνεις σ' αυτήν. Μια οργανωμένη παραλία μπορεί να σερβίρεται με 4×4.
 *   · δεύτερο tag του ίδιου του OSM — ίδια πηγή, όχι ανεξάρτητη.
 *
 * ΜΕΤΡΗΜΕΝΟ 25/08/2026: 342 παραλίες με άγνωστη πρόσβαση· ο OSM λέει στρωμένο δρόμο για
 * 168· από αυτές, 34 έχουν και θεσμική δεύτερη πηγή. Αυτές οι 34 γράφονται εδώ.
 *
 * Χρήση:  node scripts/applyAccessFromTwoSources.mjs            (dry-run)
 *         node scripts/applyAccessFromTwoSources.mjs --write
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const reportsDir = path.join(rootDir, 'reports', 'access-road-proximity');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));

// Ό,τι ο OSM έχει ήδη κρίνει στρωμένο, από κάθε πέρασμα που έχει τρέξει.
const osmPaved = new Map();
if (existsSync(reportsDir)) {
  for (const file of readdirSync(reportsDir)) {
    if (!file.startsWith('unknown-access') || !file.endsWith('.json')) continue;
    try {
      const data = JSON.parse(readFileSync(path.join(reportsDir, file), 'utf8'));
      for (const row of data.results || []) {
        if (row.verdict === 'asphalt_road' && row.id != null) osmPaved.set(Number(row.id), row);
      }
    } catch { /* μια χαλασμένη αναφορά δεν ρίχνει το πέρασμα */ }
  }
}

const secondSource = (m) => {
  if (m.seatrac?.hasSeatrac && m.seatrac.status === 'online') {
    return { kind: 'seatrac', text: `Seatrac accessibility ramp in service (verified ${m.seatrac.verifiedAt || 'n/a'}) — `
      + 'a wheelchair ramp is not installed where a paved road does not reach' };
  }
  if (m.blueFlag2026?.awarded === true) {
    return { kind: 'blue-flag', text: `Blue Flag ${m.blueFlag2026.year || 2026} award — the criteria require organised access and facilities` };
  }
  return null;
};

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const appendNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = m.sourceNotes ? `${m.sourceNotes} ${line}` : line;
};

const applied = [];
const onlyOsm = [];

(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  const m = node.metadata;
  if (node.id !== undefined && node.lat !== undefined && m && !m.excludeFromApp) {
    const cur = m.access || {};
    if (!cur.type || cur.type === 'unknown') {
      const osm = osmPaved.get(Number(node.id));
      if (osm) {
        const second = secondSource(m);
        if (!second) onlyOsm.push({ id: node.id, name: node.name });
        else {
          m.access = { ...cur, type: 'asphalt_road', label: 'άσφαλτος μέχρι κοντά στην παραλία', notes: '' };
          appendNote(m, `Access set to asphalt_road ${STAMP} from TWO independent sources, as the 16/08 + 18/08 `
            + `decision requires. (1) OSM road network: ${osm.evidence}. (2) ${second.text}. Previously 'unknown'. `
            + 'No other field changed.');
          applied.push({ id: node.id, name: node.name, why: second.kind, evidence: osm.evidence });
        }
      }
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (write && applied.length) writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`applyAccessFromTwoSources — ${write ? 'WRITE' : 'DRY-RUN'}`);
for (const a of applied) console.log(`  →#${a.id} ${a.name} — 2η πηγή: ${a.why}`);
console.log(`\n${applied.length} γράφτηκαν με δύο πηγές  ·  ${onlyOsm.length} έχουν μόνο τον OSM και μένουν άγνωστες`);
if (!write && applied.length) console.log('— ξανατρέξε με --write');
