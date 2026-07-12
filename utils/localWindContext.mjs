/**
 * Single source of truth for a region's dominant SUMMER wind regime — shared by
 * TypeScript runtime (windClimatology, beachGuides, App) and the plain-node build
 * scripts (buildBeachRegionData, prerenderBeachPages). Plain .mjs so every context
 * can import it.
 *
 * The meltemi is a Central/South Aegean phenomenon. The Ionian/West runs on the
 * afternoon NW "maistros"; the Thermaic gulf's winter Vardaris is irrelevant in
 * summer — the nuisance there is the same afternoon NW/W sea breeze. So the
 * "sheltered from the local summer wind" sectors differ by regime.
 */

// Only non-default regions listed; everything else is 'aegean'.
export const REGION_WIND_CONTEXT = {
  // Ionian & West — the NW maistros
  'ionian-islands-corfu': 'ionian', 'ionian-islands-kefalonia': 'ionian', 'ionian-islands-zakynthos': 'ionian',
  'ionian-islands-lefkada': 'ionian', 'ionian-islands-paxos': 'ionian', 'ionian-islands-antipaxos': 'ionian',
  'ionian-islands-ithaca': 'ionian', 'ionian-islands-meganisi': 'ionian', 'ionian-islands-othonoi': 'ionian',
  'ionian-islands-erikoussa': 'ionian', 'ionian-islands-mathraki': 'ionian',
  'epirus-thesprotia-mainland': 'ionian', 'epirus-preveza-mainland': 'ionian', 'epirus-arta-mainland': 'ionian',
  'west-greece-achaia-mainland': 'ionian', 'west-greece-aetolia-acarnania-mainland': 'ionian', 'west-greece-ileia-mainland': 'ionian',
  'peloponnese-korinthia-mainland': 'ionian', 'central-greece-fokida-mainland': 'ionian', 'central-greece-viotia-mainland': 'ionian',
  // Thermaic gulf — afternoon NW/W summer sea breeze (no wind name in copy)
  'central-macedonia-pieria-mainland': 'thermaic', 'central-macedonia-thessaloniki-area': 'thermaic',
};

export const getRegionWindContext = regionId => REGION_WIND_CONTEXT[regionId] || 'aegean';

// Sectors that define "sheltered from the local summer wind" per regime.
export const LOCAL_WIND_SECTORS = {
  aegean: ['N', 'NE'],
  ionian: ['NW', 'W'],
  thermaic: ['NW', 'W'],
};

// Copy tokens per regime. `elFrom`/`elIn` bake the article + case; thermaic has
// no wind name ("the summer wind"), by design.
export const LOCAL_WIND_LABEL = {
  aegean:   { elNom: 'το μελτέμι',        elFrom: 'από το μελτέμι',            elIn: 'στο μελτέμι',            en: 'the meltemi',    enSubject: 'the meltemi',    de: 'dem Meltemi',    fr: 'du meltem',       it: 'dal meltemi' },
  ionian:   { elNom: 'ο μαΐστρος',        elFrom: 'από τον μαΐστρο',           elIn: 'στον μαΐστρο',           en: 'the maistros',   enSubject: 'the maistros',   de: 'dem Maistros',   fr: 'du maïstro',      it: 'dal maestrale' },
  thermaic: { elNom: 'ο καλοκαιρινός αέρας', elFrom: 'από τον καλοκαιρινό αέρα', elIn: 'στον καλοκαιρινό αέρα', en: 'the summer wind', enSubject: 'the summer wind', de: 'dem Sommerwind', fr: "du vent d'été",   it: 'dal vento estivo' },
};

export const localWindLabelFor = regionId => LOCAL_WIND_LABEL[getRegionWindContext(regionId)];
export const localWindSectorsFor = regionId => LOCAL_WIND_SECTORS[getRegionWindContext(regionId)];
