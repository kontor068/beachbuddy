/**
 * Η ΠΥΛΗ ΤΗΣ ΠΡΟΤΑΣΗΣ «ΣΗΜΕΡΑ ΟΧΙ — Η ΠΕΜΠΤΗ ΝΑΙ» (22/08/2026).
 *
 * Η ΑΙΤΙΑ ΠΟΥ ΦΥΛΑΕΙ. Όταν η σελίδα λέει «δεν υπάρχει καθαρή επιλογή», προτείνει την επόμενη
 * μέρα που περνάει τον ΙΔΙΟ πήχη. Δύο τρόποι να γίνει αυτό ψέμα, και οι δύο σιωπηλοί:
 *
 *   α) να προταθεί μέρα που είναι η ίδια κακή — «πιο ήρεμη θάλασσα» πάνω από 6 Μποφόρ, επειδή
 *      έτυχε ένας όρμος να περνάει οριακά. Ο επισκέπτης πάει και βρίσκει το ίδιο.
 *   β) να προταθεί μέρα «λιγότερο χάλια» αντί για σιωπή. Η σιωπή είναι σωστή απάντηση.
 *
 * Και τα δύο εξαρτώνται από μία γραμμή μέσα στο `findBestDayAhead`. Η βίβλος καταγράφει πού
 * ματώσαμε· η πύλη εμποδίζει την επανάληψη.
 *
 * ΟΛΑ ΤΑ ΚΡΙΝΕΙ ΤΟ ΠΡΟΪΟΝ: πραγματική περιοχή από τον δίσκο, πραγματικά προφίλ έκθεσης,
 * πραγματικό `getSuitableBeaches` μέσα στο `findBestDayAhead`, πραγματικός κατασκευαστής ημερών
 * (`utils/weatherFixtures.createDailyForecast`). Εδώ γράφεται μόνο ο ΚΑΙΡΟΣ των έξι ημερών.
 *
 * ΑΥΤΟΑΠΟΔΕΙΞΗ: με `--prove` ξανατρέχει τα ίδια σενάρια με δύο σκόπιμα χαλασμένους «επιλογείς»
 * (ένας που αγνοεί την κακοκαιρία, ένας που παίρνει την τελευταία μέρα). Αν επιβιώσει έστω ένας,
 * η πύλη είναι διακοσμητική και σκάει.
 *
 * Run: node scripts/validateBestDayAheadOffer.mjs [--prove]
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

require.extensions['.ts'] = (module, filename) => {
  if (filename.endsWith(`${path.sep}services${path.sep}analyticsService.ts`)) {
    module._compile(
      'exports.getNegativeFeedbackCount = function () { return 0; };\n'
      + 'exports.recordOpenMeteoCall = function () {};\n',
      filename
    );
    return;
  }
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

const { createDailyForecast } = require(path.join(root, 'utils/weatherFixtures.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { getSuitableBeaches } = require(path.join(root, 'services/recommendationService.ts'));
const {
  buildBestDayAheadCopy, countSwimmableBeaches, findBestDayAhead, isSevereConditionsDay,
} = require(path.join(root, 'utils/bestDayAhead.ts'));

const PROVE = process.argv.includes('--prove');
const REGION_ID = 'south-aegean-paros';

const region = (() => {
  const app = JSON.parse(readFileSync(path.join(root, `public/data/beaches/app/${REGION_ID}.json`), 'utf8'));
  const profilesRaw = JSON.parse(readFileSync(path.join(root, `public/data/geospatial/exposure/${REGION_ID}.json`), 'utf8')).profiles;
  const profiles = {};
  for (const profile of Object.values(profilesRaw ?? {})) {
    if (profile?.beachId != null) profiles[profile.beachId] = profile;
  }
  return { beaches: app.island.beaches, profiles };
})();

/** m/s per day → the six-day sequence, built by the product's own fixture builder. */
const buildDays = (perDay) => {
  const scenario = {
    id: 'best-day-ahead-gate',
    label: 'gate',
    windDirectionDeg: 20,
    windSpeedMs: perDay[0].windMs,
    windGustMs: perDay[0].windMs * 1.35,
    waveHeightM: perDay[0].waveM,
    waveDirectionDeg: 20,
    days: perDay.map(day => ({
      windDirectionDeg: 20,
      windSpeedMs: day.windMs,
      windGustMs: day.windMs * 1.35,
      waveHeightM: day.waveM,
      waveDirectionDeg: 20,
    })),
  };
  return perDay.map((_, index) => createDailyForecast(index, scenario));
};

const swimmableOn = (days, dayIndex) => {
  const day = days[dayIndex];
  const scored = getSuitableBeaches(region.beaches, day, 'gr', undefined, day.hourly, undefined, {}, region.profiles);
  return countSwimmableBeaches(scored, (day.wind?.speed ?? 0) * 3.6, day.marine?.waveHeightM);
};

const severeOn = (days, dayIndex) => isSevereConditionsDay(
  days[dayIndex],
  getBeaufortLevel((days[dayIndex].wind?.speed ?? 0) * 3.6)
);

const offer = (days, fromDayIndex = 0) => findBestDayAhead({
  beaches: region.beaches,
  forecasts: days,
  beachForecasts: {},
  language: 'gr',
  geospatialProfiles: region.profiles,
  fromDayIndex,
});

const GALE = 17;   // ~7 Bft
const BREEZY = 8;  // ~5 Bft (29 km/h) with a flat sea: «severe» by the day-level bar, yet 17 Paros
                   // beaches clear the swimmable test. Measured 22/08/2026 — this is the case that
                   // an over-strict «only calm days» rule silently threw away.
const CALM = 3;    // ~2 Bft

/**
 * Each scenario says what the six days look like and what the offer must be.
 * `expect` is the day index we must land on, or null for silence.
 */
const scenarios = [
  {
    id: 'soonest-calm-wins',
    why: 'Δύο ήρεμες μέρες μπροστά — προτείνεται η ΠΡΩΤΗ, όχι η καλύτερη ή η τελευταία.',
    days: [
      { windMs: GALE, waveM: 1.6 }, { windMs: GALE, waveM: 1.4 },
      { windMs: CALM, waveM: 0.2 }, { windMs: CALM, waveM: 0.1 },
      { windMs: GALE, waveM: 1.5 }, { windMs: CALM, waveM: 0.2 },
    ],
    expect: 2,
  },
  {
    id: 'tomorrow-wins',
    why: 'Η αυριανή ηρεμία προτείνεται αμέσως.',
    days: [
      { windMs: GALE, waveM: 1.8 }, { windMs: CALM, waveM: 0.2 },
      { windMs: CALM, waveM: 0.2 }, { windMs: CALM, waveM: 0.2 },
      { windMs: CALM, waveM: 0.2 }, { windMs: CALM, waveM: 0.2 },
    ],
    expect: 1,
  },
  {
    id: 'all-rough-stays-silent',
    why: 'Καμία ήρεμη μέρα → σιωπή. «Λιγότερο χάλια» δεν είναι πρόταση.',
    days: Array.from({ length: 6 }, () => ({ windMs: GALE, waveM: 1.6 })),
    expect: null,
  },
  {
    id: 'breezy-but-swimmable-is-a-real-offer',
    why: 'Μέρα με 5 Μποφόρ και επίπεδη θάλασσα ΕΧΕΙ παραλίες — δεν επιτρέπεται να τη σβήσουμε.',
    days: [
      { windMs: GALE, waveM: 1.8 }, { windMs: BREEZY, waveM: 0.2 },
      { windMs: BREEZY, waveM: 0.2 }, { windMs: BREEZY, waveM: 0.2 },
      { windMs: BREEZY, waveM: 0.2 }, { windMs: BREEZY, waveM: 0.2 },
    ],
    expect: 1,
  },
  {
    id: 'looks-forward-from-the-selected-day',
    why: 'Κοιτάει μπροστά από τη ΜΕΡΑ ΠΟΥ ΒΛΕΠΕΙ ο επισκέπτης, όχι από το σήμερα — η ήρεμη μέρα 1 έχει περάσει.',
    days: [
      { windMs: GALE, waveM: 1.8 }, { windMs: CALM, waveM: 0.2 },
      { windMs: GALE, waveM: 1.7 }, { windMs: GALE, waveM: 1.7 },
      { windMs: GALE, waveM: 1.7 }, { windMs: CALM, waveM: 0.2 },
    ],
    from: 3,
    expect: 5,
  },
];

const failures = [];
const note = (message) => failures.push(message);

for (const scenario of scenarios) {
  const days = buildDays(scenario.days);
  const from = scenario.from ?? 0;

  if (!severeOn(days, from)) {
    note(`${scenario.id}: το σενάριο δεν στήνει καν κακή μέρα στη θέση ${from} — άκυρο τεστ.`);
    continue;
  }

  const result = offer(days, from);
  const got = result?.dayIndex ?? null;
  if (got !== scenario.expect) {
    note(`${scenario.id}: περίμενα ${scenario.expect === null ? 'σιωπή' : `μέρα ${scenario.expect}`}, πήρα ${got === null ? 'σιωπή' : `μέρα ${got}`} — ${scenario.why}`);
    continue;
  }

  if (result) {
    // Η ΑΜΕΤΑΚΙΝΗΤΗ ΙΔΙΟΤΗΤΑ: η μέρα που προτείνουμε, κοιταγμένη ΩΣ σημερινή, δεν επιτρέπεται να
    // δείχνει την ίδια οθόνη αδιεξόδου. Δεν απαιτείται να είναι ήρεμη — απαιτείται να έχει κάτι.
    const offeredSwimmable = swimmableOn(days, result.dayIndex);
    if (offeredSwimmable === 0) {
      note(`${scenario.id}: προτάθηκε μέρα ${result.dayIndex} χωρίς καμία κολυμπήσιμη παραλία.`);
    }
    if (severeOn(days, result.dayIndex) && offeredSwimmable === 0) {
      note(`${scenario.id}: η μέρα ${result.dayIndex} είναι το ίδιο αδιέξοδο με σήμερα.`);
    }
    if (result.dayIndex <= from) {
      note(`${scenario.id}: η πρόταση κοιτάει πίσω (${result.dayIndex} ≤ ${from}).`);
    }
  }
}

// Τα λόγια: πέντε γλώσσες, καμία κενή, και η μέρα ονομάζεται.
const days = buildDays([
  { windMs: GALE, waveM: 1.8 }, { windMs: CALM, waveM: 0.2 },
  { windMs: CALM, waveM: 0.2 }, { windMs: CALM, waveM: 0.2 },
  { windMs: CALM, waveM: 0.2 }, { windMs: CALM, waveM: 0.2 },
]);
const copyOffer = offer(days, 0);
if (!copyOffer) {
  note('copy: το σενάριο των λέξεων δεν παρήγαγε πρόταση.');
} else {
  for (const language of ['en', 'gr', 'fr', 'de', 'it']) {
    const copy = buildBestDayAheadCopy(language, copyOffer.date);
    if (!copy?.line?.trim() || !copy?.action?.trim()) {
      note(`copy/${language}: κενή γραμμή ή κενό κουμπί.`);
      continue;
    }
    if (/\d/.test(copy.line)) {
      note(`copy/${language}: η γραμμή υπόσχεται αριθμό («${copy.line}») — η σελίδα κρίνει με άλλον κανόνα μία στιγμή μετά.`);
    }
    if (copy.line === copy.action) note(`copy/${language}: γραμμή και κουμπί ίδια.`);
  }
  const greek = buildBestDayAheadCopy('gr', copyOffer.date);
  if (!/αύριο|μεθαύριο|Δευτέρα|Τρίτη|Τετάρτη|Πέμπτη|Παρασκευή|Σάββατο|Κυριακή/i.test(greek.line)) {
    note(`copy/gr: η γραμμή δεν ονομάζει μέρα («${greek.line}»).`);
  }
}

if (PROVE) {
  /**
   * Τρεις σκόπιμα χαλασμένοι επιλογείς πάνω στα ΙΔΙΑ σενάρια. Και οι τρεις πρέπει να πέσουν.
   *  - `takesAnyNextDay`: «κάτι να πούμε» — προτείνει πάντα την αυριανή. Σπάει τη σιωπή.
   *  - `takesLast`: την τελευταία κατάλληλη αντί για την πρώτη. Στέλνει τον κόσμο πιο μακριά.
   *  - `onlyPerfectlyCalmDays`: η ΠΡΩΤΗ μου εκδοχή — απαιτούσε και η μέρα να μην είναι «κακή»,
   *    και έτσι έσβηνε τη μέρα των 5 Μποφόρ με τις 17 κολυμπήσιμες παραλίες.
   */
  const brokenPickers = {
    takesAnyNextDay: (allDays, from) => (from + 1 < allDays.length ? from + 1 : null),
    takesLast: (allDays, from) => {
      let last = null;
      for (let i = from + 1; i < allDays.length; i += 1) {
        if (swimmableOn(allDays, i) > 0) last = i;
      }
      return last;
    },
    onlyPerfectlyCalmDays: (allDays, from) => {
      for (let i = from + 1; i < allDays.length; i += 1) {
        if (!severeOn(allDays, i) && swimmableOn(allDays, i) > 0) return i;
      }
      return null;
    },
  };

  for (const [name, pick] of Object.entries(brokenPickers)) {
    let caught = false;
    for (const scenario of scenarios) {
      const scenarioDays = buildDays(scenario.days);
      const from = scenario.from ?? 0;
      if (pick(scenarioDays, from) !== scenario.expect) { caught = true; break; }
    }
    if (!caught) note(`--prove: ο χαλασμένος επιλογέας «${name}» πέρασε όλα τα σενάρια — η πύλη είναι διακοσμητική.`);
  }
}

if (failures.length > 0) {
  console.error('Η πύλη της πρότασης άλλης μέρας ΕΠΕΣΕ:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log(`Πρόταση άλλης μέρας: ${scenarios.length} σενάρια + λόγια σε 5 γλώσσες${PROVE ? ' + αυτοαπόδειξη' : ''} — όλα πέρασαν.`);
