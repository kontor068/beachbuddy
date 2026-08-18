/**
 * ΤΙ ΚΟΣΤΙΖΕΙ ΝΑ ΑΝΟΙΞΕΙ Η ΕΞΑΙΡΕΣΗ «ΑΕΡΑΣ ΑΠΟ ΤΗ ΣΤΕΡΙΑ» ΚΑΙ ΣΤΑ 4 ΜΠΟΦΟΡ — ΕΘΝΙΚΑ.
 *
 * ΑΦΟΡΜΗ. Μελιδόνι Κυθήρων, 18/08/2026: δυτικός 4 Μποφ., τομέας W προστατευμένος με ΜΗΔΕΝ
 * ανάπτυγμα, θάλασσα λάδι στα μάτια του επισκέπτη — και κίτρινη πινέζα. Το κίτρινο δεν βγαίνει
 * από τη θάλασσα· βγαίνει από τη σκέτη γραμμή ταχύτητας utils/suitabilityTone.ts:213
 * («από 4 Μποφ. ό,τι δεν είναι exposed → yellow»), που δεν ρωτάει ποτέ αν ο άνεμος έχει πού να
 * σηκώσει κύμα εκεί. Η εξαίρεση που απαντά ακριβώς σε αυτό (utils/offshoreFlatWater) υπάρχει,
 * αλλά ανοίγει ΜΟΝΟ στα 5 Μποφ.
 *
 * ΤΙ ΜΕΤΡΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΔΥΟ ΠΑΡΑΛΛΑΓΕΣ
 *   V1 = η ΙΔΙΑ πύλη, ένα σκαλί πιο κάτω (4 Μποφ.). Καμία χαλάρωση κριτηρίου.
 *   V2 = V1 ΧΩΡΙΣ τη γραμμή της γωνίας. Το Μελιδόνι κόβεται στη γωνία (onshore −0,54 έναντι
 *        κατωφλιού −0,80) γιατί ο άνεμος φυσάει ΛΟΞΑ κατά μήκος της ακτής, όχι κάθετα από τη
 *        στεριά — και η γωνία μετριέται από το `facingDeg` του ΣΤΟΜΙΟΥ. Ίδια ένσταση με το
 *        scripts/measureOffshoreAngleGate.mjs, εδώ στη ζώνη των 4 Μποφ.
 *
 * ΔΕΝ ΑΝΤΙΓΡΑΦΕΤΑΙ ΚΩΔΙΚΑΣ ΓΙΑ ΤΟ V1: καλείται η ΠΡΑΓΜΑΤΙΚΗ
 * `holdsFlatWaterUnderOffshoreWind` με beaufort 5 — δηλαδή η ίδια γεωμετρία, ίδια κατώφλια,
 * ίδια συνάρτηση. Μόνο το V2 αντιγράφει τον πυρήνα (χωρίς τη γωνία) και το `selfCheck()`
 * σκάει αν η αντιγραφή αποκλίνει.
 *
 * ΤΟ «ΜΕΤΑ» ΔΕΝ ΞΑΝΑΓΡΑΦΕΙ ΤΗ ΣΚΑΛΑ. Μια παραλία που «σηκώνεται» κρίνεται με
 * `resolveConditionTone(... beaufort: 3 ...)`, δηλαδή διαβάζεται σαν να φυσούσε 3 Μποφ.: εκεί
 * μια προστατευμένη ακτή είναι ήδη μπλε. Έτσι ΟΛΑ τα ταβάνια που έρχονται μετά —
 * θαλασσοταραχή, ετυμηγορία κολύμβησης, όρμος — τρέχουν αυτούσια. Ο αυτοέλεγχος επιβεβαιώνει
 * ότι στα 3 και στα 4 Μποφ. ο κανόνας του όρμου συμπεριφέρεται ίδια, αλλιώς το κόλπο θα
 * μετρούσε και κάτι άλλο μαζί.
 *
 * ΜΟΝΟΔΡΟΜΟ ΠΡΟΣ ΤΟΝ ΕΠΙΚΙΝΔΥΝΟ ΔΡΟΜΟ: κάθε αλλαγή που παράγει είναι «πιο ήρεμο». Άρα το
 * νούμερο που μετράει είναι πόσες παραλίες γίνονται ΜΠΛΕ και με τι θάλασσα από κάτω.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/quality/offshore-lift-4bft.json.
 *
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" \
 *     node scripts/measureOffshoreLiftAtFourBeaufort.mjs --live [--days=3] [--regions=a,b]
 */
import { createRequire } from 'node:module';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import ts from 'typescript';
import { enablePaidOpenMeteo } from './lib/paidOpenMeteo.mjs';

/**
 * Το κλειδί ΔΕΝ γράφεται πουθενά: διαβάζεται από το Netlify με το token του `.env` και μένει
 * μόνο στη μνήμη αυτής της διεργασίας. Χωρίς αυτό η εθνική σάρωση καίει το δωρεάν όριο.
 */
const ensurePaidPlan = async () => {
  if (process.env.OPEN_METEO_API_KEY) return enablePaidOpenMeteo({ quiet: true });
  try {
    const token = (readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    const siteId = JSON.parse(readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    if (!token || !siteId) return false;
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    const key = ((await res.json()).values || []).map(v => v.value).find(Boolean);
    if (!key) return false;
    process.env.OPEN_METEO_API_KEY = key;
    return enablePaidOpenMeteo({ quiet: true });
  } catch { return false; }
};

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount = function () { return 0; };\n', filename);
    return;
  }
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
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

const { processForecastData, applyMarineToDailyForecast } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const {
  holdsFlatWaterUnderOffshoreWind,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
  OFFSHORE_FLAT_MAX_INTENSITY,
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MAX_MODELLED_WAVE_M,
  OFFSHORE_FLAT_MAX_ONSHORE,
  OFFSHORE_FLAT_BEAUFORT,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const { windSectorFromDegrees } = require(path.join(root, 'utils/windExposure.ts'));
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));

const BEAUFORT_5_REFERENCE_WIND_KMH = 38;
/** Η ζώνη που εξετάζουμε. Η σημερινή εξαίρεση ζει στο OFFSHORE_FLAT_BEAUFORT (=5). */
const TARGET_BEAUFORT = 4;
/** Το «σαν να φυσούσε τόσο»: στα 3 Μποφ. μια προστατευμένη ακτή είναι ήδη μπλε. */
const LIFTED_AS_BEAUFORT = 3;

const args = process.argv.slice(2);
if (!args.includes('--live')) {
  console.error('Χρειάζεται --live: η μέτρηση τραβάει πραγματική πρόγνωση για κάθε περιοχή.');
  process.exit(1);
}
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length)?.split(',');
const DAYS = Number(args.find(a => a.startsWith('--days='))?.slice('--days='.length) ?? 3);
/**
 * V3: το κατώφλι έντασης χαλαρωμένο. Το Μελιδόνι κάθεται στο 15,1 με το σημερινό όριο στο 15 —
 * μια δέκατη μακριά. Ένα κατώφλι που κόβει την ίδια την αφορμή της διόρθωσης πρέπει να
 * μετρηθεί, όχι να συζητηθεί.
 */
const RELAXED_MAX_INTENSITY = Number(args.find(a => a.startsWith('--maxIntensity='))?.slice('--maxIntensity='.length) ?? 25);

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');

/**
 * Ο πυρήνας του utils/offshoreFlatWater ΑΝΟΙΓΜΕΝΟΣ ΣΕ ΡΗΤΡΕΣ — ώστε να φαίνεται ΠΟΙΑ γραμμή
 * κόβει την κάθε παραλία, όχι μόνο ότι κόπηκε. Χωρίς αυτό, ένα «το Μελιδόνι δεν περνάει» δεν
 * λέει αν φταίει η γωνία, η ένταση ή το ανάπτυγμα — και η επόμενη απόφαση παίρνεται στα τυφλά.
 */
const gateDetail = (profile, windDirectionDeg, { useAngle, maxIntensity }) => {
  const out = { pass: false, blockedBy: null, onshore: null, intensity: null, fetchKm: null, facingDeg: null, modelledM: null };
  if (!profile) return { ...out, blockedBy: 'χωρίς γεωμετρία' };
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return { ...out, blockedBy: 'χωρίς κατεύθυνση' };
  const facingDeg = profile.facingDeg;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return { ...out, blockedBy: 'χωρίς όψη' };
  out.facingDeg = facingDeg;
  if (profile.confidence !== 'high' && profile.confidence !== 'medium') return { ...out, blockedBy: 'χαμηλή εμπιστοσύνη' };
  const sector = profile.sectors?.[windSectorFromDegrees(windDirectionDeg)];
  if (!sector) return { ...out, blockedBy: 'χωρίς τομέα' };
  out.intensity = sector.intensity ?? null;
  out.fetchKm = sector.fetchKm ?? null;
  out.onshore = onshoreComponent(windDirectionDeg, facingDeg);
  if (sector.level !== 'protected') return { ...out, blockedBy: 'τομέας όχι protected' };
  if (sector.blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return { ...out, blockedBy: 'ακτίνες όχι 100% φραγμένες' };
  if (typeof sector.intensity !== 'number' || sector.intensity >= maxIntensity) return { ...out, blockedBy: 'ένταση' };
  if (sector.fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return { ...out, blockedBy: 'ανάπτυγμα' };
  const modelledM = estimateFetchLimitedWaveHeightM({
    windSpeedKmh: BEAUFORT_5_REFERENCE_WIND_KMH,
    fetchKm: sector.fetchKm,
  });
  out.modelledM = modelledM ?? null;
  if (typeof modelledM === 'number' && modelledM > OFFSHORE_FLAT_MAX_MODELLED_WAVE_M) return { ...out, blockedBy: 'μοντέλο κύματος' };
  if (useAngle && out.onshore > OFFSHORE_FLAT_MAX_ONSHORE) return { ...out, blockedBy: 'γωνία' };
  return { ...out, pass: true };
};

/** V2: ο πυρήνας χωρίς ΜΟΝΟ τη γραμμή της γωνίας, στα σημερινά κατώφλια. */
const sectorHoldsNoWindWaveWithoutAngle = (profile, windDirectionDeg) => {
  const d = gateDetail(profile, windDirectionDeg, { useAngle: false, maxIntensity: OFFSHORE_FLAT_MAX_INTENSITY });
  return d.pass ? d : null;
};

const selfCheck = () => {
  const fail = (msg) => { console.error(`ΑΥΤΟΕΛΕΓΧΟΣ: ${msg}`); process.exit(1); };
  // 1. Η αντιγραφή του V2 δεν ξεπέρασε κανένα ΑΛΛΟ φίλτρο.
  const windFrom = 180;
  const profile = {
    facingDeg: 0,
    confidence: 'high',
    sectors: { [windSectorFromDegrees(windFrom)]: { level: 'protected', blockedRayRatio: 1, intensity: 0, fetchKm: 0.1 } },
  };
  const real = holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg: windFrom, beaufort: OFFSHORE_FLAT_BEAUFORT });
  const mirrored = sectorHoldsNoWindWaveWithoutAngle(profile, windFrom);
  if (!mirrored) fail('ο αντιγραμμένος πυρήνας κόβει εκεί που ο αληθινός δεν κόβει.');
  if (real !== (mirrored.onshore <= OFFSHORE_FLAT_MAX_ONSHORE)) fail('πραγματικός και αντιγραμμένος πυρήνας διαφωνούν.');
  // 2. Το «σαν 3 Μποφ.» δίνει όντως μπλε, και τα 4 όντως κίτρινο.
  const t3 = resolveConditionTone({ exposureLevel: 'protected', beaufort: LIFTED_AS_BEAUFORT });
  const t4 = resolveConditionTone({ exposureLevel: 'protected', beaufort: TARGET_BEAUFORT });
  if (t3 !== 'blue') fail(`στα ${LIFTED_AS_BEAUFORT} Μποφ. μια προστατευμένη ακτή δεν βγαίνει μπλε (${t3}).`);
  if (t4 !== 'yellow') fail(`στα ${TARGET_BEAUFORT} Μποφ. μια προστατευμένη ακτή δεν βγαίνει κίτρινη (${t4}).`);
  // 3. Ο κανόνας του όρμου δεν αλλάζει ανάμεσα στα 3 και στα 4 — αλλιώς το κόλπο μετράει και άλλο.
  for (const seaStateM of [undefined, 0.4, 0.9, 1.4]) {
    const a = resolveConditionTone({ exposureLevel: 'protected', beaufort: LIFTED_AS_BEAUFORT, isEnclosedCove: true, seaStateM });
    const b = resolveConditionTone({ exposureLevel: 'protected', beaufort: LIFTED_AS_BEAUFORT, isEnclosedCove: false, seaStateM });
    if (a !== b) fail(`στα ${LIFTED_AS_BEAUFORT} Μποφ. ο όρμος αλλάζει το αποτέλεσμα (θάλασσα ${seaStateM}) — το κόλπο μετράει δύο πράγματα.`);
  }
};
selfCheck();

const loadRegion = (file) => {
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    const profilesRaw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
    const profiles = {};
    for (const profile of Object.values(profilesRaw ?? {})) {
      if (profile?.beachId != null) profiles[profile.beachId] = profile;
    }
    return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, regionPoint: app.island.coordinates, profiles };
  } catch { return null; }
};

const regions = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .map(loadRegion)
  .filter(Boolean)
  .filter(region => region.regionPoint && Number.isFinite(region.regionPoint.lat))
  .filter(region => !regionFilter || regionFilter.includes(region.regionId));

const POINTS_PER_MINUTE = 450;
const pointWindow = [];
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const paceForPoints = async (count) => {
  for (;;) {
    const cutoff = performance.now() - 60_000;
    while (pointWindow.length && pointWindow[0].at < cutoff) pointWindow.shift();
    const spent = pointWindow.reduce((sum, entry) => sum + entry.count, 0);
    if (spent + count <= POINTS_PER_MINUTE) break;
    const waitMs = Math.max(1000, pointWindow[0].at + 60_000 - performance.now());
    process.stderr.write(`\r  rate limit: ${spent} σημεία, αναμονή ${Math.ceil(waitMs / 1000)}s…        `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

const totals = {
  regionsMeasured: 0,
  regionsSkipped: 0,
  beachDays: 0,
  atFour: 0,
  protectedAtFour: 0,
  v1Passes: 0,
  v2Passes: 0,
  v3Passes: 0,
  v1Changed: 0,
  v2Changed: 0,
  v3Changed: 0,
  v1SeaHeld: 0,
  v2SeaHeld: 0,
  v3SeaHeld: 0,
};
const beaufortHistogram = {};
const v1Beaches = new Set();
const v2Beaches = new Set();
const v3Beaches = new Set();
const rows = [];
const byRegion = new Map();
const spotlight = [];
/** Ποια ρήτρα κόβει τις protected-στα-4 που ΔΕΝ περνάνε — αλλιώς το «δεν περνάει» δεν διδάσκει. */
const blockedByHistogram = {};
/** Πόσο ψηλή είναι η θάλασσα κάτω από κάθε αλλαγή σε ΜΠΛΕ. Το νούμερο της ασφάλειας. */
const seaBuckets = { 'v1': {}, 'v2': {}, 'v3': {} };
const bucketOf = (m) => (typeof m !== 'number' ? 'άγνωστη'
  : m < 0.2 ? '<0,2μ' : m < 0.4 ? '0,2-0,4μ' : m < 0.6 ? '0,4-0,6μ' : m < 0.8 ? '0,6-0,8μ' : m < 1.0 ? '0,8-1,0μ' : '≥1,0μ');

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  await paceForPoints(resolution.points.length + 1);
  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);
  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { skipped: 'χωρίς άνεμο' };
  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const days = processForecastData(mergeMarineForecastData(wind.data, regionMarine)).slice(0, DAYS);
  if (!days.length) return { skipped: 'χωρίς ημέρα πρόγνωσης' };

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
      const beaufort = score.simpleWindSuitability?.windBeaufort ?? 0;
      totals.beachDays += 1;
      beaufortHistogram[beaufort] = (beaufortHistogram[beaufort] ?? 0) + 1;
      if (beaufort !== TARGET_BEAUFORT) continue;
      totals.atFour += 1;
      if (score.exposureLevel !== 'protected') continue;
      totals.protectedAtFour += 1;

      const windDirectionDeg = dayForecast.wind?.deg;
      // V1: η ΠΡΑΓΜΑΤΙΚΗ πύλη, μόνο με το φράγμα των Μποφ. παρακαμμένο.
      const v1 = holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort: OFFSHORE_FLAT_BEAUFORT });
      const v2geom = sectorHoldsNoWindWaveWithoutAngle(profile, windDirectionDeg);
      const v3detail = gateDetail(profile, windDirectionDeg, { useAngle: false, maxIntensity: RELAXED_MAX_INTENSITY });
      const v3geom = v3detail.pass ? v3detail : null;
      if (!v1 && !v2geom && !v3geom) {
        const reason = gateDetail(profile, windDirectionDeg, { useAngle: true, maxIntensity: OFFSHORE_FLAT_MAX_INTENSITY }).blockedBy ?? 'άγνωστο';
        blockedByHistogram[reason] = (blockedByHistogram[reason] ?? 0) + 1;
        continue;
      }
      if (v1) totals.v1Passes += 1;
      if (v2geom) totals.v2Passes += 1;
      if (v3geom) totals.v3Passes += 1;

      const toneInput = {
        exposureLevel: score.exposureLevel,
        beaufort,
        isEnclosedCove: Boolean(score.enclosedCove),
        seaStateM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
        offshoreFlatWater: Boolean(score.simpleWindSuitability?.offshoreFlatWater),
        downwindSeaSample: Boolean(score.simpleWindSuitability?.downwindSeaSample),
        swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
      };
      const before = resolveConditionTone(toneInput);
      const after = resolveConditionTone({ ...toneInput, beaufort: LIFTED_AS_BEAUFORT });
      const changed = before !== after;

      const seaBucket = bucketOf(score.seaStateWaveM);
      const note = (variant, lit) => {
        if (!lit) return;
        if (!changed) { totals[`${variant}SeaHeld`] += 1; return; }
        totals[`${variant}Changed`] += 1;
        (variant === 'v1' ? v1Beaches : variant === 'v2' ? v2Beaches : v3Beaches).add(`${region.regionId}#${beach.id}`);
        seaBuckets[variant][seaBucket] = (seaBuckets[variant][seaBucket] ?? 0) + 1;
      };
      note('v1', Boolean(v1));
      note('v2', Boolean(v2geom));
      note('v3', Boolean(v3geom));

      if (beach.id === 140) {
        spotlight.push({
          dayIndex, before, after, changed,
          gates: { v1: Boolean(v1), v2: Boolean(v2geom), v3: Boolean(v3geom) },
          windFromDeg: Math.round(windDirectionDeg),
          onshore: Number(v3detail.onshore?.toFixed(2) ?? NaN),
          intensity: v3detail.intensity,
          fetchKm: v3detail.fetchKm,
          seaStateWaveM: score.seaStateWaveM,
          seaStatePeriodS: score.seaStatePeriodS,
          seaStateSeverityM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
          swellM: score.marine?.swellWaveHeightM ?? null,
          downwindSeaSample: Boolean(score.simpleWindSuitability?.downwindSeaSample),
          seaArrivalExposureLevel: score.seaArrivalExposureLevel ?? null,
          swimmingComfort: score.swimmingComfort,
        });
      }

      if (!changed) continue;
      const entry = byRegion.get(region.regionId) ?? { v1: 0, v2: 0, v3: 0 };
      if (v1) entry.v1 += 1;
      if (v2geom) entry.v2 += 1;
      if (v3geom) entry.v3 += 1;
      byRegion.set(region.regionId, entry);

      const geom = v2geom ?? v3geom;
      const row = {
        regionId: region.regionId,
        beachId: beach.id,
        name: beach.name?.gr ?? beach.name?.en ?? String(beach.id),
        dayIndex,
        variant: v1 ? 'V1' : v2geom ? 'V2' : 'V3',
        before,
        after,
        windFromDeg: Math.round(windDirectionDeg),
        facingDeg: geom ? Math.round(geom.facingDeg) : null,
        onshore: geom ? Number(geom.onshore.toFixed(2)) : null,
        intensity: geom ? geom.intensity : null,
        fetchKm: geom ? geom.fetchKm : null,
        seaM: score.seaStateWaveM == null ? null : Number(score.seaStateWaveM.toFixed(2)),
        periodS: score.seaStatePeriodS ?? null,
        swellM: score.marine?.swellWaveHeightM ?? null,
      };
      rows.push(row);
    }
  }
  return { ok: true };
};

const paid = await ensurePaidPlan();
console.log(`  Open-Meteo: ${paid ? 'ΠΛΗΡΩΜΕΝΟ πλάνο' : '⚠️ ΔΩΡΕΑΝ όριο — η εθνική σάρωση μπορεί να κοπεί στη μέση'}`);
console.log(`── ΖΩΝΤΑΝΟ: ${regions.length} περιοχές × ${DAYS} μέρες · ένταση V3 <${RELAXED_MAX_INTENSITY} ──`);
for (let i = 0; i < regions.length; i += 1) {
  const region = regions[i];
  process.stderr.write(`\r  ${i + 1}/${regions.length} ${region.regionId}                    `);
  try {
    const result = await measureRegion(region);
    if (result.skipped) totals.regionsSkipped += 1; else totals.regionsMeasured += 1;
  } catch (error) {
    totals.regionsSkipped += 1;
    process.stderr.write(`\n  ⚠️ ${region.regionId}: ${error?.message ?? error}\n`);
  }
}
process.stderr.write('\r                                                        \r');

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(2)}%`;
console.log('');
console.log('Η ΕΞΑΙΡΕΣΗ «ΑΕΡΑΣ ΑΠΟ ΤΗ ΣΤΕΡΙΑ» ΣΤΑ 4 ΜΠΟΦΟΡ');
console.log(`  περιοχές                 ${totals.regionsMeasured} (παραλείφθηκαν ${totals.regionsSkipped})`);
console.log(`  παραλιο-ημέρες           ${totals.beachDays}`);
console.log(`  στα 4 Μποφ.              ${totals.atFour} · ${pct(totals.atFour, totals.beachDays)}`);
console.log(`  εκ των οποίων protected  ${totals.protectedAtFour} · ${pct(totals.protectedAtFour, totals.beachDays)}`);
console.log('');
console.log(`  V1 περνάει την πύλη      ${totals.v1Passes}  → ΑΛΛΑΖΕΙ ΧΡΩΜΑ ${totals.v1Changed} (${pct(totals.v1Changed, totals.beachDays)} των παραλιο-ημερών) · ${v1Beaches.size} παραλίες`);
console.log(`     κρατήθηκε από θάλασσα ${totals.v1SeaHeld}`);
console.log(`  V2 (χωρίς γωνία)         ${totals.v2Passes}  → ΑΛΛΑΖΕΙ ΧΡΩΜΑ ${totals.v2Changed} (${pct(totals.v2Changed, totals.beachDays)}) · ${v2Beaches.size} παραλίες`);
console.log(`     κρατήθηκε από θάλασσα ${totals.v2SeaHeld}`);
console.log(`  V3 (+ ένταση <${RELAXED_MAX_INTENSITY})       ${totals.v3Passes}  → ΑΛΛΑΖΕΙ ΧΡΩΜΑ ${totals.v3Changed} (${pct(totals.v3Changed, totals.beachDays)}) · ${v3Beaches.size} παραλίες`);
console.log(`     κρατήθηκε από θάλασσα ${totals.v3SeaHeld}`);
console.log('');
console.log('  κατανομή Μποφ.           ' + Object.keys(beaufortHistogram).sort((a, b) => a - b).map(k => `${k}:${beaufortHistogram[k]}`).join(' '));
console.log('');
console.log('  ΠΟΙΑ ΘΑΛΑΣΣΑ ΒΑΦΕΤΑΙ ΜΠΛΕ (ύψος κάτω από κάθε αλλαγή)');
for (const v of ['v1', 'v2', 'v3']) {
  const entries = Object.entries(seaBuckets[v]).sort((a, b) => a[0].localeCompare(b[0]));
  console.log(`    ${v.toUpperCase()}  ${entries.length ? entries.map(([k, n]) => `${k}:${n}`).join('  ') : '—'}`);
}
console.log('');
console.log('  ΤΙ ΚΟΒΕΙ ΤΙΣ ΥΠΟΛΟΙΠΕΣ protected-στα-4');
for (const [reason, n] of Object.entries(blockedByHistogram).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${reason.padEnd(30)} ${n}`);
}
console.log('');
console.log('  ΤΟΠ ΠΕΡΙΟΧΕΣ (V3)');
for (const [rid, v] of [...byRegion].sort((a, b) => b[1].v3 - a[1].v3).slice(0, 12)) {
  console.log(`    ${rid.padEnd(34)} V1 ${String(v.v1).padStart(4)} · V2 ${String(v.v2).padStart(4)} · V3 ${String(v.v3).padStart(4)}`);
}
console.log('');
console.log('  ΔΕΙΓΜΑ ΑΛΛΑΓΩΝ');
for (const row of rows.slice(0, 15)) {
  console.log(`    ${row.variant} ${row.name} (${row.regionId}) ημ.${row.dayIndex} — άνεμος ${row.windFromDeg}°, όψη ${row.facingDeg}°, `
    + `onshore ${row.onshore}, ανάπτυγμα ${row.fetchKm}χλμ, θάλασσα ${row.seaM}μ/${row.periodS}s: ${row.before} → ${row.after}`);
}
if (spotlight.length) {
  console.log('');
  console.log('  ΜΕΛΙΔΟΝΙ (id 140)');
  for (const row of spotlight) {
    console.log(`    ${row.variant} ημ.${row.dayIndex} άνεμος ${row.windFromDeg}° onshore ${row.onshore} θάλασσα ${row.seaM}μ: ${row.before} → ${row.after}`);
  }
} else {
  console.log('');
  console.log('  ΜΕΛΙΔΟΝΙ (id 140): καμία αλλαγή σε αυτές τις μέρες.');
}

mkdirSync(reportDir, { recursive: true });
const outPath = path.join(reportDir, 'offshore-lift-4bft.json');
writeFileSync(outPath, `${JSON.stringify({
  measuredAt: new Date().toISOString(),
  days: DAYS,
  targetBeaufort: TARGET_BEAUFORT,
  liftedAsBeaufort: LIFTED_AS_BEAUFORT,
  relaxedMaxIntensity: RELAXED_MAX_INTENSITY,
  totals,
  beaufortHistogram,
  seaBuckets,
  blockedByHistogram,
  v1BeachCount: v1Beaches.size,
  v2BeachCount: v2Beaches.size,
  v3BeachCount: v3Beaches.size,
  byRegion: Object.fromEntries(byRegion),
  rows,
  spotlightMelidoni: spotlight,
}, null, 2)}\n`);
console.log(`\n→ ${path.relative(root, outPath)}`);
