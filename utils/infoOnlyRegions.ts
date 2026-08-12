// Two separate, deliberately un-merged suppressions for a region.
//
// INFO_ONLY — the strong one: the region's beaches exist and are browsable/crawlable, but the
// live region page withholds BOTH the interactive map and the today-recommendation ranking
// (podium / "best beaches" cards). Used to soft-launch a region for SEO/i18n before its map +
// recommendations are ready. Currently empty: no region is held back this way.
//
// MAP_HIDDEN — the narrow one: everything runs exactly as in any other region (recommendations,
// podium, filters, trip planner, «Κοντά μου», search) and only the pin map is withheld. Milos
// sits here since 12/08/2026 — the reason it is held back was never that its data was not
// ready, so withholding the ranking too was costing the region its whole product for nothing.
//
// Keyed by region id (== island id, e.g. 'south-aegean-milos'). Individual beach detail pages
// are unaffected by either set. The prerendered static region page is already a plain beach
// list (no map / no ranking), so only the hydrated app reads these.
export const INFO_ONLY_REGION_IDS = new Set<string>([]);

export const MAP_HIDDEN_REGION_IDS = new Set<string>([
  'south-aegean-milos',
]);

export const isInfoOnlyRegionId = (regionId?: string | null): boolean =>
  !!regionId && INFO_ONLY_REGION_IDS.has(regionId);

/**
 * True for a region whose beaches must never be plotted as pins. An info-only region is
 * map-hidden by definition — the map is the first thing it withholds — so this is a superset
 * and callers gating map UI need only ask this one.
 */
export const isMapHiddenRegionId = (regionId?: string | null): boolean =>
  !!regionId && (MAP_HIDDEN_REGION_IDS.has(regionId) || INFO_ONLY_REGION_IDS.has(regionId));
