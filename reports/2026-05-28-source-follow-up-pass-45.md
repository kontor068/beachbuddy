# Source follow-up pass 45 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 app-facing Kythira, Evia, Crete, East Macedonia and Thrace, Ionian Islands, and Lesvos records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Area | Record | Source |
| --- | --- | --- | --- |
| Attica | Kythira | Kapsali Piso Gialos | Mapcarta |
| Central Greece | Evia | Prasidi | local Evia beach article |
| Crete | Lasithi | Kakkos | Kakkos Bay |
| East Macedonia and Thrace | Kavala | Nea Karvali | official bathing-water profile |
| East Macedonia and Thrace | Rodopi | Imeros Beach | official bathing-water profile |
| Ionian Islands | Corfu | Notos | Greek Travel Pages |
| Ionian Islands | Othonoi | Molos | Ferryhopper |
| North Aegean | Lesvos | Ammoudeli | official bathing-water profile |
| North Aegean | Lesvos | Avlaki | ERT News |
| North Aegean | Lesvos | Fara | Fish&Chill |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2603 |
| Records without direct source URL | 117 |
| Coverage | 95.7% |
| Remaining medium-confidence without direct source URL | 88 |
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
