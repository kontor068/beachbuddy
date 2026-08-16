#!/usr/bin/env node
/**
 * ΑΠΟ ΤΙ ΦΤΙΑΧΝΕΤΑΙ Ο ΑΡΙΘΜΟΣ ΚΥΜΑΤΟΣ ΜΙΑΣ ΠΑΡΑΛΙΑΣ, ΤΩΡΑ — διάγνωση, όχι πύλη.
 *
 * Σπάει το ύψος που τυπώνουμε στα συστατικά του (κύμα ανέμου / αποθαλασσιά), δίπλα στη
 * γεωμετρία του ζωντανού τομέα και στον συντελεστή αποτομότητας, ώστε ένα «δεν φαίνεται τέτοιο
 * κύμα στην κάμερα» να απαντιέται με νούμερα αντί με εικασία.
 *
 *   node scripts/inspectBeachSeaNow.mjs 595 [ώρα]
 *
 * Το πληρωμένο κλειδί έρχεται από το Netlify και ΔΕΝ γράφεται πουθενά.
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

const waveCharacter = require(path.join(root, 'utils/waveCharacter.ts'));
const waveModel = require(path.join(root, 'utils/waveModel.ts'));
const windExposure = require(path.join(root, 'utils/windExposure.ts'));
const { buildBeachForecastClusters } = require(path.join(root, 'utils/beachForecastClusters.ts'));

const wantedId = Number(process.argv[2] || 595);
const wantedHour = process.argv[3] !== undefined ? Number(process.argv[3]) : new Date().getHours();

const token = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^\s*NETLIFY_AUTH_TOKEN\s*=\s*(.+)\s*$/m) || [])[1]?.trim();
const siteId = JSON.parse(fs.readFileSync(path.join(root, '.netlify/state.json'), 'utf8')).siteId;
const envRes = await fetch(`https://api.netlify.com/api/v1/accounts/-/env/OPEN_METEO_API_KEY?site_id=${siteId}`,
  { headers: { Authorization: `Bearer ${token}` } });
const API_KEY = ((await envRes.json()).values || []).map(v => v.value).find(Boolean);
if (!API_KEY) { console.error('χωρίς κλειδί'); process.exit(1); }

const summaryDir = path.join(root, 'public/data/beaches/app/summary');
const exposureDir = path.join(root, 'public/data/geospatial/exposure');
let found = null;
for (const file of fs.readdirSync(summaryDir)) {
  if (!file.endsWith('.json')) continue;
  const list = JSON.parse(fs.readFileSync(path.join(summaryDir, file), 'utf8')).island?.beaches;
  const beach = Array.isArray(list) && list.find(b => b.id === wantedId);
  if (!beach) continue;
  const profile = JSON.parse(fs.readFileSync(path.join(exposureDir, file), 'utf8')).profiles?.[String(wantedId)];
  const cluster = buildBeachForecastClusters(list).find(c => c.beachIds.includes(wantedId));
  found = { beach, profile, cluster, region: file.replace('.json', '') };
  break;
}
if (!found) { console.error('δεν βρέθηκε η παραλία', wantedId); process.exit(1); }

const { beach, profile, cluster } = found;
const name = typeof beach.name === 'string' ? beach.name : (beach.name?.gr || beach.name?.en);

const wind = await (await fetch(`https://customer-api.open-meteo.com/v1/forecast?latitude=${cluster.lat}`
  + `&longitude=${cluster.lon}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms`
  + `&timezone=Europe%2FAthens&forecast_days=1&apikey=${encodeURIComponent(API_KEY)}`)).json();

const mp = profile.marineSamplePoint;
const sea = await (await fetch(`https://customer-marine-api.open-meteo.com/v1/marine?latitude=${mp.lat}`
  + `&longitude=${mp.lon}&hourly=wave_height,wave_period,wave_direction,wind_wave_height,wind_wave_period,`
  + `swell_wave_height,swell_wave_period,swell_wave_direction&timezone=Europe%2FAthens&forecast_days=1`
  + `&cell_selection=sea&apikey=${encodeURIComponent(API_KEY)}`)).json();

const h = wantedHour;
const speedKmh = wind.hourly.wind_speed_10m[h] * 3.6;
const dirDeg = wind.hourly.wind_direction_10m[h];
const sectorKey = windExposure.windSectorFromDegrees(dirDeg);
const sector = profile.sectors?.[sectorKey];

console.log(`\n#${wantedId} ${name} — ${found.region}, ώρα ${h}:00`);
console.log(`κοιτάει ${profile.facingDeg}° · εμπιστοσύνη ${profile.confidence}`);
console.log(`\nΑΝΕΜΟΣ (σημείο ${cluster.lat.toFixed(4)}/${cluster.lon.toFixed(4)}, κελί ${wind.latitude}/${wind.longitude}, υψόμ. ${wind.elevation} μ.)`);
console.log(`  ${speedKmh.toFixed(1)} χλμ/ώ · ριπές ${(wind.hourly.wind_gusts_10m[h] * 3.6).toFixed(0)} · από ${Math.round(dirDeg)}° (τομέας ${sectorKey})`);
if (sector) {
  console.log(`  γεωμετρία τομέα: ${sector.level} · άνοιγμα ${sector.fetchKm} χλμ · onshore ${sector.onshore} · φραγμένες ακτίνες ${sector.blockedRayRatio} · ένταση ${sector.intensity}`);
  const smb = waveModel.estimateFetchLimitedWaveHeightM({ windSpeedKmh: speedKmh, fetchKm: sector.fetchKm });
  console.log(`  ΤΟ ΔΙΚΟ ΜΑΣ ΜΟΝΤΕΛΟ ΑΚΤΗΣ (SMB) θα έδινε: ${typeof smb === 'number' ? smb.toFixed(2) : smb} μ.`);
}

console.log(`\nΘΑΛΑΣΣΑ (σημείο ${mp.lat}/${mp.lon}, ${mp.distanceKm} χλμ στις ${mp.bearingDeg}°, κελί ${sea.latitude}/${sea.longitude})`);
console.log(`  συνολικό ύψος   ${sea.hourly.wave_height[h]} μ. · περίοδος ${sea.hourly.wave_period[h]} δευτ. · από ${sea.hourly.wave_direction[h]}°`);
console.log(`  από τον άνεμο   ${sea.hourly.wind_wave_height[h]} μ. · περίοδος ${sea.hourly.wind_wave_period[h]} δευτ.`);
console.log(`  αποθαλασσιά     ${sea.hourly.swell_wave_height[h]} μ. · περίοδος ${sea.hourly.swell_wave_period[h]} δευτ. · από ${sea.hourly.swell_wave_direction[h]}°`);

const onshoreOf = deg => Math.cos((deg - profile.facingDeg) * Math.PI / 180);
console.log(`\nΕΡΧΕΤΑΙ ΠΡΟΣ ΤΗΝ ΑΚΤΗ; (θετικό = ναι, αρνητικό = φεύγει)`);
console.log(`  κύμα        onshore ${onshoreOf(sea.hourly.wave_direction[h]).toFixed(3)}`);
console.log(`  αποθαλασσιά onshore ${onshoreOf(sea.hourly.swell_wave_direction[h]).toFixed(3)}`);

const period = sea.hourly.wave_period[h];
const height = sea.hourly.wave_height[h];
const character = waveCharacter.describeWaveCharacter
  ? waveCharacter.describeWaveCharacter({ waveHeightM: height, wavePeriodS: period })
  : null;
console.log(`\nΑΠΟΤΟΜΟΤΗΤΑ (εκθέτης ${waveCharacter.CHOP_EXPONENT ?? '0.75'})`);
console.log(`  περίοδος ${period} δευτ. · αναφορά 4 δευτ. -> συντελεστής ${period >= 4 ? '1,00 (ΔΕΝ αλλάζει τίποτα)' : ((4 / period) ** 0.75).toFixed(3)}`);
if (character) console.log(`  ισοδύναμο ύψος: ${JSON.stringify(character)}`);
