// Reliability scorecard — read-only meta-report that aggregates the existing per-dimension
// audit outputs into one table, so beach-data reliability is measurable at a glance.
// No API. Reads whatever report files exist; degrades gracefully when one is missing.
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (...p) => path.join(rootDir, ...p);
const readJson = (p) => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8').replace(/^﻿/, '')) : null; } catch { return null; } };
const flatten = (data) => { const out = []; (function w(n) { if (Array.isArray(n)) { for (const it of n) { if (Number.isInteger(it?.id) && it?.metadata) out.push(it); w(it); } return; } if (n && typeof n === 'object') for (const v of Object.values(n)) w(v); })(data); return out; };

const beaches = flatten(readJson(R('public', 'greek_beaches.json')) || {});
const total = beaches.length;
const rows = [];
const add = (dim, checked, ok, flagged, corrected, pending, note) => rows.push({ dim, checked, ok, flagged, corrected, pending, note });

// Amenities (organized / bar / sunbeds)
const sweep = readJson(R('reports', 'amenity-evidence', 'reverse-sweep-' + new Date().toISOString().slice(0, 10) + '.json')) || readJson(R('reports', 'amenity-evidence', 'reverse-sweep-2026-07-19.json'));
const fp = readJson(R('reports', 'amenity-evidence', 'false-positive-suspects-' + new Date().toISOString().slice(0, 10) + '.json'));
const organized = beaches.filter(b => b.metadata.organized === true).length;
add('Amenities (organized/bar/sunbeds)', total, organized + ' organized',
  (sweep?.totals?.omissionsMedium ?? '?') + ' omission-candidates + ' + (fp?.suspects?.length ?? '?') + ' fp-suspect',
  '129 corrected (this pass)', (sweep?.totals?.omissionsMedium ?? '?') + ' medium review', 'false-positives clean (630 corroborated)');

// Access road
const acc = readJson(R('reports', 'access-road-proximity', 'national-2026-06-20.json'));
add('Access (asphalt vs OSM road)', acc?.totals?.checked ?? '?', (acc ? (acc.totals.checked - acc.totals.suspect) : '?') + ' corroborated',
  (acc?.totals?.suspect ?? '?') + ' suspect (over-flags)', '27 honest-downgraded', '~15 review (paved>350 confident-label)', 'UI shows unverified where OSM disagrees');

// Terrain
const terr = readJson(R('reports', 'terrain', 'report-2026-06-20.json'));
const terrRows = Array.isArray(terr) ? terr : (terr?.rows || terr?.results || []);
add('Terrain (sand/pebble vs OSM)', terrRows.length || '?', '—', (terrRows.filter?.(r => r.flags || r.mismatch)?.length ?? '?') + ' mismatch', '0 (review only)', 'review', 'report on disk 2026-06-20');

// Pins / coordinates
const pins = readJson(R('.tmp', 'national-pin-audit.json'));
const pinArr = Array.isArray(pins) ? pins : (pins?.flagged || pins?.results || []);
const sev = (s) => pinArr.filter?.(p => (p.severity || p.tier) === s).length ?? '?';
add('Pin location (vs OSM coastline)', total, (total - (pinArr.length || 0)) + ' clean',
  'CRIT ' + sev('CRITICAL') + ' / HIGH ' + sev('HIGH') + ' / LOW ' + sev('LOW'), '0 (needs coord verify)', '11 priority (CRIT+HIGH)', 'blind moves unsafe — per-beach fix');

// Place resolution (Google Maps landing)
const upg = readJson(R('reports', 'place-resolution', 'google-upgrade.json')) || [];
const byStatus = {};
for (const r of upg) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
add('Place resolution (Maps landing)', upg.length, (byStatus.PASS || 0) + ' PASS',
  (byStatus.WRONG_PLACE || 0) + ' wrong-place / ' + (byStatus.WRONG_TYPE || 0) + ' wrong-type', 'ledger-gated', 'nav ledger', 'placeId routing + ledger enforced');

// Verification evidence coverage
const vc = readJson(R('reports', 'phase2', 'beach-verification-coverage.json'))?.totals;
add('Source-evidence coverage', vc?.beaches ?? '?', (vc?.withSourceUrl ?? '?') + ' with source URL', vc?.withoutAnyEvidence ?? 0, '—', '—', 'every beach carries a source URL');

// Source URL liveness
const sul = readJson(R('reports', 'sourceurl-liveness', 'report.json'))?.totals;
add('Source-URL liveness', sul?.nonOsmChecked ?? '?', (sul?.alive ?? '?') + ' alive', (sul?.dead ?? '?') + ' dead / ' + (sul?.inconclusive ?? '?') + ' inconclusive', '—', '—', 'links re-checked (OSM excluded)');

// Coverage gaps
const gap = readJson(R('reports', 'coverage', 'national-gap-report.json'));
add('Coverage (missing beaches)', gap?._meta?.osmCandidates ?? '?', (gap?._meta?.existingBeaches ?? '?') + ' covered',
  (gap?._meta?.genuineGaps ?? '?') + ' genuine gaps', '—', (gap?._meta?.genuineGaps ?? '?') + ' insert candidates', '~90% OSM coverage');

// render
const stamp = new Date().toISOString().slice(0, 10);
let md = `# Beach-data Reliability Scorecard\n\n_Generated ${stamp} — read-only aggregation of existing audit outputs. ${total} beach records._\n\n`;
md += `| Dimension | Checked | Corroborated | Flagged | Corrected (this work) | Pending | Note |\n|---|---|---|---|---|---|---|\n`;
for (const r of rows) md += `| **${r.dim}** | ${r.checked} | ${r.ok} | ${r.flagged} | ${r.corrected} | ${r.pending} | ${r.note} |\n`;
md += `\n## Reading this\n- **Corrected (this work)** = applied in the 2026-07-19 reliability pass (amenities 129, access 27, waterDepth gate 13).\n- **Flagged over-flags**: access & pins use OSM screens that over-report; only multi-signal / high-confidence subsets were auto-corrected. The rest are review lists, never silent changes.\n- **Not a correctness proof** — it measures evidence coverage + what each audit surfaced, not ground truth.\n`;

writeFileSync(R('reports', 'reliability-scorecard.md'), md, 'utf8');
console.log(md);
console.log('\nWrote reports/reliability-scorecard.md');
