// Δ9 — ΔΕΥΤΕΡΟΣ ΕΛΕΓΧΟΣ ΤΩΝ 528 ΚΕΛΙΩΝ ΑΝΕΜΟΥ «ΠΙΣΩ ΑΠΟ ΣΤΕΡΙΑ»: ΠΟΣΟ ΨΗΛΗ ΕΙΝΑΙ Η ΣΤΕΡΙΑ; (13/09/2026)
//
// Ο πρώτος έλεγχος (scripts/auditSeaWindCellTrust.mjs → reports/quality/sea-wind-cell-trust.json)
// βρήκε 528/1.833 κελιά ανέμου θάλασσας που η παραλία δεν «βλέπει» με το γεωμετρικό κριτήριο
// του κύματος (fetch στο bearing ≥ 0,8 × απόσταση). Για το ΚΥΜΑ η στεριά ανάμεσα σβήνει τα πάντα·
// για τον ΑΝΕΜΟ μετράει μόνο αν είναι ψηλή: ένα ακρωτήρι 20 μ. δεν αλλάζει τον αέρα στα 10 μ.
// ύψος, ένα βουνό 400 μ. ναι. Άρα εδώ: δείγματα DEM κάθε 500 μ. κατά μήκος της ευθείας
// παραλία → κελί, και για κάθε κελί το ΜΕΓΙΣΤΟ υψόμετρο της διαδρομής, πού πέφτει, και πόσο
// από τη διαδρομή είναι στεριά. Τρεις κάδοι, ώστε η απόφαση να πέσει πάνω σε αριθμό:
//   low  (<50 μ.)   — χαμηλή στεριά/ακρωτήρι: ο αέρας περνάει, το κελί ΜΕΝΕΙ
//   mid  (50-200)   — λόφος: θέλει μάτι
//   high (≥200 μ.)  — βουνό: το κελί μάλλον περιγράφει άλλον αέρα → υποψήφιο για εξαίρεση στο ξαναψήσιμο
// Ίδιο DEM με τον δάπεδο ριπής (Open-Meteo elevation, 90 μ.) μέσα από το κοινό εργαλείο
// scripts/lib/upwindDem.mjs — ΟΧΙ νέο αντίγραφο δειγματολήπτη.
//
//   node scripts/auditSeaWindCellRelief.mjs [--input reports/quality/sea-wind-cell-trust.json]
//        [--out reports/quality/sea-wind-cell-relief-<σήμερα>.json] [--stepKm=0.5] [--refresh]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElevationSampler, destinationPoint } from './lib/upwindDem.mjs';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); if (hit) return hit.slice(name.length + 1); const i = process.argv.indexOf(name); return i === -1 ? fallback : process.argv[i + 1]; };
const today = new Date().toISOString().slice(0, 10);
const inputPath = argVal('--input', 'reports/quality/sea-wind-cell-trust.json');
const outPath = argVal('--out', `reports/quality/sea-wind-cell-relief-${today}.json`);
const STEP_KM = Number(argVal('--stepKm', '0.5'));
const REFRESH = process.argv.includes('--refresh');
const LOW_M = 50, HIGH_M = 200, LAND_M = 2;

const trust = JSON.parse(readFileSync(path.resolve(root, inputPath), 'utf8'));
const suspects = trust.suspects ?? [];
if (!suspects.length) { console.error('Καμία ύποπτη εγγραφή στην είσοδο.'); process.exit(1); }

// Συντεταγμένες παραλιών από τα ίδια αρχεία που διαβάζει η σελίδα.
const appDir = path.join(root, 'public/data/beaches/app');
const beachCoords = new Map();
for (const s of suspects) {
  if (beachCoords.has(`${s.region}|${s.beachId}`)) continue;
  const app = JSON.parse(readFileSync(path.join(appDir, `${s.region}.json`), 'utf8'));
  for (const b of app?.island?.beaches ?? []) beachCoords.set(`${s.region}|${b.id}`, b.coordinates);
}

// Bearing & ενδιάμεσα σημεία πάνω στον μεγάλο κύκλο (η απόσταση ≤25 χλμ, η ευθεία αρκεί).
const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
const bearingTo = (a, b) => {
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat), Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};
const haversineKm = (a, b) => {
  const R = 6371, dφ = toRad(b.lat - a.lat), dλ = toRad(b.lon - a.lon);
  const h = Math.sin(dφ / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dλ / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const routes = [];
const points = [];
for (const s of suspects) {
  const beach = beachCoords.get(`${s.region}|${s.beachId}`);
  const [clat, clon] = String(s.cell).split('_').map(Number);
  if (!beach || !Number.isFinite(clat) || !Number.isFinite(clon)) { routes.push({ ...s, skipped: 'χωρίς συντεταγμένες' }); continue; }
  const cell = { lat: clat, lon: clon };
  const distKm = haversineKm(beach, cell);
  const brg = bearingTo(beach, cell);
  const n = Math.max(2, Math.round(distKm / STEP_KM));
  const idx = [];
  // Από 0,25 χλμ (όχι η ίδια η παραλία, που είναι στη στάθμη της θάλασσας) ως το κελί.
  for (let i = 0; i <= n; i++) {
    const d = Math.min(distKm, 0.25 + i * STEP_KM);
    idx.push(points.length);
    points.push(destinationPoint(beach, brg, d));
    if (d >= distKm) break;
  }
  routes.push({ ...s, beach, cellPoint: cell, routeKm: Math.round(distKm * 100) / 100, routeBearingDeg: Math.round(brg), sampleIdx: idx });
}

const apiKey = await resolveOpenMeteoKey();
const cacheDir = path.join(root, '.tmp/sea-wind-cell-relief');
const sampler = createElevationSampler({ cacheDir, apiKey, demSource: 'open-meteo', refresh: REFRESH });
console.error(`διαδρομές ${routes.filter(r => !r.skipped).length} · δείγματα DEM ${points.length} · βήμα ${STEP_KM} χλμ · DEM ${sampler.demSource}`);
const elev = await sampler.fetchElevationsResumable(points);

const bucketOf = (m) => (m >= HIGH_M ? 'high' : m >= LOW_M ? 'mid' : 'low');
const rows = [];
for (const r of routes) {
  if (r.skipped) { rows.push(r); continue; }
  const samples = r.sampleIdx.map(i => ({ km: Math.round((0.25 + (i - r.sampleIdx[0]) * STEP_KM) * 100) / 100, m: elev[i] ?? 0 }));
  let max = { km: 0, m: -Infinity };
  let land = 0;
  for (const s of samples) { if (s.m > max.m) max = s; if (s.m > LAND_M) land += 1; }
  const maxElevM = Math.max(0, Math.round(max.m));
  rows.push({
    beachId: r.beachId, name: r.name, region: r.region, cell: r.cell, distanceKm: r.distanceKm, bearingDeg: r.bearingDeg,
    routeKm: r.routeKm, samples: samples.length, maxElevM, maxElevAtKm: max.km, landShare: Math.round(land / samples.length * 100) / 100,
    bucket: bucketOf(maxElevM),
  });
}

const counts = { low: 0, mid: 0, high: 0, skipped: 0 };
const byRegion = {};
for (const row of rows) {
  if (row.skipped) { counts.skipped += 1; continue; }
  counts[row.bucket] += 1;
  const reg = byRegion[row.region] || (byRegion[row.region] = { low: 0, mid: 0, high: 0 });
  reg[row.bucket] += 1;
}
const high = rows.filter(r => r.bucket === 'high').sort((a, b) => b.maxElevM - a.maxElevM);
const regionsByHigh = Object.entries(byRegion).filter(([, v]) => v.high > 0).sort((a, b) => b[1].high - a[1].high);

mkdirSync(path.dirname(path.resolve(root, outPath)), { recursive: true });
writeFileSync(path.resolve(root, outPath), JSON.stringify({
  generatedAt: new Date().toISOString(), input: inputPath, stepKm: STEP_KM, dem: `${sampler.demSource} (ίδιο με τον δάπεδο ριπής)`,
  thresholds: { lowBelowM: LOW_M, highFromM: HIGH_M, landAboveM: LAND_M },
  rule: 'μέγιστο υψόμετρο DEM κατά μήκος της ευθείας παραλία→κελί (από 0,25 χλμ ως το κελί)· low = ο αέρας περνάει, το κελί μένει· high = βουνό ανάμεσα, υποψήφιο για εξαίρεση στο ξαναψήσιμο (bakeSeaWindCells)',
  counts, byRegion, high, rows,
}, null, 2), 'utf8');

console.log(`=== Δ9 ΔΕΥΤΕΡΟΣ ΕΛΕΓΧΟΣ — ${rows.length} κελιά «πίσω από στεριά», DEM ${sampler.demSource}, βήμα ${STEP_KM} χλμ ===`);
console.log(`  low (<${LOW_M} μ.): ${counts.low} · mid (${LOW_M}-${HIGH_M}): ${counts.mid} · high (≥${HIGH_M} μ.): ${counts.high} · χωρίς συντεταγμένες: ${counts.skipped}`);
console.log(`  περιοχές με «high»: ${regionsByHigh.slice(0, 12).map(([k, v]) => `${k} ${v.high}`).join(' · ')}`);
for (const r of high.slice(0, 25)) console.log(`  HIGH #${r.beachId} ${r.name} (${r.region}) κελί ${r.cell} ${r.routeKm} χλμ: μέγιστο ${r.maxElevM} μ. στα ${r.maxElevAtKm} χλμ, στεριά ${Math.round(r.landShare * 100)}%`);
console.log(`\nΑναφορά: ${outPath}`);
