# Samos OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Samos bucket in North Aegean.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 11 low-confidence Samos records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Aspros Kavos
- Arapis
- Varsamo
- Kakorema
- Koukounara
- Kyriakou
- Mikro Seitani
- Mourtia
- Paralia Vergis
- Paralia Kampou Vourlioton
- Roditses

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Samos State

- Samos beaches: 40
- Records with direct source URLs: 19
- Low-confidence records without source URLs: 10

The remaining low-confidence records without direct source URLs are `Agios Nikolaos`, `Aspres (west coast)`, `Agios Ioannis Eleimonas`, `Chantaki`, the two `Plaka` cove records, `Mikra Lemonakia`, `Trypiti`, `Klima`, and `Aspres (east coast)`.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1746 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
