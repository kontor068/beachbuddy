#!/usr/bin/env node
/**
 * ΑΝ Η ΔΙΕΥΘΥΝΣΗ ΕΡΧΟΤΑΝ ΑΠΟ ΤΟ ΝΕΡΟ, ΠΟΣΕΣ ΠΙΝΕΖΕΣ ΘΑ ΑΛΛΑΖΑΝ ΧΡΩΜΑ;
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το §Γ29 της βίβλου (`docs/team/PORISMA-KAIROS-2026-08.md`) μέτρησε σε 25
 * αεροδρόμια ότι η ΔΙΕΥΘΥΝΣΗ του θαλασσινού κελιού είναι πιο σωστή από του στεριανού όταν το
 * στεριανό κάθεται ≥3 χλμ μακριά (60,1% → 63,2% τον Αύγουστο, 51,0% → 53,9% τον Ιούνιο· και
 * όταν τα δύο κελιά διαφωνούν, η θάλασσα έχει δίκιο 1,4-1,5× πιο συχνά). Η ΤΑΧΥΤΗΤΑ δεν
 * αποδείχθηκε — στα <3 χλμ η στεριά είναι σταθερά καλύτερη — άρα η υποψήφια διόρθωση είναι
 * ΥΒΡΙΔΙΚΗ: ταχύτητα από τη στεριά, διεύθυνση από το νερό.
 *
 * Το ίδιο το §Γ29 όμως γράφει το όριό του: «Δεν μετρήθηκε το ΧΡΩΜΑ, μόνο ο τομέας. Πόσες
 * πινέζες όντως αλλάζουν χρώμα δεν το ξέρουμε — ο τομέας αλλάζει στο 20-26% των ωρών με άνεμο,
 * αυτό είναι το ΤΑΒΑΝΙ, όχι η απάντηση. Επόμενο βήμα: ίδια δοκιμή πάνω σε πραγματικές παραλίες
 * με τα προφίλ έκθεσης.» Αυτό κάνει αυτό εδώ.
 *
 * ΤΙ ΑΛΛΑΖΕΙ ΚΑΙ ΤΙ ΟΧΙ. Μόνο η ΔΙΕΥΘΥΝΣΗ. Η ταχύτητα, η ριπή, το υψόμετρο του κελιού και άρα
 * ο δάπεδος ριπής (`utils/windGustFloor`) και το Μποφόρ είναι ΙΔΙΑ και στα δύο σκέλη. Έτσι
 * ό,τι μετακινηθεί το χρωστάει αποκλειστικά στην επιλογή κελιού για τη διεύθυνση.
 *
 * ΤΡΕΙΣ ΕΠΙΦΑΝΕΙΕΣ, ΟΧΙ ΜΙΑ:
 *   • η ΛΕΞΗ της κάρτας      → `assessBeachWindExposure(...).exposureLevel`
 *   • το ΧΡΩΜΑ του τσιπ      → `...simpleWindSuitability.suitabilityColor` (μόνο άνεμος)
 *   • το ΕΠΙΠΕΔΟ της πινέζας → `getVisibleMapExposureLevel`
 *
 * ΚΟΣΤΟΣ ΚΛΗΣΕΩΝ. Το στεριανό σκέλος ζητιέται ΑΝΑ ΚΕΛΙ (632 διακριτά για 2.872 παραλίες) —
 * δύο παραλίες στο ίδιο κελί παίρνουν πανομοιότυπα νούμερα, οπότε η επανάληψη θα ήταν σκέτη
 * σπατάλη. Το θαλασσινό σκέλος ζητιέται ΑΝΑ ΠΑΡΑΛΙΑ, γιατί το πλησιέστερο κελί νερού εξαρτάται
 * από τις συντεταγμένες της καθεμιάς. Σύνολο ~3.500 μονάδες, μέσα στο δωρεάν όριο.
 *
 *   node scripts/measureCellDirectionColourImpact.mjs [--days=7] [--limit=N] [--verbose]
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

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : dflt;
};
const DAYS = Number(arg('days', '7'));
const LIMIT = Number(arg('limit', '0'));
const verbose = process.argv.includes('--verbose');
/** Οι ώρες που πάει κόσμος στην παραλία. Το χρώμα στις 04:00 δεν το βλέπει κανείς. */
const DAY_START = 9;
const DAY_END = 19;
/** Κάτω από αυτό η διεύθυνση δεν σημαίνει τίποτα και το app είναι μπλε ούτως ή άλλως (§Γ29). */
const DIR_MIN_KMH = 7.5;
/** Η πύλη απόστασης που πρότεινε το §Γ29: κάτω από 3 χλμ δεν υπήρχε κέρδος, ισοπαλία. */
const GATE_KM = 3;
const NEUTRAL_SEA_M = 0.4;
/** Παύση ανά δέσμη 100 σημείων ώστε να μένουμε κάτω από τα 600/λεπτό του δωρεάν endpoint. */
const PACE_MS = Number(arg('pace', '13000'));

const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);
const dirDelta = (a, b) => { const d = Math.abs(((a - b) % 360 + 360) % 360); return d > 180 ? 360 - d : d; };
const pct = (n, d) => (d ? Math.round(10000 * n / d) / 100 : 0);

const sleep = ms => new Promise(r => setTimeout(r, ms));
/**
 * ΤΟ ΔΩΡΕΑΝ ENDPOINT ΜΕΤΡΑΕΙ ΑΝΑ ΣΗΜΕΙΟ, ΟΧΙ ΑΝΑ ΑΙΤΗΜΑ — 600 τον λεπτό.
 * Ένα αίτημα με 100 συντεταγμένες χρεώνεται 100. Η πρώτη εθνική δοκιμή έφαγε 429 στα 500
 * σημεία μέσα σε δευτερόλεπτα, οπότε ο ρυθμιστής παρακάτω δεν είναι ευγένεια, είναι
 * προϋπόθεση: χωρίς αυτόν η μέτρηση δεν τελειώνει ποτέ.
 */
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

/** Ίδια εφεδρεία με το `auditLandVsSeaCellWind.mjs`: χωρίς κλειδί, δωρεάν endpoint, ίδια δεδομένα. */
const readKey = async () => {
  try {
    const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
    if (!token) return null;
    const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
    const res = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) return null;
    return ((await res.json()).values || []).map(v => v.value).find(Boolean) || null;
  } catch { return null; }
};
const API_KEY = await readKey();
const HOST = API_KEY ? 'https://customer-api.open-meteo.com' : 'https://api.open-meteo.com';
if (!API_KEY) console.log('⚠ χωρίς κλειδί (Netlify token ληγμένο) — δωρεάν endpoint, ίδια δεδομένα');

// ── 1. ΟΙ ΠΑΡΑΛΙΕΣ ΚΑΙ ΤΑ ΠΡΟΦΙΛ ΤΟΥΣ ───────────────────────────────────────
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
  } catch { /* περιοχή χωρίς γεωμετρία — η μηχανή πέφτει στο authored προφίλ, σωστά */ }
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
console.log(`Παραλίες: ${sample.length.toLocaleString('el-GR')} · διακριτά στεριανά κελιά: ${cellKeys.length.toLocaleString('el-GR')} · ${DAYS} ημέρες, ώρες ${DAY_START}-${DAY_END}`);

// ── 2. ΤΑ ΔΥΟ ΣΚΕΛΗ ──────────────────────────────────────────────────────────
const CHUNK = 100;
const chunks = arr => { const out = []; for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK)); return out; };

const fetchArm = async (points, cellSelection, vars) => {
  const out = [];
  const parts = chunks(points);
  for (const c of parts) {
    if (out.length) await sleep(PACE_MS);
    const url = `${HOST}/v1/forecast?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}`
      + `&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=${vars}&forecast_days=${DAYS}&timezone=Europe%2FAthens&wind_speed_unit=kmh`
      + `&cell_selection=${cellSelection}${API_KEY ? `&apikey=${API_KEY}` : ''}`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`Το ${cellSelection} γύρισε ${rows.length} για ${c.length} σημεία`);
    out.push(...rows);
    process.stdout.write(`\r  ${cellSelection}: ${out.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  return out;
};

const landPoints = cellKeys.map(k => { const [lat, lon] = k.split('_').map(Number); return { lat, lon, key: k }; });

/**
 * ΚΡΑΤΑΜΕ ΤΑ ΩΜΑ ΔΕΔΟΜΕΝΑ ΣΤΟΝ ΔΙΣΚΟ. Μια εθνική σάρωση κοστίζει ~3.500 από τις 10.000
 * ημερήσιες μονάδες· αν σκάσει το δεύτερο σκέλος, το πρώτο δεν ξαναζητιέται.
 */
const cacheDir = path.join(root, '.tmp');
fs.mkdirSync(cacheDir, { recursive: true });
const cached = async (name, run) => {
  const f = path.join(cacheDir, `cell-dir-${name}-${DAYS}d-${new Date().toISOString().slice(0, 10)}.json`);
  if (fs.existsSync(f)) { console.log(`  ${name}: από τον δίσκο (${path.relative(root, f)})`); return JSON.parse(fs.readFileSync(f, 'utf8')); }
  const rows = await run();
  fs.writeFileSync(f, JSON.stringify(rows));
  return rows;
};
const landRows = await cached('land', () => fetchArm(landPoints, 'land', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m'));
const seaRows = await cached('sea', () => fetchArm(sample, 'sea', 'wind_direction_10m'));

const landByCell = new Map();
landPoints.forEach((p, i) => {
  const r = landRows[i];
  landByCell.set(p.key, {
    time: r.hourly.time, speed: r.hourly.wind_speed_10m, dir: r.hourly.wind_direction_10m,
    gust: r.hourly.wind_gusts_10m, elevation: r.elevation, lat: r.latitude, lon: r.longitude,
  });
});

// ── 3. Η ΜΕΤΡΗΣΗ ─────────────────────────────────────────────────────────────
const BUCKETS = [
  { key: '<3', test: d => d < 3 }, { key: '3-5', test: d => d >= 3 && d < 5 },
  { key: '5-7', test: d => d >= 5 && d < 7 }, { key: '>=7', test: d => d >= 7 },
];
const blank = () => ({ hours: 0, sectorChanged: 0, cardChanged: 0, colourChanged: 0, pinChanged: 0, colourWorse: 0, colourBetter: 0, pinDiffersFromCard: 0, dirDeltaSum: 0, waveMoved10: 0, waveMoved20: 0, waveUp: 0, waveAbsSum: 0, waveMaxAbs: 0 });
const total = blank();
const gated = blank();
const byBucket = Object.fromEntries(BUCKETS.map(b => [b.key, blank()]));
const perBeach = new Map();
/**
 * ΣΕ ΠΟΙΟ ΜΠΟΦΟΡ ΓΥΡΙΖΕΙ ΤΟ ΧΡΩΜΑ. Δεν είναι διακοσμητικό: στα 3 Μποφ το κίτρινο ζητάει πια
 * κύμα (§Γ32), και αυτή η μέτρηση τρέχει με ΟΥΔΕΤΕΡΗ θάλασσα. Αν οι αλλαγές μαζεύονται στα 3,
 * το πραγματικό αποτύπωμα στην εφαρμογή είναι ΜΙΚΡΟΤΕΡΟ από όσο δείχνει η συνολική γραμμή.
 */
const byBeaufort = {};
/** Η πραγματική κλίμακα του `CalmnessTone` (`utils/suitabilityTone.ts:68`), από το ήρεμο στο άγριο. */
const COLOUR_RANK = { blue: 0, yellow: 1, orange: 2, red: 3 };
const rank = c => (COLOUR_RANK[c] ?? 1);

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
  /**
   * Ο ΤΙΜΙΟΣ ΔΑΠΕΔΟΣ ΚΥΜΑΤΟΣ, ΙΔΙΑ ΣΥΝΤΑΓΗ ΜΕ ΤΗ ΣΟΥΙΤΑ (`scripts/windExposureValidation.ts:289`):
   * max(SMB × απόσβεση έκθεσης, δάπεδο κυματισμού ανέμου). Το εμφανιζόμενο ύψος είναι
   * max(μετρημένο, αυτό) — και το μετρημένο είναι ΤΟ ΙΔΙΟ στα δύο σκέλη, άρα ό,τι κουνηθεί εδώ
   * είναι το ΤΑΒΑΝΙ της αλλαγής στο νούμερο που βλέπει ο κόσμος.
   */
  const damping = a.exposureLevel === 'protected' ? 0.5 : a.exposureLevel === 'partial' ? 0.75 : 1;
  const modelledWaveM = Number(Math.max(
    (a.modeledWaveHeightM || 0) * damping,
    getWindChopWaveFloorM(a.exposureLevel, bft, speedKmh, gustKmh, rawMeanKmh),
  ).toFixed(2));
  return { card: a.exposureLevel, colour: a.simpleWindSuitability?.suitabilityColor, pin, sector: a.windSector, modelledWaveM };
};

sample.forEach((b, i) => {
  const land = landByCell.get(b.cell);
  const seaDirs = seaRows[i]?.hourly?.wind_direction_10m;
  const seaLat = seaRows[i]?.latitude, seaLon = seaRows[i]?.longitude;
  if (!land || !seaDirs) return;
  const cellDist = distKm(b.lat, b.lon, land.lat, land.lon);
  const bucket = BUCKETS.find(x => x.test(cellDist))?.key;
  const rec = {
    id: b.beach.id, name: b.beach.name?.gr || b.beach.name?.en || `#${b.beach.id}`, region: b.regionId,
    cellDistKm: Math.round(cellDist * 100) / 100,
    seaCellDistKm: Math.round(distKm(b.lat, b.lon, seaLat, seaLon) * 100) / 100,
    hours: 0, colourChanged: 0, pinChanged: 0, cardChanged: 0, worst: null,
  };

  for (let h = 0; h < land.time.length; h++) {
    const hour = Number(land.time[h].slice(11, 13));
    if (hour < DAY_START || hour > DAY_END) continue;
    const raw = land.speed[h], gust = land.gust[h], lDir = land.dir[h], sDir = seaDirs[h];
    if (![raw, lDir, sDir].every(Number.isFinite)) continue;
    const speed = applyGustFloor(raw, gust, land.elevation);
    if (speed < DIR_MIN_KMH) continue;
    const bft = getBeaufortLevel(speed);
    const A = assess(b, lDir, speed, bft, gust, raw);
    const B = assess(b, sDir, speed, bft, gust, raw);
    const waveDelta = B.modelledWaveM - A.modelledWaveM;
    const dd = dirDelta(lDir, sDir);
    const targets = [total, byBucket[bucket]];
    if (cellDist >= GATE_KM) targets.push(gated);
    for (const t of targets) {
      t.hours += 1; t.dirDeltaSum += dd;
      if (A.sector !== B.sector) t.sectorChanged += 1;
      if (A.card !== B.card) t.cardChanged += 1;
      if (A.pin !== B.pin) t.pinChanged += 1;
      // ΑΥΤΟΣΑΜΠΟΤΑΖ: αν αυτό μείνει 0, η μηχανή του χάρτη απλώς επιστρέφει τη λέξη της κάρτας
      // και η στήλη «πινέζα» δεν μετράει τίποτα δικό της — το ίδιο λάθος που τύφλωσε το
      // quality:verdicts (βλ. `validateCardVsPinExposure.mjs`, έλεγχος Δ).
      if (A.pin !== A.card) t.pinDiffersFromCard += 1;
      if (A.colour !== B.colour) {
        t.colourChanged += 1;
        if (rank(B.colour) > rank(A.colour)) t.colourWorse += 1; else t.colourBetter += 1;
      }
      const ad = Math.abs(waveDelta);
      t.waveAbsSum += ad;
      if (ad > t.waveMaxAbs) t.waveMaxAbs = ad;
      if (ad >= 0.1) t.waveMoved10 += 1;
      if (ad >= 0.2) t.waveMoved20 += 1;
      if (waveDelta > 0) t.waveUp += 1;
    }
    byBeaufort[bft] = byBeaufort[bft] || { hours: 0, colourChanged: 0, cardChanged: 0, waveMoved10: 0 };
    byBeaufort[bft].hours += 1;
    if (A.colour !== B.colour) byBeaufort[bft].colourChanged += 1;
    if (A.card !== B.card) byBeaufort[bft].cardChanged += 1;
    if (Math.abs(waveDelta) >= 0.1) byBeaufort[bft].waveMoved10 = (byBeaufort[bft].waveMoved10 || 0) + 1;
    rec.hours += 1;
    if (A.card !== B.card) rec.cardChanged += 1;
    if (A.pin !== B.pin) rec.pinChanged += 1;
    if (A.colour !== B.colour) {
      rec.colourChanged += 1;
      if (!rec.worst) rec.worst = { time: land.time[h], bft, landDir: lDir, seaDir: sDir, from: A.colour, to: B.colour, cardFrom: A.card, cardTo: B.card };
    }
  }
  if (rec.hours) perBeach.set(b.beach.id, rec);
});

// ── 4. ΑΝΑΦΟΡΑ ───────────────────────────────────────────────────────────────
const line = (label, t) => `${label.padEnd(20)} ${String(t.hours).padStart(8)}  ${String(pct(t.sectorChanged, t.hours)).padStart(6)}%  ${String(pct(t.cardChanged, t.hours)).padStart(6)}%  ${String(pct(t.colourChanged, t.hours)).padStart(6)}%  ${String(pct(t.pinChanged, t.hours)).padStart(6)}%  ${(t.dirDeltaSum / (t.hours || 1)).toFixed(1).padStart(5)}°`;
console.log('\nΑΝ Η ΔΙΕΥΘΥΝΣΗ ΕΡΧΟΤΑΝ ΑΠΟ ΤΟ ΝΕΡΟ (ταχύτητα αμετάβλητη από τη στεριά)\n');
console.log(`${''.padEnd(20)} ${'ώρες'.padStart(8)}   ${'τομέας'.padStart(6)}    ${'λέξη'.padStart(6)}   ${'χρώμα'.padStart(6)}  ${'πινέζα'.padStart(6)}  Δγωνία`);
console.log(line('ΟΛΕΣ', total));
console.log(line(`με πύλη >=${GATE_KM} χλμ`, gated));
for (const b of BUCKETS) console.log(line(`  ${b.key} χλμ`, byBucket[b.key]));

const changedBeaches = [...perBeach.values()].filter(r => r.colourChanged > 0);
const pinBeaches = [...perBeach.values()].filter(r => r.pinChanged > 0);
console.log(`\nΠαραλίες με >=1 ώρα αλλαγής ΧΡΩΜΑΤΟΣ: ${changedBeaches.length} / ${perBeach.size} (${pct(changedBeaches.length, perBeach.size)}%)`);
console.log(`Παραλίες με >=1 ώρα αλλαγής ΠΙΝΕΖΑΣ:  ${pinBeaches.length} / ${perBeach.size} (${pct(pinBeaches.length, perBeach.size)}%)`);
console.log(`Κατεύθυνση της αλλαγής χρώματος: ${total.colourWorse} πιο σκούρο / ${total.colourBetter} πιο ανοιχτό`);
console.log(`${total.pinDiffersFromCard > 0 ? 'OK  ' : 'ΠΡΟΣΟΧΗ'} η πινέζα κρίνει μόνη της: διαφέρει από τη λέξη της κάρτας σε ${total.pinDiffersFromCard} ώρες (${pct(total.pinDiffersFromCard, total.hours)}%)`);

console.log('\nΣε ποιο Μποφόρ γυρίζει το χρώμα (ουδέτερη θάλασσα — στα 3 Μπφ το κίτρινο θέλει πια κύμα, §Γ32):');
for (const b of Object.keys(byBeaufort).sort((a, c) => a - c)) {
  const r = byBeaufort[b];
  console.log(`  ${b} Μπφ  ${String(r.hours).padStart(7)} ώρες  χρώμα ${String(pct(r.colourChanged, r.hours)).padStart(6)}%  λέξη ${String(pct(r.cardChanged, r.hours)).padStart(6)}%  κύμα>=0,1μ ${String(pct(r.waveMoved10, r.hours)).padStart(6)}%`);
}

const waveLine = (label, t) => `  ${label.padEnd(18)} >=0,1 μ. ${String(pct(t.waveMoved10, t.hours)).padStart(6)}%  >=0,2 μ. ${String(pct(t.waveMoved20, t.hours)).padStart(6)}%  μέση |Δ| ${(t.waveAbsSum / (t.hours || 1)).toFixed(3)} μ.  μέγιστη ${t.waveMaxAbs.toFixed(2)} μ.`;
console.log('\nΤΟ ΚΥΜΑ (μοντελοποιημένο δάπεδο· το εμφανιζόμενο = max(μετρημένο, αυτό), άρα ΤΑΒΑΝΙ):');
console.log(waveLine('ΟΛΕΣ', total));
console.log(waveLine(`με πύλη >=${GATE_KM} χλμ`, gated));
for (const b of BUCKETS) console.log(waveLine(`${b.key} χλμ`, byBucket[b.key]));

const worst = changedBeaches.sort((a, b) => (b.colourChanged / b.hours) - (a.colourChanged / a.hours)).slice(0, verbose ? 40 : 12);
console.log('\nΟι πιο ευαίσθητες παραλίες (ποσοστό ωρών που γυρίζει το χρώμα):');
for (const r of worst) {
  console.log(`  #${r.id} ${r.name} [${r.region}] κελί ${r.cellDistKm} χλμ — ${pct(r.colourChanged, r.hours)}% (${r.colourChanged}/${r.hours})`
    + (r.worst ? ` π.χ. ${r.worst.time} ${r.worst.bft}Μπφ ${Math.round(r.worst.landDir)}°→${Math.round(r.worst.seaDir)}° ${r.worst.from}→${r.worst.to}` : ''));
}

const stamp = new Date().toISOString().slice(0, 10);
const outPath = path.join(root, `reports/weather/cell-direction-colour-impact-${stamp}.json`);
fs.writeFileSync(outPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  question: 'Αν η ΔΙΕΥΘΥΝΣΗ ερχόταν από το κελί θάλασσας (ταχύτητα/ριπή/Μποφόρ αμετάβλητα από τη στεριά), πόσες πινέζες αλλάζουν χρώμα;',
  method: { days: DAYS, dayHours: [DAY_START, DAY_END], dirMinKmh: DIR_MIN_KMH, gateKm: GATE_KM, neutralSeaM: NEUTRAL_SEA_M, beaches: sample.length, landCells: cellKeys.length },
  limits: [
    'Το χρώμα είναι το ΜΟΝΟ-ΑΝΕΜΟΥ (simpleWindSuitability). Η κατάσταση θάλασσας δεν μπαίνει — άρα δεν μετριέται πώς η ίδια αλλαγή διεύθυνσης μετακινεί το κύμα SMB.',
    'Η πινέζα είναι η ΜΟΝΗ ΤΗΣ (getVisibleMapExposureLevel). Το πέρασμα γειτονιάς θέλει έναν άνεμο ανά περιοχή και δεν προσομοιώνεται εδώ.',
    'Παράθυρο πρόγνωσης, όχι μέτρηση — δεν λέει ΠΟΙΟ σκέλος έχει δίκιο. Αυτό το είπε το §Γ29 στα αεροδρόμια.',
  ],
  overall: total, gated, byBucket, byBeaufort,
  beachesWithColourChange: changedBeaches.length, beachesWithPinChange: pinBeaches.length, beachesMeasured: perBeach.size,
  perBeach: [...perBeach.values()].filter(r => r.colourChanged || r.pinChanged || r.cardChanged).sort((a, b) => b.colourChanged - a.colourChanged),
}, null, 2));
console.log(`\nΑναφορά: ${path.relative(root, outPath)}`);
