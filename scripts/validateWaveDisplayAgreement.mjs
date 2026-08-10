/**
 * THE DISPLAYED WAVE MAY NOT CONTRADICT THE SEA THE PAGE DECIDED ON — gate.
 *
 * `BeachScore.waveHeightM` is display-only by doctrine: it is the metre figure the user reads
 * in the verdict chip, the wave meter and the cards. `BeachScore.seaStateWaveM` is the value
 * every score, cap, colour and comfort call in calculateBeachScore actually uses. They are
 * allowed to differ in exactly ONE place — the cove guard (utils/coveWaveGuard), where a
 * genuinely enclosed cove (blocked shore, fetch < 2 km, live wind blowing onto it, no swell)
 * is measured to be calmer than the offshore Open-Meteo cell can see.
 *
 * Anywhere else, a display value BELOW the sea state is a false calm: the page says
 * "Εκτεθειμένη / Choppy" and prints a swimmable-looking number beside it.
 *
 * This gate exists because that is not hypothetical. Reported 29/07/2026 from Ίος: Αγία
 * Θεοδότη (NE-facing, meltemi straight into the bay) showed ~0,5 m while Βάλμας — sheltered
 * from the same wind, on the other side of the same island, reading the SAME marine grid cell
 * — showed ~1,3 m. The wave figure ranked the two beaches backwards.
 *
 * Cause: the enclosed-cove "offshore extension" in services/recommendationService.ts replaced
 * the displayed wave with the fetch-limited SMB estimate for any cove-shaped beach in ANY wind,
 * although its whole justification was an OFFSHORE wind. Measured over the national geometry at
 * 5 Bft: 694 beach x wind-direction cases printed as little as 0,10 m beside a 1,2 m sea state,
 * 545 of them with the wind blowing onto the shore. Nothing failed; the number just quietly lied.
 *
 * Pure computation over the committed geometry — no network.
 *
 * Run: node scripts/validateWaveDisplayAgreement.mjs
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.React,
    },
    fileName: filename,
    // The app modules read import.meta.env; there is no bundler here, so neutralise it.
  }).outputText.replace(/import\.meta/g, '({env:{DEV:false}})');
  module._compile(output, filename);
};

const { calculateBeachScore } = require(path.join(root, 'services/recommendationService.ts'));
const { resolveCoveAwareWaveHeightM, COVE_ONSHORE_MIN } = require(path.join(root, 'utils/coveWaveGuard.ts'));

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const beachDir = path.join(root, 'public/data/beaches/app');

/** Eight sectors: every beach is taken head-on by one of them and shadowed by another. */
const WIND_DIRECTIONS_DEG = [0, 45, 90, 135, 180, 225, 270, 315];
/** 5 Bft — where the wave figure starts deciding whether someone swims. */
const WIND_SPEED_KMH = 34;
/** A plain wind sea, no swell: swell presence blocks every cove path, which would hide the bug. */
const AREA_SEA_M = 1.2;
/** Rounding slack: both numbers are stored to 2 decimals. */
const TOLERANCE_M = 0.05;

const buildWeather = (windDirectionDeg) => ({
  wind: { speed: WIND_SPEED_KMH / 3.6, deg: windDirectionDeg },
  main: { temp: 28 },
  marine: {
    waveHeightM: AREA_SEA_M,
    waveDirectionDeg: windDirectionDeg,
    wavePeriodS: 4.5,
    swellWaveHeightM: 0.2,
    swellWaveDirectionDeg: windDirectionDeg,
    swellWavePeriodS: 5,
    seaSurfaceTemperatureC: 25,
    source: 'open-meteo-marine',
  },
});

const failures = [];
let beachesChecked = 0;
let casesChecked = 0;
let guardedByCove = 0;

for (const file of readdirSync(exposureDir).filter(name => name.endsWith('.json'))) {
  let beaches;
  let profiles;
  try {
    beaches = JSON.parse(readFileSync(path.join(beachDir, file), 'utf8')).island.beaches;
    profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
  } catch {
    // A region with geometry but no app bundle is not this gate's business.
    continue;
  }
  const regionId = file.replace(/\.json$/, '');

  for (const beach of beaches) {
    const profile = profiles?.[String(beach.id)];
    if (!profile) continue;
    beachesChecked += 1;

    for (const windDirectionDeg of WIND_DIRECTIONS_DEG) {
      casesChecked += 1;
      const score = calculateBeachScore(beach, buildWeather(windDirectionDeg), undefined, undefined, {
        geospatialProfile: profile,
        weatherSource: 'island-fallback',
      });
      const shown = score.waveHeightM;
      const decided = score.seaStateWaveM;
      if (typeof shown !== 'number' || typeof decided !== 'number') continue;
      if (shown >= decided - TOLERANCE_M) continue;

      // Geometry for THIS wind, recomputed rather than trusted, so a future refactor cannot
      // claim a guard fired when it did not.
      const guard = resolveCoveAwareWaveHeightM({
        geospatialProfile: profile,
        facingDeg: score.facingDeg ?? null,
        windDirectionDeg,
        windSpeedKmh: WIND_SPEED_KMH,
        measuredWaveHeightM: AREA_SEA_M,
        appModeledWaveHeightM: score.modeledWaveHeightM ?? 0,
        swellPresent: false,
      });

      // An OFFSHORE wind may legitimately leave water the offshore grid cell cannot see, so a
      // lower display figure there is a modelling decision, not a contradiction. The rule this
      // gate enforces is about the other direction: the wind blowing ONTO this shore.
      if (typeof guard.onshore !== 'number' || guard.onshore <= COVE_ONSHORE_MIN) continue;

      // The one sanctioned exception with the wind on the shore: a genuinely enclosed cove
      // (blocked shore, fetch < 2 km) certified against dense re-scans — see utils/coveWaveGuard.
      if (guard.coveApplied) {
        guardedByCove += 1;
        continue;
      }

      failures.push(
        `${regionId} #${beach.id} ${beach.name?.en ?? ''} — wind ${windDirectionDeg}°: `
        + `shows ${shown.toFixed(2)} m beside a ${decided.toFixed(2)} m sea state `
        + `(level ${score.exposureLevel}, onshore ${guard.onshore ?? 'n/a'}, fetch ${guard.fetchKm ?? 'n/a'} km)`
      );
    }
  }
}

console.log(`Wave display agreement: ${beachesChecked} beaches x ${WIND_DIRECTIONS_DEG.length} wind directions = ${casesChecked} cases.`);
console.log(`Onshore-wind cases where the cove guard lowered the displayed wave: ${guardedByCove} (sanctioned).`);

/**
 * ΤΟ ΥΨΟΣ ΣΤΗΝ ΑΚΤΗ ΠΡΕΠΕΙ ΝΑ ΤΑΞΙΔΕΥΕΙ ΜΑΖΙ ΜΕ ΤΟ ΑΝΟΙΧΤΟ ΝΕΡΟ (11/08/2026).
 *
 * Ο πάνω έλεγχος συγκρίνει ΝΟΥΜΕΡΑ και δεν μπορεί να δει τι χάνεται στη ΔΙΑΔΡΟΜΗ. Στις 11/08 οι
 * builders του SuitableBeach αντέγραφαν `waveHeightM` και `seaStateWaveM` αλλά ΞΕΧΝΟΥΣΑΝ το
 * `shoreWaveHeightM`, οπότε η κάρτα του Top 3 έπεφτε στο ανοιχτό νερό (0,3 μ.) ενώ η σελίδα της
 * παραλίας τύπωνε το ύψος στην ακτή (~0,1 μ.) — δύο οθόνες, δύο απαντήσεις, καμία πύλη κόκκινη.
 * Κανόνας: όπου ένα object literal μεταφέρει `seaStateWaveM`, μεταφέρει και `shoreWaveHeightM`.
 */
const CARRIER_FILES = ['App.tsx', 'services/recommendationService.ts', 'components/BeachSearcherHome.tsx'];
for (const relativePath of CARRIER_FILES) {
  const source = readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').split('\n');
  source.forEach((line, index) => {
    if (!/^\s*seaStateWaveM:/.test(line)) return;
    const window = source.slice(Math.max(0, index - 6), index + 7).join('\n');
    if (!/\bshoreWaveHeightM:/.test(window)) {
      failures.push(
        `${relativePath}:${index + 1} carries seaStateWaveM without shoreWaveHeightM — `
        + 'the card will fall back to the open-water figure and disagree with the beach page'
      );
    }
  });
}

if (failures.length > 0) {
  console.error(`\nFAIL — ${failures.length} cases where the wave shown is not the wave decided on (a calmer figure with the wind onto the shore, or a shore height dropped on its way to the card):`);
  failures.slice(0, 25).forEach(line => console.error(`- ${line}`));
  if (failures.length > 25) console.error(`- ...and ${failures.length - 25} more`);
  console.error('\nThe displayed wave may only fall below seaStateWaveM through the cove guard.');
  console.error('Do not widen the guard to make these pass — that is the bug this gate was written for.');
  process.exit(1);
}

console.log('PASS — no beach prints a calmer wave than its own sea state outside the cove guard.');
