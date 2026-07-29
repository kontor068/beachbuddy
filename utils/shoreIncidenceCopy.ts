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
 * So this module makes the DIFFERENCE VISIBLE IN WORDS instead. It states two things the app
 * genuinely knows per beach and has verified nationally (128 ground-truth cases): how the live
 * wind meets this shoreline, and where this shore sits among its neighbours today. Neither is a
 * wave height, and by gate 16 neither may ever contain a metre token.
 */

export interface ShoreIncidenceInput {
  /** cos(windFrom − beachFacing) in [-1,1] — the same value the cove guard computes. */
  onshore?: number;
  /** The level the MAP PIN shows, never the engine level: the two can differ by one band. */
  mapExposureLevel?: ExposureLevel;
  windDir: WindDirection;
  beaufort: number;
  /** Map-pin levels for every beach in the region, from the same Map the pin colour reads. */
  levelCounts?: { protected: number; partial: number; exposed: number };
  language: LanguageCode;
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

type IncidenceSentence = (adj: string, bft: number, unit: string) => string;

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

type NeighbourSentence = (calmer: number, rougher: number, total: number) => string;

const NEIGHBOURS: Record<ExposureLevel, LocalizedCopy<NeighbourSentence>> = {
  exposed: {
    gr: (c, _r, t) => `Στην περιοχή, ${c} από τις ${t} παραλίες είναι σήμερα πιο υπήνεμες από αυτή.`,
    en: (c, _r, t) => `In this area, ${c} of the ${t} beaches sit more sheltered than this one today.`,
    de: (c, _r, t) => `In dieser Gegend liegen heute ${c} von ${t} Stränden geschützter als dieser.`,
    fr: (c, _r, t) => `Dans cette zone, ${c} des ${t} plages sont aujourd'hui plus abritées que celle-ci.`,
    it: (c, _r, t) => `In questa zona, ${c} delle ${t} spiagge sono oggi più riparate di questa.`,
  },
  partial: {
    gr: (c, r) => `Στην περιοχή, ${c} παραλίες είναι πιο υπήνεμες και ${r} πιο εκτεθειμένες σήμερα.`,
    en: (c, r) => `In this area, ${c} beaches sit more sheltered and ${r} more exposed today.`,
    de: (c, r) => `In dieser Gegend liegen heute ${c} Strände geschützter und ${r} offener.`,
    fr: (c, r) => `Dans cette zone, ${c} plages sont plus abritées et ${r} plus exposées aujourd'hui.`,
    it: (c, r) => `In questa zona, oggi ${c} spiagge sono più riparate e ${r} più esposte.`,
  },
  protected: {
    gr: (_c, r, t) => `Στην περιοχή, ${r} από τις ${t} παραλίες είναι σήμερα πιο εκτεθειμένες από αυτή.`,
    en: (_c, r, t) => `In this area, ${r} of the ${t} beaches sit more exposed than this one today.`,
    de: (_c, r, t) => `In dieser Gegend liegen heute ${r} von ${t} Stränden offener als dieser.`,
    fr: (_c, r, t) => `Dans cette zone, ${r} des ${t} plages sont aujourd'hui plus exposées que celle-ci.`,
    it: (_c, r, t) => `In questa zona, ${r} delle ${t} spiagge sono oggi più esposte di questa.`,
  },
};

/**
 * Returns the sentence(s) to print above the wave graphic, or null when nothing may be said.
 *
 * Every suppression below is a case where the line would contradict something already on screen,
 * and a blank is the honest output — widening a threshold to cover it would be tuning copy until
 * the geometry agrees with it.
 */
export const buildShoreIncidenceLine = (input: ShoreIncidenceInput): string | null => {
  const { onshore, mapExposureLevel, beaufort, levelCounts, language } = input;
  if (!Number.isFinite(beaufort) || beaufort < SHORE_LINE_MIN_BEAUFORT) return null;

  const parts: string[] = [];

  if (typeof onshore === 'number' && Number.isFinite(onshore)) {
    const incidence = getWindIncidence(onshore);
    // HARD CONTRADICTION WITH THE PIN — say nothing. A shore the map paints red cannot be told
    // the wind blows off the land, and a shore it paints green cannot be told the wind is on it.
    // Measured 29/07/2026 at 5 Bft: 248 of 22.800 beach x sector cases (1,09%) land here.
    const contradictsPin = (incidence === 'offshore' && mapExposureLevel === 'exposed')
      || (incidence === 'onshore' && mapExposureLevel === 'protected');
    if (!contradictsPin) {
      const adjTable = WIND_ADJ_NOM[language] ?? WIND_ADJ_NOM.en;
      const sentence = getLocalizedCopy(language, INCIDENCE_SENTENCE[incidence]);
      parts.push(sentence(adjTable[input.windDir], beaufort, getLocalizedCopy(language, BFT_UNIT)));
    }
  }

  // Where this shore sits among its neighbours. Suppressed when the region has fewer than two
  // distinct pin levels (16 of 110 regions at a N 5 Bft — a comparison with nothing to compare),
  // and the beach's own bucket is excluded from both counts so no superlative is constructible.
  if (levelCounts && mapExposureLevel) {
    const total = levelCounts.protected + levelCounts.partial + levelCounts.exposed;
    const distinct = [levelCounts.protected, levelCounts.partial, levelCounts.exposed].filter(n => n > 0).length;
    if (total >= 2 && distinct >= 2) {
      const calmer = mapExposureLevel === 'exposed'
        ? levelCounts.protected + levelCounts.partial
        : mapExposureLevel === 'partial' ? levelCounts.protected : 0;
      const rougher = mapExposureLevel === 'protected'
        ? levelCounts.partial + levelCounts.exposed
        : mapExposureLevel === 'partial' ? levelCounts.exposed : 0;
      const needed = mapExposureLevel === 'exposed' ? calmer : mapExposureLevel === 'protected' ? rougher : calmer + rougher;
      if (needed > 0) {
        parts.push(getLocalizedCopy(language, NEIGHBOURS[mapExposureLevel])(calmer, rougher, total));
      }
    }
  }

  return parts.length > 0 ? parts.join(' ') : null;
};
