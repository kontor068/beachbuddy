#!/usr/bin/env node
/**
 * ΤΟ ΗΛΙΟΒΑΣΙΛΕΜΑ ΔΕΝ ΥΠΟΣΧΕΤΑΙ ΟΤΑΝ Η ΓΕΩΜΕΤΡΙΑ ΤΟ ΔΙΑΨΕΥΔΕΙ (14/08/2026)
 *
 * ΤΙ ΒΡΕΘΗΚΕ. 963 από τις 2.814 παραλίες κουβαλούν `metadata.orientation.degrees` που διαφέρει
 * >20° από το `facingDeg` της γεωμετρίας — ενώ το ΙΔΙΟ τους το `notes` δηλώνει ότι από εκεί
 * παρήχθη. Αιτία: το applyIslandGroupOrientationFromGeospatial.mjs γράφει ΜΟΝΟ όταν λείπει το
 * πεδίο (`if (item.metadata?.orientation) alreadyHadOrientation += 1`), οπότε μια παλιά τιμή δεν
 * ενημερώνεται ποτέ, όσες φορές κι αν ξαναχτιστεί η γεωμετρία.
 *
 * ΓΙΑΤΙ ΔΕΝ ΤΙΣ ΕΥΘΥΓΡΑΜΜΙΖΟΥΜΕ ΟΛΕΣ — ΤΟ ΑΠΟΤΥΧΗΜΕΝΟ ΠΕΙΡΑΜΑ ΠΟΥ ΟΡΙΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ.
 * Πρώτη εκδοχή ευθυγράμμιζε και τις 2.130. Πριν γραφτεί, χτίστηκε ανεξάρτητος κριτής:
 * point-in-polygon πάνω στην ακτογραμμή (public/data/coastline), 72 κατευθύνσεις × 3 αποστάσεις,
 * για να πει ποιο από τα δύο δείχνει πράγματι προς το νερό. **Ο κριτής απέτυχε** — έβγαλε
 * «Σκαλάκια Αναβύσσου → ΒΑ» για δυτική ακτή του Σαρωνικού, γιατί οι κλειστοί δακτύλιοι του
 * αρχείου είναι νησίδες, όχι πολύγωνα στεριάς, οπότε σχεδόν κάθε δείγμα βγαίνει «νερό».
 * Αποτέλεσμα: γεωμετρία 40% / γραμμένο 47% — δηλαδή ΚΑΜΙΑ απόδειξη υπέρ της γεωμετρίας.
 * Χωρίς απόδειξη, μια εθνική επανεγγραφή 2.130 παραλιών θα ήταν στοίχημα, όχι διόρθωση.
 *
 * ΑΡΑ Η ΠΥΛΗ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΗ — ΜΟΝΟ ΠΡΟΣ ΤΑ ΚΑΤΩ. Ακριβώς ο κανόνας που το PORISMA §Σ4 έχει
 * ήδη εγκρίνει για τη σύγκρουση χειρόγραφου-γεωμετρίας: όταν διαφωνούν, δεν ανακηρύσσεται
 * νικητής — **αποσύρεται η δήλωση**. Εδώ: αν το γραμμένο λέει «κοιτάει δύση» και η γεωμετρία
 * λέει «όχι», η υπόσχεση ηλιοβασιλέματος φεύγει. Δεν χρειάζεται να ξέρουμε ποιο έχει δίκιο —
 * αρκεί ότι δεν συμφωνούν για το ΙΔΙΟ το ερώτημα που απαντάμε στον επισκέπτη.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ: δεν προσθέτει καμία νέα υπόσχεση. Οι ~156 παραλίες όπου η γεωμετρία λέει
 * «δυτική» ενώ το γραμμένο λέει «όχι» μένουν εκτός φίλτρου — για να μπουν θα έπρεπε να
 * αποδειχθεί ότι η γεωμετρία έχει δίκιο, και δεν αποδείχθηκε.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΑΣΦΑΛΕΣ ΓΙΑ ΤΟΝ ΚΑΙΡΟ: ο μηχανισμός ανέμου/έκθεσης/χρώματος ΔΕΝ διαβάζει αυτό το
 * πεδίο. Επαληθεύτηκε με scripts/dumpRegionExposureEngine.mjs: για τον Άγιο Κωνσταντίνο (#28) ο
 * μηχανισμός αναφέρει `authoredFacing=57.8` ενώ το γραμμένο πεδίο λέει 2,1° — η γεωμετρία είναι
 * ήδη η αυθεντία εκεί (utils/windExposureModel.ts:161). Το γραμμένο πεδίο διαβάζεται μόνο από
 * το φίλτρο/τους οδηγούς ηλιοβασιλέματος (utils/beachOrientation.ts:17 → `faces`), τη σελίδα
 * παραλίας (utils/sunsetOverSea.ts:79 → `degrees`), την ομαδοποίηση του podium
 * (services/recommendationService.ts:1303) και ως εφεδρικό όπου λείπει γεωμετρία.
 *
 * Χρήση:  node scripts/realignOrientationWithGeospatial.mjs            (dry run, μόνο αναφορά)
 *         node scripts/realignOrientationWithGeospatial.mjs --write    (γράφει)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const beachesPath = path.join(rootDir, 'public', 'greek_beaches.json');
const exposureDir = path.join(rootDir, 'public', 'data', 'geospatial', 'exposure');
const reportDir = path.join(rootDir, 'reports', 'orientation-realign');

const write = process.argv.includes('--write');

const AUTO_NOTES_SIGNATURE = /Generated from Natural Earth geospatial exposure facingDeg/;

const SECTOR_TO_DIRECTION = {
  N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast',
  S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest',
};
const SECTORS = Object.keys(SECTOR_TO_DIRECTION);

const normalizeDegrees = value => ((value % 360) + 360) % 360;
const sectorFromDegrees = degrees => SECTORS[Math.round(normalizeDegrees(degrees) / 45) % SECTORS.length];

/**
 * Οι ΔΥΟ πύλες που κρίνουν «βλέπει ηλιοβασίλεμα», αντιγραμμένες εδώ σκόπιμα ως σταθερές και
 * ελεγμένες από το scripts/validateSunsetGateParity.mjs, ώστε μια αλλαγή εκεί να σπάει τη
 * μέτρηση αντί να την αφήσει σιωπηλά να αποκλίνει.
 *   · utils/sunsetOverSea.ts:89       — μοίρες, 200-340°  (σελίδα παραλίας)
 *   · utils/beachOrientation.ts:15    — octant W/NW/SW    (φίλτρο «Ηλιοβασίλεμα» + οδηγοί)
 * Και οι δύο πρέπει να διαψεύδονται πριν αφαιρεθεί η υπόσχεση: μια παραλία στα 340,5° αστοχεί
 * στην πρώτη αλλά περνά τη δεύτερη, και δεν είναι ψεύτικη υπόσχεση — είναι οριακή.
 */
const SUNSET_GATE_MIN_DEG = 200;
const SUNSET_GATE_MAX_DEG = 340;
const SUNSET_FACES = new Set(['West', 'Northwest', 'Southwest']);

const degreesFaceSunset = deg => deg >= SUNSET_GATE_MIN_DEG && deg <= SUNSET_GATE_MAX_DEG;
const octantFacesSunset = face => SUNSET_FACES.has(face);
/** Λέει αυτή η κατεύθυνση «ηλιοβασίλεμα» με ΟΠΟΙΑΝΔΗΠΟΤΕ από τις δύο πύλες; */
const claimsSunset = deg => degreesFaceSunset(deg) || octantFacesSunset(SECTOR_TO_DIRECTION[sectorFromDegrees(deg)]);

const readExposureFacingById = () => {
  const facing = new Map();
  for (const file of fs.readdirSync(exposureDir)) {
    if (!file.endsWith('.json')) continue;
    const data = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8'));
    const profiles = Array.isArray(data.profiles) ? data.profiles : Object.values(data.profiles || {});
    for (const profile of profiles) {
      if (typeof profile?.facingDeg === 'number' && Number.isFinite(profile.facingDeg)) {
        facing.set(profile.beachId, profile.facingDeg);
      }
    }
  }
  return facing;
};

const source = JSON.parse(fs.readFileSync(beachesPath, 'utf8'));
const geoFacingById = readExposureFacingById();

const stats = {
  total: 0,
  claimedSunset: 0,
  authoredKept: 0,
  protectedFromKept: 0,
  noGeometry: 0,
  agreed: 0,
  withdrawn: 0,
};
const withdrawn = [];

const walk = node => {
  if (Array.isArray(node)) {
    for (const beach of node) {
      if (!beach || typeof beach !== 'object' || !beach.name) continue;
      stats.total += 1;

      const orientation = beach.metadata?.orientation;
      if (!orientation || typeof orientation.degrees !== 'number') continue;
      if (!claimsSunset(orientation.degrees) && !octantFacesSunset(orientation.faces?.[0])) continue;
      stats.claimedSunset += 1;

      // Ανθρώπινη γνώση — δύο ανεξάρτητοι δείκτες, ο ένας αρκεί για να μείνει άθικτη.
      if (!AUTO_NOTES_SIGNATURE.test(orientation.notes || '')) { stats.authoredKept += 1; continue; }
      if (Array.isArray(orientation.protectedFrom) && orientation.protectedFrom.length > 0) {
        stats.protectedFromKept += 1;
        continue;
      }

      const geoFacing = geoFacingById.get(beach.id);
      if (typeof geoFacing !== 'number') { stats.noGeometry += 1; continue; }

      // Η γεωμετρία πρέπει να διαψεύδει ΚΑΙ ΤΙΣ ΔΥΟ πύλες. Οριακές περιπτώσεις μένουν.
      if (claimsSunset(geoFacing)) { stats.agreed += 1; continue; }

      const nextDegrees = Math.round(normalizeDegrees(geoFacing) * 10) / 10;
      const nextFace = SECTOR_TO_DIRECTION[sectorFromDegrees(nextDegrees)];
      withdrawn.push({
        id: beach.id,
        name: beach.name,
        from: orientation.degrees,
        to: nextDegrees,
        fromFace: orientation.faces?.[0],
        toFace: nextFace,
      });
      orientation.degrees = nextDegrees;
      orientation.faces = [nextFace];
      orientation.notes = `${orientation.notes} Ευθυγραμμίστηκε με τη γεωμετρία (14/08/2026): η γραμμένη κατεύθυνση υποσχόταν ηλιοβασίλεμα που η γεωμετρία διαψεύδει.`;
      stats.withdrawn += 1;
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) walk(value);
};

walk(source);

console.log(`${write ? 'ΓΡΑΦΤΗΚΕ' : 'ΔΟΚΙΜΗ (dry run)'} — απόσυρση ψεύτικης υπόσχεσης ηλιοβασιλέματος`);
console.log('');
console.log(`  παραλίες συνολικά:                 ${stats.total}`);
console.log(`  υπόσχονταν ηλιοβασίλεμα:           ${stats.claimedSunset}`);
console.log(`  → η γεωμετρία συμφωνεί, μένουν:    ${stats.agreed}`);
console.log(`  → ΑΠΟΣΥΡΘΗΚΕ η υπόσχεση:           ${stats.withdrawn}`);
console.log(`  χειρόγραφες — δεν πειράχτηκαν:     ${stats.authoredKept}`);
console.log(`  με protectedFrom — άθικτες:        ${stats.protectedFromKept}`);
console.log(`  χωρίς γεωμετρία — μένουν ως έχουν: ${stats.noGeometry}`);
console.log('');
console.log('ΔΕΙΓΜΑ ΑΠΟ ΟΣΕΣ ΑΠΟΣΥΡΘΗΚΑΝ:');
withdrawn.slice(0, 12).forEach(c => console.log(`  ${c.name}: ${c.from}° (${c.fromFace}) → ${c.to}° (${c.toFace})`));

if (write) {
  // Γράψε σε προσωρινό και μετονόμασε: το αρχείο είναι δεκάδες MB και μια διακοπή στη μέση
  // θα άφηνε μισό αρχείο.
  const tmpPath = `${beachesPath}.tmp`;
  fs.writeFileSync(tmpPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');
  fs.renameSync(tmpPath, beachesPath);

  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, 'sunset-withdrawn-2026-08-14.json');
  const reportTmp = `${reportPath}.tmp`;
  fs.writeFileSync(reportTmp, `${JSON.stringify({ generatedAt: '2026-08-14', stats, withdrawn }, null, 2)}\n`, 'utf8');
  fs.renameSync(reportTmp, reportPath);
  console.log('');
  console.log(`Αναφορά: ${path.relative(rootDir, reportPath)}`);
}
