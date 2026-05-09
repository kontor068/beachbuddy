import { Beach, LanguageCode } from '../types';

const greeklishPairs: Array<[string, string]> = [
  ['αι', 'ai'], ['ει', 'ei'], ['οι', 'oi'], ['ου', 'ou'], ['αυ', 'av'], ['ευ', 'ev'],
  ['Αι', 'Ai'], ['Ει', 'Ei'], ['Οι', 'Oi'], ['Ου', 'Ou'], ['Αυ', 'Av'], ['Ευ', 'Ev'],
  ['ά', 'a'], ['έ', 'e'], ['ή', 'i'], ['ί', 'i'], ['ό', 'o'], ['ύ', 'y'], ['ώ', 'o'],
  ['ϊ', 'i'], ['ΐ', 'i'], ['ϋ', 'y'], ['ΰ', 'y'],
  ['Ά', 'A'], ['Έ', 'E'], ['Ή', 'I'], ['Ί', 'I'], ['Ό', 'O'], ['Ύ', 'Y'], ['Ώ', 'O'],
  ['Α', 'A'], ['Β', 'V'], ['Γ', 'G'], ['Δ', 'D'], ['Ε', 'E'], ['Ζ', 'Z'], ['Η', 'I'],
  ['Θ', 'Th'], ['Ι', 'I'], ['Κ', 'K'], ['Λ', 'L'], ['Μ', 'M'], ['Ν', 'N'], ['Ξ', 'X'],
  ['Ο', 'O'], ['Π', 'P'], ['Ρ', 'R'], ['Σ', 'S'], ['Τ', 'T'], ['Υ', 'Y'], ['Φ', 'F'],
  ['Χ', 'Ch'], ['Ψ', 'Ps'], ['Ω', 'O'],
  ['α', 'a'], ['β', 'v'], ['γ', 'g'], ['δ', 'd'], ['ε', 'e'], ['ζ', 'z'], ['η', 'i'],
  ['θ', 'th'], ['ι', 'i'], ['κ', 'k'], ['λ', 'l'], ['μ', 'm'], ['ν', 'n'], ['ξ', 'x'],
  ['ο', 'o'], ['π', 'p'], ['ρ', 'r'], ['σ', 's'], ['ς', 's'], ['τ', 't'], ['υ', 'y'],
  ['φ', 'f'], ['χ', 'ch'], ['ψ', 'ps'], ['ω', 'o'],
];

export const toGreeklish = (value: string | undefined): string => {
  if (!value) return '';
  return greeklishPairs.reduce((text, [from, to]) => text.split(from).join(to), value)
    .replace(/\s+/g, ' ')
    .trim();
};

export const displayBeachName = (name: Beach['name'], language: LanguageCode): string => {
  if (language === 'gr') return name.gr || name.en;
  return toGreeklish(name.gr || name.en) || name.en;
};

export const displayIslandName = (name: { en: string; gr: string; fr: string; de: string; it: string }, language: LanguageCode): string => {
  if (language === 'gr') return name.gr || name.en;
  return name[language] || name.en;
};

const terrainLabels: Record<string, Record<LanguageCode, string>> = {
  fine_sand: { en: 'Fine sand', gr: 'Λεπτή άμμος', de: 'Feiner Sand', it: 'Sabbia fine', fr: 'Sable fin' },
  coarse_sand: { en: 'Coarse sand', gr: 'Χοντρή άμμος', de: 'Grober Sand', it: 'Sabbia grossa', fr: 'Sable grossier' },
  pebbles: { en: 'Pebbles', gr: 'Βότσαλα', de: 'Kiesel', it: 'Ciottoli', fr: 'Galets' },
  large_stones: { en: 'Large stones', gr: 'Μεγάλες πέτρες', de: 'Grosse Steine', it: 'Pietre grandi', fr: 'Grosses pierres' },
  rocks: { en: 'Rocks', gr: 'Βράχια', de: 'Felsen', it: 'Rocce', fr: 'Rochers' },
};

const waterDepthLabels: Record<string, Record<LanguageCode, string>> = {
  shallow: { en: 'Shallow water', gr: 'Ρηχά νερά', de: 'Flaches Wasser', it: 'Acque basse', fr: 'Eaux peu profondes' },
  medium: { en: 'Medium depth', gr: 'Μέτριο βάθος', de: 'Mittlere Tiefe', it: 'Profondita media', fr: 'Profondeur moyenne' },
  deep: { en: 'Deep water', gr: 'Βαθιά νερά', de: 'Tiefes Wasser', it: 'Acque profonde', fr: 'Eaux profondes' },
};

const accessLabels: Record<string, Record<LanguageCode, string>> = {
  asphalt_road: { en: 'Asphalt access', gr: 'Πρόσβαση με άσφαλτο', de: 'Zugang uber Asphalt', it: 'Accesso asfaltato', fr: 'Acces par route goudronnee' },
  passable_dirt_road: { en: 'Dirt road access', gr: 'Πρόσβαση από χωματόδρομο', de: 'Zugang uber Feldweg', it: 'Accesso da sterrato', fr: 'Acces par piste' },
  '4x4_only': { en: 'Difficult road', gr: 'Δύσβατος δρόμος', de: 'Schwierige Zufahrt', it: 'Strada difficoltosa', fr: 'Route difficile' },
  hiking_path_easy: { en: 'Easy path', gr: 'Εύκολο μονοπάτι', de: 'Einfacher Weg', it: 'Sentiero facile', fr: 'Sentier facile' },
  hiking_path_difficult: { en: 'Difficult path', gr: 'Δύσκολο μονοπάτι', de: 'Schwieriger Weg', it: 'Sentiero difficile', fr: 'Sentier difficile' },
  boat_only: { en: 'Boat access only', gr: 'Μόνο με σκάφος', de: 'Nur per Boot', it: 'Solo in barca', fr: 'Acces en bateau uniquement' },
};

export const localizedTerrainLabel = (type: string, language: LanguageCode) =>
  terrainLabels[type]?.[language] || type;

export const localizedWaterDepthLabel = (type: string, fallback: string | undefined, language: LanguageCode) =>
  waterDepthLabels[type]?.[language] || (language === 'gr' ? fallback || type : toGreeklish(fallback) || type);

export const localizedAccessLabel = (type: string, fallback: string | undefined, language: LanguageCode) =>
  accessLabels[type]?.[language] || (language === 'gr' ? fallback || type : toGreeklish(fallback) || type);

export const localizedAccessPrefix = (language: LanguageCode) => ({
  en: 'Access',
  gr: 'Πρόσβαση',
  de: 'Zugang',
  it: 'Accesso',
  fr: 'Acces',
}[language]);

const capitalizeFirstLetter = (value: string): string => {
  const chars = Array.from(value.trim());
  if (chars.length === 0) return '';
  return `${chars[0].toLocaleUpperCase()}${chars.slice(1).join('')}`;
};

export const localizedOrganizationLabel = (organized: boolean, language: LanguageCode) => {
  const labels = organized
    ? { en: 'Organized', gr: 'Οργανωμένη', de: 'Organisiert', it: 'Organizzata', fr: 'Organisee' }
    : { en: 'Unorganized', gr: 'Μη οργανωμένη', de: 'Nicht organisiert', it: 'Non organizzata', fr: 'Non amenagee' };
  return labels[language];
};

export const localizedShadeLabel = (language: LanguageCode) => ({
  en: 'Natural shade',
  gr: 'Φυσική σκιά',
  de: 'Naturlicher Schatten',
  it: 'Ombra naturale',
  fr: 'Ombre naturelle',
}[language]);

export const localizedAmenityText = (value: string, language: LanguageCode): string => {
  if (language === 'gr') return capitalizeFirstLetter(value);
  const normalized = value.toLowerCase();
  if (/parking|παρκ|στάθμευση|σταθμευση/.test(normalized)) {
    return { en: 'Parking nearby', de: 'Parken in der Nahe', it: 'Parcheggio vicino', fr: 'Parking a proximite' }[language];
  }
  if (/beach bar|καντίνα|καντινα|καφέ|καφε|bar/.test(normalized)) {
    return { en: 'Beach bar nearby', de: 'Beachbar in der Nahe', it: 'Beach bar vicino', fr: 'Bar de plage a proximite' }[language];
  }
  if (/ξαπλώστρες|ξαπλωστρες|ομπρέλες|ομπρελες|sunbeds/.test(normalized)) {
    return { en: 'Sunbeds seasonally', de: 'Sonnenliegen saisonal', it: 'Lettini stagionali', fr: 'Transats en saison' }[language];
  }
  if (/ταβέρνα|ταβερνα|restaurant|εστιατόριο|εστιατοριο/.test(normalized)) {
    return { en: 'Food nearby', de: 'Essen in der Nahe', it: 'Cibo vicino', fr: 'Restauration a proximite' }[language];
  }
  if (/καμία|καμια|χωρίς|χωρις/.test(normalized)) {
    return { en: 'No organized services', de: 'Keine organisierten Angebote', it: 'Nessun servizio organizzato', fr: 'Pas de services organises' }[language];
  }
  return capitalizeFirstLetter(toGreeklish(value) || value);
};

export const localizedBeachDescription = (beach: Beach, language: LanguageCode): string => {
  const text = beach.description[language] || beach.description.en || beach.description.gr;
  if (language === 'gr') return text;
  return /[\u0370-\u03ff]/.test(text) ? toGreeklish(text) : text;
};
