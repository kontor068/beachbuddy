# Beach Buddy Region Checkpoints

Last updated: 2026-05-10

## Completed checkpoints

- `e0512bb` - Initial Beach Buddy baseline.
- `3febdb3` - UI and data-quality checkpoint: difficult access wording, duplicate home recommendations, bookmark icon removal, title-cased Greek metadata chips, planner preview, Milos photo candidates, and synced beach JSON mirrors.
- `d43b1a2` - Evia data audit checkpoint: first Evia/Skyros pass and persistent region tracking.

## Latest region checkpoint

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

## Previous region checkpoint

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

1. Thessaly: mainland Thessaly and Sporades-adjacent grouping checks.
2. Ionian Islands.
3. South Aegean: Cyclades and Dodecanese.
4. Crete.
5. Peloponnese.
6. North Aegean.
7. Epirus.
8. Macedonia / Thrace regions.
9. West Greece and West Macedonia.
10. Attica final pass after mainland/island grouping stabilizes.

## Durable data rules

- Do not show "4x4 only" as user-facing copy unless it is strictly verified and unavoidable. Prefer `Δύσβατος δρόμος`.
- Keep `4x4_only` as an internal type only when the road is genuinely difficult enough to affect recommendations.
- Do not duplicate the same beach in multiple home-screen sections.
- When a beach has seasonal services, phrase amenities as seasonal or nearby instead of guaranteed.
