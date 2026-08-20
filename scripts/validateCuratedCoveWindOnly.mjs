#!/usr/bin/env node
/**
 * Η ΑΝΘΡΩΠΙΝΗ ΕΠΙΘΕΩΡΗΣΗ ΤΟΥ ΟΡΜΟΥ ΙΣΧΥΕΙ ΓΙΑ ΤΟΝ ΑΝΕΜΟ ΚΑΙ ΜΟΝΟ ΓΙΑ ΤΟΝ ΑΝΕΜΟ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΠΥΛΗ. Στις 17/08/2026 μπήκε η curated παράκαμψη: 29 τομείς σε 24
 * επιθεωρημένες παραλίες παίρνουν `exposureLevel: 'protected'` ΧΩΡΙΣ να περάσουν το αυστηρό
 * γεωμετρικό τεστ (ένταση 33,0-59,6, ενώ το τεστ θέλει <33). Δύο σχόλια υπόσχονταν ότι αυτό δεν
 * αγγίζει το κύμα — `windExposureEngine.ts` «Downstream wave/swell ceilings are untouched» και
 * `waveCharacter.ts` «'protected' here has already passed the map's strict gate». Και τα δύο
 * ήταν ψευδή: το `exposureLevel` έφτανε αυτούσιο στο `shoreSeaStateM` και ΚΟΒΕ ΤΟ ΚΥΜΑ ΣΤΟ ΜΙΣΟ
 * για δεκαπέντε ημέρες. Το βρήκε αντίπαλος έλεγχος στις 20/08, όχι πύλη — γιατί πύλη δεν υπήρχε.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ, με τις ΠΡΑΓΜΑΤΙΚΕΣ συναρτήσεις (καμία επανυλοποίηση, καμία κλήση δικτύου):
 *   Α. Κάθε curated τομέας σημαδεύεται — `geometryEnclosedProtectionSource` γυρίζει 'curated'
 *      ΚΑΙ μόνο εκεί που το αυστηρό τεστ αποτυγχάνει· όπου περνάει, γυρίζει 'geometry'.
 *   Β. Το σήμα ταξιδεύει — `shoreSeaStateM` ΑΡΝΕΙΤΑΙ την έκπτωση όταν το σήμα είναι ανοιχτό.
 *   Γ. Είναι μονόδρομο — σε καμία είσοδο η διόρθωση δεν βγάζει ΜΙΚΡΟΤΕΡΟ κύμα.
 *   Δ. Δεν διαρρέει — μια παραλία ΕΚΤΟΣ λίστας δεν παίρνει ποτέ 'curated'.
 *   Ε. ΑΥΤΟΣΑΜΠΟΤΑΖ: ξαναπερνάει το Β με το σήμα σβηστό και ΑΠΑΙΤΕΙ να πέσει. Χωρίς αυτό η πύλη
 *      θα περνούσε ακόμα κι αν κάποιος αφαιρούσε τη διόρθωση.
 *
 * ΔΕΝ ελέγχει το χρώμα, και αυτό είναι μετρημένο συμπέρασμα: και οι 24 είναι όρμοι, και ο όρμος
 * εξαιρείται ρητά από το ταβάνι θάλασσας (`suitabilityTone.ts`, «A cove that genuinely holds
 * calm water is exempt»), άρα το κύμα τους δεν φτάνει ποτέ στη σκάλα χρώματος. Η ορατή συνέπεια
 * της διόρθωσης είναι το τυπωμένο κύμα και το φίλτρο «Ήρεμο νερό» — δες
 * `scripts/measureCuratedCoveWaveFix.mjs`.
 *
 *   node scripts/validateCuratedCoveWindOnly.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};

const { geometryEnclosedProtectionSource, hasGeometryEnclosedProtection } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { shoreSeaStateM, SHORE_DAMPING_BY_EXPOSURE } = require(path.join(root, 'utils/waveCharacter.ts'));
const { CURATED_ENCLOSED_COVE_IDS } = require(path.join(root, 'utils/enclosedCoves.ts'));

const EXPOSURE_DIR = path.join(root, 'public/data/geospatial/exposure');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SEAS = [0.1, 0.3, 0.5, 0.8, 1.0, 1.4, 2.0, 3.0];
/** Το ίδιο κατώφλι έντασης που κρατάει το mapExposure.isStableProtectedSector. */
const STRICT_MAX_INTENSITY = 33;
const STRICT_MIN_BLOCKED = 0.95;

const failures = [];
const fail = (check, detail) => failures.push(`${check}: ${detail}`);

// ── συλλογή: κάθε τομέας κάθε προφίλ, μία φορά ──────────────────────────────
const all = [];
for (const file of fs.readdirSync(EXPOSURE_DIR).filter(f => f.endsWith('.json'))) {
  let profiles;
  try { profiles = JSON.parse(fs.readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'))?.profiles ?? {}; } catch { continue; }
  for (const [idStr, profile] of Object.entries(profiles)) {
    for (const sector of SECTORS) {
      const source = geometryEnclosedProtectionSource(profile, sector, false, Number(idStr));
      if (source === null) continue;
      all.push({ id: Number(idStr), sector, source, s: profile.sectors?.[sector] ?? {} });
    }
  }
}
const curated = all.filter(r => r.source === 'curated');
const geometric = all.filter(r => r.source === 'geometry');
console.log(`προφίλ σαρώθηκαν · 'curated' ${curated.length} τομείς σε ${new Set(curated.map(r => r.id)).size} παραλίες · 'geometry' ${geometric.length}`);

// ── Α. η ετικέτα λέει την αλήθεια ───────────────────────────────────────────
for (const r of curated) {
  if (!CURATED_ENCLOSED_COVE_IDS.has(r.id)) fail('Α', `#${r.id}@${r.sector} πήρε 'curated' χωρίς να είναι στη λίστα`);
  const passesStrict = r.s.level === 'protected' && typeof r.s.intensity === 'number' && r.s.intensity < STRICT_MAX_INTENSITY;
  if (passesStrict) fail('Α', `#${r.id}@${r.sector} σημαδεύτηκε 'curated' ενώ περνάει το αυστηρό τεστ — θα έπρεπε 'geometry'`);
}
for (const r of geometric) {
  const passesStrict = r.s.level === 'protected' && typeof r.s.intensity === 'number' && r.s.intensity < STRICT_MAX_INTENSITY;
  if (!passesStrict) fail('Α', `#${r.id}@${r.sector} σημαδεύτηκε 'geometry' χωρίς να περνάει το αυστηρό τεστ`);
  if (typeof r.s.blockedRayRatio === 'number' && r.s.blockedRayRatio < STRICT_MIN_BLOCKED) {
    fail('Α', `#${r.id}@${r.sector} 'geometry' με blockedRayRatio ${r.s.blockedRayRatio} < ${STRICT_MIN_BLOCKED}`);
  }
}
console.log(`Α. η ετικέτα λέει την αλήθεια ................. ${failures.length ? '❌' : '✅'}`);

// ── Β. το σήμα ταξιδεύει ως το κύμα ─────────────────────────────────────────
const beforeB = failures.length;
for (const sea of SEAS) {
  const withSignal = shoreSeaStateM(sea, 'protected', undefined, true);
  const withoutSignal = shoreSeaStateM(sea, 'protected', undefined, false);
  if (withSignal !== Number(sea.toFixed(2))) {
    fail('Β', `σε ${sea} μ. με ανοιχτό σήμα το κύμα βγήκε ${withSignal}, περίμενα ${sea} (καμία έκπτωση)`);
  }
  const expectedDiscount = Number((sea * SHORE_DAMPING_BY_EXPOSURE.protected).toFixed(2));
  if (withoutSignal !== expectedDiscount) {
    fail('Β', `σε ${sea} μ. χωρίς σήμα το κύμα βγήκε ${withoutSignal}, περίμενα ${expectedDiscount}`);
  }
}
console.log(`Β. το σήμα φτάνει στο κύμα .................... ${failures.length > beforeB ? '❌' : '✅'}`);

// ── Γ. μονόδρομο ────────────────────────────────────────────────────────────
const beforeC = failures.length;
for (const level of ['protected', 'partial', 'exposed', undefined]) {
  for (const arrival of ['protected', 'partial', 'exposed', undefined]) {
    for (const sea of SEAS) {
      const off = shoreSeaStateM(sea, level, arrival, false);
      const on = shoreSeaStateM(sea, level, arrival, true);
      if (typeof off === 'number' && typeof on === 'number' && on < off) {
        fail('Γ', `level=${level} arrival=${arrival} sea=${sea}: η διόρθωση ΜΙΚΡΥΝΕ το κύμα ${off} → ${on}`);
      }
    }
  }
}
console.log(`Γ. η διόρθωση μόνο μεγαλώνει το κύμα .......... ${failures.length > beforeC ? '❌' : '✅'}`);

// ── Δ. καμία διαρροή έξω από τη λίστα ───────────────────────────────────────
const beforeD = failures.length;
const strays = curated.filter(r => !CURATED_ENCLOSED_COVE_IDS.has(r.id));
if (strays.length) fail('Δ', `${strays.length} τομείς εκτός λίστας πήραν 'curated'`);
// Και το παλιό «ναι/όχι» πρέπει να συμφωνεί με τη νέα ετικέτα σε ΚΑΘΕ τομέα.
for (const r of all) {
  const legacy = hasGeometryEnclosedProtection({ confidence: 'high', sectors: { [r.sector]: r.s } }, r.sector, false, r.id);
  if (!legacy) fail('Δ', `#${r.id}@${r.sector}: νέα ετικέτα '${r.source}' αλλά το παλιό hasGeometryEnclosedProtection λέει false`);
}
console.log(`Δ. καμία διαρροή, το παλιό ΑΠΙ συμφωνεί ....... ${failures.length > beforeD ? '❌' : '✅'}`);

// ── Ε. αυτοσαμποτάζ ─────────────────────────────────────────────────────────
// Αν κάποιος αφαιρέσει τη διόρθωση, το Β πρέπει να πέσει. Το προσομοιώνουμε καλώντας τη
// συνάρτηση όπως θα την καλούσε ο ΠΑΛΙΟΣ κώδικας (χωρίς το τέταρτο όρισμα) και απαιτούμε να
// δώσει την έκπτωση — δηλαδή να είναι ΔΙΑΦΟΡΕΤΙΚΗ από τη διορθωμένη διαδρομή.
const sabotage = shoreSeaStateM(1.0, 'protected', undefined);
const corrected = shoreSeaStateM(1.0, 'protected', undefined, true);
if (sabotage === corrected) {
  fail('Ε', `το αυτοσαμποτάζ δεν διαφέρει (${sabotage} και στις δύο) — η πύλη δεν μπορεί να πιάσει αφαίρεση της διόρθωσης`);
}
console.log(`Ε. το αυτοσαμποτάζ πιάνεται ................... ${failures.some(f => f.startsWith('Ε')) ? '❌' : '✅'}`);

if (failures.length) {
  console.error(`\nFAILED: ${failures.length} πρόβλημα(τα).`);
  for (const f of failures.slice(0, 25)) console.error(`  - ${f}`);
  console.error('\nΕΠΟΜΕΝΟ ΒΗΜΑ: μην περάσεις την πύλη σβήνοντας κανόνα. Αν πρόσθεσες παραλία στο');
  console.error('CURATED_ENCLOSED_COVE_IDS, βεβαιώσου ότι ο τομέας της έχει fetchKm 0 και level ≠ exposed.');
  console.error('Αν άλλαξες το shoreSeaStateM, το τέταρτο όρισμα ΠΡΕΠΕΙ να αρνείται την έκπτωση — η');
  console.error('ανθρώπινη επιθεώρηση αφορά τον άνεμο, κανείς δεν επιθεώρησε το κύμα (βίβλος 20/08/2026).');
  process.exit(1);
}
console.log(`\nPASSED: η επιθεώρηση του όρμου μένει στον άνεμο — ${curated.length} τομείς σημαδεμένοι, 0 έκπτωση κύματος.`);
