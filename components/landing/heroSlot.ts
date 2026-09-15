import type { HeroSlot } from './heroSources';

// Which of the three hero photos a given local hour gets: a bright sandy beach in the
// morning, vivid turquoise at midday/afternoon, golden hour in the evening/night.
//
// ONE definition, two users. LandingHero calls it at runtime, and the build serialises this
// very function (`String(heroSlotForHour)`, scripts/buildLandingFirstScreen.mjs) into the
// inline script that picks the photo on the static first screen of the home page. So it
// must stay a pure, self-contained expression of `hour`: no imports, no closures, no clock
// of its own — anything else would not survive being turned into text.
export const heroSlotForHour = (hour: number): HeroSlot => (
  hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening'
);
