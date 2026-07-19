// Reverse amenity sweep — find OMISSIONS (false negatives) and ERRORS (false
// positives) in organized/amenity data WITHOUT any live API call.
//
// Motivation: auditAmenityEvidence.mjs only checks the positive direction (are
// existing "organized" claims supported?). It never promotes an unorganized
// beach, so genuinely-organized beaches whose official source omits commercial
// amenities stay `organized:false` forever (e.g. id 1350 Ξέρες Ευρειακής).
//
// This sweep is READ-ONLY and uses ONLY data already on disk (no new billing):
//   1. reports/place-resolution/google-upgrade.json   — each beach's own resolved
//      Google primaryType/types (already paid, cached).
//   2. reports/amenity-evidence/google-nearby-cache.json — nearby POIs (name,
//      primaryType, distance d) around a subset of pins (already paid, cached).
//   3. data/beachStories.data.json                    — curated editorial text.
//   4. The dataset itself                             — internal consistency.
//
// Usage:
//   node scripts/reverseAmenitySweep.mjs [--region <substr>] [--out <path>] [--limit N]
//
// Output: <out>.json + console summary. Never writes the beach dataset.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BEACH_BAR_AMENITY_TERMS, SUNBED_AMENITY_TERMS,
  TAVERNA_AMENITY_TERMS, RESTAURANT_AMENITY_TERMS,
  hasExplicitBeachBarAmenityInList, amenityTextIncludesAny, normalizeAmenity,
} from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const regionFilter = getArg('--region', null);
const limit = getArg('--limit') ? Number(getArg('--limit')) : Infinity;
const outDir = path.join(rootDir, 'reports', 'amenity-evidence');
const outPath = getArg('--out', path.join(outDir, `reverse-sweep-${new Date().toISOString().slice(0, 10)}.json`));

// --- flatten source (mirrors auditAmenityEvidence.mjs) ---------------------------------------
const regionId = (region, prefecture) =>
  `${region || 'Unknown'}-${prefecture || region || 'Unknown'}`.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || 'unknown';
const flatten = (data) => {
  const out = [];
  const walk = (node, region, parts) => {
    if (Array.isArray(node)) {
      for (const it of node) {
        const lat = Number(it?.lat), lon = Number(it?.lon);
        if (Number.isInteger(it?.id) && Number.isFinite(lat) && Number.isFinite(lon))
          out.push({ id: it.id, name: it.name, lat, lon, metadata: it.metadata, regionId: regionId(region, parts[parts.length - 1] || region) });
      }
      return;
    }
    if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, region, [...parts, k]);
  };
  for (const [region, node] of Object.entries(data)) walk(node, region, []);
  return out;
};

// --- Google place-type classifiers (granular primaryType strings) ----------------------------
const isBarLike = (t) => { t = String(t || '').toLowerCase(); return t === 'bar' || t.includes('night_club') || /\bpub\b/.test(t) || t.includes('beach_club') || t.includes('wine_bar'); };
const isResortLike = (t) => String(t || '').toLowerCase().includes('resort');
const isFoodLike = (t) => { t = String(t || '').toLowerCase(); return t.includes('restaurant') || t.includes('cafe') || t.includes('coffee') || t.includes('bakery') || t.includes('meal_takeaway') || t.includes('fast_food') || t.includes('diner') || t.includes('bistro') || t.includes('tavern') || t === 'food'; };

// --- load on-disk signals --------------------------------------------------------------------
const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);
const source = readJson(path.join(rootDir, 'public', 'greek_beaches.json'));
const beaches = flatten(source).filter(b => !regionFilter || b.regionId.includes(regionFilter));

const upgrade = readJson(path.join(rootDir, 'reports', 'place-resolution', 'google-upgrade.json')) || [];
const ownType = new Map();       // id -> { primaryType, types:[] } — only when the pin resolved AT the beach
for (const r of upgrade) {
  if (!Number.isInteger(r?.id)) continue;
  const d = Number(r?.distM);
  if (r?.status === 'WRONG_PLACE' || !Number.isFinite(d) || d > 150) continue;  // ignore far mis-resolutions
  ownType.set(r.id, { primaryType: (r?.top?.primaryType || '').toLowerCase(), types: (r?.top?.types || []).map(t => String(t).toLowerCase()) });
}

// Merge every on-disk nearby cache (Google = paid/partial, OSM = free/national) — same shape.
const nearbyById = new Map();    // id -> [{name, primaryType, d}]
for (const cache of ['google-nearby-cache.json', 'osm-nearby-cache.json']) {
  const obj = readJson(path.join(rootDir, 'reports', 'amenity-evidence', cache)) || {};
  for (const [k, v] of Object.entries(obj)) {
    if (!Array.isArray(v)) continue;
    const id = Number(k);
    nearbyById.set(id, [...(nearbyById.get(id) || []), ...v]);
  }
}

// editorial stories: region -> id(str) -> {title, paragraphs}
const storiesRaw = readJson(path.join(rootDir, 'data', 'beachStories.data.json')) || {};
const storyText = new Map();     // id -> concatenated normalized text
for (const region of Object.values(storiesRaw)) {
  if (!region || typeof region !== 'object') continue;
  for (const [idStr, story] of Object.entries(region)) {
    const parts = [];
    const pull = (o) => { if (typeof o === 'string') parts.push(o); else if (Array.isArray(o)) o.forEach(pull); else if (o && typeof o === 'object') Object.values(o).forEach(pull); };
    pull(story?.title); pull(story?.paragraphs);
    storyText.set(Number(idStr), normalizeAmenity(parts.join(' ')));
  }
}

const textHits = (txt, terms) => !!txt && terms.some(t => txt.includes(normalizeAmenity(t)));

// Guards against the false positives found in validation:
//  - negation / bring-your-own phrasing that the plain term matcher mis-reads as a provision
//    e.g. "φέρνεις δικό σου ομπρέλα", "καμία οργανωμένη παροχή", "χωρίς πλήρη οργάνωση"
const NEG_CTX = ['φερνεις δικο', 'δικο σου', 'καμια οργαν', 'χωρις οργαν', 'χωρις πληρη', 'μη οργαν', 'ελευθερη παραλια', 'χωρις επιβεβαιωμεν', 'no sunbed', 'χωρις ξαπλ', 'δεν υπαρχ'].map(normalizeAmenity);
//  - "κοντά"/nearby qualifier: the amenity is NEAR the beach, not on it → consistent with unorganized
const NEARBY_QUAL = ['κοντα', 'στο οριο', 'στην περιοχη', 'οικισμου', 'πανω απο', 'πανω στο', 'στο βραχ', 'στον γκρεμ', 'στον οικισμ'].map(normalizeAmenity);
const hasNeg = (txt) => NEG_CTX.some(n => txt.includes(n));
// an amenity item that asserts a bar/sunbed PRESENT ON this beach (not BYO, not nearby-only)
const isOnBeachClaim = (item, terms) => {
  const t = normalizeAmenity(item);
  if (!terms.some(x => t.includes(normalizeAmenity(x)))) return false;
  if (NEG_CTX.some(n => t.includes(n))) return false;
  if (NEARBY_QUAL.some(n => t.includes(n))) return false;
  return true;
};
// access-restricted (military/officer resorts) — organized but NOT a public beach bar
const RESTRICTED = ['θερετρο', 'καау', 'στρατ', 'ναυτικ', 'αξιωματικ', 'officer', 'military', 'περιορισμενη προσβαση'].map(normalizeAmenity);
const isRestricted = (b, m) => { const hay = normalizeAmenity((b.name || '') + ' ' + (m.amenities || []).join(' ')); return RESTRICTED.some(r => hay.includes(r)); };

// --- evaluate --------------------------------------------------------------------------------
const ON_SAND = 80;    // m: a POI this close is on the beach itself
const CONTEXT = 200;   // m: same cove / access point

const omissions = [];   // false negatives: organized:false but evidence says organized
const errors = [];      // false positives / contradictions

for (const b of beaches) {
  const m = b.metadata || {};
  const am = m.amenities || [];
  const organized = m.organized === true;
  const claimBar = hasExplicitBeachBarAmenityInList(am);
  const claimSunbed = amenityTextIncludesAny(am, SUNBED_AMENITY_TERMS);

  const own = ownType.get(b.id);
  const near = nearbyById.get(b.id) || null;
  const hasNearbyCoverage = Array.isArray(near);
  const sand = hasNearbyCoverage ? near.filter(p => (p.d ?? 1e9) <= ON_SAND) : [];
  const ctx = hasNearbyCoverage ? near.filter(p => (p.d ?? 1e9) <= CONTEXT) : [];
  const sandBar = sand.find(p => isBarLike(p.primaryType) || isResortLike(p.primaryType));
  const sandFood = sand.find(p => isFoodLike(p.primaryType));
  const ctxBar = ctx.find(p => isBarLike(p.primaryType) || isResortLike(p.primaryType));
  const ctxFood = ctx.find(p => isFoodLike(p.primaryType));
  const ownCommercial = own && (isBarLike(own.primaryType) || isResortLike(own.primaryType) || isFoodLike(own.primaryType));
  const story = storyText.get(b.id);
  const storyBar = textHits(story, BEACH_BAR_AMENITY_TERMS);
  const storySunbed = textHits(story, SUNBED_AMENITY_TERMS);

  const restricted = isRestricted(b, m);
  const onBeachBarClaim = (am || []).some(it => isOnBeachClaim(it, BEACH_BAR_AMENITY_TERMS));
  const onBeachSunbedClaim = (am || []).some(it => isOnBeachClaim(it, SUNBED_AMENITY_TERMS));

  // ---- OMISSIONS (organized:false, evidence of organization) ----
  if (!organized && !restricted) {
    const ev = [];
    let strength = null;
    const bump = (s) => { if (s === 'strong') strength = 'strong'; else if (!strength) strength = 'medium'; };
    // STRONG: physical / self-contradictory evidence
    if (sandBar && isBarLike(sandBar.primaryType)) { ev.push(`bar/beach-club ON sand: "${sandBar.name}" (${sandBar.primaryType}, ${sandBar.d}m)`); bump('strong'); }
    if (own && isBarLike(own.primaryType)) { ev.push(`beach pin's own Google type is a bar/club: ${own.primaryType}`); bump('strong'); }
    if (onBeachBarClaim || onBeachSunbedClaim) { ev.push(`dataset's own amenity list asserts an on-beach ${onBeachBarClaim ? 'bar' : 'sunbeds'} yet organized:false`); bump('strong'); }
    // MEDIUM: suggestive but weaker
    if (sandBar && isResortLike(sandBar.primaryType)) { ev.push(`resort ON sand: "${sandBar.name}" (${sandBar.d}m)`); bump('medium'); }
    if (sandFood) { ev.push(`taverna/cafe ON sand: "${sandFood.name}" (${sandFood.primaryType}, ${sandFood.d}m)`); bump('medium'); }
    if (ctxBar && !(sandBar && isBarLike(sandBar.primaryType))) { ev.push(`bar/resort ${ctxBar.d}m away: "${ctxBar.name}" (${ctxBar.primaryType})`); bump('medium'); }
    if (storyBar && !hasNeg(story)) { ev.push('editorial story mentions a beach bar / club'); bump('medium'); }
    if (storySunbed && !hasNeg(story)) { ev.push('editorial story mentions sunbeds/umbrellas'); bump('medium'); }
    if (own && isFoodLike(own.primaryType)) { ev.push(`beach pin's own Google type is food: ${own.primaryType}`); bump('medium'); }
    if (own && isResortLike(own.primaryType)) { ev.push(`beach pin's own Google type is a resort: ${own.primaryType}`); bump('medium'); }
    if (strength && ev.length) omissions.push({ id: b.id, name: b.name, regionId: b.regionId, strength, currentAmenities: am, evidence: ev,
      ratingCount: m.popularity?.ratingCount ?? null });
  }

  // ---- ERRORS / contradictions ----
  // E1: organized but lists nothing (internal, no external data needed)
  if (organized && am.length === 0)
    errors.push({ id: b.id, name: b.name, regionId: b.regionId, kind: 'organized-but-empty', detail: 'organized:true but amenities:[] — nothing backs the claim', ratingCount: m.popularity?.ratingCount ?? null });
  // E2: not organized yet an amenity string asserts an ON-beach bar/sunbed (flag/amenity mismatch)
  //     (BYO / "κοντά" / "χωρίς οργάνωση" phrasings are excluded by isOnBeachClaim)
  if (!organized && (onBeachBarClaim || onBeachSunbedClaim))
    errors.push({ id: b.id, name: b.name, regionId: b.regionId, kind: 'flag-amenity-mismatch', detail: `organized:false but amenities assert on-beach ${onBeachBarClaim ? 'bar' : ''}${onBeachBarClaim && onBeachSunbedClaim ? '+' : ''}${onBeachSunbedClaim ? 'sunbeds' : ''}`, currentAmenities: am });
  // E3: organized+strong claim but nearby coverage shows NO food/bar anywhere in context and own type not commercial (only where we have coverage → judgeable, no API)
  if (organized && (claimBar || claimSunbed) && hasNearbyCoverage && !ctxBar && !ctxFood && !ownCommercial)
    errors.push({ id: b.id, name: b.name, regionId: b.regionId, kind: 'claim-unsupported-by-cache', detail: `claims ${claimBar ? 'bar' : ''}${claimSunbed ? ' sunbeds' : ''} but cached nearby POIs (${near.length}) show no food/bar within ${CONTEXT}m`, currentAmenities: am, ratingCount: m.popularity?.ratingCount ?? null });
}

const rank = { strong: 0, medium: 1 };
omissions.sort((a, b) => (rank[a.strength] - rank[b.strength]) || ((b.ratingCount ?? 0) - (a.ratingCount ?? 0)));

const report = {
  generatedAt: new Date().toISOString(),
  method: 'reverse-amenity-sweep-v1 (no-API, on-disk signals only)',
  signalsUsed: {
    ownGoogleType: ownType.size,
    nearbyCacheCoverage: nearbyById.size,
    editorialStories: storyText.size,
  },
  totals: {
    beachesScanned: beaches.length,
    omissionsStrong: omissions.filter(o => o.strength === 'strong').length,
    omissionsMedium: omissions.filter(o => o.strength === 'medium').length,
    errorsOrganizedButEmpty: errors.filter(e => e.kind === 'organized-but-empty').length,
    errorsFlagMismatch: errors.filter(e => e.kind === 'flag-amenity-mismatch').length,
    errorsClaimUnsupported: errors.filter(e => e.kind === 'claim-unsupported-by-cache').length,
  },
  omissions,
  errors,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

console.log(`\nReverse amenity sweep (no API) — scanned ${beaches.length} beaches`);
console.log(`Signals: ownType=${ownType.size}  nearbyCache=${nearbyById.size}  stories=${storyText.size}`);
console.log(`\nOMISSIONS (organized:false but evidence of organization):`);
console.log(`  strong: ${report.totals.omissionsStrong}   medium: ${report.totals.omissionsMedium}`);
for (const o of omissions.filter(x => x.strength === 'strong').slice(0, 30))
  console.log(`   #${o.id}  ${o.name} [${o.regionId}]  — ${o.evidence[0]}`);
console.log(`\nERRORS / contradictions:`);
console.log(`  organized-but-empty:        ${report.totals.errorsOrganizedButEmpty}`);
console.log(`  flag/amenity mismatch:      ${report.totals.errorsFlagMismatch}`);
console.log(`  claim unsupported by cache: ${report.totals.errorsClaimUnsupported}`);
for (const e of errors.filter(x => x.kind === 'flag-amenity-mismatch').slice(0, 20))
  console.log(`   #${e.id}  ${e.name} [${e.regionId}]  — ${e.detail}`);
console.log(`\nWrote ${path.relative(rootDir, outPath)}`);
