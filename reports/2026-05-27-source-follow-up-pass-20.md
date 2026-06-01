# Source follow-up pass 20 - Kythira, Spetses, and Evia

Date: 2026-05-27

## Scope

Continued the medium-confidence/no-direct-source pass after source follow-up pass 19.

This pass only adds `metadata.sourceUrls` and conservative `metadata.sourceNotes` for identity/location traceability. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, or recommendation behavior.

## Updated records

| Region | Area | Beach | Source | Source use |
| --- | --- | --- | --- | --- |
| Attica / Islands (Saronic & Kythira) | Kythira | Fyri Ammos of Kalamos | `https://visitkythera.com/in/fyri-ammos-kalamos/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | Kapsali | `https://visitkythera.com/beaches/kapsali-2/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | Chalkos | `https://visitkythera.com/beaches/chalkos/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Spetses | Ligoneri | `https://spetses.gov.gr/2020/06/11/%CE%BB%CE%B9%CE%B3%CE%BF%CE%BD%CE%AD%CF%81%CE%B9/` | Official Spetses municipality page; identity/location traceability only. |
| Central Greece / Evia | Evia | Porto Pefko | `https://evoia-meta.gov.gr/wp-content/uploads/2022/03/%CE%94%CE%A1%CE%95%CE%A4%CE%91-%CE%9C%CE%95%CE%9B%CE%95%CE%A4%CE%97_A-%CE%A6%CE%91%CE%A3%CE%97_%CE%A3%CF%84%CF%81%CE%B1%CF%84%CE%B7%CE%B3%CE%B9%CE%BA%CF%8C%CF%82-%CE%A3%CF%87%CE%B5%CE%B4%CE%B9%CE%B1%CF%83%CE%BC%CF%8C%CF%82-Marketing_%CE%B2%CF%8C%CF%81%CE%B5%CE%B9%CE%B1-%CE%95%CF%8D%CE%B2%CE%BF%CE%B9%CE%B1_19.03.pptx.pdf` | North Evia reconstruction/marketing study reference; identity/local-area traceability only. |
| Central Greece / Evia | Evia | Soutsini | `https://www.gtp.gr/LocPage.asp?id=72975&lng=1` | Direct Greek Travel Pages beach page; identity/location traceability only. |
| Central Greece / Evia | Evia | Chiliadou | `https://www.allovergreece.com/Beaches/Descr/100/973/el` | Direct AllOverGreece beach page; identity/location traceability only. |
| Central Greece / Evia | Evia | Chrisi Akti | `https://eviagreece.gr/item/xrisi-akti/` | Direct EviaGreece beach page; identity/location traceability only. |

## Skipped

| Region | Area | Beach | Reason |
| --- | --- | --- | --- |
| Attica / Islands (Saronic & Kythira) | Kythira | Kapsali Piso Gialos | The available Kapsali source supports the broader Kapsali beach/twin-bay area, but did not clearly name Piso Gialos as a separate app-facing beach record. Left without direct source URL. |

## Coverage after pass

- App-facing beaches: 2720
- With direct source URL: 2352
- Without direct source URL: 368
- Direct-source coverage: 86.5%
- Low-confidence records without direct source URL: 30

## Validation

- `npm run build:beach-data` passed: split 2720 beaches into 110 region files and regenerated raw/app-ready/summary/detail files.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2352 with direct source URL, 2720 with any evidence, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config was not provided.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
