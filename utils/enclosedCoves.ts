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

  // ── National audit batch (2026-07-18, scripts/auditEnclosedCoves.mjs) ──
  // Twelve strongest false-negatives: each sits exactly ONE sector short of the
  // strict gate (enclosedRun 4, not 5) yet is unmistakably an όρμος — land ≤0.5 km in
  // 6-7 of 8 sectors, a 1-2 sector mouth, and a tiny max fetch (1-2.3 km). No veto on
  // any of them. Promoted by geometry evidence exactly as the doctrine intends.
  // Central Greece
  265,  // Αστέρια (Evia): near-land 7/8 sectors, single-sector mouth, max fetch 1.3 km.
  // Ionian
  930,  // Alipa (Corfu): near-land 6/8, 2-sector mouth, max fetch 1.1 km.
  1229, // Σκίνος (Ithaca): near-land 6/8, 2-sector mouth, max fetch 1.6 km.
  1140, // Δεσίμι (Lefkada): deep sheltered bay, near-land 6/8, mouth 2, max fetch 1.7 km.
  1131, // Φωκί (Kefalonia): rock-armed cove, near-land 6/8, mouth 2, max fetch 1.7 km.
  1138, // Πλατύ Λιμάνι (Kefalonia): near-land 6/8, 2-sector mouth, max fetch 2.0 km.
  // Epirus mainland
  904,  // Μουρτεμένο (Thesprotia): near-land 6/8, 2-sector mouth, max fetch 2.3 km.
  // North Aegean
  1340, // Λαμπρίνη / Ουζούν Σοκάκ (Lesvos): near-land 6/8, mouth 2, max fetch 1.4 km.
  // Cyclades
  2223, // Πάνω Μερσίνι (Polyaigos): near-land 6/8, 2-sector mouth, max fetch 1.6 km.
  2039, // Μοναστήρι (Paros): near-land 6/8, 2-sector mouth, max fetch 1.8 km.
  2171, // Μαλλί (Tinos): near-land 6/8, 2-sector mouth, max fetch 1.8 km.
  // Dodecanese
  2261, // Αργίνωντα (Kalymnos): near-land 6/8, 2-sector mouth, max fetch 2.1 km.
]);
