# Beach Buddy Region Checkpoints

Last updated: 2026-05-10

## Completed checkpoints

- `e0512bb` - Initial Beach Buddy baseline.
- `3febdb3` - UI and data-quality checkpoint: difficult access wording, duplicate home recommendations, bookmark icon removal, title-cased Greek metadata chips, planner preview, Milos photo candidates, and synced beach JSON mirrors.
- `d43b1a2` - Evia data audit checkpoint: first Evia/Skyros pass and persistent region tracking.
- `ce8c6c1` - Central Greece mainland data audit checkpoint: Fokida, Fthiotida, and Viotia first pass.
- `3b1aa4b` - Thessaly data audit checkpoint: Sporades, Pelion, and Larissa Coast first pass.
- `15499dc` - Ionian Islands data audit checkpoint: Corfu, Paxos, Kefalonia, Lefkada, Zakynthos, and Ithaca first pass.
- `0440443` - South Aegean data audit checkpoint: Cyclades and Dodecanese first pass.
- `f8137d9` - Crete data audit checkpoint: Chania, Gavdos, Heraklion, Rethymno, and Lasithi first pass.

## Latest region checkpoint

### Peloponnese / Argolida, Arkadia, Korinthia, Lakonia, Messinia

Status: first pass completed.

Areas included:
- Argolida mainland: 26 beach records after collapsing the clear Kondyli / Agios Nikolaos duplicate.
- Arkadia mainland: 16 beach records after removing duplicate Thiopauto and Paralio Astros cards.
- Korinthia mainland: 21 beach records after collapsing the duplicate Agioi Theodoroi beach card.
- Lakonia mainland: 61 beach records after collapsing duplicate naturist, Elia/Kavos, and Plytra/Pachia Ammos overlaps.
- Messinia mainland: 54 beach records after collapsing duplicate Gialova, Kalamata, Ritsa, Vasilitsi/Kryoneri, and Santova/Hobo records.
- Peloponnese total: 178 beach records, down from 194 before this checkpoint.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- The clearest repeated beach cards were removed so filters and scrolling do not show the same Peloponnese beach again and again.
- `Παραλία Μυλοκοπή` and `Τηγάνια` still use internal difficult-road access with user-facing `Δύσβατος δρόμος`, not "4x4 only" wording.
- Source spot-checks covered Visit Greece, Visit Peloponnese, Peloponnisos Search, Blue Flag Greece, inLaconia, All About Peloponnisos, Kalamata local tourism content, DIVELOG, and the Municipality of Pylos-Nestor guide.

Focused fixes in this checkpoint:
- Argolida: collapsed `Παραλία Κονδύλι` into `Παραλία Αγίου Νικολάου - Κονδύλι`, aligned the canonical coordinates with source-backed Kondyli / Agios Nikolaos data, and added seasonal water-sports amenities.
- Arkadia: removed the duplicate `Θιόπαυτο` record and the second `Πλαζ Παράλιου Άστρους` record.
- Korinthia: removed the second `Παραλία Αγίων Θεωδώρων` record and clarified the canonical card as the long urban beach / Pefkakia-side resort area.
- Lakonia: removed the duplicate generic `Γυμνιστική Παραλία`, removed the low-confidence `Κάβος` overlap beside `Παραλία Ελιάς`, collapsed the Plytra cluster into `Πλύτρα - Παχιά Άμμος`, and renamed the separate Mani-side `Καραβοστάσι` to `Καραβοστάσι Οιτύλου`.
- Messinia: collapsed three Gialova-side records into one `Παραλία Γιάλοβα`; collapsed three `Παραλία Καλαμάτας` records into one city-beach card; removed `Παραλία Ριτσά 2η`, `Παραλία Ριτσά 3η`, and `Hobo`; removed generic `Παραλία Βασιλιτσίου` after confirming `Κρυονέρι` is the source-backed Vasilitsi-community beach.
- Argolida: kept both `Παραλία Βαγιωνία` and `Καλαμάκι` because Visit Greece describes them as nearby but distinct Epidavros beaches.

Remaining risks:
- Many Peloponnese low-confidence micro-coves remain in Lakonia, Messinia, Argolida, and Arkadia; they should get a second local-source pass before promotion.
- Some long urban beaches, especially Kalamata and Agioi Theodoroi, may have named sub-sections that can be added later only if they improve choice rather than duplicate the main card.
- Remote Mani and Korinthia dirt-road access can change after storms or maintenance, so difficult-road wording should stay conservative.
- Seasonal organization on Peloponnese beaches varies by summer month, so amenities remain phrased as seasonal or nearby.

## Previous region checkpoint

### Crete / Chania, Gavdos, Heraklion, Rethymno, Lasithi

Status: first pass completed.

Areas included:
- Chania mainland: 41 beach records after removing clear Blue Coast / Kyani Akti and Anidri / Gialiskari duplicate-alias records.
- Gavdos: 9 beach records.
- Heraklion: 13 beach records.
- Rethymno: 17 beach records.
- Lasithi: 53 beach records.
- Crete total: 133 beach records, down from 135 before this checkpoint.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- The clearest same-area repeated beach cards were removed so filters and scrolling do not show duplicate aliases.
- `Balos`, `Μένιες (Δίκτυννα)`, and `Τρυπητή` in Heraklion now use internal difficult-road access with user-facing `Δύσβατος δρόμος`, not "4x4 only" wording.
- Source spot-checks covered Destination Crete, Paleochora Discover, Terrabook, Discover Crete, UNESCO Sites in Crete, and Cretan Beaches / local Crete guides.

Focused fixes in this checkpoint:
- Chania: removed `Blue Coast` and kept `Κυανή Ακτή` as the canonical Kiani Akti / Blue Coast record with source-backed organized beach metadata.
- Chania: removed `Anidri` and kept `Γιαλισκάρι` as the canonical Gialiskari / Anydroi beach-complex record.
- Chania: changed `Balos` from passable dirt-road framing to `Δύσβατος δρόμος`, with boat-from-Kissamos alternative and rental-car caution.
- Chania: renamed `Diktina` to `Μένιες (Δίκτυννα)` and changed access to `Δύσβατος δρόμος` because the Rodopou route is a long rugged dirt road.
- Heraklion: changed `Τρυπητή` to `Δύσβατος δρόμος` because the Lendas / Vasiliki access uses a long rough dirt road with narrow passages.

Remaining risks:
- Xerokampos micro-coves such as `Γεροντόλακκος`, `Άργιλος`, `Χιόνα Ξερόκαμπου`, and `Βουρλιά` are very close but source-checks indicate distinct neighboring coves, so they were not merged.
- Grammeno peninsula and Sissi / Milatos-area small coves remain close together and should get a second local-source pass before launch.
- This was a cleanup checkpoint, not a Crete expansion pass; major missing beaches should be added in a separate controlled import.
- Seasonal services in Crete can change by month, so amenities remain phrased as seasonal or nearby.

## Earlier region checkpoint

### South Aegean / Cyclades and Dodecanese

Status: first pass completed.

Areas included:
- Cyclades: 532 beach records after removing clear duplicate cards and moving Malli from Andros to Tinos.
- Dodecanese: 250 beach records after collapsing clear same-beach duplicates in Karpathos, Kos, and Rhodes.
- South Aegean total: 782 beach records, down from 801 before this checkpoint.

Cyclades island counts:
- Amorgos: 14, Anafi: 15, Andros: 41, Antiparos: 12, Folegandros: 16, Ios: 49, Kea: 34, Kimolos: 31, Kythnos: 40, Milos: 34, Mykonos: 42, Naxos: 15, Paros: 37, Santorini: 13, Serifos: 27, Sifnos: 10, Sikinos: 5, Syros: 26, Tinos: 39, Donousa: 4, Koufonisia: 18, Schinoussa: 8, Iraklia: 2.

Dodecanese island counts:
- Agathonisi: 5, Astypalaia: 20, Halki: 2, Kalymnos: 20, Karpathos: 45, Kastellorizo: 3, Kos: 34, Leros: 11, Lipsi: 18, Nisyros: 2, Patmos: 15, Rhodes: 38, Symi: 8, Tilos: 12, Kasos: 5, Pserimos: 3, Telendos: 5, Arki: 2, Marathi: 2.

What has been checked:
- JSON mirrors are synced between `src/data/greek_beaches.json` and `public/greek_beaches.json`.
- The clearest same-island repeated beach cards were removed so filters and scroll sections do not show the same beach again and again.
- User-facing difficult access wording still avoids absolute "4x4 only" copy; Malli in Tinos now says cautious dirt-road driving instead of implying a required special vehicle.
- Source spot-checks covered Tinosecret, Santorini-Net / Santorinika, Kos.gr, Visit Rhodes, KarpathosInfo, Andros Secrets, GoParos, Go-Amorgos, and AllOverGreece.

Focused fixes in this checkpoint:
- Amorgos: removed the second `Καμπί` entry and kept the Agia Anna / Syrma-side Kambi record.
- Andros: removed the duplicate `Βιτάλι`; moved `Μαλλί` out of Andros and removed `Παραλία Μαλλί`.
- Tinos: added `Μαλλί` as the canonical Tinos beach with passable dirt-road wording and cautious-driving notes.
- Paros: removed the duplicate `Λωλαντώνης` and refreshed its quiet south-east bay / limited seasonal services metadata.
- Santorini: collapsed `Λευκή Παραλία` to the source-aligned White Beach coordinates and kept boat-access wording.
- Donousa: removed the duplicate `Λιβάδι` and clarified the Mersini - Livadi footpath access.
- Karpathos: removed duplicate `Καστέλια`; collapsed `Κάτω Λάκκος` to the source-aligned coordinates and changed access to difficult path / boat-trip wording.
- Kos: collapsed duplicate `Μαρμάρι`, `Παραλία Παράδεισος`, and `Πολέμι`; aligned Marmari and Paradise with Kos.gr coordinates.
- Rhodes: collapsed eight `Φαληράκι` / `Παραλία Φαληράκι` / numbered Faliraki records into one canonical card; collapsed duplicate `Παραλία Ιξιάς`.

Remaining risks:
- Tinos still has two `Βαθύ` records about 5.5 km apart; they need a local-source pass before deciding whether they are distinct coves.
- Koufonisia still has three `Λίμνη` records; the island grouping may include neighboring Ano/Kato Koufonisi coves, so this needs a dedicated Koufonisia pass.
- Astypalaia still has two `Άγιος Ιωάννης` records far apart; likely distinct local spots, but not promoted without a source check.
- Many small Cyclades and Dodecanese coves remain medium or low confidence and should be reviewed island-by-island before launch.
- Seasonal services in the South Aegean vary heavily by month, so amenities remain phrased as seasonal or nearby.

## Earlier region checkpoint

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

## Earlier region checkpoint

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

1. North Aegean.
2. Epirus.
3. Macedonia / Thrace regions.
4. West Greece and West Macedonia.
5. Attica final pass after mainland/island grouping stabilizes.

## Durable data rules

- Do not show "4x4 only" as user-facing copy unless it is strictly verified and unavoidable. Prefer `Δύσβατος δρόμος`.
- Keep `4x4_only` as an internal type only when the road is genuinely difficult enough to affect recommendations.
- Do not duplicate the same beach in multiple home-screen sections.
- When a beach has seasonal services, phrase amenities as seasonal or nearby instead of guaranteed.
