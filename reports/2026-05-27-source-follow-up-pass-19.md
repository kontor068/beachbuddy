# Source follow-up pass 19 - Aegina and Kythira

Date: 2026-05-27

## Scope

Continued the medium-confidence/no-direct-source pass after source follow-up pass 18.

This pass only adds `metadata.sourceUrls` and conservative `metadata.sourceNotes` for identity/location traceability. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, or recommendation behavior.

## Updated records

| Region | Area | Index | Beach | Source | Source use |
| --- | --- | ---: | --- | --- | --- |
| Attica / Islands (Saronic & Kythira) | Aegina | 3 | Avra | `https://www.allovergreece.com/Beaches/Descr/55/530/el` | Direct beach page supporting Avra beach identity/location in Aegina town only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 7 | Platia Ammos | `https://visitkythera.com/beaches/platia-ammos/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 8 | Fourni | `https://visitkythera.com/beaches/fourni/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 10 | Agia Pelagia | `https://visitkythera.com/beaches/agia-pelagia-beach/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 11 | Fyri Ammos of Agia Pelagia | `https://visitkythera.com/beaches/fyri-ammos-of-agia-pelagia/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 14 | Kakia Lagada | `https://visitkythera.com/beaches/limni-kakias-lagadas/` | Direct Visit Kythera beach page for Limni Kakias Lagadas; coastal identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 20 | Lykodimou | `https://visitkythera.com/beaches/lykodimou/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 21 | Diakofti | `https://visitkythera.com/in/diakofti-2/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 23 | Limnionas | `https://visitkythera.com/beaches/limnionas/` | Direct Visit Kythera beach page; identity/location traceability only. |
| Attica / Islands (Saronic & Kythira) | Kythira | 28 | Komponada | `https://visitkythera.com/beaches/komponada/` | Direct Visit Kythera beach page; identity/location traceability only. |

## Coverage after pass

- App-facing beaches: 2720
- With direct source URL: 2344
- Without direct source URL: 376
- Direct-source coverage: 86.2%
- Low-confidence records without direct source URL: 30

## Validation

- `npm run build:beach-data` passed: split 2720 beaches into 110 region files and regenerated raw/app-ready/summary/detail files.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2344 with direct source URL, 2720 with any evidence, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config was not provided.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
