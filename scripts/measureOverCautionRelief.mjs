#!/usr/bin/env node
/**
 * ΠΟΣΕΣ ΦΟΡΕΣ ΠΑΥΟΥΜΕ ΝΑ ΛΕΜΕ «ΜΗΝ ΚΟΛΥΜΠΗΣΕΙΣ» — ΕΘΝΙΚΑ, ΚΑΙ ΠΡΟΣ ΠΟΙΑ ΚΑΤΕΥΘΥΝΣΗ.
 *
 * ΑΦΟΡΜΗ. Ελαφονήσι, 22/08/2026: χρήστης στην παραλία λέει «λάδι», η σελίδα λέει «μην
 * κολυμπήσεις». Ο αριθμός διορθώθηκε (§Γ55/§Γ56, 0,9 → ~0,4 μ.) και η ετυμηγορία δεν κουνήθηκε.
 *
 * ΤΙ ΒΡΕΘΗΚΕ. Ο κανόνας που εμποδίζει το ΑΘΡΟΙΣΜΑ των ποινών να αρνηθεί μπάνιο (10/08/2026)
 * είχε ΤΟ ΙΔΙΟ ελάττωμα που το `swimmingComfortFromScore` καταγράφει από πάνω του ως «THE SHORE
 * BRANCH WAS DEAD ON ARRIVAL»: ρωτούσε το `effectiveWaveHeightM`, δηλαδή τη θάλασσα διάμεσα
 * 10 χλμ ανοιχτά, για να κρίνει αν «η θάλασσα είναι μικρή». Ο μοναδικός φρουρός απέναντι στην
 * υπερβολική αυστηρότητα ρωτούσε το νούμερο που ΠΡΟΚΑΛΕΙ την υπερβολική αυστηρότητα.
 *
 * ΤΙ ΣΥΓΚΡΙΝΕΙ — ΤΡΕΙΣ ΚΑΤΑΣΤΑΣΕΙΣ, ΜΕ ΤΟΝ ΙΔΙΟ ΚΩΔΙΚΑ:
 *   ΠΡΙΝ  — η συμπεριφορά της 10/08: ανοιχτή θάλασσα, ταβάνι < 4 Μποφόρ
 *   ΑΚΤΗ  — μόνο η διόρθωση του νερού (νερό στην ΑΚΤΗ, ταβάνι πάλι < 4 Μποφόρ)
 *   ΤΩΡΑ  — και το ταβάνι στα < 5 Μποφόρ, ΜΟΝΟ με μετρημένη απόδειξη ότι το νερό φεύγει
 *
 * ΠΩΣ, ΧΩΡΙΣ ΑΝΤΙΓΡΑΦΗ ΛΟΓΙΚΗΣ. Τρέχει ο ΠΡΑΓΜΑΤΙΚΟΣ `calculateBeachScore`. Το
 * `utils/overCautionRelief.relievesOverCaution` τυλίγεται με περιτύλιγμα που καλεί ΤΗΝ ΙΔΙΑ
 * συνάρτηση, αλλά ξαναγυρίζει τα ΟΡΙΣΜΑΤΑ στη σημασία της κάθε κατάστασης. Το κατώφλι, οι
 * εξαιρέσεις και η σειρά τους μένουν του προϊόντος· μόνο το «τι θεωρείται νερό εδώ» γυρίζει πίσω.
 *
 * ΤΙ ΜΕΤΡΑΕΙ — ΚΑΙ ΤΟ ΝΟΥΜΕΡΟ ΑΣΦΑΛΕΙΑΣ. Η αλλαγή αφαιρεί προειδοποιήσεις, άρα η ΜΟΝΗ ερώτηση
 * που έχει σημασία είναι «σε πόσες από αυτές το νερό ΣΤΗΝ ΑΚΤΗ ήταν στ' αλήθεια μεγάλο;».
 * Αναφέρονται ξεχωριστά: κατανομή νερού ακτής, ριπές, πόσες έχουν ≥5 Μποφόρ (καμία επιτρεπτή),
 * και πόσες στηρίζονται στη μετρημένη απόδειξη αντί στο νερό.
 *
 * REPORT-ONLY.  node scripts/measureOverCautionRelief.mjs [--days=2025-08-14] [--regions=a,b]
 */
import './lib/paidOpenMeteo.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const relief = require(path.join(root, 'utils/overCautionRelief.ts'));
const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { processForecastData, getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { fetchForecastDataBatch, fetchMarineForecastDataBatch, mergeMarineForecastData, forecastPointKey } =
  require(path.join(root, 'services/weatherService.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const SHIPPED = relief.relievesOverCaution;

/**
 * ΤΟ ΠΕΡΙΤΥΛΙΓΜΑ. `mode` ορίζεται από τον βρόχο πριν από κάθε κλήση του calculateBeachScore·
 * `openSeaM` γεμίζει από τον ίδιο βρόχο, γιατί η παλιά σημασία χρειάζεται ένα νούμερο που η
 * σημερινή υπογραφή δεν κουβαλάει πια. Μονονηματικό, μία παραλιο-ώρα τη φορά.
 */
let mode = 'now';
let openSeaM;
relief.relievesOverCaution = (input) => {
  if (mode === 'now') return SHIPPED(input);
  const rewound = { ...input, departingSea: false };
  if (mode === 'before' && typeof openSeaM === 'number') rewound.seaAtShoreM = openSeaM;
  return SHIPPED(rewound);
};

const arg = (name, dflt) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
};
const DAY = arg('days', '') || null;
const REGION_FILTER = arg('regions', '').split(',').map(s => s.trim()).filter(Boolean);
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7);

/**
 * Το αρχείο προγνώσεων, με ΜΕΤΑΚΙΝΗΣΗ των χρονοσφραγίδων πάνω στο σήμερα: ο κώδικας της
 * εφαρμογής συγκρίνει τις ώρες με το ρολόι, οπότε το ρολόι μένει αληθινό και τα ΔΕΔΟΜΕΝΑ
 * μετακινούνται (lib/replayOpenMeteo — το αντίστροφο σπάει το utils/athensTime).
 *
 * ⚠️ ΔΥΝΑΜΙΚΟ import, ΚΑΙ ΟΧΙ ΑΠΟ ΓΟΥΣΤΟ. Το lib/replayOpenMeteo διαβάζει το `OPEN_METEO_REPLAY`
 * ΜΙΑ ΦΟΡΑ, στη φόρτωσή του. Με στατικό import (που ανεβαίνει στην κορυφή) η μεταβλητή δεν έχει
 * οριστεί ακόμη, το module φορτώνει άδειο και το `enableReplayOpenMeteo` γυρίζει false ΣΙΩΠΗΛΑ:
 * το script τρέχει, κατεβάζει τη ΣΗΜΕΡΙΝΗ μέρα και τυπώνει αποτελέσματα που μοιάζουν έγκυρα.
 * Πιάστηκε 22/08/2026 μόνο επειδή δύο «διαφορετικά παράθυρα» έβγαλαν πανομοιότυπα νούμερα.
 * Ο έλεγχος από κάτω σκάει αντί να συνεχίσει.
 */
if (DAY) {
  process.env.OPEN_METEO_REPLAY = DAY;
  process.env.OPEN_METEO_REPLAY_SHIFT = '1';
  const { enableReplayOpenMeteo } = await import('./lib/replayOpenMeteo.mjs');
  if (!enableReplayOpenMeteo({ quiet: false })) {
    console.error(`Το αρχείο προγνώσεων ΔΕΝ ενεργοποιήθηκε για ${DAY} — θα μετρούσα τη σημερινή μέρα.`);
    process.exit(1);
  }
}

const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const files = fs.readdirSync(summaryDir).filter(f => f.endsWith('.json'))
  .filter(f => !REGION_FILTER.length || REGION_FILTER.some(r => f.startsWith(r)));

// ── όλα τα σημεία μαζί, μία παρτίδα ─────────────────────────────────────────────────────────
const work = [];
const windPoints = new Map();
const seaPoints = new Map();
for (const file of files) {
  const island = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island;
  const list = island?.beaches;
  if (!Array.isArray(list) || !list.length) continue;
  let profiles = {};
  try { profiles = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles || {}; } catch { /* none */ }
  for (const cluster of buildBeachForecastClusters(list)) {
    windPoints.set(forecastPointKey(cluster.lat, cluster.lon), { lat: cluster.lat, lon: cluster.lon });
    for (const id of cluster.beachIds) {
      const beach = list.find(b => b.id === id);
      if (!beach) continue;
      const profile = profiles[String(id)];
      const mp = profile?.marineSamplePoint;
      if (mp) seaPoints.set(forecastPointKey(mp.lat, mp.lon), { lat: mp.lat, lon: mp.lon });
      work.push({
        beach, profile, region: file.replace('.json', ''),
        windKey: forecastPointKey(cluster.lat, cluster.lon),
        seaKey: mp ? forecastPointKey(mp.lat, mp.lon) : null,
      });
    }
  }
}
console.log(`παραλίες: ${work.length} · σημεία ανέμου: ${windPoints.size} · σημεία θάλασσας: ${seaPoints.size}`
  + `${DAY ? ` · μέρα ${DAY}` : ' · ζωντανά'}`);

const windByPoint = await fetchForecastDataBatch([...windPoints.values()]);
console.log('  άνεμος OK');
const marineByPoint = await fetchMarineForecastDataBatch([...seaPoints.values()]);
console.log('  θάλασσα OK');

// ── η μέτρηση ────────────────────────────────────────────────────────────────────────────────
const VERDICTS = ['avoid_swimming', 'caution', 'good', 'excellent'];
const rows = [];
let scored = 0;
let done = 0;

for (const w of work) {
  const windData = windByPoint.get(w.windKey)?.data;
  if (!windData) { done += 1; continue; }
  const marine = w.seaKey ? (marineByPoint.get(w.seaKey)?.data ?? []) : [];
  const day = processForecastData(mergeMarineForecastData(windData, marine))[0];
  done += 1;
  if (done % 200 === 0) process.stdout.write(`\r  ${done}/${work.length} · διαφορές ${rows.length}   `);
  if (!day?.hourly) continue;

  for (const hour of HOURS) {
    const h = day.hourly[hour];
    if (!h) continue;
    const slice = { ...day, ...h, hourly: day.hourly };
    const opts = { weatherSource: 'beach-cluster', hourlyForecast: day.hourly, geospatialProfile: w.profile };
    scored += 1;

    // Το `openSeaM` πρέπει να είναι γνωστό ΠΡΙΝ την κλήση «before». Το παίρνουμε από την κλήση
    // «now», που δεν το χρειάζεται — ίδια δεδομένα, οπότε το effective ύψος είναι το ίδιο.
    mode = 'now'; openSeaM = undefined;
    const now = calculateBeachScore(w.beach, slice, undefined, undefined, opts);
    openSeaM = now.seaStateWaveM;
    mode = 'shore';
    const shoreOnly = calculateBeachScore(w.beach, slice, undefined, undefined, opts);
    mode = 'before';
    const before = calculateBeachScore(w.beach, slice, undefined, undefined, opts);

    if (before.swimmingComfort === now.swimmingComfort) continue;
    rows.push({
      id: w.beach.id, region: w.region,
      name: typeof w.beach.name === 'string' ? w.beach.name : (w.beach.name?.gr || ''),
      hour,
      before: before.swimmingComfort, shoreOnly: shoreOnly.swimmingComfort, now: now.swimmingComfort,
      openM: now.seaStateWaveM, shoreM: now.shoreDisplayWaveM,
      windKmh: Math.round(now.windSpeedKmph ?? 0),
      // Η ΙΔΙΑ συνάρτηση που τρέχει η σελίδα — το νούμερο ασφαλείας «καμία με ≥5 Μποφόρ»
      // δεν επιτρέπεται να βγαίνει από προσέγγιση.
      beaufort: getBeaufortLevel(now.windSpeedKmph ?? 0),
      departing: Boolean(now.shoreWaveFromDepartingSea),
      exposure: now.exposureLevel,
      warnings: (now.warnings || []).map(x => x.type),
    });
  }
}
mode = 'now';
console.log(`\n`);

const softened = rows.filter(r => VERDICTS.indexOf(r.now) > VERDICTS.indexOf(r.before));
const hardened = rows.filter(r => VERDICTS.indexOf(r.now) < VERDICTS.indexOf(r.before));
const byShoreFix = rows.filter(r => r.shoreOnly !== r.before);
const byBeaufort = rows.filter(r => r.shoreOnly === r.before && r.now !== r.shoreOnly);

console.log(`===== Η ΑΝΑΚΟΥΦΙΣΗ ΤΗΣ ΥΠΕΡΒΟΛΙΚΗΣ ΑΥΣΤΗΡΟΤΗΤΑΣ =====`);
console.log(`ώρες×παραλία που βαθμολογήθηκαν:            ${scored}`);
console.log(`αλλάζουν ετυμηγορία:                        ${rows.length}  σε ${new Set(rows.map(r => r.id)).size} παραλίες`);
console.log(`  ← από τη διόρθωση «νερό στην ΑΚΤΗ»:       ${byShoreFix.length}`);
console.log(`  ← από το ταβάνι 4 Μποφ. με απόδειξη:      ${byBeaufort.length}`);
console.log(`\nΚΑΤΕΥΘΥΝΣΗ (πρέπει να είναι ΟΛΕΣ προς το ηπιότερο, ένα σκαλί):`);
console.log(`  ηπιότερες:  ${softened.length}`);
console.log(`  ΑΥΣΤΗΡΟΤΕΡΕΣ: ${hardened.length}   ← πρέπει να είναι 0`);
const twoSteps = softened.filter(r => VERDICTS.indexOf(r.now) - VERDICTS.indexOf(r.before) > 1);
console.log(`  δύο σκαλιά:  ${twoSteps.length}   ← πρέπει να είναι 0`);

console.log(`\nΑΣΦΑΛΕΙΑ — τι νερό είχε στην ΑΚΤΗ όπου πάψαμε να αρνούμαστε το μπάνιο:`);
const shoreVals = softened.map(r => r.shoreM).filter(v => typeof v === 'number').sort((a, b) => a - b);
if (shoreVals.length) {
  const q = p => shoreVals[Math.min(shoreVals.length - 1, Math.floor(p * shoreVals.length))];
  console.log(`  διάμεσος ${q(0.5).toFixed(2)} μ. · p90 ${q(0.9).toFixed(2)} μ. · μέγιστο ${shoreVals[shoreVals.length - 1].toFixed(2)} μ.`);
}
console.log(`  με ≥0,50 μ. στην ακτή:      ${softened.filter(r => (r.shoreM ?? 0) >= 0.5).length}`);
console.log(`  με ≥5 Μποφόρ:               ${softened.filter(r => r.beaufort >= 5).length}   ← πρέπει να είναι 0`);
console.log(`  με προειδοποίηση ριπών:     ${softened.filter(r => r.warnings.includes('gusty_wind')).length}`);
console.log(`  σε τομέα 'exposed':         ${softened.filter(r => r.exposure === 'exposed').length}`);
console.log(`  τελική λέξη «πρόσεχε»:      ${softened.filter(r => r.now === 'caution').length} / ${softened.length}`);

console.log(`\n──── ΔΕΙΓΜΑ ────`);
for (const r of rows.slice(0, 20)) {
  console.log(`  ${String(r.name).slice(0, 22).padEnd(22)} ${r.region.slice(0, 22).padEnd(22)} ${String(r.hour).padStart(2)}h`
    + ` ${String(r.beaufort)}Μπφ ανοιχτά ${String(r.openM).padStart(5)} ακτή ${String(r.shoreM).padStart(5)}`
    + ` ${r.departing ? 'ΑΠΟΔΕΙΞΗ' : '        '} | ${r.before} → ${r.now}`);
}

const outDir = path.join(root, 'reports/weather');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `over-caution-relief-${DAY || 'live'}.json`);
fs.writeFileSync(outFile, JSON.stringify({
  day: DAY || 'live', scoredBeachHours: scored,
  changed: rows.length, beaches: new Set(rows.map(r => r.id)).size,
  fromShoreFix: byShoreFix.length, fromBeaufortCeiling: byBeaufort.length,
  softened: softened.length, hardened: hardened.length, twoSteps: twoSteps.length,
  atOrAboveFiveBeaufort: softened.filter(r => r.beaufort >= 5).length,
  shoreAtLeastHalfMetre: softened.filter(r => (r.shoreM ?? 0) >= 0.5).length,
  rows,
}, null, 2), 'utf8');
console.log(`\nΓΡΑΦΤΗΚΕ: ${path.relative(root, outFile)}`);
