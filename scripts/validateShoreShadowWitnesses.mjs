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

/**
 * Ο ΜΩΛΟΣ ΠΑΡΟΥ #2040 — ΜΑΡΤΥΡΑΣ ΤΟΥ ΚΡΙΤΗ ΣΤΗΝ ΑΜΜΟ, ΜΟΝΟ ΓΙΑ ΚΥΜΑ 0-30° (11/09/2026, βίβλος §Γ77).
 * Ο Sentinel-2 είδε αφρό θραύσης σε όλο τον κόλπο με κύμα 1,1-1,7 μ. από 16-18°, εκεί που η τσέπη
 * τύπωνε 0,1 του ανοιχτού. Τρεις κανόνες έλεγαν «δεν μπαίνει θάλασσα» (τσέπη, εκτίμηση ακτής, φρουρός
 * όρμου)· αν ξαναμιλήσει έστω ένας, με κάποιον αέρα η κάρτα ξαναγράφει «Θάλασσα λάδι». Γι' αυτό η
 * θάλασσα από 16° δοκιμάζεται με ΤΡΕΙΣ αέρηδες (μελτέμι, δυτικός απόγειος, ελαφρύς), και ένας έλεγχος
 * έξω από το τόξο (νοτιάς πίσω από την Πάρο) πρέπει να μείνει λάδι — η μαρτυρία δεν διαρρέει.
 */
const MOLOS = { id: 2040, region: 'south-aegean-paros' };
const molosDay = ({ windDeg, windKmh, seaDeg, seaM, swellDeg = seaDeg, swellM = 0.25 }) => {
  const wind = { speed: toMs(windKmh), speedBeforeGustFloor: toMs(windKmh), deg: windDeg, gust: toMs(windKmh * 1.2) };
  const item = (hour) => ({ ...hourItem(hour), wind });
  return {
    date: new Date(2026, 7, 29), wind, weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
    temp_min: 26, temp_max: 30, hourly: [item(11), item(13), item(15)],
    marine: { waveHeightM: seaM, wavePeriodS: 5.2, swellWaveHeightM: swellM, swellWaveDirectionDeg: swellDeg, swellWavePeriodS: 3.5,
      waveDirectionDeg: seaDeg, seaSurfaceTemperatureC: 26 },
  };
};
const MOLOS_CASES = [
  // [άνεμος°, χλμ/ώ, θάλασσα°, μ., ελάχιστο τυπωμένο, λέξεις που ΑΠΑΓΟΡΕΥΟΝΤΑΙ, γιατί]
  [0, 24, 16, 1.5, 0.6, ['Θάλασσα λάδι', 'Σχεδόν χωρίς κύμα'], 'μελτέμι + θάλασσα από 16° — η μέρα του δορυφόρου'],
  [270, 24, 16, 1.5, 0.6, ['Θάλασσα λάδι', 'Σχεδόν χωρίς κύμα'], 'δυτικός απόγειος + θάλασσα από 16° — εδώ η εκτίμηση ακτής έσβηνε το κύμα'],
  [20, 15, 18, 1.5, 0.6, ['Θάλασσα λάδι', 'Σχεδόν χωρίς κύμα'], 'ελαφρύς ΒΒΑ 15 χλμ/ώ (φυσάει μέσα στον κόλπο) + θάλασσα από 18° — εδώ ο φρουρός όρμου τύπωνε το SMB (0,11 μ.)'],
];
{
  const raw = findBy(loadJson(`public/data/beaches/${MOLOS.region}.json`), (n) => n.id === MOLOS.id && typeof n.lat === 'number');
  const summary = findBy(loadJson(`public/data/beaches/app/summary/${MOLOS.region}.json`), (n) => n.id === MOLOS.id && n.orientation);
  const profile = findBy(loadJson(`public/data/geospatial/exposure/${MOLOS.region}.json`), (n) => n.beachId === MOLOS.id);
  if (!raw || !summary || !profile) {
    failures.push(`#${MOLOS.id} Μώλος: λείπουν δεδομένα (raw=${!!raw} summary=${!!summary} profile=${!!profile})`);
  } else {
    const beach = {
      id: MOLOS.id, name: summary.name, coordinates: { lat: raw.lat, lon: raw.lon }, region: raw.region,
      protectedFrom: summary.protectedFrom, orientation: summary.orientation, amenities: summary.amenities ?? {},
      waterDepth: summary.waterDepth, metadata: raw.metadata,
    };
    const run = (spec) => {
      const forecast = molosDay(spec);
      const score = calculateBeachScore(beach, forecast, undefined, undefined, {
        weatherSource: 'beach-cluster', hourlyForecast: forecast.hourly, geospatialProfile: profile,
      });
      const readout = buildBeachConditionsReadout({
        beachWindSpeedKmph: spec.windKmh, waveHeightM: score.waveHeightM,
        shoreWaveHeightM: score.shoreWaveHeightM, shoreDisplayWaveM: score.shoreDisplayWaveM,
        seaArrivalExposureLevel: score.seaArrivalExposureLevel, language: 'gr',
      });
      return { score, readout };
    };
    for (const [windDeg, windKmh, seaDeg, seaM, minPrinted, banned, why] of MOLOS_CASES) {
      const { score, readout } = run({ windDeg, windKmh, seaDeg, seaM });
      if (!(readout.waveM >= minPrinted)) failures.push(`#2040 Μώλος (${why}): τυπώνει ${readout.waveM} μ. < ${minPrinted} (${readout.waveText})`);
      if (banned.includes(readout.waveWord)) failures.push(`#2040 Μώλος (${why}): λέξη «${readout.waveWord}» — ο δορυφόρος είδε κύμα να σκάει`);
      if (!(score.shoreShadowDamping >= 0.5)) failures.push(`#2040 Μώλος (${why}): K_d ${score.shoreShadowDamping} < 0,5 μέσα στο τόξο`);
    }
    // έξω από το τόξο: νοτιάς πίσω από όλη την Πάρο — η μαρτυρία ΔΕΝ ισχύει, η βαθιά σκιά μένει
    const control = run({ windDeg: 270, windKmh: 24, seaDeg: 180, seaM: 1.5 });
    if (control.readout.waveWord !== 'Θάλασσα λάδι') failures.push(`#2040 Μώλος (ΕΛΕΓΧΟΣ νοτιάς 180°): λέξη «${control.readout.waveWord}» — η μαρτυρία των 0-30° διέρρευσε`);
    if (!(control.score.shoreShadowDamping <= 0.12)) failures.push(`#2040 Μώλος (ΕΛΕΓΧΟΣ νοτιάς 180°): K_d ${control.score.shoreShadowDamping} — η βαθιά σκιά πίσω από το νησί χάθηκε`);

    /**
     * Η ΙΔΙΟΤΗΤΑ ΤΟΥ ΔΑΠΕΔΟΥ, ΣΕ ΟΛΟ ΤΟΝ ΚΥΚΛΟ (11/09/2026, μετά το replay των ημερών του δορυφόρου).
     * Η μαρτυρία υπόσχεται ένα πράγμα: «όπως θα έλεγε χωρίς μάρτυρα, ποτέ κάτω από το μισό του
     * ανοιχτού». Η πρώτη εκδοχή το παρέβαινε προς τα ΠΑΝΩ (ολόκληρο ύψος στις 0-10° με μελτέμι, λέξη που
     * πηδούσε στο 0°/359°) και καμία πύλη δεν το έβλεπε. Εδώ κάθε σενάριο τρέχει ΜΕ και ΧΩΡΙΣ το τόξο
     * (το ίδιο Map του utils/seaArrival, σβηστό και ξαναβαλμένο αμέσως): έξω από το τόξο ΑΚΡΙΒΩΣ ίδια
     * οθόνη· μέσα ποτέ χαμηλότερο, ποτέ πάνω από max(πριν, μισό της θάλασσας), ποτέ ηπιότερη ετυμηγορία.
     */
    const { JUDGE_WITNESSED_ARRIVAL_ARCS, WITNESSED_SEA_SHORE_FRACTION } = require(path.join(root, 'utils/seaArrival.ts'));
    const arc = JUDGE_WITNESSED_ARRIVAL_ARCS.get(MOLOS.id);
    const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
    const VERDICT_SEVERITY = { good: 0, caution: 1, avoid_swimming: 2 };
    const sweep = { runs: 0, leaks: 0, lowered: 0, overshoot: 0, milder: 0, floored: 0, examples: [] };
    const sweepDirs = [...Array.from({ length: 72 }, (_, i) => i * 5), 1, 2, 3, 4, 29, 31, 359];
    // null = ο άνεμος από τη μεριά του κύματος (μελτέμι)· 270/180/90 = δυτικός, νοτιάς, ανατολικός
    const sweepWinds = [[null, 15], [null, 25], [null, 35], [270, 20], [180, 20], [90, 12]];
    for (const seaDeg of sweepDirs) for (const seaM of [0.5, 1.1, 2.3]) for (const [wd, windKmh] of sweepWinds) {
      const spec = { windDeg: wd ?? seaDeg, windKmh, seaDeg, seaM };
      const after = run(spec);
      JUDGE_WITNESSED_ARRIVAL_ARCS.delete(MOLOS.id);
      let before;
      try { before = run(spec); } finally { JUDGE_WITNESSED_ARRIVAL_ARCS.set(MOLOS.id, arc); }
      sweep.runs += 1;
      const a = after.readout.waveM ?? 0;
      const b = before.readout.waveM ?? 0;
      const where = `θάλασσα ${seaDeg}° ${seaM} μ. · άνεμος ${spec.windDeg}° ${windKmh} χλμ/ώ: ${b} → ${a} μ.`;
      const note = (e) => { if (sweep.examples.length < 6) sweep.examples.push(e); };
      if (angDist(seaDeg, arc.centerDeg) > arc.halfWidthDeg) {
        if (a !== b || after.readout.waveWord !== before.readout.waveWord || after.score.swimmingComfort !== before.score.swimmingComfort) {
          sweep.leaks += 1; note(`ΔΙΑΡΡΟΗ ${where}`);
        }
        continue;
      }
      if (a > b) sweep.floored += 1;
      if (a < b - 1e-9) { sweep.lowered += 1; note(`ΧΑΜΗΛΟΤΕΡΑ ${where}`); }
      // +0,051: το τυπωμένο στρογγυλεύει στο δέκατο
      // Εδώ ΟΛΗ η θάλασσα μπαίνει από το τόξο (κύμα και ρεστία από το seaDeg), άρα το όριο είναι το μισό
      // της ανοιχτής — το ίδιο που δίνει το πάτωμα K_d του μάρτυρα (shoreSeaStateM × 0,5), και που με
      // δυνατό άνεμο στο ίδιο τόξο περιλαμβάνει και το κύμα του ανέμου. Το αυστηρότερο «μισό του ΜΙΚΡΟΥ
      // συστατικού» κρίνεται στις μικτές θάλασσες πιο κάτω.
      const floorM = WITNESSED_SEA_SHORE_FRACTION * after.score.seaStateWaveM;
      if (a > Math.max(b, floorM) + 0.051) { sweep.overshoot += 1; note(`ΠΑΝΩ ΑΠΟ ΤΟ ΜΙΣΟ ${where} (δάπεδο ${floorM})`); }
      if ((VERDICT_SEVERITY[after.score.swimmingComfort] ?? 0) < (VERDICT_SEVERITY[before.score.swimmingComfort] ?? 0)) { sweep.milder += 1; note(`ΗΠΙΟΤΕΡΗ ΕΤΥΜΗΓΟΡΙΑ ${where}`); }
      // Και ο αριθμός που ΚΡΙΝΕΙ την ετυμηγορία (score.shoreDisplayWaveM = seaAtShoreM), όχι μόνο ο
      // τυπωμένος: ο τυπωμένος κόβεται από το ταβάνι του φρουρού, οπότε ένας διακόπτης στο σκέλος της
      // ετυμηγορίας περνούσε αόρατος (σαμποτάζ 11/09).
      const sa = after.score.shoreDisplayWaveM;
      const sb = before.score.shoreDisplayWaveM;
      if (typeof sa === 'number' && typeof sb === 'number') {
        if (sa < sb - 1e-9) { sweep.lowered += 1; note(`ΧΑΜΗΛΟΤΕΡΑ (ακτή) ${where}: ${sb} → ${sa}`); }
        if (sa > Math.max(sb, floorM) + 0.011) { sweep.overshoot += 1; note(`ΠΑΝΩ ΑΠΟ ΤΟ ΜΙΣΟ (ακτή) ${where}: ${sb} → ${sa}`); }
      }
    }
    if (sweep.leaks) failures.push(`#2040 Μώλος: η μαρτυρία άλλαξε την οθόνη ΕΞΩ από το τόξο σε ${sweep.leaks}/${sweep.runs} σενάρια — ${sweep.examples.join(' · ')}`);
    if (sweep.lowered) failures.push(`#2040 Μώλος: η μαρτυρία ΚΑΤΕΒΑΣΕ το τυπωμένο σε ${sweep.lowered} σενάρια — ${sweep.examples.join(' · ')}`);
    if (sweep.overshoot) failures.push(`#2040 Μώλος: η μαρτυρία ανέβασε το τυπωμένο ΠΑΝΩ από max(πριν, μισό) σε ${sweep.overshoot} σενάρια — δάπεδο, όχι διακόπτης — ${sweep.examples.join(' · ')}`);
    if (sweep.milder) failures.push(`#2040 Μώλος: ηπιότερη ετυμηγορία με τη μαρτυρία σε ${sweep.milder} σενάρια — ${sweep.examples.join(' · ')}`);
    if (!sweep.floored) failures.push('#2040 Μώλος: σε κανένα σενάριο η μαρτυρία δεν ανέβασε το τυπωμένο — το δάπεδο δεν ασκείται, η πύλη είναι τυφλή');
    console.log(`   Μώλος, όλος ο κύκλος: ${sweep.runs} σενάρια · το δάπεδο ανέβασε ${sweep.floored} · διαρροές ${sweep.leaks} · χαμηλότερα ${sweep.lowered} · πάνω από το μισό ${sweep.overshoot} · ηπιότερη ετυμηγορία ${sweep.milder}`);

    // ΜΙΚΤΗ ΘΑΛΑΣΣΑ (ελεγκτής 11/09): 2-3 μ. από νότο/δύση (πίσω από την Πάρο, K_d 0,1) ΚΑΙ ένα
    // φουσκωματάκι 0,15-0,2 μ. από το τόξο. Η πρώτη εκδοχή του δαπέδου έπαιρνε το μισό ΟΛΟΥ του
    // πελάγους (0,1 → 1,0-1,5 μ., «μην κολυμπήσεις»). Το δάπεδο ανήκει στο συστατικό που μπαίνει.
    const MIXED = [
      { windDeg: 180, windKmh: 30, seaDeg: 180, seaM: 2.0, swellDeg: 15, swellM: 0.15 },
      { windDeg: 270, windKmh: 30, seaDeg: 270, seaM: 3.0, swellDeg: 15, swellM: 0.15 },
      { windDeg: 270, windKmh: 20, seaDeg: 180, seaM: 2.5, swellDeg: 20, swellM: 0.2 },
    ];
    for (const spec of MIXED) {
      const after = run(spec);
      JUDGE_WITNESSED_ARRIVAL_ARCS.delete(MOLOS.id);
      let before;
      try { before = run(spec); } finally { JUDGE_WITNESSED_ARRIVAL_ARCS.set(MOLOS.id, arc); }
      const what = `μικτή: ${spec.seaM} μ. από ${spec.seaDeg}° + ${spec.swellM} μ. από ${spec.swellDeg}°`;
      if (!after.score.witnessedArrivalSea) failures.push(`#2040 Μώλος (${what}): η μαρτυρία δεν άναψε — η περίπτωση δεν ασκείται`);
      const capM = Math.max(before.readout.waveM ?? 0, WITNESSED_SEA_SHORE_FRACTION * spec.swellM) + 0.051;
      if ((after.readout.waveM ?? 0) > capM) failures.push(`#2040 Μώλος (${what}): τυπώνει ${after.readout.waveM} μ. (χωρίς μάρτυρα ${before.readout.waveM}) — το δάπεδο πήρε το μισό ΟΛΟΥ του πελάγους`);
      if (after.score.swimmingComfort !== before.score.swimmingComfort) failures.push(`#2040 Μώλος (${what}): ετυμηγορία ${before.score.swimmingComfort} → ${after.score.swimmingComfort} από ένα φουσκωματάκι 0,${String(spec.swellM).split('.')[1]} μ.`);
    }
  }
}

/**
 * ΚΑΛΟ ΛΙΜΑΝΙ ΛΕΣΒΟΥ #1334 — ΜΑΡΤΥΡΑΣ ΗΡΕΜΙΑΣ (11/09/2026, βίβλος §Γ79-Β). Το ΑΝΤΙΘΕΤΟ του Μώλου: ο
 * δορυφόρος είδε 29 μέρες ΒΒΔ χωρίς αφρό στον δυτικό όρμο, και η εφαρμογή τύπωνε ολόκληρο το πέλαγος.
 * Εδώ η διόρθωση ΚΑΤΕΒΑΖΕΙ νούμερα — η επικίνδυνη κατεύθυνση — άρα η πύλη κρίνει τα φρένα, όχι μόνο το
 * αποτέλεσμα. Κάθε σενάριο ΜΕ και ΧΩΡΙΣ το τόξο ηρεμίας (το Map του utils/seaArrival):
 *   έξω από το 341°-7° ΑΚΡΙΒΩΣ ίδια οθόνη · μέσα ΠΟΤΕ ψηλότερο νούμερο · ΠΟΤΕ δεν χάνεται «μην κολυμπήσεις»
 *   · ΠΟΤΕ δεν χάνεται η προειδοποίηση θραύσης · όταν μιλάει το μοντέλο ανέμου ή ο άνεμος είναι 'exposed',
 *   ΑΚΡΙΒΩΣ ίδια οθόνη. Και καμία άλλη παραλία της Λέσβου δεν αλλάζει.
 */
{
  const KL = { id: 1334, region: 'north-aegean-lesvos' };
  const raw = findBy(loadJson(`public/data/beaches/${KL.region}.json`), (n) => n.id === KL.id && typeof n.lat === 'number');
  const summary = findBy(loadJson(`public/data/beaches/app/summary/${KL.region}.json`), (n) => n.id === KL.id && n.orientation);
  const profilesPayload = loadJson(`public/data/geospatial/exposure/${KL.region}.json`);
  const profile = findBy(profilesPayload, (n) => n.beachId === KL.id);
  if (!raw || !summary || !profile) {
    failures.push(`#${KL.id} Καλό Λιμάνι: λείπουν δεδομένα (raw=${!!raw} summary=${!!summary} profile=${!!profile})`);
  } else {
    const { CALM_WITNESSED_ARRIVAL_ARCS } = require(path.join(root, 'utils/seaArrival.ts'));
    const calmArc = CALM_WITNESSED_ARRIVAL_ARCS.get(KL.id);
    const angDistKL = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
    const beach = {
      id: KL.id, name: summary.name, coordinates: { lat: raw.lat, lon: raw.lon }, region: raw.region,
      protectedFrom: summary.protectedFrom, orientation: summary.orientation, amenities: summary.amenities ?? {},
      waterDepth: summary.waterDepth, metadata: raw.metadata,
    };
    const scoreOf = (b, p, spec) => {
      const forecast = molosDay(spec);
      return calculateBeachScore(b, forecast, undefined, undefined, { weatherSource: 'beach-cluster', hourlyForecast: forecast.hourly, geospatialProfile: p });
    };
    const runKL = (spec) => {
      const score = scoreOf(beach, profile, spec);
      const readout = buildBeachConditionsReadout({
        beachWindSpeedKmph: spec.windKmh, waveHeightM: score.waveHeightM, shoreWaveHeightM: score.shoreWaveHeightM,
        shoreDisplayWaveM: score.shoreDisplayWaveM, seaArrivalExposureLevel: score.seaArrivalExposureLevel, language: 'gr',
      });
      return { score, readout };
    };
    const withoutCalmArc = (fn) => {
      CALM_WITNESSED_ARRIVAL_ARCS.delete(KL.id);
      try { return fn(); } finally { CALM_WITNESSED_ARRIVAL_ARCS.set(KL.id, calmArc); }
    };
    const hasShoreBreak = (s) => (s.warnings ?? []).some((w) => w?.type === 'shore_break');
    const k = { runs: 0, leaks: 0, higher: 0, lowered: 0, avoidLost: 0, shoreBreakLost: 0, guardLeak: 0, examples: [] };
    const noteKL = (e) => { if (k.examples.length < 6) k.examples.push(e); };
    const dirs = [...Array.from({ length: 72 }, (_, i) => i * 5), 339, 340, 341, 342, 352, 353, 6, 7, 8, 9];
    const winds = [[null, 15], [null, 25], [null, 35], [20, 20], [270, 20], [180, 20], [90, 12]];
    for (const seaDeg of dirs) for (const seaM of [0.6, 1.1, 1.7]) for (const [wd, windKmh] of winds) {
      const spec = { windDeg: wd ?? seaDeg, windKmh, seaDeg, seaM };
      const after = runKL(spec);
      const before = withoutCalmArc(() => runKL(spec));
      k.runs += 1;
      const a = after.readout.waveM ?? 0;
      const b = before.readout.waveM ?? 0;
      const where = `θάλασσα ${seaDeg}° ${seaM} μ. · άνεμος ${spec.windDeg}° ${windKmh} χλμ/ώ: ${b} → ${a} μ., ${before.score.swimmingComfort} → ${after.score.swimmingComfort}`;
      const same = a === b && after.readout.waveWord === before.readout.waveWord
        && after.score.swimmingComfort === before.score.swimmingComfort
        && after.score.seaArrivalExposureLevel === before.score.seaArrivalExposureLevel;
      if (angDistKL(seaDeg, calmArc.centerDeg) > calmArc.halfWidthDeg) {
        if (!same) { k.leaks += 1; noteKL(`ΔΙΑΡΡΟΗ ${where}`); }
        continue;
      }
      if ((before.score.seaStateSource === 'modeled' || before.score.exposureLevel === 'exposed') && !same) { k.guardLeak += 1; noteKL(`ΦΡΑΧΤΗΣ ΑΝΕΜΟΥ ${where}`); }
      if (a > b + 1e-9) { k.higher += 1; noteKL(`ΨΗΛΟΤΕΡΑ ${where}`); }
      if (a < b - 1e-9) k.lowered += 1;
      if (before.score.swimmingComfort === 'avoid_swimming' && after.score.swimmingComfort !== 'avoid_swimming') { k.avoidLost += 1; noteKL(`ΕΣΒΗΣΕ «μην κολυμπήσεις» ${where}`); }
      if (hasShoreBreak(before.score) && !hasShoreBreak(after.score)) { k.shoreBreakLost += 1; noteKL(`ΕΣΒΗΣΕ ΘΡΑΥΣΗ ${where}`); }
    }
    if (k.leaks) failures.push(`#1334 Καλό Λιμάνι: ο μάρτυρας ηρεμίας άλλαξε την οθόνη ΕΞΩ από το τόξο σε ${k.leaks} σενάρια — ${k.examples.join(' · ')}`);
    if (k.guardLeak) failures.push(`#1334 Καλό Λιμάνι: ο μάρτυρας ηρεμίας μίλησε ενώ ο αριθμός ήταν κύμα ανέμου ή ο άνεμος 'exposed' (${k.guardLeak}) — ${k.examples.join(' · ')}`);
    if (k.higher) failures.push(`#1334 Καλό Λιμάνι: ο μάρτυρας ηρεμίας ΑΝΕΒΑΣΕ νούμερο (${k.higher}) — ${k.examples.join(' · ')}`);
    if (k.avoidLost) failures.push(`#1334 Καλό Λιμάνι: ο μάρτυρας ηρεμίας έσβησε «μην κολυμπήσεις» (${k.avoidLost}) — το φρένο δεν έπιασε — ${k.examples.join(' · ')}`);
    if (k.shoreBreakLost) failures.push(`#1334 Καλό Λιμάνι: ο μάρτυρας ηρεμίας έσβησε προειδοποίηση θραύσης (${k.shoreBreakLost}) — ${k.examples.join(' · ')}`);
    if (!k.lowered) failures.push('#1334 Καλό Λιμάνι: σε κανένα σενάριο δεν κατέβηκε το νούμερο — ο μάρτυρας δεν ασκείται, η πύλη είναι τυφλή');

    // Καμία άλλη παραλία της Λέσβου: ΒΒΔ θάλασσες μέσα στο τόξο, με και χωρίς.
    let othersChanged = 0;
    const lesvosBeaches = loadJson(`public/data/beaches/app/${KL.region}.json`).island?.beaches ?? [];
    const lesvosProfiles = profilesPayload.profiles ?? {};
    for (const spec of [{ windDeg: 350, windKmh: 25, seaDeg: 345, seaM: 1.4 }, { windDeg: 0, windKmh: 20, seaDeg: 355, seaM: 1.1 },
      { windDeg: 10, windKmh: 30, seaDeg: 5, seaM: 1.7 }, { windDeg: 330, windKmh: 15, seaDeg: 342, seaM: 0.8 }]) {
      for (const b of lesvosBeaches) {
        if (b.id === KL.id) continue;
        const p = lesvosProfiles[String(b.id)];
        if (!p) continue;
        const sa = scoreOf(b, p, spec);
        const sb = withoutCalmArc(() => scoreOf(b, p, spec));
        if (sa.waveHeightM !== sb.waveHeightM || sa.shoreDisplayWaveM !== sb.shoreDisplayWaveM
          || sa.swimmingComfort !== sb.swimmingComfort || sa.seaArrivalExposureLevel !== sb.seaArrivalExposureLevel) othersChanged += 1;
      }
    }
    if (othersChanged) failures.push(`#1334 Καλό Λιμάνι: ο μάρτυρας ηρεμίας άλλαξε ${othersChanged} ΑΛΛΕΣ παραλίες της Λέσβου`);
    console.log(`   Καλό Λιμάνι, όλος ο κύκλος: ${k.runs} σενάρια · χαμηλότερα ${k.lowered} · διαρροές ${k.leaks} · φράχτης ανέμου ${k.guardLeak} · ψηλότερα ${k.higher} · χάθηκε «μην κολυμπήσεις» ${k.avoidLost} · χάθηκε θραύση ${k.shoreBreakLost} · άλλες παραλίες ${othersChanged}`);
  }
}

if (failures.length) {
  console.error(`FAILED: ${failures.length} μάρτυρας/ες διαφωνούν με τις κάμερες της 29/08/2026:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('PASSED: και οι 7 μάρτυρες της 29/08/2026 συμφωνούν με τις κάμερες — Βάι/Κιτροπλατεία/Αλμυρός ανέβηκαν, Λίνδος ηρέμησε, οι τρεις απάνεμες αμετάβλητες· Μώλος #2040 (δορυφόρος): κύμα με κάθε αέρα στις 0-30°, λάδι με νοτιά.');
