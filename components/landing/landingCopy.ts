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
    /**
     * Full sentence about the sea, not a score. "2 ήρεμα" read as a rating
     * slammed against a number; this says what the water is doing and carries
     * the Beaufort as a qualifier the way a person would say it.
     */
    seaPhrase: (beaufort: number) => string;
    chipAria: (region: string, phrase: string) => string;
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
  story: {
    overline: string;
    title: string;
    /** Short paragraphs — this is a note, not an About page. */
    paragraphs: string[];
    /** Lifted out of paragraph 2 as the column's one visual anchor for skimmers. */
    pullQuote: string;
    signature: string;
    askTitle: string;
    askHint: string;
    /**
     * Tappable chips that PREFILL the box. Concrete prompts beat "tell us what's
     * wrong", and a half-written first line beats an empty textarea — naming the
     * three things worth reporting is most of the conversion.
     */
    askPrompts: { id: string; label: string; seed: string }[];
    formPlaceholder: string;
    formEmailLabel: string;
    formEmailPlaceholder: string;
    formSending: string;
    formSuccess: string;
    /** Shown with the plain address next to it — the send path must never dead-end. */
    formError: string;
    askCta: string;
    /** Prefilled mail subject so replies arrive already sorted. */
    mailSubject: string;
    mailFallback: string;
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
      // Names the cost we actually remove: not the beach, the «πού πάμε σήμερα;».
      // Deliberately does NOT repeat «ταιριάζει» from the title above it, and
      // leaves the enumeration of amenities to the manifesto band further down —
      // the hero's job here is the promise, not the feature list.
      // «σε ποια ΝΑ πας», not «σε ποια πας»: the subjunctive is the decision still
      // being made — it answers the actual «πού να πάμε σήμερα;», where the
      // indicative would describe a choice already settled.
      subtitle: 'Η ηρεμία δεν ξεκινάει στην παραλία. Ξεκινάει τη στιγμή που ξέρεις σε ποια να πας.',
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
      // Not "από το Ιόνιο ως τα Δωδεκάνησα" — the sample also covers Crete, which
      // is south of both, plus three mainland regions.
      subtitle: 'Πόσο φυσάει τώρα σε κάθε πέλαγος. Πάτα μια περιοχή για να τη δεις παραλία-παραλία.',
      live: 'Ζωντανά',
      // «κυματάκι» is the word this codebase already uses for chop (windExposure,
      // CoveConditionsCard), so the landing speaks the same Greek as the app.
      // A calm day needs no number — the number only earns its place once there
      // is something to warn about.
      // «τώρα», never «σήμερα»: this is one instantaneous reading, and on a
      // meltemi day a calm 09:00 becomes 6 Bft by lunchtime.
      seaPhrase: (bft) =>
        bft <= 2 ? 'ήρεμα τώρα'
        : bft === 3 ? 'ήπιο κυματάκι στα 3 μποφόρ'
        : bft === 4 ? 'κυματάκι στα 4 μποφόρ'
        : bft === 5 ? 'κύμα στα 5 μποφόρ'
        : `φουρτούνα, ${bft} μποφόρ`,
      chipAria: (region, phrase) => `${region}: ${phrase}`,
      note: 'Εκτίμηση ανοιχτής θάλασσας — στις προστατευμένες ακτές κάθε περιοχής είναι πιο ήρεμα.',
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
      // Says the claim OUTRIGHT before illustrating it. The previous version led
      // with two dangling noun phrases and only then explained them with «δεν το
      // εννοούν όλοι το ίδιο» — «το» pointing back at a word that lives in the
      // overline, which is a leap the eye does not make. Sentence order now
      // matches spoken Greek: statement → the two pictures → what we do about it.
      // «Άλλος… άλλος…» is how a person actually draws this contrast; repeating
      // «ήρεμα» from the overline costs one word and saves the reader the jump.
      quote:
        'Το «ήρεμα» δεν σημαίνει το ίδιο για όλους. Άλλος θέλει ξαπλώστρα, ρηχά νερά κι ένα ντουζ· άλλος μια αμμουδιά χωρίς κόσμο. Γι’ αυτό κοιτάμε και τα δύο: τι έχει η παραλία, και τι κάνει σήμερα η θάλασσα.',
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
          title: 'Τι δεν ξέρουμε (ακόμα)',
          body: 'Ρεύματα, βυθό, τοπικές ριπές. Δείχνουμε πρόγνωση, όχι μέτρηση — γι’ αυτό δίνουμε εύρος κύματος. Φτάνοντας, κοίτα σημαίες και ναυαγοσώστη.',
        },
      ],
      more: 'Πώς δουλεύει το CalmBeach',
    },
    // The page's one warm, human moment. It lands right after the dark manifesto
    // on purpose: that band is the institutional voice (what we measure, where we
    // stop), this one is the people behind it. Kept to three short paragraphs —
    // on a phone, and 88% of visitors are on one, an About essay is never read.
    //
    // VOICE: "εμείς", but a NAMED, specific we — a small team whose members have
    // different reasons to know this coast, not a corporate plural. The rule that
    // matters is concreteness: "μια ομάδα με αγάπη για τη θάλασσα" is what every
    // site says, while "ο ένας γεννήθηκε σε νησί, ο άλλος άλλαζε νησί κάθε λίγα
    // χρόνια" is a thing only these people can write.
    //
    // Everything asserted here is true of this project: the coastline geometry
    // work, the visited-and-verified beaches, and the weekly data corrections.
    // Do NOT re-add "the photos on this page are ours" — the hero shots are not
    // the team's own, and a false credit on the trust section is the single most
    // expensive line on the page. The "no beach pays to rank" line is a PROMISE
    // about result ordering (exposure + wind, nothing else) — if paid placement
    // ever enters the ranking, this line comes out first.
    story: {
      overline: 'Ποιοι είμαστε',
      // Plain autobiographical fact, not a slogan — and it earns the next line.
      title: 'Μεγαλώσαμε με τη θάλασσα δίπλα μας',
      paragraphs: [
        'Είμαστε μια μικρή ομάδα με ένα κοινό: τη θάλασσα. Ο ένας γεννήθηκε σε νησί και δεν έφυγε ποτέ ουσιαστικά από εκεί. Ο άλλος μεγάλωσε αλλάζοντας νησιά, λόγω της δουλειάς των γονιών του — άλλο σχολείο, άλλο λιμάνι, άλλες παραλίες. Κάπου εκεί μάθαμε αυτό που ξέρει κάθε ντόπιος και δεν γράφεται σε κανέναν οδηγό: ποια παραλία δουλεύει όταν φυσάει, και ποια όχι.',
        'Μας έχει τύχει και ως επισκέπτες: οδηγήσαμε μία ώρα για μια παραλία που είχαμε δει σε φωτογραφία και τη βρήκαμε με κύμα. Γι’ αυτό χαρτογραφούμε το σχήμα της κάθε ακτής — πού χτυπάει ο άνεμος, πού προστατεύει η στεριά — για όλη την Ελλάδα. Πολλές παραλίες τις έχουμε πάει οι ίδιοι.',
        'Κάθε βδομάδα μετακινούμε σημεία στον χάρτη, βγάζουμε ξαπλώστρες και καντίνες που δεν υπάρχουν πια, προσθέτουμε παραλίες που λείπουν. Καμία παραλία δεν πληρώνει για να βγει ψηλότερα — η σειρά βγαίνει από τον άνεμο και το σχήμα της ακτής, από τίποτε άλλο. Εκεί χρειαζόμαστε εσένα: την παραλία σου την ξέρεις καλύτερα από κάθε δορυφόρο.',
      ],
      pullQuote: 'Καμία φωτογραφία δεν σου λέει τι κάνει η θάλασσα σήμερα.',
      signature: 'Η ομάδα του CalmBeach',
      askTitle: 'Ξέρεις κάτι που δεν ξέρουμε;',
      askHint: 'Δυο γραμμές αρκούν.',
      askPrompts: [
        { id: 'missing', label: 'Λείπει μια παραλία', seed: 'Λείπει μια παραλία: ' },
        { id: 'outdated', label: 'Κάτι δεν ισχύει πια', seed: 'Κάτι δεν ισχύει πια: ' },
        { id: 'local', label: 'Κάτι που δεν φαίνεται στον χάρτη', seed: 'Κάτι που δεν φαίνεται στον χάρτη: ' },
      ],
      formPlaceholder: 'π.χ. «Στη Λιμνιώνα έφυγαν οι ξαπλώστρες» ή «το απόγευμα σε πιάνει ο αέρας στη δεξιά άκρη».',
      formEmailLabel: 'Email — μόνο αν θες απάντηση',
      formEmailPlaceholder: 'to@email.sou',
      formSending: 'Στέλνω…',
      formSuccess: 'Το λάβαμε — ευχαριστούμε. Τα διαβάζουμε ένα-ένα.',
      formError: 'Κάτι πήγε στραβά. Στείλ’ το μας καλύτερα εδώ:',
      askCta: 'Στείλ’ το μας',
      mailSubject: 'Διόρθωση ή πρόταση για το CalmBeach',
      mailFallback: 'ή γράψε μας απευθείας',
    },
  },
  en: {
    hero: {
      kicker: 'Before you grab your towel',
      title: 'Which beach in Greece suits you today?',
      titleAccent: 'in Greece',
      subtitle: 'Calm doesn’t start at the beach. It starts the moment you know which one to pick.',
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
      subtitle: 'How hard it is blowing right now, in every Greek sea. Tap a region to see it beach by beach.',
      live: 'Live',
      seaPhrase: (bft) =>
        bft <= 2 ? 'calm right now'
        : bft === 3 ? 'light chop at 3 Beaufort'
        : bft === 4 ? 'choppy at 4 Beaufort'
        : bft === 5 ? 'waves at 5 Beaufort'
        : `rough, ${bft} Beaufort`,
      chipAria: (region, phrase) => `${region}: ${phrase}`,
      note: 'An open-sea estimate — the sheltered shores of each region are calmer.',
      cta: 'Find a sheltered beach near you',
      ctaPending: 'Finding you…',
      allRegions: 'or see all regions',
    },
    manifesto: {
      overline: 'What “calm” means here',
      quote:
        '“Calm” does not mean the same thing to everyone. One person wants a sunbed, shallow water and a shower; another wants a stretch of sand with nobody on it. So we look at both: what the beach has, and what the sea is doing today.',
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
          title: 'What we do not know (yet)',
          body: 'Currents, the seabed, local gusts. We show a forecast, not a measurement — which is why we give a wave range. When you arrive, check the flags and the lifeguard.',
        },
      ],
      more: 'How CalmBeach works',
    },
    story: {
      overline: 'Who we are',
      title: 'We grew up with the sea next door',
      paragraphs: [
        'We are a small team with one thing in common: the sea. One of us was born on an island and never really left it. Another grew up moving from island to island, following a parent’s work — a different school, a different port, different beaches. Somewhere in there we learned the thing every local knows and no guidebook prints: which beach works when the wind is up, and which one does not.',
        'It has caught us out as visitors too: we drove an hour to a beach we had seen in a photo, and found it churning. So we map the shape of every shore — where the wind hits, where the land shelters — across the whole of Greece. Plenty of these beaches we have walked ourselves.',
        'Every week we move pins on the map, delete sunbeds and canteens that are gone, add beaches that were missing. No beach pays to rank higher — the order comes from the wind and the shape of the coast, nothing else. That is where we need you: you know your beach better than any satellite.',
      ],
      pullQuote: 'No photo tells you what the sea is doing today.',
      signature: 'The CalmBeach team',
      askTitle: 'Know something we don’t?',
      askHint: 'Two lines are enough.',
      askPrompts: [
        { id: 'missing', label: 'A beach is missing', seed: 'A beach is missing: ' },
        { id: 'outdated', label: 'Something is out of date', seed: 'Something is out of date: ' },
        { id: 'local', label: 'Something no map shows', seed: 'Something no map shows: ' },
      ],
      formPlaceholder: 'e.g. “the sunbeds at Limnionas are gone” or “the wind hits the right-hand end after 3pm”.',
      formEmailLabel: 'Email — only if you want a reply',
      formEmailPlaceholder: 'you@email.com',
      formSending: 'Sending…',
      formSuccess: 'Got it — thank you. We read every one.',
      formError: 'Something went wrong. Send it to us here instead:',
      askCta: 'Send it to us',
      mailSubject: 'Correction or suggestion for CalmBeach',
      mailFallback: 'or write to us directly',
    },
  },
};
