import React from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudMoonRain,
  CloudSnow,
  CloudSun,
  CloudSunRain,
  Cloudy,
  Moon,
  Sun,
} from 'lucide-react';

// Weather glyphs, drawn locally.
//
// These used to be <img src="https://openweathermap.org/img/wn/{code}@2x.png">, in four
// places. That was wrong on three separate counts and all three are fixed by drawing the
// icon ourselves:
//   1. Speed — a tourist on island 4G paid a DNS lookup plus a TLS handshake to a domain
//      we never otherwise touch, before the first glyph appeared, and the mobile day strip
//      renders five of them. lucide-react is already in the bundle, so this costs no bytes.
//   2. Correctness — we are an Open-Meteo shop. Borrowing OpenWeatherMap's artwork meant a
//      provider we do not use could break our UI silently by moving or blocking the files.
//   3. Privacy — every visitor's IP was handed to a third party with no consent step.
//
// `services/weatherService.ts` maps WMO codes to OpenWeather-style ids ('01d', '10n', …)
// for UI compatibility, so that string stays the contract here. It currently emits
// 01/02/03/09/10/11/50; 04 and 13 are mapped anyway so a future mapping change cannot
// silently fall through to a wrong glyph.
const GLYPHS: Record<string, { Icon: typeof Sun; className: string }> = {
  '01d': { Icon: Sun, className: 'text-amber-500' },
  '01n': { Icon: Moon, className: 'text-indigo-400' },
  '02d': { Icon: CloudSun, className: 'text-amber-500' },
  '02n': { Icon: CloudMoon, className: 'text-indigo-400' },
  '03d': { Icon: Cloud, className: 'text-slate-400' },
  '03n': { Icon: Cloud, className: 'text-slate-400' },
  '04d': { Icon: Cloudy, className: 'text-slate-500' },
  '04n': { Icon: Cloudy, className: 'text-slate-500' },
  '09d': { Icon: CloudDrizzle, className: 'text-sky-500' },
  '09n': { Icon: CloudDrizzle, className: 'text-sky-500' },
  '10d': { Icon: CloudSunRain, className: 'text-sky-500' },
  '10n': { Icon: CloudMoonRain, className: 'text-sky-500' },
  '11d': { Icon: CloudLightning, className: 'text-violet-500' },
  '11n': { Icon: CloudLightning, className: 'text-violet-500' },
  '13d': { Icon: CloudSnow, className: 'text-sky-300' },
  '13n': { Icon: CloudSnow, className: 'text-sky-300' },
  '50d': { Icon: CloudFog, className: 'text-slate-400' },
  '50n': { Icon: CloudFog, className: 'text-slate-400' },
};

// Overcast is the safe default: an unknown code means we could not read the sky, and
// "cloudy" is the claim that misleads least. Mirrors weatherService's own fallback ('03').
const FALLBACK = GLYPHS['03d'];

interface WeatherIconProps {
  /** OpenWeather-style code from `forecast.weather.icon` — e.g. '01d', '10n'. */
  code: string | undefined;
  /**
   * Accessible name. Omit inside a button that already carries an aria-label describing
   * the weather (every day-tab does) — the glyph is then decorative and stays silent,
   * which is what the old alt text effectively was anyway.
   */
  label?: string;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({ code, label, className }) => {
  const { Icon, className: toneClass } = (code && GLYPHS[code]) || FALLBACK;
  return (
    <Icon
      className={`${toneClass} ${className ?? ''}`}
      strokeWidth={2.25}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    />
  );
};
