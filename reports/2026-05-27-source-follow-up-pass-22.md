# Source follow-up pass 22 - Viotia, Strymonikos, and Chania

Date: 2026-05-27

## Scope

Continued the medium-confidence/no-direct-source pass after source follow-up pass 21.

This pass only adds `metadata.sourceUrls` and conservative `metadata.sourceNotes` for identity/location traceability. It does not change confidence, coordinates, access, services, amenities, wind profile, scoring, or recommendation behavior.

## Updated records

| Region | Area | Beach | Source | Source use |
| --- | --- | --- | --- | --- |
| Central Greece / Viotia | Viotia mainland | Agios Nikolaos | `https://i-lovegreece.com/el/features/%CE%B7%CF%80%CE%B5%CE%B9%CF%81%CF%89%CF%84%CE%B9%CE%BA%CE%AE-%CE%B5%CE%BB%CE%BB%CE%AC%CE%B4%CE%B1/%CF%83%CF%84%CE%B5%CF%81%CE%B5%CE%AC-%CE%B5%CE%BB%CE%BB%CE%AC%CE%B4%CE%B1/%CE%B2%CE%BF%CE%B9%CF%89%CF%84%CE%AF%CE%B1/%CE%B1%CE%BE%CE%B9%CE%BF%CE%B8%CE%AD%CE%B1%CF%84%CE%B1-%CE%B4%CF%81%CE%B1%CF%83%CF%84%CE%B7%CF%81%CE%B9%CF%8C%CF%84%CE%B7%CF%84%CE%B5%CF%82/1818-paralia-agios-nikolaos-sth-boiwtia` | Direct beach page; identity/location traceability only. |
| Central Greece / Viotia | Viotia mainland | Paralia Koromili | `https://www.xo.gr/maps/anazitisi-diefthynsis/agrilia-paralia-koromili-thiva-32200/` | Direct map/address page; identity/location traceability only. |
| Central Greece / Viotia | Viotia mainland | Paralia Livadostras | `https://buk.gr/el/poli-perioxi/paralia-livadostras` | Direct place page; identity/location traceability only. |
| Central Greece / Viotia | Viotia mainland | Paralia Saranti | `https://www.allovergreece.com/Wheelchair-Accessible-Beach/Descr/R99/1148/el` | Direct accessible-beach page; identity/location traceability only. |
| Central Macedonia / Thessaloniki | Thessaloniki area | Kyani Akti | `https://visit-centralmacedonia.gr/el/1-%CF%84%CE%B9-%CE%BD%CE%B1-%CE%BA%CE%B1%CE%BD%CE%B5%CF%84%CE%B5/73/%CE%B7%CE%BB%CE%B9%CE%BF%CF%82-%CE%B8%CE%B1%CE%BB%CE%B1%CF%83%CF%83%CE%B1/91/%CE%BA%CF%85%CE%B1%CE%BD%CE%B7-%CE%B1%CE%BA%CF%84%CE%B7-%CF%83%CE%B5%CF%81%CF%81%CF%89%CE%BD` | Official tourism page; Asprovalta/Strymonikos identity/location traceability only. |
| Central Macedonia / Thessaloniki | Thessaloniki area | Paralia Serraiki Akti | `https://visit-centralmacedonia.gr/el/1-%CF%84%CE%B9-%CE%BD%CE%B1-%CE%BA%CE%B1%CE%BD%CE%B5%CF%84%CE%B5/73/%CE%B7%CE%BB%CE%B9%CE%BF%CF%82-%CE%B8%CE%B1%CE%BB%CE%B1%CF%83%CF%83%CE%B1/405/%CF%83%CE%B5%CF%81%CF%81%CE%B1%CE%B9%CE%BA%CE%B7-%CE%B1%CE%BA%CF%84%CE%B7` | Official tourism page; Asprovalta/Strymonikos identity/location traceability only. |
| Crete / Chania | Crete (Chania) | Krios | `https://www.cretanbeaches.com/el/%CE%B8%CE%B1%CE%BB%CE%AC%CF%83%CF%83%CE%B9%CE%BF%CF%82-%CF%84%CE%BF%CF%85%CF%81%CE%B9%CF%83%CE%BC%CF%8C%CF%82/%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B5%CF%82-%CE%B4%CF%85%CF%84%CE%B9%CE%BA%CE%AE%CF%82-%CE%BA%CF%81%CE%AE%CF%84%CE%B7%CF%82/%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B1-%CE%BA%CF%81%CE%B9%CF%8C%CF%82-%CF%80%CE%B1%CE%BB%CE%B1%CE%B9%CF%8C%CF%87%CF%89%CF%81%CE%B1-%CE%BA%CE%BF%CF%85%CE%BD%CF%84%CE%BF%CF%8D%CF%81%CE%B1` | Direct beach page; identity/location traceability only. |
| Crete / Chania | Crete (Chania) | Loutraki | `https://chaniacityapp.gr/place/loutraki-el/` | Direct Chania City page; identity/location traceability only. |
| Crete / Chania | Crete (Chania) | Lykos | `https://www.elizabethestateagency.com/gr/paralies/lykos/` | Direct local beach page; identity/location traceability only. |
| Crete / Chania | Crete (Chania) | Menies/Diktynna | `https://www.cretanbeaches.com/el/%CE%B8%CE%B1%CE%BB%CE%AC%CF%83%CF%83%CE%B9%CE%BF%CF%82-%CF%84%CE%BF%CF%85%CF%81%CE%B9%CF%83%CE%BC%CF%8C%CF%82/%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B5%CF%82-%CE%B4%CF%85%CF%84%CE%B9%CE%BA%CE%AE%CF%82-%CE%BA%CF%81%CE%AE%CF%84%CE%B7%CF%82/%CF%80%CE%B1%CF%81%CE%B1%CE%BB%CE%AF%CE%B1-%CE%BC%CE%AD%CE%BD%CE%B9%CE%B5%CF%82-%CE%B4%CE%AF%CE%BA%CF%84%CF%85%CE%BD%CE%BD%CE%B1` | Direct beach page; identity/location traceability only. |

## Coverage after pass

- App-facing beaches: 2720
- With direct source URL: 2373
- Without direct source URL: 347
- Direct-source coverage: 87.2%
- Low-confidence records without direct source URL: 30

## Validation

- `npm run build:beach-data` passed: split 2720 beaches into 110 region files and regenerated raw/app-ready/summary/detail files.
- `node scripts/auditBeachVerificationCoverage.mjs` passed: 2720 beaches, 2373 with direct source URL, 2720 with any evidence, 0 findings.
- `npm run quality:beach-data` passed: 2720 beaches scanned, 0 findings.
- `npm run content:audit` passed: 442 files scanned, 0 findings.
- `npm run audit:beaches -- --mode=deep --email-dry-run` passed: 2720 beaches checked, 0 issues; email skipped because dry-run email config was not provided.
- `npm run build` passed; Vite emitted the existing chunk-size warning.
