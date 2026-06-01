# Agistri source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Agistri.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Xekofti | https://weloveagistri.com/en/agkistri/xekofti-beach/ | We Love Agistri page supports same-name identity and Agistri/Megalochori-area location. |
| Megalochori Beach | https://weloveagistri.com/en/agkistri/megalochori-beach/ | We Love Agistri page supports same-name identity and Agistri port-village location. |
| Skliri | https://weloveagistri.com/en/agkistri/skliri-beach/ | We Love Agistri page supports same-name identity and Agistri/Skala-area location. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Existing differences between `public` and `src` confidence values were not modified in this source-only pass.

## Result

- Agistri now has 0 low-confidence app-facing records without direct source URLs in the public dataset.
- Greece-wide app-facing records with direct source URLs: 2058 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2058 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Agistri batch files and generated beach-data/report outputs.
