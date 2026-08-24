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
 *
 * Every case is bound to a beachId. The name is kept for the reader and is
 * only a fallback for a case that has no id yet. Binding by name substring
 * was how a case silently changed subject: on 20/08/2026 #512 was renamed
 * from "Paralia Angelochoriou" to "Akti Siamo" (its pin was 15 km from the
 * village) and a new #3190 took the old name at the real Angelochori — the
 * anchor written for #512's open south coast started judging #3190's
 * west-facing shore and reported a false-protected miss that no geometry
 * had produced. Eight other names matched two beaches each (first in file
 * order won). An id that no longer exists is reported and fails the gate:
 * a case that stops being evaluated must be acknowledged, not skipped.
 *
 * Two populations live here: hand-authored cases (local knowledge, named
 * coasts) and "anchor" cases auto-proposed on 2026-06-11 from the model's own
 * open-sea readings (fetch >= 15 km, intensity >= 70) — those are regression
 * guards for the geometry, not independent truth. The trailing comment on an
 * anchor line records the reading it was proposed from.
 */

const exposureDir = path.join(process.cwd(), 'public', 'data', 'geospatial', 'exposure');

const cases = [
  // Naxos west coast: sheltered from the N/NE Meltemi, open to the SW.
  { regionId: 'south-aegean-naxos', beachId: 1985, name: 'Agios Prokopios', sector: 'N', expected: 'protected' },
  { regionId: 'south-aegean-naxos', beachId: 1985, name: 'Agios Prokopios', sector: 'SW', expected: 'exposed' },
  { regionId: 'south-aegean-naxos', beachId: 2012, name: 'Plaka', sector: 'N', expected: 'protected' },
  { regionId: 'south-aegean-naxos', beachId: 1981, name: 'Agia Anna', sector: 'SW', expected: 'exposed' },
  // Naxos Panormos: south-east facing bay.
  { regionId: 'south-aegean-naxos', beachId: 2011, name: 'Panormos', sector: 'S', expected: 'exposed' },
  { regionId: 'south-aegean-naxos', beachId: 2011, name: 'Panormos', sector: 'NW', expected: 'calm' },
  // Milos: Sarakiniko on the north coast vs Firiplaka on the south coast.
  { regionId: 'south-aegean-milos', beachId: 1922, name: 'Sarakiniko', sector: 'N', expected: 'rough' },
  { regionId: 'south-aegean-milos', beachId: 1927, name: 'Fyriplaka', sector: 'N', expected: 'protected' },
  // Lefkada west coast cliffs: open west, sheltered east.
  { regionId: 'ionian-islands-lefkada', beachId: 1171, name: 'Porto Katsiki', sector: 'W', expected: 'exposed' },
  { regionId: 'ionian-islands-lefkada', beachId: 1171, name: 'Porto Katsiki', sector: 'E', expected: 'protected' },
  // Paros Golden Beach (Chrysi Akti), east-coast Meltemi funnel.
  { regionId: 'south-aegean-paros', beachId: 2056, name: 'Chrysi Akti', sector: 'E', expected: 'rough' },
  // Crete SW: Elafonisi open to the south/west.
  { regionId: 'crete-crete-chania', beachId: 595, name: 'Elafonisi', sector: 'S', expected: 'rough' },
  // Crete far-west Falassarna faces the open west.
  { regionId: 'crete-crete-chania', beachId: 596, name: 'Falasarna', sector: 'W', expected: 'rough' },
  // Mykonos: north-coast kite beach Ftelia vs the sheltered south bay of Ornos.
  { regionId: 'south-aegean-mykonos', beachId: 1976, name: 'Ftelia', sector: 'N', expected: 'rough' },
  { regionId: 'south-aegean-mykonos', beachId: 1964, name: 'Ornos', sector: 'N', expected: 'calm' },
  // Mykonos Panormos sits on the exposed north coast.
  { regionId: 'south-aegean-mykonos', beachId: 1965, name: 'Panormos', sector: 'N', expected: 'rough' },
  // Lefkada Egremni: west-coast cliffs open to the west.
  { regionId: 'ionian-islands-lefkada', beachId: 1159, name: 'Egkremni', sector: 'W', expected: 'rough' },
  // Rhodes Prasonisi, the southern kite cape, open to the south.
  { regionId: 'south-aegean-rhodes', beachId: 2457, name: 'Prasonisi', sector: 'S', expected: 'rough' },
  // Milos golden-island pass (2026-06-10): gulf-side shelter vs the open
  // SE gap toward Kimolos/Polyaigos. Rivari sits on the west shore of the
  // Milos gulf (land to its west); Kalamos and Voudia face the open gap.
  { regionId: 'south-aegean-milos', beachId: 1921, name: 'Rivari', sector: 'W', expected: 'calm' },
  { regionId: 'south-aegean-milos', beachId: 1907, name: 'Kalamos', sector: 'E', expected: 'rough' },
  { regionId: 'south-aegean-milos', beachId: 1934, name: 'Voudia', sector: 'SE', expected: 'rough' },
  // Fatourena sits on the south shore of the Milos gulf: ~7.9 km of cross-gulf
  // north fetch builds real chop (raw geometry says exposed) while staying just
  // under the 8 km solution-B escalation threshold — the curated explicit N
  // exposure is what protects scoring here, not the geometry escalation.
  { regionId: 'south-aegean-milos', beachId: 1926, name: 'Fatourena', sector: 'N', expected: 'rough' },
  // Naxos island pass (2026-06-11): Lionas is the narrow NE-opening fjord cove
  // on the east coast — the meltemi funnels straight into its mouth (geometry:
  // facing 37.9, 20 km NE fetch, intensity 92). Kalantos bay on the south coast
  // opens due south to 14+ km of open sea.
  { regionId: 'south-aegean-naxos', beachId: 2003, name: 'Lionas', sector: 'NE', expected: 'rough' },
  { regionId: 'south-aegean-naxos', beachId: 1995, name: 'Paralia Kalantos', sector: 'S', expected: 'rough' },
  // Mykonos pass (2026-06-11): Korfos was a flagship correction of the
  // high-res rebuild (the kite bay opens N toward the town gap, not S as the
  // old mask said); Ornos opens due south — the classic meltemi refuge.
  { regionId: 'south-aegean-mykonos', beachId: 1957, name: 'Korfos', sector: 'N', expected: 'rough' },
  { regionId: 'south-aegean-mykonos', beachId: 1964, name: 'Ornos', sector: 'S', expected: 'rough' },
  // Santorini pass (2026-06-11): Kokkini (Red Beach) hides behind the Akrotiri
  // cliffs in meltemi; Vlychada opens due south to open sea.
  { regionId: 'south-aegean-santorini', beachId: 2062, name: 'Kokkini', sector: 'N', expected: 'calm' },
  { regionId: 'south-aegean-santorini', beachId: 2058, name: 'Vlychada', sector: 'S', expected: 'rough' },
  // Sifnos pass (2026-06-11): Vathi is the textbook enclosed SW bay (calm in
  // meltemi); Kamares opens due west with 10+ km of fetch toward Kimolos.
  { regionId: 'south-aegean-sifnos', beachId: 2097, name: 'Vathi', sector: 'N', expected: 'calm' },
  { regionId: 'south-aegean-sifnos', beachId: 2101, name: 'Kamares', sector: 'W', expected: 'rough' },
  // Rhodes pass (2026-06-11): Stegna on the east coast opens due east to 20 km
  // of open sea; St Paul's bay at Lindos is the famous near-enclosed cove.
  { regionId: 'south-aegean-rhodes', beachId: 2435, name: 'Stegna', sector: 'E', expected: 'rough' },
  { regionId: 'south-aegean-rhodes', beachId: 2445, name: 'Agiou Pavlou', sector: 'N', expected: 'calm' },
  // Corfu pass (2026-06-11): Chalikounas opens to 20+ km of SW Ionian sea
  // (the kite zone); Agni is the classic sheltered NE-coast taverna cove.
  { regionId: 'ionian-islands-corfu', beachId: 1010, name: 'Chalikouna', sector: 'SW', expected: 'rough' },
  { regionId: 'ionian-islands-corfu', beachId: 929, name: 'Agni', sector: 'W', expected: 'calm' },
  // Zakynthos pass (2026-06-11): Navagio faces the open west Ionian (boat
  // access only when the maistros is down); Gerakas is the sheltered turtle
  // bay behind the Vasilikos peninsula.
  { regionId: 'ionian-islands-zakynthos', beachId: 1208, name: 'Navagio', sector: 'W', expected: 'rough' },
  { regionId: 'ionian-islands-zakynthos', beachId: 1209, name: 'Gerakas', sector: 'N', expected: 'calm' },
  // Crete x4 + Halkidiki pass (2026-06-11): one anchor per region.
  { regionId: 'crete-crete-chania', beachId: 593, name: 'Balos', sector: 'N', expected: 'calm' },
  { regionId: 'crete-crete-rethymno', beachId: 704, name: 'Preveli', sector: 'S', expected: 'rough' },
  { regionId: 'crete-crete-heraklion', beachId: 626, name: 'Matala', sector: 'W', expected: 'rough' },
  { regionId: 'crete-crete-lasithi', beachId: 730, name: 'Vai', sector: 'E', expected: 'rough' },
  { regionId: 'central-macedonia-halkidiki-mainland', beachId: 443, name: 'Sarti', sector: 'E', expected: 'rough' },
  // National anchor batch 1 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'attica-aegina', beachId: 93, name: 'Tourlos', sector: 'SE', expected: 'rough' }, // f=25 i=99.5 facing=127.1
  { regionId: 'attica-agistri', beachId: 98, name: 'Paralia Megalochoriou', sector: 'N', expected: 'rough' }, // f=23.64 i=82.2 facing=17
  { regionId: 'attica-athens-area-mainland', beachId: 1, name: 'Palmyra', sector: 'SW', expected: 'rough' }, // f=24.64 i=91.9 facing=227.8
  { regionId: 'attica-east-attica-mainland', beachId: 54, name: 'Galazia Akti', sector: 'SW', expected: 'rough' }, // f=25 i=99.9 facing=221.7
  { regionId: 'attica-hydra', beachId: 101, name: 'Agios Nikolaos', sector: 'S', expected: 'rough' }, // f=15.48 i=81.4 facing=200.2
  { regionId: 'attica-kythira', beachId: 130, name: 'Paralia Lykodimou', sector: 'W', expected: 'rough' }, // f=25 i=100 facing=269.3
  { regionId: 'attica-methana', beachId: 178, name: 'Akti Agapis', sector: 'NE', expected: 'rough' }, // f=19.24 i=82 facing=62.9
  { regionId: 'attica-piraeus-area', beachId: 184, name: 'Votsalakia', sector: 'S', expected: 'rough' }, // f=24.2 i=89.5 facing=160.9
  { regionId: 'attica-poros', beachId: 162, name: 'Plaka', sector: 'E', expected: 'rough' }, // f=15.08 i=72.1 facing=45.7
  { regionId: 'attica-salamina', beachId: 164, name: 'Paralia Agiou Nikolaou', sector: 'SE', expected: 'rough' }, // f=20.16 i=83.9 facing=138.2
  { regionId: 'attica-spetses', beachId: 177, name: 'Xylokeriza', sector: 'S', expected: 'rough' }, // f=24.96 i=89.1 facing=200.3
  { regionId: 'attica-west-attica-mainland', beachId: 188, name: 'Paralia Kinetas', sector: 'SE', expected: 'rough' }, // f=22.28 i=79.3 facing=162.4
  { regionId: 'central-greece-evia', beachId: 210, name: 'Vathychantako', sector: 'N', expected: 'rough' }, // f=25 i=100 facing=1.9
  { regionId: 'central-greece-fokida-mainland', beachId: 349, name: 'Paralia Agiou Mina', sector: 'SW', expected: 'rough' }, // f=22.12 i=89.7 facing=243
  { regionId: 'central-greece-fthiotida-mainland', beachId: 361, name: 'Mikri Souvala', sector: 'E', expected: 'rough' }, // f=21.72 i=71.8 facing=62.7
  // National anchor batch 2 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'central-greece-skyros', beachId: 328, name: 'Gyrismata', sector: 'NE', expected: 'rough' }, // f=25 i=99.9 facing=42.2
  { regionId: 'central-greece-viotia-mainland', beachId: 372, name: 'Gyalini Ammos', sector: 'SE', expected: 'rough' }, // f=18.36 i=83.5 facing=126.2
  { regionId: 'central-macedonia-pieria-mainland', beachId: 505, name: 'Paralia Leptokaryas', sector: 'E', expected: 'rough' }, // f=25 i=99.8 facing=85
  // #512 was "Paralia Angelochoriou" when this anchor was proposed; renamed
  // "Akti Siamo" on 20/08/2026 (pin 15 km from Angelochori). The anchor is
  // this pin's open south coast, not the new #3190 at the village.
  { regionId: 'central-macedonia-thessaloniki-area', beachId: 512, name: 'Akti Siamo', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=179.6
  { regionId: 'crete-gavdos', beachId: 618, name: 'Agios Ioannis', sector: 'N', expected: 'rough' }, // f=25 i=99.9 facing=4.4
  { regionId: 'east-macedonia-and-thrace-evros-mainland', beachId: 778, name: 'Paralia Alexandroupolis', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180.7
  { regionId: 'east-macedonia-and-thrace-kavala-mainland', beachId: 790, name: 'Paralia Gymniston', sector: 'SE', expected: 'rough' }, // f=25 i=97.2 facing=154.2
  { regionId: 'east-macedonia-and-thrace-rodopi-mainland', beachId: 800, name: 'Synaxi', sector: 'S', expected: 'rough' }, // f=25 i=99.1 facing=190.6
  { regionId: 'east-macedonia-and-thrace-samothraki', beachId: 779, name: 'Vatos', sector: 'SE', expected: 'rough' }, // f=25 i=99 facing=146.3
  { regionId: 'east-macedonia-and-thrace-thasos', beachId: 812, name: 'Kekes', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180
  { regionId: 'east-macedonia-and-thrace-xanthi-mainland', beachId: 858, name: 'Paralia Myrodatou', sector: 'S', expected: 'rough' }, // f=25 i=99 facing=168.3
  { regionId: 'epirus-preveza-mainland', beachId: 883, name: 'Paralia Rizon', sector: 'SW', expected: 'rough' }, // f=25 i=100 facing=227.4
  { regionId: 'epirus-thesprotia-mainland', beachId: 901, name: 'Mega Drafi', sector: 'SW', expected: 'rough' }, // f=23.72 i=82.7 facing=239.4
  { regionId: 'ionian-islands-antipaxos', beachId: 1051, name: 'Rodovanopoulo', sector: 'SW', expected: 'rough' }, // f=25 i=96 facing=248.2
  { regionId: 'ionian-islands-erikoussa', beachId: 1059, name: 'Bragkini', sector: 'S', expected: 'rough' }, // f=19.84 i=83.9 facing=175.4
  // National anchor batch 3 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'ionian-islands-ithaca', beachId: 1234, name: 'Kritami', sector: 'E', expected: 'rough' }, // f=21.96 i=88.8 facing=111.4
  { regionId: 'ionian-islands-kefalonia', beachId: 1075, name: 'Sissia', sector: 'SW', expected: 'rough' }, // f=25 i=100 facing=224.8
  { regionId: 'ionian-islands-mathraki', beachId: 1061, name: 'Portelo', sector: 'NE', expected: 'rough' }, // f=25 i=98.6 facing=58.6
  { regionId: 'ionian-islands-othonoi', beachId: 1056, name: 'Agia Triada', sector: 'S', expected: 'rough' }, // f=25 i=98.2 facing=195.3
  { regionId: 'ionian-islands-paxos', beachId: 1040, name: 'Planos', sector: 'W', expected: 'rough' }, // f=25 i=98.9 facing=258.2
  { regionId: 'north-aegean-agios-efstratios', beachId: 1419, name: 'Agios Dimitrios', sector: 'NW', expected: 'rough' }, // f=25 i=100 facing=316
  { regionId: 'north-aegean-chios', beachId: 1269, name: 'Paralia Kampia', sector: 'N', expected: 'rough' }, // f=25 i=99.5 facing=351.7
  { regionId: 'north-aegean-fournoi', beachId: 1314, name: 'Vitsila', sector: 'E', expected: 'rough' }, // f=15.16 i=83.8 facing=84.8
  { regionId: 'north-aegean-ikaria', beachId: 1299, name: 'Kyparissi', sector: 'N', expected: 'rough' }, // f=25 i=99.9 facing=356.2
  { regionId: 'north-aegean-lemnos', beachId: 1442, name: 'Skandali', sector: 'E', expected: 'rough' }, // f=25 i=100 facing=87.9
  { regionId: 'north-aegean-lesvos', beachId: 1351, name: 'Patos', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180
  { regionId: 'north-aegean-oinousses', beachId: 1292, name: 'Katsika', sector: 'NE', expected: 'rough' }, // f=19.52 i=76 facing=42.2
  { regionId: 'north-aegean-psara', beachId: 1283, name: 'Lazareta', sector: 'S', expected: 'rough' }, // f=20.12 i=91.1 facing=168.8
  { regionId: 'north-aegean-samos', beachId: 1392, name: 'Trypiti', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180
  { regionId: 'peloponnese-argolida-mainland', beachId: 1499, name: 'Nea Epidavros - Aliotou', sector: 'NE', expected: 'rough' }, // f=20.68 i=73.4 facing=66.4
  // National anchor batch 4 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'peloponnese-arkadia-mainland', beachId: 1519, name: 'Poulithra', sector: 'NE', expected: 'rough' }, // f=24.88 i=90.7 facing=58.8
  { regionId: 'peloponnese-korinthia-mainland', beachId: 1541, name: 'Sykia', sector: 'NE', expected: 'rough' }, // f=24.24 i=90.4 facing=60.3
  { regionId: 'peloponnese-lakonia-mainland', beachId: 1544, name: 'Agios Kyprianos', sector: 'E', expected: 'rough' }, // f=25 i=100 facing=90.2
  { regionId: 'peloponnese-messinia-mainland', beachId: 1621, name: 'Lagkouvardos', sector: 'W', expected: 'rough' }, // f=25 i=100 facing=271.1
  { regionId: 'south-aegean-agathonisi', beachId: 2225, name: 'Vathy Pigadi', sector: 'SW', expected: 'rough' }, // f=15.24 i=77.3 facing=257.7
  { regionId: 'south-aegean-amorgos', beachId: 1664, name: 'Mouros', sector: 'S', expected: 'rough' }, // f=25 i=99.2 facing=169.9
  { regionId: 'south-aegean-anafi', beachId: 1683, name: 'Prassa', sector: 'NW', expected: 'rough' }, // f=25 i=99.9 facing=319
  { regionId: 'south-aegean-andros', beachId: 1698, name: 'Gyalia', sector: 'E', expected: 'rough' }, // f=25 i=100 facing=90.6
  { regionId: 'south-aegean-antiparos', beachId: 1728, name: 'Akti Panagias Faneromenis', sector: 'SW', expected: 'rough' }, // f=25 i=98.9 facing=212.9
  { regionId: 'south-aegean-arki', beachId: 2499, name: 'Limnari', sector: 'NE', expected: 'rough' }, // f=25 i=89.5 facing=82.9
  { regionId: 'south-aegean-astypalaia', beachId: 2232, name: 'Agios Ioannis', sector: 'SW', expected: 'rough' }, // f=25 i=99.9 facing=221.1
  { regionId: 'south-aegean-donousa', beachId: 2191, name: 'Limenari', sector: 'S', expected: 'rough' }, // f=24.92 i=91.9 facing=177.2
  { regionId: 'south-aegean-folegandros', beachId: 1741, name: 'Agkali', sector: 'SW', expected: 'rough' }, // f=25 i=99.9 facing=229.2
  { regionId: 'south-aegean-ios', beachId: 1779, name: 'Manousou', sector: 'SW', expected: 'rough' }, // f=25 i=99.8 facing=229.8
  { regionId: 'south-aegean-kalymnos', beachId: 2256, name: 'Platys Gialos', sector: 'W', expected: 'rough' }, // f=25 i=98.1 facing=254
  // National anchor batch 5 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'south-aegean-karpathos', beachId: 2276, name: 'Evgonymos', sector: 'NW', expected: 'rough' }, // f=25 i=100 facing=315.7
  { regionId: 'south-aegean-kasos', beachId: 2489, name: 'Ammoua', sector: 'W', expected: 'rough' }, // f=25 i=90.6 facing=305.8
  { regionId: 'south-aegean-kea', beachId: 1834, name: 'Freas', sector: 'SW', expected: 'rough' }, // f=25 i=99.9 facing=227.8
  { regionId: 'south-aegean-kimolos', beachId: 1854, name: 'Paralia Pigados', sector: 'E', expected: 'rough' }, // f=25 i=97 facing=110
  { regionId: 'south-aegean-kos', beachId: 2345, name: 'Cavo Paradiso', sector: 'SW', expected: 'rough' }, // f=25 i=100 facing=222.8
  { regionId: 'south-aegean-koufonisia', beachId: 2199, name: 'Paralia Leonida', sector: 'S', expected: 'rough' }, // f=20.88 i=91.7 facing=186.1
  { regionId: 'south-aegean-kythnos', beachId: 1865, name: 'Alyki', sector: 'W', expected: 'rough' }, // f=25 i=99.9 facing=272.6
  { regionId: 'south-aegean-leros', beachId: 2362, name: 'Vromolithos', sector: 'E', expected: 'rough' }, // f=20.4 i=90.8 facing=76.7
  { regionId: 'south-aegean-lipsi', beachId: 2370, name: 'Agios Nikolaos', sector: 'E', expected: 'rough' }, // f=25 i=99.8 facing=94.9
  { regionId: 'south-aegean-marathi', beachId: 2501, name: 'Tiganakia', sector: 'E', expected: 'rough' }, // f=15.64 i=82.3 facing=106.3
  { regionId: 'south-aegean-nisyros', beachId: 2387, name: 'Pachia Ammos', sector: 'NE', expected: 'rough' }, // f=23.96 i=91.2 facing=55.5
  { regionId: 'south-aegean-patmos', beachId: 2400, name: 'Paralia Lampi', sector: 'NE', expected: 'rough' }, // f=22.56 i=91.8 facing=50.7
  { regionId: 'south-aegean-polyaigos', beachId: 2221, name: 'Amoura', sector: 'E', expected: 'rough' }, // f=25 i=99.1 facing=101
  { regionId: 'south-aegean-serifos', beachId: 2075, name: 'Achladi', sector: 'S', expected: 'rough' }, // f=25 i=99.1 facing=190.6
  { regionId: 'south-aegean-sikinos', beachId: 2116, name: 'Agios Panteleimonas', sector: 'S', expected: 'rough' }, // f=25 i=99.5 facing=171.7
  // National anchor batch 6 (2026-06-11): one auto-proposed
  // open-sea rough anchor per remaining region (fetch >= 15 km, intensity
  // >= 70, named beach, valid facing - regression guards for the geometry).
  { regionId: 'south-aegean-syros', beachId: 2147, name: 'Santorinii', sector: 'S', expected: 'rough' }, // f=25 i=98.7 facing=193.3
  { regionId: 'south-aegean-telendos', beachId: 2494, name: 'Paralia Papa', sector: 'W', expected: 'rough' }, // f=25 i=100 facing=271.6
  { regionId: 'south-aegean-tilos', beachId: 2479, name: 'Limenari', sector: 'SW', expected: 'rough' }, // f=25 i=99.9 facing=222.3
  { regionId: 'south-aegean-tinos', beachId: 2168, name: 'Kousinia', sector: 'W', expected: 'rough' }, // f=25 i=94.2 facing=242.2
  { regionId: 'thessaly-alonissos', beachId: 2595, name: 'Lena', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=180.4
  { regionId: 'thessaly-larissa-coast-agia---kissavos', beachId: 2729, name: 'Platia Ammos', sector: 'NE', expected: 'rough' }, // f=25 i=100 facing=44.8
  { regionId: 'thessaly-magnesia-mainland---pelion', beachId: 2683, name: 'Theotokos', sector: 'NE', expected: 'rough' }, // f=25 i=100 facing=43.7
  { regionId: 'thessaly-skiathos', beachId: 2619, name: 'Megas Gialos', sector: 'N', expected: 'rough' }, // f=25 i=99.7 facing=6.3
  { regionId: 'thessaly-skopelos', beachId: 2652, name: 'Vathias', sector: 'S', expected: 'rough' }, // f=25 i=100 facing=181.4
  { regionId: 'west-greece-achaia-mainland', beachId: 2512, name: 'Paralia Kalogrias', sector: 'W', expected: 'rough' }, // f=25 i=99.9 facing=273.9
  { regionId: 'west-greece-aetolia-acarnania-mainland', beachId: 2533, name: 'Louros', sector: 'S', expected: 'rough' }, // f=25 i=99.3 facing=189.7
  { regionId: 'west-greece-ileia-mainland', beachId: 2577, name: 'Paralia Marathias', sector: 'SW', expected: 'rough' }, // f=25 i=100 facing=224.5
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

const nameMatches = (profile, name) => {
  const target = norm(name);
  return norm(profile.name?.en).includes(target) || norm(profile.name?.gr).includes(target);
};

// Returns { beach } or { problem } — never a silent null.
const findBeach = (profiles, testCase) => {
  if (testCase.beachId != null) {
    const beach = profiles[String(testCase.beachId)];
    if (!beach) return { problem: `beach #${testCase.beachId} (${testCase.name}) is not in the region profile` };
    if (!nameMatches(beach, testCase.name)) {
      console.log(`WARN  #${testCase.beachId} is now named "${beach.name?.en}" (case says "${testCase.name}") — still evaluating the id; update the name`);
    }
    return { beach };
  }
  const hits = Object.values(profiles).filter((profile) => nameMatches(profile, testCase.name));
  if (hits.length === 1) return { beach: hits[0] };
  if (hits.length === 0) return { problem: `no beach named "${testCase.name}"` };
  return { problem: `"${testCase.name}" matches ${hits.length} beaches (${hits.map((h) => `#${h.beachId} ${h.name?.en}`).join(', ')}) — bind the case to a beachId` };
};

let pass = 0;
let fail = 0;
let unresolved = 0;
const failures = [];
const problems = [];

for (const testCase of cases) {
  const filePath = path.join(exposureDir, `${testCase.regionId}.json`);
  if (!existsSync(filePath)) {
    unresolved += 1;
    problems.push(`${testCase.regionId} / ${testCase.name}: region file missing`);
    console.log(`SKIP  ${testCase.regionId} / ${testCase.name} (region file missing)`);
    continue;
  }

  const payload = JSON.parse(readFileSync(filePath, 'utf8'));
  const { beach, problem } = findBeach(payload.profiles || {}, testCase);
  if (!beach) {
    unresolved += 1;
    problems.push(`${testCase.regionId} / ${testCase.name}: ${problem}`);
    console.log(`SKIP  ${testCase.regionId} / ${testCase.name} (${problem})`);
    continue;
  }

  const sector = beach.sectors?.[testCase.sector];
  const level = sector?.level;
  const ok = matchesExpectation(level, testCase.expected);
  const detail = `#${beach.beachId} ${testCase.name} @ ${testCase.sector}: got ${level} (facing ${beach.facingDeg}°, fetch ${sector?.fetchKm}km), expected ${testCase.expected}`;

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
console.log(`Ground-truth: ${pass}/${evaluated} passed (${accuracy}%), ${unresolved} unresolved`);
if (failures.length > 0) {
  console.log('Failures:');
  failures.forEach((line) => console.log(`  - ${line}`));
}
if (problems.length > 0) {
  console.log('Unresolved cases (a case that cannot be evaluated is a change someone must acknowledge):');
  problems.forEach((line) => console.log(`  - ${line}`));
}

// Gate: the plan targets >=85% agreement before trusting the rollout, and
// every case must still resolve to a beach — a vanished id is not a pass.
if ((evaluated > 0 && accuracy < 85) || unresolved > 0) {
  process.exitCode = 1;
}
