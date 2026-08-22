/**
 * Η ΠΥΛΗ ΤΟΥ «ΛΑΘΟΣ ΝΕΡΟΥ» (22/08/2026).
 *
 * Η ΑΙΤΙΑ ΠΟΥ ΦΥΛΑΕΙ. Ο δικός μας έλεγχος βρήκε 255 παραλίες των οποίων το θαλάσσιο κελί
 * περιγράφει άλλο νερό, τις σημάδεψε μέσα στα προφίλ γεωμετρίας — και για έναν ολόκληρο μήνα
 * **καμία γραμμή παραγωγής δεν διάβασε τη σημαία**. Το ίδιο το εργαλείο που την έγραψε το
 * σημείωνε στην έξοδό του, και κανείς δεν το είδε. Αυτή η πύλη υπάρχει για να μη ξανασυμβεί
 * σιωπηλά, και για να μη γίνει ο κανόνας κάτι άλλο από αυτό που αποφασίστηκε:
 *
 *   α) **να πάψει να διαβάζεται** — η σημαία να μη φτάνει στο αντικείμενο που κρίνει το βάθρο.
 *      Δύο διαφορετικοί builders φτιάχνουν τα αντικείμενα, και ο ένας από τους δύο έχει ήδη
 *      ξεχάσει πεδίο στο παρελθόν (σχόλιο 11/08 στο `recommendationService`: το ύψος ακτής
 *      υπήρχε στον τύπο αλλά δεν αντιγραφόταν, και η κάρτα έλεγε άλλο κύμα από τη σελίδα).
 *   β) **να γίνει ανεπιφύλακτος** — ο Μίλτος επέλεξε ρητά «έξω ΜΟΝΟ όταν μετράει το κύμα».
 *      Μηδενικό κατώφλι θα άδειαζε 6 βάθρα αντί για 2 (μετρημένο).
 *   γ) **να μείνει σιωπηλός** — ο αποκλεισμός πρέπει να έχει όνομα (`sea_cell`), αλλιώς η
 *      παραλία εξαφανίζεται από το βάθρο χωρίς κανείς να μπορεί να πει γιατί.
 *
 * ΤΟ ΚΡΙΝΕΙ ΤΟ ΠΡΟΪΟΝ: πραγματικές παραλίες, πραγματικά προφίλ, οι πραγματικές
 * `getSuitableBeaches` / `getTopRecommendedBeaches` / `isTrustedTopRecommendationCandidate` /
 * `explainTopPickExclusion`. Το «πριν» δεν προσομοιώνεται — είναι τα ίδια προφίλ με τη σημαία
 * σβησμένη.
 *
 * Run: node scripts/validateUntrustedCellGate.mjs [--prove]
 */
import { readFileSync, readdirSync } from 'node:fs';
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
const { UNTRUSTED_CELL_SEA_FLOOR_M } = require(path.join(root, 'services/topPickRanking.ts'));
const {
  getSuitableBeaches, getTopRecommendedBeaches, isTrustedTopRecommendationCandidate, explainTopPickExclusion,
} = require(path.join(root, 'services/recommendationService.ts'));

const PROVE = process.argv.includes('--prove');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');

const failures = [];
const note = (message) => failures.push(message);

const buildDay = (windMs, waveM) => createDailyForecast(0, {
  id: 'untrusted-gate', label: 'gate',
  windDirectionDeg: 20, windSpeedMs: windMs, windGustMs: windMs * 1.35,
  waveHeightM: waveM, waveDirectionDeg: 20,
});
const CALM = buildDay(3, 0.15);
const ROUGH = buildDay(9, 1.0);

const regions = readdirSync(exposureDir)
  .filter(name => name.endsWith('.json') && name !== 'index.json')
  .map((file) => {
    try {
      const app = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8'));
      const raw = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {};
      const profiles = {};
      const trusting = {};
      const untrusted = new Set();
      for (const profile of Object.values(raw)) {
        if (profile?.beachId == null) continue;
        profiles[profile.beachId] = profile;
        const { marineCellTrusted, ...rest } = profile;
        trusting[profile.beachId] = rest;
        if (marineCellTrusted === false) untrusted.add(profile.beachId);
      }
      return { regionId: file.replace(/\.json$/, ''), beaches: app.island.beaches, profiles, trusting, untrusted };
    } catch {
      return null;
    }
  })
  .filter(Boolean)
  .filter(region => region.untrusted.size > 0);

if (regions.length === 0) {
  console.error('Καμία περιοχή με σημαία «λάθος νερό» — ή η σήμανση χάθηκε, ή τα δεδομένα λείπουν.');
  process.exit(1);
}

const score = (region, day, profiles) => {
  const byId = new Map();
  for (const item of getSuitableBeaches(region.beaches, day, 'gr', undefined, day.hourly, undefined, {}, profiles)) {
    byId.set(item.beach.id, item);
  }
  return byId;
};

// (Α) Η σημαία φτάνει στο αντικείμενο — και από τους ΔΥΟ builders.
let flagSeen = 0;
let flagSeenTopPicks = 0;
let trustedCarryingFlag = 0;
for (const region of regions) {
  const items = score(region, ROUGH, region.profiles);
  for (const [beachId, item] of items) {
    if (region.untrusted.has(beachId)) {
      if (item.marineCellUntrusted === true) flagSeen += 1;
      else note(`${region.regionId}#${beachId}: σημαδεμένη ως «λάθος νερό» αλλά το αντικείμενο δεν τη μεταφέρει.`);
    } else if (item.marineCellUntrusted) {
      trustedCarryingFlag += 1;
    }
  }
  for (const item of getTopRecommendedBeaches(region.beaches, ROUGH, 'gr', undefined, ROUGH.hourly, undefined, {}, region.profiles) ?? []) {
    if (region.untrusted.has(item.beach?.id ?? item.beachId) && item.marineCellUntrusted === true) flagSeenTopPicks += 1;
  }
}
if (flagSeen === 0) note('Α: η σημαία δεν έφτασε σε ΚΑΜΙΑ παραλία μέσω getSuitableBeaches.');
if (trustedCarryingFlag > 0) note(`Α: ${trustedCarryingFlag} παραλίες ΧΩΡΙΣ σήμανση κουβαλάνε τη σημαία.`);

// (Β)+(Γ) Υπό συνθήκη: ήρεμη μέρα δεν αλλάζει τίποτα, κυματώδης βγάζει — και ο λόγος έχει όνομα.
let calmUnchanged = 0;
let roughRemoved = 0;
let namedReason = 0;
let calmChangedWrongly = 0;
for (const region of regions) {
  for (const [day, isRough] of [[CALM, false], [ROUGH, true]]) {
    const beaufort = getBeaufortLevel((day.wind?.speed ?? 0) * 3.6);
    const real = score(region, day, region.profiles);
    const blind = score(region, day, region.trusting);

    for (const beachId of region.untrusted) {
      const a = blind.get(beachId);
      const b = real.get(beachId);
      if (!a || !b) continue;
      const passedBefore = isTrustedTopRecommendationCandidate(a, undefined, beaufort);
      const passesNow = isTrustedTopRecommendationCandidate(b, undefined, beaufort);

      if (!isRough) {
        if (passedBefore !== passesNow) calmChangedWrongly += 1;
        else calmUnchanged += 1;
        continue;
      }
      if (passedBefore && !passesNow) {
        roughRemoved += 1;
        const reason = explainTopPickExclusion(b, beaufort, (day.wind?.speed ?? 0) * 3.6, day.marine?.waveHeightM);
        if (reason === 'sea_cell') namedReason += 1;
        else note(`${region.regionId}#${beachId}: βγήκε από το βάθρο αλλά ο λόγος λέει «${reason ?? 'τίποτα'}», όχι «sea_cell».`);
      }
    }
  }
}
if (calmChangedWrongly > 0) note(`Β: σε ΗΡΕΜΗ μέρα ο κανόνας άλλαξε ${calmChangedWrongly} παραλίες — έπρεπε να είναι αδρανής.`);
if (roughRemoved === 0) note('Γ: σε ΚΥΜΑΤΩΔΗ μέρα δεν βγήκε καμία παραλία — ο κανόνας είναι νεκρός.');
if (roughRemoved > 0 && namedReason !== roughRemoved) note(`Γ: ${roughRemoved - namedReason} αποκλεισμοί χωρίς όνομα.`);

// (Δ) Το κατώφλι δεν επιτρέπεται να εκφυλιστεί σε «έξω πάντα».
if (!(UNTRUSTED_CELL_SEA_FLOOR_M > 0)) {
  note(`Δ: το κατώφλι είναι ${UNTRUSTED_CELL_SEA_FLOOR_M} — ο κανόνας έγινε ανεπιφύλακτος, που ΔΕΝ ήταν η απόφαση.`);
}

if (PROVE) {
  // Η σημαία είναι όντως ΑΥΤΗ που τις έβγαλε: με τα ίδια προφίλ χωρίς αυτήν, οι ίδιες παραλίες
  // την ίδια μέρα πρέπει να ξαναπερνάνε. Αν όχι, μετράμε κάτι άλλο και το χρεώνουμε εδώ.
  let provedByRemoval = 0;
  for (const region of regions) {
    const beaufort = getBeaufortLevel((ROUGH.wind?.speed ?? 0) * 3.6);
    const real = score(region, ROUGH, region.profiles);
    const blind = score(region, ROUGH, region.trusting);
    for (const beachId of region.untrusted) {
      const a = blind.get(beachId);
      const b = real.get(beachId);
      if (!a || !b) continue;
      if (isTrustedTopRecommendationCandidate(a, undefined, beaufort)
        && !isTrustedTopRecommendationCandidate(b, undefined, beaufort)) provedByRemoval += 1;
    }
  }
  if (provedByRemoval === 0) {
    note('--prove: σβήνοντας τη σημαία δεν ξαναπέρασε καμία — άρα ο αποκλεισμός δεν οφείλεται σε αυτήν.');
  }
}

if (failures.length > 0) {
  console.error('Η πύλη του «λάθος νερού» ΕΠΕΣΕ:');
  for (const failure of failures.slice(0, 25)) console.error(`  - ${failure}`);
  if (failures.length > 25) console.error(`  … και άλλα ${failures.length - 25}`);
  process.exit(1);
}

console.log(
  `Λάθος νερό: ${flagSeen} σημαδεμένες φτάνουν στην κρίση (${flagSeenTopPicks} και από το δεύτερο builder)· `
  + `ήρεμη μέρα ${calmUnchanged} αμετάβλητες· κυματώδης ${roughRemoved} έξω, όλες με όνομα λόγου· `
  + `κατώφλι ${UNTRUSTED_CELL_SEA_FLOOR_M} μ.${PROVE ? ' + αυτοαπόδειξη' : ''} — πέρασαν.`
);
