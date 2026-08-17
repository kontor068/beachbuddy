/**
 * Η ΠΥΛΗ ΤΟΥ ΞΗΡΟΥ ΤΟΜΕΑ ΜΠΟΡΕΙ ΜΟΝΟ ΝΑ ΗΡΕΜΕΙ, ΚΑΙ ΜΟΝΟ ΟΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ ΝΕΡΟ — gate.
 *
 * ΤΙ ΦΥΛΑΕΙ (βίβλος §Γ21, 17/08/2026). Από τις 17/08 η `utils/shoreWave` παρακάμπτει τον έλεγχο
 * `onshore` όταν η γεωμετρία λέει ότι δεν υπάρχει καθόλου νερό στο ημικύκλιο του ανέμου. Αυτό
 * κινείται προς το ΗΡΕΜΟΤΕΡΟ — δηλαδή προς τη μόνη κατεύθυνση που μπορεί να βλάψει άνθρωπο
 * (σκανδάλη #1 της §9, «ψεύτικη ηρεμία»). Η §7δ απαιτεί κάθε τέτοια εξαίρεση να έχει δική της
 * πύλη. Αυτή είναι.
 *
 * ΤΡΙΑ ΠΡΑΓΜΑΤΑ ΚΛΕΙΔΩΝΟΝΤΑΙ:
 *
 *   1. ΜΟΝΟΔΡΟΜΙΑ. Καμία παραλία, σε κανέναν άνεμο, σε καμία ένταση, δεν τυπώνει ΜΕΓΑΛΥΤΕΡΟ
 *      νούμερο από ό,τι θα τύπωνε χωρίς την πύλη. Δεν είναι θεωρητικό: το βάρος γίνεται 1 σε
 *      περιπτώσεις που πριν σιωπούσαν, και μια λάθος αλλαγή στο δάπεδο ή στο καπάκι θα το
 *      αντέστρεφε ήσυχα.
 *
 *   2. ΚΑΝΕΝΑ ΑΝΟΙΧΤΟ ΣΤΟΜΙΟ ΔΙΠΛΑ. Κάθε τομέας που ξεκλειδώνει πρέπει να έχει ≤2 χλμ άνοιγμα
 *      σε ΟΛΟ το ημικύκλιο ±90° γύρω από τον άνεμο. Αυτό είναι το μάθημα του Πανόρμου Νάξου
 *      (§Γ20): «μηδέν άνοιγμα» δεν αρκεί όταν το κύμα μπαίνει από το πλάι. Στα ±45° περνούσαν
 *      520 τομείς με στόμιο >5 χλμ λίγο πιο πέρα — αν κάποιος στενέψει το τόξο ή σηκώσει το
 *      κατώφλι, εδώ κοκκινίζει.
 *
 *   3. ΟΝΟΜΑΣΤΙΚΕΣ ΔΕΣΜΕΥΣΕΙΣ, θετικές και αρνητικές. Τα Λιμανάκια Βουλιαγμένης (22) και ο
 *      Πάνορμος Νάξου (2011) στον νότιο ΔΕΝ επιτρέπεται να ξεκλειδώσουν — και οι δύο ήταν
 *      μετρημένα λάθος στις χαλαρές εκδοχές. Η Σταφίδα (2186) και ο Άγιος Ιωάννης Πόρτο (2151)
 *      της Τήνου ΠΡΕΠΕΙ να ξεκλειδώνουν: είναι οι δύο μοναδικές παραλίες που αλλάζουν ετυμηγορία
 *      πανελλαδικά, άρα αν σταματήσουν να ξεκλειδώνουν η αλλαγή έχει πάψει να κάνει αυτό που
 *      μετρήθηκε.
 *
 *   4. ΤΟ ΜΕΓΕΘΟΣ ΔΕΝ ΦΟΥΣΚΩΝΕΙ ΣΙΩΠΗΛΑ. Μετρημένα 17/08: 104 τομείς σε 59 παραλίες. Ένα ταβάνι
 *      με περιθώριο αφήνει φυσιολογική μετακίνηση γεωμετρίας αλλά κόβει κάθε χαλάρωση κανόνα.
 *
 * Καθαρός υπολογισμός πάνω στην αποθηκευμένη γεωμετρία — χωρίς δίκτυο.
 *
 * Run: node scripts/validateDrySectorGate.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const {
  estimateShoreWaveHeightM,
  isEnclosedDrySector,
  DRY_SECTOR_NEIGHBOUR_HALF_WIDTH_DEG,
  DRY_SECTOR_NEIGHBOUR_MAX_FETCH_KM,
  SHORE_RAMP_SILENT_ONSHORE,
} = require(path.join(root, 'utils/shoreWave.ts'));
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));

const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Ίδιο πλέγμα εντάσεων με τη μέτρηση της §Γ21, ώστε τα νούμερα να συγκρίνονται. Η αντιστοίχιση
// ταχύτητας→ανοιχτής θάλασσας κάνει τη σύγκριση δίκαιη: βοριάς 40 χλμ/ώρα δεν συνυπάρχει με 0,2 μ.
const WINDS = [
  { windKmh: 20, openWaterM: 0.35 },
  { windKmh: 40, openWaterM: 0.9 },
  { windKmh: 60, openWaterM: 1.6 },
];

/** Το μεγαλύτερο άνοιγμα σε οποιονδήποτε τομέα μέσα στο ημικύκλιο του ανέμου. */
const neighbourMaxFetchKm = (profile, windDeg, halfWidthDeg) => {
  const normalize = (deg) => ((deg % 360) + 360) % 360;
  const delta = (a, b) => {
    const diff = Math.abs(normalize(a) - normalize(b));
    return diff > 180 ? 360 - diff : diff;
  };
  let max = 0;
  SECTOR_ORDER.forEach((key, index) => {
    if (delta(index * 45, windDeg) > halfWidthDeg + 1e-9) return;
    const fetchKm = profile?.sectors?.[key]?.fetchKm;
    if (typeof fetchKm === 'number' && Number.isFinite(fetchKm)) max = Math.max(max, fetchKm);
  });
  return max;
};

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const failures = [];
const unlockedByBeach = new Map();
let unlockedSectors = 0;
let combos = 0;

for (const file of readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  const regionId = file.replace(/\.json$/, '');
  const raw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
  for (const profile of Object.values(raw)) {
    if (profile?.confidence !== 'high') continue;
    SECTOR_ORDER.forEach((sectorKey, index) => {
      const sector = profile.sectors?.[sectorKey];
      if (!sector) return;
      const windDeg = index * 45;
      const dry = isEnclosedDrySector(sector, profile, windDeg);

      if (dry) {
        // ΜΕΤΡΑΜΕ ΜΟΝΟ ΟΣΟΥΣ ΑΛΛΑΖΟΥΝ ΣΥΜΠΕΡΙΦΟΡΑ. Οι περισσότεροι ξηροί τομείς έχουν ήδη απόγειο
        // άνεμο (onshore ≤ −0,5) και μιλούσαν και πριν — η πύλη δεν τους αγγίζει. Η πρώτη εκδοχή
        // αυτού του αρχείου τους μετρούσε κι αυτούς και ανέφερε 1.948 αντί για 104, δηλαδή θα
        // κοκκίνιζε για κάτι που δεν άλλαξε ποτέ.
        if (typeof sector.onshore === 'number' && sector.onshore >= SHORE_RAMP_SILENT_ONSHORE) {
          unlockedSectors += 1;
          unlockedByBeach.set(profile.beachId, regionId);
        }
        // (2) Κανένα ανοιχτό στόμιο δίπλα.
        const neighbourKm = neighbourMaxFetchKm(profile, windDeg, DRY_SECTOR_NEIGHBOUR_HALF_WIDTH_DEG);
        if (neighbourKm > DRY_SECTOR_NEIGHBOUR_MAX_FETCH_KM + 1e-9) {
          failures.push(
            `${regionId} #${profile.beachId} @${sectorKey}: ξεκλείδωσε ενώ έχει άνοιγμα `
            + `${neighbourKm.toFixed(2)} χλμ μέσα στο ±${DRY_SECTOR_NEIGHBOUR_HALF_WIDTH_DEG}° — κλάση Πανόρμου`
          );
        }
      }

      // (1) Μονοδρομία, σε κάθε ένταση.
      for (const wind of WINDS) {
        combos += 1;
        const base = {
          openWaterWaveHeightM: wind.openWaterM,
          windSpeedKmh: wind.windKmh,
          sector: { fetchKm: sector.fetchKm, blockedRayRatio: sector.blockedRayRatio, onshore: sector.onshore },
          confidence: profile.confidence,
          suspectPin: false,
          arrivingSwellPresent: false,
        };
        const before = estimateShoreWaveHeightM({ ...base, enclosedDrySector: false });
        const after = estimateShoreWaveHeightM({ ...base, enclosedDrySector: dry });
        const printedBefore = typeof before === 'number' ? before : wind.openWaterM;
        const printedAfter = typeof after === 'number' ? after : wind.openWaterM;
        if (printedAfter > printedBefore + 1e-9) {
          failures.push(
            `${regionId} #${profile.beachId} @${sectorKey} ${wind.windKmh} χλμ/ώρα: `
            + `${printedBefore.toFixed(2)} → ${printedAfter.toFixed(2)} μ. — η πύλη ΑΝΕΒΑΣΕ το νούμερο`
          );
        }
        // ΑΠΟΛΥΤΟ ΟΡΙΟ, όχι σχετικό. Η σύγκριση από πάνω τρέχει και τα δύο σκέλη μέσα από τον ΙΔΙΟ
        // κώδικα, οπότε αν κάποιος σβήσει το καπάκι «ποτέ πιο δυνατά από τη θάλασσα έξω» κινούνται
        // μαζί και η πύλη περνάει ήσυχη — μετρημένο με σαμποτάζ, 17/08. Ο αριθμός ακτής πρέπει να
        // είναι ΜΙΚΡΟΤΕΡΟΣ από τα ανοιχτά σε απόλυτο νούμερο, αλλιώς τυπώνουμε δύο ίδια νούμερα
        // κάτω από δύο διαφορετικές ετικέτες.
        if (typeof after === 'number' && after >= wind.openWaterM - 1e-9) {
          failures.push(
            `${regionId} #${profile.beachId} @${sectorKey} ${wind.windKmh} χλμ/ώρα: `
            + `ακτή ${after.toFixed(2)} μ. ≥ ανοιχτά ${wind.openWaterM.toFixed(2)} μ. — έφυγε το καπάκι`
          );
        }
      }
    });
  }
}

// (3) Ονομαστικές δεσμεύσεις.
//
// Ο άνεμος γράφεται σε ΜΟΙΡΕΣ, όχι σε γράμμα τομέα. Η πρώτη εκδοχή έγραφε «Σταφίδα @N» και
// κοκκίνιζε: στις 0° ακριβώς το ημικύκλιο πιάνει τον τομέα Α με 5,72 χλμ και η παραλία σωστά ΔΕΝ
// ξεκλειδώνει. Ο άνεμος που μετρήθηκε ήταν 352°, όπου το Α πέφτει έξω από το τόξο. Το γράμμα του
// τομέα είναι πλέγμα 45°· ο πραγματικός άνεμος δεν είναι.
const NAMED = [
  { beachId: 22, windDeg: 227, mustUnlock: false, why: 'Λιμανάκια Βουλιαγμένης — στόμιο 15 χλμ στα ±90°, έπεφτε λάθος στις χαλαρές εκδοχές' },
  { beachId: 2011, windDeg: 180, mustUnlock: false, why: 'Πάνορμος Νάξου — το αντιπαράδειγμα της §Γ20, στόμιο ΝΔ 6,2 χλμ' },
  { beachId: 2186, windDeg: 352, mustUnlock: true, why: 'Σταφίδα Τήνου — μία από τις δύο μοναδικές αλλαγές ετυμηγορίας πανελλαδικά' },
  { beachId: 2151, windDeg: 352, mustUnlock: true, why: 'Άγιος Ιωάννης Πόρτο Τήνου — η δεύτερη' },
];

const profilesById = new Map();
for (const file of readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  const raw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
  for (const profile of Object.values(raw)) {
    if (profile?.beachId != null) profilesById.set(profile.beachId, profile);
  }
}

for (const commitment of NAMED) {
  const profile = profilesById.get(commitment.beachId);
  if (!profile) {
    failures.push(`#${commitment.beachId} λείπει από τη γεωμετρία — η δέσμευση «${commitment.why}» δεν ελέγχεται πια`);
    continue;
  }
  // Η παραγωγή περνάει ΠΑΡΕΜΒΛΗΜΕΝΗ γεωμετρία (utils/coveWaveGuard → interpolateSectorGeometry),
  // όχι τον ωμό τομέα — η δέσμευση ελέγχεται με το ίδιο ακριβώς νούμερο που θα δει ο κώδικας.
  const unlocked = isEnclosedDrySector(
    interpolateSectorGeometry(profile, commitment.windDeg),
    profile,
    commitment.windDeg
  );
  if (unlocked !== commitment.mustUnlock) {
    failures.push(
      `#${commitment.beachId} @${commitment.windDeg}°: ${unlocked ? 'ΞΕΚΛΕΙΔΩΣΕ' : 'ΔΕΝ ξεκλειδώνει'} `
      + `ενώ η δέσμευση λέει ${commitment.mustUnlock ? 'πρέπει' : 'ΔΕΝ πρέπει'} — ${commitment.why}`
    );
  }
}

// (4) Το μέγεθος. Μετρημένα 104 τομείς / 59 παραλίες· ταβάνι με περιθώριο για φυσιολογική
// μετακίνηση γεωμετρίας, όχι για χαλάρωση κανόνα.
const MAX_UNLOCKED_SECTORS = 140;
const MAX_UNLOCKED_BEACHES = 80;
if (unlockedSectors > MAX_UNLOCKED_SECTORS || unlockedByBeach.size > MAX_UNLOCKED_BEACHES) {
  failures.push(
    `ο πληθυσμός φούσκωσε: ${unlockedSectors} τομείς σε ${unlockedByBeach.size} παραλίες `
    + `(ταβάνι ${MAX_UNLOCKED_SECTORS}/${MAX_UNLOCKED_BEACHES}, μετρημένο 104/59 στις 17/08)`
  );
}

console.log(
  `Ελέγχθηκαν ${combos} συνδυασμοί παραλίας × τομέα × έντασης. `
  + `Ξεκλειδώνουν ${unlockedSectors} τομείς σε ${unlockedByBeach.size} παραλίες.`
);

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} περιπτώσεις όπου η πύλη του ξηρού τομέα δεν κάνει αυτό που μετρήθηκε:`);
  failures.slice(0, 25).forEach(line => console.error(`- ${line}`));
  if (failures.length > 25) console.error(`- ...και ${failures.length - 25} ακόμα`);
  console.error('\nΗ πύλη επιτρέπεται να ΗΡΕΜΕΙ, ποτέ να αγριεύει, και μόνο όπου ΟΛΟ το ημικύκλιο του ανέμου είναι κλειστό.');
  console.error('Μη χαλαρώνεις το τόξο ή το κατώφλι για να περάσει κάτι — αυτό είναι το bug για το οποίο γράφτηκε η πύλη (§Γ21).');
  process.exit(1);
}

console.log('PASS — μονόδρομη προς το ηρεμότερο, κανένα ανοιχτό στόμιο δίπλα, οι ονομαστικές δεσμεύσεις κρατάνε.');
