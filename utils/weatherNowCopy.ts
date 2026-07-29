import { WindDirection, LanguageCode } from '../types';
import { beachSentenceName } from './beachCopy';
import type { ExposureLevel } from './windExposure';
import { getSeaSeverity } from './seaVerdict';

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

/** Bearing each compass sector blows FROM, for the facing test below. */
const DIR_DEG: Record<WindDirection, number> = {
  [WindDirection.N]: 0,
  [WindDirection.NE]: 45,
  [WindDirection.E]: 90,
  [WindDirection.SE]: 135,
  [WindDirection.S]: 180,
  [WindDirection.SW]: 225,
  [WindDirection.W]: 270,
  [WindDirection.NW]: 315,
};

/**
 * Is this beach OPEN to a wind from `dir` — i.e. does it look out that way?
 *
 * A beach can never be sheltered from the side it faces, so this is the single
 * gate both sentences below must pass before either may claim shelter. It used
 * to live only inside shelterPhrase(), which is exactly how the two sentences
 * drifted apart: the static line correctly dropped the facing sector while the
 * live line still announced shelter against it. Measured before the fix: 3.313
 * beach x wind pairs contradicted, of which 700 (688 beaches, 24% of the
 * dataset) actually reached the user. Παραλία Άναξου (id 1352) is the very beach
 * the comment on shelterPhrase says the exclusion was added for.
 *
 * `facingDeg` comes from the high-res geospatial profile — the same source the
 * map pin colour already trusts — and wins when present. `faces` is the legacy
 * fallback: on 2.792 of 2.842 records it is derived from the older, coarser
 * Natural Earth mask at medium confidence, and on the cases that matter it
 * agrees with the geometry only ~88% of the time. Either saying "open" is enough
 * to suppress the claim, because under-claiming shelter is the safe direction.
 */
const facesInto = (
  dir: WindDirection,
  faces: WindDirection[] | undefined,
  facingDeg: number | null | undefined,
): boolean => {
  if (typeof facingDeg === 'number' && Number.isFinite(facingDeg)) {
    const delta = Math.abs(((facingDeg - DIR_DEG[dir] + 540) % 360) - 180);
    if (delta < 45) return true;
  }
  if (!faces?.length) return false;
  const f = sectorsOf(faces);
  const d = sectorsOf([dir]);
  return (['north', 'south', 'east', 'west'] as const).some(k => d[k] && f[k]);
};

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

// "protected from northerly and westerly winds" / "από βόρειους και δυτικούς ανέμους".
// A beach can never claim shelter from the side it FACES: the coarse sector lumping
// (NE counts toward "northerly") otherwise lets a north-facing beach protected only
// from NE read "βλέπει βόρεια και προστατεύεται από βόρειους ανέμους" — a visible
// contradiction (Παραλία Άναξου, Lesvos). Facing sectors are excluded from the claim.
const shelterPhrase = (protectedFrom: WindDirection[], lang: Lang, faces: WindDirection[]): string => {
  const s = sectorsOf(protectedFrom);
  const f = sectorsOf(faces || []);
  const parts = (['north', 'south', 'east', 'west'] as const).filter(k => s[k] && !f[k]).map(k => SECTOR_WORDS[k][lang]);
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
  /** Total-sea period (s) for the same reading — puts this chip on the swell-equivalent scale. */
  wavePeriodS?: number;
  isWaveEstimate: boolean;
  protectedFrom: WindDirection[];
  faces: WindDirection[];
  /**
   * Shoreline bearing from the high-res geospatial profile (scoreResult.facingDeg),
   * the same value the map pin colour is derived from. Preferred over `faces` for
   * the "can this beach even claim shelter here" test — see facesInto(). Optional
   * so callers without a profile still get the legacy `faces` behaviour.
   */
  facingDeg?: number | null;
  canClaimWindProtection: boolean;
  isExposedToTodayWind: boolean;
  /** The exposure level that colours the map pin the user sees (region-map aligned override
   *  ?? scoring level). The map deliberately reads one band redder than the scoring engine
   *  for open sectors, so we key the live sentence off THIS — never claiming "sheltered" for
   *  a beach the map shows red. */
  mapExposureLevel?: ExposureLevel;
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
  // These templates supply their own beach noun, so strip the one embedded in the
  // proper name («Παραλία Άναξου» → «στην παραλία Άναξου», not «στην παραλία Παραλία Άναξου»).
  const nounSafe = beachSentenceName(beachName, lang);
  switch (lang) {
    case 'gr': return isToday ? `Καιρός στην παραλία ${nounSafe} τώρα` : `Καιρός & θάλασσα — ${beachName}`;
    case 'de': return `Wetter am Strand ${beachName}${now}`;
    case 'fr': return `Météo à la plage ${beachName}${now}`;
    case 'it': return `Meteo alla spiaggia ${beachName}${now}`;
    default:   return isToday ? `${nounSafe} Beach weather right now` : `${nounSafe} Beach weather & sea`;
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
  const shelter = shelterPhrase(input.protectedFrom || [], lang, input.faces || []);
  let stableDescription: string;
  if (facing || shelter) {
    const clause = [facing, shelter].filter(Boolean).join(lang === 'gr' ? ' και ' : lang === 'de' ? ' und ' : lang === 'fr' ? ' et ' : lang === 'it' ? ' e ' : ' and ');
    // Boat-only spots aren't "beaches" — refer to them by bare name ("Το Κλέφτικο …"), no noun.
    const lead = isBoatAccess
      ? { en: `${beachName} ${clause}.`, gr: `Το ${beachName} ${clause}.`, de: `${beachName} ${clause}.`, fr: `${beachName} ${clause}.`, it: `${beachName} ${clause}.` }[lang]
      : { en: `${beachSentenceName(beachName, 'en')} beach ${clause}.`, gr: `Η παραλία ${beachSentenceName(beachName, 'gr')} ${clause}.`, de: `Der Strand ${beachName} ${clause}.`, fr: `La plage ${beachName} ${clause}.`, it: `La spiaggia ${beachName} ${clause}.` }[lang];
    const tail = { en: ' Wind and waves shift through the day, so check the live figures below.', gr: ' Ο άνεμος και το κύμα αλλάζουν μέσα στη μέρα, γι\' αυτό δες τις ζωντανές τιμές πιο κάτω.', de: ' Wind und Wellen ändern sich im Tagesverlauf – sieh dir die Live-Werte unten an.', fr: ' Le vent et les vagues changent au cours de la journée, consultez les valeurs en direct ci-dessous.', it: ' Vento e onde cambiano durante il giorno, controlla i valori in tempo reale qui sotto.' }[lang];
    stableDescription = lead + tail;
  } else {
    stableDescription = { en: `Conditions at ${beachName} depend on the wind direction — check the live wind and wave below.`, gr: `Οι συνθήκες στην ${beachName} εξαρτώνται από την κατεύθυνση του ανέμου — δες ζωντανά τον άνεμο και το κύμα πιο κάτω.`, de: `Die Bedingungen an ${beachName} hängen von der Windrichtung ab – sieh dir Wind und Wellen live unten an.`, fr: `Les conditions à ${beachName} dépendent de la direction du vent — voir le vent et les vagues en direct ci-dessous.`, it: `Le condizioni a ${beachName} dipendono dalla direzione del vento — controlla vento e onde in tempo reale qui sotto.` }[lang];
  }

  // Not loaded yet: return stable copy only, no numbers, no verdict.
  if (!dataReady) {
    return { heading, verdict: '', tone: 'unknown', windLabel, windValue: '', waveLabel, waveValue: '', stableDescription, liveSentence: '', loadingLabel };
  }

  // Verdict from the ONE sea severity (utils/seaVerdict) plus the sea-condition score.
  //
  // The score alone was not enough, and the gap was serious: calculateSeaConditionScore FLOORS a
  // sheltered beach's wave term (waveScore >= 6 unless a direct swell is detected), which is right
  // for scoring — an offshore grid cell must not bury a real cove — but it made the wave invisible
  // to this WORDING. Over the condition grid that produced 663 combinations printing "Calm right
  // now" beside an amber or rough wave figure, 126 of them above a 1,3–1,6 m sea.
  //
  // So the severity sets the floor (it is the same number the wave graphic below draws) and the
  // score may only push the verdict further down, never lift it back up.
  const bft = Math.round(input.beaufort);
  const seaSeverity = getSeaSeverity({
    waveHeightM: input.waveHeightM,
    wavePeriodS: input.wavePeriodS,
    windBeaufort: bft,
    exposureLevel: input.mapExposureLevel,
    canClaimWindProtection: input.canClaimWindProtection,
  });
  const tone: 'calm' | 'mixed' | 'choppy' =
    seaSeverity === 'rough' ? 'choppy'
      : seaSeverity === 'moderate'
        ? (input.seaConditionScore <= 4 ? 'choppy' : 'mixed')
        : (input.canClaimWindProtection || input.seaConditionScore >= 7) ? 'calm'
        : input.seaConditionScore <= 4 ? 'choppy'
        : 'mixed';
  const verdict = buildVerdict(tone, lang, isToday);

  // Compact live stats. Greek writes the Beaufort unit «Μπφ» — the same token the
  // wind ConditionCard on this very page renders (translations.ts `beaufort`).
  // Latin "Bft" next to a Greek «0 Μπφ» three lines below reads as two different
  // scales, so the unit follows the language here.
  const letter = COMPASS_LETTER[input.windDir]?.[lang === 'gr' ? 'gr' : 'latin'] ?? '';
  const bftUnit = lang === 'gr' ? 'Μπφ' : 'Bft';
  const windValue = `${letter} ${Math.round(input.beaufort)} ${bftUnit}`.trim();
  const estWord = { en: 'est.', gr: 'εκτίμ.', de: 'geschätzt', fr: 'est.', it: 'stima' }[lang];
  const lowWord = { en: 'low', gr: 'χαμηλό', de: 'niedrig', fr: 'faibles', it: 'basse' }[lang];
  // Greek writes heights «~0,3 μ.» — decimal comma, Greek unit — which is what the
  // wave graphic three lines below already renders (WaveHeightGraphic
  // formatWaveHeight). The chip used to print "~0.3 m" regardless of language, so
  // the same measurement appeared twice on one screen in two notations.
  const waveNumber = typeof input.waveHeightM === 'number' && Number.isFinite(input.waveHeightM)
    ? input.waveHeightM.toFixed(1)
    : null;
  const waveValue = (waveNumber !== null && input.waveHeightM! > 0)
    ? `~${lang === 'gr' ? `${waveNumber.replace('.', ',')} μ.` : `${waveNumber} m`}${input.isWaveEstimate ? ` (${estWord})` : ''}`
    : lowWord;

  // Live sentence: how the current wind meets this beach's shelter (volatile).
  // The beach's own protectedFrom metadata can say "sheltered from N" while the map pin —
  // which the user is looking at — is red, because the map reads one band redder than the
  // scoring engine for open sectors (see utils/mapExposure). Never claim shelter against
  // that: if the pin is red, drop the "sheltered" branch so the text matches the map.
  const exposedOnMap = input.mapExposureLevel ? input.mapExposureLevel === 'exposed' : input.isExposedToTodayWind;
  // The raw protectedFrom fallback needs the SAME facing gate the static sentence
  // applies, or the two lines contradict each other on the same screen. It matters
  // because protectedFrom is largely derived from a crude bearing off the region
  // centroid (getAutoProt), which happily "protects" a beach from a wind it looks
  // straight into. canClaimWindProtection is left alone: that one comes from the
  // curated/geometry profile and has already earned the claim.
  const shelteredNow = !exposedOnMap && (
    input.canClaimWindProtection ||
    ((input.protectedFrom || []).includes(input.windDir) &&
      !facesInto(input.windDir, input.faces, input.facingDeg))
  );
  let liveSentence: string;
  // LIGHT-WIND FLOOR — must come before every branch below.
  //
  // None of the branches that follow looked at how hard the wind is actually
  // blowing: they only asked whether this beach is open to its direction. So an
  // exposed beach in a dead calm produced «Ο βορειοανατολικός άνεμος 0 Bft χτυπάει
  // πιο άμεσα τώρα, οπότε περίμενε κάποιο κύμα» — printed directly under a green
  // «Ήρεμα τώρα» chip built from the same forecast (seen 29/07/2026, Κανάλι του
  // Έρωτα, Κέρκυρα). Orientation is a property of the coast; it says nothing at
  // 0–2 Bft, where there is no wind to be exposed to.
  //
  // At ≤2 Bft we therefore describe the wind and nothing else. We deliberately do
  // NOT say "the sea is calm" unless the sea-condition verdict agrees: light air
  // with leftover ground swell is real, and the wave value is what would make that
  // claim false. When they disagree we state both facts and explain neither — we
  // cannot verify a swell origin from these inputs.
  const LIGHT_WIND_BFT = 2;
  if (bft <= LIGHT_WIND_BFT) {
    const nowGr = isToday ? ' τώρα' : '';
    liveSentence = tone === 'calm'
      ? { en: `The wind is only ${bft} Bft${isToday ? ' right now' : ''} — next to no wind, and the water is calm.`,
          gr: `Ο άνεμος είναι μόλις ${bft} ${bftUnit}${nowGr} — σχεδόν άπνοια, και το νερό είναι ήρεμο.`,
          de: `Der Wind beträgt nur ${bft} Bft${isToday ? ' gerade' : ''} – so gut wie windstill, das Wasser ist ruhig.`,
          fr: `Le vent n'est que de ${bft} Bft${isToday ? ' en ce moment' : ''} — quasiment pas de vent, et l'eau est calme.`,
          it: `Il vento è solo di ${bft} Bft${isToday ? ' in questo momento' : ''} — quasi assenza di vento e acqua calma.` }[lang]
      : { en: `The wind is only ${bft} Bft${isToday ? ' right now' : ''}, but there is still some wave in the water.`,
          gr: `Ο άνεμος είναι μόλις ${bft} ${bftUnit}${nowGr}, αλλά υπάρχει ακόμη κύμα στο νερό.`,
          de: `Der Wind beträgt nur ${bft} Bft${isToday ? ' gerade' : ''}, es steht aber noch Welle im Wasser.`,
          fr: `Le vent n'est que de ${bft} Bft${isToday ? ' en ce moment' : ''}, mais il reste de la vague dans l'eau.`,
          it: `Il vento è solo di ${bft} Bft${isToday ? ' in questo momento' : ''}, ma c'è ancora onda in acqua.` }[lang];
  }
  // "now/τώρα/maintenant…" is only truthful for today. For a future day the same block
  // shows that day's forecast values, so the wording must be time-neutral (no "now").
  //
  // SHELTER IS A FACT ABOUT THE WIND, NOT A PROMISE ABOUT THE WATER. This branch had no sea
  // test at all — unlike the exposed branch below, which has carried `&& tone === 'calm'` all
  // along — so it printed «εδώ είναι σχετικά προστατευμένα» directly above a 1,3 m wave meter
  // and a swimmer drawn submerged to the neck (reported from Κολιτσανή, Ίος, 29/07/2026).
  // The shelter claim itself was true: the shore IS in the lee of that wind. What was missing
  // is that a sea can be running into a lee shore, and the sentence flatly denied it.
  //
  // So the branch keeps the shelter fact only while the page's own verdict agrees the water is
  // calm; when the sea is running it still names the shelter — that is the useful part, it
  // explains why this shore is the better choice today — and then says what the water is doing.
  // Strictly a narrowing: no beach gains a calm claim it did not already have.
  else if (shelteredNow && tone !== 'calm') {
    const adjGr = GR_WIND_ADJ_ACC[input.windDir];
    const adjEn = EN_WIND_ADJ[input.windDir];
    liveSentence = isToday
      ? { en: `The ${adjEn} wind of ${bft} Bft is off this shore, so it is the calmer side today — but there is still sea running in.`,
        gr: `Ο ${adjGr} άνεμος ${bft} ${bftUnit} δεν χτυπά εδώ, οπότε είναι η πιο υπήνεμη πλευρά σήμερα — έχει όμως ακόμα κύμα.`,
        de: `Der Wind von ${bft} Bft trifft diese Küste nicht, sie ist heute die ruhigere Seite — es läuft aber noch Welle ein.`,
        fr: `Le vent de ${bft} Bft ne frappe pas cette côte, c'est le côté le plus abrité aujourd'hui — mais il reste de la houle.`,
        it: `Il vento di ${bft} Bft non colpisce questa costa, oggi è il lato più riparato — ma c'è ancora onda.` }[lang]
      : { en: `The ${adjEn} wind of ${bft} Bft is off this shore, so it is the calmer side — but there is still sea running in.`,
        gr: `Ο ${adjGr} άνεμος ${bft} ${bftUnit} δεν χτυπά εδώ, οπότε είναι η πιο υπήνεμη πλευρά — έχει όμως ακόμα κύμα.`,
        de: `Der Wind von ${bft} Bft trifft diese Küste nicht, sie ist die ruhigere Seite — es läuft aber noch Welle ein.`,
        fr: `Le vent de ${bft} Bft ne frappe pas cette côte, c'est le côté le plus abrité — mais il reste de la houle.`,
        it: `Il vento di ${bft} Bft non colpisce questa costa, è il lato più riparato — ma c'è ancora onda.` }[lang];
  }
  else if (shelteredNow) {
    const adjGr = GR_WIND_ADJ_ACC[input.windDir];
    const adjEn = EN_WIND_ADJ[input.windDir];
    liveSentence = isToday
      ? { en: `With the ${adjEn} wind of ${bft} Bft blowing now, it is relatively sheltered here.`, gr: `Με ${adjGr} άνεμο ${bft} ${bftUnit} που φυσάει τώρα, εδώ είναι σχετικά προστατευμένα.`, de: `Bei ${bft} Bft Wind ist es hier gerade relativ geschützt.`, fr: `Avec un vent de ${bft} Bft en ce moment, c'est relativement abrité ici.`, it: `Con vento di ${bft} Bft in questo momento, qui è relativamente riparato.` }[lang]
      : { en: `With the ${adjEn} wind of ${bft} Bft, it is relatively sheltered here.`, gr: `Με ${adjGr} άνεμο ${bft} ${bftUnit}, εδώ είναι σχετικά προστατευμένα.`, de: `Bei ${bft} Bft Wind ist es hier relativ geschützt.`, fr: `Avec un vent de ${bft} Bft, c'est relativement abrité ici.`, it: `Con vento di ${bft} Bft, qui è relativamente riparato.` }[lang];
  }
  // EXPOSED, BUT THE SEA VERDICT SAYS CALM.
  //
  // The light-wind floor above is not enough on its own: it fixes 0–2 Bft and the
  // same contradiction walks straight back in at 3 Bft, where an exposed beach can
  // still score `tone === 'calm'`. Being open to the wind is a fact about the
  // coast; "expect some chop" is a prediction about the water, and the chip beside
  // it is built from the sea-condition score. Only that score may promise chop.
  // So we keep the orientation (it is useful — it says why this beach turns rough
  // when the wind gets up) and drop the prediction the verdict contradicts.
  else if ((input.isExposedToTodayWind || exposedOnMap) && tone === 'calm') {
    const adjGr = GR_WIND_ADJ_NOM[input.windDir];
    const adjEn = EN_WIND_ADJ[input.windDir];
    const nowGr = isToday ? ' τώρα' : '';
    liveSentence = { en: `The ${adjEn} wind of ${bft} Bft catches this shore more directly${isToday ? ' now' : ''}, but the water is still calm.`,
      gr: `Ο ${adjGr} άνεμος ${bft} ${bftUnit} πιάνει πιο άμεσα αυτή την ακτή${nowGr}, όμως το νερό παραμένει ήρεμο.`,
      de: `Der Wind von ${bft} Bft trifft diese Küste${isToday ? ' gerade' : ''} direkter, das Wasser bleibt aber ruhig.`,
      fr: `Le vent de ${bft} Bft frappe cette côte plus directement${isToday ? ' en ce moment' : ''}, mais l'eau reste calme.`,
      it: `Il vento di ${bft} Bft colpisce più direttamente questa costa${isToday ? ' ora' : ''}, ma l'acqua resta calma.` }[lang];
  } else if (input.isExposedToTodayWind || exposedOnMap) {
    const adjGr = GR_WIND_ADJ_NOM[input.windDir];
    const adjEn = EN_WIND_ADJ[input.windDir];
    liveSentence = isToday
      ? { en: `The ${adjEn} wind of ${bft} Bft hits more directly now, so expect some chop.`, gr: `Ο ${adjGr} άνεμος ${bft} ${bftUnit} χτυπάει πιο άμεσα τώρα, οπότε περίμενε κάποιο κύμα.`, de: `Der Wind von ${bft} Bft trifft gerade direkter – rechne mit etwas Welle.`, fr: `Le vent de ${bft} Bft frappe plus directement maintenant, attends-toi à un peu de clapot.`, it: `Il vento di ${bft} Bft colpisce più direttamente ora, aspettati un po' di moto ondoso.` }[lang]
      : { en: `The ${adjEn} wind of ${bft} Bft hits more directly here, so expect some chop.`, gr: `Ο ${adjGr} άνεμος ${bft} ${bftUnit} χτυπάει πιο άμεσα εδώ, οπότε περίμενε κάποιο κύμα.`, de: `Der Wind von ${bft} Bft trifft direkter – rechne mit etwas Welle.`, fr: `Le vent de ${bft} Bft frappe plus directement, attends-toi à un peu de clapot.`, it: `Il vento di ${bft} Bft colpisce più direttamente, aspettati un po' di moto ondoso.` }[lang];
  } else {
    // The neutral fallback used to hard-code "moderate conditions" for every tone,
    // so a beach the chip called «Ήρεμα» was described as merely moderate on the
    // same line (4 of the 162 combinations the probe sweeps). The closing verdict
    // now follows the same tone the chip is built from — one sea verdict per card.
    const conditionsWord = {
      calm:   { en: 'calm conditions', gr: 'ήρεμες συνθήκες', de: 'ruhige Bedingungen', fr: 'conditions calmes', it: 'condizioni calme' },
      mixed:  { en: 'moderate conditions', gr: 'μέτριες συνθήκες', de: 'mäßige Bedingungen', fr: 'conditions modérées', it: 'condizioni moderate' },
      choppy: { en: 'some chop about', gr: 'έχει κάποιο κύμα', de: 'etwas Welle', fr: 'un peu de clapot', it: 'un po\' di moto ondoso' },
    }[tone][lang];
    liveSentence = isToday
      ? { en: `The wind is ${bft} Bft right now — ${conditionsWord}.`, gr: `Ο άνεμος τώρα είναι ${bft} ${bftUnit} — ${conditionsWord}.`, de: `Der Wind beträgt gerade ${bft} Bft – ${conditionsWord}.`, fr: `Le vent est de ${bft} Bft maintenant — ${conditionsWord}.`, it: `Il vento è di ${bft} Bft ora — ${conditionsWord}.` }[lang]
      : { en: `The wind is ${bft} Bft — ${conditionsWord}.`, gr: `Ο άνεμος είναι ${bft} ${bftUnit} — ${conditionsWord}.`, de: `Der Wind beträgt ${bft} Bft – ${conditionsWord}.`, fr: `Le vent est de ${bft} Bft — ${conditionsWord}.`, it: `Il vento è di ${bft} Bft — ${conditionsWord}.` }[lang];
  }

  return { heading, verdict, tone, windLabel, windValue, waveLabel, waveValue, stableDescription, liveSentence, loadingLabel };
};
