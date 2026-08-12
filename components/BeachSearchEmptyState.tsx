import React from 'react';
import { LanguageCode, Translation } from '../types';

/**
 * WHAT THE VISITOR SEES WHEN THE LIST COMES BACK EMPTY.
 *
 * This card used to live inline inside BeachList, which is rendered ONLY by
 * RecommendationSection, which App renders only under `!showHeaderForecast`. In summer a
 * forecast always exists, so from the day it was written (28/07/2026) until 13/08/2026 this
 * card never reached a single visitor: the beach sections simply vanished and the screen
 * went blank. Measured over 29/07–12/08: 233 of 288 people who searched (81%) hit an empty
 * list, and none of them were offered the whole-of-Greece lookup that would have found the
 * beach they typed.
 *
 * It lives in its own file now so BOTH the forecast home (BeachSearcherHome) and the
 * no-forecast list (BeachList) render the same words from the same place. Anything that can
 * empty a beach list must show this — an empty screen with no explanation is not a state,
 * it is a dead end.
 */

interface BeachSearchEmptyStateProps {
  language: LanguageCode;
  t: Translation;
  /** The settled search text behind the empty result set — tells a search miss from a filter miss. */
  searchQuery?: string;
  /** Runs the same whole-of-Greece search as pressing Enter in the search box. */
  onSearchAllRegions?: () => void;
  onClearSearchAndFilters?: () => void;
  /** True when the list is empty because the shelter-first sort found nothing, not because of a search. */
  protectedSortNoResults?: boolean;
  protectedSortEmptyCopy?: {
    title: string;
    body: string;
  };
}

export const BeachSearchEmptyState: React.FC<BeachSearchEmptyStateProps> = ({
  language,
  t,
  searchQuery = '',
  onSearchAllRegions,
  onClearSearchAndFilters,
  protectedSortNoResults = false,
  protectedSortEmptyCopy,
}) => {
  const protectedSortMessage = language === 'gr'
    ? {
      title: 'Δεν βρέθηκαν αρκετές κατάλληλες επιλογές.',
      body: 'Δεν βρέθηκαν αρκετές κατάλληλες επιλογές με τα διαθέσιμα δεδομένα. Δοκίμασε να γυρίσεις στις Όλες.',
    }
    : {
      title: 'Not enough suitable options were found.',
      body: 'Not enough suitable options were found with the available data. Try returning to All.',
    };
  const sortMessage = protectedSortEmptyCopy ?? protectedSortMessage;

  // A search that matched nothing is a different problem from filters that matched
  // nothing — and it is overwhelmingly the common one. Measured 2026-07-28: 101 users
  // reached this state in 28 days while only 18 ever applied a filter of any kind. They
  // had searched a beach that belongs to another region, and were told to clear filters
  // they never set, with a button that undoes their search rather than widening it.
  // The whole-of-Greece lookup they actually needed already existed — it just required
  // pressing Enter, which nothing on this screen suggested.
  const trimmedQuery = searchQuery.trim();
  const isSearchMiss = !protectedSortNoResults && trimmedQuery.length > 0;
  const title = protectedSortNoResults
    ? sortMessage.title
    : isSearchMiss
      ? t.beachSearchFilters.emptySearchTitle(trimmedQuery)
      : t.beachSearchFilters.emptyTitle;
  const body = protectedSortNoResults
    ? sortMessage.body
    : isSearchMiss
      ? t.beachSearchFilters.emptySearchDescription
      : t.beachSearchFilters.emptyDescription;
  const showSearchAllRegions = isSearchMiss && Boolean(onSearchAllRegions);

  return (
    <div role="status" className="col-span-full rounded-3xl border border-white/60 bg-white/72 px-5 py-12 text-center shadow-sm ring-1 ring-white/35 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-900/50">
      <p className="font-heading text-lg font-black text-slate-800 dark:text-slate-100">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-600">
        {body}
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {showSearchAllRegions && (
          <button
            type="button"
            onClick={onSearchAllRegions}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/70"
          >
            {t.beachSearchFilters.searchAllRegions}
          </button>
        )}
        {onClearSearchAndFilters && (
          <button
            type="button"
            onClick={onClearSearchAndFilters}
            className={showSearchAllRegions
              ? 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              : 'inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/70'}
          >
            {t.beachSearchFilters.clearAll}
          </button>
        )}
      </div>
    </div>
  );
};
