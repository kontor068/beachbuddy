/**
 * ΤΙ ΑΛΛΑΞΕ ΠΡΑΓΜΑΤΙΚΑ ΣΤΙΣ ΤΟΠ ΕΠΙΛΟΓΕΣ — μέτρηση, όχι πύλη.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Στις 15/08/2026 έγιναν δύο αλλαγές στη σύνθεση του βάθρου (§Γ11: μία μπλε δεν
 * αδειάζει το βάθρο· §Γ12: η πινέζα Google έγινε προτίμηση αντί για πόρτα). Το §Γ12 μετρήθηκε σε
 * αληθινά δεδομένα· το §Γ11 αποδείχθηκε μόνο πάνω σε **συνθετικό** σχήμα περιοχής. Η βίβλος
 * απαιτεί μετρημένο πίνακα πριν/μετά σε πραγματικά δεδομένα (§Γ8, §Γ9), όχι σε επινοημένα.
 * Αυτό είναι αυτός ο πίνακας.
 *
 * ΠΩΣ. Φορτώνει ΔΥΟ αντίγραφα του `services/topPickRanking.ts` — το σημερινό, και ένα με τις
 * τρεις αλλαγές γυρισμένες πίσω — και τα τρέχει πάνω στις ίδιες ακριβώς παραλίες. Κάθε
 * αντιστροφή επαληθεύεται ότι όντως άλλαξε κείμενο· αλλιώς η μέτρηση θα σύγκρινε τον κώδικα με
 * τον εαυτό του και θα τύπωνε «καμία αλλαγή» με σιγουριά.
 *
 * ΤΟ ΧΡΩΜΑ ΕΙΝΑΙ ΤΟ ΠΡΑΓΜΑΤΙΚΟ. Δεν επινοείται βαθμίδα: η έκθεση βγαίνει από τη δεσμευμένη
 * γεωμετρία κάθε παραλίας απέναντι στον άνεμο του σεναρίου, και το χρώμα από την ΙΔΙΑ
 * `resolveConditionTone` που βάφει τις πινέζες. Χωρίς αυτό, το §Γ11 (που κρίνεται ΜΕ το χρώμα)
 * θα μετριόταν σε κενό.
 *
 * ΤΙ ΔΕΝ ΚΑΛΥΠΤΕΙ, και λέγεται δυνατά: ο χρωματικός περιορισμός του §Γ10 ζει στο App.tsx και δεν
 * οδηγείται εκτός browser. Άρα οι δεξαμενές εδώ είναι ΜΕΓΑΛΥΤΕΡΕΣ από τις πραγματικές, και τα
 * νούμερα «γέμισε» είναι, αν κάτι, **συντηρητικά** — στην πράξη το §Γ11 δαγκώνει πιο συχνά.
 *
 * Report only: τυπώνει, ποτέ δεν ρίχνει build.
 *
 * Τρέξιμο: node scripts/measurePodiumFillChange.mjs
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
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
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const current = require(path.join(root, 'services/topPickRanking.ts'));

// ── Το «πριν»: το ίδιο αρχείο με τις τρεις αλλαγές της 15/08 γυρισμένες πίσω.
const rankingSource = readFileSync(path.join(root, 'services/topPickRanking.ts'), 'utf8');
const reversals = [
  ['§Γ11 — το φίλτρο χρώματος ξανακρατά ΜΟΝΟ τις μπλε', s => s.replace(
    'if (idealByMap.length >= TOP_PICK_PODIUM_SEATS) return idealByMap;',
    'if (idealByMap.length > 0) return idealByMap;'
  )],
  ['§Γ12 — η πινέζα ξαναγίνεται σκληρή πόρτα', s => s.replace(
    /  const affordable = items\.filter[\s\S]*?\.\.\.affordable\.filter\(item => !opensGoogleMapsPin\(item\.beach\)\)\];/,
    '  const recommendable = items.filter(item => (\n'
    + '    !hasPaidEntryTopPickBlocker(item.beach) && opensGoogleMapsPin(item.beach)\n'
    + '  ));'
  )],
  ['§Γ12 — φεύγει η ισοπαλία πινέζας', s => s.replace(
    /    const pinDiff = Number\(opensGoogleMapsPin\(b\.beach\)\) - Number\(opensGoogleMapsPin\(a\.beach\)\);\n    if \(pinDiff !== 0\) return pinDiff;\n/,
    ''
  )],
];

let previousSource = rankingSource;
for (const [label, mutate] of reversals) {
  const next = mutate(previousSource);
  if (next === previousSource) {
    console.error(`❌ Η αντιστροφή «${label}» δεν άλλαξε τίποτα — η μέτρηση θα σύγκρινε τον κώδικα με τον εαυτό του.`);
    process.exit(1);
  }
  previousSource = next;
}

const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  fileName: 'topPickRanking.ts',
}).outputText;

const previousExports = {};
new Function('exports', 'require', compile(previousSource))(
  previousExports,
  p => require(path.resolve(path.join(root, 'services'), p) + (p.endsWith('.ts') ? '' : '.ts'))
);

// ── Δεδομένα.
const beachDir = path.join(root, 'public/data/beaches/app');
const regions = readdirSync(beachDir)
  .filter(f => f.endsWith('.json'))
  .map(f => {
    let raw;
    try { raw = JSON.parse(readFileSync(path.join(beachDir, f), 'utf8')); } catch { return null; }
    const beaches = raw.island?.beaches ?? [];
    return beaches.length ? { id: f.replace(/\.json$/, ''), beaches } : null;
  })
  .filter(Boolean);

const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const TONE_RANK = { blue: 0, yellow: 1, orange: 2, red: 3 };
const SEA_BY_BFT = { 3: 0.35, 4: 0.60, 5: 0.95, 6: 1.40 };
const WINDS = [0, 45, 90, 135, 180, 225, 270, 315];
const BEAUFORTS = [3, 4, 5, 6];

const buildScenario = (beaches, windDir, bft) => {
  const base = SEA_BY_BFT[bft];
  return beaches.map(b => {
    const facing = b.geospatial?.facingDirection ?? b.orientation?.facing;
    const offshore = typeof facing === 'number' ? angleDiff(facing, (windDir + 180) % 360) < 60 : false;
    const onshore = typeof facing === 'number' ? angleDiff(facing, windDir) < 60 : false;
    const exposureLevel = offshore ? 'protected' : onshore ? 'exposed' : 'partial';
    const seaStateM = onshore ? base : offshore ? base * 0.2 : base * 0.6;
    // Το ΙΔΙΟ χρώμα που βάφει τις πινέζες — όχι επινοημένη βαθμίδα.
    const tone = resolveConditionTone({ exposureLevel, beaufort: bft, seaStateM });
    return {
      beach: b,
      beachId: b.id,
      score: 65,
      isExposed: exposureLevel === 'exposed',
      exposureLevel,
      canClaimWindProtection: exposureLevel === 'protected',
      seaStateWaveM: seaStateM,
      seaStatePeriodS: 4,
      _tone: TONE_RANK[tone] ?? undefined,
    };
  });
};

const podium = (impl, items, bft) => {
  const perBeachWind = new Map(items.map(i => [i.beach.id, { beaufort: bft }]));
  const toneRank = id => items.find(i => i.beach.id === id)?._tone;
  return impl.prioritizeProtectedRecommendations(items, bft, perBeachWind, toneRank)
    .slice(0, 3)
    .map(i => i.beach.id);
};

// ── Μέτρηση.
let scenarios = 0, changed = 0, fuller = 0, emptier = 0, reordered = 0;
let wasSingle = 0, stillSingle = 0, singleFixed = 0;
let worseColourLead = 0;
const worstExamples = [];
const perRegionFuller = new Map();

for (const region of regions) {
  for (const windDir of WINDS) {
    for (const bft of BEAUFORTS) {
      const items = buildScenario(region.beaches, windDir, bft);
      if (items.length === 0) continue;
      scenarios++;

      const before = podium(previousExports, items, bft);
      const after = podium(current, items, bft);

      if (before.length === 1) {
        wasSingle++;
        if (after.length === 1) stillSingle++; else singleFixed++;
      }
      if (after.length > before.length) {
        fuller++;
        perRegionFuller.set(region.id, (perRegionFuller.get(region.id) ?? 0) + 1);
      }
      if (after.length < before.length) {
        emptier++;
        if (worstExamples.length < 6) {
          worstExamples.push(`ΑΔΕΙΑΣΕ  ${region.id} @ ${bft} Μποφ. άνεμος ${windDir}°: ${before.length} → ${after.length}`);
        }
      }
      if (JSON.stringify(before) !== JSON.stringify(after)) changed++;
      else continue;
      if (before.length === after.length) reordered++;

      // Χειροτέρεψε η ΚΟΡΥΦΗ; Μόνο το χρώμα μετράει εδώ — είναι η απόδειξη (§7ε/§7στ).
      const toneOf = id => items.find(i => i.beach.id === id)?._tone ?? 9;
      if (before.length > 0 && after.length > 0 && toneOf(after[0]) > toneOf(before[0])) {
        worseColourLead++;
        if (worstExamples.length < 6) {
          worstExamples.push(`ΧΕΙΡΟΤΕΡΟ #1  ${region.id} @ ${bft} Μποφ. άνεμος ${windDir}°: χρώμα ${toneOf(before[0])} → ${toneOf(after[0])}`);
        }
      }
    }
  }
}

const pct = n => `${((n / scenarios) * 100).toFixed(1)}%`;
const regionsFuller = perRegionFuller.size;

console.log('ΤΙ ΑΛΛΑΞΕ ΣΤΙΣ ΤΟΠ ΕΠΙΛΟΓΕΣ — αληθινά δεδομένα\n');
console.log(`Περιοχές: ${regions.length} · σενάρια: ${scenarios} (${WINDS.length} άνεμοι × ${BEAUFORTS.length} Μποφόρ)\n`);
console.log(`  άλλαξε κάτι                    ${changed}  (${pct(changed)})`);
console.log(`  ΓΕΜΙΣΕ (περισσότερες κάρτες)   ${fuller}  (${pct(fuller)})  σε ${regionsFuller} από ${regions.length} περιοχές`);
console.log(`  ΑΔΕΙΑΣΕ (λιγότερες κάρτες)     ${emptier}  (${pct(emptier)})   ← πρέπει να είναι 0`);
console.log(`  ίδιο πλήθος, άλλη σειρά        ${reordered}  (${pct(reordered)})`);
console.log(`  ΧΕΙΡΟΤΕΡΟ χρώμα στο #1         ${worseColourLead}  (${pct(worseColourLead)})   ← πρέπει να είναι 0\n`);
console.log(`  βάθρο με ΜΙΑ κάρτα πριν        ${wasSingle}`);
console.log(`    · διορθώθηκε                 ${singleFixed}`);
console.log(`    · έμεινε μία                 ${stillSingle}   (η περιοχή δεν είχε δεύτερη)\n`);

if (worstExamples.length > 0) {
  console.log('Παραδείγματα προς έλεγχο:');
  worstExamples.forEach(e => console.log(`  · ${e}`));
  console.log('');
}

const verdict = (emptier === 0 && worseColourLead === 0)
  ? '✅ Καμία περιοχή δεν χειροτέρεψε: κανένα βάθρο δεν άδειασε και καμία κορυφή δεν πήρε χειρότερο χρώμα.'
  : '⚠️  ΥΠΑΡΧΟΥΝ ΧΕΙΡΟΤΕΡΕΥΣΕΙΣ — δες τα παραδείγματα πριν φύγει οτιδήποτε.';
console.log(verdict);

const outDir = path.join(root, 'reports');
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'podium-fill-change.json'), JSON.stringify({
  regions: regions.length, scenarios, changed, fuller, emptier, reordered, worseColourLead,
  wasSingle, singleFixed, stillSingle, regionsFuller,
  examples: worstExamples,
}, null, 2));
console.log('\nreports/podium-fill-change.json');
