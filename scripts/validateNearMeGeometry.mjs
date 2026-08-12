/**
 * "ΚΟΝΤΑ ΜΟΥ" READS THE SAME GEOMETRY AS THE ISLAND IT BORROWED FROM — gate.
 *
 * Found 12/08/2026 in Netlify's 404 log, not by any gate: `/data/geospatial/exposure/near-me.json`
 * was the single most-requested missing resource on the site, 866 times in a day. "near-me" is a
 * SYNTHETIC region id — the cross-region view merges beaches from the real regions around the
 * user and re-keys them to globally-unique ids — so that file does not exist and never will.
 *
 * App.tsx knew this and merged the constituent regions by hand. hooks/useWeather.ts did not, and
 * passed island.id straight to the loader. The damage was silent: with no profiles,
 * resolveBeachMarinePoints has no marineSamplePoint to place a beach's own sea cell with, so
 * loadBeachMarine returned null and EVERY beach in a 40 km radius read one region-centre cell —
 * exactly the defect validateBeachMarineResolution.mjs exists to prevent, in the one view that
 * validator cannot see. It walks the 110 committed region files; "near-me" is not one of them.
 *
 * Two independent claims, because either alone can pass while the feature is broken:
 *   - no request is ever made for a synthetic region's own profile file (the 404), and
 *   - the merged result actually resolves per-beach geometry under the synthetic ids (the harm).
 *
 * Synthetic ids restart at 1 per near-me build and therefore COLLIDE with real region-scoped
 * ids. That is why RULE 2 checks identity and not merely presence: a merge keyed by the wrong id
 * would hand beach #1 of Naxos the geometry of beach #1 of Paros and look perfectly healthy.
 *
 * Runs the shipping service, with fetch served from the committed data. No network.
 *
 * Run: node scripts/validateNearMeGeometry.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const publicDir = path.join(root, 'public');

/** Every URL the service asked for, in order. The first claim is about this list. */
const requested = [];

globalThis.fetch = async (url) => {
  requested.push(String(url));
  const filePath = path.join(publicDir, String(url).replace(/^\//, ''));
  if (!existsSync(filePath)) {
    return { ok: false, status: 404, json: async () => { throw new Error('not found'); } };
  }
  const body = JSON.parse(readFileSync(filePath, 'utf8'));
  return { ok: true, status: 200, json: async () => body };
};

// THE code that ships, not a copy of it. scripts/validateEffectiveRanking.ts:16-18 records a gate
// that passed green on deliberately sabotaged code because it had re-implemented its subject.
const {
  loadGeospatialExposureProfilesForBeaches,
  NEAR_ME_REGION_ID,
} = require(path.join(root, 'services/geospatialExposureService.ts'));
const { resolveBeachMarinePoints } = require(path.join(root, 'utils/marineSamplePoints.ts'));

const failures = [];

/** Regions that actually carry offshore sample points, so the merge has something to prove. */
const regionsWithSamplePoints = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .map(name => {
    const regionId = name.replace(/\.json$/, '');
    const profiles = JSON.parse(readFileSync(path.join(exposureDir, name), 'utf8')).profiles ?? {};
    const usable = Object.values(profiles).filter(
      profile => profile?.marineSamplePoint && profile.beachId != null
    );
    return { regionId, usable };
  })
  .filter(entry => entry.usable.length >= 5);

if (regionsWithSamplePoints.length < 2) {
  console.error('FAIL — fewer than two regions carry marine sample points; the geometry build is broken.');
  process.exit(1);
}

/**
 * A near-me view built the way App.tsx builds it: beaches drawn from several real regions,
 * `id` reassigned from 1 upward, the real id kept in `sourceBeachId`.
 */
const contributingRegions = regionsWithSamplePoints.slice(0, 3);
let nextSyntheticId = 1;
const nearMeBeaches = contributingRegions.flatMap(({ regionId, usable }) =>
  usable.slice(0, 8).map(profile => ({
    id: nextSyntheticId++,
    sourceBeachId: profile.beachId,
    regionId,
    expectedSample: profile.marineSamplePoint,
  }))
);

const merged = await loadGeospatialExposureProfilesForBeaches(NEAR_ME_REGION_ID, nearMeBeaches);

// RULE 1 — the synthetic region's own file is never requested.
const syntheticRequests = requested.filter(url => url.includes(`/${NEAR_ME_REGION_ID}.json`));
if (syntheticRequests.length > 0) {
  failures.push(
    `RULE 1 — the loader asked for ${syntheticRequests[0]}. That file does not exist in the build; ` +
    'this is the 866-a-day 404, and every request that returns it costs the view its geometry.'
  );
}

// RULE 2 — each beach resolves to ITS OWN geometry, under the synthetic id.
if (!merged) {
  failures.push(
    `RULE 2 — the merge returned nothing for ${nearMeBeaches.length} beaches drawn from ` +
    `${contributingRegions.length} regions that all carry geometry. "Κοντά μου" is scoring blind.`
  );
} else {
  const missing = nearMeBeaches.filter(beach => !merged[beach.id]);
  if (missing.length > 0) {
    failures.push(
      `RULE 2 — ${missing.length}/${nearMeBeaches.length} beaches have geometry on their home ` +
      `island but none under their synthetic id (first: ${missing[0].regionId} #${missing[0].sourceBeachId}).`
    );
  }
  const misfiled = nearMeBeaches.filter(
    beach => merged[beach.id] && merged[beach.id].beachId !== beach.sourceBeachId
  );
  if (misfiled.length > 0) {
    const first = misfiled[0];
    failures.push(
      `RULE 2 — ${misfiled.length} beaches carry ANOTHER beach's geometry: synthetic #${first.id} ` +
      `(${first.regionId} #${first.sourceBeachId}) resolved to #${merged[first.id].beachId}. ` +
      'Synthetic ids restart at 1 and collide with real ones, so a mis-keyed merge looks healthy.'
    );
  }
}

// RULE 3 — the sea cells survive the merge, which is the whole point of loading the geometry.
const regionPoint = { lat: 37.0, lon: 25.0 };
const resolution = resolveBeachMarinePoints(nearMeBeaches, merged, regionPoint);
if (resolution.ownShoreBeachIds.length < nearMeBeaches.length) {
  failures.push(
    `RULE 3 — only ${resolution.ownShoreBeachIds.length}/${nearMeBeaches.length} near-me beaches ` +
    'read their own shore; the rest fall back to one area cell for beaches up to 40 km apart.'
  );
}

// RULE 4 — a genuinely missing region is asked for once, not on every render.
const beforeRetry = requested.length;
const absentRegion = 'no-such-region-gate-probe';
await loadGeospatialExposureProfilesForBeaches(absentRegion, []);
await loadGeospatialExposureProfilesForBeaches(absentRegion, []);
const probeRequests = requested.length - beforeRetry;
if (probeRequests > 1) {
  failures.push(
    `RULE 4 — a 404 was re-requested ${probeRequests} times for the same region. A missing file is ` +
    'permanent; retrying it is what turned one bad id into 866 requests in a day.'
  );
}

if (failures.length > 0) {
  console.error('FAIL — "Κοντά μου" is not reading real geometry.\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(
  `Near-me geometry: ${nearMeBeaches.length} beaches merged from ${contributingRegions.length} regions ` +
  `(${contributingRegions.map(r => r.regionId).join(', ')}).`
);
console.log(
  `  ${resolution.ownShoreBeachIds.length} read their own shore across ${resolution.points.length} sea points; ` +
  `${requested.length - probeRequests} profile files fetched, 0 for the synthetic id.`
);
console.log('PASS — the cross-region view keeps the geometry of the islands it borrowed from.');
