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
  /**
   * True while the visitor is in "Near me" — a circle around their GPS rather than a region
   * they picked. The default words are wrong there twice over: "in this area" names nothing
   * they chose, and "it may belong to another region" is usually false — the beach is often
   * in the same prefecture, just further out than we looked (20 km, widened to 40).
   */
  isNearMe?: boolean;
  /**
   * How far the searched beach actually is, in km, when we could identify it nationally.
   * Straight-line, never driving distance (see NEAR_ME_BEACH_RADIUS_KM's note in App) — so the
   * copy says "from here" and never promises minutes on the road. Undefined when the name
   * matched nothing nationally; the card then drops the number rather than guessing.
   */
  foundElsewhereKm?: number;
  /**
   * Near-me only: return to the beaches around the visitor. Deliberately NOT
   * onClearSearchAndFilters — that one also resets the distance sort that "Near me" switched
   * on, so the list would silently stop being ordered nearest-first.
   */
  onBackToNearMe?: () => void;
}

export const BeachSearchEmptyState: React.FC<BeachSearchEmptyStateProps> = ({
  language,
  t,
  searchQuery = '',
  onSearchAllRegions,
  onClearSearchAndFilters,
  protectedSortNoResults = false,
  protectedSortEmptyCopy,
  isNearMe = false,
  foundElsewhereKm,
  onBackToNearMe,
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
  // Near-me wording only replaces the SEARCH miss. A filter miss inside "Near me" really is
  // about filters, and the ordinary words are right for it.
  const isNearMeMiss = isNearMe && isSearchMiss;

  // Round the way the number was measured: whole km, and tens above 100. A straight-line
  // estimate printed as "214 km" claims a precision the great-circle distance to a beach
  // pin does not have.
  const roundedKm = typeof foundElsewhereKm === 'number' && Number.isFinite(foundElsewhereKm)
    ? (foundElsewhereKm >= 100 ? Math.round(foundElsewhereKm / 10) * 10 : Math.round(foundElsewhereKm))
    : undefined;

  const nearMeTitle = roundedKm !== undefined && roundedKm > 0
    ? t.beachSearchFilters.nearMeSearchTitleWithDistance(trimmedQuery, roundedKm)
    : t.beachSearchFilters.nearMeSearchTitle(trimmedQuery);

  const title = protectedSortNoResults
    ? sortMessage.title
    : isNearMeMiss
      ? nearMeTitle
      : isSearchMiss
        ? t.beachSearchFilters.emptySearchTitle(trimmedQuery)
        : t.beachSearchFilters.emptyTitle;
  const body = protectedSortNoResults
    ? sortMessage.body
    : isNearMeMiss
      ? t.beachSearchFilters.nearMeSearchDescription
      : isSearchMiss
        ? t.beachSearchFilters.emptySearchDescription
        : t.beachSearchFilters.emptyDescription;
  const showSearchAllRegions = isSearchMiss && Boolean(onSearchAllRegions);
  // In "Near me" the second button goes back to the beaches around the visitor instead of
  // clearing filters they never set.
  const secondaryAction = isNearMeMiss && onBackToNearMe ? onBackToNearMe : onClearSearchAndFilters;
  const secondaryLabel = isNearMeMiss && onBackToNearMe
    ? t.beachSearchFilters.backToNearMe
    : t.beachSearchFilters.clearAll;

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
        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction}
            className={showSearchAllRegions
              ? 'inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              : 'inline-flex min-h-11 items-center justify-center rounded-full bg-cyan-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-400/70'}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </div>
  );
};
