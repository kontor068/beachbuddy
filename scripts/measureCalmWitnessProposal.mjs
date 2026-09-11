#!/usr/bin/env node
/**
 * «ΛΕΜΕ ΚΥΜΑ, Η ΠΑΡΑΛΙΑ ΕΙΝΑΙ ΗΣΥΧΗ» — Καλό Λιμάνι Λέσβου #1334 και Καλάμι Χανίων #601 (11/09/2026, C1).
 * ΜΕΤΡΗΣΗ ΜΙΑΣ ΠΡΟΤΑΣΗΣ, ΟΧΙ ΑΛΛΑΓΗ: καμία γραμμή παραγωγής δεν αγγίζεται.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Ο πανελλαδικός κριτής στην άμμο (Sentinel-2 + έλεγχος SWIR, βίβλος §Γ76) έβαλε τις δύο
 * παραλίες στη λίστα «λέμε κύμα, ήσυχη»: η διπλανή εκτεθειμένη ακτή έσκαγε (αληθινός αφρός), η λωρίδα της
 * παραλίας όχι, ενώ τυπώναμε ≥0,9 ενός ανοιχτού ≥0,8 μ. Αυτό είναι το ΑΝΤΙΘΕΤΟ λάθος από τον Μώλο (§Γ77):
 * εκεί τυπώναμε ήρεμο και έσκαγε — και η διόρθωσή του ανέβαζε νούμερα. Εδώ κάθε διόρθωση ΚΑΤΕΒΑΖΕΙ νούμερα,
 * δηλαδή πάει προς την ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση και θέλει ισχυρότερη απόδειξη. Το script:
 *   (1) μετράει τη ΓΕΩΜΕΤΡΙΑ ανά 5° με τις ΙΔΙΕΣ συναρτήσεις και την ίδια μάσκα OSM που χτίζουν τα προφίλ
 *       (scripts/geospatialExposureProfiles.ts, φορτωμένο χωρίς το main() του· έλεγχος: το ξαναχτισμένο
 *       προφίλ πρέπει να βγαίνει ΙΔΙΟ με το αποστελλόμενο)·
 *   (2) τυπώνει τι λέει ο πραγματικός κινητήρας για τη θάλασσα κάθε μαρτυρημένης μέρας (Copernicus Hs/κατ./
 *       περίοδος, συνθετικός άνεμος ΒΒΑ 20 χλμ/ώ — ο συνηθισμένος άνεμος εκείνων των ημερών)·
 *   (3) με --replay: ΞΑΝΑΠΑΙΖΕΙ τις μαρτυρημένες μέρες με το ΑΡΧΕΙΟ ΠΡΟΓΝΩΣΕΩΝ (scripts/lib/replayOpenMeteo,
 *       δωρεάν host — το κλειδί μας ΔΕΝ περνάει πια στο historical-forecast: 403 «Professional plan», 11/09)
 *       μέσα από τον ίδιο δρόμο που φέρνει τον καιρό η εφαρμογή (weatherService → processForecastData →
 *       calculateBeachScore), για να φανεί τι ΤΥΠΩΘΗΚΕ πραγματικά — όχι τι θα τύπωνε ένα κελί Copernicus·
 *   (4) μετράει την ΠΡΟΤΑΣΗ σε όλη τη Λέσβο (62 παραλίες) με πλέγμα καιρού, ΠΡΙΝ/ΜΕΤΑ/ΜΕΤΑ-ξανά στην ίδια
 *       διεργασία, όπως το scripts/measureMolosArrivalArc.mjs.
 *
 * Η ΠΡΟΤΑΣΗ (μόνο #1334, μόνο τόξο κατεύθυνσης κύματος): «ΜΑΡΤΥΡΑΣ ΗΡΕΜΙΑΣ». Μέσα στο τόξο που ΕΙΔΕ ο
 * κριτής (κατεύθυνση όπως τη διαβάζει Η ΕΦΑΡΜΟΓΗ στο σημείο θάλασσάς της, όχι το Copernicus):
 *   • utils/seaArrival.resolveShoreShadowDamping → min(K_d γεωμετρίας, SHADOW_KD_AT_EDGE = 0,5) — «το μισό,
 *     όχι λάδι»· η άκρη της σκιάς, ο ίδιος αριθμός που φοράει κάθε μάρτυρας άφιξης·
 *   • utils/seaArrival.resolveSeaArrivalExposureLevel → SEA_ARRIVAL_ENCLOSED, ώστε η shoreSeaStateM να δώσει
 *     αυτό το K_d ΑΝΕΞΑΡΤΗΤΑ από τον σημερινό άνεμο (όπως στην τσέπη). Χωρίς αυτό (παραλλαγή «protectedOnly»,
 *     μετριέται δίπλα) η έκπτωση δεν πιάνει στις μέρες που είδε ο κριτής, γιατί με βοριά ο άνεμος βγαίνει
 *     'partial' και η shoreSeaStateM ζητάει 'protected'.
 *   • ΦΡΑΧΤΗΣ ΑΝΕΜΟΥ (παραλλαγή «guarded», η προτεινόμενη μορφή): η μαρτυρία ΔΕΝ ισχύει όταν ο αριθμός της
 *     ακτής βγαίνει από το μοντέλο ανέμου (seaStateSource 'modeled') ή ο σημερινός άνεμος μπαίνει από ανοιχτό
 *     τομέα (exposureLevel 'exposed') — αυτό το είδε το πρώτο τρέξιμο: δυτικός 30 χλμ/ώ + θάλασσα στο τόξο.
 * Εφαρμόζεται με αντικατάσταση των δύο export του utils/seaArrival.ts ΣΤΗ ΜΝΗΜΗ (το recommendationService τα
 * καλεί ως ιδιότητες του module, άρα βλέπει την αντικατάσταση) και επαναφέρεται στο finally. Αυτό είναι
 * ισοδύναμο με αλλαγή μέσα στις δύο συναρτήσεις: κανένας άλλος καλών δεν τις καλεί εσωτερικά. Ο φράχτης
 * εφαρμόζεται πάνω στα δύο score (ΠΡΙΝ/ΜΕΤΑ) — τα δύο πεδία που κοιτάει δεν εξαρτώνται από την πρόταση.
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν λέει αν το 0,5 είναι ΣΩΣΤΟ. Ο δορυφόρος βλέπει «λωρίδα αφρού ή όχι», όχι ύψος. «Όχι αφρός» είναι
 *    συμβατό με 0,1 μ. ΚΑΙ με 0,4 μ. Το 0,5 είναι η μικρότερη ισχυρή δήλωση ηρεμίας, όχι μέτρηση.
 *  - Μία λήψη τη μέρα (~12:15 καλοκαίρι / ~11:15 χειμώνα). Κανένα απόγευμα, καμία κάμερα, κανένας άνθρωπος.
 *  - Συνθετικός καιρός στο πλέγμα (ένας άνεμος σε όλη τη Λέσβο, ίδιος όλες τις ώρες, ρεστία 0,35×Hs).
 *  - Το replay είναι το ΑΡΧΕΙΟ της πρόγνωσης (οι πρώτες ώρες κάθε τρεξίματος), όχι η πρόγνωση 1-3 ημερών
 *    που είδε ο επισκέπτης εκείνη τη μέρα· και τρέχει τον ΣΗΜΕΡΙΝΟ κώδικα και τα ΣΗΜΕΡΙΝΑ προφίλ.
 *  - «Βάθρο» = οι 3 πρώτες της getSuitableBeaches (όχι φίλτρα χρώματος/προφίλ/ποικιλία του App).
 *  - Τα αντικείμενα χάρτη χτίζονται όπως στο measureMolosArrivalArc.mjs (App.tsx mapSuitableBeaches,
 *    components/BeachMap.tsx beachToneInput)· δεν κουβαλούν shoreShadowDamping, όπως στην παραγωγή.
 *
 * ΜΕΤΡΗΘΗΚΕ 11/09/2026 (reports/wave-model/calm-witness-proposal.json):
 *  - Γεωμετρία: ξαναχτισμένο == αποστελλόμενο και για τις δύο. #1334: ανοιχτό νερό ως 25 χλμ ΜΟΝΟ στις
 *    275-310°· 315-360° στεριά στα 100 μ. (η χερσόνησος). #601: ανοιχτό μόνο 50-55°.
 *  - Replay #1334 (30 μέρες, ώρα λήψης): τυπώναμε ≥0,9 του ανοιχτού σε 25· η εφαρμογή διάβαζε 341°…7°
 *    (το Copernicus 335-349°). ΜΕΤΑ+φράχτης: ετυμηγορία «μην κολυμπήσεις» 24 → 18.
 *  - Replay #601 (14 μέρες): η εφαρμογή διάβαζε 0,1-0,6 μ. από 23-47° και τύπωνε 0,1-0,6 μ. — ΔΕΝ έλεγε
 *    «κύμα» (εκτός 18/02/2026, δυτικός 41 χλμ/ώ, σύννεφο πάνω στην παραλία). Η προϋπόθεση του κριτή δεν ισχύει.
 *  - Πλέγμα Λέσβου 1.800 × 62: αλλάζει ΜΟΝΟ το #1334 και ΜΟΝΟ μέσα στο τόξο· 0/109.800 άλλες παραλίες,
 *    0 αλλαγές βάθρου, 0 διαρροή στις άκρες ανά 1°, 0/720 στα Χανιά.
 *
 *   node scripts/measureCalmWitnessProposal.mjs            (γεωμετρία αν υπάρχει η μάσκα + μαρτυρίες + πλέγμα)
 *   node scripts/measureCalmWitnessProposal.mjs --replay   (+ αρχείο προγνώσεων, ~2 κλήσεις Open-Meteo/μέρα)
 *   node scripts/measureCalmWitnessProposal.mjs --quick    (μικρό πλέγμα, για δοκιμή)
 *   → reports/wave-model/calm-witness-proposal.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ts from 'typescript';

const REPLAY_CHILD = process.argv.includes('--replay-child');
// Το παιδί του replay: ο διακόπτης του αρχείου προγνώσεων διαβάζει το OPEN_METEO_REPLAY την ώρα του import.
if (REPLAY_CHILD) await import('./lib/replayOpenMeteo.mjs');

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
const TS_OPTIONS = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React };
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: TS_OPTIONS, fileName: filename })
    .outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

// Η ΙΔΙΑ εγγραφή του require-cache που φορτώνει και το scoring (έλεγχος πιο κάτω: το score ΒΛΕΠΕΙ την πρόταση).
const SA = require(path.join(root, 'utils/seaArrival.ts'));
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { holdsFlatWaterUnderOffshoreWind, holdsGlassWaterAtFourBeaufort, hasDownwindSeaSample } = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { getBeaufortLevel, degToCompass, processForecastData } = require(path.join(root, 'utils/weatherUtils.ts'));

// ── Η πρόταση ────────────────────────────────────────────────────────────────
/**
 * Τόξο = οι κατευθύνσεις ΤΗΣ ΕΦΑΡΜΟΓΗΣ (Open-Meteo marine στο marineSamplePoint) τις 29 μαρτυρημένες μέρες
 * ΒΒΔ στην ώρα λήψης: 341°…7° (replay 11/09/2026). Κέντρο 354°, μισό πλάτος 13° → [341°, 7°], ΧΩΡΙΣ περιθώριο:
 * πέρα από τις μαρτυρημένες κατευθύνσεις η γεωμετρία μένει όπως είναι (ηρεμότερη κατεύθυνση = καμία επέκταση).
 */
/**
 * K_d ΜΕΣΑ ΣΤΟ ΤΟΞΟ = SHADOW_KD_AT_EDGE ΑΚΡΙΒΩΣ («το μισό» — ούτε λιγότερο, ούτε περισσότερο). Στο #1334 η
 * γεωμετρία δίνει ήδη 0,5 σε όλο το [341°, 7°] (πάτωμα πλάγιας θάλασσας)· ελέγχεται παρακάτω, οπότε η
 * λειτουργική αλλαγή είναι ΜΟΝΟ η άφιξη → 'enclosed'.
 */
const PROPOSAL = Object.freeze({ beachId: 1334, centerDeg: 354, halfWidthDeg: 13, kdInArc: SA.SHADOW_KD_AT_EDGE });
const ORIGINAL = Object.freeze({ arrival: SA.resolveSeaArrivalExposureLevel, kd: SA.resolveShoreShadowDamping });
const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const inCalmArc = (profile, deg) => profile?.beachId === PROPOSAL.beachId && typeof deg === 'number' && Number.isFinite(deg)
  && angDist(deg, PROPOSAL.centerDeg) <= PROPOSAL.halfWidthDeg;
const VARIANT_ARRIVAL = { after: SA.SEA_ARRIVAL_ENCLOSED, protectedOnly: 'protected' };
const useVariant = (variant) => {
  if (variant === 'before') {
    SA.resolveSeaArrivalExposureLevel = ORIGINAL.arrival;
    SA.resolveShoreShadowDamping = ORIGINAL.kd;
    return;
  }
  const arrival = VARIANT_ARRIVAL[variant];
  SA.resolveSeaArrivalExposureLevel = (profile, deg) => {
    const base = ORIGINAL.arrival(profile, deg);
    return inCalmArc(profile, deg) && base !== SA.SEA_ARRIVAL_UNKNOWN ? arrival : base;
  };
  SA.resolveShoreShadowDamping = (profile, deg) => {
    const kd = ORIGINAL.kd(profile, deg);
    return typeof kd === 'number' && inCalmArc(profile, deg) ? PROPOSAL.kdInArc : kd;
  };
};
/**
 * Ο ΦΡΑΧΤΗΣ ΤΟΥ ΑΝΕΜΟΥ (βρέθηκε από το πρώτο τρέξιμο αυτού του script, 11/09): με δυτικό 30 χλμ/ώ (ανοιχτός
 * διάδρομος 275-310°) και ένδειξη θάλασσας μέσα στο τόξο, το σκέτο τόξο μισούσε και το κύμα που σηκώνει ο
 * ΤΟΠΙΚΟΣ άνεμος μέσα από τον ανοιχτό διάδρομο (0,9 → 0,5 όταν το ύψος βγαίνει από το μοντέλο ανέμου· 1,1 →
 * 0,6 όταν η μετρημένη θάλασσα είναι μεγαλύτερη αλλά ο άνεμος φυσάει κατευθείαν μέσα στον όρμο). Ο κριτής
 * είδε ΜΟΝΟ τη θάλασσα του τόξου με βοριά/βορειοανατολικό ('partial'/'protected'). Άρα η μαρτυρία ΔΕΝ ισχύει όταν:
 *   • score.seaStateSource === 'modeled' (ο αριθμός της ακτής είναι το κύμα του ανέμου, όχι η μετρημένη θάλασσα), ή
 *   • score.exposureLevel === 'exposed' (ο σημερινός άνεμος μπαίνει από ανοιχτό τομέα και χτίζει δικό του κύμα).
 * Και τα δύο δεν εξαρτώνται από την πρόταση (ελέγχεται), οπότε «ΜΕΤΑ, εκτός αν … → ΠΡΙΝ» είναι ακριβώς ό,τι θα
 * έκανε ο ίδιος φράχτης γραμμένος μέσα στο recommendationService.
 */
const witnessBlocked = (score) => score?.seaStateSource === 'modeled' || score?.exposureLevel === 'exposed';
const guardedScore = (before, after) => (witnessBlocked(after) ? before : after);

// ── Δεδομένα ─────────────────────────────────────────────────────────────────
const TARGETS = { 1334: 'north-aegean-lesvos', 601: 'crete-crete-chania' };
const loadRegion = (region) => {
  const beaches = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${region}.json`), 'utf8')).island.beaches;
  const summary = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app/summary', `${region}.json`), 'utf8')).island.beaches;
  const profilesById = {};
  for (const p of Object.values(JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/exposure', `${region}.json`), 'utf8')).profiles ?? {})) {
    if (p?.beachId != null) profilesById[p.beachId] = p;
  }
  return { region, beaches, summary, profilesById };
};
const SECT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorAt = (deg) => SECT[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

const scoreBeach = (beach, day, profile, hourly = day.hourly) => calculateBeachScore(beach, day, undefined, undefined, {
  geospatialProfile: profile, hourlyForecast: hourly,
});
const readout = (s, regionWindMs) => buildBeachConditionsReadout({
  beachWindSpeedKmph: s.windSpeedKmph, regionWindSpeedMs: regionWindMs, waveHeightM: s.waveHeightM,
  seaStateWaveM: s.seaStateWaveM, seaStatePeriodS: s.seaStatePeriodS, shoreWaveHeightM: s.shoreWaveHeightM,
  shoreDisplayWaveM: s.shoreDisplayWaveM, shoreWaveFromDepartingSea: s.shoreWaveFromDepartingSea,
  seaArrivalExposureLevel: s.seaArrivalExposureLevel, language: 'gr',
});

/** Το αντικείμενο του χάρτη όπως το χτίζει το App.tsx (mapSuitableBeaches) — αντίγραφο του
 *  scripts/measureMolosArrivalArc.mjs appMapItem, πεδίο προς πεδίο· ΧΩΡΙΣ shoreShadowDamping. */
const appMapItem = (beach, day, s, profile) => {
  const windKmh = day.wind.speed * 3.6;
  const a = assessBeachWindExposure({
    beach, geospatialProfile: profile, windDirectionDeg: day.wind.deg, windDirection: degToCompass(day.wind.deg),
    windSpeedKmh: windKmh, beaufort: getBeaufortLevel(windKmh), waveHeightMeters: day.marine?.waveHeightM,
  });
  return {
    beachId: beach.id, score: s.score, explanation: '', beach,
    isExposed: a.exposureLevel ? a.exposureLevel !== 'protected' : true,
    exposureLevel: a.exposureLevel, orientation: a.windProfile.beachFacingDirection ?? null,
    windProfile: a.windProfile, windProfileSource: a.source, windSector: a.windSector,
    windSpeedKmph: s.windSpeedKmph, waveHeightM: s.waveHeightM, seaStateWaveM: s.seaStateWaveM,
    shoreWaveHeightM: s.shoreWaveHeightM, shoreDisplayWaveM: s.shoreDisplayWaveM,
    shoreWaveFromDepartingSea: s.shoreWaveFromDepartingSea, seaArrivalExposureLevel: s.seaArrivalExposureLevel,
    seaTemperatureC: s.seaTemperatureC, seaStatePeriodS: s.seaStatePeriodS, marine: s.marine,
    warnings: s.warnings, confidence: s.confidence, swimmingComfort: s.swimmingComfort,
    canClaimWindProtection: s.canClaimWindProtection, enclosedCove: s.enclosedCove,
    seaCalmClaimAllowed: s.seaCalmClaimAllowed, simpleWindSuitability: s.simpleWindSuitability,
    distance: undefined, geospatialExposure: profile,
  };
};
/** components/BeachMap.tsx beachToneInput, όρισμα προς όρισμα (αντίγραφο του measureMolosArrivalArc.mjs pinTone). */
const pinTone = (item, ctx, kd) => {
  const exposureLevel = ctx.levels?.get(item.beach.id) || getVisibleMapExposureLevel(item, ctx.beaufort, ctx.deg);
  const seaStateM = seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS);
  const swellWaveHeightM = item.marine?.swellWaveHeightM;
  return resolveConditionTone({
    exposureLevel, beaufort: ctx.beaufort, isEnclosedCove: Boolean(item.enclosedCove), seaStateM,
    offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({ profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, swellWaveHeightM }),
    glassWaterAtFour: holdsGlassWaterAtFourBeaufort({
      profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, seaStateM, exposureLevel,
      seaArrivalExposureLevel: item.seaArrivalExposureLevel, shoreShadowDamping: kd.shoreShadowDamping, swellWaveHeightM,
    }),
    downwindSeaSample: hasDownwindSeaSample({ profile: item.geospatialExposure, windDirectionDeg: ctx.deg, swellWaveHeightM }),
    seaArrivalExposureLevel: item.seaArrivalExposureLevel, shoreShadowDamping: kd.shoreShadowDamping,
    swimVerdictAvoid: item.swimmingComfort === 'avoid_swimming', windSpeedKmh: ctx.windKmh, forecastUncertain: kd.forecastUncertain,
  });
};
const visitorView = (item, s, ctx) => {
  const r = readout(s, ctx.windMs);
  const hasWave = typeof r.waveM === 'number' && Number.isFinite(r.waveM);
  return {
    printed: hasWave ? Number(r.waveM.toFixed(1)) : null,
    waveText: r.waveText ?? null, waveWord: r.waveWord ?? null,
    pinTone: pinTone(item, ctx, item), pinToneWired: pinTone(item, ctx, s),
    chipTone: s.simpleWindSuitability?.suitabilityColor ?? null, verdict: s.swimmingComfort ?? null,
    finalScore: s.finalSuitabilityScore ?? null, shoreDisplayWaveM: s.shoreDisplayWaveM ?? null,
    openWaveM: s.waveHeightM ?? null, kd: s.shoreShadowDamping ?? null, seaArrival: s.seaArrivalExposureLevel ?? null,
    warnings: (s.warnings ?? []).map((w) => w.type).sort().join(','),
  };
};
const SHOWN_KEYS = ['printed', 'waveText', 'waveWord', 'pinTone', 'chipTone', 'verdict', 'warnings'];
const VIEW_KEYS = [...SHOWN_KEYS, 'pinToneWired', 'finalScore', 'shoreDisplayWaveM', 'kd', 'seaArrival'];
const bump = (obj, key) => { obj[key] = (obj[key] ?? 0) + 1; };

/** Ό,τι βλέπει ο επισκέπτης για ΜΙΑ παραλία (χωρίς ταίριασμα γειτόνων στον χάρτη — δεν υπάρχουν γείτονες). */
const singleView = (beach, day, profile, hourly) => {
  const s = scoreBeach(beach, day, profile, hourly);
  const windKmh = day.wind.speed * 3.6;
  const ctx = { windKmh, windMs: day.wind.speed, deg: day.wind.deg, beaufort: getBeaufortLevel(windKmh), levels: null };
  return { s, v: visitorView(appMapItem(beach, day, s, profile), s, ctx) };
};

/** Συνθετική μέρα: άνεμος + θάλασσα (Hs, κατεύθυνση, περίοδος αν δοθεί). */
const syntheticDay = ({ windDeg, windKmh, hs, waveDeg, periodS }) => {
  const windMs = windKmh / 3.6;
  const day = createDailyForecast(0, { id: 'calm-witness', label: 'calm-witness', windDirectionDeg: windDeg, windSpeedMs: windMs, windGustMs: windMs * 1.35, waveHeightM: hs, waveDirectionDeg: waveDeg });
  if (typeof periodS === 'number') {
    day.marine.wavePeriodS = periodS;
    for (const h of day.hourly) if (h.marine) h.marine.wavePeriodS = periodS;
  }
  return day;
};

// ══ REPLAY CHILD: μία μέρα, μία παραλία, τρεις παραλλαγές ═══════════════════════════════════════
if (REPLAY_CHILD) {
  const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } = require(path.join(root, 'services/weatherService.ts'));
  const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));
  const id = Number(process.argv[process.argv.indexOf('--replay-child') + 1]);
  const R = loadRegion(TARGETS[id]);
  const beach = R.beaches.find((b) => b.id === id);
  const profile = R.profilesById[id];
  const cluster = buildBeachForecastClusters(R.summary).find((c) => c.beachIds.includes(id));
  const wind = await fetchForecastDataBatch([{ lat: cluster.lat, lon: cluster.lon }]);
  const mp = profile.marineSamplePoint;
  const marine = await fetchMarineForecastDataBatch([{ lat: mp.lat, lon: mp.lon }]);
  const windData = wind.get(forecastPointKey(cluster.lat, cluster.lon))?.data;
  const marineData = marine.get(forecastPointKey(mp.lat, mp.lon))?.data ?? [];
  const out = { id, day: process.env.OPEN_METEO_REPLAY, hours: [] };
  if (!windData) { out.error = 'no wind data'; console.log(`@@${JSON.stringify(out)}`); process.exit(0); }
  const day = processForecastData(mergeMarineForecastData(windData, marineData))?.[0];
  try {
    for (let hour = 9; hour <= 15; hour += 1) {
      const h = day?.hourly?.[hour];
      if (!h) continue;
      const slice = { ...day, ...h, hourly: day.hourly };
      const row = {
        hour, windDeg: slice.wind?.deg, windKmh: Number(((slice.wind?.speed ?? 0) * 3.6).toFixed(1)),
        sea: slice.marine ? { hs: slice.marine.waveHeightM, dir: slice.marine.waveDirectionDeg, tp: slice.marine.wavePeriodS,
          swellHs: slice.marine.swellWaveHeightM, swellDir: slice.marine.swellWaveDirectionDeg } : null,
      };
      const raw = {};
      for (const variant of ['before', 'after', 'protectedOnly']) {
        useVariant(variant);
        const { s, v } = singleView(beach, slice, profile, day.hourly);
        raw[variant] = s;
        row[variant] = { ...v, exposureLevel: s.exposureLevel ?? null, seaStateSource: s.seaStateSource ?? null };
      }
      row.guarded = guardedScore(raw.before, raw.after) === raw.before ? { ...row.before } : { ...row.after };
      out.hours.push(row);
    }
  } finally { useVariant('before'); }
  console.log(`@@${JSON.stringify(out)}`);
  process.exit(0);
}

// ══ ΚΥΡΙΑ ΔΙΕΡΓΑΣΙΑ ══════════════════════════════════════════════════════════════════════════════
const QUICK = process.argv.includes('--quick');
const DO_REPLAY = process.argv.includes('--replay');
const t0 = Date.now();
const report = {
  generatedAt: new Date().toISOString(), script: 'scripts/measureCalmWitnessProposal.mjs',
  proposal: {
    beachId: PROPOSAL.beachId, arc: { centerDeg: PROPOSAL.centerDeg, halfWidthDeg: PROPOSAL.halfWidthDeg, fromDeg: 341, toDeg: 7 },
    arcIsIn: 'the APP\'s wave direction (Open-Meteo marine at profile.marineSamplePoint), not Copernicus',
    kd: `min(geometric K_d, SHADOW_KD_AT_EDGE=${SA.SHADOW_KD_AT_EDGE}) inside the arc`,
    arrival: `resolveSeaArrivalExposureLevel → '${SA.SEA_ARRIVAL_ENCLOSED}' inside the arc (shoreSeaStateM then applies K_d regardless of today's wind level)`,
    guard: 'variant "guarded" (A+G, the recommended form): the witness is NOT applied when score.seaStateSource === \'modeled\' or score.exposureLevel === \'exposed\' — the judge only witnessed the MEASURED arc sea under N/NE wind',
    comparedVariant: 'protectedOnly = same K_d but arrival → \'protected\' (discount still requires a wind-sheltered exposure level)',
    appliesTo: 'profile.beachId === 1334 only; every other beach, and every direction outside [341°, 7°], is untouched',
    productionEquivalent: 'utils/seaArrival.ts: a CALM_WITNESSED_ARRIVAL_ARCS map + an isCalmWitnessedArrivalDirection helper; services/recommendationService.ts: when that helper is true and the sea is measured (seaStateSource !== modeled) and finalExposureLevel !== exposed, pass SEA_ARRIVAL_ENCLOSED to the shore readers (shoreSeaStateM, shoreBreak) instead of the sector level. K_d needs no change: the geometry already gives 0.5 everywhere in [341°, 7°] (control kdGeomInArcNot05).',
  },
};

// ── (1) Γεωμετρία ανά 5° — ίδιες συναρτήσεις/μάσκα με τα αποστελλόμενα προφίλ ──────────────────────
const MASK = path.join(root, '.tmp/geospatial/greece-land-osm-split.geojson');
if (existsSync(MASK)) {
  const builderPath = path.join(root, 'scripts/geospatialExposureProfiles.ts');
  const src = readFileSync(builderPath, 'utf8');
  const cut = src.lastIndexOf('main().catch(');
  const mod = new Module(builderPath, null);
  mod.filename = builderPath;
  mod.paths = Module._nodeModulePaths(path.dirname(builderPath));
  mod._compile(ts.transpileModule(`${src.slice(0, cut)}\nexport { loadLandPolygons, createLandMask, createBeachProfile, maxFetchKm, fanAnglesDeg, nearshoreWaterSearchKm, highResStepKm, highResNearshoreLandGraceKm, highResNearshoreWaterSearchStepKm, nearshoreMinOpenWaterKm };\n`,
    { compilerOptions: TS_OPTIONS, fileName: builderPath }).outputText, builderPath);
  const B = mod.exports;
  const G = require(path.join(root, 'utils/geospatialExposureModel.ts'));
  const mask = B.createLandMask(B.loadLandPolygons(MASK), 'High-resolution coastline (greece-land-osm-split.geojson)', 'high');
  report.geometry5deg = { note: 'ray = ONE ray at 5° with 50 m step (the arrival-fan resolution); fan = the production 5-ray fan (±30°, 200 m step) re-centred every 5°, level via computeDirectionalExposure; shipped = what the engine reads from the shipped 8-sector profile', beaches: {} };
  for (const id of [1334, 601]) {
    const R = loadRegion(TARGETS[id]);
    const beach = R.beaches.find((b) => b.id === id);
    const prof = R.profilesById[id];
    const rebuilt = B.createBeachProfile(beach, undefined, mask, B.highResStepKm, B.highResNearshoreLandGraceKm, B.highResNearshoreWaterSearchStepKm, B.nearshoreMinOpenWaterKm);
    const origin = G.resolveNearshoreWaterOrigin(beach.coordinates, mask, B.nearshoreWaterSearchKm, B.highResNearshoreWaterSearchStepKm, B.nearshoreMinOpenWaterKm);
    const common = { beach: beach.coordinates, landMask: mask, maxFetchKm: B.maxFetchKm, nearshoreLandGraceKm: B.highResNearshoreLandGraceKm,
      nearshoreWaterSearchKm: B.nearshoreWaterSearchKm, nearshoreWaterSearchStepKm: B.highResNearshoreWaterSearchStepKm,
      sampleOrigin: origin.point, sampleOriginAdjustedKm: origin.adjustedKm };
    const rows = [];
    for (let d = 0; d < 360; d += 5) {
      const fan = G.assessGeospatialWindExposure({ ...common, windDirectionDeg: d, stepKm: B.highResStepKm, fanAnglesDeg: B.fanAnglesDeg });
      const ray = G.assessGeospatialWindExposure({ ...common, windDirectionDeg: d, stepKm: 0.05, fanAnglesDeg: [0] }).samples[0];
      const lvl = G.computeDirectionalExposure({ fetchKm: fan.openWaterFetchKm, blockedRayRatio: fan.blockedRayRatio, onshore: G.onshoreComponent(d, prof.facingDeg) });
      const kdGeom = ORIGINAL.kd({ ...prof, beachId: -1 }, d);
      rows.push({ deg: d, rayOpenKm: ray.openWaterKm, rayBlocked: ray.blockedByLand, fanFetchKm: fan.openWaterFetchKm, fanBlocked: fan.blockedRayRatio,
        fanLevel: lvl.level, shippedSector: sectorAt(d), shippedSectorLevel: prof.sectors[sectorAt(d)].level,
        shippedArrival: ORIGINAL.arrival(prof, d) ?? null, kdGeom: typeof kdGeom === 'number' ? Number(kdGeom.toFixed(3)) : null });
    }
    const open = rows.filter((r) => !r.rayBlocked).map((r) => r.deg);
    report.geometry5deg.beaches[id] = {
      rebuiltEqualsShipped: JSON.stringify(rebuilt.sectors) === JSON.stringify(prof.sectors) && rebuilt.facingDeg === prof.facingDeg,
      facingDeg: prof.facingDeg, origin: { lat: origin.point.lat, lon: origin.point.lon, adjustedKm: origin.adjustedKm },
      openToMaxFetchAt5deg: open, rows,
    };
    console.log(`γεωμετρία #${id}: ξαναχτισμένο == αποστελλόμενο: ${report.geometry5deg.beaches[id].rebuiltEqualsShipped} · αφετηρία μετατόπιση ${origin.adjustedKm} χλμ · ανοιχτό ως 25 χλμ ανά 5°: ${open.join(',') || '—'}`);
  }
} else {
  report.geometry5deg = { skipped: `λείπει ${path.relative(root, MASK)} (scripts/fetchHighResLandMask.mjs)` };
}

// ── (2) Μαρτυρίες: τι λέει ο κινητήρας για τη θάλασσα κάθε μαρτυρημένης μέρας ─────────────────────────
const swir = JSON.parse(readFileSync(path.join(root, 'reports/wave-model/shore-surf-swir-check.json'), 'utf8'));
const splitPath = path.join(root, 'reports/wave-model/calm-witness-strip-split.json');
const split = existsSync(splitPath) ? JSON.parse(readFileSync(splitPath, 'utf8')) : null;
report.stripSplit = split
  ? { source: 'reports/wave-model/calm-witness-strip-split.json (scripts/splitShoreSurfStripByCove.py)', ...Object.fromEntries(Object.entries(split.beaches).map(([id, b]) => [id, { stripPixels: b.stripPixels, controlAllEqualsJudge: b.controlAllEqualsJudge, summary: b.summary }])) }
  : { skipped: 'τρέξε πρώτα scripts/splitShoreSurfStripByCove.py' };
const EVIDENCE_WIND = { windDeg: 20, windKmh: 20 };
report.evidence = { syntheticWind: `${EVIDENCE_WIND.windDeg}° ${EVIDENCE_WIND.windKmh} km/h (typical of the witnessed days in the replay); sea = Copernicus MEDSEA 09 UTC of that day (Hs, dir, period)`, beaches: {} };
for (const id of [1334, 601]) {
  const R = loadRegion(TARGETS[id]);
  const beach = R.beaches.find((b) => b.id === id);
  const prof = R.profilesById[id];
  const days = swir.wavy.find((e) => e.id === id)?.evidence ?? [];
  const splitRows = new Map((split?.beaches?.[id]?.rows ?? []).map((r) => [r.day, r]));
  const rows = [];
  try {
    for (const e of days) {
      const sr = splitRows.get(e.day);
      const periodS = sr?.wave?.[2];
      const day = syntheticDay({ ...EVIDENCE_WIND, hs: e.waveM, waveDeg: e.dirDeg, periodS });
      useVariant('before');
      const b = singleView(beach, day, prof);
      useVariant('after');
      const a = singleView(beach, day, prof);
      useVariant('before');
      const arr = SA.resolveSeaArrival(prof, prof.facingDeg, e.dirDeg);
      rows.push({
        day: e.day, cop: { hs: e.waveM, dirDeg: e.dirDeg, periodS: periodS ?? null },
        judge: { beachFoam: e.beachFoam, neighbourFoam: e.neighbourFoam, swirRatio: e.swirRatio,
          ...(sr ? Object.fromEntries(Object.entries(sr).filter(([k]) => ['west', 'east', 'nearPier', 'awayPier', 'westHalf', 'eastHalf'].includes(k))) : {}) },
        geometry: { facingDeg: prof.facingDeg, sector: sectorAt(e.dirDeg), sectorLevel: prof.sectors[sectorAt(e.dirDeg)].level,
          interpolatedFetchKm: Number(interpolateSectorGeometry(prof, e.dirDeg).fetchKm.toFixed(2)),
          onshore: arr ? Number(arr.onshore.toFixed(3)) : null, kdGeom: ORIGINAL.kd({ ...prof, beachId: -1 }, e.dirDeg) ?? null,
          arrival: ORIGINAL.arrival(prof, e.dirDeg) ?? null },
        before: { printed: b.v.printed, fraction: b.v.openWaveM ? Number((Math.min(b.s.shoreDisplayWaveM, b.v.openWaveM) / b.v.openWaveM).toFixed(2)) : null, word: b.v.waveWord, verdict: b.v.verdict, pin: b.v.pinTone, exposureLevel: b.s.exposureLevel },
        ...(id === PROPOSAL.beachId ? { after: { printed: a.v.printed, fraction: a.v.openWaveM ? Number((Math.min(a.s.shoreDisplayWaveM, a.v.openWaveM) / a.v.openWaveM).toFixed(2)) : null, word: a.v.waveWord, verdict: a.v.verdict, pin: a.v.pinTone, arrival: a.v.seaArrival, kd: a.v.kd } } : {}),
      });
    }
  } finally { useVariant('before'); }
  report.evidence.beaches[id] = {
    name: beach.name.gr, facingDeg: prof.facingDeg, confidence: prof.confidence,
    sectors: Object.fromEntries(SECT.map((k) => [k, prof.sectors[k]])), marineSamplePoint: prof.marineSamplePoint ?? null, rows,
  };
  const full = rows.filter((r) => (r.before.fraction ?? 0) >= 0.9).length;
  console.log(`μαρτυρίες #${id}: ${rows.length} μέρες · με θάλασσα Copernicus τυπώνουμε ≥0,9 του ανοιχτού σε ${full}`);
}

// ── (3) Replay: τι ΤΥΠΩΘΗΚΕ με την πρόγνωση της ημέρας ────────────────────────────────────────────
const dstAthens = (d) => new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Athens', timeZoneName: 'short' }).format(new Date(`${d}T12:00:00Z`)).includes('+3');
if (DO_REPLAY) {
  const jobs = [];
  for (const e of swir.wavy.filter((w) => w.id === 1334 || w.id === 601)) for (const x of e.evidence) jobs.push([e.id, x.day]);
  // Καλάμι: και οι υπόλοιπες μέρες με αφρό στη διπλανή ακτή (≥0,3) και Hs ≥0,8 που βρήκε ο διαχωρισμός — όχι μόνο οι 8 του SWIR.
  for (const r of split?.beaches?.['601']?.rows ?? []) {
    if ((r.exposedFoam ?? 0) >= 0.3 && r.wave?.[0] >= 0.8 && !jobs.some(([i, d]) => i === 601 && d === r.day)) jobs.push([601, r.day]);
  }
  const env = { ...process.env, OPEN_METEO_REPLAY_SHIFT: '1' };
  delete env.OPEN_METEO_API_KEY; // το πλάνο μας δεν περνάει στο historical-forecast (403) — δωρεάν host
  delete env.OPEN_METEO_REPLAY_CLOCK;
  const results = [];
  for (const [id, day] of jobs) {
    const res = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--replay-child', String(id)], { cwd: root, env: { ...env, OPEN_METEO_REPLAY: day }, encoding: 'utf8', timeout: 180000 });
    const line = (res.stdout || '').split('\n').find((l) => l.startsWith('@@'));
    results.push(line ? JSON.parse(line.slice(2)) : { id, day, error: (res.stderr || '').slice(-300) });
    process.stderr.write(`\r  replay ${results.length}/${jobs.length}   `);
  }
  process.stderr.write('\n');
  const summarize = (id) => {
    const rs = results.filter((r) => r.id === id && !r.error);
    const overpass = rs.map((r) => ({ day: r.day, hour: dstAthens(r.day) ? 12 : 11, row: r.hours.find((h) => h.hour === (dstAthens(r.day) ? 12 : 11)) })).filter((x) => x.row);
    const agg = { daysReplayed: rs.length, errors: results.filter((r) => r.id === id && r.error).map((r) => ({ day: r.day, error: r.error })), overpass: [] };
    const counts = { fullPrint: 0, verdictBefore: {}, verdictAfter: {}, verdictGuarded: {}, verdictProtectedOnly: {}, printedDown: 0, printedDownGuarded: 0,
      printedDownProtectedOnly: 0, wordMoves: {}, pinMoves: {}, chipMoves: {}, warningMoves: {}, guardedVerdictMoves: {}, guardedPinMoves: {}, appDirs: [] };
    for (const { day, hour, row } of overpass) {
      const b = row.before; const a = row.after; const g = row.guarded; const p = row.protectedOnly;
      if (b.openWaveM && Math.min(b.shoreDisplayWaveM, b.openWaveM) / b.openWaveM >= 0.9) counts.fullPrint += 1;
      bump(counts.verdictBefore, b.verdict); bump(counts.verdictAfter, a.verdict); bump(counts.verdictGuarded, g.verdict); bump(counts.verdictProtectedOnly, p.verdict);
      if ((a.printed ?? 0) < (b.printed ?? 0)) counts.printedDown += 1;
      if ((g.printed ?? 0) < (b.printed ?? 0)) counts.printedDownGuarded += 1;
      if ((p.printed ?? 0) < (b.printed ?? 0)) counts.printedDownProtectedOnly += 1;
      if (a.waveWord !== b.waveWord) bump(counts.wordMoves, `${b.waveWord} → ${a.waveWord}`);
      if (a.pinTone !== b.pinTone) bump(counts.pinMoves, `${b.pinTone} → ${a.pinTone}`);
      if (a.chipTone !== b.chipTone) bump(counts.chipMoves, `${b.chipTone} → ${a.chipTone}`);
      if (a.warnings !== b.warnings) bump(counts.warningMoves, `${b.warnings || '—'} → ${a.warnings || '—'}`);
      if (g.verdict !== b.verdict) bump(counts.guardedVerdictMoves, `${b.verdict} → ${g.verdict}`);
      if (g.pinTone !== b.pinTone) bump(counts.guardedPinMoves, `${b.pinTone} → ${g.pinTone}`);
      if (row.sea?.dir != null) counts.appDirs.push(row.sea.dir);
      agg.overpass.push({ day, hour, wind: `${row.windDeg}° ${row.windKmh} km/h`, exposureLevel: b.exposureLevel, seaStateSource: b.seaStateSource, appSea: row.sea,
        before: { printed: b.printed, word: b.waveWord, verdict: b.verdict, pin: b.pinTone, chip: b.chipTone, arrival: b.seaArrival, kd: b.kd, warnings: b.warnings },
        after: { printed: a.printed, word: a.waveWord, verdict: a.verdict, pin: a.pinTone, chip: a.chipTone, arrival: a.seaArrival, kd: a.kd, warnings: a.warnings },
        guarded: { printed: g.printed, word: g.waveWord, verdict: g.verdict, pin: g.pinTone },
        protectedOnly: { printed: p.printed, verdict: p.verdict } });
    }
    counts.appDirs.sort((x, y) => ((x + 180) % 360) - ((y + 180) % 360));
    agg.overpassCounts = counts;
    // Όλες οι ώρες 9-15, όχι μόνο η ώρα λήψης — πόσες αλλάζουν και έξω από το τόξο (πρέπει 0).
    let hoursAll = 0; let hoursChanged = 0; let hoursChangedGuarded = 0; let changedOutsideArc = 0; let sourceDiffers = 0;
    for (const r of rs) for (const h of r.hours) {
      hoursAll += 1;
      const changed = VIEW_KEYS.some((k) => h.before[k] !== h.after[k]);
      if (changed) hoursChanged += 1;
      if (VIEW_KEYS.some((k) => h.before[k] !== h.guarded[k])) hoursChangedGuarded += 1;
      if (h.before.seaStateSource !== h.after.seaStateSource || h.before.exposureLevel !== h.after.exposureLevel) sourceDiffers += 1;
      if (changed && !(h.sea && angDist(h.sea.dir, PROPOSAL.centerDeg) <= PROPOSAL.halfWidthDeg)) changedOutsideArc += 1;
    }
    Object.assign(agg, { hoursAll, hoursChanged, hoursChangedGuarded, changedOutsideArc, seaStateSourceDiffersBeforeAfter: sourceDiffers });
    return agg;
  };
  report.replay = {
    method: 'scripts/lib/replayOpenMeteo.mjs (OPEN_METEO_REPLAY=<day>, SHIFT=1, free archive hosts) → services/weatherService fetch of the beach\'s own forecast cluster + profile.marineSamplePoint → utils/weatherUtils.processForecastData → calculateBeachScore; overpass hour = 12 (EEST) / 11 (EET) local',
    1334: summarize(1334), 601: summarize(601),
  };
  const rc = report.replay[1334].overpassCounts;
  console.log(`replay #1334: ${report.replay[1334].daysReplayed} μέρες · ώρα λήψης, τυπώναμε ≥0,9 του ανοιχτού: ${rc.fullPrint} · ετυμηγορία ΠΡΙΝ ${JSON.stringify(rc.verdictBefore)} → ΜΕΤΑ ${JSON.stringify(rc.verdictAfter)} · ΜΕΤΑ+φράχτης ${JSON.stringify(rc.verdictGuarded)} · protectedOnly ${JSON.stringify(rc.verdictProtectedOnly)}`);
  console.log(`replay #601: ${report.replay[601].daysReplayed} μέρες · ώρα λήψης, τυπώναμε ≥0,9 του ανοιχτού: ${report.replay[601].overpassCounts.fullPrint} · κατευθύνσεις εφαρμογής ${report.replay[601].overpassCounts.appDirs.join(',')}`);
} else {
  report.replay = { skipped: 'τρέξε με --replay' };
}

// ── (4) Πλέγμα σε ΟΛΗ τη Λέσβο: ΠΡΙΝ / ΜΕΤΑ / ΜΕΤΑ-ξανά ───────────────────────────────────────────
const L = loadRegion(TARGETS[PROPOSAL.beachId]);
const TARGET = PROPOSAL.beachId;
const nameOf = (id) => L.beaches.find((b) => b.id === id)?.name?.gr ?? String(id);
const DIRS = QUICK ? [300, 340, 345, 350, 355, 0, 5, 10, 90] : Array.from({ length: 72 }, (_, i) => i * 5);
const HS_M = QUICK ? [1.1] : [0.5, 0.8, 1.1, 1.5, 2.0];
const grid = [];
for (const waveDeg of DIRS) for (const hs of HS_M) {
  for (const windKmh of (QUICK ? [25] : [15, 25, 35])) grid.push({ regime: 'same-dir', waveDeg, windDeg: waveDeg, windKmh, hs });
  grid.push({ regime: 'nne-20', waveDeg, windDeg: 20, windKmh: 20, hs });
  grid.push({ regime: 'onshore-w-270', waveDeg, windDeg: 270, windKmh: 30, hs });
}
const assemble = (scores, day, ctx, { fresh = false } = {}) => {
  const items = L.beaches.map((b) => appMapItem(b, day, scores.get(b.id), L.profilesById[b.id]));
  const levels = getConsistentVisibleMapExposureLevels(items, ctx.beaufort, ctx.deg, ctx.perBeachWind);
  const views = new Map(items.map((item) => [item.beachId, visitorView(item, scores.get(item.beachId), { ...ctx, levels })]));
  const list = getSuitableBeaches(L.beaches, day, 'gr', undefined, day.hourly, undefined, undefined, L.profilesById, scores).map((x) => x.beachId);
  const freshList = fresh ? getSuitableBeaches(L.beaches, day, 'gr', undefined, day.hourly, undefined, undefined, L.profilesById).map((x) => x.beachId) : null;
  return { scores, views, list, freshList, levels };
};
const runVariant = (variant, day, ctx, opts = {}) => {
  useVariant(variant);
  const scores = new Map(L.beaches.map((b) => [b.id, scoreBeach(b, day, L.profilesById[b.id])]));
  return assemble(scores, day, ctx, opts);
};
const newTarget = () => ({ changedRows: [], changedOutsideArc: 0, rawChangedOutsideArc: 0, tiers: {}, printedDown: 0, printedUp: 0, verdictMoves: {}, wordMoves: {}, pinMoves: {}, pinWiredMoves: {}, chipMoves: {}, warningMoves: {}, byRegime: {}, rowsInArc: 0 });
const newPodium = () => ({ rowsCompared: 0, top3Changed: 0, targetEntersTop3: 0, targetLeavesTop3: 0, listEnter: 0, listLeave: 0, othersRelativeOrderChanged: 0, outsideArcListChanged: 0, examples: [] });
const newOthers = () => ({ beachRowPairs: 0, changedPairs: 0, changedBeaches: new Set(), examples: [] });
const cmp = { after: { target: newTarget(), podium: newPodium(), others: newOthers() }, guarded: { target: newTarget(), podium: newPodium(), others: newOthers() } };
let protectedOnlyPrintedChanges = 0;
const controls = { determinismDiffs: 0, freshVsPrecomputedDiffs: 0, freshRowsChecked: 0, patchSeenInArc: 0, patchMissedInArc: 0, kdOutsideArcMismatch: 0, kdGeomInArcNot05: 0, seaStateSourceDiffers: 0 };
const tierOf = (keys) => (keys.some((k) => SHOWN_KEYS.includes(k)) ? 'shown' : keys.includes('pinToneWired') ? 'pin-if-wired'
  : keys.includes('finalScore') ? 'score-only' : keys.includes('shoreDisplayWaveM') ? 'shore-number-only' : keys.length ? 'kd-or-arrival-only' : 'raw-score-only');
/** ΠΡΙΝ vs μια παραλλαγή: η παραλία-στόχος, το βάθρο, και κάθε άλλη παραλία της Λέσβου. */
const compare = (acc, row, arc, before, v, extra = {}) => {
  const { target, podium, others } = acc;
  const vb = before.views.get(TARGET);
  const va = v.views.get(TARGET);
  const diff = VIEW_KEYS.filter((k) => vb[k] !== va[k]);
  const raw = JSON.stringify(before.scores.get(TARGET)) !== JSON.stringify(v.scores.get(TARGET));
  if (arc) target.rowsInArc += 1;
  if (diff.length || raw) {
    const tier = tierOf(diff);
    bump(target.tiers, tier);
    bump(target.byRegime, row.regime);
    if (!arc) target.changedOutsideArc += 1;
    target.changedRows.push({ ...row, inArc: arc, tier, changed: diff, before: vb, after: va, seaStateSource: before.scores.get(TARGET)?.seaStateSource ?? null,
      rankBefore: before.list.indexOf(TARGET), rankAfter: v.list.indexOf(TARGET), ...extra });
  }
  if (raw && !arc) target.rawChangedOutsideArc += 1;
  if (vb.printed !== va.printed) { if ((va.printed ?? 0) < (vb.printed ?? 0)) target.printedDown += 1; else target.printedUp += 1; }
  if (vb.verdict !== va.verdict) bump(target.verdictMoves, `${vb.verdict} → ${va.verdict}`);
  if (vb.waveWord !== va.waveWord) bump(target.wordMoves, `${vb.waveWord} → ${va.waveWord}`);
  if (vb.pinTone !== va.pinTone) bump(target.pinMoves, `${vb.pinTone} → ${va.pinTone}`);
  if (vb.pinToneWired !== va.pinToneWired) bump(target.pinWiredMoves, `${vb.pinToneWired} → ${va.pinToneWired}`);
  if (vb.chipTone !== va.chipTone) bump(target.chipMoves, `${vb.chipTone} → ${va.chipTone}`);
  if (vb.warnings !== va.warnings) bump(target.warningMoves, `${vb.warnings || '—'} → ${va.warnings || '—'}`);
  podium.rowsCompared += 1;
  const rB = before.list.indexOf(TARGET); const rA = v.list.indexOf(TARGET);
  const t3 = JSON.stringify(before.list.slice(0, 3)) !== JSON.stringify(v.list.slice(0, 3));
  if (t3) podium.top3Changed += 1;
  if (!(rB >= 0 && rB < 3) && rA >= 0 && rA < 3) podium.targetEntersTop3 += 1;
  if (rB >= 0 && rB < 3 && !(rA >= 0 && rA < 3)) podium.targetLeavesTop3 += 1;
  if (rB < 0 && rA >= 0) podium.listEnter += 1;
  if (rB >= 0 && rA < 0) podium.listLeave += 1;
  if (JSON.stringify(before.list.filter((x) => x !== TARGET)) !== JSON.stringify(v.list.filter((x) => x !== TARGET))) podium.othersRelativeOrderChanged += 1;
  if (!arc && JSON.stringify(before.list) !== JSON.stringify(v.list)) podium.outsideArcListChanged += 1;
  if ((t3 || rB !== rA) && podium.examples.length < 15) {
    podium.examples.push({ ...row, rankBefore: rB, rankAfter: rA, top3Before: before.list.slice(0, 3).map(nameOf), top3After: v.list.slice(0, 3).map(nameOf), listSizeBefore: before.list.length, listSizeAfter: v.list.length });
  }
  for (const b of L.beaches) {
    if (b.id === TARGET) continue;
    others.beachRowPairs += 1;
    if (JSON.stringify(before.scores.get(b.id)) !== JSON.stringify(v.scores.get(b.id)) || JSON.stringify(before.views.get(b.id)) !== JSON.stringify(v.views.get(b.id))) {
      others.changedPairs += 1; others.changedBeaches.add(b.id);
      if (others.examples.length < 10) others.examples.push({ beachId: b.id, name: nameOf(b.id), row });
    }
  }
};
try {
  grid.forEach((row, index) => {
    const day = syntheticDay({ windDeg: row.windDeg, windKmh: row.windKmh, hs: row.hs, waveDeg: row.waveDeg });
    const beaufort = getBeaufortLevel(day.wind.speed * 3.6);
    const ctx = { windKmh: day.wind.speed * 3.6, windMs: day.wind.speed, deg: day.wind.deg, beaufort,
      perBeachWind: new Map(L.beaches.map((b) => [b.id, { beaufort, directionDeg: day.wind.deg }])) };
    const arc = angDist(row.waveDeg, PROPOSAL.centerDeg) <= PROPOSAL.halfWidthDeg;
    const checkFresh = arc && row.regime !== 'onshore-w-270';
    const after = runVariant('after', day, ctx, { fresh: checkFresh });
    const before = runVariant('before', day, ctx, { fresh: checkFresh });
    const again = runVariant('after', day, ctx);
    useVariant('before');
    const guarded = assemble(new Map(L.beaches.map((b) => [b.id, guardedScore(before.scores.get(b.id), after.scores.get(b.id))])), day, ctx);
    let protectedOnly = null;
    if (arc) {
      useVariant('protectedOnly');
      const tb = L.beaches.find((x) => x.id === TARGET);
      const s = scoreBeach(tb, day, L.profilesById[TARGET]);
      protectedOnly = visitorView(appMapItem(tb, day, s, L.profilesById[TARGET]), s, { ...ctx, levels: before.levels });
      useVariant('before');
      if (protectedOnly.printed !== before.views.get(TARGET).printed) protectedOnlyPrintedChanges += 1;
    }
    // Έλεγχοι
    for (const b of L.beaches) {
      if (JSON.stringify(after.scores.get(b.id)) !== JSON.stringify(again.scores.get(b.id)) || JSON.stringify(after.views.get(b.id)) !== JSON.stringify(again.views.get(b.id))) controls.determinismDiffs += 1;
      if ((before.scores.get(b.id)?.seaStateSource ?? null) !== (after.scores.get(b.id)?.seaStateSource ?? null)
        || (before.scores.get(b.id)?.exposureLevel ?? null) !== (after.scores.get(b.id)?.exposureLevel ?? null)) controls.seaStateSourceDiffers += 1;
    }
    if (JSON.stringify(after.list) !== JSON.stringify(again.list)) controls.determinismDiffs += 1;
    if (checkFresh) {
      controls.freshRowsChecked += 1;
      if (JSON.stringify(after.list) !== JSON.stringify(after.freshList)) controls.freshVsPrecomputedDiffs += 1;
      if (JSON.stringify(before.list) !== JSON.stringify(before.freshList)) controls.freshVsPrecomputedDiffs += 1;
    }
    const vb = before.views.get(TARGET);
    const va = after.views.get(TARGET);
    if (arc) {
      if (va.seaArrival === SA.SEA_ARRIVAL_ENCLOSED && va.kd === PROPOSAL.kdInArc) controls.patchSeenInArc += 1; else controls.patchMissedInArc += 1;
      if (vb.kd !== PROPOSAL.kdInArc) controls.kdGeomInArcNot05 += 1;
    } else if (va.kd !== vb.kd || va.seaArrival !== vb.seaArrival) controls.kdOutsideArcMismatch += 1;
    compare(cmp.after, row, arc, before, after, { protectedOnly: protectedOnly ? { printed: protectedOnly.printed, verdict: protectedOnly.verdict } : null });
    compare(cmp.guarded, row, arc, before, guarded);
    if ((index + 1) % 100 === 0) process.stderr.write(`\r  πλέγμα ${index + 1}/${grid.length} · ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
  });
} finally { useVariant('before'); }
process.stderr.write('\n');

// ── Άκρες του τόξου ανά 1° (μόνο #1334) ─────────────────────────────────────────────────────────
const edge = [];
{
  const b = L.beaches.find((x) => x.id === TARGET); const prof = L.profilesById[TARGET];
  try {
    for (let d = 330; d <= 380; d += 1) {
      const deg = d % 360;
      for (const reg of [{ regime: 'same-dir-25', windDeg: deg, windKmh: 25 }, { regime: 'nne-20', windDeg: 20, windKmh: 20 }]) {
        const day = syntheticDay({ windDeg: reg.windDeg, windKmh: reg.windKmh, hs: 1.1, waveDeg: deg });
        useVariant('before'); const vb = singleView(b, day, prof).v;
        useVariant('after'); const va = singleView(b, day, prof).v;
        edge.push({ waveDeg: deg, regime: reg.regime, inArc: angDist(deg, PROPOSAL.centerDeg) <= PROPOSAL.halfWidthDeg,
          before: { printed: vb.printed, word: vb.waveWord, verdict: vb.verdict, arrival: vb.seaArrival, kd: vb.kd },
          after: { printed: va.printed, word: va.waveWord, verdict: va.verdict, arrival: va.seaArrival, kd: va.kd },
          changed: VIEW_KEYS.some((k) => vb[k] !== va[k]) });
      }
    }
  } finally { useVariant('before'); }
}
const edgeLeaks = edge.filter((e) => !e.inArc && e.changed).length;

// ── Άλλες περιοχές: η πρόταση κλειδώνει στο beachId — έλεγχος στα Χανιά (90 παραλίες, όπου το Καλάμι) ──
const C = loadRegion(TARGETS[601]);
let chaniaPairs = 0; let chaniaChanged = 0;
try {
  for (const waveDeg of [0, 15, 30, 345]) for (const hs of [0.8, 1.5]) {
    const day = syntheticDay({ windDeg: waveDeg, windKmh: 25, hs, waveDeg });
    for (const b of C.beaches) {
      useVariant('before'); const x = JSON.stringify(scoreBeach(b, day, C.profilesById[b.id]));
      useVariant('after'); const y = JSON.stringify(scoreBeach(b, day, C.profilesById[b.id]));
      chaniaPairs += 1; if (x !== y) chaniaChanged += 1;
    }
  }
} finally { useVariant('before'); }
// Η «γεωμετρική» ανάγνωση (beachId -1, όπως το exportGeometricShadowKd και η πύλη Δ0) δεν βλέπει την πρόταση.
useVariant('after');
const geomViewUntouched = [345, 350, 0, 5].every((d) => SA.resolveShoreShadowDamping({ ...L.profilesById[TARGET], beachId: -1 }, d) === ORIGINAL.kd({ ...L.profilesById[TARGET], beachId: -1 }, d));
useVariant('before');

const pickRow = (r) => ({ regime: r.regime, waveDeg: r.waveDeg, windDeg: r.windDeg, windKmh: r.windKmh, hs: r.hs, inArc: r.inArc, tier: r.tier, changed: r.changed, seaStateSource: r.seaStateSource,
  before: { printed: r.before.printed, word: r.before.waveWord, verdict: r.before.verdict, pin: r.before.pinTone, chip: r.before.chipTone, arrival: r.before.seaArrival, kd: r.before.kd, warnings: r.before.warnings, score: r.before.finalScore },
  after: { printed: r.after.printed, word: r.after.waveWord, verdict: r.after.verdict, pin: r.after.pinTone, chip: r.after.chipTone, arrival: r.after.seaArrival, kd: r.after.kd, warnings: r.after.warnings, score: r.after.finalScore },
  ...(r.protectedOnly !== undefined ? { protectedOnly: r.protectedOnly } : {}), rankBefore: r.rankBefore, rankAfter: r.rankAfter });
const summarizeVariant = ({ target, podium, others }) => ({
  target: {
    id: TARGET, name: nameOf(TARGET), rowsInArc: target.rowsInArc, rowsChanged: target.changedRows.length, changedOutsideArc: target.changedOutsideArc,
    rawScoreChangedOutsideArc: target.rawChangedOutsideArc, tiers: target.tiers, byRegime: target.byRegime, printedDown: target.printedDown, printedUp: target.printedUp,
    verdictMoves: target.verdictMoves, wordMoves: target.wordMoves, pinMoves: target.pinMoves, pinWiredMoves: target.pinWiredMoves,
    chipMoves: target.chipMoves, warningMoves: target.warningMoves, changedRows: target.changedRows.map(pickRow),
  },
  podium,
  otherBeaches: { beachRowPairs: others.beachRowPairs, changedPairs: others.changedPairs, changedBeaches: [...others.changedBeaches], examples: others.examples },
});
report.grid = {
  region: L.region, beaches: L.beaches.length, scenarios: grid.length,
  regimes: { 'same-dir': 'wind from the wave direction at 15/25/35 km/h', 'nne-20': 'wind 20° at 20 km/h (the witnessed-day regime) with every wave direction', 'onshore-w-270': 'wind 270° at 30 km/h (onshore through the OPEN corridor) with every wave direction — edge case for the wind bypass' },
  waveDirectionsDeg: QUICK ? DIRS : '0..355 step 5', hsM: HS_M, weather: 'utils/weatherFixtures.createDailyForecast day 0 (swell = max(0.2, 0.35×Hs) from the wave direction, period 4/5 s)',
  variants: {
    after: { meaning: 'proposal A — arc only (arrival → enclosed, K_d = 0.5 inside [341°, 7°])', ...summarizeVariant(cmp.after) },
    guarded: { meaning: 'proposal A+G — as A, but NOT when score.seaStateSource === \'modeled\' (shore number = wind model) or score.exposureLevel === \'exposed\' (today\'s wind blows in through an open sector)', ...summarizeVariant(cmp.guarded) },
  },
  protectedOnlyPrintedChanges,
  otherRegionCheck: { region: C.region, beachScenarioPairs: chaniaPairs, changed: chaniaChanged },
  controls: { ...controls, geometricViewUntouched: geomViewUntouched },
};
report.edgeSweep = { note: 'beach #1334 only, Hs 1.1 m, 1° steps 330°..20°, proposal A (the guard only removes changes)', leaksOutsideArc: edgeLeaks, rows: edge };

const out = path.join(root, 'reports/wave-model/calm-witness-proposal.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);

console.log(`\nπλέγμα Λέσβου: ${grid.length} σενάρια × ${L.beaches.length} παραλίες · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
for (const [name, acc] of Object.entries(cmp)) {
  const { target, podium, others } = acc;
  console.log(`  [${name}] #${TARGET}: αλλάζουν ${target.changedRows.length} (σενάρια στο τόξο ${target.rowsInArc}) · ΕΞΩ από το τόξο ${target.changedOutsideArc} · ${JSON.stringify(target.byRegime)} · επίπεδα ${JSON.stringify(target.tiers)}`);
  console.log(`     τυπωμένο κάτω ${target.printedDown} / πάνω ${target.printedUp} · ετυμηγορία ${JSON.stringify(target.verdictMoves)} · λέξη ${JSON.stringify(target.wordMoves)}`);
  console.log(`     πινέζα ${JSON.stringify(target.pinMoves)} · τσιπ ${JSON.stringify(target.chipMoves)} · προειδοποιήσεις ${JSON.stringify(target.warningMoves)}`);
  console.log(`     βάθρο: 3 πρώτες άλλαξαν ${podium.top3Changed} · μπαίνει ${podium.targetEntersTop3} / βγαίνει ${podium.targetLeavesTop3} · κατάλογος +${podium.listEnter}/-${podium.listLeave} · σειρά ΑΛΛΩΝ ${podium.othersRelativeOrderChanged} · άλλες παραλίες ${others.changedPairs}/${others.beachRowPairs}`);
}
console.log(`  protectedOnly άλλαξε τυπωμένο σε ${protectedOnlyPrintedChanges} σενάρια · Χανιά ${chaniaChanged}/${chaniaPairs} · άκρες τόξου διαρροή ${edgeLeaks}`);
console.log(`  έλεγχοι: ντετερμινισμός ${controls.determinismDiffs} · κατάλογος έτοιμα==μόνος ${controls.freshVsPrecomputedDiffs}/${controls.freshRowsChecked} · πρόταση ορατή ${controls.patchSeenInArc}/${controls.patchSeenInArc + controls.patchMissedInArc} · K_d γεωμ. ≠0,5 στο τόξο ${controls.kdGeomInArcNot05} · K_d/άφιξη έξω ${controls.kdOutsideArcMismatch} · seaStateSource/exposureLevel ΠΡΙΝ≠ΜΕΤΑ ${controls.seaStateSourceDiffers} · γεωμετρική ανάγνωση ανέγγιχτη ${geomViewUntouched}`);
console.log(`Αναφορά: ${path.relative(root, out)}`);

const failed = Object.values(cmp).some(({ target, others }) => target.changedOutsideArc || target.rawChangedOutsideArc || others.changedPairs)
  || chaniaChanged || edgeLeaks || controls.determinismDiffs || controls.freshVsPrecomputedDiffs || controls.patchMissedInArc
  || controls.kdOutsideArcMismatch || controls.seaStateSourceDiffers || !geomViewUntouched || !cmp.after.target.changedRows.length;
if (failed) { console.error('ΑΠΟΤΥΧΙΑ ελέγχου — δες την αναφορά.'); process.exit(1); }
