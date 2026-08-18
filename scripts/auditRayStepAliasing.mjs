#!/usr/bin/env node
/**
 * ΠΟΣΟ ΜΑΣ ΚΟΣΤΙΖΕΙ ΤΟ ΒΗΜΑ ΤΩΝ 200 ΜΕΤΡΩΝ — offline, χωρίς δίκτυο, χωρίς να αλλάξει τίποτα.
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΙ. Τα ΑΠΟΣΤΕΛΛΟΜΕΝΑ προφίλ (βήμα ακτίνας 200 μ.) με τα ίδια προφίλ ξαναχτισμένα με
 * βήμα **50 μ.** και μηδενική συγχώρεση στεριάς, ώστε η ΜΟΝΗ μεταβλητή να είναι το βήμα:
 *
 *   node scripts/buildGeospatialExposureProfiles.mjs --land-geojson <mask> --no-download \
 *     --ray-step-km 0.05 --land-grace-km 0 --output-dir .tmp/exposure-fine
 *   node scripts/auditRayStepAliasing.mjs
 *
 * ΓΙΑΤΙ ΕΧΕΙ ΣΗΜΑΣΙΑ. Μια ακτίνα δειγματοληπτεί κάθε 200 μ. Ακρωτήρι λεπτότερο από αυτό δεν
 * υπάρχει ποτέ — η ακτίνα το προσπερνάει και δηλώνει ανοιχτή θάλασσα ως το ταβάνι των 25 χλμ.
 * Μετρημένη περίπτωση: **Λυγαριά Ηρακλείου (#636)**, τομέας ΒΔ — αποθηκευμένο άνοιγμα **5,00 χλμ**,
 * πραγματικό **0,14 χλμ**. Σφάλμα **36×**, και είναι ο λόγος που κάθε δικλείδα «απόγειος = λάδι»
 * τη θεωρεί εκτεθειμένη ενώ η κάμερα δείχνει λάδι.
 *
 * Η ΚΑΤΕΥΘΥΝΣΗ ΤΟΥ ΣΦΑΛΜΑΤΟΣ ΕΙΝΑΙ ΤΟ ΚΥΡΙΟ ΕΥΡΗΜΑ. Το αλιασμένο βήμα μπορεί μόνο να ΧΑΣΕΙ
 * στεριά, ποτέ να εφεύρει — άρα δείχνει τις παραλίες πιο ΑΝΟΙΧΤΕΣ απ' ό,τι είναι. Διορθώνοντάς το
 * κινούμαστε προς «πιο προστατευμένες», δηλαδή προς την ΕΠΙΚΙΝΔΥΝΗ κατεύθυνση (σκανδάλη #1 της §9),
 * γι' αυτό αυτό το script μετράει και ΔΕΝ αλλάζει τίποτα. Οι αριθμοί του είναι η προϋπόθεση για να
 * συζητηθεί καν αλλαγή.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shippedDir = path.join(root, 'public/data/geospatial/exposure');
const fineDir = path.join(root, '.tmp/exposure-fine');
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const RANK = { protected: 0, partial: 1, exposed: 2 };

let files = 0;
let beaches = 0;
let sectorsCompared = 0;
let fetchShrank = 0;
let fetchGrew = 0;
let levelCalmer = 0;
let levelRougher = 0;
let beachesWithAnyLevelChange = new Set();
const worst = [];
/** Πόσοι τομείς περνάνε ΤΩΡΑ το κατώφλι «απόγειος = λάδι» για το άνοιγμα, και πόσοι θα περνούσαν. */
let flatEligibleBefore = 0;
let flatEligibleAfter = 0;

for (const file of readdirSync(shippedDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  let fine;
  try { fine = JSON.parse(readFileSync(path.join(fineDir, file), 'utf8')).profiles || {}; } catch { continue; }
  const shipped = JSON.parse(readFileSync(path.join(shippedDir, file), 'utf8')).profiles || {};
  files += 1;

  for (const id of Object.keys(shipped)) {
    const a = shipped[id];
    const b = fine[id];
    if (!b) continue;
    beaches += 1;

    for (const key of SECTORS) {
      const sa = a.sectors?.[key];
      const sb = b.sectors?.[key];
      if (!sa || !sb) continue;
      sectorsCompared += 1;

      if (sb.fetchKm < sa.fetchKm - 0.005) fetchShrank += 1;
      if (sb.fetchKm > sa.fetchKm + 0.005) fetchGrew += 1;
      if (sa.fetchKm <= 0.5) flatEligibleBefore += 1;
      if (sb.fetchKm <= 0.5) flatEligibleAfter += 1;

      const ra = RANK[sa.level];
      const rb = RANK[sb.level];
      if (rb < ra) { levelCalmer += 1; beachesWithAnyLevelChange.add(`${file}#${id}`); }
      if (rb > ra) { levelRougher += 1; beachesWithAnyLevelChange.add(`${file}#${id}`); }

      const delta = sa.fetchKm - sb.fetchKm;
      if (delta > 1) {
        worst.push({
          region: file.replace('.json', ''), id: Number(id),
          name: a.name?.gr || a.name?.en || id, sector: key,
          shippedKm: sa.fetchKm, fineKm: sb.fetchKm,
          shippedLevel: sa.level, fineLevel: sb.level,
          factor: sb.fetchKm > 0 ? Number((sa.fetchKm / sb.fetchKm).toFixed(1)) : Infinity,
        });
      }
    }
  }
}

if (beaches === 0) {
  console.error('ΑΚΥΡΟ: δεν βρέθηκε κανένα προφίλ στο .tmp/exposure-fine — τρέξε πρώτα τον builder.');
  process.exit(1);
}

worst.sort((x, y) => (y.shippedKm - y.fineKm) - (x.shippedKm - x.fineKm));

console.log(`αρχεία ${files} · παραλίες ${beaches} · τομείς ${sectorsCompared}`);
console.log('');
console.log('ΤΟ ΒΗΜΑ 200 μ. ΕΝΑΝΤΙ 50 μ. — ΤΙ ΑΛΛΑΖΕΙ ΣΤΗ ΓΕΩΜΕΤΡΙΑ');
console.log(`  τομείς με ΜΙΚΡΟΤΕΡΟ άνοιγμα στα 50 μ. (κρυμμένη στεριά)   ${fetchShrank}  (${(100 * fetchShrank / sectorsCompared).toFixed(1)}%)`);
console.log(`  τομείς με ΜΕΓΑΛΥΤΕΡΟ άνοιγμα (θόρυβος, πρέπει να είναι ~0) ${fetchGrew}`);
console.log(`  τομείς που γίνονται ΠΙΟ ΠΡΟΣΤΑΤΕΥΜΕΝΟΙ                     ${levelCalmer}`);
console.log(`  τομείς που γίνονται ΠΙΟ ΕΚΤΕΘΕΙΜΕΝΟΙ                       ${levelRougher}`);
console.log(`  παραλίες που αλλάζουν έστω έναν τομέα βαθμίδας            ${beachesWithAnyLevelChange.size}`);
console.log('');
console.log('ΠΟΣΟΙ ΤΟΜΕΙΣ ΠΕΡΝΑΝΕ ΤΟ ΚΑΤΩΦΛΙ ΑΝΟΙΓΜΑΤΟΣ ΤΟΥ «ΑΠΟΓΕΙΟΣ = ΛΑΔΙ» (≤0,5 χλμ)');
console.log(`  τώρα ${flatEligibleBefore}  →  με πυκνές ακτίνες ${flatEligibleAfter}   (+${flatEligibleAfter - flatEligibleBefore})`);
console.log('');
console.log(`ΟΙ 12 ΧΕΙΡΟΤΕΡΕΣ ΑΠΟ ${worst.length} ΠΕΡΙΠΤΩΣΕΙΣ ΜΕ ΔΙΑΦΟΡΑ >1 ΧΛΜ:`);
worst.slice(0, 12).forEach(w => console.log(
  `  #${String(w.id).padEnd(5)} ${String(w.name).slice(0, 22).padEnd(23)} ${w.sector.padEnd(3)} `
  + `${String(w.shippedKm).padStart(6)} → ${String(w.fineKm).padStart(5)} χλμ  ×${w.factor}  `
  + `${w.shippedLevel} → ${w.fineLevel}`
));

mkdirSync(path.join(root, 'reports/geometry'), { recursive: true });
writeFileSync(path.join(root, 'reports/geometry/ray-step-aliasing.json'), `${JSON.stringify({
  shippedRayStepKm: 0.2, fineRayStepKm: 0.05,
  files, beaches, sectorsCompared,
  fetchShrank, fetchGrew, levelCalmer, levelRougher,
  beachesWithAnyLevelChange: beachesWithAnyLevelChange.size,
  flatEligibleBefore, flatEligibleAfter,
  worst,
}, null, 2)}\n`, 'utf8');
console.log('\nγράφτηκε reports/geometry/ray-step-aliasing.json');
