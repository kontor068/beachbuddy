#!/usr/bin/env node
/**
 * ΠΟΣΟ ΧΑΜΗΛΑ ΔΙΑΒΑΖΟΥΜΕ ΤΟΝ ΑΝΕΜΟ ΤΗΣ ΑΚΤΗΣ — ΚΑΙ ΤΙ ΚΑΝΕΙ ΑΥΤΟ ΣΤΟ ΚΥΜΑ.
 *
 * Αφορμή: Τυρός Αρκαδίας 18/08/2026 13:48. Ζωντανή κάμερα με ορατό κυματάκι και αέρα, η κάρτα
 * έλεγε «2 Μπφ | ~0,1 μ.». Το 0,1 ΔΕΝ ήρθε από μοντέλο κύματος — ήρθε από τον δικό μας άνεμο:
 * το εμφανιζόμενο ύψος είναι max(μετρημένο, SMB(άνεμος, fetch)), το μετρημένο ήταν 0,04 μ., άρα
 * ό,τι βλέπει ο επισκέπτης είναι συνάρτηση ΜΟΝΟ του ανέμου. Λάθος άνεμος = λάθος και τα δύο
 * νούμερα, μαζί, προς την επικίνδυνη κατεύθυνση.
 *
 * Τι συγκρίνει, ανά παραλία:
 *   (α) τον άνεμο του κελιού που διαβάζει η εφαρμογή (default cell_selection=land)
 *   (β) τον ίδιο άνεμο πάνω από το νερό (cell_selection=sea)
 *   (γ) το εύρος πέντε μοντέλων στην ακτή — πόσο μακριά είναι η χαμηλότερη από την ψηλότερη
 *   (δ) το κύμα που θα έβγαζε το ΔΙΚΟ ΜΑΣ SMB σε καθεμιά από αυτές τις ταχύτητες
 *
 * ΔΕΝ αλλάζει τίποτα. Γράφει reports/weather/shore-vs-cell-wind-<ημερομηνία>.json.
 *
 *   node scripts/auditShoreVsCellWind.mjs 1505 1509 1520
 *   node scripts/auditShoreVsCellWind.mjs --region peloponnese-arkadia-mainland
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
  }).outputText, filename);
};
const { estimateFetchLimitedWaveHeightM } = require(path.join(root, 'utils/waveModel.ts'));

/** Τα μοντέλα που ρωτάμε στην ακτή. Το best_match είναι αυτό που δείχνει η εφαρμογή. */
const MODELS = ['best_match', 'ecmwf_ifs025', 'gfs_seamless', 'icon_seamless', 'meteofrance_seamless', 'ukmo_seamless'];
const BEACH_DIR = path.join(root, 'public/data/beaches');
const EXPOSURE_DIR = path.join(root, 'public/data/geospatial/exposure');
const OUT_DIR = path.join(root, 'reports/weather');

const beaufort = kmh => {
  const ms = kmh / 3.6;
  return [0.5, 1.5, 3.3, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7].filter(l => ms > l).length;
};

const get = async (url, tries = 4) => {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      const json = await res.json();
      if (json?.error) throw new Error(json.reason || 'open-meteo error');
      return json;
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise(r => setTimeout(r, 4000 * (i + 1)));
    }
  }
};

const loadRegions = () => fs.readdirSync(BEACH_DIR)
  .filter(f => f.endsWith('.json'))
  .map(f => ({ region: f.replace(/\.json$/, ''), beaches: JSON.parse(fs.readFileSync(path.join(BEACH_DIR, f), 'utf8')) }));

const args = process.argv.slice(2);
const regionArg = args.includes('--region') ? args[args.indexOf('--region') + 1] : null;
const ids = args.filter(a => /^\d+$/.test(a)).map(Number);

const wanted = [];
for (const { region, beaches } of loadRegions()) {
  const list = Array.isArray(beaches) ? beaches : beaches.beaches || [];
  for (const b of list) {
    if (regionArg ? region === regionArg : ids.includes(b.id)) wanted.push({ ...b, regionFile: region });
  }
}
if (!wanted.length) {
  console.error('Καμία παραλία. Δώσε ids ή --region <αρχείο>.');
  process.exit(1);
}

/** Το μεγαλύτερο fetch σε ΟΠΟΙΟΝΔΗΠΟΤΕ τομέα — αυτό τροφοδοτεί το εμφανιζόμενο SMB. */
const maxFetchFor = beach => {
  const file = path.join(EXPOSURE_DIR, `${beach.regionFile}.json`);
  if (!fs.existsSync(file)) return null;
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'))?.profiles?.[String(beach.id)];
  if (!profile?.sectors) return null;
  return Math.max(...Object.values(profile.sectors).map(s => s.fetchKm ?? 0));
};

const rows = [];
for (const beach of wanted) {
  const coords = `latitude=${beach.lat}&longitude=${beach.lon}`;
  const hourly = 'hourly=wind_speed_10m,wind_gusts_10m,wind_direction_10m';
  const base = `https://api.open-meteo.com/v1/forecast?${coords}&${hourly}&forecast_days=1&timezone=Europe%2FAthens`;

  // (α) ακριβώς όπως ρωτάει η εφαρμογή — καμία παράμετρος κελιού
  const app = await get(base);
  // (β)+(γ) η ίδια στιγμή πάνω από το νερό, με όλα τα μοντέλα
  const shore = await get(`${base}&cell_selection=sea&models=${MODELS.join(',')}`);

  const fetchKm = maxFetchFor(beach);
  const hours = app.hourly.time.map((t, i) => {
    const appKmh = app.hourly.wind_speed_10m[i];
    const perModel = {};
    for (const m of MODELS) {
      const v = shore.hourly[`wind_speed_10m_${m}`]?.[i];
      if (v != null) perModel[m] = v;
    }
    const values = Object.values(perModel);
    const smb = kmh => (fetchKm == null || kmh == null ? null
      : Number(estimateFetchLimitedWaveHeightM({ windSpeedKmh: kmh, fetchKm }).toFixed(2)));
    return {
      time: t,
      appKmh,
      appBft: beaufort(appKmh),
      appGustKmh: app.hourly.wind_gusts_10m[i],
      appDirDeg: app.hourly.wind_direction_10m[i],
      shorePerModel: perModel,
      shoreMinKmh: values.length ? Math.min(...values) : null,
      shoreMaxKmh: values.length ? Math.max(...values) : null,
      bftSpread: values.length ? beaufort(Math.max(...values)) - beaufort(Math.min(...values)) : null,
      waveFromAppWindM: smb(appKmh),
      waveFromShoreMaxM: values.length ? smb(Math.max(...values)) : null,
    };
  });

  const worst = hours.reduce((a, h) => (
    (h.waveFromShoreMaxM ?? 0) - (h.waveFromAppWindM ?? 0) > (a.waveFromShoreMaxM ?? 0) - (a.waveFromAppWindM ?? 0) ? h : a
  ), hours[0]);

  rows.push({
    beachId: beach.id,
    name: beach.name,
    region: beach.regionFile,
    coordinates: { lat: beach.lat, lon: beach.lon },
    appCell: `${app.latitude}_${app.longitude}`,
    appCellDistanceKm: Number(Math.hypot((app.latitude - beach.lat) * 111,
      (app.longitude - beach.lon) * 111 * Math.cos(beach.lat * Math.PI / 180)).toFixed(2)),
    maxFetchKm: fetchKm,
    worstHour: worst,
    hours,
  });
  console.log(`${beach.id} ${beach.name} — κελί ${rows.at(-1).appCellDistanceKm} χλμ μακριά · `
    + `χειρότερη ώρα ${worst.time.slice(11, 16)}: εμείς ${worst.appKmh} km/h (${worst.appBft}Μπφ) / `
    + `${worst.waveFromAppWindM} μ., ακτή έως ${worst.shoreMaxKmh} km/h / ${worst.waveFromShoreMaxM} μ.`);
  await new Promise(r => setTimeout(r, 700));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
const out = path.join(OUT_DIR, `shore-vs-cell-wind-${stamp}.json`);
fs.writeFileSync(out, JSON.stringify({
  generatedAt: new Date().toISOString(),
  note: 'Το εμφανιζόμενο ύψος κύματος είναι max(μετρημένο, SMB(άνεμος, μέγιστο fetch)). Όταν το '
    + 'μετρημένο είναι ~0, το νούμερο της κάρτας είναι καθαρή συνάρτηση του ανέμου που διαβάζουμε.',
  models: MODELS,
  beaches: rows,
}, null, 2), 'utf8');
console.log(`\nΓράφτηκε ${path.relative(root, out)}`);
