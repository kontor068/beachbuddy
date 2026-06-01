# OSM small-pair source pass - 2026-05-27

## Scope

- Regions: Arta and Mykonos.
- Task: add direct OSM source URLs and conservative source notes for app-facing records only when OSM supports identity/location.
- Boundaries: no confidence, coordinates, access, services, amenities, scoring, recommendation, UI, or windProfile changes.

## Updated records

- `Paralia Salaoras` in Arta:
  - Added `https://www.openstreetmap.org/way/391952316`.
  - OSM way is a same-name `natural=beach` feature near the current Arta coordinates.
- `Mersini` in Mykonos:
  - Added `https://www.openstreetmap.org/way/366320150`.
  - OSM way is a same-name `natural=beach` feature at or very near the current Mykonos coordinates.
- `Tigani` in Mykonos:
  - Added `https://www.openstreetmap.org/way/366472564`.
  - OSM way is a same-name `natural=beach` feature at or very near the current Mykonos coordinates.

## Result

- Added direct source URLs to 3 app-facing records.
- App-facing beaches with direct source URL: 2088 / 2720.
- App-facing beaches still without direct source URL: 632.
- App-facing low-confidence records without direct source URL: 257.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2088 / 2720 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email env vars are not configured.
- `npm run build` passed with the existing Vite large-chunk warning.
