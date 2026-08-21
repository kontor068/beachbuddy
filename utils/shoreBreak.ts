import type { Beach } from '../types';
import { SEA_STATE_AMBER_M, seaStateSeverityM } from './waveCharacter';

/**
 * ΤΟ ΙΔΙΟ ΚΥΜΑ ΔΕΝ ΣΠΑΕΙ ΤΟ ΙΔΙΟ ΣΕ ΚΑΘΕ ΠΑΡΑΛΙΑ (13/08/2026).
 *
 * Καβαλικευτά, Λευκάδα, 13/08/2026, 11:30 — a user standing on the beach reported wave while the
 * app read ΙΔΑΝΙΚΗ for that hour. The forecast was not wrong: two independent marine models
 * (`ewam` and `meteofrance_wave`) both put the sea at 0,24–0,38 m. Every wave number the app owns
 * was right, and the reader was still surprised.
 *
 * The missing term is the beach itself. A 0,3 m swell running onto a flat sandy shore spills
 * across tens of metres of shallow water and arrives as nothing. The same 0,3 m onto a steep
 * pebble bank with deep water a few strides out has nowhere to dissipate: it plunges directly on
 * the shore. That is the difference between a spilling and a plunging break (the Iribarren number
 * — beach slope over the square root of wave steepness), and Καβαλικευτά is the textbook second
 * case: our own record says `waterDepth: deep` and `terrain: pebbles, large_stones, rocks`.
 *
 * SO THIS IS A NOTE, NOT A SEVERITY. It changes no colour, no score, no ranking and no swim
 * verdict — deliberately. The sea really is 0,3 m; calling the beach less than ΙΔΑΝΙΚΗ over it
 * would be the app disagreeing with its own measurement, and it would fire on 662 beaches
 * (23,2% of the country) every time a swell turned onshore. What the reader was missing was not a
 * worse verdict, it was the sentence "here, that wave breaks on the shore". So we say that.
 *
 * It stays silent unless all four hold, which is what keeps it from becoming wallpaper:
 *   1. the water is deep right off the beach (our own `waterDepth`),
 *   2. the shore is coarse — pebbles, stones, rock (our own `terrain`),
 *   3. the sea is genuinely arriving through a sector we have NOT judged protected
 *      (utils/seaArrival.resolveSeaArrivalExposureLevel — the same test the shore-damping uses),
 *   4. there is a wave at all.
 *
 * Gate 3 is what stops it appearing on a flat-calm morning with the swell running the other way,
 * and gate 4 stops it on the days there is simply nothing to break.
 */

/**
 * Shore materials that do not build a dissipative surf zone. `coarse_sand` is deliberately NOT
 * here: it is 1.162 beaches nationally and it still forms the gentle slope that spreads a wave
 * out. The line is drawn at material a wave cannot flatten.
 */
export const COARSE_SHORE_TERRAIN: readonly string[] = [
  'pebbles',
  'small_pebbles',
  'fine_pebbles',
  'large_stones',
  'stones',
  'rocks',
  'shingle',
  'gravel',
  'fine_gravel',
];

/**
 * Below this the sea has nothing to break with — a note about how a wave lands is noise when there
 * is no wave. Deliberately low: the whole point of this rule is the case the app currently calls
 * flat, so a threshold up at the amber line would silence it exactly where it is needed.
 *
 * 0,2 AND NOT 0,25, AND THAT IS NOT A ROUNDING PREFERENCE (13/08/2026). The page prints one
 * decimal. A 0,25 floor sits exactly on the boundary between «0,2 μ.» and «0,3 μ.», so an hourly
 * series that wobbles by a single centimetre crosses it repeatedly: measured on Καβαλικευτά the
 * same afternoon, the note appeared at 07:00, vanished at 08:00 (0,24 m), came back at 09:00, and
 * did the same again at 14:00–15:00 — a sentence blinking on and off as the reader drags the hour
 * slider, over a difference nobody can see and the page does not even display. A threshold has to
 * sit where the printed number is not changing, not in the middle of its rounding step.
 */
export const SHORE_BREAK_MIN_WAVE_M = 0.2;

export interface ShoreBreakInput {
  /** `beach.metadata.waterDepth.type` — our own record of how fast it gets deep. */
  waterDepthType?: string;
  /** `beach.metadata.terrain.types`. */
  terrainTypes?: readonly string[];
  /**
   * utils/seaArrival.resolveSeaArrivalExposureLevel. `undefined` means the sea is not running onto
   * this shore (or we have no geometry to say), and the note stays silent — never "assume it is".
   */
  seaArrivalExposureLevel?: string;
  /** Decision-grade sea state (m) — `BeachScore.seaStateWaveM`, not the display height. */
  seaStateWaveM?: number;
  /** Its period — needed for the severity test below, which is what the colour ladder reads. */
  seaStatePeriodS?: number;
}

export const hasSteepCoarseShore = (
  waterDepthType?: string,
  terrainTypes?: readonly string[]
): boolean => waterDepthType === 'deep'
  && Array.isArray(terrainTypes)
  && terrainTypes.some(type => COARSE_SHORE_TERRAIN.includes(type));

export const shoreBreaksOnTheBeach = ({
  waterDepthType,
  terrainTypes,
  seaArrivalExposureLevel,
  seaStateWaveM,
  seaStatePeriodS,
}: ShoreBreakInput): boolean => {
  if (!hasSteepCoarseShore(waterDepthType, terrainTypes)) return false;
  // Same contract as the shore-damping: `undefined` means «the sea is not running onto this
  // shore», and a sector we HAVE judged protected is one the sea does not roll into. Blindness is
  // NOT silence — utils/seaArrival.SEA_ARRIVAL_UNKNOWN matches neither, so a beach whose wave
  // direction we never got is judged on its own steep coarse shore instead of being waved through.
  if (seaArrivalExposureLevel === undefined || seaArrivalExposureLevel === 'protected') return false;
  if (typeof seaStateWaveM !== 'number' || !Number.isFinite(seaStateWaveM)) return false;
  if (seaStateWaveM < SHORE_BREAK_MIN_WAVE_M) return false;
  /**
   * AND ONLY WHILE THE APP IS OTHERWISE CALLING THIS WATER CALM.
   *
   * Above `SEA_STATE_AMBER_M` the page already says «Λίγο κύμα» / «Υψηλό κύμα», the pin is
   * already yellow or worse, and the reader has been told. Adding "the wave breaks at the shore"
   * on top is a second sentence saying the same thing — the exact duplicate-copy failure this
   * project has already paid for once. The note exists for the case the app calls flat: measured
   * live on 13/08/2026 the unbounded version fired on 222 beaches, many of them sitting under a
   * 1,9 m sea that needed no help being described.
   */
  const severityM = seaStateSeverityM(seaStateWaveM, seaStatePeriodS);
  return typeof severityM !== 'number' || severityM < SEA_STATE_AMBER_M;
};

/** Convenience for callers holding a whole beach record. */
export const beachShoreBreaks = (
  beach: Pick<Beach, 'metadata'> | undefined,
  seaArrivalExposureLevel: string | undefined,
  seaStateWaveM: number | undefined,
  seaStatePeriodS?: number
): boolean => shoreBreaksOnTheBeach({
  waterDepthType: beach?.metadata?.waterDepth?.type,
  terrainTypes: beach?.metadata?.terrain?.types,
  seaArrivalExposureLevel,
  seaStateWaveM,
  seaStatePeriodS,
});
