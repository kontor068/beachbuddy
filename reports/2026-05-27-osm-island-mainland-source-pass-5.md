# OSM island/mainland source pass 5 - 2026-05-27

## Scope

- Thasos
- Zakynthos
- Achaia

## Updated records

Added direct OSM source URLs and conservative source notes to 15 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Thasos | Agia Paraskevi | https://www.openstreetmap.org/way/208159692 |
| Thasos | Kalami | https://www.openstreetmap.org/way/204558366 |
| Thasos | Livadi | https://www.openstreetmap.org/way/163979537 |
| Thasos | Agios Vasileios | https://www.openstreetmap.org/way/1355935767 |
| Zakynthos | Korakonisi | https://www.openstreetmap.org/node/12364731733 |
| Zakynthos | Kremidi | https://www.openstreetmap.org/way/1443426543 |
| Zakynthos | Mikri Xygkia | https://www.openstreetmap.org/way/212493866 |
| Zakynthos | Vathy Lagadi | https://www.openstreetmap.org/way/521006695 |
| Zakynthos | Atsigganos | https://www.openstreetmap.org/way/372841420 |
| Zakynthos | Kamaroti | https://www.openstreetmap.org/way/1419238906 |
| Zakynthos | Paralia Selinas Filippon | https://www.openstreetmap.org/way/1086880316 |
| Achaia | Vathi | https://www.openstreetmap.org/way/1004055922 |
| Achaia | Paralia Aliki | https://www.openstreetmap.org/way/274930505 |
| Achaia | Paralia Egkali | https://www.openstreetmap.org/way/753410712 |
| Achaia | Trypia | https://www.openstreetmap.org/way/497716086 |

## Result

- App-facing records updated: 15
- App-facing beaches with direct source URL: 2167 / 2720
- App-facing beaches without direct source URL: 553
- Low-confidence app-facing beaches without direct source URL: 178

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
