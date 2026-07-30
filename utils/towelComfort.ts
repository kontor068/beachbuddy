import { BeachType, LanguageCode } from '../types';

export type TowelComfortTone = 'calm' | 'breezy' | 'difficult';

export interface TowelComfort {
  tone: TowelComfortTone;
  text: string;
}

// Same wind numbers already shown in the wind card, just said the way a tourist actually
// thinks about a beach day — "will my towel/umbrella survive" — instead of "24 km/h, 4 Bft".
// Gust drives the tone (it's what actually flips an umbrella or lifts a towel), the sustained
// speed is only the fallback when no gust value is available for this hour.
const DIFFICULT_GUST_KMH = 35; // ~5 Bft gust — same threshold the exposure tiers already treat as "strong"
// Two entry points into the middle tier, because the two beach types stop being
// comfortable at different moments:
//   • sandy: blowing sand starts stinging around 4 Bft (20 km/h), well before anything lifts.
//   • everything else: nothing is wrong until the wind itself starts pulling at the towel,
//     which is 5 Bft (29 km/h per getBeaufortLevel).
// The second threshold exists to kill a false calm: with one shared 20 km/h gate keyed on
// sandy beaches, a pebble beach at a 34 km/h gust — solidly 5 Bft — was told "your towel
// will stay put". We never claim calm we can't back.
const SANDY_GUST_KMH = 20;
const BREEZY_GUST_KMH = 29;

const isSandyBeach = (beachType: BeachType): boolean =>
  beachType === 'sandy' || beachType === 'sandy-pebbles';

const BREEZY_SAND_COPY: Record<LanguageCode, string> = {
  gr: 'Πιθανή ενοχλητική άμμος στον αέρα.',
  en: 'Sand may blow around a bit.',
  de: 'Etwas Sand kann aufwirbeln.',
  fr: 'Un peu de sable pourrait voler.',
  it: 'La sabbia potrebbe volare un po’.',
};

const COPY: Record<TowelComfortTone, Record<LanguageCode, string>> = {
  calm: {
    gr: 'Η πετσέτα θα μείνει κάτω.',
    en: 'Your towel will stay put.',
    de: 'Dein Handtuch bleibt liegen.',
    fr: 'Votre serviette restera en place.',
    it: 'Il tuo telo rimarrà a terra.',
  },
  breezy: {
    gr: 'Αισθητός αέρας — στερέωσε καλά πετσέτα και ομπρέλα.',
    en: 'Noticeable wind — weigh down your towel and umbrella.',
    de: 'Spürbarer Wind — Handtuch und Schirm gut beschweren.',
    fr: 'Vent sensible — lestez bien serviette et parasol.',
    it: 'Vento sensibile — fissa bene telo e ombrellone.',
  },
  difficult: {
    gr: 'Δύσκολο να στήσεις ομπρέλα σήμερα.',
    en: 'Hard to keep an umbrella up today.',
    de: 'Ein Sonnenschirm hält heute schwer.',
    fr: 'Difficile de garder un parasol debout aujourd’hui.',
    it: 'Difficile tenere aperto un ombrellone oggi.',
  },
};

/**
 * "Towel Comfort" — the same wind data already on the page, reworded for what a
 * tourist actually cares about on the sand. Not a new signal, not scoring: display
 * only, computed from the wind numbers already shown in the wind ConditionCard.
 */
export const getTowelComfort = (
  windSpeedKmh: number,
  gustKmh: number | undefined,
  beachType: BeachType,
  language: LanguageCode = 'gr'
): TowelComfort => {
  const effectiveKmh = typeof gustKmh === 'number' && Number.isFinite(gustKmh)
    ? Math.max(gustKmh, windSpeedKmh)
    : windSpeedKmh;

  const sandy = isSandyBeach(beachType);
  const breezyFrom = sandy ? SANDY_GUST_KMH : BREEZY_GUST_KMH;

  const tone: TowelComfortTone = effectiveKmh >= DIFFICULT_GUST_KMH
    ? 'difficult'
    : effectiveKmh >= breezyFrom
      ? 'breezy'
      : 'calm';

  // On sand the middle tier is about the sand, not the towel — same tone, truer sentence.
  const text = tone === 'breezy' && sandy ? BREEZY_SAND_COPY[language] : COPY[tone][language];
  return { tone, text };
};
