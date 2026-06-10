/**
 * Region engine dump (playbook step 2): runs the REAL wind-exposure engine for
 * every beach of a region and reports, per beach:
 *   - per-sector curated-resolved level (assessBeachWindExposure at 5 Bft)
 *     vs the geometry sector level/intensity/fetch from the generated profile
 *   - the map-visible level (getVisibleMapExposureLevel), exposing places
 *     where the confidence regime makes map and scoring disagree
 *   - four representative weather scenarios (meltemi N7, S6, NW5, calm)
 *
 * Run via the wrapper: node scripts/dumpRegionExposureEngine.mjs --region <regionId> [--json <out>]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { getVisibleMapExposureLevel } from '../utils/mapExposure';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import type { Beach, GeospatialExposureProfile, WindSector } from '../types';

const SECTORS: Array<{ key: WindSector; deg: number }> = [
  { key: 'N', deg: 0 }, { key: 'NE', deg: 45 }, { key: 'E', deg: 90 }, { key: 'SE', deg: 135 },
  { key: 'S', deg: 180 }, { key: 'SW', deg: 225 }, { key: 'W', deg: 270 }, { key: 'NW', deg: 315 },
];

const SCENARIOS = [
  { key: 'meltemi_N7', deg: 0, kmh: 56 },
  { key: 'notias_S6', deg: 180, kmh: 44 },
  { key: 'nw_5', deg: 315, kmh: 33 },
  { key: 'calm_2', deg: 0, kmh: 8 },
];

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const regionId = parseArgValue('--region');
if (!regionId) {
  console.error('Usage: node scripts/dumpRegionExposureEngine.mjs --region <regionId> [--json <out>]');
  process.exit(1);
}
const jsonOutPath = parseArgValue('--json');

const regionPayload = JSON.parse(readFileSync(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`), 'utf8'));
const beaches = (regionPayload.island?.beaches || []) as unknown as Beach[];
const exposurePayload = JSON.parse(readFileSync(path.join('public', 'data', 'geospatial', 'exposure', `${regionId}.json`), 'utf8'));
const profiles = exposurePayload.profiles as Record<string, GeospatialExposureProfile>;

const run = (beach: Beach, deg: number, kmh: number) => assessBeachWindExposure({
  beach,
  geospatialProfile: profiles[String(beach.id)],
  windDirectionDeg: deg,
  windDirection: degToCompass(deg),
  windSpeedKmh: kmh,
  beaufort: getBeaufortLevel(kmh),
});

const results = beaches.map(beach => {
  const geo = profiles[String(beach.id)];
  const base = run(beach, 0, 33);
  const sectors = SECTORS.map(({ key, deg }) => {
    const assessment = run(beach, deg, 33);
    const mapLevel = getVisibleMapExposureLevel({
      exposureLevel: assessment.exposureLevel,
      geospatialExposure: geo,
      orientation: beach.orientation?.degrees ?? null,
      windProfile: assessment.windProfile,
      windProfileSource: assessment.source,
      windSector: assessment.windSector,
      warnings: assessment.warnings,
      beach: { protectedFrom: beach.protectedFrom },
    }, 5, deg);
    return {
      sector: key,
      curated: assessment.exposureLevel,
      map: mapLevel,
      geoLevel: geo?.sectors?.[key]?.level ?? null,
      geoIntensity: geo?.sectors?.[key]?.intensity ?? null,
      geoFetchKm: geo?.sectors?.[key]?.fetchKm ?? null,
    };
  });
  const scenarios = SCENARIOS.map(({ key, deg, kmh }) => {
    const assessment = run(beach, deg, kmh);
    return {
      scenario: key,
      level: assessment.exposureLevel,
      color: assessment.simpleWindSuitability.suitabilityColor,
      canClaimProtected: assessment.canClaimProtected,
      cap: assessment.finalScoreCap ?? null,
    };
  });
  return {
    id: beach.id,
    name: (beach.name as { en?: string }).en,
    source: base.source,
    confidence: base.windProfile.confidence,
    authoredFacing: base.windProfile.beachFacingDirection,
    exposedDirs: base.windProfile.exposedToWindDirections,
    protectedDirs: base.windProfile.protectedFromWindDirections,
    windSport: base.windProfile.knownWindSportSpot,
    geoFacing: geo?.facingDeg ?? null,
    geoConfidence: geo?.confidence ?? null,
    sectors,
    scenarios,
  };
});

if (jsonOutPath) writeFileSync(jsonOutPath, JSON.stringify(results, null, 1), 'utf8');

let agree = 0;
let total = 0;
for (const r of results) {
  const diffs = r.sectors.filter(s => s.geoLevel && s.curated !== s.geoLevel);
  total += r.sectors.length;
  agree += r.sectors.length - diffs.length;
  const facingDelta = typeof r.authoredFacing === 'number' && typeof r.geoFacing === 'number'
    ? Math.min(Math.abs(r.authoredFacing - r.geoFacing), 360 - Math.abs(r.authoredFacing - r.geoFacing)).toFixed(0)
    : 'n/a';
  const mapVsCurated = r.sectors.filter(s => s.map !== s.curated).map(s => `${s.sector}:scoring=${s.curated}/map=${s.map}`);
  console.log(`#${r.id} ${r.name} [${r.source}/${r.confidence}] authFacing=${r.authoredFacing} geoFacing=${r.geoFacing} dFacing=${facingDelta}`);
  if (diffs.length > 0) console.log(`  curated-vs-geo: ${diffs.map(s => `${s.sector}:${s.curated}|geo=${s.geoLevel}(i${s.geoIntensity},f${s.geoFetchKm})`).join(' ')}`);
  if (mapVsCurated.length > 0) console.log(`  map-vs-scoring: ${mapVsCurated.join(' ')}`);
  console.log(`  scenarios: ${r.scenarios.map(s => `${s.scenario}=${s.level}/${s.color}${s.canClaimProtected ? '/SHELTER' : ''}`).join(' ')}`);
}
console.log(`\nSector agreement curated-vs-geometry: ${agree}/${total} (${(100 * agree / total).toFixed(0)}%)`);
