import type { MarineForecast } from '../types';

/**
 * WHICH WAVE MODEL EACH HOUR COMES FROM.
 *
 * This is decision-grade logic — it chooses the number that drives every sea verdict, colour
 * and ranking in the app — so it lives in its own dependency-free module rather than inside the
 * network service. That is not tidiness: services/weatherService.ts pulls in the analytics and
 * provider modules, and a guard that wants to prove this behaviour has to load that whole graph
 * to reach one pure function. Here it is importable on its own.
 *
 * THE RULE: `ewam` (DWD, 0.05° ≈ 5 km) wins every hour it reports a wave height;
 * `meteofrance_wave` (0.08° ≈ 8 km, global, 7 days) covers the rest.
 *
 * Why ewam leads, measured 2026-07-31 against 9,723 QC-good hourly observations from three
 * Greek buoys (Ηράκλειο, 61277, Άθως — Copernicus In Situ, 2022-09 → 2024-12):
 *
 *                       bias vs buoy      RMSE       dangerous underestimates (>0.4 m, >=5 Bft)
 *   meteofrance_wave    -0.07 m (-8.2%)   0.203 m    204
 *   ewam                +0.01 m (+1.7%)   0.184 m     62
 *
 * The model this app shipped for a year UNDER-reads the sea at every buoy, by up to -23.9% in
 * strong wind. That inverted the assumption the previous design rested on — meteofrance_wave was
 * treated as the cautious choice and is in fact the optimistic one.
 *
 * The defect that started it: at 0.08° a Greek island spans 1-2 grid cells, so the model cannot
 * tell a windward shore from its lee. Over 496 meltemi cases the N-vs-S coast difference was
 * 0.05 m for meteofrance_wave (identical in 290 of them) against 1.11 m for ewam, correct sign
 * 496/496. Not a calibration gap: over 15 open-water points >25 km from land (1,022 hours) the
 * two agree to -0.5%. It is purely resolution.
 *
 * THE SAFETY NET IS NOT HERE. utils/waveModel.resolveEffectiveWaveHeightM still takes the LARGER
 * of the measurement and this app's own fetch-limited SMB + wind-chop floor, and that floor is
 * computed without reference to any of these models. No wave model, however well it scores
 * against a buoy, can print flat water over a shore our own physics calls choppy.
 */

export interface MarineHourlyRow {
  dt_txt: string;
  marine: MarineForecast;
}

const optionalNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

/**
 * Shape one Open-Meteo Marine `hourly` block into rows, choosing a model per hour.
 *
 * `preferModelId` flips which model leads for THIS point only. Omit it and nothing changes.
 */
export const parseMarineHourly = (
  marineHourly: any,
  preferModelId?: 'ewam' | 'meteofrance_wave',
): MarineHourlyRow[] => {
  if (!marineHourly?.time || !Array.isArray(marineHourly.time)) {
    throw new Error('Marine fetch failed: missing hourly data');
  }

  // Open-Meteo renames every field to `<field>_<model>` as soon as MORE THAN ONE model is
  // requested, and leaves it bare when exactly one is. We ask for three, so the suffixed name is
  // the normal case and the bare name is the fallback.
  //
  // The fallback is load-bearing, not defensive decoration: the edge proxy caches marine
  // responses with s-maxage=10800 + stale-while-revalidate=1800 (netlify/functions/forecast.mjs,
  // CDN_MAX_AGE_S.marine and CDN_STALE_WHILE_REVALIDATE_S), so for up to ~3.5h after a deploy
  // that changes the model list the CDN keeps serving the PREVIOUS shape. Without the bare-name
  // fallback, every wave reading would read undefined for that whole window.
  // (Corrected 05/08/2026 — this said 1800/3600 and «~1.5h», neither of which had been true
  // since the per-route cache split on 31/07.)
  const series = (field: string, model: string): unknown[] | undefined =>
    marineHourly[`${field}_${model}`] ?? marineHourly[field];

  // Written out one literal series('<field>', '<model>') call at a time, deliberately: the build
  // gate (scripts/validateMarineModelParsing.mjs) reads these statically to prove every requested
  // variable is parsed from a PINNED model. A tidier `waveSeries(field)` helper hides the field
  // names from that check and the gate goes blind — it flagged exactly that on 2026-07-31.
  // Verbosity here buys a real guarantee.
  const waveHeightEwam = series('wave_height', 'ewam');
  const waveHeightMf = series('wave_height', 'meteofrance_wave');
  const waveDirectionEwam = series('wave_direction', 'ewam');
  const waveDirectionMf = series('wave_direction', 'meteofrance_wave');
  const wavePeriodEwam = series('wave_period', 'ewam');
  const wavePeriodMf = series('wave_period', 'meteofrance_wave');
  const swellHeightEwam = series('swell_wave_height', 'ewam');
  const swellHeightMf = series('swell_wave_height', 'meteofrance_wave');
  const swellDirectionEwam = series('swell_wave_direction', 'ewam');
  const swellDirectionMf = series('swell_wave_direction', 'meteofrance_wave');
  const swellPeriodEwam = series('swell_wave_period', 'ewam');
  const swellPeriodMf = series('swell_wave_period', 'meteofrance_wave');

  // Only meteofrance_currents carries SST; a wave model's own column is all-null, so the
  // bare-name fallback here resolves to that null column on pre-deploy cached responses — which
  // is correct, and simply hides the water-temperature card until the cache turns over.
  const seaTemperature = series('sea_surface_temperature', 'meteofrance_currents');

  // One model per hour, decided by whether ewam reported a HEIGHT for that hour. Every other
  // field follows that same decision, so height, direction and period always describe ONE sea —
  // utils/waveCharacter turns (height, period) into a single severity, so a mixed pair would
  // invent a sea neither model reported.
  // ΤΟ ΣΗΜΕΙΟ ΜΠΟΡΕΙ ΝΑ ΖΗΤΗΣΕΙ ΤΟ ΑΛΛΟ ΜΟΝΤΕΛΟ — ΚΑΙ ΜΟΝΟ ΓΙΑ ΕΝΑΝ ΛΟΓΟ.
  // Το ewam ηγείται παντού επειδή κέρδισε σε 9.723 ώρες σημαδούρας (βλ. κεφαλίδα). Σε 56
  // σημεία όμως το κελί του περιγράφει νερό που η παραλία ΔΕΝ βλέπει — πίσω από ακρωτήρι —
  // ενώ του meteofrance_wave όχι. Εκεί η καλύτερη βαθμολογία του ewam είναι άσχετη: μετράει
  // σωστά λάθος θάλασσα. Η λίστα φτιάχνεται από μέτρηση, όχι από κρίση, και αποκλείει ρητά
  // τις περιπτώσεις όπου το meteofrance θα έχανε τη διάκριση προσήνεμης/υπήνεμης ακτής —
  // scripts/bakeMarineModelPreference.mjs.
  const flipped = preferModelId === 'meteofrance_wave';
  const leading = flipped ? waveHeightMf : waveHeightEwam;
  const preferLeadingAt = (index: number): boolean => (
    optionalNumber(leading?.[index]) !== undefined
  );
  const pick = (index: number, ewam?: unknown[], fallback?: unknown[]): unknown => {
    const [first, second] = flipped ? [fallback, ewam] : [ewam, fallback];
    return preferLeadingAt(index) ? first?.[index] : second?.[index];
  };
  const modelAt = (index: number): 'ewam' | 'meteofrance_wave' => {
    if (preferLeadingAt(index)) return flipped ? 'meteofrance_wave' : 'ewam';
    return flipped ? 'ewam' : 'meteofrance_wave';
  };

  return marineHourly.time
    .map((timeStr: string, index: number): MarineHourlyRow => ({
      dt_txt: timeStr.replace('T', ' '),
      marine: {
        waveHeightM: optionalNumber(pick(index, waveHeightEwam, waveHeightMf)),
        waveDirectionDeg: optionalNumber(pick(index, waveDirectionEwam, waveDirectionMf)),
        wavePeriodS: optionalNumber(pick(index, wavePeriodEwam, wavePeriodMf)),
        swellWaveHeightM: optionalNumber(pick(index, swellHeightEwam, swellHeightMf)),
        swellWaveDirectionDeg: optionalNumber(pick(index, swellDirectionEwam, swellDirectionMf)),
        swellWavePeriodS: optionalNumber(pick(index, swellPeriodEwam, swellPeriodMf)),
        seaSurfaceTemperatureC: optionalNumber(seaTemperature?.[index]),
        waveModel: modelAt(index),
        source: 'open-meteo-marine',
      },
    }))
    .filter((item: MarineHourlyRow) => (
      item.marine.waveHeightM !== undefined ||
      item.marine.waveDirectionDeg !== undefined ||
      item.marine.wavePeriodS !== undefined ||
      item.marine.swellWaveHeightM !== undefined ||
      item.marine.swellWaveDirectionDeg !== undefined ||
      item.marine.seaSurfaceTemperatureC !== undefined
    ));
};
