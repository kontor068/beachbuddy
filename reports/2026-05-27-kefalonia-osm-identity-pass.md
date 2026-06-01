# Kefalonia OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Kefalonia bucket in the Ionian Islands.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 33 low-confidence Kefalonia records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Amidi
- Notia Avythos Gymniston
- Cronidis Beach
- Dafnoudi
- Kimilia
- Mounda nudist
- Pessada
- Sissia
- Trapezaki nudist
- Xylokaravo
- Aspros Vrachos
- Agia Eleni
- Agia Sotira
- Ellinika
- Kako Lagkadi
- Kanali
- Koroni
- Koumaria
- Lithos
- Lagkadakia
- Lefka
- Limenia
- Myrtos
- Nipsias
- Paralia Gialiskari
- Paralia Kolpos Kormoranon
- Paralia Paliolinos
- Ragia
- Spithi
- Foki
- Psamousa
- Elies
- Chorgota

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Kefalonia State

- Kefalonia beaches: 77
- Records with direct source URLs: 55
- Low-confidence records: 37
- Low-confidence records without source URLs: 1

The one remaining low-confidence record without a direct source URL is `Mounda`. Nearby OSM data points to `Kaminia Beach`, not a clean same-name Mounda match, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1550 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
