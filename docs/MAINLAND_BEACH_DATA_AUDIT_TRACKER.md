# Mainland Beach Data Audit Tracker

Purpose: track the mainland Greece beach-data audit for filter-facing attributes.

Scope for each mainland region:
- terrain: fine sand, coarse sand, pebbles, stones, rocks
- access: asphalt, passable dirt road, difficult dirt road, hiking path, boat-only
- amenities: organized, sunbeds, umbrellas, parking, shower, WC, natural shade
- food/drink: keep tavernas, restaurants/cafes, canteens, and beach bars separate
- safety/services: lifeguard only when source-backed and usually seasonal/year-marked
- experience filters: quiet, remote, family friendly, snorkeling, water sports
- wording: no unsupported calm/protected/safe/ideal claims

Rules:
- Unknown is better than false certainty.
- Do not use "4x4 only" in user-facing labels unless strictly verified.
- Do not mark a beach as quiet when it has a beach bar.
- Beach bar requires explicit beach bar, beach club, or equivalent source text.
- Tavernas/restaurants/cafes/canteens are not beach bars.
- Lifeguard claims must be source-backed and should be marked seasonal when relevant.
- Seasonal amenities can remain seasonal; do not imply they are guaranteed today.

Mainland regions completed before this mainland cycle:
- central-macedonia-halkidiki-mainland
- east-macedonia-and-thrace-rodopi-mainland
- east-macedonia-and-thrace-xanthi-mainland
- epirus-arta-mainland

Completed in this mainland cycle:
- attica-athens-area-mainland
- attica-east-attica-mainland
- attica-piraeus-area
- attica-west-attica-mainland
- central-greece-fokida-mainland
- central-greece-fthiotida-mainland
- central-greece-viotia-mainland
- central-macedonia-pieria-mainland
- central-macedonia-thessaloniki-area
- east-macedonia-and-thrace-evros-mainland
- east-macedonia-and-thrace-kavala-mainland
- epirus-preveza-mainland
- epirus-thesprotia-mainland
- peloponnese-argolida-mainland
- peloponnese-arkadia-mainland
- peloponnese-korinthia-mainland
- peloponnese-lakonia-mainland
- peloponnese-messinia-mainland
- thessaly-larissa-coast-agia---kissavos
- thessaly-magnesia-mainland---pelion
- west-greece-achaia-mainland
- west-greece-aetolia-acarnania-mainland
- west-greece-ileia-mainland

Pending mainland regions:
- None

Latest validation:
- 2026-05-25: `node scripts/auditBeachFilterAttributes.mjs` checked 110 app-ready region files / 2731 beaches with 0 findings.
- 2026-05-25: Mainland scoped check covered 27 region files / 711 mainland beaches with 0 findings.
- Mainland cleanups split joined food/drink/amenity labels, removed unsupported hard "4x4 only" wording, and kept lifeguard claims only where source-backed.
- Corrected mainland access exceptions found during review: Mylokopi remains difficult-access/source-backed; Tigania Lakonia was corrected from a wrong remote-Mani dirt-road profile to the Elaia/Lakonia organized road-access profile.

Suggested batch order:
1. Attica mainland: Athens coast, East Attica, Piraeus, West Attica.
2. Central Greece mainland: Fokida, Fthiotida, Viotia.
3. Macedonia/Thrace mainland: Pieria, Thessaloniki area, Evros, Kavala.
4. Epirus mainland: Preveza, Thesprotia.
5. Peloponnese mainland: Argolida, Arkadia, Korinthia, Lakonia, Messinia.
6. Thessaly mainland: Pelion/Magnesia, Larissa coast.
7. West Greece mainland: Achaia, Aetolia-Acarnania, Ileia.
