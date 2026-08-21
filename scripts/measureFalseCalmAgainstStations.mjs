#!/usr/bin/env node
/**
 * ΟΤΑΝ ΕΜΕΙΣ ΛΕΜΕ «ΗΡΕΜΑ», ΤΙ ΛΕΕΙ ΤΟ ΟΡΓΑΝΟ; — ΜΕΤΡΗΣΗ ΨΕΥΤΙΚΗΣ ΗΡΕΜΙΑΣ.
 *
 * ΑΦΟΡΜΗ. Αχαράβη Κέρκυρας, 21/08/2026 17:45. Το μοντέλο στην πινέζα: μέσος 9,2 χλμ/ώ (2 Μπφ)
 * με ριπή 30,6 (λόγος 3,33). Το ανεμόμετρο της Κέρκυρας την ίδια ώρα: `LGKR 211450Z 24012KT`
 * — 22 χλμ/ώ ΣΤΑΘΕΡΑ (4 Μπφ), ΚΑΜΙΑ ριπή δηλωμένη. Ο χρήστης έβλεπε τις ομπρέλες να κυματίζουν.
 * Δεύτερη φορά ίδια παραλία: η ίδια ήταν και η αφορμή του `measureCalmHourGusts` στις 20/08.
 *
 * ΤΙ ΡΩΤΑΕΙ ΑΥΤΗ Η ΜΕΤΡΗΣΗ, που οι προηγούμενες δεν ρώτησαν:
 *
 *   1. Στις ώρες που ΤΟ ΜΟΝΤΕΛΟ ΜΑΣ λέει ≤2 Μποφόρ — δηλαδή στις ώρες που η πινέζα βγαίνει
 *      μπλε χωρίς καμία άλλη προϋπόθεση (`utils/suitabilityTone`, τελευταία γραμμή της σκάλας)
 *      — τι δείχνει το όργανο; Αυτό είναι το ΑΚΡΙΒΕΣ ερώτημα του παραπόνου. Οι παλιές μετρήσεις
 *      έκοβαν το δείγμα με βάση την ΠΑΡΑΤΗΡΗΣΗ («calm hours» = όργανο ≤2), που απαντά σε άλλο
 *      ερώτημα: «όταν όντως έχει άπνοια, έχει ριπές;». Εδώ κόβουμε με βάση ΕΜΑΣ.
 *
 *   2. Είναι το λάθος ΣΤΑΘΕΡΟΣ ΑΝΕΜΟΣ ή ΡΙΠΗ; Το METAR δηλώνει ριπή (`G`) μόνο όταν η διαφορά
 *      από τον μέσο είναι ≥10 κόμβοι. Αν οι ώρες μας βγαίνουν χωρίς `G` στο όργανο ενώ εμείς
 *      δίνουμε λόγο ριπής >3, τότε η ριπή μας είναι φούσκα και ο μέσος μας είναι το πρόβλημα.
 *
 *   3. Παίζει ρόλο η ΔΙΕΥΘΥΝΣΗ; Η αφορμή ήταν δυτικός άνεμος στο Ιόνιο. Αν το λάθος είναι
 *      ισοκατανεμημένο στους 8 τομείς, δεν είναι ιδιαιτερότητα του Ιονίου.
 *
 *   4. Παίζει ρόλο το ΥΨΟΜΕΤΡΟ ΤΟΥ ΣΗΜΕΙΟΥ (η πόρτα του `utils/windGustFloor`); Η Αχαράβη
 *      απαντάται από υψόμετρο 0, οπότε ο δάπεδος ριπής σιωπά εκτός αν ο λόγος ≥3,5. Ήταν 3,33.
 *
 *   5. ΤΙ ΘΑ ΑΛΛΑΖΕ, σε Μποφόρ, αν (α) έπεφτε το κατώφλι λόγου σε 3,0 (β) έπεφτε σε 2,5
 *      (γ) ο δάπεδος ίσχυε ΠΑΝΤΟΥ. Μετριέται και το τίμημα, όχι μόνο το κέρδος.
 *
 * ΓΙΑΤΙ ΞΕΧΩΡΙΣΤΟ ΑΡΧΕΙΟ ΚΑΙ ΟΧΙ ΕΠΕΚΤΑΣΗ ΤΟΥ `auditWindAgainstStations`. Εκείνο ζητά το
 * πληρωμένο κλειδί Open-Meteo από το Netlify και σταματά με «χωρίς κλειδί» όταν το token δεν
 * περνά — που είναι η τρέχουσα κατάσταση. Αυτό χτυπά τη ΔΩΡΕΑΝ πόρτα (μία ομαδική κλήση για
 * όλους τους σταθμούς, μόνο `best_match`), οπότε τρέχει πάντα. Το τίμημα: δεν συγκρίνει
 * μοντέλα μεταξύ τους — αυτό το έχει ήδη απαντήσει το `auditWindModelConsensus`.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει `reports/weather/false-calm-vs-stations-<ημερομηνία>.json`.
 *
 *   node scripts/measureFalseCalmAgainstStations.mjs [ημέρες_πίσω | YYYY-MM-DD:YYYY-MM-DD]
 *
 * ΟΡΙΑ. Ο κριτής είναι αεροδρόμιο, όχι παραλία. Το Open-Meteo κρατά 92 ημέρες στο forecast
 * endpoint. Το METAR στρογγυλοποιεί στους κόμβους, άρα ±1,9 χλμ/ώ κβαντισμός.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const STATIONS = [
  ['LGIR', 'Ηράκλειο', 35.3397, 25.1803], ['LGSA', 'Χανιά', 35.5317, 24.1497],
  ['LGST', 'Σητεία', 35.2161, 26.1013], ['LGRP', 'Ρόδος', 36.4054, 28.0862],
  ['LGKO', 'Κως', 36.7933, 27.0917], ['LGMK', 'Μύκονος', 37.4351, 25.3481],
  ['LGSR', 'Σαντορίνη', 36.3992, 25.4793], ['LGNX', 'Νάξος', 37.0811, 25.3681],
  ['LGPA', 'Πάρος', 37.0103, 25.1281], ['LGSK', 'Σκιάθος', 39.1771, 23.5037],
  ['LGKR', 'Κέρκυρα', 39.6019, 19.9117], ['LGZA', 'Ζάκυνθος', 37.7509, 20.8843],
  ['LGKF', 'Κεφαλονιά', 38.1201, 20.5005], ['LGPZ', 'Άκτιο', 38.9255, 20.7653],
  ['LGLM', 'Λήμνος', 39.9217, 25.2364], ['LGMT', 'Μυτιλήνη', 39.0567, 26.5983],
  ['LGSM', 'Σάμος', 37.6900, 26.9117], ['LGHI', 'Χίος', 38.3432, 26.1406],
  ['LGKL', 'Καλαμάτα', 37.0683, 22.0255], ['LGAL', 'Αλεξανδρούπολη', 40.8559, 25.9563],
  ['LGKV', 'Καβάλα', 40.9133, 24.6192], ['LGTS', 'Θεσσαλονίκη', 40.5197, 22.9709],
  ['LGKC', 'Κύθηρα', 36.2743, 23.0170], ['LGML', 'Μήλος', 36.6969, 24.4769],
  ['LGLE', 'Λέρος', 37.1849, 26.8003], ['LGKP', 'Κάρπαθος', 35.4214, 27.1460],
  ['LGIK', 'Ικαρία', 37.6827, 26.3470], ['LGSY', 'Σκύρος', 38.9676, 24.4872],
  ['LGBL', 'Ν. Αγχίαλος', 39.2196, 22.7943], ['LGRX', 'Άραξος', 38.1511, 21.4256],
];
/** Οι σταθμοί που κοιτούν το ίδιο πέλαγος με την αφορμή. */
const IONIAN = new Set(['LGKR', 'LGPZ', 'LGKF', 'LGZA', 'LGRX']);

const KT_TO_KMH = 1.852;
/** Η ίδια κλίμακα που χρωματίζει τις πινέζες (`utils/suitabilityTone` μέσω Μποφόρ). */
const bft = kmh => (kmh < 1 ? 0 : kmh <= 5 ? 1 : kmh <= 11 ? 2 : kmh <= 19 ? 3
  : kmh <= 28 ? 4 : kmh <= 38 ? 5 : kmh <= 49 ? 6 : 7);
const SECTORS = ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'];
const sector = deg => SECTORS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);
const round = (n, p = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);

const ARG = process.argv[2] || '21';
const WINDOW = ARG.includes(':') ? ARG.split(':') : null;
const DAYS_BACK = WINDOW ? null : Number(ARG);
const day = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = WINDOW ? Date.parse(`${WINDOW[1]}T00:00:00Z`) : Date.now();
const startMs = WINDOW ? Date.parse(`${WINDOW[0]}T00:00:00Z`) : endMs - DAYS_BACK * 86400000;
const [y1, m1, d1] = day(startMs), [y2, m2, d2] = day(endMs);
const label = WINDOW ? WINDOW.join(' → ') : `${DAYS_BACK} ημέρες`;

// ── 1. ΤΟ ΟΡΓΑΝΟ (αρχείο METAR, Iowa State) ───────────────────────────────────
// Το ζωντανό aviationweather.gov αγνοεί το `hours` πάνω από ~24, άρα δίνει ένα καθεστώς μόνο.
const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + STATIONS.map(s => `station=${s[0]}`).join('&')
  + `&data=sknt&data=drct&data=gust&year1=${y1}&month1=${m1}&day1=${d1}`
  + `&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
process.stderr.write('· κατεβάζω μετρήσεις σταθμών…\n');
const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(180000) });
if (!csvRes.ok) { console.error(`αρχείο μετρήσεων: HTTP ${csvRes.status}`); process.exit(1); }
const csv = await csvRes.text();

/** «ICAO|YYYY-MM-DDTHH» (UTC) -> {kmh, dir, gustKmh|null} — η παρατήρηση πιο κοντά στην ακέραιη ώρα. */
const observed = new Map();
for (const line of csv.split('\n').slice(1)) {
  const [icao, valid, sknt, drct, gust] = line.trim().split(',');
  if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
  const kt = Number(sknt);
  if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
  if (Number.isNaN(d.getTime())) continue;
  const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - rounded.getTime());
  const prev = observed.get(key);
  if (prev && prev.gap <= gap) continue;
  const gk = Number(gust);
  observed.set(key, {
    gap,
    kmh: kt * KT_TO_KMH,
    dir: Number.isFinite(Number(drct)) ? Number(drct) : null,
    // Το METAR γράφει `G` μόνο για διαφορά ≥10 κόμβων· η απουσία σημαίνει «σταθερός άνεμος».
    gustKmh: Number.isFinite(gk) && gk > 0 ? gk * KT_TO_KMH : null,
  });
}
process.stderr.write(`· ${observed.size} ώρες-σταθμοί από όργανα\n`);

// ── 2. ΤΟ ΜΟΝΤΕΛΟ (δωρεάν πόρτα, μία ομαδική κλήση) ───────────────────────────
const pastDays = Math.min(92, Math.max(1, Math.ceil((endMs - startMs) / 86400000)));
const meteoUrl = 'https://api.open-meteo.com/v1/forecast'
  + `?latitude=${STATIONS.map(s => s[2]).join(',')}`
  + `&longitude=${STATIONS.map(s => s[3]).join(',')}`
  + '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m'
  + `&past_days=${pastDays}&forecast_days=1&timezone=UTC&wind_speed_unit=kmh`;
process.stderr.write(`· ζητάω μοντέλο, ${pastDays} ημέρες πίσω…\n`);
const meteoRes = await fetch(meteoUrl, { signal: AbortSignal.timeout(120000) });
if (!meteoRes.ok) { console.error(`μοντέλο: HTTP ${meteoRes.status} — ${(await meteoRes.text()).slice(0, 200)}`); process.exit(1); }
const meteoRaw = await meteoRes.json();
const meteo = Array.isArray(meteoRaw) ? meteoRaw : [meteoRaw];

// ── 3. ΖΕΥΓΑΡΩΜΑ ──────────────────────────────────────────────────────────────
/** Κάθε εγγραφή: μία ώρα όπου έχουμε ΚΑΙ μοντέλο ΚΑΙ όργανο. */
const rows = [];
STATIONS.forEach(([icao, name, , ], i) => {
  const m = meteo[i];
  if (!m?.hourly?.time) return;
  const { time, wind_speed_10m: ws, wind_gusts_10m: wg, wind_direction_10m: wd } = m.hourly;
  for (let h = 0; h < time.length; h++) {
    const t = time[h].slice(0, 13);
    const ms = Date.parse(`${t}:00:00Z`);
    if (!(ms >= startMs && ms <= endMs)) continue;
    const obs = observed.get(`${icao}|${t}`);
    if (!obs) continue;
    const model = ws?.[h], gust = wg?.[h];
    if (!Number.isFinite(model)) continue;
    rows.push({
      icao, name, ionian: IONIAN.has(icao),
      elevation: m.elevation,
      model, gust: Number.isFinite(gust) ? gust : null,
      modelDir: Number.isFinite(wd?.[h]) ? wd[h] : null,
      obs: obs.kmh, obsDir: obs.dir, obsGust: obs.gustKmh,
      ratio: Number.isFinite(gust) && model > 0 ? gust / model : null,
    });
  }
});
process.stderr.write(`· ${rows.length} ζευγάρια ώρας\n`);
if (rows.length < 100) { console.error('πολύ λίγα ζευγάρια — δεν βγάζω συμπέρασμα'); process.exit(1); }

// ── 4. ΣΤΑΤΙΣΤΙΚΑ ─────────────────────────────────────────────────────────────
/** Κλίση/τομή της «μοντέλο = a + b × μέτρηση». Κλίση <1 = συμπίεση εύρους (στρώνει κορυφές). */
const fit = set => {
  const n = set.length;
  if (n < 30) return { n, bias: null, slope: null };
  const mx = set.reduce((s, r) => s + r.obs, 0) / n;
  const my = set.reduce((s, r) => s + r.model, 0) / n;
  let cov = 0, varx = 0;
  for (const r of set) { cov += (r.obs - mx) * (r.model - my); varx += (r.obs - mx) ** 2; }
  return { n, bias: round(my - mx), slope: varx ? round(cov / varx, 3) : null, obsMean: round(mx), modelMean: round(my) };
};
/** Πόσο συχνά πέφτουμε έξω σε ΜΠΟΦΟΡ — το μέγεθος που βλέπει ο χρήστης. */
const beaufort = set => {
  const n = set.length;
  if (!n) return { n };
  let exact = 0, low = 0, high = 0, low2 = 0;
  for (const r of set) {
    const d = bft(r.model) - bft(r.obs);
    if (d === 0) exact++; else if (d < 0) { low++; if (d <= -2) low2++; } else high++;
  }
  return { n, exactPct: pct(exact, n), tooLowPct: pct(low, n), tooLow2Pct: pct(low2, n), tooHighPct: pct(high, n) };
};
const describe = set => ({ ...fit(set), ...beaufort(set) });

const groupBy = (set, keyFn) => {
  const out = {};
  for (const r of set) { const k = keyFn(r); if (k == null) continue; (out[k] ||= []).push(r); }
  return out;
};
const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

// ── 5. ΤΟ ΚΥΡΙΟ ΕΡΩΤΗΜΑ: οι ώρες που ΕΜΕΙΣ λέμε «ήρεμα» ───────────────────────
const weSayCalm = rows.filter(r => bft(r.model) <= 2);
/** Ψεύτικη ηρεμία = εμείς ≤2 Μπφ ΚΑΙ το όργανο ≥4 Μπφ. Εκεί η μπλε πινέζα είναι λάθος. */
const falseCalm = weSayCalm.filter(r => bft(r.obs) >= 4);
/** Η υπογραφή της αφορμής: εμείς «ήρεμα με ριπές», το όργανο σταθερό χωρίς ριπή. */
const phantomGust = weSayCalm.filter(r => (r.ratio ?? 0) >= 3 && r.obsGust === null);

// ── 6. ΤΙ ΘΑ ΑΛΛΑΖΕ Ο ΔΑΠΕΔΟΣ ΡΙΠΗΣ ──────────────────────────────────────────
// Ίδιος κώδικας με `utils/windGustFloor`: πάνω από στεριά ισχύει πάντα· στο 0 μόνο αν ο λόγος
// ριπής προς μέσο ξεπερνά το κατώφλι. Δοκιμάζονται εναλλακτικά κατώφλια — και το τίμημά τους.
const floored = (r, threshold, everywhere) => {
  if (!Number.isFinite(r.gust) || r.gust <= 0) return r.model;
  if (!everywhere && r.elevation <= 0 && !(r.model > 0 && r.gust / r.model >= threshold)) return r.model;
  return Math.max(r.model, r.gust * 0.50);
};
const scenario = (threshold, everywhere) => {
  let touched = 0, fixed = 0, broke = 0, exact = 0, low = 0;
  for (const r of rows) {
    const after = floored(r, threshold, everywhere);
    const before = bft(r.model), now = bft(after), truth = bft(r.obs);
    if (after !== r.model) touched++;
    if (before !== now) { if (Math.abs(now - truth) < Math.abs(before - truth)) fixed++; else if (Math.abs(now - truth) > Math.abs(before - truth)) broke++; }
    if (now === truth) exact++; else if (now < truth) low++;
  }
  return {
    touchedHours: touched, touchedPct: pct(touched, rows.length),
    beaufortFixed: fixed, beaufortBroken: broke,
    exactPct: pct(exact, rows.length), tooLowPct: pct(low, rows.length),
  };
};

const report = {
  window: label,
  generatedAt: new Date().toISOString(),
  trigger: 'Αχαράβη Κέρκυρας 21/08/2026 17:45 — μοντέλο 9,2 χλμ/ώ με ριπή 30,6· LGKR 24012KT (22 χλμ/ώ σταθερά, καμία ριπή)',
  source: 'Open-Meteo best_match (δωρεάν πόρτα) vs METAR/ASOS',
  pairedHours: rows.length,
  stations: STATIONS.length,

  overall: describe(rows),
  ionian: describe(rows.filter(r => r.ionian)),
  rest: describe(rows.filter(r => !r.ionian)),

  /** Το κύριο ερώτημα: όταν βγάζουμε μπλε πινέζα «χωρίς όρους», τι λέει το όργανο; */
  weSayCalm: {
    hours: weSayCalm.length,
    pctOfAll: pct(weSayCalm.length, rows.length),
    ...describe(weSayCalm),
    obsBeaufortHistogram: mapValues(groupBy(weSayCalm, r => bft(r.obs)), v => ({ hours: v.length, pct: pct(v.length, weSayCalm.length) })),
    falseCalmHours: falseCalm.length,
    falseCalmPct: pct(falseCalm.length, weSayCalm.length),
    falseCalmIonianPct: pct(falseCalm.filter(r => r.ionian).length, weSayCalm.filter(r => r.ionian).length || 1),
  },

  /** Είναι η ριπή μας φούσκα; Στις ώρες που λέμε λόγο ≥3 και το όργανο ΔΕΝ δηλώνει ριπή. */
  phantomGust: {
    hours: phantomGust.length,
    pctOfWeSayCalm: pct(phantomGust.length, weSayCalm.length),
    modelGustMean: round(phantomGust.reduce((s, r) => s + (r.gust || 0), 0) / (phantomGust.length || 1)),
    obsMean: round(phantomGust.reduce((s, r) => s + r.obs, 0) / (phantomGust.length || 1)),
    modelMean: round(phantomGust.reduce((s, r) => s + r.model, 0) / (phantomGust.length || 1)),
    ...beaufort(phantomGust),
  },

  byPointElevation: mapValues(
    groupBy(rows, r => (r.elevation <= 0 ? 'θάλασσα (0 μ.)' : r.elevation <= 20 ? 'ακτή (1-20 μ.)' : 'στεριά (>20 μ.)')),
    describe),
  byObservedSector: mapValues(groupBy(rows, r => (r.obsDir == null ? null : sector(r.obsDir))), describe),
  byStation: Object.fromEntries(STATIONS.map(([icao, name]) => {
    const set = rows.filter(r => r.icao === icao);
    return [icao, { name, ...describe(set) }];
  }).filter(([, v]) => v.n)),

  /** Το κέρδος ΚΑΙ το τίμημα κάθε εναλλακτικού κατωφλιού. Καμία αλλαγή δεν γίνεται εδώ. */
  gustFloorScenarios: {
    'σήμερα (3,5 στη θάλασσα)': scenario(3.5, false),
    'κατώφλι 3,0': scenario(3.0, false),
    'κατώφλι 2,5': scenario(2.5, false),
    'παντού (καμία εξαίρεση θάλασσας)': scenario(-Infinity, true),
  },
};

const outDir = path.join(root, 'reports', 'weather');
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const outPath = path.join(outDir, `false-calm-vs-stations-${stamp}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

/**
 * ΤΟ ΤΑΜΠΛΟ ΤΟΥ ΕΞΩΤΕΡΙΚΟΥ ΚΡΙΤΗ (§ΑΞ1/Α6, 21/08/2026).
 *
 * Οι 66 πύλες ρωτούν «συμφωνεί η κάρτα με την πινέζα;». ΚΑΜΙΑ δεν ρωτάει «συμφωνεί το χρώμα με
 * το ανεμόμετρο;». Αυτή η μέτρηση το ρωτάει — αλλά μέχρι σήμερα έτρεχε μία φορά, με το χέρι, και
 * το αποτέλεσμα κατέληγε σε αρχείο με ημερομηνία που κανείς δεν ξανακοιτάζει.
 *
 * Δύο επιπλέον αρχεία, ώστε να γίνει ΤΑΚΤΙΚΟΣ έλεγχος αντί για εφάπαξ:
 *   • `external-scorecard.json`         — η ΤΕΛΕΥΤΑΙΑ φωτογραφία, σταθερό όνομα ώστε να μπορεί
 *                                          να τη διαβάσει πύλη ή ταμπλό χωρίς να ξέρει ημερομηνία.
 *   • `external-scorecard-history.json` — μία γραμμή ανά τρέξιμο, μόνο τα έξι νούμερα που
 *                                          μετράνε. Η ΤΑΣΗ είναι το προϊόν: μια σιωπηλή
 *                                          υποβάθμιση του upstream φαίνεται μόνο απέναντι στο
 *                                          χθες, και καμία πύλη δεν μπορεί να τη δει.
 *
 * ΔΕΝ είναι πύλη και δεν ρίχνει τίποτα: ο εξωτερικός κόσμος αλλάζει (καλοκαίρι/χειμώνας, νέα
 * έκδοση μοντέλου) και ένα κατώφλι εδώ θα ήταν αυθαίρετο. Είναι μετρητής που κρατάει ιστορικό.
 */
const scorecard = {
  measuredAt: report.generatedAt,
  window: report.window,
  pairedHours: report.pairedHours,
  stations: report.stations,
  exactBeaufortPct: report.overall.exactPct,
  biasKmh: report.overall.bias,
  slope: report.overall.slope,
  tooLowPct: report.overall.tooLowPct,
  falseCalmPct: report.weSayCalm.falseCalmPct,
  phantomGustPctOfCalm: report.phantomGust.pctOfWeSayCalm,
  source: path.relative(root, outPath).split(path.sep).join('/'),
};
const qualityDir = path.join(root, 'reports', 'quality');
fs.mkdirSync(qualityDir, { recursive: true });
fs.writeFileSync(path.join(qualityDir, 'external-scorecard.json'),
  `${JSON.stringify(scorecard, null, 2)}
`, 'utf8');

const historyPath = path.join(qualityDir, 'external-scorecard-history.json');
let history = [];
try { history = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch { /* πρώτο τρέξιμο */ }
if (!Array.isArray(history)) history = [];
// Ένα τρέξιμο ανά ημερομηνία: ξανατρέχοντας την ίδια μέρα διορθώνεται, δεν διπλογράφεται.
history = history.filter(entry => entry?.measuredAt?.slice(0, 10) !== stamp).concat(scorecard);
history.sort((a, b) => String(a.measuredAt).localeCompare(String(b.measuredAt)));
fs.writeFileSync(historyPath, `${JSON.stringify(history, null, 2)}
`, 'utf8');

console.log(`\nΠΑΡΑΘΥΡΟ ${label} · ${rows.length} ζευγάρια ώρας · ${Object.keys(report.byStation).length} σταθμοί\n`);
console.log(`ΣΥΝΟΛΟ            μεροληψία ${report.overall.bias} · κλίση ${report.overall.slope} · σωστό Μπφ ${report.overall.exactPct}% · χαμηλά ${report.overall.tooLowPct}%`);
console.log(`ΙΟΝΙΟ             μεροληψία ${report.ionian.bias} · κλίση ${report.ionian.slope} · σωστό Μπφ ${report.ionian.exactPct}% · χαμηλά ${report.ionian.tooLowPct}%`);
console.log(`ΥΠΟΛΟΙΠΗ ΧΩΡΑ     μεροληψία ${report.rest.bias} · κλίση ${report.rest.slope} · σωστό Μπφ ${report.rest.exactPct}% · χαμηλά ${report.rest.tooLowPct}%`);
console.log(`\nΟΤΑΝ ΕΜΕΙΣ ΛΕΜΕ ≤2 ΜΠΟΦΟΡ (μπλε πινέζα): ${report.weSayCalm.hours} ώρες (${report.weSayCalm.pctOfAll}% του δείγματος)`);
console.log(`  όργανο κατά Μποφόρ:`, JSON.stringify(report.weSayCalm.obsBeaufortHistogram));
console.log(`  ΨΕΥΤΙΚΗ ΗΡΕΜΙΑ (όργανο ≥4 Μπφ): ${report.weSayCalm.falseCalmHours} ώρες = ${report.weSayCalm.falseCalmPct}% · στο Ιόνιο ${report.weSayCalm.falseCalmIonianPct}%`);
console.log(`\nΦΑΝΤΑΣΜΑ ΡΙΠΗΣ (λόγος ≥3 σε εμάς, καμία ριπή στο όργανο): ${report.phantomGust.hours} ώρες = ${report.phantomGust.pctOfWeSayCalm}% των «ήρεμων»`);
console.log(`  εμείς μέσος ${report.phantomGust.modelMean} / ριπή ${report.phantomGust.modelGustMean} · όργανο ${report.phantomGust.obsMean} χλμ/ώ`);
console.log(`\nΣΕΝΑΡΙΑ ΔΑΠΕΔΟΥ:`);
for (const [k, v] of Object.entries(report.gustFloorScenarios)) {
  console.log(`  ${k.padEnd(34)} αγγίζει ${String(v.touchedPct + '%').padEnd(7)} διορθώνει ${String(v.beaufortFixed).padEnd(6)} χαλάει ${String(v.beaufortBroken).padEnd(6)} σωστό Μπφ ${v.exactPct}%`);
}
console.log(`\n→ ${path.relative(root, outPath)}\n`);
