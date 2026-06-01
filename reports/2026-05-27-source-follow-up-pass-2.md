# Source follow-up pass 2 - 2026-05-27

## Scope

Added direct source URLs and conservative source notes to 12 app-facing low-confidence records that had direct beach, official protected-area, or island beach-page identity/location support.

## Records updated

- Samos: `Agios Nikolaos` - https://www.worldbeachguide.com/greece/agios-nikolaos.htm
- Samos: `Agios Ioannis Eleimonas` - https://www.samosin.gr/el/item/%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B1-%CE%AC%CE%B3%CE%B9%CE%BF%CF%82-%CE%B9%CF%89%CE%AC%CE%BD%CE%BD%CE%B7%CF%82-%CE%B5%CE%BB%CE%B5%CE%AE%CE%BC%CE%BF%CE%BD%CE%B1%CF%82/
- Samos: `Plaka (east cove)` - https://www.travel-to-samos.com/beaches.php
- Samos: `Plaka (west cove)` - https://www.travel-to-samos.com/beaches.php
- Samos: `Klima` - https://beachsearcher.com/en/beach/300224119/klima-beach
- Santorini: `Gymnistiki paralia Vlychada` - https://www.allovergreece.com/Nudist-Beach/Descr/18/1074/en
- Santorini: `Baxes` - https://santorini-more.com/baxedes-beach/
- Kalymnos: `Paralia Megales Almyres` - https://greecedestination.gr/%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B5%CF%82-%CF%83%CF%84%CE%B7%CE%BD-%CE%BA%CE%AC%CE%BB%CF%85%CE%BC%CE%BD%CE%BF/
- Kefalonia: `Mounda` - https://www.gtp.gr/LocPage.asp?id=73140&lng=1
- Ikaria: `Paralia Xylosyrti` - https://www.visitikaria.gr/en/discover/beaches/xylosyrtis
- Tilos: `Agia Petros` - https://ecotourism-greece.com/location/dodecanese/tilos/
- Central Athens: `Limni Vouliagmenis` - https://necca.gov.gr/protateuomenes-perioxes/limni-vouliagmeni/

## Result

- Direct source URL coverage increased from 2234 to 2246 app-facing beaches out of 2720.
- Low-confidence app-facing records without direct source URLs decreased from 111 to 99.
- Samos, Santorini, Kalymnos, Kefalonia, Ikaria, Tilos, and Central Athens now have 0 low-confidence records without direct source URLs.

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
- 2246 with direct source URLs.
- 474 without direct source URLs.
- 99 low-confidence records without direct source URLs.

The production build completed with the existing Vite large chunk warning only.
