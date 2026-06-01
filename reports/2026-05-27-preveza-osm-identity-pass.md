# Preveza OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Preveza mainland bucket in the Epirus dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 5 low-confidence Preveza mainland records that had exact or near-exact OSM `natural=beach` identity/location matches.

The update covers:

- Artolithia Beach
- Agios Sostis
- Skala
- Spartila
- Ormos tou Odyssea

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Preveza State

- Preveza app-facing beaches: 26
- Low-confidence records without source URLs: 0

The remaining Preveza records without direct URLs in the public dataset are medium-confidence or non-low records that still need direct local/official sources before any future confidence or service promotion.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 2012 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check -- <batch files>`: passed

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. Seasonal services on the Epirus coast should remain conservative unless verified by local or official sources.
