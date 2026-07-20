// Apply web-verified terrain corrections (2026-07-20, no API). The national terrain audit found 98
// beaches where our types disagreed with OSM's surface tag; 5 web passes established the GROUND TRUTH
// per beach. The app derives the beach type from metadata.terrain.types (services/beachRawFallback
// metadataTerrainToBeachType), so we fix `types` (and regenerate the Greek `label` to match, curing
// the label↔types desync the audit surfaced). Only definite verdicts at high/medium confidence are
// applied; UNCLEAR / low-confidence keep our current value. Provenance + source URL on every change.
// Dry-run default; --write to persist.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const write = process.argv.includes('--write');
const STAMP = '2026-07-20';
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

const results = rd(R('reports', 'terrain', 'verify2', 'merged.json')) || [];
// Mirror services/beachRawFallback.ts metadataTerrainToBeachType so our target category matches the app.
const beachType = (types) => {
  if (!types || types.length === 0) return 'unknown';
  const s = new Set(types); const sand = s.has('fine_sand') || s.has('coarse_sand');
  const peb = s.has('pebbles') || s.has('large_stones');
  if (s.has('rocks') && !sand && !s.has('pebbles')) return 'rocky';
  if (sand && (peb || s.has('rocks'))) return 'sandy-pebbles';
  if (peb) return 'pebbles';
  return 'sandy';
};
const GR = { fine_sand: 'λεπτή άμμος', coarse_sand: 'χοντρή άμμος', pebbles: 'βότσαλα', large_stones: 'μεγάλες πέτρες', rocks: 'βράχια' };
const labelFor = (types) => types.map(t => GR[t] || t).join(', ');
const TARGET_TYPES = { SAND: ['fine_sand', 'coarse_sand'], PEBBLES: ['pebbles'], ROCKS: ['rocks'], MIXED_SAND_PEBBLE: ['coarse_sand', 'pebbles'] };
const TARGET_CAT = { SAND: 'sandy', PEBBLES: 'pebbles', ROCKS: 'rocky', MIXED_SAND_PEBBLE: 'sandy-pebbles' };

const apply = new Map();
for (const r of results) {
  if (!TARGET_TYPES[r.verdict]) continue;              // UNCLEAR skipped
  if (r.confidence !== 'high' && r.confidence !== 'medium') continue; // low skipped
  apply.set(r.id, r);
}

const data = rd(R('public', 'greek_beaches.json'));
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const flips = [], labelOnly = [], noChange = [];
(function walk(n) {
  if (Array.isArray(n)) { for (const it of n) walk(it); return; }
  if (!n || typeof n !== 'object') return;
  if (apply.has(n.id) && n.metadata?.terrain) {
    const r = apply.get(n.id), t = n.metadata.terrain;
    const curTypes = Array.isArray(t.types) ? t.types : [];
    const ourCat = beachType(curTypes), webCat = TARGET_CAT[r.verdict];
    let changed = false, kind = '';
    if (ourCat !== webCat) {
      t.types = [...TARGET_TYPES[r.verdict]]; t.label = labelFor(t.types); changed = true; kind = 'flip';
    } else {
      const wantLabel = labelFor(curTypes); // types already right category → just cure label desync
      if (t.label !== wantLabel) { t.label = wantLabel; changed = true; kind = 'label'; }
    }
    if (changed) {
      appendNote(n.metadata, `Terrain web-verify ${STAMP} (no-API): ${kind === 'flip' ? `corrected to ${r.verdict}` : 'label synced to types'} — ${String(r.evidence || '').slice(0, 130)} [${r.sourceUrl || ''}].`);
      (kind === 'flip' ? flips : labelOnly).push({ id: n.id, name: n.name, to: r.verdict, conf: r.confidence });
    } else noChange.push(n.id);
  }
  for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
})(data);

console.log(`applyTerrainFixes — ${write ? 'WRITE' : 'DRY-RUN'}`);
console.log(`  category flips: ${flips.length} | label-desync fixes: ${labelOnly.length} | already-correct: ${noChange.length} | skipped (unclear/low): ${results.length - apply.size}`);
for (const f of flips) console.log(`   ⟳#${f.id} ${(f.name || '').slice(0, 26).padEnd(26)} → ${f.to} [${f.conf}]`);
if (write) { writeFileSync(R('public', 'greek_beaches.json'), JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('\nWrote public/greek_beaches.json'); }
writeFileSync(R('reports', 'terrain', `terrain-apply-${STAMP}.json`), JSON.stringify({ flips, labelOnly, noChange }, null, 1));
