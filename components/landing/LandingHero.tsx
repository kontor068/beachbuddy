import React, { useMemo, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import type { LanguageCode } from '../../types';
import { getLocalizedCopy } from '../../utils/i18n';
import { landingCopy } from './landingCopy';
import { HomeSearchField } from '../HomeSearchField';
import type { DirectorySearchSuggestion } from '../BeachSearcherHome';
import { DailyBeachScene } from './DailyBeachScene';
import { LandingHeroPhoto } from './LandingHeroPhoto';
import { athensDayKey } from '../../utils/athensTime';
import type { HeroSlot } from './heroSources';

interface LandingHeroProps {
  language: LanguageCode;
  searchQuery: string;
  suggestions: DirectorySearchSuggestion[];
  isSuggesting: boolean;
  onSearchChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSuggestionSelect: (suggestion: DirectorySearchSuggestion) => void;
  onNearMe: () => void;
  isFindingLocation: boolean;
  locationError?: string | null;
  roughness: number;
}

// One quiet accent: the title's final word ("σήμερα"/"today") in brand teal.
// Both authored titles deliberately end on that promise word, so a last-word
// split is a controlled device, not string luck.
// Colours one phrase inside the headline. The copy keeps ONE canonical title
// string (so the sentence is never assembled from fragments) and names the
// substring to accent; if that substring is ever edited out of the title, this
// degrades to the plain headline rather than breaking it.
const renderTitleAccent = (title: string, accent: string): React.ReactNode => {
  const i = accent ? title.indexOf(accent) : -1;
  if (i === -1) return title;
  return (
    <>
      {title.slice(0, i)}
      <span className="text-[#0284c7]">{accent}</span>
      {title.slice(i + accent.length)}
    </>
  );
};

const riseDelay = (delayMs: number): React.CSSProperties => ({ animationDelay: `${delayMs}ms` });
const cssVar = (name: string, value: string) => ({ [name]: value } as React.CSSProperties);

// Wind made visible: thin dashed streams flowing across the upper hero — the
// language of a weather map, and OUR signal (we judge wind). A motif only: it
// carries no numbers, so it makes no false "live data" claim.
const WindStreams: React.FC = () => (
  <svg
    className="pointer-events-none absolute inset-x-0 top-6 -z-10 h-72 w-full text-slate-500/25 sm:top-10"
    viewBox="0 0 1440 280"
    preserveAspectRatio="xMidYMin slice"
    fill="none"
    aria-hidden="true"
  >
    <path className="cb-breeze-path" style={cssVar('--cb-breeze-duration', '18s')} d="M-60,58 C240,4 560,114 880,58 S1320,2 1520,50" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path className="cb-breeze-path" style={cssVar('--cb-breeze-duration', '26s')} d="M-60,150 C300,208 640,96 980,150 S1380,204 1520,146" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <path className="cb-breeze-path" style={cssVar('--cb-breeze-duration', '13s')} d="M-40,232 C260,192 520,262 840,224 S1300,176 1500,212" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.45" />
  </svg>
);

// Slow, soft cloud wisps — airy life without a single moving wave band.
const Clouds: React.FC = () => (
  <div className="pointer-events-none absolute inset-x-0 top-4 -z-10 h-44 overflow-hidden sm:top-8" aria-hidden="true">
    <div className="cb-cloud absolute left-[10%] top-6 h-9 w-44 rounded-full bg-white/55 blur-2xl" style={cssVar('--cb-cloud-duration', '50s')} />
    <div className="cb-cloud absolute right-[14%] top-16 h-11 w-56 rounded-full bg-white/40 blur-2xl" style={cssVar('--cb-cloud-duration', '66s')} />
    <div className="cb-cloud absolute left-[44%] top-2 h-7 w-32 rounded-full bg-white/45 blur-2xl" style={cssVar('--cb-cloud-duration', '58s')} />
  </div>
);

export const LandingHero: React.FC<LandingHeroProps> = ({
  language,
  searchQuery,
  suggestions,
  isSuggesting,
  onSearchChange,
  onSearchSubmit,
  onSuggestionSelect,
  onNearMe,
  isFindingLocation,
  locationError,
  roughness,
}) => {
  const c = getLocalizedCopy(language, landingCopy).hero;
  const heroTitle = renderTitleAccent(c.title, c.titleAccent);
  // Greek day, not the viewer's UTC day, so everyone gets the same scene per day.
  const dateSeed = useMemo(() => athensDayKey(), []);
  const [photoOk, setPhotoOk] = useState(true);

  // Rotate the hero photo through the day (visitor's LOCAL hour): a bright sandy
  // beach in the morning, vivid turquoise at midday/afternoon, golden hour in the
  // evening/night. LandingHeroPhoto renders the actual responsive, art-directed
  // <picture> for this slot (see components/landing/heroSources.ts).
  const heroSlot: HeroSlot = useMemo(() => {
    // athens-clock-exempt: decorative only — the hero photo deliberately follows the
    // visitor's own time of day. It carries no conditions data.
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 18) return 'afternoon';
    return 'evening';
  }, []);

  return (
    <section className="relative">
      {/* Atmosphere: two very large, very soft washes — morning light upper
          right, sky haze left — kept below 8% visual weight. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-48 right-[-22%] h-[36rem] w-[36rem] rounded-full bg-gradient-to-b from-amber-100/60 via-amber-50/30 to-transparent blur-3xl" />
        <div className="absolute -top-28 left-[-18%] h-[30rem] w-[30rem] rounded-full bg-sky-200/40 blur-3xl" />
      </div>

      <WindStreams />
      <Clouds />

      {/* The ground the hero stands on: a real Greek sea photo for this time of
          day. Landscape photos in a tall band with a horizon-centred crop and a
          short clean feather — earlier square/portrait photos in a short band
          read as "cut"/"glassy". Falls back to the generative daily beach. */}
      {/* The bottom edge is feathered with a MASK, not a colour overlay like the
          top one. The page background is a vertical gradient over the full
          document height (index.css: #F0F9FF -> #E0F2FE at 40% -> #F0F9FF), so the
          colour sitting under the hero's bottom edge depends on how long the page
          is — any hardcoded colour would be visibly wrong at some viewport. The
          top overlay gets away with #eff6fb only because it is near the very top
          where the gradient has barely moved. A mask fades the image itself to
          transparent, so whatever the background happens to be there shows
          through exactly. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-72 overflow-hidden [-webkit-mask-image:linear-gradient(to_bottom,#000_0%,#000_62%,transparent_100%)] [mask-image:linear-gradient(to_bottom,#000_0%,#000_62%,transparent_100%)] sm:h-96"
        aria-hidden="true"
      >
        {photoOk ? (
          <LandingHeroPhoto
            slot={heroSlot}
            onError={() => setPhotoOk(false)}
            className="h-full w-full object-cover"
          />
        ) : (
          <DailyBeachScene dateSeed={dateSeed} roughness={roughness} className="h-full w-full" />
        )}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-[#eff6fb] via-[#eff6fb]/60 to-transparent" />
      </div>

      <div className="relative mx-auto max-w-3xl px-5 pb-56 pt-12 text-center sm:pb-72 sm:pt-20">
        {/* No kicker line. It was a slogan every visitor saw and nobody needed,
            and it pushed the region tiles — the page's actual conversion event —
            further below the fold. */}
        <h1
          className="cb-hero-rise mx-auto max-w-2xl text-balance text-4xl font-bold leading-[1.06] tracking-tight text-slate-950 sm:text-[3.4rem]"
          style={riseDelay(0)}
        >
          {heroTitle}
        </h1>

        <p
          className="cb-hero-rise mx-auto mt-5 max-w-xl text-base font-normal leading-relaxed text-slate-600 sm:text-lg"
          style={riseDelay(170)}
        >
          {c.subtitle}
        </p>

        <div
          className="cb-hero-rise mx-auto mt-9 flex max-w-2xl flex-col gap-3 sm:mt-11 sm:flex-row sm:items-stretch"
          style={riseDelay(250)}
        >
          <div className="min-w-0 flex-1">
            {/* Two wordings, 4s apart, while the box sits untouched: the plain
                promise first, then the sentence syntax nothing else on the page
                teaches any more. It stops the moment the field is focused or
                holds a value — see HomeSearchField. */}
            <HomeSearchField
              value={searchQuery}
              placeholder={c.searchPlaceholder}
              placeholderAlt={c.searchPlaceholderAlt}
              labels={{
                searchAria: c.searchAria,
                clearSearchAria: c.clearSearchAria,
                regionLabel: c.searchRegionLabel,
                beachLabel: c.searchBeachLabel,
                loading: c.searchLoading,
                noResults: c.searchNoResults,
              }}
              suggestions={suggestions}
              isSuggesting={isSuggesting}
              onChange={onSearchChange}
              onSubmit={onSearchSubmit}
              onSuggestionSelect={onSuggestionSelect}
            />
          </div>
          <button
            type="button"
            onClick={onNearMe}
            disabled={isFindingLocation}
            className={`inline-flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-cta px-7 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition hover:bg-cta-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 sm:min-h-16 sm:rounded-full ${
              isFindingLocation ? 'cursor-wait opacity-70' : ''
            }`}
          >
            <LocateFixed className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{isFindingLocation ? c.findingLocation : c.nearMe}</span>
          </button>
        </div>

        {locationError && (
          <p className="mx-auto mt-3.5 max-w-2xl text-sm font-semibold text-rose-600" role="alert">
            {locationError}
          </p>
        )}
      </div>
    </section>
  );
};

export default LandingHero;
