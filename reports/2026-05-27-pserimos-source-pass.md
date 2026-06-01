# Pserimos source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Dodecanese > Pserimos`
- App-facing records checked: 3
- Records updated: 3
- Source type: AllOverGreece same-name Pserimos beach pages used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Paralia Avlakia | https://www.allovergreece.com/Beaches/Descr/43/855/en | Same-name Pserimos beach page; page GPS is about 45 m from stored coordinates |
| Vathy | https://www.allovergreece.com/Beaches/Descr/43/858/en | Same-name Pserimos beach page; page GPS matches stored coordinates |
| Paralia Marathounda | https://www.allovergreece.com/Beaches/Descr/43/856/en | Same-name Pserimos beach page supporting beach identity and island-level location |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Pserimos app-facing low-confidence records without direct source URLs: 0

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-pserimos-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
