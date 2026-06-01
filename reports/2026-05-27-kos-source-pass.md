# Kos source pass - 2026-05-27

## Scope

- Region: South Aegean > Dodecanese > Kos.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Therma | https://kos.gr/beaches-in-kos-island/therma-beach | Official Kos tourism page supports same-name identity and Kos location. |
| Paralia Volcana | https://kos.gr/beaches-in-kos-island/volcania-beach | Official Kos tourism page supports compatible Volcania/Volcana identity and Kos location near the existing coordinates. |

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Volcania/Volcana spelling was treated as a compatible-name source match because the official page coordinates align with the existing record.

## Result

- Kos now has 0 low-confidence app-facing records without direct source URLs in the public dataset.
- Greece-wide app-facing records with direct source URLs: 2049 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2049 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Kos batch files and generated beach-data/report outputs.
