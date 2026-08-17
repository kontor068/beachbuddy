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
 *   5. Η ΒΕΝΤΑΛΙΑ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ ΤΟΥ ΣΤΟΜΙΟΥ (§Γ22, 18/08/2026). Από τις 18/08 ο ξηρός τομέας
 *      με πλήρες προφίλ παίρνει μοντελοποιημένο ύψος από το ολοκλήρωμα cos²ˢ × SMB. Κλειδώνονται:
 *      (5α) μιλάει ΜΟΝΟ σε ξηρό τομέα — άνοιγμα >0 ή φράξιμο <0,95 σημαίνει σιωπή· (5β) η
 *      κανονικοποίηση απλώνεται σε ΟΛΗ τη βεντάλια, και στη στεριά — κλειστό προφίλ = 0, ομοιόμορφα
 *      ανοιχτό = ίδιο με τη μονή γραμμή, μισάνοιχτο = ΚΑΤΩ από το μισό της μονής (αν κάποιος
 *      κανονικοποιήσει μόνο στο νερό, το μισάνοιχτο φουσκώνει στο ολόκληρο και εδώ κοκκινίζει)·
 *      (5γ) δάπεδο και απόλυτο καπάκι ισχύουν σε ΚΑΘΕ ξηρό τομέα × ένταση· (5δ) ονομαστικά:
 *      Πάνορμος (2011) και Λιμανάκια (22) — τα δύο «ΔΕΝ ξεκλειδώνουν» της §Γ21 — παίρνουν πλέον
 *      το νούμερο του στομίου τους (≥0,15 μ. στα 40 χλμ/ώρα), ενώ Σταφίδα (2186) και Άγ. Ιωάννης
 *      Πόρτο (2151) μένουν στο δάπεδο, ακριβώς ό,τι έδινε η §Γ21.
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
  drySectorFanWaveHeightM,
  DRY_SECTOR_NEIGHBOUR_HALF_WIDTH_DEG,
  DRY_SECTOR_NEIGHBOUR_MAX_FETCH_KM,
  DRY_SECTOR_MIN_BLOCKED_RATIO,
  SHORE_RAMP_SILENT_ONSHORE,
  SHORE_DISPLAY_FLOOR_M,
} = require(path.join(root, 'utils/shoreWave.ts'));
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));

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
// (5) Ο πληθυσμός της βεντάλιας: ξηροί τομείς που σιωπούν σήμερα και θα έπαιρναν φωνή από το
// στόμιο. Μετρημένο 18/08: 2.082 τομείς σε 1.318 παραλίες — ταβάνι με περιθώριο γεωμετρίας.
const fanSilentBeaches = new Set();
let fanSilentSectors = 0;

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
      // «Ωμός ξηρός» — το κατώφλι της βεντάλιας (§Γ22), χαλαρότερο από του isEnclosedDrySector
      // (0,95 αντί για 1, χωρίς έλεγχο γείτονα: τον γείτονα τον ΖΥΓΙΖΕΙ το ολοκλήρωμα).
      const rawDry = typeof sector.fetchKm === 'number' && sector.fetchKm <= 0
        && typeof sector.blockedRayRatio === 'number'
        && sector.blockedRayRatio >= DRY_SECTOR_MIN_BLOCKED_RATIO;
      if (rawDry && typeof sector.onshore === 'number' && sector.onshore >= SHORE_RAMP_SILENT_ONSHORE) {
        fanSilentSectors += 1;
        fanSilentBeaches.add(profile.beachId);
      }

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
        // (5γ) Η βεντάλια σε ΚΑΘΕ ξηρό τομέα: δάπεδο από κάτω, απόλυτο καπάκι από πάνω. Το καπάκι
        // εδώ έχει δόντια: στον όρμο με μεγάλο στόμιο το H_fan μεγαλώνει με τον άνεμο, και αν
        // ξεπεράσει τα ανοιχτά ο κώδικας οφείλει να σωπάσει, όχι να τυπώσει το μεγαλύτερο νούμερο.
        if (rawDry) {
          const fanM = drySectorFanWaveHeightM({
            sector: { fetchKm: sector.fetchKm, blockedRayRatio: sector.blockedRayRatio },
            profile,
            windDirectionDeg: windDeg,
            windSpeedKmh: wind.windKmh,
          });
          if (fanM !== undefined) {
            const withFan = estimateShoreWaveHeightM({ ...base, enclosedDrySector: false, dryFanWaveM: fanM });
            if (typeof withFan === 'number') {
              if (withFan >= wind.openWaterM - 1e-9) {
                failures.push(
                  `${regionId} #${profile.beachId} @${sectorKey} ${wind.windKmh} χλμ/ώρα: `
                  + `βεντάλια ${withFan.toFixed(2)} μ. ≥ ανοιχτά ${wind.openWaterM.toFixed(2)} μ. — έφυγε το καπάκι της βεντάλιας`
                );
              }
              if (withFan < SHORE_DISPLAY_FLOOR_M - 1e-9) {
                failures.push(
                  `${regionId} #${profile.beachId} @${sectorKey} ${wind.windKmh} χλμ/ώρα: `
                  + `βεντάλια ${withFan.toFixed(2)} μ. κάτω από το δάπεδο ${SHORE_DISPLAY_FLOOR_M}`
                );
              }
            }
          }
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

// (5α) Η βεντάλια μιλάει ΜΟΝΟ σε ξηρό τομέα. Ένα άνοιγμα 0,3 χλμ ή φράξιμο 0,5 στη ζωντανή
// γεωμετρία σημαίνει σιωπή — αλλιώς η βεντάλια θα άρχιζε να μιλάει για ανοιχτές παραλίες, δηλαδή
// το fan-all που ΔΕΝ εγκρίθηκε (ξαναμετριέται σε μελτέμι πρώτα).
{
  const uniformProfile = (fetchKm, blockedRayRatio) => ({
    sectors: Object.fromEntries(SECTOR_ORDER.map(k => [k, { fetchKm, blockedRayRatio }])),
  });
  const openProfile = uniformProfile(10, 0);
  const closedProfile = uniformProfile(0, 1);
  const drySector = { fetchKm: 0, blockedRayRatio: 1 };

  const offDryFetch = drySectorFanWaveHeightM({ sector: { fetchKm: 0.3, blockedRayRatio: 1 }, profile: closedProfile, windDirectionDeg: 0, windSpeedKmh: 40 });
  if (offDryFetch !== undefined) failures.push(`(5α) η βεντάλια μίλησε σε τομέα με άνοιγμα 0,3 χλμ (${offDryFetch})`);
  const offDryRatio = drySectorFanWaveHeightM({ sector: { fetchKm: 0, blockedRayRatio: 0.5 }, profile: closedProfile, windDirectionDeg: 0, windSpeedKmh: 40 });
  if (offDryRatio !== undefined) failures.push(`(5α) η βεντάλια μίλησε σε τομέα με φράξιμο 0,5 (${offDryRatio})`);
  const noWitness = drySectorFanWaveHeightM({
    sector: drySector,
    profile: { sectors: { N: { fetchKm: 0, blockedRayRatio: 1 } } },
    windDirectionDeg: 0,
    windSpeedKmh: 40,
  });
  if (noWitness !== undefined) failures.push(`(5α) η βεντάλια μίλησε με λειψό προφίλ (${noWitness})`);

  // (5β) Τιμιότητα κανονικοποίησης — τα τρία σκαλιά που ξεχωρίζουν το σωστό ολοκλήρωμα από κάθε
  // πρόχειρη εκδοχή του: κλειστό = 0 · ομοιόμορφο = ίδιο με τη μονή γραμμή (ούτε άθροισμα ούτε
  // διπλασιασμός) · μισάνοιχτο = κάτω από το μισό της μονής (κανονικοποίηση water-only θα το
  // φούσκωνε ως ολόκληρο και κοκκινίζει εδώ).
  const singleLineM = estimateFetchLimitedWaveHeightM({ windSpeedKmh: 40, fetchKm: 10 });
  const fanClosed = drySectorFanWaveHeightM({ sector: drySector, profile: closedProfile, windDirectionDeg: 0, windSpeedKmh: 40 });
  if (fanClosed !== 0) failures.push(`(5β) κλειστό προφίλ δεν έδωσε 0 (${fanClosed})`);
  const fanOpen = drySectorFanWaveHeightM({ sector: drySector, profile: openProfile, windDirectionDeg: 0, windSpeedKmh: 40 });
  if (typeof fanOpen !== 'number' || Math.abs(fanOpen - singleLineM) > 0.01) {
    failures.push(`(5β) ομοιόμορφο προφίλ 10 χλμ: βεντάλια ${fanOpen} ≠ μονή γραμμή ${singleLineM}`);
  }
  const mouthProfile = {
    sectors: Object.fromEntries(SECTOR_ORDER.map(k => [k, k === 'SW' ? { fetchKm: 10, blockedRayRatio: 0 } : { fetchKm: 0, blockedRayRatio: 1 }])),
  };
  const fanMouth = drySectorFanWaveHeightM({ sector: drySector, profile: mouthProfile, windDirectionDeg: 180, windSpeedKmh: 40 });
  if (typeof fanMouth !== 'number' || fanMouth <= 0 || fanMouth >= singleLineM * 0.5) {
    failures.push(`(5β) στόμιο ΝΔ 10 χλμ @ νοτιά: βεντάλια ${fanMouth} — έπρεπε 0 < H < ${(singleLineM * 0.5).toFixed(2)} (μισάνοιχτο ≠ ολάνοιχτο)`);
  }
}

// (5δ) Ονομαστικές δεσμεύσεις της βεντάλιας, στα 40 χλμ/ώρα (ανοιχτά 0,9 μ. — το πλέγμα WINDS).
// Οι δύο «ΔΕΝ ξεκλειδώνουν» της §Γ21 είναι ακριβώς οι παραλίες που η βεντάλια υπάρχει για να
// τιμολογεί: το στόμιό τους παίρνει νούμερο αντί για γυμνό δάπεδο (Πάνορμος 2011 — το ατύχημα)
// ή αντί για το πέλαγος (Λιμανάκια 22). Οι δύο της Τήνου μένουν στο δάπεδο — κλειστοί όρμοι.
const FAN_NAMED = [
  { beachId: 2011, windDeg: 180, minM: 0.15, why: 'Πάνορμος Νάξου — νοτιάς πάνω στο ΝΔ στόμιο 6,2 χλμ: η κλάση του ατυχήματος παίρνει νούμερο' },
  // 227° — η ΙΔΙΑ γωνία με τη δέσμευση της §Γ21 πιο πάνω: ζωντανός τομέας ΞΗΡΟΣ (SW→W, και οι
  // δύο 0/1), στόμιο Ν 15 χλμ στις 47° απόσταση. Στις 206° η παρεμβολή πατάει το ανοιχτό Ν
  // (8,7 χλμ) και σωστά δεν είναι ξηρή — μετρήθηκε πριν διαλεχτεί η γωνία.
  { beachId: 22, windDeg: 227, minM: 0.15, why: 'Λιμανάκια Βουλιαγμένης — στόμιο 15 χλμ στο ημικύκλιο: ποτέ ξανά σκέτο δάπεδο εδώ' },
  { beachId: 2186, windDeg: 352, floor: true, why: 'Σταφίδα Τήνου — κλειστός όρμος: η βεντάλια οφείλει να συμφωνεί με το δάπεδο της §Γ21' },
  { beachId: 2151, windDeg: 352, floor: true, why: 'Άγιος Ιωάννης Πόρτο Τήνου — ομοίως' },
];
for (const commitment of FAN_NAMED) {
  const profile = profilesById.get(commitment.beachId);
  if (!profile) {
    failures.push(`(5δ) #${commitment.beachId} λείπει από τη γεωμετρία — «${commitment.why}» δεν ελέγχεται πια`);
    continue;
  }
  const liveSector = interpolateSectorGeometry(profile, commitment.windDeg);
  const fanM = drySectorFanWaveHeightM({
    sector: liveSector,
    profile,
    windDirectionDeg: commitment.windDeg,
    windSpeedKmh: 40,
  });
  if (fanM === undefined) {
    failures.push(`(5δ) #${commitment.beachId} @${commitment.windDeg}°: η βεντάλια σώπασε (ο τομέας δεν είναι πια ξηρός;) — ${commitment.why}`);
    continue;
  }
  const printed = estimateShoreWaveHeightM({
    openWaterWaveHeightM: 0.9,
    windSpeedKmh: 40,
    sector: { fetchKm: liveSector.fetchKm, blockedRayRatio: liveSector.blockedRayRatio, onshore: 0 },
    confidence: 'high',
    suspectPin: false,
    arrivingSwellPresent: false,
    enclosedDrySector: false,
    dryFanWaveM: fanM,
  });
  if (commitment.floor) {
    if (printed !== SHORE_DISPLAY_FLOOR_M) {
      failures.push(`(5δ) #${commitment.beachId} @${commitment.windDeg}°: τύπωσε ${printed} αντί για το δάπεδο ${SHORE_DISPLAY_FLOOR_M} — ${commitment.why}`);
    }
  } else if (typeof printed !== 'number' || printed < commitment.minM) {
    failures.push(`(5δ) #${commitment.beachId} @${commitment.windDeg}°: τύπωσε ${printed} < ${commitment.minM} — ${commitment.why}`);
  }
}

// (5ε) Ο πληθυσμός της βεντάλιας δεν φουσκώνει σιωπηλά. Μετρημένο 18/08: 2.082 τομείς σε 1.318
// παραλίες (§Γ20/§Γ21/§Γ22 — το ίδιο πλέγμα και στις τρεις μετρήσεις).
const MAX_FAN_SILENT_SECTORS = 2300;
const MAX_FAN_SILENT_BEACHES = 1450;
if (fanSilentSectors > MAX_FAN_SILENT_SECTORS || fanSilentBeaches.size > MAX_FAN_SILENT_BEACHES) {
  failures.push(
    `(5ε) ο πληθυσμός της βεντάλιας φούσκωσε: ${fanSilentSectors} τομείς σε ${fanSilentBeaches.size} παραλίες `
    + `(ταβάνι ${MAX_FAN_SILENT_SECTORS}/${MAX_FAN_SILENT_BEACHES}, μετρημένο 2082/1318 στις 18/08)`
  );
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
