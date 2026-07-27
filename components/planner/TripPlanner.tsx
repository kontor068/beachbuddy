import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  ChevronRight,
  CloudLightning,
  CloudRain,
  Compass,
  Shield,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import type { Beach, DailyForecast, LanguageCode, UserPreferences } from '../../types';
import type { GeospatialExposureProfileLookup } from '../../services/geospatialExposureService';
import { getLocalizedCopy, languageToDateLocale } from '../../utils/i18n';
import { getBeaufortLevel } from '../../utils/weatherUtils';
import { windSectorFromDegrees } from '../../utils/windExposureEngine';
import { trackEvent } from '../../services/analyticsService';
import { planTrip, type TripDayPlan, type TripPick } from '../../services/tripPlannerService';
import { tripPlannerCopy } from './tripPlannerCopy';

// "I'm here for N days — which beach on which day?"
//
// PLACEMENT: a single self-contained card directly under today's picks. Not the
// top of the page (most visitors only want today, and 88% are on a phone), and
// not a separate tab (at ~1.6 pages per visit, nothing behind a tab gets found).
// The day-count chips ARE the entry point, so it costs one tap.
//
// DISCOVERABILITY (2026-07-27): the previous collapsed state was one line of
// text plus five bare digits, and visitors walked straight past the app's only
// unique feature. Collapsed now leads with the PROMISE ("every day, the beach
// that fits the wind") next to the chips that deliver it, so the card explains
// itself before it is tapped. Still two short rows on desktop — it sits between
// the beach cards and the recommendations and must not become the page.
//
// COST: planning scores up to 72 beaches per day, so it runs ONLY after the
// visitor picks a day count — never on page load. The pick is deferred so the
// tap paints immediately (chip + skeleton rows) before the scoring pass runs;
// useDeferredValue does not move the work off the main thread, it only keeps
// the tap responsive — the pool cap is what bounds the cost.

interface TripPlannerProps {
  beaches: Beach[];
  forecast: DailyForecast[];
  language: LanguageCode;
  /** Region id for analytics only — never used in planning. */
  regionId: string;
  preferences?: UserPreferences;
  geospatialProfiles?: GeospatialExposureProfileLookup;
  /** The homepage's own rain verdict for today (see PlanTripInput). */
  todayRainBlocked?: boolean;
  userLocation?: { lat: number; lon: number };
  /**
   * A stay length the visitor STATED in the search box («Νάξο 5 μέρες»).
   * Never a default — absent means the strip opens collapsed, as always.
   */
  initialDays?: number;
  onBeachClick: (beach: Beach) => void;
}

const DAY_OPTIONS = [2, 3, 4, 5, 6];

/**
 * A stated stay length, brought inside what we can actually answer. The
 * forecast is 6 days; DAY_OPTIONS starts at 2 because the whole homepage
 * already answers "today", so a 1-day stay is not a plan.
 *
 * Clamping lives HERE and not in the parser because only this component knows
 * `forecast.length`. The raw number is kept by the caller so `beyond` can still
 * say out loud how many days we could not answer.
 */
const clampRequestedDays = (requested: number | undefined, horizon: number): number | null => {
  if (typeof requested !== 'number' || !Number.isFinite(requested)) return null;
  if (requested < DAY_OPTIONS[0]) return null;
  const ceiling = Math.min(DAY_OPTIONS[DAY_OPTIONS.length - 1], Math.max(1, horizon));
  return Math.min(Math.floor(requested), ceiling);
};

/** Entrance stagger. Capped so a 6-day plan still finishes inside ~500ms. */
const ROW_STAGGER_MS = 45;

const CHIP_BASE =
  'inline-flex h-11 min-w-11 cursor-pointer items-center justify-center rounded-xl px-3.5 text-[15px] font-extrabold ' +
  // `translate` is listed because Tailwind v4 compiles translate-* to the
  // `translate` property; without it the hover lift snaps instead of easing.
  'transition-[translate,background-color,border-color,color,box-shadow] duration-200 ease-out ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0369a1] focus-visible:ring-offset-2 focus-visible:ring-offset-white ' +
  'motion-reduce:transition-none';
const CHIP_IDLE =
  'border border-cyan-300/90 bg-white/95 text-[#0369a1] shadow-sm shadow-sky-900/10 ' +
  'hover:-translate-y-0.5 hover:border-transparent hover:bg-gradient-to-br hover:from-[#0ea5e9] hover:to-[#0284c7] hover:text-white hover:shadow-md hover:shadow-sky-900/25 ' +
  'active:translate-y-0 motion-reduce:hover:translate-y-0';
const CHIP_ACTIVE =
  'border border-transparent bg-gradient-to-br from-[#0ea5e9] to-[#0284c7] text-white shadow-md shadow-sky-900/25';

/** One badge shape for every meta pill, so the row reads as a single system. */
const BADGE_BASE =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold leading-5 ring-1';

export const TripPlanner: React.FC<TripPlannerProps> = ({
  beaches,
  forecast,
  language,
  regionId,
  preferences,
  geospatialProfiles,
  todayRainBlocked,
  userLocation,
  initialDays,
  onBeachClick,
}) => {
  const c = getLocalizedCopy(language, tripPlannerCopy);
  // Lazy initializer, NOT an effect: an effect would render once at null and
  // then flip, replaying the entrance stagger and computing the plan twice.
  const [days, setDays] = useState<number | null>(() => clampRequestedDays(initialDays, forecast.length));
  // `null` as the initial deferred value is what keeps the cost contract above
  // intact when `days` arrives pre-set: on mount `deferredDays` is null, the
  // plan memo short-circuits, the skeleton rows paint, and the 72-beach pass
  // runs in the background render — exactly what a chip tap produces. Without
  // the second argument useDeferredValue does not defer on the first render
  // and the whole scoring pass would land synchronously in the first commit.
  const deferredDays = useDeferredValue(days, null);
  const isPlanning = days !== null && deferredDays !== days;

  const plan = useMemo(() => {
    if (!deferredDays) return [];
    return planTrip({
      beaches,
      forecast,
      days: deferredDays,
      language,
      preferences,
      geospatialProfiles,
      userLocation,
      todayRainBlocked,
    });
  }, [beaches, deferredDays, forecast, geospatialProfiles, language, preferences, todayRainBlocked, userLocation]);

  // Entrance: rows mount at opacity-0/translate-y and flip on the next frame, so
  // the stagger is pure transform+opacity with no keyframes and no library. Held
  // in state (not CSS animation) so a re-plan replays it — which is exactly the
  // feedback a visitor needs when they switch 3 days for 5.
  const [rowsRevealed, setRowsRevealed] = useState(false);
  useEffect(() => {
    if (!deferredDays || isPlanning) {
      setRowsRevealed(false);
      return;
    }
    const frame = requestAnimationFrame(() => setRowsRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [deferredDays, isPlanning]);

  // Fired AFTER the plan computes (not on the raw tap) so the event can carry
  // blank_days — the honest measure of how often the feature answers "no beach
  // day". region_id + beaufort tell us whether the multi-day audience is real
  // on the windy days the feature exists for. The ref stops re-renders (fresh
  // forecast, language switch) from double-counting one choice.
  const trackedDaysRef = useRef<number | null>(null);
  // A plan that opened because the visitor TYPED a stay length is a different
  // audience from one that opened on a chip tap. Label it rather than suppress
  // it: trip_planned is the only evidence this feature works, and search→plan
  // is the funnel worth measuring. Flipped off the moment they touch a chip.
  const autoOpenedRef = useRef(initialDays != null);
  useEffect(() => {
    if (!days || plan.length === 0 || trackedDaysRef.current === days) return;
    trackedDaysRef.current = days;
    trackEvent('trip_planned', undefined, {
      days,
      region_id: regionId,
      beaufort: getBeaufortLevel((forecast[0]?.wind?.speed ?? 0) * 3.6),
      blank_days: plan.filter(entry => entry.status === 'no_beach_day').length,
      source: autoOpenedRef.current ? 'search_intent' : 'chip',
    });
  }, [days, forecast, plan, regionId]);

  if (forecast.length === 0 || beaches.length === 0) return null;

  const dayLabel = (plan_: TripDayPlan) => {
    if (plan_.dayIndex === 0) return c.today;
    if (plan_.dayIndex === 1) return c.tomorrow;
    return new Intl.DateTimeFormat(languageToDateLocale(language), { weekday: 'long' }).format(new Date(plan_.date));
  };
  /** "27 Ιουλ" — the calendar anchor next to the weekday, so a plan can be used. */
  const dayDate = (plan_: TripDayPlan) =>
    new Intl.DateTimeFormat(languageToDateLocale(language), { day: 'numeric', month: 'short' })
      .format(new Date(plan_.date));
  const weekdayOf = (dayIndex: number) =>
    new Intl.DateTimeFormat(languageToDateLocale(language), { weekday: 'long' })
      .format(new Date(forecast[dayIndex].date));

  // The per-day "why this beach": the SERVICE decided the claim (whyKey,
  // honesty-first); this only renders the localized sentence for it, with the
  // provisional-day qualifier appended because a day-5 direction is a guess.
  const whyLine = (entry: TripDayPlan, pick: TripPick): string => {
    const windFrom = c.windFrom[pick.windSector ?? windSectorFromDegrees(forecast[entry.dayIndex]?.wind?.deg ?? 0)];
    const base = pick.whyKey === 'calm_everywhere'
      ? c.why.calm_everywhere
      : pick.whyKey === 'cove_refuge'
        ? c.why.cove_refuge(windFrom)
        : pick.whyKey === 'sheltered'
          ? c.why.sheltered(windFrom)
          : pick.whyKey === 'partial_shelter'
            ? c.why.partial_shelter(windFrom)
            : c.why.best_available(windFrom, pick.windBeaufort);
    return entry.confidence === 'provisional' ? `${base} — ${c.ifWindHolds}` : base;
  };

  // The timeline node's colour. It follows the SAME 5 Bft gate as the caution
  // badge: below that, wind is a light/moderate breeze and nothing here may
  // imply alarm. And a caution pick never gets the calm accent — a pick that
  // did not clear the suitability bar must not LOOK like one that did.
  const nodeTone = (entry: TripDayPlan): string => {
    if (entry.status !== 'beach' || !entry.pick) return 'bg-slate-300';
    if (entry.pick.caution) return entry.pick.windBeaufort >= 5 ? 'bg-orange-400' : 'bg-sky-300';
    return 'bg-[#0ea5e9]';
  };

  const blankDayIcon = (entry: TripDayPlan) => {
    if (entry.reason === 'storm') return CloudLightning;
    if (entry.reason === 'rain') return CloudRain;
    if (entry.reason === 'too_windy') return Wind;
    return Compass;
  };

  const choose = (value: number) => {
    autoOpenedRef.current = false;
    setDays(value);
  };

  const clear = () => {
    // Re-picking after an explicit close is a new intent — let it count again.
    trackedDaysRef.current = null;
    setDays(null);
  };

  // Measured against what the visitor ASKED for, not against the clamped value.
  // Someone who typed «14 μέρες» gets a 6-day plan; answering that with
  // beyond === 0 would be dishonest by omission, and the copy to say it
  // (c.beyondHorizon) already exists.
  const requestedForBeyond = Math.max(initialDays ?? 0, days ?? 0);
  const beyond = requestedForBeyond ? Math.max(0, requestedForBeyond - forecast.length) : 0;
  const hasProvisional = plan.some(entry => entry.confidence === 'provisional');
  const hasCaution = plan.some(entry => entry.pick?.caution && entry.pick.windBeaufort >= 5);
  const hasRefuge = plan.some(entry => entry.isRefuge);

  const dayChips = (
    <div className="flex flex-wrap items-center gap-2">
      {DAY_OPTIONS.map(value => (
        <button
          key={value}
          type="button"
          onClick={() => choose(value)}
          aria-label={c.planForDays(value)}
          aria-pressed={days === value}
          className={`${CHIP_BASE} ${days === value ? CHIP_ACTIVE : CHIP_IDLE}`}
        >
          {value}
        </button>
      ))}
    </div>
  );

  return (
    <section
      className="mx-auto w-full max-w-6xl px-3 sm:px-4"
      aria-label={c.prompt}
      data-nosnippet="true"
    >
      {/* Refined glass in the app's cyan, not white-on-white: collapsed, this
          card sits between vivid beach photos and the rest of the page — at
          bg-white/72 on a near-white background it was invisible in practice
          (2026-07-26). The gradient + corner glow give it depth without a new
          hue; deliberately NO orange anywhere structural, because orange is
          this app's caution colour and must keep meaning only that. */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-white/92 via-cyan-50/92 to-sky-100/80 px-4 py-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/50 backdrop-blur-xl sm:px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-sky-300/25 blur-3xl"
        />

        <div className="relative">
          {/* ── Header: the promise on the left, the way in on the right ──── */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#007a83] text-white shadow-sm shadow-cyan-900/25 ring-1 ring-white/40">
                <CalendarRange className="h-5 w-5" aria-hidden="true" />
              </span>

              <div className="min-w-0">
                <h3 className="font-heading text-[16px] font-extrabold leading-tight text-slate-950 sm:text-[17px]">
                  {days ? c.title : c.prompt}
                </h3>
                <p className="mt-0.5 flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-slate-600">
                  <Wind className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#0284c7]" aria-hidden="true" />
                  <span>{c.valueProp}</span>
                </p>
              </div>
            </div>

            {/* The way in. Label above the chips at every breakpoint so five bare
                digits are never on their own, and flex-wrap so the close button
                drops to its own line rather than pushing a 375px card sideways. */}
            <div className="sm:shrink-0">
              <span className="mb-1.5 block text-[12px] font-bold leading-tight text-cyan-900">
                {days === null ? c.daysQuestion : c.daysUnit(days)}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {dayChips}
                {days !== null && (
                  <button
                    type="button"
                    onClick={clear}
                    aria-label={c.clear}
                    title={c.clear}
                    className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-slate-600 transition-colors duration-200 hover:bg-white/80 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0369a1] focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── Pending: skeleton rows on the same rail, never a half plan ── */}
          {isPlanning && days && (
            <ol
              className="relative mt-4 border-t border-cyan-200/60 pt-3"
              aria-busy="true"
              aria-label={c.title}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-6 left-4 top-6 w-px bg-cyan-200/70"
              />
              {Array.from({ length: Math.min(days, forecast.length) }, (_, index) => (
                <li key={index} className="relative py-2.5 pl-10">
                  <span className="absolute left-[12px] top-[1.05rem] h-2.5 w-2.5 rounded-full bg-slate-300 shadow-[0_0_0_4px_rgba(255,255,255,0.8)]" />
                  <span className="block h-3 w-16 animate-pulse rounded bg-slate-200/90" />
                  <span className="mt-2 block h-4 w-40 animate-pulse rounded bg-slate-300/70 sm:w-56" />
                  <span className="mt-2 block h-3 w-32 animate-pulse rounded bg-slate-200/80 sm:w-44" />
                </li>
              ))}
            </ol>
          )}

          {/* ── The plan: a vertical timeline, one node per day ───────────── */}
          {!isPlanning && days && plan.length > 0 && (
            <ol className="relative mt-4 border-t border-cyan-200/60 pt-3" aria-label={c.title}>
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-8 left-4 top-6 w-px bg-gradient-to-b from-cyan-300/80 via-cyan-200/70 to-cyan-200/0"
              />

              {plan.map((entry, index) => {
                const BlankDayIcon = blankDayIcon(entry);
                return (
                <li
                  key={entry.dayIndex}
                  style={{ transitionDelay: rowsRevealed ? `${index * ROW_STAGGER_MS}ms` : '0ms' }}
                  // Tailwind v4 compiles translate-* to the `translate` property,
                  // not `transform` — naming only `transform` here silently drops
                  // the slide and leaves a bare fade.
                  className={`relative transition-[opacity,translate,transform] duration-300 ease-out motion-reduce:transition-none ${
                    rowsRevealed ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
                  }`}
                >
                  {/* The node sits OUTSIDE the row surface, so neither the hover
                      highlight nor a blank day's panel ever paints over the rail. */}
                  <span
                    aria-hidden="true"
                    className={`absolute left-[12px] top-[1.05rem] h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.8)] ${nodeTone(entry)}`}
                  />

                  <div
                    className={`ml-8 rounded-xl px-2 py-2.5 transition-colors duration-200 motion-reduce:transition-none ${
                      entry.status === 'beach' ? 'hover:bg-white/70' : 'bg-slate-500/[0.045]'
                    }`}
                  >
                    <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] font-bold leading-tight text-slate-600">
                      <span className="capitalize">{dayLabel(entry)}</span>
                      <span className="font-semibold text-slate-500">{dayDate(entry)}</span>
                    </p>

                    {entry.status === 'beach' && entry.pick ? (
                      <>
                        {/* The beach NAME is the hero of the row — biggest, darkest,
                            and the whole width is the tap target. */}
                        <button
                          type="button"
                          onClick={() => onBeachClick(entry.pick!.beach)}
                          aria-label={c.openBeach(entry.pick.beach.name[language])}
                          className="group -mx-1 mt-1 flex min-h-11 w-full cursor-pointer items-center gap-1.5 rounded-lg px-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0369a1] focus-visible:ring-offset-1 focus-visible:ring-offset-white"
                        >
                          <span className="truncate text-[16px] font-extrabold leading-tight text-slate-950 transition-colors duration-200 group-hover:text-[#007a83] motion-reduce:transition-none sm:text-[17px]">
                            {entry.pick.beach.name[language]}
                          </span>
                          <ChevronRight
                            className="h-4 w-4 shrink-0 text-cyan-700 transition-[translate] duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                            aria-hidden="true"
                          />
                        </button>

                        {/* The why-line: the one sentence that justifies the pick. */}
                        <p className="text-[13px] font-semibold leading-snug text-slate-600">
                          {whyLine(entry, entry.pick)}
                        </p>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className={`${BADGE_BASE} bg-white/85 text-slate-700 ring-slate-200/90`}>
                            <Wind className="h-3 w-3 text-[#0284c7]" aria-hidden="true" />
                            {/* This beach's Beaufort — not the region's. */}
                            {entry.pick.windBeaufort} {c.windUnit}
                          </span>

                          {entry.isRefuge && (
                            <span className={`${BADGE_BASE} bg-cyan-100/80 text-cyan-900 ring-cyan-200`}>
                              <Shield className="h-3 w-3" aria-hidden="true" />
                              {c.refugeBadge}
                            </span>
                          )}

                          {/* Caution wording only from 5 Bft up: the project rule
                              is that 3-4 Bft is a light/moderate breeze and never
                              earns it. Below that the why-line already states the
                              wind, which is the honest signal without the alarm. */}
                          {entry.pick.caution && entry.pick.windBeaufort >= 5 && (
                            <span className={`${BADGE_BASE} bg-orange-50 text-orange-800 ring-orange-200`}>
                              <Waves className="h-3 w-3" aria-hidden="true" />
                              {c.cautionBadge}
                            </span>
                          )}

                          {entry.confidence === 'provisional' && (
                            <span className={`${BADGE_BASE} bg-slate-100/90 text-slate-700 ring-slate-200`}>
                              {c.provisional}
                            </span>
                          )}

                          {entry.isRepeat && (
                            <span className="text-[12px] font-semibold text-slate-500">{c.repeat}</span>
                          )}

                          {entry.alternative && (
                            <span className="min-w-0 truncate text-[12px] font-semibold text-slate-500">
                              {c.alternative(entry.alternative.beach.name[language])}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Blank day: the same rhythm as a beach row, deliberately
                            muted. It occupies the hero slot so the eye still finds
                            one answer per day. */}
                        <p className="mt-1 flex min-h-8 items-center gap-1.5 text-[15px] font-bold leading-tight text-slate-700">
                          <BlankDayIcon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                          {c.noBeachTitle}
                        </p>
                        <p className="mt-0.5 text-[13px] font-semibold leading-snug text-slate-600">
                          {entry.reason ? c.reasons[entry.reason] : c.reasons.no_match}
                        </p>
                        {entry.nextBeachDayIndex !== null && (
                          <p className="mt-1 text-[12.5px] font-semibold leading-snug text-cyan-800">
                            {c.seaSettles(weekdayOf(entry.nextBeachDayIndex))}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                </li>
                );
              })}
            </ol>
          )}

          {!isPlanning && days && plan.length > 0 && (
            <p className="mt-2 border-t border-cyan-200/50 pt-2.5 text-[12px] font-medium leading-relaxed text-slate-500">
              {/* The caution caveat leads: it is the one that affects safety. */}
              {hasCaution && <span className="font-semibold text-orange-800">{c.cautionNote} </span>}
              {hasRefuge && <span>{c.refugeNote} </span>}
              {hasProvisional && <span>{c.provisionalNote} </span>}
              {/* Honesty over pretended stability: the plan follows the forecast. */}
              {c.planUpdatesDaily}
              {beyond > 0 && ` ${c.beyondHorizon(beyond)}`}
            </p>
          )}
        </div>
      </div>
    </section>
  );
};

export default TripPlanner;
