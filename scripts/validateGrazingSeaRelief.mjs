#!/usr/bin/env node
/**
 * Η ΘΑΛΑΣΣΑ ΠΟΥ ΠΕΡΝΑΕΙ ΞΥΣΤΑ ΡΙΧΝΕΙ ΑΡΙΘΜΟ, ΠΟΤΕ ΠΡΟΕΙΔΟΠΟΙΗΣΗ (βίβλος §Γ59, 22/08/2026).
 *
 * ΤΙ ΦΥΛΑΕΙ. Στις 22/08/2026 μια ακτή με έκθεση 'partial' απέκτησε την έκπτωση ×0,5 όταν η
 * θάλασσα έρχεται ≥90° από την κάθετό της — δηλαδή περνάει παράλληλα ή φεύγει. Η εφαρμογή το
 * ήξερε ήδη και το χρησιμοποιούσε ΜΟΝΟ για να αρνηθεί έκπτωση, ποτέ για να τη δώσει.
 *
 * Η αλλαγή αγγίζει τον αριθμό που τυπώνεται στην κάρτα, στον χάρτη και στη σελίδα της
 * παραλίας. Πέντε πράγματα πρέπει να μείνουν αληθινά για πάντα:
 *
 *   Α. ΜΟΝΟ 'partial' ΜΕ ΞΥΣΤΗ ΘΑΛΑΣΣΑ. Ούτε 'exposed', ούτε τυφλότητα ('unknown'), ούτε η
 *      παλιά σιωπή (`undefined`) κερδίζουν κάτι καινούργιο.
 *   Β. ΜΟΝΟΔΡΟΜΟ. Σε ΚΑΜΙΑ συνθήκη το ύψος ακτής δεν βγαίνει μεγαλύτερο απ' ό,τι έβγαινε πριν.
 *   Γ. ΤΟ ΚΑΤΩΦΛΙ ΤΟΥ «ΔΙΝΩ» ΕΙΝΑΙ ΑΥΣΤΗΡΟΤΕΡΟ ΑΠΟ ΤΟΥ «ΑΡΝΟΥΜΑΙ». 0 έναντι 0,3.
 *   Δ. ΤΟ ΚΥΜΑ ΠΟΥ ΣΚΑΕΙ ΣΤΗΝ ΑΚΤΗ ΔΕΝ ΑΛΛΑΞΕ. Η νέα τιμή ερχόταν πριν ως `undefined`, οπότε
 *      το `shoreBreaksOnTheBeach` πρέπει να απαντάει ΑΚΡΙΒΩΣ ό,τι απαντούσε χθες.
 *   Ε. ΤΟ ΦΡΕΝΟ. Στον πραγματικό κινητήρα, μια παραλία που παίρνει την έκπτωση και θα έλεγε
 *      «μην κολυμπήσεις» χωρίς αυτήν, εξακολουθεί να λέει «μην κολυμπήσεις» — με μικρότερο
 *      τυπωμένο νούμερο. Αυτός ο έλεγχος είναι ο λόγος που υπάρχει το αρχείο: η μέτρηση της
 *      ίδιας μέρας βρήκε 0 τέτοιες περιπτώσεις, αλλά σε ΗΡΕΜΗ μέρα· σε μελτέμι η ίδια έκπτωση
 *      κουνάει το τυπωμένο ύψος ως και 1,40 μ. (§Γ47).
 *
 * Τρέχει χωρίς δίκτυο και χωρίς δεδομένα παραγωγής: καθαρές συναρτήσεις + ένα fixture.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const {
  shoreSeaStateM, SHORE_DAMPING_BY_EXPOSURE, SEA_ARRIVAL_GRAZING,
} = require(path.join(root, 'utils/waveCharacter.ts'));
const {
  resolveSeaArrivalExposureLevel, SEA_ARRIVAL_ONSHORE_MIN, SEA_GRAZING_ONSHORE_MAX, SEA_ARRIVAL_UNKNOWN,
} = require(path.join(root, 'utils/seaArrival.ts'));
const { shoreBreaksOnTheBeach } = require(path.join(root, 'utils/shoreBreak.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));

const failures = [];
const fail = (check, message) => failures.push(`${check}: ${message}`);

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const LEVELS = ['protected', 'partial', 'exposed'];
const ARRIVALS = [undefined, 'protected', 'partial', 'exposed', SEA_ARRIVAL_UNKNOWN, SEA_ARRIVAL_GRAZING];
const SEAS = [0.2, 0.35, 0.5, 0.8, 1.0, 1.2, 1.6, 2.0, 2.6];

/**
 * Η ΣΥΝΑΡΤΗΣΗ ΟΠΩΣ ΗΤΑΝ ΠΡΙΝ ΤΙΣ 22/08/2026, γραμμένη ξανά εδώ ΕΠΙΤΗΔΕΣ.
 *
 * Είναι το μόνο σημείο του repo όπου επιτρέπεται αντίγραφο αυτής της λογικής: χωρίς αυτό δεν
 * υπάρχει τρόπος να αποδειχθεί ότι η αλλαγή είναι μονόδρομη, γιατί το «πριν» δεν υπάρχει
 * πουθενά αλλού. Αν αλλάξει η πραγματική συνάρτηση με τρόπο που ρίχνει κι άλλο το ύψος, ο
 * έλεγχος Β συνεχίζει να περνάει (μονόδρομο)· αν κάποιος τη χαλαρώσει προς τα πάνω, σκάει.
 */
const shoreSeaStateBefore = (openM, level, arrival, curatedWindOnly) => {
  if (typeof openM !== 'number' || !Number.isFinite(openM)) return undefined;
  const arrivalBefore = arrival === SEA_ARRIVAL_GRAZING ? undefined : arrival;
  const sheltered = arrivalBefore === undefined || arrivalBefore === 'protected';
  const damping = level === 'protected' && sheltered && !curatedWindOnly
    ? SHORE_DAMPING_BY_EXPOSURE.protected
    : level === 'partial'
      ? SHORE_DAMPING_BY_EXPOSURE.partial
      : SHORE_DAMPING_BY_EXPOSURE.exposed;
  return Number((openM * damping).toFixed(2));
};

// ── Α. Ποιος κερδίζει, και μόνο αυτός ────────────────────────────────────────────────────────
for (const sea of SEAS) {
  for (const level of LEVELS) {
    for (const arrival of ARRIVALS) {
      const now = shoreSeaStateM(sea, level, arrival, false);
      const before = shoreSeaStateBefore(sea, level, arrival, false);
      const changed = now !== before;
      const shouldChange = level === 'partial' && arrival === SEA_ARRIVAL_GRAZING;
      if (changed && !shouldChange) {
        fail('Α', `${sea} μ. / ${level} / άφιξη «${String(arrival)}» άλλαξε (${before} → ${now}) και δεν έπρεπε`);
      }
      if (!changed && shouldChange) {
        fail('Α', `${sea} μ. / partial / ξυστή θάλασσα ΔΕΝ πήρε την έκπτωση (έμεινε ${now})`);
      }
      if (shouldChange && now !== Number((sea * SHORE_DAMPING_BY_EXPOSURE.protected).toFixed(2))) {
        fail('Α', `${sea} μ. / partial / ξυστή: η έκπτωση δεν είναι η ίδια με του καταφυγίου (${now})`);
      }
    }
  }
}

// Η ξυστή θάλασσα ΔΕΝ αγοράζει τίποτα όταν το καταφύγιο είναι μόνο για τον άνεμο.
for (const sea of SEAS) {
  const curated = shoreSeaStateM(sea, 'partial', SEA_ARRIVAL_GRAZING, true);
  if (curated !== Number((sea * SHORE_DAMPING_BY_EXPOSURE.partial).toFixed(2))) {
    fail('Α', `${sea} μ.: επιθεωρημένος-μόνο-για-άνεμο όρμος πήρε την έκπτωση της ξυστής θάλασσας (${curated})`);
  }
}

// ── Β. Μονόδρομο: ποτέ ψηλότερο απ' ό,τι πριν ────────────────────────────────────────────────
for (const sea of SEAS) {
  for (const level of LEVELS) {
    for (const arrival of ARRIVALS) {
      for (const curated of [false, true, undefined]) {
        const now = shoreSeaStateM(sea, level, arrival, curated);
        const before = shoreSeaStateBefore(sea, level, arrival, curated);
        if (typeof now === 'number' && typeof before === 'number' && now > before) {
          fail('Β', `${sea} μ. / ${level} / «${String(arrival)}» / curated=${String(curated)}: ${before} → ${now} (ΑΝΕΒΗΚΕ)`);
        }
      }
    }
  }
}

// ── Γ. Το κατώφλι του «δίνω» είναι αυστηρότερο από του «αρνούμαι» ────────────────────────────
if (!(SEA_GRAZING_ONSHORE_MAX < SEA_ARRIVAL_ONSHORE_MIN)) {
  fail('Γ', `SEA_GRAZING_ONSHORE_MAX (${SEA_GRAZING_ONSHORE_MAX}) πρέπει να είναι ΜΙΚΡΟΤΕΡΟ από `
    + `SEA_ARRIVAL_ONSHORE_MIN (${SEA_ARRIVAL_ONSHORE_MIN}) — αλλιώς το «δίνω έκπτωση» ζητάει `
    + 'όσα και το «αρνούμαι έκπτωση»');
}

const profileFacing = (facingDeg, level) => ({
  beachId: 999059,
  confidence: 'high',
  facingDeg,
  sectors: Object.fromEntries(SECTORS.map(key => [key, {
    fetchKm: 10, blockedRayRatio: 0.5, onshore: 0.5, intensity: 40, level,
  }])),
});

// Η γωνία γυρίζει· η ακτή κοιτάει νότια (180°).
for (const [waveDirectionDeg, expected, why] of [
  [180, 'σκέτο επίπεδο τομέα', 'κατευθείαν μέσα (onshore 1)'],
  [230, 'σκέτο επίπεδο τομέα', 'λοξά αλλά μπαίνει (onshore ≈ 0,64)'],
  [255, undefined, 'πολύ λοξά, κάτω από το 0,3 — η παλιά σιωπή'],
  [270, SEA_ARRIVAL_GRAZING, 'ακριβώς ξυστά (onshore 0)'],
  [90, SEA_ARRIVAL_GRAZING, 'ξυστά από την άλλη πλευρά'],
  [0, SEA_ARRIVAL_GRAZING, 'φεύγει από την ακτή (onshore −1)'],
]) {
  const got = resolveSeaArrivalExposureLevel(profileFacing(180, 'partial'), waveDirectionDeg);
  const ok = expected === 'σκέτο επίπεδο τομέα' ? LEVELS.includes(got) : got === expected;
  if (!ok) fail('Γ', `κύμα από ${waveDirectionDeg}° σε ακτή 180° (${why}): πήρα «${String(got)}»`);
}
if (resolveSeaArrivalExposureLevel(undefined, 270) !== SEA_ARRIVAL_UNKNOWN
  || resolveSeaArrivalExposureLevel(profileFacing(180, 'partial'), undefined) !== SEA_ARRIVAL_UNKNOWN) {
  fail('Γ', 'η τυφλότητα έπαψε να λέγεται «unknown» — η ξυστή θάλασσα δεν επιτρέπεται να την καλύψει');
}

// ── Δ. Το κύμα που σκάει στην ακτή δεν άλλαξε συμπεριφορά ────────────────────────────────────
const shoreBreakInput = (arrival) => ({
  waterDepthType: 'deep',
  terrainTypes: ['pebble'],
  seaArrivalExposureLevel: arrival,
  seaStateWaveM: 0.5,
  seaStatePeriodS: 5,
});
if (shoreBreaksOnTheBeach(shoreBreakInput(SEA_ARRIVAL_GRAZING)) !== shoreBreaksOnTheBeach(shoreBreakInput(undefined))) {
  fail('Δ', 'το shoreBreaksOnTheBeach απαντάει διαφορετικά για την ξυστή θάλασσα απ᾽ ό,τι για τη σιωπή '
    + '— πριν τις 22/08 ήταν η ΙΔΙΑ περίπτωση, άρα η αλλαγή διέρρευσε εκεί που δεν έπρεπε');
}

// ── Ε. Το φρένο, στον πραγματικό κινητήρα ────────────────────────────────────────────────────
const beach = {
  id: 999059, name: { gr: 'Δοκιμή ξυστής θάλασσας', en: 'Grazing sea test' },
  coordinates: { lat: 37.0, lon: 25.0 },
  region: 'test', facing: 'S', amenities: {},
  metadata: { confidence: 'high' },
  orientation: { facingDeg: 180, confidence: 'high' },
};
const toMs = (kmh) => kmh / 3.6;
/**
 * ΤΟ FIXTURE ΕΙΝΑΙ ΛΕΠΤΟ ΚΑΙ ΞΕΡΕΙ ΟΤΙ ΕΙΝΑΙ. Η έκθεση πρέπει να βγει ΑΚΡΙΒΩΣ 'partial': σε
 * 'protected' η έκπτωση υπήρχε ήδη από τις 13/08 και η δοκιμή δεν θα ασκούσε τίποτα καινούργιο,
 * σε 'exposed' δεν δίνεται ποτέ. Ο άνεμος έρχεται από 270° (πλάγια), 24 χλμ/ώρα, με μεσαία
 * ένταση τομέα. Ο έλεγχος από κάτω σταματάει τη δοκιμή αν η έκθεση ξεφύγει.
 */
const WIND_KMH = 24;
const WIND_DEG = 270;
const hourItem = (hour) => ({
  dt: Math.floor(new Date(2026, 7, 15, hour, 0, 0).getTime() / 1000),
  dt_txt: `2026-08-15 ${String(hour).padStart(2, '0')}:00:00`,
  main: { temp: 28, temp_min: 26, temp_max: 30, pressure: 1013, sea_level: 1013, grnd_level: 1013, humidity: 50, temp_kf: 0 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  clouds: { all: 0 },
  wind: { speed: toMs(WIND_KMH), speedBeforeGustFloor: toMs(WIND_KMH), deg: WIND_DEG, gust: toMs(WIND_KMH * 1.15) },
  visibility: 10000, pop: 0, sys: { pod: 'd' },
});
const dayWith = (waveDirectionDeg, waveHeightM) => ({
  date: new Date(2026, 7, 15),
  wind: { speed: toMs(WIND_KMH), speedBeforeGustFloor: toMs(WIND_KMH), deg: WIND_DEG, gust: toMs(WIND_KMH * 1.15) },
  weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
  temp_min: 26, temp_max: 30,
  hourly: [hourItem(11), hourItem(13), hourItem(15)],
  marine: { waveHeightM, wavePeriodS: 5, swellWaveHeightM: 0, waveDirectionDeg, seaSurfaceTemperatureC: 26 },
});
const scoreWith = (waveDirectionDeg, waveHeightM) => {
  const forecast = dayWith(waveDirectionDeg, waveHeightM);
  return calculateBeachScore(beach, forecast, undefined, undefined, {
    weatherSource: 'beach-cluster',
    hourlyForecast: forecast.hourly,
    geospatialProfile: profileFacing(180, 'partial'),
  });
};

/** Πάνω από 1,20 μ. η ετυμηγορία είναι «μην κολυμπήσεις»· στο μισό του πέφτει σε «πρόσεχε». */
const OPEN_SEA_M = 2.0;
const grazing = scoreWith(270, OPEN_SEA_M);
const onshoreControl = scoreWith(180, OPEN_SEA_M);

if (grazing.exposureLevel !== 'partial' || onshoreControl.exposureLevel !== 'partial') {
  fail('Ε', `το fixture δεν βγάζει πια έκθεση «partial» (ξυστά: «${grazing.exposureLevel}», `
    + `κατευθείαν: «${onshoreControl.exposureLevel}») — η δοκιμή έπαψε να ασκεί τον κανόνα, `
    + 'ρύθμισε ξανά άνεμο/ένταση τομέα μέχρι να ξαναβγεί «partial»');
} else if (grazing.seaArrivalExposureLevel !== SEA_ARRIVAL_GRAZING) {
  fail('Ε', `το fixture δεν φτάνει καν στην ξυστή θάλασσα (άφιξη «${String(grazing.seaArrivalExposureLevel)}»)`);
} else if (onshoreControl.seaArrivalExposureLevel === SEA_ARRIVAL_GRAZING) {
  fail('Ε', 'το σενάριο ελέγχου θεωρείται κι αυτό ξυστή θάλασσα — δεν υπάρχει σύγκριση');
} else if (grazing.shoreDisplayWaveM !== Number((OPEN_SEA_M * SHORE_DAMPING_BY_EXPOSURE.protected).toFixed(2))) {
  fail('Ε', `η έκπτωση δεν έπιασε στον πραγματικό κινητήρα: τυπώνει ${grazing.shoreDisplayWaveM} μ. `
    + `αντί για ${Number((OPEN_SEA_M * SHORE_DAMPING_BY_EXPOSURE.protected).toFixed(2))} μ.`);
} else if (!(onshoreControl.shoreDisplayWaveM > grazing.shoreDisplayWaveM)) {
  fail('Ε', `το σενάριο ελέγχου τυπώνει ${onshoreControl.shoreDisplayWaveM} μ., όχι περισσότερα από `
    + `τα ${grazing.shoreDisplayWaveM} μ. της ξυστής — η σύγκριση δεν αποδεικνύει τίποτα`);
} else if (onshoreControl.swimmingComfort !== 'avoid_swimming') {
  fail('Ε', `το σενάριο ελέγχου δεν λέει «μην κολυμπήσεις» (λέει «${onshoreControl.swimmingComfort}») `
    + '— χωρίς αυτό δεν υπάρχει προειδοποίηση για να σβηστεί και η δοκιμή δεν αποδεικνύει τίποτα');
} else if (grazing.swimmingComfort !== 'avoid_swimming') {
  fail('Ε', 'ΤΟ ΦΡΕΝΟ ΕΣΠΑΣΕ: η ξυστή θάλασσα κατέβασε το «μην κολυμπήσεις» σε '
    + `«${grazing.swimmingComfort}» ρίχνοντας το ύψος από ${onshoreControl.shoreDisplayWaveM} σε `
    + `${grazing.shoreDisplayWaveM} μ. Η έκπτωση επιτρέπεται να ρίξει ΑΡΙΘΜΟ, ποτέ ΠΡΟΕΙΔΟΠΟΙΗΣΗ.`);
}

if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} πρόβλημα/τα στη χαλάρωση της ξυστής θάλασσας (§Γ59).\n`);
  for (const line of failures) console.error(`  • ${line}`);
  console.error('\nΟ ΚΑΝΟΝΑΣ: έκπτωση ×0,5 μόνο σε «partial» ακτή που η θάλασσα την προσπερνάει (≥90°),');
  console.error('ποτέ ψηλότερο νούμερο απ᾽ ό,τι πριν, και ποτέ σβησμένο «μην κολυμπήσεις».');
  console.error('Αρχεία: utils/waveCharacter.ts, utils/seaArrival.ts, services/recommendationService.ts.');
  process.exit(1);
}

console.log('PASSED: η ξυστή θάλασσα ρίχνει τον αριθμό μόνο εκεί που της επιτρέπεται, ποτέ πιο ψηλά '
  + `απ᾽ ό,τι πριν, και το «μην κολυμπήσεις» έμεινε όρθιο (${SEAS.length}×${LEVELS.length}×${ARRIVALS.length} `
  + 'συνδυασμοί + πραγματικός κινητήρας).');
