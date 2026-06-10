import { Beach, LanguageCode } from '../types';
import { getGreekBeachNameDisplay } from './greekBeachNames';

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
  if (language === 'gr') return getGreekBeachNameDisplay(name.gr, name.en);
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
  asphalt_road: { en: 'Easy road access', gr: 'Εύκολη πρόσβαση', de: 'Zugang uber Asphalt', it: 'Accesso asfaltato', fr: 'Acces par route goudronnee' },
  passable_dirt_road: { en: 'Dirt road', gr: 'Χωματόδρομος', de: 'Zugang uber Feldweg', it: 'Accesso da sterrato', fr: 'Acces par piste' },
  '4x4_only': { en: 'More challenging access', gr: 'Πιο δύσκολη πρόσβαση', de: 'Schwierige Zufahrt', it: 'Strada difficoltosa', fr: 'Route difficile' },
  hiking_path_easy: { en: 'Easy path', gr: 'Εύκολο μονοπάτι', de: 'Einfacher Weg', it: 'Sentiero facile', fr: 'Sentier facile' },
  hiking_path_difficult: { en: 'More challenging path', gr: 'Πιο δύσκολο μονοπάτι', de: 'Schwieriger Weg', it: 'Sentiero difficile', fr: 'Sentier difficile' },
  boat_only: { en: 'Boat access only', gr: 'Μόνο με σκάφος', de: 'Nur per Boot', it: 'Solo in barca', fr: 'Acces en bateau uniquement' },
  unknown: { en: 'Access not verified', gr: '\u039c\u03b7 \u03b5\u03c0\u03b9\u03b2\u03b5\u03b2\u03b1\u03b9\u03c9\u03bc\u03ad\u03bd\u03b7 \u03c0\u03c1\u03cc\u03c3\u03b2\u03b1\u03c3\u03b7', de: 'Zugang nicht verifiziert', it: 'Accesso non verificato', fr: 'Acces non verifie' },
};

export const localizedTerrainLabel = (type: string, language: LanguageCode) =>
  terrainLabels[type]?.[language] || type;

export const localizedWaterDepthLabel = (type: string, fallback: string | undefined, language: LanguageCode) =>
  waterDepthLabels[type]?.[language] || (language === 'gr' ? fallback || type : toGreeklish(fallback) || type);

// Never surface a raw access enum: unmapped types without an authored label
// render as nothing rather than leaking internal identifiers to the cards.
export const localizedAccessLabel = (type: string, fallback: string | undefined, language: LanguageCode) =>
  accessLabels[type]?.[language] || (language === 'gr' ? fallback : toGreeklish(fallback)) || '';

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
    ? { en: 'Facilities available', gr: 'Παροχές διαθέσιμες', de: 'Organisiert', it: 'Organizzata', fr: 'Organisee' }
    : { en: 'No beach facilities', gr: 'Χωρίς οργανωμένες παροχές', de: 'Nicht organisiert', it: 'Non organizzata', fr: 'Non amenagee' };
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
  const normalized = value.toLowerCase();
  if (language === 'gr') {
    if (/καμία|καμια|χωρίς|χωρις/.test(normalized)) return 'Χωρίς οργανωμένες παροχές';
    if (/beach\s*bar|beachbar|beach club|μπαρ παραλίας|μπαρ παραλιας/.test(normalized)) return 'Beach bar';
    if (/καντίνα|καντινα|snack\s*bar|\bbar\b/.test(normalized)) return 'Καντίνα κοντά';
    if (/καφέ|καφε|cafe|coffee/.test(normalized)) return 'Καφέ κοντά';
    if (/ταβέρνα|ταβερνα|ταβέρνες|ταβερνες/.test(normalized)) return 'Ταβέρνες κοντά';
    if (/restaurant|εστιατόριο|εστιατοριο/.test(normalized)) return 'Ταβέρνες κοντά';
    if (/food|snack/.test(normalized)) return 'Φαγητό κοντά';
    return capitalizeFirstLetter(value);
  }
  if (/parking|παρκ|στάθμευση|σταθμευση/.test(normalized)) {
    return { en: 'Parking nearby', de: 'Parken in der Nahe', it: 'Parcheggio vicino', fr: 'Parking a proximite' }[language];
  }
  if (/beach\s*bar|beachbar|beach club|μπαρ παραλίας|μπαρ παραλιας/.test(normalized)) {
    return { en: 'Beach bar nearby', de: 'Beachbar in der Nahe', it: 'Beach bar vicino', fr: 'Bar de plage a proximite' }[language];
  }
  if (/καντίνα|καντινα|snack\s*bar|\bbar\b/.test(normalized)) {
    return { en: 'Snack bar nearby', de: 'Snack-Bar in der Nahe', it: 'Snack bar vicino', fr: 'Snack-bar a proximite' }[language];
  }
  if (/καφέ|καφε|cafe|coffee/.test(normalized)) {
    return { en: 'Cafe nearby', de: 'Cafe in der Nahe', it: 'Cafe vicino', fr: 'Cafe a proximite' }[language];
  }
  if (/ξαπλώστρες|ξαπλωστρες|ομπρέλες|ομπρελες|sunbeds/.test(normalized)) {
    return { en: 'Sunbeds seasonally', de: 'Sonnenliegen saisonal', it: 'Lettini stagionali', fr: 'Transats en saison' }[language];
  }
  if (/ταβέρνα|ταβερνα/.test(normalized)) {
    return { en: 'Tavernas nearby', de: 'Tavernen in der Nahe', it: 'Taverne vicine', fr: 'Tavernes a proximite' }[language];
  }
  if (/restaurant|εστιατόριο|εστιατοριο/.test(normalized)) {
    return { en: 'Tavernas nearby', de: 'Tavernen in der Nahe', it: 'Taverne vicine', fr: 'Tavernes a proximite' }[language];
  }
  if (/food|snack/.test(normalized)) {
    return { en: 'Food nearby', de: 'Essen in der Nahe', it: 'Cibo vicino', fr: 'Restauration a proximite' }[language];
  }
  if (/καμία|καμια|χωρίς|χωρις/.test(normalized)) {
    return { en: 'No beach facilities', de: 'Keine organisierten Angebote', it: 'Nessun servizio organizzato', fr: 'Pas de services organises' }[language];
  }
  return capitalizeFirstLetter(toGreeklish(value) || value);
};

export const localizedBeachDescription = (beach: Beach, language: LanguageCode): string => {
  const text = beach.description[language] || beach.description.en || beach.description.gr;
  if (language === 'gr') return text;
  return /[\u0370-\u03ff]/.test(text) ? toGreeklish(text) : text;
};
