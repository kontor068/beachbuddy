/**
 * ΤΟ ΦΡΕΝΟ ΤΗΣ ΑΒΕΒΑΙΟΤΗΤΑΣ ΚΑΝΕΙ ΑΚΡΙΒΩΣ ΕΝΑ ΠΡΑΓΜΑ — ΚΑΙ ΠΟΤΕ ΤΟ ΑΝΤΙΘΕΤΟ.
 *
 * Το φρένο (§ΑΞ2/Α5, απόφαση Μίλτου 21/08/2026) είναι το πρώτο πράγμα σε αυτό το μοντέλο που
 * κρίνει με βάση **πόσο σίγουροι είμαστε**, όχι με βάση τι δείχνει η πρόγνωση. Ακριβώς γι' αυτό
 * χρειάζεται πύλη: ένας κανόνας που μιλάει για αβεβαιότητα μπορεί να δικαιολογήσει ΟΠΟΙΑΔΗΠΟΤΕ
 * αλλαγή αν κανείς δεν του κρατάει τα όρια.
 *
 * ΕΞΙ ΙΣΧΥΡΙΣΜΟΙ, χωρίς καμία κλήση δικτύου:
 *   Α. ΜΟΝΟΔΡΟΜΟΣ, ΕΝΑ ΣΚΑΛΙ. Σε ΟΛΟ το πλέγμα συνθηκών, το φρένο ποτέ δεν κάνει μια παραλία να
 *      φαίνεται ηρεμότερη, και η ΜΟΝΗ μετάβαση που παράγει είναι μπλε → κίτρινο.
 *   Β. ΠΟΤΕ ΣΗΜΕΡΑ. Ακόμα και αν το upstream πει «η σημερινή μέρα είναι αβέβαιη», το κλειδί της
 *      σημερινής δεν μπαίνει καν στα δεδομένα.
 *   Γ. ΑΓΝΩΣΤΟ ≠ ΑΒΕΒΑΙΟ. Χωρίς απάντηση, με σπασμένη απάντηση ή με σβηστό διακόπτη, η
 *      συμπεριφορά είναι ΤΑΥΤΟΣΗΜΗ με πριν — και ο πίνακας ημερών επιστρέφεται ΑΥΤΟΥΣΙΟΣ
 *      (ίδια αναφορά), ώστε καμία οθόνη να μη νομίσει ότι ήρθαν νέα δεδομένα.
 *   Δ. Η ΕΤΥΜΗΓΟΡΙΑ ΠΕΦΤΕΙ ΜΟΝΟ ΑΠΟ ΤΟ «ΙΔΑΝΙΚΑ». Οδηγεί την πραγματική `calculateBeachScore`.
 *   Ε. ΗΜΕΡΟΜΗΝΙΑ, ΟΧΙ ΔΕΙΚΤΗΣ. Η αντιστοίχιση επιβιώνει όταν πέσει η πρώτη μέρα του πίνακα —
 *      αυτό ακριβώς κάνει το `dropPastForecastDays` κάθε βράδυ.
 *   ΣΤ. ΑΥΤΟΣΑΜΠΟΤΑΖ. Το φρένο πρέπει να ΜΠΟΡΕΙ να αλλάξει κάτι· αν όλα τα παραπάνω περνούν
 *      επειδή έγινε σιωπηλά no-op, η πύλη θα έδειχνε πράσινη ενώ δεν φυλάει τίποτα.
 *
 * Run: node scripts/validateForecastUncertaintyBrake.mjs
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

const { resolveConditionTone, CALMNESS_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { resolveConditionCause } = require(path.join(root, 'utils/conditionCause.ts'));
const {
  applyForecastUncertaintyToDays, uncertainDaysFromResponse,
  FORECAST_UNCERTAINTY_BRAKE_ENABLED, UNCERTAINTY_MIN_LEAD_DAYS,
} = require(path.join(root, 'utils/forecastUncertainty.ts'));
const { wallClockDayKey, athensNow } = require(path.join(root, 'utils/athensTime.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));

const failures = [];
const fail = (check, message) => failures.push(`${check}: ${message}`);
/** CALMNESS_ORDER τρέχει κόκκινο → μπλε, άρα μεγαλύτερος δείκτης = ηρεμότερο χρώμα. */
const calmness = (tone) => CALMNESS_ORDER.indexOf(tone);

// ── Α. Μονόδρομος, ένα σκαλί, και μόνο μπλε → κίτρινο ────────────────────────────────────────
const beforeA = failures.length;
let changedCount = 0;
const transitions = new Set();
for (const exposureLevel of ['protected', 'partial', 'exposed', undefined]) {
  for (let beaufort = 0; beaufort <= 8; beaufort += 1) {
    for (const seaStateM of [undefined, 0.2, 0.5, 0.9, 1.3, 2.4]) {
      for (const isEnclosedCove of [false, true]) {
        for (const swimVerdictAvoid of [false, true]) {
          for (const windSpeedKmh of [undefined, 12, 14, 17, 25]) {
            const base = { exposureLevel, beaufort, seaStateM, isEnclosedCove, swimVerdictAvoid, windSpeedKmh };
            const calm = resolveConditionTone({ ...base, forecastUncertain: false });
            const braked = resolveConditionTone({ ...base, forecastUncertain: true });
            const omitted = resolveConditionTone(base);
            if (omitted !== calm) {
              fail('Α', `η παράλειψη του ορίσματος δεν ισοδυναμεί με false (${calm} vs ${omitted})`);
            }
            if (calmness(braked) > calmness(calm)) {
              fail('Α', `το φρένο έκανε το χρώμα ΗΡΕΜΟΤΕΡΟ: ${calm} → ${braked} σε ${JSON.stringify(base)}`);
            }
            if (braked !== calm) {
              changedCount += 1;
              transitions.add(`${calm}→${braked}`);
            }
          }
        }
      }
    }
  }
}
if (transitions.size && [...transitions].some(t => t !== 'blue→yellow')) {
  fail('Α', `το φρένο παρήγαγε μεταβάσεις εκτός του μπλε→κίτρινο: ${[...transitions].join(', ')}`);
}
console.log(`Α. μονόδρομος, ένα σκαλί (${changedCount} αλλαγές, μεταβάσεις: ${[...transitions].join(', ') || '—'}) ... ${failures.length > beforeA ? '❌' : '✅'}`);

// ── Β. Ποτέ σήμερα ───────────────────────────────────────────────────────────────────────────
const beforeB = failures.length;
const now = athensNow();
const todayKey = wallClockDayKey(now);
const allUncertain = uncertainDaysFromResponse({
  available: true,
  days: Array.from({ length: 7 }, (_, lead) => ({ lead, uncertain: true, uncertainHours: 8, worstGapRungs: 4 })),
}, now);
if (!allUncertain) {
  fail('Β', 'έγκυρη απάντηση με 7 αβέβαιες μέρες γύρισε null');
} else {
  if (allUncertain[todayKey]) fail('Β', 'η ΣΗΜΕΡΙΝΗ μέρα σημαδεύτηκε αβέβαιη — το φρένο δεν επιτρέπεται να αγγίζει το σήμερα');
  const marked = Object.keys(allUncertain).length;
  if (marked !== 7 - UNCERTAINTY_MIN_LEAD_DAYS) {
    fail('Β', `σημαδεύτηκαν ${marked} μέρες αντί για ${7 - UNCERTAINTY_MIN_LEAD_DAYS}`);
  }
}
console.log(`Β. ποτέ σήμερα ... ${failures.length > beforeB ? '❌' : '✅'}`);

// ── Γ. Άγνωστο ≠ αβέβαιο ─────────────────────────────────────────────────────────────────────
const beforeC = failures.length;
const day = (offset) => {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + offset);
  return { date: d, wind: { speed: 3, deg: 0 }, weather: { main: 'Clear', description: '', icon: '01d' }, temp_min: 25, temp_max: 30, hourly: [] };
};
const days = [day(0), day(1), day(2)];
for (const [label, payload] of [
  ['χωρίς διαθεσιμότητα', { available: false, days: null }],
  ['χωρίς σώμα', null],
  ['σπασμένο σώμα', { available: true, days: 'όχι πίνακας' }],
]) {
  if (uncertainDaysFromResponse(payload, now) !== null) {
    fail('Γ', `«${label}» δεν γύρισε null`);
  }
}
if (applyForecastUncertaintyToDays(days, null) !== days) {
  fail('Γ', 'χωρίς δεδομένα ο πίνακας ημερών δεν επιστράφηκε αυτούσιος (νέα αναφορά = ψεύτικο render)');
}
if (applyForecastUncertaintyToDays(days, {}) !== days) {
  fail('Γ', 'με άδεια δεδομένα ο πίνακας ημερών δεν επιστράφηκε αυτούσιος');
}
console.log(`Γ. άγνωστο ≠ αβέβαιο ... ${failures.length > beforeC ? '❌' : '✅'}`);

// ── Δ. Η ετυμηγορία πέφτει μόνο από το «ιδανικά» ──────────────────────────────────────────────
const beforeD = failures.length;
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/**
 * Παραλία με ΠΛΗΡΗ στοιχεία επίτηδες: το «excellent» απαιτεί και υψηλή εμπιστοσύνη, οπότε ένα
 * γυμνό fixture θα έπεφτε σε «good» για ΑΛΛΟΝ λόγο και η δοκιμή θα περνούσε χωρίς να ασκεί
 * τίποτα. Ο έλεγχος από κάτω το πιάνει αυτό ρητά.
 */
const beach = {
  id: 999002, name: { gr: 'Δοκιμή φρένου', en: 'Brake test' }, coordinates: { lat: 37.0, lon: 25.0 },
  region: 'test', facing: 'S', amenities: {},
  metadata: { confidence: 'high' },
  orientation: { facingDeg: 180, confidence: 'high' },
};
const profile = {
  beachId: beach.id,
  confidence: 'high',
  facingDeg: 180,
  sectors: Object.fromEntries(SECTORS.map(key => [key, {
    fetchKm: 0.3, blockedRayRatio: 1, onshore: -0.9, intensity: 8, level: 'protected',
  }])),
};
const toMs = (kmh) => kmh / 3.6;
const hourItem = (hour, kmh) => ({
  dt: Math.floor(new Date(2026, 7, 15, hour, 0, 0).getTime() / 1000),
  dt_txt: `2026-08-15 ${String(hour).padStart(2, '0')}:00:00`,
  main: { temp: 28, temp_min: 26, temp_max: 30, pressure: 1013, sea_level: 1013, grnd_level: 1013, humidity: 50, temp_kf: 0 },
  weather: [{ id: 800, main: 'Clear', description: 'clear sky', icon: '01d' }],
  clouds: { all: 0 },
  wind: { speed: toMs(kmh), speedBeforeGustFloor: toMs(kmh), deg: 0, gust: toMs(kmh * 1.2) },
  visibility: 10000, pop: 0, sys: { pod: 'd' },
});
const dayAt = (kmh, forecastUncertain) => ({
  date: new Date(2026, 7, 15),
  wind: { speed: toMs(kmh), speedBeforeGustFloor: toMs(kmh), deg: 0, gust: toMs(kmh * 1.2) },
  weather: { main: 'Clear', description: 'clear sky', icon: '01d' },
  temp_min: 26, temp_max: 30,
  hourly: [hourItem(11, kmh), hourItem(13, kmh), hourItem(15, kmh)],
  // Θάλασσα και πηγή ΠΕΡΙΟΧΗΣ-ΠΑΡΑΛΙΑΣ: χωρίς αυτά η εμπιστοσύνη πέφτει σε 'low' και το
  // «excellent» γίνεται 'good' για ΑΛΛΟΝ λόγο — η δοκιμή θα περνούσε χωρίς να ασκεί τον κανόνα.
  marine: { waveHeightM: 0.1, wavePeriodS: 6, swellWaveHeightM: 0, waveDirectionDeg: 180, seaSurfaceTemperatureC: 26 },
  ...(forecastUncertain === undefined ? {} : { forecastUncertain }),
});
const verdictAt = (kmh, uncertain) => {
  const forecast = dayAt(kmh, uncertain);
  return calculateBeachScore(beach, forecast, undefined, undefined, {
    weatherSource: 'beach-cluster', hourlyForecast: forecast.hourly, geospatialProfile: profile,
  }).swimmingComfort;
};

const calmVerdict = verdictAt(6, undefined);
if (calmVerdict !== 'excellent') {
  fail('Δ', `το ήρεμο σενάριο δεν βγάζει πια «excellent» (βγάζει «${calmVerdict}») — η δοκιμή έπαψε να ασκεί τον κανόνα`);
} else if (verdictAt(6, true) !== 'good') {
  fail('Δ', `με φρένο το «excellent» δεν έγινε «good» (έγινε «${verdictAt(6, true)}»)`);
}
for (const kmh of [22, 34, 46]) {
  const plain = verdictAt(kmh, undefined);
  const braked = verdictAt(kmh, true);
  if (plain === 'excellent') continue;
  if (braked !== plain) {
    fail('Δ', `στα ${kmh} χλμ/ώ το φρένο άλλαξε ετυμηγορία που ΔΕΝ ήταν «excellent»: ${plain} → ${braked}`);
  }
}
console.log(`Δ. η ετυμηγορία πέφτει μόνο από το «ιδανικά» ... ${failures.length > beforeD ? '❌' : '✅'}`);

// ── Ε. Ημερομηνία, όχι δείκτης ───────────────────────────────────────────────────────────────
const beforeE = failures.length;
const onlyPlusTwo = uncertainDaysFromResponse({
  available: true,
  days: [{ lead: 2, uncertain: true, uncertainHours: 6, worstGapRungs: 3 }],
}, now);
const marked = applyForecastUncertaintyToDays(days, onlyPlusTwo);
if (marked[0].forecastUncertain || marked[1].forecastUncertain || marked[2].forecastUncertain !== true) {
  fail('Ε', 'το +2 δεν προσγειώθηκε στη σωστή μέρα');
}
// Η πρώτη μέρα πέφτει (dropPastForecastDays) — η σήμανση πρέπει να μείνει στην ΙΔΙΑ ημερομηνία.
const shifted = applyForecastUncertaintyToDays(days.slice(1), onlyPlusTwo);
if (shifted[0].forecastUncertain || shifted[1].forecastUncertain !== true) {
  fail('Ε', 'μετά την πτώση της πρώτης ημέρας η σήμανση μετακινήθηκε — η αντιστοίχιση γίνεται με δείκτη αντί για ημερομηνία');
}
console.log(`Ε. ημερομηνία, όχι δείκτης ... ${failures.length > beforeE ? '❌' : '✅'}`);

// ── ΣΤ. Αυτοσαμποτάζ ─────────────────────────────────────────────────────────────────────────
const beforeF = failures.length;
if (!FORECAST_UNCERTAINTY_BRAKE_ENABLED) {
  console.log('ΣΤ. ο διακόπτης είναι ΣΒΗΣΤΟΣ — το φρένο δεν τρέχει πουθενά (δρόμος επιστροφής ενεργός)');
} else {
  if (changedCount === 0) {
    fail('ΣΤ', 'το φρένο δεν άλλαξε ΤΙΠΟΤΑ σε όλο το πλέγμα — έγινε σιωπηλά no-op και η πύλη φυλάει αέρα');
  }
  if (!transitions.has('blue→yellow')) {
    fail('ΣΤ', 'δεν παρατηρήθηκε ούτε μία μπλε→κίτρινο — ο κανόνας δεν ασκείται');
  }
  const yellowStays = resolveConditionTone({ exposureLevel: 'exposed', beaufort: 3, forecastUncertain: true, windSpeedKmh: 25 });
  if (yellowStays !== 'yellow') {
    fail('ΣΤ', `το φρένο άγγιξε κίτρινο αντί μόνο για μπλε (βγήκε ${yellowStays})`);
  }
}
console.log(`ΣΤ. αυτοσαμποτάζ ... ${failures.length > beforeF ? '❌' : '✅'}`);

// ── Ζ. Η γραμμή αιτίας δεν ονομάζει τον άνεμο για κάτι που δεν έκανε ─────────────────────────
const beforeG = failures.length;
{
  let attributed = 0;
  for (const exposureLevel of ['protected', 'partial', 'exposed']) {
    for (let beaufort = 0; beaufort <= 5; beaufort += 1) {
      for (const seaStateM of [undefined, 0.2, 0.5, 0.9]) {
        for (const windSpeedKmh of [undefined, 12, 17]) {
          const base = { exposureLevel, beaufort, seaStateM, windSpeedKmh };
          const plain = resolveConditionTone({ ...base, forecastUncertain: false });
          const braked = resolveConditionTone({ ...base, forecastUncertain: true });
          if (plain === braked) continue;
          attributed += 1;
          const cause = resolveConditionCause({ ...base, forecastUncertain: true });
          if (cause !== 'forecast') {
            fail('Ζ', `το φρένο έβαψε κίτρινο αλλά η γραμμή αιτίας το χρέωσε στο «${cause}» — ${JSON.stringify(base)}`);
          }
        }
      }
    }
  }
  if (attributed === 0) fail('Ζ', 'καμία περίπτωση φρεναρίσματος στο υποπλέγμα της αιτίας — ο έλεγχος δεν ασκείται');
  // Και η ανάποδη: χωρίς φρένο η αιτία δεν επιτρέπεται να είναι ΠΟΤΕ «forecast».
  const noBrakeCause = resolveConditionCause({ exposureLevel: 'protected', beaufort: 2, seaStateM: 0.2 });
  if (noBrakeCause === 'forecast') {
    fail('Ζ', 'χωρίς φρένο η αιτία βγήκε «forecast» — η τιμή διαρρέει εκεί που δεν συνέβη τίποτα');
  }
}
console.log(`Ζ. η αιτία λέει «η πρόγνωση», όχι «ο αέρας» ... ${failures.length > beforeG ? '❌' : '✅'}`);

if (failures.length) {
  console.error('\n❌ Το φρένο αβεβαιότητας παραβίασε τα όριά του:');
  for (const f of failures) console.error(`   • ${f}`);
  console.error('\nΤα όρια δεν είναι διαπραγματεύσιμα: ένα σκαλί, μπλε→κίτρινο και «ιδανικά»→«καλά», ποτέ σήμερα,');
  console.error('ποτέ προς το ηρεμότερο, και άγνωστο σημαίνει καμία αλλαγή. Αν χρειάζεται να αλλάξει κάποιο,');
  console.error('θέλει νέα μέτρηση και νέα απόφαση — δες utils/forecastUncertainty και βίβλος §ΑΞ2/Α5.');
  process.exit(1);
}
console.log('\n✅ Το φρένο κάνει ακριβώς ένα πράγμα, και ποτέ το αντίθετο.');
