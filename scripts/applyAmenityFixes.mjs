// Apply HIGH-CONFIDENCE amenity corrections found by reverseAmenitySweep.mjs.
// No API. Writes public/greek_beaches.json in place (json indent=2 round-trips
// the existing formatting, so the diff is scoped to the beaches actually changed).
//
// Dry-run by default; pass --write to persist. Conservative on purpose — only
// the tiers where the evidence is near-certain are auto-applied; everything
// softer stays report-only in the sweep JSON for manual review.
//
//   R1 flag-desync : organized:false but our OWN amenities assert an on-beach
//                    bar/sunbed  ->  organized:true (data self-consistency).
//   R2 physical-bar: organized:false + a named bar/beach-club POI on the sand
//                    (≤80m) OR the pin's own Google type is a bar/club
//                    ->  organized:true + add "beach bar" if missing.
//   R3 municipal   : organized:false + own Google type == public_bath
//                    ->  organized:true (developed/paid beach; no bar invented).
//   R4 empty-fix   : organized:true but amenities:[] and evidence exists
//                    ->  keep organized:true, add the evidenced amenities.
//
// Usage: node scripts/applyAmenityFixes.mjs [--write] [--region <substr>]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BEACH_BAR_AMENITY_TERMS, SUNBED_AMENITY_TERMS,
  hasExplicitBeachBarAmenityInList, amenityTextIncludesAny, normalizeAmenity,
} from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const write = args.includes('--write');
const getArg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const regionFilter = getArg('--region', null);
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const STAMP = new Date().toISOString().slice(0, 10);

const readJson = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);

// --- signals (same as the sweep) -------------------------------------------------------------
const upgrade = readJson(path.join(rootDir, 'reports', 'place-resolution', 'google-upgrade.json')) || [];
// Only trust a beach's own Google type when the resolved place is AT the beach
// (small distM, not a WRONG_PLACE mis-resolution kilometres away).
const ownAtBeach = new Map();
for (const r of upgrade) {
  if (!Number.isInteger(r?.id)) continue;
  const d = Number(r?.distM);
  if (r?.status !== 'WRONG_PLACE' && Number.isFinite(d) && d <= 150)
    ownAtBeach.set(r.id, (r?.top?.primaryType || '').toLowerCase());
}
// Merge every on-disk nearby cache (Google = paid/partial, OSM = free/national) — same shape.
const nearbyById = new Map();
for (const cache of ['google-nearby-cache.json', 'osm-nearby-cache.json']) {
  const obj = readJson(path.join(rootDir, 'reports', 'amenity-evidence', cache)) || {};
  for (const [k, v] of Object.entries(obj)) {
    if (!Array.isArray(v)) continue;
    const id = Number(k);
    nearbyById.set(id, [...(nearbyById.get(id) || []), ...v]);
  }
}

const isBarLike = (t) => { t = String(t || '').toLowerCase(); return t === 'bar' || t.includes('night_club') || /\bpub\b/.test(t) || t.includes('beach_club') || t.includes('wine_bar'); };
const isResortLike = (t) => String(t || '').toLowerCase().includes('resort');

// --- on-beach claim guards (validated in the sweep) ------------------------------------------
const NEG_CTX = ['φερνεις δικο', 'δικο σου', 'καμια οργαν', 'χωρις οργαν', 'χωρις πληρη', 'μη οργαν', 'ελευθερη παραλια', 'χωρις επιβεβαιωμεν', 'no sunbed', 'χωρις ξαπλ', 'δεν υπαρχ'].map(normalizeAmenity);
const NEARBY_QUAL = ['κοντα', 'στο οριο', 'στην περιοχη', 'οικισμου', 'πανω απο', 'πανω στο', 'στο βραχ', 'στον γκρεμ', 'στον οικισμ'].map(normalizeAmenity);
const RESTRICTED = ['θερετρο', 'καау', 'στρατ', 'ναυτικ', 'αξιωματικ', 'officer', 'military', 'περιορισμενη προσβαση'].map(normalizeAmenity);
const isOnBeachClaim = (item, terms) => {
  const t = normalizeAmenity(item);
  if (!terms.some(x => t.includes(normalizeAmenity(x)))) return false;
  if (NEG_CTX.some(n => t.includes(n))) return false;
  if (NEARBY_QUAL.some(n => t.includes(n))) return false;
  return true;
};
const isRestricted = (name, am) => { const hay = normalizeAmenity((name || '') + ' ' + (am || []).join(' ')); return RESTRICTED.some(r => hay.includes(r)); };

// --- walk + mutate ---------------------------------------------------------------------------
const data = readJson(sourcePath);
const applied = [];
const conflicts = [];   // physical evidence vs a "no facilities" claim — held for human review, never auto-applied
const review = [];      // weaker single signals (e.g. nameless OSM bar) — surfaced, never auto-applied

// explicit R4 fixes (evidenced amenity backfill for organized:true + empty)
const R4 = {
  692: ['ξαπλώστρες, ομπρέλες'],   // source profile documents umbrella/bed facilities (Drymiskos/Preveli cluster)
  1409: ['beach bar'],             // pin's own Google place type resolves to a bar
};

const appendNote = (m, line) => {
  const existing = Array.isArray(m.sourceNotes) ? m.sourceNotes.join(' ') : (m.sourceNotes || '');
  m.sourceNotes = (existing ? existing + ' ' : '') + line;
};
const addAmenities = (m, add) => {
  m.amenities = m.amenities || [];
  for (const a of add) if (!m.amenities.some(x => normalizeAmenity(x) === normalizeAmenity(a))) m.amenities.push(a);
};

const walk = (node) => {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;
  if (Number.isInteger(node.id) && node.metadata) {
    const b = node, m = b.metadata;
    if (!(regionFilter && !JSON.stringify(b).includes(regionFilter))) {
      const am = m.amenities || [];
      const name = b.name;
      const organized = m.organized === true;
      const own = ownAtBeach.get(b.id);
      const near = nearbyById.get(b.id) || [];
      const nearestOf = (pred, maxD, needName) => near.filter(p => (p.d ?? 1e9) <= maxD && pred(p.primaryType) && (!needName || String(p.name || '').trim())).sort((a, b) => a.d - b.d)[0];
      // Reliability: a bar POI only counts for auto-add if it carries an establishment NAME
      // (Google always names; OSM sometimes leaves amenity=bar nameless — those are held for review).
      const barSand = nearestOf(isBarLike, 70, true);   // a NAMED bar/pub/beach-club within 70m (on the sand)
      const unnamedBar = near.find(p => (p.d ?? 1e9) <= 70 && isBarLike(p.primaryType) && !String(p.name || '').trim());
      const resortSand = nearestOf(isResortLike, 100);  // OSM leisure=beach_resort within 100m (managed beach)
      const ownTypeBar = isBarLike(own);                // the pin itself resolved to a bar, AT the beach (distM≤150)
      // A firm "no organized facilities" denial in OUR data. If physical POIs disagree, that is a
      // genuine conflict → hold for human eyes, never silently override (reliability-first).
      const BLANKET = ['καμια οργαν', 'καμια παροχ', 'χωρις παροχ', 'χωρις οργαν'].map(normalizeAmenity);
      const blanketDenial = am.some(it => BLANKET.some(d => normalizeAmenity(it).includes(d)));

      // R4 — organized:true but empty amenities, evidence-backed backfill
      if (organized && am.length === 0 && R4[b.id]) {
        addAmenities(m, R4[b.id]);
        appendNote(m, `Reverse amenity sweep ${STAMP} (no-API): amenities backfilled to match the organized flag — ${R4[b.id].join(', ')}.`);
        applied.push({ id: b.id, name, rule: 'R4-empty-fix', change: `add amenities ${JSON.stringify(R4[b.id])}` });
      }

      if (!organized && !isRestricted(name, am)) {
        const onBeachBar = am.some(it => isOnBeachClaim(it, BEACH_BAR_AMENITY_TERMS));
        const onBeachSunbed = am.some(it => isOnBeachClaim(it, SUNBED_AMENITY_TERMS));
        // R1 — self-contradiction: our own amenities assert an on-beach bar/sunbed (safest: no new claim invented)
        if (onBeachBar || onBeachSunbed) {
          m.organized = true;
          const before = m.amenities.length;
          m.amenities = m.amenities.filter(it => !BLANKET.some(d => normalizeAmenity(it).includes(d)));
          const removed = before - m.amenities.length;
          appendNote(m, `Reverse amenity sweep ${STAMP} (no-API): organized flag corrected to true — dataset's own amenities already list an on-beach ${onBeachBar ? 'bar' : ''}${onBeachBar && onBeachSunbed ? '/' : ''}${onBeachSunbed ? 'sunbeds' : ''}${removed ? `; removed ${removed} contradictory "no-facilities" item(s)` : ''}.`);
          applied.push({ id: b.id, name, rule: 'R1-flag-desync', change: `organized -> true${removed ? `; -${removed} blanket-denial` : ''}` });
        }
        // Physical evidence disagrees with a firm "no facilities" claim → HOLD, do not auto-apply.
        else if (blanketDenial && (barSand || resortSand || ownTypeBar || own === 'public_bath')) {
          conflicts.push({ id: b.id, name, regionId: (b.regionId || ''), detail: `physical evidence (${barSand ? 'bar ' + barSand.d + 'm' : resortSand ? 'beach_resort ' + resortSand.d + 'm' : ownTypeBar ? 'own type=bar' : 'public_bath'}) contradicts a "no facilities" amenity claim`, amenities: am });
        }
        // R2 — a bar physically ON the sand (Google or OSM ≤70m), or the pin itself is a bar
        else if (barSand || ownTypeBar) {
          m.organized = true;
          if (!hasExplicitBeachBarAmenityInList(am)) addAmenities(m, ['beach bar']);
          const why = barSand ? `bar POI on the sand: "${barSand.name || '(unnamed)'}" (${barSand.primaryType}, ${barSand.d}m)` : `the pin's own Google type is a bar at the beach`;
          appendNote(m, `Reverse amenity sweep ${STAMP} (no-API): organized flag corrected to true + beach bar added — ${why}.`);
          applied.push({ id: b.id, name, rule: 'R2-physical-bar', change: 'organized -> true; +beach bar' });
        }
        // R2r — OSM leisure=beach_resort on the sand → managed beach (sunbeds/umbrellas)
        else if (resortSand) {
          m.organized = true;
          if (!amenityTextIncludesAny(am, SUNBED_AMENITY_TERMS)) addAmenities(m, ['ξαπλώστρες, ομπρέλες εποχικά']);
          appendNote(m, `Reverse amenity sweep ${STAMP} (no-API): organized flag corrected to true + sunbeds added — OSM beach_resort "${resortSand.name || '(unnamed)'}" ${resortSand.d}m from the pin.`);
          applied.push({ id: b.id, name, rule: 'R2r-beach-resort', change: 'organized -> true; +sunbeds' });
        }
        // R3 — municipal/developed beach (Google public_bath)
        else if (own === 'public_bath') {
          m.organized = true;
          appendNote(m, `Reverse amenity sweep ${STAMP} (no-API): organized flag corrected to true — Google classifies this pin as a public_bath (developed/paid beach).`);
          applied.push({ id: b.id, name, rule: 'R3-municipal', change: 'organized -> true' });
        }
        // Only a nameless OSM bar node nearby → not enough to auto-claim a beach bar. Review.
        else if (unnamedBar) {
          review.push({ id: b.id, name, regionId: (b.regionId || ''), detail: `nameless OSM ${unnamedBar.primaryType} ${unnamedBar.d}m from pin — possible beach bar, needs eyeball before claiming` });
        }
      }
    }
  }
  for (const v of Object.values(node)) walk(v);
};
walk(data);

// report
const byRule = applied.reduce((a, r) => ((a[r.rule] = (a[r.rule] || 0) + 1), a), {});
console.log(`\napplyAmenityFixes — ${write ? 'WRITE' : 'DRY-RUN'} — ${applied.length} beaches`);
console.log('by rule:', JSON.stringify(byRule));
for (const r of applied) console.log(`  [${r.rule}] #${r.id} ${r.name}  — ${r.change}`);

if (conflicts.length) {
  console.log(`\nCONFLICTS held for review (physical evidence vs "no facilities" claim): ${conflicts.length}`);
  for (const c of conflicts) console.log(`  #${c.id} ${c.name} [${c.regionId}] — ${c.detail}`);
  writeFileSync(path.join(rootDir, 'reports', 'amenity-evidence', `apply-conflicts-${STAMP}.json`), JSON.stringify(conflicts, null, 2), 'utf8');
}
if (review.length) {
  console.log(`\nREVIEW (weaker single signals, NOT auto-applied): ${review.length}`);
  for (const r of review) console.log(`  #${r.id} ${r.name} [${r.regionId}] — ${r.detail}`);
  writeFileSync(path.join(rootDir, 'reports', 'amenity-evidence', `apply-review-${STAMP}.json`), JSON.stringify(review, null, 2), 'utf8');
}

if (write) {
  writeFileSync(sourcePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${path.relative(rootDir, sourcePath)} (${applied.length} beaches changed). Run: npm run build:beach-data`);
} else {
  console.log('\nDry-run only. Re-run with --write to persist.');
}
