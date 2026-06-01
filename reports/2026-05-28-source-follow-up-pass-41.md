# Source follow-up pass 41 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Lefkada, Meganisi, Erikoussa, and Chios records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Area | Record | Source |
| --- | --- | --- | --- |
| Ionian Islands | Lefkada | Breath of Zorbas beach | Breath of Zorbas |
| Ionian Islands | Meganisi | Atherinos | Visit Meganisi |
| Ionian Islands | Meganisi | Agios Ioannis | Visit Meganisi |
| Ionian Islands | Meganisi | Pasoumaki | Visit Meganisi |
| Ionian Islands | Meganisi | Spilia/Roka | Visit Meganisi |
| Ionian Islands | Meganisi | Fanari | Visit Meganisi |
| Ionian Islands | Erikoussa | Bragini/Brakini | Greek Travel Pages |
| Ionian Islands | Erikoussa | Porto | Greek Travel Pages |
| North Aegean | Chios | Managros | Chios Life |
| North Aegean | Chios | Megas Limnionas | GetGreece |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2563 |
| Records without direct source URL | 157 |
| Coverage | 94.2% |
| Remaining medium-confidence without direct source URL | 128 |
| Remaining low-confidence without direct source URL | 29 |

## Validation

Passed:

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run build`

Notes:

- Deep beach audit passed with 0 issues; email dry-run was skipped because email sender/recipient config is not set.
- Production build passed with the existing Vite chunk-size warning.

## Notes

These sources were used only to support beach identity/location traceability.
