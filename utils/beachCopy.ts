import { Accessibility, Beach, LanguageCode, WarningFlag, WaveCondition } from '../types';
import { hasBoatOnlyAccess, hasChallengingAccess, hasDirtRoadAccess, hasTrulyEasyAccess } from './access';
import { hasExplicitBeachBarAmenityInList } from './amenityMatching.js';
import { getSelectedDayPrefix, getSelectedDaySentencePrefix } from './dateLabels';
import { ExposureLevel } from './windExposure';

type BestBeachTime = {
  bestStart?: string;
  bestEnd?: string;
};

export interface BeachCopyInput {
  beach: Beach;
  language: LanguageCode;
  isExposed: boolean;
  exposureLevel?: ExposureLevel;
  waveCondition?: WaveCondition;
  waveHeightM?: number;
  bestBeachTime?: BestBeachTime;
  warnings?: WarningFlag[];
  windDirectionLabel?: string;
  windBeaufort?: number;
  selectedDate?: Date;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
}

export interface BeachCopyResult {
  heroTitle: string;
  detailBullets: string[];
  cardSummary: string;
  tradeoffText?: string;
}

type BeachFeatureFacts = {
  protectedToday: boolean;
  partiallyProtected: boolean;
  exposedToday: boolean;
  calmSea: boolean;
  moderateSea: boolean;
  roughSea: boolean;
  easyAccess: boolean;
  dirtRoadAccess: boolean;
  challengingAccess: boolean;
  boatOnly: boolean;
  sandy: boolean;
  pebbles: boolean;
  mixed: boolean;
  rocky: boolean;
  shallowWater: boolean;
  deepWater: boolean;
  familyFriendly: boolean;
  quiet: boolean;
  remote: boolean;
  naturalShade: boolean;
  organized: boolean;
  beachBar: boolean;
  sunbeds: boolean;
  tavernaNearby: boolean;
  foodNearby: boolean;
  cafeNearby: boolean;
  parking: boolean;
  limitedFacilities: boolean;
};

const localize = (language: LanguageCode, gr: string, en: string): string =>
  language === 'gr' ? gr : en;

const normalizeText = (value?: string): string =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const metadataText = (beach: Beach): string =>
  (beach.metadata?.amenities || []).map(normalizeText).join(' ');

const hasAmenityText = (beach: Beach, pattern: RegExp): boolean =>
  pattern.test(metadataText(beach));

const hasMeaningfulWind = (windBeaufort?: number): boolean =>
  typeof windBeaufort === 'number' && Number.isFinite(windBeaufort) && windBeaufort >= 4;

const formatBestTime = (bestBeachTime?: BestBeachTime): string | undefined => {
  if (!bestBeachTime?.bestStart) return undefined;
  if (!bestBeachTime.bestEnd || bestBeachTime.bestStart === bestBeachTime.bestEnd) {
    return bestBeachTime.bestStart;
  }
  return `${bestBeachTime.bestStart} - ${bestBeachTime.bestEnd}`;
};

const formatWaveHeight = (waveHeightM?: number, language: LanguageCode = 'gr'): string | undefined => {
  if (typeof waveHeightM !== 'number' || !Number.isFinite(waveHeightM)) return undefined;
  return language === 'gr' ? `${waveHeightM.toFixed(1)} μ` : `${waveHeightM.toFixed(1)} m`;
};

const sentenceCase = (value: string): string =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : value;

const stableVariantIndex = (seed: number | string | undefined, count: number): number => {
  if (count <= 1) return 0;
  const text = String(seed ?? 0);
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash % count;
};

const getFacts = ({
  beach,
  isExposed,
  exposureLevel,
  waveCondition,
  waveHeightM,
  warnings = [],
  canClaimWindProtection,
  seaCalmClaimAllowed,
}: BeachCopyInput): BeachFeatureFacts => {
  const text = metadataText(beach);
  const metadataAmenities = beach.metadata?.amenities || [];
  const hasExplicitBeachBarText = hasExplicitBeachBarAmenityInList(metadataAmenities);
  const specificFacilities = Boolean(
    beach.amenities?.beachBar ||
    beach.amenities?.sunbeds ||
    beach.amenities?.taverna ||
    beach.amenities?.restaurant ||
    beach.amenities?.parking ||
    hasExplicitBeachBarText ||
    /sunbed|umbrella|taverna|restaurant|cafe|coffee|parking|καντιν|ταβερν|εστιατορ|καφε|ξαπλωστ|ομπρελ|παρκ/.test(text)
  );

  const protectedToday = exposureLevel === 'protected' && canClaimWindProtection === true;
  // Partial exposure can come from lower-confidence fallbacks, so copy frames it as caution, not verified shelter.
  const partiallyProtected = exposureLevel === 'partial';
  const exposedToday = exposureLevel ? exposureLevel === 'exposed' : isExposed;
  const numericModerateWave = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 0.5 && waveHeightM < 0.9;
  const numericRoughWave = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) && waveHeightM >= 0.9;
  const roughWarning = warnings.some(warning => warning.type === 'rough_sea' && warning.severity !== 'info');
  const beachBar = Boolean(beach.amenities?.beachBar || hasExplicitBeachBarText);
  const tavernaNearby = Boolean(beach.amenities?.taverna || beach.amenities?.restaurant || hasAmenityText(beach, /ταβερν|εστιατορ|restaurant|taverna|tavern/));

  return {
    protectedToday,
    partiallyProtected,
    exposedToday,
    calmSea: seaCalmClaimAllowed === true,
    moderateSea: waveCondition === 'moderate' || numericModerateWave,
    roughSea: waveCondition === 'rough' || numericRoughWave || roughWarning,
    easyAccess: hasTrulyEasyAccess(beach),
    dirtRoadAccess: hasDirtRoadAccess(beach),
    challengingAccess: hasChallengingAccess(beach),
    boatOnly: hasBoatOnlyAccess(beach) || beach.accessibility === Accessibility.BOAT_ONLY,
    sandy: beach.beachType === 'sandy',
    pebbles: beach.beachType === 'pebbles',
    mixed: beach.beachType === 'sandy-pebbles',
    rocky: beach.beachType === 'rocky',
    shallowWater: Boolean(beach.characteristics?.shallowWaters || beach.metadata?.waterDepth?.type === 'shallow'),
    deepWater: Boolean(beach.characteristics?.deepWaters || beach.metadata?.waterDepth?.type === 'deep'),
    familyFriendly: Boolean(beach.environment?.familyFriendly),
    quiet: !beachBar && Boolean(beach.environment?.quiet),
    remote: !beachBar && Boolean(beach.environment?.remote),
    naturalShade: Boolean(beach.metadata?.shade ?? beach.amenities?.naturalShade),
    organized: Boolean(beach.metadata?.organized ?? beach.amenities?.organized),
    beachBar,
    sunbeds: Boolean(beach.amenities?.sunbeds || hasAmenityText(beach, /sunbed|umbrella|ξαπλωστ|ομπρελ/)),
    tavernaNearby,
    foodNearby: Boolean(tavernaNearby || hasAmenityText(beach, /food|φαγητ/)),
    cafeNearby: Boolean(hasAmenityText(beach, /cafe|coffee|καφε/)),
    parking: Boolean(beach.amenities?.parking || hasAmenityText(beach, /parking|παρκ|σταθμευσ/)),
    limitedFacilities: !specificFacilities && beach.metadata?.organized === false,
  };
};

const joinPhrases = (phrases: string[], language: LanguageCode): string => {
  const clean = phrases.filter(Boolean);
  if (clean.length <= 1) return clean[0] || '';
  if (clean.length === 2) {
    return language === 'gr' ? `${clean[0]} και ${clean[1]}` : `${clean[0]} and ${clean[1]}`;
  }
  const last = clean[clean.length - 1];
  const rest = clean.slice(0, -1).join(', ');
  return language === 'gr' ? `${rest} και ${last}` : `${rest}, and ${last}`;
};

const stripGreekReasonArticle = (phrase: string): string =>
  phrase.replace(/^(την|τη|τον|το|τις|τους|τα)\s+/i, '');

const joinGreekPreferencePhrases = (phrases: string[]): string => {
  const clean = phrases.map(stripGreekReasonArticle).filter(Boolean);
  if (clean.length === 2 && clean[0].includes(' και ')) {
    return `${clean[0]}, με ${clean[1]}`;
  }
  return joinPhrases(clean, 'gr');
};

const surfacePhrase = (facts: BeachFeatureFacts, language: LanguageCode): string | undefined => {
  if (facts.sandy) return localize(language, 'την αμμώδη ακτή', 'its sandy shore');
  if (facts.pebbles) return localize(language, 'τη βοτσαλωτή ακτή', 'its pebbly shore');
  if (facts.mixed) return localize(language, 'την ακτή με άμμο και βότσαλο', 'its mix of sand and pebbles');
  if (facts.rocky) return localize(language, 'τον πιο βραχώδη χαρακτήρα της', 'its rockier character');
  return undefined;
};

const amenityPhrase = (facts: BeachFeatureFacts, language: LanguageCode): string | undefined => {
  if (facts.beachBar && facts.sunbeds) return localize(language, 'beach bar και ξαπλώστρες', 'a beach bar and sunbeds');
  if (facts.beachBar) return localize(language, 'beach bar', 'a beach bar');
  if (facts.sunbeds) return localize(language, 'ξαπλώστρες', 'sunbeds');
  if (facts.tavernaNearby && facts.cafeNearby) return localize(language, 'ταβέρνες και καφέ κοντά', 'tavernas and coffee nearby');
  if (facts.tavernaNearby) return localize(language, 'ταβέρνες κοντά', 'tavernas nearby');
  if (facts.foodNearby && facts.cafeNearby) return localize(language, 'ταβέρνα και καφέ κοντά', 'taverna and coffee nearby');
  if (facts.foodNearby) return localize(language, 'ταβέρνα κοντά', 'taverna nearby');
  if (facts.cafeNearby) return localize(language, 'καφέ κοντά', 'coffee nearby');
  if (facts.parking) return 'parking';
  if (facts.organized) return localize(language, 'πιο οργανωμένη εμπειρία', 'a more organized setup');
  return undefined;
};

const cardReasonPhrases = (facts: BeachFeatureFacts, language: LanguageCode): string[] => {
  const phrases: string[] = [];
  const surface = surfacePhrase(facts, language);
  if (surface) phrases.push(surface);
  if (facts.beachBar) phrases.push(localize(language, 'beach bar', 'a beach bar'));
  if (facts.sunbeds) phrases.push(localize(language, 'ξαπλώστρες', 'sunbeds'));
  if (!facts.beachBar && !facts.sunbeds) {
    const amenity = amenityPhrase(facts, language);
    if (amenity) phrases.push(amenity);
  }
  if (facts.easyAccess) phrases.push(localize(language, 'την εύκολη πρόσβαση', 'the easy access'));
  if (facts.familyFriendly && (facts.shallowWater || facts.sandy || facts.easyAccess)) {
    phrases.push(localize(language, 'την πιο πρακτική οικογενειακή χρήση', 'its practical family fit'));
  }
  if (facts.quiet || facts.remote) {
    phrases.push(localize(language, 'την πιο ήσυχη αίσθηση', 'the quieter feel'));
  }
  if (facts.naturalShade) {
    phrases.push(localize(language, 'τη φυσική σκιά σε σημεία', 'some natural shade'));
  }
  return Array.from(new Set(phrases)).slice(0, 3);
};

const waveShortPhrase = (
  facts: BeachFeatureFacts,
  waveHeightM: number | undefined,
  language: LanguageCode,
  seed?: number | string
): string | undefined => {
  const height = formatWaveHeight(waveHeightM, language);
  if (facts.calmSea) {
    if (!height) return localize(language, 'το κύμα παραμένει χαμηλό', 'waves stay low');
    const greek = [
      `το κύμα είναι χαμηλό, περίπου ${height}`,
      `το κύμα μένει χαμηλό, γύρω στα ${height}`,
      `η θάλασσα δείχνει ήπια, με κύμα περίπου ${height}`,
    ];
    const english = [
      `waves stay low, around ${height}`,
      `wave height is low, around ${height}`,
      `the sea should stay relatively calm, with waves around ${height}`,
    ];
    const variants = language === 'gr' ? greek : english;
    return variants[stableVariantIndex(seed, variants.length)];
  }
  if (facts.moderateSea) {
    return height
      ? localize(language, `το κύμα είναι περίπου ${height}`, `waves are around ${height}`)
      : localize(language, 'το κύμα θέλει λίγη προσοχή', 'the waves need a little attention');
  }
  if (facts.roughSea) {
    return height
      ? localize(language, `το κύμα στην πρόγνωση μπορεί να φτάσει περίπου ${height}`, `forecast waves may reach around ${height}`)
      : localize(language, 'το κύμα μπορεί να επηρεάσει το μπάνιο', 'waves may affect the swim');
  }
  return undefined;
};

const dayPrefix = (input: Pick<BeachCopyInput, 'language' | 'selectedDate'>): string =>
  getSelectedDayPrefix(input.selectedDate, new Date(), input.language);

const sentenceDayPrefix = (input: Pick<BeachCopyInput, 'language' | 'selectedDate'>): string =>
  getSelectedDaySentencePrefix(input.selectedDate, new Date(), input.language);

const hasBeaufortValue = (input: BeachCopyInput): input is BeachCopyInput & { windBeaufort: number } =>
  typeof input.windBeaufort === 'number' && Number.isFinite(input.windBeaufort);

const greekWindPhrase = (input: BeachCopyInput): string => {
  const direction = input.windDirectionLabel?.trim().toLowerCase();
  if (hasBeaufortValue(input)) {
    return direction ? `${direction} άνεμο ${input.windBeaufort} μποφόρ` : `άνεμο ${input.windBeaufort} μποφόρ`;
  }
  return direction ? `${direction} άνεμο ${dayPrefix(input)}` : `άνεμο ${dayPrefix(input)}`;
};

const englishWindPhrase = (input: BeachCopyInput): string => {
  const direction = input.windDirectionLabel?.toLowerCase();
  if (hasBeaufortValue(input)) {
    return direction ? `a ${input.windBeaufort} Beaufort ${direction} wind` : `a ${input.windBeaufort} Beaufort wind`;
  }
  return direction ? `${direction} wind` : `wind ${dayPrefix(input)}`;
};

const windPhrase = (input: BeachCopyInput): string =>
  localize(
    input.language,
    greekWindPhrase(input),
    englishWindPhrase(input)
  );

const calmLeadPhrase = (input: BeachCopyInput): string => {
  const day = dayPrefix(input);
  const sentenceDay = sentenceDayPrefix(input);
  const greek = [
    `Με χαμηλό άνεμο ${day}`,
    `Με ήπιες συνθήκες ${day}`,
    `${sentenceDay}, με χαμηλό άνεμο`,
    `Επειδή ο άνεμος είναι ήπιος ${day}`,
  ];
  const english = [
    `With light wind ${day}`,
    `With mild conditions ${day}`,
    `In light wind ${day}`,
  ];
  const variants = input.language === 'gr' ? greek : english;
  return variants[stableVariantIndex(input.beach.id, variants.length)];
};

const generateCalmCardSummary = (input: BeachCopyInput, facts: BeachFeatureFacts): string => {
  const { language, waveHeightM } = input;
  const day = dayPrefix(input);
  const sentenceDay = sentenceDayPrefix(input);
  const reasons = cardReasonPhrases(facts, language);
  const wave = waveShortPhrase(facts, waveHeightM, language, input.beach.id);
  const lead = calmLeadPhrase(input);
  const greekReasons = joinGreekPreferencePhrases(reasons);
  const reasonsText = joinPhrases(reasons, language);

  if (reasons.length > 0 && wave) {
    return localize(
      language,
      `${sentenceDay} ταιριάζει περισσότερο αν ψάχνεις ${greekReasons}. ${sentenceCase(wave)}.`,
      `${lead}, this is a practical beach pick for ${reasonsText}. ${sentenceCase(wave)}.`
    );
  }

  if (reasons.length > 0) {
    return localize(
      language,
      `${sentenceDay} ταιριάζει περισσότερο αν ψάχνεις ${greekReasons}.`,
      `${lead}, this is a practical beach pick for ${reasonsText}, with live wind and sea checks kept simple.`
    );
  }

  if (wave) {
    return localize(
      language,
      `${sentenceDay} οι συνθήκες φαίνονται ήπιες για μπάνιο. ${sentenceCase(wave)}.`,
      `${lead}, conditions are easy and ${wave}.`
    );
  }

  return localize(
    language,
    `Με βάση τα διαθέσιμα στοιχεία, οι συνθήκες ${day} φαίνονται ήπιες για μπάνιο.`,
    `Based on the available data, conditions look easy for swimming ${day}.`
  );
};

const generateWindyCardSummary = (input: BeachCopyInput, facts: BeachFeatureFacts): string => {
  const { language, waveHeightM } = input;
  const sentenceDay = sentenceDayPrefix(input);
  const wind = windPhrase(input);
  const wave = waveShortPhrase(facts, waveHeightM, language, input.beach.id);
  const reasons = cardReasonPhrases(facts, language);
  const practicalSummary = reasons.length > 0
    ? localize(
      language,
      `Πρακτική επιλογή για ${joinGreekPreferencePhrases(reasons.slice(0, 2))}.`,
      `Practical choice for ${joinPhrases(reasons.slice(0, 2), language)}.`
    )
    : localize(
      language,
      'Οι πιο ανοιχτές παραλίες επηρεάζονται περισσότερο από τον σημερινό άνεμο.',
      "More exposed beaches are more affected by today's wind."
    );
  const strongWind = typeof input.windBeaufort === 'number' && input.windBeaufort >= 5;
  const isFiveBeaufort = input.windBeaufort === 5;

  if (facts.protectedToday) {
    return localize(
      language,
      `${sentenceDay} είναι πιο προστατευμένη επιλογή για ${wind}.${wave ? ` ${sentenceCase(wave)}.` : ''}`,
      `${sentenceDay}, it is a better sheltered option for ${wind}.${wave ? ` ${sentenceCase(wave)}.` : ''}`
    );
  }

  if (facts.partiallyProtected) {
    return localize(
      language,
      isFiveBeaufort
        ? 'Οι πιο ανοιχτές παραλίες επηρεάζονται περισσότερο από τον σημερινό άνεμο.'
        :
      strongWind
        ? `Καταλληλότερη διαθέσιμη επιλογή, με προσοχή. Είναι πιο υπήνεμη για ${wind}, αλλά η θάλασσα μπορεί να μην είναι τελείως ήπια.${wave ? ` ${sentenceCase(wave)}.` : ''}`
        : practicalSummary,
      isFiveBeaufort
        ? "More exposed beaches are more affected by today's wind."
        :
      strongWind
        ? `More suitable available option, with caution. It has some cover from ${wind}, but it is not a reliable easy-swim pick.${wave ? ` ${sentenceCase(wave)}.` : ''}`
        : practicalSummary
    );
  }

  return localize(
    language,
    isFiveBeaufort
      ? 'Εκτεθειμένη στον άνεμο.'
      : strongWind
      ? `${sentenceDay} είναι εκτεθειμένη στον ${wind} και μπορεί να έχει κύμα. Δεν είναι ιδανική για ήρεμο μπάνιο.`
      : `${sentenceDay} μπορεί να έχει αέρα με ${wind}.${wave ? ` ${sentenceCase(wave)}.` : ''} Προτίμησέ τη αν δεν σε ενοχλεί μια πιο αέρινη παραλία.`,
    isFiveBeaufort
      ? 'Exposed to wind.'
      : strongWind
      ? `${sentenceDay}, it is exposed to ${wind} and likely to feel choppy. It is not ideal for calm swimming.`
      : `${sentenceDay}, it may feel breezy with ${wind}.${wave ? ` ${sentenceCase(wave)}.` : ''} Choose it if you do not mind a breezier beach.`
  );
};

const windBullet = (input: BeachCopyInput, facts: BeachFeatureFacts): string => {
  const { language } = input;
  const day = dayPrefix(input);
  const windy = hasMeaningfulWind(input.windBeaufort);

  if (!windy) {
    if (typeof input.windBeaufort === 'number') {
      return localize(
        language,
        `Ο άνεμος ${day} προβλέπεται ${input.windBeaufort} μποφόρ, άρα οι περισσότερες παραλίες φαίνονται κατάλληλες για μπάνιο.`,
        `${input.windBeaufort} Beaufort ${day}, so most beaches look suitable for swimming.`
      );
    }
    return localize(
      language,
      `Ο άνεμος δεν φαίνεται να είναι ο βασικός παράγοντας επιλογής ${day}.`,
      `Wind does not seem to be the main decision factor ${day}.`
    );
  }

  const wind = windPhrase(input);
  const isFiveBeaufort = input.windBeaufort === 5;

  if (facts.protectedToday) {
    return localize(
      language,
      `Με ${wind}, αυτή η παραλία είναι πιο προστατευμένη για τη φορά του ανέμου ${day}.`,
      `With ${wind}, this beach is better sheltered for the wind direction ${day}.`
    );
  }

  if (facts.partiallyProtected) {
    return localize(
      language,
      isFiveBeaufort
        ? 'Οι πιο ανοιχτές παραλίες επηρεάζονται περισσότερο από τον σημερινό άνεμο.'
        : `Με ${wind}, είναι πιο υπήνεμη επιλογή από τις ανοιχτές παραλίες, αλλά η θάλασσα μπορεί να θέλει προσοχή.`,
      isFiveBeaufort
        ? "More exposed beaches are more affected by today's wind."
        : `With ${wind}, it looks more suitable than more exposed beaches, but it is not a guaranteed easy-swim choice.`
    );
  }

  return localize(
    language,
    isFiveBeaufort
      ? 'Εκτεθειμένη στον άνεμο.'
      : typeof input.windBeaufort === 'number' && input.windBeaufort >= 5
      ? `Με ${wind}, είναι εκτεθειμένη και πιθανόν όχι ιδανική για ήρεμο μπάνιο ${day}.`
      : `Με ${wind}, μπορεί να έχει αέρα ${day}.`,
    isFiveBeaufort
      ? 'Exposed to wind.'
      : typeof input.windBeaufort === 'number' && input.windBeaufort >= 5
      ? `With ${wind}, it is exposed and likely not ideal for calm swimming ${day}.`
      : `With ${wind}, it may feel breezy ${day}.`
  );
};

const waveBullet = (input: BeachCopyInput, facts: BeachFeatureFacts): string | undefined => {
  const { language, waveHeightM } = input;
  const day = dayPrefix(input);
  const height = formatWaveHeight(waveHeightM, language);

  if (facts.calmSea) {
    if (!height) {
      return localize(
        language,
        'Το κύμα φαίνεται χαμηλό με βάση τον άνεμο και την έκθεση της παραλίας.',
        'Waves look low based on wind and exposure.'
      );
    }
    const greek = [
      `Το κύμα προβλέπεται χαμηλό, περίπου ${height}.`,
      `Η θάλασσα δείχνει ήπια, με κύμα περίπου ${height}.`,
      `Το κύμα μένει χαμηλό, γύρω στα ${height}.`,
    ];
    const english = [
      `Waves stay low, around ${height}.`,
      `Wave height is low, around ${height}.`,
      `The sea should stay relatively calm, with waves around ${height}.`,
    ];
    const variants = language === 'gr' ? greek : english;
    return variants[stableVariantIndex(`${input.beach.id}:wave`, variants.length)];
  }

  if (facts.moderateSea) {
    return height
      ? localize(language, `Το κύμα είναι περίπου ${height}, οπότε δεν είναι η πιο ήρεμη επιλογή αν θες απόλυτα ήρεμη θάλασσα.`, `Waves are around ${height}, so this is not the calmest pick if you want flat water.`)
      : localize(language, `Η θάλασσα μπορεί να έχει λίγο κυματισμό ${day}.`, `The sea may have some chop ${day}.`);
  }

  if (facts.roughSea) {
    return height
      ? localize(language, `Το κύμα στην πρόγνωση μπορεί να φτάσει περίπου ${height}, οπότε η θάλασσα μπορεί να μην είναι τελείως ήπια.`, `Forecast waves may reach around ${height}, so the sea may not feel fully easy.`)
      : localize(language, `Το κύμα μπορεί να επηρεάσει το μπάνιο ${day}.`, `Waves may affect swimming ${day}.`);
  }

  return undefined;
};

const practicalBullet = (input: BeachCopyInput, facts: BeachFeatureFacts): string | undefined => {
  const { language } = input;
  const amenity = amenityPhrase(facts, language);
  const surface = surfacePhrase(facts, language);

  if (facts.boatOnly) {
    return localize(language, 'Η πρόσβαση γίνεται με σκάφος, οπότε χρειάζεται να το έχεις κανονίσει από πριν.', 'Access is by boat, so plan it before you go.');
  }

  if (facts.challengingAccess) {
    return localize(language, 'Η πρόσβαση θέλει προσοχή, άρα δεν είναι η πιο γρήγορη επιλογή για αυθόρμητη επίσκεψη.', 'Access is not straightforward, so it is not the quickest spontaneous stop.');
  }

  if (facts.dirtRoadAccess) {
    return localize(language, 'Η πρόσβαση έχει χωματόδρομο, οπότε έλεγξε τη διαδρομή πριν ξεκινήσεις.', 'Access includes a dirt road, so check the route before leaving.');
  }

  if (amenity) {
    return localize(
      language,
      `Έχει ${amenity}, άρα ταιριάζει αν θέλεις πιο πρακτική εμπειρία στην παραλία.`,
      `It has ${amenity}, so it fits if you want a more practical beach stop.`
    );
  }

  if (facts.familyFriendly && (facts.shallowWater || facts.sandy || facts.easyAccess)) {
    return localize(
      language,
      'Τα διαθέσιμα στοιχεία τη δείχνουν πιο πρακτική για οικογένειες, χωρίς να χρειάζεται να βασιστείς μόνο στον καιρό.',
      'Available data makes it a practical family option, without relying only on weather.'
    );
  }

  if (facts.quiet || facts.remote) {
    return facts.limitedFacilities
      ? localize(language, 'Έχει πιο ήσυχη αίσθηση και λίγες παροχές, άρα πήγαινε προετοιμασμένος.', 'It has a quieter feel and limited facilities, so go prepared.')
      : localize(language, 'Έχει πιο ήσυχη αίσθηση σε σχέση με τις πολύ οργανωμένες επιλογές.', 'It has a quieter feel than heavily organized options.');
  }

  if (surface && facts.easyAccess) {
    return localize(
      language,
      `Συνδυάζει ${surface} και εύκολη πρόσβαση, κάτι που την κάνει πρακτική για γρήγορη επίσκεψη.`,
      `It combines ${surface} with easy access, which makes it practical for a quick visit.`
    );
  }

  if (surface) {
    return localize(language, `Το βασικό της χαρακτηριστικό είναι ${surface}.`, `Its main static feature is ${surface}.`);
  }

  if (facts.easyAccess) {
    return localize(language, 'Η εύκολη πρόσβαση βοηθά αν θέλεις γρήγορη επίσκεψη χωρίς δύσκολη διαδρομή.', 'Easy access helps if you want a quick visit without a difficult route.');
  }

  return undefined;
};

const bestTimeBullet = (input: BeachCopyInput): string | undefined => {
  const range = formatBestTime(input.bestBeachTime);
  if (!range) return undefined;
  const day = dayPrefix(input);
  return localize(
    input.language,
    `Καλύτερο παράθυρο ${day}: ${range}.`,
    `Best window ${day}: ${range}.`
  );
};

const tradeoffText = (input: BeachCopyInput, facts: BeachFeatureFacts): string | undefined => {
  if (facts.boatOnly) return localize(input.language, 'Χρειάζεται πρόσβαση με σκάφος.', 'Boat access is needed.');
  if (facts.challengingAccess) return localize(input.language, 'Η πρόσβαση θέλει περισσότερη προσοχή.', 'Access needs extra care.');
  if (hasMeaningfulWind(input.windBeaufort) && facts.exposedToday) {
    const day = dayPrefix(input);
    return localize(input.language, `Πιο εκτεθειμένη στον άνεμο ${day}.`, `More exposed to wind ${day}.`);
  }
  if (facts.limitedFacilities) return localize(input.language, 'Περιορισμένες παροχές στην παραλία.', 'Limited beach facilities.');
  return undefined;
};

export const generateBestTimeReason = (input: Pick<BeachCopyInput, 'language' | 'windBeaufort' | 'waveHeightM' | 'isExposed' | 'exposureLevel' | 'selectedDate'>): string => {
  const windy = hasMeaningfulWind(input.windBeaufort);
  const waveHeight = formatWaveHeight(input.waveHeightM, input.language);
  const numericWaveHeight = typeof input.waveHeightM === 'number' && Number.isFinite(input.waveHeightM)
    ? input.waveHeightM
    : undefined;

  if (windy) {
    return localize(
      input.language,
      'Προτίμησε αυτό το διάστημα για πιο κατάλληλες συνθήκες ανέμου και θάλασσας.',
      'Prefer this window for more suitable wind and sea conditions.'
    );
  }

  if (numericWaveHeight !== undefined) {
    if (numericWaveHeight < 0.5) {
      return localize(
        input.language,
        'Καλή ώρα για μπάνιο με ήπιες συνθήκες και χαμηλό κύμα.',
        'Good time to swim with easy conditions and low waves.'
      );
    }

    if (numericWaveHeight < 0.8) {
      return localize(
        input.language,
        'Καλή ώρα για μπάνιο, αλλά μπορεί να υπάρχει ελαφρύς κυματισμός.',
        'Good time to swim, but expect some chop.'
      );
    }

    if (numericWaveHeight < 1.2) {
      return localize(
        input.language,
        input.windBeaufort === 5
          ? 'Η θάλασσα μπορεί να έχει κυματισμό σε αυτό το διάστημα.'
          : 'Προτίμησε αυτό το διάστημα, αλλά θέλει προσοχή γιατί η θάλασσα μπορεί να έχει κυματισμό.',
        input.windBeaufort === 5
          ? 'The sea may be choppy in this window.'
          : 'Prefer this window, but use caution as the sea may be choppy.'
      );
    }

    return localize(
      input.language,
      input.windBeaufort === 5
        ? `Το κύμα είναι περίπου ${waveHeight}.`
        : `Οι συνθήκες θέλουν προσοχή, με κύμα περίπου ${waveHeight}.`,
      input.windBeaufort === 5
        ? `Waves are around ${waveHeight}.`
        : `Conditions need caution, with waves around ${waveHeight}.`
    );
  }

  return localize(
    input.language,
    'Καλή ώρα για άνετο μπάνιο με ήπιες συνθήκες.',
    'Good time for an easy swim in mild conditions.'
  );
};

export const generateBeachCopy = (input: BeachCopyInput): BeachCopyResult => {
  const facts = getFacts(input);
  const windy = hasMeaningfulWind(input.windBeaufort);
  const cardSummary = windy
    ? generateWindyCardSummary(input, facts)
    : generateCalmCardSummary(input, facts);

  const bullets = [
    windBullet(input, facts),
    waveBullet(input, facts),
    practicalBullet(input, facts),
    bestTimeBullet(input),
  ].filter((item): item is string => Boolean(item));

  return {
    heroTitle: localize(input.language, `Γιατί προτείνεται ${dayPrefix(input)};`, `Why it's recommended ${dayPrefix(input)}`),
    detailBullets: Array.from(new Set(bullets)).slice(0, 4),
    cardSummary,
    tradeoffText: tradeoffText(input, facts),
  };
};
