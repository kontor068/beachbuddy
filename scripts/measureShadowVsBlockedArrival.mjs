#!/usr/bin/env node
/**
 * Η ΒΑΘΙΑ ΣΚΙΑ ΤΟΥ K_d ΑΠΕΝΑΝΤΙ ΣΤΙΣ ΠΑΡΑΛΙΕΣ ΟΠΟΥ ΤΟ ΚΥΜΑ ΜΕΤΡΗΘΗΚΕ ΝΑ ΦΤΑΝΕΙ — report-only.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (10/09/2026, βίβλος §Γ74-Ζ). Στις 16/08 το `scripts/auditBlockedDirectionWave.mjs`
 * βρήκε 44 παραλίες όπου το μετρημένο κύμα (ewam) έρχεται από μεριά που η γεωμετρία μας λέει
 * κλειστή. Ο κριτής (Copernicus MEDSEA, `blocked-direction-judge.json`) επιβεβαίωσε ότι το κύμα
 * ΦΤΑΝΕΙ σε δύο από τις τρεις με ≥8 χλμ στεριάς (Μουτσούνα 1,61 μ., Φράγκου 0,80 μ.), και για τις
 * άλλες 41 το συμπέρασμα ήταν «το κύμα περιθλάται και γυρίζει — το μοντέλο πιθανότατα έχει δίκιο».
 * Στις 24/08 μπήκε το K_d(θ) (§Γ71), που σε «βαθιά σκιά» τυπώνει στην ακτή ως το 1/10 του κύματος.
 * Κανείς δεν ξαναέκρινε αυτές τις 44 με τον νέο κανόνα. Αυτό εδώ το κάνει, εκτός δικτύου, πάνω
 * στις ΙΔΙΕΣ γραμμές της 16/08 (ίδια κατεύθυνση, ίδιο μετρημένο ύψος) και με τον ΖΩΝΤΑΝΟ κώδικα.
 *
 * ΤΙ ΜΕΤΡΑΕΙ, ανά παραλία: αν η θάλασσα λογαριάζεται «προστατευμένη άφιξη» (αλλιώς δεν υπάρχει
 * έκπτωση), το K_d, και το ύψος ακτής που θα έβγαινε (μετρημένο × K_d). Μετράει ΚΑΙ με τον κανόνα
 * των μαρτύρων του κριτή (όχι βαθύτερα από την άκρη, 0,5) ώστε να φαίνεται τι αλλάζει.
 * ΔΕΝ είναι το τυπωμένο νούμερο της σελίδας (εκεί μπαίνουν και ράμπα, δάπεδα, ταβάνια) — είναι το
 * σκέλος της έκπτωσης σκιάς, που είναι το ερώτημα.
 *
 *   node scripts/measureShadowVsBlockedArrival.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const {
  resolveShoreShadowDamping, resolveSeaArrivalExposureLevel, SHADOW_KD_AT_EDGE,
} = require(path.join(root, 'utils/seaArrival.ts'));
const { shoreSeaStateM } = require(path.join(root, 'utils/waveCharacter.ts'));
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Σε μελτέμι αέρας και κύμα έρχονται από την ίδια μεριά: η προστασία της παραλίας για τον αέρα
 *  διαβάζεται από τον τομέα της κατεύθυνσης του κύματος (το επίπεδο της ίδιας της μηχανής). */
const sectorLevelAt = (profile, deg) => profile?.sectors?.[SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8]]?.level;

const audit = JSON.parse(fs.readFileSync(path.join(root, 'reports/quality/blocked-direction-wave.json'), 'utf8'));
const profilesByRegion = new Map();
const profileOf = (region, id) => {
  if (!profilesByRegion.has(region)) {
    const f = path.join(root, 'public/data/geospatial/exposure', `${region}.json`);
    const d = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    const list = Array.isArray(d) ? d : Array.isArray(d?.profiles) ? d.profiles : (d?.profiles ? Object.values(d.profiles) : []);
    profilesByRegion.set(region, new Map(list.map((p) => [Number(p.beachId ?? p.id), p])));
  }
  return profilesByRegion.get(region).get(Number(id));
};

const rows = [];
for (const r of audit.rows) {
  const p = profileOf(r.region, r.id);
  if (!p) { rows.push({ ...r, missing: true }); continue; }
  const arrival = resolveSeaArrivalExposureLevel(p, r.waveDirDeg);
  const kd = resolveShoreShadowDamping(p, r.waveDirDeg);
  const level = sectorLevelAt(p, r.waveDirDeg);
  // Η ΙΔΙΑ συνάρτηση που βγάζει τον αριθμό της ακτής στην παραγωγή — κανένα αντίγραφο κανόνα.
  const shoreM = shoreSeaStateM(r.measured, level, arrival, false, kd);
  const edgeM = shoreSeaStateM(r.measured, level, arrival, false, typeof kd === 'number' ? Math.max(kd, SHADOW_KD_AT_EDGE) : kd);
  const discounted = typeof shoreM === 'number' && shoreM < r.measured;
  rows.push({
    id: r.id, region: r.region, name: r.name, landKm: r.landKm, waveDirDeg: r.waveDirDeg,
    measuredM: r.measured, level, arrival: arrival ?? '(σιωπή = δεν πέφτει πάνω της)', kd: typeof kd === 'number' ? Number(kd.toFixed(2)) : null,
    shoreM, shoreWithEdgeFloorM: edgeM,
    deepShadow: discounted && typeof kd === 'number' && kd < SHADOW_KD_AT_EDGE,
  });
}

const deep = rows.filter((r) => r.deepShadow);
const lostWave = deep.filter((r) => r.measuredM >= 0.5 && r.shoreM < 0.3);
const summary = {
  generatedAt: new Date().toISOString(),
  source: 'reports/quality/blocked-direction-wave.json (16/08/2026, ίδιες γραμμές)',
  question: 'Πόσες από τις παραλίες όπου το κύμα μετρήθηκε να φτάνει από «κλειστή» μεριά παίρνουν σήμερα βαθιά σκιά K_d<0,5;',
  rows: rows.length,
  missingProfile: rows.filter((r) => r.missing).length,
  discounted: rows.filter((r) => typeof r.shoreM === 'number' && r.shoreM < r.measuredM).length,
  deepShadow: deep.length,
  deepShadowMeasuredAbove05PrintedBelow03: lostWave.length,
  byLand: {
    atLeast8km: deep.filter((r) => r.landKm >= 8).length,
    under8km: deep.filter((r) => r.landKm < 8).length,
  },
  worst: deep.sort((a, b) => (b.measuredM - b.shoreM) - (a.measuredM - a.shoreM)).slice(0, 15),
};
const out = path.join(root, 'reports/quality/shadow-vs-blocked-arrival.json');
fs.writeFileSync(out, `${JSON.stringify({ summary, rows }, null, 2)}\n`);

console.log(`γραμμές 16/08: ${summary.rows} · χωρίς προφίλ ${summary.missingProfile} · παίρνουν έκπτωση σκιάς σήμερα: ${summary.discounted}`);
console.log(`ΒΑΘΙΑ ΣΚΙΑ σήμερα (K_d < ${SHADOW_KD_AT_EDGE}): ${summary.deepShadow}  — ≥8 χλμ στεριάς ${summary.byLand.atLeast8km} · <8 χλμ ${summary.byLand.under8km}`);
console.log(`μετρημένο ≥0,5 μ. που γίνεται <0,3 μ. στην ακτή: ${summary.deepShadowMeasuredAbove05PrintedBelow03}`);
for (const r of summary.worst) {
  console.log(`  #${String(r.id).padEnd(5)} ${String(r.name).padEnd(28)} ${r.waveDirDeg}° · στεριά ${r.landKm} χλμ · μετρ. ${r.measuredM} → ακτή ${r.shoreM} (K_d ${r.kd}) · με όριο άκρης ${r.shoreWithEdgeFloorM}`);
}
console.log(`\n→ ${path.relative(root, out)}`);
