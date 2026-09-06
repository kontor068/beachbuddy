#!/usr/bin/env node
/**
 * ΠΥΛΗ: Η ΚΑΡΤΕΛΑ ΚΑΙ Η ΜΗΧΑΝΗ ΛΕΝΕ ΤΗΝ ΙΔΙΑ ΚΑΤΕΥΘΥΝΣΗ — βίβλος §Γ73 (τέλος).
 *
 * ΤΙ ΦΥΛΑΕΙ. Στις 06/09/2026 βρέθηκαν **794 παραλίες** όπου το `metadata.orientation.degrees`
 * (ό,τι διαβάζει η καρτέλα, η πύλη ηλιοβασιλέματος, το σκοράρισμα στη ζώνη ≤60° και ο
 * ανιχνευτής σύγκρουσης του όρμου) διαφωνούσε >22,5° με το `facingDeg` του γεωμετρικού
 * προφίλ — 5 από αυτές σχεδόν 180°. Αιτία: το orientation γράφεται ΜΙΑ φορά ως αντίγραφο του
 * facingDeg («Generated from Natural Earth…») και κανένα εργαλείο δεν το ξανάγραφε στα
 * geometry rebuild. Ο ανεξάρτητος κριτής OSM έκρινε τη γεωμετρία σωστή **49-2**
 * (`reports/quality/facing-mismatch-osm-verdicts.json`)· ο συγχρονισμός έγινε με το
 * `scripts/syncGeneratedOrientationFromGeospatial.mjs`.
 *
 * Ο ΚΑΝΟΝΑΣ. Κάθε GENERATED orientation (το note αρχίζει με το σήμα) με προφίλ `high` και
 * πεπερασμένο facingDeg πρέπει να απέχει ≤ {@link TOLERANCE_DEG} από το facingDeg. Χειροποίητα
 * orientation (χωρίς το σήμα — π.χ. Μήλος #1922/#1925/#1927) ΕΞΑΙΡΟΥΝΤΑΙ: ανθρώπινη απόφαση
 * δεν ακυρώνεται από πύλη· απλώς αναφέρονται για ορατότητα.
 *
 * ΜΕΤΑ ΑΠΟ GEOMETRY REBUILD ΠΟΥ ΤΗ ΡΙΧΝΕΙ: τρέξε
 *   node scripts/syncGeneratedOrientationFromGeospatial.mjs --write && npm run build:beach-data
 * ΜΗΝ την περάσεις χαλαρώνοντας την ανοχή ή πειράζοντας το σήμα.
 *
 * Χωρίς δίκτυο. Self-proves: σαμποτάρει in-memory μία εγγραφή και απαιτεί να πιαστεί.
 *
 *   node scripts/validateOrientationSyncGate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exposureDir = path.join(root, 'public', 'data', 'geospatial', 'exposure');
const beachDir = path.join(root, 'public', 'data', 'beaches');

const GENERATED_SIGNATURE = 'Generated from Natural Earth geospatial exposure facingDeg';
/** 1° χωράει τη στρογγυλοποίηση του sync (δέκατα)· οτιδήποτε παραπάνω είναι αληθινό ψαλίδι. */
const TOLERANCE_DEG = 1;

const angDelta = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

const failures = [];
const authoredDisagreements = [];
let checkedGenerated = 0;

const checkPair = (beach, profile, regionId, sabotageId = null) => {
  const orientation = beach.metadata?.orientation;
  if (!orientation || typeof orientation.degrees !== 'number') return;
  if (!profile || profile.confidence !== 'high') return;
  if (typeof profile.facingDeg !== 'number' || !Number.isFinite(profile.facingDeg)) return;

  const degrees = beach.id === sabotageId ? orientation.degrees + 30 : orientation.degrees;
  const delta = angDelta(degrees, profile.facingDeg);
  const generated = String(orientation.notes || '').startsWith(GENERATED_SIGNATURE);

  if (!generated) {
    if (delta > 22.5) authoredDisagreements.push(`#${beach.id} ${beach.name?.gr ?? beach.name ?? ''} [${regionId}] Δ${Math.round(delta)}°`);
    return;
  }
  checkedGenerated += 1;
  if (delta > TOLERANCE_DEG) {
    failures.push(`#${beach.id} ${beach.name?.gr ?? beach.name ?? ''} [${regionId}]: καρτέλα ${degrees}° vs γεωμετρία ${profile.facingDeg}° (Δ${Math.round(delta)}°)`);
  }
};

const regions = fs.readdirSync(exposureDir).filter(n => n.endsWith('.json') && n !== 'index.json');
let sabotageCandidate = null;

for (const file of regions) {
  let profiles, beaches;
  try { profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles ?? {}; } catch { continue; }
  try {
    const data = JSON.parse(fs.readFileSync(path.join(beachDir, file), 'utf8'));
    beaches = Array.isArray(data) ? data : (data.beaches || Object.values(data).find(v => Array.isArray(v)));
  } catch { continue; }
  if (!beaches) continue;
  for (const beach of beaches) {
    const profile = profiles[beach.id];
    checkPair(beach, profile, file.replace(/\.json$/, ''));
    if (!sabotageCandidate && String(beach.metadata?.orientation?.notes || '').startsWith(GENERATED_SIGNATURE)
      && profile?.confidence === 'high' && typeof profile.facingDeg === 'number') {
      sabotageCandidate = { beach, profile, regionId: file.replace(/\.json$/, '') };
    }
  }
}

// ── Self-prove: μια πειραγμένη εγγραφή ΠΡΕΠΕΙ να πιαστεί, αλλιώς η πύλη δεν κρίνει τίποτα ──
if (!sabotageCandidate) {
  failures.push('ΑΥΤΟΕΛΕΓΧΟΣ: δεν βρέθηκε ούτε μία generated εγγραφή — η πύλη δεν ελέγχει τίποτα.');
} else {
  const before = failures.length;
  checkPair(sabotageCandidate.beach, sabotageCandidate.profile, sabotageCandidate.regionId, sabotageCandidate.beach.id);
  if (failures.length === before) {
    failures.push('ΑΥΤΟΕΛΕΓΧΟΣ: το σαμποτάζ +30° ΔΕΝ πιάστηκε — η πύλη είναι τυφλή.');
  } else {
    failures.pop(); // το σαμποτάζ ήταν δικό μας, όχι των δεδομένων
  }
}

if (checkedGenerated < 1500) {
  failures.push(`ΑΥΤΟΕΛΕΓΧΟΣ: μόνο ${checkedGenerated} generated εγγραφές ελέγχθηκαν (περιμέναμε ~2.700+) — κάτι δεν φορτώθηκε.`);
}

if (failures.length) {
  console.error('❌ Η ΠΥΛΗ ΕΠΕΣΕ — καρτέλα και μηχανή διαφωνούν για το πού κοιτάει η παραλία (§Γ73)');
  for (const f of failures.slice(0, 15)) console.error(`  · ${f}`);
  if (failures.length > 15) console.error(`  … και ${failures.length - 15} ακόμα`);
  console.error('ΔΙΟΡΘΩΣΗ: node scripts/syncGeneratedOrientationFromGeospatial.mjs --write && npm run build:beach-data');
  process.exit(1);
}
console.log(`✅ Καρτέλα και μηχανή συμφωνούν για την κατεύθυνση — ${checkedGenerated} generated εγγραφές, ανοχή ${TOLERANCE_DEG}°.`);
if (authoredDisagreements.length) {
  console.log(`   ℹ Χειροποίητα που διαφωνούν >22,5° (επιτρεπτό, ανθρώπινη απόφαση): ${authoredDisagreements.join(' · ')}`);
}
