import type { ExposureLevel } from './windExposure';
import { SEA_STATE_AMBER_M, SEA_STATE_ROUGH_M, seaStateSeverityM } from './waveCharacter';

/**
 * ONE sea verdict for the whole beach page.
 *
 * The detail page used to carry three independent severity ladders, each built at a different
 * time against a different threshold, and they contradicted each other on screen:
 *
 *   surface                     amber starts at   period-corrected?
 *   TodayScoreBadge tier         0.80 m raw        no
 *   "weather now" chip (tone)    — wave only via the sea score, which FLOORS a
 *                                  sheltered beach at waveScore 6 whatever the sea does
 *   wave graphic + hourly strip  0.50 m raw        no
 *
 * Measured over the 3.168-combination condition grid before this module existed
 * (scripts/validateVerdictConsistency.mjs):
 *
 *   • 663 combinations (20,9%) printed "Calm right now" beside an amber or rough wave figure;
 *   • of those, 126 said "Calm right now" directly above a 1,3–1,6 m sea, because the
 *     protected-cove floor in seaConditions hid the measurement from the wording;
 *   • 144 (4,5%) showed the "Excellent today" badge over an amber sea, ALL of them in the
 *     0,50–0,79 m band where only the graphic escalated — the Avlonas / Lemnos screenshot.
 *
 * So the rule this module exists to enforce: **the page may never print a wave figure and then
 * describe it as something else.** Every word on the page is derived from the same number the
 * graphic draws, through the same thresholds (utils/waveCharacter — the single pair the map pin
 * and the card chip already read), on the same swell-equivalent scale.
 *
 * Shelter and wind can only make the verdict WORSE, never better. That direction is the whole
 * point: protection legitimately explains why a windy day is still swimmable, but it cannot
 * un-measure a sea that is already running.
 */

export type SeaSeverity = 'calm' | 'moderate' | 'rough';

const SEVERITY_RANK: Record<SeaSeverity, number> = { calm: 0, moderate: 1, rough: 2 };

/** Whichever reading is worse. Severity only ever escalates — see the note above. */
export const worstSeaSeverity = (a: SeaSeverity, b: SeaSeverity): SeaSeverity =>
  SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;

export const isAtLeast = (severity: SeaSeverity, floor: SeaSeverity): boolean =>
  SEVERITY_RANK[severity] >= SEVERITY_RANK[floor];

/**
 * What the measured/estimated sea alone says, on the shared swell-equivalent boundaries
 * (0.8 / 1.2 m). Undefined height → 'calm': absence of a measurement is not evidence of a
 * sea, and inventing one is how false amber days ship.
 */
export const getSeaStateSeverity = (severityM?: number): SeaSeverity => {
  if (typeof severityM !== 'number' || !Number.isFinite(severityM)) return 'calm';
  if (severityM >= SEA_STATE_ROUGH_M) return 'rough';
  if (severityM >= SEA_STATE_AMBER_M) return 'moderate';
  return 'calm';
};

/**
 * What the wind alone says, given how open this shore is to it. This reproduces exactly the
 * ladder that used to live inside WaveHeightGraphic.getSeverityBand, so no wind behaviour
 * changes here — it only stops being a private copy.
 *
 * A verified-protected shore tops out at 'moderate' even in a gale, because being in the lee
 * is a real, measured fact about the WIND. It is not permitted to cap what the SEA says: that
 * combination is resolved by worstSeaSeverity in getSeaSeverity below.
 */
export const getWindSeverity = (
  windBeaufort?: number,
  exposureLevel?: ExposureLevel,
  canClaimWindProtection?: boolean
): SeaSeverity => {
  const bft = typeof windBeaufort === 'number' && Number.isFinite(windBeaufort)
    ? Math.round(windBeaufort)
    : undefined;
  if (bft === undefined) return 'calm';

  const isProtected = exposureLevel === 'protected' || (canClaimWindProtection === true && exposureLevel !== 'exposed');
  const isExposedOrPartial = exposureLevel === 'exposed' || exposureLevel === 'partial';

  if (bft >= 6) return isProtected ? 'moderate' : 'rough';
  if (bft >= 5) return 'moderate';
  if (bft >= 4 && isExposedOrPartial) return 'moderate';
  return 'calm';
};

export interface SeaSeverityInput {
  /**
   * The wave height the page DISPLAYS (already cove-corrected where that applies), in metres.
   * It must be the same number the wave graphic draws — that identity is the invariant.
   */
  waveHeightM?: number;
  /** Total-sea period (s). Converts the height to swell-equivalent; omitted → height as-is. */
  wavePeriodS?: number;
  windBeaufort?: number;
  exposureLevel?: ExposureLevel;
  canClaimWindProtection?: boolean;
}

/** The one verdict every surface on the page reads. */
export const getSeaSeverity = (input: SeaSeverityInput): SeaSeverity => worstSeaSeverity(
  getSeaStateSeverity(seaStateSeverityM(input.waveHeightM, input.wavePeriodS)),
  getWindSeverity(input.windBeaufort, input.exposureLevel, input.canClaimWindProtection)
);
