#!/usr/bin/env node
/**
 * ΤΙ ΣΗΜΑΙΝΕΙ «ΠΛΗΡΗΣ ΠΑΡΑΛΙΑ» — Η ΠΥΛΗ ΓΙΑ ΟΣΕΣ ΜΠΑΙΝΟΥΝ ΑΠΟ ΕΔΩ ΚΑΙ ΠΕΡΑ
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Μια καινούργια παραλία μπαίνει με ό,τι είχε η πηγή που τη βρήκε — συνήθως όνομα
 * και συντεταγμένες — και τα υπόλοιπα «θα συμπληρωθούν». Δεν συμπληρώνονται: μετρημένο 17/08/2026,
 * από τις **185 παραλίες με id ≥ 3000 μόνο 1 ήταν πλήρης**. Βάθος νερού 6%, σιγουριά κειμένου 2%,
 * πρόσβαση 35%, παροχές 45%, φωτογραφία 28%. Ο εβδομαδιαίος πίνακας τις εμφανίζει σαν κενά της
 * περιοχής, οπότε κάθε νέα παραλία χειροτερεύει το ποσοστό της περιοχής που τη φιλοξενεί — και η
 * ανακάλυψη νέων παραλιών, που είναι καλό, μοιάζει με ζημιά.
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Τα ίδια πεδία που μετράει το buildQualityLedger.mjs, συν δύο που ο πίνακας δεν
 * δείχνει ανά παραλία αλλά χωρίς αυτά ο καιρός της παραλίας είναι δανεικός:
 *   · γεωμετρία      — υπάρχει προφίλ έκθεσης; χωρίς αυτό ο άνεμος κρίνεται από τη γειτονιά
 *   · σημείο θάλασσας — marineSamplePoint· χωρίς αυτό το κύμα έρχεται από το κελί της περιοχής,
 *                       που για 277 παραλίες περιγράφει νερό που δεν βλέπουν (μέτρηση 16/08)
 *
 * ΔΥΟ ΕΠΙΠΕΔΑ, ΓΙΑΤΙ ΔΕΝ ΕΙΝΑΙ ΟΛΑ ΕΞΙΣΟΥ ΕΦΙΚΤΑ:
 *   ΥΠΟΧΡΕΩΤΙΚΑ (blocking) — όσα παράγονται μηχανικά από ό,τι έχουμε ήδη. Αν λείπει κάποιο,
 *     κάποιο βήμα του pipeline δεν έτρεξε. Δεν υπάρχει δικαιολογία.
 *   ΕΠΙΘΥΜΗΤΑ (warning)    — όσα θέλουν πηγή ή ανθρώπινο μάτι (φωτογραφία, βάθος, σιγουριά).
 *     Μετριούνται και αναφέρονται, αλλά δεν μπλοκάρουν: μια παραλία χωρίς φωτογραφία είναι
 *     καλύτερη από μια παραλία που δεν υπάρχει.
 *
 * Χρήση:  node scripts/checkNewBeachCompleteness.mjs [--since-id 3000] [--strict] [--json <out>]
 *         --strict → έξοδος 1 αν λείπει ΥΠΟΧΡΕΩΤΙΚΟ (για τις πύλες ποιότητας)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachDir = path.join(rootDir, 'public', 'data', 'beaches');
const exposureDir = path.join(rootDir, 'public', 'data', 'geospatial', 'exposure');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SINCE = Number(arg('--since-id', 3000));
const strict = process.argv.includes('--strict');
const OUT = arg('--json');

const readJson = (p, d = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } };

const photoIds = new Set(Object.keys(readJson(path.join(rootDir, 'data', 'beachPhotosById.generated.json'), {})).map(Number));
for (const row of readJson(path.join(rootDir, 'reports', 'photo-coverage', 'beach-photo-presence.json'), []) || []) {
  if (row?.hasPhoto) photoIds.add(Number(row.id));
}

/**
 * ΤΡΙΑ ΕΠΙΠΕΔΑ, ΓΙΑΤΙ ΜΙΑ ΠΥΛΗ ΠΟΥ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΠΕΡΑΣΕΙ ΣΗΜΕΡΑ ΔΕΝ ΕΙΝΑΙ ΠΥΛΗ.
 *
 * ΦΡΑΓΜΟΣ — παράγονται ΜΟΝΟ από αρχεία που έχουμε ήδη στον δίσκο: καμία υπηρεσία, κανένα δίκτυο,
 *   καμία δικαιολογία. Είναι στο 100% από 17/08/2026 και εκεί πρέπει να μείνουν. Αν σπάσει
 *   κάποιο, ένα βήμα του pipeline δεν έτρεξε.
 * ΑΓΩΓΟΣ — παράγονται μηχανικά ΑΛΛΑ χρειάζονται τον OpenStreetMap, που πέφτει (μετρημένο την ίδια
 *   μέρα: και οι τρεις καθρέφτες χωρίς απάντηση επί ώρες, 51 παραλίες γύρισαν «RETRY»). Δεν
 *   μπλοκάρουν ακόμα — θα μετακινηθούν στον ΦΡΑΓΜΟ όταν φτάσουν στο 100%, όχι νωρίτερα.
 * ΕΠΙΘΥΜΗΤΑ — θέλουν πηγή ή ανθρώπινο μάτι. Μετριούνται, δεν μπλοκάρουν ποτέ.
 */
const BLOCKING = [
  { key: 'geometry', label: 'γεωμετρία έκθεσης', how: 'npx tsx scripts/geospatialExposureProfiles.ts --region <id> --land-geojson .tmp/geospatial/greece-land-osm-split.geojson --no-download' },
  { key: 'marine', label: 'σημείο θάλασσας (κύμα)', how: 'node scripts/buildMarineSamplePoints.mjs --region <id>' },
  { key: 'facing', label: 'κατεύθυνση ακτής', how: 'node scripts/applyIslandGroupOrientationFromGeospatial.mjs --group=<group>' },
];
const PIPELINE = [
  { key: 'nav', label: 'οδηγίες πλοήγησης', how: 'node scripts/restoreNavForDegradedBeaches.mjs --regions <id> --write' },
  { key: 'access', label: 'τύπος πρόσβασης', how: 'node scripts/auditUnknownAccessFromOsm.mjs --regions <id> → applyAccessFromOsm' },
  { key: 'amenities', label: 'παροχές', how: 'node scripts/auditAmenitiesOsm.mjs --region <id> → applyAmenitiesFromOsm' },
];
const REQUIRED = [...BLOCKING, ...PIPELINE];
const requiredOnly = process.argv.includes('--required-only');
const DESIRED = [
  { key: 'terrain', label: 'άμμος/βότσαλο' },
  { key: 'depth', label: 'βάθος νερού' },
  { key: 'photo', label: 'φωτογραφία' },
  { key: 'confidence', label: 'σιγουριά κειμένου' },
];

const profilesFor = (regionId) => readJson(path.join(exposureDir, `${regionId}.json`), {})?.profiles || {};

/** Το ίδιο κατώφλι με τον buildMarineSamplePoints: κάτω από 4 χλμ ανοιχτού νερού σε κάθε
 *  κατεύθυνση, καμία σπρωξιά προς τα ανοιχτά δεν βγάζει νόημα. */
const isEnclosed = (profile) => {
  if (!profile?.sectors) return false;
  return Object.values(profile.sectors).every((s) => Number(s?.fetchKm || 0) < 4);
};

const rows = [];
for (const file of fs.readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const beaches = readJson(path.join(beachDir, file), []);
  if (!Array.isArray(beaches)) continue;
  const regionId = file.replace(/\.json$/, '');
  const profiles = profilesFor(regionId);
  for (const b of beaches) {
    if (Number(b.id) < SINCE) continue;
    const m = b.metadata || {};
    const p = profiles[String(b.id)];
    const state = {
      geometry: Boolean(p),
      // Μια βαθιά κλειστή μπούκα ΔΕΝ παίρνει σημείο θάλασσας, και αυτό είναι σωστό: δεν υπάρχει
      // κελί ανοιχτού νερού που να περιγράφει το νερό της (scripts/buildMarineSamplePoints.mjs).
      // Χωρίς αυτή την εξαίρεση η πύλη θα ζητούσε για πάντα κάτι που δεν πρέπει να υπάρχει.
      marine: Boolean(p?.marineSamplePoint) || isEnclosed(p),
      facing: Number.isFinite(Number(m.orientation?.degrees)),
      nav: m.googleMapsNavigation?.status === 'verified',
      access: Boolean(m.access?.type && m.access.type !== 'unknown' && m.access.label),
      amenities: Array.isArray(m.amenities) && m.amenities.length > 0,
      terrain: Array.isArray(m.terrain?.types) && m.terrain.types.length > 0,
      depth: Boolean(m.waterDepth?.type),
      photo: photoIds.has(Number(b.id)),
      confidence: m.confidence === 'high' && m.needsVerification !== true,
    };
    const missingRequired = REQUIRED.filter((r) => !state[r.key]).map((r) => r.key);
    const missingDesired = DESIRED.filter((r) => !state[r.key]).map((r) => r.key);
    rows.push({ id: Number(b.id), name: b.name, regionId, missingRequired, missingDesired });
  }
}

const broken = rows.filter((r) => r.missingRequired.length);
const perfect = rows.filter((r) => !r.missingRequired.length && !r.missingDesired.length);

// Per-field counts, so the report says which STEP of the pipeline is not being run —
// "121 λείπει η πρόσβαση" is a missing step, not 121 unrelated oversights.
const countBy = (list, field) => {
  const c = {};
  for (const r of rows) for (const k of r[field]) c[k] = (c[k] || 0) + 1;
  return c;
};
const reqCounts = countBy(rows, 'missingRequired');
const desCounts = countBy(rows, 'missingDesired');

console.log(`Πληρότητα νέων παραλιών (id ≥ ${SINCE})`);
console.log(`  παραλίες            ${rows.length}`);
console.log(`  πλήρεις σε όλα      ${perfect.length}`);
console.log(`  λείπει υποχρεωτικό  ${broken.length}`);
console.log('\nΦΡΑΓΜΟΣ — παράγονται από αρχεία που ήδη έχουμε, καμία δικαιολογία:');
for (const r of BLOCKING) {
  const n = reqCounts[r.key] || 0;
  console.log(`  ${String(n).padStart(4)}  ${r.label}${n ? `\n        → ${r.how}` : ''}`);
}
console.log('\nΑΓΩΓΟΣ — μηχανικά, αλλά χρειάζονται τον OpenStreetMap (δεν μπλοκάρουν ακόμα):');
for (const r of PIPELINE) {
  const n = reqCounts[r.key] || 0;
  console.log(`  ${String(n).padStart(4)}  ${r.label}${n ? `\n        → ${r.how}` : ''}`);
}
console.log('\nΕΠΙΘΥΜΗΤΑ που λείπουν (θέλουν πηγή ή ανθρώπινο μάτι):');
for (const r of DESIRED) console.log(`  ${String(desCounts[r.key] || 0).padStart(4)}  ${r.label}`);

// The regions carrying the most incomplete new beaches — where an afternoon pays best.
const byRegion = {};
for (const r of broken) byRegion[r.regionId] = (byRegion[r.regionId] || 0) + 1;
const worst = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 8);
if (worst.length) {
  console.log('\nΠεριοχές με τις περισσότερες ελλιπείς νέες παραλίες:');
  for (const [region, n] of worst) console.log(`  ${String(n).padStart(4)}  ${region}`);
}

if (OUT) {
  const outPath = path.isAbsolute(OUT) ? OUT : path.join(rootDir, OUT);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), sinceId: SINCE, totals: { beaches: rows.length, perfect: perfect.length, missingRequired: broken.length }, requiredCounts: reqCounts, desiredCounts: desCounts, rows }, null, 2) + '\n', 'utf8');
  console.log(`\n→ ${path.relative(rootDir, outPath)}`);
}

// `--required-only` κρίνει ΜΟΝΟ τον ΦΡΑΓΜΟ. Είναι ο τρόπος που η πύλη τρέχει στα κρίσιμα
// checks χωρίς να κρατάει όμηρο ολόκληρο το build επειδή ένας ξένος εξυπηρετητής είναι κάτω.
const blockingBroken = rows.filter((r) => r.missingRequired.some((k) => BLOCKING.some((b) => b.key === k)));
if (strict) {
  const offenders = requiredOnly ? blockingBroken : broken;
  if (offenders.length) {
    console.error(`\n❌ ${offenders.length} νέες παραλίες χωρίς ${requiredOnly ? 'τα δεδομένα του ΦΡΑΓΜΟΥ' : 'υποχρεωτικά δεδομένα'}.`);
    for (const o of offenders.slice(0, 15)) console.error(`   #${o.id} ${o.name} (${o.regionId}) — λείπει: ${o.missingRequired.join(', ')}`);
    process.exit(1);
  }
  console.log(`\n✅ Κάθε νέα παραλία φέρνει γεωμετρία, σημείο κύματος και κατεύθυνση.`);
}
