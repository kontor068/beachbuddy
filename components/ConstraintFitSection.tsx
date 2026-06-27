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
  withShade?: boolean;
}

type Copy = Record<LanguageCode, string>;
const pick = (copy: Copy, language: LanguageCode): string => copy[language] ?? copy.en;

const TITLE: Copy = {
  en: 'Great today for',
  gr: 'Ιδανική σήμερα για',
  de: 'Heute ideal für',
  it: 'Oggi ideale per',
  fr: 'Idéale aujourd’hui pour',
};

const LABEL: Record<ConstraintKey, Copy> = {
  kids: { en: 'Kids & toddlers', gr: 'Παιδιά & μωρά', de: 'Kinder & Kleinkinder', it: 'Bambini', fr: 'Enfants' },
  snorkel: { en: 'Snorkeling', gr: 'Snorkeling', de: 'Schnorcheln', it: 'Snorkeling', fr: 'Snorkeling' },
  sunset: { en: 'Sunset swim', gr: 'Μπάνιο στο ηλιοβασίλεμα', de: 'Sonnenuntergang-Bad', it: 'Bagno al tramonto', fr: 'Baignade au coucher' },
};

const subKids: Copy = {
  en: 'shallow & calm today', gr: 'ρηχά & ήρεμα σήμερα', de: 'flach & ruhig heute', it: 'basso fondale e calmo oggi', fr: 'peu profond et calme aujourd’hui',
};
const subKidsShade: Copy = {
  en: 'shallow, calm & shade today', gr: 'ρηχά, ήρεμα & σκιά σήμερα', de: 'flach, ruhig & Schatten heute', it: 'basso fondale, calmo e ombra oggi', fr: 'peu profond, calme et ombre aujourd’hui',
};
const subSnorkel: Copy = {
  en: 'flat, clear water today', gr: 'ήρεμα, καθαρά νερά σήμερα', de: 'flaches, klares Wasser heute', it: 'acqua piatta e limpida oggi', fr: 'eau plate et claire aujourd’hui',
};
const subSunset: Copy = {
  en: 'west-facing & calm at dusk', gr: 'δυτικός προσανατολισμός & ήρεμα στη δύση', de: 'nach Westen & ruhig zur Dämmerung', it: 'esposta a ovest e calma al tramonto', fr: 'orientée ouest et calme au crépuscule',
};

const ICON: Record<ConstraintKey, React.ComponentType<{ className?: string }>> = {
  kids: Baby,
  snorkel: Fish,
  sunset: Sunset,
};

const TONE: Record<ConstraintKey, string> = {
  kids: 'border-rose-200 bg-rose-50/60 text-rose-800',
  snorkel: 'border-cyan-200 bg-cyan-50/60 text-cyan-800',
  sunset: 'border-amber-200 bg-amber-50/70 text-amber-800',
};

const subFor = (fit: ConstraintFit, language: LanguageCode): string => {
  if (fit.key === 'kids') return pick(fit.withShade ? subKidsShade : subKids, language);
  if (fit.key === 'snorkel') return pick(subSnorkel, language);
  return pick(subSunset, language);
};

interface ConstraintFitSectionProps {
  language: LanguageCode;
  fits: ConstraintFit[];
}

export const ConstraintFitSection: React.FC<ConstraintFitSectionProps> = ({ language, fits }) => {
  if (fits.length === 0) return null;

  return (
    <section className="space-y-2" data-nosnippet="true">
      <h3 className="px-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{pick(TITLE, language)}</h3>
      <div className="grid gap-2 sm:grid-cols-3">
        {fits.map(fit => {
          const Icon = ICON[fit.key];
          return (
            <div key={fit.key} className={`flex items-start gap-2 rounded-2xl border px-3 py-2 ${TONE[fit.key]}`}>
              <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">{pick(LABEL[fit.key], language)}</p>
                <p className="text-[11px] font-medium leading-snug opacity-90">{subFor(fit, language)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
