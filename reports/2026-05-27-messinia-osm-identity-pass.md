# Messinia OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Messinia mainland bucket.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 25 low-confidence Messinia records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Agia Triada
- Ammos
- Ammoudi
- Artaki
- Voidokilia
- Gargarou
- Glyfada
- Kalamaki
- Kantouni
- Koumpares
- Kryoneri
- Lachanou
- Livadia
- Mati
- Paralia Vounaki
- Paralia Kalamitsi
- Paralia Salio
- Paralia Stomio
- Paralia Foneas
- Paralia Chomati
- Selitsa
- Chelonaria
- Kartela
- Oasi
- Velonas

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Messinia State

- Messinia mainland beaches: 54
- Records with direct source URLs: 36
- Low-confidence records without source URLs: 2

The two remaining low-confidence records without direct source URLs are `Glossa (gymniston)` and `Chalikoura`. This pass did not find clean same-name OSM beach objects for them, so no source URLs were added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1657 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
