/**
 * READ-ONLY adversarial audit of the cove wave guard (utils/coveWaveGuard.ts).
 * Reads the committed exposure profiles + reproduces SMB from utils/waveModel.ts (checkpoint-
 * asserted, no drift). Changes nothing. Run: node scripts/validation/guard-adversarial.mjs
 *
 * Keep this in sync with utils/coveWaveGuard.ts: if the guard thresholds (BLOCKED_MIN /
 * FETCH_MAX_KM / ONSHORE_MIN / FLOOR_M) are ever retuned, re-run this FIRST. It is the only thing
 * that stops a threshold change from being "tuned to a single number" — it re-proves the
 * denominators are non-vacuous, no long-fetch sector can false-calm, and shows the blast radius.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const exposureDir = path.join(root, 'public', 'data', 'geospatial', 'exposure');

// --- guard constants (must mirror utils/coveWaveGuard.ts) ---
const BLOCKED_MIN = 0.8;
const FETCH_MAX_KM = 2;      // shipped value (81967628)
const ONSHORE_MIN = 0.2;
const FLOOR_M = 0.10;
const REF_WIND_KMH = 44;     // 6 Bft representative (the floor is live-wind dependent; this is the yardstick)

// --- SMB reproduced verbatim from utils/waveModel.ts::estimateFetchLimitedWaveHeightM ---
const GRAVITY = 9.81, KMH_TO_MS = 1 / 3.6, KM_TO_M = 1000, MIN_WIND_MS = 0.5;
const smb = (windSpeedKmh, fetchKm) => {
  const windMs = Math.max(0, windSpeedKmh) * KMH_TO_MS;
  const fetchM = Math.max(0, fetchKm) * KM_TO_M;
  if (windMs < MIN_WIND_MS || fetchM <= 0) return 0;
  const dl = (GRAVITY * fetchM) / (windMs * windMs);
  const hs = 0.283 * ((windMs * windMs) / GRAVITY) * Math.tanh(0.0125 * Math.pow(dl, 0.42));
  return Number.isFinite(hs) && hs > 0 ? Number(hs.toFixed(2)) : 0;
};
// checkpoint against the value verified earlier from the shipped function
if (smb(44, 0.6) !== 0.25) { console.error(`FATAL: SMB drift — smb(44,0.6)=${smb(44, 0.6)} != 0.25`); process.exit(1); }

// --- load every intensity-bearing sector ---
const sectors = [];
let beachSet = new Set();
for (const f of readdirSync(exposureDir).sort()) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  const regionId = f.replace(/\.json$/, '');
  const payload = JSON.parse(readFileSync(path.join(exposureDir, f), 'utf8'));
  for (const p of Object.values(payload.profiles || {})) {
    const name = typeof p.name === 'string' ? p.name : (p.name?.en || p.name?.gr || '');
    beachSet.add(`${regionId}#${p.beachId}`);
    for (const [sec, s] of Object.entries(p.sectors || {})) {
      if (typeof s.onshore !== 'number' || typeof s.intensity !== 'number') continue;
      sectors.push({ regionId, beachId: p.beachId, name, sector: sec, fetchKm: s.fetchKm, blockedRayRatio: s.blockedRayRatio, onshore: s.onshore, level: s.level });
    }
  }
}

const overrides = (s, fetchMax = FETCH_MAX_KM) =>
  s.blockedRayRatio >= BLOCKED_MIN && s.fetchKm < fetchMax && s.onshore > ONSHORE_MIN && smb(REF_WIND_KMH, s.fetchKm) >= FLOOR_M;
const bk = s => `${s.regionId}#${s.beachId}`;
const vac = n => (n === 0 ? ' <-- VACUOUS' : '');

// ============ (1) DENOMINATORS FIRST ============
console.log('=========== (1) DENOMINATORS (funnel) ===========');
const totalBeaches = beachSet.size;
const totalSectors = sectors.length;
const passBlocked = sectors.filter(s => s.blockedRayRatio >= BLOCKED_MIN);
const passFetch = passBlocked.filter(s => s.fetchKm < FETCH_MAX_KM);
const passOnshore = passFetch.filter(s => s.onshore > ONSHORE_MIN);
const passFloor = passOnshore.filter(s => smb(REF_WIND_KMH, s.fetchKm) >= FLOOR_M);
console.log(`beaches scanned:                 ${totalBeaches}${vac(totalBeaches)}`);
console.log(`intensity sectors scanned:       ${totalSectors}${vac(totalSectors)}`);
console.log(`  blocked >= ${BLOCKED_MIN}:                 ${passBlocked.length}${vac(passBlocked.length)}`);
console.log(`  & fetch < ${FETCH_MAX_KM}km:                 ${passFetch.length}${vac(passFetch.length)}`);
console.log(`  & onshore > ${ONSHORE_MIN}:               ${passOnshore.length}${vac(passOnshore.length)}`);
console.log(`  & SMB@${REF_WIND_KMH} >= ${FLOOR_M}m (OVERRIDE):  ${passFloor.length}${vac(passFloor.length)}   <== the 1,096 set`);
console.log(`  distinct beaches overriding:   ${new Set(passFloor.map(bk)).size}`);
const OV = passFloor; // the override set

// ============ (2) REVERSE FALSE-CALM TEST ============
console.log('\n=========== (2) REVERSE: no override may have long fetch ===========');
const longFetch = sectors.filter(s => s.fetchKm > 10);
const longFetchOverriding = longFetch.filter(s => overrides(s));
const anyOverrideFetchGE2 = OV.filter(s => s.fetchKm >= FETCH_MAX_KM);
console.log(`sectors with fetch > 10km:                 ${longFetch.length}${vac(longFetch.length)}`);
console.log(`  of these that OVERRIDE (must be 0):       ${longFetchOverriding.length} ${longFetchOverriding.length === 0 ? '✓' : '✗ VIOLATION'}`);
console.log(`override sectors with fetch >= ${FETCH_MAX_KM}km (must be 0): ${anyOverrideFetchGE2.length} ${anyOverrideFetchGE2.length === 0 ? '✓' : '✗'}`);
console.log(`max fetch among overrides: ${Math.max(...OV.map(s => s.fetchKm)).toFixed(2)}km (must be < ${FETCH_MAX_KM})`);
if (longFetchOverriding.length) longFetchOverriding.slice(0, 30).forEach(s => console.log(`  VIOLATION ${s.regionId} #${s.beachId} ${s.name} @${s.sector}: fetch ${s.fetchKm} blocked ${s.blockedRayRatio} onshore ${s.onshore}`));

// ============ (3) DISTRIBUTION of the override set ============
console.log('\n=========== (3) DISTRIBUTION of the ' + OV.length + ' override sectors ===========');
const fh = { '0-0.5': 0, '0.5-1': 0, '1-1.5': 0, '1.5-2': 0 };
const oh = { '0.2-0.4': 0, '0.4-0.7': 0, '0.7-1': 0 };
for (const s of OV) {
  fh[s.fetchKm < 0.5 ? '0-0.5' : s.fetchKm < 1 ? '0.5-1' : s.fetchKm < 1.5 ? '1-1.5' : '1.5-2']++;
  oh[s.onshore < 0.4 ? '0.2-0.4' : s.onshore < 0.7 ? '0.4-0.7' : '0.7-1']++;
}
console.log('fetch km histogram:  ', JSON.stringify(fh));
console.log('onshore histogram:   ', JSON.stringify(oh));
console.log('\nTop-20 MOST SUSPICIOUS (highest fetch + lowest blocked = most channel-like):');
const suspicion = s => (s.fetchKm / FETCH_MAX_KM) + (1 - s.blockedRayRatio) / (1 - BLOCKED_MIN);
[...OV].sort((a, b) => suspicion(b) - suspicion(a)).slice(0, 20).forEach(s =>
  console.log(`  ${s.regionId} #${s.beachId} ${s.name} @${s.sector}: fetch ${s.fetchKm}km blocked ${s.blockedRayRatio} onshore ${s.onshore.toFixed(2)} SMB@44 ${smb(44, s.fetchKm)}m`));

// ============ (4) SENSITIVITY: fetch<3 and fetch<1.5 ============
console.log('\n=========== (4) SENSITIVITY (fetch threshold) ===========');
const ov3 = sectors.filter(s => overrides(s, 3));
const ov15 = sectors.filter(s => overrides(s, 1.5));
console.log(`fetch<1.5km overrides: ${ov15.length} sectors / ${new Set(ov15.map(bk)).size} beaches`);
console.log(`fetch<2km   overrides: ${OV.length} sectors / ${new Set(OV.map(bk)).size} beaches   (shipped)`);
console.log(`fetch<3km   overrides: ${ov3.length} sectors / ${new Set(ov3.map(bk)).size} beaches`);
const ov2beaches = new Set(OV.map(bk));
const newAt3 = ov3.filter(s => !ov2beaches.has(bk(s)) && s.fetchKm >= 2); // beaches entering ONLY via 2-3km fetch
const newAt3Beaches = [...new Map(newAt3.map(s => [bk(s), s])).values()];
console.log(`\nNEW beaches entering at fetch 2-3km (${newAt3Beaches.length}) — the riskier tier we excluded. Top-20 by fetch:`);
newAt3Beaches.sort((a, b) => b.fetchKm - a.fetchKm).slice(0, 20).forEach(s =>
  console.log(`  ${s.regionId} #${s.beachId} ${s.name} @${s.sector}: fetch ${s.fetchKm}km blocked ${s.blockedRayRatio} onshore ${s.onshore.toFixed(2)} SMB@44 ${smb(44, s.fetchKm)}m`));

// ============ (5) GROUND-TRUTH: which case fails, and was it failing before the guard? ============
console.log('\n=========== (5) GROUND TRUTH ===========');
let gtOut = '';
try { gtOut = execFileSync('node', ['scripts/validateWindExposureGroundTruth.mjs'], { cwd: root, encoding: 'utf8' }); }
catch (e) { gtOut = (e.stdout || '') + (e.stderr || ''); }
const gtSummary = (gtOut.match(/Ground-truth:.*$/m) || ['(summary line not found)'])[0];
const gtFails = gtOut.split('\n').filter(l => /@.*got .*expected/.test(l) || /^\s+- .*@/.test(l));
console.log(gtSummary);
gtFails.slice(0, 10).forEach(l => console.log('  ' + l.trim()));
// Did the guard touch anything the GT reads? The GT reads public/data/geospatial/exposure + the
// engine; the guard commits touch neither. Verify the exposure profiles are unchanged since the
// first guard commit (6903d979).
let diffStat = '';
try { diffStat = execFileSync('git', ['diff', '--stat', '6903d979', 'HEAD', '--', 'public/data/geospatial/exposure', 'utils/windExposureEngine.ts', 'utils/geospatialExposureModel.ts', 'utils/windExposure.ts'], { cwd: root, encoding: 'utf8' }); }
catch (e) { diffStat = 'git diff failed: ' + e.message; }
console.log(`\nGT-input files changed 6903d979..HEAD: ${diffStat.trim() ? '\n' + diffStat.trim() : 'NONE — GT inputs identical, so this failure is invariant to the guard (present at 6903d979 and before).'}`);
