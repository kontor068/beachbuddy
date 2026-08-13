import type { GeospatialExposureProfile, WindSector } from '../types';
import { estimateFetchLimitedWaveHeightM } from './waveModel';

/**
 * ΤΟ ΚΥΜΑ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΕΙΝΑΙ ΜΕΓΑΛΥΤΕΡΟ ΑΠ' ΟΣΟ ΧΩΡΑΕΙ Ο ΚΟΛΠΟΣ.
 *
 * THE PROBLEM. Σχίσμα Ελούντας, 13/08/2026: a live webcam showing glass and a full beach while
 * the page printed 0,94 μ. That figure is the marine grid's, read 13,8 km NNE at 35,375/25,79 —
 * out in the open Mirabello, where the same 40 km/h westerly has the whole gulf to work with.
 * The beach itself sits behind it with 2,56 km of water in its most open direction and 0,02 km
 * in the direction the wind was actually coming from.
 *
 * WHY THE THREE EXISTING NETS ALL STAYED SILENT, and why that is not a bug in any of them.
 * utils/coveWaveGuard, utils/shoreWave and utils/offshoreFlatWater all answer the same question —
 * "is the wind blowing OFF this shore?" — and all three demand a nearly head-on offshore bearing
 * (onshore ≥ 0,2 for the cove path; ≤ −0,8 for the other two). Σχίσμα's wind met the shore 128,5°
 * off head-on (onshore −0,61), an oblique offshore, and failed all three by the same margin. Each
 * gate is right about its own question. None of them asks THIS one.
 *
 * WHAT THIS ASKS INSTEAD, and why it is the safe generalisation. Not "where is the wind coming
 * from" but "how much open water does this beach have AT ALL". The ray-caster fires a ±30° fan of
 * five rays per sector out to 25 km (public/data/geospatial/exposure settings.maxFetchKm); when
 * all forty of them hit land, there is no bearing on the compass from which a long-fetch sea can
 * arrive. The ceiling is then our own SMB height over the LONGEST fetch the beach has in ANY
 * direction — the biggest wave today's wind could build even if it blew from the most open side.
 *
 * THIS IS DIRECTIONALLY BLIND ON PURPOSE. The shadowing rule removed from utils/waveModel (see the
 * note above capLightWindMeasuredWaveM) died because its two locks — "offshore bearing" and "short
 * fetch" — both came from the same pin and the same facingDeg, so one wrong facing turned both at
 * once. This ceiling never reads facingDeg or the wind bearing at all. A misread shoreline normal
 * cannot move it. The only input that can is the fetch fan itself, and it has to be wrong in all
 * eight sectors simultaneously for the ceiling to be too low.
 *
 * ⚠️ GEOMETRY ALONE IS NOT ENOUGH, AND WE LEARNED THAT THE HARD WAY ON THE FIRST DRAFT. Six Νάουσα
 * bay beaches on Πάρος — Κολυμπήθρες, Κριός, Λάγγερη, Λίμνες, Μαρτσέλο, Μοναστήρι — carry exactly
 * this signature (blocked = 1 in all eight sectors, 1,5–2,7 km of fetch) while sitting in a bay
 * that opens 2,5 km wide to the north Aegean. The first draft turned a 5 Bft meltemi day on Πάρος
 * into ideal swimming; scripts/validateRecommendationScenarios caught it before it shipped.
 *
 * THE REASON IS NOT BAD PINS — that theory was tested and killed. OSM places "Κολυμπήθρες" at
 * 37.12932/25.21536, byte-identical to ours; the beach genuinely sits in the sheltered south-west
 * corner of an open bay. Rays travel in straight lines, sea does not: a wave entering a bay mouth
 * spreads inside it and reaches corners no straight line connects to open water. That is the whole
 * defect, and it is the same lesson the enclosed-cove classifier already carries.
 *
 * WHAT ADMITS A BEACH, measured on the rasterised coastline by scripts/auditEnclosedWater.mjs:
 *   1. A REAL CONSTRICTION EXISTS. Widest-path search from the middle of the beach's water out to
 *      open sea; if the narrowest point of that route is the starting cell, nothing ever pinched
 *      and this is an open coast whatever the ray fan says about the cove the pin sits in. 44 of
 *      the 65 geometric candidates are open coast — including Μαντροκλήσι Τήνου, whose 1,60 μ.
 *      reading we had wrongly filed as an error to fix.
 *   2. THE BEACH SITS AT LEAST 2 GAP-WIDTHS BEHIND THAT MOUTH. Energy entering a gap of width W
 *      spreads as it travels, so depth / W is the number that matters, not W. Αστέρια 7,0 ·
 *      Ελούντα 4,8 · Σχίσμα 3,5 · Λιβάρι 3,0, against the Νάουσα adversary at 1,37 and below and
 *      open Παλαιοχώρι Μήλου at 0,57.
 *
 * ⚠️ FOUR EARLIER RULES DIED HERE. Keep them dead unless new measurement says otherwise:
 * mouth width alone (admitted Λούτσα at ratio 0,5, rejected Λιβάρι at 3,0 — exactly backwards);
 * distance to the nearest marine cell (answers "has the model sampled here", not "can a wave get
 * here" — Σταυρός Χανίων is 13,3 km from a cell and is open coast); a neighbourhood fetch sweep
 * (64 of 65 saturate at 25 km); and the national pin audit's signals (they flag three of the six
 * Νάουσα beaches but also flag Ελούντα, a true enclosure).
 *
 * ⚠️ AND THE HEADLINE NUMBER FROM THE FIRST DAY WAS WRONG. "55 of 65 beaches are shown a sea their
 * geometry cannot hold" measured the wave against LOCAL fetch, which says nothing about a wave
 * arriving from outside. Once open coasts are excluded only 9 beaches qualify, and the 56 rejected
 * ones are not a backlog — their grid readings are defensible.
 *
 * UNLIKE THE OTHER THREE, THIS ONE IS NOT DISPLAY-ONLY (decided by Miltos, 13/08/2026). It caps
 * `effectiveWaveHeightM` itself, so the number, the colour, the verdict and the score all move
 * together. The reason display-only was right for the cove guard is that the cove guard SUBSTITUTES
 * a modelled height for a measured one; this only removes a height that is physically impossible,
 * and leaving the colour bound to an impossible wave is how the page ends up printing «κύμα 0,15 μ.»
 * above «προσοχή» — the card/pin disagreement that has burned us before.
 */

const SECTORS: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Every one of the eight sectors must be FULLY land-blocked. Not 0,95, not "most" — every ray.
 * This is the whole safety argument: one open sector means a sea can arrive from somewhere and the
 * longest-fetch ceiling stops being an upper bound.
 */
export const CEILING_REQUIRED_BLOCKED_RATIO = 1;
/**
 * Above this the beach has a real open-water corridor and the grid reading may well be honest.
 * 3 km is where our own SMB stops being obviously smaller than a summer Aegean sea: at 6 Bft it
 * already returns 0,45 μ., so a ceiling computed there would rarely bind and would only add risk.
 */
export const CEILING_MAX_FETCH_KM = 3;
/**
 * Below this the profile is describing something that is not a beach — a pin dropped inland, a
 * lagoon, the wrong side of a mole. Παραλία Γαλάνης Νέστου (id 859) reads 0,00 km in all eight
 * sectors, which is a broken pin, not a cove, and must never earn a calm claim. The ray step is
 * 0,2 km (settings.stepKm), so this is also the smallest fetch the caster can actually resolve.
 */
export const CEILING_MIN_FETCH_KM = 0.2;
/**
 * Gust allowance, in metres, added on top of the SMB height. SMB models a steady wind building a
 * fetch-limited sea; a gust does not last long enough to build one, but it does put chop on the
 * surface. Deliberately the same magnitude the app already uses for exactly this (the gust bump in
 * utils/waveModel.getWindChopWaveFloorM), rather than a new invented constant. Running SMB on the
 * gust SPEED instead was measured and rejected: at Σχίσμα's 75 km/h gust it returns 0,85 μ. against
 * a 0,94 μ. grid reading, i.e. the ceiling would never bind and the fix would do nothing.
 */
export const CEILING_GUST_ALLOWANCE_M = 0.1;

/**
 * Beaches whose water is proven cut off from the open sea: the eight-sector geometry above, a real
 * constriction on the way out, and at least 2 gap-widths of depth behind it. Generated, not
 * hand-picked, by scripts/auditEnclosedWater.mjs; every entry carries the numbers it was admitted
 * on. Regenerate after a geometry rebuild or a pin move.
 *
 * Validated against the same adversary throughout: no Νάουσα-bay beach passes. Four of the six are
 * open coast outright; Λίμνες and Μαρτσέλο have a mouth but sit only 1,37 and 0,86 gap-widths
 * behind it.
 */
export const VERIFIED_ENCLOSED_WATER_IDS = new Set<number>([
  152, // ÎÎ¹Î¼Î±Î½Î¬ÎºÎ¹ ÏÎ·Ï ÎÎ³Î¬ÏÎ·Ï [attica-poros] â mouth 600 m, 1.92 km deep = 3.2 gap-widths, fetch 2.2 km
  158, // ÎÎµÎ³Î¬Î»Î¿ ÎÎµÏÏÎ¹Î¿ [attica-poros] â mouth 600 m, 2.46 km deep = 4.1 gap-widths, fetch 2.4 km
  159, // ÎÎ¹ÎºÏÏ ÎÎµÏÏÎ¹Î¿ [attica-poros] â mouth 600 m, 2.98 km deep = 4.96 gap-widths, fetch 1.08 km
  161, // Î¡ÏÏÎ¹ÎºÎ¿Ï ÎÎ±ÏÏÏÎ±Î¸Î¼Î¿Ï [attica-poros] â mouth 600 m, 1.5 km deep = 2.5 gap-widths, fetch 2 km
  265, // ÎÏÏÎ­ÏÎ¹Î± [central-greece-evia] â mouth 300 m, 2.1 km deep = 7 gap-widths, fetch 1.28 km
  464, // ÎÎ¹Î²Î¬ÏÎ¹ [central-macedonia-halkidiki] â mouth 849 m, 2.55 km deep = 3.01 gap-widths, fetch 2.12 km
  767, // Î£ÏÎ¯ÏÎ¼Î± [crete-crete-lasithi] â mouth 724 m, 2.56 km deep = 3.54 gap-widths, fetch 2.56 km
  2255, // Î ÎµÎ¶ÏÎ½ÏÎ± [south-aegean-kalymnos] â mouth 424 m, 0.91 km deep = 2.15 gap-widths, fetch 0.44 km
  3010, // ÎÎ»Î¿ÏÎ½ÏÎ± [crete-crete-lasithi] â mouth 600 m, 2.9 km deep = 4.83 gap-widths, fetch 2.6 km
]);

export interface GeometricWaveCeilingInput {
  profile?: GeospatialExposureProfile;
  /** Live wind speed at the beach, km/h — the SMB input. */
  windSpeedKmh?: number;
  gustKmph?: number;
  /** Untrusted geometry must never produce a calm claim. */
  suspectPin?: boolean;
  /**
   * True when meaningful swell can ACTUALLY REACH this shore, or when a meaningful swell exists
   * with unknown direction. Ground swell wraps around headlands into water the wind cannot reach,
   * which is the one way a fetch argument can be wrong — SMB models local wind-sea only. Callers
   * pass utils/swellExposure's onshore-aware value, same as utils/shoreWave.
   */
  arrivingSwellPresent?: boolean;
}

export interface GeometricWaveCeiling {
  /** The largest wave this beach's geometry can hold at the live wind, metres. */
  ceilingM: number;
  /** Longest fetch in any of the eight sectors, km — what the ceiling was computed over. */
  maxFetchKm: number;
}

/**
 * The ceiling, or `undefined` when this beach has not earned one. `undefined` is the normal
 * answer and means "behave exactly as before"; callers must never substitute a fallback.
 */
export const resolveGeometricWaveCeiling = ({
  profile,
  windSpeedKmh,
  gustKmph,
  suspectPin,
  arrivingSwellPresent,
}: GeometricWaveCeilingInput): GeometricWaveCeiling | undefined => {
  if (arrivingSwellPresent) return undefined;
  if (suspectPin) return undefined;
  if (!profile || profile.confidence !== 'high') return undefined;
  // The second witness. Geometry that looks enclosed but sits in water the marine grid does sample
  // is the Νάουσα-bay class — see the header. Checked before the fetch arithmetic so a beach that
  // is not on the list costs nothing.
  if (!VERIFIED_ENCLOSED_WATER_IDS.has(profile.beachId)) return undefined;
  if (typeof windSpeedKmh !== 'number' || !Number.isFinite(windSpeedKmh)) return undefined;

  const sectors = SECTORS.map(s => profile.sectors?.[s]);
  if (sectors.some(s => !s || typeof s.fetchKm !== 'number' || typeof s.blockedRayRatio !== 'number')) {
    return undefined;
  }
  // Land on every bearing, or there is no upper bound to claim.
  if (sectors.some(s => s!.blockedRayRatio < CEILING_REQUIRED_BLOCKED_RATIO)) return undefined;

  const maxFetchKm = Math.max(...sectors.map(s => s!.fetchKm));
  if (!(maxFetchKm >= CEILING_MIN_FETCH_KM) || maxFetchKm > CEILING_MAX_FETCH_KM) return undefined;

  const gusty = typeof gustKmph === 'number' && Number.isFinite(gustKmph) && gustKmph > windSpeedKmh;
  const smbM = estimateFetchLimitedWaveHeightM({ windSpeedKmh, fetchKm: maxFetchKm });
  const ceilingM = Number((smbM + (gusty ? CEILING_GUST_ALLOWANCE_M : 0)).toFixed(2));

  return { ceilingM, maxFetchKm: Number(maxFetchKm.toFixed(2)) };
};
