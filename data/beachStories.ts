import type { Beach } from '../types';
import storiesData from './beachStories.data.json';

/**
 * Curated editorial "get to know this beach" stories for the major beaches of
 * several Greek islands. Shown in the beach detail page (a "Πληροφορίες" section)
 * and baked into the static prerender for SEO (crawlable body + unique meta
 * description + JSON-LD) by scripts/prerenderBeachPages.mjs.
 *
 * SINGLE SOURCE OF TRUTH: the text lives in `beachStories.data.json`, shaped as
 * `{ [regionId]: { [beachId]: { title, paragraphs } } }`, so both this runtime
 * module and the prerender script read the same data. Edit the JSON, never
 * duplicate the text here.
 *
 * Beach ids are unique only WITHIN a region, so stories are scoped by region id
 * (e.g. "south-aegean-milos", "south-aegean-santorini"). Content is written in
 * Greek (`gr`, primary audience) + English (`en`); other locales get no story.
 * Facts were research-checked — etymologies and legends are presented as the
 * local tradition they are, and contested figures are hedged.
 */

type StoryLocale = 'gr' | 'en';

export interface BeachStory {
  /** Short evocative subtitle shown under the section heading. */
  title: Record<StoryLocale, string>;
  /** Ordered narrative paragraphs. */
  paragraphs: Record<StoryLocale, string[]>;
}

/** regionId → beachId → story */
export const BEACH_STORIES = storiesData as unknown as Record<string, Record<number, BeachStory>>;

/**
 * Returns the curated story for a beach, scoped to its region (ids are unique
 * only within a region). Pass the region id explicitly; falls back to the
 * beach's own `regionId` (set in the merged cross-region "Κοντά μου" view).
 * Uses `sourceBeachId ?? id` so it also resolves merged-view beaches.
 */
export function getBeachStory(
  beach: Pick<Beach, 'id' | 'regionId' | 'sourceBeachId'>,
  regionId?: string,
): BeachStory | null {
  const region = regionId ?? beach.regionId;
  if (!region) return null;
  const regionStories = BEACH_STORIES[region];
  if (!regionStories) return null;
  const key = beach.sourceBeachId ?? beach.id;
  return regionStories[key] ?? null;
}
