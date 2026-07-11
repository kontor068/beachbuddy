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
  // No known sector → return an empty token (not a "today's/σημερινό" stamp). The wind
  // description reads as a continuous present-tense statement; anchoring it to "today"
  // is misleading because conditions change through the day. Callers guard the spacing.
  if (!sector) return '';
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
  calm: 'Light wind - most beaches should be manageable, but local conditions may vary.',
  sport: 'Known windsurf/kite spot - expect more wind or chop.',
  withFacing: (level, facing, windFrom) => (
    level === 'protected'
      ? `Faces ${facing}; the ${windFrom} wind is less direct here, so it is likely calmer than exposed beaches.`
      : level === 'exposed'
        ? `Open toward ${facing}; the ${windFrom} wind reaches this shore more directly.`
        : `Partial shelter - crosswind from ${windFrom}, conditions may be manageable with some local chop.`
  ),
  withoutFacing: (level) => (
    level === 'protected'
      ? 'More sheltered from the wind; conditions may still vary locally.'
      : level === 'exposed'
        ? 'More exposed to the wind; expect a less calm option.'
        : 'Partial shelter from the wind; conditions may still be manageable.'
  ),
};

const GR_PHRASES: Phrases = {
  calm: 'Ήπιος άνεμος - οι περισσότερες παραλίες φαίνονται διαχειρίσιμες, αλλά οι τοπικές συνθήκες μπορεί να διαφέρουν.',
  sport: 'Γνωστό σημείο για windsurf/kite - περίμενε περισσότερο αέρα ή κυματάκι.',
  withFacing: (level, facing, windFrom) => (
    level === 'protected'
      ? `Κοιτάει ${facing}; ο άνεμος από ${windFrom} μπαίνει λιγότερο άμεσα εδώ, οπότε είναι πιθανόν πιο ήρεμη από εκτεθειμένες παραλίες.`
      : level === 'exposed'
        ? `Είναι εκτεθειμένη προς ${facing}; ο άνεμος από ${windFrom} πιάνει πιο άμεσα αυτή την ακτή.`
        : `Μερική προστασία - ο άνεμος από ${windFrom} πιάνει πλάγια, μπορεί να είναι διαχειρίσιμη με λίγο τοπικό κυματάκι.`
  ),
  withoutFacing: (level) => (
    level === 'protected'
      ? 'Πιο προστατευμένη από τον άνεμο· οι τοπικές συνθήκες μπορεί να διαφέρουν.'
      : level === 'exposed'
        ? 'Πιο εκτεθειμένη στον άνεμο· περίμενε λιγότερο ήρεμη επιλογή.'
        : 'Μερική προστασία από τον άνεμο· μπορεί να παραμένει διαχειρίσιμη.'
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
  // Scale the wording's certainty to the actual wind. A 5–6 Bft day definitely has
  // wind and waves — even a sheltered shore — so we drop "breeze"/"may have" and
  // say it plainly. windBeaufort falls back to the colour when it is missing.
  const beaufort = simpleWindSuitability.windBeaufort ?? (strongWind ? 5 : 3);
  const definite = beaufort >= 5;
  const useWind = beaufort >= 4;

  if (copyLang === 'gr') {
    if (simpleWindSuitability.explanationKey === 'generally_calm') {
      return 'Ήπιος άνεμος - γενικά διαχειρίσιμη επιλογή.';
    }
    if (simpleWindSuitability.explanationKey === 'avoid_today') {
      return 'Δυνατός άνεμος - καλύτερα να την αποφύγεις για ήρεμο μπάνιο.';
    }
    const noun = useWind ? 'άνεμο' : 'αεράκι';
    // Drop the "σημερινό" now-anchor; keep the direction word only when we actually
    // know the sector (guard the space so a missing sector reads "στον άνεμο", not "στον  άνεμο").
    const windWord = wind ? `${wind} ` : '';
    const fromWind = `από ${useWind ? 'τον' : 'το'} ${windWord}${noun}`;
    const toWind = `${useWind ? 'στον' : 'στο'} ${windWord}${noun}`;

    if (simpleWindSuitability.explanationKey === 'protected_from_wind') {
      return definite
        ? `Πιο προστατευμένη ${fromWind} - πιο ήρεμη από τις εκτεθειμένες, αλλά θα έχει κι εδώ λίγο αέρα και κύμα.`
        : `Πιο προστατευμένη ${fromWind}.`;
    }
    if (simpleWindSuitability.explanationKey === 'exposed_to_wind') {
      return definite
        ? `Πιο εκτεθειμένη ${toWind} - θα έχει αισθητό αέρα και κύμα.`
        // At 4 Bft "θέλει προσοχή" is too strong — describe it plainly instead.
        : `Πιο εκτεθειμένη ${toWind}${useWind ? ' - μπορεί να έχει λίγο αέρα και κύμα.' : '.'}`;
    }
    return definite
      ? `Μερική προστασία ${fromWind} - θα έχει αέρα και κύμα.`
      : `Μερική προστασία ${fromWind}${useWind ? ' - μπορεί να έχει λίγο αέρα ή κυματάκι.' : '.'}`;
  }

  if (simpleWindSuitability.explanationKey === 'generally_calm') {
    return 'Light wind - generally manageable choice.';
  }
  if (simpleWindSuitability.explanationKey === 'avoid_today') {
    return `Strong ${wind ? `${wind} ` : ''}wind - better to avoid for calm swimming.`;
  }
  const enNoun = useWind ? 'wind' : 'breeze';
  // Drop the "today's" now-anchor; keep the direction only when the sector is known.
  const enWind = wind ? `${wind} ` : '';
  if (simpleWindSuitability.explanationKey === 'protected_from_wind') {
    return definite
      ? `More sheltered from the ${enWind}${enNoun} - calmer than exposed beaches, but it will still be breezy here with some chop.`
      : `More sheltered from the ${enWind}${enNoun}.`;
  }
  if (simpleWindSuitability.explanationKey === 'exposed_to_wind') {
    return definite
      ? `More exposed to the ${enWind}${enNoun} - expect noticeable wind and waves.`
      // At 4 Bft "use caution" is too strong — describe it plainly instead.
      : `More exposed to the ${enWind}${enNoun}${useWind ? ' - some light wind and chop possible.' : '.'}`;
  }
  return definite
    ? `Partial shelter from the ${enWind}${enNoun} - it will be windy with some waves.`
    : `Partial shelter from the ${enWind}${enNoun}${useWind ? ' - some wind or chop possible.' : '.'}`;
};
