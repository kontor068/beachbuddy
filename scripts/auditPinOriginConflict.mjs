/**
 * ORIGIN-conflict audit: find beaches where the exposure geometry describes
 * different water than the beach actually faces.
 *
 * This is a DIFFERENT defect from a displaced pin (see scripts/auditPinVsOsm.mjs).
 * The pin can be exactly right — corroborated by OSM to the metre — while the
 * model still samples the wrong water body, because the profile builder searches
 * outward from the pin for a nearshore water origin and can latch onto an
 * adjacent harbour notch or the far side of a headland. Everything downstream
 * (facing, per-sector fetch, cove classification) is then computed for the wrong
 * bay, and moving the pin does NOT fix it.
 *
 * Detector: the authored beachFacingDirection (curated human knowledge) versus
 * the geometry-derived facingDeg. A wide disagreement means one of the two is
 * describing a different piece of coast.
 *
 * Read-only. Run: node scripts/auditPinOriginConflict.mjs [--json <out>] [--min-deg 75]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const OUT = arg('--json', null);
const MIN_DEG = Number(arg('--min-deg', '75'));

const TMP = path.join('.tmp', 'pin-origin');
const BUNDLE = path.join(TMP, 'overrides.mjs');
mkdirSync(TMP, { recursive: true });
await build({
  entryPoints: [path.join('utils', 'windProfileOverrides.ts')],
  bundle: true, platform: 'node', format: 'esm',
  outfile: BUNDLE, external: ['node:*'], logLevel: 'error',
});
const { getWindProfileOverride } = await import(path.resolve(BUNDLE).replace(/\\/g, '/').replace(/^/, 'file:///'));

const angDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const beachDir = path.join('public', 'data', 'beaches', 'app');
const expoDir = path.join('public', 'data', 'geospatial', 'exposure');

let withAuthored = 0;
let comparable = 0;
const suspects = [];

for (const file of readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json' || file === 'search-index.json') continue;
  const regionId = file.replace(/\.json$/, '');
  let beaches = [];
  try { beaches = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')).island?.beaches || []; } catch { continue; }
  let profiles = {};
  const ep = path.join(expoDir, `${regionId}.json`);
  if (existsSync(ep)) { try { profiles = JSON.parse(readFileSync(ep, 'utf8')).profiles || {}; } catch { /* none */ } }

  for (const b of beaches) {
    const override = getWindProfileOverride(b);
    if (!override || typeof override.beachFacingDirection !== 'number') continue;
    withAuthored++;
    const geo = profiles[String(b.id)];
    if (!geo || typeof geo.facingDeg !== 'number') continue;
    comparable++;
    const diff = angDiff(override.beachFacingDirection, geo.facingDeg);
    if (diff >= MIN_DEG) {
      suspects.push({
        id: b.id,
        name: b.name?.gr || b.name?.en || '',
        region: regionId,
        lat: b.coordinates?.lat, lon: b.coordinates?.lon,
        authoredFacingDeg: override.beachFacingDirection,
        derivedFacingDeg: Math.round(geo.facingDeg),
        disagreementDeg: Math.round(diff),
        alreadyFlaggedSuspectPin: Boolean(override.suspectPin),
        authoredShelterLevel: override.shelterLevel,
        // Decisive for interpretation: a 'low' authored profile is itself an
        // inference from coordinates, so a disagreement is guess-vs-computation
        // and says nothing about which side is wrong. Only medium/high authored
        // knowledge turns a disagreement into evidence against the geometry.
        authoredConfidence: override.confidence,
        geoConfidence: geo.confidence,
      });
    }
  }
}

suspects.sort((a, b) => b.disagreementDeg - a.disagreementDeg);
const unflagged = suspects.filter((s) => !s.alreadyFlaggedSuspectPin);
const actionable = suspects.filter((s) => s.authoredConfidence && s.authoredConfidence !== 'low');
const guessVsCompute = suspects.filter((s) => s.authoredConfidence === 'low');

console.log(`beaches with an authored facing direction: ${withAuthored}`);
console.log(`comparable against derived geometry:       ${comparable}`);
console.log('');
console.log(`ORIGIN-SUSPECT (>=${MIN_DEG} deg disagreement): ${suspects.length}`);
console.log(`   already carrying suspectPin: ${suspects.length - unflagged.length}`);
console.log(`   NOT yet flagged:             ${unflagged.length}`);
console.log('');
console.log(`   ACTIONABLE (authored confidence medium/high — real evidence against the geometry): ${actionable.length}`);
console.log(`   inconclusive (authored confidence 'low' = itself inferred from coordinates):       ${guessVsCompute.length}`);
console.log('');
if (actionable.length) {
  console.log('-- ACTIONABLE --');
  actionable.forEach((s) => console.log(
    `   #${s.id} ${s.name} [${s.region}] authored ${s.authoredFacingDeg}° (${s.authoredConfidence}) vs derived ${s.derivedFacingDeg}° = ${s.disagreementDeg}° apart${s.alreadyFlaggedSuspectPin ? '  (suspectPin already)' : '  <<< UNFLAGGED'}`));
  console.log('');
}
console.log('-- inconclusive (top 10) --');
guessVsCompute.slice(0, 10).forEach((s) => console.log(
  `   #${s.id} ${s.name} [${s.region}] ${s.disagreementDeg}° apart${s.alreadyFlaggedSuspectPin ? '  (suspectPin already)' : ''}`));

if (OUT) {
  writeFileSync(OUT, JSON.stringify({
    generatedAt: new Date().toISOString(),
    withAuthored, comparable, minDeg: MIN_DEG,
    counts: { suspects: suspects.length, unflagged: unflagged.length },
    suspects,
  }, null, 1), 'utf8');
  console.log(`\nwrote ${OUT}`);
}
rmSync(TMP, { recursive: true, force: true });
