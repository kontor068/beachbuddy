#!/usr/bin/env node
/**
 * ΨΗΝΕΙ ΤΟΝ ΧΑΡΤΗ «ΠΟΙΟ ΚΕΛΙ ΝΕΡΟΥ ΜΙΛΑΕΙ ΓΙΑ ΚΑΘΕ ΠΑΡΑΛΙΑ».
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το στρώμα ανέμου πάνω από νερό (PORISMA §Γ37β) διαβάζει τη ΔΙΕΥΘΥΝΣΗ από το
 * κελί θάλασσας μπροστά στην παραλία, ενώ η ταχύτητα μένει στο στεριανό κελί. Ο πελάτης δεν
 * μπορεί να ανακαλύψει μόνος του ποιες συντεταγμένες να ζητήσει — το `cell_selection=sea`
 * περπατάει μοντέλο-συγκεκριμένα μέχρι να βρει νερό, ακριβώς όπως το `land` — οπότε η
 * αντιστοίχιση ψήνεται εδώ, μία φορά, όπως και το `data/forecast-cells.generated.json`.
 *
 * ΔΥΟ ΚΑΝΟΝΕΣ ΠΟΥ ΔΕΝ ΔΙΑΠΡΑΓΜΑΤΕΥΟΝΤΑΙ:
 *
 *   1. **Η ΠΥΛΗ ΤΩΝ 3 ΧΛΜ ΕΙΝΑΙ ΕΔΩ, ΟΧΙ ΣΤΗ ΜΗΧΑΝΗ.** Παραλία με στεριανό κελί κάτω από
 *      3 χλμ ΔΕΝ μπαίνει στο αρχείο, άρα δεν μπορεί να διορθωθεί όσο κι αν το θέλει κάποιος
 *      κώδικας παρακάτω. Το §Γ29 μέτρησε ότι κάτω από 3 χλμ η στεριά δεν χάνει (ισοπαλία στον
 *      τομέα, και ΚΕΡΔΙΖΕΙ στην ταχύτητα), άρα εκεί η διόρθωση δεν έχει μάρτυρα. Αν αύριο
 *      αποφασιστεί άλλη πύλη, αλλάζει ΕΝΑΣ αριθμός και ξαναψήνεται — δρόμος επιστροφής.
 *
 *   2. **ΕΝΑ ΚΕΛΙ ΔΕΝ ΜΙΛΑΕΙ ΓΙΑ ΠΑΡΑΛΙΑ ΠΟΥ ΚΑΘΕΤΑΙ ΣΕ ΑΛΛΟ.** Ίδιος κανόνας με το
 *      `bakeForecastModelCells.mjs`. Μετρήθηκε 20/08/2026: αν επιβάλουμε ΕΝΑ κελί θάλασσας ανά
 *      ομάδα πρόγνωσης (για να γλιτώσουμε κλήσεις), ο τομέας βγαίνει λάθος στο **13,9%** των
 *      ωρών — ίδια τάξη μεγέθους με το σφάλμα που το στρώμα υπάρχει για να διορθώσει. Το ίδιο
 *      και με χοντρότερο πλέγμα (0,125° → 12,1%). Δηλαδή δεν υπάρχει φθηνή εκδοχή: όσα κελιά
 *      βγουν, τόσα.
 *
 * ΕΙΝΑΙ ΕΙΣΟΔΟΣ BUILD, ΟΧΙ ΣΕΡΒΙΡΙΣΜΕΝΟ ΑΡΧΕΙΟ — ζει στο `data/`, δίπλα στο
 * `forecast-cells.generated.json`, και ό,τι χρειάζεται ο πελάτης το παίρνει μέσω του build.
 *
 *   node scripts/bakeSeaWindCells.mjs            ψήνει (χρησιμοποιεί το .tmp αν ταιριάζει)
 *   node scripts/bakeSeaWindCells.mjs --verify   ελέγχει ότι ο ψημένος χάρτης δεν έχει μπαγιατέψει
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERIFY = process.argv.includes('--verify');
const PACE_MS = 13000;
const CHUNK = 100;

/**
 * Η πύλη. Κάτω από αυτό το στεριανό κελί κάθεται ουσιαστικά πάνω στην παραλία και το §Γ29 δεν
 * βρήκε κανένα κέρδος από τη θάλασσα — μάλιστα στην ΤΑΧΥΤΗΤΑ η στεριά ήταν σταθερά καλύτερη.
 */
const GATE_KM = 3;

const OUT = path.join(root, 'data/forecast-sea-cells.generated.json');
const appDir = path.join(root, 'public/data/beaches/app');

const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Η ΑΠΑΡΙΘΜΗΣΗ ΕΙΝΑΙ ΣΥΜΒΟΛΑΙΟ. Το `.tmp` κρύβει απαντήσεις σε σειρά αιτήματος και τίποτα μέσα
 * τους δεν λέει ΠΟΙΑ παραλία ρώτησε — μόνο ποιο κελί απάντησε. Οπότε η σειρά εδώ πρέπει να είναι
 * ίδια με του `measureCellDirectionColourImpact.mjs`, και ο έλεγχος πλήθους παρακάτω είναι το
 * μόνο πράγμα που στέκεται ανάμεσα σε «διάβασα την κρυφή μνήμη» και «έδωσα σε 2.872 παραλίες
 * το κελί της διπλανής».
 */
const readBeaches = () => {
  const bakedLand = JSON.parse(fs.readFileSync(path.join(root, 'data/forecast-cells.generated.json'), 'utf8')).cells;
  const out = [];
  for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
    let payload;
    try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
    for (const beach of payload.island?.beaches || []) {
      const lat = beach.coordinates?.lat, lon = beach.coordinates?.lon;
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      const cell = beach.forecastCell || bakedLand[String(beach.id)];
      if (!cell) continue;
      const [cLat, cLon] = cell.split('_').map(Number);
      out.push({
        id: beach.id,
        name: beach.name?.gr || beach.name?.en || `#${beach.id}`,
        region: rf.replace(/\.json$/, ''),
        lat, lon, landCell: cell,
        // ΑΣΤΡΟΓΓΥΛΕΥΤΗ. Η πύλη κρίνει με ΑΥΤΟ τον αριθμό· το `toFixed(2)` είναι για τα μάτια.
        // Στρογγυλεμένη, μια παραλία στα 2,995 χλμ γινόταν 3,00 και έμπαινε στον χάρτη ενώ η
        // πύλη ποιότητας —που μετράει σωστά— την έβλεπε απ' έξω. Πέντε παραλίες, 20/08/2026.
        landCellDistKm: distKm(lat, lon, cLat, cLon),
      });
    }
  }
  return out;
};

const fetchJson = async (url, tries = 5) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120000) });
      if (res.status === 429) { await sleep(65000); throw new Error('HTTP 429'); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(3000 * (i + 1));
    }
  }
};

/** Ζητάει το ΦΘΗΝΟΤΕΡΟ δυνατό: ένα μόνο πεδίο, μία μέρα. Μας νοιάζει μόνο ΠΟΙΟ κελί απαντάει. */
const probeSeaCells = async points => {
  const out = [];
  for (let i = 0; i < points.length; i += CHUNK) {
    const c = points.slice(i, i + CHUNK);
    if (i) await sleep(PACE_MS);
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${c.map(p => p.lat.toFixed(4)).join(',')}`
      + `&longitude=${c.map(p => p.lon.toFixed(4)).join(',')}`
      + '&hourly=wind_direction_10m&forecast_days=1&timezone=Europe%2FAthens&cell_selection=sea';
    const res = await fetchJson(url);
    const rows = Array.isArray(res) ? res : [res];
    if (rows.length !== c.length) throw new Error(`Το endpoint γύρισε ${rows.length} για ${c.length} σημεία`);
    out.push(...rows);
    process.stdout.write(`\r  θάλασσα: ${out.length}/${points.length}   `);
  }
  process.stdout.write('\n');
  return out;
};

/** Η κρυφή μνήμη της μέτρησης έχει ΤΙΣ ΙΔΙΕΣ απαντήσεις· αν ταιριάζει το πλήθος, τη δανειζόμαστε. */
const readCachedSeaRows = expectedCount => {
  const dir = path.join(root, '.tmp');
  if (!fs.existsSync(dir)) return null;
  const f = fs.readdirSync(dir).filter(x => x.startsWith('cell-dir-sea-')).sort().pop();
  if (!f) return null;
  try {
    const rows = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!Array.isArray(rows) || rows.length !== expectedCount) return null;
    console.log(`  θάλασσα: από την κρυφή μνήμη της μέτρησης (.tmp/${f})`);
    return rows;
  } catch { return null; }
};

const beaches = readBeaches();
console.log(`Παραλίες με ψημένο στεριανό κελί: ${beaches.length.toLocaleString('el-GR')}`);

const cachedAll = readCachedSeaRows(beaches.length);
const gated = beaches.filter(b => b.landCellDistKm >= GATE_KM);
console.log(`Περνούν την πύλη των ${GATE_KM} χλμ: ${gated.length.toLocaleString('el-GR')}`
  + ` (${(100 * gated.length / beaches.length).toFixed(1)}%)`);

const seaRows = cachedAll
  ? beaches.map((b, i) => (b.landCellDistKm >= GATE_KM ? cachedAll[i] : null)).filter(Boolean)
  : await probeSeaCells(gated);
if (seaRows.length !== gated.length) throw new Error(`Ασυμφωνία: ${seaRows.length} απαντήσεις για ${gated.length} παραλίες`);

const cells = {};
const distinct = new Set();
const perBeach = [];
gated.forEach((b, i) => {
  const r = seaRows[i];
  const lat = r?.latitude, lon = r?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  const key = `${lat}_${lon}`;
  cells[String(b.id)] = key;
  distinct.add(key);
  perBeach.push({ id: b.id, seaCellDistKm: Number(distKm(b.lat, b.lon, lat, lon).toFixed(2)) });
});

if (VERIFY) {
  const failures = [];
  if (!fs.existsSync(OUT)) failures.push('ΔΕΝ ΥΠΑΡΧΕΙ ο ψημένος χάρτης — τρέξε `node scripts/bakeSeaWindCells.mjs`');
  else {
    const baked = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const missing = gated.filter(b => !baked.cells?.[String(b.id)]);
    const extra = Object.keys(baked.cells || {}).filter(id => !cells[id]);
    if (baked.gateKm !== GATE_KM) failures.push(`η πύλη άλλαξε: ψημένη ${baked.gateKm}, κώδικας ${GATE_KM}`);
    if (missing.length) failures.push(`${missing.length} παραλίες περνούν την πύλη αλλά λείπουν, π.χ. ${missing.slice(0, 3).map(b => b.name).join(', ')}`);
    if (extra.length) failures.push(`${extra.length} παραλίες στο αρχείο δεν περνούν πια την πύλη, π.χ. ${extra.slice(0, 3).join(', ')}`);
  }
  if (failures.length) { failures.forEach(f => console.error(`FAILED: ${f}`)); process.exit(1); }
  console.log(`OK: ο ψημένος χάρτης καλύπτει ${gated.length} παραλίες σε ${distinct.size} κελιά θάλασσας.`);
  process.exit(0);
}

const dists = perBeach.map(p => p.seaCellDistKm).sort((a, b) => a - b);
fs.writeFileSync(OUT, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  source: 'Open-Meteo /v1/forecast cell_selection=sea',
  purpose: 'Το κελί νερού που δίνει τη ΔΙΕΥΘΥΝΣΗ ανέμου σε κάθε παραλία. Η ταχύτητα μένει στο στεριανό κελί — PORISMA §Γ29/§Γ37β.',
  gateKm: GATE_KM,
  beachCount: Object.keys(cells).length,
  beachesBelowGate: beaches.length - gated.length,
  distinctCells: distinct.size,
  seaCellDistanceKm: { median: dists[Math.floor(dists.length / 2)], max: dists[dists.length - 1] },
  cells,
}, null, 2)}\n`);
console.log(`Γράφτηκε ${path.relative(root, OUT)}: ${Object.keys(cells).length} παραλίες, ${distinct.size} διακριτά κελιά θάλασσας`
  + ` (διάμεσος απόσταση ${dists[Math.floor(dists.length / 2)]} χλμ, μέγιστη ${dists[dists.length - 1]}).`);
