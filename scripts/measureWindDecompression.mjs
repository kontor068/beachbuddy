#!/usr/bin/env node
/**
 * ΞΕΣΤΡΩΝΕΙ ΜΙΑ ΔΙΟΡΘΩΣΗ ΤΟ ΜΕΛΤΕΜΙ ΧΩΡΙΣ ΝΑ ΦΟΥΣΚΩΝΕΙ ΤΗΝ ΑΠΝΟΙΑ; — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΙ ΞΕΡΟΥΜΕ ΗΔΗ (utils/windGustFloor.ts, 4 παράθυρα, ~32.000 ώρες-σταθμοί): ο `best_match`
 * είναι το καλύτερο διαθέσιμο μοντέλο ΚΑΙ συμπιέζει το εύρος — κλίση 0,64-0,71 στην ευθεία
 * «μοντέλο = a + b × μέτρηση»: φουσκώνει την άπνοια, ισοπεδώνει το μελτέμι. Η σημερινή
 * παραγωγή το μετριάζει με τον δάπεδο ριπής (×0,50), που η βίβλος ονομάζει «στατιστικό
 * επίδεσμο» (§ΑΞ1/Α3) και πάνω στον οποίο απαγορεύει τρίτο κανόνα. Ένας σκέτος πολλαπλασιαστής
 * ×1,20 βαθμονομήθηκε σε ΕΝΑ παράθυρο και κόπηκε στα άλλα τρία — overfit.
 *
 * ΤΙ ΡΩΤΑΕΙ ΑΥΤΟ ΤΟ ΣΚΡΙΠΤ. Υπάρχει διόρθωση ΣΧΗΜΑΤΟΣ (όχι μέγεθος) που να αντιστρέφει τη
 * συμπίεση — να ανεβάζει τα 5-7 Μποφόρ που διαβάζονται χαμηλά ΧΩΡΙΣ να ανεβάζει τα 0-2 που
 * διαβάζονται ψηλά — και να στέκει σε παράθυρο ΚΑΙ σταθμούς που δεν είδε ποτέ;
 *
 * Η ΜΕΘΟΔΟΣ ΕΙΝΑΙ ΤΗΣ ΒΙΒΛΟΥ (§Γ35, §Γ45): βαθμονόμηση στους ΖΥΓΟΥΣ σταθμούς ενός παραθύρου,
 * κρίση στους ΜΟΝΟΥΣ σταθμούς ΤΡΙΩΝ ΑΛΛΩΝ παραθύρων. Ό,τι κερδίζει μόνο εκεί που βαθμονομήθηκε
 * είναι overfit και απορρίπτεται. Τρέχει και ανάποδα (μονοί → ζυγοί) για να φανεί αν οι
 * συντελεστές είναι ιδιότητα του μοντέλου ή του δείγματος.
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΤΑΙ — πάντα με το νούμερο που ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ (§Γ35: ο ωμός μέσος δεν είναι
 * παραγωγή), δηλαδή μετά τον δάπεδο ριπής (`applyGustFloor`, ο ίδιος κώδικας που τρέχει):
 *   raw        ωμός ωριαίος μέσος του μοντέλου
 *   prod       ό,τι τυπώνουμε σήμερα = δάπεδος ριπής πάνω στον ωμό
 *   scale      ×k (ο «πολλαπλασιαστής» — υπάρχει για να ξαναδούμε γιατί κόπηκε)
 *   linear     a + b×v (αντιστροφή της συμπίεσης σε όλο το εύρος)
 *   decomp     v αμετάβλητο κάτω από 12 χλμ/ώ (0-2 Μπφ), T + β(v−T) από εκεί και πάνω —
 *              η άπνοια δεν αγγίζεται, μόνο το εύρος πάνω από το μπλε
 *   quantile   αντιστοίχιση ποσοστημορίων μοντέλου → οργάνου (η κλασική διόρθωση συμπίεσης)
 * Κάθε διόρθωση δοκιμάζεται σε ΔΥΟ βάσεις: πάνω στον ωμό (αντικαθιστά τον δάπεδο) και πάνω
 * στην παραγωγή (στοιβάζεται — αυτό που το §ΑΞ1/Α3 λέει να μη γίνει· μετριέται για να φανεί).
 *
 * ΤΙ ΜΕΤΡΙΕΤΑΙ. Σφάλμα/μεροληψία σε χλμ/ώ, σωστό Μποφόρ (η «βαθμονόμηση»), χαμηλά/ψηλά ≥1 Μπφ,
 * ΨΕΥΤΙΚΗ ΗΡΕΜΙΑ (εμείς ≤2 Μπφ, όργανο ≥4 — σκανδάλη #1 του §9), ψεύτικος συναγερμός (εμείς ≥4,
 * όργανο ≤2), «χαμηλά στο μελτέμι» (όργανο ≥5: πόσο συχνά είμαστε ≥1 Μπφ κάτω), «φούσκωμα της
 * άπνοιας» (όργανο ≤1: πόσο συχνά είμαστε ≥1 Μπφ πάνω), και μεροληψία ανά Μποφόρ οργάνου.
 *
 * ΟΡΙΑ. Κριτής αεροδρόμιο, όχι παραλία. METAR σε κόμβους (±1,9 χλμ/ώ). Δωρεάν πόρτα Open-Meteo,
 * 92 ημέρες πίσω, Μάιος-Αύγουστος μόνο. Ο ίδιος κώδικας που ΔΕΝ κρίνει χρώμα: το χρώμα θέλει
 * και θάλασσα και γεωμετρία· εδώ μετριέται μόνο ο άνεμος που μπαίνει στο χρώμα.
 *
 * ΔΕΝ αλλάζει καμία σταθερά. Γράφει reports/weather/wind-decompression-<ημερομηνία>.json.
 *   node scripts/measureWindDecompression.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { STATIONS, fetchStationHours } from './lib/windStations.mjs';

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
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

// Ο χρήστης δεν βλέπει χλμ/ώ, βλέπει ΧΡΩΜΑ. Ίδια μέθοδος με το colour sweep του gust floor
// (auditWindAgainstStations.mjs): ο πραγματικός κώδικας χρώματος, χωρίς θάλασσα και χωρίς
// κόλπο, αθροισμένος και στα τρία επίπεδα έκθεσης ώστε να απομονωθεί το εφέ του ανέμου.
// Το χρώμα εξαρτάται εδώ μόνο από (έκθεση, Μποφόρ) — άρα πίνακας, όχι 1,4 εκατ. κλήσεις.
const TONE_EXPOSURES = ['protected', 'partial', 'exposed'];
const toneTable = new Map();
const toneOf = (exposureLevel, kmh) => {
  const key = `${exposureLevel}|${getBeaufortLevel(kmh)}`;
  if (!toneTable.has(key)) {
    toneTable.set(key, resolveConditionTone({
      exposureLevel, beaufort: getBeaufortLevel(kmh), isEnclosedCove: false, seaStateM: undefined,
    }));
  }
  return toneTable.get(key);
};

// ── Παράθυρα: ένα βαθμονομεί, τρία κρίνουν. Τα ίδια τέσσερα που μέτρησαν τον δάπεδο ριπής,
// ώστε τα νούμερα να συγκρίνονται με τον πίνακα του utils/windGustFloor.ts.
// Το τέταρτο παράθυρο του πίνακα (20/05-05/06) ΔΕΝ πιάνεται από τη δωρεάν πόρτα: μετρήθηκε
// 23/08/2026 ότι το api.open-meteo.com γυρίζει null πριν από ~18/06 (66 ημέρες), όχι τις 92
// που γράφει η τεκμηρίωση. Με το πληρωμένο κλειδί στο περιβάλλον (OPEN_METEO_API_KEY) το
// μοντέλο έρχεται από το customer-historical-forecast-api (αρχείο των ίδιων των προγνώσεων,
// ίδια πηγή για ΟΛΑ τα παράθυρα ώστε να συγκρίνονται) και μπαίνει και ο Μάιος.
const API_KEY = process.env.OPEN_METEO_API_KEY?.trim() || null;
const WINDOWS = {
  A: ['2026-06-20', '2026-07-05'],
  B: ['2026-08-04', '2026-08-18'],
  C: ['2026-07-10', '2026-07-25'],
  ...(API_KEY ? { D: ['2026-05-20', '2026-06-05'] } : {}),
};
const CALIBRATION_WINDOW = 'A';
const JUDGING_WINDOWS = API_KEY ? ['B', 'C', 'D'] : ['B', 'C'];
const DECOMP_T_KMH = 12; // πρώτο χλμ/ώ των 3 Μποφόρ — κάτω από εκεί η πινέζα είναι μπλε από μόνη της

const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const round = (n, p = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
const bft = v => getBeaufortLevel(v);

// ── 1. Δεδομένα: όργανο + μοντέλο στις συντεταγμένες του οργάνου, ανά παράθυρο ─────────────
const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
};

const rowsByWindow = {};
for (const [key, [start, end]] of Object.entries(WINDOWS)) {
  const startMs = Date.parse(`${start}T00:00:00Z`), endMs = Date.parse(`${end}T23:00:00Z`);
  process.stderr.write(`· ${key} ${start} → ${end}: όργανα…`);
  const observed = await fetchStationHours(startMs, endMs);
  process.stderr.write(` ${observed.size} ώρες-σταθμοί · μοντέλο…`);
  const meteo = await fetchJson((API_KEY
    ? 'https://customer-historical-forecast-api.open-meteo.com/v1/forecast'
    : 'https://api.open-meteo.com/v1/forecast')
    + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
    + `&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC&start_date=${start}&end_date=${end}`
    + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : ''));
  const entries = Array.isArray(meteo) ? meteo : [meteo];
  const rows = [];
  STATIONS.forEach(([icao, name], i) => {
    const m = entries[i];
    if (!m?.hourly?.time) return;
    const { time, wind_speed_10m: ws, wind_gusts_10m: wg } = m.hourly;
    for (let h = 0; h < time.length; h++) {
      const t = time[h].slice(0, 13);
      const obs = observed.get(`${icao}|${t}`);
      const raw = ws?.[h], gust = wg?.[h];
      if (!obs || !Number.isFinite(raw)) continue;
      const prod = applyGustFloor(raw, Number.isFinite(gust) ? gust : null, m.elevation);
      rows.push({ icao, name, stationIdx: i, window: key, time: t, raw, gust, elevation: m.elevation, prod, obs: obs.kmh });
    }
  });
  rowsByWindow[key] = rows;
  process.stderr.write(` ${rows.length} ζευγάρια\n`);
  if (rows.length < 500) { console.error(`πολύ λίγα ζευγάρια στο ${key} — δεν βγάζω συμπέρασμα`); process.exit(1); }
}

// ── 2. Οι διορθώσεις — καθεμία «μαθαίνει» μόνο από το σετ βαθμονόμησης ─────────────────────
const fitScale = (rows, src) => {
  const k = rows.reduce((s, r) => s + r.obs, 0) / (rows.reduce((s, r) => s + r[src], 0) || 1);
  return { params: { k: round(k, 4) }, apply: v => k * v };
};
const fitLinear = (rows, src) => {
  const n = rows.length;
  const mx = rows.reduce((s, r) => s + r[src], 0) / n, my = rows.reduce((s, r) => s + r.obs, 0) / n;
  let cov = 0, varx = 0;
  for (const r of rows) { cov += (r[src] - mx) * (r.obs - my); varx += (r[src] - mx) ** 2; }
  const b = varx ? cov / varx : 1, a = my - b * mx;
  return { params: { a: round(a, 3), b: round(b, 4) }, apply: v => Math.max(0, a + b * v) };
};
const fitDecomp = (rows, src, T = DECOMP_T_KMH) => {
  const above = rows.filter(r => r[src] >= T);
  // β = η κλίση που μηδενίζει τη μεροληψία ΠΑΝΩ από το T, με άξονα το ίδιο το T (το 12 μένει 12).
  const num = above.reduce((s, r) => s + (r.obs - T), 0), den = above.reduce((s, r) => s + (r[src] - T), 0);
  const beta = den > 0 ? Math.max(1, num / den) : 1;
  return { params: { T, beta: round(beta, 4), fittedOn: above.length }, apply: v => (v < T ? v : T + beta * (v - T)) };
};
const fitQuantile = (rows, src) => {
  const xs = rows.map(r => r[src]).sort((p, q) => p - q);
  const ys = rows.map(r => r.obs).sort((p, q) => p - q);
  const n = xs.length;
  const apply = v => {
    // θέση του v στην κατανομή του μοντέλου → ίδια θέση στην κατανομή του οργάνου
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (xs[mid] < v) lo = mid + 1; else hi = mid; }
    const i = Math.min(n - 1, Math.max(0, lo));
    return ys[i];
  };
  // για την αναφορά: πού στέλνει τα 5, 12, 20, 29, 39, 50 χλμ/ώ
  const probes = [5, 12, 20, 29, 39, 50];
  return { params: { n, map: Object.fromEntries(probes.map(p => [p, round(apply(p), 1)])) }, apply };
};

const CANDIDATES = [
  ['raw', null, null], ['prod', null, null],
  ['scale@raw', fitScale, 'raw'], ['scale@prod', fitScale, 'prod'],
  ['linear@raw', fitLinear, 'raw'], ['linear@prod', fitLinear, 'prod'],
  ['decomp@raw', fitDecomp, 'raw'], ['decomp@prod', fitDecomp, 'prod'],
  ['quantile@raw', fitQuantile, 'raw'], ['quantile@prod', fitQuantile, 'prod'],
];

// ── 3. Μετρικές — ό,τι διαβάζει ο χρήστης ως Μποφόρ/χρώμα ──────────────────────────────────
const describe = (rows, value) => {
  const n = rows.length;
  if (!n) return { n: 0 };
  let sumAbs = 0, sum = 0, exact = 0, under = 0, over = 0;
  let weCalm = 0, falseCalm = 0, weWindy = 0, falseAlarm = 0;
  let obsStrong = 0, strongUnder = 0, obsCalm = 0, calmOver = 0;
  let toneN = 0, toneOk = 0, toneFalseCalm = 0, toneFalseAlarm = 0;
  const byObsBft = {};
  for (const r of rows) {
    const v = value(r), d = v - r.obs;
    sumAbs += Math.abs(d); sum += d;
    const bv = bft(v), bo = bft(r.obs);
    if (bv === bo) exact++; else if (bv < bo) under++; else over++;
    if (bv <= 2) { weCalm++; if (bo >= 4) falseCalm++; }
    if (bv >= 4) { weWindy++; if (bo <= 2) falseAlarm++; }
    if (bo >= 5) { obsStrong++; if (bv <= bo - 1) strongUnder++; }
    if (bo <= 1) { obsCalm++; if (bv >= bo + 1) calmOver++; }
    for (const exposure of TONE_EXPOSURES) {
      const truth = toneOf(exposure, r.obs), shown = toneOf(exposure, v);
      toneN++;
      if (shown === truth) toneOk++;
      if (shown === 'blue' && truth !== 'blue') toneFalseCalm++;
      if (shown !== 'blue' && truth === 'blue') toneFalseAlarm++;
    }
    (byObsBft[bo] ||= []).push(d);
  }
  return {
    toneOkPct: pct(toneOk, toneN), toneFalseCalmPct: pct(toneFalseCalm, toneN), toneFalseAlarmPct: pct(toneFalseAlarm, toneN),
    n, maeKmh: round(sumAbs / n), biasKmh: round(sum / n),
    bftExactPct: pct(exact, n), underPct: pct(under, n), overPct: pct(over, n),
    falseCalmPct: pct(falseCalm, weCalm), falseCalmHours: falseCalm, weSayCalmHours: weCalm,
    falseAlarmPct: pct(falseAlarm, weWindy), falseAlarmHours: falseAlarm, weSayWindyHours: weWindy,
    meltemiUnderPct: pct(strongUnder, obsStrong), obsStrongHours: obsStrong,
    calmInflatePct: pct(calmOver, obsCalm), obsCalmHours: obsCalm,
    biasByObsBft: Object.fromEntries(Object.entries(byObsBft).map(([k, arr]) => [k, round(arr.reduce((s, x) => s + x, 0) / arr.length, 1)])),
  };
};

// ── 4. Το πείραμα, δύο φορές: ζυγοί→μονοί και μονοί→ζυγοί ─────────────────────────────────
const runExperiment = (calibParity) => {
  const isCalib = r => r.stationIdx % 2 === calibParity;
  const calibRows = rowsByWindow[CALIBRATION_WINDOW].filter(isCalib);
  const fitted = CANDIDATES.map(([name, fit, src]) => {
    const f = fit ? fit(calibRows, src) : null;
    const value = f ? (r => f.apply(r[src])) : (r => r[name]);
    return { name, src, params: f?.params ?? null, value };
  });
  const judge = {};
  const judgeSets = {
    [`${CALIBRATION_WINDOW}-calib`]: calibRows,
    [`${CALIBRATION_WINDOW}-held`]: rowsByWindow[CALIBRATION_WINDOW].filter(r => !isCalib(r)),
    ...Object.fromEntries(JUDGING_WINDOWS.map(w => [`${w}-held`, rowsByWindow[w].filter(r => !isCalib(r))])),
  };
  for (const [setName, rows] of Object.entries(judgeSets)) {
    judge[setName] = Object.fromEntries(fitted.map(c => [c.name, describe(rows, c.value)]));
  }
  return { calibParity, calibStations: STATIONS.filter((_, i) => i % 2 === calibParity).map(s => s[0]), params: Object.fromEntries(fitted.map(c => [c.name, c.params])), judge };
};

const even = runExperiment(0);
const odd = runExperiment(1);
even.verdict = null; odd.verdict = null; // συμπληρώνονται αμέσως μετά τον ορισμό του verdictFor

// ── 5. Ετυμηγορία ανά υποψήφιο, πάνω στα ΤΡΙΑ ξένα παράθυρα × μονοί σταθμοί ────────────────
// «Κερδίζει» = σε ΚΑΘΕ ξένο σετ: σωστό Μποφόρ ≥ παραγωγή, ψεύτικη ηρεμία ≤ παραγωγή,
// χαμηλά-στο-μελτέμι < παραγωγή. Ο ψεύτικος συναγερμός ΚΑΤΑΓΡΑΦΕΤΑΙ ως τίμημα, δεν αποκλείει
// (η βίβλος ζυγίζει τις δύο κατευθύνσεις άνισα — §5, §9 — και η ζυγαριά είναι του Μίλτου).
const heldSets = JUDGING_WINDOWS.map(w => `${w}-held`);
const verdictFor = (exp) => Object.fromEntries(CANDIDATES.map(([name]) => {
  if (name === 'raw' || name === 'prod') return [name, null];
  const wins = heldSets.every(set => {
    const c = exp.judge[set][name], p = exp.judge[set].prod;
    return c.bftExactPct >= p.bftExactPct && (c.falseCalmPct ?? 0) <= (p.falseCalmPct ?? 0) && c.meltemiUnderPct < p.meltemiUnderPct;
  });
  const costs = heldSets.map(set => round(exp.judge[set][name].falseAlarmPct - exp.judge[set].prod.falseAlarmPct, 1));
  return [name, { beatsProductionEverywhere: wins, falseAlarmDeltaPct: costs }];
}));

even.verdict = verdictFor(even);
odd.verdict = verdictFor(odd);

// ── 5β. Ο ΣΥΝΤΕΛΕΣΤΗΣ ΠΟΥ ΘΑ ΜΠΕΙ (24/08/2026, απόφαση Μίλτου: μπαίνει το linear@raw).
// Τα δύο μισά έδειξαν ότι η μορφή ΓΕΝΙΚΕΥΕΙ (κερδίζει σε ξένους σταθμούς και ξένα παράθυρα
// και με τα δύο σετ συντελεστών)· για την παραγωγή ο συντελεστής βγαίνει από ΟΛΟΥΣ τους
// σταθμούς του A — αλλά ΜΟΝΟ από ώρες χερσαίου κελιού, γιατί εκεί μόνο θα εφαρμοστεί:
// η εξαίρεση του θαλασσινού κελιού (SAR + ανεμόμετρα DEM-0: καμία συμπίεση πάνω από νερό,
// ΥΠΕΡεκτίμηση στα δυνατά) είναι το μισό της διόρθωσης του δαπέδου και ΔΕΝ αναιρείται από
// μέτρηση που έγινε 93% σε χερσαίους σταθμούς. Η κρίση γίνεται στον ΠΛΗΡΗ υποψήφιο
// παραγωγής — χερσαίο κελί → max(raw, a + b×raw), θαλάσσιο → η σημερινή πόρτα αυτούσια —
// απέναντι στην πλήρη σημερινή παραγωγή, σε ΟΛΕΣ τις ώρες των τριών ξένων παραθύρων.
const landOf = rows => rows.filter(r => (r.elevation ?? 0) > 0);
const shipCalibRows = landOf(rowsByWindow[CALIBRATION_WINDOW]);
const shipLinear = fitLinear(shipCalibRows, 'raw');
const shipValue = r => ((r.elevation ?? 0) > 0 ? Math.max(r.raw, shipLinear.apply(r.raw)) : r.prod);
const shipJudge = {};
for (const w of JUDGING_WINDOWS) {
  shipJudge[w] = {
    all: { prod: describe(rowsByWindow[w], r => r.prod), ship: describe(rowsByWindow[w], shipValue) },
    land: { prod: describe(landOf(rowsByWindow[w]), r => r.prod), ship: describe(landOf(rowsByWindow[w]), shipValue) },
  };
}
const shipFit = {
  decidedBy: 'Μίλτος 24/08/2026 — μπαίνει το linear@raw, με την εξαίρεση θαλασσινού κελιού ανέπαφη',
  params: shipLinear.params,
  fittedOnLandRows: shipCalibRows.length,
  landShareOfCalibration: pct(shipCalibRows.length, rowsByWindow[CALIBRATION_WINDOW].length),
  judge: shipJudge,
};

const report = {
  shipFit,
  generatedAt: new Date().toISOString(),
  question: 'Υπάρχει διόρθωση σχήματος που αντιστρέφει τη συμπίεση του best_match και στέκει σε παράθυρα και σταθμούς που δεν είδε;',
  method: 'Βαθμονόμηση στους ζυγούς/μονούς σταθμούς του παραθύρου A, κρίση στους άλλους μισούς στα B, C, D. Σύγκριση πάντα με την ΠΑΡΑΓΩΓΗ (applyGustFloor), όχι με τον ωμό μέσο (§Γ35).',
  windows: WINDOWS, calibrationWindow: CALIBRATION_WINDOW, judgingWindows: JUDGING_WINDOWS, decompT: DECOMP_T_KMH,
  hoursPerWindow: Object.fromEntries(Object.entries(rowsByWindow).map(([k, v]) => [k, v.length])),
  evenCalibrates: even,
  oddCalibrates: odd,
  limits: ['κριτής αεροδρόμιο, όχι παραλία', 'METAR ±1,9 χλμ/ώ', 'Μάιος-Αύγουστος 2026 μόνο', 'μετριέται ο άνεμος, όχι το χρώμα — το χρώμα θέλει και θάλασσα και γεωμετρία', 'ΔΕΝ είναι απόφαση: η ζυγαριά ψεύτικης ηρεμίας/ψεύτικου συναγερμού είναι του Μίλτου (§7δ)'],
};
const outPath = path.join(root, 'reports', 'weather', `wind-decompression-${report.generatedAt.slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

// ── 6. Πίνακας για άνθρωπο ────────────────────────────────────────────────────────────────
const fmt = (v, w = 6) => String(v ?? '—').padStart(w);
const printExp = (exp, title) => {
  console.log(`\n=== ${title} — βαθμονόμηση στο ${CALIBRATION_WINDOW} (${exp.calibStations.length} σταθμοί), κρίση στα ${JUDGING_WINDOWS.join('/')} στους άλλους ${STATIONS.length - exp.calibStations.length} ===`);
  console.log('συντελεστές:', JSON.stringify(Object.fromEntries(Object.entries(exp.params).filter(([, v]) => v).map(([k, v]) => [k, v.map ? { map: v.map } : v]))));
  for (const set of [`${CALIBRATION_WINDOW}-calib`, ...heldSets]) {
    console.log(`\n  [${set}]  n=${exp.judge[set].raw.n}`);
    console.log('  υποψήφιος      | σφάλμα | μερολ. | σωστόΜπφ | χαμηλά | ψηλά  | ψευτ.ηρεμία | ψευτ.συναγ. | χαμηλά@≥5Μπφ | φούσκ.άπνοιας | ΧΡΩΜΑ ok | χρ.ψ.ηρεμία | χρ.ψ.συναγ.');
    for (const [name] of CANDIDATES) {
      const d = exp.judge[set][name];
      const mark = set !== `${CALIBRATION_WINDOW}-calib` && exp.verdict?.[name]?.beatsProductionEverywhere ? ' ✓' : '';
      console.log(`  ${name.padEnd(14)} | ${fmt(d.maeKmh)} | ${fmt(d.biasKmh)} | ${fmt(d.bftExactPct + '%', 8)} | ${fmt(d.underPct + '%')} | ${fmt(d.overPct + '%', 5)} | ${fmt(d.falseCalmPct + '%', 11)} | ${fmt(d.falseAlarmPct + '%', 11)} | ${fmt(d.meltemiUnderPct + '%', 12)} | ${fmt(d.calmInflatePct + '%', 13)} | ${fmt(d.toneOkPct + '%', 8)} | ${fmt(d.toneFalseCalmPct + '%', 11)} | ${fmt(d.toneFalseAlarmPct + '%', 11)}${mark}`);
    }
  }
  console.log('\n  μεροληψία ανά Μποφόρ οργάνου (ξένα σετ μαζί), prod → decomp@raw → quantile@raw:');
  const merged = {};
  for (const set of heldSets) for (const name of ['prod', 'decomp@raw', 'quantile@raw']) {
    for (const [k, v] of Object.entries(exp.judge[set][name].biasByObsBft)) ((merged[name] ||= {})[k] ||= []).push(v);
  }
  for (const name of ['prod', 'decomp@raw', 'quantile@raw']) {
    console.log(`    ${name.padEnd(13)} ${Object.entries(merged[name]).sort((a, b) => a[0] - b[0]).map(([k, arr]) => `${k}Μπφ:${fmt(round(arr.reduce((s, x) => s + x, 0) / arr.length, 1), 5)}`).join('  ')}`);
  }
  console.log('\n  ✓ = κερδίζει την παραγωγή σε ΚΑΘΕ ξένο σετ (σωστό Μπφ ≥, ψεύτικη ηρεμία ≤, χαμηλά@≥5 <). Τίμημα ψευτ. συναγερμού:',
    JSON.stringify(Object.fromEntries(Object.entries(exp.verdict ?? {}).filter(([, v]) => v).map(([k, v]) => [k, v.falseAlarmDeltaPct]))));
};
printExp(even, 'ΖΥΓΟΙ βαθμονομούν, ΜΟΝΟΙ κρίνουν');
printExp(odd, 'ΜΟΝΟΙ βαθμονομούν, ΖΥΓΟΙ κρίνουν');

console.log(`\n=== Ο ΥΠΟΨΗΦΙΟΣ ΠΑΡΑΓΩΓΗΣ — fit σε ${shipCalibRows.length} χερσαίες ώρες όλων των σταθμών του A (${shipFit.landShareOfCalibration}% του A) ===`);
console.log('συντελεστές:', JSON.stringify(shipLinear.params));
for (const w of JUDGING_WINDOWS) {
  for (const [scope, label] of [['all', 'όλες οι ώρες'], ['land', 'μόνο χερσαία κελιά']]) {
    const p = shipJudge[w][scope].prod, c = shipJudge[w][scope].ship;
    console.log(`  [${w} ${label}] n=${p.n}  σωστόΜπφ ${p.bftExactPct}%→${c.bftExactPct}%  ψευτ.ηρεμία ${p.falseCalmPct}%→${c.falseCalmPct}%  χαμηλά@≥5Μπφ ${p.meltemiUnderPct}%→${c.meltemiUnderPct}%  ψευτ.συναγ. ${p.falseAlarmPct}%→${c.falseAlarmPct}%  ΧΡΩΜΑ ok ${p.toneOkPct}%→${c.toneOkPct}%`);
  }
}
console.log(`\nΓράφτηκε: ${path.relative(root, outPath)}`);
