#!/usr/bin/env node
/**
 * ΘΕΜΑ 21 — ΤΑ 81 ΚΕΛΙΑ ΑΝΕΜΟΥ ΠΙΣΩ ΑΠΟ ΒΟΥΝΟ: ΔΕΥΤΕΡΟΣ ΚΡΙΤΗΣ, ΟΙ ΣΤΑΘΜΟΙ meteo.gr (ΕΑΑ) — 13/09/2026.
 *
 * ΤΙ ΕΚΚΡΕΜΟΥΣΕ. Η Δ9-Δ (judgeSeaWindCellSwapAgainstStations.mjs) έκρινε με METAR αεροδρομίων ≤20 χλμ μόνο 20 από
 * τις 85 παραλίες του ledger και κράτησε 4. Οι υπόλοιπες 81 έμειναν `deferred` χωρίς όργανο. Οι σταθμοί του
 * meteosearch.meteo.gr (λογαριασμός Μίλτου, 51 σταθμοί κατεβασμένοι Ιουν-Αυγ 2026 στο docs/team/data/meteo-gr/) είναι
 * ο φυσικός δεύτερος κριτής: βρίσκονται σε νησιά χωρίς αεροδρόμιο (Ίος, Σίφνος, Κάλυμνος, Αλόννησος, Ιθάκη…).
 *
 * ΤΙ ΔΙΝΕΙ Ο ΣΤΑΘΜΟΣ. ΗΜΕΡΗΣΙΕΣ συνόψεις Davis: μέσος άνεμος 24ώρου, μέγιστη ριπή της μέρας, κυρίαρχη διεύθυνση
 * (16 σημεία). Όχι 10-λεπτα, όχι ώρες. Άρα ο κριτής εδώ συγκρίνει ΜΕΡΑ προς ΜΕΡΑ: για κάθε παραλία, το ΠΑΛΙΟ κελί
 * (πίσω από το βουνό) και το ΝΕΟ κελί (αυτό που «βλέπει» η παραλία), ίδια μέρα, ίδια μετρικά:
 *   - μέσος ημέρας του κελιού (24 ώρες) απέναντι στον μέσο του σταθμού,
 *   - μέγιστη ωριαία ριπή του κελιού απέναντι στη μέγιστη ριπή του σταθμού,
 *   - κυρίαρχη διεύθυνση (τομέας που κουβάλησε τον πιο πολύ αέρα) απέναντι στη DOM DIR του σταθμού,
 *   - «υπο-δείχνει ≥4 Μπφ»: στις μέρες που ο σταθμός έχει μέσο ≥20 χλμ/ώ, πόσο συχνά το κελί λέει ένα σκαλί κάτω.
 * Το μοντέλο για τα δύο κελιά έρχεται από την ΙΔΙΑ πόρτα που ρωτά η σελίδα (πληρωμένος host, `cell_selection=sea`
 * στο κέντρο του κελιού, past_days=92 → από ~13/06/2026), ώρα Ελλάδας ώστε η «μέρα» να είναι η μέρα του σταθμού.
 *
 * Ο ΚΑΝΟΝΑΣ, ΓΡΑΜΜΕΝΟΣ ΠΡΙΝ ΤΡΕΞΕΙ (ίδιο ήθος με τη Δ9-Δ — ποτέ επιλογή κατά αποτέλεσμα):
 *   1. Σταθμός ≤ 20 χλμ από την παραλία (ίδιο όριο με τα METAR). Λιγότερες από 40 κοινές μέρες → «λίγα».
 *   2. Ψήφος ΡΙΠΗΣ: MAE ριπής νέου < παλιού − 1,0 χλμ/ώ → «νέο»· ανάποδα → «παλιό»· αλλιώς ισοπαλία.
 *      Ψήφος ΜΕΣΟΥ: MAE μέσου νέου < παλιού − 0,5 χλμ/ώ → «νέο»· ανάποδα → «παλιό»· αλλιώς ισοπαλία.
 *      Τελική: αν συμφωνούν → αυτό· αν η μία είναι ισοπαλία → η άλλη· αν ΑΝΤΙΦΑΣΚΟΥΝ → ισοπαλία (δεν αλλάζει).
 *   3. Η ΘΕΣΗ ΤΟΥ ΟΡΓΑΝΟΥ (μνήμη meteo-gr-station-judge: ανεμόμετρα σε κήπους ξενοδοχείων δείχνουν τον μισό αέρα).
 *      Ένα όργανο που βλέπει ΛΙΓΟΤΕΡΟ αέρα απ' όσο φυσάει προτιμά πάντα το πιο ήρεμο κελί — άρα η μαρτυρία του
 *      ΥΠΕΡ ΤΟΥ ΗΠΙΟΤΕΡΟΥ κελιού δεν μετράει. Μετριέται στη δική του θέση (audit meteo-gr, best_match στις
 *      συντεταγμένες του σταθμού): ριπή σταθμού / ριπή μοντέλου < 0,70 → η ψήφος ριπής υπέρ του ηπιότερου σβήνει·
 *      μέσος σταθμού / μέσος μοντέλου < 0,60 → η ψήφος μέσου υπέρ του ηπιότερου σβήνει. Η μαρτυρία υπέρ του
 *      ΔΥΝΑΤΟΤΕΡΟΥ κελιού από όργανο σε απάγκιο μένει (είναι η ισχυρότερη δυνατή). Όργανο με ριπή <0,70 ΚΑΙ
 *      διεύθυνση άσχετη (±22° <30% ή ανάποδα ≥30%) = «όργανο ύποπτο», δεν ψηφίζει καθόλου.
 *   4. Όπου έχει ήδη κρίνει και το METAR (Δ9-Δ): οι δύο κριτές συνδυάζονται με τον ίδιο κανόνα του βήματος 2
 *      (συμφωνία → αυτό· ένας ισοπαλία → ο άλλος· αντίφαση → ισοπαλία).
 *   5. Μόνο η τελική «νέο» μετακινεί την παραλία από `deferred` σε `overrides` (--write-ledger). Οι υπόλοιπες
 *      μένουν στο παλιό κελί με τον κριτή γραμμένο δίπλα τους (`stationJudge`), και όσες δεν έχουν κανέναν σταθμό
 *      ≤20 χλμ παίρνουν τη σημείωση «κανένας σταθμός» με τον πλησιέστερο και την απόστασή του. Έτσι το ledger
 *      φτάνει σε 0 εγγραφές χωρίς `stationJudge` — το κριτήριο «τελείωσε» του θέματος 21.
 *
 * ΟΡΙΑ. Ο σταθμός είναι στο χωριό/λιμάνι, όχι στην άμμο· κρίνει ΚΛΙΣΗ (ποιο κελί είναι πιο κοντά στο όργανο κατά
 * μέσο όρο), όχι την κάθε μέρα. Η μέγιστη ριπή του Davis είναι στιγμιαία, του μοντέλου ωριαία 3-δευτερόλεπτη —
 * συγκρίσιμες αλλά όχι ίδιες· γι' αυτό το κατώφλι της ριπής είναι διπλάσιο από του μέσου.
 *
 *   node scripts/judgeSeaWindCellSwapAgainstMeteoGr.mjs [--maxKm 20] [--pastDays 92] [--write-ledger] [--no-cache]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';
import { METAR_COASTAL_STATIONS } from './metarCoastalStations.mjs';
import { distanceKm } from './lib/marineCellTrust.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const argVal = (name, fallback) => { const i = process.argv.indexOf(name); return i === -1 || !process.argv[i + 1] ? fallback : process.argv[i + 1]; };
const MAX_KM = Number(argVal('--maxKm', '20'));
const PAST_DAYS = Number(argVal('--pastDays', '92'));
const WRITE_LEDGER = process.argv.includes('--write-ledger');
const NO_CACHE = process.argv.includes('--no-cache');
const today = new Date().toISOString().slice(0, 10);
const outPath = argVal('--out', `reports/quality/sea-wind-cell-meteogr-judge-${today}.json`);
const LEDGER_PATH = path.join(root, 'data/sea-wind-cell-overrides.json');
const PROPOSED_PATH = path.join(root, 'reports/quality/sea-wind-cell-overrides-proposed-2026-09-13.json');
const METAR_REPORT_PATH = path.join(root, 'reports/quality/sea-wind-cell-station-judge-2026-09-13.json');
const STATION_DIR = path.join(root, 'docs/team/data/meteo-gr');
const STATION_AUDIT_PATH = path.join(root, 'reports/weather/meteo-gr-stations-2026-summer.json');
const CACHE_DIR = path.join(root, '.tmp/sea-wind-meteogr-judge');
const MIN_DAYS = 40, GUST_MARGIN_KMH = 1.0, MEAN_MARGIN_KMH = 0.5, STRONG_MEAN_KMH = 20;
const GUST_SHELTER_RATIO = 0.7, MEAN_SHELTER_RATIO = 0.6, DIR_WITHIN22_MIN_PCT = 30, DIR_OPPOSITE_MAX_PCT = 30;
const num = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null);
const mean = arr => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── 1. Οι σταθμοί: ημερήσιες συνόψεις από τα αρχεία, συντεταγμένες + ποιότητα οργάνου από το audit ──────────
if (!existsSync(STATION_DIR) || !existsSync(STATION_AUDIT_PATH)) { console.error('Λείπουν τα αρχεία meteo.gr (docs/team/data/meteo-gr) ή το audit report.'); process.exit(1); }
const audit = JSON.parse(readFileSync(STATION_AUDIT_PATH, 'utf8'));
const stationCoords = audit.stations; // name → [lat, lon, note]
const PTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const parseStationFiles = dir => {
  const obs = {};
  for (const f of readdirSync(dir).filter(x => x.endsWith('.txt'))) {
    const st = f.replace(/-\d{4}-\d{2}\.txt$/, '');
    const mo = f.match(/(\d{4}-\d{2})/)[1];
    for (const l of readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/)) {
      const t = l.trim().split(/\s+/);
      if (t.length < 10) continue;
      const dayTok = t[0];
      let day = null;
      if (/^\d{1,2}$/.test(dayTok)) day = dayTok.padStart(2, '0');
      else if (new RegExp(`^${mo}-(\\d{2})$`).test(dayTok)) day = dayTok.slice(-2);
      if (!day) continue;
      if (/^\*+$/.test(t[t.length - 1])) t.pop();
      if (!/^[NESW]{1,3}$/.test(t[t.length - 1])) continue;
      const avg = Number(t[t.length - 4]), gust = Number(t[t.length - 3]);
      if (!Number.isFinite(avg) || !Number.isFinite(gust)) continue;
      (obs[st] ||= {})[`${mo}-${day}`] = { avg, gust, dir: t[t.length - 1] };
    }
  }
  return obs;
};
const stationObs = parseStationFiles(STATION_DIR);
const stationQuality = name => {
  const r = audit.results?.[name];
  const all = r?.all, dir = r?.direction;
  const gustRatio = all && all.mGust ? all.oGust / all.mGust : null;
  const meanRatio = all && all.mAvg ? all.oAvg / all.mAvg : null;
  const gustSheltered = gustRatio !== null && gustRatio < GUST_SHELTER_RATIO;
  const meanSheltered = meanRatio !== null && meanRatio < MEAN_SHELTER_RATIO;
  const dirSuspect = !dir || dir.within22Pct < DIR_WITHIN22_MIN_PCT || dir.oppositePct >= DIR_OPPOSITE_MAX_PCT;
  const flags = [];
  if (gustSheltered) flags.push('ριπή σε απάγκιο');
  if (meanSheltered) flags.push('μέσος σε απάγκιο');
  if (dirSuspect) flags.push('διεύθυνση ύποπτη');
  return {
    name, note: stationCoords[name]?.[2] ?? null, auditDays: all?.N ?? 0,
    gustRatio: num(gustRatio), meanRatio: num(meanRatio), dirWithin22Pct: dir?.within22Pct ?? null, dirOppositePct: dir?.oppositePct ?? null,
    gustSheltered, meanSheltered, dirSuspect, suspectInstrument: gustSheltered && dirSuspect, flags,
  };
};

// ── 2. Οι παραλίες του ledger που περιμένουν (deferred) + ο πλησιέστερος σταθμός ──────────────────────────
const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
const proposed = JSON.parse(readFileSync(PROPOSED_PATH, 'utf8'));
const proposedById = new Map((proposed.overrides || []).map(o => [o.beachId, o]));
const metarReport = existsSync(METAR_REPORT_PATH) ? JSON.parse(readFileSync(METAR_REPORT_PATH, 'utf8')) : { perBeach: [] };
const metarById = new Map((metarReport.perBeach || []).map(b => [b.beachId, b]));
const appCache = new Map();
const beachCoords = (region, id) => {
  if (!appCache.has(region)) appCache.set(region, JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${region}.json`), 'utf8')));
  return appCache.get(region).island?.beaches?.find(b => b.id === id)?.coordinates ?? null;
};
const nearest = (c, list) => { let best = null; for (const s of list) { const km = distanceKm(c.lat, c.lon, s.lat, s.lon); if (!best || km < best.km) best = { ...s, km }; } return best; };
const meteoList = Object.entries(stationCoords).filter(([n]) => stationObs[n]).map(([n, [lat, lon]]) => ({ name: n, lat, lon }));
const metarList = METAR_COASTAL_STATIONS.map(([icao, name, lat, lon]) => ({ icao, name, lat, lon }));
const cases = [], noStation = [];
for (const d of ledger.deferred || []) {
  const c = beachCoords(d.region, d.beachId);
  const p = proposedById.get(d.beachId);
  if (!c || !p) { noStation.push({ ...d, why: !c ? 'χωρίς συντεταγμένες' : 'όχι στο proposed ledger' }); continue; }
  const st = nearest(c, meteoList), mt = nearest(c, metarList);
  const entry = { ...d, proposed: p, beach: c, nearestMeteoGr: st ? { station: st.name, km: num(st.km, 1) } : null, nearestMetar: mt ? { icao: mt.icao, name: mt.name, km: num(mt.km, 1) } : null };
  if (st && st.km <= MAX_KM) cases.push({ ...entry, station: { name: st.name, lat: st.lat, lon: st.lon, km: num(st.km, 1) } });
  else noStation.push(entry);
}
console.log(`Deferred: ${(ledger.deferred || []).length} · με σταθμό meteo.gr ≤${MAX_KM} χλμ: ${cases.length} · χωρίς: ${noStation.length}`);

// ── 3. Τα δύο κελιά ανά παραλία από την πόρτα της σελίδας, ώρα Ελλάδας, με cache ─────────────────────────
const cellKeys = [...new Set(cases.flatMap(c => [c.excludedCell, c.candidateCell]))];
mkdirSync(CACHE_DIR, { recursive: true });
const cachePath = path.join(CACHE_DIR, `cells-${today}-p${PAST_DAYS}.json`);
let cellSeries;
if (!NO_CACHE && existsSync(cachePath)) {
  cellSeries = new Map(Object.entries(JSON.parse(readFileSync(cachePath, 'utf8'))));
  console.log(`μοντέλο: ${cellSeries.size} κελιά από cache ${path.relative(root, cachePath)}`);
} else {
  const apiKey = await resolveOpenMeteoKey();
  if (!apiKey) { console.error('Χωρίς κλειδί Open-Meteo.'); process.exit(1); }
  cellSeries = new Map();
  for (let i = 0; i < cellKeys.length; i += 50) {
    const batch = cellKeys.slice(i, i + 50);
    const url = 'https://customer-api.open-meteo.com/v1/forecast'
      + `?latitude=${batch.map(k => k.split('_')[0]).join(',')}&longitude=${batch.map(k => k.split('_')[1]).join(',')}`
      + `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens&past_days=${PAST_DAYS}&forecast_days=1&cell_selection=sea&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
    const json = await res.json();
    if (json.error) { console.error(`μοντέλο: ${json.reason}`); process.exit(1); }
    const rows = Array.isArray(json) ? json : [json];
    batch.forEach((k, j) => {
      const r = rows[j];
      const days = {};
      r.hourly.time.forEach((t, idx) => {
        const w = r.hourly.wind_speed_10m[idx], g = r.hourly.wind_gusts_10m[idx], dd = r.hourly.wind_direction_10m[idx];
        if (typeof w !== 'number') return;
        const day = t.slice(0, 10);
        (days[day] ||= { w: [], g: [], dir: [] });
        days[day].w.push(w); if (typeof g === 'number') days[day].g.push(g); days[day].dir.push([dd, w]);
      });
      cellSeries.set(k, { echo: `${r.latitude}_${r.longitude}`, echoMatches: `${r.latitude}_${r.longitude}` === k, days });
    });
    if (i + 50 < cellKeys.length) await sleep(1500);
  }
  writeFileSync(cachePath, JSON.stringify(Object.fromEntries(cellSeries)), 'utf8');
  console.log(`μοντέλο: ${cellSeries.size} κελιά (${PAST_DAYS} μέρες), cache → ${path.relative(root, cachePath)}`);
}
const domDir = pairs => { const s = new Array(16).fill(0); for (const [d, w] of pairs) { if (typeof d !== 'number') continue; s[Math.round(d / 22.5) % 16] += w; } return PTS[s.indexOf(Math.max(...s))]; };
const ptGap = (a, b) => { const i = PTS.indexOf(a), j = PTS.indexOf(b); if (i < 0 || j < 0) return null; const g = Math.abs(i - j); return Math.min(g, 16 - g); };
const dayStats = (series, day) => { const d = series?.days?.[day]; if (!d || d.w.length < 20) return null; return { avg: mean(d.w), gust: d.g.length ? Math.max(...d.g) : null, dom: domDir(d.dir) }; };

// ── 4. Σύγκριση μέρα προς μέρα, ψήφοι, τελική ετυμηγορία ────────────────────────────────────────────────────
const vote = (maeOld, maeNew, margin) => (maeNew < maeOld - margin ? 'νέο' : maeOld < maeNew - margin ? 'παλιό' : 'ισοπαλία');
const combine = (a, b) => (a === b ? a : a === 'ισοπαλία' ? b : b === 'ισοπαλία' ? a : 'ισοπαλία');
const cellMetrics = (rows, side) => {
  const n = rows.length;
  const g = rows.filter(r => typeof r[side].gust === 'number' && typeof r.oGust === 'number');
  const dirRows = rows.filter(r => r.oAvg >= 6);
  const strong = rows.filter(r => r.oAvg >= STRONG_MEAN_KMH);
  return {
    maeMeanKmh: num(mean(rows.map(r => Math.abs(r[side].avg - r.oAvg)))), biasMeanKmh: num(mean(rows.map(r => r[side].avg - r.oAvg))),
    maeGustKmh: num(mean(g.map(r => Math.abs(r[side].gust - r.oGust)))), biasGustKmh: num(mean(g.map(r => r[side].gust - r.oGust))),
    dirWithin22Pct: dirRows.length ? num(100 * dirRows.filter(r => { const gap = ptGap(r.oDir, r[side].dom); return gap !== null && gap <= 1; }).length / dirRows.length, 0) : null,
    bftExactPct: n ? num(100 * rows.filter(r => getBeaufortLevel(r[side].avg) === getBeaufortLevel(r.oAvg)).length / n, 0) : null,
    strongDays: strong.length,
    strongUnder: strong.length ? num(strong.filter(r => getBeaufortLevel(r[side].avg) <= getBeaufortLevel(r.oAvg) - 1).length / strong.length, 3) : null,
    meanOfDailyMeanKmh: num(mean(rows.map(r => r[side].avg))),
  };
};
const perBeach = [];
for (const c of cases) {
  const old = cellSeries.get(c.excludedCell), neu = cellSeries.get(c.candidateCell);
  const obs = stationObs[c.station.name] || {};
  const rows = [];
  for (const [day, o] of Object.entries(obs)) {
    const a = dayStats(old, day), b = dayStats(neu, day);
    if (!a || !b) continue;
    rows.push({ day, oAvg: o.avg, oGust: o.gust, oDir: o.dir, old: a, neu: b });
  }
  const n = rows.length;
  const q = stationQuality(c.station.name);
  const oldM = cellMetrics(rows, 'old'), newM = cellMetrics(rows, 'neu');
  const calmer = n ? (newM.meanOfDailyMeanKmh < oldM.meanOfDailyMeanKmh ? 'νέο' : 'παλιό') : null;
  const disagree = rows.filter(r => getBeaufortLevel(r.old.avg) !== getBeaufortLevel(r.neu.avg));
  const newCloser = disagree.filter(r => Math.abs(r.neu.avg - r.oAvg) < Math.abs(r.old.avg - r.oAvg)).length;
  const notes = [];
  let gustVote = 'ισοπαλία', meanVote = 'ισοπαλία', verdict;
  if (n < MIN_DAYS) verdict = 'λίγα';
  else if (q.suspectInstrument) { verdict = 'όργανο ύποπτο'; notes.push(`ο σταθμός ${c.station.name} βλέπει ριπή ${q.gustRatio}× του μοντέλου και διεύθυνση ±22° ${q.dirWithin22Pct}% — δεν ψηφίζει`); }
  else {
    gustVote = typeof oldM.maeGustKmh === 'number' && typeof newM.maeGustKmh === 'number' ? vote(oldM.maeGustKmh, newM.maeGustKmh, GUST_MARGIN_KMH) : 'ισοπαλία';
    meanVote = vote(oldM.maeMeanKmh, newM.maeMeanKmh, MEAN_MARGIN_KMH);
    if (q.gustSheltered && gustVote === calmer) { notes.push(`ψήφος ριπής υπέρ του ηπιότερου (${calmer}) σβήνει — ριπή σταθμού ${q.gustRatio}× του μοντέλου`); gustVote = 'ισοπαλία'; }
    if (q.meanSheltered && meanVote === calmer) { notes.push(`ψήφος μέσου υπέρ του ηπιότερου (${calmer}) σβήνει — μέσος σταθμού ${q.meanRatio}× του μοντέλου`); meanVote = 'ισοπαλία'; }
    verdict = combine(gustVote, meanVote);
    if (gustVote !== 'ισοπαλία' && meanVote !== 'ισοπαλία' && gustVote !== meanVote) notes.push(`ριπή λέει ${gustVote}, μέσος λέει ${meanVote} — αντίφαση`);
  }
  const metar = metarById.get(c.beachId);
  const metarVerdict = metar && metar.verdict !== 'λίγα' ? metar.verdict : null;
  const finalVerdict = metarVerdict ? combine(verdict === 'λίγα' || verdict === 'όργανο ύποπτο' ? 'ισοπαλία' : verdict, metarVerdict) : verdict;
  if (metarVerdict && finalVerdict !== verdict) notes.push(`METAR ${metar.station.icao} (${metar.station.km} χλμ, ${metar.hours} ώρες) λέει ${metarVerdict} → τελικό ${finalVerdict}`);
  perBeach.push({
    beachId: c.beachId, name: c.name, region: c.region, station: c.station, stationQuality: q, oldCell: c.excludedCell, newCell: c.candidateCell,
    echo: { old: old?.echoMatches ?? null, new: neu?.echoMatches ?? null }, days: n, firstDay: rows[0]?.day ?? null, lastDay: rows[rows.length - 1]?.day ?? null,
    old: oldM, new: newM, calmerCell: calmer, disagreeDays: disagree.length, newCloserWhenDisagree: disagree.length ? num(newCloser / disagree.length, 3) : null,
    votes: { gust: gustVote, mean: meanVote }, verdictMeteoGr: verdict, metar: metar ? { icao: metar.station.icao, km: metar.station.km, hours: metar.hours, verdict: metar.verdict } : null,
    verdict: finalVerdict, notes,
  });
}

const tally = {};
for (const b of perBeach) tally[b.verdict] = (tally[b.verdict] || 0) + 1;
const judged = perBeach.filter(b => b.days >= MIN_DAYS);
const agg = (side, field) => { const v = judged.map(b => b[side][field]).filter(x => typeof x === 'number'); return v.length ? num(mean(v)) : null; };
const summary = {
  deferred: (ledger.deferred || []).length, withStation: cases.length, withoutStation: noStation.length, verdicts: tally,
  meanMaeMeanKmh: { old: agg('old', 'maeMeanKmh'), new: agg('new', 'maeMeanKmh') }, meanMaeGustKmh: { old: agg('old', 'maeGustKmh'), new: agg('new', 'maeGustKmh') },
  meanBiasMeanKmh: { old: agg('old', 'biasMeanKmh'), new: agg('new', 'biasMeanKmh') }, meanDirWithin22Pct: { old: agg('old', 'dirWithin22Pct'), new: agg('new', 'dirWithin22Pct') },
  meanStrongUnder: { old: agg('old', 'strongUnder'), new: agg('new', 'strongUnder') },
  newCellCalmer: judged.filter(b => b.calmerCell === 'νέο').length,
};
const stationsUsed = [...new Set(cases.map(c => c.station.name))].map(stationQuality);
mkdirSync(path.dirname(path.resolve(root, outPath)), { recursive: true });
writeFileSync(path.resolve(root, outPath), JSON.stringify({
  generatedAt: new Date().toISOString(), ledger: path.relative(root, LEDGER_PATH), maxKm: MAX_KM, pastDays: PAST_DAYS, minDays: MIN_DAYS,
  rule: `ριπή: MAE νέου < παλιού − ${GUST_MARGIN_KMH} · μέσος: MAE νέου < παλιού − ${MEAN_MARGIN_KMH} · συμφωνία ή μία ισοπαλία → ψήφος, αντίφαση → ισοπαλία · όργανο σε απάγκιο (ριπή <${GUST_SHELTER_RATIO}× / μέσος <${MEAN_SHELTER_RATIO}× του μοντέλου στη θέση του) δεν ψηφίζει υπέρ του ηπιότερου κελιού · ριπή <${GUST_SHELTER_RATIO}× ΚΑΙ διεύθυνση ύποπτη = δεν ψηφίζει · με METAR: ίδιος συνδυασμός`,
  judge: 'meteo.gr (ΕΑΑ) ημερήσιες συνόψεις Ιουν-Αυγ 2026 — όργανο στο χωριό, όχι στην άμμο· κρίνει κλίση ανά μέρα, όχι ώρα',
  summary, stationsUsed, perBeach, noStation: noStation.map(e => ({ beachId: e.beachId, name: e.name, region: e.region, nearestMeteoGr: e.nearestMeteoGr ?? null, nearestMetar: e.nearestMetar ?? null, why: e.why ?? null })),
}, null, 2), 'utf8');

console.log(`\n=== Θέμα 21 · κριτής meteo.gr: ${perBeach.length} παραλίες ===`);
for (const b of perBeach) console.log(`  #${String(b.beachId).padEnd(5)} ${b.name.padEnd(30)} ${b.station.name.padEnd(17)} ${String(b.station.km).padStart(4)} χλμ · μέρες ${String(b.days).padStart(2)} · MAE μέσου ${b.old.maeMeanKmh}/${b.new.maeMeanKmh} · MAE ριπής ${b.old.maeGustKmh}/${b.new.maeGustKmh} · ±22° ${b.old.dirWithin22Pct}/${b.new.dirWithin22Pct}% · υπο-δείχνει ≥4 Μπφ ${b.old.strongUnder}/${b.new.strongUnder} (${b.old.strongDays} μέρες) · ηπιότερο: ${b.calmerCell} · ψήφοι ριπή ${b.votes.gust}/μέσος ${b.votes.mean}${b.metar ? ` · METAR ${b.metar.verdict}` : ''} → ${b.verdict}${b.notes.length ? `  [${b.notes.join(' · ')}]` : ''}`);
console.log(`  Σταθμοί: ${stationsUsed.map(s => `${s.name} (ριπή ${s.gustRatio}×, μέσος ${s.meanRatio}×, ±22° ${s.dirWithin22Pct}%${s.flags.length ? ' — ' + s.flags.join(', ') : ''})`).join(' · ')}`);
console.log(`  Σύνοψη: ${JSON.stringify(summary)}`);
console.log(`Αναφορά: ${outPath}`);

// ── 5. --write-ledger: «νέο» → overrides, όλα τα άλλα παίρνουν stationJudge ─────────────────────────────────
if (WRITE_LEDGER) {
  const byId = new Map(perBeach.map(b => [b.beachId, b]));
  const noById = new Map(noStation.map(e => [e.beachId, e]));
  const keptDeferred = [], promoted = [];
  const reportRel = outPath.replace(/\\/g, '/');
  const compact = m => ({ maeMeanKmh: m.maeMeanKmh, biasMeanKmh: m.biasMeanKmh, maeGustKmh: m.maeGustKmh, biasGustKmh: m.biasGustKmh, dirWithin22Pct: m.dirWithin22Pct, bftExactPct: m.bftExactPct, strongDays: m.strongDays, strongUnder: m.strongUnder });
  for (const d of ledger.deferred || []) {
    const j = byId.get(d.beachId);
    if (j) {
      const stationJudge = {
        source: 'meteo.gr', station: j.station.name, km: j.station.km, days: j.days, period: j.firstDay && j.lastDay ? `${j.firstDay}…${j.lastDay}` : null,
        stationFlags: j.stationQuality.flags, old: compact(j.old), new: compact(j.new), calmerCell: j.calmerCell, disagreeDays: j.disagreeDays, newCloserWhenDisagree: j.newCloserWhenDisagree,
        votes: j.votes, verdictMeteoGr: j.verdictMeteoGr, ...(j.metar ? { metar: j.metar } : {}), verdict: j.verdict, notes: j.notes, report: reportRel, judgedAt: new Date().toISOString(),
      };
      if (j.verdict === 'νέο') {
        const p = proposedById.get(d.beachId);
        promoted.push({ ...p, stationJudge });
      } else {
        keptDeferred.push({ ...d, reason: j.verdict === 'λίγα' ? `σταθμός ${j.station.name} με ${j.days} κοινές μέρες (<${MIN_DAYS}) — χωρίς κρίση δεν αλλάζει` : j.verdict === 'όργανο ύποπτο' ? `σταθμός ${j.station.name} ύποπτο όργανο — χωρίς κρίση δεν αλλάζει` : `ο σταθμός δεν προτιμά το νέο κελί (${j.verdict})`, stationJudge });
      }
    } else {
      const e = noById.get(d.beachId);
      const metar = metarById.get(d.beachId);
      const stationJudge = metar && metar.verdict !== 'λίγα'
        ? { source: 'METAR', station: metar.station.icao, km: metar.station.km, hours: metar.hours, verdict: metar.verdict, nearestMeteoGr: e?.nearestMeteoGr ?? null, report: 'reports/quality/sea-wind-cell-station-judge-2026-09-13.json', judgedAt: new Date().toISOString() }
        : { source: 'none', verdict: `κανένας σταθμός ≤${MAX_KM} χλμ`, nearestMeteoGr: e?.nearestMeteoGr ?? null, nearestMetar: e?.nearestMetar ?? null, ...(metar ? { metarTried: { station: metar.station.icao, km: metar.station.km, hours: metar.hours, verdict: metar.verdict } } : {}), judgedAt: new Date().toISOString() };
      keptDeferred.push({ ...d, stationJudge });
    }
  }
  const next = {
    ...ledger,
    rule: `${ledger.rule.split(' · ΚΑΙ κριτής')[0]} · ΚΑΙ κριτής οργάνου: METAR ≤20 χλμ (MAE νέου < παλιού − 0,5 χλμ/ώ σε ≥100 ώρες 10-18) Ή meteo.gr ≤20 χλμ (ημερήσια ριπή/μέσος, ≥${MIN_DAYS} μέρες, όργανο σε απάγκιο δεν ψηφίζει υπέρ του ηπιότερου) — κάθε εγγραφή κουβαλάει stationJudge.verdict = «νέο»`,
    meteoGrJudgeReport: reportRel, updatedAt: new Date().toISOString(),
    overrides: [...(ledger.overrides || []), ...promoted], deferred: keptDeferred,
  };
  writeFileSync(LEDGER_PATH, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  const missing = keptDeferred.filter(d => !d.stationJudge).length;
  console.log(`\nLedger: +${promoted.length} σε overrides (σύνολο ${next.overrides.length}) · deferred ${keptDeferred.length} · χωρίς stationJudge: ${missing}`);
  for (const p of promoted) console.log(`  ↑ #${p.beachId} ${p.name} (${p.region}) ${p.excludedCell} → ${p.chosenCell} · ${p.stationJudge.station} ${p.stationJudge.km} χλμ`);
}
