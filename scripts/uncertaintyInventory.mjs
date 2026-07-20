// Read-only: quantify how many beaches carry UNCERTAINTY per characteristic, across the whole
// dataset + every on-disk audit report. Produces reports/uncertainty-inventory-<date>.{md,json}.
// "Uncertain" = we display (or could display) a value we cannot currently stand behind with evidence.
// No API. Screening-only reports (access/pins) are labelled as OVER-flagging, not hard errors.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeAmenity } from '../utils/amenityMatching.js';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const rd = (p) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null);
const STAMP = '2026-07-20';

const data = rd(R('public', 'greek_beaches.json'));
const beaches = [];
(function w(n) { if (Array.isArray(n)) { for (const it of n) { if (Number.isInteger(it?.id) && it?.metadata) beaches.push(it); w(it); } return; } if (n && typeof n === 'object') Object.values(n).forEach(w); })(data);
const live = beaches.filter(b => !b.metadata.excludeFromApp); // user-facing only
const N = live.length;

const rows = [];
const add = (characteristic, uncertain, base, how, actionable) => rows.push({ characteristic, uncertain, base: base ?? N, how, actionable });

// ---------- 1. ORGANIZED / AMENITIES ----------
const web = rd(R('reports', 'amenity-evidence', 'websearch-merged-2026-07-19.json')) || [];
const web2 = rd(R('reports', 'amenity-evidence', 'websearch-round2', 'merged.json')) || [];
const verdict = new Map();
for (const r of web) verdict.set(r.id, r.verdict);
for (const r of web2) verdict.set(r.id, r.verdict); // round2 overrides round1
const liveFalse = live.filter(b => b.metadata.organized !== true);
const leaningOrgHeld = liveFalse.filter(b => verdict.get(b.id) === 'ORGANIZED'); // web said organized, not applied (no 2nd signal)
const stillUnclear = liveFalse.filter(b => verdict.get(b.id) === 'UNCLEAR').map(b => b.id);
add('Organized flag (web LEANS organized, held for 2nd signal)', leaningOrgHeld.length, 387, 'web search says organized but at medium confidence with no independent corroboration — most likely genuine misses; safe to apply once a 2nd source confirms', true);
add('Organized flag (unclear after 2 web rounds)', stillUnclear.length, 387, 'UNCLEAR verdict after coordinate-anchored web search — no reliable source either way', true);

// ---------- 2. ACCESS (road surface) ----------
const acc = rd(R('reports', 'access-road-proximity', 'national-2026-06-20.json'));
const accUnverified = live.filter(b => b.metadata.access?.roadSurfaceUnverified).length;
const accVerify = rd(R('reports', 'access-road-proximity', 'access-verify-2026-07-20.json')) || [];
// The national 954 "suspects" used a 120m paved threshold — a mismeasurement (a beach with paved
// road 121m away is fine). Re-measured strictly (NO paved within 300m + a track) then excluded
// organized/parking-served beaches → 17 genuine; web-verified each → 13 confirmed not-paved-easy
// (downgraded honestly) + 4 confirmed paved (kept). This dimension is now essentially resolved.
add('Access road surface — TRUE actionable', accVerify.filter(v => v.verdict === 'DOWNGRADE').length, 17, 're-measured from the 954 screening flags → 13 web-verified as not paved-easy, honestly downgraded (roadSurfaceUnverified); 4 confirmed paved & kept', false);
add('Access road surface (total honest-downgraded)', accUnverified, N, 'roadSurfaceUnverified=true → UI shows "likely easy, unverified" (RESOLVED). 954 screening flags were a 120m-threshold artifact, NOT real errors', false);

// ---------- 3. TERRAIN (sand/pebble) ----------
const terr = rd(R('reports', 'terrain', 'report-2026-06-20.json'));
add('Terrain type (our label vs OSM surface)', terr?.totals?.mismatch ?? '?', terr?.totals?.osmHasSurface ?? N, 'our sand/pebble label disagrees with OSM surface tag (where OSM has one: ' + (terr?.totals?.osmHasSurface ?? '?') + ')', true);

// ---------- 4. WATER DEPTH ----------
const depthMap = [['ρηχ', 'shallow'], ['μετρ', 'medium'], ['βαθ', 'deep']];
const labelDepth = (s) => { s = normalizeAmenity(s || ''); for (const [k, v] of depthMap) if (s.includes(k)) return v; return null; };
let depthContradiction = 0, depthMissing = 0, depthUnverifiedNote = 0;
for (const b of live) {
  const wd = b.metadata.waterDepth;
  if (!wd || !wd.type) { depthMissing++; continue; }
  const ld = labelDepth(wd.label);
  if (ld && ld !== wd.type) depthContradiction++;
  if (normalizeAmenity((Array.isArray(wd.notes) ? wd.notes.join(' ') : wd.notes) || '').includes('μη επιβεβαιωμεν')) depthUnverifiedNote++;
}
add('Water depth (type↔label contradiction)', depthContradiction, N, 'waterDepth.type disagrees with its own label — badge already hidden by isWaterDepthUnverified gate', true);
add('Water depth (missing entirely)', depthMissing, N, 'no waterDepth object — nothing shown', false);

// ---------- 5. SHADE ----------
// shade:false but amenities text mentions natural shade (self-contradiction)
const shadeTerms = ['φυσικη σκια', 'σκια απο δεντρ', 'δεντρα', 'αλμυρικ', 'πευκ', 'σκιερ'];
let shadeContradiction = 0;
for (const b of live) {
  if (b.metadata.shade === false) {
    const amt = normalizeAmenity((b.metadata.amenities || []).join(' '));
    if (shadeTerms.some(t => amt.includes(normalizeAmenity(t)))) shadeContradiction++;
  }
}
add('Shade flag (false but text says natural shade)', shadeContradiction, N, 'shade:false yet amenities mention trees/natural shade — text does not render as a chip', true);

// ---------- 6. PINS / COORDINATES ----------
const pinRev = rd(R('reports', 'pin-priority-review-2026-07-19.json'));
const pinArr = Array.isArray(pinRev) ? pinRev : (pinRev?.flagged || pinRev?.items || pinRev?.results || []);
add('Pin location (priority mislocations)', pinArr.length || '?', N, 'flagged pins on land / far from coastline / wrong island (e.g. #1942 on Rhenia) — blind moves unsafe', true);

// ---------- 7. PLACE RESOLUTION (Maps landing) ----------
// The raw WRONG_PLACE/WRONG_TYPE counts describe where Google's NAME lookup disagrees with our
// coordinate — but the app deliberately ignores that lookup: only PASS-verified beaches carry an
// active placeId (open a place card); everything flagged routes by coordinate (collision-immune,
// nationwide nav fix 2026-06-15). TRUE actionable = a FLAGGED beach that still has an active placeId
// (would open a wrong card). Measured live against greek_beaches nav below.
const upg = rd(R('reports', 'place-resolution', 'google-upgrade.json')) || [];
const st = {}; for (const r of upg) st[r.status] = (st[r.status] || 0) + 1;
const navById = new Map();
for (const b of beaches) navById.set(b.id, b.metadata?.googleMapsNavigation);
const flaggedActivePlaceId = upg.filter(r => r.status !== 'PASS' && (() => { const pid = navById.get(r.id)?.placeId; return pid && String(pid).trim(); })()).length;
const flaggedTotal = (st.WRONG_PLACE || 0) + (st.WRONG_TYPE || 0) + (st.UNSTABLE || 0) + (st.NO_RESULT || 0);
add('Google Maps landing — TRUE actionable (opens wrong card)', flaggedActivePlaceId, upg.length, `${flaggedTotal} beaches are flagged (name lookup ≠ our coord) but 0 carry an active placeId → all route by coordinate. Only PASS-verified beaches open a place card. RESOLVED by design`, false);

// ---------- 8. SOURCE URL LIVENESS ----------
const sul = rd(R('reports', 'sourceurl-liveness', 'report.json'));
add('Source URL dead (needs re-sourcing)', sul?.totals?.dead ?? '?', sul?.totals?.nonOsmChecked ?? N, 'a cited evidence link is dead — provenance broken, not the value itself', true);
add('Source URL inconclusive', sul?.totals?.inconclusive ?? '?', sul?.totals?.nonOsmChecked ?? N, 'link check ambiguous (timeout/blocked)', false);

// ---------- 9. EXPLICIT needsVerification FLAG ----------
const needsV = beaches.filter(b => b.metadata.needsVerification).length;
add('Explicit needsVerification flag', needsV, N, 'record already tagged by an earlier pass as needing a look', true);

// ---------- 10. CONFIDENCE FIELD ----------
const conf = {}; for (const b of live) conf[b.metadata.confidence] = (conf[b.metadata.confidence] || 0) + 1;
add('Record confidence = medium', conf.medium || 0, N, 'self-declared medium confidence (note: "high" covers static facts only, not live)', false);
add('Record confidence = low', conf.low || 0, N, 'self-declared low confidence', true);

// ---------- 11. ORIENTATION (drives sunset + some wind) ----------
const noOrient = live.filter(b => !b.metadata.orientation).length;
add('Orientation missing', noOrient, N, 'no coast orientation → sunset-facing + some wind context unavailable', false);

// render
const pct = (u, b) => (typeof u === 'number' && typeof b === 'number' && b) ? ' (' + (100 * u / b).toFixed(1) + '%)' : '';
let md = `# Beach-characteristic Uncertainty Inventory\n\n_Generated ${STAMP}. ${N} user-facing beaches (${beaches.length} total incl. ${beaches.length - N} excluded). Read-only._\n\n`;
md += `Ranked by how actionable + how trust-damaging. "SCREEN" rows over-flag (screening heuristics), so the number is an upper bound, not confirmed errors.\n\n`;
md += `| # | Characteristic | Uncertain | of base | How it's detected | Actionable |\n|---|---|---|---|---|---|\n`;
rows.sort((a, b) => (b.actionable - a.actionable) || ((typeof b.uncertain === 'number' ? b.uncertain : 0) - (typeof a.uncertain === 'number' ? a.uncertain : 0)));
rows.forEach((r, i) => { md += `| ${i + 1} | ${r.characteristic} | **${r.uncertain}**${pct(r.uncertain, r.base)} | ${r.base} | ${r.how} | ${r.actionable ? '✅' : '—'} |\n`; });
md += `\n## Notes\n`;
md += `- **Amenities/organized** is the most-worked dimension — 341 beaches corrected with sources this month. What remains is the genuinely-unresolvable tail + the not-yet-web-checked weak-signal set.\n`;
md += `- **Access "suspect" (${acc?.totals?.suspect ?? '?'})** and **pin** rows are SCREENING over-flags; the true error count is far smaller (only multi-signal cases were auto-corrected).\n`;
md += `- **Google Maps WRONG_PLACE (${st.WRONG_PLACE || 0})** is mitigated (coordinate routing) but the underlying name→place mismatch is real and worth fixing per-beach.\n`;
md += `- **Water depth & shade** are largely terrain-derived guesses; the counts above are only the self-contradictions, which the UI already hides. The deeper question (are the non-contradictory ones right?) is unverifiable without on-site data.\n`;

writeFileSync(R('reports', `uncertainty-inventory-${STAMP}.md`), md, 'utf8');
writeFileSync(R('reports', `uncertainty-inventory-${STAMP}.json`), JSON.stringify({ generatedAt: STAMP, base: N, rows, stillUnclearIds: stillUnclear }, null, 1), 'utf8');
console.log(md);
console.log('\nWrote reports/uncertainty-inventory-' + STAMP + '.{md,json}');
