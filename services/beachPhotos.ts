/**
 * Real beach photos from Wikimedia Commons and other license-safe sources.
 * Uses Special:Redirect for auto-scaled thumbnails.
 */
import { getBeachImageMetadata, getBeachImageMetadataById, type BeachImageMetadata } from './beachImageService';
import BEACH_PHOTOS_BY_ID from '../data/beachPhotosById.generated.json';

const wm = (filename: string) =>
  `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(filename)}&width=800`;

const MILOS_UNSPLASH_COVE =
  'https://images.unsplash.com/photo-1617727347345-fdd8c918018e?auto=format&fit=crop&w=1200&q=80';
const MILOS_PEXELS_SOUTH_BAY =
  'https://images.pexels.com/photos/21044933/pexels-photo-21044933.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const MILOS_PEXELS_GERAKAS =
  'https://images.pexels.com/photos/34020716/pexels-photo-34020716.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const MILOS_PEXELS_BOATS_CLIFFS =
  'https://images.pexels.com/photos/32137725/pexels-photo-32137725.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';
const MILOS_FLICKR_KLEFTIKO =
  'https://live.staticflickr.com/2583/3719197583_b704d860b3_b.jpg';
const MILOS_FLICKR_PIRATES_LAIR =
  'https://live.staticflickr.com/4152/5026007564_b48a3907a0_b.jpg';

const ATTICA_FLISVOS_PHOTOS = [
  wm('2009-02-18 Athen-Flisvos 01.jpg'),
  wm('2009-02-19 Flisvos 01.jpg'),
  wm('Flisvos banner.jpg'),
];
const ATTICA_PALMYRA_PHOTOS = [
  wm('Attica 06-13 Paleo Faliro 04 beach.jpg'),
];
const ATTICA_BATIS_PHOTOS = [wm('Batis Palaio Faliro beach.jpg')];
const ATTICA_EDEM_PHOTOS = [
  wm('Edem beach - panoramio.jpg'),
  wm('Edem beach - panoramio - Robert Freeman.jpg'),
];
const ATTICA_ALIMOS_A_PLAZ_PHOTOS = [
  wm('Alimos - panoramio (16).jpg'),
  wm('Alimos - panoramio (15).jpg'),
  wm('Kalamaki from the Saronic Gulf.jpg'),
];
const ATTICA_AKTI_TOU_ILIOU_PHOTOS = [
  wm('Alimos - panoramio (15).jpg'),
  wm('Kalamaki from the Saronic Gulf.jpg'),
];
const ATTICA_AGIOS_KOSMAS_PHOTOS = [
  wm('Promontory of Agios Kosmas (Attica) 02.JPG'),
  wm('Promontory of Agios Kosmas (Attica) 01.JPG'),
];
const ATTICA_GLYFADA_A_PHOTOS = [wm('Glyfada Beach (3368837046).jpg')];
const ATTICA_GLYFADA_B_PHOTOS = [wm('Glyfada Beach (3368014335).jpg')];
const ATTICA_GLYFADA_C_PHOTOS = [wm('Glyfada beach 01.jpg')];
const ATTICA_GLYFADA_D_PHOTOS = [wm('Glyfada beach 02.jpg'), wm('Glyfada beach 03.jpg')];
const ATTICA_ASTERAS_GLYFADA_PHOTOS = [
  wm('Asteras Beach Glyfada Athens, Greece (44869108691).jpg'),
  wm('Asteras Strand Glyfada Athen, Griechenland (43057427780).jpg'),
];
const ATTICA_VOULA_A_PLAZ_PHOTOS = [
  wm('Beach of Voula Athens 20190819.jpg'),
  wm('Voula - panoramio (10).jpg'),
];
const ATTICA_VOULA_B_PLAZ_PHOTOS = [
  wm('Β΄ Πλαζ Βούλας DJI 4004.jpg'),
  wm('Voula - panoramio (17).jpg'),
];
const ATTICA_MIKRO_KAVOURI_PHOTOS = [
  wm('Καβούρι IMG 20230807 160927.jpg'),
  wm('Παραλία Κραμπο, Καβούρι IMG 20230620 153319.jpg'),
];
const ATTICA_MEGALO_KAVOURI_PHOTOS = [wm('Μεγάλο Καβούρι IMG 20230609 182305.jpg')];
const ATTICA_VARKIZA_PHOTOS = [
  wm('Η Παραλία της Βάρκιζας.jpg'),
  wm('Παραλία Βάρκιζας (1).jpg'),
  wm('Παραλία Βάρκιζας (2).jpg'),
];
const ATTICA_ZEN_NIRIIDES_PHOTOS = [wm('Παραλία Νηρηίδες-Ζεν IMG 20230731 170540.jpg')];
const ATTICA_ASTIR_VOULIAGMENI_PHOTOS = [
  wm('Astir beach vouliagmeni greece photos pc2.jpg'),
  wm('Beach Huts, Astir Beach, Vouliagmeni, Athens, Greece, 2009.jpg'),
  wm('Sunset at Astir Beach, Vouliagmeni, Athens, Greece.jpg'),
];
const ATTICA_LAKE_VOULIAGMENI_PHOTOS = [
  wm('Vouliagmeni Lake Athens Greece.jpg'),
  wm('Lake Vouliagmeni (Attica) - Λίμνη Βουλιαγμένης (Αττική).JPG'),
];
const ATTICA_PANAGITSA_DYTISSA_PHOTOS = [
  wm('Λαιμός Αττικής.jpg'),
  wm('Λαιμός Αττικής και Κασίδης.jpg'),
];
const ATTICA_LIMANAKIA_PHOTOS = [
  wm('2nd Limanaki of Vouliagmeni (01).jpg'),
  wm('2nd Limanaki of Vouliagmeni (04).jpg'),
  wm('2nd Limanaki of Vouliagmeni (10).jpg'),
];
const ATTICA_LIMANAKIA_NUDIST_PHOTOS = [
  wm('2nd Limanaki of Vouliagmeni (08).jpg'),
  wm('2nd Limanaki of Vouliagmeni (09).jpg'),
  wm('2nd Limanaki of Vouliagmeni (05).jpg'),
];
const ATTICA_FLEVES_PHOTOS = [wm('Fleves Φλέβες 2020-08-21 a Aegina Αίγινα.jpg')];

const BEACH_PHOTOS: Record<string, string[]> = {

  // ==================== ATTICA ====================
  'Voula Beach': ATTICA_VOULA_A_PLAZ_PHOTOS,
  'Βούλα': ATTICA_VOULA_A_PLAZ_PHOTOS,
  'Βουλιαγμένη': ATTICA_LAKE_VOULIAGMENI_PHOTOS,

  // ==================== CRETE ====================
  'Μπάλος': [wm('Balos Beach.jpg'), wm('Bay of Balos, Crete 001.jpg')],
  'Balos': [wm('Balos Beach.jpg')],
  'Ελαφονήσι': [wm('Elafonissi.jpg')],
  'Elafonissi': [wm('Elafonissi.jpg')],
  'Μάταλα': [wm('Matala beach cliff Crete Greece.jpg')],
  'Matala': [wm('Matala beach cliff Crete Greece.jpg')],
  'Πρέβελη': [wm('Preveli Palm Beach 01.JPG')],
  'Preveli': [wm('Preveli Palm Beach 01.JPG')],
  'Βάι': [wm('Vai R06.jpg')],
  'Vai': [wm('Vai R06.jpg')],
  'Σεϊτάν Λιμάνια': [wm('Chania - Seitan Limania.jpg')],
  'Φαλάσαρνα': [wm('Greece Crete Chania FalasarnaBeach Aerial Summer ISymeonidis-4-S.jpg')],
  'Falassarna': [wm('Greece Crete Chania FalasarnaBeach Aerial Summer ISymeonidis-4-S.jpg')],
  'Γεωργιούπολη': [wm('Georgioupoli beach, Georgioupoli, Chania, Crete, Greece - panoramio (1).jpg')],
  'Μπαλί': [wm('Bali, Crete, Greece.jpg')],
  'Bali': [wm('Bali, Crete, Greece.jpg')],
  'Πλακιάς': [wm('Plakias Beach 01.JPG')],
  'Plakias': [wm('Plakias Beach 01.JPG')],
  'Αγία Γαλήνη': [wm('Beaches of Agia Galini, Crete, Greece 001.jpg')],
  'Τριόπετρα': [wm('Τριόπετρα 2950.jpg')],
  'Ξερόκαμπος': [wm('Beach in Xerokampos, Crete, Greece - panoramio.jpg')],

  // ==================== CYCLADES ====================
  // --- Santorini ---
  'Περίσσα': [wm('Beach - Perissa - Santorini - Greece - 04.jpg')],
  'Perissa': [wm('Perissa Beach, Santorini on June 7, 2009.jpg')],
  'Καμάρι': [wm('Kamari Beach, Santorini, Greece - panoramio (3).jpg')],
  'Kamari': [wm('Boat at Kamari beach, Santorini, Greece.jpg')],
  'Κόκκινη Παραλία': [wm('Red Beach, Santorini.jpg'), wm('Red Beach in Santorini.jpg')],
  'Red Beach': [wm('Red Beach, Santorini.jpg'), wm('Red Beach, Santorini, 226476.jpg')],
  'Περίβολος': [wm('Perivolos (Santorini).jpg'), wm('Perivolos beach, Santorini (1335681187).jpg')],
  'White Beach': [wm('AspriParalia.jpg')],

  // --- Mykonos ---
  'Σούπερ Παράδεισος': [wm('Super Paradise Beach, Mykonos, Greece.jpg')],
  'Super Paradise': [wm('Super Paradise Beach, Mykonos, Greece.jpg')],
  'Paradise Beach': [wm('Cyclades Mykonos Paradise Plage 23062013 - panoramio.jpg')],
  'Ελιά': [wm('Elias Beach on Mykonos.JPG')],
  'Elia': [wm('Elias Beach on Mykonos.JPG')],
  'Πλατύς Γιαλός': [wm('Mykonos Platis Gialos Luftbild 03.jpg')],
  'Όρνος': [wm('GR-mykonos-ornos-beach.jpg')],
  'Ornos': [wm('GR-mykonos-ornos-beach.jpg')],
  'Άγιος Στέφανος': [wm('Agios Stefanos beach Mykonos.jpg')],
  'Φτελιά': [wm('Ftelia Bay, Mykonos, 060363.jpg')],
  'Ψαρρού': [wm('Mykonos Beach Strand (24005199291).jpg')],
  'Πάνορμος': [wm('Mykonos 3160.jpg')],
  'Παράγκα': [wm('III Mykonos, Greece (2).jpg')],

  // --- Paros ---
  'Κολυμπήθρες': [wm('Paros Kolymbithres1 tango7174.jpg')],
  'Kolymbithres': [wm('Paros Kolymbithres1 tango7174.jpg')],
  'Πιπέρι': [wm('GR-paros-naoussa-piperi-strand.jpg')],
  'Φάραγγας': [wm('Cyclades Paros Faragas Beach - panoramio.jpg')],
  'Μώλος': [wm('Cyclades Paros Molos Beach Vue Naxos - panoramio.jpg')],
  'Σάντα Μαρία': [wm('Paros Beach.jpg')],
  'Λογαράς': [wm('GR-paros-piso-livada-beach.jpg')],

  // --- Naxos ---
  'Αγία Άννα': [wm('Beach Agia Anna, Naxos, 060762.jpg')],
  'Agia Anna': [wm('Beach Agia Anna, Naxos, 060762.jpg')],
  'Άγιος Προκόπιος': [wm('Agios Prokopios beach, Naxos, Greece.jpg'), wm('Agios Prokopios Beach at sunset, Naxos, Greece julesvernex2.jpg')],
  'Agios Prokopios': [wm('Agios Prokopios beach, Naxos, Greece.jpg'), wm('Agios Prokopios Beach at sunset, Naxos, Greece julesvernex2.jpg')],
  'Πλάκα': [wm('Sunset from Plaka beach, Naxos island, Greece - panoramio.jpg')],
  'Plaka': [wm('Sunset from Plaka beach, Naxos island, Greece - panoramio.jpg')],
  'Μικρή Βίγλα': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 01.jpg'), wm('Vigla Beach, Naxos isl.jpg')],
  'Mikri Vigla': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 01.jpg')],
  'Άγιος Γεώργιος': [wm('City beach Agios Georgios, Naxos, 11H2322.jpg')],

  // --- Milos ---
  'Σαρακίνικο': [wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'), wm('Aerial view of Sarakiniko Beach on Milos Island, Greece.jpg')],
  'Sarakiniko': [wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'), wm('Sarakiniko Beach on the island of Milos, Greece.jpg')],
  'Φυριπλάκα': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Firiplaka': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Fyriplaka': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Παπάφραγκας': [wm('From the Hellenistic settlement Fylakopi to Papafragas beach, Milos, 152878.jpg')],
  'Papafragas': [wm('From the Hellenistic settlement Fylakopi to Papafragas beach, Milos, 152878.jpg')],
  'Τσιγκράδο': [wm('Moonscape surrounding Sarakiniko Beach on Milos Island, Greece.jpg')],
  'Tsigrado': [wm('Moonscape surrounding Sarakiniko Beach on Milos Island, Greece.jpg')],

  // --- Ios ---
  'Μυλοπότας': [wm('Ios Milopotas.JPG')],
  'Mylopotas': [wm('Ios Milopotas.JPG')],
  'Μαγγανάρι': [wm('Ios island, Cyclades, Greece beach view 2007.jpg')],

  // --- Folegandros ---
  'Λιβαδάκι': [wm('Paralia Livadaki Beach, Folegandros, Greece.jpg')],
  'Αγκάλη': [wm('Angali beach, Folegandros, 15M6560.jpg')],
  'Κάτεργο': [wm('Cyclades Folegandros Katergo Plage - panoramio.jpg')],
  'Λιβάδι': [wm('Livadi Beach near camping, Folegandros, 153365.jpg')],
  'Άγιος Νικόλαος': [wm('St Nicolaos beach, Folegandros.jpeg')],

  // --- Tinos ---
  'Κολυμπήθρα': [wm('Agios Romanos beach, Tinos, Greece julesvernex2.jpg')],
  'Άγιος Ρωμανός': [wm('Agios Romanos beach, Tinos, Greece julesvernex2.jpg')],
  'Άγιος Σώστης': [wm('Top-down view of skerry near the beach, Agios Sostis, Tinos, Greece julesvernex2.jpg')],
  'Άγιος Φωκάς': [wm('Wave, Agios Fokas beach, Tinos, Greece julesvernex2.jpg')],
  'Όρμος Υστερνίων': [wm('Shallow waters, Isternion Beach, Tinos, Greece julesvernex2.jpg')],
  'Παχιά άμμος': [wm('Beach bar with lifeguard tower in the background, Megali Ammos Beach, Tinos, Greece julesvernex2.jpg')],
  'Άγιος Ιωάννης Πόρτο': [wm('Yellow buoys, Agios Ioannis Beach, Tinos, Greece julesvernex2.jpg')],

  // --- Andros ---
  'Βιτάλι': [wm('Vitali Bay1.jpg'), wm('Vitali Bay3.jpg')],
  'Της γριας το πήδημα': [wm('Pidima Grias Beach - panoramio.jpg'), wm('Παραλία της γριάς το πήδημα, Άνδρος.jpg')],
  'Κυπρί': [wm('Παραλία κυπρί 2019.jpg')],
  'Μπατσί': [wm('Main beach at Chora Andros, Andros Island, Cyclades, Greece.jpg')],

  // --- Amorgos ---
  'Αγία Άννα Αμοργός': [wm('Amorgos plage d aghia anna IMG 2757.JPG')],
  'Καλοταρίτισσα': [wm('The natural bay where Kalotaritissa beach is located.jpg')],
  'Νικουριά': [wm('Panagia beach in Nikouria island, 18M2105.jpg'), wm('Great beach on the Nikouria island, 18M2127.jpg')],

  // --- Serifos ---
  'Λιβαδάκια': [wm('A@a livadakia beach serifos greece - panoramio.jpg'), wm('Livadakia Beach Serifos (209164677).jpeg')],
  'Γάνεμα': [wm('A@a Ganema beach 1 Serifos Greece - panoramio.jpg'), wm('Ganema serifos.jpg')],
  'Καλό Αμπέλι': [wm('Kalo Ampeli beach, Serifos island, Greece - panoramio.jpg')],
  'Αυλόμωνας': [wm('A@a avlomonas beach serifos greece - panoramio.jpg')],
  'Μέγα Λιβάδι': [wm('A@a Mega Livadi 1 Serifos Greece - panoramio.jpg')],

  // --- Sifnos ---
  'Βαθύ': [wm('Beach in Vathy on Sifnos, 153617.jpg'), wm('Beach in Vathy on Sifnos, 153621.jpg')],
  'Φάρος': [wm('Faros Sifnos Cyclades.jpg')],
  'Καμάρες': [wm('Kamares from Ag. Marina, Sifnos, 15M6920.jpg')],
  'Πλατύς Γιαλός Σίφνος': [wm('Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg')],

  // --- Syros ---
  'Μέγας Γυαλός': [wm('Megas Gyalos Syros 1.jpg'), wm('Megas Gyalos Syros 2.jpg')],
  'Αγαθοπές': [wm('Agathopes beach Syros 1.jpg'), wm('Agathopes beach Syros 2.jpg')],
  'Γαλησσάς': [wm('View of Galisas beach in Syros.jpg')],
  'Δελφίνι': [wm('Delfini beach Syros 1.jpg'), wm('Delfini beach Syros 3.jpg')],
  'Φοίνικας': [wm('Foinikas beach Syros 4.jpg')],

  // --- Kea ---
  'Κούνδουρος': [wm('Kea (Tzia) beach.jpg')],

  // --- Anafi ---
  'Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
  'Κλεισίδι': [wm('Roukounas beach and Kalamos.jpg')],

  // ==================== IONIAN ====================
  // Zakynthos
  'Ναυάγιο': [wm('Navagio beach Zakynthos.jpg')],
  'Navagio': [wm('Navagio beach Zakynthos.jpg')],
  // Kefalonia
  'Μύρτος': [wm('Myrtos Beach, Kefalonia.jpg')],
  'Myrtos': [wm('Myrtos Beach, Kefalonia.jpg')],
  'Αντίσαμος': [wm('Antisamos Beach, Kefalonia - panoramio.jpg')],
  'Antisamos': [wm('Antisamos Beach, Kefalonia - panoramio.jpg')],
  'Xi Beach': [wm('Xi Beach Kefalonia.jpg')],
  'Πετανι': [wm('Petani Beach, Kefalonia.jpg')],
  // Lefkada
  'Πόρτο Κατσίκι': [wm('Porto Katsiki SF 0001.jpg')],
  'Porto Katsiki': [wm('Porto Katsiki SF 0001.jpg')],
  // Corfu
  'Παλαιοκαστρίτσα': [wm('Corfu Paleokastritsa Beach R01.jpg')],
  'Paleokastritsa': [wm('Corfu Paleokastritsa Beach R01.jpg')],
  'Πόρτο Τιμόνι': [wm('Porto Timoni Beach.jpg')],

  // ==================== DODECANESE ====================
  // Rhodes
  'Τσαμπίκα': [wm('Tsambika (Rhodos).JPG')],
  'Tsambika': [wm('Tsambika (Rhodos).JPG')],
  'Λίνδος': [wm('Rhodos Lindos Beach R01.jpg')],
  'Lindos': [wm('Rhodos Lindos Beach R01.jpg')],
  'Αντονί Κουίν': [wm('Anthony-Quinn-Bay1.jpg')],
  'Anthony Quinn': [wm('Anthony-Quinn-Bay1.jpg')],
  'Παραλία Άντονι Κουίν': [wm('Anthony Qeen bay 1 - panoramio.jpg'), wm('Anthony-Quinn-Bay1.jpg')],
  'Πρασονήσι': [wm('Peninsula of Prasonisi and Prasonisi Kite Beach. Rhodes, Greece.jpg')],
  'Prasonisi': [wm('Peninsula of Prasonisi and Prasonisi Kite Beach. Rhodes, Greece.jpg')],
  'Παραλία Αφάντου': [wm('Afantou beach, Rhodes.jpg')],
  'Afantou': [wm('Afantou beach, Rhodes.jpg')],
  'Παραλία Αγάθη': [wm('Agathe Beach, Rhodos Mai 2016.JPG')],
  'Agathi': [wm('Agathe Beach, Rhodos Mai 2016.JPG')],
  'Παραλία Αλυκή': [wm('Alykì beach.jpg')],
  'Κόλπος Αγίου Παύλου': [wm('Bay of St. Paul.jpg')],
  'Παραλία Χαράκι': [wm('Charaki Rhodes Greece M.jpg')],
  'Charaki': [wm('Charaki Rhodes Greece M.jpg')],
  'Παραλία Κολύμπια': [wm('Kolymbia Strand.jpg')],
  'Κολύμπια': [wm('Kolymbia Strand.jpg')],
  'Παραλία Λίνδου (Μεγάλη Παραλία)': [wm('Aerial view of Lindos Beach, Rhodes, Greece (51698537801).jpg')],
  'Παραλία Παλλάς': [wm('Rhodos Lindos Pallas Beach.jpg')],
  'Παραλία Ζέφυρος': [wm('Golden Sand Zefyros Beach Rhodes 2 August 2025.jpg')],
  'Παραλία Ιξιάς': [wm('Ixia beach Rhodes Greece 1.jpg')],

  // --- Kos ---
  'Παραλία Μαστιχάρι (Νέπτουν)': [wm('Holidays Greece - panoramio (592).jpg')],
  'Παραλία Παράδεισος': [wm("Kos' Paradise Beach.jpg")],
  'Τιγκάκι': [wm('Beach at Kos (salt lake) - panoramio.jpg')],
  'Tigkaki': [wm('Beach at Kos (salt lake) - panoramio.jpg')],
  'Cavo Paradiso': [wm('Cavo Paradiso, Kos 01.jpg'), wm('Cavo Paradiso, Kos 02.jpg')],

  // --- Karpathos ---
  'Απέλλα': [wm('Apella Beach Karpathos 1.jpg')],
  'Apella': [wm('Apella Beach Karpathos 1.jpg')],
  'Αχάτα': [wm('Ahata.jpg')],
  'Achata': [wm('Ahata.jpg')],
  'Παραλία Διακοφτης': [wm('Diakoftis.jpg')],
  'Κυρά Παναγιά': [wm('Kira Panagia-1.jpg')],
  'Kyra Panagia': [wm('Kira Panagia-1.jpg')],

  // ==================== HALKIDIKI ====================
  'Καβουρότρυπες': [wm('Kavourotripes Beach, Sykia, Sithonia, Chalkidiki, Greece 02.jpg')],
  'Kavourotrypes': [wm('Kavourotripes Beach, Sykia, Sithonia, Chalkidiki, Greece 02.jpg')],

  // ==================== SPORADES ====================

  // ==================== PELOPONNESE ====================
  'Βοϊδοκοιλιά': [wm('Voidokilia Beach1.jpg')],
  'Voidokilia': [wm('Voidokilia Beach1.jpg')],
  'Σιμός': [wm('Elafonisos island Simos Beach.jpg')],
  'Simos': [wm('Elafonisos island Simos Beach.jpg')],
  'Ελαφόνησος': [wm('Elafonisos island Simos Beach.jpg')],
  'Ρωμανός': [wm('Romanos beach - panoramio.jpg')],
  'Romanos': [wm('Romanos beach - panoramio.jpg')],
  'Παραλία Ριτσά': [wm('Kardamili at Ritsa beach.jpg')],
  'Στούπα': [wm('Stoupa village, Kalogria beach 2.jpg')],
  'Stoupa': [wm('Stoupa village, Kalogria beach 2.jpg')],

  // ==================== PELION (Magnesia) ====================
  'Πλάκα (Ζαγορά)': [wm('Plaka Beach - Pelion.jpg')],

  // ==================== EVIA / LAKONIA / ASTYPALAIA (geo/title-verified) ====================
  'Παραλία Πευκί': [wm('Evia Pefki Banner.jpg')],
  'Πορί': [wm('Monemvasia - panoramio (11).jpg')],
  'Κούνουπες': [wm('Kounoupas.jpg')],

  // ==================== MACEDONIA mainland (Thessaloniki/Pieria, geo-verified) ====================
  'Παραλία Νέων Βρασνών': [wm('Νέα Βρασνά - panoramio (3).jpg')],
  'ΚΑΑΥ Ασπροβάλτας': [wm('Ασπροβάλτα - panoramio (14).jpg')],
  'Παραλία Κατερίνης': [wm('Grecja, Paralia - panoramio.jpg')],
};

const ATTICA_BEACH_PHOTOS_BY_AREA: Record<string, Record<string, string[]>> = {
  athens_coast: {
    'Voula Beach': ATTICA_VOULA_A_PLAZ_PHOTOS,
    'Voula': ATTICA_VOULA_A_PLAZ_PHOTOS,
    'Βούλα': ATTICA_VOULA_A_PLAZ_PHOTOS,
    'Βουλιαγμένη': ATTICA_LAKE_VOULIAGMENI_PHOTOS,
    'Balux - The house project': ATTICA_ASTERAS_GLYFADA_PHOTOS,
    'Άγιος Κοσμάς': ATTICA_AGIOS_KOSMAS_PHOTOS,
    'Ακτή του Ήλιου': ATTICA_AKTI_TOU_ILIOU_PHOTOS,
    'του Ήλιου': ATTICA_AKTI_TOU_ILIOU_PHOTOS,
    "Α' Πλαζ Αλίμου «Στολίδι»": ATTICA_ALIMOS_A_PLAZ_PHOTOS,
    "Α' Πλαζ Αλίμου": ATTICA_ALIMOS_A_PLAZ_PHOTOS,
    'Αλίμου «Στολίδι»': ATTICA_ALIMOS_A_PLAZ_PHOTOS,
    'Παραλία Έδεμ': ATTICA_EDEM_PHOTOS,
    'Έδεμ': ATTICA_EDEM_PHOTOS,
    'Εδέμ': ATTICA_EDEM_PHOTOS,
    'Παραλία Γλυφάδας Ακτή Α': ATTICA_GLYFADA_A_PHOTOS,
    'Γλυφάδας Ακτή Α': ATTICA_GLYFADA_A_PHOTOS,
    'Παραλία Γλυφάδας Ακτή Β': ATTICA_GLYFADA_B_PHOTOS,
    'Γλυφάδας Ακτή Β': ATTICA_GLYFADA_B_PHOTOS,
    'Παραλία Γλυφάδας Ακτή Γ': ATTICA_GLYFADA_C_PHOTOS,
    'Γλυφάδας Ακτή Γ': ATTICA_GLYFADA_C_PHOTOS,
    'Παραλία Γλυφάδας Ακτή Δ': ATTICA_GLYFADA_D_PHOTOS,
    'Γλυφάδας Ακτή Δ': ATTICA_GLYFADA_D_PHOTOS,
    'Παραλία Αστέρα Γλυφάδας': ATTICA_ASTERAS_GLYFADA_PHOTOS,
    'Αστέρα Γλυφάδας': ATTICA_ASTERAS_GLYFADA_PHOTOS,
    'Παραλία Μπάτη': ATTICA_BATIS_PHOTOS,
    'Μπάτη': ATTICA_BATIS_PHOTOS,
    'Παραλία Φλοίσβου': ATTICA_FLISVOS_PHOTOS,
    'Φλοίσβου': ATTICA_FLISVOS_PHOTOS,
    'Παλμύρα': ATTICA_PALMYRA_PHOTOS,
    'Παραλία Αγίου Αλεξάνδρου': ATTICA_AGIOS_KOSMAS_PHOTOS,
    'παραλια αγιου αλεξανδρου': ATTICA_AGIOS_KOSMAS_PHOTOS,
    "Α' Πλαζ Βούλας": ATTICA_VOULA_A_PLAZ_PHOTOS,
    "Β' πλαζ Βούλας": ATTICA_VOULA_B_PLAZ_PHOTOS,
    "Β' Πλαζ Βούλας": ATTICA_VOULA_B_PLAZ_PHOTOS,
    'Μικρό Καβούρι': ATTICA_MIKRO_KAVOURI_PHOTOS,
    'Παραλία Βάρκιζας': ATTICA_VARKIZA_PHOTOS,
    'Μεγάλο Καβούρι': ATTICA_MEGALO_KAVOURI_PHOTOS,
    'Zen Beach / Νηρηίδες': ATTICA_ZEN_NIRIIDES_PHOTOS,
    'Zen Beach': ATTICA_ZEN_NIRIIDES_PHOTOS,
    'Νηρηίδες': ATTICA_ZEN_NIRIIDES_PHOTOS,
    'Astir Beach / Αστέρας Βουλιαγμένης': ATTICA_ASTIR_VOULIAGMENI_PHOTOS,
    'Αστέρας Βουλιαγμένης': ATTICA_ASTIR_VOULIAGMENI_PHOTOS,
    'Λίμνη Βουλιαγμένης': ATTICA_LAKE_VOULIAGMENI_PHOTOS,
    'Παναγίτσα η Δύτισσα': ATTICA_PANAGITSA_DYTISSA_PHOTOS,
    'Λιμανάκια Βουλιαγμένης': ATTICA_LIMANAKIA_PHOTOS,
    'Λιμανάκια Βουλιαγμένης Γυμνιστών': ATTICA_LIMANAKIA_NUDIST_PHOTOS,
    'Νησίδα Φλέβες': ATTICA_FLEVES_PHOTOS,
  },
  east_attica: {
    'Παραλία Βραυρώνας': [wm('Vravrona Beach.jpg')],
    'Beach Vravrona': [wm('Vravrona Beach.jpg')],
    'Παραλία Βάρκιζας': ATTICA_VARKIZA_PHOTOS,
    'Yabanaki': ATTICA_VARKIZA_PHOTOS,
    "Β' πλαζ Βούλας": ATTICA_VOULA_B_PLAZ_PHOTOS,
    'Μεγάλο Καβούρι': ATTICA_MEGALO_KAVOURI_PHOTOS,
    'Μικρό Καβούρι': ATTICA_MIKRO_KAVOURI_PHOTOS,
    'Παραλία Αναβύσσου': [wm('Anavissos Beach (223585763).jpeg')],
    'Σκαλάκια Αναβύσσου': [wm('Anavissos Beach (223585763).jpeg')],
    'Τσονίμα': [wm('Tsonima beach.jpg')],
  },
  west_attica: {
    'Ψάθα': [wm('Psatha beach.jpg')],
    'Παραλία Πόρτο Γερμενό': [wm('Porto Germeno (Aigosthena) from the south-west - August 26, 2020.jpg')],
    'Porto Germeno': [wm('Porto Germeno (Aigosthena) from the south-west - August 26, 2020.jpg')],
  },
  aegina: {
    'Παραλία Κολώνα': [wm('Égine, Grèce, May 2019.jpg')],
    'Αύρα': [wm('Egina 180 10, Greece - panoramio (7).jpg')],
    'Αγία Μαρίνα': [wm('Lascar Aegina island - Bike ride (4519153533).jpg')],
  },
  agistri: {
    'Δραγονέρα': [wm('20090517 Dragonera Angistri island Greece 1.jpg')],
    'Χαλικιάδα': [wm('Chalikiada - Agkistri.jpg')],
    'Απόνησος': [wm('20090517 Aponissos landscape Angistri island Greece.jpg')],
  },
  hydra: {
    'Πλάκες': [wm('Plakes Strand Hydra (43958759235).jpg')],
  },
  kythira: {
    'Διακόφτι': [wm('Diakofti - Kythira - Greece - 2018.08.25 11.19.04.758 001.jpg')],
    'Κομπονάδα': [wm('Beach - Kombonada - Kythira - Greece - 2018.08.31 17.44.41.993 001.JPG')],
    'Μελιδόνι': [wm('Melidoni beach - panoramio.jpg')],
    'Παραλία Αγία Πελαγία': [wm('Agia Pelagia beach Cythera 1.jpg')],
    'Παραλία Καλαδί': [wm('Beach - Kaladi - Kythira - Greece - 2018.08.26 11.32.58.802 001.JPG')],
    'Παραλια Κακιά Λαγκάδα': [wm('Kakia Langada Kithira Greece.png')],
  },
  poros: {
    'Λιμανάκι της Αγάπης': [wm('Hidden paradise, Poros island, Greece - panoramio.jpg')],
  },
  salamina: {},
  spetses: {
    'Μικρή Ζωγεριά': [wm('Top-down aerial of Zogeria Beach on Spetses, Greece (48759807103).jpg')],
    'Άγιοι Ανάργυροι': [wm('Agioi Anargyri Beach on Spetses island, Greece, a view from above (48759923063).jpg')],
  },
  piraeus_coast: {
  },
};

const CRETE_BEACH_PHOTOS_BY_AREA: Record<string, Record<string, string[]>> = {
  chania: {
    'Παραλία Αγία Μαρίνα': [wm('Agia Marina - Cabana Mare beach.jpg')],
    'Παραλία Γλυκά Νερά': [wm('Paralia Glyka Nera 03.jpg')],
    'Παραλία Μάρμαρα': [wm('Marmara Beach-01.jpg')],
    'Γιαλισκάρι': [wm('Gialiskari 2022.jpg'), wm('Gialiskari beach - Crete, Greece - panoramio.jpg')],
    Gialiskari: [wm('Gialiskari 2022.jpg')],
    Balos: [wm('Balos Beach.jpg'), wm('Bay of Balos, Crete 001.jpg')],
    Μπάλος: [wm('Balos Beach.jpg'), wm('Bay of Balos, Crete 001.jpg')],
    Elafonisi: [wm('Elafonissi.jpg')],
    Elafonissi: [wm('Elafonissi.jpg')],
    Ελαφονήσι: [wm('Elafonissi.jpg')],
    Kedrodasos: [wm('Aerial view of Kedrodasos beach on Crete, Greece.jpg'), wm('Paralia Kedrodasos beach on Crete, Greece.jpg')],
    Falasarna: [wm('Greece Crete Chania FalasarnaBeach Aerial Summer ISymeonidis-4-S.jpg')],
    Falassarna: [wm('Greece Crete Chania FalasarnaBeach Aerial Summer ISymeonidis-4-S.jpg')],
    Φαλάσαρνα: [wm('Greece Crete Chania FalasarnaBeach Aerial Summer ISymeonidis-4-S.jpg')],
    'Seitan Limani': [wm('Chania - Seitan Limania.jpg')],
    'Σεϊτάν Λιμάνια': [wm('Chania - Seitan Limania.jpg')],
    Georgioupoli: [wm('Georgioupoli beach, Georgioupoli, Chania, Crete, Greece - panoramio (1).jpg')],
    Γεωργιούπολη: [wm('Georgioupoli beach, Georgioupoli, Chania, Crete, Greece - panoramio (1).jpg')],
    Sougia: [wm('Crete Sougia3 tango7174.jpg'), wm('Beach Sougia Chania Crete 03.jpg')],
    Marathi: [wm('Kato Marathi - panoramio (4).jpg'), wm('Kato Marathi - panoramio (5).jpg')],
  },
  heraklion: {
    Matala: [wm('Matala beach cliff Crete Greece.jpg')],
    Μάταλα: [wm('Matala beach cliff Crete Greece.jpg')],
    Kommos: [wm('Kommos Crete.jpg'), wm('Crete Kommos Plage 05092011 - panoramio.jpg')],
    Agiofarago: [wm('Αγιοφάραγγο - Agiofaraggo.jpg'), wm('Agiofarago Crete 1.jpg')],
    'Αμμουδάρα': [wm('AmoudaraBeach3.JPG')],
    Ammoudara: [wm('AmoudaraBeach3.JPG')],
    'Ληστής': [wm('Παραλία Ληστή 4104.jpg')],
    Listis: [wm('Παραλία Ληστή 4104.jpg')],
    'Star Beach': [wm('Chersonisos Kreta Crite 08 29 30 977000.jpeg')],
    'Μάρτσαλο': [wm('P1760568 Παραλία Μάρτσαλο.jpg')],
    Martsalo: [wm('P1760568 Παραλία Μάρτσαλο.jpg')],
  },
  rethymno: {
    Preveli: [wm('Preveli Palm Beach 01.JPG')],
    Πρέβελη: [wm('Preveli Palm Beach 01.JPG')],
    Plakias: [wm('Plakias Beach 01.JPG')],
    Πλακιάς: [wm('Plakias Beach 01.JPG')],
    Triopetra: [wm('Τριόπετρα 2950.jpg')],
    Τριόπετρα: [wm('Τριόπετρα 2950.jpg')],
    Damnoni: [wm('Damnoni 05.jpg')],
    Schinaria: [wm('Schinaria Beach Panorama 02.JPG'), wm('Schinaria Beach 01.JPG')],
    'Μικρή Τριόπετρα': [wm('Xylokambos 01.jpg')],
    'Mikri Triopetra': [wm('Xylokambos 01.jpg')],
  },
  lasithi: {
    Vai: [wm('Vai R06.jpg'), wm('Vai Beach Crete.jpg')],
    '\u0392\u03ac\u03b9': [wm('Vai R06.jpg'), wm('Vai Beach Crete.jpg')],
    Xerokampos: [wm('Beach in Xerokampos, Crete, Greece - panoramio.jpg')],
    '\u039e\u03b5\u03c1\u03cc\u03ba\u03b1\u03bc\u03c0\u03bf\u03c2': [wm('Beach in Xerokampos, Crete, Greece - panoramio.jpg')],
    Voulisma: [wm('Voulisma Beach, Istro, Crete.JPG'), wm('Istro Banner Voulisma Beach Istro Crete.JPG')],
    '\u0392\u03bf\u03cd\u03bb\u03b9\u03c3\u03bc\u03b1': [wm('Voulisma Beach, Istro, Crete.JPG'), wm('Istro Banner Voulisma Beach Istro Crete.JPG')],
    Kolokitha: [wm('Isle of Crete, Spinalonga peninsula beach 2019.jpg')],
    '\u039a\u03bf\u03bb\u03bf\u03ba\u03cd\u03b8\u03b1': [wm('Isle of Crete, Spinalonga peninsula beach 2019.jpg')],
    'Agia Fotia': [wm('Agia Fotia Beach by Evangelos Mpikakis.jpg')],
    '\u0391\u03b3\u03af\u03b1 \u03a6\u03c9\u03c4\u03b9\u03ac': [wm('Agia Fotia Beach by Evangelos Mpikakis.jpg')],
    Itanos: [wm('Crete Itanos 2024-08-21 02 beach.jpg'), wm('Crete Itanos 2024-08-21 07 beach.jpg')],
    '\u038a\u03c4\u03b1\u03bd\u03bf\u03c2': [wm('Crete Itanos 2024-08-21 02 beach.jpg'), wm('Crete Itanos 2024-08-21 07 beach.jpg')],
    'Mazida Ammos': [wm('Beach in Xerokampos, Crete, Greece - panoramio.jpg')],
    '\u039c\u03b1\u03b6\u03b9\u03b4\u03ac \u0386\u03bc\u03bc\u03bf\u03c2': [wm('Beach in Xerokampos, Crete, Greece - panoramio.jpg')],
    Argilos: [wm('Xerokambos Argilos 10.jpg'), wm('Xerokambos Argilos 14.jpg')],
    '\u0386\u03c1\u03b3\u03b9\u03bb\u03bf\u03c2': [wm('Xerokambos Argilos 10.jpg'), wm('Xerokambos Argilos 14.jpg')],
    Karoumes: [wm('Karoumes 05.jpg'), wm('Karoumes 15.jpg')],
    '\u039a\u03b1\u03c1\u03bf\u03cd\u03bc\u03b5\u03c2': [wm('Karoumes 05.jpg'), wm('Karoumes 15.jpg')],
  },
};

const MACEDONIA_BEACH_PHOTOS_BY_AREA: Record<string, Record<string, string[]>> = {
  halkidiki: {
    'Καβουρότρυπες': [wm('Kavourotripes Beach, Sykia, Sithonia, Chalkidiki, Greece 02.jpg')],
    Kavourotrypes: [wm('Kavourotripes Beach, Sykia, Sithonia, Chalkidiki, Greece 02.jpg')],
    Sarti: [wm('Beach in Sarti 02.jpg'), wm('Beach in Sarti 01.jpg')],
    'Πόρτο Κουφό': [wm('Beach Toroni.jpg')],
    'Porto Koufo': [wm('Beach Toroni.jpg')],
    'Παραλία Πευκοχωρίου': [wm('Beach of Pefkochori.IMG 0604.jpg')],
    Pefkochori: [wm('Beach of Pefkochori.IMG 0604.jpg')],
    Lagomandra: [wm('Lagomandra Beach 03.jpg'), wm('Lagomandra Beach 02.jpg')],
    'Akti Kalogrias': [wm('Kalogria Beach, Nikiti, Chalkidiki, Greece.jpg')],
    Sykia: [wm('Chalkidiki Banner Sykia Beach.jpg')],
    'Παραλία Αρετές': [wm('Tourist ship in front of BARbatolis Bar, Aretes Beach, Παραλία Αρετές, Toroni 630 72, Greece 01.jpg')],
    'Παραλία Νικήτης': [wm('Ai Yiannis beach in Nikiti.jpg')],
    'Mikri Elia': [wm('EliaBeach.jpg')],
    Tigania: [wm('Tigania.jpg')],
    'Παραλία Δεβελίκι': [wm('Develiki beach - panoramio.jpg')],
    Karagatsia: [wm('Karagatsia Beach, Ammouliani.jpg')],
  },
  kavala: {
    'Παραλία Καλαμίτσας': [wm('Kalamitsa beach, Kavala.jpg'), wm('Kalamitsa beach Kavala.jpg')],
    'Kalamitsa Beach': [wm('Kalamitsa beach, Kavala.jpg'), wm('Kalamitsa beach Kavala.jpg')],
    Ραψάνη: [wm('Rapsani Beach.jpg')],
    'Rapsani Beach': [wm('Rapsani Beach.jpg')],
  },
  thasos: {
    Σαλιάρα: [wm('Σαλιάρα Θάσου, Thasos.jpg')],
    'Χρυσή Αμμουδιά': [wm('Golden Beach, Thassos.JPG'), wm('Flickr - ronsaunders47 - GOLDEN BEACH .THASSOS. GREECE..jpg')],
    'Χρυσή Ακτή': [wm('Golden Beach, Thassos.JPG'), wm('Flickr - ronsaunders47 - GOLDEN BEACH .THASSOS. GREECE..jpg')],
    Παραδείσος: [wm('Paradise Beach, Kinira, Thasos.jpg'), wm('Paradise Beach, nudist area, Kinira, Thasos.jpg')],
    Καρνάγιο: [wm('Karnagio Beach Thasos.jpg')],
    Karnagio: [wm('Karnagio Beach Thasos.jpg')],
    Ποτός: [wm('Potos Grcka.jpg')],
    Potos: [wm('Potos Grcka.jpg')],
    'Σκάλα Μαριών': [wm('Skala Marion, Greece - panoramio (1).jpg')],
    'Skala Marion': [wm('Skala Marion, Greece - panoramio (1).jpg')],
    Παχύς: [wm('Pachis Beach Thasos.jpg')],
    Pachys: [wm('Pachis Beach Thasos.jpg')],
  },
};

const THRACE_BEACH_PHOTOS_BY_AREA: Record<string, Record<string, string[]>> = {
  evros: {
    'Παραλία Αλεξανδρούπολης': [wm('Coast along Alexandroupolis.jpg'), wm('Beach ahead of Alexandroupolis seafront.jpg')],
    'Παραλία Νέας Χιλής': [wm('Alexandroupolis beach and Samothraki.jpg')],
    'Άγιος Γεώργιος Μάκρης': [wm('Makri Beach, Evros.JPG'), wm('Makri coastline, Evros.JPG')],
  },
  rodopi: {},
  xanthi: {},
  samothraki: {
    Βάτος: [wm('Vatos Beach Samothrace.jpg')],
    'Παχιά Άμμος': [wm('Pachia Ammos Beach, Samothrace.jpg'), wm('Pachia Ammos beach, Samothraki, Greece.jpg')],
  },
};

const NORTH_AEGEAN_BEACH_PHOTOS_BY_AREA: Record<string, Record<string, string[]>> = {
  ikaria: {
    '\u039c\u03b5\u03c3\u03b1\u03ba\u03c4\u03ae': [wm('Messakti beach in Ikaria.jpg'), wm('Mesakti Beach, Ikaria, Greece julesvernex2.jpg')],
    Mesakti: [wm('Messakti beach in Ikaria.jpg'), wm('Mesakti Beach, Ikaria, Greece julesvernex2.jpg')],
    '\u039d\u03b1\u03c2': [wm('Nas beach Ikaria, Greece.jpg'), wm('Panorama view of Nas beach in Ikaria.jpg')],
    Nas: [wm('Nas beach Ikaria, Greece.jpg'), wm('Panorama view of Nas beach in Ikaria.jpg')],
    '\u03a3\u03b5\u03c5\u03c7\u03ad\u03bb\u03b5\u03c2': [wm('Ikaria P8281330.jpg')],
    Sevcheles: [wm('Ikaria P8281330.jpg')],
    '\u0391\u03c1\u03bc\u03b5\u03bd\u03b9\u03c3\u03c4\u03ae\u03c2': ['https://live.staticflickr.com/1443/26523126711_e2ba9f9f07_b.jpg'],
    Armenistis: ['https://live.staticflickr.com/1443/26523126711_e2ba9f9f07_b.jpg'],
    '\u039a\u03ac\u03bc\u03c0\u03bf\u03c2': ['https://live.staticflickr.com/65535/52415735294_0e3fdb60b2_b.jpg'],
    '\u03a6\u03cd\u03c4\u03b5\u03bc\u03b1': ['https://live.staticflickr.com/7667/17111446578_b749f9bb9d_b.jpg'],
  },
  samos: {
    '\u03a4\u03c3\u03b1\u03bc\u03b1\u03b4\u03bf\u03cd': [wm('Tsamadou 542s.jpg')],
    Tsamadou: [wm('Tsamadou 542s.jpg')],
    '\u039c\u03b5\u03b3\u03ac\u03bb\u03bf \u03a3\u03b5\u03ca\u03c4\u03ac\u03bd\u03b9': [wm('Megalo Seitani panorama 2.jpg'), wm('Megalo Seitani 1.jpg')],
    'Megalo Seitani': [wm('Megalo Seitani panorama 2.jpg'), wm('Megalo Seitani 1.jpg')],
    '\u03a0\u03bf\u03c4\u03ac\u03bc\u03b9': [wm('Samos-Potami-Bucht.JPG'), wm('Potami beach NIC7848.jpg')],
    Potami: [wm('Samos-Potami-Bucht.JPG'), wm('Potami beach NIC7848.jpg')],
    '\u039b\u03b9\u03b2\u03b1\u03b4\u03ac\u03ba\u03b9': [wm('Nisi. - panoramio.jpg')],
    Livadaki: [wm('Nisi. - panoramio.jpg')],
    '\u03a0\u03ac\u03c0\u03c0\u03b1': [wm('PappaBeach.JPG')],
    Pappa: [wm('PappaBeach.JPG')],
    '\u039c\u03b9\u03ba\u03c1\u03cc \u03a3\u03b5\u03ca\u03c4\u03ac\u03bd\u03b9': [wm('View from Mikro Seitani Beach in Samos - 2.jpg')],
    'Mikro Seitani': [wm('View from Mikro Seitani Beach in Samos - 2.jpg')],
    '\u03a0\u03c5\u03b8\u03b1\u03b3\u03cc\u03c1\u03b5\u03b9\u03bf': ['https://live.staticflickr.com/814/40985661861_144a018067_b.jpg'],
    Pythagorio: ['https://live.staticflickr.com/814/40985661861_144a018067_b.jpg'],
  },
  lemnos: {
    '\u039a\u03ad\u03c1\u03bf\u03c2': [wm('Keros bay, Lemnos.jpg'), wm('Keros Lemnos.JPG')],
    Keros: [wm('Keros bay, Lemnos.jpg'), wm('Keros Lemnos.JPG')],
  },
  chios: {
    'Καρφάς': [wm('Chios Aug 2023 12 40 16 373000.jpeg')],
    Karfas: [wm('Chios Aug 2023 12 40 16 373000.jpeg')],
    'Μαύρα Βόλια': [wm('Chios Aug 2023 12 33 44 590000.jpeg')],
    'Mavra Volia': [wm('Chios Aug 2023 12 33 44 590000.jpeg')],
    'Bella Vista': [wm('Chios Aug 2023 12 51 07 443000.jpeg')],
  },
  psara: {},
  lesvos: {
    'Παραλία Γυμνιστών Ερεσού': [wm('Skala Eresou beach.jpg')],
    'Παραλία Τάρτι': [wm('Tarti lesvos.jpg')],
  },
  agios_efstratios: {},
};

const MILOS_BEACH_PHOTOS: Record<string, string[]> = {
  'Σαρακίνικο': [
    wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'),
    wm('Aerial view of Sarakiniko Beach on Milos Island, Greece.jpg'),
  ],
  'Σαρακήνικο': [
    wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'),
    wm('Aerial view of Sarakiniko Beach on Milos Island, Greece.jpg'),
  ],
  Sarakiniko: [
    wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'),
    wm('Sarakiniko Beach on the island of Milos, Greece.jpg'),
  ],
  'Φυριπλάκα': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  Firiplaka: [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  Fyriplaka: [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Παπάφραγκας': [wm('From the Hellenistic settlement Fylakopi to Papafragas beach, Milos, 152878.jpg')],
  Papafragas: [wm('From the Hellenistic settlement Fylakopi to Papafragas beach, Milos, 152878.jpg')],
  'Τσιγκράδο': [
    wm('Aerial view of Tsigrado Beach on Milos Island, Greece.jpg'),
    wm('Tsigrado Beach on Milos Island, Greece.jpg'),
  ],
  Tsigrado: [
    wm('Aerial view of Tsigrado Beach on Milos Island, Greece.jpg'),
    wm('Tsigrado Beach on Milos Island, Greece.jpg'),
  ],
  'Αγία Κυριακή': [wm('Milossouth.JPG')],
  'Agia Kyriaki': [wm('Milossouth.JPG')],
  'Agia Kiriaki': [wm('Milossouth.JPG')],
  'Άγιος Σώστης': [wm('Milos Beach - panoramio (1).jpg')],
  'Agios Sostis': [wm('Milos Beach - panoramio (1).jpg')],
  'Άγιος Ιωάννης': [wm('Boat anchored in the Sea of Crete near Kleftiko on Milos Island, Greece.jpg')],
  'Agios Ioannis': [wm('Boat anchored in the Sea of Crete near Kleftiko on Milos Island, Greece.jpg')],
  'Γέροντας': ['https://cdn.pixabay.com/photo/2021/03/25/23/37/gerontas-6124441_1280.jpg'],
  Gerontas: ['https://cdn.pixabay.com/photo/2021/03/25/23/37/gerontas-6124441_1280.jpg'],
  'Γερανιά': [wm('Milos North - panoramio.jpg')],
  Gerania: [wm('Milos North - panoramio.jpg')],
  'Κάπρος': [wm('Volcanic rocks surrounding a small beach on Milos Island, Greece.jpg')],
  Kapros: [wm('Volcanic rocks surrounding a small beach on Milos Island, Greece.jpg')],
  'Αγκάλη': ['https://live.staticflickr.com/5320/7163088150_841b414b19_b.jpg'],
  Agkali: ['https://live.staticflickr.com/5320/7163088150_841b414b19_b.jpg'],
  'Πολλώνια': [wm('Pollonia, Milos, 152933q.jpg')],
  Pollonia: [wm('Pollonia, Milos, 152933q.jpg')],
  'Παλαιοχώρι': [
    wm('Cyclades Milos Paleochori Plage - panoramio.jpg'),
    wm('Milos Paleochori.JPG'),
  ],
  Palaiochori: [
    wm('Cyclades Milos Paleochori Plage - panoramio.jpg'),
    wm('Milos Paleochori.JPG'),
  ],
  Paleochori: [
    wm('Cyclades Milos Paleochori Plage - panoramio.jpg'),
    wm('Milos Paleochori.JPG'),
  ],
  'Προβατάς': [
    wm('Cyclades Milos Provatas Plage - panoramio.jpg'),
    wm('Provatas beach Southwest Milos Greece.jpg'),
  ],
  Provatas: [
    wm('Cyclades Milos Provatas Plage - panoramio.jpg'),
    wm('Provatas beach Southwest Milos Greece.jpg'),
  ],
  'Παπικινού': [wm('Cyclades Milos Papikinou Plage Taverne O^ Hamos - panoramio.jpg')],
  Papikinou: [wm('Cyclades Milos Papikinou Plage Taverne O^ Hamos - panoramio.jpg')],
  'Ναυτικός Όμιλος Μήλου': [wm('Cyclades Milos Papikinou Plage Taverne O^ Hamos - panoramio.jpg')],
  'Nautikos Omilos Milou': [wm('Cyclades Milos Papikinou Plage Taverne O^ Hamos - panoramio.jpg')],
  'Αχιβαδολίμνη': [
    wm('Cyclades Milos Archivadolimni Est Plage - panoramio.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  Achivadolimni: [
    wm('Cyclades Milos Archivadolimni Est Plage - panoramio.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  Archivadolimni: [
    wm('Cyclades Milos Archivadolimni Est Plage - panoramio.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  'Λαγκάδα': [wm('Cyclades Milos Adamantas Langada Plage - panoramio.jpg')],
  Lagada: [wm('Cyclades Milos Adamantas Langada Plage - panoramio.jpg')],
  Langada: [wm('Cyclades Milos Adamantas Langada Plage - panoramio.jpg')],
  'Κλέφτικο': [
    wm('Kleftiko, Milos, 152803.jpg'),
    wm('Sailing yachts near the caves at Kleftiko on Milos Island, Greece.jpg'),
  ],
  Kleftiko: [
    wm('Kleftiko, Milos, 152803.jpg'),
    wm('Sailing yachts near the caves at Kleftiko on Milos Island, Greece.jpg'),
  ],
  'Φυροπόταμος': [wm('Cyclades Milos Firopotamos Plage - panoramio.jpg')],
  Firopotamos: [wm('Cyclades Milos Firopotamos Plage - panoramio.jpg')],
  'Θειάφες': [wm('Thiafes bay, Milos, 152781.jpg')],
  Thiafes: [wm('Thiafes bay, Milos, 152781.jpg')],
  Paliorema: [wm('Thiafes bay, Milos, 152781.jpg')],
  'Παλιόρεμα': [wm('Thiafes bay, Milos, 152781.jpg')],
  'Φυρλίνγκος': [wm('Fyrlinkos beach, Milos, 152795.jpg')],
  Fyrlinkos: [wm('Fyrlinkos beach, Milos, 152795.jpg')],
  'Πλάθιενα': [wm('Milos-2.jpg')],
  Plathiena: [wm('Milos-2.jpg')],
  Platheina: [wm('Milos-2.jpg')],
  'Τουρκοθάλασσα': [wm('Mandrakia Μανδράκια Milos Μήλος 2021-11-12 2402.jpg')],
  Tourkothalassa: [wm('Mandrakia Μανδράκια Milos Μήλος 2021-11-12 2402.jpg')],

  // Remote Milos beaches: exact public-license photos are limited, so these use
  // license-safe images from the same bay/coastline or nearest documented beach.
  'Άγιος Δημήτριος': [wm('- panoramio (5741).jpg'), wm('- panoramio (5740).jpg')],
  'Agios Dimitrios': [wm('- panoramio (5741).jpg'), wm('- panoramio (5740).jpg')],
  'Αμμουδαράκι': [MILOS_UNSPLASH_COVE, wm('Milos-8.jpg'), wm('Beach on south coast of Milos, 15M5993.jpg')],
  Ammoudaraki: [MILOS_UNSPLASH_COVE, wm('Milos-8.jpg'), wm('Beach on south coast of Milos, 15M5993.jpg')],
  'Κάλαμος': [
    wm('Aerial view of the landscape near Paralia Firiplaka on Milos Island, Greece.jpg'),
    wm('Paralia Firiplaka on Milos Island, Greece.jpg'),
    MILOS_PEXELS_GERAKAS,
  ],
  Kalamos: [
    wm('Aerial view of the landscape near Paralia Firiplaka on Milos Island, Greece.jpg'),
    wm('Paralia Firiplaka on Milos Island, Greece.jpg'),
    MILOS_PEXELS_GERAKAS,
  ],
  'Κάτεργο': [
    MILOS_FLICKR_KLEFTIKO,
    wm('Beach on south coast of Milos, 15M5993.jpg'),
    wm('Aerial view of a beach at Kleftiko on Milos Island, Greece.jpg'),
  ],
  Katergo: [
    MILOS_FLICKR_KLEFTIKO,
    wm('Beach on south coast of Milos, 15M5993.jpg'),
    wm('Aerial view of a beach at Kleftiko on Milos Island, Greece.jpg'),
  ],
  'Κήποι': [MILOS_PEXELS_SOUTH_BAY, wm('Milos Beach - panoramio (1).jpg'), wm('Cyclades Milos Provatas Plage - panoramio.jpg')],
  Kipos: [MILOS_PEXELS_SOUTH_BAY, wm('Milos Beach - panoramio (1).jpg'), wm('Cyclades Milos Provatas Plage - panoramio.jpg')],
  'Καμπάνες': [
    wm('Cyclades Milos Firopotamos Plage - panoramio (1).jpg'),
    wm('Cyclades Milos Firopotamos Plage - panoramio.jpg'),
  ],
  Kambanes: [
    wm('Cyclades Milos Firopotamos Plage - panoramio (1).jpg'),
    wm('Cyclades Milos Firopotamos Plage - panoramio.jpg'),
  ],
  'Νεροδάφνη': [
    wm('Cyclades Milos Firopotamos Plage 13092014 - panoramio.jpg'),
    MILOS_UNSPLASH_COVE,
    wm('Milos-2.jpg'),
  ],
  Nerodafni: [
    wm('Cyclades Milos Firopotamos Plage 13092014 - panoramio.jpg'),
    MILOS_UNSPLASH_COVE,
    wm('Milos-2.jpg'),
  ],
  'Παραλία Αγγαθια': [
    MILOS_FLICKR_PIRATES_LAIR,
    wm('Aerial view of a beach at Kleftiko on Milos Island, Greece.jpg'),
    wm('Aerial view of the Sea of Crete at Kleftiko on Milos Island, Greece.jpg'),
  ],
  Agathia: [
    MILOS_FLICKR_PIRATES_LAIR,
    wm('Aerial view of a beach at Kleftiko on Milos Island, Greece.jpg'),
    wm('Aerial view of the Sea of Crete at Kleftiko on Milos Island, Greece.jpg'),
  ],
  'Ριβάρι': [
    MILOS_PEXELS_BOATS_CLIFFS,
    wm('Hiva.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  Rivari: [
    MILOS_PEXELS_BOATS_CLIFFS,
    wm('Hiva.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  'Τριάδες': [
    MILOS_UNSPLASH_COVE,
    wm('Milos-8.jpg'),
    wm('Beach on south coast of Milos, 15M5993.jpg'),
  ],
  Triades: [
    MILOS_UNSPLASH_COVE,
    wm('Milos-8.jpg'),
    wm('Beach on south coast of Milos, 15M5993.jpg'),
  ],
  'Φατούρενα': [
    MILOS_PEXELS_BOATS_CLIFFS,
    wm('Hiva.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  Fatourena: [
    MILOS_PEXELS_BOATS_CLIFFS,
    wm('Hiva.jpg'),
    wm('Cyclades Milos Archivadolimni Ouest Plage - panoramio.jpg'),
  ],
  'Ψαθί': [
    MILOS_FLICKR_KLEFTIKO,
    wm('Beach on south coast of Milos, 15M5993.jpg'),
    wm('Aerial view of a beach at Kleftiko on Milos Island, Greece.jpg'),
  ],
  Psathi: [
    MILOS_FLICKR_KLEFTIKO,
    wm('Beach on south coast of Milos, 15M5993.jpg'),
    wm('Aerial view of a beach at Kleftiko on Milos Island, Greece.jpg'),
  ],
  'Ψαροβολάδα': [
    MILOS_PEXELS_GERAKAS,
    wm('Tourlos Beach on Milos Island, Greece.jpg'),
    wm('Aerial view of Tourlos Beach on Milos Island, Greece.jpg'),
  ],
  Psarovolada: [
    MILOS_PEXELS_GERAKAS,
    wm('Tourlos Beach on Milos Island, Greece.jpg'),
    wm('Aerial view of Tourlos Beach on Milos Island, Greece.jpg'),
  ],
};

const CYCLADES_BEACH_PHOTOS_BY_ISLAND: Record<string, Record<string, string[]>> = {
  milos: MILOS_BEACH_PHOTOS,
  santorini: {
    'Περίσσα': [wm('Beach - Perissa - Santorini - Greece - 04.jpg')],
    'Perissa': [wm('Perissa Beach, Santorini on June 7, 2009.jpg')],
    'Perissa beach': [wm('Perissa Beach, Santorini on June 7, 2009.jpg')],
    'Καμάρι': [wm('Kamari Beach, Santorini, Greece - panoramio (3).jpg')],
    'Kamari': [wm('Boat at Kamari beach, Santorini, Greece.jpg')],
    'Kamari Beach': [wm('Boat at Kamari beach, Santorini, Greece.jpg')],
    'Κόκκινη Παραλία': [wm('Red Beach, Santorini.jpg'), wm('Red Beach in Santorini.jpg')],
    'Red Beach': [wm('Red Beach, Santorini.jpg'), wm('Red Beach, Santorini, 226476.jpg')],
    'Περίβολος': [wm('Perivolos (Santorini).jpg'), wm('Perivolos beach, Santorini (1335681187).jpg')],
    'Perivolos': [wm('Perivolos (Santorini).jpg'), wm('Perivolos beach, Santorini (1335681187).jpg')],
    'Μονόλιθος': [wm('Santorini Beach - panoramio.jpg')],
    'White Beach': [wm('AspriParalia.jpg')],
    'Λευκή Παραλία': [wm('AspriParalia.jpg')],
    'Μπαξές': [wm('Cyclades Santorin Baxedes Plage 15062013 - panoramio.jpg')],
    'Baxes': [wm('Cyclades Santorin Baxedes Plage 15062013 - panoramio.jpg')],
    'Baxedes': [wm('Cyclades Santorin Baxedes Plage 15062013 - panoramio.jpg')],
    'Άγιος Γεώργιος': [wm('Perissa black beach - panoramio.jpg')],
  },
  mykonos: {
    'Σούπερ Παράδεισος': [wm('Super Paradise Beach, Mykonos, Greece.jpg')],
    'Super Paradise': [wm('Super Paradise Beach, Mykonos, Greece.jpg')],
    'Paradise Beach': [wm('Cyclades Mykonos Paradise Plage 23062013 - panoramio.jpg')],
    'Καλαμοπόδι': [wm('Cyclades Mykonos Paradise Plage 23062013 - panoramio.jpg')],
    'Ελιά': [wm('Elias Beach on Mykonos.JPG')],
    'Elia': [wm('Elias Beach on Mykonos.JPG')],
    'Elia Nude Beach': [wm('Elias Beach on Mykonos.JPG')],
    'Πλατύς Γιαλός': [wm('Mykonos Platis Gialos Luftbild 03.jpg')],
    'Όρνος': [wm('GR-mykonos-ornos-beach.jpg')],
    'Ornos': [wm('GR-mykonos-ornos-beach.jpg')],
    'Άγιος Στέφανος': [wm('Agios Stefanos beach Mykonos.jpg')],
    'Φτελιά': [wm('Ftelia Bay, Mykonos, 060363.jpg')],
    'Ψαρρού': [wm('Mykonos Beach Strand (24005199291).jpg')],
    'Άγιος Ιωάννης': [wm('Agios Ioannis, Mykonos, Greece - 1997.jpg')],
    'Πάνορμος': [wm('Mykonos 3160.jpg')],
    'Παράγκα': [wm('III Mykonos, Greece (2).jpg')],
    'Αγία Άννα Παράγκας': [wm('III Mykonos, Greece (2).jpg')],
    'Καλό Λιβάδι': [wm('Kalo Livadi Mykonos.jpeg'), wm('Cyclades Mykonos Kalo Livadi Petite Plage 22062013 - panoramio.jpg')],
    'Kalo Livadi': [wm('Kalo Livadi Mykonos.jpeg')],
    'Καλαφάτη': [wm('Mykonos Kalafati 01.jpg'), wm('Mykonos Kalafati 02.jpg')],
    'Kalafati': [wm('Mykonos Kalafati 01.jpg'), wm('Mykonos Kalafati 02.jpg')],
    'Λιά': [wm('Mykonos Lia 01.jpg'), wm('Mykonos Lia 02.jpg')],
    'Lia': [wm('Mykonos Lia 01.jpg'), wm('Mykonos Lia 02.jpg')],
    'Αγράρι': [wm('Agrari beach in April - panoramio.jpg')],
    'Agrari': [wm('Agrari beach in April - panoramio.jpg')],
    'Άγιος Σώστης': [wm('Mykonos Agios Sostis 01.jpg')],
    'Agios Sostis': [wm('Mykonos Agios Sostis 01.jpg')],
    'Κάπαρη': [wm('Beach near Kapari, Mykonos, 224479.jpg'), wm('Beach near Kapari, Mykonos, 224480.jpg')],
    'Kapari': [wm('Beach near Kapari, Mykonos, 224479.jpg')],
    'Ταρσανάς': [wm('Mykonos Akrotiri Tarsanas 03.jpg'), wm('Mykonos Akrotiri Tarsanas 02.jpg')],
    'Tarsanas': [wm('Mykonos Akrotiri Tarsanas 03.jpg')],
  },
  paros: {
    'Κολυμπήθρες': [wm('Paros Kolymbithres1 tango7174.jpg')],
    'Kolymbithres': [wm('Paros Kolymbithres1 tango7174.jpg')],
    'Χρυσή Ακτή': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
    'Golden Beach': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
    'Παραλία Αγκάλη Χρυσής Ακτής': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
    'Πιπέρι': [wm('GR-paros-naoussa-piperi-strand.jpg')],
    'Φάραγγας': [wm('Cyclades Paros Faragas Beach - panoramio.jpg')],
    'Μώλος': [wm('Cyclades Paros Molos Beach Vue Naxos - panoramio.jpg')],
    'Σάντα Μαρία': [wm('Paros Beach.jpg')],
    'Μικρή Σάντα Μαρία': [wm('Paros Beach.jpg')],
    'Λογαράς': [wm('GR-paros-piso-livada-beach.jpg')],
    'Παραλία Αλυκή': [wm('Paros Alyki2 tango7174.jpg')],
    'Αγία Ειρήνη': [wm('Paros Agia Irini 01.jpg'), wm('Paros Agia Irini 02.jpg')],
    'Agia Irini': [wm('Paros Agia Irini 01.jpg'), wm('Paros Agia Irini 02.jpg')],
    'Βουτάκος': [wm('Cyclades Paros Voutakos Beach - panoramio.jpg'), wm('Cyclades Paros Voutakos Beach - panoramio (1).jpg')],
    'Voutakos': [wm('Cyclades Paros Voutakos Beach - panoramio.jpg')],
    'Λάγγερη': [wm('Cyclades Paros Lageri Plage 04092014 - panoramio.jpg'), wm('Cyclades Paros Lageri Plage 04092014 - panoramio (1).jpg')],
    'Langeri': [wm('Cyclades Paros Lageri Plage 04092014 - panoramio.jpg')],
    'Παραλία Γλυφά': [wm('Paros Glyfa 01.jpg'), wm('Paros Glyfa 02.jpg')],
    'Paralia Glyfa': [wm('Paros Glyfa 01.jpg')],
    'Τσουκαλιά': [wm('Paros - panoramio - brunobarbato (10).jpg')],
    'Γλυφάδες': [wm('Paros - panoramio - brunobarbato (7).jpg')],
    'Δρυός': [wm('Dryos, Paros, Cyclades, 17M3866.jpg')],
    'Dryos': [wm('Dryos, Paros, Cyclades, 17M3866.jpg')],
    'Μοναστήρι': [wm('Cyclades Paros Agios Ioanis Plage 04092014 - panoramio.jpg')],
  },
  naxos: {
    'Αγία Άννα': [wm('Beach Agia Anna, Naxos, 060762.jpg')],
    'Agia Anna': [wm('Beach Agia Anna, Naxos, 060762.jpg')],
    'Άγιος Προκόπιος': [wm('Agios Prokopios beach, Naxos, Greece.jpg'), wm('Agios Prokopios Beach at sunset, Naxos, Greece julesvernex2.jpg')],
    'Agios Prokopios': [wm('Agios Prokopios beach, Naxos, Greece.jpg'), wm('Agios Prokopios Beach at sunset, Naxos, Greece julesvernex2.jpg')],
    'Πλάκα': [wm('Sunset from Plaka beach, Naxos island, Greece - panoramio.jpg')],
    'Plaka': [wm('Sunset from Plaka beach, Naxos island, Greece - panoramio.jpg')],
    'Μικρή Βίγλα': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 01.jpg'), wm('Vigla Beach, Naxos isl.jpg')],
    'Mikri Vigla': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 01.jpg')],
    'Άγιος Γεώργιος': [wm('City beach Agios Georgios, Naxos, 11H2322.jpg')],
    'Ψιλή Άμμος': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 06.jpg')],
    'Παραλία Ψιλή Άμμος': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 06.jpg')],
    'Αλυκό': [wm('Cyclades Naxos Alyko Plage 18062015 - panoramio.jpg'), wm('Strand beach Aliko Naxos (23719975009).jpg')],
    'Alyko': [wm('Cyclades Naxos Alyko Plage 18062015 - panoramio.jpg')],
    'Καστράκι': [wm('Kastraki Naxos Greece 2018080417430NX3050.jpg'), wm('Kastraki Naxos Greece 2018080417530NP3092.jpg')],
    'Kastraki': [wm('Kastraki Naxos Greece 2018080417430NX3050.jpg')],
    'Γλυφάδα': [wm('Glyfada Naxos Greece DSCN1070.jpg'), wm('Glyfada Naxos Greece 2003082316260N01711.jpg')],
    'Glyfada': [wm('Glyfada Naxos Greece DSCN1070.jpg')],
    'Απόλλωνας': [wm('Naxos Apollonas2 tango7174.jpg')],
    'Apollonas': [wm('Naxos Apollonas2 tango7174.jpg')],
    'Αγιασσός': [wm('Agiassos.jpg')],
    'Agiassos': [wm('Agiassos.jpg')],
    'Αζαλάς': [wm('Azalas - panoramio.jpg'), wm('Azalas - panoramio (2).jpg')],
    'Azalas': [wm('Azalas - panoramio.jpg')],
    'Μουτσούνα': [wm('Moutsouna.jpg'), wm('Strand von Moutsouna Naxos.jpg')],
    'Moutsouna': [wm('Moutsouna.jpg')],
    'Λίωνας': [wm('Ducks at Lyonas beach, Naxos island, Greece.jpg')],
    'Lionas': [wm('Ducks at Lyonas beach, Naxos island, Greece.jpg')],
    'Πυργάκι': [wm('Naxos - Pirgaki - Sand Beach - panoramio.jpg')],
    'Pyrgaki': [wm('Naxos - Pirgaki - Sand Beach - panoramio.jpg')],
    'Παραλία Σπεδό': [wm('Spedos Naxos Greece 2011082815261NP6193.jpg')],
    'Paralia Spedo': [wm('Spedos Naxos Greece 2011082815261NP6193.jpg')],
    'Hawaii': [wm('Hawaii Beach on Naxos Island, Greece.jpg')],
    'Άγιοι Θεόδωροι': [wm('Agii Theodori beach islet.jpg')],
    'Agii Theodori': [wm('Agii Theodori beach islet.jpg')],
    'Μικρό Αλυκό': [wm('Cyclades Naxos Kouroupia Plage 18062013 - panoramio.jpg')],
    'Mikro Alyko': [wm('Cyclades Naxos Kouroupia Plage 18062013 - panoramio.jpg')],
    'Παραλία Καλαντός': [wm('Sheep and goats at Kalandos Naxos Greece DSCN1186.jpg')],
    'Κέδρος': [wm('Strand beach Aliko Naxos (23979680432).jpg')],
    'Πάνορμος': [wm('Πάνερμος.jpg')],
  },
  ios: {
    'Μυλοπότας': [wm('Mylopotas beach 3.jpg'), wm('Mylopotas beach 5.jpg')],
    'Mylopotas': [wm('Mylopotas beach 3.jpg'), wm('Mylopotas beach 5.jpg')],
    'Μαγγανάρι': [wm('Manganari11.jpg'), wm('Manganari2.jpg')],
    'Manganari': [wm('Manganari11.jpg'), wm('Manganari2.jpg')],
  },
  folegandros: {
    'Λιβαδάκι': [wm('Paralia Livadaki Beach, Folegandros, Greece.jpg')],
    'Αγκάλη': [wm('Angali beach, Folegandros, 15M6560.jpg')],
    'Κάτεργο': [wm('Cyclades Folegandros Katergo Plage - panoramio.jpg')],
    'Λιβάδι': [wm('Livadi Beach near camping, Folegandros, 153365.jpg')],
    'Άγιος Νικόλαος': [wm('St Nicolaos beach, Folegandros.jpeg')],
    'Αμπέλι': [wm('Cyclades Folegandros Ambeli Plage - panoramio (1).jpg')],
    'Άγιος Γεώργιος': [wm('Cyclades Folegandros Agios Georghios Plage 12092014 - panoramio (1).jpg')],
    'Βάρδια': [wm('Cyclades Folegandros Karavostasis Vardhia Plage - panoramio (2).jpg')],
    'Γάλιφος': [wm('Cyclades Folegandros Angali Ghalifos Plage 11092014 - panoramio.jpg')],
    'Λυγαριά': [wm('Cyclades Folegandros Lygharia Plage - panoramio.jpg')],
  },
  tinos: {
    'Κολυμπήθρα': [wm('Agios Romanos beach, Tinos, Greece julesvernex2.jpg')],
    'Μικρή Κολυμπήθρα': [wm('Agios Romanos beach, Tinos, Greece julesvernex2.jpg')],
    'Άγιος Ρωμανός': [wm('Agios Romanos beach, Tinos, Greece julesvernex2.jpg')],
    'Άγιος Σώστης': [wm('Top-down view of skerry near the beach, Agios Sostis, Tinos, Greece julesvernex2.jpg')],
    'Άγιος Φωκάς': [wm('Wave, Agios Fokas beach, Tinos, Greece julesvernex2.jpg')],
    'Αγιος Φωκάς': [wm('Wave, Agios Fokas beach, Tinos, Greece julesvernex2.jpg')],
    'Όρμος Υστερνίων': [wm('Shallow waters, Isternion Beach, Tinos, Greece julesvernex2.jpg')],
    'Παχιά άμμος': [wm('Beach bar with lifeguard tower in the background, Megali Ammos Beach, Tinos, Greece julesvernex2.jpg')],
    'Άγιος Ιωάννης Πόρτο': [wm('Yellow buoys, Agios Ioannis Beach, Tinos, Greece julesvernex2.jpg')],
    'Κιόνια': [wm('Cyclades Tinos Kionia Plage - panoramio.jpg')],
    'Kionia': [wm('Cyclades Tinos Kionia Plage - panoramio.jpg')],
    'Βαθύ Πανόρμου': [wm('Cyclades Tinos Panormos Plage 21062013 - panoramio.jpg')],
  },
  andros: {
    'Βιτάλι': [wm('Vitali Bay1.jpg'), wm('Vitali Bay3.jpg')],
    'Kampos Beach Bar Vitali': [wm('Vitali Bay1.jpg'), wm('Vitali Bay3.jpg')],
    'Της γριας το πήδημα': [wm('Pidima Grias Beach - panoramio.jpg'), wm('Παραλία της γριάς το πήδημα, Άνδρος.jpg')],
    'Κυπρί': [wm('Παραλία κυπρί 2019.jpg')],
    'Μπατσί': [wm('View of Batsi - Andros, Greece - panoramio.jpg')],
    'Παραπόρτι': [wm('Παραλία Παραπόρτι.jpg')],
    'Paraporti': [wm('Παραλία Παραπόρτι.jpg')],
  },
  amorgos: {
    'Αγία Άννα': [wm('Amorgos plage d aghia anna IMG 2757.JPG')],
    'Αγία Άννα Αμοργός': [wm('Amorgos plage d aghia anna IMG 2757.JPG')],
    'Καλοταρίτισσα': [wm('The natural bay where Kalotaritissa beach is located.jpg')],
    'Καλοκαταρίτισσα': [wm('The natural bay where Kalotaritissa beach is located.jpg')],
    'Νικουριά': [wm('Panagia beach in Nikouria island, 18M2105.jpg'), wm('Great beach on the Nikouria island, 18M2127.jpg')],
    'Μαλτέζι': [wm('Maltezi beach, near Katapola, Amorgos, 18M2408.jpg')],
    'Φοινικιές': [wm('Finikies Bay in Amorgos, 180322.jpg')],
    Finikies: [wm('Finikies Bay in Amorgos, 180322.jpg')],
    'Χόχλακας': [wm('Παραλία Χοχλακάς.jpg')],
    Chochlakas: [wm('Παραλία Χοχλακάς.jpg')],
  },
  serifos: {
    'Λιβαδάκια': [wm('A@a livadakia beach serifos greece - panoramio.jpg'), wm('Livadakia Beach Serifos (209164677).jpeg')],
    'Γάνεμα': [wm('A@a Ganema beach 1 Serifos Greece - panoramio.jpg'), wm('Ganema serifos.jpg')],
    'Κουτάλας': [wm('Plage Koutalas (Kókkino Chorió) - en soirée.jpg')],
    'Άη Γιάννης': [wm('Παραλια πλακα, Αη Γιαννης.jpg')],
    'Καλό Αμπέλι': [wm('Kalo Ampeli beach, Serifos island, Greece - panoramio.jpg')],
    'Αυλόμωνας': [wm('A@a avlomonas beach serifos greece - panoramio.jpg')],
    'Μέγα Λιβάδι': [wm('A@a Mega Livadi 1 Serifos Greece - panoramio.jpg')],
    'Ψιλή Άμμος': [wm('Ψιλή Άμμος, Σέριφος 1967.jpg')],
  },
  sifnos: {
    'Βαθύ': [wm('Beach in Vathy on Sifnos, 153617.jpg'), wm('Beach in Vathy on Sifnos, 153621.jpg')],
    'Βαθή': [wm('Beach in Vathy on Sifnos, 153617.jpg'), wm('Beach in Vathy on Sifnos, 153621.jpg')],
    'Φάρος': [wm('Faros Sifnos Cyclades.jpg')],
    'Καμάρες': [wm('Kamares from Ag. Marina, Sifnos, 15M6920.jpg')],
    'Πλατύς Γιαλός Σίφνος': [wm('Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg')],
    'Πλατύς Γιαλός': [wm('Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg')],
    'Platis Gialos': [wm('Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg')],
    'Φασολού': [wm('Cyclades Sifnos Fasolou Plage - panoramio.jpg'), wm('Cyclades Sifnos Fasolou Plage - panoramio (1).jpg')],
    'Fasolou': [wm('Cyclades Sifnos Fasolou Plage - panoramio.jpg')],
    'Αποκοφτό': ['https://live.staticflickr.com/265/19659660514_bf3327d9a6_b.jpg'],
    'Παραλία Φικιάδα': [wm('Fikiada,sifnos.jpg')],
  },
  syros: {
    'Μέγας Γυαλός': [wm('Megas Gyalos Syros 1.jpg'), wm('Megas Gyalos Syros 2.jpg')],
    'Αγαθοπές': [wm('Agathopes beach Syros 1.jpg'), wm('Agathopes beach Syros 2.jpg')],
    'Αγκαθωπές': [wm('Agathopes beach Syros 1.jpg'), wm('Agathopes beach Syros 2.jpg')],
    'Γαλησσάς': [wm('View of Galisas beach in Syros.jpg')],
    'Παραλία Γαλησσά': [wm('View of Galisas beach in Syros.jpg')],
    'Δελφίνι': [wm('Delfini beach Syros 1.jpg'), wm('Delfini beach Syros 3.jpg')],
    'Φοίνικας': [wm('Foinikas beach Syros 4.jpg')],
    'Παραλία Βάρη': [wm('Vari Syros.jpg')],
    'Παραλία Κόμητο': [wm('Komito beach Syros.jpg')],
    'Βαρβαρούσα': [wm('Varvaroussa.jpg'), wm('Varvaroussa2.jpg')],
    'Παραλία Λωτό': [wm('The small beach of Lottos, Syros, Greece - panoramio.jpg')],
    'Κίνι': [wm('Kini Syros 3.jpg')],
    'Μέγας Γιαλός': [wm('Megas Gyalos Syros 1.jpg')],
  },
  kea: {
    'Κούνδουρος': [wm('Kea (Tzia) beach.jpg')],
    'Σπαθί': [wm('Σπαθί παραλία.jpg')],
  },
  anafi: {
    'Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
    'Έξω Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
    'Μικρός Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
    'Κλεισίδι': [wm('Roukounas beach and Kalamos.jpg')],
    'Καταλιμάτσα': [wm('From the ancient port to Kalami, Anafi, 226090.jpg')],
    'Πρασιές': [wm('Anafi 3.jpg')],
  },
  kythnos: {
    'Παραλία Κολώνα': [wm('Kolona beach, Kythnos 2018 n2.jpg'), wm('Kythnos kolona beach.jpg')],
    'Κολώνα': [wm('Kolona beach, Kythnos 2018 n2.jpg'), wm('Kythnos kolona beach.jpg')],
    'Απόκρουσης': [wm('Apokrousi beach, Kythnos, 190228.jpg')],
    'Άγιος Σώστης': [wm('Αγιος Σώστης Κύθνος.jpg')],
    'Φλαμπούρια': [wm('ΦΛΑΜΠΟΥΡΙΑ.jpg')],
    'Γαϊδουρόμαντρα': [wm('ΓΑΙΔΟΥΡΟΜΑΝΤΡΑ Kythnos.jpg')],
  },
  kimolos: {
    'Κλήμα': ['https://live.staticflickr.com/6124/5945735083_cabfa59f5f_b.jpg'],
    'Ψάθη': ['https://live.staticflickr.com/3542/3821948623_81aeddacee_b.jpg'],
    'Ελληνικά': ['https://live.staticflickr.com/2010/2500522340_9589d6bf71.jpg'],
    'Πράσα': [wm('Kimolos Prasa beach.jpg'), wm('Prasa beach.jpg')],
    'Πράσα Άγιος Γεώργιος': [wm('Kimolos Prasa beach.jpg'), wm('Prasa beach.jpg')],
  },
  sikinos: {
    'Άγιος Γεώργιος': [wm('Alopronia, Sikinos, 247873.jpg')],
    'Άγιος Παντελεήμονας': [wm('Alopronia, Sikinos, 247874.jpg')],
    'Σαντορινέικα': [wm('Alopronia, Sikinos, 247875.jpg')],
  },
  antiparos: {
    'Σωρό': [wm('Antiparos Beach.jpg')],
    'Soros': [wm('Antiparos Beach.jpg')],
    'Faneromeni beach': [wm('Faneromeni aug11.jpg')],
  },
  koufonisia: {
    'Λίμνη Πάνω Κουφονησίου': [wm('Koufonisi 2023 12.jpg')],
    'Πισίνα': [wm('Koufonisi 2023 59.jpg')],
    'Παναγία': ['https://live.staticflickr.com/3598/3530798613_7b632def10_b.jpg'],
    'Φοίνικας': [wm('Koufonisia, Greece - panoramio.jpg')],
  },
  donousa: {},
  schinoussa: {
    'Λιόλιου': [wm('ΠΑΡΑΛΙΑ ΛΙΟΛΙΟΥ.jpg')],
  },
  iraklia: {},
};

// Ionian per-island verified beach photos. Keyed by the value returned from
// IONIAN_ISLAND_ALIASES (capitalised, e.g. 'Corfu'). Only beach-location-verified,
// free-licensed images. Same contract as CYCLADES_BEACH_PHOTOS_BY_ISLAND.
const IONIAN_BEACH_PHOTOS_BY_ISLAND: Record<string, Record<string, string[]>> = {
  Corfu: {
    'Παλαιοκαστρίτσα': [wm('Corfu Paleokastritsa Beach R01.jpg')],
    'Palaiokastritsa': [wm('Corfu Paleokastritsa Beach R01.jpg')],
    'Πόρτο Τιμόνι': [wm('Porto Timoni Beach.jpg')],
    'Porto Timoni': [wm('Porto Timoni Beach.jpg')],
    'Κοντογιαλός': [wm('Kontogialos (Corfu).png')],
    'Kontogialos': [wm('Kontogialos (Corfu).png')],
    'Παραλία Μπαρμπάτι': [wm('Παραλία Μπαρμπάτι - panoramio.jpg')],
    'Παραλία Γλυφάδας': [wm('Glyfada Beach on the island of Corfu, Greece (47818444242).jpg')],
    'Dassia Beach': [wm('Dassia Kerkyra.jpg')],
    'Issos Beach': ['https://live.staticflickr.com/8327/8110513406_c1fb914067_b.jpg', 'https://live.staticflickr.com/8047/8110514125_7f8a7cd6cc_b.jpg'],
    'Kanoni Beach': ['https://live.staticflickr.com/8780/16675698194_5973286b14_b.jpg'],
    'Κανόνι': ['https://live.staticflickr.com/8780/16675698194_5973286b14_b.jpg'],
    'Benitses beach': [wm('Beach on Mpenitses, Corfu, Greece.jpg')],
    'Karavi Beach': ['https://live.staticflickr.com/4088/4841071638_254a4ec23b_b.jpg'],
    'Παραλία Χωμοί': [wm('Unnamed Road, Kerkira 490 83, Greece - panoramio (5).jpg')],
  },
  Kefalonia: {
    'Μύρτος': [wm('Myrtos Beach, Kefalonia.jpg')],
    'Myrtos': [wm('Myrtos Beach, Kefalonia.jpg')],
    'Αντίσαμος': [wm('Antisamos Beach, Kefalonia - panoramio.jpg')],
    'Antisamos': [wm('Antisamos Beach, Kefalonia - panoramio.jpg')],
    'Πετανι': [wm('Petani Beach, Kefalonia.jpg')],
    'Petani': [wm('Petani Beach, Kefalonia.jpg')],
    'Σπαρτιάς': ['https://live.staticflickr.com/8299/7974152704_6f7979e533_b.jpg'],
    'Spartias': ['https://live.staticflickr.com/8299/7974152704_6f7979e533_b.jpg'],
    'Φωκι': [wm('Foki Beach - panoramio.jpg')],
    'Foki': [wm('Foki Beach - panoramio.jpg')],
    'Πλατιά Άμμος': ['https://live.staticflickr.com/2652/3860435230_6c7c2be521_b.jpg'],
    'Platia Ammos': ['https://live.staticflickr.com/2652/3860435230_6c7c2be521_b.jpg'],
    'Έμπλυση': [wm('Erisos, Greece - panoramio.jpg')],
    'Emplysi': [wm('Erisos, Greece - panoramio.jpg')],
  },
  Zakynthos: {
    'Ναυάγιο': [wm('Navagio beach Zakynthos.jpg')],
    'Navagio': [wm('Navagio beach Zakynthos.jpg')],
    'Μπανάνα': [wm('1 banana beach july 23 (1).jpg')],
    'Banana': [wm('1 banana beach july 23 (1).jpg')],
    'Δάφνη': [wm('Dafni Beach - panoramio.jpg')],
    'Dafni': [wm('Dafni Beach - panoramio.jpg')],
    'Παραλία Γέρακας': [wm('1 gerakas beach on july 2023 (1).jpg')],
    'Paralia Gerakas': [wm('1 gerakas beach on july 2023 (1).jpg')],
    'Πόρτο Ζόρο': ['https://live.staticflickr.com/1284/4693782786_e418c20963_b.jpg'],
    'Porto Zoro': ['https://live.staticflickr.com/1284/4693782786_e418c20963_b.jpg'],
    'Πόρτο Λιμνιώνας': [wm('Porto Limnionas beach Zakynthos, Greece (46474702631).jpg')],
    'Porto Limnionas': [wm('Porto Limnionas beach Zakynthos, Greece (46474702631).jpg')],
    'Κρεμμύδι': [wm('Elation 290 91, Greece - panoramio (51).jpg')],
    'Kremmydi': [wm('Elation 290 91, Greece - panoramio (51).jpg')],
    'Μικρή Ξύγκια': [wm('Zakynthos May 2009 Beach near Xigia 2 - panoramio.jpg')],
    'Ξύγκια': [wm('Zakynthos May 2009 Beach near Xigia 2 - panoramio.jpg')],
    'Καλαμάκι': ['https://live.staticflickr.com/2791/4300870422_5113ab416f_b.jpg'],
    'Kalamaki': ['https://live.staticflickr.com/2791/4300870422_5113ab416f_b.jpg'],
  },
  Lefkada: {
    'Πόρτο Κάτσικι': [wm('Porto Katsiki SF 0001.jpg')],
    'Porto Katsiki': [wm('Porto Katsiki SF 0001.jpg')],
    'Μικρός Γιαλός': [wm('Ellomeno, Greece - panoramio (1).jpg')],
    'Mikros Gialos': [wm('Ellomeno, Greece - panoramio (1).jpg')],
    'Κρυονέρι': [wm('Krioneri Beach.jpg')],
    'Kryoneri': [wm('Krioneri Beach.jpg')],
    'Πευκούλια': [wm('Lefkas12.JPG')],
    'Pevkoulia': [wm('Lefkas12.JPG')],
    'Κάθισμα': [wm('30.Plaja Kathisma - panoramio.jpg')],
    'Kathisma': [wm('30.Plaja Kathisma - panoramio.jpg')],
    'Εγκρεμνοί': [wm('Apollonii, Greece - panoramio (13).jpg')],
    'Egkremni': [wm('Apollonii, Greece - panoramio (13).jpg')],
    'Αγιοφύλλι': [wm('Agiofili Beach (25419587704).jpg')],
    'Agiofylli': [wm('Agiofili Beach (25419587704).jpg')],
    'Μύλος': [wm('1 a rock in agio nikitas on summer 2024 g.jpg')],
    'Mylos': [wm('1 a rock in agio nikitas on summer 2024 g.jpg')],
  },
  Paxos: {},
  Antipaxos: {},
  Ithaca: {},
  Meganisi: {},
  Othonoi: {},
  Erikoussa: {},
  Mathraki: {},
};

const normalizeLookup = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9α-ω]+/gi, '');

const UNVERIFIED_BEACH_PHOTO_KEYS = new Set([
  'agiosdimitrios',
  'ammoudaraki',
  'kalamos',
  'katergo',
  'kipos',
  'kambanes',
  'nerodafni',
  'agathia',
  'rivari',
  'triades',
  'fatourena',
  'psathi',
  'psarovolada',
  'tourkothalassa',
  'agiosioannis',
  'agiossostis',
  'plathiena',
  'platheina',
]);

const VERIFIED_MILOS_BEACH_PHOTO_KEYS = new Set([
  'sarakiniko',
  'firiplaka',
  'fyriplaka',
  'papafragas',
  'tsigrado',
  'agiakyriaki',
  'agiakiriaki',
  'gerontas',
  'palaiochori',
  'paleochori',
  'paliochori',
  'provatas',
  'papikinou',
  'achivadolimni',
  'archivadolimni',
  'lagada',
  'langada',
  'kleftiko',
  'firopotamos',
  'thiafes',
  'paliorema',
  'fyrlinkos',
  'agkali',
  'pollonia',
  'kapros',
  'gerania',
]);

const CYCLADES_ISLAND_ALIASES: Record<string, string> = {
  milos: 'milos',
  μηλος: 'milos',
  santorini: 'santorini',
  σαντορινη: 'santorini',
  thira: 'santorini',
  mykonos: 'mykonos',
  μυκονος: 'mykonos',
  paros: 'paros',
  παρος: 'paros',
  naxos: 'naxos',
  ναξος: 'naxos',
  ios: 'ios',
  ιος: 'ios',
  folegandros: 'folegandros',
  φολεγανδρος: 'folegandros',
  tinos: 'tinos',
  τηνος: 'tinos',
  andros: 'andros',
  ανδρος: 'andros',
  amorgos: 'amorgos',
  αμοργος: 'amorgos',
  serifos: 'serifos',
  σεριφος: 'serifos',
  sifnos: 'sifnos',
  σιφνος: 'sifnos',
  syros: 'syros',
  συρος: 'syros',
  kea: 'kea',
  κεα: 'kea',
  tzia: 'kea',
  αναφη: 'anafi',
  anafi: 'anafi',
  kythnos: 'kythnos',
  κυθνος: 'kythnos',
  kimolos: 'kimolos',
  κιμωλος: 'kimolos',
  sikinos: 'sikinos',
  σικινος: 'sikinos',
  antiparos: 'antiparos',
  αντιπαρος: 'antiparos',
  donousa: 'donousa',
  donoussa: 'donousa',
  δονουσα: 'donousa',
  koufonisia: 'koufonisia',
  koufonisi: 'koufonisia',
  koufonissia: 'koufonisia',
  κουφονησια: 'koufonisia',
  schinoussa: 'schinoussa',
  schoinoussa: 'schinoussa',
  schoinousa: 'schinoussa',
  σχοινουσα: 'schinoussa',
  iraklia: 'iraklia',
  irakleia: 'iraklia',
  heraklia: 'iraklia',
  ηρακλεια: 'iraklia',
};

const ATTICA_AREA_ALIASES: Record<string, string> = {
  athenscoast: 'athens_coast',
  περιοχηαθηνων: 'athens_coast',
  παραλιααθηνας: 'athens_coast',
  αθηναικηριβιερα: 'athens_coast',
  athensarea: 'athens_coast',
  centralathens: 'athens_coast',
  piraeuscoast: 'piraeus_coast',
  περιοχηπειραια: 'piraeus_coast',
  ακτεςπειραια: 'piraeus_coast',
  piraeusarea: 'piraeus_coast',
  eastattica: 'east_attica',
  ανατολικηαττικη: 'east_attica',
  westattica: 'west_attica',
  δυτικηαττικη: 'west_attica',
  aegina: 'aegina',
  αιγινα: 'aegina',
  agistri: 'agistri',
  αγκιστρι: 'agistri',
  hydra: 'hydra',
  υδρα: 'hydra',
  kythira: 'kythira',
  κυθηρα: 'kythira',
  poros: 'poros',
  πορος: 'poros',
  salamina: 'salamina',
  σαλαμινα: 'salamina',
  spetses: 'spetses',
  σπετσες: 'spetses',
};

const MACEDONIA_AREA_ALIASES: Record<string, string> = {
  halkidiki: 'halkidiki',
  chalkidiki: 'halkidiki',
  χαλκιδικη: 'halkidiki',
  kilkis: 'kilkis',
  κιλκις: 'kilkis',
  pieria: 'pieria',
  πιερια: 'pieria',
  thessaloniki: 'thessaloniki',
  θεσσαλονικη: 'thessaloniki',
  kavala: 'kavala',
  καβαλα: 'kavala',
  thasos: 'thasos',
  thassos: 'thasos',
  θασος: 'thasos',
  kastoria: 'kastoria',
  καστορια: 'kastoria',
};

const CRETE_AREA_ALIASES: Record<string, string> = {
  chania: 'chania',
  cretechania: 'chania',
  heraklion: 'heraklion',
  iraklio: 'heraklion',
  creteheraklion: 'heraklion',
  rethymno: 'rethymno',
  rethimno: 'rethymno',
  creterethymno: 'rethymno',
  lasithi: 'lasithi',
  lassithi: 'lasithi',
  cretelasithi: 'lasithi',
};

const THRACE_AREA_ALIASES: Record<string, string> = {
  evros: 'evros',
  εβρος: 'evros',
  rodopi: 'rodopi',
  ροδοπη: 'rodopi',
  xanthi: 'xanthi',
  ξανθη: 'xanthi',
  samothraki: 'samothraki',
  samothrace: 'samothraki',
  σαμοθρακη: 'samothraki',
};

const NORTH_AEGEAN_AREA_ALIASES: Record<string, string> = {
  chios: 'chios',
  χιος: 'chios',
  psara: 'psara',
  ψαρα: 'psara',
  ikaria: 'ikaria',
  ικαρια: 'ikaria',
  lesvos: 'lesvos',
  lesbos: 'lesvos',
  λεσβος: 'lesvos',
  lemnos: 'lemnos',
  limnos: 'lemnos',
  λημνος: 'lemnos',
  samos: 'samos',
  σαμος: 'samos',
  agiosefstratios: 'agios_efstratios',
  agioseustratios: 'agios_efstratios',
};

const IONIAN_ISLAND_ALIASES: Record<string, string> = {
  corfu: 'Corfu',
  kerkyra: 'Corfu',
  κερκυρα: 'Corfu',
  paxos: 'Paxos',
  παξοι: 'Paxos',
  antipaxos: 'Antipaxos',
  αντιπαξοι: 'Antipaxos',
  lefkada: 'Lefkada',
  lefkas: 'Lefkada',
  leucas: 'Lefkada',
  λευκαδα: 'Lefkada',
  kefalonia: 'Kefalonia',
  cephalonia: 'Kefalonia',
  κεφαλονια: 'Kefalonia',
  ithaca: 'Ithaca',
  ithaki: 'Ithaca',
  ιθακη: 'Ithaca',
  zakynthos: 'Zakynthos',
  zante: 'Zakynthos',
  ζακυνθος: 'Zakynthos',
  meganisi: 'Meganisi',
  μεγανησι: 'Meganisi',
  othonoi: 'Othonoi',
  οθωνοι: 'Othonoi',
  erikoussa: 'Erikoussa',
  ερεικουσσα: 'Erikoussa',
  mathraki: 'Mathraki',
  μαθρακι: 'Mathraki',
};

// Resolve an area/island display name to its photo-map key.
//
// Tries an exact (normalized) alias match first, then a guarded prefix match.
// A naive two-way `includes` lets a short name collide with an unrelated alias
// that merely contains it as an internal substring (e.g. "Ios" matching the
// "chios" alias, suppressing every Ios beach). normalizeLookup strips all
// separators, so legitimate fuzzy hits are always a PREFIX: a display name like
// "East Attica (mainland)" -> "eastatticamainland" should still match the
// "eastattica" alias. We therefore only accept a fuzzy hit when one string is a
// prefix of the other, and only for tokens long enough to be unambiguous.
const MIN_FUZZY_ALIAS_LEN = 5;

const isPrefixMatch = (a: string, b: string): boolean => {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length < MIN_FUZZY_ALIAS_LEN) return false;
  return longer.startsWith(shorter);
};

const resolveAliasKey = (
  rawName: string | undefined,
  aliases: Record<string, string>,
): string | null => {
  if (!rawName) return null;

  const normalized = normalizeLookup(rawName);
  if (aliases[normalized]) {
    return aliases[normalized];
  }

  for (const [alias, key] of Object.entries(aliases)) {
    if (isPrefixMatch(normalized, alias)) {
      return key;
    }
  }

  return null;
};

const getAtticaAreaKey = (areaName: string | undefined): string | null =>
  resolveAliasKey(areaName, ATTICA_AREA_ALIASES);

const getMacedoniaAreaKey = (areaName: string | undefined): string | null =>
  resolveAliasKey(areaName, MACEDONIA_AREA_ALIASES);

const getCreteAreaKey = (areaName: string | undefined): string | null =>
  resolveAliasKey(areaName, CRETE_AREA_ALIASES);

const getThraceAreaKey = (areaName: string | undefined): string | null =>
  resolveAliasKey(areaName, THRACE_AREA_ALIASES);

const getNorthAegeanAreaKey = (areaName: string | undefined): string | null =>
  resolveAliasKey(areaName, NORTH_AEGEAN_AREA_ALIASES);

const getIonianIslandKey = (islandName: string | undefined): string | null =>
  resolveAliasKey(islandName, IONIAN_ISLAND_ALIASES);

const getCycladesIslandKey = (islandName: string | undefined): string | null =>
  resolveAliasKey(islandName, CYCLADES_ISLAND_ALIASES);

const findPhotos = (
  photosByName: Record<string, string[]>,
  beachNameGr: string,
  beachNameEn: string,
  count: number,
  strictAllowedKeys?: Set<string>,
  // Names to exclude as unverified. Scoped per call so a name blocked on one
  // island (e.g. Milos "Agios Sostis") does not suppress a verified
  // same-named beach on another island (e.g. Mykonos "Agios Sostis").
  blockedKeys?: Set<string>
): string[] => {
  const normalizedBeachNameGr = normalizeLookup(beachNameGr);
  const normalizedBeachNameEn = normalizeLookup(beachNameEn);

  if (
    strictAllowedKeys &&
    !strictAllowedKeys.has(normalizedBeachNameGr) &&
    !strictAllowedKeys.has(normalizedBeachNameEn)
  ) {
    return [];
  }

  if (
    blockedKeys &&
    (blockedKeys.has(normalizedBeachNameGr) || blockedKeys.has(normalizedBeachNameEn))
  ) {
    return [];
  }

  const grPhotos = photosByName[beachNameGr];
  if (grPhotos?.length) return padPhotos(grPhotos, count);

  const enPhotos = photosByName[beachNameEn];
  if (enPhotos?.length) return padPhotos(enPhotos, count);

  for (const [key, photos] of Object.entries(photosByName)) {
    const normalizedKey = normalizeLookup(key);
    if (normalizedKey === normalizedBeachNameGr || normalizedKey === normalizedBeachNameEn) {
      return padPhotos(photos, count);
    }
  }

  return [];
};

export type BeachPhotoSource = 'exact' | 'fallback' | 'none';

export type BeachPhotoLookup = {
  photos: string[];
  detailPhotos?: string[];
  source: BeachPhotoSource;
  metadata?: BeachImageMetadata;
};

/**
 * Get photo URLs for a beach.
 */
export const getBeachPhotoLookup = (
  beachNameGr: string,
  beachNameEn: string,
  beachId: number,
  count: number = 5,
  islandName?: string
): BeachPhotoLookup => {
  // GPS-verified per-beach photos (keyed by unique beachId → zero collision risk).
  // Populated by scripts/harvestGeoPhotos.mjs (Commons files geotagged within a
  // tight radius of the beach's coordinates, filtered for non-beach subjects).
  const byId = (BEACH_PHOTOS_BY_ID as Record<string, string[]>)[String(beachId)];
  if (byId && byId.length) {
    return { photos: padPhotos(byId, count), source: 'exact' };
  }

  const atticaAreaKey = getAtticaAreaKey(islandName);
  if (atticaAreaKey) {
    const areaBeachPhotos = ATTICA_BEACH_PHOTOS_BY_AREA[atticaAreaKey];
    const areaPhotos = areaBeachPhotos ? findPhotos(areaBeachPhotos, beachNameGr, beachNameEn, count) : [];
    if (areaPhotos.length) return { photos: areaPhotos, source: 'exact' };
    if (areaBeachPhotos) return { photos: [], source: 'none' };
  }

  const creteAreaKey = getCreteAreaKey(islandName);
  if (creteAreaKey) {
    const areaBeachPhotos = CRETE_BEACH_PHOTOS_BY_AREA[creteAreaKey];
    const areaPhotos = areaBeachPhotos ? findPhotos(areaBeachPhotos, beachNameGr, beachNameEn, count) : [];
    if (areaPhotos.length) return { photos: areaPhotos, source: 'exact' };
    if (areaBeachPhotos) return { photos: [], source: 'none' };
  }

  const macedoniaAreaKey = getMacedoniaAreaKey(islandName);
  if (macedoniaAreaKey) {
    const areaBeachPhotos = MACEDONIA_BEACH_PHOTOS_BY_AREA[macedoniaAreaKey];
    const areaPhotos = areaBeachPhotos ? findPhotos(areaBeachPhotos, beachNameGr, beachNameEn, count) : [];
    if (areaPhotos.length) return { photos: areaPhotos, source: 'exact' };
    if (areaBeachPhotos) return { photos: [], source: 'none' };
  }

  const thraceAreaKey = getThraceAreaKey(islandName);
  if (thraceAreaKey) {
    const areaBeachPhotos = THRACE_BEACH_PHOTOS_BY_AREA[thraceAreaKey];
    const areaPhotos = areaBeachPhotos ? findPhotos(areaBeachPhotos, beachNameGr, beachNameEn, count) : [];
    if (areaPhotos.length) return { photos: areaPhotos, source: 'exact' };
    if (areaBeachPhotos) return { photos: [], source: 'none' };
  }

  const northAegeanAreaKey = getNorthAegeanAreaKey(islandName);
  if (northAegeanAreaKey) {
    const areaBeachPhotos = NORTH_AEGEAN_BEACH_PHOTOS_BY_AREA[northAegeanAreaKey];
    const areaPhotos = areaBeachPhotos ? findPhotos(areaBeachPhotos, beachNameGr, beachNameEn, count) : [];
    if (areaPhotos.length) return { photos: areaPhotos, source: 'exact' };
    if (areaBeachPhotos) return { photos: [], source: 'none' };
  }

  const cycladesIslandKey = getCycladesIslandKey(islandName);
  if (cycladesIslandKey) {
    if (cycladesIslandKey === 'milos') {
      const verifiedMilosPhoto =
        getBeachImageMetadataById(beachId, islandName) ||
        getBeachImageMetadata(beachNameGr, islandName) ||
        getBeachImageMetadata(beachNameEn, islandName);
      if (verifiedMilosPhoto?.imageUrl) {
        return {
          photos: [verifiedMilosPhoto.thumbnailUrl || verifiedMilosPhoto.imageUrl],
          detailPhotos: [verifiedMilosPhoto.thumbnailUrl || verifiedMilosPhoto.imageUrl],
          source: 'exact',
          metadata: verifiedMilosPhoto,
        };
      }
      // No verified-JSON photo: fall through to the allowlisted MILOS_BEACH_PHOTOS
      // lookup below (VERIFIED_MILOS_BEACH_PHOTO_KEYS gates which beaches show).
    }

    const islandBeachPhotos = CYCLADES_BEACH_PHOTOS_BY_ISLAND[cycladesIslandKey];
    const allowedKeys = cycladesIslandKey === 'milos' ? VERIFIED_MILOS_BEACH_PHOTO_KEYS : undefined;
    // Unverified blocklist is Milos-specific; only apply it to the Milos map so
    // same-named beaches on other islands are not falsely suppressed.
    const blockedKeys = cycladesIslandKey === 'milos' ? UNVERIFIED_BEACH_PHOTO_KEYS : undefined;
    const beachPhotos = islandBeachPhotos
      ? findPhotos(islandBeachPhotos, beachNameGr, beachNameEn, count, allowedKeys, blockedKeys)
      : [];
    if (beachPhotos.length) return { photos: beachPhotos, source: 'exact' };
    return { photos: [], source: 'none' };
  }

  // Ionian: only verified per-beach photos (never island cover shots). A wrong
  // landmark/image is worse for trust than a polished placeholder.
  const ionianIslandKey = getIonianIslandKey(islandName);
  if (ionianIslandKey) {
    const islandBeachPhotos = IONIAN_BEACH_PHOTOS_BY_ISLAND[ionianIslandKey];
    const beachPhotos = islandBeachPhotos
      ? findPhotos(islandBeachPhotos, beachNameGr, beachNameEn, count)
      : [];
    if (beachPhotos.length) return { photos: beachPhotos, source: 'exact' };
    return { photos: [], source: 'none' };
  }

  const beachPhotos = findPhotos(BEACH_PHOTOS, beachNameGr, beachNameEn, count);
  if (beachPhotos.length) return { photos: beachPhotos, source: 'exact' };

  return { photos: [], source: 'none' };
};

export const getBeachPhotos = (
  beachNameGr: string,
  beachNameEn: string,
  beachId: number,
  count: number = 5,
  islandName?: string
): string[] => {
  return getBeachPhotoLookup(beachNameGr, beachNameEn, beachId, count, islandName).photos;
};

type CommonsImageInfo = {
  thumburl?: string;
  url?: string;
  mime?: string;
};

type CommonsPage = {
  title?: string;
  imageinfo?: CommonsImageInfo[];
};

const COMMONS_CACHE_PREFIX = 'commonsBeachPhotos:';
const COMMONS_CACHE_VERSION = 'v1';

const getStorage = (): Storage | null => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
};

const getMeaningfulTokens = (value: string): string[] => {
  const stopWords = new Set([
    'beach', 'paralia', 'παραλια', 'plage', 'strand', 'greece', 'grece', 'greek',
    'island', 'nisos', 'νησος', 'ormos', 'ορμος', 'agios', 'agia', 'αγιος', 'αγια',
    'saint', 'santa', 'santo', 'the', 'and', 'of', 'at', 'near', 'view',
  ]);

  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .match(/[a-z0-9α-ω]{3,}/g)
    ?.filter(token => !stopWords.has(token)) ?? [];
};

const isLikelyBeachImage = (title: string, beachNameGr: string, beachNameEn: string, islandName?: string): boolean => {
  const normalizedTitle = normalizeLookup(title.replace(/^file/i, ''));
  if (/\.(pdf|svg|djvu|webm|ogv|mp3|ogg)$/i.test(title)) return false;

  const beachTokens = [
    ...getMeaningfulTokens(beachNameGr),
    ...getMeaningfulTokens(beachNameEn),
  ];
  const areaTokens = getMeaningfulTokens(islandName ?? '');
  const hasBeachCue = /(beach|paralia|παραλια|plage|strand|bay|cove|ammos|αμμος|gialos|γιαλος)/i.test(title);
  const hasBeachToken = beachTokens.some(token => normalizedTitle.includes(token));
  const hasAreaToken = areaTokens.length === 0 || areaTokens.some(token => normalizedTitle.includes(token));

  return hasBeachCue && hasAreaToken && (beachTokens.length === 0 || hasBeachToken);
};

const buildCommonsQueries = (beachNameGr: string, beachNameEn: string, islandName?: string): string[] => {
  const area = islandName ? ` ${islandName}` : '';
  const names = Array.from(new Set([beachNameEn, beachNameGr].filter(Boolean)));

  return names.flatMap(name => [
    `${name}${area} beach Greece`,
    `${name}${area} paralia`,
  ]);
};

export const findCommonsBeachPhotos = async (
  beachNameGr: string,
  beachNameEn: string,
  beachId: number,
  count: number = 3,
  islandName?: string
): Promise<string[]> => {
  const cacheKey = `${COMMONS_CACHE_PREFIX}${COMMONS_CACHE_VERSION}:${beachId}:${normalizeLookup(islandName ?? '')}`;
  const storage = getStorage();
  const cached = storage?.getItem(cacheKey);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      return Array.isArray(parsed) ? parsed.slice(0, count) : [];
    } catch {
      storage?.removeItem(cacheKey);
    }
  }

  const found: string[] = [];

  for (const query of buildCommonsQueries(beachNameGr, beachNameEn, islandName)) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '8',
      gsrsearch: query,
      prop: 'imageinfo',
      iiprop: 'url|mime',
      iiurlwidth: '800',
      format: 'json',
      origin: '*',
    });

    try {
      const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`);
      if (!response.ok) continue;

      const data = await response.json();
      const pages = Object.values((data.query?.pages ?? {}) as Record<string, CommonsPage>);

      for (const page of pages) {
        const title = page.title ?? '';
        const info = page.imageinfo?.[0];
        const url = info?.thumburl ?? info?.url;

        if (!url || !info?.mime?.startsWith('image/')) continue;
        if (!isLikelyBeachImage(title, beachNameGr, beachNameEn, islandName)) continue;
        if (!found.includes(url)) found.push(url);
        if (found.length >= count) break;
      }
    } catch {
      continue;
    }

    if (found.length >= count) break;
  }

  storage?.setItem(cacheKey, JSON.stringify(found));
  return found;
};

function padPhotos(photos: string[], count: number): string[] {
  // Never repeat — return only unique photos, up to count
  return photos.slice(0, count);
}

export const hasRealPhotos = (beachNameGr: string, beachNameEn: string): boolean => {
  if (BEACH_PHOTOS[beachNameGr] || BEACH_PHOTOS[beachNameEn]) return true;
  for (const key of Object.keys(BEACH_PHOTOS)) {
    if (beachNameGr.includes(key) || beachNameEn.includes(key) ||
        key.includes(beachNameGr) || key.includes(beachNameEn)) {
      return true;
    }
  }
  return false;
};
