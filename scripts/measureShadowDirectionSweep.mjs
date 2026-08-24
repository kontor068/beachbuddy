/**
 * ΤΟ ΣΑΡΩΜΑ ΤΩΝ 8 ΚΑΤΕΥΘΥΝΣΕΩΝ — Η ΠΛΗΡΗΣ ΛΙΣΤΑ ΥΠΟΠΤΩΝ, ΟΧΙ Η ΑΛΗΘΕΙΑ (24/08/2026).
 *
 * Το measureShoreShadowPhysics έκρινε κάθε παραλία στη διεύθυνση κύματος ΜΙΑΣ μέρας — μια
 * παραλία που «διαρρέει» με νοτιά δεν φαίνεται σε μέτρηση με βοριά. Εδώ, χωρίς δίκτυο: για
 * κάθε προστατεύσιμη παραλία και κάθε μία από τις 8 διευθύνσεις, (1) θα έδινε η ΣΗΜΕΡΙΝΗ πύλη
 * την έκπτωση; — με την ΠΡΑΓΜΑΤΙΚΗ resolveSeaArrivalExposureLevel, όχι αντίγραφο — και
 * (2) τι λέει η φυσική της σκιάς (ίδιο K_d με το measureShoreShadowPhysics);
 *
 * Η ΥΠΟΘΕΣΗ, ΓΡΑΜΜΕΝΗ ΚΑΘΑΡΑ: δεχόμαστε ότι υπάρχει μέρα που ο ΑΝΕΜΟΣ κάνει την παραλία
 * 'protected' ενώ η θάλασσα έρχεται από τη διεύθυνση D — το σάρωμα είναι επίτηδες ΥΠΕΡΣΥΝΟΛΟ
 * (κατάλογος υπόπτων για έλεγχο με μάτια), όχι πρόβλεψη συχνότητας. ΔΕΝ αλλάζει τίποτα.
 *
 * Run: node scripts/measureShadowDirectionSweep.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { resolveSeaArrivalExposureLevel, SEA_ARRIVAL_UNKNOWN } = require(path.join(root, 'utils/seaArrival.ts'));
const { SEA_ARRIVAL_GRAZING } = require(path.join(root, 'utils/waveCharacter.ts'));

// Ίδιες σταθερές με το measureShoreShadowPhysics — αν αποκλίνουν, οι δύο αναφορές δεν συγκρίνονται.
const OPEN_FETCH_KM = 10;
const CORRIDOR_HALF_DEG = 22.5;
const DECAY_DEG = 45;
const KD_AT_EDGE = 0.5;
const KD_FLOOR = 0.10;
const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const angularDistance = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const shadowOf = (profile, waveFromDeg) => {
  let theta = null;
  SECTOR_ORDER.forEach((key, index) => {
    const sector = profile.sectors?.[key];
    if (!sector || !(sector.fetchKm >= OPEN_FETCH_KM)) return;
    const d = angularDistance(waveFromDeg, index * 45);
    if (theta === null || d < theta) theta = d;
  });
  if (theta === null) return { thetaDeg: 180, kd: KD_FLOOR, bucket: 'κλειστός' };
  if (theta <= CORRIDOR_HALF_DEG) return { thetaDeg: theta, kd: 1, bucket: 'διάδρομος' };
  const kd = Math.max(KD_FLOOR, KD_AT_EDGE * Math.exp(-(theta - CORRIDOR_HALF_DEG) / DECAY_DEG));
  return { thetaDeg: theta, kd: Number(kd.toFixed(3)), bucket: kd > 0.3 ? 'άκρη σκιάς' : 'βαθιά σκιά' };
};

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');
const nameById = new Map();
for (const file of readdirSync(beachDir).filter(f => f.endsWith('.json'))) {
  try {
    for (const b of JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')).island?.beaches ?? []) {
      nameById.set(b.id, { name: b.name?.gr ?? String(b.id), region: file.replace('.json', '') });
    }
  } catch { /* skip */ }
}

const beaches = [];
let combosGranted = 0, combosAll = 0;
const bucketCount = {};
for (const file of readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  let profiles;
  try { profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {}; } catch { continue; }
  for (const profile of Object.values(profiles)) {
    if (profile?.confidence !== 'high' || !profile.sectors) continue;
    // «Προστατεύσιμη»: έχει έστω έναν τομέα 'protected' — αλλιώς η έκπτωση δεν την αφορά ποτέ.
    if (!SECTOR_ORDER.some(k => profile.sectors[k]?.level === 'protected')) continue;
    const perDir = [];
    for (let i = 0; i < 8; i += 1) {
      const waveDeg = i * 45;
      combosAll += 1;
      // Η ΠΡΑΓΜΑΤΙΚΗ πύλη της θάλασσας. 'protected'/'unknown-σιωπή'/grazing → η έκπτωση περνάει
      // (με την υπόθεση ότι ο άνεμος λέει 'protected' εκείνη τη μέρα)· ρητό 'partial'/'exposed'
      // ή τυφλότητα ('unknown') → όχι.
      const arrival = resolveSeaArrivalExposureLevel(profile, waveDeg);
      const granted = arrival === undefined || arrival === 'protected' || arrival === SEA_ARRIVAL_GRAZING;
      if (!granted) continue;
      combosGranted += 1;
      const shadow = shadowOf(profile, waveDeg);
      bucketCount[shadow.bucket] = (bucketCount[shadow.bucket] ?? 0) + 1;
      perDir.push({ dir: SECTOR_ORDER[i], arrival: arrival ?? 'σιωπή', ...shadow });
    }
    if (!perDir.length) continue;
    const info = nameById.get(profile.beachId) ?? { name: String(profile.beachId), region: '—' };
    beaches.push({
      beachId: profile.beachId, ...info,
      corridorDirs: perDir.filter(d => d.bucket === 'διάδρομος').map(d => `${d.dir}(${d.arrival})`),
      deepDirs: perDir.filter(d => d.bucket === 'βαθιά σκιά' || d.bucket === 'κλειστός').length,
      grantedDirs: perDir.length,
    });
  }
}

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;
const leaks = beaches.filter(b => b.corridorDirs.length > 0)
  .sort((a, b) => b.corridorDirs.length - a.corridorDirs.length);
const deepOnly = beaches.filter(b => b.corridorDirs.length === 0 && b.deepDirs === b.grantedDirs);

console.log(`Προστατεύσιμες παραλίες (high confidence, ≥1 τομέας protected): ${beaches.length}`);
console.log(`Συνδυασμοί παραλία×διεύθυνση όπου η πύλη δίνει έκπτωση: ${combosGranted}/${combosAll} (${pct(combosGranted, combosAll)})`);
console.log('\n── Η ΦΥΣΙΚΗ ΑΝΑ ΣΥΝΔΥΑΣΜΟ ΠΟΥ ΠΑΙΡΝΕΙ ΕΚΠΤΩΣΗ ──────────────────────');
for (const [bucket, count] of Object.entries(bucketCount).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${bucket}: ${count} (${pct(count, combosGranted)})`);
}
console.log(`\n── ΟΙ ΥΠΟΠΤΕΣ «ΔΙΑΡΡΟΗΣ» — ΣΕ ΟΠΟΙΟΝΔΗΠΟΤΕ ΚΑΙΡΟ ────────────────────`);
console.log(`  Παραλίες με ≥1 διεύθυνση όπου παίρνουν έκπτωση ΚΑΙ το κύμα μπαίνει από ανοιχτό διάδρομο: ${leaks.length}`);
for (const b of leaks.slice(0, 20)) {
  console.log(`  #${b.beachId} ${b.name} (${b.region}): ${b.corridorDirs.join(' · ')}`);
}
if (leaks.length > 20) console.log(`  … και ${leaks.length - 20} ακόμα (πλήρης λίστα στο JSON).`);
console.log(`\n  Παραλίες ΜΟΝΟ βαθιάς σκιάς/κλειστές σε κάθε καιρό (η ήπια κατεύθυνση): ${deepOnly.length}`);

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
const reportPath = path.join(root, 'reports/quality/shadow-direction-sweep.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  params: { OPEN_FETCH_KM, CORRIDOR_HALF_DEG, DECAY_DEG, KD_AT_EDGE, KD_FLOOR },
  beaches: beaches.length,
  combosGranted, combosAll, bucketCount,
  leakBeaches: leaks,
  deepOnlyCount: deepOnly.length,
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
