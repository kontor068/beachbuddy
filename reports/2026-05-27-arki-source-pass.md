# Arki source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Dodecanese > Arki`
- App-facing records checked: 2
- Records updated: 2
- Source type: direct island/beach pages used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Patelia | https://www.ferryscanner.com/en/ferry-destinations/greece/dodecanese-islands/arki | Ferryscanner Arki page lists Patelia Beach as an Arki beach 500 m from the settlement |
| Limnari | https://www.exploring-greece.gr/el/show/51182 | Exploring Greece same-name Limnari beach page supports identity and island-level location on Arki |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Arki app-facing low-confidence records without direct source URLs: 0

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-arki-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
