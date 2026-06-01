# Source Follow-Up Pass 12 - 2026-05-27

## Scope

- Continue the low-confidence / no-direct-source source follow-up queue.
- Keep this pass source-only: no confidence, coordinate, access, service, amenity, wind profile, scoring, or recommendation changes.
- Accept only direct, location-specific sources that support identity/location well enough for traceability.

## Updated Records

| Region | Record | Source | Notes |
| --- | --- | --- | --- |
| Magnesia/Pelion | `Mourtitsa` | https://www.greecemygreece.com/mourtitsa-beach/ | Direct beach page supports Mourtitsa beach identity/location in the South Pelion/Potistika coastal area only. |

## Skipped Candidates

- `Limnionas`, `Lithos`, `Elia`, `Plaka (Zagora)`, `Izgkoud/Izgoud`, and `Kornelia` Magnesia/Pelion candidates were skipped where direct-source coordinates or described coasts were several kilometers away from the stored records.
- Remaining Alonissos and Skopelos micro-cove candidates were left unchanged where available sources were generic, mismatched, or not clean enough for a source-only identity/location pass.

## Counts After Pass

- App-facing beaches checked: 2720
- Beaches with direct source URL: 2313
- Beaches without direct source URL: 407
- Direct source URL coverage: 85.0%
- Low-confidence app-facing records without direct source URLs: 32
- Remaining low-confidence / no-direct-source clusters:
  - Alonissos: 17
  - Skopelos: 7
  - Magnesia/Pelion: 7
  - Larissa Coast: 1
  - Chios: 0

## Validation

- `npm run build:beach-data` passed.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2313 with direct source URL, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues. Email was skipped because dry-run email config is not set.
- `npm run build` passed. Vite reported the existing chunk-size warning.
