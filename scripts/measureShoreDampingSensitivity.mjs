/**
 * ΠΟΣΑ ΚΡΕΜΟΝΤΑΙ ΠΑΝΩ ΣΤΟ ×0,5 — ΕΥΑΙΣΘΗΣΙΑ, ΟΧΙ ΑΛΗΘΕΙΑ. ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ (βίβλος §7δ, παράδοση 23/08/2026). Η έκπτωση προστατευμένης ακτής
 * `SHORE_DAMPING_BY_EXPOSURE.protected = 0,5` (utils/waveCharacter.ts) δεν έχει μετρηθεί ποτέ
 * απέναντι σε τίποτα — «η ΑΒΑΘΜΟΝΟΜΗΤΗ έκπτωση ×0,5», το λέει ο ίδιος ο κώδικας. Για ακτογραμμή
 * δεν υπάρχει εξωτερικός κριτής. Όταν δεν μπορούμε να μάθουμε τη σωστή τιμή, μετράμε το αμέσως
 * επόμενο χρήσιμο πράγμα: ΠΟΣΟ αλλάζει αυτό που βλέπει ο επισκέπτης αν η σταθερά ήταν 0,35 ή
 * 0,65 αντί για 0,50. Αν η απάντηση είναι «λίγο», η αβεβαιότητα είναι ανεκτή· αν «πολύ», η
 * βαθμονόμηση (κάμερες, feedback) έχει προτεραιότητα και ξέρουμε πού ακριβώς πονάει.
 *
 * ΤΙ ΑΚΡΙΒΩΣ ΑΛΛΑΖΕΙ ΣΕ ΚΑΘΕ ΠΑΡΑΛΛΑΓΗ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ. Η σταθερά διαβάζεται σε
 * ΔΥΟ σκέλη της shoreSeaStateM: (1) προστατευμένη ακτή + προστασία και από τη μεριά της θάλασσας
 * (§Γ2), (2) η χαλάρωση λοξής θάλασσας του §Γ59 (partial + grazing). Η μέτρηση αλλάζει τη
 * σταθερά ΟΠΩΣ θα άλλαζε στην παραγωγή — και τα δύο σκέλη μαζί. Ό,τι κάθεται πάνω της κινείται
 * ολόκληρο: τυπωμένο νούμερο κάρτας/πινέζας (μέσω buildBeachConditionsReadout, ΜΕ τους φράχτες
 * §Γ47/§Γ55 — μετράμε την ΠΑΡΑΓΩΓΗ, §Γ35), ετυμηγορία κολύμβησης, χρώμα πινέζας
 * (resolveConditionTone), 25 πόντοι «νερό» του podium.
 *
 * ΟΙ ΔΥΟ ΚΑΤΕΥΘΥΝΣΕΙΣ ΔΕΝ ΕΙΝΑΙ ΣΥΜΜΕΤΡΙΚΕΣ. Το 0,35 κάνει προστατευμένες παραλίες ΠΙΟ ΗΡΕΜΕΣ
 * στα μάτια του επισκέπτη — η επικίνδυνη κατεύθυνση (§9 σκανδάλη #1), μετριέται πρώτη και με
 * παραδείγματα. Το 0,65 τις κάνει πιο άγριες — κοστίζει εμπιστοσύνη, όχι ασφάλεια.
 *
 * ΤΑ ΟΡΙΑ ΤΗΣ ΜΕΤΡΗΣΗΣ, ΓΡΑΜΜΕΝΑ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ:
 *  - ΕΝΑ στιγμιότυπο μίας ημέρας (day 0). Τρέξε τη σε μέρα με πραγματικό κύμα — σε άπνοια το
 *    ×0,5 δεν έχει τίποτα να μοιράσει και η ευαισθησία βγαίνει τεχνητά μηδενική (το λάθος που
 *    σημειώνει το measureShoreNumberEverywhere για τις 13/08). Η μέρα-αναφοράς: 2022-09-06
 *    (μελτέμι 7 Bft), μέσω lib/replayOpenMeteo.
 *  - Δεν λέει ΠΟΙΑ τιμή είναι σωστή. Μετράει εμβέλεια εξάρτησης, όχι απόσταση από την αλήθεια.
 *  - Ο άνεμος είναι της περιοχής, το σκορ σε επίπεδο ημέρας — ίδια όρια με τα αδέρφια του
 *    (measureShoreWaveRamp, measureShoreNumberEverywhere), ώστε τα νούμερα να συγκρίνονται.
 *
 * Run (μελτέμι-αναφορά, με το πληρωμένο κλειδί ΜΟΝΟ στο περιβάλλον — ποτέ σε αρχείο):
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --context production --site <site-id>)" \
 *   OPEN_METEO_REPLAY=2022-09-06:2022-09-08 OPEN_METEO_REPLAY_SHIFT=1 \
 *   node scripts/measureShoreDampingSensitivity.mjs [--regions=a,b]
 *
 * ⚠️ ΤΟ ΕΥΡΟΣ ΕΙΝΑΙ ΡΗΤΟ ΚΑΙ ΤΡΙΗΜΕΡΟ ΕΠΙΤΗΔΕΣ (μετρήθηκε 24/08/2026). Με σκέτο
 * `OPEN_METEO_REPLAY=2022-09-06` το replay ζητάει `forecast_days=6` → εύρος ως 2022-09-11, και
 * το αρχειακό marine με `models=meteofrance_wave` ΚΡΕΜΑΕΙ σε αυτό το εύρος: όχι 429, όχι σφάλμα,
 * απλώς δεν απαντά ποτέ, οπότε το 8s timeout του weatherService κόβει ΟΛΗ τη θάλασσα και κάθε
 * παραλλαγή βγαίνει ίδια. Το day 0 είναι ό,τι σκοράρεται (DAY_INDEX = 0), άρα τρεις μέρες αρκούν.
 *
 * ⚠️ Η ΕΚΔΟΣΗ ΤΟΥ NETLIFY CLI ΕΔΩ ΔΕΝ ΕΧΕΙ `--plain` (και σκέτο `netlify` δεν είναι στο PATH·
 * μόνο `npx netlify`). ΧΩΡΙΣ `--context production` γυρίζει άκυρη τιμή. Ποτέ σε αρχείο/commit.
 *
 * ΟΧΙ OPEN_METEO_REPLAY_CLOCK — ξυπνά την άμυνα του utils/athensTime και γυρίζουν 0 περιοχές (§Γ46).
 */
import './lib/paidOpenMeteo.mjs';
import './lib/replayOpenMeteo.mjs';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// services/weatherService.ts arms its request timeout with window.setTimeout — see
// scripts/auditPerBeachWaveImpact.mjs for why this is pointed at globalThis rather than forked.
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

const waveCharacter = require(path.join(root, 'utils/waveCharacter.ts'));
const { shoreSeaStateM, seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M } = waveCharacter;
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
// ⚠️ Το podium ΔΕΝ είναι οι τρεις πρώτες του getSuitableBeaches — οι 25 πόντοι «νερό» ζουν στο
// utils/topPickScoreTable και τρέχουν μόνο μέσα από εδώ (το δίδαγμα του measureShoreWaveRamp).
const { prioritizeProtectedRecommendations } = require(path.join(root, 'services/topPickRanking.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const cachePath = path.join(root, '.tmp/shore-damping-sensitivity-cache.json');
const DAY_INDEX = 0;

// ─────────────────────────────────────────────────────────────────────────────
// ΟΙ ΠΑΡΑΛΛΑΓΕΣ. Το 'base' είναι ο σημερινός κώδικας — δεν πειράζεται τίποτα όταν είναι ενεργό,
// η setDamping απλώς ξαναγράφει την ίδια τιμή 0,5 που έχει ήδη η σταθερά.
// ─────────────────────────────────────────────────────────────────────────────
const BASELINE = 0.5;
const VARIANTS = [
  { key: 'base', label: 'σήμερα ×0,50', value: 0.5 },
  { key: 'd035', label: '×0,35 (βαθύτερη έκπτωση — ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση)', value: 0.35 },
  { key: 'd065', label: '×0,65 (ρηχότερη έκπτωση — προς την προσοχή)', value: 0.65 },
];

const setDamping = (value) => {
  // Ιδιότητα ΤΟΥ ΙΔΙΟΥ αντικειμένου που διαβάζει η shoreSeaStateM στην κλήση (waveCharacter.ts
  // :393-398 — οι μόνες αναγνώσεις της σε όλο το δέντρο, ελέγχθηκε με grep 23/08/2026). Το
  // `as const` είναι μόνο για τα types· το αντικείμενο δεν είναι παγωμένο.
  waveCharacter.SHORE_DAMPING_BY_EXPOSURE.protected = value;
};

// Δίχτυ πάνω στο ίδιο το εργαλείο #1: αν η αλλαγή της σταθεράς δεν φτάνει στη συνάρτηση, κάθε
// παραλλαγή θα έβγαζε τα ίδια νούμερα και η αναφορά θα έλεγε «καμία ευαισθησία» — το πιο βολικό
// ψέμα που θα μπορούσε να πει. Ελέγχεται με κλήση, όχι με ελπίδα.
{
  const at = (v) => { setDamping(v); const r = shoreSeaStateM(1.0, 'protected', undefined); setDamping(BASELINE); return r; };
  if (!(at(0.35) === 0.35 && at(0.65) === 0.65 && at(0.5) === 0.5)) {
    console.error('ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: η αλλαγή της σταθεράς δεν αλλάζει το αποτέλεσμα της shoreSeaStateM.');
    process.exit(1);
  }
}

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};
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

/** Η ζώνη που διαβάζει ο επισκέπτης πίσω από τον αριθμό — ίδια κατώφλια με τον χάρτη. */
const bandOf = (waveM, periodS) => {
  const severity = seaStateSeverityM(waveM, periodS);
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'φουρτούνα';
  if (severity >= SEA_STATE_AMBER_M) return 'κύμα';
  return 'ήρεμα';
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
  // Χωρίς ΚΑΘΟΛΟΥ θάλασσα το σκοράρισμα προχωράει μόνο με άνεμο, όλες οι παραλλαγές βγαίνουν
  // ίδιες, και η μνήμη θα έγραφε «καμία ευαισθησία» για την περιοχή. Ένα marine timeout (το 8s
  // του weatherService πάνω σε κρύο αρχείο) πρέπει να μετρήσει ως ΗΜΙΤΕΛΗΣ περιοχή → retry.
  const anyMarine = [...marineByPoint.values()].some(entry => (entry?.data ?? []).length > 0);
  if (!anyMarine) return { regionId: region.regionId, skipped: 'no marine data' };
  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  // `deg`, όχι `direction` (types.ts:764) — το δίδαγμα του measureShoreWaveRamp.
  const windDirectionDeg = regionDay.wind?.deg;
  const dayByBeachId = new Map();
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    dayByBeachId.set(beach.id, beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay);
  }

  // Κάθe παραλία σκοράρεται μία φορά ΑΝΑ ΠΑΡΑΛΛΑΓΗ, από ΤΟΝ ΙΔΙΟ άνεμο και ΤΗΝ ΙΔΙΑ θάλασσα.
  const scoresByVariant = new Map();
  const top3ByVariant = {};
  for (const variant of VARIANTS) {
    setDamping(variant.value);
    const scores = new Map();
    for (const beach of region.beaches) {
      const dayForecast = dayByBeachId.get(beach.id);
      scores.set(beach.id, calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      }));
    }
    scoresByVariant.set(variant.key, scores);
    const suitable = getSuitableBeaches(
      region.beaches, regionDay, 'gr', undefined, regionDay.hourly, undefined, undefined, region.profiles, scores
    );
    top3ByVariant[variant.key] = prioritizeProtectedRecommendations(
      suitable, getBeaufortLevel((regionDay.wind?.speed ?? 0) * 3.6)
    ).slice(0, 3).map(item => item.beach.id);
  }
  setDamping(BASELINE);

  const rows = [];
  for (const beach of region.beaches) {
    const profile = region.profiles[beach.id];
    const row = { beachId: beach.id, name: beach.name?.gr ?? null, byVariant: {} };
    let hasNumber = false;

    for (const variant of VARIANTS) {
      // Η ανάγνωση των cells γίνεται με τη σταθερά της παραλλαγής ενεργή: το readout (φράχτης
      // §Γ47) και το χρώμα (resolveConditionTone → shoreSeaStateM ως ταβάνι) την ξαναδιαβάζουν
      // ΜΟΝΟΙ τους — με τη σταθερά της βάσης θα μετρούσαμε υβρίδιο δύο κόσμων.
      setDamping(variant.value);
      const score = scoresByVariant.get(variant.key).get(beach.id);

      // Ό,τι κάνει η κάρτα (BeachCard.tsx:1421) και η πινέζα — ίδια συνάρτηση, ίδια ορίσματα,
      // ΜΕ τους φράχτες. `readout.waveM` είναι το νούμερο που όντως τυπώνεται.
      const readout = buildBeachConditionsReadout({
        beachWindSpeedKmph: score.windSpeedKmph,
        regionWindSpeedMs: regionDay.wind?.speed,
        waveHeightM: score.waveHeightM,
        seaStateWaveM: score.seaStateWaveM,
        seaStatePeriodS: score.seaStatePeriodS,
        shoreWaveHeightM: score.shoreWaveHeightM,
        shoreDisplayWaveM: score.shoreDisplayWaveM,
        shoreWaveFromDepartingSea: score.shoreWaveFromDepartingSea,
        language: 'gr',
      });
      const printedM = typeof readout.waveM === 'number' && Number.isFinite(readout.waveM)
        ? Number(readout.waveM.toFixed(2))
        : null;

      // Το χρώμα της πινέζας — ίδιες συναρτήσεις, ίδια ορίσματα με το measureShoreNumberEverywhere
      // (και με το scoring, γραμμή 2495: `weather.wind.deg`).
      const beaufort = getBeaufortLevel(score.windSpeedKmph ?? (regionDay.wind?.speed ?? 0) * 3.6);
      const tone = resolveConditionTone({
        exposureLevel: score.exposureLevel,
        beaufort,
        isEnclosedCove: Boolean(score.enclosedCove),
        seaStateM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
        offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort }),
        downwindSeaSample: hasDownwindSeaSample({
          profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
        }),
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
        shoreShadowDamping: score.shoreShadowDamping,
        swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
      });

      row.byVariant[variant.key] = {
        // Ο αριθμός ΑΠΟΦΑΣΗΣ που κουβαλάει την έκπτωση είναι το `shoreDisplayWaveM` (αυτό
        // διαβάζει η ετυμηγορία από τις 10/08 και το ταβάνι του χρώματος) — ΟΧΙ το
        // `shoreWaveHeightM`, που είναι το μοντέλο SMB του κλειστού όρμου και δεν περνάει από
        // τη shoreSeaStateM. Η πρώτη εκδοχή αυτού του αρχείου μέτρησε το δεύτερο και έβγαλε
        // «η ρίζα κινήθηκε: 0» ενώ το τυπωμένο νούμερο κινιόταν — αδύνατο, και διορθώθηκε.
        shoreM: typeof score.shoreDisplayWaveM === 'number' ? Number(score.shoreDisplayWaveM.toFixed(2)) : null,
        printedM,
        band: printedM === null ? 'unknown' : bandOf(printedM, score.seaStatePeriodS),
        comfort: score.swimmingComfort ?? null,
        tone,
      };
      if (variant.key === 'base') {
        row.exposureLevel = score.exposureLevel ?? null;
        row.seaArrival = score.seaArrivalExposureLevel ?? null;
      }
      if (printedM !== null) hasNumber = true;
    }
    setDamping(BASELINE);
    if (hasNumber) rows.push(row);
  }

  return {
    regionId: region.regionId,
    windKmh: Number(((regionDay.wind?.speed ?? 0) * 3.6).toFixed(1)),
    windDirectionDeg: typeof windDirectionDeg === 'number' ? Math.round(windDirectionDeg) : null,
    rows,
    top3ByVariant,
  };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

// Η σφραγίδα περιλαμβάνει και το παράθυρο του replay: αποτελέσματα δύο διαφορετικών ημερών δεν
// επιτρέπεται να ανακατευτούν κάτω από το ίδιο όνομα σε ένα resume.
const codeStamp = [
  'services/recommendationService.ts',
  'utils/waveCharacter.ts',
  'utils/suitabilityTone.ts',
  'utils/beachConditionsReadout.ts',
  'scripts/measureShoreDampingSensitivity.mjs',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + '@' + new Date().toISOString().slice(0, 10)
  + '@replay:' + (process.env.OPEN_METEO_REPLAY || 'live');

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
  else console.log('  Η μνήμη πετάχτηκε: άλλαξε ο κώδικας, η μέρα, ή το παράθυρο του replay.');
} catch { /* first run */ }

const toFetch = regions.filter(region => !regionComplete(cache[region.regionId]));
console.log(`── ΖΩΝΤΑΝΟ: ${regions.length - toFetch.length} περιοχές από μνήμη, ${toFetch.length} νέες ──`);
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
const coverage = results.length / Math.max(1, regions.length);

// ─────────────────────────────────────────────────────────────────────────────
// (α) ΤΟ ΝΟΥΜΕΡΟ · (β) Η ΛΕΞΗ · (γ) Η ΠΙΝΕΖΑ · (δ) ΤΟ PODIUM
// ─────────────────────────────────────────────────────────────────────────────
const COMFORT_ORDER = ['avoid_swimming', 'caution', 'good', 'excellent'];
const TONE_ORDER = ['red', 'orange', 'yellow', 'blue'];
const rankIn = (order, value) => {
  const index = order.indexOf(value);
  return index === -1 ? null : index;
};

const summary = {};
for (const variant of VARIANTS.filter(v => v.key !== 'base')) {
  summary[variant.key] = {
    label: variant.label,
    value: variant.value,
    beaches: 0,
    printedCalmer: 0,
    printedCalmerDeltas: [],
    printedRougher: 0,
    printedRougherDeltas: [],
    shoreMoved: 0,
    byExposure: {},
    bandMoves: {},
    intoCalm: 0,
    intoCalmPinNotCalm: 0,
    comfortSofter: 0,
    comfortStricter: 0,
    comfortMoves: {},
    softerExamples: [],
    toneCalmer: 0,
    toneStricter: 0,
    toneMoves: {},
    toneCalmerExamples: [],
    podiumRegionsChanged: 0,
    podiumOrderOnly: 0,
    podiumExamples: [],
  };
}
// Η συμφωνία αριθμού-πινέζας ΑΝΑ παραλλαγή (και για τη βάση): τυπωμένο «ήρεμα» κάτω από πινέζα
// που δεν είναι μπλε. Αν οι φράχτες κρατάνε, το νούμερο δεν πρέπει να χειροτερεύει στο 0,35.
const disagreement = {};
for (const variant of VARIANTS) disagreement[variant.key] = { calmNumber: 0, calmNumberPinNotCalm: 0 };

for (const result of results) {
  for (const row of result.rows) {
    const base = row.byVariant.base;

    for (const variant of VARIANTS) {
      const cell = row.byVariant[variant.key];
      if (cell.printedM !== null && cell.band === 'ήρεμα') {
        disagreement[variant.key].calmNumber += 1;
        if (cell.tone !== 'blue') disagreement[variant.key].calmNumberPinNotCalm += 1;
      }
    }

    if (base.printedM === null) continue;
    for (const variant of VARIANTS) {
      if (variant.key === 'base') continue;
      const cell = row.byVariant[variant.key];
      const bucket = summary[variant.key];
      bucket.beaches += 1;

      const level = row.exposureLevel ?? 'άγνωστο';
      bucket.byExposure[level] ??= { beaches: 0, printedChanged: 0 };
      bucket.byExposure[level].beaches += 1;

      if (cell.shoreM !== null && base.shoreM !== null && Math.abs(cell.shoreM - base.shoreM) > 0.005) {
        bucket.shoreMoved += 1;
      }

      if (cell.printedM !== null) {
        const delta = Number((cell.printedM - base.printedM).toFixed(2));
        if (Math.abs(delta) > 0.005) bucket.byExposure[level].printedChanged += 1;
        if (delta < -0.005) {
          bucket.printedCalmer += 1;
          bucket.printedCalmerDeltas.push(-delta);
        } else if (delta > 0.005) {
          bucket.printedRougher += 1;
          bucket.printedRougherDeltas.push(delta);
        }
        if (base.band !== cell.band) {
          const move = `${base.band} → ${cell.band}`;
          bucket.bandMoves[move] = (bucket.bandMoves[move] ?? 0) + 1;
          if (cell.band === 'ήρεμα') {
            bucket.intoCalm += 1;
            if (cell.tone !== 'blue') bucket.intoCalmPinNotCalm += 1;
          }
        }
      }

      const comfortBefore = rankIn(COMFORT_ORDER, base.comfort);
      const comfortAfter = rankIn(COMFORT_ORDER, cell.comfort);
      if (comfortBefore !== null && comfortAfter !== null && comfortBefore !== comfortAfter) {
        const move = `${base.comfort} → ${cell.comfort}`;
        bucket.comfortMoves[move] = (bucket.comfortMoves[move] ?? 0) + 1;
        if (comfortAfter > comfortBefore) {
          bucket.comfortSofter += 1;
          if (bucket.softerExamples.length < 12) {
            bucket.softerExamples.push({
              region: result.regionId, name: row.name, move,
              printedBeforeM: base.printedM, printedAfterM: cell.printedM,
            });
          }
        } else {
          bucket.comfortStricter += 1;
        }
      }

      const toneBefore = rankIn(TONE_ORDER, base.tone);
      const toneAfter = rankIn(TONE_ORDER, cell.tone);
      if (toneBefore !== null && toneAfter !== null && toneBefore !== toneAfter) {
        const move = `${base.tone} → ${cell.tone}`;
        bucket.toneMoves[move] = (bucket.toneMoves[move] ?? 0) + 1;
        if (toneAfter > toneBefore) {
          bucket.toneCalmer += 1;
          if (bucket.toneCalmerExamples.length < 12) {
            bucket.toneCalmerExamples.push({
              region: result.regionId, name: row.name, move,
              printedBeforeM: base.printedM, printedAfterM: cell.printedM,
            });
          }
        } else {
          bucket.toneStricter += 1;
        }
      }
    }
  }

  for (const variant of VARIANTS) {
    if (variant.key === 'base') continue;
    const before = result.top3ByVariant.base ?? [];
    const after = result.top3ByVariant[variant.key] ?? [];
    if (before.join(',') === after.join(',')) continue;
    const bucket = summary[variant.key];
    bucket.podiumRegionsChanged += 1;
    const sameSet = before.length === after.length && before.every(id => after.includes(id));
    if (sameSet) bucket.podiumOrderOnly += 1;
    if (bucket.podiumExamples.length < 12) {
      const nameOf = (id) => result.rows.find(r => r.beachId === id)?.name ?? String(id);
      bucket.podiumExamples.push({
        region: result.regionId,
        before: before.map(nameOf),
        after: after.map(nameOf),
        orderOnly: sameSet,
      });
    }
  }
}

// Δίχτυ πάνω στο εργαλείο #2: σε μέρα με κύμα, 1.608 «προστατευμένες» παραλίες εθνικά (21/08)
// ΠΡΕΠΕΙ να δώσουν διαφορές. Αν καμία δεν κινήθηκε, το scoring δεν είδε την αλλαγμένη σταθερά
// και η αναφορά είναι άκυρη — όχι «καθησυχαστική».
{
  const moved = Object.values(summary).reduce((sum, s) => sum + s.shoreMoved + s.printedCalmer + s.printedRougher, 0);
  if (results.length > 0 && moved === 0) {
    console.error('ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: καμία παραλία δεν άλλαξε σε καμία παραλλαγή — η σταθερά δεν έφτασε στο scoring, ή η μέρα είναι άπνοια. Δες το όριο στην κεφαλίδα.');
    process.exit(1);
  }
}

console.log(`\nΠεριοχές που απάντησαν: ${results.length}/${regions.length} (${pct(results.length, regions.length)}).`);
const totalBeaches = results.reduce((sum, r) => sum + r.rows.length, 0);
console.log(`Παραλίες με νούμερο: ${totalBeaches}.`);
const windSample = results.map(r => r.windKmh).filter(Number.isFinite);
console.log(`Άνεμος περιοχών: διάμεσος ${percentile(windSample, 0.5).toFixed(0)} χλμ/ώρα · p90 ${percentile(windSample, 0.9).toFixed(0)} χλμ/ώρα.`);

console.log('\n── (α) ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΤΥΠΩΝΕΤΑΙ (μετά τους φράχτες) ──────────────────');
for (const variant of VARIANTS.filter(v => v.key !== 'base')) {
  const s = summary[variant.key];
  console.log(`  ${s.label}`);
  console.log(`    η ρίζα κινήθηκε (αριθμός απόφασης): ${s.shoreMoved} παραλίες (${pct(s.shoreMoved, s.beaches)})`);
  console.log(`    ΤΥΠΩΜΕΝΟ πιο ήρεμο: ${s.printedCalmer} (${pct(s.printedCalmer, s.beaches)}) · διάμεση πτώση ${percentile(s.printedCalmerDeltas, 0.5).toFixed(2)} μ. · max ${(s.printedCalmerDeltas.length ? Math.max(...s.printedCalmerDeltas) : 0).toFixed(2)} μ.`);
  console.log(`    τυπωμένο πιο άγριο: ${s.printedRougher} (${pct(s.printedRougher, s.beaches)}) · διάμεση άνοδος ${percentile(s.printedRougherDeltas, 0.5).toFixed(2)} μ.`);
  for (const [level, data] of Object.entries(s.byExposure).sort((a, b) => b[1].beaches - a[1].beaches)) {
    console.log(`      ${level}: ${data.printedChanged}/${data.beaches} αλλάζουν`);
  }
  const moves = Object.entries(s.bandMoves).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`    ζώνες: ${moves || 'καμία αλλαγή ζώνης'}`);
  console.log(`    ➜ περνάνε σε «ήρεμα»: ${s.intoCalm} · από αυτές με πινέζα ΟΧΙ μπλε: ${s.intoCalmPinNotCalm}`);
}

console.log('\n── (β) Η ΕΤΥΜΗΓΟΡΙΑ ΚΟΛΥΜΒΗΣΗΣ ───────────────────────────────────────');
for (const variant of VARIANTS.filter(v => v.key !== 'base')) {
  const s = summary[variant.key];
  const moves = Object.entries(s.comfortMoves).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`  ${s.label}`);
  console.log(`    πιο επιεικής: ${s.comfortSofter} · αυστηρότερη: ${s.comfortStricter}${moves ? `\n    ${moves}` : ''}`);
  if (variant.value < BASELINE && s.softerExamples.length) {
    console.log('    Παραδείγματα προς την επικίνδυνη κατεύθυνση:');
    for (const e of s.softerExamples.slice(0, 6)) {
      console.log(`      ${e.name} (${e.region}): ${e.move} · τυπωμένο ${e.printedBeforeM} → ${e.printedAfterM} μ.`);
    }
  }
}

console.log('\n── (γ) ΤΟ ΧΡΩΜΑ ΤΗΣ ΠΙΝΕΖΑΣ ──────────────────────────────────────────');
for (const variant of VARIANTS.filter(v => v.key !== 'base')) {
  const s = summary[variant.key];
  const moves = Object.entries(s.toneMoves).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
  console.log(`  ${s.label}`);
  console.log(`    πιο ήρεμο χρώμα: ${s.toneCalmer} · αυστηρότερο: ${s.toneStricter}${moves ? `\n    ${moves}` : ''}`);
  if (variant.value < BASELINE && s.toneCalmerExamples.length) {
    console.log('    Παραδείγματα προς την επικίνδυνη κατεύθυνση:');
    for (const e of s.toneCalmerExamples.slice(0, 6)) {
      console.log(`      ${e.name} (${e.region}): ${e.move}`);
    }
  }
}

console.log('\n── (δ) ΤΟ PODIUM ─────────────────────────────────────────────────────');
const withPodium = results.filter(r => (r.top3ByVariant?.base ?? []).length > 0).length;
console.log(`  (${withPodium}/${results.length} περιοχές βγάζουν podium — αν 0, τα παρακάτω δεν σημαίνουν τίποτα.)`);
for (const variant of VARIANTS.filter(v => v.key !== 'base')) {
  const s = summary[variant.key];
  console.log(`  ${s.label}: αλλάζει σε ${s.podiumRegionsChanged}/${results.length} περιοχές (${pct(s.podiumRegionsChanged, results.length)})`
    + ` — μόνο σειρά: ${s.podiumOrderOnly}, αλλάζει πρόσωπα: ${s.podiumRegionsChanged - s.podiumOrderOnly}`);
}

console.log('\n── ΣΥΜΦΩΝΙΑ ΑΡΙΘΜΟΥ-ΠΙΝΕΖΑΣ ΑΝΑ ΠΑΡΑΛΛΑΓΗ ────────────────────────────');
for (const variant of VARIANTS) {
  const d = disagreement[variant.key];
  console.log(`  ${variant.label}: τυπωμένο «ήρεμα» σε ${d.calmNumber} · από αυτά με πινέζα ΟΧΙ μπλε: ${d.calmNumberPinNotCalm} (${pct(d.calmNumberPinNotCalm, d.calmNumber)})`);
}

// Οι παραλίες-μάρτυρες τυπώνονται πάντα ονομαστικά (§Γ3: η εθνική μέση τιμή μπορεί να δείχνει
// καλή ενώ η περίπτωση που ξεκίνησε τη δουλειά έχει χαλάσει): #33 Παραλία Μαραθώνα (§Γ47),
// #32 ο Σχινιάς δίπλα της, #1162 Καβαλικευτά (η ακτή που δίδαξε το «έκπτωση απέναντι στο ΚΥΜΑ»).
const WATCHLIST_IDS = [32, 33, 1162];
const watchlist = [];
for (const result of results) {
  for (const row of result.rows) {
    if (!WATCHLIST_IDS.includes(row.beachId)) continue;
    watchlist.push({ region: result.regionId, ...row });
  }
}
if (watchlist.length) {
  console.log('\n── ΟΙ ΠΑΡΑΛΙΕΣ-ΜΑΡΤΥΡΕΣ ──────────────────────────────────────────────');
  for (const row of watchlist) {
    const cells = VARIANTS.map(v => {
      const c = row.byVariant[v.key];
      return `${v.key}: ${c.printedM ?? '—'} μ./${c.comfort ?? '—'}/${c.tone}`;
    }).join(' · ');
    console.log(`  ${row.name} (${row.exposureLevel ?? '—'}): ${cells}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'shore-damping-sensitivity.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  replayWindow: process.env.OPEN_METEO_REPLAY || null,
  dayIndex: DAY_INDEX,
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  beachesMeasured: totalBeaches,
  variants: VARIANTS,
  watchlist,
  disagreement,
  summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, {
    ...value,
    printedCalmerMedianM: Number(percentile(value.printedCalmerDeltas, 0.5).toFixed(2)),
    printedCalmerMaxM: value.printedCalmerDeltas.length ? Number(Math.max(...value.printedCalmerDeltas).toFixed(2)) : null,
    printedRougherMedianM: Number(percentile(value.printedRougherDeltas, 0.5).toFixed(2)),
    printedCalmerDeltas: undefined,
    printedRougherDeltas: undefined,
  }])),
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);

if (coverage < 0.9) {
  console.error(`\nΑΠΕΤΥΧΕ — απάντησε μόνο το ${pct(results.length, regions.length)} των περιοχών. Μερικό πέρασμα δεν είναι μικρότερη απάντηση, είναι μεροληπτική.`);
  process.exit(1);
}
