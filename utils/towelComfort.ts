import { BeachType, LanguageCode } from '../types';
import { ExposureLevel } from './windExposure';

export type TowelComfortTone = 'calm' | 'breezy' | 'difficult';

export interface TowelComfort {
  tone: TowelComfortTone;
  text: string;
}

// Same wind numbers already shown in the wind card, just said the way a tourist actually
// thinks about a beach day — "will my towel/umbrella survive" — instead of "24 km/h, 4 Bft".
//
// The MEAN wind decides the tone; the gust can only add to it, and only when there is real
// wind underneath. That ordering is not cosmetic — it is the same calibration the rest of the
// app got on 2026-06-26 when we moved off the synthetic gust estimate (wind*1.2) onto the real
// wind_gusts_10m feed (see GUST_MIN_BASE_BEAUFORT in services/recommendationService.ts). The
// real feed is a peak-gust diagnostic with a 1.8-2.9x factor over the mean in normal Greek
// summer conditions, and getWeatherGustKmph hands us the DAY's maximum across 10:00-18:00. A
// naked "gust >= 35 km/h" gate therefore fired on an ordinary 3-4 Bft day: measured on
// 2026-07-31, 13 of 24 sampled beaches nationally were told "hard to keep an umbrella up"
// while the wind card directly above them said 3 or 4 Bft — including Παραλία Φλοίσβου at a
// 17 km/h mean. The page contradicted itself, and the harsher of the two lines was the wrong one.
const DIFFICULT_MEAN_KMH = 29;    // 5 Bft of actual wind — this alone defeats a beach umbrella
const DIFFICULT_GUST_KMH = 50;    // ~7 Bft gust; only counts on a beach that is already windy
const GUST_COUNTS_FROM_MEAN_KMH = 20; // 4 Bft: below this a big gust is a spike, not a beach day
// A gust may push the mild tier too, but only once the mean is a real 3 Bft — otherwise the
// 2x gust factor alone would put "sand in the air" on a 2 Bft morning.
const BREEZY_GUST_FLOOR_MEAN_KMH = 12;
// Two entry points into the middle tier, because the two beach types stop being
// comfortable at different moments:
//   • sandy: blowing sand starts stinging around 4 Bft (20 km/h), well before anything lifts.
//   • everything else: nothing is wrong until the wind itself starts pulling at the towel,
//     which is 5 Bft (29 km/h per getBeaufortLevel).
const SANDY_KMH = 20;
const BREEZY_KMH = 29;

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

const SOFTER_TONE: Record<TowelComfortTone, TowelComfortTone> = {
  difficult: 'breezy',
  breezy: 'calm',
  calm: 'calm',
};

/**
 * "Towel Comfort" — the same wind data already on the page, reworded for what a
 * tourist actually cares about on the sand. Not a new signal, not scoring: display
 * only, computed from the wind numbers already shown in the wind ConditionCard.
 *
 * `exposureLevel` may only SOFTEN the tone, never harden it: a beach the page has just
 * called «Προστατευμένη» must not be told in the next line that an umbrella won't stand.
 * Pass the same exposure level the map pin is coloured with, so the two agree.
 */
export const getTowelComfort = (
  windSpeedKmh: number,
  gustKmh: number | undefined,
  beachType: BeachType,
  language: LanguageCode = 'gr',
  exposureLevel?: ExposureLevel
): TowelComfort => {
  const gust = typeof gustKmh === 'number' && Number.isFinite(gustKmh)
    ? Math.max(gustKmh, windSpeedKmh)
    : undefined;

  const sandy = isSandyBeach(beachType);
  const breezyFrom = sandy ? SANDY_KMH : BREEZY_KMH;

  const gustMakesItDifficult = windSpeedKmh >= GUST_COUNTS_FROM_MEAN_KMH
    && (gust ?? 0) >= DIFFICULT_GUST_KMH;
  const gustMakesItBreezy = windSpeedKmh >= BREEZY_GUST_FLOOR_MEAN_KMH
    && (gust ?? 0) >= breezyFrom;

  let tone: TowelComfortTone = windSpeedKmh >= DIFFICULT_MEAN_KMH || gustMakesItDifficult
    ? 'difficult'
    : windSpeedKmh >= breezyFrom || gustMakesItBreezy
      ? 'breezy'
      : 'calm';

  // Mirrors the protected-beach relief in getEffectiveBeaufortForComfort: on a genuinely
  // sheltered shore the area-wide wind never arrives at the towel. Capped at 5 Bft of mean
  // wind — above that even a protected beach stops being a calm claim we can back.
  if (exposureLevel === 'protected' && windSpeedKmh < 39) {
    tone = SOFTER_TONE[tone];
  }

  // On sand the middle tier is about the sand, not the towel — same tone, truer sentence.
  const text = tone === 'breezy' && sandy ? BREEZY_SAND_COPY[language] : COPY[tone][language];
  return { tone, text };
};
