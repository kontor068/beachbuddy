import React from 'react';
import { Sunrise, Umbrella, Sunset, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';

/**
 * Day-plan sequencer (Tier-2, 3-stop). Chains a beach day by the wind clock — morning swim here
 * (mornings are calmest before the meltemi builds) → midday shade + food → a west-facing cove
 * that's calm at dusk for a sunset swim. Google's planner is partner-gated to flights/hotels and
 * never sequences coves by today's per-cove conditions. Each stop is either "here" or a nearby
 * cove that genuinely fits that slot today; renders only with at least two meaningful stops.
 */

export type DayPlanSlot = 'morning' | 'midday' | 'sunset';

export interface DayPlanStop {
  slot: DayPlanSlot;
  beachName: string;
  isHere: boolean;
  distanceKm?: number;
  onOpen?: () => void;
}

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Plan your day', gr: 'Σχέδιο ημέρας', de: 'Plane deinen Tag', it: 'Pianifica la giornata', fr: 'Planifiez la journée',
};

const SLOT_LABEL: Record<DayPlanSlot, Copy> = {
  morning: { en: 'Morning swim', gr: 'Πρωινό μπάνιο', de: 'Morgenbad', it: 'Bagno mattutino', fr: 'Baignade du matin' },
  midday: { en: 'Midday shade & food', gr: 'Μεσημέρι: σκιά & φαγητό', de: 'Mittags Schatten & Essen', it: 'Mezzogiorno: ombra e cibo', fr: 'Midi : ombre et repas' },
  sunset: { en: 'Sunset swim', gr: 'Μπάνιο στο ηλιοβασίλεμα', de: 'Sonnenuntergang-Bad', it: 'Bagno al tramonto', fr: 'Baignade au coucher' },
};

const HERE: Copy = { en: 'here', gr: 'εδώ', de: 'hier', it: 'qui', fr: 'ici' };
const AWAY: Copy = { en: 'away', gr: 'μακριά', de: 'entfernt', it: 'di distanza', fr: 'de distance' };

const SLOT_ICON: Record<DayPlanSlot, React.ComponentType<{ className?: string }>> = {
  morning: Sunrise,
  midday: Umbrella,
  sunset: Sunset,
};

const SLOT_TONE: Record<DayPlanSlot, string> = {
  morning: 'bg-sky-500',
  midday: 'bg-teal-500',
  sunset: 'bg-amber-500',
};

interface DayPlanSectionProps {
  language: LanguageCode;
  stops: DayPlanStop[];
}

export const DayPlanSection: React.FC<DayPlanSectionProps> = ({ language, stops }) => {
  if (stops.length < 2) return null;

  return (
    <section className="space-y-3" data-nosnippet="true">
      <h3 className="px-1 font-heading text-lg font-bold text-slate-950">{pick(TITLE, language)}</h3>
      <ol className="space-y-2">
        {stops.map(stop => {
          const Icon = SLOT_ICON[stop.slot];
          const interactive = !stop.isHere && Boolean(stop.onOpen);
          const Wrapper: any = interactive ? 'button' : 'div';
          return (
            <li key={stop.slot}>
              <Wrapper
                {...(interactive ? { type: 'button', onClick: stop.onOpen } : {})}
                className={`flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white/70 px-3 py-2.5 text-left ${interactive ? 'transition-colors hover:bg-slate-50' : ''}`}
              >
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-white ${SLOT_TONE[stop.slot]}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{pick(SLOT_LABEL[stop.slot], language)}</p>
                  <p className="truncate text-sm font-bold text-slate-800">
                    {stop.beachName}
                    {stop.isHere
                      ? <span className="ml-1 font-semibold text-slate-500">· {pick(HERE, language)}</span>
                      : typeof stop.distanceKm === 'number'
                        ? <span className="ml-1 font-semibold text-slate-500">· {stop.distanceKm.toFixed(1)} km {pick(AWAY, language)}</span>
                        : null}
                  </p>
                </div>
                {interactive && <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />}
              </Wrapper>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
