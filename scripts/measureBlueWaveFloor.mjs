/**
 * ΠΟΣΕΣ «ΙΔΑΝΙΚΕΣ» ΕΧΟΥΝ ΚΥΜΑ ΠΟΥ Ο ΙΔΙΟΣ Ο ΧΑΡΤΗΣ ΤΥΠΩΝΕΙ ΑΠΟ ΚΑΤΩ;
 *
 * ΤΙ ΖΗΤΗΘΗΚΕ (Μίλτος, 16/08/2026): «Παραλία Αχαράβης, 3 Μποφόρ, 0,5 μ. κύμα, βγαίνει ΙΔΑΝΙΚΗ —
 * γιατί;» Απάντηση από τον κώδικα: το κύμα δεν έχει καμία ψήφο στο χρώμα κάτω από
 * SEA_STATE_AMBER_M (0,80 μ.), ενώ η ίδια οθόνη λέει δύο πράγματα — το υπόμνημα «ήρεμο νερό»,
 * η κάρτα «λίγο κύμα 0,5 μ.». Και μέσα στον κώδικα υπάρχουν ΔΥΟ νούμερα για την ίδια έννοια:
 * `swimmingComfortForWave` (services/recommendationService.ts) θέλει <0,40 μ. για να πει
 * «excellent», το χρώμα δέχεται μέχρι 0,79 μ.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ, ΠΡΙΝ ΑΛΛΑΞΕΙ ΟΤΙΔΗΠΟΤΕ: αν μπει δάπεδο κύματος στο ΜΠΛΕ — «καμία
 * ΙΔΑΝΙΚΗ πάνω από X μέτρα, πέφτει σε ΚΑΛΗ» — πόσες παραλίες αλλάζουν χρώμα, σε πόσες περιοχές,
 * και σε πόσες οθόνες εξαφανίζεται εντελώς το μπλε. Μηδέν UI, μηδέν αλλαγή κανόνα.
 *
 * ΤΟ ΝΟΥΜΕΡΟ ΠΟΥ ΚΡΙΝΕΤΑΙ ΕΙΝΑΙ ΑΥΤΟ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ (`cardShoreM`), όχι το ανοιχτό νερό.
 * Αυτό είναι όλο το παράπονο: ο αναγνώστης βλέπει «0,5 μ.» κάτω από τη λέξη «Ιδανική». Ένα
 * δάπεδο πάνω στο `severityM` (ανοιχτά) θα έκοβε παραλίες που τυπώνουν 0,2 μ. και θα άφηνε
 * ανέπαφη ακριβώς την Αχαράβη. Μετριέται και το `severityM` δίπλα, για να φαίνεται η διαφορά.
 *
 * ΠΗΓΗ: η μνήμη του scripts/measureColourCauseSplit.mjs (.tmp/colour-cause-split-cache.json) —
 * ίδιες γραμμές, παραγμένες από το ΠΡΟΪΟΝ (resolveConditionTone + calculateBeachScore), όχι από
 * κανόνες αυτού του αρχείου. Δεν ξοδεύει ούτε μία κλήση πρόγνωσης.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ:
 *  - Δεν λέει αν το δάπεδο είναι ΣΩΣΤΟ. Λέει μόνο πόσο κοστίζει.
 *  - Δείγμα = μέρες, άνεμος περιοχής, ίδια όρια με το αρχείο-πηγή (δες το κεφάλι του).
 *  - Δεν ξαναϋπολογίζει βάθρο/λίστα· μετράει την οθόνη (περιοχή × μέρα) που χάνει όλο το μπλε,
 *    που είναι η είσοδος και των δύο (utils/suitabilityTone.selectSuitableToneGroups).
 *
 * Run: node scripts/measureBlueWaveFloor.mjs [--floors=0.3,0.4,0.5,0.6]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cachePath = path.join(root, '.tmp/colour-cause-split-cache.json');
const reportDir = path.join(root, 'reports/quality');

const args = process.argv.slice(2);
const FLOORS = (args.find(a => a.startsWith('--floors='))?.slice('--floors='.length) ?? '0.3,0.4,0.5,0.6')
  .split(',').map(Number).filter(Number.isFinite);

const pct = (n, d) => `${((n / Math.max(1, d)) * 100).toFixed(1)}%`;

let cache;
try {
  cache = JSON.parse(readFileSync(cachePath, 'utf8'));
} catch {
  console.error('Λείπει η μνήμη. Τρέξε πρώτα: npm run measure:colour-cause');
  process.exit(1);
}
const stampDay = /@(\d{4}-\d{2}-\d{2})@/.exec(cache.codeStamp ?? '')?.[1] ?? 'άγνωστη';

const rows = [];
for (const [regionId, result] of Object.entries(cache.regions ?? {})) {
  for (const row of result.rows ?? []) rows.push({ ...row, regionId });
}
if (!rows.length) {
  console.error('Η μνήμη είναι άδεια.');
  process.exit(1);
}

const blue = rows.filter(row => row.tone === 'blue');

// ── ΤΙ ΤΥΠΩΝΕΙ ΣΗΜΕΡΑ ΜΙΑ «ΙΔΑΝΙΚΗ» ───────────────────────────────────────────────────────
const BUCKETS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8];
const histogram = new Map(BUCKETS.map(b => [b, 0]));
let blueNoNumber = 0;
for (const row of blue) {
  if (typeof row.cardShoreM !== 'number') { blueNoNumber += 1; continue; }
  const bucket = BUCKETS.find(b => row.cardShoreM < b) ?? 'πάνω';
  histogram.set(bucket, (histogram.get(bucket) ?? 0) + 1);
}

// ── ΤΟ ΚΟΣΤΟΣ ΚΑΘΕ ΔΑΠΕΔΟΥ ─────────────────────────────────────────────────────────────────
/** Οθόνη = περιοχή × μέρα. Το μπλε που χάνεται όλο αλλάζει τι δείχνει η λίστα «Καταλληλότερες». */
const screenKey = (row) => `${row.regionId}|${row.dayIndex}`;
const blueByScreen = new Map();
for (const row of blue) {
  const key = screenKey(row);
  blueByScreen.set(key, (blueByScreen.get(key) ?? 0) + 1);
}

const evaluate = (floor, field) => {
  const hit = blue.filter(row => typeof row[field] === 'number' && row[field] >= floor);
  const lostByScreen = new Map();
  for (const row of hit) {
    const key = screenKey(row);
    lostByScreen.set(key, (lostByScreen.get(key) ?? 0) + 1);
  }
  let screensEmptied = 0;
  for (const [key, lost] of lostByScreen) {
    if (lost >= (blueByScreen.get(key) ?? 0)) screensEmptied += 1;
  }
  const byRegion = {};
  for (const row of hit) byRegion[row.regionId] = (byRegion[row.regionId] ?? 0) + 1;
  return {
    floor,
    field,
    rows: hit.length,
    shareOfBlue: hit.length / Math.max(1, blue.length),
    shareOfAll: hit.length / rows.length,
    beaches: new Set(hit.map(row => row.beachId)).size,
    regions: new Set(hit.map(row => row.regionId)).size,
    screensEmptied,
    screensWithBlue: blueByScreen.size,
    topRegions: Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 8),
    examples: hit.slice(0, 6).map(row => ({
      name: row.name, region: row.regionId, day: row.dayIndex,
      bft: row.beaufort, cardM: row.cardShoreM, openM: row.severityM, exposure: row.exposureLevel,
    })),
  };
};

const cardResults = FLOORS.map(floor => evaluate(floor, 'cardShoreM'));
const openResults = FLOORS.map(floor => evaluate(floor, 'severityM'));

// ── ΤΥΠΩΜΑ ─────────────────────────────────────────────────────────────────────────────────
console.log(`\nΔείγμα: ${rows.length} μετρήσεις παραλία×μέρα · ${Object.keys(cache.regions).length} περιοχές · πρόγνωση ${stampDay}`);
console.log(`ΜΠΛΕ («Ιδανική») σήμερα: ${blue.length} (${pct(blue.length, rows.length)} του συνόλου) σε ${blueByScreen.size} οθόνες`);

console.log('\n── ΤΙ ΚΥΜΑ ΤΥΠΩΝΕΙ Η ΚΑΡΤΑ ΚΑΤΩ ΑΠΟ ΜΙΑ «ΙΔΑΝΙΚΗ» ────────────────────');
let running = 0;
for (const bucket of BUCKETS) {
  const count = histogram.get(bucket) ?? 0;
  running += count;
  console.log(`  < ${bucket.toFixed(1)} μ.: ${count} (${pct(count, blue.length)}) · σωρευτικά ${pct(running, blue.length)}`);
}
if (blueNoNumber) console.log(`  χωρίς αριθμό κύματος: ${blueNoNumber}`);

for (const [title, results] of [
  ['ΔΑΠΕΔΟ ΣΤΟΝ ΑΡΙΘΜΟ ΤΗΣ ΚΑΡΤΑΣ (αυτό που βλέπει ο κόσμος)', cardResults],
  ['ΔΑΠΕΔΟ ΣΤΟ ΑΝΟΙΧΤΟ ΝΕΡΟ (για σύγκριση)', openResults],
]) {
  console.log(`\n── ${title} ──────────────────`);
  for (const r of results) {
    console.log(`  ≥ ${r.floor.toFixed(2)} μ. → ΚΑΛΗ: ${r.rows} μετρήσεις (${pct(r.rows, blue.length)} των μπλε · ${pct(r.rows, rows.length)} του συνόλου)`);
    console.log(`      ${r.beaches} παραλίες · ${r.regions} περιοχές · οθόνες που μένουν ΧΩΡΙΣ καθόλου μπλε: ${r.screensEmptied}/${r.screensWithBlue} (${pct(r.screensEmptied, r.screensWithBlue)})`);
  }
}

const headline = cardResults.find(r => r.floor === 0.4) ?? cardResults[0];
if (headline) {
  console.log(`\n── ΠΟΥ ΧΤΥΠΑΕΙ ΤΟ ${headline.floor.toFixed(2)} μ. (αριθμός κάρτας) ───────────────────`);
  for (const [region, count] of headline.topRegions) console.log(`  ${region}: ${count}`);
  console.log('  Παραδείγματα:');
  for (const e of headline.examples) {
    console.log(`    ${e.name} (${e.region}, μέρα ${e.day}): ${e.bft} Μπφ · κάρτα ${e.cardM} μ. · ανοιχτά ${e.openM} μ. · ${e.exposure}`);
  }
}

// Η παραλία που ξεκίνησε τη συζήτηση.
const acharavi = rows.filter(row => row.beachId === 986);
if (acharavi.length) {
  console.log('\n── ΠΑΡΑΛΙΑ ΑΧΑΡΑΒΗΣ (id 986) ─────────────────────────────────────────');
  for (const row of acharavi) {
    console.log(`  μέρα ${row.dayIndex}: ${row.tone} · ${row.beaufort} Μπφ · κάρτα ${row.cardShoreM} μ. · ανοιχτά ${row.severityM} μ. · ${row.exposureLevel}`);
  }
}

mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'blue-wave-floor.json');
writeFileSync(reportPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  forecastDay: stampDay,
  rows: rows.length,
  blue: blue.length,
  screensWithBlue: blueByScreen.size,
  histogram: Object.fromEntries([...histogram].map(([k, v]) => [String(k), v])),
  cardFloors: cardResults,
  openWaterFloors: openResults,
  acharavi,
}, null, 2)}\n`);
console.log(`\nΑναφορά: ${path.relative(root, reportPath)}`);
