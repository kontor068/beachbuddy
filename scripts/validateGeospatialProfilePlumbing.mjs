#!/usr/bin/env node
/**
 * ΟΤΙ ΓΡΑΦΕΙ Ο ΤΥΠΟΣ, ΦΤΑΝΕΙ ΣΤΗΝ ΟΘΟΝΗ — κανένα πεδίο δεν χάνεται στο ξαναχτίσιμο του προφίλ.
 *
 * ΤΙ ΤΟ ΓΕΝΝΗΣΕ (27/08/2026, Γλυφάδα Νάξου #1993). Το `normalizeProfiles` του
 * `services/geospatialExposureService.ts` ξαναχτίζει κάθε προφίλ ΠΕΔΙΟ-ΠΕΔΙΟ, και το
 * `windShadow` δεν αντιγραφόταν: ο τύπος το δήλωνε, το αρχείο στον δίσκο το είχε, ο client
 * δεν το έβλεπε ποτέ. Δύο συνέπειες, καμία ορατή από τις 81 τότε πύλες:
 *
 *   • Η γραμμή του απόγειου ανέμου (24/08, resolveOffshoreWindNote) ΔΕΝ ΑΝΑΨΕ ΠΟΤΕ στο
 *     live site — `windArrivedOverLand(undefined)` = false = σιωπή. Μετρήθηκε, μπήκε,
 *     πέρασε όλες τις πύλες, και έμεινε νεκρή τρεις μέρες.
 *   • Η πύλη της λέξης «απάνεμη» (27/08) γεννήθηκε νεκρή για τον ίδιο λόγο — ο Μίλτος την
 *     είδε να μη δουλεύει στη Γλυφάδα την ώρα που το σωστό JS ήταν ήδη live.
 *
 * Είναι το λάθος του 13/08 («ακολούθα την τιμή ως το JSX που την τυπώνει») μία στρώση πιο
 * κάτω: η τιμή έφτανε στο JSX, αλλά το ΑΝΤΙΚΕΙΜΕΝΟ που έφτανε είχε χάσει το πεδίο στη
 * μετακόμιση. Το validateOffshoreWindNote ελέγχει δεδομένα και λογική· κανείς δεν έλεγχε
 * τον μεταφορέα.
 *
 * ΠΩΣ ΕΛΕΓΧΕΙ. Τρέχει το ΠΡΑΓΜΑΤΙΚΟ `loadGeospatialExposureProfiles` (όχι αντίγραφο της
 * λογικής του) με mock fetch που σερβίρει τα πραγματικά αρχεία του
 * `public/data/geospatial/exposure/`, σε ΟΛΕΣ τις περιοχές. Μετά διαβάζει από το types.ts
 * (με τον compiler της TypeScript, όχι με regex) ποια πεδία δηλώνει το
 * GeospatialExposureProfile, και απαιτεί: κάθε δηλωμένο πεδίο που υπάρχει στο ωμό αρχείο
 * να υπάρχει και στο αντικείμενο που παραδίδεται στον client. Το επόμενο πεδίο που θα
 * ξεχαστεί στη μετακόμιση σκάει εδώ, με τ' όνομά του.
 *
 * ΜΑΡΤΥΡΕΣ, ΚΑΡΦΩΜΕΝΟΙ ΚΑΙ ΑΠΟ ΤΙΣ ΔΥΟ ΜΕΡΙΕΣ (τα ίδια πρόσωπα με το ιστορικό τους):
 *   • Γλυφάδα #1993: το windShadow φτάνει στον client ΚΑΙ λέει «ο βοριάς ΔΕΝ ήρθε από
 *     στεριά» — η συνθήκη του feedback της 27/08.
 *   • Φυριπλάκα #1927: ο βοριάς της έρχεται πάνω από τη ράχη — windArrivedOverLand true.
 *   • Λυγαριά #636: ο μάρτυρας που γέννησε το windShadow (16/08) — true στις 312°.
 *
 * Αυτο-αποδεικνύεται με --prove: ξαναπαίζει το ακριβές λάθος της 27/08 (σβήνει το
 * windShadow από το ξαναχτισμένο αντικείμενο) και απαιτεί η πύλη να ΣΚΑΣΕΙ· το ίδιο και
 * για τα sectors· και αρνείται να κρίνει αν η ανάγνωση του τύπου γύρισε ύποπτα λίγα πεδία.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const prove = process.argv.includes('--prove');
const failures = [];
const fail = (message) => failures.push(message);

/* ── 1. ΤΑ ΠΕΔΙΑ ΠΟΥ ΥΠΟΣΧΕΤΑΙ Ο ΤΥΠΟΣ — από τον compiler, όχι από τη μνήμη κανενός ──── */
const typesSource = ts.createSourceFile('types.ts', fs.readFileSync(path.join(root, 'types.ts'), 'utf8'), ts.ScriptTarget.ES2020, true);
const declaredFields = [];
const visit = (node) => {
  if (ts.isInterfaceDeclaration(node) && node.name.text === 'GeospatialExposureProfile') {
    for (const member of node.members) {
      if (ts.isPropertySignature(member) && member.name && ts.isIdentifier(member.name)) declaredFields.push(member.name.text);
    }
  }
  ts.forEachChild(node, visit);
};
visit(typesSource);

// Αν η ανάγνωση του τύπου χαλάσει, η πύλη θα ενέκρινε τα πάντα ελέγχοντας τίποτα.
if (declaredFields.length < 5) fail(`Η ανάγνωση του GeospatialExposureProfile από το types.ts γύρισε μόνο ${declaredFields.length} πεδία (${declaredFields.join(', ')}) — η πύλη δεν έχει τι να ελέγξει.`);
if (!declaredFields.includes('windShadow')) fail('Το GeospatialExposureProfile δεν δηλώνει πια windShadow — αν αφαιρέθηκε συνειδητά, αυτή η πύλη και οι καταναλωτές του (offshoreWindNote, λέξη «φυσάει») πρέπει να αλλάξουν ΜΑΖΙ του, όχι να σωπάσουν.');

/* Πεδία που το service παράγει σκόπιμα το ίδιο (δεν έρχονται από το αρχείο): μόνο αυτά
   επιτρέπεται να λείπουν από τη σύγκριση ωμού↔client. Κάθε νέα εξαίρεση θέλει λόγο εδώ. */
const SERVICE_OWNED = new Set(['source']);

/* ── 2. ΤΟ ΠΡΑΓΜΑΤΙΚΟ SERVICE ΜΕ MOCK FETCH ΠΑΝΩ ΣΤΑ ΠΡΑΓΜΑΤΙΚΑ ΑΡΧΕΙΑ ───────────────── */
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const regionFiles = fs.readdirSync(exposureDir).filter(f => f.endsWith('.json'));
const rawByRegion = new Map(regionFiles.map(f => [f.replace(/\.json$/, ''), JSON.parse(fs.readFileSync(path.join(exposureDir, f), 'utf8'))]));

globalThis.fetch = async (url) => {
  const regionId = String(url).replace('/data/geospatial/exposure/', '').replace('.json', '');
  const payload = rawByRegion.get(regionId);
  if (!payload) return { ok: false, status: 404, json: async () => ({}) };
  return { ok: true, status: 200, json: async () => payload };
};

const { loadGeospatialExposureProfiles } = require(path.join(root, 'services/geospatialExposureService.ts'));
const { windArrivedOverLand, WIND_SHADOW_SLOTS } = require(path.join(root, 'utils/offshoreWindNote.ts'));

/* ── 3. ΚΑΘΕ ΠΕΔΙΟ ΕΠΙΖΕΙ ΤΗ ΜΕΤΑΚΟΜΙΣΗ, ΣΕ ΟΛΕΣ ΤΙΣ ΠΕΡΙΟΧΕΣ ────────────────────────── */
const auditLookup = (lookup, rawPayload, regionId, sink) => {
  let audited = 0;
  for (const raw of Object.values(rawPayload.profiles || {})) {
    const client = lookup?.[raw.beachId];
    if (!client) continue; // προφίλ που το service απορρίπτει συνειδητά (isUsableGeneratedProfile)
    audited += 1;
    for (const field of declaredFields) {
      if (SERVICE_OWNED.has(field)) continue;
      if (raw[field] === undefined || raw[field] === null) continue;
      if (client[field] === undefined || client[field] === null) {
        sink(`${regionId} #${raw.beachId}: το πεδίο «${field}» υπάρχει στο αρχείο αλλά ΔΕΝ φτάνει στον client — το normalizeProfiles το έχασε στη μετακόμιση (το λάθος της 27/08 ξανά).`);
      }
    }
  }
  return audited;
};

let totalAudited = 0;
let regionsAudited = 0;
for (const [regionId, rawPayload] of rawByRegion) {
  const lookup = await loadGeospatialExposureProfiles(regionId);
  if (!lookup) continue;
  regionsAudited += 1;
  totalAudited += auditLookup(lookup, rawPayload, regionId, fail);
}
if (regionsAudited < 50 || totalAudited < 1000) {
  fail(`Ελέγχθηκαν μόνο ${regionsAudited} περιοχές / ${totalAudited} προφίλ — πολύ λίγα για εθνική εγγύηση· κάτι χάλασε στη φόρτωση, όχι στα δεδομένα.`);
}

/* ── 4. ΟΙ ΜΑΡΤΥΡΕΣ: ΤΟ ΠΕΔΙΟ ΟΧΙ ΜΟΝΟ ΦΤΑΝΕΙ, ΑΛΛΑ ΛΕΕΙ ΤΟ ΣΩΣΤΟ ────────────────────── */
const witness = async (regionId, beachId, name, deg, expectOverLand) => {
  const lookup = await loadGeospatialExposureProfiles(regionId);
  const profile = lookup?.[beachId];
  if (!profile) return fail(`Ο μάρτυρας ${name} #${beachId} δεν υπάρχει στο client lookup της ${regionId}.`);
  if (typeof profile.windShadow !== 'string' || profile.windShadow.length !== WIND_SHADOW_SLOTS) {
    return fail(`Ο μάρτυρας ${name} #${beachId} φτάνει στον client ΧΩΡΙΣ έγκυρο windShadow (${JSON.stringify(profile.windShadow)}).`);
  }
  const arrived = windArrivedOverLand(profile.windShadow, deg);
  if (arrived !== expectOverLand) {
    fail(`Ο μάρτυρας ${name} #${beachId} με άνεμο από ${deg}°: windArrivedOverLand=${arrived}, περιμέναμε ${expectOverLand} — ή χάλασαν τα δεδομένα ή η σημασία του πεδίου.`);
  }
};
await witness('south-aegean-naxos', 1993, 'Γλυφάδα', 0, false);      // το feedback της 27/08: βοριάς ΚΑΤΑ ΜΗΚΟΣ της ακτής
await witness('south-aegean-milos', 1927, 'Φυριπλάκα', 5, true);     // ο βοριάς περνά πάνω από τη ράχη
await witness('crete-crete-heraklion', 636, 'Λυγαριά', 312, true);   // ο μάρτυρας που γέννησε το windShadow (16/08)

/* ── 5. ΑΥΤΟ-ΑΠΟΔΕΙΞΗ: ΤΟ ΑΚΡΙΒΕΣ ΛΑΘΟΣ ΤΗΣ 27/08 ΠΡΕΠΕΙ ΝΑ ΣΚΑΕΙ ─────────────────────── */
if (prove) {
  const naxosRaw = rawByRegion.get('south-aegean-naxos');
  const naxosLookup = await loadGeospatialExposureProfiles('south-aegean-naxos');
  for (const dropped of ['windShadow', 'sectors']) {
    const doctored = Object.fromEntries(Object.entries(naxosLookup).map(([id, p]) => {
      const copy = { ...p };
      delete copy[dropped];
      return [id, copy];
    }));
    const caught = [];
    auditLookup(doctored, naxosRaw, 'south-aegean-naxos', m => caught.push(m));
    if (caught.length === 0) fail(`--prove: έσβησα το «${dropped}» από κάθε client προφίλ της Νάξου και η πύλη ΔΕΝ το είδε — ο έλεγχος είναι διακοσμητικός.`);
  }
}

/* ── ΕΤΥΜΗΓΟΡΙΑ ───────────────────────────────────────────────────────────────────────── */
if (failures.length > 0) {
  console.error(`✗ Το προφίλ χάνει πράγματα στον δρόμο προς την οθόνη (${failures.length}):`);
  for (const message of failures.slice(0, 20)) console.error(`  - ${message}`);
  if (failures.length > 20) console.error(`  … και ${failures.length - 20} ακόμα.`);
  process.exit(1);
}
console.log(`✓ Ό,τι δηλώνει ο τύπος φτάνει στον client: ${totalAudited.toLocaleString('el-GR')} προφίλ σε ${regionsAudited} περιοχές, πεδία [${declaredFields.join(', ')}], και οι 3 μάρτυρες σωστοί${prove ? ' — και το λάθος της 27/08 αποδεδειγμένα πιάνεται' : ''}.`);
