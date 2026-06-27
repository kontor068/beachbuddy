import React from 'react';
import { Accessibility, ChevronRight } from 'lucide-react';
import { LanguageCode } from '../types';

/**
 * Accessible + calm + reachable TODAY (Tier-2). For wheelchair / limited-mobility visitors,
 * "has a ramp somewhere" isn't enough — you need a verified-accessible beach that is ALSO
 * sheltered from today's wind. This joins two layers that are each individually outside
 * Google's reach: the Seatrac wild-beach accessibility ground truth (which falls through
 * Maps' business schema) and the live per-cove shelter assessment. It surfaces on accessible
 * beaches and lists nearby beaches that clear BOTH gates today, nearest first.
 */

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

export interface AccessibleCalmCove {
  id: number;
  name: string;
  distanceKm: number;
}

const TITLE: Copy = {
  en: 'Accessible & sheltered today nearby',
  gr: 'Προσβάσιμες & υπήνεμες σήμερα κοντά',
  de: 'Barrierefrei & heute windgeschützt in der Nähe',
  it: 'Accessibili e riparate oggi vicino',
  fr: 'Accessibles et abritées aujourd’hui à proximité',
};

const INTRO: Copy = {
  en: 'Verified-accessible beaches that are also sheltered from today’s wind.',
  gr: 'Παραλίες με επιβεβαιωμένη πρόσβαση ΑμεΑ που είναι και προστατευμένες από τον σημερινό άνεμο.',
  de: 'Barrierefrei bestätigte Strände, die heute auch windgeschützt sind.',
  it: 'Spiagge con accesso verificato che oggi sono anche riparate dal vento.',
  fr: 'Plages à accès vérifié qui sont aussi abritées du vent aujourd’hui.',
};

const AWAY: Copy = {
  en: 'away', gr: 'μακριά', de: 'entfernt', it: 'di distanza', fr: 'de distance',
};

interface AccessibleCalmNearbySectionProps {
  language: LanguageCode;
  items: AccessibleCalmCove[];
  onSelect: (id: number) => void;
}

export const AccessibleCalmNearbySection: React.FC<AccessibleCalmNearbySectionProps> = ({
  language,
  items,
  onSelect,
}) => {
  if (items.length === 0) return null;

  return (
    <section className="space-y-2" data-nosnippet="true">
      <h3 className="flex items-center gap-2 px-1 font-heading text-base font-bold text-slate-950">
        <Accessibility className="h-5 w-5 flex-shrink-0 text-sky-700" aria-hidden="true" />
        {pick(TITLE, language)}
      </h3>
      <p className="px-1 text-xs font-medium leading-relaxed text-slate-600">{pick(INTRO, language)}</p>
      <ul className="space-y-1.5">
        {items.map(cove => (
          <li key={cove.id}>
            <button
              type="button"
              onClick={() => onSelect(cove.id)}
              className="flex w-full items-center gap-2 rounded-xl border border-sky-100 bg-sky-50/50 px-3 py-2 text-left transition-colors hover:bg-sky-50"
            >
              <Accessibility className="h-4 w-4 flex-shrink-0 text-sky-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{cove.name}</span>
              <span className="flex-shrink-0 text-xs font-bold text-slate-500">
                {cove.distanceKm.toFixed(1)} km {pick(AWAY, language)}
              </span>
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-sky-600" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
