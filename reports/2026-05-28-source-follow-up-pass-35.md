# Source Follow-up Pass 35

Date: 2026-05-28

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 app-facing beach records with clear direct identity/location support.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left ambiguous records unresolved until a direct beach-specific source is available.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| North Aegean | Lesvos | Lesvos | Haramida | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Kanoni Thermis | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Tsikhranda | Visit Lesvos |
| North Aegean | Lemnos | Lemnos | Avlonas | Varos Village Lemnos beaches |
| North Aegean | Lemnos | Lemnos | Gomati | Varos Village Lemnos beaches |
| North Aegean | Lemnos | Lemnos | Agios Ioannis | Varos Village Lemnos beaches |
| North Aegean | Lemnos | Lemnos | Evgatis/Nevgatis | Varos Village Lemnos beaches |
| North Aegean | Lemnos | Lemnos | Kotsinas | Varos Village Lemnos beaches |
| North Aegean | Lemnos | Lemnos | Saravari | Varos Village Lemnos beaches |
| North Aegean | Lemnos | Lemnos | Havouli | Varos Village Lemnos beaches |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2503
- App-facing records remaining without direct source URL: 217
- Direct source URL coverage: 92.0%
- Medium-confidence app-facing records without direct source URL: 187
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2503 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
