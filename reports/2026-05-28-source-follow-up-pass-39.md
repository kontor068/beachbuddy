# Source follow-up pass 39 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Skopelos and Ikaria records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Island/area | Record | Source |
| --- | --- | --- | --- |
| Thessaly | Skopelos | Glysteri | Municipality of Skopelos |
| Thessaly | Skopelos | Limnonari | Municipality of Skopelos |
| Thessaly | Skopelos | Elios/Neo Klima | Municipality of Skopelos |
| Thessaly | Skopelos | Kastani | Municipality of Skopelos |
| Thessaly | Skopelos | Milia | Municipality of Skopelos |
| Thessaly | Skopelos | Panormos | Municipality of Skopelos |
| North Aegean | Ikaria | Armenistis | Visit Ikaria |
| North Aegean | Ikaria | Kampos | Visit Ikaria |
| North Aegean | Ikaria | Livadi | Visit Ikaria |
| North Aegean | Ikaria | Messakti | Visit Ikaria |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2543 |
| Records without direct source URL | 177 |
| Coverage | 93.5% |
| Remaining medium-confidence without direct source URL | 148 |
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
