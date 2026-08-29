#!/usr/bin/env node
/**
 * ΟΙ ΕΦΤΑ ΜΑΡΤΥΡΕΣ ΤΗΣ ΣΚΙΑΣ — πύλη πάνω σε μαρτυρία καμερών (29/08/2026).
 *
 * ΤΙ ΦΥΛΑΕΙ. Στις 29/08/2026 ήρθαν τέσσερις αναφορές από webcam μέσα σε μία ώρα, και οι
 * τέσσερις από το ίδιο έλλειμμα: το ποιος δικαιούται την έκπτωση σκιάς (K_d) κρινόταν από
 * ΓΩΝΙΕΣ, ενώ το σωστό ερώτημα είναι «πόσο νερό μπορεί να φτάσει εδώ». Μπήκαν δύο διορθώσεις
 * (και οι δύο στο utils/seaArrival + utils/waveCharacter — εκεί το πλήρες σκεπτικό):
 *
 *   • το πάτωμα της πλάγιας θάλασσας: ακτή με πόρτα ≥10 χλμ και θάλασσα που δεν φεύγει καθαρά
 *     (onshore > −0,65) δεν εκπίπτει βαθύτερα από την άκρη της σκιάς (K_d ≥ 0,5)·
 *   • το 'enclosed': τσέπη χωρίς καμία πόρτα ≥10 χλμ και χωρίς νερό ≥2 χλμ στη γωνία της
 *     άφιξης παίρνει την έκπτωση που η μηχανή είχε ήδη υπολογίσει, ό,τι κι αν λέει ο τομέας
 *     του ανέμου.
 *
 * Η ΜΟΝΗ ΑΛΗΘΕΙΑ ΓΙΑ ΜΙΑ ΑΚΤΗ ΕΙΝΑΙ ΜΑΤΙΑ ΚΑΙ ΚΑΜΕΡΕΣ (utils/shoreWave: «δεν υπάρχει κριτής
 * για μια ακτογραμμή»). Γι' αυτό η πύλη δεν ελέγχει τύπους — ξαναπαίζει τους ΕΦΤΑ μάρτυρες
 * μέσα από τον ΠΡΑΓΜΑΤΙΚΟ κινητήρα (calculateBeachScore) και το πραγματικό readout της
 * κάρτας, με τα κομμιταρισμένα προφίλ τους, σε καρφωμένο σενάριο μελτεμιού:
 *
 *   ΟΙ ΤΕΣΣΕΡΙΣ ΤΗΣ ΑΝΑΦΟΡΑΣ (η κάμερα διαφωνούσε με την οθόνη):
 *     Βάι #730          έλεγε «θάλασσα λάδι»   → η κάμερα έδειχνε σπάσιμο κύματος
 *     Κιτροπλατεία #746 έλεγε «θάλασσα λάδι»   → «δεν είναι λάδι»
 *     Αλμυρός #720      έλεγε «θάλασσα λάδι»*  → «δεν είναι λάδι» (*στο ζωντανό της ώρας)
 *     Λίνδος #2443      έλεγε «1,1 μ. αρκετό κύμα» + «μην κολυμπήσεις» → λάδι, με λουόμενους
 *
 *   ΟΙ ΤΡΕΙΣ ΤΟΥ ΕΛΕΓΧΟΥ (γνήσια απάνεμες σε μελτέμι — η θάλασσα ΦΕΥΓΕΙ από πάνω τους,
 *   onshore −0,77…−1,00, και πρέπει να ΜΕΙΝΟΥΝ ήρεμες, αλλιώς η διόρθωση αγρίεψε τη μισή
 *   χώρα για να σώσει τέσσερις): Πρέβελη #704 · Κουκουναριές #2638 · Γέρακας #1209.
 *
 * ΤΙ ΔΕΝ ΕΛΕΓΧΕΙ, ΕΠΙΤΗΔΕΣ: την ετυμηγορία των τεσσάρων. Στη Λίνδο το «μην κολυμπήσεις»
 * του σεναρίου το κρατούν οι ποινές ΑΝΕΜΟΥ στο swim score (απόφαση 10/08: η προστασία δεν
 * αγοράζει ανακούφιση από αέρα/ριπές/τσοπ) — άλλο θέμα, με δικό του ιστορικό, που δεν
 * επιτρέπεται να κριθεί παρεμπιπτόντως από αυτή την πύλη. Εδώ κρίνεται ο ΑΡΙΘΜΟΣ και η
 * ΛΕΞΗ — αυτά διέψευδαν οι κάμερες.
 *
 * ΑΝ ΣΠΑΣΕΙ: μη ρυθμίσεις το σενάριο για να πρασινίσει. Ή άλλαξε ο κώδικας της σκιάς (τρέξε
 * scripts/probeShoreWaveChain.mjs στους μάρτυρες και δες ποιο σκαλί γύρισε), ή άλλαξαν τα
 * ψημένα προφίλ (scripts/buildGeospatialExposureProfiles) — και στις δύο περιπτώσεις η
 * μαρτυρία των καμερών της 29/08 εξακολουθεί να ισχύει.
 *
 *   node scripts/validateShoreShadowWitnesses.mjs
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

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { SEA_ARRIVAL_ENCLOSED } = require(path.join(root, 'utils/waveCharacter.ts'));

const loadJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const findBy = (payload, pred) => {
  let hit = null;
  const walk = (n) => {
    if (hit) return;
    if (Array.isArray(n)) { n.forEach(walk); return; }
    if (!n || typeof n !== 'object') return;
    if (pred(n)) { hit = n; return; }
    Object.values(n).forEach(walk);
  };
  walk(payload); return hit;
};

/**
 * ΤΟ ΣΕΝΑΡΙΟ ΕΙΝΑΙ ΚΑΡΦΩΜΕΝΟ ΚΑΙ ΚΟΙΝΟ ΓΙΑ ΟΛΟΥΣ: μελτέμι 24 χλμ/ώ από Β, κελί 1,1 μ. από
 * Β με κοντή περίοδο (4,5 s) και κοντό swell 0,25/3,5 s — δηλαδή καθαρή ανεμοθάλασσα, χωρίς
 * αποθαλασσιά που θα άνοιγε άλλες πύλες (arrivingSwell, ground swell). Οι τιμές-στόχοι
 * παρακάτω μετρήθηκαν στις 29/08/2026 πάνω σε αυτό ακριβώς το σενάριο.
 */
const WIND_KMH = 24;
const toMs = (kmh) => kmh / 3.6;
const hourItem = (hour) => ({
  dt: Math.floor(new Date(2026, 7, 29, hour, 0, 0).getTime() / 1000),
  dt_txt: `2026-08-29 ${String(hour).padStart(2, '0')}:00:00`,
  main: { temp: 28, temp_min: 26, temp_max: 30, pressure: 1008, sea_level: 1008, grnd_level: 1008, humidity: 50, temp_kf: 0 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  clouds: { all: 0 },
  wind: { speed: toMs(WIND_KMH), speedBeforeGustFloor: toMs(WIND_KMH), deg: 0, gust: toMs(WIND_KMH * 1.2) },
  visibility: 10000, pop: 0, sys: { pod: 'd' },
});
const meltemiDay = () => ({
  date: new Date(2026, 7, 29),
  wind: { speed: toMs(WIND_KMH), speedBeforeGustFloor: toMs(WIND_KMH), deg: 0, gust: toMs(WIND_KMH * 1.2) },
  weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
  temp_min: 26, temp_max: 30,
  hourly: [hourItem(11), hourItem(13), hourItem(15)],
  marine: { waveHeightM: 1.1, wavePeriodS: 4.5, swellWaveHeightM: 0.25, swellWaveDirectionDeg: 0, swellWavePeriodS: 3.5, waveDirectionDeg: 0, seaSurfaceTemperatureC: 26 },
});

/**
 * [id, περιοχή, αναμενόμενη λέξη, έλεγχοι πέρα από τη λέξη, γιατί]
 * Η «λέξη» είναι το waveWord της κάρτας — ό,τι διάβασε και διέψευσε ο άνθρωπος στην κάμερα.
 */
const WITNESSES = [
  [730, 'crete-crete-lasithi', 'Λίγο κύμα', { kdMin: 0.5 },
    'Βάι — κάμερα 29/08: σπάσιμο κύματος κάτω από «θάλασσα λάδι»· πόρτα 16,3 χλμ, το μελτέμι περνάει πλάγια'],
  [746, 'crete-crete-lasithi', 'Λίγο κύμα', { kdMin: 0.5 },
    'Κιτροπλατεία — αναφορά 29/08: «δεν είναι λάδι»· πόρτα 12,5 χλμ'],
  [720, 'crete-crete-lasithi', 'Σχεδόν χωρίς κύμα', { kdMin: 0.5 },
    'Αλμυρός — αναφορά 29/08: «δεν είναι λάδι»· το τυπωμένο εδώ το δίνει η βεντάλια (0,2), το πάτωμα κρατά το K_d=0,5'],
  [2443, 'south-aegean-rhodes', 'Θάλασσα λάδι', { arrival: SEA_ARRIVAL_ENCLOSED, shoreMaxM: 0.2 },
    'Λίνδος — κάμερα 29/08: λάδι με λουόμενους κάτω από «1,1 μ. αρκετό κύμα»· τσέπη (μέγιστη πόρτα 5,3 χλμ)'],
  [704, 'crete-crete-rethymno', 'Θάλασσα λάδι', { kdMax: 0.12, verdictNotAvoid: true },
    'Πρέβελη — ΕΛΕΓΧΟΣ: κοιτάει 156°, η βόρεια θάλασσα φεύγει (onshore −0,92), η βαθιά σκιά της είναι σωστή'],
  [2638, 'thessaly-skiathos', 'Θάλασσα λάδι', { kdMax: 0.12, verdictNotAvoid: true },
    'Κουκουναριές — ΕΛΕΓΧΟΣ: onshore −1,00, πρέπει να μείνει λάδι'],
  [1209, 'ionian-islands-zakynthos', 'Θάλασσα λάδι', { kdMax: 0.12, verdictNotAvoid: true },
    'Γέρακας — ΕΛΕΓΧΟΣ: onshore −0,77, ο πλησιέστερος στο κατώφλι −0,65 — αν αγριέψει, το κατώφλι μετακινήθηκε'],
];

const failures = [];
for (const [beachId, regionFile, expectedWord, checks, why] of WITNESSES) {
  const raw = findBy(loadJson(`public/data/beaches/${regionFile}.json`), (n) => n.id === beachId && typeof n.lat === 'number');
  const summary = findBy(loadJson(`public/data/beaches/app/summary/${regionFile}.json`), (n) => n.id === beachId && n.orientation);
  const profile = findBy(loadJson(`public/data/geospatial/exposure/${regionFile}.json`), (n) => n.beachId === beachId);
  if (!raw || !summary || !profile) { failures.push(`#${beachId}: λείπουν δεδομένα (raw=${!!raw} summary=${!!summary} profile=${!!profile})`); continue; }

  const beach = {
    id: beachId, name: summary.name, coordinates: { lat: raw.lat, lon: raw.lon },
    region: raw.region, protectedFrom: summary.protectedFrom, orientation: summary.orientation,
    amenities: summary.amenities ?? {}, waterDepth: summary.waterDepth, metadata: raw.metadata,
  };
  const forecast = meltemiDay();
  const score = calculateBeachScore(beach, forecast, undefined, undefined, {
    weatherSource: 'beach-cluster', hourlyForecast: forecast.hourly, geospatialProfile: profile,
  });
  const readout = buildBeachConditionsReadout({
    beachWindSpeedKmph: WIND_KMH, waveHeightM: 1.1,
    shoreWaveHeightM: score.shoreWaveHeightM, shoreDisplayWaveM: score.shoreDisplayWaveM,
    seaArrivalExposureLevel: score.seaArrivalExposureLevel, language: 'gr',
  });

  const name = summary.name?.gr ?? beachId;
  if (readout.waveWord !== expectedWord) {
    failures.push(`#${beachId} ${name}: λέξη «${readout.waveWord}» ≠ «${expectedWord}» (${readout.waveText}) — ${why}`);
  }
  if (checks.kdMin !== undefined && !(score.shoreShadowDamping >= checks.kdMin)) {
    failures.push(`#${beachId} ${name}: K_d ${score.shoreShadowDamping} < ${checks.kdMin} — το πάτωμα της πλάγιας θάλασσας δεν έπιασε`);
  }
  if (checks.kdMax !== undefined && !(score.shoreShadowDamping <= checks.kdMax)) {
    failures.push(`#${beachId} ${name}: K_d ${score.shoreShadowDamping} > ${checks.kdMax} — η βαθιά σκιά της απάνεμης χάθηκε (η θάλασσα ΦΕΥΓΕΙ από εδώ)`);
  }
  if (checks.arrival !== undefined && score.seaArrivalExposureLevel !== checks.arrival) {
    failures.push(`#${beachId} ${name}: άφιξη «${score.seaArrivalExposureLevel}» ≠ «${checks.arrival}»`);
  }
  if (checks.shoreMaxM !== undefined && !(score.shoreDisplayWaveM <= checks.shoreMaxM)) {
    failures.push(`#${beachId} ${name}: ακτή ${score.shoreDisplayWaveM} μ. > ${checks.shoreMaxM} — η τσέπη ξαναπληρώνει το πέλαγος`);
  }
  if (checks.verdictNotAvoid && score.swimmingComfort === 'avoid_swimming') {
    failures.push(`#${beachId} ${name}: ετυμηγορία «μην κολυμπήσεις» σε γνήσια απάνεμη — η διόρθωση αγρίεψε λάθος πληθυσμό`);
  }
}

if (failures.length) {
  console.error(`FAILED: ${failures.length} μάρτυρας/ες διαφωνούν με τις κάμερες της 29/08/2026:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASSED: και οι 7 μάρτυρες της 29/08/2026 συμφωνούν με τις κάμερες — Βάι/Κιτροπλατεία/Αλμυρός ανέβηκαν, Λίνδος ηρέμησε, οι τρεις απάνεμες αμετάβλητες.');
