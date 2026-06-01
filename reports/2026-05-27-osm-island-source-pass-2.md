# OSM island source pass 2 - 2026-05-27

## Scope

- Kasos
- Astypalaia
- Ikaria

## Updated records

Added direct OSM source URLs and conservative source notes to 15 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Kasos | Chelatros | https://www.openstreetmap.org/way/1174878152 |
| Kasos | Chochlakia | https://www.openstreetmap.org/way/1174876404 |
| Kasos | Mikro Avlaki | https://www.openstreetmap.org/way/1174875894 |
| Kasos | Paralia Trita | https://www.openstreetmap.org/way/1174860330 |
| Kasos | Ammoua | https://www.openstreetmap.org/node/3282762384 |
| Astypalaia | Agios Vasileios | https://www.openstreetmap.org/node/8060699680 |
| Astypalaia | Vai | https://www.openstreetmap.org/way/395253610 |
| Astypalaia | Vatses | https://www.openstreetmap.org/way/125107425 |
| Astypalaia | Kaminakia | https://www.openstreetmap.org/way/395253615 |
| Astypalaia | Mikres Vatses | https://www.openstreetmap.org/way/498250877 |
| Astypalaia | Panormos | https://www.openstreetmap.org/way/498243550 |
| Astypalaia | Pachia Ammos | https://www.openstreetmap.org/way/498279267 |
| Astypalaia | Psili Ammos | https://www.openstreetmap.org/way/498266579 |
| Ikaria | Kyparissi | https://www.openstreetmap.org/way/171901129 |
| Ikaria | Partheni | https://www.openstreetmap.org/way/432337594 |

## Result

- App-facing records updated: 15
- App-facing beaches with direct source URL: 2123 / 2720
- App-facing beaches without direct source URL: 597
- Low-confidence app-facing beaches without direct source URL: 222

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
