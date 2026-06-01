# Source follow-up pass 38 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Alonissos records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Island/area | Record | Source |
| --- | --- | --- | --- |
| Thessaly | Alonissos | Glifa | Municipality of Alonissos |
| Thessaly | Alonissos | Kokkinokastro | Municipality of Alonissos |
| Thessaly | Alonissos | Leftos Yalos | Municipality of Alonissos |
| Thessaly | Alonissos | Milia | Municipality of Alonissos |
| Thessaly | Alonissos | Spartines | Municipality of Alonissos |
| Thessaly | Alonissos | Votsi | Municipality of Alonissos |
| Thessaly | Alonissos | Roussoum Yalos | Municipality of Alonissos |
| Thessaly | Alonissos | Megalos Mourtias | Municipality of Alonissos |
| Thessaly | Alonissos | Tzortzis Gialos | AllOverGreece |
| Thessaly | Alonissos | Tsoukalia | Municipality of Alonissos |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2533 |
| Records without direct source URL | 187 |
| Coverage | 93.1% |
| Remaining medium-confidence without direct source URL | 158 |
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
