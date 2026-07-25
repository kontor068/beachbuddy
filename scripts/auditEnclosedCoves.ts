/**
 * National enclosed-cove (όρμος) audit.
 *
 * Runs the REAL wind-exposure engine (assessBeachWindExposure → enclosedCove) for
 * every beach that has a geospatial profile, then re-derives the raw geometry
 * features so we can see the beaches sitting just OUTSIDE the gate.
 *
 * Reports four buckets:
 *   POSITIVES        — currently classified as όρμος (for false-positive review;
 *                      ranked by marginality so the riskiest sit on top)
 *   FN: confidence   — full geometry passes but geo confidence != high (a data
 *                      -quality miss, not a morphology one — would flip if the
 *                      profile were upgraded)
 *   FN: morphology   — one sector short of the gate (enclosedRun 4) with a tight
 *                      mouth and no veto — genuine cove candidates to curate
 *   VETOED           — full geometry passes but an authored veto killed it
 *                      (expected: wind-sport / open-fetch / suspect pin)
 *
 * Run: node scripts/auditEnclosedCoves.mjs [--json <out>]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { CURATED_ENCLOSED_COVE_IDS } from '../utils/enclosedCoves';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import type { Beach, GeospatialExposureProfile, WindSector } from '../types';

const SECTORS: WindSector[] = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
// Mirror of the private constants in utils/windExposureEngine.ts (kept in sync
// deliberately — the engine's isEnclosedCoveGeometry is the source of truth, this
// only re-derives features to expose near-misses).
const MIN_ARC = 5;
const NEAR_LAND_KM = 0.5;
const MAX_MOUTH = 3;
const MIN_MAX_FETCH_KM = 1;
const BLOCKED_RATIO = 0.95;
const MAX_INTENSITY = 33;
const MOUTH_LONG_FETCH_KM = 8;
const MAX_LONG_FETCH_MOUTH = 2;

const maxCircularSectorRun = (flags: boolean[]): number => {
  if (flags.every(Boolean)) return flags.length;
  let max = 0;
  let run = 0;
  for (let i = 0; i < flags.length * 2; i++) {
    if (flags[i % flags.length]) { run += 1; if (run > max) max = run; }
    else run = 0;
  }
  return max;
};

const parseArgValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const PORT_NAME = /(μαρίνα|λιμάνι|λιμήν|λιμέν|marina|harbou?r|port|λιμανάκι)/i;

interface Rec {
  id: number;
  name?: string;
  region: string;
  isCove: boolean;
  curated: boolean;
  source: string;
  geoConfidence: string | null;
  enclosedRun: number;
  nearLandRun: number;
  mouthSectors: number;
  maxFetchKm: number;
  veto: { windSport: boolean; amp: string; shelter: string; suspectPin: boolean };
  portName: boolean;
}

const exposureDir = path.join('public', 'data', 'geospatial', 'exposure');
const beachesDir = path.join('public', 'data', 'beaches', 'app');
const regionFiles = readdirSync(exposureDir).filter(f => f.endsWith('.json'));

const positives: Rec[] = [];
const fnConfidence: Rec[] = [];
const fnMorphology: Rec[] = [];
const vetoed: Rec[] = [];
let beachesScanned = 0;

for (const file of regionFiles) {
  const regionId = file.replace(/\.json$/, '');
  const exposurePayload = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8'));
  const profiles = (exposurePayload.profiles || {}) as Record<string, GeospatialExposureProfile>;
  let beaches: Beach[] = [];
  try {
    const regionPayload = JSON.parse(readFileSync(path.join(beachesDir, `${regionId}.json`), 'utf8'));
    beaches = (regionPayload.island?.beaches || []) as unknown as Beach[];
  } catch { continue; }

  for (const beach of beaches) {
    const geo = profiles[String(beach.id)];
    beachesScanned += 1;
    const assessment = assessBeachWindExposure({
      beach,
      geospatialProfile: geo,
      windDirectionDeg: 0,
      windDirection: degToCompass(0),
      windSpeedKmh: 33,
      beaufort: getBeaufortLevel(33),
    });
    const wp = assessment.windProfile;
    const isCove = assessment.enclosedCove;
    const curated = CURATED_ENCLOSED_COVE_IDS.has(beach.id);
    const nm = beach.name as { gr?: string; en?: string };
    const name = nm?.gr || nm?.en;

    let enclosedRun = 0;
    let nearLandRun = 0;
    let mouthSectors = 0;
    let maxFetchKm = 0;
    let longFetchMouth = 0;
    if (geo?.sectors) {
      const enclosed = SECTORS.map(s => {
        const sec = geo.sectors[s];
        return Boolean(
          sec && sec.level === 'protected' &&
          typeof sec.blockedRayRatio === 'number' && sec.blockedRayRatio >= BLOCKED_RATIO &&
          typeof sec.intensity === 'number' && sec.intensity < MAX_INTENSITY
        );
      });
      const nearLand = SECTORS.map(s => (geo.sectors[s]?.fetchKm ?? Number.POSITIVE_INFINITY) <= NEAR_LAND_KM);
      maxFetchKm = Math.max(...SECTORS.map(s => geo.sectors[s]?.fetchKm ?? 0));
      enclosedRun = maxCircularSectorRun(enclosed);
      nearLandRun = maxCircularSectorRun(nearLand);
      mouthSectors = maxCircularSectorRun(nearLand.map(v => !v));
      longFetchMouth = SECTORS.filter(s => (geo.sectors[s]?.fetchKm ?? 0) >= MOUTH_LONG_FETCH_KM).length;
    }

    const vetoActive = Boolean(wp.suspectPin) || Boolean(wp.knownWindSportSpot)
      || wp.localWindAmplification === 'high' || wp.shelterLevel === 'open';
    const geometryPasses = geo?.confidence === 'high'
      && enclosedRun >= MIN_ARC && nearLandRun >= MIN_ARC
      && mouthSectors <= MAX_MOUTH && longFetchMouth <= MAX_LONG_FETCH_MOUTH
      && maxFetchKm >= MIN_MAX_FETCH_KM;

    const rec: Rec = {
      id: beach.id,
      name,
      region: regionId,
      isCove,
      curated,
      source: assessment.source,
      geoConfidence: geo?.confidence ?? null,
      enclosedRun,
      nearLandRun,
      mouthSectors,
      maxFetchKm: Number(maxFetchKm.toFixed(2)),
      veto: {
        windSport: Boolean(wp.knownWindSportSpot),
        amp: wp.localWindAmplification,
        shelter: wp.shelterLevel,
        suspectPin: Boolean(wp.suspectPin),
      },
      portName: Boolean(name && PORT_NAME.test(name)),
    };

    if (isCove) { positives.push(rec); continue; }
    if (curated) continue; // curated but not a cove today shouldn't happen; skip from FN

    if (geometryPasses && vetoActive) { vetoed.push(rec); continue; }
    // Would flip to cove if the profile were high-confidence.
    if (geo && geo.confidence !== 'high'
      && enclosedRun >= MIN_ARC && nearLandRun >= MIN_ARC
      && mouthSectors <= MAX_MOUTH && maxFetchKm >= MIN_MAX_FETCH_KM) {
      fnConfidence.push(rec);
      continue;
    }
    // One sector short of the gate, tight mouth, no veto — genuine curate candidate.
    // Fetch cap 8 (was 6): Πάνορμος Νάξου (maxFetch 6.2, land 6/8, 2-sector mouth)
    // sat invisibly past the old cap — a verified όρμος the funnel must surface.
    if (geo?.confidence === 'high' && !vetoActive
      && enclosedRun === MIN_ARC - 1 && nearLandRun >= MIN_ARC - 1
      && mouthSectors <= MAX_MOUTH + 1 && maxFetchKm >= MIN_MAX_FETCH_KM && maxFetchKm <= 8) {
      fnMorphology.push(rec);
    }
  }
}

// Marginality: how close a POSITIVE sits to the wall (bigger = safer, more clearly a cove).
const margin = (r: Rec) => (r.enclosedRun - MIN_ARC) + (MAX_MOUTH - r.mouthSectors) + (r.maxFetchKm <= 3 ? 1 : 0);
positives.sort((a, b) => margin(a) - margin(b)); // riskiest first
fnConfidence.sort((a, b) => b.enclosedRun - a.enclosedRun);
fnMorphology.sort((a, b) => (b.nearLandRun - a.nearLandRun) || (a.maxFetchKm - b.maxFetchKm));
vetoed.sort((a, b) => a.region.localeCompare(b.region));

const out = {
  beachesScanned,
  counts: {
    positives: positives.length,
    geometryPositives: positives.filter(p => !p.curated).length,
    curatedPositives: positives.filter(p => p.curated).length,
    fnConfidence: fnConfidence.length,
    fnMorphology: fnMorphology.length,
    vetoed: vetoed.length,
    portNamedPositives: positives.filter(p => p.portName).length,
  },
  positives,
  fnConfidence,
  fnMorphology,
  vetoed,
};

const jsonOutPath = parseArgValue('--json');
if (jsonOutPath) writeFileSync(jsonOutPath, JSON.stringify(out, null, 1), 'utf8');

const line = (r: Rec) => `  #${r.id} ${r.name} [${r.region}] enc=${r.enclosedRun} nearLand=${r.nearLandRun} mouth=${r.mouthSectors} maxFetch=${r.maxFetchKm}km conf=${r.geoConfidence}${r.portName ? ' ⚠PORT-NAME' : ''}${r.curated ? ' (curated)' : ''}`;

console.log(`Scanned ${beachesScanned} beaches with profiles.\n`);
console.log(`POSITIVES (currently όρμος): ${positives.length} = ${out.counts.geometryPositives} geometry + ${out.counts.curatedPositives} curated`);
console.log(`  port-named positives (highest FP risk): ${out.counts.portNamedPositives}`);
console.log(`\n── 25 MOST MARGINAL POSITIVES (spot-check for false positives) ──`);
positives.slice(0, 25).forEach(r => console.log(line(r)));
console.log(`\n── PORT/MARINA-NAMED POSITIVES (likely false positives) ──`);
positives.filter(p => p.portName).forEach(r => console.log(line(r)));
console.log(`\n── FALSE-NEGATIVE: confidence miss (${fnConfidence.length}) — full geometry, profile not high-conf ──`);
fnConfidence.forEach(r => console.log(line(r)));
console.log(`\n── FALSE-NEGATIVE: morphology near-miss (${fnMorphology.length}) — one sector short, tight mouth, no veto ──`);
fnMorphology.forEach(r => console.log(line(r)));
console.log(`\n── VETOED (${vetoed.length}) — full geometry but authored veto (expected) ──`);
vetoed.forEach(r => console.log(`${line(r)}  veto=${JSON.stringify(r.veto)}`));
