#!/usr/bin/env node
/**
 * ΨΗΝΕΙ ΤΟ `windShadow` ΣΤΑ ΠΡΟΦΙΛ ΕΚΘΕΣΗΣ — 24 ΧΑΡΑΚΤΗΡΕΣ ΑΝΑ ΠΑΡΑΛΙΑ.
 *
 * ΤΙ ΕΙΝΑΙ. Για κάθε μία από τις 24 γωνίες (ανά 15°): '1' αν υπάρχει στεριά μέσα στα πρώτα 300 μ.
 * προς τα εκεί, αλλιώς '0'. Το διαβάζει ΜΟΝΟ το `utils/offshoreWindNote`, που δεν αγγίζει αριθμό,
 * χρώμα, ετυμηγορία ή κατάταξη.
 *
 * ΓΙΑΤΙ ΔΕΝ ΞΑΝΑΜΕΤΡΑΕΙ ΓΕΩΜΕΤΡΙΑ. Η λεπτή βεντάλια υπάρχει ήδη, μετρημένη με βήμα ακτίνας 50 μ.,
 * και για τις 110 περιοχές: `reports/geometry/arrival-fan/*.json`, παραγμένη από το ίδιο το
 * geospatial build (`scripts/geospatialExposureProfiles.ts --arrival-fan`). Ένα δεύτερο,
 * χειρόγραφο ray-cast εδώ θα ήταν ΤΡΙΤΟ αντίγραφο της ίδιας μέτρησης — ακριβώς το λάθος που η
 * `utils/marineSamplePoints` καταγράφει στην κεφαλίδα της («δεν υπάρχει τρίτο αντίγραφο τίποτα»)
 * και που έκανε το Gate 18 να περάσει πράσινο πάνω σε σαμποταρισμένο κώδικα.
 *
 * ΓΙΑΤΙ ΔΕΝ ΤΡΕΧΕΙ ΕΘΝΙΚΟ REBUILD. Το `buildGeospatialExposureProfiles` ξαναγράφει ΟΛΟΚΛΗΡΟ το
 * αρχείο κάθε φορά και έχει ήδη σβήσει σιωπηλά πεδίο που δεν ήξερε (τα `marineSamplePoint` της
 * Λήμνου, βίβλος §Μ6). Εδώ γράφουμε μόνο το ένα πεδίο, πάνω στα υπάρχοντα αρχεία, και ΤΑΥΤΟΧΡΟΝΑ
 * ο builder διδάχτηκε να το μεταφέρει αυτούσιο — ίδιο μοτίβο, ίδιος λόγος.
 *
 * ΧΡΗΣΗ:  node scripts/buildWindShadow.mjs [--check]
 *         --check = δεν γράφει, επιστρέφει 1 αν κάτι λείπει (για πύλη/CI).
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const fanDir = path.join(root, 'reports/geometry/arrival-fan');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');

/** Πρέπει να ταυτίζεται με utils/offshoreWindNote.WIND_SHADOW_LAND_KM. Η πύλη το επαληθεύει. */
const LAND_KM = 0.3;
const SLOTS = 24;

if (!existsSync(fanDir)) {
  console.error(`Λείπει ${fanDir}. Τρέξε πρώτα το geospatial build με --arrival-fan.`);
  process.exit(1);
}

/** Η βεντάλια δίνει χιλιόμετρα ανοιχτού νερού ανά γωνία· '1' = βρήκε στεριά νωρίς. */
const shadowFromFan = (fan) => {
  if (!Array.isArray(fan) || fan.length !== SLOTS) return undefined;
  let out = '';
  for (const value of fan) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
    out += value <= LAND_KM ? '1' : '0';
  }
  return out;
};

let regionsTouched = 0;
let written = 0;
let missingFan = 0;
let unchanged = 0;
const missingRegions = [];

for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json')) continue;
  // `index.json` είναι ευρετήριο περιοχών, όχι περιοχή — δεν έχει ούτε πρέπει να έχει βεντάλια.
  if (file === 'index.json') continue;
  const regionId = file.replace('.json', '');
  const fanPath = path.join(fanDir, file);
  if (!existsSync(fanPath)) { missingRegions.push(regionId); continue; }

  const fans = JSON.parse(readFileSync(fanPath, 'utf8')).fans || {};
  const exposurePath = path.join(exposureDir, file);
  const doc = JSON.parse(readFileSync(exposurePath, 'utf8'));
  const profiles = doc.profiles || {};
  let changed = false;

  for (const [beachId, profile] of Object.entries(profiles)) {
    const shadow = shadowFromFan(fans[beachId]);
    if (!shadow) { missingFan += 1; continue; }
    if (profile.windShadow === shadow) { unchanged += 1; continue; }
    profile.windShadow = shadow;
    changed = true;
    written += 1;
  }

  if (changed && !checkOnly) writeFileSync(exposurePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  if (changed) regionsTouched += 1;
}

console.log(`περιοχές που άλλαξαν: ${regionsTouched}`);
console.log(`παραλίες με νέο/ενημερωμένο windShadow: ${written}`);
console.log(`ήδη σωστές: ${unchanged}`);
console.log(`χωρίς βεντάλια (μένουν σιωπηλές): ${missingFan}`);
if (missingRegions.length) console.log(`περιοχές χωρίς αρχείο βεντάλιας: ${missingRegions.length} — ${missingRegions.slice(0, 5).join(', ')}`);

if (checkOnly && (written > 0 || missingRegions.length > 0)) {
  console.error('\n❌ Το windShadow δεν είναι ενημερωμένο. Τρέξε: node scripts/buildWindShadow.mjs');
  process.exit(1);
}
if (!checkOnly) console.log('\n✅ γράφτηκε');
