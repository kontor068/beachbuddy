# Fournoi OSM identity/location pass - 2026-05-27

## Scope

- Region path: `North Aegean > Ikaria > Fournoi`
- App-facing records checked: 7
- Records updated: 5
- Source type: OpenStreetMap `natural=beach` / compatible beach feature identity-location evidence only

## Updated records

| Beach | Source URL | Match distance |
| --- | --- | ---: |
| Kasidi | https://www.openstreetmap.org/way/301949369 | 0 m |
| Vitsila | https://www.openstreetmap.org/way/301949372 | 1 m |
| Petrokopi | https://www.openstreetmap.org/relation/13200203 | 1 m |
| Elidaki | https://www.openstreetmap.org/way/301949367 | 1 m |
| Koumara | https://www.openstreetmap.org/way/504547098 | 1 m |

## Boundaries

- Did not change confidence.
- Did not change coordinates.
- Did not change access, amenities, services, terrain, scoring, recommendations, or windProfile.
- OSM evidence supports identity/location only. It does not verify calm water, protection, safety, access, or services.

## Result

- Fournoi app-facing low-confidence records without direct source URLs: 0
- `Kampi` remains medium-confidence without a direct source URL and was not changed in this source-only pass.

## Validation

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run build`
- `git diff --check -- public/greek_beaches.json src/data/greek_beaches.json docs/BEACH_DATA_VERIFICATION_PHASE2.md docs/region-checkpoints.md reports/2026-05-27-fournoi-osm-identity-pass.md reports/phase2/beach-verification-coverage.json reports/phase2/beach-verification-coverage.md`
