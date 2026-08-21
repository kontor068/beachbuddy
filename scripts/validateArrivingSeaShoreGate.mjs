#!/usr/bin/env node
/**
 * ΠΥΛΗ: Η ΕΚΤΙΜΗΣΗ ΑΚΤΗΣ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΛΕΕΙ «ΛΑΔΙ» ΣΕ ΝΕΡΟ ΠΟΥ ΕΡΧΕΤΑΙ.
 *
 * Κλειδώνει τη διόρθωση της 21/08/2026 (Σταλίδα 645). Το `utils/shoreWave` απαντούσε στο
 * ερώτημα «μπορεί να υπάρξει κύμα εδώ;» κοιτώντας ΜΟΝΟ τη γωνία του ανέμου· όταν ο άνεμος ήταν
 * απόγειος πάνω από τομέα με μηδενικό άνοιγμα, τύπωνε το δάπεδο 0,10 μ. ακόμη κι όταν το πλέγμα
 * έδειχνε θάλασσα να μπαίνει από άλλη κατεύθυνση.
 *
 * Χωρίς δίκτυο και χωρίς κλειδί — καθαρή γεωμετρία και ιδιότητες της συνάρτησης.
 *
 *   node scripts/validateArrivingSeaShoreGate.mjs
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};

const shoreWave = require(path.join(root, 'utils/shoreWave.ts'));
const waveModel = require(path.join(root, 'utils/waveModel.ts'));
const seaArrival = require(path.join(root, 'utils/seaArrival.ts'));

const { isSeaArrivingShore, estimateShoreWaveHeightM, DEPARTING_SEA_MIN_COMPONENT_M } = shoreWave;

const failures = [];
const check = (name, condition, detail = '') => {
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
};

// ── 1. ΕΝΑ ΝΟΥΜΕΡΟ ΓΙΑ ΤΟ «ΜΠΑΙΝΕΙ ΤΟ ΝΕΡΟ», ΣΕ ΟΛΑ ΤΑ ΑΡΧΕΙΑ ───────────────────────────────
// Δύο αντίγραφα του 0,3 σε δύο αρχεία είναι ο τρόπος με τον οποίο η κάρτα και η πινέζα αρχίζουν
// να απαντούν διαφορετικά για την ίδια θάλασσα.
check('κοινό κατώφλι onshore',
  waveModel.ARRIVAL_ONSHORE_MIN === seaArrival.SEA_ARRIVAL_ONSHORE_MIN,
  `waveModel ${waveModel.ARRIVAL_ONSHORE_MIN} ≠ seaArrival ${seaArrival.SEA_ARRIVAL_ONSHORE_MIN}`);
check('το κατώφλι ανοίγματος υπάρχει και είναι θετικό',
  Number.isFinite(waveModel.ARRIVAL_MIN_FETCH_KM) && waveModel.ARRIVAL_MIN_FETCH_KM > 0);

// ── 2. Η ΣΤΑΛΙΔΑ ΑΝΑΒΕΙ ΤΗ ΔΙΚΛΕΙΔΑ ─────────────────────────────────────────────────────────
// Πραγματικό προφίλ, 21/08/2026: ακτή 24,2°, ewam 0,30 μ. από 322°, ΒΔ τομέας 10,36 χλμ.
const stalida = {
  facingDeg: 24.2,
  sectors: {
    N:  { level: 'exposed',   fetchKm: 25,    blockedRayRatio: 0,   onshore: 0.912,  intensity: 95.6 },
    NE: { level: 'exposed',   fetchKm: 17.08, blockedRayRatio: 0.4, onshore: 0.935,  intensity: 96.7 },
    E:  { level: 'partial',   fetchKm: 3,     blockedRayRatio: 1,   onshore: 0.41,   intensity: 42.3 },
    SE: { level: 'protected', fetchKm: 0.24,  blockedRayRatio: 1,   onshore: -0.355, intensity: 19.3 },
    S:  { level: 'protected', fetchKm: 0,     blockedRayRatio: 1,   onshore: -0.912, intensity: 2.6 },
    SW: { level: 'protected', fetchKm: 0.04,  blockedRayRatio: 1,   onshore: -0.935, intensity: 2 },
    W:  { level: 'protected', fetchKm: 0.28,  blockedRayRatio: 1,   onshore: -0.41,  intensity: 17.7 },
    NW: { level: 'partial',   fetchKm: 10.36, blockedRayRatio: 0.6, onshore: 0.355,  intensity: 58.3 },
  },
  confidence: 'high',
};
check('Σταλίδα: το κύμα από 322° μετράει ως ερχόμενο',
  isSeaArrivingShore({ facingDeg: 24.2, profile: stalida, components: [{ heightM: 0.30, directionDeg: 322 }] }) === true);

// Και το αποτέλεσμα στο νούμερο: με νότιο απόγειο η εκτίμηση τύπωνε το δάπεδο· τώρα σωπαίνει.
const stalidaInput = {
  openWaterWaveHeightM: 0.30,
  windSpeedKmh: 6,
  sector: { fetchKm: 0, blockedRayRatio: 1, onshore: -0.912 },
  confidence: 'high',
  suspectPin: false,
  arrivingSwellPresent: false,
  departingSea: false,
  enclosedDrySector: false,
};
check('Σταλίδα: χωρίς δικλείδα τύπωνε δάπεδο',
  estimateShoreWaveHeightM(stalidaInput) === 0.1,
  `πήρα ${estimateShoreWaveHeightM(stalidaInput)}`);
check('Σταλίδα: με τη δικλείδα σωπαίνει',
  estimateShoreWaveHeightM({ ...stalidaInput, arrivingSea: true }) === undefined);

// ── 3. Ο ΣΧΙΝΙΑΣ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ──────────────────────────────────────────────────────────────
// Οι περιπτώσεις για τις οποίες ΓΡΑΦΤΗΚΕ το shoreWave: ο απόγειος έχει χτίσει ο ίδιος τη θάλασσα
// που βλέπει το κελί, άρα εκείνη φεύγει και η δικλείδα μένει κλειστή. Αν αυτό σπάσει, η αλλαγή
// είναι ανάκληση λειτουργίας, όχι διόρθωση.
const openEverywhere = {
  facingDeg: 173.5,
  sectors: Object.fromEntries(['N','NE','E','SE','S','SW','W','NW'].map(s =>
    [s, { level: 'exposed', fetchKm: 15, blockedRayRatio: 0, onshore: 0.5, intensity: 80 }])),
  confidence: 'high',
};
check('Σχινιάς: θάλασσα χτισμένη από τον απόγειο (21°) ΔΕΝ μετράει ως ερχόμενη',
  isSeaArrivingShore({ facingDeg: 173.5, profile: openEverywhere, components: [{ heightM: 1.1, directionDeg: 21 }] }) === false);
check('Βάι: 295° σε ακτή 85° ΔΕΝ μετράει ως ερχόμενη',
  isSeaArrivingShore({ facingDeg: 85, profile: openEverywhere, components: [{ heightM: 0.6, directionDeg: 295 }] }) === false);
check('Ελαφονήσι: 356° σε ακτή 159,3° ΔΕΝ μετράει ως ερχόμενη',
  isSeaArrivingShore({ facingDeg: 159.3, profile: openEverywhere, components: [{ heightM: 1.22, directionDeg: 356 }] }) === false);

// ── 4. Η ΣΙΩΠΗ ΕΙΝΑΙ Η ΑΣΦΑΛΗΣ ΑΠΑΝΤΗΣΗ ─────────────────────────────────────────────────────
// Ό,τι δεν ξέρουμε μετράει ως «δεν έρχεται», ώστε η άγνοια να αφήνει τα πράγματα όπως ήταν.
check('χωρίς προφίλ → false',
  isSeaArrivingShore({ facingDeg: 24.2, profile: undefined, components: [{ heightM: 1, directionDeg: 322 }] }) === false);
check('χωρίς όψη ακτής → false',
  isSeaArrivingShore({ facingDeg: undefined, profile: stalida, components: [{ heightM: 1, directionDeg: 322 }] }) === false);
check('χωρίς κατεύθυνση κύματος → false',
  isSeaArrivingShore({ facingDeg: 24.2, profile: stalida, components: [{ heightM: 1 }] }) === false);
check('κύμα κάτω από το δάπεδο θορύβου → false',
  isSeaArrivingShore({
    facingDeg: 24.2, profile: stalida,
    components: [{ heightM: DEPARTING_SEA_MIN_COMPONENT_M - 0.01, directionDeg: 322 }],
  }) === false);
check('κενή λίστα συστατικών → false',
  isSeaArrivingShore({ facingDeg: 24.2, profile: stalida, components: [] }) === false);

// ── 5. ΜΟΝΟΔΡΟΜΗ: Η ΔΙΚΛΕΙΔΑ ΜΟΝΟ ΣΩΠΑΙΝΕΙ, ΠΟΤΕ ΔΕΝ ΑΛΛΑΖΕΙ ΝΟΥΜΕΡΟ ────────────────────────
// Η μόνη διαφορά που επιτρέπεται να κάνει η σημαία είναι «αριθμός → σιωπή». Οποιοδήποτε ΑΛΛΟ
// νούμερο θα σήμαινε ότι η δικλείδα άρχισε να υπολογίζει, δηλαδή μπορεί να κατεβάσει κι αυτή.
let seed = 20260821;
const rnd = () => { seed = (Math.imul(1103515245, seed) + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
let fuzzed = 0;
let silenced = 0;
for (let i = 0; i < 20000; i += 1) {
  const input = {
    openWaterWaveHeightM: Number((rnd() * 3).toFixed(2)),
    windSpeedKmh: Number((rnd() * 80).toFixed(1)),
    sector: {
      fetchKm: Number((rnd() * 25).toFixed(2)),
      blockedRayRatio: Number(rnd().toFixed(2)),
      onshore: Number((rnd() * 2 - 1).toFixed(3)),
    },
    confidence: rnd() < 0.8 ? 'high' : 'medium',
    suspectPin: rnd() < 0.1,
    arrivingSwellPresent: rnd() < 0.15,
    departingSea: rnd() < 0.2,
    enclosedDrySector: rnd() < 0.2,
    dryFanWaveM: rnd() < 0.3 ? Number((rnd() * 1.5).toFixed(2)) : undefined,
  };
  const before = estimateShoreWaveHeightM(input);
  const after = estimateShoreWaveHeightM({ ...input, arrivingSea: true });
  fuzzed += 1;
  if (after !== undefined) {
    failures.push(`μονόδρομη: με ανοιχτή δικλείδα επέστρεψε ${after} αντί για σιωπή (${JSON.stringify(input)})`);
    break;
  }
  if (before !== undefined) silenced += 1;
}
check('η δικλείδα σώπασε μια πραγματική εκτίμηση τουλάχιστον μία φορά στο fuzz',
  silenced > 0, `σώπασε ${silenced} από ${fuzzed}`);

// Και το αντίστροφο: κλειστή δικλείδα δεν αλλάζει τίποτα σε σχέση με το να λείπει το πεδίο.
for (let i = 0; i < 5000; i += 1) {
  const input = {
    openWaterWaveHeightM: Number((rnd() * 3).toFixed(2)),
    windSpeedKmh: Number((rnd() * 80).toFixed(1)),
    sector: {
      fetchKm: Number((rnd() * 25).toFixed(2)),
      blockedRayRatio: Number(rnd().toFixed(2)),
      onshore: Number((rnd() * 2 - 1).toFixed(3)),
    },
    confidence: 'high',
    suspectPin: false,
    arrivingSwellPresent: false,
    departingSea: rnd() < 0.2,
    enclosedDrySector: rnd() < 0.2,
  };
  if (estimateShoreWaveHeightM(input) !== estimateShoreWaveHeightM({ ...input, arrivingSea: false })) {
    failures.push('κλειστή δικλείδα άλλαξε αποτέλεσμα — δεν είναι ουδέτερη');
    break;
  }
}

if (failures.length) {
  console.error('❌ Η ΠΥΛΗ ΕΠΕΣΕ');
  for (const f of failures) console.error(`  · ${f}`);
  process.exit(1);
}
console.log(`✅ Η εκτίμηση ακτής σωπαίνει όταν το κύμα έρχεται — ${fuzzed} τυχαίες περιπτώσεις, καμία εξαίρεση.`);
console.log('   Σταλίδα ανάβει · Σχινιάς / Βάι / Ελαφονήσι δεν αγγίζονται · η άγνοια μετράει ως «δεν έρχεται».');
