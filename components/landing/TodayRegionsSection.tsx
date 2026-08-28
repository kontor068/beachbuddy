import React, { useMemo } from 'react';
import { ArrowRight, LoaderCircle, LocateFixed } from 'lucide-react';
import type { Island, LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { isInfoOnlyRegionId } from '../../utils/infoOnlyRegions';
import { buildBeachRegionPath } from '../../utils/beachUrls';
import { trackEvent } from '../../services/analyticsService';
import { landingCopy } from './landingCopy';
import { RegionSilhouette } from './RegionSilhouette';
import { NATIONAL_SAMPLE_REGION_IDS } from '../../services/nationalConditions';

// The landing's one navigation block: crawlable links to the regions our own
// counter shows people actually search for.
//
// IT NO LONGER SHOWS WIND. Each tile used to carry a live Beaufort reading, and
// it had to go: the reading came from open water (Corfu's sample sits 23 km
// offshore) while the region page one click later reads the coast, so the same
// place showed two different numbers on the same day. The methodology's
// conservative doctrine — never state a confident figure without positive
// evidence — makes that indefensible, and a visitor who catches the
// contradiction stops trusting both numbers, not one.
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
}

export const TodayRegionsSection: React.FC<TodayRegionsSectionProps> = ({
  language,
  allIslands,
  onSelectIsland,
  onShowNearbyBeaches,
  isFindingLocation,
  locationError,
  onOpenIslandSelector,
}) => {
  const c = getLocalizedCopy(language, landingCopy).today;

  const islands = useMemo(
    () =>
      NATIONAL_SAMPLE_REGION_IDS
        .map(id => allIslands.find(island => island.id === id))
        .filter((island): island is Island => Boolean(island) && !isInfoOnlyRegionId(island!.id)),
    [allIslands],
  );

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
      <p className="mt-2 max-w-xl text-[15px] font-normal leading-relaxed text-slate-600">{c.subtitle}</p>

      {/* NAMES AND LINKS ONLY — the per-region Beaufort was deliberately removed.
          It was sampled in open water (Corfu's point sits 23 km offshore) while
          the region page one click later reads the coast, so the two showed
          different numbers for the same place on the same day.
          docs/methodology-wind-exposure-GR.md is explicit: never state a
          confident figure without positive evidence for it — and two confident
          figures that contradict each other are worse than none. The links were
          always the point of this section; they are untouched. */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-3 sm:gap-2.5 lg:grid-cols-4">
        {islands.map(island => {
          const name = island.name[language];

          return (
            // No per-tile arrow: thirteen identical chevrons are noise on a grid
            // where every tile is already a link. The affordance is carried by the
            // hover lift and the accent bar, which cost nothing when idle.
            <a
              key={island.id}
              href={buildBeachRegionPath(island, language)}
              onClick={event => handleClick(event, island)}
              className="group relative flex min-h-[3.25rem] items-center gap-0.5 overflow-hidden rounded-2xl border border-white/70 bg-white/70 px-3.5 py-2 shadow-sm shadow-sky-900/5 ring-1 ring-white/50 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-200 hover:bg-white hover:shadow-md hover:shadow-sky-900/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 motion-reduce:hover:translate-y-0 sm:gap-2 sm:px-4"
            >
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-0.5 origin-top scale-y-0 bg-[#007a83] transition-transform duration-200 group-hover:scale-y-100"
              />
              <span className="min-w-0 flex-1 whitespace-normal break-words text-sm font-bold leading-snug tracking-tight text-slate-800 transition-colors group-hover:text-[#007a83]">
                {name}
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
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-teal-900/20 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-90 disabled:hover:bg-cta"
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
