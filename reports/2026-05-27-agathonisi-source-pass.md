# Agathonisi source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Dodecanese > Agathonisi`
- App-facing records checked: 5
- Records updated: 4
- Source type: direct web pages/PDF used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Vathy Pigadi | https://www.exploring-greece.gr/el/show/51116/%3Attd/VATHI-PIGADI | Same-name Exploring Greece Agathonisi beach page |
| Gadourolakkos | https://www.ferryhopper.com/el/destinations/greece/agathonisi | Ferryhopper Agathonisi page lists Gaidouravlakos as an Agathonisi beach; compatible-name match |
| Palos | https://www.exploring-greece.gr/el/show/51141/%3Attd/PALOS | Same-name Exploring Greece Agathonisi beach page |
| Tsagkari | https://www.culture.gov.gr/DocLib/%CE%91%CE%A0%CE%9F%CE%A6%CE%91%CE%A3%CE%97_%20%CE%A0%CE%91%CE%A1%CE%91%CE%9B%CE%99%CE%91%20%CE%A4%CE%A3%CE%91%CE%93%CE%9A%CE%91%CE%A1%CE%97%20%CE%91%CE%93%CE%91%CE%98%CE%9F%CE%9D%CE%97%CE%A3%CE%99.pdf | Greek Ministry of Culture decision references a path to Tsagkari beach on Agathonisi |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Agathonisi app-facing low-confidence records without direct source URLs: 0
- `Paralia Spilias` remains medium-confidence without a direct source URL and was not changed in this low-confidence source-only pass.

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-agathonisi-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
