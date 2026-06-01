# Source follow-up pass 40 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Preveza/Parga and Kavala records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Area | Record | Source |
| --- | --- | --- | --- |
| Epirus | Preveza/Parga | Alonaki Fanariou | Visit Preveza |
| Epirus | Preveza | Alonaki Prevezas | Visit Preveza |
| Epirus | Parga | Kryoneri | Visit Preveza |
| Epirus | Preveza | Kyani Akti | Visit Preveza |
| Epirus | Preveza | Pantokratoras | Visit Preveza |
| Epirus | Preveza/Parga | Ammoudia | Visit Preveza |
| Epirus | Parga | Lychnos | Visit Preveza |
| Epirus | Parga | Sarakiniko | Visit Preveza |
| East Macedonia and Thrace | Kavala | Kalamitsa | Visit Kavala |
| East Macedonia and Thrace | Kavala | Rapsani | Visit Kavala |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2553 |
| Records without direct source URL | 167 |
| Coverage | 93.9% |
| Remaining medium-confidence without direct source URL | 138 |
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
