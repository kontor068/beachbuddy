// Seatrac directory scraper — pull the OFFICIAL, full accessible-beach list from seatrac.gr
// (267 beaches) and turn the active Greek ones into a v2 seed for the existing import pipeline.
//
//   node scripts/scrapeSeatracDirectory.mjs fetch [--refresh]  # one cached GET, raw -> .tmp
//   node scripts/scrapeSeatracDirectory.mjs build               # offline: cached raw -> seed-v2.json
//   node scripts/scrapeSeatracDirectory.mjs report              # offline: diff v2 vs v1 vs dataset
//
// Source:  GET https://seatrac.gr/umbraco/surface/beachsurface/GetAllRegions  (Umbraco surface, JSON)
// Output:  scripts/data/seatrac-seed-v2.json   (same schema as seatrac-seed.json)
//
// POLICY (user decisions): keep ONLY active beaches (Σε λειτουργία + Προσωρινά ανενεργό); drop
// Απεγκατεστημένο (machine removed). Facilities map true->'yes', everything else->'unknown'
// (never 'no' without explicit confirmation). Drop foreign installs (outside Greece bbox).
//
// RESPECTFUL: one GET per day, cached to .tmp (gitignored); build/report are fully offline.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENDPOINT = 'https://seatrac.gr/umbraco/surface/beachsurface/GetAllRegions';
const BUNDLE_URL = 'https://seatrac.gr/scripts/index.bundle.js';
const TMP_DIR = path.join(rootDir, '.tmp');
const SEED_V1 = path.join(rootDir, 'scripts', 'data', 'seatrac-seed.json');
const SEED_V2 = path.join(rootDir, 'scripts', 'data', 'seatrac-seed-v2.json');
const ALIASES = path.join(rootDir, 'scripts', 'data', 'seatrac-region-aliases.json');
const DATA = path.join(rootDir, 'public', 'greek_beaches.json');
const V2_DIFF = path.join(rootDir, 'reports', 'seatrac-v2-vs-v1.json');

const USER_AGENT = 'calmbeach-seatrac-directory/1.0 (accessible-beach data; marismiltos@gmail.com)';
const AMENITY_KEYS = ['disabledParking', 'boardwalkToWater', 'accessibleWc', 'changingRoom', 'shower', 'shade'];
// Greece bbox (mirrors validateCriticalBeachData.mjs) — foreign installs fall outside.
const GR_BBOX = { latMin: 34, latMax: 42.5, lonMin: 19, lonMax: 30.5 };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fetchWithTimeout = async (url, opts = {}, timeoutMs = 15000) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); } finally { clearTimeout(timer); }
};
const loadJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
const today = () => new Date().toISOString().slice(0, 10);
const cachePath = (date = today()) => path.join(TMP_DIR, `seatrac-getallregions.${date}.json`);

// ---- Greek-aware transliteration (mirrors importSeatracAccessibility.mjs) -----
const stripAccents = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ς/g, 'σ');
const GREEK_MAP = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o' };
const greeklish = (v) => stripAccents(v).toLowerCase().split('').map((c) => GREEK_MAP[c] ?? c).join('');
const normKey = (v) => greeklish(v).replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

// ---- dataset walk (for report mode) ------------------------------------------
function* iterBeaches(data) {
  for (const sub of Object.values(data))
    for (const subSub of Object.values(sub))
      for (const arr of Object.values(subSub))
        if (Array.isArray(arr)) for (const beach of arr) yield beach;
}

// ---- prefecture (Greek) -> top-level region ----------------------------------
const buildRegionResolver = () => {
  const aliases = loadJson(ALIASES);
  const inv = new Map();
  for (const [region, list] of Object.entries(aliases)) {
    inv.set(normKey(region), region);
    for (const a of list) inv.set(normKey(a), region);
  }
  return (greekRegion) => inv.get(normKey(greekRegion)) || null;
};

// Foreign region groups to drop (belt-and-suspenders alongside the bbox filter).
const FOREIGN_REGIONS = new Set(['daugavpils', 'ampoy ntampi', 'italia', 'kroatia', 'kypros', 'lozani', 'massa', 'vermpania']);

// ----------------------- FETCH MODE -------------------------------------------
const runFetch = async () => {
  const refresh = process.argv.includes('--refresh');
  mkdirSync(TMP_DIR, { recursive: true });
  if (!refresh && existsSync(cachePath())) {
    console.log(`Cache hit: ${path.relative(rootDir, cachePath())} (use --refresh to re-fetch). No network.`);
    return;
  }
  console.log(`Fetching ${ENDPOINT} ...`);
  let res;
  try {
    res = await fetchWithTimeout(ENDPOINT, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  } catch (e) {
    console.error(`Network error: ${e.message}. Endpoint may have changed — check ${BUNDLE_URL} for the surface path. Aborting (no partial seed written).`);
    process.exit(1);
  }
  if (res.status === 429 || res.status === 503) { console.error(`Rate limited (${res.status}). Try later.`); process.exit(1); }
  if (!res.ok) { console.error(`HTTP ${res.status}. Endpoint may have moved; inspect ${BUNDLE_URL}. Aborting (no partial seed).`); process.exit(1); }
  const raw = await res.text();
  let parsed;
  try { parsed = JSON.parse(raw); } catch { console.error('Response was not JSON — endpoint changed. Aborting.'); process.exit(1); }
  if (!Array.isArray(parsed) || parsed.length === 0) { console.error('Unexpected payload shape. Aborting (no seed written).'); process.exit(1); }
  await sleep(500);
  writeFileSync(cachePath(), raw, 'utf8');
  console.log(`Cached ${parsed.length} region groups -> ${path.relative(rootDir, cachePath())}`);
  console.log('Next: node scripts/scrapeSeatracDirectory.mjs build');
};

const loadLatestCache = () => {
  if (existsSync(cachePath())) return loadJson(cachePath());
  // fall back to the most recent cached file
  if (!existsSync(TMP_DIR)) return null;
  const files = readdirSync(TMP_DIR).filter((f) => f.startsWith('seatrac-getallregions.')).sort();
  return files.length ? loadJson(path.join(TMP_DIR, files[files.length - 1])) : null;
};

// flatten raw -> array of beach records (with their region group)
const flattenRaw = (raw) => {
  const out = [];
  for (const group of raw) for (const b of (group.Beaches || group.beaches || [])) out.push(b);
  return out;
};

const STATUS_MAP = {
  'Σε λειτουργία': 'online',
  'Προσωρινά ανενεργό': 'listed-unverified',
  'Απεγκατεστημένο': 'uninstalled',
};

// ----------------------- BUILD MODE -------------------------------------------
const runBuild = () => {
  const raw = loadLatestCache();
  if (!raw) { console.error('No cache. Run `fetch` first.'); process.exit(1); }
  const resolveRegion = buildRegionResolver();
  const v1 = loadJson(SEED_V1);
  const v1NotesByKey = new Map(v1.beaches.filter((r) => r.notes).map((r) => [normKey(r.nameGr), r.notes]));

  const all = flattenRaw(raw);
  const stats = { total: all.length, foreign: 0, uninstalled: 0, outOfBbox: 0, unmapped: [], kept: 0, byId: new Map() };

  const beaches = [];
  for (const b of all) {
    const [lat, lon] = Array.isArray(b.Coordinates) ? b.Coordinates : [undefined, undefined];
    const status = STATUS_MAP[b.StatusDictionary] || 'listed-unverified';

    // 1) foreign drop (region denylist OR outside Greece bbox)
    if (FOREIGN_REGIONS.has(normKey(b.Region))) { stats.foreign += 1; continue; }
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
        lat < GR_BBOX.latMin || lat > GR_BBOX.latMax || lon < GR_BBOX.lonMin || lon > GR_BBOX.lonMax) {
      stats.outOfBbox += 1; continue;
    }
    // 2) active-only: drop uninstalled (user decision)
    if (status === 'uninstalled') { stats.uninstalled += 1; continue; }
    // 3) region resolution (hard gate — never guess)
    const region = resolveRegion(b.Region);
    if (!region) { stats.unmapped.push({ name: b.Name, greekRegion: b.Region }); continue; }
    // 4) dedup by Id
    if (stats.byId.has(b.Id)) continue;
    stats.byId.set(b.Id, true);

    const f = b.Facilities || {};
    const amenity = (v) => (v === true ? 'yes' : 'unknown'); // conservative: false/missing -> unknown
    const row = {
      nameGr: b.Name,
      nameEn: greeklish(b.Name),
      region,
      municipality: b.Region,
      status,
      disabledParking: amenity(f.Parking),
      boardwalkToWater: amenity(f.Road),
      accessibleWc: amenity(f.Wc),
      changingRoom: amenity(f.ChangingRoom),
      shower: amenity(f.Shower),
      shade: amenity(f.Shade),
      sourceUrls: [b.Url ? `https://seatrac.gr${b.Url}` : 'https://seatrac.gr/'],
      lat, lon,
      seatracId: b.Id,
    };
    const notes = v1NotesByKey.get(normKey(b.Name));
    if (notes) row.notes = notes; // preserve hand-authored editorial context where names line up
    beaches.push(row);
    stats.kept += 1;
  }

  if (stats.unmapped.length) {
    console.error(`\n${stats.unmapped.length} UNMAPPED region(s) — add aliases to seatrac-region-aliases.json:`);
    console.error(JSON.stringify(stats.unmapped, null, 2));
    console.error('Aborting build (no seed written) — never guess a region.');
    process.exit(1);
  }

  const seed = {
    _meta: {
      source: 'seatrac.gr official directory (Umbraco GetAllRegions endpoint)',
      compiledDate: today(),
      authoritativeLiveSource: 'https://seatrac.gr/',
      notes: "SAFETY: needsVerification:true on import. status taken verbatim from the live site. amenities: Facilities.X===true => 'yes', otherwise 'unknown' (never 'no'). Active-only: 'Απεγκατεστημένο' (uninstalled) beaches dropped. Foreign installs dropped (Greece bbox). Coordinates carried so no-match rows insert without geocoding.",
      amenityKeys: AMENITY_KEYS,
      statusValues: ['online', 'uninstalled', 'listed-unverified'],
      counts: { rawTotal: stats.total, foreignDropped: stats.foreign, outOfBboxDropped: stats.outOfBbox, uninstalledDropped: stats.uninstalled, kept: stats.kept },
    },
    beaches,
  };
  writeFileSync(SEED_V2, JSON.stringify(seed, null, 2) + '\n', 'utf8');
  console.log(`Raw ${stats.total} | foreign ${stats.foreign} | out-of-bbox ${stats.outOfBbox} | uninstalled ${stats.uninstalled} | KEPT ${stats.kept}`);
  console.log(`Wrote -> ${path.relative(rootDir, SEED_V2)}`);
  console.log('Next: node scripts/scrapeSeatracDirectory.mjs report');
};

// ----------------------- REPORT MODE ------------------------------------------
const runReport = () => {
  if (!existsSync(SEED_V2)) { console.error('No seed-v2. Run `build` first.'); process.exit(1); }
  const v2 = loadJson(SEED_V2);
  const v1 = loadJson(SEED_V1);
  const data = loadJson(DATA);

  const v1Keys = new Set(v1.beaches.map((r) => normKey(r.nameGr)));
  const newInV2 = v2.beaches.filter((r) => !v1Keys.has(normKey(r.nameGr)));

  // already-annotated dataset beaches + their current status
  const annotated = [];
  for (const b of iterBeaches(data)) if (b.metadata?.seatrac) annotated.push({ id: b.id, name: b.name, status: b.metadata.seatrac.status, key: normKey(b.name) });

  // status comparison: v2 row name-matches an annotated beach with a different status
  const v2ByKey = new Map(v2.beaches.map((r) => [normKey(r.nameGr), r]));
  const statusFlips = [];
  for (const a of annotated) {
    const v2row = v2ByKey.get(a.key);
    if (v2row && v2row.status !== a.status) statusFlips.push({ id: a.id, name: a.name, datasetStatus: a.status, v2Status: v2row.status });
  }
  // annotated beaches NOT present in v2 active list (likely now uninstalled) — informational
  const annotatedDroppedFromV2 = annotated.filter((a) => !v2ByKey.has(a.key));

  const report = {
    _meta: { generatedAt: new Date().toISOString(), v2Count: v2.beaches.length, v1Count: v1.beaches.length, annotatedCount: annotated.length },
    newInV2: { count: newInV2.length, beaches: newInV2.map((r) => ({ nameGr: r.nameGr, region: r.region, status: r.status, lat: r.lat, lon: r.lon })) },
    statusFlips,
    annotatedNotInActiveV2: annotatedDroppedFromV2,
  };
  writeFileSync(V2_DIFF, JSON.stringify(report, null, 2) + '\n', 'utf8');
  console.log(`v2 active: ${v2.beaches.length} | new vs v1: ${newInV2.length} | status flips: ${statusFlips.length} | annotated-not-in-active-v2: ${annotatedDroppedFromV2.length}`);
  console.log(`Wrote -> ${path.relative(rootDir, V2_DIFF)}`);
};

const mode = process.argv[2];
if (mode === 'fetch') runFetch().catch((e) => { console.error(e); process.exit(1); });
else if (mode === 'build') runBuild();
else if (mode === 'report') runReport();
else { console.error('Usage: node scripts/scrapeSeatracDirectory.mjs <fetch|build|report> [--refresh]'); process.exit(1); }
