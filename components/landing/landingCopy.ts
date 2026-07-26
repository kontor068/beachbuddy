// Co-located copy for the national landing (shown to first-time / no-region
// visitors). Kept out of the giant translations.ts on purpose, mirroring the
// per-component copy pattern used by BeachSearcherHome's homeCopy and
// LegalFooter.
//
// ALL FIVE LANGUAGES ARE AUTHORED HERE, and the `Record<LanguageCode, …>` type
// is what keeps them that way: adding a field to LandingCopy fails the build
// until every locale has it. It used to be en+gr with getLocalizedCopy falling
// back to English, which meant a visitor who arrived through the localized
// Milos cluster saw the entire app in German and this one page in English.
//
// FORMALITY, matching the rest of the app's copy — do not mix these:
//   de → du    it → tu    fr → vous    en/gr → second person singular
//
// Voice: sober, honest, second-person "εσύ". The landing must lead with our
// difference — we decide for TODAY and we are honest about it — NOT with
// directory size or vibe browsing. Do not add vanity counts here, and never
// claim "live" without actual live data behind it.

import type { LanguageCode } from '../../types';

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
    /** One line under the title that frames the five voices below it. */
    lede: string;
    /**
     * The team, one childhood memory each, and what we do about exactly that.
     *
     * THESE ARE THE PEOPLE WHO BUILD THE SITE — not visitor testimonials. That
     * distinction is the whole licence for this block: presented as reviews from
     * users these would be fabricated social proof, which is the most expensive
     * possible lie to put on the trust section. So: `signature` says "the team",
     * the overline says "who we are", and every name here must be an actual
     * person on the team. Never mark this block up as Review/AggregateRating
     * schema, and never add star ratings, dates or "verified" badges to it.
     *
     * SHAPE: each memory is one distinct way a beach day breaks (a stale
     * recommendation, a photo, the wrong side of the island for that wind, water
     * too deep for a small child, knowledge only a local has) and each `answer`
     * is the one capability that addresses it. Read top to bottom they are a
     * feature tour that never mentions a feature.
     */
    memories: {
      id: string;
      name: string;
      /** Where they know this coast from. Two or three words, not a bio. */
      from: string;
      quote: string;
      /** What CalmBeach does about that day. One or two sentences, no jargon. */
      answer: string;
    }[];
    /** The bridge from the memories to the ask. Kept to one short paragraph. */
    paragraphs: string[];
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

export const landingCopy: Record<LanguageCode, LandingCopy> = {
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
    // stop), this one is the people behind it.
    //
    // Five short quotes replaced three paragraphs of "we": a remembered scene is
    // read where an About paragraph is skipped, and each one lets the answer next
    // to it be specific instead of a claim about ourselves. Every factual promise
    // still lives here — the coastline geometry, the weekly corrections, the
    // no-paid-ranking line — but attached to the failure it fixes.
    //
    // Do NOT add "the photos on this page are ours" (the hero shots are not the
    // team's own) and do not restore "we have been to plenty of these beaches"
    // (first-party verification currently covers a handful, so «πολλές» would not
    // survive a reader asking for the number). The "no beach pays to rank" line
    // is a PROMISE about result ordering — exposure and wind, nothing else. If
    // paid placement ever enters the ranking, that line comes out first.
    story: {
      overline: 'Ποιοι είμαστε',
      // Plain autobiographical fact, not a slogan — and it earns the quotes below.
      title: 'Μεγαλώσαμε με τη θάλασσα δίπλα μας',
      lede: 'Πέντε άνθρωποι φτιάχνουμε το CalmBeach. Ο καθένας κουβαλάει τη δική του χαλασμένη μέρα στην παραλία — από αυτές βγήκε το site.',
      memories: [
        {
          id: 'nikos',
          name: 'Νίκος',
          from: 'γεννημένος στη Νάξο',
          quote: 'Θυμάμαι τους γονείς μου να τσακώνονται στο αυτοκίνητο. Ο πατέρας μου είχε διαλέξει μια παραλία που ήταν υπέροχη το προηγούμενο καλοκαίρι — φτάσαμε, φύσαγε, και η μέρα είχε χαλάσει πριν καν κατεβούμε.',
          answer: 'Η επιλογή δεν είναι θέμα μνήμης. Για κάθε περιοχή σου λέμε ποιες παραλίες δουλεύουν σήμερα, όχι ποιες ήταν καλές πέρσι.',
        },
        {
          id: 'olga',
          name: 'Όλγα',
          from: 'Θεσσαλονίκη',
          quote: 'Είχα δει τη φωτογραφία: λάδι η θάλασσα, τιρκουάζ. Οδηγήσαμε σαράντα λεπτά και όταν κατέβηκα το κύμα έσκαγε στα βράχια. Η φωτογραφία ήταν αληθινή — απλώς όχι εκείνη τη μέρα.',
          answer: 'Κάθε φωτογραφία είναι μιας άλλης μέρας. Εμείς βάζουμε δίπλα σε κάθε παραλία τον άνεμο και το κύμα της σημερινής.',
        },
        {
          id: 'petros',
          name: 'Πέτρος',
          from: 'Πήλιο',
          quote: 'Θυμάμαι τη μητέρα μου να κρατάει την ομπρέλα με τα δύο χέρια και την άμμο να μπαίνει στα σάντουιτς. Δεν ήταν κακή παραλία. Ήταν η λάθος πλευρά του νησιού για εκείνον τον αέρα.',
          answer: 'Αυτό είναι γεωμετρία, όχι τύχη. Ξέρουμε ποια ακτή είναι εκτεθειμένη στον βοριά και ποια προστατεύεται — και σου δείχνουμε την υπήνεμη.',
        },
        {
          id: 'erato',
          name: 'Ερατώ',
          from: 'Λέσβος',
          quote: 'Η μικρή μου αδερφή ήταν πέντε χρονών και τα νερά βάθαιναν απότομα, με κύμα από πάνω. Κολυμπούσαμε με τη σειρά, για να την κρατάει πάντα κάποιος. Κανείς δεν μας είχε πει ότι εκείνη η παραλία δεν ήταν για παιδιά.',
          answer: 'Ρηχά νερά, κλειστός κόλπος, ήσυχη ακτή: το ξέρεις πριν φύγεις από το σπίτι, ως φίλτρο — όχι ως υπόσχεση.',
        },
        {
          id: 'miltos',
          name: 'Μίλτος',
          from: 'πέντε νησιά, πέντε σχολεία',
          quote: 'Μεγάλωσα αλλάζοντας νησιά, λόγω της δουλειάς των γονιών μου. Σε κάθε ένα υπήρχε πάντα ένας ντόπιος που ήξερε: «σήμερα όχι εκεί, φυσάει — πήγαινε από την άλλη μεριά». Αυτό δεν γράφεται σε κανέναν οδηγό.',
          answer: 'Γι’ αυτό χαρτογραφήσαμε το σχήμα κάθε ακτής της Ελλάδας. Και καμία παραλία δεν πληρώνει για να βγει ψηλότερα: η σειρά βγαίνει από τον άνεμο και το σχήμα της ακτής, από τίποτε άλλο.',
        },
      ],
      paragraphs: [
        'Κάθε βδομάδα μετακινούμε σημεία στον χάρτη, βγάζουμε ξαπλώστρες και καντίνες που δεν υπάρχουν πια, προσθέτουμε παραλίες που λείπουν. Εκεί χρειαζόμαστε εσένα: την παραλία σου την ξέρεις καλύτερα από κάθε δορυφόρο.',
      ],
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
      lede: 'Five people build CalmBeach. Each of us carries their own ruined day at the beach — this site came out of those.',
      memories: [
        {
          id: 'nikos',
          name: 'Nikos',
          from: 'born on Naxos',
          quote: 'I remember my parents arguing in the car. My father had picked a beach that was wonderful the summer before — we arrived, it was blowing, and the day was ruined before we were out of the car.',
          answer: 'Picking a beach should not be a memory test. For every region we tell you which ones work today, not which ones were good last year.',
        },
        {
          id: 'olga',
          name: 'Olga',
          from: 'Thessaloniki',
          quote: 'I had seen the photo: flat, turquoise water. We drove forty minutes, and when I got out the waves were breaking on the rocks. The photo was real — just not that day.',
          answer: 'Every photo is from some other day. We put today’s wind and waves next to each beach instead.',
        },
        {
          id: 'petros',
          name: 'Petros',
          from: 'Pelion',
          quote: 'I remember my mother holding the umbrella down with both hands, and sand getting into the sandwiches. It was not a bad beach. It was the wrong side of the island for that wind.',
          answer: 'That is geometry, not luck. We know which shore is exposed to a north wind and which one is sheltered — and we point you to the sheltered one.',
        },
        {
          id: 'erato',
          name: 'Erato',
          from: 'Lesvos',
          quote: 'My little sister was five, and the bottom dropped away steeply with waves on top of it. We swam in shifts so someone could always hold her. Nobody had told us that beach was not for children.',
          answer: 'Shallow water, an enclosed bay, a quiet shore: you know before you leave the house, as a filter — not as a promise.',
        },
        {
          id: 'miltos',
          name: 'Miltos',
          from: 'five islands, five schools',
          quote: 'I grew up moving from island to island because of my parents’ work. On every one there was a local who knew: “not there today, it’s blowing — go round the other side.” That is in no guidebook.',
          answer: 'So we mapped the shape of every shore in Greece. And no beach pays to rank higher: the order comes from the wind and the shape of the coast, nothing else.',
        },
      ],
      paragraphs: [
        'Every week we move pins on the map, delete sunbeds and canteens that are gone, add beaches that were missing. That is where we need you: you know your beach better than any satellite.',
      ],
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
  de: {
    hero: {
      kicker: 'Bevor du das Handtuch einpackst',
      title: 'Welcher Strand in Griechenland passt heute zu dir?',
      titleAccent: 'in Griechenland',
      subtitle: 'Ruhe fängt nicht am Strand an. Sie fängt in dem Moment an, in dem du weißt, welcher der richtige ist.',
      searchPlaceholder: 'Strand oder Region suchen…',
      searchAria: 'Strand oder Region suchen',
      clearSearchAria: 'Suche löschen',
      searchRegionLabel: 'Region',
      searchBeachLabel: 'Strand',
      searchLoading: 'Suche Strände…',
      searchNoResults: 'Kein passendes Ergebnis. Drücke Enter, um zu suchen.',
      nearMe: 'In meiner Nähe',
      findingLocation: 'Standort wird ermittelt…',
    },
    today: {
      title: 'Die Regionen heute',
      subtitle: 'Wie stark es gerade in jedem griechischen Meer weht. Tippe auf eine Region, um sie Strand für Strand zu sehen.',
      live: 'Live',
      seaPhrase: (bft) =>
        bft <= 2 ? 'gerade ruhig'
        : bft === 3 ? 'leichte Kräuselung bei 3 Beaufort'
        : bft === 4 ? 'kabbelig bei 4 Beaufort'
        : bft === 5 ? 'Wellen bei 5 Beaufort'
        : `stürmisch, ${bft} Beaufort`,
      chipAria: (region, phrase) => `${region}: ${phrase}`,
      note: 'Eine Schätzung für die offene See — die geschützten Küsten jeder Region sind ruhiger.',
      cta: 'Finde einen geschützten Strand in deiner Nähe',
      ctaPending: 'Ich ermittle deinen Standort…',
      allRegions: 'oder alle Regionen ansehen',
    },
    manifesto: {
      overline: 'Was „ruhig“ hier bedeutet',
      quote:
        '„Ruhig“ bedeutet nicht für alle dasselbe. Der eine will eine Liege, flaches Wasser und eine Dusche; der andere einen Streifen Sand, an dem niemand ist. Deshalb schauen wir auf beides: was der Strand hat, und was das Meer heute macht.',
      points: [
        {
          title: 'Was der Strand hat',
          body: 'Liegen, Duschen, Schatten, Essen, Parkplatz, flaches Wasser, Zugang. Das ändert sich nicht — das wissen wir vorher.',
        },
        {
          title: 'Was das Meer heute macht',
          body: 'Wind und Wellen stündlich, gelesen durch die Form jeder Küste. Deshalb ist ein berühmter Strand nicht automatisch der bessere.',
        },
        {
          title: 'Was wir (noch) nicht wissen',
          body: 'Strömungen, den Grund, lokale Böen. Wir zeigen eine Vorhersage, keine Messung — deshalb geben wir eine Wellenspanne an. Achte vor Ort auf die Flaggen und den Rettungsschwimmer.',
        },
      ],
      more: 'Wie CalmBeach funktioniert',
    },
    story: {
      overline: 'Wer wir sind',
      title: 'Wir sind mit dem Meer vor der Tür aufgewachsen',
      lede: 'Fünf Menschen bauen CalmBeach. Jeder von uns trägt seinen eigenen verdorbenen Strandtag mit sich — aus denen ist diese Seite entstanden.',
      memories: [
        {
          id: 'nikos',
          name: 'Nikos',
          from: 'auf Naxos geboren',
          quote: 'Ich erinnere mich, wie meine Eltern im Auto stritten. Mein Vater hatte einen Strand ausgesucht, der im Sommer davor herrlich gewesen war — wir kamen an, es wehte, und der Tag war hin, bevor wir ausgestiegen waren.',
          answer: 'Einen Strand auszusuchen sollte keine Gedächtnisübung sein. Für jede Region sagen wir dir, welche heute funktionieren — nicht, welche letztes Jahr gut waren.',
        },
        {
          id: 'olga',
          name: 'Olga',
          from: 'Thessaloniki',
          quote: 'Ich hatte das Foto gesehen: spiegelglattes, türkises Wasser. Wir fuhren vierzig Minuten, und als ich ausstieg, brachen die Wellen an den Felsen. Das Foto war echt — nur nicht an diesem Tag.',
          answer: 'Jedes Foto ist von einem anderen Tag. Wir stellen stattdessen den Wind und die Wellen von heute neben jeden Strand.',
        },
        {
          id: 'petros',
          name: 'Petros',
          from: 'Pilion',
          quote: 'Ich sehe noch meine Mutter, wie sie den Sonnenschirm mit beiden Händen festhält, und den Sand in den Sandwiches. Es war kein schlechter Strand. Es war die falsche Seite der Insel für diesen Wind.',
          answer: 'Das ist Geometrie, kein Glück. Wir wissen, welche Küste dem Nordwind ausgesetzt ist und welche geschützt liegt — und zeigen dir die geschützte.',
        },
        {
          id: 'erato',
          name: 'Erato',
          from: 'Lesbos',
          quote: 'Meine kleine Schwester war fünf, und der Grund fiel steil ab, mit Wellen obendrauf. Wir schwammen abwechselnd, damit sie immer jemand halten konnte. Niemand hatte uns gesagt, dass dieser Strand nichts für Kinder ist.',
          answer: 'Flaches Wasser, eine geschlossene Bucht, eine ruhige Küste: Du weißt es, bevor du das Haus verlässt — als Filter, nicht als Versprechen.',
        },
        {
          id: 'miltos',
          name: 'Miltos',
          from: 'fünf Inseln, fünf Schulen',
          quote: 'Ich bin von Insel zu Insel gezogen, wegen der Arbeit meiner Eltern. Auf jeder gab es einen Einheimischen, der es wusste: „heute nicht dorthin, es weht — fahr auf die andere Seite.“ Das steht in keinem Reiseführer.',
          answer: 'Deshalb haben wir die Form jeder Küste Griechenlands kartiert. Und kein Strand zahlt für eine bessere Platzierung: die Reihenfolge ergibt sich aus dem Wind und der Form der Küste, aus nichts anderem.',
        },
      ],
      paragraphs: [
        'Jede Woche verschieben wir Punkte auf der Karte, löschen Liegen und Kantinen, die es nicht mehr gibt, und ergänzen fehlende Strände. Genau da brauchen wir dich: Du kennst deinen Strand besser als jeder Satellit.',
      ],
      signature: 'Das CalmBeach-Team',
      askTitle: 'Weißt du etwas, das wir nicht wissen?',
      askHint: 'Zwei Zeilen genügen.',
      askPrompts: [
        { id: 'missing', label: 'Ein Strand fehlt', seed: 'Ein Strand fehlt: ' },
        { id: 'outdated', label: 'Etwas stimmt nicht mehr', seed: 'Etwas stimmt nicht mehr: ' },
        { id: 'local', label: 'Etwas, das keine Karte zeigt', seed: 'Etwas, das keine Karte zeigt: ' },
      ],
      formPlaceholder: 'z. B. „in Limnionas gibt es keine Liegen mehr“ oder „am Nachmittag erwischt dich der Wind am rechten Ende“.',
      formEmailLabel: 'E-Mail — nur wenn du eine Antwort möchtest',
      formEmailPlaceholder: 'du@email.de',
      formSending: 'Senden…',
      formSuccess: 'Angekommen — danke. Wir lesen jede einzelne.',
      formError: 'Etwas ist schiefgelaufen. Schick es uns besser hierhin:',
      askCta: 'Schick es uns',
      mailSubject: 'Korrektur oder Vorschlag für CalmBeach',
      mailFallback: 'oder schreib uns direkt',
    },
  },
  fr: {
    hero: {
      kicker: 'Avant de prendre votre serviette',
      title: 'Quelle plage de Grèce vous convient aujourd’hui ?',
      titleAccent: 'de Grèce',
      subtitle: 'Le calme ne commence pas sur la plage. Il commence au moment où vous savez laquelle choisir.',
      searchPlaceholder: 'Chercher une plage ou une région…',
      searchAria: 'Chercher une plage ou une région',
      clearSearchAria: 'Effacer la recherche',
      searchRegionLabel: 'Région',
      searchBeachLabel: 'Plage',
      searchLoading: 'Recherche des plages…',
      searchNoResults: 'Aucun résultat proche. Appuyez sur Entrée pour lancer la recherche.',
      nearMe: 'Près de moi',
      findingLocation: 'Localisation en cours…',
    },
    today: {
      title: 'Les régions aujourd’hui',
      subtitle: 'La force du vent en ce moment, dans chaque mer grecque. Touchez une région pour la voir plage par plage.',
      live: 'En direct',
      seaPhrase: (bft) =>
        bft <= 2 ? 'calme en ce moment'
        : bft === 3 ? 'légère ride à 3 Beaufort'
        : bft === 4 ? 'clapot à 4 Beaufort'
        : bft === 5 ? 'vagues à 5 Beaufort'
        : `mer forte, ${bft} Beaufort`,
      chipAria: (region, phrase) => `${region} : ${phrase}`,
      note: 'Estimation en mer ouverte — les côtes abritées de chaque région sont plus calmes.',
      cta: 'Trouver une plage abritée près de vous',
      ctaPending: 'Localisation en cours…',
      allRegions: 'ou voir toutes les régions',
    },
    manifesto: {
      overline: 'Ce que « calme » veut dire ici',
      quote:
        '« Calme » ne veut pas dire la même chose pour tout le monde. L’un veut un transat, de l’eau peu profonde et une douche ; l’autre une étendue de sable où il n’y a personne. Nous regardons donc les deux : ce que la plage offre, et ce que la mer fait aujourd’hui.',
      points: [
        {
          title: 'Ce que la plage offre',
          body: 'Transats, douches, ombre, restauration, parking, eau peu profonde, accès. Cela ne change pas — nous le savons à l’avance.',
        },
        {
          title: 'Ce que la mer fait aujourd’hui',
          body: 'Le vent et les vagues heure par heure, lus à travers la forme de chaque côte. C’est pourquoi une plage célèbre n’est pas automatiquement la meilleure.',
        },
        {
          title: 'Ce que nous ne savons pas (encore)',
          body: 'Les courants, le fond, les rafales locales. Nous montrons une prévision, pas une mesure — d’où la fourchette de hauteur de vagues. Sur place, regardez les drapeaux et le maître-nageur.',
        },
      ],
      more: 'Comment fonctionne CalmBeach',
    },
    story: {
      overline: 'Qui nous sommes',
      title: 'Nous avons grandi avec la mer à côté',
      lede: 'Nous sommes cinq à faire CalmBeach. Chacun porte sa propre journée de plage gâchée — ce site est né de celles-là.',
      memories: [
        {
          id: 'nikos',
          name: 'Nikos',
          from: 'né à Naxos',
          quote: 'Je me souviens de mes parents en train de se disputer dans la voiture. Mon père avait choisi une plage qui était magnifique l’été d’avant — nous sommes arrivés, il ventait, et la journée était fichue avant même que nous soyons sortis de la voiture.',
          answer: 'Choisir une plage ne devrait pas être un exercice de mémoire. Pour chaque région, nous vous disons lesquelles marchent aujourd’hui — pas lesquelles étaient bien l’an dernier.',
        },
        {
          id: 'olga',
          name: 'Olga',
          from: 'Thessalonique',
          quote: 'J’avais vu la photo : une eau lisse, turquoise. Nous avons roulé quarante minutes, et en sortant de la voiture les vagues cassaient sur les rochers. La photo était vraie — simplement pas ce jour-là.',
          answer: 'Chaque photo vient d’un autre jour. Nous mettons à la place le vent et les vagues du jour à côté de chaque plage.',
        },
        {
          id: 'petros',
          name: 'Petros',
          from: 'Pélion',
          quote: 'Je revois ma mère tenir le parasol à deux mains, et le sable dans les sandwichs. Ce n’était pas une mauvaise plage. C’était le mauvais côté de l’île pour ce vent-là.',
          answer: 'C’est de la géométrie, pas de la chance. Nous savons quelle côte est exposée au vent du nord et laquelle est abritée — et nous vous indiquons celle qui est abritée.',
        },
        {
          id: 'erato',
          name: 'Erato',
          from: 'Lesbos',
          quote: 'Ma petite sœur avait cinq ans, et le fond descendait d’un coup, avec des vagues par-dessus. Nous nous baignions à tour de rôle pour que quelqu’un la tienne toujours. Personne ne nous avait dit que cette plage n’était pas pour les enfants.',
          answer: 'Eau peu profonde, baie fermée, côte tranquille : vous le savez avant de partir, comme un filtre — pas comme une promesse.',
        },
        {
          id: 'miltos',
          name: 'Miltos',
          from: 'cinq îles, cinq écoles',
          quote: 'J’ai grandi en changeant d’île, à cause du travail de mes parents. Sur chacune, il y avait un habitant qui savait : « pas là aujourd’hui, il vente — passez de l’autre côté ». Cela n’est écrit dans aucun guide.',
          answer: 'C’est pour cela que nous avons cartographié la forme de chaque côte de Grèce. Et aucune plage ne paie pour être mieux classée : l’ordre vient du vent et de la forme de la côte, de rien d’autre.',
        },
      ],
      paragraphs: [
        'Chaque semaine, nous déplaçons des points sur la carte, nous retirons les transats et les cantines qui n’existent plus, nous ajoutons les plages qui manquaient. C’est là que nous avons besoin de vous : vous connaissez votre plage mieux que n’importe quel satellite.',
      ],
      signature: 'L’équipe CalmBeach',
      askTitle: 'Vous savez quelque chose que nous ignorons ?',
      askHint: 'Deux lignes suffisent.',
      askPrompts: [
        { id: 'missing', label: 'Une plage manque', seed: 'Une plage manque : ' },
        { id: 'outdated', label: 'Quelque chose n’est plus à jour', seed: 'Quelque chose n’est plus à jour : ' },
        { id: 'local', label: 'Quelque chose qu’aucune carte ne montre', seed: 'Quelque chose qu’aucune carte ne montre : ' },
      ],
      formPlaceholder: 'ex. « il n’y a plus de transats à Limnionas » ou « l’après-midi, le vent prend le bout droit de la plage ».',
      formEmailLabel: 'E-mail — seulement si vous voulez une réponse',
      formEmailPlaceholder: 'vous@email.fr',
      formSending: 'Envoi…',
      formSuccess: 'Bien reçu — merci. Nous lisons tout, un par un.',
      formError: 'Quelque chose n’a pas fonctionné. Envoyez-le nous plutôt ici :',
      askCta: 'Envoyer',
      mailSubject: 'Correction ou suggestion pour CalmBeach',
      mailFallback: 'ou écrivez-nous directement',
    },
  },
  it: {
    hero: {
      kicker: 'Prima di prendere l’asciugamano',
      title: 'Quale spiaggia della Grecia fa per te oggi?',
      titleAccent: 'della Grecia',
      subtitle: 'La calma non inizia in spiaggia. Inizia nel momento in cui sai quale scegliere.',
      searchPlaceholder: 'Cerca una spiaggia o una regione…',
      searchAria: 'Cerca una spiaggia o una regione',
      clearSearchAria: 'Cancella la ricerca',
      searchRegionLabel: 'Regione',
      searchBeachLabel: 'Spiaggia',
      searchLoading: 'Cerco spiagge…',
      searchNoResults: 'Nessun risultato simile. Premi Invio per cercare.',
      nearMe: 'Vicino a me',
      findingLocation: 'Individuo la posizione…',
    },
    today: {
      title: 'Le regioni oggi',
      subtitle: 'Quanto soffia adesso in ogni mare greco. Tocca una regione per vederla spiaggia per spiaggia.',
      live: 'In diretta',
      // Italian has its own official sea-state ladder (calmo / poco mosso / mosso
      // / molto mosso / agitato) — use it rather than translating the English.
      seaPhrase: (bft) =>
        bft <= 2 ? 'calmo adesso'
        : bft === 3 ? 'poco mosso, 3 Beaufort'
        : bft === 4 ? 'mosso, 4 Beaufort'
        : bft === 5 ? 'molto mosso, 5 Beaufort'
        : `agitato, ${bft} Beaufort`,
      chipAria: (region, phrase) => `${region}: ${phrase}`,
      note: 'Stima al largo — le coste riparate di ogni regione sono più calme.',
      cta: 'Trova una spiaggia riparata vicino a te',
      ctaPending: 'Sto individuando dove sei…',
      allRegions: 'oppure vedi tutte le regioni',
    },
    manifesto: {
      overline: 'Cosa significa «calmo» qui',
      quote:
        '«Calmo» non significa la stessa cosa per tutti. Uno vuole un lettino, acqua bassa e una doccia; un altro una distesa di sabbia dove non c’è nessuno. Per questo guardiamo entrambe le cose: cosa offre la spiaggia, e cosa fa il mare oggi.',
      points: [
        {
          title: 'Cosa offre la spiaggia',
          body: 'Lettini, docce, ombra, cibo, parcheggio, acqua bassa, accesso. Questo non cambia — lo sappiamo in anticipo.',
        },
        {
          title: 'Cosa fa il mare oggi',
          body: 'Vento e onde ora per ora, letti attraverso la forma di ogni costa. Per questo una spiaggia famosa non è automaticamente la migliore.',
        },
        {
          title: 'Cosa non sappiamo (ancora)',
          body: 'Le correnti, il fondale, le raffiche locali. Mostriamo una previsione, non una misura — per questo diamo un intervallo di altezza delle onde. Sul posto, guarda le bandiere e il bagnino.',
        },
      ],
      more: 'Come funziona CalmBeach',
    },
    story: {
      overline: 'Chi siamo',
      title: 'Siamo cresciuti con il mare accanto',
      lede: 'Siamo cinque persone e facciamo CalmBeach. Ognuno si porta dietro la sua giornata di mare rovinata — da quelle è nato questo sito.',
      memories: [
        {
          id: 'nikos',
          name: 'Nikos',
          from: 'nato a Naxos',
          quote: 'Ricordo i miei genitori litigare in macchina. Mio padre aveva scelto una spiaggia che l’estate prima era meravigliosa — siamo arrivati, tirava vento, e la giornata era rovinata prima ancora che scendessimo.',
          answer: 'Scegliere una spiaggia non dovrebbe essere un esercizio di memoria. Per ogni regione ti diciamo quali funzionano oggi — non quali andavano bene l’anno scorso.',
        },
        {
          id: 'olga',
          name: 'Olga',
          from: 'Salonicco',
          quote: 'Avevo visto la foto: acqua liscia, turchese. Abbiamo guidato quaranta minuti e quando sono scesa le onde si rompevano sugli scogli. La foto era vera — solo non di quel giorno.',
          answer: 'Ogni foto è di un altro giorno. Noi accanto a ogni spiaggia mettiamo il vento e le onde di oggi.',
        },
        {
          id: 'petros',
          name: 'Petros',
          from: 'Pelio',
          quote: 'Rivedo mia madre tenere l’ombrellone con due mani, e la sabbia nei panini. Non era una brutta spiaggia. Era il lato sbagliato dell’isola per quel vento.',
          answer: 'È geometria, non fortuna. Sappiamo quale costa è esposta al vento da nord e quale è riparata — e ti indichiamo quella riparata.',
        },
        {
          id: 'erato',
          name: 'Erato',
          from: 'Lesbo',
          quote: 'Mia sorella piccola aveva cinque anni, e il fondo scendeva di colpo, con le onde sopra. Facevamo il bagno a turno perché qualcuno la tenesse sempre. Nessuno ci aveva detto che quella spiaggia non era per bambini.',
          answer: 'Acqua bassa, baia chiusa, costa tranquilla: lo sai prima di uscire di casa, come filtro — non come promessa.',
        },
        {
          id: 'miltos',
          name: 'Miltos',
          from: 'cinque isole, cinque scuole',
          quote: 'Cambiavo isola ogni pochi anni, per il lavoro dei miei genitori. Su ognuna c’era un abitante che sapeva: «oggi non là, tira vento — vai dall’altra parte». Questo non lo scrive nessuna guida.',
          answer: 'Per questo abbiamo mappato la forma di ogni costa della Grecia. E nessuna spiaggia paga per stare più in alto: l’ordine viene dal vento e dalla forma della costa, da nient’altro.',
        },
      ],
      paragraphs: [
        'Ogni settimana spostiamo punti sulla mappa, togliamo lettini e chioschi che non ci sono più, aggiungiamo spiagge che mancavano. È lì che abbiamo bisogno di te: la tua spiaggia la conosci meglio di qualsiasi satellite.',
      ],
      signature: 'Il team di CalmBeach',
      askTitle: 'Sai qualcosa che noi non sappiamo?',
      askHint: 'Bastano due righe.',
      askPrompts: [
        { id: 'missing', label: 'Manca una spiaggia', seed: 'Manca una spiaggia: ' },
        { id: 'outdated', label: 'Qualcosa non è più valido', seed: 'Qualcosa non è più valido: ' },
        { id: 'local', label: 'Qualcosa che nessuna mappa mostra', seed: 'Qualcosa che nessuna mappa mostra: ' },
      ],
      formPlaceholder: 'es. «a Limnionas non ci sono più i lettini» o «nel pomeriggio il vento prende il lato destro».',
      formEmailLabel: 'Email — solo se vuoi una risposta',
      formEmailPlaceholder: 'tu@email.it',
      formSending: 'Invio…',
      formSuccess: 'Ricevuto — grazie. Le leggiamo tutte, una per una.',
      formError: 'Qualcosa è andato storto. Mandacelo meglio qui:',
      askCta: 'Mandacelo',
      mailSubject: 'Correzione o suggerimento per CalmBeach',
      mailFallback: 'oppure scrivici direttamente',
    },
  },
};
