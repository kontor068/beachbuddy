import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarRange, ChevronRight, Wind, X } from 'lucide-react';
import type { Beach, DailyForecast, LanguageCode, UserPreferences } from '../../types';
import type { GeospatialExposureProfileLookup } from '../../services/geospatialExposureService';
import { getLocalizedCopy, languageToDateLocale } from '../../utils/i18n';
import { getBeaufortLevel } from '../../utils/weatherUtils';
import { trackEvent } from '../../services/analyticsService';
import { planTrip, type TripDayPlan } from '../../services/tripPlannerService';
import { tripPlannerCopy } from './tripPlannerCopy';

// "I'm here for N days — which beach on which day?"
//
// PLACEMENT: a single quiet line directly under today's picks. Not the top of
// the page (most visitors only want today, and 88% are on a phone), and not a
// separate tab (at ~1.6 pages per visit, nothing behind a tab gets found). The
// day-count chips ARE the entry point, so it costs one tap, and the question
// itself explains the feature.
//
// COST: planning scores 40 beaches per day, so it runs ONLY after the visitor
// picks a day count — never on page load.

interface TripPlannerProps {
  beaches: Beach[];
  forecast: DailyForecast[];
  language: LanguageCode;
  /** Region id for analytics only — never used in planning. */
  regionId: string;
  preferences?: UserPreferences;
  geospatialProfiles?: GeospatialExposureProfileLookup;
  onBeachClick: (beach: Beach) => void;
}

const DAY_OPTIONS = [2, 3, 4, 5, 6];

export const TripPlanner: React.FC<TripPlannerProps> = ({
  beaches,
  forecast,
  language,
  regionId,
  preferences,
  geospatialProfiles,
  onBeachClick,
}) => {
  const c = getLocalizedCopy(language, tripPlannerCopy);
  const [days, setDays] = useState<number | null>(null);

  const plan = useMemo(() => {
    if (!days) return [];
    return planTrip({ beaches, forecast, days, language, preferences, geospatialProfiles });
  }, [beaches, days, forecast, geospatialProfiles, language, preferences]);

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
    });
  }, [days, forecast, plan, regionId]);

  if (forecast.length === 0 || beaches.length === 0) return null;

  const dayLabel = (plan_: TripDayPlan) => {
    if (plan_.dayIndex === 0) return c.today;
    if (plan_.dayIndex === 1) return c.tomorrow;
    return new Intl.DateTimeFormat(languageToDateLocale(language), { weekday: 'long' }).format(new Date(plan_.date));
  };
  const weekdayOf = (dayIndex: number) =>
    new Intl.DateTimeFormat(languageToDateLocale(language), { weekday: 'long' })
      .format(new Date(forecast[dayIndex].date));

  const choose = (value: number) => {
    setDays(value);
  };

  const clear = () => {
    // Re-picking after an explicit close is a new intent — let it count again.
    trackedDaysRef.current = null;
    setDays(null);
  };

  const beyond = days ? Math.max(0, days - forecast.length) : 0;
  const hasProvisional = plan.some(entry => entry.confidence === 'provisional');
  const hasCaution = plan.some(entry => entry.pick?.caution);

  return (
    <section
      className="mx-auto w-full max-w-6xl px-3 sm:px-4"
      aria-label={c.prompt}
      data-nosnippet="true"
    >
      <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-3.5 shadow-sm shadow-sky-900/5 ring-1 ring-white/45 backdrop-blur-xl sm:px-5 sm:py-4">
        {/* Entry: the question and the day chips are the same control. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="inline-flex items-center gap-2 text-sm font-bold text-slate-800">
            <CalendarRange className="h-4 w-4 shrink-0 text-[#007a83]" aria-hidden="true" />
            {days ? c.title : c.prompt}
          </span>

          {!days && DAY_OPTIONS.map(value => (
            <button
              key={value}
              type="button"
              onClick={() => choose(value)}
              className="inline-flex min-h-9 min-w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[13px] font-bold text-slate-700 transition-colors hover:border-cyan-300 hover:bg-cyan-50 hover:text-[#007a83] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
            >
              {value}
            </button>
          ))}

          {days && (
            <button
              type="button"
              onClick={clear}
              className="ml-auto inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[13px] font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              {c.clear}
            </button>
          )}
        </div>

        {days && (
          <ol className="mt-3 divide-y divide-slate-200/70 border-t border-slate-200/70">
            {plan.map(entry => {
              const beaufort = getBeaufortLevel((forecast[entry.dayIndex]?.wind?.speed ?? 0) * 3.6);

              return (
                <li key={entry.dayIndex} className="flex items-start gap-3 py-2.5">
                  <span className="w-[4.5rem] shrink-0 pt-0.5 text-[13px] font-bold capitalize text-slate-500 sm:w-24">
                    {dayLabel(entry)}
                  </span>

                  <div className="min-w-0 flex-1">
                    {entry.status === 'beach' && entry.pick ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onBeachClick(entry.pick!.beach)}
                          className="group inline-flex max-w-full cursor-pointer items-center gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700 rounded"
                        >
                          <span className="truncate text-[15px] font-extrabold leading-tight text-slate-950 group-hover:text-[#007a83]">
                            {entry.pick.beach.name[language]}
                          </span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </button>

                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold text-slate-500">
                          <span className="inline-flex items-center gap-1">
                            <Wind className="h-3 w-3" aria-hidden="true" />
                            {beaufort} {c.windUnit}
                          </span>
                          {entry.pick.caution && (
                            <span className="rounded-full bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-100">
                              {c.cautionBadge}
                            </span>
                          )}
                          {entry.isRepeat && <span className="text-slate-400">· {c.repeat}</span>}
                          {entry.confidence === 'provisional' && (
                            <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100">
                              {c.provisional}
                            </span>
                          )}
                          {entry.alternative && (
                            <span className="truncate text-slate-400">
                              {c.alternative(entry.alternative.beach.name[language])}
                            </span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-[13px] font-semibold leading-snug text-slate-600">
                        {entry.reason ? c.reasons[entry.reason] : c.reasons.no_match}
                        {entry.nextBeachDayIndex !== null && (
                          <span className="text-slate-400"> {c.seaSettles(weekdayOf(entry.nextBeachDayIndex))}</span>
                        )}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {days && (hasCaution || hasProvisional || beyond > 0) && (
          <p className="mt-2.5 text-[11px] font-medium leading-snug text-slate-400">
            {/* The caution caveat leads: it is the one that affects safety. */}
            {hasCaution && <span className="text-orange-700/80">{c.cautionNote} </span>}
            {hasProvisional && c.provisionalNote}
            {beyond > 0 && ` ${c.beyondHorizon(beyond)}`}
          </p>
        )}
      </div>
    </section>
  );
};

export default TripPlanner;
