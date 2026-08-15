/**
 * ΠΥΛΗ · ΟΙ ΧΕΙΡΟΚΙΝΗΤΕΣ ΟΜΑΔΕΣ «ΙΔΙΑ ΑΚΤΗ» ΣΥΜΦΩΝΟΥΝ ΜΕ ΤΗ ΜΕΤΡΗΜΕΝΗ ΓΕΩΜΕΤΡΙΑ
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (15/08/2026). Οι ομάδες γράφτηκαν με το χέρι στις **09/06/2026** (`3deb24f5`)
 * και ήταν σωστές τότε. Την **επόμενη μέρα** (`6239d3ba`, ξαναμέτρηση της ακτογραμμής με
 * λεπτομερή χάρτη OSM) τα νούμερα άλλαξαν από κάτω τους:
 *
 *   Κολιτσάνι / Μυλοπότας / Βαλμάς   09/06: 223,8° / 224,3° / 219,7°  → εύρος **5°**
 *                                    10/06: 170,2° / 241,5° / 278,8°  → εύρος **109°**
 *
 * Δεν άλλαξε η ακτή· άλλαξε πόσο καλά τη μετράμε. Η αναφορά «0 αντιφάσεις» έμεινε παγωμένη
 * **μία μέρα πριν** από την αλλαγή που την ακύρωσε, και το λάθος έζησε **δύο μήνες** — μέχρι
 * που βρέθηκε κατά τύχη στον επανέλεγχο της Ίου. Ο έλεγχος υπήρχε· απλώς δεν ήταν πύλη.
 *
 * ΤΙ ΕΛΕΓΧΕΙ, ΔΥΟ ΠΡΑΓΜΑΤΑ:
 *   1. ΔΟΜΙΚΑ — καμία ενεργή ομάδα δεν έχει μέλη που κοιτάνε πάνω από 65° διαφορετικά. Είναι η
 *      ίδια ανοχή που χρησιμοποιεί ο κώδικας για curated ομάδες (utils/mapExposure.ts). Πιάνει
 *      τη λάθος ομάδα ΠΡΙΝ προλάβει να βγάλει λάθος χρώμα.
 *   2. ΣΥΜΠΕΡΙΦΟΡΑ — καμία ομάδα δεν βγάζει αντιφατικά χρώματα, εκτός από τις γραμμένες
 *      παρακάτω. Τρέχει τον ΑΛΗΘΙΝΟ resolver του χάρτη, σε 5 σενάρια ανέμου, σε 13 νησιά.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΛΙΣΤΑ ΑΠΟΔΕΚΤΩΝ. Οκτώ ομάδες διαφωνούν ενώ τα μέλη τους ΟΝΤΩΣ κοιτάνε το ίδιο
 * (Φυριπλάκα–Τσιγκράδο: 19°). Εκεί δεν φταίει η ομάδα — φταίει το μοντέλο, και είναι το 40% που
 * η βίβλος §Γ3 έχει ήδη μετρήσει και δεχτεί (η χαλάρωση κατωφλιού δοκιμάστηκε: 10.716 → 10.718).
 * Χωρίς τη λίστα η πύλη θα ήταν μονίμως κόκκινη, και σε μια βδομάδα κανείς δεν θα την κοίταζε.
 * **Προσθήκη εδώ = απόφαση, όχι σιωπή:** γράψε ΓΙΑΤΙ, αλλιώς η λίστα σαπίζει.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(output, filename);
};

const { SHORELINE_SEGMENTS } = require('../utils/shorelineSegments.ts');

/** Η ίδια ανοχή με το curated branch του areLikelySameBeachFront (utils/mapExposure.ts). */
const CURATED_FACING_TOLERANCE_DEG = 65;

/**
 * Αντιφάσεις που ΔΕΝ είναι λάθος ομάδας: τα μέλη κοιτάνε το ίδιο και το χρώμα διαφέρει από το
 * ίδιο το μοντέλο. Μετρημένο εύρος προσανατολισμού δίπλα σε κάθε μία.
 */
const ACCEPTED_CONTRADICTIONS = new Map([
  ['milos-fyriplaka-tsigrado-front', 'εύρος 19° — ίδιο μέτωπο, το μοντέλο τα ξεχωρίζει (§Γ3)'],
  ['andros-vitali-gides-front', 'εύρος 34° — ίδιο μέτωπο, διαφωνία μοντέλου (§Γ3)'],
  ['ios-manousou-pepa-front', 'εύρος 35° — ίδιο μέτωπο, διαφωνία μοντέλου (§Γ3)'],
  ['ios-klima-pikri-nero-sapounochoma-front', 'εύρος 40° — ίδιο μέτωπο, διαφωνία μοντέλου (§Γ3)'],
  ['serifos-agios-sostis-psili-ammos-lia-front', 'εύρος 40° — ίδιο μέτωπο, διαφωνία μοντέλου (§Γ3)'],
  ['kythnos-agios-sostis-potamia-front', 'εύρος 56° — ίδιο μέτωπο, διαφωνία μοντέλου (§Γ3)'],
  ['sifnos-toso-nero-tsocha-front', 'εύρος 57° — ίδιο μέτωπο, διαφωνία μοντέλου (§Γ3)'],
  ['andros-kourtali-felos-front', 'εύρος 60° — οριακό αλλά εντός ανοχής· διαφωνία μοντέλου (§Γ3)'],
]);

const OUT_DIR = path.join('.tmp', 'shoreline-segment-gate');
const PROVE = process.argv.includes('--prove');

const angularDistance = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

const failures = [];
const notes = [];

// ── 1. ΔΟΜΙΚΑ ────────────────────────────────────────────────────────────────
const regionIds = [...new Set(SHORELINE_SEGMENTS.map(segment => segment.regionId))].sort();
let widest = { id: null, spread: -1 };

for (const regionId of regionIds) {
  const profiles = JSON.parse(
    readFileSync(path.join(root, 'public', 'data', 'geospatial', 'exposure', `${regionId}.json`), 'utf8')
  ).profiles || {};

  for (const segment of SHORELINE_SEGMENTS.filter(s => s.regionId === regionId)) {
    const facings = segment.beachIds
      .map(id => profiles[id]?.facingDeg ?? profiles[String(id)]?.facingDeg)
      .filter(value => typeof value === 'number');
    if (facings.length < 2) continue;

    let spread = 0;
    for (let i = 0; i < facings.length; i += 1) {
      for (let j = i + 1; j < facings.length; j += 1) {
        spread = Math.max(spread, angularDistance(facings[i], facings[j]));
      }
    }
    if (spread > widest.spread) widest = { id: segment.id, spread };
    const limit = PROVE ? 5 : CURATED_FACING_TOLERANCE_DEG;
    if (spread > limit) {
      failures.push(
        `[δομικό] «${segment.id}» δηλώνει ίδια ακτή, αλλά τα μέλη του κοιτάνε ${Math.round(spread)}° `
        + `διαφορετικά (όριο ${limit}°). Είτε χώρισέ το, είτε βάλ' το στο RETIRED_SHORELINE_SEGMENT_IDS.`
      );
    }
  }
}
notes.push(`δομικό: ${SHORELINE_SEGMENTS.length} ενεργές ομάδες σε ${regionIds.length} περιοχές · μεγαλύτερο εύρος ${Math.round(widest.spread)}° (${widest.id})`);

// ── 2. ΣΥΜΠΕΡΙΦΟΡΑ ───────────────────────────────────────────────────────────
mkdirSync(path.join(root, OUT_DIR), { recursive: true });
const seenContradictions = new Set();
let scenarioPairs = 0;

for (const regionId of regionIds) {
  const run = spawnSync(process.execPath, [
    'scripts/validateShorelineSegmentConsistency.mjs',
    `--region=${regionId}`,
    `--out-dir=${OUT_DIR}`,
    '--no-assert',
  ], { cwd: root, encoding: 'utf8' });

  if (run.status !== 0) {
    failures.push(`[συμπεριφορά] ο έλεγχος έσκασε στο ${regionId}: ${(run.stderr || '').split('\n')[0]}`);
    continue;
  }

  const report = JSON.parse(readFileSync(path.join(root, OUT_DIR, `${regionId}.json`), 'utf8'));
  for (const item of report.unresolved || []) {
    scenarioPairs += 1;
    seenContradictions.add(item.segmentId);
    if (ACCEPTED_CONTRADICTIONS.has(item.segmentId)) continue;
    failures.push(
      `[συμπεριφορά] «${item.segmentId}» (${item.scenarioId}) βγάζει διαφορετικά χρώματα στην ίδια ακτή: `
      + item.rows.map(row => `${row.name}=${row.level}`).join(' / ')
      + '. Αν είναι γνήσια διαφωνία μοντέλου, γράψ\' την στο ACCEPTED_CONTRADICTIONS με το μετρημένο εύρος.'
    );
  }
}
notes.push(`συμπεριφορά: ${scenarioPairs} ζευγάρια ομάδα×σενάριο σε αντίφαση, ${seenContradictions.size} ξεχωριστές ομάδες`);

// Η λίστα δεν επιτρέπεται να σαπίσει: ό,τι δεν εμφανίζεται πια, φεύγει.
const stale = [...ACCEPTED_CONTRADICTIONS.keys()].filter(id => !seenContradictions.has(id));
if (stale.length && !PROVE) {
  failures.push(
    `[λίστα] ${stale.length} αποδεκτές αντιφάσεις δεν εμφανίζονται πλέον — σβήσ' τες από το `
    + `ACCEPTED_CONTRADICTIONS ώστε να μη σκεπάζουν μελλοντικό λάθος: ${stale.join(', ')}`
  );
}

console.log(notes.map(line => `  ${line}`).join('\n'));
if (failures.length) {
  console.error(`\n❌ ${failures.length} πρόβλημα(τα) στις ομάδες «ίδια ακτή»:\n`);
  failures.forEach(line => console.error(`  - ${line}`));
  process.exit(1);
}
console.log('\n✅ κάθε ομάδα «ίδια ακτή» συμφωνεί με τη μετρημένη γεωμετρία, και κάθε αντίφαση χρώματος είναι γραμμένη απόφαση.');
