#!/usr/bin/env node
/**
 * ΤΟ ΚΕΛΙ ΑΝΕΜΟΥ ΘΑΛΑΣΣΑΣ — ΒΛΕΠΕΙ ΤΗ ΣΩΣΤΗ ΘΑΛΑΣΣΑ; (12/09/2026, βίβλος §Γ81 Δ9) — ΜΕΤΡΗΣΗ, ΟΧΙ ΑΛΛΑΓΗ.
 *
 * ΤΙ ΚΡΙΝΕΤΑΙ. Για 1.833 παραλίες (στεριανό κελί ≥3 χλμ) η ταχύτητα ΚΑΙ η διεύθυνση του ανέμου έρχονται από
 * ένα κελί θάλασσας που διάλεξε το Open-Meteo (`cell_selection=sea`, scripts/bakeSeaWindCells.mjs) — χωρίς
 * κανέναν έλεγχο ότι το κελί κάθεται στο νερό που βλέπει η παραλία. Για το ΚΥΜΑ ο ίδιος έλεγχος υπάρχει
 * (scripts/lib/marineCellTrust.mjs, reports/quality/marine-cell-trust.json: 68 μη έμπιστα σε 2.873) και δεν
 * έτρεξε ποτέ για τον άνεμο. Κελί πίσω από ακρωτήρι ή σε άλλο κανάλι = άνεμος άλλου καθεστώτος, και προς τις
 * δύο κατευθύνσεις (ψεύτικη ηρεμία σε εκτεθειμένη που δανείζεται τον αέρα προστατευμένου κόλπου, και ανάποδα).
 *
 * ΤΙ ΚΑΝΕΙ. Ίδιο γεωμετρικό κριτήριο με τον έλεγχο κύματος: bearing παραλία → κέντρο κελιού, fetch της παραλίας
 * σε αυτό το bearing (interpolatedFetchKm από το προφίλ έκθεσης), απόσταση. «Έμπιστο» αν fetch ≥ 0,8 × απόσταση
 * και απόσταση ≤ 25 χλμ· «other-water» αν το νερό της παραλίας δεν φτάνει ως το κελί· «too-far» αν >25 χλμ. Δεν
 * κάνει τον έλεγχο «γύρω από ακρωτήρι με διαδρομή νερού» (waterWitness) — εκείνος θέλει τη μάσκα ακτογραμμής·
 * άρα το «other-water» εδώ είναι ΥΠΟΨΙΑ για δεύτερο έλεγχο, όχι απόδειξη.
 *
 * ΔΕΝ αλλάζει το ψημένο αρχείο. Γράφει reports/quality/sea-wind-cell-trust.json με τα πλήθη και τη λίστα.
 *   node scripts/auditSeaWindCellTrust.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { distanceKm, bearingDeg, interpolatedFetchKm, MIN_FETCH_RATIO, MAX_TRUSTED_DISTANCE_KM } from './lib/marineCellTrust.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baked = JSON.parse(readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8'));
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');

const profiles = new Map();
const beaches = new Map();
for (const file of readdirSync(exposureDir).filter(f => f.endsWith('.json') && f !== 'index.json')) {
  try {
    for (const p of Object.values(JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {})) {
      if (p?.beachId != null) profiles.set(p.beachId, p);
    }
    const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
    for (const b of app.island?.beaches ?? []) beaches.set(b.id, { name: b.name?.en ?? b.name?.gr ?? String(b.id), region: file.replace(/\.json$/, ''), lat: b.coordinates?.lat ?? b.lat, lon: b.coordinates?.lon ?? b.lng ?? b.lon });
  } catch { /* περιοχή χωρίς προφίλ */ }
}

const rows = [];
const counts = { trusted: 0, 'other-water': 0, 'too-far': 0, unknown: 0 };
for (const [id, cellKey] of Object.entries(baked.cells ?? {})) {
  const beachId = Number(id);
  const beach = beaches.get(beachId);
  const profile = profiles.get(beachId);
  const [cLat, cLon] = String(cellKey).split('_').map(Number);
  if (!beach || !Number.isFinite(beach.lat) || !Number.isFinite(cLat)) { counts.unknown += 1; rows.push({ beachId, verdict: 'unknown', why: 'no beach coords' }); continue; }
  const d = distanceKm(beach.lat, beach.lon, cLat, cLon);
  const brg = bearingDeg(beach.lat, beach.lon, cLat, cLon);
  const fetch = profile ? interpolatedFetchKm(profile.sectors, brg) : null;
  let verdict;
  if (fetch === null) verdict = 'unknown';
  else if (d > MAX_TRUSTED_DISTANCE_KM) verdict = 'too-far';
  else if (d < 0.5 || fetch >= MIN_FETCH_RATIO * d) verdict = 'trusted';
  else verdict = 'other-water';
  counts[verdict] += 1;
  rows.push({ beachId, name: beach.name, region: beach.region, cell: cellKey, distanceKm: Number(d.toFixed(2)), bearingDeg: Math.round(brg), fetchKmAtBearing: fetch === null ? null : Number(fetch.toFixed(2)), verdict });
}
const suspects = rows.filter(r => r.verdict !== 'trusted' && r.verdict !== 'unknown').sort((a, b) => (a.fetchKmAtBearing ?? 99) / (a.distanceKm || 1) - (b.fetchKmAtBearing ?? 99) / (b.distanceKm || 1));
const byRegion = {};
for (const r of suspects) byRegion[r.region] = (byRegion[r.region] || 0) + 1;

const report = {
  generatedAt: new Date().toISOString(), source: 'data/forecast-sea-cells.generated.json', bakedAt: baked.generatedAt,
  rule: `trusted: fetch(bearing προς το κελί) ≥ ${MIN_FETCH_RATIO} × απόσταση ΚΑΙ απόσταση ≤ ${MAX_TRUSTED_DISTANCE_KM} χλμ (ίδιο με scripts/lib/marineCellTrust.mjs, χωρίς waterWitness)`,
  beaches: rows.length, counts, suspectShare: Number((100 * suspects.length / Math.max(1, rows.length)).toFixed(1)),
  suspectsByRegion: Object.fromEntries(Object.entries(byRegion).sort((a, b) => b[1] - a[1])),
  suspects,
  note: 'Δ9 (§Γ81): μέτρηση. «other-water» = το νερό της παραλίας δεν φτάνει ευθεία ως το κελί — υποψία, όχι απόδειξη (χωρίς διαδρομή νερού). Το ψημένο αρχείο ΔΕΝ αλλάζει χωρίς απόφαση Μίλτου· δρόμος: ξαναψήσιμο με λίστα εξαιρέσεων.',
};
const out = path.join(root, 'reports/quality/sea-wind-cell-trust.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`Κελιά ανέμου θάλασσας: ${rows.length} παραλίες · ${JSON.stringify(counts)} · ύποπτα ${suspects.length} (${report.suspectShare}%)`);
console.log('  ανά περιοχή:', Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${v}`).join(' · '));
for (const s of suspects.slice(0, 12)) console.log(`  #${s.beachId} ${s.name} (${s.region}): κελί ${s.distanceKm} χλμ στις ${s.bearingDeg}°, fetch εκεί ${s.fetchKmAtBearing} χλμ → ${s.verdict}`);
console.log(`→ ${path.relative(root, out)}`);
