import {
  Accessibility,
  Beach,
  DailyForecast,
  FetchExposure,
  FilterKey,
  ForecastConfidence,
  ForecastItem,
  GeospatialExposureProfile,
  LanguageCode,
  MarineForecast,
  RecommendationConfidence,
  SeabedSlope,
  SimpleWindSuitability,
  SortOption,
  SuitableBeach,
  SwimmingComfort,
  UserPreferences,
  WarningFlag,
  WaterEntry,
  WaterQualityRiskAfterRain,
  WeatherData,
  WeatherSource,
  WindProfile,
  WindProfileSource,
  WindSector,
  WindDirection,
} from '../types';
import { degToCompass, calculateDistance, getBeaufortLevel } from '../utils/weatherUtils';
import { computeSwellSurgePenalty, SWELL_SURGE_PENALTY_MID } from '../utils/swellSurge';
import { hasDownwindSeaSample, holdsGlassWaterAtFourBeaufort } from '../utils/offshoreFlatWater';
import { assessSwellExposure, SWELL_MIN_HEIGHT_M } from '../utils/swellExposure';
import { evaluateAfternoonBuild } from '../utils/afternoonBuild';
import { calculateCrowdLevel, CrowdLevel } from './crowdService';
import { ExposureLevel } from '../utils/windExposure';
import { getNegativeFeedbackCount } from './analyticsService';
import { displayBeachName } from '../utils/localization';
import { beachSentenceName } from '../utils/beachCopy';
import { getSearchVariants, isSearchMatch } from '../utils/searchNormalize';
import { calculateSeaConditionScore } from '../utils/seaConditions';
import { SEA_ARRIVAL_GRAZING, seaStateSeverityM, shoreSeaStateM } from '../utils/waveCharacter';
import { getSelectedDayPrefix, isSelectedDateToday } from '../utils/dateLabels';
import { athensNow } from '../utils/athensTime';
import { hasListedSeatracRamp } from '../utils/accessibility';
import { isSurfSpotInSeason } from '../utils/surfSpots';
import { assessBeachWindExposure, applySeaStateToWindSuitability } from '../utils/windExposureEngine';
import { summarizeLocalWindBehavior } from '../utils/windClimatology';
import { getRegionWindContext, LOCAL_WIND_SECTORS } from '../utils/localWindContext.mjs';
import { describeSimpleWindSuitability, describeWindExposure } from '../utils/windExposureCopy';
import { getHardAccessKind, hasDifficultTopPickAccess, hasMainstreamTopPickAccess, hasTrulyEasyAccess, isAdventureBeach } from '../utils/access';
import { passesTopPickSeaGate, TOP_PICK_PODIUM_SEATS, UNTRUSTED_CELL_SEA_FLOOR_M } from './topPickRanking';
import { isSunsetFacingBeach } from '../utils/beachOrientation';
import { isNaturistBeach } from '../utils/naturistBeaches';
import { getBeachTouristRecognitionScore } from '../utils/touristPriority';
import { getWindChopWaveFloorM, resolveEffectiveWaveHeightM, capLightWindMeasuredWaveM, resolveDisplayWaveHeightM, type SeaArrivalGeometry } from '../utils/waveModel';
import { resolveSeaArrival, resolveSeaArrivalExposureLevel } from '../utils/seaArrival';
import { COVE_DISPLAY_FLOOR_M, COVE_ONSHORE_MIN, resolveCoveAwareWaveHeightM } from '../utils/coveWaveGuard';
import { drySectorFanWaveHeightM, estimateShoreWaveHeightM, isEnclosedDrySector, isSeaArrivingShore, isSeaDepartingShore } from '../utils/shoreWave';
import { relievesOverCaution } from '../utils/overCautionRelief';
import type { ShoreWaveInput } from '../utils/shoreWave';
import { beachShoreBreaks } from '../utils/shoreBreak';
import { resolveGeometricWaveCeiling } from '../utils/geometricWaveCeiling';
import { interpolateSectorGeometry } from '../utils/windExposureModel';
import { getBeachPopularityRating } from '../utils/beachRating';

/** Where the decision-grade sea state came from — for calibration, not for UI. */
export type SeaStateSource = 'measured' | 'measured-capped' | 'modeled';

/**
 * WHICH WATER the measurement describes — for auditing, not for UI.
 *
 * `own-shore` means the wave came from this beach's own offshore sample point
 * (utils/marineSamplePoints); `region` means it fell back to the area cell because the beach has
 * no geometry of its own (295 of 2.850 on 01/08/2026). Never surface this as a confidence badge:
 * a permanent "we are less sure here" label reads as "we do not know", and the beach's own SMB
 * floor already protects the number either way.
 */
export type SeaStatePointSource = 'own-shore' | 'region';

export interface BeachScore {
  beachId: number;
  score: number;
  swimmingScore: number;
  experienceScore: number;
  preferenceScore: number;
  finalSuitabilityScore: number;
  swimmingComfort: SwimmingComfort;
  forecastConfidence: ForecastConfidence;
  confidenceReasons: string[];
  reasons: string[];
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
  marine?: MarineForecast;
  /** Display/effective wave height (m), lifted above raw marine grid data when local wind,
   *  gusts, and fetch indicate wind chop that the grid can under-represent. */
  waveHeightM?: number;
  /** TRUE when the wave cell behind this sea describes other water — see SuitableBeach. */
  marineCellUntrusted?: boolean;
  /**
   * The decision-grade sea state (m) — what every score, cap and comfort call inside
   * calculateBeachScore already uses. `waveHeightM` above is DISPLAY ONLY (the cove guard
   * rewrites it), so anything making a decision must read this instead.
   */
  seaStateWaveM?: number;
  /** Total-sea period (s) behind seaStateWaveM — separates steep chop from a long roll. */
  seaStatePeriodS?: number;
  /**
   * The modelled height AT THE SAND (m), or undefined — the normal answer. Present only under
   * utils/shoreWave's four gates (blocked sector, no fetch, high-confidence geometry, no swell).
   * Unlike `waveHeightM` this one IS a decision input: the swim verdict's shore branch and the
   * podium's sea tier both read it. Modelled, never measured — printed with a «~».
   */
  shoreWaveHeightM?: number;
  /** ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ ΓΙΑ ΚΑΘΕ ΠΑΡΑΛΙΑ (m) — DISPLAY-ONLY, ποτέ κλειδί απόφασης. Βλ. types.ts. */
  shoreDisplayWaveM?: number;
  /** Ο αριθμός ακτής ήρθε από μετρημένη απόδειξη ότι το νερό φεύγει, όχι από την έκπτωση ×0,5. */
  shoreWaveFromDepartingSea?: boolean;
  /** Θερμοκρασία νερού (°C) — DISPLAY-ONLY, ποτέ κλειδί απόφασης. Βλ. utils/waterTemperatureCopy. */
  seaTemperatureC?: number;
  /**
   * Exposure of the sector TODAY'S SEA arrives from — utils/seaArrival.resolveSeaArrivalExposureLevel.
   * NOT the wind's exposure. Carried so the pin, the chip and the swim verdict all refuse the ×0,5
   * shelter discount on the same evidence; `undefined` = no opinion, behaviour unchanged.
   */
  seaArrivalExposureLevel?: string;
  /**
   * Τα σενάρια της πρόγνωσης διαφωνούν για τη ΜΕΡΑ που βαθμολογήθηκε
   * (utils/forecastUncertainty). Ταξιδεύει ως την πινέζα ώστε χάρτης και κάρτα να
   * φρενάρουν μαζί. Απουσία = δεν ξέρουμε = καμία αλλαγή.
   */
  forecastUncertain?: boolean;
  seaStateSource?: SeaStateSource;
  /** Which water the measurement describes — this beach's own shore, or the region cell. */
  seaStatePointSource?: SeaStatePointSource;
  /** Damped wind/fetch modeled wave height (m), including the conservative wind-chop floor. */
  modeledWaveHeightM?: number;
  /** The wind speed (km/h) this score was computed from — beach-cluster wind when available.
   *  Surfaced so cards can show a Beaufort that matches their (same-wind) wave value. */
  windSpeedKmph?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  weatherSource?: WeatherSource;
  hourlySeaScore?: number;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  windProfile?: WindProfile;
  windProfileSource?: WindProfileSource;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  /** Closed-cove (όρμος) morphology (>225° enclosure, narrow mouth, or curated). With
   *  canClaimWindProtection true, the cove genuinely stays calm today. */
  enclosedCove?: boolean;
  seaCalmClaimAllowed?: boolean;
  facingDeg?: number | null;
  simpleWindSuitability?: SimpleWindSuitability;
}

export interface BestBeachTime {
  bestStart: string;
  bestEnd: string;
  reason: string;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
}

export interface BeachRecommendation {
  beachId: number;
  score: number;
  swimmingScore?: number;
  experienceScore?: number;
  preferenceScore?: number;
  finalSuitabilityScore?: number;
  swimmingComfort?: SwimmingComfort;
  forecastConfidence?: ForecastConfidence;
  confidenceReasons?: string[];
  explanation: string;
  bestBeachTime?: BestBeachTime;
  bestTimeWindow?: string;
  avoidTimeWindow?: string;
  timeReason?: string;
  crowdLevel?: CrowdLevel;
  crowdScore?: number;
  exposureLevel?: ExposureLevel;
  orientation?: number | null;
  marine?: MarineForecast;
  /** Display/effective wave height (m), lifted above raw marine grid data when local wind,
   *  gusts, and fetch indicate wind chop that the grid can under-represent. */
  waveHeightM?: number;
  /** Decision-grade sea state (m) — see BeachScore.seaStateWaveM. `waveHeightM` is display only. */
  seaStateWaveM?: number;
  /** Total-sea period (s) behind seaStateWaveM. */
  seaStatePeriodS?: number;
  /** Modelled height AT THE SAND (m) where the four shoreWave gates allow it — see types.ts. */
  shoreWaveHeightM?: number;
  /** ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ ΓΙΑ ΚΑΘΕ ΠΑΡΑΛΙΑ (m) — DISPLAY-ONLY, ποτέ κλειδί απόφασης. Βλ. types.ts. */
  shoreDisplayWaveM?: number;
  /** Ο αριθμός ακτής ήρθε από μετρημένη απόδειξη ότι το νερό φεύγει, όχι από την έκπτωση ×0,5. */
  shoreWaveFromDepartingSea?: boolean;
  /** Θερμοκρασία νερού (°C) — DISPLAY-ONLY, ποτέ κλειδί απόφασης. Βλ. utils/waterTemperatureCopy. */
  seaTemperatureC?: number;
  /**
   * Exposure of the sector TODAY'S SEA arrives from — utils/seaArrival.resolveSeaArrivalExposureLevel.
   * NOT the wind's exposure. Carried so the pin, the chip and the swim verdict all refuse the ×0,5
   * shelter discount on the same evidence; `undefined` = no opinion, behaviour unchanged.
   */
  seaArrivalExposureLevel?: string;
  /**
   * Τα σενάρια της πρόγνωσης διαφωνούν για τη ΜΕΡΑ που βαθμολογήθηκε
   * (utils/forecastUncertainty). Ταξιδεύει ως την πινέζα ώστε χάρτης και κάρτα να
   * φρενάρουν μαζί. Απουσία = δεν ξέρουμε = καμία αλλαγή.
   */
  forecastUncertain?: boolean;
  /** Damped wind/fetch modeled wave height (m), including the conservative wind-chop floor. */
  modeledWaveHeightM?: number;
  /** Wind speed (km/h) this recommendation was scored with (beach-cluster when available), so a
   *  card's Beaufort matches its same-wind wave. */
  windSpeedKmph?: number;
  warnings?: WarningFlag[];
  confidence?: RecommendationConfidence;
  weatherSource?: WeatherSource;
  hourlySeaScore?: number;
  windProfile?: WindProfile;
  windProfileSource?: WindProfileSource;
  windSector?: WindSector;
  canClaimWindProtection?: boolean;
  seaCalmClaimAllowed?: boolean;
  simpleWindSuitability?: SimpleWindSuitability;
}

export type BeachWeatherById = Record<number, DailyForecast | undefined>;

interface ScoreOptions {
  weatherSource?: WeatherSource;
  hourlyForecast?: ForecastItem[];
  recentRainMm?: number;
  geospatialProfile?: GeospatialExposureProfile;
}

export type GeospatialExposureLookup = Record<number, GeospatialExposureProfile>;

// Ένας αριθμός, μία πηγή: το topPickRanking τον χρειάζεται κι αυτό (η ομάδα του βάθρου γεμίζει
// τις κενές θέσεις από 15/08/2026), και δύο «3» σε δύο αρχεία είναι πώς ξεκινούν οι αποκλίσεις.
export const MAX_TOP_RECOMMENDATION_DISPLAY_LIMIT = TOP_PICK_PODIUM_SEATS;

// Show up to 3 picks, capped only by how many actually cleared the Tier 0 safety gate
// (min(3, qualified)). The old floor(qualified/3) needed a 9-deep pool for 3 cards and
// hid good options on small islands; the stricter gate now does the quality filtering,
// so a clean pool of 2–3 can surface 2–3 cards. Pool depth no longer gates the count.
export const getTopRecommendationDisplayLimit = (qualifiedSuitableCount: number): number => {
  if (!Number.isFinite(qualifiedSuitableCount) || qualifiedSuitableCount <= 0) return 0;

  return Math.min(MAX_TOP_RECOMMENDATION_DISPLAY_LIMIT, Math.floor(qualifiedSuitableCount));
};

const clampScore = (score: number): number => Math.max(0, Math.min(100, Math.round(score)));

const formatTime = (item: ForecastItem): string => {
  const parts = item.dt_txt && item.dt_txt.includes(' ') ? item.dt_txt.split(' ') : [];
  if (parts.length > 1 && parts[1]) return parts[1].substring(0, 5);
  return new Date(item.dt * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatTimeWindow = (start?: string, end?: string): string | undefined => {
  if (!start) return undefined;
  return end && end !== start ? `${start}-${end}` : start;
};

const BEACH_VISIT_START_MINUTES = 10 * 60;
const BEACH_VISIT_END_MINUTES = 18 * 60;
const WIND_RISE_BEAUFORT_THRESHOLD = 4;
const MIN_WIND_RISE_WINDOW_MINUTES = 120;
const DEFAULT_FORECAST_SLOT_MINUTES = 60;
const MAX_FORECAST_SLOT_MINUTES = 240;
const MIN_VISIT_TEMP_C = 20;
const MAX_VISIT_TEMP_C = 35;

const getForecastMinutesOfDay = (item: ForecastItem): number => {
  const date = new Date(item.dt * 1000);
  return date.getHours() * 60 + date.getMinutes();
};

const formatMinutesAsClock = (minutes: number): string => {
  const normalized = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const getWeatherTemp = (weather: WeatherData | DailyForecast): number => {
  if ('main' in weather && weather.main) return weather.main.temp;
  if ('temp_max' in weather) return weather.temp_max;
  return 25;
};

export const getWeatherGustKmph = (
  weather: WeatherData | DailyForecast,
  hourlyForecast?: ForecastItem[]
): number | undefined => {
  const dailyGustFromKnots = typeof weather.wind?.windGustKnots === 'number' && Number.isFinite(weather.wind.windGustKnots)
    ? weather.wind.windGustKnots * 1.852
    : typeof weather.wind?.gustKnots === 'number' && Number.isFinite(weather.wind.gustKnots)
      ? weather.wind.gustKnots * 1.852
      : undefined;
  const dailyGust = dailyGustFromKnots ?? (
    typeof weather.wind?.gust === 'number' && Number.isFinite(weather.wind.gust)
      ? weather.wind.gust * 3.6
      : undefined
  );
  const hourlyGusts = getKeyBeachHours(hourlyForecast || ('hourly' in weather ? weather.hourly : undefined))
    .map(item => {
      if (typeof item.wind?.gustKnots === 'number' && Number.isFinite(item.wind.gustKnots)) {
        return item.wind.gustKnots * 1.852;
      }
      return typeof item.wind?.gust === 'number' && Number.isFinite(item.wind.gust)
        ? item.wind.gust * 3.6
        : undefined;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (hourlyGusts.length === 0) return dailyGust;
  return Math.max(dailyGust || 0, ...hourlyGusts);
};

// Gust spread paired per hour (gust_h - speed_h over the key beach hours): a
// smooth afternoon build, where the gust tracks the rising mean wind, is NOT
// gustiness — that rise is the afternoon-build penalty's job. Only same-hour
// gust excess counts. Falls back to day-max gust minus the representative wind
// when hourly pairs are missing.
const getWeatherGustSpreadKmph = (
  weather: WeatherData | DailyForecast,
  hourlyForecast: ForecastItem[] | undefined,
  fallbackBaseWindKmph: number
): number | undefined => {
  const spreads = getKeyBeachHours(hourlyForecast || ('hourly' in weather ? weather.hourly : undefined))
    .map(item => {
      const gust = typeof item.wind?.gustKnots === 'number' && Number.isFinite(item.wind.gustKnots)
        ? item.wind.gustKnots * 1.852
        : typeof item.wind?.gust === 'number' && Number.isFinite(item.wind.gust)
          ? item.wind.gust * 3.6
          : undefined;
      // The REAL mean, not the gust-floored one (utils/windGustFloor). Using the corrected mean
      // here would shrink every spread and quietly cancel the gust warnings.
      const rawSpeedMs = typeof item.wind?.speedBeforeGustFloor === 'number' && Number.isFinite(item.wind.speedBeforeGustFloor)
        ? item.wind.speedBeforeGustFloor
        : item.wind?.speed;
      const speed = typeof rawSpeedMs === 'number' && Number.isFinite(rawSpeedMs)
        ? rawSpeedMs * 3.6
        : undefined;
      return gust === undefined || speed === undefined ? undefined : Math.max(0, gust - speed);
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (spreads.length > 0) return Math.max(...spreads);

  const gustKmph = getWeatherGustKmph(weather, hourlyForecast);
  return typeof gustKmph === 'number' ? Math.max(0, gustKmph - fallbackBaseWindKmph) : undefined;
};

const getRecentRainMm = (hourlyForecast?: ForecastItem[], fallback?: number): number | undefined => {
  if (typeof fallback === 'number' && Number.isFinite(fallback)) return fallback;
  if (!hourlyForecast || hourlyForecast.length === 0) return undefined;

  // Forecast `dt` values carry Greek wall clock, so compare against the same clock.
  const now = athensNow().getTime();
  const recentRain = hourlyForecast
    .filter(item => {
      const timestamp = item.dt * 1000;
      return timestamp <= now && timestamp >= now - 48 * 60 * 60 * 1000;
    })
    .reduce((sum, item) => sum + (item.rain?.['3h'] || 0), 0);

  return recentRain > 0 ? recentRain : undefined;
};

const getBeachFetchExposure = (beach: Beach): FetchExposure | undefined => (
  beach.fetchExposure || beach.metadata?.fetchExposure
);

const getBeachSeabedSlope = (beach: Beach): SeabedSlope => (
  beach.seabedSlope || beach.metadata?.seabedSlope || 'unknown'
);

const getBeachWaterEntry = (beach: Beach): WaterEntry => (
  beach.waterEntry || beach.metadata?.waterEntry || 'unknown'
);

const getBeachWaterQualityRisk = (beach: Beach): WaterQualityRiskAfterRain | undefined => (
  beach.waterQualityRiskAfterRain || beach.metadata?.waterQualityRiskAfterRain
);

const hasBeachOfficialWarningStatus = (beach: Beach): boolean => (
  typeof beach.officialWarningOverride === 'boolean' ||
  typeof beach.metadata?.officialWarningOverride === 'boolean'
);

const hasOfficialWarningOverride = (beach: Beach): boolean => (
  beach.officialWarningOverride === true || beach.metadata?.officialWarningOverride === true
);

const getOfficialWarningReason = (beach: Beach): string => (
  beach.officialWarningReason || beach.metadata?.officialWarningReason || 'Official warning active for this beach.'
);

// Gust comfort thresholds (km/h), recalibrated 2026-06-26 when the app switched from a
// synthetic gust estimate (wind*1.2) to the real wind_gusts_10m feed. A 1.3-3x gust factor
// is normal marine gustiness and is harmless at low wind, so gusts only modify the verdict
// when there is real wind (>= GUST_MIN_BASE_BEAUFORT) AND the gust is either absolutely strong
// or disproportionately above the mean. The old thresholds were tuned for the tiny synthetic
// spread and made every beach warn once fed real gusts (measured: 100% -> ~25%).
const GUST_MIN_BASE_BEAUFORT = 3;
const GUST_NOTE_ABS_KMH = 40;             // gust strong enough to note on its own (~6 Bft)
const GUST_NOTE_SPREAD_KMH = 18;          // gust-minus-mean worth noting on a windy beach
const GUST_WARN_ABS_KMH = 55;             // prominent-warning gust (~7+ Bft)
const GUST_WARN_SPREAD_KMH = 30;          // prominent-warning spread
const GUST_EFFECTIVE_BFT_SPREAD_KMH = 22; // spread that bumps effective Beaufort +1 / docks experience

const getEffectiveBeaufortForComfort = (
  baseBeaufort: number,
  gustSpreadKmph: number | undefined,
  exposureLevel: ExposureLevel,
  waveHeightM: number | undefined
): number => {
  let effective = baseBeaufort;

  // Real gusts: bump effective Beaufort only on a windy beach with a substantial gust spread.
  if (baseBeaufort >= GUST_MIN_BASE_BEAUFORT && (gustSpreadKmph ?? 0) >= GUST_EFFECTIVE_BFT_SPREAD_KMH) effective += 1;
  if (baseBeaufort >= 4 && exposureLevel !== 'protected') effective += 1;
  if (typeof waveHeightM === 'number' && waveHeightM >= 0.9) effective += 1;
  if (exposureLevel === 'protected' && baseBeaufort <= 5 && (waveHeightM === undefined || waveHeightM < 0.5)) {
    effective -= 1;
  }

  return Math.max(0, Math.min(12, effective));
};

/** Harshest → mildest. Shelter relief below is counted in these steps. */
const SWIMMING_COMFORT_ORDER: readonly SwimmingComfort[] = ['avoid_swimming', 'caution', 'good', 'excellent'];

const swimmingComfortForWave = (
  swimmingScore: number,
  effectiveBeaufort: number,
  waveHeightM?: number
): SwimmingComfort => {
  if (effectiveBeaufort >= 6 || (typeof waveHeightM === 'number' && waveHeightM > 1.2) || swimmingScore < 45) {
    return 'avoid_swimming';
  }
  if (effectiveBeaufort >= 5 || (typeof waveHeightM === 'number' && waveHeightM >= 0.8) || swimmingScore < 60) {
    return 'caution';
  }
  if (effectiveBeaufort <= 2 && (waveHeightM === undefined || waveHeightM < 0.4) && swimmingScore >= 85) {
    return 'excellent';
  }
  return 'good';
};

/**
 * THE SWIM ADVICE READS THE SAME WATER THE PIN IS COLOURED FROM (01/08/2026).
 *
 * `effectiveWaveHeightM` is dominated by a marine grid point a median of 10 km offshore, so this
 * function was refusing swims at sheltered coves on the strength of the open sea outside them.
 * utils/suitabilityTone now damps that reading toward the shore before it colours a pin; if this
 * verdict kept reading the raw height, the two would disagree and we would be back to the defect
 * Miltos closed on 31/07 — a pin and a word describing different seas, one screen apart.
 *
 * So: compute both, take the milder, and cap the relief at ONE step for the same reason the
 * colour caps it — the shore-damping factors have not been validated against live grid data, and
 * a two-step lift could carry a genuinely dangerous sea from «μην κολυμπήσεις» to «καλή».
 * Wind and score are unaffected: shelter has never been allowed to soften those, and does not now.
 */
const swimmingComfortFromScore = (
  swimmingScore: number,
  effectiveBeaufort: number,
  waveHeightM?: number,
  officialOverride?: boolean,
  shoreWaveHeightM?: number,
  /**
   * THE SHORE BRANCH WAS DEAD ON ARRIVAL UNTIL 10/08/2026 (evening).
   *
   * The comparison below swaps the WAVE for its shore-damped value and takes the milder verdict —
   * but `swimmingScore` and `effectiveBeaufort` were computed from the OPEN-water height and were
   * handed to both branches unchanged. Both of them veto on their own (score < 45, Beaufort ≥ 6),
   * and both of those vetoes were charged BY the open-water wave: −25 on the score for a height
   * over 1,2 m, +1 on the Beaufort for a height over 0,9 m. So on exactly the beach this function
   * exists for — rough offshore, calm at the sand — the shore branch returned the open-water
   * answer and the relief never happened.
   *
   * Measured live, Σχινιάς 10/08/2026 17:00: open water 1,22 m / shore 0,61 m; the shore branch
   * computed 'avoid_swimming' from a score of 29 and an effective 7 Bft, both of them the open
   * sea's numbers. The pin beside it was YELLOW (the offshore-flat gate of 02/08 had already
   * decided that shore is glass), so the map and the verdict described two different seas — the
   * defect closed on 31/07 for the colour, still open for the word.
   *
   * `shoreView` therefore carries the score and the Beaufort RE-DERIVED from the shore height.
   * Everything else is unchanged: the relief is still capped at one step, wind and gusts are
   * still charged in full, and without a shore height there is still no second opinion at all.
   */
  shoreView?: { swimmingScore: number; effectiveBeaufort: number }
): SwimmingComfort => {
  if (officialOverride) return 'avoid_swimming';
  const openWater = swimmingComfortForWave(swimmingScore, effectiveBeaufort, waveHeightM);
  if (typeof shoreWaveHeightM !== 'number' || !Number.isFinite(shoreWaveHeightM)) return openWater;

  const shore = swimmingComfortForWave(
    shoreView?.swimmingScore ?? swimmingScore,
    shoreView?.effectiveBeaufort ?? effectiveBeaufort,
    shoreWaveHeightM
  );
  const step = Math.min(
    SWIMMING_COMFORT_ORDER.indexOf(shore),
    SWIMMING_COMFORT_ORDER.indexOf(openWater) + 1
  );
  return SWIMMING_COMFORT_ORDER[step] ?? openWater;
};

const hasActivePreferences = (preferences?: UserPreferences): boolean => (
  Boolean(preferences && Object.values(preferences).some(Boolean))
);

const isSurfaceFilter = (filter: FilterKey): boolean => (
  filter === 'sandy' || filter === 'pebbles' || filter === 'sandy-pebbles' || filter === 'rocky'
);

const matchesSurfaceFilter = (beach: Beach, filter: FilterKey): boolean => (
  // Each surface type is its own category: "Άμμος", "Βότσαλα" and "Άμμος + Βότσαλα" are
  // mutually exclusive (a beach has a single beachType). So "pebbles" must NOT also match a
  // sand-and-pebbles beach (and vice versa) — otherwise the same beach shows under two filters
  // and combining e.g. Βότσαλα + Άμμος+Βότσαλα wrongly returns results.
  beach.beachType === filter
);

const isQuietBeach = (beach: Beach): boolean => {
  if (beach.metadata?.environment?.quiet === false) return false;
  if (beach.amenities?.beachBar) return false;
  // "Quiet" needs a POSITIVE low-traffic signal: environment.quiet (confirmed few
  // reviews at build time) or a remote location. We deliberately no longer treat the
  // mere ABSENCE of amenity data as quiet — amenities are only ever marked positively,
  // so "no amenities on record" means "unknown", not "uncrowded". The old
  // !hasServiceAmenities fallback conflated the two and roughly doubled the set
  // (measured ~60% of all beaches, half of them purely from missing data).
  return Boolean(
    beach.environment?.quiet ||
    beach.environment?.remote
  );
};

const isFamilyFriendlyBeach = (beach: Beach): boolean => Boolean(
  beach.environment?.familyFriendly
);

const hasRockySnorkelingTerrain = (beach: Beach): boolean => {
  const terrainTypes = beach.metadata?.terrain?.types || [];
  return terrainTypes.includes('rocks') || terrainTypes.includes('large_stones');
};

const isSnorkelingBeach = (beach: Beach): boolean => Boolean(
  beach.activities?.snorkeling ||
  hasRockySnorkelingTerrain(beach) ||
  beach.beachType === 'rocky'
);

const hasBeachBarAmenity = (beach: Beach): boolean => Boolean(beach.amenities?.beachBar);
const hasBlueFlag2026Award = (beach: Beach): boolean => (
  beach.blueFlag2026?.awarded === true ||
  beach.metadata?.blueFlag2026?.awarded === true
);
// Safety-first: the "accessible" filter surfaces ONLY currently-active sea-access ramps.
// Uninstalled / unverified Seatrac beaches must not pass (wrong info can strand a wheelchair user).
//
// Ο κανόνας ζει σε ΕΝΑ σημείο (`utils/accessibility`) μαζί με την εποχικότητα, ώστε φίλτρο και
// σήμα κάρτας να μην μπορούν να αποκλίνουν. Το φίλτρο περνάει όλο τον χρόνο· η σεζόν αλλάζει
// μόνο το τι λέει το σήμα.
const hasDisabledAccess = (beach: Beach): boolean => hasListedSeatracRamp(beach);

export const beachMatchesUserPreferences = (beach: Beach, preferences?: UserPreferences): boolean => {
  if (!hasActivePreferences(preferences) || !preferences) return true;

  const typeFiltersActive = preferences.sandy || preferences.pebbles;
  if (typeFiltersActive) {
    const matchesSandy = preferences.sandy && matchesSurfaceFilter(beach, 'sandy');
    const matchesPebbles = preferences.pebbles && matchesSurfaceFilter(beach, 'pebbles');
    if (!matchesSandy && !matchesPebbles) return false;
  }

  if (preferences.blueFlag2026 && !hasBlueFlag2026Award(beach)) return false;
  if (preferences.disabledAccess && !hasDisabledAccess(beach)) return false;
  if (preferences.quiet && !isQuietBeach(beach)) return false;
  if (preferences.beachBar && !hasBeachBarAmenity(beach)) return false;
  if (preferences.familyFriendly && !isFamilyFriendlyBeach(beach)) return false;
  if (preferences.snorkeling && !isSnorkelingBeach(beach)) return false;
  if (preferences.easyAccess && !hasTrulyEasyAccess(beach)) return false;
  if (preferences.deepWater && !beach.characteristics?.deepWaters) return false;
  if (preferences.shallowWater && !beach.characteristics?.shallowWaters) return false;
  // Shared with the map marker via utils/surfSpots — see the note there on why
  // this must not be re-implemented inline.
  if (preferences.surfing && !isSurfSpotInSeason(beach)) return false;
  if (preferences.parking && !beach.amenities?.parking) return false;

  return true;
};

export const filterBeachesByUserPreferences = (
  beaches: Beach[],
  preferences?: UserPreferences
): Beach[] => beaches.filter(beach => beachMatchesUserPreferences(beach, preferences));

const getKeyBeachHours = (hourlyForecast?: ForecastItem[]): ForecastItem[] => {
  if (!hourlyForecast || hourlyForecast.length === 0) return [];

  const daytime = hourlyForecast.filter(item => {
    const hour = new Date(item.dt * 1000).getHours();
    return hour >= 10 && hour <= 18;
  });

  if (daytime.length >= 3) return daytime;
  return hourlyForecast.slice(0, 12);
};

const RAIN_PROBABILITY_BLOCK_THRESHOLD = 0.35;
// When Open-Meteo gives us an hourly precipitation probability and it is
// confidently low, trust it over a borderline weather code (e.g. a "drizzle"
// code at 10% chance). This only suppresses rain flags — it never adds them —
// so detection can get quieter and more accurate but never noisier. Missing
// probability data falls back to the original weather-code behaviour.
const RAIN_PROBABILITY_SUPPRESS_BELOW = 0.3;

const hasRainWeatherText = (item: ForecastItem): boolean => {
  const weatherText = (item.weather || [])
    .map(entry => `${entry.main || ''} ${entry.description || ''}`)
    .join(' ')
    .toLowerCase();
  return /rain|storm|thunder|drizzle|shower/.test(weatherText);
};

export const hasHourlyRainRisk = (item: ForecastItem): boolean => {
  if (
    typeof item.precipitationProbability === 'number' &&
    item.precipitationProbability < RAIN_PROBABILITY_SUPPRESS_BELOW
  ) {
    return false;
  }

  return (
    hasRainWeatherText(item) ||
    (typeof item.pop === 'number' && item.pop >= RAIN_PROBABILITY_BLOCK_THRESHOLD) ||
    (typeof item.rain?.['3h'] === 'number' && item.rain['3h'] > 0)
  );
};

const calculateHourlyRainRisk = (
  hourlyForecast?: ForecastItem[]
): { rainyHours: number; checkedHours: number; allKeyHoursRainy: boolean; hasRainRisk: boolean; rainyWindows: string[] } => {
  const keyHours = getKeyBeachHours(hourlyForecast);
  if (keyHours.length === 0) {
    return { rainyHours: 0, checkedHours: 0, allKeyHoursRainy: false, hasRainRisk: false, rainyWindows: [] };
  }

  const rainyHours = keyHours.filter(hasHourlyRainRisk);
  return {
    rainyHours: rainyHours.length,
    checkedHours: keyHours.length,
    allKeyHoursRainy: rainyHours.length === keyHours.length,
    hasRainRisk: rainyHours.length > 0,
    rainyWindows: rainyHours.map(formatTime),
  };
};

/** Per-hour effective wave height + the exposure/wind context used to derive it. */
export interface HourlyWaveAssessment {
  dt: number;
  /** Local hour 0–23. */
  hour: number;
  windSpeedKmh: number;
  exposureLevel: ExposureLevel;
  isExposed: boolean;
  /** Display/scoring wave height (m): max(measured, max(SMB·damping, wind-chop floor)). */
  effectiveWaveHeightM: number;
  /** Total-sea period (s) for this hour, when the marine grid reported one. */
  wavePeriodS?: number;
  /** True when this hour had a live marine wave value (not purely wind-modeled). */
  hasMeasured: boolean;
}

// Single source of truth for an hour's effective wave: directional exposure (so fetch tracks the
// hour's own wind direction), fetch-limited SMB damped by exposure, the wind-chop floor, and the
// live marine value when present. The daily headline, the sea score, and the wave strip all run
// this same rule so they can never show contradictory wave heights for the same hour.
const assessHourlyWave = (
  beach: Beach,
  item: ForecastItem,
  geospatialProfile?: GeospatialExposureProfile
): HourlyWaveAssessment => {
  const windDirection = degToCompass(item.wind.deg);
  const windSpeedKmh = item.wind.speed * 3.6;
  const beaufort = getBeaufortLevel(windSpeedKmh);
  const gustKmph = typeof item.wind.gustKnots === 'number' && Number.isFinite(item.wind.gustKnots)
    ? item.wind.gustKnots * 1.852
    : typeof item.wind.gust === 'number' && Number.isFinite(item.wind.gust)
      ? item.wind.gust * 3.6
      : undefined;
  const windAssessment = assessBeachWindExposure({
    beach,
    windDirectionDeg: item.wind.deg,
    windDirection,
    windSpeedKmh,
    beaufort,
    waveHeightMeters: item.marine?.waveHeightM,
    geospatialProfile,
  });
  const exposureLevel = windAssessment.exposureLevel;
  const measured = item.marine?.waveHeightM;
  const hasMeasured = typeof measured === 'number' && Number.isFinite(measured);
  // The same geometric ceiling the daily headline applies (utils/geometricWaveCeiling). It has to
  // be here too: the wave strip and the headline are checked against each other by
  // scripts/validateWaveDisplayAgreement, and a ceiling on only one of them would print a 0,4 μ.
  // headline above a row of 1,0 μ. bars for the same hours.
  const hourSwell = assessSwellExposure(geospatialProfile, windAssessment.windProfile.beachFacingDirection, {
    swellDirectionDeg: item.marine?.swellWaveDirectionDeg,
    swellHeightM: item.marine?.swellWaveHeightM,
    swellPeriodS: item.marine?.swellWavePeriodS,
  });
  const hourCeiling = resolveGeometricWaveCeiling({
    profile: geospatialProfile,
    windSpeedKmh,
    gustKmph,
    suspectPin: windAssessment.windProfile.suspectPin,
    arrivingSwellPresent: hourSwell.exposed || (
      (item.marine?.swellWaveHeightM ?? 0) >= SWELL_MIN_HEIGHT_M &&
      typeof item.marine?.swellWaveDirectionDeg !== 'number'
    ),
  });
  // Same function as the beach page — this used to be the same arithmetic written
  // out again, differing only in when it rounded.
  const { effectiveWaveHeightM } = resolveDisplayWaveHeightM({
    exposureLevel,
    modeledWaveHeightM: windAssessment.modeledWaveHeightM,
    beaufort,
    windSpeedKmh,
    gustKmph,
    meanSpeedBeforeGustFloorKmh: typeof item.wind.speedBeforeGustFloor === 'number'
      ? item.wind.speedBeforeGustFloor * 3.6
      : undefined,
    measuredWaveHeightM: measured,
    swell: { heightM: item.marine?.swellWaveHeightM, periodS: item.marine?.swellWavePeriodS },
    seaArrival: resolveSeaArrival(geospatialProfile, windAssessment.facingDeg, item.marine?.waveDirectionDeg),
    geometricCeilingM: hourCeiling?.ceilingM,
  });
  return {
    dt: item.dt,
    hour: new Date(item.dt * 1000).getHours(),
    windSpeedKmh,
    exposureLevel,
    isExposed: exposureLevel !== 'protected',
    effectiveWaveHeightM,
    wavePeriodS: item.marine?.wavePeriodS ?? item.marine?.swellWavePeriodS,
    hasMeasured,
  };
};

/**
 * Per-hour effective wave heights for a beach, using the exact same rule as the daily score.
 * Consumed by the detail-page wave strip so every hourly bar matches the headline figure.
 */
export const computeHourlyEffectiveWaves = (
  beach: Beach,
  hourlyForecast?: ForecastItem[],
  geospatialProfile?: GeospatialExposureProfile
): HourlyWaveAssessment[] =>
  (hourlyForecast ?? []).map(item => assessHourlyWave(beach, item, geospatialProfile));

const calculateHourlySeaScore = (
  beach: Beach,
  hourlyForecast?: ForecastItem[],
  geospatialProfile?: GeospatialExposureProfile
): { score?: number; poorHours: number; checkedHours: number } => {
  const keyHours = getKeyBeachHours(hourlyForecast);
  if (keyHours.length === 0) return { poorHours: 0, checkedHours: 0 };

  const scores = keyHours.map(item => {
    const assessment = assessHourlyWave(beach, item, geospatialProfile);
    return calculateSeaConditionScore(
      assessment.isExposed,
      assessment.windSpeedKmh,
      assessment.exposureLevel,
      assessment.effectiveWaveHeightM,
      false,
      assessment.wavePeriodS
    );
  });

  const score = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  return {
    score,
    poorHours: scores.filter(value => value < 5).length,
    checkedHours: scores.length,
  };
};

const getMetadataConfidence = (beach: Beach): 'high' | 'medium' | 'low' => (
  beach.metadata?.confidence || beach.orientation?.confidence || 'medium'
);

const calculateRecommendationConfidence = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  warnings: WarningFlag[],
  options?: ScoreOptions,
  hourlySeaScore?: number,
  dataQualityReasons: string[] = []
): RecommendationConfidence => {
  let score = 55;
  const reasons: string[] = [];
  const weatherSource = options?.weatherSource || 'island-fallback';
  const keyHours = getKeyBeachHours(options?.hourlyForecast || ('hourly' in weather ? weather.hourly : undefined));

  if (weatherSource === 'beach-cluster') {
    score += 18;
    reasons.push('beach-area forecast');
  } else {
    score -= 8;
    reasons.push('island-level fallback');
  }

  if (weather.wind?.speed !== undefined && weather.wind?.deg !== undefined) {
    score += 10;
  } else {
    score -= 20;
    reasons.push('missing wind data');
  }

  if (
    typeof weather.wind?.gust === 'number' ||
    typeof weather.wind?.gustKnots === 'number' ||
    typeof weather.wind?.windGustKnots === 'number' ||
    keyHours.some(item => typeof item.wind?.gust === 'number' || typeof item.wind?.gustKnots === 'number')
  ) {
    score += 4;
  } else {
    score -= 5;
    reasons.push('gust data unavailable');
  }

  if (weather.marine?.waveHeightM !== undefined) {
    score += 14;
    reasons.push('marine wave data');
  } else {
    score -= 10;
    reasons.push('wind-based sea estimate');
  }

  if (keyHours.length >= 4) {
    score += 10;
    reasons.push('hourly beach window');
  } else {
    score -= 8;
  }

  const orientationConfidence = beach.orientation?.confidence || 'medium';
  if (orientationConfidence === 'high') score += 12;
  else if (orientationConfidence === 'medium') score += 5;
  else {
    score -= 12;
    reasons.push('orientation needs verification');
  }

  const metadataConfidence = getMetadataConfidence(beach);
  if (metadataConfidence === 'high') score += 6;
  else if (metadataConfidence === 'low') {
    score -= 10;
    reasons.push('beach metadata needs verification');
  }

  const negativeFeedback = getNegativeFeedbackCount(beach.id);
  if (negativeFeedback > 0) {
    score -= Math.min(15, negativeFeedback * 4);
    reasons.push('recent feedback flagged accuracy');
  }

  if (!hasBeachOfficialWarningStatus(beach)) {
    score -= 6;
    reasons.push('official warnings not checked');
  }

  // Dedup before counting: the same data-quality reason can be pushed from more
  // than one code path, and each duplicate silently cost another 4 points while
  // the displayed list was already deduped.
  const uniqueDataQualityReasons = Array.from(new Set(dataQualityReasons));
  if (uniqueDataQualityReasons.length > 0) {
    score -= Math.min(24, uniqueDataQualityReasons.length * 4);
    reasons.push(...uniqueDataQualityReasons);
  }

  if (warnings.some(warning => warning.severity === 'critical')) score -= 10;
  if (typeof hourlySeaScore === 'number' && hourlySeaScore < 5) score -= 10;

  const normalized = clampScore(score);
  const calculatedLevel: ForecastConfidence = normalized >= 75 ? 'high' : normalized >= 55 ? 'medium' : 'low';
  const level: ForecastConfidence = !hasBeachOfficialWarningStatus(beach) && calculatedLevel === 'high'
    ? 'medium'
    : calculatedLevel;

  return {
    level,
    score: normalized,
    source: weatherSource,
    reasons: Array.from(new Set(reasons)).slice(0, 5),
  };
};

const exposurePriority = (exposureLevel?: ExposureLevel): number => {
  if (exposureLevel === 'protected') return 0;
  if (exposureLevel === 'partial') return 1;
  return 2;
};

const MEANINGFUL_WIND_TOP_PICK_BEAUFORT = 3;
const PROTECTED_FIRST_BEAUFORT = 5;
const MIN_TOP_PICK_SEA_CONDITION_SCORE = 7;

// Tier 0 false-protected gate (best-available-shelter doctrine). A genuine refuge
// faces broadly the way the wind blows TOWARD — within ±60° of windToward (the SE–SW
// arc for a north wind). 60° (not 90°) is deliberate: a 90° window would admit
// due-east/due-west cross-shore beaches as "lee", which is exactly the trap.
const LEEWARD_ARC_DEG = 60;
const angularDistanceDeg = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

const facesAwayFromWind = (facingDeg: number | null | undefined, windDirectionDeg: number): boolean => {
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return true;
  const windTowardDeg = (windDirectionDeg + 180) % 360;
  return angularDistanceDeg(facingDeg, windTowardDeg) <= LEEWARD_ARC_DEG;
};

// A meltemi/strong-wind top pick is "false-protected" when it is surfaced as a
// confident swim pick while it neither genuinely claims wind protection NOR faces
// leeward — i.e. a quartering/cross-shore beach (canClaim=false) carried only by a
// caution-grade score. Mirrors validateRecommendationScenarios.mjs. Only binds from
// meaningful wind upward; light-wind days choose on other merits.
// Exported for the trip planner's safety gate — the planner must never name a
// beach this predicate would keep off the podium.
export const isFalseProtectedTopPick = <T extends {
  canClaimWindProtection?: boolean;
  swimmingComfort?: SwimmingComfort;
  windProfile?: WindProfile;
}>(item: T, windDirectionDeg: number, windBeaufort: number): boolean => {
  if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) return false;
  return (
    item.canClaimWindProtection === false &&
    item.swimmingComfort === 'caution' &&
    !facesAwayFromWind(item.windProfile?.beachFacingDirection, windDirectionDeg)
  );
};

const hasMainstreamFacilities = (beach: Beach): boolean => Boolean(
  beach.metadata?.organized ??
  (beach.amenities?.organized || beach.amenities?.beachBar || beach.amenities?.sunbeds || beach.amenities?.taverna || beach.amenities?.restaurant)
);

const topPickPopularityScore = (beach: Beach): number => {
  return getBeachTouristRecognitionScore(beach);
};

const topPickAccessPriority = (beach: Beach): number => {
  const accessType = beach.metadata?.access?.type;
  if (hasDifficultTopPickAccess(beach)) return 5;
  if (accessType === 'asphalt_road') return 0;
  if (accessType === 'passable_dirt_road') return 1;
  if (accessType === 'hiking_path_easy') return 2;
  if (!accessType && beach.accessibility === Accessibility.EASY) return 0;
  if (!accessType && beach.accessibility === Accessibility.MODERATE) return 1;
  if (hasMainstreamTopPickAccess(beach)) return 3;
  return 4;
};

const topPickAmenitiesScore = (beach: Beach): number => {
  let score = 0;
  if (hasMainstreamFacilities(beach)) score += 8;
  if (hasTopPickVisitorServices(beach)) score += 6;
  if (beach.amenities?.parking) score += 4;
  if (beach.amenities?.naturalShade) score += 2;
  if (beach.environment?.familyFriendly) score += 2;
  return score;
};

// Hard access partition (Miltos 2026-06-16): hard-to-reach / adventurous beaches
// (boat-only, difficult footpath, 4x4, remote) ALWAYS rank after every reasonably
// accessible beach in a ranked list, regardless of fame or score. The top of the list
// is "good access + plenty of comforts"; adventure beaches sit at the end for the
// visitor who scrolls looking for them. Uses the same predicate as the "adventure" filter.
const adventureAccessRank = (beach: Beach): number => (isAdventureBeach(beach) ? 1 : 0);

// Amenities bucketed (well-equipped / some / none) so that only a CATEGORICAL comfort
// gap precedes recognition — not a single +2 shade point. Mirrors the proximity-zone
// rationale: promote "plenty of amenities" without letting trivial diffs reorder icons.
const amenitiesTier = (beach: Beach): number => {
  if (hasTopPickVisitorServices(beach) || hasMainstreamFacilities(beach)) return 2;
  if (beach.amenities?.parking || beach.amenities?.naturalShade || beach.environment?.familyFriendly) return 1;
  return 0;
};

const hasTopPickVisitorServices = (beach: Beach): boolean => {
  const metadataAmenities = beach.metadata?.amenities?.join(' ').toLowerCase() || '';

  return Boolean(
    beach.metadata?.organized === true ||
    beach.amenities?.organized ||
    beach.amenities?.beachBar ||
    beach.amenities?.sunbeds ||
    beach.amenities?.taverna ||
    beach.amenities?.restaurant ||
    /beach bar|sunbed|ξαπλώστρ|ομπρέλ|καφέ|cafe|ταβέρν|taverna|restaurant|εστιατόρ/.test(metadataAmenities)
  );
};

const hasMainstreamTopPickProfile = (beach: Beach): boolean => Boolean(
  hasTopPickVisitorServices(beach) ||
  beach.amenities?.parking ||
  beach.environment?.familyFriendly
);

const getPriorityBeach = <T extends { beachId?: number; beach?: Beach }>(
  item: T,
  beachById?: Map<number, Beach>
): Beach | undefined => (
  item.beach ?? (item.beachId !== undefined ? beachById?.get(Number(item.beachId)) : undefined)
);

const hasTrustedTopPickStaticData = (beach: Beach): boolean => {
  const metadata = beach.metadata;
  const metadataWithAppVisibility = metadata as (Beach['metadata'] & { excludeFromApp?: boolean }) | undefined;

  if (metadataWithAppVisibility?.excludeFromApp) return false;
  if (getMetadataConfidence(beach) !== 'high') return false;
  if (!hasMainstreamTopPickAccess(beach)) return false;
  if (!hasMainstreamTopPickProfile(beach)) return false;
  if (!metadata?.access?.type || metadata.access.type === 'unknown') return false;
  if (!metadata?.terrain?.types?.length || beach.beachType === 'unknown') return false;
  if (!metadata?.waterDepth?.type && !beach.waterDepth) return false;
  if (beach.orientation?.confidence === 'low') return false;

  return true;
};

/**
 * The EVIDENCE half of the trust gate: is the wind/confidence data behind this
 * item solid enough to back a shelter claim? Split out of
 * isTrustedTopRecommendationCandidate so the trip planner can gate its
 * SENTENCES on evidence without inheriting the editorial half
 * (hasTrustedTopPickStaticData), which requires a mainstream commercial
 * profile that an unknown sheltered cove structurally cannot have.
 * Candidacy is gated by safety; the sentence is gated by evidence.
 */
export const hasTrustedWindEvidence = <T extends {
  confidence?: RecommendationConfidence;
  windProfile?: WindProfile;
  windProfileSource?: WindProfileSource;
  exposureLevel?: ExposureLevel;
  canClaimWindProtection?: boolean;
}>(
  item: T,
  windBeaufort: number = MEANINGFUL_WIND_TOP_PICK_BEAUFORT
): boolean => {
  if (item.confidence?.level === 'low') return false;

  // Geometry-earned protection IS evidence. `canClaimWindProtection` on a protected item is
  // granted either by trusted authored data or by the strict enclosure gate
  // (windExposureEngine.hasGeometryEnclosedProtection: high-confidence mask, live sector
  // ≥95% land-blocked, low residual wind) — the same gate the map pin, the card verdict and
  // the directory already trust. Without this, a stale low-confidence authored override
  // (e.g. the 06/2026 Naxos phase-1 coverage profiles) vetoed beaches the geometry now
  // verifies: on a 5 Bft Naxos meltemi the map painted 14 beaches Ιδανική/Καλή while the
  // podium could surface exactly one (measured 10/08/2026, .tmp/reproParosPodium.mjs).
  // Items that do not carry the claim fields (the trip planner's deliberately authored-only
  // evidence object) are unaffected.
  const geometryVouches = item.canClaimWindProtection === true && item.exposureLevel === 'protected';

  if (item.windProfile?.confidence === 'low' && !geometryVouches) return false;

  // From meaningful wind upward, do not make a top recommendation from legacy/unknown wind exposure.
  if (windBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && item.windProfileSource === 'unknown' && !geometryVouches) {
    return false;
  }

  return true;
};

/**
 * ΔΙΑΒΑΖΕΙ ΤΟ ΝΕΡΟ ΑΛΛΟΥ ΚΟΛΠΟΥ, ΚΑΙ ΣΗΜΕΡΑ ΑΥΤΟ ΜΕΤΡΑΕΙ (22/08/2026).
 *
 * Ο δικός μας έλεγχος βρίσκει 255 παραλίες των οποίων το θαλάσσιο κελί περιγράφει άλλο νερό. Η
 * σημαία ήταν ψημένη μέσα στα προφίλ γεωμετρίας και **καμία γραμμή παραγωγής δεν τη διάβαζε** —
 * το ίδιο το εργαλείο που την έγραψε το σημείωνε στην έξοδό του.
 *
 * ΥΠΟ ΣΥΝΘΗΚΗ, ΟΧΙ ΠΑΝΤΑ (απόφαση Μίλτου, 22/08). Σε ήρεμη μέρα κάθε κελί λέει «λάδι» και ο
 * αποκλεισμός θα πετούσε καλές παραλίες χωρίς κανένα όφελος — μετρημένα, θα άδειαζε 6 βάθρα αντί
 * για 2. Μπαίνει μόνο όταν ο αριθμός του κύματος κάνει πραγματική δουλειά στη σειρά.
 */
const readsOtherWaterThatMattersToday = (item: {
  marineCellUntrusted?: boolean;
  seaStateWaveM?: number;
  waveHeightM?: number;
}): boolean => {
  if (!item.marineCellUntrusted) return false;
  const seaReliedOnM = item.seaStateWaveM ?? item.waveHeightM;
  return typeof seaReliedOnM === 'number' && seaReliedOnM >= UNTRUSTED_CELL_SEA_FLOOR_M;
};

export const isTrustedTopRecommendationCandidate = <T extends {
  beachId?: number;
  beach?: Beach;
  confidence?: RecommendationConfidence;
  windProfile?: WindProfile;
  windProfileSource?: WindProfileSource;
  exposureLevel?: ExposureLevel;
  canClaimWindProtection?: boolean;
  marineCellUntrusted?: boolean;
  seaStateWaveM?: number;
  waveHeightM?: number;
}>(
  item: T,
  beachById?: Map<number, Beach>,
  windBeaufort: number = MEANINGFUL_WIND_TOP_PICK_BEAUFORT
): boolean => {
  const beach = getPriorityBeach(item, beachById);
  if (!beach || !hasTrustedTopPickStaticData(beach)) return false;
  if (readsOtherWaterThatMattersToday(item)) return false;
  return hasTrustedWindEvidence(item, windBeaufort);
};

/**
 * WHY THIS BEACH IS NOT IN THE RECOMMENDATIONS — the answer the map owed the reader.
 *
 * Miltos, 10/08/2026: «όλοι αυτοί οι λόγοι που μπορεί να μην μπαίνει μια μπλε παραλία στις
 * προτεινόμενες θα πρέπει να τους ξέρει ο χρήστης». He is right, and the silence was the worst
 * part of it: the map paints a beach ΙΔΑΝΙΚΗ, the podium above it does not mention it, and
 * nothing on the page says whether that is a judgement about today or about our own data.
 *
 * Returns null when the beach clears every gate — it was simply outranked, or three slots were
 * not enough, and inventing a reason for that would be worse than saying nothing. So a line only
 * ever appears where a REAL rule kept the beach out.
 *
 * The order is what the reader can act on, not the order the gates happen to run in: a safety
 * call first, then a permanent property of the beach (how you get there), then today's sea, and
 * only then an admission about our own records. Each branch is the same predicate the podium
 * itself uses — this function must never become a second opinion about who qualifies.
 */
export type TopPickExclusionReason =
  | 'safety'
  | 'access'
  | 'access_dirt'
  | 'access_walk'
  | 'access_unknown'
  | 'sea'
  /** Το κύμα του σήμερα κρίνει, αλλά το κελί που το δίνει περιγράφει άλλο νερό. */
  | 'sea_cell'
  | 'unverified';

export const explainTopPickExclusion = (
  item: SuitableBeach,
  windBeaufort: number,
  windSpeedKmph: number,
  fallbackWaveHeightM?: number
): TopPickExclusionReason | null => {
  const beach = item.beach;
  if (!beach) return null;

  if (
    item.swimmingComfort === 'avoid_swimming' ||
    item.warnings?.some(warning => warning.type === 'official_warning' && warning.severity === 'critical')
  ) {
    return 'safety';
  }

  /**
   * Beaches you cannot simply drive up to are not "worse", they are a different kind of day out —
   * the podium puts them after every reachable beach by decision (16/06/2026), so this is the
   * honest word for them rather than dressing it up as a conditions call.
   *
   * ΤΕΣΣΕΡΙΣ ΛΟΓΟΙ, ΟΧΙ ΕΝΑΣ (Μίλτος, 14/08/2026). Αυτή η γραμμή επέστρεφε πάντα `'access'`, και
   * το κείμενό του έλεγε «θέλει σκάφος ή δύσκολο μονοπάτι» — για **1.000 από τις 1.380** παραλίες
   * που το έπαιρναν ήταν ψέμα (μετρημένο, βλ. `utils/access.getHardAccessKind`). Ο διαχωρισμός δεν
   * γίνεται εδώ: ρωτάει το ίδιο αρχείο που όρισε το φίλτρο, ώστε λεζάντα και κριτήριο να μη
   * μπορούν να αποκλίνουν.
   */
  const hardAccessKind = getHardAccessKind(beach);
  if (hardAccessKind === 'boat_or_hard_path') return 'access';
  if (hardAccessKind === 'dirt_road') return 'access_dirt';
  if (hardAccessKind === 'walk') return 'access_walk';
  if (hardAccessKind === 'unknown') return 'access_unknown';

  /**
   * ΠΡΙΝ ΤΗ ΘΑΛΑΣΣΑ, ΚΑΙ Η ΠΥΛΗ ΤΟ ΕΠΙΑΣΕ (22/08/2026).
   *
   * Η πρώτη μου εκδοχή έβαζε αυτόν τον λόγο ΜΕΤΑ το `'sea'`. Η πύλη έδειξε ότι 53 από τις
   * παραλίες που φεύγουν έπαιρναν «Πιο ταραγμένη θάλασσα στη δική της ακτή σήμερα» — δηλαδή
   * κατηγορούσαμε το νερό της παραλίας με βάση **ακριβώς τον αριθμό που δηλώνουμε ότι δεν
   * εμπιστευόμαστε**. Όταν δεν ξέρουμε ποιο νερό διαβάζουμε, δεν έχουμε δικαίωμα να πούμε ότι
   * είναι ταραγμένο· έχουμε δικαίωμα να πούμε μόνο ότι δεν ξέρουμε.
   *
   * Η ασφάλεια και η πρόσβαση μένουν από πάνω: η μία δεν χαλαρώνει ποτέ, η άλλη δεν εξαρτάται
   * καθόλου από το νερό.
   */
  if (readsOtherWaterThatMattersToday(item)) return 'sea_cell';

  if (
    (typeof item.swimmingScore === 'number' && item.swimmingScore < 50) ||
    // The item's own scored wind when it carries one — the explanation must judge with the same
    // wind the gates themselves use (10/08), or it would tell a calm-shore beach its sea fails
    // a check the actual gate no longer runs against the region figure.
    !passesTopPickSeaGate(item, item.windSpeedKmph ?? windSpeedKmph, fallbackWaveHeightM)
  ) {
    return 'sea';
  }

  // Last, and deliberately so: this one is about US, not about the beach. It fires for a missing
  // access type, unknown terrain or depth, low-confidence orientation, or wind exposure we cannot
  // back — the gate that keeps a beach off the podium while the map still colours it from live
  // weather (Πλαζ Καλαμπάκα, ΙΔΑΝΙΚΗ at 3,0 km on 10/08, is exactly this case).
  if (!hasTrustedTopPickStaticData(beach) || !hasTrustedWindEvidence(item, windBeaufort)) {
    return 'unverified';
  }

  return null;
};

const visibleExposurePriority = (item: { exposureLevel?: ExposureLevel; canClaimWindProtection?: boolean }): number => {
  if (item.exposureLevel === 'protected' && item.canClaimWindProtection === false) return 1;
  return exposurePriority(item.exposureLevel);
};

const topPickProfilePriority = <T extends { exposureLevel?: ExposureLevel; canClaimWindProtection?: boolean; beachId?: number; beach?: Beach }>(
  item: T,
  beachById?: Map<number, Beach>
): number => {
  void beachById;
  return visibleExposurePriority(item);
};

const compareOptionalDistance = <T extends { distance?: number }>(a: T, b: T): number => {
  const aDistance = typeof a.distance === 'number' && Number.isFinite(a.distance) ? a.distance : undefined;
  const bDistance = typeof b.distance === 'number' && Number.isFinite(b.distance) ? b.distance : undefined;

  if (aDistance === undefined || bDistance === undefined) return 0;
  return aDistance - bDistance;
};

// Tier 2 proximity uses discrete zones, not raw distance, so that only a CATEGORICAL
// difference (e.g. very close vs short drive) precedes recognition — a 6 km vs 8 km
// gap stays within one zone and does not reorder above iconic recognition. Returns 0
// when distance is unknown (e.g. no user location), so the tier is simply skipped.
// The top zone boundary is 30 km, not 50: these are straight-line km, so 50 of them
// is well over an hour of Greek road. Lumping 16 km and 45 km into one zone let a
// far beach outrank a near one on a lesser tie-break (amenities), which reads wrong
// under "near me". 30 km ≈ a 45-minute drive — still one beach-day category.
const proximityZone = (distanceKm: number): number => {
  if (distanceKm < 5) return 0;
  if (distanceKm < 15) return 1;
  if (distanceKm < 30) return 2;
  return 3;
};

const compareProximityZone = <T extends { distance?: number }>(a: T, b: T): number => {
  const aDistance = typeof a.distance === 'number' && Number.isFinite(a.distance) ? a.distance : undefined;
  const bDistance = typeof b.distance === 'number' && Number.isFinite(b.distance) ? b.distance : undefined;
  if (aDistance === undefined || bDistance === undefined) return 0;
  return proximityZone(aDistance) - proximityZone(bDistance);
};

// Cove refuge sub-tier (Miltos 2026-07-18), STRONG-WIND ONLY (caller gates on ≥5 Bft).
// Among beaches that already tie on the protected exposure tier, a genuine enclosed cove
// (curated / >225° geometry) whose shelter still holds today outranks a merely-leeward
// "protected" beach: at strong wind a closed basin is the more reliable calm swim than an
// open shoreline that only happens to face away. Lower rank = earlier. Below 5 Bft this is
// never consulted (calm everywhere, no cove edge), and hard-access/boat coves never reach
// here anyway — the adventure partition demotes them first, so only REACHABLE coves gain.
const coveRefugeRank = (item: { enclosedCove?: boolean; canClaimWindProtection?: boolean }): number =>
  item.enclosedCove === true && item.canClaimWindProtection !== false ? 0 : 1;

const compareRecommendationPriority = <T extends { score: number; exposureLevel?: ExposureLevel; canClaimWindProtection?: boolean; enclosedCove?: boolean; beach?: Beach; distance?: number }>(
  a: T,
  b: T,
  beachById?: Map<number, Beach>,
  windBeaufort: number = PROTECTED_FIRST_BEAUFORT
): number => {
  const profileDiff = topPickProfilePriority(a, beachById) - topPickProfilePriority(b, beachById);
  const exposureDiff = visibleExposurePriority(a) - visibleExposurePriority(b);
  const scoreDiff = b.score - a.score;
  const beachA = getPriorityBeach(a, beachById);
  const beachB = getPriorityBeach(b, beachById);

  // Hard access partition (Miltos 2026-06-16): adventurous / hard-to-reach beaches always
  // sort after EVERY reasonably accessible beach — ahead of exposure, recognition and score —
  // so a ranked list leads with "good access + plenty of comforts" and the hard-to-reach /
  // adventurous ones sit at the end for whoever scrolls for them. The top-3 picks already
  // exclude these via the mainstream-access gate, so this only reshapes the broader
  // suitable/explore list; each card still carries its own exposure and safety labels.
  const adventureRankDiff = beachA && beachB
    ? adventureAccessRank(beachA) - adventureAccessRank(beachB)
    : 0;
  if (adventureRankDiff !== 0) return adventureRankDiff;

  const compareTouristPriority = (): number => {
    if (!beachA || !beachB) return 0;

    // Tier 2 lexicographic order among comparably accessible beaches: proximity zone
    // (if location known) → easiest access → most amenities → recognition → verified
    // trust (seatrac online) → distance → fine amenities → id. Access + amenities lead
    // (Miltos 2026-06-16): the front of the list is "easy to reach, plenty of comforts"
    // before fame; recognition still breaks ties below them (refines the 2026-06-14
    // recognition-above-access call, which was about MEDIOCRE access, not hard access).
    const proximityDiff = compareProximityZone(a, b);
    if (proximityDiff !== 0) return proximityDiff;

    const accessPriorityDiff = topPickAccessPriority(beachA) - topPickAccessPriority(beachB);
    if (accessPriorityDiff !== 0) return accessPriorityDiff;

    const amenitiesTierDiff = amenitiesTier(beachB) - amenitiesTier(beachA);
    if (amenitiesTierDiff !== 0) return amenitiesTierDiff;

    const popularityDiff = topPickPopularityScore(beachB) - topPickPopularityScore(beachA);
    if (Math.abs(popularityDiff) >= 1) return popularityDiff;

    const verifiedTrustDiff = (hasDisabledAccess(beachB) ? 1 : 0) - (hasDisabledAccess(beachA) ? 1 : 0);
    if (verifiedTrustDiff !== 0) return verifiedTrustDiff;

    const distanceDiff = compareOptionalDistance(a, b);
    if (distanceDiff !== 0) return distanceDiff;

    const amenitiesDiff = topPickAmenitiesScore(beachB) - topPickAmenitiesScore(beachA);
    if (amenitiesDiff !== 0) return amenitiesDiff;

    return beachA.id - beachB.id;
  };

  if (windBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && profileDiff !== 0) return profileDiff;

  if (windBeaufort >= PROTECTED_FIRST_BEAUFORT) {
    if (exposureDiff !== 0) return exposureDiff;
    // Genuine enclosed cove wins the protected tie at strong wind (see coveRefugeRank).
    const coveDiff = coveRefugeRank(a) - coveRefugeRank(b);
    if (coveDiff !== 0) return coveDiff;
    const touristDiff = compareTouristPriority();
    return touristDiff || scoreDiff;
  }

  if (windBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    if (exposureDiff !== 0 && Math.abs(scoreDiff) <= 12) return exposureDiff;
    const touristDiff = compareTouristPriority();
    return touristDiff || exposureDiff || scoreDiff;
  }

  if (Math.abs(scoreDiff) > 5) return scoreDiff;
  const touristDiff = compareTouristPriority();
  return touristDiff || scoreDiff || exposureDiff;
};

/**
 * ΤΟ ΔΙΔΥΜΟ ΤΗΣ ΣΕΛΙΔΑΣ ΠΑΡΑΛΙΑΣ — ΠΗΡΕ ΤΟ §Γ8 ΔΥΟ ΜΕΡΕΣ ΑΡΓΟΤΕΡΑ (15/08/2026).
 *
 * Είναι το αντίγραφο της `topPickRanking.bestShelteredRecommendationGroup` για τη λίστα
 * «κοντινές παραλίες» της σελίδας παραλίας (μοναδικός δρόμος: prioritizeProtectedBeachRecommendations
 * → getTopRecommendedBeaches → BeachDetailPage). Το §Γ8 (14/08) ανέβασε τον φραγμό από 3 σε 5
 * Μποφόρ στην ΑΡΧΙΚΗ και **αυτό εδώ έμεινε πίσω στο 3** — δηλαδή η σελίδα παραλίας εξακολουθούσε
 * να πετάει έξω κάθε «μερική» μόλις υπήρχε μία «προστατευμένη», από τα 3 Μποφόρ.
 *
 * Ο ΛΟΓΟΣ ΕΙΝΑΙ Ο ΙΔΙΟΣ ΚΑΙ ΕΙΝΑΙ ΜΕΤΡΗΜΕΝΟΣ (βλ. topPickRanking §Γ8): στα 3-4 Μποφόρ η διαφορά
 * κύματος προστατευμένης/μερικής είναι 0,13-0,24 μ., δηλαδή ΜΕΣΑ στο σφάλμα του ίδιου μας του
 * μοντέλου (PODIUM_SEA_MEANINGFUL_DIFFERENCE_M = 0,25). Πετούσαμε παραλίες έξω για διαφορά που
 * δεν μπορούμε να μετρήσουμε — στη μία οθόνη όπου ο επισκέπτης ψάχνει εναλλακτική.
 *
 * ΤΙ ΔΕΝ ΑΛΛΑΖΕΙ. Η ΣΕΙΡΑ μένει στα 3 Μποφόρ: το `compareRecommendationPriority` παρακάτω
 * εξακολουθεί να βάζει την προστατευμένη ΠΑΝΩ από τη μερική από 3 Μποφόρ. Άρα στα 3-4 η λίστα
 * γεμίζει, με τις προστατευμένες μπροστά — δεν γίνεται πιο επιεικής. Και κάθε πύλη ασφαλείας
 * (avoid_swimming, κρίσιμη επίσημη προειδοποίηση, swimmingScore < 50, sea gate) έχει ΗΔΗ τρέξει
 * πριν φτάσουμε εδώ, στο getTopRecommendedBeaches.
 *
 * ΤΟ §Γ9 ΔΕΝ ΕΦΑΡΜΟΖΕΤΑΙ ΕΔΩ, ΚΑΙ ΕΙΝΑΙ ΣΩΣΤΟ. Το §Γ9 λέει «αν ο χάρτης έχει βάψει ΙΔΑΝΙΚΗ, το
 * χρώμα ξεκλειδώνει και κατατάσσει πριν από τη βαθμίδα». Αυτή η επιφάνεια ΔΕΝ ζωγραφίζει πινέζες
 * και δεν έχει πίνακα χρωμάτων (BeachDetailPage:1725 — καμία `mapBeachTones`). Η ίδια η κανονική
 * συνάρτηση είναι σχεδιασμένη να ΣΩΠΑΙΝΕΙ όταν λείπει ο πίνακας (prerender, πρώτο frame,
 * σχεδιαστής ταξιδιού), οπότε η βαθμίδα είναι η σωστή απάντηση εδώ. Αν κάποτε η σελίδα παραλίας
 * αποκτήσει χρώματα, ΤΟΤΕ μπαίνει το §Γ9 — και τότε η σωστή κίνηση είναι να καλέσει την ΚΑΝΟΝΙΚΗ
 * συνάρτηση, όχι να ξαναγραφτεί εδώ (§Κ1: ένα αντίγραφο ενός κανόνα δεν είναι ο κανόνας).
 */
const bestShelteredRecommendationGroup = <T extends { score: number; exposureLevel?: ExposureLevel; canClaimWindProtection?: boolean; beachId?: number; beach?: Beach }>(
  items: T[],
  windBeaufort: number,
  beachById?: Map<number, Beach>
): T[] => {
  if (windBeaufort < PROTECTED_FIRST_BEAUFORT || items.length === 0) return items;

  const bestPriority = Math.min(...items.map(item => topPickProfilePriority(item, beachById)));
  return items.filter(item => topPickProfilePriority(item, beachById) === bestPriority);
};

// Tier 1 variety de-dup. A "coastal sector" is (island + facing bucket): beaches on
// the same island whose shoreline faces a similar way sit in the same sector, so three
// adjacent leeward beaches of one bay collapse to one pick. Geographically distinct
// beaches (different island or different facing) stay separate. Beaches with unknown
// facing get their own per-id sector so they are never wrongly merged.
const COASTAL_SECTOR_BUCKET_DEG = 45;

const coastalSectorKey = (beach: Beach | undefined): string => {
  if (!beach) return 'unknown';
  const island = beach.location?.island || beach.location?.region || 'unknown';
  const facing = beach.orientation?.degrees;
  if (typeof facing !== 'number' || !Number.isFinite(facing)) return `${island}#beach-${beach.id}`;
  const bucket = Math.floor((((facing % 360) + 360) % 360) / COASTAL_SECTOR_BUCKET_DEG);
  return `${island}#sector-${bucket}`;
};

// Splits an already best-first-sorted list into one representative per coastal sector
// (kept, order preserved) and the rest (waitlist, order preserved). The caller fills
// from the waitlist only if it still needs picks — relaxing variety, never the gate.
const dedupeByCoastalSector = <T extends { beachId?: number; beach?: Beach }>(
  sortedItems: T[],
  beachById?: Map<number, Beach>
): { kept: T[]; waitlist: T[] } => {
  const seen = new Set<string>();
  const kept: T[] = [];
  const waitlist: T[] = [];
  sortedItems.forEach(item => {
    const key = coastalSectorKey(getPriorityBeach(item, beachById));
    if (seen.has(key)) {
      waitlist.push(item);
    } else {
      seen.add(key);
      kept.push(item);
    }
  });
  return { kept, waitlist };
};

const prioritizeProtectedBeachRecommendations = <T extends { score: number; exposureLevel?: ExposureLevel; canClaimWindProtection?: boolean; beachId?: number; beach?: Beach }>(
  items: T[],
  beachById?: Map<number, Beach>,
  windBeaufort: number = 0
): T[] => {
  const candidates = bestShelteredRecommendationGroup(items, windBeaufort, beachById);
  const sorted = [...candidates].sort((a, b) => compareRecommendationPriority(a, b, beachById, windBeaufort));
  // Tier 1: one pick per coastal sector first; remaining picks (same-sector) go last
  // so they only appear when the display limit cannot be filled by distinct sectors.
  const { kept, waitlist } = dedupeByCoastalSector(sorted, beachById);
  return [...kept, ...waitlist];
};

const greekWindDirectionsAccusative: Record<WindDirection, string> = {
  [WindDirection.N]: 'βόρειους',
  [WindDirection.NE]: 'βορειοανατολικούς',
  [WindDirection.E]: 'ανατολικούς',
  [WindDirection.SE]: 'νοτιοανατολικούς',
  [WindDirection.S]: 'νότιους',
  [WindDirection.SW]: 'νοτιοδυτικούς',
  [WindDirection.W]: 'δυτικούς',
  [WindDirection.NW]: 'βορειοδυτικούς',
};

/**
 * Returns a visit window only when wind rises to 4+ Bft later in the beach day.
 * If there is no clear 2h+ window before that rise, no time recommendation is shown.
 */
export const calculateBestBeachTime = (hourlyForecast: ForecastItem[], beach?: Beach): BestBeachTime | undefined => {
  if (!hourlyForecast || hourlyForecast.length === 0) return undefined;

  const dayEntries = hourlyForecast
    .map(item => {
      const startMinutes = getForecastMinutesOfDay(item);
      const windSpeedKmph = item.wind.speed * 3.6;
      const temp = item.main.temp;
      return {
        item,
        startMinutes,
        windSpeedKmph,
        temp,
        beaufort: getBeaufortLevel(windSpeedKmph),
      };
    })
    .filter(entry => (
      entry.startMinutes >= BEACH_VISIT_START_MINUTES &&
      entry.startMinutes <= BEACH_VISIT_END_MINUTES
    ))
    .sort((a, b) => a.startMinutes - b.startMinutes)
    .map((entry, index, entries) => {
      const nextStart = entries[index + 1]?.startMinutes;
      const endMinutes = nextStart !== undefined &&
        nextStart > entry.startMinutes &&
        nextStart - entry.startMinutes <= MAX_FORECAST_SLOT_MINUTES
          ? Math.min(BEACH_VISIT_END_MINUTES, nextStart)
          : Math.min(BEACH_VISIT_END_MINUTES, entry.startMinutes + DEFAULT_FORECAST_SLOT_MINUTES);

      return {
        ...entry,
        endMinutes,
        suitableBeforeWindRise: (
          entry.beaufort < WIND_RISE_BEAUFORT_THRESHOLD &&
          !hasHourlyRainRisk(entry.item) &&
          entry.temp >= MIN_VISIT_TEMP_C &&
          entry.temp <= MAX_VISIT_TEMP_C
        ),
      };
    });

  if (dayEntries.length < 2) return undefined;

  const windRiseIndex = dayEntries.findIndex(entry => entry.beaufort >= WIND_RISE_BEAUFORT_THRESHOLD);
  if (windRiseIndex <= 0) return undefined;

  let windowStartIndex = windRiseIndex - 1;
  while (windowStartIndex >= 0 && dayEntries[windowStartIndex].suitableBeforeWindRise) {
    windowStartIndex -= 1;
  }
  windowStartIndex += 1;

  if (windowStartIndex >= windRiseIndex) return undefined;

  const windowStartMinutes = dayEntries[windowStartIndex].startMinutes;
  const windRiseMinutes = dayEntries[windRiseIndex].startMinutes;
  if (windRiseMinutes - windowStartMinutes < MIN_WIND_RISE_WINDOW_MINUTES) return undefined;

  const bestStart = formatMinutesAsClock(windowStartMinutes);
  const bestEnd = formatMinutesAsClock(windRiseMinutes);
  const avoidEnd = formatMinutesAsClock(BEACH_VISIT_END_MINUTES);
  const avoidTimeWindow = windRiseMinutes < BEACH_VISIT_END_MINUTES
    ? formatTimeWindow(bestEnd, avoidEnd)
    : undefined;
  const timeReason = `Wind reaches ${dayEntries[windRiseIndex].beaufort} Beaufort around ${bestEnd}, so this is the useful window before it picks up.`;
  const bestTimeWindow = formatTimeWindow(bestStart, bestEnd);

  return {
    bestStart,
    bestEnd,
    reason: timeReason,
    bestTimeWindow,
    avoidTimeWindow,
    timeReason,
  };
};

export const getBeachSearchFilterValues = (beach: Beach, language: LanguageCode): string[] => {
  const genericValues = [
    'paralia',
    'παραλία',
    'beach',
    'plage',
    'strand',
    'spiaggia',
    beach.location?.island,
    beach.location?.region,
  ].filter((value): value is string => Boolean(value));
  const genericVariants = new Set(genericValues.flatMap(getSearchVariants));
  const aliases = (beach.aliases || []).filter(alias => {
    const aliasVariants = getSearchVariants(alias);
    return aliasVariants.length > 0 && !aliasVariants.every(variant => genericVariants.has(variant));
  });

  return [
    beach.name[language],
    beach.name.en,
    beach.name.gr,
    ...aliases,
  ];
};

/**
 * Filters beaches based on search query and active filters.
 */
export const filterBeaches = (
  beaches: Beach[],
  filters: FilterKey[],
  searchQuery: string,
  language: LanguageCode
): Beach[] => {
  let result = beaches;

  // 1. Search Query
  if (searchQuery.trim()) {
    result = result.filter(b => isSearchMatch(searchQuery, getBeachSearchFilterValues(b, language)));
  }

  // 2. Filters
  if (filters.length > 0 && !filters.includes('showAll')) {
    const surfaceFilters = filters.filter(isSurfaceFilter);
    const nonSurfaceFilters = filters.filter(f => !isSurfaceFilter(f));

    result = result.filter(b => {
      const matchesSelectedSurface = surfaceFilters.length === 0 || surfaceFilters.some(f => matchesSurfaceFilter(b, f));
      if (!matchesSelectedSurface) return false;

      return nonSurfaceFilters.every(f => {
        const filterName = f as string;
        if (f === 'easyAccess') return hasTrulyEasyAccess(b);
        if (filterName === 'disabledAccess') return hasDisabledAccess(b);
        if (filterName === 'quiet') return isQuietBeach(b);
        if (filterName === 'familyFriendly') return isFamilyFriendlyBeach(b);
        if (filterName === 'snorkeling') return isSnorkelingBeach(b);
        if (filterName === 'adventure') return isAdventureBeach(b);
        if (filterName === 'sunset') return isSunsetFacingBeach(b);
        if (filterName === 'naturist') return isNaturistBeach(b);
        if (filterName === 'beachBar') return hasBeachBarAmenity(b);
        // Seasonal, so it can never be the raw `activities.surfing` flag the fallback below would
        // have read: the western breaks are November–April and the Aegean ones meltemi-driven, so
        // a raw read offers a winter-only spot in August. Same rule the preference path has always
        // used (beachMatchesUserPreferences) — written here too because a filter key does not go
        // through preferences. Not reachable from the UI today: `surfing` is in no filter sheet and
        // in no search-intent rule. It is written down now precisely so the day it is added, it
        // does not arrive wrong.
        if (filterName === 'surfing') return isSurfSpotInSeason(b);
        // Check amenities
        if (b.amenities && f in b.amenities) return b.amenities[f as keyof typeof b.amenities];
        // Check characteristics
        if (b.characteristics && f in b.characteristics) return b.characteristics[f as keyof typeof b.characteristics];
        // Check activities
        if (b.activities && f in b.activities) return b.activities[f as keyof typeof b.activities];
        // Check environment
        if (b.environment && f in b.environment) return b.environment[f as keyof typeof b.environment];
        // Fail safe: an unrecognized filter key (typo, or a new UI filter never wired
        // to a handler/field here) must EXCLUDE, not silently match every beach. All
        // currently-offered keys are handled above or exist on one of the objects, so
        // this only guards against a future key falling through unnoticed.
        return false;
      });
    });
  }

  return result;
};

/**
 * Does THIS beach carry THIS filter? The single-beach form of `filterBeaches`, and the only
 * answer allowed anywhere.
 *
 * Every surface that decides which chips to OFFER used to answer it with its own hand-written
 * copy — App's `beachMatchesMobileFilter`, BeachSearcherHome's `beachMatchesAdvancedFilter` —
 * and copies drift. Both of those read only `amenities` and `characteristics` in their fallback,
 * so a filter living under `activities` or `environment` would have been reported as "no beach in
 * this region has it" and quietly dropped from the sheet; the second one had no `disabledAccess`
 * branch at all. Neither was reachable with today's filter list, which is exactly how a defect
 * like this survives until the day someone adds a key.
 *
 * A single filter is passed, so the surface-type OR inside `filterBeaches` reduces to equality —
 * this is a pure membership test, not a combination one.
 */
export const beachMatchesFilterKey = (beach: Beach, filter: FilterKey): boolean => (
  filterBeaches([beach], [filter], '', 'en').length === 1
);

/**
 * Sorts beaches based on the selected option.
 */
export const sortBeaches = (
  beaches: Beach[],
  sortBy: SortOption,
  userLocation?: { lat: number; lon: number }
): Beach[] => {
  const sorted = [...beaches];

  switch (sortBy) {
    case 'all':
      break;

    case 'protected':
      sorted.sort((a, b) => getBeachPopularityRating(b) - getBeachPopularityRating(a));
      break;

    case 'recommended':
      sorted.sort((a, b) => getBeachPopularityRating(b) - getBeachPopularityRating(a));
      break;
      
    case 'rating':
      sorted.sort((a, b) => getBeachPopularityRating(b) - getBeachPopularityRating(a));
      break;
      
    case 'distance':
      sorted.sort((a, b) => {
        const existingDistanceA = (a as Beach & { distance?: number }).distance;
        const existingDistanceB = (b as Beach & { distance?: number }).distance;
        const distA = typeof existingDistanceA === 'number' && Number.isFinite(existingDistanceA)
          ? existingDistanceA
          : userLocation
            ? calculateDistance(userLocation.lat, userLocation.lon, a.coordinates.lat, a.coordinates.lon)
            : Number.POSITIVE_INFINITY;
        const distB = typeof existingDistanceB === 'number' && Number.isFinite(existingDistanceB)
          ? existingDistanceB
          : userLocation
            ? calculateDistance(userLocation.lat, userLocation.lon, b.coordinates.lat, b.coordinates.lon)
            : Number.POSITIVE_INFINITY;

        if (distA !== distB) return distA - distB;
        return getBeachPopularityRating(b) - getBeachPopularityRating(a);
      });
      break;
  }

  return sorted;
};

/**
 * Calculates a suitability score (0-100) for a beach based on current weather and user location.
 */
export const calculateBeachScore = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  preferences?: UserPreferences,
  options?: ScoreOptions
): BeachScore => {
  const reasons: string[] = [];
  const warnings: WarningFlag[] = [];
  const addWarning = (warning: WarningFlag) => {
    if (!warnings.some(existing => existing.type === warning.type && existing.message === warning.message)) {
      warnings.push(warning);
    }
  };
  const weatherSource = options?.weatherSource || 'island-fallback';
  /**
   * ΤΑ ΣΕΝΑΡΙΑ ΔΙΑΦΩΝΟΥΝ ΓΙΑ ΑΥΤΗ ΤΗ ΜΕΡΑ (§ΑΞ2/Α5, 21/08/2026).
   *
   * Διαβάζεται ΜΙΑ φορά εδώ και ταξιδεύει σε τρεις προορισμούς — την ετυμηγορία, το τσιπ της
   * κάρτας και τη βαθμολογία που διαβάζει η πινέζα — ώστε καμία επιφάνεια να μην μπορεί να
   * απαντήσει διαφορετικά. Υπάρχει μόνο πάνω σε ημέρα πρόγνωσης· ο «τωρινός καιρός»
   * (WeatherData) δεν έχει αύριο, άρα δεν φρενάρει ποτέ.
   */
  const forecastUncertain = (weather as DailyForecast)?.forecastUncertain === true;

  // Safety check for missing weather data
  if (!weather || !weather.wind) {
    const confidence: RecommendationConfidence = {
      level: 'low',
      score: 0,
      source: weatherSource,
      reasons: ['weather data unavailable'],
    };
    return {
      beachId: beach.id,
      score: 0,
      swimmingScore: 0,
      experienceScore: 0,
      preferenceScore: 0,
      finalSuitabilityScore: 0,
      swimmingComfort: 'avoid_swimming',
      forecastConfidence: 'low',
      confidenceReasons: confidence.reasons,
      reasons: ["Weather data unavailable"],
      warnings: [{
        type: 'missing_data',
        severity: 'warning',
        message: 'Weather data unavailable.'
      }],
      confidence,
      weatherSource,
    };
  }

  // 1. Weather Data Conversion
  const hourlyForecast = options?.hourlyForecast || ('hourly' in weather ? weather.hourly : undefined);
  const windSpeedKmph = weather.wind.speed * 3.6;
  // Ο ΩΜΟΣ μέσος, μόνο για τον υπολογισμό «πόσο ριπώδης» — ο δάπεδος ριπής
  // (utils/windGustFloor) ανεβάζει τον μέσο, και αν το spread μετριόταν από τον ανεβασμένο θα
  // έσβηνε τις ίδιες τις προειδοποιήσεις ριπών που ο δάπεδος υπάρχει για να ενισχύσει.
  const rawMeanWindKmphForSpread = typeof weather.wind.speedBeforeGustFloor === 'number'
    ? weather.wind.speedBeforeGustFloor * 3.6
    : undefined;
  const windDir = degToCompass(weather.wind.deg);
  const baseBeaufort = getBeaufortLevel(windSpeedKmph);
  const gustKmph = getWeatherGustKmph(weather, hourlyForecast);
  // Ο ωμός μέσος ΚΑΙ στο εφεδρικό μονοπάτι. Χωρίς αυτό, όταν λείπει η ωριαία πρόγνωση το
  // spread μετριόταν από τον ανεβασμένο μέσο και έβγαινε μικρότερο — το ίδιο σβήσιμο
  // προειδοποιήσεων που η κύρια διαδρομή είχε ήδη κλείσει (γρ. 324-331).
  const gustSpreadKmph = getWeatherGustSpreadKmph(weather, hourlyForecast, rawMeanWindKmphForSpread ?? windSpeedKmph);
  const temp = getWeatherTemp(weather);
  const marine = weather.marine;
  const waveHeightM = marine?.waveHeightM;
  const recentRainMm = getRecentRainMm(hourlyForecast, options?.recentRainMm);
  const windAssessment = assessBeachWindExposure({
    beach,
    geospatialProfile: options?.geospatialProfile,
    windDirectionDeg: weather.wind.deg,
    windDirection: windDir,
    windSpeedKmh: windSpeedKmph,
    beaufort: baseBeaufort,
    waveHeightMeters: waveHeightM,
    waveDirectionDegrees: marine?.waveDirectionDeg,
    wavePeriodSeconds: marine?.wavePeriodS,
    swellHeightMeters: marine?.swellWaveHeightM,
    swellDirectionDegrees: marine?.swellWaveDirectionDeg,
    seaSurfaceTemperature: marine?.seaSurfaceTemperatureC,
  });
  const fetchExposure = windAssessment.windProfile.fetchExposure || getBeachFetchExposure(beach);
  const seabedSlope = getBeachSeabedSlope(beach);
  const waterEntry = getBeachWaterEntry(beach);
  const waterQualityRiskAfterRain = getBeachWaterQualityRisk(beach);
  const isFamilyMode = Boolean(preferences?.familyFriendly);
  const officialWarningOverride = hasOfficialWarningOverride(beach);
  const dataQualityReasons: string[] = [];

  if (waveHeightM === undefined) {
    warnings.push({
      type: 'missing_data',
      severity: 'info',
      message: 'Wave data unavailable; using wind-based sea estimate.'
    });
    dataQualityReasons.push('missing wave data');
  }
  if (typeof gustKmph !== 'number') {
    dataQualityReasons.push('missing gust data');
  }
  if (!fetchExposure || fetchExposure === 'unknown') {
    dataQualityReasons.push('fetch exposure unknown');
  }
  dataQualityReasons.push(...windAssessment.confidenceReasons);
  if (seabedSlope === 'unknown' && isFamilyMode) {
    dataQualityReasons.push('family entry slope unknown');
  }
  if (waterEntry === 'unknown' && isFamilyMode) {
    dataQualityReasons.push('family water entry unknown');
  }
  if (recentRainMm === undefined) {
    dataQualityReasons.push('recent rain data unavailable');
  }
  if (!hasBeachOfficialWarningStatus(beach)) {
    dataQualityReasons.push('official warning status unknown');
  }
  if (beach.metadata?.confidence === 'low') {
    warnings.push({
      type: 'low_confidence',
      severity: 'info',
      message: 'Beach metadata needs local verification.'
    });
  }
  if (windAssessment.windProfile.confidence === 'low' || windAssessment.source === 'unknown') {
    addWarning({
      type: 'low_confidence',
      severity: 'info',
      message: baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
        ? 'Local wind exposure needs confirmation before committing.'
        : 'Local wind shelter is not verified, but wind should not be a major issue today.',
    });
  }
  if (officialWarningOverride) {
    warnings.push({
      type: 'official_warning',
      severity: 'critical',
      message: getOfficialWarningReason(beach),
    });
  }
  if (beach.accessibility === Accessibility.DIFFICULT) {
    warnings.push({
      type: 'difficult_access',
      severity: 'warning',
      message: 'Access may be difficult.'
    });
  } else if (beach.accessibility === Accessibility.BOAT_ONLY) {
    warnings.push({
      type: 'boat_only',
      severity: 'warning',
      message: 'Boat access only.'
    });
  }

  // 2. Wind Protection & Direction Analysis
  const beachOrientation = windAssessment.windProfile.beachFacingDirection;
  let finalExposureLevel: ExposureLevel = windAssessment.exposureLevel;
  windAssessment.warnings.forEach(addWarning);
  windAssessment.reasons.forEach(reason => reasons.push(reason));
  reasons.push(windAssessment.simpleWindSuitability.explanationText);

  // Fetch-limited modeled wave fills the gap when live marine data is missing,
  // so a beach that is exposed in strong wind cannot float on a high score just
  // because no buoy reported. SMB gives open-water Hs, so we damp it toward the
  // shore by exposure (sheltered/cross-shore beaches see far less of it).
  const measuredWaveHeightM = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM) ? waveHeightM : undefined;
  // Numeric scoring and display use the effective beach-level wave/chop value.
  // The raw Open-Meteo marine value stays in `marine.waveHeightM` for traceability, but
  // a low grid value must not make a windy exposed beach look flat calm — and, in the other
  // direction, the grid's over-reported swell must not make a 1 Bft "λάδι" day look choppy.
  // Where this sea is arriving from, in THIS beach's frame. At light wind it decides whether the
  // grid reading describes water the beach actually faces (trust it) or water behind it (cap it).
  // The bearing is the wave's own direction, not the wind's — the whole point is that a sea can
  // run onshore while the local wind does something else entirely.
  const seaArrival = resolveSeaArrival(
    options?.geospatialProfile,
    windAssessment.facingDeg,
    marine?.waveDirectionDeg
  );
  // The same bearing, asked a different question: not "how much water is behind that direction"
  // but "have we judged the sector it comes through OPEN". It is what stops a shore sheltered from
  // today's WIND from also being treated as sheltered from a sea arriving from somewhere else —
  // see utils/seaArrival and utils/waveCharacter.shoreSeaStateM for the Καβαλικευτά case.
  const seaArrivalExposureLevel = resolveSeaArrivalExposureLevel(
    options?.geospatialProfile,
    marine?.waveDirectionDeg
  );
  // Direct-swell geometry (utils/swellExposure). Computed HERE rather than at its old site further
  // down, because the geometric wave ceiling below needs it and the ceiling has to be decided before
  // the effective height exists. The warnings it raises still fire at the original place.
  const swell = assessSwellExposure(options?.geospatialProfile, beachOrientation, {
    swellDirectionDeg: marine?.swellWaveDirectionDeg,
    swellHeightM: marine?.swellWaveHeightM,
    swellPeriodS: marine?.swellWavePeriodS,
  });
  /**
   * ΤΟ ΚΥΜΑ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΞΕΠΕΡΝΑΕΙ ΟΣΟ ΧΩΡΑΕΙ Ο ΚΟΛΠΟΣ (13/08/2026).
   *
   * The one cap in this function that is NOT display-only, decided by Miltos after a Σχίσμα
   * Ελούντας webcam showed glass while the page printed 0,94 μ. taken 13,8 km out in the open
   * Mirabello. See utils/geometricWaveCeiling for the full argument; the short version is that it
   * asks "how much open water does this beach have at all", never "where is the wind coming from",
   * so no misread facing can move it. It binds `effectiveWaveHeightM`, which is what the colour,
   * the verdict, the score and the printed number all read — deliberately, because leaving the
   * colour tied to an impossible wave is how «κύμα 0,15 μ.» ends up above «προσοχή».
   *
   * Same swell test as the shore-wave estimate below: a swell that can reach this shore, or a
   * meaningful one whose direction is unknown, removes the ceiling entirely. SMB models local
   * wind-sea only, and ground swell is the one thing a fetch argument cannot see.
   */
  const arrivingSwellPresent = swell.exposed || (
    (marine?.swellWaveHeightM ?? 0) >= SWELL_MIN_HEIGHT_M &&
    typeof marine?.swellWaveDirectionDeg !== 'number'
  );
  /**
   * Μετρημένη απόδειξη ότι ΟΛΟ το νερό φεύγει από αυτή την ακτή — utils/shoreWave.isSeaDepartingShore.
   * Υπολογίζεται εδώ, δίπλα στο arrivingSwellPresent, γιατί είναι το ίδιο ερώτημα από την ανάποδη
   * και τα δύο διαβάζουν τα ίδια πεδία θάλασσας. Ξεκλειδώνει ΜΟΝΟ τις δύο γεωμετρικές πύλες του
   * shoreWave· κάθε άλλος φραγμός (ράμπα, δάπεδο, «ποτέ πιο δυνατά από την ανοιχτή θάλασσα») μένει.
   */
  const departingSea = isSeaDepartingShore({
    facingDeg: windAssessment.facingDeg,
    windDirectionDeg: weather.wind.deg,
    components: [
      { heightM: marine?.waveHeightM, directionDeg: marine?.waveDirectionDeg },
      { heightM: marine?.swellWaveHeightM, directionDeg: marine?.swellWaveDirectionDeg },
    ],
  });
  /**
   * Το ίδιο ερώτημα ανάποδα — utils/shoreWave.isSeaArrivingShore. Διαβάζει τα ΙΔΙΑ δύο συστατικά
   * θάλασσας, γι' αυτό κάθεται εδώ: μια θάλασσα δεν μπορεί να φεύγει και να έρχεται μαζί, και οι
   * δύο απαντήσεις πρέπει να βγαίνουν από την ίδια λίστα. Κλείνει την εκτίμηση ακτής όταν το νερό
   * αποδεδειγμένα μπαίνει, ώστε ένας απόγειος άνεμος να μη σβήνει ένα κύμα που ήρθε από αλλού.
   */
  const arrivingSea = isSeaArrivingShore({
    facingDeg: windAssessment.facingDeg,
    profile: options?.geospatialProfile,
    components: [
      { heightM: marine?.waveHeightM, directionDeg: marine?.waveDirectionDeg },
      { heightM: marine?.swellWaveHeightM, directionDeg: marine?.swellWaveDirectionDeg },
    ],
  });
  const geometricCeiling = resolveGeometricWaveCeiling({
    profile: options?.geospatialProfile,
    windSpeedKmh: windSpeedKmph,
    gustKmph,
    suspectPin: windAssessment.windProfile.suspectPin,
    arrivingSwellPresent,
  });
  // One function, called by the beach page and by scripts/validateEffectiveRanking.ts.
  // The validator measures THIS code, not a copy of it — see utils/waveModel.ts.
  const { effectiveWaveHeightM, modeledWaveHeightM, realisticMeasuredWaveHeightM, geometricCeilingApplied } = resolveDisplayWaveHeightM({
    exposureLevel: finalExposureLevel,
    modeledWaveHeightM: windAssessment.modeledWaveHeightM,
    beaufort: baseBeaufort,
    windSpeedKmh: windSpeedKmph,
    gustKmph,
    meanSpeedBeforeGustFloorKmh: rawMeanWindKmphForSpread,
    measuredWaveHeightM,
    swell: { heightM: marine?.swellWaveHeightM, periodS: marine?.swellWavePeriodS },
    seaArrival,
    geometricCeilingM: geometricCeiling?.ceilingM,
  });
  const waveRaisedByWind = measuredWaveHeightM !== undefined && effectiveWaveHeightM > measuredWaveHeightM + 0.05;

  // ── The single decision-grade sea state ───────────────────────────────────────────────
  // `waveHeightM` on the returned score is DISPLAY-ONLY by doctrine (the cove guard rewrites it),
  // yet three consumers were reading it to make decisions. This is the value they should read:
  // the one every score, cap and comfort call in this function already uses.
  const seaStatePeriodS = typeof marine?.wavePeriodS === 'number' && Number.isFinite(marine.wavePeriodS)
    ? marine.wavePeriodS
    : typeof marine?.swellWavePeriodS === 'number' && Number.isFinite(marine.swellWavePeriodS)
      ? marine.swellWavePeriodS
      : undefined;

  /**
   * ⬆️ ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ ΥΠΟΛΟΓΙΖΕΤΑΙ ΕΔΩ, ΠΡΙΝ ΑΠΟ ΚΑΘΕ ΕΡΩΤΗΣΗ ΠΟΥ ΤΟ ΧΡΕΙΑΖΕΤΑΙ (22/08/2026).
   *
   * ΓΙΑΤΙ ΜΕΤΑΚΙΝΗΘΗΚΕ. Αυτό το μπλοκ ζούσε ~500 γραμμές παρακάτω, και ήταν ΑΥΤΟ ο λόγος που το
   * ίδιο λάθος ξαναγράφτηκε τέσσερις φορές: όποια ερώτηση για «πόσο νερό έχει εδώ» έτυχε να
   * γράφεται νωρίτερα στη συνάρτηση, ΔΕΝ ΕΙΧΕ άλλη επιλογή από το `effectiveWaveHeightM` — τη
   * θάλασσα διάμεσα 10 χλμ ανοιχτά. Δεν ήταν κρίση κανενός· ήταν η σειρά των γραμμών.
   *
   * Τα κείμενα και οι προειδοποιήσεις κύματος (§3 παρακάτω) είναι το ζωντανό παράδειγμα: η κάρτα
   * τύπωνε «~0,4 μ.» και από κάτω «Some wave risk (0.9 m)» με προειδοποίηση φουρτούνας, επειδή
   * γράφονταν 500 γραμμές πριν υπάρξει ο αριθμός της ακτής.
   *
   * ΤΙ ΔΕΝ ΑΛΛΑΞΕ Η ΜΕΤΑΚΙΝΗΣΗ: τίποτα. Καμία εξάρτηση δεν ξαναγράφεται ανάμεσα στις δύο θέσεις
   * (ελέγχθηκε) και η μετακίνηση αποδείχθηκε ΑΔΡΑΝΗΣ με εθνική σύγκριση όλων των πεδίων εξόδου
   * πριν αλλάξει έστω ένας αναγνώστης — βίβλος §Γ58.
   *
   * ⚠️ ΜΗΝ ΤΟ ΞΑΝΑΚΑΤΕΒΑΣΕΙΣ. Αν χρειαστεί να μετακινηθεί, πρέπει να μείνει ΠΑΝΩ από την πρώτη
   * ερώτηση που ρωτάει για το νερό της παραλίας — δηλαδή πάνω από τη «§3 Wave, fetch, and
   * water-quality conditions».
   */
  const coveWave = resolveCoveAwareWaveHeightM({
    geospatialProfile: options?.geospatialProfile,
    facingDeg: windAssessment.facingDeg,
    windDirectionDeg: weather.wind.deg,
    windSpeedKmh: windSpeedKmph,
    measuredWaveHeightM: realisticMeasuredWaveHeightM,
    appModeledWaveHeightM: modeledWaveHeightM,
    swellPresent: swell.hasSwell,
  });
  /**
   * ΤΟ ΝΕΡΟ ΠΟΥ ΔΕΙΧΝΕΙ Η ΣΕΛΙΔΑ ΤΗΣ ΠΑΡΑΛΙΑΣ ΤΟ ΔΙΑΒΑΖΕΙ ΠΛΕΟΝ ΚΑΙ Η ΕΤΥΜΗΓΟΡΙΑ (10/08/2026).
   *
   * `utils/shoreWave` has modelled the height at the sand since 05/08 and the beach page prints it
   * («Κύμα στην ακτή ~0,2 μ.»), but it was declared display-only: the verdict kept reading the
   * open-water grid. On Σχινιάς that produced both sentences on ONE screen — «Κύμα στην ακτή
   * ~0,2 μ.» above «μην κολυμπήσεις», the second one computed from 1,22 m taken 9,4 km out in the
   * South Evoian Gulf, in water the same offshore wind pushes AWAY from the beach.
   *
   * Reported by Miltos, 10/08/2026: «ο Σχινιάς έχει 24 km/h, γιατί δεν τον βάζεις στις τοπ;».
   *
   * This is a narrower claim than the blanket 0,5 damping the shore branch already used: that one
   * applies to every 'protected' shore, this one only speaks where the ray-caster measured a
   * land-blocked, essentially fetch-free sector, the wind has an OFFSHORE component (fully, below
   * onshore −0,80, where the estimate is exactly what it always was; blended with the open-water
   * reading between −0,80 and −0,50, where it fades to silence — see utils/shoreWave), the geometry is
   * high-confidence with no suspect pin, and there is NO swell (ground swell wraps into shores the
   * wind cannot reach — the one real false-calm route, closed by the gate itself). Where it does
   * speak it is the app's own SMB height over the fetch that was actually measured, capped at the
   * open-water reading, so it can never claim a calmer sea than the one outside.
   *
   * It feeds the SHORE branch only. The open-water branch, the score, the colour, the exposure
   * level and every gate keep reading effectiveWaveHeightM, and the one-step cap still stands —
   * so a genuinely running sea cannot travel from «μην κολυμπήσεις» to «καλή».
   */
  const shoreWaveInput: ShoreWaveInput = {
    openWaterWaveHeightM: effectiveWaveHeightM,
    windSpeedKmh: windSpeedKmph,
    sector: {
      fetchKm: coveWave.fetchKm,
      blockedRayRatio: coveWave.blockedRayRatio,
      onshore: coveWave.onshore,
    },
    confidence: options?.geospatialProfile?.confidence,
    suspectPin: windAssessment.windProfile.suspectPin,
    // Only a swell that can REACH this shore silences the estimate. `swell.exposed` is
    // utils/swellExposure's onshore test (component > 0,3 AND an open sector); a meaningful swell
    // whose direction we do not know counts as arriving, because there is no evidence it is not.
    // Computed once, next to the geometric ceiling that applies the identical test.
    arrivingSwellPresent,
    departingSea,
    // Η μετρημένη θάλασσα που ΕΡΧΕΤΑΙ σωπαίνει την εκτίμηση ακτής (21/08 — Σταλίδα). Μονόδρομη:
    // μόνο επαναφέρει το μετρημένο νούμερο, ποτέ δεν κατεβάζει κάποιο.
    arrivingSea,
    // «Δεν υπάρχει νερό προς τα εκεί» — ο ζωντανός τομέας ΚΑΙ ολόκληρο το ημικύκλιο του ανέμου.
    // Ο έλεγχος γείτονα χρειάζεται τους 8 ωμούς τομείς, που η παρεμβολή δεν κουβαλάει, γι' αυτό
    // περνάει εδώ το ίδιο το προφίλ (βίβλος §Γ21).
    enclosedDrySector: isEnclosedDrySector(
      { fetchKm: coveWave.fetchKm, blockedRayRatio: coveWave.blockedRayRatio },
      options?.geospatialProfile,
      weather.wind.deg
    ),
    // Η βεντάλια διασποράς (§Γ22): στον ξηρό τομέα, το μοντελοποιημένο ύψος γίνεται το ολοκλήρωμα
    // cos²ˢ × SMB πάνω στους 8 τομείς — ο κλειστός όρμος δίνει το δάπεδο (ό,τι έδινε η §Γ21), ο
    // όρμος με στόμιο το κύμα του στομίου του αντί για γυμνό δάπεδο ή το νούμερο του πελάγους.
    dryFanWaveM: drySectorFanWaveHeightM({
      sector: { fetchKm: coveWave.fetchKm, blockedRayRatio: coveWave.blockedRayRatio },
      profile: options?.geospatialProfile,
      windDirectionDeg: weather.wind.deg,
      windSpeedKmh: windSpeedKmph,
    }),
  };
  const shoreModelWaveM = estimateShoreWaveHeightM(shoreWaveInput);
  /**
   * ΑΠΟ ΠΟΥ ΗΡΘΕ Ο ΑΡΙΘΜΟΣ ΤΗΣ ΑΚΤΗΣ — ΜΕΤΡΗΜΕΝΗ ΑΠΟΔΕΙΞΗ Η ΕΙΚΑΣΙΑ; (22/08/2026)
   *
   * Δεν είναι στολίδι για αναφορές: ο φράχτης της γραμμής ηρεμίας
   * (utils/beachConditionsReadout, 21/08) γράφτηκε γύρω από την ΑΒΑΘΜΟΝΟΜΗΤΗ έκπτωση ×0,5 της
   * προστατευμένης ακτής, και δεν είχε τρόπο να την ξεχωρίσει από μετρημένη απόδειξη ότι όλο το
   * νερό φεύγει (`isSeaDepartingShore`). Χωρίς αυτό το πεδίο η οθόνη δεν μπορεί να κάνει τη
   * διάκριση που η ίδια η βίβλος ζητάει.
   *
   * ΑΠΑΝΤΑΕΙ ΑΚΡΙΒΩΣ ΕΝΑ ΕΡΩΤΗΜΑ: «θα σιωπούσε η εκτίμηση ακτής χωρίς την απόδειξη;». Τρέχει την
   * ΙΔΙΑ συνάρτηση με το ίδιο ακριβώς input και μόνο το `departingSea` σβηστό — καμία αντιγραφή
   * λογικής, οπότε δεν μπορεί να ξεσυγχρονιστεί αν αλλάξουν οι πύλες της.
   */
  const shoreWaveFromDepartingSea = departingSea
    && typeof shoreModelWaveM === 'number'
    && estimateShoreWaveHeightM({ ...shoreWaveInput, departingSea: false }) === undefined;
  // ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΕΔΙΝΕ ΤΗΝ ΑΔΙΚΑΙΟΛΟΓΗΤΗ ΕΚΠΤΩΣΗ (διορθώθηκε 20/08/2026). Το `finalExposureLevel`
  // μπορεί να λέει 'protected' επειδή ΑΝΘΡΩΠΟΣ επιθεώρησε τον όρμο, χωρίς ο τομέας να έχει
  // περάσει το αυστηρό γεωμετρικό τεστ — και τότε η πινέζα στον χάρτη λέει 'partial'. Ο άνεμος
  // κρατάει την επιθεώρηση· η θάλασσα όχι, γιατί κανείς δεν επιθεώρησε το κύμα.
  const dampedShoreWaveM = shoreSeaStateM(effectiveWaveHeightM, finalExposureLevel, seaArrivalExposureLevel,
    windAssessment.protectionFromCuratedCoveOnly);
  // The lower of the two only when the modelled one is entitled to speak; otherwise exactly the
  // damping that has been in place since 01/08.
  const shoreWaveM = typeof shoreModelWaveM === 'number'
    ? Math.min(shoreModelWaveM, dampedShoreWaveM ?? shoreModelWaveM)
    : dampedShoreWaveM;

  /**
   * Ο ΜΑΡΤΥΡΑΣ ΤΟΥ ΦΡΕΝΟΥ ΤΟΥ §Γ59 (22/08/2026) — «πόσο νερό θα λέγαμε ΧΩΡΙΣ τη χαλάρωση της
   * λοξής θάλασσας». Πριν τις 22/08 η περίπτωση «περνάει ξυστά» ερχόταν εδώ ως `undefined`,
   * οπότε το να τη γυρίσουμε πίσω σε `undefined` δίνει ΑΚΡΙΒΩΣ τη χθεσινή συμπεριφορά — όχι μια
   * νέα, αυστηρότερη υπόθεση. Δεν τυπώνεται και δεν χρωματίζει τίποτα: το μόνο που κάνει είναι
   * να απαντήσει «θα έλεγες μην κολυμπήσεις;» παρακάτω.
   */
  const arrivalBeforeGrazingRelief = seaArrivalExposureLevel === SEA_ARRIVAL_GRAZING
    ? undefined
    : seaArrivalExposureLevel;
  const dampedShoreWaveWithoutGrazingReliefM = shoreSeaStateM(
    effectiveWaveHeightM, finalExposureLevel, arrivalBeforeGrazingRelief,
    windAssessment.protectionFromCuratedCoveOnly);
  const shoreWaveWithoutGrazingReliefM = typeof shoreModelWaveM === 'number'
    ? Math.min(shoreModelWaveM, dampedShoreWaveWithoutGrazingReliefM ?? shoreModelWaveM)
    : dampedShoreWaveWithoutGrazingReliefM;
  const grazingSeaReliefApplied = shoreWaveWithoutGrazingReliefM !== shoreWaveM;

  /**
   * ΤΟ ΝΕΡΟ ΣΤΗΝ ΠΑΡΑΛΙΑ — Ο ΕΝΑΣ ΑΡΙΘΜΟΣ ΓΙΑ ΚΑΘΕ ΕΡΩΤΗΣΗ «ΠΟΣΟ ΚΥΜΑ ΕΧΕΙ ΕΔΩ» (22/08/2026).
   *
   * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ, ΜΕ ΝΟΥΜΕΡΑ. Μέσα σε αυτό το αρχείο υπάρχουν ~24 πραγματικές χρήσεις
   * του `effectiveWaveHeightM`. Κάποιες είναι ΣΩΣΤΕΣ — το ίδιο το μοντέλο, το γεωμετρικό ταβάνι,
   * η ένδειξη «ανοιχτά», η σοβαρότητα που πάει στο `resolveConditionTone` (που εφαρμόζει το
   * `shoreSeaStateM` μόνο του, παρακάτω). Κάποιες ήταν ΛΑΘΟΣ. Κανένας κανόνας δεν έλεγε ποια
   * είναι ποια, οπότε κάθε νέο σημείο διάλεγε μόνο του — και τέσσερις φορές διάλεξε λάθος:
   *
   *   05/08 Σχινιάς · 10/08 Ωρωπός · 13/08 Καβαλικευτά · 22/08 Ελαφονήσι (τρία σημεία σε μία μέρα)
   *
   * Ο ΚΑΝΟΝΑΣ, ΓΡΑΜΜΕΝΟΣ ΜΙΑ ΦΟΡΑ:
   *
   *   • Ρωτάς «τι κάνει η ΘΑΛΑΣΣΑ σε αυτή την περιοχή;»  → `effectiveWaveHeightM`
   *     (το μοντέλο, το ταβάνι, η ένδειξη «ανοιχτά», ό,τι δαμπάρει μόνο του παρακάτω)
   *   • Ρωτάς «τι θα βρει ο κόσμος ΣΕ ΑΥΤΗ ΤΗΝ ΠΑΡΑΛΙΑ;» → `seaAtShoreM`
   *     (κείμενα, προειδοποιήσεις, ετυμηγορία, βαθμοί που περιγράφουν την εμπειρία)
   *
   * Πέφτει πίσω στο ανοιχτό όταν δεν έχουμε αριθμό ακτής, οπότε καμία παραλία δεν μένει χωρίς
   * απάντηση και καμία δεν γίνεται ηρεμότερη επειδή λείπουν δεδομένα.
   *
   * ⚠️ ΑΝ ΠΡΟΣΘΕΣΕΙΣ ΝΕΑ ΕΡΩΤΗΣΗ ΓΙΑ ΤΟ ΝΕΡΟ, ΔΙΑΛΕΞΕ ΑΠΟ ΤΑ ΔΥΟ ΠΑΡΑΠΑΝΩ — μην πάρεις ό,τι
   * τυχαίνει να είναι σε εμβέλεια. Η πύλη scripts/validateWaterQuestionRouting.mjs μετράει πόσα
   * σημεία ρωτάνε το καθένα και σκάει αν εμφανιστεί καινούργιο χωρίς να δηλωθεί.
   */
  const seaAtShoreM = typeof shoreWaveM === 'number' && Number.isFinite(shoreWaveM)
    ? shoreWaveM
    : effectiveWaveHeightM;

  /**
   * ΤΟ ΝΕΡΟ ΠΟΥ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΣΒΗΣΕΙ ΠΡΟΕΙΔΟΠΟΙΗΣΗ — ΑΥΣΤΗΡΟΤΕΡΟ ΑΠΟ ΤΟ ΠΑΡΑΠΑΝΩ.
   *
   * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΓΡΑΦΤΕΙ, ΚΑΙ Η ΠΡΩΤΗ ΕΚΔΟΧΗ ΗΤΑΝ ΛΑΘΟΣ. Δίνοντας το `seaAtShoreM` κατευθείαν
   * στην προειδοποίηση φουρτούνας, έφευγαν 17 προειδοποιήσεις εθνικά — και οι 10 από αυτές σε
   * παραλίες με ανοιχτή θάλασσα **1,2-1,64 μ.** και αριθμό ακτής κολλημένο στο δάπεδο 0,10 μ.
   * Εκεί ο αριθμός ακτής ΔΕΝ είναι μέτρηση: είναι η αβαθμονόμητη έκπτωση ×0,5 συν το μοντέλο
   * SMB (§7δ: «παραμένει αβαθμονόμητο και χωρίς κριτή»). Σβήνοντας την τελευταία επιφύλαξη με
   * βάση αβαθμονόμητο μοντέλο, ποντάρεις στην επικίνδυνη κατεύθυνση.
   *
   * ΚΑΙ ΘΑ ΕΣΠΑΖΕ ΤΗ ΣΥΝΟΧΗ ΤΗΣ ΚΑΡΤΑΣ: σε αυτές ακριβώς τις παραλίες ο φράχτης της γραμμής
   * ηρεμίας (§Γ56) ανεβάζει ούτως ή άλλως το τυπωμένο νούμερο πίσω στο 0,8 — οπότε η κάρτα θα
   * έδειχνε «0,8 μ.» ΧΩΡΙΣ προειδοποίηση. Χειρότερο από πριν, όχι καλύτερο.
   *
   * Άρα η προειδοποίηση σωπαίνει με το ΙΔΙΟ κλειδί που ξεκλειδώνει και ο φράχτης: μετρημένη
   * απόδειξη ότι όλο το νερό φεύγει. Ένα κλειδί για τις δύο πιο επικίνδυνες σιωπές.
   */
  const seaForCautionM = shoreWaveFromDepartingSea && shoreWaveM === shoreModelWaveM
    ? seaAtShoreM
    : effectiveWaveHeightM;
  const seaStateSource: SeaStateSource = measuredWaveHeightM === undefined
    ? 'modeled'
    : effectiveWaveHeightM > (realisticMeasuredWaveHeightM ?? 0) + 0.005
      ? 'modeled'
      : realisticMeasuredWaveHeightM! < measuredWaveHeightM - 0.005
        ? 'measured-capped'
        : 'measured';

  // Long-period swell surge (roadmap #2): prefer the swell channel, else the wave
  // channel; period-gated so it is a strict no-op on short wind-sea.
  const swellPeriodS = typeof marine?.swellWavePeriodS === 'number' && Number.isFinite(marine.swellWavePeriodS) ? marine.swellWavePeriodS : undefined;
  const surgePeriodS = swellPeriodS ?? (typeof marine?.wavePeriodS === 'number' && Number.isFinite(marine.wavePeriodS) ? marine.wavePeriodS : undefined);
  const surgeUsesSwellChannel = swellPeriodS !== undefined;
  const surgeHeightM = surgeUsesSwellChannel ? marine?.swellWaveHeightM : marine?.waveHeightM;
  const swellSurgePenalty = computeSwellSurgePenalty(surgePeriodS, surgeHeightM);

  if (windSpeedKmph >= 30) {
    warnings.push({
      type: 'strong_wind',
      severity: windSpeedKmph >= 40 ? 'critical' : 'warning',
      message: `Strong wind forecast (${Math.round(windSpeedKmph)} km/h).`
    });
  }
  if (
    typeof gustKmph === 'number' &&
    baseBeaufort >= GUST_MIN_BASE_BEAUFORT &&
    (gustKmph >= GUST_NOTE_ABS_KMH || (gustSpreadKmph || 0) >= GUST_NOTE_SPREAD_KMH)
  ) {
    warnings.push({
      type: 'gusty_wind',
      severity: gustKmph >= GUST_WARN_ABS_KMH || (gustSpreadKmph || 0) >= GUST_WARN_SPREAD_KMH ? 'warning' : 'info',
      message: `Gusts may reach ${Math.round(gustKmph)} km/h.`,
      values: { gustKmph: Math.round(gustKmph) }
    });
    reasons.push('Gusty wind affects beach comfort');
  }

  if (windAssessment.canClaimProtected && baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    reasons.push(windSpeedKmph > 15 ? `Better sheltered from ${windDir} wind` : 'Better wind shelter');
  } else if (baseBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    reasons.push('Wind should not be a major issue today');
  } else if (finalExposureLevel === 'exposed' && windSpeedKmph > 15) {
    reasons.push('More exposed to wind');
  } else if (windSpeedKmph < 10) {
    reasons.push('Gentle breeze');
  } else if (windSpeedKmph <= 20) {
    reasons.push('Moderate breeze');
  } else if (windSpeedKmph <= 30) {
    reasons.push('Windy conditions');
  } else {
    reasons.push('Strong winds');
  }
  if (baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT && finalExposureLevel === 'exposed' && windSpeedKmph > 15) {
    warnings.push({
      type: 'exposed_to_wind',
      severity: windSpeedKmph > 25 ? 'warning' : 'info',
      message: 'This beach is more open to the selected day wind.'
    });
  }
  const comfortBeaufortInput = baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
    ? Math.max(baseBeaufort, windAssessment.effectiveBeaufort)
    : baseBeaufort;
  const effectiveBeaufort = getEffectiveBeaufortForComfort(
    comfortBeaufortInput,
    gustSpreadKmph,
    finalExposureLevel,
    effectiveWaveHeightM
  );
  const highFetchOnshore = fetchExposure === 'high' && finalExposureLevel === 'exposed';
  const mediumFetchOnshore = fetchExposure === 'medium' && finalExposureLevel === 'exposed';

  // 3. Wave, fetch, and water-quality conditions
  if (measuredWaveHeightM !== undefined) {
    if (waveRaisedByWind) {
      reasons.push('Wind and gusts can add chop beyond the marine grid');
    }
    if (!waveRaisedByWind && measuredWaveHeightM <= 0.4 && finalExposureLevel === 'protected') {
      reasons.push("Low measured wave height");
    // ΤΟ ΚΕΙΜΕΝΟ ΚΑΙ Η ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΠΕΡΙΓΡΑΦΟΥΝ ΤΗΝ ΠΑΡΑΛΙΑ, ΟΧΙ ΤΟ ΠΕΛΑΓΟΣ (22/08/2026).
    // Διάβαζαν `effectiveWaveHeightM` επειδή έτρεχαν ~500 γραμμές ΠΡΙΝ υπάρξει ο αριθμός της
    // ακτής — όχι από κρίση. Αποτέλεσμα: η κάρτα τύπωνε «~0,4 μ.» και από κάτω «Some wave risk
    // (0.9 m)» με προειδοποίηση φουρτούνας, για το ίδιο νερό, στην ίδια οθόνη (Ελαφονήσι).
    } else if (seaForCautionM >= 1.2) {
      reasons.push(`High wave forecast (${seaForCautionM.toFixed(1)} m)`);
      warnings.push({
        type: 'rough_sea',
        severity: seaForCautionM >= 1.5 ? 'critical' : 'warning',
        message: `Wave forecast is ${seaForCautionM.toFixed(1)} m.`
      });
    } else if (seaForCautionM >= 0.8) {
      reasons.push(finalExposureLevel === 'protected'
        ? `Protected from moderate wave forecast (${seaForCautionM.toFixed(1)} m)`
        : `Some wave risk (${seaForCautionM.toFixed(1)} m)`
      );
      if (finalExposureLevel !== 'protected') {
        warnings.push({
          type: 'rough_sea',
          severity: 'warning',
          message: `Some wave risk (${seaForCautionM.toFixed(1)} m).`
        });
      }
    } else if (finalExposureLevel === 'protected') {
      reasons.push("Calmer marine forecast");
    }
  } else {
    // Fallback when marine data is unavailable: use the modeled wave (clearly an
    // estimate, never presented as a measurement) plus wind/exposure context.
    if (modeledWaveHeightM >= 0.6) {
      warnings.push({
        type: 'rough_sea',
        severity: modeledWaveHeightM >= 1.0 ? 'warning' : 'info',
        message: `Estimated waves around ${modeledWaveHeightM.toFixed(1)} m from today's wind and fetch.`
      });
      reasons.push(`Wind and fetch suggest ~${modeledWaveHeightM.toFixed(1)} m waves`);
    } else if (windAssessment.canClaimProtected) {
      reasons.push('Wind-sheltered, but wave data is not verified');
    } else if (windSpeedKmph > 20) {
      reasons.push("Likely choppy waters");
    }
  }

  if (highFetchOnshore && effectiveBeaufort >= 4) {
    warnings.push({
      type: 'onshore_chop',
      severity: effectiveBeaufort >= 5 ? 'warning' : 'info',
      message: 'High open-water fetch may build chop on this beach.'
    });
    reasons.push('High fetch can build waves here');
  }

  if (finalExposureLevel === 'protected' && effectiveBeaufort >= 4) {
    warnings.push({
      type: 'offshore_wind',
      severity: effectiveBeaufort >= 5 ? 'warning' : 'info',
      message: 'Offshore wind can push swimmers or inflatables away from shore.'
    });
  }

  // Direct-swell exposure: background swell that arrives independently of the local wind.
  // R1 (v3 roadmap 2c.1): when a geospatial profile with a facing direction exists, decide
  // geometrically — the swell hits the beach only if it comes onshore (cos(swellDir-facing) > 0.3)
  // AND the sector facing the swell is open (blockedRayRatio < 0.6). A closed bay whose mouth
  // points away from the swell is NOT charged (removes a false-exposed). Falls back to the legacy
  // orientation-bucket rule when no profile/facing is available (unchanged behavior there).
  // Direct-swell geometry now lives in utils/swellExposure (single source of truth shared
  // with the UI swell-router); `exposed` is the same boolean this scoring used inline.
  // `swell` itself is computed further up, next to the geometric wave ceiling that consumes it.
  const directSwell = swell.exposed;
  if (directSwell) {
    const swellHeightM = marine?.swellWaveHeightM ?? 0;
    warnings.push({
      type: 'direct_swell',
      severity: swellHeightM >= 0.9 ? 'warning' : 'info',
      message: `Swell direction may send waves into this beach${swellHeightM >= 0.5 ? ` (~${swellHeightM.toFixed(1)} m swell)` : ''}.`,
      // Ίδιο κατώφλι με το αγγλικό μήνυμα: κάτω από 0,5 μ. δεν λέμε νούμερο, γιατί το νούμερο
      // θα ήταν πιο σίγουρο απ᾽ όσο είμαστε.
      values: swellHeightM >= 0.5 ? { swellHeightM: Number(swellHeightM.toFixed(1)) } : undefined
    });
    reasons.push('Direct swell exposure');
  }

  /**
   * ΤΟ ΙΔΙΟ ΚΥΜΑ ΔΕΝ ΣΠΑΕΙ ΤΟ ΙΔΙΟ ΣΕ ΚΑΘΕ ΠΑΡΑΛΙΑ (13/08/2026 — Καβαλικευτά).
   *
   * A note, not a severity: it touches no colour, no score, no ranking and no swim verdict. See
   * utils/shoreBreak for why a 0,3 m sea is nothing on flat sand and a plunging break on a steep
   * pebble bank, and for the four gates that keep this quiet on the days it would be noise.
   */
  if (beachShoreBreaks(beach, seaArrivalExposureLevel, effectiveWaveHeightM, seaStatePeriodS)) {
    warnings.push({
      type: 'shore_break',
      severity: 'info',
      message: 'Calm sea, but the water is deep and the shore is coarse, so the waves break a bit harder at the beach.',
    });
  }

  const hourlySea = calculateHourlySeaScore(beach, hourlyForecast, options?.geospatialProfile);
  if (typeof hourlySea.score === 'number' && hourlySea.checkedHours >= 3) {
    if (hourlySea.score >= 8) {
      reasons.push('Good key-hour conditions');
    } else if (hourlySea.score >= 6.5) {
      reasons.push('Usable key-hour conditions');
    } else if (hourlySea.score < 5) {
      reasons.push('Conditions may worsen during key hours');
      warnings.push({
        type: 'rough_sea',
        severity: hourlySea.poorHours >= 3 ? 'warning' : 'info',
        message: 'Some key beach hours may be less comfortable.',
      });
    } else {
      reasons.push('Mixed key-hour conditions');
    }
  }

  // Afternoon wind build (roadmap #4): the headline uses the ~13:00 sample, but the
  // meltemi peaks 14:00-18:00. When the afternoon climbs well above midday into a windy
  // state, escalate the per-beach comfort + warn. The MAP stays at the representative
  // hour by design (the hour slider already shows the afternoon).
  const afternoonItems = getKeyBeachHours(hourlyForecast).filter(item => {
    const h = new Date(item.dt * 1000).getHours();
    return h >= 13 && h <= 18;
  });
  const afternoonBuild = evaluateAfternoonBuild(
    afternoonItems.map(item => getBeaufortLevel(item.wind.speed * 3.6)),
    baseBeaufort
  );
  if (afternoonBuild.buildsRough) {
    const peakItem = afternoonItems.reduce((max, item) => (
      getBeaufortLevel(item.wind.speed * 3.6) > getBeaufortLevel(max.wind.speed * 3.6) ? item : max
    ));
    const peakHour = new Date(peakItem.dt * 1000).getHours();
    warnings.push({
      type: 'afternoon_wind_build',
      severity: afternoonBuild.peakBeaufort >= 5 ? 'warning' : 'info',
      message: `Calmer now, but wind builds to ${afternoonBuild.peakBeaufort} Beaufort by about ${peakHour}:00 — better as a morning visit.`,
      values: { peakBeaufort: afternoonBuild.peakBeaufort, peakHour },
    });
    reasons.push('Wind builds through the afternoon');
  }

  const hourlyRain = calculateHourlyRainRisk(hourlyForecast);
  if (hourlyRain.hasRainRisk) {
    const rainyWindowText = hourlyRain.rainyWindows.length > 0
      ? ` around ${hourlyRain.rainyWindows.slice(0, 4).join(', ')}`
      : '';
    warnings.push({
      type: 'rain_risk',
      severity: hourlyRain.allKeyHoursRainy ? 'critical' : 'warning',
      message: hourlyRain.allKeyHoursRainy
        ? 'Possible rain during the main beach hours, so beaches are not recommended for swimming.'
        : `Possible rain during some beach hours${rainyWindowText}; avoid those windows.`,
    });
    reasons.push(hourlyRain.allKeyHoursRainy
      ? 'Possible rain through the main beach hours'
      : 'Avoid rainy beach-hour windows');
  }

  const heavyRecentRain = typeof recentRainMm === 'number' && recentRainMm >= 8;
  const hasRunoffRisk = Boolean(
    beach.nearStreamOrDrain ||
    beach.nearPort ||
    beach.urbanRunoffRisk ||
    beach.metadata?.nearStreamOrDrain ||
    beach.metadata?.nearPort ||
    beach.metadata?.urbanRunoffRisk ||
    waterQualityRiskAfterRain === 'high'
  );
  if (heavyRecentRain && hasRunoffRisk) {
    warnings.push({
      type: 'water_quality_risk',
      severity: waterQualityRiskAfterRain === 'high' ? 'warning' : 'info',
      message: 'Recent rain may affect water clarity/quality near this area.'
    });
    reasons.push('Recent rain water-quality caution');
  } else if (heavyRecentRain && waterQualityRiskAfterRain === undefined) {
    warnings.push({
      type: 'rain_risk',
      severity: 'info',
      message: 'Recent rain data exists, but local runoff risk is not verified.'
    });
  }

  // 4. Temperature and practical comfort
  if (temp >= 22 && temp <= 32) {
    reasons.push("Perfect temperature");
  } else if (temp < 22) {
    if (22 - temp > 5) reasons.push("Cooler temperature");
  } else if (temp > 32) {
    if (temp - 32 > 3) reasons.push("Hot weather");
    // Τρία σκαλιά, μονόδρομα: κανένα τσιπάκι δεν χάνεται σε σχέση με πριν — το ≥38 απλώς
    // παύει να μοιάζει με συμβουλή άνεσης. Στους 38 °C η οδηγία δεν είναι «πήγαινε νωρίς»
    // αλλά «μην είσαι εκεί το μεσημέρι», και η κάρτα το βάφει κόκκινο αντί για γαλάζιο.
    // Το κατώφλι εμφάνισης (>32 °C) ΔΕΝ κουνήθηκε: το να ανέβει θέλει δική του μέτρηση.
    warnings.push({
      type: 'heat_uv',
      severity: temp >= 38 ? 'critical' : temp >= 36 ? 'warning' : 'info',
      message: 'Prefer morning or late afternoon in the heat.'
    });
  }

  // 5. Distance score (personalized/explore only)
  let distanceScore = 70;
  if (userLocation) {
    const dist = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      beach.coordinates.lat,
      beach.coordinates.lon
    );

    if (dist < 5) {
      distanceScore = 100;
      reasons.push("Very close to you");
    } else if (dist < 15) {
      distanceScore = 88;
      reasons.push("Short drive");
    } else if (dist < 50) {
      distanceScore = 65;
    } else if (dist > 50) {
      distanceScore = 35;
    }
  }

  // 6. Separated swimming, experience, and preference scores.
  let seaScore = calculateSeaConditionScore(
    finalExposureLevel !== 'protected',
    windSpeedKmph,
    finalExposureLevel,
    effectiveWaveHeightM,
    directSwell,
    seaStatePeriodS
  );
  // Light-wind floor: on a calm day an open beach must not be marked down merely for being open.
  // It reads the swell-equivalent height, not the raw one — otherwise it would lift a steep
  // 0.45 m 2.5 s sea straight back up to "fine", which is the Σχινιάς failure re-entering
  // through the back door one line after being fixed.
  // «Λίγος αέρας και μικρή θάλασσα» — η θάλασσα που κρίνεται είναι αυτή που θα κολυμπήσει
  // κάποιος (22/08/2026). Η διόρθωση περιόδου (`seaStateSeverityM`) ΜΕΝΕΙ: είναι ο φραγμός που
  // εμποδίζει ένα κοντό απότομο κύμα 0,45 μ. να περάσει για ήρεμο — δες το σχόλιο από πάνω.
  if (
    baseBeaufort <= 3 &&
    (seaStateSeverityM(seaAtShoreM, seaStatePeriodS) ?? seaAtShoreM) <= 0.5
  ) {
    const lightWindFloor = finalExposureLevel === 'protected' ? 9 : finalExposureLevel === 'partial' ? 8 : 7;
    seaScore = Math.max(seaScore, lightWindFloor);
  }
  let swimmingScore = seaScore * 10;
  if (finalExposureLevel === 'protected') swimmingScore += baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ? 6 : 2;
  if (finalExposureLevel === 'exposed' && baseBeaufort >= 4) swimmingScore -= 12;
  if (effectiveBeaufort >= 4) swimmingScore -= (effectiveBeaufort - 3) * 7;
  if (typeof gustSpreadKmph === 'number' && baseBeaufort >= GUST_MIN_BASE_BEAUFORT) {
    if (gustSpreadKmph >= 35) swimmingScore -= finalExposureLevel === 'protected' ? 8 : 18;
    else if (gustSpreadKmph >= 22) swimmingScore -= finalExposureLevel === 'protected' ? 4 : 10;
    else if (gustSpreadKmph >= 14) swimmingScore -= finalExposureLevel === 'protected' ? 2 : 5;
  }
  if (highFetchOnshore && effectiveBeaufort >= 4) swimmingScore -= 25;
  else if (mediumFetchOnshore && effectiveBeaufort >= 4) swimmingScore -= 10;
  // R1 (v3 roadmap 2c.3): scale the direct-swell penalty with the swell height.
  const directSwellPenalty = directSwell ? ((marine?.swellWaveHeightM ?? 0) >= 0.9 ? 20 : 12) : 0;
  swimmingScore -= directSwellPenalty;
  // Wave penalty applies to the measured wave, or to the (damped) modeled wave
  // when none was reported — gentler for the estimate to avoid over-penalising.
  // Kept as a function of the height so the shore branch of the comfort verdict can re-charge
  // it against the shore-damped height instead of the open-water one (see `shoreView` in
  // swimmingComfortFromScore). Same ladder, same numbers, one place.
  const waveHeightPenalty = (heightM: number): number => (
    measuredWaveHeightM !== undefined
      ? (heightM > 1.2 ? 25 : heightM >= 0.9 ? 16 : heightM >= 0.6 ? 8 : 0)
      : (heightM > 1.2 ? 18 : heightM >= 0.9 ? 12 : heightM >= 0.6 ? 6 : 0)
  );
  const openWaterWavePenalty = waveHeightPenalty(
    measuredWaveHeightM !== undefined ? effectiveWaveHeightM : modeledWaveHeightM
  );
  swimmingScore -= openWaterWavePenalty;
  // Period surge, de-duped against direct_swell (max, never sum) so one long-period
  // onshore swell is charged once — on EITHER period channel: when the swell period is
  // missing and the surge falls back to the wave channel, it still describes the same
  // onshore energy the direct-swell penalty already charged. Writes the swim score + a
  // warning only — never the exposure level, effectiveWaveHeightM, effectiveBeaufort,
  // or the map colour.
  if (swellSurgePenalty > 0 && typeof surgePeriodS === 'number' && typeof surgeHeightM === 'number') {
    const marginalSurge = directSwell ? Math.max(0, swellSurgePenalty - directSwellPenalty) : swellSurgePenalty;
    if (marginalSurge > 0) swimmingScore -= marginalSurge;
    warnings.push({
      type: 'long_period_swell',
      severity: swellSurgePenalty >= SWELL_SURGE_PENALTY_MID ? 'warning' : 'info',
      message: `Long-period swell (~${Math.round(surgePeriodS)} s) breaks harder than its ${surgeHeightM.toFixed(1)} m height suggests — expect a dumping shorebreak.`,
      values: { swellPeriodS: Math.round(surgePeriodS), swellHeightM: Number(surgeHeightM.toFixed(1)) },
    });
    reasons.push('Long-period swell breaks hard');
  }
  swimmingScore += windAssessment.swimmingScoreModifier;
  // Roadmap #4: dock for a significant afternoon build so a calm-noon verdict cannot read
  // 'good' when the meltemi turns it rough by mid-afternoon (comfort-only; map unchanged).
  if (afternoonBuild.buildsRough) swimmingScore -= Math.min(20, 4 + afternoonBuild.buildBeaufort * 5);
  if (heavyRecentRain && hasRunoffRisk) {
    swimmingScore -= waterQualityRiskAfterRain === 'high' ? 16 : 8;
  }
  if (temp < 18) swimmingScore -= 15;
  else if (temp < 22) swimmingScore -= (22 - temp) * 2;

  // Ο βυθός και η είσοδος αρχίζουν να μετράνε όταν κουνάει ΕΚΕΙ ΠΟΥ ΠΑΤΑΕΙ ΤΟ ΠΑΙΔΙ — δηλαδή
  // στην ακτή, όχι στο πέλαγος (22/08/2026).
  if (isFamilyMode && (seaAtShoreM > 0.5 || effectiveBeaufort >= 4)) {
    if (seabedSlope === 'shallow_gradual') swimmingScore += 6;
    if (waterEntry === 'easy') swimmingScore += 5;
    if (seabedSlope === 'steep') {
      swimmingScore -= 12;
      reasons.push('Steeper entry is less family-friendly today');
    }
    if (waterEntry === 'difficult' || waterEntry === 'rocks_only') {
      swimmingScore -= 12;
      reasons.push('Water entry may be harder for families');
    }
  }
  if (officialWarningOverride) swimmingScore = 0;
  swimmingScore = clampScore(swimmingScore);

  const crowdInfo = calculateCrowdLevel(beach, weather, athensNow());
  let experienceScore = 65;
  if (finalExposureLevel === 'protected') experienceScore += baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ? 10 : 2;
  else if (finalExposureLevel === 'partial') experienceScore += baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT ? 4 : 1;
  else if (baseBeaufort >= 4) experienceScore -= 12;
  if (typeof gustSpreadKmph === 'number' && baseBeaufort >= GUST_MIN_BASE_BEAUFORT && gustSpreadKmph >= GUST_EFFECTIVE_BFT_SPREAD_KMH) experienceScore -= 8;
  if (temp >= 23 && temp <= 31) experienceScore += 10;
  else if (temp > 34) experienceScore -= 15;
  else if (temp > 32) experienceScore -= 8;
  else if (temp < 20) experienceScore -= 10;
  if (beach.amenities?.naturalShade || beach.metadata?.shade) experienceScore += 8;
  else if (temp >= 33) experienceScore -= 5;
  if (hasMainstreamFacilities(beach)) experienceScore += 10;
  if (beach.amenities?.parking) experienceScore += 5;
  if (beach.accessibility === Accessibility.EASY) experienceScore += 8;
  if (beach.accessibility === Accessibility.DIFFICULT) experienceScore -= 12;
  if (beach.accessibility === Accessibility.BOAT_ONLY) experienceScore -= 18;
  if (beach.environment?.familyFriendly) experienceScore += 5;
  experienceScore += windAssessment.experienceScoreModifier;
  if (crowdInfo.crowdLevel === 'high') experienceScore -= preferences?.quiet ? 15 : 7;
  else if (crowdInfo.crowdLevel === 'low') experienceScore += 5;
  if (swimmingScore < 50) experienceScore -= 10;
  experienceScore = clampScore(experienceScore);

  let preferenceBaseScore = 75;
  const hasPreferences = hasActivePreferences(preferences);
  if (hasPreferences && preferences) {
    let activeCount = 0;
    let matchCount = 0;
    const addMatch = (enabled: boolean, matches: boolean) => {
      if (!enabled) return;
      activeCount += 1;
      if (matches) matchCount += 1;
    };

    addMatch(Boolean(preferences.sandy), beach.beachType === 'sandy');
    addMatch(Boolean(preferences.pebbles), beach.beachType === 'pebbles');
    addMatch(Boolean(preferences.quiet), isQuietBeach(beach));
    addMatch(Boolean(preferences.beachBar), hasBeachBarAmenity(beach));
    addMatch(Boolean(preferences.familyFriendly), isFamilyFriendlyBeach(beach));
    addMatch(Boolean(preferences.snorkeling), isSnorkelingBeach(beach));
    addMatch(Boolean(preferences.easyAccess), hasTrulyEasyAccess(beach));
    addMatch(Boolean(preferences.deepWater), beach.characteristics.deepWaters);
    addMatch(Boolean(preferences.shallowWater), beach.characteristics.shallowWaters);
    addMatch(Boolean(preferences.surfing), beach.activities.surfing);
    addMatch(Boolean(preferences.parking), beach.amenities.parking);

    preferenceBaseScore = activeCount > 0 ? (matchCount / activeCount) * 100 : 75;

    if (preferences.sandy) {
      if (beach.beachType === 'sandy') reasons.push('Sandy beach match');
    }
    if (matchCount > 0) {
      reasons.push(`Matches your preferences`);
    }
  }
  const preferenceScore = clampScore(userLocation
    ? (preferenceBaseScore * 0.8) + (distanceScore * 0.2)
    : preferenceBaseScore);

  // If user preference is "quiet beach" and crowdLevel is high, make it explicit.
  if (preferences?.quiet && crowdInfo.crowdLevel === 'high') {
    reasons.push("Likely busy for the selected day (Quiet preference active)");
  } else if (preferences?.quiet && crowdInfo.crowdLevel === 'low') {
    reasons.push("Likely quiet for the selected day");
  }

  const bestBeachTime = calculateBestBeachTime(hourlyForecast || [], beach);

  const negativeFeedback = getNegativeFeedbackCount(beach.id);
  let feedbackPenalty = 0;
  if (negativeFeedback > 0) {
    feedbackPenalty = Math.min(15, negativeFeedback * 3);
    if (feedbackPenalty >= 9) {
      reasons.push("Recent users reported inaccurate conditions");
    }
  }

  const confidence = calculateRecommendationConfidence(
    beach,
    weather,
    warnings,
    { weatherSource, hourlyForecast },
    hourlySea.score,
    dataQualityReasons
  );

  let finalScore = hasPreferences || userLocation
    ? (swimmingScore * 0.55) + (experienceScore * 0.20) + (preferenceScore * 0.15) + (distanceScore * 0.10)
    : (swimmingScore * 0.65) + (experienceScore * 0.25) + (confidence.score * 0.10);

  if (confidence.level === 'low') {
    finalScore -= 6;
    warnings.push({
      type: 'low_confidence',
      severity: 'info',
      message: baseBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT
        ? 'Recommendation confidence is low; check local conditions before going.'
        : 'Recommendation confidence is lower because some local data still needs verification.',
    });
  }
  finalScore -= feedbackPenalty;
  if (typeof windAssessment.finalScoreCap === 'number') {
    finalScore = Math.min(finalScore, windAssessment.finalScoreCap);
  }

  /**
   * Η ετυμηγορία για ΕΝΑ δεδομένο ύψος ακτής. Έγινε συνάρτηση στις 22/08/2026 ώστε το φρένο
   * του §Γ59 από κάτω να μπορεί να ρωτήσει την ΙΔΙΑ λογική για τον αντίθετο αριθμό, χωρίς
   * κανένα αντίγραφο που θα μπορούσε να ξεσυγχρονιστεί.
   */
  const comfortForShoreHeight = (shoreHeightM: number | undefined): SwimmingComfort => swimmingComfortFromScore(
    swimmingScore,
    effectiveBeaufort,
    effectiveWaveHeightM,
    officialWarningOverride,
    shoreHeightM,
    typeof shoreHeightM === 'number'
      ? {
          // The same score and the same Beaufort, re-derived from the shore height. Only the two
          // terms the wave itself paid for move: the height penalty on the score and the ≥0,9 m
          // bump on the Beaufort. Wind, gusts, fetch, swell, rain and the afternoon build are all
          // charged exactly as they were — shelter has never bought relief from those and does
          // not now.
          swimmingScore: swimmingScore + openWaterWavePenalty - waveHeightPenalty(shoreHeightM),
          effectiveBeaufort: getEffectiveBeaufortForComfort(
            comfortBeaufortInput,
            gustSpreadKmph,
            finalExposureLevel,
            shoreHeightM
          ),
        }
      : undefined
  );

  let swimmingComfort = comfortForShoreHeight(shoreWaveM);

  /**
   * ΤΟ ΜΟΝΟΔΡΟΜΟ ΦΡΕΝΟ ΤΟΥ §Γ59 (22/08/2026) — Η ΛΟΞΗ ΘΑΛΑΣΣΑ ΡΙΧΝΕΙ ΑΡΙΘΜΟ, ΠΟΤΕ ΠΡΟΕΙΔΟΠΟΙΗΣΗ.
   *
   * Η έκπτωση «η θάλασσα περνάει ξυστά» (utils/waveCharacter.shoreSeaStateM) κόβει το ύψος στο
   * μισό. Η κλίμακα άνεσης επιτρέπει στην ακτή να ανεβάσει την ετυμηγορία ΕΝΑ σκαλί — και ένα
   * σκαλί πάνω από το «μην κολυμπήσεις» είναι το «πρόσεχε». Δηλαδή, χωρίς φρένο, μια γεωμετρική
   * εικασία θα μπορούσε να σβήσει την πιο βαριά λέξη που λέμε.
   *
   * Η μέτρηση της ίδιας μέρας βρήκε 0 τέτοιες περιπτώσεις σε 40.180 βαθμολογήσεις — αλλά σε
   * ήρεμη μέρα. Σε μελτέμι η ίδια έκπτωση κουνάει το τυπωμένο νούμερο ως και 1,40 μ. (§Γ47),
   * οπότε το φρένο μπαίνει πριν χρειαστεί, όχι αφού.
   *
   * Τρέχει την ΙΔΙΑ `comfortForShoreHeight` με το ύψος που θα είχε η ακτή χωρίς την έκπτωση.
   * Μονόδρομο: μπορεί μόνο να επαναφέρει το 'avoid_swimming', ποτέ να το αφαιρέσει.
   */
  if (grazingSeaReliefApplied && swimmingComfort !== 'avoid_swimming'
    && comfortForShoreHeight(shoreWaveWithoutGrazingReliefM) === 'avoid_swimming') {
    swimmingComfort = 'avoid_swimming';
  }
  // Roadmap #4: a strong afternoon build never leaves a 'good'/'excellent' headline.
  if (afternoonBuild.buildsRough && (swimmingComfort === 'good' || swimmingComfort === 'excellent')) {
    swimmingComfort = 'caution';
  }
  /**
   * «ΜΗΝ ΚΟΛΥΜΠΗΣΕΙΣ» ΕΙΝΑΙ Η ΒΑΡΥΤΕΡΗ ΛΕΞΗ ΠΟΥ ΛΕΜΕ. ΣΤΑ 3 ΜΠΟΦΟΡ ΔΕΝ ΤΗ ΛΕΜΕ (10/08/2026).
   *
   * The verdict has three doors to 'avoid_swimming': 6 Bft, over 1,2 m of water, or a swim score
   * under 45. The first two are statements about the sea. The third is an ACCUMULATION — chop,
   * gusts, fetch, afternoon build, water quality, cold — and each of those penalties is defensible
   * on its own while the sum can land under 45 on a day nobody would call dangerous.
   *
   * Measured live, Ωρωπός Χαλκούτσι 10/08/2026 17:00: 18 km/h (3 Bft), 0,44 m of water, no swell,
   * no warning — and the page said «μην κολυμπήσεις», beside a YELLOW pin calling the same beach
   * «Καλή». Two more in the same region (Ακρωτηρίου, Αγίας Παρασκευής) read identically. That is
   * the over-caution the 05/08 finding warned about, arriving through the one door that is a sum
   * rather than a measurement.
   *
   * So below meaningful wind, with under 0,6 m of water, the accumulation may still say «πρόσεχε»
   * — it may not say «μην κολυμπήσεις». The two REAL doors are untouched: this cannot fire at
   * 4 Bft or above, cannot fire over 0,6 m, and stands aside for an official warning, for a
   * long-period swell (a 0,5 m ground swell dumps harder than its height) and for the rain rule
   * below, which is allowed to overwrite the verdict after this point.
   */
  const isLightWindSmallSea = relievesOverCaution({
    beaufort: baseBeaufort,
    /**
     * ΤΟ ΝΕΡΟ ΣΤΗΝ ΑΚΤΗ, ΟΧΙ ΤΟ ΠΕΛΑΓΟΣ (διορθώθηκε 22/08/2026 — βίβλος §Γ57).
     *
     * Μέχρι σήμερα εδώ περνούσε `effectiveWaveHeightM`, δηλαδή το κελί διάμεσα 10 χλμ ανοιχτά.
     * Ο μοναδικός φρουρός απέναντι στην υπερβολική αυστηρότητα ρωτούσε το ΙΔΙΟ νούμερο που
     * προκαλεί την υπερβολική αυστηρότητα, κι έτσι δεν άνοιγε ποτέ στις παραλίες για τις οποίες
     * γράφτηκε. Είναι το ίδιο ελάττωμα που το `swimmingComfortFromScore` καταγράφει από πάνω του
     * ως «THE SHORE BRANCH WAS DEAD ON ARRIVAL» — ένα σκαλί πιο κάτω, αδιάγνωστο για 12 μέρες.
     *
     * Παίρνει ΑΚΡΙΒΩΣ το `shoreWaveM` που διαβάζει ο κλάδος ακτής της ετυμηγορίας δύο γραμμές
     * πιο πάνω· χωρίς αυτό η ίδια συνάρτηση θα κρατούσε δύο διαφορετικές απαντήσεις στο
     * ερώτημα «πόσο νερό έχει εδώ».
     */
    seaAtShoreM,
    // Μόνο η ΜΕΤΡΗΜΕΝΗ απόδειξη ανεβάζει το ταβάνι ανέμου στα 4 Μποφόρ — όχι η γεωμετρική εικασία.
    departingSea: shoreWaveFromDepartingSea && shoreWaveM === shoreModelWaveM,
    officialWarning: officialWarningOverride,
    directSwell,
    swellSurgePenalty,
  });
  if (isLightWindSmallSea && swimmingComfort === 'avoid_swimming') {
    swimmingComfort = 'caution';
  }
  if (confidence.level === 'low' && swimmingComfort === 'excellent') {
    swimmingComfort = 'good';
  }
  /**
   * Το ίδιο σχήμα με τη γραμμή από πάνω, με άλλη πηγή: εκεί «δεν εμπιστευόμαστε τα δεδομένα
   * αυτής της παραλίας», εδώ «τα 51 σενάρια διαφωνούν για αυτή τη μέρα». Ένα σκαλί, μονόδρομος,
   * ποτέ σήμερα (το φιλτράρισμα ημέρας γίνεται στην πηγή — utils/forecastUncertainty).
   */
  if (forecastUncertain && swimmingComfort === 'excellent') {
    swimmingComfort = 'good';
  }
  if (swimmingComfort === 'avoid_swimming') {
    finalScore = officialWarningOverride ? 0 : Math.min(finalScore, 45);
  }
  if (hourlyRain.allKeyHoursRainy) {
    swimmingComfort = 'avoid_swimming';
    finalScore = 0;
  } else if (hourlyRain.hasRainRisk) {
    finalScore = Math.min(finalScore, 72);
    if (swimmingComfort === 'excellent') swimmingComfort = 'good';
  }

  const finalSuitabilityScore = clampScore(finalScore);

  // Display-only cove wave (the same guard the detail page ships), so a card and its
  // detail page can never disagree on the wave NUMBER: in a genuinely enclosed cove the
  // open-water grid cell over-reads the near-shore height, and the displayed value takes
  // the fetch-limited SMB estimate instead. Every score/level keeps reading
  // effectiveWaveHeightM — the guard remains display-only by doctrine.
  //
  // Resolved further up the function since 10/08/2026 (see `shoreModelWaveM`) because the swim
  // verdict now reads its sector geometry too. The computation is unchanged and depends on
  // nothing between the two positions.
  // Offshore extension: the guard's onshore gate exists because ANY beach's offshore
  // sectors read blocked/0-fetch while a real sea remains. A verified enclosed-cove
  // MORPHOLOGY (isEnclosedCoveGeometry) with no swell present is the stronger statement:
  // an OFFSHORE wind inside a closed cove leaves near-flat water the cove-blind grid
  // cannot see, so the SMB cap applies to the display there too. It never raises the
  // number and never fires while swell is present.
  //
  // OFFSHORE IS A CONDITION, NOT A DESCRIPTION. Written without the wind-direction gate,
  // this branch fired on every cove-shaped beach in ANY wind, including a wind blowing
  // straight down the mouth: measured 2026-07-29 over the national geometry at 5 Bft,
  // 694 beach x wind-direction cases where the page printed the fetch-limited SMB (as low
  // as 0.10 m) beside its own 'exposed' level and a 1.2 m sea state — Αγία Θεοδότη, Ίος
  // being the reported one (0.5 m shown, 1.28 m sea, wind dead into the bay). A cove mouth
  // taking the wind head-on is the one place this cap must NOT apply, so it is now gated on
  // the same onshore component the guard itself uses, mirrored: fire only when the live wind
  // is offshore or grazing. No facing → no claim (keep the honest larger number).
  //
  // THE FLOOR HERE IS THE APP'S OWN CHOP FLOOR, NOT A COSMETIC 0,10.
  //
  // An offshore wind over a 0-fetch sector gives SMB ~0,00, so this used to print exactly the
  // 0,10 m display floor: on Ίος at 5 Bft that was Αλμυρός, Κλήμα, Πέπα, Τρυπητή and both Τρεις
  // Κλησιές — six beaches reading "~0,1 μ." while the sea around the island ran at 1,28 m.
  // COVE_DISPLAY_FLOOR_M was only ever meant to stop a bare "0.00" from looking broken; used as
  // the floor of a real display value it invents flat calm, which is the one direction that can
  // put someone in water the app called flat. Reported 29/07/2026.
  //
  // `modeledWaveHeightM` is the honest floor: max(SMB x exposure damping, getWindChopWaveFloorM),
  // i.e. the chop the app already says you can feel in shelter at this Beaufort — 0,45 m for a
  // protected shore at 5 Bft. It is also already one of the two terms inside effectiveWaveHeightM,
  // so this branch still only ever LOWERS the number, never raises it.
  const coveDisplayCandidateM = Math.max(
    coveWave.smbWaveHeightM,
    modeledWaveHeightM,
    COVE_DISPLAY_FLOOR_M,
  );
  const windIsOffshoreForCove = typeof coveWave.onshore === 'number'
    && Number.isFinite(coveWave.onshore)
    && coveWave.onshore <= COVE_ONSHORE_MIN;
  // The SAME floor applies to the certified cove path. Its fetch-limited SMB is measured (34/43
  // rough-side + 60/60 calm-side dense re-scans) and it legitimately reads very low in a 50 m
  // pocket — but "~0,1 μ." on screen is not read as "a small sea", it is read as "flat", and the
  // app's own wind-chop model says a sheltered shore feels 0,45 m at 5 Bft. Two calibrated numbers
  // disagreed and the display took the lower one. It now takes the one that cannot be mistaken for
  // no waves at all; the cove still reads far calmer than the 1,28 m open sea, which is the whole
  // point of the guard.
  const coveDisplayM = Math.max(coveWave.waveHeightM, modeledWaveHeightM);
  const displayWaveHeightM = coveWave.coveApplied
    ? Math.min(coveDisplayM, effectiveWaveHeightM)
    : windAssessment.enclosedCove && windIsOffshoreForCove && !swell.hasSwell && coveDisplayCandidateM < effectiveWaveHeightM
      ? coveDisplayCandidateM
      : effectiveWaveHeightM;

  // The card/list chip states the same conditions as the map pin, from the same number.
  // The engine could only build a wind-only colour (the blended sea state does not exist yet
  // at that point), and for a long time nothing ever completed it — so the chip was green while
  // the pin beside it was amber on 38% of the condition grid, always in the optimistic
  // direction. `seaStateWaveM` + `seaStatePeriodS` is exactly what BeachMap feeds its own
  // ceiling (components/BeachMap.tsx passes seaStateSeverityM(item.seaStateWaveM,
  // item.seaStatePeriodS)), so the two now cannot describe different water.
  const glassWaterAtFour = holdsGlassWaterAtFourBeaufort({
    profile: options?.geospatialProfile,
    windDirectionDeg: weather.wind.deg,
    beaufort: windAssessment.simpleWindSuitability.windBeaufort,
    // The SAME severity the ceiling below reads, not the raw height: the door's own quiet-sea
    // clause and the ceiling must be talking about one number, or a beach could pass a test the
    // ceiling then contradicts.
    seaStateM: seaStateSeverityM(effectiveWaveHeightM, seaStatePeriodS),
    exposureLevel: windAssessment.exposureLevel,
    seaArrivalExposureLevel,
    // Καταγεγραμμένη προστασία απέναντι στον ΑΝΕΜΟ δεν αγοράζει έκπτωση στη ΘΑΛΑΣΣΑ. Σήμερα
    // αυτή η πόρτα ούτως ή άλλως δεν ανοίγει σε curated τομείς (θέλει ένταση ≤25, έχουν ≥33)·
    // περνάει για να μη γίνει σιωπηλή τρύπα αν χαλαρώσει ποτέ το ταβάνι έντασης.
    curatedWindOnlyProtection: windAssessment.protectionFromCuratedCoveOnly,
    swellWaveHeightM: marine?.swellWaveHeightM,
  });
  const simpleWindSuitability = applySeaStateToWindSuitability(
    windAssessment.simpleWindSuitability,
    seaStateSeverityM(effectiveWaveHeightM, seaStatePeriodS),
    windAssessment.enclosedCove,
    // Same profile, same live bearing, same swell reading the map pin's flag is built from —
    // the chip and the pin must not answer "is this sea reading downwind?" differently.
    hasDownwindSeaSample({
      profile: options?.geospatialProfile,
      windDirectionDeg: weather.wind.deg,
      swellWaveHeightM: marine?.swellWaveHeightM,
    }),
    // «Όταν λέει ΚΑΛΗ θέλω να μπορείς να κολυμπήσεις κιόλας» (Μίλτος, 10/08/2026). The chip and
    // the pin both take the ceiling; the verdict is already final at this point (rain rule
    // included), so no surface can print a calm colour over a refused swim.
    swimmingComfort === 'avoid_swimming',
    // The same value the pin gets off the score. Without it the chip would keep the ×0,5 shelter
    // discount the map has just stopped granting, and the two would disagree on the exact days
    // this rule exists for — an offshore wind with a sea still running in (Καβαλικευτά, 13/08).
    seaArrivalExposureLevel,
    // Μελιδόνι-class (18/08/2026): offshore wind over zero fetch at 4 Bft with the sea proven
    // quiet. Same profile, same live bearing, same severity the pin uses.
    glassWaterAtFour,
    // Ο όρμος επιθεωρήθηκε για τον ΑΝΕΜΟ, όχι για το ΚΥΜΑ (20/08/2026). Χωρίς αυτό το τσιπ
    // κρατούσε έκπτωση 50% στη θάλασσα ενώ η πινέζα δίπλα του δεν την έδινε — 24 παραλίες.
    windAssessment.protectionFromCuratedCoveOnly,
    // Τα σενάρια διαφωνούν για αυτή τη μέρα — το τσιπ και η πινέζα παίρνουν το ΙΔΙΟ φρένο.
    forecastUncertain,
  );

  return {
    beachId: beach.id,
    score: finalSuitabilityScore,
    swimmingScore,
    experienceScore,
    preferenceScore,
    finalSuitabilityScore,
    swimmingComfort,
    forecastConfidence: confidence.level,
    confidenceReasons: confidence.reasons,
    reasons: Array.from(new Set(reasons)).slice(0, 8),
    crowdLevel: crowdInfo.crowdLevel,
    crowdScore: crowdInfo.crowdScore,
    exposureLevel: finalExposureLevel,
    orientation: beachOrientation,
    marine,
    waveHeightM: displayWaveHeightM,
    // Η σημαία ταξιδεύει μαζί με το κύμα που αφορά. Είναι ήδη ψημένη στο προφίλ γεωμετρίας από
    // το scripts/auditMarineCellTrust.mjs· μέχρι τις 22/08/2026 καμία γραμμή παραγωγής δεν τη
    // διάβαζε, και το ίδιο το εργαλείο το σημείωνε.
    marineCellUntrusted: options?.geospatialProfile?.marineCellTrusted === false ? true : undefined,
    seaStateWaveM: effectiveWaveHeightM,
    seaStatePeriodS,
    shoreWaveHeightM: shoreModelWaveM,
    // Ο αριθμός που τυπώνεται πλέον παντού: το ίδιο `shoreWaveM` που ο κλάδος ακτής της
    // ετυμηγορίας διαβάζει δύο γραμμές πιο πάνω. Καμία δεύτερη μεταβλητή, κανένας δεύτερος
    // υπολογισμός — η οθόνη και η ετυμηγορία δεν μπορούν πια να διαφωνήσουν κατασκευαστικά.
    shoreDisplayWaveM: shoreWaveM,
    /**
     * Ο τυπωμένος αριθμός ακτής στηρίζεται σε ΜΕΤΡΗΜΕΝΗ απόδειξη ότι όλο το νερό φεύγει, όχι στην
     * αβαθμονόμητη έκπτωση ×0,5. Ταξιδεύει ως την κάρτα και την πινέζα ώστε ο φράχτης της γραμμής
     * ηρεμίας να μπορεί να ξεχωρίσει τα δύο (βίβλος §Γ55). Ισχύει μόνο όταν η εκτίμηση ακτής ΚΑΙ
     * κέρδισε τον τελικό αριθμό — αλλιώς αυτό που τυπώνεται δεν είναι το μετρημένο νούμερο.
     */
    shoreWaveFromDepartingSea: shoreWaveFromDepartingSea && shoreWaveM === shoreModelWaveM,
    // Ο αριθμός κατεβαίνει ήδη για κάθε παραλία μαζί με το κύμα (ίδια σημεία, ίδιο πακέτο) και
    // απλώς δεν έφτανε ποτέ στην κάρτα. Μηδέν επιπλέον κλήσεις. DISPLAY-ONLY (απόφαση Μίλτου Α).
    seaTemperatureC: weather.marine?.seaSurfaceTemperatureC,
    seaArrivalExposureLevel,
    // Ταξιδεύει ως την πινέζα: components/BeachMap το περνάει αυτούσιο στο resolveConditionTone,
    // όπως κάνει ήδη με το seaArrivalExposureLevel και το swimmingComfort.
    forecastUncertain,
    seaStateSource,
    modeledWaveHeightM,
    windSpeedKmph,
    warnings,
    confidence,
    weatherSource,
    hourlySeaScore: hourlySea.score,
    bestTimeWindow: bestBeachTime?.bestTimeWindow,
    avoidTimeWindow: bestBeachTime?.avoidTimeWindow,
    timeReason: bestBeachTime?.timeReason,
    windProfile: windAssessment.windProfile,
    windProfileSource: windAssessment.source,
    windSector: windAssessment.windSector,
    canClaimWindProtection: windAssessment.canClaimProtected,
    enclosedCove: windAssessment.enclosedCove,
    seaCalmClaimAllowed: windAssessment.seaCalmClaimAllowed,
    facingDeg: windAssessment.facingDeg,
    simpleWindSuitability,
  };
};

/**
 * Generates a simple, tourist-friendly explanation for the beach recommendation.
 */
export const generateBeachExplanation = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  score: number,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en',
  geospatialProfile?: GeospatialExposureProfile
): string => {
  return generateLocalizedBeachExplanation(beach, weather, score, userLocation, language, undefined, geospatialProfile);
};

const generateLocalizedBeachExplanation = (
  beach: Beach,
  weather: WeatherData | DailyForecast,
  score: number,
  userLocation?: { lat: number; lon: number },
  language: LanguageCode = 'en',
  recommendation?: Partial<BeachScore> & { bestBeachTime?: BestBeachTime },
  geospatialProfile?: GeospatialExposureProfile
): string => {
  if (!weather || !weather.wind) {
    return language === 'gr' ? 'Τα δεδομένα καιρού δεν είναι διαθέσιμα.' : 'Weather data unavailable.';
  }

  const windSpeedKmph = weather.wind.speed * 3.6;
  const windDir = degToCompass(weather.wind.deg);
  const temp = 'main' in weather && weather.main
    ? Math.round(weather.main.temp)
    : 'temp_max' in weather
      ? Math.round(weather.temp_max)
      : 25;

  const windBeaufort = getBeaufortLevel(windSpeedKmph);
  // Same geometry input as the scoring call: without it the re-derived level
  // can contradict the pin colour/score shown on the same page.
  const windAssessment = assessBeachWindExposure({
    beach,
    geospatialProfile,
    windDirectionDeg: weather.wind.deg,
    windDirection: windDir,
    windSpeedKmh: windSpeedKmph,
    beaufort: windBeaufort,
    waveHeightMeters: weather.marine?.waveHeightM,
    waveDirectionDegrees: weather.marine?.waveDirectionDeg,
    wavePeriodSeconds: weather.marine?.wavePeriodS,
    swellHeightMeters: weather.marine?.swellWaveHeightM,
    swellDirectionDegrees: weather.marine?.swellWaveDirectionDeg,
    seaSurfaceTemperature: weather.marine?.seaSurfaceTemperatureC,
  });
  const exposureLevel = recommendation?.exposureLevel || windAssessment.exposureLevel;
  const canClaimWindProtection = Boolean(recommendation?.canClaimWindProtection ?? windAssessment.canClaimProtected);
  const isProtectedForCopy = exposureLevel === 'protected' && canClaimWindProtection;
  const waveHeightM = recommendation?.waveHeightM ?? weather.marine?.waveHeightM;
  const seaScore = calculateSeaConditionScore(
    exposureLevel !== 'protected',
    windSpeedKmph,
    exposureLevel,
    recommendation?.seaStateWaveM ?? waveHeightM,
    false,
    recommendation?.seaStatePeriodS ?? weather.marine?.wavePeriodS
  );
  const beachName = displayBeachName(beach.name, language);
  const selectedDate = 'date' in weather ? weather.date : undefined;
  const day = getSelectedDayPrefix(selectedDate, athensNow(), language);
  // Future-day forecast: condition copy (wind/sea/temperature) must read as future
  // ("θα είναι" / "will be"), not present, when the user is not viewing today.
  const future = !isSelectedDateToday(selectedDate);
  const recommendationWarningTypes = new Set((recommendation?.warnings || []).map(warning => warning.type));
  const isCautionSwimDay = Boolean(
    windBeaufort >= 5 ||
    recommendation?.swimmingComfort === 'caution' ||
    (typeof waveHeightM === 'number' && waveHeightM >= 0.8)
  );
  const rainWarning = recommendation?.warnings?.find(warning => warning.type === 'rain_risk');
  let explanation = '';

  if (rainWarning?.severity === 'critical') {
    return language === 'gr'
      ? 'Λόγω πιθανής βροχής στις βασικές ώρες παραλίας, δεν προτείνεται καμία παραλία για μπάνιο σε αυτό το διάστημα.'
      : 'Because rain is possible during the main beach hours, no beach is recommended for swimming in that window.';
  }

  if (language === 'en' && recommendation) {
    const recommendationExposure = recommendation.exposureLevel || exposureLevel;
    const isProtectedToday = recommendationExposure === 'protected' && canClaimWindProtection;
    const isPartialToday = recommendationExposure === 'partial';
    const bestWindow = recommendation.bestTimeWindow || recommendation.bestBeachTime?.bestTimeWindow;
    const avoidWindow = recommendation.avoidTimeWindow || recommendation.bestBeachTime?.avoidTimeWindow;
    const warningTypes = new Set((recommendation.warnings || []).map(warning => warning.type));
    const confidence = recommendation.forecastConfidence || recommendation.confidence?.level;
    const cautiousLead = confidence === 'low'
      ? 'Based on limited forecast data, '
      : confidence === 'medium'
        ? 'Based on the available forecast, '
        : '';

    if (recommendation.swimmingComfort === 'avoid_swimming' || warningTypes.has('official_warning')) {
      const reason = recommendation.warnings?.find(warning => warning.type === 'official_warning')?.message || 'conditions are not suitable for swimming';
      return `Official warning or safety concern: ${reason} We do not recommend this beach for swimming ${day}.`;
    }

    if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      explanation = recommendation.windProfile?.knownWindSportSpot || recommendationExposure === 'exposed'
        ? `${cautiousLead}${beachName} is usually more exposed, but the wind ${future ? 'will be' : 'is'} light ${day}. Wind should not be a major issue ${day}.`
        : `${cautiousLead}${beachName} ${future ? 'should have' : 'has'} good conditions ${day}. Wind should not be a major issue, so choose mainly by access, beach type, facilities and vibe.`;
    } else if (warningTypes.has('wind_sport_spot')) {
      explanation = `${cautiousLead}${beachName} is a known wind/watersports spot and may be windy or choppy with ${windBeaufort} Beaufort ${day}. It is not a strong calm-swimming pick ${day}.`;
    } else if (isProtectedToday && windBeaufort >= 5) {
      const waveCopy = typeof waveHeightM === 'number' && Number.isFinite(waveHeightM)
        ? ` and waves around ${waveHeightM.toFixed(1)} m`
        : '';
      explanation = windBeaufort === 5
        ? `${cautiousLead}${beachName} is a better wind option.`
        : `${cautiousLead}${beachName} is a better available option than exposed beaches, but ${windBeaufort} Beaufort ${windDir} wind${waveCopy} make this a caution day for swimming.`;
    } else if (isProtectedToday && windBeaufort >= 4) {
      explanation = `${cautiousLead}${beachName} should be better sheltered from the ${windDir} wind than exposed alternatives, although conditions may still be breezy.`;
    } else if (isProtectedToday) {
      explanation = `${cautiousLead}${beachName} may feel more sheltered than open beaches ${day}.`;
    } else if (isPartialToday) {
      explanation = `${cautiousLead}${beachName} has partial shelter ${day}, so it may work if the wind stays manageable.`;
    } else {
      explanation = `${cautiousLead}${beachName} ${future ? 'will be' : 'is'} more exposed to the ${windDir} wind ${day}, so choose it only if some chop is acceptable.`;
    }

    if (warningTypes.has('onshore_chop')) {
      explanation += windBeaufort === 5
        ? ' Main sea factor: open-water fetch can build chop here.'
        : ' Main caution: open-water fetch can build choppy water here.';
    } else if (warningTypes.has('gusty_wind')) {
      explanation += windBeaufort === 5
        ? ' Main wind factor: gusts may make the beach feel windier than the average wind suggests.'
        : ' Main caution: gusts may make the beach feel windier than the average wind suggests.';
    } else if (warningTypes.has('rain_risk')) {
      explanation += ' Avoid the rainy windows; the recommendation only applies to the drier parts of the day.';
    } else if (warningTypes.has('water_quality_risk')) {
      explanation += ' Recent rain may affect water clarity or quality near this area.';
    } else if (recommendation.swimmingScore !== undefined && recommendation.swimmingScore >= 75) {
      explanation += windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT
        ? ' Main comfort factor: mild wind and manageable sea.'
        : ' Main comfort factor: lower swim chop and better shelter.';
    }

    if (bestWindow) {
      if (isCautionSwimDay) {
        explanation += windBeaufort === 5
          ? ` Most suitable window ${bestWindow}.`
          : ` Most suitable window ${bestWindow}, with caution.`;
      } else {
        explanation += ` Best ${bestWindow}.`;
      }
    }
    if (avoidWindow) {
      explanation += ` Avoid ${avoidWindow} if possible.`;
    }
    if (confidence === 'low' && windBeaufort >= MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      explanation += ' Check local sea conditions before committing.';
    } else if (confidence === 'low') {
      explanation += ' Local shelter data is still limited.';
    }

    return explanation;
  }

  if (language === 'gr') {
    const greekBeachSubject = `Η παραλία ${beachSentenceName(beachName, 'gr')}`;

    if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
      explanation = windAssessment.windProfile.knownWindSportSpot || exposureLevel === 'exposed'
        ? `${greekBeachSubject} είναι συνήθως πιο εκτεθειμένη, αλλά ${day} ο άνεμος ${future ? 'θα είναι' : 'είναι'} ήπιος. Ο άνεμος δεν φαίνεται να είναι βασικό θέμα ${day}.`
        : `${greekBeachSubject} ${future ? 'θα έχει' : 'έχει'} καλές συνθήκες ${day}. Ο άνεμος δεν φαίνεται να είναι βασικό θέμα ${day}.`;
    } else if (recommendationWarningTypes.has('wind_sport_spot')) {
      explanation = `${greekBeachSubject} είναι γνωστό σημείο για wind/watersports με ${windBeaufort} μποφόρ ${day}. Μπορεί να έχει αέρα ή κυματισμό, οπότε δεν είναι δυνατή επιλογή για ήρεμο μπάνιο ${day}.`;
    } else if (isProtectedForCopy) {
      explanation = windSpeedKmph > 20 || isCautionSwimDay
        ? (windBeaufort === 5
          ? `${greekBeachSubject} ${future ? 'θα είναι' : 'είναι'} πιο προστατευμένη επιλογή.`
          : `${greekBeachSubject} φαίνεται πιο κατάλληλη από ανοιχτές παραλίες ${day}, αλλά οι συνθήκες θέλουν προσοχή.`)
        : `${greekBeachSubject} φαίνεται πιθανόν πιο προστατευμένη από ανοιχτές παραλίες ${day}.`;
    } else {
      if (seaScore < 5) {
        explanation = windBeaufort === 5
          ? 'Εκτεθειμένη στον άνεμο.'
          : `${greekBeachSubject} φαίνεται πιο ανοιχτή στους ${greekWindDirectionsAccusative[windDir]} ανέμους ${day}, οπότε προτίμησέ την μόνο αν έχεις δει πρώτα τις συνθήκες.`;
      } else if (seaScore < 8) {
        explanation = `${greekBeachSubject} έχει λίγη έκθεση στους ${greekWindDirectionsAccusative[windDir]} ανέμους. Μπορεί να είναι καλή επιλογή όσο ο άνεμος μένει ήπιος, ειδικά αν δεν ψάχνεις απόλυτα ήρεμα νερά.`;
      } else {
        explanation = `${greekBeachSubject} φαίνεται να έχει ελαφρύ αεράκι ${day} και οι συνθήκες παραμένουν άνετες για επίσκεψη.`;
      }
    }

    if (recommendationWarningTypes.has('rain_risk')) {
      explanation += ' Απόφυγε τις ώρες με πιθανή βροχή· η πρόταση ισχύει μόνο για τα πιο στεγνά διαστήματα της ημέρας.';
    }

    if (temp >= 25 && temp <= 32) {
      explanation += ` Η θερμοκρασία ${future ? 'θα είναι' : 'είναι'} ${temp}°C, ιδανική για κολύμπι.`;
    } else if (temp > 32) {
      explanation += ` Ζεστή μέρα στους ${temp}°C, μην ξεχάσετε αντηλιακό.`;
    } else {
      explanation += ` Με θερμοκρασία ${temp}°C, είναι μια όμορφη μέρα δίπλα στη θάλασσα.`;
    }

    if (userLocation && score > 80) {
      const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
      if (dist < 10) explanation += ' Επίσης, είναι πολύ κοντά σας.';
    }

    return explanation;
  }

  if (language === 'de') {
    explanation = isProtectedForCopy
      ? `${beachName} ist heute eine gute Wahl, weil der Strand vor dem Wind geschützt ist.`
      : seaScore < 8
        ? `${beachName} ist heute wenig vor Wind geschützt. Es kann okay sein, solange der Wind schwach bleibt, ist aber keine sichere Wahl für ganz ruhiges Wasser.`
        : `${beachName} hat heute nur eine leichte Brise und bleibt angenehm für einen Strandbesuch.`;
    explanation += temp >= 25 && temp <= 32
      ? ` Die Temperatur liegt bei ${temp}°C, ideal zum Schwimmen.`
      : temp > 32
        ? ` Es ist heiss bei ${temp}°C, Sonnenschutz nicht vergessen.`
        : ` Mit ${temp}°C ist es eher frisch, aber die Meereslage kann trotzdem gut sein.`;
    return explanation;
  }

  if (language === 'it') {
    explanation = isProtectedForCopy
      ? `${beachName} e una buona scelta oggi perché e riparata dal vento.`
      : seaScore < 8
        ? `${beachName} e poco riparata dal vento oggi. Può andare bene se il vento resta leggero, ma non e la scelta più sicura per acqua calma.`
        : `${beachName} ha una brezza leggera oggi ed e piacevole per una visita.`;
    explanation += temp >= 25 && temp <= 32
      ? ` La temperatura e ${temp}°C, ideale per nuotare.`
      : temp > 32
        ? ` Giornata calda a ${temp}°C, porta la protezione solare.`
        : ` Con ${temp}°C fa fresco, ma il mare può comunque essere piacevole.`;
    return explanation;
  }

  if (language === 'fr') {
    explanation = isProtectedForCopy
      ? `${beachName} est un bon choix aujourd’hui car la plage est abritée du vent.`
      : seaScore < 8
        ? `${beachName} est peu abritée du vent aujourd’hui. Cela peut rester correct si le vent reste faible, mais ce n’est pas le choix le plus sur pour une eau calme.`
        : `${beachName} a seulement une legere brise aujourd’hui et reste agreable.`;
    explanation += temp >= 25 && temp <= 32
      ? ` La temperature est de ${temp}°C, ideale pour se baigner.`
      : temp > 32
        ? ` Il fait chaud avec ${temp}°C, prevoyez de la protection solaire.`
        : ` Avec ${temp}°C, l air est frais, mais les conditions de mer peuvent rester bonnes.`;
    return explanation;
  }

  if (windBeaufort < MEANINGFUL_WIND_TOP_PICK_BEAUFORT) {
    explanation = windAssessment.windProfile.knownWindSportSpot || exposureLevel === 'exposed'
      ? `${beachName} is usually more exposed, but the wind ${future ? 'will be' : 'is'} light ${day}. Wind should not be a major issue ${day}.`
      : `${beachName} ${future ? 'should have' : 'has'} good conditions ${day}. Wind should not be a major issue ${day}.`;
  } else if (recommendationWarningTypes.has('wind_sport_spot')) {
      explanation = `${beachName} is a known wind/watersports spot and may be windy or choppy with ${windBeaufort} Beaufort ${day}. It is not a strong calm-swimming pick ${day}.`;
  } else if (isProtectedForCopy) {
    explanation = windSpeedKmph > 20 || isCautionSwimDay
      ? (windBeaufort === 5
        ? `${beachName} is a better wind option.`
        : `${beachName} is a better available option than exposed beaches ${day}, but conditions still need caution.`)
      : `${beachName} may feel more sheltered than open beaches ${day}.`;
  } else {
    if (seaScore < 5) {
      explanation = windBeaufort === 5
        ? 'Exposed to wind.'
        : `${beachName} looks more open to the ${windDir} wind ${day}. If calm water matters, treat it as a caution option ${day}.`;
    } else if (seaScore < 8) {
      explanation = `${beachName} may feel breezy ${day}. It can still work if conditions stay manageable, but it is not the most reliable calm-water pick.`;
    } else {
      explanation = `${beachName} should have a gentle breeze ${day}, making it pleasant for a visit.`;
    }
  }

  if (temp >= 25 && temp <= 32) {
    explanation += ` The temperature ${future ? 'will be' : 'is'} ${temp}°C, perfect for swimming.`;
  } else if (temp > 32) {
    explanation += ` It's a hot day at ${temp}°C, so don't forget your sunscreen!`;
  } else {
    explanation += ` With a temperature of ${temp}°C, it's a lovely day to be by the sea.`;
  }

  if (userLocation && score > 80) {
    const dist = calculateDistance(userLocation.lat, userLocation.lon, beach.coordinates.lat, beach.coordinates.lon);
    if (dist < 10) explanation += " Plus, it's just a short drive from you.";
  }

  return explanation;
};

/**
 * Returns the top 3 recommended beaches sorted by suitability score with explanations.
 */
export const getTopRecommendedBeaches = (
  beaches: Beach[],
  weather: WeatherData | DailyForecast,
  userLocation?: { lat: number; lon: number },
  hourlyForecast?: ForecastItem[],
  preferences?: UserPreferences,
  language: LanguageCode = 'en',
  beachWeatherById?: BeachWeatherById,
  geospatialProfiles?: GeospatialExposureLookup
): BeachRecommendation[] => {
  const beachById = new Map(beaches.map(beach => [beach.id, beach]));
  const recommendations = beaches.map(beach => {
    const beachWeather = beachWeatherById?.[beach.id];
    const weatherForBeach = beachWeather || weather;
    const hourlyForBeach = beachWeather?.hourly || hourlyForecast || ('hourly' in weatherForBeach ? weatherForBeach.hourly : undefined);
    const scoreResult = calculateBeachScore(
      beach,
      weatherForBeach,
      userLocation,
      preferences,
      {
        weatherSource: beachWeather ? 'beach-cluster' : 'island-fallback',
        hourlyForecast: hourlyForBeach,
        geospatialProfile: geospatialProfiles?.[beach.id],
      }
    );
    const bestBeachTime = hourlyForBeach ? calculateBestBeachTime(hourlyForBeach, beach) : undefined;
    const explanation = generateLocalizedBeachExplanation(beach, weatherForBeach, scoreResult.score, userLocation, language, {
      ...scoreResult,
      bestBeachTime,
    }, geospatialProfiles?.[beach.id]);

    return {
      beachId: beach.id,
      score: scoreResult.score,
      swimmingScore: scoreResult.swimmingScore,
      experienceScore: scoreResult.experienceScore,
      preferenceScore: scoreResult.preferenceScore,
      finalSuitabilityScore: scoreResult.finalSuitabilityScore,
      swimmingComfort: scoreResult.swimmingComfort,
      forecastConfidence: scoreResult.forecastConfidence,
      confidenceReasons: scoreResult.confidenceReasons,
      explanation,
      bestBeachTime,
      bestTimeWindow: scoreResult.bestTimeWindow || bestBeachTime?.bestTimeWindow,
      avoidTimeWindow: scoreResult.avoidTimeWindow || bestBeachTime?.avoidTimeWindow,
      timeReason: scoreResult.timeReason || bestBeachTime?.timeReason,
      crowdLevel: scoreResult.crowdLevel,
      crowdScore: scoreResult.crowdScore,
      exposureLevel: scoreResult.exposureLevel,
      orientation: scoreResult.orientation,
      marine: scoreResult.marine,
      waveHeightM: scoreResult.waveHeightM,
      marineCellUntrusted: scoreResult.marineCellUntrusted,
      seaStateWaveM: scoreResult.seaStateWaveM,
      seaStatePeriodS: scoreResult.seaStatePeriodS,
      // ΧΩΡΙΣ ΑΥΤΟ Η ΚΑΡΤΑ ΕΛΕΓΕ ΑΛΛΟ ΚΥΜΑ ΑΠΟ ΤΗ ΣΕΛΙΔΑ (11/08/2026): το πεδίο υπήρχε στον τύπο
      // και στο scoreResult, αλλά αυτός ο builder δεν το αντέγραφε — άρα κάθε κάρτα που τρέφεται
      // από SuitableBeach (μαζί το podium του Top 3) έπεφτε στο ανοιχτό νερό, ενώ η σελίδα της
      // παραλίας τύπωνε το ύψος στην ακτή. Γαλάζια Ακτή: 0,3 μ. στην κάρτα, ~0,1 μ. μέσα.
      shoreWaveHeightM: scoreResult.shoreWaveHeightM,
      shoreDisplayWaveM: scoreResult.shoreDisplayWaveM,
      seaTemperatureC: scoreResult.seaTemperatureC,
      seaArrivalExposureLevel: scoreResult.seaArrivalExposureLevel,
      windSpeedKmph: scoreResult.windSpeedKmph,
      warnings: scoreResult.warnings,
      confidence: scoreResult.confidence,
      weatherSource: scoreResult.weatherSource,
      hourlySeaScore: scoreResult.hourlySeaScore,
      windProfile: scoreResult.windProfile,
      windProfileSource: scoreResult.windProfileSource,
      windSector: scoreResult.windSector,
      canClaimWindProtection: scoreResult.canClaimWindProtection,
      enclosedCove: scoreResult.enclosedCove,
      seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed,
      simpleWindSuitability: scoreResult.simpleWindSuitability
    };
  });

  const windSpeedKmh = weather.wind.speed * 3.6;
  const windBeaufort = getBeaufortLevel(windSpeedKmh);
  const windDirectionDeg = weather.wind.deg;
  const topPickCandidates = recommendations.filter(item => {
    if (!isTrustedTopRecommendationCandidate(item, beachById, windBeaufort)) return false;
    if (item.swimmingComfort === 'avoid_swimming') return false;
    if (item.warnings?.some(warning => warning.type === 'official_warning' && warning.severity === 'critical')) return false;
    if (typeof item.swimmingScore === 'number' && item.swimmingScore < 50) return false;
    // Tier 0: drop false-protected cross-shore caution picks from meaningful wind upward.
    if (isFalseProtectedTopPick(item, windDirectionDeg, windBeaufort)) return false;
    const isExposed = item.exposureLevel ? item.exposureLevel !== 'protected' : true;
    const itemSeaStateM = item.seaStateWaveM ?? item.waveHeightM;
    let seaScore = calculateSeaConditionScore(isExposed, windSpeedKmh, item.exposureLevel, itemSeaStateM, false, item.seaStatePeriodS);
    if (windBeaufort <= 3 && ((seaStateSeverityM(itemSeaStateM, item.seaStatePeriodS) ?? itemSeaStateM) ?? 0) <= 0.5) {
      const lightWindFloor = item.exposureLevel === 'protected' ? 9 : item.exposureLevel === 'partial' ? 8 : 7;
      seaScore = Math.max(seaScore, lightWindFloor);
    }
    return seaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE &&
      (typeof item.hourlySeaScore !== 'number' || item.hourlySeaScore >= MIN_TOP_PICK_SEA_CONDITION_SCORE);
  });
  const prioritizedRecommendations = prioritizeProtectedBeachRecommendations(topPickCandidates, beachById, windBeaufort);

  return prioritizedRecommendations.slice(0, getTopRecommendationDisplayLimit(prioritizedRecommendations.length));
};

/**
 * Filters beaches within a certain distance from the user.
 */
export const filterNearbyBeaches = (
  beaches: Beach[],
  userLocation: { lat: number; lon: number } | undefined,
  maxDistance: number = 150
): Beach[] => {
  if (!userLocation) return beaches;
  
  return beaches.filter(beach => {
    const distance = calculateDistance(
      userLocation.lat,
      userLocation.lon,
      beach.coordinates.lat,
      beach.coordinates.lon
    );
    return distance <= maxDistance;
  });
};

/**
 * Returns all suitable beaches (score >= 60) for Explore Mode.
 */
export const getSuitableBeaches = (
  beaches: Beach[],
  weather: WeatherData | DailyForecast,
  language: LanguageCode,
  userLocation?: { lat: number; lon: number },
  hourlyForecast?: ForecastItem[],
  preferences?: UserPreferences,
  beachWeatherById?: BeachWeatherById,
  geospatialProfiles?: GeospatialExposureLookup,
  // Optional per-beach scores already computed by the caller with the SAME
  // inputs this function would use (weatherForBeach, userLocation, preferences,
  // hourlyForBeach, geospatialProfile). When supplied we reuse them instead of
  // re-running calculateBeachScore, so the slider/map don't pay for the same
  // heavy scoring pass multiple times per change.
  precomputedScores?: Map<number, BeachScore>
): SuitableBeach[] => {
  const suitableBeaches: SuitableBeach[] = [];

  // Pre-filter beaches based on active hard-filter preferences.
  const preFiltered = filterBeachesByUserPreferences(beaches, preferences);

  preFiltered.forEach(beach => {
    const beachWeather = beachWeatherById?.[beach.id];
    const weatherForBeach = beachWeather || weather;
    const hourlyForBeach = beachWeather?.hourly || hourlyForecast || ('hourly' in weatherForBeach ? weatherForBeach.hourly : undefined);
    const geospatialProfile = geospatialProfiles?.[beach.id];
    const scoreResult = precomputedScores?.get(beach.id) ?? calculateBeachScore(
      beach,
      weatherForBeach,
      userLocation,
      preferences,
      {
        weatherSource: beachWeather ? 'beach-cluster' : 'island-fallback',
        hourlyForecast: hourlyForBeach,
        geospatialProfile,
      }
    );

    if (scoreResult.score >= 60 && scoreResult.swimmingComfort !== 'avoid_swimming') {
      const bestBeachTime = hourlyForBeach ? calculateBestBeachTime(hourlyForBeach, beach) : undefined;
      const explanation = generateLocalizedBeachExplanation(beach, weatherForBeach, scoreResult.score, userLocation, language, {
        ...scoreResult,
        bestBeachTime,
      }, geospatialProfile);
      
      let distance: number | undefined;
      if (userLocation) {
        distance = calculateDistance(
          userLocation.lat, 
          userLocation.lon, 
          beach.coordinates.lat, 
          beach.coordinates.lon
        );
      }

      const isExposed = scoreResult.exposureLevel ? scoreResult.exposureLevel !== 'protected' : true;
      const windExposureReason = describeWindExposure({
        exposureLevel: scoreResult.exposureLevel,
        windDirectionDeg: weatherForBeach.wind.deg,
        windBeaufort: getBeaufortLevel(weatherForBeach.wind.speed * 3.6),
        facingDeg: scoreResult.facingDeg,
        knownWindSportSpot: scoreResult.windProfile?.knownWindSportSpot,
        language,
      });
      const simpleWindReason = describeSimpleWindSuitability(scoreResult.simpleWindSuitability, language);

      suitableBeaches.push({
        beachId: beach.id,
        name: displayBeachName(beach.name, language),
        score: scoreResult.score,
        swimmingScore: scoreResult.swimmingScore,
        experienceScore: scoreResult.experienceScore,
        preferenceScore: scoreResult.preferenceScore,
        finalSuitabilityScore: scoreResult.finalSuitabilityScore,
        swimmingComfort: scoreResult.swimmingComfort,
        forecastConfidence: scoreResult.forecastConfidence,
        confidenceReasons: scoreResult.confidenceReasons,
        explanation,
        distance,
        beach: { ...beach, crowdLevel: scoreResult.crowdLevel, crowdScore: scoreResult.crowdScore },
        bestBeachTime,
        bestTimeWindow: scoreResult.bestTimeWindow || bestBeachTime?.bestTimeWindow,
        avoidTimeWindow: scoreResult.avoidTimeWindow || bestBeachTime?.avoidTimeWindow,
        timeReason: scoreResult.timeReason || bestBeachTime?.timeReason,
        isExposed,
        crowdLevel: scoreResult.crowdLevel,
        crowdScore: scoreResult.crowdScore,
        exposureLevel: scoreResult.exposureLevel,
        orientation: scoreResult.orientation,
        marine: scoreResult.marine,
        waveHeightM: scoreResult.waveHeightM,
        marineCellUntrusted: scoreResult.marineCellUntrusted,
        seaStateWaveM: scoreResult.seaStateWaveM,
        seaStatePeriodS: scoreResult.seaStatePeriodS,
        // Ίδιος λόγος με τον από πάνω builder — το ύψος στην ακτή ταξιδεύει μαζί με τα υπόλοιπα.
        shoreWaveHeightM: scoreResult.shoreWaveHeightM,
        shoreDisplayWaveM: scoreResult.shoreDisplayWaveM,
        seaTemperatureC: scoreResult.seaTemperatureC,
        seaArrivalExposureLevel: scoreResult.seaArrivalExposureLevel,
        windSpeedKmph: scoreResult.windSpeedKmph,
        warnings: scoreResult.warnings,
        confidence: scoreResult.confidence,
        weatherSource: scoreResult.weatherSource,
        hourlySeaScore: scoreResult.hourlySeaScore,
        windProfile: scoreResult.windProfile,
        windProfileSource: scoreResult.windProfileSource,
        windSector: scoreResult.windSector,
        canClaimWindProtection: scoreResult.canClaimWindProtection,
        enclosedCove: scoreResult.enclosedCove,
        seaCalmClaimAllowed: scoreResult.seaCalmClaimAllowed,
        simpleWindSuitability: scoreResult.simpleWindSuitability,
        geospatialExposure: geospatialProfile,
        meltemiExposure: summarizeLocalWindBehavior(geospatialProfile, beach, LOCAL_WIND_SECTORS[getRegionWindContext(beach.regionId ?? '')]),
        windExposureReason: simpleWindReason || windExposureReason
      });
    }
  });

  // Default sort follows wind bands: normal beach quality at 0-2 Bft,
  // shelter starts guiding top picks at 3-4 Bft, protected-first from 5+ Bft.
  const windBeaufort = getBeaufortLevel(weather.wind.speed * 3.6);
  suitableBeaches.sort((a, b) => compareRecommendationPriority(a, b, undefined, windBeaufort));

  return suitableBeaches;
};
