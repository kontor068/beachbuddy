import type { LanguageCode } from '../types';

/**
 * Per-beach monthly climatology from Copernicus Marine, lazy-loaded per region.
 *
 * Source corpora (build-time only, never fetched by the app):
 *   data/waveClimatology.generated.json   MEDSEA_MULTIYEAR_WAV_006_012, 4,2 km monthly
 *   data/waterClimatology.generated.json  cmems_SST_MED_SST_L4_REP_OBSERVATIONS_010_021
 * Trimmed to two numbers per month by scripts/splitBeachClimate.mjs — 3,4 KB per region.
 *
 * What it is FOR: the one line on the beach page that answers "is today a good day to
 * be here, or is this just what this beach is like?". A visitor cannot tell whether
 * 0,4 m is calm or normal without knowing the beach; this does.
 *
 * What it must NOT become: a claim about the cove. The cell is 4,2 km and shelter
 * happens in the last 1–2 km, so this compares OPEN-WATER today against OPEN-WATER
 * normal, and says nothing about geometry (docs/team/06 §🔭).
 */

interface BeachClimateEntry {
  /** Typical significant wave height per month, metres. Months 5–10. */
  wave?: Record<string, number>;
  /** Median sea-surface temperature per month, °C. Months 5–10. */
  water?: Record<string, number>;
}

type RegionClimate = Record<string, BeachClimateEntry>;

// Vite turns each glob entry into its own async chunk; the per-region promise is cached
// so repeat views on the same island reuse the first fetch. Same pattern as beachStories.
const regionClimateLoaders = import.meta.glob<{ default: RegionClimate }>('./beachClimate/*.json');
const regionClimateCache = new Map<string, Promise<RegionClimate>>();

const loadRegionClimate = (region: string): Promise<RegionClimate> => {
  const cached = regionClimateCache.get(region);
  if (cached) return cached;
  const loader = regionClimateLoaders[`./beachClimate/${region}.json`];
  const promise = loader
    ? loader().then((m) => m.default ?? ({} as RegionClimate)).catch(() => ({}) as RegionClimate)
    : Promise.resolve({} as RegionClimate);
  regionClimateCache.set(region, promise);
  return promise;
};

export const getBeachClimate = async (
  beachId: number | string,
  regionId?: string | null,
): Promise<BeachClimateEntry | null> => {
  if (!regionId) return null;
  const region = await loadRegionClimate(regionId);
  return region[String(beachId)] ?? null;
};

export type ClimateComparisonTone = 'better' | 'typical' | 'worse';

export interface ClimateComparison {
  text: string;
  tone: ClimateComparisonTone;
}

/**
 * Greek needs the month in two cases and the difference is visible: "από τον συνηθισμένο
 * Ιούλιο" (accusative) but "όπως είναι συνήθως ο Ιούλιος" (nominative). Printing one form
 * everywhere produced "ο Ιούλιο", which reads as a typo and undermines a sentence whose
 * whole value is sounding authoritative. Every other language uses one form.
 */
const MONTH_NAMES_NOMINATIVE: Partial<Record<LanguageCode, string[]>> = {
  gr: ['', 'Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
};

const MONTH_NAMES: Record<LanguageCode, string[]> = {
  en: ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  gr: ['', 'Ιανουάριο', 'Φεβρουάριο', 'Μάρτιο', 'Απρίλιο', 'Μάιο', 'Ιούνιο', 'Ιούλιο', 'Αύγουστο', 'Σεπτέμβριο', 'Οκτώβριο', 'Νοέμβριο', 'Δεκέμβριο'],
  de: ['', 'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  it: ['', 'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre'],
  fr: ['', 'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
};

const num = (value: number, language: LanguageCode, digits: number) => {
  const s = value.toFixed(digits);
  return language === 'gr' || language === 'de' || language === 'it' || language === 'fr'
    ? s.replace('.', ',')
    : s;
};

const WAVE_COPY: Record<LanguageCode, {
  calmer: (month: string, normal: string) => string;
  rougher: (month: string, normal: string) => string;
  typical: (month: string, normal: string) => string;
}> = {
  en: {
    calmer: (m, n) => `Calmer than a normal ${m} here — usually around ${n} m.`,
    rougher: (m, n) => `Rougher than a normal ${m} here — usually around ${n} m.`,
    typical: (m, n) => `About what ${m} normally looks like here (~${n} m).`,
  },
  gr: {
    calmer: (m, n) => `Πιο ήρεμα από τον συνηθισμένο ${m} εδώ — κανονικά γύρω στα ${n} μ.`,
    rougher: (m, n) => `Πιο ταραγμένα από τον συνηθισμένο ${m} εδώ — κανονικά γύρω στα ${n} μ.`,
    typical: (m, n) => `Περίπου όπως είναι συνήθως ο ${m} εδώ (~${n} μ.).`,
  },
  de: {
    calmer: (m, n) => `Ruhiger als ein normaler ${m} hier — sonst etwa ${n} m.`,
    rougher: (m, n) => `Rauer als ein normaler ${m} hier — sonst etwa ${n} m.`,
    typical: (m, n) => `Etwa so, wie der ${m} hier normalerweise ist (~${n} m).`,
  },
  it: {
    calmer: (m, n) => `Più calmo di un ${m} normale qui — di solito circa ${n} m.`,
    rougher: (m, n) => `Più mosso di un ${m} normale qui — di solito circa ${n} m.`,
    typical: (m, n) => `Come di solito è ${m} qui (~${n} m).`,
  },
  fr: {
    calmer: (m, n) => `Plus calme qu'un ${m} normal ici — d'habitude environ ${n} m.`,
    rougher: (m, n) => `Plus agité qu'un ${m} normal ici — d'habitude environ ${n} m.`,
    typical: (m, n) => `À peu près comme ${m} d'habitude ici (~${n} m).`,
  },
};

const WATER_COPY: Record<LanguageCode, (month: string, normal: string) => string> = {
  en: (m, n) => `Water is about normal for ${m} here (~${n}°C).`,
  gr: (m, n) => `Το νερό είναι περίπου στα κανονικά που έχει εδώ ο ${m} (~${n}°C).`,
  de: (m, n) => `Das Wasser ist etwa normal für ${m} hier (~${n}°C).`,
  it: (m, n) => `L'acqua è circa nella norma per ${m} qui (~${n}°C).`,
  fr: (m, n) => `L'eau est à peu près normale pour ${m} ici (~${n}°C).`,
};

/**
 * Compare today's OPEN-WATER wave height against this beach's normal for the month.
 *
 * Two guards that are load-bearing, not defensive noise:
 *  1. The caller must pass the wave height BEFORE any cove correction. Comparing a
 *     cove-corrected figure against an open-water climatology would print "calmer than
 *     usual" on every enclosed bay, every single day — a permanent false compliment.
 *  2. Both a ratio AND an absolute gap must clear. At 0,2 m a 40% difference is 0,08 m,
 *     which is inside the noise of two different wave models; saying anything there
 *     would be inventing precision.
 */
export const describeClimateComparison = (
  climate: BeachClimateEntry | null,
  {
    openWaterWaveHeightM,
    seaTemperatureC,
    date,
    language,
  }: {
    openWaterWaveHeightM: number | null | undefined;
    seaTemperatureC: number | null | undefined;
    date: Date;
    language: LanguageCode;
  },
): ClimateComparison | null => {
  if (!climate) return null;
  const month = date.getMonth() + 1;
  const monthKey = String(month);
  const monthName = (MONTH_NAMES[language] ?? MONTH_NAMES.en)[month] ?? '';
  const monthNameNominative = MONTH_NAMES_NOMINATIVE[language]?.[month] ?? monthName;
  const copy = WAVE_COPY[language] ?? WAVE_COPY.en;

  const normalWave = climate.wave?.[monthKey];
  if (
    typeof normalWave === 'number' &&
    normalWave > 0 &&
    typeof openWaterWaveHeightM === 'number' &&
    Number.isFinite(openWaterWaveHeightM)
  ) {
    const ratio = openWaterWaveHeightM / normalWave;
    const gap = Math.abs(openWaterWaveHeightM - normalWave);
    const normal = num(normalWave, language, 1);
    if (ratio <= 0.72 && gap >= 0.15) return { text: copy.calmer(monthName, normal), tone: 'better' };
    if (ratio >= 1.38 && gap >= 0.2) return { text: copy.rougher(monthName, normal), tone: 'worse' };
    return { text: copy.typical(monthNameNominative, normal), tone: 'typical' };
  }

  // No usable wave climatology (84 beaches nationally) — fall back to water temperature,
  // which exists for all 2.850. Only ever printed as "normal": we have not established
  // that an anomaly at 8 km resolution means anything at one beach.
  const normalWater = climate.water?.[monthKey];
  if (
    typeof normalWater === 'number' &&
    typeof seaTemperatureC === 'number' &&
    Number.isFinite(seaTemperatureC) &&
    Math.abs(seaTemperatureC - normalWater) <= 1.5
  ) {
    return {
      text: (WATER_COPY[language] ?? WATER_COPY.en)(monthNameNominative, num(normalWater, language, 1)),
      tone: 'typical',
    };
  }

  return null;
};
