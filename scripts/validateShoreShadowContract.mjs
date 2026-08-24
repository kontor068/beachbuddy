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
 *   Γ. ΤΑ ΣΚΕΛΗ ΤΗΣ shoreSeaStateM: το K_d πιάνει ΜΟΝΟ το protected σκέλος· το grazing του
 *      §Γ59 κρατά το 0,5 του (μετρημένη μαρτυρία καμερών > μοντέλο)· partial/exposed ανέγγιχτα·
 *      ζώνη [0,1] ώστε η ακτή να μην τυπωθεί ποτέ πιο άγρια από το πέλαγος έξω.
 *   Δ. ΟΙ ΠΕΝΤΕ ΑΡΙΘΜΟΙ (10 χλμ · 22,5° · 45° · 0,5 · 0,1) δεν μετακινούνται σιωπηλά.
 *   Ε. Η ΚΑΛΩΔΙΩΣΗ: το scoring υπολογίζει το K_d ΜΙΑ φορά, το περνάει και στις δύο κλήσεις
 *      της shoreSeaStateM, το κουβαλάει στο score, και πινέζα/ταβάνι/πόρτα/αιτία το περνάνε
 *      αυτούσιο — έλεγχος πάνω στον πηγαίο κώδικα, ώστε ένα refactor να μην αποσυνδέσει
 *      σιωπηλά μια επιφάνεια.
 *   ΣΤ. ΤΟ ΧΡΩΜΑ ΤΟ ΚΑΤΑΝΑΛΩΝΕΙ ΑΛΗΘΙΝΑ: ίδια είσοδος, K_d 1 έναντι 0,1 → η πινέζα με
 *      K_d=1 ΔΕΝ επιτρέπεται να βγει πιο ήρεμη από την πινέζα με K_d=0,1.
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
  resolveShoreShadowDamping,
  SHADOW_OPEN_FETCH_KM, SHADOW_CORRIDOR_HALF_DEG, SHADOW_DECAY_DEG, SHADOW_KD_AT_EDGE, SHADOW_KD_FLOOR,
} = require(path.join(root, 'utils/seaArrival.ts'));
const { shoreSeaStateM, SEA_ARRIVAL_GRAZING } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

/** Προφίλ με ΕΝΑΝ ανοιχτό διάδρομο στον Ν (180°), όλα τα άλλα κλειστά. */
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
console.log(`Γ. K_d μόνο στο protected σκέλος, φραγμένο ... ${failures.length > beforeC ? '❌' : '✅'}`);

// ── Δ. οι πέντε αριθμοί ─────────────────────────────────────────────────────
const beforeD = failures.length;
const DECIDED = { SHADOW_OPEN_FETCH_KM: 10, SHADOW_CORRIDOR_HALF_DEG: 22.5, SHADOW_DECAY_DEG: 45, SHADOW_KD_AT_EDGE: 0.5, SHADOW_KD_FLOOR: 0.1 };
for (const [name, want] of Object.entries(DECIDED)) {
  const got = { SHADOW_OPEN_FETCH_KM, SHADOW_CORRIDOR_HALF_DEG, SHADOW_DECAY_DEG, SHADOW_KD_AT_EDGE, SHADOW_KD_FLOOR }[name];
  if (got !== want) fail('Δ', `${name} ${got} ≠ ${want} — μετρήθηκε εθνικά και μπήκε με απόφαση 24/08/2026· νέα τιμή = νέα μέτρηση + νέα απόφαση`);
}
console.log(`Δ. οι πέντε αριθμοί στη θέση τους ............ ${failures.length > beforeD ? '❌' : '✅'}`);

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

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα(τα).`);
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`);
  console.error('\nΕΠΟΜΕΝΟ ΒΗΜΑ: μην περάσεις την πύλη χαλαρώνοντας κανόνα.');
  console.error('· Αν έπεσε το Γ (grazing): η μαρτυρία των καμερών του §Γ59 προηγείται του μοντέλου — μη βάλεις K_d εκεί χωρίς νέα μέτρηση με μάτια.');
  console.error('· Αν έπεσε το Ε: κάποια επιφάνεια αποσυνδέθηκε από το score.shoreShadowDamping και θα υπολογίζει άλλο νούμερο από τις υπόλοιπες (§Κ1/§Γ56).');
  process.exit(1);
}
console.log(`\nPASSED: K_d = διάδρομος 1 · άκρη ${SHADOW_KD_AT_EDGE} · e^(−θ/${SHADOW_DECAY_DEG}°) · δάπεδο ${SHADOW_KD_FLOOR} — μία πηγή, πέντε αναγνώστες, φραγμένο [0,1].`);
