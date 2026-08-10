/**
 * ΤΟ PODIUM ΔΕΝ ΒΑΖΕΙ ΤΙΣ ΟΜΠΡΕΛΕΣ ΠΑΝΩ ΑΠΟ ΤΗ ΘΑΛΑΣΣΑ — gate.
 *
 * WHY IT EXISTS. On 10/08/2026 Miltos asked why a beach scoring 76 came second. The answer was
 * that the podium's ladder — exposure → colour → own-shore wind → recognition → access →
 * distance → AMENITIES → score — stops at the first rung that separates two beaches, and in East
 * Attica at 5 Bft every condition rung tied: ten candidates, all protected, all yellow, all 5 Bft,
 * all recognition 0, all asphalt. So two points of parking-and-shade (22 vs 20) ordered a podium
 * standing under a heading about shelter, and the sea never got a say.
 *
 * There was NO gate on podium ORDER at all — 33 gates, and every one of them asked whether a
 * claim was true, none asked whether the ranking meant what its heading says. This is that gate.
 *
 * WHAT IT ASSERTS, by driving the REAL prioritizeProtectedRecommendations:
 *
 *   A. SEA BEFORE COMFORT. Two beaches identical on every condition rung, one with a calmer sea
 *      by more than the model's own error bar and WORSE amenities/recognition: the calmer sea
 *      must lead. This is the reported defect, in one row.
 *   B. NOISE DOES NOT REORDER. The same pair with a sea difference UNDER the threshold must keep
 *      the previous order (amenities decide) — a podium that reshuffles inside its own error bar
 *      is publishing noise, and would also make the daily order flicker for no reason.
 *   C. THE SHORE NUMBER WINS WHERE IT SPEAKS. A lee shore whose open-water cell reads rough but
 *      whose modelled shore height is flat must rank on the FLAT one. Σχινιάς is the case: 1,22 m
 *      taken 9,4 km offshore, ~0,15 m at the sand. Ranking it on the offshore figure would undo,
 *      in the ranking, exactly what the swim verdict stopped doing the same evening.
 *   D. THE CONDITION RUNGS STILL OUTRANK THE SEA TIER. A calmer sea must NOT lift a beach above
 *      one the map painted calmer, or one with less wind on its own shore. The new rung sits
 *      below them, and this row fails if it is ever hoisted above.
 *   E. SILENCE WITHOUT DATA. With no sea readings at all the order must be byte-identical to the
 *      pre-change behaviour, so the planner, the prerender and the first paint are untouched.
 *
 * SELF-PROOF (--prove): three regressions are simulated in memory and each MUST make the gate
 * fail — (1) the sea rung removed, (2) the threshold set to zero, (3) the shore height ignored in
 * favour of the open-water cell. A gate that cannot fail is decoration.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROVE = process.argv.includes('--prove');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

const {
  prioritizeProtectedRecommendations,
  PODIUM_SEA_MEANINGFUL_DIFFERENCE_M,
} = require(path.join(root, 'services/topPickRanking.ts'));

/**
 * A candidate that clears every condition rung, so only the rung under test can separate two of
 * them. `amenities` is expressed through the fields topPickAmenitiesScore actually reads.
 */
const beach = ({ id, name, rich }) => ({
  id,
  name: { gr: name, en: name },
  coordinates: { lat: 38.1, lon: 24.0 },
  accessibility: 'easy',
  metadata: { access: { type: 'asphalt_road' }, organized: rich },
  amenities: rich
    ? { organized: true, beachBar: true, sunbeds: true, parking: true, naturalShade: true }
    : { organized: true },
  environment: rich ? { familyFriendly: true } : {},
  // Opens a real Google pin: without it the navigation door (11/08/2026) empties the pool and
  // every order below would compare two absences.
  googleMapsNavigation: { status: 'verified', mode: 'place', placeId: `pid-${id}` },
});

const candidate = ({ id, name, rich = false, seaM, periodS = 4, shoreM, tone = 1, ownBft = 5 }) => ({
  beach: beach({ id, name, rich }),
  beachId: id,
  name,
  score: 70,
  isExposed: false,
  exposureLevel: 'protected',
  canClaimWindProtection: true,
  seaStateWaveM: seaM,
  seaStatePeriodS: periodS,
  shoreWaveHeightM: shoreM,
  _tone: tone,
  _ownBft: ownBft,
});

const rank = (items, { withSea = true } = {}) => {
  const perBeachWind = new Map(items.map(i => [i.beach.id, { beaufort: i._ownBft }]));
  const toneRank = id => items.find(i => i.beach.id === id)?._tone;
  const prepared = withSea ? items : items.map(i => ({ ...i, seaStateWaveM: undefined, shoreWaveHeightM: undefined }));
  return prioritizeProtectedRecommendations(prepared, 5, perBeachWind, toneRank).map(i => i.beach.name.gr);
};

const failures = [];
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures.push(`${label}\n    περίμενα: ${JSON.stringify(expected)}\n    πήρα:     ${JSON.stringify(actual)}`);
  return ok;
};

// A. The reported defect: calmer sea, worse amenities — must still lead.
const calmPoor = candidate({ id: 1, name: 'ΗΡΕΜΗ', rich: false, seaM: 0.5 });
const roughRich = candidate({ id: 2, name: 'ΦΟΥΡΤΟΥΝΑ', rich: true, seaM: 1.1 });
check('A. πιο ήρεμη θάλασσα πάνω από περισσότερες παροχές', rank([roughRich, calmPoor]), ['ΗΡΕΜΗ', 'ΦΟΥΡΤΟΥΝΑ']);

// B. Inside the model's error bar the sea says nothing and amenities decide, as before.
const nearA = candidate({ id: 3, name: 'ΛΙΓΟ-ΗΡΕΜΗ', rich: false, seaM: 0.50 });
const nearB = candidate({ id: 4, name: 'ΠΑΡΟΧΕΣ', rich: true, seaM: 0.50 + (PODIUM_SEA_MEANINGFUL_DIFFERENCE_M * 0.5) });
check('B. διαφορά μέσα στο σφάλμα του μοντέλου δεν αναδιατάσσει', rank([nearA, nearB]), ['ΠΑΡΟΧΕΣ', 'ΛΙΓΟ-ΗΡΕΜΗ']);

// C. Σχινιάς: rough cell offshore, flat sand — the sand is what ranks.
const leeShore = candidate({ id: 5, name: 'ΣΧΟΙΝΙΑΣ', rich: false, seaM: 1.22, shoreM: 0.15 });
const plainCalm = candidate({ id: 6, name: 'ΑΛΛΗ', rich: true, seaM: 0.55 });
check('C. το κύμα στην άμμο κατατάσσει, όχι το κελί 9 χλμ έξω', rank([plainCalm, leeShore]), ['ΣΧΟΙΝΙΑΣ', 'ΑΛΛΗ']);

// D. The condition rungs still outrank it — colour first, then the wind on that shore.
const calmerButOranger = candidate({ id: 7, name: 'ΠΟΡΤΟΚΑΛΙ', seaM: 0.3, tone: 2 });
const yellowRougher = candidate({ id: 8, name: 'ΚΙΤΡΙΝΗ', seaM: 1.0, tone: 1 });
check('D1. το χρώμα του χάρτη μένει πάνω από το νέο σκαλί', rank([calmerButOranger, yellowRougher]), ['ΚΙΤΡΙΝΗ', 'ΠΟΡΤΟΚΑΛΙ']);
/**
 * D2, rewritten 10/08/2026 when the ladder became Ο ΠΙΝΑΚΑΣ ΤΩΝ 100.
 *
 * It used to assert that the wind on that shore outranks the sea ALWAYS — 0,3 m at 6 Bft had to
 * lose to 1,0 m at 5 Bft. That is a statement about a ladder, not about the sea: under a weighted
 * table with wind and sea both at 25, one Beaufort cannot outweigh 0,7 m of wave, and it should
 * not. The beach in question is swimmable; the other one is not.
 *
 * What is actually worth protecting is that the wind still COUNTS, so the assertion is now the
 * honest form of it: with the sea equal, less wind on your own shore wins. The old case is kept
 * directly below as D3, inverted, so the behaviour change is recorded in the gate rather than
 * discovered later by someone who assumes it was an accident.
 */
const windyEqualSea = candidate({ id: 9, name: 'ΑΕΡΑΣ', seaM: 0.5, ownBft: 6 });
const calmEqualSea = candidate({ id: 10, name: 'ΥΠΗΝΕΜΗ', seaM: 0.5, ownBft: 4 });
check('D2. με ίδια θάλασσα, λιγότερος άνεμος στη δική της ακτή κερδίζει', rank([windyEqualSea, calmEqualSea]), ['ΥΠΗΝΕΜΗ', 'ΑΕΡΑΣ']);

// D3. DELIBERATE CHANGE, recorded on purpose: a large sea gap now beats a small wind gap. Under
// the old ladder ΥΠΗΝΕΜΗ led on one Beaufort while standing in a metre of wave. In the app the
// colour would usually separate these two first (6 Bft is orange by decision), so this is mainly
// the planner's and the prerender's path, where no pin has painted a tone.
const flatButWindy = candidate({ id: 11, name: 'ΛΑΔΙ-ΜΕ-ΑΕΡΑ', seaM: 0.3, ownBft: 6 });
const roughButSheltered = candidate({ id: 12, name: 'ΚΥΜΑ-ΥΠΗΝΕΜΗ', seaM: 1.0, ownBft: 5 });
check('D3. μεγάλη διαφορά θάλασσας νικά μικρή διαφορά ανέμου (σκόπιμη αλλαγή)', rank([roughButSheltered, flatButWindy]), ['ΛΑΔΙ-ΜΕ-ΑΕΡΑ', 'ΚΥΜΑ-ΥΠΗΝΕΜΗ']);

// E. No readings at all — untouched behaviour (amenities decide, as they always did).
check('E. χωρίς μετρήσεις θάλασσας η σειρά μένει όπως ήταν', rank([calmPoor, roughRich], { withSea: false }), ['ΦΟΥΡΤΟΥΝΑ', 'ΗΡΕΜΗ']);

if (PROVE) {
  /**
   * The gate must be able to fail. Since 10/08/2026 the sea logic lives in the weighted table
   * (utils/topPickScoreTable.ts), not in the comparator, so the regressions are injected there and
   * the ranking module is re-loaded on top of the broken table — mutating topPickRanking.ts alone
   * would now mutate a file that no longer decides this, and the self-proof would pass while
   * proving nothing. That is exactly the failure this block caught when the table landed.
   */
  const rankingSource = readFileSync(path.join(root, 'services/topPickRanking.ts'), 'utf8');
  const tableSource = readFileSync(path.join(root, 'utils/topPickScoreTable.ts'), 'utf8');
  const regressions = [
    ['η θάλασσα βγήκε από τον πίνακα', s => s.replace(/ {2}sea: 25,/, '  sea: 0,')],
    ['το κατώφλι λεπτύνθηκε κάτω από το σφάλμα', s => s.replace(/export const SEA_STEP_M = 0\.25;/, 'export const SEA_STEP_M = 0.001;')],
    ['αγνοήθηκε το κύμα στην άμμο', s => s.replace(/shoreM <= decisionM \? shoreM : decisionM/, 'decisionM')],
  ];
  const compile = (source, fileName) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName,
  }).outputText;

  for (const [label, mutate] of regressions) {
    const mutatedTable = mutate(tableSource);
    if (mutatedTable === tableSource) {
      failures.push(`SELF-PROOF: η προσομοίωση «${label}» δεν άλλαξε τίποτα — η πύλη διαβάζει άλλον κώδικα`);
      continue;
    }
    let broken;
    try {
      // Load the mutated table first, then hand it to a fresh copy of the ranking module.
      const tableExports = {};
      new Function('exports', 'require', compile(mutatedTable, 'topPickScoreTable.ts'))(
        tableExports,
        p => require(path.resolve(path.join(root, 'utils'), p) + (p.endsWith('.ts') ? '' : '.ts'))
      );
      const rankingExports = {};
      new Function('exports', 'require', compile(rankingSource, 'topPickRanking.ts'))(
        rankingExports,
        p => (p.includes('topPickScoreTable')
          ? tableExports
          : require(path.resolve(path.join(root, 'services'), p) + (p.endsWith('.ts') ? '' : '.ts')))
      );
      broken = rankingExports;
    } catch (error) {
      failures.push(`SELF-PROOF: δεν φορτώθηκε η προσομοίωση «${label}» — ${error.message}`);
      continue;
    }
    const brokenRank = items => {
      const perBeachWind = new Map(items.map(i => [i.beach.id, { beaufort: i._ownBft }]));
      const toneRank = id => items.find(i => i.beach.id === id)?._tone;
      return broken.prioritizeProtectedRecommendations(items, 5, perBeachWind, toneRank).map(i => i.beach.name.gr);
    };
    const stillCorrect =
      JSON.stringify(brokenRank([roughRich, calmPoor])) === JSON.stringify(['ΗΡΕΜΗ', 'ΦΟΥΡΤΟΥΝΑ']) &&
      JSON.stringify(brokenRank([nearA, nearB])) === JSON.stringify(['ΠΑΡΟΧΕΣ', 'ΛΙΓΟ-ΗΡΕΜΗ']) &&
      JSON.stringify(brokenRank([plainCalm, leeShore])) === JSON.stringify(['ΣΧΟΙΝΙΑΣ', 'ΑΛΛΗ']);
    if (stillCorrect) {
      failures.push(`SELF-PROOF: η προσομοίωση «${label}» πέρασε καθαρή — η πύλη δεν ελέγχει τίποτα`);
    }
  }
}

if (failures.length > 0) {
  console.error('❌ Το podium δεν κατατάσσει με τη θάλασσα:\n');
  failures.forEach(f => console.error(`  • ${f}\n`));
  process.exit(1);
}

console.log(`✅ Podium sea order: ${PROVE ? '7 έλεγχοι + 3 προσομοιωμένες παλινδρομήσεις' : '7 έλεγχοι'} — κατώφλι ${PODIUM_SEA_MEANINGFUL_DIFFERENCE_M} μ.`);
