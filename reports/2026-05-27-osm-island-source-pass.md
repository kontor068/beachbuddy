# OSM island source pass - 2026-05-27

## Scope

- Agios Efstratios
- Leros
- Tilos

## Updated records

Added direct OSM source URLs and conservative source notes to 10 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Agios Efstratios | Agios Dimitrios | https://www.openstreetmap.org/way/139904306 |
| Agios Efstratios | Agios Antonios | https://www.openstreetmap.org/way/139905494 |
| Agios Efstratios | Alonitsi | https://www.openstreetmap.org/way/1275844411 |
| Agios Efstratios | Trigari | https://www.openstreetmap.org/way/1275843802 |
| Agios Efstratios | Fragkou | https://www.openstreetmap.org/way/400060973 |
| Leros | Kioura | https://www.openstreetmap.org/way/353706321 |
| Leros | Kokkini paralia | https://www.openstreetmap.org/way/355807297 |
| Leros | Paralia Agias Kiouras | https://www.openstreetmap.org/way/353054782 |
| Tilos | Limenari | https://www.openstreetmap.org/way/505264166 |
| Tilos | Paralia Kokkini | https://www.openstreetmap.org/way/1388809567 |

## Result

- App-facing records updated: 10
- App-facing beaches with direct source URL: 2108 / 2720
- App-facing beaches without direct source URL: 612
- Low-confidence app-facing beaches without direct source URL: 237

## Constraints

- These sources support identity/location only.
- Confidence, coordinates, access, amenities, services, scoring, recommendations, and UI were not changed.

## Validation

- Passed: `npm run build:beach-data`
- Passed: `node scripts/auditBeachVerificationCoverage.mjs`
- Passed: `npm run quality:beach-data`
- Passed: `npm run content:audit`
- Passed: `npm run audit:beaches -- --mode=deep --email-dry-run`
- Passed: `npm run build`

Notes:
- The deep audit email step was skipped because email config is not set, as expected for dry-run local validation.
- The production build emitted the existing Vite large-chunk warning; build status was successful.
