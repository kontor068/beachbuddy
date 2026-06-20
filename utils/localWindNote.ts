import { LanguageCode } from '../types';
import { getBeaufortLevel } from './weatherUtils';

export type LocalWindTone = 'windier' | 'calmer';

export interface LocalWindNote {
  tone: LocalWindTone;
  text: string;
}

// Plain, swimmer-friendly wording — no Beaufort numbers, no jargon. The point is
// "this exact spot can differ from the rest of the area", said in one breath.
const NOTE_COPY: Record<LocalWindTone, Record<LanguageCode, string>> = {
  windier: {
    gr: 'Εδώ μπορεί να έχει λίγο παραπάνω αέρα απ’ τη γύρω περιοχή.',
    en: 'It can be a bit windier right here than nearby.',
    fr: 'Il peut y avoir un peu plus de vent ici qu’aux alentours.',
    de: 'Hier kann es etwas windiger sein als in der Umgebung.',
    it: 'Qui può esserci un po’ più vento che nei dintorni.',
  },
  calmer: {
    gr: 'Εδώ μπορεί να είναι λίγο πιο ήρεμα απ’ τη γύρω περιοχή.',
    en: 'It can be a bit calmer right here than nearby.',
    fr: 'Il peut faire un peu plus calme ici qu’aux alentours.',
    de: 'Hier kann es etwas ruhiger sein als in der Umgebung.',
    it: 'Qui può essere un po’ più tranquillo che nei dintorni.',
  },
};

// Minimum real gap (km/h) on top of a Beaufort-band change, so we don't flap on a
// beach that merely sits on a band boundary.
const MIN_MEANINGFUL_GAP_KMH = 6;

/**
 * Compares this beach's own (cluster) wind with the area-wide wind and, only when
 * the difference is genuinely noticeable, returns a one-line "a bit windier/calmer
 * right here" note. Both speeds are in m/s (as stored on forecast.wind.speed).
 * Returns null when the spot tracks the area — no note, no noise.
 */
export const getLocalWindNote = (
  areaWindSpeedMs?: number,
  localWindSpeedMs?: number,
  language: LanguageCode = 'gr'
): LocalWindNote | null => {
  if (
    typeof areaWindSpeedMs !== 'number' || !Number.isFinite(areaWindSpeedMs) ||
    typeof localWindSpeedMs !== 'number' || !Number.isFinite(localWindSpeedMs)
  ) {
    return null;
  }

  const areaKmh = areaWindSpeedMs * 3.6;
  const localKmh = localWindSpeedMs * 3.6;
  if (Math.abs(localKmh - areaKmh) < MIN_MEANINGFUL_GAP_KMH) return null;

  const areaBft = getBeaufortLevel(areaKmh);
  const localBft = getBeaufortLevel(localKmh);

  if (localBft >= areaBft + 1) return { tone: 'windier', text: NOTE_COPY.windier[language] };
  if (localBft <= areaBft - 1) return { tone: 'calmer', text: NOTE_COPY.calmer[language] };
  return null;
};
