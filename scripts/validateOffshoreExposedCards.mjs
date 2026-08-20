#!/usr/bin/env node
/**
 * Η ΚΑΡΤΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΛΕΕΙ «ΕΚΤΕΘΕΙΜΕΝΗ» ΣΕ ΟΛΟ ΚΑΙ ΠΕΡΙΣΣΟΤΕΡΟΥΣ ΑΠΟΓΕΙΟΥΣ ΤΟΜΕΙΣ.
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Για κάθε παραλία της χώρας και κάθε τομέα όπου η αποθηκευμένη γεωμετρία λέει ότι
 * ο άνεμος ΦΕΥΓΕΙ από τη στεριά (`onshore < -0,3`), τρέχει την πραγματική μηχανή της κάρτας και
 * μετράει πόσες φορές βγαίνει «Εκτεθειμένη». Καμία κλήση δικτύου: συνθετικός άνεμος 8 τομείς ×
 * 4 εντάσεις πάνω στα δεδομένα του repo, ίδιο αποτέλεσμα κάθε φορά.
 *
 * ΓΙΑΤΙ ΕΙΝΑΙ ΚΑΣΤΑΝΙΑ ΚΑΙ ΟΧΙ ΜΗΔΕΝ. Η πρώτη εθνική μέτρηση (20/08/2026, PORISMA §Γ28) βρήκε
 * 118 τομείς σε 59 παραλίες, από δύο ξεχωριστές αιτίες:
 *
 *   • 67 τομείς / 23 παραλίες από τη σημαία `knownWindSportSpot`, που γύριζε 'exposed' χωρίς να
 *     κοιτάξει κατεύθυνση. ΔΙΟΡΘΩΘΗΚΕ (§Γ28β) — η σημαία έγινε κατευθυντική.
 *   • 51 τομείς / 40 παραλίες από χειρόγραφο `exposedToWindDirections`. ΔΕΝ ΔΙΟΡΘΩΝΕΤΑΙ, και
 *     αυτός είναι ο λόγος που υπάρχει καστάνια αντί για μηδέν: εκεί ο χειρόγραφος
 *     προσανατολισμός και ο μετρημένος διαφωνούν 45°-140°, και ΚΑΝΕΝΑ δεδομένο του repo δεν
 *     κρίνει ποιος από τους δύο δείχνει λάθος πλευρά (§Γ28δ: δύο ανεξάρτητοι μάρτυρες
 *     δοκιμάστηκαν και ψήφισαν ΑΝΤΙΘΕΤΑ, 29 έναντι 11). Μέχρι να επαληθευτούν στο έδαφος, το
 *     «Εκτεθειμένη» είναι η συντηρητική απάντηση και μένει.
 *
 * Άρα ο αριθμός επιτρέπεται ΜΟΝΟ ΝΑ ΠΕΦΤΕΙ. Αύξηση σημαίνει ότι κάποιος ξανάκανε ακατεύθυντο
 * έναν κανόνα έκθεσης, ή ότι μπήκαν χειρόγραφοι τομείς πάνω σε γεωμετρία που τους διαψεύδει.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ:
 *   Α. Το πλήθος δεν ξεπερνά τη βάση (51 τομείς / 40 παραλίες).
 *   Β. Η σημαία windsurf δεν ξαναγίνεται ακατεύθυντη: κανένας απόγειος τομέας δεν βγαίνει
 *      «Εκτεθειμένη» εξαιτίας της (§Γ28β).
 *   Γ. ΑΥΤΟΣΑΜΠΟΤΑΖ: η μέτρηση πρέπει να ΖΕΙ. Αν η μηχανή σταματήσει να επιστρέφει 'exposed'
 *      (σπασμένο φόρτωμα δεδομένων, αλλαγή υπογραφής), ο απόγειος αριθμός πέφτει στο μηδέν και
 *      η πύλη θα έδειχνε υγιέστερη ενώ έχει τυφλωθεί. Απαιτεί χιλιάδες 'exposed' συνολικά.
 *
 *   node scripts/validateOffshoreExposedCards.mjs [--verbose]
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { WindDirection } = require(path.join(root, 'types.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));

const verbose = process.argv.includes('--verbose');

/** Το ίδιο κατώφλι με το `WINDSPORT_OFFSHORE_ONSHORE_MAX` της μηχανής (§Γ28β). */
const OFFSHORE_ONSHORE_MAX = -0.3;
/** Μετρημένη βάση 20/08/2026 μετά τη διόρθωση §Γ28β. Επιτρέπεται μόνο να πέσει. */
const BASELINE_SECTORS = 51;
const BASELINE_BEACHES = 40;
/** Κάτω από αυτό η μέτρηση έχει τυφλωθεί, δεν έχει γιατρευτεί (έλεγχος Γ). */
const MIN_LIVE_EXPOSED = 1000;

const SCEN = [
  { sector: 'N', dir: WindDirection.N, deg: 0 }, { sector: 'NE', dir: WindDirection.NE, deg: 45 },
  { sector: 'E', dir: WindDirection.E, deg: 90 }, { sector: 'SE', dir: WindDirection.SE, deg: 135 },
  { sector: 'S', dir: WindDirection.S, deg: 180 }, { sector: 'SW', dir: WindDirection.SW, deg: 225 },
  { sector: 'W', dir: WindDirection.W, deg: 270 }, { sector: 'NW', dir: WindDirection.NW, deg: 315 },
];
const BFS = [{ bft: 3, kmh: 15 }, { bft: 4, kmh: 25 }, { bft: 5, kmh: 35 }, { bft: 6, kmh: 45 }];

const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

const hits = new Map();
let cardExposedTotal = 0;
let pairsChecked = 0;

for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  const regionId = rf.replace(/\.json$/, '');
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  const beaches = payload.island?.beaches || [];
  if (!beaches.length) continue;

  const profiles = {};
  try {
    const p = JSON.parse(fs.readFileSync(path.join(expDir, rf), 'utf8'));
    for (const pr of Object.values(p.profiles || {})) profiles[pr.beachId] = { ...pr, source: 'natural-earth-baseline' };
  } catch { /* περιοχή χωρίς γεωμετρία — δεν μπορεί να κριθεί απόγειος τομέας */ }

  for (const beach of beaches) {
    const geo = profiles[beach.id];
    if (!geo?.sectors) continue;
    for (const scen of SCEN) {
      const sec = geo.sectors[scen.sector];
      if (!sec || typeof sec.onshore !== 'number') continue;
      pairsChecked += 1;
      for (const { bft, kmh } of BFS) {
        let assessment;
        try {
          assessment = assessBeachWindExposure({
            beach, geospatialProfile: geo,
            windDirectionDeg: scen.deg, windDirection: scen.dir,
            windSpeedKmh: kmh, beaufort: bft, waveHeightMeters: 0.5,
          });
        } catch { continue; }
        if (assessment.exposureLevel !== 'exposed') continue;
        cardExposedTotal += 1;
        if (sec.onshore >= OFFSHORE_ONSHORE_MAX) continue;

        const key = `${beach.id}@${scen.sector}`;
        const profile = assessment.windProfile || {};
        const existing = hits.get(key);
        const fromWindSportFlag = Boolean(profile.knownWindSportSpot) && bft >= 4
          && !(profile.exposedToWindDirections || []).includes(assessment.windSector);
        if (existing) { existing.windSport = existing.windSport || fromWindSportFlag; continue; }
        hits.set(key, {
          id: beach.id, name: beach.name?.gr || beach.name?.en || `#${beach.id}`,
          region: regionId, sector: scen.sector, onshore: sec.onshore,
          listed: (profile.exposedToWindDirections || []).includes(assessment.windSector),
          windSport: fromWindSportFlag,
        });
      }
    }
  }
}

const rows = [...hits.values()];
const beaches = new Set(rows.map(r => r.id));
const failures = [];

console.log('Απόγειος άνεμος & κάρτα «Εκτεθειμένη» — καστάνια, μόνο προς τα κάτω');
console.log(`Ζεύγη παραλία×τομέας με μετρημένο onshore: ${pairsChecked.toLocaleString('el-GR')} (καμία κλήση δικτύου)\n`);

// ── Α ───────────────────────────────────────────────────────────────────────
const overSectors = rows.length > BASELINE_SECTORS;
const overBeaches = beaches.size > BASELINE_BEACHES;
console.log(`${overSectors || overBeaches ? 'FAIL' : 'OK  '} Α. το πλήθος δεν μεγάλωσε: ${rows.length} τομείς σε ${beaches.size} παραλίες`
  + ` (βάση ${BASELINE_SECTORS}/${BASELINE_BEACHES})`);
if (overSectors || overBeaches) {
  console.log('       Κάποιος κανόνας έκθεσης ξαναέγινε ακατεύθυντος, ή μπήκαν χειρόγραφοι τομείς');
  console.log('       πάνω σε γεωμετρία που τους διαψεύδει. ΜΗΝ ανεβάσεις τη βάση για να περάσει.');
  failures.push('Α');
} else if (rows.length < BASELINE_SECTORS || beaches.size < BASELINE_BEACHES) {
  console.log(`       Έπεσε — κατέβασε τη βάση σε ${rows.length}/${beaches.size} ώστε να μην ξαναανέβει.`);
}

// ── Β ───────────────────────────────────────────────────────────────────────
const fromFlag = rows.filter(r => r.windSport);
console.log(`${fromFlag.length ? 'FAIL' : 'OK  '} Β. η σημαία windsurf έμεινε κατευθυντική: ${fromFlag.length} απόγειοι τομείς από αυτήν`);
for (const r of fromFlag.slice(0, verbose ? 500 : 8)) {
  console.log(`       #${r.id} ${r.name} [${r.region}] @${r.sector} — onshore ${r.onshore.toFixed(2)}`);
}
if (fromFlag.length) failures.push('Β');

// ── Γ. αυτοσαμποτάζ ─────────────────────────────────────────────────────────
console.log(`${cardExposedTotal < MIN_LIVE_EXPOSED ? 'FAIL' : 'OK  '} Γ. η μέτρηση ζει: ${cardExposedTotal.toLocaleString('el-GR')} «Εκτεθειμένη» συνολικά`);
if (cardExposedTotal < MIN_LIVE_EXPOSED) {
  console.log('       Η μηχανή σχεδόν δεν βγάζει «Εκτεθειμένη» πουθενά. Ο απόγειος αριθμός δεν έπεσε');
  console.log('       επειδή γιατρεύτηκε κάτι — η μέτρηση τυφλώθηκε.');
  failures.push('Γ');
}

const perBeach = new Map();
for (const r of rows) {
  const e = perBeach.get(r.id) || { name: r.name, region: r.region, sectors: [] };
  e.sectors.push(r.sector);
  perBeach.set(r.id, e);
}
console.log(`\nΟι ${perBeach.size} παραλίες που περιμένουν επαλήθευση προσανατολισμού στο έδαφος (§Γ28δ):`);
for (const [id, e] of [...perBeach].slice(0, verbose ? 500 : 12)) {
  console.log(`  #${id} ${e.name} [${e.region}] @${e.sectors.join('/')}`);
}
if (perBeach.size > 12 && !verbose) console.log(`  …και ${perBeach.size - 12} ακόμη (--verbose)`);

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(', ')}.`);
  process.exit(1);
}
console.log('\nΠΕΡΑΣΕ: κανένας καινούργιος απόγειος τομέας δεν λέει «Εκτεθειμένη».');
