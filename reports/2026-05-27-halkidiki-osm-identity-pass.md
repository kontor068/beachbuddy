# Halkidiki OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Halkidiki mainland bucket in Central Macedonia.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 27 low-confidence Halkidiki records that had exact, near-exact, transliterated, translated, or otherwise compatible OSM identity/location matches.

The update covers:

- Achlada
- Agios Georgios
- Agios Nikolaos
- Agridia
- Brounou
- Diaporti
- Faka
- Griavas
- Kakoudia
- Kalopigado
- Kavouri
- Kefalas
- Kristina
- Kryfos Paradeisos
- Lemos
- Likithos
- Limanaki
- Limani
- Livadi
- Marathias
- Myti
- Porto Koufo
- Mikri Paralia
- Tsaska
- Tsifliki
- Voreas Limani
- Voulitsa

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Halkidiki State

- Halkidiki mainland beaches: 125
- Records with direct source URLs: 120
- Low-confidence records: 78
- Low-confidence records without source URLs: 1

The one remaining low-confidence record without a direct source URL is `Totos`; no clean same-name OSM beach match was found in this pass.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1605 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
