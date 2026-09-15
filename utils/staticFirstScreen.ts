// THE HOME PAGE'S STATIC FIRST SCREEN — the hand-over from built HTML to the live app.
//
// Why it exists: on the home page nothing used to paint until the whole JS bundle had
// downloaded and run (index.html hides the prerendered fallback while JS is on). The
// build now renders the landing's real first screen — the same Header and LandingHero
// components, see components/landing/LandingFirstScreen.tsx — into the home HTML as an
// overlay (#cb-first-screen) that paints with the CSS. React renders underneath it as
// before; once React's own hero photo is ready, LandingHero calls
// handOverStaticFirstScreen() and the overlay is removed in one frame. Same components,
// same photo, same position — nothing visibly changes, and no layout moves (the overlay
// is absolutely positioned, so removing it shifts nothing).
// Measured 15/09/2026 on a throttled phone: largest paint 4.8s -> 3.4s, app usable at the
// same moment as before. See docs/team/03-frontend-engineer.md.
//
// Contract with the build (scripts/prerenderBeachPages.mjs, buildHomePage):
//  - the overlay element carries FIRST_SCREEN_ID;
//  - an inline <head> script adds FIRST_SCREEN_CLASS to <html> only when the overlay
//    should show (home path, no remembered region); a script right after the overlay adds
//    `${FIRST_SCREEN_CLASS}-ready` once it is fully parsed — CSS shows it only with both;
//  - the hero photo script records the slot it picked on <html> as HERO_SLOT_ATTR;
//  - a tap on the overlay's "near me" button sets window.__cbFirstScreenNearMe.

export const FIRST_SCREEN_ID = 'cb-first-screen';
export const FIRST_SCREEN_CLASS = 'cb-first-screen';
export const HERO_SLOT_ATTR = 'data-cb-hero-slot';

declare global {
  interface Window {
    __cbFirstScreenNearMe?: boolean;
  }
}

const overlayElement = (): HTMLElement | null => (
  typeof document === 'undefined' ? null : document.getElementById(FIRST_SCREEN_ID)
);

/** True while the static first screen is on screen, i.e. React has something to take over. */
export const hasStaticFirstScreen = (): boolean => (
  Boolean(overlayElement()) && document.documentElement.classList.contains(FIRST_SCREEN_CLASS)
);

/** The hero photo slot the static first screen picked, so React shows the same photo. */
export const readStaticHeroSlot = (): string | null => (
  hasStaticFirstScreen() ? document.documentElement.getAttribute(HERO_SLOT_ATTR) : null
);

/**
 * Drops the overlay without carrying anything over. Idempotent, never throws. This is the
 * safety exit: an error, a view other than the landing, or a hand-over that never came.
 * The overlay must never be left sitting on top of a page it does not match.
 */
export const removeStaticFirstScreen = (): void => {
  try {
    overlayElement()?.remove();
    if (typeof document !== 'undefined') document.documentElement.classList.remove(FIRST_SCREEN_CLASS, `${FIRST_SCREEN_CLASS}-ready`);
  } catch {
    /* nothing on screen to fix */
  }
};

export interface StaticFirstScreenCarryOver {
  /** What the visitor had already typed into the static search box. */
  typedQuery: string;
  /** Whether that box had focus (the phone keyboard was open). */
  searchHadFocus: boolean;
  /** Whether "near me" was tapped before the app could act on it. */
  nearMeQueued: boolean;
}

/**
 * The normal exit: remove the overlay and hand back what the visitor did on it, so the
 * live hero can carry it on — text typed into the search box is not lost, and a "near
 * me" tap is not swallowed. Returns null when there was no overlay to hand over.
 */
export const handOverStaticFirstScreen = (): StaticFirstScreenCarryOver | null => {
  const overlay = overlayElement();
  if (!overlay || !hasStaticFirstScreen()) {
    removeStaticFirstScreen();
    return null;
  }
  const input = overlay.querySelector('input');
  const carry: StaticFirstScreenCarryOver = {
    typedQuery: input?.value ?? '',
    searchHadFocus: Boolean(input) && document.activeElement === input,
    nearMeQueued: window.__cbFirstScreenNearMe === true,
  };
  window.__cbFirstScreenNearMe = false;
  removeStaticFirstScreen();
  return carry;
};
