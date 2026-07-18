/**
 * Curated enclosed-cove (όρμος) allowlist.
 *
 * The 8-sector ray geometry provably CANNOT separate every natural cove from
 * look-alikes (measured 2026-07-18 on a labeled set: an urban breakwater pocket
 * like Γλυφάδα Α and a fjord like Παλιόνησος produce identical sector features).
 * The strict geometric core in utils/windExposureEngine.ts therefore optimises
 * for zero false positives, and the iconic coves whose enclosure is real but
 * sub-sector-scale (narrow rock arms, fjord threads) are promoted here by
 * curated, documented knowledge — same doctrine as windProfileOverrides.
 *
 * Add a beach ONLY with a verifiable morphology rationale (map/photo inspection
 * or on-site report). Wind-sport spots must never be added.
 */
export const CURATED_ENCLOSED_COVE_IDS: ReadonlySet<number> = new Set([
  // Ionian
  1148, // Αγιοφύλλι (Lefkada): pocket cove tucked E of Cape Lefkatas, cliff arms N/NE/E/SE; open only S/SW.
  // Dodecanese
  2269, // Παλιόνησος (Kalymnos): deep fjord-like inlet, max fetch 2 km in ANY direction.
  // Cyclades
  2211, // Γερολιμνιώνας (Schinoussa): near-closed horseshoe, land ≤0.1 km in 6/8 sectors.
  // NOTE: Πίσω Λιμνιώνας (Andros, 1719) deliberately NOT listed — its authored
  // windProfile marks it shelterLevel 'open' ("open-fetch risk"), and curated
  // caution always outranks a morphology promotion.
  2096, // Αρτιμόνι (Sifnos): rock-armed inlet next to Πλατύς Γιαλός, enclosed NE→S.
  // North Aegean
  3106, // Λιμνιώνας (Samos): classic horseshoe cove, enclosed SW→NE, mouth E/SE.
  // Attica islands
  133,  // Λιμνιώνας (Kythira): land ≤0.1 km in 6/8 sectors, mouth N/NW only.
]);
