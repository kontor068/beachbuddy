# OSM singleton source pass - 2026-05-27

## Scope

- Regions: Mathraki, Symi, Telendos, and Lesvos.
- Task: add direct OSM source URLs and conservative source notes for app-facing records only when OSM supports identity/location.
- Boundaries: no confidence, coordinates, access, services, amenities, scoring, recommendation, UI, or windProfile changes.

## Updated records

- `Portelo` in Mathraki:
  - Added `https://www.openstreetmap.org/way/582937467`.
  - OSM way is a same-name `natural=beach` feature near the current Mathraki Portelo coordinates.
- `Paralia tis Sara` in Symi:
  - Added `https://www.openstreetmap.org/node/5619968413`.
  - OSM node is a same-name `natural=beach` feature at or very near the current Symi coordinates.
- `Paralia Papa` in Telendos:
  - Added `https://www.openstreetmap.org/relation/541090`.
  - OSM relation is a same-name `natural=beach` feature at or very near the current Telendos coordinates.
- `Paralia Gymniston Molyvou` in Lesvos:
  - Added `https://www.openstreetmap.org/way/316865591`.
  - OSM way is a compatible translated-name `natural=beach` feature at or very near the current Molyvos coordinates.

## Result

- Added direct source URLs to 4 app-facing records.
- App-facing beaches with direct source URL: 2085 / 2720.
- App-facing beaches still without direct source URL: 635.
- App-facing low-confidence records without direct source URL: 260.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2085 / 2720 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email env vars are not configured.
- `npm run build` passed with the existing Vite large-chunk warning.
