/**
 * ΤΟ ΜΠΛΕ ΤΩΝ 3 ΜΠΟΦΟΡ ΔΕΝ ΡΩΤΑΕΙ ΠΟΤΕ ΤΙ ΚΥΜΑ ΥΠΑΡΧΕΙ ΗΔΗ — ΠΟΣΟ ΚΟΣΤΙΖΕΙ ΝΑ ΤΟ ΡΩΤΗΣΕΙ;
 *
 * ΤΙ ΖΗΤΗΘΗΚΕ (Μίλτος, 21/08/2026): «Βράχος - Λούτσα, 0,6 μ. κύμα, 3 Μποφόρ, τη δίνεις μπλε σαν
 * ιδανική ενώ έχει κύμα». Μετρημένο εκείνη την ώρα: κύμα 0,62 μ. στα 3,3 δευτ. → ισοδύναμο 0,72
 * (ταβάνι θάλασσας: 0,80, δεν μιλάει), άνεμος 14,6 χλμ/ώρα (όριο του κανόνα: 14,8, περνάει).
 * Τομέας W: `exposed`, άνοιγμα 25 χλμ. Πριν τις 20/08 η πινέζα ήταν ΚΙΤΡΙΝΗ.
 *
 * Ο κανόνας των 3 Μποφόρ (`holdsNoBuildableChopAtThree`, utils/suitabilityTone) λέει: κάτω από
 * 14,8 χλμ/ώρα καμία ελληνική γεωμετρία δεν προλαβαίνει να ΧΤΙΣΕΙ 30 εκ. Αυτό είναι σωστό και
 * εξαντλητικά μετρημένο — αλλά μιλάει μόνο για κύμα που χτίζει Ο ΣΗΜΕΡΙΝΟΣ ΑΝΕΜΟΣ. Δεν ρωτάει
 * ποτέ τι κύμα ΥΠΑΡΧΕΙ ΗΔΗ, και το ταβάνι της θάλασσας που υποτίθεται ότι το πιάνει από κάτω
 * δεν έχει καμία γνώμη κάτω από 0,80 μ. Η αδελφή πόρτα των 4 Μποφόρ
 * (`holdsGlassWaterAtFourBeaufort`) κουβαλάει ακριβώς αυτή τη ρήτρα: ανοίγει μόνο με θάλασσα
 * αποδεδειγμένα κάτω από `GLASS_AT_FOUR_MAX_SEA_STATE_M`. Η πόρτα των 3 δεν την έχει.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΠΡΙΝ ΑΛΛΑΞΕΙ ΟΤΙΔΗΠΟΤΕ:
 *   1. Πόσες παραλιο-ημέρες ανεβάζει σήμερα ο κανόνας των 3 σε ΜΠΛΕ (το αποτύπωμά του).
 *   2. Από αυτές, πόσες κουβαλάνε θάλασσα ≥ X στην ακτή — δηλαδή πόσες θα ξαναγίνονταν κίτρινες
 *      αν μπει η ίδια ρήτρα με την πόρτα των 4, για X = 0,30 / 0,40 / 0,50 / 0,60.
 *   3. Τι αλλάζει αν η ΑΓΝΩΣΤΗ θάλασσα κλείνει την πόρτα (δόγμα της πόρτας των 4) ή όχι.
 *   4. Πόσες ΜΠΛΕ τυπώνουν σήμερα από κάτω τους αριθμό κύματος ≥0,5 μ. — το παράπονο, όπως το
 *      βλέπει ο αναγνώστης, ανεξάρτητα από ποιος κανόνας τις έβαψε.
 *
 * ΠΟΙΟΣ ΑΠΑΝΤΑΕΙ: το ΠΡΟΪΟΝ. Καλούνται `calculateBeachScore` και `resolveConditionTone` — οι
 * ίδιες συναρτήσεις που βάφουν την πινέζα. Η μόνη διαφορά ανάμεσα στα δύο σενάρια είναι το
 * όρισμα `windSpeedKmh`: όταν η θάλασσα δεν είναι αποδεδειγμένα ήσυχη περνάει `undefined`, που
 * είναι ΑΚΡΙΒΩΣ η καταγεγραμμένη συμπεριφορά «χωρίς ταχύτητα δεν εφαρμόζεται» — δηλαδή η
 * συμπεριφορά πριν τις 20/08. Κανένας κανόνας δεν αναπαράγεται εδώ.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ:
 *  - Δεν λέει αν το κατώφλι είναι ΣΩΣΤΟ. Λέει μόνο πόσο κοστίζει το καθένα.
 *  - Άνεμος ΠΕΡΙΟΧΗΣ, όχι ο τοπικός της κάθε πινέζας (ίδιο όριο με measureColourCauseSplit).
 *    Ο τοπικός μπορεί να είναι δυνατότερος, άρα η μέτρηση ΥΠΟΕΚΤΙΜΑ τα «περνάει ο κανόνας».
 *  - Δείγμα = ΜΕΡΕΣ, όχι ώρες (το adjustDailyForecastToHour δεν είναι exported — §Κ1).
 *
 * Run: node scripts/measureQuietSeaGateAtThree.mjs --live [--regions=a,b] [--days=5]
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
const { resolveConditionTone, THREE_BEAUFORT_NO_BUILDABLE_CHOP_MAX_KMH } =
  require(path.join(root, 'utils/suitabilityTone.ts'));
const {
  holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample, holdsGlassWaterAtFourBeaufort,
  GLASS_AT_FOUR_MAX_SEA_STATE_M,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
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
const cachePath = path.join(root, '.tmp/quiet-sea-gate-at-three-cache.json');

/** Τα κατώφλια που κρίνονται. Το 0,40 είναι αυτό που ήδη χρησιμοποιεί η πόρτα των 4 Μποφόρ. */
const THRESHOLDS = [0.3, 0.4, 0.5, 0.6];
/** Το νούμερο που τυπώνει η κάρτα και ενοχλεί τον αναγνώστη όταν από πάνω λέει ΙΔΑΝΙΚΗ. */
const COMPLAINT_CARD_M = 0.5;
const ROW_VERSION = 1;

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

      // Ίδια ορίσματα με services/recommendationService.ts:2618 — καμία δεύτερη συνταγή.
      const glassWaterAtFour = holdsGlassWaterAtFourBeaufort({
        profile,
        windDirectionDeg,
        beaufort,
        seaStateM,
        exposureLevel: score.exposureLevel,
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
        curatedWindOnlyProtection,
        swellWaveHeightM: score.marine?.swellWaveHeightM,
      });

      const toneInput = {
        exposureLevel: score.exposureLevel,
        beaufort,
        isEnclosedCove: Boolean(score.enclosedCove),
        seaStateM,
        offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort, swellWaveHeightM: score.marine?.swellWaveHeightM }),
        glassWaterAtFour,
        downwindSeaSample: hasDownwindSeaSample({
          profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
        }),
        swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
        curatedWindOnlyProtection,
      };

      // ΤΩΡΑ, και ΧΩΡΙΣ ΤΟΝ ΚΑΝΟΝΑ ΤΩΝ 3 — η διαφορά τους ΕΙΝΑΙ το αποτύπωμα του κανόνα.
      const toneNow = resolveConditionTone({ ...toneInput, windSpeedKmh });
      const toneWithoutRule = resolveConditionTone({ ...toneInput, windSpeedKmh: undefined });

      // Το νούμερο που κρίνει η ρήτρα: η θάλασσα ΣΤΗΝ ΑΚΤΗ, ίδιος υπολογισμός με την πόρτα των 4.
      const atShoreRaw = shoreSeaStateM(
        seaStateM, score.exposureLevel, score.seaArrivalExposureLevel, curatedWindOnlyProtection);
      const atShoreM = typeof atShoreRaw === 'number' && Number.isFinite(atShoreRaw) ? atShoreRaw : null;

      // Ο αριθμός που ΤΥΠΩΝΕΙ η κάρτα — ίδια συνταγή με measureColourCauseSplit.mjs:198-206.
      const displayM = Number.isFinite(score.waveHeightM) ? score.waveHeightM : null;
      const modelShoreM = Number.isFinite(score.shoreWaveHeightM) ? score.shoreWaveHeightM : null;
      const shoreRaw = modelShoreM !== null
        ? Math.min(modelShoreM, atShoreM === null ? modelShoreM : atShoreM)
        : atShoreM;
      const cardShoreM = shoreRaw === null ? displayM : (displayM !== null ? Math.min(shoreRaw, displayM) : shoreRaw);

      rows.push({
        dayIndex,
        beachId: beach.id,
        name: beach.name?.gr ?? null,
        toneNow,
        toneWithoutRule,
        beaufort,
        windSpeedKmh: Number(windSpeedKmh.toFixed(1)),
        exposureLevel: score.exposureLevel ?? null,
        severityM: typeof seaStateM === 'number' && Number.isFinite(seaStateM) ? Number(seaStateM.toFixed(2)) : null,
        atShoreM: atShoreM === null ? null : Number(atShoreM.toFixed(2)),
        cardShoreM: cardShoreM === null ? null : Number(cardShoreM.toFixed(2)),
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
const regionOfRow = new Map();
for (const [regionId, result] of Object.entries(cache)) {
  for (const row of result.rows ?? []) { allRows.push(row); regionOfRow.set(row, regionId); }
}

const total = allRows.length;
/** Οι παραλιο-ημέρες που ΤΩΡΑ είναι μπλε ΕΠΕΙΔΗ μίλησε ο κανόνας των 3 — το αποτύπωμά του. */
const lifted = allRows.filter(r => r.toneNow !== r.toneWithoutRule);
const blueNow = allRows.filter(r => r.toneNow === 'blue');
const blueOverWave = blueNow.filter(r => (r.cardShoreM ?? 0) >= COMPLAINT_CARD_M);
const liftedOverWave = lifted.filter(r => (r.cardShoreM ?? 0) >= COMPLAINT_CARD_M);

const variants = [];
for (const threshold of THRESHOLDS) {
  for (const unknownCloses of [true, false]) {
    const clawedBack = lifted.filter(r => {
      const quiet = r.atShoreM === null ? !unknownCloses : r.atShoreM < threshold;
      return !quiet;
    });
    variants.push({
      threshold,
      unknownCloses,
      clawedBack: clawedBack.length,
      clawedBackPctOfLifted: pct(clawedBack.length, lifted.length),
      clawedBackPctOfAll: pct(clawedBack.length, total),
      regions: new Set(clawedBack.map(r => regionOfRow.get(r))).size,
      beaches: new Set(clawedBack.map(r => r.beachId)).size,
      // Το κέρδος: πόσες από τις «μπλε πάνω από τυπωμένο κύμα ≥0,5» εξαφανίζονται.
      complaintCasesFixed: clawedBack.filter(r => (r.cardShoreM ?? 0) >= COMPLAINT_CARD_M).length,
      // Ο κίνδυνος υπερδιόρθωσης: κιτρινίζουν παραλίες με πραγματικά ήσυχο τυπωμένο νερό.
      quietCardCollateral: clawedBack.filter(r => (r.cardShoreM ?? 0) < 0.3).length,
    });
  }
}

/**
 * Η ΔΕΥΤΕΡΗ ΥΠΟΨΗΦΙΑ, ΚΑΙ Η ΜΟΝΗ ΠΟΥ ΠΙΑΝΕΙ ΤΗ ΛΟΥΤΣΑ.
 *
 * Η πρώτη μέτρηση της 21/08 έδειξε ότι στη Λούτσα ο άνεμος της ημέρας είναι 2 Μποφόρ, όχι 3 —
 * δηλαδή το μπλε ΔΕΝ το βάζει ο κανόνας των 3, το βάζει το ότι στα 2 Μποφόρ η σκάλα επιστρέφει
 * μπλε χωρίς ερώτηση και το ταβάνι της θάλασσας δεν έχει γνώμη κάτω από 0,80 μ. Άρα το «ιδανική
 * πάνω από ορατό κύμα» χρειάζεται δάπεδο στο ΙΔΙΟ ΤΟ ΜΠΛΕ, στον αριθμό που τυπώνει η κάρτα.
 *
 * Ένα σκαλί μόνο (μπλε → κίτρινο), ποτέ προς το ηρεμότερο. Μετριέται και πόσες ΟΘΟΝΕΣ
 * (περιοχή × μέρα) μένουν χωρίς κανένα μπλε — εκεί είναι το πραγματικό κόστος για τον χρήστη.
 */
const screenKey = (row) => `${regionOfRow.get(row)}#${row.dayIndex}`;
const screensWithBlue = new Set(blueNow.map(screenKey));
const blueFloors = THRESHOLDS.map(floor => {
  const demoted = blueNow.filter(r => (r.cardShoreM ?? 0) >= floor);
  const survivors = new Set(blueNow.filter(r => (r.cardShoreM ?? 0) < floor).map(screenKey));
  return {
    floor,
    demoted: demoted.length,
    shareOfBlue: pct(demoted.length, blueNow.length),
    shareOfAll: pct(demoted.length, total),
    beaches: new Set(demoted.map(r => r.beachId)).size,
    regions: new Set(demoted.map(r => regionOfRow.get(r))).size,
    screensEmptied: [...screensWithBlue].filter(k => !survivors.has(k)).length,
    screensWithBlue: screensWithBlue.size,
    topRegions: Object.entries(demoted.reduce((acc, r) => {
      const id = regionOfRow.get(r); acc[id] = (acc[id] ?? 0) + 1; return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
});

const worstExamples = liftedOverWave
  .slice()
  .sort((a, b) => (b.cardShoreM ?? 0) - (a.cardShoreM ?? 0))
  .slice(0, 15)
  .map(r => ({
    region: regionOfRow.get(r), beachId: r.beachId, name: r.name, dayIndex: r.dayIndex,
    beaufort: r.beaufort, windSpeedKmh: r.windSpeedKmh, exposureLevel: r.exposureLevel,
    cardShoreM: r.cardShoreM, atShoreM: r.atShoreM, severityM: r.severityM,
    wouldBeWithoutRule: r.toneWithoutRule,
  }));

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Πόσο κοστίζει να ζητήσει ο κανόνας των 3 Μποφόρ αποδεδειγμένα ήσυχη θάλασσα, όπως η πόρτα των 4;',
  sample: { regions: Object.keys(cache).length, days: DAYS, beachDays: total },
  constants: {
    threeBeaufortMaxKmh: THREE_BEAUFORT_NO_BUILDABLE_CHOP_MAX_KMH,
    glassAtFourMaxSeaStateM: GLASS_AT_FOUR_MAX_SEA_STATE_M,
    complaintCardM: COMPLAINT_CARD_M,
  },
  today: {
    blueBeachDays: blueNow.length,
    blueOverPrintedWave: blueOverWave.length,
    blueOverPrintedWavePct: pct(blueOverWave.length, blueNow.length),
    liftedByRule: lifted.length,
    liftedByRulePct: pct(lifted.length, total),
    liftedByRuleOverPrintedWave: liftedOverWave.length,
    liftedBeaches: new Set(lifted.map(r => r.beachId)).size,
    liftedRegions: new Set(lifted.map(r => regionOfRow.get(r))).size,
  },
  variants,
  blueFloors,
  blueOverWaveExamples: blueOverWave
    .slice()
    .sort((a, b) => (b.cardShoreM ?? 0) - (a.cardShoreM ?? 0))
    .slice(0, 20)
    .map(r => ({
      region: regionOfRow.get(r), beachId: r.beachId, name: r.name, dayIndex: r.dayIndex,
      beaufort: r.beaufort, exposureLevel: r.exposureLevel,
      cardShoreM: r.cardShoreM, severityM: r.severityM,
    })),
  worstExamples,
};

mkdirSync(reportDir, { recursive: true });
writeFileSync(path.join(reportDir, 'quiet-sea-gate-at-three.json'), JSON.stringify(report, null, 2));

console.log(`\nΔΕΙΓΜΑ: ${report.sample.regions} περιοχές × ${DAYS} μέρες = ${total} παραλιο-ημέρες\n`);
console.log('ΣΗΜΕΡΑ, ΧΩΡΙΣ ΚΑΜΙΑ ΑΛΛΑΓΗ');
console.log(`  μπλε συνολικά                      ${blueNow.length}`);
console.log(`  μπλε με τυπωμένο κύμα ≥${COMPLAINT_CARD_M} μ.        ${blueOverWave.length} (${pct(blueOverWave.length, blueNow.length)} των μπλε)`);
console.log(`  τις ανέβασε ο κανόνας των 3        ${lifted.length} (${pct(lifted.length, total)}) σε ${report.today.liftedBeaches} παραλίες / ${report.today.liftedRegions} περιοχές`);
console.log(`  από αυτές, με τυπωμένο κύμα ≥${COMPLAINT_CARD_M}    ${liftedOverWave.length}\n`);
console.log('ΑΝ ΜΠΕΙ Η ΡΗΤΡΑ «ΑΠΟΔΕΔΕΙΓΜΕΝΑ ΗΣΥΧΗ ΘΑΛΑΣΣΑ» (κιτρινίζουν, ποτέ το αντίθετο)');
console.log('  κατώφλι  άγνωστη   ξαναγίνονται  %      παραλίες  περιοχές  λύνει παράπονο  κιτρινίζει ήσυχο');
for (const v of variants) {
  console.log(`  ${String(v.threshold).padEnd(8)} ${(v.unknownCloses ? 'κλείνει' : 'ανοίγει').padEnd(9)} ${String(v.clawedBack).padEnd(13)} ${v.clawedBackPctOfLifted.padEnd(6)} ${String(v.beaches).padEnd(9)} ${String(v.regions).padEnd(9)} ${String(v.complaintCasesFixed).padEnd(15)} ${v.quietCardCollateral}`);
}
console.log('\nΑΝ ΜΠΕΙ ΔΑΠΕΔΟ ΚΥΜΑΤΟΣ ΣΤΟ ΙΔΙΟ ΤΟ ΜΠΛΕ (ΙΔΑΝΙΚΗ → ΚΑΛΗ, ένα σκαλί, ποτέ αντίστροφα)');
console.log('  δάπεδο   πέφτουν   % των μπλε  παραλίες  περιοχές  οθόνες που μένουν χωρίς μπλε');
for (const f of blueFloors) {
  console.log(`  ${String(f.floor).padEnd(8)} ${String(f.demoted).padEnd(9)} ${f.shareOfBlue.padEnd(11)} ${String(f.beaches).padEnd(9)} ${String(f.regions).padEnd(9)} ${f.screensEmptied} / ${f.screensWithBlue}`);
}
console.log('\n→ reports/quality/quiet-sea-gate-at-three.json');
