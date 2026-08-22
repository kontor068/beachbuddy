/**
 * Η ΠΥΛΗ ΤΗΣ ΔΗΛΩΣΗΣ «ΒΑΘΑΙΝΕΙ ΓΡΗΓΟΡΑ» (22/08/2026).
 *
 * Η ΑΙΤΙΑ ΠΟΥ ΦΥΛΑΕΙ. Η κάρτα της παραλίας τυπώνει έναν **μετρημένο αριθμό** («περίπου 15 μ.
 * νερό στα 100 μ. από την παραλία»). Τρεις τρόποι να γίνει ψέμα, όλοι σιωπηλοί:
 *
 *   α) να μείνει σφραγισμένος ένας αριθμός που δεν αντιστοιχεί πια σε καμία μέτρηση — π.χ. αν
 *      ξαναγίνει η βυθομετρία και δεν ξανατρέξει το ψήσιμο.
 *   β) να δηλωθεί σε παραλία που η **δική μας** καταγραφή λέει «ρηχή». Όταν οι δύο μάρτυρες
 *      διαφωνούν, η δημόσια σελίδα δεν είναι το σημείο για να μαντέψουμε.
 *   γ) να πει κάποια στιγμή το αντίστροφο — «ρηχά, ιδανικά για παιδιά». Η πηγή εξομαλύνει τα
 *      ρηχά· μόνο η βαθιά της πλευρά αντέχει δημόσια δήλωση.
 *
 * ΤΟ ΚΡΙΝΕΙ Η ΠΗΓΗ, ΟΧΙ ΑΝΤΙΓΡΑΦΟ: ο κανόνας και τα λόγια διαβάζονται από το `utils/seabedEntry`
 * — αν αλλάξει το κατώφλι εκεί, αλλάζει και η πύλη μαζί του.
 *
 * ΑΥΤΟΑΠΟΔΕΙΞΗ (`--prove`): τρεις σκόπιμα χαλασμένες δηλώσεις — μία σε παραλία χωρίς μέτρηση,
 * μία κάτω από το κατώφλι, μία σε παραλία καταγεγραμμένη ως «ρηχή». Και οι τρεις πρέπει να
 * πιαστούν, αλλιώς η πύλη είναι διακοσμητική.
 *
 * Run: node scripts/validateSeabedEntryClaim.mjs [--prove]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const {
  STEEP_DEPTH_AT_100M_M, buildSteepSeabedNote, buildSteepSeabedSource, resolveSteepSeabedDepthM,
} = require(path.join(root, 'utils/seabedEntry.ts'));

const PROVE = process.argv.includes('--prove');
const pub = path.join(root, 'public');
const appDir = path.join(pub, 'data', 'beaches', 'app');
const exposureDir = path.join(pub, 'data', 'geospatial', 'exposure');
const bathyDir = path.join(pub, 'data', 'geospatial', 'bathymetry');
const rj = (p) => JSON.parse(readFileSync(p, 'utf8'));

const failures = [];
const note = (message) => failures.push(message);

const recordedDepthOf = (beach) => beach?.metadata?.waterDepth?.type
  ?? (typeof beach?.waterDepth === 'string' ? beach.waterDepth : undefined);

let stated = 0;
let checked = 0;
const claimed = new Map();

for (const file of readdirSync(appDir).filter(name => name.endsWith('.json'))) {
  const regionId = file.replace(/\.json$/, '');
  const beaches = rj(path.join(appDir, file)).island?.beaches ?? [];
  const exposure = existsSync(path.join(exposureDir, file)) ? (rj(path.join(exposureDir, file)).profiles ?? {}) : {};
  const bathymetry = existsSync(path.join(bathyDir, file)) ? (rj(path.join(bathyDir, file)).profiles ?? {}) : {};

  for (const beach of beaches) {
    checked += 1;
    const expected = resolveSteepSeabedDepthM({
      profile: bathymetry[String(beach.id)],
      facingDeg: exposure[String(beach.id)]?.facingDeg,
      recordedWaterDepthType: recordedDepthOf(beach),
    });
    const baked = beach.steepSeabedDepthM;

    if (baked != null) {
      stated += 1;
      claimed.set(beach.id, baked);
      if (expected == null) {
        note(`${regionId}#${beach.id}: δηλώνει ${baked} μ. αλλά η μέτρηση δεν το στηρίζει (καταγραφή: ${recordedDepthOf(beach) ?? '—'}).`);
        continue;
      }
      if (baked !== expected) {
        note(`${regionId}#${beach.id}: δηλώνει ${baked} μ. ενώ η μέτρηση δίνει ${expected} μ.`);
      }
      if (baked < STEEP_DEPTH_AT_100M_M) {
        note(`${regionId}#${beach.id}: δηλώνει ${baked} μ., κάτω από το κατώφλι των ${STEEP_DEPTH_AT_100M_M} μ.`);
      }
      if (recordedDepthOf(beach) === 'shallow') {
        note(`${regionId}#${beach.id}: δηλώνει βαθύ ενώ η δική μας καταγραφή λέει «ρηχή» — εκεί σωπαίνουμε.`);
      }
    } else if (expected != null) {
      note(`${regionId}#${beach.id}: η μέτρηση δίνει ${expected} μ. αλλά τίποτα δεν ψήθηκε — σιωπηλή απώλεια.`);
    }
  }

  // Τα τρία αντίγραφα που διαβάζουν εφαρμογή και prerender δεν επιτρέπεται να διαφωνούν.
  for (const variant of ['summary', 'detail']) {
    const fp = path.join(appDir, variant, file);
    if (!existsSync(fp)) continue;
    for (const beach of rj(fp).island?.beaches ?? []) {
      const here = beach.steepSeabedDepthM ?? null;
      const there = claimed.get(beach.id) ?? null;
      if (here !== there) {
        note(`${regionId}#${beach.id}: το «${variant}» λέει ${here ?? 'τίποτα'} ενώ το βασικό λέει ${there ?? 'τίποτα'}.`);
      }
    }
  }
}

// Τα λόγια: πέντε γλώσσες, ο αριθμός μέσα, και ποτέ ο αντίστροφος ισχυρισμός.
const FORBIDDEN = /ρηχ|shallow|ideal for (kids|children)|ιδανικ[ήη] για παιδι|sicher|sûr|sicuro|safe for/i;
for (const language of ['en', 'gr', 'fr', 'de', 'it']) {
  const line = buildSteepSeabedNote(language, 15);
  const source = buildSteepSeabedSource(language);
  if (!line?.trim() || !source?.trim()) { note(`copy/${language}: κενή φράση.`); continue; }
  if (!line.includes('15')) note(`copy/${language}: η φράση δεν περιέχει τον μετρημένο αριθμό («${line}»).`);
  if (FORBIDDEN.test(line)) note(`copy/${language}: η φράση κάνει τον αντίστροφο ισχυρισμό («${line}»).`);
  if (line === source) note(`copy/${language}: φράση και πηγή ταυτόσημες.`);
}

if (PROVE) {
  const sabotage = [
    {
      id: 'χωρίς μέτρηση',
      input: { profile: { sectors: { N: { depths: { '100m': null } } } }, facingDeg: 0 },
    },
    {
      id: 'κάτω από το κατώφλι',
      input: { profile: { sectors: { N: { depths: { '100m': STEEP_DEPTH_AT_100M_M - 0.5 } } } }, facingDeg: 0 },
    },
    {
      id: 'καταγεγραμμένη ως ρηχή',
      input: { profile: { sectors: { N: { depths: { '100m': 40 } } } }, facingDeg: 0, recordedWaterDepthType: 'shallow' },
    },
  ];
  for (const item of sabotage) {
    if (resolveSteepSeabedDepthM(item.input) != null) {
      note(`--prove: η περίπτωση «${item.id}» πέρασε — ο κανόνας δεν φυλάει τίποτα.`);
    }
  }
  // Και το αντίστροφο: μια καθαρή περίπτωση ΠΡΕΠΕΙ να περνάει, αλλιώς η πύλη λέει «όλα καλά»
  // επειδή απορρίπτει τα πάντα.
  const clean = resolveSteepSeabedDepthM({ profile: { sectors: { N: { depths: { '100m': 18.4 } } } }, facingDeg: 0 });
  if (clean !== 18) note(`--prove: καθαρή μέτρηση 18,4 μ. έπρεπε να δώσει 18, έδωσε ${clean}.`);
}

if (failures.length > 0) {
  console.error('Η πύλη της δήλωσης βυθού ΕΠΕΣΕ:');
  for (const failure of failures.slice(0, 25)) console.error(`  - ${failure}`);
  if (failures.length > 25) console.error(`  … και άλλα ${failures.length - 25}`);
  process.exit(1);
}

console.log(`Δήλωση βυθού: ${stated} από ${checked} παραλίες, όλες με μέτρηση που τη στηρίζει· λόγια σε 5 γλώσσες${PROVE ? ' + αυτοαπόδειξη' : ''} — πέρασαν.`);
