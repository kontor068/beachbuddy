/**
 * Region label scan (playbook step 4): flags user-facing fields that would
 * surface raw enums or missing data on the cards.
 *
 * Usage: node scripts/scanRegionLabels.mjs --region south-aegean-milos
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const parseArgValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const regionId = parseArgValue('--region');
if (!regionId) {
  console.error('Usage: node scripts/scanRegionLabels.mjs --region <regionId>');
  process.exit(1);
}

const payload = JSON.parse(readFileSync(path.join('public', 'data', 'beaches', 'app', `${regionId}.json`), 'utf8'));
const beaches = payload.island?.beaches || [];
let flagged = 0;

for (const beach of beaches) {
  const issues = [];
  if (beach.beachType === 'unknown') issues.push('beachType=unknown');
  for (const [key, value] of Object.entries(beach.staticLabels || {})) {
    if (value === 'unknown' || value === '') issues.push(`staticLabels.${key}='${value}'`);
  }
  const accessType = beach.metadata?.access?.type;
  if (!accessType || accessType === 'unknown') issues.push(`access.type=${accessType ?? 'missing'}`);
  if (!beach.waterDepth && !beach.metadata?.waterDepth?.type) issues.push('waterDepth missing');
  if (issues.length > 0) {
    flagged += 1;
    console.log(`#${beach.id} ${beach.name?.en}: ${issues.join('; ')}`);
  }
}

console.log(`\n${regionId}: ${beaches.length} beaches, ${flagged} with label gaps`);
console.log('Note: access.type "unknown" renders as the localized "Access not verified" label (clean), but is still a data gap worth closing.');
