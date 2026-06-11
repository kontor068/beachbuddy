import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Ground-truth validation for the geometry-derived wind exposure model.
 *
 * Each case asserts how a well-known Greek beach should behave under a given
 * wind sector, based on its real coastline position (not the model). We then
 * check the generated directional exposure profile agrees. This is the gate
 * the plan calls for before trusting the model nationwide.
 *
 * expected:
 *   'protected' -> sector level must be protected
 *   'exposed'   -> sector level must be exposed
 *   'calm'      -> sector level must NOT be exposed (protected or partial)
 *   'rough'     -> sector level must NOT be protected (partial or exposed)
 */

const exposureDir = path.join(process.cwd(), 'public', 'data', 'geospatial', 'exposure');

const cases = [
  // Naxos west coast: sheltered from the N/NE Meltemi, open to the SW.
  { regionId: 'south-aegean-naxos', name: 'Agios Prokopios', sector: 'N', expected: 'protected' },
  { regionId: 'south-aegean-naxos', name: 'Agios Prokopios', sector: 'SW', expected: 'exposed' },
  { regionId: 'south-aegean-naxos', name: 'Plaka', sector: 'N', expected: 'protected' },
  { regionId: 'south-aegean-naxos', name: 'Agia Anna', sector: 'SW', expected: 'exposed' },
  // Naxos Panormos: south-east facing bay.
  { regionId: 'south-aegean-naxos', name: 'Panormos', sector: 'S', expected: 'exposed' },
  { regionId: 'south-aegean-naxos', name: 'Panormos', sector: 'NW', expected: 'calm' },
  // Milos: Sarakiniko on the north coast vs Firiplaka on the south coast.
  { regionId: 'south-aegean-milos', name: 'Sarakiniko', sector: 'N', expected: 'rough' },
  { regionId: 'south-aegean-milos', name: 'Fyriplaka', sector: 'N', expected: 'protected' },
  // Lefkada west coast cliffs: open west, sheltered east.
  { regionId: 'ionian-islands-lefkada', name: 'Porto Katsiki', sector: 'W', expected: 'exposed' },
  { regionId: 'ionian-islands-lefkada', name: 'Porto Katsiki', sector: 'E', expected: 'protected' },
  // Paros Golden Beach (Chrysi Akti), east-coast Meltemi funnel.
  { regionId: 'south-aegean-paros', name: 'Chrysi Akti', sector: 'E', expected: 'rough' },
  // Crete SW: Elafonisi open to the south/west.
  { regionId: 'crete-crete-chania', name: 'Elafonisi', sector: 'S', expected: 'rough' },
  // Crete far-west Falassarna faces the open west.
  { regionId: 'crete-crete-chania', name: 'Falasarna', sector: 'W', expected: 'rough' },
  // Mykonos: north-coast kite beach Ftelia vs the sheltered south bay of Ornos.
  { regionId: 'south-aegean-mykonos', name: 'Ftelia', sector: 'N', expected: 'rough' },
  { regionId: 'south-aegean-mykonos', name: 'Ornos', sector: 'N', expected: 'calm' },
  // Mykonos Panormos sits on the exposed north coast.
  { regionId: 'south-aegean-mykonos', name: 'Panormos', sector: 'N', expected: 'rough' },
  // Lefkada Egremni: west-coast cliffs open to the west.
  { regionId: 'ionian-islands-lefkada', name: 'Egkremni', sector: 'W', expected: 'rough' },
  // Rhodes Prasonisi, the southern kite cape, open to the south.
  { regionId: 'south-aegean-rhodes', name: 'Prasonisi', sector: 'S', expected: 'rough' },
  // Milos golden-island pass (2026-06-10): gulf-side shelter vs the open
  // SE gap toward Kimolos/Polyaigos. Rivari sits on the west shore of the
  // Milos gulf (land to its west); Kalamos and Voudia face the open gap.
  { regionId: 'south-aegean-milos', name: 'Rivari', sector: 'W', expected: 'calm' },
  { regionId: 'south-aegean-milos', name: 'Kalamos', sector: 'E', expected: 'rough' },
  { regionId: 'south-aegean-milos', name: 'Voudia', sector: 'SE', expected: 'rough' },
  // Fatourena sits on the south shore of the Milos gulf: ~7.9 km of cross-gulf
  // north fetch builds real chop (raw geometry says exposed) while staying just
  // under the 8 km solution-B escalation threshold — the curated explicit N
  // exposure is what protects scoring here, not the geometry escalation.
  { regionId: 'south-aegean-milos', name: 'Fatourena', sector: 'N', expected: 'rough' },
  // Naxos island pass (2026-06-11): Lionas is the narrow NE-opening fjord cove
  // on the east coast — the meltemi funnels straight into its mouth (geometry:
  // facing 37.9, 20 km NE fetch, intensity 92). Kalantos bay on the south coast
  // opens due south to 14+ km of open sea.
  { regionId: 'south-aegean-naxos', name: 'Lionas', sector: 'NE', expected: 'rough' },
  { regionId: 'south-aegean-naxos', name: 'Paralia Kalantos', sector: 'S', expected: 'rough' },
];

const norm = (value) => (value || '')
  .toString()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '');

const matchesExpectation = (level, expected) => {
  if (expected === 'calm') return level !== 'exposed';
  if (expected === 'rough') return level !== 'protected';
  return level === expected;
};

const findBeach = (profiles, name) => {
  const target = norm(name);
  return Object.values(profiles).find((profile) => (
    norm(profile.name?.en).includes(target) || norm(profile.name?.gr).includes(target)
  ));
};

let pass = 0;
let fail = 0;
let skipped = 0;
const failures = [];

for (const testCase of cases) {
  const filePath = path.join(exposureDir, `${testCase.regionId}.json`);
  if (!existsSync(filePath)) {
    skipped += 1;
    console.log(`SKIP  ${testCase.regionId} / ${testCase.name} (region file missing)`);
    continue;
  }

  const payload = JSON.parse(readFileSync(filePath, 'utf8'));
  const beach = findBeach(payload.profiles || {}, testCase.name);
  if (!beach) {
    skipped += 1;
    console.log(`SKIP  ${testCase.regionId} / ${testCase.name} (beach not found)`);
    continue;
  }

  const sector = beach.sectors?.[testCase.sector];
  const level = sector?.level;
  const ok = matchesExpectation(level, testCase.expected);
  const detail = `${testCase.name} @ ${testCase.sector}: got ${level} (facing ${beach.facingDeg}°, fetch ${sector?.fetchKm}km), expected ${testCase.expected}`;

  if (ok) {
    pass += 1;
    console.log(`PASS  ${detail}`);
  } else {
    fail += 1;
    failures.push(detail);
    console.log(`FAIL  ${detail}`);
  }
}

const evaluated = pass + fail;
const accuracy = evaluated > 0 ? Math.round((pass / evaluated) * 100) : 0;

console.log('\n----------------------------------------');
console.log(`Ground-truth: ${pass}/${evaluated} passed (${accuracy}%), ${skipped} skipped`);
if (failures.length > 0) {
  console.log('Failures:');
  failures.forEach((line) => console.log(`  - ${line}`));
}

// Gate: the plan targets >=85% agreement before trusting the rollout.
if (evaluated > 0 && accuracy < 85) {
  process.exitCode = 1;
}
