/**
 * ΤΙ ΕΒΑΨΕ ΤΗΝ ΠΑΡΑΛΙΑ — Ο ΑΕΡΑΣ Ή Η ΘΑΛΑΣΣΑ; ΜΕΤΡΗΣΗ, ΜΗΔΕΝ UI.
 *
 * ΤΙ ΖΗΤΗΘΗΚΕ (Μίλτος, 15/08/2026): «το πορτοκαλί ή το κόκκινο μπορεί να σημαίνει ότι η θάλασσα
 * είναι λάδι αλλά έχει αέρα· ο κόσμος όταν βλέπει πορτοκαλί θεωρεί ότι θα έχει πολύ κύμα».
 * Παράδειγμα: Βάι, 6 Μποφόρ απόγειος, κύμα ~0,1 μ., πινέζα πορτοκαλί.
 *
 * ΤΟ ΒΗΜΑ 1 ΤΟΥ ΣΧΕΔΙΟΥ (docs/team/HANDOVER-colour-cause-line.md §5) ΚΑΙ Η ΠΥΛΗ ΤΟΥ:
 * πριν γραφτεί μία γραμμή UI, μετράμε αν το πρόβλημα υπάρχει και πόσο συχνά. 🛑 Αν πάνω από
 * 60% των πορτοκαλί έχει λάδι νερό, ΔΕΝ έχουμε πρόβλημα σήμανσης — έχουμε πρόβλημα κλίμακας,
 * και η γραμμή αιτίας θα ήταν ταπετσαρία πάνω σε λάθος χρώμα.
 *
 * ΠΟΙΟΣ ΑΠΑΝΤΑΕΙ ΤΗΝ ΑΙΤΙΑ: το ΠΡΟΪΟΝ, όχι αυτό το αρχείο. Η μέτρηση καλεί
 * `describeConditionCause` και `resolveCauseLineForm` (utils/conditionCause.ts) — τις ίδιες
 * συναρτήσεις που θα καλέσει ο χάρτης. Αν το αρχείο έκρινε με δικούς του κανόνες, θα έλεγε
 * «όλα καλά» για κώδικα που κάνει άλλα. Η τρίτη αιτία («ετυμηγορία») δεν ήταν στο σχέδιο και
 * μετριέται χωριστά ακριβώς για να φανεί το μέγεθός της.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν κρίνει αν το χρώμα είναι ΣΩΣΤΟ. Μετράει μόνο ποιος από τους δύο άξονες το έβαλε.
 *  - Άνεμος περιοχής, όχι ο τοπικός του κάθε cluster (ίδιο όριο με
 *    scripts/measureShoreNumberEverywhere.mjs, από το οποίο κρατάει το μοτίβο, το pacing και
 *    τον υπολογισμό του αριθμού ακτής). Ο χάρτης δίνει στην πινέζα τον τοπικό — άρα σε
 *    παραλίες με δικό τους άνεμο η αιτία μπορεί να διαφέρει· στο Βάι ο τοπικός είναι ΠΙΟ
 *    δυνατός, δηλαδή η μέτρηση εδώ ΥΠΟΕΚΤΙΜΑ τα «φταίει ο αέρας».
 *  - Δείγμα = ΜΕΡΕΣ (0..N-1 του κύκλου πρόγνωσης), όχι ώρες. Οι ώρες της ίδιας μέρας είναι
 *    σχεδόν ίδιος καιρός· πέντε μέρες πιάνουν και μελτέμι και άπνοια. Η ωριαία σάρωση θα
 *    απαιτούσε αντιγραφή του adjustDailyForecastToHour (App.tsx:762, δεν είναι exported) —
 *    δεύτερο αντίγραφο κανόνα, ακριβώς ό,τι απαγορεύει το §Κ1 του ΠΟΡΙΣΜΑΤΟΣ.
 *  - Ο χάρτης εξαιρεί κάποιες παραλίες από το tally (uncountedBeachIds)· εδώ μετράνε όλες.
 *
 * Run: node scripts/measureColourCauseSplit.mjs --live [--regions=a,b] [--days=5]
 */
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

const { shoreSeaStateM, seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
// Τα τρία βήματα του χρώματος + οι δύο βοηθοί της εξαίρεσης του όρμου, από το ίδιο αρχείο που
// βάφει την πινέζα. Καμία αναπαραγωγή κανόνα: αν αλλάξει η κλίμακα, αλλάζει και η μέτρηση.
const { CALMNESS_ORDER, LEGEND_TONE_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));
// Η ΑΙΤΙΑ ΚΑΙ Η ΜΟΡΦΗ ΤΗΣ ΓΡΑΜΜΗΣ ΕΡΧΟΝΤΑΙ ΑΠΟ ΤΟ ΠΡΟΪΟΝ, ΟΧΙ ΑΠΟ ΤΗ ΜΕΤΡΗΣΗ. Αλλιώς το αρχείο
// θα μετρούσε τους δικούς του κανόνες και θα έλεγε «όλα καλά» για κώδικα που λέει άλλα.
const {
  describeConditionCause, resolveCauseLineForm, causeLineMaySpeak,
  FLAT_WATER_SEA_STATE_M, CAUSE_LINE_DOMINANCE,
} = require(path.join(root, 'utils/conditionCause.ts'));
const { holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.error('Χρειάζεται --live: η μέτρηση τραβάει πραγματική πρόγνωση για κάθε περιοχή.');
  process.exit(1);
}
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 5);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const cachePath = path.join(root, '.tmp/colour-cause-split-cache.json');

/** «Λάδι νερό» — το νερό ΤΗΣ ΑΚΤΗΣ, ο ορισμός του προϊόντος (utils/conditionCause). */
const FLAT_WATER_M = FLAT_WATER_SEA_STATE_M;

/**
 * Αλλάζει ΜΟΝΟ όταν αλλάζουν τα πεδία που αποθηκεύει η κάθε γραμμή. Χωρίς αυτό, μια παλιά μνήμη
 * θα γέμιζε τη σύνοψη με `undefined` και το αρχείο θα τύπωνε ήρεμα μηδενικά.
 */
const ROW_VERSION = 2;

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const bump = (obj, key, by = 1) => { obj[key] = (obj[key] ?? 0) + by; };

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

const POINTS_PER_MINUTE = 450;
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
  const days = processForecastData(mergeMarineForecastData(wind.data, regionMarine)).slice(0, DAYS);
  if (!days.length) return { regionId: region.regionId, skipped: 'no forecast day' };

  const rows = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex += 1) {
    const regionDay = days[dayIndex];
    for (const beach of region.beaches) {
      const key = resolution.keyByBeachId.get(beach.id);
      const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
      const dayForecast = beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay;

      const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      });

      const profile = region.profiles[beach.id];
      const windDirectionDeg = dayForecast.wind?.deg;
      const beaufort = getBeaufortLevel(score.windSpeedKmph ?? (dayForecast.wind?.speed ?? 0) * 3.6);
      const seaStateM = seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS);
      const offshoreFlatWater = holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort });

      // ΟΛΟΚΛΗΡΗ η ανάγνωση του προϊόντος μπαίνει στη γραμμή, ώστε η σύνοψη παρακάτω να ρωτάει
      // ακριβώς ό,τι θα ρωτήσει ο χάρτης — καμία ενδιάμεση μετάφραση, τίποτα να ξεσυγχρονιστεί.
      const reading = describeConditionCause({
        exposureLevel: score.exposureLevel,
        beaufort,
        isEnclosedCove: Boolean(score.enclosedCove),
        seaStateM,
        offshoreFlatWater,
        downwindSeaSample: hasDownwindSeaSample({
          profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
        }),
        swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
      });

      // Ο αριθμός που τυπώνει η κάρτα σήμερα — ίδια συνταγή με
      // scripts/measureShoreNumberEverywhere.mjs:180-197, ώστε τα δύο αρχεία να λένε το ίδιο.
      const displayM = Number.isFinite(score.waveHeightM) ? score.waveHeightM : null;
      const decisionM = Number.isFinite(score.seaStateWaveM) ? score.seaStateWaveM : null;
      const modelShoreM = Number.isFinite(score.shoreWaveHeightM) ? score.shoreWaveHeightM : null;
      const dampedM = shoreSeaStateM(decisionM ?? undefined, score.exposureLevel, score.seaArrivalExposureLevel);
      const shoreRaw = modelShoreM !== null
        ? Math.min(modelShoreM, typeof dampedM === 'number' ? dampedM : modelShoreM)
        : (typeof dampedM === 'number' ? dampedM : null);
      const shoreM = shoreRaw === null ? displayM : (displayM !== null ? Math.min(shoreRaw, displayM) : shoreRaw);

      rows.push({
        ...reading,
        dayIndex,
        beachId: beach.id,
        name: beach.name?.gr ?? null,
        severityM: typeof seaStateM === 'number' ? Number(seaStateM.toFixed(2)) : null,
        cardShoreM: shoreM === null ? null : Number(shoreM.toFixed(2)),
        exposureLevel: score.exposureLevel ?? null,
      });
    }
  }

  return { regionId: region.regionId, days: days.length, rows };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

/**
 * Η μνήμη κρατάει ΩΜΕΣ ΓΡΑΜΜΕΣ ανά παραλία — η σύνοψη ξαναχτίζεται σε κάθε τρέξιμο, οπότε αλλαγή
 * στην ανάλυση δεν ξαναζητάει πρόγνωση. Γι' αυτό η σφραγίδα κοιτάει μόνο τα τρία αρχεία που
 * παράγουν τις γραμμές (χρώμα, scoring, κύμα) και τη μέρα. Αν αλλάξει η measureRegion, σβήσε το
 * .tmp/colour-cause-split-cache.json με το χέρι.
 */
const codeStamp = [
  'utils/suitabilityTone.ts',
  'services/recommendationService.ts',
  'utils/waveCharacter.ts',
  'utils/conditionCause.ts',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + `@${new Date().toISOString().slice(0, 10)}@d${DAYS}@r${ROW_VERSION}`;

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
} catch { /* first run */ }

const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));
console.log(`── ΖΩΝΤΑΝΟ: ${regions.length - toFetch.length} από μνήμη, ${toFetch.length} νέες · ${DAYS} μέρες ──`);
for (const region of toFetch) {
  let result = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      result = await measureRegion(region);
    } catch (error) {
      result = { regionId: region.regionId, skipped: error.message };
    }
    if (regionComplete(result)) break;
    await sleep([20000, 45000, 90000][attempt] ?? 0);
  }
  if (result?.regionId) cache[result.regionId] = result;
  process.stderr.write(`\r  ${Object.keys(cache).length}/${regions.length} περιοχές            `);
  await sleep(250);
}
process.stderr.write('\n');
mkdirSync(path.dirname(cachePath), { recursive: true });
writeFileSync(cachePath, JSON.stringify({ codeStamp, regions: cache }));

const results = regions.map(region => cache[region.regionId]).filter(regionComplete);

// ── ΑΝΑ ΠΑΡΑΛΙΑ ────────────────────────────────────────────────────────────────────────────
const perTone = {};
const totals = { rows: 0, byCause: {}, sixPlusFlat: 0, sixPlus: 0, vaiClass: [] };

for (const result of results) {
  for (const row of result.rows) {
    totals.rows += 1;
    bump(totals.byCause, row.cause);
    // `flat` = ΤΟ ΝΕΡΟ ΤΗΣ ΑΚΤΗΣ, ο ορισμός που κρίνει το προϊόν (utils/conditionCause).
    // `flatOpen` = το ανοιχτό νερό, μόνο για να φαίνεται πόσο διαφορετική είναι η ερώτηση.
    const flat = row.shoreSeaStateM != null && row.shoreSeaStateM < FLAT_WATER_M;
    const flatOpen = row.severityM !== null && row.severityM < FLAT_WATER_M;
    if (row.beaufort >= 6) {
      totals.sixPlus += 1;
      if (flat) totals.sixPlusFlat += 1;
    }

    perTone[row.tone] ??= {
      beaches: 0, wind: 0, sea: 0, verdict: 0, flat: 0, flatOpen: 0,
      windAndFlat: 0, avoid: 0, offshore: 0, sixPlus: 0,
    };
    const bucket = perTone[row.tone];
    bucket.beaches += 1;
    bucket[row.cause] += 1;
    if (flat) bucket.flat += 1;
    if (flatOpen) bucket.flatOpen += 1;
    if (flat && row.cause === 'wind') bucket.windAndFlat += 1;
    if (row.swimVerdictAvoid) bucket.avoid += 1;
    if (row.offshoreFlatWater) bucket.offshore += 1;
    if (row.beaufort >= 6) bucket.sixPlus += 1;

    // Η κλάση Βάι: το χρώμα το έβαλε ο αέρας, το νερό είναι λάδι, και το χρώμα τρομάζει.
    if (flat && row.cause === 'wind' && (row.tone === 'orange' || row.tone === 'red') && totals.vaiClass.length < 20) {
      totals.vaiClass.push({
        region: result.regionId, name: row.name, day: row.dayIndex, tone: row.tone,
        beaufort: row.beaufort, shoreM: row.shoreSeaStateM, cardShoreM: row.cardShoreM,
        avoid: row.swimVerdictAvoid, offshore: row.offshoreFlatWater,
      });
    }
  }
}

// ── ΑΝΑ ΧΡΩΜΑΤΙΚΗ ΟΜΑΔΑ (περιοχή × μέρα × χρώμα) — ΑΥΤΟ ΘΑ ΤΥΠΩΝΕΙ Η ΓΡΑΜΜΗ ────────────────
// Η ΜΟΡΦΗ ΤΗΝ ΑΠΟΦΑΣΙΖΕΙ ΤΟ utils/conditionCause.ts, ΟΧΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Το μόνο που κάνει εδώ
// η μέτρηση είναι να μαζέψει τις παραλίες ανά χρώμα και να ρωτήσει το προϊόν τι θα έγραφε.
const groups = [];
for (const result of results) {
  const byKey = new Map();
  for (const row of result.rows) {
    const key = `${row.dayIndex}|${row.tone}`;
    if (!byKey.has(key)) byKey.set(key, { regionId: result.regionId, dayIndex: row.dayIndex, tone: row.tone, readings: [] });
    // Η γραμμή ΕΙΝΑΙ η ανάγνωση του προϊόντος, αυτούσια — τίποτα δεν ξαναχτίζεται εδώ.
    byKey.get(key).readings.push(row);
  }
  for (const group of byKey.values()) {
    groups.push({ ...group, beaches: group.readings.length, form: resolveCauseLineForm(group.readings) ?? 'σιωπή' });
  }
}

const formsByTone = {};
const formTotals = {};
for (const group of groups) {
  formsByTone[group.tone] ??= {};
  bump(formsByTone[group.tone], group.form);
  bump(formTotals, group.form);
}

const screens = new Map();
for (const group of groups) {
  const key = `${group.regionId}|${group.dayIndex}`;
  if (!screens.has(key)) screens.set(key, []);
  screens.get(key).push(group);
}

/**
 * ΤΙ ΤΥΠΩΝΕΤΑΙ ΤΕΛΙΚΑ ΣΕ ΜΙΑ ΟΘΟΝΗ — δύο πολιτικές, γιατί η διαφορά τους είναι όλη η απόφαση.
 *
 * «ανοιχτή»: κάθε chip μιλάει όποτε έχει κάτι να πει (ό,τι περιγράφει το σχέδιο σήμερα).
 * «περιορισμένη»: το ΜΠΛΕ ποτέ (η λέξη «Ιδανικές» δεν τρόμαξε ποτέ κανέναν — δεν υπάρχει
 *   παρανόηση να λυθεί), το ΚΙΤΡΙΝΟ μόνο στη μορφή κινδύνου (το σενάριο του κλειδώματος 4:
 *   κίτρινη στα 5 Μπφ με λάδι νερό και τον αέρα προς τα έξω), πορτοκαλί και κόκκινο ελεύθερα.
 * Και στις δύο μπαίνει το φρένο επανάληψης του §7: αν το πιο σοβαρό χρώμα έγραψε ήδη τη φράση,
 * το επόμενο σιωπά.
 */
const restrict = (group) => (causeLineMaySpeak(group.tone, group.form === 'σιωπή' ? null : group.form)
  ? group.form
  : 'σιωπή');

const policyStats = (formOf) => {
  const stats = { screensWithLine: 0, screensWithRepeat: 0, printed: {}, silencedByRepeat: 0, lines: 0 };
  for (const screenGroups of screens.values()) {
    const seen = new Set();
    let spoke = false;
    let repeated = false;
    // Πιο σοβαρό χρώμα πρώτο — CALMNESS_ORDER τρέχει κόκκινο → μπλε.
    const ordered = [...screenGroups].sort((a, b) => CALMNESS_ORDER.indexOf(a.tone) - CALMNESS_ORDER.indexOf(b.tone));
    for (const group of ordered) {
      const form = formOf(group);
      if (form === 'σιωπή') continue;
      if (seen.has(form)) { repeated = true; stats.silencedByRepeat += 1; continue; }
      seen.add(form);
      spoke = true;
      stats.lines += 1;
      bump(stats.printed, `${group.tone}/${form}`);
    }
    if (spoke) stats.screensWithLine += 1;
    if (repeated) stats.screensWithRepeat += 1;
  }
  return stats;
};

const openPolicy = policyStats(group => group.form);
const restrictedPolicy = policyStats(restrict);
const screensWithLine = openPolicy.screensWithLine;
const screensWithRepeat = openPolicy.screensWithRepeat;

// ── ΤΥΠΩΜΑ ─────────────────────────────────────────────────────────────────────────────────
console.log(`\nΠεριοχές: ${results.length}/${regions.length} · μετρήσεις παραλία×μέρα: ${totals.rows} · οθόνες (περιοχή×μέρα): ${screens.size}`);

console.log('\n── ΠΟΙΟΣ ΒΑΖΕΙ ΤΟ ΧΡΩΜΑ ───────────────────────────────────────────────');
for (const [cause, count] of Object.entries(totals.byCause).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cause}: ${count} (${pct(count, totals.rows)})`);
}
console.log(`  6+ Μποφόρ: ${totals.sixPlus} · από αυτές με νερό <${FLAT_WATER_M} μ.: ${totals.sixPlusFlat} (${pct(totals.sixPlusFlat, totals.sixPlus)})`);

console.log('\n── ΑΝΑ ΧΡΩΜΑ (παραλία × μέρα) ─────────────────────────────────────────');
for (const tone of LEGEND_TONE_ORDER) {
  const bucket = perTone[tone];
  if (!bucket) continue;
  console.log(`  ${tone}: ${bucket.beaches} · από αέρα ${pct(bucket.wind, bucket.beaches)} · από κύμα ${pct(bucket.sea, bucket.beaches)} · από ετυμηγορία ${pct(bucket.verdict, bucket.beaches)}`);
  console.log(`      λάδι νερό (<${FLAT_WATER_M} μ. στην ακτή): ${bucket.flat} (${pct(bucket.flat, bucket.beaches)}) · από αυτές με αιτία τον αέρα: ${bucket.windAndFlat} (${pct(bucket.windAndFlat, bucket.beaches)}) · [ανοιχτά: ${pct(bucket.flatOpen, bucket.beaches)}]`);
  console.log(`      «μην κολυμπήσεις»: ${pct(bucket.avoid, bucket.beaches)} · απόγειος: ${pct(bucket.offshore, bucket.beaches)} · 6+ Μπφ: ${pct(bucket.sixPlus, bucket.beaches)}`);
}

const orange = perTone.orange ?? { beaches: 0, flat: 0, windAndFlat: 0 };
const orangeFlatShare = orange.flat / Math.max(1, orange.beaches);
console.log('\n── 🛑 Η ΠΥΛΗ ΤΟΥ ΒΗΜΑΤΟΣ 1 ────────────────────────────────────────────');
console.log(`  Πορτοκαλί με λάδι νερό: ${pct(orange.flat, orange.beaches)} (κατώφλι διακοπής: 60%)`);
console.log(`  ${orangeFlatShare > 0.6
  ? '🛑 ΣΤΑΜΑΤΑΜΕ — δεν είναι πρόβλημα σήμανσης, είναι πρόβλημα κλίμακας.'
  : '✅ ΣΥΝΕΧΙΖΟΥΜΕ — το πορτοκαλί ΔΕΝ σημαίνει συνήθως λάδι νερό.'}`);

console.log('\n── ΤΙ ΘΑ ΕΓΡΑΦΕ Η ΓΡΑΜΜΗ (ομάδες περιοχή × μέρα × χρώμα) ──────────────');
const groupTotal = groups.length;
for (const [form, count] of Object.entries(formTotals).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${form}: ${count} (${pct(count, groupTotal)})`);
}
console.log(`  ➜ οθόνες με έστω μία γραμμή: ${screensWithLine} (${pct(screensWithLine, screens.size)}) · με ΔΥΟ ΙΔΙΕΣ γραμμές: ${screensWithRepeat} (${pct(screensWithRepeat, screens.size)})`);

console.log('\n── ΤΑΠΕΤΣΑΡΙΑ Ή ΟΧΙ: ΟΙ ΔΥΟ ΠΟΛΙΤΙΚΕΣ ────────────────────────────────');
for (const [name, stats] of [['ανοιχτή (όλα τα chips)', openPolicy], ['περιορισμένη (μόνο όσα τρομάζουν)', restrictedPolicy]]) {
  console.log(`  ${name}: οθόνες με γραμμή ${stats.screensWithLine} (${pct(stats.screensWithLine, screens.size)}) · γραμμές συνολικά ${stats.lines} · σιωπηλές από επανάληψη ${stats.silencedByRepeat}`);
  console.log(`      ${Object.entries(stats.printed).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ') || '—'}`);
}

console.log('\n── ΑΝΑ ΧΡΩΜΑ, ΠΟΙΑ ΜΟΡΦΗ ─────────────────────────────────────────────');
for (const tone of LEGEND_TONE_ORDER) {
  if (!formsByTone[tone]) continue;
  const entries = Object.entries(formsByTone[tone]).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((acc, [, n]) => acc + n, 0);
  console.log(`  ${tone}: ${entries.map(([form, n]) => `${form} ${pct(n, sum)}`).join(' · ')}`);
}

if (totals.vaiClass.length) {
  console.log('\n  Κλάση Βάι (αέρας έβαψε, νερό λάδι, χρώμα τρομακτικό):');
  for (const example of totals.vaiClass.slice(0, 8)) {
    console.log(`    ${example.name} (${example.region}, μέρα ${example.day}): ${example.tone} · ${example.beaufort} Μπφ · ${example.shoreM} μ.`
      + `${example.avoid ? ' · «μην κολυμπήσεις»' : ''}${example.offshore ? ' · απόγειος' : ''}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'colour-cause-split.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  days: DAYS,
  flatWaterM: FLAT_WATER_M,
  dominance: CAUSE_LINE_DOMINANCE,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  rows: totals.rows,
  screens: screens.size,
  byCause: totals.byCause,
  sixPlus: totals.sixPlus,
  sixPlusFlat: totals.sixPlusFlat,
  perTone,
  orangeFlatShare: Number(orangeFlatShare.toFixed(3)),
  gate: orangeFlatShare > 0.6 ? 'STOP' : 'GO',
  groups: groupTotal,
  formTotals,
  formsByTone,
  screensWithLine,
  screensWithRepeat,
  policies: { open: openPolicy, restricted: restrictedPolicy },
  examples: totals.vaiClass,
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
