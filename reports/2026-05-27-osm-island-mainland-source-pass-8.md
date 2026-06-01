# OSM island/mainland source pass 8 - 2026-05-27

## Scope

- Thessaloniki
- Ithaca
- Lefkada
- Karpathos

## Updated records

Added direct OSM source URLs and conservative source notes to 12 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Thessaloniki | Plaz Aretsous | https://www.openstreetmap.org/way/56435850 |
| Thessaloniki | Giatrou Tsairi | https://www.openstreetmap.org/way/1294663914 |
| Thessaloniki | Kroustali | https://www.openstreetmap.org/way/1294663915 |
| Thessaloniki | Patoma | https://www.openstreetmap.org/way/1294663916 |
| Thessaloniki | Trapezi | https://www.openstreetmap.org/way/1292475334 |
| Ithaca | Aspros Gialos | https://www.openstreetmap.org/way/443463587 |
| Ithaca | Mikri Poli | https://www.openstreetmap.org/node/10888976158 |
| Lefkada | Asprogialos | https://www.openstreetmap.org/way/137726047 |
| Lefkada | Fteri | https://www.openstreetmap.org/way/72157231 |
| Karpathos | Vananda | https://www.openstreetmap.org/way/409106843 |
| Karpathos | Votsalakia | https://www.openstreetmap.org/way/445457766 |
| Karpathos | Agios Minas | https://www.openstreetmap.org/way/414230779 |

## Result

- App-facing records updated: 12
- App-facing beaches with direct source URL: 2215 / 2720
- App-facing beaches without direct source URL: 505
- Low-confidence app-facing beaches without direct source URL: 130

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
