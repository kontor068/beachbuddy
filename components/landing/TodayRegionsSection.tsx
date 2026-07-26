import React, { useMemo } from 'react';
import { ArrowRight, LoaderCircle, LocateFixed } from 'lucide-react';
import type { Island, LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { isInfoOnlyRegionId } from '../../utils/infoOnlyRegions';
import { buildBeachRegionPath } from '../../utils/beachUrls';
import { trackEvent } from '../../services/analyticsService';
import { landingCopy } from './landingCopy';
import type { ConditionsStatus } from '../../hooks/useNationalConditions';
import { NATIONAL_SAMPLE_REGION_IDS, type RegionConditionReading } from '../../services/nationalConditions';

// The landing's one navigation block, doing three jobs at once.
//
// It replaces two earlier sections — a "seas today" grid keyed on sea areas, and
// a separate popular-regions chip row — because each was half a thing:
//
//  * The sea-area grid was live but unactionable: nobody says "let's go to the
//    Cretan Sea", it carried no links, and on the calm days that are most of
//    summer all five tiles read the same word.
//  * The chip row was linkable but inert — just names, nothing a directory
//    cannot also list.
//
// Merged, each chip is a place people actually search for WITH today's number on
// it, which is the one thing a competitor's static catalogue cannot copy. It
// costs nothing extra: the national read already fetched five points, so those
// points simply moved from sea-area centroids onto these regions.
//
// Deliberately a compact chip row, not a photo grid — a browse-by-region card
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
  regions: RegionConditionReading[];
  status: ConditionsStatus;
  onSelectIsland: (island: Island) => void;
  onShowNearbyBeaches: () => void;
  /** Geolocation is in flight — the CTA must show it, it can take seconds. */
  isFindingLocation: boolean;
  locationError?: string | null;
  onOpenIslandSelector: () => void;
}

type VerdictKey = 'calm' | 'mild' | 'choppy' | 'strong' | 'rough';
const verdictKey = (bft: number): VerdictKey =>
  bft <= 2 ? 'calm' : bft <= 3 ? 'mild' : bft <= 4 ? 'choppy' : bft <= 5 ? 'strong' : 'rough';

// One tint per verdict, so five chips scan as a spread rather than five labels.
const VERDICT_TONE: Record<VerdictKey, string> = {
  calm: 'text-emerald-700 bg-emerald-50 ring-emerald-200/70',
  mild: 'text-teal-700 bg-teal-50 ring-teal-200/70',
  choppy: 'text-amber-800 bg-amber-50 ring-amber-200/70',
  strong: 'text-orange-800 bg-orange-50 ring-orange-200/70',
  rough: 'text-rose-800 bg-rose-50 ring-rose-200/70',
};

export const TodayRegionsSection: React.FC<TodayRegionsSectionProps> = ({
  language,
  allIslands,
  regions,
  status,
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
        {status === 'live' && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#007a83]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {c.live}
          </span>
        )}
        <span className="hidden h-px flex-1 translate-y-[-0.35rem] bg-slate-300/70 sm:block" aria-hidden="true" />
      </div>
      <p className="mt-2 max-w-xl text-[15px] font-normal leading-relaxed text-slate-600">{c.subtitle}</p>

      <div className="mt-5 flex flex-wrap gap-2 sm:mt-6 sm:gap-2.5">
        {islands.map(island => {
          const reading = regions.find(r => r.regionId === island.id);
          const vk = reading ? verdictKey(reading.beaufort) : null;
          const name = island.name[language];

          return (
            <a
              key={island.id}
              href={buildBeachRegionPath(island, language)}
              onClick={event => handleClick(event, island)}
              aria-label={reading && vk ? c.chipAria(name, reading.beaufort, c.verdicts[vk]) : name}
              className="group inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white/80 py-1 pl-4 pr-1.5 shadow-sm shadow-sky-900/5 backdrop-blur-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
            >
              <span className="text-[13px] font-extrabold text-slate-800 transition-colors group-hover:text-[#007a83] sm:text-sm">
                {name}
              </span>

              {reading && vk ? (
                <span
                  aria-hidden="true"
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ring-1 ${VERDICT_TONE[vk]}`}
                >
                  <span className="tabular-nums">{reading.beaufort}</span>
                  {c.verdicts[vk]}
                </span>
              ) : status === 'loading' ? (
                <span className="h-[1.4rem] w-14 animate-pulse rounded-full bg-slate-200" aria-hidden="true" />
              ) : (
                <ArrowRight
                  className="mr-1.5 h-3.5 w-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              )}
            </a>
          );
        })}
      </div>

      {/* Only claim an open-sea estimate when a number is actually on screen. */}
      {regions.length > 0 && (
        <p className="mt-3.5 max-w-2xl text-xs font-medium leading-relaxed text-slate-400">{c.note}</p>
      )}

      <div className="mt-6 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
        {/* Geolocation can take several seconds (and the browser may prompt
            first), so the button has to visibly commit the moment it is pressed —
            otherwise it reads as broken and gets tapped again. */}
        <button
          type="button"
          onClick={onShowNearbyBeaches}
          disabled={isFindingLocation}
          aria-busy={isFindingLocation}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-90 disabled:hover:bg-cta"
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
