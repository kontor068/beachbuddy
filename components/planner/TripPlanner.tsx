import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarRange,
  ChevronRight,
  Clock3,
  CloudLightning,
  CloudRain,
  Compass,
  Shield,
  Waves,
  Wind,
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
// PLACEMENT: a single self-contained card directly above today's picks. Not the
// top of the page (most visitors only want today, and 88% are on a phone), and
// not a separate tab (at ~1.6 pages per visit, nothing behind a tab gets found).
//
// ANSWER, DON'T ASK (2026-07-28). MEASURED: in 28 days of GA4, `trip_planned`
// fired for 3 users out of ~280 — 1% — while `forecast_day_selected` reached 31.
// So the multi-day APPETITE is real and it was the PACKAGING that failed: the
// card asked "how many days?" and showed nothing until a chip was tapped, i.e.
// it was a form standing between the visitor and the beaches they came for.
// Every other surface on this site hands over an answer for free.
//
// So the card now PLANS THE NEXT 3 DAYS BY ITSELF and shows them. The chips
// survive as a secondary "staying longer?" row UNDER the plan, for the minority
// who want 4-6 days. Nothing is hidden behind a tap any more.
//
// COST: planning scores up to 72 beaches per day, so an auto-plan must not land
// in the page's first paint. Two things bound it, and both are load-bearing:
//   1. it starts only when the card is about to ENTER THE VIEWPORT (observer
//      below), never on mount — a visitor who never scrolls there pays nothing;
//   2. the default is 3 days, HALF the 6-day worst case the chips could reach.
// The value is then deferred so the reveal paints skeleton rows first;
// useDeferredValue does not move work off the main thread, it only keeps the
// frame responsive — the pool cap is what bounds the cost.
//
// METRICS: `trip_planned` now fires for auto-plans too, so it is an IMPRESSION
// count (the denominator) and no longer evidence of interest. The engagement
// signal is `trip_plan_beach_opened` — the visitor tapping a beach out of the
// plan — plus `trip_planned` with source='chip' for a day-count change. Judge
// the change on those two, never on trip_planned alone.

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
  /** True while the reader has a colour picked on the map legend. Only changes the subtitle —
   *  this plan is about other days and must not narrow with a filter on today's conditions. */
  isFilteredView?: boolean;
  userLocation?: { lat: number; lon: number };
  /** Each beach's own multi-day forecast (see PlanTripInput.beachForecastDaysById). */
  beachForecastDaysById?: Record<number, DailyForecast[]>;
  /**
   * A stay length the visitor STATED in the search box («Νάξο 5 μέρες»).
   * Never a default — absent means the strip opens collapsed, as always.
   */
  initialDays?: number;
  onBeachClick: (beach: Beach) => void;
}

const DAY_OPTIONS = [2, 3, 4, 5, 6];

/**
 * What the card plans when nobody has asked for anything. Three, not six: it is
 * the horizon the forecast can still state plainly (FIRM_FORECAST_DAYS in
 * services/tripPlannerService.ts is also 3), and it halves the scoring cost of
 * a plan the visitor never requested.
 */
const AUTO_DAYS = 3;

/**
 * How early the plan starts computing, in px before the card reaches the
 * viewport. Enough that the scoring pass is usually done by the time the card
 * is actually looked at, small enough that a visitor who stops above it never
 * pays for it.
 */
const PLAN_PREFETCH_MARGIN_PX = 300;

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
  isFilteredView = false,
  userLocation,
  beachForecastDaysById,
  initialDays,
  onBeachClick,
}) => {
  const c = getLocalizedCopy(language, tripPlannerCopy);
  // A day count the visitor ASKED for — a chip tap, or a stay length typed in
  // the search box. `null` means nobody asked and the card plans AUTO_DAYS by
  // itself. Lazy initializer, NOT an effect: an effect would render once at
  // null and then flip, replaying the entrance stagger and planning twice.
  const [chosenDays, setChosenDays] = useState<number | null>(
    () => clampRequestedDays(initialDays, forecast.length)
  );

  // The auto-plan's trigger. It is deliberately NOT "on mount": the card sits
  // below today's conditions, so on a phone it is usually off-screen at first
  // paint, and a 72-beach pass there would compete with the content the visitor
  // actually came for.
  const sectionRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (inView) return;
    const node = sectionRef.current;
    if (!node) return;
    // No IntersectionObserver (old Safari, jsdom): degrade to planning right
    // away rather than showing a card that never fills in. The pool cap keeps
    // that affordable, and it is the rarer path by far.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setInView(true);
      },
      { rootMargin: `${PLAN_PREFETCH_MARGIN_PX}px` }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  // What we actually plan. A stated count always wins over the automatic one.
  const autoDays = Math.min(AUTO_DAYS, forecast.length);
  const days = chosenDays ?? (inView ? autoDays : null);
  const isAutoPlan = chosenDays === null;

  // `null` as the initial deferred value is what keeps the cost contract above
  // intact when `days` arrives pre-set (a typed stay length): on mount
  // `deferredDays` is null, the plan memo short-circuits, the skeleton rows
  // paint, and the 72-beach pass runs in the background render. Without the
  // second argument useDeferredValue does not defer on the first render and the
  // whole scoring pass would land synchronously in the first commit.
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
      beachForecastDaysById,
    });
  }, [beaches, deferredDays, forecast, geospatialProfiles, language, preferences, todayRainBlocked, userLocation, beachForecastDaysById]);

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

  // Where this plan came from. Three genuinely different audiences, and after
  // the auto-plan change they must never be read as one number:
  //   'auto'          — we planned it unasked (an IMPRESSION, not interest)
  //   'search_intent' — they typed a stay length in the search box
  //   'chip'          — they changed the day count under the plan
  const searchIntentRef = useRef(initialDays != null);
  const planSource: 'auto' | 'search_intent' | 'chip' =
    isAutoPlan ? 'auto' : (searchIntentRef.current ? 'search_intent' : 'chip');

  // Fired AFTER the plan computes (not on the raw tap) so the event can carry
  // blank_days — the honest measure of how often the feature answers "no beach
  // day". region_id + beaufort tell us whether the multi-day audience is real
  // on the windy days the feature exists for. The ref stops re-renders (fresh
  // forecast, language switch) from double-counting one choice.
  const trackedDaysRef = useRef<number | null>(null);
  useEffect(() => {
    if (!days || plan.length === 0 || trackedDaysRef.current === days) return;
    trackedDaysRef.current = days;
    trackEvent('trip_planned', undefined, {
      days,
      region_id: regionId,
      beaufort: getBeaufortLevel((forecast[0]?.wind?.speed ?? 0) * 3.6),
      blank_days: plan.filter(entry => entry.status === 'no_beach_day').length,
      source: planSource,
    });
  }, [days, forecast, plan, planSource, regionId]);

  /**
   * THE metric for whether this feature earns its place: a visitor taking a
   * beach OUT of the plan. Since the plan now appears unasked, `trip_planned`
   * counts everyone who scrolled past and proves nothing on its own.
   */
  const openPick = (entry: TripDayPlan, pick: TripPick) => {
    trackEvent('trip_plan_beach_opened', undefined, {
      days: days ?? 0,
      day_index: entry.dayIndex,
      region_id: regionId,
      beach_id: pick.beach.id,
      source: planSource,
      is_refuge: entry.isRefuge,
      caution: pick.caution,
    });
    onBeachClick(pick.beach);
  };

  if (forecast.length === 0 || beaches.length === 0) return null;
  // planTrip can legitimately come back empty — a preference filter (Blue Flag,
  // say) can leave a region with no candidate pool at all. That used to be
  // invisible because nothing ran until someone tapped; now that the plan is
  // automatic, it would show every visitor a header and chips with nothing
  // under them. Say nothing instead.
  if (deferredDays !== null && !isPlanning && plan.length === 0) return null;

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
    // Touching a chip ends the "they typed it" provenance for good.
    searchIntentRef.current = false;
    setChosenDays(value);
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
  // The offshore-drift note. Deliberately not per row: it is one physical fact
  // about the days we sent someone to shelter, and repeating it under three
  // rows would turn a safety line into wallpaper.
  const hasOffshoreDrift = plan.some(entry => entry.pick?.offshoreDrift);

  // The day-count row. It is no longer the way IN — the plan is already on
  // screen — so it reads as an extension ("staying longer?") and sits under the
  // timeline. The active chip tracks what is DISPLAYED, which on an auto-plan
  // is AUTO_DAYS: highlighting nothing there would look like a broken control.
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
      ref={sectionRef}
      className="mx-auto w-full max-w-6xl px-3 sm:px-4"
      aria-label={c.title}
      data-nosnippet="true"
    >
      {/* Refined glass in the app's cyan, not white-on-white: this card sits
          between vivid beach photos and the rest of the page — at bg-white/72
          on a near-white background it was invisible in practice (2026-07-26).
          The gradient + corner glow give it depth without a new hue;
          deliberately NO orange anywhere structural, because orange is this
          app's caution colour and must keep meaning only that. */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-white/92 via-cyan-50/92 to-sky-100/80 px-4 py-4 shadow-sm shadow-sky-900/5 ring-1 ring-white/50 backdrop-blur-xl sm:px-5">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-52 w-52 rounded-full bg-sky-300/25 blur-3xl"
        />

        <div className="relative">
          {/* ── Header: a statement, not a question. The old version asked "how
              many days?" and 99% of visitors never answered it (GA, 28 days).
              The heading now names what is already below it. ─────────────── */}
          <div className="flex min-w-0 items-start gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5e9] to-[#007a83] text-white shadow-sm shadow-cyan-900/25 ring-1 ring-white/40">
              <CalendarRange className="h-5 w-5" aria-hidden="true" />
            </span>

            <div className="min-w-0">
              <h3 className="font-heading text-[16px] font-extrabold leading-tight text-slate-950 sm:text-[17px]">
                {days ? c.nextDaysTitle(days) : c.title}
              </h3>
              <p className="mt-0.5 flex items-start gap-1.5 text-[13px] font-semibold leading-snug text-slate-600">
                <Wind className="mt-[3px] h-3.5 w-3.5 shrink-0 text-[#0284c7]" aria-hidden="true" />
                {/* With a colour picked on the map legend this section deliberately does NOT
                    narrow with it — it plans other days, on those days' weather, so a beach that
                    is difficult today can be the right answer for tomorrow. Left unexplained it
                    reads as the filter having missed one, which is exactly how it was reported.
                    Saying so is enough; hiding the plan would cost more than the confusion. */}
                <span>{isFilteredView ? c.ignoresFilter : c.valueProp}</span>
              </p>
            </div>
          </div>

          {/* ── Pending: skeleton rows on the same rail, never a half plan ── */}
          {(isPlanning || !days) && (
            <ol
              className="relative mt-4 border-t border-cyan-200/60 pt-3"
              aria-busy="true"
              aria-label={c.title}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-6 left-4 top-6 w-px bg-cyan-200/70"
              />
              {/* `days` is null until the card nears the viewport, so the
                  placeholder is sized on what we are ABOUT to plan — same row
                  count, no jump when the real plan replaces it. */}
              {Array.from({ length: Math.min(days ?? autoDays, forecast.length) }, (_, index) => (
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
                          onClick={() => openPick(entry, entry.pick!)}
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

                        {/* WHEN to go, on the days where the hour actually
                            matters. A line rather than a badge: it is a
                            sentence about the day, not a property of the beach,
                            and the badge row below is already four pills wide
                            on a hard day. Rendered only when the service found
                            a real window — see TripPick.bestTimeStart. */}
                        {entry.pick.bestTimeStart && entry.pick.bestTimeEnd && (
                          <p className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold leading-snug text-[#0369a1]">
                            <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {entry.pick.bestTimeTrend === 'eases'
                              ? c.bestTime.eases(entry.pick.bestTimeStart)
                              : c.bestTime.builds(entry.pick.bestTimeStart, entry.pick.bestTimeEnd)}
                          </p>
                        )}

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

          {/* ── Staying longer? The chips, demoted. They used to be the only way
              in and gated the whole feature behind a tap; now they extend a plan
              that is already visible, so they belong AFTER it — the minority who
              want 5 or 6 days will look for them, and everyone else is already
              served. Same 44px targets, same active state. ────────────────── */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-cyan-200/60 pt-3">
            <span className="text-[12px] font-bold leading-tight text-cyan-900">{c.stayingLonger}</span>
            {dayChips}
          </div>

          {!isPlanning && days && plan.length > 0 && (
            <p className="mt-2.5 text-[12px] font-medium leading-relaxed text-slate-500">
              {/* Offshore drift leads every other caveat: it is the only hazard
                  this feature CREATES rather than avoids — we sent someone to
                  flat water that is flat because the wind runs out to sea. */}
              {hasOffshoreDrift && <span className="font-semibold text-orange-800">{c.offshoreDriftNote} </span>}
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
