// Phase 1.1 — amenity FALSE-POSITIVE audit (no API, read-only).
// Finds beaches that CLAIM an on-beach bar/sunbeds (organized:true) but no physical
// POI (Google or OSM) corroborates it. Reliability-first: absence of a POI is only a
// suspect when the area is otherwise mapped (>=MIN_POIS nearby); sparse-map beaches are
// "unverifiable", never flagged. Never writes — emits a review list.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BEACH_BAR_AMENITY_TERMS, SUNBED_AMENITY_TERMS, hasExplicitBeachBarAmenityInList, amenityTextIncludesAny, normalizeAmenity } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);
const MIN_POIS = 3;         // enough surrounding mapping to trust a "no bar here" signal
const RADIUS = 150;

const flatten = (data) => { const out = []; const walk = (n) => { if (Array.isArray(n)) { for (const it of n) { if (Number.isInteger(it?.id) && it?.metadata) out.push(it); walk(it); } return; } if (n && typeof n === 'object') for (const v of Object.values(n)) walk(v); }; walk(data); return out; };
const beaches = flatten(readJson(path.join(rootDir, 'public', 'greek_beaches.json')));

const gc = readJson(path.join(rootDir, 'reports', 'amenity-evidence', 'google-nearby-cache.json')) || {};
const oc = readJson(path.join(rootDir, 'reports', 'amenity-evidence', 'osm-nearby-cache.json')) || {};
const merged = (id) => [...(gc[id] || []), ...(oc[id] || [])];
const up = new Map();
for (const r of readJson(path.join(rootDir, 'reports', 'place-resolution', 'google-upgrade.json')) || []) if (Number.isInteger(r?.id)) up.set(r.id, (r?.top?.primaryType || '').toLowerCase());
const isFoodBar = (t) => /bar|pub|restaurant|cafe|coffee|food|resort|taverna|bakery|fast_food|night_club/.test(String(t || '').toLowerCase());

// on-beach claim (reuse the same negation/nearby guards as the sweep)
const NEG = ['κοντα', 'φερνεις δικο', 'καμια', 'χωρις', 'πανω απο', 'στο οριο', 'στην περιοχη'].map(normalizeAmenity);
const onBeach = (am, terms) => (am || []).some(it => { const t = normalizeAmenity(it); return terms.some(x => t.includes(normalizeAmenity(x))) && !NEG.some(n => t.includes(n)); });

let corrob = 0, nocov = 0; const suspects = [];
for (const b of beaches) {
  const m = b.metadata; if (m.organized !== true) continue;
  const am = m.amenities || [];
  const claimBar = onBeach(am, BEACH_BAR_AMENITY_TERMS), claimSun = onBeach(am, SUNBED_AMENITY_TERMS);
  if (!claimBar && !claimSun) continue;
  const near = merged(b.id);
  const own = up.get(b.id) || '';
  const hasFB = near.some(p => (p.d ?? 1e9) <= RADIUS && isFoodBar(p.primaryType)) || isFoodBar(own);
  if (hasFB) { corrob++; continue; }
  if (near.length < MIN_POIS) { nocov++; continue; }
  suspects.push({ id: b.id, name: b.name, poiCount: near.length,
    claims: [claimBar ? 'bar' : null, claimSun ? 'sunbeds' : null].filter(Boolean),
    hasSource: ((m.sourceUrls?.length || 0) + (m.verification_sources?.length || 0)) > 0,
    amenities: am });
}

// Cross-check the historical amenity-evidence "unsupported" list against the new OSM cache
const hist = readJson(path.join(rootDir, 'reports', 'amenity-evidence', 'report-all-2026-06-20.json'));
let histTotal = 0, histNowCorrob = 0;
if (hist?.unsupported) {
  histTotal = hist.unsupported.length;
  for (const u of hist.unsupported) {
    const near = merged(u.id); const own = up.get(u.id) || '';
    if (near.some(p => (p.d ?? 1e9) <= RADIUS && isFoodBar(p.primaryType)) || isFoodBar(own)) histNowCorrob++;
  }
}

console.log(`Phase 1.1 — amenity false-positive audit (organized:true + on-beach bar/sunbed claim)`);
console.log(`  corroborated by a physical POI:       ${corrob}`);
console.log(`  no/low mapping coverage (unverifiable): ${nocov}`);
console.log(`  SUSPECT (>=${MIN_POIS} POIs mapped, none food/bar within ${RADIUS}m): ${suspects.length}`);
suspects.sort((a, b) => b.poiCount - a.poiCount);
for (const s of suspects.slice(0, 30)) console.log(`   #${s.id} ${s.name}  POIs=${s.poiCount} src=${s.hasSource} claim=${s.claims.join('+')}`);
console.log(`\nHistorical auditAmenityEvidence "unsupported": ${histTotal}; now corroborated by OSM/Google: ${histNowCorrob}; still unconfirmed: ${histTotal - histNowCorrob}`);

writeFileSync(path.join(rootDir, 'reports', 'amenity-evidence', `false-positive-suspects-${new Date().toISOString().slice(0, 10)}.json`), JSON.stringify({ generatedAt: new Date().toISOString(), corrob, nocov, suspects }, null, 2), 'utf8');
