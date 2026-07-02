export type BoatRideMotionLevel = 'smooth' | 'light' | 'bumpy' | 'rough';

const finiteNumber = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

/**
 * Presentation-only scale for boat-only beaches.
 * It does not change recommendation scoring; it translates the same forecast into ride motion.
 */
export const getBoatRideMotionLevel = (
  waveHeightM?: number,
  windBeaufort?: number
): BoatRideMotionLevel => {
  const height = finiteNumber(waveHeightM);
  const beaufort = finiteNumber(windBeaufort);

  // Wind (Beaufort) leads the ride motion a small-boat passenger actually feels, so the scale
  // maps one Beaufort per tier from 4 up (4→light, 5→bumpy, 6→rough) and keeps the top of the
  // scale for a genuine 6 Bft. Wave height only escalates a tier when the sea is genuinely built
  // — it can no longer make a breezy 4 Bft day look as dramatic as a 6 Bft one.
  if ((height !== undefined && height >= 1.4) || (beaufort !== undefined && beaufort >= 6)) return 'rough';
  if ((height !== undefined && height >= 0.9) || (beaufort !== undefined && beaufort >= 5)) return 'bumpy';
  // Light winds (≤3 Bft) mean a calm, ideal ride. A small residual swell under the bumpy
  // threshold is long-period and gentle for a boat, so it shouldn't be dressed up as motion.
  if (beaufort !== undefined && beaufort <= 3) return 'smooth';
  if ((height !== undefined && height >= 0.5) || (beaufort !== undefined && beaufort >= 4)) return 'light';
  return 'smooth';
};

export const getBoatRideMotionRank = (level: BoatRideMotionLevel): number => {
  switch (level) {
    case 'rough':
      return 3;
    case 'bumpy':
      return 2;
    case 'light':
      return 1;
    case 'smooth':
    default:
      return 0;
  }
};
