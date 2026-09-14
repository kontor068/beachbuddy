import React from 'react';
import { MapPin, Waves } from 'lucide-react';
import { LanguageCode, Translation } from '../types';
import type { DirectorySearchSuggestion } from './BeachSearcherHome';

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
  /**
   * The whole-of-Greece matches for the same text — beaches and regions OUTSIDE the one on
   * screen — shown right inside the card. Measured 17/08–13/09/2026 (GA): 525 of 2.601
   * visitors (20%) settled on this card after a search, 64% of them on the Athens region, and
   * the matches they needed were already computed for the search dropdown — which closes the
   * moment the phone keyboard does. The button below only guessed ONE match; this lists them.
   */
  elsewhereSuggestions?: DirectorySearchSuggestion[];
  onElsewhereSelect?: (suggestion: DirectorySearchSuggestion) => void;
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
  elsewhereSuggestions = [],
  onElsewhereSelect,
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

  const shownElsewhere = isSearchMiss && onElsewhereSelect ? elsewhereSuggestions.slice(0, 5) : [];
  const hasElsewhere = shownElsewhere.length > 0;

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
        // With the matches listed, "search the whole of Greece" is advice for a step we
        // already took — the line just introduces the list instead.
        ? (hasElsewhere ? t.beachSearchFilters.emptySearchFoundElsewhere : t.beachSearchFilters.emptySearchDescription)
        : t.beachSearchFilters.emptyDescription;
  // The list IS the whole-of-Greece search, so its button only stays as the fallback for
  // when that search found nothing to list (or has not answered yet).
  const showSearchAllRegions = isSearchMiss && !hasElsewhere && Boolean(onSearchAllRegions);
  // In "Near me" the second button goes back to the beaches around the visitor instead of
  // clearing filters they never set.
  const secondaryAction = isNearMeMiss && onBackToNearMe ? onBackToNearMe : onClearSearchAndFilters;
  const secondaryLabel = isNearMeMiss && onBackToNearMe
    ? t.beachSearchFilters.backToNearMe
    : t.beachSearchFilters.clearAll;

  return (
    <div role="status" className="col-span-full rounded-3xl border border-white/60 bg-white/95 px-5 py-12 text-center shadow-sm ring-1 ring-white/35 dark:border-slate-800 dark:bg-slate-900/95">
      <p className="font-heading text-lg font-black text-slate-800 dark:text-slate-100">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-700 dark:text-slate-600">
        {body}
      </p>
      {hasElsewhere && (
        <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left">
          {shownElsewhere.map(suggestion => (
            <li key={suggestion.id}>
              <button
                type="button"
                onClick={() => onElsewhereSelect?.(suggestion)}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-sky-100 bg-white px-3 py-2 text-left shadow-sm transition hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-cyan-400/70 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${
                  suggestion.type === 'region' ? 'bg-cyan-50 text-[#007a83]' : 'bg-sky-50 text-sky-700'
                }`}>
                  {suggestion.type === 'region'
                    ? <MapPin className="h-4 w-4" aria-hidden="true" />
                    : <Waves className="h-4 w-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold leading-tight text-slate-950 dark:text-slate-100">
                    {suggestion.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs font-semibold leading-tight text-slate-700 dark:text-slate-400">
                    {suggestion.subtitle}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
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
