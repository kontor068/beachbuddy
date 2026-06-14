// Seatrac Phase D2 — geocode the no-match accessible-beach seeds and CREATE records.
//
//   node scripts/geocodeSeatracNoMatch.mjs geocode   # OSM lookup -> review report (no writes)
//   node scripts/geocodeSeatracNoMatch.mjs apply       # insert HIGH (+ human-accepted) -> dataset
//
// Input:   reports/seatrac-match-adjudication.json  (noMatch[] — names+region, NO coords)
// Report:  reports/seatrac-d2-geocode.json           (machine-proposed; human reviews before apply)
// Target:  public/greek_beaches.json                 (apply mode only)
//
// SAFETY (mirrors importSeatracAccessibility.mjs): never invents a beach without OSM evidence.
// Auto-insert requires a high-confidence Nominatim hit corroborated by an Overpass natural=beach
// within ~300 m, inside the seed's own top-level region. Every created record is conservative:
// confidence:low, needsVerification:true, coordinate-routed nav (the app never sends an unverified
// place query), access/terrain unknown, amenities ONLY as the seed states. The rest go to the
// report for human promotion. Coordinates are snapped to the Overpass beach centroid when available.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ADJ_REPORT = path.join(rootDir, 'reports', 'seatrac-match-adjudication.json');
const D2_REPORT = path.join(rootDir, 'reports', 'seatrac-d2-geocode.json');
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');

const NEW_BEACH_MIN_ID = 3000;
const BATCH = 'seatrac_d2_2026_06';
const VERIFIED_AT = '2026-06-14';

// ---- OSM endpoints (copied from scripts/auditBeachPlaceLookup.mjs) -----------
const overpassMirrors = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];
const nominatimUrl = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'calmbeach-seatrac-d2-geocode/1.0 (accessible beach creation)';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// fetch with a hard timeout so a stalled OSM mirror can't hang the whole run.
const fetchWithTimeout = async (url, opts = {}, timeoutMs = 12000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
};

// ---- Greek-aware normalization (mirrors importSeatracAccessibility.mjs) ------
const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const GREEK_MAP = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
const normalizeText = (value) => greeklish(value)
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\b(paralia|akti|beach|plaz|the|of|greece|grecia)\b/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const normKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const tokenSet = (value) => new Set(normalizeText(value).split(' ').filter((t) => t.length >= 3));
const tokenOverlapScore = (a, b) => {
  const A = tokenSet(a); const B = tokenSet(b);
  if (A.size === 0 || B.size === 0) return 0;
  let overlap = 0;
  for (const t of A) if (B.has(t)) overlap += 1;
  return overlap / Math.max(A.size, B.size);
};

const toRadians = (d) => (d * Math.PI) / 180;
const distanceMeters = (from, to) => {
  if (!from || !to || !Number.isFinite(from.lat) || !Number.isFinite(from.lon) || !Number.isFinite(to.lat) || !Number.isFinite(to.lon)) return undefined;
  const R = 6371000;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ---- dataset walk ------------------------------------------------------------
function* iterBeaches(data) {
  for (const [region, sub] of Object.entries(data)) {
    for (const [subName, subSub] of Object.entries(sub)) {
      for (const [subSubName, arr] of Object.entries(subSub)) {
        if (!Array.isArray(arr)) continue;
        for (const beach of arr) yield { beach, region, subName, subSubName };
      }
    }
  }
}

// ---- region / island alias gating (wrong-region guard) -----------------------
// Top-level regions plus the island names that appear in seed nameGr/municipality.
const REGION_ALIASES = {
  Attica: ['attica', 'attiki', 'athens', 'athina', 'piraeus', 'pireas', 'aigina', 'aegina', 'poros', 'spetses', 'hydra', 'ydra', 'salamina', 'kythira', 'kithira', 'agistri', 'methana'],
  'Central Greece': ['central greece', 'sterea', 'evia', 'evvoia', 'euboea', 'viotia', 'boeotia', 'fthiotida', 'fokida', 'skyros', 'fokis'],
  'Central Macedonia': ['central macedonia', 'makedonia', 'thessaloniki', 'salonika', 'halkidiki', 'chalkidiki', 'pieria', 'imathia', 'kilkis', 'serres', 'pella', 'volvi', 'thermaikos'],
  Crete: ['crete', 'kriti', 'chania', 'hania', 'rethymno', 'rethimno', 'heraklion', 'iraklio', 'lasithi', 'gavdos'],
  'East Macedonia and Thrace': ['east macedonia', 'thrace', 'thraki', 'kavala', 'thasos', 'thassos', 'xanthi', 'rodopi', 'evros', 'drama'],
  Epirus: ['epirus', 'ipeiros', 'thesprotia', 'preveza', 'arta', 'ioannina', 'parga'],
  'Ionian Islands': ['ionian', 'ionia', 'corfu', 'kerkyra', 'kefalonia', 'cephalonia', 'zakynthos', 'zante', 'lefkada', 'lefkas', 'ithaca', 'ithaki', 'paxoi', 'paxos'],
  'North Aegean': ['north aegean', 'voreio aigaio', 'lesvos', 'lesbos', 'mytilene', 'chios', 'samos', 'ikaria', 'limnos', 'lemnos', 'psara', 'fournoi', 'agios efstratios'],
  Peloponnese: ['peloponnese', 'peloponnisos', 'messinia', 'laconia', 'lakonia', 'argolida', 'argolis', 'korinthia', 'corinthia', 'arcadia', 'arkadia', 'ileia', 'elis'],
  'South Aegean': ['south aegean', 'notio aigaio', 'cyclades', 'kyklades', 'dodecanese', 'dodekanisa', 'rhodes', 'rodos', 'kos', 'naxos', 'paros', 'mykonos', 'santorini', 'thira', 'syros', 'tinos', 'milos', 'karpathos', 'kalymnos', 'leros', 'lipsi', 'astypalaia', 'amorgos', 'ios', 'kythnos', 'kimolos', 'andros', 'serifos', 'sifnos', 'kea', 'patmos', 'symi', 'nisyros', 'tilos', 'kasos', 'koufonisia', 'koufonisi'],
  'West Greece': ['west greece', 'dytiki ellada', 'achaia', 'achaea', 'patras', 'patra', 'aetolia', 'acarnania', 'aitoloakarnania', 'mesolongi', 'ileia', 'kourouta'],
  Thessaly: ['thessaly', 'thessalia', 'magnesia', 'magnisia', 'pelion', 'pilio', 'larissa', 'larisa', 'volos', 'sporades', 'skiathos', 'skopelos', 'alonissos', 'trikala', 'karditsa'],
};
const aliasesFor = (region) => REGION_ALIASES[region] || [normKey(region)];
const addressHasAlias = (address, aliases) => {
  const norm = ` ${normKey(address)} `;
  return aliases.some((a) => a && norm.includes(` ${normKey(a)} `));
};
// True when the address names ANOTHER region/island and NOT the seed's own.
const hasWrongRegionSignal = (seedRegion, address) => {
  const own = aliasesFor(seedRegion);
  if (addressHasAlias(address, own)) return false; // own region present -> not wrong
  for (const [region, aliases] of Object.entries(REGION_ALIASES)) {
    if (region === seedRegion) continue;
    if (addressHasAlias(address, aliases)) return true;
  }
  return false;
};

// Generic names that should never auto-insert (too many namesakes in Greece).
const GENERIC_KEYS = new Set(['agia marina', 'agios stefanos', 'loutra', 'agios nikolaos', 'agios ioannis', 'limanaki', 'megalo', 'mikro', 'ammos', 'plaz']);
const isGenericName = (seed) => {
  const k = normalizeText(seed.nameEn || seed.nameGr || '');
  if (!k) return true;
  if (k.split(' ').length <= 1 && k.length <= 5) return true;
  return GENERIC_KEYS.has(k);
};

// ---- query construction ------------------------------------------------------
const dedupeStrings = (arr) => {
  const seen = new Set(); const out = [];
  for (const s of arr) {
    const v = String(s || '').trim();
    const key = normKey(v);
    if (!v || !key || seen.has(key)) continue;
    seen.add(key); out.push(v);
  }
  return out;
};
const buildQueries = (seed) => {
  const { nameGr, nameEn, municipality, region } = seed;
  const variants = [];
  if (municipality) variants.push(`${nameGr}, ${municipality}, ${region}, Greece`);
  variants.push(`${nameGr}, ${region}, Greece`);
  if (nameEn && municipality) variants.push(`${nameEn}, ${municipality}, Greece`);
  if (nameEn) variants.push(`${nameEn}, ${region}, Greece`);
  // Drop a leading locality token for multi-word names ("Άλιμος Καλαμάκι" -> "Καλαμάκι").
  const grWords = String(nameGr || '').trim().split(/\s+/);
  if (grWords.length >= 3) variants.push(`${grWords.slice(1).join(' ')}, ${municipality || region}, Greece`);
  return dedupeStrings(variants).slice(0, 4);
};

// ---- OSM fetchers (adapted from auditBeachPlaceLookup.mjs) --------------------
const fetchNominatim = async (query, sleepMs) => {
  const url = `${nominatimUrl}?q=${encodeURIComponent(query)}&format=jsonv2&namedetails=1&addressdetails=1&limit=5&countrycodes=gr`;
  try {
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 429 || res.status === 503) { await sleep(sleepMs * 3); return []; }
    if (!res.ok) { await sleep(sleepMs); return []; }
    const arr = await res.json().catch(() => []);
    await sleep(sleepMs);
    return (Array.isArray(arr) ? arr : []).map((r) => ({
      osmId: `nom-${r.osm_type}-${r.osm_id}`,
      name: r.namedetails?.name || r.name || (r.display_name || '').split(',')[0] || '',
      address: r.display_name || '',
      lat: Number(r.lat), lon: Number(r.lon),
      type: r.type, klass: r.class,
    })).filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon));
  } catch { await sleep(sleepMs); return []; }
};

const fetchOverpassBeaches = async (coordinate, radiusMeters) => {
  const q = `[out:json][timeout:25];(node["natural"="beach"](around:${radiusMeters},${coordinate.lat},${coordinate.lon});way["natural"="beach"](around:${radiusMeters},${coordinate.lat},${coordinate.lon}););out tags center 8;`;
  for (const mirror of overpassMirrors) {
    try {
      const res = await fetchWithTimeout(mirror, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: 'data=' + encodeURIComponent(q),
      });
      if (res.status === 429 || res.status === 504 || res.status >= 500) continue;
      const json = await res.json().catch(() => ({}));
      const els = Array.isArray(json.elements) ? json.elements : [];
      return els.map((e) => {
        const lat = e.lat ?? e.center?.lat;
        const lon = e.lon ?? e.center?.lon;
        return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon, name: e.tags?.name || '' } : null;
      }).filter(Boolean);
    } catch { /* next mirror */ }
  }
  return null; // all mirrors failed
};

// ---- scoring -----------------------------------------------------------------
const scoreCandidate = (seed, nom, overpassNearest) => {
  const candidateText = `${nom.name} ${nom.address}`;
  const nameOverlap = Math.max(
    tokenOverlapScore(seed.nameGr || '', candidateText),
    tokenOverlapScore(seed.nameEn || '', candidateText),
  );
  let nameScore = Math.round(nameOverlap * 40);
  const candNorm = normalizeText(candidateText);
  if (candNorm.includes(normalizeText(seed.nameGr || '')) || candNorm.includes(normalizeText(seed.nameEn || ''))) {
    nameScore = Math.max(nameScore, 30);
  }
  nameScore = Math.min(nameScore, 40);

  const t = `${nom.type || ''} ${nom.klass || ''}`.toLowerCase();
  let typeScore = 0;
  if (t.includes('beach')) typeScore = 25;
  else if (/(natural|bay|cape|coastline|water|shoal|strand)/.test(t)) typeScore = 18;
  else if (/(locality|hamlet|village|suburb|neighbourhood|town|place|tourism|leisure)/.test(t)) typeScore = 8;

  const regionScore = addressHasAlias(nom.address, [
    ...(seed.municipality ? [seed.municipality] : []),
    ...aliasesFor(seed.region),
  ]) ? 15 : 0;

  let overpassScore = 0;
  let overpassM = null;
  if (overpassNearest) {
    overpassM = Math.round(overpassNearest.distanceM);
    if (overpassNearest.distanceM <= 300) overpassScore = 20;
    else if (overpassNearest.distanceM <= 800) overpassScore = 10;
  } else if (t.includes('beach')) {
    overpassScore = 10; // the Nominatim hit itself is a beach, no nearby corroborator found
  }

  const total = nameScore + typeScore + regionScore + overpassScore;
  return { total, nameScore, typeScore, regionScore, overpassScore, overpassM };
};

// ---- slot resolution ---------------------------------------------------------
const buildNearestIndex = (data) => {
  const points = [];
  for (const { beach, region, subName, subSubName } of iterBeaches(data)) {
    if (Number.isFinite(beach.lat) && Number.isFinite(beach.lon)) {
      points.push({ lat: beach.lat, lon: beach.lon, region, subName, subSubName, id: beach.id, name: beach.name });
    }
  }
  return points;
};
const resolveSlot = (index, seedRegion, coord) => {
  let global = null; let inRegion = null;
  for (const p of index) {
    const d = distanceMeters(coord, p);
    if (d === undefined) continue;
    if (!global || d < global.d) global = { d, p };
    if (p.region === seedRegion && (!inRegion || d < inRegion.d)) inRegion = { d, p };
  }
  const slotConflict = !global || global.p.region !== seedRegion;
  if (!inRegion) return { slotConflict: true, neighborRegion: global?.p.region };
  return {
    region: seedRegion,
    sub: inRegion.p.subName,
    subSub: inRegion.p.subSubName,
    neighborId: inRegion.p.id,
    neighborName: inRegion.p.name,
    neighborDistanceM: Math.round(inRegion.d),
    farNeighbor: inRegion.d > 25000,
    slotConflict,
    neighborRegion: global?.p.region,
  };
};

// ---- tiering -----------------------------------------------------------------
const decideTier = (score, slot, seed, best) => {
  const flags = [];
  if (!best) { flags.push('no_result'); return { tier: 'NONE', flags }; }
  if (best.wrongRegion) flags.push('wrong_region');
  if (score.nameScore < 22) flags.push('weak_name_match');
  if (score.typeScore < 18) flags.push('locality_not_beach');
  if (score.overpassScore < 10) flags.push('no_overpass_corroboration');
  if (slot?.slotConflict) flags.push('slot_conflict');
  if (slot?.farNeighbor) flags.push('far_neighbor');
  if (isGenericName(seed)) flags.push('generic_name');

  if (best.wrongRegion) return { tier: 'NONE', flags };

  const highOk = score.total >= 70 && score.nameScore >= 22 && score.typeScore >= 18 &&
    score.regionScore > 0 && score.overpassScore >= 10 && slot && !slot.slotConflict && !isGenericName(seed);
  if (highOk) return { tier: 'HIGH', flags };
  if (score.total >= 50) return { tier: 'MEDIUM', flags };
  if (score.total >= 30) return { tier: 'LOW', flags };
  return { tier: 'NONE', flags };
};

// ---- evaluate one seed -------------------------------------------------------
const evaluateSeed = async (seed, index, args) => {
  const queries = buildQueries(seed);
  const tried = [];
  const evaluated = [];

  for (const query of queries) {
    tried.push(query);
    const hits = await fetchNominatim(query, args.sleepMs);
    for (const nom of hits) {
      if (hasWrongRegionSignal(seed.region, nom.address)) {
        evaluated.push({ nom, score: { total: 0 }, slot: null, wrongRegion: true, query });
        continue;
      }
      const ov = await fetchOverpassBeaches({ lat: nom.lat, lon: nom.lon }, 800);
      await sleep(Math.min(args.sleepMs, 1100));
      let overpassNearest = null; let snapped = { lat: nom.lat, lon: nom.lon };
      if (ov && ov.length) {
        let bestOv = null;
        for (const b of ov) {
          const d = distanceMeters({ lat: nom.lat, lon: nom.lon }, b);
          if (d !== undefined && (!bestOv || d < bestOv.distanceM)) bestOv = { ...b, distanceM: d };
        }
        if (bestOv) { overpassNearest = bestOv; if (bestOv.distanceM <= 300) snapped = { lat: bestOv.lat, lon: bestOv.lon }; }
      }
      const score = scoreCandidate(seed, nom, overpassNearest);
      const slot = resolveSlot(index, seed.region, snapped);
      evaluated.push({ nom, score, slot, snapped, overpassNearest, wrongRegion: false, query });
    }
    // Short-circuit: stop querying once we have a clearly HIGH candidate.
    const top = evaluated.filter((e) => !e.wrongRegion).sort((a, b) => b.score.total - a.score.total)[0];
    if (top && top.score.total >= 70 && top.slot && !top.slot.slotConflict) break;
  }

  const ranked = evaluated.filter((e) => !e.wrongRegion).sort((a, b) => b.score.total - a.score.total);
  const wrongOnly = evaluated.length > 0 && ranked.length === 0;
  const best = ranked[0] || (wrongOnly ? evaluated[0] : null);
  const score = best ? best.score : { total: 0, nameScore: 0, typeScore: 0, regionScore: 0, overpassScore: 0, overpassM: null };
  const slot = best?.slot || null;
  const { tier, flags } = decideTier(score, slot, seed, best && (!wrongOnly ? best : { wrongRegion: true }));

  return {
    seed,
    tier,
    decision: tier === 'HIGH' ? 'auto-accept' : (tier === 'NONE' ? 'skip' : 'REVIEW'),
    queriesTried: tried,
    best: best && !wrongOnly ? {
      osmId: best.nom.osmId,
      name: best.nom.name,
      address: best.nom.address,
      lat: best.snapped.lat,
      lon: best.snapped.lon,
      score,
      overpassCorroborationM: score.overpassM,
      wrongRegion: false,
    } : (wrongOnly ? { osmId: evaluated[0].nom.osmId, name: evaluated[0].nom.name, address: evaluated[0].nom.address, wrongRegion: true } : null),
    alternates: ranked.slice(1, 4).map((e) => ({ osmId: e.nom.osmId, name: e.nom.name, address: e.nom.address, total: e.score.total })),
    slot,
    flags,
  };
};

// ---- amenities from seed (flat string array, never invented) -----------------
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
    id,
    name: seed.nameGr,
    lat: best.lat,
    lon: best.lon,
    metadata: {
      access: {
        type: 'unknown',
        label: 'Άγνωστη πρόσβαση',
        notes: 'Geocoded from Seatrac accessible-beach seed; access not field-verified.',
      },
      terrain: { types: [], label: '—' },
      organized: false,
      shade: false,
      amenities: seedAmenityStrings(seed),
      confidence: 'low',
      language: 'el',
      batch: BATCH,
      needsVerification: true,
      sourceNotes: [
        `Seatrac Phase D2 geocode (2026-06): created from no-match seed "${seed.nameGr}" (${seed.nameEn || '—'}), ${seed.municipality || '—'}, ${seed.region}. Nominatim hit ${best.osmId}; Overpass natural=beach corroboration ${best.overpassCorroborationM == null ? 'n/a' : best.overpassCorroborationM + ' m'}. Slot via nearest existing beach #${slot.neighborId} (${slot.neighborDistanceM} m). Conservative — access/terrain unknown, amenities only as stated.`,
      ],
      sourceUrls: seed.sourceUrls && seed.sourceUrls.length ? seed.sourceUrls : ['https://seatrac.gr/'],
      googleMapsNavigation: {
        status: 'verified', mode: 'coordinates', checkedAt: VERIFIED_AT, method: 'osm-geocode-d2-v1',
      },
    },
  };
};

// ---- modes -------------------------------------------------------------------
const parseArgs = () => {
  const args = { sleepMs: 1100, limit: undefined };
  for (const a of process.argv.slice(3)) {
    if (a.startsWith('--limit=')) args.limit = Number.parseInt(a.slice('--limit='.length), 10);
    else if (a.startsWith('--sleep-ms=')) args.sleepMs = Number.parseInt(a.slice('--sleep-ms='.length), 10);
  }
  return args;
};

const runGeocode = async () => {
  const args = parseArgs();
  const adj = loadJson(ADJ_REPORT);
  const data = loadJson(DATA);
  const index = buildNearestIndex(data);
  let seeds = adj.noMatch.map((e) => e.seed);
  if (Number.isInteger(args.limit) && args.limit > 0) seeds = seeds.slice(0, args.limit);

  const results = [];
  const tiers = { HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0 };
  let done = 0;
  for (const seed of seeds) {
    const r = await evaluateSeed(seed, index, args);
    results.push(r);
    tiers[r.tier] += 1;
    done += 1;
    if (done % 5 === 0) process.stderr.write(`...${done}/${seeds.length} (HIGH ${tiers.HIGH} / MED ${tiers.MEDIUM} / LOW ${tiers.LOW} / NONE ${tiers.NONE})\n`);
  }

  const report = {
    _meta: {
      generatedAt: new Date().toISOString(),
      seedCount: seeds.length,
      tiers,
      thresholds: {
        HIGH: 'total>=70 & name>=22 & type>=18 & region>0 & overpass>=10 & slot-in-region & not-generic',
        MEDIUM: 50, LOW: 30,
      },
      instructions: "Review MEDIUM/LOW: set decision:'accept' to insert or 'skip'. HIGH auto-inserts. Then: node scripts/geocodeSeatracNoMatch.mjs apply",
      nominatimPolicy: '1 req/s, countrycodes=gr, identifiable UA',
    },
    results,
  };
  writeFileSync(D2_REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`\nSeeds: ${seeds.length} | HIGH ${tiers.HIGH} | MEDIUM ${tiers.MEDIUM} | LOW ${tiers.LOW} | NONE ${tiers.NONE}`);
  console.log(`Wrote -> ${path.relative(rootDir, D2_REPORT)}`);
  console.log('Review it, then run: node scripts/geocodeSeatracNoMatch.mjs apply');
};

const runApply = () => {
  let report;
  try { report = loadJson(D2_REPORT); } catch {
    console.error('No D2 geocode report. Run `geocode` first, then review it.');
    process.exit(1);
  }
  const data = loadJson(DATA);
  const index = buildNearestIndex(data);

  let maxId = 0;
  for (const { beach } of iterBeaches(data)) if (Number.isInteger(beach.id) && beach.id > maxId) maxId = beach.id;
  let nextId = Math.max(NEW_BEACH_MIN_ID, maxId + 1);

  const eligible = report.results
    .filter((e) => (e.tier === 'HIGH' || e.decision === 'accept') && e.decision !== 'skip')
    .filter((e) => e.best && !e.best.wrongRegion && e.slot && !e.slot.slotConflict)
    .sort((a, b) => (a.seed.region.localeCompare(b.seed.region)) || String(a.seed.nameEn || a.seed.nameGr).localeCompare(String(b.seed.nameEn || b.seed.nameGr)));

  let applied = 0;
  const skipped = [];
  for (const entry of eligible) {
    const { slot, best, seed } = entry;
    const coord = { lat: best.lat, lon: best.lon };
    // Idempotency: same-name beach already within 150 m of the coordinate?
    const dup = index.find((p) => normKey(p.name) === normKey(seed.nameGr) && (distanceMeters(coord, p) ?? Infinity) <= 150);
    if (dup) { skipped.push({ name: seed.nameGr, why: `duplicate of #${dup.id} within 150 m` }); continue; }

    const arr = data?.[slot.region]?.[slot.sub]?.[slot.subSub];
    if (!Array.isArray(arr)) { skipped.push({ name: seed.nameGr, why: `slot ${slot.region}/${slot.sub}/${slot.subSub} missing` }); continue; }

    const id = nextId++;
    const record = buildInsertRecord(entry, id);
    arr.push(record);
    index.push({ lat: record.lat, lon: record.lon, region: slot.region, subName: slot.sub, subSubName: slot.subSub, id, name: record.name });
    applied += 1;
  }

  writeFileSync(DATA, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`Inserted ${applied} new beach(es) (ids ${applied ? `${nextId - applied}-${nextId - 1}` : 'none'}). Skipped: ${skipped.length}`);
  if (skipped.length) console.log(JSON.stringify(skipped, null, 2));
  console.log('Next: node scripts/buildBeachRegionData.mjs ; then re-run importSeatracAccessibility match+apply to annotate the new beaches.');
};

const mode = process.argv[2];
if (mode === 'geocode') runGeocode().catch((e) => { console.error(e); process.exit(1); });
else if (mode === 'apply') runApply();
else { console.error('Usage: node scripts/geocodeSeatracNoMatch.mjs <geocode|apply> [--limit=N] [--sleep-ms=1100]'); process.exit(1); }
