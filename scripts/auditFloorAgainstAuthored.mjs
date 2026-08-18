#!/usr/bin/env node
/**
 * GROUND TRUTH TEST for the "0.6 floor" finding in utils/geospatialExposureModel.ts.
 *
 * Question: when a HUMAN has written "this beach is protected from wind sector X",
 * does today's ray geometry agree, or does the 0.6 floor push that same sector to
 * 'partial' / 'exposed' even though there is ZERO open water there (fetchKm === 0)?
 *
 * Authored sources (the only hand-written exposure truth in the repo):
 *   - utils/windProfileOverrides.ts  -> protectedFromWindDirections per beach
 *   - utils/enclosedCoves.ts         -> CURATED_ENCLOSED_COVE_IDS (human said "όρμος")
 *
 * Measured against public/data/geospatial/exposure/<region>.json.
 *
 * Run: node scripts/auditFloorAgainstAuthored.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPOSURE_DIR = path.join(ROOT, 'public/data/geospatial/exposure');
const SUMMARY_DIR = path.join(ROOT, 'public/data/beaches/app/summary');
const DETAIL_DIR = path.join(ROOT, 'public/data/beaches/app/detail');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// Mirrors utils/windExposureEngine.ts hasGeometryEnclosedProtection.
const ENCLOSURE_MIN_BLOCKED_RATIO = 0.95;
const ENCLOSURE_MAX_INTENSITY = 33;

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Transpile the authored TS modules and import them for real (no regex parsing). */
const loadAuthored = async () => {
  const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'cb-authored-'));
  const entry = path.join(outdir, 'entry.ts');
  fs.writeFileSync(entry, [
    `export { getWindProfileOverride, windProfileOverridesByBeachId } from ${JSON.stringify(path.join(ROOT, 'utils/windProfileOverrides.ts'))};`,
    `export { CURATED_ENCLOSED_COVE_IDS } from ${JSON.stringify(path.join(ROOT, 'utils/enclosedCoves.ts'))};`,
  ].join('\n'));
  const outfile = path.join(outdir, 'authored.mjs');
  await build({ entryPoints: [entry], outfile, bundle: true, format: 'esm', platform: 'node', logLevel: 'silent' });
  return import(pathToFileURL(outfile).href);
};

/** Rebuild enough of a Beach for getWindProfileOverride: id, name{en,gr}, aliases, location. */
const loadBeaches = () => {
  const byId = new Map();
  for (const file of fs.readdirSync(SUMMARY_DIR).filter((f) => f.endsWith('.json'))) {
    const regionId = file.replace(/\.json$/, '');
    const summary = readJson(path.join(SUMMARY_DIR, file));
    const container = summary.island || summary.region || summary;
    for (const b of container.beaches || []) {
      byId.set(b.id, { id: b.id, name: b.name, aliases: [], location: {}, regionId });
    }
    const detailPath = path.join(DETAIL_DIR, file);
    if (!fs.existsSync(detailPath)) continue;
    for (const b of readJson(detailPath).beaches || []) {
      const rec = byId.get(b.id);
      if (!rec) continue;
      rec.aliases = b.aliases || [];
      rec.location = b.location || {};
    }
  }
  return byId;
};

const loadGeospatial = () => {
  const byId = new Map();
  for (const file of fs.readdirSync(EXPOSURE_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')) {
    const doc = readJson(path.join(EXPOSURE_DIR, file));
    for (const [id, profile] of Object.entries(doc.profiles || {})) {
      byId.set(Number(id), { ...profile, regionId: doc.region?.id || file.replace(/\.json$/, '') });
    }
  }
  return byId;
};

const isFloorCase = (s) =>
  s && (s.fetchKm ?? 0) === 0 && (s.blockedRayRatio ?? 0) >= ENCLOSURE_MIN_BLOCKED_RATIO;

const main = async () => {
  const { getWindProfileOverride, windProfileOverridesByBeachId, CURATED_ENCLOSED_COVE_IDS } = await loadAuthored();
  const beaches = loadBeaches();
  const geo = loadGeospatial();

  const authoredById = new Map();
  for (const beach of beaches.values()) {
    const profile = getWindProfileOverride(beach);
    if (profile) authoredById.set(beach.id, profile);
  }

  // ── 0. Inventory ─────────────────────────────────────────────────────────
  const authoredWithProtected = [...authoredById.entries()]
    .filter(([, p]) => (p.protectedFromWindDirections || []).length > 0);

  console.log('=== INVENTORY ===');
  console.log(`beaches in app data:                       ${beaches.size}`);
  console.log(`geospatial exposure profiles:              ${geo.size}`);
  console.log(`by-id authored wind profiles (file):       ${Object.keys(windProfileOverridesByBeachId).length}`);
  console.log(`beaches matched to an authored profile:    ${authoredById.size}`);
  console.log(`   ...of which claim protection ≥1 sector: ${authoredWithProtected.length}`);
  console.log(`curated enclosed coves (human "όρμος"):    ${CURATED_ENCLOSED_COVE_IDS.size}`);

  // ── 1. THE MAIN TEST ─────────────────────────────────────────────────────
  // Human said "protected from X". What does geometry say in that same sector?
  let pairs = 0;
  let agree = 0;
  const disagreeFloor = [];   // human protected + fetch 0 + fully blocked, model NOT protected
  const disagreeOpen = [];    // human protected but real open water exists (model may be right)
  const byConfidence = {};

  for (const [id, profile] of authoredWithProtected) {
    const g = geo.get(id);
    if (!g) continue;
    for (const sector of profile.protectedFromWindDirections) {
      const s = g.sectors?.[sector];
      if (!s) continue;
      pairs += 1;
      if (s.level === 'protected') { agree += 1; continue; }
      const row = {
        id,
        name: beaches.get(id)?.name?.gr || beaches.get(id)?.name?.en || String(id),
        region: g.regionId,
        sector,
        level: s.level,
        fetchKm: s.fetchKm,
        blocked: s.blockedRayRatio,
        onshore: s.onshore,
        intensity: s.intensity,
        confidence: g.confidence,
        authoredConfidence: profile.confidence,
        shelterLevel: profile.shelterLevel,
      };
      if (isFloorCase(s)) {
        disagreeFloor.push(row);
        const k = `${g.confidence}/${profile.confidence}`;
        byConfidence[k] = (byConfidence[k] || 0) + 1;
      } else {
        disagreeOpen.push(row);
      }
    }
  }

  console.log('\n=== MAIN TEST: human "protected from X" vs geometry in the SAME sector ===');
  console.log(`authored protected (beach × sector) pairs with geometry:  ${pairs}`);
  console.log(`  geometry agrees ('protected'):                          ${agree}`);
  console.log(`  geometry disagrees:                                     ${pairs - agree}`);
  console.log(`     ...WITH real open water (fetch>0 or gaps) – geometry may be right: ${disagreeOpen.length}`);
  console.log(`     ...with ZERO open water (fetch 0, blocked ≥0.95) – THE FLOOR:      ${disagreeFloor.length}`);
  console.log(`  floor cases by mask/authored confidence:`, byConfidence);

  const floorLevels = disagreeFloor.reduce((acc, r) => ({ ...acc, [r.level]: (acc[r.level] || 0) + 1 }), {});
  console.log(`  floor cases by level:`, floorLevels);
  console.log('\n  --- every floor disagreement (human says protected, geometry says otherwise on dry land) ---');
  for (const r of disagreeFloor.sort((a, b) => b.intensity - a.intensity)) {
    console.log(`  #${r.id} ${r.name} [${r.region}] ${r.sector}: ${r.level} int=${r.intensity} onshore=${r.onshore} fetch=${r.fetchKm} blocked=${r.blocked} (mask=${r.confidence}, authored=${r.authoredConfidence}/${r.shelterLevel})`);
  }

  // Control: does the human ever say "exposed to X" where geometry has fetch 0?
  let exposedPairs = 0;
  let exposedFloor = 0;
  for (const [id, profile] of authoredById) {
    const g = geo.get(id);
    if (!g) continue;
    for (const sector of profile.exposedToWindDirections || []) {
      const s = g.sectors?.[sector];
      if (!s) continue;
      exposedPairs += 1;
      if (isFloorCase(s)) exposedFloor += 1;
    }
  }
  console.log('\n=== CONTROL: human "exposed to X" pairs ===');
  console.log(`  pairs: ${exposedPairs}; of which geometry has ZERO open water: ${exposedFloor}`);
  console.log('  (a high number here would mean the authored data is just wrong/coarse, not the model)');

  // ── 2. Curated enclosed coves ────────────────────────────────────────────
  console.log('\n=== CURATED ENCLOSED COVES (human wrote "this is an όρμος") ===');
  let coveSectors = 0;
  let coveFloorNotProtected = 0;
  const coveRows = [];
  for (const id of CURATED_ENCLOSED_COVE_IDS) {
    const g = geo.get(id);
    if (!g) continue;
    const bad = [];
    for (const sector of SECTORS) {
      const s = g.sectors?.[sector];
      if (!isFloorCase(s)) continue;
      coveSectors += 1;
      if (s.level !== 'protected') {
        coveFloorNotProtected += 1;
        bad.push(`${sector}=${s.level}(int ${s.intensity}, onshore ${s.onshore})`);
      }
    }
    if (bad.length) {
      coveRows.push({ id, name: beaches.get(id)?.name?.gr || String(id), region: g.regionId, bad });
    }
  }
  console.log(`  cove sectors with ZERO open water (fetch 0, blocked ≥0.95): ${coveSectors}`);
  console.log(`  of those NOT 'protected' (floor bites a hand-verified cove): ${coveFloorNotProtected}`);
  console.log(`  coves affected: ${coveRows.length} / ${CURATED_ENCLOSED_COVE_IDS.size}`);
  for (const r of coveRows) console.log(`   #${r.id} ${r.name} [${r.region}] -> ${r.bad.join(', ')}`);

  // ── 3. Λιμνιώνας Κυθήρων (133) ───────────────────────────────────────────
  console.log('\n=== BEACH 133 Λιμνιώνας (Kythira) ===');
  const p133 = authoredById.get(133);
  console.log('  authored wind profile:', p133 ? JSON.stringify(p133) : 'NONE');
  console.log('  in CURATED_ENCLOSED_COVE_IDS:', CURATED_ENCLOSED_COVE_IDS.has(133));
  const g133 = geo.get(133);
  if (g133) {
    console.log(`  facingDeg=${g133.facingDeg} confidence=${g133.confidence}`);
    for (const sector of SECTORS) {
      const s = g133.sectors[sector];
      console.log(`   ${sector.padEnd(2)}: ${String(s.level).padEnd(9)} fetch=${String(s.fetchKm).padStart(6)} blocked=${s.blockedRayRatio} onshore=${s.onshore} intensity=${s.intensity}`);
    }
  }

  // ── 4. National floor population (context) ───────────────────────────────
  let total = 0;
  let floorCases = 0;
  let floorNotProtected = 0;
  let floorNotProtectedHigh = 0;
  const floorBeaches = new Set();
  for (const [id, g] of geo) {
    for (const sector of SECTORS) {
      const s = g.sectors?.[sector];
      if (!s) continue;
      total += 1;
      if (!isFloorCase(s)) continue;
      floorCases += 1;
      if (s.level !== 'protected') {
        floorNotProtected += 1;
        floorBeaches.add(id);
        if (g.confidence === 'high' && s.intensity < ENCLOSURE_MAX_INTENSITY) floorNotProtectedHigh += 1;
      }
    }
  }
  const nationalLevels = {};
  for (const [, g] of geo) {
    for (const sector of SECTORS) {
      const s = g.sectors?.[sector];
      if (isFloorCase(s) && s.level !== 'protected') nationalLevels[s.level] = (nationalLevels[s.level] || 0) + 1;
    }
  }
  console.log('\n=== NATIONAL CONTEXT ===');
  console.log(`  beach × sector combos:                                  ${total}`);
  console.log(`  fetch 0 AND blocked ≥0.95:                              ${floorCases}`);
  console.log(`  ...NOT 'protected' (the floor decides):                 ${floorNotProtected} in ${floorBeaches.size} beaches`);
  console.log(`  ...of those, high-confidence mask & int<33:             ${floorNotProtectedHigh}`);
  console.log(`  by level:`, nationalLevels);

  // ── 5. Does the floor STOP beaches from earning cove status? ─────────────
  // utils/windExposureEngine.ts:605 requires ≥5 CONTIGUOUS sectors that are
  // level 'protected' + blocked ≥0.95 + intensity <33. A dry-land sector that the
  // floor pushed to 'partial' breaks that arc. The curated allowlist is the manual
  // patch for exactly this — so count how often geometry alone would have sufficed.
  const longestRun = (flags) => {
    let best = 0;
    for (let start = 0; start < 8; start += 1) {
      let run = 0;
      for (let i = 0; i < 8; i += 1) {
        if (flags[(start + i) % 8]) run += 1; else break;
      }
      best = Math.max(best, run);
    }
    return Math.min(best, 8);
  };
  let arcBrokenByFloor = 0;
  const arcExamples = [];
  for (const [id, g] of geo) {
    const strict = SECTORS.map((sec) => {
      const s = g.sectors?.[sec];
      return Boolean(s && s.level === 'protected' && (s.blockedRayRatio ?? 0) >= 0.95 && (s.intensity ?? 100) < 33);
    });
    const relaxed = SECTORS.map((sec, i) => strict[i] || isFloorCase(g.sectors?.[sec]));
    if (longestRun(strict) < 5 && longestRun(relaxed) >= 5) {
      arcBrokenByFloor += 1;
      if (arcExamples.length < 15) {
        arcExamples.push(`#${id} ${beaches.get(id)?.name?.gr || ''} [${g.regionId}] strictRun=${longestRun(strict)} floorFreeRun=${longestRun(relaxed)}${CURATED_ENCLOSED_COVE_IDS.has(id) ? ' (already curated by hand)' : ''}`);
      }
    }
  }
  console.log('\n=== SIDE EFFECT: όρμος arc broken by the floor ===');
  console.log(`  beaches that FAIL the ≥5-contiguous-protected cove arc but would PASS it`);
  console.log(`  if a zero-fetch fully-blocked sector counted as protected: ${arcBrokenByFloor}`);
  for (const e of arcExamples) console.log(`   ${e}`);
};

main().catch((err) => { console.error(err); process.exit(1); });
