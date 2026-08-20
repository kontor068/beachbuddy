#!/usr/bin/env node
/**
 * ΤΟ ΣΤΡΩΜΑ ΑΝΕΜΟΥ ΠΑΝΩ ΑΠΟ ΝΕΡΟ ΑΓΓΙΖΕΙ ΤΗ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΠΥΛΗ. Όταν σχεδιάστηκε το στρώμα (PORISMA §Γ37β) ελέγχθηκε ρητά αν
 * κάποια από τις υπάρχουσες πύλες μπορεί να το κρίνει. **Καμία δεν μπορεί.** Το
 * `validateWindExposureGroundTruth.mjs` δίνει το ίδιο τον τομέα σε κάθε περίπτωσή του, το
 * `validateCardVsPinExposure.mjs` φτιάχνει τον δικό του συνθετικό άνεμο, και η σουίτα σεναρίων
 * ολόκληρη «supplies its own wind» — αυτό ακριβώς προειδοποιεί το σχόλιο στο
 * `openMeteoProvider.ts` ως λόγο που το `cell_selection=sea` δεν μπήκε ποτέ στα δύο αιτήματα
 * πρόγνωσης. Μια αλλαγή στην ΠΗΓΗ της διεύθυνσης είναι εξ ορισμού αόρατη σε όλες τους.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ:
 *   Α. Η ΠΥΛΗ ΤΩΝ 3 ΧΛΜ ΕΙΝΑΙ ΣΤΑ ΔΕΔΟΜΕΝΑ. Καμία παραλία με στεριανό κελί κάτω από το όριο
 *      δεν έχει κελί θάλασσας, και καμία πάνω από το όριο δεν λείπει.
 *   Β. Η ΤΑΧΥΤΗΤΑ ΔΕΝ ΑΓΓΙΖΕΤΑΙ ΠΟΤΕ. Ταχύτητα, ριπή και `speedBeforeGustFloor` βγαίνουν
 *      πανομοιότυπα· μόνο το `deg` κουνιέται. Αυτό είναι ολόκληρο το εύρημα του §Γ29: η
 *      θάλασσα κερδίζει στη διεύθυνση και ΧΑΝΕΙ στην ταχύτητα κάτω από 3 χλμ.
 *   Γ. Η ΠΥΛΗ ΕΝΤΑΣΗΣ ΚΡΑΤΑΕΙ. Κάτω από τα 3 Μποφόρ δεν αλλάζει ούτε μία ώρα.
 *   Δ. Η ΗΜΕΡΗΣΙΑ ΤΙΜΗ ΔΕΝ ΑΠΟΣΥΝΔΕΕΤΑΙ ΑΠΟ ΤΗΝ ΩΡΑ ΤΗΣ. Ο άνεμος της ημέρας είναι πάντα ο
 *      άνεμος ενός ωριαίου στοιχείου της ίδιας πρόγνωσης — ποτέ μείγμα.
 *   Ε. ΑΥΤΟΣΑΜΠΟΤΑΖ: το στρώμα πρέπει να ΜΠΟΡΕΙ να αλλάξει κάτι, και ο ελεγκτής έντασης
 *      πρέπει να ΜΠΟΡΕΙ να πει «όχι». Αν κάποιος το κάνει σιωπηλά no-op, η πύλη θα έδειχνε
 *      πράσινη ενώ το στρώμα δεν κάνει τίποτα.
 *
 * ΚΑΜΙΑ ΚΛΗΣΗ ΔΙΚΤΥΟΥ.
 *
 *   node scripts/validateOverWaterWindLayer.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.React },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const {
  applyOverWaterWindDirection,
  applyOverWaterWindDirectionToDays,
  anyHourReachesOverWaterMinimum,
  countOverWaterHours,
  OVER_WATER_MIN_BEAUFORT,
} = require(path.join(root, 'utils/overWaterWind.ts'));

const MAP_PATH = path.join(root, 'data/forecast-sea-cells.generated.json');
const appDir = path.join(root, 'public/data/beaches/app');
const failures = [];
const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);

console.log('Στρώμα ανέμου πάνω από νερό — μόνο η διεύθυνση, μόνο πέρα από την πύλη\n');

// ── Α. Η πύλη των 3 χλμ ζει στα δεδομένα ─────────────────────────────────────
if (!fs.existsSync(MAP_PATH)) {
  // ΔΕΝ είναι αποτυχία. Χωρίς τον χάρτη καμία παραλία δεν φέρει κελί νερού και το στρώμα είναι
  // αδρανές — ακριβώς η συμπεριφορά που είχε το site πριν υπάρξει. Τα Β-Ε ελέγχουν τη ΛΟΓΙΚΗ,
  // που πρέπει να στέκει είτε έχει ψηθεί ο χάρτης είτε όχι.
  console.log(`ΠΑΡΑΛΕΙΨΗ Α. δεν υπάρχει ${path.relative(root, MAP_PATH)} — το στρώμα είναι αδρανές`);
  console.log('       (ψήσε το με `node scripts/bakeSeaWindCells.mjs` όταν θελήσεις να ανάψει)\n');
} else {
  const baked = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const gateKm = baked.gateKm;
  const cells = baked.cells || {};
  const belowGateInMap = [];
  const aboveGateMissing = [];
  let checked = 0;

  for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
    let payload;
    try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
    for (const beach of payload.island?.beaches || []) {
      const lat = beach.coordinates?.lat, lon = beach.coordinates?.lon;
      const landCell = beach.forecastCell;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !landCell) continue;
      const [cLat, cLon] = landCell.split('_').map(Number);
      const d = distKm(lat, lon, cLat, cLon);
      const inMap = Boolean(cells[String(beach.id)]);
      checked += 1;
      const name = beach.name?.gr || beach.name?.en || `#${beach.id}`;
      if (d < gateKm && inMap) belowGateInMap.push(`#${beach.id} ${name} (${d.toFixed(2)} χλμ)`);
      if (d >= gateKm && !inMap) aboveGateMissing.push(`#${beach.id} ${name} (${d.toFixed(2)} χλμ)`);
    }
  }

  const ok = !belowGateInMap.length && !aboveGateMissing.length;
  console.log(`${ok ? 'OK  ' : 'FAIL'} Α. η πύλη των ${gateKm} χλμ ζει στα δεδομένα: `
    + `${Object.keys(cells).length.toLocaleString('el-GR')} παραλίες σε ${baked.distinctCells} κελιά νερού, από ${checked.toLocaleString('el-GR')} ελεγμένες`);
  for (const b of belowGateInMap.slice(0, 5)) console.log(`       κάτω από την πύλη αλλά ΜΕΣΑ στον χάρτη: ${b}`);
  for (const b of aboveGateMissing.slice(0, 5)) console.log(`       πάνω από την πύλη αλλά ΛΕΙΠΕΙ: ${b}`);
  if (aboveGateMissing.length > 5) console.log(`       …και ${aboveGateMissing.length - 5} ακόμη — ο χάρτης είναι μπαγιάτικος, ξαναψήσ' τον`);
  if (!ok) failures.push('Α');
}

// ── Συνθετικές προγνώσεις, ίδιο σχήμα με του `processForecastData` ───────────
const MS = kmh => kmh / 3.6;
const hour = (h, kmh, deg, gustKmh) => ({
  dt: Date.UTC(2026, 7, 20, h) / 1000,
  dt_txt: `2026-08-20 ${String(h).padStart(2, '0')}:00`,
  wind: {
    speed: MS(kmh),
    deg,
    gust: MS(gustKmh ?? kmh * 1.4),
    ...(kmh > 20 ? { speedBeforeGustFloor: MS(kmh * 0.8) } : {}),
  },
  main: { temp: 28 }, weather: [{ id: 800, main: 'Clear', description: '', icon: '01d' }],
});
const dayOf = items => ({ date: new Date(2026, 7, 20), wind: items[Math.floor(items.length / 2)].wind, hourly: items, temp_max: 30, temp_min: 22 });

// ── Β. η ταχύτητα δεν αγγίζεται ποτέ ─────────────────────────────────────────
const SPEEDS = [8, 12, 15, 20, 25, 30, 35, 45, 60];
const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
const touched = [];
let degMoved = 0;
let comparisons = 0;
for (const kmh of SPEEDS) {
  for (const landDeg of DIRS) {
    for (const seaDeg of DIRS) {
      const items = [hour(12, kmh, landDeg)];
      const out = applyOverWaterWindDirection(dayOf(items), { [items[0].dt_txt]: seaDeg });
      const before = items[0].wind;
      const after = out.hourly[0].wind;
      comparisons += 1;
      if (after.speed !== before.speed) touched.push(`ταχύτητα ${kmh} χλμ/ώ ${landDeg}°→${seaDeg}°`);
      if (after.gust !== before.gust) touched.push(`ριπή ${kmh} χλμ/ώ ${landDeg}°→${seaDeg}°`);
      if (after.speedBeforeGustFloor !== before.speedBeforeGustFloor) touched.push(`πραγματικός μέσος ${kmh} χλμ/ώ`);
      if (after.deg !== before.deg) degMoved += 1;
    }
  }
}
console.log(`${touched.length === 0 ? 'OK  ' : 'FAIL'} Β. η ταχύτητα δεν αγγίζεται: ${comparisons.toLocaleString('el-GR')} συνδυασμοί, ${touched.length} παραβιάσεις`);
for (const t of touched.slice(0, 5)) console.log(`       άλλαξε ${t}`);
if (touched.length) failures.push('Β');

// ── Γ. η πύλη έντασης κρατάει ────────────────────────────────────────────────
// Κάτω από OVER_WATER_MIN_BEAUFORT δεν επιτρέπεται ούτε μία αλλαγή, όσο κι αν διαφωνούν τα
// δύο κελιά. Η κλίμακα Μποφόρ βγαίνει από τη ΔΙΚΗ ΜΑΣ getBeaufortLevel, όχι από πίνακα εδώ.
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const calmSpeeds = [];
for (let kmh = 1; kmh <= 90; kmh += 1) {
  if (getBeaufortLevel(kmh) < OVER_WATER_MIN_BEAUFORT) calmSpeeds.push(kmh);
}
let leaked = 0;
for (const kmh of calmSpeeds) {
  const items = [hour(12, kmh, 0)];
  const out = applyOverWaterWindDirection(dayOf(items), { [items[0].dt_txt]: 180 });
  if (out !== dayOf(items) && countOverWaterHours(out) > 0) leaked += 1;
}
console.log(`${leaked === 0 ? 'OK  ' : 'FAIL'} Γ. κάτω από ${OVER_WATER_MIN_BEAUFORT} Μποφόρ δεν αλλάζει τίποτα: `
  + `${calmSpeeds.length} ταχύτητες με αντίθετη διεύθυνση (180° διαφορά), ${leaked} διαρροές`);
if (leaked) failures.push('Γ');

// ── Δ. η ημερήσια τιμή μένει δεμένη με την ώρα της ───────────────────────────
// Μεικτή μέρα: κάποιες ώρες περνούν την πύλη, κάποιες όχι. Ο ημερήσιος άνεμος πρέπει να είναι
// ΠΑΝΤΑ ένα από τα ωριαία αντικείμενα του ΙΔΙΟΥ αποτελέσματος — αλλιώς η κάρτα και ο χάρτης
// διαβάζουν διαφορετική διεύθυνση για την ίδια στιγμή, το ακριβές λάθος που το §Γ27 κυνήγησε.
const mixed = [hour(9, 6, 10), hour(12, 30, 20), hour(15, 5, 30), hour(18, 40, 40)];
const mixedOut = applyOverWaterWindDirection(dayOf(mixed), Object.fromEntries(mixed.map(i => [i.dt_txt, 200])));
const dayWindIsAnHour = mixedOut.hourly.some(item => item.wind === mixedOut.wind);
const movedHours = countOverWaterHours(mixedOut);
const expectedMoved = mixed.filter(i => getBeaufortLevel(i.wind.speed * 3.6) >= OVER_WATER_MIN_BEAUFORT).length;
const dOk = dayWindIsAnHour && movedHours === expectedMoved;
console.log(`${dOk ? 'OK  ' : 'FAIL'} Δ. η ημερήσια τιμή είναι ο άνεμος μιας ώρας της ίδιας πρόγνωσης: `
  + `${movedHours}/${expectedMoved} ώρες διορθώθηκαν, ημερήσια δεμένη: ${dayWindIsAnHour ? 'ναι' : 'ΟΧΙ'}`);
if (!dOk) failures.push('Δ');

// ── Ε. αυτοσαμποτάζ ──────────────────────────────────────────────────────────
const canChange = degMoved > 0;
const gateSaysYes = anyHourReachesOverWaterMinimum(mixed);
const gateSaysNo = !anyHourReachesOverWaterMinimum([hour(12, 5, 0), hour(13, 6, 0)]);
const daysUnchanged = (() => {
  const days = [dayOf([hour(12, 5, 0)])];
  return applyOverWaterWindDirectionToDays(days, { '2026-08-20 12:00': 180 }) === days;
})();
const eOk = canChange && gateSaysYes && gateSaysNo && daysUnchanged;
console.log(`${eOk ? 'OK  ' : 'FAIL'} Ε. το στρώμα ΜΠΟΡΕΙ να αλλάξει (${degMoved.toLocaleString('el-GR')} διευθύνσεις) και ο ελεγκτής έντασης ΜΠΟΡΕΙ να πει όχι`
  + ` (ναι: ${gateSaysYes}, όχι: ${gateSaysNo}, ταυτότητα σε άπνοια: ${daysUnchanged})`);
if (!eOk) {
  if (!canChange) console.log('       Καμία διεύθυνση δεν κουνήθηκε σε 576 συνδυασμούς. Το στρώμα έγινε σιωπηλά no-op');
  if (!gateSaysNo) console.log('       Ο ελεγκτής έντασης λέει ναι και στην άπνοια — η έκπτωση του ~30% των κλήσεων χάθηκε');
  if (!daysUnchanged) console.log('       Επιστρέφει νέο πίνακα ενώ τίποτα δεν άλλαξε — κάθε render θα ξαναβάφει τον χάρτη');
  failures.push('Ε');
}

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(', ')}. Το στρώμα ανέμου πάνω από νερό δεν κάνει αυτό που λέει.`);
  process.exit(1);
}
console.log('\nΠΕΡΑΣΕ: η διεύθυνση έρχεται από το νερό μόνο πέρα από την πύλη, και τίποτα άλλο δεν κουνήθηκε.');
