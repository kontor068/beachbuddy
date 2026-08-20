#!/usr/bin/env node
/**
 * ΤΟ ΣΠΑΣΜΕΝΟ ΑΙΤΗΜΑ ΔΙΝΕΙ ΑΚΡΙΒΩΣ ΤΑ ΙΔΙΑ ΝΟΥΜΕΡΑ ΜΕ ΤΟ ΕΝΙΑΙΟ;
 *
 * ΓΙΑΤΙ ΥΠΑΡΧΕΙ (PORISMA §Γ43). Στις 20/08/2026 η κλήση κύματος έσπασε στα δύο — \`models=ewam\`
 * με μνήμη 3 ωρών και \`models=meteofrance_wave\` με μνήμη 12 — και οι δύο απαντήσεις ενώνονται
 * πάλι στον πελάτη (\`mergeMarineLegs\`). Η αλλαγή έγινε ΓΙΑ ΤΟ ΚΟΣΤΟΣ, άρα η μόνη αποδεκτή
 * επίδραση στα νούμερα είναι **καμία**. Αυτό το σενάριο το αποδεικνύει στο δίκτυο αντί να το
 * υποθέτει: ζητάει και τους δύο τρόπους για τα ΙΔΙΑ σημεία και συγκρίνει γραμμή-γραμμή.
 *
 * ΤΙ ΘΑ ΕΠΙΑΝΕ ΚΑΙ ΤΙΠΟΤΑ ΑΛΛΟ ΔΕΝ ΠΙΑΝΕΙ:
 *   - ένωση κατά ΘΕΣΗ αντί για σφραγίδα ώρας (θα μετατόπιζε όλα τα ύψη κατά ώρες, με απολύτως
 *     εύλογα νούμερα να δείχνουν λάθος ώρα)·
 *   - χαμένη ουρά (οι μέρες 4-6 να γυρίσουν κενές)·
 *   - πεθαμένο μάρτυρα (ο έλεγχος ψεύτικης κορυφής να πάψει να πυροδοτείται).
 *
 * ⚠️ ΘΕΛΕΙ ΔΙΚΤΥΟ, άρα ΔΕΝ μπαίνει στο quality:critical (που τρέχει χωρίς κλήσεις). Τρέξ' το με
 * το χέρι όποτε αγγίξει κανείς τα δύο pin, τη μνήμη τους ή την \`mergeMarineLegs\`.
 *
 *   node scripts/validateSplitMarineEquivalence.mjs [--sample 24]
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
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};
const { parseMarineHourly, mergeMarineLegs } = require(path.join(root, 'utils/marineForecastParsing.ts'));

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SAMPLE = Number(arg('--sample', '24'));
const HOURLY = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const getJson = async (url, attempts = 3) => {
  for (let a = 0; a < attempts; a++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (a + 1)); continue; }
      if (!res.ok) { await sleep(3000); continue; }
      return JSON.parse(await res.text());
    } catch { await sleep(3000 * (a + 1)); }
  }
  return null;
};

const appDir = path.join(root, 'public/data/beaches/app');
const all = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  for (const b of payload.island?.beaches || []) if (b.coordinates) all.push({ id: b.id, name: b.name?.gr || b.name?.en, lat: b.coordinates.lat, lon: b.coordinates.lon });
}
const step = Math.max(1, Math.floor(all.length / SAMPLE));
const pts = all.filter((_, i) => i % step === 0).slice(0, SAMPLE);

const url = (models) => 'https://marine-api.open-meteo.com/v1/marine?latitude=' + pts.map(p => p.lat).join(',')
  + '&longitude=' + pts.map(p => p.lon).join(',')
  + '&hourly=' + HOURLY + '&timezone=Europe%2FAthens&forecast_days=6&cell_selection=sea&models=' + models;

console.log(`Σύγκριση σε ${pts.length} παραλίες: ενιαίο αίτημα vs σπασμένο + ένωση`);
const [both, near, tail] = await Promise.all([
  getJson(url('ewam,meteofrance_wave')),
  getJson(url('ewam')),
  getJson(url('meteofrance_wave')),
]);
if (!both || !near || !tail) { console.error('ΣΤΑΜΑΤΩ: το δίκτυο δεν απάντησε και στα τρία αιτήματα.'); process.exit(2); }

const asList = (j) => (Array.isArray(j) ? j : [j]);
const B = asList(both), N = asList(near), T = asList(tail);

let compared = 0, rowsCompared = 0, mismatches = [], tailHours = 0;
for (let i = 0; i < pts.length; i++) {
  if (!B[i]?.hourly || !N[i]?.hourly || !T[i]?.hourly) continue;
  const oldRows = parseMarineHourly(B[i].hourly);
  const newRows = parseMarineHourly(mergeMarineLegs(N[i].hourly, T[i].hourly));
  compared++;

  const oldByTime = new Map(oldRows.map(r => [r.dt_txt, r]));
  const newByTime = new Map(newRows.map(r => [r.dt_txt, r]));
  if (oldByTime.size !== newByTime.size) {
    mismatches.push(`#${pts[i].id} ${pts[i].name}: διαφορετικό πλήθος ωρών ${oldByTime.size} vs ${newByTime.size}`);
  }
  for (const [t, o] of oldByTime) {
    const n = newByTime.get(t);
    rowsCompared++;
    if (!n) { mismatches.push(`#${pts[i].id} ${t}: λείπει ώρα από το σπασμένο`); continue; }
    const a = JSON.stringify(o.marine ?? o);
    const b = JSON.stringify(n.marine ?? n);
    if (a !== b) mismatches.push(`#${pts[i].id} ${pts[i].name} ${t}: ${a} vs ${b}`);
  }
  // Η ουρά πρέπει όντως να υπάρχει, αλλιώς η «ισοδυναμία» θα ήταν ισοδυναμία δύο κενών.
  tailHours += newRows.filter(r => {
    const h = r.marine?.waveHeightM;
    return h !== undefined && new Date(r.dt_txt).getTime() > Date.now() + 94 * 3600 * 1000;
  }).length;
}

console.log(`\nπαραλίες: ${compared} · ώρες που συγκρίθηκαν: ${rowsCompared}`);
console.log(`ώρες ουράς (πέρα από τις 94) με ύψος: ${tailHours}`);
if (!rowsCompared) { console.error('ΣΤΑΜΑΤΩ: δεν συγκρίθηκε καμία ώρα.'); process.exit(2); }
if (!tailHours) { console.error('ΑΠΕΤΥΧΕ: η ουρά ήρθε άδεια — το δεύτερο σκέλος δεν φτάνει στις γραμμές.'); process.exit(1); }

if (mismatches.length) {
  console.error(`\nΑΠΕΤΥΧΕ: ${mismatches.length} διαφορές.`);
  mismatches.slice(0, 10).forEach(m => console.error('  ' + m));
  process.exit(1);
}
console.log('\nΠΕΡΑΣΕ: το σπασμένο αίτημα δίνει γραμμή-προς-γραμμή ό,τι και το ενιαίο.');
