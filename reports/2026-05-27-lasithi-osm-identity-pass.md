# Lasithi OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Lasithi bucket in Crete.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 27 low-confidence Lasithi records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Atherina
- Alatsolimni
- Anaskelou
- Argilos
- Aspes
- Avlaki
- Vagi
- Vlychada Xerokampou
- Volia
- Vourlia
- Vryonisi
- Gerontolakkos
- Dianiskari
- Kalami
- Kolokytha
- Krinakia
- Livari
- Moni Kapsa
- Balos Elountas
- Botzalaki
- Paralia Vlychadia
- Paralia Richti
- Paralia tis Grias to Pidima
- Potamos Xerokampou
- Skinias
- Chiona Xerokampou
- Psili Ammos Vai

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Lasithi State

- Lasithi beaches: 59
- Records with direct source URLs: 47
- Low-confidence records: 33
- Low-confidence records without source URLs: 1

The one remaining low-confidence record without a direct source URL is `Ammos Xerokampou`. OSM has a same-coordinate `Amatos beach` feature, but this is not a clean same-name or compatible-name match, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed, 1632 / 2720 app-facing records now have direct source URLs
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed, 0 issues
- `npm run quality:beach-data`: passed, 0 findings
- `npm run content:audit`: passed, 0 findings
- `npm run build`: passed with the existing Vite large-chunk warning
- `git diff --check`: passed with existing CRLF warnings in unrelated app files

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
