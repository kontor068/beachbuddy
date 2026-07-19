// Apply web-search-verified organized corrections (2026-07-19 deep pass over the 387 uncertain).
// Policy: HIGH-confidence ORGANIZED → apply. MEDIUM/LOW ORGANIZED → apply ONLY when the beach
// also had an independent CORE signal in the medium-omission pass (web + on-disk = 2 signals).
// UNORGANIZED / UNCLEAR → no change. Amenities added only per the web evidence flags.
// #511 (Πλαζ Αρετσούς) is HELD: sunbeds exist but official no-swim signage — do not promote.
// Dry-run default; --write to persist. Provenance sourceNote incl. source URL on every change.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAmenity, SUNBED_AMENITY_TERMS, hasExplicitBeachBarAmenityInList, amenityTextIncludesAny } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const write = process.argv.includes('--write');
const STAMP = '2026-07-20';
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, ''));

const HOLD = new Set([511, 2062, 31, 2540]); // 511 no-swim; 2062 landslide; 31 Navy-only; 2540 pin possibly 3-4km off — verify pin first
const fileArg = process.argv.find(a => a.startsWith('--file='));
const results = readJson(fileArg ? R(fileArg.slice(7)) : R('reports', 'amenity-evidence', 'websearch-merged-2026-07-19.json'));
const omission = readJson(R('reports', 'amenity-evidence', 'medium-omission-pass-2026-07-19.json'));
const CORE = new Set(['barNear', 'resortNear', 'ownBarResort', 'storyOrganized', 'ownAmenityOnBeach']);
const coreIds = new Set(omission.weak.filter(w => (w.signals || []).some(s => CORE.has(s))).map(w => w.id));

const toApply = new Map();
for (const r of results) {
  if (r.verdict !== 'ORGANIZED' || HOLD.has(r.id)) continue;
  if (r.confidence === 'high') toApply.set(r.id, { ...r, basis: 'web-high' });
  else if (coreIds.has(r.id)) toApply.set(r.id, { ...r, basis: 'web-medium+core-signal' });
}

const data = readJson(R('public', 'greek_beaches.json'));
const applied = [], skippedMed = results.filter(r => r.verdict === 'ORGANIZED' && !HOLD.has(r.id) && r.confidence !== 'high' && !coreIds.has(r.id));
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const addAmen = (m, a) => { m.amenities = m.amenities || []; if (!m.amenities.some(x => normalizeAmenity(x) === normalizeAmenity(a))) m.amenities.push(a); };

(function walk(n) {
  if (Array.isArray(n)) { for (const it of n) walk(it); return; }
  if (!n || typeof n !== 'object') return;
  if (toApply.has(n.id) && n.metadata && n.metadata.organized !== true) {
    const r = toApply.get(n.id); const m = n.metadata;
    m.organized = true;
    const added = [];
    if (r.beachBar === true && !hasExplicitBeachBarAmenityInList(m.amenities || [])) { addAmen(m, 'beach bar εποχικά'); added.push('beach bar'); }
    if (r.sunbeds === true && !amenityTextIncludesAny(m.amenities || [], SUNBED_AMENITY_TERMS)) { addAmen(m, 'ξαπλώστρες, ομπρέλες εποχικά'); added.push('sunbeds'); }
    appendNote(m, `Web-verified ${STAMP} (${r.basis}): organized — ${String(r.evidence || '').slice(0, 160)} [${r.sourceUrl || ''}]${added.length ? '; ' + added.join('+') + ' added' : ''}.`);
    applied.push({ id: n.id, name: n.name, basis: r.basis, added });
  }
  for (const v of Object.values(n)) if (v && typeof v === 'object') walk(v);
})(data);

console.log(`applyWebVerified — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length} beaches (held: 511; medium-without-core skipped: ${skippedMed.length})`);
for (const a of applied) console.log(`  #${a.id} ${(a.name || '').slice(0, 30).padEnd(30)} ${a.basis}${a.added.length ? ' +' + a.added.join('+') : ''}`);
if (write) { writeFileSync(R('public', 'greek_beaches.json'), JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log('\nWrote public/greek_beaches.json'); }
writeFileSync(R('reports', 'amenity-evidence', `web-verified-apply-${STAMP}${fileArg ? '-r2' : ''}.json`), JSON.stringify({ applied, skippedMediumNoCore: skippedMed.map(r => ({ id: r.id, name: r.name, evidence: r.evidence, sourceUrl: r.sourceUrl })) }, null, 1));
