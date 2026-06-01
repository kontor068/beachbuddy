# Source Follow-up Pass 10 - 2026-05-27

## Scope

Continue low-confidence/no-source follow-up with only direct identity/location source additions. This pass targeted one Magnesia/Pelion record where a direct beach page cleanly supports the stored Kalamies/Agria identity and coastal area.

## Record Updated

- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 18, `Kalamies (Agria)`

## Source Added

- https://beaches-searcher.com/en/beach/300202290/kalamies-beach

## Notes

- The source was used only for identity/location traceability in the Agria/Agios Minas coastal area.
- Confidence, coordinates, access, services, amenities, wind profile, scoring, and recommendation behavior were not changed.
- Several same-name or nearby Alonissos, Skopelos, and Pelion candidates were skipped because source coordinates or described coast were several kilometres away from stored coordinates.

## Counts After Pass

- App-facing beaches: 2720
- Beaches with direct source URL: 2310
- Beaches without direct source URL: 410
- Direct source coverage: 84.9%
- Low-confidence app-facing records without direct source URLs: 35
- Remaining low-confidence/no-source by active cluster:
  - Alonissos: 17
  - Skopelos: 7
  - Magnesia/Pelion: 10
  - Larissa Coast: 1
  - Chios: 0

## Validation

Passed 2026-05-27:

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run build`

Notes:

- The production build still emits the existing Vite chunk-size warning for large bundles.
- Email delivery for the deep audit was skipped because dry-run email config was not provided.
