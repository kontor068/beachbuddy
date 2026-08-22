#!/usr/bin/env node
/**
 * ΚΑΜΙΑ ΠΑΡΑΛΙΑ ΔΕΝ ΡΩΤΑΕΙ ΓΙΑ ΤΗ ΘΑΛΑΣΣΑ ΠΙΣΩ ΑΠΟ ΤΗΝ ΠΛΑΤΗ ΤΗΣ — πύλη.
 *
 * ΤΙ ΕΓΙΝΕ (22/08/2026). Ο Μίλτος ανέφερε ότι η Ραπανιανά #575 έδειχνε 0,9 μ. και το Κολυμβάρι
 * #3185, 1,05 χλμ πιο πέρα στην ίδια ακτή, 0,2 μ. Η εθνική σάρωση που ακολούθησε
 * (scripts/auditNeighbourWaveSplit.mjs) βρήκε ότι το πραγματικό πρόβλημα ήταν αλλού: το
 * `resolveSampleBearing` του buildMarineSamplePoints, όταν ο τομέας που κοιτάει η παραλία δεν
 * είχε 8 χλμ ανοιχτό νερό, πετούσε ολόκληρη την κατεύθυνσή της και έπαιρνε τον πιο ανοιχτό
 * τομέα ΧΩΡΙΣ ΚΑΝΕΝΑ ΟΡΙΟ ΓΩΝΙΑΣ. Το ίδιο και η σκάλα του optimiseMarineSamplePoints, που
 * επιπλέον σφράγιζε το αποτέλεσμα ως `verified` και το προστάτευε από κάθε επόμενο build.
 *
 * Αποτέλεσμα, μετρημένο πριν τη διόρθωση: 14 παραλίες ρωτούσαν για νερό πάνω από 90° μακριά από
 * αυτό που κοιτούν. Η ακραία, #1702 Κολώνα στην Άνδρο, κοιτάει 89,9° και ρωτούσε στις 270° —
 * ακριβώς την απέναντι θάλασσα του νησιού. Καμία πύλη δεν το έβλεπε: η
 * validateBeachMarineResolution ελέγχει ότι κάθε παραλία ρωτάει ΞΕΧΩΡΙΣΤΑ, όχι ότι ρωτάει για
 * ΤΟ ΔΙΚΟ ΤΗΣ νερό, και το πλήθος των παραλιών με σημείο δεν κουνιέται όταν το σημείο γυρίζει
 * ανάποδα.
 *
 * ΤΙ ΕΛΕΓΧΕΙ. Πάνω στα κομμιταρισμένα προφίλ, για κάθε παραλία με facingDeg και δικό της
 * marineSamplePoint: η γωνία του σημείου δεν απέχει πάνω από MAX_FACING_DIVERSION_DEG από το
 * πρόσωπο της παραλίας. Τα `verified` σημεία ΔΕΝ εξαιρούνται — το Μαράθι #2500 ήταν ακριβώς
 * verified στις 315° ενώ κοιτάει 104°, και μια εξαίρεση εδώ θα άφηνε ανοιχτή τη μοναδική πόρτα
 * από την οποία μπήκε το σφάλμα.
 *
 * ΓΙΑΤΙ ΤΟ ΟΡΙΟ ΕΙΝΑΙ ΣΤΙΣ 90° ΚΑΙ ΟΧΙ ΑΥΣΤΗΡΟΤΕΡΟ. Στις 90° κοστίζει 14 παραλίες, από τις
 * οποίες 11 απλώς παίρνουν κοντινότερη γωνία και 3 μένουν χωρίς δικό τους σημείο και διαβάζουν
 * το σημείο της περιοχής. Αυστηρότερο όριο θα άγγιζε 82 παραλίες που εκτρέπονται 45-90°, και
 * αυτές ΔΕΝ έχουν μετρηθεί σε μελτέμι — μια ήρεμη μέρα δεν αρκεί για να τις κουνήσει κανείς.
 *
 * ⚠️ ΔΕΝ ΕΛΕΓΧΕΙ ΤΟ ΝΟΥΜΕΡΟ. Δύο γειτονικές παραλίες μπορούν κάλλιστα να έχουν διαφορετικό
 * κύμα και μια πύλη πάνω στο τυπωμένο ύψος θα χτυπούσε ψεύτικα. Ελέγχει την ΕΡΩΤΗΣΗ, όπως και
 * η validateBeachMarineResolution δίπλα της.
 *
 *   node scripts/validateSampleBearingWithinFacing.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(root, 'public', 'data', 'geospatial', 'exposure');

/** Ίδιο νούμερο με buildMarineSamplePoints και optimiseMarineSamplePoints. */
const MAX_FACING_DIVERSION_DEG = 90;
/** Μισή μοίρα ανοχή για τη στρογγυλοποίηση στο ένα δεκαδικό που κάνουν τα δύο scripts. */
const ROUNDING_TOLERANCE_DEG = 0.5;

const angularDiffDeg = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const failures = [];
let checked = 0;
let withoutFacing = 0;

for (const file of readdirSync(EXPOSURE_DIR)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const payload = JSON.parse(readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
  for (const [id, profile] of Object.entries(payload.profiles || {})) {
    const sample = profile.marineSamplePoint;
    if (!sample) continue;
    if (!Number.isFinite(profile.facingDeg) || !Number.isFinite(sample.bearingDeg)) {
      withoutFacing += 1;
      continue;
    }
    checked += 1;
    const gap = angularDiffDeg(profile.facingDeg, sample.bearingDeg);
    if (gap > MAX_FACING_DIVERSION_DEG + ROUNDING_TOLERANCE_DEG) {
      failures.push({
        id: Number(id),
        name: profile.name?.gr || profile.name?.en || String(id),
        region: file.replace('.json', ''),
        facingDeg: profile.facingDeg,
        bearingDeg: sample.bearingDeg,
        gapDeg: Number(gap.toFixed(1)),
        verified: sample.verified ?? null,
      });
    }
  }
}

console.log(`Σημεία θάλασσας που ελέγχθηκαν: ${checked} (${withoutFacing} χωρίς γωνία, εκτός ελέγχου)`);

if (failures.length === 0) {
  console.log(`✓ Καμία παραλία δεν ρωτάει για νερό πάνω από ${MAX_FACING_DIVERSION_DEG}° μακριά από το πρόσωπό της.`);
  process.exit(0);
}

console.error(`\n✗ ${failures.length} παραλίες ρωτούν για νερό πάνω από ${MAX_FACING_DIVERSION_DEG}° μακριά από αυτό που κοιτούν:\n`);
failures.sort((a, b) => b.gapDeg - a.gapDeg);
for (const f of failures) {
  console.error(`  #${f.id} ${f.name} [${f.region}] — κοιτά ${f.facingDeg}°, ρωτά ${f.bearingDeg}° (απόκλιση ${f.gapDeg}°)`
    + `${f.verified ? ` · σφραγισμένο ως ${f.verified}` : ''}`);
}
console.error('\nΔΙΟΡΘΩΣΗ: τρέξε `node scripts/buildMarineSamplePoints.mjs`. Αν μια παραλία επιμένει, το σημείο της');
console.error('είναι σφραγισμένο ως `verified` και το build το σέβεται — σβήσε το πεδίο `verified` από το');
console.error('marineSamplePoint της και ξανατρέξε. ΜΗΝ περάσεις την πύλη ανεβάζοντας το όριο: το όριο είναι');
console.error('ο λόγος που υπάρχει, και μια παραλία που ρωτάει για την απέναντι θάλασσα δίνει λάθος αριθμό');
console.error('όσο «έγκυρο» κι αν είναι το κελί που της απαντάει.');
process.exit(1);
