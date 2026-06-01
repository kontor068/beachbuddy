# Evia OSM identity/location pass - 2026-05-27

## Scope

Continued the Evia data-quality batch with a focused OSM identity/location pass.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 22 low-confidence Evia records that had exact or near-exact OSM identity/location matches:

- Paralia tsirmokokkala
- Paralia Farou
- Paralia Figia
- Pelagos
- Pera Katsoyli
- Petali
- Pinelopi
- Piso Sykia
- Platys Gialos
- Porto Lafia
- Rodies
- Sgoura
- Souvala
- Spitha
- Steni
- Sykies
- Schoinodayleia
- Triantafyllenia
- Tsokaiti
- Cheromylos
- Hiliadou Nudist Beach / Chiliadou paralia Gymniston
- Psili Ammos

Confidence was intentionally kept low because the OSM matches verify identity/location only. Existing access and amenity claims were not strengthened without direct local sources. For Piso Sykia, the OSM match is recorded as Megali Sykia with `name:el` pointing to Piso Sykia, so this remains low-confidence identity support rather than a promotion.

## Accepted Sections

The final Evia audit had two same-name coordinate precision notes. These were reviewed and accepted as existing sections, not coordinate fixes:

- Paralia Dafnis: OSM has two same-name Dafni shoreline ways. The app point matches one way, and the second way is covered by the same broader beach record.
- Rodies: OSM has two nearby same-name Rodies shoreline ways. The app point matches one way, and the second way is treated as the same Rodies area.

`scripts/auditBeachDataset.mjs` now records those two OSM URLs as accepted Evia existing sections, so the audit explains the decision instead of suggesting a coordinate move.

## Current Evia State

- Evia beaches: 122
- Low-confidence records: 24
- Low-confidence records without source URLs: 0
- Remaining audit notes: 2 LOW accepted existing-section notes

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `npm run audit:beaches -- --island=evia --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM, 2 LOW accepted existing-section notes
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings
- `npm run lint`: passed
- `npm run build`: passed with the known Vite large chunk warning

## Remaining Risk

The updated records are now source-linked, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
