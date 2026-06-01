# Local/source follow-up pass - 2026-05-27

## Scope

Added direct source URLs and conservative source notes to 10 app-facing low-confidence records that had direct beach or island beach-page identity/location support.

## Records updated

- Meganisi: `Limonari` - https://www.gtp.gr/LocPage.asp?id=72474&lng=1
- Meganisi: `Ampelakia` - https://www.allovergreece.com/Beaches/Descr/86/836/el
- Meganisi: `Elia` - https://www.allovergreece.com/Beaches/Descr/86/833/el
- Tilos: `Stavros` - https://www.allovergreece.com/Beaches/Descr/40/853/el
- Kimolos: `Klima` - https://www.kimolos.gr/tourism/paralies
- Koufonisia: `Afryania` - https://www.exploring-greece.gr/el/show/41269/%3Attd/THEA-SE-KATO-KUFONISSI-APO-AFRIANIA
- Koufonisia: `Genoupas` - https://beaches-searcher.com/en/beach/300605282/genoupas-beach
- Koufonisia: `Deti` - https://koufonisia.gr/paralies-katw-koufonisi/
- Koufonisia: `Lakoi` - https://koufonisia.gr/paralies-katw-koufonisi/
- Koufonisia: `Fykio` - https://www.koufonisia.net/koufonisia-beaches.html

## Result

- Direct source URL coverage increased from 2224 to 2234 app-facing beaches out of 2720.
- Low-confidence app-facing records without direct source URLs decreased from 121 to 111.
- Meganisi and Koufonisia now have 0 low-confidence records without direct source URLs.
- Tilos has 1 remaining low-confidence record without a direct source URL: `Agia Petros`.
- Kimolos has 1 remaining low-confidence record without a direct source URL: `Agios Minas`.

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
- 2234 with direct source URLs.
- 486 without direct source URLs.
- 111 low-confidence records without direct source URLs.

The production build completed with the existing Vite large chunk warning only.
