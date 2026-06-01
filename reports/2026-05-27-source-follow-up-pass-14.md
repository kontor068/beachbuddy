# Source Follow-Up Pass 14 - 2026-05-27

## Scope

- Continue the low-confidence / no-direct-source source follow-up queue.
- Keep this pass source-only: no confidence, coordinate, access, service, amenity, wind profile, scoring, recommendation, or visible-copy changes.
- Accept only direct, location-specific sources that support identity/location enough for traceability.

## Updated Records

| Region | Record | Source | Notes |
| --- | --- | --- | --- |
| Skopelos | `Plaka` | https://beaches-searcher.com/en/beach/300202404/plaka-beach | Direct beach page supports Plaka beach identity/location in the Skopelos/Panormos local area only. |

## Skipped Candidates

- Alonissos candidates around Kalyvia/Stamatiou/Peskandritsa/Strovili/Nikola/Katerina and related micro-coves were skipped where direct pages, nearby OSM objects, or reverse checks pointed to different named beaches or locations several kilometers away from the stored records.
- Larissa Coast `Agia Paraskevi (Agia)` was skipped because the stored coordinates reverse to inland Metaxochori context and no clean beach-local match was found.
- Magnesia/Pelion candidates including `Brianou`, `Plaka (Zagora)`, `Elia`, `Lithos`, `Limnionas`, and `Kornelia` were skipped where direct-source coordinates/described coasts did not safely match the stored coordinates or the stored coordinates appeared inland.

## Counts After Pass

- App-facing beaches checked: 2720
- Beaches with direct source URL: 2315
- Beaches without direct source URL: 405
- Direct source URL coverage: 85.1%
- Low-confidence app-facing records without direct source URLs: 30
- Remaining low-confidence / no-direct-source clusters:
  - Alonissos: 16
  - Skopelos: 6
  - Magnesia/Pelion: 7
  - Larissa Coast: 1
  - Chios: 0

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2315 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues. Email was skipped because dry-run email config is not set.
- `npm run build` passed. Vite reported the existing chunk-size warning.
