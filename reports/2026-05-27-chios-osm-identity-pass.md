# Chios OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Chios bucket in North Aegean.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 20 low-confidence Chios records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Bella Vista
- Paralia Trachili
- Agia Dynami
- Agia Eirini
- Apothika
- Gyali
- Elinta
- Makria Ammos
- Nagos
- Paralia Agios Isidoros
- Paralia Avlonia
- Paralia Kampia
- Paralia Kato Fana
- Paralia Karynta
- Paralia Myrsinidi
- Paralia ton Glaron
- Potamoi
- Salagona
- Tigani
- Trachili

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Chios State

- Chios beaches: 34
- Records with direct source URLs: 27
- Low-confidence records without source URLs: 5

The five remaining low-confidence records without direct source URLs are `Paralia Amadon`, `Paralia Pyrgia (notios ormos)`, `Paralia Pyrgia (voreios ormos)`, `Vigla`, and `Avlonia Pyrgiou`. This pass found no clean same-name OSM beach object for them, so no source URLs were added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1677 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
