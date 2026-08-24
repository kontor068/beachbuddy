/**
 * ΤΙ ΛΕΕΙ Η ΦΥΣΙΚΗ ΤΗΣ ΣΚΙΑΣ ΑΝΤΙ ΓΙΑ ΤΟ ×0,5 — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ (24/08/2026).
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Η έκπτωση προστατευμένης ακτής είναι επίπεδη: ×0,5 για ΚΑΘΕ προστατευμένη
 * παραλία, όσο ρηχά ή βαθιά κι αν κάθεται στη σκιά του εμποδίου της. Η ακτομηχανική λέει το
 * αντίθετο εδώ και 70 χρόνια (διαγράμματα περίθλασης SPM/Wiegel, ημιάπειρο εμπόδιο): στο ΟΡΙΟ
 * της σκιάς φτάνει ~το μισό ύψος (K_d ≈ 0,5 — το σημερινό μας νούμερο είναι η τιμή της άκρης!),
 * και όσο βαθύτερα στη σκιά, τόσο λιγότερο (30° μέσα ≈ 0,25, 60°+ ≈ 0,1). Κι ανάποδα: κύμα που
 * μπαίνει από ΑΝΟΙΧΤΟ διάδρομο δεν είναι σε καμία σκιά — K_d ≈ 1, καμία έκπτωση.
 *
 * Ο ΔΕΙΚΤΗΣ ΤΗΣ ΣΚΙΑΣ ΑΠΟ ΤΗ ΓΕΩΜΕΤΡΙΑ ΠΟΥ ΗΔΗ ΕΧΟΥΜΕ: θ = γωνιακή απόσταση της κατεύθυνσης
 * του κύματος (marine.waveDirectionDeg — Η ΙΔΙΑ που κρίνει το seaArrival στο scoring) από τον
 * κοντινότερο ΑΝΟΙΧΤΟ τομέα του προφίλ (fetch ≥ OPEN_FETCH_KM). Μέσα στον διάδρομο (θ ≤ 22,5°,
 * μισός τομέας) → K_d = 1. Πέρα από την άκρη → K_d = max(0,10, 0,5·e^{−(θ−22,5°)/45°}).
 *
 * ΑΠΛΟΠΟΙΗΣΕΙΣ, ΓΡΑΜΜΕΝΕΣ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ:
 *  - Το σχήμα της απομείωσης είναι το πρώτης τάξης σχήμα των διαγραμμάτων SPM, όχι πλήρης
 *    λύση περίθλασης· η εξάρτηση από την ΠΕΡΙΟΔΟ (η ρεστία στρίβει περισσότερο) ΔΕΝ μπαίνει
 *    ακόμα — θα έκανε τα βαθιά-στη-σκιά ΛΙΓΟΤΕΡΟ ήρεμα για μακρύ κύμα, δηλ. προς την προσοχή.
 *  - Ανάλυση 45° (8 τομείς) — η θ είναι σκαλωτή, όχι συνεχής.
 *  - Ο ΒΥΘΟΣ δεν μπαίνει εδώ (θα ήταν βήμα 2 — θραύση στα ρηχά)· η σκιά είναι η κύρια δύναμη.
 *  - Αλλάζει ΜΟΝΟ ο συντελεστής στα σκέλη που ΗΔΗ παίρνουν έκπτωση (protected + §Γ59 grazing
 *    κρατάει το 0,5 του) — η ΠΥΛΗ ποιος δικαιούται έκπτωση μένει ολόιδια. Παραλία χωρίς
 *    κατεύθυνση κύματος → πέφτει στο σημερινό 0,5 (καμία αλλαγή από άγνοια).
 *
 * ΤΙ ΒΓΑΖΕΙ: την κατανομή του K_d εθνικά, τα δύο ευρήματα-κλειδιά
 *   (α) «διάδρομος»: παίρνει σήμερα ×0,5 ενώ το κύμα μπαίνει από ανοιχτά → η φυσική λέει
 *       ΠΕΡΙΣΣΟΤΕΡΟ κύμα — η επικίνδυνη πλευρά του επίπεδου 0,5·
 *   (β) «βαθιά σκιά»: η φυσική λέει ΛΙΓΟΤΕΡΟ από το μισό → προς το πιο ήρεμο, μπαίνει ΜΟΝΟ
 *       με απόφαση Μίλτου (§9)·
 * και το εθνικό «τι θα άλλαζε στην οθόνη» με το πλήρες scoring (νούμερο μετά τους φράχτες,
 * ετυμηγορία, πινέζα, podium) — ίδια μηχανή με το measureShoreDampingSensitivity.
 *
 * Run: OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --context production --site …)" \
 *      OPEN_METEO_REPLAY=2022-09-06:2022-09-08 OPEN_METEO_REPLAY_SHIFT=1 \
 *      node scripts/measureShoreShadowPhysics.mjs [--regions=a,b]
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
const { seaStateSeverityM, SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, SEA_ARRIVAL_GRAZING, SHORE_DAMPING_BY_EXPOSURE } = waveCharacter;
const originalShoreSeaStateM = waveCharacter.shoreSeaStateM;
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { holdsFlatWaterUnderOffshoreWind, hasDownwindSeaSample } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
const { prioritizeProtectedRecommendations } = require(path.join(root, 'services/topPickRanking.ts'));
const { processForecastData, applyMarineToDailyForecast, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData } =
  require(path.join(root, 'services/weatherService.ts'));

const args = process.argv.slice(2);
const regionFilter = args.find(a => a.startsWith('--regions='))?.slice('--regions='.length).split(',');

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const reportDir = path.join(root, 'reports/quality');
const cachePath = path.join(root, '.tmp/shore-shadow-physics-cache.json');
const DAY_INDEX = 0;

// ─────────────────────────────────────────────────────────────────────────────
// Ο ΣΥΝΤΕΛΕΣΤΗΣ ΤΗΣ ΣΚΙΑΣ
// ─────────────────────────────────────────────────────────────────────────────
const OPEN_FETCH_KM = 10;          // τομέας με τουλάχιστον τόσο ανοιχτό νερό = «διάδρομος»
const CORRIDOR_HALF_DEG = 22.5;    // μισός τομέας — μέσα του το κύμα δεν είναι σε σκιά
const DECAY_DEG = 45;              // e-folding της αποσυμείωσης πίσω από την άκρη (σχήμα SPM)
const KD_AT_EDGE = 0.5;            // η τιμή του ορίου σκιάς — ταυτίζεται με το σημερινό ×0,5
const KD_FLOOR = 0.10;
const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const angularDistance = (a, b) => {
  const d = Math.abs(((a - b) % 360 + 540) % 360 - 180);
  return d;
};

/** θ (μοίρες από τον κοντινότερο ανοιχτό διάδρομο) και K_d για δεδομένο προφίλ + κατεύθυνση. */
const shadowOf = (profile, waveFromDeg) => {
  if (!profile?.sectors || typeof waveFromDeg !== 'number' || !Number.isFinite(waveFromDeg)) return null;
  let theta = null;
  SECTOR_ORDER.forEach((key, index) => {
    const sector = profile.sectors[key];
    if (!sector || !(sector.fetchKm >= OPEN_FETCH_KM)) return;
    const d = angularDistance(waveFromDeg, index * 45);
    if (theta === null || d < theta) theta = d;
  });
  if (theta === null) return { thetaDeg: 180, kd: KD_FLOOR, bucket: 'κλειστός' }; // κανένας διάδρομος πουθενά
  if (theta <= CORRIDOR_HALF_DEG) return { thetaDeg: theta, kd: 1, bucket: 'διάδρομος' };
  const kd = Math.max(KD_FLOOR, KD_AT_EDGE * Math.exp(-(theta - CORRIDOR_HALF_DEG) / DECAY_DEG));
  return { thetaDeg: theta, kd: Number(kd.toFixed(3)), bucket: kd > 0.3 ? 'άκρη σκιάς' : 'βαθιά σκιά' };
};

// ─────────────────────────────────────────────────────────────────────────────
// ΤΟ PATCH: ίδια πύλη, άλλος συντελεστής ΜΟΝΟ στο σκέλος της προστατευμένης.
// Πιστός καθρέφτης της λογικής του utils/waveCharacter.shoreSeaStateM — και επειδή ένας
// καθρέφτης μπορεί να στραβώσει, ελέγχεται από κάτω σε πλέγμα εισόδων ότι με K_d = 0,5
// βγάζει ΑΚΡΙΒΩΣ ό,τι η αυθεντική, πριν τρέξει οτιδήποτε ζωντανό.
// ─────────────────────────────────────────────────────────────────────────────
let ctx = null;          // { profile, waveDeg } — ορίζεται πριν από κάθε σκοράρισμα
let kdEnabled = false;

const patchedShoreSeaStateM = (openWaterSeaStateM, exposureLevel, seaArrivalExposureLevel, curatedWindOnlyProtection, shadowDamping) => {
  if (typeof openWaterSeaStateM !== 'number' || !Number.isFinite(openWaterSeaStateM)) return undefined;
  const seaGrazesOrDeparts = seaArrivalExposureLevel === SEA_ARRIVAL_GRAZING;
  const shelteredFromTheSea = seaArrivalExposureLevel === undefined
    || seaArrivalExposureLevel === 'protected'
    || seaGrazesOrDeparts;
  const shelterEarnedAgainstTheWave = !curatedWindOnlyProtection;
  const grazingSeaRelief = exposureLevel === 'partial' && seaGrazesOrDeparts && shelterEarnedAgainstTheWave;

  let damping;
  if (exposureLevel === 'protected' && shelteredFromTheSea && shelterEarnedAgainstTheWave) {
    // kd variant: το K_d του ΕΡΓΑΛΕΙΟΥ από το ctx · base variant: ό,τι πέρασε η ΠΑΡΑΓΩΓΗ
    // (από 24/08 η παραγωγή περνάει η ίδια K_d — άρα base = πραγματική οθόνη, και η σύγκριση
    // base↔kd είναι ο έλεγχος ότι το ship αναπαράγει ακριβώς τη μετρημένη πρόταση).
    const shadow = kdEnabled && ctx ? shadowOf(ctx.profile, ctx.waveDeg) : null;
    const shipped = typeof shadowDamping === 'number' && Number.isFinite(shadowDamping)
      ? Math.min(1, Math.max(0, shadowDamping))
      : SHORE_DAMPING_BY_EXPOSURE.protected;
    damping = shadow ? shadow.kd : shipped;
  } else if (grazingSeaRelief) {
    damping = SHORE_DAMPING_BY_EXPOSURE.protected;   // το §Γ59 μένει στο 0,5 του — εκτός εμβέλειας
  } else if (exposureLevel === 'partial') {
    damping = SHORE_DAMPING_BY_EXPOSURE.partial;
  } else {
    damping = SHORE_DAMPING_BY_EXPOSURE.exposed;
  }
  return Number((openWaterSeaStateM * damping).toFixed(2));
};

// Δίχτυ #1: ο καθρέφτης συμπίπτει με την αυθεντική σε πλέγμα εισόδων όταν K_d ανενεργό.
{
  kdEnabled = false;
  const heights = [0.1, 0.34, 0.8, 1.2, 2.4, undefined, NaN];
  const exposures = ['protected', 'partial', 'exposed', undefined];
  const arrivals = [undefined, 'protected', 'partial', 'exposed', SEA_ARRIVAL_GRAZING, 'unknown'];
  const curated = [undefined, true, false];
  for (const h of heights) for (const e of exposures) for (const a of arrivals) for (const c of curated) {
    const mine = patchedShoreSeaStateM(h, e, a, c);
    const real = originalShoreSeaStateM(h, e, a, c);
    if (!Object.is(mine, real)) {
      console.error(`ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: ο καθρέφτης αποκλίνει (h=${h}, exp=${e}, arr=${a}, cur=${c}: ${mine} ≠ ${real}).`);
      process.exit(1);
    }
  }
}
waveCharacter.shoreSeaStateM = patchedShoreSeaStateM;

// Δίχτυ #2: με K_d ενεργό και προφίλ βαθιάς σκιάς, το αποτέλεσμα ΠΡΕΠΕΙ να αλλάζει.
{
  kdEnabled = true;
  ctx = { waveDeg: 0, profile: { sectors: { S: { fetchKm: 50 } } } }; // κύμα από Β, μόνος διάδρομος ο Ν → θ=180
  const deep = patchedShoreSeaStateM(1.0, 'protected', undefined);
  ctx = { waveDeg: 180, profile: { sectors: { S: { fetchKm: 50 } } } }; // κύμα ΑΠΟ τον διάδρομο → K_d=1
  const corridor = patchedShoreSeaStateM(1.0, 'protected', undefined);
  kdEnabled = false; ctx = null;
  if (!(deep === KD_FLOOR && corridor === 1)) {
    console.error(`ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: το K_d δεν πέρασε (βαθιά ${deep} ≠ ${KD_FLOOR}, διάδρομος ${corridor} ≠ 1).`);
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
    process.stderr.write(`\r  rate limit: αναμονή ${Math.ceil(waitMs / 1000)}s…      `);
    await sleep(waitMs);
  }
  pointWindow.push({ at: performance.now(), count });
};

const bandOf = (waveM, periodS) => {
  const severity = seaStateSeverityM(waveM, periodS);
  if (typeof severity !== 'number') return 'unknown';
  if (severity >= SEA_STATE_ROUGH_M) return 'φουρτούνα';
  if (severity >= SEA_STATE_AMBER_M) return 'κύμα';
  return 'ήρεμα';
};

const VARIANTS = ['base', 'kd'];

const measureRegion = async (region) => {
  const resolution = resolveBeachMarinePoints(region.beaches, region.profiles, region.regionPoint);
  await paceForPoints(resolution.points.length + 1);

  const [windByPoint, marineByPoint] = await Promise.all([
    fetchForecastDataBatch([region.regionPoint]),
    fetchMarineForecastDataBatch(resolution.points),
  ]);

  const wind = windByPoint.get(marinePointKey(region.regionPoint.lat, region.regionPoint.lon));
  if (!wind) return { regionId: region.regionId, skipped: 'no wind' };
  const anyMarine = [...marineByPoint.values()].some(entry => (entry?.data ?? []).length > 0);
  if (!anyMarine) return { regionId: region.regionId, skipped: 'no marine data' };
  const regionMarine = marineByPoint.get(resolution.regionKey)?.data ?? [];
  const regionDay = processForecastData(mergeMarineForecastData(wind.data, regionMarine))[DAY_INDEX];
  if (!regionDay) return { regionId: region.regionId, skipped: 'no forecast day' };

  const windDirectionDeg = regionDay.wind?.deg;
  const dayByBeachId = new Map();
  for (const beach of region.beaches) {
    const key = resolution.keyByBeachId.get(beach.id);
    const beachMarine = key !== resolution.regionKey ? (marineByPoint.get(key)?.data ?? []) : [];
    dayByBeachId.set(beach.id, beachMarine.length ? applyMarineToDailyForecast(regionDay, beachMarine) : regionDay);
  }

  const scoresByVariant = new Map();
  const top3ByVariant = {};
  for (const variant of VARIANTS) {
    kdEnabled = variant === 'kd';
    const scores = new Map();
    for (const beach of region.beaches) {
      const dayForecast = dayByBeachId.get(beach.id);
      ctx = { profile: region.profiles[beach.id], waveDeg: dayForecast.marine?.waveDirectionDeg };
      scores.set(beach.id, calculateBeachScore(beach, dayForecast, undefined, undefined, {
        weatherSource: 'island-fallback',
        hourlyForecast: dayForecast.hourly,
        geospatialProfile: region.profiles[beach.id],
      }));
    }
    ctx = null;
    const suitable = getSuitableBeaches(
      region.beaches, regionDay, 'gr', undefined, regionDay.hourly, undefined, undefined, region.profiles, scores
    );
    top3ByVariant[variant] = prioritizeProtectedRecommendations(
      suitable, getBeaufortLevel((regionDay.wind?.speed ?? 0) * 3.6)
    ).slice(0, 3).map(item => item.beach.id);
    scoresByVariant.set(variant, scores);
  }
  kdEnabled = false;

  const rows = [];
  for (const beach of region.beaches) {
    const profile = region.profiles[beach.id];
    const dayForecast = dayByBeachId.get(beach.id);
    const waveDeg = dayForecast.marine?.waveDirectionDeg;
    const row = { beachId: beach.id, name: beach.name?.gr ?? null, byVariant: {} };
    let hasNumber = false;

    for (const variant of VARIANTS) {
      kdEnabled = variant === 'kd';
      ctx = { profile, waveDeg };
      const score = scoresByVariant.get(variant).get(beach.id);
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
      const beaufort = getBeaufortLevel(score.windSpeedKmph ?? (regionDay.wind?.speed ?? 0) * 3.6);
      const tone = resolveConditionTone({
        exposureLevel: score.exposureLevel,
        beaufort,
        isEnclosedCove: Boolean(score.enclosedCove),
        seaStateM: seaStateSeverityM(score.seaStateWaveM, score.seaStatePeriodS),
        offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg, beaufort, swellWaveHeightM: score.marine?.swellWaveHeightM }),
        downwindSeaSample: hasDownwindSeaSample({
          profile, windDirectionDeg, swellWaveHeightM: score.marine?.swellWaveHeightM,
        }),
        seaArrivalExposureLevel: score.seaArrivalExposureLevel,
        shoreShadowDamping: score.shoreShadowDamping,
        swimVerdictAvoid: score.swimmingComfort === 'avoid_swimming',
      });
      row.byVariant[variant] = {
        shoreM: typeof score.shoreDisplayWaveM === 'number' ? Number(score.shoreDisplayWaveM.toFixed(2)) : null,
        printedM,
        band: printedM === null ? 'unknown' : bandOf(printedM, score.seaStatePeriodS),
        comfort: score.swimmingComfort ?? null,
        tone,
      };
      if (variant === 'base') {
        row.exposureLevel = score.exposureLevel ?? null;
        row.departing = Boolean(score.shoreWaveFromDepartingSea);
        row.openM = typeof score.seaStateWaveM === 'number' ? Number(score.seaStateWaveM.toFixed(2)) : null;
        row.periodS = typeof score.seaStatePeriodS === 'number' ? Number(score.seaStatePeriodS.toFixed(1)) : null;
      }
      if (printedM !== null) hasNumber = true;
    }
    kdEnabled = false; ctx = null;

    const shadow = row.exposureLevel === 'protected' ? shadowOf(profile, waveDeg) : null;
    if (shadow) { row.thetaDeg = Math.round(shadow.thetaDeg); row.kd = shadow.kd; row.bucket = shadow.bucket; }
    if (typeof waveDeg !== 'number') row.noWaveDir = true;
    if (hasNumber) rows.push(row);
  }

  return {
    regionId: region.regionId,
    windKmh: Number(((regionDay.wind?.speed ?? 0) * 3.6).toFixed(1)),
    rows,
    top3ByVariant,
  };
};

const regionComplete = (result) => Boolean(result) && !result.skipped && (result.rows ?? []).length > 0;

const codeStamp = [
  'services/recommendationService.ts',
  'utils/waveCharacter.ts',
  'utils/suitabilityTone.ts',
  'utils/beachConditionsReadout.ts',
  'scripts/measureShoreShadowPhysics.mjs',
].map(file => readFileSync(path.join(root, file), 'utf8').length).join('-')
  + '@' + new Date().toISOString().slice(0, 10)
  + '@replay:' + (process.env.OPEN_METEO_REPLAY || 'live');

let cache = {};
try {
  const loaded = JSON.parse(readFileSync(cachePath, 'utf8'));
  if (loaded.codeStamp === codeStamp) cache = loaded.regions ?? {};
  else console.log('  Η μνήμη πετάχτηκε: άλλαξε ο κώδικας, η μέρα, ή το replay.');
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
// ΑΝΑΛΥΣΗ
// ─────────────────────────────────────────────────────────────────────────────
const COMFORT_ORDER = ['avoid_swimming', 'caution', 'good', 'excellent'];
const TONE_ORDER = ['red', 'orange', 'yellow', 'blue'];
const rankIn = (order, value) => { const i = order.indexOf(value); return i === -1 ? null : i; };

const s = {
  beaches: 0, protectedBeaches: 0, noWaveDir: 0,
  kdValues: [], buckets: {}, corridorExamples: [], deepExamples: [],
  printedRougher: 0, printedCalmer: 0, rougherDeltas: [], calmerDeltas: [],
  bandMoves: {}, intoCalm: 0,
  comfortStricter: 0, comfortSofter: 0, comfortMoves: {}, stricterExamples: [],
  toneStricter: 0, toneSofter: 0, toneMoves: {},
  podiumChanged: 0, podiumOrderOnly: 0,
};

for (const result of results) {
  for (const row of result.rows) {
    s.beaches += 1;
    if (row.exposureLevel === 'protected') s.protectedBeaches += 1;
    if (row.noWaveDir) s.noWaveDir += 1;
    if (row.kd !== undefined) {
      s.kdValues.push(row.kd);
      s.buckets[row.bucket] = (s.buckets[row.bucket] ?? 0) + 1;
    }
    const base = row.byVariant.base, kd = row.byVariant.kd;
    if (base.printedM === null || kd.printedM === null) continue;
    const delta = Number((kd.printedM - base.printedM).toFixed(2));
    if (delta > 0.005) {
      s.printedRougher += 1; s.rougherDeltas.push(delta);
      if (row.bucket === 'διάδρομος' && s.corridorExamples.length < 12) {
        s.corridorExamples.push({ region: result.regionId, name: row.name, theta: row.thetaDeg, beforeM: base.printedM, afterM: kd.printedM, comfort: kd.comfort });
      }
    } else if (delta < -0.005) {
      s.printedCalmer += 1; s.calmerDeltas.push(-delta);
      if (s.deepExamples.length < 12) {
        s.deepExamples.push({ region: result.regionId, name: row.name, theta: row.thetaDeg, kd: row.kd, beforeM: base.printedM, afterM: kd.printedM });
      }
    }
    if (base.band !== kd.band) {
      const move = `${base.band} → ${kd.band}`;
      s.bandMoves[move] = (s.bandMoves[move] ?? 0) + 1;
      if (kd.band === 'ήρεμα') s.intoCalm += 1;
    }
    const cb = rankIn(COMFORT_ORDER, base.comfort), ca = rankIn(COMFORT_ORDER, kd.comfort);
    if (cb !== null && ca !== null && cb !== ca) {
      const move = `${base.comfort} → ${kd.comfort}`;
      s.comfortMoves[move] = (s.comfortMoves[move] ?? 0) + 1;
      if (ca < cb) {
        s.comfortStricter += 1;
        if (s.stricterExamples.length < 12) s.stricterExamples.push({ region: result.regionId, name: row.name, move, bucket: row.bucket });
      } else s.comfortSofter += 1;
    }
    const tb = rankIn(TONE_ORDER, base.tone), ta = rankIn(TONE_ORDER, kd.tone);
    if (tb !== null && ta !== null && tb !== ta) {
      const move = `${base.tone} → ${kd.tone}`;
      s.toneMoves[move] = (s.toneMoves[move] ?? 0) + 1;
      if (ta < tb) s.toneStricter += 1; else s.toneSofter += 1;
    }
  }
  const before = result.top3ByVariant.base ?? [], after = result.top3ByVariant.kd ?? [];
  if (before.join(',') !== after.join(',')) {
    s.podiumChanged += 1;
    if (before.length === after.length && before.every(id => after.includes(id))) s.podiumOrderOnly += 1;
  }
}

console.log(`\nΠεριοχές: ${results.length}/${regions.length} (${pct(results.length, regions.length)}) · παραλίες με νούμερο: ${s.beaches} (προστατευμένες: ${s.protectedBeaches} · χωρίς κατεύθυνση κύματος: ${s.noWaveDir}).`);

console.log('\n── Η ΚΑΤΑΝΟΜΗ ΤΟΥ K_d ΣΤΙΣ ΠΡΟΣΤΑΤΕΥΜΕΝΕΣ (σήμερα όλες ×0,5) ─────────');
console.log(`  διάμεσο K_d ${percentile(s.kdValues, 0.5).toFixed(2)} · p10 ${percentile(s.kdValues, 0.1).toFixed(2)} · p90 ${percentile(s.kdValues, 0.9).toFixed(2)}`);
for (const [bucket, count] of Object.entries(s.buckets).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${bucket}: ${count} (${pct(count, s.kdValues.length)})`);
}

console.log('\n── ΤΙ ΘΑ ΑΛΛΑΖΕ ΣΤΗΝ ΟΘΟΝΗ (μετά τους φράχτες) ───────────────────────');
console.log(`  ΠΙΟ ΑΓΡΙΟ (η φυσική αρνείται την έκπτωση): ${s.printedRougher} παραλίες · διάμεση άνοδος ${percentile(s.rougherDeltas, 0.5).toFixed(2)} μ. · max ${(s.rougherDeltas.length ? Math.max(...s.rougherDeltas) : 0).toFixed(2)} μ.`);
console.log(`  πιο ήρεμο (βαθύτερη σκιά από 0,5): ${s.printedCalmer} · διάμεση πτώση ${percentile(s.calmerDeltas, 0.5).toFixed(2)} μ.`);
const bm = Object.entries(s.bandMoves).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
console.log(`  ζώνες: ${bm || 'καμία'} · ➜ σε «ήρεμα»: ${s.intoCalm}`);
const cm = Object.entries(s.comfortMoves).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
console.log(`  ετυμηγορία: αυστηρότερη ${s.comfortStricter} · επιεικέστερη ${s.comfortSofter}${cm ? ` (${cm})` : ''}`);
const tm = Object.entries(s.toneMoves).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(' · ');
console.log(`  πινέζα: αυστηρότερη ${s.toneStricter} · ηπιότερη ${s.toneSofter}${tm ? ` (${tm})` : ''}`);
console.log(`  podium: αλλάζει σε ${s.podiumChanged}/${results.length} περιοχές (μόνο σειρά: ${s.podiumOrderOnly})`);

if (s.corridorExamples.length) {
  console.log('\n── (α) «ΔΙΑΔΡΟΜΟΣ» — παίρνουν ×0,5 ενώ το κύμα μπαίνει από ανοιχτά ────');
  for (const e of s.corridorExamples.slice(0, 8)) {
    console.log(`  ${e.name} (${e.region}): θ=${e.theta}° · ${e.beforeM} → ${e.afterM} μ. · ετυμηγορία ${e.comfort}`);
  }
}
if (s.deepExamples.length) {
  console.log('\n── (β) «ΒΑΘΙΑ ΣΚΙΑ» — η φυσική λέει λιγότερο από το μισό (θέλει απόφαση) ─');
  for (const e of s.deepExamples.slice(0, 8)) {
    console.log(`  ${e.name} (${e.region}): θ=${e.theta}° · K_d=${e.kd} · ${e.beforeM} → ${e.afterM} μ.`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'shore-shadow-physics.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  replayWindow: process.env.OPEN_METEO_REPLAY || null,
  params: { OPEN_FETCH_KM, CORRIDOR_HALF_DEG, DECAY_DEG, KD_AT_EDGE, KD_FLOOR },
  regionsAnswered: results.length,
  regionsAsked: regions.length,
  summary: { ...s, kdValues: undefined, rougherDeltas: undefined, calmerDeltas: undefined,
    kdMedian: Number(percentile(s.kdValues, 0.5).toFixed(2)),
    kdP10: Number(percentile(s.kdValues, 0.1).toFixed(2)),
    kdP90: Number(percentile(s.kdValues, 0.9).toFixed(2)),
    rougherMedianM: Number(percentile(s.rougherDeltas, 0.5).toFixed(2)),
    rougherMaxM: s.rougherDeltas.length ? Number(Math.max(...s.rougherDeltas).toFixed(2)) : null,
    calmerMedianM: Number(percentile(s.calmerDeltas, 0.5).toFixed(2)),
  },
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);

if (coverage < 0.9 && !regionFilter) {
  console.error(`\nΑΠΕΤΥΧΕ — απάντησε μόνο το ${pct(results.length, regions.length)} των περιοχών.`);
  process.exit(1);
}
