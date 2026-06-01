# OSM grouped source pass - 2026-05-27

## Scope

- Heraklion
- Rodopi
- Lefkada
- Serifos
- Santorini

## Updated records

Added direct OSM source URLs and conservative source notes to 10 app-facing records:

| Region | Beach | Source |
| --- | --- | --- |
| Heraklion | Afrathia | https://www.openstreetmap.org/way/376851223 |
| Heraklion | Psili Ammos | https://www.openstreetmap.org/way/506218119 |
| Rodopi | Marmaritsa | https://www.openstreetmap.org/node/4811497110 |
| Rodopi | Pachynammos | https://www.openstreetmap.org/way/214735749 |
| Rodopi | Synaxi | https://www.openstreetmap.org/way/620278247 |
| Lefkada | Limni / Strofi | https://www.openstreetmap.org/way/369335698 |
| Serifos | Agios Sostis | https://www.openstreetmap.org/way/195495772 |
| Serifos | Kalogeros | https://www.openstreetmap.org/way/195497752 |
| Serifos | Skala | https://www.openstreetmap.org/way/549414803 |
| Santorini | Paralia Kerkezou | https://www.openstreetmap.org/way/444941596 |

## Result

- App-facing records updated: 10
- App-facing beaches with direct source URL: 2098 / 2720
- App-facing beaches without direct source URL: 622
- Low-confidence app-facing beaches without direct source URL: 247

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
