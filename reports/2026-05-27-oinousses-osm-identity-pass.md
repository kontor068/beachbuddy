# Oinousses OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Oinousses bucket in the North Aegean dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 6 low-confidence Oinousses records that had exact or near-exact OSM `natural=beach` identity/location matches.

The update covers:

- Kakopetria
- Fasoli
- Bilali
- Apiganou
- Fokia
- Chatzali

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

Also synced the existing source metadata for 2 already sourced Oinousses records from `public/greek_beaches.json` into `src/data/greek_beaches.json`, so the mirrors do not drift.

## Current Oinousses State

- Oinousses app-facing beaches: 8
- Records with direct source URLs: 8
- Low-confidence records without source URLs: 0

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 2001 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check -- <batch files>`: passed
- Full `git diff --check`: blocked by pre-existing unrelated trailing whitespace in `App.tsx`

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording. Seasonal services in small North Aegean islands should remain conservative unless verified by local or official sources.
