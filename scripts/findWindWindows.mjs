#!/usr/bin/env node
/**
 * ΠΟΙΕΣ ΜΕΡΕΣ ΝΑ ΞΑΝΑΤΡΕΞΟΥΜΕ — Ο ΚΑΤΑΛΟΓΟΣ ΠΟΥ ΕΛΕΙΠΕ.
 *
 * ΤΟ ΠΡΟΒΛΗΜΑ ΠΟΥ ΛΥΝΕΙ. Κάθε βαθμονόμηση αυτού του project μετρήθηκε στον καιρό που έτυχε να
 * κάνει τη μέρα που έτρεξε το εργαλείο. Η βίβλος το λέει μόνη της τρεις φορές: ο μάρτυρας
 * κορυφής μετρήθηκε «σε ΜΙΑ ήρεμη μέρα και δεν οριοθετεί τίποτα για καταιγίδα», το ×1,20
 * κόπηκε ως «overfit στο παράθυρο βαθμονόμησης», το 0,30 της ακτής περιμένει «μέτρηση σε
 * δεύτερο παράθυρο». Με το αρχείο προγνώσεων (πλάνο Professional, 21/08/2026) το παράθυρο
 * παύει να είναι θέμα τύχης — αλλά πρώτα πρέπει να ξέρουμε ΠΟΙΕΣ μέρες αξίζουν.
 *
 * ΤΙ ΚΑΝΕΙ. Κατεβάζει τα καλοκαίρια των τελευταίων ετών για αντιπροσωπευτικά σημεία και
 * κατατάσσει κάθε μέρα σε τρεις κάδους: ΜΕΛΤΕΜΙ (εκεί σπάνε οι κανόνες έκθεσης), ΘΥΕΛΛΑ (εκεί
 * δοκιμάζεται η ασφάλεια) και ΑΠΝΟΙΑ (εκεί δοκιμάζεται αν τρομάζουμε άδικα).
 *
 * ΓΙΑΤΙ ΤΟ ΑΡΧΕΙΟ ΠΡΟΓΝΩΣΕΩΝ ΚΑΙ ΟΧΙ ΤΟ ERA5. Θέλουμε τις μέρες που **η δική μας πρόγνωση**
 * έδειχνε μελτέμι, γιατί εκεί ακριβώς θα ξανατρέξουν τα εργαλεία μέσω lib/replayOpenMeteo.mjs.
 * Ένας κατάλογος από άλλη πηγή θα διάλεγε μέρες που το replay δεν θα ξανάβλεπε ίδιες.
 *
 * Ο ΑΝΕΜΟΣ ΕΙΝΑΙ Ο ΑΝΕΜΟΣ ΠΟΥ ΒΛΕΠΕΙ Ο ΧΡΗΣΤΗΣ: περνάει από το ίδιο applyGustFloor και το ίδιο
 * getBeaufortLevel που στέλνονται στο site, όχι από δικό μας κατώφλι.
 *
 *   node scripts/findWindWindows.mjs [ελάχιστα_μποφόρ] [ελάχιστες_ώρες]
 *
 * ΔΕΝ αλλάζει τίποτα στο site. Γράφει reports/replay/wind-windows.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import './lib/paidOpenMeteo.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText, filename);
};
const { getBeaufortLevel } = require(path.join(root, 'utils/weatherUtils.ts'));
const { applyGustFloor } = require(path.join(root, 'utils/windGustFloor.ts'));

const MIN_BFT = Number(process.argv[2] || 5);
const MIN_HOURS = Number(process.argv[3] || 6);

/** Δέκα σημεία που καλύπτουν τα καιρικά καθεστώτα της χώρας, ένα ανά περιοχή-δείκτη. */
const PROBES = [
  ['Νάξος', 37.081, 25.368], ['Μύκονος', 37.435, 25.348], ['Πάρος', 37.010, 25.128],
  ['Ρόδος', 36.405, 28.086], ['Κως', 36.793, 27.092],
  ['Λήμνος', 39.922, 25.236], ['Μυτιλήνη', 39.057, 26.598],
  ['Ηράκλειο', 35.340, 25.180], ['Κέρκυρα', 39.602, 19.912], ['Ζάκυνθος', 37.751, 20.884],
];

/** Το αρχείο προγνώσεων ξεκινά ~2022 για τα περισσότερα μοντέλα. Καλοκαίρι = Ιούν-Σεπ. */
const YEARS = [2022, 2023, 2024, 2025];
const SEASON = ['06-01', '09-30'];

const fetchYear = async (year) => {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${PROBES.map((p) => p[1]).join(',')}`
    + `&longitude=${PROBES.map((p) => p[2]).join(',')}`
    + `&start_date=${year}-${SEASON[0]}&end_date=${year}-${SEASON[1]}`
    + '&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m'
    + '&wind_speed_unit=kmh&timezone=Europe%2FAthens';
  // Ρητά ο ιστορικός host: το replay ΔΕΝ φορτώνεται εδώ, και δεν πρέπει —
  // αυτό το εργαλείο ΦΤΙΑΧΝΕΙ τον κατάλογο, δεν τον καταναλώνει.
  const res = await fetch(url.replace('api.open-meteo.com', 'historical-forecast-api.open-meteo.com'));
  if (!res.ok) throw new Error(`${year}: HTTP ${res.status}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [body];
};

/** Μία μέρα, ένα σημείο: πόσες ώρες πάνω από το κατώφλι και ποια η κορυφή. */
const summariseDay = (hours) => {
  let hoursAtOrAbove = 0;
  let peak = 0;
  const dirs = [];
  for (const h of hours) {
    const speed = applyGustFloor(h.speed, h.gust, 0);
    const bft = getBeaufortLevel(speed);
    if (bft >= MIN_BFT) hoursAtOrAbove += 1;
    if (bft > peak) peak = bft;
    if (bft >= 4 && Number.isFinite(h.dir)) dirs.push(h.dir);
  }
  // Κυκλικός μέσος: ο απλός μέσος κάνει τον βόρειο άνεμο νότιο όταν περνάει το 0°.
  let meanDir = null;
  if (dirs.length) {
    const x = dirs.reduce((a, d) => a + Math.cos((d * Math.PI) / 180), 0) / dirs.length;
    const y = dirs.reduce((a, d) => a + Math.sin((d * Math.PI) / 180), 0) / dirs.length;
    meanDir = Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
  }
  return { hoursAtOrAbove, peak, meanDir };
};

const run = async () => {
  console.log(`\n🔎 Ψάχνω μέρες με ${MIN_BFT}+ Μποφόρ για ${MIN_HOURS}+ ώρες, ${YEARS[0]}-${YEARS[YEARS.length - 1]}, Ιούν-Σεπ.`);
  console.log(`   ${PROBES.length} σημεία · ${YEARS.length} αιτήματα συνολικά (ένα ανά έτος).\n`);

  /** ημερομηνία -> { σημείο: σύνοψη } */
  const byDay = new Map();

  for (const year of YEARS) {
    let series;
    try {
      series = await fetchYear(year);
    } catch (err) {
      console.error(`  ⛔ ${year}: ${err.message} — το έτος παραλείπεται.`);
      continue;
    }
    series.forEach((point, i) => {
      const name = PROBES[i] ? PROBES[i][0] : `#${i}`;
      const h = point.hourly || {};
      const times = h.time || [];
      const perDay = new Map();
      for (let k = 0; k < times.length; k += 1) {
        const day = times[k].slice(0, 10);
        if (!perDay.has(day)) perDay.set(day, []);
        perDay.get(day).push({
          speed: h.wind_speed_10m ? h.wind_speed_10m[k] : null,
          gust: h.wind_gusts_10m ? h.wind_gusts_10m[k] : null,
          dir: h.wind_direction_10m ? h.wind_direction_10m[k] : null,
        });
      }
      for (const [day, hours] of perDay) {
        if (hours.length < 20) continue; // μισή μέρα δεν κρίνεται
        if (!byDay.has(day)) byDay.set(day, {});
        byDay.get(day)[name] = summariseDay(hours);
      }
    });
    console.log(`  ✔ ${year}: ${series.length} σημεία.`);
  }

  const days = [...byDay.entries()].map(([date, points]) => {
    const hit = Object.entries(points).filter(([, s]) => s.hoursAtOrAbove >= MIN_HOURS);
    const peaks = Object.values(points).map((s) => s.peak);
    return {
      date,
      regionsHit: hit.length,
      regions: hit.map(([n]) => n),
      peakBft: peaks.length ? Math.max(...peaks) : 0,
      calmRegions: Object.values(points).filter((s) => s.peak <= 3).length,
      totalRegions: Object.keys(points).length,
      meanDirection: hit.length ? hit[0][1].meanDir : null,
    };
  });

  // Τα κατώφλια των κάδων μετρήθηκαν, δεν επιλέχθηκαν: με «θύελλα = 8+ Μποφόρ» ο κάδος βγήκε
  // ΑΔΕΙΟΣ σε 488 καλοκαιρινές μέρες. Στο ελληνικό καλοκαίρι το ακραίο είναι τα 7 Μποφόρ, οπότε
  // εκεί μπαίνει η γραμμή — αλλιώς η «δοκιμή ασφάλειας» δεν θα είχε ποτέ μέρα να τρέξει.
  const meltemi = days.filter((d) => d.regionsHit >= 3 && d.peakBft <= 6)
    .sort((a, b) => b.regionsHit - a.regionsHit || b.peakBft - a.peakBft);
  const storm = days.filter((d) => d.peakBft >= 7)
    .sort((a, b) => b.peakBft - a.peakBft || b.regionsHit - a.regionsHit);
  const calm = days.filter((d) => d.regionsHit === 0 && d.calmRegions >= d.totalRegions - 1)
    .sort((a, b) => b.calmRegions - a.calmRegions);

  // ⚠️ ΤΑ ΕΤΗ ΔΕΝ ΕΙΝΑΙ ΙΣΟΔΥΝΑΜΑ, ΚΑΙ ΤΟ ΔΕΙΓΜΑ ΓΕΡΝΕΙ. Μετρήθηκε 21/08/2026 σε Νάξο+Μύκονο,
  // Ιούλιος-Αύγουστος: διάμεσος 26,1 km/h το 2022 έναντι 18,7-23,8 τα υπόλοιπα τρία. Η ουρά
  // (90ό εκατοστημόριο) γέρνει πολύ λιγότερο, που μοιάζει με πραγματικά ανεμώδες έτος και όχι
  // με αλλαγή πλέγματος — αλλά δεν αποδείχθηκε. Συνέπεια: μια λίστα «οι 10 πιο ανεμώδεις» θα
  // γεμίσει 2022. ΔΙΑΛΕΞΕ ΜΕΡΕΣ ΑΠΟ ΔΙΑΦΟΡΕΤΙΚΑ ΕΤΗ — γι' αυτό τυπώνεται από κάτω.
  const perYear = (list) => list.reduce((acc, d) => {
    const y = d.date.slice(0, 4);
    acc[y] = (acc[y] || 0) + 1;
    return acc;
  }, {});

  const out = {
    generatedAt: new Date().toISOString(),
    criteria: { minBeaufort: MIN_BFT, minHours: MIN_HOURS, years: YEARS, season: SEASON },
    probes: PROBES.map(([name, lat, lon]) => ({ name, lat, lon })),
    source: 'historical-forecast-api.open-meteo.com (αρχείο των ίδιων μας των προγνώσεων)',
    counts: {
      meltemi: meltemi.length, storm: storm.length, calm: calm.length, daysExamined: days.length,
    },
    perYear: { meltemi: perYear(meltemi), storm: perYear(storm), calm: perYear(calm) },
    meltemi: meltemi.slice(0, 60),
    storm: storm.slice(0, 30),
    calm: calm.slice(0, 30),
  };

  const dir = path.join(root, 'reports/replay');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'wind-windows.json');
  fs.writeFileSync(file, JSON.stringify(out, null, 2), 'utf8');

  console.log(`\n📅 ${days.length} μέρες εξετάστηκαν.`);
  console.log(`   ΜΕΛΤΕΜΙ: ${meltemi.length} · ΘΥΕΛΛΑ: ${storm.length} · ΑΠΝΟΙΑ: ${calm.length}\n`);
  console.log('   Οι 10 πιο καθαρές μέρες μελτεμιού:');
  for (const d of meltemi.slice(0, 10)) {
    console.log(`     ${d.date}  ${d.regionsHit}/${d.totalRegions} περιοχές  κορυφή ${d.peakBft} Μποφ.  (${d.regions.slice(0, 4).join(', ')})`);
  }
  console.log('\n   Οι 5 χειρότερες (δοκιμή ασφάλειας):');
  for (const d of storm.slice(0, 5)) {
    console.log(`     ${d.date}  κορυφή ${d.peakBft} Μποφ.  ${d.regionsHit}/${d.totalRegions} περιοχές`);
  }
  console.log('\n   Οι 5 πιο άπνοες (δοκιμή «μη τρομάζεις άδικα»):');
  for (const d of calm.slice(0, 5)) {
    console.log(`     ${d.date}  ${d.calmRegions}/${d.totalRegions} περιοχές κάτω από 4 Μποφ.`);
  }
  const spread = perYear(meltemi);
  console.log(`\n   ⚠️  Μέρες μελτεμιού ανά έτος: ${YEARS.map((y) => `${y}: ${spread[y] || 0}`).join(' · ')}`);
  console.log('      Αν ένα έτος κυριαρχεί, ΜΗΝ πάρεις μόνο τις κορυφαίες — διάλεξε από κάθε έτος.');
  console.log(`\n💾 ${path.relative(root, file)}`);
  console.log('\n   Χρήση: OPEN_METEO_API_KEY=… OPEN_METEO_REPLAY=<ημερομηνία> node scripts/<εργαλείο>.mjs\n');
};

run().catch((err) => { console.error(err); process.exit(1); });
