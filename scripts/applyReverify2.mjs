// Apply the reverify2 pass: beaches the web LEANED organized (held for lack of a 2nd source),
// now CONFIRMED by an independent second source. Full provenance = round-1 + round-2 URLs.
// REFUTED get a durable "verified unorganized" sourceNote (no flag change — stops future re-flagging).
// HELD: #1142 (2nd source's bar may belong to adjacent pin #1143 — attribution risk).
// Dry-run default; --write to persist.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAmenity, SUNBED_AMENITY_TERMS, hasExplicitBeachBarAmenityInList, amenityTextIncludesAny } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const write = process.argv.includes('--write');
const STAMP = '2026-07-20';
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

const HOLD = new Set([1142]); // 2nd-source beach bar may be on the adjacent pin #1143
const held = new Map((rd(R('reports', 'amenity-evidence', 'leaning-organized-held.json')) || []).map(h => [h.id, h]));
const results = [];
for (const i of [0, 1, 2, 3, 4]) { const f = R('reports', 'amenity-evidence', 'reverify2', 'results', `batch-${i}.json`); const a = rd(f); if (a) results.push(...a); }

const data = rd(R('public', 'greek_beaches.json'));
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const addAmen = (m, a) => { m.amenities = m.amenities || []; if (!m.amenities.some(x => normalizeAmenity(x) === normalizeAmenity(a))) m.amenities.push(a); };
const addUrl = (m, u) => { if (!u) return; m.sourceUrls = m.sourceUrls || []; if (!m.sourceUrls.includes(u)) m.sourceUrls.push(u); };

const confirmed = results.filter(r => r.verdict === 'CONFIRMED' && !HOLD.has(r.id));
const refuted = results.filter(r => r.verdict === 'REFUTED');
const byId = new Map(results.map(r => [r.id, r]));
const applied = [], noted = [];

(function walk(n) {
  if (Array.isArray(n)) { for (const it of n) walk(it); return; }
  if (!n || typeof n !== 'object') return;
  if (byId.has(n.id) && n.metadata) {
    const r = byId.get(n.id), m = n.metadata, h = held.get(n.id) || {};
    if (r.verdict === 'CONFIRMED' && !HOLD.has(n.id) && m.organized !== true) {
      m.organized = true;
      const added = [];
      if (r.beachBar === true && !hasExplicitBeachBarAmenityInList(m.amenities || [])) { addAmen(m, 'beach bar εποχικά'); added.push('beach bar'); }
      if (r.sunbeds === true && !amenityTextIncludesAny(m.amenities || [], SUNBED_AMENITY_TERMS)) { addAmen(m, 'ξαπλώστρες, ομπρέλες εποχικά'); added.push('sunbeds'); }
      addUrl(m, r.sourceUrl); addUrl(m, h.round1Url);
      appendNote(m, `Amenity re-verify ${STAMP} (no-API): organized confirmed by TWO independent sources — (1) ${String(h.round1Evidence || '').slice(0, 90)} [${h.round1Url || ''}]; (2) ${String(r.evidence || '').slice(0, 110)} [${r.sourceUrl || ''}]${added.length ? '; ' + added.join('+') + ' added' : ''}.`);
      applied.push({ id: n.id, name: n.name, added, conf: r.confidence });
    } else if (r.verdict === 'REFUTED') {
      addUrl(m, r.sourceUrl);
      appendNote(m, `Amenity re-verify ${STAMP} (no-API): checked and confirmed NOT organized — ${String(r.evidence || '').slice(0, 140)} [${r.sourceUrl || ''}].`);
      noted.push({ id: n.id, name: n.name });
    }
  }
  for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
})(data);

console.log(`applyReverify2 — ${write ? 'WRITE' : 'DRY-RUN'}`);
console.log(`  CONFIRMED applied: ${applied.length} (held #1142) | REFUTED noted: ${noted.length}`);
for (const a of applied) console.log(`   ✓#${a.id} ${(a.name || '').slice(0, 26).padEnd(26)} [${a.conf}]${a.added.length ? ' +' + a.added.join('+') : ' (organized only)'}`);
for (const a of noted) console.log(`   ·#${a.id} ${(a.name || '').slice(0, 26)} — verified unorganized`);
if (write) { writeFileSync(R('public', 'greek_beaches.json'), JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('\nWrote public/greek_beaches.json'); }
writeFileSync(R('reports', 'amenity-evidence', `reverify2-apply-${STAMP}.json`), JSON.stringify({ applied, noted, heldPins: [...HOLD] }, null, 1));
