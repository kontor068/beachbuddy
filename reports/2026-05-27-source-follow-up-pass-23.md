# Source Follow-up Pass 23

Date: 2026-05-27

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 Chania app-facing beach records that already had enough direct source support for identity/location traceability.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left unresolved records such as `Kapsali Piso Gialos`, `Prasidi`, and unclear Halkidiki candidates for later review because direct source matches were not strong enough in this pass.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| Crete | Chania | Crete (Chania) | Nea Chora | CretanBeaches |
| Crete | Chania | Crete (Chania) | Rapaniana | CretanBeaches |
| Crete | Chania | Crete (Chania) | Sougia | CretanBeaches |
| Crete | Chania | Crete (Chania) | Tersanas | CretanBeaches |
| Crete | Chania | Crete (Chania) | Afrata | CretanBeaches |
| Crete | Chania | Crete (Chania) | Agios Onoufrios | CretanBeaches |
| Crete | Chania | Crete (Chania) | Balos | Elizabeth Estate Agency local beach page |
| Crete | Chania | Crete (Chania) | Finikas | CretanBeaches |
| Crete | Chania | Crete (Chania) | Georgioupoli | CretanBeaches |
| Crete | Chania | Crete (Chania) | Grammeno | CretanBeaches |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2383
- App-facing records remaining without direct source URL: 337
- Direct source URL coverage: 87.6%
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2383 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
