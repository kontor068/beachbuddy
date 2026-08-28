import React from 'react';
import { Baby, Fish, Sunset } from 'lucide-react';
import { LanguageCode } from '../types';

/**
 * Constraint-fit TODAY (Tier-2). Static "family beach" / "good for snorkeling" guides exist for
 * Google to summarise — what it cannot do is intersect a beach's attributes with TODAY's
 * conditions: shallow + calm + shade for a toddler RIGHT NOW, snorkeling only if the water is
 * actually flat enough to see, a sunset swim only on a west-facing cove that's calm at dusk.
 * This readout shows a constraint ONLY when the beach genuinely clears it today, so it's an
 * honest "great today for ___" — never a stale label.
 */

export type ConstraintKey = 'kids' | 'snorkel' | 'sunset';

export interface ConstraintFit {
  key: ConstraintKey;
}

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Good for',
  gr: 'Καλή για',
  de: 'Gut für',
  it: 'Buona per',
  fr: 'Bonne pour',
};

const LABEL: Record<ConstraintKey, Copy> = {
  kids: { en: 'Kids & toddlers', gr: 'Παιδιά & μωρά', de: 'Kinder & Kleinkinder', it: 'Bambini', fr: 'Enfants' },
  snorkel: { en: 'Snorkeling', gr: 'Snorkeling', de: 'Schnorcheln', it: 'Snorkeling', fr: 'Snorkeling' },
  sunset: { en: 'Sunset swim', gr: 'Μπάνιο στο ηλιοβασίλεμα', de: 'Sonnenuntergang-Bad', it: 'Bagno al tramonto', fr: 'Baignade au coucher' },
};

// The static suitability is the LABEL; the only TODAY-specific fact is that the sea is calm,
// so only that carries "σήμερα". Shallow / shade / orientation are permanent and never get it.
const SUB: Copy = {
  en: 'calm water today', gr: 'ήρεμα νερά σήμερα', de: 'heute ruhiges Wasser', it: 'acqua calma oggi', fr: 'eau calme aujourd’hui',
};

const ICON: Record<ConstraintKey, React.ComponentType<{ className?: string }>> = {
  kids: Baby,
  snorkel: Fish,
  sunset: Sunset,
};

const TONE: Record<ConstraintKey, string> = {
  kids: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  snorkel: 'border-cyan-200 bg-cyan-50/60 text-cyan-800',
  sunset: 'border-amber-200 bg-amber-50/70 text-amber-800',
};

interface ConstraintFitSectionProps {
  language: LanguageCode;
  fits: ConstraintFit[];
}

export const ConstraintFitSection: React.FC<ConstraintFitSectionProps> = ({ language, fits }) => {
  if (fits.length === 0) return null;

  return (
    <section className="space-y-2" data-nosnippet="true">
      <h3 className="px-1 text-[11px] font-bold tracking-wide text-slate-500">{pick(TITLE, language)}</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {fits.map(fit => {
          const Icon = ICON[fit.key];
          return (
            <div key={fit.key} className={`flex items-start gap-2 rounded-control border px-3 py-2 ${TONE[fit.key]}`}>
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{pick(LABEL[fit.key], language)}</p>
                <p className="text-[11px] font-medium leading-snug opacity-90">{pick(SUB, language)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
