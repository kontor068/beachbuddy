#!/usr/bin/env node
/**
 * ΜΩΛΟΣ ΠΑΡΟΥ #2040 — ΟΙ ΜΕΡΕΣ ΤΟΥ ΔΟΡΥΦΟΡΟΥ, ΞΑΝΑΠΑΙΓΜΕΝΕΣ ΜΕ ΤΗΝ ΠΡΟΓΝΩΣΗ ΠΟΥ ΔΙΑΒΑΖΕΙ ΤΟ ΙΔΙΟ ΤΟ SITE
 * (11/09/2026, βίβλος §Γ77). ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ: καμία γραμμή παραγωγής δεν αγγίζεται.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο Sentinel-2 είδε αφρό θραύσης στην άμμο του Μώλου στις 04/10/2022 και 18/10/2024, εκεί
 * που η σελίδα τύπωνε ~0,1 μ. «Θάλασσα λάδι». Οι κατευθύνσεις εκείνων των ημερών (16° και 18°) είναι του
 * COPERNICUS — της πηγής κύματος του κριτή — όχι αυτές που διαβάζει το site (Open-Meteo marine, `ewam`, στο
 * marineSamplePoint της παραλίας). Η διόρθωση που είναι στο δέντρο (utils/seaArrival.ts
 * JUDGE_WITNESSED_ARRIVAL_ARCS: 2040 → 0-30°) κρίνεται στην κατεύθυνση ΤΟΥ SITE. Στο Καλό Λιμάνι το site
 * διάβαζε 6-15° πιο δεξιόστροφα από το Copernicus. Άρα: στο πλαίσιο του site, πέφτουν οι μέρες του
 * δορυφόρου μέσα στο 0-30°; Και αλλάζει η διόρθωση ό,τι θα τύπωνε το site εκείνες τις μέρες;
 *
 * ΠΩΣ.
 *  • Μέρες: ΟΛΕΣ οι μέρες του Μώλου στο .tmp/s2judge/national-days-v2.json (οι 22 με Copernicus 0-45° και
 *    Hs ≥ 0,5 μ. + οι 12 ήρεμες), συν όσες 0-45°/≥0,5 μ. έχει ΜΟΝΟ το νεότερο national-days.json (`extra`).
 *  • Κάθε μέρα σε δική της διεργασία (ο διακόπτης του αρχείου διαβάζει το OPEN_METEO_REPLAY στο import):
 *    scripts/lib/replayOpenMeteo.mjs με SHIFT=1 και ΔΩΡΕΑΝ host (το κλειδί μας παίρνει 403 στο
 *    historical-forecast, 11/09), και ο ΙΔΙΟΣ δρόμος με την εφαρμογή:
 *      1. πρόγνωση περιοχής στο island.coordinates + θάλασσα περιοχής (hooks/useWeather loadWeatherData)
 *         → utils/weatherUtils.processForecastData(mergeMarineForecastData(...))[0]·
 *      2. η ΔΙΚΗ του θάλασσα: utils/marineSamplePoints.resolveBeachMarinePoints → fetchMarineForecastDataBatch
 *         → applyMarineToDailyForecast (App.tsx beachMarineDayById)·
 *      3. ο ΔΙΚΟΣ του άνεμος: utils/beachForecastClusters → fetchForecastDataBatch στο κέντρο της ομάδας →
 *         processForecastData → applyOverWaterWindToDays (hooks/useWeather fetchBeachForecastContexts· ο
 *         Μώλος δεν έχει seaWindCell, άρα το στρώμα πάνω από νερό δεν τον αγγίζει — ελέγχεται)·
 *      4. ώρα: αντίγραφο του App.tsx adjustDailyForecastToHour (ιδιωτικό στο App) στα δύο, και
 *         applyBeachWindToDailyForecast(θάλασσα-της-ώρας, άνεμος-της-ώρας) (App.tsx withBeachOwnWind)·
 *      5. calculateBeachScore όπως το App.tsx beachScoreById → αριθμός/λέξη της κάρτας
 *         (utils/beachConditionsReadout), ετυμηγορία, πινέζα (resolveConditionTone με τα ορίσματα του
 *         components/BeachMap.tsx, όπως στο scripts/measureMolosArrivalArc.mjs), τσιπ.
 *  • ΠΡΙΝ/ΜΕΤΑ/ΜΕΤΑ-ξανά στην ίδια διεργασία, από τον ίδιο κώδικα: ΜΕΤΑ = όπως είναι, ΠΡΙΝ =
 *    JUDGE_WITNESSED_ARRIVAL_ARCS.delete(2040) — σβήνει ΚΑΙ το πάτωμα K_d ΚΑΙ τον σύνδεσμο
 *    isWitnessedArrivalSea (εκτίμηση ακτής + φρουρός όρμου) — και επαναφορά αμέσως μετά (και σε σφάλμα).
 *  • Ώρες 09-15 τοπική. «Ώρα δορυφόρου» = 12:00 θερινή / 11:00 χειμερινή (λήψη ≈ 09:10-09:30 UTC).
 *  • Μνήμη HTTP στο .tmp/molos-replay/http: η ΩΜΗ απάντηση του αρχείου, ΚΑΤΩ από το SHIFT, ώστε ένα
 *    ξανατρέξιμο με νέο κώδικα να μην ξαναχτυπάει το Open-Meteo. `--refresh` = ξαναφέρ' τα.
 *  • Κάθε παιδί γράφει το αποτύπωμα (sha1) κάθε αρχείου κώδικα που φόρτωσε. Άλλες συνεδρίες γράφουν στο
 *    ίδιο δέντρο· αν κάποιος άλλαξε κώδικα στη μέση του τρεξίματος, η αναφορά το λέει (codeFingerprints).
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν λέει αν το 0,5 είναι ΣΩΣΤΟ ύψος. Ο δορυφόρος βλέπει «λωρίδα αφρού ή όχι», όχι μέτρα.
 *  - Το αρχείο προγνώσεων είναι οι πρώτες ώρες κάθε τρεξίματος, όχι η πρόγνωση 1-3 ημερών που είδε ο
 *    επισκέπτης εκείνη τη μέρα· και τρέχει τον ΣΗΜΕΡΙΝΟ κώδικα με τα ΣΗΜΕΡΙΝΑ προφίλ.
 *  - Το SHIFT βάζει την παλιά μέρα «σήμερα» με το αληθινό ρολόι: ό,τι στο score κοιτάει «πόσες ώρες
 *    μένουν σήμερα» κοιτάει το ρολόι της ώρας που τρέχει το script, όχι της μέρας εκείνης.
 *  - Θάλασσα και άνεμος ζητούνται μόνο για το σημείο/την ομάδα του Μώλου· η εφαρμογή τα ζητά μαζί με τις
 *    άλλες παραλίες σε ένα αίτημα (οι τιμές ανά σημείο δεν εξαρτώνται από τη σύνθεση του αιτήματος).
 *  - Η πινέζα βγαίνει ΧΩΡΙΣ το ταίριασμα γειτόνων του χάρτη (δεν βαθμολογούνται οι άλλες 38 παραλίες).
 *  - Το βάθρο δεν μετριέται εδώ (scripts/measureMolosArrivalArc.mjs: 0 αλλαγές σε 1.440 σενάρια).
 *  - Η σελίδα παραλίας (pages/BeachDetailPage.tsx) δεν ξαναχτίζεται· μετριέται η διαδρομή της κάρτας.
 *  - Ο δορυφόρος είναι ΜΙΑ λήψη τη μέρα· οι ώρες 09-15 δείχνουν τι θα έλεγε το site, όχι τι έγινε.
 *  - Ο αφρός στις 5 μέρες «refused» (07/10/22, 21/12/22, 18/03/23, 09/12/25, 23/02/26) δεν πέρασε έλεγχο SWIR
 *    (το verifyShoreFoamSwir.py ελέγχει μόνο τις «closed»)· το 30/06/25 ο SWIR τον απέρριψε (φωτεινό, όχι αφρός).
 *
 * ΜΕΤΡΗΘΗΚΕ 11/09/2026 (44 μέρες × 7 ώρες, reports/wave-model/molos-witness-days-replay.json):
 *  - Το site διαβάζει τη θάλασσα του Μώλου 5-13° ΑΡΙΣΤΕΡΟΣΤΡΟΦΑ από το Copernicus (διάμεσος −8°, 32 μέρες) —
 *    ανάποδο πρόσημο από το Καλό Λιμάνι. Με βοριά 201/211 ώρες (Hs ≥ 0,5) πέφτουν στις 355-9°, 10 στις 10-19°.
 *  - Οι δύο μαρτυρημένες μέρες είναι ΜΕΣΑ στο 0-30° (3° και 8-10°) αλλά ΟΧΙ στην «τρύπα» 11-25°. Με τη δική
 *    του πρόγνωση το site ΔΕΝ έλεγε «λάδι»: 04/10/22 0,9 μ. «Αρκετό κύμα», 18/10/24 1,6 μ. «Μεγάλο κύμα», και
 *    τις δύο «μην κολυμπήσεις», κόκκινη πινέζα. Σε καμία από τις 7 μέρες αφρού, σε καμία ώρα 09-15, δεν
 *    τύπωνε ήρεμο — ούτε πριν ούτε μετά τη διόρθωση.
 *  - Η διόρθωση άλλαξε αριθμό/λέξη σε 116/308 ώρες: 106 μέσω του συνδέσμου isWitnessedArrivalSea στις 0-10°
 *    (από ~0,59 του ανοιχτού σε ~1,00 — ΟΛΟ το ύψος, όχι το μισό), 10 μέσω του πατώματος K_d στην τρύπα.
 *    0 ετυμηγορίες, 0 πινέζες, 0 αλλαγές έξω από το τόξο.
 *  - Μέρες λίγου αφρού: η λέξη ανέβηκε σε 4/19 στην ώρα λήψης (π.χ. 30/06/24: 0,9 «Αρκετό» → 1,7 «Μεγάλο»).
 *  - Η άκρη 0° του τόξου κάθεται πάνω στη συνηθισμένη κατεύθυνση του site (111 ώρες σε ±3°): η λέξη
 *    αναβοσβήνει μέσα στην ίδια μέρα (19/09/23: 1,1 «Αρκετό» → 1,9 «Μεγάλο» → 1,1 με 1° διαφορά).
 *
 *   node scripts/replayMolosWitnessDays.mjs           (~8 αιτήματα Open-Meteo/μέρα την πρώτη φορά)
 *   node scripts/replayMolosWitnessDays.mjs --refresh  (αγνοεί τη μνήμη HTTP)
 *   → reports/wave-model/molos-witness-days-replay.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPLAY_CHILD = process.argv.includes('--replay-child');
const REFRESH = process.argv.includes('--refresh') || process.env.MOLOS_REPLAY_REFRESH === '1';
const HTTP_CACHE = path.join(root, '.tmp/molos-replay/http');
const REGION = 'south-aegean-paros';
const MOLOS = 2040;
const HOURS = [9, 10, 11, 12, 13, 14, 15];
const sha1 = (s) => createHash('sha1').update(s).digest('hex');
const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
/** Υπογεγραμμένη διαφορά a−b στο −180..180 (θετικό = το a πιο δεξιόστροφα). */
const signedDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;

// ══ ΠΑΙΔΙ: μία μέρα, ΠΡΙΝ/ΜΕΤΑ/ΜΕΤΑ-ξανά ════════════════════════════════════════════════════════
if (REPLAY_CHILD) {
  // Η μνήμη HTTP μπαίνει ΠΡΙΝ από το replay, ώστε το replay να την κρατήσει ως «native fetch»: φυλάγεται
  // η ΩΜΗ απάντηση του αρχείου (κλειδί = το URL του αρχείου, με start/end_date) και το SHIFT εφαρμόζεται
  // από πάνω κάθε φορά με το σημερινό ρολόι. Η κεφαλίδα Date είναι το ΤΩΡΑ (utils/athensTime τη διαβάζει).
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url;
    if (typeof url !== 'string' || !url.includes('open-meteo.com')) return nativeFetch(input, init);
    const file = path.join(HTTP_CACHE, `${sha1(url)}.json`);
    if (!REFRESH && existsSync(file)) {
      const cached = JSON.parse(readFileSync(file, 'utf8'));
      return new Response(cached.body, { status: 200, headers: { 'content-type': 'application/json', date: new Date().toUTCString() } });
    }
    const res = await nativeFetch(input, init);
    if (res.ok) {
      const body = await res.clone().text();
      mkdirSync(HTTP_CACHE, { recursive: true });
      writeFileSync(file, JSON.stringify({ url, fetchedAt: new Date().toISOString(), body }));
    }
    return res;
  };
  await import('./lib/replayOpenMeteo.mjs');
}

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
const codeFingerprint = new Map();
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  const src = readFileSync(filename, 'utf8');
  codeFingerprint.set(path.relative(root, filename).split(path.sep).join('/'), sha1(src).slice(0, 12));
  module._compile(ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const regionJson = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${REGION}.json`), 'utf8')).island;
const beaches = regionJson.beaches;
const profilesById = {};
for (const p of Object.values(JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/exposure', `${REGION}.json`), 'utf8')).profiles ?? {})) {
  if (p?.beachId != null) profilesById[p.beachId] = p;
}
const beach = beaches.find((b) => b.id === MOLOS);
const profile = profilesById[MOLOS];

if (REPLAY_CHILD) {
  const out = { day: process.env.OPEN_METEO_REPLAY, ok: false, hours: [] };
  // Η ΙΔΙΑ εγγραφή του require-cache που φορτώνει και το scoring — αλλιώς το .delete() θα άγγιζε δεύτερο
  // αντίγραφο του Map και το ΠΡΙΝ θα έβγαινε σιωπηλά ίδιο με το ΜΕΤΑ (έλεγχος: K_d ΠΡΙΝ == γεωμετρία).
  const SA = require(path.join(root, 'utils/seaArrival.ts'));
  const ARC = SA.JUDGE_WITNESSED_ARRIVAL_ARCS.get(MOLOS);
  const useVariant = (variant) => {
    if (variant === 'after') SA.JUDGE_WITNESSED_ARRIVAL_ARCS.set(MOLOS, ARC);
    else SA.JUDGE_WITNESSED_ARRIVAL_ARCS.delete(MOLOS);
  };
  try {
    if (!ARC) throw new Error('Το τόξο του #2040 δεν υπάρχει στο utils/seaArrival.ts');
    const W = require(path.join(root, 'services/weatherService.ts'));
    const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
    const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
    const { waveFeelLevelWithArrival } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
    const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
    const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
    const { holdsFlatWaterUnderOffshoreWind, holdsGlassWaterAtFourBeaufort, hasDownwindSeaSample } =
      require(path.join(root, 'utils/offshoreFlatWater.ts'));
    const { getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
    const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
    const { getBeaufortLevel, degToCompass, processForecastData, applyMarineToDailyForecast, applyBeachWindToDailyForecast } =
      require(path.join(root, 'utils/weatherUtils.ts'));
    const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
    const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));
    const { applyOverWaterWindToDays } = require(path.join(root, 'utils/overWaterWind.ts'));

    // ── 1. Η μέρα της περιοχής (hooks/useWeather loadWeatherData· Πάρος: χωρίς MARINE_POINT_OVERRIDES) ──
    const regionPoint = { lat: regionJson.coordinates.lat, lon: regionJson.coordinates.lon };
    const [regionFc, regionMarine] = await Promise.all([
      W.fetchForecastData(regionPoint.lat, regionPoint.lon),
      W.fetchMarineForecastData(regionPoint.lat, regionPoint.lon).then((r) => r.data).catch(() => []),
    ]);
    const baseDaily = processForecastData(W.mergeMarineForecastData(regionFc.data, regionMarine))?.[0];
    if (!baseDaily?.hourly?.length) throw new Error('καμία μέρα περιοχής από το αρχείο');

    // ── 2. Η δική του θάλασσα (useWeather loadBeachMarine → App beachMarineDayById) ──
    const resolution = resolveBeachMarinePoints(beaches, profilesById, regionPoint);
    const ownKey = resolution.keyByBeachId.get(MOLOS);
    const ownPoint = resolution.points.find((p) => marinePointKey(p.lat, p.lon) === ownKey);
    if (!ownPoint || ownKey === resolution.regionKey) throw new Error('ο Μώλος δεν έχει δικό του σημείο θάλασσας');
    const ownBy = await W.fetchMarineForecastDataBatch([ownPoint], { persist: false });
    const ownItems = ownBy.get(ownKey)?.data ?? ownBy.get(W.forecastPointKey(ownPoint.lat, ownPoint.lon))?.data ?? [];
    const beachMarineDay = applyMarineToDailyForecast(baseDaily, ownItems);

    // ── 3. Ο δικός του άνεμος (useWeather fetchBeachForecastContexts) ──
    const cluster = buildBeachForecastClusters(beaches).find((c) => c.beachIds.includes(MOLOS));
    const windBy = await W.fetchForecastDataBatch([{ lat: cluster.lat, lon: cluster.lon }]);
    const windData = windBy.get(W.forecastPointKey(cluster.lat, cluster.lon))?.data;
    if (!windData?.length) throw new Error('κανένας άνεμος ομάδας από το αρχείο');
    // Η θάλασσα της ομάδας ΔΕΝ ζητιέται: η applyBeachWindToDailyForecast παίρνει από εκεί ΜΟΝΟ άνεμο.
    const clusterDays = processForecastData(W.mergeMarineForecastData(windData, []));
    // Χωρίς seaWindCell η εφαρμογή δίνει undefined εδώ (useWeather: overWaterByCell.get('')) → ίδιος πίνακας.
    if (beach.seaWindCell) throw new Error('ο Μώλος απέκτησε seaWindCell — το script πρέπει να φέρνει και το στρώμα πάνω από νερό');
    const overWater = applyOverWaterWindToDays(clusterDays, undefined);
    const clusterDay = overWater?.[0];
    out.wiring = {
      regionPoint, ownMarinePoint: ownPoint, ownMarineKey: ownKey, ownMarineHours: ownItems.length,
      cluster: { key: cluster.key, lat: cluster.lat, lon: cluster.lon, beachIds: cluster.beachIds },
      seaWindCell: beach.seaWindCell ?? null, overWaterIdentity: overWater === clusterDays,
      regionDate: baseDaily.date ?? null, clusterDate: clusterDay?.date ?? null,
    };

    // ── 4. Η ώρα: αντίγραφο του App.tsx getSelectedHourMarine / adjustDailyForecastToHour ──
    const getSelectedHourMarine = (hourMarine, dailyMarine) => {
      if (hourMarine) {
        return { ...hourMarine, seaSurfaceTemperatureC: hourMarine.seaSurfaceTemperatureC ?? dailyMarine?.seaSurfaceTemperatureC, source: hourMarine.source ?? dailyMarine?.source };
      }
      if (typeof dailyMarine?.seaSurfaceTemperatureC === 'number' && Number.isFinite(dailyMarine.seaSurfaceTemperatureC)) {
        return { seaSurfaceTemperatureC: dailyMarine.seaSurfaceTemperatureC, source: dailyMarine.source };
      }
      return undefined;
    };
    // Στο App, όταν η ώρα δεν υπάρχει ακριβώς, γίνεται παρεμβολή· εδώ οι ώρες είναι ωριαίες (ελέγχεται: hourFound).
    const adjustDailyForecastToHour = (daily, dt) => {
      const hourItem = daily.hourly?.find((i) => i.dt === dt);
      if (!hourItem) return null;
      return {
        ...daily,
        wind: hourItem.wind,
        marine: getSelectedHourMarine(hourItem.marine, daily.marine),
        weather: hourItem.weather?.[0] ?? daily.weather,
        temp_max: Number.isFinite(hourItem.main?.temp) ? hourItem.main.temp : daily.temp_max,
      };
    };

    // ── 5. Ό,τι βλέπει ο επισκέπτης (ίδια σύνθεση με scripts/measureMolosArrivalArc.mjs) ──
    const scoreOf = (day) => calculateBeachScore(beach, day, undefined, undefined, {
      weatherSource: 'island-fallback', hourlyForecast: day.hourly, geospatialProfile: profile,
    });
    const appMapItem = (day, s) => {
      const windKmh = day.wind.speed * 3.6;
      const a = assessBeachWindExposure({
        beach, geospatialProfile: profile, windDirectionDeg: day.wind.deg, windDirection: degToCompass(day.wind.deg),
        windSpeedKmh: windKmh, beaufort: getBeaufortLevel(windKmh), waveHeightMeters: day.marine?.waveHeightM,
      });
      return {
        beachId: beach.id, score: s.score, beach, exposureLevel: a.exposureLevel,
        windSpeedKmph: s.windSpeedKmph, waveHeightM: s.waveHeightM, seaStateWaveM: s.seaStateWaveM,
        shoreWaveHeightM: s.shoreWaveHeightM, shoreDisplayWaveM: s.shoreDisplayWaveM,
        shoreWaveFromDepartingSea: s.shoreWaveFromDepartingSea, seaArrivalExposureLevel: s.seaArrivalExposureLevel,
        seaStatePeriodS: s.seaStatePeriodS, marine: s.marine, swimmingComfort: s.swimmingComfort,
        enclosedCove: s.enclosedCove, simpleWindSuitability: s.simpleWindSuitability, geospatialExposure: profile,
      };
    };
    /** components/BeachMap.tsx beachToneInput· `kd` = από πού διαβάζεται το K_d (αντικείμενο App = χωρίς). */
    const pinTone = (item, ctx, kd) => {
      const exposureLevel = getVisibleMapExposureLevel(item, ctx.beaufort, ctx.deg);
      const seaStateM = seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS);
      const swellWaveHeightM = item.marine?.swellWaveHeightM;
      return resolveConditionTone({
        exposureLevel, beaufort: ctx.beaufort, isEnclosedCove: Boolean(item.enclosedCove), seaStateM,
        offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, swellWaveHeightM }),
        glassWaterAtFour: holdsGlassWaterAtFourBeaufort({
          profile, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, seaStateM, exposureLevel,
          seaArrivalExposureLevel: item.seaArrivalExposureLevel, shoreShadowDamping: kd.shoreShadowDamping, swellWaveHeightM,
        }),
        downwindSeaSample: hasDownwindSeaSample({ profile, windDirectionDeg: ctx.deg, swellWaveHeightM }),
        seaArrivalExposureLevel: item.seaArrivalExposureLevel, shoreShadowDamping: kd.shoreShadowDamping,
        swimVerdictAvoid: item.swimmingComfort === 'avoid_swimming', windSpeedKmh: ctx.windKmh, forecastUncertain: kd.forecastUncertain,
      });
    };
    const view = (day, s) => {
      const windKmh = day.wind.speed * 3.6;
      const ctx = { windKmh, deg: day.wind.deg, beaufort: getBeaufortLevel(windKmh) };
      const item = appMapItem(day, s);
      const r = buildBeachConditionsReadout({
        beachWindSpeedKmph: s.windSpeedKmph, regionWindSpeedMs: day.wind.speed, waveHeightM: s.waveHeightM,
        seaStateWaveM: s.seaStateWaveM, seaStatePeriodS: s.seaStatePeriodS, shoreWaveHeightM: s.shoreWaveHeightM,
        shoreDisplayWaveM: s.shoreDisplayWaveM, shoreWaveFromDepartingSea: s.shoreWaveFromDepartingSea,
        seaArrivalExposureLevel: s.seaArrivalExposureLevel, language: 'gr',
      });
      const hasWave = typeof r.waveM === 'number' && Number.isFinite(r.waveM);
      return {
        printed: hasWave ? Number(r.waveM.toFixed(1)) : null,
        printedRawM: hasWave ? Number(r.waveM.toFixed(3)) : null,
        waveWord: r.waveWord ?? null,
        waveText: r.waveText ?? null,
        waveLevel: hasWave ? waveFeelLevelWithArrival(Math.max(0, r.waveM), s.seaArrivalExposureLevel) : null,
        verdict: s.swimmingComfort ?? null,
        pin: pinTone(item, ctx, item),
        pinWired: pinTone(item, ctx, s),
        chip: s.simpleWindSuitability?.suitabilityColor ?? null,
        score: s.finalSuitabilityScore ?? null,
        openWaveM: s.waveHeightM ?? null,
        shoreDisplayWaveM: s.shoreDisplayWaveM ?? null,
        kd: s.shoreShadowDamping ?? null,
        seaArrival: s.seaArrivalExposureLevel ?? null,
        seaStateSource: s.seaStateSource ?? null,
        exposureLevel: s.exposureLevel ?? null,
        departingSea: s.shoreWaveFromDepartingSea ?? null,
        warnings: (s.warnings ?? []).map((w) => w.type).sort().join(','),
      };
    };

    const localHour = (item) => Number(String(item.dt_txt).slice(11, 13));
    for (const hour of HOURS) {
      const item = beachMarineDay.hourly.find((x) => localHour(x) === hour);
      if (!item) { out.hours.push({ hour, missing: true }); continue; }
      const area = adjustDailyForecastToHour(beachMarineDay, item.dt);
      const windSrc = adjustDailyForecastToHour(clusterDay, item.dt);
      if (!windSrc) { out.hours.push({ hour, missing: 'cluster-hour' }); continue; }
      const final = applyBeachWindToDailyForecast(area, windSrc);
      const m = final.marine ?? {};
      const comps = [
        { heightM: m.waveHeightM, directionDeg: m.waveDirectionDeg },
        { heightM: m.swellWaveHeightM, directionDeg: m.swellWaveDirectionDeg },
      ];
      let A; let B; let A2;
      try {
        useVariant('after');
        const sa = scoreOf(final); A = view(final, sa);
        useVariant('before');
        const sb = scoreOf(final); B = view(final, sb);
        useVariant('after');
        const sa2 = scoreOf(final); A2 = view(final, sa2);
        A.__raw = JSON.stringify(sa); A2.__raw = JSON.stringify(sa2);
      } finally { useVariant('after'); }
      const sameAgain = A.__raw === A2.__raw && JSON.stringify({ ...A, __raw: 0 }) === JSON.stringify({ ...A2, __raw: 0 });
      delete A.__raw; delete A2.__raw;
      const geomKd = SA.resolveShoreShadowDamping({ ...profile, beachId: -1 }, m.waveDirectionDeg);
      const waveInArc = SA.isJudgeWitnessedArrivalDirection(profile, m.waveDirectionDeg);
      const expectedAfterKd = typeof geomKd === 'number' && waveInArc ? Math.max(geomKd, SA.SHADOW_KD_AT_EDGE) : geomKd;
      out.hours.push({
        hour, dt_txt: item.dt_txt,
        sea: {
          hs: m.waveHeightM ?? null, dir: m.waveDirectionDeg ?? null, tp: m.wavePeriodS ?? null,
          swellHs: m.swellWaveHeightM ?? null, swellDir: m.swellWaveDirectionDeg ?? null, swellTp: m.swellWavePeriodS ?? null,
          windWaveHs: m.windWaveHeightM ?? null, windWaveDir: m.windWaveDirectionDeg ?? null,
          model: m.waveModel ?? m.model ?? null, source: m.source ?? null,
        },
        wind: { deg: final.wind?.deg ?? null, kmh: Number(((final.wind?.speed ?? 0) * 3.6).toFixed(1)), gustKmh: typeof final.wind?.gust === 'number' ? Number((final.wind.gust * 3.6).toFixed(1)) : null },
        regionWindKmh: Number((((area.wind?.speed) ?? 0) * 3.6).toFixed(1)),
        arc: { waveInArc, swellInArc: SA.isJudgeWitnessedArrivalDirection(profile, m.swellWaveDirectionDeg), witnessedSea: SA.isWitnessedArrivalSea(profile, comps) },
        geometry: { kd: geomKd ?? null, arrival: SA.resolveSeaArrivalExposureLevel(profile, m.waveDirectionDeg) ?? null },
        before: B, after: A,
        controls: {
          afterEqualsAgain: sameAgain,
          kdBeforeIsGeometry: (B.kd ?? undefined) === geomKd,
          kdAfterIsFloor: (A.kd ?? undefined) === expectedAfterKd,
        },
      });
    }
    out.ok = true;
  } catch (error) {
    out.error = String(error?.stack || error).slice(0, 1200);
  } finally {
    if (ARC) SA.JUDGE_WITNESSED_ARRIVAL_ARCS.set(MOLOS, ARC);
  }
  out.code = Object.fromEntries([...codeFingerprint.entries()].sort());
  console.log(`@@${JSON.stringify(out)}`);
  process.exit(0);
}

// ══ ΚΥΡΙΑ ΔΙΕΡΓΑΣΙΑ ══════════════════════════════════════════════════════════════════════════════
const t0 = Date.now();
const readJson = (rel) => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const v2Days = readJson('.tmp/s2judge/national-days-v2.json').beaches[String(MOLOS)].days;
const ndPath = '.tmp/s2judge/national-days.json';
const ndDays = existsSync(path.join(root, ndPath)) ? readJson(ndPath).beaches[String(MOLOS)]?.days ?? [] : [];
const inJudgeWindow = (w) => Array.isArray(w) && w[0] >= 0.5 && w[1] >= 0 && w[1] <= 45;
const jobs = [
  ...v2Days.map((d) => ({ ...d, source: 'national-days-v2' })),
  ...ndDays.filter((d) => inJudgeWindow(d.wave) && !v2Days.some((x) => x.day === d.day)).map((d) => ({ ...d, source: 'national-days.json (extra)' })),
].sort((a, b) => a.day.localeCompare(b.day));

// Ο έλεγχος SWIR (scripts/verifyShoreFoamSwir.py): αληθινός αφρός / φωτεινό-όχι-αφρός στον Μώλο.
const swir = readJson('reports/wave-model/shore-surf-swir-check.json');
const swirMolos = (swir.calm ?? []).find((e) => e.id === MOLOS) ?? {};
const swirReal = new Map((swirMolos.evidence ?? []).map((e) => [e.day, e]));
const swirFake = new Map((swirMolos.rejected ?? []).map((e) => [e.day, e]));
/** Ίδιο κατώφλι με το verifyShoreFoamSwir.py check_calm: αφρός στην ΕΞΩ λωρίδα ≥ 0,2. */
const FOAM_OUTER_MIN = 0.2;
const foamClass = (d) => {
  if (d.skipped || typeof d.beachFoam !== 'number') return 'no-data';
  if (swirFake.has(d.day)) return 'bright-not-foam';
  if ((d.beachFoamOuter ?? 0) >= FOAM_OUTER_MIN || swirReal.has(d.day)) return 'foam';
  return 'little';
};
const dstAthens = (d) => new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Athens', timeZoneName: 'short' })
  .format(new Date(`${d}T12:00:00Z`)).includes('+3');

// ── Τρέξιμο: παιδιά ανά μέρα, 4 μαζί, με επανάληψη αν κάποιος γράφει στο δέντρο τη στιγμή που φορτώνουμε ──
const env = { ...process.env, OPEN_METEO_REPLAY_SHIFT: '1' };
delete env.OPEN_METEO_API_KEY; // 403 στο historical-forecast με το πλάνο μας → δωρεάν host
delete env.OPEN_METEO_REPLAY_CLOCK;
if (REFRESH) env.MOLOS_REPLAY_REFRESH = '1';
const runChild = (day) => new Promise((resolve) => {
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--replay-child'], {
    cwd: root, env: { ...env, OPEN_METEO_REPLAY: day }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = ''; let stderr = '';
  const timer = setTimeout(() => child.kill(), 240000);
  child.stdout.on('data', (b) => { stdout += b; });
  child.stderr.on('data', (b) => { stderr += b; });
  child.on('close', () => {
    clearTimeout(timer);
    const line = stdout.split('\n').find((l) => l.startsWith('@@'));
    resolve(line ? JSON.parse(line.slice(2)) : { day, ok: false, error: `χωρίς αποτέλεσμα: ${stderr.slice(-600)}` });
  });
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = new Map();
let done = 0;
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const job = queue.shift();
    let res = await runChild(job.day);
    for (let attempt = 1; !res.ok && attempt <= 2; attempt += 1) {
      process.stderr.write(`\n  ${job.day}: σφάλμα (${String(res.error).split('\n')[0].slice(0, 120)}) — ξανά σε 60 s\n`);
      await sleep(60000);
      res = await runChild(job.day);
    }
    results.set(job.day, res);
    done += 1;
    process.stderr.write(`\r  replay ${done}/${jobs.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
  }
}));
process.stderr.write('\n');

// ── Αποτύπωμα κώδικα: όλα τα παιδιά πρέπει να έτρεξαν τον ΙΔΙΟ κώδικα ──
const fingerprints = new Map();
for (const r of results.values()) {
  for (const [file, hash] of Object.entries(r.code ?? {})) {
    if (!fingerprints.has(file)) fingerprints.set(file, new Set());
    fingerprints.get(file).add(hash);
  }
}
const codeChangedDuringRun = [...fingerprints.entries()].filter(([, s]) => s.size > 1).map(([f]) => f);
const git = (...args) => spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' }).stdout?.trim() ?? '';
const KEY_FILES = ['utils/seaArrival.ts', 'services/recommendationService.ts', 'utils/shoreWave.ts', 'utils/coveWaveGuard.ts',
  'utils/beachConditionsReadout.ts', 'utils/conditionsFeelPhrase.ts', 'utils/waveCharacter.ts', 'utils/suitabilityTone.ts'];

// ── Σύνοψη ανά μέρα ──
const pickView = (v) => (v ? {
  printed: v.printed, word: v.waveWord, level: v.waveLevel, verdict: v.verdict, pin: v.pin, pinWired: v.pinWired, chip: v.chip,
  score: v.score, kd: v.kd, arrival: v.seaArrival, seaStateSource: v.seaStateSource, exposureLevel: v.exposureLevel,
  openWaveM: v.openWaveM, shoreDisplayWaveM: v.shoreDisplayWaveM, warnings: v.warnings,
} : null);
const SHOWN = ['printed', 'waveWord', 'verdict', 'pin', 'chip', 'warnings'];
const INNER = ['score', 'kd', 'shoreDisplayWaveM', 'pinWired'];
const diffKeys = (h) => [...SHOWN, ...INNER].filter((k) => h.before?.[k] !== h.after?.[k]);
const days = jobs.map((job) => {
  const r = results.get(job.day);
  const overpassHour = dstAthens(job.day) ? 12 : 11;
  const hours = (r?.hours ?? []).filter((h) => !h.missing);
  const op = hours.find((h) => h.hour === overpassHour) ?? null;
  const [copHs, copDir, copTp] = job.wave ?? [];
  const dirsSite = hours.map((h) => h.sea.dir).filter((d) => typeof d === 'number');
  return {
    day: job.day, source: job.source, dst: dstAthens(job.day), overpassHourLocal: overpassHour,
    copernicus: { hs: copHs, dirDeg: copDir, periodS: copTp },
    judge: {
      class: job.class, foam: foamClass(job), beachFoam: job.beachFoam ?? null, beachFoamOuter: job.beachFoamOuter ?? null,
      exposedFoam: job.exposedFoam ?? null, skipped: job.skipped ?? null,
      swir: swirReal.has(job.day) ? { verdict: 'real-foam', ratio: swirReal.get(job.day).swirRatio }
        : swirFake.has(job.day) ? { verdict: 'bright-not-foam', ratio: swirFake.get(job.day).swirRatio } : null,
    },
    ok: Boolean(r?.ok), error: r?.ok ? undefined : r?.error,
    wiring: r?.wiring,
    overpass: op ? {
      site: { ...op.sea, windDeg: op.wind.deg, windKmh: op.wind.kmh, gustKmh: op.wind.gustKmh },
      siteMinusCopernicusDeg: typeof op.sea.dir === 'number' && typeof copDir === 'number' ? signedDiff(op.sea.dir, copDir) : null,
      arc: op.arc, geometry: op.geometry,
      before: pickView(op.before), after: pickView(op.after), changed: diffKeys(op),
    } : null,
    hours9to15: hours.map((h) => ({
      hour: h.hour, hs: h.sea.hs, dir: h.sea.dir, swellHs: h.sea.swellHs, swellDir: h.sea.swellDir, tp: h.sea.tp,
      windDeg: h.wind.deg, windKmh: h.wind.kmh, inArc: h.arc.waveInArc, witnessedSea: h.arc.witnessedSea, geomArrival: h.geometry.arrival,
      before: { printed: h.before.printed, word: h.before.waveWord, level: h.before.waveLevel, verdict: h.before.verdict, pin: h.before.pin },
      after: { printed: h.after.printed, word: h.after.waveWord, level: h.after.waveLevel, verdict: h.after.verdict, pin: h.after.pin },
      changed: diffKeys(h),
    })),
    siteDirRange9to15: dirsSite.length ? { min: Math.min(...dirsSite), max: Math.max(...dirsSite) } : null,
    controls: {
      hours: hours.length,
      afterEqualsAgain: hours.every((h) => h.controls.afterEqualsAgain),
      kdBeforeIsGeometry: hours.every((h) => h.controls.kdBeforeIsGeometry),
      kdAfterIsFloor: hours.every((h) => h.controls.kdAfterIsFloor),
      changedOutsideArc: hours.filter((h) => diffKeys(h).length && !h.arc.waveInArc && !h.arc.witnessedSea).length,
    },
  };
});

// ── Οι τέσσερις ερωτήσεις ──
const okDays = days.filter((d) => d.ok && d.overpass);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const shiftSet = okDays.filter((d) => d.copernicus.hs >= 0.5 && typeof d.overpass.siteMinusCopernicusDeg === 'number').map((d) => d.overpass.siteMinusCopernicusDeg);
const WITNESSED = ['2022-10-04', '2024-10-18'];
const CALM_LEVEL_MAX = 1; // 0 «Θάλασσα λάδι», 1 «σχεδόν χωρίς κύμα»
const BIG_LEVEL_MIN = 3; // 3 «αρκετό κύμα», 4 «μεγάλο κύμα»
const brief = (d) => ({
  day: d.day, cop: `${d.copernicus.hs} μ. από ${d.copernicus.dirDeg}°`, foam: d.judge.foam, beachFoam: d.judge.beachFoam, beachFoamOuter: d.judge.beachFoamOuter,
  site: `${d.overpass.site.hs} μ. από ${d.overpass.site.dir}° (ρεστία ${d.overpass.site.swellHs} από ${d.overpass.site.swellDir}°) · άνεμος ${d.overpass.site.windDeg}° ${d.overpass.site.windKmh} χλμ/ώ`,
  siteDirInArc: d.overpass.arc.waveInArc, witnessedSea: d.overpass.arc.witnessedSea, geomArrival: d.overpass.geometry.arrival,
  before: `${d.overpass.before.printed} μ. «${d.overpass.before.word}» · ${d.overpass.before.verdict} · πινέζα ${d.overpass.before.pin}`,
  after: `${d.overpass.after.printed} μ. «${d.overpass.after.word}» · ${d.overpass.after.verdict} · πινέζα ${d.overpass.after.pin}`,
});
const answers = {
  directionFrame: {
    note: 'site = Open-Meteo marine (ewam-led, weatherService) at profile.marineSamplePoint, overpass hour; Copernicus = the judge\'s MEDSEA 09 UTC',
    daysCompared: shiftSet.length,
    siteMinusCopernicusDeg: { median: median(shiftSet), min: shiftSet.length ? Math.min(...shiftSet) : null, max: shiftSet.length ? Math.max(...shiftSet) : null, all: shiftSet },
  },
  a_witnessedDaysInArc: WITNESSED.map((day) => {
    const d = okDays.find((x) => x.day === day);
    return d ? { day, copDirDeg: d.copernicus.dirDeg, siteDirDeg: d.overpass.site.dir, siteSwellDirDeg: d.overpass.site.swellDir,
      siteDirInArcAtOverpass: d.overpass.arc.waveInArc, witnessedSeaAtOverpass: d.overpass.arc.witnessedSea,
      siteDirRange9to15: d.siteDirRange9to15, hoursInArc9to15: d.hours9to15.filter((h) => h.inArc).length, hours: d.hours9to15.length }
      : { day, missing: true };
  }),
  b_witnessedDaysBeforeAfter: WITNESSED.map((day) => {
    const d = okDays.find((x) => x.day === day);
    return d ? { ...brief(d), changedAtOverpass: d.overpass.changed,
      hours9to15: d.hours9to15.map((h) => `${h.hour}:00 ${h.dir}° ${h.before.printed}→${h.after.printed} «${h.before.word}»→«${h.after.word}» ${h.before.verdict}→${h.after.verdict}`) }
      : { day, missing: true };
  }),
  c_foamDaysStillCalmAfterFix: {
    rule: `foam day (judge beachFoamOuter ≥ ${FOAM_OUTER_MIN} or SWIR real foam; SWIR "bright-not-foam" excluded) where AFTER the fix the card word is level ≤ ${CALM_LEVEL_MAX} («Θάλασσα λάδι» / «σχεδόν χωρίς κύμα»)`,
    foamDays: okDays.filter((d) => d.judge.foam === 'foam').length,
    atOverpass: okDays.filter((d) => d.judge.foam === 'foam' && (d.overpass.after.level ?? 9) <= CALM_LEVEL_MAX).map(brief),
    anyHour9to15: okDays.filter((d) => d.judge.foam === 'foam').flatMap((d) => d.hours9to15
      .filter((h) => (h.after.level ?? 9) <= CALM_LEVEL_MAX).map((h) => ({ day: d.day, hour: h.hour, dir: h.dir, hs: h.hs, inArc: h.inArc, printed: h.after.printed, word: h.after.word }))),
    foamDaysSiteDirOutsideArc: okDays.filter((d) => d.judge.foam === 'foam' && !d.overpass.arc.waveInArc).map(brief),
  },
  d_littleFoamDaysBigWaveAfterFix: {
    rule: `measured day with little foam (beachFoamOuter < ${FOAM_OUTER_MIN}, not SWIR real) — does AFTER print level ≥ ${BIG_LEVEL_MIN} («αρκετό»/«μεγάλο κύμα»), and did the FIX cause it (BEFORE lower)?`,
    littleFoamDays: okDays.filter((d) => d.judge.foam === 'little').length,
    bigAfterAtOverpass: okDays.filter((d) => d.judge.foam === 'little' && (d.overpass.after.level ?? -1) >= BIG_LEVEL_MIN).map((d) => ({ ...brief(d), causedByFix: (d.overpass.before.level ?? -1) < BIG_LEVEL_MIN })),
    fixRaisedWordAtOverpass: okDays.filter((d) => d.judge.foam === 'little' && (d.overpass.after.level ?? -1) > (d.overpass.before.level ?? -1)).map(brief),
    fixRaisedWordAnyHour9to15: okDays.filter((d) => d.judge.foam === 'little').flatMap((d) => d.hours9to15
      .filter((h) => (h.after.level ?? -1) > (h.before.level ?? -1)).map((h) => ({ day: d.day, hour: h.hour, dir: h.dir, hs: h.hs, before: `${h.before.printed} «${h.before.word}»`, after: `${h.after.printed} «${h.after.word}»`, verdict: `${h.before.verdict}→${h.after.verdict}` }))),
  },
  mechanism: (() => {
    // ΠΟΙΟΣ ΜΗΧΑΝΙΣΜΟΣ ΤΗΣ ΔΙΟΡΘΩΣΗΣ ΔΟΥΛΕΨΕ ΣΤΟ ΠΛΑΙΣΙΟ ΤΟΥ SITE: το πάτωμα K_d (μόνο όπου η γεωμετρία
    // λέει «τσέπη», 'enclosed') ή ο σύνδεσμος isWitnessedArrivalSea (σβήνει εκτίμηση ακτής/φρουρό όρμου).
    const all = okDays.flatMap((d) => d.hours9to15.map((h) => ({ d, h })));
    const shown = ({ h }) => h.before.printed !== h.after.printed || h.before.word !== h.after.word;
    const norm = (x) => ((x % 360) + 360) % 360;
    const ratios = (xs, side) => {
      const v = xs.map(({ h }) => h[side].printed / h.hs).filter(Number.isFinite).sort((a, b) => a - b);
      return v.length ? { n: v.length, min: Number(v[0].toFixed(2)), median: Number(median(v).toFixed(2)), max: Number(v[v.length - 1].toFixed(2)) } : null;
    };
    const big = all.filter(({ h }) => h.hs >= 0.5);
    const hist = {};
    for (const { h } of big) { const b = Math.floor(norm(h.dir + 5) / 5) * 5 - 5; hist[b] = (hist[b] ?? 0) + 1; }
    const viaLink = all.filter((x) => shown(x) && x.h.geomArrival !== 'enclosed');
    const edge = big.filter(({ h }) => angDist(h.dir, 0) <= 3);
    return {
      hoursRun: all.length,
      hoursWithSiteHs05: big.length,
      siteDirHistogramHs05: { note: '5° bins, key = bin start (−5 = 355-359°)', bins: Object.fromEntries(Object.entries(hist).sort((a, b) => a[0] - b[0])) },
      hoursInGeometricHole: all.filter(({ h }) => h.geomArrival === 'enclosed').length,
      hoursInGeometricHoleWithMeasuredFoam: all.filter(({ d, h }) => h.geomArrival === 'enclosed' && d.judge.foam !== 'no-data').length,
      printedOrWordChanged: {
        total: all.filter(shown).length,
        viaKdFloorInHole: all.filter((x) => shown(x) && x.h.geomArrival === 'enclosed').length,
        viaWitnessLinkOutsideHole: viaLink.length,
      },
      printedOverSiteHsWhereLinkChangedIt: { before: ratios(viaLink, 'before'), after: ratios(viaLink, 'after') },
      arcEdgeAt0deg: {
        hoursWithin3degOfEdge: edge.length,
        daysWithin3degOfEdge: new Set(edge.map(({ d }) => d.day)).size,
        daysWhereArcMembershipFlipsWithin09to15: okDays.filter((d) => {
          const hs = d.hours9to15.filter((h) => h.hs >= 0.5);
          const inn = hs.filter((h) => h.inArc).length;
          return inn > 0 && inn < hs.length;
        }).map((d) => ({ day: d.day, hours: d.hours9to15.filter((h) => h.hs >= 0.5).map((h) => `${h.hour}:00 ${h.dir}° ${h.after.printed} «${h.after.word}»`) })),
      },
      foamDaysLowestWordLevelBefore: Math.min(...okDays.filter((d) => d.judge.foam === 'foam').flatMap((d) => d.hours9to15.map((h) => h.before.level ?? 9))),
    };
  })(),
  totals: {
    daysRun: jobs.length, daysOk: okDays.length, daysFailed: days.filter((d) => !d.ok).map((d) => ({ day: d.day, error: String(d.error).split('\n')[0] })),
    overpassChanged: okDays.filter((d) => d.overpass.changed.length).length,
    overpassChangedShown: okDays.filter((d) => d.overpass.changed.some((k) => SHOWN.includes(k))).length,
    hoursRun: okDays.reduce((n, d) => n + d.hours9to15.length, 0),
    hoursChangedShown: okDays.reduce((n, d) => n + d.hours9to15.filter((h) => h.changed.some((k) => SHOWN.includes(k))).length, 0),
    verdictFlipsAnyHour: okDays.reduce((n, d) => n + d.hours9to15.filter((h) => h.before.verdict !== h.after.verdict).length, 0),
    pinFlipsAnyHour: okDays.reduce((n, d) => n + d.hours9to15.filter((h) => h.before.pin !== h.after.pin).length, 0),
    changedOutsideArc: okDays.reduce((n, d) => n + d.controls.changedOutsideArc, 0),
  },
};
const controls = {
  afterEqualsAgainEverywhere: okDays.every((d) => d.controls.afterEqualsAgain),
  kdBeforeIsGeometryEverywhere: okDays.every((d) => d.controls.kdBeforeIsGeometry),
  kdAfterIsFloorEverywhere: okDays.every((d) => d.controls.kdAfterIsFloor),
  seaWindCellAbsent: okDays.every((d) => d.wiring?.seaWindCell == null && d.wiring?.overWaterIdentity === true),
  sameDateRegionAndCluster: okDays.every((d) => d.wiring?.regionDate === d.wiring?.clusterDate),
  sevenHoursEveryDay: okDays.every((d) => d.hours9to15.length === HOURS.length),
  codeFingerprintsAgree: codeChangedDuringRun.length === 0,
  codeChangedDuringRun,
};

const report = {
  generatedAt: new Date().toISOString(),
  script: 'scripts/replayMolosWitnessDays.mjs',
  beach: { id: MOLOS, name: beach?.name?.gr, region: REGION, facingDeg: profile?.facingDeg, marineSamplePoint: profile?.marineSamplePoint },
  arc: { centerDeg: 15, halfWidthDeg: 15, source: 'utils/seaArrival.ts JUDGE_WITNESSED_ARRIVAL_ARCS (runtime value checked in each child)' },
  method: {
    replay: 'scripts/lib/replayOpenMeteo.mjs, OPEN_METEO_REPLAY=<day>, OPEN_METEO_REPLAY_SHIFT=1, OPEN_METEO_API_KEY removed (free archive hosts); raw archive responses cached in .tmp/molos-replay/http',
    chain: 'region day (fetchForecastData + fetchMarineForecastData at island.coordinates → processForecastData) → applyMarineToDailyForecast(own marineSamplePoint via resolveBeachMarinePoints + fetchMarineForecastDataBatch) → hour via copy of App.tsx adjustDailyForecastToHour → applyBeachWindToDailyForecast(cluster forecast at the same hour; buildBeachForecastClusters + fetchForecastDataBatch + applyOverWaterWindToDays) → calculateBeachScore(weatherSource island-fallback, hourlyForecast, geospatialProfile)',
    readout: 'utils/beachConditionsReadout.buildBeachConditionsReadout (card path); word level via utils/conditionsFeelPhrase.waveFeelLevelWithArrival (0 λάδι, 1 σχεδόν χωρίς, 2 λίγο, 3 αρκετό, 4 μεγάλο)',
    pin: 'resolveConditionTone with components/BeachMap.tsx beachToneInput arguments; `pin` = item without K_d (as production), `pinWired` = with the score K_d; NO neighbour matching (getVisibleMapExposureLevel only)',
    variants: 'after = code as is; before = JUDGE_WITNESSED_ARRIVAL_ARCS.delete(2040) (disables K_d floor AND isWitnessedArrivalSea link), restored in finally; after-again must equal after',
    overpassHour: '12:00 local (EEST) / 11:00 local (EET) — Sentinel-2 ≈ 09:10-09:30 UTC',
    foamClass: `foam = beachFoamOuter ≥ ${FOAM_OUTER_MIN} (verifyShoreFoamSwir.py check_calm threshold) or SWIR real; bright-not-foam = SWIR ratio ≥ 0.62; little = measured, below; no-data = judge skipped (glint/cloud)`,
    dayPool: 'all Molos days in .tmp/s2judge/national-days-v2.json + days with Copernicus 0-45° and Hs ≥ 0.5 m found only in .tmp/s2judge/national-days.json',
  },
  git: {
    head: git('rev-parse', '--short', 'HEAD'),
    keyFilesDirtyVsHead: git('diff', '--stat', 'HEAD', '--', ...KEY_FILES) || '(none)',
  },
  controls,
  answers,
  days,
  notProven: [
    'Whether 0.5 of the open sea is the RIGHT height — the satellite sees foam / no foam, not metres.',
    'The archive is the first hours of each forecast run, not the 1-3 day forecast a visitor saw that day; it runs TODAY\'s code and TODAY\'s profiles.',
    'SHIFT puts the old day on today with the real clock: any "hours left today" logic reads the run-time clock.',
    'Only Molos\' own marine point and wind cluster are fetched (production batches them with the other beaches; per-point values do not depend on the batch).',
    'Pin colour without the map\'s neighbour matching; the podium and the beach detail page are not rebuilt.',
    'One satellite image per day; hours 09-15 say what the site would have printed, not what the sea did.',
  ],
};
const reportPath = path.join(root, 'reports/wave-model/molos-witness-days-replay.json');
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

// ── Κονσόλα ──
const f = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? String(v).replace('.', ',') : v);
console.log(`\nΜώλος #${MOLOS} · τόξο 0-30° · ${jobs.length} μέρες · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`κατεύθυνση site − Copernicus (ώρα λήψης, Hs ≥ 0,5): διάμεσος ${f(answers.directionFrame.siteMinusCopernicusDeg.median)}° · ${f(answers.directionFrame.siteMinusCopernicusDeg.min)}…${f(answers.directionFrame.siteMinusCopernicusDeg.max)}°`);
console.log('\nμέρα        Cop.        αφρός(έξω)   site κύμα/ρεστία              άνεμος      ΠΡΙΝ → ΜΕΤΑ (ώρα λήψης)');
for (const d of days) {
  if (!d.ok || !d.overpass) { console.log(`${d.day}  ΣΦΑΛΜΑ ${String(d.error).split('\n')[0].slice(0, 100)}`); continue; }
  const o = d.overpass;
  const foam = d.judge.foam === 'no-data' ? 'χωρίς' : `${f(d.judge.beachFoam)}(${f(d.judge.beachFoamOuter)})`;
  console.log(`${d.day} ${String(`${f(d.copernicus.hs)}/${d.copernicus.dirDeg}°`).padEnd(11)} ${foam.padEnd(12)} ${String(`${f(o.site.hs)}/${f(o.site.dir)}° ${f(o.site.swellHs)}/${f(o.site.swellDir)}°`).padEnd(22)}${o.arc.waveInArc ? ' τόξο' : '     '}  ${String(`${f(o.site.windDeg)}° ${f(o.site.windKmh)}`).padEnd(11)} ${f(o.before.printed)} «${o.before.word}» ${o.before.verdict} ${o.before.pin} → ${f(o.after.printed)} «${o.after.word}» ${o.after.verdict} ${o.after.pin}${o.changed.length ? '  ◀' : ''}`);
}
console.log(`\nέλεγχοι: ΜΕΤΑ==ΜΕΤΑ-ξανά ${controls.afterEqualsAgainEverywhere} · K_d ΠΡΙΝ==γεωμετρία ${controls.kdBeforeIsGeometryEverywhere} · K_d ΜΕΤΑ==πάτωμα ${controls.kdAfterIsFloorEverywhere} · ίδιος κώδικας σε όλα ${controls.codeFingerprintsAgree}${codeChangedDuringRun.length ? ` (άλλαξαν: ${codeChangedDuringRun.join(', ')})` : ''}`);
console.log(`αλλαγές έξω από το τόξο: ${answers.totals.changedOutsideArc} · ώρες που αλλάζει κάτι ορατό: ${answers.totals.hoursChangedShown}/${answers.totals.hoursRun}`);
console.log(`Αναφορά: ${path.relative(root, reportPath)}`);
