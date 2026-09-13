#!/usr/bin/env node
/**
 * Δ9-Α — ΤΟ ΕΠΟΜΕΝΟ ΚΕΛΙ ΝΕΡΟΥ ΠΟΥ «ΒΛΕΠΕΙ» Η ΠΑΡΑΛΙΑ, ΓΙΑ ΤΑ 98 ΚΕΛΙΑ ΠΙΣΩ ΑΠΟ ΒΟΥΝΟ (13/09/2026).
 *
 * ΓΙΑΤΙ. Το `bakeSeaWindCells.mjs` ρωτά την Open-Meteo `cell_selection=sea` ΣΤΗΝ ΠΙΝΕΖΑ και κρατά ό,τι
 * της απαντήσει. Σε 98 παραλίες (βίβλος §Γ81 Δ9-Β, `reports/quality/sea-wind-cell-relief-2026-09-13.json`
 * `high[]`) ανάμεσα στην παραλία και στο κέντρο του κελιού που απάντησε υπάρχει στεριά ≥200 μ.: το
 * κελί μιλάει για τον αέρα της ΑΛΛΗΣ πλευράς της χερσονήσου. Εδώ ψάχνουμε, ανά παραλία, κελί που
 * (α) απαντάει πραγματικά η ίδια πόρτα (`cell_selection=sea` — όχι δικός μας υπολογισμός πλέγματος),
 * (β) έχει διαδρομή παραλία → κέντρο κελιού με μέγιστο υψόμετρο < 50 μ. (το `LOW_M` του ίδιου audit:
 *     «ο αέρας περνάει, το κελί μένει» — ο αριθμός που ήδη αποφασίστηκε, όχι νέος),
 * (γ) το κέντρο του, όταν το ξαναρωτήσεις, απαντά ΤΟΝ ΕΑΥΤΟ ΤΟΥ (≤0,2°, το όριο του
 *     `COORD_SANITY_TOLERANCE_DEG.overWaterWind` — αλλιώς ο πελάτης το πετάει σιωπηλά στο runtime),
 * και διαλέγουμε το ΚΟΝΤΙΝΟΤΕΡΟ τέτοιο. Χωρίς αποδεκτό υποψήφιο η παραλία κρατά το παλιό της κελί και
 * γράφεται στα `unresolved` — καμία παραλία δεν χάνεται από τον χάρτη (η πύλη «1.833» μένει).
 *
 * ΑΝΑ ΠΑΡΑΛΙΑ, ΟΧΙ ΑΝΑ ΚΕΛΙ: τα 98 μοιράζονται 47 κελιά με άλλες 82 παραλίες που ο έλεγχος βρήκε
 * καθαρές· εκείνες δεν αγγίζονται.
 *
 * ΠΟΥ ΨΑΧΝΕΙ. Σημεία ανίχνευσης από την παραλία προς τη θάλασσα: πρώτα στην κατεύθυνση που κοιτάει η
 * ακτή (`facingDeg`), μετά στα κέντρα των τομέων με ανοιχτό fetch (≥10 χλμ, ύστερα ≥5), τέλος προς το
 * θαλάσσιο σημείο της παραλίας· ό,τι πέφτει ±30° από την κατεύθυνση του αποκλεισμένου κελιού πάει
 * τελευταίο (εκεί είναι το βουνό). Αποστάσεις 1, 2, 3, 4, 6 χλμ, με ταβάνι 0,8 × fetch στην
 * κατεύθυνση — μένουμε στο νερό ΤΗΣ παραλίας.
 *
 *   node scripts/findSeaWindCellAlternatives.mjs                # dry-run → reports/quality/sea-wind-cell-alternatives-<ημ>.json
 *   node scripts/findSeaWindCellAlternatives.mjs --write        # + data/sea-wind-cell-overrides.json
 *   [--input reports/quality/sea-wind-cell-relief-2026-09-13.json] [--ids 1108,375] [--refresh]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';
import { createElevationSampler, destinationPoint as walk, sleep } from './lib/upwindDem.mjs';
import { SECTORS, distanceKm, bearingDeg, interpolatedFetchKm, bearingGapDeg } from './lib/marineCellTrust.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); if (hit) return hit.slice(name.length + 1); const i = process.argv.indexOf(name); return i === -1 || !process.argv[i + 1] || process.argv[i + 1].startsWith('--') ? fallback : process.argv[i + 1]; };
const today = new Date().toISOString().slice(0, 10);
const inputPath = argVal('--input', 'reports/quality/sea-wind-cell-relief-2026-09-13.json');
const outPath = argVal('--out', `reports/quality/sea-wind-cell-alternatives-${today}.json`);
const LEDGER = path.join(root, 'data/sea-wind-cell-overrides.json');
const WRITE = process.argv.includes('--write');
const REFRESH = process.argv.includes('--refresh');
const ONLY = argVal('--ids', '') ? new Set(argVal('--ids', '').split(',').map(Number)) : null;

// Οι αριθμοί που ήδη αποφασίστηκαν αλλού — εδώ μόνο διαβάζονται.
const LOW_M = 50;                 // auditSeaWindCellRelief.mjs LOW_M: «χαμηλή στεριά, ο αέρας περνάει»
const HIGH_M = 200;               // auditSeaWindCellRelief.mjs HIGH_M: το κατώφλι της εξαίρεσης
const ECHO_TOLERANCE_DEG = 0.2;   // services/weatherService.ts COORD_SANITY_TOLERANCE_DEG.overWaterWind
const STEP_KM = 0.5;              // ίδιο βήμα DEM με το audit
const OPEN_FETCH_KM = 10;         // utils/seaArrival SHADOW_OPEN_FETCH_KM: «ανοιχτή πόρτα»
const PROBE_KM = [1, 2, 3, 4, 6];
const MIN_PROBE_KM = 0.6;
const CHUNK = 100;
const PACE_MS = 1500;             // πληρωμένος host: 600 σημεία/λεπτό αρκούν, δεν χρειάζεται τα 13 s του δωρεάν

const apiKey = await resolveOpenMeteoKey();
if (!apiKey) { console.error('Χωρίς κλειδί Open-Meteo (OPEN_METEO_API_KEY).'); process.exit(1); }

// ── Είσοδος: τα 98 + συντεταγμένες + προφίλ έκθεσης ──────────────────────────────────────────
const relief = JSON.parse(readFileSync(path.resolve(root, inputPath), 'utf8'));
const targets = (relief.high ?? []).filter(r => !ONLY || ONLY.has(r.beachId));
if (!targets.length) { console.error('Καμία παραλία-στόχος.'); process.exit(1); }
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const regionCache = new Map();
const loadRegion = (regionId) => {
  if (!regionCache.has(regionId)) {
    const app = JSON.parse(readFileSync(path.join(appDir, `${regionId}.json`), 'utf8'));
    let profiles = {};
    try { for (const p of Object.values(JSON.parse(readFileSync(path.join(expDir, `${regionId}.json`), 'utf8')).profiles ?? {})) if (p?.beachId != null) profiles[p.beachId] = p; } catch { /* χωρίς προφίλ */ }
    regionCache.set(regionId, { beaches: new Map((app.island?.beaches ?? []).map(b => [b.id, b])), profiles });
  }
  return regionCache.get(regionId);
};
const baked = JSON.parse(readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8'));

// ── Η πόρτα cell_selection=sea, ίδιο ερώτημα με το bake ──────────────────────────────────────
const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) { if (i === tries - 1) throw e; await sleep(3000 * (i + 1)); }
  }
};
const cellKeyOf = (row) => `${row.latitude}_${row.longitude}`;   // ίδια μορφή με το bake
const probeSea = async (points) => {
  const out = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const c = points.slice(i, i + CHUNK);
    if (i) await sleep(PACE_MS);
    const url = 'https://customer-api.open-meteo.com/v1/forecast'
      + `?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + `&hourly=wind_direction_10m&forecast_days=1&timezone=Europe%2FAthens&cell_selection=sea&apikey=${encodeURIComponent(apiKey)}`;
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`η πόρτα γύρισε ${rows.length} για ${c.length} σημεία`);
    out.push(...rows);
    process.stderr.write(`\r  ανίχνευση: ${out.length}/${points.length}   `);
  }
  process.stderr.write('\n');
  return out;
};

// ── Σκάλα κατευθύνσεων και σημείων ανίχνευσης ανά παραλία ────────────────────────────────────
const sectorCentre = (name) => SECTORS.indexOf(name) * 45;
const probePlan = (target, beach, profile) => {
  const b = { lat: beach.coordinates.lat, lon: beach.coordinates.lon };
  const [clat, clon] = String(target.cell).split('_').map(Number);
  const excludedBearing = bearingDeg(b.lat, b.lon, clat, clon);
  const ladder = [];
  const push = (deg, via) => { if (!Number.isFinite(deg)) return; if (ladder.some(l => bearingGapDeg(l.deg, deg) < 10)) return; ladder.push({ deg: ((deg % 360) + 360) % 360, via }); };
  push(profile?.facingDeg, 'facing');
  const sectors = profile?.sectors ?? {};
  const byGap = (min) => SECTORS.filter(s => (sectors[s]?.fetchKm ?? 0) >= min)
    .sort((x, y) => bearingGapDeg(sectorCentre(x), profile?.facingDeg ?? 0) - bearingGapDeg(sectorCentre(y), profile?.facingDeg ?? 0));
  for (const s of byGap(OPEN_FETCH_KM)) push(sectorCentre(s), `sector≥10:${s}`);
  for (const s of byGap(5)) push(sectorCentre(s), `sector≥5:${s}`);
  push(profile?.marineSamplePoint?.bearingDeg, 'marinePoint');
  // Το βουνό είναι προς το αποκλεισμένο κελί: εκείνες οι κατευθύνσεις δοκιμάζονται τελευταίες.
  ladder.sort((x, y) => Number(bearingGapDeg(x.deg, excludedBearing) <= 30) - Number(bearingGapDeg(y.deg, excludedBearing) <= 30));
  const probes = [];
  ladder.forEach((rung, rank) => {
    const fetchKm = interpolatedFetchKm(sectors, rung.deg);
    const cap = Number.isFinite(fetchKm) ? 0.8 * fetchKm : Infinity;
    for (const km of PROBE_KM) {
      if (km > cap || km < MIN_PROBE_KM) continue;
      const p = walk(b, rung.deg, km);
      probes.push({ ...p, bearingDeg: Math.round(rung.deg), km, via: rung.via, rank });
    }
  });
  return { b, excludedBearing: Math.round(excludedBearing), probes };
};

// ── 1. Ανίχνευση όλων των σημείων ──────────────────────────────────────────────────────────
const work = [];
for (const t of targets) {
  const region = loadRegion(t.region);
  const beach = region.beaches.get(t.beachId);
  const profile = region.profiles[t.beachId];
  if (!beach?.coordinates) { work.push({ target: t, skipped: 'χωρίς συντεταγμένες' }); continue; }
  const plan = probePlan(t, beach, profile);
  work.push({ target: t, beach, profile, ...plan, currentBaked: baked.cells?.[String(t.beachId)] ?? null });
}
const allProbes = work.flatMap(w => (w.probes ?? []).map(p => ({ ...p, beachId: w.target.beachId })));
console.error(`παραλίες ${work.filter(w => !w.skipped).length} · σημεία ανίχνευσης ${allProbes.length}`);
const probeRows = await probeSea(allProbes);
allProbes.forEach((p, i) => { p.servedCell = cellKeyOf(probeRows[i]); p.servedLat = probeRows[i].latitude; p.servedLon = probeRows[i].longitude; });

// ── 2. Υποψήφια κελιά ανά παραλία + δείγματα DEM στη διαδρομή ────────────────────────────────
const demPoints = [];
for (const w of work) {
  if (w.skipped) continue;
  const mine = allProbes.filter(p => p.beachId === w.target.beachId);
  const byCell = new Map();
  for (const p of mine) {
    if (p.servedCell === w.target.cell) { p.rejectedWhy = 'ίδιο με το αποκλεισμένο κελί'; continue; }
    if (!byCell.has(p.servedCell)) byCell.set(p.servedCell, { cell: p.servedCell, lat: p.servedLat, lon: p.servedLon, firstProbe: p, probes: [] });
    byCell.get(p.servedCell).probes.push({ via: p.via, bearingDeg: p.bearingDeg, km: p.km, probeLat: p.lat, probeLon: p.lon });
  }
  w.candidates = [...byCell.values()].map(c => {
    const dist = distanceKm(w.b.lat, w.b.lon, c.lat, c.lon);
    const brg = bearingDeg(w.b.lat, w.b.lon, c.lat, c.lon);
    const n = Math.max(2, Math.round(dist / STEP_KM));
    const idx = [];
    for (let i = 0; i <= n; i++) {
      const d = Math.min(dist, 0.25 + i * STEP_KM);
      idx.push(demPoints.length);
      demPoints.push(walk(w.b, brg, d));
      if (d >= dist) break;
    }
    const fetchKm = interpolatedFetchKm(w.profile?.sectors ?? {}, brg);
    return { ...c, distanceKm: Math.round(dist * 100) / 100, bearingDeg: Math.round(brg), fetchKmAtBearing: Number.isFinite(fetchKm) ? Math.round(fetchKm * 10) / 10 : null, geometricTrust: Number.isFinite(fetchKm) ? fetchKm >= 0.8 * dist : null, sampleIdx: idx };
  }).sort((x, y) => x.distanceKm - y.distanceKm);
}
console.error(`υποψήφια κελιά ${work.reduce((s, w) => s + (w.candidates?.length ?? 0), 0)} · δείγματα DEM ${demPoints.length}`);
const sampler = createElevationSampler({ cacheDir: path.join(root, '.tmp/sea-wind-cell-alternatives'), apiKey, demSource: 'open-meteo', refresh: REFRESH });
const elev = await sampler.fetchElevationsResumable(demPoints);
for (const w of work) for (const c of w.candidates ?? []) {
  let max = -Infinity, land = 0;
  for (const i of c.sampleIdx) { const m = elev[i] ?? 0; if (m > max) max = m; if (m > 2) land += 1; }
  c.pathMaxElevM = Math.max(0, Math.round(max));
  c.landShare = Math.round(land / c.sampleIdx.length * 100) / 100;
  c.passesRelief = c.pathMaxElevM < LOW_M;
  delete c.sampleIdx;
}

// ── 3. Επιλογή + επαλήθευση echo στο κέντρο του κελιού (ως 3 γύροι) ─────────────────────────
for (const w of work) if (!w.skipped) { w.queue = w.candidates.filter(c => c.passesRelief); w.chosen = null; w.rejectedEcho = []; }
for (let round = 0; round < 3; round++) {
  const pending = work.filter(w => !w.skipped && !w.chosen && w.queue.length);
  if (!pending.length) break;
  const heads = pending.map(w => ({ beachId: w.target.beachId, cand: w.queue[0], lat: w.queue[0].lat, lon: w.queue[0].lon }));
  console.error(`γύρος echo ${round + 1}: ${heads.length} κέντρα κελιών`);
  const rows = await probeSea(heads);
  heads.forEach((h, i) => {
    const w = work.find(x => x.target.beachId === h.beachId);
    const echoKey = cellKeyOf(rows[i]);
    const delta = Math.max(Math.abs(rows[i].latitude - h.lat), Math.abs(rows[i].longitude - h.lon));
    const c = w.queue.shift();
    if (echoKey === c.cell && delta <= ECHO_TOLERANCE_DEG) { w.chosen = { ...c, echo: { lat: rows[i].latitude, lon: rows[i].longitude, deltaDeg: Math.round(delta * 1e4) / 1e4 } }; }
    else w.rejectedEcho.push({ cell: c.cell, echoed: echoKey, deltaDeg: Math.round(delta * 1e4) / 1e4 });
  });
}

// ── 4. Αναφορά + ledger ────────────────────────────────────────────────────────────────────
const verifiedAt = new Date().toISOString();
const overrides = [], unresolved = [], rowsOut = [];
for (const w of work) {
  if (w.skipped) { rowsOut.push({ beachId: w.target.beachId, skipped: w.skipped }); continue; }
  const base = { beachId: w.target.beachId, name: w.target.name, region: w.target.region, excludedCell: w.target.cell, excludedBearingDeg: w.excludedBearing, maxElevM: w.target.maxElevM, maxElevAtKm: w.target.maxElevAtKm, currentBaked: w.currentBaked, bakedMatchesExcluded: w.currentBaked === w.target.cell, facingDeg: w.profile?.facingDeg ?? null };
  const tried = w.candidates.map(c => ({ cell: c.cell, distanceKm: c.distanceKm, bearingDeg: c.bearingDeg, pathMaxElevM: c.pathMaxElevM, landShare: c.landShare, fetchKmAtBearing: c.fetchKmAtBearing, geometricTrust: c.geometricTrust, passesRelief: c.passesRelief, via: c.firstProbe.via, probeKm: c.firstProbe.km }));
  rowsOut.push({ ...base, probes: w.probes.length, candidates: tried, rejectedEcho: w.rejectedEcho, chosen: w.chosen ? { cell: w.chosen.cell, distanceKm: w.chosen.distanceKm, pathMaxElevM: w.chosen.pathMaxElevM, via: w.chosen.firstProbe.via } : null });
  if (w.chosen) {
    overrides.push({ beachId: base.beachId, name: base.name, region: base.region, excludedCell: base.excludedCell, reason: `relief≥${HIGH_M}m`, maxElevM: base.maxElevM, maxElevAtKm: base.maxElevAtKm,
      chosenCell: w.chosen.cell, chosenBy: 'probe', probe: { lat: w.chosen.firstProbe.probeLat ?? w.chosen.firstProbe.lat, lon: w.chosen.firstProbe.probeLon ?? w.chosen.firstProbe.lon, bearingDeg: w.chosen.firstProbe.bearingDeg, km: w.chosen.firstProbe.km, via: w.chosen.firstProbe.via },
      pathMaxElevM: w.chosen.pathMaxElevM, chosenDistanceKm: w.chosen.distanceKm, fetchKmAtBearing: w.chosen.fetchKmAtBearing, geometricTrust: w.chosen.geometricTrust ? 'trusted' : 'short-fetch', echo: w.chosen.echo, candidatesTried: w.candidates.length, verifiedAt });
  } else {
    unresolved.push({ beachId: base.beachId, name: base.name, region: base.region, excludedCell: base.excludedCell, keptCell: base.excludedCell, maxElevM: base.maxElevM, reason: w.candidates.length ? (w.candidates.some(c => c.passesRelief) ? 'κανένα κελί δεν απάντησε τον εαυτό του (echo)' : `κανένας υποψήφιος με διαδρομή <${LOW_M} μ.`) : 'κανένα διαφορετικό κελί σε 6 χλμ', candidatesTried: w.candidates.length, bestPathMaxElevM: w.candidates.length ? Math.min(...w.candidates.map(c => c.pathMaxElevM)) : null });
  }
}
const chosenCells = new Set(overrides.map(o => o.chosenCell));
const alreadyUsed = [...chosenCells].filter(k => Object.values(baked.cells ?? {}).includes(k)).length;
const summary = { targets: targets.length, resolved: overrides.length, unresolved: unresolved.length, distinctChosenCells: chosenCells.size, chosenCellsAlreadyInMap: alreadyUsed, medianChosenDistanceKm: overrides.length ? overrides.map(o => o.chosenDistanceKm).sort((a, b) => a - b)[Math.floor(overrides.length / 2)] : null, probes: allProbes.length, demSamples: demPoints.length };
mkdirSync(path.dirname(path.resolve(root, outPath)), { recursive: true });
writeFileSync(path.resolve(root, outPath), JSON.stringify({ generatedAt: verifiedAt, input: inputPath, rule: `κοντινότερο κελί που απαντά η πόρτα cell_selection=sea σε σημεία 1-6 χλμ προς τη θάλασσα, με μέγιστο υψόμετρο διαδρομής παραλία→κελί < ${LOW_M} μ. (DEM ${sampler.demSource}, βήμα ${STEP_KM} χλμ) και echo ≤ ${ECHO_TOLERANCE_DEG}° στο κέντρο του`, summary, rows: rowsOut }, null, 2), 'utf8');
if (WRITE) {
  const ledger = { schemaVersion: 1, generatedAt: verifiedAt, purpose: 'Δ9-Α (13/09/2026): κελιά ανέμου θάλασσας με στεριά ≥200 μ. ανάμεσα στην παραλία και στο κέντρο τους (reports/quality/sea-wind-cell-relief-2026-09-13.json high[]) ξαναδείχνουν στο επόμενο κελί που «βλέπει» η παραλία. Το διαβάζει το scripts/bakeSeaWindCells.mjs (--apply-overrides και πλήρες ψήσιμο)· το φυλάει το scripts/validateOverWaterWindLayer.mjs (τμήμα Η). Ανά παραλία, όχι ανά κελί.', rule: `διαδρομή παραλία→κελί με μέγιστο υψόμετρο < ${LOW_M} μ. (LOW_M του audit), κοντινότερο κελί που απαντά η πόρτα, echo στο κέντρο ≤ ${ECHO_TOLERANCE_DEG}°`, sourceReport: inputPath, alternativesReport: outPath, overrides, unresolved };
  writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}
console.log(`=== Δ9-Α εναλλακτικά κελιά: ${summary.resolved}/${summary.targets} βρέθηκαν, ${summary.unresolved} χωρίς (κρατούν το παλιό) · ${summary.distinctChosenCells} νέα κελιά (${alreadyUsed} ήδη στον χάρτη) · διάμεση απόσταση ${summary.medianChosenDistanceKm} χλμ`);
for (const u of unresolved.slice(0, 12)) console.log(`  ΧΩΡΙΣ: #${u.beachId} ${u.name} (${u.region}) — ${u.reason}, καλύτερη διαδρομή ${u.bestPathMaxElevM ?? '–'} μ.`);
console.log(`Αναφορά: ${outPath}${WRITE ? `\nLedger: ${path.relative(root, LEDGER)}` : '\n(dry-run· --write για το ledger)'}`);
