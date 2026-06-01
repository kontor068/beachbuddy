# Lemnos OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Lemnos bucket in North Aegean.

Alonissos was reviewed first in this cycle but skipped because candidate OSM beach matches were often too far from stored coordinates for a source-only identity/location pass. That bucket needs geodata review before adding source URLs.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 11 low-confidence Lemnos records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Louri
- Parthenomythos
- Skandali
- Vathrakas
- Katalakko
- Mandri
- Neftina
- Paralia Makrys Gialos
- Stivi i Plagisos Molos
- Plaka
- Faraklou

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Lemnos State

- Lemnos beaches: 40
- Records with direct source URLs: 18
- Low-confidence records without source URLs: 11

The remaining low-confidence records without direct source URLs are `Karvounolakka`, `Katapodi`, the two `Kokkina` cove records, `Limani Agias`, `Panagias Pigadeli`, `Skidi`, `Trygi`, `Zematas`, `Kallithea`, and `Tigani`.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1735 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
