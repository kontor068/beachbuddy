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

export const toGreeklishSearchText = (value: string): string => {
  let result = normalizeSearchText(value);

  for (const [greek, latin] of greeklishPairs) {
    result = result.replace(new RegExp(greek, 'g'), latin);
  }

  return result
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const getSearchVariants = (value: string): string[] => {
  const baseVariants = [normalizeSearchText(value), toGreeklishSearchText(value)]
    .filter(Boolean);
  const variants = [...baseVariants];

  for (const variant of baseVariants) {
    variants.push(
      variant.replace(/ch/g, 'x'),
      variant.replace(/x/g, 'ch'),
      variant.replace(/th/g, '8'),
      variant.replace(/8/g, 'th')
    );
  }

  return Array.from(new Set(variants));
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

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
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

      for (const word of words) {
        if (word.length < 3 || queryVariant.length < 3) continue;
        const distance = levenshteinDistance(queryVariant, word);
        const similarity = 1 - distance / Math.max(queryVariant.length, word.length);
        if (similarity >= 0.55) bestScore = Math.max(bestScore, Math.round(similarity * 70));
      }
    }
  }

  return bestScore;
};
