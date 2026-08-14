/**
 * Η ΛΕΖΑΝΤΑ ΠΡΟΣΒΑΣΗΣ ΠΕΡΙΓΡΑΦΕΙ ΤΗΝ ΠΑΡΑΛΙΑ ΠΟΥ ΠΕΡΙΓΡΑΦΕΙ.
 *
 * Γιατί υπάρχει: μέχρι τις 14/08/2026 υπήρχε ΜΙΑ πρόταση για κάθε παραλία που δεν είναι άσφαλτος —
 * «Θέλει σκάφος ή δύσκολο μονοπάτι». Το φίλτρο από πίσω (`hasMainstreamTopPickAccess`) κόβει όμως
 * και χωματόδρομους, και εύκολα μονοπάτια, και άγνωστους δρόμους, και κάθε «απομακρυσμένη». Ο
 * Κλειδός και η Σπεδό Νάξου φορούσαν τη λεζάντα με **περπατητό χωματόδρομο**· το Άλιμος Λουτρά με
 * άγνωστο τύπο δρόμου. Καμία από τις 38 τότε πύλες δεν το έπιανε, επειδή το κείμενο ζούσε μέσα σε
 * component και ήταν αδιάβαστο από script.
 *
 * Τι ελέγχει, πάνω στον ΠΡΑΓΜΑΤΙΚΟ κώδικα (`utils/access.getHardAccessKind` +
 * `utils/accessReasonCopy`) και σε ΚΑΘΕ παραλία της χώρας, σε 5 γλώσσες:
 *
 *   1. «Σκάφος» μόνο όπου χρειάζεται σκάφος — καμία παραλία με χωματόδρομο, μονοπάτι ή άγνωστο
 *      δρόμο δεν βλέπει τη λέξη, σε καμία γλώσσα.
 *   2. Ο χωματόδρομος λέγεται χωματόδρομος, το περπάτημα περπάτημα.
 *   3. Καμία πρόταση δεν μιλάει για τη ΔΙΚΗ ΜΑΣ λίστα ή κατάταξη.
 *   4. Ο άγνωστος δρόμος σωπαίνει.
 *   5. Καμία παραλία με άσφαλτο και μη-απομακρυσμένη δεν παίρνει καθόλου λεζάντα.
 *
 * Αυτοαποδεικνύεται: με `--prove` ξανατρέχει με τρία σαμποτάζ (όλα στη φράση του σκάφους, ο
 * χωματόδρομος να μιλάει για τη λίστα, ο άγνωστος να μιλάει) και ΠΡΕΠΕΙ να κοκκινίσει και στα τρία.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getHardAccessKind, type HardAccessKind } from '../utils/access';
import { ACCESS_REASON_COPY, getAccessReasonCopy } from '../utils/accessReasonCopy';
import { SUPPORTED_LANGUAGES } from '../utils/i18n';
import type { Beach, LanguageCode } from '../types';

// The wrapper compiles this into .tmp/ and runs it with cwd = repo root, so __dirname points at
// the build output rather than the repository — the data has to be resolved from cwd.
const ROOT = process.cwd();
const BEACH_DIR = path.join(ROOT, 'public', 'data', 'beaches');

/** Η λέξη «σκάφος» σε κάθε γλώσσα που τυπώνουμε, όπως θα τη διάβαζε ο επισκέπτης. */
const BOAT_WORDS = /σκάφ|βάρκ|boat|boot|bateau|barca/i;
/** Λέξεις που περιγράφουν χωματόδρομο. */
const DIRT_WORDS = /χωματ|unpaved|schotter|piste en terre|sterrat/i;
/** Λέξεις που περιγράφουν περπάτημα. */
const WALK_WORDS = /περπάτ|walk|zu fuß|marcher|cammin/i;
/**
 * Λέξεις που μιλάνε για ΕΜΑΣ αντί για την παραλία. Το «μετά τις εύκολες» ήταν ακριβώς αυτό, και
 * ήταν και λάθος: η λίστα ταξινομείται χρώμα πρώτα, η πρόσβαση κρίνει μόνο μέσα στο ίδιο χρώμα.
 */
const OUR_LIST_WORDS = /μετά τις εύκολες|ranks after|daher nach|donc après|viene dopo|προτάσε|recommend|κατάταξ/i;

type Failure = { beach: string; language: string; kind: string; problem: string };

const loadBeaches = (): Beach[] => {
  const seen = new Set<number>();
  const beaches: Beach[] = [];
  for (const file of readdirSync(BEACH_DIR).filter(name => name.endsWith('.json'))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path.join(BEACH_DIR, file), 'utf8'));
    } catch {
      continue;
    }
    const list = Array.isArray(parsed) ? parsed : ((parsed as { beaches?: unknown[] })?.beaches ?? []);
    for (const entry of list as Beach[]) {
      if (!entry?.id || !entry?.name || seen.has(entry.id)) continue;
      seen.add(entry.id);
      beaches.push(entry);
    }
  }
  return beaches;
};

type CopyResolver = (kind: HardAccessKind, language: LanguageCode) => string;

const run = (resolve: CopyResolver): Failure[] => {
  const beaches = loadBeaches();
  if (beaches.length < 2000) {
    throw new Error(`Διάβασα μόνο ${beaches.length} παραλίες — το dataset δεν φορτώθηκε σωστά.`);
  }

  const failures: Failure[] = [];
  const counts = new Map<string, number>();

  for (const beach of beaches) {
    const kind = getHardAccessKind(beach);
    counts.set(kind ?? 'εύκολη', (counts.get(kind ?? 'εύκολη') ?? 0) + 1);
    if (!kind) continue;

    // `Beach['name']` is the localized record (types.ts:282); the raw region files also carry a
    // plain string on some tiers, so both shapes are accepted rather than trusted blindly.
    const label = typeof beach.name === 'string' ? beach.name : (beach.name?.gr ?? beach.name?.en ?? `#${beach.id}`);

    for (const language of SUPPORTED_LANGUAGES) {
      const sentence = resolve(kind, language);
      const add = (problem: string) => failures.push({ beach: label, language, kind, problem });

      if (kind === 'unknown') {
        if (sentence !== '') add('άγνωστος δρόμος, αλλά η κάρτα μιλάει');
        continue;
      }

      if (!sentence) {
        add('δεν τυπώνεται καμία πρόταση');
        continue;
      }
      if (OUR_LIST_WORDS.test(sentence)) add('η πρόταση μιλάει για τη λίστα μας, όχι για την παραλία');
      if (kind !== 'boat_or_hard_path' && BOAT_WORDS.test(sentence)) add('λέει «σκάφος» χωρίς να χρειάζεται σκάφος');
      if (kind === 'dirt_road' && !DIRT_WORDS.test(sentence)) add('χωματόδρομος που δεν λέγεται χωματόδρομος');
      if (kind === 'walk' && !WALK_WORDS.test(sentence)) add('περπάτημα που δεν λέγεται περπάτημα');
    }
  }

  // Ένα σιωπηλό «όλα καλά» επειδή κανένας κάδος δεν γέμισε θα ήταν διακοσμητική πύλη.
  for (const kind of ['boat_or_hard_path', 'dirt_road', 'walk', 'unknown'] as const) {
    if ((counts.get(kind) ?? 0) === 0) {
      failures.push({ beach: '—', language: '—', kind, problem: 'κανένα δείγμα: η πύλη δεν μέτρησε τίποτα' });
    }
  }

  if (process.env.ACCESS_COPY_VERBOSE) {
    console.log([...counts.entries()].map(([k, v]) => `${k}: ${v}`).join(' · '));
  }
  return failures;
};

const report = (failures: Failure[]): void => {
  const shown = failures.slice(0, 12);
  for (const failure of shown) {
    console.error(`  ✗ ${failure.beach} [${failure.language}/${failure.kind}] — ${failure.problem}`);
  }
  if (failures.length > shown.length) console.error(`  … και άλλα ${failures.length - shown.length}`);
};

const honest = run(getAccessReasonCopy);
if (honest.length > 0) {
  console.error(`✗ access-reason-copy: ${honest.length} αστοχίες`);
  report(honest);
  process.exit(1);
}

if (process.argv.includes('--prove')) {
  const sabotages: Array<[string, CopyResolver]> = [
    ['όλα στη φράση του σκάφους', (_kind, language) => getAccessReasonCopy('boat_or_hard_path', language)],
    ['ο χωματόδρομος μιλάει για τη λίστα μας', (kind, language) => (
      kind === 'dirt_road' ? 'Χωματόδρομος, γι’ αυτό μπαίνει μετά τις εύκολες.' : getAccessReasonCopy(kind, language)
    )],
    ['ο άγνωστος δρόμος σπάει τη σιωπή του', (kind, language) => (
      kind === 'unknown' ? 'Δεν έχουμε ελέγξει τον δρόμο της.' : getAccessReasonCopy(kind, language)
    )],
  ];
  for (const [label, resolver] of sabotages) {
    if (run(resolver).length === 0) {
      console.error(`✗ αυτοέλεγχος: το σαμποτάζ «${label}» πέρασε — η πύλη είναι διακοσμητική`);
      process.exit(1);
    }
  }
  console.log(`✓ αυτοέλεγχος: και τα ${sabotages.length} σαμποτάζ κοκκίνισαν`);
}

const languages = SUPPORTED_LANGUAGES.length;
const sentences = Object.keys(ACCESS_REASON_COPY).length * languages;
console.log(`✓ access-reason-copy: κάθε παραλία της χώρας × ${languages} γλώσσες, ${sentences} προτάσεις — καμία λέει «σκάφος» χωρίς σκάφος`);
