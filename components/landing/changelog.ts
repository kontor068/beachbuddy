import type { LanguageCode } from '../../types';

/**
 * ΤΟ ΗΜΕΡΟΛΟΓΙΟ ΔΟΥΛΕΙΑΣ — τι φτιάξαμε τελευταία, με λόγια για τον επισκέπτη.
 *
 * ΧΕΙΡΟΓΡΑΦΟ, όχι από τα git commits (απόφαση 04/09/2026, «ο σκεπτικιστής»): τα commits
 * λένε ΠΩΣ το κάναμε, με τεχνικές λέξεις και εσωτερικά· εδώ γράφουμε ΤΙ ΚΕΡΔΙΖΕΙ ο επισκέπτης,
 * σε μία πρόταση. Κανόνας: η εγγραφή μπαίνει στο ΙΔΙΟ PR που βγάζει το πράγμα live — όχι
 * «αργότερα», γιατί αργότερα δεν έρχεται.
 *
 * Γλώσσες: ελληνικά και αγγλικά υποχρεωτικά· γερμανικά, γαλλικά, ιταλικά προαιρετικά, αλλιώς
 * πέφτουν στα αγγλικά. Πιο πρόσφατο ΠΡΩΤΟ. Η landing δείχνει τα 3 πρώτα, «όλα τα νέα» ανοίγει
 * ως 12· το footer δείχνει μόνο το πρώτο.
 */
export type ChangelogTag = 'new' | 'improved' | 'beta' | 'measured';

export type ChangelogEntry = {
  /** ISO ημερομηνία (YYYY-MM-DD) της ημέρας που βγήκε live. */
  date: string;
  tag: ChangelogTag;
  text: { gr: string; en: string } & Partial<Record<LanguageCode, string>>;
  /** Λίγες λέξεις για τη γραμμή του footer (αλλιώς μπαίνει όλο το κείμενο). */
  short?: { gr: string; en: string } & Partial<Record<LanguageCode, string>>;
  /** Προαιρετικά: η περιοχή που αφορά — γίνεται σύνδεσμος στη σελίδα της. */
  regionId?: string;
  regionName?: { gr: string; en: string } & Partial<Record<LanguageCode, string>>;
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: '2026-09-04',
    tag: 'beta',
    text: {
      gr: 'Η παραλία σε κίνηση: πάτα play στην πινέζα του χάρτη και δες πώς πέφτει το κύμα και ο άνεμος στην ακτή αυτή την ώρα, με το πραγματικό ανάγλυφο γύρω της. Πιλοτικά στη Θεσπρωτία.',
      en: 'The beach in motion: press play on a map pin and watch how this hour’s waves and wind hit the shore, with the real terrain around it. Piloting in Thesprotia.',
    },
    short: { gr: 'Η παραλία σε κίνηση (beta, Θεσπρωτία)', en: 'The beach in motion (beta, Thesprotia)' },
    regionId: 'epirus-thesprotia-mainland',
    regionName: { gr: 'Θεσπρωτία', en: 'Thesprotia' },
  },
  {
    date: '2026-09-02',
    tag: 'improved',
    text: {
      gr: 'Οι φωτογραφίες σας ανοίγουν σε μεγέθυνση, και οι κάρτες σταματούν να δείχνουν ουρανό αντί για θάλασσα.',
      en: 'Your photos now open full-size, and the cards stop cropping to sky instead of sea.',
    },
  },
  {
    date: '2026-08-29',
    tag: 'improved',
    text: {
      gr: 'Η λωρίδα «περιοχές σήμερα» στην αρχική κατατάσσει τις περιοχές με το πόσες παραλίες τους είναι προστατευμένες από τον άνεμο που φυσάει τώρα.',
      en: 'The “regions today” strip on the home page now ranks regions by how many of their beaches are sheltered from the wind blowing right now.',
    },
  },
  {
    date: '2026-08-27',
    tag: 'measured',
    text: {
      gr: 'Δοκιμάσαμε αν το κύμα μπορεί να διορθώσει τον άνεμο στην άμμο, σε 25 ανεμόμετρα αεροδρομίων επί 92 μέρες. Δεν μπορεί — άρα δεν μπήκε.',
      en: 'We tested whether the wave can correct the wind on the sand, against 25 airport anemometers over 92 days. It can’t — so it didn’t ship.',
    },
  },
];

/** Η πιο πρόσφατη εγγραφή — για τη γραμμή του footer. */
export const latestChangelogEntry = (): ChangelogEntry => CHANGELOG[0];

export const changelogText = (entry: ChangelogEntry, language: LanguageCode): string =>
  entry.text[language] ?? entry.text.en;

/** Η σύντομη μορφή για το footer: `short` αν υπάρχει, αλλιώς το πλήρες κείμενο. */
export const changelogShort = (entry: ChangelogEntry, language: LanguageCode): string =>
  entry.short ? entry.short[language] ?? entry.short.en : changelogText(entry, language);

export const changelogRegionName = (entry: ChangelogEntry, language: LanguageCode): string | undefined =>
  entry.regionName ? entry.regionName[language] ?? entry.regionName.en : undefined;

const LOCALE: Record<LanguageCode, string> = { gr: 'el-GR', en: 'en-GB', de: 'de-DE', fr: 'fr-FR', it: 'it-IT' };

/** «4 Σεπ» μέσα στη χρονιά, «4 Σεπ 2025» αν είναι άλλη χρονιά. */
export const formatChangelogDate = (isoDate: string, language: LanguageCode, todayIso: string): string => {
  const date = new Date(`${isoDate}T12:00:00Z`);
  const sameYear = isoDate.slice(0, 4) === todayIso.slice(0, 4);
  try {
    return new Intl.DateTimeFormat(LOCALE[language] ?? 'en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }), timeZone: 'UTC' }).format(date);
  } catch {
    return isoDate;
  }
};

/** Πόσες μέρες πριν από «σήμερα» (Αθήνα) βγήκε — για τη φράση «πριν από X μέρες». */
export const daysSince = (isoDate: string, todayIso: string): number => {
  const a = Date.UTC(Number(isoDate.slice(0, 4)), Number(isoDate.slice(5, 7)) - 1, Number(isoDate.slice(8, 10)));
  const b = Date.UTC(Number(todayIso.slice(0, 4)), Number(todayIso.slice(5, 7)) - 1, Number(todayIso.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
};

/**
 * Η ΣΧΕΤΙΚΗ ΗΜΕΡΟΜΗΝΙΑ ΜΟΝΟ ΩΣ 30 ΜΕΡΕΣ (ο σκεπτικιστής, 04/09/2026): «ενημερώθηκε πριν από
 * 3 μέρες» λέει «ζει»· «πριν από 4 μήνες» λέει το αντίθετο. Τον χειμώνα, που βγαίνει λιγότερο,
 * μένει μόνο η ημερομηνία δίπλα σε κάθε εγγραφή, χωρίς φράση.
 */
export const FRESHNESS_MAX_DAYS = 30;
