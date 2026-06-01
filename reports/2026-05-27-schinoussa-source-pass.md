# Schinoussa source pass - 2026-05-27

## Scope

- Region path: `South Aegean > Cyclades > Schinoussa`
- App-facing low-confidence records checked: 4
- Records updated: 4
- Source type: direct beach/local pages used for source traceability and identity/location support

## Updated records

| Beach | Source URL | Evidence note |
| --- | --- | --- |
| Gerolimnionas | https://www.allovergreece.com/Nudist-Beach/Descr/23/1067/el | AllOverGreece same-name Schinoussa beach page includes GPS coordinates matching stored coordinates |
| Portokali | https://www.exploring-greece.gr/el/show/40908/%3Attd/PORTOKALI | Exploring Greece same-name Schinoussa beach page supports identity and location near stored coordinates |
| Fountana | https://www.exploring-greece.gr/el/show/40885/%3Attd/FUDANA | Exploring Greece same-name Schinoussa beach page supports identity and island-level location |
| Fykio | https://www.aegeanislands.gr/el/pois/schoinousa-fykio-el/ | Aegean Islands same-name Schinoussa beach page supports identity and island-level location |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- This pass adds source traceability only. Any access/service or user-facing claim promotion needs stricter local or official review.

## Result

- Schinoussa app-facing low-confidence records without direct source URLs: 0

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-schinoussa-source-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
