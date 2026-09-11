#!/usr/bin/env node
/**
 * ΑΡΓΕΙ ΤΟ ΜΟΝΤΕΛΟ ΣΤΟ ΞΕΚΙΝΗΜΑ ΚΑΙ ΣΤΟ ΣΒΗΣΙΜΟ ΤΟΥ ΜΕΛΤΕΜΙΟΥ; Κριτής: τα 30 ανεμόμετρα αεροδρομίων.
 *
 * Αφορμή: Πυργάκι Νάξου #2013, 11/09/2026 10:00 — δείξαμε 15 χλμ/ώ, το LGNX μέτρησε 20-22, και
 * το μοντέλο έφτασε εκεί μία ώρα αργότερα. Λήμνος 08-09/09: το ανάποδο το απόγευμα (δείξαμε
 * να πέφτει νωρίτερα). Δύο σημεία δεν είναι εύρημα — εδώ το λάθος σπάει ανά ΩΡΑ ΤΗΣ ΗΜΕΡΑΣ.
 *
 * Κρίνεται ο άνεμος ΠΟΥ ΔΕΙΧΝΟΥΜΕ (utils/windGustFloor → applyGustFloor), όχι ο ωμός μέσος:
 *   1. μεροληψία (δείχνουμε − μετρήθηκε) ανά τοπική ώρα, σε μέρες μελτεμιού και στις υπόλοιπες·
 *   2. «≥1 Μπφ χαμηλότερα» και χρώμα πιο ήρεμο από της μέτρησης, ανά ώρα — ό,τι βλέπει ο χρήστης·
 *   3. καθυστέρηση ξεκινήματος/σβησίματος σε ώρες, με δύο ορισμούς: (α) πέρασμα των 20 χλμ/ώ —
 *      ό,τι βλέπει ο χρήστης, αλλά μπλέκεται με τη στάθμη· (β) μισή διαδρομή από το πρωινό
 *      ελάχιστο στο μεσημεριανό μέγιστο ΤΗΣ ΚΑΘΕ ΣΕΙΡΑΣ — καθαρός χρόνος: μια σταθερή μετατόπιση
 *      ή ένας πολλαπλασιαστής δεν τον αλλάζουν.
 *
 * ΜΕΡΑ ΜΕΛΤΕΜΙΟΥ = βοριάς (300°-60°) ≥ 20 χλμ/ώ για ≥3 ώρες μέσα στο 10:00-19:00. Κρίνεται και με
 * το όργανο και με το μοντέλο, χωριστά: η επιλογή με το όργανο φουσκώνει την υποεκτίμηση
 * (διαλέγεις τις μέρες που φύσηξε περισσότερο απ' ό,τι είπαμε), με το μοντέλο την κρύβει. Το
 * «και τα δύο» είναι το δίκαιο σετ για τον χρόνο. Τρία καλοκαίρια ΧΩΡΙΣΤΑ: μοτίβο που
 * εμφανίζεται σε ένα μόνο είναι τύχη, όχι εύρημα.
 *
 * ΟΡΙΑ: κριτής αεροδρόμιο, όχι παραλία· 10-λεπτος μέσος οργάνου απέναντι σε στιγμιαία τιμή
 * μοντέλου στην ακέραιη ώρα· το `best_match` άλλαξε σύνθεση μέσα στα χρόνια (2026 = ό,τι τρέχει).
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/wind-diurnal-timing-<ημερομηνία>.json.
 *   OPEN_METEO_API_KEY="$(npx netlify env:get OPEN_METEO_API_KEY --plain)" node scripts/measureWindDiurnalTiming.mjs
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
const { resolveConditionTone, LEGEND_TONE_ORDER } = require(path.join(root, 'utils/suitabilityTone.ts'));

const SUMMERS = [
  ['2024', '2024-06-01', '2024-09-10'],
  ['2025', '2025-06-01', '2025-09-10'],
  ['2026', '2026-06-01', '2026-09-10'],
];
const LOCAL_OFFSET_H = 3; // θερινή ώρα Ελλάδας — όλα τα παράθυρα είναι μέσα της
const MELTEMI_KMH = 20;   // πρώτο χλμ/ώ των 4 Μποφόρ
const MELTEMI_MIN_HOURS = 3;
const MIN_CYCLE_KMH = 8;  // κάτω από αυτό το εύρος δεν υπάρχει ημερήσιος κύκλος να χρονομετρηθεί
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
const median = a => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const bft = v => getBeaufortLevel(v);

// Το χρώμα εξαρτάται εδώ μόνο από (έκθεση, Μποφόρ) — ίδια μέθοδος με measureWindDecompression.
const TONE_EXPOSURES = ['protected', 'partial', 'exposed'];
const toneRank = new Map();
const toneOf = (exposureLevel, kmh) => {
  const key = `${exposureLevel}|${bft(kmh)}`;
  if (!toneRank.has(key)) {
    const tone = resolveConditionTone({ exposureLevel, beaufort: bft(kmh), isEnclosedCove: false, seaStateM: undefined });
    toneRank.set(key, LEGEND_TONE_ORDER.indexOf(tone));
  }
  return toneRank.get(key);
};

// ── Λήψεις, με μνήμη στον δίσκο ώστε ένα δεύτερο τρέξιμο να μην ξανακατεβάζει τρία καλοκαίρια ──
const CACHE = path.join(root, 'node_modules/.cache/wind-diurnal');
fs.mkdirSync(CACHE, { recursive: true });
const cached = async (name, load) => {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const value = await load();
  fs.writeFileSync(file, JSON.stringify(value));
  return value;
};
const fetchJson = async (url, tries = 3) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, 3000 * (i + 1)));
    }
  }
};
const API_KEY = process.env.OPEN_METEO_API_KEY?.trim() || null;
const MODEL_HOST = API_KEY
  ? 'https://customer-historical-forecast-api.open-meteo.com'
  : 'https://historical-forecast-api.open-meteo.com';

const monthChunks = (start, end) => {
  const out = [];
  let s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  while (s <= e) { const ce = Math.min(e, s + 30 * DAY_MS); out.push([isoDay(s), isoDay(ce)]); s = ce + DAY_MS; }
  return out;
};

const rows = [];
const stationElevation = {};
for (const [summer, start, end] of SUMMERS) {
  for (const [s, e] of monthChunks(start, end)) {
    process.stderr.write(`· ${s} → ${e}: όργανα…`);
    const observed = new Map(await cached(`obs-${s}-${e}.json`, async () =>
      [...(await fetchStationHours(Date.parse(`${s}T00:00:00Z`), Date.parse(`${e}T23:00:00Z`)))]));
    process.stderr.write(` ${observed.size} · μοντέλο…`);
    const model = await cached(`model-${s}-${e}.json`, async () => {
      const meteo = await fetchJson(`${MODEL_HOST}/v1/forecast?latitude=${STATIONS.map(x => x[2]).join(',')}`
        + `&longitude=${STATIONS.map(x => x[3]).join(',')}`
        + `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC&start_date=${s}&end_date=${e}`
        + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : ''));
      return (Array.isArray(meteo) ? meteo : [meteo]).map(m => ({
        elevation: m.elevation, time: m.hourly?.time ?? [], ws: m.hourly?.wind_speed_10m ?? [],
        wg: m.hourly?.wind_gusts_10m ?? [], wd: m.hourly?.wind_direction_10m ?? [],
      }));
    });
    let paired = 0;
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
          icao, group: groupOf[icao] ?? 'άλλο', summer,
          localDate: local.toISOString().slice(0, 10), localHour: local.getUTCHours(),
          obs: obs.kmh, obsDir: obs.dir, raw,
          prod: applyGustFloor(raw, Number.isFinite(m.wg[h]) ? m.wg[h] : null, m.elevation),
          modelDir: m.wd[h],
        });
        paired++;
      }
    });
    process.stderr.write(` ${paired} ζευγάρια\n`);
  }
}
if (rows.length < 50_000) { console.error(`μόνο ${rows.length} ζευγάρια — δεν βγάζω συμπέρασμα`); process.exit(1); }

// ── Μέρες: ποια είναι μέρα μελτεμιού, κατά το όργανο και κατά το μοντέλο ─────────────────────
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
for (const day of days.values()) {
  day.meltemiObs = meltemiBy(day, 'obs', 'obsDir');
  day.meltemiModel = meltemiBy(day, 'prod', 'modelDir');
}
const DAY_SETS = {
  'μελτέμι (όργανο)': d => d.meltemiObs === true,
  'μελτέμι (μοντέλο)': d => d.meltemiModel === true,
  'μελτέμι (και τα δύο)': d => d.meltemiObs === true && d.meltemiModel === true,
  'υπόλοιπες μέρες': d => d.meltemiObs === false && d.meltemiModel === false,
};

// ── 1+2. Ανά ώρα: μεροληψία, «≥1 Μπφ χαμηλότερα», χρώμα πιο ήρεμο ─────────────────────────────
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
    n: hourRows.length,
    biasKmh: round(mean(hourRows.map(r => r.prod - r.obs))),
    rawBiasKmh: round(mean(hourRows.map(r => r.raw - r.obs))),
    obsMeanKmh: round(mean(hourRows.map(r => r.obs))),
    shownMeanKmh: round(mean(hourRows.map(r => r.prod))),
    underPct: pct(under, hourRows.length), overPct: pct(over, hourRows.length),
    toneCalmerPct: pct(calmer, toneN), falseBluePct: pct(falseBlue, toneN),
  };
};
const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00-22:00
const byHour = selectDays => Object.fromEntries(HOURS.map(h => [h, hourStats(
  selectDays.flatMap(d => (d.hours[h] ? [d.hours[h]] : [])))]));
const BUCKETS = { 'πρωί 08-11': [8, 9, 10, 11], 'μεσημέρι 12-16': [12, 13, 14, 15, 16], 'απόγευμα 17-20': [17, 18, 19, 20] };
const byBucket = selectDays => Object.fromEntries(Object.entries(BUCKETS).map(([b, hs]) => [b, hourStats(
  selectDays.flatMap(d => hs.flatMap(h => (d.hours[h] ? [d.hours[h]] : []))))]));

// ── 3. Χρόνος: πότε ξεκινάει και πότε σβήνει, στο όργανο και σε αυτό που δείχνουμε ─────────────
const series = (day, value) => day.hours.map(r => (r ? r[value] : undefined));
const complete = (s, from, to) => { for (let h = from; h <= to; h++) if (!Number.isFinite(s[h])) return false; return true; };
const firstAtLeast = (s, level, from, to) => { for (let h = from; h <= to; h++) if (s[h] >= level) return h; return null; };
const lastAtLeast = (s, level, from, to) => { for (let h = to; h >= from; h--) if (s[h] >= level) return h; return null; };
const halfLevel = s => {
  const lo = Math.min(...s.slice(5, 10)), hi = Math.max(...s.slice(10, 20));
  return hi - lo >= MIN_CYCLE_KMH ? lo + 0.5 * (hi - lo) : null;
};
const timing = day => {
  const o = series(day, 'obs'), p = series(day, 'prod');
  if (!complete(o, 5, 22) || !complete(p, 5, 22)) return null;
  const ho = halfLevel(o), hp = halfLevel(p);
  return {
    onsetKmh: [firstAtLeast(o, MELTEMI_KMH, 6, 15), firstAtLeast(p, MELTEMI_KMH, 6, 15)],
    decayKmh: [lastAtLeast(o, MELTEMI_KMH, 13, 22), lastAtLeast(p, MELTEMI_KMH, 13, 22)],
    onsetHalf: ho !== null && hp !== null ? [firstAtLeast(o, ho, 5, 16), firstAtLeast(p, hp, 5, 16)] : [null, null],
    decayHalf: ho !== null && hp !== null ? [lastAtLeast(o, ho, 12, 22), lastAtLeast(p, hp, 12, 22)] : [null, null],
  };
};
const lagStats = (selectDays, field) => {
  const lags = [];
  let obsOnly = 0, modelOnly = 0, withData = 0;
  for (const d of selectDays) {
    const t = d.timing;
    if (!t) continue;
    withData++;
    const [o, p] = t[field];
    if (o !== null && p !== null) lags.push(p - o);
    else if (o !== null) obsOnly++;
    else if (p !== null) modelOnly++;
  }
  const dist = {};
  for (const l of lags) { const k = Math.max(-3, Math.min(3, l)); dist[k] = (dist[k] || 0) + 1; }
  return {
    daysWithFullData: withData, n: lags.length,
    meanLagH: round(mean(lags), 2), medianLagH: median(lags),
    modelLaterPct: pct(lags.filter(l => l >= 1).length, lags.length),
    modelEarlierPct: pct(lags.filter(l => l <= -1).length, lags.length),
    sameHourPct: pct(lags.filter(l => l === 0).length, lags.length),
    distribution: Object.fromEntries(Object.entries(dist).sort((a, b) => a[0] - b[0])),
    obsReachedModelNever: obsOnly, modelReachedObsNever: modelOnly,
  };
};
const allDays = [...days.values()];
for (const d of allDays) d.timing = timing(d);
const timingFor = selectDays => Object.fromEntries(['onsetKmh', 'onsetHalf', 'decayKmh', 'decayHalf']
  .map(f => [f, lagStats(selectDays, f)]));

// ── Αναφορά ───────────────────────────────────────────────────────────────────────────────
const scopes = { 'όλα': allDays, ...Object.fromEntries(SUMMERS.map(([y]) => [y, allDays.filter(d => d.summer === y)])) };
const report = {
  generatedAt: new Date().toISOString(),
  judge: 'METAR ASOS (Iowa State), 30 παράκτια αεροδρόμια',
  model: `${MODEL_HOST.replace('https://', '')} best_match, στις συντεταγμένες του σταθμού, μετά το applyGustFloor`,
  summers: SUMMERS, pairs: rows.length,
  definitions: { meltemi: `βοριάς 300°-60° ≥ ${MELTEMI_KMH} χλμ/ώ για ≥${MELTEMI_MIN_HOURS} ώρες 10-19`, lag: 'μοντέλο − όργανο σε ώρες· + = το μοντέλο αργεί' },
  daySetSizes: {}, hourly: {}, buckets: {}, timing: {}, timingByGroup: {},
};
for (const [scope, list] of Object.entries(scopes)) {
  report.daySetSizes[scope] = Object.fromEntries(Object.entries(DAY_SETS).map(([n, f]) => [n, list.filter(f).length]));
  report.hourly[scope] = Object.fromEntries(Object.entries(DAY_SETS).map(([n, f]) => [n, byHour(list.filter(f))]));
  report.buckets[scope] = Object.fromEntries(Object.entries(DAY_SETS).map(([n, f]) => [n, byBucket(list.filter(f))]));
  report.timing[scope] = timingFor(list.filter(DAY_SETS['μελτέμι (και τα δύο)']));
}
for (const g of Object.keys(GROUP)) {
  const list = allDays.filter(d => d.group === g && DAY_SETS['μελτέμι (και τα δύο)'](d));
  report.timingByGroup[g] = { days: list.length, ...timingFor(list) };
  report.buckets[`όλα · ${g}`] = { 'μελτέμι (και τα δύο)': byBucket(list) };
}
// Ανά σταθμό: είναι το απογευματινό κενό πλατύ ή το κουβαλάνε λίγα νησιά; Η απάντηση αλλάζει
// το αν μια διόρθωση είναι εθνική ή τοπική. `pointElevationM` = 0 σημαίνει ότι εκεί δείχνουμε τον
// ΩΜΟ μέσο (θαλάσσια πόρτα), όπως στις μισές παραλίες της χώρας.
report.byStation = Object.fromEntries(STATIONS.map(([icao, name]) => {
  const list = allDays.filter(d => d.icao === icao && DAY_SETS['μελτέμι (και τα δύο)'](d));
  const t = timingFor(list);
  return [icao, {
    name, group: groupOf[icao], days: list.length, pointElevationM: stationElevation[icao] ?? null,
    onsetHalfLagH: t.onsetHalf.meanLagH, decayHalfLagH: t.decayHalf.meanLagH, buckets: byBucket(list),
  }];
}));
const outFile = path.join(root, `reports/weather/wind-diurnal-timing-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

// ── Κονσόλα: μόνο ό,τι χρειάζεται για απόφαση ────────────────────────────────────────────
const f = (v, w = 6) => String(v ?? '—').padStart(w);
console.log(`\nΖευγάρια ώρας: ${rows.length} · μοντέλο: ${report.model}`);
for (const [scope, sizes] of Object.entries(report.daySetSizes)) {
  console.log(`  ${scope.padEnd(5)} σταθμοί-μέρες: ${Object.entries(sizes).map(([n, c]) => `${n} ${c}`).join(' · ')}`);
}
for (const scope of Object.keys(scopes)) {
  console.log(`\n=== ${scope}: ανά ώρα — δείχνουμε − μετρήθηκε (χλμ/ώ) και % ώρες ≥1 Μπφ χαμηλότερα ===`);
  console.log('  ώρα | μελτ.όργ bias | μελτ.μοντ bias | μελτ.δύο bias  χαμηλά%  χρώμα-ηρεμότ% | υπόλοιπες bias');
  for (const h of HOURS) {
    const H = report.hourly[scope];
    const both = H['μελτέμι (και τα δύο)'][h];
    console.log(`  ${String(h).padStart(2, '0')}  | ${f(H['μελτέμι (όργανο)'][h].biasKmh, 13)} | ${f(H['μελτέμι (μοντέλο)'][h].biasKmh, 14)} | ${f(both.biasKmh, 13)} ${f(both.underPct, 8)} ${f(both.toneCalmerPct, 14)} | ${f(H['υπόλοιπες μέρες'][h].biasKmh, 14)}`);
  }
  const T = report.timing[scope];
  console.log(`  χρόνος (μέρες μελτεμιού, και τα δύο) — + = το μοντέλο αργεί:`);
  for (const [name, t] of Object.entries(T)) {
    console.log(`    ${name.padEnd(10)} n=${f(t.n, 4)}  μέσος ${f(t.meanLagH, 5)} ω  διάμεσος ${f(t.medianLagH, 3)}  αργεί ≥1ω ${f(t.modelLaterPct, 5)}%  βιάζεται ≥1ω ${f(t.modelEarlierPct, 5)}%  ίδια ώρα ${f(t.sameHourPct, 5)}%  (όργανο μόνο: ${t.obsReachedModelNever}, μοντέλο μόνο: ${t.modelReachedObsNever})`);
  }
}
console.log('\n=== ανά περιοχή, όλα τα καλοκαίρια, μέρες μελτεμιού (και τα δύο) ===');
for (const [g, t] of Object.entries(report.timingByGroup)) {
  const B = report.buckets[`όλα · ${g}`]['μελτέμι (και τα δύο)'];
  console.log(`  ${g.padEnd(20)} μέρες ${f(t.days, 4)} · ξεκίνημα(μισό) ${f(t.onsetHalf.meanLagH, 5)} ω · σβήσιμο(μισό) ${f(t.decayHalf.meanLagH, 5)} ω · `
    + Object.entries(B).map(([b, s]) => `${b}: bias ${s.biasKmh} / χαμηλά ${s.underPct}%`).join(' · '));
}
console.log('\n=== ανά σταθμό, μέρες μελτεμιού (και τα δύο) — bias χλμ/ώ / % ≥1 Μπφ χαμηλότερα ===');
for (const [icao, s] of Object.entries(report.byStation).sort((a, b) =>
  (a[1].buckets['απόγευμα 17-20'].biasKmh ?? 0) - (b[1].buckets['απόγευμα 17-20'].biasKmh ?? 0))) {
  if (s.days < 20) continue;
  const B = s.buckets;
  console.log(`  ${icao}${s.pointElevationM > 0 ? ' ' : '*'}${s.name.padEnd(15)} μέρες ${f(s.days, 4)} · ξεκ ${f(s.onsetHalfLagH, 5)} · σβ ${f(s.decayHalfLagH, 5)} · πρωί ${f(B['πρωί 08-11'].biasKmh, 5)}/${f(B['πρωί 08-11'].underPct, 4)}% · μεσημ ${f(B['μεσημέρι 12-16'].biasKmh, 5)}/${f(B['μεσημέρι 12-16'].underPct, 4)}% · απόγ ${f(B['απόγευμα 17-20'].biasKmh, 5)}/${f(B['απόγευμα 17-20'].underPct, 4)}%`);
}
console.log(`\n→ ${path.relative(root, outFile)}`);
