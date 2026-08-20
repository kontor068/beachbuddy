#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΟΤΑΝ Ο ΟΡΜΟΣ ΠΑΨΕΙ ΝΑ ΑΓΟΡΑΖΕΙ ΕΚΠΤΩΣΗ ΣΤΟ ΚΥΜΑ — offline, καμία κλήση δικτύου.
 *
 * ΑΦΟΡΜΗ (βίβλος 20/08/2026). Η curated παράκαμψη του όρμου δίνει `exposureLevel: 'protected'`
 * χωρίς ο τομέας να περάσει το αυστηρό γεωμετρικό τεστ. Το σχόλιο από πάνω της υπόσχεται
 * «Downstream wave/swell ceilings are untouched» και το utils/waveCharacter.ts:267 υπόσχεται ότι
 * κάθε 'protected' που φτάνει στην έκπτωση «has already passed the map's strict
 * isStableProtectedSector gate». Και τα δύο ήταν ψευδή για 29 τομείς σε 24 παραλίες: έπαιρναν
 * ×0,5 στο κύμα για δοκιμή που δεν έδωσαν ποτέ.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΕΔΩ. Τρέχει τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις (`geometryEnclosedProtectionSource`,
 * `shoreSeaStateM`, `resolveConditionTone`) πάνω στα δεσμευμένα exposure profiles, για κάθε
 * curated τομέα × Μποφόρ × ύψος ανοιχτής θάλασσας, και απαντά τρία πράγματα:
 *   1. πόσοι τομείς αγγίζονται και ποιοι
 *   2. πόσο ανεβαίνει το κύμα που κρίνει (πάντα ×2 — είναι η άρση μιας διαίρεσης)
 *   3. σε πόσα κελιά ΑΛΛΑΖΕΙ ΤΟ ΧΡΩΜΑ, και προς τα πού
 *
 * Η ΚΑΤΕΥΘΥΝΣΗ ΕΙΝΑΙ ΕΓΓΥΗΜΕΝΗ ΑΠΟ ΤΟΝ ΚΩΔΙΚΑ, ΟΧΙ ΑΠΟ ΤΗ ΜΕΤΡΗΣΗ: η διόρθωση μόνο ΑΡΝΕΙΤΑΙ
 * έκπτωση, άρα το κύμα μόνο μεγαλώνει και το χρώμα μόνο σφίγγει. Αν αυτή η αναφορά δείξει έστω
 * μία κίνηση προς το ηρεμότερο, κάτι έχει σπάσει.
 *
 *   node scripts/measureCuratedCoveWaveFix.mjs
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/quality/curated-cove-wave-fix.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};

const { geometryEnclosedProtectionSource } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { shoreSeaStateM } = require(path.join(root, 'utils/waveCharacter.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));
const { CURATED_ENCLOSED_COVE_IDS } = require(path.join(root, 'utils/enclosedCoves.ts'));
const { FLAT_WATER_SEA_STATE_M } = require(path.join(root, 'utils/conditionCause.ts'));

const EXPOSURE_DIR = path.join(root, 'public/data/geospatial/exposure');
const BEACH_DIR = path.join(root, 'public/data/beaches');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** Ύψη ανοιχτής θάλασσας που σαρώνονται, σε μέτρα — καλύπτουν άπνοια ως φουρτούνα. */
const SEAS = [0, 0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5];
const BEAUFORTS = [2, 3, 4, 5, 6, 7];

const names = new Map();
for (const file of fs.readdirSync(BEACH_DIR).filter(f => f.endsWith('.json'))) {
  let raw;
  try { raw = JSON.parse(fs.readFileSync(path.join(BEACH_DIR, file), 'utf8')); } catch { continue; }
  for (const b of (Array.isArray(raw) ? raw : raw.beaches || [])) names.set(b.id, b.name);
}

const touched = [];
for (const file of fs.readdirSync(EXPOSURE_DIR).filter(f => f.endsWith('.json'))) {
  let profiles;
  try { profiles = JSON.parse(fs.readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'))?.profiles ?? {}; } catch { continue; }
  for (const [idStr, profile] of Object.entries(profiles)) {
    const id = Number(idStr);
    if (!CURATED_ENCLOSED_COVE_IDS.has(id)) continue;
    for (const sector of SECTORS) {
      // suspectPin=false: η ίδια παραδοχή με τη μηχανή όταν το προφίλ είναι καθαρό. Αν η πινέζα
      // ήταν ύποπτη, ούτε η παράκαμψη ούτε ο γεωμετρικός δρόμος θα άναβαν, άρα ο τομέας δεν θα
      // ήταν εδώ ούτως ή άλλως.
      if (geometryEnclosedProtectionSource(profile, sector, false, id) !== 'curated') continue;
      const s = profile.sectors?.[sector];
      touched.push({ beachId: id, name: names.get(id) ?? profile.name?.gr ?? String(id), region: file.replace(/\.json$/, ''),
        sector, intensity: s?.intensity ?? null, fetchKm: s?.fetchKm ?? null, level: s?.level ?? null });
    }
  }
}

console.log(`ΑΓΓΙΖΟΝΤΑΙ: ${touched.length} τομείς σε ${new Set(touched.map(t => t.beachId)).size} παραλίες\n`);

// ── ΤΟ ΚΥΜΑ ─────────────────────────────────────────────────────────────────
console.log('=== ΤΟ ΚΥΜΑ ΠΟΥ ΚΡΙΝΕΙ (ανοιχτά -> στην ακτή) ===');
console.log('  ανοιχτά | πριν  | τώρα  | διαφορά');
const waveRows = [];
for (const sea of SEAS) {
  const before = shoreSeaStateM(sea, 'protected', undefined, false);
  const after = shoreSeaStateM(sea, 'protected', undefined, true);
  waveRows.push({ openWaterM: sea, beforeM: before, afterM: after });
  console.log(`  ${String(sea.toFixed(1)).padStart(7)} | ${String(before?.toFixed(2)).padStart(5)} | ${String(after?.toFixed(2)).padStart(5)} | +${(after - before).toFixed(2)} μ.`);
}

// ── ΤΟ ΦΙΛΤΡΟ «ΗΡΕΜΟ ΝΕΡΟ» ──────────────────────────────────────────────────
// utils/calmWaterFilter.isCalmWaterPick δέχεται όταν shoreSeaStateM ≤ FLAT_WATER_SEA_STATE_M
// (0,40 μ.). Η έκπτωση ×0,5 έστελνε στο φίλτρο τη μισή θάλασσα, άρα δεχόταν παραλίες με ανοιχτό
// νερό ως 0,80 μ. Αυτό είναι η ΜΙΑ επιφάνεια όπου η διόρθωση αλλάζει τι προτείνουμε.
console.log('\n=== ΤΟ ΦΙΛΤΡΟ «ΗΡΕΜΟ ΝΕΡΟ» (δέχεται ≤ 0,40 μ. στην ακτή) ===');
console.log('  ανοιχτά | πριν      | τώρα');
let filterLost = 0;
let filterGained = 0;
const filterRows = [];
for (const sea of SEAS) {
  const before = shoreSeaStateM(sea, 'protected', undefined, false);
  const after = shoreSeaStateM(sea, 'protected', undefined, true);
  const inBefore = typeof before === 'number' && before <= FLAT_WATER_SEA_STATE_M;
  const inAfter = typeof after === 'number' && after <= FLAT_WATER_SEA_STATE_M;
  if (inBefore && !inAfter) filterLost++;
  if (!inBefore && inAfter) filterGained++;
  filterRows.push({ openWaterM: sea, inBefore, inAfter });
  const mark = inBefore === inAfter ? '' : '   ← ΑΛΛΑΖΕΙ';
  console.log(`  ${String(sea.toFixed(1)).padStart(7)} | ${(inBefore ? 'ΗΡΕΜΟ' : '  —  ').padEnd(9)} | ${(inAfter ? 'ΗΡΕΜΟ' : '  —  ')}${mark}`);
}
console.log(`\n  χάνουν το «Ήρεμο νερό»: ${filterLost} ζώνες · κερδίζουν: ${filterGained}`);
if (filterGained > 0) {
  console.error('  ❌ ΑΠΟΤΥΧΙΑ: η διόρθωση ΠΡΟΣΘΕΣΕ παραλία στο «Ήρεμο νερό». Μονόδρομη πύλη παραβιάστηκε.');
  process.exitCode = 1;
}

// ── ΤΟ ΧΡΩΜΑ ────────────────────────────────────────────────────────────────
// Ο ίδιος κώδικας χρώματος με την εφαρμογή, μία φορά με την έκπτωση και μία χωρίς.
//
// ⚠️ ΠΡΟΣΟΧΗ ΣΤΟ `isEnclosedCove`. Και οι 24 παραλίες είναι στο CURATED_ENCLOSED_COVE_IDS, άρα
// το `isEnclosedCove` είναι ΠΑΝΤΑ true γι' αυτές — και ο όρμος εξαιρείται ρητά από το ταβάνι
// θάλασσας (utils/suitabilityTone.ts:315, «A cove that genuinely holds calm water is exempt»).
// Οπότε η έκπτωση κύματος ΔΕΝ μπορεί να αγγίξει το χρώμα τους. Το πλέγμα τρέχει και με τις δύο
// τιμές για να φαίνεται ότι αυτό είναι συμπέρασμα και όχι παράλειψη: το `cove=true` είναι η
// πραγματικότητα, το `cove=false` δείχνει τι θα άλλαζε αν η εξαίρεση όρμου έπεφτε ποτέ.
console.log('\n=== ΤΟ ΧΡΩΜΑ (πλέγμα Μποφόρ × ανοιχτή θάλασσα) ===');
console.log('  Μπφ | ' + SEAS.map(s => s.toFixed(1).padStart(5)).join(' '));
const RUNG = { blue: 0, yellow: 1, orange: 2, red: 3 };
const COVE_MODE = process.argv.includes('--no-cove') ? false : true;
console.log(`  (isEnclosedCove = ${COVE_MODE}${COVE_MODE ? ' — η πραγματικότητα για αυτές τις 24' : ' — υποθετικό, χωρίς την εξαίρεση όρμου'})`);
let cellsTotal = 0; let cellsChanged = 0; let stricter = 0; let milder = 0;
const moves = new Map();
const grid = [];
for (const beaufort of BEAUFORTS) {
  const row = [];
  for (const seaStateM of SEAS) {
    const base = { exposureLevel: 'protected', beaufort, isEnclosedCove: COVE_MODE, seaStateM };
    const before = resolveConditionTone({ ...base, curatedWindOnlyProtection: false });
    const after = resolveConditionTone({ ...base, curatedWindOnlyProtection: true });
    cellsTotal++;
    if (before !== after) {
      cellsChanged++;
      if (RUNG[after] > RUNG[before]) stricter++; else milder++;
      moves.set(`${before}→${after}`, (moves.get(`${before}→${after}`) ?? 0) + 1);
    }
    row.push({ seaStateM, before, after });
    process.stdout.write('');
  }
  grid.push({ beaufort, cells: row });
  const cells = row.map(c => (c.before === c.after ? '  ·  ' : (c.after[0] + '←' + c.before[0]).padStart(5)));
  console.log(`  ${String(beaufort).padStart(3)} | ${cells.join(' ')}`);
}
console.log(`\n  κελιά που αλλάζουν: ${cellsChanged}/${cellsTotal} · προς το αυστηρότερο ${stricter} · προς το ηπιότερο ${milder}`);
for (const [move, n] of [...moves.entries()].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(3)} · ${move}`);

if (milder > 0) {
  console.error('\n❌ ΑΠΟΤΥΧΙΑ: η διόρθωση έκανε κάτι ΠΙΟ ΗΡΕΜΟ. Μονόδρομη πύλη παραβιάστηκε.');
  process.exitCode = 1;
} else {
  console.log('  ✅ καμία κίνηση προς το ηρεμότερο — η πύλη είναι μονόδρομη όπως σχεδιάστηκε.');
}

console.log('\n=== ΟΙ ΤΟΜΕΙΣ ===');
for (const t of touched.sort((a, b) => a.beachId - b.beachId)) {
  console.log(`  ${String(t.beachId).padStart(5)} ${String(t.name).padEnd(26)} @${t.sector.padEnd(2)} ένταση ${String(t.intensity ?? '—').padStart(5)} · level ${t.level}`);
}

const outDir = path.join(root, 'reports/quality');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'curated-cove-wave-fix.json');
fs.writeFileSync(`${out}.tmp`, JSON.stringify({
  measuredAt: new Date().toISOString(),
  question: 'Τι αλλάζει όταν το curated «protected» πάψει να αγοράζει την έκπτωση ×0,5 στο κύμα',
  touchedSectors: touched.length,
  touchedBeaches: new Set(touched.map(t => t.beachId)).size,
  sectors: touched,
  wave: waveRows,
  calmWaterFilter: { threshold: FLAT_WATER_SEA_STATE_M, lostZones: filterLost, gainedZones: filterGained, rows: filterRows },
  colour: { isEnclosedCove: COVE_MODE, cellsTotal, cellsChanged, stricter, milder, moves: [...moves.entries()] },
  grid,
}, null, 2), 'utf8');
fs.renameSync(`${out}.tmp`, out);
console.log(`\nαναφορά: ${path.relative(root, out)}`);
