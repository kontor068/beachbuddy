# Source follow-up pass 36 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 medium-confidence app-facing records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Island/area | Record | Source |
| --- | --- | --- | --- |
| South Aegean | Kimolos | Kalamitsi | Official Kimolos beaches page |
| South Aegean | Kimolos | Psathi | Official Kimolos beaches page |
| South Aegean | Sifnos | Artimoni | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Lazarou | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Poulati | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Seralia | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Spilia | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Tosso Nero | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Tsopos | e-Sifnos beaches page/map |
| South Aegean | Sifnos | Tsoha | e-Sifnos beaches page/map |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2513 |
| Records without direct source URL | 207 |
| Coverage | 92.4% |
| Remaining medium-confidence without direct source URL | 177 |
| Remaining low-confidence without direct source URL | 30 |

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

The Kimolos source is the official municipality beach page. The Sifnos source is the e-Sifnos beach list/map page. These sources were used only to support beach identity/location traceability.
