import type { FilterKey } from '../types';
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
