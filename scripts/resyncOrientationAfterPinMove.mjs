#!/usr/bin/env node
/**
 * ΟΤΑΝ Η ΠΙΝΕΖΑ ΜΕΤΑΚΟΜΙΖΕΙ, Η ΚΑΤΕΥΘΥΝΣΗ ΜΕΝΕΙ ΠΙΣΩ
 *
 * ΤΟ ΚΕΝΟ. Το applyPinMoves.mjs διορθώνει συντεταγμένες. Ο ξαναϋπολογισμός της γεωμετρίας
 * δίνει νέο `facingDeg`. Αλλά το γραμμένο `metadata.orientation` δεν το πειράζει κανείς:
 * το applyIslandGroupOrientationFromGeospatial.mjs γράφει ΜΟΝΟ όταν λείπει το πεδίο, και το
 * realignOrientationWithGeospatial.mjs είναι σκόπιμα μονόδρομο — μόνο αποσύρει υποσχέσεις.
 * Άρα μια παραλία που μόλις μετακινήθηκε 4,7 χλμ κρατάει την κατεύθυνση του σημείου όπου
 * ΔΕΝ βρίσκεται. Μετρημένο στην Καστάνη (Σκόπελος, 17/08/2026): γραμμένο «Νότια» ενώ η
 * γεωμετρία στη σωστή θέση λέει 268,6° — δυτική ακτή, η κλασική παραλία ηλιοβασιλέματος
 * του νησιού, κομμένη από το φίλτρο «Ηλιοβασίλεμα» επειδή η πινέζα ήταν αλλού.
 *
 * ΓΙΑΤΙ ΕΠΙΤΡΕΠΕΤΑΙ ΕΔΩ ΝΑ ΓΡΑΨΟΥΜΕ ΠΡΟΣ ΤΑ ΠΑΝΩ. Το PORISMA §Σ4 λέει: όταν χειρόγραφο και
 * γεωμετρία διαφωνούν, δεν ανακηρύσσεται νικητής — αποσύρεται η δήλωση. Αυτό εδώ ΔΕΝ είναι
 * τέτοια διαφωνία. Το πεδίο που ξαναγράφεται δηλώνει το ίδιο, στο δικό του `notes`, ότι
 * παρήχθη από τη γεωμετρία· απλώς παρήχθη σε λάθος σημείο. Δεν κρίνουμε ποιος έχει δίκιο —
 * αντιγράφουμε ξανά την ίδια πηγή, τώρα που δείχνει τη σωστή ακτή.
 *
 * ΓΙ' ΑΥΤΟ ΚΑΙ Η ΠΥΛΗ: αγγίζει ΜΟΝΟ παραλίες που (α) τις ζήτησες ρητά με --ids, και (β) το
 * `notes` τους ομολογεί γεωμετρική προέλευση. Χειρόγραφη κατεύθυνση — κάποιος που πήγε και
 * είδε — δεν ξαναγράφεται ποτέ από εδώ· αναφέρεται και μένει ανθρώπινη απόφαση.
 *
 * Χρήση:  node scripts/resyncOrientationAfterPinMove.mjs --ids 2656            (dry run)
 *         node scripts/resyncOrientationAfterPinMove.mjs --ids 2656 --write
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const beachesPath = path.join(rootDir, 'public', 'greek_beaches.json');
const exposureDir = path.join(rootDir, 'public', 'data', 'geospatial', 'exposure');

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const write = process.argv.includes('--write');
const stamp = arg('--stamp', new Date().toISOString().slice(0, 10));
const ids = new Set(String(arg('--ids', '')).split(',').map((s) => Number(s.trim())).filter(Boolean));
if (!ids.size) {
  console.error('usage: --ids 2656[,2657] [--write] [--stamp YYYY-MM-DD]');
  process.exit(1);
}

// The sentence every geometry-generated orientation carries. Its presence is the
// permission slip; its absence means a human wrote this and we keep our hands off.
const GEOMETRY_MARKER = /geospatial exposure facingDeg/i;

const SECTORS = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];
const sectorFromDegrees = (deg) => SECTORS[Math.round((((deg % 360) + 360) % 360) / 45) % 8];

// Every profile in one map: a pin move can cross a region boundary, so looking the
// beach up by its old region would miss exactly the case this script exists for.
const profileById = new Map();
for (const file of fs.readdirSync(exposureDir)) {
  if (!file.endsWith('.json') || file === 'index.json') continue;
  let data;
  try { data = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')); } catch { continue; }
  for (const [id, profile] of Object.entries(data.profiles || {})) {
    if (ids.has(Number(id))) profileById.set(Number(id), profile);
  }
}

const source = JSON.parse(fs.readFileSync(beachesPath, 'utf8'));
const changed = [];
const skipped = [];

(function walk(node) {
  if (Array.isArray(node)) { for (const item of node) walk(item); return; }
  if (!node || typeof node !== 'object') return;
  const id = Number(node.id);
  if (ids.has(id) && node.metadata) {
    const profile = profileById.get(id);
    const current = node.metadata.orientation;
    if (!profile || !Number.isFinite(Number(profile.facingDeg))) {
      skipped.push({ id, name: node.name, reason: 'καμία γεωμετρία για αυτή την παραλία' });
    } else if (!current) {
      skipped.push({ id, name: node.name, reason: 'δεν έχει καθόλου γραμμένη κατεύθυνση — δουλειά του applyIslandGroupOrientationFromGeospatial' });
    } else if (!GEOMETRY_MARKER.test(String(current.notes || ''))) {
      skipped.push({ id, name: node.name, reason: 'χειρόγραφη κατεύθυνση — δεν ξαναγράφεται αυτόματα' });
    } else {
      const degrees = Math.round(((Number(profile.facingDeg) % 360) + 360) % 360 * 10) / 10;
      const faces = sectorFromDegrees(degrees);
      const before = { degrees: current.degrees, faces: current.faces };
      if (Math.abs(degrees - Number(current.degrees)) < 0.05 && current.faces?.[0] === faces) {
        skipped.push({ id, name: node.name, reason: 'ήδη συμφωνεί με τη γεωμετρία' });
      } else {
        node.metadata.orientation = {
          ...current,
          degrees,
          faces: [faces],
          notes: 'Generated from Natural Earth geospatial exposure facingDeg. This records shoreline-facing direction only; it does not verify shelter, low-wave behavior, or live sea conditions. '
            + `Ξαναϋπολογίστηκε (${stamp}) αφού διορθώθηκε η πινέζα: η προηγούμενη τιμή (${before.degrees}°, ${before.faces?.join('/')}) περιέγραφε το παλιό, λάθος σημείο.`,
        };
        changed.push({ id, name: node.name, from: before, to: { degrees, faces: [faces] } });
      }
    }
  }
  for (const value of Object.values(node)) if (value && typeof value === 'object') walk(value);
})(source);

if (write && changed.length) fs.writeFileSync(beachesPath, `${JSON.stringify(source, null, 2)}\n`, 'utf8');

console.log(`resyncOrientationAfterPinMove — ${write ? 'WRITE' : 'DRY-RUN'}`);
for (const c of changed) console.log(`  →#${c.id} ${c.name}: ${c.from.degrees}° ${c.from.faces?.join('/')} → ${c.to.degrees}° ${c.to.faces.join('/')}`);
for (const s of skipped) console.log(`  ·#${s.id} ${s.name}: ${s.reason}`);
console.log(`${changed.length} ενημερώθηκαν, ${skipped.length} έμειναν ως έχουν${write || !changed.length ? '' : ' — ξανατρέξε με --write'}`);
