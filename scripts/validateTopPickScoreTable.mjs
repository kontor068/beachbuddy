/**
 * Ο ΠΙΝΑΚΑΣ ΤΩΝ 100 ΛΕΕΙ ΑΥΤΟ ΠΟΥ ΥΠΟΣΧΕΤΑΙ — gate.
 *
 * WHY IT EXISTS. On 10/08/2026 the podium stopped being a lexicographic ladder and became one
 * weighted score (utils/topPickScoreTable.ts), on Miltos's instruction: «φτιάξε έναν πίνακα με την
 * αντίστοιχη βαρύτητα στα 100». Measured over 110 regions × 8 wind sectors × 4 Beaufort: the #1
 * pick changes in 50,0% of cases and the full Top 3 in 69,4%. A change that large is only safe if
 * the properties the split was chosen FOR are asserted, because nothing else downstream can see
 * them — the ranking is the last word, and a wrong weight looks exactly like a right one.
 *
 * WHAT IT ASSERTS:
 *
 *   A. THE TABLE IS THE TABLE. Weights sum to 100, the split is 70 weather / 30 everything else,
 *      and inside that 30 the order Miltos set holds: distance > facilities > access > crowd.
 *      A silent drift here re-weights the entire site.
 *   B. UMBRELLAS CANNOT BUY WEATHER. At the SAME distance, an exposed beach with perfect access,
 *      full facilities and the best crowd tier must never outscore a protected one on identical
 *      wind and sea: facilities + access + crowd total 20 and shelter alone is 25.
 *      Distance is deliberately held equal here. It is the one human axis that CAN overturn
 *      shelter — 10 points of "it is twenty minutes away" against 25 of "it is calm there" is a
 *      real trade a real person makes, and at 70/30 a beach that is near, equipped, reachable and
 *      loved will outrank a sheltered one 200 km away with nothing. That is the intended meaning
 *      of the split Miltos set on 11/08, not a leak in it.
 *   C. NOISE DOES NOT REORDER. Two sea heights inside the model's own error bar must score
 *      identically, and SEA_STEP_M must equal PODIUM_SEA_MEANINGFUL_DIFFERENCE_M. If the steps
 *      ever get finer than the instrument, the podium reshuffles daily on nothing.
 *   D. MISSING DATA IS NEUTRAL, NEVER ZERO. A beach with no wave reading, no exposure verdict and
 *      no crowd tier must score in the middle of each of those axes, not at the floor. 916 beaches
 *      have no Google identity and 1.410 share a marine cell; scoring absence as "bad" would bury
 *      exactly the quiet coastline this site exists to surface.
 *   E. POPULARITY LIFTS, GENTLY, AND IGNORANCE IS NOT EMPTINESS. The crowd axis only ever adds,
 *      never exceeds its 5-point weight, and a beach Google has never heard of scores in the
 *      middle rather than at zero — 916 beaches have no Google identity and "we did not find it"
 *      must not read as "nobody goes there".
 *   G. DISTANCE IS NEUTRAL WITHOUT A LOCATION. With no distance shared, two identical beaches must
 *      score identically, so the prerender, the planner and every first paint show the same podium
 *      to everyone. A nearer beach outscores a far one, and the axis never exceeds its 10 points.
 *   F. THE PAID DOOR HOLDS, NATIONALLY. Over every region and wind state, no beach with a
 *      paidEntry flag may appear in a Top 3. Measured before the door existed: 32 podiums across
 *      the sweep contained one.
 *
 * SELF-PROOF (--prove): four regressions — comfort raised to 50, the sea step made continuous,
 * missing data scored as zero, and the missing distance given the maximum instead of the middle —
 * must each make the gate fail.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

const ranking = require(path.join(root, 'services/topPickRanking.ts'));
const { PODIUM_SEA_MEANINGFUL_DIFFERENCE_M, prioritizeProtectedRecommendations, hasPaidEntryTopPickBlocker } = ranking;

const failures = [];
const fail = m => failures.push(m);

const beachFixture = ({ id, rich = false, tier, rating, paid = false }) => ({
  id,
  name: { gr: `B${id}`, en: `B${id}` },
  coordinates: { lat: 38.1, lon: 24.0 },
  accessibility: 'easy',
  metadata: { access: { type: 'asphalt_road' }, organized: rich },
  amenities: rich
    ? { organized: true, beachBar: true, sunbeds: true, parking: true, naturalShade: true }
    : {},
  environment: rich ? { familyFriendly: true } : {},
  ...(tier || typeof rating === 'number' ? { popularity: { ...(tier ? { tier } : {}), ...(typeof rating === 'number' ? { rating } : {}) } } : {}),
  ...(paid ? { paidEntry: { kind: 'entrance_fee' } } : {}),
});

const item = ({ id, rich = false, tier, rating, exposure = 'protected', seaM, periodS = 4, shoreM, paid = false }) => ({
  beach: beachFixture({ id, rich, tier, rating, paid }),
  beachId: id,
  score: 70,
  isExposed: exposure === 'exposed',
  exposureLevel: exposure,
  canClaimWindProtection: exposure === 'protected',
  seaStateWaveM: seaM,
  seaStatePeriodS: periodS,
  shoreWaveHeightM: shoreM,
});

const run = (table) => {
  const local = [];
  const { TOP_PICK_WEIGHTS, SEA_STEP_M, scoreTopPick } = table;
  const score = (it, { ownBeaufort = 4, feelsWind = true, accessPriority = 0, amenitiesScore = 0, distanceKm } = {}) =>
    scoreTopPick({ item: it, ownBeaufort, feelsWind, accessPriority, amenitiesScore, distanceKm }).total;

  // A
  const sum = Object.values(TOP_PICK_WEIGHTS).reduce((a, b) => a + b, 0);
  if (sum !== 100) local.push(`A: weights sum to ${sum}, not 100.`);
  const weather = TOP_PICK_WEIGHTS.shelter + TOP_PICK_WEIGHTS.ownWind + TOP_PICK_WEIGHTS.sea;
  const human = TOP_PICK_WEIGHTS.distance + TOP_PICK_WEIGHTS.amenities + TOP_PICK_WEIGHTS.access + TOP_PICK_WEIGHTS.crowd;
  if (weather !== 70 || human !== 30) {
    local.push(`A: split is ${weather}/${human}, not the 70/30 Miltos settled on 11/08/2026.`);
  }
  if (!(TOP_PICK_WEIGHTS.distance > TOP_PICK_WEIGHTS.amenities
    && TOP_PICK_WEIGHTS.amenities > TOP_PICK_WEIGHTS.access
    && TOP_PICK_WEIGHTS.access > TOP_PICK_WEIGHTS.crowd)) {
    local.push(`A: human axes out of the order Miltos set (distance ${TOP_PICK_WEIGHTS.distance} > facilities ${TOP_PICK_WEIGHTS.amenities} > access ${TOP_PICK_WEIGHTS.access} > crowd ${TOP_PICK_WEIGHTS.crowd}).`);
  }

  // B — weather cannot be bought
  const exposedLuxury = score(
    item({ id: 1, rich: true, exposure: 'exposed', seaM: 0.4, tier: 'crowded' }),
    { accessPriority: 0, amenitiesScore: 22, distanceKm: 12 }
  );
  const protectedBare = score(
    item({ id: 2, rich: false, exposure: 'protected', seaM: 0.4 }),
    { accessPriority: 5, amenitiesScore: 0, distanceKm: 12 }
  );
  if (exposedLuxury >= protectedBare) {
    local.push(`B: at the same distance, an exposed beach with everything (${exposedLuxury}) matched or beat a protected bare one (${protectedBare}) on identical sea and wind. Umbrellas are buying weather.`);
  }

  // C — noise does not reorder
  if (SEA_STEP_M !== PODIUM_SEA_MEANINGFUL_DIFFERENCE_M) {
    local.push(`C: SEA_STEP_M (${SEA_STEP_M}) has drifted from PODIUM_SEA_MEANINGFUL_DIFFERENCE_M (${PODIUM_SEA_MEANINGFUL_DIFFERENCE_M}).`);
  }
  const seaA = score(item({ id: 3, seaM: 0.50 }));
  const seaB = score(item({ id: 4, seaM: 0.50 + SEA_STEP_M * 0.6 }));
  if (seaA !== seaB) {
    local.push(`C: two sea heights inside the model's error bar scored differently (${seaA} vs ${seaB}).`);
  }
  const seaFar = score(item({ id: 5, seaM: 0.50 + SEA_STEP_M * 2 }));
  if (seaFar >= seaA) {
    local.push(`C: a sea difference well beyond the error bar did not lower the score (${seaFar} vs ${seaA}).`);
  }

  // D — missing data is neutral.
  // 'unknown' rather than undefined on purpose: the fixture defaults `exposure` to 'protected',
  // so passing undefined silently produced a fully-sheltered beach and this assertion tested
  // nothing. The self-proof caught exactly that on 10/08/2026 — which is what it is for.
  const noData = score(item({ id: 6, exposure: 'unknown', seaM: undefined }));
  const worstData = score(item({ id: 7, exposure: 'exposed', seaM: 3.0 }));
  const bestData = score(item({ id: 8, exposure: 'protected', seaM: 0.0 }));
  if (noData <= worstData) {
    local.push(`D: a beach with NO data (${noData}) scored no better than the worst possible conditions (${worstData}). Absence is being punished.`);
  }
  if (noData >= bestData) {
    local.push(`D: a beach with NO data (${noData}) scored at or above perfect conditions (${bestData}). Absence is being rewarded.`);
  }

  /**
   * E — popularity lifts, gently, and "we never found it" is not "nobody goes there".
   *
   * Rewritten 11/08/2026 when Miltos overturned the crowd penalty («αφού πάει πολύς κόσμος λογικά
   * καλή θα είναι») and then chose the review COUNT over the star rating. The known cost is that
   * the same famous names gain everywhere, which is why the cap matters and why the 916 beaches
   * with no Google identity sit in the middle of this axis rather than at its floor.
   */
  const noTier = score(item({ id: 9, seaM: 0.4 }));
  const crowded = score(item({ id: 10, seaM: 0.4, tier: 'crowded' }));
  const secluded = score(item({ id: 11, seaM: 0.4, tier: 'secluded' }));
  if (!(crowded > noTier && noTier > secluded)) {
    local.push(`E: the crowd axis does not order crowded > unknown > secluded (${crowded} / ${noTier} / ${secluded}).`);
  }
  if (crowded - secluded > TOP_PICK_WEIGHTS.crowd) {
    local.push(`E: the crowd axis spans ${crowded - secluded} points, over its ${TOP_PICK_WEIGHTS.crowd} weight.`);
  }

  /**
   * G — distance is neutral when nobody shared a location.
   *
   * This axis knowingly re-opens the defect that got score-ranking rejected on 10/08 (two visitors,
   * same weather, different podium). The containment is that with no location every beach lands on
   * the same middle value, so the prerender, the planner and every first paint stay identical for
   * everyone — and that the missing case is the MIDDLE, never the maximum, or a region where only
   * some beaches carry a distance would rank the unmeasured ones first.
   */
  const near = score(item({ id: 12, seaM: 0.4 }), { distanceKm: 2 });
  const far = score(item({ id: 13, seaM: 0.4 }), { distanceKm: 150 });
  const noLocation = score(item({ id: 14, seaM: 0.4 }));
  if (!(near > noLocation && noLocation > far)) {
    local.push(`G: distance does not order near > unknown > far (${near} / ${noLocation} / ${far}).`);
  }
  if (near - far > TOP_PICK_WEIGHTS.distance) {
    local.push(`G: the distance axis spans ${near - far} points, over its ${TOP_PICK_WEIGHTS.distance} weight.`);
  }
  const twinA = score(item({ id: 15, seaM: 0.4, tier: 'quiet' }));
  const twinB = score(item({ id: 16, seaM: 0.4, tier: 'quiet' }));
  if (twinA !== twinB) {
    local.push('G: two identical beaches scored differently with no location shared.');
  }

  return local;
};

// The real table, plus F which needs the ranking module and the real dataset.
const realTable = require(path.join(root, 'utils/topPickScoreTable.ts'));
failures.push(...run(realTable));

// F — the paid door, over every region and wind state
{
  const dir = path.join(root, 'public', 'data', 'beaches');
  const regions = [];
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory() || !f.endsWith('.json')) continue;
    const j = JSON.parse(readFileSync(p, 'utf8'));
    const list = (Array.isArray(j) ? j : Object.values(j)).filter(b => b && typeof b === 'object' && b.id != null && b.name);
    if (list.length) regions.push([f.replace('.json', ''), list]);
  }
  if (regions.length < 100) {
    fail(`F: loaded only ${regions.length} regions — run "npm run build:beach-data" first.`);
  }
  const angleDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  let paidInPodium = 0, pools = 0, examined = 0;
  for (const [regionId, beaches] of regions) {
    if (!beaches.some(b => b.paidEntry || b.metadata?.paidEntry)) continue;
    pools++;
    for (const windDir of [0, 90, 180, 270]) {
      for (const bft of [3, 4, 5, 6]) {
        const items = beaches.map(b => {
          const facing = b.geospatial?.facingDirection ?? b.orientation?.facing;
          const offshore = typeof facing === 'number' ? angleDiff(facing, (windDir + 180) % 360) < 60 : false;
          const onshore = typeof facing === 'number' ? angleDiff(facing, windDir) < 60 : false;
          const exposureLevel = offshore ? 'protected' : onshore ? 'exposed' : 'partial';
          const base = { 3: 0.35, 4: 0.6, 5: 0.95, 6: 1.4 }[bft];
          return {
            beach: b, beachId: b.id, score: 65,
            isExposed: exposureLevel === 'exposed', exposureLevel,
            canClaimWindProtection: exposureLevel === 'protected',
            seaStateWaveM: onshore ? base : offshore ? base * 0.2 : base * 0.6,
            seaStatePeriodS: 4,
          };
        });
        if (items.length < 3) continue;
        examined++;
        const top3 = prioritizeProtectedRecommendations(items, bft).slice(0, 3);
        const offender = top3.find(i => hasPaidEntryTopPickBlocker(i.beach));
        if (offender) {
          paidInPodium++;
          if (paidInPodium <= 3) fail(`F: paid beach ${offender.beach.id} in the Top 3 of ${regionId} at ${bft} Bft, wind ${windDir}°.`);
        }
      }
    }
  }
  if (paidInPodium > 3) fail(`F: ...and ${paidInPodium - 3} more paid beaches in podiums.`);
  if (examined === 0) fail('F: no region with a paid beach was examined — the check is inert.');
  else if (!failures.some(f => f.startsWith('F:'))) {
    console.log(`paid door: ${examined} podiums across ${pools} regions holding a paid beach — 0 reached a Top 3.`);
  }
}

if (failures.length) {
  console.error('❌ Ο πίνακας των 100 δεν λέει αυτό που υπόσχεται:\n');
  failures.forEach(f => console.error(`  • ${f}\n`));
  process.exit(1);
}
console.log(`✅ Πίνακας των 100: 70/30 · θάλασσα ανά ${realTable.SEA_STEP_M} μ. · απόσταση ${realTable.TOP_PICK_WEIGHTS.distance} · παροχές ${realTable.TOP_PICK_WEIGHTS.amenities} · πρόσβαση ${realTable.TOP_PICK_WEIGHTS.access} · πολυσύχναστη ${realTable.TOP_PICK_WEIGHTS.crowd}.`);

if (PROVE) {
  const source = readFileSync(path.join(root, 'utils/topPickScoreTable.ts'), 'utf8');
  const regressions = [
    ['οι παροχές ανέβηκαν στο 50', s => s.replace(/access: 6,/, 'access: 30,').replace(/amenities: 9,/, 'amenities: 15,')],
    ['το βήμα της θάλασσας έγινε συνεχές', s => s.replace(/export const SEA_STEP_M = 0\.25;/, 'export const SEA_STEP_M = 0.001;')],
    ['το κενό δεδομένο βαθμολογείται μηδέν', s => s
      .replace(/return axis\('sea', 14, max, true\);/, "return axis('sea', 0, max, true);")
      .replace(/return axis\('shelter', max \/ 2, max, true\);/, "return axis('shelter', 0, max, true);")],
    ['η άγνωστη απόσταση πήρε το μέγιστο', s => s.replace(
      /return axis\('distance', max \/ 2, max, true\);/,
      "return axis('distance', max, max, true);")],
  ];
  for (const [label, mutate] of regressions) {
    const mutated = mutate(source);
    if (mutated === source) {
      console.error(`❌ SELF-PROOF: η προσομοίωση «${label}» δεν άλλαξε τίποτα — η πύλη διαβάζει άλλον κώδικα.`);
      process.exit(1);
    }
    const out = ts.transpileModule(mutated, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    }).outputText;
    const broken = {};
    try {
      new Function('exports', 'require', out)(
        broken,
        p => require(path.resolve(path.join(root, 'utils'), p) + (p.endsWith('.ts') ? '' : '.ts'))
      );
    } catch (error) {
      console.error(`❌ SELF-PROOF: δεν φορτώθηκε η προσομοίωση «${label}» — ${error.message}`);
      process.exit(1);
    }
    if (run(broken).length === 0) {
      console.error(`❌ SELF-PROOF: η προσομοίωση «${label}» πέρασε καθαρή — η πύλη δεν ελέγχει τίποτα.`);
      process.exit(1);
    }
  }
  console.log('self-proof: 4/4 προσομοιωμένες παλινδρομήσεις απέτυχαν σωστά.');
}
