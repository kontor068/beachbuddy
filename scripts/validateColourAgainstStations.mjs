#!/usr/bin/env node
/**
 * Ο ΦΥΛΑΚΑΣ ΜΕ ΠΡΑΓΜΑΤΙΚΟ ΟΡΓΑΝΟ — ΤΟ ΧΡΩΜΑ ΠΟΥ ΘΑ ΒΑΦΑΜΕ, ΑΠΕΝΑΝΤΙ ΣΤΑ ΑΝΕΜΟΜΕΤΡΑ (10/09/2026).
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Η σκανδάλη #2 του κλειδώματος του μοντέλου (βίβλος §9) είναι «ψευδο-ήρεμη πινέζα».
 * Ο φύλακάς της (`validateColourAgainstRealWind.mjs`, .github/workflows/truth-weekly.yml) συγκρίνει
 * το χρώμα με τον άνεμο της ΙΔΙΑΣ της πρόγνωσης — ελέγχει ότι ο κώδικας χρώματος δεν ψεύδεται
 * για τον άνεμο που ξέρουμε, ΟΧΙ ότι ο άνεμος που ξέρουμε είναι αληθινός. Αυτοαναφορικό (βίβλος
 * §Γ74-Η). Ο κριτής με όργανο (`auditWindAgainstStations.mjs`) υπήρχε, αλλά έτρεχε μόνο με το χέρι.
 *
 * ΤΙ ΚΑΝΕΙ. Για τις τελευταίες 4 μέρες (ή ρητό παράθυρο): τα METAR των 30 παράκτιων αεροδρομίων
 * (αρχείο ASOS του Iowa State, ανοιχτό) και τον άνεμο best_match στις ίδιες συντεταγμένες. Ο άνεμος
 * του μοντέλου περνά από την ΙΔΙΑ διόρθωση που εφαρμόζει η εφαρμογή (`utils/windGustFloor`
 * applyGustFloor, με το υψόμετρο του σημείου) και από τον ΙΔΙΟ κώδικα χρώματος
 * (`utils/suitabilityTone` resolveConditionTone), στα τρία επίπεδα έκθεσης — όπως ο κριτής με όργανο.
 *
 * ΤΙ ΚΟΒΕΙ. «Βαριά ψεύτικη ηρεμία»: βάφουμε ΜΠΛΕ εκεί που το όργανο δίνει ΠΟΡΤΟΚΑΛΙ ή ΚΟΚΚΙΝΟ,
 * ώρες 06-16 UTC (09-19 Ελλάδας — όταν παίρνονται οι αποφάσεις). Κάποιες τέτοιες ώρες υπάρχουν
 * πάντα (αεροδρόμιο ≠ παραλία, το μοντέλο στρώνει τις κορυφές — §Γ35), γι' αυτό το όριο ΔΕΝ είναι
 * «ούτε μία»: βγήκε από βαθμονόμηση 88 ημερών (`--calibrate`) και κόβει μόνο εβδομάδα χειρότερη
 * από κάθε 4ήμερο της βαθμονόμησης. Με λίγο δυνατό αέρα στο παράθυρο δεν κρίνει — και το λέει.
 *
 * ΕΝΑΣ ΦΥΛΑΚΑΣ ΠΟΥ ΠΑΡΑΛΕΙΠΕΙ ΛΕΕΙ ΨΕΜΑΤΑ (ίδια αρχή με τον αδελφό του): χωρίς κλειδί ή χωρίς
 * δεδομένα → έξοδος 1, ποτέ «πέρασε».
 *
 * ΚΛΕΙΔΙ: `OPEN_METEO_API_KEY` από το περιβάλλον (secret στο GitHub)· τοπικά, αν λείπει, από το
 * περιβάλλον του Netlify μέσω `NETLIFY_AUTH_TOKEN` του `.env` — όπως ο κριτής με όργανο.
 *
 * Run: node scripts/validateColourAgainstStations.mjs [--days=4 | --window=YYYY-MM-DD:YYYY-MM-DD] [--prove]
 *      node scripts/validateColourAgainstStations.mjs --calibrate     (88 μέρες σε 4ήμερα → όριο)
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { METAR_COASTAL_STATIONS as STATIONS } from './metarCoastalStations.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

/**
 * ΤΟ ΟΡΙΟ — από `--calibrate` της 10/09/2026 (reports/weather/station-truth-calibration.json):
 * 17 τετραήμερα με δυνατό αέρα 04/07→09/09 (το αρχείο της πρόγνωσης κρατά ~66 μέρες, όχι 92 — ο
 * Ιούνιος γύρισε κενός). Διάμεσος 2,1% · p90 4,4% · ΧΕΙΡΟΤΕΡΟ 7,7% (21-24/08). Κόβει πάνω από 10%:
 * εβδομάδα χειρότερη από κάθε τετραήμερο του καλοκαιριού — δηλαδή όταν κάτι χάλασε, όχι επειδή φύσηξε.
 */
const MAX_SEVERE_FALSE_CALM_SHARE = 0.10;
/** Κάτω από τόσες ώρες×επίπεδα με πορτοκαλί/κόκκινο στο όργανο, το παράθυρο δεν κρίνει τίποτα. */
const MIN_STRONG_SLOTS = 60;
const DAY_HOURS_UTC = [6, 16];
const EXPOSURES = ['protected', 'partial', 'exposed'];
const KT_TO_KMH = 1.852;

const args = process.argv.slice(2);
const arg = (name) => args.find(a => a.startsWith(`--${name}=`))?.split('=')[1];
const CALIBRATE = args.includes('--calibrate');
const PROVE = args.includes('--prove');

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
const fetchWithRetry = async (url, init = {}, tries = 3, timeoutMs = 120000) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw new Error('unreachable');
};

const resolveKey = async () => {
  if (process.env.OPEN_METEO_API_KEY?.trim()) return process.env.OPEN_METEO_API_KEY.trim();
  const envFile = path.join(root, '.env');
  const stateFile = path.join(root, '.netlify/state.json');
  if (!existsSync(envFile) || !existsSync(stateFile)) return null;
  const token = (readFileSync(envFile, 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
  if (!token) return null;
  const siteId = JSON.parse(readFileSync(stateFile, 'utf8')).siteId;
  const res = await fetchWithRetry(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
    { headers: { Authorization: `Bearer ${token}` } }, 2, 20000);
  return ((await res.json()).values || []).map(v => v.value).find(Boolean) ?? null;
};

/** ICAO|YYYY-MM-DDTHH → {kmh} — μία παρατήρηση ανά ώρα, η κοντινότερη στην ακέραιη (ίδιο με τον κριτή). */
const fetchObservations = async (startDay, endDayExclusive) => {
  const [y1, m1, d1] = startDay.split('-'), [y2, m2, d2] = endDayExclusive.split('-');
  const url = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
    + STATIONS.map(s => `station=${s[0]}`).join('&')
    + `&data=sknt&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
    + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
  const csv = await (await fetchWithRetry(url, {}, 3, 240000)).text();
  const observed = new Map();
  for (const line of csv.split('\n').slice(1)) {
    const [icao, valid, sknt] = line.trim().split(',');
    if (!icao || !valid || !sknt || sknt === 'M') continue;
    const kt = Number(sknt);
    const d = new Date(`${valid.replace(' ', 'T')}:00Z`);
    if (!Number.isFinite(kt) || Number.isNaN(d.getTime())) continue;
    const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
    const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
    const gap = Math.abs(d.getTime() - rounded.getTime());
    const prev = observed.get(key);
    if (!prev || gap < prev.gap) observed.set(key, { gap, kmh: kt * KT_TO_KMH });
  }
  return observed;
};

/** Ο άνεμος της εφαρμογής στα σημεία των σταθμών: best_match + η ΙΔΙΑ διόρθωση (applyGustFloor). */
const fetchShownWind = async (key, startDay, endDayInclusive) => {
  const url = 'https://customer-api.open-meteo.com/v1/forecast'
    + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
    + '&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC&models=best_match'
    + `&start_date=${startDay}&end_date=${endDayInclusive}&apikey=${encodeURIComponent(key)}`;
  const data = await (await fetchWithRetry(url)).json();
  const entries = Array.isArray(data) ? data : [data];
  const shown = new Map();
  entries.forEach((entry, k) => {
    const st = STATIONS[k];
    const h = entry?.hourly;
    if (!st || !h) return;
    const speeds = h.wind_speed_10m ?? h.wind_speed_10m_best_match;
    const gusts = h.wind_gusts_10m ?? h.wind_gusts_10m_best_match;
    h.time.forEach((t, i) => {
      const raw = speeds?.[i];
      if (typeof raw !== 'number') return;
      shown.set(`${st[0]}|${t.slice(0, 13)}`, applyGustFloor(raw, gusts?.[i], entry.elevation, 'kmh'));
    });
  });
  return shown;
};

const toneOf = (exposureLevel, kmh) => resolveConditionTone({
  exposureLevel, beaufort: getBeaufortLevel(kmh), isEnclosedCove: false, seaStateM: undefined,
});

/** rows: [{station, hourUtc, obsKmh, shownKmh}] → μερίδιο βαριάς ψεύτικης ηρεμίας + παραδείγματα. */
const judge = (rows) => {
  let strong = 0, severe = 0;
  const cases = [];
  for (const r of rows) {
    if (r.hourUtc < DAY_HOURS_UTC[0] || r.hourUtc > DAY_HOURS_UTC[1]) continue;
    for (const exposureLevel of EXPOSURES) {
      const truth = toneOf(exposureLevel, r.obsKmh);
      if (truth !== 'orange' && truth !== 'red') continue;
      strong += 1;
      if (toneOf(exposureLevel, r.shownKmh) === 'blue') {
        severe += 1;
        if (exposureLevel === 'partial' && cases.length < 12) cases.push(r);
      }
    }
  }
  return { strong, severe, share: strong ? severe / strong : 0, cases };
};

const joinRows = (observed, shown, fromMs, toMs) => {
  const rows = [];
  for (const [k, obs] of observed) {
    const [station, hourIso] = k.split('|');
    const t = Date.parse(`${hourIso}:00:00Z`);
    if (t < fromMs || t >= toMs) continue;
    const s = shown.get(k);
    if (typeof s !== 'number') continue;
    rows.push({ station, hourIso, hourUtc: new Date(t).getUTCHours(), obsKmh: obs.kmh, shownKmh: s });
  }
  return rows;
};

// ── αυτοαπόδειξη: ο κανόνας ΠΡΕΠΕΙ να πιάνει μπλε πάνω σε 6 Μποφόρ και να αφήνει το σωστό ──
if (PROVE) {
  const bad = judge(Array.from({ length: 30 }, (_, i) => ({ station: 'TEST', hourIso: `x${i}`, hourUtc: 12, obsKmh: 45, shownKmh: 8 })));
  const good = judge(Array.from({ length: 30 }, (_, i) => ({ station: 'TEST', hourIso: `y${i}`, hourUtc: 12, obsKmh: 45, shownKmh: 45 })));
  if (!(bad.share > MAX_SEVERE_FALSE_CALM_SHARE) || good.share !== 0 || bad.strong === 0) {
    console.error(`--prove: ο κανόνας δεν φυλάει (κακό ${bad.severe}/${bad.strong}, καλό ${good.severe}/${good.strong}).`);
    process.exit(1);
  }
}

const key = await resolveKey();
if (!key) {
  console.error('Φύλακας με όργανο: ΧΩΡΙΣ κλειδί Open-Meteo — δεν κρίθηκε τίποτα. Πρόσθεσε το OPEN_METEO_API_KEY στα secrets του GitHub (ίδια τιμή με το Netlify).');
  process.exit(1);
}

const DAY_MS = 86400000;
if (CALIBRATE) {
  const endMs = Date.parse(`${isoDay(Date.now())}T00:00:00Z`);   // ως χθες
  const startMs = endMs - 88 * DAY_MS;
  const observed = await fetchObservations(isoDay(startMs), isoDay(endMs));
  const shown = await fetchShownWind(key, isoDay(startMs), isoDay(endMs - DAY_MS));
  const windows = [];
  for (let from = startMs; from + 4 * DAY_MS <= endMs; from += 4 * DAY_MS) {
    const rows = joinRows(observed, shown, from, from + 4 * DAY_MS);
    const r = judge(rows);
    windows.push({ from: isoDay(from), to: isoDay(from + 4 * DAY_MS - DAY_MS), pairedHours: rows.length,
      strongSlots: r.strong, severe: r.severe, share: Number(r.share.toFixed(3)) });
  }
  const judged = windows.filter(w => w.strongSlots >= MIN_STRONG_SLOTS).map(w => w.share).sort((a, b) => a - b);
  const q = (p) => judged.length ? judged[Math.min(judged.length - 1, Math.floor(p * (judged.length - 1)))] : null;
  const out = path.join(root, 'reports/weather/station-truth-calibration.json');
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), rule: 'μπλε εκεί που το όργανο δίνει πορτοκαλί/κόκκινο, 06-16 UTC, 3 επίπεδα έκθεσης',
    minStrongSlots: MIN_STRONG_SLOTS, judgedWindows: judged.length, median: q(0.5), p90: q(0.9), max: judged.at(-1) ?? null, windows }, null, 2));
  for (const w of windows) {
    const why = w.pairedHours === 0 ? ' · χωρίς ζευγάρια μέτρησης-μοντέλου (εκτός αρχείου πρόγνωσης)' : w.strongSlots < MIN_STRONG_SLOTS ? ' · λίγος αέρας' : '';
    console.log(`  ${w.from}→${w.to}: ${w.severe}/${w.strongSlots} (${(w.share * 100).toFixed(1)}%)${why}`);
  }
  console.log(`κρίθηκαν ${judged.length} τετραήμερα · διάμεσος ${(q(0.5) * 100).toFixed(1)}% · p90 ${(q(0.9) * 100).toFixed(1)}% · χειρότερο ${((judged.at(-1) ?? 0) * 100).toFixed(1)}% → ${path.relative(root, out)}`);
  process.exit(0);
}

const windowArg = arg('window');
const days = Number(arg('days') || 4);
const toMs = windowArg ? Date.parse(`${windowArg.split(':')[1]}T00:00:00Z`) + DAY_MS : Date.parse(`${isoDay(Date.now())}T00:00:00Z`);
const fromMs = windowArg ? Date.parse(`${windowArg.split(':')[0]}T00:00:00Z`) : toMs - days * DAY_MS;
let observed, shown;
try {
  observed = await fetchObservations(isoDay(fromMs), isoDay(toMs));
  shown = await fetchShownWind(key, isoDay(fromMs), isoDay(toMs - DAY_MS));
} catch (e) {
  console.error(`Φύλακας με όργανο: αποτυχία λήψης (${e.message}) — δεν κρίθηκε τίποτα, άρα ΔΕΝ περνάει.`);
  process.exit(1);
}
const rows = joinRows(observed, shown, fromMs, toMs);
const stations = new Set(rows.map(r => r.station)).size;
if (stations < 20) {
  console.error(`Φύλακας με όργανο: μόνο ${stations}/${STATIONS.length} σταθμοί με ζευγάρι μέτρησης-μοντέλου — δεν κρίθηκε, άρα ΔΕΝ περνάει.`);
  process.exit(1);
}
const r = judge(rows);
const span = `${isoDay(fromMs)}→${isoDay(toMs - DAY_MS)}`;
console.log(`Φύλακας με όργανο ${span}: ${rows.length} ώρες-σταθμοί από ${stations} αεροδρόμια · ώρες×επίπεδα με πορτοκαλί/κόκκινο στο όργανο ${r.strong} · μπλε εκεί ${r.severe} (${(r.share * 100).toFixed(1)}%, όριο ${(MAX_SEVERE_FALSE_CALM_SHARE * 100).toFixed(0)}%)`);
if (r.strong < MIN_STRONG_SLOTS) {
  console.log(`Λίγος δυνατός αέρας στο παράθυρο (<${MIN_STRONG_SLOTS}) — ούτε πέρασε ούτε κόπηκε: δεν υπήρχε τι να κριθεί. Πέρασε ως «δεν κρίνεται».`);
  process.exit(0);
}
if (r.share > MAX_SEVERE_FALSE_CALM_SHARE) {
  console.error('ΕΠΕΣΕ — βάφουμε μπλε εκεί που τα ανεμόμετρα δίνουν πορτοκαλί/κόκκινο πιο συχνά από κάθε τετραήμερο της βαθμονόμησης. Σκανδάλη #2 του κλειδώματος (βίβλος §9).');
  for (const c of r.cases) console.error(`  ${c.station} ${c.hourIso}Z: όργανο ${c.obsKmh.toFixed(0)} χλμ/ώ, δείχνουμε ${c.shownKmh.toFixed(0)}`);
  process.exit(1);
}
console.log('Πέρασε.');
