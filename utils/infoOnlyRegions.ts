// Regions shown in "info-only" mode: their beaches exist and are fully
// browsable/crawlable, but the live region page suppresses the interactive map
// and the today-recommendation ranking (podium / "best beaches" cards). Used to
// soft-launch a region for SEO/i18n before its map + recommendations are ready.
//
// Keyed by region id (== island id, e.g. 'south-aegean-milos'). Individual beach
// detail pages are unaffected. The prerendered static region page is already a
// plain beach list (no map / no ranking), so only the hydrated app needs this.
export const INFO_ONLY_REGION_IDS = new Set<string>([
  'south-aegean-milos',
]);

export const isInfoOnlyRegionId = (regionId?: string | null): boolean =>
  !!regionId && INFO_ONLY_REGION_IDS.has(regionId);
