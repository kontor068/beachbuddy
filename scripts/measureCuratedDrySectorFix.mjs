#!/usr/bin/env node
/**
 * Η ΣΤΕΝΗ ΔΙΟΡΘΩΣΗ ΤΟΥ ΔΑΠΕΔΟΥ — τι ακριβώς αλλάζει, offline, πάνω στα committed δεδομένα.
 *
 * Μόνο οι χειροκίνητα επιθεωρημένες παραλίες-όρμοι (utils/enclosedCoves.ts) με τομέα
 * fetchKm = 0 και blockedRayRatio >= 0,95. Τρέχει τη ΜΗΧΑΝΗ πριν και μετά.
 *
 *   node scripts/measureCuratedDrySectorFix.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve('.');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: f }).outputText, f);

const engine = require(path.join(root, 'utils/windExposureEngine.ts'));
const { CURATED_ENCLOSED_COVE_IDS } = require(path.join(root, 'utils/enclosedCoves.ts'));

const SECTOR_DEG = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const DIR_OF = { N: 'N', NE: 'NE', E: 'E', SE: 'SE', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };

// ── οι στεγνοί τομείς των επιθεωρημένων ────────────────────────────────────────────────
const EXPO = 'public/data/geospatial/exposure';
const profiles = new Map();
for (const f of fs.readdirSync(EXPO)) {
  const j = JSON.parse(fs.readFileSync(path.join(EXPO, f), 'utf8'));
  const list = Array.isArray(j.profiles) ? j.profiles : Object.values(j.profiles || {});
  for (const p of list) profiles.set(p.beachId, { ...p, regionFile: f });
}

const beaches = new Map();
const APP = 'public/data/beaches/app/summary';
for (const f of fs.readdirSync(APP)) {
  const j = JSON.parse(fs.readFileSync(path.join(APP, f), 'utf8'));
  for (const b of (j.island?.beaches || [])) beaches.set(b.id, b);
}

const targets = [];
for (const id of CURATED_ENCLOSED_COVE_IDS) {
  const prof = profiles.get(id);
  if (!prof || prof.confidence !== 'high') continue;
  for (const [sec, v] of Object.entries(prof.sectors || {})) {
    if (v.fetchKm === 0 && v.blockedRayRatio >= 0.95 && v.level !== 'protected') {
      targets.push({ id, sec, prof, v });
    }
  }
}

process.stdout.write(`επιθεωρημένοι όρμοι: ${CURATED_ENCLOSED_COVE_IDS.size}\n`);
process.stdout.write(`στεγνοί τομείς που ΔΕΝ ήταν protected: ${targets.length} σε ${new Set(targets.map(t => t.id)).size} παραλίες\n\n`);

// ── η πύλη, πριν και μετά ──────────────────────────────────────────────────────────────
let gained = 0;
for (const t of targets) {
  const before = engine.hasGeometryEnclosedProtection(t.prof, t.sec, false);
  const after = engine.hasGeometryEnclosedProtection(t.prof, t.sec, false, t.id);
  if (!before && after) gained += 1;
}
process.stdout.write(`πύλη: ${gained} τομείς περνάνε τώρα, ${targets.length - gained} όχι\n`);

// ── ΚΑΝΕΝΑΣ ΑΛΛΟΣ δεν αγγίζεται: όλο το δίκτυο, μη-curated ─────────────────────────────
let leaked = 0;
for (const [id, prof] of profiles) {
  if (CURATED_ENCLOSED_COVE_IDS.has(id)) continue;
  for (const sec of Object.keys(prof.sectors || {})) {
    const before = engine.hasGeometryEnclosedProtection(prof, sec, false);
    const after = engine.hasGeometryEnclosedProtection(prof, sec, false, id);
    if (before !== after) leaked += 1;
  }
}
process.stdout.write(`διαρροή σε ΜΗ-επιθεωρημένες παραλίες: ${leaked}  ${leaked === 0 ? '✔' : '✘ ΣΤΑΜΑΤΑ'}\n\n`);

// ── τι βλέπει ο επισκέπτης ────────────────────────────────────────────────────────────
// Το πριν/μετά της ΕΤΥΜΗΓΟΡΙΑΣ δεν μετριέται εδώ: η μηχανή καλεί την πύλη μέσα από closure,
// οπότε αντικατάσταση του export ΔΕΝ πιάνει — δοκιμάστηκε και έδινε ψευδές «καμία αλλαγή».
// Μετρήθηκε με πραγματική εναλλαγή κώδικα (git stash) 17/08/2026, 29 τομείς × 4 μποφόρ:
//   116 / 116 συνδυασμοί: έκθεση 'partial' -> 'protected'
//   0 προς το αγριότερο, σε κανένα μποφόρ.
// ΠΡΟΣΟΧΗ αν ξαναγίνει: το windDirection είναι enum WindDirection ('West'), ΟΧΙ 'W'. Με 'W' ο
// τομέας βγαίνει undefined και η σύγκριση δείχνει ψευδώς μηδέν διαφορές — έγινε ήδη μία φορά.

process.stdout.write('\nΟΙ ΠΑΡΑΛΙΕΣ:\n');
const byBeach = {};
targets.forEach(t => { (byBeach[t.id] ||= []).push(`${t.sec} (ένταση ${t.v.intensity})`); });
Object.entries(byBeach).forEach(([id, secs]) => process.stdout.write(
  `  ${String(id).padStart(5)} ${(profiles.get(Number(id))?.name?.gr || '').padEnd(26)} ${secs.join(', ')}\n`));

fs.writeFileSync('reports/quality/curated-dry-sector-fix.json', JSON.stringify(
  { generatedAt: new Date().toISOString(), curatedCoves: CURATED_ENCLOSED_COVE_IDS.size,
    drySectors: targets.length, beaches: Object.keys(byBeach).length, gated: gained, leaked,
    perBeach: byBeach }, null, 2));
process.stdout.write('\nγράφτηκε reports/quality/curated-dry-sector-fix.json\n');
