#!/usr/bin/env node
/**
 * ΕΙΝΑΙ ΛΑΘΟΣ Ο ΑΝΕΜΟΣ ΤΗΣ ΛΥΓΑΡΙΑΣ; — Η ΡΙΖΑ Α, ΓΙΑ ΠΡΩΤΗ ΦΟΡΑ ΜΕ ΝΟΥΜΕΡΑ.
 *
 * ΓΙΑΤΙ. Το §Γ59 έριξε το ΚΥΜΑ της Λυγαριάς (0,58 → 0,29 μ.) και η μέτρηση έδειξε ότι η
 * ετυμηγορία της **δεν άλλαξε**: μένει «μην κολυμπήσεις» επειδή την κρίνει ο ΑΝΕΜΟΣ — 23-24
 * χλμ/ώρα με ριπές 46-48 (4 Μποφ.). Ο Μίλτος όμως κοιτάζει ζωντανή κάμερα και βλέπει λάδι.
 * Η βίβλος ονομάζει αυτό «ρίζα Α» και γράφει ρητά ότι **ΔΕΝ έχει μετρηθεί ποτέ**.
 *
 * ΤΙ ΡΩΤΑΕΙ, ΚΑΙ ΤΙ ΔΕΝ ΡΩΤΑΕΙ. Δεν προτείνει διόρθωση. Ρωτάει ένα πράγμα: **το σημείο από το
 * οποίο διαβάζουμε τον άνεμο περιγράφει το νερό της παραλίας;** Τρεις ανεξάρτητοι μάρτυρες για
 * την ίδια ώρα, χωρίς καμία δική μας λογική στη μέση:
 *   Α. το ΣΤΕΡΙΑΝΟ κελί που τρέφει σήμερα την κάρτα (`buildBeachForecastClusters`)
 *   Β. το ΘΑΛΑΣΣΙΝΟ κελί της ίδιας παραλίας (`data/forecast-sea-cells.generated.json`) — ήδη
 *      ζωντανό για τη ΔΙΕΥΘΥΝΣΗ σε 1.845 παραλίες (§Γ42), άρα δεν κοστίζει τίποτα καινούργιο
 *   Γ. ένα σημείο 3 χλμ ΑΝΟΙΧΤΑ στη γωνία που κοιτάει η ακτή — καθαρή θάλασσα, μηδέν τριβή
 * και το υψόμετρο του καθενός, γιατί το §Γ51 έδειξε ότι εκεί κρύβεται η διαφορά.
 *
 * ΕΝΑΣ ΜΑΡΤΥΡΑΣ ΔΕΝ ΑΡΚΕΙ, ΓΙ' ΑΥΤΟ ΤΡΕΧΕΙ ΚΑΙ ΣΕ ΠΑΡΑΛΙΑ-ΕΛΕΓΧΟ. Το Καραβοστάσι #680 έχει
 * ΤΟΝ ΙΔΙΟ άνεμο από την ίδια μεριά και ο Μίλτος το είδε κι αυτό «απάνεμο». Αν το στεριανό κελί
 * φουσκώνει, πρέπει να φουσκώνει και στα δύο· αν φουσκώνει μόνο στη Λυγαριά, τότε φταίει το
 * σημείο της Λυγαριάς και όχι ο μηχανισμός.
 *
 *   node scripts/inspectLygariaWindTruth.mjs
 *
 * Report-only. Δεν αλλάζει τίποτα.
 */
import './lib/paidOpenMeteo.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
      esModuleInterop: true, jsx: ts.JsxEmit.React,
    },
    fileName: filename,
  }).outputText.replace(/import\.meta/g, '({env:{DEV:true}})'), filename);
};

const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const TARGETS = [
  { id: 636, region: 'crete-crete-heraklion', label: 'Λυγαριά (η αναφορά)' },
  { id: 680, region: 'crete-crete-rethymno', label: 'Καραβοστάσι (έλεγχος)' },
];
const HOURS = [12, 14, 15, 16, 17, 18];
const OFFSHORE_KM = 3;

const seaCells = JSON.parse(readFileSync(path.join(root, 'data/forecast-sea-cells.generated.json'), 'utf8'));

const movePoint = (lat, lon, bearingDeg, km) => {
  const dLat = (km / 111.32) * Math.cos((bearingDeg * Math.PI) / 180);
  const dLon = (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.sin((bearingDeg * Math.PI) / 180);
  return { lat: Number((lat + dLat).toFixed(4)), lon: Number((lon + dLon).toFixed(4)) };
};

const fetchPoint = async (lat, lon) => {
  const url = `https://customer-api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + `&hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh`
    + `&timezone=Europe%2FAthens&forecast_days=1&apikey=${process.env.OPEN_METEO_API_KEY}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
};

for (const target of TARGETS) {
  // Ο ΚΑΤΑΛΟΓΟΣ ΤΗΣ ΠΕΡΙΛΗΨΗΣ, όχι ο ωμός: το `buildBeachForecastClusters` διαβάζει
  // `beach.coordinates`, που υπάρχει μόνο εκεί. Ίδια πηγή με την εφαρμογή.
  const list = JSON.parse(readFileSync(
    path.join(root, `public/data/beaches/app/summary/${target.region}.json`), 'utf8')).island.beaches;
  const summaryBeach = list.find(b => b.id === target.id);
  const beach = { ...summaryBeach, lat: summaryBeach.coordinates.lat, lon: summaryBeach.coordinates.lon };
  const profile = JSON.parse(readFileSync(path.join(root, `public/data/geospatial/exposure/${target.region}.json`), 'utf8'))
    .profiles[String(target.id)];

  // Α — ΤΟ ΣΗΜΕΙΟ ΠΟΥ ΤΡΕΦΕΙ ΣΗΜΕΡΑ ΤΗΝ ΚΑΡΤΑ. Ίδια συνάρτηση με την εφαρμογή, όχι αντιγραφή.
  const cluster = buildBeachForecastClusters(list).find(c => c.beachIds.includes(target.id));
  // Β — ΤΟ ΘΑΛΑΣΣΙΝΟ ΚΕΛΙ ΤΗΣ ΙΔΙΑΣ ΠΑΡΑΛΙΑΣ, όπως το ψήνει ήδη ο builder.
  const seaKey = seaCells.cells[String(target.id)];
  const [seaLat, seaLon] = String(seaKey).split('_').map(Number);
  // Γ — ΑΝΟΙΧΤΑ, στη γωνία που κοιτάει η ακτή.
  const open = movePoint(beach.lat, beach.lon, profile.facingDeg, OFFSHORE_KM);

  const points = [
    { tag: 'Α στεριά (κάρτα)', lat: cluster.lat, lon: cluster.lon },
    { tag: 'Β θάλασσα (κελί)', lat: seaLat, lon: seaLon },
    { tag: `Γ ανοιχτά ${OFFSHORE_KM} χλμ`, lat: open.lat, lon: open.lon },
  ];

  console.log(`\n════ #${target.id} ${target.label} — κοιτάει ${profile.facingDeg}° · πινέζα ${beach.lat},${beach.lon}`);
  const data = [];
  for (const p of points) {
    const json = await fetchPoint(p.lat, p.lon);
    data.push({ ...p, json });
    const distKm = Math.round(Math.hypot((p.lat - beach.lat) * 111.32,
      (p.lon - beach.lon) * 111.32 * Math.cos((beach.lat * Math.PI) / 180)) * 10) / 10;
    console.log(`  ${p.tag.padEnd(18)} ${p.lat},${p.lon}  υψόμετρο ${String(json.elevation).padStart(5)} μ.  απόσταση ${distKm} χλμ`);
  }

  console.log(`\n  ώρα │ ${'Α στεριά'.padStart(16)} │ ${'Β θάλασσα'.padStart(16)} │ ${'Γ ανοιχτά'.padStart(16)} │ Α−Β`);
  console.log('  ────┼──────────────────┼──────────────────┼──────────────────┼──────');
  for (const hour of HOURS) {
    const cells = data.map(d => {
      const h = d.json.hourly;
      const idx = h.time.findIndex(t => Number(t.slice(11, 13)) === hour);
      return idx < 0 ? null : {
        speed: Math.round(h.wind_speed_10m[idx]),
        gust: Math.round(h.wind_gusts_10m[idx]),
        dir: Math.round(h.wind_direction_10m[idx]),
      };
    });
    if (cells.some(c => !c)) continue;
    const fmt = c => `${String(c.speed).padStart(3)}/${String(c.gust).padStart(3)} ${String(c.dir).padStart(3)}°`;
    const delta = cells[0].speed - cells[1].speed;
    console.log(`  ${String(hour).padStart(3)} │ ${fmt(cells[0]).padStart(16)} │ ${fmt(cells[1]).padStart(16)} │ ${fmt(cells[2]).padStart(16)} │ ${delta > 0 ? '+' : ''}${delta}`);
  }
}

console.log('\nΔΙΑΒΑΣΜΑ: «ταχύτητα/ριπή διεύθυνση», χλμ/ώρα. Αν το Α είναι ΨΗΛΟΤΕΡΟ από το Β και το Γ,');
console.log('το στεριανό κελί φουσκώνει· αν είναι ΧΑΜΗΛΟΤΕΡΟ, ο άνεμος στο νερό είναι όντως εκεί και');
console.log('η κάμερα δείχνει άλλο σημείο απ᾽ ό,τι νομίζουμε. Καμία διόρθωση δεν προτείνεται από εδώ.');
