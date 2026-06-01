# Skyros source pass - 2026-05-27

## Scope

- Region: Central Greece > Evia > Skyros.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Glyfada | https://visitgreece.gr/islands/sporades/skyros/ | Visit Greece Skyros page supports Glyfada beach on Sarakino/Sarakiniko island, matching the existing Skyros/Sarakiniko-area record. |
| Agios Petros | https://www.wondergreece.gr/v1/en/Regions/Skyros/Nature/Beaches/6795-Agios_Petros | WonderGreece page supports same-name identity and Skyros location. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Glyfada was kept in the existing Skyros bucket; no regional or coordinate changes were made.

## Result

- Skyros now has 0 low-confidence app-facing records without direct source URLs in the public dataset.
- Greece-wide app-facing records with direct source URLs: 2055 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2055 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Skyros batch files and generated beach-data/report outputs.
