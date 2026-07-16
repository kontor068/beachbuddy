import React, { useId, useMemo } from 'react';

// The landing hero's living sea, rendered as a real beach today. Two things are
// data-driven and honest:
//   1. The scene changes DAILY — seeded from the date, so the sand/pebble mix,
//      the sun and the shoreline differ each day (free, no fetch).
//   2. The SEA STATE reflects today's real national conditions (roughness 0..1
//      from useNationalConditions). Calm → a glassy, mirror-still sea with a
//      slow, shallow wash; meltemi → a deeper, greyer, white-capped chop with a
//      fast, far-reaching wash. The difference is meant to be read at a glance.
// Unlike the competitor's decorative wave-bands, our sea MEANS something. The
// only motion is the shoreline wash and a few whitecap twinkles — never sliding
// colour bands — and it is fully gated behind prefers-reduced-motion.

const hashString = (s: string): number => {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^ (h >>> 16)) >>> 0;
};
const mulberry32 = (a: number) => () => {
  a |= 0; a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const f = (n: number) => Number(n.toFixed(1));
type Pt = { x: number; y: number };
const curve = (pts: Pt[]): string => {
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const c = pts[i], n = pts[i + 1];
    d += ` Q ${f(c.x)} ${f(c.y)} ${f((c.x + n.x) / 2)} ${f((c.y + n.y) / 2)}`;
  }
  const last = pts[pts.length - 1];
  return `${d} L ${f(last.x)} ${f(last.y)}`;
};
const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerpHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
};

const PEBBLE_TONES = ['#cfc1a6', '#b8a888', '#a08f75', '#dacfb6', '#8d8369', '#c6b596', '#b0a186'];
// Sea end-points: calm (bright, glassy) → rough (deep, grey-petrol).
const SEA_TOP = ['#a9dee3', '#79b0bc'];
const SEA_BOT = ['#2b93a9', '#1b5a70'];

interface DailyBeachSceneProps {
  dateSeed: string;
  roughness: number; // 0..1 national sea state
  className?: string;
}

export const DailyBeachScene: React.FC<DailyBeachSceneProps> = ({ dateSeed, roughness, className }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const rough = Math.max(0, Math.min(1, roughness));
  const seaTop = lerpHex(SEA_TOP[0], SEA_TOP[1], rough);
  const seaBot = lerpHex(SEA_BOT[0], SEA_BOT[1], rough);
  const sheen = Math.max(0, 1 - rough * 2.1);       // glassy mirror when calm
  const glitterFade = Math.max(0, 1 - rough * 1.4); // reflection breaks up with chop

  const s = useMemo(() => {
    const rng = mulberry32(hashString(dateSeed));
    const r = (a: number, b: number) => a + rng() * (b - a);
    const W = 1440, H = 360;
    const horizon = 78;

    // --- Beach layout (seeded by the day; stable regardless of sea state) ---
    const shoreBaseY = r(206, 228);
    const shoreSegs = 8;
    const shorePts: Pt[] = [];
    for (let i = 0; i <= shoreSegs; i++) shorePts.push({ x: (W / shoreSegs) * i, y: shoreBaseY + Math.sin(i * 1.1 + 0.6) * r(3, 7) });
    const shoreline = curve(shorePts);
    const beach = `${shoreline} L ${W} ${H} L 0 ${H} Z`;

    const sun = { x: r(W * 0.14, W * 0.86), y: r(20, 66), rad: r(150, 210), warm: r(0, 1) };
    const pebbly = rng() < 0.5;

    const pebbles: { x: number; y: number; rx: number; ry: number; tone: string; hi: number }[] = [];
    const speckles: { x: number; y: number; r: number; o: number }[] = [];
    if (pebbly) {
      for (let i = 0; i < 66; i++) {
        const y = r(shoreBaseY + 4, H - 3);
        const depth = (y - shoreBaseY) / (H - shoreBaseY);
        const rx = r(5, 10) * (0.7 + depth * 1.1);
        pebbles.push({ x: r(-6, W + 6), y, rx, ry: rx * r(0.6, 0.82), tone: PEBBLE_TONES[Math.floor(rng() * PEBBLE_TONES.length)], hi: rng() });
      }
    } else {
      for (let i = 0; i < 46; i++) {
        const y = r(shoreBaseY + 6, H - 2);
        speckles.push({ x: r(0, W), y, r: r(0.8, 1.9), o: r(0.05, 0.14) });
      }
    }

    // --- Sea state (driven by today's roughness) ---
    const seaTopY = horizon, seaSpan = shoreBaseY - horizon;
    const glitter: { x: number; y: number; w: number; o: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const t = i / 9;
      glitter.push({ x: sun.x + r(-5, 5), y: seaTopY + seaSpan * (0.1 + t * 0.85), w: 120 * (1 - t) * r(0.6, 1.05), o: 0.55 * (1 - t) });
    }

    // Long gentle swell lines (surface texture; always present, wavier when rough).
    const foamCount = 3 + Math.round(rough * 5);
    const foamLines: { d: string; o: number }[] = [];
    for (let k = 0; k < foamCount; k++) {
      const t = (k + 1) / (foamCount + 1);
      const y = seaTopY + seaSpan * t;
      const amp = (0.8 + rough * 4.5) * (0.5 + t);
      const seg = 11;
      const pts: Pt[] = [];
      for (let i = 0; i <= seg; i++) pts.push({ x: (W / seg) * i, y: y + Math.sin(i * 0.9 + k * 1.3) * amp });
      foamLines.push({ d: curve(pts), o: 0.05 + rough * 0.08 + t * 0.04 });
    }

    // Chop: white dashes. Quadratic in roughness so a calm sea is truly glassy
    // (near-zero), a fresh/strong sea is densely capped. Denser toward the shore.
    const chopCount = Math.round(rough * rough * 74);
    const chop: { x: number; y: number; w: number; h: number; o: number; tw: boolean; dur: number }[] = [];
    for (let i = 0; i < chopCount; i++) {
      const t = Math.sqrt(r(0.04, 1)); // bias lower (nearer)
      chop.push({
        x: r(0, W), y: seaTopY + seaSpan * (0.12 + t * 0.86),
        w: r(6, 20) * (0.5 + t), h: r(1.6, 3.2),
        o: 0.35 + rough * 0.4 + t * 0.15, tw: i % 5 === 0, dur: r(3, 5.5),
      });
    }

    return { W, H, horizon, shoreBaseY, seaSpan, shoreline, beach, sun, pebbly, pebbles, speckles, glitter, foamLines, chop };
    // `rough` drives the sea (chop/foam), computed AFTER the beach layout so the
    // beach stays identical when today's conditions resolve; only the sea changes.
  }, [dateSeed, rough]);

  const washVars = {
    '--cb-wash-duration': `${(8.5 - rough * 4.5).toFixed(1)}s`,
    '--cb-wash-travel': `${(-(3 + rough * 12)).toFixed(0)}px`,
    '--cb-wash-o0': (0.5 + rough * 0.18).toFixed(2),
    '--cb-wash-o1': (0.82 + rough * 0.14).toFixed(2),
  } as React.CSSProperties;

  const midSeaY = f(s.horizon + s.seaSpan * 0.5);

  return (
    <svg className={className} viewBox={`0 0 ${s.W} ${s.H}`} preserveAspectRatio="none" role="img" aria-hidden="true" fill="none">
      <defs>
        <linearGradient id={`sky${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#eef6fb" />
          <stop offset="1" stopColor={`rgb(${205 + s.sun.warm * 20}, ${228 + s.sun.warm * 6}, 236)`} />
        </linearGradient>
        <linearGradient id={`sea${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={seaTop} />
          <stop offset="1" stopColor={seaBot} />
        </linearGradient>
        <linearGradient id={`sand${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ecdcb8" />
          <stop offset="1" stopColor={s.pebbly ? '#cabfa2' : '#dcc79f'} />
        </linearGradient>
        <radialGradient id={`sun${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffe6ba" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#ffe6ba" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffe6ba" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`sheen${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter id={`foam${uid}`} x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id={`grain${uid}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
        </filter>
      </defs>

      {/* Sky + sun */}
      <rect x="0" y="0" width={s.W} height={f(s.horizon + 2)} fill={`url(#sky${uid})`} />
      <circle cx={f(s.sun.x)} cy={f(s.sun.y)} r={f(s.sun.rad)} fill={`url(#sun${uid})`} />

      {/* Sea */}
      <rect x="0" y={f(s.horizon)} width={s.W} height={f(s.H - s.horizon)} fill={`url(#sea${uid})`} />
      {/* Glassy mirror sheen — strong on a calm day, gone in chop */}
      {sheen > 0.02 && (
        <ellipse cx={f(s.W * 0.5)} cy={midSeaY} rx={f(s.W * 0.62)} ry={f(s.seaSpan * 0.42)} fill={`url(#sheen${uid})`} opacity={sheen} />
      )}
      {/* Sun glitter path */}
      {glitterFade > 0.02 && s.glitter.map((g, i) => (
        <rect key={`g${i}`} x={f(g.x - g.w / 2)} y={f(g.y)} width={f(g.w)} height="3" rx="1.5" fill="#ffe6ba" opacity={g.o * glitterFade} />
      ))}
      {/* Swell texture */}
      {s.foamLines.map((l, i) => (
        <path key={`fl${i}`} d={l.d} stroke="#ffffff" strokeOpacity={l.o} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      ))}
      {/* Whitecap chop */}
      {s.chop.map((c, i) => (
        <rect
          key={`c${i}`}
          className={c.tw ? 'cb-twinkle' : undefined}
          style={c.tw ? ({ '--cb-twinkle-duration': `${c.dur}s` } as React.CSSProperties) : undefined}
          x={f(c.x - c.w / 2)} y={f(c.y)} width={f(c.w)} height={f(c.h)} rx={f(c.h / 2)} fill="#ffffff" opacity={c.o}
        />
      ))}

      {/* Beach */}
      <path d={s.beach} fill={`url(#sand${uid})`} />
      <path d={`${s.shoreline} L ${s.W} ${f(s.shoreBaseY + 16 + rough * 18)} L 0 ${f(s.shoreBaseY + 16 + rough * 18)} Z`} fill="#c3aa7d" opacity="0.45" />

      {s.pebbly
        ? s.pebbles.map((p, i) => (
            <g key={`p${i}`}>
              <ellipse cx={f(p.x)} cy={f(p.y)} rx={f(p.rx)} ry={f(p.ry)} fill={p.tone} />
              <ellipse cx={f(p.x - p.rx * 0.28)} cy={f(p.y - p.ry * 0.3)} rx={f(p.rx * 0.5)} ry={f(p.ry * 0.42)} fill="#ffffff" opacity={0.14 + p.hi * 0.12} />
            </g>
          ))
        : s.speckles.map((sp, i) => (
            <circle key={`sp${i}`} cx={f(sp.x)} cy={f(sp.y)} r={f(sp.r)} fill="#8a7a5c" opacity={sp.o} />
          ))}

      {/* Shoreline wash — the beach's signature motion, scaled by today's sea */}
      <g className="cb-wash" style={washVars}>
        <path d={s.shoreline} stroke="#ffffff" strokeOpacity="0.92" strokeWidth={f(9 + rough * 14)} fill="none" strokeLinecap="round" filter={`url(#foam${uid})`} />
        <path d={s.shoreline} stroke="#ffffff" strokeOpacity="0.6" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      </g>

      {/* Painted tooth */}
      <rect x="0" y="0" width={s.W} height={s.H} filter={`url(#grain${uid})`} opacity="0.05" />
    </svg>
  );
};

export default DailyBeachScene;
