# Lakonia OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Lakonia mainland bucket in Peloponnese.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 37 low-confidence Lakonia records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Agia Varvara
- Agia Kyriaki
- Agios Kyprianos
- Alypa
- Ampelo
- Androgyalos
- Artani
- Vlychada
- Vordonas
- Gialos
- Drimiskos
- Thyni
- Kalamakia
- Kastella
- Kochylas
- Kyani Akti
- Limani
- Megali Ammos
- Mpalogkeri / Ntamos
- Molos
- Paralia Aglyftis
- Paralia Valtaki
- Paralia Kalevolou
- Paralia Kokkinia
- Paralia Lefkis
- Paralia Pikrias
- Paralia Trinisa
- Pori
- Poulia
- Proto Avlaki
- Pyla
- Pyliza
- Romaiki Paralia
- Skopa
- Chalikia
- Chalikia Vata
- Charakia

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Lakonia State

- Lakonia mainland beaches: 61
- Records with direct source URLs: 43
- Low-confidence records: 39
- Low-confidence records without source URLs: 2

The remaining low-confidence records without direct source URLs are:

- `Anepisimi Gymnistiki Paralia`: OSM has a same-coordinate generic `FFK Unofficial Beach` feature, but this is not a clean location-specific beach name.
- `Paralia 100 Rizes`: no clean same-name OSM beach match was found in this pass.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1517 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
