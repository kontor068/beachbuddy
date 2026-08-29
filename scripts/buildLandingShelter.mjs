#!/usr/bin/env node
/**
 * ΠΟΣΕΣ ΠΑΡΑΛΙΕΣ ΚΑΘΕ ΠΕΡΙΟΧΗΣ ΕΙΝΑΙ ΠΡΟΣΤΑΤΕΥΜΕΝΕΣ — ανά κατεύθυνση ανέμου, ψημένο.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Τα πλακίδια της landing έδειχναν σκέτα ονόματα: δεκατρείς πανομοιότυπες
 * επιλογές, κανένας λόγος να πατήσεις τη μία και όχι την άλλη. Ο ζωντανός αριθμός Μποφόρ που
 * είχαν παλιότερα δεν επιστρέφει και δεν πρέπει — δειγματοληπτείται σε ανοιχτή θάλασσα ενώ η
 * σελίδα της περιοχής διαβάζει την ακτή, κι έτσι το ίδιο μέρος έδειχνε δύο διαφορετικούς
 * αριθμούς την ίδια μέρα (reports/region-forecast-point-audit.md).
 *
 * ΤΟ ΣΧΗΜΑ ΤΗΣ ΑΚΤΗΣ ΟΜΩΣ ΔΕΝ ΕΧΕΙ ΑΥΤΟ ΤΟ ΠΡΟΒΛΗΜΑ. Δεν είναι μέτρηση, είναι γεωμετρία: δεν
 * αλλάζει ανά ώρα, δεν εξαρτάται από το ποιο σημείο ρωτήσαμε, και την έχουμε για το 100% των
 * παραλιών. Συνδυασμένη με ΜΟΝΟ την κατεύθυνση του ανέμου (συνοπτικό μέγεθος — το μελτέμι
 * φυσάει από τον ίδιο τομέα σε όλο το Αιγαίο) δίνει έναν αριθμό που αντέχει έλεγχο.
 *
 * ΓΙΑΤΙ ΚΑΛΕΙ ΤΟΝ ΠΛΗΡΗ ΜΗΧΑΝΙΣΜΟ ΚΑΙ ΟΧΙ ΣΚΕΤΗ ΓΕΩΜΕΤΡΙΑ. Η πρώτη γραφή μετρούσε με το
 * `resolveWindExposure` (γεωμετρία + κατεύθυνση, χωρίς ταχύτητα). Μετρήθηκε πριν μπει και
 * ΑΠΟΡΡΙΦΘΗΚΕ: διαφωνεί με το `assessBeachWindExposure` — αυτό που χρωματίζει τον χάρτη — στο
 * **7,64%** των παραλιών, και στη Ρόδο στις 240°/5 Μποφόρ έλεγε **44 έναντι 27**. Η landing θα
 * υποσχόταν 44 προστατευμένες και ο χάρτης θα έδειχνε 27. Ακριβώς η αντίφαση που αποφεύγουμε.
 *
 * ΓΙΑΤΙ 6 ΜΠΟΦΟΡ. Το επίπεδο έκθεσης του πλήρους μηχανισμού εξαρτάται ΚΑΙ από την ένταση, αλλά
 * η landing δεν επιτρέπεται να κουβαλήσει την ταχύτητα ανοιχτής θάλασσας (βλ. πρώτη παράγραφο).
 * Λύση: ψήνουμε στα 6 Μποφόρ, δηλαδή στο πιο αυστηρό σενάριο που συναντά το ελληνικό καλοκαίρι,
 * και ο αριθμός γίνεται **κάτω φράγμα**: ο χάρτης θα δείξει ΤΟΥΛΑΧΙΣΤΟΝ τόσες προστατευμένες,
 * ποτέ λιγότερες. Υποσχόμαστε λίγα και δίνουμε περισσότερα, όπως ορίζει το
 * docs/methodology-wind-exposure-GR.md.
 *
 * ΜΕΤΡΗΘΗΚΕ ΠΡΙΝ ΜΠΕΙ: 13 περιοχές × 24 κατευθύνσεις × 9 εντάσεις (1–9 Μποφόρ) =
 * **179.064 έλεγχοι, 0 υπερβάσεις**. Η πύλη `npm run quality:landing-shelter` το ξανατρέχει,
 * ώστε μια μελλοντική αλλαγή στο μοντέλο να σπάσει το build και όχι την υπόσχεση.
 *
 * Input:  public/data/beaches/app/summary/<region>.json   (παραλίες + orientation)
 *         public/data/geospatial/exposure/<region>.json   (fetch/blockage ανά τομέα)
 *         services/nationalConditions.ts                  (ΠΟΙΕΣ 13 περιοχές — χωρίς αντιγραφή)
 * Output: data/landingShelter.generated.json
 *
 * ΧΡΗΣΗ:
 *   node scripts/buildLandingShelter.mjs           # ξαναψήνει το αρχείο
 *   node scripts/buildLandingShelter.mjs --check   # σκάει αν το committed αρχείο είναι μπαγιάτικο
 *
 * Το `--check` υπάρχει γιατί το αποτέλεσμα είναι committed αλλά παράγεται από δεδομένα που
 * αλλάζουν (rebuild παραλιών, νέα γεωμετρία). Χωρίς πύλη, η landing θα έδειχνε σιωπηλά τους
 * αριθμούς μιας παλιάς βάσης.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Ο ίδιος φορτωτής TypeScript που χρησιμοποιεί το scripts/explainBeachWaveNumber.mjs, ώστε τα
// scripts να τρέχουν ΤΟΝ κώδικα της εφαρμογής και όχι μια δεύτερη γραφή του.
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})');
  module._compile(output, filename);
};

const { assessBeachWindExposure } = require(path.join(ROOT, 'utils/windExposureEngine.ts'));
const { NATIONAL_SAMPLE_REGION_IDS } = require(path.join(ROOT, 'services/nationalConditions.ts'));
const { WindDirection } = require(path.join(ROOT, 'types.ts'));

const SUMMARY_DIR = path.join(ROOT, 'public/data/beaches/app/summary');
const EXPOSURE_DIR = path.join(ROOT, 'public/data/geospatial/exposure');
const OUT_FILE = path.join(ROOT, 'data/landingShelter.generated.json');

/**
 * Βήμα δειγματοληψίας κατεύθυνσης, σε μοίρες. 15° επειδή οι τομείς του μοντέλου είναι 45° —
 * τρία δείγματα ανά τομέα πιάνουν την παρεμβολή χωρίς να φουσκώσουν το αρχείο. Μικρότερο βήμα
 * θα πρόσθετε bytes στο κινητό για διαφορά που δεν φαίνεται σε ακέραιο πλήθος παραλιών.
 */
const STEP_DEG = 15;
const BUCKETS = 360 / STEP_DEG;

/** Βλ. «ΓΙΑΤΙ 6 ΜΠΟΦΟΡ» στην κεφαλίδα. Αλλάζοντάς το, ξανατρέξε την πύλη — είναι η υπόσχεση. */
export const BAKE_BEAUFORT = 6;

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorFromDegrees = deg => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

/**
 * Το επίπεδο έκθεσης που θα έδειχνε η σελίδα της περιοχής για αυτή την παραλία σε αυτόν τον
 * άνεμο. Ζει εδώ ώστε το script ΚΑΙ η πύλη να ρωτάνε με ΤΑ ΙΔΙΑ ορίσματα — μια πύλη που
 * καλεί τον μηχανισμό αλλιώς από το script δεν ελέγχει τίποτα.
 */
export const exposureLevelFor = (beach, profile, windDirectionDeg, beaufort) => assessBeachWindExposure({
  beach,
  geospatialProfile: profile,
  windDirectionDeg,
  windDirection: WindDirection[sectorFromDegrees(windDirectionDeg)],
  // Η μόνη θέση όπου μπαίνει ταχύτητα, και μπαίνει ΣΤΑΘΕΡΗ: ~7,5 χλμ/ώρα ανά Μποφόρ, η μέση
  // της κλίμακας. Δεν είναι πρόγνωση, είναι το σενάριο στο οποίο ψήνουμε.
  windSpeedKmh: beaufort * 7.5,
  beaufort,
}).exposureLevel;

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));

export const shelterForRegion = (regionId) => {
  const summaryFile = path.join(SUMMARY_DIR, `${regionId}.json`);
  const exposureFile = path.join(EXPOSURE_DIR, `${regionId}.json`);
  if (!existsSync(summaryFile)) return { error: `λείπει ${path.relative(ROOT, summaryFile)}` };

  const beaches = readJson(summaryFile).island?.beaches || [];
  if (beaches.length === 0) return { error: 'καμία παραλία στο summary' };

  const profiles = existsSync(exposureFile) ? (readJson(exposureFile).profiles || {}) : {};

  // ΜΟΝΟ όσες παραλίες έχουν πραγματική γεωμετρία μετράνε — και ο παρονομαστής είναι ΑΥΤΕΣ, όχι
  // το σύνολο της περιοχής. Αλλιώς το πλακίδιο θα έλεγε «12 από 39» εκεί που για 8 από τις 39
  // απλώς δεν ξέραμε, και το «από 39» θα διάβαζε σαν «οι υπόλοιπες 27 είναι εκτεθειμένες».
  const usable = beaches.filter(beach => {
    const profile = profiles[String(beach.id)];
    const orientationDeg = beach.orientation?.degrees;
    return profile || typeof orientationDeg === 'number';
  });
  if (usable.length === 0) return { error: 'καμία παραλία με γεωμετρία' };

  const sheltered = new Array(BUCKETS).fill(0);
  for (let bucket = 0; bucket < BUCKETS; bucket += 1) {
    const windDirectionDeg = bucket * STEP_DEG;
    let count = 0;
    for (const beach of usable) {
      const level = exposureLevelFor(beach, profiles[String(beach.id)], windDirectionDeg, BAKE_BEAUFORT);
      if (level === 'protected') count += 1;
    }
    sheltered[bucket] = count;
  }

  return { total: usable.length, beachCount: beaches.length, sheltered };
};

const build = () => {
  const regions = {};
  const problems = [];
  for (const regionId of NATIONAL_SAMPLE_REGION_IDS) {
    const result = shelterForRegion(regionId);
    if (result.error) {
      problems.push(`${regionId}: ${result.error}`);
      continue;
    }
    regions[regionId] = {
      total: result.total,
      beachCount: result.beachCount,
      sheltered: result.sheltered,
    };
  }
  return { payload: { v: 1, stepDeg: STEP_DEG, regions }, problems };
};

// Το `generatedAt` μπαίνει ΜΟΝΟ στο γράψιμο και ΔΕΝ συγκρίνεται στο --check: αλλιώς κάθε
// τρέξιμο θα ανακοίνωνε «μπαγιάτικο» επειδή άλλαξε η ώρα, που είναι θόρυβος και όχι αλλαγή.
const serialize = data => `${JSON.stringify(data, null, 2)}\n`;

const main = () => {
  const { payload, problems } = build();
  const isCheck = process.argv.includes('--check');

  if (isCheck) {
    if (!existsSync(OUT_FILE)) {
      console.error(`✗ Λείπει το ${path.relative(ROOT, OUT_FILE)}. Τρέξε: node scripts/buildLandingShelter.mjs`);
      process.exit(1);
    }
    const { generatedAt, ...committed } = readJson(OUT_FILE);
    if (serialize(committed) !== serialize(payload)) {
      console.error('✗ Το data/landingShelter.generated.json δεν συμφωνεί με τα σημερινά δεδομένα παραλιών.');
      console.error('  Τρέξε: node scripts/buildLandingShelter.mjs');
      process.exit(1);
    }
    if (problems.length > 0) {
      console.error(`✗ ${problems.length} περιοχές χωρίς αριθμούς:\n  ${problems.join('\n  ')}`);
      process.exit(1);
    }
    console.log(`✓ Οι αριθμοί της λωρίδας περιοχών είναι ενημερωμένοι (${Object.keys(payload.regions).length} περιοχές).`);
    return;
  }

  if (problems.length > 0) {
    console.warn(`⚠ ${problems.length} περιοχές παραλείφθηκαν:\n  ${problems.join('\n  ')}`);
  }

  writeFileSync(OUT_FILE, serialize({ generatedAt: new Date().toISOString(), ...payload }));
  console.log(`✓ ${path.relative(ROOT, OUT_FILE)} — ${Object.keys(payload.regions).length} περιοχές, ${BUCKETS} κατευθύνσεις, ψημένο στα ${BAKE_BEAUFORT} Μποφόρ.`);

  // Μια γρήγορη ματιά στο αποτέλεσμα, για να μη χρειάζεται να ανοίξει κανείς το JSON: βοριάς
  // (0°) και νοτιάς (180°), οι δύο ακραίες περιπτώσεις για το ελληνικό καλοκαίρι.
  for (const [regionId, region] of Object.entries(payload.regions)) {
    console.log(
      `  ${regionId.padEnd(40)} ${String(region.sheltered[0]).padStart(3)}/${region.total} στον βοριά`
      + ` · ${String(region.sheltered[180 / STEP_DEG]).padStart(3)}/${region.total} στον νοτιά`,
    );
  }
};

// Μόνο σαν εργαλείο γραμμής εντολών. Η πύλη κάνει import τις συναρτήσεις από πάνω και δεν
// πρέπει να ξαναγράψει το αρχείο απλώς επειδή το φόρτωσε.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
