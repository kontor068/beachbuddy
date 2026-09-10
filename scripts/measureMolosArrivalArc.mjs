#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΣΤΗΝ ΟΘΟΝΗ ΤΟ ΤΟΞΟ ΤΟΥ ΜΩΛΟΥ — ΚΑΙ ΑΠΟΔΕΙΞΗ ΟΤΙ ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ ΑΛΛΟ (11/09/2026, βίβλος §Γ77).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το utils/seaArrival.JUDGE_WITNESSED_ARRIVAL_ARCS βάζει πάτωμα K_d ≥ 0,5 στον Μώλο
 * Πάρου #2040 ΜΟΝΟ για κύμα από 0-30°. Ως τότε ο κανόνας της «τσέπης» ('enclosed') τύπωνε 0,1 του
 * ανοιχτού κύματος στις 11-25°, ενώ στις 5-12° και από τις 26° τύπωνε ολόκληρο το ύψος — και ο
 * Sentinel-2 είδε αφρό θραύσης ακριβώς μέσα σε αυτή την «τρύπα». Η πύλη
 * (scripts/validateShoreShadowContract.mjs, Δ0β) αποδεικνύει ότι το K_d κάνει αυτό που λέει. ΔΕΝ λέει
 * τι διαβάζει ο επισκέπτης: ο αριθμός περνάει από ταβάνι και δάπεδο 0,10 μ. πριν τυπωθεί, η λέξη έχει
 * δικά της σκαλοπάτια, η πινέζα δική της σκάλα, και το βάθρο ταξινομεί 39 παραλίες μαζί. Αυτό εδώ το
 * μετράει ΜΕΣΑ από τον πραγματικό κινητήρα, χωρίς να αγγίζει ούτε μία γραμμή παραγωγής.
 *
 * ΠΩΣ. ΠΡΙΝ και ΜΕΤΑ στην ΙΔΙΑ διεργασία, από τον ΙΔΙΟ κώδικα: το τόξο είναι Map την ώρα που τρέχει —
 * ΜΕΤΑ = όπως είναι, ΠΡΙΝ = .delete(2040), και ξαναμπαίνει αμέσως μετά (και σε σφάλμα). Κάθε σενάριο
 * τρέχει ΜΕΤΑ → ΠΡΙΝ → ΜΕΤΑ ξανά· το δεύτερο ΜΕΤΑ πρέπει να βγει ίδιο με το πρώτο (έλεγχος ότι ο
 * διακόπτης είναι καθαρός και ο κινητήρας ντετερμινιστικός). Καιρός: utils/weatherFixtures.
 * createDailyForecast (μέρα 0). Πλέγμα: κύμα 0..355° ανά 5° × Hs {0,5 · 0,8 · 1,1 · 1,5 · 2,0} ×
 * άνεμος {15 · 25 · 35 χλμ/ώ} από την ΙΔΙΑ μεριά (μελτέμι), συν καθεστώς απόγειου: άνεμος 270° στα
 * 20 χλμ/ώ με το κύμα από 0..355°. Σε κάθε σενάριο βαθμολογείται ΟΛΗ η Πάρος και διαβάζονται:
 *   • ο ΤΥΠΩΜΕΝΟΣ αριθμός — utils/beachConditionsReadout.buildBeachConditionsReadout, η συνάρτηση που
 *     καλεί η κάρτα (components/BeachCard.tsx), με τα πεδία που της δίνει το App: shoreDisplayWaveM, με
 *     ταβάνι το waveHeightM (ποτέ πάνω από το ανοιχτό) και δάπεδο 0,10 μ. Η σελίδα παραλίας
 *     (pages/BeachDetailPage.tsx, `shoreWaveHeightM`) κάνει το ίδιο min(shoreDisplayWaveM, waveHeightM).
 *   • η ΛΕΞΗ του κύματος — utils/conditionsFeelPhrase.buildConditionsFeel μέσα από το ίδιο readout (ελληνικά).
 *   • το ΧΡΩΜΑ της πινέζας — utils/suitabilityTone.resolveConditionTone με ΑΚΡΙΒΩΣ τα ορίσματα του
 *     components/BeachMap.tsx (beachToneInput), πάνω σε αντικείμενα χτισμένα όπως τα χτίζει το App.tsx
 *     (mapSuitableBeaches) και με το ταίριασμα γειτόνων getConsistentVisibleMapExposureLevels.
 *     ⚠️ Τα αντικείμενα του App.tsx ΔΕΝ κουβαλούν `shoreShadowDamping`, οπότε η πινέζα στην παραγωγή
 *     παίρνει undefined → το ιστορικό 0,5. Μετριούνται ΔΥΟ χρώματα: `pinTone` (ό,τι βγαίνει σήμερα) και
 *     `pinToneWired` (αν το αντικείμενο κουβαλούσε το K_d του score, όπως υποθέτει η πύλη Ε).
 *   • το χρώμα του ΤΣΙΠ της κάρτας — score.simpleWindSuitability.suitabilityColor.
 *   • η ΕΤΥΜΗΓΟΡΙΑ κολύμβησης — score.swimmingComfort.
 *   • το ΒΑΘΡΟ — services/recommendationService.getSuitableBeaches για όλη την Πάρο (3 πρώτες + σειρά).
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ, ΚΑΙ ΠΡΕΠΕΙ ΝΑ ΜΕΙΝΕΙ ΓΡΑΜΜΕΝΟ:
 *  - Δεν λέει αν το 0,5 είναι ΣΩΣΤΟ. Αυτό το κρίνει η παρατήρηση στην άμμο (§Γ75/§Γ77), όχι ο κώδικας.
 *  - Συνθετικός καιρός: ένας άνεμος για όλη την Πάρο, ίδιος όλες τις ώρες, ρεστία = 0,35×Hs από την
 *    ίδια μεριά. Όχι αληθινή μέρα, όχι αρχείο προγνώσεων, όχι σημείο θάλασσας ανά παραλία.
 *  - Το «βάθρο» εδώ είναι οι 3 πρώτες της getSuitableBeaches. Το βάθρο του App περνάει και από φίλτρα
 *    χρώματος, προφίλ επισκέπτη και ποικιλία ημέρας — δεν ξαναχτίζονται.
 *  - Μέρα 0 = «σήμερα» με το ρολόι της Αθήνας· δεν δοκιμάζονται άλλες ώρες του διακόπτη.
 *
 * ΜΕΤΡΗΘΗΚΕ 11/09/2026 (1.440 σενάρια × 39 παραλίες, reports/wave-model/molos-arrival-arc-impact.json):
 * 140 σενάρια αγγίζουν το score του Μώλου, ΟΛΑ με κύμα 0-30°. Τα 42 αλλάζουν τυπωμένο αριθμό ΚΑΙ λέξη
 * (π.χ. μελτέμι 25 χλμ/ώ, 1,1 μ. από 15°: «Θάλασσα λάδι ~0,1 μ.» → «Λίγο κύμα 0,6 μ.»), πάντα προς τα
 * πάνω και πάντα δίπλα σε ετυμηγορία που ΗΔΗ έλεγε «μην κολυμπήσεις». 0 ετυμηγορίες, 0 χρώματα
 * πινέζας/τσιπ, 0 αλλαγές βάθρου· 0 αλλαγές σε όλες τις άλλες 38 παραλίες της Πάρου.
 * ΟΡΙΟ ΠΟΥ ΦΑΝΗΚΕ: με ασθενή άνεμο (15 χλμ/ώ) και ρεστία κάτω από 0,5 μ. η κάρτα κόβει τον αριθμό
 * στο ύψος του φρουρού όρμου (0,1 μ.)· εκεί αλλάζει μόνο ο βαθμός (41 → 29), όχι αυτό που τυπώνεται.
 *
 *   node scripts/measureMolosArrivalArc.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile('exports.getNegativeFeedbackCount=()=>0;exports.recordOpenMeteoCall=()=>{};', filename);
    return;
  }
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

// Η ΙΔΙΑ εγγραφή του require-cache που φορτώνει και το scoring — αλλιώς το .delete() θα άγγιζε ένα
// δεύτερο αντίγραφο του Map και το ΠΡΙΝ θα έβγαινε σιωπηλά ίδιο με το ΜΕΤΑ. Ελέγχεται παρακάτω (K_d).
const { JUDGE_WITNESSED_ARRIVAL_ARCS, resolveShoreShadowDamping, SHADOW_KD_AT_EDGE } = require(path.join(root, 'utils/seaArrival.ts'));
const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
const { calculateBeachScore, getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
const { buildBeachConditionsReadout } = require(path.join(root, 'utils/beachConditionsReadout.ts'));
const { waveFeelLevelWithArrival } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { seaStateSeverityM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { holdsFlatWaterUnderOffshoreWind, holdsGlassWaterAtFourBeaufort, hasDownwindSeaSample } =
  require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { getConsistentVisibleMapExposureLevels, getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { getBeaufortLevel, degToCompass } = require(path.join(root, 'utils/weatherUtils.ts'));

const REGION = 'south-aegean-paros';
const MOLOS = 2040;
const beaches = JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${REGION}.json`), 'utf8')).island.beaches;
const profilesById = {};
for (const p of Object.values(JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/exposure', `${REGION}.json`), 'utf8')).profiles ?? {})) {
  if (p?.beachId != null) profilesById[p.beachId] = p;
}
const nameOf = (id) => beaches.find((b) => b.id === id)?.name?.gr ?? String(id);

const ARC = JUDGE_WITNESSED_ARRIVAL_ARCS.get(MOLOS);
if (!ARC) {
  console.error('Το τόξο του #2040 δεν υπάρχει στο utils/seaArrival.ts — η αλλαγή δεν είναι στο δέντρο εργασίας.');
  process.exit(1);
}
if (!beaches.some((b) => b.id === MOLOS) || !profilesById[MOLOS]) {
  console.error(`Ο Μώλος #${MOLOS} λείπει από τα δεδομένα της ${REGION}.`);
  process.exit(1);
}
const angDist = (a, b) => Math.abs((((a - b) % 360) + 540) % 360 - 180);
const inArc = (deg) => angDist(deg, ARC.centerDeg) <= ARC.halfWidthDeg;
const useVariant = (variant) => {
  if (variant === 'after') JUDGE_WITNESSED_ARRIVAL_ARCS.set(MOLOS, ARC);
  else JUDGE_WITNESSED_ARRIVAL_ARCS.delete(MOLOS);
};

// ── Το πλέγμα ────────────────────────────────────────────────────────────────
const DIRS = Array.from({ length: 72 }, (_, i) => i * 5);
const HS_M = [0.5, 0.8, 1.1, 1.5, 2.0];
const WINDS_KMH = [15, 25, 35];
const rows = [];
for (const waveDeg of DIRS) for (const hs of HS_M) for (const windKmh of WINDS_KMH) {
  rows.push({ regime: 'meltemi', waveDeg, windDeg: waveDeg, windKmh, hs });
}
for (const waveDeg of DIRS) for (const hs of HS_M) {
  rows.push({ regime: 'offshore-270', waveDeg, windDeg: 270, windKmh: 20, hs });
}

// ── Ό,τι βλέπει ο επισκέπτης ─────────────────────────────────────────────────
const scoreBeach = (beach, day) => calculateBeachScore(beach, day, undefined, undefined, {
  geospatialProfile: profilesById[beach.id],
  hourlyForecast: day.hourly,
});

/** Το αντικείμενο του χάρτη, όπως το χτίζει το App.tsx (mapSuitableBeaches) — ΧΩΡΙΣ shoreShadowDamping,
 *  ΧΩΡΙΣ forecastUncertain, γιατί εκεί δεν μπαίνουν. */
const appMapItem = (beach, day, s) => {
  const profile = profilesById[beach.id];
  const windKmh = day.wind.speed * 3.6;
  const a = assessBeachWindExposure({
    beach,
    geospatialProfile: profile,
    windDirectionDeg: day.wind.deg,
    windDirection: degToCompass(day.wind.deg),
    windSpeedKmh: windKmh,
    beaufort: getBeaufortLevel(windKmh),
    waveHeightMeters: day.marine?.waveHeightM,
  });
  return {
    beachId: beach.id, score: s.score, explanation: '', beach,
    isExposed: a.exposureLevel ? a.exposureLevel !== 'protected' : true,
    exposureLevel: a.exposureLevel,
    orientation: a.windProfile.beachFacingDirection ?? null,
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

/** components/BeachMap.tsx beachToneInput, όρισμα προς όρισμα. Ο άνεμος της παραλίας (beachLocalWinds)
 *  είναι εδώ ο άνεμος της περιοχής, γιατί το σενάριο έχει έναν. `kd` = από πού διαβάζεται το K_d. */
const pinTone = (item, ctx, kd) => {
  const exposureLevel = ctx.levels.get(item.beach.id) || getVisibleMapExposureLevel(item, ctx.beaufort, ctx.deg);
  const seaStateM = seaStateSeverityM(item.seaStateWaveM, item.seaStatePeriodS);
  const swellWaveHeightM = item.marine?.swellWaveHeightM;
  return resolveConditionTone({
    exposureLevel,
    beaufort: ctx.beaufort,
    isEnclosedCove: Boolean(item.enclosedCove),
    seaStateM,
    offshoreFlatWater: holdsFlatWaterUnderOffshoreWind({
      profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, swellWaveHeightM,
    }),
    glassWaterAtFour: holdsGlassWaterAtFourBeaufort({
      profile: item.geospatialExposure, windDirectionDeg: ctx.deg, beaufort: ctx.beaufort, seaStateM, exposureLevel,
      seaArrivalExposureLevel: item.seaArrivalExposureLevel, shoreShadowDamping: kd.shoreShadowDamping, swellWaveHeightM,
    }),
    downwindSeaSample: hasDownwindSeaSample({ profile: item.geospatialExposure, windDirectionDeg: ctx.deg, swellWaveHeightM }),
    seaArrivalExposureLevel: item.seaArrivalExposureLevel,
    shoreShadowDamping: kd.shoreShadowDamping,
    swimVerdictAvoid: item.swimmingComfort === 'avoid_swimming',
    windSpeedKmh: ctx.windKmh,
    forecastUncertain: kd.forecastUncertain,
  });
};

const visitorView = (item, s, ctx) => {
  const readout = buildBeachConditionsReadout({
    beachWindSpeedKmph: item.windSpeedKmph, regionWindSpeedMs: ctx.windMs, waveHeightM: item.waveHeightM,
    seaStateWaveM: item.seaStateWaveM, seaStatePeriodS: item.seaStatePeriodS, shoreWaveHeightM: item.shoreWaveHeightM,
    shoreDisplayWaveM: item.shoreDisplayWaveM, shoreWaveFromDepartingSea: item.shoreWaveFromDepartingSea,
    seaArrivalExposureLevel: item.seaArrivalExposureLevel, language: 'gr',
  });
  const hasWave = typeof readout.waveM === 'number' && Number.isFinite(readout.waveM);
  return {
    printed: hasWave ? Number(readout.waveM.toFixed(1)) : null,
    printedRawM: hasWave ? readout.waveM : null,
    waveText: readout.waveText ?? null,
    waveWord: readout.waveWord ?? null,
    waveLevel: hasWave ? waveFeelLevelWithArrival(Math.max(0, readout.waveM), item.seaArrivalExposureLevel) : null,
    pinTone: pinTone(item, ctx, item),
    pinToneWired: pinTone(item, ctx, s),
    chipTone: s.simpleWindSuitability?.suitabilityColor ?? null,
    verdict: s.swimmingComfort ?? null,
    finalScore: s.finalSuitabilityScore ?? null,
    shoreDisplayWaveM: s.shoreDisplayWaveM ?? null,
    openWaveM: s.waveHeightM ?? null,
    kd: s.shoreShadowDamping ?? null,
    seaArrival: s.seaArrivalExposureLevel ?? null,
  };
};

const runVariant = (variant, day, ctx, { fresh = false } = {}) => {
  useVariant(variant);
  const scores = new Map(beaches.map((b) => [b.id, scoreBeach(b, day)]));
  const items = beaches.map((b) => appMapItem(b, day, scores.get(b.id)));
  const levels = getConsistentVisibleMapExposureLevels(items, ctx.beaufort, ctx.deg, ctx.perBeachWind);
  const views = new Map(items.map((item) => [item.beachId, visitorView(item, scores.get(item.beachId), { ...ctx, levels })]));
  const list = getSuitableBeaches(beaches, day, 'gr', undefined, day.hourly, undefined, undefined, profilesById, scores)
    .map((x) => x.beachId);
  // Ο ίδιος κατάλογος χωρίς τα έτοιμα σκορ — η getSuitableBeaches βαθμολογεί μόνη της.
  const freshList = fresh
    ? getSuitableBeaches(beaches, day, 'gr', undefined, day.hourly, undefined, undefined, profilesById).map((x) => x.beachId)
    : null;
  return { scores, views, list, freshList };
};

// ── Μέτρηση ──────────────────────────────────────────────────────────────────
const VIEW_KEYS = ['printed', 'waveText', 'waveWord', 'pinTone', 'pinToneWired', 'chipTone', 'verdict', 'finalScore', 'shoreDisplayWaveM', 'kd'];
const SHOWN_KEYS = ['printed', 'waveText', 'waveWord', 'pinTone', 'chipTone', 'verdict'];
/** Πόσο βαθιά φτάνει η αλλαγή: ΦΑΙΝΕΤΑΙ (αριθμός/λέξη/χρώμα/ετυμηγορία) · μόνο ΒΑΘΜΟΣ (σειρά
 *  καταλόγου) · μόνο ο εσωτερικός αριθμός ακτής (η κάρτα τον κόβει στο ανοιχτό ή στο δάπεδο 0,10) ·
 *  μόνο το K_d (η θάλασσα δεν λογαριάζεται προστατευμένη άφιξη, άρα το K_d δεν διαβάζεται πουθενά). */
const tierOf = (diffKeys) => (diffKeys.some((k) => SHOWN_KEYS.includes(k)) ? 'shown'
  : diffKeys.includes('pinToneWired') ? 'pin-if-wired'
  : diffKeys.includes('finalScore') ? 'score-only'
  : diffKeys.includes('shoreDisplayWaveM') ? 'shore-number-only'
  : diffKeys.length ? 'kd-only' : 'raw-score-only');
const bump = (obj, key) => { obj[key] = (obj[key] ?? 0) + 1; };
const molos = {
  changedRows: [], changedOutsideArc: [], tiers: {}, printedChanges: 0, printedUp: 0, printedDown: 0,
  verdictFlips: 0, verdictMoves: {}, toneFlips: 0, toneMoves: {}, toneFlipsWired: 0, toneMovesWired: {},
  chipFlips: 0, chipMoves: {}, wordFlips: 0, wordMoves: {}, rawScoreChangedOutsideArc: 0,
  printedChangedVerdicts: {},
};
const podium = {
  rowsCompared: 0, top3Changed: 0, top3Enter: 0, top3Leave: 0, top3Move: 0,
  listEnter: 0, listLeave: 0, listMove: 0, othersRelativeOrderChanged: 0, outsideArcListChanged: 0,
  nneRows: 0, nneMolosListedBefore: 0, nneMolosListedAfter: 0, nneMolosTop3Before: 0, nneMolosTop3After: 0,
  nneMolosBestRankBefore: null, nneMolosBestRankAfter: null,
  examples: [],
};
const others = { beachRowPairs: 0, changedPairs: 0, changedBeaches: new Set(), examples: [] };
const controls = { determinismDiffs: 0, freshVsPrecomputedDiffs: 0, freshRowsChecked: 0, kdBeforeMismatch: 0, kdAfterMismatch: 0, examples: [] };
const allMolosRows = [];

const t0 = Date.now();
try {
  rows.forEach((row, index) => {
    const windMs = row.windKmh / 3.6;
    const day = createDailyForecast(0, {
      id: 'molos-arc', label: 'molos-arc', windDirectionDeg: row.windDeg, windSpeedMs: windMs,
      windGustMs: windMs * 1.35, waveHeightM: row.hs, waveDirectionDeg: row.waveDeg,
    });
    const beaufort = getBeaufortLevel(day.wind.speed * 3.6);
    const ctx = {
      windKmh: day.wind.speed * 3.6, windMs: day.wind.speed, deg: day.wind.deg, beaufort,
      perBeachWind: new Map(beaches.map((b) => [b.id, { beaufort, directionDeg: day.wind.deg }])),
    };
    const checkFresh = row.regime === 'meltemi' && inArc(row.waveDeg);
    const after = runVariant('after', day, ctx, { fresh: checkFresh });
    const before = runVariant('before', day, ctx, { fresh: checkFresh });
    const again = runVariant('after', day, ctx);

    // Έλεγχος 1 — ο διακόπτης είναι καθαρός και ο κινητήρας ντετερμινιστικός: ΜΕΤΑ == ΜΕΤΑ ξανά.
    for (const b of beaches) {
      if (JSON.stringify(after.scores.get(b.id)) !== JSON.stringify(again.scores.get(b.id))
        || JSON.stringify(after.views.get(b.id)) !== JSON.stringify(again.views.get(b.id))) {
        controls.determinismDiffs += 1;
        if (controls.examples.length < 5) controls.examples.push({ kind: 'determinism', beachId: b.id, row });
      }
    }
    if (JSON.stringify(after.list) !== JSON.stringify(again.list)) controls.determinismDiffs += 1;
    // Έλεγχος 2 — ο κατάλογος με έτοιμα σκορ == ο κατάλογος που βαθμολογεί μόνος του.
    if (checkFresh) {
      controls.freshRowsChecked += 1;
      if (JSON.stringify(after.list) !== JSON.stringify(after.freshList)) controls.freshVsPrecomputedDiffs += 1;
      if (JSON.stringify(before.list) !== JSON.stringify(before.freshList)) controls.freshVsPrecomputedDiffs += 1;
    }
    // Έλεγχος 3 — το ΠΡΙΝ είναι πράγματι η γεωμετρία χωρίς εξαίρεση, το ΜΕΤΑ το πάτωμα μέσα στο τόξο.
    const geometryKd = resolveShoreShadowDamping({ ...profilesById[MOLOS], beachId: -1 }, row.waveDeg);
    const vb = before.views.get(MOLOS);
    const va = after.views.get(MOLOS);
    const expectedAfterKd = typeof geometryKd === 'number' && inArc(row.waveDeg) ? Math.max(geometryKd, SHADOW_KD_AT_EDGE) : geometryKd;
    if ((vb.kd ?? undefined) !== geometryKd) controls.kdBeforeMismatch += 1;
    if ((va.kd ?? undefined) !== expectedAfterKd) controls.kdAfterMismatch += 1;

    // ── Μώλος ──
    const rankB = before.list.indexOf(MOLOS);
    const rankA = after.list.indexOf(MOLOS);
    const diffKeys = VIEW_KEYS.filter((k) => vb[k] !== va[k]);
    const rawChanged = JSON.stringify(before.scores.get(MOLOS)) !== JSON.stringify(after.scores.get(MOLOS));
    const record = {
      regime: row.regime, waveDeg: row.waveDeg, windDeg: row.windDeg, windKmh: row.windKmh, hs: row.hs,
      inArc: inArc(row.waveDeg), seaArrival: va.seaArrival, openWaveM: va.openWaveM,
      kdBefore: vb.kd, kdAfter: va.kd,
      printedBefore: vb.printed, printedAfter: va.printed, waveTextBefore: vb.waveText, waveTextAfter: va.waveText,
      wordBefore: vb.waveWord, wordAfter: va.waveWord,
      pinBefore: vb.pinTone, pinAfter: va.pinTone, pinWiredBefore: vb.pinToneWired, pinWiredAfter: va.pinToneWired,
      chipBefore: vb.chipTone, chipAfter: va.chipTone,
      verdictBefore: vb.verdict, verdictAfter: va.verdict, scoreBefore: vb.finalScore, scoreAfter: va.finalScore,
      rankBefore: rankB, rankAfter: rankA, top3Before: before.list.slice(0, 3), top3After: after.list.slice(0, 3),
      listSizeBefore: before.list.length, listSizeAfter: after.list.length,
      changed: diffKeys, rawScoreChanged: rawChanged, tier: (diffKeys.length || rawChanged) ? tierOf(diffKeys) : null,
    };
    allMolosRows.push(record);
    if (diffKeys.length || rawChanged) {
      molos.changedRows.push(record);
      bump(molos.tiers, record.tier);
      if (!record.inArc) molos.changedOutsideArc.push(record);
    }
    if (rawChanged && !record.inArc) molos.rawScoreChangedOutsideArc += 1;
    if (vb.printed !== va.printed) {
      molos.printedChanges += 1;
      if ((va.printed ?? 0) > (vb.printed ?? 0)) molos.printedUp += 1; else molos.printedDown += 1;
      bump(molos.printedChangedVerdicts, `${vb.verdict} → ${va.verdict}`);
    }
    if (vb.verdict !== va.verdict) { molos.verdictFlips += 1; bump(molos.verdictMoves, `${vb.verdict} → ${va.verdict}`); }
    if (vb.pinTone !== va.pinTone) { molos.toneFlips += 1; bump(molos.toneMoves, `${vb.pinTone} → ${va.pinTone}`); }
    if (vb.pinToneWired !== va.pinToneWired) { molos.toneFlipsWired += 1; bump(molos.toneMovesWired, `${vb.pinToneWired} → ${va.pinToneWired}`); }
    if (vb.chipTone !== va.chipTone) { molos.chipFlips += 1; bump(molos.chipMoves, `${vb.chipTone} → ${va.chipTone}`); }
    if (vb.waveWord !== va.waveWord) { molos.wordFlips += 1; bump(molos.wordMoves, `${vb.waveWord} → ${va.waveWord}`); }

    // ── Βάθρο / κατάλογος ──
    podium.rowsCompared += 1;
    const top3B = before.list.slice(0, 3);
    const top3A = after.list.slice(0, 3);
    const inTop3B = rankB >= 0 && rankB < 3;
    const inTop3A = rankA >= 0 && rankA < 3;
    const top3Changed = JSON.stringify(top3B) !== JSON.stringify(top3A);
    if (top3Changed) podium.top3Changed += 1;
    if (!inTop3B && inTop3A) podium.top3Enter += 1;
    if (inTop3B && !inTop3A) podium.top3Leave += 1;
    if (inTop3B && inTop3A && rankB !== rankA) podium.top3Move += 1;
    if (rankB < 0 && rankA >= 0) podium.listEnter += 1;
    if (rankB >= 0 && rankA < 0) podium.listLeave += 1;
    if (rankB >= 0 && rankA >= 0 && rankB !== rankA) podium.listMove += 1;
    const othersB = before.list.filter((id) => id !== MOLOS);
    const othersA = after.list.filter((id) => id !== MOLOS);
    if (JSON.stringify(othersB) !== JSON.stringify(othersA)) podium.othersRelativeOrderChanged += 1;
    if (!record.inArc && JSON.stringify(before.list) !== JSON.stringify(after.list)) podium.outsideArcListChanged += 1;
    // Οι «μελτεμιές» μέρες ΒΒΑ: άνεμος και κύμα από την ίδια μεριά, μέσα στο τόξο.
    if (row.regime === 'meltemi' && record.inArc) {
      podium.nneRows += 1;
      if (rankB >= 0) podium.nneMolosListedBefore += 1;
      if (rankA >= 0) podium.nneMolosListedAfter += 1;
      if (inTop3B) podium.nneMolosTop3Before += 1;
      if (inTop3A) podium.nneMolosTop3After += 1;
      if (rankB >= 0) podium.nneMolosBestRankBefore = Math.min(podium.nneMolosBestRankBefore ?? Infinity, rankB + 1);
      if (rankA >= 0) podium.nneMolosBestRankAfter = Math.min(podium.nneMolosBestRankAfter ?? Infinity, rankA + 1);
    }
    if ((rankB !== rankA || top3Changed) && podium.examples.length < 12) {
      podium.examples.push({
        regime: row.regime, waveDeg: row.waveDeg, windKmh: row.windKmh, hs: row.hs,
        molosRankBefore: rankB, molosRankAfter: rankA,
        top3Before: top3B.map(nameOf), top3After: top3A.map(nameOf),
        listSizeBefore: before.list.length, listSizeAfter: after.list.length,
        verdictBefore: vb.verdict, verdictAfter: va.verdict, scoreBefore: vb.finalScore, scoreAfter: va.finalScore,
      });
    }

    // ── Όλες οι άλλες παραλίες ──
    for (const b of beaches) {
      if (b.id === MOLOS) continue;
      others.beachRowPairs += 1;
      const sameScore = JSON.stringify(before.scores.get(b.id)) === JSON.stringify(after.scores.get(b.id));
      const sameView = JSON.stringify(before.views.get(b.id)) === JSON.stringify(after.views.get(b.id));
      if (!sameScore || !sameView) {
        others.changedPairs += 1;
        others.changedBeaches.add(b.id);
        if (others.examples.length < 10) others.examples.push({ beachId: b.id, name: nameOf(b.id), row, sameScore, sameView });
      }
    }

    if ((index + 1) % 120 === 0) {
      process.stderr.write(`\r  ${index + 1}/${rows.length} σενάρια · ${((Date.now() - t0) / 1000).toFixed(0)} s   `);
    }
  });
} finally {
  JUDGE_WITNESSED_ARRIVAL_ARCS.set(MOLOS, ARC);
}
process.stderr.write('\n');

// ── Σύνοψη ───────────────────────────────────────────────────────────────────
const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'number' ? String(v).replace('.', ',') : v);
const changedDirs = [...new Set(molos.changedRows.map((r) => r.waveDeg))].sort((a, b) => a - b);
const holeProfile = (hs, windKmh) => DIRS.filter((d) => d <= 45 || d >= 345).map((d) => {
  const r = allMolosRows.find((x) => x.regime === 'meltemi' && x.waveDeg === d && x.hs === hs && x.windKmh === windKmh);
  return { waveDeg: d, inArc: r.inArc, seaArrival: r.seaArrival, before: r.printedBefore, after: r.printedAfter };
});

console.log(`\nΜώλος #${MOLOS} (${REGION}) · τόξο ${ARC.centerDeg}±${ARC.halfWidthDeg}° · ${rows.length} σενάρια · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log('\n── ΤΙ ΒΛΕΠΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ ΣΤΟΝ ΜΩΛΟ ─────────────────────────────────');
console.log(`  σενάρια που αλλάζουν κάτι: ${molos.changedRows.length} · ΕΞΩ από το τόξο: ${molos.changedOutsideArc.length}`);
const TIER_GR = { shown: 'φαίνεται στην οθόνη', 'pin-if-wired': 'μόνο η πινέζα-αν-καλωδιωθεί', 'score-only': 'μόνο ο βαθμός', 'shore-number-only': 'μόνο ο εσωτερικός αριθμός ακτής', 'kd-only': 'μόνο το K_d (δεν διαβάζεται)', 'raw-score-only': 'μόνο άλλο πεδίο του score' };
console.log(`    ${Object.entries(molos.tiers).map(([k, v]) => `${TIER_GR[k] ?? k}: ${v}`).join(' · ')}`);
console.log(`  διευθύνσεις κύματος που αλλάζουν: ${changedDirs.join(', ') || '—'}`);
console.log(`  τυπωμένος αριθμός: ${molos.printedChanges} (πάνω ${molos.printedUp}, κάτω ${molos.printedDown}) · ετυμηγορία σε αυτά: ${Object.entries(molos.printedChangedVerdicts).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log(`  λέξη κύματος: ${molos.wordFlips} · ${Object.entries(molos.wordMoves).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log(`  ετυμηγορία: ${molos.verdictFlips} · ${Object.entries(molos.verdictMoves).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log(`  πινέζα (όπως σήμερα): ${molos.toneFlips} · ${Object.entries(molos.toneMoves).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log(`  πινέζα (αν κουβαλούσε το K_d): ${molos.toneFlipsWired} · ${Object.entries(molos.toneMovesWired).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log(`  τσιπ κάρτας: ${molos.chipFlips} · ${Object.entries(molos.chipMoves).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}`);
console.log('\n  Η «τρύπα» με μελτέμι 25 χλμ/ώ, Hs 1,1 μ. (κύμα° · άφιξη · τυπωμένο ΠΡΙΝ → ΜΕΤΑ):');
for (const p of holeProfile(1.1, 25)) {
  console.log(`    ${String(p.waveDeg).padStart(3)}° ${p.inArc ? 'τόξο' : '    '} ${String(p.seaArrival ?? '—').padEnd(9)} ${fmt(p.before)} → ${fmt(p.after)}${p.before !== p.after ? '  ◀' : ''}`);
}
console.log('\n── ΒΑΘΡΟ ΠΑΡΟΥ (getSuitableBeaches) ──────────────────────────────────');
console.log(`  3 πρώτες άλλαξαν: ${podium.top3Changed} · Μώλος μπαίνει ${podium.top3Enter} / βγαίνει ${podium.top3Leave} / αλλάζει θέση ${podium.top3Move}`);
console.log(`  κατάλογος: μπαίνει ${podium.listEnter} / βγαίνει ${podium.listLeave} / αλλάζει θέση ${podium.listMove} · σειρά των ΑΛΛΩΝ άλλαξε: ${podium.othersRelativeOrderChanged}`);
console.log(`  μελτέμι ΒΒΑ (${podium.nneRows} σενάρια μέσα στο τόξο): Μώλος στον κατάλογο ${podium.nneMolosListedBefore} → ${podium.nneMolosListedAfter} · στις 3 πρώτες ${podium.nneMolosTop3Before} → ${podium.nneMolosTop3After} · καλύτερη θέση ${fmt(podium.nneMolosBestRankBefore)} → ${fmt(podium.nneMolosBestRankAfter)}`);
for (const e of podium.examples.slice(0, 4)) {
  console.log(`    ${e.waveDeg}° Hs ${fmt(e.hs)} ${e.windKmh} χλμ/ώ: θέση ${e.molosRankBefore} → ${e.molosRankAfter} · top3 [${e.top3Before.join(', ')}] → [${e.top3After.join(', ')}]`);
}
console.log('\n── ΟΛΕΣ ΟΙ ΑΛΛΕΣ ΠΑΡΑΛΙΕΣ ΤΗΣ ΠΑΡΟΥ ─────────────────────────────────');
console.log(`  ζεύγη παραλία×σενάριο: ${others.beachRowPairs} · άλλαξαν: ${others.changedPairs} · παραλίες: ${others.changedBeaches.size}`);
console.log('\n── ΕΛΕΓΧΟΙ ──────────────────────────────────────────────────────────');
console.log(`  ΜΕΤΑ == ΜΕΤΑ ξανά: διαφορές ${controls.determinismDiffs}`);
console.log(`  κατάλογος έτοιμα-σκορ == μόνος του (${controls.freshRowsChecked} σενάρια): διαφορές ${controls.freshVsPrecomputedDiffs}`);
console.log(`  K_d ΠΡΙΝ == γεωμετρία: αποκλίσεις ${controls.kdBeforeMismatch} · K_d ΜΕΤΑ == πάτωμα στο τόξο: αποκλίσεις ${controls.kdAfterMismatch}`);

const pick = (r) => ({
  regime: r.regime, waveDeg: r.waveDeg, windDeg: r.windDeg, windKmh: r.windKmh, hs: r.hs, seaArrival: r.seaArrival,
  kdBefore: r.kdBefore, kdAfter: r.kdAfter, printedBefore: r.printedBefore, printedAfter: r.printedAfter,
  waveTextBefore: r.waveTextBefore, waveTextAfter: r.waveTextAfter, wordBefore: r.wordBefore, wordAfter: r.wordAfter,
  pinBefore: r.pinBefore, pinAfter: r.pinAfter, pinWiredBefore: r.pinWiredBefore, pinWiredAfter: r.pinWiredAfter,
  chipBefore: r.chipBefore, chipAfter: r.chipAfter, verdictBefore: r.verdictBefore, verdictAfter: r.verdictAfter,
  scoreBefore: r.scoreBefore, scoreAfter: r.scoreAfter, rankBefore: r.rankBefore, rankAfter: r.rankAfter,
  changed: r.changed,
});
const controlRows = [
  { regime: 'meltemi', waveDeg: 45, windKmh: 25, hs: 1.1 },
  { regime: 'meltemi', waveDeg: 180, windKmh: 25, hs: 1.5 },
  { regime: 'offshore-270', waveDeg: 330, windKmh: 20, hs: 1.1 },
].map((c) => allMolosRows.find((r) => r.regime === c.regime && r.waveDeg === c.waveDeg && r.windKmh === c.windKmh && r.hs === c.hs))
  .filter(Boolean).map(pick);

const reportPath = path.join(root, 'reports/wave-model/molos-arrival-arc-impact.json');
mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  script: 'scripts/measureMolosArrivalArc.mjs',
  beach: { id: MOLOS, name: nameOf(MOLOS), region: REGION },
  arc: { centerDeg: ARC.centerDeg, halfWidthDeg: ARC.halfWidthDeg, floorKd: SHADOW_KD_AT_EDGE },
  grid: {
    waveDirectionsDeg: '0..355 step 5', hsM: HS_M, meltemiWindKmh: WINDS_KMH, meltemiWindFrom: 'same as wave',
    offshoreRegime: { windFromDeg: 270, windKmh: 20 }, swell: 'weatherFixtures: max(0.2, 0.35×Hs) from the wave direction',
    rows: rows.length, beachesScoredPerRow: beaches.length,
  },
  fieldsUsed: {
    printed: 'utils/beachConditionsReadout.buildBeachConditionsReadout(...).waveM, i.e. printedWaveHeightM(min(score.shoreDisplayWaveM, score.waveHeightM)), shown to one decimal — the card path (components/BeachCard.tsx); pages/BeachDetailPage.tsx shoreWaveHeightM applies the same min()',
    word: 'readout.waveWord = utils/conditionsFeelPhrase.buildConditionsFeel(waveM=printed, seaArrivalExposureLevel, gr)',
    pinTone: 'resolveConditionTone with components/BeachMap.tsx beachToneInput arguments over App.tsx mapSuitableBeaches-shaped items (which carry NO shoreShadowDamping)',
    pinToneWired: 'same, but shoreShadowDamping/forecastUncertain taken from the score (what the gate section E assumes the pin reads)',
    chipTone: 'score.simpleWindSuitability.suitabilityColor (card chip; applySeaStateToWindSuitability passes no K_d either)',
    verdict: 'score.swimmingComfort',
    podium: 'services/recommendationService.getSuitableBeaches over all 39 Paros beaches; top 3 = first three',
  },
  molos: {
    combosRun: rows.length,
    combosChanged: molos.changedRows.length,
    changesOutsideArc: molos.changedOutsideArc.length,
    rawScoreChangedOutsideArc: molos.rawScoreChangedOutsideArc,
    changeTiers: molos.tiers,
    changeTiersMeaning: {
      shown: 'printed number, wave word, pin colour, card chip or swim verdict differs',
      'pin-if-wired': 'only the pin colour computed WITH the score K_d differs (not what production shows)',
      'score-only': 'only finalSuitabilityScore differs (list ranking input); nothing on screen',
      'shore-number-only': 'only score.shoreDisplayWaveM differs; the card caps it at score.waveHeightM or the 0.10 m floor, so the printed figure is identical',
      'kd-only': 'only score.shoreShadowDamping differs; the sea is not a sheltered arrival there, so no reader consumes K_d',
    },
    changedWaveDirectionsDeg: changedDirs,
    printedChanges: molos.printedChanges, printedUp: molos.printedUp, printedDown: molos.printedDown,
    verdictWhereThePrintedNumberChanged: molos.printedChangedVerdicts,
    wordFlips: molos.wordFlips, wordMoves: molos.wordMoves,
    verdictFlips: molos.verdictFlips, verdictMoves: molos.verdictMoves,
    toneFlips: molos.toneFlips, toneMoves: molos.toneMoves,
    toneFlipsWired: molos.toneFlipsWired, toneMovesWired: molos.toneMovesWired,
    chipFlips: molos.chipFlips, chipMoves: molos.chipMoves,
    holeProfileMeltemi25kmhHs11: holeProfile(1.1, 25),
    holeProfileMeltemi35kmhHs15: holeProfile(1.5, 35),
    changedRows: molos.changedRows.map(pick),
    changedOutsideArcRows: molos.changedOutsideArc.map(pick),
    controlRows,
  },
  podium,
  otherBeaches: {
    beachesCompared: beaches.length - 1,
    beachRowPairs: others.beachRowPairs,
    changedPairs: others.changedPairs,
    changedBeaches: [...others.changedBeaches],
    comparedFields: 'entire BeachScore JSON + printed/word/pinTone/pinToneWired/chip/verdict/score/K_d',
    examples: others.examples,
  },
  controls,
  wiringFinding: {
    summary: 'In production neither the map pin nor the card chip receives K_d: App.tsx mapSuitableBeaches items do not copy score.shoreShadowDamping (BeachMap.tsx forwards item.shoreShadowDamping = undefined), and recommendationService passes no K_d to applySeaStateToWindSuitability. Both therefore use the historical 0.5 for protected/enclosed shores. Gate section E only checks that BeachMap.tsx forwards the field, not that the item carries it.',
    consequenceForMolos: 'Inside the hole the pin and chip already assumed 0.5 of the open sea while the card printed 0.1; after the arc fix the printed number agrees with them. pinTone vs pinToneWired show whether wiring would change the colour here.',
    pinFlipsIfWired: molos.toneFlipsWired,
  },
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);

const failed = molos.changedOutsideArc.length || molos.rawScoreChangedOutsideArc || others.changedPairs
  || controls.determinismDiffs || controls.freshVsPrecomputedDiffs || controls.kdBeforeMismatch || controls.kdAfterMismatch
  || !molos.changedRows.length;
if (failed) {
  console.error(!molos.changedRows.length
    ? 'ΚΑΝΕΝΑ σενάριο δεν άλλαξε — ο διακόπτης ΠΡΙΝ/ΜΕΤΑ δεν έπιασε ή η μέτρηση δεν λέει τίποτα.'
    : 'ΑΠΟΤΥΧΙΑ: αλλαγή έξω από το τόξο, σε άλλη παραλία ή σε έλεγχο — δες την αναφορά.');
  process.exit(1);
}
console.log('Αλλάζει ΜΟΝΟ ο Μώλος, ΜΟΝΟ με κύμα μέσα στο τόξο — καμία άλλη παραλία, κανένα άλλο σενάριο.');
