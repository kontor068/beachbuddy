#!/usr/bin/env node
/**
 * ΤΙ ΛΕΝΕ ΟΙ ΣΤΑΘΜΟΙ ΤΩΝ ΧΩΡΙΩΝ ΓΙΑ ΤΟΝ ΑΝΕΜΟ ΜΑΣ; — Ο ΔΕΥΤΕΡΟΣ ΚΡΙΤΗΣ (meteosearch, ΝΟΑ/meteo.gr).
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ. §15 (24/08/2026): η έκπτωση υπήνεμου ΔΕΝ ΜΠΗΚΕ γιατί ο μόνος φθηνός κριτής —
 * 30 αεροδρόμια — «δεν έχει τη δύναμη να το δει»: μόνο 3/25 σταθμοί έχουν ανάγλυφο ανάντη.
 * §16: «meteosearch = Ο ΣΩΣΤΟΣ ΚΡΙΤΗΣ … μόνο ο parser των txt λείπει». Και 25/08: σχόλιο από
 * την Ψιλή Άμμο Νάξου #2017 («είχε πιο πολύ αέρα απ' ό,τι δείχνατε»), η ίδια μέρα που η
 * ταχύτητα του θαλασσινού κελιού μπήκε στην παραγωγή (§Γ51/§Γ52) με κριτή ΜΟΝΟ αεροδρόμια.
 *
 * ΤΙ ΡΩΤΑΕΙ, ανά σταθμό, σε ΗΜΕΡΗΣΙΑ ανάλυση (τόσο δίνουν τα txt):
 *   (i)  ΥΠΕΡΤΥΠΩΝΕΙ το μοντέλο τον άνεμο τις μέρες που ο αέρας έρχεται πάνω από ανάγλυφο
 *        (υπήνεμες), σε σχέση με τις μέρες που έρχεται από ανοιχτά — ΣΤΟΝ ΙΔΙΟ σταθμό;
 *   (ii) Ποιο σκέλος είναι πιο κοντά στο όργανο: στεριανό κελί ωμό / παραγωγή (αποσυμπίεση),
 *        θαλασσινό κελί ωμό / παραγωγή (θαλάσσια πόρτα) — και αλλάζει η απάντηση ανάλογα με το
 *        αν ο άνεμος της ημέρας είναι onshore / cross / offshore για την ακτή του σταθμού;
 *        Αυτό ΔΕΝ το ρώτησε ποτέ η μελέτη των αεροδρομίων.
 *
 * ΚΑΝΟΝΕΣ ΝΙΚΗΣ, ΓΡΑΜΜΕΝΟΙ ΠΡΙΝ ΤΡΕΞΕΙ (25/08/2026):
 *   (i)  «υπερτυπώνει σε υπήνεμους» ισχύει μόνο αν, ΜΕΣΑ στον ίδιο σταθμό,
 *        bias(υπήνεμες) − bias(ανοιχτές) ≥ +2 χλμ/ώ σε ≥2/3 των σταθμών που έχουν ≥10 μέρες
 *        και στις δύο κλάσεις. Αλλιώς: δεν αποδείχθηκε — ίδια έκβαση με το §15.
 *   (ii) η θάλασσα κερδίζει έναν σταθμό/διαχωρισμό μόνο με ΚΑΙ μικρότερο MAE ΚΑΙ περισσότερα
 *        σωστά ημερήσια Μποφόρ από την παραγωγή στεριάς (ο κανόνας του §Γ51).
 *
 * ΠΩΣ. Τα txt κάθονται στο `.tmp/meteosearch/<id>/<YYYY-MM>.txt` (untracked — τα κατεβάζει
 * άνθρωπος με browser, βλ. lib/meteosearchStations.mjs). Για κάθε σταθμό: Open-Meteo αρχείο
 * προγνώσεων στις συντεταγμένες του, ωριαία, δύο φορές (cell_selection=land και sea), τα
 * τέσσερα σκέλη → ημερήσιοι μέσοι (ώρες τοπικής μέρας) και μέγιστη ριπή· η κυρίαρχη διεύθυνση
 * του οργάνου δίνει τον διαχωρισμό υπήνεμης/ανοιχτής (DEM ανάντη, lib/upwindDem — ίδιο κατώφλι
 * με το measureLeeWindBias: ανάγλυφο ≥75 μ. στα 2 χλμ = υπήνεμη, <25 μ. = ανοιχτή) και τον
 * διαχωρισμό onshore/cross/offshore (±60° γύρω από το coastFacingDeg).
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει `reports/weather/meteosearch-wind-bias-<ημερομηνία>.json`.
 *
 *   node scripts/measureMeteosearchWindBias.mjs --self-test     parser πάνω στο fixture, χωρίς δίκτυο
 *   node scripts/measureMeteosearchWindBias.mjs --dry-run       διαβάζει ό,τι txt βρει και τα τυπώνει
 *   node scripts/measureMeteosearchWindBias.mjs [--dem=opentopodata|open-meteo] [--radius=2]
 *
 * ΟΡΙΑ (να διαβαστούν μαζί με κάθε νούμερο): ημερήσια ανάλυση, όχι ωριαία· ανεμόμετρα Davis σε
 * ΑΓΝΩΣΤΟ ύψος και θέση (όχι το πρότυπο 10 μ. των METAR)· αρχείο προγνώσεων, όχι ανάλυση·
 * λίγοι σταθμοί, καλοκαίρι μόνο· οι συντεταγμένες των σταθμών είναι προσωρινές μέχρι να
 * διαβαστούν από την κεφαλίδα του txt.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { METEOSEARCH_STATIONS, METEOSEARCH_MONTHS } from './lib/meteosearchStations.mjs';
import { parseMeteosearchMonthly } from './lib/meteosearchMonthly.mjs';
import {
  fetchJson, createElevationSampler, rayPointsFor, geometryFromElevations, upwindRelief,
  SLOTS, SAMPLE_STEP_KM, SAMPLE_MAX_KM,
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

const arg = name => { const hit = process.argv.find(a => a.startsWith(`--${name}=`)); return hit ? hit.slice(name.length + 3) : undefined; };
const SELF_TEST = process.argv.includes('--self-test');
const DRY_RUN = process.argv.includes('--dry-run');
const RADIUS_KM = Number(arg('radius') || 2);
const WINDOW_DEG = 45;
const LEE_MIN_RELIEF_M = 75;   // ίδια ζώνη με το measureLeeWindBias (75-150 μ. = ανάγλυφο)
const OPEN_MAX_RELIEF_M = 25;  // < 25 μ. = ανοιχτό
const ONSHORE_HALF_WINDOW_DEG = 60;
const MIN_DAYS_PER_CLASS = 10;
const INPUT_DIR = path.join(root, '.tmp', 'meteosearch');
const CACHE_DIR = path.join(root, '.tmp', 'meteosearch-judge');

const round = (n, p = 2) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
const mean = xs => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);

// ── --self-test: ο parser πάνω στο fixture ─────────────────────────────────────────────────
if (SELF_TEST) {
  const fixture = fs.readFileSync(path.join(root, 'scripts/lib/fixtures/meteosearch-monthly-sample.txt'), 'utf8');
  const r = parseMeteosearchMonthly(fixture, { stationId: 'palaikastro' });
  const expect = (cond, msg) => { if (!cond) { console.error(`✗ ${msg}`); process.exit(1); } };
  expect(r.month === '2026-07', `μήνας: ${r.month}`);
  expect(r.rows.length === 5, `γραμμές: ${r.rows.length}`);
  expect(Math.abs(r.station.lat - 35.2) < 1e-6 && Math.abs(r.station.lon - 26.25) < 1e-6, `LAT/LONG: ${r.station.lat}/${r.station.lon}`);
  expect(r.rows[0].avgWindKmh === 12.4 && r.rows[0].highWindKmh === 38.6 && r.rows[0].domDirDeg === 315, 'ημέρα 1');
  expect(r.rows[1].domDir === 'NNW' && r.rows[1].highWindTime === '16:00', 'ημέρα 2');
  expect(r.rows[3].avgWindKmh === null && r.rows[3].domDir === null, 'ημέρα 4 (κενά ---)');
  expect(r.rows[4].avgWindKmh === 22.3 && r.rows[4].highWindKmh === 60.4 && r.rows[4].domDirDeg === 270, 'ημέρα 5 (δεκαδικά με κόμμα)');
  expect(r.rows[4].meanTempC === 27.9 && r.rows[4].lowTempC === 23.9, 'θερμοκρασίες ημέρας 5');
  console.log('✅ parser meteosearch: 5/5 γραμμές του fixture όπως αναμένονταν (μονάδα km/hr, LAT/LONG, κενά, κόμμα).');
  process.exit(0);
}

// ── Τα αρχεία που υπάρχουν ─────────────────────────────────────────────────────────────────
const readStationFiles = () => {
  const out = [];
  for (const st of METEOSEARCH_STATIONS) {
    const dir = path.join(INPUT_DIR, st.id);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.txt')).sort()) {
      const yearMonth = (f.match(/(\d{4}-\d{2})/) || [])[1];
      const parsed = parseMeteosearchMonthly(fs.readFileSync(path.join(dir, f), 'utf8'), { stationId: st.id, yearMonth });
      out.push({ station: st, file: path.relative(root, path.join(dir, f)), parsed });
    }
  }
  return out;
};

const files = readStationFiles();
if (!files.length) {
  // Η λίστα αγορών, όχι γενική οδηγία: τα `id` είναι τα ΠΡΑΓΜΑΤΙΚΑ ονόματα του meteosearch
  // (lib/meteosearchStations.mjs) και οι φάκελοι φτιάχνονται εδώ, ώστε το βήμα με τον browser
  // να είναι «κατέβασε και ρίξε μέσα», χωρίς να θυμάται κανείς ονοματολογία.
  console.log(`Κανένα txt στο ${path.relative(root, INPUT_DIR)}/<σταθμός>/.\n`);
  console.log('ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΑΝΘΡΩΠΟΣ (25/08/2026): ΔΕΝ φταίει το Cloudflare — η δοκιμασία του περνιέται');
  console.log('  με πραγματικό browser. Πίσω της ο ιστότοπος ζητάει ΛΟΓΑΡΙΑΣΜΟ, με ποσόστωση ανά πρόσωπο:');
  console.log('  «έως και 30 αρχεία μετρήσεων ανά ημέρα και 720 συνολικά ανά χρήστη». Ο λογαριασμός ανοίγει');
  console.log('  με ΤΟ ΔΙΚΟ ΣΟΥ e-mail και αποδοχή των όρων του ΕΑΑ — δεν είναι δουλειά του εργαλείου.');
  console.log('  (Τα 8 αρχεία που χρειάζεται η μέτρηση χωράνε άνετα στα 30 της ημέρας.)');
  console.log('  Λεπτομέρειες και οι υπόλοιπες κλειστές πόρτες: scripts/lib/meteosearchStations.mjs\n');
  console.log('ΒΗΜΑΤΑ');
  console.log('  1. https://meteosearch.meteo.gr → «εγγραφείτε» (μία φορά), μετά σύνδεση και βρες τον σταθμό.');
  console.log('  2. Κατέβασε το μηνιαίο αρχείο για κάθε μήνα και βάλ\' το στον έτοιμο φάκελο:\n');
  for (const st of METEOSEARCH_STATIONS) {
    const dir = path.join(INPUT_DIR, st.id);
    fs.mkdirSync(dir, { recursive: true });
    console.log(`     ${st.name}  →  ${path.relative(root, dir)}/{${METEOSEARCH_MONTHS.join(',')}}.txt`);
    console.log(`       ${st.note}`);
  }
  console.log('\n  3. node scripts/measureMeteosearchWindBias.mjs --dry-run   (τυπώνει τις γραμμές που διάβασε');
  console.log('     και τις ΣΩΣΤΕΣ συντεταγμένες από την κεφαλίδα — γράψ\' τες στο lib/meteosearchStations.mjs)');
  console.log('  4. node scripts/measureMeteosearchWindBias.mjs            (η μέτρηση· ΔΕΝ αλλάζει τίποτα)\n');
  console.log('Φτάνει και ΕΝΑΣ σταθμός για να αρχίσει να λέει κάτι — αλλά η αντίθεση υπήνεμου/ανοιχτού');
  console.log('θέλει τουλάχιστον έναν μάρτυρα (sitia ή naousa) ΚΑΙ έναν ανοιχτό (mykonos ή ios).');
  process.exit(DRY_RUN ? 0 : 1);
}

if (DRY_RUN) {
  for (const { station, file, parsed } of files) {
    console.log(`\n=== ${station.name} · ${file} · μήνας ${parsed.month} · μονάδα ${parsed.unitsWind}`);
    console.log(`    κεφαλίδα: ${parsed.station.name ?? '—'} · ${parsed.station.elevM ?? '—'} μ. · ${parsed.station.lat ?? '—'}, ${parsed.station.lon ?? '—'}`
      + (parsed.station.lat && station.provisional ? `   ← ΓΡΑΨΕ ΤΙΣ στο lib/meteosearchStations.mjs (τώρα: ${station.lat}, ${station.lon})` : ''));
    for (const w of parsed.warnings) console.log(`    ⚠ ${w}`);
    console.log('    ημέρα  μέσος  ριπή   ώρα    κατεύθ.  θερμ.');
    for (const r of parsed.rows) console.log(`    ${String(r.day).padStart(4)}  ${String(r.avgWindKmh ?? '—').padStart(5)}  ${String(r.highWindKmh ?? '—').padStart(5)}  ${String(r.highWindTime ?? '—').padStart(5)}  ${String(r.domDir ?? '—').padStart(6)}  ${String(r.meanTempC ?? '—').padStart(5)}`);
  }
  process.exit(0);
}

// ── Γεωμετρία ανάντη ανά σταθμό (DEM) ──────────────────────────────────────────────────────
const coordsOf = (st) => {
  const fromFile = files.find(f => f.station.id === st.id && Number.isFinite(f.parsed.station.lat) && Number.isFinite(f.parsed.station.lon));
  return fromFile ? { lat: fromFile.parsed.station.lat, lon: fromFile.parsed.station.lon, source: 'txt header' } : { lat: st.lat, lon: st.lon, source: 'provisional' };
};
const stationsInPlay = METEOSEARCH_STATIONS.filter(st => files.some(f => f.station.id === st.id)).map(st => ({ ...st, ...coordsOf(st) }));
const API_KEY = process.env.OPEN_METEO_API_KEY?.trim() || null;
const sampler = createElevationSampler({ cacheDir: CACHE_DIR, apiKey: API_KEY, demSource: arg('dem'), refresh: process.argv.includes('--refresh-geometry') });
const geometryCachePath = path.join(CACHE_DIR, 'station-upwind-dem.json');
const buildGeometry = async () => {
  const wanted = stationsInPlay.map(s => `${s.id}@${s.lat.toFixed(4)},${s.lon.toFixed(4)}`).sort().join('|');
  if (fs.existsSync(geometryCachePath)) {
    const cached = JSON.parse(fs.readFileSync(geometryCachePath, 'utf8'));
    if (cached.key === wanted && cached.demSource === sampler.demSource) { process.stderr.write('· γεωμετρία ανάντη: από cache\n'); return cached.stations; }
  }
  process.stderr.write('· γεωμετρία ανάντη: δειγματοληψία DEM…\n');
  const points = [], index = [];
  for (const st of stationsInPlay) { const r = rayPointsFor(st.id, st); points.push(...r.points); index.push(...r.index); }
  const elevations = await sampler.fetchElevationsResumable(points);
  const stations = geometryFromElevations(stationsInPlay.map(s => s.id), index, elevations);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(geometryCachePath, JSON.stringify({ key: wanted, demSource: sampler.demSource, slots: SLOTS, sampleStepKm: SAMPLE_STEP_KM, sampleMaxKm: SAMPLE_MAX_KM, stations }, null, 2));
  return stations;
};

// ── Μοντέλο: ωριαίο, δύο κελιά, στις συντεταγμένες του σταθμού ─────────────────────────────
const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`];
};
const fetchModel = async (st, ym, cell) => {
  const f = path.join(CACHE_DIR, `model-${st.id}-${ym}-${cell}-${st.lat.toFixed(4)}_${st.lon.toFixed(4)}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const [start, end] = monthRange(ym);
  const url = (API_KEY ? 'https://customer-historical-forecast-api.open-meteo.com' : 'https://historical-forecast-api.open-meteo.com')
    + `/v1/forecast?latitude=${st.lat.toFixed(4)}&longitude=${st.lon.toFixed(4)}`
    + '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=Europe%2FAthens'
    + `&start_date=${start}&end_date=${end}&cell_selection=${cell}` + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : '');
  const json = await fetchJson(url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(json));
  return json;
};

const dailyFromHourly = (json, elevation) => {
  const out = new Map(); // date → { raw:[], prod:[], gust:[], u:[], v:[] }
  const { time, wind_speed_10m: ws, wind_gusts_10m: wg, wind_direction_10m: wd } = json.hourly || {};
  if (!time) return out;
  for (let h = 0; h < time.length; h++) {
    const d = time[h].slice(0, 10);
    const raw = ws?.[h]; if (!Number.isFinite(raw)) continue;
    const gust = Number.isFinite(wg?.[h]) ? wg[h] : null;
    const rec = out.get(d) || { raw: [], prod: [], gust: [], u: [], v: [] };
    rec.raw.push(raw);
    rec.prod.push(applyGustFloor(raw, gust, elevation, 'kmh'));
    if (gust !== null) rec.gust.push(gust);
    if (Number.isFinite(wd?.[h])) { rec.u.push(-Math.sin(wd[h] * Math.PI / 180) * raw); rec.v.push(-Math.cos(wd[h] * Math.PI / 180) * raw); }
    out.set(d, rec);
  }
  for (const rec of out.values()) {
    rec.rawMean = mean(rec.raw); rec.prodMean = mean(rec.prod); rec.gustMax = rec.gust.length ? Math.max(...rec.gust) : null;
    const u = mean(rec.u), v = mean(rec.v);
    rec.domDirDeg = (u === null || v === null) ? null : ((Math.atan2(-u, -v) * 180 / Math.PI) + 360) % 360;
  }
  return out;
};

const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const incidenceOf = (windFromDeg, coastFacingDeg) => {
  if (!Number.isFinite(windFromDeg) || !Number.isFinite(coastFacingDeg)) return null;
  const d = angDiff(windFromDeg, coastFacingDeg);            // 0 = έρχεται από την ανοιχτή θάλασσα
  if (d <= ONSHORE_HALF_WINDOW_DEG) return 'onshore';
  if (d >= 180 - ONSHORE_HALF_WINDOW_DEG) return 'offshore';
  return 'cross';
};

// ── Εκτέλεση ───────────────────────────────────────────────────────────────────────────────
const geometry = await buildGeometry();
const rows = [];
for (const st of stationsInPlay) {
  for (const { parsed } of files.filter(f => f.station.id === st.id)) {
    if (!parsed.month) continue;
    process.stderr.write(`· ${st.name} ${parsed.month}: μοντέλο…`);
    const land = await fetchModel(st, parsed.month, 'land');
    const sea = await fetchModel(st, parsed.month, 'sea');
    const landDays = dailyFromHourly(land, land.elevation);
    const seaDays = dailyFromHourly(sea, sea.elevation ?? 0);
    let n = 0;
    for (const r of parsed.rows) {
      if (!r.date || r.avgWindKmh === null) continue;
      const L = landDays.get(r.date), S = seaDays.get(r.date);
      if (!L || !S) continue;
      const rel = Number.isFinite(r.domDirDeg) && geometry[st.id] ? upwindRelief(geometry[st.id], r.domDirDeg, RADIUS_KM, WINDOW_DEG) : null;
      rows.push({
        station: st.id, name: st.name, date: r.date,
        obsAvg: r.avgWindKmh, obsHigh: r.highWindKmh, obsDirDeg: r.domDirDeg,
        landRaw: L.rawMean, landProd: L.prodMean, seaRaw: S.rawMean, seaProd: S.prodMean, landGustMax: L.gustMax,
        landDistKm: Math.hypot((land.latitude - st.lat) * 111.32, (land.longitude - st.lon) * 111.32 * Math.cos(st.lat * Math.PI / 180)),
        reliefM: rel ? rel.meanM : null,
        shelter: rel ? (rel.meanM >= LEE_MIN_RELIEF_M ? 'lee' : rel.meanM < OPEN_MAX_RELIEF_M ? 'open' : 'mid') : null,
        incidence: incidenceOf(r.domDirDeg, st.coastFacingDeg),
      });
      n += 1;
    }
    process.stderr.write(` ${n} μέρες\n`);
  }
}
if (!rows.length) { console.error('καμία ημέρα με όργανο ΚΑΙ μοντέλο'); process.exit(1); }

const LEGS = ['landRaw', 'landProd', 'seaRaw', 'seaProd'];
const judge = (set) => {
  const n = set.length;
  const o = { n };
  for (const leg of LEGS) {
    const err = set.map(r => r[leg] - r.obsAvg);
    o[leg] = {
      bias: round(mean(err)), mae: round(mean(err.map(Math.abs))),
      exactBftPct: pct(set.filter(r => getBeaufortLevel(r[leg]) === getBeaufortLevel(r.obsAvg)).length, n),
      overPrintPct: pct(set.filter(r => getBeaufortLevel(r[leg]) > getBeaufortLevel(r.obsAvg)).length, n),
      tooLowPct: pct(set.filter(r => getBeaufortLevel(r[leg]) < getBeaufortLevel(r.obsAvg)).length, n),
    };
  }
  // Ο κανόνας του §Γ51: η θάλασσα (παραγωγή) κερδίζει μόνο με ΚΑΙ μικρότερο MAE ΚΑΙ περισσότερα σωστά Μπφ.
  o.seaProdWins = o.seaProd.mae < o.landProd.mae && o.seaProd.exactBftPct > o.landProd.exactBftPct;
  return o;
};

const perStation = {};
const leeContrasts = [];
for (const st of stationsInPlay) {
  const mine = rows.filter(r => r.station === st.id);
  const byShelter = Object.fromEntries(['lee', 'mid', 'open'].map(k => [k, mine.filter(r => r.shelter === k)]));
  const byIncidence = Object.fromEntries(['onshore', 'cross', 'offshore'].map(k => [k, mine.filter(r => r.incidence === k)]));
  const entry = {
    name: st.name, coords: { lat: st.lat, lon: st.lon, source: st.source }, coastFacingDeg: st.coastFacingDeg,
    landCellDistKm: round(mine[0]?.landDistKm), days: mine.length,
    all: judge(mine),
    byShelter: Object.fromEntries(Object.entries(byShelter).filter(([, v]) => v.length).map(([k, v]) => [k, judge(v)])),
    byIncidence: Object.fromEntries(Object.entries(byIncidence).filter(([, v]) => v.length).map(([k, v]) => [k, judge(v)])),
  };
  if (byShelter.lee.length >= MIN_DAYS_PER_CLASS && byShelter.open.length >= MIN_DAYS_PER_CLASS) {
    const contrast = entry.byShelter.lee.landProd.bias - entry.byShelter.open.landProd.bias;
    entry.leeContrastKmh = round(contrast);
    leeContrasts.push({ station: st.id, contrast, leeDays: byShelter.lee.length, openDays: byShelter.open.length });
  }
  perStation[st.id] = entry;
}
const positive = leeContrasts.filter(c => c.contrast >= 2).length;
const leeVerdict = leeContrasts.length === 0
  ? 'ΔΕΝ ΚΡΙΝΕΤΑΙ: κανένας σταθμός δεν έχει ≥10 υπήνεμες ΚΑΙ ≥10 ανοιχτές μέρες.'
  : positive * 3 >= leeContrasts.length * 2
    ? `ΥΠΕΡΤΥΠΩΝΕΙ ΣΕ ΥΠΗΝΕΜΟΥΣ: ${positive}/${leeContrasts.length} σταθμοί με αντίθεση ≥ +2 χλμ/ώ εντός σταθμού.`
    : `ΔΕΝ ΑΠΟΔΕΙΧΘΗΚΕ: μόνο ${positive}/${leeContrasts.length} σταθμοί με αντίθεση ≥ +2 χλμ/ώ (χρειάζονται ≥2/3).`;
const seaWinsWhere = [];
for (const [id, e] of Object.entries(perStation)) {
  for (const [k, v] of Object.entries(e.byIncidence)) if (v.n >= MIN_DAYS_PER_CLASS && v.seaProdWins) seaWinsWhere.push(`${id}/${k}`);
}

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Στους σταθμούς των χωριών (ΝΟΑ/meteo.gr, ημερήσια): (i) υπερτυπώνει το μοντέλο τον άνεμο τις υπήνεμες μέρες; (ii) ποιο σκέλος — στεριανό/θαλασσινό κελί, ωμό/παραγωγή — είναι πιο κοντά στο όργανο, και αλλάζει με onshore/cross/offshore;',
  origin: 'handover §15/§16 (24/08/2026) + Ψιλή Άμμος Νάξου #2017 (25/08/2026)',
  winRule: {
    lee: 'bias(lee) − bias(open) ≥ +2 χλμ/ώ ΕΝΤΟΣ σταθμού σε ≥2/3 των σταθμών με ≥10 μέρες σε κάθε κλάση — γραμμένο πριν τρέξει.',
    sea: 'ΚΑΙ μικρότερο MAE ΚΑΙ περισσότερα σωστά ημερήσια Μπφ από την παραγωγή στεριάς (§Γ51) — γραμμένο πριν τρέξει.',
  },
  settings: { radiusKm: RADIUS_KM, windowDeg: WINDOW_DEG, leeMinReliefM: LEE_MIN_RELIEF_M, openMaxReliefM: OPEN_MAX_RELIEF_M, onshoreHalfWindowDeg: ONSHORE_HALF_WINDOW_DEG, minDaysPerClass: MIN_DAYS_PER_CLASS, demSource: sampler.demSource },
  stations: stationsInPlay.map(s => ({ id: s.id, name: s.name, lat: s.lat, lon: s.lon, coordsSource: s.source, coastFacingDeg: s.coastFacingDeg })),
  months: [...new Set(files.map(f => f.parsed.month))].sort(),
  days: rows.length,
  perStation,
  verdict: { lee: leeVerdict, sea: seaWinsWhere.length ? `Η θαλάσσια παραγωγή κερδίζει σε: ${seaWinsWhere.join(', ')}` : 'Η θαλάσσια παραγωγή δεν κερδίζει κανέναν σταθμό/διαχωρισμό με ≥10 μέρες.' },
  limits: [
    'Ημερήσια ανάλυση: ο μέσος της ημέρας κρύβει τη μεσημεριανή κορύφωση που βλέπει ο λουόμενος.',
    'Ανεμόμετρα Davis σε άγνωστο ύψος/θέση — όχι το πρότυπο 10 μ. των METAR· η απόλυτη μεροληψία ανά σταθμό δεν συγκρίνεται μεταξύ σταθμών, μόνο ΕΝΤΟΣ σταθμού.',
    'Αρχείο προγνώσεων Open-Meteo (historical-forecast), όχι ανάλυση.',
    'Λίγοι σταθμοί, καλοκαίρι μόνο· συντεταγμένες από την κεφαλίδα του txt όπου υπάρχει, αλλιώς προσωρινές.',
    `Πηγή DEM: ${sampler.demSource} — κανένα DEM δεν βλέπει δέντρα, κτίρια ή λεπτή τραχύτητα (Βάι, §15).`,
  ],
};
const outPath = path.join(root, 'reports', 'weather', `meteosearch-wind-bias-${new Date().toISOString().slice(0, 10)}.json`);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nΜΕΡΕΣ με όργανο και μοντέλο: ${rows.length} · σταθμοί: ${stationsInPlay.length} · μήνες: ${report.months.join(', ')}\n`);
const line = (label, j) => console.log(`  ${label.padEnd(10)} n=${String(j.n).padEnd(4)} ` + LEGS.map(l => `${l} MAE ${String(j[l].mae).padEnd(5)} σωστά ${String(j[l].exactBftPct + '%').padEnd(6)}`).join(' | ') + (j.seaProdWins ? ' ★ ΘΑΛΑΣΣΑ' : ''));
for (const [id, e] of Object.entries(perStation)) {
  console.log(`${e.name} (${id}) · ${e.days} μέρες · στεριανό κελί ${e.landCellDistKm} χλμ · συντεταγμένες: ${e.coords.source}`);
  line('όλες', e.all);
  for (const [k, v] of Object.entries(e.byShelter)) line(k, v);
  for (const [k, v] of Object.entries(e.byIncidence)) line(k, v);
  if (e.leeContrastKmh !== undefined) console.log(`  αντίθεση υπήνεμη−ανοιχτή (παραγωγή στεριάς): ${e.leeContrastKmh} χλμ/ώ`);
}
console.log(`\nΠΟΡΙΣΜΑ (i) υπήνεμο: ${leeVerdict}`);
console.log(`ΠΟΡΙΣΜΑ (ii) θάλασσα: ${report.verdict.sea}`);
console.log(`→ ${path.relative(root, outPath)}\n`);
