# Source follow-up pass 5 - 2026-05-27

## Scope

Continued the source-traceability pass for app-facing low-confidence beach records without direct source URLs.

This pass only added `metadata.sourceUrls` and conservative `metadata.sourceNotes` where a direct source supported beach identity/location. It did not change confidence, coordinates, access, services, amenities, wind profile, or scoring.

## Records updated

Added direct source URLs to 14 app-facing records:

- Magnesia/Pelion: `Plakes (Volos)`, `Vathia Spilia`, `Vlachorema`, `Vromoneri`, `Theotokos`, `Kastri`, `Klossou`, `Komos`, `Lepetous`, `Mourtias`, `Potoki`, `Ftelia`, `Chondri Ammos`
- Alonissos: `Tourkoneri`

## Boundaries

- Skipped candidates where the available source appeared to refer to a different location or the source/record coordinates were too far apart for a source-only update.
- Skipped records supported only by broad regional articles without a clean beach identity/location signal.
- Left all recommendation-facing beach behavior unchanged.

## Expected dataset result

- App-facing beaches: 2720
- Beaches with direct source URL: 2292
- Beaches without direct source URL: 428
- Direct source URL coverage: 84.3%
- Low-confidence beaches without direct source URL: 53
- Magnesia/Pelion low-confidence without direct source URL: 15
- Alonissos low-confidence without direct source URL: 19

## Validation

- Passed: `npm run build:beach-data`
- Passed: `node scripts/auditBeachVerificationCoverage.mjs`
- Passed: `npm run quality:beach-data`
- Passed: `npm run content:audit`
- Passed: `npm run audit:beaches -- --mode=deep --email-dry-run`
- Passed: `npm run build`

Production build completed with the existing Vite large chunk warning only.
