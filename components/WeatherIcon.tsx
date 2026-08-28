import React from 'react';

// Weather glyphs, drawn locally — and, since 28/08/2026, alive.
//
// These used to be <img src="https://openweathermap.org/img/wn/{code}@2x.png">, in four
// places. That was wrong on three separate counts and all three are fixed by drawing the
// icon ourselves:
//   1. Speed — a tourist on island 4G paid a DNS lookup plus a TLS handshake to a domain
//      we never otherwise touch, before the first glyph appeared, and the mobile day strip
//      renders five of them. The glyphs are inline SVG, so this costs no bytes.
//   2. Correctness — we are an Open-Meteo shop. Borrowing OpenWeatherMap's artwork meant a
//      provider we do not use could break our UI silently by moving or blocking the files.
//   3. Privacy — every visitor's IP was handed to a third party with no consent step.
//
// The geometry is Lucide's (ISC), the same set the rest of the UI draws with, kept
// path-for-path so nothing about the look changed. What changed is that the parts are now
// SEPARATE elements inside one <svg> instead of one flat icon: the sun's rays are a <g> that
// can turn, the cloud is a path that can drift, the drops are strokes that can fall. Lucide
// renders its icons flat, which is why this could not stay a <Sun /> import — you cannot
// rotate half of somebody else's icon.
//
// Motion follows the house signature set in index.css (§ "Animated weather glyphs"): slow,
// small, transform/opacity only, and silenced under prefers-reduced-motion by the shared
// guard. The amplitudes are in viewBox units, so at the 16px the day strip renders them at,
// a "0.5px" drift is a third of a screen pixel — it reads as breathing, not as fidgeting.
// Nothing here is a claim: the drops fall because it is raining, not to say how hard.
//
// `services/weatherService.ts` maps WMO codes to OpenWeather-style ids ('01d', '10n', …)
// for UI compatibility, so that string stays the contract here. It currently emits
// 01/02/03/09/10/11/50; 04 and 13 are mapped anyway so a future mapping change cannot
// silently fall through to a wrong glyph.

/** Lucide's eight sun rays, unchanged. Grouped so they turn together around 12,12. */
const SUN_RAYS = [
  'M12 2v2',
  'M12 20v2',
  'm4.93 4.93 1.41 1.41',
  'm17.66 17.66 1.41 1.41',
  'M2 12h2',
  'M20 12h2',
  'm6.34 17.66-1.41 1.41',
  'm19.07 4.93-1.41 1.41',
];

/** The four rays Lucide leaves visible when a cloud covers the rest of the sun. */
const PARTIAL_SUN_RAYS = ['M12 2v2', 'm4.93 4.93 1.41 1.41', 'M20 12h2', 'm19.07 4.93-1.41 1.41'];

const SUN_ARC = 'M15.947 12.65a4 4 0 0 0-5.925-4.128';
const MOON =
  'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401';
const MOON_SMALL =
  'M18.376 14.512a6 6 0 0 0 3.461-4.127c.148-.625-.659-.97-1.248-.714a4 4 0 0 1-5.259-5.26c.255-.589-.09-1.395-.716-1.248a6 6 0 0 0-4.594 5.36';
const CLOUD = 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z';
/** The open-bottomed cloud Lucide uses whenever something falls out of it. */
const CLOUD_OPEN = 'M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242';
const SMALL_CLOUD = 'M13 22H7a5 5 0 1 1 4.9-6H13a3 3 0 0 1 0 6Z';
const SMALL_CLOUD_OPEN = 'M3 20a5 5 0 1 1 8.9-4H13a3 3 0 0 1 2 5.24';

/**
 * A falling mark — raindrop, drizzle stroke or snow dot. The stagger is what turns six
 * static ticks into weather: each one is the same fall, started at a different moment, so
 * the eye reads a stream instead of a blink.
 */
const Falling: React.FC<{ d: string; delay: number; snow?: boolean }> = ({ d, delay, snow }) => (
  <path d={d} className={snow ? 'cb-wx-flake' : 'cb-wx-drop'} style={{ animationDelay: `${delay}s` }} />
);

const RaysSpinning: React.FC = () => (
  <g className="cb-wx-spin">
    {SUN_RAYS.map((d) => (
      <path key={d} d={d} />
    ))}
  </g>
);

/**
 * The half-hidden sun rocks instead of turning. A full turn would sweep a ray down into the
 * cloud and out the other side — the four rays drawn here are exactly the ones a cloud does
 * NOT cover, so rotating them past that point draws light coming through solid cloud.
 */
const RaysSwaying: React.FC = () => (
  <g className="cb-wx-sway">
    {PARTIAL_SUN_RAYS.map((d) => (
      <path key={d} d={d} />
    ))}
  </g>
);

const GLYPHS: Record<string, { className: string; parts: React.ReactNode }> = {
  '01d': {
    className: 'text-amber-500',
    parts: (
      <>
        <circle cx="12" cy="12" r="4" className="cb-wx-breathe" />
        <RaysSpinning />
      </>
    ),
  },
  '01n': {
    className: 'text-indigo-400',
    parts: <path d={MOON} className="cb-wx-glow" />,
  },
  '02d': {
    className: 'text-amber-500',
    parts: (
      <>
        <RaysSwaying />
        <path d={SUN_ARC} />
        <path d={SMALL_CLOUD} className="cb-wx-drift" />
      </>
    ),
  },
  '02n': {
    className: 'text-indigo-400',
    parts: (
      <>
        <path d={MOON_SMALL} className="cb-wx-glow" />
        <path d="M13 16a3 3 0 0 1 0 6H7a5 5 0 1 1 4.9-6z" className="cb-wx-drift" />
      </>
    ),
  },
  '03d': { className: 'text-slate-400', parts: <path d={CLOUD} className="cb-wx-drift" /> },
  '03n': { className: 'text-slate-400', parts: <path d={CLOUD} className="cb-wx-drift" /> },
  '04d': {
    className: 'text-slate-500',
    parts: (
      <>
        {/* Two clouds at different speeds and opposite phase: the parallax is the whole
            point of the overcast glyph, otherwise it is just a fatter cloud. */}
        <path d="M21.832 9A3 3 0 0 0 19 7h-2.207a5.5 5.5 0 0 0-10.72.61" className="cb-wx-drift-slow" />
        <path d="M17.5 12a1 1 0 1 1 0 9H9.006a7 7 0 1 1 6.702-9z" className="cb-wx-drift" />
      </>
    ),
  },
  '09d': {
    className: 'text-sky-500',
    parts: (
      <>
        <path d={CLOUD_OPEN} className="cb-wx-drift" />
        <Falling d="M8 14v1" delay={0} />
        <Falling d="M12 16v1" delay={0.2} />
        <Falling d="M16 14v1" delay={0.45} />
        <Falling d="M8 19v1" delay={0.75} />
        <Falling d="M12 21v1" delay={0.95} />
        <Falling d="M16 19v1" delay={1.2} />
      </>
    ),
  },
  '10d': {
    className: 'text-sky-500',
    parts: (
      <>
        <RaysSwaying />
        <path d={SUN_ARC} />
        <path d={SMALL_CLOUD_OPEN} className="cb-wx-drift" />
        <Falling d="M7 19v2" delay={0} />
        <Falling d="M11 20v2" delay={0.55} />
      </>
    ),
  },
  '10n': {
    className: 'text-sky-500',
    parts: (
      <>
        <path d={MOON_SMALL} className="cb-wx-glow" />
        <path d={SMALL_CLOUD_OPEN} className="cb-wx-drift" />
        <Falling d="M7 19v2" delay={0} />
        <Falling d="M11 20v2" delay={0.55} />
      </>
    ),
  },
  '11d': {
    className: 'text-violet-500',
    parts: (
      <>
        <path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" className="cb-wx-drift" />
        {/* One double-strike every four and a half seconds. A bolt that blinks on a short
            loop stops reading as lightning and starts reading as a broken icon. */}
        <path d="m13 12-3 5h4l-3 5" className="cb-wx-bolt" />
      </>
    ),
  },
  '13d': {
    className: 'text-sky-300',
    parts: (
      <>
        <path d={CLOUD_OPEN} className="cb-wx-drift" />
        <Falling d="M8 15h.01" delay={0} snow />
        <Falling d="M12 17h.01" delay={0.5} snow />
        <Falling d="M16 15h.01" delay={1} snow />
        <Falling d="M8 19h.01" delay={1.5} snow />
        <Falling d="M12 21h.01" delay={2} snow />
        <Falling d="M16 19h.01" delay={2.5} snow />
      </>
    ),
  },
  '50d': {
    className: 'text-slate-400',
    parts: (
      <>
        <path d={CLOUD_OPEN} className="cb-wx-drift" />
        <path d="M16 17H7" className="cb-wx-fog" />
        <path d="M17 21H9" className="cb-wx-fog" style={{ animationDelay: '-3.2s' }} />
      </>
    ),
  },
};

// Night reuses the day drawing wherever Lucide itself does — rain that falls at night looks
// the same as rain that falls by day; only the sun/moon differ.
GLYPHS['09n'] = GLYPHS['09d'];
GLYPHS['11n'] = GLYPHS['11d'];
GLYPHS['13n'] = GLYPHS['13d'];
GLYPHS['50n'] = GLYPHS['50d'];

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
  const glyph = (code && GLYPHS[code]) || FALLBACK;
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${glyph.className} ${className ?? ''}`}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {glyph.parts}
    </svg>
  );
};
