#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΕΘΝΙΚΑ ΑΝ Η ΣΚΙΑ ΠΑΨΕΙ ΝΑ ΚΡΙΝΕΤΑΙ ΑΠΟ ΤΗ ΓΩΝΙΑ ΜΟΝΟ — μέτρηση πριν την αλλαγή.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ (29/08/2026, τέσσερις αναφορές webcam μέσα σε μία ώρα):
 *
 *   Βάι #730          κοιτάει  85,3°  πόρτα 16,3 χλμ  άφιξη «undefined» → έκπτωση ×0,112 → «λάδι»
 *   Κιτροπλατεία #746 κοιτάει 120,0°  πόρτα 12,5 χλμ  άφιξη «grazing»   → έκπτωση ×0,112 → «λάδι»
 *   Αλμυρός #720      κοιτάει 108,7°  πόρτα 18,3 χλμ  άφιξη «grazing»   → έκπτωση ×0,303 → «σχεδόν χωρίς»
 *   Λίνδος #2443      κοιτάει  72,3°  πόρτα  5,3 χλμ  άφιξη «partial»   → ΚΑΜΙΑ έκπτωση   → «αρκετό κύμα»
 *
 * Και τα τέσσερα λάθος, και τα τέσσερα από το ίδιο σημείο. Το K_d είναι μοντέλο ΠΕΡΙΘΛΑΣΗΣ:
 * λέει πόσο ύψος μένει όταν το κύμα πρέπει να ΣΤΡΙΨΕΙ γύρω από εμπόδιο. Οι τρεις πρώτες είναι
 * ανοιχτές ακτές με πόρτα 12-18 χλμ — η θάλασσα μπαίνει περπατώντας, δεν στρίβει — και
 * χρεώνονται 90° περίθλασης. Η τέταρτη είναι γνήσια τσέπη (μεγαλύτερο άνοιγμα 5,3 χλμ), όπου
 * το K_d=0,1 είναι σωστό, και εκεί ακριβώς δεν εφαρμόζεται καθόλου.
 *
 * ΟΙ ΔΥΟ ΠΡΟΤΑΣΕΙΣ ΠΟΥ ΜΕΤΡΩΝΤΑΙ ΕΔΩ — και οι δύο ρωτούν το ίδιο πράγμα, «πόσο φαρδιά είναι
 * η πόρτα», που είναι ήδη στα ψημένα δεδομένα και δεν κοστίζει ούτε αίτημα ούτε μοντέλο:
 *
 *   (Α) ΠΑΤΩΜΑ ΣΤΗΝ ΑΝΟΙΧΤΗ ΑΚΤΗ ΜΕ ΠΛΑΓΙΑ ΘΑΛΑΣΣΑ. Δύο συνθήκες μαζί, και η δεύτερη είναι που
 *       κάνει το εργαλείο νυστέρι αντί για βαριά:
 *         1. άνοιγμα ≥ SHADOW_OPEN_FETCH_KM κάπου γύρω της — δεν κάθεται πίσω από μόλο, και
 *         2. η θάλασσα ΔΕΝ φεύγει: onshore > CROSS_SEA_ONSHORE_MIN.
 *       Τότε το K_d δεν κατεβαίνει κάτω από ένα πάτωμα. Κινεί τους αριθμούς ΠΑΝΩ (προς την
 *       προσοχή) — Βάι, Κιτροπλατεία, Αλμυρός.
 *
 *       ΓΙΑΤΙ Η ΔΕΥΤΕΡΗ ΣΥΝΘΗΚΗ. Μετρημένο στους μάρτυρες, θάλασσα από Β:
 *         κύμα υπάρχει   → Κιτροπλατεία −0,500 · Αλμυρός −0,321 · Βάι +0,082   (πλάγια)
 *         γνήσια απάνεμη → Γέρακας −0,768 · Πρέβελη −0,916 · Κουκουναριές −0,997 (φεύγει)
 *       Η θάλασσα που περνάει ΠΛΑΓΙΑ σε ρηχό πυθμένα στρίβει πάνω στην ακτή και σκάει εκεί —
 *       αυτό δείχνουν και οι τέσσερις κάμερες. Η θάλασσα που ΦΕΥΓΕΙ δεν την αγγίζει ποτέ, και
 *       εκείνη η έκπτωση είναι σωστή και μένει ανέγγιχτη. Το −0,65 έχει περιθώριο και στις δύο
 *       μεριές (πλησιέστεροι: −0,500 και −0,768) — δεν είναι κολλημένο σε κανέναν μάρτυρα.
 *   (Β) Η ΤΣΕΠΗ ΠΑΙΡΝΕΙ ΤΗΝ ΕΚΠΤΩΣΗ ΤΗΣ. Παραλία ΧΩΡΙΣ κανένα άνοιγμα ≥ SHADOW_OPEN_FETCH_KM
 *       πουθενά γύρω της, ΚΑΙ χωρίς νερό ≥ ARRIVAL_MIN_FETCH_KM στη γωνία απ' όπου έρχεται η
 *       θάλασσα, παίρνει το K_d της — ό,τι κι αν λέει ο τομέας του ΑΝΕΜΟΥ και ό,τι κι αν λέει
 *       το `level` του τομέα ΑΦΙΞΗΣ. Τη σκεπάζει η γεωμετρία, όχι ο σημερινός άνεμος.
 *       Κινεί τους αριθμούς ΚΑΤΩ — Λίνδος.
 *
 *       ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΚΑΙ Η ΔΕΥΤΕΡΗ ΣΥΝΘΗΚΗ. Χωρίς αυτήν, ο κανόνας θα έλεγε «κάθε παραλία
 *       με μέγιστο άνοιγμα κάτω από 10 χλμ παίρνει ×0,1» — και μια παραλία στον μυχό κόλπου 9
 *       χλμ με τον άνεμο να φυσάει κατ' ευθείαν μέσα του θα έπαιρνε την ίδια έκπτωση πάνω σε
 *       θάλασσα που της χτίζεται μπροστά. Το ARRIVAL_MIN_FETCH_KM (2 χλμ) είναι το ήδη
 *       υπάρχον κατώφλι του σπιτιού για «αληθινός ανοιχτός διάδρομος» — δεν εφευρίσκεται
 *       τρίτο νούμερο (utils/waveModel, το ίδιο που διαβάζει και το capLightWindMeasuredWaveM).
 *
 *       ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΝΑ ΧΑΛΑΡΩΣΕΙ ΜΟΝΟ ΤΟ `level`: στον Λίνδο η έκπτωση την μπλοκάρει η ΑΦΙΞΗ
 *       (η θάλασσα από Β δίνει onshore +0,304, μόλις πάνω από το SEA_ARRIVAL_ONSHORE_MIN, οπότε
 *       επιστρέφεται το level του τομέα Β = 'partial' και το shoreSeaStateM αρνείται). Και τα
 *       δύο σκέλη ρωτάνε γωνία· η τσέπη απαντά με νερό.
 *
 * Η (Β) είναι η επικίνδυνη κατεύθυνση (κάποιος μπαίνει σε νερό που είπαμε ήρεμο), γι' αυτό
 * μετριέται χωριστά και αναφέρεται πόσες φορές σβήνει μια μη-ήρεμη λέξη.
 *
 * ΔΕΝ ΕΙΝΑΙ ΠΥΛΗ: δεν αποτυγχάνει, μετράει. Οι πύλες μπαίνουν ΜΕΤΑ την απόφαση.
 *
 * ⚠️ ΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΙ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΔΙΑΒΑΣΤΕΙ ΤΟ ΑΠΟΤΕΛΕΣΜΑ:
 *   • Σαρώνει ΣΕΝΑΡΙΑ, όχι ζωντανό καιρό. Λέει πόσες παραλίες-καταστάσεις αλλάζουν, ΟΧΙ πόσο
 *     συχνά συμβαίνει η καθεμιά στην πραγματικότητα. Το εθνικό replay ζωντανών δεδομένων είναι
 *     χωριστό βήμα και δεν το αντικαθιστά αυτό.
 *   • Χρησιμοποιεί τον ΑΠΟΘΗΚΕΥΜΕΝΟ γεωμετρικό τομέα ως `exposureLevel`. Στην παραγωγή περνάει
 *     κι από τον windExposureEngine (παρεμβολή, curated όρμοι, windProfile), οπότε ένα μέρος
 *     των περιπτώσεων θα συμπεριφερθεί αλλιώς.
 *   • Υποθέτει ότι το κύμα έρχεται από τη γωνία του ανέμου. Σε αποθαλασσιά δεν ισχύει.
 *
 * ΧΡΗΣΗ: node scripts/measureShoreShadowGate.mjs [--floor=0.5]
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const req = (rel) => require(path.join(root, rel));

// Κάθε τύπος και κάθε κατώφλι είναι import, ποτέ αντίγραφο — δες την κεφαλίδα του
// scripts/probeShoreWaveChain.mjs για το γιατί αυτό είναι κανόνας και όχι προτίμηση.
const { resolveSeaArrivalExposureLevel, resolveShoreShadowDamping, SHADOW_OPEN_FETCH_KM } = req('utils/seaArrival.ts');
const { interpolateSectorGeometry } = req('utils/windExposureModel.ts');
const { ARRIVAL_MIN_FETCH_KM } = req('utils/waveModel.ts');
const { shoreSeaStateM } = req('utils/waveCharacter.ts');
const { waveFeelLevel } = req('utils/conditionsFeelPhrase.ts');
const { printedWaveHeightM } = req('utils/waveModel.ts');

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = (deg) => SECTORS[Math.floor((((deg % 360) + 360) % 360 + 22.5) / 45) % 8];
const WORDS = ['θάλασσα λάδι', 'σχεδόν χωρίς κύμα', 'λίγο κύμα', 'αρκετό κύμα', 'μεγάλο κύμα'];
/** Κάτω από αυτή τη βαθμίδα η οθόνη λέει «ήρεμα». Σβήσιμο μιας μη-ήρεμης λέξης = ρίσκο. */
const CALM_MAX_LEVEL = 1;

const floorArg = process.argv.find((a) => a.startsWith('--floor='));
const OPEN_COAST_KD_FLOOR = floorArg ? Number(floorArg.split('=')[1]) : 0.5;
const crossArg = process.argv.find((a) => a.startsWith('--cross='));
/** Κάτω από αυτό το onshore η θάλασσα ΦΕΥΓΕΙ και η βαθιά σκιά μένει ως έχει. */
const CROSS_SEA_ONSHORE_MIN = crossArg ? Number(crossArg.split('=')[1]) : -0.65;

const profiles = [];
{
  const dir = path.join(root, 'public/data/geospatial/exposure');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
    const payload = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    const walk = (node) => {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (!node || typeof node !== 'object') return;
      if (typeof node.beachId === 'number' && node.sectors) profiles.push(node);
      Object.values(node).forEach(walk);
    };
    walk(payload);
  }
}

const DIRECTIONS = Array.from({ length: 12 }, (_, i) => i * 30);
const OPEN_WATER_M = [0.6, 1.0, 1.5, 2.0];

const wordLevel = (m) => (typeof m === 'number' && Number.isFinite(m) ? waveFeelLevel(printedWaveHeightM(m)) : null);

let cases = 0;
const stats = {
  A: { cases: 0, beaches: new Set(), wordUp: 0, calmBroken: 0 },
  B: { cases: 0, beaches: new Set(), wordDown: 0, calmInvented: 0 },
};

for (const profile of profiles) {
  const maxFetchKm = Math.max(...SECTORS.map((s) => profile.sectors?.[s]?.fetchKm ?? 0));
  const isPocket = maxFetchKm < SHADOW_OPEN_FETCH_KM;

  for (const dir of DIRECTIONS) {
    const level = profile.sectors?.[sectorOf(dir)]?.level;
    const arrival = resolveSeaArrivalExposureLevel(profile, dir);
    const kd = resolveShoreShadowDamping(profile, dir);
    if (typeof kd !== 'number') continue;

    for (const openM of OPEN_WATER_M) {
      cases += 1;
      const current = shoreSeaStateM(openM, level, arrival, false, kd);
      const currentLevel = wordLevel(current);

      // (Α) πάτωμα στην ανοιχτή ακτή ΜΕ ΠΛΑΓΙΑ ΘΑΛΑΣΣΑ — ίδια πύλη, βαθύτερη έκπτωση απαγορευμένη
      const onshore = Math.cos(((dir - profile.facingDeg) * Math.PI) / 180);
      if (!isPocket && onshore > CROSS_SEA_ONSHORE_MIN) {
        const proposed = shoreSeaStateM(openM, level, arrival, false, Math.max(kd, OPEN_COAST_KD_FLOOR));
        const proposedLevel = wordLevel(proposed);
        if (proposedLevel !== currentLevel) {
          stats.A.cases += 1;
          stats.A.beaches.add(profile.beachId);
          if (proposedLevel > currentLevel) stats.A.wordUp += 1;
          if (currentLevel <= CALM_MAX_LEVEL && proposedLevel > CALM_MAX_LEVEL) stats.A.calmBroken += 1;
        }
      }

      // (Β) η τσέπη παίρνει την έκπτωσή της — αρκεί να μην μπαίνει νερό από τη γωνία της άφιξης
      const arrivalFetchKm = interpolateSectorGeometry(profile, dir).fetchKm;
      const pocketEarnsDiscount = isPocket && arrivalFetchKm < ARRIVAL_MIN_FETCH_KM;
      if (pocketEarnsDiscount) {
        const proposed = shoreSeaStateM(openM, 'protected', 'protected', false, kd);
        const proposedLevel = wordLevel(proposed);
        if (proposedLevel !== currentLevel) {
          stats.B.cases += 1;
          stats.B.beaches.add(profile.beachId);
          if (proposedLevel < currentLevel) stats.B.wordDown += 1;
          if (currentLevel > CALM_MAX_LEVEL && proposedLevel <= CALM_MAX_LEVEL) stats.B.calmInvented += 1;
        }
      }
    }
  }
}

const pct = (n) => `${((100 * n) / cases).toFixed(1)}%`;
console.log(`ΠΛΗΘΥΣΜΟΣ: ${profiles.length} παραλίες × ${DIRECTIONS.length} διευθύνσεις × ${OPEN_WATER_M.length} ύψη = ${cases} περιπτώσεις`);
console.log(`ΠΑΤΩΜΑ ΠΟΥ ΔΟΚΙΜΑΖΕΤΑΙ: K_d ≥ ${OPEN_COAST_KD_FLOOR} σε ανοιχτή ακτή (άνοιγμα ≥ ${SHADOW_OPEN_FETCH_KM} χλμ)`);
console.log(`ΜΟΝΟ ΟΤΑΝ Η ΘΑΛΑΣΣΑ ΔΕΝ ΦΕΥΓΕΙ: onshore > ${CROSS_SEA_ONSHORE_MIN}\n`);

console.log('(Α) ΠΑΤΩΜΑ ΣΤΗΝ ΑΝΟΙΧΤΗ ΑΚΤΗ — κατεύθυνση: προς την προσοχή');
console.log(`    αλλάζει λέξη σε ${stats.A.cases} περιπτώσεις (${pct(stats.A.cases)}), σε ${stats.A.beaches.size} παραλίες`);
console.log(`    όλες προς τα πάνω: ${stats.A.wordUp === stats.A.cases ? 'ΝΑΙ' : `ΟΧΙ (${stats.A.wordUp}/${stats.A.cases})`}`);
console.log(`    σπάει ένα «ήρεμα» και βγάζει προειδοποίηση: ${stats.A.calmBroken}\n`);

console.log('(Β) Η ΤΣΕΠΗ ΠΑΙΡΝΕΙ ΤΗΝ ΕΚΠΤΩΣΗ ΤΗΣ — κατεύθυνση: προς την ηρεμία (ΕΠΙΚΙΝΔΥΝΗ)');
console.log(`    αλλάζει λέξη σε ${stats.B.cases} περιπτώσεις (${pct(stats.B.cases)}), σε ${stats.B.beaches.size} παραλίες`);
console.log(`    όλες προς τα κάτω: ${stats.B.wordDown === stats.B.cases ? 'ΝΑΙ' : `ΟΧΙ (${stats.B.wordDown}/${stats.B.cases})`}`);
console.log(`    ⚠️ σβήνει προειδοποίηση και γράφει «ήρεμα»: ${stats.B.calmInvented}`);


// ── Ο ΕΛΕΓΧΟΣ ΑΠΟΔΟΧΗΣ: ΟΙ ΤΕΣΣΕΡΙΣ ΜΑΡΤΥΡΕΣ ΚΑΙ ΤΡΕΙΣ ΓΝΗΣΙΑ ΑΠΑΝΕΜΕΣ ─────────────────
//
// Ένα ποσοστό δεν λέει αν η αλλαγή είναι σωστή, λέει πόσο μεγάλη είναι. Η μόνη μαρτυρία που
// έχουμε για την ΑΚΤΗ είναι μάτια και κάμερες (γραμμένο στην κεφαλίδα του utils/shoreWave:
// «δεν υπάρχει κριτής για μια ακτή»), οπότε αυτές οι εφτά γραμμές είναι το κριτήριο. Οι τρεις
// τελευταίες είναι ΜΑΡΤΥΡΕΣ ΕΛΕΓΧΟΥ: κοιτάνε νότο/νοτιοδυτικά, σε μελτέμι είναι όντως λάδι, και
// πρέπει να ΜΕΙΝΟΥΝ λάδι — αλλιώς η διόρθωση αγρίεψε ολόκληρη τη χώρα για να σώσει τέσσερις.
const WITNESSES = [
  [730, 'Βάι', 'κάμερα 29/08: σπάει κύμα'],
  [746, 'Κιτροπλατεία', 'αναφορά 29/08: δεν είναι λάδι'],
  [720, 'Αλμυρός', 'αναφορά 29/08: δεν είναι λάδι'],
  [2443, 'Λίνδος', 'κάμερα 29/08: λάδι με λουόμενους'],
  [704, 'Πρέβελη', 'ΕΛΕΓΧΟΣ — πρέπει να μείνει ήρεμη'],
  [2638, 'Κουκουναριές', 'ΕΛΕΓΧΟΣ — πρέπει να μείνει ήρεμη'],
  [1209, 'Γέρακας', 'ΕΛΕΓΧΟΣ — πρέπει να μείνει ήρεμη'],
];
const MELTEMI_DIR = 0;
const MELTEMI_OPEN_M = 1.1;
console.log('\n── ΟΙ ΜΑΡΤΥΡΕΣ, ΣΕ ΜΕΛΤΕΜΙ (θάλασσα από Β, ανοιχτά ' + MELTEMI_OPEN_M + ' μ.) ──');
const byId = new Map(profiles.map((p) => [p.beachId, p]));
for (const [id, name, note] of WITNESSES) {
  const profile = byId.get(id);
  if (!profile) { console.log(`  #${id} ${name}: χωρίς προφίλ`); continue; }
  const maxFetchKm = Math.max(...SECTORS.map((s) => profile.sectors?.[s]?.fetchKm ?? 0));
  const isPocket = maxFetchKm < SHADOW_OPEN_FETCH_KM;
  const level = profile.sectors?.[sectorOf(MELTEMI_DIR)]?.level;
  const arrival = resolveSeaArrivalExposureLevel(profile, MELTEMI_DIR);
  const kd = resolveShoreShadowDamping(profile, MELTEMI_DIR);
  const onshore = Math.cos(((MELTEMI_DIR - profile.facingDeg) * Math.PI) / 180);

  const current = shoreSeaStateM(MELTEMI_OPEN_M, level, arrival, false, kd);
  const proposedKd = (!isPocket && onshore > CROSS_SEA_ONSHORE_MIN) ? Math.max(kd, OPEN_COAST_KD_FLOOR) : kd;
  const arrivalFetchKm = interpolateSectorGeometry(profile, MELTEMI_DIR).fetchKm;
  const pocketEarnsDiscount = isPocket && arrivalFetchKm < ARRIVAL_MIN_FETCH_KM;
  const proposed = pocketEarnsDiscount
    ? shoreSeaStateM(MELTEMI_OPEN_M, 'protected', 'protected', false, proposedKd)
    : shoreSeaStateM(MELTEMI_OPEN_M, level, arrival, false, proposedKd);

  const w = (m) => WORDS[wordLevel(m)] ?? '—';
  const changed = w(current) !== w(proposed);
  console.log(`  #${String(id).padStart(4)} ${name.padEnd(13)} onshore ${onshore >= 0 ? '+' : ''}${onshore.toFixed(3)}`
    + ` · πόρτα ${maxFetchKm.toFixed(1).padStart(4)} χλμ · K_d ${kd.toFixed(2)}→${proposedKd.toFixed(2)}`
    + ` · «${w(current)}» ${changed ? '→ «' + w(proposed) + '»' : '(αμετάβλητο)'}   ${note}`);
}
