#!/usr/bin/env node
/**
 * ΑΝΤΕΧΕΙ Ο ΜΑΡΤΥΡΑΣ ΚΥΜΑΤΟΣ ΝΑ ΓΕΡΑΣΕΙ; — ο έλεγχος που ΠΡΕΠΕΙ να προηγηθεί του §Γ43.
 *
 * ΤΟ ΕΥΡΗΜΑ ΠΟΥ ΤΟΝ ΓΕΝΝΗΣΕ. Το §Γ43 μέτρησε ότι το `meteofrance_wave` δίνει μόνο τις ώρες
 * 95-144 και πρότεινε να ζητιέται χωριστά, με μνήμη 12 ωρών αντί 3. Διαβάζοντας όμως τον parser
 * (`utils/marineForecastParsing`) φάνηκε ότι το δεύτερο μοντέλο έχει ΔΕΥΤΕΡΗ δουλειά που η
 * μέτρηση «ποιος δίνει την τιμή» ΔΕΝ βλέπει: είναι ο **ΜΑΡΤΥΡΑΣ** του `uncorroboratedSpikeHours`.
 * Όταν ο ηγέτης δείξει απότομη κορυφή (>1 μ./ώρα, ≥1 μ.) και ο μάρτυρας δεν τη δει (<50% της),
 * η ώρα πέφτει ΟΛΟΚΛΗΡΗ στον μάρτυρα — δηλαδή στη ΧΑΜΗΛΟΤΕΡΗ τιμή.
 *
 * ΓΙΑΤΙ ΑΥΤΟ ΕΙΝΑΙ ΕΠΙΚΙΝΔΥΝΗ ΚΑΤΕΥΘΥΝΣΗ. Ένας ΠΑΛΙΟΣ μάρτυρας δεν έχει δει τη νέα φουρτούνα,
 * άρα δεν την επιβεβαιώνει, άρα την ΚΟΒΕΙ. Δηλαδή η οικονομία του §Γ43 θα μπορούσε να
 * υποεκτιμά κύμα που ανεβαίνει — ακριβώς το λάθος που κανένα άλλο δίχτυ δεν συγχωρεί.
 *
 * ΤΙ ΜΕΤΡΑΕΙ. Πόσο συχνά ΠΥΡΟΔΟΤΕΙΤΑΙ ο μάρτυρας στην πραγματικότητα, και ΠΟΥ:
 *   - μέσα στις ώρες 1-94, όπου ηγείται το ewam και ο μάρτυρας έχει ρόλο· ή
 *   - στην ουρά 95-144, όπου το ewam σιωπά και ο «μάρτυρας» είναι ο μόνος που μιλάει.
 * Αν πυροδοτείται ~ποτέ στις 1-94, η πρόσθετη παλαίωση δεν αγοράζει ρίσκο. Αν πυροδοτείται
 * συχνά, η μνήμη των 12 ωρών ΔΕΝ επιτρέπεται και το §Γ43 χρειάζεται άλλο σχέδιο.
 *
 * ΤΟ ΚΑΤΩΦΛΙ ΓΡΑΦΤΗΚΕ ΠΡΙΝ ΤΡΕΞΕΙ: κάτω από 0,1% των ωρών 1-94 = ασφαλές· πάνω από 1% = όχι.
 *
 * ΜΟΝΟ ΑΝΑΦΟΡΑ. Καμία αλλαγή δεδομένων, καμία σταθερά.
 *   node scripts/measureSpikeWitnessStaleness.mjs [--sample 96]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Το σχόλιο του MARINE_TAIL_MODEL στο netlify/functions/forecast.mjs ζητάει ρητά «RE-RUN THAT
// SCRIPT» πριν φαρδύνει άλλο η μνήμη των 12 ωρών, γιατί το μηδέν «μετρήθηκε σε ΜΙΑ ήρεμη μέρα
// και δεν οριοθετεί τίποτα για καταιγίδα». Αυτά τα δύο το κάνουν εφικτό: πληρωμένοι host (ένα
// δείγμα 96 σημείων έκαιγε το δωρεάν όριο) και OPEN_METEO_REPLAY για να διαλέξεις τη μέρα.
//   OPEN_METEO_REPLAY=2022-09-06 node scripts/measureSpikeWitnessStaleness.mjs
// ⚠️ ΜΙΑ ΔΙΑΦΟΡΑ ΣΤΟ REPLAY: στο αρχείο το ewam δίνει και τις 144 ώρες, ενώ ζωντανά σταματά
// στις 94. Ο διαχωρισμός near/ουρά παρακάτω χάνει λοιπόν το νόημά του σε replay — το ποσοστό
// «πόσο συχνά κόβει ο μάρτυρας» παραμένει έγκυρο και μάλιστα πληρέστερο.
import './lib/paidOpenMeteo.mjs';
import './lib/replayOpenMeteo.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SAMPLE = Number(arg('--sample', '96'));
const OUT = arg('--json', 'reports/quality/spike-witness-staleness.json');

// Οι ΙΔΙΕΣ σταθερές με τον parser. Διαβάζονται από την πηγή ώστε να μη γίνουν αντίγραφο που
// ξεχνιέται: αν αλλάξουν εκεί και όχι εδώ, η μέτρηση σταματάει αντί να πει ψέματα.
const parserSrc = fs.readFileSync(path.join(root, 'utils/marineForecastParsing.ts'), 'utf8');
const constOf = (name) => {
  const m = parserSrc.match(new RegExp(`export const ${name}\\s*=\\s*([\\d.]+)`));
  if (!m) throw new Error(`ΣΤΑΜΑΤΩ: δεν βρέθηκε η σταθερά ${name} στον parser.`);
  return Number(m[1]);
};
const MAX_GROWTH = constOf('MAX_CREDIBLE_WAVE_GROWTH_M_PER_H');
const MIN_HEIGHT = constOf('SPIKE_MIN_HEIGHT_M');
const RATIO = constOf('SPIKE_CORROBORATION_RATIO');
console.log(`Σταθερές από τον parser: ανάπτυξη>${MAX_GROWTH} μ./ώ · ύψος≥${MIN_HEIGHT} μ · επιβεβαίωση≥${RATIO}×`);

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
/** Αντίγραφο ΕΝΑ-ΠΡΟΣ-ΕΝΑ του uncorroboratedSpikeHours — ίδιος βρόχος, ίδια σειρά ελέγχων. */
const spikeHours = (lead, witness) => {
  const suspect = new Set();
  if (!Array.isArray(lead) || !Array.isArray(witness)) return suspect;
  let inside = false;
  for (let i = 0; i < lead.length; i++) {
    const l = num(lead[i]);
    if (l === undefined) { inside = false; continue; }
    const w = num(witness[i]);
    const corroborated = w === undefined || w >= l * RATIO;
    if (corroborated || l < MIN_HEIGHT) { inside = false; continue; }
    if (inside) { suspect.add(i); continue; }
    const prev = num(lead[i - 1]);
    if (prev !== undefined && l - prev > MAX_GROWTH) { inside = true; suspect.add(i); }
  }
  return suspect;
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const getJson = async (url, attempts = 3) => {
  for (let a = 0; a < attempts; a++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (a + 1)); continue; }
      const text = await res.text();
      if (!res.ok) { console.error('  HTTP ' + res.status); await sleep(3000); continue; }
      return JSON.parse(text);
    } catch { await sleep(3000 * (a + 1)); }
  }
  return null;
};

// -- σημεία ------------------------------------------------------------------
const appDir = path.join(root, 'public/data/beaches/app');
const all = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  for (const b of payload.island?.beaches || []) {
    if (b.coordinates) all.push({ id: b.id, name: b.name?.gr || b.name?.en, lat: b.coordinates.lat, lon: b.coordinates.lon });
  }
}
const step = Math.max(1, Math.floor(all.length / SAMPLE));
const sample = all.filter((_, i) => i % step === 0).slice(0, SAMPLE);
console.log(`Δείγμα: ${sample.length} παραλίες από ${all.length}`);

// -- μέτρηση -----------------------------------------------------------------
const HOURLY = 'wave_height';
const NEAR_HOURS = 94; // μετρημένο στο §Γ43: ο ορίζοντας του ewam, min = διάμεσος = max
let hoursNear = 0, hoursTail = 0, firedNear = 0, firedTail = 0, pts = 0;
const worst = [];

for (let i = 0; i < sample.length; i += 24) {
  const chunk = sample.slice(i, i + 24);
  const url = 'https://marine-api.open-meteo.com/v1/marine?latitude=' + chunk.map(p => p.lat).join(',')
    + '&longitude=' + chunk.map(p => p.lon).join(',')
    + '&hourly=' + HOURLY + '&timezone=Europe%2FAthens&forecast_days=6&cell_selection=sea&models=ewam,meteofrance_wave';
  process.stdout.write(`  ${i + 1}-${Math.min(i + 24, sample.length)}/${sample.length} … `);
  const json = await getJson(url);
  if (!json) { console.log('ΑΠΟΤΥΧΙΑ'); continue; }
  const list = Array.isArray(json) ? json : [json];
  console.log(`${list.length} απαντήσεις`);
  list.forEach((r, k) => {
    const p = chunk[k];
    if (!p) return;
    const h = r.hourly || {};
    const e = h.wave_height_ewam, m = h.wave_height_meteofrance_wave;
    if (!Array.isArray(e) || !Array.isArray(m)) return;
    pts++;
    const fired = spikeHours(e, m);
    const n = Math.max(e.length, m.length);
    for (let t = 0; t < n; t++) {
      const inNear = t < NEAR_HOURS;
      if (num(e[t]) !== undefined) { if (inNear) hoursNear++; else hoursTail++; }
      if (fired.has(t)) {
        if (inNear) firedNear++; else firedTail++;
        const drop = (num(e[t]) ?? 0) - (num(m[t]) ?? 0);
        worst.push({ id: p.id, name: p.name, hour: t, lead: num(e[t]), witness: num(m[t]), dropM: Number(drop.toFixed(2)) });
      }
    }
  });
  await sleep(1200);
}

worst.sort((a, b) => b.dropM - a.dropM);
const pctNear = hoursNear ? (100 * firedNear / hoursNear) : 0;
console.log(`\n-- ΠΟΣΟ ΣΥΧΝΑ ΚΟΒΕΙ Ο ΜΑΡΤΥΡΑΣ (${pts} παραλίες) --`);
console.log(`  ώρες 1-${NEAR_HOURS} (ηγείται το ewam, ο μάρτυρας έχει ρόλο): ${firedNear} / ${hoursNear} = ${pctNear.toFixed(3)}%`);
console.log(`  ουρά ${NEAR_HOURS + 1}-144 (το ewam σιωπά, δεν υπάρχει ηγέτης να κοπεί): ${firedTail} / ${hoursTail}`);
if (worst.length) {
  console.log('  μεγαλύτερες κοπές:');
  worst.slice(0, 6).forEach(w => console.log(`    #${w.id} ${w.name} ώρα ${w.hour}: ${w.lead} μ → ${w.witness} μ (−${w.dropM} μ)`));
}

const verdict = pctNear < 0.1 ? 'ΑΣΦΑΛΕΣ' : pctNear > 1 ? 'ΟΧΙ' : 'ΟΡΙΑΚΟ';
console.log(`\n-- ΕΤΥΜΗΓΟΡΙΑ ΓΙΑ ΤΗ ΜΝΗΜΗ ΤΩΝ 12 ΩΡΩΝ: ${verdict} --`);
console.log(`  κατώφλι γραμμένο πριν τη μέτρηση: <0,1% ασφαλές · >1% όχι.`);

fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
fs.writeFileSync(path.join(root, OUT), JSON.stringify({
  method: 'live marine sample; replays the shipped uncorroboratedSpikeHours loop over ewam(lead) vs meteofrance_wave(witness)',
  constants: { MAX_GROWTH, MIN_HEIGHT, RATIO }, nearHours: NEAR_HOURS,
  points: pts, hoursNear, hoursTail, firedNear, firedTail, firedNearPct: pctNear, verdict,
  worst: worst.slice(0, 40),
}, null, 2));
console.log(`\nγράφτηκε ${OUT}`);
