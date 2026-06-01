# Source Follow-up Pass 7 - 2026-05-27

## Scope

- Added direct `metadata.sourceUrls` only where a direct source supported beach identity/location.
- Kept confidence, coordinates, access, services, amenities, wind profile, recommendation logic, and scoring unchanged.
- Skipped candidate sources when the named feature appeared several kilometers away from the stored coordinates or supported only a broader locality.

## Records Updated

| Region | Record | Source support |
| --- | --- | --- |
| East Attica | `Ormos Agiou Nikolaou` at Anavyssos | NouPou local beach article and Athens Transport beach access list mention Agios Nikolaos / Kolpos Agiou Nikolaou Anavyssos. |
| Lakonia | Generic unofficial nudist beach record near Vathi/Ageranos | Same-coordinate OSM natural=beach feature named `FFK Unofficial Beach`. |

## Sources

- https://www.noupou.gr/kids/oi-kaliteres-paralies-sta-notia-gia-oikogeneies/
- https://www.athenstransport.com/2016/07/paralies-attikis-notia/
- https://www.openstreetmap.org/node/13112550661
- https://mapcarta.com/N13112550661

## Expected Counts

- App-facing beaches: 2720.
- Beaches with direct source URL: 2303.
- Beaches without direct source URL: 417.
- Low-confidence app-facing beaches without direct source URL: 42.
- East Attica low-confidence app-facing beaches without direct source URL: 0.
- Lakonia low-confidence app-facing beaches without direct source URL: 0.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2303 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config is absent.
- `npm run build` passed with the existing Vite large-chunk warning.
