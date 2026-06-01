# Source Follow-up Pass 27

Date: 2026-05-28

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 app-facing beach records with clear direct identity/location support.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left ambiguous records unresolved until a direct beach-specific source is available.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| East Macedonia and Thrace | Thasos | Thasos | Kinira / Koinyra | Thassos View |
| East Macedonia and Thrace | Thasos | Thasos | Skala Sotiras / Sotiros | Thassos View |
| East Macedonia and Thrace | Thasos | Thasos | Tarsanas | Thassos View |
| Ionian Islands | Corfu | Corfu | Agni Beach | Corfu Tourism |
| Ionian Islands | Corfu | Corfu | Alipa beach | Lovin Corfu |
| Ionian Islands | Corfu | Corfu | Benitses beach | Corfu Tourism |
| Ionian Islands | Corfu | Corfu | Kalamionas Beach | All Over Greece |
| Ionian Islands | Corfu | Corfu | Kaminaki Beach | Corfu Tourism |
| Ionian Islands | Corfu | Corfu | Kogevina Beach | OnlyInCorfu |
| Ionian Islands | Corfu | Corfu | Nissaki Beach | Corfu Tourism |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2423
- App-facing records remaining without direct source URL: 297
- Direct source URL coverage: 89.1%
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2423 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
