import type { Beach } from '../types';

/**
 * Curated editorial "get to know this beach" stories for the major beaches of
 * several Greek islands. Shown in the beach detail page (a "Πληροφορίες" section)
 * and baked into the static prerender for SEO (crawlable body + unique meta
 * description + JSON-LD) by scripts/prerenderBeachPages.mjs.
 *
 * SINGLE SOURCE OF TRUTH: the text lives in `beachStories.data.json`, shaped as
 * `{ [regionId]: { [beachId]: { title, paragraphs } } }`. The prerender script and
 * the audit scripts read that file directly; the client instead reads the per-region
 * split (data/beachStories/{regionId}.json, produced from it by
 * scripts/splitBeachStories.mjs) so it fetches only the island being viewed. Edit the
 * JSON, run `npm run build:beach-data` (or the split script) to regenerate, never
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

/** beachId → story (one region's slice of the corpus) */
type RegionStories = Record<number, BeachStory>;

// The editorial corpus is ~1.4 MB across ~788 stories. It is partitioned per region into
// data/beachStories/{regionId}.json (by scripts/splitBeachStories.mjs) so a detail-page
// visitor downloads ONLY the island they are viewing (≤130 KB, usually far less) instead of
// the whole country. Vite turns each glob entry into its own code-split async chunk; we cache
// the per-region promise so repeat views on the same island reuse the first fetch.
const regionStoryLoaders = import.meta.glob<{ default: RegionStories }>('./beachStories/*.json');
const regionStoriesCache = new Map<string, Promise<RegionStories | null>>();

const loadRegionStories = (region: string): Promise<RegionStories | null> => {
  const cached = regionStoriesCache.get(region);
  if (cached) return cached;

  const loader = regionStoryLoaders[`./beachStories/${region}.json`];
  // ΓΙΑΤΙ ΤΟ `mod &&` ΚΑΙ ΤΟ `.catch` (20/08/2026). Χωρίς αυτά, ένα κείμενο που δεν
  // κατέβηκε (κακό 4G) έβγαζε `undefined is not an object (evaluating 's.default')`
  // ως unhandled rejection — δηλαδή 🔴 «ΚΡΙΣΙΜΟ: έσπασε σελίδα» στο Telegram για μια
  // σελίδα που απλώς εμφανιζόταν χωρίς την παράγραφο «Πληροφορίες». Πραγματικό
  // περιστατικό: iPhone στο /beaches/chania/596-falasarna/.
  const promise: Promise<RegionStories | null> = loader
    ? loader()
        .then(mod => (mod ? (mod.default ?? (mod as unknown as RegionStories)) : null))
        .catch(() => {
          // Μην κρατάς αποτυχία στη μνήμη: η επόμενη επίσκεψη στο ίδιο νησί ξαναπροσπαθεί.
          regionStoriesCache.delete(region);
          return null;
        })
    : Promise.resolve(null);
  regionStoriesCache.set(region, promise);
  return promise;
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
  const regionStories = await loadRegionStories(region);
  if (!regionStories) return null;
  const key = beach.sourceBeachId ?? beach.id;
  return regionStories[key] ?? null;
}
