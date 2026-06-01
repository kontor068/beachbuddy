# Source Follow-up Pass 25

Date: 2026-05-28

## Scope

- Added direct `metadata.sourceUrls` and conservative `metadata.sourceNotes` to 10 Crete app-facing beach records with clear direct CretanBeaches identity/location support.
- Kept confidence, coordinates, access, services, amenities, wind profile, and scoring unchanged.
- Left earlier weak or ambiguous records unresolved until a direct beach-specific source is available.

## Updated Records

| Region | Prefecture | Place | Beach | Source |
| --- | --- | --- | --- | --- |
| Crete | Rethymno | Crete (Rethymno) | Limni | CretanBeaches |
| Crete | Rethymno | Crete (Rethymno) | Mikro Ammoudi | CretanBeaches |
| Crete | Rethymno | Crete (Rethymno) | Paligremnos | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Agia Fotia | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Agios Panteleimonas | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Diaskari | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Lagada | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Maridati | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Boufos | CretanBeaches |
| Crete | Lasithi | Crete (Lasithi) | Hiona Palekastrou | CretanBeaches |

## Coverage After Pass

- App-facing beach records checked: 2720
- App-facing records with direct source URL: 2403
- App-facing records remaining without direct source URL: 317
- Direct source URL coverage: 88.3%
- Low-confidence app-facing records without direct source URL: 30

## Validation

- Passed `npm run build:beach-data` (split 2720 beaches into 110 region files and regenerated app-ready data).
- Passed `node scripts/auditBeachVerificationCoverage.mjs` (2720 app-facing records, 2403 with direct source URL, 0 findings).
- Passed `npm run quality:beach-data` (2720 beaches scanned, 0 findings).
- Passed `npm run content:audit` (442 files scanned, 0 findings).
- Passed `npm run audit:beaches -- --mode=deep --email-dry-run` (2720 beaches checked, 0 issues; email skipped because dry-run email config is not set).
- Passed `npm run build`; existing Vite chunk-size warning remains.
