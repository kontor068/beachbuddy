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

/** A single hour's wind for the selected day (beach hours only). */
export interface HourlyWindPoint {
  /** Local (Greek) wall-clock hour, 0–23. */
  hour: number;
  beaufort: number;
  /** Compass direction the wind blows FROM. */
  windDirection: WindDirection;
}

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
  /**
   * Hour-by-hour wind for the day. When present and the regime changes during
   * the day (calm↔windy, or the sheltered coast flips), the summary becomes a
   * two-part "until HH:00 … then …" sentence instead of a static one.
   */
  hourlyWind?: HourlyWindPoint[];
  /**
   * Current local (Greek) wall-clock hour, 0–23. Provide ONLY when the selected
   * day is today; leave undefined for any other day. When set, the summary is
   * anchored on the present hour so a transition that has already happened (e.g.
   * "until 09:00 calm" read at 19:00) is dropped, and the line instead describes
   * conditions from now onward. This is what keeps the strip dynamic rather than
   * replaying a stale morning forecast.
   */
  nowHour?: number;
}

// The beach-relevant window of the day. Outside it we don't summarise (sea is
// closed for swimming), and a transition before/after it isn't worth a headline.
const BEACH_DAY_START_HOUR = 8;
const BEACH_DAY_END_HOUR = 20;

type DayRegime =
  | { kind: 'calm' }
  | { kind: 'windy'; windFrom: WindDirection; favoured: WindDirection; beaufort: number };

const regimeOf = (point: HourlyWindPoint): DayRegime =>
  point.beaufort <= 2
    ? { kind: 'calm' }
    : { kind: 'windy', windFrom: point.windDirection, favoured: LEEWARD_DIRECTION[point.windDirection], beaufort: point.beaufort };

const sameRegime = (a: DayRegime, b: DayRegime): boolean => {
  if (a.kind === 'calm' && b.kind === 'calm') return true;
  if (a.kind === 'windy' && b.kind === 'windy') return a.favoured === b.favoured;
  return false;
};

/**
 * First meaningful, persistent regime change within the given window, or null.
 * `hours` must already be limited to the relevant part of the day and sorted —
 * the caller decides where the window starts (the whole beach day for a future
 * day, or "now → end of day" for today), so a past transition is never surfaced.
 */
const detectTransition = (hours: HourlyWindPoint[]): { hour: number; morning: DayRegime; after: DayRegime } | null => {
  if (hours.length < 3) return null;

  const morning = regimeOf(hours[0]);
  for (let i = 1; i < hours.length; i++) {
    const candidate = regimeOf(hours[i]);
    if (sameRegime(candidate, morning)) continue;
    // Require the new regime to hold for at least 2 of the next 3 hours so a
    // single-hour blip doesn't trigger a "weather changes" headline.
    const windowAhead = hours.slice(i, i + 3);
    const persists = windowAhead.filter(point => sameRegime(regimeOf(point), candidate)).length >= 2;
    if (persists) return { hour: hours[i].hour, morning, after: candidate };
  }
  return null;
};

const formatHour = (hour: number): string => `${String(hour).padStart(2, '0')}:00`;

const regimeShortPhrase = (language: LanguageCode, regime: DayRegime): string => {
  if (regime.kind === 'calm') {
    return { en: 'calm almost everywhere', gr: 'ήρεμα σχεδόν παντού', fr: 'mer calme presque partout', de: 'fast überall ruhig', it: 'mare calmo quasi ovunque' }[language];
  }
  const favoured = FAVOURED_SHORE[language][regime.favoured];
  switch (language) {
    case 'gr': return `ευνοούνται οι ${favoured} παραλίες`;
    case 'fr': return `les plages ${favoured} sont favorisées`;
    case 'de': return `die ${favoured} Strände sind günstig`;
    case 'it': return `sono favorite le spiagge ${favoured}`;
    case 'en':
    default: return `the ${favoured}-facing beaches are favoured`;
  }
};

const transitionCopy = (language: LanguageCode, hour: number, morning: DayRegime, after: DayRegime): string => {
  const at = formatHour(hour);
  const morningPhrase = regimeShortPhrase(language, morning);
  // The "after" clause leads with the trigger so the change reads as a forecast.
  let afterPhrase: string;
  if (after.kind === 'calm') {
    afterPhrase = { en: 'it calms down everywhere', gr: 'ηρεμεί παντού', fr: 'le vent tombe partout', de: 'beruhigt es sich überall', it: 'il vento cala ovunque' }[language];
  } else {
    const favoured = FAVOURED_SHORE[language][after.favoured];
    if (morning.kind === 'calm') {
      // calm → windy: the wind builds. We don't name the wind direction here —
      // the favoured coast already implies it, and it dodges per-language case
      // agreement (Greek "βόρειος" vs accusative "βόρειο", etc.).
      switch (language) {
        case 'gr': afterPhrase = `δυναμώνει ο άνεμος και ευνοούνται οι ${favoured} παραλίες`; break;
        case 'fr': afterPhrase = `le vent se lève et les plages ${favoured} sont favorisées`; break;
        case 'de': afterPhrase = `der Wind frischt auf und die ${favoured} Strände sind günstig`; break;
        case 'it': afterPhrase = `si alza il vento e sono favorite le spiagge ${favoured}`; break;
        case 'en': default: afterPhrase = `the wind picks up and the ${favoured}-facing beaches are favoured`; break;
      }
    } else {
      // windy → windy: the wind veers, flipping the sheltered coast.
      switch (language) {
        case 'gr': afterPhrase = `γυρίζει ο άνεμος και ευνοούνται οι ${favoured} παραλίες`; break;
        case 'fr': afterPhrase = `le vent tourne et les plages ${favoured} sont favorisées`; break;
        case 'de': afterPhrase = `dreht der Wind und die ${favoured} Strände sind günstig`; break;
        case 'it': afterPhrase = `il vento gira e sono favorite le spiagge ${favoured}`; break;
        case 'en': default: afterPhrase = `the wind veers and the ${favoured}-facing beaches are favoured`; break;
      }
    }
  }
  switch (language) {
    case 'gr': return `Μέχρι τις ${at} ${morningPhrase}, μετά ${afterPhrase}.`;
    case 'fr': return `Jusqu'à ${at} ${morningPhrase}, puis ${afterPhrase}.`;
    case 'de': return `Bis ${at} ${morningPhrase}, danach ${afterPhrase}.`;
    case 'it': return `Fino alle ${at} ${morningPhrase}, poi ${afterPhrase}.`;
    case 'en':
    default: return `Until ${at} ${morningPhrase}, then ${afterPhrase}.`;
  }
};

// --- Condensed variants for mobile, where the full sentences are too much text.
// Same information, stripped to "shore + time" so it fits one short line.
const calmWordShort = (language: LanguageCode): string =>
  ({ en: 'calm', gr: 'ήρεμα', fr: 'calme', de: 'ruhig', it: 'calmo' })[language];

const regimeWordShort = (language: LanguageCode, regime: DayRegime): string =>
  regime.kind === 'calm' ? calmWordShort(language) : FAVOURED_SHORE[language][regime.favoured];

const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

const calmShort = (language: LanguageCode, kind: CalmKind): string => {
  const copy: Record<LanguageCode, Record<CalmKind, string>> = {
    en: { all: 'All beaches good', most: 'Most beaches good' },
    gr: { all: 'Όλες κατάλληλες', most: 'Σχεδόν όλες κατάλληλες' },
    fr: { all: 'Toutes adaptées', most: 'Presque toutes adaptées' },
    de: { all: 'Alle geeignet', most: 'Fast alle geeignet' },
    it: { all: 'Tutte adatte', most: 'Quasi tutte adatte' },
  };
  return copy[language][kind];
};

const windyShort = (language: LanguageCode, favoured: string): string => {
  switch (language) {
    case 'gr': return `Ευνοούνται οι ${favoured}`;
    case 'fr': return `Mieux ${favoured}`;
    case 'de': return `Am besten ${favoured}`;
    case 'it': return `Meglio ${favoured}`;
    case 'en':
    default: return `Best on the ${favoured} side`;
  }
};

const transitionShort = (language: LanguageCode, hour: number, morning: DayRegime, after: DayRegime): string => {
  const at = formatHour(hour);
  const a = capitalize(regimeWordShort(language, morning));
  const b = regimeWordShort(language, after);
  switch (language) {
    case 'gr': return `${a} ως τις ${at}, μετά ${b}`;
    case 'fr': return `${a} jusqu'à ${at}, puis ${b}`;
    case 'de': return `${a} bis ${at}, dann ${b}`;
    case 'it': return `${a} fino alle ${at}, poi ${b}`;
    case 'en':
    default: return `${a} until ${at}, then ${b}`;
  }
};

export interface IslandDaySummary {
  text: string;
  /** Condensed one-liner for mobile (shore + time, no full sentence). */
  short: string;
  /**
   * True only when the summary asserts that *every* beach is suitable. The
   * caller drops the redundant "N best beaches" count line in that case (no
   * point ranking when nothing is excluded).
   */
  allBeachesSuitable: boolean;
}

/** One-snapshot summary for a single, steady regime (no intra-day change). */
const staticRegimeSummary = (
  language: LanguageCode,
  regime: DayRegime,
  suitableCount: number,
  totalCount: number,
): IslandDaySummary => {
  if (regime.kind === 'calm') {
    const allSuitable = totalCount > 0 && suitableCount >= totalCount;
    const kind: CalmKind = allSuitable ? 'all' : 'most';
    return { text: calmCopy(language, kind), short: calmShort(language, kind), allBeachesSuitable: allSuitable };
  }
  const favoured = FAVOURED_SHORE[language][regime.favoured];
  const windName = WIND_NAME[language][regime.windFrom];
  return {
    text: windyCopy(language, windName, favoured, regime.beaufort, regime.beaufort >= 6),
    short: windyShort(language, favoured),
    allBeachesSuitable: false,
  };
};

export const buildIslandDaySummary = (input: IslandDaySummaryInput): IslandDaySummary | null => {
  const { language, beaufort, windDirection, suitableCount, totalCount, hourlyWind, nowHour } = input;
  if (typeof beaufort !== 'number' || Number.isNaN(beaufort)) return null;

  // When we have hour-by-hour wind, prefer it: it lets us (a) flag an intra-day
  // regime change with a time, and (b) — when the day is today — anchor on the
  // current hour so the line tracks the time of day instead of replaying a
  // morning that has already passed.
  if (hourlyWind && hourlyWind.length > 0) {
    const isToday = typeof nowHour === 'number';
    // Today: start the window at the current hour so a past transition is never
    // surfaced. Any other day: the whole beach day is still ahead.
    const fromHour = isToday ? Math.max(BEACH_DAY_START_HOUR, nowHour) : BEACH_DAY_START_HOUR;
    const window = hourlyWind
      .filter(point => point.hour >= fromHour && point.hour <= BEACH_DAY_END_HOUR)
      .sort((a, b) => a.hour - b.hour);

    const transition = detectTransition(window);
    if (transition) {
      return {
        text: transitionCopy(language, transition.hour, transition.morning, transition.after),
        short: transitionShort(language, transition.hour, transition.morning, transition.after),
        allBeachesSuitable: false,
      };
    }
    // No upcoming change. For today, the window's first hour IS "now", so describe
    // that current regime — this is what fixes "calm until 09:00" still showing at
    // 19:00: with the morning trimmed away, only the live windy regime remains.
    if (isToday && window.length > 0) {
      return staticRegimeSummary(language, regimeOf(window[0]), suitableCount, totalCount);
    }
  }

  const bft = Math.round(beaufort);

  // Calm regime: wind doesn't separate the coasts, so it's an island-wide call.
  if (bft <= 2) {
    const allSuitable = totalCount > 0 && suitableCount >= totalCount;
    const kind: CalmKind = allSuitable ? 'all' : 'most';
    return { text: calmCopy(language, kind), short: calmShort(language, kind), allBeachesSuitable: allSuitable };
  }

  // Windy regime: name the sheltered (leeward) coast. Fall back to the calm-ish
  // "most" line if we somehow lack a wind direction.
  if (!windDirection) {
    return { text: calmCopy(language, 'most'), short: calmShort(language, 'most'), allBeachesSuitable: false };
  }
  const favoured = FAVOURED_SHORE[language][LEEWARD_DIRECTION[windDirection]];
  const windName = WIND_NAME[language][windDirection];
  return {
    text: windyCopy(language, windName, favoured, bft, bft >= 6),
    short: windyShort(language, favoured),
    allBeachesSuitable: false,
  };
};
