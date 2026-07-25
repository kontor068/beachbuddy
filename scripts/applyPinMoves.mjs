// Apply the 4 web/OSM-verified pin corrections (2026-07-20). Each target coordinate is an
// authoritative OSM node (or verified town/lagoon anchor). Only MOVE verdicts are applied;
// KEEP (false-flags — pin already correct) and FLAG (identity/duplicate — need a human decision)
// are left untouched. Reversible + provenance. Dry-run default; --write.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const argOf = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const IN = argOf('--in', path.join('reports', 'pin-verify-2026-07-20.json'));
const STAMP = argOf('--stamp', '2026-07-20');
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

const raw = rd(path.isAbsolute(IN) ? IN : path.join(rootDir, IN)) || [];
// Accept both the original flat array and the {results:[…]} shape emitted by
// scripts/verifyPinDisplacement.mjs, so any verified report can be applied.
const verify = (Array.isArray(raw) ? raw : raw.results || []).map((v) => ({
  ...v,
  evidence: v.evidence || v.reason || '',
  confidence: v.confidence || (v.polygonDistM != null ? `OSM polygon ${v.polygonDistM} m` : 'verified'),
}));
// dedupe by id, prefer a MOVE verdict with a target
const moveById = new Map();
for (const v of verify) if (v.verdict === 'MOVE' && Array.isArray(v.target)) moveById.set(v.id, v);
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = rd(sourcePath);
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const applied = [];
(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (moveById.has(node.id) && typeof node.lat === 'number') {
    const v = moveById.get(node.id); const from = [node.lat, node.lon];
    node.lat = v.target[0]; node.lon = v.target[1];
    if (node.metadata) appendNote(node.metadata, `Pin corrected ${STAMP} (no-API): moved from ${from[0].toFixed(5)},${from[1].toFixed(5)} to ${v.target[0]},${v.target[1]} — ${String(v.evidence || '').slice(0, 150)} (confidence ${v.confidence}).`);
    applied.push({ id: node.id, name: node.name, from, to: v.target, conf: v.confidence });
  }
  for (const val of Object.values(node)) if (val && typeof val === 'object') walk(val);
})(data);

console.log(`applyPinMoves — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length} pins moved`);
for (const a of applied) console.log(`   →#${a.id} ${(a.name || '').padEnd(26)} ${a.from[0].toFixed(4)},${a.from[1].toFixed(4)} → ${a.to[0]},${a.to[1]} [${a.conf}]`);
if (write) { writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('\nWrote public/greek_beaches.json'); }
