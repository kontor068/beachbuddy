# OSM island source pass 3 - 2026-05-27

## Scope

- Patmos
- Kalymnos
- Kimolos

## Updated records

Added direct OSM source URLs and conservative source notes to 15 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Patmos | Aspri | https://www.openstreetmap.org/node/11199343358 |
| Patmos | Chochlakas | https://www.openstreetmap.org/way/1300475646 |
| Patmos | Agios Theologos | https://www.openstreetmap.org/node/11193254926 |
| Patmos | Sapsila | https://www.openstreetmap.org/node/11195602289 |
| Patmos | Livadi Kalogiron | https://www.openstreetmap.org/way/985182562 |
| Patmos | Paralia Didymes | https://www.openstreetmap.org/way/371575332 |
| Patmos | Paralia Lefkes | https://www.openstreetmap.org/way/832173757 |
| Kalymnos | Exo Almyres | https://www.openstreetmap.org/way/487668602 |
| Kalymnos | Chali | https://www.openstreetmap.org/way/560465057 |
| Kalymnos | Tichi | https://www.openstreetmap.org/way/555253109 |
| Kalymnos | Kasonia | https://www.openstreetmap.org/way/554533590 |
| Kalymnos | Paralia Elia | https://www.openstreetmap.org/way/1230726744 |
| Kalymnos | Paralia Mikres Almyres | https://www.openstreetmap.org/way/487668601 |
| Kimolos | Ellinika | https://www.openstreetmap.org/way/303067061 |
| Kimolos | Mersina | https://www.openstreetmap.org/way/496083906 |

## Result

- App-facing records updated: 15
- App-facing beaches with direct source URL: 2138 / 2720
- App-facing beaches without direct source URL: 582
- Low-confidence app-facing beaches without direct source URL: 207

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
