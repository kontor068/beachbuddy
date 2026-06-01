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
