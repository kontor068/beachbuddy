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
/**
 * Above this peak a ONE-step build already counts.
 *
 * The +2 rule alone was far too tight to catch the pattern it was written for. Measured
 * 2026-07-31 over Open-Meteo hourly wind at 30 Greek coastal points × 7 days, restricted to
 * days whose 10:00–18:00 peak reaches ≥4 Bft (117 region-days):
 *
 *   peak +1 Bft above the 13:00 headline   17 (15%)
 *   peak +2 Bft — all the old gate caught    1 (1%)
 *   exactly +1, therefore MISSED            16 (14%)
 *
 * A 4 → 5 Bft afternoon is not a rounding detail: 5 Bft is where every colour and verdict rule
 * in the app switches band, and it is the difference between a swim and a wasted drive. Held to
 * peak ≥5 so a 3 → 4 day (ordinary summer breeze) still does not fire.
 *
 * The same measurement killed the other half of the idea: intra-day wind DIRECTION is stable
 * exactly on the days that decide anything (swing ≥45°: 2%, ≥90%: 0% on those 117 days), so
 * there is no per-hour re-evaluation of exposure to add here.
 */
export const AFTERNOON_BUILD_STRONG_PEAK_BFT = 5;

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
  const buildsRough = peakBeaufort >= AFTERNOON_BUILD_MIN_PEAK_BFT && (
    buildBeaufort >= AFTERNOON_BUILD_MIN_DELTA_BFT ||
    (peakBeaufort >= AFTERNOON_BUILD_STRONG_PEAK_BFT && buildBeaufort >= 1)
  );
  return { peakBeaufort, buildBeaufort, buildsRough };
};
