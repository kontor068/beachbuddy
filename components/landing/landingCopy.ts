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
    /**
     * THE LIVE SUBTITLE, shown INSTEAD of `subtitle` once we know today's wind and the reading
     * is genuinely recent (see TodayRegionsSection). `{wind}` is replaced by the matching
     * `windFrom` entry. When the reading is missing or stale the plain `subtitle` stays — the
     * section degrades to what it was, never to a sentence about a wind we cannot vouch for.
     */
    shelterSubtitle: string;
    /**
     * THE SAME SENTENCE FOR A DAY THE COUNTRY DOES NOT AGREE ON. When the Ionian has a southerly
     * and the Aegean a northerly, no single wind word is true for both, so the numbers stay and
     * the naming goes (utils/landingShelter.ts, dominantWindSector).
     */
    shelterSubtitleMixed: string;
    /**
     * The eight compass sectors as the live subtitle needs them, N first, clockwise. They are
     * ADJECTIVES in Greek and English («βόρειος άνεμος» / "northerly"), NOUNS after a
     * preposition in German, French and Italian ("aus Norden", "du nord", "da nord"), because
     * that is what each sentence template above actually needs. Deliberately NOT reused from
     * utils/windExposureCopy.ts: that file's labels only exist in en/gr and the landing runs
     * in five languages.
     */
    windFrom: [string, string, string, string, string, string, string, string];
    /**
     * Screen-reader label for a tile carrying numbers. `{count}`, `{total}` and `{region}` are
     * replaced. The visual tile shows a bare fraction next to a bar, which reads as nothing
     * out loud — this is the sentence that says what the fraction means.
     */
    shelterAria: string;
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
  /**
   * The way into the guide articles — 381 of them, and until this shipped the
   * landing linked exactly zero. The prerendered fallback has carried a
   * "popular beach guides" nav all along, but it lives inside #root and React
   * wipes it on mount, so the links existed for crawlers and for nobody else.
   *
   * The destinations themselves are labelled from vocabulary that already exists
   * in five languages (topic labels in utils/beachGuides.ts, region names in the
   * beach index), so this block adds no translatable link text.
   *
   * A HEADING AND NOTHING ELSE (09/08/2026). There used to be a subtitle naming
   * three of the topics — «ποιες μένουν απάνεμες, ποιες βολεύουν με παιδιά,
   * ποιες βλέπουν το ηλιοβασίλεμα» — directly above six links that say exactly
   * those things by name, two centimetres lower. It was the page telling you
   * what you were about to read instead of letting you read it.
   */
  guides: {
    title: string;
  };
  /**
   * The newsletter — and the landing's ONLY mechanism for a second visit. Every
   * other block on this page helps someone today and then lets them leave; a
   * service people use four times a year has no natural return path, so the
   * alternative to this is depending on Google remembering us every single time.
   *
   * TWO RULES ON THIS COPY, both about not writing a cheque we cannot cash:
   *  - SAY WHAT ARRIVES AND HOW OFTEN, in the visitor's own terms. "Subscribe to
   *    our newsletter" promises nothing and is therefore trusted by nobody. The
   *    body names the content (what we added, fixed, learned) and — more
   *    importantly — what does NOT arrive: offers, and not every week.
   *  - THE CONSENT LINE IS PART OF THE OFFER, not fine print. It states the only
   *    thing stored (the address), the only use, and that leaving is one line to
   *    a human. It is shown BEFORE the button, because consent you read after
   *    you acted is not consent. `consentVersion` in the Netlify function is
   *    stamped onto every row — change this wording materially and bump it there.
   */
  newsletter: {
    overline: string;
    title: string;
    body: string;
    placeholder: string;
    inputLabel: string;
    cta: string;
    sending: string;
    /**
     * Shown for a new subscriber AND for an address already on the list.
     *
     * IT NAMES THE EMAIL THAT IS NOT COMING, and that clause is load-bearing:
     * there is no mail provider behind this form (netlify/functions/
     * newsletter-subscribe.mjs writes a durable row and pushes to Telegram —
     * nothing is ever sent to the subscriber). A confirmation people wait for
     * and never get costs twice: they sign up again believing it failed, and
     * when the first real newsletter lands months later it arrives from a sender
     * they have no memory of, which is exactly how mail gets marked as spam.
     * DELETE THAT CLAUSE ONLY WHEN A WELCOME EMAIL ACTUALLY SENDS.
     */
    success: string;
    invalid: string;
    /** Followed by the plain contact address, so the path never dead-ends. */
    error: string;
    consent: string;
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
    /**
     * ONE label for both states since 11/08/2026. It used to be a pair — "sign in
     * and send" vs "send" — because sending genuinely required a Google account.
     * It no longer does (guest uploads, migration 0005), so a second label would
     * only be a place for the old promise to survive.
     */
    cta: string;
    /**
     * What an account changes now: the name under the photo, nothing else. It is
     * NOT a condition for sending, and this line must never read as one.
     */
    note: string;
  };
  story: {
    overline: string;
    title: string;
    /** Short paragraphs — this is a note, not an About page. */
    paragraphs: string[];
    /** Lifted out of paragraph 2 as the column's one visual anchor for skimmers. */
    pullQuote: string;
    /**
     * A NAMED signature, split in two so the name can carry visual weight and a
     * monogram while the role stays quiet.
     *
     * It used to read «Η ομάδα του CalmBeach» — and an anonymous letter is a
     * strange thing to close the page's most-read section with (85% of the
     * people who reach the heading also reach this line). It also sat oddly
     * against our own competitor note, which counts an anonymous operator
     * against a rival. A name is the cheapest trust the page can buy.
     *
     * KEEP THE NAME IDENTICAL ACROSS LOCALES except for script: Greek renders it
     * in Greek letters, everyone else in Latin. Do not translate or localise the
     * person. The role line carries the language.
     */
    signatureName: string;
    signatureRole: string;
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
      // AND NEVER NAME A KEY: 88% of visitors are on a phone, where there is no
      // Enter key at all — the old line pointed at hardware most readers do not
      // have. Name the button they can see. Same fix in every locale.
      searchNoResults: 'Δεν βρήκαμε κάτι παρόμοιο. Πάτα αναζήτηση.',
      // «Πες μας», never «Πες μου» — same rule as searchLoading above. This was
      // the one string on the page speaking in the singular.
      searchNeedsPlace: 'Πες μας και σε ποιο μέρος.',
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
      // SHORTENED 09/08/2026. The second sentence used to explain what clicking a
      // region does, under a heading that already says «Διάλεξε περιοχή» — the
      // definition of explaining the obvious. It now promises the concrete thing
      // the next page delivers (wind), not the word «συνθήκες».
      subtitle: 'Αυτές ψάχνουν πιο πολύ οι επισκέπτες μας. Μπες σε μία και δες πού φυσάει σήμερα.',
      // ΤΟ ΝΟΥΜΕΡΟ ΕΙΝΑΙ ΚΑΤΩ ΦΡΑΓΜΑ, ΚΑΙ Η ΛΕΞΗ ΕΙΝΑΙ Η ΙΔΙΑ ΜΕ ΤΟΥ ΧΑΡΤΗ (29/08/2026).
      // «Προστατευμένη» τη λέει ο χάρτης της περιοχής ένα κλικ μετά, από την ίδια συνάρτηση —
      // γι᾽ αυτό εδώ δεν λέμε «ήρεμες» ή «απάνεμες»: δύο λέξεις για το ίδιο πράγμα είναι δύο
      // υποσχέσεις. Ο αριθμός ψήνεται στα 6 Μποφόρ, ώστε ο χάρτης να δείχνει πάντα
      // τουλάχιστον τόσες (scripts/validateLandingShelterBound.mjs — 2.808 έλεγχοι).
      shelterSubtitle: 'Σήμερα ο άνεμος είναι {wind}. Ο αριθμός δείχνει πόσες παραλίες κάθε περιοχής είναι προστατευμένες από αυτόν.',
      shelterSubtitleMixed: 'Σήμερα ο άνεμος αλλάζει από περιοχή σε περιοχή. Ο αριθμός δείχνει πόσες παραλίες προστατεύονται σε καθεμιά.',
      windFrom: ['βόρειος', 'βορειοανατολικός', 'ανατολικός', 'νοτιοανατολικός', 'νότιος', 'νοτιοδυτικός', 'δυτικός', 'βορειοδυτικός'],
      shelterAria: '{region}: {count} από {total} παραλίες προστατευμένες από τον σημερινό άνεμο',
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
        'Το «ήρεμα» δεν είναι το ίδιο για όλους. Μπορεί να θες ρηχά νερά, μπορεί μια άδεια αμμουδιά, μπορεί και κύμα για σερφ.',
      points: [
        {
          // TITLE IS A QUESTION THE VISITOR ACTUALLY HAS — «Πώς το ελέγχουμε»
          // answered a question nobody had asked yet. The body keeps the three
          // SOURCES and the weekly habit (that is authority) and drops the
          // step-by-step of what we do to the map (that was procedure, and on a
          // phone it made this the longest card on the page by far).
          title: 'Από πού ξέρουμε τι υπάρχει',
          // «ξαναπερνάει από έλεγχο», never «βελτιώνουμε»: the same fact framed as
          // improvement reads as "not finished yet"; framed as checking, it reads
          // as maintenance. Do not write «κάθε μέρα» — the real cadence is weekly
          // and a second number on the page would contradict this one. And no date
          // stamp: the static pages are not rebuilt daily, so a «last checked»
          // line would freeze and say the opposite of what it is there to say.
          // «με το χέρι» is the load-bearing addition: it says a person does this.
          body: 'Επίσημα μητρώα, δορυφόρος και παραλίες που έχουμε πάει οι ίδιοι. Κάθε βδομάδα ένα κομμάτι του χάρτη ξαναπερνάει από έλεγχο, με το χέρι. Όταν δεν είμαστε σίγουροι, δεν το γράφουμε: χειρότερο να υποσχεθούμε μια ξαπλώστρα που δεν υπάρχει, παρά να μην την αναφέρουμε καθόλου.',
        },
        {
          // WAS «Το σχήμα της ακτής», and the body was the recipe: wind and waves
          // per hour, read through the shape of each shore. That is the one thing
          // on this page a competitor could copy off the screen. The card now
          // states the RESULT instead — every coast judged on its own, re-judged
          // hourly — and closes with something the visitor can verify without us:
          // two neighbouring beaches disagreeing on the same day. Nobody can fake
          // that, which is why it persuades more than the method ever did.
          title: 'Η φήμη δεν μετράει εδώ',
          body: 'Κάθε ακτή της Ελλάδας είναι χαρτογραφημένη χωριστά και κρίνεται ξανά κάθε ώρα. Γι’ αυτό μια διάσημη παραλία δεν βγαίνει αυτόματα καλύτερη — και γι’ αυτό δύο παραλίες δίπλα-δίπλα μπορεί να έχουν άλλη απάντηση την ίδια μέρα.',
        },
        {
          title: 'Τι δεν ξέρουμε (ακόμα)',
          // WAS «Ρεύματα, βυθό, τοπικές ριπές» — δύο από τα τρία ήταν ψέμα: το
          // badge «ρηχά/βαθιά νερά» στέκεται δίπλα στην ίδια κάρτα παραλίας και
          // αλλού γράφουμε ρητά «κοιτάμε τον άνεμο, τις ριπές και το κύμα».
          // Μια κάρτα μετριοφροσύνης που αντιφάσκει με το ίδιο το προϊόν ρίχνει
          // την αξιοπιστία και των δύο. Μένουν μόνο όσα όντως δεν ξέρουμε.
          body: 'Ρεύματα, βράχια κάτω από την επιφάνεια, μέδουσες. Δείχνουμε πρόγνωση, όχι μέτρηση — γι’ αυτό δίνουμε εύρος κύματος και όχι έναν ακριβή αριθμό. Όταν φτάσεις, κοίτα τη σημαία και τον ναυαγοσώστη.',
        },
        {
          // REPLACES «Αυτό που προσθέσαμε τελευταία» (29/08/2026). That card had
          // to be rewritten every time we shipped anything, and between rewrites
          // it advertised something months old as "latest" — a card that decays
          // into a lie on its own. What took its place is the strongest thing we
          // can say and the only one that never goes stale.
          //
          // THE CLAIM MOVED UP, it was not invented here: it lived in
          // story.paragraphs[2], the sixth band on a phone, where almost nobody
          // reaches — the same reasoning that moved the weekly re-check into
          // point 01 on 22/08. It was REMOVED from that paragraph in all five
          // locales; check there before restoring anything.
          //
          // IT IS A PROMISE ABOUT RESULT ORDERING and nothing wider — deliberately
          // not "we take no money from anyone", which an accommodation link would
          // make false overnight (see the affiliate note in App.tsx). If paid
          // placement ever enters the ranking, this card comes out first.
          title: 'Ποιος μας πληρώνει',
          body: 'Κανείς δεν αγοράζει θέση στη λίστα. Καμία παραλία, κανένα μαγαζί, κανένα ξενοδοχείο δεν μπορεί να πληρώσει για να βγει ψηλότερα — η σειρά βγαίνει από τον καιρό και την ακτή, από τίποτα άλλο.',
        },
      ],
      more: 'Πώς δουλεύει το CalmBeach',
    },
    guides: {
      // WAS A QUESTION («Ψάχνεις κάτι συγκεκριμένο;») over six bare adjectives,
      // and nobody realised these were articles — it read as a filter picker.
      // The heading now names the thing: άρθρα.
      //
      // NOT «Δημοφιλή» (09/08/2026): only two of the six pairs are there because
      // Search Console shows they earn clicks (utils/landingGuideLinks.ts) — the
      // other four are there because the region is already on this page. The
      // heading now describes what the list IS, which is defensible.
      title: 'Άρθρα ανά περιοχή',
    },
    newsletter: {
      // «Πριν φύγεις», not «Μείνε κοντά»: this is the last block on the page and
      // the overline should say where the reader is standing. The old one was a
      // greeting-card phrase that promised nothing.
      overline: 'Πριν φύγεις',
      title: 'Θες να μαθαίνεις τι φτιάχνουμε;',
      body: 'Ένα σύντομο email πού και πού: τι προσθέσαμε, τι διορθώσαμε, τι μάθαμε για τον καιρό των παραλιών. Όχι προσφορές, όχι κάθε βδομάδα.',
      placeholder: 'name@example.com',
      inputLabel: 'Το email σου',
      cta: 'Γράψε με',
      sending: 'Στέλνεται…',
      success: 'Σε γράψαμε. Δεν θα σου έρθει email επιβεβαίωσης. Θα σου γράψουμε μόνο όταν έχουμε κάτι να πούμε.',
      invalid: 'Έλεγξε το email, κάτι λείπει.',
      error: 'Κάτι πήγε στραβά. Δοκίμασε ξανά ή γράψε μας:',
      consent: 'Κρατάμε μόνο το email σου, μόνο για αυτά τα μηνύματα. Φεύγεις όποτε θες με μία γραμμή.',
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
      // SHORTENED 09/08/2026 with the rest of the section: it was the tallest
      // block on the page and it asks for a favour from someone who, on a first
      // visit from Google, has not been to the beach yet. The concession that
      // our own photos are worse is kept — it is the only line here no template
      // would write about itself.
      // «θα μπει» became «μπαίνει» (09/08/2026): the future tense read as a
      // promise to THIS photo, which step 3 then takes back («την κοιτάει
      // άνθρωπος»). The present tense describes what happens to photos in
      // general and leaves the approval queue where it belongs.
      // «χωρίς λογαριασμό» ΜΕΣΑ στην παράκληση (11/08/2026), όχι σε ψιλά γράμματα
      // από κάτω: το εμπόδιο πρέπει να πέφτει την ίδια στιγμή που ζητάμε τη χάρη.
      body: 'Οι μισές παραλίες εδώ δεν έχουν καμία φωτογραφία, κι όσες έχουν δείχνουν συνήθως θάλασσα από μακριά. Αν πήγες φέτος κι έβγαλες μια καλή, στείλ’ την μας — χωρίς λογαριασμό, χωρίς email. Μπαίνει στη σελίδα της παραλίας.',
      steps: [
        { title: 'Διάλεξε παραλία', body: 'Γράψε το όνομά της και τη βρίσκουμε.' },
        { title: 'Διάλεξε τη φωτογραφία', body: 'Στείλ’ την όπως είναι από το κινητό.' },
        { title: 'Την κοιτάει άνθρωπος', body: 'Δεν ανεβαίνει μόνη της. Αν είναι καλή, θα τη δεις στη σελίδα της παραλίας.' },
      ],
      cta: 'Στείλε φωτογραφία',
      note: 'Χωρίς λογαριασμό η φωτογραφία γράφεται «από επισκέπτη». Αν θες το όνομά σου από κάτω, μπες με Google.',
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
    // survive a reader asking for the number). The "no beach pays to rank"
    // promise NO LONGER LIVES HERE — it moved into manifesto point 04 on
    // 29/08/2026, four bands higher, because almost nobody on a phone reached
    // this letter. Do not restore it in these paragraphs; the page would then
    // make the same promise twice.
    story: {
      overline: 'Ποιοι είμαστε',
      // Plain autobiographical fact, not a slogan — and it earns the next line.
      title: 'Μεγαλώσαμε με τη θάλασσα δίπλα μας',
      paragraphs: [
        'Είμαστε μια μικρή ομάδα με ένα κοινό: τη θάλασσα. Ο ένας γεννήθηκε σε νησί και ουσιαστικά δεν έφυγε ποτέ. Ο άλλος μεγάλωσε αλλάζοντας νησιά, λόγω της δουλειάς των γονιών του: άλλο σχολείο, άλλο λιμάνι, άλλες παραλίες. Κάπου εκεί μάθαμε αυτό που ξέρει κάθε ντόπιος και δεν γράφεται σε κανέναν οδηγό: ποια παραλία δουλεύει όταν φυσάει, και ποια όχι.',
        'Το έχουμε πάθει κι εμείς: οδηγήσαμε μία ώρα για μια παραλία που είχαμε δει σε φωτογραφία, και τη βρήκαμε με κύμα. Γι’ αυτό χαρτογραφούμε το σχήμα κάθε ακτής στην Ελλάδα: πού χτυπάει ο άνεμος, πού προστατεύει η στεριά.',
        'Εκεί χρειαζόμαστε εσένα: την παραλία σου την ξέρεις καλύτερα από κάθε δορυφόρο.',
      ],
      pullQuote: 'Καμία φωτογραφία δεν σου λέει τι κάνει η θάλασσα σήμερα.',
      signatureName: 'Μίλτος',
      signatureRole: 'από την ομάδα του CalmBeach',
      askTitle: 'Ξέρεις κάτι που δεν ξέρουμε;',
      askHint: 'Δυο γραμμές αρκούν.',
      askPrompts: [
        { id: 'missing', label: 'Λείπει μια παραλία', seed: 'Λείπει μια παραλία: ' },
        { id: 'outdated', label: 'Κάτι δεν ισχύει πια', seed: 'Κάτι δεν ισχύει πια: ' },
        { id: 'local', label: 'Κάτι που δεν φαίνεται στον χάρτη', seed: 'Κάτι που δεν φαίνεται στον χάρτη: ' },
      ],
      formPlaceholder: 'π.χ. «Στη Λιμνιώνα έφυγαν οι ξαπλώστρες» ή «Το απόγευμα σε πιάνει ο αέρας στη δεξιά άκρη».',
      formEmailLabel: 'Email (μόνο αν θες απάντηση)',
      formEmailPlaceholder: 'name@example.com',
      // «Στέλνω…» would be the app speaking in the singular while the whole page
      // speaks as «εμείς»; the passive is what a Greek UI actually says here.
      formSending: 'Στέλνεται…',
      formSuccess: 'Το λάβαμε, ευχαριστούμε. Τα διαβάζουμε ένα-ένα.',
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
      searchNoResults: 'We found nothing close. Press search.',
      searchNeedsPlace: 'Tell us the place as well.',
      nearMe: 'Near me',
      findingLocation: 'Finding location…',
    },
    today: {
      title: 'Choose a region',
      subtitle: 'These are what our visitors look for most. Open one and see where the wind is today.',
      shelterSubtitle: 'Today’s wind is {wind}. The number is how many beaches in each region are sheltered from it.',
      shelterSubtitleMixed: 'The wind differs from region to region today. The number is how many beaches are sheltered in each one.',
      windFrom: ['northerly', 'north-easterly', 'easterly', 'south-easterly', 'southerly', 'south-westerly', 'westerly', 'north-westerly'],
      shelterAria: '{region}: {count} of {total} beaches sheltered from today’s wind',
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
          title: 'How we know what is there',
          body: 'Official registries, satellite, and beaches we have walked ourselves. Every week another stretch of the map goes back through checks, by hand. When we are not sure, we leave it out: promising a sunbed that is not there is worse than never mentioning it.',
        },
        {
          title: 'Fame counts for nothing here',
          body: 'Every stretch of Greek coast is mapped on its own and judged again every hour. That is why a famous beach is not automatically the better one — and why two beaches side by side can give a different answer on the same day.',
        },
        {
          title: 'What we do not know (yet)',
          body: 'Currents, rocks under the surface, jellyfish. We show a forecast, not a measurement — which is why we give a wave range rather than one exact number. When you arrive, check the flags and the lifeguard.',
        },
        {
          title: 'Who pays us',
          body: 'Nobody buys a place in the list. No beach, no business, no hotel can pay to rank higher — the order comes from the weather and the coast, from nothing else.',
        },
      ],
      more: 'How CalmBeach works',
    },
    guides: {
      title: 'Articles by region',
    },
    newsletter: {
      overline: 'Before you go',
      title: 'Want to hear what we are building?',
      body: 'A short email now and then: what we added, what we fixed, what we learned about beach weather. No offers, and not every week.',
      placeholder: 'name@example.com',
      inputLabel: 'Your email',
      cta: 'Sign me up',
      sending: 'Sending…',
      success: 'You are on the list. No confirmation email is coming — we will write only when we have something to say.',
      invalid: 'Check the address — something is missing.',
      error: 'Something went wrong. Try again, or write to us:',
      consent: 'We keep your email and nothing else, and use it only for these messages. One line to us and you are off the list.',
    },
    photos: {
      badge: 'NEW',
      overline: 'Photos from you',
      title: 'Your photo is better than ours',
      titleAccent: 'better than ours',
      body: 'Half the beaches here have no photo at all, and the ones that do usually show the sea from far away. If you went this summer and got a good one, send it over — no account, no email. It goes on the beach page.',
      steps: [
        { title: 'Pick the beach', body: 'Type its name and we will find it.' },
        { title: 'Pick the photo', body: 'Send it straight from your phone, as it is.' },
        { title: 'A person looks at it', body: 'It does not go up on its own. If it is good, you will see it on the beach page.' },
      ],
      cta: 'Send a photo',
      note: 'Without an account the photo is credited "from a visitor". If you want your name underneath, sign in with Google.',
    },
    story: {
      overline: 'Who we are',
      title: 'We grew up with the sea next door',
      paragraphs: [
        'We are a small team with one thing in common: the sea. One of us was born on an island and never really left it. Another grew up moving from island to island, following a parent’s work — a different school, a different port, different beaches. Somewhere in there we learned the thing every local knows and no guidebook prints: which beach works when the wind is up, and which one does not.',
        'It has caught us out as visitors too: we drove an hour to a beach we had seen in a photo, and found it churning. So we map the shape of every shore — where the wind hits, where the land shelters — across the whole of Greece.',
        'That is where we need you: you know your beach better than any satellite.',
      ],
      pullQuote: 'No photo tells you what the sea is doing today.',
      signatureName: 'Miltos',
      signatureRole: 'from the CalmBeach team',
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
      searchNoResults: 'Wir haben nichts Passendes gefunden. Tipp auf Suchen.',
      searchNeedsPlace: 'Sag uns auch den Ort.',
      nearMe: 'In meiner Nähe',
      findingLocation: 'Standort wird ermittelt…',
    },
    today: {
      title: 'Wähle eine Region',
      subtitle: 'Danach suchen unsere Besucher am häufigsten. Öffne eine und sieh, wo es heute weht.',
      shelterSubtitle: 'Heute weht der Wind aus {wind}. Die Zahl zeigt, wie viele Strände jeder Region davor geschützt sind.',
      shelterSubtitleMixed: 'Heute weht der Wind je nach Region anders. Die Zahl zeigt, wie viele Strände in jeder geschützt sind.',
      windFrom: ['Norden', 'Nordosten', 'Osten', 'Südosten', 'Süden', 'Südwesten', 'Westen', 'Nordwesten'],
      shelterAria: '{region}: {count} von {total} Stränden vor dem heutigen Wind geschützt',
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
          title: 'Woher wir wissen, was es gibt',
          body: 'Amtliche Register, Satellit und Strände, an denen wir selbst waren. Jede Woche geht ein weiteres Stück der Karte erneut durch die Prüfung, von Hand. Im Zweifel lassen wir es weg: Eine Liege zu versprechen, die es nicht gibt, ist schlimmer, als sie gar nicht zu erwähnen.',
        },
        {
          title: 'Ruhm zählt hier nicht',
          body: 'Jeder Küstenabschnitt Griechenlands ist einzeln kartiert und wird stündlich neu beurteilt. Deshalb ist ein berühmter Strand nicht automatisch der bessere — und deshalb können zwei Strände nebeneinander am selben Tag unterschiedlich ausfallen.',
        },
        {
          title: 'Was wir (noch) nicht wissen',
          body: 'Strömungen, Felsen unter der Oberfläche, Quallen. Wir zeigen eine Vorhersage, keine Messung — deshalb geben wir eine Wellenspanne an und keine exakte Zahl. Achte vor Ort auf die Flaggen und den Rettungsschwimmer.',
        },
        {
          title: 'Wer uns bezahlt',
          body: 'Niemand kauft sich einen Platz in der Liste. Kein Strand, kein Betrieb, kein Hotel kann dafür zahlen, weiter oben zu stehen — die Reihenfolge ergibt sich aus dem Wetter und der Küste, aus nichts anderem.',
        },
      ],
      more: 'Wie CalmBeach funktioniert',
    },
    guides: {
      title: 'Artikel nach Region',
    },
    newsletter: {
      overline: 'Bevor du gehst',
      title: 'Willst du hören, woran wir bauen?',
      body: 'Ab und zu eine kurze E-Mail: was wir ergänzt, was wir korrigiert und was wir über das Wetter an den Stränden gelernt haben. Keine Angebote, und nicht jede Woche.',
      placeholder: 'name@example.com',
      inputLabel: 'Deine E-Mail',
      cta: 'Eintragen',
      sending: 'Wird gesendet…',
      success: 'Du stehst auf der Liste. Es kommt keine Bestätigungs-E-Mail — wir schreiben nur, wenn wir etwas zu sagen haben.',
      invalid: 'Prüf die Adresse — da fehlt etwas.',
      error: 'Etwas ist schiefgelaufen. Versuch es noch einmal oder schreib uns:',
      consent: 'Wir speichern nur deine E-Mail und nutzen sie ausschließlich für diese Nachrichten. Eine Zeile an uns und du bist wieder raus.',
    },
    photos: {
      badge: 'NEU',
      overline: 'Fotos von dir',
      title: 'Dein Foto ist besser als unseres',
      titleAccent: 'besser als unseres',
      body: 'Die Hälfte der Strände hier hat überhaupt kein Foto, und die anderen zeigen meistens das Meer aus der Ferne. Wenn du diesen Sommer da warst und ein gutes Bild hast, schick es uns — ohne Konto, ohne E-Mail. Es kommt auf die Strandseite.',
      steps: [
        { title: 'Strand aussuchen', body: 'Schreib den Namen, wir finden ihn.' },
        { title: 'Foto aussuchen', body: 'Schick es direkt vom Handy, so wie es ist.' },
        { title: 'Ein Mensch schaut es an', body: 'Es geht nicht von allein online. Wenn es gut ist, siehst du es auf der Strandseite.' },
      ],
      cta: 'Foto schicken',
      note: 'Ohne Konto erscheint das Foto als „von einem Besucher". Wenn du deinen Namen darunter möchtest, melde dich mit Google an.',
    },
    story: {
      overline: 'Wer wir sind',
      title: 'Wir sind mit dem Meer vor der Tür aufgewachsen',
      paragraphs: [
        'Wir sind ein kleines Team mit einer Gemeinsamkeit: dem Meer. Einer von uns ist auf einer Insel geboren und im Grunde nie weggegangen. Ein anderer ist von Insel zu Insel gezogen, wegen der Arbeit der Eltern — eine andere Schule, ein anderer Hafen, andere Strände. Irgendwo dabei haben wir gelernt, was jeder Einheimische weiß und in keinem Reiseführer steht: welcher Strand funktioniert, wenn es weht, und welcher nicht.',
        'Als Besucher hat es uns selbst erwischt: Wir fuhren eine Stunde zu einem Strand, den wir auf einem Foto gesehen hatten, und fanden ihn aufgewühlt vor. Deshalb kartieren wir die Form jeder Küste — wo der Wind auftrifft, wo das Land schützt — für ganz Griechenland.',
        // "Kantine" is a works/school canteen — the Greek καντίνα is a beach kiosk.
        'Genau da brauchen wir dich: Du kennst deinen Strand besser als jeder Satellit.',
      ],
      pullQuote: 'Kein Foto sagt dir, was das Meer heute macht.',
      signatureName: 'Miltos',
      signatureRole: 'aus dem CalmBeach-Team',
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
      searchNoResults: 'Nous n’avons rien trouvé de proche. Appuyez sur Rechercher.',
      searchNeedsPlace: 'Dites-nous aussi le lieu.',
      nearMe: 'Près de moi',
      findingLocation: 'Localisation en cours…',
    },
    today: {
      title: 'Choisissez une région',
      subtitle: 'Voilà ce que nos visiteurs cherchent le plus. Ouvrez-en une et voyez où ça souffle aujourd’hui.',
      shelterSubtitle: 'Aujourd’hui le vent vient {wind}. Le chiffre indique combien de plages de chaque région en sont abritées.',
      shelterSubtitleMixed: 'Aujourd’hui le vent change d’une région à l’autre. Le chiffre indique combien de plages sont abritées dans chacune.',
      // Contracté sur place («du nord», «de l’est») : la phrase ci-dessus ne peut pas porter
      // une préposition unique sans écorcher la moitié des directions.
      windFrom: ['du nord', 'du nord-est', 'de l’est', 'du sud-est', 'du sud', 'du sud-ouest', 'de l’ouest', 'du nord-ouest'],
      shelterAria: '{region} : {count} plages sur {total} abritées du vent d’aujourd’hui',
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
          title: 'Comment nous savons ce qui existe',
          body: 'Registres officiels, satellite et plages où nous sommes allés nous-mêmes. Chaque semaine, une nouvelle portion de la carte repasse au contrôle, à la main. En cas de doute, nous n’indiquons rien : promettre un transat qui n’existe pas est pire que de ne pas le mentionner du tout.',
        },
        {
          title: 'La réputation ne compte pas ici',
          body: 'Chaque portion de côte grecque est cartographiée séparément et réévaluée chaque heure. C’est pourquoi une plage célèbre n’est pas automatiquement la meilleure — et pourquoi deux plages voisines peuvent donner une réponse différente le même jour.',
        },
        {
          title: 'Ce que nous ne savons pas (encore)',
          body: 'Les courants, les rochers sous la surface, les méduses. Nous montrons une prévision, pas une mesure — d’où une fourchette de hauteur de vagues plutôt qu’un chiffre exact. Sur place, regardez les drapeaux et le maître-nageur.',
        },
        {
          title: 'Qui nous paie',
          body: 'Personne n’achète sa place dans la liste. Aucune plage, aucun commerce, aucun hôtel ne peut payer pour apparaître plus haut — l’ordre vient de la météo et de la côte, de rien d’autre.',
        },
      ],
      more: 'Comment fonctionne CalmBeach',
    },
    guides: {
      title: 'Articles par région',
    },
    newsletter: {
      overline: 'Avant de partir',
      title: 'Vous voulez savoir ce que nous construisons ?',
      body: 'Un court e-mail de temps en temps : ce que nous avons ajouté, ce que nous avons corrigé, ce que nous avons appris sur la météo des plages. Pas d’offres, et pas toutes les semaines.',
      placeholder: 'nom@exemple.com',
      inputLabel: 'Votre e-mail',
      cta: 'Je m’inscris',
      sending: 'Envoi…',
      success: 'Vous êtes sur la liste. Vous ne recevrez pas d’e-mail de confirmation — nous vous écrirons seulement quand nous aurons quelque chose à dire.',
      invalid: 'Vérifiez l’adresse — il manque quelque chose.',
      error: 'Quelque chose n’a pas fonctionné. Réessayez, ou écrivez-nous :',
      consent: 'Nous conservons uniquement votre e-mail et ne l’utilisons que pour ces messages. Une ligne et vous êtes retiré de la liste.',
    },
    photos: {
      badge: 'NOUVEAU',
      overline: 'Vos photos',
      title: 'Votre photo est meilleure que la nôtre',
      titleAccent: 'meilleure que la nôtre',
      body: "La moitié des plages ici n'ont aucune photo, et celles qui en ont montrent souvent la mer de loin. Si vous y êtes allé cet été et que vous avez une belle photo, envoyez-la-nous — sans compte, sans e-mail. Elle va sur la page de la plage.",
      steps: [
        { title: 'Choisissez la plage', body: 'Écrivez son nom, nous la trouvons.' },
        { title: 'Choisissez la photo', body: 'Envoyez-la telle quelle depuis votre téléphone.' },
        { title: 'Une personne la regarde', body: "Elle ne se publie pas toute seule. Si elle est belle, vous la verrez sur la page de la plage." },
      ],
      cta: 'Envoyer une photo',
      note: "Sans compte, la photo est créditée « d'un visiteur ». Si vous voulez votre nom en dessous, connectez-vous avec Google.",
    },
    story: {
      overline: 'Qui nous sommes',
      title: 'Nous avons grandi avec la mer à côté',
      paragraphs: [
        'Nous sommes une petite équipe avec un point commun : la mer. L’un de nous est né sur une île et n’en est jamais vraiment parti. Un autre a grandi en changeant d’île, à cause du travail de ses parents — une autre école, un autre port, d’autres plages. C’est là que nous avons appris ce que sait chaque habitant et qu’aucun guide n’imprime : quelle plage marche quand il vente, et laquelle non.',
        'Cela nous est arrivé aussi, en tant que visiteurs : nous avons roulé une heure pour une plage vue en photo, et nous l’avons trouvée agitée. C’est pourquoi nous cartographions la forme de chaque côte — où le vent frappe, où la terre abrite — pour toute la Grèce.',
        // "cantine" is a school/works canteen in French — a beach καντίνα is a buvette.
        'C’est là que nous avons besoin de vous : vous connaissez votre plage mieux que n’importe quel satellite.',
      ],
      pullQuote: 'Aucune photo ne vous dit ce que la mer fait aujourd’hui.',
      signatureName: 'Miltos',
      signatureRole: 'de l’équipe CalmBeach',
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
      searchNoResults: 'Non abbiamo trovato niente di simile. Premi Cerca.',
      searchNeedsPlace: 'Dicci anche il posto.',
      nearMe: 'Vicino a me',
      findingLocation: 'Ricerca della posizione…',
    },
    today: {
      title: 'Scegli una regione',
      subtitle: 'Queste sono le più cercate dai nostri visitatori. Aprine una e guarda dove tira vento oggi.',
      shelterSubtitle: 'Oggi il vento arriva da {wind}. Il numero dice quante spiagge di ogni regione ne sono riparate.',
      shelterSubtitleMixed: 'Oggi il vento cambia da regione a regione. Il numero dice quante spiagge sono riparate in ciascuna.',
      windFrom: ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ovest', 'ovest', 'nord-ovest'],
      shelterAria: '{region}: {count} spiagge su {total} riparate dal vento di oggi',
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
          title: 'Come sappiamo che cosa c’è',
          body: 'Registri ufficiali, satellite e spiagge che abbiamo visitato di persona. Ogni settimana un altro pezzo della mappa torna sotto controllo, a mano. Nel dubbio, non lo scriviamo: promettere un lettino che non c’è è peggio che non menzionarlo affatto.',
        },
        {
          title: 'La fama qui non conta',
          body: 'Ogni tratto di costa greca è mappato singolarmente e viene rivalutato ogni ora. Per questo una spiaggia famosa non è automaticamente la migliore — e per questo due spiagge vicine possono dare una risposta diversa nello stesso giorno.',
        },
        {
          title: 'Cosa non sappiamo (ancora)',
          body: 'Le correnti, gli scogli sotto la superficie, le meduse. Mostriamo una previsione, non una misura — per questo diamo un intervallo di altezza delle onde e non un numero esatto. Sul posto, guarda le bandiere e il bagnino.',
        },
        {
          title: 'Chi ci paga',
          body: 'Nessuno compra un posto nella lista. Nessuna spiaggia, nessun locale, nessun hotel può pagare per stare più in alto — l’ordine nasce dal meteo e dalla costa, da nient’altro.',
        },
      ],
      more: 'Come funziona CalmBeach',
    },
    guides: {
      title: 'Articoli per regione',
    },
    newsletter: {
      overline: 'Prima di andare',
      title: 'Vuoi sapere cosa stiamo costruendo?',
      body: 'Ogni tanto una mail breve: cosa abbiamo aggiunto, cosa abbiamo corretto, cosa abbiamo imparato sul meteo delle spiagge. Niente offerte, e non ogni settimana.',
      placeholder: 'nome@esempio.com',
      inputLabel: 'La tua email',
      cta: 'Iscrivimi',
      sending: 'Invio…',
      success: 'Sei nella lista. Non arriverà nessuna email di conferma — ti scriviamo solo quando abbiamo qualcosa da dire.',
      invalid: 'Controlla l’indirizzo — manca qualcosa.',
      error: 'Qualcosa è andato storto. Riprova, oppure scrivici:',
      consent: 'Conserviamo solo la tua email e la usiamo soltanto per questi messaggi. Basta una riga e ti togliamo dalla lista.',
    },
    photos: {
      badge: 'NUOVO',
      overline: 'Le tue foto',
      title: 'La tua foto è migliore della nostra',
      titleAccent: 'migliore della nostra',
      body: 'Metà delle spiagge qui non ha nessuna foto, e quelle che ce l’hanno mostrano di solito il mare da lontano. Se ci sei stato quest’estate e hai una foto bella, mandacela — senza account, senza email. Finisce sulla pagina della spiaggia.',
      steps: [
        { title: 'Scegli la spiaggia', body: 'Scrivi il nome e la troviamo noi.' },
        { title: 'Scegli la foto', body: 'Mandala dal telefono così com’è.' },
        { title: 'La guarda una persona', body: 'Non va online da sola. Se è bella, la vedrai sulla pagina della spiaggia.' },
      ],
      cta: 'Manda una foto',
      note: 'Senza account la foto è accreditata «da un visitatore». Se vuoi il tuo nome sotto, accedi con Google.',
    },
    story: {
      overline: 'Chi siamo',
      title: 'Siamo cresciuti con il mare accanto',
      paragraphs: [
        'Siamo un piccolo team con una cosa in comune: il mare. Uno di noi è nato su un’isola e in fondo non è mai andato via. Un altro è cresciuto cambiando isola, per il lavoro dei genitori — un’altra scuola, un altro porto, altre spiagge. È lì che abbiamo imparato quello che sa ogni abitante e che nessuna guida scrive: quale spiaggia funziona quando tira vento, e quale no.',
        'È capitato anche a noi, come visitatori: abbiamo guidato un’ora per una spiaggia vista in foto, e l’abbiamo trovata mossa. Per questo mappiamo la forma di ogni costa — dove batte il vento, dove ripara la terra — per tutta la Grecia.',
        'È lì che abbiamo bisogno di te: la tua spiaggia la conosci meglio di qualsiasi satellite.',
      ],
      pullQuote: 'Nessuna foto ti dice cosa fa il mare oggi.',
      signatureName: 'Miltos',
      signatureRole: 'dal team di CalmBeach',
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
