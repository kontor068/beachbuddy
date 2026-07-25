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

export interface BeachCertification {
  /**
   * When we verified it on the ground, ISO `YYYY-MM` (a full `YYYY-MM-DD` is fine too).
   * Time-stamps the claim and powers the "verified on site" line on the detail page.
   */
  visitedOn: string;
  /** Optional one-line note about what we checked, shown on the detail page if present. */
  note?: string;
}

// id -> certification. Keep this tiny and evidence-backed: you were physically there.
// Example (commented — replace with REAL visited beaches + real dates):
//   [3001, { visitedOn: '2026-07', note: 'Ήρεμα νερά και σκιά όπως αναφέρεται.' }],
export const CERTIFIED_BEACHES: ReadonlyMap<number, BeachCertification> = new Map<number, BeachCertification>([
  // Παραλία Άναξου (Λέσβος) — first visit, verified on site.
  [1352, {
    visitedOn: '2026-07-22',
    note: 'Ήρεμα νερά, χωρίς ιδιαίτερο κόσμο, δωρεάν ξαπλώστρες σε ένα σημείο και ντουζ. Ο ορισμός του CalmBeach.',
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
