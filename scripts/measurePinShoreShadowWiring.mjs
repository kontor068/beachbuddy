#!/usr/bin/env node
/**
 * ΤΟ K_d ΣΤΟ ΧΡΩΜΑ ΜΟΝΟ ΠΡΟΣ ΤΟ ΠΡΟΣΕΚΤΙΚΟΤΕΡΟ — ΕΘΝΙΚΟ ΠΡΙΝ/ΜΕΤΑ ΣΕ ΚΑΘΕ ΕΠΙΦΑΝΕΙΑ (11/09/2026).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Η έκπτωση σκιάς K_d (utils/seaArrival.resolveShoreShadowDamping· 0,1 βαθιά σκιά …
 * 1 ανοιχτό) οδηγεί ήδη τον τυπωμένο αριθμό ακτής και την ετυμηγορία. Πινέζα, τσιπ κάρτας (= χρώμα
 * σελίδας, λέξη βαθμίδας, εικονίδιο κύματος) και μικρός χάρτης της σελίδας ΔΕΝ το έπαιρναν: έφτανε
 * undefined → ιστορικό ×0,5 στη utils/waveCharacter.shoreSeaStateM. Η πρώτη καλωδίωση τους έδωσε το
 * ΠΛΗΡΕΣ K_d και απορρίφθηκε από δύο ελεγκτές: σε θάλασσα ≥2,4 μ. το δάπεδο 0,1 γύριζε κόκκινο→
 * πορτοκαλί, «Καλύτερα άλλη μέρα» → «Έχει κύμα σήμερα» πάνω από «μην κολυμπήσεις», διπλασίαζε τις
 * «Καταλληλότερες» και το «Ήρεμο νερό», και έκανε το εικονίδιο κύματος κόκκινο→μπλε.
 *
 * Ο ΝΕΟΣ ΣΧΕΔΙΑΣΜΟΣ. Κάθε δρόμος χρώματος παίρνει utils/waveCharacter.colourShadowDamping(K_d) =
 * max(K_d, 0,5): το score το κουβαλά ως `toneShoreShadowDamping`, το τσιπ το παίρνει ως τελευταίο όρισμα
 * της applySeaStateToWindSuitability, και τα αντικείμενα χάρτη (App.tsx mapSuitableBeaches, οι δύο
 * λίστες του services/recommendationService, ο μικρός χάρτης της σελίδας) το αντιγράφουν στο δικό τους
 * `shoreShadowDamping`· ο μικρός χάρτης και το πάνελ της πινέζας (components/BeachMap renderBeachInfo)
 * πήραν και την άφιξη θάλασσας. Υπόσχεση: το χρώμα μόνο ΣΚΛΗΡΑΙΝΕΙ όπου η γεωμετρία λέει ανοιχτό
 * (K_d > 0,5) και μένει ΑΚΡΙΒΩΣ ίδιο όπου λέει σκιά (K_d ≤ 0,5 → 0,5 ≡ undefined). Ο μικρός χάρτης και
 * το πάνελ είναι οι μόνες επιφάνειες που επιτρέπεται να κινηθούν και προς τις δύο μεριές, γιατί τώρα
 * λένε ό,τι η πινέζα της περιοχής. Αυτό εδώ ελέγχει την υπόσχεση σε ΚΑΘΕ επιφάνεια που βλέπει ο
 * επισκέπτης. ΚΑΜΙΑ γραμμή παραγωγής δεν αλλάζει.
 *
 * ΤΡΕΙΣ ΕΚΔΟΧΕΣ ανά (παραλία, σενάριο), όλες πάνω στην ΙΔΙΑ βαθμολογία του δέντρου εργασίας:
 *   • ΠΡΙΝ (LEGACY) = ό,τι είναι live: αντικείμενο χάρτη ΧΩΡΙΣ `shoreShadowDamping`· τσιπ από την
 *     ΠΡΑΓΜΑΤΙΚΗ applySeaStateToWindSuitability με τα 9 πρώτα ορίσματα της κλήσης (χωρίς K_d)· μικρός
 *     χάρτης και πάνελ χωρίς άφιξη θάλασσας και χωρίς K_d.
 *   • ΤΩΡΑ (NOW) = η παραγωγή όπως είναι: τα score-πεδία του αντικειμένου χάρτη και του μικρού χάρτη
 *     διαβάζονται από το συντακτικό δέντρο του App.tsx / pages/BeachDetailPage.tsx (όπως το Ζ του
 *     scripts/validateShoreShadowContract.mjs — πεδίο που σβήνεται εκεί σβήνεται και εδώ)· τσιπ = το
 *     χρώμα του score.
 *   • ΠΛΗΡΕΣ (FULL) = ο απορριφθείς σχεδιασμός, ΜΟΝΟ στήλη αναφοράς: το πλήρες K_d του score παντού.
 * Επιφάνειες (ό,τι βλέπει ο επισκέπτης):
 *   • πινέζα — resolveConditionTone με τα ορίσματα του components/BeachMap.tsx beachToneInput (επίπεδο
 *     από getConsistentVisibleMapExposureLevels όπως το App.tsx canonicalMapExposureLevels)·
 *   • τσιπ = χρώμα σελίδας — score.simpleWindSuitability.suitabilityColor·
 *   • λέξη βαθμίδας — utils/experienceTier getExperienceTier + getExperienceTierLabel με τα ορίσματα του
 *     hero <TodayScoreBadge> της σελίδας (pages/BeachDetailPage.tsx:2542-2562: getDetailBadgeScore,
 *     calculateSeaConditionScore με assessSwellExposure, κύμα οθόνης, επίπεδο της πινέζας περιοχής) και
 *     conditionTone = τσιπ, όπως το components/TodayScoreBadge.tsx (και seaIsRough από utils/seaVerdict)·
 *   • εικονίδιο κύματος — seaOnlyColor (utils/conditionCause.resolveFactorTones μέσω του toneInput του τσιπ)·
 *   • κείμενο αιτίας τσιπ — utils/windExposureCopy.describeSimpleWindSuitability (App windExposureReason)·
 *   • «Καταλληλότερες» — App.tsx toneSuitableDirectorySource = selectSuitableByTone(listable, χρώμα
 *     πινέζας), listable = directoryListabilityGate (γυμνιστών, μόνο-με-βάρκα στα ≥5 Μπφ, avoid_swimming)·
 *   • «Ήρεμο νερό» — ανά παραλία utils/calmWaterFilter.isCalmWaterPick και η ΠΡΟΣΦΟΡΑ της περιοχής
 *     resolveCalmWaterState πάνω στις ίδιες listable (components/BeachMap.tsx:3688-3694)·
 *   • πορτοκαλί πινέζα πάνω από avoid_swimming · πινέζα == χρώμα σελίδας·
 *   • μικρός χάρτης της σελίδας (<BeachMap beaches={[{…}]}>) και πάνελ πινέζας (getExposureMarkerTone:
 *     χωρίς windSpeedKmh / forecastUncertain) — και οι δύο φορές χωριστά.
 * ΜΩΛΟΣ #2040: από το HEAD κουβαλά την αλλαγή της μαρτυρίας (utils/seaArrival JUDGE_WITNESSED_ARRIVAL_ARCS),
 * άρα το «live» του δεν είναι το ΠΡΙΝ του δέντρου. Βγαίνει από ΟΛΕΣ τις μετρήσεις χρώματος (και στα
 * σύνολα της περιοχής «παγώνει» στο ΠΡΙΝ, ώστε η αλλαγή του να μη μετακινεί το παράθυρο των άλλων)
 * και αναφέρεται χωριστά (`molos2040`).
 * Καιρός: utils/weatherFixtures.createDailyForecast (μέρα 0), ένας για όλη τη χώρα ανά σενάριο.
 * Πλέγματα: `main` κύμα 0..345° ανά 15° × Hs {0,5 · 1,0 · 1,6} × άνεμος {από τη μεριά του κύματος 20
 * και 35 χλμ/ώ · αντίθετος 20} = 216· `lightWind` ίδια κύματα με 8/15 χλμ/ώ από τη μεριά του κύματος
 * και 15 αντίθετος (εκεί ζει το δάπεδο «ΙΔΑΝΙΚΗ», μπλε↔κίτρινο)· `bigSea` Hs {2,0 · 2,5 · 3,0} με 35/45
 * από τη μεριά του κύματος και 20 αντίθετος (εκεί το K_d<0,5 ηρεμούσε το χρώμα στο ΠΛΗΡΕΣ).
 * Έλεγχοι (πρέπει 0, αλλιώς έξοδος 1 — η αναφορά γράφεται πάντως): ΤΩΡΑ δύο φορές → ίδιο· ο
 * καταγραφέας έπιασε μία κλήση τσιπ ανά score, με 10ο όρισμα == toneShoreShadowDamping, και η
 * πραγματική συνάρτηση με αυτά τα ορίσματα ξαναβγάζει το τσιπ· toneShoreShadowDamping ==
 * colourShadowDamping(K_d) == max(K_d, 0,5)· αντικείμενο χάρτη και μικρός χάρτης κουβαλούν αυτό (και
 * την άφιξη)· όπου K_d ≤ 0,5 ή undefined, ΠΡΙΝ == ΤΩΡΑ σε πινέζα/τσιπ/λέξη/εικονίδιο/αριθμό ακτής/«Ήρεμο
 * νερό»· όπου η έκπτωση δεν αγγίζει τον αριθμό ακτής, ΠΡΙΝ == ΤΩΡΑ· το εικονίδιο ανέμου δεν κουνιέται·
 * μικρός χάρτης ΤΩΡΑ == πινέζα περιοχής ΤΩΡΑ· ΚΑΜΙΑ αλλαγή ΠΡΙΝ→ΤΩΡΑ προς το ηρεμότερο σε πινέζα/τσιπ/
 * λέξη/εικονίδιο/«Ήρεμο νερό» ανά παραλία (αυτή είναι η υπόσχεση)· το ΠΛΗΡΕΣ κινείται όπως λέει το K_d.
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν λέει αν το K_d είναι ΣΩΣΤΟ — μόνο τι δείχνει η οθόνη. Το σωστό το κρίνει η άμμος (Sentinel-2,
 *    κάμερες), όχι ο κώδικας.
 *  - Συνθετικός καιρός: ένας άνεμος και ένα κύμα για όλη τη χώρα, ίδια όλες τις ώρες, ρεστία
 *    max(0,2, 0,35×Hs), χωρίς forecastUncertain, χωρίς τοπικό άνεμο cluster· τα ποσοστά είναι «σε πόσα
 *    από αυτά τα ζεύγη», όχι συχνότητες του καλοκαιριού.
 *  - Η λέξη βαθμίδας μετριέται με τα ορίσματα του hero της σελίδας· η κάρτα (components/BeachCard.tsx)
 *    τη δείχνει με δικό της score/κύμα αλλά το ΙΔΙΟ τσιπ, και ανάμεσα στις εκδοχές αλλάζει μόνο το τσιπ.
 *    Ο hero της σελίδας εμφανίζεται μόνο για μόνο-με-βάρκα ή «avoid» παράθυρο (BeachDetailPage.tsx:2540)
 *    και η getSwimmingWindowDisplay (γρ. 614-636) δεν επιστρέφει ποτέ 'avoid' — άρα η λέξη τυπώνεται στις
 *    κάρτες και στη λίστα «κοντινές» της σελίδας (γρ. 3649), όχι στον hero.
 *  - Δεν ξαναχτίζει βάθρο, λεζάντα, φίλτρο χρώματος, μπάρα ώρας, άλλες μέρες, ούτε τις πινέζες που
 *    ζωγραφίζονται από τις δύο λίστες του recommendationService (ίδια πεδία με το αντικείμενο του App).
 *  - «Προς το ηρεμότερο» εδώ = ΠΡΟΣ ΤΟ ΗΠΙΟΤΕΡΟ ΧΡΩΜΑ/ΛΕΞΗ της ίδιας της εφαρμογής, όχι ασφάλεια στη
 *    θάλασσα. Η είσοδος παραλίας στις «Καταλληλότερες»/«Ήρεμο νερό» επειδή ΑΛΛΗ παραλία σκλήρυνε
 *    (γλίστρημα του παραθύρου) μετριέται χωριστά από την «πιο ήρεμη δική της».
 *
 * ΜΕΤΡΗΘΗΚΕ 11/09/2026 (616.680 ζεύγη ανά πλέγμα χωρίς τον Μώλο = 2.855 παραλίες × 216 σενάρια, 110
 * περιοχές, ~6 λεπτά, reports/quality/pin-shore-shadow-wiring.json). ΠΡΙΝ → ΤΩΡΑ (το ΠΛΗΡΕΣ σε παρένθεση):
 *   • ΠΡΟΣ ΤΟ ΗΡΕΜΟΤΕΡΟ, ανά παραλία: 0 σε πινέζα, τσιπ, λέξη βαθμίδας, εικονίδιο κύματος και «Ήρεμο νερό»
 *     — και στα τρία πλέγματα. Κάθε αλλαγή έχει K_d = 1. Έλεγχοι: 0 στους 20, ντετερμινισμός 0/1.850.688.
 *   • main: πινέζα 1.974 (πορτοκαλί→κόκκινο 1.246, μπλε→κίτρινο 728)· τσιπ = λέξη = εικονίδιο 1.234
 *     («Έχει κύμα σήμερα» → «Καλύτερα άλλη μέρα», 1.157 με avoid)· πινέζα==σελίδα 98,28% → 98,40% (μπαίνουν
 *     734, βγαίνουν 6: πινέζα πορτοκαλί→κόκκινο πάνω από τσιπ που μένει πορτοκαλί)· πορτοκαλί πινέζα με
 *     avoid 156.839 → 155.670.
 *   • lightWind: πινέζα 2.536 · τσιπ 2.509 («Ιδανική σήμερα» → «Καλή επιλογή σήμερα» 1.259, «Έχει κύμα» →
 *     «Καλύτερα άλλη μέρα» 1.250)· πινέζα==σελίδα 99,39% (+14/−13).
 *   • bigSea: πινέζα 1.246 · τσιπ 1.234, όλα πορτοκαλί→κόκκινο (ΠΛΗΡΕΣ: 84.446 πινέζες πιο ήρεμες, 84.110
 *     «Καλύτερα άλλη μέρα» → «Έχει κύμα σήμερα», 79.672 εικονίδια κόκκινο→μπλε, «Καταλληλότερες» 34.022 →
 *     69.897, +59.289 «Ήρεμο νερό» — το ΤΩΡΑ 0 από όλα)· πορτοκαλί πινέζα με avoid 61.882 → 60.711 (107.635).
 *   • Η ΜΟΝΗ ΕΙΣΟΔΟΣ ΣΕ ΠΡΟΣΦΟΡΑ, και δεν είναι δικό της ηρεμότερο χρώμα: στο main, όπου η ΜΟΝΗ «Ιδανική»
 *     μιας περιοχής γίνεται «Καλή» (από τις 728), το παράθυρο των δύο καλύτερων χρωμάτων κατεβαίνει
 *     (utils/suitabilityTone.selectSuitableToneGroups, μπλε+κίτρινο → κίτρινο+πορτοκαλί): +64 πορτοκαλί
 *     (63 caution) στις «Καταλληλότερες» σε 35 οθόνες· και το «Ήρεμο νερό» ξυπνά σε 89 οθόνες επειδή
 *     έφυγε η ιδανική (utils/calmWaterFilter CALM_WATER_NEEDS_NO_IDEAL): +392 παραλίες, το δικό τους νερό
 *     αμετάβλητο. lightWind/bigSea: 0. Φεύγουν: −77/−78/−75 από τη λίστα, −1.243/−1.277/0 «Ήρεμο νερό».
 *   • Μικρός χάρτης (επιτρέπεται και προς τις δύο): ≠ πινέζα περιοχής 63.574 / 85.667 / 39.286 → 0· ΠΡΙΝ→
 *     ΤΩΡΑ πιο ήρεμος 14.974 / 34.830 / 14.337 (άφιξη grazing/enclosed), πιο άγριος 50.574 / 53.373 /
 *     26.195. Πάνελ πινέζας ≠ πινέζα 39.923 / 85.667 / 39.286 → 0.
 *   • Μώλος #2040 (216 ανά πλέγμα): ΤΩΡΑ 0 αλλαγές σε πινέζα/τσιπ/λέξη/εικονίδιο/«Ήρεμο νερό»· μόνο μικρός
 *     χάρτης/πάνελ (22/14, 31/31, 13/13) γιατί πήραν την άφιξη. ΠΛΗΡΕΣ: 56 κόκκινο→πορτοκαλί στο bigSea.
 * Προηγούμενη εκδοχή του script (σημασία ΣΗΜΕΡΑ/ΚΑΛΩΔΙΩΜΕΝΟ/ΠΡΙΝ με πλήρες K_d) και η αναφορά της:
 * .tmp/pin-kd-v3/*.PREVIOUS.* (δεν μπαίνουν στο git).
 *
 *   node scripts/measurePinShoreShadowWiring.mjs
 *   (LIMIT_REGIONS=3 LIMIT_ROWS=12 για δοκιμή — τότε ΔΕΝ γράφεται αναφορά· SKIP_LIGHT=1 = μόνο το κύριο)
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const t0 = Date.now();
const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
// Η ΙΔΙΑ εγγραφή του require-cache που φόρτωσε το scoring — αλλιώς ο καταγραφέας θα κρεμόταν σε
// δεύτερο αντίγραφο και δεν θα έπιανε τίποτα (ελέγχεται: μία κλήση ανά score, αλλιώς έξοδος 1).
const windExposureEngine = require(path.join(root, 'utils/windExposureEngine.ts'));
const { assessBeachWindExposure } = windExposureEngine;
const { resolveConditionTone, CALMNESS_ORDER, selectSuitableToneGroups } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { describeConditionCause } = require(path.join(root, 'utils/conditionCause.ts'));
const { isCalmWaterPick, resolveCalmWaterState } = require(path.join(root, 'utils/calmWaterFilter.ts'));
const { seaStateSeverityM, shoreSeaStateM, colourShadowDamping } = require(path.join(root, 'utils/waveCharacter.ts'));
const { holdsFlatWaterUnderOffshoreWind, holdsGlassWaterAtFourBeaufort, hasDownwindSeaSample } =
  require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { getBeaufortLevel, degToCompass } = require(path.join(root, 'utils/weatherUtils.ts'));
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { getExperienceTier, getExperienceTierLabel } = require(path.join(root, 'utils/experienceTier.ts'));
const { getSeaSeverity } = require(path.join(root, 'utils/seaVerdict.ts'));
const { calculateSeaConditionScore } = require(path.join(root, 'utils/seaConditions.ts'));
const { assessSwellExposure } = require(path.join(root, 'utils/swellExposure.ts'));
const { describeSimpleWindSuitability } = require(path.join(root, 'utils/windExposureCopy.ts'));
const { isNaturistBeach } = require(path.join(root, 'utils/naturistBeaches.ts'));
const { hasBoatOnlyAccess } = require(path.join(root, 'utils/access.ts'));
const { PROTECTED_FIRST_BEAUFORT } = require(path.join(root, 'services/topPickRanking.ts'));

// ── Παθητικός καταγραφέας της κλήσης του τσιπ ────────────────────────────────
// Το recommendationService καλεί `(0, windExposureEngine_1.applySeaStateToWindSuitability)(...)`,
// δηλαδή διαβάζει την ιδιότητα του module την ώρα της κλήσης. Την τυλίγουμε ώστε να κρατάμε τα
// ορίσματα· το αποτέλεσμα είναι ΑΥΤΟΥΣΙΟ της πραγματικής συνάρτησης (έλεγχος: ίδιο αντικείμενο).
// Οι εκδοχές ΠΡΙΝ/ΠΛΗΡΕΣ του τσιπ καλούν την ΠΡΑΓΜΑΤΙΚΗ συνάρτηση απευθείας (όχι τον καταγραφέα).
const realApplySeaState = windExposureEngine.applySeaStateToWindSuitability;
let chipCall = null;
windExposureEngine.applySeaStateToWindSuitability = (...args) => {
  const result = realApplySeaState(...args);
  chipCall = { args, result };
  return result;
};

// ── Τα score-πεδία των δύο αντικειμένων χάρτη, από τον ΠΗΓΑΙΟ κώδικα ──────────
// Ίδια ανάγνωση με το Ζ του scripts/validateShoreShadowContract.mjs: App.tsx mapSuitableBeaches (το
// αντικείμενο με simpleWindSuitability) και pages/BeachDetailPage.tsx <BeachMap beaches={[{…}]}>.
const parseTs = (rel) => ts.createSourceFile(rel, readFileSync(path.join(root, rel), 'utf8'),
  ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const walkTs = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walkTs(child, visit)); };
const keyOf = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : undefined);
const copiesFromScore = (obj) => obj.properties
  .filter((p) => ts.isPropertyAssignment(p) && ts.isPropertyAccessExpression(p.initializer)
    && ts.isIdentifier(p.initializer.expression) && p.initializer.expression.text === 'scoreResult')
  .map((p) => [keyOf(p), p.initializer.name.text]);
let appObject = null;
walkTs(parseTs('App.tsx'), (n) => {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'mapSuitableBeaches' && n.initializer) {
    walkTs(n.initializer, (m) => {
      if (ts.isObjectLiteralExpression(m) && m.properties.some((p) => keyOf(p) === 'simpleWindSuitability')) appObject = m;
    });
  }
});
let pageObject = null;
const pageDestructured = new Map(); // `const { … } = scoreResult` της σελίδας, με τις προεπιλογές του
{
  const pageSf = parseTs('pages/BeachDetailPage.tsx');
  walkTs(pageSf, (n) => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(pageSf) === 'BeachMap') {
      for (const attr of n.attributes.properties) {
        const init = ts.isJsxAttribute(attr) && attr.name.getText(pageSf) === 'beaches' ? attr.initializer : undefined;
        const arr = init && ts.isJsxExpression(init) ? init.expression : undefined;
        if (arr && ts.isArrayLiteralExpression(arr) && arr.elements[0] && ts.isObjectLiteralExpression(arr.elements[0])) pageObject = arr.elements[0];
      }
    }
    if (ts.isVariableDeclaration(n) && ts.isObjectBindingPattern(n.name) && n.initializer
      && ts.isIdentifier(n.initializer) && n.initializer.text === 'scoreResult') {
      for (const el of n.name.elements) {
        if (!ts.isIdentifier(el.name)) continue;
        const field = el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName.text : el.name.text;
        const dflt = el.initializer?.kind === ts.SyntaxKind.FalseKeyword ? false : undefined;
        pageDestructured.set(el.name.text, { field, dflt });
      }
    }
  });
}
if (!appObject || !pageObject) {
  console.error(`δεν βρέθηκε ${!appObject ? 'το αντικείμενο του App.tsx mapSuitableBeaches' : ''} ${!pageObject ? 'το <BeachMap beaches={[{…}]}> της σελίδας' : ''} — μετάφερε την ανάγνωση εκεί που μετακόμισαν`);
  process.exit(1);
}
const APP_SCORE_FIELDS = copiesFromScore(appObject);
const PAGE_SCORE_FIELDS = copiesFromScore(pageObject);
const PAGE_SHORTHANDS = pageObject.properties
  .filter((p) => ts.isShorthandPropertyAssignment(p) && pageDestructured.has(p.name.text))
  .map((p) => [p.name.text, pageDestructured.get(p.name.text)]);
const fieldCopied = (fields, key, from) => fields.some(([k, f]) => k === key && f === from);

// ── Δεδομένα ─────────────────────────────────────────────────────────────────
const LIMIT_REGIONS = Number(process.env.LIMIT_REGIONS) || 0;
const LIMIT_ROWS = Number(process.env.LIMIT_ROWS) || 0;
const SKIP_LIGHT = process.env.SKIP_LIGHT === '1';
const MOLOS_ID = 2040;
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
let regionIds = readdirSync(exposureDir).filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => f.replace(/\.json$/, '')).sort();
if (LIMIT_REGIONS) regionIds = regionIds.slice(0, LIMIT_REGIONS);
const regions = [];
let profileCount = 0;
let profilesWithoutAppBeach = 0;
for (const regionId of regionIds) {
  const profilesById = {};
  for (const p of Object.values(JSON.parse(readFileSync(path.join(exposureDir, `${regionId}.json`), 'utf8')).profiles ?? {})) {
    if (p?.beachId != null) { profilesById[p.beachId] = p; profileCount += 1; }
  }
  let beaches = [];
  try {
    beaches = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${regionId}.json`), 'utf8')).island?.beaches ?? [];
  } catch { beaches = []; }
  const ids = new Set(beaches.map((b) => b.id));
  profilesWithoutAppBeach += Object.keys(profilesById).filter((id) => !ids.has(Number(id))).length;
  // Στατικά της πύλης listability (App.tsx directoryListabilityGate), μία φορά ανά παραλία.
  const staticGate = new Map(beaches.map((b) => [b.id, { naturist: isNaturistBeach(b), boatOnly: hasBoatOnlyAccess(b) }]));
  regions.push({ regionId, beaches, profilesById, staticGate });
}
const measuredBeaches = regions.reduce((n, r) => n + r.beaches.filter((b) => r.profilesById[b.id]).length, 0);
const regionBeachesTotal = regions.reduce((n, r) => n + r.beaches.length, 0);
const regionById = new Map(regions.map((r) => [r.regionId, r]));

// ── Πλέγματα ─────────────────────────────────────────────────────────────────
const DIRS = Array.from({ length: 24 }, (_, i) => i * 15);
const HS_M = [0.5, 1.0, 1.6];
const BIG_HS_M = [2.0, 2.5, 3.0];
const buildRows = (winds, hsList = HS_M) => {
  let out = [];
  for (const waveDeg of DIRS) for (const hs of hsList) for (const w of winds) {
    out.push({ regime: w.regime, waveDeg, windDeg: w.opposite ? (waveDeg + 180) % 360 : waveDeg, windKmh: w.kmh, hs });
  }
  if (LIMIT_ROWS) out = out.filter((_, i) => i % Math.ceil(out.length / LIMIT_ROWS) === 0);
  return out;
};
const GRIDS = [
  { name: 'main', rows: buildRows([
    { regime: 'onshore-20', kmh: 20 }, { regime: 'onshore-35', kmh: 35 }, { regime: 'opposite-20', kmh: 20, opposite: true },
  ]) },
  ...(SKIP_LIGHT ? [] : [{ name: 'lightWind', rows: buildRows([
    { regime: 'onshore-8', kmh: 8 }, { regime: 'onshore-15', kmh: 15 }, { regime: 'opposite-15', kmh: 15, opposite: true },
  ]) }, { name: 'bigSea', rows: buildRows([
    { regime: 'onshore-35', kmh: 35 }, { regime: 'onshore-45', kmh: 45 }, { regime: 'opposite-20', kmh: 20, opposite: true },
  ], BIG_HS_M) }]),
];
const rowLabel = (r) => `κύμα ${r.waveDeg}° Hs ${r.hs} μ. · άνεμος ${r.windDeg}° ${r.windKmh} χλμ/ώ (${r.regime})`;
const dayFor = (row) => {
  const windMs = row.windKmh / 3.6;
  return createDailyForecast(0, {
    id: 'pin-kd', label: 'pin-kd', windDirectionDeg: row.windDeg, windSpeedMs: windMs,
    windGustMs: windMs * 1.35, waveHeightM: row.hs, waveDirectionDeg: row.waveDeg,
  });
};

// ── Όπως το App / ο χάρτης / η σελίδα ────────────────────────────────────────
/** App.tsx mapSuitableBeaches — ίδια ορίσματα βαθμολογίας (userLocation/preferences: κανένα). Η σελίδα
 *  (pages/BeachDetailPage.tsx, weatherSource="island-fallback" από το App) ίδια. */
const scoreBeach = (beach, day, profile) => {
  chipCall = null;
  const s = calculateBeachScore(beach, day, undefined, undefined, {
    weatherSource: 'island-fallback',
    hourlyForecast: day.hourly,
    geospatialProfile: profile,
  });
  return { s, call: chipCall };
};

/** App.tsx mapSuitableBeaches: τα ΜΗ-score πεδία όπως τα χτίζει το App (assessBeachWindExposure με τον
 *  άνεμο της παραλίας), + ΟΛΑ τα `κλειδί: scoreResult.πεδίο` όπως τα διάβασε το δέντρο του App.tsx
 *  (από 11/09: shoreShadowDamping ← toneShoreShadowDamping). forecastUncertain δεν μπαίνει εκεί. */
const appMapItem = (beach, day, s, profile) => {
  const windKmh = day.wind.speed * 3.6;
  const a = assessBeachWindExposure({
    beach,
    geospatialProfile: profile,
    windDirectionDeg: day.wind.deg,
    windDirection: degToCompass(day.wind.deg),
    windSpeedKmh: windKmh,
    beaufort: getBeaufortLevel(windKmh),
    waveHeightMeters: day.marine?.waveHeightM,
  });
  const item = {
    beachId: beach.id, explanation: '', beach,
    isExposed: a.exposureLevel ? a.exposureLevel !== 'protected' : true,
    exposureLevel: a.exposureLevel,
    orientation: a.windProfile.beachFacingDirection ?? null,
    windProfile: a.windProfile, windProfileSource: a.source, windSector: a.windSector,
    distance: undefined, geospatialExposure: profile,
  };
  for (const [key, field] of APP_SCORE_FIELDS) item[key] = s[field];
  return item;
};

/** pages/BeachDetailPage.tsx <BeachMap beaches={[{…}]}> — `κλειδί: scoreResult.πεδίο` + τα shorthand
 *  του `const { … } = scoreResult` (ίδιες προεπιλογές), από το δέντρο. Επίπεδο: exposureLevelOverrides
 *  = canonicalMapExposureLevels.get(id) (App.tsx mapExposureLevelOverride). */
const pageMapItem = (beach, s, profile) => {
  const item = { beachId: beach.id, beach, geospatialExposure: profile };
  for (const [key, field] of PAGE_SCORE_FIELDS) item[key] = s[field];
  for (const [key, { field, dflt }] of PAGE_SHORTHANDS) item[key] = s[field] ?? dflt;
  return item;
};
const withoutKeys = (obj, keys) => { const out = { ...obj }; for (const k of keys) delete out[k]; return out; };

/** components/BeachMap.tsx beachToneInput, όρισμα προς όρισμα (ίδιο με measureMolosArrivalArc.pinTone).
 *  Επίπεδο = getMapExposureLevel: override πρώτα, μετά το πέρασμα γειτονιάς. */
const pinToneInput = (item, ctx) => {
  const exposureLevel = ctx.levels.get(item.beach.id) || getVisibleMapExposureLevel(item, ctx.beaufort, ctx.deg);
  const seaStateM = seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS);
  const swellWaveHeightM = item.marine?.swellWaveHeightM;
  return {
    exposureLevel,
    beaufort: ctx.beaufort,
    isEnclosedCove: Boolean(item.enclosedCove),
    seaStateM,
    offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({
      profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, swellWaveHeightM,
    }),
    glassWaterAtFour: holdsGlassWaterAtFourBeaufort({
      profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, seaStateM, exposureLevel,
      seaArrivalExposureLevel: item.seaArrivalExposureLevel, shoreShadowDamping: item.shoreShadowDamping, swellWaveHeightM,
    }),
    downwindSeaSample: hasDownwindSeaSample({ profile: item.geospatialExposure, windDirectionDeg: ctx.deg, swellWaveHeightM }),
    seaArrivalExposureLevel: item.seaArrivalExposureLevel,
    shoreShadowDamping: item.shoreShadowDamping,
    swimVerdictAvoid: item.swimmingComfort === 'avoid_swimming',
    windSpeedKmh: ctx.windKmh,
    forecastUncertain: item.forecastUncertain,
  };
};
/** components/BeachMap.tsx renderBeachInfo → getExposureMarkerTone (γρ. 1812-1883, κλήση 4254-4268): ίδια
 *  ορίσματα με την πινέζα ΧΩΡΙΣ windSpeedKmh και forecastUncertain. ΠΡΙΝ: και χωρίς άφιξη/K_d στα δικά
 *  της ορίσματα (η πόρτα 4 Μπφ διάβαζε ήδη την άφιξη του αντικειμένου — έμενε όπως στην πινέζα ΠΡΙΝ). */
const badgeToneInput = (pinInput, legacy) => ({
  ...pinInput,
  windSpeedKmh: undefined,
  forecastUncertain: undefined,
  ...(legacy ? { seaArrivalExposureLevel: undefined, shoreShadowDamping: undefined } : {}),
});

/** Το τυπωμένο κύμα κάρτας/σελίδας — utils/beachConditionsReadout με τα πεδία του App, 1 δεκαδικό. */
const printedWave = (s, day) => {
  const readout = buildBeachConditionsReadout({
    beachWindSpeedKmph: s.windSpeedKmph, regionWindSpeedMs: day.wind.speed, waveHeightM: s.waveHeightM,
    seaStateWaveM: s.seaStateWaveM, seaStatePeriodS: s.seaStatePeriodS, shoreWaveHeightM: s.shoreWaveHeightM,
    shoreDisplayWaveM: s.shoreDisplayWaveM, shoreWaveFromDepartingSea: s.shoreWaveFromDepartingSea,
    seaArrivalExposureLevel: s.seaArrivalExposureLevel, language: 'gr',
  });
  const hasWave = typeof readout.waveM === 'number' && Number.isFinite(readout.waveM);
  return { printed: hasWave ? Number(readout.waveM.toFixed(1)) : null, text: readout.waveText ?? null };
};

/** Ο hero <TodayScoreBadge> της σελίδας (pages/BeachDetailPage.tsx:2542-2562) και το ίδιο το
 *  components/TodayScoreBadge.tsx:177-191: όλα τα ορίσματα εκτός από το conditionTone είναι ίδια στις
 *  τρεις εκδοχές· επιστρέφει συνάρτηση τσιπ → { tier, label }. getDetailBadgeScore (γρ. 120-124, μη
 *  εξαγόμενη) ξαναγραμμένη αυτολεξεί. */
const pageTierFor = (s, beachId, day, profile, ctx) => {
  const windKmh = day.wind.speed * 3.6;
  const bft = getBeaufortLevel(windKmh);
  const exposureLevel = s.exposureLevel;
  const isExposed = exposureLevel ? exposureLevel !== 'protected' : true;
  const waveHeightM = s.waveHeightM ?? day.marine?.waveHeightM;
  const displayWaveHeightM = waveHeightM;
  const directSwellHere = assessSwellExposure(profile, s.facingDeg ?? null, {
    swellDirectionDeg: day.marine?.swellWaveDirectionDeg,
    swellHeightM: day.marine?.swellWaveHeightM,
    swellPeriodS: day.marine?.swellWavePeriodS,
  }).exposed;
  const seaConditionScore = calculateSeaConditionScore(isExposed, windKmh, exposureLevel, s.seaStateWaveM ?? waveHeightM, directSwellHere, s.seaStatePeriodS);
  const detailBadgeScore = seaConditionScore >= 8 ? Math.max(s.score, 76)
    : (!isExposed && seaConditionScore >= 5 ? Math.max(s.score, 50) : s.score);
  // BeachDetailPage.tsx:1322 — mapExposureLevelOverride (App: canonicalMapExposureLevels.get(id)) ?? exposureLevel.
  const mapAlignedExposureLevel = ctx.levels.get(beachId) ?? exposureLevel;
  const seaIsRough = getSeaSeverity({ waveHeightM: displayWaveHeightM, wavePeriodS: s.seaStatePeriodS, windBeaufort: bft, exposureLevel: mapAlignedExposureLevel }) === 'rough';
  return (conditionTone) => {
    const tier = getExperienceTier({
      score: Math.max(0, Math.min(100, Math.round(detailBadgeScore))),
      windBeaufort: bft, waveHeightM: displayWaveHeightM, wavePeriodS: s.seaStatePeriodS,
      swimmingComfort: s.swimmingComfort, seaConditionScore, exposureLevel: mapAlignedExposureLevel, conditionTone,
    });
    return { tier, label: getExperienceTierLabel(tier, 'gr', { windBeaufort: bft, seaIsRough }) };
  };
};

// ── Μετρητές ─────────────────────────────────────────────────────────────────
const RANK = (tone) => CALMNESS_ORDER.indexOf(tone); // 0 = κόκκινο … 3 = μπλε
const TIER_RANK = { skip: 0, fair: 1, good: 2, excellent: 3 };
const TRANK = (tier) => TIER_RANK[tier] ?? -1;
const CALM = new Set(['blue', 'yellow']);
const WARY = new Set(['caution', 'avoid_swimming']);
const bump = (obj, key, n = 1) => { obj[key] = (obj[key] ?? 0) + n; };
const kdBand = (kd) => (typeof kd !== 'number' ? 'undefined'
  : kd <= 0.1 + 1e-9 ? '0.1 (floor)'
  : kd < 0.5 - 1e-9 ? '0.1-0.5'
  : kd <= 0.5 + 1e-9 ? '0.5'
  : kd < 1 - 1e-9 ? '0.5-1' : '1 (corridor)');
const newDelta = () => ({ changed: 0, calmer: 0, rougher: 0, moves: {}, calmerByKdBand: {}, rougherByKdBand: {}, calmerByVerdict: {}, rougherByVerdict: {} });
/** +1 πιο ήρεμο · −1 πιο άγριο · 0 ίδιο. */
const tallyDelta = (d, from, to, rankOf, kd, verdict, extraKey) => {
  if (from === to) return 0;
  d.changed += 1;
  const dir = Math.sign(rankOf(to) - rankOf(from));
  bump(d.moves, `${from} → ${to}`);
  if (dir > 0) { d.calmer += 1; bump(d.calmerByKdBand, kdBand(kd)); bump(d.calmerByVerdict, verdict); }
  else if (dir < 0) { d.rougher += 1; bump(d.rougherByKdBand, kdBand(kd)); bump(d.rougherByVerdict, verdict); }
  if (extraKey) { d.byArrival ??= {}; bump(d.byArrival, `${extraKey}:${dir > 0 ? 'calmer' : 'rougher'}`); }
  return dir;
};
const newTransitions = () => ({
  pin: newDelta(), chip: newDelta(), tier: newDelta(), tierLabel: { changed: 0, sameTier: 0, moves: {} },
  seaIcon: newDelta(), reasonText: { changed: 0 }, mini: newDelta(), badge: newDelta(),
  calmPick: { added: 0, removed: 0, addedByVerdict: {} },
  // Επιφάνειες ΠΕΡΙΟΧΗΣ (όλες οι παραλίες της περιοχής που περνούν τη listability, Μώλος εκτός):
  offer: { added: 0, removed: 0, addedByCause: {}, removedByCause: {}, addedByTone: {}, addedByVerdict: {}, screensWithAddition: 0, windowMoves: {}, examples: [] },
  calmOffer: { added: 0, removed: 0, addedByCause: {}, removedByCause: {}, screensOfferAppeared: 0, screensOfferVanished: 0, absentReasonMoves: {}, examples: [] },
  // Πινέζα == χρώμα σελίδας: πόσα ζεύγη ΜΠΑΙΝΟΥΝ σε συμφωνία και πόσα ΒΓΑΙΝΟΥΝ (το καθαρό δεν αρκεί).
  pinChipFlow: { enter: 0, leave: 0, leaveMoves: {} },
});
const REGION_EXAMPLE_CAP = 4;
const newState = () => ({
  pinEqChip: 0, orangePinOverAvoid: 0, redPinOverAvoid: 0, orangeChipOverAvoid: 0,
  calmPinOverWary: 0, calmChipOverWary: 0, miniNeRegionPin: 0, badgeNeRegionPin: 0,
  calmWaterPicks: 0, labels: {},
  offerMembers: 0, calmWaterOffered: 0, calmOfferScreens: 0,
});
const makeAgg = () => ({
  pairs: 0, kdBands: {}, verdicts: {}, readable: { pinByToneKd: 0, chipByToneKd: 0 },
  now: newTransitions(), full: newTransitions(),
  state: { L: newState(), N: newState(), F: newState() },
  listablePairs: 0, screens: 0,
  molos: { pairs: 0, now: newTransitions(), full: newTransitions(), scenarios: [] },
  candidates: [],
});
const CAND_CAP = 3000;
const controls = {
  pairs: 0, determinismPairsChecked: 0, determinismDiffs: 0,
  chipCallMissing: 0, chipCallResultNotOnScore: 0, chipArgNotToneKd: 0, chipMirrorMismatch: 0,
  toneKdNotHelper: 0, toneKdNotMaxHalf: 0, mapItemNotToneKd: 0, pageMiniMapNotToneKdOrArrival: 0,
  kdAtOrBelowHalfLegacyNeNow: 0, kdUndefinedAnyVariantDiffers: 0,
  pinNotReadableButChanged: 0, chipNotReadableButChanged: 0, windOnlyIconChanged: 0,
  nowCalmerPin: 0, nowCalmerChip: 0, nowCalmerTier: 0, nowCalmerSeaIcon: 0, nowCalmPickAdded: 0,
  miniNowNeRegionPinNow: 0, fullDirectionViolations: 0,
  examples: [],
};
const controlExample = (e) => { if (controls.examples.length < 12) controls.examples.push(e); };
const VARIANTS = ['L', 'N', 'F'];

// ── Μέτρηση ──────────────────────────────────────────────────────────────────
const runGrid = (grid) => {
  const agg = makeAgg();
  const tGrid = Date.now();
  grid.rows.forEach((row, rowIndex) => {
    const day = dayFor(row);
    const beaufort = getBeaufortLevel(day.wind.speed * 3.6);

    for (const region of regions) {
      const { regionId, beaches, profilesById, staticGate } = region;
      if (!beaches.length) continue;
      const ctxBase = {
        windKmh: day.wind.speed * 3.6, windMs: day.wind.speed, deg: day.wind.deg, beaufort,
        perBeachWind: new Map(beaches.map((b) => [b.id, { beaufort, directionDeg: day.wind.deg }])),
      };
      const runToday = () => {
        const scored = new Map(beaches.map((b) => [b.id, scoreBeach(b, day, profilesById[b.id])]));
        const items = beaches.map((b) => appMapItem(b, day, scored.get(b.id).s, profilesById[b.id]));
        // App.tsx canonicalMapExposureLevels — ίδιες 4 παράμετροι. Δεν διαβάζει K_d (utils/mapExposure.ts
        // δεν αναφέρει shoreShadowDamping), άρα ίδιο για τις τρεις εκδοχές.
        const levels = getConsistentVisibleMapExposureLevels(items, beaufort, day.wind.deg, ctxBase.perBeachWind);
        return { scored, items, levels };
      };
      const A = runToday();
      const B = runToday(); // ΤΩΡΑ δεύτερη φορά, από την αρχή.
      const ctx = { ...ctxBase, levels: A.levels };
      const ctxB = { ...ctxBase, levels: B.levels };

      // Όλες οι παραλίες της περιοχής (και χωρίς προφίλ — χρωματίζουν και μπαίνουν στη λίστα).
      const cells = A.items.map((item, idx) => {
        const id = item.beach.id;
        const { s, call } = A.scored.get(id);
        const kd = s.shoreShadowDamping;
        const inN = pinToneInput(item, ctx);
        const inL = pinToneInput(withoutKeys(item, ['shoreShadowDamping']), ctx);
        const inF = pinToneInput({ ...item, shoreShadowDamping: kd }, ctx);
        const rd = { L: describeConditionCause(inL), N: describeConditionCause(inN), F: describeConditionCause(inF) };
        const g = staticGate.get(id);
        // App.tsx directoryListabilityGate(suppressNaturist = true: χωρίς φίλτρο γυμνιστών, χωρίς αναζήτηση).
        const listable = !g.naturist && !(g.boatOnly && beaufort >= PROTECTED_FIRST_BEAUFORT) && item.swimmingComfort !== 'avoid_swimming';
        return { idx, id, item, s, call, kd, inL, inN, inF, rd, listable };
      });
      // Σύνολα περιοχής: «Καταλληλότερες» και προσφορά «Ήρεμο νερό». Μώλος παγωμένος στο ΠΡΙΝ.
      const listableCells = cells.filter((c) => c.listable);
      const variantOf = (c, V) => (c.id === MOLOS_ID ? 'L' : V);
      const setsFor = (V) => {
        const toneOf = (c) => c.rd[variantOf(c, V)].tone;
        const groups = selectSuitableToneGroups(listableCells, toneOf);
        const offered = new Set(listableCells.filter((c) => groups.includes(toneOf(c))).map((c) => c.id));
        const state = resolveCalmWaterState(listableCells.map((c) => ({ beachId: c.id, reading: c.rd[variantOf(c, V)] })));
        const calmOffered = state.status === 'offered' ? state.beachIds : new Set();
        return { groups, offered, state, calmOffered };
      };
      const sets = { L: setsFor('L'), N: setsFor('N'), F: setsFor('F') };
      agg.screens += 1;
      for (const V of VARIANTS) {
        const S = agg.state[V];
        S.offerMembers += [...sets[V].offered].filter((id) => id !== MOLOS_ID).length;
        S.calmWaterOffered += [...sets[V].calmOffered].filter((id) => id !== MOLOS_ID).length;
        if (sets[V].state.status === 'offered') S.calmOfferScreens += 1;
      }
      for (const [V, T] of [['N', agg.now], ['F', agg.full]]) {
        const a = sets.L.state; const b = sets[V].state;
        const reasonOf = (st) => (st.status === 'offered' ? 'offered' : `absent:${st.reason}`);
        if (reasonOf(a) !== reasonOf(b)) bump(T.calmOffer.absentReasonMoves, `${reasonOf(a)} → ${reasonOf(b)}`);
        if (a.status !== 'offered' && b.status === 'offered') T.calmOffer.screensOfferAppeared += 1;
        if (a.status === 'offered' && b.status !== 'offered') T.calmOffer.screensOfferVanished += 1;
        let screenAdded = false;
        const screenOfferAdds = [];
        const screenCalmAdds = [];
        for (const c of listableCells) {
          if (c.id === MOLOS_ID) continue;
          const verdict = c.s.swimmingComfort ?? 'none';
          const inL = sets.L.offered.has(c.id); const inV = sets[V].offered.has(c.id);
          const ownDir = Math.sign(RANK(c.rd[V].tone) - RANK(c.rd.L.tone));
          const cause = ownDir > 0 ? 'own-pin-calmer' : ownDir < 0 ? 'own-pin-rougher' : 'own-pin-same (window moved)';
          if (!inL && inV) {
            T.offer.added += 1; screenAdded = true;
            bump(T.offer.addedByCause, cause); bump(T.offer.addedByTone, c.rd[V].tone); bump(T.offer.addedByVerdict, verdict);
            screenOfferAdds.push(`#${c.id} ${c.rd[V].tone}/${verdict}`);
          }
          if (inL && !inV) { T.offer.removed += 1; bump(T.offer.removedByCause, cause); }
          const cL = sets.L.calmOffered.has(c.id); const cV = sets[V].calmOffered.has(c.id);
          const pickL = isCalmWaterPick(c.rd.L); const pickV = isCalmWaterPick(c.rd[V]);
          const calmCause = pickV && !pickL ? 'own-pick-gained'
            : !pickV && pickL ? 'own-pick-lost'
            : `own-pick-same (${a.status === 'offered' ? 'offered' : a.reason} → ${b.status === 'offered' ? 'offered' : b.reason})`;
          if (!cL && cV) { T.calmOffer.added += 1; bump(T.calmOffer.addedByCause, calmCause); screenCalmAdds.push(`#${c.id} ${c.rd[V].tone}/${verdict}`); }
          if (cL && !cV) { T.calmOffer.removed += 1; bump(T.calmOffer.removedByCause, calmCause); }
        }
        // Ποια πινέζα της ΙΔΙΑΣ οθόνης άλλαξε και μετακίνησε το παράθυρο/τη σιωπή (Μώλος παγωμένος).
        const triggers = () => cells.filter((x) => x.id !== MOLOS_ID && x.rd.L.tone !== x.rd[V].tone)
          .slice(0, 4).map((x) => `#${x.id} ${x.item.beach.name?.gr ?? ''} ${x.rd.L.tone}→${x.rd[V].tone}`);
        if (screenAdded) {
          T.offer.screensWithAddition += 1;
          bump(T.offer.windowMoves, `${sets.L.groups.join('+')} → ${sets[V].groups.join('+')}`);
          if (T.offer.examples.length < REGION_EXAMPLE_CAP) T.offer.examples.push({ regionId, scenario: rowLabel(row), window: `${sets.L.groups.join('+')} → ${sets[V].groups.join('+')}`, added: screenOfferAdds.slice(0, 6), addedCount: screenOfferAdds.length, triggeredBy: triggers() });
        }
        if (screenCalmAdds.length && T.calmOffer.examples.length < REGION_EXAMPLE_CAP) {
          T.calmOffer.examples.push({ regionId, scenario: rowLabel(row), state: `${reasonOf(a)} → ${reasonOf(b)}`, added: screenCalmAdds.slice(0, 6), addedCount: screenCalmAdds.length, triggeredBy: triggers() });
        }
      }

      // ── Ανά παραλία με προφίλ ──
      for (const c of cells) {
        const profile = profilesById[c.id];
        if (!profile) continue;
        const { s, call, kd, inL, inN, inF, rd, item } = c;
        const beach = item.beach;
        const toneKd = s.toneShoreShadowDamping;
        const verdict = s.swimmingComfort ?? 'none';
        const isMolos = c.id === MOLOS_ID;
        controls.pairs += 1;

        // ── έλεγχοι καλωδίωσης ──
        if (toneKd !== colourShadowDamping(kd)) controls.toneKdNotHelper += 1;
        const expectTone = typeof kd === 'number' && Number.isFinite(kd) ? Math.max(kd, 0.5) : undefined;
        if (toneKd !== expectTone) controls.toneKdNotMaxHalf += 1;
        if (item.shoreShadowDamping !== toneKd) controls.mapItemNotToneKd += 1;
        const pItemN = pageMapItem(beach, s, profile);
        if (pItemN.shoreShadowDamping !== toneKd || pItemN.seaArrivalExposureLevel !== s.seaArrivalExposureLevel) controls.pageMiniMapNotToneKdOrArrival += 1;

        // ── πινέζα ──
        const pin = { L: rd.L.tone, N: rd.N.tone, F: rd.F.tone };

        // ── τσιπ (= χρώμα σελίδας), εικονίδια, κείμενο αιτίας ──
        const chipObj = { L: s.simpleWindSuitability, N: s.simpleWindSuitability, F: s.simpleWindSuitability };
        let chipReadable = false;
        if (!call) {
          controls.chipCallMissing += 1;
        } else {
          if (call.result !== s.simpleWindSuitability) controls.chipCallResultNotOnScore += 1;
          if (call.args.length !== 10 || call.args[9] !== toneKd) controls.chipArgNotToneKd += 1;
          const base9 = call.args.slice(0, 9);
          const mirror = realApplySeaState(...call.args);
          if (mirror.suitabilityColor !== s.simpleWindSuitability?.suitabilityColor || mirror.seaOnlyColor !== s.simpleWindSuitability?.seaOnlyColor) {
            controls.chipMirrorMismatch += 1;
            controlExample({ kind: 'chip-mirror', grid: grid.name, regionId, beachId: c.id, row: rowLabel(row) });
          }
          chipObj.L = realApplySeaState(...base9);
          chipObj.F = realApplySeaState(...base9, kd);
          const [suit, chipSea, , , , chipArrival, , chipCurated] = call.args;
          chipReadable = shoreSeaStateM(chipSea, suit.exposureStatus, chipArrival, chipCurated, toneKd)
            !== shoreSeaStateM(chipSea, suit.exposureStatus, chipArrival, chipCurated, undefined);
        }
        const chip = { L: chipObj.L?.suitabilityColor, N: chipObj.N?.suitabilityColor, F: chipObj.F?.suitabilityColor };
        const icon = { L: chipObj.L?.seaOnlyColor, N: chipObj.N?.seaOnlyColor, F: chipObj.F?.seaOnlyColor };
        if (chipObj.L?.windOnlyColor !== chipObj.N?.windOnlyColor || chipObj.L?.windOnlyColor !== chipObj.F?.windOnlyColor) controls.windOnlyIconChanged += 1;
        const reason = {
          L: describeSimpleWindSuitability(chipObj.L, 'gr'), N: describeSimpleWindSuitability(chipObj.N, 'gr'), F: describeSimpleWindSuitability(chipObj.F, 'gr'),
        };

        // ── λέξη βαθμίδας (hero της σελίδας, conditionTone = τσιπ) ──
        const tierOf = pageTierFor(s, c.id, day, profile, ctx);
        const tier = { L: tierOf(chip.L), N: tierOf(chip.N), F: tierOf(chip.F) };

        // ── μικρός χάρτης της σελίδας και πάνελ πινέζας ──
        const pItemL = withoutKeys(pItemN, ['seaArrivalExposureLevel', 'shoreShadowDamping']);
        const pItemF = { ...pItemN, seaArrivalExposureLevel: s.seaArrivalExposureLevel, shoreShadowDamping: kd };
        const mini = {
          L: resolveConditionTone(pinToneInput(pItemL, ctx)), N: resolveConditionTone(pinToneInput(pItemN, ctx)), F: resolveConditionTone(pinToneInput(pItemF, ctx)),
        };
        const badge = {
          L: resolveConditionTone(badgeToneInput(inL, true)), N: resolveConditionTone(badgeToneInput(inN, false)), F: resolveConditionTone(badgeToneInput(inF, false)),
        };

        // ── έλεγχος ντετερμινισμού ──
        const sB = B.scored.get(c.id).s;
        const pinB = resolveConditionTone(pinToneInput(B.items[c.idx], ctxB));
        controls.determinismPairsChecked += 1;
        if (pinB !== pin.N || sB.simpleWindSuitability?.suitabilityColor !== chip.N || JSON.stringify(sB) !== JSON.stringify(s)) {
          controls.determinismDiffs += 1;
          controlExample({ kind: 'determinism', grid: grid.name, regionId, beachId: c.id, row: rowLabel(row) });
        }

        if (isMolos) {
          // Μώλος: χωριστά, ΟΛΕΣ οι επιφάνειες του ανά παραλία (όχι στα σύνολα).
          const M = agg.molos;
          M.pairs += 1;
          let any = false;
          for (const [V, T] of [['N', M.now], ['F', M.full]]) {
            if (tallyDelta(T.pin, pin.L, pin[V], RANK, kd, verdict)) any = any || V === 'N';
            if (tallyDelta(T.chip, chip.L, chip[V], RANK, kd, verdict)) any = any || V === 'N';
            tallyDelta(T.tier, tier.L.tier, tier[V].tier, TRANK, kd, verdict);
            tallyDelta(T.seaIcon, icon.L, icon[V], RANK, kd, verdict);
            tallyDelta(T.mini, mini.L, mini[V], RANK, kd, verdict);
            tallyDelta(T.badge, badge.L, badge[V], RANK, kd, verdict);
            const pl = isCalmWaterPick(rd.L); const pv = isCalmWaterPick(rd[V]);
            if (!pl && pv) T.calmPick.added += 1;
            if (pl && !pv) T.calmPick.removed += 1;
          }
          if (any && M.scenarios.length < 12) {
            M.scenarios.push({ scenario: rowLabel(row), kd, toneKd, pin: `${pin.L} → ${pin.N} (full ${pin.F})`, chip: `${chip.L} → ${chip.N} (full ${chip.F})`, verdict, printedWaveM: printedWave(s, day).printed });
          }
          continue;
        }

        agg.pairs += 1;
        bump(agg.verdicts, verdict);
        bump(agg.kdBands, kdBand(kd));

        // ── έλεγχοι «ίδιο όπου πρέπει» ──
        const pinReadable = shoreSeaStateM(inN.seaStateM, inN.exposureLevel, inN.seaArrivalExposureLevel, undefined, toneKd)
          !== shoreSeaStateM(inN.seaStateM, inN.exposureLevel, inN.seaArrivalExposureLevel, undefined, undefined);
        if (pinReadable) agg.readable.pinByToneKd += 1;
        if (chipReadable) agg.readable.chipByToneKd += 1;
        if (!pinReadable && pin.L !== pin.N) { controls.pinNotReadableButChanged += 1; controlExample({ kind: 'pin-not-readable', grid: grid.name, regionId, beachId: c.id, row: rowLabel(row), pin, kd }); }
        if (!chipReadable && chip.L !== chip.N) controls.chipNotReadableButChanged += 1;
        if (!(typeof kd === 'number') || kd <= 0.5) {
          if (pin.L !== pin.N || chip.L !== chip.N || icon.L !== icon.N || tier.L.label !== tier.N.label
            || rd.L.shoreSeaStateM !== rd.N.shoreSeaStateM || isCalmWaterPick(rd.L) !== isCalmWaterPick(rd.N)) {
            controls.kdAtOrBelowHalfLegacyNeNow += 1;
            controlExample({ kind: 'kd<=0.5-legacy-ne-now', grid: grid.name, regionId, beachId: c.id, row: rowLabel(row), kd, pin, chip });
          }
        }
        if (typeof kd !== 'number' && (pin.L !== pin.F || chip.L !== chip.F || pin.L !== pin.N || chip.L !== chip.N)) controls.kdUndefinedAnyVariantDiffers += 1;
        if (mini.N !== pin.N) {
          controls.miniNowNeRegionPinNow += 1;
          controlExample({ kind: 'mini-now-ne-pin-now', grid: grid.name, regionId, beachId: c.id, row: rowLabel(row), mini: mini.N, pin: pin.N });
        }

        // ── μεταβάσεις ΠΡΙΝ→ΤΩΡΑ και ΠΡΙΝ→ΠΛΗΡΕΣ ──
        const arrivalKey = s.seaArrivalExposureLevel ?? 'undefined';
        const dirs = {};
        for (const [V, T] of [['N', agg.now], ['F', agg.full]]) {
          const dPin = tallyDelta(T.pin, pin.L, pin[V], RANK, kd, verdict);
          const dChip = tallyDelta(T.chip, chip.L, chip[V], RANK, kd, verdict);
          const dTier = tallyDelta(T.tier, tier.L.tier, tier[V].tier, TRANK, kd, verdict);
          if (tier.L.label !== tier[V].label) {
            T.tierLabel.changed += 1;
            if (tier.L.tier === tier[V].tier) T.tierLabel.sameTier += 1;
            bump(T.tierLabel.moves, `${tier.L.label} → ${tier[V].label}`);
          }
          const dIcon = tallyDelta(T.seaIcon, icon.L, icon[V], RANK, kd, verdict);
          if (reason.L !== reason[V]) T.reasonText.changed += 1;
          tallyDelta(T.mini, mini.L, mini[V], RANK, kd, verdict, arrivalKey);
          tallyDelta(T.badge, badge.L, badge[V], RANK, kd, verdict, arrivalKey);
          const pl = isCalmWaterPick(rd.L); const pv = isCalmWaterPick(rd[V]);
          if (!pl && pv) { T.calmPick.added += 1; bump(T.calmPick.addedByVerdict, verdict); }
          if (pl && !pv) T.calmPick.removed += 1;
          if (pin.L !== chip.L && pin[V] === chip[V]) T.pinChipFlow.enter += 1;
          if (pin.L === chip.L && pin[V] !== chip[V]) { T.pinChipFlow.leave += 1; bump(T.pinChipFlow.leaveMoves, `pin ${pin.L}→${pin[V]} / chip ${chip.L}→${chip[V]}`); }
          dirs[V] = { dPin, dChip, dTier, dIcon, calmGained: !pl && pv };
          if (V === 'F' && typeof kd === 'number') {
            for (const d of [dPin, dChip]) if ((kd < 0.5 && d < 0) || (kd > 0.5 && d > 0)) controls.fullDirectionViolations += 1;
          }
        }
        if (dirs.N.dPin > 0) controls.nowCalmerPin += 1;
        if (dirs.N.dChip > 0) controls.nowCalmerChip += 1;
        if (dirs.N.dTier > 0) controls.nowCalmerTier += 1;
        if (dirs.N.dIcon > 0) controls.nowCalmerSeaIcon += 1;
        if (dirs.N.calmGained) controls.nowCalmPickAdded += 1;

        // ── καταστάσεις ανά εκδοχή ──
        for (const V of VARIANTS) {
          const S = agg.state[V];
          if (pin[V] === chip[V]) S.pinEqChip += 1;
          if (verdict === 'avoid_swimming' && pin[V] === 'orange') S.orangePinOverAvoid += 1;
          if (verdict === 'avoid_swimming' && pin[V] === 'red') S.redPinOverAvoid += 1;
          if (verdict === 'avoid_swimming' && chip[V] === 'orange') S.orangeChipOverAvoid += 1;
          if (CALM.has(pin[V]) && WARY.has(verdict)) S.calmPinOverWary += 1;
          if (CALM.has(chip[V]) && WARY.has(verdict)) S.calmChipOverWary += 1;
          if (mini[V] !== pin[V]) S.miniNeRegionPin += 1;
          if (badge[V] !== pin[V]) S.badgeNeRegionPin += 1;
          if (isCalmWaterPick(rd[V])) S.calmWaterPicks += 1;
          bump(S.labels, tier[V].label);
        }

        // ── υποψήφια παραδείγματα: πιο άγριο ΠΡΙΝ→ΤΩΡΑ σε πινέζα ή τσιπ ──
        if ((dirs.N.dPin < 0 || dirs.N.dChip < 0) && agg.candidates.length < CAND_CAP) {
          agg.candidates.push({
            regionId, beachId: c.id, rowIndex, kd, toneKd, arrival: s.seaArrivalExposureLevel ?? null, verdict,
            pin: `${pin.L} → ${pin.N}`, pinFull: pin.F, chip: `${chip.L} → ${chip.N}`, chipFull: chip.F,
            tierWord: `${tier.L.label} → ${tier.N.label}`, waveIcon: `${icon.L} → ${icon.N}`,
            offerList: `${sets.L.offered.has(c.id) ? 'in' : 'out'} → ${sets.N.offered.has(c.id) ? 'in' : 'out'}`,
            calmWater: `${sets.L.calmOffered.has(c.id) ? 'offered' : '—'} → ${sets.N.calmOffered.has(c.id) ? 'offered' : '—'}`,
            miniMap: `${mini.L} → ${mini.N}`,
          });
        }
      }
      for (const c of listableCells) if (c.id !== MOLOS_ID) agg.listablePairs += 1;
    }
    process.stderr.write(`\r  [${grid.name}] ${rowIndex + 1}/${grid.rows.length} σενάρια · ${((Date.now() - tGrid) / 1000).toFixed(0)} s   `);
  });
  process.stderr.write('\n');
  agg.seconds = (Date.now() - tGrid) / 1000;
  return agg;
};

// ── Παραδείγματα: διαφορετικές παραλίες/περιοχές, με το τυπωμένο κύμα της σελίδας ──
const detailOf = (grid, c) => {
  const region = regionById.get(c.regionId);
  const beach = region.beaches.find((b) => b.id === c.beachId);
  const row = grid.rows[c.rowIndex];
  const day = dayFor(row);
  const { s } = scoreBeach(beach, day, region.profilesById[beach.id]);
  const pw = printedWave(s, day);
  const { rowIndex, ...rest } = c;
  return {
    grid: grid.name, beach: beach.name?.gr ?? beach.name?.en ?? String(beach.id), ...rest,
    scenario: rowLabel(row), pagePrintedWaveM: pw.printed, pageWaveText: pw.text, openSeaStateM: s.seaStateWaveM ?? null,
  };
};
const pickDiverse = (grid, list, n, usedBeaches, usedRegions) => {
  const weight = (c) => { const r = grid.rows[c.rowIndex]; return (c.chip.split(' → ')[0] !== c.chip.split(' → ')[1] ? 2 : 0) + (r.windKmh >= 20 && !r.regime.startsWith('opposite') ? 1 : 0); };
  const sorted = [...list].sort((a, b) => weight(b) - weight(a) || a.regionId.localeCompare(b.regionId) || a.beachId - b.beachId || a.rowIndex - b.rowIndex);
  const out = [];
  const seenMoves = new Set();
  for (const pass of [0, 1, 2]) {
    for (const c of sorted) {
      if (out.length >= n) break;
      if (usedBeaches.has(c.beachId)) continue;
      if (pass < 2 && usedRegions.has(c.regionId)) continue;
      const moveKey = `${c.pin}|${c.chip}`;
      if (pass === 0 && seenMoves.has(moveKey)) continue;
      usedBeaches.add(c.beachId); usedRegions.add(c.regionId); seenMoves.add(moveKey); out.push(c);
    }
  }
  return out;
};

// ── Εκτέλεση ─────────────────────────────────────────────────────────────────
const results = {};
for (const grid of GRIDS) results[grid.name] = runGrid(grid);

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(2)}%` : '—');
const fmtObj = (o) => Object.entries(o ?? {}).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—';
const deltaOut = (d) => ({ changed: d.changed, calmer: d.calmer, rougher: d.rougher, moves: d.moves,
  ...(d.calmer ? { calmerByKdBand: d.calmerByKdBand, calmerByVerdict: d.calmerByVerdict } : {}),
  rougherByKdBand: d.rougherByKdBand, rougherByVerdict: d.rougherByVerdict, ...(d.byArrival ? { byArrival: d.byArrival } : {}) });
const transOut = (T) => ({
  pin: deltaOut(T.pin), chipAndPageColour: deltaOut(T.chip), tierWord: { ...deltaOut(T.tier), labels: T.tierLabel },
  waveIcon: deltaOut(T.seaIcon), chipReasonTextChanged: T.reasonText.changed,
  calmWaterPickPerBeach: T.calmPick,
  offerList: T.offer, calmWaterOffer: T.calmOffer, pinEqualsPageFlow: T.pinChipFlow,
  pageMiniMap: deltaOut(T.mini), pinPanelBadge: deltaOut(T.badge),
});
// Μώλος: μόνο οι επιφάνειες ανά παραλία (στα σύνολα περιοχής είναι παγωμένος).
const molosOut = (T) => ({
  pin: T.pin.moves, chipAndPageColour: T.chip.moves, tierWord: T.tier.moves, waveIcon: T.seaIcon.moves,
  pageMiniMap: T.mini.moves, pinPanelBadge: T.badge.moves, calmWaterPick: { added: T.calmPick.added, removed: T.calmPick.removed },
});
// Συμπαγής αναφορά: βγαίνουν τα άδεια {} / [] (τα μηδενικά ΜΕΝΟΥΝ — το «calmer: 0» είναι το εύρημα).
const prune = (v) => {
  if (Array.isArray(v)) return v.map(prune);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const p = prune(x);
      if (p && typeof p === 'object' && Object.keys(p).length === 0) continue;
      out[k] = p;
    }
    return out;
  }
  return v;
};
const usedBeaches = new Set();
const usedRegions = new Set();
const EXAMPLES_PER_GRID = { main: 4, lightWind: 3, bigSea: 3 };
const grids = {};
const examples = [];
for (const grid of GRIDS) {
  const agg = results[grid.name];
  const N = agg.pairs;
  const st = (V) => ({ ...agg.state[V], pinEqChipShare: pct(agg.state[V].pinEqChip, N) });
  grids[grid.name] = {
    pairs: N, scenarios: grid.rows.length, screens: agg.screens, listablePairs: agg.listablePairs, seconds: Number(agg.seconds.toFixed(1)),
    kdBands: agg.kdBands, verdicts: agg.verdicts,
    toneKdReachesShoreNumber: { pin: agg.readable.pinByToneKd, chip: agg.readable.chipByToneKd },
    legacyToNow: transOut(agg.now),
    legacyToFull_reference: transOut(agg.full),
    state: { legacy: st('L'), now: st('N'), full_reference: st('F') },
    molos2040: { pairs: agg.molos.pairs, legacyToNow: molosOut(agg.molos.now), legacyToFull_reference: molosOut(agg.molos.full), scenariosWithPinOrChipChangeNow: agg.molos.scenarios },
  };
  for (const c of pickDiverse(grid, agg.candidates, EXAMPLES_PER_GRID[grid.name] ?? 3, usedBeaches, usedRegions)) examples.push(detailOf(grid, c));
}
const totalSeconds = (Date.now() - t0) / 1000;

// ── Εκτύπωση ─────────────────────────────────────────────────────────────────
console.log(`\nK_d χρώματος · ${regions.length} περιοχές · ${measuredBeaches} παραλίες με προφίλ (${regionBeachesTotal} στις περιοχές) · πλέγματα: ${GRIDS.map((g) => `${g.name} ${g.rows.length}`).join(', ')}`);
console.log(`πεδία από το App.tsx: ${APP_SCORE_FIELDS.filter(([k]) => /shoreShadow|seaArrival/.test(k)).map(([k, f]) => `${k}←${f}`).join(', ')} · μικρός χάρτης: ${PAGE_SCORE_FIELDS.filter(([k]) => /shoreShadow|seaArrival/.test(k)).map(([k, f]) => `${k}←${f}`).join(', ')}`);
for (const grid of GRIDS) {
  const g = grids[grid.name];
  const n = g.legacyToNow;
  const f = g.legacyToFull_reference;
  console.log(`\n══ ΠΛΕΓΜΑ ${grid.name} · ${g.pairs} ζεύγη (Μώλος εκτός) · ${g.seconds} s ══════════════════════════`);
  console.log(`  ζώνες K_d: ${fmtObj(g.kdBands)} · το K_d χρώματος αγγίζει τον αριθμό ακτής: πινέζα ${g.toneKdReachesShoreNumber.pin} · τσιπ ${g.toneKdReachesShoreNumber.chip}`);
  const line = (label, dn, df) => console.log(`  ${label.padEnd(26)} ΤΩΡΑ: ${String(dn.changed).padStart(6)} (ηρεμότερο ${dn.calmer} · αγριότερο ${dn.rougher})   ΠΛΗΡΕΣ: ${String(df.changed).padStart(6)} (ηρεμότερο ${df.calmer} · αγριότερο ${df.rougher})`);
  line('πινέζα', n.pin, f.pin);
  line('τσιπ = χρώμα σελίδας', n.chipAndPageColour, f.chipAndPageColour);
  line('λέξη βαθμίδας', n.tierWord, f.tierWord);
  line('εικονίδιο κύματος', n.waveIcon, f.waveIcon);
  line('μικρός χάρτης σελίδας', n.pageMiniMap, f.pageMiniMap);
  line('πάνελ πινέζας', n.pinPanelBadge, f.pinPanelBadge);
  console.log(`     πινέζα ΤΩΡΑ: ${fmtObj(n.pin.moves)} · τσιπ ΤΩΡΑ: ${fmtObj(n.chipAndPageColour.moves)}`);
  console.log(`     λέξη ΤΩΡΑ: ${fmtObj(n.tierWord.labels.moves)}`);
  console.log(`     λέξη ΠΛΗΡΕΣ: ${fmtObj(f.tierWord.labels.moves)}`);
  console.log(`     εικονίδιο ΤΩΡΑ: ${fmtObj(n.waveIcon.moves)} · ΠΛΗΡΕΣ: ${fmtObj(f.waveIcon.moves)}`);
  console.log(`  «Καταλληλότερες»: ΤΩΡΑ +${n.offerList.added} / −${n.offerList.removed} (προσθήκες: ${fmtObj(n.offerList.addedByCause)}) · ΠΛΗΡΕΣ +${f.offerList.added} / −${f.offerList.removed} · μέλη Π/Τ/Πλ ${g.state.legacy.offerMembers}/${g.state.now.offerMembers}/${g.state.full_reference.offerMembers}`);
  console.log(`  «Ήρεμο νερό» ανά παραλία: ΤΩΡΑ +${n.calmWaterPickPerBeach.added} / −${n.calmWaterPickPerBeach.removed} · ΠΛΗΡΕΣ +${f.calmWaterPickPerBeach.added} / −${f.calmWaterPickPerBeach.removed}`);
  console.log(`  «Ήρεμο νερό» προσφορά: ΤΩΡΑ +${n.calmWaterOffer.added} / −${n.calmWaterOffer.removed} (${fmtObj(n.calmWaterOffer.addedByCause)}) · ΠΛΗΡΕΣ +${f.calmWaterOffer.added} / −${f.calmWaterOffer.removed} · προσφερόμενες Π/Τ/Πλ ${g.state.legacy.calmWaterOffered}/${g.state.now.calmWaterOffered}/${g.state.full_reference.calmWaterOffered}`);
  console.log(`  πορτοκαλί πινέζα με avoid: ${g.state.legacy.orangePinOverAvoid} → ${g.state.now.orangePinOverAvoid} (ΠΛΗΡΕΣ ${g.state.full_reference.orangePinOverAvoid}) · πινέζα==σελίδα: ${g.state.legacy.pinEqChipShare} → ${g.state.now.pinEqChipShare} (ΠΛΗΡΕΣ ${g.state.full_reference.pinEqChipShare}; ΤΩΡΑ μπαίνουν ${n.pinEqualsPageFlow.enter} / βγαίνουν ${n.pinEqualsPageFlow.leave})`);
  for (const e of n.offerList.examples) console.log(`     «Καταλληλότερες» +${e.addedCount} στο ${e.regionId} (${e.window}) · ${e.scenario} · από ${e.triggeredBy.join(', ')}`);
  for (const e of n.calmWaterOffer.examples) console.log(`     «Ήρεμο νερό» +${e.addedCount} στο ${e.regionId} (${e.state}) · ${e.scenario} · από ${e.triggeredBy.join(', ')}`);
  console.log(`  μικρός χάρτης ≠ πινέζα περιοχής: ${g.state.legacy.miniNeRegionPin} → ${g.state.now.miniNeRegionPin} (ΠΛΗΡΕΣ ${g.state.full_reference.miniNeRegionPin}) · πάνελ ≠ πινέζα: ${g.state.legacy.badgeNeRegionPin} → ${g.state.now.badgeNeRegionPin}`);
  const m = g.molos2040;
  console.log(`  Μώλος #2040 (${m.pairs}): ΤΩΡΑ πινέζα ${fmtObj(m.legacyToNow.pin)} · τσιπ ${fmtObj(m.legacyToNow.chipAndPageColour)} · λέξη ${fmtObj(m.legacyToNow.tierWord)} · μικρός χάρτης ${fmtObj(m.legacyToNow.pageMiniMap)} · ΠΛΗΡΕΣ πινέζα ${fmtObj(m.legacyToFull_reference.pin)}`);
}
console.log('\n── ΠΑΡΑΔΕΙΓΜΑΤΑ (ΠΡΙΝ → ΤΩΡΑ, πιο άγριο) ──');
for (const e of examples) console.log(`  • [${e.grid}] ${e.beach} #${e.beachId} (${e.regionId}) · ${e.scenario} · K_d ${e.kd} · πινέζα ${e.pin} · τσιπ ${e.chip} · λέξη ${e.tierWord} · εικονίδιο ${e.waveIcon} · λίστα ${e.offerList} · ${e.verdict} «${e.pageWaveText ?? '—'}»`);
console.log('\n── ΕΛΕΓΧΟΙ (όλα 0) ─────────────────────────────────────────────────');
const { examples: ctrlExamples, pairs: ctrlPairs, determinismPairsChecked, ...ctrlCounts } = controls;
console.log(`  ζεύγη ${ctrlPairs} · ντετερμινισμός ${controls.determinismDiffs}/${determinismPairsChecked}`);
console.log(`  ${fmtObj(Object.fromEntries(Object.entries(ctrlCounts).filter(([k]) => k !== 'determinismDiffs'))) || 'όλα 0'}`);
console.log(`\nΧρόνος: ${totalSeconds.toFixed(1)} s`);

const failed = Object.entries(ctrlCounts).some(([, v]) => v > 0);

if (LIMIT_REGIONS || LIMIT_ROWS) {
  console.log('\n(δοκιμαστική εκτέλεση με όρια — η αναφορά ΔΕΝ γράφτηκε)');
} else {
  const reportPath = path.join(root, 'reports/quality/pin-shore-shadow-wiring.json');
  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(prune({
    generatedAt: new Date().toISOString(),
    script: 'scripts/measurePinShoreShadowWiring.mjs',
    runtimeSeconds: Number(totalSeconds.toFixed(1)),
    design: 'colour paths read utils/waveCharacter.colourShadowDamping(K_d) = max(K_d, 0.5) (score.toneShoreShadowDamping); verdict and printed shore number keep the full K_d',
    variants: {
      legacy: 'live before the change: map item without shoreShadowDamping; chip = real applySeaStateToWindSuitability with the first 9 recorded arguments (no K_d); mini-map and pin panel without sea arrival and K_d',
      now: 'production in the working tree: map-item / mini-map score fields read from the App.tsx / pages/BeachDetailPage.tsx syntax tree; chip = score colour',
      full_reference: 'the rejected design: the full score.shoreShadowDamping on every colour path (reference column only)',
    },
    scope: { regions: regions.length, beachesWithProfile: measuredBeaches, beachesInRegions: regionBeachesTotal, profiles: profileCount, profilesWithoutAppBeach, excluded: 'Molos #2040 (carries the committed witness change; reported per grid under molos2040 and frozen at legacy in region-level sets)' },
    gridDefinitions: {
      main: { waveDirectionsDeg: '0..345 step 15', hsM: HS_M, winds: ['wave side 20 km/h', 'wave side 35 km/h', 'opposite 20 km/h'] },
      lightWind: { waveDirectionsDeg: '0..345 step 15', hsM: HS_M, winds: ['wave side 8 km/h', 'wave side 15 km/h', 'opposite 15 km/h'] },
      bigSea: { waveDirectionsDeg: '0..345 step 15', hsM: BIG_HS_M, winds: ['wave side 35 km/h', 'wave side 45 km/h', 'opposite 20 km/h'] },
      weather: 'utils/weatherFixtures.createDailyForecast day 0; gust 1.35x; swell max(0.2, 0.35xHs) from the wave direction; no forecastUncertain; one wind/sea for the whole country',
    },
    mapObjectScoreFields: {
      app: APP_SCORE_FIELDS.filter(([k]) => /shoreShadow|seaArrival/.test(k)).map(([k, f]) => `${k}<-${f}`),
      pageMiniMap: PAGE_SCORE_FIELDS.filter(([k]) => /shoreShadow|seaArrival/.test(k)).map(([k, f]) => `${k}<-${f}`),
      appCopiesToneKd: fieldCopied(APP_SCORE_FIELDS, 'shoreShadowDamping', 'toneShoreShadowDamping'),
      pageCopiesToneKd: fieldCopied(PAGE_SCORE_FIELDS, 'shoreShadowDamping', 'toneShoreShadowDamping'),
      pageCopiesArrival: fieldCopied(PAGE_SCORE_FIELDS, 'seaArrivalExposureLevel', 'seaArrivalExposureLevel'),
    },
    surfaces: {
      pin: 'resolveConditionTone(components/BeachMap.tsx beachToneInput) over the App.tsx mapSuitableBeaches item; level from getConsistentVisibleMapExposureLevels as App.tsx canonicalMapExposureLevels',
      chipAndPageColour: 'score.simpleWindSuitability.suitabilityColor (card chip, page colour, TodayScoreBadge conditionTone)',
      tierWord: 'getExperienceTier + getExperienceTierLabel(gr) with the page hero TodayScoreBadge arguments (BeachDetailPage.tsx:2542-2562), conditionTone = chip',
      waveIcon: 'simpleWindSuitability.seaOnlyColor (resolveFactorTones of the chip toneInput)',
      offerList: 'App.tsx toneSuitableDirectorySource: selectSuitableByTone over directoryListabilityGate items (naturist, boat-only at >=5 Bft, avoid_swimming out) by pin colour; all region beaches, Molos frozen at legacy and not counted',
      calmWater: 'per beach isCalmWaterPick(describeConditionCause(pin input)); region offer resolveCalmWaterState over the same listable items (BeachMap.tsx:3688-3694)',
      pageMiniMap: 'pages/BeachDetailPage.tsx <BeachMap beaches={[{...}]}> item (fields from its syntax tree); legacy without seaArrivalExposureLevel + shoreShadowDamping',
      pinPanelBadge: 'BeachMap renderBeachInfo getExposureMarkerTone: pin arguments without windSpeedKmh/forecastUncertain; legacy without its seaArrival + K_d arguments',
      direction: 'calmer = towards blue (CALMNESS_ORDER) / towards excellent (tier); offer-list and calm-water additions are split by cause: the beach own colour/pick vs the window moving because another beach got rougher',
    },
    grids,
    examplesLegacyToNowRougher: examples,
    controls: { ...ctrlCounts, pairs: ctrlPairs, determinismPairsChecked, examples: ctrlExamples },
    notProven: [
      'whether K_d itself is right (judged by shore observation, not code)',
      'real weather: one synthetic wind/sea for the whole country, flat through the day, no cluster wind, no forecastUncertain; shares are shares of these pairs, not summer frequencies',
      'card tier word uses BeachCard inputs (not rebuilt); only the chip differs between variants, so its direction follows the page-hero measurement',
      'podium, legend counts, colour filter, hour slider, other days, and pins drawn from the two recommendationService list builders (same fields as the App item)',
    ],
  }), null, 1)}\n`);
  console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
}
if (failed) {
  console.error('ΑΠΟΤΥΧΙΑ ΕΛΕΓΧΟΥ — δες τα `controls`.');
  process.exit(1);
}
