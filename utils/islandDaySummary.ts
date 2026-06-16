import { LanguageCode, WindDirection } from '../types';

/**
 * Builds the one-line "what's happening today" summary shown in the island
 * context strip (above the map). It is a deliberately high-level, island-wide
 * narrative — NOT a per-beach claim:
 *   - Calm regime (≤2 Bft): the sea is flat everywhere, so wind exposure does
 *     not separate beaches → "all / most beaches are suitable".
 *   - Windy regime (≥3 Bft): exposure starts to matter, so we name the leeward
 *     (sheltered) coast. The favoured shore is simply the one OPPOSITE the
 *     direction the wind blows from — i.e. the land shelters it. This mirrors
 *     the core of the per-beach wind-exposure model without overclaiming any
 *     single beach.
 *
 * Returns null when there is no forecast to summarise (caller hides the line).
 */

// The wind blows FROM `windDirection`; the sheltered beaches sit on the OPPOSITE
// (leeward) coast.
const LEEWARD_DIRECTION: Record<WindDirection, WindDirection> = {
  [WindDirection.N]: WindDirection.S,
  [WindDirection.NE]: WindDirection.SW,
  [WindDirection.E]: WindDirection.W,
  [WindDirection.SE]: WindDirection.NW,
  [WindDirection.S]: WindDirection.N,
  [WindDirection.SW]: WindDirection.NE,
  [WindDirection.W]: WindDirection.E,
  [WindDirection.NW]: WindDirection.SE,
};

// Wind name in the grammatical form each template needs (e.g. Greek accusative
// "βόρειο" for "Με βόρειο άνεμο").
const WIND_NAME: Record<LanguageCode, Record<WindDirection, string>> = {
  en: {
    [WindDirection.N]: 'north', [WindDirection.NE]: 'northeast', [WindDirection.E]: 'east', [WindDirection.SE]: 'southeast',
    [WindDirection.S]: 'south', [WindDirection.SW]: 'southwest', [WindDirection.W]: 'west', [WindDirection.NW]: 'northwest',
  },
  gr: {
    [WindDirection.N]: 'βόρειο', [WindDirection.NE]: 'βορειοανατολικό', [WindDirection.E]: 'ανατολικό', [WindDirection.SE]: 'νοτιοανατολικό',
    [WindDirection.S]: 'νότιο', [WindDirection.SW]: 'νοτιοδυτικό', [WindDirection.W]: 'δυτικό', [WindDirection.NW]: 'βορειοδυτικό',
  },
  fr: {
    [WindDirection.N]: 'nord', [WindDirection.NE]: 'nord-est', [WindDirection.E]: 'est', [WindDirection.SE]: 'sud-est',
    [WindDirection.S]: 'sud', [WindDirection.SW]: 'sud-ouest', [WindDirection.W]: 'ouest', [WindDirection.NW]: 'nord-ouest',
  },
  de: {
    [WindDirection.N]: 'Nord', [WindDirection.NE]: 'Nordost', [WindDirection.E]: 'Ost', [WindDirection.SE]: 'Südost',
    [WindDirection.S]: 'Süd', [WindDirection.SW]: 'Südwest', [WindDirection.W]: 'West', [WindDirection.NW]: 'Nordwest',
  },
  it: {
    [WindDirection.N]: 'Nord', [WindDirection.NE]: 'Nord-est', [WindDirection.E]: 'Est', [WindDirection.SE]: 'Sud-est',
    [WindDirection.S]: 'Sud', [WindDirection.SW]: 'Sud-ovest', [WindDirection.W]: 'Ovest', [WindDirection.NW]: 'Nord-ovest',
  },
};

// Phrase naming the favoured (leeward) shore, agreeing with "beaches"/"plages"
// etc. in each language.
const FAVOURED_SHORE: Record<LanguageCode, Record<WindDirection, string>> = {
  en: {
    [WindDirection.N]: 'north', [WindDirection.NE]: 'northeast', [WindDirection.E]: 'east', [WindDirection.SE]: 'southeast',
    [WindDirection.S]: 'south', [WindDirection.SW]: 'southwest', [WindDirection.W]: 'west', [WindDirection.NW]: 'northwest',
  },
  gr: {
    [WindDirection.N]: 'βόρειες', [WindDirection.NE]: 'βορειοανατολικές', [WindDirection.E]: 'ανατολικές', [WindDirection.SE]: 'νοτιοανατολικές',
    [WindDirection.S]: 'νότιες', [WindDirection.SW]: 'νοτιοδυτικές', [WindDirection.W]: 'δυτικές', [WindDirection.NW]: 'βορειοδυτικές',
  },
  fr: {
    [WindDirection.N]: 'au nord', [WindDirection.NE]: 'au nord-est', [WindDirection.E]: "à l'est", [WindDirection.SE]: 'au sud-est',
    [WindDirection.S]: 'au sud', [WindDirection.SW]: 'au sud-ouest', [WindDirection.W]: "à l'ouest", [WindDirection.NW]: 'au nord-ouest',
  },
  de: {
    [WindDirection.N]: 'nördlichen', [WindDirection.NE]: 'nordöstlichen', [WindDirection.E]: 'östlichen', [WindDirection.SE]: 'südöstlichen',
    [WindDirection.S]: 'südlichen', [WindDirection.SW]: 'südwestlichen', [WindDirection.W]: 'westlichen', [WindDirection.NW]: 'nordwestlichen',
  },
  it: {
    [WindDirection.N]: 'a nord', [WindDirection.NE]: 'a nord-est', [WindDirection.E]: 'a est', [WindDirection.SE]: 'a sud-est',
    [WindDirection.S]: 'a sud', [WindDirection.SW]: 'a sud-ovest', [WindDirection.W]: 'a ovest', [WindDirection.NW]: 'a nord-ovest',
  },
};

type CalmKind = 'all' | 'most';

const calmCopy = (language: LanguageCode, kind: CalmKind): string => {
  const copy: Record<LanguageCode, Record<CalmKind, string>> = {
    en: {
      all: 'Calm day — every beach is good for a swim.',
      most: 'Calm seas almost everywhere — most beaches are suitable.',
    },
    gr: {
      all: 'Ήρεμη μέρα — όλες οι παραλίες είναι κατάλληλες για κολύμπι.',
      most: 'Ήρεμη θάλασσα σχεδόν παντού — οι περισσότερες παραλίες είναι κατάλληλες.',
    },
    fr: {
      all: 'Journée calme — toutes les plages se prêtent à la baignade.',
      most: 'Mer calme presque partout — la plupart des plages sont adaptées.',
    },
    de: {
      all: 'Ruhiger Tag — alle Strände laden zum Baden ein.',
      most: 'Fast überall ruhige See — die meisten Strände sind geeignet.',
    },
    it: {
      all: 'Giornata calma — tutte le spiagge sono adatte al bagno.',
      most: 'Mare calmo quasi ovunque — la maggior parte delle spiagge è adatta.',
    },
  };
  return copy[language][kind];
};

const windyCopy = (
  language: LanguageCode,
  windName: string,
  favoured: string,
  beaufort: number,
  strong: boolean,
): string => {
  switch (language) {
    case 'gr':
      return strong
        ? `Με δυνατό ${windName} άνεμο ${beaufort} μποφόρ, προτιμήστε τις απάνεμες ${favoured} παραλίες.`
        : `Με ${windName} άνεμο ${beaufort} μποφόρ, ευνοούνται οι ${favoured} παραλίες.`;
    case 'fr':
      return strong
        ? `Vent de ${windName} fort (${beaufort} Bft) — préférez les plages ${favoured}, abritées.`
        : `Avec un vent de ${windName} (${beaufort} Bft), privilégiez les plages ${favoured}, abritées.`;
    case 'de':
      return strong
        ? `Starker ${windName}wind (${beaufort} Bft) — am besten die geschützten ${favoured} Strände.`
        : `Bei ${windName}wind (${beaufort} Bft) sind die ${favoured} Strände am besten geschützt.`;
    case 'it':
      return strong
        ? `Forte vento da ${windName} (${beaufort} Bft) — meglio le spiagge ${favoured}, riparate.`
        : `Con vento da ${windName} (${beaufort} Bft), sono favorite le spiagge ${favoured}, riparate.`;
    case 'en':
    default:
      return strong
        ? `Strong ${windName} wind (${beaufort} Bft) — stick to the sheltered ${favoured}-facing beaches.`
        : `With a ${windName} wind at ${beaufort} Bft, head for the sheltered ${favoured}-facing beaches.`;
  }
};

export interface IslandDaySummaryInput {
  language: LanguageCode;
  /** Beaufort level for the selected forecast day; undefined when no forecast. */
  beaufort?: number;
  /** Compass direction the wind blows FROM. */
  windDirection?: WindDirection;
  /** Beaches judged suitable for the selected day. */
  suitableCount: number;
  /** Total beaches on the island. */
  totalCount: number;
}

export interface IslandDaySummary {
  text: string;
  /**
   * True only when the summary asserts that *every* beach is suitable. The
   * caller drops the redundant "N best beaches" count line in that case (no
   * point ranking when nothing is excluded).
   */
  allBeachesSuitable: boolean;
}

export const buildIslandDaySummary = (input: IslandDaySummaryInput): IslandDaySummary | null => {
  const { language, beaufort, windDirection, suitableCount, totalCount } = input;
  if (typeof beaufort !== 'number' || Number.isNaN(beaufort)) return null;

  const bft = Math.round(beaufort);

  // Calm regime: wind doesn't separate the coasts, so it's an island-wide call.
  if (bft <= 2) {
    const allSuitable = totalCount > 0 && suitableCount >= totalCount;
    return { text: calmCopy(language, allSuitable ? 'all' : 'most'), allBeachesSuitable: allSuitable };
  }

  // Windy regime: name the sheltered (leeward) coast. Fall back to the calm-ish
  // "most" line if we somehow lack a wind direction.
  if (!windDirection) {
    return { text: calmCopy(language, 'most'), allBeachesSuitable: false };
  }
  const favoured = FAVOURED_SHORE[language][LEEWARD_DIRECTION[windDirection]];
  const windName = WIND_NAME[language][windDirection];
  return { text: windyCopy(language, windName, favoured, bft, bft >= 6), allBeachesSuitable: false };
};
