/**
 * CalmBeach Certified — the house seal (Miltos 2026-07-22).
 *
 * A beach earns this badge ONLY when we have physically been there and confirmed, on
 * the ground, that its stored characteristics (shelter, amenities, access, water) match
 * reality. It is a personal, FIRST-PARTY guarantee — not derived from OSM, Google or any
 * model — so it must stay small and 100% honest (reliability mandate): never add an id
 * you have not visited yourself. A false "we were there" claim is far worse than an
 * absent badge and would poison the credibility the seal is meant to build.
 *
 * Single source of truth, consumed through pure predicates so it is safe in render/filter
 * hot paths. Curated exactly like the enclosedCoves / naturistBeaches doctrine — no build
 * step and no data rebuild: add an id here and the badge lights up everywhere a beach card
 * or the detail page renders (the card already has `beach.id`, so nothing needs threading).
 */

import type { LanguageCode } from '../types';

/** A note translated per UI language. Provide as many locales as you can; the renderer
 *  falls back gr -> en -> whatever is available, so a Greek-only note never breaks. */
export type LocalizedNote = Partial<Record<LanguageCode, string>>;

export interface BeachCertification {
  /**
   * When we verified it on the ground, ISO `YYYY-MM` (a full `YYYY-MM-DD` is fine too).
   * Time-stamps the claim and powers the "verified on site" line on the detail page.
   */
  visitedOn: string;
  /** Optional first-person note about what we found on site, shown on the detail page.
   *  Localized so it renders in the visitor's chosen language. */
  note?: LocalizedNote;
}

// id -> certification. Keep this tiny and evidence-backed: you were physically there.
// Example (commented — replace with REAL visited beaches + real dates):
//   [3001, { visitedOn: '2026-07', note: { gr: 'Ήρεμα νερά και σκιά όπως αναφέρεται.', en: 'Calm water and shade as described.' } }],
export const CERTIFIED_BEACHES: ReadonlyMap<number, BeachCertification> = new Map<number, BeachCertification>([
  // Παραλία Άναξου (Λέσβος) — first visit, verified on site.
  [1352, {
    visitedOn: '2026-07-22',
    note: {
      gr: 'Ήρεμα νερά, χωρίς ιδιαίτερο κόσμο, δωρεάν ξαπλώστρες σε ένα σημείο και ντουζ. Ο ορισμός του CalmBeach.',
      en: 'Calm water, not too crowded, free sunbeds in one spot and a shower. The very definition of CalmBeach.',
      de: 'Ruhiges Wasser, nicht überfüllt, kostenlose Liegen an einer Stelle und eine Dusche. Die Definition von CalmBeach.',
      it: 'Acqua calma, non troppo affollata, lettini gratuiti in un punto e una doccia. La definizione stessa di CalmBeach.',
      fr: 'Eau calme, sans trop de monde, transats gratuits à un endroit et une douche. La définition même de CalmBeach.',
    },
  }],
]);

/** True when the beach carries the first-party CalmBeach Certified seal. */
export const isCalmBeachCertified = (beachId: number | undefined | null): boolean =>
  typeof beachId === 'number' && CERTIFIED_BEACHES.has(beachId);

/** The certification record (visit date, note) for a beach, if any. */
export const getBeachCertification = (
  beachId: number | undefined | null,
): BeachCertification | undefined =>
  typeof beachId === 'number' ? CERTIFIED_BEACHES.get(beachId) : undefined;

/** Pick the note in the visitor's language, falling back gr -> en -> first available. */
export const localizeCertificationNote = (
  note: LocalizedNote | undefined,
  language: LanguageCode,
): string | undefined =>
  note ? (note[language] ?? note.gr ?? note.en ?? Object.values(note)[0]) : undefined;
