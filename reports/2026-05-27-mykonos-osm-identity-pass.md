# Mykonos OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Mykonos bucket in the South Aegean / Cyclades dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 5 low-confidence Mykonos records that had exact or near-exact OSM `natural=beach` identity/location matches.

The update covers:

- Kapari
- Kato Tigani
- Loulos
- Merchia
- Fragkia

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Mykonos State

- Mykonos app-facing beaches: 39
- Records with direct source URLs: 37
- Low-confidence records without source URLs: 2

The remaining low-confidence records without direct source URLs are `Μερσίνη` and `Τηγάνι`. This pass found no clean nearby OSM beach object for those records, so no source URL was added.

`Αγία Τριάδα` was ignored in this pass because it is already excluded from app-facing Mykonos data as a Rinia/Delos-side coordinate record.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1958 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. The remaining no-source Mykonos records need a deeper local-source or geodata review pass rather than a broad OSM-only pass.
