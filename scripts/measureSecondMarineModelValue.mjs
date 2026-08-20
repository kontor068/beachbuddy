#!/usr/bin/env node
/**
 * ΚΕΡΔΙΖΕΙ ΤΟ ΔΕΥΤΕΡΟ ΘΑΛΑΣΣΙΟ ΜΟΝΤΕΛΟ ΤΟ 44% ΤΟΥ ΛΟΓΑΡΙΑΣΜΟΥ ΠΟΥ ΚΟΣΤΙΖΕΙ;
 *
 * ΤΟ ΕΡΩΤΗΜΑ (PORISMA §Γ42). Το κεφάλαιο του στρώματος ανέμου έκλεισε με έναν ισχυρισμό που
 * κανείς δεν μέτρησε: «ο πραγματικός μοχλός κόστους είναι αλλού — το 88% του λογαριασμού είναι
 * η θάλασσα, και το μισό του πληρώνεται επειδή ρωτάμε ΔΥΟ μοντέλα. Οικονομία εκεί είναι 4×
 * μεγαλύτερη από ό,τι κοστίζει όλο το στρώμα».
 *
 * Η ΑΡΙΘΜΗΤΙΚΗ ΤΟΥ ΚΟΣΤΟΥΣ, από τον ίδιο τον κανόνα του παρόχου (forecast.mjs:240):
 *   weight = max(1, μεταβλητές/10) × max(1, μέρες/14) × μοντέλα
 *   κύμα: 6 μεταβλητές, 6 μέρες, 2 μοντέλα → 1 × 1 × 2 = 2,0 ανά σημείο.
 * Δηλαδή το `meteofrance_wave` ΔΙΠΛΑΣΙΑΖΕΙ τη γραμμή του κύματος. Οι μέρες ΔΕΝ μετράνε (6/14
 * στρογγυλεύεται στο 1), άρα «ζήτα λιγότερες μέρες» δεν γλιτώνει τίποτα — μόνο «ζήτα λιγότερα
 * ΣΗΜΕΙΑ από το δεύτερο μοντέλο» γλιτώνει.
 *
 * ΤΙ ΜΕΤΡΑΕΙ ΑΥΤΟ. Ο κανόνας του parser (utils/marineForecastParsing) είναι «το ewam κερδίζει
 * κάθε ώρα που δίνει ύψος· το meteofrance καλύπτει τις υπόλοιπες». Άρα το δεύτερο μοντέλο
 * πληρώνεται για ό,τι ΠΕΡΙΣΣΕΥΕΙ, και αυτό μετριέται: σε εθνικό δείγμα, τι ποσοστό των ωρών
 * που φτάνουν στον επισκέπτη το δίνει τελικά το meteofrance;
 *
 * ΤΡΕΙΣ ΔΟΥΛΕΙΕΣ ΤΟΥ, ΧΩΡΙΣΤΑ ΜΕΤΡΗΜΕΝΕΣ:
 *   (Α) ΟΡΙΖΟΝΤΑΣ — το ewam τρέχει ~82 ώρες, η παραγωγή ζητάει 6 μέρες (144 ώρες).
 *   (Β) ΤΥΦΛΑ ΣΗΜΕΙΑ — κελιά μέσα σε κόλπους που το πλέγμα 0,05° του ewam δεν λύνει.
 *   (Γ) ΡΗΤΗ ΠΡΟΤΙΜΗΣΗ — 57 σημεία όπου μετρήθηκε ότι το κελί του meteofrance είναι αυτό που
 *       η παραλία όντως βλέπει (utils/marineModelPreference.generated).
 *
 * ΔΩΡΕΑΝ ΠΛΑΝΟ ΕΠΙΤΗΔΕΣ: δείγμα, όχι εθνική σάρωση. Το πληρωμένο πακέτο υπάρχει για τις 2.800.
 *
 * ΜΟΝΟ ΑΝΑΦΟΡΑ. Δεν αλλάζει κανένα δεδομένο, καμία σταθερά.
 *   node scripts/measureSecondMarineModelValue.mjs [--sample 96]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SAMPLE = Number(arg('--sample', '96'));
const OUT = arg('--json', 'reports/quality/second-marine-model-value.json');

const HOURLY = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period';
const MODELS = 'ewam,meteofrance_wave';
const DAYS = 6;
const BATCH = 24;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/** Ρητό όριο χρόνου σε ΚΑΘΕ κλήση — χωρίς signal ένας νεκρός κόμβος δεν αποτυγχάνει, περιμένει. */
const getJson = async (url, attempts = 3) => {
  for (let a = 0; a < attempts; a++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (res.status === 429 || res.status >= 500) { await sleep(4000 * (a + 1)); continue; }
      const text = await res.text();
      if (!res.ok) { console.error('  HTTP ' + res.status + ': ' + text.slice(0, 160)); await sleep(3000); continue; }
      return JSON.parse(text);
    } catch (e) { await sleep(3000 * (a + 1)); }
  }
  return null;
};

// -- ποια σημεία -------------------------------------------------------------
const appDir = path.join(root, 'public/data/beaches/app');
const all = [];
for (const rf of fs.readdirSync(appDir).filter(f => f.endsWith('.json'))) {
  let payload;
  try { payload = JSON.parse(fs.readFileSync(path.join(appDir, rf), 'utf8')); } catch { continue; }
  for (const b of payload.island?.beaches || []) {
    if (!b.coordinates) continue;
    all.push({ id: b.id, name: b.name?.gr || b.name?.en, region: rf.replace(/\.json$/, ''), lat: b.coordinates.lat, lon: b.coordinates.lon });
  }
}
// Δείγμα απλωμένο σε ΟΛΗ τη χώρα, όχι τα πρώτα Ν ενός νησιού.
const step = Math.max(1, Math.floor(all.length / SAMPLE));
const sample = all.filter((_, i) => i % step === 0).slice(0, SAMPLE);

// Τα ρητά προτιμώμενα σημεία μπαίνουν ΧΩΡΙΣΤΑ, γιατί εκεί το meteofrance ηγείται εξ ορισμού
// και θα αλλοίωναν το εθνικό ποσοστό αν ανακατεύονταν στο τυχαίο δείγμα.
let preferKeys = new Set();
try {
  const src = fs.readFileSync(path.join(root, 'utils/marineModelPreference.generated.ts'), 'utf8');
  for (const m of src.matchAll(/'(-?[\d.]+_-?[\d.]+)':\s*'meteofrance_wave'/g)) preferKeys.add(m[1]);
} catch { /* κανένα αρχείο προτίμησης */ }
const isPreferred = (p) => preferKeys.has(`${p.lat.toFixed(3)}_${p.lon.toFixed(3)}`);

console.log(`Δείγμα: ${sample.length} παραλίες από ${all.length} · μέρες ${DAYS} · μοντέλα ${MODELS}`);
console.log(`Ρητή προτίμηση meteofrance στον κατάλογο: ${preferKeys.size} σημεία`);

// -- μέτρηση -----------------------------------------------------------------
const rows = [];
for (let i = 0; i < sample.length; i += BATCH) {
  const chunk = sample.slice(i, i + BATCH);
  const lats = chunk.map(p => p.lat).join(',');
  const lons = chunk.map(p => p.lon).join(',');
  const url = `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}`
    + `&hourly=${HOURLY}&timezone=Europe%2FAthens&forecast_days=${DAYS}&cell_selection=sea&models=${MODELS}`;
  process.stdout.write(`  ${i + 1}-${Math.min(i + BATCH, sample.length)}/${sample.length} … `);
  const json = await getJson(url);
  if (!json) { console.log('ΑΠΟΤΥΧΙΑ'); chunk.forEach(p => rows.push({ ...p, error: 'network' })); continue; }
  const list = Array.isArray(json) ? json : [json];
  console.log(`${list.length} απαντήσεις`);
  list.forEach((r, k) => {
    const p = chunk[k];
    if (!p) return;
    const h = r.hourly || {};
    const e = h.wave_height_ewam, m = h.wave_height_meteofrance_wave;
    if (!Array.isArray(e) && !Array.isArray(m)) { rows.push({ ...p, error: 'no-fields' }); return; }
    const n = Math.max(e?.length || 0, m?.length || 0);
    let ewamHours = 0, mfOnly = 0, neither = 0, lastEwam = -1;
    for (let t = 0; t < n; t++) {
      const hasE = Number.isFinite(e?.[t]);
      const hasM = Number.isFinite(m?.[t]);
      if (hasE) { ewamHours++; lastEwam = t; }
      else if (hasM) mfOnly++;
      else neither++;
    }
    rows.push({ ...p, hours: n, ewamHours, mfOnly, neither, ewamHorizonH: lastEwam + 1, preferred: isPreferred(p) });
  });
  await sleep(1200);
}

// -- σύνοψη ------------------------------------------------------------------
const ok = rows.filter(r => !r.error && r.hours);
const sum = (f) => ok.reduce((s, r) => s + f(r), 0);
const totalHours = sum(r => r.hours);
const totalEwam = sum(r => r.ewamHours);
const totalMf = sum(r => r.mfOnly);
const totalNone = sum(r => r.neither);
const ewamBlind = ok.filter(r => r.ewamHours === 0);
const horizons = ok.filter(r => r.ewamHours > 0).map(r => r.ewamHorizonH).sort((a, b) => a - b);
const median = (xs) => xs.length ? xs[Math.floor(xs.length / 2)] : null;

console.log(`\n-- ΠΟΙΟΣ ΔΙΝΕΙ ΤΙΣ ΩΡΕΣ ΠΟΥ ΔΙΑΒΑΖΕΙ Ο ΕΠΙΣΚΕΠΤΗΣ (${ok.length} παραλίες, ${totalHours} ώρες) --`);
console.log(`  ewam:              ${totalEwam} (${(100 * totalEwam / totalHours).toFixed(1)}%)`);
console.log(`  ΜΟΝΟ meteofrance:  ${totalMf} (${(100 * totalMf / totalHours).toFixed(1)}%)  <- αυτό αγοράζει το 2ο μοντέλο`);
console.log(`  κανένα:            ${totalNone} (${(100 * totalNone / totalHours).toFixed(1)}%)`);
console.log(`\n-- ΟΙ ΤΡΕΙΣ ΔΟΥΛΕΙΕΣ ΤΟΥ ΔΕΥΤΕΡΟΥ ΜΟΝΤΕΛΟΥ --`);
console.log(`  (Α) ορίζοντας ewam: διάμεσος ${median(horizons)} ώρες σε ${DAYS * 24} ζητούμενες`
  + (horizons.length ? ` (min ${horizons[0]}, max ${horizons[horizons.length - 1]})` : ''));
console.log(`  (Β) παραλίες που το ewam ΔΕΝ βλέπει καθόλου: ${ewamBlind.length}/${ok.length} (${(100 * ewamBlind.length / ok.length).toFixed(1)}%)`);
console.log(`  (Γ) ρητή προτίμηση meteofrance στο δείγμα: ${ok.filter(r => r.preferred).length}`);
if (ewamBlind.length) console.log('      ' + ewamBlind.slice(0, 8).map(r => `#${r.id} ${r.name}`).join(' · '));

const errs = rows.filter(r => r.error);
if (errs.length) console.log(`\n  ! ${errs.length} παραλίες χωρίς απάντηση (${[...new Set(errs.map(e => e.error))].join(', ')})`);

// Το κόστος, με τον κανόνα του παρόχου: 2 μοντέλα = 2,0/σημείο, 1 μοντέλο = 1,0/σημείο.
const shareMf = totalHours ? totalMf / totalHours : 0;
console.log(`\n-- ΤΟ ΖΥΓΙΣΜΑ --`);
console.log(`  Το 2ο μοντέλο κοστίζει +1,0 ανά σημείο, δηλαδή ΔΙΠΛΑΣΙΑΖΕΙ τη γραμμή του κύματος.`);
console.log(`  Αγοράζει ${(100 * shareMf).toFixed(1)}% των ωρών κύματος + ${ewamBlind.length} παραλίες που αλλιώς δεν θα είχαν ΚΑΜΙΑ.`);

fs.mkdirSync(path.dirname(path.join(root, OUT)), { recursive: true });
fs.writeFileSync(path.join(root, OUT), JSON.stringify({
  method: 'live marine sample, both models in one request (as production); parser rule is ewam-wins-every-hour-it-reports',
  requestedDays: DAYS, models: MODELS, sampled: ok.length, ofBeaches: all.length,
  hours: { total: totalHours, ewam: totalEwam, meteofranceOnly: totalMf, neither: totalNone },
  ewamHorizonHoursMedian: median(horizons),
  ewamBlindBeaches: ewamBlind.map(r => ({ id: r.id, name: r.name, region: r.region })),
  preferredInSample: ok.filter(r => r.preferred).length,
  rows,
}, null, 2));
console.log(`\nγράφτηκε ${OUT}`);
