import type { FilterKey, LanguageCode } from '../types';
import { normalizeSearchText } from './searchNormalize';

/**
 * Free-text search words that "snap" onto a filter. Used when a home-directory query
 * carries an intent word ("ηλιοβασίλεμα", "παιδικές", "με beach bar") on top of — or
 * instead of — a place name: rather than run it as a beach-name search that matches
 * nothing, we apply the matching filter(s) to the target region's list.
 *
 * Matching is TOKEN + PREFIX based (a query word must START with a stem), not raw
 * substring, and the caller strips the matched region/island name first (see `ignore`).
 * Together these stop place names from tripping a filter — e.g. "Σκιάθος" would contain
 * «σκια» (shade), "Βαθύ" «βαθ» (deep), "Μπαρμπάτι" «bar» — all defused because the name
 * token is removed and the stem must anchor at a word start.
 *
 * Targets are restricted to FilterKeys that exist in t.filterOptions, so every applied
 * filter renders with a label and is a valid mobile filter key. Stems are pre-normalized
 * (accent-stripped, lowercased) to match normalizeSearchText(); Greek roots are given as
 * stems so inflections resolve (παιδιά/παιδικές → «παιδι», ξαπλώστρες → «ξαπλωστρ»).
 */
interface SearchIntentRule {
  filter: FilterKey;
  stems: string[];
}

const SEARCH_INTENT_RULES: SearchIntentRule[] = [
  // sunset (en) · ηλιοβασίλεμα (gr) · sonnenuntergang (de) · coucher (fr) · tramonto (it)
  { filter: 'sunset', stems: ['ηλιοβασιλ', 'sunset', 'sonnenunter', 'coucher', 'tramonto'] },
  // kids / children / family · παιδιά / οικογένεια · famille / familie / famiglia
  { filter: 'familyFriendly', stems: ['παιδι', 'οικογεν', 'kid', 'child', 'famil', 'famigl'] },
  { filter: 'snorkeling', stems: ['σνορκελ', 'καταδ', 'snorkel', 'diving', 'schnorchel'] },
  { filter: 'beachBar', stems: ['μπαρ', 'bar'] },
  { filter: 'taverna', stems: ['ταβερν', 'φαγητ', 'εστιατ', 'taverna', 'tavern', 'food', 'restaurant'] },
  { filter: 'sunbeds', stems: ['ξαπλωστρ', 'ομπρελ', 'οργανωμ', 'sunbed', 'umbrella', 'organiz'] },
  { filter: 'parking', stems: ['παρκιν', 'σταθμευ', 'parking'] },
  { filter: 'naturalShade', stems: ['σκια', 'σκιερ', 'δεντρ', 'shade', 'shady'] },
  { filter: 'quiet', stems: ['ησυχ', 'ηρεμ', 'quiet'] },
  { filter: 'sandy', stems: ['αμμ', 'sand'] },
  { filter: 'pebbles', stems: ['βοτσαλ', 'pebble'] },
  { filter: 'rocky', stems: ['βραχ', 'rocky'] },
  { filter: 'adventure', stems: ['δυσβατ', 'απροσιτ', 'adventure'] },
  // naturist / nudist — only ever triggered by an explicit search for these; the beaches are
  // otherwise never surfaced proactively (see utils/naturistBeaches.ts).
  { filter: 'naturist', stems: ['γυμνιστ', 'nudist', 'naturist', 'fkk'] },
  { filter: 'deepWaters', stems: ['βαθ', 'deep'] },
  { filter: 'shallowWaters', stems: ['ρηχ', 'shallow'] },
  { filter: 'easyAccess', stems: ['ευκολ', 'easy'] },
  { filter: 'disabledAccess', stems: ['αμεα', 'προσβασιμ', 'αναπηρ', 'wheelchair', 'disabled', 'accessible'] },
];

const tokenize = (value: string): string[] => normalizeSearchText(value).split(' ').filter(Boolean);

/**
 * The filter keys a free-text query maps to, in rule order. `ignore` is any place name(s)
 * already resolved from the query (the matched region/island) — their tokens are dropped
 * before matching so "Νάξος ηλιοβασίλεμα" yields [sunset], and "Σκιάθος" alone yields [].
 * Empty when the residual query carries no recognised intent word.
 */
export const detectSearchIntentFilters = (query: string, ignore: string[] = []): FilterKey[] => {
  const ignoreTokens = new Set(ignore.flatMap(tokenize));
  const tokens = tokenize(query).filter(token => !ignoreTokens.has(token));
  if (tokens.length === 0) return [];

  const matched: FilterKey[] = [];
  for (const rule of SEARCH_INTENT_RULES) {
    if (tokens.some(token => rule.stems.some(stem => token.startsWith(stem)))) {
      matched.push(rule.filter);
    }
  }
  return matched;
};

/**
 * A named intent that switches on SEVERAL filters at once — the "story" form of the
 * filter strip. The rules above are deliberately one word → one filter, because a typed
 * word must mean exactly what it says; a bundle is the opposite contract: the user picks
 * a ready-made situation and we decide what that situation is made of.
 *
 * WHY THESE THREE, AND WHY THESE INGREDIENTS. Measured on our own Search Console queries
 * (06/07–02/08/2026, 2.754 queries, reports/snapshots/_raw-queries.json): only 4 queries
 * in 2.754 carried two attributes at once. People search «τόπος + ΜΙΑ λέξη», and the
 * three words with real volume are children (560 impressions), snorkeling (467) and
 * organised (287). So a bundle is named after the ONE word that is searched, and the
 * combination hides behind it — never the other way round.
 *
 * The ingredients were then measured against the built data (2.854 beaches / 110 regions)
 * rather than chosen by taste, because an AND of filters empties fast:
 *   family   shallow+sandy+easy      → 1.018 beaches, empty in 20 of 110 regions
 *            (+ sunbeds)             →   628 beaches, empty in 37 — dropped for that reason
 *   organized sunbeds+parking        →   778 beaches, empty in 32
 *   snorkeling                       →   743 beaches, empty in 16
 * The "quiet + food" shape this feature was first imagined as measured 133 beaches and
 * was empty in 51 of 110 regions; adding family to it left 42 beaches and ZERO in 81 of
 * 110. Those two wishes fight each other, so no bundle offers them together.
 *
 * The empty regions are why every caller MUST count before rendering: a bundle chip with
 * no beaches behind it is worse than no chip, so the count is computed against the real
 * pool with the real predicate and the chip is dropped at 0 (see App.tsx).
 */
export interface SearchIntentBundle {
  key: string;
  /** ANDed by the normal filter engine — no new matching logic, so a bundle can never
   *  surface a beach that the equivalent hand-picked chips would not. */
  filters: FilterKey[];
  label: Record<LanguageCode, string>;
}

export const SEARCH_INTENT_BUNDLES: readonly SearchIntentBundle[] = [
  {
    key: 'family',
    filters: ['shallowWaters', 'sandy', 'easyAccess'],
    label: {
      gr: 'Για παιδιά',
      en: 'For kids',
      de: 'Für Kinder',
      fr: 'Pour les enfants',
      it: 'Per bambini',
    },
  },
  {
    key: 'organized',
    filters: ['sunbeds', 'parking'],
    label: {
      gr: 'Οργανωμένες',
      en: 'Organized',
      de: 'Organisiert',
      fr: 'Aménagées',
      it: 'Attrezzate',
    },
  },
  {
    key: 'snorkeling',
    filters: ['snorkeling'],
    label: {
      gr: 'Για snorkeling',
      en: 'For snorkeling',
      de: 'Zum Schnorcheln',
      fr: 'Pour le snorkeling',
      it: 'Per lo snorkeling',
    },
  },
];
