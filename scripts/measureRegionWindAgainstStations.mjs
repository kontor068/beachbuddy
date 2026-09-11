#!/usr/bin/env node
/**
 * ΤΟ ΣΗΜΕΙΟ ΤΗΣ ΠΕΡΙΟΧΗΣ ΑΠΕΝΑΝΤΙ ΣΤΟ ΟΡΓΑΝΟ — ΚΑΙ ΠΟΙΟ ΣΗΜΕΙΟ ΘΑ ΕΠΡΕΠΕ ΝΑ ΕΙΝΑΙ.
 *
 * Ο άνεμος κάθε παραλίας είναι ο άνεμος ΕΝΟΣ σημείου ανά περιοχή (`hooks/useWeather.ts`:
 * `selectedIsland.coordinates`, από το `public/data/beaches/index.json` — το κέντρο βάρους των
 * παραλιών, που σε στρογγυλό νησί πέφτει στα βουνά: 36 περιοχές >200 μ., Αχαΐα 1.677 μ.). Όλοι οι ως
 * τώρα κριτές ζητούσαν το μοντέλο ΣΤΙΣ ΣΥΝΤΕΤΑΓΜΕΝΕΣ ΤΟΥ ΣΤΑΘΜΟΥ — έκριναν την πρόγνωση, όχι αυτό
 * που τυπώνουμε. Πρώτο τρέξιμο 11/09/2026: σελίδα −2,3 χλμ/ώ, σταθμός −0,6 (docs 06 §11/09).
 *
 * ΥΠΟΨΗΦΙΑ ΣΗΜΕΙΑ, όλα ανεξάρτητα από τον κριτή (κανένα δεν «ξέρει» πού είναι το αεροδρόμιο):
 *   · centroid — ό,τι τρέχει σήμερα
 *   · medoid   — η «κεντρική παραλία»: η πινέζα με το μικρότερο άθροισμα αποστάσεων από τις
 *                υπόλοιπες της περιοχής. Πάντα στην ακτή, πάντα αντιπροσωπευτική της κατανομής.
 *   · nearest  — η παραλία πιο κοντά στο κέντρο βάρους. ΕΛΕΓΧΟΣ ΕΥΑΙΣΘΗΣΙΑΣ, ΟΧΙ ΥΠΟΨΗΦΙΟ.
 * Και «station» — το μοντέλο πάνω στο ίδιο το όργανο: το ταβάνι, όχι επιλογή (δεν υπάρχει όργανο
 * στις 86 από τις 110 περιοχές).
 *
 * ΚΡΙΤΗΡΙΟ, ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΟ ΤΡΕΞΙΜΟ (11/09/2026). Το medoid κερδίζει ΜΟΝΟ αν, στο ΔΙΚΑΙΟ υποσύνολο
 * — περιοχές όπου το medoid ΔΕΝ πλησιάζει το αεροδρόμιο πάνω από FAIR_APPROACH_KM σε σχέση με το
 * κέντρο βάρους — και στα ΔΥΟ καλοκαίρια: λάθος ↓, σωστό Μποφόρ ↑, χρώμα πιο ήρεμο ↓. Χωρίς αυτό το
 * υποσύνολο ένα σημείο που απλώς πήγε δίπλα στον κριτή θα «κέρδιζε» τυχαία. Το τίμημα (χρώμα πιο
 * αυστηρό) αναφέρεται πάντα δίπλα. Το nearest δεν διαλέγεται εκ των υστέρων όποιο κι αν βγει.
 *
 * ΕΘΝΙΚΟ ΜΕΓΕΘΟΣ (`--national`): 110/110 περιοχές, centroid έναντι medoid, 02/07-01/09/2026, χωρίς
 * κριτή — πόσες ώρες-παραλίες αλλάζουν Μποφόρ/χρώμα και προς τα πού.
 *
 * ΟΡΙΑ: το αεροδρόμιο δεν είναι παραλία· ένας κριτής ανά περιοχή· μετριέται μόνο η ΤΑΧΥΤΗΤΑ (η
 * διεύθυνση έρχεται από το κελί θάλασσας για 1.845 παραλίες, §Γ42). ΔΕΝ αλλάζει τίποτα.
 * Γράφει reports/weather/region-wind-vs-stations-<ημερομηνία>.json (+ region-wind-point-national-*.json).
 *   OPEN_METEO_API_KEY= node scripts/measureRegionWindAgainstStations.mjs [--national]
 * (Κενό κλειδί = δωρεάν πόρτα του αρχείου προγνώσεων.)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
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

const NATIONAL = process.argv.includes('--national');
const SUMMERS = [['2025', '2025-06-01', '2025-09-10'], ['2026', '2026-06-01', '2026-09-10']];
const NATIONAL_WINDOW = ['2026-07-02', '2026-09-01'];
const MAX_PAIR_KM = 25;
const FAIR_APPROACH_KM = 2;
const LOCAL_OFFSET_H = 3;
const BEACH_HOURS = [8, 20]; // ίδιο τέλος με BEACH_DAY_ENDS_HOUR
const DAY_MS = 86_400_000;
const CANDIDATES = ['centroid', 'medoid', 'nearest'];
// `medoidLand` ΠΡΟΣΤΕΘΗΚΕ ΜΕΤΑ ΤΟ ΠΡΩΤΟ ΤΡΕΞΙΜΟ (11/09/2026) — ΕΙΝΑΙ ΕΚ ΤΩΝ ΥΣΤΕΡΩΝ, ΟΧΙ ΥΠΟΨΗΦΙΟ ΤΟΥ
// ΚΡΙΤΗΡΙΟΥ. Το medoid έχασε, με μεροληψία ~2,5 χλμ/ώ κάτω από τον «σταθμό» — όσο ακριβώς το +2,4 της
// αποσυμπίεσης. Η πινέζα παραλίας κάθεται σε DEM 0, άρα το applyGustFloor τη στέλνει στη ΘΑΛΑΣΣΙΑ πόρτα
// (χωρίς +2,4), ενώ το κελί που απαντά είναι χερσαίο (`cell_selection=land`) με όλη τη συμπίεση.
// Ίδια λήψη, μόνο η πόρτα αναγκασμένη στη στεριά — για να φανεί αν φταίει το σημείο ή ο κανόνας.
const SERIES = [...CANDIDATES, 'medoidLand', 'station'];
const LABEL = { centroid: 'κέντρο βάρους (σήμερα)', medoid: 'κεντρική παραλία', nearest: 'παραλία πιο κοντά στο κέντρο', medoidLand: 'κεντρ. παραλία, πόρτα στεριάς*', station: 'μοντέλο ΣΤΟ όργανο (ταβάνι)' };

const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : null);
const round = (n, p = 1) => (Number.isFinite(n) ? Math.round(n * 10 ** p) / 10 ** p : null);
const bft = v => getBeaufortLevel(v);
const km = (a, b) => {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const TONE_EXPOSURES = ['protected', 'partial', 'exposed'];
const toneRank = new Map();
const toneOf = (exposureLevel, kmh) => {
  const key = `${exposureLevel}|${bft(kmh)}`;
  if (!toneRank.has(key)) {
    toneRank.set(key, LEGEND_TONE_ORDER.indexOf(resolveConditionTone({
      exposureLevel, beaufort: bft(kmh), isEnclosedCove: false, seaStateM: undefined,
    })));
  }
  return toneRank.get(key);
};

// ── Περιοχές και υποψήφια σημεία ──────────────────────────────────────────────────────────
const regions = JSON.parse(fs.readFileSync(path.join(root, 'public/data/beaches/index.json'), 'utf8')).regions;
const beachPoints = r => {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'public', r.dataPath), 'utf8'));
  const list = Array.isArray(d) ? d : (d.beaches || Object.values(d));
  return list.filter(b => Number.isFinite(b?.lat) && Number.isFinite(b?.lon)).map(b => [b.lat, b.lon]);
};
const medoidOf = pts => {
  let best = pts[0], bestSum = Infinity;
  for (const a of pts) { let s = 0; for (const b of pts) s += km(a, b); if (s < bestSum) { bestSum = s; best = a; } }
  return best;
};
const allRegions = regions.map(r => {
  const pts = beachPoints(r);
  const centroid = [r.coordinates.lat, r.coordinates.lon];
  return {
    regionId: r.id, regionName: r.name?.gr ?? r.id, beaches: r.beachCount,
    points: {
      centroid,
      medoid: medoidOf(pts),
      nearest: pts.reduce((best, p) => (km(p, centroid) < km(best, centroid) ? p : best), pts[0]),
    },
  };
});

// ── Λήψεις (μνήμη δίσκου κοινή με το measureWindDiurnalTiming) ────────────────────────────
const CACHE = path.join(root, 'node_modules/.cache/wind-diurnal');
fs.mkdirSync(CACHE, { recursive: true });
const cached = async (name, load) => {
  const file = path.join(CACHE, name);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const value = await load();
  fs.writeFileSync(file, JSON.stringify(value));
  return value;
};
const fetchJson = async (url, tries = 6) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 160)}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      // Η δωρεάν πόρτα φρενάρει με 403 όταν τη φορτώσεις και περνάει ξανά σε λίγο.
      await new Promise(r => setTimeout(r, 10000 * (i + 1)));
    }
  }
};
const API_KEY = process.env.OPEN_METEO_API_KEY?.trim() || null;
const MODEL_HOST = API_KEY
  ? 'https://customer-historical-forecast-api.open-meteo.com'
  : 'https://historical-forecast-api.open-meteo.com';
// Δέσμες των 5 με παύση: η δωρεάν πόρτα γύρισε 403 σε 36 και 20 σημεία μετά από μεγάλη σάρωση.
const MODEL_BATCH = 5;
const fetchModel = async (points, s, e) => {
  const out = [];
  for (let i = 0; i < points.length; i += MODEL_BATCH) {
    const batch = points.slice(i, i + MODEL_BATCH);
    const meteo = await fetchJson(`${MODEL_HOST}/v1/forecast?latitude=${batch.map(x => x[0].toFixed(5)).join(',')}`
      + `&longitude=${batch.map(x => x[1].toFixed(5)).join(',')}`
      + `&hourly=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=UTC&start_date=${s}&end_date=${e}`
      + (API_KEY ? `&apikey=${encodeURIComponent(API_KEY)}` : ''));
    for (const m of (Array.isArray(meteo) ? meteo : [meteo])) {
      out.push({ elevation: m.elevation, time: m.hourly?.time ?? [], ws: m.hourly?.wind_speed_10m ?? [], wg: m.hourly?.wind_gusts_10m ?? [] });
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return out;
};
const pointsKey = pts => crypto.createHash('sha1').update(pts.map(p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|')).digest('hex').slice(0, 12);
const modelFor = (pts, s, e) => cached(`pts-model-${s}-${e}-${pointsKey(pts)}.json`, () => fetchModel(pts, s, e));
const monthChunks = (start, end) => {
  const out = [];
  let s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  while (s <= e) { const ce = Math.min(e, s + 30 * DAY_MS); out.push([new Date(s).toISOString().slice(0, 10), new Date(ce).toISOString().slice(0, 10)]); s = ce + DAY_MS; }
  return out;
};
const localHourOf = t => (Number(t.slice(11, 13)) + LOCAL_OFFSET_H) % 24;
const isBeachHour = t => { const h = localHourOf(t); return h >= BEACH_HOURS[0] && h <= BEACH_HOURS[1]; };
const shown = (m, h) => applyGustFloor(m.ws[h], Number.isFinite(m.wg[h]) ? m.wg[h] : null, m.elevation);

// ── Σκορ ─────────────────────────────────────────────────────────────────────────────────
const score = (list, field) => {
  let sum = 0, abs = 0, exact = 0, under = 0, over = 0, toneN = 0, calmer = 0, harsher = 0;
  for (const r of list) {
    const v = r[field];
    const d = v - r.obs;
    sum += d; abs += Math.abs(d);
    const bs = bft(v), bo = bft(r.obs);
    if (bs === bo) exact++; else if (bs < bo) under++; else over++;
    for (const ex of TONE_EXPOSURES) {
      const s = toneOf(ex, v), t = toneOf(ex, r.obs);
      toneN++;
      if (s < t) calmer++; else if (s > t) harsher++;
    }
  }
  const n = list.length;
  return {
    n, biasKmh: round(sum / n), maeKmh: round(abs / n), bftExactPct: pct(exact, n),
    underPct: pct(under, n), overPct: pct(over, n), toneCalmerPct: pct(calmer, toneN), toneHarsherPct: pct(harsher, toneN),
  };
};
const f = (v, w = 6) => String(v ?? '—').padStart(w);

if (!NATIONAL) {
  // ── Κρίση με όργανο: περιοχές με αεροδρόμιο ≤ MAX_PAIR_KM από το σημερινό σημείο ─────────
  const pairs = [];
  for (const r of allRegions) {
    let best = null;
    for (const [icao, name, lat, lon] of STATIONS) {
      const d = km(r.points.centroid, [lat, lon]);
      if (!best || d < best.km) best = { icao, name, km: d, lat, lon };
    }
    if (best && best.km <= MAX_PAIR_KM) {
      const at = [best.lat, best.lon];
      pairs.push({ ...r, station: best, kmToStation: Object.fromEntries(CANDIDATES.map(c => [c, km(r.points[c], at)])) });
    }
  }
  process.stderr.write(`${pairs.length}/${regions.length} περιοχές με αεροδρόμιο ≤ ${MAX_PAIR_KM} χλμ\n`);

  const rows = [];
  const elevation = {};
  for (const [summer, start, end] of SUMMERS) {
    for (const [s, e] of monthChunks(start, end)) {
      process.stderr.write(`· ${s} → ${e}…`);
      const observed = new Map(await cached(`obs-${s}-${e}.json`, async () =>
        [...(await fetchStationHours(Date.parse(`${s}T00:00:00Z`), Date.parse(`${e}T23:00:00Z`)))]));
      const models = {};
      for (const c of CANDIDATES) models[c] = await modelFor(pairs.map(p => p.points[c]), s, e);
      // Ίδιο αρχείο με το measureWindDiurnalTiming (ίδια σημεία, ίδια σειρά STATIONS, ίδιο μοντέλο).
      const stationModel = await cached(`model-${s}-${e}.json`, () => fetchModel(STATIONS.map(x => [x[2], x[3]]), s, e));
      let n = 0;
      pairs.forEach((p, i) => {
        const sm = stationModel[STATIONS.findIndex(x => x[0] === p.station.icao)];
        if (!sm || CANDIDATES.some(c => !models[c][i])) return;
        elevation[p.regionId] = { ...Object.fromEntries(CANDIDATES.map(c => [c, models[c][i].elevation])), station: sm.elevation };
        const idx = CANDIDATES.map(c => new Map(models[c][i].time.map((t, h) => [t, h])));
        for (let h = 0; h < sm.time.length; h++) {
          const t = sm.time[h];
          if (!isBeachHour(t)) continue;
          const obs = observed.get(`${p.station.icao}|${t.slice(0, 13)}`);
          if (!obs || !Number.isFinite(sm.ws[h])) continue;
          const row = { regionId: p.regionId, summer, obs: obs.kmh, station: shown(sm, h) };
          let ok = true;
          CANDIDATES.forEach((c, ci) => {
            const ch = idx[ci].get(t);
            const m = models[c][i];
            if (ch === undefined || !Number.isFinite(m.ws[ch])) { ok = false; return; }
            row[c] = shown(m, ch);
            if (c === 'medoid') {
              row.medoidLand = applyGustFloor(m.ws[ch], Number.isFinite(m.wg[ch]) ? m.wg[ch] : null, Math.max(1, m.elevation ?? 1));
            }
          });
          if (ok) { rows.push(row); n++; }
        }
      });
      process.stderr.write(` ${n} ζευγάρια\n`);
    }
  }

  const judged = pairs.filter(p => rows.filter(r => r.regionId === p.regionId).length >= 500);
  const judgedIds = new Set(judged.map(p => p.regionId));
  const fairIds = new Set(judged.filter(p => p.kmToStation.medoid >= p.kmToStation.centroid - FAIR_APPROACH_KM).map(p => p.regionId));
  const subsets = {
    'όλες': r => judgedIds.has(r.regionId),
    'δίκαιο (medoid δεν πλησιάζει τον κριτή)': r => fairIds.has(r.regionId),
  };
  const report = {
    generatedAt: new Date().toISOString(),
    judge: 'METAR ASOS (Iowa State)', model: `${MODEL_HOST.replace('https://', '')} best_match`,
    hours: BEACH_HOURS, maxPairKm: MAX_PAIR_KM, fairApproachKm: FAIR_APPROACH_KM, summers: SUMMERS, labels: LABEL,
    criterion: 'medoid κερδίζει μόνο αν στο δίκαιο υποσύνολο και στα δύο καλοκαίρια: λάθος ↓, σωστό Μπφ ↑, χρώμα πιο ήρεμο ↓',
    subsets: {}, regions: [],
  };
  for (const [name, test] of Object.entries(subsets)) {
    report.subsets[name] = { regions: judged.filter(p => test({ regionId: p.regionId })).length, beaches: judged.filter(p => test({ regionId: p.regionId })).reduce((s, p) => s + p.beaches, 0) };
    for (const [y] of [...SUMMERS, ['όλα']]) {
      const list = rows.filter(r => test(r) && (y === 'όλα' || r.summer === y));
      report.subsets[name][y] = Object.fromEntries(SERIES.map(c => [c, score(list, c)]));
    }
  }
  const verdictFor = name => SUMMERS.every(([y]) => {
    const s = report.subsets[name][y];
    return s.medoid.maeKmh < s.centroid.maeKmh && s.medoid.bftExactPct > s.centroid.bftExactPct && s.medoid.toneCalmerPct < s.centroid.toneCalmerPct;
  });
  report.medoidWinsFair = verdictFor('δίκαιο (medoid δεν πλησιάζει τον κριτή)');
  report.medoidWinsAll = verdictFor('όλες');
  for (const p of judged) {
    const list = rows.filter(r => r.regionId === p.regionId);
    report.regions.push({
      regionId: p.regionId, regionName: p.regionName, beaches: p.beaches, station: p.station.icao, fair: fairIds.has(p.regionId),
      kmToStation: Object.fromEntries(Object.entries(p.kmToStation).map(([k, v]) => [k, round(v)])),
      elevationM: elevation[p.regionId],
      scores: Object.fromEntries(SERIES.map(c => [c, score(list, c)])),
    });
  }
  report.regions.sort((a, b) => (a.scores.medoid.maeKmh - a.scores.centroid.maeKmh) - (b.scores.medoid.maeKmh - b.scores.centroid.maeKmh));
  const outFile = path.join(root, `reports/weather/region-wind-vs-stations-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(report, null, 2)}\n`);

  for (const [name, sub] of Object.entries(report.subsets)) {
    console.log(`\n=== ${name}: ${sub.regions} περιοχές, ${sub.beaches} παραλίες — ώρες ${BEACH_HOURS.join('-')} ===`);
    console.log('  καλοκ. σημείο                          bias  λάθος  σωστό Μπφ  χαμηλά%  ψηλά%  χρώμα ηρεμότ% / αυστηρ%');
    for (const [y] of [...SUMMERS, ['όλα']]) {
      for (const c of SERIES) {
        const s = sub[y][c];
        console.log(`  ${y.padEnd(5)} ${LABEL[c].padEnd(30)} ${f(s.biasKmh)} ${f(s.maeKmh)} ${f(s.bftExactPct, 9)} ${f(s.underPct, 8)} ${f(s.overPct, 6)} ${f(s.toneCalmerPct, 12)} / ${f(s.toneHarsherPct, 5)}`);
      }
    }
  }
  console.log(`\nΚΡΙΤΗΡΙΟ (γραμμένο πριν): medoid κερδίζει στο δίκαιο υποσύνολο και στα δύο καλοκαίρια → ${report.medoidWinsFair ? 'ΝΑΙ' : 'ΟΧΙ'} (σε όλες: ${report.medoidWinsAll ? 'ναι' : 'όχι'})`);
  console.log('  * = εκ των υστέρων, όχι μέρος του κριτηρίου');
  console.log('\n  περιοχή                    παραλ. όργανο  δίκ. | χλμ ως όργανο κ.β.→κεντρ. | ύψος κ.β.→κεντρ. | λάθος κ.β.→κεντρ.→κεντρ.* | bias κ.β.→κεντρ.→κεντρ.*');
  for (const r of report.regions) {
    const S = r.scores;
    console.log(`  ${String(r.regionName).slice(0, 26).padEnd(26)} ${f(r.beaches, 5)} ${r.station.padEnd(5)} ${r.fair ? '  ναι' : '   — '} | ${f(r.kmToStation.centroid, 7)} → ${f(r.kmToStation.medoid, 5)}      | ${f(round(r.elevationM?.centroid, 0), 5)} → ${f(round(r.elevationM?.medoid, 0), 4)}  | ${f(S.centroid.maeKmh, 5)} → ${f(S.medoid.maeKmh, 5)} → ${f(S.medoidLand.maeKmh, 5)}   | ${f(S.centroid.biasKmh, 5)} → ${f(S.medoid.biasKmh, 5)} → ${f(S.medoidLand.biasKmh, 5)}`);
  }
  console.log(`\n→ ${path.relative(root, outFile)}`);
} else {
  // ── Εθνικό μέγεθος: 110/110, κέντρο βάρους έναντι κεντρικής παραλίας, χωρίς κριτή ─────────
  const perRegion = allRegions.map(r => ({ regionId: r.regionId, regionName: r.regionName, beaches: r.beaches, hours: 0, bftDiff: 0, medoidHigher: 0, medoidLower: 0, sumDiff: 0, toneN: 0, toneStricter: 0, toneCalmer: 0, elevation: {} }));
  for (const [s, e] of monthChunks(...NATIONAL_WINDOW)) {
    process.stderr.write(`· ${s} → ${e}…`);
    const cm = await modelFor(allRegions.map(r => r.points.centroid), s, e);
    const mm = await modelFor(allRegions.map(r => r.points.medoid), s, e);
    allRegions.forEach((r, i) => {
      const a = cm[i], b = mm[i], acc = perRegion[i];
      if (!a || !b) return;
      acc.elevation = { centroid: a.elevation, medoid: b.elevation };
      const bIdx = new Map(b.time.map((t, h) => [t, h]));
      for (let h = 0; h < a.time.length; h++) {
        const t = a.time[h];
        const bh = bIdx.get(t);
        if (!isBeachHour(t) || bh === undefined || !Number.isFinite(a.ws[h]) || !Number.isFinite(b.ws[bh])) continue;
        const va = shown(a, h), vb = shown(b, bh);
        acc.hours++; acc.sumDiff += vb - va;
        if (bft(va) !== bft(vb)) { acc.bftDiff++; if (bft(vb) > bft(va)) acc.medoidHigher++; else acc.medoidLower++; }
        for (const ex of TONE_EXPOSURES) {
          const ta = toneOf(ex, va), tb = toneOf(ex, vb);
          acc.toneN++;
          if (tb > ta) acc.toneStricter++; else if (tb < ta) acc.toneCalmer++;
        }
      }
    });
    process.stderr.write(' ok\n');
  }
  const w = (key) => perRegion.reduce((s, r) => s + (r.hours ? r[key] / r.hours : 0) * r.beaches, 0) / perRegion.reduce((s, r) => s + (r.hours ? r.beaches : 0), 0);
  const wTone = (key) => perRegion.reduce((s, r) => s + (r.toneN ? r[key] / r.toneN : 0) * r.beaches, 0) / perRegion.reduce((s, r) => s + (r.toneN ? r.beaches : 0), 0);
  const summary = {
    window: NATIONAL_WINDOW, regionCount: perRegion.filter(r => r.hours).length,
    beachWeighted: {
      meanDiffKmh: round(w('sumDiff')), bftChangesPct: round(100 * w('bftDiff')),
      medoidHigherPct: round(100 * w('medoidHigher')), medoidLowerPct: round(100 * w('medoidLower')),
      toneStricterPct: round(100 * wTone('toneStricter')), toneCalmerPct: round(100 * wTone('toneCalmer')),
    },
    medoidElevation: {
      at0: perRegion.filter(r => r.elevation.medoid <= 0).length,
      upTo20: perRegion.filter(r => r.elevation.medoid > 0 && r.elevation.medoid <= 20).length,
      over20: perRegion.filter(r => r.elevation.medoid > 20).length,
    },
    regions: perRegion.map(r => ({
      regionId: r.regionId, regionName: r.regionName, beaches: r.beaches, elevation: r.elevation,
      meanDiffKmh: round(r.hours ? r.sumDiff / r.hours : NaN), bftChangesPct: pct(r.bftDiff, r.hours),
      toneStricterPct: pct(r.toneStricter, r.toneN), toneCalmerPct: pct(r.toneCalmer, r.toneN),
    })).sort((a, b) => (b.meanDiffKmh ?? 0) - (a.meanDiffKmh ?? 0)),
  };
  const outFile = path.join(root, `reports/weather/region-wind-point-national-${new Date().toISOString().slice(0, 10)}.json`);
  fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`);
  const B = summary.beachWeighted;
  console.log(`\nΕΘΝΙΚΑ ${summary.window.join(' → ')}, ${summary.regionCount} περιοχές, σταθμισμένο ανά παραλία, ώρες ${BEACH_HOURS.join('-')}:`);
  console.log(`  κεντρική παραλία − κέντρο βάρους: ${B.meanDiffKmh} χλμ/ώ · Μποφόρ αλλάζει ${B.bftChangesPct}% (πάνω ${B.medoidHigherPct}% / κάτω ${B.medoidLowerPct}%) · χρώμα αυστηρότερο ${B.toneStricterPct}% / ηρεμότερο ${B.toneCalmerPct}%`);
  console.log(`  ύψος κεντρικής παραλίας: 0 μ. σε ${summary.medoidElevation.at0} · 1-20 μ. σε ${summary.medoidElevation.upTo20} · >20 μ. σε ${summary.medoidElevation.over20}`);
  console.log('  μεγαλύτερες αλλαγές (+ = περισσότερος αέρας):');
  for (const r of [...summary.regions.slice(0, 8), ...summary.regions.slice(-5)]) {
    console.log(`    ${String(r.regionName).slice(0, 24).padEnd(24)} ${f(r.beaches, 4)} παρ. · ύψος ${f(round(r.elevation.centroid, 0), 5)} → ${f(round(r.elevation.medoid, 0), 3)} μ. · ${f(r.meanDiffKmh, 5)} χλμ/ώ · Μπφ αλλάζει ${f(r.bftChangesPct, 5)}%`);
  }
  console.log(`\n→ ${path.relative(root, outFile)}`);
}
