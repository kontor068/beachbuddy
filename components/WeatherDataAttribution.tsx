import React from 'react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';

// Compact, reusable credit line for weather/marine forecast data — satisfies Open-Meteo's
// CC BY 4.0 requirement to link "next to any location Open-Meteo data are displayed"
// (open-meteo.com/en/licence) plus the marine model's own Météo-France (Etalab Licence
// Ouverte 2.0) source-mention requirement. See the batch-7 commit message for the full
// research trail. Deliberately compact — full licence/source details live in the Terms
// document, not repeated here; this is the "next to the data" pointer, not the full text.
//
// Where this is used:
//   - components/LegalFooter.tsx: once, site-wide (covers home, region/results, map, planner
//     — all of which share App.tsx's main render tree that reaches the footer).
//   - pages/BeachDetailPage.tsx: once, within the conditions section — the ONE surface that
//     structurally bypasses the footer (App.tsx returns early for view === 'detail', before
//     ever reaching <LegalFooter />, confirmed by reading the render tree, not assumed).
// Deliberately NOT added inside the map's own legend/controls: the map always renders on
// the same page as the footer in this app (never a separate full-screen route), so a
// second copy there would be pure repetition without covering any surface the footer
// doesn't already reach — and risks crowding the map's own controls.

interface WeatherDataAttributionProps {
  language: LanguageCode;
  className?: string;
}

const copy = {
  en: { weatherBy: 'Weather data by', marineModel: 'Marine model' },
  gr: { weatherBy: 'Δεδομένα καιρού από την', marineModel: 'Θαλάσσιο μοντέλο' },
  de: { weatherBy: 'Wetterdaten von', marineModel: 'Wellenmodell' },
  fr: { weatherBy: 'Données météo par', marineModel: 'Modèle de houle' },
  it: { weatherBy: 'Dati meteo di', marineModel: 'Modello marino' },
};

const linkClass =
  'font-semibold text-slate-600 underline-offset-4 transition-colors hover:text-teal-700 hover:underline ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 rounded';

/**
 * `Weather data by Open-Meteo · Marine model: Météo-France MFWAM`
 * Both provider names link out (external, new tab); text stays proper-noun-only across
 * languages (translating "Open-Meteo" or "Météo-France" would be incorrect — see batch-7
 * research). Visually secondary (text-xs, muted) by design — this is attribution, not a
 * promotional badge.
 */
export const WeatherDataAttribution: React.FC<WeatherDataAttributionProps> = ({ language, className }) => {
  const c = getLocalizedCopy(language, copy);
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 ${className ?? ''}`}>
      <span>{c.weatherBy}</span>
      <a
        href="https://open-meteo.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Open-Meteo
      </a>
      <span className="text-slate-300" aria-hidden="true">·</span>
      <span>{c.marineModel}:</span>
      <a
        href="https://meteofrance.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Météo-France MFWAM
      </a>
    </p>
  );
};
