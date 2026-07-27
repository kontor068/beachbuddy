import type { FilterKey, Island, LanguageCode } from '../types';
import { fuzzySearchScore, isGenericSearchWord, normalizeSearchText } from './searchNormalize';
import { detectSearchIntentFilters } from './searchIntent';

/**
 * TRIP QUERY PARSER — «θα μείνω Νάξο για 5 μέρες» → { region: Naxos, days: 5 }.
 *
 * WHY THIS IS NOT findSearchRegionMatch. That one (App.tsx) scores the WHOLE
 * trimmed query against a region's names and needs >= 90. On a sentence that is
 * hopeless: normalized «θα μεινω ναξο για 5 μερες» neither contains nor is
 * contained by «ναξος», and fuzzySearchScore's inflection branch requires EVERY
 * query word to match a value word. Measured: far below the gate. So this parser
 * scores PER TOKEN WINDOW instead, which is a different and much sharper knife —
 * and therefore needs its own, stricter safety rails. They are all below.
 *
 * WHY ITS OWN FILE. The only test harness this repo has is scripts/*.mjs via a
 * ts.transpileModule require hook. A function inside the 6,200-line App.tsx is
 * unreachable from there. Everything here is pure and React-free on purpose.
 *
 * DO NOT extend utils/searchParser.ts or services/aiAdvisorService.ts — both are
 * abandoned English-only parsers with zero live callers. A second parser next to
 * this one guarantees someone edits the wrong file.
 */

/** Words that carry no place meaning. Scoring these is what makes «θα» match Θάσος. */
const STOPWORDS = new Set([
  // gr — articles, prepositions, the stay verbs, connectors
  'θα', 'να', 'σε', 'στη', 'στην', 'στο', 'στον', 'στους', 'στις', 'στα',
  'για', 'με', 'και', 'κι', 'απο', 'ως', 'εως', 'μεχρι', 'παμε', 'παω',
  'μεινω', 'μεινουμε', 'μενω', 'μενουμε', 'ειμαι', 'ειμαστε', 'θελω', 'θελουμε',
  'ταξιδι', 'διακοπες', 'επισκεψη', 'ενα', 'μια', 'ο', 'η', 'το', 'οι', 'τα', 'του', 'της', 'των',
  // en
  'i', 'im', 'am', 'is', 'are', 'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for',
  'and', 'or', 'of', 'my', 'we', 'will', 'be', 'going', 'go', 'stay', 'staying',
  'visit', 'visiting', 'trip', 'holiday', 'holidays', 'vacation', 'spend', 'spending',
  // de
  'ich', 'wir', 'bin', 'sind', 'bleibe', 'bleiben', 'fahre', 'fahren', 'nach', 'auf',
  'fur', 'und', 'oder', 'urlaub', 'reise', 'tage', 'einen', 'eine', 'ein', 'der', 'die', 'das',
  // fr
  'je', 'nous', 'reste', 'restons', 'vais', 'allons', 'a', 'au', 'aux', 'dans',
  'pour', 'et', 'ou', 'de', 'des', 'du', 'la', 'le', 'les', 'un', 'une', 'vacances', 'sejour',
  // it
  'io', 'noi', 'resto', 'restiamo', 'vado', 'andiamo', 'sto', 'stiamo',
  'per', 'e', 'il', 'lo', 'gli', 'da', 'in', 'vacanza', 'viaggio',
]);

/** number word → value, all five languages. 1–14 covers every realistic stay. */
const NUMBER_WORDS = new Map<string, number>([
  ['μια', 1], ['μία', 1], ['ενα', 1], ['μονο', 1],
  ['δυο', 2], ['δυό', 2], ['τρεις', 3], ['τρια', 3], ['τεσσερις', 4], ['τεσσερα', 4],
  ['πεντε', 5], ['εξι', 6], ['επτα', 7], ['εφτα', 7], ['οκτω', 8], ['οχτω', 8],
  ['εννεα', 9], ['εννια', 9], ['δεκα', 10], ['εντεκα', 11], ['δωδεκα', 12],
  ['δεκατρεις', 13], ['δεκατεσσερις', 14],
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5], ['six', 6],
  ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10], ['eleven', 11], ['twelve', 12],
  ['eins', 1], ['zwei', 2], ['drei', 3], ['vier', 4], ['funf', 5], ['sechs', 6],
  ['sieben', 7], ['acht', 8], ['neun', 9], ['zehn', 10],
  ['deux', 2], ['trois', 3], ['quatre', 4], ['cinq', 5], ['sept', 7], ['huit', 8], ['neuf', 9], ['dix', 10],
  ['due', 2], ['tre', 3], ['quattro', 4], ['cinque', 5], ['sei', 6], ['sette', 7], ['otto', 8], ['nove', 9], ['dieci', 10],
]);

/** Duration units, with the multiplier applied to an adjacent number. */
const DURATION_UNITS = new Map<string, number>([
  // days
  ['μερα', 1], ['μερες', 1], ['ημερα', 1], ['ημερες', 1], ['μερεσ', 1],
  ['day', 1], ['days', 1], ['tag', 1], ['tage', 1], ['tagen', 1],
  ['jour', 1], ['jours', 1], ['giorno', 1], ['giorni', 1],
  // nights — counted as-is, NOT n+1. We never invent a day nobody asked for.
  ['νυχτα', 1], ['νυχτες', 1], ['βραδια', 1], ['βραδυ', 1],
  ['night', 1], ['nights', 1], ['nacht', 1], ['nachte', 1],
  ['nuit', 1], ['nuits', 1], ['notte', 1], ['notti', 1],
  // weeks
  ['εβδομαδα', 7], ['εβδομαδες', 7], ['week', 7], ['weeks', 7],
  ['woche', 7], ['wochen', 7], ['semaine', 7], ['semaines', 7], ['settimana', 7], ['settimane', 7],
]);

/** Bare duration words that carry their own value with no number. */
const STANDALONE_DURATIONS = new Map<string, number>([
  ['σαββατοκυριακο', 2], ['weekend', 2], ['wochenende', 2], ['fine settimana', 2],
  ['δεκαπενθημερο', 15], ['τριημερο', 3], ['τετραημερο', 4], ['πενθημερο', 5],
]);

/**
 * Units that PROVE a nearby number is not a day count. Without these, "2 άτομα"
 * and "4 ώρες" would silently become a 2-day and a 4-day trip.
 */
const NEGATIVE_UNITS = new Set([
  'ατομα', 'ατομο', 'παιδια', 'ενηλικες', 'people', 'persons', 'person', 'adults', 'kids',
  'personen', 'personnes', 'persone', 'bambini', 'enfants',
  'ωρα', 'ωρες', 'hour', 'hours', 'stunden', 'heures', 'ore',
  'χλμ', 'km', 'μετρα', 'meters', 'metres', 'metri',
  'ευρω', 'euro', 'eur', 'αστερια', 'stars', 'sterne', 'etoiles', 'stelle',
  'βαθμοι', 'degrees', 'μποφορ', 'beaufort',
]);

/** Values that stop being a day count long before they stop being a number. */
const MIN_DAYS = 1;
const MAX_DAYS = 60;

/** Score a window must reach, by window shape. Derived from measurement — see the plan. */
const MIN_SCORE_SHORT = 96;   // <= 3 chars: Κως/Ίος/Κέα are exact hits; fuzzy here is noise
const MIN_SCORE_MULTI = 90;   // >= 2 tokens: «Ανατολική Αττική» = 100
const MIN_SCORE_SINGLE = 84;  // 1 token >= 4 chars: «Νάξο» = 92, «Νάξου» = 84
/** The winner must beat the best DIFFERENT region by this much, or it is ambiguous. */
const MIN_MARGIN = 8;

export interface TripQueryParse {
  /** Exactly one region cleared its threshold with margin. */
  region?: Island;
  /** Two or more tied. NEVER navigate on this — ask instead. */
  ambiguousRegions: Island[];
  /** Days exactly as the visitor stated them. NOT clamped to the forecast horizon. */
  requestedDays?: number;
  /** The query with the matched place and all duration/stop tokens removed. */
  residualQuery: string;
  /** Intent filters from the residual, via the existing detector. */
  filters: FilterKey[];
  /** True when a duration was stated — i.e. this reads as a trip sentence. */
  isTripSentence: boolean;
}

const EMPTY: TripQueryParse = {
  ambiguousRegions: [],
  residualQuery: '',
  filters: [],
  isTripSentence: false,
};

/**
 * A region's searchable names. Deliberately EXCLUDES island.id: with ids in the
 * pool «Ίο» scores 92 against Corfu and Paxos purely from the `ionian-islands-`
 * prefix, and «Κω» against Korinthia/Koufonisia. Names only.
 *
 * Parenthetical and dashed parts are also emitted separately, because «Πήλιο»
 * scores only 82 against «Μαγνησία (Πήλιο)» but 100 against the extracted part.
 */
const regionSearchNames = (island: Island, language: LanguageCode): string[] => {
  const raw = [
    island.name?.[language], island.name?.en, island.name?.gr,
    island.name?.fr, island.name?.de, island.name?.it,
  ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  const out = new Set<string>();
  for (const name of raw) {
    out.add(name);
    for (const part of name.split(/[()\-/,]/)) {
      const trimmed = part.trim();
      if (trimmed.length < 3) continue;
      const normalized = normalizeSearchText(trimmed);
      if (!normalized || normalized.split(' ').every(isGenericSearchWord)) continue;
      out.add(trimmed);
    }
  }
  return [...out];
};

type TokenKind = 'stop' | 'number' | 'digits' | 'unit' | 'negative' | 'generic' | 'content';

const classify = (token: string): TokenKind => {
  if (NEGATIVE_UNITS.has(token)) return 'negative';
  if (DURATION_UNITS.has(token) || STANDALONE_DURATIONS.has(token)) return 'unit';
  if (/^\d{1,3}$/.test(token)) return 'digits';
  if (NUMBER_WORDS.has(token)) return 'number';
  if (isGenericSearchWord(token)) return 'generic';
  if (STOPWORDS.has(token)) return 'stop';
  return 'content';
};

const numericValue = (token: string, kind: TokenKind): number | undefined => {
  if (kind === 'digits') return Number(token);
  if (kind === 'number') return NUMBER_WORDS.get(token);
  return undefined;
};

/**
 * Days from the token stream. THE RULE: a number counts only when a duration
 * unit sits within one token of it. That single constraint defuses every
 * numeric false positive at once — "Παραλία 100 Ρίζες" and "Dimotiki Plaz 2"
 * (both real beaches in the search index), "5 Αυγούστου", "5/8/2026" (the
 * slashes normalize to spaces), and dates generally.
 */
const extractDays = (tokens: string[], kinds: TokenKind[]): { days?: number; usedIndexes: Set<number> } => {
  const found: Array<{ value: number; indexes: number[] }> = [];

  for (let i = 0; i < tokens.length; i++) {
    if (kinds[i] !== 'unit') continue;
    const unitToken = tokens[i];

    // A neighbouring number, either side (Greek and English both occur).
    let numberIndex = -1;
    for (const candidate of [i - 1, i + 1]) {
      if (candidate < 0 || candidate >= tokens.length) continue;
      if (kinds[candidate] === 'digits' || kinds[candidate] === 'number') { numberIndex = candidate; break; }
    }

    // A negative unit anywhere adjacent poisons this number ("2 άτομα 5 μέρες"
    // still works — only the number touching the negative unit is rejected).
    if (numberIndex >= 0) {
      const poisoned = [numberIndex - 1, numberIndex + 1]
        .some(index => index >= 0 && index < tokens.length && kinds[index] === 'negative' && index !== i);
      if (poisoned) continue;
    }

    const standalone = STANDALONE_DURATIONS.get(unitToken);
    const multiplier = DURATION_UNITS.get(unitToken) ?? 1;

    if (numberIndex >= 0) {
      const raw = numericValue(tokens[numberIndex], kinds[numberIndex]);
      if (raw === undefined) continue;
      found.push({ value: raw * multiplier, indexes: [i, numberIndex] });
    } else if (standalone !== undefined) {
      found.push({ value: standalone, indexes: [i] });
    } else if (DURATION_UNITS.has(unitToken) && multiplier === 7) {
      // «μια εβδομάδα» with the article dropped, or a bare «εβδομάδα».
      found.push({ value: 7, indexes: [i] });
    }
  }

  if (found.length === 0) return { usedIndexes: new Set() };

  const values = [...new Set(found.map(entry => entry.value))];
  const usedIndexes = new Set(found.flatMap(entry => entry.indexes));

  // A range ("4-5 μέρες", "από 4 έως 6 μέρες") takes the LOWER bound: never
  // promise more days than they said they would certainly be there.
  // Two genuinely different counts with no range reading -> refuse to guess.
  let days: number | undefined;
  if (values.length === 1) {
    days = values[0];
  } else {
    const numberCount = kinds.filter(kind => kind === 'digits' || kind === 'number').length;
    days = numberCount >= 2 ? Math.min(...values) : undefined;
  }

  if (days === undefined || days < MIN_DAYS || days > MAX_DAYS) return { usedIndexes };
  return { days, usedIndexes };
};

interface WindowMatch {
  island: Island;
  score: number;
  start: number;
  length: number;
}

const thresholdFor = (windowText: string, tokenCount: number): number => {
  if (tokenCount >= 2) return MIN_SCORE_MULTI;
  return windowText.length <= 3 ? MIN_SCORE_SHORT : MIN_SCORE_SINGLE;
};

export const parseTripQuery = (
  query: string,
  islands: Island[],
  language: LanguageCode
): TripQueryParse => {
  const normalized = normalizeSearchText(query || '');
  if (!normalized) return { ...EMPTY };

  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length === 0) return { ...EMPTY };
  const kinds = tokens.map(classify);

  const { days, usedIndexes } = extractDays(tokens, kinds);

  // ── Place: score every n-gram window (n = 3, 2, 1) against every region ──
  const candidates: WindowMatch[] = [];
  for (let length = Math.min(3, tokens.length); length >= 1; length--) {
    for (let start = 0; start + length <= tokens.length; start++) {
      const indexes = Array.from({ length }, (_, offset) => start + offset);
      // A window must carry real content, and must not be built from the
      // duration phrase we already consumed.
      if (indexes.some(index => usedIndexes.has(index))) continue;
      const windowKinds = indexes.map(index => kinds[index]);
      if (!windowKinds.includes('content')) continue;
      if (length === 1 && windowKinds[0] !== 'content') continue;

      const windowText = indexes.map(index => tokens[index]).join(' ');
      const minScore = thresholdFor(windowText, length);

      for (const island of islands) {
        let best = 0;
        for (const name of regionSearchNames(island, language)) {
          const score = fuzzySearchScore(windowText, name);
          if (score > best) best = score;
        }
        if (best >= minScore) candidates.push({ island, score: best, start, length });
      }
    }
  }

  let region: Island | undefined;
  let ambiguousRegions: Island[] = [];
  let placeIndexes = new Set<number>();

  if (candidates.length > 0) {
    // Longest window first, then score. A longer name is a more specific claim:
    // «Ανατολική Αττική» must beat the bare «Ανατολική».
    candidates.sort((a, b) => b.length - a.length || b.score - a.score);
    const winner = candidates[0];

    // Margin against the best DIFFERENT region in the SAME window. This is what
    // catches «Ρόδο» — Rhodes 92 and Rodopi 92, margin 0.
    const sameWindowRival = candidates.find(entry =>
      entry.island.id !== winner.island.id && entry.start === winner.start && entry.length === winner.length);
    const marginOk = !sameWindowRival || winner.score - sameWindowRival.score >= MIN_MARGIN;

    // Two NON-OVERLAPPING windows resolving to different regions: «Πάρο ή Νάξο».
    const disjointRival = candidates.find(entry =>
      entry.island.id !== winner.island.id &&
      (entry.start + entry.length <= winner.start || entry.start >= winner.start + winner.length));

    if (!marginOk) {
      const tied = candidates.filter(entry => entry.start === winner.start && entry.length === winner.length);
      ambiguousRegions = [...new Map(tied.map(entry => [entry.island.id, entry.island])).values()];
    } else if (disjointRival) {
      ambiguousRegions = [winner.island, disjointRival.island];
    } else {
      region = winner.island;
      placeIndexes = new Set(Array.from({ length: winner.length }, (_, offset) => winner.start + offset));
    }
  }

  // ── Residual: drop the place and the duration phrase, keep the rest ──
  const residualTokens = tokens.filter((_, index) => !placeIndexes.has(index) && !usedIndexes.has(index));
  const residualQuery = residualTokens.join(' ');

  const ignore = region ? regionSearchNames(region, language) : [];
  const filters = detectSearchIntentFilters(residualQuery, ignore);

  return {
    region,
    ambiguousRegions,
    requestedDays: days,
    residualQuery,
    filters,
    isTripSentence: days !== undefined,
  };
};

/** Exported for the validation script, so its stopword sweep cannot drift. */
export const TRIP_QUERY_TOKEN_TABLES = {
  STOPWORDS: [...STOPWORDS],
  NUMBER_WORDS: [...NUMBER_WORDS.keys()],
  DURATION_UNITS: [...DURATION_UNITS.keys()],
  STANDALONE_DURATIONS: [...STANDALONE_DURATIONS.keys()],
  NEGATIVE_UNITS: [...NEGATIVE_UNITS],
};
