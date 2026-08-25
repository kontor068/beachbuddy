#!/usr/bin/env node
/**
 * #2720 ΣΟΥΤΡΑΛΙ (ΑΓΡΙΑ) — Η ΠΙΝΕΖΑ ΗΤΑΝ 3,1 ΧΛΜ ΑΠΟ ΤΗΝ ΠΑΡΑΛΙΑ
 *
 * ΤΟ ΣΤΟΙΧΕΙΟ. Το εθνικό σάρωμα ακτογραμμής της 24/08/2026 την έβγαλε OFFSHORE (456 m έξω
 * από τη στεριά). Το σάρωμα ονόματος (scripts/findPinTargetsByName.mjs) βρήκε OSM
 * way/320087252 με όνομα **«Σουτραλί»** — ίδια λέξη, όχι συνώνυμο — στα 3.106 m, ενώ γύρω
 * από τη σημερινή μας πινέζα δεν υπάρχει καμία παραλία χαρτογραφημένη μέσα σε 1,2 χλμ.
 * Ένα όνομα που ταιριάζει ακριβώς, μακριά, με κενό γύρω από την πινέζα, είναι η υπογραφή
 * λάθος συντεταγμένης — όχι αχαρτογράφητου όρμου.
 *
 * ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΣΚΡΙΠΤ ΚΑΙ ΟΧΙ ΤΟ applyPinMoves. Δύο λόγοι:
 *   1. Το applyPinMoves ισοπεδώνει το `sourceNotes` από πίνακα σε ένα ενιαίο κείμενο
 *      (applyPinMoves.mjs:32) — μη αναστρέψιμο, και εδώ η εγγραφή έχει πίνακα 2 γραμμών.
 *   2. Δεν υποβαθμίζει τη σιγουριά. Μετά από μετακίνηση 3 χλμ, ό,τι λέει η εγγραφή για
 *      πρόσβαση, παροχές και έδαφος περιγράφει το ΠΑΛΙΟ σημείο· το `confidence: high` θα
 *      ήταν ψέμα. Η καθιερωμένη πρακτική (commit e28c42e0, Κοκκινόκαστρο) είναι υποβάθμιση
 *      σε medium + needsVerification, και γίνεται εδώ αυτόματα αντί με το χέρι.
 *
 * ΤΙ ΠΑΛΙΩΝΕΙ ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΞΑΝΑΧΤΙΣΤΕΙ ΜΕΤΑ (με αυτή τη σειρά):
 *   npx tsx scripts/geospatialExposureProfiles.ts --region thessaly-magnesia-mainland---pelion \
 *       --land-geojson .tmp/geospatial/greece-land-osm-split.geojson --no-download
 *   node scripts/buildMarineSamplePoints.mjs --region thessaly-magnesia-mainland---pelion
 *   node scripts/resyncOrientationAfterPinMove.mjs --ids 2720 --write
 *   npm run build:beach-data && npm run build:shorelines
 * Χωρίς το τελευταίο η πύλη `shoreline-shapes` σπάει: συγκρίνει αποτύπωμα συντεταγμένων.
 *
 * Χρήση:  node scripts/movePinSoutrali2026-08.mjs            (dry-run)
 *         node scripts/movePinSoutrali2026-08.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));

const ID = 2720;
const TARGET = [39.32582, 23.014129];
const OSM = 'way/320087252';
const DIST_M = 3106;

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
let done = null;

(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (Number(node.id) === ID && typeof node.lat === 'number' && node.metadata) {
    const from = [node.lat, node.lon];
    node.lat = TARGET[0];
    node.lon = TARGET[1];

    const m = node.metadata;
    const prevConfidence = m.confidence;
    if (m.confidence === 'high') m.confidence = 'medium';
    m.needsVerification = true;

    const line = `Pin corrected ${STAMP} (national coastline sweep + name search): moved `
      + `${DIST_M} m from ${from[0]},${from[1]} to ${TARGET[0]},${TARGET[1]} — OSM ${OSM} carries the `
      + `exact name «Σουτραλί» there, and no beach was mapped within 1,2 km of the old pin. `
      + `Confidence ${prevConfidence} → ${m.confidence} and needsVerification set: access, amenities and `
      + `terrain on this record were written for the old location and have not been re-checked. `
      + `Only coordinates, confidence and needsVerification changed.`;
    if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
    else m.sourceNotes = m.sourceNotes ? `${m.sourceNotes} ${line}` : line;

    done = { name: node.name, from, to: TARGET, prevConfidence, now: m.confidence };
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (!done) { console.error(`Δεν βρέθηκε η #${ID}.`); process.exit(1); }
if (write) writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`movePinSoutrali — ${write ? 'WRITE' : 'DRY-RUN'}`);
console.log(`  #${ID} ${done.name}`);
console.log(`    ${done.from[0]},${done.from[1]}  →  ${done.to[0]},${done.to[1]}   (${DIST_M} m)`);
console.log(`    σιγουριά ${done.prevConfidence} → ${done.now} · needsVerification: true`);
if (!write) console.log('— ξανατρέξε με --write');
