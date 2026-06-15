// Insert the no-match Seatrac v2 beaches into the dataset using THEIR OWN seatrac.gr
// coordinates — no geocoding. Then the importer (run with --seed=seed-v2) annotates them.
//
//   node scripts/insertSeatracV2Beaches.mjs plan    # offline: classify no-match -> alias|insert|skip
//   node scripts/insertSeatracV2Beaches.mjs apply    # write aliases + insert new records
//
// Input:  reports/seatrac-match-adjudication.json (noMatch[] from a v2 match run)
//         scripts/data/seatrac-seed-v2.json        (rows carry lat/lon + seatracId)
// Target: public/greek_beaches.json
//
// A no-match row is:
//   - ALIAS  if an existing beach sits within 150 m -> add the seed name as metadata.aliases
//            (so the importer's fuzzy match links them; never a duplicate)
//   - INSERT otherwise -> new record at the seed's own coords, slot via nearest beach in-region
//   - SKIP   if region slot can't be resolved (slotConflict) -> reported, never guessed
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADJ = path.join(rootDir, 'reports', 'seatrac-match-adjudication.json');
const SEED_V2 = path.join(rootDir, 'scripts', 'data', 'seatrac-seed-v2.json');
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');
const PLAN_OUT = path.join(rootDir, 'reports', 'seatrac-v2-insert-plan.json');

const NEW_BEACH_MIN_ID = 3000;
const BATCH = 'seatrac_directory_2026_06';
const DUP_RADIUS_M = 150;          // pure geographic dup (any name)
const NAME_DUP_RADIUS_M = 600;     // same beach, slightly different name — alias, don't duplicate
const NAME_DUP_DICE = 55;          // core-name similarity threshold for the wider radius

const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const GREEK_MAP = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o' };
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
const normKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
// core key strips generic + locality-prefix words so "Παλαιό Φάληρο Έδεμ" ≈ "Παραλία Έδεμ"
const LOCALITY_WORDS = /\b(paralia|akti|beach|plaz|oropos|saronikos|palaio faliro|aigina|chania|thasos|leykada|skiathos|syros|symi|dorida|apokoronoy|aktio vonitsas)\b/g;
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

// classify each no-match row -> {action, ...}
const classify = (data) => {
  const adj = loadJson(ADJ);
  const v2 = loadJson(SEED_V2);
  const v2ByName = new Map(v2.beaches.map((r) => [r.nameGr, r]));
  const index = buildIndex(data);

  const aliases = [], inserts = [], skips = [];
  for (const e of adj.noMatch) {
    const row = v2ByName.get(e.seed.nameGr);
    if (!row || !Number.isFinite(row.lat)) { skips.push({ name: e.seed.nameGr, why: 'no coords in seed-v2' }); continue; }
    const coord = { lat: row.lat, lon: row.lon };
    const near = nearest(index, coord);
    // alias if: a beach sits within 150 m (any name), OR a name-similar beach within 600 m
    // (same beach, locality-prefixed name on the directory side — avoids near-duplicates).
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
      aliases.push({ seedName: row.nameGr, targetId: aliasTarget.p.id, targetName: aliasTarget.p.name, distanceM: Math.round(aliasTarget.d), alreadySeatrac: Boolean(aliasTarget.p.ref.metadata?.seatrac) });
    } else {
      const slot = nearestInRegion(index, row.region, coord);
      if (!slot) { skips.push({ name: row.nameGr, why: `no in-region neighbour for ${row.region}` }); continue; }
      inserts.push({ row, slot: { region: row.region, sub: slot.p.subName, subSub: slot.p.subSubName, neighborId: slot.p.id, neighborName: slot.p.name, neighborDistanceM: Math.round(slot.d) } });
    }
  }
  return { aliases, inserts, skips };
};

const buildRecord = (row, id, slot) => ({
  id,
  name: row.nameGr,
  lat: row.lat,
  lon: row.lon,
  metadata: {
    access: { type: 'unknown', label: 'Άγνωστη πρόσβαση', notes: 'From seatrac.gr official directory; access not field-verified.' },
    terrain: { types: [], label: '—' },
    organized: false,
    shade: false,
    amenities: [],
    confidence: 'low',
    language: 'el',
    batch: BATCH,
    needsVerification: true,
    sourceNotes: [
      `Seatrac directory import (2026-06): created from official seatrac.gr entry "${row.nameGr}" (id ${row.seatracId ?? '—'}), ${row.municipality || '—'}, ${row.region}. Coordinates from seatrac.gr. Slot via nearest existing beach #${slot.neighborId} (${slot.neighborDistanceM} m). Conservative — access/terrain unknown; accessibility added by the Seatrac importer.`,
    ],
    sourceUrls: row.sourceUrls && row.sourceUrls.length ? row.sourceUrls : ['https://seatrac.gr/'],
    googleMapsNavigation: { status: 'verified', mode: 'coordinates', checkedAt: new Date().toISOString().slice(0, 10), method: 'seatrac-directory-v1' },
  },
});

const runPlan = () => {
  const data = loadJson(DATA);
  const { aliases, inserts, skips } = classify(data);
  writeFileSync(PLAN_OUT, JSON.stringify({ _meta: { generatedAt: new Date().toISOString(), aliases: aliases.length, inserts: inserts.length, skips: skips.length }, aliases, inserts: inserts.map((i) => ({ name: i.row.nameGr, region: i.slot.region, lat: i.row.lat, lon: i.row.lon, neighbor: `#${i.slot.neighborId} ${i.slot.neighborName} (${i.slot.neighborDistanceM}m)` })), skips }, null, 2) + '\n', 'utf8');
  console.log(`alias ${aliases.length} | insert ${inserts.length} | skip ${skips.length}`);
  console.log(`Wrote plan -> ${path.relative(rootDir, PLAN_OUT)}`);
};

const runApply = () => {
  const data = loadJson(DATA);
  const { aliases, inserts } = classify(data);

  // 1) aliases: add seed name to the existing beach's metadata.aliases
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

  // 2) inserts: new records at seed coords, sequential ids
  let maxId = 0;
  for (const b of iterBeaches(data)) if (Number.isInteger(b.id) && b.id > maxId) maxId = b.id;
  let nextId = Math.max(NEW_BEACH_MIN_ID, maxId + 1);
  const index = buildIndex(data);
  let insertCount = 0; const skipped = [];
  // stable order for deterministic ids
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
  console.log('Next: rebuild, re-run importSeatracAccessibility match+apply --seed=scripts/data/seatrac-seed-v2.json');
};

const mode = process.argv[2];
if (mode === 'plan') runPlan();
else if (mode === 'apply') runApply();
else { console.error('Usage: node scripts/insertSeatracV2Beaches.mjs <plan|apply>'); process.exit(1); }
