# Piraeus source pass - 2026-05-27

## Scope

- Region: Attica / Piraeus / Piraeus area.
- Task: add direct source URLs and conservative source notes for low-confidence app-facing records only when the source supports identity/location.
- Boundaries: no confidence, coordinates, access, services, amenities, scoring, recommendation, UI, or windProfile changes.

## Updated records

- `Paralia Peramatos`:
  - Added `https://www.openstreetmap.org/way/632320257`.
  - OSM way is a same-name `natural=beach` feature at or very near the stored Perama/Piraeus coordinates.
  - Confidence/access/services remain unchanged.
- `Krakaris`:
  - Added `https://www.openstreetmap.org/way/835704481`.
  - OSM way is a same-name `natural=beach` feature at or very near the stored Piraeus coordinates.
  - Confidence/access/services remain unchanged.

## Skipped records

- `Plaz Kalampaka` remains without a direct source URL because this pass did not find a clean beach-specific source match.

## Result

- Added direct source URLs to 2 app-facing records.
- App-facing beaches with direct source URL: 2074 / 2720.
- App-facing beaches still without direct source URL: 646.
- App-facing low-confidence records without direct source URL: 271.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2074 / 2720 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email env vars are not configured.
- `npm run build` passed with the existing Vite large-chunk warning.
