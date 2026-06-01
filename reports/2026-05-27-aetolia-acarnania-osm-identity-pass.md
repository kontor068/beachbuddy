# Aetolia-Acarnania OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Aetolia-Acarnania mainland bucket in West Greece.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 35 low-confidence Aetolia-Acarnania records that had exact or near-exact OSM identity/location matches.

The update covers:

- Abelakia
- Agrapidia
- Athiki
- Drepano Kite Surfer's Paradise Beach
- Mylos beach
- Vali
- Agrilia
- Almyri Thalassa
- Asprogiali
- Vathia Vali
- Vela
- Giannitsa
- Louros
- Marathaki
- Marathias
- Myrtari
- Palionisi
- Paliopotamos
- Parathalasso
- Paralia Agalma
- Paralia Agias Triadas
- Paralia Agiou Ioanni
- Paralia Astrovitsa
- Paralia Vlycha
- Paralia Dioni
- Paralia Kanali
- Paralia Katergaki
- Paralia Koulouri
- Paralia Limnopoula
- Paralia Rizas
- Paralia Rembakia
- Paralia Rougas
- Paralia Sitaralonon
- Stamna
- Chioni

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Aetolia-Acarnania State

- Aetolia-Acarnania mainland beaches: 48
- Records with direct source URLs: 35
- Low-confidence records: 36
- Low-confidence records without source URLs: 1

The one remaining low-confidence record without a direct source URL is `Kitesurf Spot` near Nafpaktos/Drepano. Nearby OSM data has unnamed beach geometry and a `Kite Surfing` point, but not a clean same-name beach match, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1401 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
