# Serifos OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Serifos bucket in the South Aegean / Cyclades dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 11 low-confidence Serifos records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Avessalos
- Ai Giannis
- Alevrakia
- Achladi
- Voreino
- Gialoudi
- Karavas
- Kentarhos
- Lia
- Maliadiko
- Mesiano

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Serifos State

- Serifos beaches: 25
- Records with direct source URLs: 22
- Low-confidence records without source URLs: 3

The remaining low-confidence records without direct source URLs are `Agios Sostis`, `Kalogeros`, and `Skala`. This pass found no clean nearby OSM beach object for those records, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1861 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. The remaining no-source Serifos records need a deeper local-source or geodata review pass rather than a broad OSM-only pass.
