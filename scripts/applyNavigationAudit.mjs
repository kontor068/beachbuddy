// Applies a navigation-grade audit (OSM polygon/access check) to public/greek_beaches.json.
// Region-agnostic: driven entirely by audit rows keyed by stable beach id — works for any
// region/group audit file with the cyclades-nav-audit.json row shape (national rollout tooling).
//
// Usage:
//   node scripts/applyNavigationAudit.mjs --audit <audit.json> --apply-moves <id,id,... | all>
//   node scripts/applyNavigationAudit.mjs --audit <audit.json> --apply-status [--overrides <file>] [--checked-at YYYY-MM-DD]
//   Add --dry-run to either mode to report without writing.
//
// --apply-moves: moves approved pins to the same-name OSM feature centroid (row.sameNameMiss)
//   with a dated provenance sourceNote. Only coordinates + sourceNotes change.
// --apply-status: writes metadata.googleMapsNavigation = { status, mode, checkedAt, method,
//   reason? } for every audit row whose source entry carries builder-valid metadata (the
//   builder drops invalid metadata, so the field would not ship otherwise — reported, not faked).
//   --overrides maps id -> { status?, mode?, reason? } for human-adjudicated exceptions.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const auditPath = getArg('--audit');
const movesArg = getArg('--apply-moves');
const applyStatus = args.includes('--apply-status');
const overridesPath = getArg('--overrides');
const checkedAt = getArg('--checked-at') || new Date().toISOString().slice(0, 10);
const dryRun = args.includes('--dry-run');
if (!auditPath || (!movesArg && !applyStatus)) {
  console.error('usage: --audit <file> with --apply-moves <ids|all> or --apply-status [--overrides <file>]');
  process.exit(1);
}

const rows = JSON.parse(readFileSync(auditPath, 'utf8'));
const overrides = overridesPath ? JSON.parse(readFileSync(overridesPath, 'utf8')) : {};
const sourcePath = 'public/greek_beaches.json';
const source = JSON.parse(readFileSync(sourcePath, 'utf8'));

// Same traversal as scripts/buildBeachRegionData.mjs parseBeachPayload, so ids map 1:1.
let idCounter = 0;
const byId = new Map();
const walk = (node) => {
  if (Array.isArray(node)) {
    for (const item of node) {
      const lat = typeof item?.lat === 'number' ? item.lat : Number(item?.lat);
      const lon = typeof item?.lon === 'number' ? item.lon : Number(item?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      byId.set(idCounter++, item);
    }
    return;
  }
  if (!node || typeof node !== 'object') return;
  for (const value of Object.values(node)) walk(value);
};
for (const value of Object.values(source)) walk(value);
console.log(`source ids: ${idCounter}`);

// The builder requires access/terrain/organized/shade/amenities for metadata to ship.
const hasValidMetadata = (m) => Boolean(
  m && typeof m === 'object' &&
  m.access && typeof m.access.type === 'string' && typeof m.access.label === 'string' && typeof m.access.notes === 'string' &&
  m.terrain && Array.isArray(m.terrain.types) && typeof m.terrain.label === 'string' &&
  typeof m.organized === 'boolean' && typeof m.shade === 'boolean' && Array.isArray(m.amenities)
);

// sourceNotes appears both as string and as array in the dataset — normalize.
const appendNote = (metadata, note) => {
  const existing = metadata.sourceNotes;
  const list = Array.isArray(existing) ? existing : (typeof existing === 'string' && existing ? [existing] : []);
  metadata.sourceNotes = [...list, note];
};

// Same greek->latin normalization as the audit scripts; source names are Greek, audit names English.
const digraphs = [['ου', 'ou'], ['αι', 'ai'], ['ει', 'ei'], ['οι', 'oi'], ['αυ', 'av'], ['ευ', 'ev'], ['μπ', 'b'], ['ντ', 'd'], ['γκ', 'g'], ['γγ', 'g'], ['τσ', 'ts'], ['τζ', 'tz']];
const greekMap = { 'α': 'a', 'β': 'v', 'γ': 'g', 'δ': 'd', 'ε': 'e', 'ζ': 'z', 'η': 'i', 'θ': 'th', 'ι': 'i', 'κ': 'k', 'λ': 'l', 'μ': 'm', 'ν': 'n', 'ξ': 'x', 'ο': 'o', 'π': 'p', 'ρ': 'r', 'σ': 's', 'ς': 's', 'τ': 't', 'υ': 'y', 'φ': 'f', 'χ': 'ch', 'ψ': 'ps', 'ω': 'o' };
const normalizeName = (v) => {
  let s = String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const [g, l] of digraphs) s = s.split(g).join(l);
  s = [...s].map(c => greekMap[c] ?? c).join('');
  return s.replace(/\b(paralia|beach|akti|ammos|ormos)\b/g, '').replace(/[^a-z0-9]/g, '');
};
const nameMatches = (entry, row) => {
  const a = normalizeName(entry.name);
  const b = normalizeName(row.name);
  return a === b || (a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a)));
};
// Primary identity guard: the audit row carries the app-data coordinates, which come from this
// same source file — they must match the entry exactly (pre-move). Name match is the fallback
// for transliteration variants (e.g. ντ -> "d" vs English "nt").
const rowMatches = (entry, row) => (
  (Number.isFinite(row.lat) && Math.abs(entry.lat - row.lat) < 2e-5 && Math.abs(entry.lon - row.lon) < 2e-5) ||
  nameMatches(entry, row)
);

let changed = false;

if (movesArg) {
  const wanted = movesArg === 'all' ? null : new Set(movesArg.split(',').map(Number));
  const targets = rows.filter(r => r.sameNameMiss && (!wanted || wanted.has(r.id)));
  let moved = 0; const problems = [];
  for (const r of targets) {
    const entry = byId.get(r.id);
    if (!entry) { problems.push(`#${r.id} not found in source`); continue; }
    if (!rowMatches(entry, r)) { problems.push(`#${r.id} name mismatch: source "${entry.name}" vs audit "${r.name}"`); continue; }
    const { lat, lon } = r.sameNameMiss.centroid;
    console.log(`move #${r.id} "${entry.name}" (${entry.lat},${entry.lon}) -> (${lat.toFixed(6)},${lon.toFixed(6)}) [${r.sameNameMiss.osm} "${r.sameNameMiss.name}", ${r.sameNameMiss.d}m]`);
    if (dryRun) continue;
    const note = `Navigation audit ${checkedAt} (batch-approved): pin moved ${r.sameNameMiss.d} m onto the same-name OSM beach feature (https://www.openstreetmap.org/${r.sameNameMiss.osm}, "${r.sameNameMiss.name}", OSM data 2026-06-11) because the previous pin sat outside the mapped beach polygon. Previous pin: ${entry.lat},${entry.lon}. Only coordinates changed; windProfile, amenities and claims untouched.`;
    entry.lat = Number(lat.toFixed(6));
    entry.lon = Number(lon.toFixed(6));
    if (hasValidMetadata(entry.metadata)) appendNote(entry.metadata, note);
    else problems.push(`#${r.id} moved but has no valid metadata for a provenance note`);
    moved += 1; changed = true;
  }
  console.log(JSON.stringify({ requested: wanted ? wanted.size : targets.length, moved, problems }, null, 1));
}

if (applyStatus) {
  let written = 0; let overridden = 0; const noMetadata = []; const problems = [];
  for (const r of rows) {
    const entry = byId.get(r.id);
    if (!entry) { problems.push(`#${r.id} not found in source`); continue; }
    if (!rowMatches(entry, r)) { problems.push(`#${r.id} name mismatch: source "${entry.name}" vs audit "${r.name}"`); continue; }
    if (!hasValidMetadata(entry.metadata)) { noMetadata.push(`#${r.id} ${r.name}`); continue; }
    const o = overrides[String(r.id)] || {};
    if (overrides[String(r.id)]) overridden += 1;
    const status = o.status || r.status;
    const mode = o.mode || r.navMode;
    const reason = o.reason || (status !== 'verified' ? r.why : undefined);
    if (dryRun) { written += 1; continue; }
    entry.metadata.googleMapsNavigation = {
      status,
      mode,
      checkedAt,
      method: 'osm-nav-audit-v1',
      ...(reason ? { reason } : {}),
    };
    written += 1; changed = true;
  }
  const counts = {};
  for (const r of rows) {
    const s = (overrides[String(r.id)] || {}).status || r.status;
    counts[s] = (counts[s] || 0) + 1;
  }
  console.log(JSON.stringify({ statusWritten: written, overridden, statusCounts: counts, noMetadataCount: noMetadata.length, problems }, null, 1));
  if (noMetadata.length) console.log('no-metadata (status not shipped):\n  ' + noMetadata.join('\n  '));
}

if (changed && !dryRun) {
  writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
  console.log('written ' + sourcePath);
} else {
  console.log(dryRun ? 'dry-run: no write' : 'no changes');
}
