import type { LanguageCode, SimpleWindSuitability, WindSector } from '../types';
import type { ExposureLevel } from './windExposure';

const COMPASS: Record<'gr' | 'intl', string[]> = {
  gr: ['Β', 'ΒΑ', 'Α', 'ΝΑ', 'Ν', 'ΝΔ', 'Δ', 'ΒΔ'],
  intl: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'],
};

const WIND_LABELS: Record<'en' | 'gr', Record<WindSector, string>> = {
  en: {
    N: 'north',
    NE: 'northeast',
    E: 'east',
    SE: 'southeast',
    S: 'south',
    SW: 'southwest',
    W: 'west',
    NW: 'northwest',
  },
  gr: {
    N: 'βόρειο',
    NE: 'βορειοανατολικό',
    E: 'ανατολικό',
    SE: 'νοτιοανατολικό',
    S: 'νότιο',
    SW: 'νοτιοδυτικό',
    W: 'δυτικό',
    NW: 'βορειοδυτικό',
  },
};

const copyLanguage = (language: LanguageCode): 'en' | 'gr' => (
  language === 'gr' ? 'gr' : 'en'
);

const windLabel = (sector: WindSector | undefined, language: LanguageCode): string => {
  const copyLang = copyLanguage(language);
  if (!sector) return copyLang === 'gr' ? 'σημερινό' : "today's";
  return WIND_LABELS[copyLang][sector];
};

const compassLabel = (deg: number, language: LanguageCode): string => {
  const index = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return (language === 'gr' ? COMPASS.gr : COMPASS.intl)[index];
};

export interface WindExposureCopyInput {
  exposureLevel?: ExposureLevel;
  windDirectionDeg: number;
  windBeaufort: number;
  facingDeg?: number | null;
  knownWindSportSpot?: boolean;
  language: LanguageCode;
}

type Phrases = {
  calm: string;
  sport: string;
  withFacing: (level: ExposureLevel, facing: string, windFrom: string) => string;
  withoutFacing: (level: ExposureLevel) => string;
};

const EN_PHRASES: Phrases = {
  calm: 'Light wind today - most beaches should be manageable, but local conditions may vary.',
  sport: 'Known windsurf/kite spot - expect more wind or chop today.',
  withFacing: (level, facing, windFrom) => (
    level === 'protected'
      ? `Faces ${facing}; today's ${windFrom} wind is less direct here, so it is likely calmer than open beaches.`
      : level === 'exposed'
        ? `Open toward ${facing}; today's ${windFrom} wind reaches this shore more directly.`
        : `Crosswind from ${windFrom} today - conditions may be manageable, with some local chop.`
  ),
  withoutFacing: (level) => (
    level === 'protected'
      ? "Better protected from today's wind; conditions may still vary locally."
      : level === 'exposed'
        ? "More exposed to today's wind; expect a less calm option."
        : "Partly exposed to today's wind; conditions may still be manageable."
  ),
};

const GR_PHRASES: Phrases = {
  calm: 'Ήπιος άνεμος σήμερα - οι περισσότερες παραλίες φαίνονται διαχειρίσιμες, αλλά οι τοπικές συνθήκες μπορεί να διαφέρουν.',
  sport: 'Γνωστό σημείο για windsurf/kite - περίμενε περισσότερο αέρα ή κυματάκι σήμερα.',
  withFacing: (level, facing, windFrom) => (
    level === 'protected'
      ? `Κοιτάει ${facing}; ο σημερινός άνεμος από ${windFrom} μπαίνει λιγότερο άμεσα εδώ, οπότε είναι πιθανόν πιο ήρεμη από ανοιχτές παραλίες.`
      : level === 'exposed'
        ? `Είναι ανοιχτή προς ${facing}; ο σημερινός άνεμος από ${windFrom} πιάνει πιο άμεσα αυτή την ακτή.`
        : `Πλάγιος άνεμος από ${windFrom} σήμερα - μπορεί να είναι διαχειρίσιμη, με λίγο τοπικό κυματάκι.`
  ),
  withoutFacing: (level) => (
    level === 'protected'
      ? 'Καλύτερα προστατευμένη από τον σημερινό άνεμο· οι τοπικές συνθήκες μπορεί να διαφέρουν.'
      : level === 'exposed'
        ? 'Πιο εκτεθειμένη στον σημερινό άνεμο· περίμενε λιγότερο ήρεμη επιλογή.'
        : 'Μερικώς εκτεθειμένη στον σημερινό άνεμο· μπορεί να παραμένει διαχειρίσιμη.'
  ),
};

export const describeWindExposure = ({
  exposureLevel,
  windDirectionDeg,
  windBeaufort,
  facingDeg,
  knownWindSportSpot,
  language,
}: WindExposureCopyInput): string => {
  const phrases = language === 'gr' ? GR_PHRASES : EN_PHRASES;
  const level: ExposureLevel = exposureLevel || 'partial';

  if (knownWindSportSpot && windBeaufort >= 4) return phrases.sport;
  if (windBeaufort <= 2) return phrases.calm;

  if (typeof facingDeg === 'number' && Number.isFinite(facingDeg)) {
    return phrases.withFacing(level, compassLabel(facingDeg, language), compassLabel(windDirectionDeg, language));
  }

  return phrases.withoutFacing(level);
};

export const describeSimpleWindSuitability = (
  simpleWindSuitability: SimpleWindSuitability | undefined,
  language: LanguageCode
): string | undefined => {
  if (!simpleWindSuitability) return undefined;

  const copyLang = copyLanguage(language);
  const wind = windLabel(simpleWindSuitability.windSector, language);
  const strongWind = simpleWindSuitability.suitabilityColor === 'orange' ||
    simpleWindSuitability.suitabilityColor === 'red';

  if (copyLang === 'gr') {
    if (simpleWindSuitability.explanationKey === 'generally_calm') {
      return 'Ήπιος άνεμος σήμερα - γενικά διαχειρίσιμη επιλογή.';
    }
    if (simpleWindSuitability.explanationKey === 'protected_from_wind') {
      return strongWind
        ? `Καλύτερα προστατευμένη από το σημερινό ${wind} αεράκι, αλλά οι συνθήκες μπορεί να διαφέρουν τοπικά.`
        : `Καλύτερα προστατευμένη από το σημερινό ${wind} αεράκι.`;
    }
    if (simpleWindSuitability.explanationKey === 'exposed_to_wind') {
      return strongWind
        ? `Πιο εκτεθειμένη στο σημερινό ${wind} αεράκι - θέλει προσοχή.`
        : `Πιο εκτεθειμένη στο σημερινό ${wind} αεράκι.`;
    }
    if (simpleWindSuitability.explanationKey === 'avoid_today') {
      return `Δυνατός ${wind} άνεμος σήμερα - καλύτερα να την αποφύγεις για ήρεμο μπάνιο.`;
    }
    return strongWind
      ? `Πλάγια έκθεση στο σημερινό ${wind} αεράκι - μπορεί να έχει αέρα ή κυματάκι.`
      : `Μερικώς εκτεθειμένη στο σημερινό ${wind} αεράκι.`;
  }

  if (simpleWindSuitability.explanationKey === 'generally_calm') {
    return 'Light wind today - generally manageable choice.';
  }
  if (simpleWindSuitability.explanationKey === 'protected_from_wind') {
    return strongWind
      ? `Better protected from today's ${wind} wind, but conditions may still vary locally.`
      : `Better protected from today's ${wind} wind.`;
  }
  if (simpleWindSuitability.explanationKey === 'exposed_to_wind') {
    return strongWind
      ? `More exposed to today's ${wind} wind - use caution.`
      : `More exposed to today's ${wind} wind.`;
  }
  if (simpleWindSuitability.explanationKey === 'avoid_today') {
    return `Strong ${wind} wind today - better to avoid for calm swimming.`;
  }
  return strongWind
    ? `Crosswind from today's ${wind} wind - expect some wind or chop.`
    : `Partly exposed to today's ${wind} wind.`;
};
