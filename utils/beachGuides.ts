import type { Beach, LanguageCode } from '../types';
import { getRegionUrlSlug, getBeachLocalePrefix } from './beachUrls';
import { isSunsetFacingBeach } from './beachOrientation';

/**
 * Clickable links to the per-island "best X beaches" guide articles that are
 * pre-rendered by scripts/prerenderBeachPages.mjs. The app itself has no route
 * for these pages, so the links are plain <a href> that do a full navigation to
 * the static article. Topics, predicates and the ≥5 gate MUST stay in sync with
 * `islandIntents` / `ISLAND_INTENT_MIN` in the prerender script, and the URL
 * shape mirrors `islandIntentPath` + `localizedPath` there.
 */

const ISLAND_INTENT_MIN = 5;

type LocalizedLabel = Record<LanguageCode, string>;

interface GuideTopic {
  key: string;
  pathPrefix: string;
  match: (beach: Beach) => boolean;
  /** The chip form — an adjective on its own ("Wind-sheltered"). Used where the
   *  surrounding UI already says "guides", e.g. the island page's guide row. */
  label: LocalizedLabel;
  /** The article form — a headline that stands alone ("Wind-sheltered beaches").
   *  A surface that must read as a LIST OF ARTICLES needs this, not `label`:
   *  bare adjectives beside a place name ("Wind-sheltered · Naxos") read as
   *  filter pills, which is exactly how the landing block was misread. */
  articleLabel: LocalizedLabel;
}

const GUIDE_TOPICS: GuideTopic[] = [
  {
    key: 'sheltered',
    pathPrefix: '/sheltered-beaches',
    // Single source: the baked, curated-aware, context-specific flag (meltemi /
    // maistros). Matches the sheltered guide the prerender actually publishes.
    match: beach => beach.shelteredFromLocalWind === true,
    label: { en: 'Wind-sheltered', gr: 'Απάνεμες', de: 'Windgeschützt', fr: 'Abritées du vent', it: 'Riparate dal vento' },
    articleLabel: { en: 'Wind-sheltered beaches', gr: 'Απάνεμες παραλίες', de: 'Windgeschützte Strände', fr: 'Plages abritées du vent', it: 'Spiagge riparate dal vento' },
  },
  {
    key: 'family',
    pathPrefix: '/family-beaches',
    match: beach => beach.environment?.familyFriendly === true,
    label: { en: 'Family beaches', gr: 'Οικογενειακές', de: 'Familienstrände', fr: 'Plages familiales', it: 'Per famiglie' },
    articleLabel: { en: 'Family beaches', gr: 'Οικογενειακές παραλίες', de: 'Familienstrände', fr: 'Plages familiales', it: 'Spiagge per famiglie' },
  },
  {
    key: 'snorkeling',
    pathPrefix: '/snorkeling-beaches',
    match: beach => beach.activities?.snorkeling === true,
    label: { en: 'Snorkeling', gr: 'Για snorkeling', de: 'Schnorcheln', fr: 'Snorkeling', it: 'Snorkeling' },
    articleLabel: { en: 'Snorkeling beaches', gr: 'Παραλίες για snorkeling', de: 'Strände zum Schnorcheln', fr: 'Plages pour le snorkeling', it: 'Spiagge per lo snorkeling' },
  },
  {
    key: 'organized',
    pathPrefix: '/organized-beaches',
    match: beach => beach.amenities?.organized === true,
    label: { en: 'Organized', gr: 'Οργανωμένες', de: 'Organisiert', fr: 'Aménagées', it: 'Attrezzate' },
    articleLabel: { en: 'Organized beaches', gr: 'Οργανωμένες παραλίες', de: 'Organisierte Strände', fr: 'Plages aménagées', it: 'Spiagge attrezzate' },
  },
  {
    key: 'secluded',
    pathPrefix: '/secluded-beaches',
    match: beach => beach.environment?.remote === true,
    label: { en: 'Secluded', gr: 'Απομονωμένες', de: 'Abgelegen', fr: 'Isolées', it: 'Isolate' },
    articleLabel: { en: 'Secluded beaches', gr: 'Απομονωμένες παραλίες', de: 'Abgelegene Strände', fr: 'Plages isolées', it: 'Spiagge isolate' },
  },
  {
    key: 'sunset',
    pathPrefix: '/sunset-beaches',
    match: isSunsetFacingBeach,
    label: { en: 'Sunset', gr: 'Για ηλιοβασίλεμα', de: 'Sonnenuntergang', fr: 'Coucher de soleil', it: 'Tramonto' },
    articleLabel: { en: 'Sunset beaches', gr: 'Παραλίες για ηλιοβασίλεμα', de: 'Strände für den Sonnenuntergang', fr: 'Plages pour le coucher de soleil', it: 'Spiagge per il tramonto' },
  },
  // Added 16/08/2026. Both answer demand that Search Console showed us losing
  // outright: "sandy" queries earned 168 impressions and ZERO clicks in the 28
  // days to 13/08, "beach bar" 111 and ZERO, because they landed on individual
  // beach pages with no list page to answer "which beaches HERE have this".
  // Predicates must stay identical to `islandIntents` in the prerender script.
  {
    key: 'sandy',
    pathPrefix: '/sandy-beaches',
    // 'sandy' only — a sand-and-pebble shore is what this searcher is avoiding.
    match: beach => beach.beachType === 'sandy',
    label: { en: 'Sandy', gr: 'Με άμμο', de: 'Sandstrände', fr: 'De sable', it: 'Di sabbia' },
    articleLabel: { en: 'Sandy beaches', gr: 'Παραλίες με άμμο', de: 'Sandstrände', fr: 'Plages de sable', it: 'Spiagge di sabbia' },
  },
  {
    key: 'beachbar',
    pathPrefix: '/beach-bars',
    // A bar ON the beach — deliberately not taverna/restaurant, which answer a
    // different question ("food nearby" rather than "a drink without leaving").
    match: beach => beach.amenities?.beachBar === true,
    label: { en: 'Beach bars', gr: 'Με beach bar', de: 'Mit Beachbar', fr: 'Avec bar', it: 'Con beach bar' },
    articleLabel: { en: 'Beaches with a beach bar', gr: 'Παραλίες με beach bar', de: 'Strände mit Beachbar', fr: 'Plages avec bar de plage', it: 'Spiagge con beach bar' },
  },
];

/**
 * Where a guide link should actually point.
 *
 * These articles are PRERENDERED FILES, not app routes — under `vite dev` they
 * do not exist on disk, and the dev server answers any unknown path with the SPA
 * shell. So a relative href in development does not 404 (which would at least be
 * obvious): it silently boots the app and lands you back on the home page, which
 * reads as a broken link with no clue why. Pointing dev at the live URL is the
 * only honest option, and `external` says so out loud so the caller can add
 * target/rel rather than navigating the dev tab away.
 *
 * Production and the bundled native app keep the relative path — it works
 * offline and never leaves the origin.
 */
export const resolveGuideHref = (path: string): { href: string; external: boolean } => {
  const external = import.meta.env.DEV;
  return { href: external ? `https://calmbeach.gr${path}` : path, external };
};

export interface IslandGuideLink {
  key: string;
  href: string;
  label: string;
  /** True only under `vite dev`, where `href` is absolute — see resolveGuideHref. */
  external: boolean;
}

/**
 * The topic list, exposed for surfaces that link a guide WITHOUT having that
 * region's beaches loaded — the national landing being the only one today. They
 * cannot run the ≥5 predicate gate above (it needs the beach records), so they
 * must instead name a curated pair that a build gate proves exists; see
 * utils/landingGuideLinks.ts and scripts/validateLandingGuideLinks.mjs.
 *
 * Exposed as a lookup rather than the array so nobody is tempted to iterate it
 * and hand-build every topic × region URL: most of those pages do not exist.
 */
export const GUIDE_TOPIC_BY_KEY: Readonly<Record<string, { pathPrefix: string; label: LocalizedLabel; articleLabel: LocalizedLabel }>> =
  Object.freeze(Object.fromEntries(
    GUIDE_TOPICS.map(topic => [topic.key, { pathPrefix: topic.pathPrefix, label: topic.label, articleLabel: topic.articleLabel }]),
  ));

/**
 * The national guides hub — the one page that collects every guide article.
 * Emitted by the prerender in en + el only (GUIDES_HUB_PATH there), so de/fr/it
 * readers get the English hub rather than a URL that was never written.
 */
export const GUIDES_HUB_LABEL: LocalizedLabel = {
  en: 'All beach guides',
  gr: 'Όλοι οι οδηγοί',
  de: 'Alle Strandführer',
  fr: 'Tous les guides',
  it: 'Tutte le guide',
};

export const getGuidesHubPath = (language: LanguageCode): string =>
  `${language === 'gr' ? '/el' : ''}/beach-guides/`;

/**
 * Where to actually point a link. Like the footer's FAQ link: the hub is a
 * prerendered page, so under `vite dev` the relative path silently falls back to
 * the SPA shell — open the live page instead. Prod and the bundled native app
 * keep the relative path (works offline). `external` is true only in dev.
 */
export const getGuidesHubLink = (language: LanguageCode): { href: string; external: boolean } =>
  resolveGuideHref(getGuidesHubPath(language));

/**
 * The guide articles available for an island, as clickable links — only topics
 * that clear the ≥5-beach gate (so we never link to a page that was not
 * generated). `regionId` is the beach's region id (e.g. "south-aegean-milos").
 */
export const getIslandGuideLinks = (
  beaches: Beach[] | undefined,
  regionId: string | undefined,
  language: LanguageCode,
): IslandGuideLink[] => {
  if (!regionId || !Array.isArray(beaches) || beaches.length === 0) return [];
  const slug = getRegionUrlSlug(regionId);
  const prefix = getBeachLocalePrefix(language, slug);
  const total = beaches.length;
  return GUIDE_TOPICS
    .filter(topic => {
      const matchCount = beaches.filter(topic.match).length;
      // 'sheltered' uses the same proportional gate as the prerender (a small
      // island with >=25% sheltered is useful), so the link and the page agree.
      if (topic.key === 'sheltered') return matchCount >= ISLAND_INTENT_MIN || (total > 0 && matchCount / total >= 0.25);
      return matchCount >= ISLAND_INTENT_MIN;
    })
    .map(topic => ({
      key: topic.key,
      ...resolveGuideHref(`${prefix}${topic.pathPrefix}/${encodeURIComponent(slug)}/`),
      label: topic.label[language] || topic.label.en,
    }));
};
