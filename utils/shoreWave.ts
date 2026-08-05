import { estimateFetchLimitedWaveHeightM } from './waveModel';
import {
  OFFSHORE_FLAT_MAX_FETCH_KM,
  OFFSHORE_FLAT_MAX_ONSHORE,
  OFFSHORE_FLAT_MIN_BLOCKED_RATIO,
} from './offshoreFlatWater';

/**
 * ΤΟ ΚΥΜΑ ΜΠΡΟΣΤΑ ΣΤΗΝ ΑΜΜΟ — the number people actually came for.
 *
 * THE PROBLEM, in one screenshot. Σχινιάς, 05/08/2026, 5 Bft from 21° — a northerly blowing
 * straight OFF the land at a shore that faces 173°. Its own geometry reads 0,2 km of fetch and
 * intensity 0,2/100 in that sector; a live webcam showed glass with swimmers standing in it.
 * The page printed «Κύμα ανοιχτά 1,1 μ.» — which is TRUE, and was taken 9,4 km out in the
 * South Evoian Gulf where that same wind has tens of kilometres to work with.
 *
 * The label «ανοιχτά» / "offshore" was our answer to that, and it is not enough: a reader sees
 * a metre figure next to a beach and reads it as the water at the beach. Miltos, 05/08/2026:
 * «το κύμα το θελουμε να το βλεπουμε στην ακτη, ο κοσμος το βλεπει στην ακτη για να καταλαβει
 * αν εχει κυμα η οχι στην παραλια».
 *
 * WHY THIS IS NOT THE THING THAT WAS REJECTED ON 29/07/2026. That decision refused a downward
 * CAP on the displayed open-water number — i.e. printing a smaller figure under the same label,
 * which is how a false calm is manufactured. This adds a SECOND, separately-labelled reading and
 * leaves the open-water one on screen beside it. Nothing that exists today gets smaller; one
 * thing gets added. The wave graphic, the sea verdict, the colour and every gate keep reading
 * exactly the number they read before (docs/team/PORISMA-KAIROS-2026-08.md §4 Σ3 explains why
 * those must stay bound to the printed open-water figure).
 *
 * WHERE IT IS ALLOWED TO SPEAK — the four conditions, all required:
 *   1. The live wind sector is near-totally land-blocked, has essentially no fetch, and the wind
 *      is blowing off the land. These are the IDENTICAL constants the offshore-flat-water lift
 *      uses (utils/offshoreFlatWater), imported rather than restated so they can never drift.
 *      That gate was measured airtight in the dangerous direction: of 4.386 lifted combinations
 *      the maximum sector fetch was 0.
 *   2. High-confidence geometry, no suspect pin. A misread coastline must never produce a calm
 *      claim — the whole reason geospatialProfileConflictsWithAuthoredFacing exists.
 *   3. NO SWELL. This is the one real false-calm risk and it is why the cove guard has the same
 *      rule: ground swell wraps around headlands and into bays that the wind cannot reach, so a
 *      blocked shore can be perfectly sheltered from the wind and still have a metre of roll
 *      arriving. With swell present we say nothing about the shore and leave the open-water
 *      number to speak alone.
 *   4. There is an open-water reading to be quieter than. With no measurement there is nothing
 *      to add a second opinion to.
 *
 * WHAT IT IS, physically: the fetch-limited height our own SMB model gives over the fetch the
 * ray-caster measured in that sector, at the live wind speed — the same textbook formula and the
 * same code path that has always produced the modelled leg of the displayed wave. It is floored
 * at SHORE_DISPLAY_FLOOR_M and capped at the open-water reading, so it can never print more than
 * the sea outside nor claim a flatness finer than the app is willing to draw.
 *
 * WHAT NO ONE CAN CHECK IT AGAINST, and this must stay written down: there is no judge for a
 * shoreline. Copernicus reads a 4,2 km cell — over the two cached meltemi summers its leeward
 * cell sits at a median 0,52 m, but that is open water on the lee side of an island, not the
 * water at an enclosed shore with the wind coming off the hill behind it. So this number is
 * MODELLED and is presented as such (a «~» and its own label), never as a measurement.
 */

/** Never print a flatness finer than this — matches the cove guard's display floor. */
export const SHORE_DISPLAY_FLOOR_M = 0.1;

export interface ShoreWaveInput {
  /** The open-water figure the page prints today, in metres. */
  openWaterWaveHeightM?: number;
  /** Live wind speed at the beach, km/h — the SMB input, not a Beaufort proxy. */
  windSpeedKmh?: number;
  /** The live wind sector's committed geometry. */
  sector?: { fetchKm?: number; blockedRayRatio?: number; onshore?: number } | null;
  /** Profile confidence — only 'high' may produce a calm claim. */
  confidence?: string;
  suspectPin?: boolean;
  /** True when meaningful ground swell is present (assessSwellExposure's own threshold). */
  swellPresent?: boolean;
}

/**
 * The modelled height at the shore, or `undefined` when we are not entitled to an opinion.
 *
 * `undefined` is the normal answer — it means the page behaves exactly as it did before this
 * function existed. Callers must treat it that way and must never substitute a fallback.
 */
export const estimateShoreWaveHeightM = ({
  openWaterWaveHeightM,
  windSpeedKmh,
  sector,
  confidence,
  suspectPin,
  swellPresent,
}: ShoreWaveInput): number | undefined => {
  if (swellPresent) return undefined;
  if (suspectPin) return undefined;
  if (confidence !== 'high') return undefined;
  if (typeof openWaterWaveHeightM !== 'number' || !Number.isFinite(openWaterWaveHeightM)) return undefined;
  if (typeof windSpeedKmh !== 'number' || !Number.isFinite(windSpeedKmh)) return undefined;
  if (!sector) return undefined;

  const { fetchKm, blockedRayRatio, onshore } = sector;
  if (typeof fetchKm !== 'number' || typeof blockedRayRatio !== 'number' || typeof onshore !== 'number') {
    return undefined;
  }
  if (blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return undefined;
  if (fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return undefined;
  if (onshore > OFFSHORE_FLAT_MAX_ONSHORE) return undefined;

  const modelledM = estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm });
  const shoreM = Math.max(SHORE_DISPLAY_FLOOR_M, modelledM);

  // Never louder than the sea outside: if our own model somehow exceeds the grid reading, the
  // grid wins and we stay silent rather than print the larger of two numbers under the calmer
  // label. This is the guard that makes the pair monotonic by construction.
  if (shoreM >= openWaterWaveHeightM) return undefined;

  return Number(shoreM.toFixed(2));
};
