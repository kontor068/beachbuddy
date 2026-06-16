/**
 * The "most touristic" region tier — the highest-traffic islands/coasts where a wrong
 * beach name or mis-routed pin is most visible. Region ids match public/data/beaches/index.json.
 *
 * Shared by:
 *   - scripts/auditPlaceResolution.mjs  (the on-demand OSM/Nominatim sweep)
 *   - scripts/validateCriticalBeachData.mjs  (the offline quality-gate guard)
 *
 * Keep this list and the ids in sync with the index; auditPlaceResolution hard-fails if an
 * id here is missing from the index, so a rename can't silently drop a region from coverage.
 */
export const TOURISTIC_TIER = [
  'south-aegean-naxos',
  'south-aegean-paros',
  'south-aegean-mykonos',
  'south-aegean-santorini',
  'south-aegean-milos',
  'crete-crete-chania',
  'crete-crete-rethymno',
  'crete-crete-heraklion',
  'crete-crete-lasithi',
  'ionian-islands-corfu',
  'ionian-islands-zakynthos',
  'ionian-islands-kefalonia',
  'ionian-islands-lefkada',
  'central-macedonia-halkidiki-mainland',
];
