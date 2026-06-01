# Source follow-up pass 18 - East Attica

Date: 2026-05-27

## Scope

Continued the medium-confidence/no-direct-source pass after source follow-up pass 17.

This pass only adds `metadata.sourceUrls` and conservative `metadata.sourceNotes` for identity/location traceability. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, or recommendation behavior.

## Updated records

| Region | Area | Index | Beach | Source | Source use |
| --- | --- | ---: | --- | --- | --- |
| Attica / East Attica | East Attica (mainland) | 11 | Plaz Rafinas | `https://bathingwaterprofiles.gr/el/bathingprofiles/elbw069224077101` | Official bathing-water profile; identity/location traceability only. |
| Attica / East Attica | East Attica (mainland) | 13 | Artemis | `https://bathingwaterprofiles.gr/sites/all/themes/danland/docs/pdf_profiles/ELBW069226122.pdf` | Official Loutsa Voreia 2 bathing-water profile in Spata-Artemida; Artemis/Loutsa coastal identity/local-area traceability only. |
| Attica / East Attica | East Attica (mainland) | 15 | Mikri Hamolia | `https://www.alfavita.gr/koinonia/486996_mikri-hamolia-i-exotiki-paralia-tis-attikis-poy-thymizei-nisi` | Direct local article naming Mikri Hamolia; identity/local-area traceability only. |
| Attica / East Attica | East Attica (mainland) | 19 | Paralia Agiou Spyridona | `https://bathingwaterprofiles.gr/sites/all/themes/danland/docs/pdf_profiles/ELBW069221069.pdf` | Official Porto Rafti Agios Spyridonas bathing-water profile; identity/location traceability only. |
| Attica / East Attica | East Attica (mainland) | 25 | Lombarda / Mojito Bay | `https://www.lifo.gr/guide/taste/reviews/cuba-all-day` | Direct place article linking Lombarda beach in Agia Marina with Mojito Bay; identity/local-area traceability only. |
| Attica / East Attica | East Attica (mainland) | 29 | Galazia Akti | `https://athensattica.com/el/highlight/galazia-akti-beach/` | Athens Attica tourism page; identity/location traceability only. |
| Attica / East Attica | East Attica (mainland) | 37 | Kentriki Paralia Saronidas | `https://saronikoscity.gr/wp-content/uploads/media/press/%CE%BA%CE%B1%CE%B8%CE%B1%CF%81%CE%B9%CF%83%CE%BC%CF%8C%CF%82%20%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%B9%CF%8E%CE%BD-%CE%B1%CF%86%CE%AF%CF%83%CE%B1.pdf` | Municipality beach-cleaning PDF naming Kentriki Paralia Saronidas; identity/local-area traceability only. |
| Attica / East Attica | East Attica (mainland) | 40 | Mavro Lithari / Eden Beach | `https://bathingwaterprofiles.gr/en/bathingprofiles/GRBW069225109` | Official bathing-water profile; identity/location traceability only. |
| Attica / East Attica | East Attica (mainland) | 46 | Pounda Zeza | `https://www.blueflag.gr/el/beach/poynta-zeza` | Blue Flag beach page; identity and managing-municipality traceability only. |
| Attica / East Attica | East Attica (mainland) | 54 | Paralia Souniou | `https://athensattica.com/el/highlight/paralia-souniou/` | Athens Attica tourism page; identity/location traceability only. |

## Coverage after pass

- App-facing beaches: 2720
- With direct source URL: 2334
- Without direct source URL: 386
- Direct-source coverage: 85.8%
- Low-confidence records without direct source URL: 30

## Validation

- `npm run build:beach-data` passed: split 2720 beaches into 110 region files and regenerated raw/app-ready/summary/detail files.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2334 with direct source URL, 2720 with any evidence, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config was not provided.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
