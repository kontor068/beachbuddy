import React from 'react';
import { Sunset, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';

/**
 * Day-plan sequencer — sunset leg (Tier-2). Chaining a day by the wind clock is something
 * Google's planner (partner-gated to flights/hotels) never does and a one-shot answer can't.
 * When the beach you're viewing isn't itself a west-facing cove that's calm at dusk, this
 * pairs it with the nearest one that IS — "swim here now, close the day with a sunset swim
 * over there" — joining per-cove orientation (only from our coastline normal) with today's
 * shelter. Shown only when such a sunset cove actually exists nearby.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Close the day with a sunset swim',
  gr: 'Κλείσε τη μέρα με μπάνιο στο ηλιοβασίλεμα',
  de: 'Lass den Tag mit einem Sonnenuntergang-Bad ausklingen',
  it: 'Chiudi la giornata con un bagno al tramonto',
  fr: 'Terminez la journée par une baignade au coucher',
};

const body = (targetName: string, km: string, language: LanguageCode): string => ({
  en: `The calmest west-facing cove nearby for a sunset swim is ${targetName} (${km} km).`,
  gr: `Η πιο ήρεμη δυτική παραλία κοντά για μπάνιο στο ηλιοβασίλεμα είναι η ${targetName} (${km} km).`,
  de: `Die ruhigste nach Westen gerichtete Bucht in der Nähe für ein Sonnenuntergang-Bad ist ${targetName} (${km} km).`,
  it: `La cala esposta a ovest più calma qui vicino per un bagno al tramonto è ${targetName} (${km} km).`,
  fr: `La crique orientée ouest la plus calme à proximité pour une baignade au coucher est ${targetName} (${km} km).`,
}[language]);

const CTA: Copy = {
  en: 'See it', gr: 'Δες την', de: 'Ansehen', it: 'Vedi', fr: 'Voir',
};

interface DayPlanSunsetCardProps {
  language: LanguageCode;
  targetName: string;
  distanceKm: number;
  onOpen: () => void;
}

export const DayPlanSunsetCard: React.FC<DayPlanSunsetCardProps> = ({
  language,
  targetName,
  distanceKm,
  onOpen,
}) => (
  <button
    type="button"
    onClick={onOpen}
    className="flex w-full items-center gap-3 rounded-[1.5rem] border border-amber-200 bg-gradient-to-r from-amber-50/80 to-orange-50/60 px-4 py-3.5 text-left shadow-sm shadow-amber-900/5 transition-colors hover:from-amber-50 hover:to-orange-50"
  >
    <div className="shrink-0 rounded-2xl bg-amber-500 p-2.5 text-white shadow-sm">
      <Sunset className="h-5 w-5" aria-hidden />
    </div>
    <div className="min-w-0 flex-1 space-y-0.5">
      <h3 className="font-bold text-amber-950">{pick(TITLE, language)}</h3>
      <p className="text-sm font-medium leading-relaxed text-amber-900">
        {body(targetName, distanceKm.toFixed(1), language)}
      </p>
    </div>
    <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-amber-700">
      {pick(CTA, language)}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </span>
  </button>
);
