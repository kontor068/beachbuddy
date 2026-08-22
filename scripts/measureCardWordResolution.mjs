/**
 * ΠΟΣΗ ΠΛΗΡΟΦΟΡΙΑ ΚΡΥΒΕΙ Η ΛΕΞΗ ΤΗΣ ΚΑΡΤΑΣ — εθνική μέτρηση, report-only.
 *
 * Στις 22/08/2026 (§Γ66) η κάρτα έπαψε να τυπώνει «6 Μπφ» και «~0,1 μ.» και κράτησε μόνο τη
 * ΖΩΝΗ σε λέξεις. Η αλλαγή άφησε δύο γραπτές εκκρεμότητες, και οι δύο της ίδιας μορφής —
 * «πόσο διαφέρουν στ' αλήθεια δύο παραλίες που πλέον γράφουν το ίδιο πράγμα;»:
 *
 *   Α. Η ΠΑΝΩ ΒΑΘΜΙΔΑ ΕΙΝΑΙ ΑΝΟΙΧΤΗ. «Δυνατός αέρας» = 6 Μποφόρ ΚΑΙ 9· «μεγάλο κύμα» = 1,2 μ.
 *      ΚΑΙ 3,0 μ. Το χρώμα όμως ΚΟΒΕΙ μέσα σε αυτή τη βαθμίδα: `resolveWindTone` γυρίζει
 *      κόκκινο στα ≥7 και πορτοκαλί στα 6. Άρα η λέξη μπορεί να κρύψει ένα σκαλί χρώματος.
 *   Β. ΟΙ ΙΣΟΠΑΛΙΕΣ. Σε ήρεμη μέρα πολλές κάρτες γράφουν το ίδιο ζευγάρι λέξεων. Πόσο συχνά, και
 *      πόσο μεγάλη είναι η ΑΛΗΘΙΝΗ διαφορά πίσω από την ισοπαλία;
 *
 * ΤΟ ΚΡΙΤΗΡΙΟ ΔΕΝ ΕΙΝΑΙ ΔΙΚΟ ΜΟΥ. «Σημαντική διαφορά θάλασσας» = **0,25 μ.**, το ίδιο νούμερο
 * που το ΒΑΘΡΟ χρησιμοποιεί για να πει ότι δύο παραλίες είναι ισοδύναμες
 * (PODIUM_SEA_MEANINGFUL_DIFFERENCE_M — «είναι κάτω από το σφάλμα του μοντέλου»). Αν η λέξη
 * κρύβει διαφορά κάτω από αυτό, δεν κρύβει τίποτα που το ίδιο το σύστημα θεωρεί υπαρκτό.
 *
 * 🔴 ΤΙ ΔΕΝ ΜΠΟΡΕΙ ΝΑ ΔΕΙ ΑΥΤΟ ΤΟ ΕΡΓΑΛΕΙΟ — ΔΙΑΒΑΣΕ ΤΟ ΠΡΙΝ ΠΙΣΤΕΨΕΙΣ ΝΟΥΜΕΡΟ ΑΝΕΜΟΥ.
 *
 * Η μνήμη χτίζεται με τον καιρό ΤΗΣ ΠΕΡΙΟΧΗΣ: το `measureColourCauseSplit` περνά το `regionDay`
 * σε κάθε παραλία και εφαρμόζει πάνω του ΜΟΝΟ το θαλάσσιο σημείο της παραλίας
 * (`applyMarineToDailyForecast`). Άρα:
 *
 *   • ΤΟ ΚΥΜΑ είναι όντως της παραλίας — το `cardShoreM` μεταβάλλεται μέσα στην ίδια περιοχή.
 *   • Ο ΑΝΕΜΟΣ ΔΕΝ ΕΙΝΑΙ. Είναι ο αριθμός της περιοχής, ίδιος για όλες τις παραλίες της.
 *     Η κάρτα όμως τυπώνει τον ΔΙΚΟ ΤΗΣ (`beachWindSpeedKmph` ← `perBeachMapWind`, App.tsx:4631),
 *     που έρχεται από χωριστές προγνώσεις ανά συστάδα. Η δική τους εθνική μέτρηση της 02/08
 *     (App.tsx:4643) λέει ότι ο αριθμός της περιοχής απέχει **≥1 Μποφόρ από τον αριθμό της
 *     παραλίας στο 35,9% των παραλιο-ωρών**.
 *
 * Γι' αυτό ο έλεγχος Α2 παρακάτω ΔΕΝ είναι στολίδι: το άνοιγμα οθόνης βγαίνει 0 σε ΚΑΘΕ οθόνη,
 * και αυτό ακριβώς αποδεικνύει ότι εδώ μέσα ο άνεμος είναι ενιαίος. Όποιο συμπέρασμα για τον
 * άνεμο βγει από αυτό το αρχείο είναι για τον αριθμό ΤΗΣ ΠΕΡΙΟΧΗΣ και τίποτα άλλο.
 *
 * ΤΑ ΔΕΔΟΜΕΝΑ ΔΕΝ ΞΑΝΑΖΗΤΙΟΥΝΤΑΙ. Διαβάζει τη μνήμη του `measureColourCauseSplit.mjs`
 * (110 περιοχές × 5 μέρες, ζωντανή πρόγνωση, ΟΙ ΙΔΙΕΣ συναρτήσεις που βάφουν την πινέζα), όπου
 * κάθε γραμμή κουβαλάει ήδη το `beaufort` της παραλίας και το `cardShoreM` — «ο αριθμός που
 * τυπώνει η κάρτα σήμερα». Καμία κλήση δικτύου εδώ.
 *
 * ⚠️ ΑΡΝΕΙΤΑΙ ΝΑ ΚΡΙΝΕΙ ΜΕ ΜΠΑΓΙΑΤΙΚΗ ΜΝΗΜΗ. Η σφραγίδα της μνήμης κουβαλάει την ημερομηνία και
 * τα μεγέθη τεσσάρων αρχείων κώδικα· αν δεν είναι σημερινή, σταματά και λέει τι να τρέξεις.
 * Μια μέτρηση με χθεσινό μοντέλο θα απαντούσε για κάρτα που δεν υπάρχει πια.
 *
 * Run: node scripts/measureColourCauseSplit.mjs --live   (πρώτα, γεμίζει τη μνήμη)
 *      node scripts/measureCardWordResolution.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})'), filename);
};

const { windFeelLevel, waveFeelLevel, buildConditionsFeel } = require(path.join(root, 'utils/conditionsFeelPhrase.ts'));
const { selectSuitableByTone, resolveWindTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

/** Το κατώφλι του ΒΑΘΡΟΥ, όχι δικό μας: κάτω από αυτό δύο θάλασσες είναι ισοδύναμες. */
const MEANINGFUL_SEA_M = 0.25;
/** Το σκαλί που ΚΟΒΕΙ μέσα στην πάνω βαθμίδα λέξης: πορτοκαλί ως 6, κόκκινο από 7. */
const RED_BEAUFORT = 7;

const cachePath = path.join(root, '.tmp/colour-cause-split-cache.json');
let cache;
try {
  cache = JSON.parse(readFileSync(cachePath, 'utf8'));
} catch {
  console.error('❌ Λείπει η μνήμη της εθνικής μέτρησης.\n   Τρέξε πρώτα: node scripts/measureColourCauseSplit.mjs --live');
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
if (!String(cache.codeStamp ?? '').includes(`@${today}@`)) {
  console.error(`❌ Η μνήμη είναι από άλλη μέρα (σφραγίδα: ${cache.codeStamp}).`);
  console.error('   Μια μέτρηση με χθεσινό μοντέλο απαντάει για κάρτα που δεν υπάρχει πια.');
  console.error('   Τρέξε: node scripts/measureColourCauseSplit.mjs --live');
  process.exit(1);
}

const regions = Object.values(cache.regions ?? {}).filter(r => Array.isArray(r?.rows));
if (!regions.length) {
  console.error('❌ Η μνήμη δεν έχει γραμμές.');
  process.exit(1);
}

/** Μία «οθόνη» = ό,τι βλέπει ένας άνθρωπος μαζί: μία περιοχή, μία μέρα. */
const screens = new Map();
let rowsTotal = 0;
for (const region of regions) {
  for (const row of region.rows) {
    if (typeof row.beaufort !== 'number') continue;
    rowsTotal += 1;
    const key = `${region.regionId}#${row.dayIndex}`;
    if (!screens.has(key)) screens.set(key, []);
    screens.get(key).push({
      ...row,
      regionId: region.regionId,
      windLevel: windFeelLevel(row.beaufort),
      waveLevel: typeof row.cardShoreM === 'number' ? waveFeelLevel(row.cardShoreM) : null,
    });
  }
}

const pct = (n, d) => (d ? `${((n / d) * 100).toFixed(1)}%` : '—');
const median = list => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const p95 = list => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))];
};

// ── Α. Η ΠΑΝΩ ΒΑΘΜΙΔΑ ────────────────────────────────────────────────────────────────────────
const topWind = { rows: 0, atSeven: 0, screensWithBand: 0, screensHidingColourStep: 0, spreads: [] };
const topWave = { rows: 0, screensWithBand: 0, spreads: [], screensOverMeaningful: 0 };
// Το ίδιο, ΜΟΝΟ πάνω σε ό,τι φτάνει στις προτάσεις (ΣΤΑΔΙΟ 8: οι δύο καλύτερες παρούσες
// αποχρώσεις, ποτέ κόκκινο) — εκεί κρίνεται αν η απώλεια είναι πραγματική ή θεωρητική.
const topWindVisible = { rows: 0, atSeven: 0 };
const topWaveVisible = { rows: 0 };

/**
 * ΤΟ ΟΡΙΟ ΓΙΑ ΟΣΑ ΔΕΝ ΕΙΔΕ ΤΟ ΔΕΙΓΜΑ.
 *
 * Το «σε καμία οθόνη δεν συνέβη» είναι φτηνό αν η μέρα δεν είχε τέτοιο καιρό. Ένα παράθυρο
 * πέντε ημερών μπορεί να μην περιέχει ούτε ένα 7άρι πουθενά στην Ελλάδα — και τότε το μηδέν
 * δεν λέει «δεν γίνεται», λέει «δεν το είδαμε». Άρα μετριέται και το ΑΝΟΙΓΜΑ ΤΗΣ ΟΘΟΝΗΣ: πόσο
 * απέχουν τα μποφόρ της πιο ήσυχης από τα μποφόρ της πιο εκτεθειμένης παραλίας, στην ίδια
 * περιοχή την ίδια μέρα. Αν το άνοιγμα είναι σχεδόν πάντα 0-1, τότε για να σκεπάσει η λέξη ένα
 * σκαλί χρώματος πρέπει η περιοχή να κάθεται ΑΚΡΙΒΩΣ πάνω στο 6/7 — σπάνιο εξ ορισμού, όχι
 * σπάνιο επειδή έτυχε.
 */
const screenSpreads = [];
let screensStraddling = 0;
let screensTouchingTopBand = 0;

// ── Β. ΟΙ ΙΣΟΠΑΛΙΕΣ ──────────────────────────────────────────────────────────────────────────
const ties = {
  screens: 0, pairs: 0, tiedPairs: 0,
  seaGaps: [], windGaps: [], overMeaningful: 0, tiedBeaches: 0, visibleBeaches: 0,
};

for (const [, all] of screens) {
  // Ο ΑΛΗΘΙΝΟΣ επιλογέας της λίστας, όχι αντίγραφό του.
  const visible = selectSuitableByTone(all, item => item.tone ?? undefined, () => 0);
  const visibleSet = new Set(visible);

  const bandWind = all.filter(r => r.windLevel === 4);
  if (bandWind.length) {
    topWind.screensWithBand += 1;
    topWind.rows += bandWind.length;
    topWind.atSeven += bandWind.filter(r => r.beaufort >= RED_BEAUFORT).length;
    const bfs = bandWind.map(r => r.beaufort);
    topWind.spreads.push(Math.max(...bfs) - Math.min(...bfs));
    if (bfs.some(b => b < RED_BEAUFORT) && bfs.some(b => b >= RED_BEAUFORT)) {
      topWind.screensHidingColourStep += 1;
    }
  }
  const allBfs = all.map(r => r.beaufort);
  if (allBfs.length) {
    const lo = Math.min(...allBfs);
    const hi = Math.max(...allBfs);
    screenSpreads.push(hi - lo);
    if (hi >= 6) screensTouchingTopBand += 1;
    if (lo <= 6 && hi >= RED_BEAUFORT) screensStraddling += 1;
  }

  const bandWave = all.filter(r => r.waveLevel === 4);
  if (bandWave.length) {
    topWave.screensWithBand += 1;
    topWave.rows += bandWave.length;
    const ms = bandWave.map(r => r.cardShoreM);
    const spread = Math.max(...ms) - Math.min(...ms);
    topWave.spreads.push(spread);
    if (spread > MEANINGFUL_SEA_M) topWave.screensOverMeaningful += 1;
  }
  topWindVisible.rows += visible.filter(r => r.windLevel === 4).length;
  topWindVisible.atSeven += visible.filter(r => r.windLevel === 4 && r.beaufort >= RED_BEAUFORT).length;
  topWaveVisible.rows += visible.filter(r => r.waveLevel === 4).length;

  // Ισοπαλίες ΜΟΝΟ πάνω στις ορατές — δύο κάρτες που δεν εμφανίζονται ποτέ μαζί δεν συγκρίνονται.
  if (visible.length >= 2) {
    ties.screens += 1;
    ties.visibleBeaches += visible.length;
    const tied = new Set();
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const a = visible[i];
        const b = visible[j];
        ties.pairs += 1;
        if (a.windLevel !== b.windLevel || a.waveLevel !== b.waveLevel) continue;
        ties.tiedPairs += 1;
        tied.add(a).add(b);
        ties.windGaps.push(Math.abs(a.beaufort - b.beaufort));
        if (typeof a.cardShoreM === 'number' && typeof b.cardShoreM === 'number') {
          const gap = Math.abs(a.cardShoreM - b.cardShoreM);
          ties.seaGaps.push(gap);
          if (gap > MEANINGFUL_SEA_M) ties.overMeaningful += 1;
        }
      }
    }
    ties.tiedBeaches += tied.size;
  }
}

/**
 * Η ΑΠΟΔΕΙΞΗ ΠΟΥ ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ ΔΕΙΓΜΑ — ΚΑΙ ΓΙ' ΑΥΤΟ ΕΙΝΑΙ Η ΚΑΛΗ ΑΠΑΝΤΗΣΗ ΣΤΟ Α.
 *
 * Το ερώτημα ήταν «η λέξη Δυνατός αέρας σκεπάζει και 6 και 9 Μποφόρ — χάνει ο αναγνώστης
 * απόφαση;». Πέντε μέρες πρόγνωσης δεν μπορούν να το απαντήσουν: αν δεν φυσήξει 7άρι, το μηδέν
 * δεν λέει τίποτα. Ο κώδικας όμως το απαντά ΚΑΘΟΛΙΚΑ, σε δύο γραμμές που δεν εξαρτώνται από τον
 * καιρό:
 *
 *   1. `resolveWindTone` γυρίζει **κόκκινο** για κάθε μποφόρ ≥7, ό,τι γεωμετρία κι αν έχει η ακτή.
 *   2. Η λίστα των προτάσεων δεν ΠΕΡΙΕΧΕΙ κόκκινο: `SUITABLE_LIST_TONE_RANK` είναι
 *      ['blue','yellow','orange'] — δομικά, όχι με φίλτρο.
 *
 * Άρα σε κάθε επιφάνεια που ΠΡΟΤΕΙΝΕΙ, η λέξη «Δυνατός αέρας» σημαίνει ΑΚΡΙΒΩΣ 6 Μποφόρ. Η πάνω
 * βαθμίδα δεν είναι ανοιχτή εκεί που κρίνεται· είναι μία τιμή.
 *
 * Μένει η περίπτωση όπου ο επισκέπτης ΖΗΤΗΣΕ συγκεκριμένη παραλία (αναζήτηση, αγαπημένα): εκεί
 * μπορεί να δει «Δυνατός αέρας» πάνω σε 8 Μποφόρ — και εκεί ακριβώς η κάρτα φοράει υποχρεωτικά
 * το πλακίδιο ετυμηγορίας (`forceTodayScoreBadge`), που μιλάει με άλλα λόγια.
 *
 * Αν κάποιος αλλάξει είτε το κατώφλι είτε τη λίστα, η απόδειξη παύει να ισχύει — γι' αυτό
 * ελέγχεται εδώ αντί να γραφτεί σαν σχόλιο.
 */
const proof = { redAtSeven: true, redOutOfSuitableList: true, notes: [] };
for (const level of ['protected', 'partial', 'exposed']) {
  for (const bft of [7, 8, 9, 10, 12]) {
    if (resolveWindTone(level, bft) !== 'red') {
      proof.redAtSeven = false;
      proof.notes.push(`resolveWindTone('${level}', ${bft}) δεν είναι κόκκινο`);
    }
  }
}
{
  const items = [{ tone: 'red' }, { tone: 'orange' }];
  const chosen = selectSuitableByTone(items, item => item.tone, () => 0);
  if (chosen.some(item => item.tone === 'red')) {
    proof.redOutOfSuitableList = false;
    proof.notes.push('η λίστα προτάσεων δέχτηκε κόκκινο');
  }
}
const topBandIsSingleValuedWhereItRecommends = proof.redAtSeven && proof.redOutOfSuitableList;

const sample = buildConditionsFeel({ beaufort: 7, waveM: 1.6, language: 'gr' });

const report = {
  generatedAt: new Date().toISOString(),
  source: { cache: '.tmp/colour-cause-split-cache.json', codeStamp: cache.codeStamp },
  scope: { regions: regions.length, screens: screens.size, beachDays: rowsTotal },
  meaningfulSeaM: MEANINGFUL_SEA_M,
  topWindBand: {
    beachDays: topWind.rows,
    shareOfAll: topWind.rows / rowsTotal,
    atOrAboveRedBeaufort: topWind.atSeven,
    screensWithBand: topWind.screensWithBand,
    screensHidingAColourStep: topWind.screensHidingColourStep,
    medianSpreadBft: median(topWind.spreads),
    p95SpreadBft: p95(topWind.spreads),
    onRecommendedSurface: { beachDays: topWindVisible.rows, atOrAboveRedBeaufort: topWindVisible.atSeven },
  },
  topWaveBand: {
    beachDays: topWave.rows,
    shareOfAll: topWave.rows / rowsTotal,
    screensWithBand: topWave.screensWithBand,
    screensSpreadOverMeaningful: topWave.screensOverMeaningful,
    medianSpreadM: topWave.spreads.length ? Number(median(topWave.spreads).toFixed(2)) : null,
    p95SpreadM: topWave.spreads.length ? Number(p95(topWave.spreads).toFixed(2)) : null,
    onRecommendedSurface: { beachDays: topWaveVisible.rows },
  },
  screenSpread: {
    medianBft: median(screenSpreads),
    p95Bft: p95(screenSpreads),
    maxBft: screenSpreads.length ? Math.max(...screenSpreads) : null,
    screensWhereSpreadIsZero: screenSpreads.filter(v => v === 0).length,
    screensTouchingTopBand,
    screensStraddlingSixAndSeven: screensStraddling,
  },
  ties: {
    screens: ties.screens,
    visibleBeaches: ties.visibleBeaches,
    beachesSharingTheirWordsWithAnother: ties.tiedBeaches,
    pairsCompared: ties.pairs,
    tiedPairs: ties.tiedPairs,
    tiedPairsHidingAMeaningfulSeaGap: ties.overMeaningful,
    medianSeaGapBehindATieM: ties.seaGaps.length ? Number(median(ties.seaGaps).toFixed(2)) : null,
    p95SeaGapBehindATieM: ties.seaGaps.length ? Number(p95(ties.seaGaps).toFixed(2)) : null,
    medianWindGapBehindATieBft: median(ties.windGaps),
    p95WindGapBehindATieBft: p95(ties.windGaps),
  },
};

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
const out = path.join(root, 'reports/quality/card-word-resolution.json');
writeFileSync(out, JSON.stringify(report, null, 2));

console.log(`\n── ΠΟΣΟ ΚΡΥΒΕΙ Η ΛΕΞΗ · ${regions.length} περιοχές × ${screens.size} οθόνες × ${rowsTotal} μετρήσεις παραλία×μέρα ──\n`);
console.log(`Α. Η ΠΑΝΩ ΒΑΘΜΙΔΑ ΤΟΥ ΑΝΕΜΟΥ («Δυνατός αέρας», ≥6 Μποφόρ) — ⚠️ ΜΕ ΤΟΝ ΑΡΙΘΜΟ ΤΗΣ ΠΕΡΙΟΧΗΣ`);
console.log(`   παραλιο-μέρες μέσα της: ${topWind.rows} (${pct(topWind.rows, rowsTotal)} του συνόλου)`);
console.log(`   από αυτές στα ≥7 Μποφόρ (κόκκινο, όχι πορτοκαλί): ${topWind.atSeven} (${pct(topWind.atSeven, topWind.rows)})`);
console.log(`   οθόνες όπου η ΙΔΙΑ λέξη σκεπάζει και 6 και ≥7: ${topWind.screensHidingColourStep} από ${screens.size} (${pct(topWind.screensHidingColourStep, screens.size)})`);
console.log(`   διάμεσο άνοιγμα μέσα στη βαθμίδα: ${median(topWind.spreads)} Μποφόρ · p95: ${p95(topWind.spreads)}`);
console.log(`   ΣΤΙΣ ΠΡΟΤΑΣΕΙΣ (οι δύο καλύτερες αποχρώσεις): ${topWindVisible.rows} παραλιο-μέρες, από αυτές ≥7 Μποφόρ: ${topWindVisible.atSeven}\n`);
console.log(`Α2. ΤΟ ΑΝΟΙΓΜΑ ΤΗΣ ΟΘΟΝΗΣ (πιο ήσυχη έναντι πιο εκτεθειμένης, ίδια περιοχή/μέρα)`);
console.log(`   διάμεσο: ${median(screenSpreads)} Μποφόρ · p95: ${p95(screenSpreads)} · μέγιστο: ${report.screenSpread.maxBft}`);
console.log(`   οθόνες με μηδενικό άνοιγμα (όλες οι παραλίες ίδια μποφόρ): ${report.screenSpread.screensWhereSpreadIsZero} από ${screens.size} (${pct(report.screenSpread.screensWhereSpreadIsZero, screens.size)})`);
console.log(`   οθόνες που ακουμπάνε την πάνω βαθμίδα (κάποια παραλία ≥6): ${screensTouchingTopBand} (${pct(screensTouchingTopBand, screens.size)})`);
console.log(`   οθόνες που περιέχουν ΚΑΙ 6 ΚΑΙ ≥7: ${screensStraddling}\n`);
console.log(`Β. Η ΠΑΝΩ ΒΑΘΜΙΔΑ ΤΟΥ ΚΥΜΑΤΟΣ («μεγάλο κύμα», ≥1,2 μ.)`);
console.log(`   παραλιο-μέρες μέσα της: ${topWave.rows} (${pct(topWave.rows, rowsTotal)})`);
console.log(`   διάμεσο άνοιγμα: ${report.topWaveBand.medianSpreadM} μ. · p95: ${report.topWaveBand.p95SpreadM} μ.`);
console.log(`   οθόνες με άνοιγμα πάνω από το σημαντικό (0,25 μ.): ${topWave.screensOverMeaningful} από ${screens.size} (${pct(topWave.screensOverMeaningful, screens.size)})`);
console.log(`   ΣΤΙΣ ΠΡΟΤΑΣΕΙΣ: ${topWaveVisible.rows} παραλιο-μέρες\n`);
console.log(`Γ. ΟΙ ΙΣΟΠΑΛΙΕΣ ΣΤΙΣ ΠΡΟΤΑΣΕΙΣ (δύο κάρτες, ίδιο ζευγάρι λέξεων)`);
console.log(`   ορατές παραλίες: ${ties.visibleBeaches} σε ${ties.screens} οθόνες`);
console.log(`   γράφουν το ίδιο με τουλάχιστον μία άλλη: ${ties.tiedBeaches} (${pct(ties.tiedBeaches, ties.visibleBeaches)})`);
console.log(`   ζεύγη σε ισοπαλία: ${ties.tiedPairs} από ${ties.pairs} (${pct(ties.tiedPairs, ties.pairs)})`);
console.log(`   διάμεση αληθινή διαφορά θάλασσας πίσω από ισοπαλία: ${report.ties.medianSeaGapBehindATieM} μ. · p95: ${report.ties.p95SeaGapBehindATieM} μ.`);
console.log(`   ισοπαλίες που κρύβουν διαφορά ΠΑΝΩ από το σημαντικό (0,25 μ.): ${ties.overMeaningful} (${pct(ties.overMeaningful, ties.tiedPairs)} των ισοπαλιών)`);
console.log(`   διάμεση διαφορά ανέμου πίσω από ισοπαλία: ${median(ties.windGaps)} Μποφόρ · p95: ${p95(ties.windGaps)}\n`);
console.log(`Δείγμα φράσης 7 Μποφόρ / 1,6 μ.: «${sample?.phrase}»`);
/**
 * ΟΙ ΠΥΛΕΣ ΔΙΑΚΟΠΗΣ, ΓΡΑΜΜΕΝΕΣ ΠΡΙΝ ΤΡΕΞΕΙ Η ΜΕΤΡΗΣΗ (22/08/2026).
 *
 * Χωρίς αυτές, όποιο νούμερο κι αν έβγαινε θα διαβαζόταν ως «μια χαρά είμαστε». Το §Γ14 όρισε
 * πύλη διακοπής («αν >60% των πορτοκαλί έχει λάδι νερό, σταματάμε») ΠΡΙΝ γράψει γραμμή UI, και
 * γι' αυτό η μέτρησή του σημαίνει κάτι.
 *
 *   Α. Αν σε ≥10% των οθονών η ίδια λέξη σκεπάζει και 6 και ≥7 Μποφόρ, η λέξη κρύβει σκαλί
 *      ΧΡΩΜΑΤΟΣ αρκετά συχνά ώστε να χρειάζεται δουλειά. <2% = αδρανές, κλείνει ως μετρημένο.
 *      Ενδιάμεσα = απόφαση Μίλτου.
 *   Β. Αν >20% των ισοπαλιών κρύβει διαφορά θάλασσας πάνω από το ΔΙΚΟ ΜΑΣ όριο σημαντικότητας
 *      (0,25 μ.), η λέξη κοστίζει πραγματική σύγκριση. <5% = αδρανές.
 */
const colourStepShare = topWind.screensHidingColourStep / screens.size;
const tieShare = ties.tiedPairs ? ties.overMeaningful / ties.tiedPairs : 0;
const verdict = (share, inert, act) => (share < inert ? 'ΑΔΡΑΝΕΣ' : share >= act ? 'ΧΡΕΙΑΖΕΤΑΙ ΔΟΥΛΕΙΑ' : 'ΑΠΟΦΑΣΗ ΜΙΛΤΟΥ');
/**
 * Η ΠΥΛΗ Α ΔΕΝ ΚΡΙΝΕΤΑΙ ΕΔΩ, ΚΑΙ ΤΟ ΛΕΕΙ ΑΝΤΙ ΝΑ ΠΕΡΑΣΕΙ.
 *
 * Ο άνεμος αυτής της μνήμης είναι της περιοχής (δες την κεφαλίδα και τον έλεγχο Α2). Ένα «0%»
 * βγαλμένο από ενιαίο αριθμό θα ήταν το χειρότερο είδος πράσινου: αληθινό νούμερο, λάθος
 * ερώτημα. Το αυτοτέστ είναι το ίδιο το Α2 — αν ΟΛΕΣ οι οθόνες έχουν άνοιγμα 0, δεν υπάρχει
 * περίπτωση να δούμε ποτέ 6 και 7 μαζί, ό,τι καιρό κι αν κάνει.
 */
const windHarnessIsRegionUniform = screenSpreads.length > 0 && Math.max(...screenSpreads) === 0;
report.structuralProof = {
  redAtSevenBeaufort: proof.redAtSeven,
  redNeverInSuitableList: proof.redOutOfSuitableList,
  topBandIsSingleValuedWhereItRecommends,
  notes: proof.notes,
};
report.gates = {
  colourStepHiddenShare: colourStepShare,
  colourStepVerdict: topBandIsSingleValuedWhereItRecommends
    ? 'ΚΛΕΙΣΤΟ ΜΕ ΑΠΟΔΕΙΞΗ ΚΩΔΙΚΑ (στις προτάσεις «Δυνατός αέρας» = ακριβώς 6 Μποφόρ)'
    : windHarnessIsRegionUniform ? 'ΑΜΕΤΡΗΤΟ ΕΔΩ (ο άνεμος είναι της περιοχής)' : verdict(colourStepShare, 0.02, 0.10),
  windHarnessIsRegionUniform,
  meaningfulSeaGapBehindTiesShare: tieShare,
  tieVerdict: verdict(tieShare, 0.05, 0.20),
  tieRateIsAnUpperBound: windHarnessIsRegionUniform,
};
writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`\nΠΥΛΕΣ ΔΙΑΚΟΠΗΣ (γραμμένες πριν τη μέτρηση)`);
console.log(`   Α · λέξη πάνω από σκαλί χρώματος: ${report.gates.colourStepVerdict}`);
if (!topBandIsSingleValuedWhereItRecommends) {
  console.log(`       ⛔ Η ΑΠΟΔΕΙΞΗ ΕΠΕΣΕ: ${proof.notes.join(' · ')}`);
}
if (windHarnessIsRegionUniform) {
  console.log(`       (άνοιγμα 0 σε ΟΛΕΣ τις οθόνες ⇒ ο άνεμος εδώ είναι ενιαίος ανά περιοχή· η κάρτα`);
  console.log(`        τυπώνει τον δικό της, που απέχει ≥1 Μποφόρ στο 35,9% των παραλιο-ωρών)`);
}
console.log(`   Β · ισοπαλία πάνω από 0,25 μ.: ${(tieShare * 100).toFixed(1)}% των ισοπαλιών → ${report.gates.tieVerdict}   (αδρανές <5%, δουλειά >20%)`);
if (windHarnessIsRegionUniform) {
  console.log(`       (η ΣΥΧΝΟΤΗΤΑ ισοπαλίας είναι ΑΝΩ ΦΡΑΓΜΑ: με πραγματικό ανά-παραλία άνεμο κάποιες`);
  console.log(`        θα έσπαγαν. Η ΔΙΑΦΟΡΑ ΘΑΛΑΣΣΑΣ πίσω τους είναι αληθινή — το κύμα είναι ανά παραλία.)`);
}
console.log(`\nΑναφορά: reports/quality/card-word-resolution.json`);
