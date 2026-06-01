# Source Follow-Up Pass 13 - 2026-05-27

## Scope

- Continue the low-confidence / no-direct-source source follow-up queue.
- Keep this pass source-only: no confidence, coordinate, access, service, amenity, wind profile, scoring, recommendation, or visible-copy changes.
- Accept only direct, location-specific sources that support identity/location enough for traceability.

## Updated Records

| Region | Record | Source | Notes |
| --- | --- | --- | --- |
| Alonissos | `Paralia Vithisma` | https://bathingwaterprofiles.gr/sites/all/themes/danland/docs/pdf_profiles/ELBW079109007.pdf | Official bathing-water profile for Chrysi Milia identifies the coast as located in `Ormos Vythisma` on eastern Alonissos. Used for local-area Vithisma identity/location only. |

## Skipped Candidates

- Several Skopelos direct sources were found for `Vathias`, `Ekatopenintari`, `Neraki/Ftelia`, `Spilia`, and `Trachili`, including official or local Skopelos pages, but their published coordinates/described coasts are several kilometers away from the stored records. They were not added in this source-only pass.
- Several Magnesia/Pelion candidates (`Elia`, `Lithos`, `Limnionas`, `Brianou`, `Plaka/Zagora`, and related sources) were skipped for the same reason: direct-source coordinates or described coasts did not safely match the stored coordinates.
- Remaining Alonissos micro-cove candidates were left unchanged where nearby OSM/reverse-source checks showed different named beaches or several-kilometer displacement from the exact-name source.

## Counts After Pass

- App-facing beaches checked: 2720
- Beaches with direct source URL: 2314
- Beaches without direct source URL: 406
- Direct source URL coverage: 85.1%
- Low-confidence app-facing records without direct source URLs: 31
- Remaining low-confidence / no-direct-source clusters:
  - Alonissos: 16
  - Skopelos: 7
  - Magnesia/Pelion: 7
  - Larissa Coast: 1
  - Chios: 0

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2314 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues. Email was skipped because dry-run email config is not set.
- `npm run build` passed. Vite reported the existing chunk-size warning.
