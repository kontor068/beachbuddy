# Source Follow-up Pass 8 - 2026-05-27

## Scope

Continue the low-confidence/no-source follow-up with only direct identity/location source additions. This pass targeted remaining Magnesia/Pelion records where local Lefokastro, Afissos, or Pagasitic sources gave a clean name/location match.

## Records Updated

- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 10, `Agia Thymia`
- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 16, `Gourna`
- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 25, `Lagoudi`
- `Thessaly > Magnesia > Magnesia (mainland - Pelion)` index 53, `Razi`

## Sources Added

- https://artespelion.gr/%CE%B5%CE%BB%CE%BB%CE%B7%CE%BD%CE%B9%CE%BA%CE%AC/%CE%BF%CE%B4%CE%B7%CE%B3%CF%8C%CF%82-%CF%80%CE%B7%CE%BB%CE%AF%CE%BF%CF%85/%CE%BC%CE%BF%CE%BD%CE%BF%CE%AE%CE%BC%CE%B5%CF%81%CE%B5%CF%82-%CE%B5%CE%BA%CE%B4%CF%81%CE%BF%CE%BC%CE%AD%CF%82/%CE%BA%CE%B5%CE%BD%CF%84%CF%81%CE%B9%CE%BA%CF%8C-%CE%B4%CF%85%CF%84%CE%B9%CE%BA%CF%8C-%CF%80%CE%AE%CE%BB%CE%B9%CE%BF/
- https://andromahistudios.com/?page_id=23
- https://www.hellaspath.gr/index.php?m=1&mntid=47&p=2
- https://www.maistralihotel.com/gr/Pelion-beaches/
- https://www.razibeach.com/index-gr.html
- https://www.razibeach.com/map-gr.html

## Notes

- These sources were used only for beach identity/location traceability.
- Confidence, coordinates, access, services, amenities, wind profile, scoring, and recommendation behavior were not changed.
- Broader or coordinate-mismatched Alonissos/Skopelos candidates were skipped for later stricter review.

## Counts After Pass

- App-facing beaches: 2720
- Beaches with direct source URL: 2307
- Beaches without direct source URL: 413
- Direct source coverage: 84.8%
- Low-confidence app-facing records without direct source URLs: 38
- Remaining low-confidence/no-source by active cluster:
  - Alonissos: 17
  - Skopelos: 7
  - Magnesia/Pelion: 11
  - Chios: 2
  - Larissa Coast: 1

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
