// Read-only diagnostic. Does the baked `shelteredFromLocalWind` flag produce
// sane results? Nothing is written except this file's stdout; no existing file
// is touched.
//
// What "sheltered" means (see utils/windClimatology.ts summarizeLocalWindBehavior
// + scripts/bakeLocalWindShelter.ts): the flag is 'protected' when the geospatial
// exposure profile's LOCAL-WIND sectors (meltemi N+NE / maistros NW+W) are all
// 'protected', with curated overrides able to force 'exposed'. It keys off the
// PER-SECTOR openness of the profile — NOT the beach's shoreline-facing angle.
//
// This audit cross-checks that per-sector decision against the independent
// `orientation.degrees` (shoreline-facing) field. If a beach is marked sheltered
// yet FACES into the wind's arc, the two signals disagree — a red flag, because a
// beach facing the wind has open water toward it by construction.

import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getRegionWindContext, LOCAL_WIND_SECTORS, localWindLabelFor } from '../utils/localWindContext.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');
const publicDir = path.join(projectRoot, 'public');
const readJson = async p => JSON.parse(await readFile(p, 'utf8'));

const beachIndex = await readJson(path.join(publicDir, 'data', 'beaches', 'index.json'));

// Suspicious facing arcs — a sheltered beach whose shoreline faces INTO the wind
// is contradictory. Arcs per the brief (regime → [start°, end°], inclusive, may
// wrap through 0°).
const SUSPECT_ARC = {
  aegean: [340, 110],   // meltemi from N/NE  → facing N-ish is into the wind
  ionian: [255, 25],    // maistros from NW/W → facing NW-ish is into the wind
  thermaic: [255, 25],  // Thermaic summer NW/W breeze — same geometry as maistros
};
const regimeName = { aegean: 'meltemi', ionian: 'maistros', thermaic: 'summer-wind' };

// Inclusive membership on a compass arc that may wrap through 0°.
const inArc = (deg, [start, end]) => {
  const d = ((deg % 360) + 360) % 360;
  return start <= end ? d >= start && d <= end : d >= start || d <= end;
};

const regionRows = [];      // { region, regime, total, sheltered, pct }
const inconsistencies = []; // { region, beach, orientation, regime, shelterScore }
const wideOpen = [];        // Xygia-class: flagged sheltered yet 'exposed' with big fetch in a NON-wind sector
let evaluatedSheltered = 0; // sheltered beaches that HAD an orientation angle
let shelteredNoOrientation = 0;
const caseDump = {};        // raw dumps for the two named beaches
const WIDE_OPEN_FETCH_KM = 10; // "wide open" = a sector at 'exposed' with >= this much fetch

const CASE_IDS = new Set([1191, 1195, 1198, 1182]); // Xygia / Mikri Xygia / Ag.Nikolaos Vasilikou / Volimon

for (const region of beachIndex.regions || []) {
  const summaryPath = path.join(publicDir, 'data', 'beaches', 'app', 'summary', `${region.id}.json`);
  let payload;
  try {
    payload = await readJson(summaryPath);
  } catch {
    try {
      payload = await readJson(path.join(publicDir, region.appDataPath.replace(/^\/+/, '')));
    } catch (err) {
      console.error(`# SKIP ${region.id}: ${err.message}`);
      continue;
    }
  }
  const beaches = (payload.island?.beaches || []).filter(b => Number.isInteger(b.id) && b.name);

  // Per-sector exposure profile (for the shelterScore context column).
  const exPath = path.join(publicDir, 'data', 'geospatial', 'exposure', `${region.id}.json`);
  const profiles = existsSync(exPath) ? ((await readJson(exPath)).profiles || {}) : {};

  const regime = getRegionWindContext(region.id);
  const windSectors = LOCAL_WIND_SECTORS[regime];
  const arc = SUSPECT_ARC[regime];

  const total = beaches.length;
  const shelteredBeaches = beaches.filter(b => b.shelteredFromLocalWind === true);
  const pct = total > 0 ? (shelteredBeaches.length / total) * 100 : 0;
  regionRows.push({ region: region.id, regime, total, sheltered: shelteredBeaches.length, pct });

  for (const b of shelteredBeaches) {
    const deg = b.orientation?.degrees;
    // "shelterScore" context: the worst (max intensity) wind-sector reading the
    // model saw for this beach, plus its level — this is what justified 'protected'.
    const prof = profiles[String(b.id)];
    let shelterScore = 'n/a';
    if (prof?.sectors) {
      const parts = windSectors.map(s => {
        const sec = prof.sectors[s];
        return sec ? `${s}:${sec.level}/int${sec.intensity}/fetch${sec.fetchKm}km` : `${s}:—`;
      });
      shelterScore = parts.join(' ');
    }

    if (CASE_IDS.has(b.id)) {
      caseDump[b.id] = { summary: b, exposureProfile: prof ?? null, regime, windSectors, arc };
    }

    // Xygia-class: the beach IS blocked toward the modelled wind sectors (so it
    // earns 'sheltered'), but it is wide open ('exposed', big fetch) in some OTHER
    // sector the single-regime model never checks. Not caught by the arc test.
    if (prof?.sectors) {
      const open = Object.entries(prof.sectors)
        .filter(([s, sec]) => !windSectors.includes(s) && sec?.level === 'exposed' && sec.fetchKm >= WIDE_OPEN_FETCH_KM)
        .map(([s, sec]) => `${s}:fetch${sec.fetchKm}km/int${sec.intensity}`);
      if (open.length) {
        wideOpen.push({ region: region.id, beachId: b.id, beach: b.name.en, regime: regimeName[regime], openSectors: open.join(' ') });
      }
    }

    if (typeof deg !== 'number') { shelteredNoOrientation += 1; continue; }
    evaluatedSheltered += 1;
    if (inArc(deg, arc)) {
      // Severity: how much open water toward the modelled wind sectors despite the
      // 'protected' verdict (high fetch here = genuinely open, not enclosed-bay noise).
      let maxWindFetch = 0, maxWindIntensity = 0;
      if (prof?.sectors) {
        for (const s of windSectors) {
          const sec = prof.sectors[s];
          if (sec) { maxWindFetch = Math.max(maxWindFetch, sec.fetchKm); maxWindIntensity = Math.max(maxWindIntensity, sec.intensity); }
        }
      }
      inconsistencies.push({
        region: region.id, beachId: b.id, beach: b.name.en, orientation: deg,
        regime: regimeName[regime], maxWindFetch, maxWindIntensity, shelterScore,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// A. Extreme regions (>=80% or <=5% sheltered)
// ---------------------------------------------------------------------------
console.log('=== A. EXTREME REGIONS (shelteredPct >= 80% or <= 5%) ===');
console.log('region,regime,total,sheltered,pct');
const extremes = regionRows
  .filter(r => r.pct >= 80 || r.pct <= 5)
  .sort((a, b) => b.pct - a.pct);
for (const r of extremes) {
  console.log(`${r.region},${regimeName[r.regime]},${r.total},${r.sheltered},${r.pct.toFixed(1)}%`);
}
console.log(`(${extremes.length} extreme regions of ${regionRows.length})`);

// ---------------------------------------------------------------------------
// B. Orientation-consistency check
// ---------------------------------------------------------------------------
console.log('\n=== B. ORIENTATION INCONSISTENCIES (sheltered but facing INTO the wind arc) ===');
console.log('# sorted by maxWindFetch desc — high fetch = genuinely open water toward the wind (real), low = likely enclosed-bay / facing-noise');
console.log('region,beachId,beach,orientationDeg,regime,maxWindFetchKm,maxWindIntensity,shelterScore');
inconsistencies.sort((a, b) => b.maxWindFetch - a.maxWindFetch || a.region.localeCompare(b.region));
for (const x of inconsistencies) {
  console.log(`${x.region},${x.beachId},"${x.beach}",${x.orientation},${x.regime},${x.maxWindFetch},${x.maxWindIntensity},"${x.shelterScore}"`);
}
console.log(`(${inconsistencies.length} inconsistencies; ${inconsistencies.filter(x => x.maxWindFetch >= 5).length} with >=5km open water toward the wind)`);

console.log('\n=== B2. WIDE-OPEN "SHELTERED" BEACHES (Xygia class — blind spot of the single-regime model) ===');
console.log(`# flagged sheltered from the local wind, yet 'exposed' with >=${WIDE_OPEN_FETCH_KM}km fetch in a sector the regime never checks`);
console.log('region,beachId,beach,regime,exposedNonWindSectors');
wideOpen.sort((a, b) => a.region.localeCompare(b.region) || a.beachId - b.beachId);
for (const x of wideOpen.slice(0, 60)) {
  console.log(`${x.region},${x.beachId},"${x.beach}",${x.regime},"${x.openSectors}"`);
}
console.log(`(${wideOpen.length} wide-open sheltered beaches total; showing up to 60)`);

// ---------------------------------------------------------------------------
// C. Named cases — full raw data, unfiltered
// ---------------------------------------------------------------------------
console.log('\n=== C. NAMED CASES (full raw data) ===');
for (const id of [1198, 1191, 1195, 1182]) {
  if (caseDump[id]) {
    console.log(`\n--- beach id ${id} ---`);
    console.log(JSON.stringify(caseDump[id], null, 2));
  } else {
    console.log(`\n--- beach id ${id}: not found among sheltered beaches ---`);
  }
}

// ---------------------------------------------------------------------------
// D. Summary
// ---------------------------------------------------------------------------
console.log('\n=== D. SUMMARY ===');
console.log(`# regions audited: ${regionRows.length}`);
console.log(`# total sheltered beaches: ${regionRows.reduce((s, r) => s + r.sheltered, 0)}`);
console.log(`# sheltered beaches WITH an orientation angle (evaluated by B): ${evaluatedSheltered}`);
console.log(`# sheltered beaches WITHOUT an orientation angle (not evaluable): ${shelteredNoOrientation}`);
console.log(`# ORIENTATION-INCONSISTENT sheltered beaches: ${inconsistencies.length}` +
  (evaluatedSheltered ? ` (${((inconsistencies.length / evaluatedSheltered) * 100).toFixed(1)}% of evaluable)` : ''));
const byRegime = inconsistencies.reduce((m, x) => (m[x.regime] = (m[x.regime] || 0) + 1, m), {});
console.log(`# inconsistencies by regime: ${JSON.stringify(byRegime)}`);
console.log(`#   of those, with >=5km open water toward the wind (strong signal): ${inconsistencies.filter(x => x.maxWindFetch >= 5).length}`);
console.log(`# B2 wide-open sheltered beaches ('exposed' >=${WIDE_OPEN_FETCH_KM}km in a non-wind sector): ${wideOpen.length} of ${regionRows.reduce((s, r) => s + r.sheltered, 0)} sheltered (${((wideOpen.length / regionRows.reduce((s, r) => s + r.sheltered, 0)) * 100).toFixed(1)}%)`);
