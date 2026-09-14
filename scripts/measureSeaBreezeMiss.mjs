#!/usr/bin/env node
/**
 * ΧΑΝΟΥΜΕ ΤΗ ΘΑΛΑΣΣΙΑ ΑΥΡΑ ΤΟ ΑΠΟΓΕΥΜΑ; — ΑΝΑ ΣΤΑΘΜΟ, ΣΕ ΜΕΡΕΣ ΧΩΡΙΣ ΜΕΛΤΕΜΙ (14/09/2026).
 *
 * ΓΙΑΤΙ ΤΩΡΑ. Η ξαναβαθμολόγηση της 14/09 έβαλε τον άξονα «άνεμος πάνω στην παραλία» στο 35% με
 * βάρος 15 — η μεγαλύτερη τρύπα της βίβλου (9,75 μονάδες). Το σχόλιο των επισκεπτών που την
 * τροφοδοτεί είναι πάντα το ίδιο: «λέτε 2 μποφόρ, η ακτή είχε 4», και σχεδόν πάντα το απόγευμα.
 * Ο έλεγχος της Αττικής (Δ2-Δ, 13/09) βρήκε ακριβώς αυτό σε ένα τμήμα ακτής: νότια αύρα 13-15h
 * που η σελίδα έδειχνε Β/ΒΑ. Ένα περιστατικό δεν είναι εύρημα.
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΓΕΜΙΖΕΙ. Η μητρική μέτρηση (`measureWindDiurnalTiming.mjs`,
 * `reports/weather/wind-diurnal-timing-2026-09-11.json`) έσπασε το σφάλμα ανά ώρα ΚΑΙ ανά σταθμό —
 * αλλά το ανά σταθμό ΜΟΝΟ για μέρες μελτεμιού (`DAY_SETS['μελτέμι (και τα δύο)']`, γραμμή 296).
 * Οι μέρες ΧΩΡΙΣ μελτέμι — δηλαδή ακριβώς το καθεστώς όπου κυριαρχεί η θαλάσσια αύρα — υπάρχουν
 * μόνο ως ένας εθνικός μέσος όρος. Έτσι δεν μπορεί να απαντηθεί το μόνο ερώτημα που μετράει για
 * διόρθωση: **είναι η απογευματινή αστοχία εθνική ή λίγων τόπων;**
 *
 * ΜΗΔΕΝ ΝΕΑ ΔΕΔΟΜΕΝΑ. Τα 156.375 ζεύγη μοντέλου-οργάνου (30 αεροδρόμια, 3 καλοκαίρια) είναι ήδη
 * στον δίσκο (`node_modules/.cache/wind-diurnal/`, 46 MB). Το σκριπτ ΔΕΝ κατεβάζει τίποτα: αν
 * λείπει κομμάτι της μνήμης, σταματά και το λέει. Κρίνεται ο άνεμος ΠΟΥ ΔΕΙΧΝΟΥΜΕ (μετά το
 * `applyGustFloor`), όχι ο ωμός — ίδια μέθοδος με τη μητρική.
 *
 * ⚠️ ΟΙ ΒΟΗΘΗΤΙΚΕΣ ΕΙΝΑΙ ΑΝΤΙΓΡΑΦΟ, ΣΚΟΠΙΜΑ. Η μητρική δεν εξάγει τίποτα· αντί να την πειράξω
 * (το αρχείο της είναι commitαρισμένη αναφορά), οι `hourStats`/`BUCKETS`/ταξινόμηση μελτεμιού
 * αντιγράφονται αυτούσιες — και ο ΑΥΤΟΕΛΕΓΧΟΣ παρακάτω αναπαράγει τα εθνικά νούμερα της
 * δημοσιευμένης αναφοράς. Αν κάποιος αλλάξει τη μία και όχι την άλλη, ο αυτοέλεγχος πέφτει.
 *
 * ═══ Ο ΚΑΝΟΝΑΣ ΑΠΟΦΑΣΗΣ, ΓΡΑΜΜΕΝΟΣ ΠΡΙΝ ΤΡΕΞΕΙ (όπως Δ9-Δ, Δ6-Γ) ═══
 *
 * Μετρικές, ίδιες με τη μητρική: `biasKmh` = (δείχνουμε − όργανο)· `underPct` = «≥1 Μποφόρ
 * χαμηλότερα»· `falseBluePct` = δείχνουμε ήρεμο χρώμα ενώ το όργανο δίνει χρώμα (η ΕΠΙΚΙΝΔΥΝΗ
 * κατεύθυνση). Κουβάδες: πρωί 08-11, μεσημέρι 12-16, απόγευμα 17-20, τοπική ώρα.
 *
 *   Α · ΕΘΝΙΚΗ ΑΣΤΟΧΙΑ — αν, σε μέρες χωρίς μελτέμι, συνολικά:
 *         bias(απόγευμα) − bias(πρωί) ≤ −2,0 χλμ/ώ  ΚΑΙ  falseBlue(απόγευμα) ≥ 2 × falseBlue(πρωί)
 *       τότε υπάρχει συστηματική απογευματινή υποεκτίμηση και είναι εθνική.
 *   Β · ΤΟΠΙΚΗ — αν το Α αποτύχει αλλά ≥8 από τους 30 σταθμούς περνούν το ΙΔΙΟ τεστ μόνοι τους
 *       (με ≥200 ώρες σε κάθε κουβά), η αστοχία υπάρχει αλλά είναι λίγων τόπων: καμία εθνική
 *       διόρθωση, μόνο τοπική — και μόνο με δεύτερο όργανο ανά τόπο.
 *   Γ · ΔΕΝ ΥΠΑΡΧΕΙ — αλλιώς. Το νήμα κλείνει με τον αριθμό.
 *
 *   ΦΡΕΝΟ ΔΥΟ ΠΡΟΣΗΜΩΝ (το μάθημα Τήνος/Άνδρος, μνήμη `meteo-gr-station-judge`): αν ≥5 σταθμοί
 *   έχουν bias(απόγευμα)−bias(πρωί) ≤ −2 ΚΑΙ ≥5 σταθμοί ≥ +2, τότε **καμία εθνική σταθερά δεν
 *   επιτρέπεται**, ό,τι κι αν λέει το Α: θα χειροτέρευε τους μισούς. Αυτό το φρένο υπερισχύει.
 *
 * ΤΙ ΔΕΝ ΑΠΟΔΕΙΚΝΥΕΙ: ο κριτής είναι ΑΕΡΟΔΡΟΜΙΟ, όχι παραλία — μετρά τον αέρα της περιοχής, όχι
 * της άμμου· αν η αύρα μπαίνει μόνο στα τελευταία 500 μ. της ακτής, εδώ δεν φαίνεται καν. Άρα
 * «Γ · δεν υπάρχει» σημαίνει «το μοντέλο δεν χάνει την αύρα ΣΤΟ ΑΕΡΟΔΡΟΜΙΟ», ΟΧΙ «δεν υπάρχει
 * πρόβλημα στην ακτή». Επίσης: 10-λεπτος μέσος οργάνου vs στιγμιαία τιμή μοντέλου στην ακέραιη ώρα.
 *
 * ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ. Γράφει `reports/weather/sea-breeze-miss-<ημερομηνία>.json`.
 *   node scripts/measureSeaBreezeMiss.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { STATIONS } from './lib/windStations.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { resolveConditionTone, LEGEND_TONE_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));

// ── Σταθερές: ΑΝΤΙΓΡΑΦΟ της measureWindDiurnalTiming.mjs (ο αυτοέλεγχος τις φυλάει) ────────────
const SUMMERS = [['2024', '2024-06-01', '2024-09-10'], ['2025', '2025-06-01', '2025-09-10'], ['2026', '2026-06-01', '2026-09-10']];
const LOCAL_OFFSET_H = 3, MELTEMI_KMH = 20, MELTEMI_MIN_HOURS = 3;
const isNorth = d => Number.isFinite(d) && (d >= 300 || d <= 60);
const GROUP = {
  'Νότιο Αιγαίο/Κρήτη': ['LGMK', 'LGNX', 'LGPA', 'LGSR', 'LGML', 'LGKO', 'LGRP', 'LGLE', 'LGKP', 'LGIR', 'LGSA', 'LGST', 'LGKC'],
  'Βόρειο/Ανατ. Αιγαίο': ['LGLM', 'LGMT', 'LGSM', 'LGHI', 'LGIK', 'LGSK', 'LGSY', 'LGAL', 'LGKV', 'LGTS', 'LGBL'],
  'Ιόνιο/δυτικά': ['LGKR', 'LGZA', 'LGKF', 'LGPZ', 'LGRX', 'LGKL'],
};
const groupOf = Object.fromEntries(Object.entries(GROUP).flatMap(([g, list]) => list.map(icao => [icao, g])));
const DAY_MS = 86_400_000;
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const round = (n, p = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
const mean = a => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const bft = v => getBeaufortLevel(v);
const TONE_EXPOSURES = ['protected', 'partial', 'exposed'];
const toneRank = new Map();
const toneOf = (exposureLevel, kmh) => {
  const key = `${exposureLevel}|${bft(kmh)}`;
  if (!toneRank.has(key)) toneRank.set(key, LEGEND_TONE_ORDER.indexOf(resolveConditionTone({ exposureLevel, beaufort: bft(kmh), isEnclosedCove: false, seaStateM: undefined })));
  return toneRank.get(key);
};
const hourStats = hourRows => {
  let under = 0, over = 0, toneN = 0, calmer = 0, falseBlue = 0;
  for (const r of hourRows) {
    const bs = bft(r.prod), bo = bft(r.obs);
    if (bs < bo) under++; else if (bs > bo) over++;
    for (const exposure of TONE_EXPOSURES) {
      const shown = toneOf(exposure, r.prod), truth = toneOf(exposure, r.obs);
      toneN++;
      if (shown < truth) calmer++;
      if (shown === 0 && truth > 0) falseBlue++;
    }
  }
  return {
    n: hourRows.length, biasKmh: round(mean(hourRows.map(r => r.prod - r.obs))), rawBiasKmh: round(mean(hourRows.map(r => r.raw - r.obs))),
    obsMeanKmh: round(mean(hourRows.map(r => r.obs))), shownMeanKmh: round(mean(hourRows.map(r => r.prod))),
    underPct: pct(under, hourRows.length), overPct: pct(over, hourRows.length),
    toneCalmerPct: pct(calmer, toneN), falseBluePct: pct(falseBlue, toneN),
  };
};
const BUCKETS = { 'πρωί 08-11': [8, 9, 10, 11], 'μεσημέρι 12-16': [12, 13, 14, 15, 16], 'απόγευμα 17-20': [17, 18, 19, 20] };
const byBucket = selectDays => Object.fromEntries(Object.entries(BUCKETS).map(([b, hs]) => [b, hourStats(
  selectDays.flatMap(d => hs.flatMap(h => (d.hours[h] ? [d.hours[h]] : []))))]));

// ── Τα ζεύγη από τη μνήμη στον δίσκο — καμία λήψη ─────────────────────────────────────────────
const CACHE = path.join(root, 'node_modules/.cache/wind-diurnal');
const monthChunks = (start, end) => {
  const out = [];
  let s = Date.parse(`${start}T00:00:00Z`); const e = Date.parse(`${end}T00:00:00Z`);
  while (s <= e) { const ce = Math.min(e, s + 30 * DAY_MS); out.push([isoDay(s), isoDay(ce)]); s = ce + DAY_MS; }
  return out;
};
const rows = [];
const stationElevation = {};
for (const [summer, start, end] of SUMMERS) {
  for (const [s, e] of monthChunks(start, end)) {
    const obsFile = path.join(CACHE, `obs-${s}-${e}.json`), modelFile = path.join(CACHE, `model-${s}-${e}.json`);
    if (!fs.existsSync(obsFile) || !fs.existsSync(modelFile)) {
      console.error(`Λείπει από τη μνήμη: ${path.relative(root, fs.existsSync(obsFile) ? modelFile : obsFile)}`);
      console.error('Αυτό το σκριπτ ΔΕΝ κατεβάζει. Τρέξε πρώτα: node scripts/measureWindDiurnalTiming.mjs');
      process.exit(1);
    }
    const observed = new Map(JSON.parse(fs.readFileSync(obsFile, 'utf8')));
    const model = JSON.parse(fs.readFileSync(modelFile, 'utf8'));
    STATIONS.forEach(([icao], i) => {
      const m = model[i];
      if (!m) return;
      stationElevation[icao] = m.elevation;
      for (let h = 0; h < m.time.length; h++) {
        const t = m.time[h];
        const obs = observed.get(`${icao}|${t.slice(0, 13)}`);
        const raw = m.ws[h];
        if (!obs || !Number.isFinite(raw)) continue;
        const local = new Date(Date.parse(`${t}:00Z`) + LOCAL_OFFSET_H * 3_600_000);
        rows.push({
          icao, group: groupOf[icao] ?? 'άλλο', summer, localDate: local.toISOString().slice(0, 10), localHour: local.getUTCHours(),
          obs: obs.kmh, obsDir: obs.dir, raw, prod: applyGustFloor(raw, Number.isFinite(m.wg[h]) ? m.wg[h] : null, m.elevation), modelDir: m.wd[h],
        });
      }
    });
  }
}
if (rows.length < 50_000) { console.error(`μόνο ${rows.length} ζευγάρια — δεν βγάζω συμπέρασμα`); process.exit(1); }

const days = new Map();
for (const r of rows) {
  const key = `${r.icao}|${r.localDate}`;
  if (!days.has(key)) days.set(key, { icao: r.icao, group: r.group, summer: r.summer, date: r.localDate, hours: new Array(24) });
  days.get(key).hours[r.localHour] = r;
}
const meltemiBy = (day, value, dir) => {
  let windy = 0, present = 0;
  for (let h = 10; h <= 19; h++) {
    const r = day.hours[h];
    if (!r) continue;
    present++;
    if (r[value] >= MELTEMI_KMH && isNorth(r[dir])) windy++;
  }
  return present >= 8 ? windy >= MELTEMI_MIN_HOURS : null;
};
for (const day of days.values()) { day.meltemiObs = meltemiBy(day, 'obs', 'obsDir'); day.meltemiModel = meltemiBy(day, 'prod', 'modelDir'); }
const allDays = [...days.values()];
const quiet = allDays.filter(d => d.meltemiObs === false && d.meltemiModel === false);
console.log(`Ζεύγη ${rows.length.toLocaleString('el')} · μέρες-σταθμοί ${allDays.length.toLocaleString('el')} · ΧΩΡΙΣ μελτέμι ${quiet.length.toLocaleString('el')}`);

// ── ΑΥΤΟΕΛΕΓΧΟΣ: αναπαράγω τα εθνικά νούμερα της δημοσιευμένης αναφοράς ──────────────────────
const parentFile = path.join(root, 'reports/weather/wind-diurnal-timing-2026-09-11.json');
let selfCheck = { ran: false };
if (fs.existsSync(parentFile)) {
  const parent = JSON.parse(fs.readFileSync(parentFile, 'utf8'));
  const mine = byBucket(quiet), theirs = parent.buckets?.['όλα']?.['υπόλοιπες μέρες'];
  const diffs = [];
  if (theirs) for (const b of Object.keys(BUCKETS)) for (const k of ['n', 'biasKmh', 'falseBluePct', 'underPct']) {
    if (mine[b]?.[k] !== theirs[b]?.[k]) diffs.push(`${b}.${k}: δικό μου ${mine[b]?.[k]} ≠ αναφοράς ${theirs[b]?.[k]}`);
  }
  selfCheck = { ran: true, parent: path.relative(root, parentFile), identical: theirs ? diffs.length === 0 : null, diffs };
  console.log(theirs
    ? (diffs.length ? `⚠️ ΑΥΤΟΕΛΕΓΧΟΣ ΑΠΕΤΥΧΕ — ${diffs.length} διαφορές: ${diffs.slice(0, 3).join(' · ')}` : '✅ Αυτοέλεγχος: τα εθνικά νούμερα αναπαράγονται ταυτόσημα με τη μητρική αναφορά')
    : '⚠️ Αυτοέλεγχος: η μητρική αναφορά δεν έχει «υπόλοιπες μέρες»');
  if (theirs && diffs.length) process.exit(1);
}

// ── Η ΜΕΤΡΗΣΗ: ανά σταθμό, σε μέρες χωρίς μελτέμι ────────────────────────────────────────────
const MORNING = 'πρωί 08-11', NOON = 'μεσημέρι 12-16', EVENING = 'απόγευμα 17-20';
const MIN_BUCKET_HOURS = 200, BIAS_GAP_KMH = -2.0, FALSE_BLUE_FACTOR = 2, LOCAL_MIN_STATIONS = 8, TWO_SIGN_MIN = 5;
const deltaOf = buckets => ({
  eveningMinusMorningBiasKmh: round((buckets[EVENING].biasKmh ?? NaN) - (buckets[MORNING].biasKmh ?? NaN)),
  noonMinusMorningBiasKmh: round((buckets[NOON].biasKmh ?? NaN) - (buckets[MORNING].biasKmh ?? NaN)),
  falseBlueRatio: buckets[MORNING].falseBluePct ? round((buckets[EVENING].falseBluePct ?? 0) / buckets[MORNING].falseBluePct, 2) : null,
  enoughHours: [MORNING, NOON, EVENING].every(b => (buckets[b].n ?? 0) >= MIN_BUCKET_HOURS),
});
const passesTest = d => d.enoughHours && d.eveningMinusMorningBiasKmh <= BIAS_GAP_KMH && d.falseBlueRatio !== null && d.falseBlueRatio >= FALSE_BLUE_FACTOR;

const national = byBucket(quiet);
const nationalDelta = deltaOf(national);
const perStation = STATIONS.map(([icao, name]) => {
  const list = quiet.filter(d => d.icao === icao);
  const buckets = byBucket(list);
  const delta = deltaOf(buckets);
  return { icao, name, group: groupOf[icao] ?? 'άλλο', pointElevationM: stationElevation[icao] ?? null, quietDays: list.length, buckets, ...delta, passes: passesTest(delta) };
}).sort((a, b) => (a.eveningMinusMorningBiasKmh ?? 0) - (b.eveningMinusMorningBiasKmh ?? 0));

const usable = perStation.filter(s => s.enoughHours);
const passing = usable.filter(s => s.passes);
const negative = usable.filter(s => s.eveningMinusMorningBiasKmh <= BIAS_GAP_KMH);
const positive = usable.filter(s => s.eveningMinusMorningBiasKmh >= -BIAS_GAP_KMH);
const twoSignBrake = negative.length >= TWO_SIGN_MIN && positive.length >= TWO_SIGN_MIN;
const nationalPasses = passesTest(nationalDelta);
const verdict = twoSignBrake
  ? 'ΦΡΕΝΟ ΔΥΟ ΠΡΟΣΗΜΩΝ — καμία εθνική σταθερά δεν επιτρέπεται· η αστοχία (όπου υπάρχει) είναι τοπική'
  : nationalPasses ? 'Α · ΕΘΝΙΚΗ ΑΠΟΓΕΥΜΑΤΙΝΗ ΥΠΟΕΚΤΙΜΗΣΗ'
    : passing.length >= LOCAL_MIN_STATIONS ? 'Β · ΤΟΠΙΚΗ ΑΣΤΟΧΙΑ (όχι εθνική διόρθωση)'
      : 'Γ · ΔΕΝ ΥΠΑΡΧΕΙ συστηματική απογευματινή υποεκτίμηση στο αεροδρόμιο';

// Δεύτερη ανάγνωση: το μισό της χώρας δείχνει τον ΩΜΟ μέσο (θαλάσσια πόρτα, υψόμετρο κελιού 0).
const bySeaDoor = { 'υψόμετρο 0 (ωμός μέσος)': [], 'υψόμετρο >0 (αποσυμπίεση)': [] };
for (const s of usable) bySeaDoor[(s.pointElevationM ?? 0) === 0 ? 'υψόμετρο 0 (ωμός μέσος)' : 'υψόμετρο >0 (αποσυμπίεση)'].push(s);
const groupSummary = Object.fromEntries(Object.entries({
  ...Object.fromEntries(Object.keys(GROUP).map(g => [g, usable.filter(s => s.group === g)])), ...bySeaDoor,
}).map(([k, list]) => [k, {
  σταθμοί: list.length,
  διάμεσοΧάσμαΑπόγευμαΠρωί: list.length ? round(([...list].sort((a, b) => a.eveningMinusMorningBiasKmh - b.eveningMinusMorningBiasKmh)[list.length >> 1]).eveningMinusMorningBiasKmh) : null,
  περνούν: list.filter(s => s.passes).length,
}]));

// ── ΔΕΥΤΕΡΗ ΑΝΑΓΝΩΣΗ (ΕΞΕΡΕΥΝΗΤΙΚΗ — δηλώνεται ως τέτοια, ΔΕΝ είναι μέρος του κανόνα πιο πάνω) ──
// Ο κριτής ΕΑΑ (meteo.gr) δίνει ΜΟΝΟ ημερήσιες συνόψεις, οπότε το `reports/weather/meteo-gr-stations-2026-summer.json`
// συγκρίνει ημερήσιους μέσους ΟΛΩΝ των ωρών. Η μέτρηση πιο πάνω συγκρίνει ΩΡΕΣ 08-20. Οι δύο αριθμοί ΔΕΝ είναι
// συγκρίσιμοι: ο ημερήσιος μέσος κουβαλάει τη νύχτα, όπου η αποσυμπίεση (2,392 + 1,0005×v) σηκώνει κάθε άπνοια.
// Εδώ φτιάχνεται ο ΙΔΙΟΣ αριθμός για τα αεροδρόμια — ημερήσιος μέσος όλων των ωρών — ώστε μια διαφωνία προσήμου
// ανάμεσα σε αεροδρόμιο και σταθμό ΕΑΑ του ίδιου νησιού να σημαίνει «άλλος τόπος» και όχι «άλλη μέθοδος».
const dailyMeanBias = (selectDays) => {
  const perDay = selectDays.map(d => {
    const hs = d.hours.filter(Boolean);
    return hs.length >= 20 ? { obs: mean(hs.map(r => r.obs)), prod: mean(hs.map(r => r.prod)), raw: mean(hs.map(r => r.raw)) } : null;
  }).filter(Boolean);
  return perDay.length ? {
    days: perDay.length, obsMeanKmh: round(mean(perDay.map(x => x.obs))), shownMeanKmh: round(mean(perDay.map(x => x.prod))),
    rawMeanKmh: round(mean(perDay.map(x => x.raw))), shownMinusObsKmh: round(mean(perDay.map(x => x.prod - x.obs))), rawMinusObsKmh: round(mean(perDay.map(x => x.raw - x.obs))),
  } : { days: 0 };
};
const dailyComparable = Object.fromEntries(STATIONS.map(([icao, name]) => {
  const list = allDays.filter(d => d.icao === icao);
  return [icao, { name, allDays: dailyMeanBias(list), quiet: dailyMeanBias(list.filter(d => d.meltemiObs === false && d.meltemiModel === false)) }];
}));
dailyComparable.TOTAL = { name: 'όλα τα αεροδρόμια', allDays: dailyMeanBias(allDays), quiet: dailyMeanBias(quiet) };

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Σε μέρες ΧΩΡΙΣ μελτέμι, υποδείχνει το μοντέλο τον απογευματινό αέρα περισσότερο απ᾽ ό,τι τον πρωινό — και αν ναι, εθνικά ή σε λίγους τόπους;',
  judge: 'METAR ASOS, 30 παράκτια αεροδρόμια, καλοκαίρια 2024-2026 — από τη μνήμη της measureWindDiurnalTiming (καμία νέα λήψη)',
  rulesDeclaredBeforeRun: {
    Α: `bias(απόγευμα)−bias(πρωί) ≤ ${BIAS_GAP_KMH} χλμ/ώ ΚΑΙ falseBlue(απόγευμα) ≥ ${FALSE_BLUE_FACTOR}× falseBlue(πρωί)`,
    Β: `αλλιώς, ≥${LOCAL_MIN_STATIONS}/30 σταθμοί περνούν το ίδιο τεστ μόνοι τους (≥${MIN_BUCKET_HOURS} ώρες/κουβά)`,
    Γ: 'αλλιώς δεν υπάρχει',
    φρένο: `≥${TWO_SIGN_MIN} σταθμοί ≤${BIAS_GAP_KMH} ΚΑΙ ≥${TWO_SIGN_MIN} σταθμοί ≥${-BIAS_GAP_KMH} ⇒ καμία εθνική σταθερά, υπερισχύει`,
  },
  limits: ['ο κριτής είναι αεροδρόμιο, όχι παραλία — αν η αύρα μπαίνει μόνο στα τελευταία 500 μ. της ακτής δεν φαίνεται εδώ', '10-λεπτος μέσος οργάνου vs στιγμιαία τιμή μοντέλου', 'το best_match άλλαξε σύνθεση μέσα στα τρία καλοκαίρια'],
  selfCheck,
  pairs: rows.length, stationDays: allDays.length, quietStationDays: quiet.length,
  national, nationalDelta, nationalPasses,
  stationsUsable: usable.length, stationsPassing: passing.length, stationsNegative: negative.length, stationsPositive: positive.length, twoSignBrake,
  verdict, groupSummary, perStation,
  dailyComparableNote: 'ΕΞΕΡΕΥΝΗΤΙΚΟ, εκτός του προδηλωμένου κανόνα: ημερήσιος μέσος ΟΛΩΝ των ωρών στα αεροδρόμια, ώστε να συγκρίνεται με τον κριτή ΕΑΑ (meteo-gr-stations-2026-summer.json), που δίνει μόνο ημερήσιες συνόψεις.',
  dailyComparable,
};
const outFile = path.join(root, `reports/weather/sea-breeze-miss-${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

const f = (v, w) => String(v ?? '—').padStart(w);
console.log(`\n=== ΜΕΡΕΣ ΧΩΡΙΣ ΜΕΛΤΕΜΙ — εθνικά (${quiet.length.toLocaleString('el')} μέρες-σταθμοί) ===`);
for (const b of Object.keys(BUCKETS)) {
  const s = national[b];
  console.log(`  ${b.padEnd(16)} n=${f(s.n, 6)} · μεροληψία ${f(s.biasKmh, 5)} χλμ/ώ · όργανο ${f(s.obsMeanKmh, 5)} / δείχνουμε ${f(s.shownMeanKmh, 5)} · «χαμηλότερα» ${f(s.underPct, 5)}% · ψεύτικο μπλε ${f(s.falseBluePct, 5)}%`);
}
console.log(`  απόγευμα − πρωί: μεροληψία ${nationalDelta.eveningMinusMorningBiasKmh} χλμ/ώ (όριο ${BIAS_GAP_KMH}) · λόγος ψεύτικου μπλε ${nationalDelta.falseBlueRatio} (όριο ${FALSE_BLUE_FACTOR}) → ${nationalPasses ? 'ΠΕΡΝΑΕΙ' : 'δεν περνάει'}`);
console.log(`\n=== ΑΝΑ ΣΤΑΘΜΟ (χάσμα απόγευμα−πρωί, αύξουσα· ${usable.length} με αρκετές ώρες) ===`);
for (const s of perStation) {
  if (!s.enoughHours) continue;
  console.log(`  ${s.icao} ${s.name.slice(0, 18).padEnd(18)} ${s.group.slice(0, 18).padEnd(18)} υψ.${f(s.pointElevationM, 4)} · πρωί ${f(s.buckets[MORNING].biasKmh, 5)} → απόγ. ${f(s.buckets[EVENING].biasKmh, 5)} (χάσμα ${f(s.eveningMinusMorningBiasKmh, 5)}) · ψεύτ. μπλε ${f(s.buckets[MORNING].falseBluePct, 5)}→${f(s.buckets[EVENING].falseBluePct, 5)}% ${s.passes ? '← ΠΕΡΝΑΕΙ' : ''}`);
}
console.log(`\n  Σταθμοί με χάσμα ≤${BIAS_GAP_KMH}: ${negative.length} · με χάσμα ≥${-BIAS_GAP_KMH}: ${positive.length} · περνούν το πλήρες τεστ: ${passing.length}/${usable.length}`);
for (const [k, v] of Object.entries(groupSummary)) console.log(`  ${k.padEnd(28)} σταθμοί ${f(v.σταθμοί, 3)} · διάμεσο χάσμα ${f(v.διάμεσοΧάσμαΑπόγευμαΠρωί, 6)} χλμ/ώ · περνούν ${v.περνούν}`);
const dc = dailyComparable.TOTAL;
console.log(`\n=== ΣΥΓΚΡΙΣΙΜΟ ΜΕ ΤΟΝ ΚΡΙΤΗ ΕΑΑ (ημερήσιος μέσος όλων των ωρών — εξερευνητικό) ===`);
console.log(`  30 αεροδρόμια, όλες οι μέρες: όργανο ${dc.allDays.obsMeanKmh} · ωμό μοντέλο ${dc.allDays.rawMeanKmh} (${dc.allDays.rawMinusObsKmh}) · δείχνουμε ${dc.allDays.shownMeanKmh} (${dc.allDays.shownMinusObsKmh}) · ${dc.allDays.days} μέρες`);
console.log(`  χωρίς μελτέμι:                όργανο ${dc.quiet.obsMeanKmh} · ωμό ${dc.quiet.rawMeanKmh} (${dc.quiet.rawMinusObsKmh}) · δείχνουμε ${dc.quiet.shownMeanKmh} (${dc.quiet.shownMinusObsKmh}) · ${dc.quiet.days} μέρες`);
for (const icao of ['LGRP', 'LGNX', 'LGSM', 'LGKO', 'LGPA']) {
  const x = dailyComparable[icao];
  if (x?.allDays?.days) console.log(`  ${icao} ${x.name.padEnd(14)} όλες οι μέρες: όργανο ${f(x.allDays.obsMeanKmh, 5)} · δείχνουμε ${f(x.allDays.shownMeanKmh, 5)} → ${f(x.allDays.shownMinusObsKmh, 5)} χλμ/ώ`);
}
console.log(`\nΕΤΥΜΗΓΟΡΙΑ: ${verdict}`);
console.log(`→ ${path.relative(root, outFile)}`);
