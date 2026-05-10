# Beach Buddy Region Checkpoints

Last updated: 2026-05-10

## Completed checkpoints

- `e0512bb` - Initial Beach Buddy baseline.
- `3febdb3` - UI and data-quality checkpoint: difficult access wording, duplicate home recommendations, bookmark icon removal, title-cased Greek metadata chips, planner preview, Milos photo candidates, and synced beach JSON mirrors.

## Latest region checkpoint

### Central Greece / Evia

Status: first pass completed.

Areas included:
- Evia: 115 beach records.
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

1. Central Greece remainder: Fokida, Fthiotida, Viotia.
2. Thessaly: mainland Thessaly and Sporades-adjacent grouping checks.
3. Ionian Islands.
4. South Aegean: Cyclades and Dodecanese.
5. Crete.
6. Peloponnese.
7. North Aegean.
8. Epirus.
9. Macedonia / Thrace regions.
10. West Greece and West Macedonia.
11. Attica final pass after mainland/island grouping stabilizes.

## Durable data rules

- Do not show "4x4 only" as user-facing copy unless it is strictly verified and unavoidable. Prefer `Δύσβατος δρόμος`.
- Keep `4x4_only` as an internal type only when the road is genuinely difficult enough to affect recommendations.
- Do not duplicate the same beach in multiple home-screen sections.
- When a beach has seasonal services, phrase amenities as seasonal or nearby instead of guaranteed.
