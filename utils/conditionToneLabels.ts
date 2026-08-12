import type { LanguageCode } from '../types';
import type { CalmnessTone } from './suitabilityTone';

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
