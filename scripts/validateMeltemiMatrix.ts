/**
 * Meltemi validation MATRIX — roadmap #1, the measurement foundation.
 *
 * Unlike scripts/validateWindExposureGroundTruth.mjs (which checks the STORED
 * geometry sector levels), this harness runs the REAL engine
 * (assessBeachWindExposure) — what recommendations actually consume — across a
 * scenario grid x island-group, and prints an accuracy/property baseline.
 *
 * Passes:
 *   1. LABEL — reuses the 128 ground-truth cases (regex-extracted from
 *      validateWindExposureGroundTruth.mjs so there is one source of truth) and
 *      asserts the engine's exposureLevel for wind blowing FROM each case's
 *      sector (Bft 5). Upgrades the stored-level check to a real-engine check.
 *   2. PROPERTY — label-free invariants over EVERY beach:
 *        a. no-false-protected: an open ONSHORE sector (fetch>=15km, onshore>=0.8)
 *           must not resolve to 'protected' under wind from that sector.
 *        b. monotonicity: severity(N6) >= severity(N5) >= severity(N3).
 *        c. onshore >= offshore: facing-aligned wind is never calmer than the
 *           opposite wind.
 *   3. SIGNALS (measurement, not pass/fail):
 *        - stored-geometry recall on open onshore sectors (high partial% = the
 *          known blockedRayRatio under-warn).
 *        - per group x scenario suitabilityColor mix (the Beaufort-varying signal;
 *          exposureLevel itself is speed-invariant, so colour is where N3->N6 moves).
 *
 * Measurement only — no model/runtime code is changed. Run:
 *   node scripts/validateMeltemiMatrix.mjs [--json <out>]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { assessBeachWindExposure } from '../utils/windExposureEngine';
import { degToCompass, getBeaufortLevel } from '../utils/weatherUtils';
import { computeSwellSurgePenalty } from '../utils/swellSurge';
import type { Beach, GeospatialExposureProfile, WindSector } from '../types';

const APP_DIR = path.join('public', 'data', 'beaches', 'app');
const EXP_DIR = path.join('public', 'data', 'geospatial', 'exposure');
const jsonOutPath = (() => {
  const i = process.argv.indexOf('--json');
  return i === -1 ? '.tmp/meltemi-matrix-baseline.json' : process.argv[i + 1];
})();

const SECTOR_DEG: Record<WindSector, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
};
const SEVERITY: Record<string, number> = { protected: 0, partial: 1, exposed: 2 };
type Level = 'protected' | 'partial' | 'exposed';

const SCENARIOS: Array<{ key: string; deg: number; kmh: number; wave: number }> = [
  { key: 'N3', deg: 0, kmh: 19, wave: 0.3 },
  { key: 'N5', deg: 0, kmh: 32, wave: 0.7 },
  { key: 'N6', deg: 0, kmh: 44, wave: 1.2 },
  { key: 'NE5', deg: 45, kmh: 32, wave: 0.7 },
  { key: 'NW5', deg: 315, kmh: 32, wave: 0.7 },
  { key: 'S5', deg: 180, kmh: 32, wave: 0.7 },
  { key: 'choppy3', deg: 0, kmh: 19, wave: 0.6 },
];

const DODECANESE = new Set([
  'south-aegean-kalymnos', 'south-aegean-karpathos', 'south-aegean-kasos', 'south-aegean-kos',
  'south-aegean-leros', 'south-aegean-lipsi', 'south-aegean-nisyros', 'south-aegean-patmos',
  'south-aegean-rhodes', 'south-aegean-symi', 'south-aegean-tilos', 'south-aegean-astypalaia',
  'south-aegean-agathonisi', 'south-aegean-arki', 'south-aegean-marathi', 'south-aegean-telendos',
  'south-aegean-pserimos', 'south-aegean-halki', 'south-aegean-kastellorizo',
]);
const groupForRegion = (id: string): string => {
  if (id.startsWith('ionian-islands-')) return 'ionian';
  if (id.startsWith('crete-')) return 'crete';
  if (id.startsWith('north-aegean-')) return 'n-aegean';
  if (id.startsWith('south-aegean-')) return DODECANESE.has(id) ? 'dodecanese' : 'cyclades';
  return 'mainland';
};
const REGIME_SCENARIOS: Record<string, string[]> = {
  cyclades: ['N3', 'N5', 'N6', 'NE5', 'S5', 'choppy3'],
  dodecanese: ['N3', 'N5', 'N6', 'NE5', 'S5', 'choppy3'],
  'n-aegean': ['N3', 'N5', 'N6', 'NE5', 'S5', 'choppy3'],
  mainland: ['N3', 'N5', 'N6', 'NE5', 'NW5', 'S5', 'choppy3'],
  ionian: ['NW5', 'S5', 'N5'],
  crete: ['N5', 'N6', 'S5', 'NW5'],
};

const norm = (v: unknown): string =>
  (v || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

type Region = { beaches: Beach[]; profiles: Record<string, GeospatialExposureProfile> };
const regionCache: Record<string, Region> = {};
const loadRegion = (regionId: string): Region => {
  if (regionCache[regionId]) return regionCache[regionId];
  let beaches: Beach[] = [];
  let profiles: Record<string, GeospatialExposureProfile> = {};
  try {
    const app = JSON.parse(readFileSync(path.join(APP_DIR, `${regionId}.json`), 'utf8'));
    beaches = (app.island?.beaches || []) as Beach[];
  } catch { /* region file missing */ }
  try {
    profiles = (JSON.parse(readFileSync(path.join(EXP_DIR, `${regionId}.json`), 'utf8')).profiles || {}) as Record<string, GeospatialExposureProfile>;
  } catch { /* no profiles */ }
  regionCache[regionId] = { beaches, profiles };
  return regionCache[regionId];
};

const runEngine = (beach: Beach, profile: GeospatialExposureProfile | undefined, deg: number, kmh: number, wave: number) =>
  assessBeachWindExposure({
    beach,
    geospatialProfile: profile,
    windDirectionDeg: deg,
    windDirection: degToCompass(deg),
    windSpeedKmh: kmh,
    beaufort: getBeaufortLevel(kmh),
    waveHeightMeters: wave,
  });

const matchesExpectation = (level: string | undefined, expected: string): boolean => {
  if (expected === 'calm') return level !== 'exposed';
  if (expected === 'rough') return level !== 'protected';
  return level === expected;
};
const findBeach = (beaches: Beach[], name: string): Beach | undefined => {
  const t = norm(name);
  return beaches.find(b => {
    const n = b.name as { en?: string; gr?: string };
    return norm(n?.en).includes(t) || norm(n?.gr).includes(t);
  });
};

// ---------------------------------------------------------------------------
// LABEL PASS — extract the 128 GT cases from the .mjs (single source of truth)
// ---------------------------------------------------------------------------
const gtText = readFileSync(path.join('scripts', 'validateWindExposureGroundTruth.mjs'), 'utf8');
const caseRe = /\{\s*regionId:\s*'([^']+)',\s*name:\s*'([^']+)',\s*sector:\s*'([^']+)',\s*expected:\s*'([^']+)'\s*\}/g;
const gtCases = [...gtText.matchAll(caseRe)].map(m => ({ regionId: m[1], name: m[2], sector: m[3] as WindSector, expected: m[4] }));

const labelByGroup: Record<string, { pass: number; total: number }> = {};
let labelPass = 0, labelFail = 0, labelSkip = 0;
const labelFailures: string[] = [];
for (const c of gtCases) {
  const { beaches, profiles } = loadRegion(c.regionId);
  const beach = findBeach(beaches, c.name);
  const deg = SECTOR_DEG[c.sector];
  if (!beach || deg == null) { labelSkip++; continue; }
  const profile = profiles[String(beach.id)];
  const a = runEngine(beach, profile, deg, 32, 0.7);
  const ok = matchesExpectation(a.exposureLevel, c.expected);
  const g = groupForRegion(c.regionId);
  if (!labelByGroup[g]) labelByGroup[g] = { pass: 0, total: 0 };
  labelByGroup[g].total++;
  if (ok) { labelPass++; labelByGroup[g].pass++; }
  else { labelFail++; labelFailures.push(`${c.regionId}/${c.name} @${c.sector}: engine=${a.exposureLevel} [${a.source}], expected ${c.expected}`); }
}

// ---------------------------------------------------------------------------
// PROPERTY + SIGNALS PASS — over every beach
// ---------------------------------------------------------------------------
const regionFiles = readdirSync(APP_DIR).filter(f => f.endsWith('.json'));
let beachCount = 0;
const falseProtected: string[] = [];
const monotonicityViolations: string[] = [];
const onshoreViolations: string[] = [];
const groupScenario: Record<string, Record<string, { protected: number; partial: number; exposed: number }>> = {};
const groupColor: Record<string, Record<string, Record<string, number>>> = {};
// stored-geometry recall on open onshore sectors (fetch>=15km, onshore>=0.8)
const recall: Record<string, { exposed: number; partial: number; protected: number }> = { ALL: { exposed: 0, partial: 0, protected: 0 } };
const underWarn: string[] = []; // open onshore sector stored as partial (blockedRayRatio symptom)

for (const f of regionFiles) {
  const regionId = f.replace('.json', '');
  const g = groupForRegion(regionId);
  const { beaches, profiles } = loadRegion(regionId);
  if (!groupScenario[g]) groupScenario[g] = {};
  if (!groupColor[g]) groupColor[g] = {};
  if (!recall[g]) recall[g] = { exposed: 0, partial: 0, protected: 0 };
  for (const beach of beaches) {
    const profile = profiles[String(beach.id)];
    const en = (beach.name as { en?: string })?.en;
    beachCount++;
    const sev: Record<string, number> = {};
    for (const s of SCENARIOS) {
      const a = runEngine(beach, profile, s.deg, s.kmh, s.wave);
      sev[s.key] = SEVERITY[a.exposureLevel];
      if (!groupScenario[g][s.key]) groupScenario[g][s.key] = { protected: 0, partial: 0, exposed: 0 };
      groupScenario[g][s.key][a.exposureLevel as Level]++;
      const col = a.simpleWindSuitability.suitabilityColor;
      if (!groupColor[g][s.key]) groupColor[g][s.key] = {};
      groupColor[g][s.key][col] = (groupColor[g][s.key][col] || 0) + 1;
    }
    if (sev.N3 > sev.N5 || sev.N5 > sev.N6) {
      monotonicityViolations.push(`#${beach.id} ${en} (${regionId}): N3=${sev.N3} N5=${sev.N5} N6=${sev.N6}`);
    }
    if (profile?.sectors) {
      for (const sec of Object.keys(profile.sectors) as WindSector[]) {
        const sd = profile.sectors[sec] as { fetchKm?: number; onshore?: number; level?: Level };
        if ((sd?.fetchKm || 0) < 15 || (sd?.onshore ?? 0) < 0.8) continue; // open onshore sectors only
        // SIGNAL: stored geometry recall (high partial% = blockedRayRatio under-warn)
        const stored = (sd.level || 'partial') as Level;
        recall.ALL[stored]++; recall[g][stored]++;
        if (stored === 'partial') underWarn.push(`#${beach.id} ${en} (${regionId}) ${sec}: fetch=${sd.fetchKm} onshore=${sd.onshore} stored=partial`);
        // PROPERTY: engine must not resolve protected on an open onshore sector at Bft5 (dangerous)
        const a = runEngine(beach, profile, SECTOR_DEG[sec], 32, 0.7);
        if (a.exposureLevel === 'protected' && a.source !== 'override') {
          falseProtected.push(`#${beach.id} ${en} (${regionId}) ${sec}: fetch=${sd.fetchKm} -> engine protected [${a.source}]`);
        }
      }
    }
    if (typeof profile?.facingDeg === 'number' && Number.isFinite(profile.facingDeg)) {
      const on = SEVERITY[runEngine(beach, profile, profile.facingDeg, 32, 0.7).exposureLevel];
      const off = SEVERITY[runEngine(beach, profile, (profile.facingDeg + 180) % 360, 32, 0.7).exposureLevel];
      if (on < off) onshoreViolations.push(`#${beach.id} ${en} (${regionId}): onshore=${on} < offshore=${off}`);
    }
  }
}

// ---------------------------------------------------------------------------
// REPORT
// ---------------------------------------------------------------------------
const pct = (n: number, d: number) => (d > 0 ? Math.round((100 * n) / d) : 0);
const groups = ['cyclades', 'dodecanese', 'n-aegean', 'mainland', 'ionian', 'crete'];

console.log('=== MELTEMI VALIDATION MATRIX — baseline ===');
console.log(`Beaches evaluated: ${beachCount} | GT label cases: ${gtCases.length} (skipped ${labelSkip})\n`);

console.log('LABEL accuracy (real engine vs ground-truth), per island-group:');
for (const g of groups) {
  const s = labelByGroup[g];
  if (s) console.log(`  ${g.padEnd(11)} ${s.pass}/${s.total} (${pct(s.pass, s.total)}%)`);
}
console.log(`  ${'OVERALL'.padEnd(11)} ${labelPass}/${labelPass + labelFail} (${pct(labelPass, labelPass + labelFail)}%)\n`);

console.log('PROPERTY invariants:');
console.log(`  no-false-protected (open onshore sector -> engine protected, non-curated): ${falseProtected.length}`);
console.log(`  monotonicity (N6>=N5>=N3): ${monotonicityViolations.length}`);
console.log(`  onshore>=offshore: ${onshoreViolations.length}\n`);

console.log('SIGNAL — stored-geometry recall on open ONSHORE sectors (fetch>=15km & onshore>=0.8):');
console.log('  high partial% = blockedRayRatio under-warn (one tier too calm)');
for (const g of ['ALL', ...groups]) {
  const o = recall[g];
  if (!o) continue;
  const t = o.exposed + o.partial + o.protected;
  if (t === 0) continue;
  console.log(`  ${g.padEnd(11)} exposed ${pct(o.exposed, t)}% | partial ${pct(o.partial, t)}% | protected ${pct(o.protected, t)}%  (n=${t})`);
}

console.log('\nSIGNAL — suitabilityColor mix per group x scenario (green/yellow/orange/red %); the Beaufort ramp:');
for (const g of groups) {
  if (!groupColor[g]) continue;
  console.log(`  [${g}]`);
  for (const key of REGIME_SCENARIOS[g]) {
    const c = groupColor[g][key];
    if (!c) continue;
    const t = (c.green || 0) + (c.yellow || 0) + (c.orange || 0) + (c.red || 0);
    console.log(`    ${key.padEnd(8)} ${pct(c.green || 0, t)}/${pct(c.yellow || 0, t)}/${pct(c.orange || 0, t)}/${pct(c.red || 0, t)}  (n=${t})`);
  }
}

if (labelFail > 0) {
  console.log(`\nLabel failures (${labelFail}):`);
  labelFailures.forEach(l => console.log(`  - ${l}`));
}
if (falseProtected.length > 0) {
  console.log(`\nFALSE-PROTECTED (dangerous, review):`);
  falseProtected.slice(0, 40).forEach(l => console.log(`  - ${l}`));
  if (falseProtected.length > 40) console.log(`  ... +${falseProtected.length - 40} more`);
}
if (onshoreViolations.length > 0) {
  console.log(`\nonshore<offshore (${onshoreViolations.length}):`);
  onshoreViolations.slice(0, 20).forEach(l => console.log(`  - ${l}`));
}
console.log(`\nblockedRayRatio under-warn candidates (open onshore stored=partial): ${underWarn.length}`);

// ---------------------------------------------------------------------------
// SWELL-SURGE helper asserts (roadmap #2 regression guard). The engine ignores
// period, so the per-scenario level/colour above already prove period never moves
// the headline (choppy3 stays identical to baseline); these pin the score penalty.
// ---------------------------------------------------------------------------
console.log('\n=== swell-surge penalty asserts (roadmap #2; args = period s, height m) ===');
const surgeCases: Array<[number, number, number]> = [
  [4, 0.7, 0], [4, 0.6, 0], [6.0, 0.7, 0], [10, 0.3, 0], // dormant on short period / tiny ripple
  [8, 0.7, 7], [9, 0.7, 14], [9, 1.0, 22], [10, 1.2, 22], // genuine ground-swell escalation
];
let surgeFail = 0;
for (const [t, h, want] of surgeCases) {
  const got = computeSwellSurgePenalty(t, h);
  if (got !== want) { surgeFail++; console.log(`  FAIL  surge(${t}s, ${h}m) = ${got} (want ${want})`); }
}
for (const [t, h] of [[undefined, 0.7], [9, undefined], [NaN, 0.7]] as Array<[number | undefined, number | undefined]>) {
  if (computeSwellSurgePenalty(t, h) !== 0) { surgeFail++; console.log(`  FAIL  surge(${t}, ${h}) != 0 (missing/NaN must be a no-op)`); }
}
console.log(surgeFail === 0 ? `  all ${surgeCases.length + 3} surge asserts passed (dormant <=6s, escalates >=8s, no-op on missing)` : `  ${surgeFail} surge asserts FAILED`);
if (surgeFail > 0) process.exitCode = 1;

writeFileSync(jsonOutPath, JSON.stringify({
  beachCount,
  label: { pass: labelPass, fail: labelFail, skipped: labelSkip, byGroup: labelByGroup, failures: labelFailures },
  properties: { falseProtected, monotonicityViolations, onshoreViolations },
  signals: { storedRecall: recall, underWarn, groupScenario, groupColor },
}, null, 1), 'utf8');
console.log(`\nBaseline written: ${jsonOutPath}`);
