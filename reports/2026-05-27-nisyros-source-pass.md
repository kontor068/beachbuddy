# Nisyros source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Dodecanese > Nisyros`
- App-facing records checked: 2
- Records updated: 2
- Source type: direct beach/local pages used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Pachia Ammos | https://www.allovergreece.com/Nudist-Beach/Descr/36/1004/en | AllOverGreece same-name Nisyros beach page includes GPS coordinates about 60 m from stored coordinates |
| Chochlakoi | https://www.visitnisyros.gr/el/paralies-sti-nisyro | Official/local Visit Nisyros beach page lists Chochlakoi as a Nisyros beach at Mandraki |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Nisyros app-facing low-confidence records without direct source URLs: 0

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-nisyros-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
