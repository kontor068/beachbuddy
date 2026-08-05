// ─────────────────────────────────────────────────────────────────────────────
// BUILD-TIME GATE: validate every baked beach record against the canonical
// contract (core/beachContract.mjs). Run before deploy so bad data never ships.
//
//   node scripts/checkBeachContract.mjs           # summary payloads (fast)
//   node scripts/checkBeachContract.mjs --detail  # also the detail payloads
//   node scripts/checkBeachContract.mjs --json     # machine-readable report
//
// Exit code 1 on any violation → wire into `build` / CI to block a bad deploy.
// Zero dependencies, zero cost. This is the "single source of truth" proving
// itself: the app and this gate validate with the exact same code.
// ─────────────────────────────────────────────────────────────────────────────

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBeachRecord, validateBeachPatch, CONTRACT_VERSION } from '../core/beachContract.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summaryDir = path.join(rootDir, 'public', 'data', 'beaches', 'app', 'summary');
const detailDir = path.join(rootDir, 'public', 'data', 'beaches', 'app', 'detail');

const args = new Set(process.argv.slice(2));
const wantDetail = args.has('--detail');
const asJson = args.has('--json');

const rel = (p) => path.relative(rootDir, p).replaceAll(path.sep, '/');

async function loadBeachesFromFile(file) {
  const raw = JSON.parse(await readFile(file, 'utf8'));
  // Summary payload: { schemaVersion, island: { beaches: [...] } }
  // Detail payload:  { beaches: [...] }
  if (Array.isArray(raw?.island?.beaches)) return raw.island.beaches;
  if (Array.isArray(raw?.beaches)) return raw.beaches;
  return [];
}

async function checkDir(dir, label, validate) {
  let entries;
  try {
    entries = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return { label, files: 0, beaches: 0, violations: [] };
  }

  const violations = [];
  let beachCount = 0;

  for (const file of entries) {
    const full = path.join(dir, file);
    const beaches = await loadBeachesFromFile(full);
    for (const beach of beaches) {
      beachCount += 1;
      const { valid, errors } = validate(beach);
      if (!valid) {
        violations.push({ file: rel(full), beachId: beach?.id ?? '(no id)', errors });
      }
    }
  }

  return { label, files: entries.length, beaches: beachCount, violations };
}

// Summary payloads are FULL records → strict validation.
// Detail payloads are PATCHES that merge onto a summary → patch validation
// (identity/location legitimately absent; present enums still must be canonical).
const reports = [await checkDir(summaryDir, 'summary', validateBeachRecord)];
if (wantDetail) reports.push(await checkDir(detailDir, 'detail (patch)', validateBeachPatch));

const allViolations = reports.flatMap((r) => r.violations);

// The national geo-index ("Κοντά μου" reads it to find the nearest beaches before touching a
// single region file) is generated from these very payloads. If a data rebuild has moved on
// without it, the app silently falls back to the slow centroid path — so say so here, loudly,
// while it is still a one-command fix.
let geoIndexProblem = null;
try {
  const geoIndex = JSON.parse(await readFile(path.join(rootDir, 'public', 'data', 'beaches', 'geo-index.json'), 'utf8'));
  const indexed = Array.isArray(geoIndex?.beaches) ? geoIndex.beaches.length : 0;
  const expected = reports.find((r) => r.label === 'summary')?.beaches ?? 0;
  if (indexed !== expected) {
    geoIndexProblem = `holds ${indexed} beaches, the dataset holds ${expected}`;
  }
} catch (error) {
  geoIndexProblem = `could not be read (${error.message})`;
}

if (asJson) {
  console.log(JSON.stringify({ contractVersion: CONTRACT_VERSION, reports }, null, 2));
} else {
  console.log(`\n🔎 Beach contract check (v${CONTRACT_VERSION})`);
  for (const r of reports) {
    console.log(`   • ${r.label}: ${r.beaches} beaches across ${r.files} files → ${r.violations.length} invalid`);
  }
  if (allViolations.length) {
    console.log('\n❌ Contract violations:\n');
    for (const v of allViolations.slice(0, 50)) {
      console.log(`   ${v.file}  beach ${v.beachId}`);
      for (const e of v.errors) console.log(`      - [${e.code}] ${e.field}: ${e.message}`);
    }
    if (allViolations.length > 50) console.log(`   …and ${allViolations.length - 50} more`);
    console.log('');
  } else {
    console.log('\n✅ All beach records satisfy the canonical contract.\n');
  }
  if (geoIndexProblem) {
    console.log(`❌ public/data/beaches/geo-index.json ${geoIndexProblem}.`);
    console.log('   Fix with: npm run build:geo-index\n');
  }
}

process.exit(allViolations.length || geoIndexProblem ? 1 : 0);
