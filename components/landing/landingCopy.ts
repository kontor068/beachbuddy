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
    title: string;
    /** Substring of `title` shown in blue. Must appear verbatim in `title`. */
    titleAccent: string;
    subtitle: string;
    /**
     * FIRST of the two wordings the idle placeholder alternates between (see
     * `searchPlaceholderAlt`). This one is the plain, always-true promise of the
     * box — a visitor who reads nothing else still knows what to type here.
     */
    searchPlaceholder: string;
    /**
     * SECOND wording, shown ~4s later, then back. The box also understands a
     * whole sentence («Νάξο 5 μέρες»), and nothing else on the page says so:
     * the placeholder vanishes the moment you type, so a single static wording
     * has to choose between teaching the sentence and describing the plain
     * search. Alternating is how it does both. Keep both SHORT — long strings
     * truncate at 375px, where most of the traffic is.
     */
    searchPlaceholderAlt: string;
    searchAria: string;
    clearSearchAria: string;
    searchRegionLabel: string;
    searchBeachLabel: string;
    searchLoading: string;
    searchNoResults: string;
    /** Shown when a stay length was understood but no place was named. */
    searchNeedsPlace: string;
    nearMe: string;
    findingLocation: string;
  };
  today: {
    title: string;
    subtitle: string;
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
    /**
     * The ask, placed here rather than only at the foot of the story: this band
     * has just admitted what we do not know, so inviting a correction is the
     * natural next sentence — and it sits far higher up the page than the form
     * it links to.
     */
    askLink: string;
  };
  /**
   * The community ask: sign in, send us your best beach photos, see them on the
   * beach cards. It is the only section on this page that asks for something
   * instead of giving something, which is why it sits AFTER the manifesto — by
   * then the page has already shown its working and earned the right to ask.
   *
   * The three steps are load-bearing, not decoration: the honest version of this
   * offer includes "a person checks it first", and burying that turns an
   * approval queue into a broken promise the first time a photo does not appear.
   */
  photos: {
    badge: string;
    overline: string;
    title: string;
    /** Substring of `title` shown in blue. Must appear verbatim in `title`. */
    titleAccent: string;
    body: string;
    steps: { title: string; body: string }[];
    /** Signed out — the click starts Google sign-in. */
    cta: string;
    /** Already signed in — the click opens the upload sheet directly. */
    ctaSignedIn: string;
    /** What the account does BESIDES photos, so signing in is worth it either way. */
    note: string;
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

export const landingCopy: Record<LanguageCode, LandingCopy> = {
  gr: {
    hero: {
      // The positioning is carried by ENUMERATING real things, not by claiming
      // anything about ourselves: no "not another catalogue" (defines us against
      // rivals the visitor has never heard of), no "honestly" (you show honesty,
      // you don't announce it). Conditions come last on purpose — the amenities
      // say which beach you want, the conditions say whether it works today.
      title: 'Ποια παραλία της Ελλάδας σου ταιριάζει σήμερα;',
      titleAccent: 'σήμερα',
      // Names the cost we actually remove: not the beach, the «πού πάμε σήμερα;».
      // Deliberately does NOT repeat «ταιριάζει» from the title above it, and
      // leaves the enumeration of amenities to the manifesto band further down —
      // the hero's job here is the promise, not the feature list.
      // «σε ποια ΝΑ πας», not «σε ποια πας»: the subjunctive is the decision still
      // being made — it answers the actual «πού να πάμε σήμερα;», where the
      // indicative would describe a choice already settled.
      subtitle: 'Η ηρεμία δεν ξεκινάει στην παραλία. Ξεκινάει τη στιγμή που ξέρεις σε ποια να πας.',
      searchPlaceholder: 'Αναζήτησε παραλία ή περιοχή…',
      // Keep this short: native input placeholders are one-line only and share
      // mobile width with the submit button.
      searchPlaceholderAlt: 'Πού και πόσες μέρες;',
      // Does NOT rotate: a screen reader must get one stable name for this
      // field, so the aria-label names everything the box accepts at once.
      searchAria: 'Αναζήτηση παραλίας, περιοχής ή διαμονής σε μέρες',
      clearSearchAria: 'Καθαρισμός αναζήτησης',
      searchRegionLabel: 'Περιοχή',
      searchBeachLabel: 'Παραλία',
      // Plural, like the rest of the page: a loader that says «Ψάχνω» is a second
      // narrator nobody introduced.
      searchLoading: 'Ψάχνουμε παραλίες…',
      // «κοντινό αποτέλεσμα» is search-engine language; nobody says it out loud.
      searchNoResults: 'Δεν βρέθηκε κάτι παρόμοιο. Πάτα Enter για αναζήτηση.',
      searchNeedsPlace: 'Πες μου και σε ποιο μέρος.',
      nearMe: 'Κοντά μου',
      findingLocation: 'Εύρεση τοποθεσίας…',
    },
    // Names people actually use, not sea areas: nobody says "let's go to the
    // Cretan Sea". The order is measured demand from our own counter.
    //
    // THE HEADING IS AN INSTRUCTION, NOT A CLAIM (changed 05/08/2026). It used to
    // read «Πού πάει ο κόσμος» / "Where people go", which promises crowd data we do
    // not have and the list cannot survive: a Greek reader sees Patmos and Lemnos
    // but no Crete-as-a-whole, no Santorini, Mykonos, Zakynthos, Kos or Skiathos,
    // and stops believing the line. Worse, it was circular — the order comes from
    // what people search ON THIS SITE, which is a function of what we already rank
    // for, so "where people go" really meant "where our own traffic already is".
    // The subtitle now says whose demand this is («οι επισκέπτες μας»), which is
    // both true and the only version we can defend.
    today: {
      title: 'Διάλεξε περιοχή',
      // Not "από το Ιόνιο ως τα Δωδεκάνησα" — the sample also covers Crete, which
      // is south of both, plus three mainland regions.
      subtitle: 'Οι περιοχές που ζητούν περισσότερο οι επισκέπτες μας. Διάλεξε μία για να δεις όλες τις παραλίες και τις σημερινές συνθήκες.',
      // «Εκτίμηση ανοιχτής θάλασσας» is a caption on a chart, not a sentence.
      cta: 'Βρες προστατευμένη παραλία κοντά σου',
      ctaPending: 'Ψάχνουμε πού είσαι…',
      allRegions: 'ή δες όλες τις περιοχές',
    },
    // "Calm" here is not a sea state — it is whatever makes the day work for THIS
    // person. So the three points are the two halves of that (the place, which is
    // fixed; the day, which is not) plus our limits. No "trust us" heading and no
    // claiming honesty: point 03 demonstrates it instead.
    manifesto: {
      overline: 'Τι σημαίνει «ήρεμα»',
      // SECOND PERSON, no grammatical gender. Greek «άλλος… άλλος…» defaults to
      // masculine and quietly addresses half the readers; «μπορεί να θες» carries
      // the same meaning with none of that, and matches the site's established
      // 'εσύ' voice. Same fix in every locale (de/it keep du/tu, fr keeps vous).
      //
      // The surf example is BACKED: data/surfSpots.json carries 31 spots named by
      // outside surf guides, with a seasonal filter, so "waves to surf" is a thing
      // the product actually delivers. It was pulled for one revision while
      // activities.surfing was still a hash of the beach id — do not restore that
      // sentence if the curated list ever goes away.
      // A display quote gets scanned, not read — so it is TWO beats and nothing
      // more: the claim, then three examples with the counter-intuitive one last
      // (someone hunting waves to surf is the strongest proof that "calm" is
      // personal). The old version ran 45 words and ended by restating what the
      // numbered points beside it already say; the points now carry that.
      quote:
        'Το «ήρεμα» δεν είναι το ίδιο για όλους. Μπορεί να θες ρηχά νερά, μπορεί μια άδεια αμμουδιά, μπορεί κύμα για σερφ.',
      points: [
        {
          title: 'Πώς το επαληθεύουμε',
          body: 'Επίσημα μητρώα, δορυφόρος, και παραλίες που έχουμε πάει οι ίδιοι. Διορθώνουμε κάθε βδομάδα, και όταν δεν είμαστε σίγουροι δεν το γράφουμε — χειρότερο να υποσχεθούμε μια ξαπλώστρα που δεν υπάρχει, παρά να μην την αναφέρουμε καθόλου.',
        },
        {
          title: 'Το σχήμα της ακτής',
          // Active voice: «περασμένα μέσα από» is a participle nobody speaks —
          // it also hid WHO does the work, which is the whole point of the card.
          body: 'Παίρνουμε τον άνεμο και το κύμα ανά ώρα και τα περνάμε μέσα από το σχήμα της κάθε ακτής. Γι’ αυτό μια διάσημη παραλία δεν βγαίνει αυτόματα καλύτερη.',
        },
        {
          title: 'Τι δεν ξέρουμε (ακόμα)',
          body: 'Ρεύματα, βυθό, τοπικές ριπές. Δείχνουμε πρόγνωση, όχι μέτρηση — γι’ αυτό δίνουμε εύρος κύματος. Όταν φτάσεις, κοίτα τη σημαία και τον ναυαγοσώστη.',
        },
        {
          title: 'Αυτό που φτιάχνουμε τώρα',
          body: 'Πλάνο για όλες τις μέρες που μένεις: ποια παραλία ποια μέρα, με βάση την πρόγνωση. Δουλεύει ήδη μέσα σε κάθε περιοχή.',
        },
      ],
      more: 'Πώς δουλεύει το CalmBeach',
      askLink: 'Ξέρεις κάτι που δεν ξέρουμε; Πες μας',
    },
    photos: {
      badge: 'ΝΕΟ',
      overline: 'Φωτογραφίες από εσένα',
      // The promise is the reward, and the reward is specific: not "join the
      // community" (nobody wants to join a community), but "your photo, on the
      // card, with your name on it".
      //
      // REWRITTEN 08/08/2026 because it read as machine-written. The tells were
      // an em-dash splicing every title, clipped verbless fragments ("Ten
      // seconds, no new password"), and three steps in identical rhythm. Full
      // sentences, one idea each, and the small concession that our own photos
      // are worse — a claim no template makes about itself.
      title: 'Η φωτογραφία σου είναι σίγουρα καλύτερη από τη δική μας',
      titleAccent: 'καλύτερη από τη δική μας',
      body: 'Οι μισές παραλίες εδώ δεν έχουν καμία φωτογραφία. Κι όσες έχουν, συνήθως δείχνουν κάτι γενικό που τράβηξε κάποιος περαστικός. Αν πήγες φέτος και έβγαλες μια καλή, στείλ’ την μας. Θα μπει στη σελίδα της παραλίας. Το όνομά σου από κάτω, μόνο αν το θέλεις.',
      steps: [
        { title: 'Μπες με Google', body: 'Δεν φτιάχνεις καινούριο κωδικό. Μπαίνεις με αυτόν που έχεις ήδη.' },
        { title: 'Διάλεξε τη φωτογραφία', body: 'Στείλ’ την όπως είναι από το κινητό.' },
        { title: 'Την κοιτάει άνθρωπος', body: 'Δεν ανεβαίνει μόνη της. Αν είναι καλή, θα τη δεις στη σελίδα της παραλίας.' },
      ],
      cta: 'Μπες και στείλε φωτογραφία',
      ctaSignedIn: 'Στείλε φωτογραφία',
      note: 'Με τον λογαριασμό κρατάς και τις αγαπημένες σου παραλίες, σε όποια συσκευή κι αν μπεις.',
    },
    // The page's one warm, human moment. It lands right after the dark manifesto
    // on purpose: that band is the institutional voice (what we measure, where we
    // stop), this one is the people behind it.
    //
    // Kept to three short paragraphs — on a phone, and 88% of visitors are on
    // one, an About essay is never read.
    //
    // VOICE: "εμείς", but a NAMED, specific we — a small team whose members have
    // different reasons to know this coast, not a corporate plural. The rule that
    // matters is concreteness: "μια ομάδα με αγάπη για τη θάλασσα" is what every
    // site says, while "ο ένας γεννήθηκε σε νησί, ο άλλος άλλαζε νησί κάθε λίγα
    // χρόνια" is a thing only these people can write.
    //
    // Do NOT add "the photos on this page are ours" (the hero shots are not the
    // team's own) and do not restore "we have been to plenty of these beaches"
    // (first-party verification currently covers a handful, so «πολλές» would not
    // survive a reader asking for the number). The "no beach pays to rank" line
    // is a PROMISE about result ordering — exposure and wind, nothing else. If
    // paid placement ever enters the ranking, that line comes out first.
    story: {
      overline: 'Ποιοι είμαστε',
      // Plain autobiographical fact, not a slogan — and it earns the next line.
      title: 'Μεγαλώσαμε με τη θάλασσα δίπλα μας',
      paragraphs: [
        'Είμαστε μια μικρή ομάδα με ένα κοινό: τη θάλασσα. Ο ένας γεννήθηκε σε νησί και ουσιαστικά δεν έφυγε ποτέ. Ο άλλος μεγάλωσε αλλάζοντας νησιά, λόγω της δουλειάς των γονιών του — άλλο σχολείο, άλλο λιμάνι, άλλες παραλίες. Κάπου εκεί μάθαμε αυτό που ξέρει κάθε ντόπιος και δεν γράφεται σε κανέναν οδηγό: ποια παραλία δουλεύει όταν φυσάει, και ποια όχι.',
        'Το έχουμε πάθει κι εμείς: οδηγήσαμε μία ώρα για μια παραλία που είχαμε δει σε φωτογραφία, και τη βρήκαμε με κύμα. Γι’ αυτό χαρτογραφούμε το σχήμα της κάθε ακτής — πού χτυπάει ο άνεμος, πού προστατεύει η στεριά — για όλη την Ελλάδα.',
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
      formEmailPlaceholder: 'name@example.com',
      // «Στέλνω…» would be the app speaking in the singular while the whole page
      // speaks as «εμείς»; the passive is what a Greek UI actually says here.
      formSending: 'Στέλνεται…',
      formSuccess: 'Το λάβαμε — ευχαριστούμε. Τα διαβάζουμε ένα-ένα.',
      formError: 'Κάτι πήγε στραβά. Στείλ’ το μας καλύτερα εδώ:',
      askCta: 'Στείλ’ το μας',
      mailSubject: 'Διόρθωση ή πρόταση για το CalmBeach',
      mailFallback: 'ή γράψε μας απευθείας',
    },
  },
  en: {
    hero: {
      title: 'Which beach in Greece suits you today?',
      titleAccent: 'today',
      subtitle: 'Calm doesn’t start at the beach. It starts the moment you know which one to pick.',
      searchPlaceholder: 'Search a beach or region…',
      searchPlaceholderAlt: 'Where and how many days?',
      searchAria: 'Search a beach, a region, or a stay in days',
      clearSearchAria: 'Clear search',
      searchRegionLabel: 'Region',
      searchBeachLabel: 'Beach',
      searchLoading: 'Searching beaches…',
      searchNoResults: 'No close match found. Press Enter to search.',
      searchNeedsPlace: 'Tell me the place as well.',
      nearMe: 'Near me',
      findingLocation: 'Finding location…',
    },
    today: {
      title: 'Choose a region',
      subtitle: 'The regions our visitors look for most. Choose one to see all its beaches and today’s conditions.',
      cta: 'Find a sheltered beach near you',
      ctaPending: 'Finding you…',
      allRegions: 'or see all regions',
    },
    manifesto: {
      overline: 'What “calm” means here',
      quote:
        '“Calm” is not the same thing for everyone. You might want shallow water, or an empty beach, or waves to surf.',
      points: [
        {
          title: 'How we check it',
          body: 'Official registries, satellite, and beaches we have walked ourselves. We correct them every week, and when we are not sure we leave it out — a sunbed that is not there is worse than one we never mentioned.',
        },
        {
          title: 'The shape of the coast',
          body: 'We take the wind and the waves hour by hour and read them through the shape of each shore. That is why a famous beach is not automatically the better one.',
        },
        {
          title: 'What we do not know (yet)',
          body: 'Currents, the seabed, local gusts. We show a forecast, not a measurement — which is why we give a wave range. When you arrive, check the flags and the lifeguard.',
        },
        {
          title: 'What we are building now',
          body: 'A plan for every day of your stay: which beach on which day, from the forecast. It already works inside each region.',
        },
      ],
      more: 'How CalmBeach works',
      askLink: 'Know something we don’t? Tell us',
    },
    photos: {
      badge: 'NEW',
      overline: 'Photos from you',
      title: 'Your photo is better than ours',
      titleAccent: 'better than ours',
      body: 'Half the beaches here have no photo at all. The ones that do usually show something generic that a passer-by took. If you went this summer and got a good one, send it over. It goes on the beach page. Your name underneath it, only if you want it there.',
      steps: [
        { title: 'Sign in with Google', body: 'There is no new password to invent. You use the one you already have.' },
        { title: 'Pick the photo', body: 'Send it straight from your phone, as it is.' },
        { title: 'A person looks at it', body: 'It does not go up on its own. If it is good, you will see it on the beach page.' },
      ],
      cta: 'Sign in and send a photo',
      ctaSignedIn: 'Send a photo',
      note: 'The account also keeps your saved beaches, whichever device you sign in from.',
    },
    story: {
      overline: 'Who we are',
      title: 'We grew up with the sea next door',
      paragraphs: [
        'We are a small team with one thing in common: the sea. One of us was born on an island and never really left it. Another grew up moving from island to island, following a parent’s work — a different school, a different port, different beaches. Somewhere in there we learned the thing every local knows and no guidebook prints: which beach works when the wind is up, and which one does not.',
        'It has caught us out as visitors too: we drove an hour to a beach we had seen in a photo, and found it churning. So we map the shape of every shore — where the wind hits, where the land shelters — across the whole of Greece.',
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
      formEmailPlaceholder: 'name@example.com',
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
      title: 'Welcher Strand in Griechenland passt heute zu dir?',
      titleAccent: 'heute',
      subtitle: 'Ruhe fängt nicht am Strand an. Sie fängt in dem Moment an, in dem du weißt, welcher der richtige ist.',
      searchPlaceholder: 'Strand oder Region suchen…',
      searchPlaceholderAlt: 'Wohin und wie viele Tage?',
      searchAria: 'Strand, Region oder Aufenthalt in Tagen suchen',
      clearSearchAria: 'Suche löschen',
      searchRegionLabel: 'Region',
      searchBeachLabel: 'Strand',
      searchLoading: 'Suche Strände…',
      searchNoResults: 'Kein passendes Ergebnis. Drücke Enter, um zu suchen.',
      searchNeedsPlace: 'Sag mir auch den Ort.',
      nearMe: 'In meiner Nähe',
      findingLocation: 'Standort wird ermittelt…',
    },
    today: {
      title: 'Wähle eine Region',
      subtitle: 'Die Regionen, die unsere Besucher am häufigsten suchen. Wähle eine aus, um alle Strände und die heutigen Bedingungen zu sehen.',
      cta: 'Finde einen geschützten Strand in deiner Nähe',
      // Never "Ich" in a German UI, and never a first-person singular anywhere on
      // a page that speaks as "wir".
      ctaPending: 'Dein Standort wird ermittelt…',
      allRegions: 'oder alle Regionen ansehen',
    },
    manifesto: {
      overline: 'Was „ruhig“ hier bedeutet',
      quote:
        '„Ruhig“ ist nicht für alle dasselbe. Vielleicht willst du flaches Wasser, vielleicht einen leeren Strand, vielleicht Wellen zum Surfen.',
      points: [
        {
          title: 'Wie wir es prüfen',
          body: 'Amtliche Register, Satellit und Strände, an denen wir selbst waren. Wir korrigieren wöchentlich, und im Zweifel lassen wir es weg — eine Liege zu versprechen, die es nicht gibt, ist schlimmer, als sie gar nicht zu erwähnen.',
        },
        {
          title: 'Die Form der Küste',
          body: 'Wir nehmen Wind und Wellen Stunde für Stunde und lesen sie durch die Form jeder Küste. Deshalb ist ein berühmter Strand nicht automatisch der bessere.',
        },
        {
          title: 'Was wir (noch) nicht wissen',
          body: 'Strömungen, den Grund, lokale Böen. Wir zeigen eine Vorhersage, keine Messung — deshalb geben wir eine Wellenspanne an. Achte vor Ort auf die Flaggen und den Rettungsschwimmer.',
        },
        {
          title: 'Woran wir gerade arbeiten',
          body: 'Ein Plan für jeden Tag deines Aufenthalts: welcher Strand an welchem Tag, aus der Vorhersage. In jeder Region funktioniert er schon.',
        },
      ],
      more: 'Wie CalmBeach funktioniert',
      askLink: 'Weißt du etwas, das wir nicht wissen? Sag es uns',
    },
    photos: {
      badge: 'NEU',
      overline: 'Fotos von dir',
      title: 'Dein Foto ist besser als unseres',
      titleAccent: 'besser als unseres',
      body: 'Die Hälfte der Strände hier hat überhaupt kein Foto. Und die anderen zeigen meistens irgendetwas Beliebiges, das jemand im Vorbeigehen aufgenommen hat. Wenn du diesen Sommer da warst und ein gutes Bild hast, schick es uns. Es kommt auf die Strandseite. Dein Name darunter, nur wenn du das möchtest.',
      steps: [
        { title: 'Mit Google anmelden', body: 'Du musst dir kein neues Passwort ausdenken. Du nimmst das, das du schon hast.' },
        { title: 'Foto aussuchen', body: 'Schick es direkt vom Handy, so wie es ist.' },
        { title: 'Ein Mensch schaut es an', body: 'Es geht nicht von allein online. Wenn es gut ist, siehst du es auf der Strandseite.' },
      ],
      cta: 'Anmelden und Foto schicken',
      ctaSignedIn: 'Foto schicken',
      note: 'Das Konto behält auch deine gespeicherten Strände, egal von welchem Gerät du dich anmeldest.',
    },
    story: {
      overline: 'Wer wir sind',
      title: 'Wir sind mit dem Meer vor der Tür aufgewachsen',
      paragraphs: [
        'Wir sind ein kleines Team mit einer Gemeinsamkeit: dem Meer. Einer von uns ist auf einer Insel geboren und im Grunde nie weggegangen. Ein anderer ist von Insel zu Insel gezogen, wegen der Arbeit der Eltern — eine andere Schule, ein anderer Hafen, andere Strände. Irgendwo dabei haben wir gelernt, was jeder Einheimische weiß und in keinem Reiseführer steht: welcher Strand funktioniert, wenn es weht, und welcher nicht.',
        'Als Besucher hat es uns selbst erwischt: Wir fuhren eine Stunde zu einem Strand, den wir auf einem Foto gesehen hatten, und fanden ihn aufgewühlt vor. Deshalb kartieren wir die Form jeder Küste — wo der Wind auftrifft, wo das Land schützt — für ganz Griechenland.',
        // "Kantine" is a works/school canteen — the Greek καντίνα is a beach kiosk.
        'Jede Woche verschieben wir Punkte auf der Karte, löschen Liegen und Strandkioske, die es nicht mehr gibt, und ergänzen fehlende Strände. Kein Strand zahlt für eine bessere Platzierung — die Reihenfolge ergibt sich aus dem Wind und der Form der Küste, aus nichts anderem. Genau da brauchen wir dich: Du kennst deinen Strand besser als jeder Satellit.',
      ],
      pullQuote: 'Kein Foto sagt dir, was das Meer heute macht.',
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
      formEmailPlaceholder: 'name@example.com',
      formSending: 'Wird gesendet…',
      formSuccess: 'Angekommen — danke. Wir lesen jede einzelne.',
      formError: 'Etwas ist schiefgelaufen. Schick es uns besser hierhin:',
      askCta: 'Schick es uns',
      mailSubject: 'Korrektur oder Vorschlag für CalmBeach',
      mailFallback: 'oder schreib uns direkt',
    },
  },
  fr: {
    hero: {
      title: 'Quelle plage de Grèce vous convient aujourd’hui ?',
      titleAccent: 'aujourd’hui',
      subtitle: 'Le calme ne commence pas sur la plage. Il commence au moment où vous savez laquelle choisir.',
      searchPlaceholder: 'Chercher une plage ou une région…',
      searchPlaceholderAlt: 'Où et combien de jours ?',
      searchAria: 'Chercher une plage, une région ou un séjour en jours',
      clearSearchAria: 'Effacer la recherche',
      searchRegionLabel: 'Région',
      searchBeachLabel: 'Plage',
      searchLoading: 'Recherche des plages…',
      searchNoResults: 'Aucun résultat similaire. Appuyez sur Entrée pour lancer la recherche.',
      searchNeedsPlace: 'Dites-moi aussi le lieu.',
      nearMe: 'Près de moi',
      findingLocation: 'Localisation en cours…',
    },
    today: {
      title: 'Choisissez une région',
      subtitle: 'Les régions les plus recherchées par nos visiteurs. Choisissez-en une pour voir toutes ses plages et les conditions du jour.',
      cta: 'Trouver une plage abritée près de vous',
      ctaPending: 'Localisation en cours…',
      allRegions: 'ou voir toutes les régions',
    },
    manifesto: {
      overline: 'Ce que « calme » veut dire ici',
      quote:
        '« Calme » ne veut pas dire la même chose pour tout le monde. Vous voulez peut-être de l’eau peu profonde, ou une plage déserte, ou des vagues pour surfer.',
      points: [
        {
          title: 'Comment nous le vérifions',
          body: 'Registres officiels, satellite et plages où nous sommes allés nous-mêmes. Nous corrigeons chaque semaine et, en cas de doute, nous n’indiquons rien — promettre un transat qui n’existe pas est pire que de ne pas le mentionner du tout.',
        },
        {
          title: 'La forme de la côte',
          body: 'Nous prenons le vent et les vagues heure par heure et nous les lisons à travers la forme de chaque côte. C’est pourquoi une plage célèbre n’est pas automatiquement la meilleure.',
        },
        {
          title: 'Ce que nous ne savons pas (encore)',
          body: 'Les courants, le fond, les rafales locales. Nous montrons une prévision, pas une mesure — d’où la fourchette de hauteur de vagues. Sur place, regardez les drapeaux et le maître-nageur.',
        },
        {
          title: 'Ce que nous construisons en ce moment',
          body: 'Un plan pour chaque jour de votre séjour : quelle plage quel jour, à partir des prévisions. Il fonctionne déjà dans chaque région.',
        },
      ],
      more: 'Comment fonctionne CalmBeach',
      askLink: 'Vous savez quelque chose que nous ignorons ? Dites-le-nous',
    },
    photos: {
      badge: 'NOUVEAU',
      overline: 'Vos photos',
      title: 'Votre photo est meilleure que la nôtre',
      titleAccent: 'meilleure que la nôtre',
      body: "La moitié des plages ici n'ont aucune photo. Et celles qui en ont montrent souvent quelque chose de banal, pris par quelqu'un de passage. Si vous y êtes allé cet été et que vous avez une belle photo, envoyez-la-nous. Elle ira sur la page de la plage. Votre nom en dessous, seulement si vous le voulez.",
      steps: [
        { title: 'Connectez-vous avec Google', body: "Il n'y a pas de nouveau mot de passe à inventer. Vous utilisez celui que vous avez déjà." },
        { title: 'Choisissez la photo', body: 'Envoyez-la telle quelle depuis votre téléphone.' },
        { title: 'Une personne la regarde', body: "Elle ne se publie pas toute seule. Si elle est belle, vous la verrez sur la page de la plage." },
      ],
      cta: 'Se connecter et envoyer une photo',
      ctaSignedIn: 'Envoyer une photo',
      note: "Le compte garde aussi vos plages enregistrées, quel que soit l'appareil.",
    },
    story: {
      overline: 'Qui nous sommes',
      title: 'Nous avons grandi avec la mer à côté',
      paragraphs: [
        'Nous sommes une petite équipe avec un point commun : la mer. L’un de nous est né sur une île et n’en est jamais vraiment parti. Un autre a grandi en changeant d’île, à cause du travail de ses parents — une autre école, un autre port, d’autres plages. C’est là que nous avons appris ce que sait chaque habitant et qu’aucun guide n’imprime : quelle plage marche quand il vente, et laquelle non.',
        'Cela nous est arrivé aussi, en tant que visiteurs : nous avons roulé une heure pour une plage vue en photo, et nous l’avons trouvée agitée. C’est pourquoi nous cartographions la forme de chaque côte — où le vent frappe, où la terre abrite — pour toute la Grèce.',
        // "cantine" is a school/works canteen in French — a beach καντίνα is a buvette.
        'Chaque semaine, nous déplaçons des points sur la carte, nous retirons les transats et les buvettes qui n’existent plus, nous ajoutons les plages qui manquaient. Aucune plage ne paie pour être mieux classée — l’ordre vient du vent et de la forme de la côte, de rien d’autre. C’est là que nous avons besoin de vous : vous connaissez votre plage mieux que n’importe quel satellite.',
      ],
      pullQuote: 'Aucune photo ne vous dit ce que la mer fait aujourd’hui.',
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
      formEmailPlaceholder: 'name@example.com',
      formSending: 'Envoi en cours…',
      formSuccess: 'Bien reçu — merci. Nous les lisons un par un.',
      formError: 'Quelque chose n’a pas fonctionné. Envoyez-le-nous plutôt ici :',
      askCta: 'Envoyez-le-nous',
      mailSubject: 'Correction ou suggestion pour CalmBeach',
      mailFallback: 'ou écrivez-nous directement',
    },
  },
  it: {
    hero: {
      title: 'Quale spiaggia della Grecia fa per te oggi?',
      titleAccent: 'oggi',
      subtitle: 'La calma non inizia in spiaggia. Inizia nel momento in cui sai quale scegliere.',
      searchPlaceholder: 'Cerca una spiaggia o una regione…',
      searchPlaceholderAlt: 'Dove e quanti giorni?',
      searchAria: 'Cerca una spiaggia, una zona o un soggiorno in giorni',
      clearSearchAria: 'Cancella la ricerca',
      searchRegionLabel: 'Regione',
      searchBeachLabel: 'Spiaggia',
      searchLoading: 'Cerchiamo spiagge…',
      searchNoResults: 'Nessun risultato simile. Premi Invio per cercare.',
      searchNeedsPlace: 'Dimmi anche il posto.',
      nearMe: 'Vicino a me',
      findingLocation: 'Ricerca della posizione…',
    },
    today: {
      title: 'Scegli una regione',
      subtitle: 'Le regioni più cercate dai nostri visitatori. Scegline una per vedere tutte le spiagge e le condizioni di oggi.',
      // Italian has its own official sea-state ladder (calmo / poco mosso / mosso
      // / molto mosso / agitato) — use it rather than translating the English.
      cta: 'Trova una spiaggia riparata vicino a te',
      ctaPending: 'Cerchiamo dove sei…',
      allRegions: 'oppure vedi tutte le regioni',
    },
    manifesto: {
      overline: 'Cosa significa «calmo» qui',
      quote:
        '«Calmo» non è lo stesso per tutti. Forse vuoi acqua bassa, forse una spiaggia deserta, forse onde per fare surf.',
      points: [
        {
          title: 'Come lo verifichiamo',
          body: 'Registri ufficiali, satellite e spiagge che abbiamo visitato di persona. Correggiamo ogni settimana e, nel dubbio, non lo scriviamo — promettere un lettino che non c’è è peggio che non menzionarlo affatto.',
        },
        {
          title: 'La forma della costa',
          body: 'Prendiamo vento e onde ora per ora e li leggiamo attraverso la forma di ogni costa. Per questo una spiaggia famosa non è automaticamente la migliore.',
        },
        {
          title: 'Cosa non sappiamo (ancora)',
          body: 'Le correnti, il fondale, le raffiche locali. Mostriamo una previsione, non una misura — per questo diamo un intervallo di altezza delle onde. Sul posto, guarda le bandiere e il bagnino.',
        },
        {
          title: 'Quello che stiamo costruendo ora',
          body: 'Un piano per ogni giorno del tuo soggiorno: quale spiaggia in quale giorno, in base alle previsioni. Funziona già dentro ogni regione.',
        },
      ],
      more: 'Come funziona CalmBeach',
      askLink: 'Sai qualcosa che non sappiamo? Diccelo',
    },
    photos: {
      badge: 'NUOVO',
      overline: 'Le tue foto',
      title: 'La tua foto è migliore della nostra',
      titleAccent: 'migliore della nostra',
      body: 'Metà delle spiagge qui non ha nessuna foto. E quelle che ce l’hanno mostrano di solito qualcosa di generico, scattato da qualcuno di passaggio. Se ci sei stato quest’estate e hai una foto bella, mandacela. Finisce sulla pagina della spiaggia. Il tuo nome sotto, solo se lo vuoi.',
      steps: [
        { title: 'Accedi con Google', body: 'Non devi inventarti una password nuova. Usi quella che hai già.' },
        { title: 'Scegli la foto', body: 'Mandala dal telefono così com’è.' },
        { title: 'La guarda una persona', body: 'Non va online da sola. Se è bella, la vedrai sulla pagina della spiaggia.' },
      ],
      cta: 'Accedi e manda una foto',
      ctaSignedIn: 'Manda una foto',
      note: 'L’account tiene anche le tue spiagge salvate, da qualunque dispositivo entri.',
    },
    story: {
      overline: 'Chi siamo',
      title: 'Siamo cresciuti con il mare accanto',
      paragraphs: [
        'Siamo un piccolo team con una cosa in comune: il mare. Uno di noi è nato su un’isola e in fondo non è mai andato via. Un altro è cresciuto cambiando isola, per il lavoro dei genitori — un’altra scuola, un altro porto, altre spiagge. È lì che abbiamo imparato quello che sa ogni abitante e che nessuna guida scrive: quale spiaggia funziona quando tira vento, e quale no.',
        'È capitato anche a noi, come visitatori: abbiamo guidato un’ora per una spiaggia vista in foto, e l’abbiamo trovata mossa. Per questo mappiamo la forma di ogni costa — dove batte il vento, dove ripara la terra — per tutta la Grecia.',
        'Ogni settimana spostiamo punti sulla mappa, togliamo lettini e chioschi che non ci sono più, aggiungiamo spiagge che mancavano. Nessuna spiaggia paga per stare più in alto — l’ordine viene dal vento e dalla forma della costa, da nient’altro. È lì che abbiamo bisogno di te: la tua spiaggia la conosci meglio di qualsiasi satellite.',
      ],
      pullQuote: 'Nessuna foto ti dice cosa fa il mare oggi.',
      signature: 'Il team di CalmBeach',
      askTitle: 'Sai qualcosa che non sappiamo?',
      askHint: 'Bastano due righe.',
      askPrompts: [
        { id: 'missing', label: 'Manca una spiaggia', seed: 'Manca una spiaggia: ' },
        { id: 'outdated', label: 'Qualcosa non è più valido', seed: 'Qualcosa non è più valido: ' },
        { id: 'local', label: 'Qualcosa che nessuna mappa mostra', seed: 'Qualcosa che nessuna mappa mostra: ' },
      ],
      formPlaceholder: 'es. «a Limnionas non ci sono più i lettini» o «nel pomeriggio il vento prende il lato destro».',
      formEmailLabel: 'Email — solo se vuoi una risposta',
      formEmailPlaceholder: 'name@example.com',
      formSending: 'Invio in corso…',
      formSuccess: 'Ricevuto — grazie. Le leggiamo tutte, una per una.',
      formError: 'Qualcosa è andato storto. Mandacelo meglio qui:',
      askCta: 'Mandacelo',
      mailSubject: 'Correzione o suggerimento per CalmBeach',
      mailFallback: 'oppure scrivici direttamente',
    },
  },
};
