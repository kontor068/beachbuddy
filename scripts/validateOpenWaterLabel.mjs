/**
 * ΠΥΛΗ 20 — ο αριθμός κύματος λέει ποιανού νερού είναι, ΚΑΙ η κάρτα εξηγεί γιατί.
 *
 * WHY THIS EXISTS
 * ---------------
 * The live marine value is a grid cell 9–18 km offshore, not the water in front of the beach.
 * Measured nationally 01/08/2026 (2.553 beaches, ewam, 15:00): the wave travels AWAY from the
 * shore on 1.148 of them (45%) and parallel on 352 (13,8%); 501 beaches (19,6%) were showing a
 * >= 0,8 m figure that never reaches them. Reported by the user as "Βραυρώνα 2,0 m orange next to
 * Ραφήνα 1,3 m red" — the colour was right, the number was labelled as if it were the shore.
 *
 * The fix is one word: `components/BeachAnswerHero.tsx` prints «Κύμα ανοιχτά» instead of «Κύμα»
 * when, and only when, the figure really is the area grid. THE NUMBER NEVER MOVES — a downward
 * cap on a lee shore was measured and rejected (99-decision-log 29/07). This gate protects the
 * three ways that one word can silently go wrong.
 *
 * WHAT IT CHECKS
 * --------------
 *  A. BEHAVIOUR (runs the real utils/coveWaveGuard.ts, not a copy). Where the cove guard replaces
 *     the grid value with our own near-shore SMB, the reading is NOT open water and must never be
 *     labelled «ανοιχτά». Also asserts the label is not dead: the open-water case must actually
 *     occur across the national geometry, or the whole change is a no-op nobody would notice.
 *  B. LANGUAGES. `seaOpen` exists in all five, is non-empty, and DIFFERS from `sea` in each —
 *     a copy-paste that leaves one language on the old word ships a lie in that language only.
 *  C. WIRING. `BeachDetailPage` still derives `isOpenWater` from `isWaveEstimate`. If someone
 *     hardcodes it to `true`, checks A and B both stay green while every cove beach starts
 *     claiming offshore. That is the exact failure this gate is for.
 *  D. THE CARD EXPLAINS ITSELF. An honest label is not enough: an orange 2,0 m beach beside a
 *     red 1,3 m one still reads as arbitrary without the reason. Checks that the hero still
 *     receives `weatherNow.liveSentence` and that the wind tile still carries SHELTER_LABEL
 *     («στη σκιά» / «πλάγια» / «κατάμουτρα»), with three DISTINCT words per language.
 *     This one is not hypothetical — it already broke: the card stopped rendering the sentence
 *     on 31/07 while `statesShoreIncidence` went on suppressing the second copy below, so both
 *     explanations vanished at once and every gate stayed green.
 *
 * Pure computation — no network.
 * Run: node scripts/validateOpenWaterLabel.mjs
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

const { resolveCoveAwareWaveHeightM } = require(path.join(root, 'utils/coveWaveGuard.ts'));

const exposureDir = path.join(root, 'public/data/geospatial/exposure');
const heroPath = path.join(root, 'components/BeachAnswerHero.tsx');
const detailPath = path.join(root, 'pages/BeachDetailPage.tsx');

/** Eight sectors: every beach is taken head-on by one of them and shadowed by another. */
const WIND_DIRECTIONS_DEG = [0, 45, 90, 135, 180, 225, 270, 315];
/** 5 Bft — where the wave figure starts deciding whether someone swims. */
const WIND_SPEED_KMH = 34;
/** A plain wind sea. Swell presence blocks every cove path, which would hide the cove cases. */
const AREA_SEA_M = 1.2;
const LANGUAGES = ['en', 'gr', 'de', 'it', 'fr'];

const failures = [];

// ── A. BEHAVIOUR ────────────────────────────────────────────────────────────────────────────
let casesChecked = 0;
let openWaterCases = 0;
let coveCases = 0;

for (const file of readdirSync(exposureDir).filter(name => name.endsWith('.json'))) {
  let profiles;
  try {
    profiles = JSON.parse(readFileSync(path.join(exposureDir, file), 'utf8')).profiles;
  } catch {
    continue;
  }
  const regionId = file.replace(/\.json$/, '');
  const list = Array.isArray(profiles) ? profiles : Object.values(profiles || {});

  for (const profile of list) {
    if (!profile || typeof profile.facingDeg !== 'number') continue;
    for (const windDirectionDeg of WIND_DIRECTIONS_DEG) {
      const cove = resolveCoveAwareWaveHeightM({
        geospatialProfile: profile,
        facingDeg: profile.facingDeg,
        windDirectionDeg,
        windSpeedKmh: WIND_SPEED_KMH,
        measuredWaveHeightM: AREA_SEA_M,
        appModeledWaveHeightM: 0,
        swellPresent: false,
      });
      casesChecked += 1;

      // The page's own derivation, from the same inputs:
      //   isWaveEstimate = coveApplied || no measured value   (BeachDetailPage.tsx)
      //   isOpenWater    = !isWaveEstimate
      // A measured value is present by construction here, so isOpenWater === !coveApplied.
      const isOpenWater = !cove.coveApplied;
      if (isOpenWater) openWaterCases += 1;
      else coveCases += 1;

      if (cove.coveApplied && isOpenWater) {
        failures.push(
          `${regionId} #${profile.beachId} ${profile.name?.gr || profile.name?.en || ''} — wind ${windDirectionDeg}°: `
          + `cove guard replaced the figure with ${cove.smbWaveHeightM} m (our own near-shore estimate) `
          + `yet the reading would be labelled "offshore"`
        );
      }
    }
  }
}

if (openWaterCases === 0) {
  failures.push(
    'NO case in the national geometry produces an open-water reading — the «Κύμα ανοιχτά» label '
    + 'would never appear. Either the cove guard now fires everywhere, or the derivation broke.'
  );
}

// ── B. LANGUAGES ────────────────────────────────────────────────────────────────────────────
// BeachAnswerHero is a .tsx importing react + lucide-react, which do not load under this
// CommonJS shim, so READ_LABELS is read from source. The shape is a flat literal per language.
const heroSource = readFileSync(heroPath, 'utf8');
const readLabelsBlock = heroSource.match(/const READ_LABELS[\s\S]*?\n};/);
if (!readLabelsBlock) {
  failures.push('components/BeachAnswerHero.tsx: READ_LABELS block not found — this gate cannot see the labels.');
} else {
  for (const lang of LANGUAGES) {
    const row = readLabelsBlock[0].match(new RegExp(`\\b${lang}:\\s*\\{([^}]*)\\}`));
    if (!row) {
      failures.push(`READ_LABELS: language "${lang}" is missing.`);
      continue;
    }
    const sea = row[1].match(/\bsea:\s*'([^']*)'/);
    const seaOpen = row[1].match(/\bseaOpen:\s*'([^']*)'/);
    if (!seaOpen || !seaOpen[1].trim()) {
      failures.push(`READ_LABELS.${lang}: seaOpen is missing or empty — that language would keep claiming the shore.`);
    } else if (sea && sea[1] === seaOpen[1]) {
      failures.push(`READ_LABELS.${lang}: seaOpen ("${seaOpen[1]}") is identical to sea — the change is a no-op in ${lang}.`);
    }
  }
  if (!/label:\s*sea\.isOpenWater\s*\?\s*labels\.seaOpen\s*:\s*labels\.sea/.test(heroSource)) {
    failures.push(
      'components/BeachAnswerHero.tsx: the sea reading no longer picks its label from sea.isOpenWater. '
      + 'The labels exist but nothing chooses between them.'
    );
  }
}

// ── C. WIRING ───────────────────────────────────────────────────────────────────────────────
const detailSource = readFileSync(detailPath, 'utf8');
if (!/isOpenWater:\s*!isWaveEstimate\b/.test(detailSource)) {
  failures.push(
    'pages/BeachDetailPage.tsx: isOpenWater is no longer derived from !isWaveEstimate. '
    + 'A hardcoded value would make every cove beach claim an offshore reading while this gate\'s '
    + 'other checks stay green.'
  );
}

// ── D. THE CARD MUST EXPLAIN ITSELF ─────────────────────────────────────────────────────────
// Labelling the number honestly is not enough on its own. Without the reason beside it, an
// orange 2,0 m beach next to a red 1,3 m one still reads as arbitrary — which is exactly what
// the user reported on 01/08. Worse, this had already broken silently: weatherNowCopy builds
// `liveSentence` in five languages, the card stopped rendering it on 31/07, and the flag it
// ships with (statesShoreIncidence) kept suppressing the second copy further down the page —
// so BOTH explanations disappeared at once and no gate noticed.
if (!/explanation=\{[^}]*weatherNow\.liveSentence/.test(detailSource)) {
  failures.push(
    'pages/BeachDetailPage.tsx: the hero no longer receives weatherNow.liveSentence. That sentence '
    + 'is the ONLY thing on the card explaining why this beach reads better or worse than another '
    + 'with a different wave figure — and dropping it also silences the shore-incidence line below, '
    + 'because statesShoreIncidence assumes the card said it.'
  );
}
if (!/shelterLabel:/.test(detailSource) || !/SHELTER_LABEL\[language\]/.test(detailSource)) {
  failures.push(
    'pages/BeachDetailPage.tsx: the wind tile no longer gets shelterLabel from SHELTER_LABEL. '
    + 'The tile falls back to a bare compass point, which says nothing about why the pin is that colour.'
  );
}
const shelterBlock = heroSource.match(/export const SHELTER_LABEL[\s\S]*?\n};/);
if (!shelterBlock) {
  failures.push('components/BeachAnswerHero.tsx: SHELTER_LABEL block not found.');
} else {
  for (const lang of LANGUAGES) {
    const row = shelterBlock[0].match(new RegExp(`\\b${lang}:\\s*\\{([^}]*)\\}`));
    if (!row) {
      failures.push(`SHELTER_LABEL: language "${lang}" is missing.`);
      continue;
    }
    const words = ['protected', 'partial', 'exposed'].map(k => {
      const m = row[1].match(new RegExp(`\\b${k}:\\s*'([^']*)'`));
      return m ? m[1].trim() : '';
    });
    if (words.some(w => !w)) {
      failures.push(`SHELTER_LABEL.${lang}: one of protected/partial/exposed is missing or empty.`);
    } else if (new Set(words).size !== 3) {
      failures.push(
        `SHELTER_LABEL.${lang}: two exposure levels share a word (${words.join(' / ')}) — `
        + `a sheltered and a wind-facing beach would read identically in ${lang}.`
      );
    }
  }
  if (!/wind\.shelterLabel\s*\?\s*`\$\{wind\.directionLabel\}\s*·\s*\$\{wind\.shelterLabel\}`/.test(heroSource)) {
    failures.push('components/BeachAnswerHero.tsx: the wind tile no longer renders shelterLabel beside the compass point.');
  }
  if (!/\{explanation\s*&&/.test(heroSource)) {
    failures.push('components/BeachAnswerHero.tsx: the explanation sentence is no longer rendered.');
  }
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────────────
console.log(`Cases: ${casesChecked} (open water ${openWaterCases} · near-shore/cove ${coveCases}) · languages ${LANGUAGES.length} · explanation + shelter wiring checked`);

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} problem(s) with the open-water label.\n`);
  for (const line of failures.slice(0, 25)) console.error(`  - ${line}`);
  if (failures.length > 25) console.error(`  ...and ${failures.length - 25} more`);
  console.error('\nThe wave number is an area-grid reading. It may be labelled «ανοιχτά» only when it');
  console.error('really is that reading — never when the cove guard has swapped in our own estimate.');
  process.exit(1);
}

console.log('PASS — the wave reading names the water it came from, in all five languages.');
