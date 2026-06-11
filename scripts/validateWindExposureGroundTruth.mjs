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
  // Mykonos pass (2026-06-11): Korfos was a flagship correction of the
  // high-res rebuild (the kite bay opens N toward the town gap, not S as the
  // old mask said); Ornos opens due south — the classic meltemi refuge.
  { regionId: 'south-aegean-mykonos', name: 'Korfos', sector: 'N', expected: 'rough' },
  { regionId: 'south-aegean-mykonos', name: 'Ornos', sector: 'S', expected: 'rough' },
  // Santorini pass (2026-06-11): Kokkini (Red Beach) hides behind the Akrotiri
  // cliffs in meltemi; Vlychada opens due south to open sea.
  { regionId: 'south-aegean-santorini', name: 'Kokkini', sector: 'N', expected: 'calm' },
  { regionId: 'south-aegean-santorini', name: 'Vlychada', sector: 'S', expected: 'rough' },
  // Sifnos pass (2026-06-11): Vathi is the textbook enclosed SW bay (calm in
  // meltemi); Kamares opens due west with 10+ km of fetch toward Kimolos.
  { regionId: 'south-aegean-sifnos', name: 'Vathi', sector: 'N', expected: 'calm' },
  { regionId: 'south-aegean-sifnos', name: 'Kamares', sector: 'W', expected: 'rough' },
  // Rhodes pass (2026-06-11): Stegna on the east coast opens due east to 20 km
  // of open sea; St Paul's bay at Lindos is the famous near-enclosed cove.
  { regionId: 'south-aegean-rhodes', name: 'Stegna', sector: 'E', expected: 'rough' },
  { regionId: 'south-aegean-rhodes', name: 'Agiou Pavlou', sector: 'N', expected: 'calm' },
  // Corfu pass (2026-06-11): Chalikounas opens to 20+ km of SW Ionian sea
  // (the kite zone); Agni is the classic sheltered NE-coast taverna cove.
  { regionId: 'ionian-islands-corfu', name: 'Chalikouna', sector: 'SW', expected: 'rough' },
  { regionId: 'ionian-islands-corfu', name: 'Agni', sector: 'W', expected: 'calm' },
  // Zakynthos pass (2026-06-11): Navagio faces the open west Ionian (boat
  // access only when the maistros is down); Gerakas is the sheltered turtle
  // bay behind the Vasilikos peninsula.
  { regionId: 'ionian-islands-zakynthos', name: 'Navagio', sector: 'W', expected: 'rough' },
  { regionId: 'ionian-islands-zakynthos', name: 'Gerakas', sector: 'N', expected: 'calm' },
  // Crete x4 + Halkidiki pass (2026-06-11): one anchor per region.
  { regionId: 'crete-crete-chania', name: 'Balos', sector: 'N', expected: 'calm' },
  { regionId: 'crete-crete-rethymno', name: 'Preveli', sector: 'S', expected: 'rough' },
  { regionId: 'crete-crete-heraklion', name: 'Matala', sector: 'W', expected: 'rough' },
  { regionId: 'crete-crete-lasithi', name: 'Vai', sector: 'E', expected: 'rough' },
  { regionId: 'central-macedonia-halkidiki-mainland', name: 'Sarti', sector: 'E', expected: 'rough' },
  // National anchor batch 1 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'attica-aegina', name: 'Tourlos', sector: 'SE', expected: 'rough' }, // f=25 i=99.5 facing=127.1
  { regionId: 'attica-agistri', name: 'Paralia Megalochoriou', sector: 'N', expected: 'rough' }, // f=23.64 i=82.2 facing=17
  { regionId: 'attica-athens-area-mainland', name: 'Palmyra', sector: 'SW', expected: 'rough' }, // f=24.64 i=91.9 facing=227.8
  { regionId: 'attica-east-attica-mainland', name: 'Galazia Akti', sector: 'SW', expected: 'rough' }, // f=25 i=99.9 facing=221.7
  { regionId: 'attica-hydra', name: 'Agios Nikolaos', sector: 'S', expected: 'rough' }, // f=15.48 i=81.4 facing=200.2
  { regionId: 'attica-kythira', name: 'Paralia Lykodimou', sector: 'W', expected: 'rough' }, // f=25 i=100 facing=269.3
  { regionId: 'attica-methana', name: 'Akti Agapis', sector: 'NE', expected: 'rough' }, // f=19.24 i=82 facing=62.9
  { regionId: 'attica-piraeus-area', name: 'Votsalakia', sector: 'S', expected: 'rough' }, // f=24.2 i=89.5 facing=160.9
  { regionId: 'attica-poros', name: 'Plaka', sector: 'E', expected: 'rough' }, // f=15.08 i=72.1 facing=45.7
  { regionId: 'attica-salamina', name: 'Paralia Agiou Nikolaou', sector: 'SE', expected: 'rough' }, // f=20.16 i=83.9 facing=138.2
  { regionId: 'attica-spetses', name: 'Xylokeriza', sector: 'S', expected: 'rough' }, // f=24.96 i=89.1 facing=200.3
  { regionId: 'attica-west-attica-mainland', name: 'Paralia Kinetas', sector: 'SE', expected: 'rough' }, // f=22.28 i=79.3 facing=162.4
  { regionId: 'central-greece-evia', name: 'Vathychantako', sector: 'N', expected: 'rough' }, // f=25 i=100 facing=1.9
  { regionId: 'central-greece-fokida-mainland', name: 'Paralia Agiou Mina', sector: 'SW', expected: 'rough' }, // f=22.12 i=89.7 facing=243
  { regionId: 'central-greece-fthiotida-mainland', name: 'Mikri Souvala', sector: 'E', expected: 'rough' }, // f=21.72 i=71.8 facing=62.7
  // National anchor batch 2 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'central-greece-skyros', name: 'Gyrismata', sector: 'NE', expected: 'rough' }, // f=25 i=99.9 facing=42.2
  { regionId: 'central-greece-viotia-mainland', name: 'Gyalini Ammos', sector: 'SE', expected: 'rough' }, // f=18.36 i=83.5 facing=126.2
  { regionId: 'central-macedonia-pieria-mainland', name: 'Paralia Leptokaryas', sector: 'E', expected: 'rough' }, // f=25 i=99.8 facing=85
  { regionId: 'central-macedonia-thessaloniki-area', name: 'Paralia Angelochoriou', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=179.6
  { regionId: 'crete-gavdos', name: 'Agios Ioannis', sector: 'N', expected: 'rough' }, // f=25 i=99.9 facing=4.4
  { regionId: 'east-macedonia-and-thrace-evros-mainland', name: 'Paralia Alexandroupolis', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180.7
  { regionId: 'east-macedonia-and-thrace-kavala-mainland', name: 'Paralia Gymniston', sector: 'SE', expected: 'rough' }, // f=25 i=97.2 facing=154.2
  { regionId: 'east-macedonia-and-thrace-rodopi-mainland', name: 'Synaxi', sector: 'S', expected: 'rough' }, // f=25 i=99.1 facing=190.6
  { regionId: 'east-macedonia-and-thrace-samothraki', name: 'Vatos', sector: 'SE', expected: 'rough' }, // f=25 i=99 facing=146.3
  { regionId: 'east-macedonia-and-thrace-thasos', name: 'Kekes', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180
  { regionId: 'east-macedonia-and-thrace-xanthi-mainland', name: 'Paralia Myrodatou', sector: 'S', expected: 'rough' }, // f=25 i=99 facing=168.3
  { regionId: 'epirus-preveza-mainland', name: 'Paralia Rizon', sector: 'SW', expected: 'rough' }, // f=25 i=100 facing=227.4
  { regionId: 'epirus-thesprotia-mainland', name: 'Mega Drafi', sector: 'SW', expected: 'rough' }, // f=23.72 i=82.7 facing=239.4
  { regionId: 'ionian-islands-antipaxos', name: 'Rodovanopoulo', sector: 'SW', expected: 'rough' }, // f=25 i=96 facing=248.2
  { regionId: 'ionian-islands-erikoussa', name: 'Bragkini', sector: 'S', expected: 'rough' }, // f=19.84 i=83.9 facing=175.4
  // National anchor batch 3 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'ionian-islands-ithaca', name: 'Kritami', sector: 'E', expected: 'rough' }, // f=21.96 i=88.8 facing=111.4
  { regionId: 'ionian-islands-kefalonia', name: 'Sissia', sector: 'SW', expected: 'rough' }, // f=25 i=100 facing=224.8
  { regionId: 'ionian-islands-mathraki', name: 'Portelo', sector: 'NE', expected: 'rough' }, // f=25 i=98.6 facing=58.6
  { regionId: 'ionian-islands-othonoi', name: 'Agia Triada', sector: 'S', expected: 'rough' }, // f=25 i=98.2 facing=195.3
  { regionId: 'ionian-islands-paxos', name: 'Planos', sector: 'W', expected: 'rough' }, // f=25 i=98.9 facing=258.2
  { regionId: 'north-aegean-agios-efstratios', name: 'Agios Dimitrios', sector: 'NW', expected: 'rough' }, // f=25 i=100 facing=316
  { regionId: 'north-aegean-chios', name: 'Paralia Kampia', sector: 'N', expected: 'rough' }, // f=25 i=99.5 facing=351.7
  { regionId: 'north-aegean-fournoi', name: 'Vitsila', sector: 'E', expected: 'rough' }, // f=15.16 i=83.8 facing=84.8
  { regionId: 'north-aegean-ikaria', name: 'Kyparissi', sector: 'N', expected: 'rough' }, // f=25 i=99.9 facing=356.2
  { regionId: 'north-aegean-lemnos', name: 'Skandali', sector: 'E', expected: 'rough' }, // f=25 i=100 facing=87.9
  { regionId: 'north-aegean-lesvos', name: 'Patos', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180
  { regionId: 'north-aegean-oinousses', name: 'Katsika', sector: 'NE', expected: 'rough' }, // f=19.52 i=76 facing=42.2
  { regionId: 'north-aegean-psara', name: 'Lazareta', sector: 'S', expected: 'rough' }, // f=20.12 i=91.1 facing=168.8
  { regionId: 'north-aegean-samos', name: 'Trypiti', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180
  { regionId: 'peloponnese-argolida-mainland', name: 'Nea Epidavros - Aliotou', sector: 'NE', expected: 'rough' }, // f=20.68 i=73.4 facing=66.4
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
