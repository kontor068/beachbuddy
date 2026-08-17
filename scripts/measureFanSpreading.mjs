/**
 * Η ΒΕΝΤΑΛΙΑ ΔΙΑΣΠΟΡΑΣ ΑΝΤΙ ΓΙΑ ΤΗ ΜΟΝΗ ΓΡΑΜΜΗ — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ. (Στάδιο 0, 17/08/2026)
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (HANDOVER-2026-08-17-bathymetry-shore-wave.md §4). Ο άνεμος δεν σπρώχνει ενέργεια
 * σε μία γραμμή αλλά σε βεντάλια ±30-40° (cos²ˢ directional spreading). Όλος ο άξονας «μπορεί να
 * φτάσει κύμα εδώ;» απαντιέται σήμερα με ΔΥΑΔΙΚΕΣ ερωτήσεις γωνίας: «φυσάει από τη στεριά;»
 * (onshore < −0,5), «υπάρχει στόμιο >2 χλμ σε ±90°;» (isEnclosedDrySector). Η φυσική ερώτηση είναι
 * συνεχής: πόση ενέργεια χτίζει ο άνεμος πάνω στο νερό που ΥΠΑΡΧΕΙ μέσα στη βεντάλια του;
 *
 *   H_fan² = Σ w(Δθ) · H_SMB(άνοιγμα(θ))²  /  Σ w(Δθ) ,  w = cos²ˢ(Δθ),  |Δθ| < 90°
 *
 * Το άθροισμα κανονικοποιείται πάνω σε ΟΛΟΚΛΗΡΗ τη βεντάλια (και στη στεριά, που δίνει 0) — έτσι
 * ο κλειστός όρμος βγάζει ~0 και το ανοιχτό πέλαγος βγάζει ~H_SMB(άνοιγμα). Το άνοιγμα ανά γωνία
 * είναι η ΙΔΙΑ παρεμβολή που τρέχει ζωντανά (utils/windExposureModel.interpolateSectorGeometry) —
 * καμία νέα γεωμετρία, κανένα νέο δεδομένο.
 *
 * ΤΙ ΠΙΑΝΕΙ ΠΟΥ ΔΕΝ ΠΙΑΝΕΙ ΤΙΠΟΤΑ ΣΗΜΕΡΑ: την κλάση «μπαίνει από το πλάι» (Πάνορμος Νάξου 2011 —
 * ξηρός νότιος τομέας, στόμιο ΝΔ 6,2 χλμ). Σήμερα αυτή η παραλία τυπώνει το νούμερο του πελάγους·
 * με τη βεντάλια θα τύπωνε την ενέργεια που περνάει από το στόμιο, ζυγισμένη με cos²ˢ(45°).
 * Εθνικά η κλάση είναι το 89,8% των 2.082 ξηρών-σιωπηλών τομέων που η §Γ21 ΔΕΝ ξεκλείδωσε.
 *
 * ⚠️ ΔΕΝ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΗ ΚΑΤΑΣΚΕΥΑΣΤΙΚΑ, ΚΑΙ ΓΙ' ΑΥΤΟ ΜΕΤΡΙΕΤΑΙ ΠΡΙΝ ΑΠΟΦΑΣΙΣΤΕΙ ΟΤΙΔΗΠΟΤΕ:
 *  - Σιωπηλές σήμερα παραλίες αποκτούν νούμερο ΜΙΚΡΟΤΕΡΟ από το πέλαγος (ηρεμότερη κατεύθυνση —
 *    η επικίνδυνη, σκανδάλη #1 της §9)·
 *  - Παραλίες που μιλούν σήμερα με το δάπεδο 0,10 μπορεί να ανέβουν (πιο άγρια — ασφαλής
 *    κατεύθυνση) ή, αν το H_fan φτάσει το πέλαγος, να ΣΙΩΠΗΣΟΥΝ (χάνουν τη φωνή — μετριέται
 *    χωριστά ως lostVoice).
 * Το καπάκι «ποτέ πιο δυνατά από τη θάλασσα έξω», το δάπεδο 0,10, η αποθαλασσιά, η εμπιστοσύνη,
 * το ύποπτο pin και οι πύλες φραξίματος/ανοίγματος (ratio = 1, fetch ≤ 0,5) μένουν ΑΥΤΟΥΣΙΑ σε
 * όλες τις παραλλαγές — η βεντάλια αντικαθιστά ΜΟΝΟ την οικογένεια ερωτήσεων γωνίας.
 *
 * ΟΙ ΠΑΡΑΛΛΑΓΕΣ. `today` είναι ο σημερινός κώδικας αυτούσιος (ράμπα −0,8→−0,5 + ξηρός ±90°).
 * `fan-dry-*` βάζει τη βεντάλια ΜΟΝΟ όπου ο ζωντανός τομέας είναι ξηρός (γενίκευση της §Γ21: ο
 * κλειστός όρμος συνεχίζει να λέει ~δάπεδο, ο Πάνορμος αποκτά το νούμερο του στομίου του).
 * `fan-all-*` αντικαθιστά ΟΛΟΚΛΗΡΗ την οικογένεια γωνίας (και τη ράμπα) μέσα στον φραγμένο
 * πληθυσμό. Ο εκθέτης s ελέγχει το πλάτος: s=1 → μισή ισχύς στις ±45°, s=2 → ±33°, s=3 → ±27°.
 *
 * ΠΩΣ ΔΙΑΒΑΖΕΤΑΙ Ο ΓΕΙΤΟΝΑΣ. Ίδιο τύλιγμα με το measureDrySectorWaveGate.mjs: η ζωντανή γεωμετρία
 * είναι παρεμβολή δύο τομέων και δεν κουβαλάει τους άλλους έξι, οπότε τυλίγεται η
 * `resolveCoveAwareWaveHeightM` — που δέχεται ΚΑΙ το προφίλ ΚΑΙ τη διεύθυνση ανέμου αμέσως πριν
 * χτιστεί το `sector` — και κρατιέται το ζευγάρι. Καμία γραμμή παραγωγής δεν αλλάζει.
 *
 * ΤΙ ΤΥΠΩΝΕΙ Η ΟΘΟΝΗ — ΑΠΟΚΛΙΣΗ ΑΠΟ ΤΟ ΜΟΤΙΒΟ, ΓΡΑΜΜΕΝΗ ΕΔΩ: το measureDrySectorWaveGate διάβαζε
 * το `shoreWaveHeightM` (τη φωνή του μοντέλου). Εδώ διαβάζεται το `shoreDisplayWaveM` — το min με
 * την απόσβεση, δηλαδή Ο,ΤΙ ΠΡΑΓΜΑΤΙΚΑ τυπώνεται και ό,τι διαβάζει η ετυμηγορία — γιατί η βεντάλια
 * κουνάει το μοντέλο ΚΑΙ προς τα πάνω, κι εκεί η απόσβεση μπορεί να κρύψει την αλλαγή από τον
 * χρήστη. Μετράμε μόνο ό,τι βλέπει μάτι.
 *
 * ΤΑ ΟΡΙΑ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ (ίδια με §Γ4/§Γ21, είναι το ίδιο εργαλείο):
 *  - Ζωντανό σκορ σε επίπεδο ΗΜΕΡΑΣ (day 0), ΕΝΑ στιγμιότυπο ενός κύκλου πρόγνωσης.
 *  - Μετράει ΕΜΒΕΛΕΙΑ, όχι αν ο νέος αριθμός είναι πιο κοντά στην αλήθεια — για ακτογραμμή δεν
 *    υπάρχει κριτής (§7δ). Ο κριτής έρχεται στα Στάδια 1-2 (βυθός, webcams, οι 59 όρμοι).
 *  - Ο άνεμος είναι της περιοχής — ό,τι χωρίζει τις παραλίες της είναι η γεωμετρία τους.
 *
 * ΜΕΤΑ ΤΑ 4 ΝΟΥΜΕΡΑ: ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ. Καμία γραμμή παραγωγής πριν από αυτήν.
 *
 * Run: node scripts/measureFanSpreading.mjs            (δομικό μισό, χωρίς δίκτυο)
 *      node scripts/measureFanSpreading.mjs --live     (+ εθνικό πέρασμα, ~40 λεπτά)
 *      node scripts/measureFanSpreading.mjs --live --regions=south-aegean-naxos
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// services/weatherService.ts arms its request timeout with window.setTimeout — same reason as
// scripts/measureDrySectorWaveGate.mjs.
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
const {
  SHORE_DISPLAY_FLOOR_M,
  SHORE_RAMP_SILENT_ONSHORE,
  shoreRampWeight,
  isEnclosedDrySector,
} = shoreWaveModule;
const originalEstimate = shoreWaveModule.estimateShoreWaveHeightM;
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const {
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const coveWaveModule = require(path.join(root, 'utils/coveWaveGuard.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
// Το podium ΔΕΝ είναι οι τρεις πρώτες του getSuitableBeaches — οι 25 πόντοι «νερό» ζουν στο
// utils/topPickScoreTable, το οποίο τρέχει μόνο μέσα από εδώ (το έμαθε με το δύσκολο η §Γ4).
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
const cachePath = path.join(root, '.tmp/fan-spreading-wave-cache.json');

const DAY_INDEX = 0;
const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Ίδιος ορισμός «ξηρού» με §Γ20/§Γ21 ώστε τα νούμερα να διασταυρώνονται.
const DRY_MAX_FETCH_KM = 0;
const DRY_MIN_BLOCKED_RATIO = 0.95;

// ─────────────────────────────────────────────────────────────────────────────
// Η ΒΕΝΤΑΛΙΑ
//
// Δείγματα ανά 5° σε (−90°, +90°), βάρος cos²ˢ(Δθ), άνοιγμα από την ΠΑΡΑΓΩΓΙΚΗ παρεμβολή
// (interpolateSectorGeometry) ώστε η γεωμετρία να είναι κατά γράμμα αυτή που βλέπει το ζωντανό
// μονοπάτι. Άθροιση σε ΕΝΕΡΓΕΙΑ (H²), όχι σε ύψος: δύο μισά στόμια δεν κάνουν ένα ολόκληρο κύμα,
// κάνουν ένα κύμα × √2/2 — αυτό λέει η φυσική της επαλληλίας.
// ─────────────────────────────────────────────────────────────────────────────
const FAN_HALF_WIDTH_DEG = 90;
const FAN_STEP_DEG = 5;

const profileFanReady = (profile) => Boolean(profile?.sectors)
  && SECTOR_ORDER.every(key => {
    const sector = profile.sectors?.[key];
    return Number.isFinite(sector?.fetchKm) && Number.isFinite(sector?.blockedRayRatio);
  });

const fanWaveHeightM = (profile, windDeg, windSpeedKmh, s) => {
  let energy = 0;
  let weightSum = 0;
  for (let d = -FAN_HALF_WIDTH_DEG + FAN_STEP_DEG / 2; d < FAN_HALF_WIDTH_DEG; d += FAN_STEP_DEG) {
    const w = Math.cos((d * Math.PI) / 180) ** (2 * s);
    const { fetchKm } = interpolateSectorGeometry(profile, windDeg + d);
    const h = estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm });
    energy += w * h * h;
    weightSum += w;
  }
  return weightSum > 0 ? Math.sqrt(energy / weightSum) : 0;
};

const angularDeltaDeg = (a, b) => {
  const diff = Math.abs(((a % 360) + 360) % 360 - (((b % 360) + 360) % 360));
  return diff > 180 ? 360 - diff : diff;
};

/** Το μεγαλύτερο άνοιγμα σε ΟΠΟΙΟΝΔΗΠΟΤΕ τομέα με κέντρο μέσα σε ±halfWidth από τον άνεμο. */
const neighbourMaxFetchKm = (profile, windDeg, halfWidthDeg) => {
  let max = 0;
  SECTOR_ORDER.forEach((key, index) => {
    if (angularDeltaDeg(index * 45, windDeg) > halfWidthDeg + 1e-9) return;
    const fetchKm = profile?.sectors?.[key]?.fetchKm;
    if (typeof fetchKm === 'number' && Number.isFinite(fetchKm)) max = Math.max(max, fetchKm);
  });
  return max;
};

// ─────────────────────────────────────────────────────────────────────────────
// ΟΙ ΥΠΟΨΗΦΙΕΣ ΠΑΡΑΛΛΑΓΕΣ
//
// `today` δεν είναι παραλλαγή — είναι ο ΣΗΜΕΡΙΝΟΣ κώδικας αυτούσιος (μαζί με τον ξηρό ±90° της
// §Γ21), ως βάση σύγκρισης. `scope: 'dry'` = η βεντάλια μιλάει μόνο όπου ο ζωντανός τομέας είναι
// ξηρός· `scope: 'all'` = αντικαθιστά και τη ράμπα onshore μέσα στον φραγμένο πληθυσμό.
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = [
  { key: 'today', label: 'σήμερα (ράμπα onshore + ξηρός ±90°)' },
  { key: 'fan-dry-s2', label: 'βεντάλια ΜΟΝΟ σε ξηρό τομέα (cos⁴, ~±33°)', fan: true, scope: 'dry', s: 2 },
  { key: 'fan-all-s1', label: 'βεντάλια σε όλους τους φραγμένους (cos², ~±45°)', fan: true, scope: 'all', s: 1 },
  { key: 'fan-all-s2', label: 'βεντάλια σε όλους τους φραγμένους (cos⁴, ~±33°)', fan: true, scope: 'all', s: 2 },
  { key: 'fan-all-s3', label: 'βεντάλια σε όλους τους φραγμένους (cos⁶, ~±27°)', fan: true, scope: 'all', s: 3 },
];

/**
 * Το ζευγάρι (προφίλ, διεύθυνση ανέμου) της τρέχουσας βαθμολόγησης — γεμίζει από το τύλιγμα της
 * `resolveCoveAwareWaveHeightM`, που η παραγωγή καλεί ΠΑΝΤΑ αμέσως πριν χτίσει το `sector`.
 */
let liveContext = null;

const originalResolveCove = coveWaveModule.resolveCoveAwareWaveHeightM;
coveWaveModule.resolveCoveAwareWaveHeightM = (input) => {
  liveContext = {
    profile: input?.geospatialProfile ?? null,
    windDeg: typeof input?.windDirectionDeg === 'number' ? input.windDirectionDeg : null,
  };
  return originalResolveCove(input);
};

/**
 * Η υποψήφια συνάρτηση. Κάθε γραμμή ταυτόσημη με την `estimateShoreWaveHeightM` εκτός από τον
 * κλάδο της βεντάλιας: εκεί η οικογένεια γωνίας (ράμπα onshore + ξηρός/γείτονας) αντικαθίσταται
 * από βάρος 1 και μοντελοποιημένο ύψος H_fan. Όπου η βεντάλια δεν έχει μάρτυρα (λειψό προφίλ,
 * άγνωστη διεύθυνση), πέφτει στον σημερινό δρόμο — απουσία μάρτυρα δεν γεννά νέο ισχυρισμό.
 */
const fanEstimate = (input, variant, context) => {
  if (input.arrivingSwellPresent) return undefined;
  if (input.suspectPin) return undefined;
  if (input.confidence !== 'high') return undefined;
  if (typeof input.openWaterWaveHeightM !== 'number' || !Number.isFinite(input.openWaterWaveHeightM)) return undefined;
  if (typeof input.windSpeedKmh !== 'number' || !Number.isFinite(input.windSpeedKmh)) return undefined;
  if (!input.sector) return undefined;

  const { fetchKm, blockedRayRatio, onshore } = input.sector;
  if (typeof fetchKm !== 'number' || typeof blockedRayRatio !== 'number' || typeof onshore !== 'number') {
    return undefined;
  }
  if (!input.departingSea) {
    if (blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return undefined;
    if (fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return undefined;
  }

  const fanReady = Boolean(context?.profile) && typeof context.windDeg === 'number'
    && profileFanReady(context.profile);
  const dry = fetchKm <= DRY_MAX_FETCH_KM && blockedRayRatio >= DRY_MIN_BLOCKED_RATIO;
  const useFan = fanReady && (variant.scope === 'all' || dry);

  let weight;
  let modelledM;
  if (useFan) {
    weight = 1;
    modelledM = fanWaveHeightM(context.profile, context.windDeg, input.windSpeedKmh, variant.s);
  } else {
    // Ο σημερινός δρόμος αυτούσιος, μαζί με το enclosedDrySector που υπολόγισε η παραγωγή.
    if (!input.enclosedDrySector && onshore >= SHORE_RAMP_SILENT_ONSHORE) return undefined;
    weight = input.enclosedDrySector ? 1 : shoreRampWeight(onshore);
    modelledM = estimateFetchLimitedWaveHeightM({ windSpeedKmh: input.windSpeedKmh, fetchKm });
  }

  const blendedM = weight * modelledM + (1 - weight) * input.openWaterWaveHeightM;
  const shoreM = Math.max(SHORE_DISPLAY_FLOOR_M, blendedM);
  const roundedM = Number(shoreM.toFixed(2));
  if (roundedM >= input.openWaterWaveHeightM) return undefined;
  return roundedM;
};

let activeVariant = VARIANTS[0];
shoreWaveModule.estimateShoreWaveHeightM = (input) => (
  activeVariant.fan ? fanEstimate(input, activeVariant, liveContext) : originalEstimate(input)
);

// ─────────────────────────────────────────────────────────────────────────────
// ΔΙΧΤΥ ΠΑΝΩ ΣΤΟ ΙΔΙΟ ΤΟ ΕΡΓΑΛΕΙΟ
// Αν η αντικατάσταση δεν έφτανε στη βαθμολόγηση, κάθε παραλλαγή θα έβγαζε τα ίδια νούμερα και η
// αναφορά θα έλεγε «καμία αλλαγή» — το πιο βολικό ψέμα. Ελέγχεται με κλήση.
// ─────────────────────────────────────────────────────────────────────────────
{
  const probe = {
    openWaterWaveHeightM: 1.0,
    windSpeedKmh: 40,
    // onshore = 0: εγκάρσιος άνεμος, πάνω από το −0,5 — ο σημερινός κώδικας σιωπά χωρίς §Γ21.
    sector: { fetchKm: 0, blockedRayRatio: 1, onshore: 0 },
    confidence: 'high',
    suspectPin: false,
    arrivingSwellPresent: false,
    enclosedDrySector: false,
  };
  const mkProfile = (overrides) => ({
    sectors: Object.fromEntries(SECTOR_ORDER.map(key => [
      key,
      overrides[key] ?? { fetchKm: 0, blockedRayRatio: 1 },
    ])),
  });
  // Στόμιο ΝΔ 15 χλμ, άνεμος από Ν (180°): Δθ = 45°, η κλάση Πανόρμου σε καθαρή μορφή.
  const mouthProfile = mkProfile({ SW: { fetchKm: 15, blockedRayRatio: 0.2 } });
  const closedProfile = mkProfile({});

  activeVariant = VARIANTS[0];
  const asToday = shoreWaveModule.estimateShoreWaveHeightM(probe);
  const asTodayEnclosed = shoreWaveModule.estimateShoreWaveHeightM({ ...probe, enclosedDrySector: true });
  activeVariant = VARIANTS.find(v => v.key === 'fan-dry-s2');
  liveContext = { profile: mouthProfile, windDeg: 180 };
  const asFanMouth = shoreWaveModule.estimateShoreWaveHeightM(probe);
  liveContext = { profile: closedProfile, windDeg: 180 };
  const asFanClosed = shoreWaveModule.estimateShoreWaveHeightM(probe);
  liveContext = null;
  const asFanNoWitness = shoreWaveModule.estimateShoreWaveHeightM(probe);
  activeVariant = VARIANTS.find(v => v.key === 'fan-all-s2');
  liveContext = { profile: closedProfile, windDeg: 180 };
  // Ράμπα −0,6 σε κλειστό προφίλ: σήμερα μείγμα με το πέλαγος, με βεντάλια καθαρό ~δάπεδο.
  const asFanAllRamp = shoreWaveModule.estimateShoreWaveHeightM({
    ...probe,
    sector: { fetchKm: 0, blockedRayRatio: 1, onshore: -0.6 },
  });
  activeVariant = VARIANTS[0];
  const asTodayRamp = shoreWaveModule.estimateShoreWaveHeightM({
    ...probe,
    sector: { fetchKm: 0, blockedRayRatio: 1, onshore: -0.6 },
  });
  liveContext = null;

  const failures = [];
  if (asToday !== undefined) failures.push(`ο σημερινός κώδικας ΔΕΝ σιώπησε σε onshore 0 (${asToday})`);
  if (asTodayEnclosed !== SHORE_DISPLAY_FLOOR_M) failures.push(`ο ξηρός ±90° της §Γ21 δεν έδωσε το δάπεδο (${asTodayEnclosed})`);
  if (!(asFanMouth > SHORE_DISPLAY_FLOOR_M && asFanMouth < probe.openWaterWaveHeightM)) {
    failures.push(`η βεντάλια δεν έδωσε το νούμερο του στομίου (${asFanMouth})`);
  }
  if (asFanClosed !== SHORE_DISPLAY_FLOOR_M) failures.push(`η βεντάλια σε κλειστό προφίλ δεν έδωσε το δάπεδο (${asFanClosed})`);
  if (asFanNoWitness !== undefined) failures.push(`χωρίς μάρτυρα η βεντάλια μίλησε (${asFanNoWitness})`);
  if (asFanAllRamp !== SHORE_DISPLAY_FLOOR_M) failures.push(`fan-all στη ζώνη ράμπας δεν έδωσε καθαρό δάπεδο (${asFanAllRamp})`);
  if (!(typeof asTodayRamp === 'number' && asTodayRamp > SHORE_DISPLAY_FLOOR_M)) {
    failures.push(`η σημερινή ράμπα στο −0,6 δεν έδωσε μείγμα (${asTodayRamp})`);
  }
  if (failures.length) {
    console.error(`ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ:\n  - ${failures.join('\n  - ')}`);
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
// ΔΟΜΙΚΟ ΜΙΣΟ — χωρίς δίκτυο, άνεμος αναφοράς 30 χμ/ώ (~5 μποφόρ, το κλίμα του μελτεμιού).
// Πάνω στους ΩΜΟΥΣ 8 τομείς (ίδιο πλέγμα με §Γ20/§Γ21: 22.976 συνδυασμοί) ώστε το πρώτο νούμερο
// να είναι διασταύρωση, όχι νέο εύρημα.
// ─────────────────────────────────────────────────────────────────────────────
const REF_WIND_KMH = 30;
const FAN_EXPONENTS = [1, 2, 3];

const structural = {
  profilesHigh: 0,
  fanReadyProfiles: 0,
  combos: 0,
  drySectors: 0,
  drySilent: 0,
  drySilentBeaches: new Set(),
  drySilentEnclosedToday: 0,
  drySilentFan: Object.fromEntries(FAN_EXPONENTS.map(s => [`s${s}`, {
    under015: 0, from015to03: 0, from03to05: 0, over05: 0, meaningfulPanormos: 0, heights: [],
  }])),
  speakersToday: 0,
  speakerDeltas: Object.fromEntries(FAN_EXPONENTS.map(s => [`s${s}`, []])),
  gatedSilentNonDry: 0,
};

for (const region of regions) {
  for (const profile of Object.values(region.profiles)) {
    if (profile.confidence !== 'high') continue;
    structural.profilesHigh += 1;
    const fanReady = profileFanReady(profile);
    if (fanReady) structural.fanReadyProfiles += 1;
    SECTOR_ORDER.forEach((key, index) => {
      const sector = profile.sectors?.[key];
      if (!sector) return;
      structural.combos += 1;
      const windDeg = index * 45;
      const gated = typeof sector.blockedRayRatio === 'number'
        && sector.blockedRayRatio >= OFFSHORE_FLAT_MIN_BLOCKED_RATIO
        && typeof sector.fetchKm === 'number'
        && sector.fetchKm <= OFFSHORE_FLAT_MAX_FETCH_KM;
      const dry = sector.fetchKm <= DRY_MAX_FETCH_KM && sector.blockedRayRatio >= DRY_MIN_BLOCKED_RATIO;
      const silent = typeof sector.onshore === 'number' && sector.onshore >= SHORE_RAMP_SILENT_ONSHORE;

      if (dry) structural.drySectors += 1;
      if (gated && !dry && silent) structural.gatedSilentNonDry += 1;
      if (gated && !silent) {
        structural.speakersToday += 1;
        if (fanReady) {
          const singleM = estimateFetchLimitedWaveHeightM({ windSpeedKmh: REF_WIND_KMH, fetchKm: sector.fetchKm });
          for (const s of FAN_EXPONENTS) {
            const fanM = fanWaveHeightM(profile, windDeg, REF_WIND_KMH, s);
            structural.speakerDeltas[`s${s}`].push(Number((fanM - singleM).toFixed(3)));
          }
        }
      }

      if (!dry || !silent) return;
      structural.drySilent += 1;
      structural.drySilentBeaches.add(profile.beachId);
      if (isEnclosedDrySector(sector, profile, windDeg)) structural.drySilentEnclosedToday += 1;
      if (!fanReady) return;
      const panormos = neighbourMaxFetchKm(profile, windDeg, 90) >= 5;
      for (const s of FAN_EXPONENTS) {
        const fanM = fanWaveHeightM(profile, windDeg, REF_WIND_KMH, s);
        const bucket = structural.drySilentFan[`s${s}`];
        bucket.heights.push(fanM);
        if (fanM < 0.15) bucket.under015 += 1;
        else if (fanM < 0.3) bucket.from015to03 += 1;
        else if (fanM < 0.5) bucket.from03to05 += 1;
        else bucket.over05 += 1;
        if (fanM >= 0.15 && panormos) bucket.meaningfulPanormos += 1;
      }
    });
  }
}

console.log('── ΔΟΜΙΚΟ: τι λέει η βεντάλια στο νερό που ήδη ξέρουμε (άνεμος 30 χμ/ώ) ──');
console.log(`${structural.profilesHigh} προφίλ high confidence (${structural.fanReadyProfiles} με πλήρεις 8 τομείς) × 8 = ${structural.combos} συνδυασμοί σε ${regions.length} περιοχές.`);
console.log(`  ΞΗΡΟΙ τομείς: ${structural.drySectors} · από αυτούς ΣΙΩΠΟΥΝ σήμερα (onshore ≥ −0,5): ${structural.drySilent} σε ${structural.drySilentBeaches.size} παραλίες`);
console.log(`    ήδη ξεκλείδωτοι από τον ξηρό ±90° της §Γ21: ${structural.drySilentEnclosedToday}`);
console.log('    τι νούμερο θα τους έδινε η βεντάλια (οι υπόλοιποι θα άλλαζαν από ΠΕΛΑΓΟΣ σε αυτό):');
for (const s of FAN_EXPONENTS) {
  const bucket = structural.drySilentFan[`s${s}`];
  console.log(`      s=${s}: <0,15 μ.: ${bucket.under015} · 0,15-0,3: ${bucket.from015to03} · 0,3-0,5: ${bucket.from03to05} · ≥0,5: ${bucket.over05}`
    + ` · διάμεσο ${percentile(bucket.heights, 0.5).toFixed(2)} μ. · p90 ${percentile(bucket.heights, 0.9).toFixed(2)} μ.`
    + ` · κλάση ΠΑΝΟΡΜΟΥ με ≥0,15 μ.: ${bucket.meaningfulPanormos}`);
}
console.log(`  Φραγμένοι ΜΗ ξηροί που σιωπούν (νέοι ομιλητές ΜΟΝΟ του fan-all): ${structural.gatedSilentNonDry}`);
console.log(`  Ομιλητές σήμερα (ράμπα, φραγμένοι): ${structural.speakersToday} — πόσο τους κουνά η βεντάλια (H_fan − H_μονής γραμμής):`);
for (const s of FAN_EXPONENTS) {
  const deltas = structural.speakerDeltas[`s${s}`];
  const up = deltas.filter(d => d > 0.005).length;
  const down = deltas.filter(d => d < -0.005).length;
  console.log(`      s=${s}: πάνω (πιο άγρια/ασφαλής): ${up} · κάτω: ${down} · διάμεσο ${percentile(deltas.map(Math.abs), 0.5).toFixed(3)} μ. · p90 ${percentile(deltas.map(Math.abs), 0.9).toFixed(3)} μ. · max ${(deltas.length ? Math.max(...deltas.map(Math.abs)) : 0).toFixed(2)} μ.`);
}

if (!LIVE) {
  console.log('\nΤρέξε με --live για το τι αλλάζει στην οθόνη, στην ετυμηγορία και στο podium.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ΖΩΝΤΑΝΟ ΜΙΣΟ — κάθε παραλία σκοράρεται μία φορά ανά παραλλαγή, από ΤΟΝ ΙΔΙΟ άνεμο και ΤΗΝ ΙΔΙΑ
// θάλασσα, ώστε η μόνη μεταβλητή να είναι η πύλη.
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

/**
 * Ο αριθμός που ΒΛΕΠΕΙ ο χρήστης. ΑΠΟΚΛΙΣΗ ΑΠΟ ΤΟ ΜΟΤΙΒΟ (γραμμένη και στην κεφαλίδα): εδώ
 * διαβάζεται το `shoreDisplayWaveM` — το min του μοντέλου με την απόσβεση, αυτό που τυπώνεται και
 * κρίνει — όχι το γυμνό `shoreWaveHeightM`, γιατί η βεντάλια κουνά το μοντέλο και προς τα πάνω
 * και εκεί η απόσβεση μπορεί να κρύψει την αλλαγή από το μάτι.
 */
const printedM = (score) => (
  typeof score.shoreDisplayWaveM === 'number' && Number.isFinite(score.shoreDisplayWaveM)
    ? score.shoreDisplayWaveM
    : (typeof score.seaStateWaveM === 'number' ? score.seaStateWaveM : null)
);

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

  // `deg`, όχι `direction` (types.ts:764) — το λάθος που στη §Γ4 έβγαλε μηδέν ζευγάρια γειτόνων.
  const windDirectionDeg = regionDay.wind?.deg;
  const windKmh = (regionDay.wind?.speed ?? 0) * 3.6;
  const dayByBeachId = new Map();
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    dayByBeachId.set(beach.id, beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay);
  }

  const scoresByVariant = new Map();
  const top3ByVariant = {};
  for (const variant of VARIANTS) {
    activeVariant = variant;
    const scores = new Map();
    for (const beach of region.beaches) {
      const dayForecast = dayByBeachId.get(beach.id);
      scores.set(beach.id, calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      }));
    }
    scoresByVariant.set(variant.key, scores);
    const suitable = getSuitableBeaches(
      region.beaches, regionDay, 'gr', undefined, regionDay.hourly, undefined, undefined, region.profiles, scores
    );
    // `toneRank` μένει undefined επίτηδες: το χρώμα κάθεται ΠΑΝΩ από το σκορ και δεν το αγγίζει
    // αυτή η πύλη — μετράμε καθαρά τους 25 πόντους «νερό».
    top3ByVariant[variant.key] = prioritizeProtectedRecommendations(
      suitable, getBeaufortLevel(windKmh)
    ).slice(0, 3).map(item => item.beach.id);
  }
  activeVariant = VARIANTS[0];

  const baseScores = scoresByVariant.get('today');
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
    const fanRow = (profile && profileFanReady(profile) && typeof windDirectionDeg === 'number')
      ? Object.fromEntries(FAN_EXPONENTS.map(s => [
        `s${s}`, Number(fanWaveHeightM(profile, windDirectionDeg, windKmh, s).toFixed(2)),
      ]))
      : null;

    const row = {
      beachId: beach.id,
      name: beach.name?.gr ?? null,
      confidence: profile?.confidence ?? null,
      exposureLevel: base.exposureLevel ?? null,
      sectorKey,
      onshore: liveOnshore === null ? null : Number(liveOnshore.toFixed(3)),
      fetchKm: typeof sector?.fetchKm === 'number' ? sector.fetchKm : null,
      blockedRayRatio: typeof sector?.blockedRayRatio === 'number' ? sector.blockedRayRatio : null,
      neighbourMax90Km: (profile && typeof windDirectionDeg === 'number')
        ? Number(neighbourMaxFetchKm(profile, windDirectionDeg, 90).toFixed(2)) : null,
      fanM: fanRow,
      byVariant: {},
    };
    for (const variant of VARIANTS) {
      const score = scoresByVariant.get(variant.key).get(beach.id);
      row.byVariant[variant.key] = {
        printedM: printedM(score),
        shoreM: typeof score.shoreWaveHeightM === 'number' ? score.shoreWaveHeightM : null,
        comfort: score.swimmingComfort ?? null,
      };
    }
    rows.push(row);
  }

  return {
    regionId: region.regionId,
    windKmh: Number(windKmh.toFixed(1)),
    windDirectionDeg: typeof windDirectionDeg === 'number' ? Math.round(windDirectionDeg) : null,
    beaches: region.beaches.length,
    noData,
    rows,
    top3ByVariant,
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

const codeStamp = [
  'services/recommendationService.ts',
  'utils/shoreWave.ts',
  'utils/coveWaveGuard.ts',
  'utils/waveModel.ts',
  'utils/windExposureModel.ts',
  'utils/weatherUtils.ts',
  'scripts/measureFanSpreading.mjs',
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
// (α) Ο ΑΡΙΘΜΟΣ · (β) Η ΛΕΞΗ · (γ) ΤΟ PODIUM · (δ) ΤΟ ΜΕΓΕΘΟΣ ΤΟΥ ΙΣΧΥΡΙΣΜΟΥ
// ─────────────────────────────────────────────────────────────────────────────
const COMFORT_ORDER = ['avoid_swimming', 'caution', 'good', 'excellent'];
const comfortRank = (value) => {
  const index = COMFORT_ORDER.indexOf(value);
  return index === -1 ? null : index;
};

const summary = {};
for (const variant of VARIANTS.filter(v => v.fan)) {
  summary[variant.key] = {
    label: variant.label,
    beachesMeasured: 0,
    spokeBefore: 0,
    spokeAfter: 0,
    newSpeakers: 0,
    lostVoice: 0,
    calmer: 0,
    calmerDeltas: [],
    calmerExamples: [],
    calmerDryLive: 0,
    rougher: 0,
    rougherDeltas: [],
    rougherExamples: [],
    calmerAlreadyProtected: 0,
    suppressedOver05: 0,
    suppressedOver10: 0,
    suppressedMaxM: 0,
    panormosClassChanged: 0,
    comfortSofter: 0,
    comfortStricter: 0,
    comfortMoves: {},
    softerExamples: [],
    stricterExamples: [],
    podiumRegionsChanged: 0,
    podiumOrderOnly: 0,
    podiumExamples: [],
  };
}

for (const result of results) {
  for (const row of result.rows) {
    const base = row.byVariant.today;
    if (base.printedM === null) continue;
    for (const variant of VARIANTS) {
      if (!variant.fan) continue;
      const cell = row.byVariant[variant.key];
      const bucket = summary[variant.key];
      bucket.beachesMeasured += 1;
      if (base.shoreM !== null) bucket.spokeBefore += 1;
      if (cell.shoreM !== null) bucket.spokeAfter += 1;
      if (base.shoreM === null && cell.shoreM !== null) bucket.newSpeakers += 1;
      if (base.shoreM !== null && cell.shoreM === null) bucket.lostVoice += 1;
      if (cell.printedM === null) continue;

      const delta = Number((cell.printedM - base.printedM).toFixed(2));
      if (delta < -0.005) {
        bucket.calmer += 1;
        bucket.calmerDeltas.push(-delta);
        if (row.exposureLevel === 'protected') bucket.calmerAlreadyProtected += 1;
        if (row.fetchKm !== null && row.fetchKm <= DRY_MAX_FETCH_KM) bucket.calmerDryLive += 1;
        if (base.printedM >= 0.5) bucket.suppressedOver05 += 1;
        if (base.printedM >= 1.0) bucket.suppressedOver10 += 1;
        bucket.suppressedMaxM = Math.max(bucket.suppressedMaxM, base.printedM);
        if (typeof row.neighbourMax90Km === 'number' && row.neighbourMax90Km >= 5) bucket.panormosClassChanged += 1;
        if (bucket.calmerExamples.length < 15) {
          bucket.calmerExamples.push({
            region: result.regionId, name: row.name, beachId: row.beachId,
            onshore: row.onshore, level: row.exposureLevel,
            neighbour90Km: row.neighbourMax90Km, fanM: row.fanM,
            beforeM: base.printedM, afterM: cell.printedM,
          });
        }
      } else if (delta > 0.005) {
        bucket.rougher += 1;
        bucket.rougherDeltas.push(delta);
        if (bucket.rougherExamples.length < 15) {
          bucket.rougherExamples.push({
            region: result.regionId, name: row.name, beachId: row.beachId,
            onshore: row.onshore, level: row.exposureLevel,
            neighbour90Km: row.neighbourMax90Km, fanM: row.fanM,
            beforeM: base.printedM, afterM: cell.printedM,
          });
        }
      }

      const before = comfortRank(base.comfort);
      const after = comfortRank(cell.comfort);
      if (before === null || after === null || before === after) continue;
      const move = `${base.comfort} → ${cell.comfort}`;
      bucket.comfortMoves[move] = (bucket.comfortMoves[move] ?? 0) + 1;
      const example = {
        region: result.regionId, name: row.name, beachId: row.beachId,
        onshore: row.onshore, level: row.exposureLevel, move,
        neighbour90Km: row.neighbourMax90Km, fanM: row.fanM,
        beforeM: base.printedM, afterM: cell.printedM,
      };
      if (after > before) {
        bucket.comfortSofter += 1;
        if (bucket.softerExamples.length < 15) bucket.softerExamples.push(example);
      } else {
        bucket.comfortStricter += 1;
        if (bucket.stricterExamples.length < 15) bucket.stricterExamples.push(example);
      }
    }
  }

  for (const variant of VARIANTS) {
    if (!variant.fan) continue;
    const before = result.top3ByVariant.today ?? [];
    const after = result.top3ByVariant[variant.key] ?? [];
    if (before.join(',') === after.join(',')) continue;
    const bucket = summary[variant.key];
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
}

console.log(`\nΠεριοχές που απάντησαν: ${results.length}/${regions.length} (${pct(results.length, regions.length)}).`);
const totalBeaches = results.reduce((sum, r) => sum + r.rows.length, 0);
console.log(`Παραλίες με νούμερο: ${totalBeaches}.`);

console.log('\n── (α) Ο ΑΡΙΘΜΟΣ ─────────────────────────────────────────────────────');
for (const variant of VARIANTS.filter(v => v.fan)) {
  const s = summary[variant.key];
  console.log(`  ${s.label}`);
  console.log(`    μιλάει: ${s.spokeBefore} → ${s.spokeAfter} παραλίες (νέες φωνές ${s.newSpeakers}, χαμένες φωνές ${s.lostVoice})`);
  console.log(`    ΠΙΟ ΗΡΕΜΕΣ: ${s.calmer} (${pct(s.calmer, s.beachesMeasured)}) · διάμεση πτώση ${percentile(s.calmerDeltas, 0.5).toFixed(2)} μ. · p90 ${percentile(s.calmerDeltas, 0.9).toFixed(2)} μ. · max ${(s.calmerDeltas.length ? Math.max(...s.calmerDeltas) : 0).toFixed(2)} μ.`);
  console.log(`    ΠΙΟ ΑΓΡΙΕΣ: ${s.rougher} (${pct(s.rougher, s.beachesMeasured)}) · διάμεση άνοδος ${percentile(s.rougherDeltas, 0.5).toFixed(2)} μ. · p90 ${percentile(s.rougherDeltas, 0.9).toFixed(2)} μ. · max ${(s.rougherDeltas.length ? Math.max(...s.rougherDeltas) : 0).toFixed(2)} μ.`);
}

console.log('\n── (β) Η ΛΕΞΗ — ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ ────────────────────────────────');
for (const variant of VARIANTS.filter(v => v.fan)) {
  const s = summary[variant.key];
  const moves = Object.entries(s.comfortMoves).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`  ${s.label}`);
  console.log(`    πιο επιεικής: ${s.comfortSofter} · αυστηρότερη: ${s.comfortStricter}${moves ? `\n      ${moves}` : ''}`);
}

console.log('\n── (γ) ΤΟ PODIUM ─────────────────────────────────────────────────────');
const withPodium = results.filter(r => (r.top3ByVariant?.today ?? []).length > 0).length;
console.log(`  (${withPodium}/${results.length} περιοχές βγάζουν podium σήμερα — αν αυτό είναι 0, τα παρακάτω δεν σημαίνουν τίποτα.)`);
for (const variant of VARIANTS.filter(v => v.fan)) {
  const s = summary[variant.key];
  console.log(`  ${s.label}: ${s.podiumRegionsChanged}/${results.length} περιοχές (${pct(s.podiumRegionsChanged, results.length)})`
    + ` — μόνο σειρά: ${s.podiumOrderOnly}, αλλάζει πρόσωπα: ${s.podiumRegionsChanged - s.podiumOrderOnly}`);
}

console.log('\n── (δ) ΠΟΣΟ ΜΕΓΑΛΟ ΝΟΥΜΕΡΟ ΚΑΤΑΠΙΝΟΥΜΕ ──────────────────────────────');
for (const variant of VARIANTS.filter(v => v.fan)) {
  const s = summary[variant.key];
  console.log(`  ${s.label}: από τις ${s.calmer} πιο ήρεμες — ήδη «Προστατευμένη»: ${s.calmerAlreadyProtected} (${pct(s.calmerAlreadyProtected, s.calmer)})`
    + ` · με ξηρό ζωντανό τομέα: ${s.calmerDryLive}`
    + ` · έσβησαν ≥0,5 μ.: ${s.suppressedOver05} · ≥1,0 μ.: ${s.suppressedOver10} · μέγιστο που σβήστηκε: ${s.suppressedMaxM.toFixed(2)} μ.`
    + ` · κλάση ΠΑΝΟΡΜΟΥ μέσα τους: ${s.panormosClassChanged}`);
}

// Οι παραλίες της αναφοράς τυπώνονται πάντα ονομαστικά: μια εθνική μέση τιμή μπορεί να δείχνει
// καλή ενώ ακριβώς η περίπτωση που ξεκίνησε τη δουλειά έχει χαλάσει.
// 2011 Πάνορμος Νάξου (η κλάση «μπαίνει από το πλάι» — Ο ΣΤΟΧΟΣ: να αποκτήσει δικό της νούμερο)
// 2186 Σταφίδα · 2151 Άγ. Ιωάννης Πόρτο (οι δύο της §Γ21 — να ΜΗΝ πέσουν κι άλλο)
// 133 Λιμνιώνας Κυθήρων (η αφορμή της §Γ20) · 33 Σχινιάς · 32 Μαραθώνας (§Γ3) · 22 Λιμανάκια
const WATCHLIST_IDS = [2011, 2186, 2151, 133, 33, 32, 22];
const watchlist = [];
for (const result of results) {
  for (const row of result.rows) {
    if (!WATCHLIST_IDS.includes(row.beachId)) continue;
    watchlist.push({ region: result.regionId, windDirectionDeg: result.windDirectionDeg, windKmh: result.windKmh, ...row });
  }
}
if (watchlist.length) {
  console.log('\n── ΟΙ ΟΝΟΜΑΣΤΙΚΕΣ ───────────────────────────────────────────────────');
  for (const row of watchlist) {
    const cells = VARIANTS.map(v => `${v.key} ${row.byVariant[v.key].printedM ?? '—'}`).join(' · ');
    const fan = row.fanM ? ` · H_fan s1/s2/s3: ${row.fanM.s1}/${row.fanM.s2}/${row.fanM.s3}` : '';
    console.log(`  ${row.name} (#${row.beachId}) άνεμος ${row.windDirectionDeg}° @ ${row.windKmh} χμ/ώ · onshore ${row.onshore ?? '—'} · άνοιγμα ${row.fetchKm ?? '—'} χλμ · γείτονας ±90° ${row.neighbourMax90Km ?? '—'} χλμ${fan}`);
    console.log(`      ${cells}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'fan-spreading-wave-gate.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  dayIndex: DAY_INDEX,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  beachesMeasured: totalBeaches,
  variants: VARIANTS,
  fan: { halfWidthDeg: FAN_HALF_WIDTH_DEG, stepDeg: FAN_STEP_DEG, exponents: FAN_EXPONENTS, refWindKmh: REF_WIND_KMH },
  dryDefinition: { maxFetchKm: DRY_MAX_FETCH_KM, minBlockedRayRatio: DRY_MIN_BLOCKED_RATIO },
  structural: {
    profilesHigh: structural.profilesHigh,
    fanReadyProfiles: structural.fanReadyProfiles,
    combos: structural.combos,
    drySectors: structural.drySectors,
    drySilent: structural.drySilent,
    drySilentBeaches: structural.drySilentBeaches.size,
    drySilentEnclosedToday: structural.drySilentEnclosedToday,
    gatedSilentNonDry: structural.gatedSilentNonDry,
    speakersToday: structural.speakersToday,
    drySilentFan: Object.fromEntries(Object.entries(structural.drySilentFan).map(([key, value]) => [key, {
      ...value,
      medianM: Number(percentile(value.heights, 0.5).toFixed(2)),
      p90M: Number(percentile(value.heights, 0.9).toFixed(2)),
      heights: undefined,
    }])),
    speakerDeltas: Object.fromEntries(Object.entries(structural.speakerDeltas).map(([key, deltas]) => [key, {
      up: deltas.filter(d => d > 0.005).length,
      down: deltas.filter(d => d < -0.005).length,
      medianAbsM: Number(percentile(deltas.map(Math.abs), 0.5).toFixed(3)),
      p90AbsM: Number(percentile(deltas.map(Math.abs), 0.9).toFixed(3)),
      maxAbsM: deltas.length ? Number(Math.max(...deltas.map(Math.abs)).toFixed(2)) : null,
    }])),
  },
  watchlist,
  summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, {
    ...value,
    calmerMedianM: Number(percentile(value.calmerDeltas, 0.5).toFixed(2)),
    calmerP90M: Number(percentile(value.calmerDeltas, 0.9).toFixed(2)),
    calmerMaxM: value.calmerDeltas.length ? Number(Math.max(...value.calmerDeltas).toFixed(2)) : null,
    rougherMedianM: Number(percentile(value.rougherDeltas, 0.5).toFixed(2)),
    rougherP90M: Number(percentile(value.rougherDeltas, 0.9).toFixed(2)),
    rougherMaxM: value.rougherDeltas.length ? Number(Math.max(...value.rougherDeltas).toFixed(2)) : null,
    calmerDeltas: undefined,
    rougherDeltas: undefined,
  }])),
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
console.log('Επόμενο βήμα: ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ πάνω στα 4 νούμερα. Καμία γραμμή παραγωγής πριν από αυτήν.');

if (coverage < MIN_COVERAGE) {
  console.error(`\nΑΠΕΤΥΧΕ — απάντησε μόνο το ${pct(results.length, regions.length)} των περιοχών. Μερικό πέρασμα δεν είναι μικρότερη απάντηση, είναι μεροληπτική.`);
  process.exit(1);
}
