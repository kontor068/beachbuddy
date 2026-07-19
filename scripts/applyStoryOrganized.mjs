// Phase "do-them-all" — apply organized:true to a HAND-VETTED set of medium omissions whose
// own editorial story explicitly states the beach is organized (no negation). Each id below
// was individually read (snippet-checked); #1386 "δεν πρόκειται για πλήρως οργανωμένη" and
// #1140 "οργανωμένες κατασκηνώσεις" (camping) were rejected. Amenities are added ONLY for what
// the story literally names. Dry-run default; --write to persist. Provenance stamped.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAmenity, BEACH_BAR_AMENITY_TERMS, SUNBED_AMENITY_TERMS, hasExplicitBeachBarAmenityInList, amenityTextIncludesAny } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = new Date().toISOString().slice(0, 10);
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

const VETTED = new Set([8, 1413, 15, 17, 1399, 1457, 65, 2135, 50, 1376, 1322, 1858, 317, 2373, 134, 798, 1585, 3024, 3034, 1347, 1731, 1287, 101, 3030, 375, 778, 1248, 2251, 3049, 2714]);

// editorial story text per beach id (normalized)
const stories = readJson(path.join(rootDir, 'data', 'beachStories.data.json')) || {};
const storyById = {};
for (const reg of Object.values(stories)) if (reg && typeof reg === 'object') for (const [id, st] of Object.entries(reg)) {
  const parts = []; const pull = (o) => { if (typeof o === 'string') parts.push(o); else if (Array.isArray(o)) o.forEach(pull); else if (o && typeof o === 'object') Object.values(o).forEach(pull); };
  pull(st?.title); pull(st?.paragraphs); storyById[id] = normalizeAmenity(parts.join(' '));
}
const barTerms = BEACH_BAR_AMENITY_TERMS.map(normalizeAmenity);
const sunTerms = SUNBED_AMENITY_TERMS.map(normalizeAmenity);

const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const data = readJson(sourcePath);
const applied = [];
const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
const addAmen = (m, a) => { m.amenities = m.amenities || []; if (!m.amenities.some(x => normalizeAmenity(x) === normalizeAmenity(a))) m.amenities.push(a); };

const walk = (node) => {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (VETTED.has(node.id) && node.metadata && node.metadata.organized !== true) {
    const m = node.metadata; const s = storyById[node.id] || '';
    m.organized = true;
    // Don't import a "bring your own umbrella" mention as a sunbed PROVISION (the #1858 leak).
    const byo = ['bring an umbrella', 'bring your own', 'φερε ομπρελ', 'δικη σου ομπρελ', 'φερνεις.{0,12}ομπρελ', 'bring a mat'].some(n => new RegExp(normalizeAmenity(n)).test(s));
    const added = [];
    if (barTerms.some(t => s.includes(t)) && !hasExplicitBeachBarAmenityInList(m.amenities || [])) { addAmen(m, 'beach bar εποχικά'); added.push('beach bar'); }
    if (!byo && sunTerms.some(t => s.includes(t)) && !amenityTextIncludesAny(m.amenities || [], SUNBED_AMENITY_TERMS)) { addAmen(m, 'ξαπλώστρες, ομπρέλες εποχικά'); added.push('sunbeds'); }
    appendNote(m, `Reverse amenity sweep ${STAMP} (no-API): organized flag corrected to true — our own editorial story explicitly describes an organized beach${added.length ? ' (' + added.join('+') + ' added from the story)' : ''}.`);
    applied.push({ id: node.id, name: node.name, added });
  }
  for (const v of Object.values(node)) walk(v);
};
walk(data);

console.log(`applyStoryOrganized — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length} beaches`);
for (const a of applied) console.log(`  #${a.id} ${a.name}  ${a.added.length ? '+' + a.added.join('+') : '(organized only)'}`);
if (write) { writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8'); console.log(`\nWrote ${path.relative(rootDir, sourcePath)}. Run build:beach-data`); }
else console.log('\nDry-run. --write to persist.');
