// Phase 1.2 — honest access downgrade (no API, dry-run default).
// For a hand-vetted, multi-signal subset (our label confidently claims "asphalt access"
// AND the OSM road audit shows the nearest paved road is >=350m away with only a track/
// footpath nearby), mark access.roadSurfaceUnverified=true. The UI (GettingThereSection
// classify) then shows the honest "Likely easy access — not verified on the ground" instead
// of the confident "Paved road to the beach". This NEVER asserts a dirt road (which could
// also be wrong); it only stops over-claiming. Reversible + provenance stamped.
//
// Usage: node scripts/applyAccessUnverified.mjs [--write]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = new Date().toISOString().slice(0, 10);
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

// The 27 CLEAR conflicts (paved>=350m, confident asphalt label, track/foot<=80m).
const TARGET = new Set([152, 673, 685, 722, 765, 1141, 1194, 1254, 1296, 1314, 1321, 1475, 1586, 1612, 1922, 2011, 2090, 2135, 2299, 2333, 2349, 2353, 2382, 2457, 2638, 2642, 2707]);

// OSM distances for provenance
const audit = readJson(path.join(rootDir, 'reports', 'access-road-proximity', 'national-2026-06-20.json'));
const dist = new Map();
for (const s of audit?.suspects || []) if (TARGET.has(s.id)) dist.set(s.id, { paved: s.pavedM, track: s.trackM, foot: s.footM });

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = readJson(sourcePath);
const applied = [];
const appendNote = (m, line) => {
  const existing = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || '');
  m.sourceNotes = (existing ? existing + ' ' : '') + line;
};
const walk = (node) => {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (TARGET.has(node.id) && node.metadata?.access) {
    const m = node.metadata;
    if (!m.access.roadSurfaceUnverified) {
      m.access.roadSurfaceUnverified = true;
      const d = dist.get(node.id) || {};
      appendNote(m, `Access-road audit ${STAMP}: OSM shows the nearest paved road ~${d.paved ?? '?'}m away with only a track/footpath nearer (${d.track ?? '—'}m/${d.foot ?? '—'}m); the confident "asphalt" label is not ground-verified. Display downgraded to unverified (no dirt-road claim asserted).`);
      applied.push({ id: node.id, name: node.name });
    }
  }
  for (const v of Object.values(node)) walk(v);
};
walk(data);

console.log(`applyAccessUnverified — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length} beaches`);
for (const a of applied) console.log(`  #${a.id} ${a.name}`);
if (write) { writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log(`\nWrote ${path.relative(rootDir, sourcePath)}. Run: npm run build:beach-data`); }
else console.log('\nDry-run. Re-run with --write.');
