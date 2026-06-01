# Psara OSM identity/location pass - 2026-05-27

## Scope

- Region path: `North Aegean > Chios > Psara`
- App-facing records checked: 6
- Records updated: 4
- Source type: OpenStreetMap `natural=beach` same-name identity-location evidence only

## Updated records

| Beach | Source URL | Match distance |
| --- | --- | ---: |
| Katsouni | https://www.openstreetmap.org/way/223787081 | 0 m |
| Lakka | https://www.openstreetmap.org/way/423090872 | 1 m |
| Limnos | https://www.openstreetmap.org/way/497165271 | 0 m |
| Lazareta | https://www.openstreetmap.org/way/305166897 | 0 m |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- OSM evidence supports identity/location only. It does not verify calm water, protection, safety, access, or services.

## Result

- Psara app-facing low-confidence records without direct source URLs: 0
- `Archontiki` remains medium-confidence without a direct source URL and was not changed in this low-confidence source-only pass.
- `Psili` already had a direct source URL in the app-facing public dataset and was not changed.

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-psara-osm-identity-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
