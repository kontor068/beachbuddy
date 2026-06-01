# Source follow-up pass 43 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Halkidiki, Lasithi, Evros, and Thasos records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Area | Record | Source |
| --- | --- | --- | --- |
| Central Macedonia | Halkidiki | Babylon | HalkidikiPro |
| Central Macedonia | Halkidiki | Megali Ammos | Visit Central Macedonia |
| Central Macedonia | Halkidiki | Sani Hill | Sani Resort |
| Crete | Lasithi | Plaka Eloundas | Destination Crete |
| East Macedonia and Thrace | Evros | Nea Chili | Ministry of Finance shore-use list |
| East Macedonia and Thrace | Evros | Alexandroupolis Beach | Blue Flag Greece |
| East Macedonia and Thrace | Thasos | Alexandra | Alexandra Beach |
| East Macedonia and Thrace | Thasos | Ilio Mare | Mapcarta/OpenStreetMap |
| East Macedonia and Thrace | Thasos | Dasyllio | gr-beaches |
| East Macedonia and Thrace | Thasos | Karnagio | Thassos View |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2583 |
| Records without direct source URL | 137 |
| Coverage | 95.0% |
| Remaining medium-confidence without direct source URL | 108 |
| Remaining low-confidence without direct source URL | 29 |

## Validation

Passed:

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run build`

## Notes

These sources were used only to support beach identity/location traceability.
Deep beach audit passed with 0 issues. Email dry-run was skipped because email sender/recipient config is not set.
Production build passed with the existing Vite chunk-size warning.
