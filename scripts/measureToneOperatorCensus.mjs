/**
 * ΠΟΙΟΣ ΒΑΦΕΙ ΤΗΝ ΕΛΛΑΔΑ; — ΑΠΟΓΡΑΦΗ ΤΩΝ ΤΕΛΕΣΤΩΝ ΤΟΥ ΧΡΩΜΑΤΟΣ
 *
 * ΤΡΙΑ ΕΡΩΤΗΜΑΤΑ ΤΗΣ ΑΝΕΞΑΡΤΗΤΗΣ ΑΞΙΟΛΟΓΗΣΗΣ (§ΑΞ1, 21/08/2026), ΕΝΑ ΠΕΡΑΣΜΑ:
 *
 *   Α7 · ΑΠΟΓΡΑΦΗ. Το χρώμα περνάει από τέσσερις τελεστές (σκάλα ανέμου → ταβάνι θάλασσας →
 *        δάπεδο «Ιδανική» → ταβάνι ετυμηγορίας) και τρεις πόρτες που το ΑΝΟΙΓΟΥΝ (3 Μπφ, 4 Μπφ,
 *        5 Μπφ). Κανείς δεν έχει μετρήσει ΠΟΙΟΣ αποφασίζει στην πράξη. Χωρίς αυτό, κάθε νέος
 *        κανόνας προστίθεται στα τυφλά πάνω σε στοίβα που δεν ξέρουμε πώς κατανέμεται.
 *
 *   Α2 · ΤΟ ΠΑΡΑΘΥΡΟ ΤΟΥ ΟΡΜΟΥ. Η εξαίρεση του κλειστού όρμου από το ταβάνι θάλασσας ισχύει
 *        ΜΟΝΟ ακριβώς στα 5 Μποφόρ — κληρονομιά του καταργημένου πράσινου χρώματος (02/08).
 *        Η δικαιολογία της («το κελί ~10 χλμ δεν βλέπει μέσα σε κόλπο 50 μ.») ΔΕΝ εξαρτάται από
 *        την ένταση του ανέμου. Πόσες παραλιο-ημέρες αφορά, και τι λέει η ετυμηγορία σε αυτές;
 *
 *   Α4 · ΤΟ ×0,5 ΩΣ ΖΩΝΗ ΑΒΕΒΑΙΟΤΗΤΑΣ. Η απόσβεση της προστατευμένης ακτής δεν έχει εξωτερικό
 *        κριτή (§7δ) και σήμερα τη διαβάζουν ΠΕΝΤΕ αποφάσεις. Δεν μπορούμε να μάθουμε την
 *        «αληθινή» τιμή χωρίς όργανο στην ακτή — μπορούμε όμως να μετρήσουμε ΠΟΣΟ ΚΡΕΜΕΤΑΙ πάνω
 *        της: τι αλλάζει στο χρώμα και στη ζώνη του τυπωμένου αριθμού αν είναι 0,35 ή 0,65.
 *
 * ΚΑΜΙΑ ΑΛΛΑΓΗ ΜΟΝΤΕΛΟΥ. Καθαρή μέτρηση: κανένα κατώφλι δεν κουνιέται, τίποτα δεν γράφεται
 * εκτός από την αναφορά.
 *
 * ΠΩΣ ΑΠΟΦΕΥΓΕΤΑΙ Η «ΔΕΥΤΕΡΗ ΣΥΝΤΑΓΗ». Η απογραφή χρειάζεται τα ΕΝΔΙΑΜΕΣΑ χρώματα, που το
 * `resolveConditionTone` δεν επιστρέφει. Τα υπολογίζουμε με τις ΙΔΙΕΣ exported συναρτήσεις, στην
 * ίδια σειρά — και μετά **επαληθεύουμε** ότι η σύνθεσή μας δίνει byte-identical αποτέλεσμα με
 * το πραγματικό `resolveConditionTone` σε ΚΑΘΕ γραμμή (`composeMismatch`). Αν κάποιος αλλάξει τη
 * σειρά μέσα στο `resolveConditionTone`, αυτή η μέτρηση σπάει θορυβωδώς αντί να ψεύδεται σιωπηλά.
 * Ο τελευταίος τελεστής (ταβάνι ετυμηγορίας) δεν είναι exported: απομονώνεται καλώντας το ίδιο
 * το `resolveConditionTone` δύο φορές, με και χωρίς `swimVerdictAvoid`.
 *
 * ΟΡΙΑ — ΤΑ ΙΔΙΑ ΜΕ ΚΑΘΕ ΜΕΤΡΗΣΗ ΑΥΤΗΣ ΤΗΣ ΟΙΚΟΓΕΝΕΙΑΣ:
 *   • Άνεμος ΠΕΡΙΟΧΗΣ, όχι ο τοπικός της κάθε πινέζας (το `adjustDailyForecastToHour` δεν είναι
 *     exported — §Κ1). Δείγμα = παραλιο-ΗΜΕΡΕΣ, όχι ώρες.
 *   • Το «τι θα γινόταν αν» του Α2/Α4 υπολογίζεται ΠΡΙΝ το ταβάνι ετυμηγορίας, γιατί εκείνο δεν
 *     είναι exported. Καταγράφεται χωριστά πόσες από τις θιγόμενες γραμμές το κουβαλάνε — που
 *     είναι ούτως ή άλλως το κρίσιμο νούμερο για την απόφαση.
 *
 * Run: node scripts/measureToneOperatorCensus.mjs --live [--regions=a,b] [--days=5]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
// Παιδικό λάθος να καεί η δωρεάν μερίδα σε εθνικό πέρασμα — δες scripts/lib/paidOpenMeteo.mjs.
import './lib/paidOpenMeteo.mjs';

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
  shoreSeaStateM, seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M,
  SHORE_DAMPING_BY_EXPOSURE,
} = require(path.join(root, 'utils/waveCharacter.ts'));
const {
  resolveConditionTone, resolveWindTone, capToneBySeaState, capIdealByShoreSea,
  coveHoldsCalmWater, offshoreLiftApplies,
} = require(path.join(root, 'utils/suitabilityTone.ts'));
const {
  holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample, holdsGlassWaterAtFourBeaufort,
  GLASS_AT_FOUR_MAX_SEA_STATE_M,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { buildConditionsFeel } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
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
const cachePath = path.join(root, '.tmp/tone-operator-census-cache.json');
const ROW_VERSION = 1;

/** Οι τιμές απόσβεσης που δοκιμάζονται. Το 0,5 είναι η σημερινή — μπαίνει ως έλεγχος ταυτότητας. */
const DAMPING_VARIANTS = [0.35, 0.5, 0.65, 1];

const pct = (n, d) => Number(((n / Math.max(1, d)) * 100).toFixed(2));
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Η ΛΕΞΗ που διαβάζει ο επισκέπτης πάνω από τον τυπωμένο αριθμό.
 *
 * ΔΕΝ ξαναγράφεται εδώ η κλίμακα: καλείται το ίδιο `buildConditionsFeel` που τυπώνει η κάρτα
 * (utils/beachConditionsReadout:156) και κρατιέται το `waveLevel` του. Έτσι η μέτρηση δεν μπορεί
 * να αποκλίνει από τη γλώσσα της οθόνης αν αλλάξουν ποτέ τα όρια.
 */
const band = (cardM, beaufort) => {
  if (typeof cardM !== 'number' || !Number.isFinite(cardM)) return 'unknown';
  const level = buildConditionsFeel({ beaufort, waveM: cardM, language: 'gr' })?.waveLevel;
  return level === undefined ? 'unknown' : `L${level}`;
};

/**
 * Η απόσβεση της ακτής με ΠΑΡΑΜΕΤΡΟΠΟΙΗΜΕΝΟ συντελεστή προστατευμένης.
 *
 * Αντιγράφει τις πύλες του `shoreSeaStateM` (utils/waveCharacter) και αλλάζει ΜΟΝΟ τον αριθμό.
 * Επαληθεύεται σε κάθε γραμμή: με factor = SHORE_DAMPING_BY_EXPOSURE.protected πρέπει να δίνει
 * ακριβώς ό,τι και η πραγματική συνάρτηση (`dampingMismatch`).
 */
const shoreWithDamping = (openM, exposureLevel, seaArrivalExposureLevel, curatedWindOnly, factor) => {
  if (typeof openM !== 'number' || !Number.isFinite(openM)) return undefined;
  const shelteredFromTheSea = seaArrivalExposureLevel === undefined || seaArrivalExposureLevel === 'protected';
  const earnedAgainstTheWave = !curatedWindOnly;
  const damping = exposureLevel === 'protected' && shelteredFromTheSea && earnedAgainstTheWave
    ? factor
    : exposureLevel === 'partial'
      ? SHORE_DAMPING_BY_EXPOSURE.partial
      : SHORE_DAMPING_BY_EXPOSURE.exposed;
  return Number((openM * damping).toFixed(2));
};

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return {
      regionId: file.replace(/\.json$/, ''),
      beaches: app.island.beaches,
      regionPoint: app.island.coordinates,
      profiles,
    };
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

      const profile = region.profiles[beach.id];
      const score = calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: profile,
      });

      const windDirectionDeg = dayForecast.wind?.deg;
      const windSpeedKmh = score.windSpeedKmph ?? (dayForecast.wind?.speed ?? 0) * 3.6;
      const beaufort = getBeaufortLevel(windSpeedKmh);
      const seaStateM = seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS);
      const curatedWindOnlyProtection = Boolean(score.protectionFromCuratedCoveOnly);
      const exposureLevel = score.exposureLevel;
      const seaArrivalExposureLevel = score.seaArrivalExposureLevel;
      const isEnclosedCove = Boolean(score.enclosedCove);

      // Ίδια ορίσματα με services/recommendationService.ts — καμία δεύτερη συνταγή.
      const offshoreFlatWater = holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort, swellWaveHeightM: score.marine?.swellWaveHeightM });
      const glassWaterAtFour = holdsGlassWaterAtFourBeaufort({
        profile, windDirectionDeg, beaufort, seaStateM, exposureLevel,
        seaArrivalExposureLevel, curatedWindOnlyProtection,
        swellWaveHeightM: score.marine?.swellWaveHeightM,
      });
      const downwindSeaSample = hasDownwindSeaSample({
        profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
      });
      const swimVerdictAvoid = score.swimmingComfort === 'avoid_swimming';

      const toneInput = {
        exposureLevel, beaufort, isEnclosedCove, seaStateM, offshoreFlatWater, glassWaterAtFour,
        downwindSeaSample, swimVerdictAvoid, seaArrivalExposureLevel, curatedWindOnlyProtection,
        windSpeedKmh,
      };

      // ── Τα δύο πραγματικά χρώματα: τελικό, και χωρίς τον 4ο τελεστή ─────────────────────────
      const toneFinal = resolveConditionTone(toneInput);
      const toneNoVerdictCap = resolveConditionTone({ ...toneInput, swimVerdictAvoid: false });

      // ── Η σύνθεση των τριών πρώτων, με τις ΙΔΙΕΣ exported συναρτήσεις ──────────────────────
      const atShoreM = shoreSeaStateM(seaStateM, exposureLevel, seaArrivalExposureLevel, curatedWindOnlyProtection);
      const coveExempt = coveHoldsCalmWater(isEnclosedCove, exposureLevel === 'protected', beaufort)
        && !offshoreLiftApplies(exposureLevel, beaufort, offshoreFlatWater);
      const glassGated = glassWaterAtFour
        && typeof atShoreM === 'number' && Number.isFinite(atShoreM)
        && atShoreM < GLASS_AT_FOUR_MAX_SEA_STATE_M;

      const t1 = resolveWindTone(exposureLevel, beaufort, isEnclosedCove, offshoreFlatWater, glassGated, windSpeedKmh);
      const t2 = capToneBySeaState(t1, seaStateM, coveExempt, exposureLevel, downwindSeaSample,
        seaArrivalExposureLevel, curatedWindOnlyProtection);
      const t3 = capIdealByShoreSea(t2, atShoreM, coveExempt);
      const composeMismatch = t3 !== toneNoVerdictCap;

      // Ο δείκτης ταυτότητας της παραμετροποιημένης απόσβεσης.
      const dampingMismatch = shoreWithDamping(seaStateM, exposureLevel, seaArrivalExposureLevel,
        curatedWindOnlyProtection, SHORE_DAMPING_BY_EXPOSURE.protected) !== atShoreM;

      // ── Οι τρεις πόρτες που ΑΝΟΙΓΟΥΝ, απομονωμένες η καθεμία ───────────────────────────────
      const t1NoThree = resolveWindTone(exposureLevel, beaufort, isEnclosedCove, offshoreFlatWater, glassGated, undefined);
      const t1NoGlass = resolveWindTone(exposureLevel, beaufort, isEnclosedCove, offshoreFlatWater, false, windSpeedKmh);
      const t1NoOffshore = resolveWindTone(exposureLevel, beaufort, isEnclosedCove, false, glassGated, windSpeedKmh);

      // ── Α2: τι θα άλλαζε αν η εξαίρεση του όρμου δεν είχε παράθυρο ανέμου ──────────────────
      const coveEligible = isEnclosedCove && exposureLevel === 'protected'
        && !offshoreLiftApplies(exposureLevel, beaufort, offshoreFlatWater);
      let coveWideTone = null;
      if (coveEligible && !coveExempt) {
        coveWideTone = capIdealByShoreSea(
          capToneBySeaState(t1, seaStateM, true, exposureLevel, downwindSeaSample,
            seaArrivalExposureLevel, curatedWindOnlyProtection),
          atShoreM, true
        );
      }

      // ── Α4: το χρώμα και η ζώνη του αριθμού για κάθε τιμή απόσβεσης ────────────────────────
      const displayM = Number.isFinite(score.waveHeightM) ? score.waveHeightM : null;
      const modelShoreM = Number.isFinite(score.shoreWaveHeightM) ? score.shoreWaveHeightM : null;
      const damping = {};
      for (const factor of DAMPING_VARIANTS) {
        const shoreVar = shoreWithDamping(seaStateM, exposureLevel, seaArrivalExposureLevel,
          curatedWindOnlyProtection, factor);
        const glassVar = glassWaterAtFour
          && typeof shoreVar === 'number' && Number.isFinite(shoreVar)
          && shoreVar < GLASS_AT_FOUR_MAX_SEA_STATE_M;
        const w = resolveWindTone(exposureLevel, beaufort, isEnclosedCove, offshoreFlatWater, glassVar, windSpeedKmh);
        // Το ταβάνι θάλασσας διαβάζει το ΙΔΙΟ αποσβεσμένο νούμερο μέσα του· εδώ το περνάμε
        // έμμεσα μέσω του δάπεδου, γιατί το capToneBySeaState υπολογίζει μόνο του την απόσβεση.
        // Άρα η σύγκριση απομονώνει ό,τι ΜΠΟΡΕΙ να απομονωθεί χωρίς να ξαναγραφτεί ο τελεστής:
        // το δάπεδο «Ιδανική» και την πόρτα των 4 Μποφόρ.
        const tone = capIdealByShoreSea(
          capToneBySeaState(w, seaStateM, coveExempt, exposureLevel, downwindSeaSample,
            seaArrivalExposureLevel, curatedWindOnlyProtection),
          shoreVar, coveExempt
        );
        // Ο αριθμός που τυπώνει η κάρτα, με τη ΣΥΝΤΑΓΗ του measureColourCauseSplit/QuietSeaGate.
        const shoreRaw = modelShoreM !== null
          ? Math.min(modelShoreM, shoreVar === undefined ? modelShoreM : shoreVar)
          : (shoreVar === undefined ? null : shoreVar);
        const cardM = shoreRaw === null ? displayM : (displayM !== null ? Math.min(shoreRaw, displayM) : shoreRaw);
        damping[factor] = {
          tone,
          band: band(cardM ?? undefined, beaufort),
          cardM: cardM === null ? null : Number(cardM.toFixed(2)),
        };
      }

      rows.push({
        dayIndex,
        beachId: beach.id,
        name: beach.name?.gr ?? null,
        beaufort,
        exposureLevel: exposureLevel ?? null,
        isEnclosedCove,
        swimVerdictAvoid,
        swimmingComfort: score.swimmingComfort ?? null,
        toneFinal,
        toneNoVerdictCap,
        t1, t2, t3,
        t1NoThree, t1NoGlass, t1NoOffshore,
        coveEligible,
        coveExempt,
        coveWideTone,
        composeMismatch,
        dampingMismatch,
        severityM: typeof seaStateM === 'number' && Number.isFinite(seaStateM) ? Number(seaStateM.toFixed(2)) : null,
        atShoreM: typeof atShoreM === 'number' ? Number(atShoreM.toFixed(2)) : null,
        damping,
      });
    }
  }

  return { regionId: region.regionId, days: days.length, rows };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

const codeStamp = [
  'utils/suitabilityTone.ts',
  'services/recommendationService.ts',
  'utils/waveCharacter.ts',
  'utils/offshoreFlatWater.ts',
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
  mkdirSync(path.dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, JSON.stringify({ codeStamp, regions: cache }));
  await sleep(250);
}
process.stderr.write('\r                                                  \r');

// ── Σύνοψη ────────────────────────────────────────────────────────────────────────────────────
const allRows = [];
const regionOf = new Map();
for (const [regionId, result] of Object.entries(cache)) {
  for (const row of result.rows ?? []) { allRows.push(row); regionOf.set(row, regionId); }
}
const total = allRows.length;
if (!total) {
  console.error('Καμία γραμμή — δεν γράφτηκε αναφορά.');
  process.exit(1);
}

// 0. ΟΙ ΔΥΟ ΕΛΕΓΧΟΙ ΤΑΥΤΟΤΗΤΑΣ. Αν δεν είναι μηδέν, όλη η υπόλοιπη αναφορά είναι άκυρη.
const composeMismatches = allRows.filter(r => r.composeMismatch).length;
const dampingMismatches = allRows.filter(r => r.dampingMismatch).length;

// 1. Α7 — ΠΟΙΟΣ ΑΠΟΦΑΣΙΣΕ ΤΟ ΤΕΛΙΚΟ ΧΡΩΜΑ
const attribution = { 'σκάλα ανέμου': 0, 'ταβάνι θάλασσας': 0, 'δάπεδο ΙΔΑΝΙΚΗ': 0, 'ταβάνι ετυμηγορίας': 0 };
for (const r of allRows) {
  if (r.toneFinal !== r.toneNoVerdictCap) attribution['ταβάνι ετυμηγορίας'] += 1;
  else if (r.t3 !== r.t2) attribution['δάπεδο ΙΔΑΝΙΚΗ'] += 1;
  else if (r.t2 !== r.t1) attribution['ταβάνι θάλασσας'] += 1;
  else attribution['σκάλα ανέμου'] += 1;
}
const doors = {
  'πόρτα 3 Μποφόρ': allRows.filter(r => r.t1 !== r.t1NoThree).length,
  'πόρτα 4 Μποφόρ': allRows.filter(r => r.t1 !== r.t1NoGlass).length,
  'πόρτα 5 Μποφόρ': allRows.filter(r => r.t1 !== r.t1NoOffshore).length,
};
/** Πόσες φορές μια πόρτα άνοιξε το χρώμα και ένας τελεστής από κάτω το ξανάκλεισε. */
const doorsUndone = {
  'πόρτα 3 Μποφόρ': allRows.filter(r => r.t1 !== r.t1NoThree && r.toneFinal === r.t1NoThree).length,
  'πόρτα 4 Μποφόρ': allRows.filter(r => r.t1 !== r.t1NoGlass && r.toneFinal === r.t1NoGlass).length,
  'πόρτα 5 Μποφόρ': allRows.filter(r => r.t1 !== r.t1NoOffshore && r.toneFinal === r.t1NoOffshore).length,
};
const toneCount = (pick) => allRows.reduce((acc, r) => {
  const t = pick(r); acc[t] = (acc[t] ?? 0) + 1; return acc;
}, {});

// 2. Α2 — ΤΟ ΠΑΡΑΘΥΡΟ ΤΟΥ ΟΡΜΟΥ
const coveRows = allRows.filter(r => r.coveEligible);
const coveChanged = coveRows.filter(r => r.coveWideTone && r.coveWideTone !== r.t3);
const coveByBeaufort = {};
for (const r of coveChanged) {
  const k = String(r.beaufort);
  coveByBeaufort[k] = coveByBeaufort[k] ?? { rows: 0, withAvoidVerdict: 0, toCalmer: 0 };
  coveByBeaufort[k].rows += 1;
  if (r.swimVerdictAvoid) coveByBeaufort[k].withAvoidVerdict += 1;
  const order = ['red', 'orange', 'yellow', 'blue'];
  if (order.indexOf(r.coveWideTone) > order.indexOf(r.t3)) coveByBeaufort[k].toCalmer += 1;
}

// 3. Α4 — Η ΖΩΝΗ ΑΒΕΒΑΙΟΤΗΤΑΣ ΤΟΥ ×0,5
const base = '0.5';
const dampingSummary = {};
for (const factor of DAMPING_VARIANTS) {
  const key = String(factor);
  let toneChanged = 0, toCalmer = 0, bandChanged = 0, bandToCalm = 0, cardDeltaSum = 0, cardDeltaN = 0, worstDelta = 0;
  const order = ['red', 'orange', 'yellow', 'blue'];
  for (const r of allRows) {
    const v = r.damping?.[key]; const b = r.damping?.[base];
    if (!v || !b) continue;
    if (v.tone !== b.tone) { toneChanged += 1; if (order.indexOf(v.tone) > order.indexOf(b.tone)) toCalmer += 1; }
    if (v.band !== b.band) { bandChanged += 1; if (v.band < b.band) bandToCalm += 1; }
    if (typeof v.cardM === 'number' && typeof b.cardM === 'number') {
      const d = v.cardM - b.cardM;
      cardDeltaSum += Math.abs(d); cardDeltaN += 1;
      if (Math.abs(d) > Math.abs(worstDelta)) worstDelta = Number(d.toFixed(2));
    }
  }
  dampingSummary[key] = {
    toneChangedPct: pct(toneChanged, total),
    toneChanged,
    towardCalmer: toCalmer,
    towardRougher: toneChanged - toCalmer,
    bandChanged,
    bandChangedPct: pct(bandChanged, total),
    bandBecameCalmer: bandToCalm,
    meanAbsCardDeltaM: cardDeltaN ? Number((cardDeltaSum / cardDeltaN).toFixed(3)) : null,
    worstCardDeltaM: worstDelta,
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Α7 ποιος βάφει · Α2 το παράθυρο του όρμου · Α4 η ζώνη αβεβαιότητας του ×0,5',
  scope: {
    regions: Object.keys(cache).length,
    days: DAYS,
    beachDays: total,
    note: 'Άνεμος περιοχής, όχι τοπικός ανά πινέζα (§Κ1). Δείγμα = παραλιο-ημέρες.',
  },
  identityChecks: {
    composeMismatches,
    dampingMismatches,
    verdict: composeMismatches === 0 && dampingMismatches === 0
      ? 'ΟΚ — η σύνθεση ταυτίζεται με το resolveConditionTone σε κάθε γραμμή'
      : 'ΑΚΥΡΗ ΑΝΑΦΟΡΑ — η σειρά των τελεστών άλλαξε στον κώδικα',
  },
  a7_attribution: {
    finalTones: toneCount(r => r.toneFinal),
    decidedBy: attribution,
    decidedByPct: Object.fromEntries(Object.entries(attribution).map(([k, v]) => [k, pct(v, total)])),
    doorsThatOpenedColour: doors,
    doorsUndoneDownstream: doorsUndone,
  },
  a2_coveWindow: {
    coveEligibleRows: coveRows.length,
    exemptToday: coveRows.filter(r => r.coveExempt).length,
    wouldChangeIfWindowRemoved: coveChanged.length,
    ofWhichCarryAvoidSwimVerdict: coveChanged.filter(r => r.swimVerdictAvoid).length,
    byBeaufort: coveByBeaufort,
    examples: coveChanged.slice(0, 12).map(r => ({
      region: regionOf.get(r), beachId: r.beachId, name: r.name, beaufort: r.beaufort,
      today: r.t3, ifWindowRemoved: r.coveWideTone, severityM: r.severityM,
      swimmingComfort: r.swimmingComfort,
    })),
  },
  a4_dampingSensitivity: {
    baseline: 0.5,
    note: 'Απομονώνει το δάπεδο «Ιδανική», την πόρτα των 4 Μποφόρ και τον τυπωμένο αριθμό. '
      + 'Το ταβάνι θάλασσας υπολογίζει μόνο του την απόσβεση, άρα ΔΕΝ μεταβάλλεται εδώ — '
      + 'το πραγματικό εύρος είναι μεγαλύτερο από αυτό που δείχνει ο πίνακας.',
    variants: dampingSummary,
  },
};

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'tone-operator-census.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`\n── ΑΠΟΓΡΑΦΗ ΤΕΛΕΣΤΩΝ · ${total} παραλιο-ημέρες σε ${Object.keys(cache).length} περιοχές ──\n`);
console.log(`έλεγχοι ταυτότητας: σύνθεση ${composeMismatches} · απόσβεση ${dampingMismatches}`);
console.log('\nΑ7 · ποιος αποφάσισε το τελικό χρώμα');
for (const [k, v] of Object.entries(attribution)) console.log(`  ${k.padEnd(20)} ${String(v).padStart(6)}  ${pct(v, total)}%`);
console.log('\n   πόρτες που άνοιξαν χρώμα (και πόσες ξανάκλεισαν από κάτω)');
for (const [k, v] of Object.entries(doors)) console.log(`  ${k.padEnd(20)} ${String(v).padStart(6)}  ακυρώθηκαν ${doorsUndone[k]}`);
console.log(`\nΑ2 · όρμοι εκτός παραθύρου: ${coveRows.length} γραμμές, θα άλλαζαν ${coveChanged.length}`
  + ` (από αυτές ${coveChanged.filter(r => r.swimVerdictAvoid).length} λένε «μην κολυμπήσεις»)`);
console.log('\nΑ4 · ζώνη αβεβαιότητας του ×0,5');
for (const [k, v] of Object.entries(dampingSummary)) {
  console.log(`  ×${k.padEnd(5)} χρώμα ${String(v.toneChangedPct).padStart(5)}%  ζώνη αριθμού ${String(v.bandChangedPct).padStart(5)}%`
    + `  μέση διαφορά ${v.meanAbsCardDeltaM} μ.  χειρότερη ${v.worstCardDeltaM} μ.`);
}
console.log(`\n→ ${path.relative(root, outPath)}`);
