// R1 swell validation (v3 roadmap 2d-4 + Mod 2). Replicates the NEW geometric direct-swell rule
// against the marine API over recent past days, for:
//   - 3 Ionian SW-facing targets that SHOULD flag on a SW swell
//   - 3 east-facing Aegean controls that should NOT
//   - 2 named closed-bay negative controls (Mod 2): legacy bucket would charge them, geometry must not
// Read-only. Picks, per beach, the past hour with the largest swell and reports the geometric verdict.
import { readFileSync } from 'node:fs';

const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const profile = (reg, id) => {
  try { return JSON.parse(readFileSync(`public/data/geospatial/exposure/${reg}.json`, 'utf8')).profiles?.[id]; }
  catch { return null; }
};
const appCoord = (reg, id) => {
  try { const b = JSON.parse(readFileSync(`public/data/beaches/app/${reg}.json`, 'utf8')).island.beaches.find(x => x.id === id); return b ? { name: b.name.en, lat: b.coordinates.lat, lon: b.coordinates.lon } : null; }
  catch { return null; }
};

// NEW geometric direct-swell rule (mirror of recommendationService R1 logic).
const geometricDirectSwell = (p, swellDir, swellHeightM) => {
  if (!(swellHeightM >= 0.5) || p?.facingDeg == null) return { flag: false, reason: 'no swell input or no facing' };
  const swellOnshore = Math.cos((swellDir - p.facingDeg) * Math.PI / 180);
  const nearest = SECTORS[(((Math.round(swellDir / 45) % 8) + 8) % 8)];
  const blocked = p.sectors?.[nearest]?.blockedRayRatio ?? 1;
  const sectorOpen = blocked < 0.6;
  return {
    flag: swellOnshore > 0.3 && sectorOpen,
    swellOnshore: swellOnshore.toFixed(2), nearest, blocked: blocked.toFixed(2), sectorOpen,
  };
};
// LEGACY rule (exact mirror of utils/windExposure.ts calculateWindExposure): exposed iff the
// angular diff between orientation (facing) and swellDir is < 45 deg. This is the rule the new
// geometric path replaces; shown so the closed-bay controls visibly diverge.
const legacyWouldFlag = (p, swellDir, swellHeightM) => {
  if (!(swellHeightM >= 0.5) || p?.facingDeg == null) return false;
  let diff = Math.abs(p.facingDeg - swellDir);
  if (diff > 180) diff = 360 - diff;
  return diff < 45; // exposed bucket
};

const targets = [
  ['ionian-islands-kefalonia', 1113, 'Myrtos', 'Ionian target'],
  ['ionian-islands-lefkada', 1171, 'Porto Katsiki', 'Ionian target'],
  ['ionian-islands-lefkada', 1159, 'Egkremni', 'Ionian target'],
  ['south-aegean-naxos', 2013, 'Pyrgaki', 'E/S control'],
  ['south-aegean-milos', 1915, 'Palaiochori', 'S-facing control'],
  ['attica-east-attica-mainland', 36, 'Plaz Rafinas', 'E-facing control'],
  // Mod 2 closed-bay controls: authored facing points SW (legacy bucket FLAGS on a SW swell)
  // but the SW sector is geometrically blocked by the Saronic gulf, so the geometric rule must NOT.
  ['attica-athens-area-mainland', 20, 'Limni Vouliagmenis', 'CLOSED-BAY control (Mod2)'],
  ['attica-aegina', 83, 'Avra Aegina', 'CLOSED-BAY control (Mod2)'],
];

const fetchMarine = async (lat, lon) => {
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=swell_wave_height,swell_wave_direction,swell_wave_period&timezone=auto&past_days=7&forecast_days=1&cell_selection=sea`;
  const res = await fetch(url, { headers: { 'User-Agent': 'CalmBeachSwellValidation/0.1 (calmbeach.gr)' } });
  if (!res.ok) return null;
  const d = await res.json();
  const h = d.hourly; if (!h?.time) return null;
  let best = { h: -1, dir: null, per: null };
  for (let i = 0; i < h.time.length; i++) {
    const hh = h.swell_wave_height?.[i];
    if (typeof hh === 'number' && hh > best.h) best = { h: hh, dir: h.swell_wave_direction?.[i], per: h.swell_wave_period?.[i], t: h.time[i] };
  }
  return best.h > 0 ? best : null;
};

// Mod 2 deterministic demonstration: a fixed SW swell (240 deg, 1.0 m) isolates the rule
// difference from whatever direction the live API happens to deliver. This is the canonical
// closed-bay case the legacy bucket gets wrong.
console.log('=== Mod 2 DETERMINISTIC closed-bay controls (synthetic SW swell 240deg, 1.0 m) ===');
console.log('   These bays’ authored facing points SW (legacy bucket FLAGS) but the SW sector is');
console.log('   blocked by the enclosing Saronic gulf, so the geometric rule must NOT charge them.\n');
for (const [reg, id, name] of [['attica-athens-area-mainland', 20, 'Limni Vouliagmenis'], ['attica-aegina', 83, 'Avra Aegina'], ['attica-aegina', 92, 'Paralia Sarpa']]) {
  const p = profile(reg, id); if (!p) { console.log(`#${id} ${name}: NO PROFILE`); continue; }
  const g = geometricDirectSwell(p, 240, 1.0);
  const legacy = legacyWouldFlag(p, 240, 1.0);
  console.log(`#${id} ${name.padEnd(20)} facing=${Math.round(p.facingDeg)}deg | onshore=${g.swellOnshore} nearestSector=${g.nearest} blocked=${g.blocked}`);
  console.log(`   => GEOMETRIC = ${g.flag ? 'FLAG' : 'no-flag'}   LEGACY bucket = ${legacy ? 'FLAG' : 'no-flag'}   ${legacy && !g.flag ? '<-- DIVERGENCE: legacy over-charges, geometry correctly clears (mouth faces inner gulf, not open SW sea)' : ''}\n`);
}

console.log('=== LIVE marine API (max swell over past 7 days) ===\n');
for (const [reg, id, name, role] of targets) {
  const p = profile(reg, id); const a = appCoord(reg, id);
  if (!p || !a) { console.log(`#${id} ${name}: NO DATA`); continue; }
  const m = await fetchMarine(a.lat, a.lon);
  if (!m) { console.log(`#${id} ${name} [${role}]: no swell in window`); continue; }
  const g = geometricDirectSwell(p, m.dir, m.h);
  const legacy = legacyWouldFlag(p, m.dir, m.h);
  const facing = Math.round(p.facingDeg);
  console.log(`#${id} ${name.padEnd(14)} [${role}]`);
  console.log(`   facing=${facing}deg | swell ${m.h.toFixed(1)}m @${Math.round(m.dir)}deg (${m.t})`);
  console.log(`   onshore=${g.swellOnshore} nearestSector=${g.nearest} blocked=${g.blocked} open=${g.sectorOpen}`);
  console.log(`   => GEOMETRIC directSwell = ${g.flag ? 'FLAG' : 'no-flag'}   (legacy bucket would: ${legacy ? 'FLAG' : 'no-flag'})\n`);
}
