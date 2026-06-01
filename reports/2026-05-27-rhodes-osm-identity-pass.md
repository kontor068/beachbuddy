# Rhodes OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Rhodes bucket in the South Aegean / Dodecanese dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 16 low-confidence Rhodes records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Agia Triada
- Glyfada
- Kerameni
- Kokkina
- Limanaki
- Paralia Alyki
- Paralia Kalavarda
- Paralia Katafygio
- Paralia Kopria
- Paralia Kouloura
- Paralia Kokkini Ammos
- Paralia Kymata
- Paralia Limni
- Paralia Masari
- Paralia Fournoi
- Sousounia

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Rhodes State

- Rhodes beaches: 61
- Records with direct source URLs: 61
- Low-confidence records without source URLs: 0

Rhodes now has no low-confidence app-facing records without direct source URLs.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1808 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
