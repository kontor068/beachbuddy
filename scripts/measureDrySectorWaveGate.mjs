/**
 * Ο ΞΗΡΟΣ ΤΟΜΕΑΣ ΑΝΤΙ ΓΙΑ ΤΟΝ ΑΝΕΜΟ — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (βίβλος §Γ20, τελευταία «ΤΙ ΜΕΝΕΙ ΑΝΟΙΧΤΟ», 17/08/2026). Το τυπωμένο κύμα σωπαίνει
 * και δείχνει την ΑΝΟΙΧΤΗ ΘΑΛΑΣΣΑ όταν `onshore >= −0,5` ([utils/shoreWave.ts:248]). Η πύλη ρωτάει
 * «φυσάει από τη στεριά;». Το ερώτημα που κρίνει αν μπορεί να υπάρξει κύμα εδώ είναι άλλο:
 * «υπάρχει καθόλου νερό προς τα εκεί;». Όταν οι δύο ερωτήσεις συμφωνούν δεν φαίνεται τίποτα· όταν
 * ο κόλπος κοιτάει αλλού από τον άνεμο, χωρίζουν — και τότε μια παραλία που ο ίδιος ο χάρτης μας
 * λέει «Προστατευμένη» τυπώνει από κάτω το νούμερο του πελάγους.
 *
 * ΤΡΕΙΣ ΦΟΡΕΣ ΠΕΡΠΑΤΗΘΗΚΕ ΤΟ ΙΔΙΟ ΘΕΜΑ ΣΤΟΝ ΙΔΙΟ ΑΞΟΝΑ. §Γ3 (διακόπτης −0,80), §Γ4+§Γ5 (ράμπα με
 * πλατφόρμα −0,80 → −0,50, ζωντανή), §Μ4 («θάλασσα που φεύγει»). Κάθε φορά ρυθμίστηκε ΠΟΥ κόβει το
 * `onshore`. Κανείς δεν ρώτησε αν το `onshore` είναι ο σωστός άξονας. Αυτό το αρχείο μετράει τον
 * ΑΛΛΟ άξονα και τίποτα άλλο.
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Μια πύλη που, ΜΟΝΟ όταν η γεωμετρία λέει μηδέν ανοιχτό νερό στον ζωντανό τομέα
 * ανέμου (`fetchKm = 0`, `blockedRayRatio ≥ 0,95`, `confidence: 'high'`), παρακάμπτει τον έλεγχο
 * `onshore` και δίνει βάρος 1 στην εκτίμηση ακτής. Τίποτε άλλο δεν αλλάζει: αποθαλασσιά, ύποπτο
 * pin, εμπιστοσύνη, φράξιμο, άνοιγμα, δάπεδο 0,10 και το καπάκι «ποτέ πιο δυνατά από τη θάλασσα
 * έξω» μένουν ταυτόσημα.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΗ (η απαίτηση της §7δ). Η πύλη μόνο ΠΡΟΣΘΕΤΕΙ περιπτώσεις όπου η εκτίμηση
 * ακτής μιλάει· δεν αφαιρεί καμία και δεν αλλάζει καμία υπάρχουσα. Και το καπάκι στο τέλος της
 * `estimateShoreWaveHeightM` σιωπά αν το νούμερο δεν είναι ΜΙΚΡΟΤΕΡΟ από τα ανοιχτά. Άρα κάθε
 * παραλία ή μένει ίδια ή γίνεται ΠΙΟ ΗΡΕΜΗ — που είναι ταυτόχρονα και η ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση
 * (σκανδάλη #1 της §9, «ψεύτικη ηρεμία»). Γι' αυτό μετριέται πρώτο και ονομαστικά το πόσο μεγάλο
 * είναι το νούμερο που καταπίνουμε.
 *
 * ΤΟ ΑΝΤΙΠΑΡΑΔΕΙΓΜΑ ΕΙΝΑΙ ΕΝΣΩΜΑΤΩΜΕΝΟ ΩΣ ΠΑΡΑΛΛΑΓΗ. Πάνορμος Νάξου (2011) @ S: `fetchKm 0`,
 * `ratio 1` — αλλά το στόμιο ΝΔ ανοίγει 6,2 χλμ και το κύμα μπαίνει από το πλάι. «Μηδέν άνοιγμα»
 * δεν αρκεί μόνο του. Οι παραλλαγές `dry-45-*` / `dry-90-*` απαιτούν ΚΑΙ «κανένα ανοιχτό στόμιο
 * δίπλα» — και ο Πάνορμος είναι στη λίστα παρακολούθησης, ονομαστικά, σε κάθε πέρασμα.
 *
 * ΠΩΣ ΔΙΑΒΑΖΕΤΑΙ Ο ΓΕΙΤΟΝΑΣ. Η ζωντανή γεωμετρία που φτάνει στη `shoreWave` είναι ΠΑΡΕΜΒΟΛΗ δύο
 * γειτονικών τομέων (utils/windExposureModel:84). Δεν κουβαλάει τους υπόλοιπους έξι. Οπότε το
 * εργαλείο τυλίγει την `resolveCoveAwareWaveHeightM` — τη μοναδική συνάρτηση που δέχεται ΚΑΙ το
 * προφίλ ΚΑΙ τη ζωντανή διεύθυνση ανέμου, ακριβώς πριν χτιστεί το `sector` της κλήσης — και
 * κρατάει το ζευγάρι. Καμία γραμμή παραγωγής δεν αλλάζει· η αντικατάσταση ζει μόνο μέσα σε αυτή
 * τη διεργασία.
 *
 * ΤΑ ΟΡΙΑ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ (ίδια με §Γ4, γιατί είναι το ίδιο εργαλείο):
 *  - Ζωντανό σκορ σε επίπεδο ΗΜΕΡΑΣ (day 0), όχι ανά ώρα του ρυθμιστή.
 *  - ΕΝΑ στιγμιότυπο ενός κύκλου πρόγνωσης. Μετράει ΕΜΒΕΛΕΙΑ, όχι αν ο νέος αριθμός είναι πιο
 *    κοντά στην αλήθεια — για ακτογραμμή δεν υπάρχει κριτής (§7δ) και αυτό δεν αλλάζει.
 *  - Ο άνεμος είναι της περιοχής, ο ίδιος για όλες τις παραλίες της — άρα ό,τι τις χωρίζει είναι
 *    η γεωμετρία τους.
 *
 * Run: node scripts/measureDrySectorWaveGate.mjs            (δομικό μισό, χωρίς δίκτυο)
 *      node scripts/measureDrySectorWaveGate.mjs --live     (+ εθνικό πέρασμα)
 *      node scripts/measureDrySectorWaveGate.mjs --live --regions=south-aegean-naxos
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// services/weatherService.ts arms its request timeout with window.setTimeout — same reason as
// scripts/measureShoreWaveRamp.mjs.
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
} = shoreWaveModule;
const originalEstimate = shoreWaveModule.estimateShoreWaveHeightM;
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const {
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
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
const cachePath = path.join(root, '.tmp/dry-sector-wave-gate-cache.json');

const DAY_INDEX = 0;
const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ─────────────────────────────────────────────────────────────────────────────
// Ο ΟΡΙΣΜΟΣ ΤΟΥ «ΞΗΡΟΥ»
//
// Ίδιος με τη μέτρηση της §Γ20 ώστε τα δύο νούμερα να συγκρίνονται: μηδέν άνοιγμα, ουσιαστικά
// όλες οι ακτίνες κομμένες, γεωμετρία υψηλής εμπιστοσύνης.
//
// ⚠️ Στην πράξη η παραγωγική πύλη φραξίματος απαιτεί ratio ΑΚΡΙΒΩΣ 1 (OFFSHORE_FLAT_MIN_BLOCKED_RATIO),
// άρα οι τομείς με 0,95 ≤ ratio < 1 κόβονται ΠΡΙΝ φτάσουν εδώ. Δεν τους ξεκλειδώνει αυτή η πύλη —
// μετριούνται χωριστά στο δομικό μισό ώστε να ξέρουμε τι αφήνουμε απ' έξω.
// ─────────────────────────────────────────────────────────────────────────────
const DRY_MAX_FETCH_KM = 0;
const DRY_MIN_BLOCKED_RATIO = 0.95;

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
// ΟΙ ΥΠΟΨΗΦΙΕΣ ΠΥΛΕΣ
//
// `today` δεν είναι παραλλαγή — είναι ο ΣΗΜΕΡΙΝΟΣ κώδικας αυτούσιος, ως βάση σύγκρισης.
// `neighbourHalfWidthDeg: null` σημαίνει «κανένας έλεγχος γείτονα» — η γυμνή μορφή, που ο
// Πάνορμος δείχνει ότι δεν αρκεί. Οι υπόλοιπες απαιτούν ΚΑΙ ότι κανένα στόμιο μέσα στο τόξο δεν
// ξεπερνά το `neighbourMaxKm`.
// ─────────────────────────────────────────────────────────────────────────────
const VARIANTS = [
  { key: 'today', label: 'σήμερα (άξονας onshore)', neighbourHalfWidthDeg: null, neighbourMaxKm: null },
  { key: 'dry-bare', label: 'ξηρός τομέας — ΧΩΡΙΣ έλεγχο γείτονα', neighbourHalfWidthDeg: null, neighbourMaxKm: null, dry: true },
  { key: 'dry-45-2', label: 'ξηρός + κανένα στόμιο >2 χλμ σε ±45°', neighbourHalfWidthDeg: 45, neighbourMaxKm: 2, dry: true },
  { key: 'dry-90-2', label: 'ξηρός + κανένα στόμιο >2 χλμ σε ±90°', neighbourHalfWidthDeg: 90, neighbourMaxKm: 2, dry: true },
  { key: 'dry-90-05', label: 'ξηρός + κανένα στόμιο >0,5 χλμ σε ±90°', neighbourHalfWidthDeg: 90, neighbourMaxKm: 0.5, dry: true },
];

/**
 * Το ζευγάρι (προφίλ, διεύθυνση ανέμου) της τρέχουσας βαθμολόγησης. Γεμίζει από το τύλιγμα της
 * `resolveCoveAwareWaveHeightM` παρακάτω, το οποίο η `services/recommendationService` καλεί
 * ΠΑΝΤΑ ακριβώς πριν χτίσει το `sector` της `estimateShoreWaveHeightM` — άρα δεν μπορεί να είναι
 * μπαγιάτικο, όποιος κι αν είναι ο καλών.
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

/** Περνάει ο ζωντανός τομέας τον έλεγχο «κανένα ανοιχτό στόμιο δίπλα» της παραλλαγής; */
const neighbourClear = (variant, context) => {
  if (variant.neighbourHalfWidthDeg === null) return true;
  if (!context?.profile || typeof context.windDeg !== 'number') return false; // χωρίς μάρτυρα, όχι
  return neighbourMaxFetchKm(context.profile, context.windDeg, variant.neighbourHalfWidthDeg)
    <= variant.neighbourMaxKm + 1e-9;
};

/**
 * Η υποψήφια συνάρτηση. Κάθε γραμμή είναι ταυτόσημη με την `estimateShoreWaveHeightM` εκτός από
 * δύο: ο έλεγχος `onshore` παρακάμπτεται όταν ο τομέας είναι ξηρός, και τότε το βάρος είναι 1
 * (καθαρή εκτίμηση ακτής πάνω σε μηδέν άνοιγμα = το δάπεδο 0,10).
 */
const dryEstimate = (input, variant, context) => {
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

  const dry = fetchKm <= DRY_MAX_FETCH_KM
    && blockedRayRatio >= DRY_MIN_BLOCKED_RATIO
    && neighbourClear(variant, context);

  if (!dry && onshore >= SHORE_RAMP_SILENT_ONSHORE) return undefined;

  const weight = dry ? 1 : shoreRampWeight(onshore);
  const modelledM = estimateFetchLimitedWaveHeightM({ windSpeedKmh: input.windSpeedKmh, fetchKm });
  const blendedM = weight * modelledM + (1 - weight) * input.openWaterWaveHeightM;
  const shoreM = Math.max(SHORE_DISPLAY_FLOOR_M, blendedM);
  const roundedM = Number(shoreM.toFixed(2));
  if (roundedM >= input.openWaterWaveHeightM) return undefined;
  return roundedM;
};

let activeVariant = VARIANTS[0];
shoreWaveModule.estimateShoreWaveHeightM = (input) => (
  activeVariant.dry ? dryEstimate(input, activeVariant, liveContext) : originalEstimate(input)
);

// ─────────────────────────────────────────────────────────────────────────────
// ΔΙΧΤΥ ΠΑΝΩ ΣΤΟ ΙΔΙΟ ΤΟ ΕΡΓΑΛΕΙΟ
// Αν η αντικατάσταση δεν έφτανε στη βαθμολόγηση, κάθε παραλλαγή θα έβγαζε τα ίδια νούμερα και η
// αναφορά θα έλεγε «καμία αλλαγή» — δηλαδή ακριβώς το πιο βολικό ψέμα. Ελέγχεται με κλήση.
// ─────────────────────────────────────────────────────────────────────────────
{
  const probe = {
    openWaterWaveHeightM: 1.0,
    windSpeedKmh: 30,
    // onshore = 0: ο άνεμος έρχεται εγκάρσια, ΠΑΝΩ από το −0,5, άρα ο σημερινός κώδικας σιωπά.
    sector: { fetchKm: 0, blockedRayRatio: 1, onshore: 0 },
    confidence: 'high',
    suspectPin: false,
    arrivingSwellPresent: false,
  };
  const openProfile = { sectors: Object.fromEntries(SECTOR_ORDER.map(k => [k, { fetchKm: 9, blockedRayRatio: 0.4 }])) };
  const closedProfile = { sectors: Object.fromEntries(SECTOR_ORDER.map(k => [k, { fetchKm: 0, blockedRayRatio: 1 }])) };

  activeVariant = VARIANTS[0];
  const asToday = shoreWaveModule.estimateShoreWaveHeightM(probe);
  activeVariant = VARIANTS[1];
  const asBare = shoreWaveModule.estimateShoreWaveHeightM(probe);
  activeVariant = VARIANTS.find(v => v.key === 'dry-45-2');
  liveContext = { profile: openProfile, windDeg: 180 };
  const asGuardedOpen = shoreWaveModule.estimateShoreWaveHeightM(probe);
  liveContext = { profile: closedProfile, windDeg: 180 };
  const asGuardedClosed = shoreWaveModule.estimateShoreWaveHeightM(probe);
  activeVariant = VARIANTS[0];
  liveContext = null;

  const failures = [];
  if (asToday !== undefined) failures.push(`ο σημερινός κώδικας ΔΕΝ σιώπησε σε onshore 0 (${asToday})`);
  if (asBare !== SHORE_DISPLAY_FLOOR_M) failures.push(`η γυμνή πύλη δεν έδωσε το δάπεδο (${asBare})`);
  if (asGuardedOpen !== undefined) failures.push(`ο έλεγχος γείτονα ΔΕΝ έκοψε ανοιχτό στόμιο 9 χλμ (${asGuardedOpen})`);
  if (asGuardedClosed !== SHORE_DISPLAY_FLOOR_M) failures.push(`ο έλεγχος γείτονα έκοψε ΚΛΕΙΣΤΟ προφίλ (${asGuardedClosed})`);
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
// ΔΟΜΙΚΟ ΜΙΣΟ — χωρίς δίκτυο. Πόσο μεγάλος είναι ο πληθυσμός, και πόσο τον κλαδεύει ο γείτονας.
// Δουλεύει πάνω στους ΩΜΟΥΣ 8 τομείς, δηλαδή στο ίδιο πλέγμα με τη μέτρηση της §Γ20 (2.082/1.318),
// ώστε το πρώτο νούμερο να είναι διασταύρωση του εργαλείου και όχι νέο εύρημα.
// ─────────────────────────────────────────────────────────────────────────────
const structural = {
  profilesHigh: 0,
  combos: 0,
  drySectors: 0,
  dryBeaches: new Set(),
  ratioBelowOne: 0,
  alreadyProtectedSectors: 0,
  silentTodaySectors: 0,
  silentTodayBeaches: new Set(),
  byVariant: Object.fromEntries(VARIANTS.filter(v => v.dry).map(v => [v.key, { sectors: 0, beaches: new Set() }])),
  panormosClass: 0,
};

for (const region of regions) {
  for (const profile of Object.values(region.profiles)) {
    if (profile.confidence !== 'high') continue;
    structural.profilesHigh += 1;
    SECTOR_ORDER.forEach((key, index) => {
      const sector = profile.sectors?.[key];
      if (!sector) return;
      structural.combos += 1;
      const dry = sector.fetchKm <= DRY_MAX_FETCH_KM && sector.blockedRayRatio >= DRY_MIN_BLOCKED_RATIO;
      if (!dry) return;
      structural.drySectors += 1;
      structural.dryBeaches.add(profile.beachId);
      if (sector.blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) structural.ratioBelowOne += 1;
      if (sector.level === 'protected') structural.alreadyProtectedSectors += 1;
      // «Σιωπά σήμερα» = ο άνεμος από αυτόν τον τομέα δεν είναι αρκετά απόγειος για την πύλη −0,5.
      if (typeof sector.onshore === 'number' && sector.onshore >= SHORE_RAMP_SILENT_ONSHORE) {
        structural.silentTodaySectors += 1;
        structural.silentTodayBeaches.add(profile.beachId);
        // Η κλάση Πανόρμου: ξηρός τομέας ΜΕ ανοιχτό στόμιο ≥5 χλμ μέσα σε ±90°.
        if (neighbourMaxFetchKm(profile, index * 45, 90) >= 5) structural.panormosClass += 1;
        for (const variant of VARIANTS.filter(v => v.dry)) {
          if (!neighbourClear(variant, { profile, windDeg: index * 45 })) continue;
          structural.byVariant[variant.key].sectors += 1;
          structural.byVariant[variant.key].beaches.add(profile.beachId);
        }
      }
    });
  }
}

console.log('── ΔΟΜΙΚΟ: πόσο μεγάλος είναι ο πληθυσμός ──────────────────────────');
console.log(`${structural.profilesHigh} προφίλ high confidence × 8 τομείς = ${structural.combos} συνδυασμοί σε ${regions.length} περιοχές.`);
console.log(`  ΞΗΡΟΙ τομείς (άνοιγμα 0, φράξιμο ≥0,95): ${structural.drySectors} σε ${structural.dryBeaches.size} παραλίες`);
console.log(`    από αυτούς ήδη «Προστατευμένος» τομέας: ${structural.alreadyProtectedSectors} (${pct(structural.alreadyProtectedSectors, structural.drySectors)})`);
console.log(`    με φράξιμο 0,95-0,99 (τους κόβει ΗΔΗ η πύλη φραξίματος, ΔΕΝ τους αγγίζει η αλλαγή): ${structural.ratioBelowOne}`);
console.log(`  Από τους ξηρούς, ΣΙΩΠΟΥΝ σήμερα λόγω onshore ≥ −0,5: ${structural.silentTodaySectors} σε ${structural.silentTodayBeaches.size} παραλίες`);
console.log(`    από αυτούς κλάση ΠΑΝΟΡΜΟΥ (ανοιχτό στόμιο ≥5 χλμ σε ±90°): ${structural.panormosClass} (${pct(structural.panormosClass, structural.silentTodaySectors)})`);
console.log('  Τι θα ξεκλείδωνε κάθε πύλη (ωμοί τομείς, όχι ζωντανός άνεμος):');
for (const variant of VARIANTS.filter(v => v.dry)) {
  const bucket = structural.byVariant[variant.key];
  console.log(`    ${variant.label}: ${bucket.sectors} τομείς σε ${bucket.beaches.size} παραλίες`);
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

/** Ο αριθμός που ΒΛΕΠΕΙ ο χρήστης: η ακτή όταν μιλάει, αλλιώς η ανοιχτή θάλασσα. */
const printedM = (score) => (
  typeof score.shoreWaveHeightM === 'number' && Number.isFinite(score.shoreWaveHeightM)
    ? score.shoreWaveHeightM
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
    // αυτή η πύλη (το shoreWave δεν μπαίνει σε χρώμα) — μετράμε καθαρά τους 25 πόντους «νερό».
    top3ByVariant[variant.key] = prioritizeProtectedRecommendations(
      suitable, getBeaufortLevel((regionDay.wind?.speed ?? 0) * 3.6)
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

    const row = {
      beachId: beach.id,
      name: beach.name?.gr ?? null,
      confidence: profile?.confidence ?? null,
      exposureLevel: base.exposureLevel ?? null,
      sectorKey,
      onshore: liveOnshore === null ? null : Number(liveOnshore.toFixed(3)),
      fetchKm: typeof sector?.fetchKm === 'number' ? sector.fetchKm : null,
      blockedRayRatio: typeof sector?.blockedRayRatio === 'number' ? sector.blockedRayRatio : null,
      neighbourMax45Km: (profile && typeof windDirectionDeg === 'number')
        ? Number(neighbourMaxFetchKm(profile, windDirectionDeg, 45).toFixed(2)) : null,
      neighbourMax90Km: (profile && typeof windDirectionDeg === 'number')
        ? Number(neighbourMaxFetchKm(profile, windDirectionDeg, 90).toFixed(2)) : null,
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
    windKmh: Number(((regionDay.wind?.speed ?? 0) * 3.6).toFixed(1)),
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
  'utils/weatherUtils.ts',
  'scripts/measureDrySectorWaveGate.mjs',
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
for (const variant of VARIANTS.filter(v => v.dry)) {
  summary[variant.key] = {
    label: variant.label,
    beachesMeasured: 0,
    spokeBefore: 0,
    spokeAfter: 0,
    calmer: 0,
    calmerDeltas: [],
    calmerExamples: [],
    rougher: 0,
    calmerAlreadyProtected: 0,
    suppressedOver05: 0,
    suppressedOver10: 0,
    suppressedMaxM: 0,
    panormosClassChanged: 0,
    comfortSofter: 0,
    comfortStricter: 0,
    comfortMoves: {},
    softerExamples: [],
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
      if (!variant.dry) continue;
      const cell = row.byVariant[variant.key];
      const bucket = summary[variant.key];
      bucket.beachesMeasured += 1;
      if (base.shoreM !== null) bucket.spokeBefore += 1;
      if (cell.shoreM !== null) bucket.spokeAfter += 1;
      if (cell.printedM === null) continue;

      const delta = Number((cell.printedM - base.printedM).toFixed(2));
      if (delta < -0.005) {
        bucket.calmer += 1;
        bucket.calmerDeltas.push(-delta);
        if (row.exposureLevel === 'protected') bucket.calmerAlreadyProtected += 1;
        if (base.printedM >= 0.5) bucket.suppressedOver05 += 1;
        if (base.printedM >= 1.0) bucket.suppressedOver10 += 1;
        bucket.suppressedMaxM = Math.max(bucket.suppressedMaxM, base.printedM);
        if (typeof row.neighbourMax90Km === 'number' && row.neighbourMax90Km >= 5) bucket.panormosClassChanged += 1;
        if (bucket.calmerExamples.length < 15) {
          bucket.calmerExamples.push({
            region: result.regionId, name: row.name, beachId: row.beachId,
            onshore: row.onshore, level: row.exposureLevel,
            neighbour90Km: row.neighbourMax90Km,
            beforeM: base.printedM, afterM: cell.printedM,
          });
        }
      } else if (delta > 0.005) {
        bucket.rougher += 1;
      }

      const before = comfortRank(base.comfort);
      const after = comfortRank(cell.comfort);
      if (before === null || after === null || before === after) continue;
      const move = `${base.comfort} → ${cell.comfort}`;
      bucket.comfortMoves[move] = (bucket.comfortMoves[move] ?? 0) + 1;
      if (after > before) {
        bucket.comfortSofter += 1;
        if (bucket.softerExamples.length < 15) {
          bucket.softerExamples.push({
            region: result.regionId, name: row.name, beachId: row.beachId,
            onshore: row.onshore, level: row.exposureLevel, move,
            neighbour90Km: row.neighbourMax90Km,
            beforeM: base.printedM, afterM: cell.printedM,
          });
        }
      } else {
        bucket.comfortStricter += 1;
      }
    }
  }

  for (const variant of VARIANTS) {
    if (!variant.dry) continue;
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
for (const variant of VARIANTS.filter(v => v.dry)) {
  const s = summary[variant.key];
  console.log(`  ${s.label}`);
  console.log(`    μιλάει: ${s.spokeBefore} → ${s.spokeAfter} παραλίες`);
  console.log(`    ΠΙΟ ΗΡΕΜΕΣ: ${s.calmer} (${pct(s.calmer, s.beachesMeasured)}) · διάμεση πτώση ${percentile(s.calmerDeltas, 0.5).toFixed(2)} μ. · p90 ${percentile(s.calmerDeltas, 0.9).toFixed(2)} μ. · max ${(s.calmerDeltas.length ? Math.max(...s.calmerDeltas) : 0).toFixed(2)} μ.`);
  console.log(`    πιο άγριες: ${s.rougher}${s.rougher === 0 ? ' ✅ μονόδρομη, επιβεβαιωμένο' : ' ✘ ΔΕΝ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΗ'}`);
}

console.log('\n── (β) Η ΛΕΞΗ — ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ ────────────────────────────────');
for (const variant of VARIANTS.filter(v => v.dry)) {
  const s = summary[variant.key];
  const moves = Object.entries(s.comfortMoves).sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`  ${s.label}`);
  console.log(`    πιο επιεικής: ${s.comfortSofter} · αυστηρότερη: ${s.comfortStricter}${moves ? `\n      ${moves}` : ''}`);
}

console.log('\n── (γ) ΤΟ PODIUM ─────────────────────────────────────────────────────');
const withPodium = results.filter(r => (r.top3ByVariant?.today ?? []).length > 0).length;
console.log(`  (${withPodium}/${results.length} περιοχές βγάζουν podium σήμερα — αν αυτό είναι 0, τα παρακάτω δεν σημαίνουν τίποτα.)`);
for (const variant of VARIANTS.filter(v => v.dry)) {
  const s = summary[variant.key];
  console.log(`  ${s.label}: ${s.podiumRegionsChanged}/${results.length} περιοχές (${pct(s.podiumRegionsChanged, results.length)})`
    + ` — μόνο σειρά: ${s.podiumOrderOnly}, αλλάζει πρόσωπα: ${s.podiumRegionsChanged - s.podiumOrderOnly}`);
}

console.log('\n── (δ) ΠΟΣΟ ΜΕΓΑΛΟ ΝΟΥΜΕΡΟ ΚΑΤΑΠΙΝΟΥΜΕ ──────────────────────────────');
for (const variant of VARIANTS.filter(v => v.dry)) {
  const s = summary[variant.key];
  console.log(`  ${s.label}: από τις ${s.calmer} πιο ήρεμες — ήδη «Προστατευμένη»: ${s.calmerAlreadyProtected} (${pct(s.calmerAlreadyProtected, s.calmer)})`
    + ` · έσβησαν ≥0,5 μ.: ${s.suppressedOver05} · ≥1,0 μ.: ${s.suppressedOver10} · μέγιστο που σβήστηκε: ${s.suppressedMaxM.toFixed(2)} μ.`
    + ` · κλάση ΠΑΝΟΡΜΟΥ μέσα τους: ${s.panormosClassChanged}`);
}

// Οι παραλίες της αναφοράς τυπώνονται πάντα ονομαστικά: μια εθνική μέση τιμή μπορεί να δείχνει
// καλή ενώ ακριβώς η περίπτωση που ξεκίνησε τη δουλειά έχει χαλάσει.
// 2011 Πάνορμος Νάξου (το αντιπαράδειγμα) · 133 Λιμνιώνας Κυθήρων (η αφορμή της §Γ20)
// 33 Σχινιάς · 32 Μαραθώνας (η αφορμή της §Γ3) · 22 Λιμανάκια Βουλιαγμένης
const WATCHLIST_IDS = [2011, 133, 33, 32, 22];
const watchlist = [];
for (const result of results) {
  for (const row of result.rows) {
    if (!WATCHLIST_IDS.includes(row.beachId)) continue;
    watchlist.push({ region: result.regionId, windDirectionDeg: result.windDirectionDeg, ...row });
  }
}
if (watchlist.length) {
  console.log('\n── ΟΙ ΟΝΟΜΑΣΤΙΚΕΣ ───────────────────────────────────────────────────');
  for (const row of watchlist) {
    const cells = VARIANTS.map(v => `${v.key} ${row.byVariant[v.key].printedM ?? '—'}`).join(' · ');
    console.log(`  ${row.name} (#${row.beachId}) άνεμος ${row.windDirectionDeg}° · onshore ${row.onshore ?? '—'} · άνοιγμα ${row.fetchKm ?? '—'} χλμ · γείτονας ±90° ${row.neighbourMax90Km ?? '—'} χλμ`);
    console.log(`      ${cells}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'dry-sector-wave-gate.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  dayIndex: DAY_INDEX,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  beachesMeasured: totalBeaches,
  variants: VARIANTS,
  dryDefinition: { maxFetchKm: DRY_MAX_FETCH_KM, minBlockedRayRatio: DRY_MIN_BLOCKED_RATIO },
  structural: {
    profilesHigh: structural.profilesHigh,
    combos: structural.combos,
    drySectors: structural.drySectors,
    dryBeaches: structural.dryBeaches.size,
    alreadyProtectedSectors: structural.alreadyProtectedSectors,
    ratioBelowOne: structural.ratioBelowOne,
    silentTodaySectors: structural.silentTodaySectors,
    silentTodayBeaches: structural.silentTodayBeaches.size,
    panormosClass: structural.panormosClass,
    byVariant: Object.fromEntries(Object.entries(structural.byVariant)
      .map(([key, value]) => [key, { sectors: value.sectors, beaches: value.beaches.size }])),
  },
  watchlist,
  summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, {
    ...value,
    calmerMedianM: Number(percentile(value.calmerDeltas, 0.5).toFixed(2)),
    calmerP90M: Number(percentile(value.calmerDeltas, 0.9).toFixed(2)),
    calmerMaxM: value.calmerDeltas.length ? Number(Math.max(...value.calmerDeltas).toFixed(2)) : null,
    calmerDeltas: undefined,
  }])),
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);

if (coverage < MIN_COVERAGE) {
  console.error(`\nΑΠΕΤΥΧΕ — απάντησε μόνο το ${pct(results.length, regions.length)} των περιοχών. Μερικό πέρασμα δεν είναι μικρότερη απάντηση, είναι μεροληπτική.`);
  process.exit(1);
}
