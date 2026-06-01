# Source Follow-up Pass 32

Date: 2026-05-28

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 app-facing beach records with clear direct identity/location support.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left ambiguous records unresolved until a direct beach-specific source is available.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| Ionian Islands | Lefkada | Lefkada | Desimi | Amazing Lefkada |
| Ionian Islands | Lefkada | Lefkada | Nikiana | Amazing Lefkada |
| Ionian Islands | Lefkada | Lefkada | Gyra | All Over Greece |
| Ionian Islands | Lefkada | Lefkada | Kastro | Amazing Lefkada |
| Ionian Islands | Lefkada | Lefkada | Lygia | Lefkada.hu |
| Ionian Islands | Ithaca | Ithaca | Dexa | Municipality of Ithaca |
| Ionian Islands | Ithaca | Ithaca | Loutsa | Municipality of Ithaca |
| Ionian Islands | Ithaca | Ithaca | Gidaki | Municipality of Ithaca |
| Ionian Islands | Ithaca | Ithaca | Polis | Municipality of Ithaca |
| Ionian Islands | Ithaca | Ithaca | Marmakas | Municipality of Ithaca |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2473
- App-facing records remaining without direct source URL: 247
- Direct source URL coverage: 90.9%
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2473 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
