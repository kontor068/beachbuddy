// Deep multi-signal pass over the remaining organized:false "medium" omissions.
// Read-only. For each beach it counts INDEPENDENT commercial signals from every on-disk
// source, and buckets: STRONG (>=2 signals, no negation) → safe to flip; WEAK (1) → review;
// NEGATED (our own story/amenities say NOT organized / bring-your-own) → confirmed unorganized.
// No API. --write applies ONLY the STRONG bucket (organized:true + amenity the evidence names).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAmenity, BEACH_BAR_AMENITY_TERMS, SUNBED_AMENITY_TERMS, TAVERNA_AMENITY_TERMS, RESTAURANT_AMENITY_TERMS, CAFE_AMENITY_TERMS, hasExplicitBeachBarAmenityInList, amenityTextIncludesAny } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');
const STAMP = new Date().toISOString().slice(0, 10);
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

const gc = readJson(R('reports', 'amenity-evidence', 'google-nearby-cache.json')) || {};
const oc = readJson(R('reports', 'amenity-evidence', 'osm-nearby-cache.json')) || {};
function R(...p) { return path.join(rootDir, ...p); }
const merged = (id) => [...(gc[id] || []), ...(oc[id] || [])];
const ownAt = new Map();
for (const r of readJson(R('reports', 'place-resolution', 'google-upgrade.json')) || []) { if (!Number.isInteger(r?.id)) continue; const d = Number(r?.distM); if (r?.status !== 'WRONG_PLACE' && Number.isFinite(d) && d <= 150) ownAt.set(r.id, (r?.top?.primaryType || '').toLowerCase()); }

// editorial stories
const stories = readJson(R('data', 'beachStories.data.json')) || {};
const storyById = {};
for (const reg of Object.values(stories)) if (reg && typeof reg === 'object') for (const [id, st] of Object.entries(reg)) { const parts = []; const pull = (o) => { if (typeof o === 'string') parts.push(o); else if (Array.isArray(o)) o.forEach(pull); else if (o && typeof o === 'object') Object.values(o).forEach(pull); }; pull(st?.title); pull(st?.paragraphs); storyById[id] = normalizeAmenity(parts.join(' ')); }

const isBar = (t) => { t = String(t || '').toLowerCase(); return t === 'bar' || t.includes('night_club') || /\bpub\b/.test(t) || t.includes('beach_club'); };
const isResort = (t) => String(t || '').toLowerCase().includes('resort');
const isFood = (t) => /restaurant|cafe|coffee|bakery|meal_takeaway|fast_food|diner|bistro|tavern|food/.test(String(t || '').toLowerCase());
const barTerms = BEACH_BAR_AMENITY_TERMS.map(normalizeAmenity), sunTerms = SUNBED_AMENITY_TERMS.map(normalizeAmenity);
const foodTerms = [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS, ...CAFE_AMENITY_TERMS].map(normalizeAmenity);
const STORY_ORG = [/οργανωμ[εη]ν/, /\borganized\b/, /municipally run/, /εποχικα beach bar/, /με beach bar/];
const STORY_NEG = ['δεν ειναι οργαν', 'μη οργανωμ', 'not organized', 'no umbrella', 'no sunbed', 'χωρις οργαν', 'bring your own', 'bring an umbrella', 'may not be installed', 'δεν καταγραφ', 'δεν λειτουργ', 'δεν διαθετ', 'δεν προσφερ', 'χωρις υπηρεσ', 'not fully', 'δεν προκειται για πληρ', 'without natural'].map(normalizeAmenity);

const flatten = (data) => { const out = []; (function w(n) { if (Array.isArray(n)) { for (const it of n) { if (Number.isInteger(it?.id) && it?.metadata) out.push(it); w(it); } return; } if (n && typeof n === 'object') for (const v of Object.values(n)) w(v); })(data); return out; };
const data = readJson(R('public', 'greek_beaches.json'));
const beaches = flatten(data);

const NEG_CTX = ['κοντα', 'φερνεις δικο', 'δικο σου', 'καμια', 'χωρις', 'πανω απο', 'στο οριο'].map(normalizeAmenity);
const onBeach = (am, terms) => (am || []).some(it => { const t = normalizeAmenity(it); return terms.some(x => t.includes(normalizeAmenity(x))) && !NEG_CTX.some(n => t.includes(n)); });

const strong = [], weak = [], negated = [];
for (const b of beaches) {
  const m = b.metadata; if (m.organized === true) continue;
  const am = m.amenities || [];
  const near = merged(b.id);
  const story = storyById[b.id] || '';
  const storyNeg = STORY_NEG.some(n => story.includes(n));
  // "οργανωμένες κατασκηνώσεις/κάμπινγκ" is organized CAMPING, not an organized beach — exclude.
  const storyCamping = /οργανωμ[εη]ν[^.]{0,18}(κατασκην|καμπιν|camp)/.test(story);
  const storyPos = !storyNeg && !storyCamping && STORY_ORG.some(re => re.test(story));

  const own = ownAt.get(b.id) || '';
  // CORE-org signals (actually imply sunbeds/bar/resort/organized — not just "food exists")
  const core = {};
  if (near.some(p => (p.d ?? 1e9) <= 150 && isBar(p.primaryType))) core.barNear = 1;
  if (near.some(p => (p.d ?? 1e9) <= 150 && isResort(p.primaryType))) core.resortNear = 1;
  if (isBar(own) || isResort(own)) core.ownBarResort = 1;
  if (storyPos) core.storyOrganized = 1;
  if (onBeach(am, [...barTerms, ...sunTerms])) core.ownAmenityOnBeach = 1;
  // SUPPORT signals (corroborate but never establish "organized" alone)
  const support = {};
  if (near.some(p => (p.d ?? 1e9) <= 80 && isFood(p.primaryType))) support.foodOnSand = 1;
  if (isFood(own)) support.ownFoodType = 1;
  if (onBeach(am, foodTerms) || amenityTextIncludesAny(am, [...TAVERNA_AMENITY_TERMS, ...RESTAURANT_AMENITY_TERMS])) support.ownAmenityFood = 1;

  const coreKeys = Object.keys(core), supKeys = Object.keys(support);
  const rc = m.popularity?.ratingCount ?? null;
  const rec = { id: b.id, name: b.name, signals: [...coreKeys, ...supKeys], coreKeys, rc, node: b };
  // STRONG requires at least one CORE-org signal AND >=2 signals total (core corroborated).
  if (storyNeg) negated.push(rec);
  else if (coreKeys.length >= 1 && (coreKeys.length + supKeys.length) >= 2) strong.push(rec);
  else weak.push(rec);
}

// apply STRONG
const applied = [];
if (write) {
  const appendNote = (m, line) => { const e = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || ''); m.sourceNotes = (e ? e + ' ' : '') + line; };
  const addAmen = (m, a) => { m.amenities = m.amenities || []; if (!m.amenities.some(x => normalizeAmenity(x) === normalizeAmenity(a))) m.amenities.push(a); };
  for (const r of strong) {
    const m = r.node.metadata; m.organized = true;
    const near = merged(r.id); const story = storyById[r.id] || '';
    const added = [];
    // Add a SPECIFIC amenity only on tight evidence (bar ON the sand / named-in-story / our own
    // on-beach text). A bar merely within 150m flips organized but does NOT fabricate "beach bar".
    const barEv = near.some(p => (p.d ?? 1e9) <= 80 && isBar(p.primaryType)) || barTerms.some(t => story.includes(t)) || onBeach(m.amenities, barTerms);
    const sunEv = near.some(p => (p.d ?? 1e9) <= 100 && isResort(p.primaryType)) || sunTerms.some(t => story.includes(t)) || onBeach(m.amenities, sunTerms);
    if (barEv && !hasExplicitBeachBarAmenityInList(m.amenities)) { addAmen(m, 'beach bar εποχικά'); added.push('beach bar'); }
    if (sunEv && !amenityTextIncludesAny(m.amenities, SUNBED_AMENITY_TERMS)) { addAmen(m, 'ξαπλώστρες, ομπρέλες εποχικά'); added.push('sunbeds'); }
    appendNote(m, `Medium-omission multi-signal pass ${STAMP} (no-API): organized flag corrected to true — ${r.signals.length} independent signals (${r.signals.join(', ')})${added.length ? '; ' + added.join('+') + ' added' : ''}.`);
    applied.push(r);
  }
  writeFileSync(R('public', 'greek_beaches.json'), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

console.log(`Medium-omission deep pass — ${write ? 'WRITE' : 'DRY-RUN'}`);
console.log(`  STRONG (>=2 signals) ${write ? 'APPLIED' : 'to apply'}: ${strong.length}`);
console.log(`  WEAK (1 signal) → review: ${weak.length}`);
console.log(`  NEGATED (our own text says NOT organized): ${negated.length}`);
console.log(`\nSTRONG sample:`);
for (const r of strong.slice(0, 30)) console.log(`   #${r.id} ${(r.name || '').slice(0, 26).padEnd(26)} [${r.signals.join('+')}]${r.rc ? ' rc=' + r.rc : ''}`);
writeFileSync(R('reports', 'amenity-evidence', `medium-omission-pass-${STAMP}.json`), JSON.stringify({ strong: strong.map(r => ({ id: r.id, name: r.name, signals: r.signals, rc: r.rc })), weak: weak.map(r => ({ id: r.id, name: r.name, signals: r.signals })), negated: negated.map(r => ({ id: r.id, name: r.name })) }, null, 2), 'utf8');
