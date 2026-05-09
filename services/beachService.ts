import { Beach, WindDirection, Accessibility, BeachType, Island, LanguageCode, BeachMetadata } from '../types';

export interface RawBeach {
  id: number;
  region: string;
  prefecture: string;
  name: string;
  lat: number;
  lon: number;
  metadata?: BeachMetadata;
}

export type { Beach };

// Helper to remove quotes and trim whitespace
const clean = (str: string) => str ? str.trim().replace(/^"|"$/g, '').trim() : '';

// Helper to determine protection based on coordinates relative to island/area center
export function getAutoProt(lat: number, lon: number, centerLat: number, centerLon: number): WindDirection[] {
    const latDiff = lat - centerLat;
    const lonDiff = lon - centerLon;
    const protection: WindDirection[] = [];
    const THRESHOLD = 0.002;

    if (latDiff > THRESHOLD) { protection.push(WindDirection.S); protection.push(WindDirection.SE); protection.push(WindDirection.SW); }
    if (latDiff < -THRESHOLD) { protection.push(WindDirection.N); protection.push(WindDirection.NE); protection.push(WindDirection.NW); }
    if (lonDiff > THRESHOLD) { protection.push(WindDirection.W); protection.push(WindDirection.NW); protection.push(WindDirection.SW); }
    if (lonDiff < -THRESHOLD) { protection.push(WindDirection.E); protection.push(WindDirection.NE); protection.push(WindDirection.SE); }

    return protection.length > 0 ? protection : [WindDirection.N, WindDirection.NE, WindDirection.NW]; 
}

// Normalization mapping for Greek regions/islands to cleaner English/International names
const REGION_MAPPING: Record<string, string> = {
    'kerkyras': 'Corfu',
    'zakynthou': 'Zakynthos',
    'kefallinias': 'Kefalonia',
    'lefkadas': 'Lefkada',
    'ithakis': 'Ithaca',
    'chanion': 'Chania',
    'chanias': 'Chania',
    'rethymnis': 'Rethymno',
    'irakleiou': 'Heraklion',
    'lasithiou': 'Lasithi',
    'lesvou': 'Lesvos',
    'chiou': 'Chios',
    'samou': 'Samos',
    'evrou': 'Evros',
    'kavalas': 'Kavala',
    'chalkidikis': 'Halkidiki',
    'pierias': 'Pieria',
    'magnisias': 'Magnesia',
    'larisis': 'Larissa',
    'thesprotias': 'Thesprotia',
    'prevezis': 'Preveza',
    'artas': 'Arta',
    'argolidas': 'Argolida',
    'arkadias': 'Arkadia',
    'korinthias': 'Korinthia',
    'lakonias': 'Lakonia',
    'messinias': 'Messinia',
    'ilias': 'Ilia',
    'achaias': 'Achaia',
    'evvoias': 'Evia',
    'fokidos': 'Fokida',
    'fthiotidos': 'Fthiotida',
    'voiotias': 'Viotia',
    'xanthis': 'Xanthi',
    'rodopis': 'Rodopi',
    'attikis': 'Attica',
    'kilkis': 'Kilkis',
    'pellas': 'Pella',
    'imathias': 'Imathia',
    'serron': 'Serres',
    'dramas': 'Drama',
    'florinis': 'Florina',
    'kastorias': 'Kastoria',
    'kozanis': 'Kozani',
    'grevenon': 'Grevena',
    'thessalonikis': 'Thessaloniki',
    'aitoloakarnanias': 'Aitoloakarnania',
    'aitoloakarnania': 'Aitoloakarnania', // Handle nominative case from CSV
    'kykladon': 'Cyclades',
    'sporades': 'Sporades',
    'dodecanese': 'Dodecanese',
    'kimolos': 'Kimolos',
    'kythnos': 'Kythnos',
    'sifnos': 'Sifnos',
    'serifos': 'Serifos',
    'hydra': 'Hydra',
    'spetses': 'Spetses',
    'poros': 'Poros',
    'salamina': 'Salamina'
};

// CRITICAL: This map ensures UI displays proper Greek names for all regions loaded from CSVs.
const TRANSLATED_REGIONS: Record<string, { en: string, gr: string }> = {
    // Ionian
    'Corfu': { en: 'Corfu', gr: 'Κέρκυρα' },
    'Zakynthos': { en: 'Zakynthos', gr: 'Ζάκυνθος' },
    'Kefalonia': { en: 'Kefalonia', gr: 'Κεφαλονιά' },
    'Lefkada': { en: 'Lefkada', gr: 'Λευκάδα' },
    'Ithaca': { en: 'Ithaca', gr: 'Ιθάκη' },
    'Paxi': { en: 'Paxi', gr: 'Παξοί' },
    'Kythira': { en: 'Kythira', gr: 'Κύθηρα' },
    'Antikythira': { en: 'Antikythira', gr: 'Αντικύθηρα' },
    'Kythira & Antikythira': { en: 'Kythira & Antikythira', gr: 'Κύθηρα & Αντικύθηρα' },
    'Ionian Islands': { en: 'Ionian Islands', gr: 'Ιόνια Νησιά' },
    
    // Crete
    'Chania': { en: 'Chania', gr: 'Χανιά' },
    'Rethymno': { en: 'Rethymno', gr: 'Ρέθυμνο' },
    'Heraklion': { en: 'Heraklion', gr: 'Ηράκλειο' },
    'Lasithi': { en: 'Lasithi', gr: 'Λασίθι' }, 
    'Crete': { en: 'Crete', gr: 'Κρήτη' },
    
    // Cyclades
    'Milos': { en: 'Milos', gr: 'Μήλος' },
    'Santorini': { en: 'Santorini', gr: 'Σαντορίνη' },
    'Mykonos': { en: 'Mykonos', gr: 'Μύκονος' },
    'Paros': { en: 'Paros', gr: 'Πάρος' },
    'Naxos': { en: 'Naxos', gr: 'Νάξος' },
    'Syros': { en: 'Syros', gr: 'Σύρος' },
    'Tinos': { en: 'Tinos', gr: 'Τήνος' },
    'Andros': { en: 'Andros', gr: 'Άνδρος' },
    'Sifnos': { en: 'Sifnos', gr: 'Σίφνος' },
    'Serifos': { en: 'Serifos', gr: 'Σέριφος' },
    'Kythnos': { en: 'Kythnos', gr: 'Κύθνος' },
    'Kea': { en: 'Kea', gr: 'Κέα' },
    'Ios': { en: 'Ios', gr: 'Ίος' },
    'Amorgos': { en: 'Amorgos', gr: 'Αμοργός' },
    'Folegandros': { en: 'Folegandros', gr: 'Φολέγανδρος' },
    'Koufonisia': { en: 'Koufonisia', gr: 'Κουφονήσια' }, 
    'Donousa': { en: 'Donousa', gr: 'Δονούσα' }, 
    'Schinoussa': { en: 'Schinoussa', gr: 'Σχοινούσα' }, 
    'Iraklia': { en: 'Iraklia', gr: 'Ηρακλειά' }, 
    'Kimolos': { en: 'Kimolos', gr: 'Κίμωλος' },
    'Sikinos': { en: 'Sikinos', gr: 'Σίκινος' },
    'Anafi': { en: 'Anafi', gr: 'Ανάφη' },
    'Antiparos': { en: 'Antiparos', gr: 'Αντίπαρος' },
    'Cyclades': { en: 'Cyclades', gr: 'Κυκλάδες' },
    
    // Dodecanese
    'Rhodes': { en: 'Rhodes', gr: 'Ρόδος' },
    'Kos': { en: 'Kos', gr: 'Κως' },
    'Karpathos': { en: 'Karpathos', gr: 'Κάρπαθος' },
    'Astypalaia': { en: 'Astypalaia', gr: 'Αστυπάλαια' },
    'Patmos': { en: 'Patmos', gr: 'Πάτμος' },
    'Kalymnos': { en: 'Kalymnos', gr: 'Κάλυμνος' },
    'Leros': { en: 'Leros', gr: 'Λέρος' },
    'Symi': { en: 'Symi', gr: 'Σύμη' },
    'Lipsi': { en: 'Lipsi', gr: 'Λειψοί' },
    'Nisyros': { en: 'Nisyros', gr: 'Νίσυρος' },
    'Tilos': { en: 'Tilos', gr: 'Τήλος' },
    'Kassos': { en: 'Kassos', gr: 'Κάσος' },
    'Halki': { en: 'Halki', gr: 'Χάλκη' },
    'Dodecanese': { en: 'Dodecanese', gr: 'Δωδεκάνησα' },
    
    // Sporades
    'Skiathos': { en: 'Skiathos', gr: 'Σκιάθος' },
    'Skopelos': { en: 'Skopelos', gr: 'Σκόπελος' },
    'Alonissos': { en: 'Alonissos', gr: 'Αλόννησος' },
    'Skyros': { en: 'Skyros', gr: 'Σκύρος' },
    'Sporades': { en: 'Sporades', gr: 'Σποράδες' },
    
    // North Aegean
    'Lesvos': { en: 'Lesvos', gr: 'Λέσβος' },
    'Chios': { en: 'Chios', gr: 'Χίος' }, 
    'Samos': { en: 'Samos', gr: 'Σάμος' },
    'Ikaria': { en: 'Ikaria', gr: 'Ικαρία' },
    'Lemnos': { en: 'Lemnos', gr: 'Λήμνος' },
    'Thassos': { en: 'Thassos', gr: 'Θάσος' },
    'Samothraki': { en: 'Samothraki', gr: 'Σαμοθράκη' },
    'North Aegean': { en: 'North Aegean', gr: 'Βόρειο Αιγαίο' },
    'South Aegean': { en: 'South Aegean', gr: 'Νότιο Αιγαίο' },
    
    // Argosaronic
    'Hydra': { en: 'Hydra', gr: 'Ύδρα' }, 
    'Spetses': { en: 'Spetses', gr: 'Σπέτσες' }, 
    'Poros': { en: 'Poros', gr: 'Πόρος' }, 
    'Aegina': { en: 'Aegina', gr: 'Αίγινα' },
    'Salamina': { en: 'Salamina', gr: 'Σαλαμίνα' }, 
    'Agistri': { en: 'Agistri', gr: 'Αγκίστρι' },
    'Methana': { en: 'Methana', gr: 'Μέθανα' },
    'Saronic Islands': { en: 'Saronic Islands', gr: 'Νησιά Σαρωνικού' },
    
    // Mainland & Euboea
    'Evia': { en: 'Evia', gr: 'Εύβοια' },
    'Attica': { en: 'Attica', gr: 'Αττική' },
    'East Attica': { en: 'East Attica', gr: 'Ανατολική Αττική' },
    'West Attica': { en: 'West Attica', gr: 'Δυτική Αττική' },
    'Athens Coast': { en: 'Athens Coast', gr: 'Αθηναϊκή Ριβιέρα' },
    'Piraeus Coast': { en: 'Piraeus Coast', gr: 'Ακτές Πειραιά' },
    'Halkidiki': { en: 'Halkidiki', gr: 'Χαλκιδική' },
    'Pieria': { en: 'Pieria', gr: 'Πιερία' },
    'Kavala': { en: 'Kavala', gr: 'Καβάλα' },
    'Thessaloniki': { en: 'Thessaloniki', gr: 'Θεσσαλονίκη' },
    'Magnesia': { en: 'Magnesia', gr: 'Μαγνησία' },
    'Larissa': { en: 'Larissa', gr: 'Λάρισα' },
    'Thesprotia': { en: 'Thesprotia', gr: 'Θεσπρωτία' },
    'Preveza': { en: 'Preveza', gr: 'Πρέβεζα' },
    'Arta': { en: 'Arta', gr: 'Άρτα' },
    'Argolida': { en: 'Argolida', gr: 'Αργολίδα' },
    'Arkadia': { en: 'Arkadia', gr: 'Αρκαδία' },
    'Korinthia': { en: 'Korinthia', gr: 'Κορινθία' },
    'Lakonia': { en: 'Lakonia', gr: 'Λακωνία' },
    'Messinia': { en: 'Messinia', gr: 'Μεσσηνία' },
    'Ilia': { en: 'Ilia', gr: 'Ηλεία' },
    'Achaia': { en: 'Achaia', gr: 'Αχαΐα' },
    'Fokida': { en: 'Fokida', gr: 'Φωκίδα' },
    'Fthiotida': { en: 'Fthiotida', gr: 'Φθιώτιδα' },
    'Viotia': { en: 'Viotia', gr: 'Βοιωτία' },
    'Xanthi': { en: 'Xanthi', gr: 'Ξάνθη' },
    'Rodopi': { en: 'Rodopi', gr: 'Ροδόπη' },
    'Evros': { en: 'Evros', gr: 'Έβρος' },
    'Kilkis': { en: 'Kilkis', gr: 'Κιλκίς' },
    'Pella': { en: 'Pella', gr: 'Πέλλα' },
    'Imathia': { en: 'Imathia', gr: 'Ημαθία' },
    'Serres': { en: 'Serres', gr: 'Σέρρες' },
    'Drama': { en: 'Drama', gr: 'Δράμα' },
    'Florina': { en: 'Florina', gr: 'Φλώρινα' },
    'Kastoria': { en: 'Kastoria', gr: 'Καστοριά' },
    'Kozani': { en: 'Kozani', gr: 'Κοζάνη' },
    'Grevena': { en: 'Grevena', gr: 'Γρεβενά' },
    'Aitoloakarnania': { en: 'Aitoloakarnania', gr: 'Αιτωλοακαρνανία' },
    
    // Area labels from greek_beaches.json (mainland/special area variants)
    'Achaia (mainland)': { en: 'Achaia', gr: 'Αχαΐα' },
    'Aetolia-Acarnania (mainland)': { en: 'Aetolia-Acarnania', gr: 'Αιτωλοακαρνανία' },
    'Agathonisi': { en: 'Agathonisi', gr: 'Αγαθονήσι' },
    'Agios Efstratios': { en: 'Agios Efstratios', gr: 'Άγιος Ευστράτιος' },
    'Argolida (mainland)': { en: 'Argolida', gr: 'Αργολίδα' },
    'Arkadia (mainland)': { en: 'Arkadia', gr: 'Αρκαδία' },
    'Arta (mainland)': { en: 'Arta', gr: 'Άρτα' },
    'Athens area (mainland)': { en: 'Athens area', gr: 'Περιοχή Αθηνών' },
    'Crete (Chania)': { en: 'Chania', gr: 'Χανιά' },
    'Crete (Heraklion)': { en: 'Heraklion', gr: 'Ηράκλειο' },
    'Crete (Rethymno)': { en: 'Rethymno', gr: 'Ρέθυμνο' },
    'Crete (Lasithi)': { en: 'Lasithi', gr: 'Λασίθι' },
    'East Attica (mainland)': { en: 'East Attica', gr: 'Ανατολική Αττική' },
    'Evros (mainland)': { en: 'Evros', gr: 'Έβρος' },
    'Fokida (mainland)': { en: 'Fokida', gr: 'Φωκίδα' },
    'Fthiotida (mainland)': { en: 'Fthiotida', gr: 'Φθιώτιδα' },
    'Halkidiki (mainland)': { en: 'Halkidiki', gr: 'Χαλκιδική' },
    'Ileia (mainland)': { en: 'Ileia', gr: 'Ηλεία' },
    'Kastellorizo': { en: 'Kastellorizo', gr: 'Καστελλόριζο' },
    'Kastoria (mainland)': { en: 'Kastoria', gr: 'Καστοριά' },
    'Kavala (mainland)': { en: 'Kavala', gr: 'Καβάλα' },
    'Kasos': { en: 'Kasos', gr: 'Κάσος' },
    'Kilkis (mainland)': { en: 'Kilkis', gr: 'Κιλκίς' },
    'Korinthia (mainland)': { en: 'Korinthia', gr: 'Κορινθία' },
    'Lakonia (mainland)': { en: 'Lakonia', gr: 'Λακωνία' },
    'Larissa Coast (Agia - Kissavos)': { en: 'Larissa Coast (Agia - Kissavos)', gr: 'Παράλια Λάρισας (Αγιά - Κίσσαβος)' },
    'Magnesia (mainland - Pelion)': { en: 'Magnesia (Pelion)', gr: 'Μαγνησία (Πήλιο)' },
    'Marathi': { en: 'Marathi', gr: 'Μαράθι' },
    'Mathraki': { en: 'Mathraki', gr: 'Μαθράκι' },
    'Meganisi': { en: 'Meganisi', gr: 'Μεγανήσι' },
    'Messinia (mainland)': { en: 'Messinia', gr: 'Μεσσηνία' },
    'Oinousses': { en: 'Oinousses', gr: 'Οινούσσες' },
    'Othonoi': { en: 'Othonoi', gr: 'Οθωνοί' },
    'Paxos': { en: 'Paxos', gr: 'Παξοί' },
    'Pieria (mainland)': { en: 'Pieria', gr: 'Πιερία' },
    'Piraeus area': { en: 'Piraeus area', gr: 'Περιοχή Πειραιά' },
    'Preveza (mainland)': { en: 'Preveza', gr: 'Πρέβεζα' },
    'Pserimos': { en: 'Pserimos', gr: 'Ψέριμος' },
    'Psara': { en: 'Psara', gr: 'Ψαρά' },
    'Rodopi (mainland)': { en: 'Rodopi', gr: 'Ροδόπη' },
    'Telendos': { en: 'Telendos', gr: 'Τέλενδος' },
    'Thasos': { en: 'Thasos', gr: 'Θάσος' },
    'Antipaxos': { en: 'Antipaxos', gr: 'Αντίπαξοι' },
    'Arki': { en: 'Arki', gr: 'Αρκοί' },
    'Erikoussa': { en: 'Erikoussa', gr: 'Ερείκουσσα' },
    'Fournoi': { en: 'Fournoi', gr: 'Φούρνοι' },
    'Gavdos': { en: 'Gavdos', gr: 'Γαύδος' },
    'Thesprotia (mainland)': { en: 'Thesprotia', gr: 'Θεσπρωτία' },
    'Thessaloniki area': { en: 'Thessaloniki area', gr: 'Περιοχή Θεσσαλονίκης' },
    'Viotia (mainland)': { en: 'Viotia', gr: 'Βοιωτία' },
    'West Attica (mainland)': { en: 'West Attica', gr: 'Δυτική Αττική' },
    'Xanthi (mainland)': { en: 'Xanthi', gr: 'Ξάνθη' },

    // Broad Regions
    'West Greece': { en: 'West Greece', gr: 'Δυτική Ελλάδα' },
    'Central Greece': { en: 'Central Greece', gr: 'Στερεά Ελλάδα' },
    'Thessaly': { en: 'Thessaly', gr: 'Θεσσαλία' },
    'Epirus': { en: 'Epirus', gr: 'Ήπειρος' },
    'Peloponnese': { en: 'Peloponnese', gr: 'Πελοπόννησος' },
    'East Macedonia and Thrace': { en: 'East Macedonia & Thrace', gr: 'Ανατολική Μακεδονία & Θράκη' }
};

export const getRegionTranslation = (name: string) => {
    if (TRANSLATED_REGIONS[name]) return TRANSLATED_REGIONS[name];
    // Default fallback
    return { en: name, gr: name };
};

const normalizeRegionName = (rawName: string): string => {
    let name = clean(rawName);

    // 0. Handle specific Attica administrative names to be more user-friendly
    if (name === 'Nomarchia Anatolikis Attikis') return 'East Attica';
    if (name === 'Nomarchia Dytikis Attikis') return 'West Attica';
    if (name === 'Nomarchia Athinas') return 'Athens Coast';
    if (name === 'Nomos Attikis') return 'Piraeus Coast';
    // Nomos Piraios typically contains islands + coastal areas, so we handle it carefully or let it default to Saronic if not split
    if (name === 'Nomos Piraios') return 'Saronic Islands';

    // 1. Explicit overrides for known duplicate/messy names
    if (name.includes('Adamas (Milos)') || name.includes('(Milos)')) return 'Milos';
    if (name.includes('Ano Mera (Mykonos)') || name.includes('(Mykonos)')) return 'Mykonos';
    if (name.includes('Ano Syros (Syros)') || name.includes('(Syros)')) return 'Syros';
    if (name.includes('Santorini') || name.includes('Thira')) return 'Santorini';
    
    // 2. Handle cases where we want the name OUTSIDE parenthesis (e.g. "Alonissos (Sporades)")
    // If the part in parens is a Group (Sporades, Cyclades etc), we keep the first part.
    if (name.includes('(Sporades)')) return name.replace('(Sporades)', '').trim();
    if (name.includes('(Dodecanese)')) return name.replace('(Dodecanese)', '').trim();
    if (name.includes('(Cyclades)')) return name.replace('(Cyclades)', '').trim();

    // 3. Handle cases where we want the name INSIDE parenthesis (e.g. "Nomos Kykladon (Sifnos)")
    // This usually applies when the prefix is administrative.
    if (name.includes('(Kimolos)')) return 'Kimolos';
    if (name.includes('(Kythnos)')) return 'Kythnos';
    if (name.includes('(Sifnos)')) return 'Sifnos';
    if (name.includes('(Serifos)')) return 'Serifos';
    if (name.includes('(Hydra)')) return 'Hydra';
    if (name.includes('(Spetses)')) return 'Spetses';
    if (name.includes('(Poros)')) return 'Poros';
    if (name.includes('(Salamina)')) return 'Salamina';
    if (name.includes('(Tzia)')) return 'Kea'; // Kea (Tzia)

    // 4. General parenthesis extraction for "Nomos X (Island)" pattern
    const parenMatch = name.match(/\((.*?)\)/);
    if (parenMatch && parenMatch[1].length > 2) {
         // Only if the start looks like an administrative division
         if (name.startsWith('Nomos') || name.startsWith('Nomarchia') || name.startsWith('Dimos')) {
             return parenMatch[1];
         }
    }

    // 5. Remove Administrative prefixes
    name = name.replace(/^Nomos\s+/i, '')
               .replace(/^Nomarchia\s+/i, '')
               .replace(/^Dimos\s+/i, '')
               .replace(/\s+Region$/i, '');

    // 6. Apply Mapping for Genitive/Greeklish cases
    const lowerName = name.toLowerCase();
    if (REGION_MAPPING[lowerName]) {
        return REGION_MAPPING[lowerName];
    }

    return name;
};

const normalizeAtticaSubArea = (
    normalizedPrefecture: string,
    rawPrefecture: string,
    lat: number,
    lon: number
): string => {
    // Voula, Vouliagmeni, Limanakia and Varkiza are part of the Athens coastal area,
    // even when the raw source labels them as East Attica.
    if (
        rawPrefecture === 'Nomarchia Anatolikis Attikis' &&
        lat >= 37.77 && lat <= 37.84 &&
        lon >= 23.76 && lon <= 23.82
    ) {
        return 'Athens Coast';
    }

    // A few mainland Piraeus beaches arrive under the broader old Piraeus label,
    // which otherwise mostly contains Saronic islands and Kythira.
    if (
        rawPrefecture === 'Nomos Piraios' &&
        lat >= 37.92 && lat <= 37.98 &&
        lon >= 23.54 && lon <= 23.66
    ) {
        return 'Piraeus Coast';
    }

    return normalizedPrefecture;
};

// --- Transliteration Logic for Greeklish Beach Names ---

// ENGLISH WORDS TO KEEP (Do not transliterate these)
const ENGLISH_WORDS = new Set([
    'blue', 'green', 'red', 'white', 'golden',
    'paradise', 'dream', 'coast', 'bay', 'port', 'lake', 'island', 'grand', 'royal', 'palace',
    'suites', 'spa', 'village', 'bungalows', 'apartments', 'studios', 'rooms', 'view', 'sea',
    'ocean', 'sunset', 'sunrise', 'moon', 'star', 'sun', 'sky', 'sand', 'pebble', 'rock',
    'cove', 'harbour', 'marina', 'yacht', 'diving', 'surf', 'kite', 'wind', 'water', 'sport',
    'cafe', 'restaurant', 'taverna', 'grill', 'fish', 'house', 'home', 'villa', 'mansion',
    'castle', 'tower', 'bridge', 'church', 'chapel', 'monastery', 'saint', 'holy', 'cross',
    'banana', 'super', 'fkk', 'nudist', 'naturist', 'love', 'canal', 'amour', 'lagoon', 'cave',
    'hidden', 'secret', 'wild', 'east', 'west', 'north', 'south', 'central', 'old', 'new',
    'big', 'small', 'little', 'great', 'long', 'short', 'high', 'low', 'upper', 'lower', 'city',
    'town', 'capital', 'port', 'airport', 'ferry', 'bus', 'station', 'stop', 'road', 'street',
    'avenue', 'square', 'park', 'garden', 'forest', 'mountain', 'hill', 'valley', 'river',
    'sandy', 'pebbles', 'rocky', 'deep', 'shallow', 'clear', 'crystal', 'turquoise', 'emerald',
    'sweet', 'corner', 'favela', 'baba', 'navagio', 'mango', 'jazz', 'veranda', 'salty', 'wave',
    'la', 'costa', 'brounou', 'biancoblusarti', 'totos', 'sahara', 'haven', 'friend', 'tosca',
    'bomo', 'ilio', 'mare', 'scala', 'yacht', 'mystique', 'katharina', 'koutsouri', 'angeletou',
    'perivoliou', 'psarochoma', 'glisteri', 'kastani', 'limnonari', 'loutraki', 'milia', 'panormos',
    'adrina', 'agnontas', 'elios', 'ftelia', 'neraki', 'sares', 'spilia', 'stafilos', 'velanio',
    'atherina', 'gyrismata', 'kareflou', 'palamari', 'pefkos', 'magazia', 'molos', 'acherounes',
    'karathona', 'tolo', 'arvanitia', 'kondyli', 'vivari', 'plaka', 'drepano', 'iria', 'salanti',
    'lepitsa', 'kosta', 'cheli', 'ermioni', 'astros', 'tyros', 'sampatiki', 'livadi', 'fokiano',
    'poulithra', 'kalogria', 'gianiskari', 'lakopetra', 'niforeika', 'alykes', 'akrata', 'diakopto',
    'loggos', 'selianitika', 'psathopyrgos', 'kourouta', 'zacharo', 'kaiafas', 'arkoudi', 'loutra',
    'kyllinis', 'katakolo', 'skafidia', 'vrahati', 'kiato', 'xylokastro', 'sykia',
    'melissi', 'derveni', 'simos', 'elafonisos', 'panagia', 'mavrovouni', 'vathi', 'skoutari',
    'kotronas', 'alypa', 'gerolimenas', 'marmari', 'kagio', 'archangelos', 'pry', 'voidokilia',
    'romanos', 'finikounda', 'methoni', 'koroni', 'peroulia', 'kalamata', 'stoupa', 'foneas',
    'kardamyli', 'kitries', 'lagouvardos', 'louros', 'tourlida', 'kryoneri', 'kato', 'vasiliki',
    'nafpaktos', 'psani', 'gribovo', 'monastiraki', 'chiliadou', 'skroponeria', 'eresos', 'vatera',
    'petra', 'anaxos', 'molyvos', 'eftalou', 'tarti', 'isidoros', 'plomari', 'sigri', 'tsamadou',
    'lemonakia', 'kokkari', 'potami', 'megalo', 'seitani', 'mikro', 'psili', 'ammos', 'mykali',
    'pythagoreio', 'ireon', 'votsalakia', 'platy', 'thanos', 'keros', 'gomati', 'ioannis',
    'riha', 'nera', 'romeikos', 'gialos', 'seychelles', 'nas', 'mesakti', 'armenistis',
    'faros', 'elli', 'faliraki', 'anthony', 'quinn', 'ladiko', 'afandou', 'tsambika', 'stegna',
    'agathi', 'lindos', 'paul', 'pefki', 'glyceria', 'prasonisi', 'fourni', 'ialysos', 'ixia',
    'tigaki', 'mastichari', 'kefalos', 'stefanos', 'camel', 'therma',
    'lambi', 'apella', 'kyra', 'panagia', 'achata', 'lefkos', 'amoopi', 'diakoftis', 'michaliou',
    'kipos', 'pera', 'maltezana', 'steno', 'kaminakia', 'vatses'
]);

// Words that signal a brand/business name — if any of these appear, keep the whole name in English
const BRAND_SIGNAL_WORDS = new Set([
    'the', 'a', 'an', 'of', 'and', 'or', 'by', 'at', 'in', 'on', 'for', 'to', 'with', 'from',
    'project', 'concept', 'lounge', 'club', 'bar', 'experience', 'boutique', 'luxury',
    'resort', 'hotel', 'inn', 'lodge', 'suite', 'collection', 'living', 'life', 'style',
    'premium', 'exclusive', 'private', 'elite', 'select', 'prime', 'plus', 'pro',
]);

/**
 * Detects if a name is a brand/business name that should NOT be transliterated.
 * Returns true if the name should be kept as-is in English.
 */
const isBrandName = (cleaned: string): boolean => {
    const words = cleaned.split(/\s+/).map(w => w.replace(/[.,()]/g, '').toLowerCase());
    if (words.length === 0) return false;

    // If name contains brand signal words (articles, business terms), keep as English
    if (words.some(w => BRAND_SIGNAL_WORDS.has(w))) return true;

    // If name contains dashes/hyphens separating words (like "Balux - The House Project"), it's likely a brand
    if (cleaned.includes(' - ') || cleaned.includes(' & ')) return true;

    // If most words (>50%) are known English words, keep as English
    const englishCount = words.filter(w => ENGLISH_WORDS.has(w) || BRAND_SIGNAL_WORDS.has(w)).length;
    if (words.length >= 2 && englishCount / words.length > 0.5) return true;

    return false;
};

const transliterationMap: Record<string, string> = {
    'a': 'α', 'b': 'μπ', 'c': 'κ', 'd': 'ντ', 'e': 'ε', 'f': 'φ', 'g': 'γ', 'h': 'χ', 'i': 'ι',
    'j': 'τζ', 'k': 'κ', 'l': 'λ', 'm': 'μ', 'n': 'ν', 'o': 'ο', 'p': 'π', 'q': 'κ', 'r': 'ρ',
    's': 'σ', 't': 'τ', 'u': 'ου', 'v': 'β', 'w': 'ου', 'x': 'ξ', 'y': 'υ', 'z': 'ζ',
    'th': 'θ', 'ch': 'χ', 'ps': 'ψ', 'ks': 'ξ', 'ph': 'φ', 'ou': 'ου', 'sh': 'σ'
};

const suffixes = [
    'Beach Bar', 'Beach Club', 'Beach', 'Bar', 'Club', 'Resort', 'Hotel', 'Camping', 'Canteen', 'Kantina', 'Taverna', 'Studios', 'Suites', 'Apartments', 'Villas',
    'Παραλία', 'Paralia', 'Akti', 'Ακτή', 'Ormos', 'Όρμος', 'Plaz', 'Πλαζ'
];
const prefixes = [
    'Παραλία', 'Paralia', 'Akti', 'Ακτή', 'Ormos', 'Όρμος', 'Beach', 'Plaz', 'Πλαζ'
];

// Sort to match longest first (e.g. "Beach Bar" before "Beach")
suffixes.sort((a, b) => b.length - a.length);
prefixes.sort((a, b) => b.length - a.length);

// Allow comma, dash, space before suffix
const suffixRegex = new RegExp(`[,\\s-]+(${suffixes.join('|')})$`, 'i');
const prefixRegex = new RegExp(`^(${prefixes.join('|')})\\s+`, 'i');

const cleanBeachName = (name: string): string => {
    let cleaned = name.trim();
    let previous;
    do {
        previous = cleaned;
        // Clean prefixes
        cleaned = cleaned.replace(prefixRegex, '').trim();
        // Clean suffixes
        cleaned = cleaned.replace(suffixRegex, '').trim();
        // Clean specific commercial patterns often found in middle (e.g. "Riviera Beach Bar")
        // If the resulting string ends with " Beach Bar" etc again, the loop will catch it.
    } while (cleaned !== previous && cleaned.length > 0);
    
    // Explicit removal of commercial terms if they remain (case insensitive)
    const commercialTerms = ['Beach Bar', 'Beach Club', 'Hotel', 'Resort', 'Camping', 'Canteen', 'Kantina'];
    commercialTerms.forEach(term => {
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        cleaned = cleaned.replace(regex, '').trim();
    });

    // Cleanup punctuation left over
    cleaned = cleaned.replace(/^[,.\-\s]+|[,.\-\s]+$/g, '');

    // If we cleaned everything away (e.g. name was just "Beach Bar"), keep original or handle gracefully
    return cleaned.length > 0 ? cleaned : name;
};

const transliterateWord = (word: string): string => {
    // If it's an English word we want to keep, return as is
    if (ENGLISH_WORDS.has(word.toLowerCase())) return word;
    
    // If it already contains Greek characters, assume it's fine
    if (/[α-ωΑ-Ω]/.test(word)) return word;

    let res = word.toLowerCase();
    
    // Apply multi-char replacements first
    for (const [key, val] of Object.entries(transliterationMap)) {
        if (key.length > 1) {
            res = res.split(key).join(val);
        }
    }
    // Apply single-char replacements
    for (const [key, val] of Object.entries(transliterationMap)) {
        if (key.length === 1) {
            res = res.split(key).join(val);
        }
    }
    
    // Capitalize first letter
    return res.charAt(0).toUpperCase() + res.slice(1);
};

const transliterateToGreek = (text: string): string => {
    // Clean unwanted prefixes/suffixes first (like "Paralia")
    let cleaned = cleanBeachName(text);

    // If the name is a brand/business name, keep it entirely in English
    if (isBrandName(cleaned)) return cleaned;

    const parts = cleaned.split(/\s+/);
    const translatedParts = parts.map(part => {
        // Remove punctuation for checking but keep for result
        const core = part.replace(/[.,()]/g, '');
        // If it's a known English word, keep the original casing
        if (ENGLISH_WORDS.has(core.toLowerCase())) return part;

        // Otherwise transliterate
        const prefix = part.match(/^[.,()]+/) ? part.match(/^[.,()]+/)![0] : '';
        const suffix = part.match(/[.,()]+$/) ? part.match(/[.,()]+$/)![0] : '';
        const trans = transliterateWord(core);

        return prefix + trans + suffix;
    });

    return translatedParts.join(' ');
};

/**
 * Converts Greek text to readable Greeklish for display (e.g. "Παραλία Σαρακίνικο" → "Paralia Sarakiniko")
 * If the text is already Latin, returns it as-is.
 */
const GREEKLISH_DIGRAPHS: [string, string][] = [
    ['μπ', 'b'], ['ντ', 'nt'], ['γκ', 'gk'], ['γγ', 'ng'],
    ['τσ', 'ts'], ['τζ', 'tz'],
    ['ου', 'ou'], ['αι', 'ai'], ['ει', 'ei'], ['οι', 'oi'],
    ['αυ', 'av'], ['ευ', 'ev'],
];
const GREEKLISH_SINGLE: Record<string, string> = {
    'α': 'a', 'ά': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'έ': 'e',
    'ζ': 'z', 'η': 'i', 'ή': 'i', 'θ': 'th', 'ι': 'i', 'ί': 'i', 'ϊ': 'i', 'ΐ': 'i',
    'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'ό': 'o',
    'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't',
    'υ': 'y', 'ύ': 'y', 'ϋ': 'y', 'ΰ': 'y',
    'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o', 'ώ': 'o',
};

const greeklishWord = (word: string): string => {
    // If no Greek characters, return as-is
    if (!/[α-ωΑ-Ωά-ώ]/.test(word)) return word;

    let result = word.toLowerCase();

    // Apply digraphs first (longer sequences)
    for (const [gr, lat] of GREEKLISH_DIGRAPHS) {
        result = result.split(gr).join(lat);
    }
    // Apply single characters
    let out = '';
    for (const ch of result) {
        out += GREEKLISH_SINGLE[ch] ?? ch;
    }

    // Capitalize first letter
    return out.charAt(0).toUpperCase() + out.slice(1);
};

export const toGreeklish = (text: string): string => {
    // If text has no Greek characters at all, return as-is
    if (!/[α-ωΑ-Ωά-ώ]/.test(text)) return text;

    return text.split(/\s+/).map(greeklishWord).join(' ');
};

// --- DATA CLEANING HELPERS ---

const applyManualCorrections = (name: string, prefecture: string, region: string): string | null => {
    // Exact matches from PDF report (Attica & others)
    
    // Deletions
    if (name === 'Ktima 48') return null;
    if (name === 'Lagonissi Grand Resort') return null;

    // Renames (CorrectionStatus: needs_review -> Apply clean name)
    // Extensive mapping of business names to proper geographical beach names
    
    // --- WEST ATTICA & CORINTH ---
    if (name === 'La Isla' || name === 'LA ISLA') return null; // Schinos is outside Attica/West Attica
    
    // --- ATTICA ---
    if (name === 'Beach Vravrona') return 'Παραλία Βραυρώνας';
    if (name === 'DIVERS BEACH') return 'Παραλία Ζούμπερι (Νέα Μάκρη)';
    if (name === 'FKK Beach') return 'Όρμος Αγ. Νικολάου';
    if (name === 'Kaki Thalassa Beach') return 'Παραλία Κακή Θάλασσα';
    if (name === 'LA COSTA') return 'Παραλία Ζούμπερι (Νέα Μάκρη)';
    if (name === 'Legrena') return 'Παραλία Λεγραινών';
    if (name === 'Nudist Beach Not Official') return 'Λιμανάκια';
    if (name === 'Riviera,Beach Bar' || name === 'Riviera') return 'Παραλία Αρτέμιδας (Λούτσα)';
    if (name === 'Rusty Cannon') return 'Παραλία Σχινιά (Μαραθώνας)';
    if (name === 'Salty Wave beach') return 'Παραλία Σχινιά (Μαραθώνας)';
    if (name === 'Sounion Beach') return 'Παραλία Σουνίου';
    if (name === 'Unofficial Nudist Beach') return 'Λιμανάκια Βουλιαγμένης';
    if (name === 'Yabanaki' || name === 'Yabanaki Beach') return 'Παραλία Βάρκιζας';
    if (name === 'cocoloco') return 'Παραλία Κοκολόκο (Δασκαλιό, Κερατέα)';
    if (name === '´Ορμος Ληδάκι') return 'Όρμος Ληδάκι';
    if (name === 'ChampioN Beach bar') return 'Παραλία Σχινιά';
    if (name === 'Coralli') return 'Παραλία Κορακιάς';
    if (name === 'Jacopo') return 'Παραλία Τερψιθέας';
    if (name === 'Kick Off') return 'Παραλία Κορακιάς';
    if (name === 'Seaman Shelter') return 'Seaman Shelter'; 
    if (name === 'Epsom Village') return 'Παραλία Λιμανάκι';
    if (name === 'Medusa') return 'Παραλία Λιμανάκι';
    if (name === 'Ulysses Beach Bar') return 'Παραλία Σχινιά';
    if (name === 'Κepsalinis' || name === 'Kepsalinis') return 'Παραλία Δασός';
    if (name === 'Sandani') return 'Παραλία Σαρωνίδα';
    if (name === 'Neat Beach' || name === 'NEAT BEACH') return 'Παραλία Βραυρώνα';
    if (name === 'Dilek Beach' || name === 'DILEK') return 'Παραλία Δασός';
    if (name === 'Olympos Beach Club') return 'Παραλία Δασός';
    if (name === 'Barbati') return 'Παραλία Βαρκάτη';
    if (name === 'Myrnis Bay Beach') return 'Παραλία Αγγίζια';
    if (name === 'BATTLEFIELD Beach') return 'Παραλία Αγγίζια';
    if (name === 'SUNJOHRIYA BEACH CLUB') return 'Παραλία Μπαλάνα';
    if (name === 'Βυθός') return 'Παραλία Βυθός';
    if (name === 'Castello') return 'Παραλία Καστέλος';
    if (name === 'ANEMOS BEACH') return 'Παραλία Πευκοχώρια';
    if (name === 'ZAMPA\'S BEACH') return 'Παραλία Πευκοχώρια';
    if (name === 'Afroessa') return 'Παραλία Αφροέσας';
    if (name === 'BLUE WATER BEACH') return 'Παραλία Σχινιά';
    if (name === 'SACC0 DIVE' || name === 'Sacco dive') return 'Παραλία Σάκκου';
    if (name === 'COFFEE ISLAND') return 'Παραλία Άγιος Κωνσταντίνος';
    if (name === 'Marine Club') return 'Παραλία Σχινιά';
    if (name === 'White Beach' && prefecture === 'Attica') return 'Παραλία Σχινιά';
    if (name === 'Il maestrale') return 'Παραλία Σχινιά';
    if (name === 'ILMARE') return 'Παραλία Σχινιά';
    if (name === 'Airius') return 'Παραλία Αρμενιστής';
    if (name === 'Ω2 X1 Πλαζ') return 'Παραλία Βουλιαγμένης';
    if (name === 'NAUTICA BEACH CLUB') return 'Παραλία Καλλιθέας';
    if (name === 'Hatzikyriacou Beach') return 'Παραλία Μακρύγιου';
    if (name === 'Ali-Ali Beach') return 'Παραλία Αγίου Κωνσταντίνου';
    if (name === 'Δασκάλα') return 'Παραλία Λιμανάκι';
    if (name === 'Βάρκεττα') return 'Παραλία Βαρκάτη';
    if (name === 'Salt Water Beach Bar') return 'Παραλία Σχινιά';
    if (name === 'Jungle Party') return 'Παραλία Μακρύγιου';
    if (name === 'MarDa / POu') return 'Παραλία Αχλαδούλα';
    if (name === 'Spike') return 'Παραλία Λιβαδάκι';
    if (name === 'B3 Beach') return 'Παραλία Σχινιά';
    if (name === 'Jungle-Saxon Beach') return 'Παραλία Μακρύγιου';
    if (name === 'Coni') return 'Παραλία Μακρύγιου';
    if (name === 'Nautilus Naxos') return 'Παραλία Αχινού';
    if (name === 'Lila\'s Pier') return 'Παραλία Αγίου Κωνσταντίνου';
    if (name === 'Michael\'s Beach') return 'Παραλία Αχλαδούλα';
    if (name === 'Alcesten') return 'Παραλία Χρυσή Ακτή';
    if (name === 'Alkiona') return 'Παραλία Αγίου Προκοπίου';
    if (name === 'Alioli') return 'Παραλία Αγίου Γεωργίου';
    if (name === 'Albatross') return 'Παραλία Αγίου Προκοπίου';
    if (name === 'Xenos') return 'Παραλία Αγίου Γεωργίου';
    if (name.toLowerCase().includes('bolivar')) return 'Ακτή του Ήλιου (Άλιμος)';
    if (name.toLowerCase().includes('balux')) return 'Παραλία Αστέρας Γλυφάδας';
    if (name.toLowerCase().includes('varkiza resort')) return 'Παραλία Βάρκιζας';
    if (name.toLowerCase().includes('holy spirit')) return 'Παραλία Βάρκιζας';
    if (name.toLowerCase().includes('indianos')) return 'Παραλία Ζούμπερι';
    if (name.toLowerCase().includes('alcatraz')) return 'Παραλία Αρτέμιδας (Λούτσα)';
    if (name.toLowerCase().includes('nissakia')) return 'Παραλία Αρτέμιδας (Λούτσα)';
    if (name.toLowerCase().includes('mojito bay')) return 'Παραλία Λομβάρδας';
    if (name.toLowerCase().includes('moraitis')) return 'Παραλία Σχινιά';
    if (name.toLowerCase().includes('karavi')) return 'Παραλία Σχινιά';
    if (name.toLowerCase().includes('schinias bay')) return 'Παραλία Σχινιά';

    // --- THESSALONIKI ---
    if (prefecture === 'Thessaloniki') {
        if (name === 'BABA' || name === 'Navagio' || name === 'Nautiko Omilos' || name.toLowerCase().includes('kyma')) return 'Παραλία Ποταμός (Επανομή)';
        if (name === 'Favela') return 'Παραλία Ασπροβάλτα';
        if (name === 'Sweet Corner') return 'Παραλία Ασπροβάλτα';
    }

    // --- LARISSA ---
    if (prefecture === 'Larissa' || name === 'Mare') return 'Παραλία Αγιόκαμπος';

    // --- MAGNESIA & SPORADES ---
    if (name === 'Koropi Beach') return 'Παραλία Κορώπη';
    if (name === 'Olive Bay') return 'Παραλία Ελιά';
    if (name.includes('πεсчаный пляж') && region.includes('Alonissos')) return 'Παραλία Χρυσή Μηλιά';
    if (name === 'Strand' && region.includes('Alonissos')) return null;

    // --- KAVALA & THASSOS ---
    if (name === 'Bomo Tosca Beach') return 'Παραλία Τόσκα';
    if (name === 'Friend') return 'Παραλία Παλιό';
    if (name === 'La Scala') return 'Παραλία Γλυφάδα (Θάσος)';
    if (name === 'Ilio Mare') return 'Παραλία Σκάλα Πρίνου';
    if (name.includes('Karavouzi')) return null;
    if (name.includes('Vranas Resort')) return 'Παραλία Οφρυνίου';

    // --- PREVEZA ---
    if (name.includes('Mango Beach Bar')) return 'Παραλία Μονολίθι';
    if (name.includes('Nicopolis Club')) return 'Παραλία Μονολίθι';
    if (name.includes('Strand Hotel Katerina')) return 'Παραλία Καστροσυκιά';

    // --- CORFU & PAXOS ---
    if (name === 'Acquasanta') return 'Παραλία Αρίλλας';
    if (name === "Ben's Bar") return 'Παραλία Μονοδένδρι (Παξοί)';
    if (name === 'Capo di Corfu') return 'Παραλία Άγιος Πέτρος (Λευκίμμη)';
    if (name === 'ILIOS Strandliegen') return 'Παραλία Άγιος Γεώργιος Πάγων';

    // --- KEFALONIA ---
    if (name === 'Metaxa Beach Club') return 'Παραλία Σκάλα';
    if (name === 'Central Square Beach') return 'Παραλία Σκάλα';
    if (name === 'Cronidis Beach') return 'Παραλία Σκάλα';
    if (name.toLowerCase().includes('avithos south')) return 'Παραλία Άβυθος (Νότια)';

    // --- ZAKYNTHOS ---
    if (name === 'Kaliva Residence') return 'Παραλία Καλαμάκι';
    if (name === 'St. Nicholas Beach') return 'Παραλία Αγίου Νικολάου (Βασιλικός)';

    // --- EVROS ---
    if (prefecture === 'Evros' || region === 'East Macedonia and Thrace') {
        if (name.toLowerCase().includes('bikini beach')) return 'Παραλία Μάκρης';
        if (name.toLowerCase().includes('janeiro')) return 'Παραλία Μάκρης';
        if (name.toLowerCase().includes('cavo')) return 'Παραλία Μάκρης';
        if (name.toLowerCase().includes('santa rosa')) return 'Παραλία Αλεξανδρούπολης';
    }

    // --- HALKIDIKI ---
    if (prefecture === 'Halkidiki' || region === 'Nomos Chalkidikis') {
        if (name === 'Achlada') return 'Παραλία Αχλάδα';
        if (name === 'Agora Beach Bar') return 'Παραλία Κρυοπηγής';
        if (name === 'Beach Bar') return null; // Too generic, remove
        if (name === 'Biancoblusarti') return 'Παραλία Σάρτης';
        if (name === 'Babylon') return null;
        if (name === 'Goa') return 'Παραλία Γκόα (Σάρτη)';
        if (name === 'Ikos Olivia') return 'Παραλία Γερακινής (Χαλκιδική)';
        if (name === 'Istion Club') return 'Παραλία Νέας Ποτίδαιας (Χαλκιδική)';
        if (name === 'Mount Athos Resort') return 'Παραλία Ιερισσού (Χαλκιδική)';
        if (name === 'Pomegranate') return 'Παραλία Νέας Ποτίδαιας (Χαλκιδική)';
        if (name === 'Sahara') return 'Παραλία Γεωπονικά (Καλλικράτεια) (“Σαχάρα”)';
        if (name === 'Totos') return 'Παραλία Ολυμπιάδα';
        if (name === 'Navagos') return 'Παραλία Παλιούρι';
        if (name === 'Lefki Ammos') return 'Παραλία Ξενία (Παλιούρι)';
    }

    // --- CYCLADES ---
    if (name.includes('Kampos Beach Bar')) return 'Παραλία Βιτάλι';
    if (name === 'Sentu Mykonos') return 'Παραλία Καλό Λιβάδι';
    if (name === 'Claudio') return 'Παραλία Γαλησσάς';
    if (name === 'Tango Mar') return 'Παραλία Λιβάδια';
    if (name === 'MARTSELO BEACH') return 'Παραλία Μαρτσέλο';
    if (name.includes('Teologos')) return 'Παραλία Θεολόγος';

    return name;
};

// --- ACCESSIBILITY HELPER ---

// Updated to satisfy the request: Dirt Road = DIFFICULT
const ACCESSIBILITY_OVERRIDES: Record<string, Accessibility> = {
    // --- EUBOEA (Dirt Roads) ---
    'Thapsa': Accessibility.DIFFICULT, // Famous difficult dirt road
    'Tsilaros': Accessibility.DIFFICULT,
    'Vythouri': Accessibility.DIFFICULT,
    'Petali': Accessibility.DIFFICULT,
    'Archampoli': Accessibility.DIFFICULT, // Hike
    'Liani Ammos': Accessibility.MODERATE, // Dirt
    'Klimaki': Accessibility.MODERATE, // Dirt
    'Mageiras': Accessibility.MODERATE, // Dirt
    'Cheromylos': Accessibility.MODERATE, // Dirt
    'Stomio': Accessibility.MODERATE, // Dirt
    'Potami': Accessibility.MODERATE, // Dirt (Platanistos)
    'Livadakia': Accessibility.MODERATE,
    'Korasida': Accessibility.MODERATE, // Paved but steep/narrow
    'Kalamos': Accessibility.MODERATE,

    // --- ANDROS (Dirt Roads) ---
    'Zorkos': Accessibility.DIFFICULT, // Long dirt road
    'Vitali': Accessibility.DIFFICULT, // Long dirt road
    'Vori': Accessibility.DIFFICULT, // Very difficult dirt road
    'Achla': Accessibility.DIFFICULT, // Famous difficult dirt road
    'Ateni': Accessibility.MODERATE, // Dirt road
    'Piso Gialia': Accessibility.MODERATE, // Steps/Dirt
    'Syneti': Accessibility.MODERATE, // Narrow/Steep
    'Grias Pidima': Accessibility.DIFFICULT, // Dirt road + Hike

    // --- MILOS (West Side & North) ---
    'Triades': Accessibility.DIFFICULT, // Long dirt road
    'Ammoudaraki': Accessibility.DIFFICULT, // Dirt road
    'Agathia': Accessibility.DIFFICULT, // Dirt road
    'Kastanas': Accessibility.DIFFICULT, // Dirt road
    'Voudia': Accessibility.DIFFICULT, // Industrial road
    'Kolympisionas': Accessibility.DIFFICULT,
    'Rivari': Accessibility.DIFFICULT,
    'Fatourena': Accessibility.DIFFICULT, // Dirt road
    'Empourios': Accessibility.MODERATE, // Dirt road
    'Agios Ioannis': Accessibility.DIFFICULT, // Long dirt road
    'Sarakiniko': Accessibility.EASY, // Easy walk from parking
    'Tsigrado': Accessibility.DIFFICULT, // Rope/Ladder
    'Kleftiko': Accessibility.BOAT_ONLY,
    'Sykia': Accessibility.BOAT_ONLY,
    'Gerakas': Accessibility.BOAT_ONLY,
    'Fyriplaka': Accessibility.MODERATE, // Dirt road part
    'Plathiena': Accessibility.MODERATE, // Narrow road

    // --- KIMOLOS ---
    'Monastiria': Accessibility.DIFFICULT, // Dirt road
    'Soufi': Accessibility.DIFFICULT, // Dirt road
    'Mavrospilia': Accessibility.DIFFICULT, // Dirt road
    'Prassa': Accessibility.EASY, // Paved

    // --- SERIFOS ---
    'Kalo Ambeli': Accessibility.DIFFICULT, // Hike
    'Ganema': Accessibility.MODERATE, // Dirt parking/road
    'Vagia': Accessibility.MODERATE,
    'Maliadiko': Accessibility.DIFFICULT, // Dirt road
    'Karavi': Accessibility.DIFFICULT, // Dirt road
    'Sikamia': Accessibility.DIFFICULT, // Dirt road
    'Agios Sostis': Accessibility.MODERATE,
    'Psili Ammos': Accessibility.EASY,

    // --- SIFNOS ---
    'Vroulidia': Accessibility.DIFFICULT, // Steep dirt/cement
    'Fikiada': Accessibility.DIFFICULT, // Long Hike
    'Panagia Poulati': Accessibility.MODERATE, // Dirt/Hike
    'Vathy': Accessibility.EASY,
    'Platis Gialos': Accessibility.EASY,
    'Kamares': Accessibility.EASY,

    // --- KYTHNOS ---
    'Skylou': Accessibility.DIFFICULT, // Dirt road
    'Gaidouromantra': Accessibility.DIFFICULT, // Dirt road
    'Simousi': Accessibility.DIFFICULT, // Dirt road
    'Flambouria': Accessibility.MODERATE, // Dirt road
    'Kolona': Accessibility.MODERATE, // Dirt road (can be rough)
    'Apokrousi': Accessibility.MODERATE, // Dirt road

    // --- AMORGOS ---
    'Mouros': Accessibility.MODERATE, // Hike/Steps
    'Agia Anna': Accessibility.MODERATE, // Steps
    'Chalara': Accessibility.DIFFICULT, // Hike/Boat
    'Levrossos': Accessibility.MODERATE, // Walk/Boat
    'Nikouria': Accessibility.BOAT_ONLY,
    'Gramvoussa': Accessibility.BOAT_ONLY,

    // --- NAXOS ---
    'Kalantos': Accessibility.DIFFICULT, // Very long road (paved/dirt mix)
    'Panormos': Accessibility.MODERATE, // End of road
    'Spedo': Accessibility.DIFFICULT, // Dirt road
    'Kleido': Accessibility.DIFFICULT, // Dirt road
    'Lygaridia': Accessibility.DIFFICULT,
    'Moutsouna': Accessibility.MODERATE, // Curvy road
    // 'Psili Ammos': Accessibility.MODERATE, // Removed duplicate (Defined above under Serifos as EASY, here as MODERATE. Keeping Naxos specific logic requires unique naming or accepting one value)

    // --- PAROS ---
    'Langeri': Accessibility.MODERATE, // Walk/Dirt
    'Kolymbithres': Accessibility.EASY,
    'Monastiri': Accessibility.EASY,

    // --- MYKONOS ---
    'Fokos': Accessibility.DIFFICULT, // Dirt road
    'Mersini': Accessibility.DIFFICULT, // Dirt road
    'Merchia': Accessibility.DIFFICULT, // Dirt road
    'Kapari': Accessibility.MODERATE, // Walk/Dirt
    // 'Agios Sostis': Accessibility.MODERATE, // Removed duplicate

    // --- CRETE ---
    'Balos': Accessibility.DIFFICULT, // Bad dirt road + Hike
    'Elafonisi': Accessibility.EASY,
    'Kedrodasos': Accessibility.DIFFICULT, // Hike/Dirt
    'Seitan Limania': Accessibility.DIFFICULT, // Steep Hike
    'Agiofarago': Accessibility.DIFFICULT, // Hike
    'Triopetra': Accessibility.MODERATE, // Easy dirt/paved mix
    'Ligres': Accessibility.MODERATE, // Dirt road
    'Agios Pavlos (Sandhills)': Accessibility.DIFFICULT, // Hike/Dirt
    'Preveli': Accessibility.MODERATE, // Steps
    'Vai': Accessibility.EASY,
    'Xerokampos': Accessibility.MODERATE, // Remote
    'Glyka Nera': Accessibility.BOAT_ONLY, // Or very hard hike
    'Marmara': Accessibility.BOAT_ONLY,
    'Loutro': Accessibility.BOAT_ONLY,

    // --- IONIAN ---
    'Egremni': Accessibility.DIFFICULT, // Stairs/Road often closed
    'Milos (Lefkada)': Accessibility.DIFFICULT, // Hike/Boat
    'Agiofili': Accessibility.MODERATE, // Boat/Dirt/Walk
    'Avali': Accessibility.MODERATE, // Narrow/Steep
    'Gidaki': Accessibility.BOAT_ONLY, // Or long hike
    'Fteri': Accessibility.DIFFICULT, // Hike
    'Platia Ammos': Accessibility.DIFFICULT, // Closed stairs/Diff
    'Koutsoupia': Accessibility.DIFFICULT, // Hike/Boat
    'Myrtos': Accessibility.EASY, // Paved
    'Porto Katsiki': Accessibility.MODERATE, // Stairs/Parking
    'Navagio': Accessibility.BOAT_ONLY,
    'Xigia': Accessibility.EASY,

    // --- HALKIDIKI ---
    'Kavourotrypes': Accessibility.MODERATE, // Walk through trees
    'Tigania': Accessibility.MODERATE, // Dirt road
    'Kriaritsi': Accessibility.MODERATE, // Maze of roads
    'Glarokavos': Accessibility.MODERATE, // Dirt road end
    'Possidi Cape': Accessibility.MODERATE, // Walk on sand

    // --- OTHER ---
    'Giola': Accessibility.DIFFICULT, // Hike
    'Saliara': Accessibility.MODERATE, // Dirt road
    'Vathy (Thassos)': Accessibility.MODERATE, // Dirt road
    'Seychelles': Accessibility.MODERATE, // Hike
    'Nas': Accessibility.MODERATE, // Stairs
    'Mesakti': Accessibility.EASY,
    'Lalaria': Accessibility.BOAT_ONLY,
    'Simos (Elafonisos)': Accessibility.EASY,
    'Voidokilia': Accessibility.EASY, // Easy walk from parking
};

const determineAccessibility = (name: string, englishName: string): Accessibility => {
    // 1. Check overrides first (by both English and potentially Greek part of name)
    const cleanEn = englishName.replace(/\(.*\)/, '').trim();
    
    // Check specific keys
    if (ACCESSIBILITY_OVERRIDES[cleanEn]) return ACCESSIBILITY_OVERRIDES[cleanEn];
    
    // Check partial matches in overrides
    for (const key in ACCESSIBILITY_OVERRIDES) {
        if (cleanEn.includes(key)) return ACCESSIBILITY_OVERRIDES[key];
    }

    // 2. Heuristics for others
    // If it's a very common organized name, assume Easy
    if (name.includes('Beach Bar') || name.includes('Camping') || name.includes('Hotel') || name.includes('Resort')) {
        return Accessibility.EASY;
    }

    // Default to EASY for unknown, as most mapped beaches are accessible.
    // However, considering the user's feedback, we could default to MODERATE if unsure, 
    // but that might mislabel developed beaches. 
    // The extensive overrides list above covers the majority of "wild" beaches.
    
    return Accessibility.EASY;
};

const parseCSV = (text: string, startIndex: number): RawBeach[] => {
    const lines = text.split('\n');
    const beaches: RawBeach[] = [];
    
    lines.forEach((line, i) => {
      let normalized = line.trim();
      if (!normalized) return;
      
      normalized = normalized.replace(/^"|"$/g, ''); 
      
      let parts: string[] = [];
      if (normalized.includes('|')) {
          parts = normalized.split('|');
      } else if (normalized.includes(' > ')) {
          parts = normalized.split(' > ');
      } else if (normalized.includes(' — ')) {
          parts = normalized.split(' — ');
      } else {
          return;
      }
      
      parts = parts.map(p => clean(p));
      
      // Robustness: Remove trailing empty parts (e.g. "Region|Name|Coords|")
      while (parts.length > 0 && !parts[parts.length - 1]) {
          parts.pop();
      }

      if (parts.length >= 2) {
          const coordsPart = parts[parts.length - 1];
          const coords = coordsPart.split(',').map(c => parseFloat(clean(c)));
          
          if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
              const lat = coords[0];
              const lon = coords[1];
              
              let region = "Unknown";
              let prefecture = "Unknown";
              let rawName = "Unknown Beach";

              if (parts.length >= 4) {
                  region = parts[0]; 
                  prefecture = normalizeRegionName(parts[1]);
                  rawName = parts[2];
                  prefecture = normalizeAtticaSubArea(prefecture, parts[1], lat, lon);
              } else if (parts.length === 3) {
                  // Format: Region/Prefecture | Name | Coords
                  // Usually used for mainland lists e.g. "Nomos Thessalonikis|Akti Siamo|Coords"
                  
                  region = parts[0];
                  prefecture = normalizeRegionName(parts[0]);
                  rawName = parts[1];
              } else {
                  rawName = parts[0];
              }
              
              // 1. Apply Specific Manual Corrections (Deletions & Renames)
              const manualCorrection = applyManualCorrections(rawName, prefecture, region);
              
              // If correction returns null, it means DELETE this entry
              if (manualCorrection === null) {
                  return;
              }

              // Use manual correction if available, otherwise apply generic cleaning
              let name = manualCorrection !== rawName ? manualCorrection : cleanBeachName(rawName);

              // 2. Specific fix for Riviera in Attica if incorrectly labeled (safeguard)
              if (prefecture === 'East Attica' && name.includes('Riviera')) {
                  name = 'Riviera';
              }

              beaches.push({
                  id: startIndex + i, 
                  region,
                  prefecture, 
                  name, // This is the final name
                  lat,
                  lon
              });
          }
      }
    });
    return beaches;
};

import { cacheBeaches, getCachedBeaches } from './indexedDBService';

type JsonBeachRecord = {
  name?: unknown;
  lat?: unknown;
  lon?: unknown;
  metadata?: unknown;
};

const isBeachMetadata = (value: unknown): value is BeachMetadata => {
  if (!value || typeof value !== 'object') return false;
  const metadata = value as Partial<BeachMetadata>;
  return Boolean(
    metadata.access &&
    typeof metadata.access === 'object' &&
    typeof metadata.access.type === 'string' &&
    typeof metadata.access.label === 'string' &&
    typeof metadata.access.notes === 'string' &&
    metadata.terrain &&
    typeof metadata.terrain === 'object' &&
    Array.isArray(metadata.terrain.types) &&
    typeof metadata.terrain.label === 'string' &&
    typeof metadata.organized === 'boolean' &&
    typeof metadata.shade === 'boolean' &&
    Array.isArray(metadata.amenities)
  );
};

const parseBeachPayload = (beachData: unknown): RawBeach[] => {
  const allBeaches: RawBeach[] = [];
  let idCounter = 0;

  const walk = (node: unknown, region: string, path: string[]) => {
    if (Array.isArray(node)) {
      for (const item of node) {
        const b = item as JsonBeachRecord;
        const lat = typeof b?.lat === 'number' ? b.lat : Number(b?.lat);
        const lon = typeof b?.lon === 'number' ? b.lon : Number(b?.lon);
        const name = typeof b?.name === 'string' && b.name.trim() ? b.name.trim() : 'Unknown';

        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

        allBeaches.push({
          id: idCounter++,
          region,
          // Keep the deepest area label so nested JSON areas are preserved.
          prefecture: path[path.length - 1] || path[0] || 'Unknown',
          name,
          lat,
          lon,
          metadata: isBeachMetadata(b?.metadata) ? b.metadata : undefined
        });
      }
      return;
    }

    if (!node || typeof node !== 'object') return;

    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      walk(value, region, [...path, key]);
    }
  };

  if (!beachData || typeof beachData !== 'object') return allBeaches;

  for (const [region, regionNode] of Object.entries(beachData as Record<string, unknown>)) {
    walk(regionNode, region, []);
  }

  return allBeaches;
};

export const loadBeaches = async (): Promise<RawBeach[]> => {
  // Load beach data from greek_beaches.json which contains comprehensive Greek beaches data.
  try {
      let beachData: unknown;
      const response = await fetch('/greek_beaches.json');
      if (response.ok) {
          beachData = await response.json();
      } else {
          // Fallback when public asset is unavailable/misconfigured.
          const jsonModule = await import('../src/data/greek_beaches.json');
          beachData = jsonModule.default;
      }

      const allBeaches = parseBeachPayload(beachData);
      
      // Deduplicate only exact duplicates. We keep beaches that share coordinates
      // but have different names because they are distinct entries in the source data.
      const uniqueBeaches: RawBeach[] = [];
      const seenKeys = new Set<string>();

      allBeaches.forEach(beach => {
          const exactKey = `${beach.region}|${beach.prefecture}|${beach.name}|${beach.lat.toFixed(6)}|${beach.lon.toFixed(6)}`;
          if (!seenKeys.has(exactKey)) {
              uniqueBeaches.push(beach);
              seenKeys.add(exactKey);
          }
      });
    
    console.log(`Total beaches loaded: ${uniqueBeaches.length}`);
    
    // Cache the loaded beaches
    if (uniqueBeaches.length > 0) {
      cacheBeaches(uniqueBeaches);
    }
    
    return uniqueBeaches;
  } catch (error) {
    console.error("Critical error loading beach data, falling back to IndexedDB cache:", error);
    const cachedBeaches = await getCachedBeaches();
    if (cachedBeaches && cachedBeaches.length > 0) {
      console.log(`Loaded ${cachedBeaches.length} beaches from IndexedDB cache.`);
      return cachedBeaches;
    }
    return [];
  }
};

export const mapRegionToGroup = (region: string | null, subRegion: string | null): Island['group'] => {
    const r = (region || '').toLowerCase().trim();
    const s = (subRegion || '').toLowerCase().trim();
    
    // Explicit Island Grouping
    const cyclades = ['milos', 'santorini', 'mykonos', 'paros', 'naxos', 'syros', 'tinos', 'andros', 'sifnos', 'serifos', 'kythnos', 'kea', 'amorgos', 'ios', 'folegandros', 'koufonisia', 'donousa', 'schinoussa', 'iraklia', 'kimolos', 'sikinos', 'anafi', 'antiparos'];
    const dodecanese = ['rhodes', 'kos', 'karpathos', 'astypalaia', 'patmos', 'kalymnos', 'leros', 'symi', 'lipsi', 'nisyros', 'tilos', 'kassos', 'kasos', 'halki', 'agathonisi', 'kastellorizo', 'megisti', 'pserimos', 'telendos', 'arki', 'arkoi', 'marathi'];
    const ionian = ['corfu', 'zakynthos', 'kefalonia', 'lefkada', 'ithaca', 'ithaki', 'paxi', 'paxos', 'antipaxos', 'antipaxi', 'meganisi', 'othonoi', 'erikoussa', 'mathraki', 'kythira', 'antikythira'];
    const sporades = ['skiathos', 'skopelos', 'alonissos', 'skyros'];
    const northAegean = ['lesvos', 'chios', 'samos', 'ikaria', 'lemnos', 'thassos', 'samothraki', 'fournoi', 'oinousses', 'psara', 'agios efstratios'];
    const argosaronic = ['hydra', 'spetses', 'poros', 'aegina', 'salamina', 'agistri', 'methana', 'saronic islands'];
    
    // 1. Specific Subregion Matching
    if (cyclades.includes(s) || s.includes('kykladon')) return 'cyclades';
    if (dodecanese.includes(s) || s.includes('dodecanese')) return 'dodecanese';
    if (ionian.some(i => s.includes(i))) return 'ionian';
    if (sporades.includes(s)) return 'sporades';
    if (northAegean.includes(s) || s.includes('lesvou') || s.includes('chiou') || s.includes('samou')) return 'north_aegean';
    if (argosaronic.includes(s) || s.includes('saronic')) return 'argosaronic';
    
    if (s.includes('chania') || s.includes('rethymno') || s.includes('heraklion') || s.includes('lasithi')) return 'crete';
    if (s.includes('attica') || s.includes('athens') || s.includes('piraeus')) return 'attica';
    if (s.includes('evia') || s.includes('euboea')) return 'euboea';
    
    // Mainland Subregions
    if (s.includes('halkidiki') || s.includes('thessaloniki') || s.includes('pieria') || s.includes('kilkis') || s.includes('kavala') || s.includes('drama')) return 'mainland_macedonia';
    if (s.includes('evros') || s.includes('rodopi') || s.includes('xanthi')) return 'mainland_thrace';
    if (s.includes('thesprotia') || s.includes('preveza') || s.includes('arta')) return 'mainland_epirus';
    if (s.includes('magnesia') || s.includes('larissa')) return 'mainland_thessaly';
    if (s.includes('argolida') || s.includes('arkadia') || s.includes('korinthia') || s.includes('lakonia') || s.includes('messinia') || s.includes('ilia') || s.includes('achaia')) return 'mainland_peloponnese';
    if (s.includes('fokida') || s.includes('fthiotida') || s.includes('viotia') || s.includes('aitoloakarnania')) return 'mainland_central';

    // 2. Broad Region Matching
    if (r.includes('cyclades')) return 'cyclades';
    if (r.includes('dodecanese')) return 'dodecanese';
    if (r.includes('ionian')) return 'ionian';
    if (r.includes('sporades')) return 'sporades';
    if (r.includes('north aegean') || r.includes('aegean')) return 'north_aegean';
    if (r.includes('crete')) return 'crete';
    if (r.includes('argosaronic')) return 'argosaronic';
    if (r.includes('attica')) return 'attica';
    if (r.includes('evia') || r.includes('evvoia')) return 'euboea';
    
    if (r.includes('peloponnese')) return 'mainland_peloponnese';
    if (r.includes('thessaly')) return 'mainland_thessaly';
    if (r.includes('epirus')) return 'mainland_epirus';
    if (r.includes('thrace')) return 'mainland_thrace';
    if (r.includes('macedonia')) return 'mainland_macedonia';
    if (r.includes('central greece') || r.includes('sterea') || r.includes('west greece')) return 'mainland_central';
    
    // 3. Fallback
    return 'mainland_central';
};

const FAMOUS_DESCRIPTIONS: Record<string, { en: string, gr: string }> = {
    'Sarakiniko': { 
        en: "A lunar landscape with white volcanic rocks and crystal clear turquoise waters. A unique geological phenomenon.",
        gr: "Σεληνιακό τοπίο με λευκά ηφαιστειακά βράχια και γαλαζοπράσινα νερά. Ένα μοναδικό γεωλογικό φαινόμενο."
    },
    'Elafonisi': {
        en: "Famous for its pink sand and exotic shallow turquoise lagoon. A protected Natura 2000 area.",
        gr: "Διάσημη για τη ροζ άμμο και την εξωτική ρηχή λιμνοθάλασσα. Προστατευόμενη περιοχή Natura 2000."
    },
    'Balos': {
        en: "Breathtaking lagoon with white sand and vivid emerald waters. Wild natural beauty.",
        gr: "Εντυπωσιακή λιμνοθάλασσα με λευκή άμμο και σμαραγδένια νερά. Άγρια φυσική ομορφιά."
    },
    'Navagio': {
        en: "The iconic Shipwreck beach, accessible only by sea. Surrounded by towering white cliffs.",
        gr: "Η εμβληματική παραλία Ναυάγιο, προσβάσιμη μόνο από τη θάλασσα. Περιβάλλεται από πανύψηλα λευκά βράχια."
    },
    'Porto Katsiki': {
        en: "Dramatic white vertical cliffs dropping into deep blue waters. One of the Mediterranean's most famous views.",
        gr: "Επιβλητικοί λευκοί γκρεμοί που καταλήγουν σε βαθιά μπλε νερά. Μία από τις πιο διάσημες εικόνες της Μεσογείου."
    },
    'Myrtos': {
        en: "Multi-award winning beach with dazzling white pebbles and electric blue sea.",
        gr: "Πολυβραβευμένη παραλία με εκτυφλωτικά λευκά βότσαλα και ηλεκτρίκ μπλε νερά."
    },
    'Voidokilia': {
        en: "A perfect Omega-shaped bay with golden sand dunes and shallow calm waters.",
        gr: "Ένας τέλειος κόλπος σε σχήμα Ωμέγα με αμμόλοφους και ρηχά ήρεμα νερά."
    },
    'Simos (Elafonisos)': {
        en: "Spectacular double bay with fine golden sand and dunes. Caribbean-style waters.",
        gr: "Εντυπωσιακός διπλός κόλπος με ψιλή χρυσή άμμο και αμμόλοφους. Νερά καραϊβικής."
    },
    'Kolymbithres': {
        en: "Unique granite rock formations sculpted by wind and water, creating natural swimming pools.",
        gr: "Μοναδικοί σχηματισμοί γρανίτη σμιλεμένοι από τον αέρα και το νερό, που δημιουργούν φυσικές πισίνες."
    },
    'Lalaria': {
        en: "Accessible only by boat, famous for its smooth white pebbles and the stone arch.",
        gr: "Προσβάσιμη μόνο με σκάφος, διάσημη για τα ολοστρόγγυλα λευκά βότσαλα και την πέτρινη αψίδα."
    },
    'Koukounaries': {
        en: "Famous for its lush pine forest reaching the golden sand. Highly organized and popular.",
        gr: "Διάσημη για το πυκνό πευκοδάσος που φτάνει μέχρι τη χρυσή άμμο. Πολύ οργανωμένη και δημοφιλής."
    },
    'Mylopotas': {
        en: "The most popular beach on Ios, a vast stretch of golden sand with watersports and beach bars.",
        gr: "Η πιο δημοφιλής παραλία της Ίου, μια τεράστια έκταση χρυσής άμμου με θαλάσσια σπορ."
    },
    'Super Paradise': {
        en: "World-renowned party beach with golden sand and crystal clear waters.",
        gr: "Παγκοσμίως γνωστή για τα πάρτι της, με χρυσή άμμο και κρυστάλλινα νερά."
    },
    'Prasonisi': {
        en: "A paradise for windsurfers where the Aegean meets the Mediterranean. Two seas in one beach.",
        gr: "Παράδεισος για windsurfers όπου το Αιγαίο συναντά τη Μεσόγειο. Δύο θάλασσες σε μία παραλία."
    },
    'Vai': {
        en: "Famous for Europe's largest natural palm forest right on the beach.",
        gr: "Διάσημη για το μεγαλύτερο φυσικό φοινικόδασος της Ευρώπης πάνω στο κύμα."
    },
    'Kleftiko': {
        en: "Iconic white volcanic rocks rising from the sea. Accessible only by boat.",
        gr: "Εμβληματικά λευκά ηφαιστειακά βράχια μέσα στη θάλασσα. Προσβάσιμο μόνο με σκάφος."
    },
    'Tsigrado': {
        en: "Small sandy cove with emerald waters, accessible via a rope and ladder. For the adventurous.",
        gr: "Μικρή αμμώδης παραλία με σμαραγδένια νερά, προσβάσιμη με σκοινί και σκάλα. Για τολμηρούς."
    },
    'Fyriplaka': {
        en: "Long beach with towering colored volcanic cliffs and shallow crystal waters.",
        gr: "Μεγάλη παραλία με πολύχρωμα ηφαιστειακά βράχια και ρηχά κρυστάλλινα νερά."
    },
    'Paradise': {
        en: "World-famous party beach on Mykonos with golden sand, crystal waters and legendary sunsets.",
        gr: "Παγκοσμίως γνωστή παραλία πάρτι στη Μύκονο με χρυσή άμμο, κρυστάλλινα νερά και θρυλικά ηλιοβασιλέματα."
    },
    'Red Beach': {
        en: "Santorini's iconic red volcanic beach with dramatic cliffs and unique red sand.",
        gr: "Η εμβληματική κόκκινη ηφαιστειακή παραλία της Σαντορίνης με επιβλητικά βράχια και μοναδική κόκκινη άμμο."
    },
    'Kamari': {
        en: "Santorini's black sand beach with volcanic origins and stunning caldera views.",
        gr: "Η μαύρη αμμουδιά της Σαντορίνης με ηφαιστειακή προέλευση και εκπληκτική θέα στον κρατήρα."
    },
    'Καλαφάτη': {
        en: "Mykonos' most beautiful beach with turquoise waters, white pebbles and luxury vibe.",
        gr: "Η πιο όμορφη παραλία της Μυκόνου με τιρκουάζ νερά, λευκά βότσαλα και αίσθηση πολυτέλειας."
    },
    'Agios Sostis': {
        en: "Zakynthos' paradise beach with emerald waters, white cliffs and shipwreck remains.",
        gr: "Παράδεισος της Ζακύνθου με σμαραγδένια νερά, λευκά βράχια και ερείπια ναυαγίου."
    },
    'Falasarna': {
        en: "Crete's westernmost beach with stunning sunsets, ancient ruins and wild natural beauty.",
        gr: "Η δυτικότερη παραλία της Κρήτης με εκπληκτικά ηλιοβασιλέματα, αρχαία ερείπια και άγρια φυσική ομορφιά."
    },
    'Faliraki': {
        en: "Rhodes' lively beach resort with water sports, bars and family-friendly atmosphere.",
        gr: "Το ζωντανό παραθεριστικό κέντρο της Ρόδου με θαλάσσια σπορ, μπαρ και οικογενειακό κλίμα."
    },
    'Lindos': {
        en: "Rhodes' ancient acropolis beach with medieval castle views and crystal waters.",
        gr: "Η παραλία της αρχαίας ακρόπολης της Ρόδου με θέα στο μεσαιωνικό κάστρο και κρυστάλλινα νερά."
    },
    'Tsambika': {
        en: "Rhodes' secluded beach with dramatic cliffs and pristine turquoise waters.",
        gr: "Η απομονωμένη παραλία της Ρόδου με εντυπωσιακά βράχια και παρθένα τιρκουάζ νερά."
    },
    'Glyfada': {
        en: "Corfu's stunning beach with fine golden sand, crystal waters and Venetian fortress views.",
        gr: "Η εντυπωσιακή παραλία της Κέρκυρας με ψιλή χρυσή άμμο, κρυστάλλινα νερά και θέα στο ενετικό φρούριο."
    },
    'Perissa': {
        en: "Santorini's famous black sand beach with volcanic origins and lively atmosphere.",
        gr: "Η διάσημη μαύρη αμμουδιά της Σαντορίνης με ηφαιστειακή προέλευση και ζωντανό κλίμα."
    },
    'Paleokastritsa': {
        en: "Corfu's most beautiful beach with six coves, monasteries and emerald waters.",
        gr: "Η πιο όμορφη παραλία της Κέρκυρας με έξι καλντερίμια, μοναστήρια και σμαραγδένια νερά."
    },
    'Laganas': {
        en: "Zakynthos' party beach famous for nightlife and turtle nesting areas nearby.",
        gr: "Η παραλία πάρτι της Ζακύνθου διάσημη για τη νυχτερινή ζωή και τις περιοχές φωλιάσματος χελωνών κοντά."
    },
    'Gerakas': {
        en: "Zakynthos' protected beach where Caretta-Caretta turtles nest. No access after sunset.",
        gr: "Η προστατευόμενη παραλία της Ζακύνθου όπου φωλιάζουν οι χελώνες Caretta-Caretta. Απαγορεύεται η πρόσβαση μετά τη δύση."
    },
    'Anthony Quinn': {
        en: "Rhodes' secluded cove beach with crystal waters and lush greenery.",
        gr: "Το απομονωμένο καλντερίμι της Ρόδου με κρυστάλλινα νερά και καταπράσινη βλάστηση."
    },
    'Preveli': {
        en: "Crete's palm forest beach with river mouth and protected natural beauty.",
        gr: "Η παραλία φοινικόδασους της Κρήτης με εκβολή ποταμού και προστατευμένη φυσική ομορφιά."
    },
    'Matala': {
        en: "Crete's hippie beach with ancient caves and 60s counterculture history.",
        gr: "Η παραλία των χίπις της Κρήτης με αρχαίες σπηλιές και ιστορία της κόντρα-κουλτούρας των 60s."
    },
    'Kalogria': {
        en: "Peloponnese's paradise beach with turquoise waters and pine forest backdrop.",
        gr: "Ο παράδεισος της Πελοποννήσου με τιρκουάζ νερά και φόντο πευκοδάσους."
    },
    'Marathonisi': {
        en: "Zakynthos' turtle island beach, accessible only by boat, with pristine nature.",
        gr: "Η παραλία νησιού χελωνών της Ζακύνθου, προσβάσιμη μόνο με σκάφος, με παρθένα φύση."
    }
};

type LocalizedBeachText = { [key in LanguageCode]: string };

type CuratedBeachNarrative = {
    aliases: string[];
    description: LocalizedBeachText;
    detailedDescription?: LocalizedBeachText;
    accessNotes?: LocalizedBeachText;
};

const makeLocalizedBeachText = (en: string, gr: string): LocalizedBeachText => ({
    en,
    gr,
    fr: en,
    de: en,
    it: en
});

const makeBeachNarrative = (
    aliases: string[],
    en: string,
    gr: string,
    detailedEn?: string,
    detailedGr?: string,
    accessEn?: string,
    accessGr?: string
): CuratedBeachNarrative => ({
    aliases,
    description: makeLocalizedBeachText(en, gr),
    ...(detailedEn && detailedGr ? { detailedDescription: makeLocalizedBeachText(detailedEn, detailedGr) } : {}),
    ...(accessEn && accessGr ? { accessNotes: makeLocalizedBeachText(accessEn, accessGr) } : {})
});

const normalizeBeachLookup = (value: string): string => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const CURATED_BEACH_NARRATIVES: CuratedBeachNarrative[] = [
    makeBeachNarrative(
        ['Sarakiniko'],
        'Milos at its most surreal: white volcanic rock, smooth curves and deep blue water in a landscape that looks almost lunar.',
        'Η Μήλος στην πιο εξωπραγματική εκδοχή της: λευκό ηφαιστειακό πέτρωμα, σμιλεμένες καμπύλες και βαθύ μπλε νερό σε σχεδόν σεληνιακό τοπίο.',
        'Sarakiniko is the beach everyone associates with Milos for a reason. The white rock has been carved by wind and sea into a landscape that feels more like a geological sculpture park than a normal shoreline, making even a short swim feel memorable.',
        'Το Σαρακήνικο είναι δικαίως η παραλία-σύμβολο της Μήλου. Ο λευκός βράχος έχει σμιλευτεί από τον αέρα και τη θάλασσα σε ένα τοπίο που θυμίζει περισσότερο γεωλογικό γλυπτό παρά συνηθισμένη ακτή, οπότε ακόμη και μια σύντομη βουτιά γίνεται εμπειρία.'
    ),
    makeBeachNarrative(
        ['Balos'],
        'A lagoon at the tip of the Gramvousa peninsula, famous for its bright shallows, white sand and wild western-Crete scenery.',
        'Λιμνοθάλασσα στην άκρη της Γραμβούσας, γνωστή για τα φωτεινά ρηχά της, τη λευκή άμμο και το άγριο σκηνικό της δυτικής Κρήτης.',
        'Balos stands out because it feels both delicate and dramatic at the same time: a shallow lagoon in impossible shades of blue, with Gramvousa opposite and one of Crete\'s most photogenic coastal landscapes all around.',
        'Το Μπάλος ξεχωρίζει γιατί συνδυάζει κάτι ντελικάτο και κάτι άγριο μαζί: μια ρηχή λιμνοθάλασσα σε απίθανες αποχρώσεις του μπλε, με τη Γραμβούσα απέναντι και ένα από τα πιο φωτογενή παράκτια τοπία της Κρήτης γύρω της.'
    ),
    makeBeachNarrative(
        ['Elafonisi', 'Elafonissi'],
        'Shallow exotic water, pale sand with pink tones and a protected lagoon landscape make Elafonisi feel unlike anywhere else in Crete.',
        'Ρηχά εξωτικά νερά, ανοιχτόχρωμη άμμος με ροζ τόνους και προστατευμένο τοπίο λιμνοθάλασσας κάνουν το Ελαφονήσι να μη θυμίζει καμία άλλη παραλία της Κρήτης.',
        'More than just a pretty beach, Elafonisi is a fragile lagoon ecosystem. Its pink-tinted sand and easy, shallow water are what everyone remembers, but the real charm is the sense of being in a protected edge-of-the-island landscape.',
        'Το Ελαφονήσι δεν είναι μόνο εντυπωσιακό στην εικόνα, αλλά και ένα ευαίσθητο οικοσύστημα λιμνοθάλασσας. Η ροζέ άμμος και τα ρηχά νερά είναι αυτά που θυμούνται όλοι, όμως η ουσία είναι η αίσθηση ότι βρίσκεσαι σε ένα προστατευμένο τοπίο στην άκρη του νησιού.'
    ),
    makeBeachNarrative(
        ['Voidokilia'],
        'Its near-perfect horseshoe shape is only half the story. Voidokilia also backs onto the Gialova lagoon, one of Greece\'s most important wetlands.',
        'Το σχεδόν τέλειο πεταλοειδές σχήμα της είναι μόνο η μισή ιστορία. Η Βοϊδοκοιλιά ακουμπά και στη λιμνοθάλασσα της Γιάλοβας, έναν από τους σημαντικότερους υγροτόπους της Ελλάδας.',
        'Voidokilia feels iconic from above, but on the ground it is the pairing of golden sand, calm water and the protected wetland behind it that makes it special. If you keep exploring, the area keeps unfolding with viewpoints and castle remains above the bay.',
        'Η Βοϊδοκοιλιά είναι εμβληματική από ψηλά, όμως από κοντά αυτό που την κάνει μοναδική είναι ο συνδυασμός χρυσαφένιας άμμου, ήρεμου νερού και προστατευμένου υγροτόπου ακριβώς από πίσω. Αν συνεχίσεις την εξερεύνηση, η περιοχή ανοίγει με θέες και ίχνη κάστρου πάνω από τον κόλπο.'
    ),
    makeBeachNarrative(
        ['Matala'],
        'Matala is not just a beach but one of Crete\'s most storied seaside spots, with sea caves, a hippie legacy and nearby Minoan history.',
        'Τα Μάταλα δεν είναι απλώς μια παραλία αλλά ένα από τα πιο φορτισμένα παραθαλάσσια τοπία της Κρήτης, με σπηλιές, hippie κληρονομιά και μινωική ιστορία δίπλα τους.',
        'The soft-rock caves above the beach are what make Matala instantly recognisable. Add the 1960s-70s counterculture story and its proximity to Phaistos, and you get a beach that feels cultural as much as coastal.',
        'Οι σπηλιές στο μαλακό πέτρωμα πάνω από την παραλία είναι αυτό που κάνει τα Μάταλα αμέσως αναγνωρίσιμα. Αν προσθέσεις και την αντικουλτούρα των 60s-70s μαζί με την εγγύτητα στη Φαιστό, προκύπτει μια παραλία που είναι εξίσου πολιτισμική όσο και θαλασσινή.'
    ),
    makeBeachNarrative(
        ['Preveli'],
        'A beach where a river reaches the sea through a palm grove, creating one of Crete\'s most exotic natural settings.',
        'Μια παραλία όπου ποτάμι συναντά τη θάλασσα μέσα από φοινικόδασος, δημιουργώντας ένα από τα πιο εξωτικά φυσικά σκηνικά της Κρήτης.',
        'Preveli is memorable because the swim is only part of the experience. The gorge, the freshwater river, the saltwater lagoon and the line of palms behind the beach create a landscape that feels far more cinematic than typical.',
        'Το Πρέβελη μένει στη μνήμη γιατί η βουτιά είναι μόνο ένα μέρος της εμπειρίας. Το φαράγγι, το γλυκό νερό του ποταμού, η λιμνοθάλασσα και η σειρά από φοίνικες πίσω από την παραλία συνθέτουν ένα τοπίο πολύ πιο κινηματογραφικό από το συνηθισμένο.',
        'Expect a descent with steps and bring water for the way back, especially in peak summer heat.',
        'Υπολόγισε κατάβαση με σκαλιά και πάρε νερό για την επιστροφή, ειδικά μέσα στο κατακαλόκαιρο.'
    ),
    makeBeachNarrative(
        ['Gerakas'],
        'One of Zakynthos\' most sensitive turtle-nesting beaches, with a wide sandy arc and a much quieter mood than the island\'s party coast.',
        'Μία από τις πιο ευαίσθητες παραλίες ωοτοκίας της Ζακύνθου, με φαρδύ αμμώδες τόξο και πολύ πιο ήσυχο χαρακτήρα από την party πλευρά του νησιού.',
        'Gerakas stands out because the beach experience is shaped by conservation. Its soft sand and open bay are beautiful on their own, but what gives the place real identity is that it is part of the protected habitat of the Caretta caretta turtle.',
        'Ο Γέρακας ξεχωρίζει γιατί η εμπειρία της παραλίας καθορίζεται από την προστασία του οικοσυστήματος. Η απαλή άμμος και ο ανοιχτός κόλπος είναι πανέμορφα από μόνα τους, όμως αυτό που δίνει πραγματική ταυτότητα στο μέρος είναι ότι ανήκει στον προστατευμένο βιότοπο της Caretta caretta.',
        'Access rules can change during nesting season and the beach closes after sunset to protect sea turtles.',
        'Οι κανόνες πρόσβασης αλλάζουν μέσα στην περίοδο ωοτοκίας και η παραλία κλείνει μετά τη δύση για την προστασία των θαλάσσιων χελωνών.'
    ),
    makeBeachNarrative(
        ['Laganas'],
        'Zakynthos\' best-known lively beach, stretching along a broad bay that also belongs to the marine park for loggerhead turtles.',
        'Η πιο γνωστή ζωντανή παραλία της Ζακύνθου, απλωμένη σε έναν μεγάλο κόλπο που ανήκει ταυτόχρονα και στο θαλάσσιο πάρκο της θαλάσσιας χελώνας.',
        'Laganas is unusual because nightlife and nature coexist in the same bay. It is the social, busy face of Zakynthos, but it also sits inside the wider turtle-protection zone that defines the south coast of the island.',
        'Το Λαγανάς είναι ιδιαίτερο γιατί η νυχτερινή ζωή και η φύση συνυπάρχουν στον ίδιο κόλπο. Είναι το κοινωνικό και έντονο πρόσωπο της Ζακύνθου, αλλά ταυτόχρονα βρίσκεται μέσα στη ζώνη προστασίας της χελώνας που χαρακτηρίζει όλη τη νότια ακτή του νησιού.'
    ),
    makeBeachNarrative(
        ['Sounion Beach', 'Sounio', 'Σούνιο'],
        'A swim beneath Cape Sounion, with the Temple of Poseidon on the headland and one of the classic sunset settings near Athens.',
        'Μπάνιο κάτω από το ακρωτήριο του Σουνίου, με τον Ναό του Ποσειδώνα στο ακρωτήρι και ένα από τα κλασικά ηλιοβασιλέματα της Αττικής.',
        'What makes Sounion special is the setting more than the sand itself. Few beaches near Athens let you combine a proper swim with an immediate view of one of Greece\'s most iconic archaeological landmarks.',
        'Αυτό που κάνει το Σούνιο ξεχωριστό είναι κυρίως το σκηνικό και όχι μόνο η άμμος. Ελάχιστες παραλίες κοντά στην Αθήνα σου επιτρέπουν να συνδυάσεις πραγματικό μπάνιο με τόσο άμεση σχέση με ένα από τα πιο εμβληματικά αρχαιολογικά τοπόσημα της Ελλάδας.'
    ),
    makeBeachNarrative(
        ['Beach Vravrona', 'Vravrona', 'Brauron', 'Βραυρώνα'],
        'A calmer east-Attica swim spot tied to the Vravrona wetland and the nearby sanctuary of Artemis rather than to beach-bar culture.',
        'Πιο ήρεμο σημείο για μπάνιο στην ανατολική Αττική, δεμένο περισσότερο με τον υγρότοπο της Βραυρώνας και το κοντινό ιερό της Αρτέμιδος παρά με beach-bar κουλτούρα.',
        'Vravrona has a sense of place that many Attica beaches lack. The beach sits beside one of the region\'s important wetlands, while just inland is the archaeological site of Artemis Vravronia, so the area feels ecological and historical at the same time.',
        'Η Βραυρώνα έχει μια αίσθηση τόπου που λείπει από πολλές παραλίες της Αττικής. Η ακτή βρίσκεται δίπλα σε έναν από τους σημαντικούς υγροτόπους της περιοχής, ενώ λίγο πιο μέσα είναι και ο αρχαιολογικός χώρος της Αρτέμιδος Βραυρωνίας, οπότε το μέρος διαβάζεται ταυτόχρονα οικολογικά και ιστορικά.'
    ),
    makeBeachNarrative(
        ['Kaki Thalassa Beach', 'Kaki Thalassa', 'Κακή Θάλασσα'],
        'A dramatic Keratea beach framed by rocks, with deeper water and a name rooted in local myth.',
        'Δραματική παραλία της Κερατέας πλαισιωμένη από βράχια, με πιο βαθιά νερά και όνομα ριζωμένο στην τοπική μυθολογία.',
        'Kaki Thalassa stands out among the beaches near Athens because it feels rougher and more cinematic. The gorge approach, the rocky frame and the sudden depth give it a stronger character than the flatter, more straightforward Attica sands.',
        'Η Κακή Θάλασσα ξεχωρίζει ανάμεσα στις παραλίες κοντά στην Αθήνα γιατί μοιάζει πιο άγρια και πιο κινηματογραφική. Η προσέγγιση μέσα από το φαράγγι, το βραχώδες πλαίσιο και το απότομο βάθος της δίνουν πιο δυνατό χαρακτήρα από τις πιο επίπεδες και προβλέψιμες αττικές αμμουδιές.'
    ),
    makeBeachNarrative(
        ['Legrena', 'Legraina', 'Λεγραινά'],
        'A chain of small coves just before Sounion, prized for clear water and a less packaged feel than the big organised beaches nearby.',
        'Ακολουθία από μικρούς κολπίσκους λίγο πριν από το Σούνιο, γνωστή για καθαρά νερά και πιο ανεπιτήδευτο χαρακτήρα από τις μεγάλες οργανωμένες παραλίες της περιοχής.',
        'Legrena appeals to people who want the Sounion coastline without the monument crowds. It feels more local, more broken-up into small swimming pockets and usually more about the sea than the setup.',
        'Τα Λεγραινά αρέσουν σε όσους θέλουν την ακτογραμμή του Σουνίου χωρίς τη μεγάλη τουριστική σκηνογραφία. Έχει πιο τοπικό χαρακτήρα, σπάει σε μικρές τσέπες για μπάνιο και συνήθως σε τραβά περισσότερο η ίδια η θάλασσα παρά το στήσιμο της παραλίας.'
    ),
    makeBeachNarrative(
        ['Aponissos Beach', 'Aponisos', 'Aponissos', 'Απονήσος'],
        'Agistri\'s postcard beach: a tiny turquoise bay linked to a little islet, popular with swimmers, boats and easy island-day-trip energy.',
        'Η καρτποσταλική παραλία του Αγκιστρίου: μικρός τιρκουάζ όρμος δεμένος με νησάκι, αγαπημένος για μπάνιο, σκάφη και εύκολη ημερήσια εκδρομή.',
        'Aponissos feels almost custom-built for a Saronic escape. The water is vividly clear, the bay is naturally sheltered and the small islet opposite gives the whole place that neat, enclosed, island-lagoon look.',
        'Η Απονήσος μοιάζει σχεδόν φτιαγμένη για απόδραση στον Σαρωνικό. Το νερό είναι εντυπωσιακά καθαρό, ο όρμος είναι φυσικά προφυλαγμένος και το μικρό νησάκι απέναντι δίνει σε όλο το τοπίο αυτή την κλειστή, σχεδόν λιμνοθαλασσινή αίσθηση.'
    ),
    makeBeachNarrative(
        ['Porto Germeno'],
        'A broad west-Attica cove with forest behind it, multiple swim spots and the Aigosthena fortress watching from above.',
        'Μεγάλος κόλπος της δυτικής Αττικής με δάσος στο φόντο, πολλά σημεία για μπάνιο και το φρούριο των Αιγοσθενών να αγναντεύει από πάνω.',
        'Porto Germeno is different from the east coast of Attica: greener, quieter and more road-trip-like. The beach itself is generous, but the real bonus is that the setting mixes sea, mountains and a nearby 4th-century BC fortress.',
        'Το Πόρτο Γερμενό διαφέρει από την ανατολική ακτή της Αττικής: είναι πιο πράσινο, πιο ήσυχο και θυμίζει περισσότερο μικρό road trip. Η παραλία είναι μεγάλη, αλλά το πραγματικό του πλεονέκτημα είναι ότι το σκηνικό ενώνει θάλασσα, βουνό και ένα κοντινό φρούριο του 4ου αιώνα π.Χ.'
    ),
    makeBeachNarrative(
        ['Psatha'],
        'A long beach on the Gulf of Corinth side of Attica, better known among weekend regulars for its space, family feel and sunset light.',
        'Μακριά παραλία στην πλευρά του Κορινθιακού στην Αττική, γνωστή στους σταθερούς weekenders για τον χώρο της, τον οικογενειακό χαρακτήρα και το φως του ηλιοβασιλέματος.',
        'Psatha is less about a single dramatic landmark and more about breathing room. The long shore, the western exposure and the fact that it sits away from the usual Athens-beach circuit give it a noticeably different rhythm.',
        'Η Ψάθα δεν βασίζεται σε ένα εντυπωσιακό landmark αλλά στην αίσθηση ελευθερίας. Η μεγάλη ακτογραμμή, ο δυτικός προσανατολισμός και το ότι βρίσκεται έξω από το συνηθισμένο κύκλωμα των αθηναϊκών παραλιών της δίνουν εντελώς διαφορετικό ρυθμό.'
    ),

    // ==================== CYCLADES ====================
    // --- Santorini ---
    makeBeachNarrative(
        ['Red Beach', 'Κόκκινη Παραλία'],
        'Dramatic volcanic cliffs in deep red above a narrow beach of dark sand — one of Santorini\'s most photographed natural landscapes.',
        'Εντυπωσιακοί ηφαιστειακοί βράχοι σε βαθύ κόκκινο πάνω από μια στενή παραλία με σκούρα άμμο — ένα από τα πιο φωτογραφημένα φυσικά τοπία της Σαντορίνης.'
    ),
    makeBeachNarrative(
        ['Perissa', 'Περίσσα'],
        'A long stretch of black volcanic sand backed by the imposing Mesa Vouno cliff, with beach bars, tavernas and a lively summer atmosphere.',
        'Μακριά λωρίδα μαύρης ηφαιστειακής άμμου με φόντο τον επιβλητικό βράχο του Μέσα Βουνού, με beach bars, ταβέρνες και ζωντανή καλοκαιρινή ατμόσφαιρα.'
    ),
    makeBeachNarrative(
        ['Kamari', 'Καμάρι'],
        'Santorini\'s most organised black-sand beach, with a waterfront promenade, restaurants and views across the caldera at sunset.',
        'Η πιο οργανωμένη παραλία μαύρης άμμου της Σαντορίνης, με παραθαλάσσια πεζόδρομο, εστιατόρια και θέα στην καλντέρα στο ηλιοβασίλεμα.'
    ),
    makeBeachNarrative(
        ['Vlychada', 'Βλυχάδα'],
        'Sculpted white-grey cliffs create a moon-like backdrop behind this quiet beach — one of Santorini\'s most unique and lesser-known shores.',
        'Σμιλεμένοι λευκογκρίζοι βράχοι δημιουργούν σεληνιακό σκηνικό πίσω από αυτή την ήσυχη παραλία — μια από τις πιο μοναδικές και λιγότερο γνωστές ακτές της Σαντορίνης.'
    ),
    makeBeachNarrative(
        ['White Beach'],
        'Accessible mainly by boat from Red Beach, this small cove sits beneath sheer white cliffs and offers crystal-clear swimming.',
        'Προσβάσιμη κυρίως με βάρκα από την Κόκκινη Παραλία, αυτός ο μικρός όρμος βρίσκεται κάτω από κατακόρυφους λευκούς βράχους με κρυστάλλινα νερά.'
    ),

    // --- Mykonos ---
    makeBeachNarrative(
        ['Super Paradise', 'Σούπερ Παράδεισος'],
        'One of Mykonos\' most iconic party beaches, famous for its turquoise water, DJ sets and lively beach-club scene against a dramatic rocky cove.',
        'Μία από τις πιο εμβληματικές party παραλίες της Μυκόνου, γνωστή για τα τιρκουάζ νερά, τα DJ sets και τη ζωντανή beach-club ατμόσφαιρα σε δραματικό βραχώδη κόλπο.'
    ),
    makeBeachNarrative(
        ['Paradise Beach'],
        'The original Mykonos party beach since the 1960s, with golden sand, shallow water and a legendary after-dark energy that still draws crowds.',
        'Η πρωτότυπη party παραλία της Μυκόνου από τη δεκαετία του 1960, με χρυσαφένια άμμο, ρηχά νερά και θρυλική νυχτερινή ενέργεια που προσελκύει ακόμα κόσμο.'
    ),
    makeBeachNarrative(
        ['Ψαρρού', 'Psarou'],
        'Mykonos\' most exclusive beach — a sheltered bay with crystal water where luxury yachts anchor and high-end beach clubs set the tone.',
        'Η πιο exclusive παραλία της Μυκόνου — ένας προφυλαγμένος όρμος με κρυστάλλινα νερά όπου αγκυροβολούν πολυτελή γιοτ και τα beach clubs δίνουν τον τόνο.'
    ),
    makeBeachNarrative(
        ['Πλατύς Γιαλός', 'Platis Gialos'],
        'A wide, well-organised sandy beach popular with families, and a hub for water-taxi boats to the south-coast beaches of Mykonos.',
        'Φαρδιά, καλά οργανωμένη αμμουδερή παραλία δημοφιλής στις οικογένειες, και αφετηρία για θαλάσσια ταξί προς τις νότιες παραλίες της Μυκόνου.'
    ),
    makeBeachNarrative(
        ['Όρνος', 'Ornos'],
        'A family-friendly bay close to Mykonos town, with calm shallow water, tavernas on the waterfront and a relaxed, less hectic vibe.',
        'Οικογενειακός κόλπος κοντά στη Χώρα Μυκόνου, με ήρεμα ρηχά νερά, ταβέρνες στο νερό και χαλαρή, λιγότερο φρενήρη ατμόσφαιρα.'
    ),
    makeBeachNarrative(
        ['Άγιος Στέφανος'],
        'One of the closest beaches to Mykonos town and the old port, with views of Delos island and a mellow sunset-watching character.',
        'Από τις πιο κοντινές παραλίες στη Χώρα Μυκόνου και το παλιό λιμάνι, με θέα τη Δήλο και ήρεμο χαρακτήρα ηλιοβασιλέματος.'
    ),

    // --- Naxos ---
    makeBeachNarrative(
        ['Agios Prokopios', 'Άγιος Προκόπιος'],
        'Regularly voted one of Greece\'s best beaches: a long sweep of fine white sand with shallow turquoise water and dunes behind it.',
        'Ψηφίζεται τακτικά μια από τις καλύτερες παραλίες της Ελλάδας: μεγάλη λωρίδα ψιλής λευκής άμμου με ρηχά τιρκουάζ νερά και αμμόλοφους πίσω της.'
    ),
    makeBeachNarrative(
        ['Agia Anna', 'Αγία Άννα'],
        'A charming small beach next to Agios Prokopios, with fishing boats, tamarisk trees and a picturesque fishing-village atmosphere.',
        'Γοητευτική μικρή παραλία δίπλα στον Άγιο Προκόπιο, με ψαρόβαρκες, αρμυρίκια και γραφική ατμόσφαιρα ψαροχωριού.'
    ),
    makeBeachNarrative(
        ['Plaka', 'Πλάκα'],
        'Naxos\' longest and most unspoilt beach — kilometres of fine sand, dunes and cedars with enough space that it never feels crowded.',
        'Η μεγαλύτερη και πιο ανέγγιχτη παραλία της Νάξου — χιλιόμετρα ψιλής άμμου, αμμοθίνες και κέδρα με τόσο χώρο που δεν νιώθεις ποτέ συνωστισμό.'
    ),
    makeBeachNarrative(
        ['Mikri Vigla', 'Μικρή Βίγλα'],
        'A windsurfer\'s paradise split into two sides by a rocky headland: one calm for swimming, one windy for kitesurfing and windsurfing.',
        'Παράδεισος για windsurfers χωρισμένος σε δύο πλευρές από βραχώδες ακρωτήρι: μία ήρεμη για κολύμπι, μία φυσαγμένη για kitesurfing και windsurfing.'
    ),

    // --- Paros ---
    makeBeachNarrative(
        ['Kolymbithres', 'Κολυμπήθρες'],
        'Smooth granite boulders sculpted by wind and sea create natural rock pools and hidden coves — Paros\' most photogenic and distinctive beach.',
        'Λείοι γρανιτένιοι ογκόλιθοι σμιλεμένοι από τον αέρα και τη θάλασσα δημιουργούν φυσικές πισίνες και κρυφούς κόλπους — η πιο φωτογενής και ιδιαίτερη παραλία της Πάρου.',
        'The wind-carved granite is what makes Kolymbithres unique in the Cyclades. Small coves between smooth boulders create natural pools that feel intimate and sheltered, even when the rest of Paros is breezy.',
        'Ο γρανίτης σμιλεμένος από τον αέρα κάνει τις Κολυμπήθρες μοναδικές στις Κυκλάδες. Μικροί κόλποι ανάμεσα σε λείους ογκόλιθους δημιουργούν φυσικές πισίνες που δίνουν αίσθηση οικειότητας και προστασίας, ακόμα κι όταν φυσά στην υπόλοιπη Πάρο.'
    ),
    makeBeachNarrative(
        ['Golden Beach', 'Χρυσή Ακτή'],
        'Paros\' longest sandy beach and a world-class windsurfing spot, with professional competitions held here thanks to the reliable meltemi winds.',
        'Η μεγαλύτερη αμμουδιά της Πάρου και σπότ windsurf παγκόσμιας κλάσης, με επαγγελματικούς αγώνες χάρη στα αξιόπιστα μελτέμια.'
    ),
    makeBeachNarrative(
        ['Σάντα Μαρία', 'Santa Maria'],
        'A beautiful twin bay in the northeast of Paros with fine sand, clear water and a young, energetic atmosphere from the beach bars.',
        'Πανέμορφος διπλός κόλπος στα βορειοανατολικά της Πάρου με ψιλή άμμο, διάφανα νερά και νεανική ενέργεια από τα beach bars.'
    ),

    // --- Milos ---
    makeBeachNarrative(
        ['Firiplaka', 'Φυριπλάκα'],
        'Colourful volcanic cliffs in reds, yellows and whites frame this sheltered sandy beach — one of Milos\' most vivid coastal compositions.',
        'Πολύχρωμοι ηφαιστειακοί βράχοι σε κόκκινα, κίτρινα και λευκά πλαισιώνουν αυτή την προφυλαγμένη αμμουδιά — μια από τις πιο ζωηρές παράκτιες συνθέσεις της Μήλου.'
    ),
    makeBeachNarrative(
        ['Papafragas', 'Παπάφραγκας'],
        'A dramatic sea cave with a narrow passage to a hidden swimming pool between sheer rock walls — Milos at its most adventurous.',
        'Εντυπωσιακή θαλάσσια σπηλιά με στενό πέρασμα σε κρυφή πισίνα ανάμεσα σε κατακόρυφους βράχους — η Μήλος στην πιο περιπετειώδη πλευρά της.'
    ),

    // --- Ios ---
    makeBeachNarrative(
        ['Mylopotas', 'Μυλοπότας'],
        'Ios\' signature beach: a long golden crescent with vibrant beach bars, water sports and views of the Chora above — lively by day and night.',
        'Η παραλία-σήμα κατατεθέν της Ίου: χρυσαφένιο μισοφέγγαρο με ζωντανά beach bars, θαλάσσια σπορ και θέα τη Χώρα ψηλά — ζωντανή μέρα και νύχτα.'
    ),
    makeBeachNarrative(
        ['Manganari', 'Μαγγανάρι'],
        'A cluster of sheltered coves on the south coast of Ios with emerald water and white sand — far from the party scene, purely about nature.',
        'Σύμπλεγμα προφυλαγμένων κόλπων στη νότια ακτή της Ίου με σμαραγδένια νερά και λευκή άμμο — μακριά από τα πάρτι, αποκλειστικά για φύση.'
    ),

    // --- Folegandros ---
    makeBeachNarrative(
        ['Katergo', 'Κάτεργο'],
        'Folegandros\' wildest beach, reachable only by boat or a steep hike — a remote pebble cove with impossibly clear water and rugged cliffs.',
        'Η πιο άγρια παραλία της Φολεγάνδρου, προσβάσιμη μόνο με βάρκα ή απότομη πεζοπορία — απομακρυσμένος βοτσαλωτός κόλπος με απίστευτα καθαρά νερά και άγριους βράχους.',
        'Katergo earns its reputation by being genuinely hard to reach. The effort filters out the crowd, and what you find is a raw, unspoilt cove where the water quality is exceptional even by Cycladic standards.',
        'Το Κάτεργο κερδίζει τη φήμη του ακριβώς επειδή η πρόσβαση είναι πραγματικά δύσκολη. Η προσπάθεια φιλτράρει τον κόσμο, και αυτό που βρίσκεις είναι ένας ακατέργαστος, ανέγγιχτος κόλπος με εξαιρετική ποιότητα νερού ακόμα και για τα κυκλαδίτικα δεδομένα.'
    ),
    makeBeachNarrative(
        ['Angali', 'Αγκάλη'],
        'Folegandros\' most social beach, a sandy cove with tavernas, tamarisk shade and sunset views that have made it a Cycladic favourite.',
        'Η πιο κοινωνική παραλία της Φολεγάνδρου, ένας αμμουδερός κόλπος με ταβέρνες, σκιά από αρμυρίκια και ηλιοβασιλέματα που την έκαναν αγαπημένη στις Κυκλάδες.'
    ),
    makeBeachNarrative(
        ['Livadaki', 'Λιβαδάκι'],
        'A remote beach on Folegandros reached by a trail through the landscape — rewarding swimmers with solitude and stunning blue water.',
        'Μια απομακρυσμένη παραλία της Φολεγάνδρου που φτάνεις με μονοπάτι μέσα στο τοπίο — ανταμείβει τους κολυμβητές με μοναξιά και εκπληκτικά γαλάζια νερά.'
    ),

    // --- Tinos ---
    makeBeachNarrative(
        ['Κολυμπήθρα', 'Kolympithra'],
        'Tinos\' most famous beach: twin bays offering a calmer west side for families and a wilder east side loved by surfers when the meltemi blows.',
        'Η πιο γνωστή παραλία της Τήνου: δύο κόλποι με μια πιο ήρεμη δυτική πλευρά για οικογένειες και μια πιο άγρια ανατολική που αγαπούν οι surfers όταν φυσά μελτέμι.'
    ),

    // --- Andros ---
    makeBeachNarrative(
        ['Vitali', 'Βιτάλι'],
        'A wild beach on the east coast of Andros reached by a dirt road through green valleys — popular with surfers and nature lovers seeking remoteness.',
        'Άγρια παραλία στην ανατολική ακτή της Άνδρου, προσβάσιμη με χωματόδρομο μέσα από πράσινες κοιλάδες — δημοφιλής σε surfers και λάτρεις της φύσης που ψάχνουν απομόνωση.'
    ),
    makeBeachNarrative(
        ['Της γριας το πήδημα'],
        'Named after the dramatic rock formation rising from the sea like a frozen leap, this Andros beach combines geological wonder with a memorable swim.',
        'Πήρε το όνομά της από τον εντυπωσιακό βράχο που υψώνεται από τη θάλασσα σαν παγωμένο πήδημα — αυτή η παραλία της Άνδρου συνδυάζει γεωλογικό θαύμα με αξέχαστο μπάνιο.'
    ),

    // --- Amorgos ---
    makeBeachNarrative(
        ['Agia Anna Amorgos', 'Αγία Άννα Αμοργός'],
        'The small beach below the famous Hozoviotissa monastery, with pebbles, deep blue water and one of the most dramatic cliff backdrops in the Aegean.',
        'Η μικρή παραλία κάτω από το ξακουστό μοναστήρι της Χοζοβιώτισσας, με βότσαλα, βαθύ μπλε νερό και ένα από τα πιο δραματικά βραχώδη σκηνικά στο Αιγαίο.'
    ),

    // --- Serifos ---
    makeBeachNarrative(
        ['Livadakia', 'Λιβαδάκια'],
        'A sandy beach just south of the port of Serifos with tamarisk trees, a relaxed taverna scene and views of the hilltop Chora above.',
        'Αμμουδερή παραλία νότια του λιμανιού της Σερίφου με αρμυρίκια, χαλαρή ταβέρνα σκηνή και θέα τη Χώρα στο ύψωμα πάνω.'
    ),
    makeBeachNarrative(
        ['Ganema', 'Γάνεμα'],
        'A secluded sandy beach on Serifos with no development — just wind, waves and untouched Cycladic coast at its most elemental.',
        'Απομονωμένη αμμουδιά στη Σέριφο χωρίς ανάπτυξη — μόνο αέρας, κύματα και ανέγγιχτη κυκλαδίτικη ακτή στην πιο ουσιαστική της μορφή.'
    ),

    // --- Sifnos ---
    makeBeachNarrative(
        ['Vathy', 'Βαθύ'],
        'A sheltered bay surrounded by olive groves and traditional pottery workshops — Sifnos\' most photogenic coastal village with a sandy beach.',
        'Προφυλαγμένος κόλπος τριγυρισμένος από ελαιώνες και παραδοσιακά κεραμικά εργαστήρια — το πιο φωτογενές παραλιακό χωριό της Σίφνου με αμμουδιά.'
    ),

    // --- Koufonisia ---
    makeBeachNarrative(
        ['Pori', 'Πόρι'],
        'Koufonisia\'s most famous beach: a crescent of white sand with shallow Caribbean-like water and natural rock pools carved into the coastline.',
        'Η πιο γνωστή παραλία των Κουφονησίων: ένα μισοφέγγαρο λευκής άμμου με ρηχά καραϊβικά νερά και φυσικές πισίνες σκαλισμένες στη βραχώδη ακτογραμμή.'
    ),

    // --- Anafi ---
    makeBeachNarrative(
        ['Roukounas', 'Ρούκουνας'],
        'Anafi\'s longest and most beloved beach — a wide sweep of golden sand beneath the dramatic Kalamos rock, with a free-spirited, off-grid atmosphere.',
        'Η μεγαλύτερη και πιο αγαπημένη παραλία της Ανάφης — μεγάλη λωρίδα χρυσαφένιας άμμου κάτω από τον εντυπωσιακό βράχο του Καλάμου, με ελεύθερη, off-grid ατμόσφαιρα.'
    ),

    // --- Syros ---
    makeBeachNarrative(
        ['Γαλησσάς', 'Galissas'],
        'The most popular beach on Syros: a wide sandy bay with shallow water, beach bars and a convenient location close to Ermoupoli.',
        'Η πιο δημοφιλής παραλία της Σύρου: φαρδύς αμμουδερός κόλπος με ρηχά νερά, beach bars και βολική τοποθεσία κοντά στην Ερμούπολη.'
    )
];

const findCuratedBeachNarrative = (name: string): CuratedBeachNarrative | null => {
    const normalizedName = normalizeBeachLookup(name);
    if (normalizedName.length < 3) return null;

    for (const narrative of CURATED_BEACH_NARRATIVES) {
        for (const alias of narrative.aliases) {
            const normalizedAlias = normalizeBeachLookup(alias);
            if (normalizedAlias.length < 3) continue;
            if (normalizedName.includes(normalizedAlias) || normalizedAlias.includes(normalizedName)) {
                return narrative;
            }
        }
    }

    return null;
};

const ATTICA_SHORT_DESCRIPTIONS: Record<string, { en: string; gr: string }> = {
    "Παραλία Φλοίσβου": {
        en: "A city seafront stop beside Flisvos Marina, better for a quick coastal walk and sunset view than a long swim.",
        gr: "Αστικό παραλιακό σημείο δίπλα στη μαρίνα Φλοίσβου, πιο ταιριαστό για βόλτα και θέα στο ηλιοβασίλεμα παρά για μεγάλη εξόρμηση."
    },
    "Παλμύρα": {
        en: "A small Glyfada beach close to the tram line, handy for a quick dip on the Athens Riviera.",
        gr: "Μικρή παραλία της Γλυφάδας κοντά στο τραμ, βολική για γρήγορη βουτιά στην Αθηναϊκή Ριβιέρα."
    },
    "Παραλία Μπάτη": {
        en: "An easy-access Palaio Faliro beach by Batis Park, with a very urban character and promenade right behind it.",
        gr: "Εύκολη παραλία στο Παλαιό Φάληρο δίπλα στο πάρκο Μπάτη, με έντονα αστικό χαρακτήρα και πεζόδρομο από πίσω."
    },
    "Παραλία Έδεμ": {
        en: "One of the closest swimming spots to central Athens, with shallow water and the tram stop almost on the waterfront.",
        gr: "Από τα πιο κοντινά σημεία για μπάνιο στο κέντρο της Αθήνας, με ρηχά νερά και στάση τραμ σχεδόν πάνω στην ακτή."
    },
    "Α' Πλαζ Αλίμου «Στολίδι»": {
        en: "A classic Alimos organized beach, known as Stolidi, with easy city access and a long sandy-shingle shore.",
        gr: "Κλασική οργανωμένη πλαζ του Αλίμου, γνωστή ως Στολίδι, με εύκολη πρόσβαση από την πόλη και μακρύ αμμοβοτσαλωτό μέτωπο."
    },
    "Ακτή του Ήλιου": {
        en: "Alimos' large organized beach, known for beach bars, facilities and a lively summer atmosphere inside the city.",
        gr: "Η μεγάλη οργανωμένη ακτή του Αλίμου, γνωστή για beach bars, παροχές και ζωντανή καλοκαιρινή ατμόσφαιρα μέσα στην πόλη."
    },
    "Άγιος Κοσμάς": {
        en: "A south Athens coastal spot near the former airport zone, with open Saronic views and a local, low-key feel.",
        gr: "Παραλιακό σημείο στη νότια Αθήνα κοντά στην παλιά ζώνη του αεροδρομίου, με ανοιχτή θέα στον Σαρωνικό και ήσυχο τοπικό ύφος."
    },
    "Παραλία Αγίου Αλεξάνδρου": {
        en: "A small Elliniko beach named after Agios Alexandros, mostly used by locals for a fast swim close to the city.",
        gr: "Μικρή παραλία στο Ελληνικό που παίρνει το όνομά της από τον Άγιο Αλέξανδρο, κυρίως για γρήγορη βουτιά των κατοίκων της περιοχής."
    },
    "Παραλία Γλυφάδας Ακτή Α": {
        en: "The first Glyfada public beach section, a convenient urban shore with sand, pebbles and quick access from Poseidonos Avenue.",
        gr: "Το πρώτο δημόσιο τμήμα της παραλίας Γλυφάδας, βολική αστική ακτή με άμμο, βότσαλο και άμεση πρόσβαση από την Ποσειδώνος."
    },
    "Παραλία Γλυφάδας Ακτή Β": {
        en: "A central Glyfada beach section with an everyday local feel and the shops and cafes of the suburb close by.",
        gr: "Κεντρικό τμήμα της παραλίας Γλυφάδας με καθημερινό τοπικό χαρακτήρα και τα μαγαζιά της περιοχής σε μικρή απόσταση."
    },
    "Παραλία Γλυφάδας Ακτή Γ": {
        en: "A quieter Glyfada shore section, useful when the more central beaches are busy and you still want easy access.",
        gr: "Πιο ήσυχο τμήμα της ακτής Γλυφάδας, χρήσιμο όταν οι κεντρικές παραλίες γεμίζουν αλλά θέλεις ακόμη εύκολη πρόσβαση."
    },
    "Παραλία Γλυφάδας Ακτή Δ": {
        en: "The southern Glyfada public beach stretch, with open sea views and a simple, no-frills swimming setup.",
        gr: "Το νοτιότερο δημόσιο τμήμα της Γλυφάδας, με ανοιχτή θέα στη θάλασσα και απλό χαρακτήρα χωρίς πολλές παροχές."
    },
    "Παραλία Αστέρα Γλυφάδας": {
        en: "A Glyfada beach associated with the old Asteria area, more polished than the nearby public shore sections.",
        gr: "Παραλία της Γλυφάδας συνδεδεμένη με την περιοχή των παλιών Αστεριών, πιο προσεγμένη από τα γύρω δημόσια τμήματα."
    },
    "Παραλία Βούλας": {
        en: "A broad Voula beach on the Athens Riviera, popular for easy access, shallow water and a family-friendly rhythm.",
        gr: "Φαρδιά παραλία της Βούλας στην Αθηναϊκή Ριβιέρα, δημοφιλής για την εύκολη πρόσβαση, τα ρηχά νερά και τον οικογενειακό ρυθμό."
    },
    "Β' πλαζ Βούλας": {
        en: "Voula's second beach section, a classic organized Riviera stop with sunbeds, services and calm water on many days.",
        gr: "Η δεύτερη πλαζ της Βούλας, κλασική οργανωμένη στάση της Ριβιέρας με ξαπλώστρες, παροχές και συχνά ήρεμα νερά."
    },
    "Μικρό Καβούρι": {
        en: "A sheltered Kavouri cove with shallow clear water, small sandy pockets and one of the Riviera's easiest family swims.",
        gr: "Προστατευμένος κολπίσκος στο Καβούρι με ρηχά καθαρά νερά, μικρές αμμουδιές και από τις πιο εύκολες οικογενειακές βουτιές της Ριβιέρας."
    },
    "Παραλία Βάρκιζας": {
        en: "A large sandy Varkiza beach with organized sections and water-sports energy, especially lively in summer.",
        gr: "Μεγάλη αμμουδερή παραλία στη Βάρκιζα με οργανωμένα τμήματα και έντονη παρουσία θαλάσσιων σπορ, ιδιαίτερα ζωντανή το καλοκαίρι."
    },
    "Μεγάλο Καβούρι": {
        en: "A wide Kavouri bay with calm shallow water, pine-framed edges and a relaxed south-suburbs beach mood.",
        gr: "Μεγάλος κόλπος στο Καβούρι με ήρεμα ρηχά νερά, πεύκα στις άκρες και χαλαρή ατμόσφαιρα νότιων προαστίων."
    },
    "Νηρηίδες": {
        en: "A small Vouliagmeni cove near Kavouri, known for clear water, rocks around the edges and a quieter feel.",
        gr: "Μικρός κολπίσκος στη Βουλιαγμένη κοντά στο Καβούρι, γνωστός για καθαρά νερά, βράχια στα άκρα και πιο ήρεμη αίσθηση."
    },
    "Αστέρας Βουλιαγμένης": {
        en: "The premium Astir beach of Vouliagmeni, famous for polished facilities, fine sand and the classic luxury-Riviera setting.",
        gr: "Η premium ακτή του Αστέρα Βουλιαγμένης, γνωστή για προσεγμένες παροχές, ψιλή άμμο και κλασικό σκηνικό πολυτελούς Ριβιέρας."
    },
    "Πλαζ λίμνης": {
        en: "The beach by Vouliagmeni Lake, where the thermal lake landscape gives the swim a very different Attica character.",
        gr: "Παραλία δίπλα στη Λίμνη Βουλιαγμένης, όπου το τοπίο της ιαματικής λίμνης δίνει στη βουτιά τελείως διαφορετικό χαρακτήρα Αττικής."
    },
    "Παναγίτσα η Δύτισσα": {
        en: "A tiny Vouliagmeni spot by the sea chapel, with rocks, clear water and a quiet local identity.",
        gr: "Μικρό σημείο στη Βουλιαγμένη δίπλα στο θαλασσινό εκκλησάκι, με βράχια, καθαρά νερά και ήρεμη τοπική ταυτότητα."
    },
    "Λιμανάκια Βουλιαγμένης": {
        en: "Rocky coves below the Vouliagmeni road, loved for deep blue water, diving rocks and a wilder Riviera feel.",
        gr: "Βραχώδεις κολπίσκοι κάτω από τον δρόμο της Βουλιαγμένης, αγαπημένοι για βαθιά μπλε νερά, βουτιές από βράχια και πιο άγρια αίσθηση Ριβιέρας."
    },
    "Λιμανάκια Βουλιαγμένης Γυμνιστών": {
        en: "A more secluded rocky part of Limanakia, traditionally used by nudists and confident swimmers who prefer deep water.",
        gr: "Πιο απομονωμένο βραχώδες σημείο στα Λιμανάκια, παραδοσιακά για γυμνιστές και έμπειρους κολυμβητές που προτιμούν βαθιά νερά."
    },
    "Παραλία Φλέβες": {
        en: "A boat-access beach on Fleves islet opposite Vouliagmeni, with clear water and a small-island feel near Athens.",
        gr: "Παραλία στη νησίδα Φλέβες απέναντι από τη Βουλιαγμένη, προσβάσιμη με σκάφος, με καθαρά νερά και αίσθηση μικρού νησιού κοντά στην Αθήνα."
    },
    "Παραλία Αγριλέζας": {
        en: "A remote Lavreotiki shore near the old mining landscape, with a rougher natural setting than the organized Riviera beaches.",
        gr: "Απόμερη ακτή της Λαυρεωτικής κοντά στο παλιό μεταλλευτικό τοπίο, με πιο άγριο φυσικό χαρακτήρα από τις οργανωμένες ακτές της Ριβιέρας."
    },
    "Παραλία Ακρωτηρίου": {
        en: "A small cape-side beach in eastern Attica, suited to a quiet swim when winds and waves are friendly.",
        gr: "Μικρή παραλία κοντά σε ακρωτήριο της ανατολικής Αττικής, κατάλληλη για ήσυχη βουτιά όταν βοηθούν οι άνεμοι."
    },
    "Παραλία Αγίας Παρασκευής": {
        en: "A local East Attica beach named after the nearby chapel, with a simple shoreline and a neighborhood feel.",
        gr: "Τοπική παραλία της ανατολικής Αττικής που παίρνει το όνομά της από το κοντινό εκκλησάκι, με απλή ακτογραμμή και γειτονικό χαρακτήρα."
    },
    "Παραλία Αγίου Κωνσταντίνου": {
        en: "A small Lavrio-area beach by Agios Konstantinos, close to old mining settlements and quiet Saronic views.",
        gr: "Μικρή παραλία στην περιοχή του Αγίου Κωνσταντίνου Λαυρίου, κοντά σε παλιούς μεταλλευτικούς οικισμούς και ήρεμη θέα στον Σαρωνικό."
    },
    "Παραλία Αγκώνα": {
        en: "A low-key East Attica cove, more useful for a peaceful local swim than for organized beach facilities.",
        gr: "Χαμηλών τόνων κολπίσκος στην ανατολική Αττική, περισσότερο για ήρεμη τοπική βουτιά παρά για οργανωμένες παροχές."
    },
    "Μικρό Σέσι": {
        en: "A small cove near Sesi and Grammatiko, usually quieter than the main beach and framed by a natural coastline.",
        gr: "Μικρός κολπίσκος κοντά στο Σέσι και το Γραμματικό, συνήθως πιο ήσυχος από την κεντρική παραλία και μέσα σε φυσική ακτογραμμή."
    },
    "Θέρετρο Αξιωματικών Ναυτικού": {
        en: "The Navy Officers' resort beach near Agios Andreas, known for an organized, orderly coastal setting.",
        gr: "Η παραλία του Θέρετρου Αξιωματικών Ναυτικού κοντά στον Άγιο Ανδρέα, γνωστή για οργανωμένο και τακτοποιημένο παραλιακό περιβάλλον."
    },
    "Παραλία Σχινιά": {
        en: "A long sandy beach beside Schinias National Park, with pine forest, shallow water and wind-sport conditions on breezy days.",
        gr: "Μεγάλη αμμουδερή παραλία δίπλα στο Εθνικό Πάρκο Σχινιά, με πευκοδάσος, ρηχά νερά και συνθήκες για wind sports όταν φυσά."
    },
    "Παραλία Μαραθώνα": {
        en: "A long, easy Marathon coast with shallow water and fish taverns nearby, good for a relaxed family swim.",
        gr: "Μεγάλη και εύκολη ακτή στον Μαραθώνα με ρηχά νερά και ψαροταβέρνες κοντά, καλή για χαλαρό οικογενειακό μπάνιο."
    },
    "Παραλία Ζούμπερι": {
        en: "A Nea Makri favorite with beach bars, families and a casual summer rhythm close to Athens.",
        gr: "Αγαπημένη παραλία της Νέας Μάκρης με beach bars, οικογένειες και χαλαρό καλοκαιρινό ρυθμό κοντά στην Αθήνα."
    },
    "Όρμος Ληδάκι": {
        en: "A small Rafina-area inlet with a tucked-away feel, best for a quiet stop rather than a full-service beach day.",
        gr: "Μικρός όρμος στην περιοχή της Ραφήνας με κρυμμένη αίσθηση, καλύτερος για ήσυχη στάση παρά για οργανωμένη ημερήσια έξοδο."
    },
    "Πλαζ Ραφήνας": {
        en: "Rafina's town beach, useful before or after a ferry trip and closely tied to the port's everyday life.",
        gr: "Η αστική πλαζ της Ραφήνας, βολική πριν ή μετά από ταξίδι με πλοίο και δεμένη με την καθημερινή ζωή του λιμανιού."
    },
    "Παραλία Αρτέμιδας": {
        en: "A long Artemida beach with shallow water, cafes and steady wind that often brings windsurfers and kitesurfers.",
        gr: "Μεγάλη παραλία της Αρτέμιδας με ρηχά νερά, καφέ και σταθερό αέρα που συχνά φέρνει windsurfers και kitesurfers."
    },
    "Άρτεμις": {
        en: "The main Loutsa-Artemida shore, lively and practical, with restaurants and beach bars directly behind the sand.",
        gr: "Η βασική ακτή της Λούτσας-Αρτέμιδας, ζωντανή και πρακτική, με εστιατόρια και beach bars ακριβώς πίσω από την άμμο."
    },
    "Παραλία Βραυρώνας": {
        en: "A quiet bay near the ancient sanctuary of Artemis, with shallow water and a more historical East Attica setting.",
        gr: "Ήρεμος κόλπος κοντά στο αρχαίο ιερό της Αρτέμιδος, με ρηχά νερά και πιο ιστορικό σκηνικό ανατολικής Αττικής."
    },
    "Μικρή Χαμολιά": {
        en: "A pocket-sized Hamolia cove with clear water and a more secluded mood than the main beach.",
        gr: "Μικρός κολπίσκος στη Χαμολιά με καθαρά νερά και πιο απομονωμένη διάθεση από την κεντρική παραλία."
    },
    "Παραλία Χαμολιά": {
        en: "A local Vravrona beach with pebbly-sandy shore, clear water and a calm, residential atmosphere.",
        gr: "Τοπική παραλία της Βραυρώνας με αμμοβότσαλο, καθαρά νερά και ήρεμη οικιστική ατμόσφαιρα."
    },
    "Παραλία Αράχνες": {
        en: "A small cove near Porto Rafti, known mostly by locals and suited to a quieter swim away from the main bays.",
        gr: "Μικρός κολπίσκος κοντά στο Πόρτο Ράφτη, γνωστός κυρίως σε ντόπιους και κατάλληλος για πιο ήσυχη βουτιά μακριά από τους βασικούς κόλπους."
    },
    "Ερωτοσπηλιά": {
        en: "One of Porto Rafti's prettiest small beaches, with a sheltered cove, pale sand and clear turquoise water.",
        gr: "Μία από τις ομορφότερες μικρές παραλίες του Πόρτο Ράφτη, με προστατευμένο κολπίσκο, ανοιχτόχρωμη άμμο και καθαρά τιρκουάζ νερά."
    },
    "Παραλία Αγίου Σπυρίδωνα": {
        en: "A central Porto Rafti beach by the church of Agios Spyridon, easy for families and evening swims.",
        gr: "Κεντρική παραλία στο Πόρτο Ράφτη δίπλα στον Άγιο Σπυρίδωνα, εύκολη για οικογένειες και απογευματινές βουτιές."
    },
    "Νησίδα Κεκροπούλα": {
        en: "A tiny islet-side swimming spot off Porto Rafti, giving the coastline a small-island character.",
        gr: "Μικρό σημείο για μπάνιο κοντά στη νησίδα Κεκροπούλα στο Πόρτο Ράφτη, που δίνει στην ακτή αίσθηση μικρού νησιού."
    },
    "Αυλάκι": {
        en: "A popular organized Porto Rafti beach with clean water, facilities and a broad bay that works well for families.",
        gr: "Δημοφιλής οργανωμένη παραλία στο Πόρτο Ράφτη με καθαρά νερά, παροχές και μεγάλο κόλπο που βολεύει οικογένειες."
    },
    "Πανόραμα": {
        en: "A small coastal spot near Porto Rafti with open views, mostly chosen for a simple swim and a calmer setting.",
        gr: "Μικρό παραλιακό σημείο κοντά στο Πόρτο Ράφτη με ανοιχτή θέα, κυρίως για απλή βουτιά και πιο ήρεμο περιβάλλον."
    },
    "Κακιά Θάλασσα": {
        en: "A well-known Keratea bay with dramatic rocky sides, clear water and an organized beach area.",
        gr: "Γνωστός κόλπος της Κερατέας με εντυπωσιακά βράχια στα πλάγια, καθαρά νερά και οργανωμένο τμήμα."
    },
    "Παραλία Κοκολόκο": {
        en: "A small Keratea-area cove with an informal feel, better for a quiet local swim than for amenities.",
        gr: "Μικρός κολπίσκος στην περιοχή της Κερατέας με ανεπίσημη αίσθηση, καλύτερος για ήσυχη τοπική βουτιά παρά για παροχές."
    },
    "Λομπάρντα": {
        en: "A coastal stop near Agia Marina and Koropi, known for easy access from the Athens-Sounio road.",
        gr: "Παραλιακό σημείο κοντά στην Αγία Μαρίνα Κορωπίου, γνωστό για την εύκολη πρόσβαση από τη λεωφόρο Αθηνών-Σουνίου."
    },
    "Ηλιόπουλος": {
        en: "A small local beach on the Lagonisi coastline, with a simple shore and a neighborhood summer feel.",
        gr: "Μικρή τοπική παραλία στην ακτογραμμή του Λαγονησίου, με απλή ακτή και καλοκαιρινή αίσθηση γειτονιάς."
    },
    "Παραλία Αλθέας": {
        en: "A favorite Agia Marina cove with clear water, rocks and a compact beach below the coastal road.",
        gr: "Αγαπημένος κολπίσκος στην Αγία Μαρίνα με καθαρά νερά, βράχια και μικρή παραλία κάτω από τον παραλιακό δρόμο."
    },
    "Παραλία Σκάλες Αλθέας": {
        en: "A tiny rocky cove reached by steps near Althea, with clear water and a hidden-beach mood.",
        gr: "Μικρός βραχώδης κολπίσκος που κατεβαίνεις με σκαλάκια κοντά στην Αλθέα, με καθαρά νερά και αίσθηση κρυφής παραλίας."
    },
    "Γαλάζια Ακτή": {
        en: "A Lagonisi beach named for its blue-water look, with a relaxed suburban coast character.",
        gr: "Παραλία στο Λαγονήσι που δικαιολογεί το όνομά της με γαλάζια νερά και χαλαρό χαρακτήρα παραθεριστικού προαστίου."
    },
    "Αρμυρίκια": {
        en: "A small Lagonisi shore where tamarisk trees give welcome shade close to the water.",
        gr: "Μικρή ακτή στο Λαγονήσι όπου τα αρμυρίκια δίνουν πολύτιμη σκιά κοντά στο νερό."
    },
    "Πόρτο Εννέα": {
        en: "A quiet Lagonisi cove with clear water, small-scale villas around it and a residential summer feel.",
        gr: "Ήσυχος κολπίσκος στο Λαγονήσι με καθαρά νερά, μικρές κατοικίες γύρω του και παραθεριστική ατμόσφαιρα."
    },
    "Πεύκο": {
        en: "A modest Lagonisi beach marked by pines and low-key swimming, useful for a calm stop on the coast road.",
        gr: "Σεμνή παραλία στο Λαγονήσι με πεύκα και χαμηλών τόνων μπάνιο, καλή για ήρεμη στάση στον παραλιακό δρόμο."
    },
    "Lagonissi Grand Resort": {
        en: "A resort beach on the Lagonisi peninsula, with polished facilities and some of the most sheltered coves in the area.",
        gr: "Resort παραλία στη χερσόνησο του Λαγονησίου, με προσεγμένες παροχές και μερικούς από τους πιο προστατευμένους κολπίσκους της περιοχής."
    },
    "Καλοπήγαδο": {
        en: "A small East Attica beach with clear water and a quiet coastal road setting between Lagonisi and Saronida.",
        gr: "Μικρή παραλία της ανατολικής Αττικής με καθαρά νερά και ήσυχο παραλιακό σκηνικό ανάμεσα σε Λαγονήσι και Σαρωνίδα."
    },
    "Ευκάλυπτα": {
        en: "A local shore named for the eucalyptus trees nearby, offering a simple, shaded-feeling stop by the water.",
        gr: "Τοπική ακτή που παίρνει το όνομά της από τους ευκαλύπτους της περιοχής, με απλή και κάπως σκιερή αίσθηση δίπλα στο νερό."
    },
    "Τσονίμα": {
        en: "A small Lavreotiki settlement beach with a sheltered bay and an easygoing local summer mood.",
        gr: "Μικρή παραλία οικισμού στη Λαυρεωτική, με προστατευμένο κόλπο και χαλαρή τοπική καλοκαιρινή διάθεση."
    },
    "Κεντρική παραλία Σαρωνίδας": {
        en: "Saronida's main beach, practical and social, with cafes close by and a broad view across the Saronic Gulf.",
        gr: "Η κεντρική παραλία της Σαρωνίδας, πρακτική και κοινωνική, με καφέ κοντά και πλατιά θέα στον Σαρωνικό."
    },
    "Δεύτερη Παραλία Σαρωνίδας": {
        en: "A secondary Saronida beach section, often calmer than the main beach while still close to the town.",
        gr: "Δεύτερο τμήμα της παραλίας Σαρωνίδας, συχνά πιο ήρεμο από την κεντρική ακτή αλλά ακόμη κοντά στον οικισμό."
    },
    "Παραλία Μαύρο Λιθάρι": {
        en: "A popular Saronida-Anavyssos beach named after its dark rock, with beach bars and clear water.",
        gr: "Δημοφιλής παραλία ανάμεσα σε Σαρωνίδα και Ανάβυσσο, με χαρακτηριστικό μαύρο βράχο, beach bars και καθαρά νερά."
    },
    "Εδέμ Αναβύσσου": {
        en: "A small Anavyssos coastal spot with a relaxed local feel and easy access from the Athens-Sounio road.",
        gr: "Μικρό παραλιακό σημείο στην Ανάβυσσο με χαλαρή τοπική αίσθηση και εύκολη πρόσβαση από τη λεωφόρο Αθηνών-Σουνίου."
    },
    "Όρμος Αγίου Νικολάου Γυμνιστών": {
        en: "A quieter part of Agios Nikolaos bay, traditionally used by nudists and people looking for a more discreet swim.",
        gr: "Πιο ήσυχο τμήμα του όρμου Αγίου Νικολάου, παραδοσιακά για γυμνιστές και όσους θέλουν πιο διακριτική βουτιά."
    },
    "Παραλία Αναβύσσου": {
        en: "A wide sandy bay famous for windsurfing and long shallow water, one of the classic beaches south of Athens.",
        gr: "Μεγάλος αμμουδερός κόλπος γνωστός για windsurfing και ρηχά νερά σε μήκος, από τις κλασικές παραλίες νότια της Αθήνας."
    },
    "Όρμος Αγίου Νικολάου": {
        en: "A sheltered Anavyssos bay near the Agios Nikolaos church, with calm water and a more intimate scale.",
        gr: "Προστατευμένος κόλπος στην Ανάβυσσο κοντά στον Άγιο Νικόλαο, με ήρεμα νερά και πιο μικρή, οικεία κλίμακα."
    },
    "Σκαλάκια Αναβύσσου": {
        en: "A small rocky access point near Anavyssos, reached by steps and suited to clear-water swims rather than lounging.",
        gr: "Μικρό βραχώδες σημείο πρόσβασης κοντά στην Ανάβυσσο, με σκαλάκια και χαρακτήρα για καθαρές βουτιές παρά για άπλωμα στην άμμο."
    },
    "Παραλία Αγίου Νικολάου": {
        en: "A small beach at Agios Nikolaos in Anavyssos, close to the chapel and often calmer than the open bay.",
        gr: "Μικρή παραλία στον Άγιο Νικόλαο Αναβύσσου, κοντά στο εκκλησάκι και συχνά πιο ήρεμη από τον ανοιχτό κόλπο."
    },
    "Θυμάρι": {
        en: "A long, low-key coast south of Anavyssos, with clear water and a quieter holiday-home atmosphere.",
        gr: "Μακρύ και χαμηλών τόνων παραλιακό μέτωπο νότια της Αναβύσσου, με καθαρά νερά και πιο ήσυχη ατμόσφαιρα εξοχικών."
    },
    "Πούντα Ζέζα": {
        en: "A Lavreotiki bay with a campsite feel, shallow water and a relaxed family summer character.",
        gr: "Κόλπος της Λαυρεωτικής με αίσθηση camping, ρηχά νερά και χαλαρό οικογενειακό καλοκαιρινό χαρακτήρα."
    },
    "Πασά": {
        en: "A small Sounio-area beach with clear water and a tucked-away feel near the southern tip of Attica.",
        gr: "Μικρή παραλία στην περιοχή του Σουνίου με καθαρά νερά και κρυμμένη αίσθηση κοντά στο νότιο άκρο της Αττικής."
    },
    "Τσίου": {
        en: "A modest local cove in Lavreotiki, best for a quiet swim away from the better-known Sounio beaches.",
        gr: "Σεμνός τοπικός κολπίσκος στη Λαυρεωτική, καλός για ήσυχη βουτιά μακριά από τις πιο γνωστές παραλίες του Σουνίου."
    },
    "Ασημάκη": {
        en: "A small Lavrio-side beach with clear water and a relaxed, neighborhood coastline character.",
        gr: "Μικρή παραλία προς το Λαύριο με καθαρά νερά και χαλαρό χαρακτήρα τοπικής ακτογραμμής."
    },
    "Χάρακας": {
        en: "A beautiful sandy beach on the road to Sounio, known for clear water, a wide bay and a calmer feel than KAPE.",
        gr: "Όμορφη αμμουδερή παραλία στον δρόμο για το Σούνιο, γνωστή για καθαρά νερά, μεγάλο κόλπο και πιο ήρεμη αίσθηση από το ΚΑΠΕ."
    },
    "Παραλία Λεγραινών": {
        en: "A long beach near Legrena with open sea views, clear water and space to spread out even in summer.",
        gr: "Μεγάλη παραλία κοντά στα Λεγραινά με ανοιχτή θέα, καθαρά νερά και αρκετό χώρο ακόμη και το καλοκαίρι."
    },
    "Παραλία ΚΑΠΕ Γυμνιστών": {
        en: "The more secluded side of KAPE beach, below the cliffs, traditionally preferred by nudists and quiet-swim seekers.",
        gr: "Η πιο απομονωμένη πλευρά της παραλίας ΚΑΠΕ, κάτω από τα βράχια, παραδοσιακά για γυμνιστές και όσους θέλουν ησυχία."
    },
    "Παραλία ΚΑΠΕ": {
        en: "A small beach near Sounio below steep rocks, loved for clear water and a more island-like Attica feeling.",
        gr: "Μικρή παραλία κοντά στο Σούνιο κάτω από απότομα βράχια, αγαπημένη για καθαρά νερά και πιο νησιώτικη αίσθηση μέσα στην Αττική."
    },
    "Άγιος Πέτρος": {
        en: "A quiet Sounio-area beach near the chapel of Agios Petros, with clear water and a simple natural shore.",
        gr: "Ήσυχη παραλία στην περιοχή του Σουνίου κοντά στον Άγιο Πέτρο, με καθαρά νερά και απλή φυσική ακτή."
    },
    "Παραλία Σουνίου": {
        en: "The beach below the Temple of Poseidon, famous for swimming with one of Attica's most iconic archaeological views.",
        gr: "Η παραλία κάτω από τον Ναό του Ποσειδώνα, διάσημη για μπάνιο με μία από τις πιο εμβληματικές αρχαιολογικές θέες της Αττικής."
    },
    "Παραλία Περάματος": {
        en: "An urban Perama shoreline facing Salamina, more connected to port life and local walks than a resort-beach mood.",
        gr: "Αστική ακτή στο Πέραμα απέναντι από τη Σαλαμίνα, πιο δεμένη με τη ζωή του λιμανιού και τις τοπικές βόλτες παρά με resort αίσθηση."
    },
    "Κράκαρης": {
        en: "A small Piraeus-area swimming spot with a local character and views toward the busy Saronic coastline.",
        gr: "Μικρό σημείο για μπάνιο στην περιοχή του Πειραιά, με τοπικό χαρακτήρα και θέα προς την πολυσύχναστη ακτογραμμή του Σαρωνικού."
    },
    "Βοτσαλάκια": {
        en: "Kastella's city beach in Piraeus, known for its pebbly shore, sports facilities nearby and quick urban swims.",
        gr: "Η αστική παραλία της Καστέλλας στον Πειραιά, γνωστή για το βοτσαλωτό της μέτωπο, τις κοντινές αθλητικές εγκαταστάσεις και τις γρήγορες βουτιές."
    },
    "Πλαζ Καλαμπάκα": {
        en: "A small Piraeus shore near Freattyda, mainly a local swimming point with the city very close around it.",
        gr: "Μικρή ακτή του Πειραιά κοντά στη Φρεαττύδα, κυρίως τοπικό σημείο για μπάνιο με την πόλη πολύ κοντά γύρω του."
    },
    "Παραλία Φρεαττύδος": {
        en: "A historic Piraeus seafront spot by the ancient harbors, with rocky edges and strong city-coast character.",
        gr: "Ιστορικό παραλιακό σημείο του Πειραιά δίπλα στους αρχαίους λιμένες, με βραχώδεις άκρες και έντονο αστικό-θαλασσινό χαρακτήρα."
    },
    "Ακρογιάλι": {
        en: "A small West Attica seaside stop with a simple shore and a quieter feel than the busier Kineta sections.",
        gr: "Μικρή παραθαλάσσια στάση στη δυτική Αττική με απλή ακτή και πιο ήρεμη αίσθηση από τα πολυσύχναστα σημεία της Κινέτας."
    },
    "Παραλία Κινέτας": {
        en: "A long West Attica beach on the Corinthian Gulf, known for clear water, pebbles and easy access from the old national road.",
        gr: "Μεγάλη παραλία της δυτικής Αττικής στον Κορινθιακό, γνωστή για καθαρά νερά, βότσαλο και εύκολη πρόσβαση από την παλιά εθνική."
    },
    "Παραλία Πόρτο Γερμενό": {
        en: "A broad West Attica cove with clear Corinthian Gulf water and the Aigosthena fortress above the bay.",
        gr: "Μεγάλος κόλπος της δυτικής Αττικής με καθαρά νερά Κορινθιακού και το φρούριο των Αιγοσθένων πάνω από τον όρμο."
    },
    "Παραλία Πόρτο Γερμενό 2": {
        en: "A second Porto Germeno beach section, quieter and useful when the main bay is busy.",
        gr: "Δεύτερο τμήμα της ακτής στο Πόρτο Γερμενό, πιο ήσυχο και χρήσιμο όταν ο κεντρικός κόλπος γεμίζει."
    },
    "Προσήλι": {
        en: "A small West Attica beach near Porto Germeno, with a tucked-away Corinthian Gulf feel.",
        gr: "Μικρή παραλία της δυτικής Αττικής κοντά στο Πόρτο Γερμενό, με πιο κρυμμένη αίσθηση Κορινθιακού."
    },
    "Ψάθα": {
        en: "A long West Attica beach on the Corinthian Gulf, loved for space, sunset light and a quieter road-trip mood.",
        gr: "Μεγάλη παραλία της δυτικής Αττικής στον Κορινθιακό, αγαπημένη για τον χώρο, το φως του ηλιοβασιλέματος και την πιο ήσυχη εκδρομική αίσθηση."
    }
};

const getAtticaShortDescription = (name: string): LocalizedBeachText | null => {
    const normalizedName = normalizeBeachLookup(name);
    const entry = Object.entries(ATTICA_SHORT_DESCRIPTIONS).find(([beachName]) => (
        normalizeBeachLookup(beachName) === normalizedName
    ))?.[1];

    return entry ? makeLocalizedBeachText(entry.en, entry.gr) : null;
};

type ContextualShortDescription = {
    islands: string[];
    en: string;
    gr: string;
    byIsland?: Record<string, { en: string; gr: string }>;
};

const SARONIC_SHORT_DESCRIPTIONS: Record<string, ContextualShortDescription> = {
    "Παραλία Βαγίας": {
        islands: ["Aegina"],
        en: "A quiet north-east Aegina beach near the old fishing village of Vagia, with shallow water and a more local rhythm.",
        gr: "Ήσυχη παραλία στη βορειοανατολική Αίγινα κοντά στο παλιό ψαροχώρι της Βαγίας, με ρηχά νερά και πιο τοπικό ρυθμό."
    },
    "Αγία Μαρίνα": {
        islands: ["Aegina", "Spetses"],
        en: "On Aegina it is the island's big organized sandy resort beach, while on Spetses it is the cove often known as Paradise.",
        gr: "Στην Αίγινα είναι η μεγάλη οργανωμένη αμμουδερή παραλία του νησιού, ενώ στις Σπέτσες είναι ο κολπίσκος που συχνά λέγεται Paradise.",
        byIsland: {
            Aegina: {
                en: "Aegina's largest organized sandy beach, known for shallow water, tourist facilities and its link with the Temple of Aphaia route.",
                gr: "Η μεγαλύτερη οργανωμένη αμμουδερή παραλία της Αίγινας, γνωστή για ρηχά νερά, τουριστικές παροχές και σύνδεση με τη διαδρομή προς τον Ναό της Αφαίας."
            },
            Spetses: {
                en: "The Spetses cove often known as Paradise, close to town but with clearer, more sheltered water than the harbour-side beaches.",
                gr: "Ο κολπίσκος των Σπετσών που συχνά λέγεται Paradise, κοντά στη χώρα αλλά με πιο καθαρά και προστατευμένα νερά από τις ακτές δίπλα στο λιμάνι."
            }
        }
    },
    "Αιγινήτισσα": {
        islands: ["Aegina"],
        en: "A west-coast Aegina beach with pine shade, sunset views and a relaxed beach-bar atmosphere near Perdika.",
        gr: "Δυτική παραλία της Αίγινας με πεύκα για σκιά, θέα στο ηλιοβασίλεμα και χαλαρή beach-bar ατμόσφαιρα κοντά στην Πέρδικα."
    },
    "Αύρα": {
        islands: ["Aegina"],
        en: "A small town beach beside Aegina port and Kolona, ideal for a quick swim without leaving the harbour area.",
        gr: "Μικρή αστική παραλία δίπλα στο λιμάνι της Αίγινας και την Κολώνα, ιδανική για γρήγορη βουτιά χωρίς να φύγεις από τη χώρα."
    },
    "Βοτσαλωτή Παραλία": {
        islands: ["Aegina"],
        en: "A simple pebbly shore on Aegina's east side, better for a quiet stop than for organized facilities.",
        gr: "Απλή βοτσαλωτή ακτή στην ανατολική πλευρά της Αίγινας, πιο κατάλληλη για ήσυχη στάση παρά για οργανωμένες παροχές."
    },
    "Κλειδί": {
        islands: ["Aegina"],
        en: "Also known as Klima, this south Aegina beach is loved for clear water and a small, photogenic bay near Perdika.",
        gr: "Γνωστή και ως Κλίμα, αυτή η νότια παραλία της Αίγινας αγαπιέται για τα καθαρά νερά και τον μικρό φωτογενή κόλπο κοντά στην Πέρδικα."
    },
    "Λουτρά": {
        islands: ["Aegina"],
        en: "A Souvala-side beach tied to the area's old thermal-spa identity, with a calm local coastline.",
        gr: "Παραλία προς τη Σουβάλα, δεμένη με την παλιά ιαματική ταυτότητα της περιοχής και μια ήρεμη τοπική ακτογραμμή."
    },
    "Παραλία Ζινόβι": {
        islands: ["Aegina"],
        en: "A small north-west Aegina beach near the coast road, mostly useful for a quiet local dip.",
        gr: "Μικρή παραλία στη βορειοδυτική Αίγινα κοντά στον παραλιακό δρόμο, κυρίως για ήσυχη τοπική βουτιά."
    },
    "Παραλία Καμάρες": {
        islands: ["Aegina"],
        en: "A modest Aegina shoreline near Souvala, with a residential feel and easy access from the north coast road.",
        gr: "Σεμνή ακτή της Αίγινας κοντά στη Σουβάλα, με οικιστική αίσθηση και εύκολη πρόσβαση από τον βόρειο παραλιακό δρόμο."
    },
    "Παραλία Κολώνα": {
        islands: ["Aegina"],
        en: "A tiny beach below the archaeological site of Kolona, where the swim comes with ancient ruins almost overhead.",
        gr: "Μικρή παραλία κάτω από τον αρχαιολογικό χώρο της Κολώνας, όπου το μπάνιο γίνεται σχεδόν δίπλα στα αρχαία."
    },
    "Παραλία Μαραθώνα": {
        islands: ["Aegina"],
        en: "A popular west-coast Aegina beach with tavernas, shallow water and one of the island's easiest family swims.",
        gr: "Δημοφιλής δυτική παραλία της Αίγινας με ταβέρνες, ρηχά νερά και από τις πιο εύκολες οικογενειακές βουτιές του νησιού."
    },
    "Παραλία Μαραθώνα Α": {
        islands: ["Aegina"],
        en: "The first Marathonas section, close to the road and tavernas, practical for a quick and easy Aegina swim.",
        gr: "Το πρώτο τμήμα του Μαραθώνα, κοντά στον δρόμο και τις ταβέρνες, πρακτικό για γρήγορο και εύκολο μπάνιο στην Αίγινα."
    },
    "Παραλία Μαραθώνα Β": {
        islands: ["Aegina"],
        en: "The second Marathonas section, a little more spread out, with the same calm west-coast family character.",
        gr: "Το δεύτερο τμήμα του Μαραθώνα, λίγο πιο απλωμένο, με τον ίδιο ήρεμο οικογενειακό χαρακτήρα της δυτικής ακτής."
    },
    "Παραλία Σαρπά": {
        islands: ["Aegina"],
        en: "A small beach near Perdika, known for clear water, sunset light and a quieter south-west Aegina mood.",
        gr: "Μικρή παραλία κοντά στην Πέρδικα, γνωστή για καθαρά νερά, φως ηλιοβασιλέματος και πιο ήρεμη νοτιοδυτική αίσθηση Αίγινας."
    },
    "Τούρλος": {
        islands: ["Aegina"],
        en: "A secluded east-coast Aegina spot near Vagia, useful for a quieter swim away from the main resort beaches.",
        gr: "Απόμερο σημείο στην ανατολική ακτή της Αίγινας κοντά στη Βαγία, για πιο ήσυχη βουτιά μακριά από τις βασικές οργανωμένες παραλίες."
    },
    "Σουβάλα": {
        islands: ["Aegina"],
        en: "A north Aegina beach by the small port of Souvala, with tavernas nearby and an easy village-seafront feel.",
        gr: "Βόρεια παραλία της Αίγινας δίπλα στο μικρό λιμάνι της Σουβάλας, με ταβέρνες κοντά και εύκολη αίσθηση παραθαλάσσιου χωριού."
    },
    "Παραλία Μεγαλοχωρίου": {
        islands: ["Agistri"],
        en: "A practical Agistri beach by Megalochori, close to the harbour and ideal for a simple swim after arrival.",
        gr: "Πρακτική παραλία στο Μεγαλοχώρι Αγκιστρίου, κοντά στο λιμανάκι και ιδανική για απλή βουτιά μετά την άφιξη."
    },
    "Σκληρή": {
        islands: ["Agistri"],
        en: "A small Agistri cove below pine-covered slopes, with clear water and a slightly tucked-away feel near Skala.",
        gr: "Μικρός κολπίσκος στο Αγκίστρι κάτω από πευκόφυτες πλαγιές, με καθαρά νερά και λίγο κρυμμένη αίσθηση κοντά στη Σκάλα."
    },
    "Δραγονέρα": {
        islands: ["Agistri"],
        en: "A west-coast Agistri beach backed by pines, popular for shade, clear water and a relaxed island-day-trip mood.",
        gr: "Δυτική παραλία του Αγκιστρίου με πεύκα από πίσω, δημοφιλής για σκιά, καθαρά νερά και χαλαρή αίσθηση ημερήσιας εκδρομής."
    },
    "Χαλικιάδα": {
        islands: ["Agistri"],
        en: "Agistri's wilder pebble cove below cliffs, reached by a rough path and known for deep turquoise water.",
        gr: "Ο πιο άγριος βοτσαλωτός κολπίσκος του Αγκιστρίου κάτω από βράχια, με δύσκολο μονοπάτι και βαθιά τιρκουάζ νερά."
    },
    "Μανδράκι": {
        islands: ["Hydra"],
        en: "Hydra's sandy organised bay east of town, once a small harbour and now a polished beach escape.",
        gr: "Ο αμμουδερός οργανωμένος κόλπος της Ύδρας ανατολικά της πόλης, παλιό μικρό λιμάνι που έγινε προσεγμένη παραλιακή απόδραση."
    },
    "Αυλάκι": {
        islands: ["Hydra"],
        en: "A rocky Hydra swimming spot just beyond town, with deep clear water and classic platform-style access.",
        gr: "Βραχώδες σημείο για μπάνιο λίγο έξω από την πόλη της Ύδρας, με βαθιά καθαρά νερά και κλασική πρόσβαση από πλατώματα."
    },
    "Καμίνια": {
        islands: ["Hydra"],
        en: "A small beach by the fishing harbour of Kamini, combining a village walk, tavernas and calm evening swims.",
        gr: "Μικρή παραλία στο ψαρολίμανο Καμίνι, που συνδυάζει βόλτα σε χωριό, ταβέρνες και ήρεμες απογευματινές βουτιές."
    },
    "Πλάκες": {
        islands: ["Hydra"],
        en: "A pebbly Hydra beach near Vlychos, quieter than the town rocks and often reached by water taxi or coastal walk.",
        gr: "Βοτσαλωτή παραλία της Ύδρας κοντά στον Βλυχό, πιο ήσυχη από τα βράχια της χώρας και συχνά προσβάσιμη με θαλάσσιο ταξί ή παραλιακή βόλτα."
    },
    "Σπηλιά": {
        islands: ["Hydra"],
        en: "The iconic rocky swim spot under Hydra town, with platforms, deep water and the island's port life right above.",
        gr: "Το εμβληματικό βραχώδες σημείο για μπάνιο κάτω από τη χώρα της Ύδρας, με πλατώματα, βαθιά νερά και τη ζωή του λιμανιού ακριβώς από πάνω."
    },
    "Λιμανάκι της Αγάπης": {
        islands: ["Poros"],
        en: "Poros' famous Love Bay, a tiny pine-shaded cove with green water and one of the island's most romantic settings.",
        gr: "Το γνωστό Love Bay του Πόρου, μικρός πευκόσκιος κολπίσκος με πράσινα νερά και από τα πιο ρομαντικά σκηνικά του νησιού."
    },
    "Άγιος Στέφανος": {
        islands: ["Poros"],
        en: "A small Poros beach near the chapel of Agios Stefanos, quieter and more local than Askeli or Neorio.",
        gr: "Μικρή παραλία του Πόρου κοντά στο εκκλησάκι του Αγίου Στεφάνου, πιο ήσυχη και τοπική από το Ασκέλι ή το Νεώριο."
    },
    "Αλυκή": {
        islands: ["Poros"],
        en: "A calm beach on the Galatas side facing Poros, with shallow water and a lagoon-like coastal feel.",
        gr: "Ήρεμη παραλία στην πλευρά του Γαλατά απέναντι από τον Πόρο, με ρηχά νερά και αίσθηση λιμνοθαλασσινής ακτής."
    },
    "Ασκέλι": {
        islands: ["Poros"],
        en: "Poros' largest and most practical resort beach, with long sand, water sports and plenty of places to eat nearby.",
        gr: "Η μεγαλύτερη και πιο πρακτική οργανωμένη παραλία του Πόρου, με μεγάλη αμμουδιά, θαλάσσια σπορ και πολλά σημεία για φαγητό κοντά."
    },
    "Βαγιονιά": {
        islands: ["Poros"],
        en: "A quiet northern Poros bay with a sunken ancient settlement offshore, making it especially interesting for snorkeling.",
        gr: "Ήσυχος βόρειος κόλπος του Πόρου με βυθισμένο αρχαίο οικισμό ανοιχτά, κάτι που τον κάνει ιδιαίτερα ενδιαφέρον για μάσκα."
    },
    "Κανάλι": {
        islands: ["Poros"],
        en: "The closest proper beach to Poros town, handy for a quick swim without leaving the main settlement.",
        gr: "Η πιο κοντινή κανονική παραλία στη χώρα του Πόρου, βολική για γρήγορη βουτιά χωρίς να φύγεις από τον βασικό οικισμό."
    },
    "Μεγάλο Νεώριο": {
        islands: ["Poros"],
        en: "A sheltered Neorio bay with pine shade, calm water and classic views back toward Poros town.",
        gr: "Προστατευμένος κόλπος στο Νεώριο με πεύκα για σκιά, ήρεμα νερά και κλασική θέα προς τη χώρα του Πόρου."
    },
    "Μικρό Νεώριο": {
        islands: ["Poros"],
        en: "A smaller Neorio cove, more intimate than the main beach and good for a quiet swim near town.",
        gr: "Μικρότερος κολπίσκος στο Νεώριο, πιο οικείος από την κεντρική παραλία και καλός για ήσυχη βουτιά κοντά στη χώρα."
    },
    "Μοναστήρι": {
        islands: ["Poros"],
        en: "A beach below the Monastery of Zoodochos Pigi, with clear water and one of Poros' most distinctive backdrops.",
        gr: "Παραλία κάτω από τη Μονή Ζωοδόχου Πηγής, με καθαρά νερά και ένα από τα πιο χαρακτηριστικά φόντα του Πόρου."
    },
    "Παραλία Ρώσικος Ναύσταθμος": {
        islands: ["Poros"],
        en: "A historic Poros bay beside the ruins of the Russian naval station, mixing calm water with a rare Saronic landmark.",
        gr: "Ιστορικός κόλπος του Πόρου δίπλα στα ερείπια του Ρώσικου Ναυστάθμου, που συνδυάζει ήρεμα νερά με σπάνιο σαρωνικό τοπόσημο."
    },
    "Πλάκα": {
        islands: ["Poros"],
        en: "A small Galatas-side beach facing Poros, with easy water access and a quiet mainland-coast feel.",
        gr: "Μικρή παραλία στην πλευρά του Γαλατά απέναντι από τον Πόρο, με εύκολη πρόσβαση στο νερό και ήρεμη αίσθηση ηπειρωτικής ακτής."
    },
    "Μικρό Λαμπρανό": {
        islands: ["Salamina"],
        en: "A small Salamina cove near Kanakia, best for a quiet local swim on the greener south-west side of the island.",
        gr: "Μικρός κολπίσκος της Σαλαμίνας κοντά στα Κανάκια, για ήσυχη τοπική βουτιά στην πιο πράσινη νοτιοδυτική πλευρά του νησιού."
    },
    "Παραλία Αγίου Νικολάου": {
        islands: ["Salamina"],
        en: "A local Salamina beach named after Agios Nikolaos, with simple access and a calm neighbourhood character.",
        gr: "Τοπική παραλία της Σαλαμίνας που παίρνει το όνομά της από τον Άγιο Νικόλαο, με απλή πρόσβαση και ήρεμο χαρακτήρα γειτονιάς."
    },
    "Παραλία Κανάκια": {
        islands: ["Salamina"],
        en: "One of Salamina's best-known beaches, set in a pine-framed bay on the quieter south-west coast.",
        gr: "Μία από τις πιο γνωστές παραλίες της Σαλαμίνας, σε πευκόφυτο κόλπο στη πιο ήσυχη νοτιοδυτική ακτή."
    },
    "Άγιοι Ανάργυροι": {
        islands: ["Spetses"],
        en: "A large west-coast Spetses beach near Bekiris Cave, with deep clear water and a wilder excursion feel.",
        gr: "Μεγάλη δυτική παραλία των Σπετσών κοντά στη Σπηλιά του Μπεκίρη, με βαθιά καθαρά νερά και πιο εκδρομικό χαρακτήρα."
    },
    "Άγιος Μάμας": {
        islands: ["Spetses"],
        en: "The town beach of Spetses, right by Dapia, easy for a quick swim and notable for accessible facilities.",
        gr: "Η παραλία της πόλης των Σπετσών δίπλα στη Ντάπια, εύκολη για γρήγορη βουτιά και γνωστή για την προσβασιμότητά της."
    },
    "Αγία Παρασκευή": {
        islands: ["Spetses"],
        en: "A pine-backed west Spetses bay with clear water, a chapel above the beach and a quieter, green setting.",
        gr: "Πευκόφυτος δυτικός κόλπος των Σπετσών με καθαρά νερά, εκκλησάκι πάνω από την παραλία και πιο ήσυχο πράσινο σκηνικό."
    },
    "Βρέλλος": {
        islands: ["Spetses"],
        en: "A north-west Spetses beach with pebbles, pines and a relaxed bar scene without losing its natural feel.",
        gr: "Βορειοδυτική παραλία των Σπετσών με βότσαλο, πεύκα και χαλαρό beach-bar ύφος χωρίς να χάνει τη φυσική της αίσθηση."
    },
    "Καΐκι": {
        islands: ["Spetses"],
        en: "A lively organized beach close to town, known for music, sunbeds and easy access from the old harbour side.",
        gr: "Ζωντανή οργανωμένη παραλία κοντά στη χώρα, γνωστή για μουσική, ξαπλώστρες και εύκολη πρόσβαση από την πλευρά του παλιού λιμανιού."
    },
    "Καμάρες": {
        islands: ["Spetses"],
        en: "A small west Spetses beach with a quieter cove feel, away from the busier town-side swimming spots.",
        gr: "Μικρή δυτική παραλία των Σπετσών με πιο ήσυχη αίσθηση κολπίσκου, μακριά από τα πολυσύχναστα σημεία της χώρας."
    },
    "Κουζουνός": {
        islands: ["Spetses"],
        en: "A south-east Spetses beach looking toward Spetsopoula, with clear water and a more remote island edge.",
        gr: "Νοτιοανατολική παραλία των Σπετσών με θέα προς τη Σπετσοπούλα, καθαρά νερά και πιο απόμακρη νησιώτικη άκρη."
    },
    "Λιγονέρι": {
        islands: ["Spetses"],
        en: "A north-coast Spetses beach with pebbles, clear water and a calmer mood than the central organized beaches.",
        gr: "Βόρεια παραλία των Σπετσών με βότσαλο, καθαρά νερά και πιο ήρεμη διάθεση από τις κεντρικές οργανωμένες ακτές."
    },
    "Μεγάλη Ζωγερία": {
        islands: ["Spetses"],
        en: "One of Spetses' most beautiful bays, framed by pine forest and known for emerald water on the north-west coast.",
        gr: "Ένας από τους ομορφότερους κόλπους των Σπετσών, αγκαλιασμένος από πευκοδάσος και γνωστός για τα σμαραγδένια νερά στη βορειοδυτική ακτή."
    },
    "Ξυλοκέριζα": {
        islands: ["Spetses"],
        en: "A quieter south Spetses beach with a natural coastline and a more off-the-main-route character.",
        gr: "Πιο ήσυχη νότια παραλία των Σπετσών με φυσική ακτογραμμή και χαρακτήρα έξω από τη βασική διαδρομή."
    }
};

const getSaronicShortDescription = (name: string, area: string): LocalizedBeachText | null => {
    const normalizedName = normalizeBeachLookup(name);
    const normalizedArea = normalizeBeachLookup(area);

    const match = Object.entries(SARONIC_SHORT_DESCRIPTIONS).find(([beachName, description]) => {
        const normalizedBeachName = normalizeBeachLookup(beachName);
        const matchesName = normalizedBeachName === normalizedName;
        const matchesArea = description.islands.some(island => {
            const normalizedIsland = normalizeBeachLookup(island);
            return normalizedArea === normalizedIsland || normalizedArea.includes(normalizedIsland);
        });
        return matchesName && matchesArea;
    });

    const entry = match?.[1];
    const islandSpecificEntry = entry?.byIsland
        ? Object.entries(entry.byIsland).find(([island]) => {
            const normalizedIsland = normalizeBeachLookup(island);
            return normalizedArea === normalizedIsland || normalizedArea.includes(normalizedIsland);
        })?.[1]
        : null;

    return islandSpecificEntry
        ? makeLocalizedBeachText(islandSpecificEntry.en, islandSpecificEntry.gr)
        : entry ? makeLocalizedBeachText(entry.en, entry.gr) : null;
};

const IONIAN_ISLAND_LABELS: Record<string, { en: string; gr: string }> = {
    corfu: { en: 'Corfu', gr: 'Κέρκυρα' },
    paxos: { en: 'Paxos', gr: 'Παξούς' },
    antipaxos: { en: 'Antipaxos', gr: 'Αντίπαξους' },
    kefalonia: { en: 'Kefalonia', gr: 'Κεφαλονιά' },
    ithaca: { en: 'Ithaca', gr: 'Ιθάκη' },
    ithaki: { en: 'Ithaca', gr: 'Ιθάκη' },
    lefkada: { en: 'Lefkada', gr: 'Λευκάδα' },
    meganisi: { en: 'Meganisi', gr: 'Μεγανήσι' },
    othonoi: { en: 'Othonoi', gr: 'Οθωνούς' },
    erikoussa: { en: 'Erikoussa', gr: 'Ερείκουσσα' },
    mathraki: { en: 'Mathraki', gr: 'Μαθράκι' },
    zakynthos: { en: 'Zakynthos', gr: 'Ζάκυνθο' }
};

const IONIAN_NOTABLE_DESCRIPTIONS: Record<string, ContextualShortDescription> = {
    "Ναυάγιο": {
        islands: ["Zakynthos"],
        en: "Zakynthos' landmark cove with sheer white cliffs and the famous shipwreck, usually viewed from above or by boat when access allows.",
        gr: "Ο εμβληματικός κολπίσκος της Ζακύνθου με κατακόρυφα λευκά βράχια και το γνωστό ναυάγιο, συνήθως για θέα από ψηλά ή προσέγγιση με καραβάκι όταν επιτρέπεται."
    },
    "Παραλία Γέρακας": {
        islands: ["Zakynthos"],
        en: "A protected sandy nesting beach for Caretta caretta turtles, with a quieter, conservation-led rhythm.",
        gr: "Προστατευμένη αμμουδερή παραλία ωοτοκίας της Caretta caretta, με πιο ήσυχο χαρακτήρα που καθορίζεται από την προστασία της φύσης."
    },
    "Σεκάνια": {
        islands: ["Zakynthos"],
        en: "One of the most important Caretta caretta nesting beaches in the Mediterranean, with access heavily restricted for protection.",
        gr: "Μία από τις σημαντικότερες παραλίες ωοτοκίας Caretta caretta στη Μεσόγειο, με πολύ περιορισμένη πρόσβαση για λόγους προστασίας."
    },
    "Laganas beach": {
        islands: ["Zakynthos"],
        en: "Zakynthos' busiest south-coast beach, where nightlife sits beside the wider turtle-protection zone of Laganas Bay.",
        gr: "Η πιο ζωντανή νότια παραλία της Ζακύνθου, όπου η νυχτερινή ζωή συνυπάρχει με τη ζώνη προστασίας της θαλάσσιας χελώνας στον κόλπο του Λαγανά."
    },
    "Ξύγκια": {
        islands: ["Zakynthos"],
        en: "A small north-east Zakynthos cove known for sulphur-rich water and a distinctive mineral scent.",
        gr: "Μικρός βορειοανατολικός κολπίσκος της Ζακύνθου, γνωστός για τα θειούχα νερά και τη χαρακτηριστική μεταλλική μυρωδιά."
    },
    "Μικρή Ξύγκια": {
        islands: ["Zakynthos"],
        en: "The smaller Xigia cove, with the same sulphur-spring character and clearer, more compact swimming setting.",
        gr: "Ο μικρότερος κολπίσκος της Ξύγκιας, με τον ίδιο θειούχο χαρακτήρα και πιο μικρή, καθαρή λεκάνη για μπάνιο."
    },
    "Porto Limnionas": {
        islands: ["Zakynthos"],
        en: "A dramatic west-coast rocky inlet with deep blue water, caves and a fjord-like shape.",
        gr: "Εντυπωσιακός βραχώδης όρμος στη δυτική Ζάκυνθο, με βαθιά μπλε νερά, σπηλιές και σχήμα που θυμίζει μικρό φιόρδ."
    },
    "Πόρτο Βρώμη": {
        islands: ["Zakynthos"],
        en: "A narrow west-coast inlet used for boat trips toward Navagio and the blue caves, with steep white rock around it.",
        gr: "Στενός δυτικός όρμος για βαρκάδες προς το Ναυάγιο και τις σπηλιές, με απότομα λευκά βράχια γύρω του."
    },
    "Banana Beach": {
        islands: ["Zakynthos"],
        en: "A long, organized Vasilikos beach with shallow water, beach bars and one of Zakynthos' most social summer scenes.",
        gr: "Μεγάλη οργανωμένη παραλία στον Βασιλικό, με ρηχά νερά, beach bars και από τα πιο κοινωνικά καλοκαιρινά σημεία της Ζακύνθου."
    },
    "Dafni Beach": {
        islands: ["Zakynthos"],
        en: "A Vasilikos beach inside the marine-park zone, known for turtle nesting and a slower, more natural pace.",
        gr: "Παραλία του Βασιλικού μέσα στη ζώνη του θαλάσσιου πάρκου, γνωστή για ωοτοκία χελωνών και πιο φυσικό, ήρεμο ρυθμό."
    },
    "Παραλία Μαραθονήσι": {
        islands: ["Zakynthos"],
        en: "A boat-access beach on Turtle Island, with soft sand and protected nesting habitat in Laganas Bay.",
        gr: "Παραλία με πρόσβαση με καραβάκι στο Μαραθονήσι, με μαλακή άμμο και προστατευμένο βιότοπο ωοτοκίας στον κόλπο του Λαγανά."
    },
    "Μύρτος": {
        islands: ["Kefalonia"],
        en: "Kefalonia's signature beach, a huge white-pebble amphitheatre under steep cliffs with famously electric blue water.",
        gr: "Η εμβληματική παραλία της Κεφαλονιάς, τεράστιο λευκό βοτσαλωτό αμφιθέατρο κάτω από απότομα βράχια και διάσημα γαλάζια νερά."
    },
    "Αντίσαμος": {
        islands: ["Kefalonia"],
        en: "A green-backed bay near Sami, known for clear deep water and the cinematic Kefalonia landscape seen in Captain Corelli's Mandolin.",
        gr: "Πράσινος κόλπος κοντά στη Σάμη, γνωστός για καθαρά βαθιά νερά και το κινηματογραφικό τοπίο της Κεφαλονιάς από το Captain Corelli's Mandolin."
    },
    "Xi Beach": {
        islands: ["Kefalonia"],
        en: "A south Paliki beach with orange-red sand and pale clay cliffs, one of Kefalonia's most recognizable shorelines.",
        gr: "Παραλία της νότιας Παλικής με κοκκινωπή άμμο και ανοιχτόχρωμους αργιλικούς βράχους, από τις πιο αναγνωρίσιμες ακτές της Κεφαλονιάς."
    },
    "Πετανι": {
        islands: ["Kefalonia"],
        en: "A dramatic Paliki bay with white pebbles, sunset views and a wilder west-coast feel.",
        gr: "Εντυπωσιακός κόλπος της Παλικής με λευκό βότσαλο, θέα στο ηλιοβασίλεμα και πιο άγρια δυτική αίσθηση."
    },
    "Fteri Beach": {
        islands: ["Kefalonia"],
        en: "A remote white-pebble beach usually reached by boat or hike, prized for clear water and a secluded west-coast mood.",
        gr: "Απόμερη λευκή βοτσαλωτή παραλία που συνήθως προσεγγίζεται με καραβάκι ή πεζοπορία, με καθαρά νερά και απομονωμένη δυτική αίσθηση."
    },
    "Παραλία Γιδάκι": {
        islands: ["Kefalonia"],
        en: "An Ithaca-side white-pebble bay with bright water, often approached by boat and loved for its clean, open setting.",
        gr: "Λευκός βοτσαλωτός κόλπος στην Ιθάκη με φωτεινά νερά, συχνά με πρόσβαση από καραβάκι και καθαρό ανοιχτό σκηνικό."
    },
    "Παραλία Φιλιατρό": {
        islands: ["Kefalonia"],
        en: "A popular Ithaca beach near Vathy, with clear water, pebbles and easy access for a full beach day.",
        gr: "Δημοφιλής παραλία της Ιθάκης κοντά στο Βαθύ, με καθαρά νερά, βότσαλο και εύκολη πρόσβαση για ολοήμερο μπάνιο."
    },
    "Πόρτο Κάτσικι": {
        islands: ["Lefkada"],
        en: "Lefkada's postcard beach beneath sheer limestone cliffs, famous for bright blue water and a dramatic stairway descent.",
        gr: "Η καρτ-ποστάλ παραλία της Λευκάδας κάτω από κάθετους ασβεστολιθικούς βράχους, διάσημη για τα έντονα μπλε νερά και την κατηφορική πρόσβαση με σκαλιά."
    },
    "Εγκρεμνοί": {
        islands: ["Lefkada"],
        en: "A vast west-coast beach below high cliffs, with pale pebbles and the open Ionian blue at full scale.",
        gr: "Τεράστια δυτική παραλία κάτω από ψηλούς βράχους, με ανοιχτόχρωμο βότσαλο και το Ιόνιο μπλε σε πλήρη κλίμακα."
    },
    "Κάθισμα": {
        islands: ["Lefkada"],
        en: "A long west-coast Lefkada beach with big Ionian colour, organized sections and a lively sunset crowd.",
        gr: "Μεγάλη δυτική παραλία της Λευκάδας με έντονο Ιόνιο χρώμα, οργανωμένα τμήματα και ζωντανό κόσμο στο ηλιοβασίλεμα."
    },
    "Μύλος": {
        islands: ["Lefkada"],
        en: "A wilder beach near Agios Nikitas, reached by path or boat and known for space, wind and raw west-coast scenery.",
        gr: "Πιο άγρια παραλία κοντά στον Άγιο Νικήτα, με πρόσβαση από μονοπάτι ή καραβάκι και γνωστή για χώρο, αέρα και ατόφιο δυτικό τοπίο."
    },
    "Βασιλική": {
        islands: ["Lefkada"],
        en: "A famous windsurfing bay where afternoon thermal winds make the beach as much about sails as swimming.",
        gr: "Διάσημος κόλπος για windsurfing, όπου οι απογευματινοί θερμικοί άνεμοι κάνουν την παραλία τόσο ιστιοπλοϊκή όσο και κολυμβητική."
    },
    "Αγιοφύλλι": {
        islands: ["Lefkada"],
        en: "A small cove near Vasiliki with bright water, white stones and a classic boat-trip feel.",
        gr: "Μικρός κολπίσκος κοντά στη Βασιλική με φωτεινά νερά, λευκές πέτρες και κλασική αίσθηση εκδρομής με καραβάκι."
    },
    "Πόρτο Τιμόνι": {
        islands: ["Corfu"],
        en: "Corfu's twin-bay landmark at Afionas, where two beaches sit back-to-back below a steep footpath.",
        gr: "Το διπλό τοπόσημο της Κέρκυρας στον Αφιώνα, με δύο παραλίες πλάτη με πλάτη κάτω από απότομο μονοπάτι."
    },
    "Κανάλι του Έρωτα": {
        islands: ["Corfu"],
        en: "Sidari's sculpted sandstone channel, famous for narrow rock passages and one of Corfu's most photographed north-coast scenes.",
        gr: "Το σμιλεμένο ψαμμιτικό κανάλι στο Σιδάρι, διάσημο για τα στενά περάσματα βράχων και από τα πιο φωτογραφημένα βόρεια τοπία της Κέρκυρας."
    },
    "Παραλία Γλυφάδας": {
        islands: ["Corfu"],
        en: "A broad west Corfu sandy beach below green hills, with organized life and strong sunset colour.",
        gr: "Μεγάλη αμμουδερή παραλία στη δυτική Κέρκυρα κάτω από πράσινους λόφους, με οργανωμένη ζωή και έντονο χρώμα στο ηλιοβασίλεμα."
    },
    "Issos Beach": {
        islands: ["Corfu"],
        en: "A long sandy beach beside the Korission lagoon dunes, giving south-west Corfu a wilder, open-horizon feel.",
        gr: "Μεγάλη αμμουδερή παραλία δίπλα στους αμμόλοφους της λιμνοθάλασσας Κορισσίων, με πιο άγριο ανοιχτό ορίζοντα στη νοτιοδυτική Κέρκυρα."
    },
    "Παραλία Χαλικούνα": {
        islands: ["Corfu"],
        en: "A long wind-exposed beach by Lake Korission, known for dunes, kites and a raw south-west Corfu landscape.",
        gr: "Μεγάλη ανεμοδαρμένη παραλία δίπλα στη λίμνη Κορισσίων, γνωστή για αμμόλοφους, kite και ατόφιο νοτιοδυτικό τοπίο Κέρκυρας."
    },
    "Ροβινιά": {
        islands: ["Corfu"],
        en: "A Liapades cove with clear emerald water, pale pebbles and high green slopes around it.",
        gr: "Κολπίσκος στους Λιαπάδες με καθαρά σμαραγδένια νερά, ανοιχτόχρωμο βότσαλο και ψηλές πράσινες πλαγιές γύρω του."
    },
    "Παραλία Μυρτιώτισσας": {
        islands: ["Corfu"],
        en: "A secluded west Corfu beach below cliffs and monastery paths, long associated with naturism and deep green scenery.",
        gr: "Απομονωμένη δυτική παραλία της Κέρκυρας κάτω από βράχια και μονοπάτια μονής, συνδεδεμένη χρόνια με γυμνισμό και βαθύ πράσινο τοπίο."
    },
    "Βουτούμι": {
        islands: ["Paxos"],
        en: "Antipaxos' celebrated turquoise bay, with white pebbles and water that feels almost pool-clear.",
        gr: "Ο διάσημος τιρκουάζ κόλπος των Αντίπαξων, με λευκό βότσαλο και νερά σχεδόν πισίνας."
    },
    "Βρίκα": {
        islands: ["Paxos"],
        en: "A soft-sand Antipaxos beach with shallow bright water, often paired with Voutoumi on boat trips.",
        gr: "Αμμουδερή παραλία των Αντίπαξων με ρηχά φωτεινά νερά, συχνά μαζί με το Βουτούμι στις εκδρομές με καραβάκι."
    },
    "Ερημίτης": {
        islands: ["Paxos"],
        en: "A dramatic west Paxos beach below pale cliffs, famous for sunset light and a wilder approach.",
        gr: "Εντυπωσιακή δυτική παραλία των Παξών κάτω από ανοιχτόχρωμους βράχους, διάσημη για το φως του ηλιοβασιλέματος και την πιο άγρια πρόσβαση."
    },
    "Μονοδένδρι": {
        islands: ["Paxos"],
        en: "A north-east Paxos beach with clear water, beach facilities and easy access near Lakka.",
        gr: "Βορειοανατολική παραλία των Παξών με καθαρά νερά, παροχές και εύκολη πρόσβαση κοντά στη Λάκκα."
    }
};

const getIonianIslandKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const islandKey of Object.keys(IONIAN_ISLAND_LABELS)) {
        const normalizedIsland = normalizeBeachLookup(islandKey);
        if (normalizedArea === normalizedIsland || normalizedArea.includes(normalizedIsland)) {
            return islandKey;
        }
    }
    return null;
};

const getIonianShortDescription = (name: string, area: string): LocalizedBeachText | null => {
    const islandKey = getIonianIslandKey(area);
    if (!islandKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const exact = Object.entries(IONIAN_NOTABLE_DESCRIPTIONS).find(([beachName, description]) => {
        const matchesName = normalizeBeachLookup(beachName) === normalizedName;
        const matchesIsland = description.islands.some(island => normalizeBeachLookup(island) === islandKey);
        return matchesName && matchesIsland;
    })?.[1];

    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const island = IONIAN_ISLAND_LABELS[islandKey];
    const beachLabel = name.replace(/^Παραλία\s+/i, '').trim();
    const lowerName = normalizeBeachLookup(name);

    if (lowerName.includes('gialos') || lowerName.includes('γιαλος') || lowerName.includes('γιαλου')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a small Ionian shore on ${island.en}, shaped around a local bay rather than a big resort strip.`,
            `Η ${beachLabel} είναι μικρή ιονική ακτή στην ${island.gr}, με χαρακτήρα τοπικού όρμου αντί για μεγάλη οργανωμένη ζώνη.`
        );
    }

    if (lowerName.includes('porto') || lowerName.includes('πορτο') || lowerName.includes('ορμος') || lowerName.includes('bay')) {
        return makeLocalizedBeachText(
            `${beachLabel} has the feel of a sheltered Ionian inlet on ${island.en}, best for clear-water swimming when the sea is calm.`,
            `Η ${beachLabel} έχει αίσθηση προστατευμένου ιονικού όρμου στην ${island.gr}, ιδανική για καθαρή βουτιά όταν η θάλασσα είναι ήρεμη.`
        );
    }

    if (lowerName.includes('ammos') || lowerName.includes('αμμος') || lowerName.includes('αμμου')) {
        return makeLocalizedBeachText(
            `${beachLabel} stands out on ${island.en} for its sandier shore, making it easier for families and longer swims.`,
            `Η ${beachLabel} ξεχωρίζει στην ${island.gr} για την πιο αμμουδερή ακτή της, που βολεύει οικογένειες και μεγαλύτερες βουτιές.`
        );
    }

    if (lowerName.includes('nudist') || lowerName.includes('naturist') || lowerName.includes('γυμνιστων')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a more discreet ${island.en} swimming spot, usually chosen by people looking for a quieter, freer beach mood.`,
            `Η ${beachLabel} είναι πιο διακριτικό σημείο για μπάνιο στην ${island.gr}, συνήθως για όσους θέλουν ησυχία και πιο ελεύθερη ατμόσφαιρα.`
        );
    }

    const variants = [
        {
            en: `${beachLabel} is a local ${island.en} beach with clear Ionian water and a calmer feel than the island's headline beaches.`,
            gr: `Η ${beachLabel} είναι τοπική παραλία στην ${island.gr}, με καθαρά ιονικά νερά και πιο ήρεμη αίσθηση από τις διάσημες ακτές του νησιού.`
        },
        {
            en: `${beachLabel} gives ${island.en} a quieter coastal stop, useful when you want the island's sea without the busiest beach scene.`,
            gr: `Η ${beachLabel} προσφέρει στην ${island.gr} μια πιο ήσυχη παραλιακή στάση, για μπάνιο χωρίς τον πολύ κόσμο των πιο γνωστών σημείων.`
        },
        {
            en: `${beachLabel} is one of those smaller ${island.en} shores where the main appeal is simple access to clean Ionian water.`,
            gr: `Η ${beachLabel} είναι από τις μικρότερες ακτές στην ${island.gr}, όπου το βασικό προτέρημα είναι η απλή πρόσβαση σε καθαρό Ιόνιο νερό.`
        },
        {
            en: `${beachLabel} works as a low-key ${island.en} swim stop, with the landscape doing more of the talking than the facilities.`,
            gr: `Η ${beachLabel} λειτουργεί ως χαμηλών τόνων στάση για μπάνιο στην ${island.gr}, με το τοπίο να μετρά περισσότερο από τις παροχές.`
        }
    ];
    const index = Math.abs(normalizedName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length;
    return makeLocalizedBeachText(variants[index].en, variants[index].gr);
};

const EVIA_NOTABLE_DESCRIPTIONS: Record<string, { en: string; gr: string }> = {
    "Χιλιαδού": {
        en: "Evia's most emblematic wild beach, set below Dirfi's green slopes with pebbles, deep water and a famously free-spirited mood.",
        gr: "Η πιο εμβληματική άγρια παραλία της Εύβοιας, κάτω από τις πράσινες πλαγιές της Δίρφυς, με βότσαλο, βαθιά νερά και διάσημη ελεύθερη ατμόσφαιρα."
    },
    "Χιλιαδού παραλία Γυμνιστών": {
        en: "The secluded side of Chiliadou, traditionally used by naturists and swimmers who prefer the wilder end of the bay.",
        gr: "Η πιο απομονωμένη πλευρά της Χιλιαδούς, παραδοσιακά για γυμνιστές και όσους προτιμούν το πιο άγριο άκρο του κόλπου."
    },
    "Θαψά": {
        en: "A remote turquoise cove on central Evia, reached by a rough road and loved for its almost island-like isolation.",
        gr: "Απόμερος τιρκουάζ κολπίσκος στην κεντρική Εύβοια, με δύσκολο δρόμο και αγαπημένος για την σχεδόν νησιώτικη απομόνωσή του."
    },
    "Κορασίδα": {
        en: "A striking east Evia beach with clear blue water, white pebbles and cliffs that make the bay feel dramatic.",
        gr: "Εντυπωσιακή ανατολική παραλία της Εύβοιας με καθαρά μπλε νερά, λευκό βότσαλο και βράχια που δίνουν δραματικό χαρακτήρα στον κόλπο."
    },
    "Κάλαμος": {
        en: "A well-loved east Evia beach split into two coves, known for bright water and easy summer access near Avlonari.",
        gr: "Αγαπημένη ανατολική παραλία της Εύβοιας σε δύο κολπίσκους, γνωστή για φωτεινά νερά και εύκολη καλοκαιρινή πρόσβαση κοντά στο Αυλωνάρι."
    },
    "Κακιά": {
        en: "The smaller cove beside Kalamos, quieter and rockier, useful when the main beach is busy.",
        gr: "Ο μικρότερος κολπίσκος δίπλα στον Κάλαμο, πιο ήσυχος και βραχώδης, χρήσιμος όταν η κύρια παραλία γεμίζει."
    },
    "Στόμιο": {
        en: "A south-east Evia beach near Oxylithos and Kymi, with open Aegean water and a simple local feel.",
        gr: "Νοτιοανατολική παραλία της Εύβοιας κοντά στον Οξύλιθο και την Κύμη, με ανοιχτά νερά Αιγαίου και απλό τοπικό χαρακτήρα."
    },
    "Χερόμυλος": {
        en: "A quiet beach close to Kalamos and Korasida, with clear water and a less crowded east-coast mood.",
        gr: "Ήσυχη παραλία κοντά στον Κάλαμο και την Κορασίδα, με καθαρά νερά και λιγότερο πολυσύχναστη ανατολική αίσθηση."
    },
    "Λημνιώνας": {
        en: "A sheltered bay in south Evia near Styra, with calm water and a small-harbour atmosphere.",
        gr: "Προστατευμένος κόλπος στη νότια Εύβοια κοντά στα Στύρα, με ήρεμα νερά και αίσθηση μικρού λιμανιού."
    },
    "Λιμνιώνας": {
        en: "A north-west Evia beach near Limni, with easy access, local tavernas and calm Euboean Gulf water.",
        gr: "Παραλία της βορειοδυτικής Εύβοιας κοντά στη Λίμνη, με εύκολη πρόσβαση, τοπικές ταβέρνες και ήρεμα νερά του Ευβοϊκού."
    },
    "Αρχάμπολη": {
        en: "A remote south Evia cove tied to ancient quarrying landscapes, reached through a wilder Karystos-side route.",
        gr: "Απόμερος κολπίσκος της νότιας Εύβοιας δεμένος με αρχαία λατομικά τοπία, με πιο άγρια πρόσβαση από την πλευρά της Καρύστου."
    },
    "Ποτάμι": {
        en: "At its south Evia setting, Potami is a windswept beach near Cavo Doro with open Aegean water and raw scenery.",
        gr: "Στη νότια Εύβοια, το Ποτάμι είναι ανεμοδαρμένη παραλία κοντά στο Κάβο Ντόρο, με ανοιχτά νερά Αιγαίου και ατόφιο τοπίο."
    },
    "Μεγάλη Άμμος": {
        en: "A sandy south Evia beach near Marmari, known for wind, shallow stretches and kite-friendly conditions.",
        gr: "Αμμουδερή παραλία της νότιας Εύβοιας κοντά στο Μαρμάρι, γνωστή για αέρα, ρηχά σημεία και συνθήκες για kite."
    },
    "Ζάστανα": {
        en: "A small south Evia beach near Marmari, usually calmer and more local than the larger exposed shores nearby.",
        gr: "Μικρή παραλία της νότιας Εύβοιας κοντά στο Μαρμάρι, συνήθως πιο ήρεμη και τοπική από τις μεγάλες εκτεθειμένες ακτές γύρω της."
    },
    "Πλατύς Γιαλός": {
        en: "A south Evia shore with open Aegean views, chosen for a quieter swim on the Karystos side.",
        gr: "Νότια ευβοϊκή ακτή με ανοιχτή θέα στο Αιγαίο, για πιο ήσυχη βουτιά από την πλευρά της Καρύστου."
    },
    "Πετάλη": {
        en: "A hidden central Evia cove reached through forested mountain roads, with clear water and a proper escape feeling.",
        gr: "Κρυμμένος κολπίσκος της κεντρικής Εύβοιας με πρόσβαση από δασωμένους ορεινούς δρόμους, καθαρά νερά και αίσθηση πραγματικής απόδρασης."
    },
    "Βύθουρη": {
        en: "A steep, secluded east Evia cove below cliffs, loved for deep water and a raw Aegean character.",
        gr: "Απότομος και απομονωμένος κολπίσκος της ανατολικής Εύβοιας κάτω από βράχια, αγαπημένος για βαθιά νερά και ατόφιο αιγαιοπελαγίτικο χαρακτήρα."
    },
    "Παραλία Μετοχίου": {
        en: "A broad east Evia beach below the village of Metochi, with open sea, pebbles and a quieter local rhythm.",
        gr: "Μεγάλη ανατολική παραλία κάτω από το Μετόχι, με ανοιχτή θάλασσα, βότσαλο και πιο ήρεμο τοπικό ρυθμό."
    },
    "Τσίλαρος": {
        en: "A remote central Evia bay near Thapsa, with dramatic slopes and water that turns bright blue in calm weather.",
        gr: "Απόμερος κόλπος της κεντρικής Εύβοιας κοντά στα Θαψά, με εντυπωσιακές πλαγιές και νερά που γίνονται έντονα μπλε όταν έχει άπνοια."
    },
    "Παραλία Καλλιανού": {
        en: "A south Evia beach on the Cavo Doro side, with a wild road-trip feel and open Aegean exposure.",
        gr: "Νότια παραλία της Εύβοιας στην πλευρά του Κάβο Ντόρο, με άγρια αίσθηση road trip και ανοιχτή έκθεση στο Αιγαίο."
    },
    "Παραλία Πευκί": {
        en: "A long north Evia resort beach facing the Pagasetic Gulf, practical for families and evening walks.",
        gr: "Μεγάλη παραλία-θέρετρο στη βόρεια Εύβοια απέναντι στον Παγασητικό, πρακτική για οικογένειες και απογευματινές βόλτες."
    },
    "Παραλία Ψαροπούλι/Βασιλικών": {
        en: "A long north Evia beach at Vasilika, with open Aegean views and a classic summer-village atmosphere.",
        gr: "Μεγάλη βόρεια παραλία στα Βασιλικά, με ανοιχτή θέα στο Αιγαίο και κλασική ατμόσφαιρα καλοκαιρινού χωριού."
    },
    "Αχίλλι": {
        en: "A northern Skyros-side beach in the Evia regional unit, with a small harbour feel and clear Sporades water.",
        gr: "Παραλία στη βόρεια πλευρά της Σκύρου μέσα στην περιφερειακή ενότητα Εύβοιας, με αίσθηση μικρού λιμανιού και καθαρά νερά Σποράδων."
    },
    "Καλαμίτσα": {
        en: "A wide Skyros beach with pebbles, wind and open views, popular for water sports when conditions build.",
        gr: "Μεγάλη παραλία της Σκύρου με βότσαλο, αέρα και ανοιχτή θέα, δημοφιλής για θαλάσσια σπορ όταν οι συνθήκες δυναμώνουν."
    },
    "Αγαλίπα": {
        en: "A remote Skyros cove with pale rock and clear water, usually reached by boat or rougher routes.",
        gr: "Απόμερος κολπίσκος της Σκύρου με ανοιχτόχρωμα βράχια και καθαρά νερά, συνήθως με πρόσβαση από καραβάκι ή πιο δύσκολες διαδρομές."
    },
    "Γυρίσματα": {
        en: "A long Skyros beach near Chora, with sand, shallow water and one of the island's easiest family settings.",
        gr: "Μεγάλη παραλία της Σκύρου κοντά στη Χώρα, με άμμο, ρηχά νερά και από τα πιο εύκολα οικογενειακά σημεία του νησιού."
    },
    "Μαγαζιά": {
        en: "Skyros' main town-side beach, long and easy, with tavernas and the Chora rising above it.",
        gr: "Η βασική παραλία της Σκύρου κάτω από τη Χώρα, μεγάλη και εύκολη, με ταβέρνες και τον οικισμό να υψώνεται από πάνω."
    }
};

const getEviaShortDescription = (name: string, area: string): LocalizedBeachText | null => {
    if (normalizeBeachLookup(area) !== 'evia') return null;

    const normalizedName = normalizeBeachLookup(name);
    const exact = Object.entries(EVIA_NOTABLE_DESCRIPTIONS).find(([beachName]) => (
        normalizeBeachLookup(beachName) === normalizedName
    ))?.[1];

    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const beachLabel = name.replace(/^Παραλία\s+/i, '').trim();
    const lowerName = normalizeBeachLookup(name);

    if (lowerName.includes('γυμνιστων') || lowerName.includes('nudist')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a more secluded Evia swimming spot, usually chosen by people looking for a quieter, freer beach mood.`,
            `Η ${beachLabel} είναι πιο απομονωμένο σημείο για μπάνιο στην Εύβοια, συνήθως για όσους αναζητούν ησυχία και πιο ελεύθερη ατμόσφαιρα.`
        );
    }

    if (lowerName.includes('γιαλος') || lowerName.includes('αμμος') || lowerName.includes('αμμου')) {
        return makeLocalizedBeachText(
            `${beachLabel} is an Evia shore with an easier beach shape, suited to a relaxed swim rather than a rough coastal scramble.`,
            `Η ${beachLabel} είναι ευβοϊκή ακτή με πιο εύκολο ανάγλυφο, κατάλληλη για χαλαρό μπάνιο αντί για δύσκολη βραχώδη πρόσβαση.`
        );
    }

    if (lowerName.includes('ποταμι') || lowerName.includes('λιμν') || lowerName.includes('ορμος')) {
        return makeLocalizedBeachText(
            `${beachLabel} has a sheltered local-bay feel, showing the calmer side of Evia's long and varied coastline.`,
            `Η ${beachLabel} έχει αίσθηση προστατευμένου τοπικού όρμου, δείχνοντας την πιο ήρεμη πλευρά της μεγάλης και ποικίλης ακτογραμμής της Εύβοιας.`
        );
    }

    const variants = [
        {
            en: `${beachLabel} is a local Evia beach with clear water and a quieter feel than the island's best-known Aegean coves.`,
            gr: `Η ${beachLabel} είναι τοπική παραλία της Εύβοιας με καθαρά νερά και πιο ήσυχη αίσθηση από τους γνωστούς αιγαιοπελαγίτικους κόλπους του νησιού.`
        },
        {
            en: `${beachLabel} works as a low-key Evia swim stop, where the appeal is the coastline itself more than heavy organization.`,
            gr: `Η ${beachLabel} λειτουργεί ως χαμηλών τόνων στάση για μπάνιο στην Εύβοια, με αξία κυρίως στην ίδια την ακτογραμμή και όχι στις πολλές παροχές.`
        },
        {
            en: `${beachLabel} gives Evia another small coastal pocket, useful for a simple swim while exploring the island by road.`,
            gr: `Η ${beachLabel} είναι ακόμη μια μικρή παραλιακή τσέπη της Εύβοιας, χρήσιμη για απλή βουτιά όταν εξερευνάς το νησί οδικώς.`
        },
        {
            en: `${beachLabel} has the everyday Evia character: accessible sea, local rhythm and a landscape that changes quickly from coast to mountain.`,
            gr: `Η ${beachLabel} έχει καθημερινό ευβοϊκό χαρακτήρα: εύκολη θάλασσα, τοπικό ρυθμό και τοπίο που αλλάζει γρήγορα από ακτή σε βουνό.`
        }
    ];
    const index = Math.abs(normalizedName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length;
    return makeLocalizedBeachText(variants[index].en, variants[index].gr);
};

const CENTRAL_GREECE_MAINLAND_DESCRIPTIONS: Record<string, { areas: string[]; en: string; gr: string }> = {
    "Μονιά": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A small Galaxidi-side cove on the Corinthian Gulf, with calm water and a quiet local feel.",
        gr: "Μικρός κολπίσκος προς το Γαλαξίδι στον Κορινθιακό, με ήρεμα νερά και ήσυχο τοπικό χαρακτήρα."
    },
    "Σκούλες Μικρή και Μεγάλη": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "Twin small coves near Galaxidi, useful for clear-water dips away from the main town beaches.",
        gr: "Δύο μικροί κολπίσκοι κοντά στο Γαλαξίδι, για καθαρές βουτιές μακριά από τις πιο κεντρικές ακτές."
    },
    "Άγιος Βασίλειος": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A quiet Fokida beach on the Corinthian Gulf, close to the small coastal settlements around Galaxidi.",
        gr: "Ήσυχη παραλία της Φωκίδας στον Κορινθιακό, κοντά στους μικρούς παραθαλάσσιους οικισμούς γύρω από το Γαλαξίδι."
    },
    "Άγιος Ισήδωρος": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A practical Itea-side beach, good for an easy swim with the Delphi coastline nearby.",
        gr: "Πρακτική παραλία προς την Ιτέα, καλή για εύκολη βουτιά με την ακτογραμμή των Δελφών κοντά."
    },
    "Ακτή Βραχάκια": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A rocky little Fokida shore, more suited to a quick clear-water swim than a long sandy beach day.",
        gr: "Μικρή βραχώδης ακτή της Φωκίδας, περισσότερο για γρήγορη καθαρή βουτιά παρά για μεγάλη αμμουδερή εξόρμηση."
    },
    "Γιάννακης": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A low-key Galaxidi-area swim spot with calm Corinthian Gulf water and a local summer rhythm.",
        gr: "Χαμηλών τόνων σημείο για μπάνιο στην περιοχή Γαλαξιδίου, με ήρεμα νερά Κορινθιακού και τοπικό καλοκαιρινό ρυθμό."
    },
    "Καλαφάτης": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A small Fokida beach near Galaxidi, with simple access and views across the Corinthian Gulf.",
        gr: "Μικρή παραλία της Φωκίδας κοντά στο Γαλαξίδι, με απλή πρόσβαση και θέα προς τον Κορινθιακό."
    },
    "Κεντρί": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A compact local beach by Galaxidi's coastline, best for a quiet stop and clean water.",
        gr: "Μικρή τοπική παραλία στην ακτογραμμή του Γαλαξιδίου, ιδανική για ήσυχη στάση και καθαρά νερά."
    },
    "Παραλία Αγίου Ανδρέα": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A Fokida beach near Erateini, with easy village access and a relaxed Corinthian Gulf setting.",
        gr: "Παραλία της Φωκίδας κοντά στην Ερατεινή, με εύκολη πρόσβαση από τον οικισμό και χαλαρό σκηνικό Κορινθιακού."
    },
    "Παραλία Αγίου Μηνά": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A small Galaxidi-side beach with calm water and the quiet mood of the north Corinthian Gulf.",
        gr: "Μικρή παραλία προς το Γαλαξίδι με ήρεμα νερά και την ήσυχη ατμόσφαιρα του βόρειου Κορινθιακού."
    },
    "Παραλία Αστέρι": {
        areas: ["Fokida", "Fokida (mainland)"],
        en: "A Fokida coastal stop near the Galaxidi-Itea route, simple and convenient for a short swim.",
        gr: "Παραλιακή στάση της Φωκίδας κοντά στη διαδρομή Γαλαξίδι-Ιτέα, απλή και βολική για σύντομη βουτιά."
    },
    "Άι Γιάννης": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A Maliakos Gulf beach with calm water and a local village-coast atmosphere.",
        gr: "Παραλία του Μαλιακού με ήρεμα νερά και τοπική ατμόσφαιρα παραθαλάσσιου χωριού."
    },
    "Αγιόνερο": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A Fthiotida beach close to the Arkitsa-Tragana coast, known for easy access from the main road.",
        gr: "Παραλία της Φθιώτιδας κοντά στην ακτή Αρκίτσας-Τραγάνας, γνωστή για εύκολη πρόσβαση από τον κεντρικό δρόμο."
    },
    "Βίβος": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A small North Euboean Gulf shore, quiet and practical for a local swim.",
        gr: "Μικρή ακτή του Βόρειου Ευβοϊκού, ήσυχη και πρακτική για τοπική βουτιά."
    },
    "Γρεγολίμανο": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A Lichada-side beach facing the Lichadonisia, with resort character and views toward the small volcanic islets.",
        gr: "Παραλία προς τη Λιχάδα με θέα στα Λιχαδονήσια, με resort χαρακτήρα και τοπίο απέναντι από τα μικρά ηφαιστειακά νησάκια."
    },
    "Κέδρος": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A quiet Lichada-area beach with clear water and a calmer north-coast feel.",
        gr: "Ήσυχη παραλία στην περιοχή της Λιχάδας, με καθαρά νερά και πιο ήρεμη βόρεια ακτογραμμή."
    },
    "Καραβόμυλος": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A seaside village beach near Lamia, practical for families and evening walks along the Maliakos Gulf.",
        gr: "Παραλία παραθαλάσσιου χωριού κοντά στη Λαμία, πρακτική για οικογένειες και απογευματινές βόλτες στον Μαλιακό."
    },
    "Μεγάλη Σουβάλα": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "One of the two Souvala coves in Fthiotida, with calm water and a small local-bay scale.",
        gr: "Ένας από τους δύο κολπίσκους της Σουβάλας στη Φθιώτιδα, με ήρεμα νερά και μικρή τοπική κλίμακα."
    },
    "Μικρή Σουβάλα": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "The smaller Souvala cove, more tucked away and suited to a quiet swim.",
        gr: "Ο μικρότερος κολπίσκος της Σουβάλας, πιο κρυμμένος και κατάλληλος για ήσυχη βουτιά."
    },
    "Παραλία Αγίου Γεωργίου Πελασγίας": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A Pelasgia-side beach on the Pagasetic-facing coast, with a relaxed village-summer feel.",
        gr: "Παραλία προς τον Άγιο Γεώργιο Πελασγίας, με χαλαρή αίσθηση παραθεριστικού χωριού στην πλευρά προς τον Παγασητικό."
    },
    "Παραλία Αγίου Νικολάου": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A small Lichada-area beach with sheltered water and views toward the Evia channel.",
        gr: "Μικρή παραλία στην περιοχή της Λιχάδας, με προστατευμένα νερά και θέα προς τον δίαυλο της Εύβοιας."
    },
    "Παραλία Αγίου Σεραφείμ": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A calm Maliakos Gulf beach near Kamena Vourla, practical for an easy family swim.",
        gr: "Ήρεμη παραλία του Μαλιακού κοντά στα Καμένα Βούρλα, πρακτική για εύκολη οικογενειακή βουτιά."
    },
    "Παραλία Βουγιουκλάκη": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A local Arkitsa-side beach with simple access and a quiet North Euboean Gulf setting.",
        gr: "Τοπική παραλία προς την Αρκίτσα, με απλή πρόσβαση και ήσυχο σκηνικό Βόρειου Ευβοϊκού."
    },
    "Παραλία Καναπίτσα": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A Lichada-side beach near the green north-west Evia channel landscape, quiet and lightly developed.",
        gr: "Παραλία προς τη Λιχάδα, κοντά στο πράσινο τοπίο του βορειοδυτικού διαύλου της Εύβοιας, ήσυχη και ήπια οργανωμένη."
    },
    "Παραλία Τραγάνας": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A practical Tragana beach by the ferry-coast zone, good for a straightforward swim close to the road.",
        gr: "Πρακτική παραλία της Τραγάνας κοντά στη ζώνη των ακτοπλοϊκών περασμάτων, καλή για απλή βουτιά δίπλα στον δρόμο."
    },
    "Παραλία Τριανταφυλλιάς": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A quiet Fthiotida cove near Lichada, with clean water and a small-scale summer feel.",
        gr: "Ήσυχος κολπίσκος της Φθιώτιδας κοντά στη Λιχάδα, με καθαρά νερά και μικρή καλοκαιρινή κλίμακα."
    },
    "Πόρτο Πεύκο": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A north-west Fthiotida beach with pine-framed scenery and views toward the Lichadonisia side.",
        gr: "Βορειοδυτική παραλία της Φθιώτιδας με πευκόφυτο σκηνικό και θέα προς την πλευρά των Λιχαδονησίων."
    },
    "Σχοινιά": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A quiet beach on the Lichada coast, with calm water and a low-key local rhythm.",
        gr: "Ήσυχη παραλία στην ακτή της Λιχάδας, με ήρεμα νερά και χαμηλών τόνων τοπικό ρυθμό."
    },
    "Τραγάνα": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A simple beach stop at Tragana, useful for a swim on the way through the Fthiotida coast.",
        gr: "Απλή παραλιακή στάση στην Τραγάνα, χρήσιμη για βουτιά στη διαδρομή της φθιωτικής ακτής."
    },
    "Φλοίσβος Πλαζ": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A more organized Arkitsa-area beach, with easy access and a social summer feel.",
        gr: "Πιο οργανωμένη παραλία στην περιοχή της Αρκίτσας, με εύκολη πρόσβαση και κοινωνική καλοκαιρινή αίσθηση."
    },
    "Χρυσή ακτή": {
        areas: ["Fthiotida", "Fthiotida (mainland)"],
        en: "A Lichada-area beach with a brighter sandy-pebbly shore and relaxed resort-coast mood.",
        gr: "Παραλία της περιοχής Λιχάδας με πιο φωτεινή αμμοβοτσαλωτή ακτή και χαλαρή παραθεριστική διάθεση."
    },
    "Άγιος Νικόλαος": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A small Boeotian beach on the Corinthian Gulf side, close to the quiet coves around Livadostras.",
        gr: "Μικρή παραλία της Βοιωτίας στην πλευρά του Κορινθιακού, κοντά στους ήσυχους κολπίσκους γύρω από τη Λιβαδόστρα."
    },
    "Γυάλινη Άμμος": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A remote Boeotian shore on the Gulf of Corinth, with a raw, undeveloped coastal feel.",
        gr: "Απόμερη ακτή της Βοιωτίας στον Κορινθιακό, με ατόφια και ήπια ανεπτυγμένη παραλιακή αίσθηση."
    },
    "Ζάλτσα": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A quiet Boeotian beach below the Helicon side, known more for isolation than facilities.",
        gr: "Ήσυχη παραλία της Βοιωτίας κάτω από την πλευρά του Ελικώνα, γνωστή περισσότερο για απομόνωση παρά για παροχές."
    },
    "Λαιμός": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A narrow coastal spot near Livadostras, with calm Corinthian Gulf water and a local escape feel.",
        gr: "Στενό παραλιακό σημείο κοντά στη Λιβαδόστρα, με ήρεμα νερά Κορινθιακού και αίσθηση τοπικής απόδρασης."
    },
    "Παραλία Κορομίλι": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A small Boeotian cove near Livadostras, suited to a quiet swim away from organized beaches.",
        gr: "Μικρός βοιωτικός κολπίσκος κοντά στη Λιβαδόστρα, κατάλληλος για ήσυχη βουτιά μακριά από οργανωμένες ακτές."
    },
    "Παραλία Λιβαδόστρας": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A historic Corinthian Gulf beach below ancient Kreusis, with calm water and a sheltered bay shape.",
        gr: "Ιστορική παραλία του Κορινθιακού κάτω από την αρχαία Κρεύσιδα, με ήρεμα νερά και προστατευμένο σχήμα κόλπου."
    },
    "Παραλία Σαράντη": {
        areas: ["Viotia", "Viotia (mainland)"],
        en: "A popular Boeotian beach village on the Corinthian Gulf, with tavernas and a relaxed holiday-home rhythm.",
        gr: "Δημοφιλής παραθεριστικός οικισμός-παραλία της Βοιωτίας στον Κορινθιακό, με ταβέρνες και χαλαρό ρυθμό εξοχικών."
    }
};

const getCentralGreeceMainlandDescription = (name: string, area: string): LocalizedBeachText | null => {
    const normalizedName = normalizeBeachLookup(name);
    const normalizedArea = normalizeBeachLookup(area);
    const entry = Object.entries(CENTRAL_GREECE_MAINLAND_DESCRIPTIONS).find(([beachName, description]) => {
        const matchesName = normalizeBeachLookup(beachName) === normalizedName;
        const matchesArea = description.areas.some(region => {
            const normalizedRegion = normalizeBeachLookup(region);
            return normalizedArea === normalizedRegion || normalizedArea.includes(normalizedRegion);
        });
        return matchesName && matchesArea;
    })?.[1];

    return entry ? makeLocalizedBeachText(entry.en, entry.gr) : null;
};

const CYCLADES_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    amorgos: { en: 'Amorgos', gr: 'Αμοργός' },
    anafi: { en: 'Anafi', gr: 'Ανάφη' },
    andros: { en: 'Andros', gr: 'Άνδρος' },
    antiparos: { en: 'Antiparos', gr: 'Αντίπαρος' },
    donousa: { en: 'Donousa', gr: 'Δονούσα' },
    folegandros: { en: 'Folegandros', gr: 'Φολέγανδρος' },
    iraklia: { en: 'Iraklia', gr: 'Ηρακλειά' },
    kea: { en: 'Kea', gr: 'Κέα' },
    kimolos: { en: 'Kimolos', gr: 'Κίμωλος' },
    koufonisia: { en: 'Koufonisia', gr: 'Κουφονήσια' },
    kythnos: { en: 'Kythnos', gr: 'Κύθνος' },
    milos: { en: 'Milos', gr: 'Μήλος' },
    mykonos: { en: 'Mykonos', gr: 'Μύκονος' },
    naxos: { en: 'Naxos', gr: 'Νάξος' },
    paros: { en: 'Paros', gr: 'Πάρος' },
    santorini: { en: 'Santorini', gr: 'Σαντορίνη' },
    schinoussa: { en: 'Schinoussa', gr: 'Σχοινούσα' },
    serifos: { en: 'Serifos', gr: 'Σέριφος' },
    sifnos: { en: 'Sifnos', gr: 'Σίφνος' },
    sikinos: { en: 'Sikinos', gr: 'Σίκινος' },
    syros: { en: 'Syros', gr: 'Σύρος' },
    tinos: { en: 'Tinos', gr: 'Τήνος' }
};

const CYCLADES_NOTABLE_DESCRIPTIONS: Array<{ aliases: string[]; areas?: string[]; en: string; gr: string }> = [
    {
        aliases: ['Σαρακήνικο', 'Sarakiniko'],
        areas: ['milos'],
        en: 'Milos’ lunar icon, with white volcanic rock, smooth curves and deep blue water in one of the Cyclades’ most distinctive landscapes.',
        gr: 'Το σεληνιακό σύμβολο της Μήλου, με λευκό ηφαιστειακό πέτρωμα, λείες καμπύλες και βαθύ μπλε νερό σε ένα από τα πιο ιδιαίτερα τοπία των Κυκλάδων.'
    },
    {
        aliases: ['Κλέφτικο', 'Kleftiko'],
        areas: ['milos'],
        en: 'A boat-access sea-cave landscape on Milos, famous for white cliffs, arches and luminous swimming water.',
        gr: 'Θαλασσινό τοπίο σπηλιών στη Μήλο, προσβάσιμο κυρίως με σκάφος, γνωστό για λευκά βράχια, αψίδες και φωτεινά νερά.'
    },
    {
        aliases: ['Φυριπλάκα', 'Firiplaka', 'Τσιγκράδο', 'Tsigrado', 'Παπάφραγκας', 'Papafragas'],
        areas: ['milos'],
        en: 'A volcanic Milos beach with strong character, where cliffs, caves or unusual rock forms make the swim feel memorable.',
        gr: 'Παραλία της ηφαιστειακής Μήλου με έντονο χαρακτήρα, όπου βράχια, σπηλιές ή ιδιαίτεροι σχηματισμοί κάνουν το μπάνιο ξεχωριστό.'
    },
    {
        aliases: ['Κολυμπήθρες', 'Kolymbithres'],
        areas: ['paros'],
        en: 'Paros’ signature granite beach, where wind-shaped boulders form small coves and natural swimming pools.',
        gr: 'Η χαρακτηριστική γρανιτένια παραλία της Πάρου, όπου οι σμιλεμένοι βράχοι σχηματίζουν μικρούς κολπίσκους και φυσικές πισίνες.'
    },
    {
        aliases: ['Χρυσή Ακτή', 'Golden Beach', 'Νέα Χρυσή Ακτή'],
        areas: ['paros'],
        en: 'A long sandy Paros beach known for windsurfing, wide space and reliable meltemi energy.',
        gr: 'Μεγάλη αμμώδης παραλία της Πάρου, γνωστή για windsurf, άπλα και σταθερή ενέργεια από τα μελτέμια.'
    },
    {
        aliases: ['Κόκκινη Παραλία', 'Red Beach'],
        areas: ['santorini'],
        en: 'Santorini’s dramatic red-cliff beach near Akrotiri, striking more for its volcanic scenery than for comfort.',
        gr: 'Η εντυπωσιακή κόκκινη παραλία της Σαντορίνης κοντά στο Ακρωτήρι, ξεχωριστή κυρίως για το ηφαιστειακό τοπίο της.'
    },
    {
        aliases: ['Περίσσα', 'Περίβολος', 'Καμάρι'],
        areas: ['santorini'],
        en: 'A black-sand Santorini beach zone with volcanic texture, organised services and a lively resort feel.',
        gr: 'Ζώνη μαύρης άμμου στη Σαντορίνη με ηφαιστειακή υφή, οργανωμένες παροχές και ζωντανή παραθεριστική ατμόσφαιρα.'
    },
    {
        aliases: ['Super Paradise', 'Paradise', 'Ψαρρού', 'Ορνός', 'Καλό Λιβάδι', 'Ελιά'],
        areas: ['mykonos'],
        en: 'A well-known Mykonos beach, shaped by clear water, organised service and the island’s polished summer energy.',
        gr: 'Γνωστή παραλία της Μυκόνου, με καθαρά νερά, οργανωμένες παροχές και την κοσμοπολίτικη καλοκαιρινή ενέργεια του νησιού.'
    },
    {
        aliases: ['Πλάκα', 'Άγιος Προκόπιος', 'Αγία Άννα', 'Μικρή Βίγλα', 'Πυργάκι', 'Αγιασσός'],
        areas: ['naxos'],
        en: 'A Naxos sandy beach with generous space, shallow blue water and the island’s easygoing family-friendly rhythm.',
        gr: 'Αμμώδης παραλία της Νάξου με άπλα, γαλάζια ρηχά νερά και τον άνετο οικογενειακό ρυθμό του νησιού.'
    },
    {
        aliases: ['Μυλοπότας', 'Mylopotas'],
        areas: ['ios'],
        en: 'Ios’ signature beach, a long sandy bay with beach bars, water sports and the island’s liveliest summer mood.',
        gr: 'Η παραλία-σήμα της Ίου, μεγάλος αμμώδης κόλπος με beach bars, θαλάσσια σπορ και την πιο ζωντανή καλοκαιρινή διάθεση του νησιού.'
    },
    {
        aliases: ['Μαγγανάρι', 'Manganari'],
        areas: ['ios'],
        en: 'A quieter south-Ios beach cluster with pale sand, protected coves and clear water away from the party side.',
        gr: 'Πιο ήσυχη ζώνη παραλιών στη νότια Ίο, με ανοιχτόχρωμη άμμο, προφυλαγμένους κολπίσκους και καθαρά νερά μακριά από τα πάρτι.'
    },
    {
        aliases: ['Κάτεργο', 'Katergo'],
        areas: ['folegandros'],
        en: 'Folegandros’ wild showcase beach, reached by boat or hike, with raw cliffs and exceptionally clear water.',
        gr: 'Η άγρια παραλία-βιτρίνα της Φολεγάνδρου, με πρόσβαση με σκάφος ή πεζοπορία, απότομα βράχια και εξαιρετικά καθαρά νερά.'
    },
    {
        aliases: ['Ρούκουνας', 'Roukounas'],
        areas: ['anafi'],
        en: 'Anafi’s long, free-spirited sandy beach below the island’s stark Cycladic landscape.',
        gr: 'Η μεγάλη, ελεύθερη αμμώδης παραλία της Ανάφης κάτω από το λιτό κυκλαδίτικο τοπίο του νησιού.'
    },
    {
        aliases: ['Κολυμπήθρα', 'Kolympithra'],
        areas: ['tinos'],
        en: 'Tinos’ famous double bay, with a calmer side and a wilder surf-friendly side when the meltemi blows.',
        gr: 'Ο γνωστός διπλός κόλπος της Τήνου, με πιο ήρεμη πλευρά και πιο άγρια πλευρά που αγαπούν οι surfers όταν φυσά μελτέμι.'
    },
    {
        aliases: ['Της γριας το πήδημα', 'Της γριάς το πήδημα'],
        areas: ['andros'],
        en: 'An Andros beach known for the dramatic rock rising from the sea and the striking swim below it.',
        gr: 'Παραλία της Άνδρου γνωστή για τον εντυπωσιακό βράχο που υψώνεται από τη θάλασσα και το ιδιαίτερο μπάνιο γύρω του.'
    },
    {
        aliases: ['Βιτάλι', 'Άχλα', 'Ζόρκος'],
        areas: ['andros'],
        en: 'A wilder Andros beach with clear water, green hills behind it and a more remote east-coast feel.',
        gr: 'Πιο άγρια παραλία της Άνδρου με καθαρά νερά, πράσινους όγκους από πίσω και πιο απομονωμένη αίσθηση ανατολικής ακτής.'
    },
    {
        aliases: ['Αγία Άννα'],
        areas: ['amorgos'],
        en: 'A tiny Amorgos beach below Hozoviotissa monastery, famous for deep blue water and a dramatic cliff setting.',
        gr: 'Μικρή παραλία της Αμοργού κάτω από τη Χοζοβιώτισσα, γνωστή για βαθύ μπλε νερό και δραματικό βραχώδες σκηνικό.'
    },
    {
        aliases: ['Μούρος', 'Καλοκαταρίτισσα', 'Μαλτέζι', 'Άγιος Παύλος'],
        areas: ['amorgos'],
        en: 'A clear-water Amorgos beach with rugged Cycladic scenery and the island’s deep-blue Aegean character.',
        gr: 'Παραλία της Αμοργού με καθαρά νερά, τραχύ κυκλαδίτικο τοπίο και τον βαθύ μπλε αιγαιοπελαγίτικο χαρακτήρα του νησιού.'
    },
    {
        aliases: ['Πόρι', 'Ιταλίδα', 'Φανός', 'Φοίνικας'],
        areas: ['koufonisia'],
        en: 'A Koufonisia beach with pale sand, shallow turquoise water and the small-island ease of walking from cove to cove.',
        gr: 'Παραλία των Κουφονησίων με ανοιχτόχρωμη άμμο, ρηχά τιρκουάζ νερά και την ευκολία μικρού νησιού από κολπίσκο σε κολπίσκο.'
    },
    {
        aliases: ['Τσιγκούρι', 'Λιβάδι', 'Λιόλιου'],
        areas: ['schinoussa'],
        en: 'A Schinoussa beach with calm Cycladic water and a low-key Small Cyclades atmosphere.',
        gr: 'Παραλία της Σχοινούσας με ήρεμα κυκλαδίτικα νερά και χαμηλών τόνων ατμόσφαιρα Μικρών Κυκλάδων.'
    },
    {
        aliases: ['Κέδρος', 'Λιβάδι', 'Σταυρός'],
        areas: ['donousa'],
        en: 'A Donousa beach with simple access, clear water and the quiet, slow rhythm of the Small Cyclades.',
        gr: 'Παραλία της Δονούσας με απλή πρόσβαση, καθαρά νερά και τον ήσυχο, αργό ρυθμό των Μικρών Κυκλάδων.'
    },
    {
        aliases: ['Λιβάδι', 'Βορεινή Σπηλιά'],
        areas: ['iraklia'],
        en: 'An Iraklia beach with peaceful water, sparse development and a genuinely small-island feel.',
        gr: 'Παραλία της Ηρακλειάς με ήρεμα νερά, λίγες παρεμβάσεις και γνήσια αίσθηση μικρού νησιού.'
    },
    {
        aliases: ['Κολώνα'],
        areas: ['kythnos'],
        en: 'Kythnos’ landmark sandbar beach, joining the island to Agios Loukas islet with sea on both sides.',
        gr: 'Η εμβληματική αμμόγλωσσα της Κύθνου, που ενώνει το νησί με τον Άγιο Λουκά έχοντας θάλασσα και από τις δύο πλευρές.'
    },
    {
        aliases: ['Ψιλή Άμμος', 'Γάνεμα', 'Λιβαδάκια'],
        areas: ['serifos'],
        en: 'A Serifos beach with honest Cycladic simplicity, clear water and a relaxed taverna-or-tamarisk rhythm.',
        gr: 'Παραλία της Σερίφου με αυθεντική κυκλαδίτικη απλότητα, καθαρά νερά και χαλαρό ρυθμό με ταβέρνες ή αρμυρίκια.'
    },
    {
        aliases: ['Βαθύ', 'Πλατύς Γιαλός', 'Καμάρες', 'Φάρος'],
        areas: ['sifnos'],
        en: 'A Sifnos beach tied to village life, sheltered bays and the island’s gentle food-and-pottery character.',
        gr: 'Παραλία της Σίφνου δεμένη με οικισμό, προφυλαγμένους κόλπους και τον ήπιο χαρακτήρα φαγητού και κεραμικής του νησιού.'
    },
    {
        aliases: ['Γαλησσάς', 'Κίνι', 'Αγκαθωπές', 'Βάρη'],
        areas: ['syros'],
        en: 'A Syros beach with easy access, calm water and the convenience of being close to Ermoupoli’s island life.',
        gr: 'Παραλία της Σύρου με εύκολη πρόσβαση, ήρεμα νερά και την άνεση της κοντινής ζωής της Ερμούπολης.'
    }
];

const getCycladesAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(CYCLADES_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getCycladesDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getCycladesAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const notable = CYCLADES_NOTABLE_DESCRIPTIONS.find(entry => {
        const matchesArea = !entry.areas || entry.areas.includes(areaKey);
        return matchesArea && entry.aliases.some(alias => normalizedName.includes(normalizeBeachLookup(alias)));
    });

    if (notable) return makeLocalizedBeachText(notable.en, notable.gr);

    const label = CYCLADES_AREA_LABELS[areaKey];
    return makeLocalizedBeachText(
        `A ${label.en} beach with clear Aegean water, rocky Cycladic scenery and a relaxed island rhythm.`,
        `Παραλία της ${label.gr} με καθαρά νερά Αιγαίου, βραχώδες κυκλαδίτικο τοπίο και χαλαρό νησιώτικο ρυθμό.`
    );
};

const DODECANESE_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    agathonisi: { en: 'Agathonisi', gr: 'Αγαθονήσι' },
    astypalaia: { en: 'Astypalaia', gr: 'Αστυπάλαια' },
    halki: { en: 'Halki', gr: 'Χάλκη' },
    kalymnos: { en: 'Kalymnos', gr: 'Κάλυμνο' },
    karpathos: { en: 'Karpathos', gr: 'Κάρπαθο' },
    kasos: { en: 'Kasos', gr: 'Κάσο' },
    kassos: { en: 'Kasos', gr: 'Κάσο' },
    kastellorizo: { en: 'Kastellorizo', gr: 'Καστελλόριζο' },
    megisti: { en: 'Kastellorizo', gr: 'Καστελλόριζο' },
    kos: { en: 'Kos', gr: 'Κω' },
    leros: { en: 'Leros', gr: 'Λέρο' },
    lipsi: { en: 'Lipsi', gr: 'Λειψούς' },
    pserimos: { en: 'Pserimos', gr: 'Ψέριμο' },
    telendos: { en: 'Telendos', gr: 'Τέλενδο' },
    arki: { en: 'Arki', gr: 'Αρκιούς' },
    arkoi: { en: 'Arki', gr: 'Αρκιούς' },
    marathi: { en: 'Marathi', gr: 'Μαράθι' },
    nisyros: { en: 'Nisyros', gr: 'Νίσυρο' },
    patmos: { en: 'Patmos', gr: 'Πάτμο' },
    rhodes: { en: 'Rhodes', gr: 'Ρόδο' },
    symi: { en: 'Symi', gr: 'Σύμη' },
    tilos: { en: 'Tilos', gr: 'Τήλο' }
};

const DODECANESE_NOTABLE_DESCRIPTIONS: Array<{ aliases: string[]; areas?: string[]; en: string; gr: string }> = [
    {
        aliases: ['Τσαμπίκα', 'Tsambika'],
        areas: ['rhodes'],
        en: 'A broad Rhodes beach below the Tsambika monastery hill, known for golden sand and easy, family-friendly swimming.',
        gr: 'Μεγάλη αμμουδιά της Ρόδου κάτω από τον λόφο της Παναγίας Τσαμπίκας, γνωστή για τη χρυσαφένια άμμο και το εύκολο μπάνιο.'
    },
    {
        aliases: ['Λίνδος', 'Lindos', 'Άγιος Παύλος', 'Agios Pavlos'],
        areas: ['rhodes'],
        en: 'A landmark Lindos-area swim, pairing clear water with views of white houses, cliffs and the ancient acropolis above.',
        gr: 'Χαρακτηριστικό μπάνιο στην περιοχή της Λίνδου, με καθαρά νερά, λευκό οικισμό, βράχια και την ακρόπολη από πάνω.'
    },
    {
        aliases: ['Άντονι Κουίν', 'Anthony Quinn', 'Λαδικό', 'Ladiko'],
        areas: ['rhodes'],
        en: 'A compact rocky Rhodes bay with emerald water, sheltered swimming and one of the island’s most recognizable coves.',
        gr: 'Μικρός βραχώδης κόλπος της Ρόδου με σμαραγδένια νερά, απάνεμο μπάνιο και από τα πιο αναγνωρίσιμα τοπία του νησιού.'
    },
    {
        aliases: ['Καλλιθέα', 'Kallithea', 'Nicolas', 'Oasis', 'Tassos'],
        areas: ['rhodes'],
        en: 'A Kallithea coast swimming spot with rocky platforms, clear water and the historic spa area close by.',
        gr: 'Σημείο για μπάνιο στην Καλλιθέα, με βράχια, καθαρά νερά και τα ιστορικά λουτρά πολύ κοντά.'
    },
    {
        aliases: ['Φαληράκι', 'Faliraki'],
        areas: ['rhodes'],
        en: 'Rhodes’ long, organized east-coast beach, practical for swimming, food and watersports with easy access.',
        gr: 'Μεγάλη οργανωμένη παραλία στην ανατολική Ρόδο, πρακτική για μπάνιο, φαγητό και θαλάσσια σπορ με εύκολη πρόσβαση.'
    },
    {
        aliases: ['Έλλη', 'Elli'],
        areas: ['rhodes'],
        en: 'The classic town beach of Rhodes, close to the harbor and the old city, with clear water and an urban island feel.',
        gr: 'Η κλασική παραλία της πόλης της Ρόδου, κοντά στο λιμάνι και την παλιά πόλη, με καθαρά νερά και αστικό νησιώτικο χαρακτήρα.'
    },
    {
        aliases: ['Πρασονήσι', 'Prasonisi'],
        areas: ['rhodes'],
        en: 'A windswept sandbar at Rhodes’ southern tip, famous for windsurfing and the sea opening on both sides.',
        gr: 'Ανεμοδαρμένη αμμόγλωσσα στο νότιο άκρο της Ρόδου, γνωστή για windsurfing και θάλασσα και από τις δύο πλευρές.'
    },
    {
        aliases: ['Παράδεισος', 'Paradise', 'Άγιος Στέφανος', 'Agios Stefanos', 'Θερμά', 'Therma', 'Τιγκάκι', 'Tigaki', 'Μαρμάρι', 'Marmari', 'Κέφαλος', 'Kefalos'],
        areas: ['kos'],
        en: 'A Kos beach with open water, easy summer access and the island’s relaxed mix of sand, tavernas and long horizons.',
        gr: 'Παραλία της Κω με ανοιχτά νερά, εύκολη καλοκαιρινή πρόσβαση και τον χαλαρό συνδυασμό άμμου, ταβερνών και μεγάλου ορίζοντα.'
    },
    {
        aliases: ['Απέλλα', 'Apella'],
        areas: ['karpathos'],
        en: 'Karpathos’ signature beach, framed by steep green slopes, pale pebbles and intensely blue water.',
        gr: 'Η εμβληματική παραλία της Καρπάθου, με απότομες πράσινες πλαγιές, ανοιχτόχρωμο βότσαλο και έντονα γαλάζια νερά.'
    },
    {
        aliases: ['Κυρά Παναγιά', 'Kyra Panagia', 'Αχάτα', 'Achata', 'Διακόφτης', 'Diakoftis', 'Αμμοοπή', 'Amoopi', 'Αμμοωπή'],
        areas: ['karpathos'],
        en: 'A Karpathos beach with vivid water, rugged island scenery and the more dramatic, open-Aegean feel of the island.',
        gr: 'Παραλία της Καρπάθου με ζωηρά νερά, άγριο νησιώτικο τοπίο και την πιο δραματική αίσθηση του ανοιχτού Αιγαίου.'
    },
    {
        aliases: ['Ψιλή Άμμος', 'Psili Ammos', 'Λαμπή', 'Lambi', 'Γροίκος', 'Grikos', 'Κάμπος', 'Kampos'],
        areas: ['patmos'],
        en: 'A Patmos beach with calm island character, clear water and scenery shaped by bays, low hills and quiet chapels.',
        gr: 'Παραλία της Πάτμου με ήρεμο νησιώτικο χαρακτήρα, καθαρά νερά και τοπίο από κόλπους, χαμηλούς λόφους και ήσυχα ξωκλήσια.'
    },
    {
        aliases: ['Μασούρι', 'Masouri', 'Καντούνι', 'Kantouni', 'Αργινώντα', 'Arginonta', 'Παλιόνησος', 'Palionisos', 'Συκάτη', 'Sykati'],
        areas: ['kalymnos'],
        en: 'A Kalymnos beach with clear water, rocky cliffs and the island’s distinctive climbing-and-sea landscape.',
        gr: 'Παραλία της Καλύμνου με καθαρά νερά, βραχώδεις πλαγιές και το χαρακτηριστικό τοπίο αναρρίχησης και θάλασσας του νησιού.'
    },
    {
        aliases: ['Δύο Λισκάρια', 'Dyo Liskaria', 'Γούρνα', 'Gourna', 'Βρομόλιθος', 'Vromolithos', 'Κιούρα', 'Kioura'],
        areas: ['leros'],
        en: 'A Leros beach with gentle water, low-key island life and bays that feel naturally sheltered.',
        gr: 'Παραλία της Λέρου με ήρεμα νερά, χαμηλούς ρυθμούς και κόλπους που δίνουν φυσική αίσθηση προστασίας.'
    },
    {
        aliases: ['Άγιος Γεώργιος', 'Agios Georgios', 'Νανού', 'Nanou', 'Νος', 'Nos', 'Πέδι', 'Pedi'],
        areas: ['symi'],
        en: 'A Symi beach where clear water meets steep rocky slopes and the island’s compact, dramatic coastline.',
        gr: 'Παραλία της Σύμης όπου τα καθαρά νερά συναντούν απότομες βραχώδεις πλαγιές και τη δραματική ακτογραμμή του νησιού.'
    },
    {
        aliases: ['Λιβάδι', 'Livadi', 'Καμινάκια', 'Kaminakia', 'Βάτσες', 'Vatses', 'Μπλε Λιμανάκι', 'Ble Limanaki'],
        areas: ['astypalaia'],
        en: 'An Astypalaia beach with dry Cycladic-like scenery, clear water and the quiet edge of the Dodecanese.',
        gr: 'Παραλία της Αστυπάλαιας με ξερό κυκλαδίτικο τοπίο, καθαρά νερά και την ήσυχη άκρη των Δωδεκανήσων.'
    },
    {
        aliases: ['Πλατύς Γιαλός', 'Platis Gialos', 'Χοχλάκουρα', 'Chochlakoura', 'Κατσαδιά', 'Katsadia', 'Τηγανάκια', 'Tiganakia'],
        areas: ['lipsi'],
        en: 'A Lipsi beach with transparent water, small-island quiet and short distances between coves.',
        gr: 'Παραλία των Λειψών με διάφανα νερά, ησυχία μικρού νησιού και μικρές αποστάσεις ανάμεσα στους κόλπους.'
    },
    {
        aliases: ['Έριστος', 'Eristos', 'Λιβάδια', 'Livadia', 'Πλάκα', 'Plaka', 'Άγιος Σέργιος', 'Agios Sergios'],
        areas: ['tilos'],
        en: 'A Tilos beach with calm water, sparse development and the island’s protected, nature-forward atmosphere.',
        gr: 'Παραλία της Τήλου με ήρεμα νερά, λίγη δόμηση και την προστατευμένη, φυσιολατρική ατμόσφαιρα του νησιού.'
    },
    {
        aliases: ['Παχιά Άμμος', 'Pachia Ammos', 'Χοχλάκοι', 'Chochlakoi'],
        areas: ['nisyros'],
        en: 'A Nisyros beach with volcanic character, dark pebbles or sand and a raw, quiet island landscape.',
        gr: 'Παραλία της Νισύρου με ηφαιστειακό χαρακτήρα, σκούρο βότσαλο ή άμμο και ακατέργαστο, ήσυχο νησιώτικο τοπίο.'
    },
    {
        aliases: ['Φτενάγια', 'Ftenagia', 'Ftenegia', 'Κάνια', 'Kania'],
        areas: ['halki'],
        en: 'A small Halki beach with clear sheltered water and the slow, simple rhythm of the island.',
        gr: 'Μικρή παραλία της Χάλκης με καθαρά απάνεμα νερά και τον αργό, λιτό ρυθμό του νησιού.'
    },
    {
        aliases: ['Μανδράκι', 'Mandraki', 'Άγιος Γεώργιος', 'Agios Georgios', 'Πλάκες', 'Plakes'],
        areas: ['kastellorizo', 'megisti'],
        en: 'A Kastellorizo swimming spot with crystal water, rocky access and the far-eastern edge-of-Greece feeling.',
        gr: 'Σημείο για μπάνιο στο Καστελλόριζο με κρυστάλλινα νερά, βραχώδη πρόσβαση και την αίσθηση της ανατολικής άκρης της Ελλάδας.'
    },
    {
        aliases: ['Σπηλιά', 'Spilia', 'Πάλος', 'Palos'],
        areas: ['agathonisi'],
        en: 'An Agathonisi beach with very quiet water, simple access and the remote charm of a tiny Dodecanese island.',
        gr: 'Παραλία στο Αγαθονήσι με πολύ ήσυχα νερά, απλή πρόσβαση και τη μακρινή γοητεία ενός μικρού νησιού των Δωδεκανήσων.'
    }
];

const getDodecaneseAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(DODECANESE_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getDodecaneseDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getDodecaneseAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const notable = DODECANESE_NOTABLE_DESCRIPTIONS.find(entry => {
        const matchesArea = !entry.areas || entry.areas.includes(areaKey);
        return matchesArea && entry.aliases.some(alias => normalizedName.includes(normalizeBeachLookup(alias)));
    });

    if (notable) return makeLocalizedBeachText(notable.en, notable.gr);

    const label = DODECANESE_AREA_LABELS[areaKey];
    return makeLocalizedBeachText(
        `A ${label.en} beach with clear Dodecanese water, a sunny Aegean setting and an easy island pace.`,
        `Παραλία στην ${label.gr} με καθαρά νερά Δωδεκανήσου, φωτεινό αιγαιοπελαγίτικο τοπίο και ήρεμο νησιώτικο ρυθμό.`
    );
};

const SPORADES_THESSALY_AREA_LABELS: Record<string, { en: string; gr: string; kind: 'sporades' | 'thessaly' }> = {
    alonissos: { en: 'Alonissos', gr: 'Αλόννησο', kind: 'sporades' },
    skiathos: { en: 'Skiathos', gr: 'Σκιάθο', kind: 'sporades' },
    skopelos: { en: 'Skopelos', gr: 'Σκόπελο', kind: 'sporades' },
    skyros: { en: 'Skyros', gr: 'Σκύρο', kind: 'sporades' },
    magnesia: { en: 'Magnesia and Pelion', gr: 'Μαγνησία και το Πήλιο', kind: 'thessaly' },
    pelion: { en: 'Pelion', gr: 'Πήλιο', kind: 'thessaly' },
    larissa: { en: 'Larissa coast', gr: 'ακτογραμμή της Λάρισας', kind: 'thessaly' },
    agia: { en: 'Larissa coast', gr: 'ακτογραμμή της Λάρισας', kind: 'thessaly' },
    kissavos: { en: 'Larissa coast', gr: 'ακτογραμμή της Λάρισας', kind: 'thessaly' }
};

const SPORADES_THESSALY_NOTABLE_DESCRIPTIONS: Array<{ aliases: string[]; areas?: string[]; en: string; gr: string }> = [
    {
        aliases: ['Κουκουναριές', 'Koukounaries', 'Κρυφή Άμμος', 'Krifi Ammos'],
        areas: ['skiathos'],
        en: 'A classic Skiathos beach setting, with golden sand, pine-backed scenery and some of the island’s clearest summer water.',
        gr: 'Κλασικό τοπίο Σκιάθου, με χρυσαφένια άμμο, πεύκα πίσω από την ακτή και από τα πιο καθαρά καλοκαιρινά νερά του νησιού.'
    },
    {
        aliases: ['Λαλάρια', 'Lalaria'],
        areas: ['skiathos'],
        en: 'Skiathos’ dramatic boat-access beach, known for white pebbles, steep pale cliffs and vivid blue water.',
        gr: 'Η εντυπωσιακή παραλία της Σκιάθου που συνήθως προσεγγίζεται με καΐκι, γνωστή για λευκά βότσαλα, απότομα ανοιχτόχρωμα βράχια και έντονα γαλάζια νερά.'
    },
    {
        aliases: ['Μπανάνα', 'Banana', 'Μανδράκι', 'Mandraki', 'Μεγάλη Άμμος', 'Megali Ammos', 'Τσουγκριάς', 'Tsougrias', 'Βρωμόλιμνος', 'Vromolimnos', 'Αχλαδιές', 'Achladies'],
        areas: ['skiathos'],
        en: 'A Skiathos beach with easy island access, bright water and the pine-and-sand character that defines the island.',
        gr: 'Παραλία της Σκιάθου με εύκολη πρόσβαση, φωτεινά νερά και τον χαρακτηριστικό συνδυασμό πεύκου και άμμου του νησιού.'
    },
    {
        aliases: ['Κοκκινόκαστρο', 'Kokkinokastro'],
        areas: ['alonissos'],
        en: 'One of Alonissos’ most distinctive beaches, with reddish cliffs, pale pebbles and deep blue water beside an ancient-site landscape.',
        gr: 'Από τις πιο ιδιαίτερες παραλίες της Αλοννήσου, με κοκκινωπούς βράχους, ανοιχτόχρωμο βότσαλο και βαθιά γαλάζια νερά δίπλα σε τοπίο αρχαιολογικού ενδιαφέροντος.'
    },
    {
        aliases: ['Λεφτός Γιαλός', 'Λεφτό Γιαλός', 'Leftos Gialos', 'Χρυσή Μηλιά', 'Chrissi Milia', 'Μεγάλος Μουρτιάς', 'Megalos Mourtias', 'Γέρακας', 'Gerakas'],
        areas: ['alonissos'],
        en: 'An Alonissos beach with clear protected water, pine or olive-green surroundings and the quiet rhythm of the marine-park island.',
        gr: 'Παραλία της Αλοννήσου με καθαρά προστατευμένα νερά, πράσινο από πεύκα ή ελιές γύρω της και τον ήσυχο ρυθμό του νησιού του θαλάσσιου πάρκου.'
    },
    {
        aliases: ['Καστάνη', 'Kastani'],
        areas: ['skopelos'],
        en: 'Skopelos’ famous west-coast beach, with turquoise water, forested slopes and a cinematic island feel.',
        gr: 'Γνωστή παραλία της δυτικής Σκοπέλου, με τιρκουάζ νερά, δασωμένες πλαγιές και κινηματογραφική αίσθηση νησιού.'
    },
    {
        aliases: ['Μηλιά', 'Milia', 'Πάνορμος', 'Panormos', 'Στάφυλος', 'Stafylos', 'Βελανιό', 'Velanio', 'Λιμνονάρι', 'Limnonari', 'Χόβολο', 'Hovolo', 'Γλυστέρι', 'Glysteri'],
        areas: ['skopelos'],
        en: 'A Skopelos beach with green-blue water, thick coastal vegetation and the sheltered feel of the island’s coves.',
        gr: 'Παραλία της Σκοπέλου με πρασινογάλαζα νερά, πυκνή βλάστηση κοντά στην ακτή και την απάνεμη αίσθηση των κόλπων του νησιού.'
    },
    {
        aliases: ['Μυλοπόταμος', 'Mylopotamos'],
        areas: ['magnesia', 'pelion'],
        en: 'One of Pelion’s landmark beaches, split by rock formations and known for clear Aegean water below forested slopes.',
        gr: 'Από τις εμβληματικές παραλίες του Πηλίου, χωρισμένη από βράχια και γνωστή για καθαρά αιγαιοπελαγίτικα νερά κάτω από κατάφυτες πλαγιές.'
    },
    {
        aliases: ['Φακίστρα', 'Fakistra', 'Νταμούχαρη', 'Damouchari', 'Παπά Νερό', 'Papa Nero', 'Χορευτό', 'Chorefto', 'Άγιοι Σαράντα', 'Agioi Saranta', 'Άγιος Ιωάννης', 'Agios Ioannis'],
        areas: ['magnesia', 'pelion'],
        en: 'A Pelion beach where mountain greenery drops close to the sea, with clear water and the wilder mood of the east coast.',
        gr: 'Παραλία του Πηλίου όπου το βουνίσιο πράσινο κατεβαίνει κοντά στη θάλασσα, με καθαρά νερά και την πιο άγρια αίσθηση της ανατολικής ακτής.'
    },
    {
        aliases: ['Κορόπη', 'Koropi', 'Λεφόκαστρο', 'Lefokastro', 'Αμποβός', 'Abovos', 'Άναυρος', 'Anavros', 'Αλυκές', 'Alykes', 'Νέα Αγχίαλος', 'Nea Anchialos'],
        areas: ['magnesia', 'pelion'],
        en: 'A Magnesia beach with easier road access, calmer Pagasetic-side water and a practical mainland-summer character.',
        gr: 'Παραλία της Μαγνησίας με πιο εύκολη οδική πρόσβαση, ηπιότερα νερά στον Παγασητικό και πρακτικό χαρακτήρα θερινού προορισμού.'
    },
    {
        aliases: ['Αγιόκαμπος', 'Agiokampos', 'Σωτηρίτσα', 'Sotiritsa', 'Βελίκα', 'Velika'],
        areas: ['larissa', 'agia', 'kissavos'],
        en: 'A long Larissa coast beach, part of the Agiokampos-Sotiritsa-Velika stretch, with sand, pebbles and open Aegean water.',
        gr: 'Μεγάλη παραλία της Λάρισας, στο συνεχές μέτωπο Αγιόκαμπου-Σωτηρίτσας-Βελίκας, με άμμο, βότσαλο και ανοιχτά νερά Αιγαίου.'
    },
    {
        aliases: ['Στόμιο', 'Stomio', 'Κουτσουπιά', 'Koutsoupia', 'Παλιουριά', 'Paliouria', 'Ρακοπόταμος', 'Rakopotamos', 'Πλατιά Άμμος', 'Platia Ammos', 'Παναγία', 'Παπακώστα', 'Ψαρόλακας'],
        areas: ['larissa', 'agia', 'kissavos'],
        en: 'A Larissa coastline beach below Kissavos or near the Pineios delta, mixing Aegean water with greener mainland scenery.',
        gr: 'Παραλία της ακτογραμμής Λάρισας κάτω από τον Κίσσαβο ή κοντά στο δέλτα του Πηνειού, με νερά Αιγαίου και πιο πράσινο ηπειρωτικό τοπίο.'
    }
];

const getSporadesThessalyAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(SPORADES_THESSALY_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getSporadesThessalyDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getSporadesThessalyAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const notable = SPORADES_THESSALY_NOTABLE_DESCRIPTIONS.find(entry => {
        const matchesArea = !entry.areas || entry.areas.includes(areaKey);
        return matchesArea && entry.aliases.some(alias => normalizedName.includes(normalizeBeachLookup(alias)));
    });

    if (notable) return makeLocalizedBeachText(notable.en, notable.gr);

    const label = SPORADES_THESSALY_AREA_LABELS[areaKey];
    if (label.kind === 'sporades') {
        return makeLocalizedBeachText(
            `A ${label.en} beach with clear Sporades water, green island scenery and a relaxed northern-Aegean feel.`,
            `Παραλία στην ${label.gr} με καθαρά νερά Σποράδων, πράσινο νησιώτικο τοπίο και χαλαρή αίσθηση βόρειου Αιγαίου.`
        );
    }

    return makeLocalizedBeachText(
        `A ${label.en} beach with clear Thessalian water, mountain-backed scenery and an easy mainland summer rhythm.`,
        `Παραλία στην ${label.gr} με καθαρά νερά Θεσσαλίας, τοπίο με βουνό στο φόντο και άνετο ηπειρωτικό καλοκαιρινό ρυθμό.`
    );
};

const PELOPONNESE_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    argolida: { en: 'Argolida', gr: 'Αργολίδα' },
    arkadia: { en: 'Arkadia', gr: 'Αρκαδία' },
    korinthia: { en: 'Korinthia', gr: 'Κορινθία' },
    lakonia: { en: 'Lakonia', gr: 'Λακωνία' },
    messinia: { en: 'Messinia', gr: 'Μεσσηνία' },
    achaia: { en: 'Achaia', gr: 'Αχαΐα' },
    ileia: { en: 'Ilia', gr: 'Ηλεία' },
    ilia: { en: 'Ilia', gr: 'Ηλεία' }
};

const PELOPONNESE_NOTABLE_DESCRIPTIONS: Array<{ aliases: string[]; areas?: string[]; en: string; gr: string }> = [
    {
        aliases: ['Βοϊδοκοιλιά', 'Voidokilia'],
        areas: ['messinia'],
        en: 'An omega-shaped Messinia bay beside Gialova Lagoon, known for dunes, shallow water and protected wetland scenery.',
        gr: 'Κόλπος της Μεσσηνίας σε σχήμα Ω δίπλα στη λιμνοθάλασσα της Γιάλοβας, με αμμόλοφους, ρηχά νερά και προστατευμένο υγροτοπικό τοπίο.'
    },
    {
        aliases: ['Παραλία Σίμος', 'Simos', 'Σίμος'],
        areas: ['lakonia'],
        en: 'Elafonisos’ famous double beach, with pale sand, dunes and bright blue water on both sides of a narrow strip.',
        gr: 'Η διάσημη διπλή παραλία της Ελαφονήσου, με ανοιχτόχρωμη άμμο, αμμόλοφους και φωτεινά γαλάζια νερά στις δύο πλευρές της λωρίδας.'
    },
    {
        aliases: ['Παραλία Σαρακίνικο', 'Sarakiniko'],
        areas: ['lakonia'],
        en: 'One of Elafonisos’ signature beaches, close to Simos, with fine sand and the island’s characteristic turquoise water.',
        gr: 'Από τις χαρακτηριστικές παραλίες της Ελαφονήσου, κοντά στον Σίμο, με ψιλή άμμο και τα γνώριμα τιρκουάζ νερά του νησιού.'
    },
    {
        aliases: ['Παραλία Καλόγριας'],
        areas: ['achaia'],
        en: 'A long sandy Achaia beach by Strofylia forest, notable for dunes, shallow water and a protected nature setting.',
        gr: 'Μεγάλη αμμώδης παραλία της Αχαΐας δίπλα στο δάσος της Στροφυλιάς, ξεχωριστή για αμμόλοφους, ρηχά νερά και προστατευμένο φυσικό περιβάλλον.'
    },
    {
        aliases: ['Παραλία Κουρούτα', 'Κουρούτα'],
        areas: ['ileia', 'ilia'],
        en: 'A lively Ilia resort beach near Amaliada, valued for its long sandy shore, beach bars and sunset-facing Ionian water.',
        gr: 'Ζωντανή παραλία-θέρετρο της Ηλείας κοντά στην Αμαλιάδα, με μεγάλη αμμουδιά, beach bars και Ιόνιο προσανατολισμένο στο ηλιοβασίλεμα.'
    },
    {
        aliases: ['Παραλία Φονέας', 'Φονέας'],
        areas: ['messinia'],
        en: 'A small Mani cove near Kardamyli, instantly recognisable for the large rock in the middle of the clear water.',
        gr: 'Μικρός μεσσηνιακός κολπίσκος κοντά στην Καρδαμύλη, αναγνωρίσιμος από τον μεγάλο βράχο μέσα στα καθαρά νερά.'
    },
    {
        aliases: ['Στούπα', 'Καλογριά'],
        areas: ['messinia'],
        en: 'A classic Mani swim spot with easy village access, clear water and tavernas close to the sand.',
        gr: 'Κλασική παραλία της Μάνης με εύκολη πρόσβαση από τον οικισμό, καθαρά νερά και ταβέρνες κοντά στην άμμο.'
    },
    {
        aliases: ['Παραλία Καλαμάτας', 'Kalamata Beach'],
        areas: ['messinia'],
        en: 'Kalamata’s main city beach, long and easy to reach, with cafes, services and views toward the Messinian Gulf.',
        gr: 'Η κύρια αστική παραλία της Καλαμάτας, μεγάλη και εύκολη στην πρόσβαση, με καφέ, υποδομές και θέα στον Μεσσηνιακό κόλπο.'
    },
    {
        aliases: ['Παραλία Γιάλοβα', 'Διβάρι', 'Divari'],
        areas: ['messinia'],
        en: 'A quiet Navarino-side beach connected with the Gialova lagoon landscape, good for calmer swims and bird-rich scenery.',
        gr: 'Ήρεμη παραλία στην πλευρά του Ναβαρίνου, δεμένη με το τοπίο της λιμνοθάλασσας Γιάλοβας, για πιο χαλαρό μπάνιο και φυσική παρατήρηση.'
    },
    {
        aliases: ['Λαγκουβαρδος', 'Λαγκούβαρδος'],
        areas: ['messinia'],
        en: 'A broad west-Messinia beach near Marathopoli, known for open Ionian views and waves when the wind turns on.',
        gr: 'Μεγάλη παραλία της δυτικής Μεσσηνίας κοντά στη Μαραθόπολη, με ανοιχτή θέα στο Ιόνιο και κύμα όταν σηκώνει αέρα.'
    },
    {
        aliases: ['Ρωμανός', 'Πετροχώρι'],
        areas: ['messinia'],
        en: 'A sandy beach zone north of Navarino Bay, close to Voidokilia and the protected Gialova landscape.',
        gr: 'Αμμώδης ζώνη βόρεια του Ναβαρίνου, κοντά στη Βοϊδοκοιλιά και στο προστατευμένο τοπίο της Γιάλοβας.'
    },
    {
        aliases: ['Παραλία Λουτρακίου', 'Λουτράκι'],
        areas: ['korinthia'],
        en: 'Loutraki’s central Corinthian Gulf beach, practical for an easy swim with town services right behind it.',
        gr: 'Η κεντρική παραλία του Λουτρακίου στον Κορινθιακό, πρακτική για εύκολο μπάνιο με τις υπηρεσίες της πόλης ακριβώς από πίσω.'
    },
    {
        aliases: ['Πλαζ Λίμνης Ηραίου', 'Ηραίο'],
        areas: ['korinthia'],
        en: 'A lake-and-sea setting by Heraion, combining a sheltered swim with one of Corinthia’s most distinctive archaeological landscapes.',
        gr: 'Σημείο με λίμνη και θάλασσα δίπλα στο Ηραίο, που συνδυάζει προστατευμένο μπάνιο με ένα από τα πιο ιδιαίτερα αρχαιολογικά τοπία της Κορινθίας.'
    },
    {
        aliases: ['Παραλία Μυλοκοπή', 'Μυλοκοπή'],
        areas: ['korinthia'],
        en: 'A tucked-away Corinthia cove with clear water and a rougher approach, better suited to visitors who like less polished spots.',
        gr: 'Κρυμμένος κολπίσκος της Κορινθίας με καθαρά νερά και πιο δύσκολη προσέγγιση, για όσους προτιμούν λιγότερο στημένα σημεία.'
    },
    {
        aliases: ['Μεγάλο Αμόνι', 'Μικρό Αμόνι'],
        areas: ['korinthia'],
        en: 'A pair of small Saronic-facing Corinthia coves near Sofiko, with clear water and a quieter holiday-home rhythm.',
        gr: 'Δύο μικροί κολπίσκοι της Κορινθίας προς τον Σαρωνικό, κοντά στο Σοφικό, με καθαρά νερά και ήσυχο εξοχικό ρυθμό.'
    },
    {
        aliases: ['Καραθώνα'],
        areas: ['argolida'],
        en: 'Nafplio’s broad sandy beach, popular for easy access, space and family-friendly shallow water.',
        gr: 'Η μεγάλη αμμώδης παραλία του Ναυπλίου, δημοφιλής για την εύκολη πρόσβαση, τον χώρο και τα οικογενειακά ρηχά νερά.'
    },
    {
        aliases: ['Παραλία Αρβανιτιά', 'Αρβανιτιά'],
        areas: ['argolida'],
        en: 'A compact Nafplio beach below the Palamidi side, ideal for a quick swim with a strong old-town backdrop.',
        gr: 'Μικρή παραλία του Ναυπλίου κάτω από την πλευρά του Παλαμηδιού, ιδανική για γρήγορο μπάνιο με έντονο σκηνικό παλιάς πόλης.'
    },
    {
        aliases: ['Παραλία Κονδύλι', 'Παραλία Αγίου Νικολάου - Κονδύλι'],
        areas: ['argolida'],
        en: 'A large Argolida beach near Vivari and Drepano, known for clear water, sunset light and a mix of sand and fine pebble.',
        gr: 'Μεγάλη παραλία της Αργολίδας κοντά στο Βιβάρι και το Δρέπανο, γνωστή για καθαρά νερά, ηλιοβασίλεμα και άμμο με ψιλό βότσαλο.'
    },
    {
        aliases: ['Πλάκα Δρεπάνου', 'Παραλία Ασίνης', 'Καστράκι', 'Ψιλή Άμμος'],
        areas: ['argolida'],
        en: 'A beach cluster around Tolo, Drepano and Asini, useful for easy swims close to Nafplio with plenty of nearby services.',
        gr: 'Ζώνη παραλιών γύρω από Τολό, Δρέπανο και Ασίνη, πρακτική για εύκολο μπάνιο κοντά στο Ναύπλιο με πολλές κοντινές παροχές.'
    },
    {
        aliases: ['Πετροθάλασσα', 'Βερβερόντα'],
        areas: ['argolida'],
        en: 'An Ermionida coast beach with clear Saronic-side water, popular with Porto Heli and Ermioni visitors.',
        gr: 'Παραλία της Ερμιονίδας με καθαρά νερά προς την πλευρά του Σαρωνικού, αγαπημένη σε επισκέπτες Πόρτο Χελίου και Ερμιόνης.'
    },
    {
        aliases: ['Παραλία Ξηροπήγαδου', 'Πλαζ Παράλιου Άστρους', 'Παραλία Βερβένων'],
        areas: ['arkadia'],
        en: 'An easy east-Arcadia beach on the Argolic Gulf, with village access and a relaxed family-holiday feel.',
        gr: 'Εύκολη παραλία της ανατολικής Αρκαδίας στον Αργολικό, με πρόσβαση από οικισμό και χαλαρή οικογενειακή αίσθηση.'
    },
    {
        aliases: ['Ζαρίτσι', 'Κρυονέρι', 'Λυγαριά', 'Τηγάνι', 'Θιόπαυτο', 'Πούλιθρα'],
        areas: ['arkadia'],
        en: 'A quieter Arcadian coast spot near Tyros or Leonidio, with clear water and a more local, low-key character.',
        gr: 'Πιο ήσυχο σημείο της αρκαδικής ακτής κοντά στον Τυρό ή το Λεωνίδιο, με καθαρά νερά και τοπικό, χαμηλών τόνων χαρακτήρα.'
    },
    {
        aliases: ['Παραλία Μαυροβουνίου', 'Μαυροβούνι'],
        areas: ['lakonia'],
        en: 'A long sandy beach by Gytheio, open, spacious and known as one of Laconia’s easiest big-coast swims.',
        gr: 'Μεγάλη αμμώδης παραλία δίπλα στο Γύθειο, ανοιχτή και ευρύχωρη, από τα πιο εύκολα μεγάλα μπάνια της Λακωνίας.'
    },
    {
        aliases: ['Παραλία Βαλτάκι', 'Βαλτάκι'],
        areas: ['lakonia'],
        en: 'A Gytheio-area beach known for the Dimitrios shipwreck, giving the shoreline one of Laconia’s most recognisable views.',
        gr: 'Παραλία κοντά στο Γύθειο γνωστή για το ναυάγιο Δημήτριος, που δίνει στην ακτή μία από τις πιο αναγνωρίσιμες εικόνες της Λακωνίας.'
    },
    {
        aliases: ['Πόρτο Κάγιο', 'Μαρμάρι', 'Αλύπα'],
        areas: ['lakonia'],
        en: 'A deep-Mani beach setting with clear water, rocky slopes and the austere landscape that defines Cape Tainaro.',
        gr: 'Παραλία της βαθιάς Μάνης με καθαρά νερά, βραχώδεις πλαγιές και το αυστηρό τοπίο που χαρακτηρίζει την περιοχή του Ταΰναρου.'
    },
    {
        aliases: ['Παραλία Νερατζιώνα', 'Πούντα', 'Παραλία Κάτω Νησί'],
        areas: ['lakonia'],
        en: 'A beach on the Laconian side facing Elafonisos, with pale sand and easy access to the island-crossing area.',
        gr: 'Παραλία στη λακωνική πλευρά απέναντι από την Ελαφόνησο, με ανοιχτόχρωμη άμμο και εύκολη πρόσβαση στην περιοχή του περάσματος.'
    },
    {
        aliases: ['Παραλία Κυλλήνης', 'Κυλλήνη', 'Αρκούδι'],
        areas: ['ileia', 'ilia'],
        en: 'A west-Peloponnese Ionian beach zone near Kyllini, practical for long sandy swims and ferry-linked summer stops.',
        gr: 'Παράκτια ζώνη της δυτικής Πελοποννήσου κοντά στην Κυλλήνη, πρακτική για μεγάλες αμμώδεις βουτιές και καλοκαιρινές στάσεις κοντά στα πλοία.'
    },
    {
        aliases: ['Σκαφιδιά', 'Άγιος Ανδρέας', 'Παραλία Αγίου Ηλία', 'Παραλία Λεβεντοχωρίου'],
        areas: ['ileia', 'ilia'],
        en: 'An Ilia coast beach near Pyrgos, with Ionian sunsets, low cliffs in places and a quieter resort rhythm.',
        gr: 'Παραλία της Ηλείας κοντά στον Πύργο, με ηλιοβασίλεμα στο Ιόνιο, χαμηλά βράχια κατά τόπους και πιο ήσυχο παραθεριστικό ρυθμό.'
    },
    {
        aliases: ['Παραλία Γιανισκάρη', 'Μικρό Γιανισκάρι'],
        areas: ['achaia'],
        en: 'A west-Achaia beach close to Kalogria and Strofylia, with a more natural feel than the busier resort fronts.',
        gr: 'Παραλία της δυτικής Αχαΐας κοντά στην Καλόγρια και τη Στροφυλιά, με πιο φυσική αίσθηση από τα πολυσύχναστα μέτωπα.'
    },
    {
        aliases: ['Παραλία Πούντα', 'Πούντα', 'Παραλία Ακράτας'],
        areas: ['achaia'],
        en: 'A north-Peloponnese beach on the Corinthian Gulf, useful for clear-water stops along the Aigialeia coast.',
        gr: 'Παραλία της βόρειας Πελοποννήσου στον Κορινθιακό, καλή για καθαρά νερά κατά μήκος της ακτής της Αιγιάλειας.'
    },
    {
        aliases: ['Πλαζ Πατρών'],
        areas: ['achaia'],
        en: 'Patras’ practical city beach, chosen for a quick swim without leaving the urban coastline.',
        gr: 'Η πρακτική αστική πλαζ της Πάτρας, για γρήγορο μπάνιο χωρίς έξοδο από το παραλιακό μέτωπο της πόλης.'
    }
];

const getPeloponneseAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(PELOPONNESE_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getPeloponneseDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getPeloponneseAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const notable = PELOPONNESE_NOTABLE_DESCRIPTIONS.find(entry => {
        const matchesArea = !entry.areas || entry.areas.includes(areaKey);
        return matchesArea && entry.aliases.some(alias => normalizedName.includes(normalizeBeachLookup(alias)));
    });

    if (notable) return makeLocalizedBeachText(notable.en, notable.gr);

    const label = PELOPONNESE_AREA_LABELS[areaKey];
    return makeLocalizedBeachText(
        `A ${label.en} beach with clear Greek mainland water and a relaxed Peloponnese coastal character.`,
        `Παραλία της ${label.gr} με καθαρά νερά και χαλαρό παράκτιο χαρακτήρα Πελοποννήσου.`
    );
};

const CRETE_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    chania: { en: 'Chania', gr: 'Χανιά' },
    rethymno: { en: 'Rethymno', gr: 'Ρέθυμνο' },
    heraklion: { en: 'Heraklion', gr: 'Ηράκλειο' },
    lasithi: { en: 'Lasithi', gr: 'Λασίθι' },
    gavdos: { en: 'Gavdos', gr: 'Γαύδο' }
};

const CRETE_NOTABLE_DESCRIPTIONS: Record<string, { areas: string[]; en: string; gr: string }> = {
    Balos: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A shallow lagoon at Gramvousa with white sand, bright blue water and one of the most photographed wild landscapes in Crete.',
        gr: 'Ρηχή λιμνοθάλασσα στη Γραμβούσα με λευκή άμμο, φωτεινά μπλε νερά και ένα από τα πιο φωτογραφημένα άγρια τοπία της Κρήτης.'
    },
    Elafonisi: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A protected lagoon beach with pale sand, pink tones in places and very shallow water that changes color through the day.',
        gr: 'Προστατευμένη λιμνοθαλάσσια παραλία με ανοιχτόχρωμη άμμο, ροζ τόνους κατά σημεία και πολύ ρηχά νερά που αλλάζουν χρώμα μέσα στη μέρα.'
    },
    Kedrodasos: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A wilder sandy beach near Elafonisi, framed by junipers and dunes instead of organized beach facilities.',
        gr: 'Πιο άγρια αμμουδερή παραλία κοντά στο Ελαφονήσι, με κέδρους και αμμόλοφους αντί για οργανωμένες εγκαταστάσεις.'
    },
    Falasarna: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A broad west-Crete beach known for open horizons, sunset light and the archaeological site above the shore.',
        gr: 'Μεγάλη παραλία της δυτικής Κρήτης, γνωστή για τον ανοιχτό ορίζοντα, το φως του ηλιοβασιλέματος και τον αρχαιολογικό χώρο πάνω από την ακτή.'
    },
    'Seitan Limani': {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A narrow rock-cut cove on Akrotiri, dramatic and photogenic but reached by a steep path.',
        gr: 'Στενός βραχώδης κολπίσκος στο Ακρωτήρι, εντυπωσιακός και φωτογενής, αλλά με πρόσβαση από απότομο μονοπάτι.'
    },
    Stavros: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A sheltered Akrotiri bay below the famous mountain backdrop, with calm water and a classic film-history connection.',
        gr: 'Προστατευμένος κόλπος στο Ακρωτήρι κάτω από το χαρακτηριστικό βουνό, με ήρεμα νερά και γνωστή κινηματογραφική ιστορία.'
    },
    Marathi: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A family-friendly Akrotiri beach with calm water, tavernas and views across Souda Bay.',
        gr: 'Οικογενειακή παραλία στο Ακρωτήρι με ήρεμα νερά, ταβέρνες και θέα προς τον κόλπο της Σούδας.'
    },
    Diktina: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A remote Menies beach on the Rodopou peninsula, tied to the ancient sanctuary of Diktynna.',
        gr: 'Απομονωμένη παραλία Μένιες στη χερσόνησο Ροδωπού, δεμένη με το αρχαίο ιερό της Δίκτυννας.'
    },
    Sougia: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A south-Chania beach with a laid-back village feel, pebbly shore and access to coastal walking routes.',
        gr: 'Παραλία της νότιας Χανιώτικης ακτής με χαλαρό χωριό, βοτσαλωτή ακτή και πρόσβαση σε παραθαλάσσιες πεζοπορικές διαδρομές.'
    },
    Ilingas: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A small Sfakia beach at the mouth of a gorge, with clear deep water and high rock walls close behind.',
        gr: 'Μικρή παραλία των Σφακίων στην έξοδο φαραγγιού, με καθαρά βαθιά νερά και ψηλά βράχια ακριβώς από πίσω.'
    },
    'Orthi Ammos': {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A long south-coast beach near Frangokastello, known for its dunes and open Libyan Sea views.',
        gr: 'Μεγάλη νότια παραλία κοντά στο Φραγκοκάστελλο, γνωστή για τους αμμόλοφους και την ανοιχτή θέα στο Λιβυκό πέλαγος.'
    },
    Georgioupoli: {
        areas: ['Chania', 'Crete (Chania)'],
        en: 'A long sandy resort beach where rivers, eucalyptus shade and the small harbour shape the village waterfront.',
        gr: 'Μεγάλη αμμουδερή παραλία οικισμού, όπου τα ποτάμια, οι ευκάλυπτοι και το μικρό λιμάνι δίνουν χαρακτήρα στο παραλιακό μέτωπο.'
    },
    Matala: {
        areas: ['Heraklion', 'Crete (Heraklion)'],
        en: 'A landmark south-Heraklion beach with carved caves, Minoan echoes and a famous 1960s hippie story.',
        gr: 'Τοπόσημο της νότιας ακτής του Ηρακλείου με λαξευτές σπηλιές, μινωικούς απόηχους και γνωστή hippie ιστορία από τα 60s.'
    },
    Kommos: {
        areas: ['Heraklion', 'Crete (Heraklion)'],
        en: 'A long open beach beside the archaeological site of Kommos, exposed to wind but rich in Minoan atmosphere.',
        gr: 'Μεγάλη ανοιχτή παραλία δίπλα στον αρχαιολογικό χώρο του Κομμού, εκτεθειμένη στον αέρα αλλά γεμάτη μινωική ατμόσφαιρα.'
    },
    Agiofarago: {
        areas: ['Heraklion', 'Crete (Heraklion)'],
        en: 'A pebbly beach reached through Agiofarago gorge, valued for its cliffs, clear water and remote south-coast feel.',
        gr: 'Βοτσαλωτή παραλία που προσεγγίζεται μέσα από το Αγιοφάραγγο, με βράχια, καθαρά νερά και απομονωμένη νότια αίσθηση.'
    },
    'Kokkinis Ammos': {
        areas: ['Heraklion', 'Crete (Heraklion)'],
        en: 'The Red Beach near Matala, a small cove with reddish sand and a more alternative, clothes-optional reputation.',
        gr: 'Η Κόκκινη Άμμος κοντά στα Μάταλα, μικρός κόλπος με κοκκινωπή άμμο και πιο εναλλακτική, συχνά γυμνιστική φήμη.'
    },
    Vathy: {
        areas: ['Heraklion', 'Crete (Heraklion)'],
        en: 'A quiet south-Heraklion cove close to Matala and Kommos, suited to a slower swim away from the busiest beach fronts.',
        gr: 'Ήσυχος κολπίσκος στη νότια ακτή του Ηρακλείου, κοντά στα Μάταλα και τον Κομμό, για πιο αργή βουτιά μακριά από τα πολυσύχναστα μέτωπα.'
    },
    Plakias: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A long south-Rethymno beach with tavernas, wind exposure and easy access to many smaller coves nearby.',
        gr: 'Μεγάλη παραλία της νότιας ακτής του Ρεθύμνου, με ταβέρνες, έκθεση στον αέρα και εύκολη πρόσβαση σε πολλούς μικρότερους κολπίσκους.'
    },
    Preveli: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A palm-grove beach where the Kourtaliotis river reaches the sea, creating one of Crete’s most distinctive natural scenes.',
        gr: 'Παραλία με φοινικόδασος όπου ο Κουρταλιώτης ποταμός συναντά τη θάλασσα, σχηματίζοντας ένα από τα πιο ιδιαίτερα φυσικά σκηνικά της Κρήτης.'
    },
    Damnoni: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A spacious beach east of Plakias, useful as a base for calm swims and the smaller Ammoudi coves around it.',
        gr: 'Ευρύχωρη παραλία ανατολικά του Πλακιά, καλή βάση για βουτιές και για τους μικρότερους κολπίσκους Αμμούδι γύρω της.'
    },
    Schinaria: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A small clear-water cove near Plakias, popular with snorkelers and divers because the seabed gets interesting quickly.',
        gr: 'Μικρός κολπίσκος με καθαρά νερά κοντά στον Πλακιά, αγαπητός σε snorkelers και δύτες γιατί ο βυθός αποκτά γρήγορα ενδιαφέρον.'
    },
    Triopetra: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A wide south-coast beach named after its three rocks, with big horizons and a wilder Libyan Sea mood.',
        gr: 'Πλατιά νότια παραλία που πήρε το όνομά της από τους τρεις βράχους, με ανοιχτούς ορίζοντες και πιο άγρια διάθεση Λιβυκού πελάγους.'
    },
    Ligres: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A quiet south-Rethymno beach with a raw landscape, pebbly sand and a small waterfall close to the shore after rains.',
        gr: 'Ήσυχη νότια παραλία του Ρεθύμνου με αδρό τοπίο, αμμοβότσαλο και μικρό καταρράκτη κοντά στην ακτή μετά τις βροχές.'
    },
    Spilies: {
        areas: ['Rethymno', 'Crete (Rethymno)'],
        en: 'A north-Rethymno cove named for its small caves, with rock formations giving the beach its character.',
        gr: 'Βόρειος κολπίσκος του Ρεθύμνου που πήρε το όνομά του από τις σπηλιές, με τους βραχώδεις σχηματισμούς να δίνουν τον χαρακτήρα του.'
    },
    Βάι: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'Lasithi’s famous palm beach, backed by the Vai palm forest and bright east-Crete water.',
        gr: 'Η διάσημη φοινικόδαστη παραλία του Λασιθίου, με φόντο το φοινικόδασος του Βάι και φωτεινά νερά της ανατολικής Κρήτης.'
    },
    Βούλισμα: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A very popular Istron beach with pale sand and vivid blue water, one of the easiest Lasithi postcards.',
        gr: 'Πολύ γνωστή παραλία στο Ίστρο με ανοιχτόχρωμη άμμο και έντονα γαλάζια νερά, από τις πιο εύκολες καρτ-ποστάλ του Λασιθίου.'
    },
    Κολοκύθα: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A small Elounda peninsula beach with clear water and boat-trip energy opposite Spinalonga.',
        gr: 'Μικρή παραλία στη χερσόνησο της Ελούντας με καθαρά νερά και αίσθηση εκδρομής με καΐκι απέναντι από τη Σπιναλόγκα.'
    },
    'Αγία Φωτιά': {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A sheltered south-Lasithi beach east of Ierapetra, with pebbly sand and a relaxed taverna-backed setting.',
        gr: 'Προστατευμένη νότια παραλία ανατολικά της Ιεράπετρας, με αμμοβότσαλο και χαλαρό σκηνικό με ταβέρνα από πίσω.'
    },
    'Μαζιδά Άμμος': {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A wide Xerokampos beach with soft pale sand, shallow water and the remote calm of far eastern Crete.',
        gr: 'Μεγάλη παραλία του Ξερόκαμπου με ανοιχτόχρωμη άμμο, ρηχά νερά και την απομονωμένη ηρεμία της άκρας ανατολικής Κρήτης.'
    },
    Κουρεμένος: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A long Palekastro beach known for windsurfing conditions and open views toward the eastern Cretan Sea.',
        gr: 'Μεγάλη παραλία του Παλαίκαστρου, γνωστή για windsurfing συνθήκες και ανοιχτή θέα προς το ανατολικό Κρητικό πέλαγος.'
    },
    Ίτανος: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A quiet beach beside the ancient city of Itanos, combining clear water with one of east Crete’s historic coastal sites.',
        gr: 'Ήσυχη παραλία δίπλα στην αρχαία Ίτανο, που συνδυάζει καθαρά νερά με ένα από τα ιστορικά παράκτια σημεία της ανατολικής Κρήτης.'
    },
    Καρούμες: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A remote beach reached through the Chochlakies gorge, suited to hikers and quiet swims far from road traffic.',
        gr: 'Απομονωμένη παραλία που προσεγγίζεται από το φαράγγι των Χοχλακιών, ιδανική για πεζοπόρους και ήσυχες βουτιές μακριά από δρόμους.'
    },
    Θόλος: {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A low-key beach on the Mirabello side of Lasithi, with a calmer local rhythm and views across the bay.',
        gr: 'Χαμηλών τόνων παραλία στην πλευρά του Μιραμπέλλου, με πιο τοπικό ρυθμό και θέα στον κόλπο.'
    },
    'Richtis Beach': {
        areas: ['Lasithi', 'Crete (Lasithi)'],
        en: 'A north-Lasithi beach often paired with the Richtis gorge walk, where the swim feels like the end of a small adventure.',
        gr: 'Βόρεια παραλία του Λασιθίου που συχνά συνδυάζεται με το φαράγγι του Ρίχτη, κάνοντας τη βουτιά να μοιάζει με τέλος μικρής διαδρομής.'
    }
};

const getCreteAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(CRETE_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getLasithiDescription = (name: string): LocalizedBeachText => {
    const normalizedName = normalizeBeachLookup(name);
    const beachLabel = name.replace(/^Paralia\s+/i, '').replace(/^Παραλία\s+/i, '').trim();

    const notable: Record<string, { en: string; gr: string }> = {
        [normalizeBeachLookup('\u0392\u03ac\u03b9')]: {
            en: 'Lasithi\'s famous palm beach, backed by the Vai palm forest and bright east-Crete water.',
            gr: '\u0397 \u03b4\u03b9\u03ac\u03c3\u03b7\u03bc\u03b7 \u03c6\u03bf\u03b9\u03bd\u03b9\u03ba\u03cc\u03b4\u03b1\u03c3\u03c4\u03b7 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03bf\u03c5 \u039b\u03b1\u03c3\u03b9\u03b8\u03af\u03bf\u03c5, \u03bc\u03b5 \u03c6\u03cc\u03bd\u03c4\u03bf \u03c4\u03bf \u03c6\u03bf\u03b9\u03bd\u03b9\u03ba\u03cc\u03b4\u03b1\u03c3\u03bf\u03c2 \u03c4\u03bf\u03c5 \u0392\u03ac\u03b9 \u03ba\u03b1\u03b9 \u03c6\u03c9\u03c4\u03b5\u03b9\u03bd\u03ac \u03bd\u03b5\u03c1\u03ac \u03c4\u03b7\u03c2 \u03b1\u03bd\u03b1\u03c4\u03bf\u03bb\u03b9\u03ba\u03ae\u03c2 \u039a\u03c1\u03ae\u03c4\u03b7\u03c2.'
        },
        [normalizeBeachLookup('\u0392\u03bf\u03cd\u03bb\u03b9\u03c3\u03bc\u03b1')]: {
            en: 'A popular Istron beach with pale sand and vivid blue water, one of the clearest postcard scenes in Lasithi.',
            gr: '\u0394\u03b7\u03bc\u03bf\u03c6\u03b9\u03bb\u03ae\u03c2 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c3\u03c4\u03bf \u038a\u03c3\u03c4\u03c1\u03bf \u03bc\u03b5 \u03b1\u03bd\u03bf\u03b9\u03c7\u03c4\u03cc\u03c7\u03c1\u03c9\u03bc\u03b7 \u03ac\u03bc\u03bc\u03bf \u03ba\u03b1\u03b9 \u03ad\u03bd\u03c4\u03bf\u03bd\u03b1 \u03b3\u03b1\u03bb\u03ac\u03b6\u03b9\u03b1 \u03bd\u03b5\u03c1\u03ac, \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03c0\u03b9\u03bf \u03ba\u03b1\u03b8\u03b1\u03c1\u03ad\u03c2 \u03ba\u03b1\u03c1\u03c4-\u03c0\u03bf\u03c3\u03c4\u03ac\u03bb \u03b5\u03b9\u03ba\u03cc\u03bd\u03b5\u03c2 \u03c4\u03bf\u03c5 \u039b\u03b1\u03c3\u03b9\u03b8\u03af\u03bf\u03c5.'
        },
        [normalizeBeachLookup('\u039a\u03bf\u03bb\u03bf\u03ba\u03cd\u03b8\u03b1')]: {
            en: 'A small Elounda peninsula beach with clear water and a boat-trip feel opposite Spinalonga.',
            gr: '\u039c\u03b9\u03ba\u03c1\u03ae \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c3\u03c4\u03b7 \u03c7\u03b5\u03c1\u03c3\u03cc\u03bd\u03b7\u03c3\u03bf \u03c4\u03b7\u03c2 \u0395\u03bb\u03bf\u03cd\u03bd\u03c4\u03b1\u03c2, \u03bc\u03b5 \u03ba\u03b1\u03b8\u03b1\u03c1\u03ac \u03bd\u03b5\u03c1\u03ac \u03ba\u03b1\u03b9 \u03b1\u03af\u03c3\u03b8\u03b7\u03c3\u03b7 \u03b5\u03ba\u03b4\u03c1\u03bf\u03bc\u03ae\u03c2 \u03bc\u03b5 \u03ba\u03b1\u03ca\u03ba\u03b9 \u03b1\u03c0\u03ad\u03bd\u03b1\u03bd\u03c4\u03b9 \u03b1\u03c0\u03cc \u03c4\u03b7 \u03a3\u03c0\u03b9\u03bd\u03b1\u03bb\u03cc\u03b3\u03ba\u03b1.'
        },
        [normalizeBeachLookup('\u0391\u03b3\u03af\u03b1 \u03a6\u03c9\u03c4\u03b9\u03ac')]: {
            en: 'A sheltered south-Lasithi beach east of Ierapetra, with pebbly sand and a relaxed taverna-backed setting.',
            gr: '\u03a0\u03c1\u03bf\u03c3\u03c4\u03b1\u03c4\u03b5\u03c5\u03bc\u03ad\u03bd\u03b7 \u03bd\u03cc\u03c4\u03b9\u03b1 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03b1\u03bd\u03b1\u03c4\u03bf\u03bb\u03b9\u03ba\u03ac \u03c4\u03b7\u03c2 \u0399\u03b5\u03c1\u03ac\u03c0\u03b5\u03c4\u03c1\u03b1\u03c2, \u03bc\u03b5 \u03b1\u03bc\u03bc\u03bf\u03b2\u03cc\u03c4\u03c3\u03b1\u03bb\u03bf \u03ba\u03b1\u03b9 \u03c7\u03b1\u03bb\u03b1\u03c1\u03cc \u03c3\u03ba\u03b7\u03bd\u03b9\u03ba\u03cc \u03bc\u03b5 \u03c4\u03b1\u03b2\u03ad\u03c1\u03bd\u03b1 \u03b1\u03c0\u03cc \u03c0\u03af\u03c3\u03c9.'
        },
        [normalizeBeachLookup('\u039c\u03b1\u03b6\u03b9\u03b4\u03ac \u0386\u03bc\u03bc\u03bf\u03c2')]: {
            en: 'A wide Xerokampos beach with soft pale sand, shallow water and the remote calm of far eastern Crete.',
            gr: '\u039c\u03b5\u03b3\u03ac\u03bb\u03b7 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03bf\u03c5 \u039e\u03b5\u03c1\u03cc\u03ba\u03b1\u03bc\u03c0\u03bf\u03c5 \u03bc\u03b5 \u03b1\u03bd\u03bf\u03b9\u03c7\u03c4\u03cc\u03c7\u03c1\u03c9\u03bc\u03b7 \u03ac\u03bc\u03bc\u03bf, \u03c1\u03b7\u03c7\u03ac \u03bd\u03b5\u03c1\u03ac \u03ba\u03b1\u03b9 \u03c4\u03b7\u03bd \u03b1\u03c0\u03bf\u03bc\u03bf\u03bd\u03c9\u03bc\u03ad\u03bd\u03b7 \u03b7\u03c1\u03b5\u03bc\u03af\u03b1 \u03c4\u03b7\u03c2 \u03ac\u03ba\u03c1\u03b1\u03c2 \u03b1\u03bd\u03b1\u03c4\u03bf\u03bb\u03b9\u03ba\u03ae\u03c2 \u039a\u03c1\u03ae\u03c4\u03b7\u03c2.'
        },
        [normalizeBeachLookup('\u039a\u03bf\u03c5\u03c1\u03b5\u03bc\u03ad\u03bd\u03bf\u03c2')]: {
            en: 'A long Palekastro beach known for windsurfing conditions and open views toward the eastern Cretan Sea.',
            gr: '\u039c\u03b5\u03b3\u03ac\u03bb\u03b7 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03bf\u03c5 \u03a0\u03b1\u03bb\u03b1\u03af\u03ba\u03b1\u03c3\u03c4\u03c1\u03bf\u03c5, \u03b3\u03bd\u03c9\u03c3\u03c4\u03ae \u03b3\u03b9\u03b1 windsurfing \u03c3\u03c5\u03bd\u03b8\u03ae\u03ba\u03b5\u03c2 \u03ba\u03b1\u03b9 \u03b1\u03bd\u03bf\u03b9\u03c7\u03c4\u03ae \u03b8\u03ad\u03b1 \u03c0\u03c1\u03bf\u03c2 \u03c4\u03bf \u03b1\u03bd\u03b1\u03c4\u03bf\u03bb\u03b9\u03ba\u03cc \u039a\u03c1\u03b7\u03c4\u03b9\u03ba\u03cc \u03c0\u03ad\u03bb\u03b1\u03b3\u03bf\u03c2.'
        },
        [normalizeBeachLookup('\u039a\u03b1\u03c1\u03bf\u03cd\u03bc\u03b5\u03c2')]: {
            en: 'A remote beach reached through the Chochlakies gorge, suited to hikers and quiet swims far from road traffic.',
            gr: '\u0391\u03c0\u03bf\u03bc\u03bf\u03bd\u03c9\u03bc\u03ad\u03bd\u03b7 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c0\u03bf\u03c5 \u03c0\u03c1\u03bf\u03c3\u03b5\u03b3\u03b3\u03af\u03b6\u03b5\u03c4\u03b1\u03b9 \u03b1\u03c0\u03cc \u03c4\u03bf \u03c6\u03b1\u03c1\u03ac\u03b3\u03b3\u03b9 \u03c4\u03c9\u03bd \u03a7\u03bf\u03c7\u03bb\u03b1\u03ba\u03b9\u03ce\u03bd, \u03b9\u03b4\u03b1\u03bd\u03b9\u03ba\u03ae \u03b3\u03b9\u03b1 \u03c0\u03b5\u03b6\u03bf\u03c0\u03cc\u03c1\u03bf\u03c5\u03c2 \u03ba\u03b1\u03b9 \u03ae\u03c3\u03c5\u03c7\u03b5\u03c2 \u03b2\u03bf\u03c5\u03c4\u03b9\u03ad\u03c2.'
        }
    };

    const exact = notable[normalizedName];
    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const lowerName = normalizeBeachLookup(name);
    if (lowerName.includes('ammos') || lowerName.includes('\u03b1\u03bc\u03bc\u03bf') || lowerName.includes('beach')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a Lasithi beach for an easy swim on the quieter eastern side of Crete.`,
            `\u0397 ${beachLabel} \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03bf\u03c5 \u039b\u03b1\u03c3\u03b9\u03b8\u03af\u03bf\u03c5 \u03b3\u03b9\u03b1 \u03ac\u03bd\u03b5\u03c4\u03b7 \u03b2\u03bf\u03c5\u03c4\u03b9\u03ac \u03c3\u03c4\u03b7\u03bd \u03c0\u03b9\u03bf \u03ae\u03c3\u03c5\u03c7\u03b7 \u03b1\u03bd\u03b1\u03c4\u03bf\u03bb\u03b9\u03ba\u03ae \u03c0\u03bb\u03b5\u03c5\u03c1\u03ac \u03c4\u03b7\u03c2 \u039a\u03c1\u03ae\u03c4\u03b7\u03c2.`
        );
    }

    return makeLocalizedBeachText(
        `${beachLabel} is a local Lasithi swim spot, useful while exploring the Mirabello, Ierapetra and Sitia coastlines.`,
        `\u0397 ${beachLabel} \u03b5\u03af\u03bd\u03b1\u03b9 \u03c4\u03bf\u03c0\u03b9\u03ba\u03cc \u03c3\u03b7\u03bc\u03b5\u03af\u03bf \u03b3\u03b9\u03b1 \u03bc\u03c0\u03ac\u03bd\u03b9\u03bf \u03c3\u03c4\u03bf \u039b\u03b1\u03c3\u03af\u03b8\u03b9, \u03c7\u03c1\u03ae\u03c3\u03b9\u03bc\u03bf \u03cc\u03c4\u03b1\u03bd \u03b5\u03be\u03b5\u03c1\u03b5\u03c5\u03bd\u03ac\u03c2 \u03c4\u03b9\u03c2 \u03b1\u03ba\u03c4\u03ad\u03c2 \u03c4\u03bf\u03c5 \u039c\u03b9\u03c1\u03b1\u03bc\u03c0\u03ad\u03bb\u03bb\u03bf\u03c5, \u03c4\u03b7\u03c2 \u0399\u03b5\u03c1\u03ac\u03c0\u03b5\u03c4\u03c1\u03b1\u03c2 \u03ba\u03b1\u03b9 \u03c4\u03b7\u03c2 \u03a3\u03b7\u03c4\u03b5\u03af\u03b1\u03c2.`
    );
};

const getCreteDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getCreteAreaKey(area);
    if (!areaKey) return null;

    if (areaKey === 'lasithi') {
        return getLasithiDescription(name);
    }

    const normalizedName = normalizeBeachLookup(name);
    const normalizedArea = normalizeBeachLookup(area);
    const exact = Object.entries(CRETE_NOTABLE_DESCRIPTIONS).find(([beachName, description]) => {
        const matchesName = normalizeBeachLookup(beachName) === normalizedName;
        const matchesArea = description.areas.some(region => {
            const normalizedRegion = normalizeBeachLookup(region);
            return normalizedArea === normalizedRegion || normalizedArea.includes(normalizedRegion);
        });
        return matchesName && matchesArea;
    })?.[1];

    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const areaLabel = CRETE_AREA_LABELS[areaKey];
    const beachLabel = name.replace(/^Παραλία\s+/i, '').replace(/\s+\(nudist\)$/i, '').trim();
    const lowerName = normalizeBeachLookup(name);

    if (lowerName.includes('ammos') || lowerName.includes('amoudi') || lowerName.includes('akti') || lowerName.includes('αμμος') || lowerName.includes('ακτη')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a sandy Cretan beach in ${areaLabel.en}, best for an easy swim when the wind is gentle.`,
            `Η ${beachLabel} είναι αμμουδερή κρητική παραλία στα ${areaLabel.gr}, καλύτερη για άνετη βουτιά όταν ο αέρας είναι ήπιος.`
        );
    }

    if (lowerName.includes('limani') || lowerName.includes('gulf') || lowerName.includes('kolpos') || lowerName.includes('λιμαν') || lowerName.includes('κολπος')) {
        return makeLocalizedBeachText(
            `${beachLabel} has a sheltered cove feeling on the ${areaLabel.en} coast, with calmer water than the open beaches nearby.`,
            `Η ${beachLabel} έχει αίσθηση προστατευμένου κολπίσκου στην ακτή των ${areaLabel.gr}, με πιο ήρεμα νερά από τις ανοιχτές παραλίες γύρω της.`
        );
    }

    if (lowerName.includes('nudist')) {
        return makeLocalizedBeachText(
            `${beachLabel} is one of the quieter clothes-optional swim spots in ${areaLabel.en}, better for low-key beach time than heavy organization.`,
            `Η ${beachLabel} είναι από τα πιο ήσυχα σημεία γυμνιστών στα ${areaLabel.gr}, περισσότερο για χαλαρή παραμονή παρά για έντονη οργάνωση.`
        );
    }

    const variants = [
        {
            en: `${beachLabel} is a local Crete beach in ${areaLabel.en}, useful for a straightforward swim without the postcard crowds.`,
            gr: `Η ${beachLabel} είναι τοπική παραλία της Κρήτης στα ${areaLabel.gr}, καλή για απλή βουτιά χωρίς την πολυκοσμία των πιο διάσημων σημείων.`
        },
        {
            en: `${beachLabel} gives the ${areaLabel.en} coast a quieter stop, with the appeal mostly in the landscape and the easy contact with the sea.`,
            gr: `Η ${beachLabel} δίνει στην ακτή των ${areaLabel.gr} μια πιο ήσυχη στάση, με βασική αξία το τοπίο και την άμεση επαφή με τη θάλασσα.`
        },
        {
            en: `${beachLabel} works well as a small Cretan detour while exploring the wider ${areaLabel.en} shoreline.`,
            gr: `Η ${beachLabel} λειτουργεί ωραία σαν μικρή κρητική παράκαμψη όταν εξερευνάς την ευρύτερη ακτογραμμή των ${areaLabel.gr}.`
        },
        {
            en: `${beachLabel} is one of the less formal swim spots in ${areaLabel.en}, with a simple coast-first character.`,
            gr: `Η ${beachLabel} είναι από τα λιγότερο τυπικά σημεία για μπάνιο στα ${areaLabel.gr}, με απλό χαρακτήρα καθαρής ακτογραμμής.`
        }
    ];
    const index = Math.abs(normalizedName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length;
    return makeLocalizedBeachText(variants[index].en, variants[index].gr);
};

const MACEDONIA_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    halkidiki: { en: 'Halkidiki', gr: 'Χαλκιδική' },
    kilkis: { en: 'Kilkis', gr: 'Κιλκίς' },
    pieria: { en: 'Pieria', gr: 'Πιερία' },
    thessaloniki: { en: 'Thessaloniki', gr: 'Θεσσαλονίκη' },
    kavala: { en: 'Kavala', gr: 'Καβάλα' },
    thasos: { en: 'Thasos', gr: 'Θάσο' },
    kastoria: { en: 'Kastoria', gr: 'Καστοριά' }
};

const MACEDONIA_NOTABLE_DESCRIPTIONS: Record<string, { areas: string[]; en: string; gr: string }> = {
    "Καβουρότρυπες": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A Sithonia landmark with sculpted white rocks, pine shade and bright turquoise water in a chain of tiny coves.",
        gr: "Τοπόσημο της Σιθωνίας με σμιλεμένους λευκούς βράχους, πεύκα και έντονα τιρκουάζ νερά σε αλυσίδα μικρών κολπίσκων."
    },
    "Kavourotrypes": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A Sithonia landmark with sculpted white rocks, pine shade and bright turquoise water in a chain of tiny coves.",
        gr: "Τοπόσημο της Σιθωνίας με σμιλεμένους λευκούς βράχους, πεύκα και έντονα τιρκουάζ νερά σε αλυσίδα μικρών κολπίσκων."
    },
    "Sarti": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A long Sithonia beach facing Mount Athos, with broad sand, tavernas and a classic summer-village rhythm.",
        gr: "Μεγάλη παραλία της Σιθωνίας με θέα στον Άθω, πλατιά άμμο, ταβέρνες και κλασικό ρυθμό καλοκαιρινού χωριού."
    },
    "Porto Koufo": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "One of Greece's safest natural harbours, a deep sheltered bay with fishing boats and calm water in south Sithonia.",
        gr: "Ένα από τα ασφαλέστερα φυσικά λιμάνια της Ελλάδας, βαθύς προστατευμένος κόλπος με ψαρόβαρκες και ήρεμα νερά στη νότια Σιθωνία."
    },
    "Kalamitsi": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A south Sithonia bay with clear water, sandy coves and a relaxed camping-and-village atmosphere.",
        gr: "Κόλπος της νότιας Σιθωνίας με καθαρά νερά, αμμουδερούς κολπίσκους και χαλαρή ατμόσφαιρα camping και χωριού."
    },
    "Trani Ammouda": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A long sandy beach near Ormos Panagias, known for space, shallow water and views toward the Sithonia coast.",
        gr: "Μεγάλη αμμουδερή παραλία κοντά στον Όρμο Παναγίας, γνωστή για χώρο, ρηχά νερά και θέα προς την ακτογραμμή της Σιθωνίας."
    },
    "Vourvourou": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A sheltered Sithonia lagoon-like coast, famous for calm water and boat trips around the Diaporos islets.",
        gr: "Προστατευμένη ακτογραμμή της Σιθωνίας με λιμνοθαλασσινή αίσθηση, γνωστή για ήρεμα νερά και βαρκάδες στα νησάκια του Διάπορου."
    },
    "Ouranoupoli": {
        areas: ["Halkidiki", "Halkidiki (mainland)"],
        en: "A beach at the gateway to Mount Athos, combining swim stops with views of the monastic peninsula.",
        gr: "Παραλία στην πύλη του Αγίου Όρους, που συνδυάζει βουτιές με θέα προς την αθωνική χερσόνησο."
    },
    "Αμμόλοφοι": {
        areas: ["Kavala", "Kavala (mainland)"],
        en: "Kavala's famous Ammolofoi beach, a long sandy shore with clear water and one of northern Greece's liveliest summer scenes.",
        gr: "Οι διάσημοι Αμμόλοφοι της Καβάλας, μεγάλη αμμουδερή ακτή με καθαρά νερά και από τις πιο ζωντανές καλοκαιρινές σκηνές της βόρειας Ελλάδας."
    },
    "Τόσκα": {
        areas: ["Kavala", "Kavala (mainland)"],
        en: "A sheltered beach just west of Kavala, with green slopes around it and easy access from the coastal road.",
        gr: "Προστατευμένη παραλία λίγο δυτικά της Καβάλας, με πράσινες πλαγιές γύρω της και εύκολη πρόσβαση από τον παραλιακό δρόμο."
    },
    "Παραλία Καλαμίτσας": {
        areas: ["Kavala", "Kavala (mainland)"],
        en: "Kavala's main city beach, practical for a swim without leaving town and backed by the urban waterfront.",
        gr: "Η βασική αστική παραλία της Καβάλας, πρακτική για βουτιά χωρίς να φύγεις από την πόλη και με φόντο το παραλιακό μέτωπο."
    },
    "Ραψάνη": {
        areas: ["Kavala", "Kavala (mainland)"],
        en: "A central Kavala beach below the city, useful for a quick swim with the old town close above.",
        gr: "Κεντρική παραλία της Καβάλας κάτω από την πόλη, για γρήγορη βουτιά με την παλιά πόλη σε μικρή απόσταση."
    },
    "Παραλία Γλυφάδα (Θάσος)": {
        areas: ["Thasos"],
        en: "A north Thasos beach near Limenas, known for beach-bar energy and clear water close to the island capital.",
        gr: "Βόρεια παραλία της Θάσου κοντά στον Λιμένα, γνωστή για beach-bar ενέργεια και καθαρά νερά κοντά στην πρωτεύουσα του νησιού."
    },
    "Σαλιάρα": {
        areas: ["Thasos"],
        en: "Thasos' marble-white beach, famous for pale pebbles and bright blue water created by the island's stone landscape.",
        gr: "Η λευκή μαρμάρινη παραλία της Θάσου, διάσημη για τα ανοιχτόχρωμα βότσαλα και τα λαμπερά μπλε νερά του μαρμάρινου τοπίου."
    },
    "Χρυσή Αμμουδιά": {
        areas: ["Thasos"],
        en: "A long sandy bay on east Thasos, backed by green mountains and ideal for easy family swimming.",
        gr: "Μεγάλος αμμουδερός κόλπος στην ανατολική Θάσο, με πράσινα βουνά από πίσω και εύκολη οικογενειακή βουτιά."
    },
    "Παραδείσος": {
        areas: ["Thasos"],
        en: "A broad sandy Thasos beach with shallow turquoise water, one of the island's classic east-coast swim spots.",
        gr: "Μεγάλη αμμουδερή παραλία της Θάσου με ρηχά τιρκουάζ νερά, από τις κλασικές ανατολικές ακτές του νησιού."
    },
    "Αλυκές": {
        areas: ["Thasos"],
        en: "A double-bay beach beside ancient marble quarries, mixing clear water with one of Thasos' most historic coastal settings.",
        gr: "Διπλός κόλπος δίπλα σε αρχαία λατομεία μαρμάρου, που συνδυάζει καθαρά νερά με ένα από τα πιο ιστορικά παράκτια σκηνικά της Θάσου."
    },
    "Πλαζ Καστοριάς": {
        areas: ["Kastoria", "Kastoria (mainland)"],
        en: "A lakeside swimming spot on Lake Kastoria rather than a sea beach, with city and mountain views around the water.",
        gr: "Λιμναίο σημείο για μπάνιο στη λίμνη της Καστοριάς και όχι θαλάσσια παραλία, με θέα στην πόλη και τα βουνά γύρω από το νερό."
    }
};

const getMacedoniaAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(MACEDONIA_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getMacedoniaDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getMacedoniaAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const exact = Object.entries(MACEDONIA_NOTABLE_DESCRIPTIONS).find(([beachName, description]) => {
        const matchesName = normalizeBeachLookup(beachName) === normalizedName;
        const matchesArea = description.areas.some(region => {
            const normalizedRegion = normalizeBeachLookup(region);
            return normalizedRegion === areaKey || normalizeBeachLookup(area).includes(normalizedRegion);
        });
        return matchesName && matchesArea;
    })?.[1];

    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const areaLabel = MACEDONIA_AREA_LABELS[areaKey];
    const beachLabel = name.replace(/^Παραλία\s+/i, '').trim();
    const lowerName = normalizeBeachLookup(name);

    if (lowerName.includes('ammos') || lowerName.includes('αμμος') || lowerName.includes('αμμουδια') || lowerName.includes('ακτη')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a sandy Macedonia beach in ${areaLabel.en}, suited to easy swimming and a relaxed summer rhythm.`,
            `Η ${beachLabel} είναι αμμουδερή μακεδονική παραλία στη ${areaLabel.gr}, κατάλληλη για εύκολη βουτιά και χαλαρό καλοκαιρινό ρυθμό.`
        );
    }

    if (lowerName.includes('limani') || lowerName.includes('λιμαν') || lowerName.includes('porto') || lowerName.includes('ορμος')) {
        return makeLocalizedBeachText(
            `${beachLabel} has a sheltered harbour-or-cove feel on the ${areaLabel.en} coast, better for calm-water swims.`,
            `Η ${beachLabel} έχει αίσθηση προστατευμένου λιμανιού ή όρμου στην ακτή της ${areaLabel.gr}, πιο κατάλληλη για ήρεμα νερά.`
        );
    }

    if (lowerName.includes('plaz') || lowerName.includes('πλαζ')) {
        return makeLocalizedBeachText(
            `${beachLabel} is a practical organized swim stop in ${areaLabel.en}, with easier access than the wilder coves nearby.`,
            `Η ${beachLabel} είναι πρακτική οργανωμένη στάση για μπάνιο στη ${areaLabel.gr}, με ευκολότερη πρόσβαση από τους πιο άγριους κολπίσκους γύρω της.`
        );
    }

    const variants = [
        {
            en: `${beachLabel} is a local beach in ${areaLabel.en}, with a simple northern-Greece summer feel and clean water when conditions are calm.`,
            gr: `Η ${beachLabel} είναι τοπική παραλία στη ${areaLabel.gr}, με απλή βορειοελλαδίτικη καλοκαιρινή αίσθηση και καθαρά νερά όταν ο καιρός βοηθά.`
        },
        {
            en: `${beachLabel} works as a low-key ${areaLabel.en} coastal stop, useful for a swim while exploring the wider Macedonia shoreline.`,
            gr: `Η ${beachLabel} λειτουργεί ως χαμηλών τόνων παραλιακή στάση στη ${areaLabel.gr}, χρήσιμη για βουτιά εξερευνώντας την ακτογραμμή της Μακεδονίας.`
        },
        {
            en: `${beachLabel} gives the ${areaLabel.en} coast a quieter option away from the most photographed beaches.`,
            gr: `Η ${beachLabel} δίνει στην ακτή της ${areaLabel.gr} μια πιο ήσυχη επιλογή μακριά από τις πιο φωτογραφημένες παραλίες.`
        },
        {
            en: `${beachLabel} is one of the smaller Macedonia swim spots where the main appeal is straightforward access to the sea.`,
            gr: `Η ${beachLabel} είναι ένα από τα μικρότερα σημεία για μπάνιο στη Μακεδονία, με βασικό πλεονέκτημα την απλή πρόσβαση στη θάλασσα.`
        }
    ];
    const index = Math.abs(normalizedName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length;
    return makeLocalizedBeachText(variants[index].en, variants[index].gr);
};

const THRACE_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    evros: { en: 'Evros', gr: 'Έβρος' },
    rodopi: { en: 'Rodopi', gr: 'Ροδόπη' },
    xanthi: { en: 'Xanthi', gr: 'Ξάνθη' },
    samothraki: { en: 'Samothraki', gr: 'Σαμοθράκη' }
};

const THRACE_NOTABLE_DESCRIPTIONS: Record<string, { areas: string[]; en: string; gr: string }> = {
    'Δίκελλα - Αγία Παρασκευή': {
        areas: ['Evros', 'Evros (mainland)'],
        en: 'A west-Alexandroupoli beach stretch between Dikella and Agia Paraskevi, with open water and a relaxed local summer rhythm.',
        gr: 'Παραλιακό κομμάτι δυτικά της Αλεξανδρούπολης, ανάμεσα στα Δίκελλα και την Αγία Παρασκευή, με ανοιχτά νερά και χαλαρό τοπικό καλοκαιρινό ρυθμό.'
    },
    'Άγιος Γεώργιος Μάκρης': {
        areas: ['Evros', 'Evros (mainland)'],
        en: 'A Makri-area swim spot with clear Thracian Sea water and easy access from the Alexandroupoli coastal road.',
        gr: 'Σημείο για μπάνιο στην περιοχή της Μάκρης, με καθαρά νερά Θρακικού πελάγους και εύκολη πρόσβαση από τον παραλιακό δρόμο της Αλεξανδρούπολης.'
    },
    'Παραλία Νέας Χιλής': {
        areas: ['Evros', 'Evros (mainland)'],
        en: 'The main Nea Chili beach zone near Alexandroupoli, practical for an organized swim close to the city.',
        gr: 'Η βασική ζώνη παραλίας της Νέας Χιλής κοντά στην Αλεξανδρούπολη, πρακτική για οργανωμένη βουτιά δίπλα στην πόλη.'
    },
    'Παραλία Αλεξανδρούπολης': {
        areas: ['Evros', 'Evros (mainland)'],
        en: 'An urban Alexandroupoli beach stop, useful for a quick swim with the city waterfront and Samothraki views nearby.',
        gr: 'Αστική παραλιακή στάση της Αλεξανδρούπολης, χρήσιμη για γρήγορη βουτιά με το παραλιακό μέτωπο και τη θέα προς Σαμοθράκη κοντά.'
    },
    'Παραλία Ίμερου': {
        areas: ['Rodopi', 'Rodopi (mainland)'],
        en: 'A quiet Rodopi beach by the wetlands and lagoons of the Thracian coast, better for nature-heavy beach time.',
        gr: 'Ήσυχη παραλία της Ροδόπης δίπλα στους υγροτόπους και τις λιμνοθάλασσες της Θρακικής ακτής, περισσότερο για επαφή με τη φύση.'
    },
    Μαρμαρίτσα: {
        areas: ['Rodopi', 'Rodopi (mainland)'],
        en: 'A small Rodopi coastal spot with a low-key character, away from the louder organized beaches.',
        gr: 'Μικρό παραλιακό σημείο της Ροδόπης με χαμηλών τόνων χαρακτήρα, μακριά από τις πιο έντονες οργανωμένες ακτές.'
    },
    Παχυνάμμος: {
        areas: ['Rodopi', 'Rodopi (mainland)'],
        en: 'A sandy Rodopi shore whose appeal is the open, uncomplicated Thracian Sea coastline.',
        gr: 'Αμμουδερή ακτή της Ροδόπης με βασική αξία την ανοιχτή, απλή γραμμή του Θρακικού πελάγους.'
    },
    Σύναξη: {
        areas: ['Rodopi', 'Rodopi (mainland)'],
        en: 'A remote-feeling Rodopi beach close to the Maroneia coastline, with a more natural and quiet mood.',
        gr: 'Παραλία της Ροδόπης κοντά στην ακτογραμμή της Μαρώνειας, με πιο φυσική και ήσυχη διάθεση.'
    },
    'Παραλία Μυρωδάτου': {
        areas: ['Xanthi', 'Xanthi (mainland)'],
        en: 'A well-known Xanthi beach with long sand and shallow water, popular for easy summer days near Avdira.',
        gr: 'Γνωστή παραλία της Ξάνθης με μεγάλη αμμουδιά και ρηχά νερά, δημοφιλής για εύκολες καλοκαιρινές μέρες κοντά στα Άβδηρα.'
    },
    'Παραλία Γαλάνης Νέστου': {
        areas: ['Xanthi', 'Xanthi (mainland)'],
        en: 'A Nestos-side coastal stop where the beach visit pairs naturally with the river landscape and delta area.',
        gr: 'Παραλιακή στάση στην πλευρά του Νέστου, όπου η βουτιά συνδυάζεται φυσικά με το τοπίο του ποταμού και την περιοχή του δέλτα.'
    },
    Βάτος: {
        areas: ['Samothraki'],
        en: 'A wild Samothraki beach reached with effort or by boat, known for its remote setting below steep slopes.',
        gr: 'Άγρια παραλία της Σαμοθράκης που θέλει προσπάθεια ή καΐκι, γνωστή για το απομονωμένο σκηνικό κάτω από απότομες πλαγιές.'
    },
    'Παχιά Άμμος': {
        areas: ['Samothraki'],
        en: 'Samothraki’s best-known sandy beach, easier than most of the island’s wilder shores and open to the south.',
        gr: 'Η πιο γνωστή αμμουδερή παραλία της Σαμοθράκης, ευκολότερη από τις πιο άγριες ακτές του νησιού και ανοιχτή προς νότο.'
    },
    'Παραλία Μακρυλιές': {
        areas: ['Samothraki'],
        en: 'A south-Samothraki beach near Makrilies, with a quieter island feel and views across the northern Aegean.',
        gr: 'Νότια παραλία της Σαμοθράκης κοντά στις Μακρυλιές, με ήσυχη νησιώτικη αίσθηση και θέα στο βόρειο Αιγαίο.'
    }
};

const getThraceAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    for (const areaKey of Object.keys(THRACE_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getThraceDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getThraceAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const normalizedArea = normalizeBeachLookup(area);
    const exact = Object.entries(THRACE_NOTABLE_DESCRIPTIONS).find(([beachName, description]) => {
        const matchesName = normalizeBeachLookup(beachName) === normalizedName;
        const matchesArea = description.areas.some(region => {
            const normalizedRegion = normalizeBeachLookup(region);
            return normalizedArea === normalizedRegion || normalizedArea.includes(normalizedRegion);
        });
        return matchesName && matchesArea;
    })?.[1];

    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const areaLabel = THRACE_AREA_LABELS[areaKey];
    const beachLabel = name.replace(/^Παραλία\s+/i, '').trim();
    const variants = [
        {
            en: `${beachLabel} is a low-key Thracian coast beach in ${areaLabel.en}, suited to simple swims and open horizons.`,
            gr: `Η ${beachLabel} είναι χαμηλών τόνων παραλία της Θράκης στην περιοχή ${areaLabel.gr}, κατάλληλη για απλές βουτιές και ανοιχτό ορίζοντα.`
        },
        {
            en: `${beachLabel} works as a quiet ${areaLabel.en} beach stop, with the landscape carrying more weight than heavy organization.`,
            gr: `Η ${beachLabel} λειτουργεί ως ήσυχη παραλιακή στάση στην περιοχή ${areaLabel.gr}, όπου το τοπίο μετρά περισσότερο από την έντονη οργάνωση.`
        },
        {
            en: `${beachLabel} gives the Thracian Sea shoreline a straightforward local swim option in ${areaLabel.en}.`,
            gr: `Η ${beachLabel} δίνει στην ακτογραμμή του Θρακικού πελάγους μια απλή τοπική επιλογή για μπάνιο στην περιοχή ${areaLabel.gr}.`
        }
    ];
    const index = Math.abs(normalizedName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length;
    return makeLocalizedBeachText(variants[index].en, variants[index].gr);
};

const NORTH_AEGEAN_AREA_LABELS: Record<string, { en: string; gr: string }> = {
    chios: { en: 'Chios', gr: '\u03a7\u03af\u03bf' },
    psara: { en: 'Psara', gr: '\u03a8\u03b1\u03c1\u03ac' },
    ikaria: { en: 'Ikaria', gr: '\u0399\u03ba\u03b1\u03c1\u03af\u03b1' },
    lesvos: { en: 'Lesvos', gr: '\u039b\u03ad\u03c3\u03b2\u03bf' },
    lemnos: { en: 'Lemnos', gr: '\u039b\u03ae\u03bc\u03bd\u03bf' },
    agios_efstratios: { en: 'Agios Efstratios', gr: '\u0386\u03b3\u03b9\u03bf \u0395\u03c5\u03c3\u03c4\u03c1\u03ac\u03c4\u03b9\u03bf' },
    fournoi: { en: 'Fournoi', gr: 'Φούρνους' },
    oinousses: { en: 'Oinousses', gr: 'Οινούσσες' },
    samos: { en: 'Samos', gr: '\u03a3\u03ac\u03bc\u03bf' }
};

const getNorthAegeanAreaKey = (area: string): string | null => {
    const normalizedArea = normalizeBeachLookup(area);
    const aliases: Record<string, string> = {
        agiosefstratios: 'agios_efstratios',
        agioseustratios: 'agios_efstratios'
    };
    if (aliases[normalizedArea]) return aliases[normalizedArea];
    for (const areaKey of Object.keys(NORTH_AEGEAN_AREA_LABELS)) {
        const normalizedKey = normalizeBeachLookup(areaKey);
        if (normalizedArea === normalizedKey || normalizedArea.includes(normalizedKey)) return areaKey;
    }
    return null;
};

const getNorthAegeanDescription = (name: string, area: string): LocalizedBeachText | null => {
    const areaKey = getNorthAegeanAreaKey(area);
    if (!areaKey) return null;

    const normalizedName = normalizeBeachLookup(name);
    const notable: Record<string, { en: string; gr: string }> = {
        [normalizeBeachLookup('\u039c\u03b1\u03cd\u03c1\u03b1 \u0392\u03cc\u03bb\u03b9\u03b1')]: {
            en: 'A signature Chios beach with dark volcanic pebbles near Emporios, visually unlike most Aegean shores.',
            gr: '\u0395\u03bc\u03b2\u03bb\u03b7\u03bc\u03b1\u03c4\u03b9\u03ba\u03ae \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03b7\u03c2 \u03a7\u03af\u03bf\u03c5 \u03bc\u03b5 \u03bc\u03b1\u03cd\u03c1\u03b1 \u03b7\u03c6\u03b1\u03b9\u03c3\u03c4\u03b5\u03b9\u03b1\u03ba\u03ac \u03b2\u03cc\u03c4\u03c3\u03b1\u03bb\u03b1 \u03ba\u03bf\u03bd\u03c4\u03ac \u03c3\u03c4\u03bf \u0395\u03bc\u03c0\u03bf\u03c1\u03b9\u03cc, \u03c0\u03bf\u03bb\u03cd \u03b4\u03b9\u03b1\u03c6\u03bf\u03c1\u03b5\u03c4\u03b9\u03ba\u03ae \u03bf\u03c0\u03c4\u03b9\u03ba\u03ac \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03c0\u03b5\u03c1\u03b9\u03c3\u03c3\u03cc\u03c4\u03b5\u03c1\u03b5\u03c2 \u03b1\u03ba\u03c4\u03ad\u03c2 \u03c4\u03bf\u03c5 \u0391\u03b9\u03b3\u03b1\u03af\u03bf\u03c5.'
        },
        [normalizeBeachLookup('\u039c\u03b5\u03c3\u03b1\u03ba\u03c4\u03ae')]: {
            en: 'Ikaria\'s broad surf-friendly beach by Armenistis, with a lively summer feel and open north-Aegean water.',
            gr: '\u039c\u03b5\u03b3\u03ac\u03bb\u03b7 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03b7\u03c2 \u0399\u03ba\u03b1\u03c1\u03af\u03b1\u03c2 \u03ba\u03bf\u03bd\u03c4\u03ac \u03c3\u03c4\u03bf\u03bd \u0391\u03c1\u03bc\u03b5\u03bd\u03b9\u03c3\u03c4\u03ae, \u03bc\u03b5 \u03b1\u03bd\u03bf\u03b9\u03c7\u03c4\u03ac \u03bd\u03b5\u03c1\u03ac, \u03b6\u03c9\u03bd\u03c4\u03b1\u03bd\u03cc \u03ba\u03b1\u03bb\u03bf\u03ba\u03b1\u03af\u03c1\u03b9 \u03ba\u03b1\u03b9 \u03c3\u03c5\u03c7\u03bd\u03ac \u03ba\u03cd\u03bc\u03b1.'
        },
        [normalizeBeachLookup('\u039d\u03b1\u03c2')]: {
            en: 'A small Ikaria cove at the mouth of the Chalaris river, tied to sunset views and the ancient Artemis sanctuary.',
            gr: '\u039c\u03b9\u03ba\u03c1\u03cc\u03c2 \u03ba\u03cc\u03bb\u03c0\u03bf\u03c2 \u03c4\u03b7\u03c2 \u0399\u03ba\u03b1\u03c1\u03af\u03b1\u03c2 \u03c3\u03c4\u03b9\u03c2 \u03b5\u03ba\u03b2\u03bf\u03bb\u03ad\u03c2 \u03c4\u03bf\u03c5 \u03a7\u03ac\u03bb\u03b1\u03c1\u03b7, \u03b4\u03b5\u03bc\u03ad\u03bd\u03bf\u03c2 \u03bc\u03b5 \u03b7\u03bb\u03b9\u03bf\u03b2\u03b1\u03c3\u03b9\u03bb\u03ad\u03bc\u03b1\u03c4\u03b1 \u03ba\u03b1\u03b9 \u03c4\u03bf \u03b1\u03c1\u03c7\u03b1\u03af\u03bf \u03b9\u03b5\u03c1\u03cc \u03c4\u03b7\u03c2 \u0391\u03c1\u03c4\u03ad\u03bc\u03b9\u03b4\u03b1\u03c2.'
        },
        [normalizeBeachLookup('\u0392\u03b1\u03c4\u03b5\u03c1\u03ac')]: {
            en: 'One of Lesvos\' longest beaches, a wide south-coast shore with space, tavernas and easy family swimming.',
            gr: '\u0391\u03c0\u03cc \u03c4\u03b9\u03c2 \u03bc\u03b5\u03b3\u03b1\u03bb\u03cd\u03c4\u03b5\u03c1\u03b5\u03c2 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b5\u03c2 \u03c4\u03b7\u03c2 \u039b\u03ad\u03c3\u03b2\u03bf\u03c5, \u03bc\u03b5 \u03c0\u03bb\u03ac\u03c4\u03bf\u03c2, \u03c4\u03b1\u03b2\u03ad\u03c1\u03bd\u03b5\u03c2 \u03ba\u03b1\u03b9 \u03ac\u03bd\u03b5\u03c4\u03bf \u03bf\u03b9\u03ba\u03bf\u03b3\u03b5\u03bd\u03b5\u03b9\u03b1\u03ba\u03cc \u03bc\u03c0\u03ac\u03bd\u03b9\u03bf \u03c3\u03c4\u03b7 \u03bd\u03cc\u03c4\u03b9\u03b1 \u03b1\u03ba\u03c4\u03ae.'
        },
        [normalizeBeachLookup('\u039c\u03cc\u03bb\u03c5\u03b2\u03bf\u03c2')]: {
            en: 'A north-Lesvos beach below the castle town of Molyvos, combining a swim with one of the island\'s strongest views.',
            gr: '\u0392\u03cc\u03c1\u03b5\u03b9\u03b1 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03ba\u03ac\u03c4\u03c9 \u03b1\u03c0\u03cc \u03c4\u03bf\u03bd \u03ba\u03b1\u03c3\u03c4\u03c1\u03cc\u03c0\u03c5\u03c1\u03b3\u03bf \u03c4\u03bf\u03c5 \u039c\u03bf\u03bb\u03cd\u03b2\u03bf\u03c5, \u03c0\u03bf\u03c5 \u03c3\u03c5\u03bd\u03b4\u03c5\u03ac\u03b6\u03b5\u03b9 \u03b2\u03bf\u03c5\u03c4\u03b9\u03ac \u03bc\u03b5 \u03bc\u03af\u03b1 \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03b4\u03c5\u03bd\u03b1\u03c4\u03cc\u03c4\u03b5\u03c1\u03b5\u03c2 \u03b8\u03ad\u03b5\u03c2 \u03c4\u03b7\u03c2 \u039b\u03ad\u03c3\u03b2\u03bf\u03c5.'
        },
        [normalizeBeachLookup('\u03a4\u03c3\u03b1\u03bc\u03b1\u03b4\u03bf\u03cd')]: {
            en: 'A north-Samos beach with clear water, pebbles and a lively organized section near Kokkari.',
            gr: '\u0392\u03cc\u03c1\u03b5\u03b9\u03b1 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03b7\u03c2 \u03a3\u03ac\u03bc\u03bf\u03c5 \u03bc\u03b5 \u03ba\u03b1\u03b8\u03b1\u03c1\u03ac \u03bd\u03b5\u03c1\u03ac, \u03b2\u03cc\u03c4\u03c3\u03b1\u03bb\u03bf \u03ba\u03b1\u03b9 \u03b6\u03c9\u03bd\u03c4\u03b1\u03bd\u03cc \u03bf\u03c1\u03b3\u03b1\u03bd\u03c9\u03bc\u03ad\u03bd\u03bf \u03ba\u03bf\u03bc\u03bc\u03ac\u03c4\u03b9 \u03ba\u03bf\u03bd\u03c4\u03ac \u03c3\u03c4\u03bf \u039a\u03bf\u03ba\u03ba\u03ac\u03c1\u03b9.'
        },
        [normalizeBeachLookup('\u039c\u03b5\u03b3\u03ac\u03bb\u03bf \u03a3\u03b5\u03ca\u03c4\u03ac\u03bd\u03b9')]: {
            en: 'A wild west-Samos beach reached on foot or by boat, known for its protected natural setting.',
            gr: '\u0386\u03b3\u03c1\u03b9\u03b1 \u03b4\u03c5\u03c4\u03b9\u03ba\u03ae \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03b7\u03c2 \u03a3\u03ac\u03bc\u03bf\u03c5 \u03bc\u03b5 \u03c0\u03c1\u03cc\u03c3\u03b2\u03b1\u03c3\u03b7 \u03bc\u03b5 \u03c0\u03b5\u03b6\u03bf\u03c0\u03bf\u03c1\u03af\u03b1 \u03ae \u03ba\u03b1\u03ca\u03ba\u03b9, \u03b3\u03bd\u03c9\u03c3\u03c4\u03ae \u03b3\u03b9\u03b1 \u03c4\u03bf \u03c0\u03c1\u03bf\u03c3\u03c4\u03b1\u03c4\u03b5\u03c5\u03bc\u03ad\u03bd\u03bf \u03c6\u03c5\u03c3\u03b9\u03ba\u03cc \u03c4\u03bf\u03c0\u03af\u03bf.'
        }
    };

    const exact = notable[normalizedName];
    if (exact) return makeLocalizedBeachText(exact.en, exact.gr);

    const areaLabel = NORTH_AEGEAN_AREA_LABELS[areaKey];
    const beachLabel = name.replace(/^Παραλία\s+/i, '').replace(/^παραλία\s+/i, '').trim();
    const variants = [
        {
            en: `${beachLabel} is a North Aegean beach on ${areaLabel.en}, useful for a straightforward swim with local island character.`,
            gr: `\u0397 ${beachLabel} \u03b5\u03af\u03bd\u03b1\u03b9 \u03c0\u03b1\u03c1\u03b1\u03bb\u03af\u03b1 \u03c4\u03bf\u03c5 \u0392\u03bf\u03c1\u03b5\u03af\u03bf\u03c5 \u0391\u03b9\u03b3\u03b1\u03af\u03bf\u03c5 \u03c3\u03c4\u03b7\u03bd ${areaLabel.gr}, \u03ba\u03b1\u03bb\u03ae \u03b3\u03b9\u03b1 \u03b1\u03c0\u03bb\u03ae \u03b2\u03bf\u03c5\u03c4\u03b9\u03ac \u03bc\u03b5 \u03c4\u03bf\u03c0\u03b9\u03ba\u03cc \u03bd\u03b7\u03c3\u03b9\u03ce\u03c4\u03b9\u03ba\u03bf \u03c7\u03b1\u03c1\u03b1\u03ba\u03c4\u03ae\u03c1\u03b1.`
        },
        {
            en: `${beachLabel} gives ${areaLabel.en} a quieter coastal stop, away from the best-known resort beaches.`,
            gr: `\u0397 ${beachLabel} \u03b4\u03af\u03bd\u03b5\u03b9 \u03c3\u03c4\u03b7\u03bd ${areaLabel.gr} \u03bc\u03b9\u03b1 \u03c0\u03b9\u03bf \u03ae\u03c3\u03c5\u03c7\u03b7 \u03c0\u03b1\u03c1\u03b1\u03bb\u03b9\u03b1\u03ba\u03ae \u03c3\u03c4\u03ac\u03c3\u03b7, \u03bc\u03b1\u03ba\u03c1\u03b9\u03ac \u03b1\u03c0\u03cc \u03c4\u03b9\u03c2 \u03c0\u03b9\u03bf \u03b3\u03bd\u03c9\u03c3\u03c4\u03ad\u03c2 \u03bf\u03c1\u03b3\u03b1\u03bd\u03c9\u03bc\u03ad\u03bd\u03b5\u03c2 \u03b1\u03ba\u03c4\u03ad\u03c2.`
        },
        {
            en: `${beachLabel} works as a simple island-coast detour while exploring the beaches of ${areaLabel.en}.`,
            gr: `\u0397 ${beachLabel} \u03bb\u03b5\u03b9\u03c4\u03bf\u03c5\u03c1\u03b3\u03b5\u03af \u03c3\u03b1\u03bd \u03b1\u03c0\u03bb\u03ae \u03bd\u03b7\u03c3\u03b9\u03ce\u03c4\u03b9\u03ba\u03b7 \u03c0\u03b1\u03c1\u03ac\u03ba\u03b1\u03bc\u03c8\u03b7 \u03cc\u03c4\u03b1\u03bd \u03b5\u03be\u03b5\u03c1\u03b5\u03c5\u03bd\u03ac\u03c2 \u03c4\u03b9\u03c2 \u03b1\u03ba\u03c4\u03ad\u03c2 \u03c4\u03b7\u03c2 ${areaLabel.gr}.`
        }
    ];
    const index = Math.abs(normalizedName.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % variants.length;
    return makeLocalizedBeachText(variants[index].en, variants[index].gr);
};

export const generateSmartDescription = (name: string, area: string): { [key in LanguageCode]: string } => {
    const saronicShortDescription = getSaronicShortDescription(name, area);
    if (saronicShortDescription) {
        return saronicShortDescription;
    }

    const curated = findCuratedBeachNarrative(name);
    if (curated) {
        return curated.description;
    }

    const creteDescription = getCreteDescription(name, area);
    if (creteDescription) {
        return creteDescription;
    }

    const ionianShortDescription = getIonianShortDescription(name, area);
    if (ionianShortDescription) {
        return ionianShortDescription;
    }

    const eviaShortDescription = getEviaShortDescription(name, area);
    if (eviaShortDescription) {
        return eviaShortDescription;
    }

    const centralGreeceMainlandDescription = getCentralGreeceMainlandDescription(name, area);
    if (centralGreeceMainlandDescription) {
        return centralGreeceMainlandDescription;
    }

    const macedoniaDescription = getMacedoniaDescription(name, area);
    if (macedoniaDescription) {
        return macedoniaDescription;
    }

    const thraceDescription = getThraceDescription(name, area);
    if (thraceDescription) {
        return thraceDescription;
    }

    const northAegeanDescription = getNorthAegeanDescription(name, area);
    if (northAegeanDescription) {
        return northAegeanDescription;
    }

    const atticaShortDescription = getAtticaShortDescription(name);
    if (atticaShortDescription) {
        return atticaShortDescription;
    }

    // Translate area name for Greek descriptions
    const areaEn = TRANSLATED_REGIONS[area]?.en || TRANSLATED_REGIONS[area.replace(/ \(mainland\)$/, '')]?.en || area;
    const areaGr = TRANSLATED_REGIONS[area]?.gr || TRANSLATED_REGIONS[area.replace(/ \(mainland\)$/, '')]?.gr || area;

    let desc = { en: "", gr: "", fr: "", de: "", it: "" };
    
    // Normalize name for checking
    const cleanName = name.replace(/\(.*\)/, '').trim(); 
    
    // Check if beach is in our famous list
    let found = null;
    for (const key in FAMOUS_DESCRIPTIONS) {
        if (name.toLowerCase().includes(key.toLowerCase()) || cleanName.toLowerCase() === key.toLowerCase()) {
            found = FAMOUS_DESCRIPTIONS[key];
            break;
        }
    }

    if (found) {
        desc = {
            en: found.en,
            gr: found.gr,
            fr: found.en,
            de: found.en,
            it: found.en
        };
    } else {
        // Keyword-based description generation for more specific beaches
        const nameLower = name.toLowerCase();
        let keywordDesc = null;
        
        // Nudist/FKK beaches
        if (nameLower.includes('nudist') || nameLower.includes('nude') || nameLower.includes('fkk') || nameLower.includes('γυμνιστική')) {
            keywordDesc = {
                en: `A peaceful nudist beach in ${areaEn}, offering freedom and natural beauty in a relaxed atmosphere.`,
                gr: `Μια ήρεμη γυμνιστική παραλία στην ${areaGr}, που προσφέρει ελευθερία και φυσική ομορφιά σε χαλαρό περιβάλλον.`
            };
        }
        // Resort/organized beaches
        else if (nameLower.includes('resort') || nameLower.includes('grand') || nameLower.includes('hotel') || nameLower.includes('ξενοδοχείο')) {
            keywordDesc = {
                en: `A luxurious resort beach in ${areaEn} with premium amenities and crystal-clear waters.`,
                gr: `Μια πολυτελής παραλία ξενοδοχείου στην ${areaGr} με ανώτερες ανέσεις και κρυστάλλινα νερά.`
            };
        }
        // Bar/beach bar beaches
        else if (nameLower.includes('bar') || nameLower.includes('beach bar') || nameLower.includes('μπάρα')) {
            keywordDesc = {
                en: `A lively beach in ${areaEn} with beach bars, offering refreshments and a vibrant atmosphere.`,
                gr: `Μια ζωντανή παραλία στην ${areaGr} με beach bars, που προσφέρει αναψυκτικά και ζωηρό κλίμα.`
            };
        }
        // Cave beaches
        else if (nameLower.includes('cave') || nameLower.includes('spel') || nameLower.includes('σπηλιά')) {
            keywordDesc = {
                en: `A unique cave beach in ${areaEn}, featuring natural rock formations and sheltered waters.`,
                gr: `Μια μοναδική παραλία σπηλιάς στην ${areaGr}, με φυσικούς βραχώδεις σχηματισμούς και προστατευμένα νερά.`
            };
        }
        // Rocky/pebbled beaches
        else if (nameLower.includes('rock') || nameLower.includes('pebble') || nameLower.includes('βότσαλο') || nameLower.includes('βράχο')) {
            keywordDesc = {
                en: `A scenic rocky beach in ${areaEn} with clear waters and dramatic coastal landscapes.`,
                gr: `Μια γραφική βραχώδης παραλία στην ${areaGr} με καθαρά νερά και εντυπωσιακά παραθαλάσσια τοπία.`
            };
        }
        // Sandy beaches
        else if (nameLower.includes('sand') || nameLower.includes('άμμο')) {
            keywordDesc = {
                en: `A beautiful sandy beach in ${areaEn} with soft golden sands and inviting shallow waters.`,
                gr: `Μια όμορφη αμμώδης παραλία στην ${areaGr} με μαλακές χρυσές αμμουδιές και ρηχά νερά.`
            };
        }
        // Bay beaches
        else if (nameLower.includes('bay') || nameLower.includes('όρμος') || nameLower.includes('κολπος')) {
            keywordDesc = {
                en: `A picturesque bay beach in ${areaEn}, offering sheltered waters and scenic coastal views.`,
                gr: `Μια γραφική παραλία κόλπου στην ${areaGr}, που προσφέρει προστατευμένα νερά και εντυπωσιακή θέα στην ακτή.`
            };
        }
        // Cove beaches
        else if (nameLower.includes('cove') || nameLower.includes('καλντερίμι') || nameLower.includes('κάλι')) {
            keywordDesc = {
                en: `A charming cove beach in ${areaEn}, providing a secluded and intimate coastal experience.`,
                gr: `Μια γοητευτική παραλία στην ${areaGr}, που προσφέρει απομονωμένη και οικεία παραθαλάσσια εμπειρία.`
            };
        }
        // Lagoon beaches
        else if (nameLower.includes('lagoon') || nameLower.includes('λιμνοθάλασσα')) {
            keywordDesc = {
                en: `A serene lagoon beach in ${areaEn}, featuring calm shallow waters and unique natural formations.`,
                gr: `Μια ήρεμη παραλία λιμνοθάλασσας στην ${areaGr}, με ήρεμα ρηχά νερά και μοναδικούς φυσικούς σχηματισμούς.`
            };
        }
        // Rhodes beaches
        else if (area.toLowerCase().includes('rhodes') || area.toLowerCase().includes('ρόδος')) {
            keywordDesc = {
                en: `A beautiful Rhodes beach with the island's rich history and stunning Mediterranean landscapes.`,
                gr: `Μια όμορφη παραλία της Ρόδου με το πλούσιο ιστορικό παρελθόν του νησιού και εκπληκτικά μεσογειακά τοπία.`
            };
        }
        // Corfu beaches
        else if (area.toLowerCase().includes('kerkyra') || area.toLowerCase().includes('kerkyras') || area.toLowerCase().includes('κέρκυρα')) {
            keywordDesc = {
                en: `A charming Corfu beach showcasing Venetian architecture and lush green landscapes.`,
                gr: `Μια γοητευτική παραλία της Κέρκυρας που παρουσιάζει βενετσιάνικη αρχιτεκτονική και καταπράσινα τοπία.`
            };
        }
        
        if (keywordDesc) {
            desc = {
                en: keywordDesc.en,
                gr: keywordDesc.gr,
                fr: keywordDesc.en,
                de: keywordDesc.en,
                it: keywordDesc.en
            };
        } else {
            // Enhanced fallback for non-famous beaches with more variety
            const descriptions = {
                en: [
                    `A charming beach in the ${areaEn} region, offering crystal-clear waters and a peaceful atmosphere.`,
                    `Discover this hidden gem in ${areaEn} with its pristine sands and Mediterranean charm.`,
                    `A picturesque coastal spot in ${areaEn}, perfect for swimming and sunbathing.`,
                    `Experience the beauty of ${areaEn} at this serene beach with turquoise waters.`,
                    `A tranquil retreat in ${areaEn}, featuring soft sands and gentle waves.`,
                    `This ${areaEn} beach boasts stunning views and inviting shallow waters.`,
                    `A natural paradise in ${areaEn} with golden sands and refreshing sea breezes.`,
                    `Escape to this idyllic ${areaEn} beach, where relaxation meets natural beauty.`
                ],
                gr: [
                    `Μια γοητευτική παραλία στην περιοχή ${areaGr}, με κρυστάλλινα νερά και ήρεμη ατμόσφαιρα.`,
                    `Ανακαλύψτε αυτό το κρυμμένο διαμάντι στην ${areaGr} με τις απαράμιλλες αμμουδιές και τη μεσογειακή γοητεία.`,
                    `Ένα γραφικό παραθαλάσσιο σημείο στην ${areaGr}, ιδανικό για κολύμπι και ηλιοθεραπεία.`,
                    `Ζήστε την ομορφιά της ${areaGr} σε αυτή την ήρεμη παραλία με τιρκουάζ νερά.`,
                    `Ένα ήσυχο καταφύγιο στην ${areaGr}, με μαλακές αμμουδιές και απαλά κύματα.`,
                    `Αυτή η παραλία στην ${areaGr} διαθέτει εκπληκτική θέα και ρηχά νερά.`,
                    `Ένας φυσικός παράδεισος στην ${areaGr} με χρυσές αμμουδιές και δροσιστικές θαλασσινές αύρες.`,
                    `Δραπετεύστε σε αυτή την ειδυλλιακή παραλία στην ${areaGr}, όπου η χαλάρωση συναντά τη φυσική ομορφιά.`
                ]
            };
            
            // Use deterministic selection based on beach name for consistency
            const index = Math.abs(name.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % descriptions.en.length;
            
            desc = {
                en: descriptions.en[index],
                gr: descriptions.gr[index],
                fr: descriptions.en[index], // Use English for other languages for now
                de: descriptions.en[index],
                it: descriptions.en[index]
            };
        }
    }

    return desc;
};

export const getBeachNarrative = (name: string, area: string): {
    description: { [key in LanguageCode]: string };
    detailedDescription?: { [key in LanguageCode]?: string };
    accessNotes?: { [key in LanguageCode]?: string };
} => {
    const saronicShortDescription = getSaronicShortDescription(name, area);
    if (saronicShortDescription) {
        return {
            description: saronicShortDescription
        };
    }

    const dodecaneseDescription = getDodecaneseDescription(name, area);
    if (dodecaneseDescription) {
        return {
            description: dodecaneseDescription
        };
    }

    const sporadesThessalyDescription = getSporadesThessalyDescription(name, area);
    if (sporadesThessalyDescription) {
        return {
            description: sporadesThessalyDescription
        };
    }

    const cycladesDescription = getCycladesDescription(name, area);
    if (cycladesDescription) {
        return {
            description: cycladesDescription
        };
    }

    const curated = findCuratedBeachNarrative(name);

    if (curated) {
        return {
            description: curated.description,
            detailedDescription: curated.detailedDescription,
            accessNotes: curated.accessNotes
        };
    }

    const creteDescription = getCreteDescription(name, area);
    if (creteDescription) {
        return {
            description: creteDescription
        };
    }

    const ionianShortDescription = getIonianShortDescription(name, area);
    if (ionianShortDescription) {
        return {
            description: ionianShortDescription
        };
    }

    const eviaShortDescription = getEviaShortDescription(name, area);
    if (eviaShortDescription) {
        return {
            description: eviaShortDescription
        };
    }

    const peloponneseDescription = getPeloponneseDescription(name, area);
    if (peloponneseDescription) {
        return {
            description: peloponneseDescription
        };
    }

    const centralGreeceMainlandDescription = getCentralGreeceMainlandDescription(name, area);
    if (centralGreeceMainlandDescription) {
        return {
            description: centralGreeceMainlandDescription
        };
    }

    const macedoniaDescription = getMacedoniaDescription(name, area);
    if (macedoniaDescription) {
        return {
            description: macedoniaDescription
        };
    }

    const thraceDescription = getThraceDescription(name, area);
    if (thraceDescription) {
        return {
            description: thraceDescription
        };
    }

    const northAegeanDescription = getNorthAegeanDescription(name, area);
    if (northAegeanDescription) {
        return {
            description: northAegeanDescription
        };
    }

    return {
        description: generateSmartDescription(name, area)
    };
};

// Helper for deterministic values based on ID
export const getDeterministicValue = (id: number | string, seed: string): number => {
    const str = `${id}-${seed}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash % 1000) / 1000;
};

export { transliterateToGreek, determineAccessibility };
