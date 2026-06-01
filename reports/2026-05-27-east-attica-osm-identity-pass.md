# East Attica OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the East Attica mainland bucket.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 28 low-confidence East Attica records that had exact, near-exact, transliterated, or otherwise compatible OSM identity/location matches.

The update covers:

- Paralia Agkona
- Mikro Sesi
- Theretro Axiomatikon Naftikou
- Ormos Lidaki
- Paralia Vravronas
- Paralia Chamolia
- Erotospilia
- Avlaki
- Panorama
- Paralia Kokoloko
- Iliopoulos
- Paralia Altheas
- Paralia Skales Altheas
- Armyrikia
- Porto Ennea
- Pefko
- Kalopigado
- Eukalypta
- Tsonima
- Deuteri Paralia Saronidas
- Skalakia Anavyssou
- Paralia Agiou Nikolaou
- Thymari
- Pasa
- Tsiou
- Asimaki
- Paralia Legrainon
- Agios Petros

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current East Attica State

- East Attica mainland beaches: 55
- Records with direct source URLs: 40
- Low-confidence records: 36
- Low-confidence records without source URLs: 5

The remaining low-confidence records without direct source URLs are:

- `Paralia Agrilezas`
- `Paralia Akrotiriou`
- `Paralia Agias Paraskevis`
- `Paralia Agiou Konstantinou`
- `Ormos Agiou Nikolaou`

`Ormos Agiou Nikolaou` has nearby generic FKK/nudist OSM labels, but no clean same-name or location-specific beach match, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1578 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
