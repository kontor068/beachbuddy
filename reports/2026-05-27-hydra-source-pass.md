# Hydra source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Hydra.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Avlaki | https://www.hydra.com.gr/beaches/?lang=en and https://www.hydradirect.com/avlaki-beach-hydra | Hydra destination material and HydraDirect support Avlaki identity and Hydra location. |
| Kaminia | https://athensattica.com/highlight/kamini-beach/ and https://www.allovergreece.com/Beaches/Descr/59/417/en | Athens Attica and AllOverGreece support Kamini/Kaminia or Mikro Kamini beach identity and Hydra location. |
| Plakes | https://athensattica.com/highlight/plakes-vlyhou-beach/ and https://www.hydradirect.com/plakes-beach-hydra | Athens Attica and HydraDirect support Plakes Vlyhou/Plakes identity and Hydra location. |
| Spilia | https://athensattica.com/highlight/spilia-beach-hydra/ and https://www.hydra.com.gr/beaches/spilia-idroneta/?lang=en | Athens Attica and Hydra destination material support Spilia identity and Hydra location. |

## Skipped records

None.

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Existing differences between `public` and `src` confidence values were not modified in this source-only pass.

## Result

- Hydra now has 0 low-confidence app-facing records without a direct source URL.
- Greece-wide app-facing records with direct source URLs: 2069 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2069 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Hydra batch files and generated beach-data/report outputs.
