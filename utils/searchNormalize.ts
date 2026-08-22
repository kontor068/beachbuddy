const stripMarks = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const greeklishPairs: Array<[string, string]> = [
  ['αι', 'e'],
  ['ει', 'i'],
  ['οι', 'i'],
  ['υι', 'i'],
  ['ου', 'ou'],
  ['αυ', 'av'],
  ['ευ', 'ev'],
  ['ηυ', 'iv'],
  ['μπ', 'b'],
  ['ντ', 'd'],
  ['γκ', 'gk'],
  ['γγ', 'g'],
  ['τσ', 'ts'],
  ['τζ', 'tz'],
  ['θ', 'th'],
  ['χ', 'ch'],
  ['ψ', 'ps'],
  ['α', 'a'],
  ['β', 'v'],
  ['γ', 'g'],
  ['δ', 'd'],
  ['ε', 'e'],
  ['ζ', 'z'],
  ['η', 'i'],
  ['ι', 'i'],
  ['κ', 'k'],
  ['λ', 'l'],
  ['μ', 'm'],
  ['ν', 'n'],
  ['ξ', 'x'],
  ['ο', 'o'],
  ['π', 'p'],
  ['ρ', 'r'],
  ['σ', 's'],
  ['ς', 's'],
  ['τ', 't'],
  ['υ', 'i'],
  ['φ', 'f'],
  ['ω', 'o'],
];

export const normalizeSearchText = (value: string): string =>
  stripMarks(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u0370-\u03ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * «Δεν βρήκαμε την Paralia Paroikias» (Μίλτος, 22/08/2026).
 *
 * The table above is ONE way to write Greek in Latin letters — the phonetic one, where
 * οι/ει/η/υ all collapse to «i» and μπ/ντ become «b»/«d». Google Maps, road signs and
 * every tourist use the OTHER one, letter by letter: Παροικιά → «Paroikia», Αγία
 * Ειρήνη → «Agia Eirini», Ντράφι → «Ntrafi», Κολυμπήθρα → «Kolymbithra».
 *
 * Holding only the first spelling made 42 beaches nationally unfindable by the name printed
 * on the map they came from — every «Αγία Ειρήνη», every «Άγιοι Ανάργυροι», every
 * «Άγιος Βασίλειος». Measured over all 2.873 beaches, carrying both spellings closes
 * all 42 and makes 3 extra same-region name pairs collide out of 143.128 — a trade worth
 * taking. Latin-only names produce the same string twice and are deduped away below.
 */
const naturalLatinPairs: Array<[string, string]> = [
  ['αι', 'ai'],
  ['ει', 'ei'],
  ['οι', 'oi'],
  ['υι', 'yi'],
  ['ου', 'ou'],
  ['αυ', 'av'],
  ['ευ', 'ev'],
  ['ηυ', 'iv'],
  ['μπ', 'b'],
  ['ντ', 'nt'],
  ['γκ', 'gk'],
  ['γγ', 'ng'],
  ['τσ', 'ts'],
  ['τζ', 'tz'],
  ['θ', 'th'],
  ['χ', 'ch'],
  ['ψ', 'ps'],
  ['α', 'a'],
  ['β', 'v'],
  ['γ', 'g'],
  ['δ', 'd'],
  ['ε', 'e'],
  ['ζ', 'z'],
  ['η', 'i'],
  ['ι', 'i'],
  ['κ', 'k'],
  ['λ', 'l'],
  ['μ', 'm'],
  ['ν', 'n'],
  ['ξ', 'x'],
  ['ο', 'o'],
  ['π', 'p'],
  ['ρ', 'r'],
  ['σ', 's'],
  ['ς', 's'],
  ['τ', 't'],
  ['υ', 'y'],
  ['φ', 'f'],
  ['ω', 'o'],
];

const transliterate = (value: string, pairs: Array<[string, string]>): string => {
  let result = normalizeSearchText(value);

  for (const [greek, latin] of pairs) {
    result = result.split(greek).join(latin);
  }

  return result
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const toGreeklishSearchText = (value: string): string =>
  transliterate(value, greeklishPairs);

export const toNaturalLatinSearchText = (value: string): string =>
  transliterate(value, naturalLatinPairs);

/**
 * Every keystroke re-scored every beach name in the country, and each of those names went
 * through two normalisations plus eight regex passes EVERY TIME — for a string that had not
 * changed since the app started. The names are a fixed set, so the answer is cached and the
 * work happens once per name for the life of the page.
 *
 * The cap is a safety valve, not a tuning knob: queries are also normalised here and a very
 * long typing session would otherwise grow the map without end. Beach names number in the
 * low thousands, so the cap is never reached by the data itself.
 */
const searchVariantCache = new Map<string, string[]>();
const SEARCH_VARIANT_CACHE_LIMIT = 20000;

export const getSearchVariants = (value: string): string[] => {
  const cached = searchVariantCache.get(value);
  if (cached) return cached;

  const baseVariants = Array.from(new Set(
    [normalizeSearchText(value), toGreeklishSearchText(value), toNaturalLatinSearchText(value)]
      .filter(Boolean)
  ));
  const variants = [...baseVariants];

  for (const variant of baseVariants) {
    variants.push(
      variant.replace(/ch/g, 'x'),
      variant.replace(/x/g, 'ch'),
      variant.replace(/th/g, '8'),
      variant.replace(/8/g, 'th')
    );
  }

  const result = Array.from(new Set(variants));
  if (searchVariantCache.size >= SEARCH_VARIANT_CACHE_LIMIT) searchVariantCache.clear();
  searchVariantCache.set(value, result);
  return result;
};

export const isSearchMatch = (query: string, values: Array<string | undefined | null>): boolean => {
  const queryVariants = getSearchVariants(query);
  if (queryVariants.length === 0) return true;

  return values.some(value => {
    if (!value) return false;
    const valueVariants = getSearchVariants(value);
    return queryVariants.some(queryVariant =>
      valueVariants.some(valueVariant =>
        valueVariant.includes(queryVariant) ||
        queryVariant.includes(valueVariant) ||
        valueVariant.split(' ').some(word => word.startsWith(queryVariant)) ||
        (queryVariant.length >= 4 && fuzzySearchScore(queryVariant, valueVariant) >= 50)
      )
    );
  });
};

export const levenshteinDistance = (a: string, b: string): number => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // One row instead of a full (b+1)×(a+1) grid: the classic algorithm only ever reads the
  // row above, and building thousands of throwaway arrays per keystroke cost more than the
  // arithmetic did. Same distance, same result — this is the textbook rolling-row form.
  let previousRow = new Array<number>(a.length + 1);
  let currentRow = new Array<number>(a.length + 1);
  for (let j = 0; j <= a.length; j++) previousRow[j] = j;

  for (let i = 1; i <= b.length; i++) {
    currentRow[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1,
        currentRow[j - 1] + 1,
        previousRow[j - 1] + cost
      );
    }
    const swap = previousRow;
    previousRow = currentRow;
    currentRow = swap;
  }

  return previousRow[a.length];
};

// Greek inflection endings in both the normalized-Greek and greeklish search spaces.
// Longest-first so 'ιου' is tried before 'ου' before 'υ'.
const INFLECTION_SUFFIXES = [
  'ιου', 'iou',
  'ος', 'ου', 'ας', 'ες', 'ης', 'ων', 'ια', 'ιο',
  'os', 'ou', 'as', 'es', 'is', 'on', 'ia', 'io',
  'α', 'η', 'ι', 'ο', 'ε', 'ς',
  'a', 'i', 'o', 'e', 's',
];

const inflectionStems = (word: string): Set<string> => {
  const stems = new Set<string>();
  if (word.length >= 3) stems.add(word);
  for (const suffix of INFLECTION_SUFFIXES) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      stems.add(word.slice(0, word.length - suffix.length));
    }
  }
  return stems;
};

// Generic beach words never count as the inflection-variant signal on their own,
// otherwise «παραλίες» alone would strongly match every «Παραλία Χ».
const GENERIC_SEARCH_WORDS = new Set([
  'παραλια', 'παραλιες', 'παραλιας', 'paralia', 'paralies', 'paralias',
  'beach', 'beaches', 'plage', 'plages', 'strand', 'spiaggia', 'spiagge',
]);

export const isGenericSearchWord = (word: string): boolean => GENERIC_SEARCH_WORDS.has(word);

// True when two words are plausibly the same Greek toponym in different grammatical
// cases (Άναξος↔Άναξου, Αγίου↔Άγιος). Both words must be reasonably long and share
// a stem once a single inflection ending is stripped, so unrelated words that merely
// share a prefix (Καλαμάκι/Καλαμάτα) do not match.
export const isInflectionVariant = (a: string, b: string): boolean => {
  if (a.length < 5 || b.length < 5) return false;
  if (a === b) return false;
  if (GENERIC_SEARCH_WORDS.has(a) || GENERIC_SEARCH_WORDS.has(b)) return false;
  const stemsA = inflectionStems(a);
  for (const stem of inflectionStems(b)) {
    if (stemsA.has(stem)) return true;
  }
  return false;
};

export const fuzzySearchScore = (query: string, value: string): number => {
  const queryVariants = getSearchVariants(query);
  const valueVariants = getSearchVariants(value);
  let bestScore = 0;

  for (const queryVariant of queryVariants) {
    for (const valueVariant of valueVariants) {
      if (!queryVariant || !valueVariant) continue;
      if (valueVariant === queryVariant) bestScore = Math.max(bestScore, 100);
      if (valueVariant.startsWith(queryVariant)) bestScore = Math.max(bestScore, 92);
      if (valueVariant.includes(queryVariant)) bestScore = Math.max(bestScore, 82);

      const words = valueVariant.split(' ');
      if (words.some(word => word.startsWith(queryVariant))) bestScore = Math.max(bestScore, 78);

      // Grammatical-case variants: «Άναξος» must find «Παραλία Άναξου» even though
      // neither word is a prefix of the other. 84 clears the beach-suggestion (76)
      // and direct-match (82) gates but stays below region matching (90).
      const queryWords = queryVariant.split(' ');
      if (queryWords.every(queryWord =>
        words.some(word =>
          word === queryWord ||
          word.startsWith(queryWord) ||
          isInflectionVariant(queryWord, word)
        )
      ) && queryWords.some(queryWord =>
        words.some(word => isInflectionVariant(queryWord, word))
      )) {
        bestScore = Math.max(bestScore, 84);
      }

      // The edit-distance sweep below is the expensive half of the whole search and it can
      // never award more than 70, so once something cheaper has already scored 70 or better
      // it cannot change the answer. Skipping it here is an equivalence, not a shortcut.
      if (bestScore >= 70) continue;

      for (const word of words) {
        if (word.length < 3 || queryVariant.length < 3) continue;
        const longest = Math.max(queryVariant.length, word.length);
        // An edit distance is never smaller than the difference in length, so two strings
        // this far apart cannot reach the 0.55 similarity gate however they are spelled.
        // Checking that first skips most of the country without computing anything.
        if (1 - Math.abs(queryVariant.length - word.length) / longest < 0.55) continue;
        const distance = levenshteinDistance(queryVariant, word);
        const similarity = 1 - distance / longest;
        if (similarity >= 0.55) bestScore = Math.max(bestScore, Math.round(similarity * 70));
      }
    }
  }

  return bestScore;
};
