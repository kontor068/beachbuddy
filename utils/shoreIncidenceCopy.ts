import { LanguageCode, WindDirection } from '../types';
import type { ExposureLevel } from './windExposure';
import { getLocalizedCopy, type LocalizedCopy } from './i18n';
import { getWindIncidence, type WindIncidence } from './windIncidence';

/**
 * THE LINE THAT DIFFERS BETWEEN TWO BEACHES ON THE SAME ISLAND.
 *
 * Why this exists. One Open-Meteo MFWAM cell (~9 km) serves a whole small island, so on a meltemi
 * day 90,5% of the 2.850 beaches print exactly the same metre figure, and in 25 of 95 regions
 * EVERY beach prints it (Kos: one value for 38 beaches). A sheltered shore and a shore taking the
 * wind head-on read identically — reported 29/07/2026 from Ίος, and correct: the number IS the
 * same measurement.
 *
 * Two attempts to make the NUMBER differ were built and then refuted by measurement on the same
 * day, both because they would have written a false calm:
 *   • a geometry clamp fired on 2.678/2.850 beaches over a median 165° window — wider than the
 *     153° window that got the previous downward branch deleted (utils/waveModel.ts:131-146), and
 *     86,8% of its firing set was the offshore-wind class utils/coveWaveGuard.ts:36-44 calls a
 *     MANDATORY exclusion;
 *   • printing `modeledWaveHeightM` as a second "estimate for this shore" collapses to three
 *     values nationally at 5 Bft (0,45 / 0,70 / 0,90), carries no swell term at all (0,01 m beside
 *     a 1,60 m sea after a meltemi shuts down), and on 7 of 40 Ios beaches prints 2,5-4,5× HIGHER
 *     than the headline it was meant to explain.
 * Both are logged in docs/team/99-decision-log.md. Do not propose a third without new data.
 *
 * So this module makes the DIFFERENCE VISIBLE IN WORDS instead. It states the one thing the app
 * genuinely knows per beach and has verified nationally (128 ground-truth cases): how the live
 * wind meets this shoreline. That is not a wave height, and it may never contain a metre token.
 *
 * It used to state a second thing — where this shore sits among its neighbours — and that
 * sentence was removed on 29/07/2026 (see the note at buildShoreIncidenceLine). The input it
 * needed, `levelCounts`, was left behind and kept being computed and passed for nothing; it was
 * removed on 01/08/2026 along with the caller's dead accumulator.
 */

export interface ShoreIncidenceInput {
  /** cos(windFrom − beachFacing) in [-1,1] — the same value the cove guard computes. */
  onshore?: number;
  /** The level the MAP PIN shows, never the engine level: the two can differ by one band. */
  mapExposureLevel?: ExposureLevel;
  windDir: WindDirection;
  beaufort: number;
  /**
   * Ό,τι ΤΥΠΩΝΕΙ το hero για το Μποφόρ («3–4» όταν οι ριπές βγάζουν σκαλί — utils/beaufortRange).
   * Μόνο το κείμενο της πρότασης το χρησιμοποιεί· τα κατώφλια από κάτω κρίνουν με το `beaufort`.
   * Απουσία = ο αριθμός, όπως πριν.
   */
  beaufortLabel?: string;
  language: LanguageCode;
  /**
   * The "weather now" card directly above this line already said how the wind meets this
   * shore (WeatherNowContent.statesShoreIncidence). Drop the incidence sentence when it did:
   * the two are the same fact in different words, two lines apart, and the reader pays for
   * both. Since the neighbour comparison was removed, this suppresses the WHOLE line.
   */
  suppressIncidence?: boolean;
}

/**
 * Below this the wind is not a fact worth stating. Mirrors the light-wind floor in
 * utils/weatherNowCopy, which exists because an exposed beach in dead air used to print
 * «ο άνεμος χτυπάει πιο άμεσα» at 0 Bft.
 */
export const SHORE_LINE_MIN_BEAUFORT = 4;

const WIND_ADJ_NOM: Record<LanguageCode, Record<WindDirection, string>> = {
  gr: {
    [WindDirection.N]: 'βόρειος', [WindDirection.NE]: 'βορειοανατολικός', [WindDirection.E]: 'ανατολικός',
    [WindDirection.SE]: 'νοτιοανατολικός', [WindDirection.S]: 'νότιος', [WindDirection.SW]: 'νοτιοδυτικός',
    [WindDirection.W]: 'δυτικός', [WindDirection.NW]: 'βορειοδυτικός',
  },
  en: {
    [WindDirection.N]: 'northerly', [WindDirection.NE]: 'north-easterly', [WindDirection.E]: 'easterly',
    [WindDirection.SE]: 'south-easterly', [WindDirection.S]: 'southerly', [WindDirection.SW]: 'south-westerly',
    [WindDirection.W]: 'westerly', [WindDirection.NW]: 'north-westerly',
  },
  de: {
    [WindDirection.N]: 'Nordwind', [WindDirection.NE]: 'Nordostwind', [WindDirection.E]: 'Ostwind',
    [WindDirection.SE]: 'Südostwind', [WindDirection.S]: 'Südwind', [WindDirection.SW]: 'Südwestwind',
    [WindDirection.W]: 'Westwind', [WindDirection.NW]: 'Nordwestwind',
  },
  fr: {
    [WindDirection.N]: 'de nord', [WindDirection.NE]: 'de nord-est', [WindDirection.E]: "d'est",
    [WindDirection.SE]: 'de sud-est', [WindDirection.S]: 'de sud', [WindDirection.SW]: 'de sud-ouest',
    [WindDirection.W]: "d'ouest", [WindDirection.NW]: 'de nord-ouest',
  },
  it: {
    [WindDirection.N]: 'da nord', [WindDirection.NE]: 'da nord-est', [WindDirection.E]: 'da est',
    [WindDirection.SE]: 'da sud-est', [WindDirection.S]: 'da sud', [WindDirection.SW]: 'da sud-ovest',
    [WindDirection.W]: 'da ovest', [WindDirection.NW]: 'da nord-ovest',
  },
};

const BFT_UNIT: LocalizedCopy<string> = { en: 'Bft', gr: 'Μπφ', de: 'Bft', fr: 'Bft', it: 'Bft' };

type IncidenceSentence = (adj: string, bft: number | string, unit: string) => string;

const INCIDENCE_SENTENCE: Record<WindIncidence, LocalizedCopy<IncidenceSentence>> = {
  onshore: {
    gr: (a, b, u) => `Ο ${a} άνεμος ${b} ${u} πέφτει κατάμουτρα σε αυτή την ακτή.`,
    en: (a, b, u) => `The ${a} wind at ${b} ${u} blows straight onto this shore.`,
    de: (a, b, u) => `Der ${a} mit ${b} ${u} trifft diese Küste frontal.`,
    fr: (a, b, u) => `Le vent ${a} de ${b} ${u} frappe cette côte de face.`,
    it: (a, b, u) => `Il vento ${a} di ${b} ${u} colpisce questa costa di faccia.`,
  },
  cross: {
    gr: (a, b, u) => `Ο ${a} άνεμος ${b} ${u} πιάνει αυτή την ακτή πλάγια.`,
    en: (a, b, u) => `The ${a} wind at ${b} ${u} catches this shore side-on.`,
    de: (a, b, u) => `Der ${a} mit ${b} ${u} trifft diese Küste seitlich.`,
    fr: (a, b, u) => `Le vent ${a} de ${b} ${u} prend cette côte de côté.`,
    it: (a, b, u) => `Il vento ${a} di ${b} ${u} prende questa costa di lato.`,
  },
  offshore: {
    gr: (a, b, u) => `Ο ${a} άνεμος ${b} ${u} φυσάει από τη στεριά προς τη θάλασσα εδώ.`,
    en: (a, b, u) => `The ${a} wind at ${b} ${u} blows off the land here.`,
    de: (a, b, u) => `Der ${a} mit ${b} ${u} weht hier ablandig.`,
    fr: (a, b, u) => `Le vent ${a} de ${b} ${u} souffle de la terre vers le large ici.`,
    it: (a, b, u) => `Il vento ${a} di ${b} ${u} soffia da terra verso il largo qui.`,
  },
};

/**
 * From this wind up, an offshore breeze is strong enough to carry a float out faster than a
 * child can paddle back. It is the same Beaufort at which utils/offshoreFlatWater lets a flat
 * offshore shore read yellow instead of orange — deliberately the same number, because the two
 * are one fact: the wind that flattens the water is the wind that pushes it away from the beach.
 * Saying the first without the second is the version of this feature that gets someone hurt.
 *
 * Below 5 the app already says enough — the colour is yellow or blue on its own and the standing
 * `offshore_wind` warning (services/recommendationService) covers 4 Bft.
 */
export const OFFSHORE_DRIFT_MIN_BEAUFORT = 5;

/**
 * The RNLI's standing advice, in one sentence. Not hedged into "may possibly": the wording that
 * works is the wording that says what to do (components/planner/tripPlannerCopy carries the same
 * advice for the planner, worded for a whole-day plan rather than a beach page).
 */
const OFFSHORE_DRIFT_SENTENCE: LocalizedCopy<string> = {
  gr: 'Το νερό μένει επίπεδο, αλλά ο αέρας σπρώχνει προς τα ανοιχτά: φουσκωτά, στρώματα και SUP παρασύρονται μακριά από την ακτή — κράτα τα παιδιά κοντά.',
  en: 'The water stays flat, but the wind pushes seaward: inflatables, airbeds and SUPs are carried away from shore — keep children close in.',
  de: 'Das Wasser bleibt glatt, doch der Wind drückt seewärts: Luftmatratzen, Schlauchboote und SUPs treiben vom Ufer ab – Kinder nah bei sich halten.',
  fr: "L'eau reste plate, mais le vent pousse vers le large : bouées, matelas et SUP sont emportés loin du bord — gardez les enfants près de vous.",
  it: "L'acqua resta piatta, ma il vento spinge al largo: gonfiabili, materassini e SUP vengono portati via dalla riva — tieni i bambini vicini.",
};

/**
 * Returns the sentence(s) to print above the wave graphic, or null when nothing may be said.
 *
 * Every suppression below is a case where the line would contradict something already on screen,
 * and a blank is the honest output — widening a threshold to cover it would be tuning copy until
 * the geometry agrees with it.
 */
export const buildShoreIncidenceLine = (input: ShoreIncidenceInput): string | null => {
  const { onshore, mapExposureLevel, beaufort, language } = input;
  if (!Number.isFinite(beaufort) || beaufort < SHORE_LINE_MIN_BEAUFORT) return null;

  const parts: string[] = [];

  if (typeof onshore === 'number' && Number.isFinite(onshore)) {
    const incidence = getWindIncidence(onshore);
    // HARD CONTRADICTION WITH THE PIN — say nothing. A shore the map paints red cannot be told
    // the wind blows off the land, and a shore it paints green cannot be told the wind is on it.
    // Measured 29/07/2026 at 5 Bft: 248 of 22.800 beach x sector cases (1,09%) land here.
    const contradictsPin = (incidence === 'offshore' && mapExposureLevel === 'exposed')
      || (incidence === 'onshore' && mapExposureLevel === 'protected');
    if (!contradictsPin && !input.suppressIncidence) {
      const adjTable = WIND_ADJ_NOM[language] ?? WIND_ADJ_NOM.en;
      const sentence = getLocalizedCopy(language, INCIDENCE_SENTENCE[incidence]);
      parts.push(sentence(adjTable[input.windDir], input.beaufortLabel ?? beaufort, getLocalizedCopy(language, BFT_UNIT)));
    }
    // THE DRIFT WARNING IS NOT SUPPRESSED WITH THE SENTENCE ABOVE, and that is the point.
    //
    // `suppressIncidence` exists because the card higher up the page already states the same
    // FACT in almost the same words, and the reader pays for both. This is not the same fact:
    // the card says how the wind meets the shore, this says what to do about it. Dropping it
    // alongside would mean the beaches most likely to carry a float out to sea — the ones whose
    // card is confident enough about the wind to trigger the suppression — are exactly the ones
    // that never see the warning.
    if (!contradictsPin && incidence === 'offshore' && beaufort >= OFFSHORE_DRIFT_MIN_BEAUFORT) {
      parts.push(getLocalizedCopy(language, OFFSHORE_DRIFT_SENTENCE));
    }
  }

  // The "where this shore sits among its neighbours" sentence was removed on purpose: a count of
  // how many other beaches are more/less exposed told the reader nothing about this beach today.

  return parts.length > 0 ? parts.join(' ') : null;
};
