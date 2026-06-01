# Salamina source pass - 2026-05-27

## Scope

- Region: Attica > Islands (Saronic & Kythira) > Salamina.
- Files updated: `public/greek_beaches.json`, `src/data/greek_beaches.json`.
- Change type: source-only metadata for app-facing low-confidence records without direct source URLs.

## Updated records

| Beach | Source | Evidence used |
| --- | --- | --- |
| Mikro Lamprano | https://www.salamina.gr/en/presentation-of-the-municipality/tourist-information/beaches/ and https://www.openstreetmap.org/node/11098828505 | Salamina municipality lists Lamprano among island beaches/creeks; OSM matches same-name feature at stored coordinates. |
| Paralia Agiou Nikolaou | https://bathingwaterprofiles.gr/el/bathingprofiles/elbw069211097101 and https://mapcarta.com/W353391442 | Official bathing-water profile identifies Agios Nikolaos Anatolika in the Bay of Salamina; Mapcarta matches stored coordinates. |
| Paralia Kanakia | https://www.salamina.gr/en/presentation-of-the-municipality/tourist-information/beaches/ and https://www.allovergreece.com/Beaches/Descr/57/487/en | Salamina municipality lists Kanakia; AllOverGreece identifies Kanakia beach on Salamina with nearby coordinates. |

## Skipped records

None.

## Boundaries

- Did not change confidence, coordinates, access, services, amenities, scoring, windProfile, or recommendation behavior.
- Source notes are conservative and limited to identity/location support for this pass.
- Existing differences between `public` and `src` confidence values were not modified in this source-only pass.

## Result

- Salamina now has 0 low-confidence app-facing records without a direct source URL.
- Greece-wide app-facing records with direct source URLs: 2072 / 2720.

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2072 / 2720 app-facing beaches now have direct source URLs.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed with 0 issues; email skipped because audit email env vars are not configured.
- `npm run quality:beach-data` passed with 0 findings.
- `npm run content:audit` passed with 0 findings.
- `npm run build` passed; Vite reported the existing large chunk warning.
- Scoped `git diff --check` passed for the Salamina batch files and generated beach-data/report outputs.
