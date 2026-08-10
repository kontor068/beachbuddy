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
 */
export interface ConditionToneWords {
  label: string;
  meaning: string;
}

export const conditionToneLabels: Record<LanguageCode, Record<CalmnessTone, ConditionToneWords>> = {
  en: {
    blue: { label: 'Excellent', meaning: 'Light wind, flat water' },
    yellow: { label: 'Good', meaning: 'A little breeze or ripple' },
    orange: { label: 'Fair', meaning: 'Noticeable wind or waves' },
    red: { label: 'Difficult', meaning: 'Strong wind or big waves' },
  },
  gr: {
    blue: { label: 'Ιδανική', meaning: 'Λίγος αέρας, ήρεμο νερό' },
    yellow: { label: 'Καλή', meaning: 'Λίγο αεράκι ή κυματάκι' },
    orange: { label: 'Μέτρια', meaning: 'Αισθητός αέρας ή κύμα' },
    red: { label: 'Δύσκολη', meaning: 'Δυνατός αέρας ή μεγάλο κύμα' },
  },
  fr: {
    blue: { label: 'Idéale', meaning: 'Peu de vent, eau plate' },
    yellow: { label: 'Bonne', meaning: 'Un peu de brise ou de clapot' },
    orange: { label: 'Correcte', meaning: 'Vent ou vagues sensibles' },
    red: { label: 'Difficile', meaning: 'Vent fort ou grosses vagues' },
  },
  de: {
    blue: { label: 'Ideal', meaning: 'Wenig Wind, ruhiges Wasser' },
    yellow: { label: 'Gut', meaning: 'Etwas Brise oder Kräuselwellen' },
    orange: { label: 'Mäßig', meaning: 'Spürbarer Wind oder Wellen' },
    red: { label: 'Schwierig', meaning: 'Starker Wind oder hohe Wellen' },
  },
  it: {
    blue: { label: 'Ideale', meaning: 'Poco vento, acqua piatta' },
    yellow: { label: 'Buona', meaning: 'Un po\' di brezza o increspature' },
    orange: { label: 'Discreta', meaning: 'Vento o onde percettibili' },
    red: { label: 'Difficile', meaning: 'Vento forte o onde alte' },
  },
};

/** The word for a tone, in one language. Falls back to English for an unknown locale. */
export const conditionToneLabel = (tone: CalmnessTone, language: LanguageCode): string =>
  (conditionToneLabels[language] ?? conditionToneLabels.en)[tone].label;
