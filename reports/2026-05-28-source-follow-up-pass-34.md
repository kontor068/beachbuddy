# Source Follow-up Pass 34

Date: 2026-05-28

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 app-facing Lesvos beach records with clear direct identity/location support.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left ambiguous records unresolved until a direct beach-specific source is available.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| North Aegean | Lesvos | Lesvos | Aghios Ermogenis | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Aghios Isidoros | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Tsamakia Beach | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Vatera | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Molyvos Beach | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Anaxos | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Kayia/Kagia | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Nyfida | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Tarti | Visit Lesvos |
| North Aegean | Lesvos | Lesvos | Tsonia | Visit Lesvos |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2493
- App-facing records remaining without direct source URL: 227
- Direct source URL coverage: 91.7%
- Medium-confidence app-facing records without direct source URL: 197
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2493 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
