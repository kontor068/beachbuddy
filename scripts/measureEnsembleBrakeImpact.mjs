/**
 * ΤΟ ΦΡΕΝΟ ΤΗΣ ΑΒΕΒΑΙΟΤΗΤΑΣ: ΤΙ ΘΑ ΚΟΣΤΙΖΕ ΑΝ ΑΝΑΒΕ; (§ΑΞ1/Α5, 21/08/2026)
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Στις 21/08 μετρήσαμε πόσο διαφωνούν τα 51 σενάρια του ECMWF για κάθε περιοχή και
 * κάθε μέρα (`scripts/measureEnsembleSpread.mjs`). Η υποδομή μπήκε ζωντανή — συνάρτηση, πύλη,
 * αναφορά — και **κανένα αρχείο της εφαρμογής δεν τη διαβάζει**. Η σελίδα λέει «Καλή» για την
 * Παρασκευή με την ίδια σιγουριά που το λέει για σήμερα.
 *
 * Η ΕΠΙΛΟΓΗ ΕΙΝΑΙ ΔΥΟ ΔΡΟΜΩΝ ΚΑΙ ΚΑΜΙΑ ΔΕΝ ΠΑΙΡΝΕΤΑΙ ΧΩΡΙΣ ΝΟΥΜΕΡΟ: ή συνδέεται με φρένο, ή
 * δηλώνεται ρητά σβηστό. Αυτή η μέτρηση δίνει το νούμερο που λείπει: **πόσες παραλιο-ημέρες θα
 * άλλαζαν** και **τι θα έχανε ο επισκέπτης**.
 *
 * ΤΟ ΦΡΕΝΟ ΠΟΥ ΔΟΚΙΜΑΖΕΤΑΙ — γραμμένο ΠΡΙΝ τρέξει, και σκόπιμα το πιο συντηρητικό δυνατό:
 *   • Ισχύει ΜΟΝΟ σε περιοχο-ημέρα που το ensemble χαρακτήρισε αβέβαιη (≥4 ώρες κολύμβησης με
 *     διαφορά p90−p10 ≥2 βαθμίδες Μποφόρ).
 *   • Ισχύει ΜΟΝΟ από αύριο και μετά (lead ≥1). Η σημερινή μέρα μετρήθηκε στο 0% αβέβαιη —
 *     ένα φρένο εκεί θα ήταν θόρυβος.
 *   • ΜΟΝΟΔΡΟΜΟΣ, ένα σκαλί: 🔵 → 🟡 και «ιδανικά» → «καλά». Τίποτα δεν γίνεται ηρεμότερο,
 *     τίποτα δεν πέφτει δύο σκαλιά, κανένα κόκκινο δεν γίνεται πράσινο.
 *   • ΔΕΝ αγγίζει τη λίστα «Κατάλληλες» (το κίτρινο μένει μέσα) — άρα δεν αδειάζει οθόνες.
 *
 * ΤΙ ΔΕΝ ΑΠΑΝΤΑΕΙ. Δεν λέει αν το φρένο είναι ΣΩΣΤΟ — λέει τι κοστίζει. Και δεν επαληθεύει το
 * ensemble απέναντι σε όργανο: το «αβέβαιη μέρα» είναι δήλωση του μοντέλου για τον εαυτό του.
 *
 * ΠΗΓΕΣ, ΚΑΜΙΑ ΝΕΑ ΚΛΗΣΗ ΔΙΚΤΥΟΥ:
 *   • `reports/quality/ensemble-spread.json` → ποιες περιοχο-ημέρες είναι αβέβαιες.
 *   • `.tmp/tone-operator-census-cache.json` → το χρώμα και η ετυμηγορία κάθε παραλιο-ημέρας,
 *     όπως τα υπολόγισε ο ΠΡΑΓΜΑΤΙΚΟΣ κινητήρας στην απογραφή τελεστών.
 * Και τα δύο πρέπει να έχουν τρέξει· αλλιώς η μέτρηση σταματάει και λέει ποιο λείπει.
 *
 * Run: node scripts/measureEnsembleBrakeImpact.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const readJson = (rel, what) => {
  try {
    return JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
  } catch {
    console.error(`Λείπει ${rel} — τρέξε πρώτα ${what}.`);
    process.exit(1);
  }
};

const ensemble = readJson('reports/quality/ensemble-spread.json',
  'node scripts/measureEnsembleSpread.mjs');
const census = readJson('.tmp/tone-operator-census-cache.json',
  'node scripts/measureToneOperatorCensus.mjs --live');

const uncertainList = ensemble.uncertainRegionDays ?? ensemble.worst ?? [];
if (!uncertainList.length) {
  console.log('Καμία αβέβαιη περιοχο-ημέρα στη μέτρηση — το φρένο δεν θα άναβε ποτέ σε αυτό το παράθυρο.');
}
if (!ensemble.uncertainRegionDays) {
  console.warn('⚠️ Η αναφορά ensemble είναι παλιά (χωρίς uncertainRegionDays): χρησιμοποιείται η '
    + 'κομμένη λίστα «worst», άρα το αποτέλεσμα είναι ΚΑΤΩ ΟΡΙΟ.');
}

/** «περιοχή|lead» → η αβεβαιότητα εκείνης της ημέρας. */
const uncertain = new Map();
for (const row of uncertainList) {
  if (typeof row?.region !== 'string' || typeof row?.lead !== 'number') continue;
  if (row.lead < 1) continue; // το φρένο δεν αγγίζει τη σημερινή μέρα
  uncertain.set(`${row.region}|${row.lead}`, row);
}

const perLead = new Map();
let beachDays = 0;
let beachDaysOnUncertain = 0;
let blueLost = 0;
let excellentLost = 0;
const examples = [];

for (const [regionId, result] of Object.entries(census.regions ?? {})) {
  for (const row of result.rows ?? []) {
    beachDays += 1;
    const lead = row.dayIndex;
    const hit = uncertain.get(`${regionId}|${lead}`);
    if (!hit) continue;
    beachDaysOnUncertain += 1;

    const losesBlue = row.toneFinal === 'blue';
    const losesExcellent = row.swimmingComfort === 'excellent';
    if (losesBlue) blueLost += 1;
    if (losesExcellent) excellentLost += 1;

    const bucket = perLead.get(lead) ?? { lead, beachDays: 0, blue: 0, excellent: 0, regions: new Set() };
    bucket.beachDays += 1;
    if (losesBlue) bucket.blue += 1;
    if (losesExcellent) bucket.excellent += 1;
    bucket.regions.add(regionId);
    perLead.set(lead, bucket);

    if (losesBlue && examples.length < 15) {
      examples.push({
        region: regionId, beachId: row.beachId, name: row.name, lead,
        tone: row.toneFinal, wouldBecome: 'yellow',
        swimmingComfort: row.swimmingComfort,
        ensembleGapBeaufort: hit.gap, uncertainHours: hit.uncertainHours,
      });
    }
  }
}

const pct = (n, d) => Number(((n / Math.max(1, d)) * 100).toFixed(2));
const byLead = [...perLead.values()]
  .sort((a, b) => a.lead - b.lead)
  .map(b => ({
    lead: b.lead,
    regionsAffected: b.regions.size,
    beachDaysOnUncertainDays: b.beachDays,
    blueWouldTurnYellow: b.blue,
    excellentWouldTurnGood: b.excellent,
  }));

const report = {
  generatedAt: new Date().toISOString(),
  question: 'Α5 — τι θα κόστιζε το φρένο αβεβαιότητας αν άναβε;',
  brakeUnderTest: {
    firesOn: 'περιοχο-ημέρα που το ensemble λέει αβέβαιη (≥4 ώρες με διαφορά ≥2 βαθμίδες Μποφόρ)',
    leads: '≥1 (ποτέ σήμερα)',
    effect: 'μπλε → κίτρινο, «ιδανικά» → «καλά». Ένα σκαλί, μονόδρομος.',
    doesNotTouch: 'λίστα «Κατάλληλες», βάθρο, τυπωμένο κύμα, κόκκινα',
  },
  sources: {
    ensemble: 'reports/quality/ensemble-spread.json',
    ensembleGeneratedAt: ensemble.generatedAt,
    census: '.tmp/tone-operator-census-cache.json',
    truncatedEnsembleList: !ensemble.uncertainRegionDays,
  },
  scope: {
    beachDays,
    regions: Object.keys(census.regions ?? {}).length,
    uncertainRegionDays: uncertain.size,
  },
  impact: {
    beachDaysOnUncertainDays: beachDaysOnUncertain,
    beachDaysOnUncertainDaysPct: pct(beachDaysOnUncertain, beachDays),
    blueWouldTurnYellow: blueLost,
    blueWouldTurnYellowPct: pct(blueLost, beachDays),
    excellentWouldTurnGood: excellentLost,
    excellentWouldTurnGoodPct: pct(excellentLost, beachDays),
  },
  byLead,
  examples,
};

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
const outPath = path.join(root, 'reports/quality/ensemble-brake-impact.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`\n── ΤΟ ΦΡΕΝΟ ΑΒΕΒΑΙΟΤΗΤΑΣ · ${beachDays} παραλιο-ημέρες σε ${report.scope.regions} περιοχές ──\n`);
console.log(`αβέβαιες περιοχο-ημέρες (lead ≥1): ${uncertain.size}`);
console.log(`παραλιο-ημέρες που θα άγγιζε:      ${beachDaysOnUncertain}  (${report.impact.beachDaysOnUncertainDaysPct}%)`);
console.log(`  μπλε → κίτρινο:                  ${blueLost}  (${report.impact.blueWouldTurnYellowPct}% όλων)`);
console.log(`  «ιδανικά» → «καλά»:              ${excellentLost}  (${report.impact.excellentWouldTurnGoodPct}% όλων)`);
if (byLead.length) {
  console.log('\n  ημέρα │ περιοχές │ παραλιο-ημέρες │ μπλε που πέφτουν');
  for (const b of byLead) {
    console.log(`  +${String(b.lead).padEnd(5)}│ ${String(b.regionsAffected).padStart(8)} │ ${String(b.beachDaysOnUncertainDays).padStart(14)} │ ${String(b.blueWouldTurnYellow).padStart(16)}`);
  }
}
console.log(`\n→ ${path.relative(root, outPath)}`);
