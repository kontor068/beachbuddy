import React, { useId } from 'react';
import { ArrowRight, LocateFixed, Navigation2 } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { landingCopy } from './landingCopy';
import type { ConditionsStatus } from '../../hooks/useNationalConditions';
import type { SeaAreaReading, SeaAreaKey } from '../../services/nationalConditions';

// Replaces a competitor-style "browse by region" grid with something only we can
// show: today's REAL sea conditions, per sea area, live. It reuses the single
// national read the hero already fetches (no extra calls), turns browsing into a
// decision, and stays honest — on failure it shows an evergreen line, never fake
// numbers. The mini sea glyph per tile speaks the same visual language as the
// hero's living sea (calm = glassy & bright, rough = deep & white-capped).

interface TodaySeasSectionProps {
  language: LanguageCode;
  areas: SeaAreaReading[];
  status: ConditionsStatus;
  onShowNearbyBeaches: () => void;
  onOpenIslandSelector: () => void;
}

const SEA_TOP = ['#a9dee3', '#79b0bc'];
const SEA_BOT = ['#2b93a9', '#1b5a70'];
const CHOP = [
  { x: 12, y: 20 }, { x: 30, y: 34 }, { x: 48, y: 24 }, { x: 66, y: 40 }, { x: 84, y: 22 },
  { x: 102, y: 36 }, { x: 22, y: 44 }, { x: 58, y: 16 }, { x: 90, y: 46 }, { x: 40, y: 48 },
];

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lerpHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hex(a), [br, bg, bb] = hex(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
};

const SeaGlyph: React.FC<{ roughness: number }> = ({ roughness }) => {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = Math.max(0, Math.min(1, roughness));
  const top = lerpHex(SEA_TOP[0], SEA_TOP[1], r);
  const bot = lerpHex(SEA_BOT[0], SEA_BOT[1], r);
  const caps = Math.round(r * r * 10);
  const sheen = Math.max(0, 1 - r * 2.1);
  return (
    <svg viewBox="0 0 120 60" preserveAspectRatio="none" className="h-16 w-full" aria-hidden="true">
      <defs>
        <linearGradient id={`sg${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bot} />
        </linearGradient>
        <radialGradient id={`sh${uid}`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="120" height="60" fill={`url(#sg${uid})`} />
      {sheen > 0.02 && <ellipse cx="60" cy="30" rx="52" ry="18" fill={`url(#sh${uid})`} opacity={sheen} />}
      {CHOP.slice(0, caps).map((c, i) => (
        <rect key={i} x={c.x - 4} y={c.y} width="8" height="2" rx="1" fill="#ffffff" opacity={0.4 + r * 0.4} />
      ))}
      <path d="M0 50 Q 30 46 60 50 T 120 50" stroke="#ffffff" strokeOpacity={0.2 + r * 0.2} strokeWidth="1.4" fill="none" />
    </svg>
  );
};

type VerdictKey = 'calm' | 'mild' | 'fresh' | 'strong' | 'rough';
const verdictKey = (bft: number): VerdictKey =>
  bft <= 2 ? 'calm' : bft <= 3 ? 'mild' : bft <= 4 ? 'fresh' : bft <= 5 ? 'strong' : 'rough';

const VERDICT_TONE: Record<string, string> = {
  calm: 'text-emerald-700 bg-emerald-50 ring-emerald-100',
  mild: 'text-teal-700 bg-teal-50 ring-teal-100',
  fresh: 'text-amber-700 bg-amber-50 ring-amber-100',
  strong: 'text-orange-700 bg-orange-50 ring-orange-100',
  rough: 'text-rose-700 bg-rose-50 ring-rose-100',
};

const AREA_ORDER: SeaAreaKey[] = ['ionian', 'saronic', 'cretan', 'aegean', 'neAegean'];

export const TodaySeasSection: React.FC<TodaySeasSectionProps> = ({
  language,
  areas,
  status,
  onShowNearbyBeaches,
  onOpenIslandSelector,
}) => {
  const c = getLocalizedCopy(language, landingCopy).seas;
  const ordered = AREA_ORDER.map(key => areas.find(a => a.key === key)).filter((a): a is SeaAreaReading => Boolean(a));

  const cta = (
    <div className="mt-7 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
      <button
        type="button"
        onClick={onShowNearbyBeaches}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-cta px-6 text-sm font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2"
      >
        <LocateFixed className="h-4 w-4" aria-hidden="true" />
        {c.cta}
      </button>
      <button
        type="button"
        onClick={onOpenIslandSelector}
        className="inline-flex items-center gap-1.5 rounded text-sm font-bold text-[#007a83] underline-offset-4 transition hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-700"
      >
        {c.allRegions}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <section className="mx-auto w-full max-w-6xl px-5" aria-label={c.title}>
      <div className="flex items-baseline gap-3">
        <h2 className="shrink-0 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{c.title}</h2>
        {status === 'live' && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-[#007a83]">
            <span className="relative flex h-2 w-2" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 motion-safe:animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {c.live}
          </span>
        )}
        <span className="hidden h-px flex-1 translate-y-[-0.35rem] bg-slate-300/70 sm:block" aria-hidden="true" />
      </div>
      <p className="mt-2 max-w-xl text-[15px] font-normal leading-relaxed text-slate-600">{c.subtitle}</p>

      {status === 'unavailable' && ordered.length === 0 ? (
        <div className="mt-6">
          <p className="max-w-2xl text-base font-semibold leading-relaxed text-slate-700">{c.unavailable}</p>
          {cta}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3.5 sm:mt-8 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
            {ordered.length > 0
              ? ordered.map(a => {
                  const vk = verdictKey(a.beaufort);
                  return (
                    <div key={a.key} className="beach-card overflow-hidden">
                      <SeaGlyph roughness={a.roughness} />
                      <div className="px-3.5 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="truncate text-sm font-bold text-slate-950">{c.areas[a.key]}</h3>
                          <Navigation2 className="h-3.5 w-3.5 shrink-0 text-slate-400" style={{ transform: `rotate(${a.dirDeg + 180}deg)` }} aria-hidden="true" />
                        </div>
                        <div className="mt-1 flex items-baseline gap-1.5">
                          <span className="text-2xl font-extrabold leading-none text-slate-950 tabular-nums">{a.beaufort}</span>
                          <span className="text-xs font-semibold text-slate-500">{c.unit}</span>
                        </div>
                        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${VERDICT_TONE[vk]}`}>
                          {c.verdicts[vk]}
                        </span>
                      </div>
                    </div>
                  );
                })
              : AREA_ORDER.map(key => (
                  <div key={key} className="beach-card overflow-hidden">
                    <div className="h-16 w-full animate-pulse bg-sky-100" />
                    <div className="space-y-2 px-3.5 py-3">
                      <div className="h-3.5 w-16 animate-pulse rounded bg-slate-200" />
                      <div className="h-6 w-10 animate-pulse rounded bg-slate-200" />
                      <div className="h-4 w-14 animate-pulse rounded-full bg-slate-200" />
                    </div>
                  </div>
                ))}
          </div>
          <p className="mt-4 text-xs font-medium text-slate-400">{c.note}</p>
          {cta}
        </>
      )}
    </section>
  );
};

export default TodaySeasSection;
