/**
 * Ο ΑΡΙΘΜΟΣ ΤΗΣ ΑΚΤΗΣ ΠΕΦΤΕΙ ΚΑΤΩ ΑΠΟ ΤΟ ΔΙΚΟ ΜΑΣ ΔΑΠΕΔΟ ΨΙΛΟΚΥΜΑΤΟΣ — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * Η ΑΦΟΡΜΗ (σκανδάλη #1 της §9, 06/09/2026). Κυρά Παναγιά Καρπάθου #2308, 12:00. Άνεμος 23,3
 * χλμ/ώ από 297° (4 Μπφ) με ριπή 46,4 · έκθεση `protected` · ανοιχτά 0,74 μ. (ewam 320°, 3,95 δλ,
 * επαληθεύτηκε ζωντανά). Η κάρτα τύπωσε **0,10 μ. στην ακτή** — δηλαδή το `SHORE_DISPLAY_FLOOR_M`,
 * που ΔΕΝ είναι μέτρηση αλλά «το μοντέλο έβγαλε μηδέν». Επισκέπτης: «Είχε ΠΙΟ ΠΟΛΥ κύμα απ' όσο
 * δείχναμε». Η ίδια οικογένεια με Λυγιά (25/08) και Συκιά (27/08): ο αριθμός αμυντικά σωστός, η
 * εικόνα λάθος.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΑΕΙ ΤΗ ΜΕΤΡΗΣΗ ΕΙΝΑΙ ΕΣΩΤΕΡΙΚΗ ΑΣΥΜΦΩΝΙΑ, ΟΧΙ ΕΙΚΑΣΙΑ. Το ίδιο μας το
 * μοντέλο, στο `utils/waveModel.getWindChopWaveFloorM`, δηλώνει ότι σε **προστατευμένη** ακτή
 * στα **4 Μποφόρ** το κύμα δεν πέφτει κάτω από **0,30 μ.** (+0,05 ριπής = 0,35 στην Κυρά
 * Παναγιά). Αυτό το δάπεδο εφαρμόζεται σήμερα ΜΟΝΟ στο ανοιχτό νούμερο
 * (`resolveDisplayWaveHeightM`) και ΠΟΤΕ στον αριθμό της ακτής. Το ίδιο το
 * `utils/offshoreFlatWater` το ονομάζει ρητά «το ΧΑΜΗΛΟΤΕΡΟ δάπεδο ψιλοκύματος που εφαρμόζει
 * πουθενά η εφαρμογή». Δύο δικά μας νούμερα διαφωνούν κατά 3,5×, και στην κάρτα δείχνουμε το
 * μικρότερο.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΑΥΤΟ, ΚΑΙ ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Καμία γραμμή παραγωγής δεν πειράζεται. Το
 * `utils/shoreWave` φορτώνεται κανονικά, η αυθεντική συνάρτηση κρατιέται ως βάση, και οι
 * υποψήφιες μπαίνουν με αντικατάσταση του export ΜΕΣΑ σε αυτή τη διεργασία μόνο — το ίδιο μοτίβο
 * με το `scripts/measureShoreWaveRamp.mjs`, ώστε να μετρηθεί η ΠΡΑΓΜΑΤΙΚΗ διαδρομή (ετυμηγορία,
 * 25 πόντοι «νερό», σειρά podium) και όχι αντίγραφό της.
 *
 * ΟΙ ΤΡΕΙΣ ΥΠΟΨΗΦΙΕΣ — ΔΥΟ ΣΗΜΕΙΑ ΕΦΑΡΜΟΓΗΣ × Η ΠΥΛΗ ΤΗΣ ΡΙΠΗΣ (§Γ50, «Ο ΜΟΧΛΟΣ ΤΗΣ ΡΙΠΗΣ
 * ΕΙΝΑΙ ΝΕΚΡΟΣ»). Η πύλη `mean` βάζει το δάπεδο ΜΟΝΟ όταν ο ΜΕΣΟΣ είναι ≥4 Μποφόρ· εκεί το
 * `getWindChopWaveFloorM` βγάζει νούμερο ανεξάρτητα από ριπή, άρα ΔΕΝ κληρονομεί τη μεροληψία
 * ριπής που μέτρησε το §Γ50 (ριπή 2,3× πάνω από το όργανο στο 23% των ήρεμων ωρών).
 *   • `model`    — δάπεδο στην ΕΚΤΙΜΗΣΗ ακτής (`utils/shoreWave`), πύλη `mean`.
 *   • `card`     — δάπεδο στον ΤΥΠΩΜΕΝΟ αριθμό (`utils/waveCharacter.shoreSeaStateM`), πύλη `mean`.
 *   • `both`     — ΚΑΙ ΣΤΑ ΔΥΟ. Είναι η μόνη υποψήφια που κουνάει τον αριθμό της κάρτας, γιατί η
 *     γραμμή 2157 παίρνει το `min` των δύο: ανεβάζοντας το ένα, το άλλο μένει πάτος.
 *   • `bothFull` — το ίδιο χωρίς την πύλη των 4 Μποφόρ: δείχνει ΠΟΣΟ του ευρήματος κάθεται πάνω
 *     στη ριπή που δεν εμπιστευόμαστε, ώστε να μη μπει κρυφά μαζί με το υπόλοιπο.
 *
 * ΜΟΝΟΔΡΟΜΕΣ ΚΑΙ ΟΙ ΔΥΟ (§7δ). Μπορούν ΜΟΝΟ να ανεβάσουν τον αριθμό της ακτής. Σιωπή μένει
 * σιωπή: αν η αυθεντική έλεγε `undefined`, η υποψήφια λέει `undefined`. Το καπάκι «ποτέ πιο
 * δυνατά από τη θάλασσα έξω» κρατιέται αυτούσιο — αν το ανεβασμένο φτάσει το ανοιχτό, η
 * συνάρτηση σωπαίνει, όπως κάνει και σήμερα. Καμία παραλία δεν μπορεί να φανεί ΠΙΟ ΗΡΕΜΗ.
 *
 * ΤΑ ΤΕΣΣΕΡΑ ΝΟΥΜΕΡΑ ΤΗΣ ΑΝΑΦΟΡΑΣ (η σειρά δουλειάς της §Γ3/§Γ4):
 *   (α) πόσο συχνά ο σημερινός αριθμός είναι ΚΑΤΩ από το δικό μας δάπεδο — το μέγεθος της
 *       ασυμφωνίας, πριν από κάθε πρόταση·
 *   (β) πόσες παραλίες ΑΝΕΒΑΙΝΕΙ ο τυπωμένος αριθμός και πόσο — το ΚΟΣΤΟΣ (παραλίες που θα
 *       φαίνονται χειρότερες), μετριέται πριν από το όφελος·
 *   (γ) πόσες αλλάζουν ΛΕΞΗ κύματος και πόσες ΕΤΥΜΗΓΟΡΙΑ — τι ακούει ο κόσμος·
 *   (δ) σε πόσες περιοχές αλλάζει το podium — ποιος μπαίνει και ποιος βγαίνει.
 *
 * ΧΩΡΙΣΤΑ, ΚΑΙ ΕΠΙΤΗΔΕΣ: `shoreWaveFromDepartingSea`. Όταν ο αριθμός ακτής ήρθε από ΜΕΤΡΗΜΕΝΗ
 * απόδειξη ότι όλο το νερό φεύγει (§Γ44), το να τον ανεβάσουμε είναι πολύ πιο αμφίβολο απ' όταν
 * ήρθε από την αβαθμονόμητη γεωμετρική εικασία. Η αναφορά τα μετράει ξεχωριστά ώστε η απόφαση να
 * μπορεί να πάρει το ένα και όχι το άλλο.
 *
 * ΤΑ ΟΡΙΑ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ:
 *  - Σκοράρει σε επίπεδο ΗΜΕΡΑΣ (day 0), όπως το §Γ4. Τα ωριαία δέλτα διαφέρουν σε μέγεθος, όχι
 *    σε κατεύθυνση: και οι δύο αρμοί περνούν από τον ίδιο συνοψιστή.
 *  - ΕΝΑ στιγμιότυπο ενός κύκλου πρόγνωσης. Μετράει εμβέλεια, όχι αν ο νέος αριθμός είναι πιο
 *    κοντά στην αλήθεια — για ακτογραμμή δεν υπάρχει κριτής (§7δ) και αυτό δεν αλλάζει.
 *  - Ο άνεμος είναι της περιοχής, όπως στην παραγωγή για τον χάρτη.
 *  - Το δάπεδο ζητιέται από την ΙΔΙΑ κλήση που το εφαρμόζει ήδη στο ανοιχτό νούμερο, και η
 *    αντιστοίχιση γίνεται πάνω στο `effectiveWaveHeightM` που εκείνη επέστρεψε. Όσες φορές δεν
 *    ταιριάξει, μετριούνται και τυπώνονται ως `unmatched` — μηδενικό που κρύβεται είναι το πιο
 *    βολικό λάθος που θα μπορούσε να κάνει αυτή η μέτρηση.
 *
 * Run: node scripts/measureShoreChopFloorGap.mjs            (δομικό μισό, χωρίς δίκτυο)
 *      node scripts/measureShoreChopFloorGap.mjs --live     (+ εθνικό πέρασμα)
 *      node scripts/measureShoreChopFloorGap.mjs --live --regions=south-aegean-karpathos
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

/**
 * Η ΠΛΗΡΩΜΕΝΗ ΠΟΡΤΑ, ΜΟΝΟ ΜΕΣΑ ΣΕ ΑΥΤΗ ΤΗ ΔΙΕΡΓΑΣΙΑ (06/09/2026, απόφαση Μίλτου).
 *
 * Το πρώτο εθνικό πέρασμα χτύπησε τη ΔΩΡΕΑΝ πόρτα (`marine-api.open-meteo.com`) και πήρε 429 σε
 * ολόκληρες περιοχές. Δεν είναι μόνο θέμα ταχύτητας: μια περιοχή χωρίς θάλασσα αναφέρει «καμία
 * αλλαγή», δηλαδή το πιο βολικό ψέμα που θα μπορούσε να πει αυτή η μέτρηση (η δικλείδα παρακάτω
 * την πιάνει, αλλά τότε η κάλυψη πέφτει κάτω από το 90% και το αποτέλεσμα δεν είναι εθνικό).
 *
 * ΚΑΜΙΑ ΓΡΑΜΜΗ ΠΑΡΑΓΩΓΗΣ ΔΕΝ ΑΛΛΑΖΕΙ. Το `services/weatherService.ts` χτίζει τα ίδια URL· εδώ
 * μόνο ο `fetch` αυτής της διεργασίας τα γυρίζει στον customer host με το κλειδί, ακριβώς όπως
 * κάνει η `netlify/functions/forecast.mjs:760` στην παραγωγή. Χωρίς κλειδί, τίποτα δεν αλλάζει
 * και η μέτρηση τρέχει όπως πριν — δεν σπάει, απλώς αργεί.
 */
const openMeteoKey = (() => {
  for (const file of ['.env.local', '.env']) {
    try {
      const match = readFileSync(path.join(root, file), 'utf8').match(/^OPEN_METEO_API_KEY=(.+)$/m);
      if (match && match[1].trim()) return match[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* δεν υπάρχει */ }
  }
  return '';
})();

const PAID_HOST = {
  'https://api.open-meteo.com': 'https://customer-api.open-meteo.com',
  'https://marine-api.open-meteo.com': 'https://customer-marine-api.open-meteo.com',
};

let paidCalls = 0;
if (openMeteoKey) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url === 'string') {
      for (const [free, paid] of Object.entries(PAID_HOST)) {
        if (url.startsWith(free)) {
          paidCalls += 1;
          return originalFetch(`${paid}${url.slice(free.length)}&apikey=${encodeURIComponent(openMeteoKey)}`, init);
        }
      }
    }
    return originalFetch(input, init);
  };
  console.log('  Πληρωμένη πόρτα Open-Meteo: ΕΝΕΡΓΗ');
} else {
  console.log('  ⚠️ Χωρίς κλειδί — δωρεάν πόρτα, αργά και με 429.');
}

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

const waveModelModule = require(path.join(root, 'utils/waveModel.ts'));
const { getWindChopWaveFloorM, estimateFetchLimitedWaveHeightM } = waveModelModule;
const originalResolveDisplay = waveModelModule.resolveDisplayWaveHeightM;

const waveCharacterModule = require(path.join(root, 'utils/waveCharacter.ts'));
const originalShoreSeaState = waveCharacterModule.shoreSeaStateM;

const { waveFeelLevel } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
// ⚠️ Το podium ΔΕΝ είναι οι τρεις πρώτες του getSuitableBeaches — οι 25 πόντοι «νερό» ζουν στο
// utils/topPickScoreTable, που τρέχει μόνο μέσα από εδώ (η παγίδα που έπιασε το §Γ4).
const { prioritizeProtectedRecommendations } = require(path.join(root, 'services/topPickRanking.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/weather');
const cachePath = path.join(root, '.tmp/shore-chop-floor-gap-cache.json');

const DAY_INDEX = 0;
const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Κάτω από αυτά τα Μποφόρ το δάπεδο ανάβει ΜΟΝΟ από τη ριπή — §Γ50, δεν την εμπιστευόμαστε. */
const MEAN_CANDIDATE_MIN_BEAUFORT = 4;

// ─────────────────────────────────────────────────────────────────────────────
// ΤΟ ΔΑΠΕΔΟ ΤΗΣ ΩΡΑΣ — ζητιέται από την ΙΔΙΑ κλήση που το εφαρμόζει στο ανοιχτό νούμερο.
//
// Το `resolveDisplayWaveHeightM` παίρνει ακριβώς τα πέντε ορίσματα του `getWindChopWaveFloorM`.
// Καταγράφουμε κάθε κλήση μαζί με το `effectiveWaveHeightM` που επέστρεψε· ο αριθμός της ακτής
// μπαίνει αμέσως μετά με `openWaterWaveHeightM = effectiveWaveHeightM`, οπότε η αντιστοίχιση
// είναι ΑΚΡΙΒΗΣ και αυτοαποδεικνυόμενη, χωρίς να εξαρτάται από τη σειρά των γραμμών.
// ─────────────────────────────────────────────────────────────────────────────
let recorded = [];
let unmatched = 0;
let matched = 0;
/** Από ΠΟΙΟ σημείο ήρθε η αστοχία — αλλιώς το 31% μένει ανεξήγητο νούμερο. */
const unmatchedBySite = { model: 0, card: 0 };
let currentSite = null;

waveModelModule.resolveDisplayWaveHeightM = (input) => {
  const out = originalResolveDisplay(input);
  recorded.push({
    exposureLevel: input.exposureLevel,
    beaufort: input.beaufort,
    windSpeedKmh: input.windSpeedKmh,
    gustKmph: input.gustKmph,
    meanSpeedBeforeGustFloorKmh: input.meanSpeedBeforeGustFloorKmh,
    effectiveWaveHeightM: out?.effectiveWaveHeightM,
  });
  return out;
};

const floorForOpenWater = (openWaterWaveHeightM) => {
  for (let i = recorded.length - 1; i >= 0; i -= 1) {
    const call = recorded[i];
    if (call.effectiveWaveHeightM === openWaterWaveHeightM) return call;
  }
  return null;
};

/**
 * ⚠️ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΑΥΤΟΥ ΤΟΥ ΑΡΧΕΙΟΥ ΠΕΙΡΑΖΕ ΛΑΘΟΣ ΣΗΜΕΙΟ, ΚΑΙ ΤΟ ΕΙΠΕ Ο ΜΑΡΤΥΡΑΣ.
 *
 * Ανεβάζοντας ΜΟΝΟ την `estimateShoreWaveHeightM` (η «εκτίμηση ακτής»), η Κυρά Παναγιά #2308
 * πήγε 0,10 → 0,35 μ. στο μοντέλο και η κάρτα **δεν κουνήθηκε καθόλου**: έμεινε 0,09 μ.
 * Ο λόγος είναι η γραμμή `services/recommendationService.ts:2157`:
 *
 *     shoreWaveM = min(shoreModelWaveM, dampedShoreWaveM)
 *
 * Ο αριθμός που τυπώνεται (`shoreDisplayWaveM`) είναι ο ΜΙΚΡΟΤΕΡΟΣ από δύο, και ο δεύτερος —
 * το `utils/waveCharacter.shoreSeaStateM` — είναι η αβαθμονόμητη έκπτωση ×0,5 / K_d(θ) πάνω στο
 * ανοιχτό νούμερο. Στην Κυρά Παναγιά έδωσε **0,09 μ. από 0,74** (K_d ≈ 0,12). Δηλαδή αυτός που
 * παράγει το «λάδι» ΔΕΝ είναι το SMB — είναι η έκπτωση που η ίδια η βίβλος ονομάζει «το πιο
 * φορτωμένο αβαθμονόμητο νούμερο του συστήματος» (§ΑΞ1/Α4, 🔴).
 *
 * Γι' αυτό μετρώνται ΔΥΟ σημεία εφαρμογής, όχι ένα:
 *   • `model` — δάπεδο στην εκτίμηση ακτής. Δείχνει πόσο ΛΙΓΟ αλλάζει η οθόνη από εκεί.
 *   • `card`  — δάπεδο στον αριθμό που τυπώνεται, μέσω της `shoreSeaStateM`. Το πραγματικό σημείο.
 *
 * ΓΙΑΤΙ ΤΟ `card` ΔΕΝ ΑΓΓΙΖΕΙ ΤΟ ΧΡΩΜΑ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΗ ΜΕΤΡΗΣΗ. Το `capToneBySeaState` τρέχει
 * ΚΙ ΑΥΤΟ την `shoreSeaStateM` — άρα η επέμβαση το πιάνει. Αλλά (utils/suitabilityTone:504) «δεν
 * έχει ΚΑΜΙΑ γνώμη κάτω από `SEA_STATE_AMBER_M` (0,80 μ.)», και το δάπεδο σε `protected` — τη
 * μόνη έκθεση όπου η έκπτωση ακτής εφαρμόζεται — έχει καπάκι **0,65 μ.** Άρα το ανεβασμένο
 * νούμερο μένει κάτω από το κατώφλι του χρώματος κατασκευαστικά. Η αναφορά το επαληθεύει
 * μετρώντας πόσα ανεβασμένα νούμερα ξεπερνούν το 0,80.
 */
const SEA_STATE_AMBER_M = 0.8;
let toneReachable = 0;

/** `null` = βάση. Αλλιώς {at:'model'|'card', gate:'mean'|'full'}. */
let activeCandidate = null;

const floorFor = (openWaterM) => {
  const call = floorForOpenWater(openWaterM);
  if (!call) { unmatched += 1; unmatchedBySite[currentSite] += 1; return null; }
  matched += 1;
  if (activeCandidate.gate === 'mean' && !(call.beaufort >= MEAN_CANDIDATE_MIN_BEAUFORT)) return null;
  const floor = getWindChopWaveFloorM(
    call.exposureLevel, call.beaufort, call.windSpeedKmh, call.gustKmph, call.meanSpeedBeforeGustFloorKmh
  );
  return floor > 0 ? floor : null;
};

shoreWaveModule.estimateShoreWaveHeightM = (input) => {
  const base = originalEstimate(input);
  if (!activeCandidate || (activeCandidate.at !== 'model' && activeCandidate.at !== 'both')) return base;
  // Σιωπή μένει σιωπή — μονόδρομη.
  if (base === undefined) return base;

  currentSite = 'model';
  const floor = floorFor(input.openWaterWaveHeightM);
  if (floor === null || !(floor > base)) return base;

  const lifted = Number(floor.toFixed(2));
  // Το ίδιο καπάκι με τη σημερινή συνάρτηση: ποτέ πιο δυνατά από τη θάλασσα έξω → σιωπή.
  if (lifted >= input.openWaterWaveHeightM) return undefined;
  return lifted;
};

waveCharacterModule.shoreSeaStateM = (openWaterSeaStateM, ...rest) => {
  const base = originalShoreSeaState(openWaterSeaStateM, ...rest);
  if (!activeCandidate || (activeCandidate.at !== 'card' && activeCandidate.at !== 'both')) return base;
  // `undefined` = καμία έκπτωση ακτής· η κάρτα δείχνει ήδη το ανοιχτό, που έχει περάσει το δάπεδο.
  if (typeof base !== 'number' || !Number.isFinite(base)) return base;

  currentSite = 'card';
  const floor = floorFor(openWaterSeaStateM);
  if (floor === null || !(floor > base)) return base;

  // Ποτέ πιο δυνατά από τη θάλασσα έξω: το πολύ το ανοιχτό νούμερο.
  const lifted = Number(Math.min(floor, openWaterSeaStateM).toFixed(2));
  if (lifted >= SEA_STATE_AMBER_M) toneReachable += 1;
  return lifted;
};

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};

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
// ΔΟΜΙΚΟ ΜΙΣΟ — χωρίς δίκτυο. Πόσο συχνά ΜΠΟΡΕΙ να ανοίξει η ψαλίδα, ανά τομέα και Μποφόρ.
//
// Το ίδιο πλέγμα με τη μέτρηση της §Γ3: κάθε προφίλ × 8 τομείς ανέμου, με τυπικές εντάσεις και
// μια τυπική ανοιχτή θάλασσα ανά ένταση (η αντιστοίχιση κάνει τη σύγκριση δίκαιη: ένας βοριάς
// 40 χλμ/ώ δεν συνυπάρχει με 0,2 μ. πέλαγος). Η ριπή μπαίνει με λόγο 1,8 — τυπικός μελτεμιακός,
// ΟΧΙ ο λόγος 2,0 της Κυράς Παναγιάς, ώστε το δομικό να μη χτίζεται πάνω στον μάρτυρά του.
// ─────────────────────────────────────────────────────────────────────────────
const STRUCTURAL_WINDS = [
  { kmh: 16, beaufort: 3, openM: 0.3 },
  { kmh: 24, beaufort: 4, openM: 0.6 },
  { kmh: 32, beaufort: 5, openM: 0.9 },
  { kmh: 42, beaufort: 6, openM: 1.4 },
];
const STRUCTURAL_GUST_RATIO = 1.8;

const structuralRows = [];
for (const region of regions) {
  for (const profile of Object.values(region.profiles)) {
    if (typeof profile.facingDeg !== 'number') continue;
    for (const sectorKey of SECTOR_ORDER) {
      const sector = profile.sectors?.[sectorKey];
      if (!sector || typeof sector.fetchKm !== 'number') continue;
      for (const wind of STRUCTURAL_WINDS) {
        const base = originalEstimate({
          openWaterWaveHeightM: wind.openM,
          windSpeedKmh: wind.kmh,
          sector: { fetchKm: sector.fetchKm, blockedRayRatio: sector.blockedRayRatio, onshore: sector.onshore },
          confidence: profile.confidence,
        });
        if (base === undefined) continue;
        const floor = getWindChopWaveFloorM(
          sector.level, wind.beaufort, wind.kmh, wind.kmh * STRUCTURAL_GUST_RATIO, wind.kmh
        );
        structuralRows.push({
          beachId: profile.beachId,
          sector: sectorKey,
          level: sector.level,
          beaufort: wind.beaufort,
          base,
          floor,
          atDisplayFloor: base <= SHORE_DISPLAY_FLOOR_M + 1e-9,
          below: floor > base,
          wouldSilence: floor > base && floor >= wind.openM,
        });
      }
    }
  }
}

console.log('\n══ ΔΟΜΙΚΟ ΜΙΣΟ — πόσο συχνά ο αριθμός ακτής κάθεται κάτω από το δικό μας δάπεδο ══');
console.log(`Προφίλ: ${regions.reduce((s, r) => s + Object.keys(r.profiles).length, 0)} · συνδυασμοί όπου η εκτίμηση ΜΙΛΑΕΙ: ${structuralRows.length}`);
{
  const speaking = structuralRows.length;
  const below = structuralRows.filter(r => r.below);
  const atFloor = structuralRows.filter(r => r.atDisplayFloor);
  console.log(`Κάτω από το δάπεδο ψιλοκύματος: ${below.length} (${pct(below.length, speaking)})`);
  console.log(`Κολλημένα ακριβώς στο 0,10 μ.:  ${atFloor.length} (${pct(atFloor.length, speaking)})`);
  console.log('\n  ανά Μποφόρ:');
  for (const wind of STRUCTURAL_WINDS) {
    const rows = structuralRows.filter(r => r.beaufort === wind.beaufort);
    const bad = rows.filter(r => r.below);
    const gaps = bad.map(r => Number((r.floor - r.base).toFixed(2)));
    console.log(`   ${wind.beaufort} Μπφ · μιλάει ${String(rows.length).padStart(6)} · κάτω από το δάπεδο ${String(bad.length).padStart(6)} (${pct(bad.length, rows.length)}) · διάμεσο χάσμα ${percentile(gaps, 0.5) ?? '—'} μ.`);
  }
  console.log('\n  ανά έκθεση τομέα:');
  for (const level of ['protected', 'partial', 'exposed']) {
    const rows = structuralRows.filter(r => r.level === level);
    const bad = rows.filter(r => r.below);
    console.log(`   ${level.padEnd(10)} · μιλάει ${String(rows.length).padStart(6)} · κάτω ${String(bad.length).padStart(6)} (${pct(bad.length, rows.length)})`);
  }
  const silenced = structuralRows.filter(r => r.wouldSilence);
  console.log(`\n  Από αυτά, όσα το καπάκι «ποτέ πιο δυνατά από τα ανοιχτά» θα ΣΩΠΑΙΝΕ: ${silenced.length} (${pct(silenced.length, below.length)} των «κάτω»)`);
  console.log('  — δηλαδή η κάρτα θα έδειχνε το ανοιχτό νούμερο, όχι έναν νέο αριθμό ακτής.');
}

if (!LIVE) {
  console.log('\nΤρέξε με --live για το τι αλλάζει σε αριθμό, λέξη, ετυμηγορία και podium.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// ΖΩΝΤΑΝΟ ΜΙΣΟ — κάθε παραλία σκοράρεται 3 φορές από ΤΟΝ ΙΔΙΟ άνεμο και ΤΗΝ ΙΔΙΑ θάλασσα.
// ─────────────────────────────────────────────────────────────────────────────
const CANDIDATES = [
  { key: 'base', candidate: null, label: 'σήμερα' },
  { key: 'model', candidate: { at: 'model', gate: 'mean' }, label: 'δάπεδο στην ΕΚΤΙΜΗΣΗ ακτής (≥4 Μπφ)' },
  { key: 'card', candidate: { at: 'card', gate: 'mean' }, label: 'δάπεδο στην ΕΚΠΤΩΣΗ ×0,5/K_d (≥4 Μπφ)' },
  { key: 'both', candidate: { at: 'both', gate: 'mean' }, label: 'δάπεδο ΚΑΙ ΣΤΑ ΔΥΟ — ο αριθμός που βλέπει ο κόσμος (≥4 Μπφ)' },
  { key: 'bothFull', candidate: { at: 'both', gate: 'full' }, label: 'ΚΑΙ ΣΤΑ ΔΥΟ, χωρίς την πύλη των 4 Μποφόρ (με ριπή)' },
];

const CONCURRENCY = 1;
const REGION_DELAY_MS = 250;
const RETRY_BACKOFF_MS = [20000, 45000, 90000];
const MIN_COVERAGE = 0.9;
const POINTS_PER_MINUTE = openMeteoKey ? 600 : 120;
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

/** Ο αριθμός που ΒΛΕΠΕΙ ο επισκέπτης στην κάρτα — το ίδιο πεδίο που στέλνει το feedback. */
const shownM = (score) => (
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

  const windDirectionDeg = regionDay.wind?.deg;
  const dayByBeachId = new Map();
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    dayByBeachId.set(beach.id, beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay);
  }

  const scoresByKey = new Map();
  const top3ByKey = {};
  for (const variant of CANDIDATES) {
    activeCandidate = variant.candidate;
    const scores = new Map();
    for (const beach of region.beaches) {
      const dayForecast = dayByBeachId.get(beach.id);
      recorded = [];
      scores.set(beach.id, calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      }));
    }
    scoresByKey.set(variant.key, scores);
    const suitable = getSuitableBeaches(
      region.beaches, regionDay, 'gr', undefined, regionDay.hourly, undefined, undefined, region.profiles, scores
    );
    top3ByKey[variant.key] = prioritizeProtectedRecommendations(
      suitable, getBeaufortLevel((regionDay.wind?.speed ?? 0) * 3.6)
    ).slice(0, 3).map(item => item.beach.id);
  }
  activeCandidate = null;

  const baseScores = scoresByKey.get('base');
  const rows = [];
  let noData = 0;

  for (const beach of region.beaches) {
    const base = baseScores.get(beach.id);
    const baseShown = shownM(base);
    if (baseShown === null) { noData += 1; continue; }

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
      beaufort: typeof base.windSpeedKmph === 'number' ? getBeaufortLevel(base.windSpeedKmph) : null,
      windKmh: typeof base.windSpeedKmph === 'number' ? Number(base.windSpeedKmph.toFixed(1)) : null,
      fromDepartingSea: base.shoreWaveFromDepartingSea === true,
      onshore: liveOnshore === null ? null : Number(liveOnshore.toFixed(3)),
      fetchKm: typeof sector?.fetchKm === 'number' ? sector.fetchKm : null,
      byKey: {},
    };
    for (const variant of CANDIDATES) {
      const score = scoresByKey.get(variant.key).get(beach.id);
      const shown = shownM(score);
      row.byKey[variant.key] = {
        shownM: shown,
        shoreM: typeof score.shoreWaveHeightM === 'number' ? score.shoreWaveHeightM : null,
        word: shown === null ? null : waveFeelLevel(shown),
        comfort: score.swimmingComfort ?? null,
      };
    }
    rows.push(row);
  }

  /**
   * ⚠️ Η ΔΙΚΛΕΙΔΑ ΠΟΥ ΕΛΕΙΠΕ (06/09/2026, πρώτο εθνικό πέρασμα). Η ελεύθερη πόρτα του Open-Meteo
   * γύρισε 429 σε ολόκληρες περιοχές. Χωρίς θάλασσα, το `measuredWaveHeightM` λείπει, η εκτίμηση
   * ακτής δεν μιλάει, και η περιοχή αναφέρει **«καμία αλλαγή»** — δηλαδή ακριβώς το αποτέλεσμα
   * που θα έκανε το εύρημα να φαίνεται ακίνδυνο. Μια περιοχή μετράει μόνο αν οι μισές τουλάχιστον
   * παραλίες της έχουν πραγματικό ύψος κύματος· αλλιώς γυρίζει `skipped` και το `runPool` την
   * ξαναζητάει με backoff.
   */
  const withSea = region.beaches.filter(b => typeof baseScores.get(b.id)?.marine?.waveHeightM === 'number').length;
  if (region.beaches.length === 0 || withSea < region.beaches.length * 0.5) {
    return { regionId: region.regionId, skipped: `μετρημένη θάλασσα σε ${withSea}/${region.beaches.length}` };
  }

  return {
    regionId: region.regionId,
    windKmh: Number(((regionDay.wind?.speed ?? 0) * 3.6).toFixed(1)),
    windDirectionDeg: typeof windDirectionDeg === 'number' ? Math.round(windDirectionDeg) : null,
    beaches: region.beaches.length,
    noData,
    rows,
    top3ByKey,
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
  'utils/waveModel.ts',
  'utils/weatherUtils.ts',
  'scripts/measureShoreChopFloorGap.mjs',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + '@' + new Date().toISOString().slice(0, 10);

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
  else console.log('  Η μνήμη πετάχτηκε: άλλαξε ο κώδικας ή η μέρα της πρόγνωσης.');
} catch { /* first run */ }

const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));
console.log(`\n══ ΖΩΝΤΑΝΟ: ${regions.length - toFetch.length} περιοχές από μνήμη, ${toFetch.length} νέες ══`);
const fetched = (await runPool(toFetch, measureRegion)).filter(Boolean);
for (const result of fetched) {
  if (result?.regionId) cache[result.regionId] = result;
}
mkdirSync(path.dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify({ codeStamp, regions: cache }));

const results = regions.map(region => cache[region.regionId]).filter(regionComplete);
const coverage = results.length / Math.max(1, regions.length);
const allRows = results.flatMap(r => r.rows);

const COMFORT_ORDER = ['avoid_swimming', 'caution', 'good', 'excellent'];
const comfortRank = (value) => {
  const index = COMFORT_ORDER.indexOf(value);
  return index === -1 ? null : index;
};

console.log(`\nΚάλυψη: ${results.length}/${regions.length} περιοχές (${pct(results.length, regions.length)}) · ${allRows.length} παραλίες`);
if (coverage < MIN_COVERAGE) console.log('⚠️ ΚΑΤΩ ΑΠΟ ΤΟ ΟΡΙΟ 90% — τα ποσοστά είναι ενδεικτικά, όχι εθνικά.');
console.log(`Κλήσεις Open-Meteo (πληρωμένη πόρτα): ${paidCalls}`);
console.log(`Αντιστοίχιση δαπέδου: ${matched} ταιριάξανε · ${unmatched} ΟΧΙ (εκτίμηση ${unmatchedBySite.model} · έκπτωση ${unmatchedBySite.card})${unmatched ? ' ⚠️' : ''}`);
console.log(`Ανεβασμένα νούμερα που φτάνουν το κατώφλι χρώματος 0,80 μ.: ${toneReachable}${toneReachable ? ' ⚠️ ΤΟ ΧΡΩΜΑ ΜΠΟΡΕΙ ΝΑ ΑΛΛΑΞΕΙ' : ' — το χρώμα δεν αγγίζεται'}`);

const summary = {};
for (const variant of CANDIDATES.filter(v => v.candidate)) {
  const raised = [];
  const wordChanged = [];
  const comfortWorse = [];
  const comfortBetter = [];
  const silenced = [];
  const byBeaufort = {};
  const byOrigin = { measured: 0, guess: 0 };

  for (const row of allRows) {
    const base = row.byKey.base;
    const cand = row.byKey[variant.key];
    if (base.shownM === null || cand.shownM === null) continue;
    const delta = Number((cand.shownM - base.shownM).toFixed(2));
    if (delta > 0) {
      raised.push({ ...row, delta });
      const b = row.beaufort ?? '—';
      byBeaufort[b] = (byBeaufort[b] ?? 0) + 1;
      if (row.fromDepartingSea) byOrigin.measured += 1; else byOrigin.guess += 1;
      if (base.shoreM !== null && cand.shoreM === null) silenced.push(row);
    }
    if (base.word !== cand.word) wordChanged.push({ ...row, from: base.word, to: cand.word });
    const bRank = comfortRank(base.comfort);
    const cRank = comfortRank(cand.comfort);
    if (bRank !== null && cRank !== null && cRank !== bRank) {
      (cRank < bRank ? comfortWorse : comfortBetter).push({ ...row, from: base.comfort, to: cand.comfort });
    }
  }

  const deltas = raised.map(r => r.delta);
  const podiumChanged = results.filter(r =>
    (r.top3ByKey?.base ?? []).join(',') !== (r.top3ByKey?.[variant.key] ?? []).join(',')
  );

  summary[variant.key] = {
    label: variant.label,
    raised: raised.length,
    raisedPct: pct(raised.length, allRows.length),
    medianDeltaM: percentile(deltas, 0.5),
    p90DeltaM: percentile(deltas, 0.9),
    maxDeltaM: deltas.length ? Math.max(...deltas) : null,
    silencedToOpenSea: silenced.length,
    wordChanged: wordChanged.length,
    comfortWorse: comfortWorse.length,
    comfortBetter: comfortBetter.length,
    byBeaufort,
    byOrigin,
    podiumRegionsChanged: podiumChanged.length,
    podiumRegions: podiumChanged.map(r => r.regionId),
    worstExamples: raised.sort((a, b) => b.delta - a.delta).slice(0, 8)
      .map(r => ({ beachId: r.beachId, name: r.name, beaufort: r.beaufort, exposureLevel: r.exposureLevel, from: r.byKey.base.shownM, to: r.byKey[variant.key].shownM, fromDepartingSea: r.fromDepartingSea })),
  };

  const s = summary[variant.key];
  console.log(`\n── ${variant.label} ──────────────────────────────────`);
  console.log(`(β) ανεβαίνει ο αριθμός: ${s.raised} παραλίες (${s.raisedPct}) · διάμεσο +${s.medianDeltaM ?? '—'} μ. · p90 +${s.p90DeltaM ?? '—'} · max +${s.maxDeltaM ?? '—'}`);
  console.log(`    από αυτές, ΜΕΤΡΗΜΕΝΗ απόδειξη ότι το νερό φεύγει: ${s.byOrigin.measured} · γεωμετρική εικασία: ${s.byOrigin.guess}`);
  console.log(`    σιώπησαν και δείχνουν πια τα ανοιχτά: ${s.silencedToOpenSea}`);
  console.log(`(γ) αλλάζει ΛΕΞΗ κύματος: ${s.wordChanged} · ΕΤΥΜΗΓΟΡΙΑ χειρότερη: ${s.comfortWorse} · καλύτερη: ${s.comfortBetter}${s.comfortBetter ? ' ⚠️ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ' : ''}`);
  console.log(`(δ) podium αλλάζει σε ${s.podiumRegionsChanged}/${results.length} περιοχές`);
  console.log(`    ανά Μποφόρ: ${Object.entries(s.byBeaufort).sort().map(([k, v]) => `${k}Μπφ:${v}`).join(' · ') || '—'}`);
}

// Ο μάρτυρας που γέννησε τη μέτρηση.
const witness = allRows.find(r => r.beachId === 2308);
if (witness) {
  console.log('\n── ΜΑΡΤΥΡΑΣ · Κυρά Παναγιά #2308 ──');
  console.log(`  ${witness.beaufort} Μπφ · ${witness.exposureLevel} · μετρημένη-φυγή:${witness.fromDepartingSea}`);
  for (const variant of CANDIDATES) {
    const v = witness.byKey[variant.key];
    console.log(`  ${variant.key.padEnd(5)} → δείχνει ${v.shownM} μ. (ακτή ${v.shoreM}) · λέξη ${v.word} · ${v.comfort}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'shore-chop-floor-gap.json');
writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  coverage: Number(coverage.toFixed(3)),
  regions: results.length,
  beaches: allRows.length,
  floorMatch: { matched, unmatched, toneReachable },
  structural: {
    speakingCombinations: structuralRows.length,
    belowFloor: structuralRows.filter(r => r.below).length,
    atDisplayFloor: structuralRows.filter(r => r.atDisplayFloor).length,
    wouldSilence: structuralRows.filter(r => r.wouldSilence).length,
  },
  summary,
  witness: witness ?? null,
}, null, 2));
console.log(`\n→ ${path.relative(root, reportPath)}`);
