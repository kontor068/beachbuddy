# Source Follow-up Pass 9 - 2026-05-27

## Scope

Continue low-confidence/no-source follow-up with only direct identity/location source additions. This pass targeted the remaining Chios `Pyrgia` north/south cove records, where direct locality sources match the stored coastal Pyrgia area closely enough to support local-area identity/location.

## Records Updated

- `North Aegean > Chios > Chios` index 1, `Paralia Pyrgia (south cove)`
- `North Aegean > Chios > Chios` index 2, `Paralia Pyrgia (north cove)`

## Sources Added

- https://buk.gr/el/poli-perioxi/pyrgia
- https://mapcarta.com/31052024

## Notes

- These sources were used only for Pyrgia local-area identity/location traceability.
- The north/south cove split remains a dataset-level distinction and was not promoted beyond low confidence.
- Confidence, coordinates, access, services, amenities, wind profile, scoring, and recommendation behavior were not changed.
- Several Skopelos, Alonissos, and Pelion candidates were skipped because same-name sources pointed several kilometres away from the stored coordinates or described coast.

## Counts After Pass

- App-facing beaches: 2720
- Beaches with direct source URL: 2309
- Beaches without direct source URL: 411
- Direct source coverage: 84.9%
- Low-confidence app-facing records without direct source URLs: 36
- Remaining low-confidence/no-source by active cluster:
  - Alonissos: 17
  - Skopelos: 7
  - Magnesia/Pelion: 11
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
