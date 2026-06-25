import type { Beach } from '../types';
import storiesData from './milosBeachStories.data.json';

/**
 * Curated editorial "get to know this beach" stories for the major beaches of
 * Milos (Μήλος). Shown in the beach detail page so visitors can read about the
 * geology, history and character of the place, not just today's wind and sea.
 *
 * SINGLE SOURCE OF TRUTH: the text lives in `milosBeachStories.data.json` so it
 * can be consumed by BOTH this runtime module AND the static prerender script
 * (`scripts/prerenderBeachPages.mjs`), which bakes it into crawlable HTML +
 * meta description + JSON-LD. Edit the JSON, never duplicate the text here.
 *
 * Keyed by the beach's (Milos-region) frozen id. Content is written in Greek
 * (`gr`, the primary audience) with an English (`en`) translation for tourists.
 * Facts were research-checked — etymologies and pirate/priest legends are
 * presented as the local tradition they are, not as documented history, and
 * figures that travel sources contest are hedged.
 */

const MILOS_REGION_ID = 'south-aegean-milos';

type StoryLocale = 'gr' | 'en';

export interface BeachStory {
  /** Short evocative subtitle shown under the section heading. */
  title: Record<StoryLocale, string>;
  /** Ordered narrative paragraphs. */
  paragraphs: Record<StoryLocale, string[]>;
}

export const MILOS_BEACH_STORIES = storiesData as unknown as Record<number, BeachStory>;


/**
 * Returns the curated story for a beach, but only when we are confident it is
 * the Milos beach the story was written for. Ids are unique only within a
 * region, so we gate on the Milos region: either the merged-view `regionId`
 * marker, or the localized island name shown in the detail header.
 */
export function getMilosBeachStory(
  beach: Pick<Beach, 'id' | 'regionId' | 'sourceBeachId'>,
  islandName?: string,
): BeachStory | null {
  const isMilos =
    beach.regionId === MILOS_REGION_ID || /μήλος|milos/i.test(islandName ?? '');
  if (!isMilos) return null;
  const key = beach.sourceBeachId ?? beach.id;
  return MILOS_BEACH_STORIES[key] ?? null;
}
