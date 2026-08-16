/**
 * Ο ΕΚΘΕΤΗΣ ΤΗΣ ΑΠΟΤΟΜΟΤΗΤΑΣ — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΙ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ (15/08/2026): αναφορά επισκέπτη «Είχε κύμα» για τη Σκάλα Κεφαλονιάς
 * (3105) με 3 Μποφόρ ΒΑ. Η γεωμετρία της είναι σωστή (τομέας NE: onshore +0,423, fetch 20 χλμ,
 * exposed) και το κύμα ήταν 0,68 μ. — αλλά στα **3,3 δευτερόλεπτα**, δηλαδή σπαστό chop. Το
 * `seaStateSeverityM` το ανέβασε σε 0,79 μ. έναντι κατωφλιού `SEA_STATE_AMBER_M` = 0,80.
 * **Έμεινε χωρίς καμία προειδοποίηση με διαφορά ενός εκατοστού.**
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΚΑΝΕΙ ΤΗΝ ΕΡΩΤΗΣΗ ΑΞΙΑ ΜΕΤΡΗΣΗΣ — ΚΑΙ ΕΙΝΑΙ ΔΟΜΙΚΟ, ΟΧΙ ΟΡΙΑΚΟ:
 * το `utils/waveCharacter.ts:34-35` δηλώνει γραπτώς τι υλοποιεί ο εκθέτης:
 *
 *     «What a swimmer feels sits between the encounter rate (∝ T⁻¹) and the steepness (∝ T⁻²),
 *      so the exponent is taken BETWEEN THEM»
 *
 * Ο ρυθμός συνάντησης δίνει εκθέτη 1. Η αποτομότητα δίνει 2. «Ανάμεσά τους» σημαίνει 1 < EXP < 2.
 * Ο κώδικας γράφει **CHOP_EXPONENT = 0,75** — δηλαδή ΚΑΤΩ ΚΑΙ ΑΠΟ ΤΑ ΔΥΟ, εκτός του εύρους που
 * το ίδιο του το σχόλιο ορίζει. Δεν είναι θέμα γούστου: ο κώδικας δεν κάνει ό,τι λέει ότι κάνει.
 *
 * ΚΑΙ ΤΟ ΔΕΥΤΕΡΟ, ΠΟΥ ΕΙΝΑΙ ΧΕΙΡΟΤΕΡΟ: το ίδιο το παράδειγμα για το οποίο γράφτηκε ολόκληρο το
 * `waveCharacter.ts` — Σχινιάς, 27/07/2026, **0,45 μ. στα 2,5 δλ**, «scored 9/10 and coloured
 * blue» — ΔΕΝ διορθώνεται από τον κώδικα που γράφτηκε γι' αυτό. Με τον σημερινό εκθέτη βγάζει
 * 0,64 μ. Και με ΚΑΘΕ εκθέτη βγάζει το πολύ 0,45 × `MAX_CHOP_FACTOR` (1,75) = **0,7875 μ.**,
 * δηλαδή μαθηματικά αδύνατο να φτάσει το 0,80. Το καπάκι κάνει κάθε κύμα κάτω από
 * 0,80 / 1,75 = **0,457 μ. δομικά ανίκανο να πάρει ποτέ προειδοποίηση**, όσο απότομο κι αν είναι.
 *
 * ΓΙ' ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ ΜΕΤΡΑΕΙ ΚΑΙ ΤΑ ΔΥΟ: τον εκθέτη ΚΑΙ το καπάκι, χωριστά, εθνικά και ζωντανά.
 *
 * ΓΙΑΤΙ ΔΕΝ ΣΠΑΕΙ ΤΟ ΚΛΕΙΔΩΜΑ ΤΗΣ ΒΙΒΛΟΥ (PORISMA §9). Η βίβλος επιτρέπει άνοιγμα σε τρία
 * σημάδια, και το πρώτο είναι «**χρήστης αναφέρει ψεύτικη ηρεμία** — του είπαμε ήρεμα και βρήκε
 * κύμα». Αυτό ακριβώς είναι η αναφορά της Σκάλας. ⚠️ ΜΕ ΜΙΑ ΕΠΙΦΥΛΑΞΗ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ
 * ΓΡΑΜΜΕΝΗ: το `live` της αναφοράς ήταν **false** — ο επισκέπτης δεν στεκόταν στην παραλία,
 * κοίταζε άλλη ώρα/μέρα. Δεν είναι μαρτυρία πεδίου, άρα δεν είναι από μόνη της απόδειξη. Η
 * σκανδάλη που τραβάει είναι το ΔΟΜΙΚΟ εύρημα από πάνω, όχι η αναφορά.
 *
 * ΚΑΙ Η ΚΑΤΕΥΘΥΝΣΗ ΕΙΝΑΙ Η ΑΣΦΑΛΗΣ. Ανεβάζοντας τον εκθέτη ο συντελεστής μόνο μεγαλώνει, άρα η
 * σοβαρότητα μόνο ανεβαίνει, άρα το χρώμα μόνο σκουραίνει. **Καμία παραλία δεν μπορεί να βγει πιο
 * ήρεμη** — κατασκευαστικά, όχι κατά τύχη. Ο κανόνας του σπιτιού («ποτέ ψεύτικη ηρεμία») δεν
 * μπορεί να παραβιαστεί από αυτή την αλλαγή· το ρίσκο είναι το ΑΝΤΙΘΕΤΟ, η υπερβολική
 * προειδοποίηση, και αυτό ακριβώς είναι που μετράει το script.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν λέει ποιος εκθέτης είναι ΣΩΣΤΟΣ. Δεν υπάρχει κριτής για το «πόσο ενοχλητικό ήταν το
 *    νερό» — μόνο για το πόσες παραλίες αλλάζουν χρώμα και προς τα πού.
 *  - Επίπεδο ΗΜΕΡΑΣ (day 0), ένας κύκλος πρόγνωσης, άνεμος της περιοχής — ίδια όρια με το
 *    scripts/measureShoreNumberEverywhere.mjs, από το οποίο έχει σηκωθεί ο σκελετός.
 *  - Μία μέρα. Αν πέσει σε ήρεμη μέρα, το δείγμα κοντής περιόδου θα είναι μικρό — το script το
 *    λέει ρητά στην έξοδο αντί να παραστήσει ότι μέτρησε τον Αύγουστο.
 *
 * Run: node scripts/measureChopExponent.mjs [--regions=a,b]
 */
// Routes this script through the PAID Open-Meteo plan when OPEN_METEO_API_KEY is in the
// environment, and changes nothing when it is not. See scripts/lib/paidOpenMeteo.mjs.
import './lib/paidOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
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

const { seaStateSeverityM, waveSteepness, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, SEA_REFERENCE_PERIOD_S } =
  require(path.join(root, 'utils/waveCharacter.ts'));
// Το χρώμα από την ΙΔΙΑ συνάρτηση που καλεί ο χάρτης — αλλιώς η μέτρηση απαντά για μια σκάλα που
// δεν βλέπει κανείς. Το μόνο που αντικαθίσταται είναι ο ΕΝΑΣ αριθμός που εξετάζεται (ο εκθέτης):
// ο εναλλακτικός συντελεστής υπολογίζεται εδώ και περνάει στις πραγματικές συναρτήσεις.
// ⚠️ Το CALMNESS_ORDER έρχεται ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ, ποτέ αντιγραμμένο. Η πρώτη εκδοχή αυτού του
// script έγραψε δικό της ['ideal','good','caution','avoid'] — λεξιλόγιο που δεν υπάρχει· ο
// `resolveConditionTone` επιστρέφει χρώματα. Κάθε αλλαγή έπεφτε τότε στο -1 και καταγραφόταν
// ΑΝΑΠΟΔΑ, δηλαδή το script ανακοίνωνε «ψεύτικη ηρεμία» εκεί που το χρώμα σκούραινε σωστά.
const { resolveConditionTone, CALMNESS_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));


const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const DAY_INDEX = 0;

/** Ο σημερινός εκθέτης, αντιγραμμένος ΜΟΝΟ για να μπορεί το script να τον συγκρίνει με άλλους. */
const CURRENT_EXPONENT = 0.75;
const CURRENT_MAX_FACTOR = 1.75;
/** 1 = ρυθμός συνάντησης · 2 = αποτομότητα · ενδιάμεσα = αυτό που δηλώνει το σχόλιο του κώδικα. */
const CANDIDATE_EXPONENTS = [0.75, 1, 1.25, 1.5, 1.75, 2];
/** Το καπάκι δοκιμάζεται χωριστά από τον εκθέτη — είναι ΔΕΥΤΕΡΟ φράγμα, όχι το ίδιο. */
const CANDIDATE_MAX_FACTORS = [1.75, 2.25, 3];

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** Ο συντελεστής, με τον ΙΔΙΟ τύπο του waveCharacter αλλά ρυθμιζόμενο εκθέτη/καπάκι. */
const factorFor = (periodS, exponent, maxFactor) => {
  if (typeof periodS !== 'number' || !Number.isFinite(periodS) || periodS <= 0) return 1;
  if (periodS >= SEA_REFERENCE_PERIOD_S) return 1;
  return Math.min(maxFactor, Math.max(1, Math.pow(SEA_REFERENCE_PERIOD_S / periodS, exponent)));
};
const severityWith = (waveM, periodS, exponent, maxFactor) => {
  if (typeof waveM !== 'number' || !Number.isFinite(waveM)) return undefined;
  return Number((waveM * factorFor(periodS, exponent, maxFactor)).toFixed(2));
};

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
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

// ⚠️ 150, ΟΧΙ 450. Το 450 σηκώθηκε από το measureShoreNumberEverywhere και **έφαγε 429 από την
// 15η περιοχή και μετά** (15/08/2026, χωρίς κλειδί = free tier). Τα 429 δεν σταματούν το script:
// η περιοχή γυρίζει χωρίς θαλάσσια δεδομένα και οι παραλίες της φιλτράρονται σιωπηλά — δηλαδή η
// μέτρηση θα ανακοίνωνε «εθνική» ενώ είχε χάσει τα 4/5 της χώρας. Γι' αυτό ΚΑΙ ο πιο αργός
// ρυθμός ΚΑΙ ο έλεγχος κενής περιοχής παρακάτω.
const POINTS_PER_MINUTE = Number(args.find(a => a.startsWith('--pace='))?.slice('--pace='.length)) || 150;
const pointWindow = [];
const paceForPoints = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60_000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    const waitMs = Math.max(1000, pointWindow[0].at + 60_000 - performance.now());
    process.stderr.write(`\r  rate limit: ${spent} points, αναμονή ${Math.ceil(waitMs / 1000)}s…        `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

/** Το χρώμα, από την πραγματική συνάρτηση, με τη σοβαρότητα που του δίνουμε. */
const toneFor = (score, seaStateM) => resolveConditionTone({
  exposureLevel: score.exposureLevel,
  beaufort: getBeaufortLevel(score.windSpeedKmph),
  isEnclosedCove: Boolean(score.enclosedCove),
  seaStateM,
  offshoreFlatWater: Boolean(score.offshoreFlatWater),
  downwindSeaSample: Boolean(score.downwindSeaSample),
  swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
  seaArrivalExposureLevel: score.seaArrivalExposureLevel,
});

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
  const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  const rows = [];
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;

    const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
      weatherSource: 'island-fallback',
      hourlyForecast: dayForecast.hourly,
      geospatialProfile: region.profiles[beach.id],
    });

    const waveM = score.seaStateWaveM;
    const periodS = score.seaStatePeriodS;
    if (typeof waveM !== 'number' || !Number.isFinite(waveM)) continue;

    rows.push({
      id: beach.id,
      name: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
      region: region.regionId,
      exposure: score.exposureLevel,
      beaufort: getBeaufortLevel(score.windSpeedKmph),
      waveM,
      periodS: typeof periodS === 'number' && Number.isFinite(periodS) ? periodS : null,
      score,
    });
  }
  // Μια περιοχή με παραλίες που δεν έδωσε ΚΑΜΙΑ γραμμή σημαίνει ότι το θαλάσσιο αίτημα απέτυχε
  // (τυπικά 429). Χωρίς αυτό τον έλεγχο η αποτυχία θα περνούσε ως «μετρήθηκε, δεν βρέθηκε τίποτα».
  if (!rows.length && region.beaches.length) return { regionId: region.regionId, skipped: 'κενή — πιθανό 429 στα θαλάσσια δεδομένα' };
  return { regionId: region.regionId, rows };
};

console.log(`Μέτρηση εκθέτη αποτομότητας — ${regions.length} περιοχές, ζωντανά δεδομένα, ημέρα ${DAY_INDEX}\n`);
console.log(`Σημερινά: CHOP_EXPONENT=${CURRENT_EXPONENT} · MAX_CHOP_FACTOR=${CURRENT_MAX_FACTOR} · T_ref=${SEA_REFERENCE_PERIOD_S}s`);
console.log(`Κατώφλια: κίτρινο ≥${SEA_STATE_AMBER_M} · κόκκινο ≥${SEA_STATE_ROUGH_M}\n`);

const results = [];
for (const [index, region] of regions.entries()) {
  process.stderr.write(`\r  [${index + 1}/${regions.length}] ${region.regionId}…                    `);
  try {
    results.push(await measureRegion(region));
  } catch (error) {
    results.push({ regionId: region.regionId, skipped: String(error?.message ?? error) });
  }
}
process.stderr.write('\r                                                              \r');

const rows = results.flatMap(r => r.rows ?? []);
const skipped = results.filter(r => r.skipped);
if (!rows.length) {
  console.error('Καμία παραλία δεν απάντησε — έλεγξε δίκτυο/quota. Δεν γράφεται αναφορά.');
  process.exit(1);
}

// ── 1. Πόσο συχνά μιλάει καθόλου ο μηχανισμός ────────────────────────────────────────────────
const withPeriod = rows.filter(r => r.periodS != null);
const shortPeriod = withPeriod.filter(r => r.periodS < SEA_REFERENCE_PERIOD_S);
// Το ΔΕΥΤΕΡΟ φράγμα: κύματα που το καπάκι κάνει δομικά ανίκανα να φτάσουν το κίτρινο.
// ⚠️ Μετριέται ΜΟΝΟ πάνω σε κύματα ≥0,40 μ. Χωρίς αυτό το πάτωμα ο αριθμός θα μετρούσε και τα
// 0,15 μ., που ΠΡΕΠΕΙ να είναι σιωπηλά — και θα ανακοίνωνε «88% αποκλεισμένα» για ένα φράγμα
// που στη συντριπτική τους πλειοψηφία κάνει τη σωστή δουλειά.
const CHOP_INTEREST_FLOOR_M = 0.4;
const chopCandidates = shortPeriod.filter(r => r.waveM >= CHOP_INTEREST_FLOOR_M);
const cappedOut = chopCandidates.filter(r => r.waveM * CURRENT_MAX_FACTOR < SEA_STATE_AMBER_M);
// Πού δεσμεύει πραγματικά το καπάκι σήμερα (ο ωμός τύπος θα ζητούσε παραπάνω).
const capBinds = shortPeriod.filter(r => Math.pow(SEA_REFERENCE_PERIOD_S / r.periodS, CURRENT_EXPONENT) > CURRENT_MAX_FACTOR);

console.log('── 1. ΠΟΣΟ ΣΥΧΝΑ ΥΠΑΡΧΕΙ ΚΟΝΤΗ ΠΕΡΙΟΔΟΣ ──────────────────────────────────────────');
console.log(`  Παραλίες που απάντησαν: ${rows.length} · με περίοδο: ${withPeriod.length}`);
console.log(`  Με περίοδο < ${SEA_REFERENCE_PERIOD_S}s (ο μηχανισμός μιλάει): ${shortPeriod.length} (${pct(shortPeriod.length, withPeriod.length)})`);
console.log(`  Από αυτές, με κύμα ≥${CHOP_INTEREST_FLOOR_M}μ (εκεί που η απόφαση έχει νόημα): ${chopCandidates.length}`);
console.log(`  Από ΑΥΤΕΣ, δομικά αδύνατο να φτάσουν το κίτρινο λόγω καπακιού: ${cappedOut.length} (${pct(cappedOut.length, chopCandidates.length)})`);
console.log(`  Όπου το καπάκι 1,75 δεσμεύει τον τύπο σήμερα: ${capBinds.length} (${pct(capBinds.length, shortPeriod.length)} των κοντών)\n`);

// ── 2. Τι κάνει κάθε υποψήφιος εκθέτης ───────────────────────────────────────────────────────
/** CALMNESS_ORDER είναι ['red','orange','yellow','blue'] — ΧΑΜΗΛΟΤΕΡΟΣ δείκτης = πιο άγριο. */
const calmnessRank = (tone) => {
  const i = CALMNESS_ORDER.indexOf(tone);
  if (i === -1) throw new Error(`Άγνωστο χρώμα «${tone}» — το script διαβάζει λάθος λεξιλόγιο.`);
  return i;
};

const lighterExamples = [];
const evaluate = (exponent, maxFactor) => {
  let darker = 0, lighter = 0, unchanged = 0, wokeUp = 0;
  const examples = [];
  for (const row of rows) {
    const before = severityWith(row.waveM, row.periodS, CURRENT_EXPONENT, CURRENT_MAX_FACTOR);
    const after = severityWith(row.waveM, row.periodS, exponent, maxFactor);
    const toneBefore = toneFor(row.score, before);
    const toneAfter = toneFor(row.score, after);
    if (toneBefore === toneAfter) { unchanged += 1; continue; }
    if (calmnessRank(toneAfter) < calmnessRank(toneBefore)) {
      darker += 1;
      // «Ξύπνησε»: ήταν εντελώς σιωπηλό (κάτω από κάθε κατώφλι) και τώρα προειδοποιεί.
      if ((before ?? 0) < SEA_STATE_AMBER_M && (after ?? 0) >= SEA_STATE_AMBER_M) wokeUp += 1;
      if (examples.length < 10) {
        examples.push({
          name: row.name, region: row.region, exposure: row.exposure, beaufort: row.beaufort,
          waveM: row.waveM, periodS: row.periodS, before, after, toneBefore, toneAfter,
        });
      }
    } else {
      // Δεν πρέπει ΠΟΤΕ να συμβεί: ο εκθέτης μόνο μεγαλώνει τον συντελεστή, άρα η σοβαρότητα
      // μόνο ανεβαίνει. Αν εμφανιστεί έστω ένα, υπάρχει μη-μονότονο μονοπάτι στο χρώμα και αυτό
      // είναι σοβαρότερο εύρημα από τον ίδιο τον εκθέτη — γι' αυτό κρατιέται παράδειγμα.
      lighter += 1;
      if (lighterExamples.length < 10) {
        lighterExamples.push({
          name: row.name, region: row.region, exposure: row.exposure, beaufort: row.beaufort,
          waveM: row.waveM, periodS: row.periodS, before, after, toneBefore, toneAfter, exponent, maxFactor,
        });
      }
    }
  }
  return { exponent, maxFactor, darker, lighter, unchanged, wokeUp, examples };
};

console.log('── 2. ΤΙ ΚΑΝΕΙ ΚΑΘΕ ΕΚΘΕΤΗΣ (καπάκι στο σημερινό 1,75) ─────────────────────────────');
console.log('  εκθέτης   σκουραίνει   ξυπνάει σιωπηλό   ΞΑΝΟΙΓΕΙ(⚠️)   αμετάβλητες');
const byExponent = [];
for (const exponent of CANDIDATE_EXPONENTS) {
  const r = evaluate(exponent, CURRENT_MAX_FACTOR);
  byExponent.push(r);
  const flag = r.lighter > 0 ? ' ⛔ ΨΕΥΤΙΚΗ ΗΡΕΜΙΑ' : '';
  console.log(`  ${String(exponent).padEnd(9)} ${String(r.darker).padStart(10)} ${String(r.wokeUp).padStart(17)} ${String(r.lighter).padStart(13)} ${String(r.unchanged).padStart(13)}${flag}`);
}

// ── 2β. Η ΣΙΩΠΗΛΗ ΖΩΝΗ ─────────────────────────────────────────────────────────────────────
// Η περίπτωση Σκάλας: το χρώμα λέει ήρεμα, το νερό είναι σπαστό, και ΚΑΜΙΑ λέξη δεν το αναφέρει
// (το `isShortPeriodSea` υπάρχει από 28/07 και δεν το καλεί κανείς). Πριν γραφτεί οποιοδήποτε
// κείμενο πρέπει να ξέρουμε σε πόσες παραλίες θα έβγαινε: πάνω από ~15% γίνεται μόνιμη ταμπέλα,
// που είναι ρητά απαγορευμένο (no-permanent-uncertainty-labels).
const CALM_TONES = new Set(['blue', 'yellow']);
const silentZone = rows.filter(r =>
  r.periodS != null && r.periodS < SEA_REFERENCE_PERIOD_S
  && r.waveM >= CHOP_INTEREST_FLOOR_M
  && CALM_TONES.has(toneFor(r.score, severityWith(r.waveM, r.periodS, CURRENT_EXPONENT, CURRENT_MAX_FACTOR)))
);
// Η σκέτη περίοδος δίνει 14,2% — κάτω από το όριο αλλά ΟΡΙΑΚΑ, και η περίοδος από μόνη της δεν
// λέει πόσο απότομο είναι το νερό (0,2 μ. στα 3 δλ δεν ενοχλεί κανέναν). Η αποτομότητα Hs/L0 το
// λέει, και υπάρχει ήδη στον κώδικα. Δοκιμάζονται κατώφλια για να διαλεχθεί ένα που μιλάει όταν
// πρέπει χωρίς να γίνει ταμπέλα.
const STEEPNESS_GATES = [0.03, 0.035, 0.04, 0.045, 0.05];
const steepnessShares = STEEPNESS_GATES.map(gate => {
  const hits = silentZone.filter(r => waveSteepness(r.waveM, r.periodS) >= gate);
  return { gate, beaches: hits.length, share: hits.length / Math.max(1, rows.length) };
});
const steepest = [...silentZone].sort((a, b) => a.periodS - b.periodS).slice(0, 8);
console.log('\n── 2β. Η ΣΙΩΠΗΛΗ ΖΩΝΗ (χρώμα ήρεμο + κοντή περίοδος + κύμα που το νιώθεις) ─────────');
console.log(`  Παραλίες: ${silentZone.length} (${pct(silentZone.length, rows.length)} του συνόλου)`);
console.log(`  ${silentZone.length / Math.max(1, rows.length) > 0.15 ? '⛔ ΠΑΝΩ ΑΠΟ 15% — κείμενο εδώ θα γινόταν μόνιμη ταμπέλα.' : '✅ Κάτω από 15% — μια πρόταση εδώ δεν γίνεται ταμπέλα.'}`);
console.log('  Με πύλη αποτομότητας Hs/L0:');
for (const s of steepnessShares) {
  console.log(`    ≥${s.gate}: ${String(s.beaches).padStart(4)} παραλίες (${(s.share * 100).toFixed(1)}% του συνόλου)`);
}
if (steepest.length) {
  console.log('  Τα πιο απότομα:');
  for (const s of steepest) console.log(`    ${s.name} (${s.region}, ${s.beaufort}Μπφ): ${s.waveM}μ @ ${s.periodS}s`);
}

console.log('\n── 3. ΤΙ ΚΑΝΕΙ ΤΟ ΚΑΠΑΚΙ (εκθέτης στο σημερινό 0,75) ───────────────────────────────');
console.log('  καπάκι    σκουραίνει   ξυπνάει σιωπηλό   ΞΑΝΟΙΓΕΙ(⚠️)   αμετάβλητες');
const byMaxFactor = [];
for (const maxFactor of CANDIDATE_MAX_FACTORS) {
  const r = evaluate(CURRENT_EXPONENT, maxFactor);
  byMaxFactor.push(r);
  console.log(`  ${String(maxFactor).padEnd(9)} ${String(r.darker).padStart(10)} ${String(r.wokeUp).padStart(17)} ${String(r.lighter).padStart(13)} ${String(r.unchanged).padStart(13)}`);
}

const combined = evaluate(1.5, 2.25);
console.log('\n── 4. ΚΑΙ ΤΑ ΔΥΟ ΜΑΖΙ (εκθέτης 1,5 · καπάκι 2,25) ─────────────────────────────────');
console.log(`  σκουραίνει ${combined.darker} · ξυπνάει σιωπηλό ${combined.wokeUp} · ξανοίγει ${combined.lighter} · αμετάβλητες ${combined.unchanged}`);
if (combined.examples.length) {
  console.log('\n  Παραδείγματα (σημερινό → νέο):');
  for (const e of combined.examples) {
    console.log(`    ${e.name} (${e.region}, ${e.exposure}, ${e.beaufort}Μπφ): ${e.waveM}μ @ ${e.periodS}s · ${e.before} → ${e.after} μ. · ${e.toneBefore} → ${e.toneAfter}`);
  }
}

if (lighterExamples.length) {
  console.log('\n  ⛔ ΜΗ-ΜΟΝΟΤΟΝΟ ΜΟΝΟΠΑΤΙ — περισσότερο κύμα έδωσε ΠΙΟ ΗΡΕΜΟ χρώμα. Αυτό είναι bug,');
  console.log('     όχι αποτέλεσμα της δοκιμής. Δες τα πριν πιστέψεις οτιδήποτε παραπάνω:');
  for (const e of lighterExamples.slice(0, 5)) {
    console.log(`    ${e.name} (${e.region}, exp ${e.exponent}): ${e.before} → ${e.after} μ. · ${e.toneBefore} → ${e.toneAfter}`);
  }
}

if (skipped.length) console.log(`\n  ⚠️ Περιοχές που δεν απάντησαν: ${skipped.length} (${skipped.slice(0, 5).map(s => s.regionId).join(', ')}${skipped.length > 5 ? '…' : ''})`);
if (shortPeriod.length < 50) {
  console.log('\n  ⚠️ ΜΙΚΡΟ ΔΕΙΓΜΑ ΚΟΝΤΗΣ ΠΕΡΙΟΔΟΥ. Σήμερα δεν είχε πολύ σπαστό κύμα εθνικά. Η μέτρηση');
  console.log('     δεν είναι λάθος, αλλά δεν αντιπροσωπεύει τον Αύγουστο — ξανατρέξ\' την σε μέρα μελτεμιού.');
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'chop-exponent.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  dayIndex: DAY_INDEX,
  current: { exponent: CURRENT_EXPONENT, maxFactor: CURRENT_MAX_FACTOR, referencePeriodS: SEA_REFERENCE_PERIOD_S },
  thresholds: { amberM: SEA_STATE_AMBER_M, roughM: SEA_STATE_ROUGH_M },
  regionsAsked: regions.length,
  regionsAnswered: results.filter(r => r.rows).length,
  beaches: rows.length,
  withPeriod: withPeriod.length,
  shortPeriod: shortPeriod.length,
  chopCandidates: chopCandidates.length,
  chopInterestFloorM: CHOP_INTEREST_FLOOR_M,
  silentZone: silentZone.length,
  silentZoneShare: Number((silentZone.length / Math.max(1, rows.length)).toFixed(4)),
  silentZoneSteepnessGates: steepnessShares.map(s => ({ gate: s.gate, beaches: s.beaches, share: Number(s.share.toFixed(4)) })),
  silentZoneSteepest: steepest.map(s => ({ id: s.id, name: s.name, region: s.region, beaufort: s.beaufort, waveM: s.waveM, periodS: s.periodS })),
  structurallyCappedOut: cappedOut.length,
  capBinds: capBinds.length,
  byExponent: byExponent.map(({ examples, ...rest }) => rest),
  byMaxFactor: byMaxFactor.map(({ examples, ...rest }) => rest),
  combined: { exponent: 1.5, maxFactor: 2.25, darker: combined.darker, lighter: combined.lighter, wokeUp: combined.wokeUp, unchanged: combined.unchanged },
  examples: combined.examples,
  skipped: skipped.map(s => ({ regionId: s.regionId, reason: s.skipped })),
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
