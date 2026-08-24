import type { GeospatialExposureProfile } from '../types';
import { onshoreComponent } from './geospatialExposureModel';
import { SWELL_MIN_HEIGHT_M } from './swellExposure';
import { windSectorFromDegrees } from './windExposure';
import { estimateFetchLimitedWaveHeightM } from './waveModel';
import { shoreSeaStateM } from './waveCharacter';

/**
 * Top of the 5 Bft band in km/h (utils/weatherUtils.getBeaufortLevel: 5 Bft is ≤38). The gate
 * only ever runs at exactly 5 Bft, and taking the WORST wind in the band keeps the physical
 * assertion below conservative — a fetch that is flat at 38 km/h is flat at 30.
 */
const BEAUFORT_5_REFERENCE_WIND_KMH = 38;

/**
 * THE ONE CASE WHERE 5 BEAUFORT DOES NOT MEAN CHOP.
 *
 * The tone ladder (utils/suitabilityTone.resolveWindTone) reads wind SPEED at 5 Bft and gives
 * every shore that is not 'exposed' the same orange — shelter buys you "not red", never "good".
 * That is right for a shore the wind grazes, and wrong for a shore the wind blows OFF: with the
 * land upwind there is no fetch to build a wave on, and the water in front of the beach is
 * glass. Vai, 02/08/2026: 30 km/h from 295° onto an 85°-facing shore with 0 km of fetch, the
 * live camera showing a flat sea and a full beach, and our map calling it «Μέτρια».
 *
 * WHAT THE GATE ASKS, and why each clause is here rather than in a comment about future work:
 *
 *   • the sector's own geometry must already pass the strict green-pin test — fully blocked rays,
 *     low intensity, protected level, a profile we trust. This is the same evidence bar
 *     utils/mapExposure.isStableProtectedSector applies before painting a pin green, and reusing
 *     it means this rule can never be the FIRST thing to trust a weak profile;
 *   • zero modelled fetch in that sector. Not "short" — zero. A kilometre of open water at 5 Bft
 *     builds a real 30 cm chop, and the whole claim here is that there is nothing to build on;
 *   • the wind must meet the shore at more than 143° off head-on, measured from the beach's OWN
 *     facing against the LIVE bearing. Measured from the sector centre instead, Vai reads −0,65
 *     and fails its own case — the 45° bucket is too coarse for a question about angle.
 *
 * WHY IT STOPS AT 5 BFT. At 6 the app is already unconditionally avoid_swimming
 * (swimmingComfortFromScore), so lifting the colour there would print "good" over "do not swim" —
 * the same contradiction that cost the enclosed cove its own colour on 02/08. Below 5 there is
 * nothing to fix: a protected shore is already blue or yellow.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not touch the exposure level, the verdict word, the
 * score, or the ranking — only how calm the surface is allowed to LOOK. And it is not the last
 * word: the sea-state ceiling in capToneBySeaState still runs after it, so a beach with a real
 * running sea offshore goes back to orange even when this gate passes. That is the safety net
 * that keeps a swell wrapping into a lee shore from being painted calm, and it is why this rule
 * did not need one of its own.
 *
 * MEASURED BEFORE SHIPPING (02/08/2026, 501-beach national sample against live wind and live
 * marine data): 8% of beaches were at 5 Bft at all, and 13 of the 501 (2,6%) actually changed
 * colour — ~74 nationally on that day's weather. The geometry alone would allow 19,6% of the
 * country; the reason the real number is a seventh of that is that most beaches are not at 5 Bft
 * on any given day. Judge future changes to these constants against the LIVE number, not the
 * geometric one — the geometric count answers a question no user ever asks.
 */

/** Fully blocked rays. Mirrors utils/mapExposure.GEOMETRY_PROTECTION_BLOCKED_RATIO, stricter. */
export const OFFSHORE_FLAT_MIN_BLOCKED_RATIO = 1;
/** Sector intensity ceiling — less than half the 33 the green-pin test allows. */
export const OFFSHORE_FLAT_MAX_INTENSITY = 15;
/**
 * Short enough that our OWN wave model calls it nothing — not "exactly zero".
 *
 * ⚠️ 05/08/2026 — this was `0`, an exact-equality test against a number that is a MEAN of a
 * five-ray fan. A ray fan almost never averages to a clean zero, so the gate was rejecting the
 * very shores it was written for. Measured nationally at 5 Bft: 322 beach × sector combinations
 * across 258 beaches passed every other test — fully land-blocked, intensity under 15, wind more
 * than 143° off head-on — and were denied on fetch alone. Their denied fetch: minimum 0,04 km,
 * MEDIAN 0,12 km, p90 0,64 km. 302 of them also carry engine level 'protected', i.e. they would
 * genuinely have gone orange → yellow. Σχινιάς N (0,2 km, intensity 0,2/100) was one, with a
 * webcam showing glass while the page said otherwise.
 *
 * 0,5 km is not a tuned number and must not become one — it is READ OFF the physics. At the top
 * of the 5 Bft band our own SMB model (utils/waveModel.estimateFetchLimitedWaveHeightM) returns
 * 0,197 m over 0,5 km and crosses 0,20 m at ≈0,52 km. The assertion below re-derives that at
 * runtime, so if either the constant or the wave model moves, the gate closes rather than
 * silently widening.
 */
export const OFFSHORE_FLAT_MAX_FETCH_KM = 0.5;
/**
 * The modelled fetch-limited height this gate may still call flat, in metres.
 *
 * Anchored to the app's own vocabulary rather than picked: 0,20 m is BELOW THE LOWEST WIND-CHOP
 * FLOOR the app applies anywhere (0,30 m — utils/waveModel.getWindChopWaveFloorM, protected shore
 * at 4 Bft). A height the app already refuses to call chop is a height this gate may call flat.
 *
 * It was 0,10 m for one draft — the cove DISPLAY floor — and that was wrong: measured against the
 * real SMB it rejected 0,12 km of fetch, i.e. it would have thrown out Σχινιάς (0,2 km → 0,134 m)
 * and every other beach this fix exists for. The display floor answers "what is too small to
 * print"; this answers "what is too small to be chop". Different questions.
 */
export const OFFSHORE_FLAT_MAX_MODELLED_WAVE_M = 0.2;
/**
 * cos(windFrom − facing) ≤ this, i.e. more than 143° off head-on. The same `onshoreComponent`
 * the cove guard and the wave model read, so three parts of the app cannot disagree about which
 * way the wind meets a shore.
 */
export const OFFSHORE_FLAT_MAX_ONSHORE = -0.8;
/** Below this a protected shore is already blue or yellow; above it, avoid_swimming. */
export const OFFSHORE_FLAT_BEAUFORT = 5;

export interface OffshoreFlatWaterInput {
  profile?: GeospatialExposureProfile;
  /** Degrees the wind comes FROM, at THIS beach — not the region's. */
  windDirectionDeg?: number;
  beaufort?: number;
}

/**
 * The geometric core both rules below share: the live wind sector is near-totally land-blocked,
 * has essentially no fetch, and the wind meets the shore more than 143° off head-on — i.e. the
 * wind is blowing OFF the land and has nothing to build a wave on in front of this beach.
 */
const sectorHoldsNoWindWave = (
  profile: GeospatialExposureProfile | undefined,
  windDirectionDeg: number | undefined,
  /**
   * The two doors below ask the same physical question with different strictness — see
   * `holdsGlassWaterAtFourBeaufort` for why the 4 Bft door drops the angle and widens the
   * intensity ceiling, and what it pays for that. Defaults reproduce the 5 Bft rule exactly, so
   * a caller that passes nothing cannot accidentally widen it.
   */
  { maxIntensity = OFFSHORE_FLAT_MAX_INTENSITY, requireAngle = true } = {}
): boolean => {
  if (!profile) return false;
  if (typeof windDirectionDeg !== 'number' || !Number.isFinite(windDirectionDeg)) return false;

  const facingDeg = profile.facingDeg;
  if (typeof facingDeg !== 'number' || !Number.isFinite(facingDeg)) return false;
  if (profile.confidence !== 'high' && profile.confidence !== 'medium') return false;

  const sector = profile.sectors?.[windSectorFromDegrees(windDirectionDeg)];
  if (!sector || sector.level !== 'protected') return false;
  if (sector.blockedRayRatio < OFFSHORE_FLAT_MIN_BLOCKED_RATIO) return false;
  if (typeof sector.intensity !== 'number' || sector.intensity >= maxIntensity) return false;
  if (sector.fetchKm > OFFSHORE_FLAT_MAX_FETCH_KM) return false;
  // The physical half of the fetch test: whatever the constant says, the water is only "flat" if
  // our own fetch-limited model agrees it is. This keeps the 0,6 km above honest — raise it and
  // this line starts rejecting, instead of silently widening a false-calm.
  const modelledM = estimateFetchLimitedWaveHeightM({
    windSpeedKmh: BEAUFORT_5_REFERENCE_WIND_KMH,
    fetchKm: sector.fetchKm,
  });
  if (typeof modelledM === 'number' && modelledM > OFFSHORE_FLAT_MAX_MODELLED_WAVE_M) return false;

  if (!requireAngle) return true;
  return onshoreComponent(windDirectionDeg, facingDeg) <= OFFSHORE_FLAT_MAX_ONSHORE;
};

/**
 * True when the water in front of this beach is flat because the wind is blowing off the land
 * behind it, at the one wind strength where saying so changes the colour.
 */
export const holdsFlatWaterUnderOffshoreWind = ({
  profile,
  windDirectionDeg,
  beaufort,
}: OffshoreFlatWaterInput): boolean =>
  beaufort === OFFSHORE_FLAT_BEAUFORT && sectorHoldsNoWindWave(profile, windDirectionDeg);

/**
 * THE SAME PHYSICS ONE BEAUFORT LOWER — AND THE ONE PLACE THIS PROJECT PAINTS «ΙΔΑΝΙΚΗ» OVER
 * A 4 BEAUFORT WIND.
 *
 * Μελιδόνι, Κύθηρα, 18/08/2026 (user report): 25,6 km/h from 273° — 4 Bft, corroborated by
 * Kythira airport reading 22 km/h the same hour, so the number was never wrong. The W sector is
 * `protected` with ZERO fetch, our own SMB shore model returns 0,00 m, the marine sample reads
 * 0,48 m LEAVING the shore (onshore −0,64) — and the pin was yellow, because
 * `resolveWindTone` at 4 Bft asks only how hard the wind blows, never whether it has anywhere
 * to build a wave. The gate above answers exactly that question and was shut one Beaufort too
 * high.
 *
 * ⚠️ THIS AMENDS A WRITTEN DOCTRINE. PORISMA-KAIROS §3 said the offshore exception is «ΜΟΝΟ στα
 * 5 Μποφόρ … Ποτέ μπλε». That sentence was true of the 5 Bft door, where the only tone above
 * orange is yellow. One rung down there is nothing between yellow and blue, so extending the
 * rule at all means saying «Ιδανική». The amendment was measured first and decided by Miltos
 * (18/08/2026), which is the process §7δ requires of every exception — not a quiet widening.
 *
 * WHAT WAS MEASURED (national, 110 regions × 3 days = 8.616 beach-days, live wind and live
 * marine, scripts/measureOffshoreLiftAtFourBeaufort.mjs). Only 4,72% of beach-days are at 4 Bft
 * at all, and 2,54% are at 4 Bft on a protected shore — the ceiling on anything this rule can
 * ever do:
 *
 *   the 5 Bft gate as-is, one rung down     110 beach-days  1,28%
 *   + without the angle clause              157             1,82%
 *   + intensity ceiling 25 instead of 15    191             2,22%   ← no sea test yet
 *   + swell veto + quiet shore (SHIPPED)    162             1,88%   ← 162 beaches
 *
 * For scale: the 5 Bft door changed 2,6% of beaches on the day it shipped. This is the same
 * order of magnitude, and the reason it is not larger is simply that 4 Bft is uncommon.
 *
 * WHY THE ANGLE CLAUSE IS DROPPED HERE. `facingDeg` is the direction of the COVE MOUTH, not the
 * side the wind came over. Μελιδόνι faces 150°, the wind blew from 273°: onshore −0,53 against a
 * −0,80 threshold, i.e. rejected for being ALONGSHORE — while the same profile reports zero
 * fetch and fully blocked rays in that sector, which is the actual physical claim. The angle is
 * a proxy; `blockedRayRatio = 1` + `fetchKm ≤ 0,5` + the SMB check are the measurement. Same
 * objection as scripts/measureOffshoreAngleGate.mjs, here confined to the 4 Bft door.
 *
 * WHY THE INTENSITY CEILING MOVES TO 25. Μελιδόνι's W sector reads 15,1 against a limit of 15 —
 * the beach that caused the correction was excluded by a tenth of a point. 15 was «less than
 * half the 33 the green-pin test allows», a comfort margin rather than a measured line; 25 is
 * still comfortably inside «Προστατευμένη» (<33). It widened 157 → 191 beach-days, i.e. it is
 * not where the risk lives.
 *
 * WHERE THE RISK LIVES, AND WHAT PAYS FOR IT. At 191 beach-days the sea underneath — measured in
 * the steepness-adjusted SEVERITY the ceiling itself reads, not the raw height — was 0,2–0,4 m in
 * 44 cases, 0,4–0,6 m in 100, and 0,6–0,8 m in **47**. Nothing at or above 0,8 m; the existing
 * ceiling already stops those on its own. Painting «Ιδανική» over a 0,7 m short-period chop is
 * precisely the false calm the house rule forbids, so this door additionally requires a QUIET
 * SEA: severity below `GLASS_AT_FOUR_MAX_SEA_STATE_M`. That is a floor the sea-state ceiling
 * could never enforce by itself, because below 0,8 m it has no opinion at all.
 *
 * The swell veto is what actually shrinks the risky end: it takes the 0,6–0,8 m band from 47
 * beach-days to **22** and the total from 191 to 162. Those 22 remain, and they are the honest
 * residue of this rule — an open-water severity of 0,6–0,8 m, which is 0,3–0,4 m once the shore
 * damping is applied, with no meaningful swell and the wind blowing off the land. Judge any
 * future change to these constants against that LIVE number — the geometric count answers a
 * question no visitor ever asks.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not touch the 5 Bft door (unchanged constants,
 * unchanged behaviour), the exposure level, the verdict word, the score, or the printed wave. It
 * cannot fire above or below 4 Bft. And it stays under every ceiling that runs after it: the
 * sea-state ceiling, the swim-verdict ceiling, and the cove rules all still get their say.
 */
export const GLASS_AT_FOUR_BEAUFORT = 4;
/**
 * Sector intensity ceiling for the 4 Bft door. Wider than the 5 Bft `OFFSHORE_FLAT_MAX_INTENSITY`
 * because that constant excluded Μελιδόνι at 15,1 — and still well inside the «Προστατευμένη»
 * band, which runs to 33 (utils/geospatialExposureModel).
 */
export const GLASS_AT_FOUR_MAX_INTENSITY = 25;
/**
 * The sea must be genuinely quiet AT THE SHORE — `utils/waveCharacter.shoreSeaStateM` of the
 * steepness-adjusted severity, which is the EXACT number the colour ceiling judges by.
 *
 * ⚠️ THE FIRST DRAFT TESTED THE OPEN-WATER NUMBER AND WAS SELF-DEFEATING. Μελιδόνι's marine
 * sample sits 3,46 km out along `facingDeg`, and with the wind offshore the waves there are
 * travelling AWAY from the beach (onshore −0,64, our own SMB shore model 0,00 m). Read raw, that
 * sample said 0,54 m and closed the door on the very beach the door was written for. The sample
 * is downwind by construction whenever this gate passes — that is the whole premise of
 * `hasDownwindSeaSample` below — so judging the shore by it unclipped is asking the wrong
 * question. `shoreSeaStateM` is the answer the rest of the app already uses (Μελιδόνι:
 * 0,54 → 0,27) and reusing it means the door and the ceiling cannot disagree about the water.
 *
 * 0,40 m is not a tuned number: it is HALF the amber line (`SEA_STATE_AMBER_M = 0,8`), the point
 * below which the ceiling stops having any opinion. Since this door is the only thing in the app
 * that can print «Ιδανική» at 4 Bft, it may only do so where the sea is not merely "allowed" but
 * demonstrably small.
 */
export const GLASS_AT_FOUR_MAX_SEA_STATE_M = 0.4;

/**
 * True when a 4 Bft wind is blowing off the land over zero fetch AND the water reaching the shore
 * is genuinely quiet — the only case where this app calls a 4 Bft shore «Ιδανική».
 *
 * `seaStateM` is the OPEN-WATER steepness-adjusted severity; the shore discount is applied here
 * from the same `exposureLevel` / `seaArrivalExposureLevel` the ceiling uses, so both surfaces
 * judge one number. An unknown sea closes the door: a rule that can only ever make things look
 * calmer must not fire on missing evidence.
 *
 * ⚠️ WHAT THE SHORE CLAUSE DOES AND DOES NOT BUY — MEASURED, NOT ASSUMED. Every protected shore
 * takes the ×0,5 damping (utils/waveCharacter.SHORE_DAMPING_BY_EXPOSURE), so «below 0,40 m at the
 * shore» is arithmetically «below 0,80 m open water» — the amber line the ceiling already
 * enforces. Nationally it therefore excluded NOTHING the ceiling would not have caught anyway
 * (191 beach-days with the clause, 191 without). It is kept because it is the clause that makes
 * the door's promise true where the damping factors ever change, but it is NOT the safety net,
 * and nobody should read it as one.
 *
 * THE CLAUSE THAT DOES THE WORK IS THE SWELL VETO. Short-period chop measured out on the open
 * fetch is genuinely not at this beach — it is being blown away from it. A SWELL is the opposite:
 * ground swell wraps around headlands against the wind and arrives at exactly the lee shores this
 * door serves. So any meaningful swell — the same `SWELL_MIN_HEIGHT_M` gate `hasDownwindSeaSample`
 * uses, and an unknown reading with it — closes the door outright, whatever the geometry says.
 */
export const holdsGlassWaterAtFourBeaufort = ({
  profile,
  windDirectionDeg,
  beaufort,
  seaStateM,
  swellWaveHeightM,
  exposureLevel,
  seaArrivalExposureLevel,
  curatedWindOnlyProtection,
  shoreShadowDamping,
}: OffshoreFlatWaterInput & {
  seaStateM?: number;
  /** Live swell height at this beach's marine sample point, metres. Unknown vetoes. */
  swellWaveHeightM?: number;
  exposureLevel?: string;
  seaArrivalExposureLevel?: string;
  /**
   * Curated-cove shelter is documented against the WIND only — see
   * utils/waveCharacter.shoreSeaStateM. Measured 20/08/2026 this gate never fires on those 29
   * sectors anyway (they run intensity 33,0-59,6, this door needs ≤25), so threading it changes
   * nothing today; it is here so the next person cannot reintroduce the gap by relaxing the
   * intensity ceiling without noticing.
   */
  curatedWindOnlyProtection?: boolean;
  /** Η γωνιακή έκπτωση σκιάς K_d του score — passed, not derived (utils/seaArrival, 24/08/2026). */
  shoreShadowDamping?: number;
}): boolean => {
  if (beaufort !== GLASS_AT_FOUR_BEAUFORT) return false;
  if (typeof swellWaveHeightM !== 'number' || !Number.isFinite(swellWaveHeightM)) return false;
  if (swellWaveHeightM >= SWELL_MIN_HEIGHT_M) return false;
  const atShoreM = shoreSeaStateM(seaStateM, exposureLevel, seaArrivalExposureLevel, curatedWindOnlyProtection, shoreShadowDamping);
  if (typeof atShoreM !== 'number' || !Number.isFinite(atShoreM)) return false;
  if (atShoreM >= GLASS_AT_FOUR_MAX_SEA_STATE_M) return false;
  return sectorHoldsNoWindWave(profile, windDirectionDeg, {
    maxIntensity: GLASS_AT_FOUR_MAX_INTENSITY,
    requireAngle: false,
  });
};

/**
 * THE MARINE SAMPLE POINT IS DOWNWIND OF THIS BEACH — ITS SEA IS LEAVING, NOT ARRIVING.
 *
 * Σχοινιάς, 10/08/2026: a 5–6 Bft northerly off the land, 0,2 km of fetch, a webcam showing
 * glass — and an orange pin, because the sea-state ceiling read 1,3 μ. from the beach's
 * marineSamplePoint 9,4 km SOUTH, where that same northerly has the whole South Evoian Gulf to
 * work with. The sample point sits along `facingDeg` by construction (utils/marineSamplePoints),
 * so when the onshore gate below passes (wind >143° off head-on) the wind is blowing FROM the
 * beach TOWARD the sample point: waves there are being driven away from this shore and do not
 * come back against the wind.
 *
 * Measured nationally 10/08/2026 (live, 2.557 beaches × 12 h — .tmp/downwind-ceiling-
 * measurement.json): 222 beaches (8,7%) wore a rougher colour than their own water for at least
 * one hour; 73% of the changed hours were orange→yellow on the meltemi lee coasts (Κάρπαθος,
 * Μύκονος, Τήνος, Μήλος).
 *
 * WHAT THIS FLAG MAY BUY, and what it may not: consumed only by utils/suitabilityTone, where it
 * widens the sea-ceiling relief from one rung to two — red→yellow instead of red→orange. It can
 * NEVER remove the ceiling entirely: the same national measurement found 426 hour-combinations
 * that a full skip would have painted BLUE under a 0,8–1,4 μ. open sea (Κεδρόδασος-class, where
 * the "wind wave" at the sample point may be travelling shoreward from a different fetch). Blue
 * over a running sea is the exact false calm the house rule forbids, so the two-rung form was
 * chosen (Miltos, 10/08/2026) and the never-blue property is structural in CEILING_ORDER.
 *
 * No Beaufort gate, deliberately — unlike the colour lift above. At ≥6 Bft the wind tone is
 * already orange/red and a yellow ceiling cannot lift it; below 5 the relief only softens what
 * the distant sample claimed. The swell veto is the load-bearing safety line: ground swell wraps
 * around headlands against the wind, so ANY meaningful swell (≥ SWELL_MIN_HEIGHT_M, height alone
 * — direction unknown must still veto) means the distant reading may genuinely be arriving, and
 * the ceiling keeps its full say. An unknown swell reading also vetoes: no relief without
 * evidence.
 */
export const hasDownwindSeaSample = ({
  profile,
  windDirectionDeg,
  swellWaveHeightM,
}: {
  profile?: GeospatialExposureProfile;
  /** Degrees the wind comes FROM, at THIS beach — not the region's. */
  windDirectionDeg?: number;
  /** Live swell height at this beach's marine sample point, metres. */
  swellWaveHeightM?: number;
}): boolean => {
  if (typeof swellWaveHeightM !== 'number' || !Number.isFinite(swellWaveHeightM)) return false;
  if (swellWaveHeightM >= SWELL_MIN_HEIGHT_M) return false;
  return sectorHoldsNoWindWave(profile, windDirectionDeg);
};
