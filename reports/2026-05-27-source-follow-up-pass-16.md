# Source Follow-Up Pass 16 - 2026-05-27

## Scope

- Continue source follow-up after the remaining low-confidence Sporades/Pelion/Larissa records showed coordinate/source conflicts.
- Expand the pass to the next app-facing records without direct source URLs where clean identity/location sources exist.
- Keep this pass source-only: no confidence, coordinate, access, service, amenity, wind profile, scoring, recommendation, or visible-copy changes.

## Updated Records

| Region | Record | Source | Notes |
| --- | --- | --- | --- |
| Athens coastal mainland | `Paralia Edem` | https://www.allovergreece.com/Wheelchair-Accessible-Beach/Descr/R99/1153/el | Direct accessible-beach page supports Edem identity/location on the Palaio Faliro coastal front only. |
| Athens coastal mainland | `Agios Kosmas` | https://tripinview.com/places/beach/52820/greece-attica-central-attica-agios-kosmas | Direct beach page supports Agios Kosmas beach identity/location in Central Attica only. |
| Athens coastal mainland | `Paralia Glyfadas Akti A` | https://www.govmap.gr/item/paralia-glyfadas-akti-a | Direct place page supports Glyfada Akti A identity/location in Glyfada only. |
| Athens coastal mainland | `Paralia Glyfadas Akti B` | https://glyfada.gr/index.php/home/blog_details/5688 | Official Glyfada municipality page references the B beach of Glyfada, supporting local-area traceability only. |

## Skipped Candidates

- Alonissos OSM/Mapcarta exact-name candidates for `Vamvakies`, `Vasili Mpampakies`, `Stou Malathriti Mpampakies`, `Mourtitsa`, `Kalyvia Alexiou`, `Kalyvia Stamatiou`, `Nikola Vala`, and related names were skipped again because the source coordinates are several kilometers away from the stored records.
- Skopelos exact-name candidates remain skipped where sources place them in Agios Ioannis/Spilia, west-coast, or other contexts that do not match the stored coordinates.
- Pelion exact-name candidates remain skipped where direct-source coordinates or described coasts are several kilometers away from stored coordinates.

## Counts After Pass

- App-facing beaches checked: 2720
- Beaches with direct source URL: 2319
- Beaches without direct source URL: 401
- Direct source URL coverage: 85.3%
- App-facing records without direct source URLs by confidence:
  - High: 2
  - Medium: 369
  - Low: 30

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2319 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues. Email was skipped because dry-run email config is not set.
- `npm run build` passed. Vite reported the existing chunk-size warning.
