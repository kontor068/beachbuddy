/**
 * Real beach photos from Wikimedia Commons and other license-safe sources.
 * Uses Special:Redirect for auto-scaled thumbnails.
 */
import { getBeachImageMetadata, getBeachImageMetadataById, type BeachImageMetadata } from './beachImageService';

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
  wm('ParaliaEdem2016.png'),
];
const ATTICA_BATIS_PHOTOS = [wm('Batis Palaio Faliro beach.jpg')];
const ATTICA_EDEM_PHOTOS = [
  wm('ParaliaEdem2016.png'),
  wm('Edem beach - panoramio.jpg'),
  wm('Edem beach - panoramio - Robert Freeman.jpg'),
];
const ATTICA_ALIMOS_A_PLAZ_PHOTOS = [
  wm('Alimos - panoramio (16).jpg'),
  wm('Alimos - panoramio (15).jpg'),
  wm('Kalamaki from the Saronic Gulf.jpg'),
];
const ATTICA_AKTI_TOU_ILIOU_PHOTOS = [
  wm('Loutra Alimou April 2014 - panoramio.jpg'),
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
  'Ελαφονήσι': [wm('Elafonissi Panorama Aug2018.jpg')],
  'Elafonissi': [wm('Elafonissi Panorama Aug2018.jpg')],
  'Μάταλα': [wm('Matala beach cliff Crete Greece.jpg')],
  'Matala': [wm('Matala beach cliff Crete Greece.jpg')],
  'Πρέβελη': [wm('Preveli Gorge and Beach 01.jpg')],
  'Preveli': [wm('Preveli Gorge and Beach 01.jpg')],
  'Βάι': [wm('Vai R06.jpg')],
  'Vai': [wm('Vai R06.jpg')],
  'Σεϊτάν Λιμάνια': [wm('Seitan limania beach, Akrotiri, Chania, Crete, Greece 01.jpg')],
  'Φαλάσαρνα': [wm('Falassarna beach, 051227.jpg')],
  'Falassarna': [wm('Falassarna beach, 051227.jpg')],
  'Σταυρός': [wm('Stavros beach, Akrotiri, Chania, Crete, Greece.jpg')],
  'Γεωργιούπολη': [wm('Georgioupoli (Crete, Greece).jpg')],
  'Μπαλί': [wm('Bali, Crete, Greece.jpg')],
  'Bali': [wm('Bali, Crete, Greece.jpg')],
  'Πλακιάς': [wm('Plakias 2015.jpg')],
  'Plakias': [wm('Plakias 2015.jpg')],
  'Αγία Γαλήνη': [wm('Agia Galini Kreta.jpg')],
  'Τριόπετρα': [wm('Triopetra 2014.jpg')],
  'Σίσι': [wm('Sissi, Crete, Greece.jpg')],
  'Μοχλός': [wm('Mochlos, Crete, Greece.jpg')],
  'Ξερόκαμπος': [wm('Xerokampos Crete 2.JPG')],

  // ==================== CYCLADES ====================
  // --- Santorini ---
  'Περίσσα': [wm('Beach - Perissa - Santorini - Greece - 06.jpg'), wm('Beach - Perissa - Santorini - Greece - 04.jpg')],
  'Perissa': [wm('Beach - Perissa - Santorini - Greece - 06.jpg'), wm('Perissa Beach, Santorini on June 7, 2009.jpg')],
  'Καμάρι': [wm('Kamari Santorin.jpg'), wm('Kamari Beach, Santorini, Greece - panoramio (3).jpg')],
  'Kamari': [wm('Kamari Santorin.jpg'), wm('Boat at Kamari beach, Santorini, Greece.jpg')],
  'Κόκκινη Παραλία': [wm('Red Beach, Santorini.jpg'), wm('Red Beach in Santorini.jpg')],
  'Red Beach': [wm('Red Beach, Santorini.jpg'), wm('Red Beach, Santorini, 226476.jpg')],
  'Βλυχάδα': [wm('Vlychada - Santorini 2019.jpg'), wm('SANTORINI VLYCHADA 7848.jpg')],
  'Vlychada': [wm('Vlychada - Santorini 2019.jpg')],
  'Περίβολος': [wm('Perivolos (Santorini).jpg'), wm('Perivolos beach, Santorini (1335681187).jpg')],
  'Μονόλιθος': [wm('Santorini Beach - panoramio.jpg')],
  'White Beach': [wm('AspriParalia.jpg')],

  // --- Mykonos ---
  'Σούπερ Παράδεισος': [wm('Super Paradise Beach Mykonos.jpg'), wm('Super Paradise Beach, Mykonos, Greece.jpg')],
  'Super Paradise': [wm('Super Paradise Beach Mykonos.jpg'), wm('Super Paradise Beach, Mykonos, Greece.jpg')],
  'Paradise Beach': [wm('Paradise Beach, Mykonos.jpg')],
  'Ελιά': [wm('Elias Beach on Mykonos.JPG')],
  'Elia': [wm('Elias Beach on Mykonos.JPG')],
  'Πλατύς Γιαλός': [wm('Mykonos Platis Gialos Luftbild 03.jpg')],
  'Όρνος': [wm('GR-mykonos-ornos-beach.jpg')],
  'Ornos': [wm('GR-mykonos-ornos-beach.jpg')],
  'Άγιος Στέφανος': [wm('Agios Stefanos beach Mykonos.jpg')],
  'Φτελιά': [wm('Ftelia Bay, Mykonos, 060363.jpg')],
  'Ψαρρού': [wm('Mykonos Beach Strand (24005199291).jpg')],
  'Άγιος Ιωάννης': [wm('Agios Ioannis, Mykonos, Greece - 1997.jpg')],
  'Πάνορμος': [wm('Mykonos 3160.jpg')],
  'Παράγκα': [wm('III Mykonos, Greece (2).jpg')],

  // --- Paros ---
  'Κολυμπήθρες': [wm('Kolymbitres, Paros, 190539.jpg')],
  'Kolymbithres': [wm('Kolymbitres, Paros, 190539.jpg')],
  'Χρυσή Ακτή': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
  'Golden Beach': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
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
  'Ψιλή Άμμος': [wm('Naxos Mikri Vigla 2025-06-25 1368 beach 06.jpg')],

  // --- Milos ---
  'Σαρακίνικο': [wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'), wm('Aerial view of Sarakiniko Beach on Milos Island, Greece.jpg')],
  'Sarakiniko': [wm('Sarakiniko Beach on Milos Island, Greece with a view of the Aegean Sea.jpg'), wm('Sarakiniko Beach on the island of Milos, Greece.jpg')],
  'Φυριπλάκα': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Firiplaka': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Fyriplaka': [wm('Aerial view of Paralia Firiplaka on Milos Island, Greece.jpg')],
  'Παπάφραγκας': [wm('Papafragas beach, Milos.jpg')],
  'Papafragas': [wm('Papafragas beach, Milos.jpg')],
  'Τσιγκράδο': [wm('Moonscape surrounding Sarakiniko Beach on Milos Island, Greece.jpg')],
  'Tsigrado': [wm('Moonscape surrounding Sarakiniko Beach on Milos Island, Greece.jpg')],
  'Agia Kyriaki': [wm('Milossouth.JPG')],
  'Agia Kiriaki': [wm('Milossouth.JPG')],

  // --- Ios ---
  'Μυλοπότας': [wm('Mylopotas Beach Ios.jpg'), wm('Ios Milopotas.JPG')],
  'Mylopotas': [wm('Mylopotas Beach Ios.jpg'), wm('Ios Milopotas.JPG')],
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
  'Πρασονήσι': [wm('Peninsula of Prasonisi and Prasonisi Kite Beach. Rhodes, Greece.jpg')],
  'Prasonisi': [wm('Peninsula of Prasonisi and Prasonisi Kite Beach. Rhodes, Greece.jpg')],

  // ==================== HALKIDIKI ====================
  'Καβουρότρυπες': [wm('Kavourotripes Beach, Sykia, Sithonia, Chalkidiki, Greece 02.jpg')],
  'Kavourotrypes': [wm('Kavourotripes Beach, Sykia, Sithonia, Chalkidiki, Greece 02.jpg')],

  // ==================== SPORADES ====================
  'Λαλάρια': [wm('Lalaria beach girl (Unsplash).jpg')],
  'Lalaria': [wm('Lalaria beach girl (Unsplash).jpg')],

  // ==================== PELOPONNESE ====================
  'Βοϊδοκοιλιά': [wm('Voidokilia Beach1.jpg')],
  'Voidokilia': [wm('Voidokilia Beach1.jpg')],
  'Σιμός': [wm('Elafonisos island Simos Beach.jpg')],
  'Simos': [wm('Elafonisos island Simos Beach.jpg')],
  'Ελαφόνησος': [wm('Elafonisos island Simos Beach.jpg')],
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
    'Παραλία Φρεαττύδος': [wm('Freatida beach Piraeus.jpg')],
    'Φρεαττύδος': [wm('Freatida beach Piraeus.jpg')],
    'Βοτσαλάκια': [wm('Votsalakia beach Piraeus.jpg')],
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
    'πλαζ "Καλαμπάκα"': [wm('Freatida beach Piraeus.jpg')],
    'Καλαμπάκα': [wm('Freatida beach Piraeus.jpg')],
  },
  east_attica: {
    'Παραλία Βραυρώνας': [wm('Vravrona beach.jpg')],
    'Beach Vravrona': [wm('Vravrona beach.jpg')],
    'Παραλία Κακή Θάλασσα': [wm('Kaki Thalassa Beach.jpg')],
    'Kaki Thalassa Beach': [wm('Kaki Thalassa Beach.jpg')],
    'Παραλία Σουνίου': [wm('Sounion Beach.jpg'), wm('Cape Sounion beach.jpg')],
    'Sounion Beach': [wm('Sounion Beach.jpg'), wm('Cape Sounion beach.jpg')],
    'Παραλία Βάρκιζας': ATTICA_VARKIZA_PHOTOS,
    'Yabanaki': ATTICA_VARKIZA_PHOTOS,
    'Παραλία Σχινιά': [wm('Schinias beach.jpg'), wm('Schinias Bay.jpg')],
    'Παραλία Ζούμπερι (Νέα Μάκρη)': [wm('Zouberi beach.jpg')],
    'Legrena': [wm('Legrena Beach Attica.jpg')],
    'Παραλία Λεγραινών': [wm('Legrena Beach Attica.jpg')],
    "Β' πλαζ Βούλας": ATTICA_VOULA_B_PLAZ_PHOTOS,
    'Αυλάκι': [wm('Avlaki beach Porto Rafti.jpg')],
    'Ερωτοσπηλιά': [wm('Erotospilia beach.jpg')],
    'Λομπάρντα': [wm('Lombarda beach Attica.jpg')],
    'Μεγάλο Καβούρι': ATTICA_MEGALO_KAVOURI_PHOTOS,
    'Μικρό Καβούρι': ATTICA_MIKRO_KAVOURI_PHOTOS,
    'Παραλία Αλθέας': [wm('Althea beach Attica.jpg')],
    'Παραλία Σκάλες Αλθέας': [wm('Althea beach Attica.jpg')],
    'Παραλία Αναβύσσου': [wm('Anavyssos beach.jpg')],
    'Παραλία Μαύρο Λιθάρι': [wm('Mavro Lithari beach.jpg')],
    'Παραλία ΚΑΠΕ': [wm('KAPE beach.jpg')],
    'Χάρακας': [wm('Charakas beach Attica.jpg')],
    'Πούντα Ζέζα': [wm('Pounta Zeza beach.jpg')],
    'Παραλία Χαμολιά': [wm('Chamolia beach.jpg')],
    'Μικρή Χαμολιά': [wm('Chamolia beach.jpg')],
    'Πλαζ Ραφήνας': [wm('Rafina beach.jpg')],
    'Παραλία Μαραθώνα': [wm('Marathon beach Attica.jpg')],
    'Γαλάζια Ακτή': [wm('Galazia Akti Attica.jpg')],
    'Θυμάρι': [wm('Thymari beach.jpg')],
    'Σκαλάκια Αναβύσσου': [wm('Anavyssos beach.jpg')],
    'Τσονίμα': [wm('Tsonima beach.jpg')],
  },
  west_attica: {
    'Παραλία Σχίνος': [wm('Schinos beach Corinthia.jpg')],
    'La Isla': [wm('Schinos beach Corinthia.jpg')],
    'Παραλία Κινέτας': [wm('Kineta beach.jpg')],
    'Ψάθα': [wm('Psatha beach.jpg')],
    'Παραλία Πόρτο Γερμενό': [wm('Porto Germeno (Aigosthena) from the south-west - August 26, 2020.jpg')],
    'Porto Germeno': [wm('Porto Germeno (Aigosthena) from the south-west - August 26, 2020.jpg')],
  },
  aegina: {},
  agistri: {},
  hydra: {},
  kythira: {
    'Διακόφτι': [wm('Diakofti beach Kythira.jpg')],
    'Καψάλι': [wm('Kapsali beach Kythira.jpg')],
    'Καψάλι Πίσω Γιαλός': [wm('Kapsali beach Kythira.jpg')],
    'Κομπονάδα': [wm('Kombonada beach Kythira.jpg')],
    'Μελιδόνι': [wm('Melidoni beach Kythira.jpg')],
    'Παραλία Αγία Πελαγία': [wm('Agia Pelagia beach Kythira.jpg')],
    'Παραλία Καλαδί': [wm('Kaladi beach Kythira.jpg')],
    'Παραλία Χαλκός': [wm('Chalkos beach Kythira.jpg')],
    'Παραλια Κακιά Λαγκάδα': [wm('Kakia Lagada beach Kythira.jpg')],
    'Παραλια Φυρή Άμμος': [wm('Fyri Ammos beach Kythira.jpg')],
    'Φυρή Άμμος Κάλαμος': [wm('Fyri Ammos beach Kythira.jpg')],
    'Λιμνιώνας': [wm('Limnionas beach Kythira.jpg')],
    'Πλατιά Άμμος': [wm('Platia Ammos Kythira.jpg')],
  },
  poros: {},
  salamina: {},
  spetses: {},
  piraeus_coast: {
    'Παραλία Περάματος': [wm('Perama beach Attica.jpg')],
  },
};

const CRETE_BEACH_PHOTOS_BY_AREA: Record<string, Record<string, string[]>> = {
  chania: {
    Balos: [wm('Balos Beach.jpg'), wm('Bay of Balos, Crete 001.jpg')],
    Μπάλος: [wm('Balos Beach.jpg'), wm('Bay of Balos, Crete 001.jpg')],
    Elafonisi: [wm('Elafonissi Panorama Aug2018.jpg')],
    Elafonissi: [wm('Elafonissi Panorama Aug2018.jpg')],
    Ελαφονήσι: [wm('Elafonissi Panorama Aug2018.jpg')],
    Kedrodasos: [wm('Aerial view of Kedrodasos beach on Crete, Greece.jpg'), wm('Paralia Kedrodasos beach on Crete, Greece.jpg')],
    Falasarna: [wm('Falassarna beach, 051227.jpg')],
    Falassarna: [wm('Falassarna beach, 051227.jpg')],
    Φαλάσαρνα: [wm('Falassarna beach, 051227.jpg')],
    'Seitan Limani': [wm('Seitan limania beach, Akrotiri, Chania, Crete, Greece 01.jpg')],
    'Σεϊτάν Λιμάνια': [wm('Seitan limania beach, Akrotiri, Chania, Crete, Greece 01.jpg')],
    Stavros: [wm('Stavros beach, Akrotiri, Chania, Crete, Greece.jpg')],
    Σταυρός: [wm('Stavros beach, Akrotiri, Chania, Crete, Greece.jpg')],
    Georgioupoli: [wm('Georgioupoli (Crete, Greece).jpg')],
    Γεωργιούπολη: [wm('Georgioupoli (Crete, Greece).jpg')],
    Sougia: [wm('Crete Sougia3 tango7174.jpg'), wm('Beach Sougia Chania Crete 03.jpg')],
    Marathi: [wm('Kato Marathi - panoramio (4).jpg'), wm('Kato Marathi - panoramio (5).jpg')],
  },
  heraklion: {
    Matala: [wm('Matala beach cliff Crete Greece.jpg')],
    Μάταλα: [wm('Matala beach cliff Crete Greece.jpg')],
    Kommos: [wm('Kommos Crete.jpg'), wm('Crete Kommos Plage 05092011 - panoramio.jpg')],
    Agiofarago: [wm('Αγιοφάραγγο - Agiofaraggo.jpg'), wm('Agiofarago Crete 1.jpg')],
  },
  rethymno: {
    Preveli: [wm('Preveli Gorge and Beach 01.jpg')],
    Πρέβελη: [wm('Preveli Gorge and Beach 01.jpg')],
    Plakias: [wm('Plakias 2015.jpg')],
    Πλακιάς: [wm('Plakias 2015.jpg')],
    Triopetra: [wm('Triopetra 2014.jpg')],
    Τριόπετρα: [wm('Triopetra 2014.jpg')],
    Damnoni: [wm('Damnoni 05.jpg')],
    Schinaria: [wm('Schinaria Beach Panorama 02.JPG'), wm('Schinaria Beach 01.JPG')],
  },
  lasithi: {
    Vai: [wm('Vai R06.jpg'), wm('Vai Beach Crete.jpg')],
    '\u0392\u03ac\u03b9': [wm('Vai R06.jpg'), wm('Vai Beach Crete.jpg')],
    Mochlos: [wm('Mochlos, Crete, Greece.jpg')],
    '\u039c\u03bf\u03c7\u03bb\u03cc\u03c2': [wm('Mochlos, Crete, Greece.jpg')],
    Xerokampos: [wm('Xerokampos Crete 2.JPG')],
    '\u039e\u03b5\u03c1\u03cc\u03ba\u03b1\u03bc\u03c0\u03bf\u03c2': [wm('Xerokampos Crete 2.JPG')],
    Sisi: [wm('Sissi, Crete, Greece.jpg')],
    Sissi: [wm('Sissi, Crete, Greece.jpg')],
    '\u03a3\u03af\u03c3\u03b9': [wm('Sissi, Crete, Greece.jpg')],
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
  },
  samos: {
    '\u03a4\u03c3\u03b1\u03bc\u03b1\u03b4\u03bf\u03cd': [wm('Tsamadou 542s.jpg')],
    Tsamadou: [wm('Tsamadou 542s.jpg')],
    '\u039c\u03b5\u03b3\u03ac\u03bb\u03bf \u03a3\u03b5\u03ca\u03c4\u03ac\u03bd\u03b9': [wm('Megalo Seitani panorama 2.jpg'), wm('Megalo Seitani 1.jpg')],
    'Megalo Seitani': [wm('Megalo Seitani panorama 2.jpg'), wm('Megalo Seitani 1.jpg')],
    '\u03a0\u03bf\u03c4\u03ac\u03bc\u03b9': [wm('Samos-Potami-Bucht.JPG'), wm('Potami beach NIC7848.jpg')],
    Potami: [wm('Samos-Potami-Bucht.JPG'), wm('Potami beach NIC7848.jpg')],
  },
  lemnos: {
    '\u039a\u03ad\u03c1\u03bf\u03c2': [wm('Keros bay, Lemnos.jpg'), wm('Keros Lemnos.JPG')],
    Keros: [wm('Keros bay, Lemnos.jpg'), wm('Keros Lemnos.JPG')],
  },
  chios: {},
  psara: {},
  lesvos: {},
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
  'Παπάφραγκας': [wm('Papafragas beach, Milos.jpg')],
  Papafragas: [wm('Papafragas beach, Milos.jpg')],
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
    'Περίσσα': [wm('Beach - Perissa - Santorini - Greece - 06.jpg'), wm('Beach - Perissa - Santorini - Greece - 04.jpg')],
    'Perissa': [wm('Beach - Perissa - Santorini - Greece - 06.jpg'), wm('Perissa Beach, Santorini on June 7, 2009.jpg')],
    'Perissa beach': [wm('Beach - Perissa - Santorini - Greece - 06.jpg'), wm('Perissa Beach, Santorini on June 7, 2009.jpg')],
    'Καμάρι': [wm('Kamari Santorin.jpg'), wm('Kamari Beach, Santorini, Greece - panoramio (3).jpg')],
    'Kamari': [wm('Kamari Santorin.jpg'), wm('Boat at Kamari beach, Santorini, Greece.jpg')],
    'Kamari Beach': [wm('Kamari Santorin.jpg'), wm('Boat at Kamari beach, Santorini, Greece.jpg')],
    'Κόκκινη Παραλία': [wm('Red Beach, Santorini.jpg'), wm('Red Beach in Santorini.jpg')],
    'Red Beach': [wm('Red Beach, Santorini.jpg'), wm('Red Beach, Santorini, 226476.jpg')],
    'Βλυχάδα': [wm('Vlychada - Santorini 2019.jpg'), wm('SANTORINI VLYCHADA 7848.jpg')],
    'Vlychada': [wm('Vlychada - Santorini 2019.jpg')],
    'Γυμνιστική παραλία Βλυχάδα': [wm('Vlychada - Santorini 2019.jpg')],
    'Περίβολος': [wm('Perivolos (Santorini).jpg'), wm('Perivolos beach, Santorini (1335681187).jpg')],
    'Perivolos': [wm('Perivolos (Santorini).jpg'), wm('Perivolos beach, Santorini (1335681187).jpg')],
    'Μονόλιθος': [wm('Santorini Beach - panoramio.jpg')],
    'White Beach': [wm('AspriParalia.jpg')],
    'Λευκή Παραλία': [wm('AspriParalia.jpg')],
  },
  mykonos: {
    'Σούπερ Παράδεισος': [wm('Super Paradise Beach Mykonos.jpg'), wm('Super Paradise Beach, Mykonos, Greece.jpg')],
    'Super Paradise': [wm('Super Paradise Beach Mykonos.jpg'), wm('Super Paradise Beach, Mykonos, Greece.jpg')],
    'Paradise Beach': [wm('Paradise Beach, Mykonos.jpg')],
    'Καλαμοπόδι': [wm('Paradise Beach, Mykonos.jpg')],
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
  },
  paros: {
    'Κολυμπήθρες': [wm('Kolymbitres, Paros, 190539.jpg')],
    'Kolymbithres': [wm('Kolymbitres, Paros, 190539.jpg')],
    'Χρυσή Ακτή': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
    'Golden Beach': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
    'Παραλία Αγκάλη Χρυσής Ακτής': [wm('Golden Beach Paros.JPG'), wm('Gold sandy beach, Paros, Greece.jpg')],
    'Πιπέρι': [wm('GR-paros-naoussa-piperi-strand.jpg')],
    'Φάραγγας': [wm('Cyclades Paros Faragas Beach - panoramio.jpg')],
    'Μώλος': [wm('Cyclades Paros Molos Beach Vue Naxos - panoramio.jpg')],
    'Σάντα Μαρία': [wm('Paros Beach.jpg')],
    'Μικρή Σάντα Μαρία': [wm('Paros Beach.jpg')],
    'Λογαράς': [wm('GR-paros-piso-livada-beach.jpg')],
    'MARTSELO BEACH': [wm('Paros Marcello beach.jpg')],
    'Monastiri Beach': [wm('Monastiri beach Paros.jpg')],
    'Παραλία Αλυκή': [wm('Aliki beach Paros.jpg')],
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
    'Apollonas Beach': [wm('Apollonas Naxos beach.jpg')],
    'Pyrgaki Beach': [wm('Pyrgaki beach Naxos.jpg')],
  },
  ios: {
    'Μυλοπότας': [wm('Mylopotas Beach Ios.jpg'), wm('Ios Milopotas.JPG')],
    'Mylopotas': [wm('Mylopotas Beach Ios.jpg'), wm('Ios Milopotas.JPG')],
    'Μαγγανάρι': [wm('Ios island, Cyclades, Greece beach view 2007.jpg')],
    'Manganari': [wm('Ios island, Cyclades, Greece beach view 2007.jpg')],
    'Αγία Θεοδότη': [wm('Agia Theodoti beach, Ios.jpg')],
    'Κουμπάρα': [wm('Koumbara beach Ios.jpg')],
    'Τζαμαρία': [wm('Tzamaria beach Ios.jpg')],
  },
  folegandros: {
    'Λιβαδάκι': [wm('Paralia Livadaki Beach, Folegandros, Greece.jpg')],
    'Αγκάλη': [wm('Angali beach, Folegandros, 15M6560.jpg')],
    'Κάτεργο': [wm('Cyclades Folegandros Katergo Plage - panoramio.jpg')],
    'Λιβάδι': [wm('Livadi Beach near camping, Folegandros, 153365.jpg')],
    'Άγιος Νικόλαος': [wm('St Nicolaos beach, Folegandros.jpeg')],
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
  },
  andros: {
    'Βιτάλι': [wm('Vitali Bay1.jpg'), wm('Vitali Bay3.jpg')],
    'Kampos Beach Bar Vitali': [wm('Vitali Bay1.jpg'), wm('Vitali Bay3.jpg')],
    'Της γριας το πήδημα': [wm('Pidima Grias Beach - panoramio.jpg'), wm('Παραλία της γριάς το πήδημα, Άνδρος.jpg')],
    'Κυπρί': [wm('Παραλία κυπρί 2019.jpg')],
    'Μπατσί': [wm('Main beach at Chora Andros, Andros Island, Cyclades, Greece.jpg')],
    'Άχλα': [wm('Achla Beach, Andros.jpg')],
    'Αχλα': [wm('Achla Beach, Andros.jpg')],
    'Χρυσή Αμμος': [wm('Golden Sand beach Andros.jpg')],
  },
  amorgos: {
    'Αγία Άννα': [wm('Amorgos plage d aghia anna IMG 2757.JPG')],
    'Αγία Άννα Αμοργός': [wm('Amorgos plage d aghia anna IMG 2757.JPG')],
    'Καλοταρίτισσα': [wm('The natural bay where Kalotaritissa beach is located.jpg')],
    'Καλοκαταρίτισσα': [wm('The natural bay where Kalotaritissa beach is located.jpg')],
    'Νικουριά': [wm('Panagia beach in Nikouria island, 18M2105.jpg'), wm('Great beach on the Nikouria island, 18M2127.jpg')],
    'Μούρος': [wm('Mouros Beach Amorgos.jpg')],
    'Άγιος Παύλος': [wm('Agios Pavlos beach Amorgos.jpg')],
    'Μαλτέζι': [wm('Maltezi beach Amorgos.jpg')],
  },
  serifos: {
    'Λιβαδάκια': [wm('A@a livadakia beach serifos greece - panoramio.jpg'), wm('Livadakia Beach Serifos (209164677).jpeg')],
    'Γάνεμα': [wm('A@a Ganema beach 1 Serifos Greece - panoramio.jpg'), wm('Ganema serifos.jpg')],
    'Καλό Αμπέλι': [wm('Kalo Ampeli beach, Serifos island, Greece - panoramio.jpg')],
    'Αυλόμωνας': [wm('A@a avlomonas beach serifos greece - panoramio.jpg')],
    'Μέγα Λιβάδι': [wm('A@a Mega Livadi 1 Serifos Greece - panoramio.jpg')],
    'Ψιλή Άμμος': [wm('Psili Ammos Serifos.jpg')],
    'Βάγια': [wm('Vagia beach Serifos.jpg')],
  },
  sifnos: {
    'Βαθύ': [wm('Beach in Vathy on Sifnos, 153617.jpg'), wm('Beach in Vathy on Sifnos, 153621.jpg')],
    'Βαθή': [wm('Beach in Vathy on Sifnos, 153617.jpg'), wm('Beach in Vathy on Sifnos, 153621.jpg')],
    'Φάρος': [wm('Faros Sifnos Cyclades.jpg')],
    'Καμάρες': [wm('Kamares from Ag. Marina, Sifnos, 15M6920.jpg')],
    'Πλατύς Γιαλός Σίφνος': [wm('Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg')],
    'Platis Gialos': [wm('Cyclades Sifnos Platis Gialos 09092014 - panoramio.jpg')],
    'Αποκοφτό': [wm('Apokofto beach Sifnos.jpg')],
  },
  syros: {
    'Μέγας Γυαλός': [wm('Megas Gyalos Syros 1.jpg'), wm('Megas Gyalos Syros 2.jpg')],
    'Αγαθοπές': [wm('Agathopes beach Syros 1.jpg'), wm('Agathopes beach Syros 2.jpg')],
    'Αγκαθωπές': [wm('Agathopes beach Syros 1.jpg'), wm('Agathopes beach Syros 2.jpg')],
    'Γαλησσάς': [wm('View of Galisas beach in Syros.jpg')],
    'Παραλία Γαλησσά': [wm('View of Galisas beach in Syros.jpg')],
    'Δελφίνι': [wm('Delfini beach Syros 1.jpg'), wm('Delfini beach Syros 3.jpg')],
    'Φοίνικας': [wm('Foinikas beach Syros 4.jpg')],
    'Κίνι': [wm('Kini beach Syros.jpg')],
    'Παραλία Βάρη': [wm('Vari beach Syros.jpg')],
  },
  kea: {
    'Κούνδουρος': [wm('Kea (Tzia) beach.jpg')],
    'Γιαλισκάρι': [wm('Gialiskari beach Kea.jpg')],
    'Οτζιάς': [wm('Otzias beach Kea.jpg')],
    'Ποίσσες': [wm('Poisses beach Kea.jpg')],
    'Ξύλα': [wm('Xyla beach Kea.jpg')],
    'Σπαθί': [wm('Spathi beach Kea.jpg')],
  },
  anafi: {
    'Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
    'Έξω Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
    'Μικρός Ρούκουνας': [wm('Roukounas Anafi.jpg'), wm('Roukounas beach.jpg')],
    'Κλεισίδι': [wm('Roukounas beach and Kalamos.jpg')],
    'Katsuni beach': [wm('Katsouni beach Anafi.jpg')],
  },
  kythnos: {
    'Παραλία Κολώνα': [wm('Kolona beach, Kythnos 2018 n2.jpg'), wm('Kythnos kolona beach.jpg')],
    'Κολώνα': [wm('Kolona beach, Kythnos 2018 n2.jpg'), wm('Kythnos kolona beach.jpg')],
    'Επισκοπή': [wm('Episkopi beach Kythnos.jpg')],
    'Απόκρουσης': [wm('Apokrousi beach Kythnos.jpg')],
    'Άγιος Σώστης': [wm('Agios Sostis beach Kythnos.jpg')],
    'Φλαμπούρια': [wm('Flabouria beach Kythnos.jpg')],
    'Γαϊδουρόμαντρα': [wm('Gaidouromantra beach Kythnos.jpg')],
  },
  kimolos: {
    'Πράσα': [wm('Kimolos Prasa beach.jpg'), wm('Prasa beach.jpg')],
    'Πράσα Άγιος Γεώργιος': [wm('Kimolos Prasa beach.jpg'), wm('Prasa beach.jpg')],
    'Ρέμα': [wm('Goupa Kimolos.jpg')],
    'Mavrospilia': [wm('Mavrospilia beach Kimolos.jpg')],
    'Μπονάτσα': [wm('Bonatsa beach Kimolos.jpg')],
    'Mponatsa': [wm('Bonatsa beach Kimolos.jpg')],
    'Ellinika': [wm('Ellinika beach Kimolos.jpg')],
    'Ψάθη': [wm('Psathi Kimolos.jpg')],
  },
  sikinos: {
    'Άγιος Γεώργιος': [wm('Alopronia, Sikinos, 247873.jpg')],
    'Άγιος Παντελεήμονας': [wm('Alopronia, Sikinos, 247874.jpg')],
    'Σαντορινέικα': [wm('Alopronia, Sikinos, 247875.jpg')],
  },
  antiparos: {
    'Σωρό': [wm('Antiparos Beach.jpg')],
    'Soros': [wm('Antiparos Beach.jpg')],
    'Faneromeni beach': [wm('Faneromeni Beach Antiparos.jpg')],
    'First Psaraliki': [wm('Psaraliki beach Antiparos.jpg')],
    'Second Psaraliki': [wm('Psaraliki beach Antiparos.jpg')],
    'Σιφνέικο': [wm('Sifneiko beach Antiparos.jpg')],
    'Paralia Sostis': [wm('Agios Sostis beach Antiparos.jpg')],
  },
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
  'gerania',
  'kapros',
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

const getAtticaAreaKey = (areaName: string | undefined): string | null => {
  if (!areaName) return null;

  const normalizedAreaName = normalizeLookup(areaName);
  if (ATTICA_AREA_ALIASES[normalizedAreaName]) {
    return ATTICA_AREA_ALIASES[normalizedAreaName];
  }

  for (const [alias, key] of Object.entries(ATTICA_AREA_ALIASES)) {
    if (normalizedAreaName.includes(alias) || alias.includes(normalizedAreaName)) {
      return key;
    }
  }

  return null;
};

const getMacedoniaAreaKey = (areaName: string | undefined): string | null => {
  if (!areaName) return null;

  const normalizedAreaName = normalizeLookup(areaName);
  if (MACEDONIA_AREA_ALIASES[normalizedAreaName]) {
    return MACEDONIA_AREA_ALIASES[normalizedAreaName];
  }

  for (const [alias, key] of Object.entries(MACEDONIA_AREA_ALIASES)) {
    if (normalizedAreaName.includes(alias) || alias.includes(normalizedAreaName)) {
      return key;
    }
  }

  return null;
};

const getCreteAreaKey = (areaName: string | undefined): string | null => {
  if (!areaName) return null;

  const normalizedAreaName = normalizeLookup(areaName);
  if (CRETE_AREA_ALIASES[normalizedAreaName]) {
    return CRETE_AREA_ALIASES[normalizedAreaName];
  }

  for (const [alias, key] of Object.entries(CRETE_AREA_ALIASES)) {
    if (normalizedAreaName.includes(alias) || alias.includes(normalizedAreaName)) {
      return key;
    }
  }

  return null;
};

const getThraceAreaKey = (areaName: string | undefined): string | null => {
  if (!areaName) return null;

  const normalizedAreaName = normalizeLookup(areaName);
  if (THRACE_AREA_ALIASES[normalizedAreaName]) {
    return THRACE_AREA_ALIASES[normalizedAreaName];
  }

  for (const [alias, key] of Object.entries(THRACE_AREA_ALIASES)) {
    if (normalizedAreaName.includes(alias) || alias.includes(normalizedAreaName)) {
      return key;
    }
  }

  return null;
};

const getNorthAegeanAreaKey = (areaName: string | undefined): string | null => {
  if (!areaName) return null;

  const normalizedAreaName = normalizeLookup(areaName);
  if (NORTH_AEGEAN_AREA_ALIASES[normalizedAreaName]) {
    return NORTH_AEGEAN_AREA_ALIASES[normalizedAreaName];
  }

  for (const [alias, key] of Object.entries(NORTH_AEGEAN_AREA_ALIASES)) {
    if (normalizedAreaName.includes(alias) || alias.includes(normalizedAreaName)) {
      return key;
    }
  }

  return null;
};

const getIonianIslandKey = (islandName: string | undefined): string | null => {
  if (!islandName) return null;

  const normalizedIslandName = normalizeLookup(islandName);
  if (IONIAN_ISLAND_ALIASES[normalizedIslandName]) {
    return IONIAN_ISLAND_ALIASES[normalizedIslandName];
  }

  for (const [alias, key] of Object.entries(IONIAN_ISLAND_ALIASES)) {
    if (normalizedIslandName.includes(alias) || alias.includes(normalizedIslandName)) {
      return key;
    }
  }

  return null;
};

const getCycladesIslandKey = (islandName: string | undefined): string | null => {
  if (!islandName) return null;

  const normalizedIslandName = normalizeLookup(islandName);
  if (CYCLADES_ISLAND_ALIASES[normalizedIslandName]) {
    return CYCLADES_ISLAND_ALIASES[normalizedIslandName];
  }

  for (const [alias, key] of Object.entries(CYCLADES_ISLAND_ALIASES)) {
    if (normalizedIslandName.includes(alias) || alias.includes(normalizedIslandName)) {
      return key;
    }
  }

  return null;
};

const findPhotos = (
  photosByName: Record<string, string[]>,
  beachNameGr: string,
  beachNameEn: string,
  count: number,
  strictAllowedKeys?: Set<string>
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
    UNVERIFIED_BEACH_PHOTO_KEYS.has(normalizedBeachNameGr) ||
    UNVERIFIED_BEACH_PHOTO_KEYS.has(normalizedBeachNameEn)
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
      return verifiedMilosPhoto?.imageUrl
        ? {
            photos: [verifiedMilosPhoto.thumbnailUrl || verifiedMilosPhoto.imageUrl],
            detailPhotos: [verifiedMilosPhoto.thumbnailUrl || verifiedMilosPhoto.imageUrl],
            source: 'exact',
            metadata: verifiedMilosPhoto,
          }
        : { photos: [], source: 'none' };
    }

    const islandBeachPhotos = CYCLADES_BEACH_PHOTOS_BY_ISLAND[cycladesIslandKey];
    const allowedKeys = cycladesIslandKey === 'milos' ? VERIFIED_MILOS_BEACH_PHOTO_KEYS : undefined;
    const beachPhotos = islandBeachPhotos ? findPhotos(islandBeachPhotos, beachNameGr, beachNameEn, count, allowedKeys) : [];
    if (beachPhotos.length) return { photos: beachPhotos, source: 'exact' };
    return { photos: [], source: 'none' };
  }

  // Do not use island cover photos as beach photos. A wrong landmark/image is
  // worse for trust than a polished placeholder.
  const ionianIslandKey = getIonianIslandKey(islandName);
  if (ionianIslandKey) {
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
