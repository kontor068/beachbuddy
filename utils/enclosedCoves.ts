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

  // ── Audit batch 2 (2026-07-20, scripts/auditEnclosedCoves + web morphology verification) ──
  // Strong near-miss geometry (enclosedRun 4, nearLand 6-7, 1-2 sector mouth, short
  // fetch) CONFIRMED as genuine enclosed swim coves by map/pilot-guide review — no
  // wind-sport, no commercial marina. Same pass removed Αγιοφύλλι (was 1148): verified
  // an open S-facing pocket beach with "no natural protection from waves", not a cove.
  // Ionian & West
  897,  // Κάρβουνο (Thesprotia/Sivota): bay screened by the Μουρτεμένο/Άγ.Νικόλαος islets acting as a natural breakwater; near-land 6/8, mouth 2, max fetch 3.1 km.
  1177, // Αθερινός (Meganisi): fjord-like inlet "sheltered from most winds" (protected from the NW maistros); near-land 6/8, mouth 2, max fetch 3.0 km. Small municipal quay only, not a marina.
  1529, // Μεγάλο Αμόνι (Korinthia): small E-facing pocket «κολπίσκος», water reported always calm; near-land 7/8, single-sector mouth, max fetch 5.2 km.
  // Cyclades
  1661, // Κάτω Κάμπος (Amorgos, Kolofana): deep narrow cove with only a small pier; near-land 7/8, single-sector mouth, max fetch 5.4 km.
  // Dodecanese
  2367, // Μπλεφούτης (Leros): near-landlocked north bay guarded by the Στρογγυλή/Τρυπητή islets across the mouth; near-land 6/8, mouth 2, max fetch 3.4 km.
  2469, // Άγιος Νικόλαος (Symi): small sheltered pocket bay, boat/foot access only, ringed by rocky hills; near-land 6/8, mouth 2, max fetch 3.7 km.

  // ── National audit batch 3 (2026-07-25, Πάνορμος-class near-miss funnel + web
  // morphology verification). All: land ≤0.5 km in 6-7/8 sectors, 1-2 sector mouth,
  // max fetch ≤6.2 km, no wind-sport/marina; the strict gate misses them only
  // because a facing-aligned arm sector reads 'partial' by intensity. ──
  // Mainland West & Gulf of Corinth
  340,  // Γιάννακης (Galaxidi, Fokida): islet-screened pocket on the indented Galaxidi shore inside the sheltered Krissaios gulf.
  1528, // Λυχνάρι (Korinthia, Katakali): natural «λιμανάκι» on the deeply indented Sofiko coast, small-boat shelter.
  1530, // Μικρό Αμόνι (Korinthia, Sofiko): «κολπίσκος» with calm/serene water, twin of the curated Μεγάλο Αμόνι.
  1591, // Πόρτο Κάγιο (Mani): historic near-circular natural harbour, "lake-like waters"; southernmost natural port of the mainland.
  // Crete
  632,  // Βαθύ (Asterousia, Heraklion): gorge-mouth cove between long cliffs, "protected from all winds except SW"; historic pirate anchorage.
  // Ionian
  1216, // Πόρτο Βρώμη (Zakynthos): twin fjord inlets, ~100 m mouth; only the Ναυάγιο excursion jetty, no marina.
  // North Aegean
  1259, // Ελίντα (Chios): narrow W/SW-mouth cove ringed by pine hills; deep enough that the submarine «Παπανικολής» hid there in WWII.
  1368, // Τσίλια (Lesvos, Tarti): tiny boat-access-only cove with ~100-200 m mouth at the Gera gulf approaches.
  // Cyclades
  1798, // Τρεις Κλεισιές βόρειος (Ios): the island's ancient port — "well protected from the winds", path access only.
  1861, // Άγιος Στέφανος (Kythnos): family cove sheltered from the etesians; yachts overnight in the bay.
  // NOTE: Πάνορμος (Naxos, 2011) deliberately NOT listed even though it is very
  // likely a real όρμος. Its authored windProfile carries suspectPin: true — the
  // app pin sits in a SW-opening harbour notch while the real bay opens SE, so
  // the computed geometry describes the wrong water. Curating around a position
  // caution would claim shelter from an untrusted point. Fix the PIN first; the
  // geometry can then speak for itself.
  2089, // Μέγα Λιβάδι (Serifos): deep SW bay "well sheltered from summer winds"; ore bridge is a defunct 1900s relic, not a port.
  2097, // Βαθή (Sifnos): horseshoe bay, "one of the most sheltered in the Cyclades — safe anchorage even in full meltemi".
  2143, // Βάρη (Syros): deep south bay, "one of the most protected" swim spots of the island.
  // Dodecanese
  2229, // Τσαγκάρι (Agathonisi): near-land 7/8 with single-sector mouth on the deeply indented, anchorage-grade south coast.
  2377, // Λεντού (Lipsi): shallow family cove screened by the Λέντου islet, "well protected from the meltemia".
]);

/**
 * Curated NON-cove denylist — the symmetric correction. These pass the strict
 * ray gate yet map/photo/source verification shows the enclosure is not a real
 * swim-cove enclosure (urban mole pockets, straight-shore artefacts, wide bays,
 * wind-sport shores). Doctrine: a false «Κλειστός όρμος» badge is the expensive
 * error, so verified look-alikes are pinned out — geometry can never re-promote
 * them, only a human removing the entry can.
 */
export const CURATED_NON_COVE_IDS: ReadonlySet<number> = new Set([
  185,  // Πλαζ Καλαμπάκα (Piraeus): urban rock/mole pocket at the harbour mouth beside the Naval School — not a natural όρμος.
  554,  // Κούμ Καπί (Chania): straight, fully open N-facing city shore; the "arms" are alongshore ray artefacts, not headlands.
  743,  // Καραβοστάσι (Lasithi, Kalo Chorio): relatively long open north-coast beach, no topographic shelter.
  768,  // Χαβάνια (Agios Nikolaos): small picturesque bay but no evidence of ≥5/8 enclosure — under-claim wins.
  857,  // Χρυσή Αμμουδιά / Golden Beach (Thasos): 3 km sweep of one huge E-facing bay AND an established windsurf/kite spot.
  1537, // Πλαζ Αλκυονίδας (Korinthia): long straight Alkyonides-gulf shore, no named enclosure resolves here.
  2044, // Αλυκή (Paros): open ~0.5 km village bay with fishing-harbour mole; meltemi-lee comfort, not cove morphology.
]);
