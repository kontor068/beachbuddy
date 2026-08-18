/**
 * ΣΤΑΔΙΟ 2, ΚΡΙΤΗΣ #1 (ΔΟΜΙΚΟΣ) — ΠΙΝΑΚΑΣ ΜΕΤΑΦΟΡΑΣ vs ΣΗΜΕΡΙΝΕΣ ΠΥΛΕΣ ΣΙΩΠΗΣ.
 *
 * Ο σημερινός εκτιμητής ακτής (utils/shoreWave.estimateShoreWaveHeightM) απαντά ΔΥΑΔΙΚΑ στο
 * «μπορεί να φτάσει κύμα εδώ;» — και μόνο όταν η γεωμετρία λέει «όχι» (blocked=1, fetch≤0,5 χλμ,
 * onshore<−0,5 ή ξηρός τομέας §Γ21/§Γ22) τολμά να τυπώσει νούμερο μικρότερο από το πέλαγος.
 * Ο πίνακας μεταφοράς (Στάδιο 2) απαντά στο ΙΔΙΟ ερώτημα με ποσοστό: K(θ,T).
 *
 * Εδώ μετριέται ΠΟΥ ΔΙΑΦΩΝΟΥΝ, δομικά (83 παραλίες × 16 βαθιές διευθύνσεις, T=6 s):
 *   - ΚΛΑΣΗ ΚΙΝΔΥΝΟΥ: σήμερα σωπαίνουμε (τυπώνουμε ήρεμο μοντελοποιημένο νούμερο) ενώ ο
 *     πίνακας λέει K≥0,35 (≥12% της ενέργειας μπαίνει). Ψεύτικη ηρεμία = σκανδάλη #1 §9.
 *   - ΚΛΑΣΗ ΥΠΕΡ-ΑΓΡΙΟΥ: σήμερα δείχνουμε το πέλαγος ενώ ο πίνακας λέει K≤0,15 (≤2% ενέργεια).
 *     Πιθανό κέρδος ακρίβειας — προς το ηρεμότερο, άρα ΜΟΝΟ με απόφαση Μίλτου (§7δ).
 *
 * ΠΡΟΣΟΧΗ: κριτής εναντίον κριτή, όχι αλήθεια εναντίον ψέματος — ο πίνακας κουβαλάει τα δικά
 * του όρια (χωρίς περίθλαση, raster 92 μ, ορίζοντας 15 χλμ). Report-only, τίποτα ζωντανό.
 *
 * Run: node scripts/measureTransferVsGates.mjs
 * Έξοδος: reports/quality/transfer-vs-gates-naxos-paros.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

// ΙΔΙΕΣ συναρτήσεις με το ζωντανό μονοπάτι — καμία δεύτερη υλοποίηση γεωμετρίας.
const { interpolateSectorGeometry } = require(path.join(root, 'utils/windExposureModel.ts'));
const { onshoreComponent } = require(path.join(root, 'utils/geospatialExposureModel.ts'));
const {
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO, OFFSHORE_FLAT_MAX_FETCH_KM,
} = require(path.join(root, 'utils/offshoreFlatWater.ts'));
const { SHORE_RAMP_SILENT_ONSHORE } = require(path.join(root, 'utils/shoreWave.ts'));

const table = JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/wave-transfer/naxos-paros.json'), 'utf8'));
const T_INDEX = table.periodsS.indexOf(6);
const DIRS = table.directionsDeg;
const K_DANGER = 0.35;   // ≥12% ενέργειας μπαίνει ενώ εμείς σωπαίνουμε
const K_OVERWILD = 0.15; // ≤2% ενέργειας ενώ εμείς δείχνουμε το πέλαγος

const profilesById = {};
for (const rid of ['south-aegean-naxos', 'south-aegean-paros']) {
  const ex = JSON.parse(readFileSync(path.join(root, 'public/data/geospatial/exposure', `${rid}.json`), 'utf8'));
  for (const p of Object.values(ex.profiles ?? {})) if (p?.beachId != null) profilesById[p.beachId] = p;
}

const out = { generatedAt: new Date().toISOString(), periodS: 6, thresholds: { K_DANGER, K_OVERWILD },
  combos: 0, agreement: 0, danger: [], overwild: [], summary: {} };

for (const [idStr, entry] of Object.entries(table.beaches)) {
  if (!entry) continue;
  const profile = profilesById[idStr];
  if (!profile || !Number.isFinite(profile.facingDeg)) continue;
  for (let i = 0; i < DIRS.length; i++) {
    const theta = DIRS[i];
    const K = entry.K[T_INDEX][i];
    const geo = interpolateSectorGeometry(profile, theta);
    const onshore = onshoreComponent(theta, profile.facingDeg);
    // «Σήμερα σωπαίνουμε για κύμα από θ;» — οι γεωμετρικές συνθήκες του εκτιμητή:
    // βασικό μονοπάτι (blocked=1, fetch≤0,5, onshore<−0,5) Ή ξηρός τομέας (fetch=0, blocked=1
    // — ο έλεγχος στομίου ±90° αφήνεται απ' έξω, άρα το «σωπαίνουμε» εδώ είναι ΥΠΕΡεκτίμηση:
    // αν διαφωνεί και έτσι, θα διαφωνούσε και με το πλήρες).
    const basePath = geo.blockedRayRatio >= OFFSHORE_FLAT_MIN_BLOCKED_RATIO
      && geo.fetchKm <= OFFSHORE_FLAT_MAX_FETCH_KM
      && onshore < SHORE_RAMP_SILENT_ONSHORE;
    const drySector = geo.fetchKm === 0 && geo.blockedRayRatio >= OFFSHORE_FLAT_MIN_BLOCKED_RATIO;
    const claimsCalm = basePath || drySector;
    out.combos += 1;
    if (claimsCalm && K >= K_DANGER) {
      out.danger.push({ id: +idStr, name: entry.name, dirDeg: theta, K6: K,
        fetchKm: +geo.fetchKm.toFixed(2), blocked: +geo.blockedRayRatio.toFixed(2), onshore: +onshore.toFixed(2),
        via: drySector && !basePath ? 'dry-sector' : 'base' });
    } else if (!claimsCalm && K <= K_OVERWILD) {
      out.overwild.push({ id: +idStr, name: entry.name, dirDeg: theta, K6: K,
        fetchKm: +geo.fetchKm.toFixed(2), blocked: +geo.blockedRayRatio.toFixed(2), onshore: +onshore.toFixed(2) });
    } else {
      out.agreement += 1;
    }
  }
}

out.summary = {
  combos: out.combos,
  agreementShare: +(out.agreement / out.combos).toFixed(3),
  dangerCount: out.danger.length,
  dangerBeaches: [...new Set(out.danger.map(d => d.id))].length,
  overwildCount: out.overwild.length,
  overwildBeaches: [...new Set(out.overwild.map(d => d.id))].length,
};
writeFileSync(path.join(root, 'reports/quality/transfer-vs-gates-naxos-paros.json'), JSON.stringify(out, null, 2));

console.log(`Συνδυασμοί: ${out.combos} · συμφωνία ${(100 * out.summary.agreementShare).toFixed(1)}%`);
console.log(`ΚΙΝΔΥΝΟΣ (σωπαίνουμε αλλά K≥${K_DANGER}): ${out.summary.dangerCount} συνδυασμοί σε ${out.summary.dangerBeaches} παραλίες`);
for (const d of out.danger.slice(0, 12)) console.log('  ', d.name?.gr ?? d.name, d.dirDeg + '°', 'K6=' + d.K6, 'via=' + d.via);
console.log(`ΥΠΕΡ-ΑΓΡΙΟ (δείχνουμε πέλαγος αλλά K≤${K_OVERWILD}): ${out.summary.overwildCount} συνδυασμοί σε ${out.summary.overwildBeaches} παραλίες`);
