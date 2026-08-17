/**
 * ΔΥΟ ΕΡΩΤΗΣΕΙΣ ΤΟΥ ΜΙΛΤΟΥ, ΜΕΤΡΗΜΕΝΕΣ — offline, καμία αλλαγή σε τίποτα.
 *
 * (Α) «ΓΙΑΤΙ ΔΕΝ ΔΕΙΧΝΕΙΣ ΠΑΝΤΟΥ ΚΥΜΑ ΑΚΤΗΣ ΑΝΤΙ ΓΙΑ ΤΑ ΑΝΟΙΧΤΑ;»
 *
 * Δεν απαντιέται με γνώμη. Το εργαλείο τρέχει τον ΔΙΚΟ μας τύπο ακτής
 * (utils/waveModel.estimateFetchLimitedWaveHeightM = άνεμος × άνοιγμα, το κλασικό SMB) πάνω σε
 * ΚΑΘΕ παραλία και ΚΑΘΕ τομέα, ΧΩΡΙΣ καμία πύλη, και τον συγκρίνει με τον αριθμό που τυπώνουμε
 * σήμερα. Η ερώτηση που κρίνει δεν είναι «πόσο διαφέρουν» αλλά **«πόσες φορές θα λέγαμε ΛΑΔΙ ενώ
 * έξω έχει κύμα»** — γιατί αυτό είναι το μόνο λάθος που βάζει άνθρωπο σε νερό που δεν περίμενε.
 *
 * Ο τύπος ακτής ξέρει ΔΥΟ πράγματα: πόσο δυνατά φυσάει τώρα, και πόσο νερό υπάρχει μπροστά. Δεν
 * ξέρει την **αποθαλασσιά** — κύμα που ταξίδεψε από μακριά και φτάνει με νηνεμία. Γι' αυτό, όπου
 * υπάρχει ανοιχτό νερό, ο τύπος δεν είναι δεύτερη γνώμη· είναι **λιγότερη πληροφορία**.
 *
 * (Β) «ΔΕΣ ΚΑΙ ΤΟ ΧΡΩΜΑ / ΤΗΝ ΕΚΘΕΣΗ.»
 *
 * Το ίδιο κενό που έκλεισε στον ΑΡΙΘΜΟ (βίβλος §Γ21) υπάρχει και στην ΕΚΘΕΣΗ: ο τύπος έντασης
 * είναι `100 × onshoreFactor × (0,6 + 0,4 × fetchFactor × openness)` — με `fetchKm = 0` ο δεύτερος
 * παράγοντας κολλάει στο **0,6** και μένει `ένταση = 60 × onshoreFactor`, δηλαδή καθαρή
 * τριγωνομετρία πάνω σε στεριά (§Γ20). Εδώ μετριέται πόσοι τομείς παίρνουν χρώμα από γωνία ενώ
 * δεν υπάρχει νερό, ΚΑΙ πόσοι από αυτούς περνούν τον ίδιο έλεγχο «κανένα ανοιχτό στόμιο στα ±90°»
 * που κλείδωσε στον αριθμό.
 *
 * ⚠️ ΤΟ ΜΕΓΑΛΟ ΡΙΣΚΟ ΤΟΥ (Β), ΓΡΑΜΜΕΝΟ ΠΡΙΝ ΤΟ ΑΠΟΤΕΛΕΣΜΑ. Η §Γ20 μέτρησε ότι το ίδιο τεστ
 * «μηδέν άνοιγμα» ορίζει ΚΑΙ το τόξο του όρμου (utils/windExposureEngine), και ο όρμος εξαιρείται
 * ολοκληρωτικά από το ταβάνι θάλασσας — οπότε μια χαλάρωση εκεί έφτιαχνε 205 → 458 όρμους, με 194
 * να έχουν ≥8 χλμ ανοιχτά κάπου. Το εργαλείο μετράει ΡΗΤΑ αυτή τη διαρροή.
 *
 * Run: node scripts/measureShoreEverywhereAndColour.mjs
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));
const { isEnclosedDrySector } = require(path.join(root, 'utils/shoreWave.ts'));
const { computeDirectionalExposure } = require(path.join(root, 'utils/geospatialExposureModel.ts'));

const SECTOR_ORDER = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Ίδιο πλέγμα με §Γ3/§Γ4/§Γ21 ώστε τα νούμερα να συγκρίνονται μεταξύ τους.
const WINDS = [
  { windKmh: 20, openWaterM: 0.35, bft: 3 },
  { windKmh: 40, openWaterM: 0.9, bft: 6 },
  { windKmh: 60, openWaterM: 1.6, bft: 7 },
];
/** Κάτω από αυτό ο αναγνώστης διαβάζει «λάδι». Το δάπεδο εμφάνισης είναι 0,10. */
const FLAT_M = 0.15;
/** Πάνω από αυτό, το να πεις «λάδι» δεν είναι ανακρίβεια — είναι λάθος που βρέχει κόσμο. */
const REAL_SEA_M = 0.8;

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const profiles = [];
for (const file of readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  const regionId = file.replace(/\.json$/, '');
  const raw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
  for (const profile of Object.values(raw)) {
    if (profile?.confidence === 'high' && profile.sectors) profiles.push({ regionId, profile });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// (Α) ΑΝ ΤΥΠΩΝΑΜΕ ΠΑΝΤΟΥ ΤΟΝ ΔΙΚΟ ΜΑΣ ΤΥΠΟ ΑΚΤΗΣ
// ─────────────────────────────────────────────────────────────────────────────
const everywhere = {
  combos: 0,
  calmer: 0,
  rougher: 0,
  deltas: [],
  flatOverRealSea: 0,             // θα λέγαμε «λάδι» ενώ έξω ≥0,8 μ.
  flatOverRealSeaBeaches: new Set(),
  worst: null,
  byWind: WINDS.map(w => ({ bft: w.bft, windKmh: w.windKmh, flatOverRealSea: 0, combos: 0 })),
  openSectorFlat: 0,              // τομείς με ΑΝΟΙΧΤΟ νερό που θα τυπώναμε λάδι
};

// ─────────────────────────────────────────────────────────────────────────────
// (Β) ΤΟ ΧΡΩΜΑ: ΕΝΤΑΣΗ ΑΠΟ ΓΩΝΙΑ ΠΑΝΩ ΣΕ ΣΤΕΡΙΑ
// ─────────────────────────────────────────────────────────────────────────────
const colour = {
  drySectors: 0,
  dryNotProtected: 0,
  dryNotProtectedBeaches: new Set(),
  dryNotProtectedClear90: 0,       // …και περνάνε ΚΑΙ τον έλεγχο «κανένα στόμιο στα ±90°»
  dryNotProtectedClear90Beaches: new Set(),
  exposedFromAngleAlone: 0,
  intensities: [],
  leakBeaches: new Set(),          // θα άλλαζαν επίπεδο ΚΑΙ έχουν ≥8 χλμ ανοιχτά κάπου
  examples: [],
};

for (const { regionId, profile } of profiles) {
  SECTOR_ORDER.forEach((sectorKey, index) => {
    const sector = profile.sectors[sectorKey];
    if (!sector) return;
    const windDeg = index * 45;

    // ── (Α)
    for (let w = 0; w < WINDS.length; w += 1) {
      const wind = WINDS[w];
      everywhere.combos += 1;
      everywhere.byWind[w].combos += 1;
      const shoreM = Math.max(0.1, estimateFetchLimitedWaveHeightM({
        windSpeedKmh: wind.windKmh,
        fetchKm: sector.fetchKm,
      }));
      const delta = Number((shoreM - wind.openWaterM).toFixed(2));
      everywhere.deltas.push(delta);
      if (delta < -0.005) everywhere.calmer += 1;
      else if (delta > 0.005) everywhere.rougher += 1;
      if (shoreM <= FLAT_M && wind.openWaterM >= REAL_SEA_M) {
        everywhere.flatOverRealSea += 1;
        everywhere.byWind[w].flatOverRealSea += 1;
        everywhere.flatOverRealSeaBeaches.add(profile.beachId);
        if (sector.fetchKm > 2) everywhere.openSectorFlat += 1;
        const gap = wind.openWaterM - shoreM;
        if (!everywhere.worst || gap > everywhere.worst.gap) {
          everywhere.worst = {
            gap: Number(gap.toFixed(2)), regionId, beachId: profile.beachId,
            sectorKey, fetchKm: sector.fetchKm, bft: wind.bft,
            shoreM: Number(shoreM.toFixed(2)), openWaterM: wind.openWaterM,
          };
        }
      }
    }

    // ── (Β)
    const dry = sector.fetchKm === 0 && (sector.blockedRayRatio ?? 0) >= 0.95;
    if (!dry) return;
    colour.drySectors += 1;
    if (sector.level === 'protected') return;
    colour.dryNotProtected += 1;
    colour.dryNotProtectedBeaches.add(profile.beachId);
    colour.intensities.push(sector.intensity ?? 0);
    if (sector.level === 'exposed') colour.exposedFromAngleAlone += 1;

    if (!isEnclosedDrySector(sector, profile, windDeg)) return;
    colour.dryNotProtectedClear90 += 1;
    colour.dryNotProtectedClear90Beaches.add(profile.beachId);
    const maxAnywhereKm = Math.max(...SECTOR_ORDER.map(k => profile.sectors[k]?.fetchKm ?? 0));
    if (maxAnywhereKm >= 8) colour.leakBeaches.add(profile.beachId);
    if (colour.examples.length < 10) {
      colour.examples.push({
        regionId, beachId: profile.beachId, sectorKey,
        level: sector.level, intensity: sector.intensity,
        maxAnywhereKm: Number(maxAnywhereKm.toFixed(2)),
      });
    }
  });
}

// Δίχτυ πάνω στο εργαλείο: αν ο τύπος έντασης δεν είναι αυτός που νομίζουμε, όλα τα παραπάνω
// είναι διακόσμηση. Ελέγχεται με κλήση στον ΠΡΑΓΜΑΤΙΚΟ κώδικα, όχι με αντιγραφή του τύπου.
{
  const headOnDry = computeDirectionalExposure({ fetchKm: 0, blockedRayRatio: 1, onshore: 1 });
  const backOnDry = computeDirectionalExposure({ fetchKm: 0, blockedRayRatio: 1, onshore: -1 });
  if (!(headOnDry.intensity >= 59 && backOnDry.intensity <= 1)) {
    console.error(`ΑΚΥΡΟ ΕΡΓΑΛΕΙΟ: ο τύπος έντασης δεν συμπεριφέρεται όπως περιγράφεται `
      + `(κατάματα ${headOnDry.intensity}, από πίσω ${backOnDry.intensity}).`);
    process.exit(1);
  }
  console.log(`Δίχτυ: με ΜΗΔΕΝ νερό μπροστά, ο τύπος έντασης δίνει ${headOnDry.intensity.toFixed(1)}/100 `
    + `(«${headOnDry.level}») όταν ο άνεμος είναι κατάματα, και ${backOnDry.intensity.toFixed(1)} από πίσω `
    + `— καθαρή γωνία, μηδέν θάλασσα.\n`);
}

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))];
};
const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

console.log('── (Α) ΑΝ ΔΕΙΧΝΑΜΕ ΠΑΝΤΟΥ ΤΟΝ ΔΙΚΟ ΜΑΣ ΤΥΠΟ ΑΚΤΗΣ ────────────────');
console.log(`${everywhere.combos} συνδυασμοί (${profiles.length} παραλίες × 8 τομείς × 3 εντάσεις).`);
console.log(`  πιο ήρεμος αριθμός από σήμερα: ${everywhere.calmer} (${pct(everywhere.calmer, everywhere.combos)})`
  + ` · πιο άγριος: ${everywhere.rougher} (${pct(everywhere.rougher, everywhere.combos)})`);
console.log(`  ⛔ ΘΑ ΛΕΓΑΜΕ «ΛΑΔΙ» (≤${FLAT_M} μ.) ΕΝΩ ΕΞΩ ΕΧΕΙ ≥${REAL_SEA_M} μ.: `
  + `${everywhere.flatOverRealSea} (${pct(everywhere.flatOverRealSea, everywhere.combos)}) `
  + `σε ${everywhere.flatOverRealSeaBeaches.size} παραλίες`);
console.log(`     από αυτά, σε τομείς με ΑΝΟΙΧΤΟ νερό (>2 χλμ): ${everywhere.openSectorFlat}`);
for (const w of everywhere.byWind) {
  console.log(`     στα ${w.bft} Μποφόρ: ${w.flatOverRealSea} (${pct(w.flatOverRealSea, w.combos)})`);
}
if (everywhere.worst) {
  const x = everywhere.worst;
  console.log(`  Χειρότερη: #${x.beachId} (${x.regionId}) @${x.sectorKey}, άνοιγμα ${x.fetchKm} χλμ, `
    + `${x.bft} Μποφόρ → θα τυπώναμε ${x.shoreM} μ. ενώ τα ανοιχτά ${x.openWaterM} μ. (διαφορά ${x.gap} μ.)`);
}
console.log(`  Διάμεση διαφορά ${percentile(everywhere.deltas, 0.5).toFixed(2)} μ. · p10 `
  + `${percentile(everywhere.deltas, 0.1).toFixed(2)} μ. · p90 ${percentile(everywhere.deltas, 0.9).toFixed(2)} μ.`);

console.log('\n── (Β) ΤΟ ΧΡΩΜΑ: ΕΝΤΑΣΗ ΑΠΟ ΓΩΝΙΑ ΠΑΝΩ ΣΕ ΣΤΕΡΙΑ ─────────────────');
console.log(`  ξηροί τομείς (άνοιγμα 0, φράξιμο ≥0,95): ${colour.drySectors}`);
console.log(`  από αυτούς ΔΕΝ λέγονται «Προστατευμένος»: ${colour.dryNotProtected} σε `
  + `${colour.dryNotProtectedBeaches.size} παραλίες · ένταση διάμεσος `
  + `${percentile(colour.intensities, 0.5).toFixed(1)} · max ${Math.max(...colour.intensities, 0).toFixed(1)}`
  + ` · «Εκτεθειμένος» από σκέτη γωνία: ${colour.exposedFromAngleAlone}`);
console.log(`  …και περνάνε ΚΑΙ τον έλεγχο «κανένα στόμιο >2 χλμ στα ±90°»: `
  + `${colour.dryNotProtectedClear90} τομείς σε ${colour.dryNotProtectedClear90Beaches.size} παραλίες`);
console.log(`  ⚠️ από αυτές, με ≥8 χλμ ανοιχτά ΚΑΠΟΥ αλλού στο προφίλ (κίνδυνος διαρροής §Γ20): `
  + `${colour.leakBeaches.size}`);
if (colour.examples.length) {
  console.log('  Παραδείγματα:');
  for (const e of colour.examples.slice(0, 6)) {
    console.log(`    #${e.beachId} (${e.regionId}) @${e.sectorKey}: «${e.level}» ένταση `
      + `${(e.intensity ?? 0).toFixed(1)} · μέγιστο άνοιγμα οπουδήποτε ${e.maxAnywhereKm} χλμ`);
  }
}

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
const reportPath = path.join(root, 'reports/quality/shore-everywhere-and-colour.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  profiles: profiles.length,
  flatThresholdM: FLAT_M,
  realSeaThresholdM: REAL_SEA_M,
  everywhere: {
    ...everywhere,
    flatOverRealSeaBeaches: everywhere.flatOverRealSeaBeaches.size,
    medianDeltaM: Number(percentile(everywhere.deltas, 0.5).toFixed(2)),
    p10DeltaM: Number(percentile(everywhere.deltas, 0.1).toFixed(2)),
    p90DeltaM: Number(percentile(everywhere.deltas, 0.9).toFixed(2)),
    deltas: undefined,
  },
  colour: {
    ...colour,
    dryNotProtectedBeaches: colour.dryNotProtectedBeaches.size,
    dryNotProtectedClear90Beaches: colour.dryNotProtectedClear90Beaches.size,
    leakBeaches: colour.leakBeaches.size,
    medianIntensity: Number(percentile(colour.intensities, 0.5).toFixed(1)),
    intensities: undefined,
  },
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
