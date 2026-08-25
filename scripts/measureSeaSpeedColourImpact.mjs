#!/usr/bin/env node
/**
 * ΑΝ Η ΤΑΧΥΤΗΤΑ ΕΡΧΟΤΑΝ ΚΙ ΑΥΤΗ ΑΠΟ ΤΟ ΝΕΡΟ, ΠΟΣΕΣ ΠΙΝΕΖΕΣ ΘΑ ΑΛΛΑΖΑΝ ΧΡΩΜΑ;
 *
 * ΤΟ ΧΡΕΟΣ ΠΟΥ ΠΛΗΡΩΝΕΙ. Το §Γ51 απέδειξε σε 25 ανεμόμετρα και ΔΥΟ ανεξάρτητα παράθυρα ότι η
 * ΤΑΧΥΤΗΤΑ του θαλασσινού κελιού είναι πιο σωστή όταν το στεριανό κάθεται 3-5 χλμ μακριά
 * (σφάλμα 5,12→4,59 και 4,98→4,64· σωστό Μποφόρ 36,5→42,5% και 38,0→40,6%), και ότι στις ώρες
 * που το στεριανό λέει ≤2 Μποφόρ το κέρδος είναι +6,6 ως +8,5 μονάδες. Έγραψε όμως ρητά:
 * «ΔΕΝ ΜΕΤΡΗΘΗΚΕ ΤΟ ΧΡΩΜΑ. Απαγορεύεται γραμμή κώδικα πριν μετρηθεί εθνικά.» Αυτό κάνει αυτό.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ ΜΠΟΦΟΡ. Το §Γ37 για τη ΔΙΕΥΘΥΝΣΗ βρήκε 3.246 πινέζες προς τα σκούρα και
 * 3.808 προς τα ανοιχτά — «διόρθωση ακρίβειας, όχι ασφαλείας». Μια αλλαγή που βελτιώνει το
 * Μποφόρ μπορεί να κουνήσει το χρώμα προς τις δύο μεριές, και το χρώμα είναι το μόνο που βλέπει
 * ο επισκέπτης.
 *
 * ΤΙ ΑΛΛΑΖΕΙ ΚΑΙ ΤΙ ΟΧΙ — Η ΑΠΟΜΟΝΩΣΗ ΕΙΝΑΙ ΤΟ ΠΑΝ.
 *   Α (ως 25/08):  ταχύτητα + ριπή από το ΣΤΕΡΙΑΝΟ κελί · διεύθυνση από το ΘΑΛΑΣΣΙΝΟ (ζωντανό)
 *   Β (υποψήφια):  ταχύτητα + ριπή από το ΘΑΛΑΣΣΙΝΟ κελί · διεύθυνση ΙΔΙΑ με το Α
 * (ΙΣΤΟΡΙΚΟ: το Β μπήκε 25/08/2026 με απόφαση Μίλτου — με τη διαφορά ότι η ΡΙΠΗ έμεινε της
 * στεριάς. Το σάρωμα του ακριβούς κανόνα που φεύγει είναι το scripts/measureSeaSpeedRollout.mjs.)
 * Η διεύθυνση είναι σκόπιμα ίδια και στα δύο σκέλη: το §Γ42 την έχει ήδη στείλει ζωντανά, οπότε
 * ό,τι μετακινηθεί εδώ το χρωστάει ΑΠΟΚΛΕΙΣΤΙΚΑ στην πηγή της ταχύτητας.
 *
 * Η ΠΥΛΗ ΤΩΝ 3 ΧΛΜ. Εφαρμόζεται μόνο όπου το στεριανό κελί απέχει ≥3 χλμ — το ίδιο κατώφλι που
 * ήδη κρίνει τη διεύθυνση (`bakeSeaWindCells.GATE_KM`) και ακριβώς εκεί που το §Γ51 μέτρησε την
 * αλλαγή προσήμου. Κάτω από αυτό η στεριά κερδίζει και δεν την πειράζουμε.
 *
 * ΚΑΙ Ο ΝΕΟΣ ΦΡΑΓΜΟΣ ΚΥΜΑΤΟΣ ΜΕΣΑ. Στο δέντρο εργασίας υπάρχει άβαφτη η αλλαγή «το ιδανική δεν
 * γράφεται πάνω από κύμα ≥0,40 μ.» (`utils/suitabilityTone.capIdealByShoreSea`). Επειδή η
 * ταχύτητα τροφοδοτεί και το μοντελοποιημένο κύμα, οι δύο αλλαγές ΣΤΟΙΒΑΖΟΝΤΑΙ — γι' αυτό ο
 * φραγμός εφαρμόζεται και στα δύο σκέλη εδώ. Χωρίς αυτό η μέτρηση θα απαντούσε σε ερώτημα που
 * δεν ισχύει πια.
 *
 * ΟΡΙΟ ΠΟΥ ΠΡΕΠΕΙ ΝΑ ΔΙΑΒΑΣΤΕΙ ΜΑΖΙ ΜΕ ΤΟ ΝΟΥΜΕΡΟ: το κύμα εδώ είναι το ΜΟΝΤΕΛΟΠΟΙΗΜΕΝΟ (ίδια
 * συνταγή με `windExposureValidation`), όχι το μετρημένο. Στην εφαρμογή δείχνεται
 * max(μετρημένο, μοντελοποιημένο), άρα ο πραγματικός αριθμός μπλε είναι ΜΙΚΡΟΤΕΡΟΣ από εδώ και
 * στα δύο σκέλη. Η ΔΙΑΦΟΡΑ Α→Β μένει έγκυρη, γιατί το μετρημένο σκέλος είναι κοινό.
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει `reports/weather/sea-speed-colour-impact-<ημερομηνία>.json`.
 *
 *   node scripts/measureSeaSpeedColourImpact.mjs [--days=5] [--limit=N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { getVisibleMapExposureLevel } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { degToCompass, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));
const { getWindChopWaveFloorM } = require(path.join(root, 'utils/waveModel.ts'));
const { capIdealByShoreSea } = require(path.join(root, 'utils/suitabilityTone.ts'));

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const DAYS = Number(arg('days', '5'));
const LIMIT = Number(arg('limit', '0'));
const DAY_START = 9;
const DAY_END = 19;
const GATE_KM = 3;
const NEUTRAL_SEA_M = 0.4;
const PACE_MS = Number(arg('pace', '13000'));

const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);
const pct = (n, d) => (d ? Math.round(10000 * n / d) / 100 : 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
};

// ── 1. ΟΙ ΠΑΡΑΛΙΕΣ ───────────────────────────────────────────────────────────
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const bakedCells = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells;

const beaches = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const list = payload.island?.beaches || [];
  if (!list.length) continue;
  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* περιοχή χωρίς γεωμετρία */ }
  for (const beach of list) {
    const lat = beach.coordinates?.lat, lon = beach.coordinates?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const cell = beach.forecastCell || bakedCells[String(beach.id)];
    if (!cell) continue;
    beaches.push({ beach, regionId, lat, lon, cell, profile: profiles[beach.id] });
  }
}
const sample = LIMIT ? beaches.filter((_, i) => i % Math.max(1, Math.floor(beaches.length / LIMIT)) === 0).slice(0, LIMIT) : beaches;
const cellKeys = [...new Set(sample.map(b => b.cell))];
console.log(`Παραλίες: ${sample.length.toLocaleString('el-GR')} · στεριανά κελιά: ${cellKeys.length.toLocaleString('el-GR')} · ${DAYS} ημέρες, ώρες ${DAY_START}-${DAY_END}`);

// ── 2. ΤΑ ΔΥΟ ΣΚΕΛΗ, ΙΔΙΟ ΠΑΡΑΘΥΡΟ ──────────────────────────────────────────
const CHUNK = 100;
const chunks = arr => { const out = []; for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK)); return out; };
const VARS = 'wind_speed_10m,wind_direction_10m,wind_gusts_10m';

const fetchArm = async (points, cellSelection) => {
  const out = [];
  for (const c of chunks(points)) {
    if (out.length) await sleep(PACE_MS);
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}`
      + `&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=${VARS}&forecast_days=${DAYS}&timezone=Europe%2FAthens&wind_speed_unit=kmh`
      + `&cell_selection=${cellSelection}`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`${cellSelection}: ${rows.length} για ${c.length}`);
    out.push(...rows);
    process.stdout.write(`\r  ${cellSelection}: ${out.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  return out;
};

const cacheDir = path.join(root, '.tmp');
fs.mkdirSync(cacheDir, { recursive: true });
const cached = async (name, run) => {
  const f = path.join(cacheDir, `sea-speed-${name}-${DAYS}d-${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(f)) { console.log(`  ${name}: από τον δίσκο`); return JSON.parse(fs.readFileSync(f, 'utf8')); }
  const rows = await run();
  fs.writeFileSync(f, JSON.stringify(rows));
  return rows;
};
const landPoints = cellKeys.map(k => { const [lat, lon] = k.split('_').map(Number); return { lat, lon, key: k }; });
const landRows = await cached('land', () => fetchArm(landPoints, 'land'));
const seaRows = await cached('sea', () => fetchArm(sample, 'sea'));

const landByCell = new Map();
landPoints.forEach((p, i) => {
  const r = landRows[i];
  landByCell.set(p.key, {
    time: r.hourly.time, speed: r.hourly.wind_speed_10m, dir: r.hourly.wind_direction_10m,
    gust: r.hourly.wind_gusts_10m, elevation: r.elevation, lat: r.latitude, lon: r.longitude,
  });
});

// ── 3. Η ΜΕΤΡΗΣΗ ─────────────────────────────────────────────────────────────
const COLOUR_RANK = { blue: 0, yellow: 1, orange: 2, red: 3 };
const rank = c => (COLOUR_RANK[c] ?? 1);
const TONES = ['blue', 'yellow', 'orange', 'red'];

/** Το χρώμα όπως το βγάζει το προϊόν, ΜΕ τον νέο φραγμό κύματος από πάνω. */
const assess = (b, deg, speedKmh, bft, gustKmh, rawMeanKmh) => {
  const a = assessBeachWindExposure({
    beach: b.beach, geospatialProfile: b.profile,
    windDirectionDeg: deg, windDirection: degToCompass(deg),
    windSpeedKmh: speedKmh, beaufort: bft, waveHeightMeters: NEUTRAL_SEA_M,
  });
  const pin = getVisibleMapExposureLevel({
    beach: b.beach, exposureLevel: a.exposureLevel, orientation: a.facingDeg,
    windProfile: a.windProfile, windProfileSource: a.source, windSector: a.windSector,
    warnings: a.warnings, geospatialExposure: b.profile,
  }, bft, deg);
  const damping = a.exposureLevel === 'protected' ? 0.5 : a.exposureLevel === 'partial' ? 0.75 : 1;
  const modelledWaveM = Number(Math.max(
    (a.modeledWaveHeightM || 0) * damping,
    getWindChopWaveFloorM(a.exposureLevel, bft, speedKmh, gustKmh, rawMeanKmh),
  ).toFixed(2));
  const windColour = a.simpleWindSuitability?.suitabilityColor;
  // Ο όρμος εξαιρείται από τον φραγμό στον ίδιο τον κώδικα· εδώ δεν ξέρουμε ποιοι είναι, οπότε
  // ο φραγμός εφαρμόζεται σε όλους — άρα το «χαμένο μπλε» εδώ είναι ΤΑΒΑΝΙ, όχι ακριβής αριθμός.
  const colour = capIdealByShoreSea(windColour, modelledWaveM, false);
  return { card: a.exposureLevel, colour, windColour, pin, sector: a.windSector, modelledWaveM };
};

const blank = () => ({
  hours: 0, colourChanged: 0, colourWorse: 0, colourBetter: 0,
  cardChanged: 0, pinChanged: 0, bftChanged: 0, bftUp: 0,
  toneA: Object.fromEntries(TONES.map(t => [t, 0])),
  toneB: Object.fromEntries(TONES.map(t => [t, 0])),
});
const total = blank();
const gatedOnly = blank();
const BUCKETS = [
  { key: '<3 χλμ', test: d => d < GATE_KM }, { key: '3-5 χλμ', test: d => d >= 3 && d < 5 },
  { key: '5-7 χλμ', test: d => d >= 5 && d < 7 }, { key: '≥7 χλμ', test: d => d >= 7 },
];
const byBucket = Object.fromEntries(BUCKETS.map(b => [b.key, blank()]));
const byBeaufortA = {};
const movers = [];

sample.forEach((b, i) => {
  const land = landByCell.get(b.cell);
  const sea = seaRows[i]?.hourly;
  if (!land || !sea?.time) return;
  const cellDist = distKm(b.lat, b.lon, land.lat, land.lon);
  const bucket = BUCKETS.find(x => x.test(cellDist))?.key;
  const applies = cellDist >= GATE_KM;
  const seaIdx = new Map(sea.time.map((t, k) => [t, k]));
  let changed = 0, hrs = 0;

  for (let h = 0; h < land.time.length; h++) {
    const t = land.time[h];
    const hour = Number(t.slice(11, 13));
    if (hour < DAY_START || hour > DAY_END) continue;
    const k = seaIdx.get(t);
    if (k == null) continue;
    const lRaw = land.speed[h], lGust = land.gust[h], dir = land.dir[h];
    const sRaw = sea.wind_speed_10m[k], sGust = sea.wind_gusts_10m[k];
    if (![lRaw, lGust, dir, sRaw, sGust].every(Number.isFinite)) continue;

    // Α: ταχύτητα στεριάς. Β: ταχύτητα θάλασσας — ΜΟΝΟ αν περνά την πύλη απόστασης.
    const aSpeed = applyGustFloor(lRaw, lGust, land.elevation);
    const bRaw = applies ? sRaw : lRaw;
    const bGust = applies ? sGust : lGust;
    // Το υψόμετρο του θαλασσινού κελιού είναι 0 εξ ορισμού· η δεύτερη πόρτα του δαπέδου
    // (ασυνεπής λόγος ριπής) κρίνει μόνη της, ακριβώς όπως στην παραγωγή.
    const bSpeed = applies ? applyGustFloor(sRaw, sGust, 0) : aSpeed;
    const aBft = getBeaufortLevel(aSpeed), bBft = getBeaufortLevel(bSpeed);
    const A = assess(b, dir, aSpeed, aBft, lGust, lRaw);
    const B = assess(b, dir, bSpeed, bBft, bGust, bRaw);

    const targets = [total, byBucket[bucket]];
    if (applies) targets.push(gatedOnly);
    for (const tg of targets) {
      tg.hours += 1;
      tg.toneA[A.colour] = (tg.toneA[A.colour] ?? 0) + 1;
      tg.toneB[B.colour] = (tg.toneB[B.colour] ?? 0) + 1;
      if (aBft !== bBft) { tg.bftChanged += 1; if (bBft > aBft) tg.bftUp += 1; }
      if (A.card !== B.card) tg.cardChanged += 1;
      if (A.pin !== B.pin) tg.pinChanged += 1;
      if (A.colour !== B.colour) {
        tg.colourChanged += 1;
        if (rank(B.colour) > rank(A.colour)) tg.colourWorse += 1; else tg.colourBetter += 1;
      }
    }
    byBeaufortA[aBft] = byBeaufortA[aBft] || { hours: 0, colourChanged: 0, worse: 0 };
    byBeaufortA[aBft].hours += 1;
    if (A.colour !== B.colour) { byBeaufortA[aBft].colourChanged += 1; if (rank(B.colour) > rank(A.colour)) byBeaufortA[aBft].worse += 1; }
    hrs += 1;
    if (A.colour !== B.colour) changed += 1;
  }
  if (changed) movers.push({
    id: b.beach.id, name: b.beach.name?.gr || b.beach.name?.en || `#${b.beach.id}`,
    region: b.regionId, cellDistKm: Math.round(cellDist * 100) / 100,
    hours: hrs, colourChanged: changed, changedPct: pct(changed, hrs),
  });
});

const shape = g => ({
  hours: g.hours,
  colourChangedPct: pct(g.colourChanged, g.hours),
  worse: g.colourWorse, better: g.colourBetter,
  beaufortChangedPct: pct(g.bftChanged, g.hours), beaufortUp: g.bftUp,
  cardChangedPct: pct(g.cardChanged, g.hours), pinChangedPct: pct(g.pinChanged, g.hours),
  toneBefore: Object.fromEntries(TONES.map(t => [t, `${g.toneA[t]} (${pct(g.toneA[t], g.hours)}%)`])),
  toneAfter: Object.fromEntries(TONES.map(t => [t, `${g.toneB[t]} (${pct(g.toneB[t], g.hours)}%)`])),
});

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Α = ταχύτητα από στεριανό κελί (σήμερα) · Β = ταχύτητα από θαλασσινό κελί όπου το στεριανό απέχει ≥3 χλμ (§Γ51). Διεύθυνση ΙΔΙΑ και στα δύο.',
  waveGate: 'Ο νέος φραγμός capIdealByShoreSea (κύμα ≥0,40 μ. ⇒ όχι μπλε) εφαρμόζεται ΚΑΙ στα δύο σκέλη — οι δύο αλλαγές στοιβάζονται.',
  caveat: 'Κύμα ΜΟΝΤΕΛΟΠΟΙΗΜΕΝΟ, όχι μετρημένο· οι όρμοι δεν εξαιρούνται εδώ. Το «χαμένο μπλε» είναι ταβάνι.',
  days: DAYS, beaches: sample.length,
  total: shape(total),
  onlyWhereItApplies: shape(gatedOnly),
  byLandCellDistance: Object.fromEntries(Object.entries(byBucket).map(([k, v]) => [k, shape(v)])),
  byBeaufortBefore: Object.fromEntries(Object.entries(byBeaufortA).map(([k, v]) => [k, {
    hours: v.hours, colourChangedPct: pct(v.colourChanged, v.hours), worse: v.worse,
  }])),
  topMovers: movers.sort((a, b) => b.changedPct - a.changedPct).slice(0, 25),
  beachesTouched: movers.length,
};

const outDir = path.join(root, 'reports', 'weather');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `sea-speed-colour-impact-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

const show = (name, s) => {
  console.log(`\n${name} — ${s.hours.toLocaleString('el-GR')} παραλιο-ώρες`);
  console.log(`  Μποφόρ αλλάζει ${s.beaufortChangedPct}% (πάνω: ${s.beaufortUp}) · χρώμα ${s.colourChangedPct}% · λέξη κάρτας ${s.cardChangedPct}% · πινέζα ${s.pinChangedPct}%`);
  console.log(`  προς πιο ΑΓΡΙΟ ${s.worse} · προς πιο ΗΡΕΜΟ ${s.better}`);
  for (const t of TONES) console.log(`    ${t.padEnd(7)} ${String(s.toneBefore[t]).padEnd(18)} → ${s.toneAfter[t]}`);
};
show('ΟΛΕΣ ΟΙ ΠΑΡΑΛΙΕΣ', report.total);
show('ΜΟΝΟ ΟΠΟΥ ΕΦΑΡΜΟΖΕΤΑΙ (≥3 χλμ)', report.onlyWhereItApplies);
console.log(`\nΑνά απόσταση στεριανού κελιού:`);
for (const [k, s] of Object.entries(report.byLandCellDistance)) {
  console.log(`  ${k.padEnd(9)} ώρες ${String(s.hours).padEnd(8)} χρώμα ${String(s.colourChangedPct + '%').padEnd(8)} άγριο ${String(s.worse).padEnd(6)} ήρεμο ${s.better}`);
}
console.log(`\nΠαραλίες που κουνήθηκαν έστω μία ώρα: ${report.beachesTouched}`);
console.log(`→ ${path.relative(root, outPath)}\n`);
