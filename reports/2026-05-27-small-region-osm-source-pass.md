# Small-region OSM source pass - 2026-05-27

## Scope

- Regions: Aegina, Poros, and Pieria.
- Task: add direct OSM source URLs and conservative source notes for low-confidence app-facing records only when OSM supports identity/location.
- Boundaries: no confidence, coordinates, access, services, amenities, scoring, recommendation, UI, or windProfile changes.

## Updated records

- `Votsaloti Paralia` / `Pebblestone Beach` in Aegina:
  - Added `https://www.openstreetmap.org/node/1489167613`.
  - OSM node is a compatible-name `natural=beach` feature at the current Aegina coordinates.
- `Agios Stefanos` in Poros:
  - Added `https://www.openstreetmap.org/way/905767800`.
  - OSM way is a same-name `natural=beach` feature at the current Poros coordinates.
- `Pydna` in Pieria:
  - Added `https://www.openstreetmap.org/way/1428015954`.
  - OSM way is a same-name `natural=beach` feature at the current Pieria coordinates.

## Result

- Added direct source URLs to 3 app-facing records.
- App-facing beaches with direct source URL: 2077 / 2720.
- App-facing beaches still without direct source URL: 643.
- App-facing low-confidence records without direct source URL: 268.
- Aegina, Poros, and Pieria now have 0 low-confidence app-facing records without direct source URLs.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2077 / 2720 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email env vars are not configured.
- `npm run build` passed with the existing Vite large-chunk warning.
