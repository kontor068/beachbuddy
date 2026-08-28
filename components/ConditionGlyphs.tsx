import React from 'react';

/**
 * Four instrument glyphs for the answer hero — wind, sea, water temperature, sun.
 *
 * These are LEGENDS, not decoration. The rule that produced the 29/07 wave-graphic
 * rewrite applies here too: every glyph sits next to a number, so it is read as a
 * statement about that number. Therefore each one is driven by the value it labels
 * (the wind streamlines run faster at 6 Bft than at 2; the sea line is flatter at
 * 0,2 m than at 1,2 m) and none of them draws anything the number does not claim —
 * no depth, no seabed, no figure in the water.
 *
 * Motion follows the house signature already set in index.css: WIND is what moves
 * (flowing streamlines, like a meteorological chart). Since 28/08/2026 the sea moves too —
 * ΟΧΙ όμως με τις κινούμενες μπάρες κύματος του ανταγωνιστή: ένας σκελετός επιφάνειας που
 * ταξιδεύει, χωρίς γέμισμα από κάτω και χωρίς βυθό, με ρυθμό που τον ορίζει το ίδιο το
 * νούμερο δίπλα του. Everything is CSS-only and silenced under prefers-reduced-motion by
 * the shared guard.
 */

type GlyphTone = 'calm' | 'moderate' | 'rough';

const TONE_STROKE: Record<GlyphTone, string> = {
  calm: '#0d9488',
  moderate: '#d97706',
  rough: '#e11d48',
};

/** Streamlines. Duration collapses from a slow drift at 1 Bft to a hard run at 8+. */
export const WindGlyph: React.FC<{ beaufort: number; tone: GlyphTone; className?: string }> = ({
  beaufort,
  tone,
  className,
}) => {
  const bft = Number.isFinite(beaufort) ? Math.max(0, Math.min(12, beaufort)) : 0;
  // 0 Bft must not animate at all: a moving line under "0 Μπφ" is the same class of
  // lie as the drop icon over an air temperature.
  const still = bft <= 0;
  const duration = still ? 0 : Math.max(0.9, 4.2 - bft * 0.42);
  const stroke = TONE_STROKE[tone];

  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden="true" fill="none">
      {[
        { y: 8, len: 22, delay: 0 },
        { y: 14, len: 28, delay: 0.25 },
        { y: 20, len: 18, delay: 0.5 },
      ].map((line, i) => (
        <path
          key={i}
          d={`M4 ${line.y}h${line.len}`}
          stroke={stroke}
          strokeWidth={2.4}
          strokeLinecap="round"
          opacity={0.85}
          className={still ? undefined : 'cb-glyph-stream'}
          style={
            still
              ? undefined
              : ({
                  '--cb-glyph-stream-duration': `${duration}s`,
                  animationDelay: `${line.delay}s`,
                } as React.CSSProperties)
          }
        />
      ))}
      {/* The curl is what says "wind" rather than "three lines". */}
      <path
        d="M26 14c3-3 7-1 6 2.4-.8 2.6-4 2.6-5 .6"
        stroke={stroke}
        strokeWidth={2.2}
        strokeLinecap="round"
        opacity={0.55}
      />
    </svg>
  );
};

/** One periodic surface: a half-bump every 12 units, from x=-24 to x=72. */
const buildWave = (y: number, a: number): string => {
  const tail: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    tail.push(`8 ${i % 2 === 0 ? a : -a} 12 0`);
  }
  return `M-24 ${y}c4 ${-a} 8 ${-a} 12 0s${tail.join(' ')}`;
};

/**
 * Sea surface in profile. TWO things are the reading and both come from the same number:
 * how TALL the swell is drawn, and how FAST it travels. A 0,2 m sea is an almost straight
 * line crawling; a 1,5 m sea is a visible swell running. No fill below the line — filling
 * it back-doors the depth claim the wave graphic spent three rounds removing.
 *
 * The path is drawn far wider than the 40-unit frame (-24 → 72) on purpose: the animation
 * slides it by exactly one wavelength, so the loop is seamless and no rounded end ever
 * walks into view. The frame's two edges are faded by `.cb-glyph-sea`'s mask instead.
 */
export const SeaGlyph: React.FC<{ heightM: number | null; tone: GlyphTone; className?: string }> = ({
  heightM,
  tone,
  className,
}) => {
  const h = typeof heightM === 'number' && Number.isFinite(heightM) ? Math.max(0, heightM) : 0;
  // 0–1,6 m maps onto 0,6–6 px of amplitude. Beyond 1,6 m the shape stops growing;
  // the number carries it from there and a taller squiggle would just read as noise.
  const amp = Math.min(6, 0.6 + (h / 1.6) * 5.4);
  // Γαλήνη σημαίνει ακίνητο. Ίδιος κανόνας με τα 0 Μπφ στον άνεμο: γραμμή που τρέχει κάτω
  // από «0,0 μ.» λέει κάτι που η μέτρηση δεν λέει.
  const still = h < 0.05;
  // 0,3 μ. → ~6,4 s τον κύκλο· 1,5 μ. και πάνω → 2,6 s. Ο δεύτερος, ξεθωριασμένος σκελετός
  // πάει πιο αργά: δύο γραμμές στο ίδιο ακριβώς βήμα διαβάζονται σαν ένα παχύ αυτοκόλλητο.
  const duration = Math.max(2.6, 6.8 - (h / 1.6) * 4.2);
  const stroke = TONE_STROKE[tone];

  const swell = (index: number): React.SVGProps<SVGPathElement> =>
    still
      ? {}
      : {
          className: 'cb-glyph-swell',
          style: {
            '--cb-glyph-swell-duration': `${(duration * (index === 0 ? 1 : 1.35)).toFixed(2)}s`,
          } as React.CSSProperties,
        };

  return (
    <svg viewBox="0 0 40 28" className={`cb-glyph-sea ${className ?? ''}`} aria-hidden="true" fill="none">
      <path
        d={buildWave(12, amp)}
        stroke={stroke}
        strokeWidth={2.4}
        strokeLinecap="round"
        {...swell(0)}
      />
      <path
        d={buildWave(19, amp * 0.72)}
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.5}
        {...swell(1)}
      />
    </svg>
  );
};

/** Thermometer whose column height tracks the actual temperature, 14–30 °C. */
export const WaterTempGlyph: React.FC<{ celsius: number | null; tone: GlyphTone; className?: string }> = ({
  celsius,
  tone,
  className,
}) => {
  const c = typeof celsius === 'number' && Number.isFinite(celsius) ? celsius : null;
  const fraction = c === null ? 0.5 : Math.max(0.08, Math.min(1, (c - 14) / 16));
  const top = 6;
  const bottom = 19;
  const columnTop = bottom - (bottom - top) * fraction;
  const fill = TONE_STROKE[tone];

  return (
    <svg viewBox="0 0 40 28" className={className} aria-hidden="true" fill="none">
      <rect x={17} y={4} width={6} height={17} rx={3} stroke={fill} strokeWidth={2} opacity={0.35} />
      <rect x={19} y={columnTop} width={2} height={bottom - columnTop} rx={1} fill={fill} />
      <circle cx={20} cy={22.5} r={3.6} fill={fill} />
    </svg>
  );
};

/** Sun low on the horizon — the sunset glyph. The glow breathes; the disc does not move. */
export const SunsetGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 40 28" className={className} aria-hidden="true" fill="none">
    <circle cx={20} cy={17} r={6.5} fill="#f59e0b" className="cb-glyph-glow" />
    {[0, 1, 2, 3, 4].map((i) => {
      const angle = Math.PI + (Math.PI / 6) * (i + 0.5);
      const x1 = 20 + Math.cos(angle) * 9.5;
      const y1 = 17 + Math.sin(angle) * 9.5;
      const x2 = 20 + Math.cos(angle) * 12.5;
      const y2 = 17 + Math.sin(angle) * 12.5;
      return (
        <path
          key={i}
          d={`M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`}
          stroke="#f59e0b"
          strokeWidth={2}
          strokeLinecap="round"
          opacity={0.6}
        />
      );
    })}
    <path d="M4 22.5h32" stroke="#fb923c" strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
  </svg>
);

export type { GlyphTone };
