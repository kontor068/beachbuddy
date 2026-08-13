/**
 * Fetch-limited significant wave height model.
 *
 * Uses the simplified Sverdrup-Munk-Bretschneider (SMB) deep-water,
 * fetch-limited relationship. Given a 10 m wind speed and the open-water
 * fetch in the upwind direction, it estimates the significant wave height
 * (Hs, the mean height of the highest third of waves) the wind can build
 * over that fetch.
 *
 * This is a physical, zero-cost estimate: it lets us reason about
 * swimmability even when live marine (wave) data is missing, and it ties
 * the directional exposure model to an actual expected wave height rather
 * than a bare protected/partial/exposed bucket.
 *
 * Reference form:
 *   Hs = 0.283 * (U^2 / g) * tanh( 0.0125 * (g * F / U^2)^0.42 )
 * with U in m/s, F in metres, g = 9.81 m/s^2, Hs in metres.
 */

import { GROUND_SWELL_MIN_PERIOD_S } from './swellExposure';

const GRAVITY = 9.81;
const KMH_TO_MS = 1 / 3.6;
const KM_TO_M = 1000;
const WIND_CHOP_GUST_MIN_BASE_BEAUFORT = 3;
const WIND_CHOP_GUST_NOTE_ABS_KMH = 40;
const WIND_CHOP_GUST_NOTE_SPREAD_KMH = 18;

/** Wind speeds below this (m/s) cannot build meaningful waves over any fetch. */
const MIN_WIND_MS = 0.5;

export type WaveExposureLevel = 'protected' | 'partial' | 'exposed';

export interface FetchWaveInput {
  /** Sustained 10 m wind speed in km/h. */
  windSpeedKmh: number;
  /** Open-water fetch in the upwind direction, in kilometres. */
  fetchKm: number;
}

/**
 * Estimates fetch-limited significant wave height (metres) for a given wind
 * speed (km/h) and upwind open-water fetch (km). Always returns a finite,
 * non-negative value.
 */
export const estimateFetchLimitedWaveHeightM = ({ windSpeedKmh, fetchKm }: FetchWaveInput): number => {
  const windMs = Math.max(0, windSpeedKmh) * KMH_TO_MS;
  const fetchM = Math.max(0, fetchKm) * KM_TO_M;

  if (windMs < MIN_WIND_MS || fetchM <= 0) return 0;

  const dimensionlessFetch = (GRAVITY * fetchM) / (windMs * windMs);
  const hs = 0.283 * ((windMs * windMs) / GRAVITY) * Math.tanh(0.0125 * Math.pow(dimensionlessFetch, 0.42));

  return Number.isFinite(hs) && hs > 0 ? Number(hs.toFixed(2)) : 0;
};

/**
 * Blends a modeled wave height with a measured (live marine) wave height.
 *
 * - When measured data exists we trust it but never let the displayed value
 *   fall below what the local wind+fetch can physically build at this beach
 *   (open-sea buoys/grid points can under-represent a wind-exposed pocket),
 *   so we take the larger of the two.
 * - When measured data is missing the modeled value fills the gap, so the
 *   user never sees an empty/uncertain wave figure.
 */
export const resolveEffectiveWaveHeightM = (
  measuredWaveHeightM: number | undefined,
  modeledWaveHeightM: number
): number => {
  if (typeof measuredWaveHeightM === 'number' && Number.isFinite(measuredWaveHeightM)) {
    return Number(Math.max(measuredWaveHeightM, modeledWaveHeightM).toFixed(2));
  }
  return modeledWaveHeightM;
};

/**
 * The wave height the beach page actually prints, end to end.
 *
 * This is the composite the whole product rests on: `max(what the grid reported,
 * what this beach's own geometry says the wind can build here)`. It is the reason
 * a 4,2 km marine cell cannot print flat water over a shore our own physics says
 * is choppy — and, until now, nothing had ever measured whether that max() helps
 * the ranking a visitor sees, hurts it, or does nothing.
 *
 * It exists as a function so that an offline validator can call THE SAME CODE the
 * beach page runs, rather than a copy of it. Gate 18 of this project once passed
 * green against deliberately sabotaged code because the check re-implemented what
 * it was checking; the lesson is written into scripts/validateWaveClimatology.mjs
 * and it applies here.
 *
 * It used to be written out by hand in four places that were NOT identical — most
 * sharply App.tsx, which skipped the light-wind cap entirely and so ranked a
 * beach's best remaining hours against a sea the page never showed. Measured over
 * 38.180 beach-hours before it was touched: 2,0-2,4% of hours disagreed, by up to
 * 1,34 m, swapping which coast was calmer 100 times. Every live call site now
 * comes through here, so that cannot drift back in silently.
 *
 * ⚠️ One copy still exists, in services/beachPlannerService.ts. It is DEAD CODE:
 * `generateBeachDayPlan` has no caller, `components/BeachDayPlanner.tsx` is
 * mounted nowhere, and neither appears in the built bundle — verified, not
 * assumed. The live planner is services/tripPlannerService.ts, which does thread
 * geospatial profiles through (`planTrip`, ~line 717) and scores through
 * calculateBeachScore, i.e. through this function. If that dead planner is ever
 * revived, it must be given a geospatialProfile first: without one it cannot
 * compute seaArrival, and seaArrival only ever moves the number UP, so it would
 * cap harder than the page and show a calmer sea for the same hour.
 */
/**
 * The flattest sea the app is willing to print, in metres. Defined here rather than imported from
 * utils/shoreWave (which imports FROM this file) so the three floors — this one,
 * shoreWave.SHORE_DISPLAY_FLOOR_M and coveWaveGuard.COVE_DISPLAY_FLOOR_M — stay the same number.
 * A bare "0,00 μ." reads as a broken figure, not as calm water; the sea is never perfectly flat.
 */
export const WAVE_DISPLAY_FLOOR_M = 0.1;

export const resolveDisplayWaveHeightM = ({
  exposureLevel,
  modeledWaveHeightM,
  beaufort,
  windSpeedKmh,
  gustKmph,
  measuredWaveHeightM,
  swell,
  seaArrival,
  geometricCeilingM,
}: {
  exposureLevel: WaveExposureLevel;
  /** `WindExposureAssessment.modeledWaveHeightM` — open-water SMB, before damping. */
  modeledWaveHeightM: number;
  beaufort: number;
  windSpeedKmh: number;
  gustKmph?: number;
  /** The raw grid reading, or undefined when marine data is missing. */
  measuredWaveHeightM?: number;
  swell?: { heightM?: number; periodS?: number };
  seaArrival?: SeaArrivalGeometry;
  /**
   * utils/geometricWaveCeiling — the largest wave this beach's geometry can physically hold at
   * the live wind, for the few beaches enclosed on every bearing. Applied to the FINAL height so
   * the grid reading, the damped SMB and the wind-chop floor are all bound by it: a wave the bay
   * has no room to build is impossible whichever of the three claims it. `undefined` for ~97% of
   * beaches, and then nothing here changes.
   */
  geometricCeilingM?: number;
}): {
  effectiveWaveHeightM: number;
  modeledWaveHeightM: number;
  /** The grid reading after the light-wind cap — callers need it to tell an
   *  honest "measured" apart from a "measured-capped" sea-state source. */
  realisticMeasuredWaveHeightM: number | undefined;
  /** True when the geometric ceiling actually lowered the number — for copy and audits. */
  geometricCeilingApplied: boolean;
} => {
  // SMB gives open-water Hs, so damp it toward the shore by exposure: sheltered and
  // cross-shore beaches see far less of it than a coast facing the fetch head-on.
  const damping = exposureLevel === 'protected' ? 0.5 : exposureLevel === 'partial' ? 0.75 : 1;
  const fetchModeledWaveHeightM = Number((modeledWaveHeightM * damping).toFixed(2));
  const windChopFloorM = getWindChopWaveFloorM(exposureLevel, beaufort, windSpeedKmh, gustKmph);
  const modeled = Number(Math.max(fetchModeledWaveHeightM, windChopFloorM).toFixed(2));

  const measured = typeof measuredWaveHeightM === 'number' && Number.isFinite(measuredWaveHeightM)
    ? measuredWaveHeightM
    : undefined;
  const realisticMeasured = typeof measured === 'number'
    ? capLightWindMeasuredWaveM(measured, beaufort, swell, seaArrival)
    : undefined;

  const uncapped = resolveEffectiveWaveHeightM(realisticMeasured, modeled);
  // The ceiling only ever removes a height the bay has no room to build; it can never raise one,
  // and it is not allowed to invent a flatness the display floor would not print anyway.
  const capped = typeof geometricCeilingM === 'number' && Number.isFinite(geometricCeilingM)
    ? Number(Math.min(uncapped, Math.max(geometricCeilingM, WAVE_DISPLAY_FLOOR_M)).toFixed(2))
    : uncapped;

  return {
    effectiveWaveHeightM: capped,
    modeledWaveHeightM: Math.min(modeled, capped),
    realisticMeasuredWaveHeightM: realisticMeasured,
    geometricCeilingApplied: capped < uncapped - 0.005,
  };
};

/**
 * Conservative lower bound for wind chop that can be felt near shore even when
 * the area marine grid reports a low wave height. It is intentionally coarse:
 * enough to avoid false "flat sea" claims on windy days, while still letting
 * genuinely protected beaches remain more manageable than exposed ones.
 */
export const getWindChopWaveFloorM = (
  exposureLevel: WaveExposureLevel,
  beaufort: number,
  windSpeedKmh: number,
  gustKmph?: number
): number => {
  const gustSpreadKmph = typeof gustKmph === 'number' ? Math.max(0, gustKmph - windSpeedKmh) : 0;
  const gusty = beaufort >= WIND_CHOP_GUST_MIN_BASE_BEAUFORT && (
    (typeof gustKmph === 'number' && gustKmph >= WIND_CHOP_GUST_NOTE_ABS_KMH) ||
    gustSpreadKmph >= WIND_CHOP_GUST_NOTE_SPREAD_KMH
  );

  let floor = 0;
  if (beaufort >= 7) {
    floor = exposureLevel === 'protected' ? 0.6 : exposureLevel === 'partial' ? 0.95 : 1.2;
  } else if (beaufort >= 6) {
    floor = exposureLevel === 'protected' ? 0.5 : exposureLevel === 'partial' ? 0.75 : 1;
  } else if (beaufort >= 5) {
    floor = exposureLevel === 'protected' ? 0.4 : exposureLevel === 'partial' ? 0.6 : 0.8;
  } else if (beaufort >= 4) {
    floor = exposureLevel === 'protected' ? 0.3 : exposureLevel === 'partial' ? 0.45 : 0.6;
  } else if (gusty) {
    floor = exposureLevel === 'protected' ? 0.3 : exposureLevel === 'partial' ? 0.4 : 0.5;
  }

  if (floor === 0) return 0;

  const gustBump = gusty ? (exposureLevel === 'protected' ? 0.05 : 0.1) : 0;
  // Cap = the >=7 Bft floor + gust bump, so the tier escalation above stays
  // reachable (tighter caps silently flattened 6-8 Bft to the 5 Bft value).
  const cap = exposureLevel === 'protected' ? 0.65 : exposureLevel === 'partial' ? 1.05 : 1.3;
  return Number(Math.min(cap, floor + gustBump).toFixed(2));
};

/** Where a measured sea is arriving from, relative to THIS beach's geometry. */
export interface SeaArrivalGeometry {
  /** cos(arrival direction − beach facing): +1 straight onshore, −1 straight offshore. */
  onshore: number;
  /** Open-water fetch (km) in the sector the sea arrives through. */
  fetchKm: number;
}

/** Onshore component above which a sea genuinely reaches this shore (matches swellExposure). */
const ARRIVAL_ONSHORE_MIN = 0.3;
/** Fetch (km) above which the arrival sector is a real open-water corridor (matches coveWaveGuard). */
const ARRIVAL_MIN_FETCH_KM = 2;

// There was also a SHADOWING branch here — offshore bearing plus near-zero fetch capped the sea at
// 0.20 m — and it is deliberately gone. Three measurements killed it:
//
//   • It fired on 2846/2850 beaches over a median 153° window, so it was a replacement for the
//     light-wind cap, not the narrow correction it was written as.
//   • Its "double lock" was one lock. `onshore < 0` means "pointing at the land behind the beach",
//     which is exactly where ray-cast fetch is short — both conditions come from the same pin and
//     the same facingDeg, so one wrong facing turns both at once. The codebase already has a name
//     for that failure (`suspectPin`) and this code never consulted it.
//   • The trust flag meant to gate it was computed for each beach's own sample point, while the
//     app requests one marine point per CLUSTER — a median 5.4 km away — so 796 beaches with an
//     untrustworthy cell carried no flag and would have been shadowed anyway.
//
// It only ever made the app less cautious, which is the one direction that can put someone in
// water the app called flat. Nothing was reported broken that it fixed. Removed until there is a
// trust signal measured against the coordinate the app actually requests.

/**
 * Light-wind realism cap for the measured (grid) wave height.
 *
 * Open-Meteo's `wave_height` is the TOTAL significant height (wind sea + swell), read from a grid
 * cell that is typically several km offshore and may not even be in the same body of water. At
 * 1–2 Bft that cuts both ways, so this resolves the measured value against the beach's own geometry
 * — WHERE the sea is coming from, not just how big the grid says it is:
 *
 *   • Arriving onshore through an open corridor → trust it in full. This is the Σχινιάς case
 *     (2026-07-27): a 0.45 m SSE sea marching down a 15.6 km fetch onto a 173.5°-facing shore
 *     while the local wind read 2 Bft. Local wind describes local wind; it says nothing about a
 *     sea built by wind over the water, earlier in the day, or further down the fetch. Capping
 *     that away was the app telling a swimmer standing in the surf that the sea was flat.
 *
 *   • Everything else — including a sea that appears to arrive through land, and every case with
 *     no geometry — falls through to the original light-wind cap, unchanged. There is deliberately
 *     no branch that caps HARDER than that (see the note above the constants).
 *
 * Genuine long-period groundswell is exempt before any of this: it reaches the coast in calm wind.
 */
export const capLightWindMeasuredWaveM = (
  measuredWaveHeightM: number,
  beaufort: number,
  swell?: { heightM?: number; periodS?: number },
  arrival?: SeaArrivalGeometry
): number => {
  if (!Number.isFinite(measuredWaveHeightM) || measuredWaveHeightM <= 0) return measuredWaveHeightM;
  // A gentle breeze (≥3 Bft) can already build a real small sea — leave it to the rest of the model.
  if (beaufort >= 3) return measuredWaveHeightM;

  // Genuine long-period groundswell reaches the coast even with calm wind — never cap it away.
  // Same ground-swell threshold as the swell modules (7 s): a 7-9 s swell the app itself
  // calls "genuine" must not be hidden behind the light-wind cap.
  const hasGenuineSwell =
    typeof swell?.periodS === 'number' && swell.periodS >= GROUND_SWELL_MIN_PERIOD_S &&
    typeof swell?.heightM === 'number' && swell.heightM >= 0.4;
  if (hasGenuineSwell) return measuredWaveHeightM;

  // The one directional rule left, and it only ever moves the number UP: a sea arriving onshore
  // through an open corridor is real regardless of the local wind, so the light-wind cap must not
  // hide it. Its worst case is telling someone a calm beach has chop and they skip a good swim —
  // survivable. There is deliberately no branch that lowers the number (see above).
  if (
    arrival &&
    Number.isFinite(arrival.onshore) &&
    Number.isFinite(arrival.fetchKm) &&
    arrival.onshore > ARRIVAL_ONSHORE_MIN &&
    arrival.fetchKm >= ARRIVAL_MIN_FETCH_KM
  ) {
    return measuredWaveHeightM;
  }

  // 0–1 Bft: essentially flat; 2 Bft: a light ripple.
  const cap = beaufort <= 1 ? 0.3 : 0.4;
  return Math.min(measuredWaveHeightM, cap);
};
