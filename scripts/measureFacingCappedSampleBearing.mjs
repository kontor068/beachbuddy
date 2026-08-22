#!/usr/bin/env node
/**
 * ΤΙ ΑΛΛΑΖΕΙ ΑΝ ΜΙΑ ΠΑΡΑΛΙΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΡΩΤΑΕΙ ΓΙΑ ΝΕΡΟ ΠΙΣΩ ΑΠΟ ΤΗΝ ΠΛΑΤΗ ΤΗΣ.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟ ΠΡΟΚΑΛΕΣΕ (22/08/2026). scripts/buildMarineSamplePoints.resolveSampleBearing
 * κρατάει την κατεύθυνση που κοιτάει η παραλία ΜΟΝΟ αν ο τομέας της έχει ≥8 χλμ ανοιχτό νερό.
 * Αλλιώς πετάει το facing εντελώς και παίρνει τον πιο ανοιχτό τομέα — ΧΩΡΙΣ ΟΡΙΟ ΓΩΝΙΑΣ.
 * Δύο συνέπειες, και οι δύο μετρημένες:
 *
 *   - 14 παραλίες ρωτούν για νερό >90° μακριά από αυτό που κοιτούν. Η χειρότερη, #1702 Κολώνα
 *     στην Άνδρο, κοιτάει 89,9° και ρωτάει στις 270° — τη θάλασσα της άλλης πλευράς.
 *   - Η επιλογή είναι ΔΙΑΚΡΙΤΗ (8 κουτάκια) πάνω σε συνεχές μέγεθος, οπότε δύο γειτονικές
 *     παραλίες με σχεδόν ίδιο άνοιγμα πέφτουν σε διαφορετικά κουτάκια. Κέρκυρα, 22/08:
 *     Βουβαλομάντρια #3078 (ΒΑ fetch 7,84) ρωτά 0°, Βραχλή #3079 (ΒΑ fetch 7,92) ρωτά 45°,
 *     200 μ. απόσταση, ίδιο πρόσωπο. Τύπωσαν 0,56 μ./«πρόσεχε» και 0,17 μ./«καλή».
 *
 * Η ΠΡΟΤΑΣΗ ΠΟΥ ΜΕΤΡΙΕΤΑΙ ΕΔΩ: ο εναλλακτικός τομέας δεν επιτρέπεται να απέχει πάνω από
 * MAX_DIVERSION_DEG από το facing. Αν κανένας τομέας μέσα σε αυτό το παράθυρο δεν έχει αρκετό
 * άνοιγμα, η παραλία ΔΕΝ παίρνει δικό της σημείο και διαβάζει το σημείο της περιοχής — ο ίδιος
 * τίμιος fallback που ήδη ισχύει για όσες δεν έχουν γεωμετρία.
 *
 * ΔΕΝ ΓΡΑΦΕΙ ΣΕ ΔΕΔΟΜΕΝΑ. Μετράει και μόνο.
 *
 *   node scripts/measureFacingCappedSampleBearing.mjs [--cap 90]
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (m, f) => {
  m._compile(ts.transpileModule(readFileSync(f, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: f,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), f);
};
const { fetchMarineForecastDataBatch, forecastPointKey } = require(path.join(root, 'services/weatherService.ts'));

const arg = (name, fb) => { const i = process.argv.indexOf(name); return i === -1 ? fb : process.argv[i + 1]; };
const MAX_DIVERSION_DEG = Number(arg('--cap', '90'));
/**
 * Ο ΔΕΥΤΕΡΟΣ ΚΑΝΟΝΑΣ, ΚΑΙ ΓΙΑΤΙ ΧΡΕΙΑΖΕΤΑΙ ΞΕΧΩΡΙΣΤΑ ΑΠΟ ΤΟΝ ΦΡΑΓΜΟ.
 *
 * Ο φραγμός πιάνει μόνο τις εκτροπές πάνω από 90°. Το ζευγάρι της Κέρκυρας που ξεκίνησε όλο
 * αυτό δεν το πιάνει: Τζουφάκα #3081 και Άκολη #3099 κοιτούν ΚΑΙ ΟΙ ΔΥΟ 54,2°, και οι δύο
 * εκτρέπονται μέσα στο παράθυρο (0° και 45°) — και τυπώνουν 0,5 μ. και 0,02 μ. Αιτία: το
 * κατώφλι των 8 χλμ είναι ΓΚΡΕΜΟΣ. Ο τομέας του facing είχε 7,76 χλμ στη μία και 7,24 στην
 * άλλη, δηλαδή και οι δύο «απέτυχαν», και μετά ο νικητής βγήκε από διακριτή σύγκριση 8
 * κουτιών: 11,8 έναντι 7,76 στη μία, 7,24 έναντι 6,84 στην άλλη. Δύο σχεδόν ίσοι αριθμοί,
 * δύο εντελώς διαφορετικές γωνίες.
 *
 * Ο κανόνας εδώ είναι συνεχής: κράτα την κατεύθυνση της παραλίας όταν το άνοιγμά της είναι
 * αξιοπρεπές ΣΕ ΣΧΕΣΗ με το πιο ανοιχτό — όχι όταν περνάει ένα σταθερό νούμερο.
 */
const FACING_FETCH_RATIO = Number(arg('--ratio', '0'));

// Τα ίδια νούμερα με το buildMarineSamplePoints — αν αλλάξουν εκεί, αλλάζουν κι εδώ.
const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SECTOR_BEARING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const PUSH_FRACTION = 0.5, MAX_PUSH_KM = 10, MIN_PUSH_KM = 2;
const MIN_SECTOR_FETCH_KM = MIN_PUSH_KM / PUSH_FRACTION;
const PREFER_FACING_FETCH_KM = (2 * MIN_PUSH_KM) / PUSH_FRACTION;

const toRad = d => (d * Math.PI) / 180, toDeg = r => (r * 180) / Math.PI, EARTH = 6371;
const angDiff = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const destinationPoint = (lat, lon, brgDeg, km) => {
  const d = km / EARTH, brg = toRad(brgDeg), la = toRad(lat), lo = toRad(lon);
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(brg));
  const lo2 = lo + Math.atan2(Math.sin(brg) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: Number(toDeg(la2).toFixed(4)), lon: Number((((toDeg(lo2) + 540) % 360) - 180).toFixed(4)) };
};

/** Η ΣΗΜΕΡΙΝΗ επιλογή, αντιγραμμένη ώστε το «πριν» να είναι υπολογισμένο και όχι υποτιθέμενο. */
const bearingNow = profile => {
  const open = SECTORS.map(s => ({ s, f: profile.sectors?.[s]?.fetchKm })).filter(x => Number.isFinite(x.f));
  if (!open.length) return null;
  const widest = open.reduce((b, x) => (x.f > b.f ? x : b));
  if (widest.f < MIN_SECTOR_FETCH_KM) return null;
  const facing = profile.facingDeg;
  if (Number.isFinite(facing)) {
    const fsec = SECTORS[((Math.round(facing / 45) % 8) + 8) % 8];
    const atF = profile.sectors?.[fsec];
    if (atF && Number.isFinite(atF.fetchKm) && atF.fetchKm >= PREFER_FACING_FETCH_KM) {
      return { bearingDeg: facing, fetchKm: atF.fetchKm, via: 'facing' };
    }
  }
  return { bearingDeg: SECTOR_BEARING[widest.s], fetchKm: widest.f, via: 'widest-sector' };
};

/** Η ΠΡΟΤΑΣΗ: ίδια, αλλά ο εναλλακτικός τομέας περιορίζεται σε ±MAX_DIVERSION_DEG από το facing. */
const bearingCapped = profile => {
  const facing = profile.facingDeg;
  if (!Number.isFinite(facing)) return bearingNow(profile);
  const fsec = SECTORS[((Math.round(facing / 45) % 8) + 8) % 8];
  const atF = profile.sectors?.[fsec];
  if (atF && Number.isFinite(atF.fetchKm) && atF.fetchKm >= PREFER_FACING_FETCH_KM) {
    return { bearingDeg: facing, fetchKm: atF.fetchKm, via: 'facing' };
  }
  if (FACING_FETCH_RATIO > 0 && atF && Number.isFinite(atF.fetchKm) && atF.fetchKm >= MIN_SECTOR_FETCH_KM) {
    const openAll = SECTORS.map(s => profile.sectors?.[s]?.fetchKm).filter(v => Number.isFinite(v));
    const widestAll = openAll.length ? Math.max(...openAll) : 0;
    if (widestAll > 0 && atF.fetchKm >= FACING_FETCH_RATIO * widestAll) {
      return { bearingDeg: facing, fetchKm: atF.fetchKm, via: 'facing-relative' };
    }
  }
  const near = SECTORS
    .map(s => ({ s, f: profile.sectors?.[s]?.fetchKm }))
    .filter(x => Number.isFinite(x.f) && angDiff(facing, SECTOR_BEARING[x.s]) <= MAX_DIVERSION_DEG);
  if (!near.length) return null;
  const widest = near.reduce((b, x) => (x.f > b.f ? x : b));
  if (widest.f < MIN_SECTOR_FETCH_KM) return null;
  return { bearingDeg: SECTOR_BEARING[widest.s], fetchKm: widest.f, via: 'widest-near-facing' };
};

const toPoint = (profile, bearing) => {
  if (!bearing) return null;
  const c = profile.coordinates;
  if (!c || !Number.isFinite(c.lat) || !Number.isFinite(c.lon)) return null;
  const pushKm = Math.min(MAX_PUSH_KM, bearing.fetchKm * PUSH_FRACTION);
  if (pushKm < MIN_PUSH_KM) return null;
  return {
    ...destinationPoint(c.lat, c.lon, bearing.bearingDeg, pushKm),
    bearingDeg: bearing.bearingDeg, distanceKm: Number(pushKm.toFixed(2)), via: bearing.via,
  };
};

const dir = path.join(root, 'public/data/geospatial/exposure');
const changed = [];
let examined = 0, sameBearing = 0, lostPoint = 0;
for (const file of readdirSync(dir)) {
  if (!file.endsWith('.json')) continue;
  const d = JSON.parse(readFileSync(path.join(dir, file), 'utf8'));
  for (const [id, p] of Object.entries(d.profiles || {})) {
    if (!p.sectors || !p.coordinates) continue;
    examined += 1;
    const before = toPoint(p, bearingNow(p));
    const after = toPoint(p, bearingCapped(p));
    if (!before && !after) continue;
    if (before && after && Math.abs(before.bearingDeg - after.bearingDeg) < 0.05) { sameBearing += 1; continue; }
    if (before && !after) lostPoint += 1;
    changed.push({
      id: Number(id), name: p.name?.gr || p.name?.en, region: file.replace('.json', ''),
      facing: p.facingDeg, before, after,
      diversionBefore: before ? Number(angDiff(p.facingDeg, before.bearingDeg).toFixed(0)) : null,
      diversionAfter: after ? Number(angDiff(p.facingDeg, after.bearingDeg).toFixed(0)) : null,
    });
  }
}
console.log(`\nφραγμός ±${MAX_DIVERSION_DEG}° · παραλίες που εξετάστηκαν: ${examined}`);
console.log(`  αμετάβλητες: ${sameBearing}`);
console.log(`  αλλάζουν σημείο: ${changed.length - lostPoint}`);
console.log(`  χάνουν το δικό τους σημείο (πέφτουν στο σημείο περιοχής): ${lostPoint}`);

const points = new Map();
for (const c of changed) for (const pt of [c.before, c.after]) if (pt) points.set(forecastPointKey(pt.lat, pt.lon), { lat: pt.lat, lon: pt.lon });
console.log(`  σημεία προς ερώτηση: ${points.size}`);

const fetched = await fetchMarineForecastDataBatch([...points.values()]);
const maxToday = key => {
  const rows = fetched.get(key)?.data ?? [];
  if (!rows.length) return null;
  const day = String(rows[0].dt_txt ?? '').slice(0, 10);
  const vals = rows
    .filter(r => {
      const txt = String(r.dt_txt ?? '');
      if (!txt.startsWith(day)) return false;
      const h = Number(txt.slice(11, 13));
      return h >= 8 && h <= 19;
    })
    .map(r => r.marine?.waveHeightM)
    .filter(v => Number.isFinite(v));
  return vals.length ? Math.max(...vals) : null;
};

let moved = 0;
for (const c of changed) {
  c.waveBefore = c.before ? maxToday(forecastPointKey(c.before.lat, c.before.lon)) : null;
  c.waveAfter = c.after ? maxToday(forecastPointKey(c.after.lat, c.after.lon)) : null;
  if (Number.isFinite(c.waveBefore) && Number.isFinite(c.waveAfter)) {
    c.waveDelta = Number((c.waveAfter - c.waveBefore).toFixed(2));
    if (Math.abs(c.waveDelta) >= 0.1) moved += 1;
  }
}
console.log(`  με αλλαγή ύψους ≥0,10 μ. σήμερα: ${moved}`);
changed.sort((a, b) => Math.abs(b.waveDelta ?? 0) - Math.abs(a.waveDelta ?? 0));
for (const c of changed.slice(0, 20)) {
  console.log(`  #${c.id} ${c.name} [${c.region}] κοιτά ${c.facing}° · εκτροπή ${c.diversionBefore}° -> ${c.diversionAfter ?? 'χωρίς σημείο'}`
    + ` · κύμα ${c.waveBefore ?? '-'} -> ${c.waveAfter ?? 'σημείο περιοχής'}`);
}
writeFileSync(path.join(root, 'reports/weather/facing-capped-sample-bearing.json'),
  JSON.stringify({ measuredAt: new Date().toISOString(), cap: MAX_DIVERSION_DEG, examined, sameBearing, changed: changed.length, lostPoint, moved, results: changed }, null, 1));
console.log('\nΑναφορά: reports/weather/facing-capped-sample-bearing.json');
