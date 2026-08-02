// Insert the human/AI-verified OSM coverage-gap beaches into the dataset, at their OWN
// OpenStreetMap coordinates — no geocoding.
//
//   node scripts/insertOsmGapBeaches.mjs plan     # offline: classify alias|insert|skip
//   node scripts/insertOsmGapBeaches.mjs apply     # write aliases + insert new records
//
// Input:  scripts/data/osm-gap-verified.json   (verified add-list from the national gap
//         report + adversarial web verification; each row carries lat/lon + region + OSM url)
// Target: public/greek_beaches.json
//
// A verified row is:
//   - ALIAS  if an existing beach sits within 150 m (any name) OR a name-similar beach within
//            600 m -> add the OSM name as metadata.aliases (never a duplicate). These were all
//            classified >1500 m from any existing beach, so this is a safety net only.
//   - INSERT otherwise -> new record at the OSM coords, slot via nearest beach in-region.
//   - SKIP   if region slot can't be resolved -> reported, never guessed.
//
// Every inserted beach is confidence:low + needsVerification:true + batch tag + OSM source url
// and routes by coordinates (conservative). Run audit:place-resolution + fetchBeachPopularity
// afterwards to upgrade Google identity / crowd badge. Then build:beach-data -> geospatial
// exposure rebuild -> quality:critical.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seedArg = process.argv.find((a) => a.startsWith('--seed='));
const SEED = seedArg ? path.resolve(rootDir, seedArg.slice('--seed='.length)) : path.join(rootDir, 'scripts', 'data', 'osm-gap-verified.json');
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');
const PLAN_OUT = path.join(rootDir, 'reports', 'coverage', 'osm-gap-insert-plan.json');

const NEW_BEACH_MIN_ID = 3000;
// Overridable so a later sweep does not stamp its beaches with an earlier sweep's date and
// batch tag — the tag is what scopes enrichOsmGapBeaches and any later audit to one decision.
const batchArg = process.argv.find((a) => a.startsWith('--batch='));
const checkedAtArg = process.argv.find((a) => a.startsWith('--checked-at='));
const BATCH = batchArg ? batchArg.slice('--batch='.length) : 'osm_coverage_gap_2026_06';
const CHECKED_AT = checkedAtArg ? checkedAtArg.slice('--checked-at='.length) : '2026-06-26';
const DUP_RADIUS_M = 150;          // pure geographic dup (any name)
const NAME_DUP_RADIUS_M = 600;     // same beach, slightly different name -> alias, don't duplicate
const NAME_DUP_DICE = 55;          // core-name similarity threshold for the wider radius

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

const classify = (data) => {
  const seed = loadJson(SEED).beaches;
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
      // Prefer the seed's explicit region/prefecture/municipality slot when it exists in the
      // dataset (faithful to the verified placement, and avoids a nearest-neighbour pick jumping
      // across a gulf to the wrong municipality). Fall back to nearest-in-region otherwise.
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

const buildRecord = (row, id, slot) => {
  const g = row.google;
  const googleNote = g && g.ratingCount ? ` Google confirms a ${g.primaryType || 'place'} (${g.ratingCount} ratings) ${g.distM}m from the pin.` : '';
  return {
    id,
    name: row.nameGr,
    lat: row.lat,
    lon: row.lon,
    metadata: {
      access: { type: 'unknown', label: 'Άγνωστη πρόσβαση', notes: 'From OpenStreetMap; access not field-verified.' },
      terrain: { types: [], label: '—' },
      organized: false,
      shade: false,
      amenities: [],
      confidence: 'low',
      language: 'el',
      batch: BATCH,
      needsVerification: true,
      sourceNotes: [
        `OSM coverage-gap import (2026-06): created from OpenStreetMap beach "${row.nameGr}" (${row.osmUrl}) in ${row.municipality || '—'}, ${row.region}. Coordinates from OSM. Verified as a real, distinct Greek swimmable beach by adversarial web check (>${row.nearestOursM ?? '1500'}m from any existing beach).${googleNote} Slot via nearest existing beach #${slot.neighborId} (${slot.neighborDistanceM}m). Access/terrain unknown — needs field verification.`,
      ],
      sourceUrls: [row.osmUrl],
      googleMapsNavigation: { status: 'verified', mode: 'coordinates', checkedAt: CHECKED_AT, method: 'osm-coverage-gap-v1' },
    },
  };
};

const runPlan = () => {
  const data = loadJson(DATA);
  const { aliases, inserts, skips } = classify(data);
  writeFileSync(PLAN_OUT, JSON.stringify({
    _meta: { generatedAt: new Date().toISOString(), aliases: aliases.length, inserts: inserts.length, skips: skips.length },
    aliases,
    inserts: inserts.map((i) => ({ name: i.row.nameGr, region: i.slot.region, municipality: i.row.municipality, lat: i.row.lat, lon: i.row.lon, neighbor: `#${i.slot.neighborId} ${i.slot.neighborName} (${i.slot.neighborDistanceM}m)`, osm: i.row.osmUrl })),
    skips,
  }, null, 2) + '\n', 'utf8');
  console.log(`alias ${aliases.length} | insert ${inserts.length} | skip ${skips.length}`);
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
else { console.error('Usage: node scripts/insertOsmGapBeaches.mjs <plan|apply>'); process.exit(1); }
