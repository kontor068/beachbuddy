#!/usr/bin/env node
/**
 * ΟΙ ΠΑΡΑΛΙΕΣ ΠΟΥ ΠΕΡΙΜΕΝΟΥΝ ΜΟΝΟ ΜΙΑ ΜΑΤΙΑ — ΛΙΣΤΑ, ΟΧΙ ΕΓΓΡΑΦΗ
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Ο άξονας «Σιγουριά κειμένου» του εβδομαδιαίου πίνακα μετράει
 * `confidence === 'high' && needsVerification !== true`. Σήμερα 582 παραλίες δεν το
 * περνάνε — αλλά αυτό το νούμερο κρύβει δύο εντελώς διαφορετικά πράγματα:
 *
 *   α) παραλίες που όντως δεν ξέρουμε — άγνωστη πρόσβαση, καμία παροχή, χωρίς πηγή·
 *   β) παραλίες που ξέρουμε πλήρως, αλλά κουβαλάνε μια σφραγίδα «low» που μπήκε σε
 *      κάποιο παλιό πέρασμα και κανείς δεν ξαναείδε.
 *
 * Μετρημένο 24/08/2026: 91 από τις 582 ανήκουν στο (β). Παράδειγμα ο Λαιμός Βοιωτίας —
 * verified placeId, τέσσερις γραμμένες παροχές, έδαφος + βάθος + κατεύθυνση, άσφαλτος
 * με γραμμένη σημείωση, μία πηγή — και σφραγίδα «χαμηλή σιγουριά».
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ ΑΥΤΟ ΤΟ ΣΚΡΙΠΤ. Δεν γράφει τίποτα. Ο κανόνας ότι τη σιγουριά την
 * ανεβάζει άνθρωπος και όχι μηχανή είναι γραμμένος και τηρείται — δες
 * docs/BEACH_DATA_VERIFICATION_PHASE2.md («OSM supports identity/location only»).
 * Το μόνο σημείο σε όλο το repo που αγγίζει το πεδίο είναι μια ΥΠΟΒΑΘΜΙΣΗ
 * (scripts/fixParosNaxosAudit.mjs:103). Αυτό εδώ φτιάχνει ΟΥΡΑ, ώστε η ανθρώπινη
 * ματιά να πέσει πρώτα εκεί που τη βλέπει ο περισσότερος κόσμος.
 *
 * ΤΑ ΕΞΙ ΚΡΙΤΗΡΙΑ (όλα πρέπει να ισχύουν — είναι τα ίδια που μετράει ο πίνακας):
 *   πρόσβαση   access.type γνωστός ΚΑΙ access.label γραμμένο
 *   παροχές    τουλάχιστον μία γραμμένη
 *   χαρακτήρας έδαφος ΚΑΙ βάθος ΚΑΙ κατεύθυνση ακτής
 *   πλοήγηση   googleMapsNavigation.status === 'verified'
 *   πηγή       τουλάχιστον ένα sourceUrl
 *   σημαία     ΔΕΝ είναι σημειωμένη «θέλει επαλήθευση»
 *
 * Χρήση:  node scripts/listConfidenceReadyBeaches.mjs
 *         node scripts/listConfidenceReadyBeaches.mjs --views <views.json>
 *         node scripts/listConfidenceReadyBeaches.mjs --json reports/quality/confidence-ready.json
 *
 * --views δέχεται το JSON της κονσόλας (/api/traffic?key=…&format=json). Οι προβολές
 * ζουν στα Netlify Blobs, όχι στον δίσκο· χωρίς αυτές η λίστα βγαίνει αλφαβητικά ανά
 * περιοχή, που είναι χρήσιμο αλλά όχι κατά προτεραιότητα.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachDir = path.join(rootDir, 'public', 'data', 'beaches');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const OUT = arg('--json', path.join(rootDir, 'reports', 'quality', 'confidence-ready.json'));
const VIEWS = arg('--views');
const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

const index = readJson(path.join(beachDir, 'index.json'));
if (!index?.regions?.length) {
  console.error('Δεν βρέθηκε το public/data/beaches/index.json — τρέξε πρώτα npm run build:beach-data.');
  process.exit(1);
}

// Οι προβολές έρχονται ανά διαδρομή σελίδας· το id της παραλίας είναι μέσα στο URL.
const BEACH_PATH = /\/beaches\/[^/]+\/(\d+)-/;
const viewsById = new Map();
if (VIEWS) {
  const raw = readJson(path.resolve(VIEWS));
  const pages = raw?.pages || raw?.totals?.pages || raw || {};
  for (const [p, n] of Object.entries(pages)) {
    const m = String(p).match(BEACH_PATH);
    if (m) viewsById.set(Number(m[1]), (viewsById.get(Number(m[1])) || 0) + Number(n || 0));
  }
  if (!viewsById.size) console.warn(`Προσοχή: το ${VIEWS} δεν έδωσε καμία προβολή παραλίας — έλεγξε τη μορφή του.`);
}

// Το sourceNotes είναι άλλοτε πίνακας και άλλοτε ένα σκέτο κείμενο (955 / 1971 σήμερα).
const notesOf = (m) => {
  const n = m?.sourceNotes;
  if (Array.isArray(n)) return n.filter((x) => typeof x === 'string');
  return typeof n === 'string' && n ? [n] : [];
};
// Η τελευταία ημερομηνία που κάποιος άγγιξε την εγγραφή, όπως τη γράφουν τα apply*.mjs.
const lastStamp = (notes) => {
  let best = '';
  for (const n of notes) for (const d of n.match(/\d{4}-\d{2}-\d{2}/g) || []) if (d > best) best = d;
  return best || null;
};

const rows = [];
const totals = { scanned: 0, notHigh: 0, ready: 0 };

for (const region of index.regions) {
  const beaches = readJson(path.join(beachDir, `${region.id}.json`), []);
  for (const b of Array.isArray(beaches) ? beaches : []) {
    const m = b.metadata || {};
    if (m.excludeFromApp) continue;
    totals.scanned += 1;
    if (m.confidence === 'high' && m.needsVerification !== true) continue;
    totals.notHigh += 1;

    const checks = {
      access: Boolean(m.access?.type && m.access.type !== 'unknown' && m.access.label),
      amenities: Array.isArray(m.amenities) && m.amenities.length > 0,
      character: Boolean(
        Array.isArray(m.terrain?.types) && m.terrain.types.length > 0
        && m.waterDepth?.type
        && Number.isFinite(Number(m.orientation?.degrees)),
      ),
      nav: m.googleMapsNavigation?.status === 'verified',
      source: Array.isArray(m.sourceUrls) && m.sourceUrls.length > 0,
      unflagged: m.needsVerification !== true,
    };
    if (!Object.values(checks).every(Boolean)) continue;
    totals.ready += 1;

    const notes = notesOf(m);
    rows.push({
      id: Number(b.id),
      name: b.name,
      regionId: region.id,
      regionLabel: region.name?.gr || region.name?.en || region.id,
      views: viewsById.get(Number(b.id)) ?? null,
      confidence: m.confidence || null,
      // Ό,τι χρειάζεται το μάτι για να κρίνει χωρίς να ανοίξει το αρχείο:
      evidence: {
        access: `${m.access.type} — ${m.access.label}`,
        accessNotes: m.access.notes || '',
        amenities: m.amenities,
        terrain: m.terrain.types,
        waterDepth: m.waterDepth.type,
        facingDeg: Number(m.orientation.degrees),
        nav: `${m.googleMapsNavigation.mode} (ελέγχθηκε ${m.googleMapsNavigation.checkedAt || '—'})`,
        sourceUrls: m.sourceUrls,
        lastTouched: lastStamp(notes),
        noteCount: notes.length,
      },
    });
  }
}

// Σειρά: προβολές πρώτα (αν τις ξέρουμε), μετά περιοχή και όνομα — σταθερή κάθε φορά.
rows.sort((a, b) => (b.views ?? -1) - (a.views ?? -1)
  || a.regionLabel.localeCompare(b.regionLabel, 'el')
  || a.name.localeCompare(b.name, 'el'));

const byRegion = {};
for (const r of rows) byRegion[r.regionLabel] = (byRegion[r.regionLabel] || 0) + 1;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify({
  note: 'Λίστα για ανθρώπινη έγκριση. ΚΑΝΕΝΑ σκριπτ δεν ανεβάζει confidence — δες την κεφαλίδα του scripts/listConfidenceReadyBeaches.mjs.',
  generatedAt: new Date().toISOString().slice(0, 10),
  criteria: ['access', 'amenities', 'character', 'nav', 'source', 'unflagged'],
  viewsSource: VIEWS ? path.relative(rootDir, path.resolve(VIEWS)) : null,
  totals,
  beaches: rows,
}, null, 2)}\n`, 'utf8');

console.log('Παραλίες που περιμένουν μόνο μια ματιά');
console.log(`  σαρώθηκαν            ${totals.scanned}`);
console.log(`  χωρίς «high»         ${totals.notHigh}`);
console.log(`  όλα τα άλλα πλήρη    ${totals.ready}`);
if (!VIEWS) console.log('  (χωρίς --views: σειρά ανά περιοχή, όχι κατά προτεραιότητα)');
console.log('\nΑνά περιοχή:');
for (const [r, n] of Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 12)) {
  console.log(`  ${String(n).padStart(3)}  ${r}`);
}
console.log(`\nΓράφτηκε ${path.relative(rootDir, OUT)}`);
