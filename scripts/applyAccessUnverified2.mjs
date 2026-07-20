// Access honest-downgrade, pass 2 (2026-07-20, no API). The national 954 "suspects" were a
// mismeasurement (120m paved threshold). Re-measured strictly: keep only beaches with NO paved
// road within 300m + an OSM track/footpath, THEN drop any that are organized or carry a
// parking/resort amenity (an organized/served beach has usable access; OSM merely lacks the tag).
// That leaves this genuinely-suspect set of UNORGANIZED beaches claiming "asphalt/easy" with no
// mapped paved access. Set access.roadSurfaceUnverified=true → UI shows the honest "likely easy,
// not verified" (never asserts dirt). Reversible + provenance. Dry-run default; --write to persist.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = '2026-07-20';
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

// Web-verified verdicts: only DOWNGRADE the ones a 2nd web source confirms are NOT paved-easy
// (or are unverifiable). KEEP_PAVED (Sougia, Keratokambos, Tourlos, Agia Triada Rhodes) proven
// paved by web → left confident.
const verify = rd(path.join(rootDir, 'reports', 'access-road-proximity', 'access-verify-2026-07-20.json')) || [];
const verdict = new Map(verify.map(v => [v.id, v]));
const TARGET = new Set(verify.filter(v => v.verdict === 'DOWNGRADE').map(v => v.id));

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = rd(sourcePath);
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const applied = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (TARGET.has(node.id) && node.metadata?.access && !node.metadata.access.roadSurfaceUnverified) {
    const m = node.metadata; m.access.roadSurfaceUnverified = true;
    const v = verdict.get(node.id) || {};
    appendNote(m, `Access honest-downgrade ${STAMP} (no-API): OSM showed no paved road within 300m + a track; web check — ${String(v.evidence || '').slice(0, 150)}${v.sourceUrl ? ' [' + v.sourceUrl + ']' : ''}. Set roadSurfaceUnverified so the UI shows "likely easy, not verified" instead of asserting paved access.`);
    applied.push({ id: node.id, name: node.name });
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(data);

console.log(`applyAccessUnverified2 — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length} beaches`);
for (const a of applied) console.log(`   ~#${a.id} ${a.name}`);
if (write) { writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('\nWrote public/greek_beaches.json'); }
