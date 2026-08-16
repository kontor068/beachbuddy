/**
 * Η ΡΑΜΠΑ ΑΝΤΙ ΓΙΑ ΤΟΝ ΔΙΑΚΟΠΤΗ — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (βίβλος §Γ3, 13/08/2026). Ο αριθμός του κύματος στην ακτή είναι διακόπτης: το
 * `utils/shoreWave` είτε σιωπά — και η οθόνη δείχνει την ανοιχτή θάλασσα — είτε μιλάει και τυπώνει
 * σχεδόν πάντα το δάπεδο εμφάνισης 0,10 μ. Στο 94-100% των περιπτώσεων δεν υπάρχει τίποτα
 * ενδιάμεσο. Το κατώφλι που αποφασίζει είναι το `OFFSHORE_FLAT_MAX_ONSHORE = −0,8`, και σε
 * γειτονικά ζευγάρια <5 χλμ με ΙΔΙΑ φυσική κατάσταση το 40% παίρνει αντίθετη απάντηση μόνο επειδή
 * η μία παραλία πέφτει πάνω και η άλλη κάτω από αυτό. Η χαλάρωση του κατωφλίου μετρήθηκε και
 * απορρίφθηκε (10.716 → 10.718 ασυμφωνίες): μετακινεί τον διακόπτη, δεν τον καταργεί.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΑΥΤΟ. Σταδιακή ανάμειξη της εκτίμησης ακτής με το ανοιχτό νερό καθώς το `onshore`
 * πάει από −1 προς το κατώφλι. ΔΕΝ αλλάζει καμία γραμμή παραγωγής: το `utils/shoreWave` φορτώνεται
 * κανονικά, κρατιέται η αυθεντική συνάρτηση ως βάση σύγκρισης, και οι υποψήφιες καμπύλες μπαίνουν
 * με αντικατάσταση του export μέσα σε αυτή τη διεργασία μόνο. Ο μοναδικός καλών είναι
 * services/recommendationService.ts:2324, οπότε η αντικατάσταση πιάνει όλη τη διαδρομή —
 * ετυμηγορία κολύμβησης, 25 πόντοι «νερό», σειρά podium — και όχι μόνο το τυπωμένο νούμερο.
 *
 * ΓΙΑΤΙ ΤΑ ΤΕΣΣΕΡΑ ΝΟΥΜΕΡΑ ΤΗΣ ΑΝΑΦΟΡΑΣ ΕΙΝΑΙ ΑΥΤΑ ΚΑΙ ΟΧΙ ΑΛΛΑ (§Γ3, «η σειρά δουλειάς»):
 *   (α) πόσες παραλίες κατεβαίνει ο αριθμός και πόσο — η ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση, μετριέται πρώτη·
 *   (β) πόσες γυρίζουν avoid_swimming → caution — η βαρύτερη λέξη που λέμε·
 *   (γ) σε πόσες περιοχές αλλάζει η σειρά του podium και ποιος μπαίνει/βγαίνει·
 *   (δ) πόσο μειώνεται όντως η ασυμφωνία γειτονικών ζευγαριών — αν δεν πέφτει, η ράμπα δεν αξίζει.
 *
 * Η ΜΟΝΟΔΡΟΜΗ ΕΚΔΟΧΗ ΕΙΝΑΙ ΥΠΟΨΗΦΙΑ ΙΣΟΤΙΜΑ. Η §7δ απαιτεί κάθε εξαίρεση να είναι «μονόδρομη».
 * Μια ράμπα που κρατά την ίδια πύλη (−0,8) και απλώς σβήνει το άλμα ΜΕΣΑ της δεν κάνει καμία
 * παραλία πιο ήρεμη από σήμερα — μόνο πιο άγρια — άρα δεν μπορεί να κατασκευάσει ψεύτικη ηρεμία.
 * Οι πλατύτερες ράμπες (−0,65 / −0,5) σηκώνουν και παραλίες που σήμερα σιωπούν, δηλαδή κινούνται
 * προς την επικίνδυνη κατεύθυνση, και γι' αυτό η αναφορά τους μετράει χωριστά.
 *
 * ΤΑ ΟΡΙΑ ΤΗΣ ΜΕΤΡΗΣΗΣ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ:
 *  - Το ζωντανό μισό σκοράρει σε επίπεδο ΗΜΕΡΑΣ (day 0, ό,τι ανοίγει η σελίδα), όχι ανά ώρα του
 *    ρυθμιστή. Τα ωριαία δέλτα διαφέρουν σε μέγεθος· δεν μπορούν να διαφέρουν σε κατεύθυνση,
 *    γιατί και οι δύο αρμοί περνούν από τον ίδιο συνοψιστή.
 *  - Είναι ΕΝΑ στιγμιότυπο ενός κύκλου πρόγνωσης. Μετράει εμβέλεια, όχι αν ο νέος αριθμός είναι
 *    πιο κοντά στην αλήθεια — για ακτογραμμή δεν υπάρχει κριτής (§7δ) και αυτό δεν αλλάζει.
 *  - Ο άνεμος είναι της περιοχής. Για τη σύγκριση γειτόνων αυτό είναι το σωστό: δύο παραλίες 2 χλμ
 *    μακριά έχουν τον ίδιο άνεμο, άρα ό,τι τις χωρίζει είναι η γεωμετρία τους.
 *
 * Run: node scripts/measureShoreWaveRamp.mjs            (δομικό μισό, χωρίς δίκτυο)
 *      node scripts/measureShoreWaveRamp.mjs --live     (+ εθνικό πέρασμα)
 *      node scripts/measureShoreWaveRamp.mjs --live --regions=attica-east-attica-mainland
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// services/weatherService.ts arms its request timeout with window.setTimeout — see
// scripts/auditPerBeachWaveImpact.mjs for why this is pointed at globalThis rather than forked.
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile(
      'exports.getNegativeFeedbackCount = function () { return 0; };\n'
      + 'exports.recordOpenMeteoCall = function () {};\n',
      filename
    );
    return;
  }
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

const shoreWaveModule = require(path.join(root, 'utils/shoreWave.ts'));
const { SHORE_DISPLAY_FLOOR_M } = shoreWaveModule;
const originalEstimate = shoreWaveModule.estimateShoreWaveHeightM;
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const {
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MAX_ONSHORE,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
// ⚠️ Το podium ΔΕΝ είναι οι τρεις πρώτες του getSuitableBeaches. Η πρώτη εκδοχή αυτού του αρχείου
// το υπέθεσε, μέτρησε τη γενική λίστα και ανέφερε «0/110 περιοχές αλλάζουν» για ΟΛΕΣ τις καμπύλες —
// δηλαδή ακριβώς το αποτέλεσμα που θα έκανε τη ράμπα να φαίνεται ακίνδυνη. Οι 25 πόντοι «νερό»
// ζουν στο utils/topPickScoreTable, το οποίο τρέχει μόνο μέσα από εδώ.
const { prioritizeProtectedRecommendations } = require(path.join(root, 'services/topPickRanking.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const cachePath = path.join(root, '.tmp/shore-wave-ramp-cache.json');

const DAY_INDEX = 0;
const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ─────────────────────────────────────────────────────────────────────────────
// ΟΙ ΥΠΟΨΗΦΙΕΣ ΚΑΜΠΥΛΕΣ
//
// `openAt` είναι το onshore όπου το βάρος της ακτής μηδενίζεται, δηλαδή όπου η ράμπα καταλήγει
// ακριβώς στο ανοιχτό νερό (και άρα σιωπά, μέσω του ίδιου καπακιού που έχει σήμερα η συνάρτηση).
// Στο onshore = −1 το βάρος είναι 1, δηλαδή ακριβώς η σημερινή εκτίμηση SMB. Ενδιάμεσα, γραμμικά.
//
// Το `switch` δεν είναι καμπύλη — είναι ο ΣΗΜΕΡΙΝΟΣ κώδικας, αυτούσιος, ως βάση σύγκρισης.
// ─────────────────────────────────────────────────────────────────────────────
//
// `holdTo` (προστέθηκε 16/08/2026) είναι το onshore ΜΕΧΡΙ το οποίο το βάρος μένει καρφωμένο στο 1,
// δηλαδή μια ΠΛΑΤΦΟΡΜΑ πριν αρχίσει η ράμπα. Χωρίς αυτό, κάθε ράμπα αρχίζει να ξεφουσκώνει από το
// −1 και άρα ΑΝΕΒΑΖΕΙ τον αριθμό σε παραλίες που σήμερα μιλάνε σωστά (Σχινιάς 0,17 → 0,63 μ. στη
// −0,50 γραμμική — η παραλία για την οποία ΧΤΙΣΤΗΚΕ η λειτουργία, με webcam που έδειχνε λάδι).
// Με `holdTo = −0,80` η καμπύλη είναι ταυτοτικά ο σημερινός κώδικας για όποια παραλία μιλάει ήδη,
// και ράμπα ΜΟΝΟ μέσα στη ζώνη που σήμερα σιωπά.
// ─────────────────────────────────────────────────────────────────────────────
const CURVES = [
  { key: 'switch', label: 'σήμερα (διακόπτης)', openAt: null, exponent: 1 },
  { key: 'ramp-080', label: 'ράμπα −1,00 → −0,80 γραμμική (ΜΟΝΟΔΡΟΜΗ)', openAt: -0.8, exponent: 1 },
  { key: 'ramp-080-soft', label: 'ράμπα −1,00 → −0,80 ήπια (ΜΟΝΟΔΡΟΜΗ)', openAt: -0.8, exponent: 0.35 },
  { key: 'ramp-065', label: 'ράμπα −1,00 → −0,65 γραμμική', openAt: -0.65, exponent: 1 },
  { key: 'ramp-050', label: 'ράμπα −1,00 → −0,50 γραμμική', openAt: -0.5, exponent: 1 },
  { key: 'plateau-050', label: 'ΠΛΑΤΦΟΡΜΑ ως −0,80 → ράμπα ως −0,50', openAt: -0.5, exponent: 1, holdTo: -0.8 },
  { key: 'plateau-065', label: 'ΠΛΑΤΦΟΡΜΑ ως −0,80 → ράμπα ως −0,65', openAt: -0.65, exponent: 1, holdTo: -0.8 },
];

/**
 * Το βάρος της εκτίμησης ακτής: 1 στο onshore = −1 (κατάματα απόγειος, δηλαδή ακριβώς η σημερινή
 * συμπεριφορά), 0 στο `openAt` (καθαρή ανοιχτή θάλασσα, δηλαδή σιωπή).
 *
 * Ο εκθέτης είναι το ΣΧΗΜΑ και όχι διακοσμητικός. Γραμμικά, μια παραλία στο −0,90 παίρνει βάρος
 * 0,50 — δηλαδή ο μισός αριθμός της έρχεται από το πέλαγος έξω, και μια παραλία που σήμερα τυπώνει
 * 0,17 μ. πάει στο 1,3. Αυτό ΑΚΥΡΩΝΕΙ στην πράξη τη λειτουργία της 05/08 για τις παραλίες που
 * χτίστηκε (μετρήθηκε ζωντανά στον Σχινιά, 13/08). Ο εκθέτης 0,35 κρατά την ακτή πολύ περισσότερο
 * (βάρος 0,78 στο −0,90) και σβήνει απότομα μόνο κοντά στο κατώφλι, που είναι και το σημείο όπου
 * η γεωμετρία γίνεται όντως αναξιόπιστη.
 */
const rampWeight = (onshore, openAt, exponent, holdTo = -1) => {
  const start = Math.max(-1, Math.min(holdTo, openAt));
  if (onshore <= start) return 1;
  const span = openAt - start;
  if (!(span > 0)) return 1;
  const linear = Math.max(0, Math.min(1, (openAt - onshore) / span));
  return exponent === 1 ? linear : linear ** exponent;
};

/**
 * Η ράμπα. ΟΛΕΣ οι άλλες πύλες μένουν βυζαντινά ίδιες με τη σημερινή συνάρτηση — άνοιγμα,
 * φράξιμο, εμπιστοσύνη, ύποπτο pin, αποθαλασσιά, υπαρκτή μέτρηση ανοιχτής θάλασσας, δάπεδο
 * εμφάνισης και το καπάκι «ποτέ πιο δυνατά από τη θάλασσα έξω». Αλλάζει ΜΟΝΟ το τι γίνεται στο
 * onshore: αντί για ναι/όχι στο −0,8, βάρος που σβήνει σταδιακά.
 */
const rampEstimate = (input, openAt, exponent, holdTo) => {
  if (input.arrivingSwellPresent) return undefined;
  if (input.suspectPin) return undefined;
  if (input.confidence !== 'high') return undefined;
  const openWaterM = input.openWaterWaveHeightM;
  if (typeof openWaterM !== 'number' || !Number.isFinite(openWaterM)) return undefined;
  const windSpeedKmh = input.windSpeedKmh;
  if (typeof windSpeedKmh !== 'number' || !Number.isFinite(windSpeedKmh)) return undefined;
  if (!input.sector) return undefined;

  const { fetchKm, blockedRayRatio, onshore } = input.sector;
  if (typeof fetchKm !== 'number' || typeof blockedRayRatio !== 'number' || typeof onshore !== 'number') {
    return undefined;
  }
  if (blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return undefined;
  if (fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return undefined;
  if (onshore > openAt) return undefined;

  const weight = rampWeight(onshore, openAt, exponent, holdTo);
  const modelledM = estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm });
  const blendedM = weight * modelledM + (1 - weight) * openWaterM;
  const shoreM = Math.max(SHORE_DISPLAY_FLOOR_M, blendedM);
  if (shoreM >= openWaterM) return undefined;
  return Number(shoreM.toFixed(2));
};

let activeCurve = CURVES[0];
shoreWaveModule.estimateShoreWaveHeightM = (input) => (
  activeCurve.openAt === null ? originalEstimate(input) : rampEstimate(input, activeCurve.openAt, activeCurve.exponent, activeCurve.holdTo)
);

// Δίχτυ πάνω στο ίδιο το εργαλείο: αν η αντικατάσταση δεν έφτανε στο scoring, κάθε καμπύλη θα
// έβγαζε τα ίδια νούμερα και η αναφορά θα έλεγε ψέματα ήσυχα. Ελέγχεται με κλήση, όχι με ελπίδα.
{
  const probe = {
    openWaterWaveHeightM: 1.2,
    windSpeedKmh: 38,
    sector: { fetchKm: 0.2, blockedRayRatio: 1, onshore: -0.9 },
    confidence: 'high',
    suspectPin: false,
    arrivingSwellPresent: false,
  };
  activeCurve = CURVES[0];
  const asSwitch = shoreWaveModule.estimateShoreWaveHeightM(probe);
  activeCurve = CURVES[1];
  const asRamp = shoreWaveModule.estimateShoreWaveHeightM(probe);
  activeCurve = CURVES[0];
  // Ο τομέας της δοκιμής περνά κάθε πύλη, άρα ο διακόπτης ΠΡΕΠΕΙ να μιλήσει (SMB πάνω σε 0,2 χλμ
  // στα 38 χλμ/ώρα = 0,13 μ.) και η μονόδρομη ράμπα ΠΡΕΠΕΙ να δώσει μεγαλύτερο νούμερο, ποτέ ίσο:
  // ίσο θα σήμαινε ότι το scoring διαβάζει ακόμα την αυθεντική συνάρτηση και η αναφορά είναι άκυρη.
  if (!(typeof asSwitch === 'number' && typeof asRamp === 'number' && asRamp > asSwitch)) {
    console.error(`ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: η αντικατάσταση δεν άλλαξε το αποτέλεσμα (switch=${asSwitch}, ramp=${asRamp}).`);
    process.exit(1);
  }
}

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};
const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return {
      regionId: file.replace(/\.json$/, ''),
      beaches: app.island.beaches,
      regionPoint: app.island.coordinates,
      profiles,
    };
  } catch {
    return null;
  }
};

const regions = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .map(loadRegion)
  .filter(Boolean)
  .filter(region => region.regionPoint && Number.isFinite(region.regionPoint.lat))
  .filter(region => !regionFilter || regionFilter.includes(region.regionId));

// ─────────────────────────────────────────────────────────────────────────────
// ΔΟΜΙΚΟ ΜΙΣΟ — χωρίς δίκτυο. Πόσο κινείται η ΕΡΩΤΗΣΗ, όχι η απάντηση.
//
// Το ίδιο πλέγμα με τη μέτρηση της §Γ3: κάθε προφίλ × 8 τομείς, με τρεις εντάσεις ανέμου και μια
// τυπική ανοιχτή θάλασσα ανά ένταση (η αντιστοίχιση ταχύτητας→ανοιχτού είναι εκείνη που κάνει τη
// σύγκριση δίκαιη: ένας βοριάς 40 χλμ/ώρα δεν συνυπάρχει με 0,2 μ. πέλαγος).
// ─────────────────────────────────────────────────────────────────────────────
const STRUCTURAL_WINDS = [
  { windKmh: 20, openWaterM: 0.35 },
  { windKmh: 40, openWaterM: 0.9 },
  { windKmh: 60, openWaterM: 1.6 },
];

const structural = CURVES.map(curve => ({
  key: curve.key,
  label: curve.label,
  spoke: 0,
  atFloor: 0,
  heights: [],
  perWind: STRUCTURAL_WINDS.map(w => ({ windKmh: w.windKmh, spoke: 0, heights: [] })),
}));
let structuralCombos = 0;

for (const region of regions) {
  for (const profile of Object.values(region.profiles)) {
    if (profile.confidence !== 'high') continue;
    for (const sectorKey of SECTOR_ORDER) {
      const sector = profile.sectors?.[sectorKey];
      if (!sector) continue;
      structuralCombos += 1;
      STRUCTURAL_WINDS.forEach((wind, windIndex) => {
        CURVES.forEach((curve, curveIndex) => {
          activeCurve = curve;
          const height = shoreWaveModule.estimateShoreWaveHeightM({
            openWaterWaveHeightM: wind.openWaterM,
            windSpeedKmh: wind.windKmh,
            sector: { fetchKm: sector.fetchKm, blockedRayRatio: sector.blockedRayRatio, onshore: sector.onshore },
            confidence: profile.confidence,
            suspectPin: false,
            arrivingSwellPresent: false,
          });
          if (typeof height !== 'number') return;
          const bucket = structural[curveIndex];
          bucket.spoke += 1;
          bucket.heights.push(height);
          if (height <= SHORE_DISPLAY_FLOOR_M + 1e-9) bucket.atFloor += 1;
          bucket.perWind[windIndex].spoke += 1;
          bucket.perWind[windIndex].heights.push(height);
        });
      });
    }
  }
}
activeCurve = CURVES[0];

console.log('── ΔΟΜΙΚΟ: πόσο κινείται η ερώτηση ─────────────────────────────────');
console.log(`${structuralCombos} συνδυασμοί παραλίας × τομέα (high confidence) σε ${regions.length} περιοχές, × ${STRUCTURAL_WINDS.length} εντάσεις.`);
for (const bucket of structural) {
  const denom = structuralCombos * STRUCTURAL_WINDS.length;
  console.log(`  ${bucket.label}`);
  console.log(`    μιλάει σε ${bucket.spoke} (${pct(bucket.spoke, denom)}) · στο δάπεδο 0,10 μ.: ${bucket.spoke ? pct(bucket.atFloor, bucket.spoke) : '—'}`
    + ` · διάμεσος ${percentile(bucket.heights, 0.5).toFixed(2)} μ. · p90 ${percentile(bucket.heights, 0.9).toFixed(2)} μ. · max ${(bucket.heights.length ? Math.max(...bucket.heights) : 0).toFixed(2)} μ.`);
}

if (!LIVE) {
  console.log('\nΤρέξε με --live για το τι αλλάζει στην οθόνη, στην ετυμηγορία και στο podium.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ΖΩΝΤΑΝΟ ΜΙΣΟ — κάθε παραλία σκοράρεται 4 φορές από ΤΟΝ ΙΔΙΟ άνεμο και ΤΗΝ ΙΔΙΑ θάλασσα.
// ─────────────────────────────────────────────────────────────────────────────
const CONCURRENCY = 1;
const REGION_DELAY_MS = 250;
const RETRY_BACKOFF_MS = [20000, 45000, 90000];
const MIN_COVERAGE = 0.9;
const POINTS_PER_MINUTE = 450;
const pointWindow = [];
const paceForPoints = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60_000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    const waitMs = Math.max(1000, pointWindow[0].at + 60_000 - performance.now());
    process.stderr.write(`\r  rate limit: ${spent} points σε ένα λεπτό, αναμονή ${Math.ceil(waitMs / 1000)}s…        `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

/** Ο αριθμός που ΒΛΕΠΕΙ ο χρήστης: η ακτή όταν μιλάει, αλλιώς η ανοιχτή θάλασσα. */
const printedM = (score) => (
  typeof score.shoreWaveHeightM === 'number' && Number.isFinite(score.shoreWaveHeightM)
    ? score.shoreWaveHeightM
    : (typeof score.seaStateWaveM === 'number' ? score.seaStateWaveM : null)
);

const distanceKm = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
};

const NEIGHBOUR_MAX_KM = 5;
/** «Ίδια φυσική κατάσταση» — ο ορισμός της §Γ3, ώστε τα δύο νούμερα να είναι συγκρίσιμα. */
const SAME_PHYSICS_MAX_ONSHORE = -0.5;
/** Πάνω από τόσο, δύο γείτονες με ίδια φυσική λένε πραγματικά διαφορετικό πράγμα στον αναγνώστη. */
const NEIGHBOUR_GAP_M = 0.5;

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  await paceForPoints(resolution.points.length + 1);

  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);

  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { regionId: region.regionId, skipped: 'no wind' };

  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const regionDays = processForecastData(mergeMarineForecastData(wind.data, regionMarine));
  const regionDay = regionDays[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  // `deg`, όχι `direction` (types.ts:764). Η πρώτη εκδοχή διάβαζε `direction`, έπαιρνε undefined
  // παντού, και το σκέλος των γειτόνων έβγαζε ΜΗΔΕΝ ζευγάρια — δηλαδή «καμία ασυμφωνία», που θα
  // ήταν το πιο βολικό λάθος που θα μπορούσε να κάνει αυτή η μέτρηση.
  const windDirectionDeg = regionDay.wind?.deg;
  const dayByBeachId = new Map();
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    dayByBeachId.set(beach.id, beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay);
  }

  const scoresByCurve = new Map();
  const top3ByCurve = {};
  for (const curve of CURVES) {
    activeCurve = curve;
    const scores = new Map();
    for (const beach of region.beaches) {
      const dayForecast = dayByBeachId.get(beach.id);
      scores.set(beach.id, calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      }));
    }
    scoresByCurve.set(curve.key, scores);
    const suitable = getSuitableBeaches(
      region.beaches, regionDay, 'gr', undefined, regionDay.hourly, undefined, undefined, region.profiles, scores
    );
    // `toneRank` μένει undefined επίτηδες: το χρώμα του χάρτη κάθεται ΠΑΝΩ από το σκορ και δεν το
    // αγγίζει η ράμπα (το shoreWave δεν μπαίνει σε χρώμα), οπότε αφήνοντάς το σιωπηλό μετράμε
    // καθαρά τη μία επίδραση που ψάχνουμε — τους 25 πόντους «νερό».
    top3ByCurve[curve.key] = prioritizeProtectedRecommendations(
      suitable, getBeaufortLevel((regionDay.wind?.speed ?? 0) * 3.6)
    ).slice(0, 3).map(item => item.beach.id);
  }
  activeCurve = CURVES[0];

  const baseScores = scoresByCurve.get('switch');
  const rows = [];
  let noData = 0;

  for (const beach of region.beaches) {
    const base = baseScores.get(beach.id);
    const basePrinted = printedM(base);
    if (basePrinted === null) { noData += 1; continue; }

    const profile = region.profiles[beach.id];
    const sectorKey = typeof windDirectionDeg === 'number' ? windSectorFromDegrees(windDirectionDeg) : null;
    const sector = sectorKey ? profile?.sectors?.[sectorKey] : null;
    const liveOnshore = (profile && typeof profile.facingDeg === 'number' && typeof windDirectionDeg === 'number')
      ? onshoreComponent(windDirectionDeg, profile.facingDeg)
      : null;

    const row = {
      beachId: beach.id,
      name: beach.name?.gr ?? null,
      coordinates: beach.coordinates ?? null,
      confidence: profile?.confidence ?? null,
      onshore: liveOnshore === null ? null : Number(liveOnshore.toFixed(3)),
      fetchKm: typeof sector?.fetchKm === 'number' ? sector.fetchKm : null,
      blockedRayRatio: typeof sector?.blockedRayRatio === 'number' ? sector.blockedRayRatio : null,
      byCurve: {},
    };
    for (const curve of CURVES) {
      const score = scoresByCurve.get(curve.key).get(beach.id);
      row.byCurve[curve.key] = {
        printedM: printedM(score),
        shoreM: typeof score.shoreWaveHeightM === 'number' ? score.shoreWaveHeightM : null,
        comfort: score.swimmingComfort ?? null,
      };
    }
    rows.push(row);
  }

  return {
    regionId: region.regionId,
    windKmh: Number(((regionDay.wind?.speed ?? 0) * 3.6).toFixed(1)),
    windDirectionDeg: typeof windDirectionDeg === 'number' ? Math.round(windDirectionDeg) : null,
    beaches: region.beaches.length,
    noData,
    rows,
    top3ByCurve,
  };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

const runPool = async (items, worker) => {
  const out = [];
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt += 1) {
        try {
          out[index] = await worker(item);
        } catch (error) {
          out[index] = { regionId: item.regionId, skipped: error.message };
        }
        if (regionComplete(out[index]) || attempt === RETRY_BACKOFF_MS.length) break;
        process.stderr.write(`\r  ${item.regionId}: ημιτελής, αναμονή ${RETRY_BACKOFF_MS[attempt] / 1000}s…            `);
        await sleep(RETRY_BACKOFF_MS[attempt]);
      }
      process.stderr.write(`\r  ${out.filter(Boolean).length}/${items.length} περιοχές                              `);
      await sleep(REGION_DELAY_MS);
    }
  }));
  process.stderr.write('\n');
  return out;
};

// Ο κώδικας βαθμολόγησης ΚΑΙ οι καμπύλες αυτού του αρχείου μπαίνουν στη σφραγίδα: αλλιώς ένα
// resume θα ανακάτευε αποτελέσματα δύο διαφορετικών ραμπών κάτω από το ίδιο όνομα.
const codeStamp = [
  'services/recommendationService.ts',
  'utils/shoreWave.ts',
  'utils/waveModel.ts',
  'utils/weatherUtils.ts',
  'scripts/measureShoreWaveRamp.mjs',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + '@' + new Date().toISOString().slice(0, 10);

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
  else console.log('  Η μνήμη πετάχτηκε: άλλαξε ο κώδικας ή η μέρα της πρόγνωσης.');
} catch { /* first run */ }

const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));
console.log(`\n── ΖΩΝΤΑΝΟ: ${regions.length - toFetch.length} περιοχές από μνήμη, ${toFetch.length} νέες ──────────`);
const fetched = (await runPool(toFetch, measureRegion)).filter(Boolean);
for (const result of fetched) {
  if (result?.regionId) cache[result.regionId] = result;
}
mkdirSync(path.dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify({ codeStamp, regions: cache }));

const results = regions.map(region => cache[region.regionId]).filter(regionComplete);
const coverage = results.length / Math.max(1, regions.length);

// ─────────────────────────────────────────────────────────────────────────────
// (α) Ο ΑΡΙΘΜΟΣ · (β) Η ΕΤΥΜΗΓΟΡΙΑ · (γ) ΤΟ PODIUM · (δ) ΟΙ ΓΕΙΤΟΝΕΣ
// ─────────────────────────────────────────────────────────────────────────────
const COMFORT_ORDER = ['avoid_swimming', 'caution', 'good', 'excellent'];
const comfortRank = (value) => {
  const index = COMFORT_ORDER.indexOf(value);
  return index === -1 ? null : index;
};

const summary = {};
for (const curve of CURVES.filter(c => c.key !== 'switch')) {
  summary[curve.key] = {
    label: curve.label,
    monotoneByDesign: curve.openAt === OFFSHORE_FLAT_MAX_ONSHORE,
    beachesMeasured: 0,
    spokeBefore: 0,
    spokeAfter: 0,
    calmer: 0,
    calmerDeltas: [],
    calmerExamples: [],
    rougher: 0,
    rougherDeltas: [],
    comfortSofter: 0,
    comfortStricter: 0,
    comfortMoves: {},
    softerExamples: [],
    podiumRegionsChanged: 0,
    podiumOrderOnly: 0,
    podiumExamples: [],
  };
}

const neighbourStats = {};
for (const curve of CURVES) neighbourStats[curve.key] = { pairs: 0, contradictions: 0, wideGaps: 0, gaps: [] };

for (const result of results) {
  for (const row of result.rows) {
    const base = row.byCurve.switch;
    if (base.printedM === null) continue;
    for (const curve of CURVES) {
      if (curve.key === 'switch') continue;
      const cell = row.byCurve[curve.key];
      const bucket = summary[curve.key];
      bucket.beachesMeasured += 1;
      if (base.shoreM !== null) bucket.spokeBefore += 1;
      if (cell.shoreM !== null) bucket.spokeAfter += 1;
      if (cell.printedM === null) continue;

      const delta = Number((cell.printedM - base.printedM).toFixed(2));
      if (delta < -0.005) {
        bucket.calmer += 1;
        bucket.calmerDeltas.push(-delta);
        if (bucket.calmerExamples.length < 12) {
          bucket.calmerExamples.push({
            region: result.regionId, name: row.name, onshore: row.onshore,
            beforeM: base.printedM, afterM: cell.printedM,
          });
        }
      } else if (delta > 0.005) {
        bucket.rougher += 1;
        bucket.rougherDeltas.push(delta);
      }

      const before = comfortRank(base.comfort);
      const after = comfortRank(cell.comfort);
      if (before === null || after === null || before === after) continue;
      const move = `${base.comfort} → ${cell.comfort}`;
      bucket.comfortMoves[move] = (bucket.comfortMoves[move] ?? 0) + 1;
      if (after > before) {
        bucket.comfortSofter += 1;
        if (bucket.softerExamples.length < 12) {
          bucket.softerExamples.push({
            region: result.regionId, name: row.name, onshore: row.onshore, move,
            beforeM: base.printedM, afterM: cell.printedM,
          });
        }
      } else {
        bucket.comfortStricter += 1;
      }
    }
  }

  // (γ) podium
  for (const curve of CURVES) {
    if (curve.key === 'switch') continue;
    const before = result.top3ByCurve.switch ?? [];
    const after = result.top3ByCurve[curve.key] ?? [];
    if (before.join(',') === after.join(',')) continue;
    const bucket = summary[curve.key];
    bucket.podiumRegionsChanged += 1;
    const sameSet = before.length === after.length && before.every(id => after.includes(id));
    if (sameSet) bucket.podiumOrderOnly += 1;
    if (bucket.podiumExamples.length < 12) {
      const nameOf = (id) => result.rows.find(r => r.beachId === id)?.name ?? String(id);
      bucket.podiumExamples.push({
        region: result.regionId,
        before: before.map(nameOf),
        after: after.map(nameOf),
        orderOnly: sameSet,
      });
    }
  }

  // (δ) γείτονες: ίδια περιοχή (άρα ίδιος άνεμος), <5 χλμ, και οι δύο με απόγειο άνεμο και
  // κλειστή γεωμετρία — δηλαδή ίδια φυσική κατάσταση.
  const candidates = result.rows.filter(row => (
    row.coordinates && Number.isFinite(row.coordinates.lat)
    && row.confidence === 'high'
    && typeof row.onshore === 'number' && row.onshore <= SAME_PHYSICS_MAX_ONSHORE
    && typeof row.fetchKm === 'number' && row.fetchKm <= OFFSHORE_FLAT_MAX_FETCH_KM
    && typeof row.blockedRayRatio === 'number' && row.blockedRayRatio >= OFFSHORE_FLAT_MIN_BLOCKED_RATIO
  ));
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i];
      const b = candidates[j];
      if (distanceKm(a.coordinates, b.coordinates) > NEIGHBOUR_MAX_KM) continue;
      for (const curve of CURVES) {
        const ca = a.byCurve[curve.key];
        const cb = b.byCurve[curve.key];
        if (ca.printedM === null || cb.printedM === null) continue;
        const stats = neighbourStats[curve.key];
        stats.pairs += 1;
        if ((ca.shoreM === null) !== (cb.shoreM === null)) stats.contradictions += 1;
        const gap = Math.abs(ca.printedM - cb.printedM);
        stats.gaps.push(gap);
        if (gap >= NEIGHBOUR_GAP_M) stats.wideGaps += 1;
      }
    }
  }
}

console.log(`\nΠεριοχές που απάντησαν: ${results.length}/${regions.length} (${pct(results.length, regions.length)}).`);
const totalBeaches = results.reduce((sum, r) => sum + r.rows.length, 0);
console.log(`Παραλίες με νούμερο: ${totalBeaches}.`);

console.log('\n── (α) Ο ΑΡΙΘΜΟΣ ─────────────────────────────────────────────────────');
for (const curve of CURVES.filter(c => c.key !== 'switch')) {
  const s = summary[curve.key];
  console.log(`  ${s.label}${s.monotoneByDesign ? '  ✅ καμία δεν γίνεται πιο ήρεμη — κατασκευαστικά' : '  ⚠️ κινείται και προς την επικίνδυνη κατεύθυνση'}`);
  console.log(`    μιλάει: ${s.spokeBefore} → ${s.spokeAfter} παραλίες`);
  console.log(`    ΠΙΟ ΗΡΕΜΕΣ: ${s.calmer} (${pct(s.calmer, s.beachesMeasured)}) · διάμεση πτώση ${percentile(s.calmerDeltas, 0.5).toFixed(2)} μ. · max ${(s.calmerDeltas.length ? Math.max(...s.calmerDeltas) : 0).toFixed(2)} μ.`);
  console.log(`    πιο άγριες: ${s.rougher} (${pct(s.rougher, s.beachesMeasured)}) · διάμεση άνοδος ${percentile(s.rougherDeltas, 0.5).toFixed(2)} μ.`);
}

console.log('\n── (β) Η ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ ───────────────────────────────────────');
for (const curve of CURVES.filter(c => c.key !== 'switch')) {
  const s = summary[curve.key];
  const moves = Object.entries(s.comfortMoves).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`  ${s.label}`);
  console.log(`    πιο επιεικής: ${s.comfortSofter} · αυστηρότερη: ${s.comfortStricter}${moves ? `\n    ${moves}` : ''}`);
}

console.log('\n── (γ) ΤΟ PODIUM ─────────────────────────────────────────────────────');
// Χωρίς αυτή τη γραμμή, «καμία αλλαγή» και «καμία λίστα» τυπώνονται ολόιδια.
const withPodium = results.filter(r => (r.top3ByCurve?.switch ?? []).length > 0).length;
console.log(`  (${withPodium}/${results.length} περιοχές βγάζουν podium σήμερα — αν αυτό είναι 0, τα παρακάτω δεν σημαίνουν τίποτα.)`);
for (const curve of CURVES.filter(c => c.key !== 'switch')) {
  const s = summary[curve.key];
  console.log(`  ${s.label}: αλλάζει σε ${s.podiumRegionsChanged}/${results.length} περιοχές (${pct(s.podiumRegionsChanged, results.length)})`
    + ` — μόνο σειρά: ${s.podiumOrderOnly}, αλλάζει πρόσωπα: ${s.podiumRegionsChanged - s.podiumOrderOnly}`);
}

console.log('\n── (δ) ΟΙ ΓΕΙΤΟΝΕΣ ΜΕ ΙΔΙΑ ΦΥΣΙΚΗ (<5 χλμ) ───────────────────────────');
for (const curve of CURVES) {
  const n = neighbourStats[curve.key];
  console.log(`  ${curve.label}: ${n.pairs} ζευγάρια · αντίθετη απάντηση ${n.contradictions} (${pct(n.contradictions, n.pairs)})`
    + ` · χάσμα ≥${NEIGHBOUR_GAP_M} μ.: ${n.wideGaps} (${pct(n.wideGaps, n.pairs)}) · διάμεσο χάσμα ${percentile(n.gaps, 0.5).toFixed(2)} μ.`);
}

// Οι δύο παραλίες της αναφοράς του Μίλτου (§Γ3) τυπώνονται πάντα ονομαστικά: μια εθνική μέση τιμή
// μπορεί να δείχνει καλή ενώ η συγκεκριμένη περίπτωση που ξεκίνησε τη δουλειά έχει χαλάσει.
const WATCHLIST_IDS = [32, 33];
const watchlist = [];
for (const result of results) {
  for (const row of result.rows) {
    if (!WATCHLIST_IDS.includes(row.beachId)) continue;
    watchlist.push({ region: result.regionId, ...row });
  }
}
if (watchlist.length) {
  console.log('\n── ΟΙ ΔΥΟ ΤΗΣ ΑΝΑΦΟΡΑΣ ───────────────────────────────────────────────');
  for (const row of watchlist) {
    const cells = CURVES.map(c => `${c.key} ${row.byCurve[c.key].printedM ?? '—'}`).join(' · ');
    console.log(`  ${row.name} (onshore ${row.onshore ?? '—'}, fetch ${row.fetchKm ?? '—'} χλμ): ${cells}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'shore-wave-ramp.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  dayIndex: DAY_INDEX,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  beachesMeasured: totalBeaches,
  curves: CURVES,
  watchlist,
  structural: structural.map(bucket => ({
    key: bucket.key,
    spoke: bucket.spoke,
    atFloorPct: bucket.spoke ? Number(((bucket.atFloor / bucket.spoke) * 100).toFixed(1)) : null,
    medianM: Number(percentile(bucket.heights, 0.5).toFixed(2)),
    p90M: Number(percentile(bucket.heights, 0.9).toFixed(2)),
    maxM: bucket.heights.length ? Number(Math.max(...bucket.heights).toFixed(2)) : null,
  })),
  summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, {
    ...value,
    calmerMedianM: Number(percentile(value.calmerDeltas, 0.5).toFixed(2)),
    calmerMaxM: value.calmerDeltas.length ? Number(Math.max(...value.calmerDeltas).toFixed(2)) : null,
    rougherMedianM: Number(percentile(value.rougherDeltas, 0.5).toFixed(2)),
    calmerDeltas: undefined,
    rougherDeltas: undefined,
  }])),
  neighbours: Object.fromEntries(Object.entries(neighbourStats).map(([key, value]) => [key, {
    pairs: value.pairs,
    contradictions: value.contradictions,
    wideGaps: value.wideGaps,
    medianGapM: Number(percentile(value.gaps, 0.5).toFixed(2)),
    gaps: undefined,
  }])),
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);

if (coverage < MIN_COVERAGE) {
  console.error(`\nΑΠΕΤΥΧΕ — απάντησε μόνο το ${pct(results.length, regions.length)} των περιοχών. Μερικό πέρασμα δεν είναι μικρότερη απάντηση, είναι μεροληπτική.`);
  process.exit(1);
}
