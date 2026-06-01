# Source Follow-up Pass 31

Date: 2026-05-28

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 app-facing beach records with clear direct identity/location support.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left ambiguous records unresolved until a direct beach-specific source is available.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| Ionian Islands | Zakynthos | Zakynthos | Agios Nikolaos Volimon | Nobelos |
| Ionian Islands | Zakynthos | Zakynthos | Amboula | MyZakynthos |
| Ionian Islands | Zakynthos | Zakynthos | Porto Roxa | Kalimera Greece |
| Ionian Islands | Zakynthos | Zakynthos | Ammoudi | Zakynthos Guide |
| Ionian Islands | Zakynthos | Zakynthos | Makrys Gialos | IslandGuide |
| Ionian Islands | Zakynthos | Zakynthos | Mavratzi | Vasilikos Zakynthos |
| Ionian Islands | Zakynthos | Zakynthos | Keri | Kalimera Greece |
| Ionian Islands | Zakynthos | Zakynthos | Marathia | GetGreece |
| Ionian Islands | Lefkada | Lefkada | Agiofili | Amazing Lefkada |
| Ionian Islands | Lefkada | Lefkada | Ammousa | Amazing Lefkada |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2463
- App-facing records remaining without direct source URL: 257
- Direct source URL coverage: 90.6%
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2463 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
