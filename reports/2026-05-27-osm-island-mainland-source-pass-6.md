# OSM island/mainland source pass 6 - 2026-05-27

## Scope

- Paros
- Chios
- Central Athens
- East Attica
- Viotia

## Updated records

Added direct OSM source URLs and conservative source notes to 16 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Paros | Agios Dimitrios | https://www.openstreetmap.org/way/299907187 |
| Paros | Aspros Gremos | https://www.openstreetmap.org/way/591353011 |
| Paros | Voutakos | https://www.openstreetmap.org/node/4458845346 |
| Paros | Laggeri | https://www.openstreetmap.org/node/5070822567 |
| Paros | Lolantonis | https://www.openstreetmap.org/node/2407909500 |
| Chios | Vigla | https://www.openstreetmap.org/way/436655388 |
| Chios | Avlonia Pyrgiou | https://www.openstreetmap.org/way/228361517 |
| Central Athens | Paralia Agiou Alexandrou | https://www.openstreetmap.org/way/402072384 |
| Central Athens | Paralia Glyfadas Akti D | https://www.openstreetmap.org/way/217631895 |
| Central Athens | Panagitsa i Dytissa | https://www.openstreetmap.org/way/902633131 |
| East Attica | Paralia Agrilezas | https://www.openstreetmap.org/way/1189210164 |
| East Attica | Paralia Akrotiriou | https://www.openstreetmap.org/node/9941837671 |
| East Attica | Paralia Agias Paraskevis | https://www.openstreetmap.org/node/9941927358 |
| East Attica | Paralia Agiou Konstantinou | https://www.openstreetmap.org/node/9941837672 |
| Viotia | Gyalini Ammos | https://www.openstreetmap.org/way/139588071 |
| Viotia | Laimos | https://www.openstreetmap.org/way/501186572 |

## Result

- App-facing records updated: 16
- App-facing beaches with direct source URL: 2183 / 2720
- App-facing beaches without direct source URL: 537
- Low-confidence app-facing beaches without direct source URL: 162

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
