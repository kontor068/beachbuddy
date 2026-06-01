# Fthiotida OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Fthiotida mainland bucket in the Central Greece dataset.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 11 low-confidence Fthiotida mainland records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Ai Giannis
- Agionero
- Vivos
- Kedros
- Megali Souvala
- Mikri Souvala
- Paralia Agiou Nikolaou
- Paralia Vougiouklaki
- Paralia Kanapitsa
- Paralia Triantafyllias
- Schoinia

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Fthiotida State

- Fthiotida mainland beaches: 16
- Records with direct source URLs: 12
- Low-confidence records without source URLs: 0

Fthiotida mainland now has 0 low-confidence records without direct source URLs.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1910 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
