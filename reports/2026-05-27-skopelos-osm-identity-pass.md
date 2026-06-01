# Skopelos OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Skopelos bucket in the Thessaly / Sporades dataset.

## What changed

Added a direct OpenStreetMap source URL and conservative source note for 1 low-confidence Skopelos record that had a nearby same-name OSM identity/location match.

The update covers:

- Hovolo

Confidence was intentionally kept low because the OSM match verifies identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Skopelos State

- Skopelos beaches: 19
- Records with direct source URLs: 3
- Low-confidence records without source URLs: 10

The remaining low-confidence records without direct source URLs are `Agios Ioannis`, `Armenopetra`, `Vathias`, `Glyfoneri`, `Ekatopenintari`, `Neraki`, `Plaka`, `Spilia`, `Trachili`, and `Ftelia`. This pass found no clean nearby OSM beach object for those records, or found only far-away matches, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1933 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

The Hovolo record is now source-linked for identity/location, but it still needs direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. The remaining no-source Skopelos records need a deeper local-source or geodata review pass rather than a broad OSM-only pass.
