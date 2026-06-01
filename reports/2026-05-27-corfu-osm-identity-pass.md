# Corfu OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Corfu bucket in the Ionian Islands.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 39 low-confidence Corfu records that had exact or near-exact same-name or compatible-name OSM identity/location matches.

The update covers:

- Alonaki Bay
- Black Rocks Beach
- Galiskari Beach
- Karavi Beach
- Maltas beach
- Skalia beach
- Agia Aikaterini
- Astrakeri
- Kamari
- Kanoni
- Kardaki
- Krouza
- Maistros
- Mandraki
- Boukari
- Molos
- Paralia Agios Nikolaos
- Paralia Agios Spyridonas
- Paralia Ermones
- Paralia Ampelaki
- Paralia Arkoudila
- Paralia Kanoulas
- Paralia Klimatia
- Paralia Kontokaliou
- Paralia Limni
- Paralia Lakkies
- Paralia Liapadon
- Paralia Bouka
- Paralia NAOK
- Paralia Parakladi
- Paralia Skaloma
- Paralia Syki
- Paralia Myrtiotissas
- Petriti
- Prasoudi
- Rovinia
- Sotiriotissa
- Tramountana
- Antipsos

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Corfu State

- Corfu beaches: 91
- Records with direct source URLs: 73
- Low-confidence records: 63
- Low-confidence records without source URLs: 1

The one remaining low-confidence record without a direct source URL is `Agios Ioannis Peristeron`. OSM has a same-coordinate abbreviated `Ag, Giannis` feature, but not a clean same-name or location-specific match, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1480 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
