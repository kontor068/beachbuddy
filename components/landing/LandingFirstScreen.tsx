// BUILD-TIME ONLY — never imported by the app. scripts/buildLandingFirstScreen.mjs compiles
// this file for Node and calls renderLandingFirstScreen() once per home-page language; the
// markup becomes the home page's static first screen (utils/staticFirstScreen.ts explains
// the hand-over). It renders the SAME Header and LandingHero the app renders on the
// landing, inside the same page shell, so the static copy and the live one cannot drift
// apart in wording, classes or layout — only these build-time differences are allowed:
//   - Header `staticRender`: no date pill, no "unseen update" dot (day/device dependent);
//   - LandingHero `firstScreenPhoto`: the three candidate photos + the script that picks
//     one by the visitor's hour, and no entrance animation.
// If App.tsx changes the props it gives Header or LandingHero on the landing, mirror the
// change here, or the hand-over will visibly swap one version for the other.
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Header from '../Header';
import { LandingHero } from './LandingHero';
import { LandingHeroPhoto } from './LandingHeroPhoto';
import type { HeroSlot } from './heroSources';
import { heroSlotForHour } from './heroSlot';
import { FIRST_SCREEN_CLASS, FIRST_SCREEN_ID, HERO_SLOT_ATTR } from '../../utils/staticFirstScreen';
// The same check useAuth makes (authService's isAuthAvailable is this function), taken
// from the lighter module so the build does not pull the whole auth service in.
import { isAuthConfigured as isAuthAvailable } from '../../services/supabaseClient';

export type FirstScreenLanguage = 'en' | 'gr';

const HERO_SLOTS: HeroSlot[] = ['morning', 'afternoon', 'evening'];
const noop = () => {};

// Puts the photo for the visitor's hour in place, while the page is still being parsed, so
// the photo request starts as soon as the stylesheet allows — without waiting for any
// bundle. Only when the first screen is actually showing: otherwise a photo nobody sees
// would be downloaded (a <template>'s content is inert until cloned — the point of it).
// It sits at the END of the first screen, not next to the photo: an inline script halts
// the parser until the stylesheet has loaded, and the browser paints whatever it has
// parsed by then. Placed by the photo (which comes before the headline in the markup) it
// let a half-built hero paint, and the headline arriving next pushed the photo down —
// a 0.195 layout shift on desktop, measured 15/09/2026.
const heroSlotScript = [
  '(function(){',
  'var d=document.documentElement;',
  `if(!d.classList.contains(${JSON.stringify(FIRST_SCREEN_CLASS)}))return;`,
  `var o=document.getElementById(${JSON.stringify(FIRST_SCREEN_ID)});if(!o)return;`,
  // athens-clock-exempt: decorative only — like LandingHero, the hero photo deliberately
  // follows the visitor's own time of day and carries no conditions data.
  `var slot=(${String(heroSlotForHour)})(new Date().getHours());`,
  `d.setAttribute(${JSON.stringify(HERO_SLOT_ATTR)},slot);`,
  `var t=o.querySelector('template[${HERO_SLOT_ATTR}="'+slot+'"]');`,
  'if(t)t.parentNode.insertBefore(t.content.cloneNode(true),t);',
  '})();',
].join('');

const FirstScreenPhoto: React.FC = () => (
  <>
    {HERO_SLOTS.map(slot => (
      <template key={slot} {...{ [HERO_SLOT_ATTR]: slot }}>
        {/* Same className LandingHero gives the live photo. */}
        <LandingHeroPhoto slot={slot} className="h-full w-full object-cover" />
      </template>
    ))}
  </>
);

export const renderLandingFirstScreen = (language: FirstScreenLanguage): string => renderToStaticMarkup(
  // The page shell, as App.tsx renders it around the landing.
  <div className="relative min-h-screen transition-colors duration-500">
    <div className="atmosphere" />
    <Header
      language={language}
      onLanguageChange={noop}
      selectedIslandName="..."
      onOpenIslandSelector={noop}
      isWinter={false}
      stickyTopBar
      onGoHome={noop}
      authAvailable={isAuthAvailable()}
      isSignedIn={false}
      onSignIn={noop}
      staticRender
    />
    {/* LandingView's own <main>, which wraps the hero. */}
    <main className="relative z-10 pb-16 sm:pb-24">
      <LandingHero
        language={language}
        searchQuery=""
        suggestions={[]}
        isSuggesting={false}
        onSearchChange={noop}
        onSearchSubmit={noop}
        onSuggestionSelect={noop}
        onNearMe={noop}
        isFindingLocation={false}
        locationError={null}
        roughness={0}
        firstScreenPhoto={<FirstScreenPhoto />}
      />
    </main>
    <script dangerouslySetInnerHTML={{ __html: heroSlotScript }} />
  </div>
);
