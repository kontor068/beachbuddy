#!/usr/bin/env node
/**
 * Η ΠΙΝΕΖΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΥΠΟΣΧΕΤΑΙ ΠΕΡΙΣΣΟΤΕΡΑ ΑΠΟ ΟΣΑ ΛΕΕΙ Η ΚΑΡΤΑ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΠΥΛΗ. Η λέξη στην κάρτα («Προστατευμένη / Μερική προστασία /
 * Εκτεθειμένη») και το χρώμα της πινέζας βγαίνουν από ΔΥΟ ΔΙΑΦΟΡΕΤΙΚΕΣ μηχανές:
 * `assessBeachWindExposure` (κάρτα, καρτέλα, βαθμολογία) και `getVisibleMapExposureLevel`
 * (πινέζα). Η υπάρχουσα πύλη `quality:verdicts` δεν μπορεί να δει καμία διαφορά ανάμεσά τους
 * γιατί περνάει το ΙΔΙΟ `exposureLevel` και στα δύο σκέλη
 * (`validateVerdictConsistency.mjs`, `mapExposureLevel: exposureLevel`) — είναι τυφλή εξ
 * ορισμού. Αυτή εδώ τρέχει τις δύο μηχανές ΧΩΡΙΣΤΑ, με τα πραγματικά δεδομένα, και τις
 * αντιπαραβάλλει.
 *
 * ΚΑΜΙΑ ΚΛΗΣΗ ΔΙΚΤΥΟΥ. Ο άνεμος είναι συνθετικός (8 τομείς × 4 εντάσεις) πάνω στα
 * αποθηκευμένα γεωμετρικά προφίλ, οπότε η πύλη δεν ξοδεύει ούτε μία κλήση πρόγνωσης —
 * ούτε δωρεάν ούτε πληρωμένη — και δίνει το ίδιο αποτέλεσμα κάθε φορά.
 *
 * ΤΙ ΕΙΝΑΙ ΝΟΜΙΜΟ ΚΑΙ ΤΙ ΟΧΙ. Η ασυμμετρία «η πινέζα διαβάζει μια ζώνη ΠΙΟ ΚΟΚΚΙΝΗ από την
 * κάρτα» είναι ΣΚΟΠΙΜΗ και τεκμηριωμένη (`mapExposure.ts:384-389`): ο χάρτης ακολουθεί έναν
 * γεωμετρικά 'exposed' τομέα σε οποιοδήποτε fetch, ενώ η βαθμολογία ανεβάζει authored-partial
 * μόνο στα ≥8 χλμ. Είναι η συντηρητική κατεύθυνση και μένει. Η ΑΝΤΙΘΕΤΗ — πινέζα πιο πράσινη
 * από την κάρτα — δεν σχεδιάστηκε ποτέ: είναι πράσινο σημάδι πάνω από κείμενο που λέει
 * «Εκτεθειμένη», και μόνο αυτή στέλνει κόσμο σε αέρα.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ:
 *   Α. Η μηχανή του χάρτη μόνη της δεν βγάζει ποτέ πινέζα πιο αισιόδοξη από την κάρτα.
 *   Β. Ούτε το πέρασμα γειτονιάς (`getConsistentVisibleMapExposureLevels`) το κάνει — έχει
 *      δικαίωμα να σκουραίνει για οπτική συνοχή, όχι να ξεπλένει.
 *   Γ. ΑΥΤΟΣΑΜΠΟΤΑΖ #1: η νόμιμη κατεύθυνση πρέπει να ΥΠΑΡΧΕΙ. Αν κάποιος «σφίξει» τον κανόνα
 *      σε ισότητα, το πλήθος της μηδενίζεται και η πύλη πέφτει αντί να δείξει υγιέστερη.
 *   Δ. ΑΥΤΟΣΑΜΠΟΤΑΖ #2: οι δύο μηχανές πρέπει να ΜΠΟΡΟΥΝ να διαφωνήσουν. Αν κάποιος
 *      ξαναπεράσει το ίδιο input και στις δύο — το ακριβές λάθος που τύφλωσε το
 *      quality:verdicts — η πύλη το ανιχνεύει και πέφτει.
 *   Ε. Ο κατάλογος δεν σαπίζει: καταχώρηση που δεν παραβιάζεται πια είναι αποτυχία.
 *
 *   node scripts/validateCardVsPinExposure.mjs [--verbose]
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
const { getVisibleMapExposureLevel, getConsistentVisibleMapExposureLevels } = require(path.join(root, 'utils/mapExposure.ts'));
const { assessBeachWindExposure } = require(path.join(root, 'utils/windExposureEngine.ts'));
const { resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const verbose = process.argv.includes('--verbose');
const RANK = { protected: 0, partial: 1, exposed: 2 };
const SCEN = [
  { sector: 'N', dir: WindDirection.N, deg: 0 }, { sector: 'NE', dir: WindDirection.NE, deg: 45 },
  { sector: 'E', dir: WindDirection.E, deg: 90 }, { sector: 'SE', dir: WindDirection.SE, deg: 135 },
  { sector: 'S', dir: WindDirection.S, deg: 180 }, { sector: 'SW', dir: WindDirection.SW, deg: 225 },
  { sector: 'W', dir: WindDirection.W, deg: 270 }, { sector: 'NW', dir: WindDirection.NW, deg: 315 },
];
const BFS = [{ bft: 3, kmh: 15 }, { bft: 4, kmh: 25 }, { bft: 5, kmh: 35 }, { bft: 6, kmh: 45 }];

/**
 * ΟΙ ΓΝΩΣΤΕΣ ΠΑΡΑΒΙΑΣΕΙΣ, ΜΕΤΡΗΜΕΝΕΣ 20/08/2026 — κλειδί `beachId@ΤΟΜΕΑΣ`.
 *
 * Δεν είναι συγχώρεση, είναι φράχτης: ό,τι είναι εδώ δεν σταματάει το build, αλλά ό,τι ΔΕΝ
 * είναι εδώ το σταματάει αμέσως. Κάθε γραμμή κουβαλάει την αιτία της, ώστε να ξέρει ο επόμενος
 * τι διορθώνει όταν τη σβήσει. Ισχύει για κάθε ένταση ανέμου του τομέα.
 */
const KNOWN = new Map(Object.entries({
  // ΕΚΛΕΙΣΕ 20/08/2026 — η Αγία Ειρήνη Πάρου @ΒΔ έφυγε από εδώ. Το χειρόγραφο προφίλ
  // επιστρέφεται στη `mapExposure.ts:422` ΠΡΙΝ ελεγχθεί η γεωμετρία 'exposed' στη `:465`, κι
  // έλεγε «προστατευμένη από ΒΔ» πάνω σε ένταση 83,5 / fetch 10 χλμ / onshore 0,99. Η εθνική
  // μέτρηση (`scripts/measureAuthoredVsGeometryPins.mjs`) βρήκε ΜΟΝΟ αυτή τη μία σε 91.904
  // τομεοεντάσεις, οπότε διορθώθηκε το προφίλ (`windProfileOverrides.ts:1817`) και όχι η σειρά
  // των ελέγχων. Αν ξαναεμφανιστεί, ο έλεγχος Α την πιάνει σαν νέα παραβίαση.
  // suspectPin: ο χάρτης δεν εμπιστεύεται τη γεωμετρία αυτής της πινέζας και πέφτει σε partial,
  // ενώ η κάρτα κρατάει το authored facing και λέει exposed.
  '1709@NE': 'Λυδί Άνδρου — suspectPin σβήνει γεωμετρία exposed, η κάρτα την κρατάει',
  // Χαμηλή εμπιστοσύνη προφίλ + τομέας χωρίς καταγεγραμμένη ένταση: ο χάρτης δεν έχει αρκετά
  // για να πει exposed και μένει partial, η κάρτα το λέει από τη γωνία.
  '492@NE': 'Άγιος Ισίδωρος Χαλκιδικής — τομέας χωρίς intensity, χάρτης μένει partial',
  '859@NW': 'Γαλάνης Νέστου — τομέας χωρίς intensity, χάρτης μένει partial',
  '1888@S': 'Κολώνα Κύθνου — τομέας χωρίς intensity, χάρτης μένει partial',
}));

/**
 * ΟΙ ΠΑΡΑΛΙΕΣ ΟΠΟΥ ΤΟ ΠΕΡΑΣΜΑ ΓΕΙΤΟΝΙΑΣ ΑΛΛΑΖΕΙ ΤΟ ΧΡΩΜΑ — και γιατί αυτές ΕΠΙΤΡΕΠΕΤΑΙ.
 *
 * Η πρώτη μέτρηση (20/08/2026) βρήκε 89 τέτοιες πινέζες σε 11 παραλίες. Ο έλεγχος όμως
 * ξεχώρισε δύο εντελώς διαφορετικά πράγματα, και μόνο το ένα ήταν σφάλμα:
 *
 *   • Σε 7 παραλίες η ίδια η γεωμετρία της ακτής έλεγε ΑΝΕΜΟΣ ΠΑΝΩ ΣΤΗΝ ΑΚΤΗ (onshore 0,32
 *     έως 0,83, fetch 4-10 χλμ) κι όμως ο εξομαλυντής τους δάνειζε προστασία γείτονα. Αυτό
 *     ΔΙΟΡΘΩΘΗΚΕ στο `mapExposure.takesTheWindHeadOn` — 27 πινέζες σκούρυναν, καμία άλλη
 *     παραλία της χώρας δεν επηρεάστηκε.
 *   • Στις 6 που έμειναν εδώ, η γεωμετρία λέει `protected` με τον άνεμο να ΦΕΥΓΕΙ από τη
 *     στεριά (onshore ως -0,999, fetch 0). Εκεί ο χάρτης έχει δίκιο και η ΚΑΡΤΑ άδικο: το
 *     authored `exposedToWindDirections` τις κρατάει «εκτεθειμένες» σε τομείς όπου ο άνεμος
 *     είναι απόγειος. Το να τις σκουραίναμε για να «συμφωνήσουν» θα χειροτέρευε τον χάρτη
 *     για να καλύψει λάθος της κάρτας — απόφαση Μίλτου 20/08: δεν το κάνουμε.
 *
 * ⚠️ 20/08/2026 — Η ΜΙΣΗ ΑΠΟ ΑΥΤΕΣ ΤΙΣ ΓΡΑΜΜΕΣ ΑΛΛΑΞΕ ΝΟΗΜΑ. Η κάρτα ΔΙΟΡΘΩΘΗΚΕ στους
 * απόγειους τομείς: η σημαία `knownWindSportSpot` έγινε κατευθυντική (PORISMA §Γ28,
 * `windExposureEngine.isKnownWindSportRisk`) και λέει πλέον «Μερική προστασία», όχι
 * «Εκτεθειμένη». Οι έξι ΔΕΝ σβήνονται όμως, γιατί η παραβίαση επιβιώνει με ΑΛΛΗ αιτία και
 * αντίστροφο πρόσημο: το πέρασμα γειτονιάς βγάζει `protected` εκεί που η ΙΔΙΑ η μηχανή του
 * χάρτη, μόνη της, λέει `exposed` — δύο σκαλιά πιο κάτω από τη δική της γεωμετρία, δανεικά
 * από γείτονα. Δηλαδή τώρα ΥΠΕΡ-υπόσχεται ο ΧΑΡΤΗΣ, όχι η κάρτα.
 *
 * ΜΕΤΡΗΘΗΚΕ ΚΑΙ ΔΙΟΡΘΩΘΗΚΕ ΕΝ ΜΕΡΕΙ (§Γ28γ). Εθνικά ο εξομαλυντής ξέπλενε 308 πινέζες, 69 από
 * αυτές ορατά στο χρώμα. Δύο ήταν αδικαιολόγητες και έκλεισαν στο `borrowedReliefIsEarned`:
 * ο Άγιος Ιωάννης Λευκάδας @Δ (onshore 0,56, γεωμ. exposed, ένταση 67) και η Κολυμπήθρα Τήνου
 * @Α (onshore +0,32, άλμα δύο σκαλιών πάνω σε γεωμετρία partial) — η δεύτερη έφυγε εντελώς από
 * τον κατάλογο. Ό,τι ΜΕΝΕΙ εδώ έχει τη σύμφωνη γνώμη της ίδιας του της γεωμετρίας: και στις
 * 62 ορατές πλέον περιπτώσεις ο τομέας του δανειζόμενου λέει κι αυτός `protected`.
 */
const KNOWN_COLOUR = new Map(Object.entries({
  1146: 'Άγιος Ιωάννης Λευκάδας — ο χάρτης δανείζεται protected από γείτονα ενώ μόνος του λέει exposed (κάρτα: partial)',
  1976: 'Φτελιά Μυκόνου — δανεικό protected σε απόγειους ΝΑ/Ν/ΝΔ ΚΑΙ στον πλάγιο Α (onshore +0,04)',
  // ΕΚΛΕΙΣΕ 20/08/2026 — η Μικρή Βίγλα Νάξου (#2006) έφυγε από εδώ ΧΩΡΙΣ να την αγγίξει κανείς.
  // Ο γείτονας που της δάνειζε το protected ήταν ο Όρκος (#2010), μια από τις πιο γνωστές
  // παραλίες kite της Νάξου που δεν ήταν σημειωμένη. Μπήκε στο `KNOWN_WIND_SPORT_SPOT_IDS`
  // (`utils/windProfileOverrides.ts`), έγινε τίμια «Εκτεθειμένη» στους τομείς που τον χτυπάνε,
  // και σταμάτησε να έχει προστασία για δανεισμό. Επιβεβαιώθηκε αφαιρώντας ΜΟΝΟ το #2010 από
  // τον κατάλογο: η παραβίαση επανεμφανίζεται. Άρα η αιτία ήταν κάλυψη, όχι ο εξομαλυντής.
  2158: 'Αποθήκες Τήνου — δανεικό protected σε Α/ΝΑ/Ν ΚΑΙ στον πλάγιο ΝΔ (onshore -0,07)',
}));

/**
 * Η θάλασσα κρατιέται σταθερή επίτηδες. Το χρώμα εξαρτάται και από το κύμα· αν το άφηνα να
 * κινείται δεν θα ήξερα αν το χρώμα άλλαξε από την ΕΚΘΕΣΗ ή από τη θάλασσα, και η πύλη
 * υπάρχει για την έκθεση. 0,40 μ. είναι ήσυχη θάλασσα που δεν επιβάλλει από μόνη της ταβάνι.
 */
const NEUTRAL_SEA_M = 0.4;

const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');

const soloViolations = [];
const neighbourViolations = [];
const neighbourInvisible = [];
const seenKnown = new Set();
const seenKnownColour = new Set();
let comparisons = 0;
let legitimatelyRedder = 0;

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
  } catch { /* περιοχή χωρίς γεωμετρία — η μηχανή πέφτει στο authored προφίλ, σωστά */ }

  for (const { bft, kmh } of BFS) {
    for (const scen of SCEN) {
      const items = [];
      for (const beach of beaches) {
        let assessment;
        try {
          assessment = assessBeachWindExposure({
            beach, geospatialProfile: profiles[beach.id],
            windDirectionDeg: scen.deg, windDirection: scen.dir,
            windSpeedKmh: kmh, beaufort: bft, waveHeightMeters: 0.5,
          });
        } catch { continue; }
        items.push({
          beach, exposureLevel: assessment.exposureLevel, orientation: assessment.facingDeg,
          windProfile: assessment.windProfile, windProfileSource: assessment.source,
          windSector: assessment.windSector, warnings: assessment.warnings,
          geospatialExposure: profiles[beach.id],
        });
      }
      if (!items.length) continue;

      const consistent = getConsistentVisibleMapExposureLevels(items, bft, scen.deg);

      for (const item of items) {
        const id = item.beach.id;
        const card = item.exposureLevel;
        const solo = getVisibleMapExposureLevel(item, bft, scen.deg);
        const withNeighbours = consistent.get(id);
        if (!card || !solo || !withNeighbours) continue;
        comparisons += 1;
        if (RANK[solo] > RANK[card] || RANK[withNeighbours] > RANK[card]) legitimatelyRedder += 1;

        const name = item.beach.name?.gr || item.beach.name?.en || `#${id}`;
        const key = `${id}@${scen.sector}`;

        // Α. η μηχανή του χάρτη μόνη της
        if (RANK[solo] < RANK[card]) {
          if (KNOWN.has(key)) seenKnown.add(key);
          else soloViolations.push({ key, id, name, region: regionId, sector: scen.sector, bft, card, pin: solo });
        }
        // Β. το πέρασμα γειτονιάς — χρεώνεται μόνο ό,τι πρόσθεσε πάνω από το Α
        if (RANK[withNeighbours] < RANK[card] && RANK[withNeighbours] < RANK[solo]) {
          const toneCard = resolveConditionTone({ exposureLevel: card, beaufort: bft, seaStateM: NEUTRAL_SEA_M, isEnclosedCove: false, offshoreFlatWater: false });
          const tonePin = resolveConditionTone({ exposureLevel: withNeighbours, beaufort: bft, seaStateM: NEUTRAL_SEA_M, isEnclosedCove: false, offshoreFlatWater: false });
          const row = { key, id, name, region: regionId, sector: scen.sector, bft, card, solo, pin: withNeighbours, toneCard, tonePin };
          if (toneCard === tonePin) neighbourInvisible.push(row);
          else if (KNOWN_COLOUR.has(String(id))) seenKnownColour.add(String(id));
          else neighbourViolations.push(row);
        }
      }
    }
  }
}

const failures = [];
console.log('Κάρτα vs πινέζα — μία ιστορία έκθεσης ανά παραλία');
console.log(`Συγκρίσεις: ${comparisons.toLocaleString('el-GR')} (${SCEN.length} τομείς × ${BFS.length} εντάσεις, καμία κλήση δικτύου)\n`);

// ── Α ───────────────────────────────────────────────────────────────────────
const soloBeaches = new Set(soloViolations.map(v => v.id));
console.log(`${soloViolations.length === 0 ? 'OK  ' : 'FAIL'} Α. η μηχανή του χάρτη δεν ξεπλένει την κάρτα: ${soloViolations.length} νέες παραβιάσεις`
  + (soloViolations.length ? ` σε ${soloBeaches.size} παραλίες` : ` · ${seenKnown.size}/${KNOWN.size} γνωστές ενεργές`));
for (const v of soloViolations.slice(0, verbose ? 500 : 8)) {
  console.log(`       #${v.id} ${v.name} [${v.region}] @${v.sector} ${v.bft} Μπφ — κάρτα «${v.card}», πινέζα «${v.pin}»`);
}
if (soloViolations.length > 8 && !verbose) console.log(`       …και ${soloViolations.length - 8} ακόμη (--verbose)`);
if (soloViolations.length) failures.push('Α');

// ── Β ───────────────────────────────────────────────────────────────────────
const nbBeaches = new Set(neighbourViolations.map(v => v.id));
console.log(`${neighbourViolations.length === 0 ? 'OK  ' : 'FAIL'} Β. το πέρασμα γειτονιάς δεν ξεπλένει το χρώμα: ${neighbourViolations.length} νέες παραβιάσεις`
  + (neighbourViolations.length ? ` σε ${nbBeaches.size} παραλίες` : ` · ${seenKnownColour.size}/${KNOWN_COLOUR.size} γνωστές ενεργές`));
for (const v of neighbourViolations.slice(0, verbose ? 500 : 8)) {
  console.log(`       #${v.id} ${v.name} [${v.region}] @${v.sector} ${v.bft} Μπφ — κάρτα «${v.card}» (${v.toneCard}), πινέζα «${v.pin}» (${v.tonePin})`);
}
if (neighbourViolations.length > 8 && !verbose) console.log(`       …και ${neighbourViolations.length - 8} ακόμη (--verbose)`);
if (neighbourViolations.length) failures.push('Β');
console.log(`     · χωρίς ορατή αλλαγή χρώματος, μετρημένες ώστε να μη μεγαλώσουν στα κρυφά: ${neighbourInvisible.length}`
  + ` σε ${new Set(neighbourInvisible.map(v => v.id)).size} παραλίες`);

// ── Γ. αυτοσαμποτάζ: η νόμιμη κατεύθυνση πρέπει να υπάρχει ──────────────────
const redderShare = (100 * legitimatelyRedder / comparisons).toFixed(2);
console.log(`${legitimatelyRedder > 0 ? 'OK  ' : 'FAIL'} Γ. η νόμιμη κατεύθυνση ζει: ${legitimatelyRedder} πινέζες πιο κόκκινες από την κάρτα (${redderShare}%)`);
if (legitimatelyRedder === 0) {
  console.log('       Ούτε μία. Ο κανόνας «η πινέζα μπορεί να είναι πιο συντηρητική» καταργήθηκε —');
  console.log('       η πύλη δείχνει υγιέστερη ενώ ο χάρτης έχασε τη συντηρητική του άκρη.');
  failures.push('Γ');
}

// ── Δ. αυτοσαμποτάζ: οι δύο μηχανές πρέπει να μπορούν να διαφωνήσουν ────────
const probe = {
  beach: { id: -1, protectedFrom: [], name: { gr: 'δοκιμή' } },
  exposureLevel: 'protected',
  orientation: 0,
  windProfile: { confidence: 'high', beachFacingDirection: 0, exposedToWindDirections: ['N'], protectedFromWindDirections: [], knownWindSportSpot: false },
  windProfileSource: 'override',
  windSector: 'N',
  warnings: [],
  geospatialExposure: { confidence: 'high', sectors: { N: { level: 'exposed', fetchKm: 20, blockedRayRatio: 0, onshore: 1, intensity: 95 } } },
};
const probePin = getVisibleMapExposureLevel(probe, 5, 0);
console.log(`${probePin !== probe.exposureLevel ? 'OK  ' : 'FAIL'} Δ. οι δύο μηχανές μπορούν να διαφωνήσουν: κάρτα «${probe.exposureLevel}» → πινέζα «${probePin}»`);
if (probePin === probe.exposureLevel) {
  console.log('       Η πινέζα επέστρεψε αυτούσιο το exposureLevel της κάρτας πάνω σε γεωμετρία');
  console.log('       exposed/ένταση 95. Αυτό είναι το ακριβές λάθος που τύφλωσε το quality:verdicts:');
  console.log('       ίδιο input και στα δύο σκέλη, άρα καμία σύγκριση δεν γίνεται πραγματικά.');
  failures.push('Δ');
}

// ── Ε. ο κατάλογος δεν σαπίζει ──────────────────────────────────────────────
const stale = [...KNOWN.keys()].filter(k => !seenKnown.has(k));
const staleColour = [...KNOWN_COLOUR.keys()].filter(k => !seenKnownColour.has(k));
const staleTotal = stale.length + staleColour.length;
console.log(`${staleTotal === 0 ? 'OK  ' : 'FAIL'} Ε. ο κατάλογος γνωστών είναι ζωντανός: ${staleTotal} καταχωρήσεις χωρίς παραβίαση`);
for (const k of stale) console.log(`       ${k} — ${KNOWN.get(k)}  → διορθώθηκε, σβήσε τη γραμμή`);
for (const k of staleColour) console.log(`       #${k} — ${KNOWN_COLOUR.get(k)}  → διορθώθηκε, σβήσε τη γραμμή`);
if (staleTotal) failures.push('Ε');

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(', ')}. Η πινέζα και η κάρτα λένε διαφορετικά πράγματα για την ίδια παραλία.`);
  process.exit(1);
}
console.log('\nΠΕΡΑΣΕ: καμία πινέζα δεν υπόσχεται περισσότερη προστασία από όση λέει η κάρτα της.');
