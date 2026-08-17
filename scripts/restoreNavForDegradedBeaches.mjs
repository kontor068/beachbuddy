#!/usr/bin/env node
/**
 * ΤΟ ΚΟΥΜΠΙ «ΟΔΗΓΙΕΣ» ΠΟΥ ΔΕΝ ΞΑΝΑΓΥΡΙΖΕΙ ΠΟΤΕ — 101 ΠΑΡΑΛΙΕΣ ΕΘΝΙΚΑ (17/08/2026)
 *
 * ΤΙ ΣΥΜΒΑΙΝΕΙ. Όταν το auditPlaceResolution.mjs δεν καταφέρει να λύσει το όνομα μιας παραλίας,
 * γράφει `status: 'needs-review'` σε place mode. Το utils/navigation.ts το μεταφράζει σε «δες
 * στον χάρτη» ΧΩΡΙΣ κουμπί οδηγιών — ο επισκέπτης δεν έχει τρόπο να πάει.
 *
 * ΚΑΙ ΜΕΝΕΙ ΕΤΣΙ ΓΙΑ ΠΑΝΤΑ. Ο ίδιος έλεγχος δεν τις ξανακοιτάζει: το `usesPlaceQuery` επιστρέφει
 * `false` για `needs-review` (scripts/lib/placeResolution.mjs). Στη Χαλκιδική, ένα πέρασμα 88
 * παραλιών στις 17/08 ΔΕΝ άγγιξε καμία από τις 9 που είχαν χάσει το κουμπί τους. Είναι παγίδα
 * μονής κατεύθυνσης: κατεβαίνεις, δεν ανεβαίνεις.
 *
 * ΤΟ ΣΩΣΤΟ ΕΡΩΤΗΜΑ ΔΕΝ ΕΙΝΑΙ ΤΟ ΟΝΟΜΑ. Οι οδηγίες με ΣΥΝΤΕΤΑΓΜΕΝΗ δεν χρειάζονται όνομα που να
 * λύνεται στη Google — χρειάζονται σωστή πινέζα. Άρα η ερώτηση είναι «επιβεβαιώνει ο OSM ότι εκεί
 * υπάρχει παραλία;», που είναι ακριβώς η ερώτηση του ελέγχου πινέζας. Αν ναι, η παραλία παίρνει
 * `verified` σε coordinates mode και το κουμπί επιστρέφει — δείχνοντας τη δική της πινέζα, όχι
 * ένα όνομα που η Google μπερδεύει.
 *
 * ΤΙ ΔΕΝ ΚΑΝΕΙ: δεν αγγίζει παραλίες με placeId (δουλεύουν ήδη καλύτερα), ούτε παραλίες μόνο με
 * βάρκα (εκεί η απουσία διαδρομής είναι ο κανόνας ασφαλείας, όχι βλάβη), ούτε ανεβάζει καμία
 * παραλία που ο OSM δεν επιβεβαιώνει.
 *
 * Χρήση:  node scripts/restoreNavForDegradedBeaches.mjs [--regions a,b] [--radius 350] [--write]
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchOverpassBeaches, distanceMeters, sleep } from './lib/placeResolution.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachDir = path.join(rootDir, 'public', 'data', 'beaches');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const RADIUS = Number(arg('--radius', 350));
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));
const OUT = arg('--json', path.join('reports', 'place-resolution', `nav-restore-${STAMP}.json`));
const regionFilter = String(arg('--regions', '')).split(',').map((s) => s.trim()).filter(Boolean);

// The same distance the place-resolution audit uses to call a pin OSM-corroborated.
const PIN_OK_M = 350;

const BOAT = new Set(['boat_only', 'boat_or_difficult_path']);
const isDegraded = (m) => {
  const nav = m.googleMapsNavigation || {};
  if (BOAT.has(m.access?.type)) return false;
  if (nav.placeId) return false;
  return nav.status === 'blocked' || nav.status === 'unresolved'
    || (nav.status === 'needs-review' && nav.mode !== 'coordinates');
};

const targets = [];
for (const file of readdirSync(beachDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  const regionId = file.replace(/\.json$/, '');
  if (regionFilter.length && !regionFilter.includes(regionId)) continue;
  let beaches;
  try { beaches = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')); } catch { continue; }
  if (!Array.isArray(beaches)) continue;
  for (const b of beaches) {
    if (isDegraded(b.metadata || {})) targets.push({ id: Number(b.id), name: b.name, regionId, lat: b.lat, lon: b.lon });
  }
}

console.log(`${targets.length} παραλίες χωρίς κουμπί «Οδηγίες»${regionFilter.length ? ` σε ${regionFilter.length} περιοχές` : ' εθνικά'}`);

const results = [];
for (const b of targets) {
  const places = await fetchOverpassBeaches({ lat: b.lat, lon: b.lon }, RADIUS);
  if (places === null) {
    results.push({ ...b, verdict: 'RETRY', reason: 'Overpass δεν απάντησε' });
  } else {
    const near = places
      .map((p) => ({ name: p.displayName?.text, distM: Math.round(distanceMeters({ lat: b.lat, lon: b.lon }, { lat: p.location.latitude, lon: p.location.longitude })) }))
      .filter((p) => p.distM <= PIN_OK_M)
      .sort((a, z) => a.distM - z.distM);
    if (near.length) {
      results.push({ ...b, verdict: 'RESTORE', navMode: 'coordinates', status: 'verified',
        evidence: `OSM «${near[0].name}» στα ${near[0].distM} m — η πινέζα επιβεβαιώνεται, άρα οι οδηγίες με συντεταγμένη είναι έγκυρες` });
    } else {
      results.push({ ...b, verdict: 'KEEP', reason: `κανένα σημείο παραλίας του OSM σε ${RADIUS} m — η πινέζα δεν επιβεβαιώνεται` });
    }
  }
  console.log(`  ${results.at(-1).verdict.padEnd(8)} #${b.id} ${b.name} — ${results.at(-1).evidence || results.at(-1).reason}`);
  await sleep(1200);
}

const restore = results.filter((r) => r.verdict === 'RESTORE');
if (write && restore.length) {
  const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
  const byId = new Map(restore.map((r) => [r.id, r]));
  let applied = 0;
  (function walk(node) {
    if (Array.isArray(node)) { for (const it of node) walk(it); return; }
    if (!node || typeof node !== 'object') return;
    const row = byId.get(Number(node.id));
    if (row && node.metadata) {
      node.metadata.googleMapsNavigation = {
        status: 'verified',
        mode: 'coordinates',
        checkedAt: STAMP,
        method: 'osm-pin-corroboration-v1',
        reason: row.evidence,
      };
      applied += 1;
    }
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  })(source);
  writeFileSync(sourcePath, JSON.stringify(source, null, 2) + '\n', 'utf8');
  console.log(`\nγράφτηκαν ${applied} στο public/greek_beaches.json`);
}

const outPath = path.isAbsolute(OUT) ? OUT : path.join(rootDir, OUT);
mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), radiusM: RADIUS, results }, null, 2) + '\n', 'utf8');
const counts = {};
for (const r of results) counts[r.verdict] = (counts[r.verdict] || 0) + 1;
console.log(`\n${JSON.stringify(counts)}${write ? '' : ' — ξανατρέξε με --write'}\n→ ${path.relative(rootDir, outPath)}`);
