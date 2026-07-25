// Insert human/AI-VERIFIED "hidden" beaches discovered from NON-OSM sources (Greek beach
// guides, Wikipedia, topo directories) and cross-checked against OSM geometry. These are
// beaches OpenStreetMap does NOT tag as natural=beach (or tags only as an UNNAMED polygon),
// so the OSM coverage-gap pipeline (scripts/harvestBeachesOsm.mjs) can never surface them.
//
//   node scripts/insertDiscoveredBeaches.mjs plan  --seed=scripts/data/hidden-evia-verified.json
//   node scripts/insertDiscoveredBeaches.mjs apply --seed=scripts/data/hidden-evia-verified.json
//
// Seed row: { nameGr, aliases?, lat, lon, region, prefecture, municipality,
//             sourceUrls[], sourceNote?, coordSrc?, metadata?{access,terrain,organized,shade,amenities,activities} }
// Target:   public/greek_beaches.json
//
// Dedup/slot logic is IDENTICAL to scripts/insertOsmGapBeaches.mjs (≤150m any-name OR
// ≤600m + core-name Dice≥55 -> alias, never a duplicate; slot via explicit region path or
// nearest-in-region). Every insert is confidence:low + needsVerification:true + batch tag +
// real source URLs + coordinate routing. Access/terrain come from guide sources (conservative,
// NOT field-verified). Then: build:beach-data -> geospatial exposure rebuild -> quality gates.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedArg = process.argv.find((a) => a.startsWith('--seed='));
if (!seedArg) { console.error('Missing --seed=<path>'); process.exit(1); }
const SEED = path.resolve(rootDir, seedArg.slice('--seed='.length));
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');
const PLAN_OUT = path.join(rootDir, 'reports', 'coverage', 'discovered-insert-plan.json');

const NEW_BEACH_MIN_ID = 3000;
const CHECKED_AT = '2026-07-23';
const DUP_RADIUS_M = 150;
const NAME_DUP_RADIUS_M = 600;
const NAME_DUP_DICE = 55;

const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const GREEK_MAP = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o' };
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
const normKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const LOCALITY_WORDS = /\b(paralia|akti|beach|plaz)\b/g;
const coreKey = (v) => normKey(v).replace(LOCALITY_WORDS, ' ').replace(/\s+/g, ' ').trim();
const bigrams = (s) => { const t = s.replace(/\s/g, ''); const m = new Map(); for (let i = 0; i < t.length - 1; i += 1) { const g = t.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; };
const diceScore = (a, b) => { if (!a || !b) return 0; if (a === b) return 100; const A = bigrams(a), B = bigrams(b); let o = 0, sa = 0, sb = 0; for (const v of A.values()) sa += v; for (const v of B.values()) sb += v; for (const [g, n] of A) if (B.has(g)) o += Math.min(n, B.get(g)); return Math.round((200 * o) / (sa + sb)); };
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const toRadians = (d) => (d * Math.PI) / 180;
const distanceMeters = (a, b) => {
  if (!a || !b || ![a.lat, a.lon, b.lat, b.lon].every(Number.isFinite)) return undefined;
  const R = 6371000, dLat = toRadians(b.lat - a.lat), dLon = toRadians(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

function* iterBeaches(data) {
  for (const sub of Object.values(data))
    for (const subSub of Object.values(sub))
      for (const arr of Object.values(subSub))
        if (Array.isArray(arr)) for (const beach of arr) yield beach;
}
const buildIndex = (data) => {
  const pts = [];
  for (const [region, sub] of Object.entries(data))
    for (const [subName, subSub] of Object.entries(sub))
      for (const [subSubName, arr] of Object.entries(subSub))
        if (Array.isArray(arr)) for (const b of arr)
          if (Number.isFinite(b.lat) && Number.isFinite(b.lon))
            pts.push({ lat: b.lat, lon: b.lon, region, subName, subSubName, id: b.id, name: b.name, ref: b });
  return pts;
};
const nearest = (index, coord) => {
  let best = null;
  for (const p of index) { const d = distanceMeters(coord, p); if (d !== undefined && (!best || d < best.d)) best = { d, p }; }
  return best;
};
const nearestInRegion = (index, region, coord) => {
  let best = null;
  for (const p of index) { if (p.region !== region) continue; const d = distanceMeters(coord, p); if (d !== undefined && (!best || d < best.d)) best = { d, p }; }
  return best;
};

const seedRoot = loadJson(SEED);
const BATCH = batchArg ? batchArg.slice('--batch='.length) : (seedRoot.batch || 'hidden_beach_discovery_2026_07');

const classify = (data) => {
  const seed = seedRoot.beaches;
  const index = buildIndex(data);
  const aliases = [], inserts = [], skips = [];
  for (const row of seed) {
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) { skips.push({ name: row.nameGr, why: 'no coords' }); continue; }
    const coord = { lat: row.lat, lon: row.lon };
    const near = nearest(index, coord);
    let nameMatch = null;
    for (const p of index) {
      const d = distanceMeters(coord, p);
      if (d === undefined || d > NAME_DUP_RADIUS_M) continue;
      const sc = diceScore(coreKey(row.nameGr), coreKey(p.name));
      if (sc >= NAME_DUP_DICE && (!nameMatch || sc > nameMatch.sc)) nameMatch = { sc, d, p };
    }
    const aliasTarget = (near && near.d <= DUP_RADIUS_M) ? { p: near.p, d: near.d }
      : (nameMatch ? { p: nameMatch.p, d: nameMatch.d } : null);
    if (aliasTarget) {
      aliases.push({ seedName: row.nameGr, targetId: aliasTarget.p.id, targetName: aliasTarget.p.name, distanceM: Math.round(aliasTarget.d) });
    } else {
      const explicitArr = data?.[row.region]?.[row.prefecture]?.[row.municipality];
      const regionNear = nearestInRegion(index, row.region, coord);
      if (Array.isArray(explicitArr)) {
        inserts.push({ row, slot: { region: row.region, sub: row.prefecture, subSub: row.municipality, neighborId: regionNear?.p.id ?? null, neighborName: regionNear?.p.name ?? '—', neighborDistanceM: regionNear ? Math.round(regionNear.d) : null } });
      } else if (regionNear) {
        inserts.push({ row, slot: { region: row.region, sub: regionNear.p.subName, subSub: regionNear.p.subSubName, neighborId: regionNear.p.id, neighborName: regionNear.p.name, neighborDistanceM: Math.round(regionNear.d) } });
      } else {
        skips.push({ name: row.nameGr, why: `no slot for ${row.region}/${row.prefecture}/${row.municipality}` });
      }
    }
  }
  return { aliases, inserts, skips };
};

const DEFAULT_ACCESS = { type: 'unknown', label: 'Άγνωστη πρόσβαση', notes: 'Πρόσβαση χωρίς επιτόπου επιβεβαίωση.' };
const buildRecord = (row, id, slot) => {
  const m = row.metadata || {};
  const access = m.access || DEFAULT_ACCESS;
  const terrain = m.terrain || { types: [], label: '—' };
  const note = `Hidden-beach discovery (2026-07): ${row.sourceNote || `Άγρια/απομονωμένη παραλία «${row.nameGr}» εντοπισμένη από τοπικούς οδηγούς και σταυρο-ελεγμένη με γεωμετρία OSM.`} Συντεταγμένες: ${row.coordSrc || 'από σταυρο-ελεγμένες πηγές'}. Slot κοντά στο #${slot.neighborId} (${slot.neighborName}, ${slot.neighborDistanceM}m). Πρόσβαση/χαρακτηριστικά από οδηγούς — ΔΕΝ έχουν επιβεβαιωθεί επιτόπου.`;
  return {
    id,
    name: row.nameGr,
    lat: row.lat,
    lon: row.lon,
    metadata: {
      access: { type: access.type, label: access.label, notes: access.notes },
      terrain: { types: terrain.types, label: terrain.label },
      organized: typeof m.organized === 'boolean' ? m.organized : false,
      shade: typeof m.shade === 'boolean' ? m.shade : false,
      amenities: Array.isArray(m.amenities) ? m.amenities : [],
      confidence: 'low',
      language: 'el',
      batch: BATCH,
      needsVerification: true,
      activities: { surfing: m.activities && typeof m.activities.surfing === 'boolean' ? m.activities.surfing : false },
      ...(Array.isArray(row.aliases) && row.aliases.length ? { aliases: row.aliases } : {}),
      sourceUrls: Array.isArray(row.sourceUrls) ? row.sourceUrls : [],
      sourceNotes: [note],
      googleMapsNavigation: { status: 'verified', mode: 'coordinates', checkedAt: CHECKED_AT, method: 'guide-discovery-v1' },
    },
  };
};

const runPlan = () => {
  const data = loadJson(DATA);
  const { aliases, inserts, skips } = classify(data);
  writeFileSync(PLAN_OUT, JSON.stringify({
    _meta: { batch: BATCH, aliases: aliases.length, inserts: inserts.length, skips: skips.length },
    aliases,
    inserts: inserts.map((i) => ({ name: i.row.nameGr, region: i.slot.region, municipality: i.row.municipality, lat: i.row.lat, lon: i.row.lon, access: i.row.metadata?.access?.type || 'unknown', neighbor: `#${i.slot.neighborId} ${i.slot.neighborName} (${i.slot.neighborDistanceM}m)` })),
    skips,
  }, null, 2) + '\n', 'utf8');
  console.log(`batch ${BATCH} | alias ${aliases.length} | insert ${inserts.length} | skip ${skips.length}`);
  for (const i of inserts) console.log(`  INSERT ${i.row.nameGr} @${i.row.lat},${i.row.lon} -> ${i.slot.region}/${i.slot.sub}/${i.slot.subSub} (nearest #${i.slot.neighborId} ${i.slot.neighborName} ${i.slot.neighborDistanceM}m)`);
  for (const a of aliases) console.log(`  ALIAS  ${a.seedName} -> #${a.targetId} ${a.targetName} (${a.distanceM}m)`);
  for (const s of skips) console.log(`  SKIP   ${s.name}: ${s.why}`);
  console.log(`Wrote plan -> ${path.relative(rootDir, PLAN_OUT)}`);
};

const runApply = () => {
  const data = loadJson(DATA);
  const { aliases, inserts } = classify(data);

  const byId = new Map();
  for (const b of iterBeaches(data)) byId.set(b.id, b);
  let aliasCount = 0;
  for (const a of aliases) {
    const b = byId.get(a.targetId);
    if (!b) continue;
    if (!b.metadata) b.metadata = {};
    const list = Array.isArray(b.metadata.aliases) ? b.metadata.aliases : [];
    if (!list.includes(a.seedName)) { list.push(a.seedName); aliasCount += 1; }
    b.metadata.aliases = list;
  }

  let maxId = 0;
  for (const b of iterBeaches(data)) if (Number.isInteger(b.id) && b.id > maxId) maxId = b.id;
  let nextId = Math.max(NEW_BEACH_MIN_ID, maxId + 1);
  const index = buildIndex(data);
  let insertCount = 0; const skipped = [];
  inserts.sort((x, y) => x.row.region.localeCompare(y.row.region) || x.row.nameGr.localeCompare(y.row.nameGr));
  for (const ins of inserts) {
    const coord = { lat: ins.row.lat, lon: ins.row.lon };
    const dup = index.find((p) => normKey(p.name) === normKey(ins.row.nameGr) && (distanceMeters(coord, p) ?? Infinity) <= DUP_RADIUS_M);
    if (dup) { skipped.push({ name: ins.row.nameGr, why: `dup of #${dup.id}` }); continue; }
    const arr = data?.[ins.slot.region]?.[ins.slot.sub]?.[ins.slot.subSub];
    if (!Array.isArray(arr)) { skipped.push({ name: ins.row.nameGr, why: 'slot missing' }); continue; }
    const id = nextId++;
    const rec = buildRecord(ins.row, id, ins.slot);
    arr.push(rec);
    index.push({ lat: rec.lat, lon: rec.lon, region: ins.slot.region, subName: ins.slot.sub, subSubName: ins.slot.subSub, id, name: rec.name, ref: rec });
    insertCount += 1;
  }

  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Aliases added: ${aliasCount} | Inserted: ${insertCount} (ids ${insertCount ? `${nextId - insertCount}-${nextId - 1}` : 'none'}) | skipped: ${skipped.length}`);
  if (skipped.length) console.log(JSON.stringify(skipped, null, 2));
  console.log('Next: npm run build:beach-data -> geospatial exposure rebuild -> npm run quality:critical');
};

const mode = process.argv[2];
if (mode === 'plan') runPlan();
else if (mode === 'apply') runApply();
else { console.error('Usage: node scripts/insertDiscoveredBeaches.mjs <plan|apply> --seed=<path> [--batch=<tag>]'); process.exit(1); }
