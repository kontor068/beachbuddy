#!/usr/bin/env node
/**
 * ΨΗΝΕΙ ΤΟΝ ΧΑΡΤΗ «ΠΟΙΟ ΚΕΛΙ ΝΕΡΟΥ ΜΙΛΑΕΙ ΓΙΑ ΚΑΘΕ ΠΑΡΑΛΙΑ».
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Το στρώμα ανέμου πάνω από νερό (PORISMA §Γ37β) διαβάζει τη ΔΙΕΥΘΥΝΣΗ και,
 * από 25/08/2026, την ΤΑΧΥΤΗΤΑ (§Γ51/§Γ52) από το κελί θάλασσας μπροστά στην παραλία. Ο πελάτης δεν
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
/**
 * `--apply-overrides` (Δ9-Α, 13/09/2026): ΧΩΡΙΣ δίκτυο, ξαναγράφει τον υπάρχοντα χάρτη με τις εξαιρέσεις του
 * `data/sea-wind-cell-overrides.json` — 98 παραλίες που το κελί τους κάθεται πίσω από βουνό ≥200 μ.
 * (βίβλος §Γ81 Δ9-Β) παίρνουν το κελί που «βλέπουν» (findSeaWindCellAlternatives.mjs). Γιατί όχι πλήρες
 * ψήσιμο: δύο παραλίες βγήκαν από τα δεδομένα μετά τις 25/08 και ένα πλήρες ψήσιμο θα έγραφε 1.831 αντί
 * για τις 1.833 που καρφώνει το εγχειρίδιο· εδώ το πλήθος μένει ό,τι ήταν. Το πλήρες ψήσιμο διαβάζει ΚΙ
 * ΑΥΤΟ το ledger (μετά την ανίχνευση, ώστε να φαίνεται αν η πόρτα άλλαξε γνώμη για το αποκλεισμένο κελί).
 */
const APPLY_OVERRIDES = process.argv.includes('--apply-overrides');
const LEDGER = path.join(root, 'data/sea-wind-cell-overrides.json');
const PACE_MS = 13000;
const CHUNK = 100;

/**
 * Η πύλη. Κάτω από αυτό το στεριανό κελί κάθεται ουσιαστικά πάνω στην παραλία και το §Γ29 δεν
 * βρήκε κανένα κέρδος από τη θάλασσα — μάλιστα στην ΤΑΧΥΤΗΤΑ η στεριά ήταν σταθερά καλύτερη.
 * Πάνω από την πύλη κερδίζουν ΚΑΙ η διεύθυνση (§Γ29) ΚΑΙ η ταχύτητα (§Γ51/§Γ52, 3-5 χλμ
 * μετρημένα, ≥5 προέκταση) — γι' αυτό ο ίδιος χάρτης οδηγεί και τα δύο.
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

/** Το ledger των εξαιρέσεων (Δ9-Α). `null` όταν δεν υπάρχει — τότε το ψήσιμο είναι ακριβώς το παλιό. */
const readLedger = () => {
  if (!fs.existsSync(LEDGER)) return null;
  const ledger = JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
  return {
    overrides: Array.isArray(ledger.overrides) ? ledger.overrides : [],
    unresolved: Array.isArray(ledger.unresolved) ? ledger.unresolved : [],
    generatedAt: ledger.generatedAt ?? null,
  };
};

/** Τι ΔΕΝ στέκει ανάμεσα σε έναν χάρτη και στο ledger — ίδια λίστα με το τμήμα Η της πύλης. */
const ledgerProblems = (cells, ledger) => {
  const out = [];
  for (const o of ledger.overrides) {
    const id = String(o.beachId);
    if (!cells[id]) out.push(`#${id}: στο ledger αλλά όχι στον χάρτη`);
    else if (cells[id] === o.excludedCell) out.push(`#${id}: ψημένο στο αποκλεισμένο κελί ${o.excludedCell}`);
    else if (cells[id] !== o.chosenCell) out.push(`#${id}: ψημένο στο ${cells[id]}, το ledger λέει ${o.chosenCell}`);
  }
  for (const u of ledger.unresolved) {
    const id = String(u.beachId);
    if (cells[id] && u.keptCell && cells[id] !== u.keptCell) out.push(`#${id}: unresolved αλλά ψημένο στο ${cells[id]} ≠ ${u.keptCell}`);
  }
  return out;
};

/**
 * Εφαρμόζει το ledger πάνω στον χάρτη (στη μνήμη). ΑΝΑ ΠΑΡΑΛΙΑ — τα 98 μοιράζονται 47 κελιά με 82 άλλες
 * παραλίες που ο έλεγχος βρήκε καθαρές, και εκείνες δεν αγγίζονται. Ποτέ δεν προσθέτει παραλία που δεν
 * πέρασε την πύλη των 3 χλμ (κανόνας 1 της κεφαλίδας). Αν η πόρτα δίνει πια ΑΛΛΟ κελί από το
 * αποκλεισμένο, το λέει («drift») — το ledger γράφτηκε απέναντι σε συγκεκριμένη απάντηση της πόρτας.
 */
const applyLedger = (cells, ledger, gatedById) => {
  let applied = 0;
  const skipped = [];
  const drift = [];
  for (const o of ledger.overrides) {
    const id = String(o.beachId);
    if (gatedById && !gatedById.has(id)) { skipped.push(`#${id} κάτω από την πύλη`); continue; }
    if (!cells[id]) { skipped.push(`#${id} όχι στον χάρτη`); continue; }
    if (cells[id] !== o.excludedCell && cells[id] !== o.chosenCell) drift.push(`#${id}: η πόρτα δίνει πια ${cells[id]} (ledger: ${o.excludedCell} → ${o.chosenCell})`);
    cells[id] = o.chosenCell;
    applied += 1;
  }
  for (const s of skipped) console.warn(`  ledger: παραλείπεται ${s}`);
  for (const d of drift) console.warn(`  ledger: ${d}`);
  return {
    summary: { path: path.relative(root, LEDGER), ledgerGeneratedAt: ledger.generatedAt, applied, unresolved: ledger.unresolved.length, skipped: skipped.length, drift: drift.length },
    skipped, drift,
  };
};

/** Διακριτά κελιά και απόσταση παραλίας→κελιού, από τον τελικό χάρτη (μετά το ledger). */
const summarise = (cells, byId) => {
  const distinct = new Set();
  const perBeach = [];
  for (const [id, key] of Object.entries(cells)) {
    distinct.add(key);
    const b = byId.get(id);
    if (!b) continue;
    const [lat, lon] = key.split('_').map(Number);
    perBeach.push({ id: b.id, seaCellDistKm: Number(distKm(b.lat, b.lon, lat, lon).toFixed(2)) });
  }
  return { distinct, perBeach };
};

const beaches = readBeaches();
console.log(`Παραλίες με ψημένο στεριανό κελί: ${beaches.length.toLocaleString('el-GR')}`);

if (APPLY_OVERRIDES) {
  // Χειρουργικά, χωρίς δίκτυο: ο υπάρχων χάρτης ΕΙΝΑΙ η πύλη (όποιος είναι μέσα, πέρασε τα 3 χλμ όταν
  // ψήθηκε)· εδώ αλλάζει μόνο ΠΟΥ δείχνουν οι παραλίες του ledger. Πλήθος, gateKm και generatedAt μένουν.
  const ledger = readLedger();
  if (!ledger) { console.error(`Δεν υπάρχει ${path.relative(root, LEDGER)} — τρέξε scripts/findSeaWindCellAlternatives.mjs --write`); process.exit(1); }
  if (!fs.existsSync(OUT)) { console.error('Δεν υπάρχει ψημένος χάρτης — τρέξε πρώτα πλήρες ψήσιμο.'); process.exit(1); }
  const { cells: oldCells, ...head } = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const cells = { ...(oldCells || {}) };
  const result = applyLedger(cells, ledger, null);
  const problems = ledgerProblems(cells, ledger);
  if (problems.length) { problems.forEach(p => console.error(`FAILED: ${p}`)); process.exit(1); }
  const { distinct, perBeach } = summarise(cells, new Map(beaches.map(b => [String(b.id), b])));
  const dists = perBeach.map(p => p.seaCellDistKm).sort((a, b) => a - b);
  fs.writeFileSync(OUT, `${JSON.stringify({
    ...head,
    beachCount: Object.keys(cells).length,
    distinctCells: distinct.size,
    seaCellDistanceKm: { median: dists[Math.floor(dists.length / 2)], max: dists[dists.length - 1] },
    overrides: { ...result.summary, appliedAt: new Date().toISOString() },
    cells,
  }, null, 2)}\n`);
  console.log(`Γράφτηκε ${path.relative(root, OUT)} με ${result.summary.applied} εξαιρέσεις (${result.summary.unresolved} κρατούν το παλιό κελί):`
    + ` ${Object.keys(cells).length} παραλίες, ${distinct.size} διακριτά κελιά (διάμεσος ${dists[Math.floor(dists.length / 2)]} χλμ, μέγιστη ${dists[dists.length - 1]}).`);
  process.exit(0);
}

const cachedAll = readCachedSeaRows(beaches.length);
const gated = beaches.filter(b => b.landCellDistKm >= GATE_KM);
console.log(`Περνούν την πύλη των ${GATE_KM} χλμ: ${gated.length.toLocaleString('el-GR')}`
  + ` (${(100 * gated.length / beaches.length).toFixed(1)}%)`);

const seaRows = cachedAll
  ? beaches.map((b, i) => (b.landCellDistKm >= GATE_KM ? cachedAll[i] : null)).filter(Boolean)
  : await probeSeaCells(gated);
if (seaRows.length !== gated.length) throw new Error(`Ασυμφωνία: ${seaRows.length} απαντήσεις για ${gated.length} παραλίες`);

const cells = {};
gated.forEach((b, i) => {
  const r = seaRows[i];
  const lat = r?.latitude, lon = r?.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
  cells[String(b.id)] = `${lat}_${lon}`;
});
// Δ9-Α: οι εξαιρέσεις ΜΕΤΑ την ανίχνευση — τα 98 ανιχνεύονται κανονικά (98 σημεία, κανένα επιπλέον
// αίτημα) ώστε να φανεί αν η πόρτα άλλαξε γνώμη για το αποκλεισμένο κελί, και μετά ξαναδείχνουν.
const gatedById = new Map(gated.map(b => [String(b.id), b]));
const ledger = readLedger();
const ledgerResult = ledger ? applyLedger(cells, ledger, gatedById) : null;
const { distinct, perBeach } = summarise(cells, gatedById);

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
    // Δ9-Α: ο ψημένος χάρτης πρέπει να σέβεται το ledger — κάθε εξαίρεση στο επιλεγμένο κελί, κάθε unresolved στο παλιό.
    if (ledger) for (const p of ledgerProblems(baked.cells || {}, ledger)) failures.push(`ledger ${p}`);
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
  purpose: 'Το κελί νερού που δίνει ΔΙΕΥΘΥΝΣΗ (PORISMA §Γ29/§Γ37β, 20/08/2026) ΚΑΙ ΤΑΧΥΤΗΤΑ (§Γ51/§Γ52 — sea-cell-speed-by-distance 2026-06-25_07-15 + 2026-07-31_08-21, sea-cell-production-21d· απόφαση Μίλτου 25/08/2026) ανέμου σε κάθε παραλία με στεριανό κελί ≥3 χλμ. Η ριπή μένει στο στεριανό κελί.',
  gateKm: GATE_KM,
  beachCount: Object.keys(cells).length,
  beachesBelowGate: beaches.length - gated.length,
  distinctCells: distinct.size,
  seaCellDistanceKm: { median: dists[Math.floor(dists.length / 2)], max: dists[dists.length - 1] },
  ...(ledgerResult ? { overrides: { ...ledgerResult.summary, appliedAt: new Date().toISOString() } } : {}),
  cells,
}, null, 2)}\n`);
console.log(`Γράφτηκε ${path.relative(root, OUT)}: ${Object.keys(cells).length} παραλίες, ${distinct.size} διακριτά κελιά θάλασσας`
  + ` (διάμεσος απόσταση ${dists[Math.floor(dists.length / 2)]} χλμ, μέγιστη ${dists[dists.length - 1]}).`);
