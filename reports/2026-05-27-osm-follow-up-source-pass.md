# OSM follow-up source pass - 2026-05-27

## Scope

- Regions: Chania, Rethymno, Paxos, and Kastellorizo.
- Task: add direct OSM source URLs and conservative source notes for app-facing records only when OSM supports identity/location.
- Boundaries: no confidence, coordinates, access, services, amenities, scoring, recommendation, UI, or windProfile changes.

## Updated records

- `Ammos` in Chania:
  - Added `https://www.openstreetmap.org/way/703355574`.
  - OSM way is a same-name `leisure=beach_resort` feature at or very near the current Chania Ammos coordinates.
  - Used only for identity/location; not used to promote organized-service, access, confidence, amenity, or recommendation claims.
- `Agios Georgios` in Rethymno:
  - Added `https://www.openstreetmap.org/way/506204982`.
  - OSM way is a same-name `natural=beach` feature at or very near the current Rethymno coordinates.
- `Kaki Lagkada` in Paxos:
  - Added `https://www.openstreetmap.org/way/496953797`.
  - OSM way is a same/compatible-name `natural=beach` feature at or very near the current Paxos coordinates.
- `Plakes` in Kastellorizo:
  - Added `https://www.openstreetmap.org/node/8225101761`.
  - OSM node is a same-name `natural=beach` feature at or very near the current Kastellorizo coordinates.

## Result

- Added direct source URLs to 4 app-facing records.
- App-facing beaches with direct source URL: 2081 / 2720.
- App-facing beaches still without direct source URL: 639.
- App-facing low-confidence records without direct source URL: 264.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2081 / 2720 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email env vars are not configured.
- `npm run build` passed with the existing Vite large-chunk warning.
