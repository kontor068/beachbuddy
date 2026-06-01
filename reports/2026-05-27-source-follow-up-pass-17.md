# Source follow-up pass 17 - Athens coast

Date: 2026-05-27

## Scope

Continued the medium-confidence/no-direct-source pass after source follow-up pass 16.

This pass only adds `metadata.sourceUrls` and conservative `metadata.sourceNotes` for identity/location traceability. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, or recommendation behavior.

## Updated records

| Region | Area | Index | Beach | Source | Source use |
| --- | --- | ---: | --- | --- | --- |
| Attica / Central Athens | Athens area (mainland) | 1 | Palmira | `https://www.notia.gr/2013/04/katharizoume-tin-paralia-palmira-sto-p-faliro/` | Direct local notice naming Paralia Palmira in Palaio Faliro; identity/local-area traceability only. |
| Attica / Central Athens | Athens area (mainland) | 10 | Paralia Glyfadas Akti G | `https://www.athenstransport.com/2016/07/paralies-attikis-notia/` | Direct beach-access guide reference to Paralia Glyfadas G; identity/local-area traceability only. |
| Attica / Central Athens | Athens area (mainland) | 14 | V Plaz Voulas | `https://visitvarivoulavouliagmeni.gr/index.php/el/icc/item/101-v-plaz-voylas` | Official visitor page; identity/location traceability only. |
| Attica / Central Athens | Athens area (mainland) | 15 | Mikro Kavouri | `https://visitvarivoulavouliagmeni.gr/index.php/el/icc/item/108-paralies-sto-mikro-kavoyri` | Official visitor page; identity/location traceability only. |
| Attica / Central Athens | Athens area (mainland) | 17 | Megalo Kavouri | `https://visitvarivoulavouliagmeni.gr/index.php/el/icc/item/103-megalo-kavoyri` | Official visitor page; identity/location traceability only. |

## Coverage after pass

- App-facing beaches: 2720
- With direct source URL: 2324
- Without direct source URL: 396
- Direct-source coverage: 85.4%
- Low-confidence records without direct source URL: 30

## Validation

- `npm run build:beach-data` passed: split 2720 beaches into 110 region files and regenerated raw/app-ready/summary/detail files.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2324 with direct source URL, 2720 with any evidence, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config was not provided.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
