// Accessibility (Seatrac) coverage audit.
//   node scripts/auditAccessibilityCoverage.mjs
// Reports how many beaches carry metadata.seatrac, status/confidence/region breakdowns, and
// flags safety/shape problems (the guard against accidental overstatement).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataPath = path.join(rootDir, 'public', 'greek_beaches.json');

const AMENITY_KEYS = ['disabledParking', 'boardwalkToWater', 'accessibleWc', 'changingRoom', 'shower', 'shade'];
const STATUS = new Set(['online', 'uninstalled', 'listed-unverified']);
const FEATURE_STATUS = new Set(['yes', 'seasonal', 'no', 'unknown']);
const CONFIDENCE = new Set(['high', 'medium', 'low']);
// Current season window — a record verified before this is "stale" for an online claim.
const SEASON_START = '2026-06-01';

function* iterBeaches(data) {
  for (const sub of Object.values(data)) {
    for (const subSub of Object.values(sub)) {
      for (const arr of Object.values(subSub)) {
        if (Array.isArray(arr)) for (const beach of arr) yield beach;
      }
    }
  }
}

const inc = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };

const main = () => {
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  let total = 0;
  let withSeatrac = 0;
  const byStatus = {};
  const byConfidence = {};
  const byRegion = {};
  let fullSetCount = 0;
  let onlineCount = 0;
  const issues = [];

  for (const beach of iterBeaches(data)) {
    total += 1;
    const s = beach.metadata?.seatrac;
    if (!s) continue;
    withSeatrac += 1;

    // --- shape validation ---
    const where = `#${beach.id} ${beach.name || ''}`;
    if (s.hasSeatrac !== true) issues.push(`${where}: seatrac present but hasSeatrac !== true`);
    if (!STATUS.has(s.status)) issues.push(`${where}: invalid status "${s.status}"`);
    if (!CONFIDENCE.has(s.confidence)) issues.push(`${where}: invalid confidence "${s.confidence}"`);
    if (typeof s.seasonal !== 'boolean') issues.push(`${where}: seasonal not boolean`);
    if (typeof s.needsVerification !== 'boolean') issues.push(`${where}: needsVerification not boolean`);
    if (!s.verifiedAt) issues.push(`${where}: missing verifiedAt`);
    if (!Array.isArray(s.sourceUrls) || s.sourceUrls.length === 0) issues.push(`${where}: missing sourceUrls`);
    if (!s.amenities) {
      issues.push(`${where}: missing amenities object`);
    } else {
      for (const k of AMENITY_KEYS) {
        if (!FEATURE_STATUS.has(s.amenities[k])) issues.push(`${where}: amenities.${k} invalid ("${s.amenities[k]}")`);
      }
    }

    // --- safety checks (overstatement guards) ---
    const computedFull = s.amenities && AMENITY_KEYS.every((k) => s.amenities[k] === 'yes' || s.amenities[k] === 'seasonal');
    if (s.fullSet !== Boolean(computedFull)) {
      issues.push(`${where}: fullSet=${s.fullSet} but amenities imply ${Boolean(computedFull)}`);
    }
    if (s.status === 'online' && s.needsVerification === false && (!s.verifiedAt || s.verifiedAt < SEASON_START)) {
      issues.push(`${where}: OVERSTATEMENT RISK — online + needsVerification cleared but verifiedAt "${s.verifiedAt}" is before season start ${SEASON_START}`);
    }
    if (s.status !== 'online' && s.fullSet === true) {
      issues.push(`${where}: fullSet=true but status is "${s.status}" (a non-active ramp should not read as fully accessible)`);
    }

    // --- tallies ---
    inc(byStatus, s.status);
    inc(byConfidence, s.confidence);
    inc(byRegion, s.region || 'unknown');
    if (s.fullSet) fullSetCount += 1;
    if (s.status === 'online') onlineCount += 1;
  }

  console.log('=== Accessibility (Seatrac) coverage ===');
  console.log(`Beaches total:          ${total}`);
  console.log(`With metadata.seatrac:  ${withSeatrac}`);
  console.log(`  online (filterable):  ${onlineCount}`);
  console.log(`  full accessible set:  ${fullSetCount}`);
  console.log(`Status breakdown:       ${JSON.stringify(byStatus)}`);
  console.log(`Confidence breakdown:   ${JSON.stringify(byConfidence)}`);
  console.log(`Region breakdown:       ${JSON.stringify(byRegion)}`);
  console.log('');
  if (issues.length === 0) {
    console.log('OK — no shape/safety issues found.');
  } else {
    console.log(`FOUND ${issues.length} issue(s):`);
    for (const i of issues) console.log('  - ' + i);
    process.exitCode = 1;
  }
};

main();
