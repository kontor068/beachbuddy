# Donousa source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Cyclades > Donousa`
- App-facing low-confidence records checked: 3
- Records updated: 3
- Source type: direct beach/local pages used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Kedros | https://www.allovergreece.com/Beaches/Descr/6/1066/el | AllOverGreece same-name Donousa beach page supports identity and island-level location |
| Livadi | https://www.allovergreece.com/Beaches/Descr/6/1005/el | AllOverGreece same-name Donousa beach page supports identity and island-level location |
| Limenari | https://pothitidonoussa.gr/?page_id=1956 | Pothiti Donoussa local page lists Vathy Limenari as a Donousa beach; compatible-name match |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Donousa app-facing low-confidence records without direct source URLs: 0
- `Stavros` remains medium-confidence without a direct source URL and was not changed in this low-confidence source-only pass.

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-donousa-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
