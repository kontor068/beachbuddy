/**
 * ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΓΡΑΦΟΝΤΑΙ «ΑΝΟΙΧΤΕΣ» ΕΠΕΙΔΗ Η ΓΕΩΜΕΤΡΙΑ ΜΕΤΡΗΘΗΚΕ ΕΞΩ ΑΠΟ ΤΟΝ ΟΡΜΟ ΤΟΥΣ.
 *
 * THE CASE THAT STARTED IT — Καραβοστάσι Μπαλίου (id 680), 16/08/2026. A live webcam showing a
 * rock-armed cove with knee-high surf while the card printed «Μεγάλο κύμα 1,3 μ.». The number was
 * honest: both wave models put 1,24 m in the sea off Bali, 1,22 m of it swell from 346°. What was
 * not honest is WHICH water we called the beach's own. The shipped profile reads N and NE as
 * `exposed`, 25 km of open fetch, blocked ratio 0 — while rays fired from the water 30 m in front
 * of the beach find NO bearing with more than ~2 km of open water and land within 20-60 m across
 * the whole northern half.
 *
 * THE MECHANISM, and why it is nobody's bug. Every beach pin sits on the LAND side of the OSM
 * coastline (the coastline is the water line; the beach polygon is inland of it), so
 * utils/geospatialExposureModel.resolveNearshoreWaterOrigin walks outward to find water before
 * casting. It walks in steps of `nearshoreWaterSearchStepKm` = 0,1 km, trying bearings 0°, 15°, …
 * at each radius — north first. Bali's cove water is 30-60 m from the pin, which is INSIDE the
 * first step: the search never tests it, lands on the first water at exactly 100 m, and going
 * north first that water is on the far side of the rock arm that shelters the cove. From there
 * the profile describes the open north coast. Everything downstream inherits it — the exposure
 * colour, which marine cell the beach reads, and whether §Γ1's ceiling can ever engage.
 *
 * WHAT THIS SCRIPT DOES, and what it deliberately does NOT do. It re-casts the app's own fan
 * (8 sectors × 5 rays, utils/geospatialExposureModel) from the water the beach ACTUALLY touches —
 * the nearest sea cell to the pin, found in 10 m steps — and asks the ONE question §Γ1 already
 * asks: are all forty rays blocked, with the longest fetch under 3 km? Beaches that answer yes
 * from their own water but no in the shipped profile are the blind spot: they can never even
 * become candidates for scripts/auditEnclosedWater.mjs, because that script's funnel reads the
 * shipped sectors.
 *
 * ⚠️ THIS SCRIPT ADMITS NOTHING. It is a candidate finder, not a second opinion on shelter. Being
 * enclosed by rays is exactly the signature the six Νάουσα-bay beaches also carry (§Γ1), and the
 * ONLY thing that separates a real enclosure from an open-coast corner is the two witnesses in
 * auditEnclosedWater.mjs — a real constriction, and at least 2 gap-widths of depth behind it.
 * The output here is an id list to feed into that script's `--probe`, nothing more. No rule is
 * invented, no threshold is new, and no beach gains protection from this file.
 *
 * Offline only; it reads ~35 MB of coastline and fires tens of millions of land tests.
 *
 * Run: node --max-old-space-size=4096 scripts/auditCoveOriginBlindSpot.mjs [--json <path>] [--limit N]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadMask, makeIsLand, destination, KM_PER_DEG_LAT } from './lib/coastlineMask.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SECTOR_CENTRE = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

// ── The §Γ1 gate, mirrored from utils/geometricWaveCeiling.ts. Not re-tuned here. ──────────────
const REQUIRED_BLOCKED_RATIO = 1;
const MAX_FETCH_KM = 3;
const MIN_FETCH_KM = 0.2;

// ── Ray settings ──────────────────────────────────────────────────────────────────────────────
/** The app's own fan: ±30° in five rays per sector (settings.fanAnglesDeg). */
const FAN_ANGLES = [-30, -15, 0, 15, 30];
/** The shipped build's ceiling (settings.maxFetchKm). A ray that gets here is open water. */
const MAX_RAY_KM = 25;
/**
 * 20 m near the shore, then the shipped 200 m further out. The fine near field is the whole point:
 * a 100-150 m rock arm — the thing that shelters Bali — is INVISIBLE at a 200 m step, which is why
 * the committed profiles cannot see this class. Beyond ~3 km the arms stop mattering and the
 * shipped resolution is enough, so the cost is spent where it buys something.
 */
const NEAR_STEP_KM = 0.02;
const NEAR_FIELD_KM = 3.2;
const FAR_STEP_KM = 0.2;

/** How far out to look for the water the beach itself touches, and how finely. */
const OWN_WATER_SEARCH_KM = 0.15;
const OWN_WATER_STEP_KM = 0.01;
const OWN_WATER_BEARING_STEP_DEG = 10;

const castRay = (isLand, lat, lon, bearingDeg) => {
  let distanceKm = NEAR_STEP_KM;
  for (; distanceKm <= NEAR_FIELD_KM; distanceKm += NEAR_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, distanceKm);
    if (isLand(p.lon, p.lat)) return { openKm: Math.max(0, distanceKm - NEAR_STEP_KM), blocked: true };
  }
  for (distanceKm = NEAR_FIELD_KM; distanceKm <= MAX_RAY_KM; distanceKm += FAR_STEP_KM) {
    const p = destination(lat, lon, bearingDeg, distanceKm);
    if (isLand(p.lon, p.lat)) return { openKm: Math.max(0, distanceKm - FAR_STEP_KM), blocked: true };
  }
  return { openKm: MAX_RAY_KM, blocked: false };
};

/** The sea cell the beach actually touches. Null when the pin has no water within the search. */
const findOwnWater = (isLand, lat, lon) => {
  if (!isLand(lon, lat)) return { lat, lon, offsetM: 0 };
  for (let d = OWN_WATER_STEP_KM; d <= OWN_WATER_SEARCH_KM + 1e-9; d += OWN_WATER_STEP_KM) {
    for (let b = 0; b < 360; b += OWN_WATER_BEARING_STEP_DEG) {
      const p = destination(lat, lon, b, d);
      if (!isLand(p.lon, p.lat)) return { lat: p.lat, lon: p.lon, offsetM: Math.round(d * 1000) };
    }
  }
  return null;
};

/**
 * What the shipped build did: same walk, but 100 m steps and 15° bearings, and the candidate must
 * carry 0,5 km of continuous open water somewhere (nearshoreMinOpenWaterKm). Reproduced here only
 * so the report can say how far apart the two origins ended up — that gap IS the finding.
 */
const findBuilderOrigin = (isLand, lat, lon) => {
  const hasPassage = (la, lo) => {
    for (let b = 0; b < 360; b += 30) {
      let open = 0;
      for (let d = 0.1; d <= 0.5 + 1e-9; d += 0.1) {
        const p = destination(la, lo, b, d);
        if (isLand(p.lon, p.lat)) break;
        open = d;
      }
      if (open >= 0.45) return true;
    }
    return false;
  };
  if (!isLand(lon, lat) && hasPassage(lat, lon)) return { lat, lon, offsetM: 0 };
  for (let d = 0.1; d <= 12 + 1e-9; d += 0.1) {
    for (let b = 0; b < 360; b += 15) {
      const p = destination(lat, lon, b, d);
      if (!isLand(p.lon, p.lat) && hasPassage(p.lat, p.lon)) {
        return { lat: p.lat, lon: p.lon, offsetM: Math.round(d * 1000) };
      }
    }
  }
  return null;
};

const metresBetween = (a, b) => {
  const dLat = (a.lat - b.lat) * KM_PER_DEG_LAT;
  const dLon = (a.lon - b.lon) * 111.32 * Math.cos((a.lat * Math.PI) / 180);
  return Math.round(Math.hypot(dLat, dLon) * 1000);
};

/** The app's 8-sector roll-up, from an arbitrary origin. */
const castFan = (isLand, lat, lon) => {
  const sectors = {};
  for (const name of SECTORS) {
    const rays = FAN_ANGLES.map(offset => castRay(isLand, lat, lon, (SECTOR_CENTRE[name] + offset + 360) % 360));
    sectors[name] = {
      fetchKm: Number((rays.reduce((sum, r) => sum + r.openKm, 0) / rays.length).toFixed(2)),
      blockedRayRatio: Number((rays.filter(r => r.blocked).length / rays.length).toFixed(2)),
    };
  }
  const list = SECTORS.map(s => sectors[s]);
  return {
    sectors,
    maxFetchKm: Number(Math.max(...list.map(s => s.fetchKm)).toFixed(2)),
    allBlocked: list.every(s => s.blockedRayRatio >= REQUIRED_BLOCKED_RATIO),
    minBlockedRatio: Math.min(...list.map(s => s.blockedRayRatio)),
  };
};

const passesGate = ({ allBlocked, maxFetchKm }) =>
  allBlocked && maxFetchKm >= MIN_FETCH_KM && maxFetchKm <= MAX_FETCH_KM;

// ── Load every shipped profile ────────────────────────────────────────────────────────────────
const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
const jsonArg = process.argv.indexOf('--json');
const onlyArg = process.argv.indexOf('--only');
const onlyIds = onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(',').map(Number)) : null;

const dir = path.join(root, 'public/data/geospatial/exposure');
const beaches = [];
for (const file of readdirSync(dir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  const doc = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  const profiles = Array.isArray(doc.profiles) ? doc.profiles : Object.values(doc.profiles ?? {});
  for (const p of profiles) {
    const s = SECTORS.map(x => p.sectors?.[x]);
    if (!s.every(x => x && typeof x.fetchKm === 'number' && typeof x.blockedRayRatio === 'number')) continue;
    if (onlyIds && !onlyIds.has(p.beachId)) continue;
    beaches.push({
      id: p.beachId,
      name: p.name?.gr ?? p.name?.en,
      region: file.replace('.json', ''),
      lat: p.coordinates.lat,
      lon: p.coordinates.lon,
      confidence: p.confidence,
      shipped: {
        maxFetchKm: Number(Math.max(...s.map(x => x.fetchKm)).toFixed(2)),
        allBlocked: s.every(x => x.blockedRayRatio >= REQUIRED_BLOCKED_RATIO),
        minBlockedRatio: Math.min(...s.map(x => x.blockedRayRatio)),
      },
      sampleDistanceKm: p.marineSamplePoint?.distanceKm ?? null,
    });
  }
}

console.error(`Profiles: ${beaches.length}. Loading coastline mask…`);
const mask = loadMask();
const isLand = makeIsLand(mask);
console.error(`Mask: ${mask.polys.length} polygons.\n`);

const findings = [];
const skipped = { noOwnWater: 0, openByPrefilter: 0 };
const started = Date.now();
let done = 0;

for (const b of beaches.slice(0, limit)) {
  done += 1;
  if (done % 200 === 0) {
    const rate = done / ((Date.now() - started) / 1000);
    console.error(`  ${done}/${Math.min(limit, beaches.length)} — ${findings.length} found — ${rate.toFixed(1)}/s`);
  }

  const own = findOwnWater(isLand, b.lat, b.lon);
  if (!own) { skipped.noOwnWater += 1; continue; }

  // Cheap prefilter: one ray per sector centre. A single unblocked ray at 25 km means the fan can
  // never be all-blocked, so the expensive 40-ray pass is pointless. No beach is dropped silently —
  // the count is reported.
  let open = false;
  for (const name of SECTORS) {
    if (!castRay(isLand, own.lat, own.lon, SECTOR_CENTRE[name]).blocked) { open = true; break; }
  }
  if (open) { skipped.openByPrefilter += 1; continue; }

  const fan = castFan(isLand, own.lat, own.lon);
  if (!passesGate(fan)) continue;
  // Already visible to the existing funnel — not a blind spot, nothing new to report.
  if (passesGate(b.shipped) && b.confidence === 'high') continue;

  const builder = findBuilderOrigin(isLand, b.lat, b.lon);
  findings.push({
    ...b,
    ownWater: { lat: Number(own.lat.toFixed(5)), lon: Number(own.lon.toFixed(5)), offsetM: own.offsetM },
    builderOrigin: builder
      ? { lat: Number(builder.lat.toFixed(5)), lon: Number(builder.lon.toFixed(5)), offsetM: builder.offsetM }
      : null,
    originGapM: builder ? metresBetween(own, builder) : null,
    own: { maxFetchKm: fan.maxFetchKm, allBlocked: fan.allBlocked, sectors: fan.sectors },
  });
  console.error(
    `  ★ ${b.name} [${b.region}] id ${b.id} — own water ${fan.maxFetchKm} km max, ` +
    `shipped ${b.shipped.maxFetchKm} km (blocked min ${b.shipped.minBlockedRatio})` +
    (builder ? `, origins ${metresBetween(own, builder)} m apart` : '')
  );
}

findings.sort((a, b) => b.shipped.maxFetchKm - a.shipped.maxFetchKm);

console.log(`\nScanned: ${Math.min(limit, beaches.length)} profiles`);
console.log(`Skipped — no water within ${OWN_WATER_SEARCH_KM * 1000} m of the pin: ${skipped.noOwnWater}`);
console.log(`Skipped — open sea on a sector centre: ${skipped.openByPrefilter}`);
console.log(`BLIND SPOT (own water enclosed, shipped profile says otherwise): ${findings.length}\n`);
for (const f of findings) {
  console.log(
    `${String(f.id).padStart(5)}  ${(f.name ?? '').padEnd(28)} ${f.region.padEnd(38)} ` +
    `own ${String(f.own.maxFetchKm).padStart(5)} km | shipped ${String(f.shipped.maxFetchKm).padStart(5)} km | ` +
    `origins ${f.originGapM ?? '-'} m apart`
  );
}
console.log(`\nFeed these to the two witnesses that actually admit a beach (§Γ1):`);
console.log(`  node --max-old-space-size=4096 scripts/auditEnclosedWater.mjs --probe ${findings.map(f => f.id).join(',')}`);

if (jsonArg > -1) {
  const out = process.argv[jsonArg + 1];
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify({
    generatedAt: new Date().toISOString(),
    scanned: Math.min(limit, beaches.length),
    skipped,
    settings: { NEAR_STEP_KM, NEAR_FIELD_KM, FAR_STEP_KM, MAX_RAY_KM, OWN_WATER_SEARCH_KM, OWN_WATER_STEP_KM },
    findings,
  }, null, 1));
  console.error(`Wrote ${out}`);
}
