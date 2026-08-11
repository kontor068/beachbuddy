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
 *   H. THE RATING PREFERENCE HAS TWO ROUTES AND STANDS DOWN RATHER THAN EMPTY A PODIUM.
 *      Above 4,5 qualifies; so does 4,2 or better with more than 500 reviews, because a 4,3 over
 *      13.211 visits is a surer bet than a 4,7 over eleven. A beach with no rating passes. Below
 *      4,2 never qualifies however busy it is. And when fewer than three candidates qualify the
 *      preference must release the whole pool — measured 11/08: as a hard filter, >4,5 leaves a
 *      full Top 3 in only 71,6% of cases and blanks the podium in 12,7%.
 *   F. THE DOORS HOLD, NATIONALLY. Over every region and wind state, no beach with a paidEntry
 *      flag and no beach whose navigation would hand over a coordinate instead of a Google pin may
 *      appear in a Top 3. Measured before the doors existed: 32 podiums in the sweep contained a
 *      paid beach, and 1.158 of 3.142 records cannot open a place card of their own.
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
const { PODIUM_SEA_MEANINGFUL_DIFFERENCE_M, prioritizeProtectedRecommendations, hasPaidEntryTopPickBlocker, opensGoogleMapsPin } = ranking;

const failures = [];
const fail = m => failures.push(m);

const beachFixture = ({ id, rich = false, tier, rating, ratingCount, paid = false }) => ({
  id,
  name: { gr: `B${id}`, en: `B${id}` },
  coordinates: { lat: 38.1, lon: 24.0 },
  accessibility: 'easy',
  metadata: { access: { type: 'asphalt_road' }, organized: rich },
  amenities: rich
    ? { organized: true, beachBar: true, sunbeds: true, parking: true, naturalShade: true }
    : {},
  environment: rich ? { familyFriendly: true } : {},
  ...(tier || typeof rating === 'number' ? { popularity: { ...(tier ? { tier } : {}), ...(typeof rating === 'number' ? { rating } : {}), ...(typeof ratingCount === 'number' ? { ratingCount } : {}) } } : {}),
  ...(paid ? { paidEntry: { kind: 'entrance_fee' } } : {}),
  // Every fixture opens a real pin unless a case is specifically about that door — otherwise the
  // paid-entry and ordering assertions would all be testing an empty pool.
  googleMapsNavigation: { status: 'verified', mode: 'place', placeId: `pid-${id}` },
});

const item = ({ id, rich = false, tier, rating, ratingCount, exposure = 'protected', seaM, periodS = 4, shoreM, paid = false }) => ({
  beach: beachFixture({ id, rich, tier, rating, ratingCount, paid }),
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
  const human = TOP_PICK_WEIGHTS.amenities + TOP_PICK_WEIGHTS.access + TOP_PICK_WEIGHTS.crowd;
  if (weather !== 80 || human !== 20) {
    local.push(`A: split is ${weather}/${human}, not 80/20.`);
  }
  // The invariant the split has to satisfy, stated so nobody has to rediscover it: the human block
  // must not be able to overturn any single weather axis on its own. 11/08 proved what happens when
  // it can — a running sea with sunbeds outranking a calm shore without.
  const smallestWeatherAxis = Math.min(TOP_PICK_WEIGHTS.shelter, TOP_PICK_WEIGHTS.sea, TOP_PICK_WEIGHTS.ownWind);
  if (human >= smallestWeatherAxis) {
    local.push(`A: the human block (${human}) is not smaller than the smallest weather axis (${smallestWeatherAxis}), so umbrellas can outrank the sea.`);
  }
  if (!(TOP_PICK_WEIGHTS.amenities > TOP_PICK_WEIGHTS.access
    && TOP_PICK_WEIGHTS.access > TOP_PICK_WEIGHTS.crowd)) {
    local.push(`A: human axes out of the order Miltos set (facilities ${TOP_PICK_WEIGHTS.amenities} > access ${TOP_PICK_WEIGHTS.access} > crowd ${TOP_PICK_WEIGHTS.crowd}).`);
  }
  if ('distance' in TOP_PICK_WEIGHTS) {
    local.push('A: a distance weight is back in the table. The region podium is not allowed a per-visitor input — see assertion I and services/topPickRanking.');
  }

  /**
   * B — ΟΙ ΟΜΠΡΕΛΕΣ ΔΕΝ ΑΓΟΡΑΖΟΥΝ ΤΟΝ ΚΑΙΡΟ, ΚΑΙ Ο ΕΛΕΓΧΟΣ ΓΙΝΕΤΑΙ ΟΠΟΥ ΚΡΙΝΕΤΑΙ.
   *
   * Until 11/08 this drove the bare table and compared totals: facilities + access + crowd came to
   * 20 against 25 of shelter, so the sum alone could not overturn exposure. When the distance axis
   * was deleted and its ten points went to facilities and access, the human block reached 30 and
   * the table-level comparison inverted — an exposed beach with everything scored 61 against 58.
   *
   * The right response was not to shave weights until the arithmetic came out. It was to ask where
   * the promise is actually kept, and the answer is one layer up: from MEANINGFUL_WIND_TOP_PICK_
   * BEAUFORT (3 Bft) the more exposed beach is not outscored, it is removed from the pool —
   * getWindPriorityTopPickPool and bestShelteredRecommendationGroup run before anything is scored.
   * Measured 11/08 on the real chain: at 3, 4 and 5 Bft the pool arrives holding ONE beach.
   *
   * So B now drives prioritizeProtectedRecommendations, and it pins both halves of Miltos's rule
   * («αν είναι λίγο πιο εκτεθειμένη δεν πειράζει, αν είναι πολύ πειράζει»): while there is wind,
   * not even one step of exposure can be bought — and on a calm day the equipped beach wins, which
   * is correct rather than a leak, because there is no wind to be sheltered from and every beach is
   * scored as fully sheltered. That second case is asserted too, so that a later reader cannot
   * "fix" it back into a false promise.
   */
  const luxury = (exposure) => item({ id: 1, rich: true, exposure, seaM: 0.4, tier: 'crowded' });
  const bare = () => item({ id: 2, rich: false, exposure: 'protected', seaM: 0.4 });
  for (const bft of [3, 4, 5]) {
    for (const exposure of ['exposed', 'partial']) {
      const winner = prioritizeProtectedRecommendations([luxury(exposure), bare()], bft)[0];
      if (!winner || winner.beach.id !== 2) {
        local.push(`B: at ${bft} Bft a ${exposure} beach with full facilities, asphalt and the best crowd tier beat a bare protected one on identical sea. Umbrellas are buying weather.`);
      }
    }
  }
  const calmWinner = prioritizeProtectedRecommendations([luxury('exposed'), bare()], 2)[0];
  if (!calmWinner || calmWinner.beach.id !== 1) {
    local.push('B: on a 2 Bft day the equipped beach no longer wins. Shelter is not a virtue when there is no wind — every beach is scored fully sheltered there, so this is the intended result and something has changed underneath it.');
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
   * H — the rating preference: two routes in, and a release valve.
   *
   * Miltos set the second route on 11/08 («από 4,2 και πάνω, απλά να έχουν πάνω από 500 κριτικές»)
   * and it is the statistically better rule: at low review counts a tenth of a star is noise, and
   * the national spread is only p25 4,3 to p75 4,6. It recovered 311 beaches including Κανάλι του
   * Έρωτα (4,3 over 13.211) and Πρέβελη (4,5 over 10.691), both of which a flat 4,5 was hiding.
   */
  const rated = (id, rating, ratingCount) => item({ id, seaM: 0.4, rating, ratingCount });
  const qualifies = list => table.preferWellRatedTopPicks
    ? table.preferWellRatedTopPicks(list)
    : null;
  if (!ranking.preferWellRatedTopPicks) {
    local.push('H: preferWellRatedTopPicks is gone — the rating preference is not applied at all.');
  } else {
    const pool = [
      rated(20, 4.8, 12),        // high stars, few votes — in, via route one
      rated(21, 4.3, 13211),     // trusted by volume — in, via route two
      rated(22, 4.2, 501),       // exactly over the review line — in
      rated(23, 4.3, 400),       // not enough votes to trust a 4,3 — out
      rated(24, 4.1, 9000),      // busy but genuinely poorly rated — out
      item({ id: 25, seaM: 0.4 }),  // no rating at all — in
    ];
    const kept = ranking.preferWellRatedTopPicks(pool).map(i => i.beach.id).sort((a, b) => a - b);
    const expected = [20, 21, 22, 25];
    if (JSON.stringify(kept) !== JSON.stringify(expected)) {
      local.push(`H: the preference kept ${JSON.stringify(kept)}, expected ${JSON.stringify(expected)}.`);
    }
    // Release valve: with only two qualifying, the whole pool must come back.
    const thin = [rated(30, 4.9, 5000), rated(31, 4.8, 5000), rated(32, 4.0, 5000), rated(33, 4.0, 5000)];
    if (ranking.preferWellRatedTopPicks(thin).length !== thin.length) {
      local.push('H: with fewer than three qualifying beaches the preference did not stand down — podiums will go blank.');
    }
  }

  /**
   * G — THE TABLE HAS NO PER-VISITOR INPUT AT ALL.
   *
   * Score-ranking was rejected on 10/08 for one reason: two visitors, same weather, different
   * podium. A distance axis put that back on 11/08 and was deleted the same day — so the assertion
   * is no longer "the axis is neutral when unused" (a permanently neutral axis is just a constant
   * that lies about the split) but the stronger one: nothing the visitor carries can reach this
   * table. Passing an extra argument must change nothing.
   */
  const twinA = score(item({ id: 15, seaM: 0.4, tier: 'quiet' }));
  const twinB = score(item({ id: 16, seaM: 0.4, tier: 'quiet' }));
  if (twinA !== twinB) {
    local.push('G: two identical beaches scored differently.');
  }
  const withStowaway = score(item({ id: 17, seaM: 0.4, tier: 'quiet' }), { distanceKm: 2 });
  const without = score(item({ id: 18, seaM: 0.4, tier: 'quiet' }));
  if (withStowaway !== without) {
    local.push(`G: the table still reads a per-visitor input — a beach scored ${withStowaway} with a distance and ${without} without one.`);
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
  let paidInPodium = 0, pinlessInPodium = 0, pools = 0, examined = 0;
  for (const [regionId, beaches] of regions) {
    if (!beaches.some(b => b.paidEntry || b.metadata?.paidEntry || !opensGoogleMapsPin(b))) continue;
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
        const pinless = top3.find(i => !opensGoogleMapsPin(i.beach));
        if (pinless) {
          pinlessInPodium++;
          if (pinlessInPodium <= 3) fail(`F: beach ${pinless.beach.id} has no Google pin of its own but reached the Top 3 of ${regionId} at ${bft} Bft, wind ${windDir}°.`);
        }
      }
    }
  }
  if (paidInPodium > 3) fail(`F: ...and ${paidInPodium - 3} more paid beaches in podiums.`);
  if (pinlessInPodium > 3) fail(`F: ...and ${pinlessInPodium - 3} more pinless beaches in podiums.`);
  if (examined === 0) fail('F: no region with a paid beach was examined — the check is inert.');
  else if (!failures.some(f => f.startsWith('F:'))) {
    console.log(`doors: ${examined} podiums across ${pools} regions holding a paid beach — 0 paid and 0 pinless reached a Top 3.`);
  }
}

// I — ΙΔΙΟΣ ΚΑΙΡΟΣ, ΙΔΙΟ PODIUM ΓΙΑ ΟΛΟΥΣ (Μίλτος, 11/08/2026).
//
// Assertion G proves the TABLE cannot see the visitor. This one proves the RANKING cannot either,
// because the two are separate holes: the table lost its distance axis, but `item.distance` still
// exists on every SuitableBeach and any comparator added here could pick it up — which is exactly
// how it arrived the first time.
{
  const near = { ...item({ id: 91, seaM: 0.4, tier: 'quiet' }), distance: 2 };
  const far = { ...item({ id: 92, seaM: 0.4, tier: 'quiet' }), distance: 240 };
  // The far one is listed FIRST, so any reading of distance at all has to reorder them.
  const withLocation = prioritizeProtectedRecommendations([far, near], 4).map(i => i.beach.id);
  const withoutLocation = prioritizeProtectedRecommendations(
    [item({ id: 92, seaM: 0.4, tier: 'quiet' }), item({ id: 91, seaM: 0.4, tier: 'quiet' })],
    4
  ).map(i => i.beach.id);

  if (withLocation.join(',') !== withoutLocation.join(',')) {
    fail(`I: the podium reordered once a location was known (${withoutLocation.join(' → ')} became ${withLocation.join(' → ')}). Two visitors, same weather, different Top 3.`);
  }
  // …and prove the check is not inert: these two must be otherwise inseparable, or the ordering
  // would be held in place by something else and a distance tie-break could slip in unnoticed.
  const { scoreTopPick } = realTable;
  const args = { ownBeaufort: 4, feelsWind: true, accessPriority: 0, amenitiesScore: 0 };
  const nearPoints = scoreTopPick({ ...args, item: near }).total;
  const farPoints = scoreTopPick({ ...args, item: far }).total;
  if (nearPoints !== farPoints) {
    fail(`I: the fixtures are not tied (${nearPoints} vs ${farPoints}), so the order is being held by the score and the check cannot see a distance tie-break.`);
  } else if (!failures.some(f => f.startsWith('I:'))) {
    console.log(`location: two beaches tied at ${nearPoints}, 2 km and 240 km away, keep the order they arrived in — nothing per-visitor reaches the ranking.`);
  }
}

if (failures.length) {
  console.error('❌ Ο πίνακας των 100 δεν λέει αυτό που υπόσχεται:\n');
  failures.forEach(f => console.error(`  • ${f}\n`));
  process.exit(1);
}
console.log(`✅ Πίνακας των 100: 80 ο καιρός / 20 τα ανθρώπινα · θάλασσα ανά ${realTable.SEA_STEP_M} μ. · παροχές ${realTable.TOP_PICK_WEIGHTS.amenities} · πρόσβαση ${realTable.TOP_PICK_WEIGHTS.access} · πολυσύχναστη ${realTable.TOP_PICK_WEIGHTS.crowd} · καμία είσοδος από τον επισκέπτη.`);

if (PROVE) {
  const source = readFileSync(path.join(root, 'utils/topPickScoreTable.ts'), 'utf8');
  const regressions = [
    ['η άνεση ξεπέρασε τον καιρό', s => s.replace(/shelter: 30,/, 'shelter: 15,').replace(/amenities: 9,/, 'amenities: 24,')],
    ['το βήμα της θάλασσας έγινε συνεχές', s => s.replace(/export const SEA_STEP_M = 0\.25;/, 'export const SEA_STEP_M = 0.001;')],
    ['το κενό δεδομένο βαθμολογείται μηδέν', s => s
      .replace(/return axis\('sea', 14, max, true\);/, "return axis('sea', 0, max, true);")
      .replace(/return axis\('shelter', max \/ 2, max, true\);/, "return axis('shelter', 0, max, true);")],
    ['ο δρόμος ανέβηκε πάνω από τις παροχές', s => s
      .replace(/amenities: 9,/, 'amenities: 4,')
      .replace(/access: 6,/, 'access: 11,')],
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
