import React from 'react';
import { LanguageCode } from '../types';
import { getLocalizedCopy } from '../utils/i18n';

// Compact, reusable credit line for weather/marine forecast data — satisfies Open-Meteo's
// CC BY 4.0 requirement to link "next to any location Open-Meteo data are displayed"
// (open-meteo.com/en/licence) plus each marine model's own source-mention requirement:
// DWD (CC BY 4.0, dwd.de legal notice) and Météo-France (Etalab Licence Ouverte 2.0).
// See the batch-7 commit message for the full research trail. Deliberately compact — full
// licence/source details live in the Terms document, not repeated here; this is the
// "next to the data" pointer, not the full text.
//
// ⚠️ 05/08/2026 — DWD ADDED. This line credited Météo-France alone, but `ewam` — which is
// DWD's own European Wave Model — became the PRIMARY per-hour wave source on 31/07/2026
// (netlify/functions/forecast.mjs pins `models=ewam,meteofrance_wave,meteofrance_currents`,
// and utils/marineForecastParsing prefers ewam for every hour it reports a height). So the
// number on the page was usually German while the credit under it was French. Météo-France
// stays because it is genuinely still in use — as the wave fallback and, via
// meteofrance_currents, as the sole source of sea-surface temperature.
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
  en: { weatherBy: 'Weather data by', marineModel: 'Marine models' },
  gr: { weatherBy: 'Δεδομένα καιρού από την', marineModel: 'Θαλάσσια μοντέλα' },
  de: { weatherBy: 'Wetterdaten von', marineModel: 'Wellenmodelle' },
  fr: { weatherBy: 'Données météo par', marineModel: 'Modèles de houle' },
  it: { weatherBy: 'Dati meteo di', marineModel: 'Modelli marini' },
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
        href="https://www.dwd.de/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        DWD EWAM
      </a>
      <span className="text-slate-300" aria-hidden="true">·</span>
      <a
        href="https://meteofrance.com/"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClass}
      >
        Météo-France
      </a>
    </p>
  );
};
