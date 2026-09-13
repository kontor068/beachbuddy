#!/usr/bin/env node
/**
 * ΣΦΡΑΓΙΔΑ `seaWindCell` ΣΤΑ app + summary ΧΩΡΙΣ ΠΛΗΡΕΣ buildBeachRegionData (13/09/2026, θέμα 21).
 *
 * Το buildBeachRegionData.mjs γράφει τη σφραγίδα `seaWindCell` (ποιο κελί νερού απαντά για τον άνεμο της
 * παραλίας) από το data/forecast-sea-cells.generated.json σε κάθε παραλία του app ΚΑΙ του summary. Όμως σε
 * worktree χωρίς `.tmp/bake-local-wind` το πλήρες build σβήνει `shelteredFromLocalWind`/`localWindStatus` σε
 * 220 αρχεία (μνήμη 13/09). Όταν αλλάζει ΜΟΝΟ το κελί λίγων παραλιών (ledger εξαιρέσεων Δ9-Α), αρκεί αυτή η
 * σφραγίδα: διαβάζει τον ψημένο χάρτη και ξαναγράφει ΜΟΝΟ τις παραλίες όπου η τιμή διαφέρει, στην ίδια μορφή
 * αρχείου (μία γραμμή, όπως το build). Η πύλη Η3 του validateOverWaterWindLayer.mjs επαληθεύει το αποτέλεσμα.
 *
 *   node scripts/stampSeaWindCellSeal.mjs                 # οι περιοχές του ledger εξαιρέσεων
 *   node scripts/stampSeaWindCellSeal.mjs --regions a,b   # συγκεκριμένες περιοχές
 *   node scripts/stampSeaWindCellSeal.mjs --all           # όλες οι περιοχές
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAP_PATH = path.join(root, 'data/forecast-sea-cells.generated.json');
const LEDGER_PATH = path.join(root, 'data/sea-wind-cell-overrides.json');
const appDir = path.join(root, 'public/data/beaches/app');
const argVal = (name) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : null; };

const cells = JSON.parse(readFileSync(MAP_PATH, 'utf8')).cells || {};
let regions;
if (process.argv.includes('--all')) regions = readdirSync(appDir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, ''));
else if (argVal('--regions')) regions = argVal('--regions').split(',').map(s => s.trim()).filter(Boolean);
else {
  const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : {};
  regions = [...new Set((ledger.overrides || []).map(o => o.region))];
}
let changed = 0, filesTouched = 0;
for (const regionId of regions) {
  for (const tier of ['', 'summary']) {
    const file = path.join(appDir, tier, `${regionId}.json`);
    if (!existsSync(file)) { console.log(`  ⚠️ λείπει ${tier || 'app'}/${regionId}.json`); continue; }
    const raw = readFileSync(file, 'utf8');
    const payload = JSON.parse(raw);
    let n = 0;
    for (const beach of payload.island?.beaches || []) {
      const expected = cells[String(beach.id)];
      if (!expected || beach.seaWindCell === expected) continue;
      const label = typeof beach.name === 'string' ? beach.name : beach.name?.en ?? beach.name?.el ?? '';
      console.log(`  ${tier || 'app'}/${regionId} #${beach.id} ${label}: ${beach.seaWindCell ?? '—'} → ${expected}`);
      beach.seaWindCell = expected;
      n += 1;
    }
    if (!n) continue;
    const singleLine = !raw.trimEnd().includes('\n');
    writeFileSync(file, `${singleLine ? JSON.stringify(payload) : JSON.stringify(payload, null, 2)}\n`, 'utf8');
    changed += n; filesTouched += 1;
  }
}
console.log(`Σφραγίδα seaWindCell: ${changed} παραλίες σε ${filesTouched} αρχεία (${regions.length} περιοχές)`);
