# Source follow-up pass 37 - 2026-05-28

## Scope

Added direct source URLs and conservative source notes for 10 medium-confidence app-facing records that previously had no direct source URL.

Only identity/location traceability was updated. Confidence, coordinates, access, services, amenities, wind profile, scoring, and UI behavior were not changed.

## Updated records

| Region | Island/area | Record | Source |
| --- | --- | --- | --- |
| South Aegean | Syros | Azolimnos | Visit Syros |
| South Aegean | Syros | Delfini | Visit Syros |
| South Aegean | Syros | Finikas | Visit Syros |
| South Aegean | Lipsi | Katsadia | Municipality of Lipsi |
| South Aegean | Lipsi | Papandria | Municipality of Lipsi |
| South Aegean | Halki | Ftenagia | AllOverGreece |
| South Aegean | Halki | Kania | Hellenic Travel Group |
| South Aegean | Iraklia | Livadi | Naxos and Small Cyclades |
| South Aegean | Agathonisi | Spilia | Exploring Greece |
| South Aegean | Kastellorizo | Mandraki | GetGreece |

## Coverage after pass

| Metric | Count |
| --- | ---: |
| App-facing records | 2720 |
| Records with direct source URL | 2523 |
| Records without direct source URL | 197 |
| Coverage | 92.8% |
| Remaining medium-confidence without direct source URL | 167 |
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

These sources were used only to support beach identity/location traceability.

The 3 Syros records exist in the app-facing `public/greek_beaches.json` dataset and derived app data, but the current `src/data/greek_beaches.json` mirror does not contain the same 3 records. The matching 7 records that exist in both public and src were updated in both files; the Syros source metadata was applied to the app-facing public dataset.
