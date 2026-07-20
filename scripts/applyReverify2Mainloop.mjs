// Apply the main-loop re-verification of the 51 leaning-organized-held beaches (2026-07-20).
// Same policy/provenance as applyReverify2 but reads mainloop.json (schema-identical).
// CONFIRMED → organized:true + amenities per flags (2 independent sources). REFUTED → durable note.
// Dry-run default; --write to persist.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAmenity, SUNBED_AMENITY_TERMS, hasExplicitBeachBarAmenityInList, amenityTextIncludesAny } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const write = process.argv.includes('--write');
const STAMP = '2026-07-20';
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

const results = rd(R('reports', 'amenity-evidence', 'reverify2', 'results', 'mainloop.json')) || [];
const held = new Map((rd(R('reports', 'amenity-evidence', 'leaning-organized-held.json')) || []).map(h => [h.id, h]));
const byId = new Map(results.map(r => [r.id, r]));
const data = rd(R('public', 'greek_beaches.json'));
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const addAmen = (m, a) => { m.amenities = m.amenities || []; if (!m.amenities.some(x => normalizeAmenity(x) === normalizeAmenity(a))) m.amenities.push(a); };
const addUrl = (m, u) => { if (!u) return; m.sourceUrls = m.sourceUrls || []; if (!m.sourceUrls.includes(u)) m.sourceUrls.push(u); };
const applied = [], noted = [];

(function walk(n) {
  if (Array.isArray(n)) { for (const it of n) walk(it); return; }
  if (!n || typeof n !== 'object') return;
  if (byId.has(n.id) && n.metadata) {
    const r = byId.get(n.id), m = n.metadata, h = held.get(n.id) || {};
    if (r.verdict === 'CONFIRMED' && m.organized !== true) {
      m.organized = true;
      const added = [];
      if (r.beachBar === true && !hasExplicitBeachBarAmenityInList(m.amenities || [])) { addAmen(m, 'beach bar εποχικά'); added.push('beach bar'); }
      if (r.sunbeds === true && !amenityTextIncludesAny(m.amenities || [], SUNBED_AMENITY_TERMS)) { addAmen(m, 'ξαπλώστρες, ομπρέλες εποχικά'); added.push('sunbeds'); }
      addUrl(m, r.sourceUrl); addUrl(m, h.round1Url);
      appendNote(m, `Amenity re-verify ${STAMP} (no-API): organized confirmed by TWO independent sources — (1) ${String(h.round1Evidence || '').slice(0, 90)} [${h.round1Url || ''}]; (2) ${String(r.evidence || '').slice(0, 120)} [${r.sourceUrl || ''}]${added.length ? '; ' + added.join('+') + ' added' : ''}.`);
      applied.push({ id: n.id, name: n.name, added, conf: r.confidence });
    } else if (r.verdict === 'REFUTED') {
      addUrl(m, r.sourceUrl);
      appendNote(m, `Amenity re-verify ${STAMP} (no-API): checked and confirmed NOT organized — ${String(r.evidence || '').slice(0, 150)} [${r.sourceUrl || ''}].`);
      noted.push({ id: n.id, name: n.name });
    }
  }
  for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
})(data);

console.log(`applyReverify2Mainloop — ${write ? 'WRITE' : 'DRY-RUN'} — CONFIRMED ${applied.length}, REFUTED noted ${noted.length}`);
for (const a of applied) console.log(`   ✓#${a.id} ${(a.name || '').slice(0, 30).padEnd(30)} [${a.conf}]${a.added.length ? ' +' + a.added.join('+') : ' (organized only)'}`);
for (const a of noted) console.log(`   ·#${a.id} ${(a.name || '').slice(0, 30)} — verified unorganized`);
if (write) { writeFileSync(R('public', 'greek_beaches.json'), JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('\nWrote public/greek_beaches.json'); }
writeFileSync(R('reports', 'amenity-evidence', `reverify2-mainloop-apply-${STAMP}.json`), JSON.stringify({ applied, noted }, null, 1));
