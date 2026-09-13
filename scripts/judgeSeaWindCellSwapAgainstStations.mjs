#!/usr/bin/env node
/**
 * Δ9-Δ — ΠΟΙΟ ΚΕΛΙ ΛΕΕΙ ΤΗΝ ΑΛΗΘΕΙΑ: ΤΟ ΠΑΛΙΟ (ΠΙΣΩ ΑΠΟ ΒΟΥΝΟ) Ή ΤΟ ΝΕΟ; — ΚΡΙΤΗΣ METAR (13/09/2026).
 *
 * Η μέτρηση της Δ9-Α (measureSeaWindCellSwap.mjs) έδειξε ότι τα εναλλακτικά κελιά είναι ΠΙΟ ΗΡΕΜΑ στα 2/3 των
 * ωρών και θα μαλάκωναν 33 ετυμηγορίες. Πιο ήρεμο χωρίς δεύτερη πηγή δεν ανεβαίνει (κανόνας του έργου). Η δεύτερη
 * πηγή εδώ: το αρχείο METAR (Iowa State ASOS, ίδιο με auditWindAgainstStations.mjs) για τους σταθμούς
 * αεροδρομίων ≤20 χλμ από τις παραλίες του ledger. Για κάθε τέτοια παραλία, για 92 μέρες, ώρες 10-18 τοπική:
 * άνεμος ΠΑΛΙΟΥ κελιού και ΝΕΟΥ κελιού (πληρωμένος host, past_days, `cell_selection=sea` στο κέντρο του κελιού —
 * ό,τι ζητά και ο πελάτης) απέναντι στον σταθμό. Ποιο κελί έχει μικρότερο λάθος ταχύτητας/διεύθυνσης; Και όταν
 * διαφωνούν κατά ≥1 Μποφόρ, ποιος έχει δίκιο;
 *
 * ΟΡΙΑ. Ο σταθμός είναι στο αεροδρόμιο, όχι στην άμμο· 20 χλμ είναι πολλά σε νησί με βουνό. Άρα κρίνει
 * ΣΥΣΤΗΜΑΤΙΚΗ κλίση (ποιο κελί είναι πιο κοντά στο όργανο κατά μέσο όρο), όχι την κάθε ώρα. 20 από τις 85
 * παραλίες έχουν σταθμό· οι υπόλοιπες παίρνουν το συμπέρασμα μόνο ως ένδειξη.
 *
 *   node scripts/judgeSeaWindCellSwapAgainstStations.mjs [--ledger reports/quality/sea-wind-cell-overrides-proposed-2026-09-13.json] [--maxKm 20] [--pastDays 92]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';
import { METAR_COASTAL_STATIONS } from './metarCoastalStations.mjs';
import { distanceKm, bearingGapDeg } from './lib/marineCellTrust.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const argVal = (name, fallback) => { const i = process.argv.indexOf(name); return i === -1 || !process.argv[i + 1] ? fallback : process.argv[i + 1]; };
const ledgerPath = argVal('--ledger', 'reports/quality/sea-wind-cell-overrides-proposed-2026-09-13.json');
const MAX_KM = Number(argVal('--maxKm', '20'));
const PAST_DAYS = Number(argVal('--pastDays', '92'));
const today = new Date().toISOString().slice(0, 10);
const outPath = argVal('--out', `reports/quality/sea-wind-cell-station-judge-${today}.json`);
const KT_TO_KMH = 1.852;
const apiKey = await resolveOpenMeteoKey();
if (!apiKey) { console.error('Χωρίς κλειδί Open-Meteo.'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const num = (v, d = 2) => (typeof v === 'number' && Number.isFinite(v) ? Number(v.toFixed(d)) : null);

// ── Παραλίες του ledger με σταθμό κοντά ───────────────────────────────────────────────────
const ledger = JSON.parse(readFileSync(path.resolve(root, ledgerPath), 'utf8'));
const appCache = new Map();
const beachCoords = (region, id) => {
  if (!appCache.has(region)) appCache.set(region, JSON.parse(readFileSync(path.join(root, 'public/data/beaches/app', `${region}.json`), 'utf8')));
  return appCache.get(region).island?.beaches?.find(b => b.id === id)?.coordinates ?? null;
};
const cases = [];
for (const o of ledger.overrides ?? []) {
  const c = beachCoords(o.region, o.beachId);
  if (!c) continue;
  let best = null;
  for (const [icao, name, lat, lon] of METAR_COASTAL_STATIONS) { const d = distanceKm(c.lat, c.lon, lat, lon); if (!best || d < best.km) best = { icao, name, lat, lon, km: d }; }
  if (best && best.km <= MAX_KM) cases.push({ ...o, beach: c, station: { ...best, km: num(best.km, 1) } });
}
console.log(`Παραλίες του ledger με σταθμό ≤${MAX_KM} χλμ: ${cases.length}/${(ledger.overrides ?? []).length}`);
if (!cases.length) process.exit(0);

// ── METAR αρχείο (Iowa ASOS), μία κλήση για όλους τους σταθμούς ──────────────────────────
const stations = [...new Set(cases.map(c => c.station.icao))];
const dayParts = ms => new Date(ms).toISOString().slice(0, 10).split('-');
const endMs = Date.now() + 86400000, startMs = Date.now() - PAST_DAYS * 86400000;
const [y1, m1, d1] = dayParts(startMs), [y2, m2, d2] = dayParts(endMs);
const asosUrl = 'https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?'
  + stations.map(s => `station=${s}`).join('&')
  + `&data=sknt&data=drct&data=gust&year1=${y1}&month1=${m1}&day1=${d1}&year2=${y2}&month2=${m2}&day2=${d2}`
  + '&tz=UTC&format=onlycomma&latlon=no&missing=M&trace=T&direct=no&report_type=3&report_type=4';
const csvRes = await fetch(asosUrl, { signal: AbortSignal.timeout(180000) });
if (!csvRes.ok) { console.error(`αρχείο METAR: HTTP ${csvRes.status}`); process.exit(1); }
const observed = new Map(); // `ICAO|YYYY-MM-DDTHH` (UTC) → { kmh, deg, gustKmh }
for (const line of (await csvRes.text()).split('\n').slice(1)) {
  const [icao, valid, sknt, drct, gust] = line.trim().split(',');
  if (!icao || !valid || sknt === undefined || sknt === 'M' || sknt === '') continue;
  const kt = Number(sknt); if (!Number.isFinite(kt)) continue;
  const d = new Date(`${valid.replace(' ', 'T')}:00Z`); if (Number.isNaN(d.getTime())) continue;
  const rounded = new Date(Math.round(d.getTime() / 3600000) * 3600000);
  const key = `${icao}|${rounded.toISOString().slice(0, 13)}`;
  const gap = Math.abs(d.getTime() - rounded.getTime());
  const prev = observed.get(key);
  if (!prev || gap < prev.gap) observed.set(key, { gap, kmh: kt * KT_TO_KMH, deg: Number.isFinite(Number(drct)) ? Number(drct) : null, gustKmh: Number.isFinite(Number(gust)) ? Number(gust) * KT_TO_KMH : null });
}
console.log(`METAR: ${observed.size} ώρες-σταθμοί από ${stations.length} σταθμούς (${PAST_DAYS} μέρες)`);

// ── Τα δύο κελιά ανά παραλία, από το αρχείο του μοντέλου, στο κέντρο του κελιού ──────────
const cellKeys = [...new Set(cases.flatMap(c => [c.excludedCell, c.chosenCell]))];
const cellSeries = new Map();
for (let i = 0; i < cellKeys.length; i += 50) {
  const batch = cellKeys.slice(i, i + 50);
  const url = 'https://customer-api.open-meteo.com/v1/forecast'
    + `?latitude=${batch.map(k => k.split('_')[0]).join(',')}&longitude=${batch.map(k => k.split('_')[1]).join(',')}`
    + `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC&past_days=${PAST_DAYS}&forecast_days=1&cell_selection=sea&apikey=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  const json = await res.json();
  if (json.error) { console.error(`μοντέλο: ${json.reason}`); process.exit(1); }
  const rows = Array.isArray(json) ? json : [json];
  batch.forEach((k, j) => {
    const r = rows[j];
    const echo = `${r.latitude}_${r.longitude}`;
    const byHour = new Map();
    r.hourly.time.forEach((t, idx) => byHour.set(t.slice(0, 13), { kmh: r.hourly.wind_speed_10m[idx], deg: r.hourly.wind_direction_10m[idx], gust: r.hourly.wind_gusts_10m[idx] }));
    cellSeries.set(k, { echo, echoMatches: echo === k, byHour });
  });
  if (i + 50 < cellKeys.length) await sleep(1500);
}

// ── Σύγκριση ώρα-ώρα (10-18 τοπική = 07-15 UTC), ανά παραλία ───────────────────────────
const LOCAL_START = 10, LOCAL_END = 18, TZ_OFFSET = 3; // Ελλάδα, θερινή
const perBeach = [];
for (const c of cases) {
  const old = cellSeries.get(c.excludedCell), neu = cellSeries.get(c.chosenCell);
  const rows = [];
  for (const [key, obs] of observed) {
    const [icao, hourUtc] = key.split('|');
    if (icao !== c.station.icao) continue;
    const localHour = (Number(hourUtc.slice(11, 13)) + TZ_OFFSET) % 24;
    if (localHour < LOCAL_START || localHour > LOCAL_END) continue;
    const a = old?.byHour.get(hourUtc), b = neu?.byHour.get(hourUtc);
    if (!a || !b || typeof a.kmh !== 'number' || typeof b.kmh !== 'number') continue;
    rows.push({ t: hourUtc, obs: obs.kmh, obsDeg: obs.deg, old: a.kmh, oldDeg: a.deg, neu: b.kmh, neuDeg: b.deg });
  }
  const n = rows.length;
  const mae = f => (n ? rows.reduce((s, r) => s + Math.abs(f(r) - r.obs), 0) / n : null);
  const bias = f => (n ? rows.reduce((s, r) => s + (f(r) - r.obs), 0) / n : null);
  const dirMae = (f) => { const rr = rows.filter(r => r.obsDeg != null && r.obs >= 6); return rr.length ? rr.reduce((s, r) => s + bearingGapDeg(f(r), r.obsDeg), 0) / rr.length : null; };
  const bftExact = f => (n ? rows.filter(r => getBeaufortLevel(f(r)) === getBeaufortLevel(r.obs)).length / n : null);
  const bftUnder = f => (n ? rows.filter(r => getBeaufortLevel(f(r)) <= getBeaufortLevel(r.obs) - 1).length / n : null);
  // Όπου τα δύο κελιά διαφωνούν ≥1 Μπφ: ποιο είναι πιο κοντά στο όργανο;
  const disagree = rows.filter(r => getBeaufortLevel(r.old) !== getBeaufortLevel(r.neu));
  const newCloser = disagree.filter(r => Math.abs(r.neu - r.obs) < Math.abs(r.old - r.obs)).length;
  const strong = rows.filter(r => getBeaufortLevel(r.obs) >= 4);
  const strongUnderOld = strong.length ? strong.filter(r => getBeaufortLevel(r.old) <= getBeaufortLevel(r.obs) - 1).length / strong.length : null;
  const strongUnderNew = strong.length ? strong.filter(r => getBeaufortLevel(r.neu) <= getBeaufortLevel(r.obs) - 1).length / strong.length : null;
  const verdict = n < 100 ? 'λίγα' : (mae(r => r.neu) < mae(r => r.old) - 0.5 ? 'νέο' : mae(r => r.old) < mae(r => r.neu) - 0.5 ? 'παλιό' : 'ισοπαλία');
  perBeach.push({
    beachId: c.beachId, name: c.name, region: c.region, station: c.station, oldCell: c.excludedCell, newCell: c.chosenCell,
    echo: { old: old?.echoMatches ?? null, new: neu?.echoMatches ?? null }, hours: n,
    old: { maeKmh: num(mae(r => r.old)), biasKmh: num(bias(r => r.old)), dirMaeDeg: num(dirMae(r => r.oldDeg), 0), bftExact: num(bftExact(r => r.old), 3), bftUnder: num(bftUnder(r => r.old), 3), strongUnder: num(strongUnderOld, 3) },
    new: { maeKmh: num(mae(r => r.neu)), biasKmh: num(bias(r => r.neu)), dirMaeDeg: num(dirMae(r => r.neuDeg), 0), bftExact: num(bftExact(r => r.neu), 3), bftUnder: num(bftUnder(r => r.neu), 3), strongUnder: num(strongUnderNew, 3) },
    disagreeHours: disagree.length, newCloserWhenDisagree: disagree.length ? num(newCloser / disagree.length, 3) : null, strongHours: strong.length,
    verdict,
  });
}

const tally = { νέο: 0, παλιό: 0, ισοπαλία: 0, λίγα: 0 };
for (const b of perBeach) tally[b.verdict] += 1;
const agg = (key, field) => { const v = perBeach.filter(b => b.hours >= 100).map(b => b[key][field]).filter(x => typeof x === 'number'); return v.length ? num(v.reduce((s, x) => s + x, 0) / v.length) : null; };
const summary = {
  beaches: perBeach.length, verdicts: tally,
  meanMaeKmh: { old: agg('old', 'maeKmh'), new: agg('new', 'maeKmh') }, meanBiasKmh: { old: agg('old', 'biasKmh'), new: agg('new', 'biasKmh') },
  meanDirMaeDeg: { old: agg('old', 'dirMaeDeg'), new: agg('new', 'dirMaeDeg') }, meanBftExact: { old: agg('old', 'bftExact'), new: agg('new', 'bftExact') },
  meanStrongUnder: { old: agg('old', 'strongUnder'), new: agg('new', 'strongUnder') },
  newCloserWhenDisagree: num(perBeach.filter(b => b.disagreeHours >= 20).reduce((s, b) => s + b.newCloserWhenDisagree, 0) / Math.max(1, perBeach.filter(b => b.disagreeHours >= 20).length), 3),
};
mkdirSync(path.dirname(path.resolve(root, outPath)), { recursive: true });
writeFileSync(path.resolve(root, outPath), JSON.stringify({ generatedAt: new Date().toISOString(), ledger: ledgerPath, maxKm: MAX_KM, pastDays: PAST_DAYS, hoursLocal: `${LOCAL_START}-${LOCAL_END}`, judge: 'METAR (Iowa ASOS) αεροδρομίων ≤20 χλμ — όργανο στο αεροδρόμιο, όχι στην άμμο', summary, perBeach }, null, 2), 'utf8');

console.log(`\n=== Δ9-Δ κριτής σταθμών: ${perBeach.length} παραλίες ===`);
for (const b of perBeach) console.log(`  #${b.beachId} ${b.name.padEnd(28)} ${b.station.icao} ${String(b.station.km).padStart(4)} χλμ · ώρες ${b.hours} · MAE παλιό ${b.old.maeKmh} / νέο ${b.new.maeKmh} χλμ/ώ · bias ${b.old.biasKmh}/${b.new.biasKmh} · κατεύθ. ${b.old.dirMaeDeg}°/${b.new.dirMaeDeg}° · Μπφ ακριβώς ${b.old.bftExact}/${b.new.bftExact} · υπο-δείχνει ≥4 Μπφ ${b.old.strongUnder}/${b.new.strongUnder} · διαφωνούν ${b.disagreeHours} ώρες, νέο πιο κοντά ${b.newCloserWhenDisagree} → ${b.verdict}`);
console.log(`  Σύνοψη: ${JSON.stringify(summary)}`);
console.log(`Αναφορά: ${outPath}`);
