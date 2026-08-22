/**
 * ΤΟ ΚΕΛΙ ΕΙΝΑΙ ΣΕ ΑΛΛΗ ΘΑΛΑΣΣΑ, Ή ΑΠΛΩΣ ΠΙΣΩ ΑΠΟ ΕΝΑ ΑΚΡΩΤΗΡΙ; (22/08/2026)
 *
 * ΤΟ ΕΡΩΤΗΜΑ. 255 παραλίες κόβονται από τον έλεγχο εμπιστοσύνης
 * (`scripts/lib/marineCellTrust.mjs`) με κανόνα **ευθείας γραμμής**:
 *
 *     fetchKm(παραλία → κελί) >= 0,8 × απόσταση(παραλία, κελί)
 *
 * Δηλαδή «η ακτίνα προς το κελί χτύπησε στεριά». Αλλά η ίδια η βίβλος έχει ήδη καταγράψει, όταν
 * έπεσε το πρώτο σχέδιο του γεωμετρικού ταβανιού, ότι **«οι ακτίνες ταξιδεύουν σε ευθεία, η
 * θάλασσα όχι»**: το κύμα μπαίνει από το στόμιο ενός κόλπου και απλώνεται σε γωνίες που καμία
 * ευθεία δεν συνδέει με ανοιχτό νερό. Ο ίδιος συλλογισμός ισχύει αντίστροφα εδώ — ένα κελί πίσω
 * από ένα ακρωτήρι μπορεί κάλλιστα να είναι **η ίδια θάλασσα**.
 *
 * ΑΡΑ ΤΟ ΣΩΣΤΟ ΕΡΩΤΗΜΑ ΔΕΝ ΕΙΝΑΙ «ΒΛΕΠΕΙ Η ΠΑΡΑΛΙΑ ΤΟ ΚΕΛΙ» αλλά «**φτάνει νερό από το κελί
 * στην παραλία, και πόσο στραβά**». Αυτό μετριέται με πλημμύρισμα πάνω στην ΙΔΙΑ ακτογραμμή που
 * χρησιμοποιεί το `scripts/auditEnclosedWater.mjs` (`scripts/lib/coastlineMask.mjs`), όχι με νέα
 * πηγή και όχι με εικασία.
 *
 * ΤΙ ΒΓΑΖΕΙ. Για κάθε μη έμπιστη παραλία: είναι το σερβιρισμένο κελί προσβάσιμο με νερό; σε πόσα
 * χλμ διαδρομής; και πόσο μεγαλύτερη είναι αυτή η διαδρομή από την ευθεία («στράβωμα»).
 *
 * ⚠️ ΧΩΡΙΣ ΜΑΡΤΥΡΑ ΕΛΕΓΧΟΥ ΤΟ ΝΟΥΜΕΡΟ ΔΕΝ ΣΗΜΑΙΝΕΙ ΤΙΠΟΤΑ. Το ίδιο τρέχει και σε ισάριθμο δείγμα
 * ΕΜΠΙΣΤΩΝ παραλιών, αλλιώς δεν ξέρουμε αν το στράβωμα 1,5 είναι παθολογία ή κανονικότητα.
 *
 * ΔΕΝ ΑΛΛΑΖΕΙ ΤΙΠΟΤΑ. Report-only, χωρίς δίκτυο, χωρίς εγγραφή σε δεδομένα παραγωγής.
 *
 * Run: node scripts/measureMarineCellReachability.mjs [--cell-m 250] [--limit N]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMask, makeIsLand, destination } from './lib/coastlineMask.mjs';
// Η διαδρομή νερού ζει στη βιβλιοθήκη (22/08/2026) — ίδιο ράστερ, μία υλοποίηση.
import { waterPathKm as routeWaterPathKm, DEFAULT_MAX_TRAVEL_KM } from './lib/enclosureWitness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const numArg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};

const CELL_M = numArg('--cell-m', 250);
const LIMIT = numArg('--limit', Infinity);
/** Πέρα από αυτό δεν έχει νόημα: ο ίδιος ο έλεγχος εμπιστοσύνης κόβει στα 25 χλμ. */
const MAX_TRAVEL_KM = DEFAULT_MAX_TRAVEL_KM;

const trust = JSON.parse(readFileSync(path.join(root, 'reports/quality/marine-cell-trust-per-beach.json'), 'utf8'));
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const profiles = new Map();
for (const file of readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  const doc = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  for (const p of Object.values(doc.profiles ?? {})) {
    if (p?.beachId != null) profiles.set(p.beachId, { ...p, regionId: file.replace(/\.json$/, '') });
  }
}

console.error('Φόρτωση ακτογραμμής…');
const mask = loadMask();
const isLand = makeIsLand(mask);
console.error(`Μάσκα: ${mask.polys.length} πολύγωνα.`);


const measure = (row) => {
  const profile = profiles.get(row.beachId);
  if (!profile?.coordinates) return null;
  if (typeof row.distanceKm !== 'number' || typeof row.bearingDeg !== 'number') return null;

  const { lat, lon } = profile.coordinates;
  const cell = destination(lat, lon, row.bearingDeg, row.distanceKm);
  const result = routeWaterPathKm(isLand, lat, lon, cell.lat, cell.lon, { cellM: CELL_M });
  const detour = result.path != null && result.straight > 0
    ? Number((result.path / result.straight).toFixed(2))
    : null;
  return {
    beachId: row.beachId,
    region: row.region,
    name: row.name,
    verdict: row.verdict,
    via: row.via,
    straightKm: Number(result.straight.toFixed(2)),
    waterPathKm: result.path,
    detour,
    why: result.why,
  };
};

const untrusted = trust.filter(r => r.verdict !== 'trusted' && typeof r.distanceKm === 'number');
// Μάρτυρας ελέγχου: ισάριθμες ΕΜΠΙΣΤΕΣ, δειγματοληπτημένες ομοιόμορφα ώστε να μην είναι όλες
// από τα ίδια νησιά.
const trusted = trust.filter(r => r.verdict === 'trusted' && typeof r.distanceKm === 'number');
const stride = Math.max(1, Math.floor(trusted.length / untrusted.length));
const control = trusted.filter((_, i) => i % stride === 0).slice(0, untrusted.length);

const run = (rows, label) => {
  const out = [];
  for (const [i, row] of rows.entries()) {
    if (i >= LIMIT) break;
    if (i % 25 === 0) process.stderr.write(`\r  ${label} ${i}/${Math.min(rows.length, LIMIT)}…      `);
    const r = measure(row);
    if (r) out.push(r);
  }
  process.stderr.write(`\r                                             \r`);
  return out;
};

const badRows = run(untrusted, 'μη έμπιστες');
const goodRows = run(control, 'έμπιστες (μάρτυρας)');

const summarise = (rows) => {
  const reached = rows.filter(r => r.detour != null);
  const detours = reached.map(r => r.detour).sort((a, b) => a - b);
  const q = (p) => (detours.length ? detours[Math.floor(detours.length * p)] : null);
  const buckets = { 'ίδια θάλασσα (≤1,3)': 0, 'γύρω από ακρωτήρι (1,3-2,5)': 0, 'μακρύς γύρος (>2,5)': 0, 'χωρίς δρόμο': 0 };
  for (const r of rows) {
    if (r.detour == null) buckets['χωρίς δρόμο'] += 1;
    else if (r.detour <= 1.3) buckets['ίδια θάλασσα (≤1,3)'] += 1;
    else if (r.detour <= 2.5) buckets['γύρω από ακρωτήρι (1,3-2,5)'] += 1;
    else buckets['μακρύς γύρος (>2,5)'] += 1;
  }
  return {
    n: rows.length,
    reached: reached.length,
    detourP50: q(0.5),
    detourP90: q(0.9),
    buckets,
    noPathReasons: rows.filter(r => r.detour == null)
      .reduce((acc, r) => { acc[r.why ?? '—'] = (acc[r.why ?? '—'] ?? 0) + 1; return acc; }, {}),
  };
};

const report = {
  measuredAt: new Date().toISOString(),
  cellM: CELL_M,
  maxTravelKm: MAX_TRAVEL_KM,
  untrusted: summarise(badRows),
  trustedControl: summarise(goodRows),
  rows: badRows,
};

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
const outPath = path.join(root, 'reports/quality/marine-cell-reachability.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const show = (label, s) => {
  console.log(`\n${label}: ${s.n} παραλίες, ${s.reached} με δρόμο μέσα από νερό`);
  console.log(`  στράβωμα διαδρομής: διάμεσος ${s.detourP50 ?? '—'} · p90 ${s.detourP90 ?? '—'}`);
  for (const [k, v] of Object.entries(s.buckets)) console.log(`    ${k}: ${v}`);
  if (Object.keys(s.noPathReasons).length) console.log(`    αιτίες χωρίς δρόμο: ${JSON.stringify(s.noPathReasons, null, 0)}`);
};
show('ΜΗ ΕΜΠΙΣΤΕΣ', report.untrusted);
show('ΕΜΠΙΣΤΕΣ (μάρτυρας ελέγχου)', report.trustedControl);
console.log(`\nΑναφορά: ${path.relative(root, outPath)}`);
