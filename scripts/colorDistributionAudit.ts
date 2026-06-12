/**
 * Map colour distribution audit + pre-registered visual criteria for the map
 * colour-system redesign (docs/map-color-system-plan.md).
 *
 * Runs the REAL map pipeline — assessBeachWindExposure (same resolution as
 * calculateBeachScore's exposure fields) -> getConsistentVisibleMapExposureLevels
 * (same-front harmonisation, exactly what BeachMap uses) — for 4 reference
 * islands x 4 weather scenarios, then maps the harmonised levels through BOTH
 * the current getExposureMarkerTone bands and the proposed colour matrix, and
 * evaluates the pre-registered criteria C1-C8 as hard PASS/FAIL.
 *
 * Read-only: touches no app code and no data. Run via:
 *   node scripts/colorDistributionAudit.mjs
 *
 * NOTE: the "current" and "proposed" mappings are replicated here as spec.
 * If the implemented mapping in components/BeachMap.tsx ever diverges from
 * PROPOSED_MATRIX below, update both deliberately — this script is the gate.
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

// PROPOSED matrix (the spec under implementation): full level x Beaufort grid,
// absolute swimmer-experience anchoring. green = calm/ideal, yellow = noticeable
// chop but OK, orange = uncomfortable / not for kids, red = avoid.
export const proposedTone = (level: string | undefined, beaufort: number): string => {
  const l = level === 'protected' ? 'protected' : level === 'partial' ? 'partial' : 'exposed';
  if (beaufort >= 7) return l === 'protected' ? 'yellow' : 'red';
  if (beaufort >= 5) return l === 'protected' ? 'green' : l === 'partial' ? 'orange' : 'red';
  if (beaufort >= 4) return l === 'protected' ? 'green' : l === 'partial' ? 'yellow' : 'orange';
  if (beaufort >= 3) return l === 'exposed' ? 'yellow' : 'green';
  return 'green';
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

const naxos = regionCache.get('south-aegean-naxos')!;
const lefkada = regionCache.get('ionian-islands-lefkada')!;

// Naxos 3 Bft SW, per coast (E-ish = facing 0-180, W-ish = rest; facing null counts W-ish).
{
  const { levels, facing } = buildHarmonisedLevels(naxos, 225, 15, 3);
  let eGreen = 0, eTotal = 0, wYellow = 0, wTotal = 0, green = 0, orangeRed = 0;
  for (const beach of naxos.beaches) {
    const id = beach.id as number;
    const f = facing.get(id);
    const c = proposedTone(levels.get(id), 3);
    const isEast = typeof f === 'number' && f >= 0 && f <= 180;
    if (isEast) { eTotal += 1; if (c === 'green') eGreen += 1; }
    else { wTotal += 1; if (c === 'yellow') wYellow += 1; }
    if (c === 'green') green += 1;
    if (c === 'orange' || c === 'red') orangeRed += 1;
  }
  check('C1', 'Naxos 3Bft SW: east (lee) coast >=80% green',
    100 * eGreen / eTotal >= 80, `${eGreen}/${eTotal} = ${Math.round(100 * eGreen / eTotal)}%`);
  check('C2', 'Naxos 3Bft SW: west (windward) coast >=50% yellow',
    100 * wYellow / wTotal >= 50, `${wYellow}/${wTotal} = ${Math.round(100 * wYellow / wTotal)}%`);
  check('C3', 'Naxos 3Bft SW: island >=60% green and 0 orange/red',
    100 * green / naxos.beaches.length >= 60 && orangeRed === 0,
    `green ${Math.round(100 * green / naxos.beaches.length)}%, orange+red ${orangeRed}`);
}

// Naxos 5 Bft N meltemi: refuges visible, danger visible.
{
  const { levels } = buildHarmonisedLevels(naxos, 0, 35, 5);
  const prop = tally(naxos, levels, 5, proposedTone);
  const total = naxos.beaches.length;
  const green = pctOf(prop, 'green', total);
  const alarm = pctOf(prop, 'orange', total) + pctOf(prop, 'red', total);
  check('C4', 'Naxos 5Bft N: green 40-60% (refuges visible) and orange+red >=30%',
    green >= 40 && green <= 60 && alarm >= 30, `green ${green}%, orange+red ${alarm}%`);
}

// Naxos 7 Bft N: nothing green (honesty), refuges still findable as yellow.
{
  const { levels } = buildHarmonisedLevels(naxos, 0, 55, 7);
  const prop = tally(naxos, levels, 7, proposedTone);
  const total = naxos.beaches.length;
  check('C5', 'Naxos 7Bft N: red >=40%, yellow (refuges) >=30%, green = 0%',
    pctOf(prop, 'red', total) >= 40 && pctOf(prop, 'yellow', total) >= 30 && (prop.green || 0) === 0,
    `red ${pctOf(prop, 'red', total)}%, yellow ${pctOf(prop, 'yellow', total)}%, green ${prop.green || 0}`);
}

// Calm day: everything green on all 4 islands.
{
  let allGreen = true;
  const details: string[] = [];
  for (const [regionId, label] of REGIONS) {
    const data = regionCache.get(regionId)!;
    const { levels } = buildHarmonisedLevels(data, 0, 9, 2);
    const prop = tally(data, levels, 2, proposedTone);
    const green = pctOf(prop, 'green', data.beaches.length);
    if (green !== 100) allGreen = false;
    details.push(`${label} ${green}%`);
  }
  check('C6', 'Calm 2Bft: 100% green on all 4 islands', allGreen, details.join(', '));
}

// Direction robustness: Naxos 3 Bft, 200deg (S sector) vs 225deg (SW sector).
{
  const a = buildHarmonisedLevels(naxos, 200, 15, 3).levels;
  const b = buildHarmonisedLevels(naxos, 225, 15, 3).levels;
  let flips = 0;
  for (const beach of naxos.beaches) {
    const id = beach.id as number;
    if (proposedTone(a.get(id), 3) !== proposedTone(b.get(id), 3)) flips += 1;
  }
  const pct = Math.round(100 * flips / naxos.beaches.length);
  check('C7', 'Naxos 3Bft, 200deg vs 225deg: colour flips <=35% of beaches',
    pct <= 35, `${flips}/${naxos.beaches.length} = ${pct}% (current mapping: ~51%)`);
}

// Cross-island anchoring: Lefkada 3 Bft SW must also read "mostly OK".
{
  const { levels } = buildHarmonisedLevels(lefkada, 225, 15, 3);
  const prop = tally(lefkada, levels, 3, proposedTone);
  const green = pctOf(prop, 'green', lefkada.beaches.length);
  check('C8', 'Lefkada 3Bft SW: >=50% green, 0 orange/red',
    green >= 50 && (prop.orange || 0) === 0 && (prop.red || 0) === 0,
    `green ${green}%, orange ${prop.orange || 0}, red ${prop.red || 0}`);
}

if (failures.length > 0) {
  console.error(`\nCRITERIA FAILED: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('\nAll pre-registered criteria PASS.');
