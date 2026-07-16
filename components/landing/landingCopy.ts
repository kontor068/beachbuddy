// Co-located copy for the national landing (shown to first-time / no-region
// visitors). Kept out of the giant translations.ts on purpose, mirroring the
// per-component copy pattern used by BeachSearcherHome's homeCopy and
// LegalFooter. Greek + English are authored; getLocalizedCopy falls back to
// English for de/fr/it until those are translated.
//
// Voice: sober, honest, second-person "εσύ". The landing must lead with our
// difference — we decide for TODAY and we are honest about it — NOT with
// directory size or vibe browsing. Do not add vanity counts here, and never
// claim "live" without actual live data behind it.

export type LandingCopy = {
  hero: {
    kicker: string;
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    searchAria: string;
    clearSearchAria: string;
    searchRegionLabel: string;
    searchBeachLabel: string;
    searchLoading: string;
    searchNoResults: string;
    nearMe: string;
    findingLocation: string;
    browseHint: string;
  };
  explore: {
    title: string;
    subtitle: string;
    seeAll: string;
    seeAllHint: string;
    beachCount: (count: number) => string;
    photoSoon: string;
    openAria: (name: string) => string;
  };
  seas: {
    title: string;
    subtitle: string;
    live: string;
    loading: string;
    unit: string;
    verdicts: { calm: string; mild: string; fresh: string; strong: string; rough: string };
    areas: { ionian: string; saronic: string; cretan: string; aegean: string; neAegean: string };
    note: string;
    cta: string;
    allRegions: string;
    unavailable: string;
  };
  manifesto: {
    overline: string;
    quote: string;
    points: { title: string; body: string }[];
    more: string;
  };
};

export const landingCopy: Record<'en' | 'gr', LandingCopy> = {
  gr: {
    hero: {
      kicker: 'Πριν πάρεις την πετσέτα',
      title: 'Βρες την ιδανική σου παραλία στην Ελλάδα σήμερα',
      subtitle:
        'Όχι άλλος ένας κατάλογος. Σου δείχνουμε πού έχει ήρεμα νερά σήμερα — τίμια, με βάση τον άνεμο, το κύμα και το σχήμα της κάθε ακτής.',
      searchPlaceholder: 'Αναζήτησε παραλία ή περιοχή…',
      searchAria: 'Αναζήτηση παραλίας ή περιοχής',
      clearSearchAria: 'Καθαρισμός αναζήτησης',
      searchRegionLabel: 'Περιοχή',
      searchBeachLabel: 'Παραλία',
      searchLoading: 'Ψάχνω παραλίες…',
      searchNoResults: 'Δεν βρέθηκε κοντινό αποτέλεσμα. Πάτα Enter για αναζήτηση.',
      nearMe: 'Κοντά μου',
      findingLocation: 'Εύρεση τοποθεσίας…',
      browseHint: 'ή δες τις θάλασσες σήμερα',
    },
    seas: {
      title: 'Οι θάλασσες σήμερα',
      subtitle: 'Ζωντανά, ανά θαλάσσια περιοχή — δες πού φυσάει και πού έχει ήρεμα, πριν διαλέξεις.',
      live: 'Ζωντανά',
      loading: 'Διαβάζω τις σημερινές συνθήκες…',
      unit: 'μποφόρ',
      verdicts: { calm: 'ήρεμα', mild: 'ήπιο', fresh: 'ζωηρό', strong: 'έντονο', rough: 'φουρτούνα' },
      areas: { ionian: 'Ιόνιο', saronic: 'Σαρωνικός', cretan: 'Κρητικό', aegean: 'Αιγαίο', neAegean: 'ΒΑ Αιγαίο' },
      note: 'Εκτίμηση ανοιχτής θάλασσας — στις προστατευμένες ακτές είναι πιο ήρεμα.',
      cta: 'Βρες προστατευμένη παραλία κοντά σου',
      allRegions: 'ή δες όλες τις περιοχές',
      unavailable: 'Οι συνθήκες αλλάζουν κάθε μέρα — γι’ αυτό δεν σου δίνουμε απλώς μια λίστα. Δες τι έχει κοντά σου σήμερα.',
    },
    explore: {
      title: 'Εξερεύνησε ανά περιοχή',
      subtitle: 'Διάλεξε νησί ή περιοχή και δες τις σημερινές συνθήκες, όχι απλώς φωτογραφίες.',
      seeAll: 'Όλες οι περιοχές',
      seeAllHint: 'Χάρτες και συνθήκες για όλη την Ελλάδα',
      beachCount: (count) => `${count} ${count === 1 ? 'παραλία' : 'παραλίες'}`,
      photoSoon: 'Φωτογραφία σύντομα',
      openAria: (name) => `Άνοιγμα περιοχής ${name}`,
    },
    manifesto: {
      overline: 'Γιατί να μας εμπιστευτείς',
      quote:
        'Οι συνθήκες αλλάζουν κάθε μέρα. Γι’ αυτό δεν σου δίνουμε απλώς μια λίστα — σου λέμε πού έχει ήρεμα σήμερα, και πού όχι.',
      points: [
        {
          title: 'Ζωντανή πρόγνωση, τίμια',
          body: 'Πρόγνωση, όχι μέτρηση επί τόπου. Δείχνουμε εύρος κύματος, όχι ένα δήθεν σίγουρο νούμερο.',
        },
        {
          title: 'Το σχήμα της ακτής μετράει',
          body: 'Κοιτάμε πού χτυπάει ο άνεμος και πού προστατεύει η στεριά. Μια διάσημη παραλία δεν βγαίνει αυτόματα «καλύτερη».',
        },
        {
          title: 'Σου λέμε και τι δεν ξέρουμε',
          body: 'Φτάνοντας, έλεγξε πάντα με τα μάτια σου — σημαίες, ρεύματα, ναυαγοσώστη.',
        },
      ],
      more: 'Πώς δουλεύει το CalmBeach',
    },
  },
  en: {
    hero: {
      kicker: 'Before you grab your towel',
      title: 'Find your ideal beach in Greece today',
      subtitle:
        'Not another beach list. We show you where the water is calm today — honestly, from the wind, the waves and the shape of each shore.',
      searchPlaceholder: 'Search a beach or region…',
      searchAria: 'Search a beach or region',
      clearSearchAria: 'Clear search',
      searchRegionLabel: 'Region',
      searchBeachLabel: 'Beach',
      searchLoading: 'Searching beaches…',
      searchNoResults: 'No close match found. Press Enter to search.',
      nearMe: 'Near me',
      findingLocation: 'Finding location…',
      browseHint: 'or see the seas today',
    },
    seas: {
      title: 'The seas today',
      subtitle: 'Live, by sea area — see where it is blowing and where it is calm, before you choose.',
      live: 'Live',
      loading: 'Reading today’s conditions…',
      unit: 'Beaufort',
      verdicts: { calm: 'calm', mild: 'mild', fresh: 'fresh', strong: 'strong', rough: 'rough' },
      areas: { ionian: 'Ionian', saronic: 'Saronic', cretan: 'Cretan', aegean: 'Aegean', neAegean: 'NE Aegean' },
      note: 'Open-sea estimate — sheltered shores are calmer.',
      cta: 'Find a sheltered beach near you',
      allRegions: 'or see all regions',
      unavailable: 'Conditions change every day — that is why we do not just hand you a list. See what is near you today.',
    },
    explore: {
      title: 'Explore by region',
      subtitle: 'Pick an island or region and see today’s conditions, not just photos.',
      seeAll: 'All regions',
      seeAllHint: 'Maps and conditions for all of Greece',
      beachCount: (count) => `${count} ${count === 1 ? 'beach' : 'beaches'}`,
      photoSoon: 'Photo coming soon',
      openAria: (name) => `Open ${name}`,
    },
    manifesto: {
      overline: 'Why trust our read',
      quote:
        'Conditions change every day. That is why we do not just hand you a list — we tell you where it is calm today, and where it is not.',
      points: [
        {
          title: 'A live forecast, shown honestly',
          body: 'A forecast, not an on-the-spot measurement. We show a wave range, not a falsely exact number.',
        },
        {
          title: 'The shape of the shore matters',
          body: 'We look at where the wind hits and where the land shelters. A famous beach is not automatically “best”.',
        },
        {
          title: 'We tell you what we do not know',
          body: 'When you arrive, always check with your own eyes — flags, currents, lifeguards.',
        },
      ],
      more: 'How CalmBeach works',
    },
  },
};
