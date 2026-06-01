# Chania OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Chania bucket in the Crete dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 9 low-confidence Chania records that had exact, translated, or near-exact OSM `natural=beach` identity/location matches.

The update covers:

- Voulolimni
- Lefki Paralia / White Beach
- Sougia Nude Beach
- Trahili
- Alonaki
- Aspri Limni
- Chrysi Akti / Golden Beach
- Kalami
- Kera

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Chania State

- Chania app-facing beaches: 84
- Records with direct source URLs: 66
- Low-confidence records without source URLs: 1

The remaining low-confidence Chania record without a direct source URL is `Ammos`. It was skipped because the nearby OSM candidate points to `Trahili Beach`, not a clean same-name or compatible-name match.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1995 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. The skipped `Ammos` record needs a deeper Chania/Grammeno local-source or geodata review pass.
