import type { Beach, LanguageCode } from '../types';
import { WindDirection } from '../types';
import { getRegionUrlSlug, getBeachLocalePrefix } from './beachUrls';

/**
 * Clickable links to the per-island "best X beaches" guide articles that are
 * pre-rendered by scripts/prerenderBeachPages.mjs. The app itself has no route
 * for these pages, so the links are plain <a href> that do a full navigation to
 * the static article. Topics, predicates and the ≥5 gate MUST stay in sync with
 * `islandIntents` / `ISLAND_INTENT_MIN` in the prerender script, and the URL
 * shape mirrors `islandIntentPath` + `localizedPath` there.
 */

const NORTHERLY: WindDirection[] = [WindDirection.N, WindDirection.NE, WindDirection.NW];
const WESTERLY: WindDirection[] = [WindDirection.W, WindDirection.NW, WindDirection.SW];
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
    match: beach => Array.isArray(beach.protectedFrom) && NORTHERLY.some(d => beach.protectedFrom.includes(d)),
    label: { en: 'Sheltered (Meltemi)', gr: 'Απάνεμες (μελτέμι)', de: 'Windgeschützt', fr: 'Abritées (meltemi)', it: 'Riparate (meltemi)' },
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
    match: beach => Array.isArray(beach.orientation?.faces) && WESTERLY.some(d => beach.orientation!.faces.includes(d)),
    label: { en: 'Sunset', gr: 'Για ηλιοβασίλεμα', de: 'Sonnenuntergang', fr: 'Coucher de soleil', it: 'Tramonto' },
  },
];

export interface IslandGuideLink {
  key: string;
  href: string;
  label: string;
}

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
  return GUIDE_TOPICS
    .filter(topic => beaches.filter(topic.match).length >= ISLAND_INTENT_MIN)
    .map(topic => ({
      key: topic.key,
      href: `${prefix}${topic.pathPrefix}/${encodeURIComponent(slug)}/`,
      label: topic.label[language] || topic.label.en,
    }));
};
