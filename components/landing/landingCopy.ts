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
    /** Substring of `title` shown in blue. Must appear verbatim in `title`. */
    titleAccent: string;
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
  };
  today: {
    title: string;
    subtitle: string;
    live: string;
    verdicts: { calm: string; mild: string; choppy: string; strong: string; rough: string };
    /** Spoken form for screen readers — the chip itself is compact by design. */
    chipAria: (region: string, beaufort: number, verdict: string) => string;
    note: string;
    cta: string;
    /** Geolocation can take several seconds; the button must say it is working. */
    ctaPending: string;
    allRegions: string;
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
      // The positioning is carried by ENUMERATING real things, not by claiming
      // anything about ourselves: no "not another catalogue" (defines us against
      // rivals the visitor has never heard of), no "honestly" (you show honesty,
      // you don't announce it). Conditions come last on purpose — the amenities
      // say which beach you want, the conditions say whether it works today.
      title: 'Ποια παραλία της Ελλάδας σου ταιριάζει σήμερα;',
      titleAccent: 'Ελλάδας',
      subtitle:
        'Ξαπλώστρες, ρηχά για τα παιδιά, ησυχία, σκιά — μαζί με τον άνεμο και το κύμα της ημέρας.',
      searchPlaceholder: 'Αναζήτησε παραλία ή περιοχή…',
      searchAria: 'Αναζήτηση παραλίας ή περιοχής',
      clearSearchAria: 'Καθαρισμός αναζήτησης',
      searchRegionLabel: 'Περιοχή',
      searchBeachLabel: 'Παραλία',
      searchLoading: 'Ψάχνω παραλίες…',
      searchNoResults: 'Δεν βρέθηκε κοντινό αποτέλεσμα. Πάτα Enter για αναζήτηση.',
      nearMe: 'Κοντά μου',
      findingLocation: 'Εύρεση τοποθεσίας…',
    },
    // Names people actually use, not sea areas: nobody says "let's go to the
    // Cretan Sea". The order is measured demand from our own counter, and the
    // number next to each name is the thing a directory cannot copy.
    today: {
      title: 'Οι περιοχές σήμερα',
      subtitle: 'Πόσο φυσάει τώρα, από το Ιόνιο ως τα Δωδεκάνησα. Πάτα μια περιοχή για να τη δεις παραλία-παραλία.',
      live: 'Ζωντανά',
      // 4 Bft was «ζωηρό» — wrong twice over: it sounds like a compliment, and in
      // this codebase «ζωηρό» already means a lively ATMOSPHERE (beach bars).
      // «Ανήσυχο» is the honest sea word and keeps the ladder all-adjectives.
      verdicts: { calm: 'ήρεμα', mild: 'ήπιο', choppy: 'ανήσυχο', strong: 'έντονο', rough: 'φουρτούνα' },
      chipAria: (region, beaufort, verdict) => `${region}: ${beaufort} μποφόρ, ${verdict}`,
      note: 'Ο αριθμός είναι μποφόρ, εκτίμηση ανοιχτής θάλασσας — στις προστατευμένες ακτές κάθε περιοχής είναι πιο ήρεμα.',
      cta: 'Βρες προστατευμένη παραλία κοντά σου',
      ctaPending: 'Βρίσκω πού είσαι…',
      allRegions: 'ή δες όλες τις περιοχές',
    },
    // "Calm" here is not a sea state — it is whatever makes the day work for THIS
    // person. So the three points are the two halves of that (the place, which is
    // fixed; the day, which is not) plus our limits. No "trust us" heading and no
    // claiming honesty: point 03 demonstrates it instead.
    manifesto: {
      overline: 'Τι σημαίνει «ήρεμα»',
      quote:
        'Για άλλον είναι ξαπλώστρα, ρηχά νερά και ένα ντουζ. Για άλλον μια άδεια αμμουδιά. Κοιτάμε και τα δύο: τι έχει η παραλία, και τι κάνει η θάλασσα σήμερα.',
      points: [
        {
          title: 'Τι έχει η παραλία',
          body: 'Ξαπλώστρες, ντουζ, σκιά, φαγητό, παρκινγκ, ρηχά νερά, πρόσβαση. Αυτά δεν αλλάζουν — τα ξέρουμε από πριν.',
        },
        {
          title: 'Τι κάνει η θάλασσα σήμερα',
          body: 'Άνεμος και κύμα ανά ώρα, περασμένα μέσα από το σχήμα της κάθε ακτής. Γι’ αυτό μια διάσημη παραλία δεν βγαίνει αυτόματα καλύτερη.',
        },
        {
          title: 'Τι δεν ξέρουμε',
          body: 'Ρεύματα, βυθό, τοπικές ριπές. Δείχνουμε πρόγνωση, όχι μέτρηση — γι’ αυτό δίνουμε εύρος κύματος. Φτάνοντας, κοίτα σημαίες και ναυαγοσώστη.',
        },
      ],
      more: 'Πώς δουλεύει το CalmBeach',
    },
  },
  en: {
    hero: {
      kicker: 'Before you grab your towel',
      title: 'Which beach in Greece suits you today?',
      titleAccent: 'in Greece',
      subtitle:
        'Sunbeds, shallow water for the kids, quiet, shade — alongside the day’s wind and waves.',
      searchPlaceholder: 'Search a beach or region…',
      searchAria: 'Search a beach or region',
      clearSearchAria: 'Clear search',
      searchRegionLabel: 'Region',
      searchBeachLabel: 'Beach',
      searchLoading: 'Searching beaches…',
      searchNoResults: 'No close match found. Press Enter to search.',
      nearMe: 'Near me',
      findingLocation: 'Finding location…',
    },
    today: {
      title: 'Regions today',
      subtitle: 'How hard it is blowing right now, from the Ionian to the Dodecanese. Tap a region to see it beach by beach.',
      live: 'Live',
      verdicts: { calm: 'calm', mild: 'mild', choppy: 'choppy', strong: 'strong', rough: 'rough' },
      chipAria: (region, beaufort, verdict) => `${region}: ${beaufort} Beaufort, ${verdict}`,
      note: 'The number is Beaufort, an open-sea estimate — the sheltered shores of each region are calmer.',
      cta: 'Find a sheltered beach near you',
      ctaPending: 'Finding you…',
      allRegions: 'or see all regions',
    },
    manifesto: {
      overline: 'What “calm” means here',
      quote:
        'For one person it is a sunbed, shallow water and a shower. For another, an empty stretch of sand. We look at both: what the beach has, and what the sea is doing today.',
      points: [
        {
          title: 'What the beach has',
          body: 'Sunbeds, showers, shade, food, parking, shallow water, access. These do not change — we know them in advance.',
        },
        {
          title: 'What the sea is doing today',
          body: 'Wind and waves by the hour, read through the shape of each shore. That is why a famous beach is not automatically the better one.',
        },
        {
          title: 'What we do not know',
          body: 'Currents, the seabed, local gusts. We show a forecast, not a measurement — which is why we give a wave range. When you arrive, check the flags and the lifeguard.',
        },
      ],
      more: 'How CalmBeach works',
    },
  },
};
