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

  if ((height !== undefined && height >= 1.0) || (beaufort !== undefined && beaufort >= 6)) return 'rough';
  if ((height !== undefined && height >= 0.6) || (beaufort !== undefined && beaufort >= 5)) return 'bumpy';
  if ((height !== undefined && height >= 0.3) || (beaufort !== undefined && beaufort >= 4)) return 'light';
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
