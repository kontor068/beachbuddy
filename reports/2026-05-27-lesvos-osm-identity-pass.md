# Lesvos OSM identity/location pass - 2026-05-27

## Scope

Continued the Phase 2 second-pass data work with a focused OSM identity/location pass for the Lesvos bucket in North Aegean.

## What changed

Added direct OpenStreetMap source URLs and conservative source notes for 40 low-confidence Lesvos records that had exact or near-exact same-name or compatible-name OSM identity/location matches.

The update covers:

- Ampelia
- Andromachi
- Apergousa
- Vathy Kritiri
- Vatrachia
- Elefkos
- Kampos
- Kalo Limani
- Katavathra
- Lapsarna
- Limenas
- Lagkada
- Lamprini or Ouzoun Sokak
- Ligonari
- Limantziki
- Makara
- Malathra
- Bakeros
- Mpalini
- Niselia
- Ntalantos
- Xeres Evreiakis
- Patos
- Paralia Ammoudi
- Paralia Gymniston Eresou
- Paralia Gymniston Chrousos
- Paralia Drotas
- Peristeria
- Petalidi
- Podaras
- Pyramies
- Tilegrafos
- Tsilia
- Tsipouria
- Tsichliota
- Faneromeni
- Fikiotrypa
- Chalatses
- Charamida niseli
- Chrousos

Confidence was intentionally kept low because the OSM matches verify identity/location only. Access, parking, services, organization, and amenity claims were not strengthened without direct local sources.

## Current Lesvos State

- Lesvos beaches: 60
- Records with direct source URLs: 41
- Low-confidence records: 41
- Low-confidence records without source URLs: 1

The one remaining low-confidence record without a direct source URL is `Paralia Gymniston Molyvou`. OSM has a same-coordinate generic `Naturist beach` feature, but not a clean same-name or location-specific beach name, so no source URL was added.

## Validation

- `npm run build:beach-data`: passed, 2720 beaches split into 110 region files
- `node scripts/auditBeachVerificationCoverage.mjs`: passed with 0 findings; direct source URL coverage is now 1441 / 2720 beaches
- `npm run audit:beaches -- --mode=deep --email-dry-run`: passed with 0 BLOCKER/HIGH/MEDIUM/LOW issues
- `npm run quality:beach-data`: passed with 0 findings
- `npm run content:audit`: passed with 0 findings

## Remaining Risk

These records are now source-linked for identity/location, but they still need direct local/official sources before promoting confidence or strengthening access, parking, organization, or amenity wording.
