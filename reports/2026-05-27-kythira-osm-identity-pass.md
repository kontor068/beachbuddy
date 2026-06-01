# Kythira OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Kythira bucket in Attica islands.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 22 low-confidence Kythira records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Ammoutsi
- Kalogeroi
- Paralia Karpathi
- Routsounas
- Agia Patrikia
- Paralia Kalamitsi
- Paralia Lorentzos
- Limni Agias Pelagias
- Paralia Lygia
- Paralia Diporos
- Petritis
- Agios Lefteris
- Paralia Palaiopoli
- Paralia Limni Palaiopoli
- Paralia Kaladi
- Kakopetra
- Feloti
- Lefto
- Paralia Sparaggario
- Kyriakoulou
- Steno Avlaki
- Vroulea

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Kythira State

- Kythira beaches: 42
- Records with direct source URLs: 27
- Low-confidence records without source URLs: 2

The two remaining low-confidence records without direct source URLs are `Agios Nikolaos` and `Xeropotamos`. This pass did not find clean nearby OSM beach objects for them, so no source URLs were added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1724 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
