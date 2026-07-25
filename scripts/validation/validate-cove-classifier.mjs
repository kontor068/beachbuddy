/**
 * Regression guard for the enclosed-cove (όρμος) classifier.
 *
 * Runs the REAL engine (assessBeachWindExposure -> enclosedCove) over a hand-
 * verified labeled set and fails loudly if any label flips. This exists because
 * the classifier is trust-load-bearing: a false «Κλειστός όρμος» paints a beach
 * GREEN at 5+ Bft and can send someone into waves, so silent drift is expensive.
 *
 * Every label in cove-labeled-set.json was established by map/photo inspection,
 * pilot-guide sourcing or firsthand report — never by running the model. Do not
 * "fix" a failure by editing the label unless you have re-verified the beach.
 *
 * Exit 0 = all labels hold. Exit 1 = regression.
 *
 * Run: node scripts/validation/validate-cove-classifier.mjs [--verbose]
 */
import { readFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const VERBOSE = process.argv.includes('--verbose');

const OUT_DIR = path.join(ROOT, '.tmp', 'validation');
const BUNDLE = path.join(OUT_DIR, 'cove-engine.mjs');
const ENTRY = path.join(OUT_DIR, 'cove-engine-entry.ts');

// Bundle the TS engine so this validator always tests the SHIPPING code path
// rather than a re-implementation that can drift from it.
const buildEngine = async () => {
  mkdirSync(OUT_DIR, { recursive: true });
  const { writeFileSync } = await import('node:fs');
  writeFileSync(ENTRY, [
    "export { assessBeachWindExposure } from '../../utils/windExposureEngine';",
    "export { degToCompass, getBeaufortLevel } from '../../utils/weatherUtils';",
  ].join('\n'), 'utf8');
  await build({
    entryPoints: [ENTRY], bundle: true, platform: 'node', format: 'esm',
    outfile: BUNDLE, external: ['node:*'], logLevel: 'error',
  });
};

const loadRegions = () => {
  const exposureDir = path.join(ROOT, 'public', 'data', 'geospatial', 'exposure');
  const beachesDir = path.join(ROOT, 'public', 'data', 'beaches', 'app');
  const cache = new Map();
  return (regionId) => {
    if (cache.has(regionId)) return cache.get(regionId);
    let profiles = {};
    let beaches = [];
    try {
      profiles = JSON.parse(readFileSync(path.join(exposureDir, `${regionId}.json`), 'utf8')).profiles || {};
    } catch { /* region without profiles */ }
    try {
      beaches = JSON.parse(readFileSync(path.join(beachesDir, `${regionId}.json`), 'utf8')).island?.beaches || [];
    } catch { /* region without beach data */ }
    const entry = { profiles, byId: new Map(beaches.map((b) => [b.id, b])) };
    cache.set(regionId, entry);
    return entry;
  };
};

const main = async () => {
  await buildEngine();
  const engine = await import(`file://${BUNDLE}?t=${Date.now()}`);
  const set = JSON.parse(readFileSync(path.join(HERE, 'cove-labeled-set.json'), 'utf8'));
  const getRegion = loadRegions();

  const cases = [
    ...set.positives.map((c) => ({ ...c, expect: true })),
    ...set.negatives.map((c) => ({ ...c, expect: false })),
  ];

  const failures = [];
  const missing = [];
  let passed = 0;

  for (const c of cases) {
    const { profiles, byId } = getRegion(c.region);
    const beach = byId.get(c.id);
    if (!beach) { missing.push(c); continue; }

    // Wind direction/speed are irrelevant to the static morphology flag, but the
    // engine needs a full input; 33 km/h = 5 Bft, the tier where cove matters.
    const assessment = engine.assessBeachWindExposure({
      beach,
      geospatialProfile: profiles[String(c.id)],
      windDirectionDeg: 0,
      windDirection: engine.degToCompass(0),
      windSpeedKmh: 33,
      beaufort: engine.getBeaufortLevel(33),
    });
    const actual = assessment.enclosedCove === true;
    if (actual === c.expect) {
      passed++;
      if (VERBOSE) console.log(`  ok   #${c.id} ${c.name} -> ${actual} (${c.via})`);
    } else {
      failures.push({ ...c, actual });
    }
  }

  console.log('Cove classifier labeled-set validation');
  console.log(`  positives: ${set.positives.length}  negatives: ${set.negatives.length}`);
  console.log(`  passed: ${passed}/${cases.length - missing.length}`);
  if (missing.length) {
    console.log(`\n  NOTE: ${missing.length} labeled beach(es) not found in the dataset (id/region drift):`);
    missing.forEach((m) => console.log(`    #${m.id} ${m.name} [${m.region}]`));
  }

  if (failures.length) {
    console.log(`\nFAILED — ${failures.length} label(s) flipped:\n`);
    for (const f of failures) {
      const kind = f.expect ? 'MISSED A REAL COVE' : 'FALSE COVE (expensive — paints green at 5+ Bft)';
      console.log(`  #${f.id} ${f.name} [${f.region}]`);
      console.log(`     expected enclosedCove=${f.expect}, got ${f.actual}  -> ${kind}`);
      console.log(`     label basis (${f.via}): ${f.why}`);
      console.log('');
    }
    console.log('Do NOT edit the labeled set to make this pass unless you have re-verified');
    console.log('the beach against a map/photo or a pilot guide.');
    try { rmSync(ENTRY, { force: true }); } catch {}
    process.exit(1);
  }

  console.log('\nAll labels hold.');
  try { rmSync(ENTRY, { force: true }); } catch {}
};

main().catch((e) => { console.error(e); process.exit(1); });
