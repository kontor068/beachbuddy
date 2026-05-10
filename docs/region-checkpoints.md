# Beach Buddy Region Checkpoints

Last updated: 2026-05-10

## Completed checkpoints

- `e0512bb` - Initial Beach Buddy baseline.
- `3febdb3` - UI and data-quality checkpoint: difficult access wording, duplicate home recommendations, bookmark icon removal, title-cased Greek metadata chips, planner preview, Milos photo candidates, and synced beach JSON mirrors.
- `d43b1a2` - Evia data audit checkpoint: first Evia/Skyros pass and persistent region tracking.
- `ce8c6c1` - Central Greece mainland data audit checkpoint: Fokida, Fthiotida, and Viotia first pass.
- `3b1aa4b` - Thessaly data audit checkpoint: Sporades, Pelion, and Larissa Coast first pass.

## Latest region checkpoint

### Ionian Islands / Corfu, Paxos, Kefalonia, Lefkada, Zakynthos, Ithaca

Status: first pass completed.

Areas included:
- Corfu: 92 beach records after removing duplicate Agios Spyridon, Agios Petros, and Kolias records.
- Paxos: 25 beach records after removing two low-confidence Mesorachi / Missorachi overlaps around Kanoni.
- Antipaxos: 13 beach records.
- Othonoi: 3 beach records.
- Erikoussa: 2 beach records.
- Mathraki: 1 beach record.
- Kefalonia: 71 beach records after removing one duplicate Skala record.
- Lefkada: 36 beach records after merging Agios Ioannis / Ai Giannis.
- Meganisi: 8 beach records.
- Zakynthos: 39 beach records.
- Ithaca: 30 beach records after removing duplicate Pera Pigadi and Filiatro records.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- The clearest same-island duplicate cards were removed so the user does not see repeated beaches while scrolling.
- `Παραλία Αγίου Σπυρίδωνα` is kept as the north Corfu / Antinioti record; the separate Paleokastritsa Agios Spyridon record remains.
- `Κανόνι` in Paxos is kept as the Lakka bay beach and now uses easy walking access instead of a dirt-road framing.
- `Παραλία Σκάλας`, `Άγιος Ιωάννης`, `Παραλία Φιλιατρό`, and `Πέρα Πηγάδι` were source-checked and kept as the canonical records.
- `Ναυάγιο` already carries 2026 no-landing / viewing-only wording and remains boat/viewing focused.

Focused fixes in this checkpoint:
- Corfu: removed `Agios Spyridon Beach`, `Παραλία Αγ. Πέτρος`, and the second `Κόλιας` record.
- Παξοί: removed `Mesorachi` and `Missorachi Beach` because both overlapped the Kanoni/Lakka area at low confidence.
- Κόλιας (Corfu): corrected practical access to boat-only and removed the duplicate local-cove record.
- Παραλία Αγίου Σπυρίδωνα (Corfu): aligned coordinates and metadata with the north Corfu / Antinioti beach.
- Παραλία Άγιος Πέτρος (Λευκίμμη): kept the precise Lefkimmi record and promoted confidence after source check.
- Παραλία Σκάλας (Kefalonia): kept the beach-specific record, removed `Σκάλα`, and refreshed organized amenities.
- Άγιος Ιωάννης (Lefkada): merged `Άι Γιάννης`, corrected coordinates, and kept Ai Giannis as an alias in notes.
- Πέρα Πηγάδι (Ithaca): removed `Παραλία Πέρα Πηγάδι` and changed access to difficult path / private-boat wording.
- Παραλία Φιλιατρό (Ithaca): removed the duplicate `Φιλιατρό` record and promoted the Vathy-side record.

Remaining risks:
- Kefalonia still has two `Λυγιά` records in different coastal positions; this needs a deeper local-source pass before removal.
- Several Corfu western micro-coves around Liapades / Paleokastritsa remain low-confidence and should be reviewed with local maps.
- Seasonal organization on small Ionian beaches can vary by year, so amenities stay phrased as seasonal or nearby.
- Navagio restrictions are current as of the 2026 source check, but should be rechecked before launch because access rules are policy-driven.

## Previous region checkpoint

### Thessaly / Sporades, Pelion, Larissa Coast

Status: first pass completed.

Areas included:
- Alonissos: 35 beach records after removing one duplicate Megali Ammos record.
- Skiathos: 35 beach records after removing duplicate Lalaria and Megas Gialos records.
- Skopelos: 19 beach records.
- Magnesia mainland / Pelion: 60 beach records.
- Larissa Coast (Agia - Kissavos): 14 beach records.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- `Λαλάρια` is kept as the single Lalaria record and remains boat-only / unorganized.
- `Μέγας Γιαλός` is kept as the single Megas Gialos record with corrected north-Skiathos coordinates.
- `Μεγάλη Άμμος` in Alonissos no longer appears twice and uses `Δύσβατος δρόμος` as user-facing access copy.
- `Χόβολο` is corrected to the Neo Klima / Elios side of Skopelos instead of the old Stafylos-side coordinates.

Focused fixes in this checkpoint:
- Μεγάλη Άμμος (Alonissos): removed `Στη Μεγάλη Άμμο`, corrected coordinates, difficult-road access, pebble terrain, limited parking, and deep-water signal.
- Μέγας Γιαλός (Skiathos): removed duplicate `Μέγα Γιαλός`, corrected coordinates, sandy terrain, no-organization signal, and short final-walk note.
- Λαλάρια (Skiathos): removed duplicate `Παραλία Λαλάριας` and kept the boat-only record.
- Χόβολο (Skopelos): corrected coordinates, access note, terrain, and organized status.
- Άγιοι Σαράντα (Pelion): promoted to medium confidence with easy road access, organized seasonal amenities, and correct mixed sand/pebble terrain.
- Μυλοπόταμος (Pelion): added road-and-steps access wording and corrected deep-water metadata.

Remaining risks:
- Smaller Alonissos cove names around Votsi / Chrysi Milia remain low-confidence and need a deeper local-source pass before promotion.
- Some Skiathos records still have generated close coordinates for neighboring coves and should be checked in a second Sporades pass.
- Larissa Coast was inventoried but not deeply expanded; Agiokampos, Velika, Sotiritsa, Kokkino Nero, Mesangala, and Kastri Loutro should be checked next time Thessaly is revisited.
- Seasonal services in Pelion and the Sporades can change, so amenities remain phrased as seasonal or nearby.

## Earlier region checkpoint

### Central Greece / Fokida, Fthiotida, Viotia

Status: first pass completed.

Areas included:
- Fokida mainland: 18 beach records.
- Fthiotida mainland: 16 beach records after moving three Evia records out and removing one duplicate Tragana record.
- Viotia mainland: 7 beach records.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- Fthiotida no longer contains the northwestern Evia beaches `Γρεγολίμανο`, `Πόρτο Πεύκο`, and `Χρυσή ακτή`.
- The near-duplicate `Τραγάνα` / `Παραλία Τραγάνας` was reduced to one Tragana beach record.
- `Ζάλτσα` uses `Δύσβατος δρόμος` as user-facing access copy.

Focused fixes in this checkpoint:
- Άγιος Ισίδωρος: fixed spelling, promoted to medium confidence, and added seasonal organized amenities.
- Γρεγολίμανο, Πόρτο Πεύκο, Χρυσή ακτή: moved from Fthiotida mainland to Evia.
- Τραγάνα: removed the duplicate simplified record and kept `Παραλία Τραγάνας`.
- Ζάλτσα: changed difficult dirt-road access to internal `4x4_only` with user-facing `Δύσβατος δρόμος`.
- Κορομίλι: corrected access to a short passable dirt-road final section, pebble terrain, and shade/services notes.

Remaining risks:
- The Fokida low-confidence coves around Galaxidi still need a deeper local-source pass before promotion.
- Fthiotida coastline should get a second pass for smaller Kamena Vourla / Agios Konstantinos coves.
- Viotia access can change after road maintenance or winter damage, especially remote dirt roads.

## Earlier region checkpoint

### Central Greece / Evia

Status: first pass completed.

Areas included:
- Evia: 118 beach records after moving three northwestern Evia beaches out of Fthiotida.
- Skyros: 21 beach records.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- No exact duplicate coordinate records found in the Evia/Skyros first pass.
- User-facing difficult-road labels avoid absolute "4x4 only" wording and show `Δύσβατος δρόμος`.
- Source spot-checks were made against Visit Greece, Δήμος Κύμης-Αλιβερίου, Δήμος Σκύρου, EviaGreece, and Greek Travel Pages.

Focused Evia fixes in this checkpoint:
- Κακιά: changed from organized to freer/wilder Kalamos section.
- Κλιμάκι: corrected easier car access, sand metadata, and seasonal services.
- Στόμιο: corrected beach-bar/sunbed metadata, shade, and terrain.
- Τσίλαρος: added seasonal canteen/beach-bar signal and sand/white-pebble terrain.

Remaining risks:
- Access difficulty can change after road maintenance, storms, or seasonal traffic.
- Seasonal services such as canteens, beach bars, sunbeds, and WC should stay humble unless verified per season.
- Low-confidence records should be treated as "needs source check" before promotion.

## Pending region checks

Recommended next order:

1. South Aegean: Cyclades and Dodecanese.
2. Crete.
3. Peloponnese.
4. North Aegean.
5. Epirus.
6. Macedonia / Thrace regions.
7. West Greece and West Macedonia.
8. Attica final pass after mainland/island grouping stabilizes.

## Durable data rules

- Do not show "4x4 only" as user-facing copy unless it is strictly verified and unavoidable. Prefer `Δύσβατος δρόμος`.
- Keep `4x4_only` as an internal type only when the road is genuinely difficult enough to affect recommendations.
- Do not duplicate the same beach in multiple home-screen sections.
- When a beach has seasonal services, phrase amenities as seasonal or nearby instead of guaranteed.
