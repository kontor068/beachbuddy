# Kythira source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Kythira.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Agios Nikolaos | https://visitkythera.com/el/paralies/agios-nikolaos/ | Visit Kythera page supports same-name identity and Kythira location. |
| Xeropotamos | https://www.ferryhopper.com/en/destinations/antikythera; https://kythira.gr/wp-content/uploads/2021/12/TouristGuide.pdf | Antikythera tourism sources support Xeropotamos beach identity and Antikythera location. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Xeropotamos is treated as the Antikythera record already stored under the Kythira bucket.

## Result

- Kythira now has 0 low-confidence app-facing records without direct source URLs in the public dataset.
- Greece-wide app-facing records with direct source URLs: 2051 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2051 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Kythira batch files and generated beach-data/report outputs.
