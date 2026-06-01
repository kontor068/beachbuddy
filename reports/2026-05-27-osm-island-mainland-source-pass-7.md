# OSM island/mainland source pass 7 - 2026-05-27

## Scope

- West Attica
- Kavala
- Gavdos
- Fokida

## Updated records

Added direct OSM source URLs and conservative source notes to 20 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| West Attica | Akrogiali | https://www.openstreetmap.org/way/486082647 |
| West Attica | Paralia Kinetas | https://www.openstreetmap.org/way/100003490 |
| West Attica | Paralia Porto Germeno | https://www.openstreetmap.org/way/362625307 |
| West Attica | Paralia Porto Germeno south section | https://www.openstreetmap.org/way/362625397 |
| West Attica | Prosili | https://www.openstreetmap.org/way/501198603 |
| Kavala | Monastiraki Beach | https://www.openstreetmap.org/node/9977470902 |
| Kavala | Vrasidas | https://www.openstreetmap.org/way/433770436 |
| Kavala | Paralia Gymniston | https://www.openstreetmap.org/way/1367278914 |
| Kavala | Psatha | https://www.openstreetmap.org/way/360468254 |
| Gavdos | Pyrgos | https://www.openstreetmap.org/node/12182137908 |
| Gavdos | Livas | https://www.openstreetmap.org/way/184323164 |
| Gavdos | Agios Ioannis | https://www.openstreetmap.org/way/628641964 |
| Gavdos | Lavrakas | https://www.openstreetmap.org/node/12182137909 |
| Fokida | Aspra Chalikia | https://www.openstreetmap.org/way/901947085 |
| Fokida | Kapsales | https://www.openstreetmap.org/way/901946395 |
| Fokida | Kokkina Chalikia | https://www.openstreetmap.org/way/520369138 |
| Fokida | Monolithos | https://www.openstreetmap.org/way/901950672 |
| Fokida | Paralia Agiou Andrea | https://www.openstreetmap.org/way/1020812871 |
| Fokida | Paralia Agiou Mina | https://www.openstreetmap.org/way/1020814995 |
| Fokida | Skoules Mikri kai Megali | https://www.openstreetmap.org/node/9609039281 |

## Result

- App-facing records updated: 20
- App-facing beaches with direct source URL: 2203 / 2720
- App-facing beaches without direct source URL: 517
- Low-confidence app-facing beaches without direct source URL: 142

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
