/**
 * ΠΟΣΟ ΑΛΛΑΖΕΙ ΤΟ ΚΥΜΑ ΑΝ Η ΠΑΡΑΛΙΑ ΔΙΑΛΕΞΕΙ ΤΟ ΜΟΝΤΕΛΟ ΠΟΥ ΒΛΕΠΕΙ ΤΗ ΘΑΛΑΣΣΑ ΤΗΣ.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΓΕΝΝΗΣΕ (17/08/2026). Ρωτάμε δύο μοντέλα και κρατάμε «όποιο απαντήσει
 * πρώτο» — ewam, μετά meteofrance_wave (`utils/marineForecastParsing.ts`). Κανείς δεν ρώτησε
 * ποτέ αν το δεύτερο κοιτάζει ΚΑΛΥΤΕΡΗ θάλασσα. Μετρήθηκε offline: για 68 από τις 255
 * αναξιόπιστες, το κελί του meteofrance_wave είναι κελί που η παραλία όντως βλέπει, ενώ του
 * ewam όχι. Παράδοξο μόνο φαινομενικά: το meteofrance έχει ΧΟΝΤΡΟΤΕΡΟ πλέγμα (0,0833° έναντι
 * 0,05°) αλλά τα κελιά του πέφτουν αλλού — καμιά φορά μπροστά στην παραλία αντί πίσω από τον
 * βράχο. Δεν μετράει μόνο πόσο λεπτό είναι το πλέγμα· μετράει και πού πέφτει.
 *
 * ΓΙΑΤΙ ΔΕΝ ΑΡΚΕΙ ΤΟ «68 ΓΙΝΟΝΤΑΙ ΑΞΙΟΠΙΣΤΕΣ». Η αλλαγή ΔΕΝ είναι μονόδρομη: άλλο μοντέλο
 * σημαίνει άλλο νούμερο, προς τα πάνω Η προς τα κάτω. Κατά τη σκανδάλη #1 της §9, ό,τι κατεβάζει
 * ύψος κύματος θέλει μέτρηση ΠΡΙΝ και απόφαση Μίλτου. Αυτό το αρχείο δίνει ακριβώς αυτό το
 * νούμερο: σε πόσες ώρες×παραλία πέφτει το κύμα, πόσο, και πόσες φορές αρκετά ώστε να το δει ο
 * επισκέπτης.
 *
 * ΔΩΡΕΑΝ ΠΛΑΝΟ ΕΠΙΤΗΔΕΣ. Είναι 68 σημεία × 2 μοντέλα = 6 αιτήματα σε παρτίδες των 32. Το
 * πληρωμένο πακέτο υπάρχει για τις ΕΘΝΙΚΕΣ σαρώσεις των 2.800 παραλιών· μια μέτρηση αυτού του
 * μεγέθους δεν έχει λόγο να το ξοδεύει.
 *
 * ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ. Μόνο μετράει και γράφει αναφορά.
 *
 * Τρέξιμο:  node scripts/measureAlternateMarineModel.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODELS, cacheKey, distanceKm, bearingDeg, interpolatedFetchKm,
  MIN_FETCH_RATIO, MAX_TRUSTED_DISTANCE_KM,
} from './lib/marineCellTrust.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const cachePath = path.join(root, '.tmp/marine-cell-snap-cache-v2.json');
const ledgerPath = path.join(root, 'reports/quality/marine-cell-trust-per-beach.json');
const reportPath = path.join(root, 'reports/quality/alternate-marine-model.json');

/** Πόσο πρέπει να αλλάξει το ύψος για να το προσέξει άνθρωπος στην κάρτα. */
const VISIBLE_DELTA_M = 0.2;
const DAYS = 6;

const cache = JSON.parse(readFileSync(cachePath, 'utf8'));
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));

const profiles = new Map();
const regionPoint = new Map();
for (const file of readdirSync(exposureDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const payload = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  for (const p of Object.values(payload.profiles ?? {})) if (p?.beachId != null) profiles.set(p.beachId, p);
  try {
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    for (const b of app.island.beaches) regionPoint.set(b.id, app.island.coordinates);
  } catch { /* περιοχή χωρίς app αρχείο */ }
}

/** Ο έλεγχος εμπιστοσύνης για ΣΥΓΚΕΚΡΙΜΕΝΟ μοντέλο (το judge() κρίνει «όποιο απαντήσει πρώτο»). */
const judgeModel = (profile, point, model) => {
  const served = cache[cacheKey(model.id, model.gridDeg, point.lat, point.lon)];
  if (!served || !(served.values > 0)) return null;
  const { lat, lon } = profile.coordinates;
  const d = distanceKm(lat, lon, served.lat, served.lon);
  if (d < 0.5) return { trusted: true, distanceKm: d };
  const brg = bearingDeg(lat, lon, served.lat, served.lon);
  const fetchKm = interpolatedFetchKm(profile.sectors, brg);
  if (fetchKm === null) return null;
  if (d > MAX_TRUSTED_DISTANCE_KM) return { trusted: false, distanceKm: d };
  return { trusted: fetchKm >= MIN_FETCH_RATIO * d, distanceKm: d, fetchKm };
};

// ── Ποιες παραλίες κερδίζουν από την αλλαγή, και σε ποιο μοντέλο ─────────────
const candidates = [];
for (const entry of ledger.filter(b => !b.trusted)) {
  const profile = profiles.get(entry.beachId);
  const point = profile?.marineSamplePoint ?? regionPoint.get(entry.beachId);
  if (!profile || !point) continue;
  const verdicts = MODELS.map(m => ({ model: m.id, ...(judgeModel(profile, point, m) ?? { trusted: false }) }));
  const winner = verdicts.find(v => v.trusted);
  const current = verdicts.find(v => v.model === entry.model) ?? verdicts[0];
  if (!winner || winner.model === entry.model) continue;
  candidates.push({
    beachId: entry.beachId, name: entry.name, region: entry.region, point,
    currentModel: entry.model, altModel: winner.model,
    currentDistanceKm: current?.distanceKm ?? null, altDistanceKm: winner.distanceKm,
  });
}
console.log(`υποψήφιες: ${candidates.length} παραλίες όπου άλλο μοντέλο βλέπει τη σωστή θάλασσα`);
if (!candidates.length) process.exit(0);

// ── Ζωντανά ύψη κύματος, ανά μοντέλο, ΔΩΡΕΑΝ πλάνο ──────────────────────────
const fetchModel = async (points, modelId) => {
  const out = new Map();
  for (let i = 0; i < points.length; i += 32) {
    const batch = points.slice(i, i + 32);
    const url = 'https://marine-api.open-meteo.com/v1/marine'
      + `?latitude=${batch.map(p => p.lat).join(',')}`
      + `&longitude=${batch.map(p => p.lon).join(',')}`
      + '&hourly=wave_height&timezone=Europe%2FAthens'
      + `&forecast_days=${DAYS}&cell_selection=sea&models=${modelId}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${modelId}: ${res.status} ${res.statusText}`);
    const json = await res.json();
    const rows = Array.isArray(json) ? json : [json];
    rows.forEach((row, idx) => out.set(i + idx, row?.hourly?.wave_height ?? []));
    process.stderr.write(`\r  ${modelId}: ${Math.min(i + 32, points.length)}/${points.length}   `);
  }
  process.stderr.write('\r                                        \r');
  return out;
};

const points = candidates.map(c => c.point);
const currentSeries = await fetchModel(points, 'ewam');
const altSeries = await fetchModel(points, 'meteofrance_wave');

// ── Σύγκριση ώρα προς ώρα ───────────────────────────────────────────────────
const totals = { beaches: 0, hours: 0, down: 0, up: 0, same: 0, visibleDown: 0, visibleUp: 0 };
const rows = [];
candidates.forEach((c, idx) => {
  const a = currentSeries.get(idx) ?? [];
  const b = altSeries.get(idx) ?? [];
  const deltas = [];
  for (let h = 0; h < Math.min(a.length, b.length); h += 1) {
    if (typeof a[h] !== 'number' || typeof b[h] !== 'number') continue;
    deltas.push(Number((b[h] - a[h]).toFixed(3)));
  }
  if (!deltas.length) return;
  totals.beaches += 1;
  totals.hours += deltas.length;
  deltas.forEach(d => {
    if (d < -0.001) totals.down += 1; else if (d > 0.001) totals.up += 1; else totals.same += 1;
    if (d <= -VISIBLE_DELTA_M) totals.visibleDown += 1;
    if (d >= VISIBLE_DELTA_M) totals.visibleUp += 1;
  });
  const sorted = [...deltas].sort((x, y) => x - y);
  rows.push({
    beachId: c.beachId, name: c.name, region: c.region,
    from: c.currentModel, to: c.altModel,
    cellKmBefore: c.currentDistanceKm == null ? null : Number(c.currentDistanceKm.toFixed(1)),
    cellKmAfter: Number(c.altDistanceKm.toFixed(1)),
    medianDeltaM: sorted[Math.floor(sorted.length / 2)],
    minDeltaM: sorted[0], maxDeltaM: sorted[sorted.length - 1],
  });
});

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const medians = rows.map(r => r.medianDeltaM).sort((a, b) => a - b);

console.log('');
console.log('ΤΙ ΑΛΛΑΖΕΙ ΑΝ Η ΠΑΡΑΛΙΑ ΔΙΑΛΕΞΕΙ ΤΟ ΜΟΝΤΕΛΟ ΠΟΥ ΤΗ ΒΛΕΠΕΙ');
console.log(`  παραλίες                 ${totals.beaches}`);
console.log(`  ώρες×παραλία             ${totals.hours}`);
console.log(`  το κύμα ΠΕΦΤΕΙ           ${totals.down} · ${pct(totals.down, totals.hours)}`);
console.log(`  το κύμα ΑΝΕΒΑΙΝΕΙ        ${totals.up} · ${pct(totals.up, totals.hours)}`);
console.log(`  ορατή πτώση (≥0,2 μ.)    ${totals.visibleDown} · ${pct(totals.visibleDown, totals.hours)}`);
console.log(`  ορατή άνοδος (≥0,2 μ.)   ${totals.visibleUp} · ${pct(totals.visibleUp, totals.hours)}`);
console.log(`  διάμεση μεταβολή παραλίας ${medians.length ? medians[Math.floor(medians.length / 2)] : '—'} μ.`);
console.log('');
console.log('  μεγαλύτερες πτώσεις (η επικίνδυνη κατεύθυνση):');
[...rows].sort((a, b) => a.minDeltaM - b.minDeltaM).slice(0, 8).forEach(r =>
  console.log(`    #${String(r.beachId).padEnd(5)} ${r.name.padEnd(26)} διάμεση ${String(r.medianDeltaM).padStart(6)} μ · χειρότερη ${String(r.minDeltaM).padStart(6)} μ · κελί ${r.cellKmBefore}→${r.cellKmAfter} χλμ`));

mkdirSync(path.dirname(reportPath), { recursive: true });
writeFileSync(reportPath, `${JSON.stringify({
  question: 'Αν κάθε παραλία διάλεγε το μοντέλο του οποίου το κελί όντως βλέπει, αντί για «όποιο απαντήσει πρώτο», πόσο και προς τα πού αλλάζει το ύψος κύματος που της δείχνουμε;',
  oneDirectional: 'ΟΧΙ — άλλο μοντέλο σημαίνει άλλο νούμερο, πάνω ή κάτω. Γι\' αυτό μετριέται πριν γραφτεί γραμμή.',
  tier: 'ΔΩΡΕΑΝ Open-Meteo: 68 σημεία × 2 μοντέλα, το πληρωμένο φυλάγεται για τις εθνικές σαρώσεις.',
  days: DAYS, visibleDeltaM: VISIBLE_DELTA_M, totals, rows,
}, null, 2)}\n`, 'utf8');
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
