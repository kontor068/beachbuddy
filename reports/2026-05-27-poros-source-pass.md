# Poros source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Poros.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Limanaki tis Agapis | https://www.poros.com.gr/beaches/lovesBay/?lang=en | Poros Love Bay page supports same-name Limanaki tis Agapis/Love Bay identity and Poros location. |
| Plaka | https://www.poros.com.gr/beaches/galatas-plaka/?lang=en | Poros Plaka and Galatas page supports same-name Plaka beach identity and Galatas/Poros-area location. |

## Skipped records

| Beach | Reason |
| --- | --- |
| Agios Stefanos | No clean beach-specific Poros source was found in this pass. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Existing differences between `public` and `src` confidence values were not modified in this source-only pass.

## Result

- One low-confidence Poros app-facing record remains without a direct source URL: `Agios Stefanos`.
- Greece-wide app-facing records with direct source URLs: 2060 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2060 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Poros batch files and generated beach-data/report outputs.
