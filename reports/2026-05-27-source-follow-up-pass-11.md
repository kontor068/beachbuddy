# Source Follow-up Pass 11 - 2026-05-27

## Scope

Continue low-confidence/no-source follow-up with only direct identity/location source additions. This pass targeted two Magnesia/Pelion Pteleos-area records where direct beach pages identify the matching Dermaria and Phaprikezaina beaches in the same northern-coast cluster.

## Records Updated

- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 0, `Dermaria (Pteleos)`
- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 56, `Phaprikezaina/Faprikezaina (Pteleos)`

## Sources Added

- https://beaches-searcher.com/en/beach/300202234/dermaria-beach
- https://beaches-searcher.com/en/beach/300202235/phaprikezaina-beach

## Notes

- These sources were used only for identity/location traceability in the Pteleos/Glyfa northern-coast cluster.
- Confidence, coordinates, access, services, amenities, wind profile, scoring, and recommendation behavior were not changed.
- Several same-name or nearby Alonissos, Skopelos, and Pelion candidates remain skipped because source coordinates or described coast were several kilometres away from stored coordinates.

## Counts After Pass

- App-facing beaches: 2720
- Beaches with direct source URL: 2312
- Beaches without direct source URL: 408
- Direct source coverage: 85.0%
- Low-confidence app-facing records without direct source URLs: 33
- Remaining low-confidence/no-source by active cluster:
  - Alonissos: 17
  - Skopelos: 7
  - Magnesia/Pelion: 8
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
