#!/usr/bin/env node
/**
 * ΤΟ ΣΤΡΩΜΑ ΑΝΕΜΟΥ ΠΑΝΩ ΑΠΟ ΝΕΡΟ ΑΓΓΙΖΕΙ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΤΑΧΥΤΗΤΑ — ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ.
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ ΑΥΤΗ Η ΠΥΛΗ. Όταν σχεδιάστηκε το στρώμα (PORISMA §Γ37β) ελέγχθηκε ρητά αν
 * κάποια από τις υπάρχουσες πύλες μπορεί να το κρίνει. **Καμία δεν μπορεί.** Το
 * `validateWindExposureGroundTruth.mjs` δίνει το ίδιο τον τομέα σε κάθε περίπτωσή του, το
 * `validateCardVsPinExposure.mjs` φτιάχνει τον δικό του συνθετικό άνεμο, και η σουίτα σεναρίων
 * ολόκληρη «supplies its own wind». Μια αλλαγή στην ΠΗΓΗ του ανέμου είναι εξ ορισμού αόρατη σε
 * όλες τους.
 *
 * ΤΙ ΚΛΕΙΔΩΝΕΙ (ξαναγράφτηκε 25/08/2026, όταν μπήκε και η ΤΑΧΥΤΗΤΑ — §Γ51/§Γ52, απόφαση Μίλτου):
 *   Α. Η ΠΥΛΗ ΤΩΝ 3 ΧΛΜ ΕΙΝΑΙ ΣΤΑ ΔΕΔΟΜΕΝΑ. Καμία παραλία με στεριανό κελί κάτω από το όριο
 *      δεν έχει κελί θάλασσας, και καμία πάνω από το όριο δεν λείπει.
 *   Β. Η ΤΑΧΥΤΗΤΑ ΕΡΧΕΤΑΙ ΑΠΟ ΤΟ ΝΕΡΟ ΑΚΡΙΒΩΣ. Το `speed` γίνεται η τιμή του κελιού νερού
 *      όπως ήρθε (ήδη περασμένη από τη θαλάσσια πόρτα του δαπέδου στο parse), η στεριανή τιμή
 *      μένει στο `speedBeforeOverWater`, και `gust` + `speedBeforeGustFloor` βγαίνουν
 *      ΠΑΝΟΜΟΙΟΤΥΠΑ — η ριπή και ο ωμός στεριανός μέσος δεν είναι δουλειά αυτού του στρώματος.
 *   Γ. Η ΠΥΛΗ ΕΝΤΑΣΗΣ ΚΡΑΤΑΕΙ ΓΙΑ ΤΗ ΔΙΕΥΘΥΝΣΗ ΚΑΙ ΜΟΝΟ. Κάτω από τα 3 Μποφόρ (κρινόμενα στο
 *      νούμερο που θα τυπωθεί) η διεύθυνση δεν κουνιέται· η ταχύτητα ΚΟΥΝΙΕΤΑΙ, γιατί το §Γ52
 *      μέτρησε το μεγαλύτερο κέρδος ακριβώς εκεί που η στεριά λέει ≤2 Μποφόρ.
 *   Δ. Η ΗΜΕΡΗΣΙΑ ΤΙΜΗ ΔΕΝ ΑΠΟΣΥΝΔΕΕΤΑΙ ΑΠΟ ΤΗΝ ΩΡΑ ΤΗΣ. Ο άνεμος της ημέρας είναι πάντα ο
 *      άνεμος ενός ωριαίου στοιχείου της ίδιας πρόγνωσης — ποτέ μείγμα.
 *   Ε. ΑΥΤΟΣΑΜΠΟΤΑΖ: το στρώμα πρέπει να ΜΠΟΡΕΙ να αλλάξει και διεύθυνση και ταχύτητα, ο
 *      ελεγκτής έντασης πρέπει να ΜΠΟΡΕΙ να πει «όχι», και όταν το νερό λέει ό,τι και η στεριά
 *      επιστρέφεται ΤΟ ΙΔΙΟ αντικείμενο (τα memo της οθόνης κρίνουν με ===).
 *   ΣΤ. ΩΡΑ ΧΩΡΙΣ ΤΑΧΥΤΗΤΑ ΝΕΡΟΥ κρατά τη στεριανή ταχύτητα και παίρνει μόνο διεύθυνση —
 *      ποτέ κενό, ποτέ μηδέν.
 *   Ζ. ΤΟ SPREAD ΡΙΠΗΣ ΜΕΤΡΙΕΤΑΙ ΣΤΗ ΣΤΕΡΙΑ. Κάθε σημείο του recommendationService που
 *      υπολογίζει «ριπή μείον μέσο» πρέπει να πέφτει πίσω στο `speedBeforeOverWater` πριν από
 *      το `speed` — αλλιώς η θαλάσσια ταχύτητα (χωρίς δική της ριπή) θα έσβηνε ή θα φούσκωνε τις
 *      προειδοποιήσεις ριπής που βαθμονομήθηκαν στη στεριά. Έλεγχος κειμένου, όχι συμπεριφοράς:
 *      η συνάρτηση δεν εξάγεται.
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
  applyOverWaterWind,
  applyOverWaterWindToDays,
  anyHourReachesOverWaterMinimum,
  countOverWaterHours,
  countOverWaterSpeedHours,
  OVER_WATER_MIN_BEAUFORT,
} = require(path.join(root, 'utils/overWaterWind.ts'));
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));

const MAP_PATH = path.join(root, 'data/forecast-sea-cells.generated.json');
const appDir = path.join(root, 'public/data/beaches/app');
const failures = [];
const distKm = (aLat, aLon, bLat, bLon) => Math.hypot(
  (bLat - aLat) * 111.32,
  (bLon - aLon) * 111.32 * Math.cos((aLat * Math.PI) / 180),
);

console.log('Στρώμα ανέμου πάνω από νερό — διεύθυνση και ταχύτητα, μόνο πέρα από την πύλη\n');

// ── Α. Η πύλη των 3 χλμ ζει στα δεδομένα ─────────────────────────────────────
if (!fs.existsSync(MAP_PATH)) {
  // ΔΕΝ είναι αποτυχία. Χωρίς τον χάρτη καμία παραλία δεν φέρει κελί νερού και το στρώμα είναι
  // αδρανές — ακριβώς η συμπεριφορά που είχε το site πριν υπάρξει. Τα Β-Ζ ελέγχουν τη ΛΟΓΙΚΗ,
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
const sea = (deg, speedKmh) => (speedKmh === undefined ? { deg } : { deg, speed: MS(speedKmh) });

// ── Β. η ταχύτητα έρχεται από το νερό ακριβώς, και μόνο αυτή ─────────────────
const SPEEDS = [8, 12, 15, 20, 25, 30, 35, 45, 60];
const DIRS = [0, 45, 90, 135, 180, 225, 270, 315];
const SEA_FACTORS = [0.6, 1.0, 1.35];
const violations = [];
let degMoved = 0;
let speedMoved = 0;
let comparisons = 0;
for (const kmh of SPEEDS) {
  for (const factor of SEA_FACTORS) {
    for (const landDeg of DIRS) {
      for (const seaDeg of DIRS) {
        const items = [hour(12, kmh, landDeg)];
        const seaKmh = kmh * factor;
        const out = applyOverWaterWind(dayOf(items), { [items[0].dt_txt]: sea(seaDeg, seaKmh) });
        const before = items[0].wind;
        const after = out.hourly[0].wind;
        comparisons += 1;
        const tag = `${kmh}→${seaKmh.toFixed(1)} χλμ/ώ ${landDeg}°→${seaDeg}°`;
        if (Math.abs(after.speed - MS(seaKmh)) > 1e-12) violations.push(`ταχύτητα δεν είναι του νερού ${tag}`);
        if (factor !== 1.0 && after.speedBeforeOverWater !== before.speed) violations.push(`χάθηκε η στεριανή ταχύτητα ${tag}`);
        if (factor === 1.0 && 'speedBeforeOverWater' in after) violations.push(`provenance χωρίς αλλαγή ${tag}`);
        if (after.gust !== before.gust) violations.push(`ριπή ${tag}`);
        if (after.speedBeforeGustFloor !== before.speedBeforeGustFloor) violations.push(`ωμός στεριανός μέσος ${tag}`);
        const shownBft = getBeaufortLevel(after.speed * 3.6);
        const degShouldMove = shownBft >= OVER_WATER_MIN_BEAUFORT && seaDeg !== landDeg;
        if (degShouldMove && after.deg !== seaDeg) violations.push(`διεύθυνση ΔΕΝ γύρισε στα ${shownBft} Μπφ ${tag}`);
        if (!degShouldMove && after.deg !== landDeg) violations.push(`διεύθυνση γύρισε κάτω από την πύλη (${shownBft} Μπφ) ${tag}`);
        if (after.deg !== before.deg) degMoved += 1;
        if (after.speed !== before.speed) speedMoved += 1;
      }
    }
  }
}
console.log(`${violations.length === 0 ? 'OK  ' : 'FAIL'} Β. ταχύτητα από το νερό ακριβώς, ριπή/ωμός μέσος ανέγγιχτα: `
  + `${comparisons.toLocaleString('el-GR')} συνδυασμοί, ${violations.length} παραβιάσεις`);
for (const t of violations.slice(0, 5)) console.log(`       ${t}`);
if (violations.length) failures.push('Β');

// ── Γ. η πύλη έντασης: διεύθυνση όχι, ταχύτητα ναι ───────────────────────────
const calmSpeeds = [];
for (let kmh = 1; kmh <= 90; kmh += 1) {
  if (getBeaufortLevel(kmh) < OVER_WATER_MIN_BEAUFORT) calmSpeeds.push(kmh);
}
let degLeaked = 0;
let speedStuck = 0;
let degMovedWhenSeaLifts = 0;
for (const kmh of calmSpeeds) {
  // (α) το νερό λέει την ίδια ένταση, αντίθετη διεύθυνση → τίποτα δεν κουνιέται
  const same = [hour(12, kmh, 0)];
  const sameOut = applyOverWaterWind(dayOf(same), { [same[0].dt_txt]: sea(180, kmh) });
  if (sameOut !== dayOf(same) && countOverWaterHours(sameOut) > 0) degLeaked += 1;
  // (β) το νερό λέει ΑΛΛΗ ένταση, ακόμα ήρεμη → η ταχύτητα ΠΡΕΠΕΙ να αλλάξει, η διεύθυνση όχι
  const calmSea = Math.max(1, kmh - 2);
  const lift = [hour(12, kmh, 0)];
  const liftOut = applyOverWaterWind(dayOf(lift), { [lift[0].dt_txt]: sea(180, calmSea) });
  if (calmSea !== kmh && countOverWaterSpeedHours(liftOut) !== 1) speedStuck += 1;
  if (getBeaufortLevel(calmSea) < OVER_WATER_MIN_BEAUFORT && countOverWaterHours(liftOut) > 0) degLeaked += 1;
  // (γ) το νερό σηκώνει την ώρα ΠΑΝΩ από την πύλη → η διεύθυνση γυρίζει, γιατί αυτό τυπώνεται
  const windy = [hour(12, kmh, 0)];
  const windyOut = applyOverWaterWind(dayOf(windy), { [windy[0].dt_txt]: sea(180, 25) });
  if (countOverWaterHours(windyOut) === 1 && countOverWaterSpeedHours(windyOut) === 1) degMovedWhenSeaLifts += 1;
}
const gOk = degLeaked === 0 && speedStuck === 0 && degMovedWhenSeaLifts === calmSpeeds.length;
console.log(`${gOk ? 'OK  ' : 'FAIL'} Γ. κάτω από ${OVER_WATER_MIN_BEAUFORT} Μποφόρ: διεύθυνση ακίνητη (${degLeaked} διαρροές), `
  + `ταχύτητα κινείται (${speedStuck} κολλημένες), και όταν το νερό σηκώνει την ώρα πάνω από την πύλη η διεύθυνση γυρίζει (${degMovedWhenSeaLifts}/${calmSpeeds.length})`);
if (!gOk) failures.push('Γ');

// ── Δ. η ημερήσια τιμή μένει δεμένη με την ώρα της ───────────────────────────
// Μεικτή μέρα: κάποιες ώρες περνούν την πύλη διεύθυνσης, κάποιες όχι· η ταχύτητα αλλάζει παντού.
// Ο ημερήσιος άνεμος πρέπει να είναι ΠΑΝΤΑ ένα από τα ωριαία αντικείμενα του ΙΔΙΟΥ αποτελέσματος.
const mixed = [hour(9, 6, 10), hour(12, 30, 20), hour(15, 5, 30), hour(18, 40, 40)];
const mixedMap = Object.fromEntries(mixed.map(i => [i.dt_txt, sea(200, (i.wind.speed * 3.6) * 1.2)]));
const mixedOut = applyOverWaterWind(dayOf(mixed), mixedMap);
const dayWindIsAnHour = mixedOut.hourly.some(item => item.wind === mixedOut.wind);
const movedDeg = countOverWaterHours(mixedOut);
const movedSpeed = countOverWaterSpeedHours(mixedOut);
const expectedDeg = mixed.filter(i => getBeaufortLevel(i.wind.speed * 3.6 * 1.2) >= OVER_WATER_MIN_BEAUFORT).length;
const dOk = dayWindIsAnHour && movedDeg === expectedDeg && movedSpeed === mixed.length;
console.log(`${dOk ? 'OK  ' : 'FAIL'} Δ. η ημερήσια τιμή είναι ο άνεμος μιας ώρας της ίδιας πρόγνωσης: `
  + `διεύθυνση ${movedDeg}/${expectedDeg}, ταχύτητα ${movedSpeed}/${mixed.length}, ημερήσια δεμένη: ${dayWindIsAnHour ? 'ναι' : 'ΟΧΙ'}`);
if (!dOk) failures.push('Δ');

// ── Ε. αυτοσαμποτάζ ──────────────────────────────────────────────────────────
const canChange = degMoved > 0 && speedMoved > 0;
const gateSaysYes = anyHourReachesOverWaterMinimum(mixed);
const gateSaysNo = !anyHourReachesOverWaterMinimum([hour(12, 5, 0), hour(13, 6, 0)]);
const identityOnEmpty = (() => {
  const days = [dayOf([hour(12, 25, 0)])];
  return applyOverWaterWindToDays(days, {}) === days && applyOverWaterWindToDays(days, undefined) === days;
})();
const identityOnEqual = (() => {
  const items = [hour(12, 25, 90)];
  const day = dayOf(items);
  return applyOverWaterWind(day, { [items[0].dt_txt]: sea(90, 25) }) === day
    && applyOverWaterWindToDays([day], { [items[0].dt_txt]: sea(90, 25) }).length === 1;
})();
const daysIdentity = (() => {
  const days = [dayOf([hour(12, 5, 0)])];
  return applyOverWaterWindToDays(days, { '2026-08-20 12:00': sea(180, 5) }) === days;
})();
const eOk = canChange && gateSaysYes && gateSaysNo && identityOnEmpty && identityOnEqual && daysIdentity;
console.log(`${eOk ? 'OK  ' : 'FAIL'} Ε. το στρώμα ΜΠΟΡΕΙ να αλλάξει (${degMoved.toLocaleString('el-GR')} διευθύνσεις, ${speedMoved.toLocaleString('el-GR')} ταχύτητες), `
  + `ο ελεγκτής έντασης ΜΠΟΡΕΙ να πει όχι (ναι: ${gateSaysYes}, όχι: ${gateSaysNo}), ταυτότητα: κενό ${identityOnEmpty}, ίδιες τιμές ${identityOnEqual}, άπνοια ${daysIdentity}`);
if (!eOk) {
  if (!canChange) console.log('       Το στρώμα έγινε σιωπηλά no-op σε κάποιον από τους δύο άξονες');
  if (!gateSaysNo) console.log('       Ο ελεγκτής έντασης λέει ναι και στην άπνοια — η έκπτωση του ~30% των κλήσεων χάθηκε');
  if (!identityOnEmpty || !identityOnEqual || !daysIdentity) console.log('       Επιστρέφει νέο αντικείμενο ενώ τίποτα δεν άλλαξε — κάθε render θα ξαναβάφει τον χάρτη');
  failures.push('Ε');
}

// ── ΣΤ. ώρα χωρίς ταχύτητα νερού ─────────────────────────────────────────────
const noSpeed = [hour(12, 25, 0)];
const noSpeedOut = applyOverWaterWind(dayOf(noSpeed), { [noSpeed[0].dt_txt]: sea(180) });
const stOk = noSpeedOut.hourly[0].wind.speed === noSpeed[0].wind.speed
  && !('speedBeforeOverWater' in noSpeedOut.hourly[0].wind)
  && noSpeedOut.hourly[0].wind.deg === 180;
console.log(`${stOk ? 'OK  ' : 'FAIL'} ΣΤ. ώρα χωρίς ταχύτητα νερού: κρατά τη στεριανή ταχύτητα, παίρνει διεύθυνση`);
if (!stOk) failures.push('ΣΤ');

// ── Ζ. το spread ριπής μετριέται στη στεριά (έλεγχος κειμένου) ───────────────
const recSource = fs.readFileSync(path.join(root, 'services/recommendationService.ts'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const fallbackSites = (recSource.match(/speedBeforeGustFloor[\s\S]{0,260}?speedBeforeOverWater/g) || []).length;
const zOk = fallbackSites >= 3;
console.log(`${zOk ? 'OK  ' : 'FAIL'} Ζ. το spread ριπής πέφτει πίσω στη στεριανή ταχύτητα σε ${fallbackSites} σημεία του recommendationService (χρειάζονται ≥3)`);
if (!zOk) failures.push('Ζ');

if (failures.length) {
  console.error(`\nFAILED: ${failures.join(', ')}. Το στρώμα ανέμου πάνω από νερό δεν κάνει αυτό που λέει.`);
  process.exit(1);
}
console.log('\nΠΕΡΑΣΕ: διεύθυνση και ταχύτητα έρχονται από το νερό μόνο πέρα από την πύλη, και τίποτα άλλο δεν κουνήθηκε.');
