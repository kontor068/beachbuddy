# OSM singleton source pass 2 - 2026-05-27

## Scope

Added direct OSM source URLs and conservative source notes to 9 app-facing low-confidence records that had clean same-name or compatible-name `natural=beach` identity/location matches near stored coordinates.

## Records updated

- Piraeus / Piraeus area: `Plaz Kalampaka` - https://www.openstreetmap.org/way/624112097
- Crete / Heraklion: `Karavovrysi` - https://www.openstreetmap.org/way/361056345
- East Macedonia and Thrace / Xanthi: `Paralia Galanis Nestou` - https://www.openstreetmap.org/way/1432017162
- Epirus / Arta: `Frachtis` - https://www.openstreetmap.org/node/9863945512
- North Aegean / Lemnos: `Kokkina (south cove)` - https://www.openstreetmap.org/way/116448309
- North Aegean / Lemnos: `Tigani` - https://www.openstreetmap.org/way/253783282
- Peloponnese / Messinia: `Glossa (nudist)` - https://www.openstreetmap.org/way/146968492
- Peloponnese / Messinia: `Chalikoura` - https://www.openstreetmap.org/way/606058635
- Thessaly / Magnesia (Sporades) / Skiathos: `Mystiki` - https://www.openstreetmap.org/way/167043660

## Result

- Direct source URL coverage increased from 2215 to 2224 app-facing beaches out of 2720.
- Low-confidence app-facing records without direct source URLs decreased from 130 to 121.
- Piraeus, Heraklion, Xanthi, Arta, Messinia, and Skiathos now have 0 low-confidence records without direct source URLs.
- Lemnos has 3 remaining low-confidence records without direct source URLs: `Karvounolakka`, `Kokkina (north cove)`, and `Panagias Pigadeli`.

## Boundaries

This pass only adds source traceability for identity/location. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, recommendations, or UI.

## Validation

Passed:

- `npm run build:beach-data`
- `node scripts/auditBeachVerificationCoverage.mjs`
- `npm run quality:beach-data`
- `npm run content:audit`
- `npm run audit:beaches -- --mode=deep --email-dry-run`
- `npm run build`

Final counts:

- 2720 app-facing beaches.
- 2224 with direct source URLs.
- 496 without direct source URLs.
- 121 low-confidence records without direct source URLs.

The production build completed with the existing Vite large chunk warning only.
