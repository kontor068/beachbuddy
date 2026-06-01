# OSM island source pass 4 - 2026-05-27

## Scope

- Koufonisia
- Samos
- Lemnos

## Updated records

Added direct OSM source URLs and conservative source notes to 14 app-facing records, plus one excluded Koufonisia duplicate that does not count toward app-facing coverage:

| Region | Beach | Source |
| --- | --- | --- |
| Koufonisia | Italida | https://www.openstreetmap.org/way/229796830 |
| Koufonisia | Limni excluded duplicate | https://www.openstreetmap.org/way/229796834 |
| Koufonisia | Loutro | https://www.openstreetmap.org/way/229796835 |
| Koufonisia | Porta | https://www.openstreetmap.org/way/229796841 |
| Samos | Aspres (west coast) | https://www.openstreetmap.org/way/249322138 |
| Samos | Chantaki | https://www.openstreetmap.org/way/249322002 |
| Samos | Mikra Lemonakia | https://www.openstreetmap.org/way/235112628 |
| Samos | Trypiti | https://www.openstreetmap.org/way/92688951 |
| Samos | Aspres (east coast) | https://www.openstreetmap.org/way/249321602 |
| Lemnos | Katapodi | https://www.openstreetmap.org/way/263926968 |
| Lemnos | Limani Agias | https://www.openstreetmap.org/way/263268460 |
| Lemnos | Skidi | https://www.openstreetmap.org/way/115699067 |
| Lemnos | Trygi | https://www.openstreetmap.org/way/113867620 |
| Lemnos | Zematas | https://www.openstreetmap.org/way/115657461 |
| Lemnos | Kallithea | https://www.openstreetmap.org/way/1246250229 |

## Result

- Source metadata records updated: 15
- App-facing coverage additions: 14
- App-facing beaches with direct source URL: 2152 / 2720
- App-facing beaches without direct source URL: 568
- Low-confidence app-facing beaches without direct source URL: 193

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
