import type { Beach } from '../types';

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
type StoriesByRegion = Record<string, Record<number, BeachStory>>;

// The editorial corpus is ~1.6 MB. A static import bundled the whole thing into the eager
// beach-detail chunk (it dominated it), so every visitor downloaded all ~788 stories just to
// view one beach. Load it lazily on first request — a code-split async chunk — and cache the
// promise, so the detail page paints immediately and the "Πληροφορίες" text streams in after.
let storiesPromise: Promise<StoriesByRegion> | null = null;
const loadStories = (): Promise<StoriesByRegion> => {
  if (!storiesPromise) {
    storiesPromise = import('./beachStories.data.json')
      .then(mod => ((mod as { default?: unknown }).default ?? mod) as StoriesByRegion);
  }
  return storiesPromise;
};

/**
 * Returns the curated story for a beach (or null), scoped to its region (ids are unique only
 * within a region). ASYNC: the ~1.6 MB corpus is lazy-loaded and cached on first call so it
 * stays out of the eager detail-page bundle. Pass the region id explicitly; falls back to the
 * beach's own `regionId` (set in the merged cross-region "Κοντά μου" view). Uses
 * `sourceBeachId ?? id` so it also resolves merged-view beaches.
 */
export async function getBeachStory(
  beach: Pick<Beach, 'id' | 'regionId' | 'sourceBeachId'>,
  regionId?: string,
): Promise<BeachStory | null> {
  const region = regionId ?? beach.regionId;
  if (!region) return null; // cheap out before pulling the async corpus
  const stories = await loadStories();
  const regionStories = stories[region];
  if (!regionStories) return null;
  const key = beach.sourceBeachId ?? beach.id;
  return regionStories[key] ?? null;
}
