import { Beach, LanguageCode, SuitableBeach } from '../types';
import { getBeaufortLevel } from './weatherUtils';
import { seaStateSeverityM } from './waveCharacter';
import { getAmenityChips } from './amenities';
import { hasTrulyEasyAccess } from './access';
import { getTopPickTiming } from './topPickTiming';
import { translations } from '../translations';

/**
 * «Γιατί ΑΥΤΗ και όχι οι άλλες δύο;»
 *
 * The podium already had a per-beach `explanation` from the recommendation service, and on a
 * calm day it printed the same sentence three times — "φαίνεται πιθανόν πιο προστατευμένη από
 * ανοιχτές παραλίες σήμερα. Ζεστή μέρα στους 36°C" — because that copy describes ONE beach
 * against the open sea, never against the other two picks. Three identical lines under a
 * heading that asks «Γιατί αυτές οι τρεις;» read as a machine talking.
 *
 * So this module answers a strictly comparative question: what does this beach have that
 * NEITHER of the others has? Every claim here is gated on being true against both siblings —
 * "the calmest of the three" needs a genuinely lower Beaufort, "the only sandy one" needs the
 * other two not to be sandy. When nothing separates a beach, it gets a plain factual profile
 * line instead of a manufactured superlative: no claim is better than a claim the data can't
 * carry. That is the same bias-to-under-claim rule the amenity work runs on.
 *
 * Attribute nouns (άμμος, ρηχά νερά, ήσυχη, φυσική σκιά) are taken from the existing 5-language
 * `filterOptions` vocabulary rather than retranslated, so a chip and this rail can never
 * disagree about what a beach is.
 */

export type TopPickAxis =
  | 'calmestWind'
  | 'mostSheltered'
  | 'calmestSea'
  | 'longestWindow'
  | 'shallowWater'
  | 'sandy'
  | 'facilities'
  | 'quietest'
  | 'easiestAccess'
  | 'shade'
  | 'profile';

export interface TopPickCandidate {
  beach: Beach;
  context?: SuitableBeach | null;
}

export interface TopPickDistinguisher {
  beachId: number;
  axis: TopPickAxis;
  /** One short sentence. Never empty — falls back to the recommendation's own explanation. */
  claim: string;
}

type Facts = {
  beachId: number;
  beach: Beach;
  context?: SuitableBeach | null;
  beaufort?: number;
  seaSeverityM?: number;
  windowEndMinutes?: number;
  windowEndLabel?: string;
  isProtected: boolean;
  isEnclosedCove: boolean;
  isShallow: boolean;
  isSandy: boolean;
  isQuiet: boolean;
  isEasyAccess: boolean;
  hasShade: boolean;
  facilityCount: number;
  facilityLabels: string[];
};

const filterWord = (language: LanguageCode, key: string): string => {
  const options = translations[language]?.filterOptions as Record<string, string> | undefined;
  return options?.[key] || '';
};

/**
 * Greek shore composition reads as an adjective in the filter vocabulary («Αμμώδης»,
 * «Βραχώδης») because there it labels a chip. Inside a comma list it needs the noun, so these
 * two fall back to the words the dataset itself uses in `metadata.terrain.label` («λεπτή
 * άμμος», «βότσαλα, βράχια») — the project's own vocabulary, not a new translation. Every
 * other language keeps the filter word, which already reads naturally in a sentence.
 */
const compositionWord = (language: LanguageCode, beachType: string): string => {
  if (language === 'gr') {
    if (beachType === 'sandy') return 'άμμος';
    if (beachType === 'rocky') return 'βράχια';
  }
  return filterWord(language, beachType);
};

/** «από τις τρεις» / «of the three» — the comparison is meaningless with a single pick. */
const groupPhrase = (language: LanguageCode, count: number): string => {
  const numberWord: Record<LanguageCode, Record<number, string>> = {
    gr: { 2: 'δύο', 3: 'τρεις', 4: 'τέσσερις' },
    en: { 2: 'two', 3: 'three', 4: 'four' },
    de: { 2: 'zwei', 3: 'drei', 4: 'vier' },
    fr: { 2: 'deux', 3: 'trois', 4: 'quatre' },
    it: { 2: 'due', 3: 'tre', 4: 'quattro' },
  };
  const word = numberWord[language]?.[count] || numberWord.en[count] || String(count);
  const frame: Record<LanguageCode, string> = {
    gr: `από τις ${word}`,
    en: `of the ${word}`,
    de: `der ${word}`,
    fr: `des ${word}`,
    it: `delle ${word}`,
  };
  return frame[language] || frame.en;
};

const localized = (language: LanguageCode, copy: Record<LanguageCode, string>): string =>
  copy[language] ?? copy.en;

const collectFacts = (candidate: TopPickCandidate, language: LanguageCode, selectedDate?: Date): Facts => {
  const { beach, context } = candidate;
  const metadata = beach.metadata;

  const windKmph = context?.windSpeedKmph;
  const beaufort = typeof windKmph === 'number' && Number.isFinite(windKmph)
    ? getBeaufortLevel(windKmph)
    : undefined;

  // Decision-grade sea state, exactly as the card computes it — a 0.45 m short chop and a
  // 0.45 m long roll are the same number and a different sea.
  const rawWave = context?.seaStateWaveM ?? context?.waveHeightM;
  const seaSeverityM = typeof rawWave === 'number' && Number.isFinite(rawWave)
    ? (seaStateSeverityM(rawWave, context?.seaStatePeriodS) ?? rawWave)
    : undefined;

  const timing = getTopPickTiming(context?.bestBeachTime, selectedDate);
  const hasWindow = timing.state === 'active' || timing.state === 'upcoming';

  const facilityChips = getAmenityChips(beach, language).filter(chip => (
    chip.key !== 'noFacilities' && chip.key !== 'unknownFacilities'
      && chip.key !== 'organizedFacilities' && chip.key !== 'seasonalFacilities'
  ));

  const popularityTier = beach.popularity?.tier;

  return {
    beachId: beach.id,
    beach,
    context,
    beaufort,
    seaSeverityM,
    windowEndMinutes: hasWindow ? timing.endMinutes : undefined,
    windowEndLabel: hasWindow ? timing.endLabel : undefined,
    // «Protected» stays reserved for beaches the geometry actually clears today — the same
    // protected-only rule the «πιο υπήνεμη επιλογή» label follows.
    isProtected: context?.exposureLevel === 'protected' && context?.canClaimWindProtection !== false,
    isEnclosedCove: context?.enclosedCove === true && context?.canClaimWindProtection !== false,
    isShallow: beach.characteristics?.shallowWaters === true || beach.waterDepth === 'shallow',
    isSandy: beach.beachType === 'sandy',
    isQuiet: popularityTier === 'secluded' || popularityTier === 'quiet'
      || beach.environment?.quiet === true || metadata?.environment?.quiet === true,
    isEasyAccess: hasTrulyEasyAccess(beach),
    hasShade: beach.amenities?.naturalShade === true,
    facilityCount: facilityChips.length,
    facilityLabels: facilityChips.slice(0, 2).map(chip => chip.label),
  };
};

/** True when `value` is strictly the lowest and clears every sibling by `margin`. */
const isLowestBy = (value: number | undefined, others: (number | undefined)[], margin: number): boolean => {
  if (typeof value !== 'number') return false;
  const known = others.filter((other): other is number => typeof other === 'number');
  if (known.length !== others.length || known.length === 0) return false;
  return known.every(other => other - value >= margin);
};

/** True when `value` is strictly the highest and clears every sibling by `margin`. */
const isHighestBy = (value: number | undefined, others: (number | undefined)[], margin: number): boolean => {
  if (typeof value !== 'number') return false;
  const known = others.filter((other): other is number => typeof other === 'number');
  if (known.length !== others.length || known.length === 0) return false;
  return known.every(other => value - other >= margin);
};

const onlyOne = (value: boolean, others: boolean[]): boolean => value && others.every(other => !other);

type AxisRule = {
  axis: TopPickAxis;
  holds: (self: Facts, others: Facts[]) => boolean;
  claim: (self: Facts, language: LanguageCode, group: string) => string;
};

/**
 * Priority order. The first axes are the ones a visitor is actually choosing between on a
 * beach day (wind, shelter, sea, how long it lasts); the rest break ties on what the beach
 * itself is. Each beach wins at most one axis, so three picks always read as three answers.
 */
const AXIS_RULES: AxisRule[] = [
  {
    axis: 'calmestWind',
    holds: (self, others) => isLowestBy(self.beaufort, others.map(other => other.beaufort), 1),
    claim: (self, language, group) => {
      const unit = language === 'gr' ? 'Μπφ' : 'Bft';
      const value = `${self.beaufort} ${unit}`;
      return localized(language, {
        gr: `Ο πιο ήρεμος αέρας ${group} — ${value} στην ακτή.`,
        en: `The calmest wind ${group} — ${value} on the shore.`,
        de: `Der ruhigste Wind ${group} — ${value} am Ufer.`,
        fr: `Le vent le plus calme ${group} — ${value} sur le rivage.`,
        it: `Il vento più calmo ${group} — ${value} sulla riva.`,
      });
    },
  },
  {
    axis: 'mostSheltered',
    holds: (self, others) => onlyOne(self.isProtected, others.map(other => other.isProtected)),
    claim: (self, language, group) => (self.isEnclosedCove
      ? localized(language, {
        gr: `Κλειστός όρμος — η μόνη ${group} που την προστατεύει το ίδιο το σχήμα της ακτής.`,
        en: `An enclosed cove — the only one ${group} sheltered by the shape of the coast itself.`,
        de: `Eine geschlossene Bucht — als einzige ${group} von der Küstenform selbst geschützt.`,
        fr: `Une crique fermée — la seule ${group} abritée par la forme même de la côte.`,
        it: `Una baia chiusa — l'unica ${group} protetta dalla forma stessa della costa.`,
      })
      : localized(language, {
        gr: `Η μόνη ${group} που η ακτή της κόβει τον σημερινό αέρα.`,
        en: `The only one ${group} whose coastline blocks today's wind.`,
        de: `Die einzige ${group}, deren Küste den heutigen Wind abhält.`,
        fr: `La seule ${group} dont la côte coupe le vent du jour.`,
        it: `L'unica ${group} la cui costa ferma il vento di oggi.`,
      })),
  },
  {
    axis: 'calmestSea',
    holds: (self, others) => isLowestBy(self.seaSeverityM, others.map(other => other.seaSeverityM), 0.15),
    claim: (_self, language, group) => localized(language, {
      gr: `Η πιο ήρεμη θάλασσα ${group}.`,
      en: `The calmest sea ${group}.`,
      de: `Die ruhigste See ${group}.`,
      fr: `La mer la plus calme ${group}.`,
      it: `Il mare più calmo ${group}.`,
    }),
  },
  {
    axis: 'longestWindow',
    holds: (self, others) => isHighestBy(self.windowEndMinutes, others.map(other => other.windowEndMinutes), 60),
    claim: (self, language) => {
      const end = self.windowEndLabel || '';
      return localized(language, {
        gr: `Κρατάει περισσότερο — καλή ως τις ${end}, αργότερα από τις άλλες.`,
        en: `Lasts longest — good until ${end}, later than the others.`,
        de: `Hält am längsten — gut bis ${end}, später als die anderen.`,
        fr: `Tient le plus longtemps — bonne jusqu'à ${end}, plus tard que les autres.`,
        it: `Dura di più — buona fino alle ${end}, più tardi delle altre.`,
      });
    },
  },
  {
    axis: 'shallowWater',
    holds: (self, others) => onlyOne(self.isShallow, others.map(other => other.isShallow)),
    claim: (_self, language, group) => localized(language, {
      gr: `Η μόνη με ρηχά νερά ${group} — βολικό αν έχεις μικρά παιδιά.`,
      en: `The only one with shallow water ${group} — handy with small children.`,
      de: `Als einzige ${group} mit flachem Wasser — praktisch mit kleinen Kindern.`,
      fr: `La seule ${group} avec de l'eau peu profonde — pratique avec de jeunes enfants.`,
      it: `L'unica ${group} con acqua bassa — comoda con bambini piccoli.`,
    }),
  },
  {
    axis: 'sandy',
    holds: (self, others) => onlyOne(self.isSandy, others.map(other => other.isSandy)),
    claim: (_self, language, group) => localized(language, {
      gr: `Η μόνη αμμουδιά ${group}.`,
      en: `The only sandy beach ${group}.`,
      de: `Der einzige Sandstrand ${group}.`,
      fr: `La seule plage de sable ${group}.`,
      it: `L'unica spiaggia di sabbia ${group}.`,
    }),
  },
  {
    axis: 'facilities',
    holds: (self, others) => self.facilityCount >= 2
      && self.facilityLabels.length > 0
      && isHighestBy(self.facilityCount, others.map(other => other.facilityCount), 2),
    claim: (self, language, group) => {
      const list = self.facilityLabels.join(', ').toLocaleLowerCase(language === 'gr' ? 'el' : language);
      return localized(language, {
        gr: `Η πιο οργανωμένη ${group} — ${list}.`,
        en: `The best equipped ${group} — ${list}.`,
        de: `Am besten ausgestattet ${group} — ${list}.`,
        fr: `La mieux équipée ${group} — ${list}.`,
        it: `La più attrezzata ${group} — ${list}.`,
      });
    },
  },
  {
    axis: 'quietest',
    holds: (self, others) => onlyOne(self.isQuiet, others.map(other => other.isQuiet)),
    claim: (_self, language, group) => localized(language, {
      gr: `Η πιο ήσυχη ${group} — λιγότερος κόσμος.`,
      en: `The quietest ${group} — fewer people.`,
      de: `Die ruhigste ${group} — weniger Menschen.`,
      fr: `La plus tranquille ${group} — moins de monde.`,
      it: `La più tranquilla ${group} — meno gente.`,
    }),
  },
  {
    axis: 'easiestAccess',
    holds: (self, others) => onlyOne(self.isEasyAccess, others.map(other => other.isEasyAccess)),
    claim: (_self, language, group) => localized(language, {
      gr: `Η πιο εύκολη ${group} — φτάνεις με άσφαλτο ως την παραλία.`,
      en: `The easiest to reach ${group} — paved road all the way.`,
      de: `Am leichtesten erreichbar ${group} — asphaltierte Straße bis zum Strand.`,
      fr: `La plus facile d'accès ${group} — route goudronnée jusqu'à la plage.`,
      it: `La più facile da raggiungere ${group} — strada asfaltata fino alla spiaggia.`,
    }),
  },
  {
    axis: 'shade',
    holds: (self, others) => onlyOne(self.hasShade, others.map(other => other.hasShade)),
    claim: (_self, language, group) => localized(language, {
      gr: `Η μόνη ${group} με φυσική σκιά.`,
      en: `The only one ${group} with natural shade.`,
      de: `Die einzige ${group} mit natürlichem Schatten.`,
      fr: `La seule ${group} avec de l'ombre naturelle.`,
      it: `L'unica ${group} con ombra naturale.`,
    }),
  },
];

/**
 * The honest fallback: no superlative, just what this beach IS, in the words the filters use.
 * Reached when nothing separates it from its siblings — which is itself information ("these
 * three are genuinely similar today"), and far better than inventing a difference.
 */
type ProfileMode = 'alone' | 'framed' | 'bare';

const buildProfileClaim = (facts: Facts, language: LanguageCode, mode: ProfileMode): string => {
  const parts: string[] = [];
  const composition = facts.beach.beachType && facts.beach.beachType !== 'unknown'
    ? compositionWord(language, facts.beach.beachType)
    : '';
  if (composition) parts.push(composition);
  if (facts.isShallow) parts.push(filterWord(language, 'shallowWaters'));
  else if (facts.beach.characteristics?.deepWaters === true) parts.push(filterWord(language, 'deepWaters'));
  if (facts.hasShade) parts.push(filterWord(language, 'naturalShade'));
  if (facts.facilityLabels.length > 0) parts.push(facts.facilityLabels[0]);
  else if (facts.isQuiet) parts.push(filterWord(language, 'quiet'));

  const attributes = parts.filter(Boolean).slice(0, 3);
  if (attributes.length === 0) return facts.context?.explanation || '';

  // Lowercased mid-sentence: the filter vocabulary is Title Case because it labels chips
  // («Ρηχά Νερά»), and dropping it into a sentence unchanged reads like a form field.
  const list = attributes.join(', ').toLocaleLowerCase(language === 'gr' ? 'el' : language);

  // With a single pick there is nothing to be "similar to", so the comparative frame is a lie.
  if (mode === 'alone') {
    return localized(language, {
      gr: `Τι θα βρεις: ${list}.`,
      en: `What you'll find: ${list}.`,
      de: `Was dich erwartet: ${list}.`,
      fr: `Ce que vous trouverez : ${list}.`,
      it: `Cosa troverai: ${list}.`,
    });
  }

  // Only the first undifferentiated beach explains WHY it has no superlative. Repeating that
  // clause underneath itself would recreate the copy-paste voice this module exists to remove,
  // so the rest just state what they are.
  if (mode === 'bare') {
    // Plain toUpperCase, NEVER toLocaleUpperCase('el'): the Greek locale rule strips diacritics
    // (right for a word set in all caps, wrong here) and turned «Άμμος» into «Αμμος».
    const first = Array.from(list)[0] || '';
    return `${first.toUpperCase()}${list.slice(first.length)}.`;
  }

  return localized(language, {
    gr: `Ίδιες περίπου συνθήκες με τις άλλες — η διαφορά είναι η ίδια η παραλία: ${list}.`,
    en: `Much the same conditions as the others — the difference is the beach itself: ${list}.`,
    de: `Ähnliche Bedingungen wie die anderen — der Unterschied ist der Strand selbst: ${list}.`,
    fr: `Des conditions proches des autres — la différence est la plage elle-même : ${list}.`,
    it: `Condizioni simili alle altre — la differenza è la spiaggia stessa: ${list}.`,
  });
};

export const getTopPickDistinguishers = (
  candidates: TopPickCandidate[],
  language: LanguageCode,
  selectedDate?: Date,
): TopPickDistinguisher[] => {
  if (candidates.length === 0) return [];

  const facts = candidates.map(candidate => collectFacts(candidate, language, selectedDate));
  const group = groupPhrase(language, facts.length);
  const assigned = new Map<number, TopPickDistinguisher>();

  // A single pick has nothing to be compared against, so every comparative axis is skipped and
  // it drops straight to its profile line.
  if (facts.length > 1) {
    AXIS_RULES.forEach(rule => {
      const winners = facts.filter(self => (
        !assigned.has(self.beachId)
        && rule.holds(self, facts.filter(other => other.beachId !== self.beachId))
      ));
      // An axis is a differentiator only when exactly one beach owns it. Two "only sandy one"s
      // would be a contradiction on the same screen.
      if (winners.length !== 1) return;
      const winner = winners[0];
      assigned.set(winner.beachId, {
        beachId: winner.beachId,
        axis: rule.axis,
        claim: rule.claim(winner, language, group),
      });
    });
  }

  const usedClaims = new Set(Array.from(assigned.values()).map(entry => entry.claim));
  let framedProfileUsed = false;

  return facts.map(self => {
    const won = assigned.get(self.beachId);
    if (won) return won;

    const mode: ProfileMode = facts.length === 1
      ? 'alone'
      : (framedProfileUsed ? 'bare' : 'framed');
    framedProfileUsed = true;
    const profile = buildProfileClaim(self, language, mode);
    // Two identical profile lines would reintroduce exactly the robot-voice problem this
    // module exists to kill, so the second one falls back to its own explanation.
    const claim = profile && !usedClaims.has(profile) ? profile : (self.context?.explanation || profile);
    usedClaims.add(claim);
    return { beachId: self.beachId, axis: 'profile' as const, claim };
  });
};
