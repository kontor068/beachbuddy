#!/usr/bin/env node
/**
 * Η ΕΚΠΤΩΣΗ-ΓΩΝΙΑ ΕΙΝΑΙ ΜΙΑ, ΦΡΑΓΜΕΝΗ, ΚΑΙ ΤΗ ΔΙΑΒΑΖΟΥΝ ΟΛΟΙ ΑΠΟ ΤΟ ΙΔΙΟ ΣΗΜΕΙΟ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Στις 24/08/2026 το επίπεδο ×0,5 της προστατευμένης ακτής έγινε γωνιακό K_d
 * (utils/seaArrival.resolveShoreShadowDamping — εκεί οι μετρήσεις, η απόφαση Μίλτου και τα
 * όρια). Πέντε αρχεία διαβάζουν πλέον τον συντελεστή (scoring, ταβάνι χρώματος, πόρτα 4 Μπφ,
 * αιτία χρώματος, πινέζα) — και η ιστορία αυτού του project λέει ότι όποτε δύο επιφάνειες
 * υπολογίζουν «πόσο κύμα φτάνει εδώ» χωριστά, αποκλίνουν (§Κ1, §Γ56). Η πύλη κλειδώνει:
 *
 *   Α. ΤΟ ΣΧΗΜΑ: διάδρομος (θ≤22,5°) → 1 (καμία έκπτωση)· άκρη σκιάς → 0,5· εκθετική
 *      απομείωση με βάθος· δάπεδο 0,10· κλειστός κύκλος → 0,10· μονότονο στο θ.
 *   Β. ΤΑ ΚΕΝΑ ΔΕΝ ΕΦΕΥΡΙΣΚΟΥΝ: χωρίς γεωμετρία ή κατεύθυνση → undefined → το ιστορικό 0,5.
 *   Γ. ΤΑ ΣΚΕΛΗ ΤΗΣ shoreSeaStateM: το K_d πιάνει το protected σκέλος ΚΑΙ το 'enclosed'
 *      (29/08/2026 — η τσέπη που η θάλασσα δεν έχει από πού να μπει, βλ. SEA_ARRIVAL_ENCLOSED
 *      στο utils/waveCharacter)· το grazing του §Γ59 κρατά το 0,5 του (μετρημένη μαρτυρία
 *      καμερών > μοντέλο)· partial/exposed χωρίς enclosed ανέγγιχτα· ζώνη [0,1] ώστε η ακτή
 *      να μην τυπωθεί ποτέ πιο άγρια από το πέλαγος έξω.
 *   Γ2. ΤΟ ΠΑΤΩΜΑ ΤΗΣ ΠΛΑΓΙΑΣ ΘΑΛΑΣΣΑΣ (29/08/2026): σε ακτή με πόρτα ≥10 χλμ, θάλασσα που
 *      δεν φεύγει καθαρά (onshore > −0,65) δεν εκπίπτει βαθύτερα από την άκρη (K_d ≥ 0,5)·
 *      θάλασσα που ΦΕΥΓΕΙ (≤ −0,65) κρατά τη βαθιά σκιά· η τσέπη και το προφίλ χωρίς
 *      facingDeg μένουν ως είχαν.
 *   Δ. ΟΙ ΕΞΙ ΑΡΙΘΜΟΙ (10 χλμ · 22,5° · 45° · 0,5 · 0,1 · −0,65) δεν μετακινούνται σιωπηλά.
 *   Ε. Η ΚΑΛΩΔΙΩΣΗ: το scoring υπολογίζει το K_d ΜΙΑ φορά, το περνάει και στις δύο κλήσεις
 *      της shoreSeaStateM, το κουβαλάει στο score, και πινέζα/ταβάνι/πόρτα/αιτία το περνάνε
 *      αυτούσιο — έλεγχος πάνω στον πηγαίο κώδικα, ώστε ένα refactor να μην αποσυνδέσει
 *      σιωπηλά μια επιφάνεια.
 *      Ε2 (11/09/2026): ΚΑΙ ΤΟ ΑΝΤΙΚΕΙΜΕΝΟ ΤΟ ΚΟΥΒΑΛΑΕΙ. Ως τότε το Ε έβλεπε μόνο ότι το
 *      components/BeachMap.tsx ΠΕΡΝΑΕΙ το item.shoreShadowDamping — όχι ότι το item το έχει. Τα
 *      αντικείμενα του χάρτη (App.tsx mapSuitableBeaches) δεν το αντέγραφαν και το τσιπ
 *      (applySeaStateToWindSuitability) δεν είχε καν όρισμα: πινέζα και τσιπ έμεναν στο ×0,5 ενώ
 *      η σελίδα έπαιρνε K_d (scripts/measurePinShoreShadowWiring.mjs). Διαβάζει το ΣΥΝΤΑΚΤΙΚΟ
 *      ΔΕΝΤΡΟ (typescript), όχι παράθυρα χαρακτήρων: κάθε αντικείμενο που αντιγράφει από score τη
 *      θάλασσα της σκάλας χρώματος (`seaStateWaveM`) μαζί με είσοδο που μόνο το χρώμα διαβάζει
 *      (`enclosedCove` ή το τσιπ `simpleWindSuitability`) πρέπει να αντιγράφει από ΤΟ ΙΔΙΟ score
 *      `shoreShadowDamping: <score>.toneShoreShadowDamping` και `seaArrivalExposureLevel`· το τσιπ
 *      παίρνει το `toneShoreShadowDamping`· η πινέζα, το ταμπελάκι του πάνελ ΚΑΙ το beachToneInput
 *      (λεζάντα, πίνακας χρωμάτων προς App, «Ήρεμο νερό») περνάνε το K_d στη σκάλα.
 *      ΤΟ K_d ΤΟΥ ΧΡΩΜΑΤΟΣ ΕΙΝΑΙ ΜΟΝΟΔΡΟΜΟ (ίδια μέρα): το πλήρες K_d στο χρώμα απορρίφθηκε από δύο
 *      ελεγκτές (σε θάλασσα ≥2,4 μ. η βαθιά σκιά 0,1 έκανε «Καλύτερα άλλη μέρα» → «Έχει κύμα σήμερα»
 *      πάνω από «μην κολυμπήσεις»). Το χρώμα διαβάζει utils/waveCharacter.colourShadowDamping =
 *      max(K_d, 0,5): ακολουθεί τη γεωμετρία μόνο προς το προσεκτικότερο.
 *   ΣΤ. ΤΟ ΧΡΩΜΑ ΤΟ ΚΑΤΑΝΑΛΩΝΕΙ ΑΛΗΘΙΝΑ: ίδια είσοδος, K_d 1 έναντι 0,1 → η πινέζα με
 *      K_d=1 ΔΕΝ επιτρέπεται να βγει πιο ήρεμη από την πινέζα με K_d=0,1.
 *   Ζ. ΤΟ ΙΔΙΟ ΜΕ ΚΛΗΣΗ, ΣΕ ΟΛΗ ΤΗ ΧΩΡΑ (11/09/2026): 110 περιοχές × κάθε παραλία με προφίλ ×
 *      24 συνθετικά σενάρια (εκεί που το K_d αλλάζει χρώμα: αντίθετος άνεμος, θάλασσα 2,5 μ.,
 *      ελαφρύς άνεμος). Πραγματικό calculateBeachScore· αντικείμενο χάρτη με τα πεδία που ΠΡΑΓΜΑΤΙΚΑ
 *      αντιγράφει σήμερα το App.tsx (διαβασμένα από το δέντρο του, όχι αντιγραμμένα εδώ)· μικρός
 *      χάρτης με τα πεδία που αντιγράφει το pages/BeachDetailPage.tsx. Απαιτεί 0 διαφορές σε:
 *      Ζ1 πινέζα == πινέζα με το K_d χρώματος του score · Ζ1β ΠΟΤΕ πιο ήρεμη πινέζα/τσιπ από το
 *      ιστορικό ×0,5 (K_d undefined) · Ζ2 τσιπ (= χρώμα σελίδας) πήρε το K_d χρώματος του score ·
 *      Ζ3 μικρός χάρτης σελίδας == πινέζα περιοχής · Ζ4 όπου πινέζα και σελίδα κοιτάζουν την ΙΔΙΑ
 *      ακτή με τα ΙΔΙΑ δεδομένα, ίδιο K_d και ίδιο χρώμα. Και ότι το δείγμα ΒΛΕΠΕΙ ένα χαμένο K_d
 *      (αλλιώς η πύλη θα περνούσε στα τυφλά).
 *      ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ: αν το K_d είναι σωστό· αληθινή μέρα (ένας συνθετικός καιρός για όλη τη
 *      χώρα, χωρίς τοπικό άνεμο cluster και χωρίς forecastUncertain)· τη μπάρα ώρας· τον browser.
 *      Η συνολική συμφωνία πινέζας-σελίδας ΔΕΝ είναι 100% — το ~1,6% που μένει δεν είναι K_d (το
 *      επίπεδο έκθεσης της πινέζας βγαίνει από το πέρασμα γειτονιάς του χάρτη, το τσιπ από το
 *      exposureStatus της βαθμολογίας)· τυπώνεται, δεν κρίνεται εδώ.
 *
 *   node scripts/validateShoreShadowContract.mjs
 */
import fs from 'node:fs';
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
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const {
  resolveShoreShadowDamping, JUDGE_WITNESSED_ARRIVAL_BEACH_IDS, JUDGE_WITNESSED_ARRIVAL_ARCS, resolveSeaArrivalExposureLevel,
  SHADOW_OPEN_FETCH_KM, SHADOW_CORRIDOR_HALF_DEG, SHADOW_DECAY_DEG, SHADOW_KD_AT_EDGE, SHADOW_KD_FLOOR,
  SHADOW_CROSS_SEA_ONSHORE_MIN,
} = require(path.join(root, 'utils/seaArrival.ts'));
const { shoreSeaStateM, SEA_ARRIVAL_GRAZING, SEA_ARRIVAL_ENCLOSED } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

/** Προφίλ με ΕΝΑΝ ανοιχτό διάδρομο στον Ν (180°), όλα τα άλλα κλειστά. ΧΩΡΙΣ facingDeg,
 *  επίτηδες: έτσι το πάτωμα της πλάγιας θάλασσας (Γ2) μένει κλειστό και το Α ελέγχει το
 *  γυμνό σχήμα της σκιάς, όπως από τις 24/08. Το Γ2 έχει δικό του προφίλ ΜΕ facingDeg. */
const oneCorridor = { sectors: { N: { fetchKm: 0 }, NE: { fetchKm: 0 }, E: { fetchKm: 2 }, SE: { fetchKm: 0 },
  S: { fetchKm: 40 }, SW: { fetchKm: 3 }, W: { fetchKm: 0 }, NW: { fetchKm: 0 } } };
const noCorridor = { sectors: { N: { fetchKm: 2 }, NE: { fetchKm: 0 }, E: { fetchKm: 1 }, SE: { fetchKm: 0 },
  S: { fetchKm: 4 }, SW: { fetchKm: 3 }, W: { fetchKm: 0 }, NW: { fetchKm: 0 } } };

// ── Α. το σχήμα ─────────────────────────────────────────────────────────────
{
  const inCorridor = resolveShoreShadowDamping(oneCorridor, 180);
  if (inCorridor !== 1) fail('Α', `κύμα ΜΕΣΑ στον διάδρομο → ${inCorridor}, περίμενα 1 (καμία έκπτωση)`);
  const atEdgeIsh = resolveShoreShadowDamping(oneCorridor, 180 + SHADOW_CORRIDOR_HALF_DEG + 0.01);
  if (!(atEdgeIsh <= SHADOW_KD_AT_EDGE && atEdgeIsh > SHADOW_KD_AT_EDGE - 0.02)) {
    fail('Α', `μόλις έξω από την άκρη → ${atEdgeIsh}, περίμενα ≈${SHADOW_KD_AT_EDGE}`);
  }
  const opposite = resolveShoreShadowDamping(oneCorridor, 0);
  if (opposite !== SHADOW_KD_FLOOR) fail('Α', `κύμα από την αντίθετη μεριά (θ≈157°) → ${opposite}, περίμενα το δάπεδο ${SHADOW_KD_FLOOR}`);
  const closed = resolveShoreShadowDamping(noCorridor, 90);
  if (closed !== SHADOW_KD_FLOOR) fail('Α', `κλειστός κύκλος → ${closed}, περίμενα ${SHADOW_KD_FLOOR}`);
  // μονοτονία: όσο πιο βαθιά στη σκιά, τόσο μικρότερο K_d — ποτέ ανάποδα
  let prev = 1.01;
  for (let step = 0; step <= 160; step += 5) {
    const kd = resolveShoreShadowDamping(oneCorridor, 180 + step);
    if (kd > prev + 1e-9) { fail('Α', `μη μονότονο στο θ=${step}° (${kd} > ${prev})`); break; }
    prev = kd;
  }
  for (let step = 0; step <= 180; step += 3) {
    const kd = resolveShoreShadowDamping(oneCorridor, 180 - step);
    if (!(kd >= SHADOW_KD_FLOOR - 1e-9 && kd <= 1)) { fail('Α', `εκτός [${SHADOW_KD_FLOOR},1] στο θ=−${step}°: ${kd}`); break; }
  }
}
console.log(`Α. το σχήμα της σκιάς ........................ ${failures.length ? '❌' : '✅'}`);

// ── Β. τα κενά ──────────────────────────────────────────────────────────────
const beforeB = failures.length;
for (const [profile, deg, why] of [
  [undefined, 90, 'χωρίς προφίλ'],
  [{}, 90, 'χωρίς τομείς'],
  [oneCorridor, undefined, 'χωρίς κατεύθυνση'],
  [oneCorridor, Number.NaN, 'κατεύθυνση NaN'],
]) {
  const got = resolveShoreShadowDamping(profile, deg);
  if (got !== undefined) fail('Β', `${why} → ${got}, περίμενα undefined (πτώση στο ιστορικό 0,5)`);
}
console.log(`Β. η άγνοια δεν εφευρίσκει ................... ${failures.length > beforeB ? '❌' : '✅'}`);

// ── Γ. τα σκέλη της shoreSeaStateM ──────────────────────────────────────────
const beforeC = failures.length;
{
  const H = 2.0;
  if (shoreSeaStateM(H, 'protected', undefined, undefined, 0.1) !== 0.2) fail('Γ', 'protected+K_d 0,1 δεν έδωσε 0,2');
  if (shoreSeaStateM(H, 'protected', undefined, undefined, 1) !== 2.0) fail('Γ', 'protected+K_d 1 δεν έδωσε το πλήρες ύψος');
  if (shoreSeaStateM(H, 'protected', undefined, undefined, undefined) !== 1.0) fail('Γ', 'χωρίς K_d δεν έπεσε στο ιστορικό 0,5');
  if (shoreSeaStateM(H, 'protected', undefined, undefined, 1.7) !== 2.0) fail('Γ', 'K_d 1,7 δεν φράχτηκε στο 1 — η ακτή βγήκε πιο άγρια από το πέλαγος');
  if (shoreSeaStateM(H, 'protected', undefined, undefined, Number.NaN) !== 1.0) fail('Γ', 'K_d NaN δεν έπεσε στο 0,5');
  // το grazing σκέλος του §Γ59 ΔΕΝ ακούει το K_d — μαρτυρία καμερών > μοντέλο
  if (shoreSeaStateM(H, 'partial', SEA_ARRIVAL_GRAZING, undefined, 0.1) !== 1.0) fail('Γ', 'το grazing σκέλος άκουσε το K_d — έπρεπε να μείνει στο 0,5');
  if (shoreSeaStateM(H, 'partial', SEA_ARRIVAL_GRAZING, undefined, 1) !== 1.0) fail('Γ', 'το grazing σκέλος άκουσε K_d=1 — έπρεπε να μείνει στο 0,5');
  if (shoreSeaStateM(H, 'partial', undefined, undefined, 0.1) !== 2.0) fail('Γ', 'partial χωρίς grazing πήρε έκπτωση');
  if (shoreSeaStateM(H, 'exposed', undefined, undefined, 0.1) !== 2.0) fail('Γ', 'exposed πήρε έκπτωση');
  // η ΠΥΛΗ δεν αλλάζει: curated-wind-only και ρητό partial arrival αρνούνται όπως πριν
  if (shoreSeaStateM(H, 'protected', 'partial', undefined, 0.1) !== 2.0) fail('Γ', 'ρητό partial arrival δεν αρνήθηκε την έκπτωση');
  if (shoreSeaStateM(H, 'protected', undefined, true, 0.1) !== 2.0) fail('Γ', 'curated wind-only δεν αρνήθηκε την έκπτωση');
}
console.log(`Γ. K_d στο protected σκέλος + enclosed, φραγμένο ${failures.length > beforeC ? '❌' : '✅'}`);

// ── Δ. οι μάρτυρες του κριτή δεν πέφτουν ποτέ σε «βαθιά σκιά» (10/09/2026) ───
// Κέδρος #2189, Βίντζι #1696: εκεί K_d ≥ 0,5 σε ΚΑΘΕ διεύθυνση (απόφαση Μίλτου 10/09), ώσπου να
// κριθούν από τον κριτή στην άμμο. Η πύλη διαβάζει τα ΠΡΑΓΜΑΤΙΚΑ προφίλ, και αποδεικνύει ότι η
// εξαίρεση δεν διαρρέει σε άλλη παραλία (το ίδιο προφίλ με άλλον αριθμό ξαναπέφτει στη βαθιά σκιά).
// Μουτσούνα #2009 / Φράγκου #1428 ΒΓΗΚΑΝ το ίδιο βράδυ (βίβλος §Γ75): ο «κριτής» τους ήταν μοντέλα
// κελιού 4 χλμ., και το Sentinel-2 έδειξε ότι με βοριά εκεί δεν σκάει κύμα — καρφώνονται ΕΚΤΟΣ.
const beforeWitness = failures.length;
{
  const dir = path.join(root, 'public/data/geospatial/exposure');
  const byId = new Map();
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    let d; try { d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
    const list = Array.isArray(d) ? d : Array.isArray(d?.profiles) ? d.profiles : (d?.profiles ? Object.values(d.profiles) : []);
    for (const p of list) {
      if (JUDGE_WITNESSED_ARRIVAL_BEACH_IDS.has(p?.beachId) || JUDGE_WITNESSED_ARRIVAL_ARCS.has(p?.beachId)) byId.set(p.beachId, p);
    }
  }
  // Οι μάρτυρες καρφώνονται ονομαστικά, αλλιώς η αφαίρεση ενός από τον κώδικα θα περνούσε σιωπηλά
  // (η πύλη θα έλεγχε μόνο όσους έμειναν). Βγαίνουν ΜΟΝΟ με κριτή στην άμμο ΚΑΙ απόφαση Μίλτου.
  for (const pinned of [2189, 1696]) {
    if (!JUDGE_WITNESSED_ARRIVAL_BEACH_IDS.has(pinned)) fail('Δ0', `ο μάρτυρας #${pinned} αφαιρέθηκε από τη λίστα — θέλει κριτή στην άμμο ΚΑΙ απόφαση Μίλτου, όχι σιωπηλή διαγραφή`);
  }
  // …και ΟΣΟΙ ΚΡΙΘΗΚΑΝ ΣΤΗΝ ΑΜΜΟ ΣΕ ΣΚΙΑ δεν ξαναμπαίνουν με μοντέλα κελιού (reports/wave-model/
  // shore-surf-arrival-summary.json, 10/09): ένα νέο «δύο μοντέλα συμφωνούν» δεν αρκεί να τους ξαναβάλει.
  for (const shadowSeen of [2009, 1428, 2191, 1284, 1668]) {
    if (JUDGE_WITNESSED_ARRIVAL_BEACH_IDS.has(shadowSeen) || JUDGE_WITNESSED_ARRIVAL_ARCS.has(shadowSeen)) fail('Δ0', `#${shadowSeen} μπήκε ξανά στους μάρτυρες — ο κριτής στην άμμο (Sentinel-2) την έδειξε σε αληθινή σκιά (βίβλος §Γ75)· θέλει νέα παρατήρηση ΣΤΗΝ ΑΚΤΗ, όχι μοντέλο κελιού`);
  }

  // ── Δ0β. ΜΑΡΤΥΡΕΣ ΣΕ ΤΟΞΟ (11/09/2026, βίβλος §Γ77) ──────────────────────────────────────────────
  // Μώλος Πάρου #2040: K_d ≥ 0,5 ΜΟΝΟ για κύμα 0-30° (τρύπα της «τσέπης» στις 11-25°, αφρός Sentinel-2
  // στις 16° και 18° με υπογραφή αφρού SWIR). Καρφώνεται ΜΕ ΤΙΜΗ: νέο ή φαρδύτερο τόξο θέλει παρατήρηση
  // στην ακτή ΚΑΙ απόφαση Μίλτου ΚΑΙ ορατή αλλαγή εδώ. Αποδεικνύεται ότι (α) το πάτωμα κρατά μέσα στο τόξο,
  // (β) ΔΕΝ διαρρέει έξω (Ν-ΒΔ πίσω από την Πάρο μένει στη βαθιά σκιά), (γ) ο αριθμός που τυπώνεται στις
  // μαρτυρημένες διευθύνσεις ανεβαίνει πραγματικά, (δ) όλη η τρύπα της τσέπης γύρω από τις μαρτυρίες
  // πέφτει μέσα στο τόξο — αν ένα ξαναχτίσιμο της γεωμετρίας τη φαρδύνει, η πύλη σκάει αντί να μείνει μισοδιορθωμένη.
  const PINNED_ARCS = new Map([[2040, { centerDeg: 15, halfWidthDeg: 15, witnessedDeg: [16, 18] }]]);
  // το «υπάρχει θάλασσα» της μαρτυρίας = το «υπάρχει θάλασσα» της εκτίμησης ακτής (ένα δάπεδο θορύβου)
  {
    const { WITNESSED_SEA_MIN_COMPONENT_M } = require(path.join(root, 'utils/seaArrival.ts'));
    const { DEPARTING_SEA_MIN_COMPONENT_M } = require(path.join(root, 'utils/shoreWave.ts'));
    if (WITNESSED_SEA_MIN_COMPONENT_M !== DEPARTING_SEA_MIN_COMPONENT_M) {
      fail('Δ0β', `δάπεδο μαρτυρημένης θάλασσας ${WITNESSED_SEA_MIN_COMPONENT_M} ≠ DEPARTING_SEA_MIN_COMPONENT_M ${DEPARTING_SEA_MIN_COMPONENT_M} — δύο κανόνες «μπαίνει/φεύγει» με άλλο κατώφλι`);
    }
  }
  const SECTORS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const sectorLevelAt = (p, deg) => p?.sectors?.[SECTORS8[Math.round((((deg % 360) + 360) % 360) / 45) % 8]]?.level;
  const printedFraction = (p, deg, kd) => shoreSeaStateM(1, sectorLevelAt(p, deg), resolveSeaArrivalExposureLevel(p, deg), false, kd);
  const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
  for (const [id, pin] of PINNED_ARCS) {
    const arc = JUDGE_WITNESSED_ARRIVAL_ARCS.get(id);
    if (!arc) { fail('Δ0β', `το τόξο του #${id} αφαιρέθηκε — θέλει κριτή στην άμμο ΚΑΙ απόφαση Μίλτου, όχι σιωπηλή διαγραφή`); continue; }
    if (arc.centerDeg !== pin.centerDeg || arc.halfWidthDeg !== pin.halfWidthDeg) {
      fail('Δ0β', `το τόξο του #${id} άλλαξε (${arc.centerDeg}±${arc.halfWidthDeg}° αντί ${pin.centerDeg}±${pin.halfWidthDeg}°) — φαρδύτερο τόξο θέλει νέα παρατήρηση στην ακτή`);
    }
  }
  for (const id of JUDGE_WITNESSED_ARRIVAL_ARCS.keys()) {
    if (!PINNED_ARCS.has(id)) fail('Δ0β', `νέο τόξο μάρτυρα #${id} χωρίς να καρφωθεί εδώ — θέλει παρατήρηση στην ακτή, απόφαση Μίλτου και ορατή αλλαγή της πύλης`);
    if (JUDGE_WITNESSED_ARRIVAL_BEACH_IDS.has(id)) fail('Δ0β', `#${id} είναι ΚΑΙ στη λίστα όλων των διευθύνσεων — σιωπηλή αναβάθμιση του τόξου σε 360°`);
  }
  for (const [id, pin] of PINNED_ARCS) {
    const arc = JUDGE_WITNESSED_ARRIVAL_ARCS.get(id);
    const p = byId.get(id);
    if (!arc || !p) { if (arc) fail('Δ0β', `ο μάρτυρας τόξου #${id} δεν βρέθηκε στα προφίλ`); continue; }
    let deepInside = false, deepOutside = false;
    for (let deg = 0; deg < 360; deg += 1) {
      const kd = resolveShoreShadowDamping(p, deg);
      const stranger = resolveShoreShadowDamping({ ...p, beachId: -1 }, deg);
      const inside = angDist(deg, arc.centerDeg) <= arc.halfWidthDeg;
      if (inside) {
        if (!(kd >= SHADOW_KD_AT_EDGE - 1e-9)) fail('Δ0β', `#${id} στις ${deg}° (μέσα στο τόξο) → K_d ${kd}, κάτω από την άκρη ${SHADOW_KD_AT_EDGE}`);
        if (stranger < SHADOW_KD_AT_EDGE - 1e-9) deepInside = true;
      } else {
        if (kd !== stranger) fail('Δ0β', `#${id} στις ${deg}° (ΕΞΩ από το τόξο) → K_d ${kd} ≠ γεωμετρία ${stranger} — η εξαίρεση διαρρέει`);
        if (stranger < SHADOW_KD_AT_EDGE - 1e-9) deepOutside = true;
      }
    }
    if (!deepInside) fail('Δ0β', `#${id}: μέσα στο τόξο δεν υπάρχει βαθιά σκιά χωρίς την εξαίρεση — το πάτωμα δεν ασκεί τίποτα`);
    if (!deepOutside) fail('Δ0β', `#${id}: έξω από το τόξο δεν υπάρχει βαθιά σκιά — ο έλεγχος «δεν διαρρέει» δεν αποδεικνύει τίποτα`);
    for (const deg of pin.witnessedDeg) {
      const printed = printedFraction(p, deg, resolveShoreShadowDamping(p, deg));
      if (!(printed >= SHADOW_KD_AT_EDGE - 1e-9)) fail('Δ0β', `#${id} στις ${deg}° (εκεί που ο δορυφόρος είδε αφρό) τυπώνει ${printed} του ανοιχτού — έπρεπε ≥ ${SHADOW_KD_AT_EDGE}`);
      // ολόκληρη η τρύπα της τσέπης γύρω από τη μαρτυρία πέφτει μέσα στο τόξο
      for (const stepDir of [-1, 1]) {
        for (let k = 0, d = deg; k < 180; k += 1, d = (d + stepDir + 360) % 360) {
          if (resolveSeaArrivalExposureLevel(p, d) !== SEA_ARRIVAL_ENCLOSED) break;
          if (angDist(d, arc.centerDeg) > arc.halfWidthDeg) { fail('Δ0β', `#${id}: η τρύπα της τσέπης φτάνει στις ${d}°, έξω από το τόξο — μισοδιορθωμένη`); break; }
        }
      }
    }
    for (const deg of [150, 180, 270, 330]) {
      const mine = printedFraction(p, deg, resolveShoreShadowDamping(p, deg));
      const theirs = printedFraction(p, deg, resolveShoreShadowDamping({ ...p, beachId: -1 }, deg));
      if (mine !== theirs) fail('Δ0β', `#${id} στις ${deg}° (πίσω από το νησί) τυπώνει ${mine} αντί ${theirs} — η εξαίρεση άγγιξε διεύθυνση χωρίς μαρτυρία`);
    }
  }
  for (const id of JUDGE_WITNESSED_ARRIVAL_BEACH_IDS) {
    const p = byId.get(id);
    if (!p) { fail('Δ0', `ο μάρτυρας #${id} δεν βρέθηκε στα προφίλ — η εξαίρεση δεν προστατεύει τίποτα`); continue; }
    let sawDeepShadowWithoutIt = false;
    for (let deg = 0; deg < 360; deg += 5) {
      const kd = resolveShoreShadowDamping(p, deg);
      if (typeof kd === 'number' && kd < SHADOW_KD_AT_EDGE - 1e-9) fail('Δ0', `#${id} στις ${deg}° → K_d ${kd}, κάτω από την άκρη ${SHADOW_KD_AT_EDGE}`);
      const asStranger = resolveShoreShadowDamping({ ...p, beachId: -1 }, deg);
      if (typeof asStranger === 'number' && asStranger < SHADOW_KD_AT_EDGE - 1e-9) sawDeepShadowWithoutIt = true;
    }
    if (!sawDeepShadowWithoutIt) fail('Δ0', `#${id}: χωρίς την εξαίρεση δεν υπάρχει βαθιά σκιά πουθενά — ο έλεγχος δεν ασκεί τίποτα`);
  }
}
console.log(`Δ0. μάρτυρες κριτή: K_d ≥ 0,5 (Κέδρος/Βίντζι παντού · Μώλος μόνο 0-30°, καμία διαρροή) ... ${failures.length > beforeWitness ? '❌' : '✅'}`);

// ── Γ2. το πάτωμα της πλάγιας θάλασσας και το 'enclosed' (29/08/2026) ───────
const beforeC2 = failures.length;
{
  // Ίδιος διάδρομος με το Α, αλλά με facingDeg — η ακτή κοιτάει τον διάδρομό της (180°).
  const facingCorridor = { ...oneCorridor, facingDeg: 180 };
  // Θάλασσα από 300°: θ=120° από τον διάδρομο (βαθιά σκιά χθες), onshore cos(120°)=−0,5 > −0,65
  // → ΠΛΑΓΙΑ σε ανοιχτή ακτή → πατώνει στην άκρη.
  const crossSea = resolveShoreShadowDamping(facingCorridor, 300);
  if (crossSea !== SHADOW_KD_AT_EDGE) fail('Γ2', `πλάγια θάλασσα σε ανοιχτή ακτή → ${crossSea}, περίμενα το πάτωμα ${SHADOW_KD_AT_EDGE}`);
  // Θάλασσα από 0°: onshore cos(180°)=−1 ≤ −0,65 → ΦΕΥΓΕΙ → η βαθιά σκιά μένει (η Πρέβελη).
  const departing = resolveShoreShadowDamping(facingCorridor, 0);
  if (departing !== SHADOW_KD_FLOOR) fail('Γ2', `θάλασσα που φεύγει → ${departing}, η βαθιά σκιά ${SHADOW_KD_FLOOR} έπρεπε να μείνει`);
  // Μέσα στον διάδρομο τίποτα δεν άλλαξε.
  if (resolveShoreShadowDamping(facingCorridor, 180) !== 1) fail('Γ2', 'ο διάδρομος έπαψε να δίνει 1');
  // Η τσέπη ΔΕΝ πατώνεται — η δική της βαθιά σκιά είναι το σωστό νούμερο (Λίνδος).
  const pocket = resolveShoreShadowDamping({ ...noCorridor, facingDeg: 90 }, 90);
  if (pocket !== SHADOW_KD_FLOOR) fail('Γ2', `τσέπη με θάλασσα κατάμουτρα → ${pocket}, περίμενα ${SHADOW_KD_FLOOR} — το πάτωμα δεν αφορά τσέπες`);
  // Χωρίς facingDeg: ό,τι και στις 24/08 (το Α από πάνω το ελέγχει ήδη· εδώ ρητά).
  const blind = resolveShoreShadowDamping(oneCorridor, 300);
  if (!(blind >= SHADOW_KD_FLOOR && blind < SHADOW_KD_AT_EDGE)) fail('Γ2', `χωρίς facingDeg → ${blind}, έπρεπε να μείνει στη χθεσινή βαθιά σκιά`);

  // Το 'enclosed' στη shoreSeaStateM: η έκπτωση δίνεται ό,τι κι αν λέει ο τομέας του ανέμου
  // και το curated flag — η προστασία εδώ μετρήθηκε απέναντι στο ΚΥΜΑ.
  const H = 2.0;
  if (shoreSeaStateM(H, 'partial', SEA_ARRIVAL_ENCLOSED, undefined, 0.1) !== 0.2) fail('Γ2', 'enclosed σε partial δεν πήρε το K_d');
  if (shoreSeaStateM(H, 'exposed', SEA_ARRIVAL_ENCLOSED, undefined, 0.1) !== 0.2) fail('Γ2', 'enclosed σε exposed δεν πήρε το K_d');
  if (shoreSeaStateM(H, 'partial', SEA_ARRIVAL_ENCLOSED, true, 0.1) !== 0.2) fail('Γ2', 'το curated flag μπλόκαρε το enclosed — δεν έπρεπε (γεωμετρία απέναντι στο κύμα)');
  if (shoreSeaStateM(H, 'partial', SEA_ARRIVAL_ENCLOSED, undefined, undefined) !== 1.0) fail('Γ2', 'enclosed χωρίς K_d δεν έπεσε στο ιστορικό 0,5');
  if (shoreSeaStateM(H, 'partial', SEA_ARRIVAL_ENCLOSED, undefined, 1.7) !== 2.0) fail('Γ2', 'enclosed με K_d 1,7 δεν φράχτηκε στο 1');
}
console.log(`Γ2. πάτωμα πλάγιας θάλασσας + enclosed ....... ${failures.length > beforeC2 ? '❌' : '✅'}`);

// ── Δ. οι πέντε αριθμοί ─────────────────────────────────────────────────────
const beforeD = failures.length;
const DECIDED = { SHADOW_OPEN_FETCH_KM: 10, SHADOW_CORRIDOR_HALF_DEG: 22.5, SHADOW_DECAY_DEG: 45, SHADOW_KD_AT_EDGE: 0.5, SHADOW_KD_FLOOR: 0.1, SHADOW_CROSS_SEA_ONSHORE_MIN: -0.65 };
for (const [name, want] of Object.entries(DECIDED)) {
  const got = { SHADOW_OPEN_FETCH_KM, SHADOW_CORRIDOR_HALF_DEG, SHADOW_DECAY_DEG, SHADOW_KD_AT_EDGE, SHADOW_KD_FLOOR, SHADOW_CROSS_SEA_ONSHORE_MIN }[name];
  if (got !== want) fail('Δ', `${name} ${got} ≠ ${want} — μετρήθηκε και μπήκε με απόφαση (24/08 τα πέντε, 29/08 το −0,65: διαχωρίζει τους μάρτυρες των καμερών, βλ. utils/seaArrival)· νέα τιμή = νέα μέτρηση + νέα απόφαση`);
}
console.log(`Δ. οι έξι αριθμοί στη θέση τους .............. ${failures.length > beforeD ? '❌' : '✅'}`);

// ── Ε. η καλωδίωση, πάνω στον πηγαίο κώδικα ─────────────────────────────────
const beforeE = failures.length;
const mustContain = [
  ['services/recommendationService.ts', 'resolveShoreShadowDamping(options?.geospatialProfile, marine?.waveDirectionDeg)', 'το scoring δεν υπολογίζει πια το K_d'],
  ['services/recommendationService.ts', 'windAssessment.protectionFromCuratedCoveOnly, shoreShadowDamping);', 'η κύρια κλήση της shoreSeaStateM έχασε το K_d'],
  ['utils/suitabilityTone.ts', 'curatedWindOnlyProtection, shoreShadowDamping));', 'το ταβάνι χρώματος έχασε το K_d'],
  ['utils/suitabilityTone.ts', 'curatedWindOnlyProtection, shoreShadowDamping);', 'το atShoreM (δάπεδο ΙΔΑΝΙΚΗ/πόρτα 4 Μπφ) έχασε το K_d'],
  ['utils/offshoreFlatWater.ts', 'curatedWindOnlyProtection, shoreShadowDamping);', 'η πόρτα των 4 Μπφ έχασε το K_d'],
  ['utils/conditionCause.ts', 'input.curatedWindOnlyProtection, input.shoreShadowDamping)', 'η αιτία χρώματος έχασε το K_d'],
  ['components/BeachMap.tsx', 'shoreShadowDamping: item.shoreShadowDamping', 'η πινέζα έχασε το K_d του score'],
  ['services/recommendationService.ts', 'const toneShoreShadowDamping = colourShadowDamping(shoreShadowDamping);', 'το K_d του χρώματος δεν βγαίνει πια από το colourShadowDamping (μόνο προς το προσεκτικότερο)'],
  // Η πόρτα των 4 Μπφ του τσιπ τροφοδοτεί ΜΟΝΟ χρώμα: K_d χρώματος, όπως η πόρτα της πινέζας. Με το πλήρες
  // δεν φαίνεται σήμερα (η σκάλα την ξαναελέγχει), γι' αυτό φυλάγεται στον κώδικα και όχι στο χρώμα.
  ['services/recommendationService.ts', 'shoreShadowDamping: toneShoreShadowDamping,', 'η πόρτα των 4 Μπφ του τσιπ ξαναπήρε το πλήρες K_d αντί για του χρώματος'],
];
for (const [file, needle, why] of mustContain) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const count = source.split(needle).length - 1;
  if (count === 0) fail('Ε', `${file}: ${why} (λείπει «${needle}»)`);
}
{
  const source = fs.readFileSync(path.join(root, 'services/recommendationService.ts'), 'utf8');
  const calls = source.split('shoreShadowDamping);').length - 1;
  if (calls < 2) fail('Ε', `το scoring περνάει το K_d σε ${calls} κλήσεις shoreSeaStateM — περίμενα και τις 2 (κύρια + μάρτυρας §Γ59)`);
}

// ── Ε2. το ΑΝΤΙΚΕΙΜΕΝΟ το κουβαλάει, και το τσιπ το παίρνει (11/09/2026) ──────────
// Διαβάζει το συντακτικό δέντρο των αρχείων παραγωγής (typescript.createSourceFile), όχι κείμενο
// με παράθυρα χαρακτήρων — ένα σχόλιο παραπάνω δεν πρέπει να τυφλώνει τον κανόνα.
const PROD_DIRS = ['components', 'pages', 'services', 'hooks', 'utils'];
const parseSource = (rel) => ts.createSourceFile(rel, fs.readFileSync(path.join(root, rel), 'utf8'),
  ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const walk = (node, visit) => { visit(node); ts.forEachChild(node, (child) => walk(child, visit)); };
const lineOf = (sf, node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
const propName = (p) => (p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : undefined);
const isFunctionNode = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n);
/** Ονόματα που δένονται στο ΑΠΟΤΕΛΕΣΜΑ μιας calculateBeachScore(...) — `const scoreResult =
 *  calculateBeachScore(...)` ή `... ?? calculateBeachScore(...)`. Δεν κατεβαίνει σε εσωτερικές
 *  συναρτήσεις: ένα `useMemo(() => … calculateBeachScore …)` δεν είναι score. */
const scoreBindingsOf = (sf) => {
  const names = new Set();
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || !n.initializer) return;
    let scores = false;
    const scan = (m) => {
      if (isFunctionNode(m)) return;
      if (ts.isCallExpression(m) && m.expression.getText(sf) === 'calculateBeachScore') scores = true;
      ts.forEachChild(m, scan);
    };
    scan(n.initializer);
    if (scores) names.add(n.name.text);
  });
  return names;
};
/** Τα `κλειδί: <score>.<πεδίο>` ενός αντικειμένου, και όλα τα κλειδιά του. */
const scoreCopiesOf = (obj, scoreNames) => {
  const copies = new Map();
  const keys = new Set();
  for (const p of obj.properties) {
    const key = propName(p);
    if (!key) continue;
    keys.add(key);
    if (ts.isPropertyAssignment(p) && ts.isPropertyAccessExpression(p.initializer)
      && ts.isIdentifier(p.initializer.expression) && scoreNames.has(p.initializer.expression.text)) {
      copies.set(key, { from: p.initializer.expression.text, field: p.initializer.name.text });
    }
  }
  return { copies, keys };
};
const prodFiles = ['App.tsx', ...PROD_DIRS.flatMap((dir) => fs.readdirSync(path.join(root, dir))
  .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f)).map((f) => `${dir}/${f}`))];
let toneObjectsFromScore = 0;
for (const rel of prodFiles) {
  const text = fs.readFileSync(path.join(root, rel), 'utf8');
  if (!text.includes('calculateBeachScore')) continue;
  const sf = parseSource(rel);
  const scoreNames = scoreBindingsOf(sf);
  if (!scoreNames.size) continue;
  walk(sf, (n) => {
    if (!ts.isObjectLiteralExpression(n)) return;
    const { copies, keys } = scoreCopiesOf(n, scoreNames);
    const sea = copies.get('seaStateWaveM');
    // Αντικείμενο ΧΡΩΜΑΤΟΣ = κουβαλά τη θάλασσα της σκάλας ΚΑΙ είσοδο που μόνο το χρώμα διαβάζει.
    // (Το μήνυμα σχολίου της σελίδας κουβαλά θάλασσα αλλά κανένα από τα δύο — δεν βάφει τίποτα.)
    if (!sea || sea.field !== 'seaStateWaveM' || !(keys.has('enclosedCove') || keys.has('simpleWindSuitability'))) return;
    toneObjectsFromScore += 1;
    // Το αντικείμενο χρώματος κουβαλά το K_d του ΧΡΩΜΑΤΟΣ (toneShoreShadowDamping), όχι το πλήρες.
    for (const [field, fromField] of [['shoreShadowDamping', 'toneShoreShadowDamping'], ['seaArrivalExposureLevel', 'seaArrivalExposureLevel']]) {
      const c = copies.get(field);
      if (!c || c.from !== sea.from || c.field !== fromField) {
        fail('Ε', `${rel}:${lineOf(sf, n)} — αντικείμενο χρώματος χτισμένο από το \`${sea.from}\` δεν έχει \`${field}: ${sea.from}.${fromField}\`${c ? ` (έχει \`${c.from}.${c.field}\`)` : ''} — ${field === 'shoreShadowDamping' ? 'το χρώμα θα πάρει άλλο K_d από το τσιπ (ή το πλήρες, που το κάνει πιο ήρεμο από το ×0,5)' : 'K_d χωρίς άφιξη δίνει έκπτωση εκεί που η πινέζα την αρνείται'}`);
      }
    }
  });
}
// Τέσσερα σήμερα: App.tsx mapSuitableBeaches, οι δύο builders του recommendationService, ο μικρός
// χάρτης της σελίδας. Αν πέσουν κάτω από 4, ο κανόνας έχασε το μάτι του (π.χ. μετονομασία) — όχι νίκη.
if (toneObjectsFromScore < 4) fail('Ε', `βρέθηκαν ${toneObjectsFromScore} αντικείμενα χρώματος χτισμένα από score — περίμενα ≥4 (App.tsx mapSuitableBeaches, 2× recommendationService, μικρός χάρτης σελίδας)· ο κανόνας τυφλώθηκε`);

// Το τσιπ: η παράμετρος υπάρχει, μπαίνει στο toneInput, και το scoring τη δίνει.
{
  const sf = parseSource('utils/windExposureEngine.ts');
  let hasParam = false;
  let inToneInput = false;
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== 'applySeaStateToWindSuitability') return;
    const fn = n.initializer;
    if (!fn || !isFunctionNode(fn)) return;
    hasParam = fn.parameters.some((p) => ts.isIdentifier(p.name) && p.name.text === 'shoreShadowDamping');
    walk(fn, (m) => {
      if (ts.isVariableDeclaration(m) && ts.isIdentifier(m.name) && m.name.text === 'toneInput'
        && m.initializer && ts.isObjectLiteralExpression(m.initializer)) {
        inToneInput = m.initializer.properties.some((p) => propName(p) === 'shoreShadowDamping');
      }
    });
  });
  if (!hasParam) fail('Ε', 'utils/windExposureEngine.ts: η applySeaStateToWindSuitability δεν έχει πια παράμετρο shoreShadowDamping — το τσιπ ξαναπέφτει στο ×0,5');
  if (!inToneInput) fail('Ε', 'utils/windExposureEngine.ts: το toneInput του τσιπ δεν περιέχει shoreShadowDamping — χρώμα ΚΑΙ τα δύο σήματα της κάρτας χάνουν το K_d');
}
{
  const sf = parseSource('services/recommendationService.ts');
  let chipCalls = 0;
  let chipCallsWithKd = 0;
  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || n.expression.getText(sf) !== 'applySeaStateToWindSuitability') return;
    chipCalls += 1;
    if (n.arguments.some((a) => ts.isIdentifier(a) && a.text === 'toneShoreShadowDamping')) chipCallsWithKd += 1;
  });
  if (!chipCalls) fail('Ε', 'services/recommendationService.ts: δεν βρέθηκε κλήση applySeaStateToWindSuitability — αν μετακόμισε, μετάφερε και τον έλεγχο');
  if (chipCallsWithKd !== chipCalls) fail('Ε', `services/recommendationService.ts: ${chipCalls - chipCallsWithKd} κλήση(-εις) του τσιπ χωρίς το toneShoreShadowDamping (το K_d του χρώματος)`);
}
// Η πινέζα και το ταμπελάκι του πάνελ: κάθε ΑΝΑ-ΠΑΡΑΛΙΑ κλήση της σκάλας στον χάρτη περνάει K_d. Τα
// δείγματα του υπομνήματος (πρώτο όρισμα 'protected'/'exposed', διάμεση θάλασσα ομάδας) εξαιρούνται:
// δεν ανήκουν σε παραλία, άρα δεν έχουν δικό τους K_d.
{
  const sf = parseSource('components/BeachMap.tsx');
  let perBeachCalls = 0;
  walk(sf, (n) => {
    if (!ts.isCallExpression(n)) return;
    const callee = n.expression.getText(sf);
    if (callee !== 'getExposureMarkerTone' && callee !== 'exposureIconFor') return;
    if (n.arguments[0] && ts.isStringLiteral(n.arguments[0])) return;
    perBeachCalls += 1;
    const passesKd = n.arguments.some((a) => {
      const t = a.getText(sf);
      return t === 'shoreShadowDamping' || t === 'item.shoreShadowDamping';
    });
    if (!passesKd) fail('Ε', `components/BeachMap.tsx:${lineOf(sf, n)} — ${callee}(…) ανά παραλία χωρίς K_d: αυτό το χρώμα θα διαφωνεί με την πινέζα δίπλα του`);
  });
  if (perBeachCalls < 3) fail('Ε', `components/BeachMap.tsx: βρέθηκαν ${perBeachCalls} ανά-παραλία κλήσεις της σκάλας — περίμενα ≥3 (εικονίδιο πινέζας, δημιουργός εικονιδίου, ταμπελάκι πάνελ)`);
  // Το beachToneInput ΤΟ ΙΔΙΟ (λεζάντα, πίνακας χρωμάτων προς το App → βάθρο/λίστα/φίλτρο χρώματος,
  // γραμμή αιτίας, «Ήρεμο νερό»). Ελεγκτής 11/09: σβήνοντας ΜΟΝΟ αυτή τη γραμμή, το παλιό Ε περνούσε
  // γιατί η ίδια φράση υπάρχει και στο όρισμα της πόρτας των 4 Μπφ. Εδώ κρίνεται μέσα στη συνάρτηση.
  let toneInputFns = 0;
  let toneInputCarriesKd = false;
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== 'beachToneInput' || !n.initializer) return;
    toneInputFns += 1;
    walk(n.initializer, (m) => {
      if (ts.isPropertyAssignment(m) && propName(m) === 'shoreShadowDamping' && m.initializer.getText(sf) === 'item.shoreShadowDamping') toneInputCarriesKd = true;
    });
  });
  // Και ΜΕΣΑ στο getExposureMarkerTone: οι κλήσεις του περνάνε K_d (παραπάνω), αλλά αν η ίδια η συνάρτηση
  // δεν το προωθεί στο resolveConditionTone, κάθε εικονίδιο πινέζας και το ταμπελάκι γυρίζουν στο ×0,5 ενώ
  // λεζάντα/λίστα κρατούν το K_d (δεύτερος ελεγκτής 11/09: σβήνοντας αυτή τη γραμμή, όλες οι πύλες περνούσαν).
  let markerFns = 0;
  let markerForwardsKd = false;
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isIdentifier(n.name) || n.name.text !== 'getExposureMarkerTone' || !n.initializer) return;
    markerFns += 1;
    walk(n.initializer, (m) => {
      if (!ts.isCallExpression(m) || m.expression.getText(sf) !== 'resolveConditionTone') return;
      const arg = m.arguments[0];
      if (arg && ts.isObjectLiteralExpression(arg) && arg.properties.some((p) => propName(p) === 'shoreShadowDamping')) markerForwardsKd = true;
    });
  });
  if (markerFns !== 1) fail('Ε', `components/BeachMap.tsx: βρέθηκαν ${markerFns} ορισμοί getExposureMarkerTone — περίμενα 1· αν μετονομάστηκε, μετάφερε τον έλεγχο`);
  else if (!markerForwardsKd) fail('Ε', 'components/BeachMap.tsx: το getExposureMarkerTone δεν προωθεί το shoreShadowDamping στο resolveConditionTone — πινέζα και ταμπελάκι στο ×0,5, λεζάντα και λίστα με K_d');
  if (toneInputFns !== 1) fail('Ε', `components/BeachMap.tsx: βρέθηκαν ${toneInputFns} ορισμοί beachToneInput — περίμενα 1· αν μετονομάστηκε, μετάφερε τον έλεγχο`);
  else if (!toneInputCarriesKd) fail('Ε', 'components/BeachMap.tsx: το beachToneInput δεν περνάει `shoreShadowDamping: item.shoreShadowDamping` — λεζάντα, πίνακας χρωμάτων (βάθρο/λίστα), γραμμή αιτίας και «Ήρεμο νερό» ξαναπέφτουν στο ×0,5 ενώ η πινέζα δίπλα όχι');
}
console.log(`Ε. η καλωδίωση άθικτη ........................ ${failures.length > beforeE ? '❌' : '✅'}`);

// ── ΣΤ. το χρώμα το καταναλώνει αληθινά ─────────────────────────────────────
const beforeF = failures.length;
{
  const TONE_RANK = { red: 0, orange: 1, yellow: 2, blue: 3 };
  const base = { exposureLevel: 'protected', beaufort: 2, isEnclosedCove: false, seaStateM: 1.3 };
  const withCorridor = resolveConditionTone({ ...base, shoreShadowDamping: 1 });
  const withDeepShadow = resolveConditionTone({ ...base, shoreShadowDamping: 0.1 });
  if (TONE_RANK[withCorridor] > TONE_RANK[withDeepShadow]) {
    fail('ΣΤ', `πινέζα με K_d=1 (${withCorridor}) βγήκε ΠΙΟ ΗΡΕΜΗ από K_d=0,1 (${withDeepShadow}) — το χρώμα δεν διαβάζει το K_d`);
  }
  if (withCorridor === withDeepShadow) {
    fail('ΣΤ', `K_d 1 και 0,1 έδωσαν ίδιο χρώμα (${withCorridor}) σε θάλασσα 1,3 μ. — το ταβάνι δεν το καταναλώνει`);
  }
}
console.log(`ΣΤ. η πινέζα καταναλώνει το K_d .............. ${failures.length > beforeF ? '❌' : '✅'}`);

// ── Ζ. πινέζα == σελίδα, με κλήση, σε όλη τη χώρα (11/09/2026) ─────────────────
// Το Ε2 λέει ότι ο κώδικας ΓΡΑΦΕΙ το πεδίο· αυτό λέει ότι το χρώμα που βγαίνει είναι αυτό της
// σελίδας. Τα πεδία του αντικειμένου χάρτη ΔΕΝ αντιγράφονται εδώ: διαβάζονται από το δέντρο του
// App.tsx (mapSuitableBeaches) και του pages/BeachDetailPage.tsx (<BeachMap beaches={[{…}]}>), ώστε
// ένα πεδίο που σβήνεται από εκεί να σβήνεται και από εδώ και να φανεί στο χρώμα.
const beforeZ = failures.length;
{
  const tZ = Date.now();
  const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
  const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
  // Η ΙΔΙΑ εγγραφή του require-cache που φόρτωσε το scoring, αλλιώς ο καταγραφέας δεν πιάνει τίποτα.
  const windExposureEngine = require(path.join(root, 'utils/windExposureEngine.ts'));
  const { assessBeachWindExposure } = windExposureEngine;
  const { seaStateSeverityM, colourShadowDamping } = require(path.join(root, 'utils/waveCharacter.ts'));
  const TONE_RANK_Z = { red: 0, orange: 1, yellow: 2, blue: 3 };
  const { holdsFlatWaterUnderOffshoreWind, holdsGlassWaterAtFourBeaufort, hasDownwindSeaSample } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
  const { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
  const { getBeaufortLevel, degToCompass } = require(path.join(root, 'utils/weatherUtils.ts'));

  // Παθητικός καταγραφέας της κλήσης του τσιπ: το recommendationService καλεί
  // `(0, windExposureEngine_1.applySeaStateToWindSuitability)(…)`, δηλαδή διαβάζει την ιδιότητα την
  // ώρα της κλήσης. Επιστρέφει ΑΥΤΟΥΣΙΟ το αποτέλεσμα της πραγματικής συνάρτησης.
  const realApply = windExposureEngine.applySeaStateToWindSuitability;
  let chipCall = null;
  windExposureEngine.applySeaStateToWindSuitability = (...args) => {
    const result = realApply(...args);
    chipCall = { args, result };
    return result;
  };
  // Θέση του K_d στην υπογραφή (utils/windExposureEngine.ts: suitability, seaStateM, enclosedCove,
  // downwindSeaSample, swimVerdictAvoid, seaArrivalExposureLevel, glassWaterAtFour,
  // curatedWindOnlyProtection, forecastUncertain, shoreShadowDamping). Το Ε2 φυλάει το όνομα.
  const CHIP_KD_ARG = 9;

  // ── τα πεδία που αντιγράφουν ΣΗΜΕΡΑ τα δύο αντικείμενα χάρτη, από τον πηγαίο κώδικα ──
  const appSf = parseSource('App.tsx');
  let appObject = null;
  walk(appSf, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'mapSuitableBeaches' && n.initializer) {
      walk(n.initializer, (m) => {
        if (ts.isObjectLiteralExpression(m) && m.properties.some((p) => propName(p) === 'simpleWindSuitability')) appObject = m;
      });
    }
  });
  const appCopies = appObject ? [...scoreCopiesOf(appObject, new Set(['scoreResult'])).copies].map(([k, c]) => [k, c.field]) : [];
  const pageSf = parseSource('pages/BeachDetailPage.tsx');
  let pageObject = null;
  const pageShorthandFromScore = new Map(); // pages/BeachDetailPage.tsx: `const { … } = scoreResult`
  walk(pageSf, (n) => {
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
        const dflt = el.initializer?.kind === ts.SyntaxKind.FalseKeyword ? false : el.initializer?.kind === ts.SyntaxKind.TrueKeyword ? true : undefined;
        pageShorthandFromScore.set(el.name.text, { field, dflt });
      }
    }
  });
  const pageCopies = pageObject ? [...scoreCopiesOf(pageObject, new Set(['scoreResult'])).copies].map(([k, c]) => [k, c.field]) : [];
  const pageShorthands = pageObject
    ? pageObject.properties.filter((p) => ts.isShorthandPropertyAssignment(p) && pageShorthandFromScore.has(p.name.text)).map((p) => [p.name.text, pageShorthandFromScore.get(p.name.text)])
    : [];
  if (!appObject) fail('Ζ', 'δεν βρέθηκε το αντικείμενο του App.tsx mapSuitableBeaches (με simpleWindSuitability) — αν μετακόμισε, μετάφερε και τον έλεγχο');
  if (!pageObject) fail('Ζ', 'δεν βρέθηκε το <BeachMap beaches={[{…}]}> του pages/BeachDetailPage.tsx — αν μετακόμισε, μετάφερε και τον έλεγχο');

  /** App.tsx mapSuitableBeaches: τα ΜΗ-score πεδία όπως τα χτίζει το App (assessBeachWindExposure με
   *  τον άνεμο της παραλίας — App.tsx, «islandWindAssessment»), + ΟΛΑ τα `κλειδί: scoreResult.πεδίο`
   *  όπως τα βρήκε το δέντρο. */
  const appItem = (beach, day, s, profile) => {
    const windKmh = day.wind.speed * 3.6;
    const a = assessBeachWindExposure({
      beach, geospatialProfile: profile, windDirectionDeg: day.wind.deg, windDirection: degToCompass(day.wind.deg),
      windSpeedKmh: windKmh, beaufort: getBeaufortLevel(windKmh), waveHeightMeters: day.marine?.waveHeightM,
    });
    const item = {
      beachId: beach.id, explanation: '', beach,
      isExposed: a.exposureLevel ? a.exposureLevel !== 'protected' : true, exposureLevel: a.exposureLevel,
      orientation: a.windProfile.beachFacingDirection ?? null, windProfile: a.windProfile,
      windProfileSource: a.source, windSector: a.windSector, distance: undefined, geospatialExposure: profile,
    };
    for (const [key, field] of appCopies) item[key] = s[field];
    return item;
  };
  /** pages/BeachDetailPage.tsx μικρός χάρτης: `κλειδί: scoreResult.πεδίο` + τα shorthand που
   *  έρχονται από το `const { … } = scoreResult` (με τις ίδιες προεπιλογές)· beach/geospatialExposure
   *  όπως τα ορίζει η σελίδα (geospatialExposureProfiles?.[beach.id]). */
  const pageItem = (beach, s, profile) => {
    const item = { beachId: beach.id, beach, geospatialExposure: profile };
    for (const [key, field] of pageCopies) item[key] = s[field];
    for (const [key, { field, dflt }] of pageShorthands) item[key] = s[field] ?? dflt;
    return item;
  };
  /** components/BeachMap.tsx beachToneInput (η πινέζα, η λεζάντα, ο πίνακας χρωμάτων που στέλνεται
   *  στο App), όρισμα προς όρισμα· επίπεδο = getMapExposureLevel (override πρώτα, μετά το πέρασμα
   *  γειτονιάς)· ο άνεμος της παραλίας = ο άνεμος του σεναρίου. Ίδιο με
   *  scripts/measurePinShoreShadowWiring.mjs pinToneInput. */
  const pinToneInput = (item, ctx) => {
    const exposureLevel = ctx.levels.get(item.beach.id) || getVisibleMapExposureLevel(item, ctx.beaufort, ctx.deg);
    const seaStateM = seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS);
    const swellWaveHeightM = item.marine?.swellWaveHeightM;
    return {
      exposureLevel, beaufort: ctx.beaufort, isEnclosedCove: Boolean(item.enclosedCove), seaStateM,
      offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, swellWaveHeightM }),
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
  /** utils/windExposureEngine.ts toneInput του τσιπ, από τα ΠΡΑΓΜΑΤΙΚΑ ορίσματα της κλήσης —
   *  μόνο για να κριθεί «ίδια ακτή, ίδια δεδομένα» στο Ζ4· το χρώμα του τσιπ διαβάζεται από το score. */
  const chipToneInput = (args) => {
    const [suitability, seaStateM, enclosedCove, downwindSeaSample = false, swimVerdictAvoid = false,
      seaArrivalExposureLevel, glassWaterAtFour = false, curatedWindOnlyProtection = false, forecastUncertain = false, shoreShadowDamping] = args;
    return {
      exposureLevel: suitability.exposureStatus, beaufort: suitability.windBeaufort, windSpeedKmh: suitability.windSpeedKmh,
      isEnclosedCove: enclosedCove, seaStateM, offshoreFlatWater: suitability.offshoreFlatWater, glassWaterAtFour,
      downwindSeaSample, swimVerdictAvoid, seaArrivalExposureLevel, shoreShadowDamping, curatedWindOnlyProtection, forecastUncertain,
    };
  };
  const FLAGS = new Set(['isEnclosedCove', 'offshoreFlatWater', 'glassWaterAtFour', 'downwindSeaSample', 'swimVerdictAvoid', 'curatedWindOnlyProtection', 'forecastUncertain']);
  const SAME_SHORE_KEYS = ['exposureLevel', 'beaufort', 'windSpeedKmh', 'isEnclosedCove', 'seaStateM', 'offshoreFlatWater',
    'glassWaterAtFour', 'downwindSeaSample', 'swimVerdictAvoid', 'seaArrivalExposureLevel', 'curatedWindOnlyProtection', 'forecastUncertain'];
  const norm = (key, v) => (FLAGS.has(key) ? Boolean(v) : v);
  const sameShore = (a, b) => SAME_SHORE_KEYS.every((k) => norm(k, a[k]) === norm(k, b[k]));

  // ── δεδομένα και σενάρια ──
  const exposureDir = path.join(root, 'public/data/geospatial/exposure');
  const regions = fs.readdirSync(exposureDir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort().map((f) => {
    const regionId = f.replace(/\.json$/, '');
    const profilesById = {};
    for (const p of Object.values(JSON.parse(fs.readFileSync(path.join(exposureDir, f), 'utf8')).profiles ?? {})) {
      if (p?.beachId != null) profilesById[p.beachId] = p;
    }
    let beaches = [];
    try { beaches = JSON.parse(fs.readFileSync(path.join(root, 'public/data/beaches/app', `${regionId}.json`), 'utf8')).island?.beaches ?? []; } catch { beaches = []; }
    return { regionId, beaches, profilesById };
  });
  // Εκεί που η εθνική μέτρηση (reports/quality/pin-shore-shadow-wiring.json) βρήκε ότι το K_d αλλάζει
  // χρώμα: αντίθετος άνεμος 20 χλμ/ώ με Hs 1,6 (πορτοκαλί↔κόκκινο, K_d=1), θάλασσα 2,5 μ. με 35 χλμ/ώ
  // (κόκκινο↔πορτοκαλί, K_d<0,5), ελαφρύς άνεμος 8 χλμ/ώ με Hs 1,0 (μπλε↔κίτρινο). 8 διευθύνσεις.
  const REGIMES = [{ hs: 1.6, kmh: 20, opposite: true }, { hs: 2.5, kmh: 35 }, { hs: 1.0, kmh: 8 }];
  const scenarios = [];
  for (let deg = 0; deg < 360; deg += 45) for (const r of REGIMES) scenarios.push({ waveDeg: deg, windDeg: r.opposite ? (deg + 180) % 360 : deg, kmh: r.kmh, hs: r.hs });

  const z = {
    pairs: 0, regionsSeen: 0, pinStarved: 0, pinDiffers: 0, chipStarved: 0, chipDiffers: 0, chipCallMissing: 0,
    pageDiffers: 0, sameShorePairs: 0, sameShoreKdDiffers: 0, sameShoreColourDiffers: 0, pinEqPage: 0,
    pinSeesMissingKd: 0, chipSeesMissingKd: 0, toneKdNotHelper: 0, pinCalmerThanLegacy: 0, chipCalmerThanLegacy: 0, examples: [],
  };
  const example = (e) => { if (z.examples.length < 6) z.examples.push(e); };
  const regionsWithBeaches = new Set();
  for (const sc of scenarios) {
    const windMs = sc.kmh / 3.6;
    const day = createDailyForecast(0, {
      id: 'kd-wiring', label: 'kd-wiring', windDirectionDeg: sc.windDeg, windSpeedMs: windMs,
      windGustMs: windMs * 1.35, waveHeightM: sc.hs, waveDirectionDeg: sc.waveDeg,
    });
    const beaufort = getBeaufortLevel(day.wind.speed * 3.6);
    const label = `κύμα ${sc.waveDeg}° Hs ${sc.hs} μ. · άνεμος ${sc.windDeg}° ${sc.kmh} χλμ/ώ`;
    for (const { regionId, beaches, profilesById } of regions) {
      const scored = beaches.filter((b) => profilesById[b.id]);
      if (!scored.length) continue;
      regionsWithBeaches.add(regionId);
      // App.tsx mapSuitableBeaches: ίδια ορίσματα βαθμολογίας (weatherSource 'island-fallback',
      // hourlyForecast, geospatialProfile)· η σελίδα βαθμολογεί με την ίδια συνάρτηση.
      const rows = beaches.map((beach) => {
        chipCall = null;
        const profile = profilesById[beach.id];
        const s = calculateBeachScore(beach, day, undefined, undefined, { weatherSource: 'island-fallback', hourlyForecast: day.hourly, geospatialProfile: profile });
        return { beach, profile, s, call: chipCall, item: appItem(beach, day, s, profile) };
      });
      const items = rows.map((r) => r.item);
      // App.tsx canonicalMapExposureLevels — ίδιες 4 παράμετροι (άνεμος ανά παραλία).
      const perBeachWind = new Map(beaches.map((b) => [b.id, { beaufort, directionDeg: day.wind.deg }]));
      const levels = getConsistentVisibleMapExposureLevels(items, beaufort, day.wind.deg, perBeachWind);
      const ctx = { levels, beaufort, deg: day.wind.deg, windKmh: day.wind.speed * 3.6 };
      for (const { beach, profile, s, call, item } of rows) {
        if (!profile) continue;
        z.pairs += 1;
        // Το K_d του ΧΡΩΜΑΤΟΣ — ό,τι έβγαλε το score, και ΑΚΡΙΒΩΣ colourShadowDamping(πλήρες K_d).
        const kd = s.toneShoreShadowDamping;
        if (kd !== colourShadowDamping(s.shoreShadowDamping)) z.toneKdNotHelper += 1;
        const where = `${regionId} #${beach.id} · ${label} · K_d ${s.shoreShadowDamping} → χρώμα ${kd}`;
        // Ζ1 — η πινέζα φοράει το K_d χρώματος του score.
        if (typeof kd === 'number' && item.shoreShadowDamping !== kd) z.pinStarved += 1;
        const pinIn = pinToneInput(item, ctx);
        const pin = resolveConditionTone(pinIn);
        const pinWithScoreKd = resolveConditionTone(pinToneInput({ ...item, shoreShadowDamping: kd }, ctx));
        if (pin !== pinWithScoreKd) { z.pinDiffers += 1; example(`Ζ1 ${where}: πινέζα ${pin}, με το K_d του score ${pinWithScoreKd}`); }
        const { shoreShadowDamping: _dropped, ...itemWithoutKd } = item;
        const pinLegacy = resolveConditionTone(pinToneInput(itemWithoutKd, ctx));
        if (pinLegacy !== pinWithScoreKd) z.pinSeesMissingKd += 1;
        // Ζ1β — ΜΟΝΟΔΡΟΜΟ: ποτέ πιο ήρεμη από το ιστορικό ×0,5.
        if (TONE_RANK_Z[pin] > TONE_RANK_Z[pinLegacy]) { z.pinCalmerThanLegacy += 1; example(`Ζ1β ${where}: πινέζα ${pin}, με το ιστορικό ×0,5 ${pinLegacy}`); }
        // Ζ2 — το τσιπ (= χρώμα σελίδας) πήρε το K_d του score.
        const chip = s.simpleWindSuitability?.suitabilityColor;
        if (!call) { z.chipCallMissing += 1; continue; }
        if (call.args[CHIP_KD_ARG] !== kd) z.chipStarved += 1;
        const baseArgs = call.args.slice(0, CHIP_KD_ARG);
        const chipWithScoreKd = realApply(...baseArgs, kd).suitabilityColor;
        if (chip !== chipWithScoreKd) { z.chipDiffers += 1; example(`Ζ2 ${where}: τσιπ ${chip}, με το K_d του score ${chipWithScoreKd}`); }
        const chipLegacy = realApply(...baseArgs, undefined).suitabilityColor;
        if (chipLegacy !== chipWithScoreKd) z.chipSeesMissingKd += 1;
        if (TONE_RANK_Z[chip] > TONE_RANK_Z[chipLegacy]) { z.chipCalmerThanLegacy += 1; example(`Ζ1β ${where}: τσιπ ${chip}, με το ιστορικό ×0,5 ${chipLegacy}`); }
        // Ζ3 — ο μικρός χάρτης της σελίδας (ίδιο override επιπέδου, App.tsx mapExposureLevelOverride).
        const pagePin = resolveConditionTone(pinToneInput(pageItem(beach, s, profile), ctx));
        if (pagePin !== pin) { z.pageDiffers += 1; example(`Ζ3 ${where}: μικρός χάρτης ${pagePin}, πινέζα περιοχής ${pin}`); }
        // Ζ4 — ίδια ακτή, ίδια δεδομένα → ίδιο K_d, ίδιο χρώμα.
        if (pin === chip) z.pinEqPage += 1;
        const chipIn = chipToneInput(call.args);
        if (sameShore(pinIn, chipIn)) {
          z.sameShorePairs += 1;
          if (pinIn.shoreShadowDamping !== chipIn.shoreShadowDamping) z.sameShoreKdDiffers += 1;
          if (pin !== chip) { z.sameShoreColourDiffers += 1; example(`Ζ4 ${where}: πινέζα ${pin}, σελίδα ${chip}`); }
        }
      }
    }
  }
  windExposureEngine.applySeaStateToWindSuitability = realApply;
  z.regionsSeen = regionsWithBeaches.size;

  if (z.regionsSeen < 100) fail('Ζ', `το δείγμα είδε ${z.regionsSeen} περιοχές — περίμενα όλη τη χώρα (≥100 από 110)`);
  if (z.toneKdNotHelper) fail('Ζ', `${z.toneKdNotHelper} score όπου το K_d χρώματος ≠ colourShadowDamping(K_d) — το χρώμα πήρε άλλο κανόνα από τον μονόδρομο`);
  if (z.pinCalmerThanLegacy || z.chipCalmerThanLegacy) fail('Ζ', `ΠΙΟ ΗΡΕΜΟ από το ιστορικό ×0,5: πινέζα ${z.pinCalmerThanLegacy} · τσιπ ${z.chipCalmerThanLegacy} — το K_d του χρώματος πρέπει να δουλεύει μόνο προς το προσεκτικότερο`);
  if (z.pinStarved) fail('Ζ', `${z.pinStarved} αντικείμενα χάρτη (App.tsx mapSuitableBeaches) ΧΩΡΙΣ το K_d χρώματος του score`);
  if (z.pinDiffers) fail('Ζ', `${z.pinDiffers} πινέζες αλλάζουν χρώμα όταν τους δοθεί το K_d του score — ο χάρτης δεν το παίρνει`);
  if (z.chipCallMissing) fail('Ζ', `${z.chipCallMissing} score χωρίς κλήση του τσιπ — ο καταγραφέας δεν έπιασε την applySeaStateToWindSuitability`);
  if (z.chipStarved) fail('Ζ', `${z.chipStarved} τσιπ χωρίς το K_d του score (όρισμα ${CHIP_KD_ARG + 1} της applySeaStateToWindSuitability)`);
  if (z.chipDiffers) fail('Ζ', `${z.chipDiffers} τσιπ (= χρώμα σελίδας) αλλάζουν χρώμα όταν τους δοθεί το K_d του score`);
  if (z.pageDiffers) fail('Ζ', `${z.pageDiffers} φορές ο μικρός χάρτης της σελίδας έχει άλλο χρώμα από την πινέζα της περιοχής`);
  if (z.sameShoreKdDiffers || z.sameShoreColourDiffers) fail('Ζ', `ίδια ακτή, ίδια δεδομένα, αλλά ${z.sameShoreKdDiffers} με άλλο K_d και ${z.sameShoreColourDiffers} με άλλο χρώμα πινέζα/σελίδα`);
  // Μη-τυφλότητα: το δείγμα πρέπει να ΜΠΟΡΕΙ να δει ένα χαμένο K_d, αλλιώς τα μηδενικά από πάνω δεν λένε τίποτα.
  if (!z.pinSeesMissingKd) fail('Ζ', 'σε κανένα ζεύγος η πινέζα δεν αλλάζει χωρίς K_d — τα σενάρια δεν ασκούν το K_d, η πύλη είναι τυφλή');
  if (!z.chipSeesMissingKd) fail('Ζ', 'σε κανένα ζεύγος το τσιπ δεν αλλάζει χωρίς K_d — τα σενάρια δεν ασκούν το K_d, η πύλη είναι τυφλή');
  if (z.sameShorePairs < z.pairs / 4) fail('Ζ', `μόνο ${z.sameShorePairs}/${z.pairs} ζεύγη «ίδια ακτή» — το Ζ4 κρίνει πολύ λίγα για να λέει κάτι`);
  const share = (a) => `${((100 * a) / Math.max(1, z.pairs)).toFixed(2)}%`;
  console.log(`   δείγμα: ${z.pairs} ζεύγη · ${z.regionsSeen} περιοχές · ${scenarios.length} σενάρια · ${((Date.now() - tZ) / 1000).toFixed(1)} s`);
  console.log(`   χωρίς K_d θα άλλαζαν: πινέζα ${z.pinSeesMissingKd} · τσιπ ${z.chipSeesMissingKd}  |  ίδια ακτή ${z.sameShorePairs} (${share(z.sameShorePairs)}) · πινέζα == χρώμα σελίδας συνολικά ${share(z.pinEqPage)}`);
  for (const e of z.examples) console.log(`   · ${e}`);
}
console.log(`Ζ. πινέζα/τσιπ/μικρός χάρτης = K_d χρώματος, ποτέ πιο ήρεμα .. ${failures.length > beforeZ ? '❌' : '✅'}`);

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα(τα).`);
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`);
  console.error('\nΕΠΟΜΕΝΟ ΒΗΜΑ: μην περάσεις την πύλη χαλαρώνοντας κανόνα.');
  console.error('· Αν έπεσε το Γ (grazing): η μαρτυρία των καμερών του §Γ59 προηγείται του μοντέλου — μη βάλεις K_d εκεί χωρίς νέα μέτρηση με μάτια.');
  console.error('· Αν έπεσε το Ε: κάποια επιφάνεια αποσυνδέθηκε από το score.shoreShadowDamping και θα υπολογίζει άλλο νούμερο από τις υπόλοιπες (§Κ1/§Γ56).');
  console.error('· Αν έπεσε το Ζ: ξαναπέρασε το K_d ΚΑΙ την άφιξη της θάλασσας στο αντικείμενο/την κλήση που λέει — ΜΑΖΙ στην πινέζα και στο τσιπ (μόνο η πινέζα ρίχνει τη συμφωνία με τη σελίδα στο 85,6% σε θάλασσα ≥2 μ., scripts/measurePinShoreShadowWiring.mjs). Μη βγάλεις σενάριο από το δείγμα για να περάσει.');
  process.exit(1);
}
console.log(`\nPASSED: K_d = διάδρομος 1 · άκρη ${SHADOW_KD_AT_EDGE} · e^(−θ/${SHADOW_DECAY_DEG}°) · δάπεδο ${SHADOW_KD_FLOOR} · πάτωμα πλάγιας ${SHADOW_KD_AT_EDGE} (onshore > ${SHADOW_CROSS_SEA_ONSHORE_MIN}) · enclosed — μία πηγή, πέντε αναγνώστες, φραγμένο [0,1] · πινέζα και τσιπ παίρνουν το K_d χρώματος (max(K_d, 0,5)) — ποτέ πιο ήρεμα από πριν· μικρός χάρτης και ταμπελάκι = η πινέζα της περιοχής (και προς τις δύο μεριές, με την άφιξη).`);
