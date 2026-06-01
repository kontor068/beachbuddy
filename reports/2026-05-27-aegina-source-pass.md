# Aegina source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Aegina.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Vagia Beach | https://aegina.com.gr/baia/?lang=en | Aegina Vagia beach page supports same-name identity and Aegina/Vagia location. |
| Tourlos | https://www.allovergreece.com/Beaches/Descr/55/529/el | AllOverGreece page supports same-name identity and Aegina location. |

## Skipped records

| Beach | Reason |
| --- | --- |
| Votsaloti Paralia | No clean Aegina-specific beach source was found in this pass; available results were ambiguous or from other regions. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Existing differences between `public` and `src` confidence values were not modified in this source-only pass.

## Result

- One low-confidence Aegina app-facing record remains without a direct source URL: `Votsaloti Paralia`.
- Greece-wide app-facing records with direct source URLs: 2062 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2062 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Aegina batch files and generated beach-data/report outputs.
