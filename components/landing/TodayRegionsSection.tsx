import React, { useMemo } from 'react';
import { ArrowRight, LoaderCircle, LocateFixed } from 'lucide-react';
import type { Island, LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { isInfoOnlyRegionId } from '../../utils/infoOnlyRegions';
import { buildBeachRegionPath } from '../../utils/beachUrls';
import { trackEvent } from '../../services/analyticsService';
import { landingCopy } from './landingCopy';
import { RegionSilhouette } from './RegionSilhouette';
import { NATIONAL_SAMPLE_REGION_IDS, type RegionConditionReading } from '../../services/nationalConditions';
import { dominantWindSector, shelterForWind, sortRegionsByShelter, type RegionShelter } from '../../utils/landingShelter';

// The landing's one navigation block: crawlable links to the regions our own
// counter shows people actually search for.
//
// IT SHOWS NO BEAUFORT, AND IT NEVER WILL AGAIN. Each tile used to carry a live
// Beaufort reading, and it had to go: the reading came from open water (Corfu's
// sample sits 23 km offshore) while the region page one click later reads the
// coast, so the same place showed two different numbers on the same day. The
// methodology's conservative doctrine — never state a confident figure without
// positive evidence — makes that indefensible, and a visitor who catches the
// contradiction stops trusting both numbers, not one.
//
// WHAT IT SHOWS INSTEAD (29/08/2026): how many of the region's beaches are
// PROTECTED from the direction the wind is coming from today. That number
// survives the objection above for three reasons, and all three had to hold:
//
//   1. It is baked, not measured live (scripts/buildLandingShelter.mjs), by the
//      SAME assessBeachWindExposure that colours the map's pins — so the landing
//      and the region page cannot define "protected" differently.
//   2. It carries no wind SPEED. Only the direction moves it, and direction is
//      synoptic: the meltemi arrives from the same sector across the whole
//      Aegean, unlike the speed that differs 23 km offshore.
//   3. It is a LOWER BOUND, baked at 6 Beaufort — the map will show at least
//      this many protected beaches, never fewer. Proven over 2.808 checks by
//      scripts/validateLandingShelterBound.mjs, which is in the critical gate.
//
// The tiles are ORDERED by the share of protected beaches, so the strip actually
// reorders with the weather; ordering by the raw count was measured and rejected
// (it just ranks the regions by size). See utils/landingShelter.ts.
//
// The numbers appear only while the national reading is genuinely FRESH. A
// three-hour-old direction under the word «σήμερα» is the same over-claim in a
// different costume, so a stale or missing reading drops the whole strip back to
// plain name tiles and the plain subtitle.
//
// Deliberately a compact tile grid, not a photo grid: a browse-by-region card
// grid is the competitor's signature pattern, and it would cost a whole screen
// on the phones that are 88% of our traffic.
//
// ORDER comes from measured demand (our own first-party counter, July 2026), and
// lives with the sample points in services/nationalConditions.ts. Info-only
// regions are filtered out: they have no map and no today-ranking, so the app
// never offers them as destinations.

interface TodayRegionsSectionProps {
  language: LanguageCode;
  allIslands: Island[];
  onSelectIsland: (island: Island) => void;
  onShowNearbyBeaches: () => void;
  /** Geolocation is in flight — the CTA must show it, it can take seconds. */
  isFindingLocation: boolean;
  locationError?: string | null;
  onOpenIslandSelector: () => void;
  /** Today's wind per region, from the one national read the hero already pays for. */
  regionConditions: RegionConditionReading[];
  /**
   * Whether that read is recent enough to speak for "today" (hooks/useNationalConditions).
   * False → no numbers at all. This is a gate, not a nicety: everything below says «σήμερα».
   */
  isConditionsFresh: boolean;
}

export const TodayRegionsSection: React.FC<TodayRegionsSectionProps> = ({
  language,
  allIslands,
  onSelectIsland,
  onShowNearbyBeaches,
  isFindingLocation,
  locationError,
  onOpenIslandSelector,
  regionConditions,
  isConditionsFresh,
}) => {
  const c = getLocalizedCopy(language, landingCopy).today;

  const islands = useMemo(
    () =>
      NATIONAL_SAMPLE_REGION_IDS
        .map(id => allIslands.find(island => island.id === id))
        .filter((island): island is Island => Boolean(island) && !isInfoOnlyRegionId(island!.id)),
    [allIslands],
  );

  // Today's wind per region, keyed for lookup. Empty while loading, empty on
  // failure, and empty whenever the reading is too old to speak for "today" —
  // all three collapse to the same thing here, which is the point: there is one
  // "we don't know" and it looks like the section always looked.
  const windByRegion = useMemo(() => {
    if (!isConditionsFresh) return new Map<string, number | null>();
    return new Map(regionConditions.map(reading => [reading.regionId, reading.dirDeg]));
  }, [regionConditions, isConditionsFresh]);

  const shelterByRegion = useMemo(() => {
    const map = new Map<string, RegionShelter>();
    islands.forEach(island => {
      const shelter = shelterForWind(island.id, windByRegion.get(island.id) ?? null);
      if (shelter) map.set(island.id, shelter);
    });
    return map;
  }, [islands, windByRegion]);

  // Ordered best-first ONLY when we actually have numbers; otherwise the measured
  // demand order stands, exactly as before.
  const orderedIslands = useMemo(
    () => (shelterByRegion.size > 0 ? sortRegionsByShelter(islands, shelterByRegion) : islands),
    [islands, shelterByRegion],
  );

  const windSector = useMemo(
    () => (shelterByRegion.size > 0 ? dominantWindSector(islands.map(i => windByRegion.get(i.id) ?? null)) : null),
    [islands, windByRegion, shelterByRegion],
  );

  // Three subtitles, one per state of knowledge: we know the wind and the country
  // agrees on it; we know it but it differs region to region; we do not know.
  const subtitle = shelterByRegion.size === 0
    ? c.subtitle
    : windSector === null
      ? c.shelterSubtitleMixed
      : c.shelterSubtitle.replace('{wind}', c.windFrom[windSector]);

  // The links are the point of this section, so they must not depend on a
  // network call. If conditions fail we still render every chip — just without a
  // number. We never show a placeholder value.
  if (islands.length === 0) return null;

  // Progressive enhancement: the href is real (crawlers + middle-click + "open in
  // new tab" all work), but a plain left-click stays in the SPA.
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, island: Island) => {
    trackEvent('landing_region_clicked', undefined, { region_id: island.id });
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onSelectIsland(island);
  };

  return (
    <section className="mx-auto w-full max-w-6xl px-5" aria-label={c.title}>
      <div className="flex items-baseline gap-3">
        <h2 className="shrink-0 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{c.title}</h2>
        <span className="hidden h-px flex-1 translate-y-[-0.35rem] bg-slate-300/70 sm:block" aria-hidden="true" />
      </div>
      <p className="mt-2 max-w-xl text-[15px] font-normal leading-relaxed text-slate-600">{subtitle}</p>

      {/* NO BEAUFORT — see the doctrine at the top of this file. What each tile may
          carry is the baked count of PROTECTED beaches for today's wind
          direction, which is a lower bound on what the region's own map will
          show. The links were always the point of this section; they are
          untouched, and they render identically when the count is unavailable. */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4">
        {orderedIslands.map(island => {
          const name = island.name[language];
          const shelter = shelterByRegion.get(island.id);
          // The tile shows a bare fraction beside a bar, which reads as nothing at
          // all out loud, so the accessible name carries the whole sentence.
          const shelterLabel = shelter
            ? c.shelterAria
              .replace('{region}', name)
              .replace('{count}', String(shelter.sheltered))
              .replace('{total}', String(shelter.total))
            : undefined;

          return (
            // No per-tile arrow: thirteen identical chevrons are noise on a grid
            // where every tile is already a link. The affordance is carried by the
            // hover lift and the accent bar, which cost nothing when idle.
            <a
              key={island.id}
              href={buildBeachRegionPath(island, language)}
              onClick={event => handleClick(event, island)}
              aria-label={shelterLabel}
              className="group relative flex min-h-[3.25rem] items-center gap-0.5 overflow-hidden rounded-control border border-line bg-surface px-3.5 py-2 shadow-surface ring-1 ring-white/50 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-lifted hover:shadow-sky-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 motion-reduce:hover:translate-y-0 sm:gap-2 sm:px-4"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-[#007a83] transition-transform duration-200 group-hover:scale-y-100"
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="whitespace-normal break-words text-sm font-bold leading-snug tracking-tight text-slate-800 transition-colors group-hover:text-[#007a83]">
                  {name}
                </span>
                {/* The share as a bar, the count as a figure. The bar is what makes
                    the ordering legible at a glance on a phone — thirteen bare
                    fractions in two columns are a table, not a decision. Both are
                    aria-hidden: the anchor's own label says the whole sentence. */}
                {shelter && (
                  <span className="flex items-center gap-1.5" aria-hidden="true">
                    <span className="h-1 w-full max-w-[3.5rem] overflow-hidden rounded-full bg-slate-200">
                      <span
                        className="block h-full rounded-full bg-[#007a83]/70 transition-[width] duration-300 motion-reduce:transition-none"
                        style={{ width: `${Math.round(shelter.share * 100)}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[11px] font-bold leading-none tabular-nums text-slate-500">
                      {shelter.sheltered}/{shelter.total}
                    </span>
                  </span>
                )}
              </span>
              {/* The place's own coastline, drawn from our geometry. Kept faint so
                  it reads as the texture of the tile rather than a second thing to
                  look at, and comes forward on hover.

                  Smaller below `sm:` because at two columns on a 390px phone the
                  longest Greek names («Μαγνησία (Πήλιο)», «Ανατολική Αττική») were
                  measured truncating once the sketch took its width. The name is
                  the tile's job; the sketch yields to it. */}
              <RegionSilhouette
                regionId={island.id}
                className="h-6 w-6 shrink-0 text-[#007a83] opacity-[0.28] transition-opacity duration-200 group-hover:opacity-70 sm:h-9 sm:w-9"
              />
            </a>
          );
        })}
      </div>


      <div className="mt-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
        {/* Geolocation can take several seconds (and the browser may prompt
            first), so the button has to visibly commit the moment it is pressed —
            otherwise it reads as broken and gets tapped again. */}
        <button
          type="button"
          onClick={onShowNearbyBeaches}
          disabled={isFindingLocation}
          aria-busy={isFindingLocation}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lifted transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-90 disabled:hover:bg-cta"
        >
          {isFindingLocation ? (
            <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          ) : (
            <LocateFixed className="h-4 w-4" aria-hidden="true" />
          )}
          {isFindingLocation ? c.ctaPending : c.cta}
        </button>
        <button
          type="button"
          onClick={onOpenIslandSelector}
          className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-[#007a83] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
        >
          {c.allRegions}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* A denied or failed permission must not fail silently — otherwise the
          button just looks dead. */}
      {locationError && (
        <p role="status" className="mt-3 text-center text-[13px] font-semibold text-orange-700">
          {locationError}
        </p>
      )}
    </section>
  );
};

export default TodayRegionsSection;
