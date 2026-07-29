import { LanguageCode, SwimmingComfort } from '../types';
import { ExposureLevel } from './windExposure';
import { getLocalizedCopy } from './i18n';
import { getSelectedDayPrefix, getSelectedHourPrefix, isSelectedDateToday } from './dateLabels';
import { athensNow } from './athensTime';
import { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, seaStateSeverityM } from './waveCharacter';

// CalmBeach communicates a FINAL EXPERIENCE, not raw weather. Every beach resolves to one
// of four plain-language tiers derived from the composite suitability score (which already
// blends swimming + experience + preferences), gated by the honest hard caps below. This is
// the single source of truth for the verdict — badges, the map legend and the detail "why"
// section all read from here, so the four colours mean the same thing everywhere.
export type ExperienceTier = 'excellent' | 'good' | 'fair' | 'skip';

export interface ExperienceTierInput {
  /** finalSuitabilityScore / today score, 0–100. */
  score: number;
  windBeaufort?: number;
  /** The day/region Beaufort shown in the header. Falls back to windBeaufort. Used so the
   *  "sheltered reads yellow" floor tracks the day the user sees (4 Bft), not a slightly
   *  higher per-beach micro-reading that would keep a lee-side beach orange. */
  dayBeaufort?: number;
  waveHeightM?: number;
  /** Total-sea period (s). Puts the wave ceiling on the same swell-equivalent scale as the
   *  map pin and the wave graphic, so a short-period chop is not waved through on height alone. */
  wavePeriodS?: number;
  swimmingComfort?: SwimmingComfort;
  noIdealSwimmingWindow?: boolean;
  /** Only used to split "fair" vs "skip" on a strong-wind (≥5 Bft) day. */
  exposureLevel?: ExposureLevel;
  /**
   * 0–10 from calculateSeaConditionScore — the same number the "weather now" chip is built from.
   *
   * The detail page already lifted the badge score when this was high (getDetailBadgeScore), but
   * nothing carried it the other way, so the blue "Excellent today" badge could sit directly above
   * an orange "A little chop right now" chip built from the same forecast. It happens where the
   * composite score is strong but the sea score is not: a steep short-period chop on an open shore
   * in dead air, which the light-wind ladder in seaConditions is specifically built to catch.
   */
  seaConditionScore?: number;
}

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

// The tier is a BEACH-EXPERIENCE verdict, not a swimming-safety verdict. The model:
//
//   1. "Not recommended" (red) is reserved for genuinely poor days and kept rare — only a
//      near-gale, a real rough sea, an unsafe-swim call *paired with* real waves, or a very
//      weak pick. Strong wind that merely makes swimming choppy is an "OK, but breezy" day
//      (amber), not a "don't go" — otherwise a whole island turns red on any 6 Bft afternoon.
//   2. A condition "ceiling" caps how good a beach may look given the day (green never shows
//      on a windy or choppy day); the composite score then sets the tier up to that ceiling.
export const getExperienceTier = (input: ExperienceTierInput): ExperienceTier => {
  const { windBeaufort, waveHeightM, swimmingComfort } = input;
  const score = clampScore(input.score);
  const bft = typeof windBeaufort === 'number' ? windBeaufort : 0;
  // Swell-equivalent metres, so this ceiling reads the same sea the wave graphic draws and the
  // map pin is coloured from. Without a period it is the raw height, exactly as before.
  const wave = seaStateSeverityM(waveHeightM, input.wavePeriodS);

  // Red is reserved for a genuinely poor day: near-gale wind, a real rough sea, or a beach
  // that is simply wrong today. A strong breeze that only makes swimming choppy is NOT red on
  // its own — it caps the tier at "OK" below, so a 6 Bft afternoon reads amber, not a wall of red.
  const roughSea = wave !== undefined && wave >= 1.5;
  // Red ("skip") tracks the map's wind-colour guide: it only appears from 5 Bft up, and —
  // like the pin — only for beaches the map paints RED there. At 5–6 Bft the pin is red
  // solely for EXPOSED beaches (getSimpleWindColor: partial → orange, protected → yellow),
  // so a partial/protected beach must never read a red "Δεν συνιστάται" under an orange or
  // yellow pin — it caps at "OK" via the ceiling below instead. A near-gale (7 Bft+) is
  // always skip, whatever the shelter.
  const pinRedInStrongWind = input.exposureLevel !== 'protected' && input.exposureLevel !== 'partial';
  if (bft >= 7 || (bft >= 5 && pinRedInStrongWind && (roughSea || score < 25))) return 'skip';

  // Condition ceiling: 3 excellent · 2 good · 1 OK. The wind ceiling MIRRORS the map's
  // wind-colour engine (getSimpleWindColor) so the verdict word can never sit a tier ABOVE
  // the pin. Colour → tier: green → 3 ("Ιδανική") · yellow → 2 ("Καλή") · orange → 1 ("Μέτρια").
  //
  // The old model applied NO wind penalty below 5 Bft (ceiling 3 for every beach), so an
  // exposed, onshore shore at 4 Bft read "Ιδανική" while its own pin was already orange
  // ("Μέτρια") — the Καγιά case (faces due north, straight into the meltemi). The badge is
  // normally hidden at 3–4 Bft, so this only ever surfaced where it's forced on (detail page,
  // single searched beach). Now the ceiling tracks exposure through the whole 3–5 Bft band,
  // exactly like the pin:
  //   protected: green to 4 Bft, yellow at 5–6           → 3 up to 4, 2 at 5–6
  //   partial:   yellow at 3–4, orange at 5+ (uncertain) → 3 at ≤2, 2 at 3–4, 1 at 5+
  //   exposed:   yellow at 3, orange at 4, red at 5+     → 3 at ≤2, 2 at 3, 1 at 4+
  // Unknown exposure is treated as exposed, matching getSimpleWindColor's fall-through.
  // Real WAVES (≥1.2 m → OK, ≥0.8 m → cap "good") and a hard swim advisory pull it down
  // further, independent of wind. (7 Bft+ already returned 'skip'.)
  const isProtected = input.exposureLevel === 'protected';
  let ceiling: 1 | 2 | 3;
  if (bft <= 2) ceiling = 3;
  else if (isProtected) ceiling = bft >= 5 ? 2 : 3;
  else if (input.exposureLevel === 'partial') ceiling = bft >= 5 ? 1 : bft >= 3 ? 2 : 3;
  else ceiling = bft >= 4 ? 1 : bft >= 3 ? 2 : 3;
  if (wave !== undefined && wave >= SEA_STATE_ROUGH_M) ceiling = 1;
  else if (wave !== undefined && wave >= SEA_STATE_AMBER_M && ceiling > 2) ceiling = 2;
  if (swimmingComfort === 'avoid_swimming') ceiling = 1;
  // The sea verdict the chip prints is a ceiling here too. The boundaries are the chip's own:
  // it can only say "calm" from 7 up, and says "choppy" at 4 and below (utils/weatherNowCopy).
  const seaScore = input.seaConditionScore;
  if (typeof seaScore === 'number' && Number.isFinite(seaScore)) {
    if (seaScore <= 4) ceiling = 1;
    else if (seaScore < 7 && ceiling > 2) ceiling = 2;
  }

  const scoreTier: 1 | 2 | 3 = score >= 80 ? 3 : score >= 60 ? 2 : 1;
  const rank = Math.min(ceiling, scoreTier);

  // Sheltered floor: a GENUINELY wind-protected beach, with a sea that isn't choppy
  // (ceiling ≥ 2), reads at least "good" (yellow) — if it's out of the wind it's a good
  // beach day there, so it shouldn't fall to "OK" for a middling composite score.
  //
  // The Beaufort cutoff tracks the map's simple wind-suitability layer so the pin colour and
  // the verdict word can't contradict each other: a VERIFIED-protected beach paints YELLOW
  // ("Καλή") through 5–6 Bft (getSimpleWindColor), so the verdict must too — otherwise the map
  // read "Καλή" while the detail said "Μέτρια" for the same sheltered cove (Άγιος Ερμογένης,
  // still calm with minimal wave at 6 Bft in the lee). PARTIAL shelter keeps the ≤4 cutoff,
  // matching its pin (partial-at-5-Bft is orange/"Μέτρια"). The ceiling ≥ 2 gate still holds
  // (protected wind is relaxed above, but real waves ≥1.2 m or a swim advisory still cap it at
  // OK). `exposureLevel` is already gated to real protection (canClaimWindProtection) by the caller.
  const lessExposed = isProtected || input.exposureLevel === 'partial';
  const dayBft = typeof input.dayBeaufort === 'number' ? input.dayBeaufort : bft;
  const shelteredFloorMaxBft = isProtected ? 6 : 4;
  const shelteredFloor = dayBft <= shelteredFloorMaxBft && lessExposed && ceiling >= 2;
  const finalRank = shelteredFloor ? Math.max(rank, 2) : rank;
  return finalRank === 3 ? 'excellent' : finalRank === 2 ? 'good' : 'fair';
};

// The verdict describes the live, continuously-updating conditions. For *today* (the default)
// that reads as a clean present-tense phrase; only a future selected date (or a scrubbed hour)
// appends the temporal word, which is then genuinely informative.
type TierLabel = (day: string, isToday: boolean) => string;

const dayLabel = (today: string, withDay: (day: string) => string): TierLabel =>
  (day, isToday) => (isToday ? today : withDay(day));

type TierCopy = Record<ExperienceTier, TierLabel>;

const tierCopy: Record<LanguageCode, TierCopy> = {
  en: {
    excellent: dayLabel('Excellent today', (day) => `Excellent ${day}`),
    good: dayLabel('Good today', (day) => `Good ${day}`),
    fair: dayLabel('OK today', (day) => `OK ${day}`),
    skip: dayLabel('Not recommended today', (day) => `Not recommended ${day}`),
  },
  gr: {
    excellent: dayLabel('Ιδανική σήμερα', (day) => `Ιδανική ${day}`),
    good: dayLabel('Καλή επιλογή σήμερα', (day) => `Καλή επιλογή ${day}`),
    fair: dayLabel('Μέτρια σήμερα', (day) => `Μέτρια ${day}`),
    skip: dayLabel('Καλύτερα άλλη μέρα', (day) => `Δεν συνιστάται ${day}`),
  },
  fr: {
    excellent: dayLabel("Idéale aujourd'hui", (day) => `Idéale ${day}`),
    good: dayLabel("Bon choix aujourd'hui", (day) => `Bon choix ${day}`),
    fair: dayLabel("Correcte aujourd'hui", (day) => `Correcte ${day}`),
    skip: dayLabel("Déconseillée aujourd'hui", (day) => `Déconseillée ${day}`),
  },
  de: {
    excellent: dayLabel('Ideal heute', (day) => `Ideal ${day}`),
    good: dayLabel('Gute Wahl heute', (day) => `Gute Wahl ${day}`),
    fair: dayLabel('Mäßig heute', (day) => `Mäßig ${day}`),
    skip: dayLabel('Heute nicht empfohlen', (day) => `Nicht empfohlen ${day}`),
  },
  it: {
    excellent: dayLabel('Ideale oggi', (day) => `Ideale ${day}`),
    good: dayLabel('Buona scelta oggi', (day) => `Buona scelta ${day}`),
    fair: dayLabel('Discreta oggi', (day) => `Discreta ${day}`),
    skip: dayLabel('Sconsigliata oggi', (day) => `Sconsigliata ${day}`),
  },
};

// From 7 Bft up the day is a hard "avoid", so the skip verdict is stated more firmly
// ("Ακατάλληλη σήμερα" / "unsuitable today") than the softer "better another day" the same
// tier uses for a merely poor day (rough sea / weak pick at 5–6 Bft). This mirrors the map's
// wind colour guide, where 7-10 Bft reads "Ακατάλληλη!" and 5-6 Bft exposed reads "Δύσκολη".
const severeSkipCopy: Record<LanguageCode, TierLabel> = {
  en: dayLabel('Not suitable today', (day) => `Not suitable ${day}`),
  gr: dayLabel('Ακατάλληλη σήμερα', (day) => `Ακατάλληλη ${day}`),
  fr: dayLabel("Impraticable aujourd'hui", (day) => `Impraticable ${day}`),
  de: dayLabel('Heute ungeeignet', (day) => `Ungeeignet ${day}`),
  it: dayLabel('Non adatta oggi', (day) => `Non adatta ${day}`),
};

export interface ExperienceTierLabelOptions {
  selectedDate?: Date;
  selectedHour?: number;
  /** Lets the skip verdict harden to "Ακατάλληλη σήμερα" from 7 Bft up (near-gale). */
  windBeaufort?: number;
}

export const getExperienceTierLabel = (
  tier: ExperienceTier,
  language: LanguageCode,
  options: ExperienceTierLabelOptions = {}
): string => {
  const hour = getSelectedHourPrefix(options.selectedHour, language);
  const day = hour ?? getSelectedDayPrefix(options.selectedDate, athensNow(), language);
  const isToday = isSelectedDateToday(options.selectedDate);
  const useCurrentPhrase = isToday && !hour;
  if (tier === 'skip' && typeof options.windBeaufort === 'number' && options.windBeaufort >= 7) {
    return getLocalizedCopy(language, severeSkipCopy)(day, useCurrentPhrase);
  }
  const copy = getLocalizedCopy(language, tierCopy);
  return copy[tier](day, useCurrentPhrase);
};

export interface ExperienceTierTone {
  container: string;
  icon: string;
  strong: string;
}

// One palette, four meanings, used by every surface: blue → yellow → orange → rose,
// i.e. 🔵 excellent · 🟡 good · 🟠 fair · 🔴 not recommended.
export const experienceTierTone: Record<ExperienceTier, ExperienceTierTone> = {
  excellent: {
    container:
      'border-blue-200/90 bg-blue-50/78 text-blue-800 backdrop-blur-md dark:border-blue-900/50 dark:bg-blue-950/35 dark:text-blue-200',
    icon: 'text-blue-600 dark:text-blue-300',
    strong: 'text-blue-700 dark:text-blue-200',
  },
  good: {
    container:
      'border-yellow-200/90 bg-yellow-50/78 text-yellow-800 backdrop-blur-md dark:border-yellow-900/50 dark:bg-yellow-950/35 dark:text-yellow-200',
    icon: 'text-yellow-600 dark:text-yellow-300',
    strong: 'text-yellow-700 dark:text-yellow-200',
  },
  fair: {
    container:
      'border-orange-200/90 bg-orange-50/78 text-orange-800 backdrop-blur-md dark:border-orange-900/50 dark:bg-orange-950/35 dark:text-orange-200',
    icon: 'text-orange-600 dark:text-orange-300',
    strong: 'text-orange-700 dark:text-orange-200',
  },
  skip: {
    container:
      'border-rose-200/90 bg-rose-50/78 text-rose-800 backdrop-blur-md dark:border-rose-900/50 dark:bg-rose-950/35 dark:text-rose-200',
    icon: 'text-rose-600 dark:text-rose-300',
    strong: 'text-rose-700 dark:text-rose-200',
  },
};
