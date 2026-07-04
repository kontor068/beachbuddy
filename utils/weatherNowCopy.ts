import { WindDirection, LanguageCode } from '../types';

/**
 * Copy generator for the visible "Weather & sea now" block on the beach detail
 * page. IMPORTANT compliance note: this content is rendered ONLY by the React
 * detail component (client-side), never by scripts/prerenderBeachPages.mjs. It
 * hydrates with real live wind/wave values from state, so "now" wording is
 * truthful. The prerender honesty guards + auditSeoPrerender.mjs scan the STATIC
 * prerendered HTML (staticBeachFallback) only — they never see this block — and
 * "now/live" must never be baked into that static HTML.
 *
 * The output is split into a STABLE part (heading + orientation description,
 * always true regardless of when it renders → safe to expose to crawlers) and a
 * VOLATILE part (live wind/wave numbers + verdict → the caller wraps these in
 * data-nosnippet so Google never freezes a stale value into a SERP snippet).
 *
 * Variation: the stable description is built from each beach's own orientation
 * (faces / protectedFrom), and the live sentence from how the current wind
 * relates to that shelter — so the ~2.700 pages never share boilerplate.
 */

type Lang = LanguageCode;

const NORTHERLY = [WindDirection.N, WindDirection.NE, WindDirection.NW];
const SOUTHERLY = [WindDirection.S, WindDirection.SE, WindDirection.SW];
const EASTERLY = [WindDirection.E, WindDirection.NE, WindDirection.SE];
const WESTERLY = [WindDirection.W, WindDirection.NW, WindDirection.SW];

// Compass letters for the compact wind stat (universal; Greek uses Greek letters).
const COMPASS_LETTER: Record<WindDirection, { gr: string; latin: string }> = {
  [WindDirection.N]:  { gr: 'Β',  latin: 'N' },
  [WindDirection.NE]: { gr: 'ΒΑ', latin: 'NE' },
  [WindDirection.E]:  { gr: 'Α',  latin: 'E' },
  [WindDirection.SE]: { gr: 'ΝΑ', latin: 'SE' },
  [WindDirection.S]:  { gr: 'Ν',  latin: 'S' },
  [WindDirection.SW]: { gr: 'ΝΔ', latin: 'SW' },
  [WindDirection.W]:  { gr: 'Δ',  latin: 'W' },
  [WindDirection.NW]: { gr: 'ΒΔ', latin: 'NW' },
};

// Greek wind adjective, accusative — agrees with "άνεμο" (e.g. "με βόρειο άνεμο").
const GR_WIND_ADJ_ACC: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειο',
  [WindDirection.NE]: 'βορειοανατολικό',
  [WindDirection.E]: 'ανατολικό',
  [WindDirection.SE]: 'νοτιοανατολικό',
  [WindDirection.S]: 'νότιο',
  [WindDirection.SW]: 'νοτιοδυτικό',
  [WindDirection.W]: 'δυτικό',
  [WindDirection.NW]: 'βορειοδυτικό',
};
// Greek wind adjective, nominative — agrees with "άνεμος" (e.g. "ο βόρειος άνεμος").
const GR_WIND_ADJ_NOM: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειος',
  [WindDirection.NE]: 'βορειοανατολικός',
  [WindDirection.E]: 'ανατολικός',
  [WindDirection.SE]: 'νοτιοανατολικός',
  [WindDirection.S]: 'νότιος',
  [WindDirection.SW]: 'νοτιοδυτικός',
  [WindDirection.W]: 'δυτικός',
  [WindDirection.NW]: 'βορειοδυτικός',
};

// English "-erly" wind adjective (e.g. "a northerly wind").
const EN_WIND_ADJ: Record<WindDirection, string> = {
  [WindDirection.N]: 'northerly',
  [WindDirection.NE]: 'north-easterly',
  [WindDirection.E]: 'easterly',
  [WindDirection.SE]: 'south-easterly',
  [WindDirection.S]: 'southerly',
  [WindDirection.SW]: 'south-westerly',
  [WindDirection.W]: 'westerly',
  [WindDirection.NW]: 'north-westerly',
};

// Coarse sector phrase for a set of directions, so we describe shelter as
// "northerly winds" rather than declining each of eight compass points.
const sectorsOf = (dirs: WindDirection[]) => ({
  north: dirs.some(d => NORTHERLY.includes(d)),
  south: dirs.some(d => SOUTHERLY.includes(d)),
  east: dirs.some(d => EASTERLY.includes(d) && !NORTHERLY.includes(d) && !SOUTHERLY.includes(d)),
  west: dirs.some(d => WESTERLY.includes(d) && !NORTHERLY.includes(d) && !SOUTHERLY.includes(d)),
});

const SECTOR_WORDS: Record<'north' | 'south' | 'east' | 'west', Record<Lang, string>> = {
  north: { en: 'northerly', gr: 'βόρειους', de: 'Nord-', fr: 'de nord', it: 'da nord' },
  south: { en: 'southerly', gr: 'νότιους', de: 'Süd-', fr: 'de sud', it: 'da sud' },
  east:  { en: 'easterly',  gr: 'ανατολικούς', de: 'Ost-', fr: "d'est", it: 'da est' },
  west:  { en: 'westerly',  gr: 'δυτικούς', de: 'West-', fr: "d'ouest", it: 'da ovest' },
};

const joinList = (items: string[], lang: Lang) => {
  if (items.length <= 1) return items[0] || '';
  const and = { en: ' and ', gr: ' και ', de: ' und ', fr: ' et ', it: ' e ' }[lang];
  return `${items.slice(0, -1).join(', ')}${and}${items[items.length - 1]}`;
};

// "protected from northerly and westerly winds" / "από βόρειους και δυτικούς ανέμους"
const shelterPhrase = (protectedFrom: WindDirection[], lang: Lang): string => {
  const s = sectorsOf(protectedFrom);
  const parts = (['north', 'south', 'east', 'west'] as const).filter(k => s[k]).map(k => SECTOR_WORDS[k][lang]);
  if (parts.length === 0) return '';
  const list = joinList(parts, lang);
  switch (lang) {
    case 'gr': return `προστατεύεται από ${list} ανέμους`;
    case 'de': return `ist vor ${list}winden geschützt`;
    case 'fr': return `est abritée des vents ${list}`;
    case 'it': return `è riparata dai venti ${list}`;
    default:   return `is sheltered from ${list} winds`;
  }
};

// "faces south" from the beach's orientation.faces sectors.
const facingPhrase = (faces: WindDirection[], lang: Lang): string => {
  const s = sectorsOf(faces);
  const parts = (['north', 'south', 'east', 'west'] as const).filter(k => s[k]);
  if (parts.length === 0) return '';
  const sideWords: Record<'north' | 'south' | 'east' | 'west', Record<Lang, string>> = {
    north: { en: 'north', gr: 'βόρεια', de: 'nach Norden', fr: 'au nord', it: 'a nord' },
    south: { en: 'south', gr: 'νότια', de: 'nach Süden', fr: 'au sud', it: 'a sud' },
    east:  { en: 'east',  gr: 'ανατολικά', de: 'nach Osten', fr: "à l'est", it: 'a est' },
    west:  { en: 'west',  gr: 'δυτικά', de: 'nach Westen', fr: "à l'ouest", it: 'a ovest' },
  };
  const list = joinList(parts.map(k => sideWords[k][lang]), lang);
  switch (lang) {
    case 'gr': return `βλέπει ${list}`;
    case 'de': return `ist ${list} ausgerichtet`;
    case 'fr': return `est orientée ${list}`;
    case 'it': return `è esposta ${list}`;
    default:   return `faces ${list}`;
  }
};

export interface WeatherNowInput {
  beachName: string;
  language: Lang;
  isToday: boolean;
  /** false while live data is still loading — the caller shows a skeleton, no numbers. */
  dataReady: boolean;
  windDir: WindDirection;
  beaufort: number;
  waveHeightM?: number;
  isWaveEstimate: boolean;
  protectedFrom: WindDirection[];
  faces: WindDirection[];
  canClaimWindProtection: boolean;
  isExposedToTodayWind: boolean;
  /** 0–10, higher = calmer (from calculateSeaConditionScore). */
  seaConditionScore: number;
  /** Boat-only spots (e.g. Kleftiko) aren't "beaches" — refer to them by bare name, no "beach" noun. */
  isBoatAccess?: boolean;
}

export interface WeatherNowContent {
  heading: string;
  verdict: string;
  tone: 'calm' | 'mixed' | 'choppy' | 'unknown';
  windLabel: string;
  windValue: string;
  waveLabel: string;
  waveValue: string;
  /** Stable, always-true (no live numbers) → safe for crawlers/snippets. */
  stableDescription: string;
  /** Volatile (live wind vs. shelter) → caller wraps in data-nosnippet. */
  liveSentence: string;
  loadingLabel: string;
}

const nowWord = (lang: Lang) => ({ en: 'right now', gr: 'τώρα', de: 'jetzt', fr: 'maintenant', it: 'ora' }[lang]);

const buildHeading = (beachName: string, lang: Lang, isToday: boolean, isBoatAccess: boolean): string => {
  const now = isToday ? ` ${nowWord(lang)}` : '';
  // Boat-only spots (e.g. Kleftiko) aren't beaches — drop the "beach" noun, use the bare name.
  if (isBoatAccess) {
    switch (lang) {
      case 'gr': return isToday ? `Καιρός στο ${beachName} τώρα` : `Καιρός & θάλασσα — ${beachName}`;
      case 'de': return `Wetter${now} — ${beachName}`;
      case 'fr': return `Météo${now} — ${beachName}`;
      case 'it': return `Meteo${now} — ${beachName}`;
      default:   return isToday ? `${beachName} weather right now` : `${beachName} weather & sea`;
    }
  }
  switch (lang) {
    case 'gr': return isToday ? `Καιρός στην παραλία ${beachName} τώρα` : `Καιρός & θάλασσα — ${beachName}`;
    case 'de': return `Wetter am Strand ${beachName}${now}`;
    case 'fr': return `Météo à la plage ${beachName}${now}`;
    case 'it': return `Meteo alla spiaggia ${beachName}${now}`;
    default:   return isToday ? `${beachName} Beach weather right now` : `${beachName} Beach weather & sea`;
  }
};

const buildVerdict = (tone: 'calm' | 'mixed' | 'choppy', lang: Lang, isToday: boolean): string => {
  const now = isToday ? ` ${nowWord(lang)}` : '';
  const map = {
    calm:   { en: 'Calm', gr: 'Ήρεμα', de: 'Ruhig', fr: 'Calme', it: 'Calmo' },
    mixed:  { en: 'A little chop', gr: 'Λίγο κύμα', de: 'Etwas Welle', fr: 'Un peu de clapot', it: 'Un po\' mosso' },
    choppy: { en: 'Choppy', gr: 'Έχει κύμα', de: 'Wellig', fr: 'Clapoteux', it: 'Mosso' },
  } as const;
  return `${map[tone][lang]}${now}`;
};

export const buildWeatherNowContent = (input: WeatherNowInput): WeatherNowContent => {
  const { language: lang, beachName, isToday, dataReady } = input;
  const isBoatAccess = input.isBoatAccess ?? false;

  const heading = buildHeading(beachName, lang, isToday, isBoatAccess);
  const loadingLabel = { en: 'Loading live conditions…', gr: 'Φόρτωση ζωντανών συνθηκών…', de: 'Live-Bedingungen werden geladen…', fr: 'Chargement des conditions en direct…', it: 'Caricamento condizioni in tempo reale…' }[lang];

  const windLabel = { en: 'Wind', gr: 'Άνεμος', de: 'Wind', fr: 'Vent', it: 'Vento' }[lang];
  const waveLabel = { en: 'Waves', gr: 'Κύμα', de: 'Wellen', fr: 'Vagues', it: 'Onde' }[lang];

  // Stable description (no live values): orientation + shelter, always true.
  const facing = facingPhrase(input.faces || [], lang);
  const shelter = shelterPhrase(input.protectedFrom || [], lang);
  let stableDescription: string;
  if (facing || shelter) {
    const clause = [facing, shelter].filter(Boolean).join(lang === 'gr' ? ' και ' : lang === 'de' ? ' und ' : lang === 'fr' ? ' et ' : lang === 'it' ? ' e ' : ' and ');
    // Boat-only spots aren't "beaches" — refer to them by bare name ("Το Κλέφτικο …"), no noun.
    const lead = isBoatAccess
      ? { en: `${beachName} ${clause}.`, gr: `Το ${beachName} ${clause}.`, de: `${beachName} ${clause}.`, fr: `${beachName} ${clause}.`, it: `${beachName} ${clause}.` }[lang]
      : { en: `${beachName} beach ${clause}.`, gr: `Η παραλία ${beachName} ${clause}.`, de: `Der Strand ${beachName} ${clause}.`, fr: `La plage ${beachName} ${clause}.`, it: `La spiaggia ${beachName} ${clause}.` }[lang];
    const tail = { en: ' Wind and waves shift through the day, so check the live figures below.', gr: ' Ο άνεμος και το κύμα αλλάζουν μέσα στη μέρα, γι\' αυτό δες τις ζωντανές τιμές πιο κάτω.', de: ' Wind und Wellen ändern sich im Tagesverlauf – sieh dir die Live-Werte unten an.', fr: ' Le vent et les vagues changent au cours de la journée, consultez les valeurs en direct ci-dessous.', it: ' Vento e onde cambiano durante il giorno, controlla i valori in tempo reale qui sotto.' }[lang];
    stableDescription = lead + tail;
  } else {
    stableDescription = { en: `Conditions at ${beachName} depend on the wind direction — check the live wind and wave below.`, gr: `Οι συνθήκες στην ${beachName} εξαρτώνται από την κατεύθυνση του ανέμου — δες ζωντανά τον άνεμο και το κύμα πιο κάτω.`, de: `Die Bedingungen an ${beachName} hängen von der Windrichtung ab – sieh dir Wind und Wellen live unten an.`, fr: `Les conditions à ${beachName} dépendent de la direction du vent — voir le vent et les vagues en direct ci-dessous.`, it: `Le condizioni a ${beachName} dipendono dalla direzione del vento — controlla vento e onde in tempo reale qui sotto.` }[lang];
  }

  // Not loaded yet: return stable copy only, no numbers, no verdict.
  if (!dataReady) {
    return { heading, verdict: '', tone: 'unknown', windLabel, windValue: '', waveLabel, waveValue: '', stableDescription, liveSentence: '', loadingLabel };
  }

  // Verdict from the same sea-condition score the rest of the page uses.
  const tone: 'calm' | 'mixed' | 'choppy' =
    (input.canClaimWindProtection || input.seaConditionScore >= 7) ? 'calm'
    : input.seaConditionScore <= 4 ? 'choppy'
    : 'mixed';
  const verdict = buildVerdict(tone, lang, isToday);

  // Compact live stats.
  const letter = COMPASS_LETTER[input.windDir]?.[lang === 'gr' ? 'gr' : 'latin'] ?? '';
  const windValue = `${letter} ${Math.round(input.beaufort)} Bft`.trim();
  const estWord = { en: 'est.', gr: 'εκτίμ.', de: 'geschätzt', fr: 'est.', it: 'stima' }[lang];
  const lowWord = { en: 'low', gr: 'χαμηλό', de: 'niedrig', fr: 'faibles', it: 'basse' }[lang];
  const waveValue = (typeof input.waveHeightM === 'number' && Number.isFinite(input.waveHeightM) && input.waveHeightM > 0)
    ? `~${input.waveHeightM.toFixed(1)} m${input.isWaveEstimate ? ` (${estWord})` : ''}`
    : lowWord;

  // Live sentence: how the current wind meets this beach's shelter (volatile).
  const shelteredNow = input.canClaimWindProtection || (input.protectedFrom || []).includes(input.windDir);
  const bft = Math.round(input.beaufort);
  let liveSentence: string;
  // "now/τώρα/maintenant…" is only truthful for today. For a future day the same block
  // shows that day's forecast values, so the wording must be time-neutral (no "now").
  if (shelteredNow) {
    const adjGr = GR_WIND_ADJ_ACC[input.windDir];
    const adjEn = EN_WIND_ADJ[input.windDir];
    liveSentence = isToday
      ? { en: `With the ${adjEn} wind of ${bft} Bft blowing now, it is relatively sheltered here.`, gr: `Με ${adjGr} άνεμο ${bft} Bft που φυσάει τώρα, εδώ είναι σχετικά υπήνεμα.`, de: `Bei ${bft} Bft Wind ist es hier gerade relativ geschützt.`, fr: `Avec un vent de ${bft} Bft en ce moment, c'est relativement abrité ici.`, it: `Con vento di ${bft} Bft in questo momento, qui è relativamente riparato.` }[lang]
      : { en: `With the ${adjEn} wind of ${bft} Bft, it is relatively sheltered here.`, gr: `Με ${adjGr} άνεμο ${bft} Bft, εδώ είναι σχετικά υπήνεμα.`, de: `Bei ${bft} Bft Wind ist es hier relativ geschützt.`, fr: `Avec un vent de ${bft} Bft, c'est relativement abrité ici.`, it: `Con vento di ${bft} Bft, qui è relativamente riparato.` }[lang];
  } else if (input.isExposedToTodayWind) {
    const adjGr = GR_WIND_ADJ_NOM[input.windDir];
    const adjEn = EN_WIND_ADJ[input.windDir];
    liveSentence = isToday
      ? { en: `The ${adjEn} wind of ${bft} Bft hits more directly now, so expect some chop.`, gr: `Ο ${adjGr} άνεμος ${bft} Bft χτυπάει πιο άμεσα τώρα, οπότε περίμενε κάποιο κύμα.`, de: `Der Wind von ${bft} Bft trifft gerade direkter – rechne mit etwas Welle.`, fr: `Le vent de ${bft} Bft frappe plus directement maintenant, attends-toi à un peu de clapot.`, it: `Il vento di ${bft} Bft colpisce più direttamente ora, aspettati un po' di moto ondoso.` }[lang]
      : { en: `The ${adjEn} wind of ${bft} Bft hits more directly here, so expect some chop.`, gr: `Ο ${adjGr} άνεμος ${bft} Bft χτυπάει πιο άμεσα εδώ, οπότε περίμενε κάποιο κύμα.`, de: `Der Wind von ${bft} Bft trifft direkter – rechne mit etwas Welle.`, fr: `Le vent de ${bft} Bft frappe plus directement, attends-toi à un peu de clapot.`, it: `Il vento di ${bft} Bft colpisce più direttamente, aspettati un po' di moto ondoso.` }[lang];
  } else {
    liveSentence = isToday
      ? { en: `The wind is ${bft} Bft right now — moderate conditions.`, gr: `Ο άνεμος τώρα είναι ${bft} Bft — μέτριες συνθήκες.`, de: `Der Wind beträgt gerade ${bft} Bft – mäßige Bedingungen.`, fr: `Le vent est de ${bft} Bft maintenant — conditions modérées.`, it: `Il vento è di ${bft} Bft ora — condizioni moderate.` }[lang]
      : { en: `The wind is ${bft} Bft — moderate conditions.`, gr: `Ο άνεμος είναι ${bft} Bft — μέτριες συνθήκες.`, de: `Der Wind beträgt ${bft} Bft – mäßige Bedingungen.`, fr: `Le vent est de ${bft} Bft — conditions modérées.`, it: `Il vento è di ${bft} Bft — condizioni moderate.` }[lang];
  }

  return { heading, verdict, tone, windLabel, windValue, waveLabel, waveValue, stableDescription, liveSentence, loadingLabel };
};
