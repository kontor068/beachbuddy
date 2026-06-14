// Seatrac D2 — PASS 3 (beach-first geocoding). One-off helper.
//
//   node scripts/geocodeSeatracPass3.mjs geocode   # locality -> Overpass beaches -> best name match
//   node scripts/geocodeSeatracPass3.mjs apply       # insert accepted -> dataset
//
// Why a new pass: pass 1/2 trusted the Nominatim TEXT hit as the point, which for many seeds
// resolved to a nearby business (bank, taverna, dive shop) while a real natural=beach happened
// to sit within 300 m (false-positive corroboration). This pass inverts it: geocode the LOCALITY
// (seed name / municipality) to a centroid, pull every natural=beach within a radius from Overpass,
// and pick the one whose OSM name best matches the seed. The beach name is authored OSM data of the
// RIGHT type, so it ranks honestly. Operates only on seeds NOT already accepted in the D2 report,
// reuses that report's slot/region machinery, and writes its own report.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const D2_REPORT = path.join(rootDir, 'reports', 'seatrac-d2-geocode.json');
const P3_REPORT = path.join(rootDir, 'reports', 'seatrac-d2-pass3.json');
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');

const NEW_BEACH_MIN_ID = 3000;
const BATCH = 'seatrac_d2_2026_06';
const VERIFIED_AT = '2026-06-14';

const overpassMirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'calmbeach-seatrac-d2-pass3/1.0 (accessible beach creation)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchWithTimeout = async (url, opts = {}, timeoutMs = 12000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(timer); }
};

const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const GREEK_MAP = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o' };
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
const normalizeText = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\b(paralia|akti|beach|plaz|the|of|greece|grecia|bay)\b/g, ' ').replace(/\s+/g, ' ').trim();
const normKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const tokenSet = (v) => new Set(normalizeText(v).split(' ').filter((t) => t.length >= 3));
const tokenOverlapScore = (a, b) => {
  const A = tokenSet(a), B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let o = 0; for (const t of A) if (B.has(t)) o += 1;
  return o / Math.max(A.size, B.size);
};
const toRadians = (d) => (d * Math.PI) / 180;
const distanceMeters = (from, to) => {
  if (!from || !to || ![from.lat, from.lon, to.lat, to.lon].every(Number.isFinite)) return undefined;
  const R = 6371000, dLat = toRadians(to.lat - from.lat), dLon = toRadians(to.lon - from.lon);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRadians(from.lat))*Math.cos(toRadians(to.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

function* iterBeaches(data) {
  for (const [region, sub] of Object.entries(data))
    for (const [subName, subSub] of Object.entries(sub))
      for (const [subSubName, arr] of Object.entries(subSub))
        if (Array.isArray(arr)) for (const beach of arr) yield { beach, region, subName, subSubName };
}

// region aliases (reused from the main harness, condensed)
const REGION_ALIASES = loadJson(path.join(rootDir, 'scripts', 'data', 'seatrac-region-aliases.json'));
const aliasesFor = (region) => REGION_ALIASES[region] || [normKey(region)];
const addressHasAlias = (address, aliases) => {
  const norm = ` ${normKey(address)} `;
  return aliases.some((a) => a && norm.includes(` ${normKey(a)} `));
};

// ---- locality geocode (Nominatim) -> centroid --------------------------------
const geocodeLocality = async (query, sleepMs) => {
  const url = `${nominatimUrl}?q=${encodeURIComponent(query)}&format=jsonv2&addressdetails=1&limit=3&countrycodes=gr`;
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) { await sleep(sleepMs); return []; }
    const arr = await res.json().catch(() => []);
    await sleep(sleepMs);
    return (Array.isArray(arr) ? arr : []).map((r) => ({
      lat: Number(r.lat), lon: Number(r.lon), address: r.display_name || '',
    })).filter((c) => Number.isFinite(c.lat));
  } catch { await sleep(sleepMs); return []; }
};

// ---- Overpass: all natural=beach within radius (WITH names) ------------------
const fetchOverpassBeaches = async (coord, radiusMeters) => {
  const q = `[out:json][timeout:25];(node["natural"="beach"](around:${radiusMeters},${coord.lat},${coord.lon});way["natural"="beach"](around:${radiusMeters},${coord.lat},${coord.lon}););out tags center 30;`;
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetchWithTimeout(mirror, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT }, body: 'data=' + encodeURIComponent(q) });
      if (res.status === 429 || res.status === 504 || res.status >= 500) continue;
      const json = await res.json().catch(() => ({}));
      return (Array.isArray(json.elements) ? json.elements : []).map((e) => {
        const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon;
        const name = e.tags?.name || e.tags?.['name:el'] || e.tags?.['name:en'] || '';
        return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, name } : null;
      }).filter(Boolean);
    } catch { /* next */ }
  }
  return null;
};

const buildNearestIndex = (data) => {
  const pts = [];
  for (const { beach, region, subName, subSubName } of iterBeaches(data))
    if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon))
      pts.push({ lat: beach.lat, lon: beach.lon, region, subName, subSubName, id: beach.id, name: beach.name });
  return pts;
};
const resolveSlot = (index, seedRegion, coord) => {
  let global = null, inRegion = null;
  for (const p of index) {
    const d = distanceMeters(coord, p); if (d === undefined) continue;
    if (!global || d < global.d) global = { d, p };
    if (p.region === seedRegion && (!inRegion || d < inRegion.d)) inRegion = { d, p };
  }
  const slotConflict = !global || global.p.region !== seedRegion;
  if (!inRegion) return { slotConflict: true, neighborRegion: global?.p.region };
  return { region: seedRegion, sub: inRegion.p.subName, subSub: inRegion.p.subSubName, neighborId: inRegion.p.id, neighborName: inRegion.p.name, neighborDistanceM: Math.round(inRegion.d), farNeighbor: inRegion.d > 25000, slotConflict, neighborRegion: global?.p.region };
};

// ---- the core: pick the best-named beach near the seed locality --------------
const localityQueries = (seed) => {
  const out = [];
  const nameGr = seed.nameGr || '', muni = seed.municipality || '', region = seed.region;
  if (muni) out.push(`${muni}, ${region}, Greece`);
  // strip a trailing beach-specific token to bias toward the settlement
  const words = nameGr.trim().split(/\s+/);
  if (words.length >= 2) out.push(`${words.slice(0, -1).join(' ')}, ${region}, Greece`);
  out.push(`${nameGr}, ${region}, Greece`);
  // de-dup
  const seen = new Set(); return out.filter((q) => { const k = normKey(q); if (!k || seen.has(k)) return false; seen.add(k); return true; }).slice(0, 3);
};

const evaluateSeed = async (seed, index, args) => {
  const queries = localityQueries(seed);
  const tried = [];
  let allBeaches = [];
  let localityCenter = null;
  for (const q of queries) {
    tried.push(q);
    const hits = await geocodeLocality(q, args.sleepMs);
    if (!hits.length) continue;
    // wrong-region guard on the locality address
    const hit = hits.find((h) => addressHasAlias(h.address, aliasesFor(seed.region))) || hits[0];
    localityCenter = { lat: hit.lat, lon: hit.lon };
    const beaches = await fetchOverpassBeaches(localityCenter, args.radiusMeters);
    await sleep(Math.min(args.sleepMs, 1100));
    if (beaches && beaches.length) { allBeaches = beaches; break; }
  }

  if (!localityCenter) return { seed, tier: 'NONE', decision: 'skip', queriesTried: tried, flags: ['locality_not_found'] };
  if (!allBeaches.length) return { seed, tier: 'NONE', decision: 'skip', queriesTried: tried, localityCenter, flags: ['no_beach_near_locality'] };

  // rank beaches by name match to the seed; break ties by closeness to locality center
  const scored = allBeaches.map((b) => {
    const nm = Math.max(tokenOverlapScore(seed.nameGr || '', b.name), tokenOverlapScore(seed.nameEn || '', b.name));
    let nameScore = Math.round(nm * 100);
    const bn = normalizeText(b.name), sn = normalizeText(seed.nameGr || ''), se = normalizeText(seed.nameEn || '');
    if (b.name && (bn.includes(sn) || sn.includes(bn) || bn.includes(se))) nameScore = Math.max(nameScore, 80);
    const dist = distanceMeters(localityCenter, b);
    return { b, nameScore, dist };
  }).sort((a, b) => (b.nameScore - a.nameScore) || (a.dist - b.dist));

  const best = scored[0];
  const coord = { lat: best.b.lat, lon: best.b.lon };
  const slot = resolveSlot(index, seed.region, coord);
  const flags = [];
  if (best.nameScore < 50) flags.push('weak_name_match');
  if (best.b.name === '') flags.push('unnamed_beach');
  if (slot?.slotConflict) flags.push('slot_conflict');
  if (slot?.farNeighbor) flags.push('far_neighbor');

  // accept when the OSM beach name clearly matches AND slot is sane
  const accept = best.nameScore >= 50 && best.b.name !== '' && slot && !slot.slotConflict && !slot.farNeighbor;

  return {
    seed,
    tier: accept ? 'HIGH' : (best.nameScore >= 30 ? 'MEDIUM' : 'LOW'),
    decision: accept ? 'auto-accept' : 'REVIEW',
    queriesTried: tried,
    localityCenter,
    best: { name: best.b.name, lat: coord.lat, lon: coord.lon, nameScore: best.nameScore, distFromLocalityM: Math.round(best.dist) },
    alternates: scored.slice(1, 4).map((s) => ({ name: s.b.name, nameScore: s.nameScore, lat: s.b.lat, lon: s.b.lon })),
    slot,
    flags,
  };
};

const seedAmenityStrings = (seed) => {
  if (seed.full) return ['πρόσβαση ΑμεΑ (Seatrac)', 'ράμπα/διάδρομος προς τη θάλασσα', 'προσβάσιμη τουαλέτα', 'αποδυτήριο', 'ντους'];
  const out = [];
  if (seed.boardwalkToWater) out.push('ράμπα/διάδρομος προς τη θάλασσα');
  if (seed.accessibleWc) out.push('προσβάσιμη τουαλέτα');
  if (seed.changingRoom) out.push('αποδυτήριο');
  if (seed.shower) out.push('ντους');
  if (seed.shade) out.push('σκίαση');
  return out;
};
const buildInsertRecord = (entry, id) => {
  const { seed, best, slot } = entry;
  return {
    id, name: seed.nameGr, lat: best.lat, lon: best.lon,
    metadata: {
      access: { type: 'unknown', label: 'Άγνωστη πρόσβαση', notes: 'Geocoded from Seatrac accessible-beach seed; access not field-verified.' },
      terrain: { types: [], label: '—' }, organized: false, shade: false,
      amenities: seedAmenityStrings(seed),
      confidence: 'low', language: 'el', batch: BATCH, needsVerification: true,
      sourceNotes: [`Seatrac Phase D2 pass-3 (2026-06): created from no-match seed "${seed.nameGr}" (${seed.nameEn || '—'}), ${seed.municipality || '—'}, ${seed.region}. Matched OSM natural=beach "${best.name}" near the locality centroid (name score ${best.nameScore}). Slot via nearest existing beach #${slot.neighborId} (${slot.neighborDistanceM} m). Conservative — access/terrain unknown, amenities only as stated.`],
      sourceUrls: seed.sourceUrls && seed.sourceUrls.length ? seed.sourceUrls : ['https://seatrac.gr/'],
      googleMapsNavigation: { status: 'verified', mode: 'coordinates', checkedAt: VERIFIED_AT, method: 'osm-geocode-d2-pass3-v1' },
    },
  };
};

const parseArgs = () => {
  const a = { sleepMs: 1100, radiusMeters: 6000, limit: undefined };
  for (const x of process.argv.slice(3)) {
    if (x.startsWith('--limit=')) a.limit = Number.parseInt(x.slice(8), 10);
    else if (x.startsWith('--sleep-ms=')) a.sleepMs = Number.parseInt(x.slice(11), 10);
    else if (x.startsWith('--radius-meters=')) a.radiusMeters = Number.parseInt(x.slice(16), 10);
  }
  return a;
};

const runGeocode = async () => {
  const args = parseArgs();
  const d2 = loadJson(D2_REPORT);
  const data = loadJson(DATA);
  const index = buildNearestIndex(data);
  // only seeds NOT already accepted in the D2 report
  let pending = d2.results.filter((r) => r.decision !== 'accept').map((r) => r.seed);
  if (Number.isInteger(args.limit) && args.limit > 0) pending = pending.slice(0, args.limit);

  const results = [];
  const tiers = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
  let done = 0;
  for (const seed of pending) {
    const r = await evaluateSeed(seed, index, args);
    results.push(r); tiers[r.tier] += 1; done += 1;
    if (done % 5 === 0) process.stderr.write(`...${done}/${pending.length} (H${tiers.HIGH}/M${tiers.MEDIUM}/L${tiers.LOW}/N${tiers.NONE})\n`);
  }
  writeFileSync(P3_REPORT, JSON.stringify({ _meta: { generatedAt: new Date().toISOString(), pendingCount: pending.length, tiers, strategy: 'locality-centroid -> Overpass natural=beach -> best OSM-name match', instructions: "HIGH auto-inserts. Promote good MEDIUM/LOW via decision:'accept', skip with 'skip'. Then: node scripts/geocodeSeatracPass3.mjs apply" }, results }, null, 2) + '\n', 'utf8');
  console.log(`\nPending: ${pending.length} | HIGH ${tiers.HIGH} | MEDIUM ${tiers.MEDIUM} | LOW ${tiers.LOW} | NONE ${tiers.NONE}`);
  console.log(`Wrote -> ${path.relative(rootDir, P3_REPORT)}`);
};

const runApply = () => {
  const report = loadJson(P3_REPORT);
  const data = loadJson(DATA);
  const index = buildNearestIndex(data);
  let maxId = 0;
  for (const { beach } of iterBeaches(data)) if (Number.isInteger(beach.id) && beach.id > maxId) maxId = beach.id;
  let nextId = Math.max(NEW_BEACH_MIN_ID, maxId + 1);

  const eligible = report.results
    .filter((e) => (e.tier === 'HIGH' || e.decision === 'accept') && e.decision !== 'skip' && e.best && e.slot && !e.slot.slotConflict)
    .sort((a, b) => a.seed.region.localeCompare(b.seed.region) || String(a.seed.nameEn || a.seed.nameGr).localeCompare(String(b.seed.nameEn || b.seed.nameGr)));

  let applied = 0; const skipped = [];
  for (const entry of eligible) {
    const { slot, best, seed } = entry;
    const coord = { lat: best.lat, lon: best.lon };
    const dup = index.find((p) => (distanceMeters(coord, p) ?? Infinity) <= 150 && (normKey(p.name) === normKey(seed.nameGr) || normKey(p.name) === normKey(best.name)));
    if (dup) { skipped.push({ name: seed.nameGr, why: `duplicate of #${dup.id} within 150 m` }); continue; }
    const arr = data?.[slot.region]?.[slot.sub]?.[slot.subSub];
    if (!Array.isArray(arr)) { skipped.push({ name: seed.nameGr, why: 'slot missing' }); continue; }
    const id = nextId++;
    const rec = buildInsertRecord(entry, id);
    arr.push(rec);
    index.push({ lat: rec.lat, lon: rec.lon, region: slot.region, subName: slot.sub, subSubName: slot.subSub, id, name: rec.name });
    applied += 1;
  }
  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Inserted ${applied} (ids ${applied ? `${nextId - applied}-${nextId - 1}` : 'none'}). Skipped: ${skipped.length}`);
  if (skipped.length) console.log(JSON.stringify(skipped, null, 2));
};

const mode = process.argv[2];
if (mode === 'geocode') runGeocode().catch((e) => { console.error(e); process.exit(1); });
else if (mode === 'apply') runApply();
else { console.error('Usage: node scripts/geocodeSeatracPass3.mjs <geocode|apply> [--limit=N] [--radius-meters=6000]'); process.exit(1); }
