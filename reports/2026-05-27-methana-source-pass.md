# Methana source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Methana.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Akti Agapis | https://www.exploring-greece.gr/el/show/28257/%3Attd/AKTI-AGAPIS | Exploring Greece page supports same-name identity and Troizinia/Methana-area location. |
| Votsalakia | https://epidavros.villas/en/the-region/the-beaches/votsalakia-beach-in-kalloni/ | Votsalakia Beach Kalloni page supports same-name identity and Kalloni/Troizinia location with Methana-area context. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- The existing Methana/Troizinia bucket was not changed.

## Result

- Methana now has 0 low-confidence app-facing records without direct source URLs in the public dataset.
- Greece-wide app-facing records with direct source URLs: 2053 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2053 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Methana batch files and generated beach-data/report outputs.
