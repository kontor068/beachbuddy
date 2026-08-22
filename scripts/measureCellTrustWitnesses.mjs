/**
 * ΔΥΟ ΜΑΡΤΥΡΕΣ ΓΙΑ ΤΟ «ΛΑΘΟΣ ΝΕΡΟ» — ΜΕΤΡΗΣΗ, ΜΗΔΕΝ ΑΛΛΑΓΗ (22/08/2026).
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΓΕΝΝΗΣΕ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ. Ο έλεγχος εμπιστοσύνης κόβει 255 παραλίες με κανόνα
 * **ευθείας γραμμής**: «η ακτίνα από την παραλία προς το κελί χτύπησε στεριά». Η μέτρηση
 * `measureMarineCellReachability` έδειξε ότι **214 από τις 246** έχουν δρόμο μέσα από νερό, με
 * διάμεσο στράβωμα 1,12 — δηλαδή η ακτίνα κόβεται σε ένα βραχάκι που το νερό απλώς
 * παρακάμπτει — «οι ακτίνες ταξιδεύουν σε ευθεία, η θάλασσα όχι», το ίδιο μάθημα που η βίβλος
 * έγραψε όταν έπεσε το πρώτο σχέδιο του γεωμετρικού ταβανιού.
 *
 * ⚠️ ΑΛΛΑ Ο ΔΡΟΜΟΣ ΝΕΡΟΥ ΜΟΝΟΣ ΤΟΥ ΔΕΝ ΦΤΑΝΕΙ, ΚΑΙ ΤΟ ΞΕΡΟΥΜΕ ΟΝΟΜΑΣΤΙΚΑ. Το **Σχίσμα
 * Ελούντας** — η παραλία που τύπωνε 0,94 μ. πάνω από λάδι (§Γ, 13/08) — είναι μέσα στις 255 και
 * το κελί του είναι στον ΙΔΙΟ κόλπο (Μιραμπέλλο), άρα απόλυτα «προσβάσιμο με νερό». Ένας κανόνας
 * που κοιτάει μόνο τη διαδρομή θα του έδινε πίσω την εμπιστοσύνη — λάθος.
 *
 * ΑΡΑ ΔΕΥΤΕΡΟΣ ΜΑΡΤΥΡΑΣ, ΚΑΙ ΔΕΝ ΕΙΝΑΙ ΚΑΙΝΟΥΡΙΟΣ: το **στένωμα**
 * (`scripts/lib/enclosureWitness.mjs`, βγαλμένο αυτούσιο από το `auditEnclosedWater`, ήδη
 * δοκιμασμένο απέναντι στους έξι αντιπάλους της Νάουσας). Όταν η παραλία κάθεται **≥2 πλάτη
 * στομίου** πίσω από πραγματικό στένωμα, το κελί έξω από αυτό ΔΕΝ περιγράφει το νερό της, όσο
 * ίσιος κι αν είναι ο δρόμος. **Μετρημένο:** Σχίσμα 3,54 → μένει έξω· Κολυμπήθρες 0,76 και
 * ΑΣΤΕΝΩΤΗ → επιστρέφει, μαζί με τις άλλες πέντε της Νάουσας — και αυτό συμφωνεί με τη βίβλο,
 * που λέει ρητά ότι οι αναγνώσεις πλέγματος της Νάουσας «είναι υπερασπίσιμες».
 *
 * ΤΙ ΒΓΑΖΕΙ. Πόσες παραλίες θα ΞΑΝΑΚΕΡΔΙΖΑΝ την εμπιστοσύνη τους με τους δύο μάρτυρες μαζί,
 * ποιες μένουν έξω και γιατί, και τι λένε οι ονομαστικοί μάρτυρες. **Δεν γράφει τίποτα σε
 * δεδομένα παραγωγής.**
 *
 * Run: node scripts/measureCellTrustWitnesses.mjs [--limit N]
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadMask, makeIsLand } from './lib/coastlineMask.mjs';
import { measureMouthWidthM, MIN_DEPTH_RATIO } from './lib/enclosureWitness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const numArg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : fallback;
};
const LIMIT = numArg('--limit', Infinity);

// Το όριο ζει στη βιβλιοθήκη μαζί με τον κανόνα που το χρησιμοποιεί — ένα νούμερο, ένα σημείο.
import { MAX_TRUSTED_DETOUR } from './lib/marineCellTrust.mjs';

const reach = JSON.parse(readFileSync(path.join(root, 'reports/quality/marine-cell-reachability.json'), 'utf8'));
const detourByBeachId = new Map(reach.rows.map(r => [r.beachId, r]));

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const profiles = new Map();
for (const file of readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json')) {
  for (const p of Object.values(JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {})) {
    if (p?.beachId != null) profiles.set(p.beachId, p);
  }
}

console.error('Φόρτωση ακτογραμμής…');
const mask = loadMask();
const isLand = makeIsLand(mask);
console.error(`Μάσκα: ${mask.polys.length} πολύγωνα. Στένωμα για ${Math.min(reach.rows.length, LIMIT)} παραλίες…`);

const rows = [];
for (const [i, r] of reach.rows.entries()) {
  if (i >= LIMIT) break;
  const profile = profiles.get(r.beachId);
  if (!profile?.coordinates) continue;
  process.stderr.write(`\r  [${i + 1}/${Math.min(reach.rows.length, LIMIT)}] ${r.name ?? r.beachId}          `);

  const { mouthM, reason, bayDepthKm, depthRatio, constricted } =
    measureMouthWidthM(isLand, profile.coordinates.lat, profile.coordinates.lon);

  const reachable = r.detour != null && r.detour <= MAX_TRUSTED_DETOUR;
  const behindMouth = constricted === true && typeof depthRatio === 'number' && depthRatio >= MIN_DEPTH_RATIO;
  const wouldRestore = reachable && !behindMouth;

  rows.push({
    beachId: r.beachId, region: r.region, name: r.name,
    verdict: r.verdict, via: r.via,
    straightKm: r.straightKm, waterPathKm: r.waterPathKm, detour: r.detour,
    mouthM, mouthReason: reason, bayDepthKm, depthRatio, constricted,
    reachable, behindMouth, wouldRestore,
    keptOutBecause: wouldRestore ? null
      : !reachable ? (r.detour == null ? `χωρίς δρόμο νερού (${r.why ?? '—'})` : `στράβωμα ${r.detour}`)
      : `${depthRatio} πλάτη στομίου πίσω από στένωμα ${mouthM} μ.`,
  });
}
process.stderr.write('\r                                                                        \r');

const restored = rows.filter(r => r.wouldRestore);
const kept = rows.filter(r => !r.wouldRestore);
const byReason = kept.reduce((acc, r) => {
  const key = r.behindMouth ? 'πίσω από πραγματικό στένωμα' : r.detour == null ? 'χωρίς δρόμο νερού' : 'στραβός δρόμος';
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

const WITNESSES = ['Σχίσμα', 'Κολυμπήθρες', 'Κριός', 'Λάγγερη', 'Μαρτσέλο', 'Μοναστήρι', 'Λίμνες'];
const named = rows.filter(r => WITNESSES.some(w => (r.name ?? '').includes(w)));

const report = {
  measuredAt: new Date().toISOString(),
  maxTrustedDetour: MAX_TRUSTED_DETOUR,
  minDepthRatio: MIN_DEPTH_RATIO,
  measured: rows.length,
  wouldRestore: restored.length,
  wouldStayUntrusted: kept.length,
  keptReasons: byReason,
  namedWitnesses: named,
  rows,
};

mkdirSync(path.join(root, 'reports/quality'), { recursive: true });
const outPath = path.join(root, 'reports/quality/marine-cell-trust-witnesses.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log('');
console.log(`Μετρήθηκαν: ${rows.length} μη έμπιστες`);
console.log(`  ΘΑ ΞΑΝΑΚΕΡΔΙΖΑΝ εμπιστοσύνη: ${restored.length}`);
console.log(`  ΜΕΝΟΥΝ έξω: ${kept.length} — ${JSON.stringify(byReason)}`);
console.log('');
console.log('ΟΝΟΜΑΣΤΙΚΟΙ ΜΑΡΤΥΡΕΣ (πρέπει: Σχίσμα ΕΞΩ, Νάουσα ΜΕΣΑ):');
for (const r of named) {
  console.log(`  ${(r.name ?? '').slice(0, 24).padEnd(26)} στράβωμα ${String(r.detour ?? '—').padStart(5)} · στόμιο ${String(r.mouthM ?? '—').padStart(5)} μ. · ${String(r.depthRatio ?? '—').padStart(5)} πλάτη · ${r.wouldRestore ? 'ΕΠΙΣΤΡΕΦΕΙ' : 'ΜΕΝΕΙ ΕΞΩ'}`);
}
console.log(`\nΑναφορά: ${path.relative(root, outPath)}`);
