# Syros OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Syros bucket in the South Aegean / Cyclades dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 6 low-confidence Syros records in the app-facing public dataset that had exact or near-exact OSM `natural=beach` identity/location matches.

The update covers:

- Ai Loukas
- Armeos
- Vathy Gialoudi
- Lagonaki
- Megas Lakos
- Santorinioi

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

The `src/data/greek_beaches.json` mirror was updated only where the same coordinates existed. Two older Syros mirror records, `Lagonaki` and `Santorinioi`, have different stored coordinates in `src/data` and were left unchanged for later geodata review.

## Current Syros State

- Syros app-facing beaches: 29
- Low-confidence records without source URLs: 0

The remaining Syros records without direct URLs in the public dataset are medium-confidence or non-low records that still need direct local/official sources before any future confidence or service promotion.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 2007 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check -- <batch files>`: passed

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. The two skipped `src/data` coordinate mismatches should be reviewed as a geodata synchronization task before copying app-facing source metadata into that mirror.
