/**
 * Map colour distribution audit + pre-registered criteria for the meltemi
 * colour fix (docs/map-color-system-plan.md).
 *
 * Runs the REAL map pipeline — assessBeachWindExposure (same resolution as
 * calculateBeachScore's exposure fields) -> getConsistentVisibleMapExposureLevels
 * (same-front harmonisation, exactly what BeachMap uses) — for 4 reference
 * islands x 4 weather scenarios, then maps the harmonised levels through BOTH
 * the current getExposureMarkerTone bands and the shipped mapping (current +
 * the single 5-6 Bft protected->teal change), and evaluates criteria C1-C3.
 *
 * C1: the fix works (every island shows a teal refuge at 5-6 Bft, was 0%).
 * C2: it didn't whitewash the map (orange+red stays >=30% at 5-6 Bft).
 * C3: non-regression — 2/3/7 Bft byte-identical to the current mapping.
 *
 * Read-only: touches no app code and no data. Run via:
 *   node scripts/colorDistributionAudit.mjs
 *
 * The "current" and "shipped" (proposedTone) mappings are replicated here as
 * spec. If the implemented mapping in components/BeachMap.tsx ever diverges
 * from proposedTone below, update both deliberately — this script is the gate.
 */
import { readFileSync } from 'node:fs';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { getConsistentVisibleMapExposureLevels } from '../utils/mapExposure';
import { WindDirection, type Beach, type GeospatialExposureProfile } from '../types';

const REGIONS = [
  ['south-aegean-naxos', 'Naxos'],
  ['south-aegean-milos', 'Milos'],
  ['south-aegean-rhodes', 'Rhodes'],
  ['ionian-islands-lefkada', 'Lefkada'],
] as const;

const SCENARIOS = [
  { name: 'calm 2Bft N', kmh: 9, beaufort: 2, deg: 0, dir: WindDirection.N },
  { name: '3Bft SW', kmh: 15, beaufort: 3, deg: 225, dir: WindDirection.SW },
  { name: '5Bft N meltemi', kmh: 35, beaufort: 5, deg: 0, dir: WindDirection.N },
  { name: '7Bft N', kmh: 55, beaufort: 7, deg: 0, dir: WindDirection.N },
] as const;

const WIND_DIRS = [
  WindDirection.N, WindDirection.NE, WindDirection.E, WindDirection.SE,
  WindDirection.S, WindDirection.SW, WindDirection.W, WindDirection.NW,
];

// EXACT replica of the current getExposureMarkerTone bands (components/BeachMap.tsx).
const currentTone = (level: string | undefined, beaufort: number): string => {
  const isProtected = level === 'protected';
  if (beaufort >= 7) return 'red';
  if (beaufort >= 5) return isProtected ? 'yellow' : 'orange';
  if (beaufort >= 3) return isProtected ? 'blue' : 'yellow';
  return 'blue';
};

// SHIPPED mapping: the current bands with the single meltemi fix applied —
// at 5-6 Bft, protected beaches paint teal ("green") instead of warning yellow,
// so the map surfaces a refuge in the case the app exists for. Everything else
// is byte-identical to the current mapping. The full level x Beaufort matrix
// (docs/map-color-system-plan.md) was scoped down to this one change.
export const proposedTone = (level: string | undefined, beaufort: number): string => {
  const isProtected = level === 'protected';
  if (beaufort >= 7) return 'red';
  if (beaufort >= 5) return isProtected ? 'green' : 'orange';
  if (beaufort >= 3) return isProtected ? 'blue' : 'yellow';
  return 'blue';
};

interface RegionData {
  beaches: Beach[];
  profiles: Record<string, GeospatialExposureProfile | undefined>;
}

const loadRegion = (regionId: string): RegionData => {
  const app = JSON.parse(readFileSync(`public/data/beaches/app/${regionId}.json`, 'utf8'));
  const expo = JSON.parse(readFileSync(`public/data/geospatial/exposure/${regionId}.json`, 'utf8'));
  return { beaches: app.island.beaches, profiles: expo.profiles ?? {} };
};

const windDirFromDeg = (deg: number): WindDirection =>
  WIND_DIRS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/** Build map items exactly as App.tsx builds them for BeachMap. */
const buildHarmonisedLevels = (
  data: RegionData,
  deg: number,
  kmh: number,
  beaufort: number
): { levels: Map<number, string>; facing: Map<number, number | null> } => {
  const facing = new Map<number, number | null>();
  const items = data.beaches.map(beach => {
    const profile = data.profiles[beach.id];
    const a = assessBeachWindExposure({
      beach,
      geospatialProfile: profile,
      windDirectionDeg: deg,
      windDirection: windDirFromDeg(deg),
      windSpeedKmh: kmh,
      beaufort,
    });
    facing.set(beach.id as number, profile?.facingDeg ?? null);
    return {
      exposureLevel: a.exposureLevel,
      geospatialExposure: profile,
      // App.tsx passes scoreResult.orientation = windProfile.beachFacingDirection
      orientation: a.windProfile.beachFacingDirection ?? null,
      windProfile: a.windProfile,
      windProfileSource: a.source,
      windSector: a.windSector,
      warnings: a.warnings,
      beach: { id: beach.id, coordinates: beach.coordinates, protectedFrom: beach.protectedFrom },
    };
  });
  const levels = getConsistentVisibleMapExposureLevels(items as never, beaufort, deg) as Map<number, string>;
  return { levels, facing };
};

const tally = (
  data: RegionData,
  levels: Map<number, string>,
  beaufort: number,
  mapping: (level: string | undefined, beaufort: number) => string
): Record<string, number> => {
  const counts: Record<string, number> = {};
  for (const beach of data.beaches) {
    const c = mapping(levels.get(beach.id as number), beaufort);
    counts[c] = (counts[c] || 0) + 1;
  }
  return counts;
};

const pctOf = (counts: Record<string, number>, colour: string, total: number): number =>
  Math.round((100 * (counts[colour] || 0)) / total);

// ---------------------------------------------------------------------------
// Distribution table: 4 islands x 4 scenarios, current vs proposed
// ---------------------------------------------------------------------------
const regionCache = new Map<string, RegionData>();
for (const [regionId, label] of REGIONS) {
  const data = loadRegion(regionId);
  regionCache.set(regionId, data);
  const total = data.beaches.length;
  console.log(`\n===== ${label} (${total} beaches) =====`);
  for (const sc of SCENARIOS) {
    const { levels } = buildHarmonisedLevels(data, sc.deg, sc.kmh, sc.beaufort);
    const now = tally(data, levels, sc.beaufort, currentTone);
    const prop = tally(data, levels, sc.beaufort, proposedTone);
    const lvlCounts: Record<string, number> = {};
    for (const beach of data.beaches) {
      const l = levels.get(beach.id as number) ?? '?';
      lvlCounts[l] = (lvlCounts[l] || 0) + 1;
    }
    const fmt = (counts: Record<string, number>, cols: string[]) =>
      cols.map(c => `${c}:${pctOf(counts, c, total)}%`).join(' ');
    console.log(
      `${sc.name.padEnd(16)} NOW[${fmt(now, ['blue', 'yellow', 'orange', 'red'])}]  ` +
      `PROPOSED[${fmt(prop, ['green', 'yellow', 'orange', 'red'])}]  ` +
      `[protected:${lvlCounts.protected || 0} partial:${lvlCounts.partial || 0} exposed:${lvlCounts.exposed || 0}]`
    );
  }
}

// ---------------------------------------------------------------------------
// Pre-registered criteria C1-C8 (see docs/map-color-system-plan.md, ΜΕΡΟΣ 3).
// All evaluated on the PROPOSED mapping over the live pipeline output.
// ---------------------------------------------------------------------------
console.log('\n===== PRE-REGISTERED CRITERIA (proposed mapping) =====');
const failures: string[] = [];
const check = (id: string, description: string, pass: boolean, detail: string) => {
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}: ${description} — ${detail}`);
  if (!pass) failures.push(id);
};

// C1 — THE FIX: at 5-6 Bft, every island must now surface a calm (teal/green)
// refuge instead of an all-warning map. Each protected beach that the current
// mapping paints yellow now paints green; the count must be > 0 on all four.
{
  let allHaveRefuge = true;
  const details: string[] = [];
  for (const [regionId, label] of REGIONS) {
    const data = regionCache.get(regionId)!;
    const { levels } = buildHarmonisedLevels(data, 0, 35, 5);
    const prop = tally(data, levels, 5, proposedTone);
    const green = pctOf(prop, 'green', data.beaches.length);
    if (green <= 0) allHaveRefuge = false;
    details.push(`${label} green ${green}%`);
  }
  check('C1', '5-6Bft meltemi: every island shows >0% green refuge (was 0% everywhere)',
    allHaveRefuge, details.join(', '));
}

// C2 — DANGER STILL VISIBLE: surfacing refuges must not hide the exposed
// beaches. At 5-6 Bft the exposed/partial beaches stay orange, so orange+red
// must remain a substantial share — the map is not turned falsely calm.
{
  let allShowDanger = true;
  const details: string[] = [];
  for (const [regionId, label] of REGIONS) {
    const data = regionCache.get(regionId)!;
    const { levels } = buildHarmonisedLevels(data, 0, 35, 5);
    const prop = tally(data, levels, 5, proposedTone);
    const alarm = pctOf(prop, 'orange', data.beaches.length) + pctOf(prop, 'red', data.beaches.length);
    if (alarm < 30) allShowDanger = false;
    details.push(`${label} orange+red ${alarm}%`);
  }
  check('C2', '5-6Bft: every island keeps orange+red >=30% (refuges did not whitewash the map)',
    allShowDanger, details.join(', '));
}

// C3 — NON-REGRESSION on all other bands: the change is scoped to 5-6 Bft.
// For 2, 3 and 7 Bft the shipped mapping must be byte-identical to the current
// mapping on every beach of every island. If a single beach differs, something
// outside the meltemi band moved — STOP.
{
  let identical = true;
  const diffs: string[] = [];
  for (const [regionId, label] of REGIONS) {
    const data = regionCache.get(regionId)!;
    for (const beaufort of [2, 3, 7]) {
      const deg = beaufort === 3 ? 225 : 0;
      const kmh = beaufort === 2 ? 9 : beaufort === 3 ? 15 : 55;
      const { levels } = buildHarmonisedLevels(data, deg, kmh, beaufort);
      for (const beach of data.beaches) {
        const id = beach.id as number;
        const lvl = levels.get(id);
        if (currentTone(lvl, beaufort) !== proposedTone(lvl, beaufort)) {
          identical = false;
          diffs.push(`${label} #${id} ${beaufort}Bft`);
        }
      }
    }
  }
  check('C3', 'Non-regression: 2/3/7 Bft byte-identical to current mapping on all 4 islands',
    identical, identical ? 'no differences' : `differs: ${diffs.slice(0, 8).join(', ')}`);
}

if (failures.length > 0) {
  console.error(`\nCRITERIA FAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nAll pre-registered criteria PASS.');
