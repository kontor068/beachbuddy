# Source follow-up pass 42 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Epirus, Argolida, and Lakonia records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Area | Record | Source |
| --- | --- | --- | --- |
| Epirus | Parga | Piso Kryoneri | AllOverGreece |
| Epirus | Thesprotia | Mega Drafi | AllOverGreece |
| Epirus | Thesprotia | Plataria | Greece.com |
| Peloponnese | Argolida | Lepitsa | AllOverGreece |
| Peloponnese | Argolida | Petrothalassa | Greece.com |
| Peloponnese | Argolida | Kiveri | Discover Peloponnese |
| Peloponnese | Argolida | Myloi | Mythical Peloponnese |
| Peloponnese | Lakonia | Marmari | AllOverGreece |
| Peloponnese | Lakonia | Plytra/Pachia Ammos | AllOverGreece |
| Peloponnese | Lakonia | Porto Kagio | AllOverGreece |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2573 |
| Records without direct source URL | 147 |
| Coverage | 94.6% |
| Remaining medium-confidence without direct source URL | 118 |
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
