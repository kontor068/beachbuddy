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
  label: LocalizedLabel;
}

const GUIDE_TOPICS: GuideTopic[] = [
  {
    key: 'sheltered',
    pathPrefix: '/sheltered-beaches',
    // Single source: the baked, curated-aware, context-specific flag (meltemi /
    // maistros). Matches the sheltered guide the prerender actually publishes.
    match: beach => beach.shelteredFromLocalWind === true,
    label: { en: 'Wind-sheltered', gr: 'Απάνεμες', de: 'Windgeschützt', fr: 'Abritées du vent', it: 'Riparate dal vento' },
  },
  {
    key: 'family',
    pathPrefix: '/family-beaches',
    match: beach => beach.environment?.familyFriendly === true,
    label: { en: 'Family beaches', gr: 'Οικογενειακές', de: 'Familienstrände', fr: 'Plages familiales', it: 'Per famiglie' },
  },
  {
    key: 'snorkeling',
    pathPrefix: '/snorkeling-beaches',
    match: beach => beach.activities?.snorkeling === true,
    label: { en: 'Snorkeling', gr: 'Για snorkeling', de: 'Schnorcheln', fr: 'Snorkeling', it: 'Snorkeling' },
  },
  {
    key: 'organized',
    pathPrefix: '/organized-beaches',
    match: beach => beach.amenities?.organized === true,
    label: { en: 'Organized', gr: 'Οργανωμένες', de: 'Organisiert', fr: 'Aménagées', it: 'Attrezzate' },
  },
  {
    key: 'secluded',
    pathPrefix: '/secluded-beaches',
    match: beach => beach.environment?.remote === true,
    label: { en: 'Secluded', gr: 'Απομονωμένες', de: 'Abgelegen', fr: 'Isolées', it: 'Isolate' },
  },
  {
    key: 'sunset',
    pathPrefix: '/sunset-beaches',
    match: isSunsetFacingBeach,
    label: { en: 'Sunset', gr: 'Για ηλιοβασίλεμα', de: 'Sonnenuntergang', fr: 'Coucher de soleil', it: 'Tramonto' },
  },
];

export interface IslandGuideLink {
  key: string;
  href: string;
  label: string;
}

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
export const getGuidesHubLink = (language: LanguageCode): { href: string; external: boolean } => {
  const path = getGuidesHubPath(language);
  const external = import.meta.env.DEV;
  return { href: external ? `https://calmbeach.gr${path}` : path, external };
};

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
      href: `${prefix}${topic.pathPrefix}/${encodeURIComponent(slug)}/`,
      label: topic.label[language] || topic.label.en,
    }));
};
