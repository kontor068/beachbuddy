import type { LanguageCode } from '../types';
import type { CalmnessTone } from './suitabilityTone';
import type { CauseLineForm } from './conditionCause';
import type { OffshoreWindNoteForm } from './offshoreWindNote';

/**
 * THE ONE VOCABULARY FOR A CONDITION COLOUR.
 *
 * Read by the map legend (components/BeachMap.tsx) and asserted by
 * scripts/validateConditionToneAgreement.mjs, which fails if any colour the ladder can paint has
 * no word here in all five languages. The words used to live inline in BeachMap; they were
 * pulled out so the gate could read the real table instead of regex-scraping JSX, which also
 * catches an EMPTY word rather than only a missing key.
 *
 * WHAT THIS FILE ALSO RECORDS (05/08/2026) — the beach card deliberately does NOT use it.
 *
 * A card was briefly given a chip showing its pin's word here, to fix a genuine defect: the card
 * printed a word from `getExperienceTier`, which grades the whole outing (it folds in access,
 * parking and amenities) while the colour grades only the sea, so on Corfu at 1 Bft the legend
 * read «Ιδανική 105» over fourteen cards reading «Μέτρια». No gate caught that —
 * validateVerdictConsistency explicitly permits the word to read more cautiously than the dot
 * (29,3% of its grid does); that rule exists to stop the word being more OPTIMISTIC.
 *
 * The chip removed the contradiction and Miltos removed the chip: on a settled day it put the
 * same word on a hundred cards, which is noise, and the card already carries the amenity icons
 * that actually distinguish one beach from another. So the card shows no condition word at all,
 * and the colour is read from the map. If that decision is ever revisited, the honest fix starts
 * here — never by letting the card grade the day itself again.
 *
 * `meaning` is the legend's one-line explanation of what separates this colour from the one
 * above it. Deliberately phrased as "wind OR sea": since the sea-state ceiling landed
 * (01/08/2026) a beach can be orange on a light-wind day, so any wording tied to a Beaufort
 * band would be the old, wrong legend again.
 *
 * SINCE 15/08/2026 THE PHONE NO LONGER PRINTS ALL FOUR AT ONCE — THE DESKTOP STILL DOES.
 * Four colours meant four of these sentences stacked under four numbers, and on a phone that
 * is eight lines of text to deliver four numbers, directly above the beach cards. Miltos's
 * call, and the split is deliberate rather than a compromise: a wide screen has the room and
 * an explanation costs it nothing, while a phone has to choose between explaining the scale
 * and showing the beaches. So the phone shows the colour word and the count, and reveals a
 * `meaning` the moment a single colour is left (a filter is picked, or the map paints only
 * one); the desktop keeps all four visible with no tap required.
 *
 * Do NOT delete these strings because one screen size stopped showing four of them: they are
 * what the desktop legend and the filtered phone legend print, and `red.meaning` is read by
 * scripts/validateConditionsFeelPhrase.ts, which ties it to the beach card's own worst-case
 * phrase.
 *
 * KEEP IT TO THE CAUSE, NOT THE ADVICE (10/08/2026). It used to carry a second clause — «κολυμπάς
 * άνετα», «για μια βουτιά ναι, για ώρες όχι» — and those clauses are what forced the legend into
 * four full-width rows stacked down a phone screen. The rows now sit two-up (four on a wide
 * screen), so every word here has to survive a column half the screen wide. The cause alone
 * separates the colours; the advice is already in the verdict on the card and the detail page.
 *
 * THE NUMBER HAS TO SAY WHAT IT COUNTS (12/08/2026). The row used to read «Ιδανική 4»: a singular
 * adjective next to a bare number, which readers took for a rating out of ten, a rank, or a
 * distance — anything but "four beaches". `countOne`/`countMany` carry the whole phrase instead,
 * so the row reads «Ιδανική 1 παραλία» / «Ιδανικές 4 παραλίες» and the number is unambiguous.
 * `{n}` is where the count goes; it is NOT interchangeable with `label`, because Greek, French and
 * Italian all inflect the adjective for the plural and German needs the noun's own plural form —
 * that is why each language spells both phrases out rather than gluing `label` to a noun.
 * `label` stays as the bare colour word: it is the single-beach vocabulary the gate asserts.
 */
export interface ConditionToneWords {
  label: string;
  meaning: string;
  /** Countable phrase for exactly one beach. `{n}` is replaced by the count. */
  countOne: string;
  /** Countable phrase for zero or many beaches. `{n}` is replaced by the count. */
  countMany: string;
}

export const conditionToneLabels: Record<LanguageCode, Record<CalmnessTone, ConditionToneWords>> = {
  en: {
    blue: { label: 'Excellent', meaning: 'Light wind, flat water', countOne: '{n} excellent beach', countMany: '{n} excellent beaches' },
    yellow: { label: 'Good', meaning: 'A little breeze or ripple', countOne: '{n} good beach', countMany: '{n} good beaches' },
    orange: { label: 'Fair', meaning: 'Noticeable wind or waves', countOne: '{n} fair beach', countMany: '{n} fair beaches' },
    red: { label: 'Difficult', meaning: 'Strong wind or big waves', countOne: '{n} difficult beach', countMany: '{n} difficult beaches' },
  },
  gr: {
    blue: { label: 'Ιδανική', meaning: 'Λίγος αέρας, ήρεμο νερό', countOne: 'Ιδανική {n} παραλία', countMany: 'Ιδανικές {n} παραλίες' },
    yellow: { label: 'Καλή', meaning: 'Λίγο αεράκι ή κυματάκι', countOne: 'Καλή {n} παραλία', countMany: 'Καλές {n} παραλίες' },
    orange: { label: 'Μέτρια', meaning: 'Αισθητός αέρας ή κύμα', countOne: 'Μέτρια {n} παραλία', countMany: 'Μέτριες {n} παραλίες' },
    red: { label: 'Δύσκολη', meaning: 'Δυνατός αέρας ή μεγάλο κύμα', countOne: 'Δύσκολη {n} παραλία', countMany: 'Δύσκολες {n} παραλίες' },
  },
  fr: {
    blue: { label: 'Idéale', meaning: 'Peu de vent, eau plate', countOne: '{n} plage idéale', countMany: '{n} plages idéales' },
    yellow: { label: 'Bonne', meaning: 'Un peu de brise ou de clapot', countOne: '{n} bonne plage', countMany: '{n} bonnes plages' },
    orange: { label: 'Correcte', meaning: 'Vent ou vagues sensibles', countOne: '{n} plage correcte', countMany: '{n} plages correctes' },
    red: { label: 'Difficile', meaning: 'Vent fort ou grosses vagues', countOne: '{n} plage difficile', countMany: '{n} plages difficiles' },
  },
  de: {
    blue: { label: 'Ideal', meaning: 'Wenig Wind, ruhiges Wasser', countOne: '{n} idealer Strand', countMany: '{n} ideale Strände' },
    yellow: { label: 'Gut', meaning: 'Etwas Brise oder Kräuselwellen', countOne: '{n} guter Strand', countMany: '{n} gute Strände' },
    orange: { label: 'Mäßig', meaning: 'Spürbarer Wind oder Wellen', countOne: '{n} mäßiger Strand', countMany: '{n} mäßige Strände' },
    red: { label: 'Schwierig', meaning: 'Starker Wind oder hohe Wellen', countOne: '{n} schwieriger Strand', countMany: '{n} schwierige Strände' },
  },
  it: {
    blue: { label: 'Ideale', meaning: 'Poco vento, acqua piatta', countOne: '{n} spiaggia ideale', countMany: '{n} spiagge ideali' },
    yellow: { label: 'Buona', meaning: 'Un po\' di brezza o increspature', countOne: '{n} spiaggia buona', countMany: '{n} spiagge buone' },
    orange: { label: 'Discreta', meaning: 'Vento o onde percettibili', countOne: '{n} spiaggia discreta', countMany: '{n} spiagge discrete' },
    red: { label: 'Difficile', meaning: 'Vento forte o onde alte', countOne: '{n} spiaggia difficile', countMany: '{n} spiagge difficili' },
  },
};

/**
 * The legend row's full phrase — «Ιδανικές 4 παραλίες» — with the count already substituted.
 *
 * Returns the two halves around the number as well, so a caller can keep the number visually
 * bold without re-parsing the sentence: in Greek the digit sits in the middle of the phrase, in
 * English and German at the front, so a hard-coded "adjective then number" split would break.
 */
export const conditionToneCountPhrase = (
  tone: CalmnessTone,
  language: LanguageCode,
  count: number,
): { text: string; before: string; after: string } => {
  const words = (conditionToneLabels[language] ?? conditionToneLabels.en)[tone];
  const template = count === 1 ? words.countOne : words.countMany;
  const [before = '', after = ''] = template.split('{n}');
  return { text: template.replace('{n}', String(count)), before, after };
};

/** The word for a tone, in one language. Falls back to English for an unknown locale. */
export const conditionToneLabel = (tone: CalmnessTone, language: LanguageCode): string =>
  (conditionToneLabels[language] ?? conditionToneLabels.en)[tone].label;

/**
 * WHAT PUT THIS COLOUR HERE — the cause line (15/08/2026).
 *
 * `meaning` above says «Αισθητός αέρας **ή** κύμα», and the «ή» is the whole problem: the reader
 * has to guess which, and they guess wave. «Όταν βλέπει πορτοκαλί θεωρεί ότι θα έχει πολύ κύμα»
 * (Μίλτος). These strings answer it for the beaches actually on screen at that hour — see
 * utils/conditionCause for which form a colour group earns, and when it earns silence instead.
 *
 * TWO LENGTHS, ONE MEANING. `short` sits inside the chip, in a ~150 px cell at 10 px — about 28
 * characters, which is why every language is checked against CAUSE_LINE_MAX_SHORT_CHARS and why
 * the French and Italian wordings are shorter than a literal translation would be. `full` is the
 * sentence under a chip the reader has actually tapped, where there is room to say the whole
 * thing.
 *
 * THREE RULES THESE WORDS MUST KEEP, all enforced by
 * scripts/validateConditionToneAgreement.mjs (`a-cause-line-never-reassures`):
 *   1. Every string names the wind or the sea. A cause that names neither is not a cause.
 *   2. NO VERDICT WORDS — «ιδανικ/κατάλληλ/απόφυγ/προσοχή/καλύτερ» and their siblings. The line
 *      explains the colour; it must never quietly become a second verdict beside it
 *      (scripts/validateConditionsFeelPhrase.ts owns that vocabulary).
 *   3. `wind-pulls-out` NEVER claims calm water on its own. Its short form does not mention the
 *      water at all, and its long form only reaches it after the warning is already made — the
 *      one standalone «the sea is flat» claim in this app belongs to the card, about ONE beach,
 *      with the number printed beside it.
 */
export interface CauseLineWords {
  /** Inside the chip. Must stay under CAUSE_LINE_MAX_SHORT_CHARS in every language. */
  short: string;
  /** Under a chip the reader has filtered to — a full sentence. */
  full: string;
}

/**
 * The measured width of the chip's inner cell: ~150 px at 10 px ≈ 28 characters, plus two for the
 * languages that need a breath. A string over this does not wrap — it pushes the chip's own count
 * off its line, which is the number the whole legend exists to show.
 */
export const CAUSE_LINE_MAX_SHORT_CHARS = 30;

/**
 * The key set is `CauseLineForm` itself, imported rather than restated: a form added to the rule
 * that has no words here becomes a compiler error instead of an empty line on someone's phone.
 */
export const causeLineLabels: Record<LanguageCode, Record<CauseLineForm, CauseLineWords>> = {
  en: {
    'wind-not-wave': { short: "It's the wind, not the waves", full: 'The colour comes from the wind — the sea here is calm.' },
    'wind-pulls-out': { short: 'Wind pushes you offshore', full: "The colour comes from the wind. The water is calm, but the wind pushes you offshore — don't stay in long." },
    'wave-not-wind': { short: 'The waves, not the wind', full: 'The colour comes from the sea — there is little wind here.' },
    split: { short: '{wind} wind · {sea} waves', full: "On {wind} it's the wind, on {sea} the sea." },
  },
  gr: {
    'wind-not-wave': { short: 'Φταίει ο αέρας, όχι το κύμα', full: 'Το χρώμα το φέρνει ο αέρας — η θάλασσα εδώ είναι ήρεμη.' },
    'wind-pulls-out': { short: 'Ο αέρας σε τραβάει ανοιχτά', full: 'Το χρώμα το φέρνει ο αέρας. Το νερό είναι ήρεμο, όμως ο αέρας σε τραβάει ανοιχτά — μη μείνεις ώρα μέσα.' },
    'wave-not-wind': { short: 'Φταίει το κύμα, όχι ο αέρας', full: 'Το χρώμα το φέρνει η θάλασσα — ο αέρας εδώ είναι λίγος.' },
    split: { short: '{wind} από αέρα · {sea} από κύμα', full: 'Σε {wind} το φέρνει ο αέρας, σε {sea} η θάλασσα.' },
  },
  fr: {
    'wind-not-wave': { short: 'Le vent, pas les vagues', full: 'La couleur vient du vent — la mer est calme ici.' },
    'wind-pulls-out': { short: 'Le vent pousse au large', full: "La couleur vient du vent. L'eau est calme, mais le vent pousse au large — ne restez pas longtemps." },
    'wave-not-wind': { short: 'Les vagues, pas le vent', full: 'La couleur vient de la mer — il y a peu de vent ici.' },
    split: { short: '{wind} vent · {sea} vagues', full: "Sur {wind} c'est le vent, sur {sea} la mer." },
  },
  de: {
    'wind-not-wave': { short: 'Der Wind, nicht die Wellen', full: 'Die Farbe kommt vom Wind — das Meer ist hier ruhig.' },
    'wind-pulls-out': { short: 'Wind drückt aufs Meer hinaus', full: 'Die Farbe kommt vom Wind. Das Wasser ist ruhig, aber der Wind drückt aufs offene Meer — bleib nicht lange drin.' },
    'wave-not-wind': { short: 'Die Wellen, nicht der Wind', full: 'Die Farbe kommt vom Meer — der Wind ist hier schwach.' },
    split: { short: '{wind} Wind · {sea} Wellen', full: 'Bei {wind} der Wind, bei {sea} das Meer.' },
  },
  it: {
    'wind-not-wave': { short: 'È il vento, non le onde', full: 'Il colore viene dal vento — qui il mare è calmo.' },
    'wind-pulls-out': { short: 'Il vento spinge al largo', full: "Il colore viene dal vento. L'acqua è calma, ma il vento spinge al largo — non restare a lungo." },
    'wave-not-wind': { short: 'Sono le onde, non il vento', full: 'Il colore viene dal mare — qui c\'è poco vento.' },
    split: { short: '{wind} vento · {sea} onde', full: 'Su {wind} il vento, su {sea} il mare.' },
  },
};

/**
 * The cause line for one colour group, with the split counts already substituted.
 *
 * `counts` is only read by the `split` wording; the other three forms speak about the group as a
 * whole and deliberately carry no number — the wave height is this app's weakest figure, and the
 * word «κύμα» survives an error in it that a decimal would not.
 */
export const causeLinePhrase = (
  form: CauseLineForm,
  language: LanguageCode,
  counts?: { wind: number; sea: number },
): CauseLineWords => {
  const words = (causeLineLabels[language] ?? causeLineLabels.en)[form];
  const fill = (text: string): string => text
    .replace('{wind}', String(counts?.wind ?? 0))
    .replace('{sea}', String(counts?.sea ?? 0));
  return { short: fill(words.short), full: fill(words.full) };
};

/**
 * Η ΓΡΑΜΜΗ ΤΟΥ ΑΠΟΓΕΙΟΥ ΑΝΕΜΟΥ, ΔΙΠΛΑ ΣΤΟΝ ΑΡΙΘΜΟ ΤΟΥ ΚΥΜΑΤΟΣ (21/08/2026).
 *
 * Ζει εδώ και όχι σε δικό της αρχείο επειδή είναι ΤΡΙΤΟ μη-βαθμολογικό κανάλι της ίδιας
 * οικογένειας με το `causeLineLabels` — και τα δύο εξηγούν κάτι που η οθόνη δείχνει χωρίς να το
 * λέει. Η διαφορά: το `causeLine` εξηγεί το ΧΡΩΜΑ (και μόνο σε πορτοκαλί/κόκκινο, απόφαση Μίλτου
 * 15/08), ενώ αυτή εξηγεί τον ΑΡΙΘΜΟ — που είναι αυτό που κοίταξε ο Μίλτος και τις δύο φορές που
 * ανέφερε τη Λυγαριά (16/08 και 21/08) και το οποίο κανένα υπάρχον κανάλι δεν άγγιζε.
 *
 * ⚠️ ΤΟ ΔΕΥΤΕΡΟ ΜΙΣΟ ΤΗΣ ΔΕΥΤΕΡΗΣ ΦΡΑΣΗΣ ΕΙΝΑΙ ΥΠΟΧΡΕΩΤΙΚΟ, ΟΧΙ ΣΤΟΛΙΔΙ. Η βίβλος (§Μ2) κρατάει
 * ανοιχτή εκκρεμότητα τη γραμμή «ο αέρας σε βγάζει στα ανοιχτά» — ΙΔΙΑ συνθήκη με αυτήν εδώ —
 * και τη λέει «πιο επείγουσα, γιατί οι παραλίες που κερδίζουν θέση με απόγειο άνεμο είναι ακριβώς
 * αυτές όπου ένα φουσκωτό φεύγει». Καθησυχαστικό μισό χωρίς το προειδοποιητικό = μονόπλευρη
 * ανάγνωση της ίδιας μέτρησης. Μην αφαιρεθεί χωρίς νέα απόφαση.
 */
export const offshoreWindNoteLabels: Record<LanguageCode, Record<OffshoreWindNoteForm, string>> = {
  en: {
    'calmer-than-the-number': "The wind blows off the land — the water in front of you is calmer than the figure suggests.",
    'calmer-but-pulls-out': "The wind blows off the land: the water is calmer than the figure suggests — but on a lilo or dinghy it will carry you out.",
  },
  gr: {
    'calmer-than-the-number': "Ο αέρας έρχεται από τη στεριά — μπροστά σου το νερό είναι πιο ήρεμο απ’ ό,τι λέει ο αριθμός.",
    'calmer-but-pulls-out': "Ο αέρας έρχεται από τη στεριά: το νερό είναι πιο ήρεμο απ’ ό,τι λέει ο αριθμός — αλλά με στρώμα ή φουσκωτό σε βγάζει ανοιχτά.",
  },
  fr: {
    'calmer-than-the-number': "Le vent souffle de la terre — l’eau devant vous est plus calme que ne l’indique le chiffre.",
    'calmer-but-pulls-out': "Le vent souffle de la terre : l’eau est plus calme que ne l’indique le chiffre — mais sur un matelas ou un canot, il vous emporte au large.",
  },
  de: {
    'calmer-than-the-number': "Der Wind kommt vom Land — das Wasser vor dir ist ruhiger, als die Zahl vermuten lässt.",
    'calmer-but-pulls-out': "Der Wind kommt vom Land: Das Wasser ist ruhiger, als die Zahl vermuten lässt — aber auf Luftmatratze oder Schlauchboot treibt er dich aufs offene Meer.",
  },
  it: {
    'calmer-than-the-number': "Il vento soffia da terra — l’acqua davanti a te è più calma di quanto dica il numero.",
    'calmer-but-pulls-out': "Il vento soffia da terra: l’acqua è più calma di quanto dica il numero — ma su un materassino o un gommone ti porta al largo.",
  },
};

/** Η φράση για μία μορφή, με πτώση στα αγγλικά αν λείπει γλώσσα — ίδιο μοτίβο με το causeLinePhrase. */
export const offshoreWindNotePhrase = (form: OffshoreWindNoteForm, language: LanguageCode): string =>
  (offshoreWindNoteLabels[language] ?? offshoreWindNoteLabels.en)[form];
