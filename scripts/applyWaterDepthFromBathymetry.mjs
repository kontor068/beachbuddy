#!/usr/bin/env node
/**
 * ΤΟ ΒΑΘΟΣ ΠΟΥ ΛΕΙΠΕΙ ΔΕΝ ΕΙΝΑΙ ΣΙΩΠΗ — ΕΙΝΑΙ ΕΙΚΑΣΙΑ ΑΠΟ ΤΗΝ ΑΜΜΟ
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ. Όταν λείπει το `metadata.waterDepth`, ο builder δεν αφήνει κενό — μαντεύει
 * από το έδαφος (buildBeachRegionData.mjs:672 → :311-319): `fine_sand` ⇒ `shallow` ⇒
 * `shallowWaters: true`, και αν η παραλία είναι οργανωμένη με βατή πρόσβαση, ⇒
 * `familyFriendly: true`. Δηλαδή η παραλία μπαίνει στο φίλτρο «Για παιδιά», στους οδηγούς
 * /family-beaches και στο JSON-LD που διαβάζει η Google, χωρίς κανένα στοιχείο για το νερό.
 * Μετρημένο 25/08/2026: 175 παραλίες σε αυτή την κατάσταση.
 *
 * Η ΠΗΓΗ. Το public/data/geospatial/bathymetry/ έχει ήδη 2.872 προφίλ EMODnet στον δίσκο —
 * βάθος στα 100/300/500 m σε οκτώ τομείς. Καμία κλήση δικτύου.
 *
 * Ο ΚΑΝΟΝΑΣ, ΚΑΙ ΓΙΑΤΙ ΕΙΝΑΙ ΜΟΝΟΠΛΕΥΡΟΣ. Γραμμένος στο utils/seabedEntry.ts:19-22: το
 * EMODnet εξομαλύνει τα ρηχά, οπότε «15 μ. στα 100 μ.» δεν μπορεί να είναι κατασκευασμένο,
 * ενώ «1,1 μ.» μπορεί. Άρα η βαθυμετρία αποδεικνύει την ΑΠΟΤΟΜΗ πλευρά και ποτέ τη ρηχή.
 * Εδώ γράφουμε μόνο `deep` και `medium`, ΠΟΤΕ `shallow` — το `shallow` είναι η μόνη τιμή που
 * ξεκλειδώνει το «οικογενειακή», και το λάθος εκεί το πληρώνει γονιός με μικρό παιδί.
 *
 * ΤΑ ΚΑΤΩΦΛΙΑ ΕΙΝΑΙ ΤΟΥ ΕΡΓΟΥ, ΟΧΙ ΔΙΚΑ ΜΑΣ. Εθνική διάμεσος βάθους στα 100 m = 3,2 μ.
 * (p75 5,9 · p90 9,4), utils/seabedEntry.ts:29.
 *   · d100 >= 12 μ.  ⇒ deep   — το μοναδικό ρατιφικαρισμένο κατώφλι (STEEP_DEPTH_AT_100M_M)
 *   · d100 >= 5,9 μ. ⇒ medium — πάνω από το εθνικό p75: σίγουρα ΔΕΝ είναι ρηχή
 *   · οτιδήποτε πιο ρηχό ⇒ τίποτα. Δεν το ξέρουμε, και η βαθυμετρία δεν μπορεί να το πει.
 *
 * ΤΙ ΚΕΡΔΙΖΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ. Κάθε `medium` που γράφεται αφαιρεί μία ψεύτικη «οικογενειακή».
 *
 * Χρήση:  node scripts/applyWaterDepthFromBathymetry.mjs            (dry-run)
 *         node scripts/applyWaterDepthFromBathymetry.mjs --write
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(rootDir, 'public', 'greek_beaches.json');
const bathyDir = path.join(rootDir, 'public', 'data', 'geospatial', 'bathymetry');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const STAMP = arg('--stamp', new Date().toISOString().slice(0, 10));

const STEEP_M = 12;      // utils/seabedEntry.ts:33 — STEEP_DEPTH_AT_100M_M
const NOT_SHALLOW_M = 5.9; // εθνικό p75, utils/seabedEntry.ts:29

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const sectorOf = (deg) => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Οι ίδιες λέξεις που κουβαλάει ήδη το σύνολο (720 «Βαθιά νερά», 277 «Μέτριο βάθος»).
const SPEC = {
  deep: { label: 'Βαθιά νερά', notes: 'Το βάθος ανεβαίνει γρήγορα μετά την είσοδο στη θάλασσα.' },
  medium: { label: 'Μέτριο βάθος', notes: 'Η είσοδος στη θάλασσα είναι πιο ήπια και το βάθος αυξάνει πιο σταδιακά.' },
};

// Προφίλ ανά περιοχή, φορτωμένα μία φορά.
const bathyByRegion = new Map();
const profileFor = (regionId, id) => {
  if (!bathyByRegion.has(regionId)) {
    const p = path.join(bathyDir, `${regionId}.json`);
    bathyByRegion.set(regionId, existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null);
  }
  return bathyByRegion.get(regionId)?.profiles?.[String(id)] || null;
};

// Ο πίνακας περιοχών δίνει το regionId· το greek_beaches.json δεν το κουβαλάει ανά εγγραφή.
const index = JSON.parse(readFileSync(path.join(rootDir, 'public', 'data', 'beaches', 'index.json'), 'utf8'));
const regionOfBeach = new Map();
for (const region of index.regions) {
  const p = path.join(rootDir, 'public', 'data', 'beaches', `${region.id}.json`);
  if (!existsSync(p)) continue;
  for (const b of JSON.parse(readFileSync(p, 'utf8'))) regionOfBeach.set(Number(b.id), region.id);
}

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const appendNote = (m, line) => {
  if (Array.isArray(m.sourceNotes)) m.sourceNotes.push(line);
  else m.sourceNotes = m.sourceNotes ? `${m.sourceNotes} ${line}` : line;
};

const applied = [];
const tooShallow = [];
const noEvidence = [];

(function walk(node) {
  if (Array.isArray(node)) { for (const it of node) walk(it); return; }
  if (!node || typeof node !== 'object') return;

  if (node.id !== undefined && node.lat !== undefined && node.metadata
      && !node.metadata.waterDepth?.type && !node.metadata.excludeFromApp) {
    const id = Number(node.id);
    const facing = Number(node.metadata.orientation?.degrees);
    const regionId = regionOfBeach.get(id);
    const profile = regionId ? profileFor(regionId, id) : null;
    const sector = Number.isFinite(facing) ? sectorOf(facing) : null;
    const d100 = sector ? profile?.sectors?.[sector]?.depths?.['100m'] : null;

    if (d100 == null) {
      noEvidence.push({ id, name: node.name, why: !Number.isFinite(facing) ? 'χωρίς φορά ακτής' : 'χωρίς βαθυμετρία' });
    } else if (d100 < NOT_SHALLOW_M) {
      tooShallow.push({ id, name: node.name, d100 });
    } else {
      const type = d100 >= STEEP_M ? 'deep' : 'medium';
      node.metadata.waterDepth = { type, label: SPEC[type].label, notes: SPEC[type].notes };
      appendNote(
        node.metadata,
        `Water depth from EMODnet bathymetry ${STAMP}: ${d100} m at 100 m offshore on the `
        + `${sector} bearing (beach faces ${facing.toFixed(1)}°), profile confidence `
        + `${profile.confidence || 'unknown'}. Above the national p75 of ${NOT_SHALLOW_M} m, so the water is `
        + `demonstrably not shallow; recorded as "${type}"`
        + `${type === 'deep' ? ` (>= ${STEEP_M} m, the ratified steep threshold)` : ''}. `
        + 'Bathymetry can prove the steep side only, never the shallow one — no "shallow" is ever written from it. '
        + 'Previously the field was absent and the app inferred depth from shore surface. No other field changed.',
      );
      applied.push({ id, name: node.name, type, d100, sector, conf: profile.confidence });
    }
  }
  for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
})(source);

if (write && applied.length) writeFileSync(sourcePath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`applyWaterDepthFromBathymetry — ${write ? 'WRITE' : 'DRY-RUN'}`);
for (const a of applied) {
  console.log(`  →#${a.id} ${a.name}: ${a.type} (${a.d100} m στα 100 m, τομέας ${a.sector}, ${a.conf})`);
}
console.log(`\n${applied.length} γράφτηκαν  ·  ${tooShallow.length} πιο ρηχές από το p75 — δεν αποδεικνύεται τίποτα`
  + `  ·  ${noEvidence.length} χωρίς στοιχείο`);
if (!write && applied.length) console.log('— ξανατρέξε με --write');
