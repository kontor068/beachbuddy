/**
 * ΤΟ `netlify.toml` ΔΙΑΒΑΖΕΤΑΙ — ΚΑΙ ΔΕΝ ΔΙΝΕΙ ΤΟ ΔΩΡΕΑΝ ΠΑΚΕΤΟ ΣΤΟΥΣ ΕΠΙΣΚΕΠΤΕΣ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ. Στις 17/08/2026 βρέθηκε στο δέντρο διπλογραμμένη ενότητα στο `netlify.toml`:
 * το αρχείο έπαυε να παρσάρεται, δηλαδή **θα έριχνε το deploy** — και **καμία από τις 50 πύλες
 * δεν το έπιανε**, γιατί όλες διαβάζουν κώδικα και δεδομένα, καμία δεν διαβάζει τη ρύθμιση που
 * τα ανεβάζει. Ένα σπασμένο αρχείο ρυθμίσεων περνάει κάθε έλεγχο ποιότητας και σκάει στο τέλος.
 *
 * ΓΙΑΤΙ ΧΩΡΙΣ ΒΙΒΛΙΟΘΗΚΗ TOML. Δεν υπάρχει parser στις εξαρτήσεις και δεν αξίζει να μπει μία για
 * ένα αρχείο. Πιάνεται η ΟΙΚΟΓΕΝΕΙΑ του λάθους που συνέβη (διπλή ενότητα, διπλό κλειδί μέσα στην
 * ίδια ενότητα, γραμμή που δεν είναι ούτε σχόλιο ούτε ανάθεση, ξεχασμένο εισαγωγικό).
 *
 * ΤΟ ΜΟΝΤΕΛΟ ΠΟΥ ΧΡΕΙΑΖΕΤΑΙ, ΚΑΙ ΓΙΑΤΙ Η ΠΡΩΤΗ ΓΡΑΦΗ ΗΤΑΝ ΛΑΘΟΣ. Η πρώτη εκδοχή έβγαλε 40
 * ψεύτικα λάθη σε υγιές αρχείο, επειδή μετρούσε το `[[redirects]]` σαν απλή ενότητα. Στο TOML
 * η διπλή αγκύλη είναι ΣΥΣΤΟΙΧΙΑ πινάκων: κάθε επανάληψη ξεκινάει ΝΕΟ στοιχείο, άρα τα
 * `from`/`to`/`status` νόμιμα ξαναγράφονται. Το ίδιο και το `[headers.values]` που ακολουθεί
 * κάθε `[[headers]]` — είναι υποπίνακας ΕΚΕΙΝΟΥ του στοιχείου, όχι επανορισμός. Γι' αυτό εδώ
 * κρατιέται διαδρομή με δείκτη στοιχείου (`headers[3].values`) και όχι σκέτο όνομα.
 *
 * Η ΔΕΥΤΕΡΗ ΔΟΥΛΕΙΑ ΤΟΥ ΕΙΝΑΙ ΝΟΜΙΚΗ. Το `OPEN_METEO_USE_FREE_TIER` επιτρέπεται στις δοκιμαστικές
 * εκδόσεις (deploy-preview, branch-deploy, dev) ώστε οι δοκιμές να μην τρώνε το πληρωμένο πακέτο.
 * Στην ΠΑΡΑΓΩΓΗ απαγορεύεται: το δωρεάν επίπεδο του Open-Meteo έχει άδεια μη-εμπορικής χρήσης και
 * το calmbeach.gr είναι το προϊόν. Απόφαση αδειοδότησης που μέχρι σήμερα ζούσε μόνο ως σχόλιο.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tomlPath = path.join(root, 'netlify.toml');

/** Κεφαλίδες που ΕΠΙΤΡΕΠΕΤΑΙ να επαναλαμβάνονται: οι συστοιχίες πινάκων του TOML. */
const REPEATABLE = /^\[\[.+\]\]$/;

/**
 * Διαβάζει το αρχείο και επιστρέφει τα προβλήματα. Ξεχωριστή συνάρτηση ώστε να μπορεί να
 * οδηγηθεί και με σαμποταρισμένο κείμενο — αλλιώς η πύλη δεν αποδεικνύει ότι κρίνει κάτι.
 */
const inspect = (source) => {
  const problems = [];
  const assignments = [];
  const seenTables = new Map();
  const keysPerPath = new Map();
  const arrayCount = new Map();
  let currentPath = '(ρίζα)';
  let currentArray = null;

  source.split(/\r?\n/).forEach((raw, index) => {
    const lineNo = index + 1;
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;

    if (line.startsWith('[')) {
      if (!/^\[{1,2}[^[\]]+\]{1,2}$/.test(line)) {
        problems.push(`γραμμή ${lineNo}: κεφαλίδα ενότητας που δεν κλείνει σωστά — «${line}»`);
        return;
      }
      if (REPEATABLE.test(line)) {
        const name = line.slice(2, -2);
        const next = (arrayCount.get(name) ?? 0) + 1;
        arrayCount.set(name, next);
        currentArray = name;
        currentPath = `${name}[${next}]`;
        return;
      }
      const name = line.slice(1, -1);
      if (currentArray && name.startsWith(`${currentArray}.`)) {
        currentPath = `${currentArray}[${arrayCount.get(currentArray)}].${name.slice(currentArray.length + 1)}`;
        return;
      }
      currentArray = null;
      currentPath = name;
      const before = seenTables.get(name);
      if (before) {
        problems.push(
          `γραμμή ${lineNo}: η ενότητα [${name}] ορίζεται ΔΕΥΤΕΡΗ φορά (πρώτη στη γραμμή ${before}). `
          + 'Το TOML το απορρίπτει — το Netlify δεν διαβάζει το αρχείο και το deploy πέφτει.'
        );
      } else {
        seenTables.set(name, lineNo);
      }
      return;
    }

    const eq = line.indexOf('=');
    if (eq <= 0) {
      problems.push(`γραμμή ${lineNo}: ούτε σχόλιο, ούτε ενότητα, ούτε ανάθεση — «${line}»`);
      return;
    }
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();

    // Ένα ξεχασμένο εισαγωγικό καταπίνει σιωπηλά τις επόμενες γραμμές.
    const quotes = (value.match(/"/g) ?? []).length;
    const isMultiline = value.startsWith('"""') || value.startsWith("'''");
    if (quotes % 2 !== 0 && !isMultiline) {
      problems.push(`γραμμή ${lineNo}: περιττό εισαγωγικό στην τιμή του ${key} — «${value}»`);
    }

    if (!keysPerPath.has(currentPath)) keysPerPath.set(currentPath, new Map());
    const table = keysPerPath.get(currentPath);
    if (table.has(key)) {
      problems.push(
        `γραμμή ${lineNo}: το κλειδί ${key} ορίζεται δεύτερη φορά μέσα στο ίδιο [${currentPath}] `
        + `(πρώτη στη γραμμή ${table.get(key)})`
      );
    } else {
      table.set(key, lineNo);
    }
    assignments.push({ table: currentPath, key, value, lineNo });
  });

  return { problems, assignments, seenTables };
};

const source = readFileSync(tomlPath, 'utf8');
const { problems, assignments, seenTables } = inspect(source);

// ── Η ΡΗΤΡΑ ΑΔΕΙΑΣ ──────────────────────────────────────────────────────────
for (const hit of assignments) {
  if (hit.key !== 'OPEN_METEO_USE_FREE_TIER') continue;
  const isProduction = /^context\.production/.test(hit.table) || hit.table === 'build.environment';
  if (!isProduction) continue;
  if (/^"?0"?$/.test(hit.value)) continue;
  problems.push(
    `γραμμή ${hit.lineNo}: OPEN_METEO_USE_FREE_TIER ενεργό στο [${hit.table}]. `
    + 'Το δωρεάν επίπεδο του Open-Meteo έχει άδεια ΜΗ ΕΜΠΟΡΙΚΗΣ χρήσης και το calmbeach.gr είναι '
    + 'το προϊόν. Επιτρέπεται μόνο σε deploy-preview / branch-deploy / dev.'
  );
}

if (!seenTables.has('build')) problems.push('λείπει η ενότητα [build] — χωρίς αυτήν δεν χτίζεται τίποτα');

// ── ΑΠΟΔΕΙΞΗ ΟΤΙ Η ΠΥΛΗ ΔΕΝ ΕΙΝΑΙ ΔΙΑΚΟΣΜΗΤΙΚΗ ─────────────────────────────
// Ο ΙΔΙΟΣ ανιχνευτής, πάνω στο ΙΔΙΟ αρχείο με μία διπλή ενότητα παραπάνω. Αν δεν πέσει, ο
// έλεγχος διπλής ενότητας δεν κρίνει τίποτα και η πύλη είναι διακοσμητική.
{
  const sabotaged = `${source}\n[build]\n  command = "δεύτερη φορά"\n`;
  const caught = inspect(sabotaged).problems.some(p => p.includes('ΔΕΥΤΕΡΗ φορά'));
  if (!caught) problems.push('ΤΟ ΣΑΜΠΟΤΑΖ ΔΕΝ ΕΓΙΝΕ ΑΝΤΙΛΗΠΤΟ — ο ανιχνευτής διπλής ενότητας δεν κρίνει τίποτα');
}

if (problems.length) {
  console.error('✗ netlify.toml: ΑΠΕΤΥΧΕ');
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}

console.log(
  `OK: netlify.toml παρσάρει · ${seenTables.size} μοναδικές ενότητες, `
  + `${assignments.length} ρυθμίσεις, το δωρεάν πακέτο πουθενά στην παραγωγή.`
);
