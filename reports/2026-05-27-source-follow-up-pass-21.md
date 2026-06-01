# Source follow-up pass 21 - Skyros, Fokida, and Fthiotida

Date: 2026-05-27

## Scope

Continued the medium-confidence/no-direct-source pass after source follow-up pass 20.

This pass only adds `metadata.sourceUrls` and conservative `metadata.sourceNotes` for identity/location traceability. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, or recommendation behavior.

## Updated records

| Region | Area | Beach | Source | Source use |
| --- | --- | --- | --- | --- |
| Central Greece / Evia | Skyros | Kalamitsa | `https://www.skyros.gr/discover/general-information/beaches/` | Official Skyros municipality beach list; identity/location traceability only. |
| Central Greece / Evia | Skyros | Acherounes | `https://www.skyros.gr/discover/general-information/beaches/` | Official Skyros municipality beach list; identity/location traceability only. |
| Central Greece / Evia | Skyros | Pefkos | `https://www.gtp.gr/LocPage.asp?id=62182&lng=1` | Direct Greek Travel Pages beach/place page; identity/location traceability only. |
| Central Greece / Evia | Skyros | Agios Fokas | `https://www.skyros.gr/discover/general-information/beaches/` | Official Skyros municipality beach list; identity/location traceability only. |
| Central Greece / Fokida | Fokida mainland | Marathias | `https://greece.terrabook.com/el/phocis/page/marathias/` | Direct Terrabook Fokida page; seaside settlement/beach local-area traceability only. |
| Central Greece / Fokida | Fokida mainland | Paralia Sergoulas | `https://greece.terrabook.com/el/phocis/page/sergoula/` | Direct Terrabook Fokida page; coastal settlement/local beach area traceability only. |
| Central Greece / Fokida | Fokida mainland | Skaloma | `https://greece.terrabook.com/el/phocis/page/paralia-sto-skaloma/` | Direct Terrabook Fokida beach page; identity/location traceability only. |
| Central Greece / Fthiotida | Fthiotida mainland | Karavomylos | `https://www.gtp.gr/LocPage.asp?id=5605&lng=1` | Direct Greek Travel Pages coastal/beach place page; identity/location traceability only. |
| Central Greece / Fthiotida | Fthiotida mainland | Paralia Agiou Georgiou Pelasgias | `https://www.stylida.gr/wp-content/uploads/2025/10/9%CE%A4%CE%A85%CE%A91%CE%96-%CE%9D%CE%A7%CE%99.pdf` | Official Stylida municipality PDF naming the beach; identity/location traceability only. |
| Central Greece / Fthiotida | Fthiotida mainland | Paralia Agiou Serafeim | `https://www.xo.gr/maps/anazitisi-diefthynsis/paralia-agiou-serafeim-molos-35009/` | Direct map/address page; identity/location traceability only. |
| Central Greece / Fthiotida | Fthiotida mainland | Paralia Traganas | `https://www.vrisko.gr/maps/diefthinsi/paralia-traganas-martino-fthiotidas-35005` | Direct map/address page; identity/location traceability only. |

## Skipped

| Region | Area | Beach | Reason |
| --- | --- | --- | --- |
| Attica / Islands (Saronic & Kythira) | Kythira | Kapsali Piso Gialos | Still no direct source that clearly names it as a separate app-facing beach record. |
| Central Greece / Evia | Evia | Prasidi | Search found only weak/general locality support; left unresolved pending a stronger beach-specific source. |

## Coverage after pass

- App-facing beaches: 2720
- With direct source URL: 2363
- Without direct source URL: 357
- Direct-source coverage: 86.9%
- Low-confidence records without direct source URL: 30

## Validation

- `npm run build:beach-data` passed: split 2720 beaches into 110 region files and regenerated raw/app-ready/summary/detail files.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2363 with direct source URL, 2720 with any evidence, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config was not provided.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
