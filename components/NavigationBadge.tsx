import React from 'react';
import type { Beach, LanguageCode } from '../types';
import { getNavigationBadge } from '../utils/navigation';
import { translations } from '../translations';

/**
 * Small presentation badge shown next to a navigation button. It reads the badge reason from
 * getNavigationBadge (the SAME getNavigationAction the URL is built from — never recomputed) and
 * maps it to a localized label. Renders nothing for full-directions / no-action beaches.
 *
 * Phase B (presentation only): the boat-only safety rule, the blocked/unverified handling and the
 * URLs already shipped in Phase A; this just surfaces the reason to the user.
 */
const BADGE_KEY: Record<NonNullable<ReturnType<typeof getNavigationBadge>>, keyof typeof translations['en']['navigationBadge']> = {
  'boat-access': 'boatAccess',
  'nav-unavailable': 'unavailable',
  'nav-unverified': 'unverified',
};

export const NavigationBadge: React.FC<{ beach: Pick<Beach, 'id' | 'name' | 'coordinates' | 'mapCoordinates' | 'location' | 'aliases' | 'metadata' | 'accessibility'>; language: LanguageCode; className?: string }> = ({ beach, language, className }) => {
  const badge = getNavigationBadge(beach);
  if (!badge) return null;

  const label = translations[language]?.navigationBadge?.[BADGE_KEY[badge]]
    ?? translations.en.navigationBadge[BADGE_KEY[badge]];

  return (
    <span
      className={
        'inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium leading-tight text-slate-600 ' +
        (className ?? '')
      }
      title={label}
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
      <span className="truncate">{label}</span>
    </span>
  );
};
