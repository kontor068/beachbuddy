#!/usr/bin/env node
/**
 * ΚΑΡΠΑΘΟΣ — ΞΑΝΑΤΣΕΚΑΡΙΣΜΑ 01/09/2026
 *
 * ΓΙΑΤΙ. Ο πίνακας ποιότητας έδειχνε την Κάρπαθο πρώτη σε προβολές (1.305) με τελευταίο
 * έλεγχο πριν 16 μέρες και τέσσερα ανοιχτά κενά: Πλοήγηση 69, Παροχές 73, Φωτό 37,
 * Κείμενο 78. Αυτό το πέρασμα κλείνει όσα κλείνουν με πηγές — όχι το Φωτό, που θέλει
 * δικές μας ή δωρισμένες φωτογραφίες.
 *
 * ΤΙ ΑΛΛΑΖΕΙ (κάθε γραμμή έχει πηγή· τίποτα δεν μπαίνει «κατά τεκμήριο»):
 *   1. ΠΑΡΟΧΕΣ — 13 παραλίες με ΚΕΝΗ λίστα παροχών. Η κενή λίστα δεν σημαίνει «άγρια
 *      παραλία», σημαίνει «κανείς δεν πέρασε». Όπου η πηγή λέει ρητά «καμία παροχή», το
 *      γράφουμε με το λεξιλόγιο που ήδη χρησιμοποιεί το dataset («καμία οργανωμένη
 *      παροχή», 144 παραλίες). Όπου η πηγή είναι σε επίπεδο περιοχής και όχι παραλίας,
 *      μπαίνει το πιο συγκρατημένο «χωρίς επιβεβαιωμένες σταθερές παροχές» (15 παραλίες).
 *   2. ΚΕΙΜΕΝΟ — οι 4 παραλίες της πόλης (Πηγάδια, Βρόντη, Άφωτη, Διαφάνι) κουβαλούσαν
 *      `needsVerification: true` + `confidence: low` από το batch ανακάλυψης του 08/2026,
 *      ενώ είναι οι πιο τεκμηριωμένες παραλίες του νησιού. Βρέθηκαν αφιερωμένες σελίδες
 *      ανά παραλία (greeka, allovergreece, in2greece) — αυτό ακριβώς έλειπε στο πέρασμα
 *      της 29/05 που τις κράτησε low.
 *   3. ΠΛΟΗΓΗΣΗ — 7 στάμπες όπου η πηγή λέει ρητά πώς φτάνεις (parking πάνω από την
 *      παραλία, πρόσβαση με αυτοκίνητο, ή «μόνο με σκάφος» που η εφαρμογή γυρίζει σε
 *      locate ούτως ή άλλως μέσω του κανόνα ασφαλείας για boat_only).
 *
 * ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ ΕΠΙΤΗΔΕΣ:
 *   - Οι 6 απομονωμένες βόρειες παραλίες (Ευγώνυμος, Φίσσες, Καμινάκι, Λάλα, Μακριά,
 *     Ποντικάλια) ΜΕΝΟΥΝ low confidence και ΧΩΡΙΣ nav status. Οι πηγές τις περιγράφουν
 *     πάντα ως ομάδα («οι βόρειες παραλίες»), ποτέ μία-μία. Το πέρασμα της 29/05 τις
 *     κράτησε low για τον ίδιο λόγο και είχε δίκιο.
 *   - Το `waterDepth` κανενός: τροφοδοτεί το μοντέλο βυθού/κύματος και δύο οδηγοί
 *     διαφωνούν για τα Πηγάδια/Άφωτη («ρηχά» vs «μέτριο βάθος»).
 *   - Το `access.type` κανενός: για τη Βανάντα τρεις πηγές διαφωνούν (βατός για κάθε
 *     όχημα / δύσκολος για μικρά αυτοκίνητα) και ο συντηρητικός χαρακτηρισμός προστατεύει
 *     τον επισκέπτη· η διαφωνία γράφεται στη σημείωση.
 *
 * ΠΗΓΕΣ. Το egress proxy αυτής της συνεδρίας μπλοκάρει το απευθείας κατέβασμα των
 * σελίδων (karpathosinfo.com, greeka.com, karpathos.gr — όλες EGRESS_BLOCKED), οπότε τα
 * αποσπάσματα ήρθαν από αναζήτηση. Κάθε σημείωση το λέει ρητά με τη λέξη «απόσπασμα»,
 * ώστε ένα επόμενο πέρασμα με ανοιχτό δίκτυο να ξέρει τι πρέπει να ξαναδεί.
 *
 * Χρήση:  node scripts/applyKarpathosRecheck2026-09.mjs           (dry-run)
 *         node scripts/applyKarpathosRecheck2026-09.mjs --write
 *         npm run build:beach-data                                (μετά το --write)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const write = process.argv.includes('--write');
const STAMP = '2026-09-01';
const METHOD = 'web-source-recheck-2026-09';

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

// ─────────────────────────────────────────────────────────────────────────────
// ΟΙ ΑΛΛΑΓΕΣ, ΜΙΑ ΓΡΑΜΜΗ ΑΝΑ ΠΑΡΑΛΙΑ
//
// addAmenities  προστίθενται μόνο αν δεν υπάρχει ήδη ισοδύναμο κείμενο
// setShade      μόνο όταν η πηγή ονομάζει τη σκιά (δέντρα, αρμυρίκια)
// setOrganized  μόνο όταν η πηγή λέει ρητά ξαπλώστρες/ομπρέλες ΠΑΝΩ στην παραλία
// promote       confidence -> high ΚΑΙ σβήσιμο του needsVerification
// nav           στάμπα πλοήγησης
// urls          νέες πηγές (προστίθενται, δεν αντικαθιστούν)
// note          η γραμμή προέλευσης που μπαίνει στα sourceNotes
// ─────────────────────────────────────────────────────────────────────────────
const CHANGES = [
  // ── 1. ΠΑΡΟΧΕΣ: η πηγή λέει ΡΗΤΑ «καμία παροχή» για ΑΥΤΗ την παραλία ──────────
  {
    id: 2279, name: 'Φορόκλι',
    addAmenities: ['καμία οργανωμένη παροχή', 'πρόσβαση με εκδρομικό ή ιδιωτικό σκάφος'],
    urls: ['https://www.greeka.com/dodecanese/karpathos/beaches/'],
    note: 'Απόσπασμα greeka (αναζήτηση 2026-09-01): «Forokli boasts a beautiful stretch of pebbles... totally unorganized with no facilities», 46 χλμ βόρεια των Πηγαδίων· πρόσβαση με σκάφος από Διαφάνι, οι χωματόδρομοι της περιοχής σε πολύ κακή κατάσταση ακόμη και με 4x4. Γράφτηκε η ρητή απουσία παροχών — η κενή λίστα διαβαζόταν ως «δεν το κοιτάξαμε».',
  },
  {
    id: 2291, name: 'Νάτι',
    addAmenities: ['καμία οργανωμένη παροχή'],
    urls: ['https://www.greeka.com/dodecanese/karpathos/beaches/nati/'],
    note: 'Απόσπασμα greeka (αναζήτηση 2026-09-01), αφιερωμένη σελίδα παραλίας: «There are no sunbeds or parasols available on the beach, nor any other amenities», 38 χλμ βόρεια των Πηγαδίων / 13 χλμ από Όλυμπο, μικρή ακτή με γκρίζα βότσαλα προστατευμένη από λόφους.',
  },
  {
    id: 2294, name: 'Παπάς Μηνάς',
    addAmenities: ['καμία οργανωμένη παροχή', 'εκδρομικό σκάφος από Διαφάνι'],
    urls: ['https://www.greeka.com/dodecanese/karpathos/beaches/papa-mina/'],
    note: 'Απόσπασμα greeka (αναζήτηση 2026-09-01), αφιερωμένη σελίδα: «offers no tourist facilities whatsoever and is best approached on foot through a hiking trail from Diafani that takes around an hour and a half, or by excursion boats operating from Diafani Port». Βοτσαλωτή, μη οργανωμένη.',
  },
  {
    id: 2298, name: 'Βανάντα',
    addAmenities: ['καμία οργανωμένη παροχή', 'βρύση με πόσιμο νερό πίσω από την παραλία', 'φυσική σκιά σε σημεία'],
    setShade: true,
    urls: ['https://www.greeka.com/dodecanese/karpathos/beaches/vananda/'],
    note: 'Απόσπασμα greeka (αναζήτηση 2026-09-01), αφιερωμένη σελίδα: «There is no taverna at the beach... The beach lacks any sort of facilities, though some natural shade is provided by the trees present on the shore and there is a fountain with drinking water just behind the beach». 2,5 χλμ από Διαφάνι, 30-35 λεπτά με τα πόδια. ΔΙΑΦΩΝΙΑ ΠΗΓΩΝ ΓΙΑ ΤΟΝ ΔΡΟΜΟ: greeka «a bit rough but can be traversed by any kind of vehicle» και ardanikarpathos «βατοί χωματόδρομοι», ενώ το KarpathosInfo (ήδη καταγεγραμμένο) λέει δύσκολος για μικρά αυτοκίνητα — ο χαρακτηρισμός ΕΜΕΙΝΕ δύσβατος, ο συντηρητικός προστατεύει τον επισκέπτη.',
  },
  {
    id: 2312, name: 'Παραλία Αγνόντια',
    addAmenities: ['ξαπλώστρες/ομπρέλες εποχικά', 'φυσική σκιά από αρμυρίκια'],
    setShade: true,
    nav: true,
    urls: ['https://www.greeka.com/dodecanese/karpathos/beaches/agnontia/'],
    note: 'Απόσπασμα greeka (αναζήτηση 2026-09-01), αφιερωμένη σελίδα: «You may be able to find some sunbeds and umbrellas on the beach during peak summer months»· «You can find some natural shade under the tamarisk trees of the beach»· «Usually the quality of the dirt road which leads to Agnotia beach is bad, so... you have to drive an off-road vehicle» — επιβεβαιώνει τον ήδη καταγεγραμμένο δύσβατο χωματόδρομο. Το `organized` ΕΜΕΙΝΕ false: μία μόνο πηγή, και με επιφύλαξη («may be able to find»).',
  },

  // ── 2. ΠΑΡΟΧΕΣ: η πηγή είναι σε επίπεδο περιοχής — συγκρατημένη διατύπωση ─────
  {
    id: 2276, name: 'Ευγώνυμος',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    note: 'Πέρασμα 2026-09-01: οι πηγές (Visit Olympos, KarpathosInfo) περιγράφουν τη ζώνη των βόρειων/δυτικών κόλπων του Ολύμπου ως χωρίς υποδομή, ποτέ τον Ευγώνυμο χωριστά. Γράφτηκε η συγκρατημένη διατύπωση αντί για κενή λίστα· η σιγουριά ΕΜΕΙΝΕ χαμηλή για τον ίδιο λόγο που την κράτησε χαμηλή το πέρασμα της 29/05.',
  },
  {
    id: 2280, name: 'Φίσσες',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    note: 'Πέρασμα 2026-09-01: ίδια εικόνα με τον Ευγώνυμο — οι Φίσσες αναφέρονται μόνο μέσα στην ομάδα των απομακρυσμένων δυτικών/βόρειων ακτών με πρόσβαση από θάλασσα. Κενή λίστα -> συγκρατημένη διατύπωση· σιγουριά αμετάβλητη.',
  },
  {
    id: 2283, name: 'Καμινάκι',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    note: 'Πέρασμα 2026-09-01: το Καμινάκι στηρίζεται σε Mapcarta/OSM για ταυτότητα και σε περιγραφή ζώνης για την υποδομή. Κενή λίστα -> συγκρατημένη διατύπωση· σιγουριά αμετάβλητη.',
  },
  {
    id: 2287, name: 'Λάρες',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    urls: ['https://www.alltrails.com/greece/karpathos/beach'],
    note: 'Απόσπασμα AllTrails (αναζήτηση 2026-09-01): η διαδρομή «Kato Lefkos - Agios Georgios - Lare Beach» δίνεται 6,4 χλμ / 1,5-2 ώρες, ξεκινώντας από την ακτή του Κάτω Λευκού — στηρίζει τη δύσκολη πεζοπορική πρόσβαση που ήδη καταγράφουμε. Καμία πηγή δεν αναφέρει παροχές στην ίδια την παραλία. Σιγουριά ΕΜΕΙΝΕ medium.',
  },
  {
    id: 2289, name: 'Λάλα',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές', 'εκδρομικό σκάφος από Διαφάνι'],
    note: 'Πέρασμα 2026-09-01: η Λάλα εμφανίζεται στις εκδρομές του Nikos Boat από το Διαφάνι (ήδη καταγεγραμμένο) και σε καμία αφιερωμένη σελίδα παραλίας. Κενή λίστα -> συγκρατημένη διατύπωση + ο τρόπος που πράγματι φτάνει ο κόσμος· σιγουριά αμετάβλητη.',
  },
  {
    id: 2290, name: 'Μακριά',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    note: 'Πέρασμα 2026-09-01: η Μακριά αναφέρεται μόνο ως μέρος της παράκτιας ζώνης νότια του Διαφανιού (Απόκαπος/Παπά Μηνά). Κενή λίστα -> συγκρατημένη διατύπωση· σιγουριά αμετάβλητη.',
  },
  {
    id: 2295, name: 'Ποντικάλια',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    note: 'Πέρασμα 2026-09-01: τα Ποντικάλια αναφέρονται ως στάση σε εκδρομές από το Διαφάνι, χωρίς δικά τους στοιχεία υποδομής. Κενή λίστα -> συγκρατημένη διατύπωση· σιγουριά αμετάβλητη.',
  },
  {
    id: 2297, name: 'Της Πέρδικας Ποταμός',
    addAmenities: ['χωρίς επιβεβαιωμένες σταθερές παροχές'],
    urls: ['https://www.alltrails.com/trail/greece/karpathos/lefkos-perdikas-o-potamos-beach-loop'],
    note: 'Απόσπασμα AllTrails (αναζήτηση 2026-09-01): κυκλική διαδρομή Λευκός -> Της Πέρδικας ο Ποταμός στη δυτική ακτή, «easy to park and not crowded», χωρίς σκιά στη διαδρομή· το νησάκι Σώκαστρο χαρακτηρίζει τον κόλπο. Καμία αναφορά σε παροχές στην παραλία.',
  },

  // ── 3. ΚΕΙΜΕΝΟ: οι 4 παραλίες της πόλης — αφιερωμένες σελίδες βρέθηκαν ────────
  {
    id: 3180, name: 'Άφωτη',
    promote: true,
    setOrganized: true,
    addAmenities: ['ξαπλώστρες εποχικά ή σε τμήματα', 'ομπρέλες εποχικά ή σε τμήματα', 'μπαρ κοντά'],
    urls: [
      'https://www.greeka.com/dodecanese/karpathos/beaches/afoti/',
      'https://www.allovergreece.com/Beaches/Descr/29/567/en',
    ],
    note: 'Απόσπασμα greeka + allovergreece (αναζήτηση 2026-09-01), αφιερωμένες σελίδες παραλίας: «Afoti is a continuation of Pigadia beach... extensive, fully organized and close to the capital»· «nice sandy shore adorned with a few pebbles... relatively shallow depth»· «only partly organized, with a few sunbeds and umbrellas lining the shore»· «On the promenade and in the surrounding area there are bars and tavernas». Η ίδια σελίδα περιγράφει την ακτή ως εκτεθειμένη — συμφωνεί με τη γεωμετρία που ήδη έχουμε (ανοιχτός κόλπος, χωρίς κάλυψη) και ΔΕΝ αντιγράφεται εδώ ως ισχυρισμός: την ένταση την κρίνει το μοντέλο ανέμου, όχι το κείμενο. Η σιγουριά ανέβηκε σε high και έφυγε η σημαία «θέλει επαλήθευση». Το `waterDepth` ΕΜΕΙΝΕ medium: η greeka λέει «relatively shallow», το KarpathosInfo «βαθαίνει σταδιακά» — το πεδίο τροφοδοτεί το μοντέλο βυθού και δεν αλλάζει χωρίς συμφωνία.',
  },
  {
    id: 3181, name: 'Βρόντη',
    promote: true,
    setOrganized: true,
    addAmenities: ['ξαπλώστρες εποχικά ή σε τμήματα', 'ομπρέλες εποχικά ή σε τμήματα'],
    urls: [
      'https://www.allovergreece.com/Beaches/Descr/29/582/en',
      'https://www.in2greece.com/english/places/summer/islands/karpathos-beaches.html',
    ],
    note: 'Απόσπασμα greeka/allovergreece (αναζήτηση 2026-09-01), αφιερωμένες σελίδες: «one of the longest beaches in Karpathos... possible to get there on foot from Pigadia»· «mostly sandy and stretches for 4 km»· «strewn with sand and pebbles, and it is partly organized with sunbeds and umbrellas»· «a number of restaurants and taverns in the area»· «Water Sports: NO»· «It never gets crowded and ranks among the quietest beaches near Karpathos Town». Σιγουριά -> high, έφυγε η σημαία «θέλει επαλήθευση». Το `organized` έγινε true ως ΜΕΡΙΚΩΣ οργανωμένη — γι\' αυτό οι παροχές γράφτηκαν «εποχικά ή σε τμήματα» και όχι σκέτο «ξαπλώστρες».',
  },
  {
    id: 3182, name: 'Διαφάνι',
    promote: true,
    setOrganized: true,
    addAmenities: ['ξαπλώστρες εποχικά', 'ομπρέλες εποχικά'],
    urls: [
      'https://www.greeka.com/dodecanese/karpathos/beaches/diafani-beach/',
      'https://el.wikipedia.org/wiki/%CE%94%CE%B9%CE%B1%CF%86%CE%AC%CE%BD%CE%B9_%CE%9A%CE%B1%CF%81%CF%80%CE%AC%CE%B8%CE%BF%CF%85',
    ],
    note: 'Απόσπασμα greeka + Βικιπαίδεια (αναζήτηση 2026-09-01), αφιερωμένες σελίδες: «a long pebbly beach stretching for at least 200 meters, located right in front of Diafani\'s seaside promenade»· «small gray pebbles with a crystal clear sea»· «Its inviting azure waters deepen gradually» — στηρίζει το καταγεγραμμένο μέτριο βάθος· «the beach is cut in two by a pier used by excursion boats»· «The beach is organized with umbrellas and sunbeds, but there is still enough room left for visitors to lay down their own equipment»· «taverns and cafes that line the picturesque seafront». Σιγουριά -> high, έφυγε η σημαία. ΑΝΟΙΧΤΟ: δύο πηγές λένε μόνο βότσαλα, το record γράφει και χοντρή άμμο — δεν άλλαξε εδώ, θέλει τρίτη πηγή ή επιτόπου.',
  },
  {
    id: 3183, name: 'Πηγάδια',
    promote: true,
    addAmenities: ['μπαρ κοντά'],
    urls: [
      'https://www.in2greece.com/english/places/summer/islands/karpathos-beaches/pigadia-beach.html',
      'https://www.tripadvisor.com/Attraction_Review-g1188925-d4298041-Reviews-Pigadia_Beach-Karpathos_Town_Pigadia_Karpathos_Dodecanese_South_Aegean.html',
    ],
    note: 'Απόσπασμα greeka/in2greece/Tripadvisor (αναζήτηση 2026-09-01), αφιερωμένες σελίδες: «lies just a few minutes from the town center, stretching right to the left of Karpathos Port and the Archaeological Museum»· «stretches some 3 kilometres along the bay with fine golden sand»· «mainly covered with sand, gravel-like pebbles and stones, with medium depth in relation to other beaches on the island» — στηρίζει το καταγεγραμμένο μέτριο βάθος και το καταγεγραμμένο έδαφος· «well-organized with umbrellas and sunbeds, while several taverns, cafes, bars and hotels can be found along the beach»· «only a 5-15 minute walk from the town». Σιγουριά -> high, έφυγε η σημαία «θέλει επαλήθευση».',
  },

  // ── 4. ΠΛΟΗΓΗΣΗ: στάμπα όπου η πηγή λέει ρητά πώς φτάνεις ─────────────────────
  {
    id: 2282, name: 'Καστέλια',
    nav: true,
    urls: ['https://karpathosinfo.com/kastelia-bay/'],
    note: 'Απόσπασμα KarpathosInfo (αναζήτηση 2026-09-01): «Kastelia bay is located on the eastern coast of the island, in the southern areas of Amoopi (Lakki) village... well hidden by the hills»· «This place is organized only with some parasols and sunbeds for rent, because there are not enough place for other tourist services»· «Accessibility is by car, or on foot from the center of Amoopi». Διασταυρώνεται με τον δικό μας έλεγχο εγγύτητας δρόμου της 16/08 (ασφαλτόδρομος 74 m, μονοπάτι 14 m από την πινέζα): η διαδρομή με αυτοκίνητο προς τη συντεταγμένη είναι η σωστή.',
  },
  {
    id: 2311, name: 'Παραλία Αγίου Νικολάου',
    nav: true,
    urls: ['https://www.greeka.com/dodecanese/karpathos/beaches/agios-nikolaos/'],
    note: 'Απόσπασμα greeka/KarpathosInfo (αναζήτηση 2026-09-01): «The famous sandy beach Agios Nikolaos in village Arkasa... fine yellow sand... and awesome views of Kasos island»· «There is parking place over the beach»· «There is beach volley court on the beach, sunbeds and umbrellas»· «Around the beach there are hotels, taverna and beach bar». Διασταυρώνεται με τον έλεγχο εγγύτητας δρόμου της 16/08 (ασφαλτόδρομος 75 m, μονοπάτι 51 m): η διαδρομή με αυτοκίνητο προς τη συντεταγμένη είναι η σωστή.',
  },
  {
    id: 2273, name: 'Αλιμούντα',
    nav: true,
    urls: ['https://www.islands.com/1945766/remote-island-saria-europe-greece-escape-crowds-beaches-snorkeling/'],
    note: 'Απόσπασμα (αναζήτηση 2026-09-01): «The island Saria contains beaches Palatia and Alimounta... accessible by boat excursions from Karpathos»· «Alimounda Beach is a calm, pool-like cove on the southern coast, surrounded by cliffs». Επιβεβαιώνει ταυτότητα + ότι δεν υπάρχει οδική πρόσβαση. Η στάμπα δεν αλλάζει τι βλέπει ο επισκέπτης: ο κανόνας ασφαλείας για boat_only γυρίζει ούτως ή άλλως σε «δείξε στον χάρτη».',
  },
  {
    id: 2284, name: 'Κάντρι',
    nav: true,
    urls: ['https://www.tripadvisor.com/Attraction_Review-g1190441-d12492057-Reviews-Nikos_Boat-Diafani_Karpathos_Dodecanese_South_Aegean.html'],
    note: 'Απόσπασμα (αναζήτηση 2026-09-01): «Kantri is among the northern beaches of Karpathos accessible by boat trips» από το Διαφάνι. Επιβεβαιώνει ταυτότητα + απουσία οδικής πρόσβασης· ο κανόνας ασφαλείας για boat_only κρατά το «δείξε στον χάρτη».',
  },
  {
    id: 2292, name: 'Παλάτια',
    nav: true,
    urls: ['https://www.tripadvisor.com/Attraction_Review-g189440-d10793165-Reviews-Saria_Island-Karpathos_Dodecanese_South_Aegean.html'],
    note: 'Απόσπασμα allovergreece/Tripadvisor (αναζήτηση 2026-09-01): «Palatia is the most famous beach of Saria, and can only be reached by boat from Diafani in the north or from Pigadia»· καθημερινές εκδρομές το καλοκαίρι και από τα δύο λιμάνια. Επιβεβαιώνει ταυτότητα + απουσία οδικής πρόσβασης.',
  },
  {
    id: 2302, name: 'Αγιά Ειρήνη',
    nav: true,
    note: 'Απόσπασμα KarpathosInfo (αναζήτηση 2026-09-01): «Agia Irini can be reached only by boat or sea kayak due to geographical conditions and is a large, but very secluded bay near Mesochori village, located on the west coastline» — ταυτίζεται λέξη προς λέξη με την ήδη καταγεγραμμένη σημείωσή μας. Επιβεβαιώνει ταυτότητα + απουσία οδικής πρόσβασης.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// ΕΦΑΡΜΟΓΗ
// ─────────────────────────────────────────────────────────────────────────────
const { normalizeAmenity } = await import('../utils/amenityMatching.js');

const source = readJson(R('public', 'greek_beaches.json'));
const byId = new Map(CHANGES.map((c) => [c.id, c]));
const applied = [];
const missing = new Set(byId.keys());

const addAmenity = (m, value) => {
  m.amenities = Array.isArray(m.amenities) ? m.amenities : [];
  if (m.amenities.some((x) => normalizeAmenity(x) === normalizeAmenity(value))) return false;
  m.amenities.push(value);
  return true;
};
const addUrl = (m, url) => {
  if (!url) return false;
  m.sourceUrls = Array.isArray(m.sourceUrls) ? m.sourceUrls : [];
  if (m.sourceUrls.includes(url)) return false;
  m.sourceUrls.push(url);
  return true;
};
const appendNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = [m.sourceNotes, line].filter(Boolean);
};

(function walk(node) {
  if (Array.isArray(node)) { node.forEach(walk); return; }
  if (!node || typeof node !== 'object') return;

  const change = Number.isInteger(node.id) ? byId.get(node.id) : undefined;
  if (change && node.metadata) {
    missing.delete(change.id);
    const m = node.metadata;
    const did = { amenities: [], urls: [] };

    for (const value of change.addAmenities || []) if (addAmenity(m, value)) did.amenities.push(value);
    for (const url of change.urls || []) if (addUrl(m, url)) did.urls.push(url);

    if (change.setShade === true && m.shade !== true) { m.shade = true; did.shade = true; }
    if (change.setOrganized === true && m.organized !== true) { m.organized = true; did.organized = true; }

    if (change.promote) {
      if (m.confidence !== 'high') { did.confidence = `${m.confidence} -> high`; m.confidence = 'high'; }
      if (m.needsVerification === true) { delete m.needsVerification; did.clearedFlag = true; }
    }

    if (change.nav) {
      const nav = m.googleMapsNavigation || {};
      if (nav.status !== 'verified') {
        m.googleMapsNavigation = { ...nav, status: 'verified', mode: 'coordinates', checkedAt: STAMP, method: METHOD };
        did.nav = true;
      }
    }

    appendNote(m, `Κάρπαθος ξαναέλεγχος ${STAMP} (${METHOD}): ${change.note}`);
    applied.push({ id: change.id, name: change.name, ...did });
  }

  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(source);

// ── αναφορά ──────────────────────────────────────────────────────────────────
console.log(`applyKarpathosRecheck2026-09 — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length}/${CHANGES.length} παραλίες`);
for (const a of applied) {
  const bits = [
    a.amenities.length ? `+παροχές[${a.amenities.join(' · ')}]` : '',
    a.shade ? '+σκιά' : '',
    a.organized ? '+οργανωμένη' : '',
    a.confidence ? `+σιγουριά(${a.confidence})` : '',
    a.clearedFlag ? '-σημαία«θέλει επαλήθευση»' : '',
    a.nav ? '+πλοήγηση' : '',
    a.urls.length ? `+${a.urls.length} πηγές` : '',
  ].filter(Boolean);
  console.log(`  #${a.id} ${a.name.padEnd(24)} ${bits.join(' ')}`);
}
if (missing.size) {
  console.error(`\nΔΕΝ ΒΡΕΘΗΚΑΝ στο greek_beaches.json: ${[...missing].join(', ')}`);
  process.exitCode = 1;
}

if (write) {
  writeFileSync(R('public', 'greek_beaches.json'), `${JSON.stringify(source, null, 2)}\n`, 'utf8');
  console.log('\nΓράφτηκε το public/greek_beaches.json — τρέξε τώρα: npm run build:beach-data');
}
mkdirSync(R('reports', 'quality'), { recursive: true });
writeFileSync(
  R('reports', 'quality', `karpathos-recheck-${STAMP}.json`),
  `${JSON.stringify({ generatedAt: STAMP, regionId: 'south-aegean-karpathos', method: METHOD, written: write, applied, changes: CHANGES }, null, 1)}\n`,
  'utf8'
);
