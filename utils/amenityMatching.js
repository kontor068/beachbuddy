const normalizeAmenityText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[-_]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

// «ΧΩΡΙΣ ΞΑΠΛΩΣΤΡΕΣ» ΔΕΝ ΣΗΜΑΙΝΕΙ ΞΑΠΛΩΣΤΡΕΣ (10/09/2026).
//
// Until now a term counted wherever its letters appeared, so «χωρίς ομπρέλες/ξαπλώστρες» on
// Ζέπκου, «φέρνεις δική σου ομπρέλα» on Σχοινιά and «χωρίς ξαπλώστρες» on Αχίλλι all made the
// card say «Ξαπλώστρες: ναι» — the beach's own text said the opposite of what we printed.
// Measured nationally before this change: 480 amenity lines carry a negation word, and exactly
// 5 beaches changed a card flag (4 sunbeds, 1 taverna), every one of them from a false «yes».
//
// A term is negated only when a negation word stands BEFORE it inside the same clause. Commas,
// semicolons and middle dots end a clause; a slash does not, because it means "or" here
// («χωρίς ομπρέλες/ξαπλώστρες» negates both). So «ταβέρνα κοντά, χωρίς parking» still has a
// taverna and has no parking.
const NEGATION_BEFORE_TERM = /(^|\s)(χωρις|δεν υπαρχ\S*|δεν εχει|καμια|κανενα|ουτε|no|without|not|φερνεις|φερτε|bring your own|byo)(\s|$)/;
const CLAUSE_BREAK = /[,;·]/g;

const isNegatedAt = (text, index) => {
  let start = 0;
  CLAUSE_BREAK.lastIndex = 0;
  let match;
  while ((match = CLAUSE_BREAK.exec(text)) !== null && match.index < index) start = match.index + 1;
  return NEGATION_BEFORE_TERM.test(text.slice(start, index));
};

const termInText = (text, term) => {
  const needle = normalizeAmenityText(term);
  if (!needle) return false;
  for (let at = text.indexOf(needle); at !== -1; at = text.indexOf(needle, at + 1)) {
    if (!isNegatedAt(text, at)) return true;
  }
  return false;
};

export const BEACH_BAR_AMENITY_TERMS = [
  'beach bar',
  'beachbar',
  'beach club',
  'beach bars',
  'beach clubs',
  '\u03bc\u03c0\u03b1\u03c1 \u03c0\u03b1\u03c1\u03b1\u03bb\u03b9\u03b1\u03c2',
];

const AMBIGUOUS_BEACH_BAR_CONTEXT_TERMS = [
  '/',
  'possible',
  'probably',
  'likely',
  '\u03c0\u03b9\u03b8\u03b1\u03bd',
  'cafe',
  'coffee',
  '\u03ba\u03b1\u03c6\u03b5',
  'taverna',
  'tavern',
  '\u03c4\u03b1\u03b2\u03b5\u03c1\u03bd',
  'restaurant',
  '\u03b5\u03c3\u03c4\u03b9\u03b1\u03c4\u03bf\u03c1',
  'canteen',
  '\u03ba\u03b1\u03bd\u03c4\u03b9\u03bd',
  'snack',
  '\u03c3\u03bd\u03b1\u03ba',
];

export const TAVERNA_AMENITY_TERMS = [
  'taverna',
  'tavern',
  '\u03c4\u03b1\u03b2\u03b5\u03c1\u03bd',
];

export const RESTAURANT_AMENITY_TERMS = [
  'restaurant',
  '\u03b5\u03c3\u03c4\u03b9\u03b1\u03c4\u03bf\u03c1',
];

export const CAFE_AMENITY_TERMS = [
  'cafe',
  'coffee',
  '\u03ba\u03b1\u03c6\u03b5',
];

export const SNACK_CANTEEN_AMENITY_TERMS = [
  'canteen',
  '\u03ba\u03b1\u03bd\u03c4\u03b9\u03bd',
  'snack',
  '\u03c3\u03bd\u03b1\u03ba',
];

export const PARKING_AMENITY_TERMS = [
  'parking',
  '\u03c3\u03c4\u03b1\u03b8\u03bc\u03b5\u03c5\u03c3',
  '\u03c0\u03b1\u03c1\u03ba',
];

export const SUNBED_AMENITY_TERMS = [
  'sunbed',
  'sunbeds',
  'umbrella',
  'umbrellas',
  '\u03be\u03b1\u03c0\u03bb\u03c9\u03c3\u03c4\u03c1',
  '\u03bf\u03bc\u03c0\u03c1\u03b5\u03bb',
];

export const normalizeAmenity = normalizeAmenityText;

export const amenityItemIncludesAny = (item, terms) => {
  const text = normalizeAmenityText(item);
  return terms.some(term => termInText(text, term));
};

export const amenityTextIncludesAny = (items, terms) =>
  (items || []).some(item => amenityItemIncludesAny(item, terms));

export const isAmbiguousBeachBarAmenity = item => {
  const text = normalizeAmenityText(item);
  const hasBeachBar = BEACH_BAR_AMENITY_TERMS.some(term => termInText(text, term));
  if (!hasBeachBar) return false;
  const hasEnglishOr = /(^|\s)or(\s|$)/.test(text);
  const hasGreekOr = /(^|\s)\u03b7(\s|$)/.test(text);
  return hasEnglishOr || hasGreekOr || AMBIGUOUS_BEACH_BAR_CONTEXT_TERMS.some(term => termInText(text, term));
};

export const hasExplicitBeachBarAmenity = item => {
  const text = normalizeAmenityText(item);
  const hasBeachBar = BEACH_BAR_AMENITY_TERMS.some(term => termInText(text, term));
  return hasBeachBar && !isAmbiguousBeachBarAmenity(item);
};

export const hasExplicitBeachBarAmenityInList = items =>
  (items || []).some(hasExplicitBeachBarAmenity);
