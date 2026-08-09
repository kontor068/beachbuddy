import type { Island, LanguageCode } from '../types';
import { GUIDE_TOPIC_BY_KEY, resolveGuideHref } from './beachGuides';
import { getBeachLocalePrefix } from './beachUrls';

/** Languages whose guide articles exist only for the multilingual-pilot regions. */
const PILOT_ONLY_LANGUAGES: ReadonlySet<LanguageCode> = new Set<LanguageCode>(['de', 'fr', 'it']);

/**
 * The national landing's links into the guide articles.
 *
 * WHY A CURATED LIST AND NOT getIslandGuideLinks(). That helper decides which
 * guides exist by running the topic predicates over a region's beach records —
 * which the landing does not load and must not start loading for the sake of six
 * links. So the pairs are named here and PROVEN by a build gate
 * (scripts/validateLandingGuideLinks.mjs, in the critical set) that checks the
 * generated file exists in dist for every language. A pair that stops being
 * generated turns the gate red instead of shipping a 404.
 *
 * WHY THESE SIX. Five of the six regions are already on this page in the region
 * band, so the links read as a second way into places the visitor just saw
 * rather than as an unrelated ad. The two exceptions are the two guides our own
 * Search Console data shows actually earn clicks — family/Evia and
 * snorkeling/Halkidiki — which is also why those two topics are paired with
 * those regions and not with a prettier island.
 *
 * ONE TOPIC EACH, NEVER REPEATED: the point of this block is to show that the
 * site answers "what kind of beach", so six different questions beat six
 * different islands.
 *
 * THE SLUG IS WRITTEN OUT, not derived. getRegionUrlSlug(regionId) normalises
 * the ID while the prerender normalises `region.name.en`, and across the 110
 * regions those disagree on exactly one — Pelion, where the ID route yields
 * `magnesia-mainland-pelion` and the page on disk is `magnesia-pelion`. Deriving
 * it here would work for five of six pairs and 404 on the sixth the day someone
 * adds Pelion. The gate checks the literal string against the built files.
 */

export interface LandingGuidePair {
  /** Key into GUIDE_TOPIC_BY_KEY — supplies the path prefix and the 5 labels. */
  topic: string;
  /** Region id as it appears in public/data/beaches/index.json and in Island.id. */
  regionId: string;
  /** The region slug AS BUILT ON DISK. Verified by the gate, never derived. */
  slug: string;
}

export const LANDING_GUIDE_PAIRS: ReadonlyArray<LandingGuidePair> = [
  { topic: 'sheltered', regionId: 'south-aegean-naxos', slug: 'naxos' },
  { topic: 'family', regionId: 'central-greece-evia', slug: 'evia' },
  { topic: 'snorkeling', regionId: 'central-macedonia-halkidiki-mainland', slug: 'halkidiki' },
  { topic: 'organized', regionId: 'south-aegean-rhodes', slug: 'rhodes' },
  { topic: 'secluded', regionId: 'ionian-islands-corfu', slug: 'corfu' },
  { topic: 'sunset', regionId: 'ionian-islands-lefkada', slug: 'lefkada' },
];

export interface LandingGuideLink {
  key: string;
  href: string;
  /** True only under `vite dev`, where `href` is absolute — see resolveGuideHref. */
  external: boolean;
  /** "Wind-sheltered beaches in Naxos" — the article's headline, as one phrase. */
  articleTitle: string;
  /** "Naxos" — the place alone, for surfaces that label the destination. */
  regionLabel: string;
}

/**
 * "…in Naxos", the plain way each language attaches a place to a headline.
 *
 * Only the four island-safe prepositions appear here because that is all these
 * pairs can ever produce: de/fr/it drop any region outside the multilingual
 * pilot (see below), and every pilot region is an island, so "auf Naxos" /
 * "à Naxos" / "a Naxos" are correct. English uses "in", matching the wording the
 * prerendered articles themselves use ("Beaches in Naxos").
 */
const WHERE_PHRASE: Record<LanguageCode, (name: string) => string> = {
  en: name => `in ${name}`,
  gr: name => `στη ${name}`,
  de: name => `auf ${name}`,
  fr: name => `à ${name}`,
  it: name => `a ${name}`,
};

/**
 * Greek is the one language here that inflects the place name, and no generic
 * rule gets it right — «στη Νάξο» but «στην Εύβοια», «στη Ρόδο» not «στη Ρόδος».
 * Six curated pairs mean six written-out forms; the fallback above keeps a newly
 * added pair readable (slightly wrong, never broken) until its form is added.
 */
const GREEK_WHERE_BY_SLUG: Readonly<Record<string, string>> = {
  naxos: 'στη Νάξο',
  evia: 'στην Εύβοια',
  halkidiki: 'στη Χαλκιδική',
  rhodes: 'στη Ρόδο',
  corfu: 'στην Κέρκυρα',
  lefkada: 'στη Λευκάδα',
};

/**
 * de/fr/it only have guide pages for the multilingual-pilot regions, and the
 * pairs above deliberately include two that are not in it — family/Evia and
 * snorkeling/Halkidiki — because those are the two guides Search Console shows
 * actually earning clicks.
 *
 * For those three languages, the pair is DROPPED rather than pointed at the
 * English article. getBeachLocalePrefix would happily fall back to the
 * unprefixed URL and the page would load, so nothing would break — but a German
 * visitor would be reading a label in German ("Familienstrände · Euböa") that
 * opens an English page, which is a worse promise than one fewer link. The four
 * pilot pairs survive and still cover four different questions.
 *
 * The hub link below the list is the opposite call and stays as it is: it exists
 * in en+el only and getGuidesHubPath sends everyone else to English, which is
 * defensible for a "see everything" link in a way it is not for a specific
 * article promised in your own language.
 */
export const getLandingGuideLinks = (
  allIslands: ReadonlyArray<Island> | undefined,
  language: LanguageCode,
): LandingGuideLink[] => {
  if (!Array.isArray(allIslands) || allIslands.length === 0) return [];

  return LANDING_GUIDE_PAIRS.flatMap(pair => {
    // Empty prefix in a pilot-only language means this region has no article in
    // that language — the same test getBeachLocalePrefix itself applies, so the
    // two can never disagree about which regions are localized.
    if (PILOT_ONLY_LANGUAGES.has(language) && getBeachLocalePrefix(language, pair.slug) === '') return [];

    const topic = GUIDE_TOPIC_BY_KEY[pair.topic];
    const island = allIslands.find(candidate => candidate.id === pair.regionId);
    // A region missing from the loaded index means the link cannot be labelled,
    // and an unlabelled link is worse than one fewer link.
    if (!topic || !island) return [];

    const prefix = getBeachLocalePrefix(language, pair.slug);
    const regionLabel = island.name[language] || island.name.en;
    const where = language === 'gr'
      ? (GREEK_WHERE_BY_SLUG[pair.slug] || WHERE_PHRASE.gr(regionLabel))
      : WHERE_PHRASE[language](regionLabel);
    return [{
      key: `${pair.topic}:${pair.slug}`,
      // Prerendered files, not app routes: under `vite dev` a relative path here
      // silently reboots the SPA and dumps you back on the landing, which reads
      // as a dead link. resolveGuideHref sends dev at the live URL instead.
      ...resolveGuideHref(`${prefix}${topic.pathPrefix}/${pair.slug}/`),
      articleTitle: `${topic.articleLabel[language] || topic.articleLabel.en} ${where}`,
      regionLabel,
    }];
  });
};
