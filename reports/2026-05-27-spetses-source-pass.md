# Spetses source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Spetses.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Agioi Anargyroi | https://spetses.gov.gr/eimai-episkeptis-5973/beaches/ and https://athensattica.com/highlight/agioi-anargyroi-beach/ | Spetses municipality and Athens Attica destination material support same-name identity and Spetses location. |
| Agios Mamas | https://spetses.gov.gr/eimai-episkeptis-5973/beaches/ and https://seatrac.gr/en/beach-directory/spetses-agios-mamas/ | Spetses municipality and SEATRAC support same-name identity and Spetses location. |
| Kamares | https://www.openstreetmap.org/way/602125803 | OSM way supports same-name beach identity at or very near the stored Spetses coordinates. |

## Skipped records

None.

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Existing differences between `public` and `src` confidence values were not modified in this source-only pass.

## Result

- Spetses now has 0 low-confidence app-facing records without a direct source URL.
- Greece-wide app-facing records with direct source URLs: 2065 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2065 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Spetses batch files and generated beach-data/report outputs.
