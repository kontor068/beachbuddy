# Telendos source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Dodecanese > Telendos`
- App-facing low-confidence records checked: 3
- Records updated: 2
- Source type: direct beach pages used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Paralia Pnigmenos | https://www.cavoblue.com/el/s/486/dodekanesa/kalymnos/telendos/pnigmenos | CavoBlue same-name Telendos beach page supports identity and island-level location |
| Paralia Chochlakas | https://www.cavoblue.com/el/s/228/dodekanesa/kalymnos/telendos/paralia-chochlakas | CavoBlue same-name Telendos beach page supports identity and island-level location |

## Skipped

- `Paralia Papa` remains without a direct source URL because this pass did not find a clean beach-specific source.

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Telendos app-facing low-confidence records without direct source URLs: 1

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-telendos-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
