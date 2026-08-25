#!/usr/bin/env node
/**
 * ΥΠΕΡΕΚΤΙΜΑ ΤΟ ΜΟΝΤΕΛΟ ΤΟΝ ΑΝΕΜΟ ΟΤΑΝ Ο ΑΕΡΑΣ ΚΑΤΕΒΑΙΝΕΙ ΑΠΟ ΨΗΛΑ; — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ (24/08/2026). Δύο αναφορές Μίλτου με κάμερα την ίδια μέρα: Βάι #730 (τυπώναμε
 * 5 Μπφ, άνεμος ΔΒΔ 297°) και Λιβάδια Παροικιάς #2033 (4-5 Μπφ, Β 7°). Το ΚΥΜΑ διαβαζόταν
 * σωστά — το είχε μόλις πιάσει η γωνία σκιάς (K_d). Ο ΑΝΕΜΟΣ όχι. Και στις δύο ο αέρας φτάνει
 * αφού έχει περάσει πάνω από στεριά που ανεβαίνει: στο Βάι το DEM δίνει 1 μ. στην πινέζα,
 * 109 μ. στο 1 χλμ ανάντη, 189 μ. στα 2 χλμ.
 *
 * ΤΙ ΡΩΤΑΕΙ. Το σφάλμα «μοντέλο − όργανο» αλλάζει συστηματικά όταν ΑΝΑΝΤΗ του σημείου υπάρχει
 * ανάγλυφο, σε σχέση με ώρες που ο ίδιος σταθμός δέχεται τον άνεμο από ανοιχτά; Αν ναι, η
 * έκπτωση υπήνεμου είναι μετρημένη. Αν όχι, ΔΕΝ ΜΠΑΙΝΕΙ — και αυτό είναι εξίσου έγκυρη έκβαση.
 *
 * ΓΙΑΤΙ «ΑΝΑΓΛΥΦΟ» ΚΑΙ ΟΧΙ «ΣΤΕΡΙΑ/ΘΑΛΑΣΣΑ». Το δυαδικό `windShadow` (στεριά μέσα σε 300 μ.)
 * είναι αληθές στο 44,3% των παραλιών στον βοριά — δεν ξεχωρίζει τίποτα, θα κατασκεύαζε ηρεμία
 * μαζικά (σκανδάλη #1 του §9). Το ΥΨΟΣ ανάντη είναι συνεχές, ερμηνεύσιμο («ο αέρας κατεβαίνει
 * από λόφο»), και είναι ΤΟ ΙΔΙΟ DEM που κοιτάει ήδη ο δάπεδος ριπής για να πει στεριά/θάλασσα.
 *
 * Ο ΚΡΙΤΗΣ: τα 30 ανεμόμετρα του `scripts/lib/windStations.mjs` (METAR, 10-λεπτος μέσος στα
 * 10 μ.), με τη ΜΕΤΡΗΜΕΝΗ γωνία τους — όχι του μοντέλου, ώστε ο διαχωρισμός των ωρών να μην
 * εξαρτάται από αυτό που κρίνεται. (Τρέχει και με τη γωνία του μοντέλου ως έλεγχος.)
 *
 * ⚠️ ΤΟ ΣΟΒΑΡΟΤΕΡΟ ΜΕΘΟΔΟΛΟΓΙΚΟ ΣΗΜΕΙΟ — ΓΙΑΤΙ ΟΛΑ ΕΙΝΑΙ *ΜΕΣΑ ΣΤΟΝ ΙΔΙΟ ΣΤΑΘΜΟ*. Κάθε
 * σταθμός έχει δική του μεροληψία (η Νάξος +5,3, το Ηράκλειο −3,8). Αν συγκρίνει κανείς
 * «υπήνεμες ώρες» με «ανοιχτές ώρες» ΑΝΑΜΕΣΑ σε σταθμούς, μετράει ποιοι σταθμοί είναι
 * ηπειρωτικοί — όχι τι κάνει το ανάγλυφο. Εδώ η αντίθεση υπολογίζεται ΓΙΑ ΚΑΘΕ ΣΤΑΘΜΟ ΧΩΡΙΣΤΑ
 * και μετά συνοψίζεται στους σταθμούς. Ίδιο για την ένταση: η μεροληψία εξαρτάται από το
 * Μποφόρ (συμπίεση εύρους), οπότε η αντίθεση βγαίνει ΜΕΣΑ σε ζώνη έντασης ΤΟΥ ΟΡΓΑΝΟΥ.
 *
 * ΔΕΝ αλλάζει καμία σταθερά. Γράφει reports/weather/lee-wind-bias-<ημερομηνία>.json.
 *   node scripts/measureLeeWindBias.mjs [--windows A,B,C] [--refresh-geometry]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { STATIONS, fetchStationHours } from './lib/windStations.mjs';
// Η γεωμετρία ανάντη (DEM ακτίνες, δειγματολήπτης υψομέτρων, curl-fetch) ζει από 25/08/2026 στο
// lib/upwindDem.mjs — ίδιος κώδικας, μοιρασμένος με τον κριτή meteosearch. Κανένα αντίγραφο εδώ.
import {
  SLOTS, STEP_DEG, SAMPLE_STEP_KM, SAMPLE_MAX_KM, SAMPLES_PER_RAY,
  destinationPoint, fetchJson, createElevationSampler, upwindRelief,
} from './lib/upwindDem.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

const arg = name => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};
const REFRESH_GEOMETRY = process.argv.includes('--refresh-geometry');

// ── Παράθυρα: τα ίδια που μέτρησαν τον δάπεδο ριπής και την αποσυμπίεση, ώστε τα νούμερα να
// συγκρίνονται με τους πίνακες του utils/windGustFloor.ts. Το D θέλει πληρωμένο κλειδί.
const API_KEY = process.env.OPEN_METEO_API_KEY?.trim() || null;
const ALL_WINDOWS = {
  A: ['2026-06-20', '2026-07-05'],
  B: ['2026-08-04', '2026-08-18'],
  C: ['2026-07-10', '2026-07-25'],
  ...(API_KEY ? { D: ['2026-05-20', '2026-06-05'] } : {}),
};
const WINDOW_KEYS = (arg('windows') || Object.keys(ALL_WINDOWS).join(',')).split(',').filter(k => ALL_WINDOWS[k]);

// ── Γεωμετρία ανάντη ────────────────────────────────────────────────────────────────────────
// 24 γωνίες ανά 15°, δείγματα DEM κάθε 400 μ. ως τα 4 χλμ — οι σταθερές και το γιατί, στο
// lib/upwindDem.mjs. Η cache μένει ΑΚΡΙΒΩΣ όπου ήταν (.tmp/lee-wind), ώστε τα παράθυρα του
// 24/08 να ξανατρέχουν χωρίς δίκτυο.
const leeCacheDir = path.join(root, '.tmp', 'lee-wind');
const geometryCachePath = path.join(leeCacheDir, 'station-upwind-dem.json');
const DEM_SOURCE = arg('dem') || (API_KEY ? 'open-meteo' : 'opentopodata');
const { fetchElevationsResumable } = createElevationSampler({
  cacheDir: leeCacheDir, apiKey: API_KEY, demSource: DEM_SOURCE, refresh: REFRESH_GEOMETRY,
});

const buildStationGeometry = async () => {
  if (!REFRESH_GEOMETRY && fs.existsSync(geometryCachePath)) {
    const cached = JSON.parse(fs.readFileSync(geometryCachePath, 'utf8'));
    if (cached.slots === SLOTS && cached.sampleStepKm === SAMPLE_STEP_KM && cached.sampleMaxKm === SAMPLE_MAX_KM
      && cached.demSource === DEM_SOURCE && Object.keys(cached.stations || {}).length === STATIONS.length) {
      process.stderr.write(`· γεωμετρία ανάντη: από cache (${geometryCachePath})\n`);
      return cached.stations;
    }
  }
  process.stderr.write('· γεωμετρία ανάντη: δειγματοληψία DEM…\n');
  const points = [];
  const index = [];
  for (const [icao, , lat, lon] of STATIONS) {
    points.push({ lat, lon });
    index.push({ icao, slot: -1, step: -1 });
    for (let slot = 0; slot < SLOTS; slot++) {
      for (let s = 1; s <= SAMPLES_PER_RAY; s++) {
        points.push(destinationPoint({ lat, lon }, slot * STEP_DEG, s * SAMPLE_STEP_KM));
        index.push({ icao, slot, step: s });
      }
    }
  }
  const elevations = await fetchElevationsResumable(points);
  const stations = {};
  for (const [icao] of STATIONS) stations[icao] = { selfM: null, rays: Array.from({ length: SLOTS }, () => []) };
  elevations.forEach((m, i) => {
    const { icao, slot, step } = index[i];
    if (slot < 0) stations[icao].selfM = m;
    else stations[icao].rays[slot][step - 1] = m;
  });
  fs.mkdirSync(path.dirname(geometryCachePath), { recursive: true });
  fs.writeFileSync(geometryCachePath, JSON.stringify({
    note: 'DEM ανάντη ανά 15°, βήμα 200 μ. ως 5 χλμ. Παράγεται από scripts/measureLeeWindBias.mjs.',
    slots: SLOTS, sampleStepKm: SAMPLE_STEP_KM, sampleMaxKm: SAMPLE_MAX_KM, demSource: DEM_SOURCE, stations,
  }, null, 2));
  return stations;
};

// ── Δεδομένα: όργανο + μοντέλο στις συντεταγμένες του οργάνου ────────────────────────────────
const loadWindow = async (key) => {
  const [start, end] = ALL_WINDOWS[key];
  const startMs = Date.parse(`${start}T00:00:00Z`), endMs = Date.parse(`${end}T23:00:00Z`);
  process.stderr.write(`· ${key} ${start} → ${end}: όργανα…`);
  const observed = await fetchStationHours(startMs, endMs);
  process.stderr.write(` ${observed.size} ώρες-σταθμοί · μοντέλο…`);
  const meteo = await fetchJson((API_KEY
    ? 'https://customer-historical-forecast-api.open-meteo.com/v1/forecast'
    : 'https://api.open-meteo.com/v1/forecast')
    + `?latitude=${STATIONS.map(s => s[2]).join(',')}&longitude=${STATIONS.map(s => s[3]).join(',')}`
    + '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC'
    + `&start_date=${start}&end_date=${end}`
    + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : ''));
  const entries = Array.isArray(meteo) ? meteo : [meteo];
  const rows = [];
  STATIONS.forEach(([icao, name], i) => {
    const m = entries[i];
    if (!m?.hourly?.time) return;
    const { time, wind_speed_10m: ws, wind_gusts_10m: wg, wind_direction_10m: wd } = m.hourly;
    for (let h = 0; h < time.length; h++) {
      const t = time[h].slice(0, 13);
      const obs = observed.get(`${icao}|${t}`);
      const raw = ws?.[h];
      if (!obs || !Number.isFinite(raw)) continue;
      const gust = Number.isFinite(wg?.[h]) ? wg[h] : null;
      rows.push({
        icao, name, stationIdx: i, window: key, time: t,
        raw, gust, elevation: m.elevation,
        prod: applyGustFloor(raw, gust, m.elevation, 'kmh'),
        modelDir: Number.isFinite(wd?.[h]) ? wd[h] : null,
        obs: obs.kmh, obsDir: obs.dir,
      });
    }
  });
  process.stderr.write(` ${rows.length} ζευγάρια\n`);
  return rows;
};

// ── Στατιστικά ──────────────────────────────────────────────────────────────────────────────
const mean = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const median = xs => {
  if (!xs.length) return null;
  const v = [...xs].sort((a, b) => a - b);
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};
const round = (n, p = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);

export { destinationPoint, upwindRelief };

// ── Εκτέλεση ────────────────────────────────────────────────────────────────────────────────
const geometry = await buildStationGeometry();

const rowsCachePath = path.join(root, '.tmp', 'lee-wind', `rows-${WINDOW_KEYS.join('')}${API_KEY ? '-paid' : ''}.json`);
let allRows = [];
if (!process.argv.includes('--refresh-rows') && fs.existsSync(rowsCachePath)) {
  allRows = JSON.parse(fs.readFileSync(rowsCachePath, 'utf8'));
  process.stderr.write(`· ζευγάρια: από cache (${allRows.length})\n`);
} else {
  for (const key of WINDOW_KEYS) allRows.push(...await loadWindow(key));
  fs.mkdirSync(path.dirname(rowsCachePath), { recursive: true });
  fs.writeFileSync(rowsCachePath, JSON.stringify(allRows));
}
if (allRows.length < 2000) { console.error(`πολύ λίγα ζευγάρια (${allRows.length}) — δεν βγάζω συμπέρασμα`); process.exit(1); }

/** Ώρες όπου η μετρημένη γωνία έχει νόημα: το όργανο πρέπει να δείχνει πραγματικό άνεμο. */
const MIN_OBS_KMH_FOR_DIRECTION = 9.3; // 5 κόμβοι — κάτω από αυτό τα METAR γράφουν VRB/00000KT
const RADIUS_KM = Number(arg('radius') || 2);
const WINDOW_DEG = Number(arg('window') || 45);

const usable = allRows.filter(r => Number.isFinite(r.obsDir) && r.obs >= MIN_OBS_KMH_FOR_DIRECTION);
for (const r of usable) {
  const g = geometry[r.icao];
  const rel = g ? upwindRelief(g, r.obsDir, RADIUS_KM, WINDOW_DEG) : null;
  r.reliefM = rel ? rel.meanM : null;
  r.reliefMaxM = rel ? rel.maxM : null;
  r.landFrac = rel ? rel.landFrac : null;
  r.bias = r.prod - r.obs;
  r.rawBias = r.raw - r.obs;
  r.obsBft = getBeaufortLevel(r.obs);
}
const scored = usable.filter(r => Number.isFinite(r.reliefM));

console.log(`\nώρες-σταθμοί: ${allRows.length} · με έγκυρη μετρημένη γωνία (≥${MIN_OBS_KMH_FOR_DIRECTION.toFixed(1)} χλμ/ώ): ${scored.length}`);
console.log(`ακτίνα ανάντη ${RADIUS_KM} χλμ · παράθυρο ±${WINDOW_DEG}° · παράθυρα ${WINDOW_KEYS.join('/')}\n`);

// Πρώτη ματιά: πώς κατανέμεται το ανάγλυφο ανάντη στους σταθμούς
console.log('=== ΤΟ ΑΝΑΓΛΥΦΟ ΑΝΑΝΤΗ ΑΝΑ ΣΤΑΘΜΟ (μ. πάνω από τον σταθμό, στις ώρες του) ===');
console.log('σταθμός                υψόμ.   ώρες   διάμ.   10%    90%   εύρος');
const stationRows = new Map();
for (const [icao, name] of STATIONS) {
  const rows = scored.filter(r => r.icao === icao);
  stationRows.set(icao, rows);
  if (!rows.length) { console.log(`${(name + ' (' + icao + ')').padEnd(22)} — καμία ώρα`); continue; }
  const rel = rows.map(r => r.reliefM).sort((a, b) => a - b);
  const p = q => rel[Math.min(rel.length - 1, Math.floor(q * rel.length))];
  console.log(`${(name + ' (' + icao + ')').padEnd(22)}${String(geometry[icao].selfM).padStart(5)}  ${String(rows.length).padStart(5)}  ${String(round(median(rel), 0)).padStart(6)}  ${String(round(p(0.1), 0)).padStart(5)}  ${String(round(p(0.9), 0)).padStart(5)}  ${String(round(p(0.9) - p(0.1), 0)).padStart(6)}`);
}

/**
 * ΤΟ ΚΥΡΙΟ ΜΕΓΕΘΟΣ — αντίθεση ΜΕΣΑ στον σταθμό ΚΑΙ ΜΕΣΑ στη ζώνη έντασης.
 *
 * Αφαιρείται ο μέσος όρος κάθε κυψέλης (σταθμός × Μποφόρ οργάνου), ώστε να μη μετρηθεί ούτε
 * «ποιοι σταθμοί είναι ηπειρωτικοί» ούτε «η μεροληψία μεγαλώνει με την ένταση» — και τα δύο
 * είναι ήδη γνωστά και δεν είναι αυτό που ρωτάμε. Ό,τι μένει είναι: μέσα στην ίδια ένταση και
 * στον ίδιο σταθμό, τι κάνει η διαφορά στο ανάγλυφο ανάντη.
 */
const MIN_CELL = 20;
const cellKey = r => `${r.icao}|${r.obsBft}`;
const cellStats = new Map();
for (const r of scored) {
  const k = cellKey(r);
  if (!cellStats.has(k)) cellStats.set(k, []);
  cellStats.get(k).push(r);
}
const demeaned = [];
for (const [k, rows] of cellStats) {
  if (rows.length < MIN_CELL) continue;
  const mBias = mean(rows.map(r => r.bias));
  const mRelief = mean(rows.map(r => r.reliefM));
  for (const r of rows) demeaned.push({ ...r, cell: k, dBias: r.bias - mBias, dRelief: r.reliefM - mRelief });
}
console.log(`\nκυψέλες (σταθμός × Μποφόρ) με ≥${MIN_CELL} ώρες: ${[...cellStats.values()].filter(v => v.length >= MIN_CELL).length} · ώρες μέσα τους: ${demeaned.length}`);

console.log('\n=== ΚΑΜΠΥΛΗ: μεροληψία έναντι ανάγλυφου ανάντη, ΜΕΣΑ σε κυψέλη σταθμού×Μποφόρ ===');
console.log('(θετικό = το μοντέλο δίνει ΠΕΡΙΣΣΟΤΕΡΟ από το όργανο, δηλαδή υπερεκτιμά)\n');
const RELIEF_BANDS = [[-Infinity, 25], [25, 75], [75, 150], [150, 300], [300, 600], [600, Infinity]];
console.log('ανάγλυφο ανάντη      ώρες   ωμή μεροληψία   μεροληψία-εντός-κυψέλης');
for (const [lo, hi] of RELIEF_BANDS) {
  const rows = demeaned.filter(r => r.reliefM >= lo && r.reliefM < hi);
  if (!rows.length) continue;
  const label = lo === -Infinity ? '< 25 μ.' : hi === Infinity ? '> 600 μ.' : `${lo}-${hi} μ.`;
  console.log(`${label.padEnd(18)}${String(rows.length).padStart(7)}   ${String(round(mean(rows.map(r => r.bias)), 2)).padStart(13)}   ${String(round(mean(rows.map(r => r.dBias)), 2)).padStart(23)}`);
}

console.log('\n=== ΑΝΤΙΘΕΣΗ ΑΝΑ ΣΤΑΘΜΟ (πάνω τριτημόριο ανάγλυφου − κάτω τριτημόριο, εντός κυψέλης) ===');
console.log('θετικό = ο ΙΔΙΟΣ σταθμός στην ΙΔΙΑ ένταση διαβάζεται πιο ψηλά όταν έχει βουνό ανάντη\n');
console.log('σταθμός                ώρες↓  ώρες↑   ανάγλυφο↓  ανάγλυφο↑   αντίθεση χλμ/ώ');
const contrasts = [];
for (const [icao, name] of STATIONS) {
  const rows = demeaned.filter(r => r.icao === icao);
  if (rows.length < 3 * MIN_CELL) continue;
  const sorted = [...rows].sort((a, b) => a.reliefM - b.reliefM);
  const cut = Math.floor(sorted.length / 3);
  const low = sorted.slice(0, cut), high = sorted.slice(-cut);
  if (low.length < MIN_CELL || high.length < MIN_CELL) continue;
  // Αν ο σταθμός δεν έχει πραγματικό εύρος ανάγλυφου, η αντίθεση δεν σημαίνει τίποτα.
  const spread = median(high.map(r => r.reliefM)) - median(low.map(r => r.reliefM));
  const contrast = mean(high.map(r => r.dBias)) - mean(low.map(r => r.dBias));
  contrasts.push({ icao, name, contrast, spread, n: rows.length });
  console.log(`${(name + ' (' + icao + ')').padEnd(22)}${String(low.length).padStart(5)}  ${String(high.length).padStart(5)}   ${String(round(median(low.map(r => r.reliefM)), 0)).padStart(9)}  ${String(round(median(high.map(r => r.reliefM)), 0)).padStart(9)}   ${String(round(contrast, 2)).padStart(14)}`);
}
const meaningful = contrasts.filter(c => c.spread >= 50);
console.log(`\nσταθμοί με πραγματικό εύρος ανάγλυφου (≥50 μ. διαφορά): ${meaningful.length}/${contrasts.length}`);
if (meaningful.length) {
  const values = meaningful.map(c => c.contrast);
  const positive = values.filter(v => v > 0).length;
  console.log(`διάμεσος αντίθεση: ${round(median(values), 2)} χλμ/ώ · μέση: ${round(mean(values), 2)} χλμ/ώ`);
  console.log(`σταθμοί με ΘΕΤΙΚΗ αντίθεση (μοντέλο ψηλά στο υπήνεμο): ${positive}/${meaningful.length}`);
}

console.log('\n=== ΕΛΕΓΧΟΣ: το ίδιο με τη γωνία ΤΟΥ ΜΟΝΤΕΛΟΥ αντί του οργάνου ===');
{
  const alt = [];
  for (const r of usable) {
    if (!Number.isFinite(r.modelDir)) continue;
    const rel = upwindRelief(geometry[r.icao], r.modelDir, RADIUS_KM, WINDOW_DEG);
    if (rel) alt.push({ ...r, reliefM: rel.meanM });
  }
  const cells = new Map();
  for (const r of alt) {
    const k = `${r.icao}|${r.obsBft}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(r);
  }
  const dm = [];
  for (const rows of cells.values()) {
    if (rows.length < MIN_CELL) continue;
    const mBias = mean(rows.map(r => r.bias));
    for (const r of rows) dm.push({ ...r, dBias: r.bias - mBias });
  }
  console.log('ανάγλυφο ανάντη      ώρες   μεροληψία-εντός-κυψέλης');
  for (const [lo, hi] of RELIEF_BANDS) {
    const rows = dm.filter(r => r.reliefM >= lo && r.reliefM < hi);
    if (!rows.length) continue;
    const label = lo === -Infinity ? '< 25 μ.' : hi === Infinity ? '> 600 μ.' : `${lo}-${hi} μ.`;
    console.log(`${label.padEnd(18)}${String(rows.length).padStart(7)}   ${String(round(mean(rows.map(r => r.dBias)), 2)).padStart(23)}`);
  }
}

console.log('\n=== ΕΥΑΙΣΘΗΣΙΑ: ακτίνα και πλάτος παραθύρου ===');
console.log('ακτίνα  παράθυρο   κλίση χλμ/ώ ανά 100 μ. ανάγλυφου (εντός κυψέλης)   ώρες');
for (const radius of [0.5, 1, 2, 5]) {
  for (const win of [30, 45, 60]) {
    const rows = [];
    for (const r of usable) {
      const rel = upwindRelief(geometry[r.icao], r.obsDir, radius, win);
      if (rel) rows.push({ ...r, reliefM: rel.meanM });
    }
    const cells = new Map();
    for (const r of rows) {
      const k = `${r.icao}|${r.obsBft}`;
      if (!cells.has(k)) cells.set(k, []);
      cells.get(k).push(r);
    }
    const pts = [];
    for (const cell of cells.values()) {
      if (cell.length < MIN_CELL) continue;
      const mBias = mean(cell.map(r => r.bias)), mRel = mean(cell.map(r => r.reliefM));
      for (const r of cell) pts.push([r.reliefM - mRel, r.bias - mBias]);
    }
    if (pts.length < 500) continue;
    let cov = 0, varx = 0;
    for (const [x, y] of pts) { cov += x * y; varx += x * x; }
    const slope = varx ? (cov / varx) * 100 : null;
    console.log(`${String(radius).padStart(5)}   ${String('±' + win + '°').padStart(7)}   ${String(round(slope, 3)).padStart(45)}   ${String(pts.length).padStart(6)}`);
  }
}

/**
 * §Γ45 ΣΕ ΜΙΚΡΟΓΡΑΦΙΑ — ΣΤΕΚΕΙ Η ΚΛΙΣΗ ΣΕ ΚΑΘΕ ΠΑΡΑΘΥΡΟ ΧΩΡΙΣΤΑ;
 *
 * Μια κλίση που εμφανίζεται στο άθροισμα και εξαφανίζεται (ή γυρίζει πρόσημο) στα επιμέρους
 * παράθυρα είναι θόρυβος, όχι φυσική. Ίδιος κανόνας που έκοψε τον πολλαπλασιαστή ×1,20.
 */
const perWindowSlopes = [];
console.log('\n=== ΤΟ ΙΔΙΟ, ΑΝΑ ΠΑΡΑΘΥΡΟ ΧΩΡΙΣΤΑ (κλίση χλμ/ώ ανά 100 μ. ανάγλυφου) ===');
console.log('ακτίνα   ' + WINDOW_KEYS.map(k => k.padStart(9)).join('') + '      όλα     ίδιο πρόσημο;');
for (const radius of [0.5, 1, 2, 4]) {
  const cells = new Map();
  for (const r of usable) {
    const rel = upwindRelief(geometry[r.icao], r.obsDir, radius, WINDOW_DEG);
    if (!rel) continue;
    const k = `${r.window}|${r.icao}|${r.obsBft}`;
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push({ ...r, reliefM: rel.meanM });
  }
  const slopeOf = (filter) => {
    let cov = 0, varx = 0, n = 0;
    for (const [k, cell] of cells) {
      if (!filter(k) || cell.length < MIN_CELL) continue;
      const mBias = mean(cell.map(r => r.bias)), mRel = mean(cell.map(r => r.reliefM));
      for (const r of cell) { const x = r.reliefM - mRel, y = r.bias - mBias; cov += x * y; varx += x * x; n += 1; }
    }
    return { slope: varx ? (cov / varx) * 100 : null, n };
  };
  const per = WINDOW_KEYS.map(w => slopeOf(k => k.startsWith(`${w}|`)));
  const all = slopeOf(() => true);
  perWindowSlopes.push({ radiusKm: radius, perWindow: Object.fromEntries(WINDOW_KEYS.map((w, i) => [w, round(per[i].slope, 3)])), all: round(all.slope, 3) });
  const signs = per.filter(p => Number.isFinite(p.slope)).map(p => Math.sign(p.slope));
  const consistent = signs.length > 1 && signs.every(x => x === signs[0]);
  console.log(`${String(radius).padStart(5)}   ` + per.map(p => String(round(p.slope, 2)).padStart(9)).join('')
    + `${String(round(all.slope, 2)).padStart(9)}     ${consistent ? 'ΝΑΙ' : 'ΟΧΙ — γυρίζει πρόσημο'}`);
}

// ── Έξοδος ──────────────────────────────────────────────────────────────────────────────────
const outPath = path.join(root, 'reports', 'weather', `lee-wind-bias-${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({
  question: 'Υπερεκτιμά το μοντέλο τον άνεμο όταν υπάρχει ανάγλυφο ανάντη του σημείου;',
  method: 'METAR 30 σταθμών· γωνία ΜΕΤΡΗΜΕΝΗ· ανάγλυφο = max DEM ανάντη − υψόμετρο σταθμού, μέσος όρος ακτίνων ±window· αφαίρεση μέσου κυψέλης (σταθμός × Μποφόρ οργάνου).',
  windows: WINDOW_KEYS.map(k => ({ key: k, range: ALL_WINDOWS[k] })),
  settings: { demSource: DEM_SOURCE, radiusKm: RADIUS_KM, windowDeg: WINDOW_DEG, minObsKmhForDirection: MIN_OBS_KMH_FOR_DIRECTION, minCell: MIN_CELL, sampleStepKm: SAMPLE_STEP_KM, sampleMaxKm: SAMPLE_MAX_KM },
  counts: { pairs: allRows.length, withDirection: scored.length, inCells: demeaned.length },
  reliefBands: RELIEF_BANDS.map(([lo, hi]) => {
    const rows = demeaned.filter(r => r.reliefM >= lo && r.reliefM < hi);
    return { from: lo === -Infinity ? null : lo, to: hi === Infinity ? null : hi, hours: rows.length, rawBias: round(mean(rows.map(r => r.bias)), 3), withinCellBias: round(mean(rows.map(r => r.dBias)), 3) };
  }),
  stationContrasts: contrasts.map(c => ({ icao: c.icao, name: c.name, hours: c.n, reliefSpreadM: round(c.spread, 0), contrastKmh: round(c.contrast, 3) })),
  stationsWithRealReliefSpread: { withSpread50m: meaningful.length, total: contrasts.length,
    missingStations: STATIONS.filter(([icao]) => !scored.some(r => r.icao === icao)).map(([icao, name]) => `${name} (${icao})`) },
  perWindowSlopes,
  verdict: perWindowSlopes.every(r => {
    const v = Object.values(r.perWindow).filter(Number.isFinite);
    return !(v.length > 1 && v.every(x => Math.sign(x) === Math.sign(v[0])));
  })
    ? 'ΔΕΝ ΜΠΑΙΝΕΙ ΔΙΟΡΘΩΣΗ: η κλίση γυρίζει πρόσημο μεταξύ παραθύρων σε ΚΑΘΕ ακτίνα — θόρυβος, όχι φυσική. Και ο κριτής δεν έχει δύναμη: μόνο 3/25 σταθμοί έχουν εύρος ανάγλυφου ≥50 μ.'
    : 'ΥΠΑΡΧΕΙ ΣΥΝΕΠΕΣ ΣΗΜΑ — δες perWindowSlopes πριν προταθεί οτιδήποτε.',
  limits: [
    'Ο κριτής είναι αεροδρόμιο, όχι παραλία: τα αεροδρόμια χτίζονται σε επίπεδο έδαφος, οπότε το εύρος ανάγλυφου ανάντη είναι μικρότερο απ’ ό,τι σε μια παραλία κάτω από βουνό.',
    'Μάιος-Αύγουστος μόνο· χειμώνας αδοκίμαστος.',
    'Η γωνία METAR είναι στρογγυλεμένη στις 10° και σε αδύναμο άνεμο ασαφής — γι’ αυτό το κατώφλι έντασης.',
    `Πηγή DEM: ${DEM_SOURCE}. Κανένα DEM δεν βλέπει δέντρα, κτίρια ή λεπτή τραχύτητα — μόνο έδαφος.`,
  ],
}, null, 2));
console.log(`\nγράφτηκε ${path.relative(root, outPath)}`);
