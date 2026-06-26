/**
 * Afternoon wind build (roadmap #4, 2026-06-27). The headline beach verdict is driven
 * by the ~13:00 representative wind, but the Aegean meltemi peaks 14:00-18:00 — peak
 * beach time AND peak wind. A day that is calm at noon but 5-6 Bft by mid-afternoon must
 * not read "good/calm". This pure helper decides when the build is significant enough to
 * escalate the per-beach comfort + warn. (By design it does NOT recolour the map, which
 * stays at the representative/selected hour — the hour slider already shows the afternoon.)
 */
export const AFTERNOON_BUILD_MIN_PEAK_BFT = 4;   // the afternoon peak must reach genuinely windy
export const AFTERNOON_BUILD_MIN_DELTA_BFT = 2;  // and be clearly above the midday sample (a real build)

export interface AfternoonBuild {
  peakBeaufort: number;
  buildBeaufort: number;
  buildsRough: boolean;
}

/**
 * @param afternoonBeauforts Beaufort values over the building window (~13:00-18:00).
 * @param middayBeaufort     the ~13:00 representative Beaufort the headline already used.
 * Returns buildsRough=true only when the afternoon both reaches a windy peak AND climbs
 * clearly above midday — so it never fires on an already-windy noon or a flat day, and is
 * a no-op when there is no afternoon hourly data.
 */
export const evaluateAfternoonBuild = (afternoonBeauforts: number[], middayBeaufort: number): AfternoonBuild => {
  if (afternoonBeauforts.length === 0) return { peakBeaufort: middayBeaufort, buildBeaufort: 0, buildsRough: false };
  const peakBeaufort = Math.max(...afternoonBeauforts);
  const buildBeaufort = peakBeaufort - middayBeaufort;
  const buildsRough = peakBeaufort >= AFTERNOON_BUILD_MIN_PEAK_BFT && buildBeaufort >= AFTERNOON_BUILD_MIN_DELTA_BFT;
  return { peakBeaufort, buildBeaufort, buildsRough };
};
