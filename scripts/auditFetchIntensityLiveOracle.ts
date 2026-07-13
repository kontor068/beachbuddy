/**
 * Stage 1b (physical oracle) of the geometry-classifier review (2026-07-13). Follows Stage 0/1a
 * (scripts/auditFetchIntensityDivergence.ts) — this script consumes its full harmful-collapse
 * list (.tmp/geospatial/harmful-collapse-full.json) and checks the stored classification against
 * an INDEPENDENT, live, third-party marine model (Open-Meteo marine-api) instead of an
 * app-internal formula, at whatever real hours in the next 6 days the wind actually blows into
 * the flagged sector.
 *
 * For each sampled beach: fetch a 6-day hourly wind+marine forecast (same endpoints/params
 * services/weatherService.ts already uses), find hours where the live wind direction falls
 * within the flagged sector's +-22.5 deg arc, and record the live marine wave_height at those
 * hours. If Open-Meteo independently reports rough water while the stored classification is
 * 'partial'/'protected' for that sector, that is real, external corroboration — not another
 * internal recomputation of the same formula.
 *
 * Network + free/no-key API (same Open-Meteo marine-api used in production), rate-limited by a
 * small delay between calls. Read-only: does not touch the app's data or scoring.
 *
 * Run via wrapper: node scripts/auditFetchIntensityLiveOracle.mjs [--sample 60] [--json <out>]
 */
import { readFileSync, writeFileSync } from 'node:fs';

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};
const harmfulInPath = parseArgValue('--harmful-json') || '.tmp/geospatial/harmful-collapse-full.json';
const jsonOutPath = parseArgValue('--json') || '.tmp/geospatial/fetch-intensity-live-oracle.json';
const sampleSize = Number(parseArgValue('--sample') || '60');

type WaveLevel = 'protected' | 'partial' | 'exposed';
const waveLevelOf = (m: number): WaveLevel => (m >= 0.8 ? 'exposed' : m >= 0.3 ? 'partial' : 'protected');
const LEVEL_RANK: Record<WaveLevel, number> = { protected: 0, partial: 1, exposed: 2 };

interface HarmfulEntry {
  regionId: string; beachId: number; name: string; lat: number; lon: number; sector: string;
  fetchKm: number; blockedRayRatio: number; onshore: number; storedIntensity: number; storedLevel: WaveLevel;
}

const SECTOR_CENTER_DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const SECTOR_ARC_DEG = 22.5;
const angularDistanceDeg = (a: number, b: number): number => Math.abs(((a - b + 540) % 360) - 180);

const all: HarmfulEntry[] = JSON.parse(readFileSync(harmfulInPath, 'utf8'));

// Spread the sample across regions (round-robin) rather than taking the first N, so a single
// region with many entries (e.g. Attica coastal towns) does not dominate the live-call budget.
const byRegion = new Map<string, HarmfulEntry[]>();
for (const entry of all) {
  const bucket = byRegion.get(entry.regionId) || [];
  bucket.push(entry);
  byRegion.set(entry.regionId, bucket);
}
const regionQueues = [...byRegion.values()];
const sample: HarmfulEntry[] = [];
outer: while (sample.length < Math.min(sampleSize, all.length)) {
  let anyLeft = false;
  for (const queue of regionQueues) {
    if (queue.length === 0) continue;
    anyLeft = true;
    sample.push(queue.shift() as HarmfulEntry);
    if (sample.length >= sampleSize) break outer;
  }
  if (!anyLeft) break;
}

interface MatchedHour {
  dt: string;
  windDirectionDeg: number;
  windSpeedKmh: number;
  waveHeightM?: number;
  waveDirectionDeg?: number;
}

interface LiveResult {
  entry: HarmfulEntry;
  matchedHours: number;
  worstWaveHeightM?: number;
  worstHour?: MatchedHour;
  liveLevel?: WaveLevel;
  agreesWithStored?: boolean;
  moreSevereThanStored?: boolean;
  error?: string;
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const fetchLive = async (entry: HarmfulEntry): Promise<LiveResult> => {
  const centerDeg = SECTOR_CENTER_DEG[entry.sector];
  try {
    const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${entry.lat}&longitude=${entry.lon}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh&timezone=UTC&forecast_days=6`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${entry.lat}&longitude=${entry.lon}&hourly=wave_height,wave_direction&timezone=UTC&forecast_days=6&cell_selection=sea`;

    const [forecastRes, marineRes] = await Promise.all([fetch(forecastUrl), fetch(marineUrl)]);
    if (!forecastRes.ok || !marineRes.ok) {
      return { entry, matchedHours: 0, error: `HTTP ${forecastRes.status}/${marineRes.status}` };
    }
    const forecast = await forecastRes.json() as { hourly?: { time: string[]; wind_speed_10m: number[]; wind_direction_10m: number[] } };
    const marine = await marineRes.json() as { hourly?: { time: string[]; wave_height: (number | null)[]; wave_direction: (number | null)[] } };

    const times = forecast.hourly?.time || [];
    const matched: MatchedHour[] = [];
    for (let i = 0; i < times.length; i += 1) {
      const windDeg = forecast.hourly?.wind_direction_10m?.[i];
      const windKmh = forecast.hourly?.wind_speed_10m?.[i];
      if (typeof windDeg !== 'number' || typeof windKmh !== 'number') continue;
      if (angularDistanceDeg(windDeg, centerDeg) > SECTOR_ARC_DEG) continue;
      // Only meaningful wind — a 3 km/h breeze from the right direction builds nothing.
      if (windKmh < 15) continue;
      const marineIndex = marine.hourly?.time?.indexOf(times[i]) ?? -1;
      const waveHeightM = marineIndex >= 0 ? (marine.hourly?.wave_height?.[marineIndex] ?? undefined) : undefined;
      const waveDirectionDeg = marineIndex >= 0 ? (marine.hourly?.wave_direction?.[marineIndex] ?? undefined) : undefined;
      matched.push({
        dt: times[i], windDirectionDeg: windDeg, windSpeedKmh: windKmh,
        waveHeightM: typeof waveHeightM === 'number' ? waveHeightM : undefined,
        waveDirectionDeg: typeof waveDirectionDeg === 'number' ? waveDirectionDeg : undefined,
      });
    }

    const withWave = matched.filter(h => typeof h.waveHeightM === 'number');
    const worstHour = withWave.length > 0
      ? withWave.reduce((worst, h) => (h.waveHeightM! > worst.waveHeightM! ? h : worst))
      : undefined;
    const liveLevel = worstHour ? waveLevelOf(worstHour.waveHeightM!) : undefined;

    return {
      entry,
      matchedHours: matched.length,
      worstWaveHeightM: worstHour?.waveHeightM,
      worstHour,
      liveLevel,
      agreesWithStored: liveLevel ? liveLevel === entry.storedLevel : undefined,
      moreSevereThanStored: liveLevel ? LEVEL_RANK[liveLevel] > LEVEL_RANK[entry.storedLevel] : undefined,
    };
  } catch (error) {
    return { entry, matchedHours: 0, error: error instanceof Error ? error.message : String(error) };
  }
};

const main = async () => {
  const results: LiveResult[] = [];
  for (const entry of sample) {
    results.push(await fetchLive(entry));
    await sleep(150); // gentle on the free API — 6-day window is a lot of matching to hope for anyway
  }

  const withMatch = results.filter(r => r.matchedHours > 0 && r.liveLevel);
  const noMatch = results.filter(r => r.matchedHours === 0);
  const errored = results.filter(r => r.error);
  const corroboratesMoreSevere = withMatch.filter(r => r.moreSevereThanStored);
  const agrees = withMatch.filter(r => r.agreesWithStored);
  const calmer = withMatch.filter(r => !r.moreSevereThanStored && !r.agreesWithStored);

  const report = {
    generatedAt: new Date().toISOString(),
    purpose: 'Stage 1b: live, external, third-party (Open-Meteo marine-api) comparison against the harmful-collapse set flagged by Stage 0 — a real physical check, not another recompute of the app formula.',
    sampledCount: sample.length,
    totalHarmfulPopulation: all.length,
    windowDays: 6,
    matchCriteria: `live wind within +-${SECTOR_ARC_DEG} deg of the flagged sector center AND wind speed >= 15 km/h, over the next 6 days`,
    summary: {
      noLiveWindowInNext6Days: noMatch.length,
      apiErrors: errored.length,
      hadAMatchingWindow: withMatch.length,
      ofThoseCorroboratingMoreSevereThanStored: corroboratesMoreSevere.length,
      ofThoseAgreeingWithStored: agrees.length,
      ofThoseShowingCalmerThanStored: calmer.length,
    },
    note: 'A small "hadAMatchingWindow" count is itself informative: it means most flagged sectors are not due to see wind from their flagged direction in the next week, so this 6-day snapshot can only speak to the subset that got a real matching window — it is not a substitute for the golden-set human verification.',
    results: results.map(r => ({
      regionId: r.entry.regionId, beachId: r.entry.beachId, name: r.entry.name, sector: r.entry.sector,
      storedLevel: r.entry.storedLevel, storedIntensity: r.entry.storedIntensity,
      fetchKm: r.entry.fetchKm, onshore: r.entry.onshore,
      matchedHours: r.matchedHours,
      worstWaveHeightM: r.worstWaveHeightM, worstHourDt: r.worstHour?.dt,
      worstHourWindKmh: r.worstHour?.windSpeedKmh, worstHourWindDeg: r.worstHour?.windDirectionDeg,
      liveLevel: r.liveLevel, agreesWithStored: r.agreesWithStored, moreSevereThanStored: r.moreSevereThanStored,
      error: r.error,
    })),
  };

  writeFileSync(jsonOutPath, `${JSON.stringify(report, null, 1)}\n`, 'utf8');

  const sampleRegionCount = new Set(sample.map(e => e.regionId)).size;
  console.log(`sampled=${sample.length}/${all.length} harmful entries (population spans ${byRegion.size} regions; sample spans ${sampleRegionCount})`);
  console.log(`noMatchingWindowIn6Days=${noMatch.length}  apiErrors=${errored.length}  hadMatch=${withMatch.length}`);
  console.log(`  of matches: corroborates-more-severe=${corroboratesMoreSevere.length}  agrees=${agrees.length}  calmer=${calmer.length}`);
  if (corroboratesMoreSevere.length > 0) {
    console.log('Corroborating examples (live marine data rougher than stored classification):');
    corroboratesMoreSevere.slice(0, 15).forEach(r => console.log(
      ` ${r.entry.regionId} #${r.entry.beachId} ${r.entry.name} @${r.entry.sector}: stored=${r.entry.storedLevel}(${r.entry.storedIntensity}) `
      + `live=${r.liveLevel}(${r.worstWaveHeightM}m at ${r.worstHour?.dt}, wind ${r.worstHour?.windSpeedKmh?.toFixed(0)}km/h from ${r.worstHour?.windDirectionDeg?.toFixed(0)}deg)`
    ));
  }
  console.log(`Report written: ${jsonOutPath}`);
};

main();
