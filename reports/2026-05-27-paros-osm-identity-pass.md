# Paros OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Paros bucket in the South Aegean / Cyclades dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 12 low-confidence Paros records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Agios Stefanos
- Ampelas
- Glyfades
- Kalogeros
- Limnes
- Molos
- Xyfara
- Paralia Agkali Chrysis Aktis
- Piperi
- Pyrgaki
- Tourkou Ammos
- Tsoukalia

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Paros State

- Paros beaches: 37
- Records with direct source URLs: 31
- Low-confidence records without source URLs: 6

The remaining low-confidence records without direct source URLs are `Agios Dimitrios`, `Aspros Gkremos`, `Voutakos`, `Laggeri`, `Lolantonis`, and `Nautikos Omilos Parou`. This pass found no clean nearby OSM beach object for those records, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1776 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
