import React, { useMemo } from 'react';
import type { Island, LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { isInfoOnlyRegionId } from '../../utils/infoOnlyRegions';
import { buildBeachRegionPath } from '../../utils/beachUrls';
import { trackEvent } from '../../services/analyticsService';
import { landingCopy } from './landingCopy';

// The landing's only crawlable navigation. Two jobs at once:
//
//  1. PATHS — before this row the rendered landing contained exactly ONE <a> (the
//     FAQ), so a visitor who would not type a search and would not grant
//     geolocation had nowhere to go.
//  2. INTERNAL LINKING — the homepage is our highest-authority page; real <a href>
//     targets let it pass equity to the region pages (and onward to the beach
//     pages), which JS-only buttons never did.
//
// Deliberately a light chip row, NOT a photo grid — a browse-by-region card grid
// is the competitor's signature pattern.
//
// The order is not a guess: it is the "popular sections" breakdown from our own
// first-party counter. Milos is intentionally absent — it is an info-only region
// (no map / no today-ranking), and the app never surfaces those as destinations.

interface PopularRegionsRowProps {
  language: LanguageCode;
  allIslands: Island[];
  onSelectIsland: (island: Island) => void;
}

// Region ids ordered by real measured demand (first-party counter, July 2026).
const POPULAR_REGION_IDS = [
  'ionian-islands-lefkada',
  'north-aegean-lemnos',
  'central-macedonia-halkidiki-mainland',
  'south-aegean-paros',
  'south-aegean-patmos',
];

export const PopularRegionsRow: React.FC<PopularRegionsRowProps> = ({
  language,
  allIslands,
  onSelectIsland,
}) => {
  const c = getLocalizedCopy(language, landingCopy).popular;

  const regions = useMemo(
    () =>
      POPULAR_REGION_IDS
        .map(id => allIslands.find(island => island.id === id))
        .filter((island): island is Island => Boolean(island) && !isInfoOnlyRegionId(island!.id)),
    [allIslands],
  );

  if (regions.length === 0) return null;

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
    <nav className="mx-auto w-full max-w-6xl px-5" aria-label={c.ariaLabel}>
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 sm:gap-x-2.5">
        <span className="text-[13px] font-semibold text-slate-500">{c.label}</span>
        {regions.map(island => (
          <a
            key={island.id}
            href={buildBeachRegionPath(island, language)}
            onClick={event => handleClick(event, island)}
            className="inline-flex min-h-9 items-center rounded-full border border-slate-200 bg-white/75 px-3.5 text-[13px] font-bold text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
          >
            {island.name[language]}
          </a>
        ))}
      </div>
    </nav>
  );
};

export default PopularRegionsRow;
