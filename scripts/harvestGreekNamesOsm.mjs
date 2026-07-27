// Recovers the GREEK name for beaches whose `name.gr` holds Latin text.
//
// 180 beaches show a Greek visitor a Latin string — "Falasarna" instead of
// Φαλάσαρνα, "Achlada" instead of Αχλάδα. They cannot be found by Greek search
// and they read as broken on a Greek-first site.
//
// IT DOES NOT TRANSLITERATE. Latin→Greek is not machine-recoverable (an "i" can
// be ι, η, υ, ει or οι; an "o" can be ο or ω), and a confidently wrong Greek
// spelling is worse than an honest English one. It asks OpenStreetMap, via
// Nominatim, what the place is actually called in Greek, and accepts the answer
// only when it romanises back to the name we already hold AND sits near our pin.
//
// WHY NOMINATIM AND NOT OVERPASS: Overpass was returning 504s across all three
// mirrors when this was written — two responses in ten minutes. Nominatim
// answers the same question in under a second, and a bounded forward search on a
// name we already know is a more precise question than "what is tagged near
// here" anyway (reverse geocoding a beach pin returns the nearest road).
//
// Business names — "Blue Dream", "Castello", "Lagonissi Grand Resort" — have no
// Greek form and are meant to stay Latin. They will not match, and land in the
// report's second table for a human to confirm.
//
// Run:  node scripts/harvestGreekNamesOsm.mjs [--limit N] [--apply]
// Without --apply nothing is written to the dataset, only the report.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleep } from './lib/placeResolution.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const indexPath = path.join(rootDir, 'public', 'data', 'beaches', 'index.json');
const cacheDir = path.join(rootDir, '.tmp', 'greek-names-nominatim');
const reportPath = path.join(rootDir, 'reports', 'greek-name-recovery.md');

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'calmbeach-name-recovery/1.0 (beach data quality)';
/** Nominatim's usage policy is max 1 request/second. Do not lower this. */
const REQUEST_INTERVAL_MS = 1100;
/** How far a candidate may sit from our pin. 3 km let a beach 3 km away win;
 * 1.2 km still tolerates a village centre naming its own beach. */
const MAX_MATCH_DISTANCE_M = 1200;

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i >= 0 ? Number(args[i + 1]) || Infinity : Infinity;
})();

const hasGreek = s => /[Ͱ-Ͽ]/.test(String(s || ''));

// Crude romanisation, used only to CONFIRM a candidate we already found by name —
// never to generate one. Collapses the spellings that differ by convention only.
const GREEK_TO_LATIN = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k',
  λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't',
  υ: 'i', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
const fold = value => String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/ch/g, 'h').replace(/th/g, 't').replace(/ps/g, 'p')
  .replace(/mp/g, 'b').replace(/nt/g, 'd').replace(/gk/g, 'g')
  .replace(/[^a-z0-9]/g, '');
const romanise = value => fold(String(value || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().split('').map(ch => GREEK_TO_LATIN[ch] ?? ch).join(''));

const distanceM = (aLat, aLon, bLat, bLon) => {
  const x = (bLon - aLon) * Math.cos(((aLat + bLat) / 2) * Math.PI / 180);
  const y = bLat - aLat;
  return Math.sqrt(x * x + y * y) * 111_320;
};

const readJsonIfExists = async p => { try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; } };

const searchNominatim = async (query, lat, lon) => {
  const d = 0.09; // ~10 km viewbox, bounded so we never match a namesake elsewhere
  const url = `${NOMINATIM}?q=${encodeURIComponent(query)}&format=jsonv2&namedetails=1`
    + `&accept-language=el&limit=8&bounded=1`
    + `&viewbox=${lon - d},${lat + d},${lon + d},${lat - d}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
};

// ---- collect targets ----
const idx = JSON.parse(await readFile(indexPath, 'utf8'));
const targets = [];
for (const region of idx.regions) {
  const rel = region.appDataPath || `/data/beaches/app/${region.id}.json`;
  const data = await readJsonIfExists(path.join(rootDir, 'public', rel));
  for (const beach of data?.island?.beaches || []) {
    const gr = beach.name?.gr || '';
    if (gr && !hasGreek(gr) && beach.coordinates) {
      targets.push({
        id: beach.id, latin: gr, en: beach.name?.en || '',
        region: data.island?.name?.gr || region.id,
        lat: beach.coordinates.lat, lon: beach.coordinates.lon,
      });
    }
  }
}
console.log(`[greek-names] ${targets.length} beaches have a Latin name.gr`);

await mkdir(cacheDir, { recursive: true });
const matched = [];
const unmatched = [];
const slice = targets.slice(0, LIMIT);

for (const [i, beach] of slice.entries()) {
  const cachePath = path.join(cacheDir, `${beach.id}.json`);
  let results = (await readJsonIfExists(cachePath))?.results;

  if (!results) {
    results = await searchNominatim(beach.latin, beach.lat, beach.lon);
    if (results) await writeFile(cachePath, JSON.stringify({ results }), 'utf8');
    await sleep(REQUEST_INTERVAL_MS);
  }
  if (!results) { unmatched.push({ ...beach, reason: 'nominatim unavailable' }); continue; }

  const want = fold(beach.latin);
  const wantEn = fold(beach.en);

  const hit = results
    .map(r => {
      const greek = r.namedetails?.['name:el'] || r.name;
      // `name:el` is not guaranteed to BE Greek — mappers put Latin in it. Without
      // this check the harvest "recovered" Klimataria Beach, komitsa and
      // Linaraki studios, i.e. it replaced Latin with Latin.
      if (!greek || !hasGreek(greek)) return null;
      const dist = distanceM(beach.lat, beach.lon, Number(r.lat), Number(r.lon));
      return { greek, dist, category: `${r.category}/${r.type}` };
    })
    .filter(Boolean)
    .filter(c => c.dist <= MAX_MATCH_DISTANCE_M)
    // A hotel, a shop, a bus stop or a bridge that borrows the beach's name is
    // not the beach. Without this the harvest returned "Γέφυρα Παντάνασσας" (a
    // bridge) and pulled Kalami's name off a bus stop.
    .filter(c => !/^(building|shop|tourism|amenity|office|leisure|highway|railway|man_made|barrier|waterway)\//.test(c.category))
    // Confirm it is the SAME name, not just a Greek place that happens to be near.
    .filter(c => {
      const rk = romanise(c.greek);
      return rk === want || rk === wantEn
        || (want.length >= 5 && (rk.includes(want) || want.includes(rk)));
    })
    .sort((a, b) => a.dist - b.dist)[0];

  if (hit) matched.push({ ...beach, greek: hit.greek, dist: Math.round(hit.dist), category: hit.category });
  else unmatched.push({ ...beach, reason: results.length ? 'no Greek name matched the Latin one' : 'not found nearby' });

  if ((i + 1) % 25 === 0) console.log(`  ...${i + 1}/${slice.length}  matched=${matched.length}`);
}

console.log(`[greek-names] matched ${matched.length}, unmatched ${unmatched.length}`);

const lines = [
  '# Ανάκτηση ελληνικών ονομάτων (OpenStreetMap / Nominatim)',
  '',
  `Παραλίες με λατινικό \`name.gr\`: **${targets.length}**`,
  `Βρέθηκε αυθεντικό ελληνικό όνομα: **${matched.length}**`,
  `Χωρίς αντιστοίχιση: **${unmatched.length}**`,
  '',
  'Καμία μεταγραφή δεν έγινε από εμάς. Το όνομα είναι αυτό που έχει γράψει ο',
  'χαρτογράφος στο OpenStreetMap, και γίνεται δεκτό μόνο όταν (α) ρωμανοποιημένο',
  `ταιριάζει με το λατινικό που ήδη έχουμε και (β) απέχει έως ${MAX_MATCH_DISTANCE_M / 1000} χλμ από το pin μας.`,
  '',
  'Το αγγλικό όνομα και το slug ΔΕΝ αλλάζουν — μόνο η ελληνική ετικέτα και τα',
  'search aliases. Κανένα URL δεν μετακινείται.',
  '',
  '## Βρέθηκαν',
  '',
  '| id | τώρα | ελληνικό | απόσταση | τύπος OSM | περιοχή |',
  '|---|---|---|---|---|---|',
  ...matched.map(m => `| ${m.id} | ${m.latin} | **${m.greek}** | ${m.dist} m | ${m.category} | ${m.region} |`),
  '',
  '## Χωρίς αντιστοίχιση',
  '',
  'Πολλά είναι εμπορικές ονομασίες χωρίς ελληνική μορφή («Blue Dream», «Castello»,',
  '«Lagonissi Grand Resort») και σωστά μένουν λατινικά. Θέλουν ανθρώπινο μάτι.',
  '',
  '| id | όνομα | περιοχή | αιτία |',
  '|---|---|---|---|',
  ...unmatched.map(u => `| ${u.id} | ${u.latin} | ${u.region} | ${u.reason} |`),
  '',
];
await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, lines.join('\n'), 'utf8');
console.log(`[greek-names] report -> ${path.relative(rootDir, reportPath)}`);

if (!APPLY) {
  console.log('[greek-names] dry run. Re-run with --apply to write nameGr into greek_beaches.json.');
  process.exit(0);
}

// `nameGr` is an ADDITIVE field: buildBeachRegionData.mjs uses it for name.gr and
// for search aliases only. `name` — and therefore the English label, the slug and
// every prerendered URL — is left exactly as it was.
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const byId = new Map(matched.map(m => [m.id, m.greek]));
let applied = 0;
const walk = node => {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item.id === 'number' && byId.has(item.id)) {
        item.nameGr = byId.get(item.id);
        applied += 1;
      }
    }
    return;
  }
  if (node && typeof node === 'object') for (const key of Object.keys(node)) walk(node[key]);
};
walk(source);
await writeFile(sourcePath, JSON.stringify(source, null, 2), 'utf8');
console.log(`[greek-names] applied ${applied} Greek names — now run: npm run build:beach-data`);
