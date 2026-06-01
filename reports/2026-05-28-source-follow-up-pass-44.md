# Source follow-up pass 44 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Peloponnese records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Area | Record | Source |
| --- | --- | --- | --- |
| Peloponnese | Argolida | Ververonta | TerraBook |
| Peloponnese | Argolida | Vagionia | official bathing-water profile |
| Peloponnese | Argolida | Kantia | official bathing-water profile |
| Peloponnese | Argolida | Timenio | official bathing-water profile |
| Peloponnese | Arkadia | Atsigganos | GreekMap |
| Peloponnese | Arkadia | Xiropigado | Discover Kynouria |
| Peloponnese | Arkadia | Poulithra | Visit Peloponnese |
| Peloponnese | Korinthia | Megalo Amoni | Epidavros Villas |
| Peloponnese | Korinthia | Lake Vouliagmeni/Heraion beach | Visit Loutraki |
| Peloponnese | Messinia | Divari | AllOverGreece |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2593 |
| Records without direct source URL | 127 |
| Coverage | 95.3% |
| Remaining medium-confidence without direct source URL | 98 |
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
