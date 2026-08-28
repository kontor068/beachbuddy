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
 *     («απάνεμη» / «πλάγια» / «κατάμουτρα»), with three DISTINCT words per language.
 *     This one is not hypothetical — it already broke: the card stopped rendering the sentence
 *     on 31/07 while `statesShoreIncidence` went on suppressing the second copy below, so both
 *     explanations vanished at once and every gate stayed green.
 *     Since 14/08 it also guards the STRONG-WIND form: «απάνεμη» promises stillness, so above
 *     5 Bft the protected shore says «από πίσω» instead — a distinct word per language, plus
 *     the Beaufort ceiling that selects it. Dropping either half silently restores a tile that
 *     reads «6 Μπφ · Β · απάνεμη», which is what a visitor reported on Φυριπλάκα (id 1927).
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
  // THREE LABELS SINCE 05/08/2026, and the choice between them is still one expression.
  //
  // The tile used to answer one question — "is this number the area grid or our own estimate?" —
  // with `sea.isOpenWater ? seaOpen : sea`. It now answers a prior one first: "do we have a
  // separate reading for the water AT THE SHORE?" (utils/shoreWave). Where we do, the shore
  // figure leads under «Κύμα στην ακτή» and the open-water one is demoted into the hint rather
  // than dropped, so both numbers stay on screen and each still names where it was taken.
  //
  // This assertion is deliberately NOT relaxed to "some label is chosen": it pins the shape of
  // the whole three-way decision. The failure it exists to prevent — a grid reading wearing a
  // near-shore label — is now reachable two ways instead of one, so it checks both branches.
  //
  // ΕΝΗΜΕΡΩΘΗΚΕ 14/08/2026: ο τίτλος της περίπτωσης «ηγείται η ακτή» έγινε το σκέτο `labels.sea`
  // («Κύμα») αντί για `shoreCopy.atShore` («Κύμα στην ακτή»), για να χωρέσει ο αριθμός του
  // ανοιχτού στον υπότιτλο χωρίς να κοπεί. Ο ΟΥΣΙΩΔΗΣ όρος δεν χαλάρωσε καθόλου: το
  // `labels.seaOpen` («… ανοιχτά») επιτρέπεται ΜΟΝΟ στον κλάδο `sea.isOpenWater`, ποτέ όταν
  // ηγείται η ακτή. Αυτό ακριβώς πινάρει το regex — και δοκιμάστηκε ανάποδα.
  if (!/label:\s*shoreLeads\s*\?\s*labels\.sea\s*:\s*\(\s*sea\.isOpenWater\s*\?\s*labels\.seaOpen\s*:\s*labels\.sea\s*\)/.test(heroSource)) {
    failures.push(
      'components/BeachAnswerHero.tsx: the sea reading no longer picks its label from shoreLeads / sea.isOpenWater. '
      + 'The labels exist but nothing chooses between them.'
    );
  }
  // The shore label may only lead when a shore FIGURE exists — a label without its own number
  // would silently rebrand the open-water reading as the water at the beach, which is precisely
  // the lie this gate was written to stop.
  //
  // ⚠️ 13/08/2026, ΒΡΑΔΥ — ΔΕΥΤΕΡΟΣ ΟΡΟΣ. Το ύψος στην ακτή υπάρχει πλέον για ΚΑΘΕ παραλία (§Γ5),
  // και στις 2.104 από τις 2.854 είναι ΑΡΙΘΜΗΤΙΚΑ ΙΔΙΟ με το ανοιχτό. Με μόνο τον πρώτο όρο, το
  // πλακίδιο τύπωνε «~0,6 μ.» με υπότιτλο «… · 0,6 μ. ανοιχτά» — το ίδιο νούμερο δύο φορές, και
  // ένα «~» πάνω σε μέτρηση. Ο τίτλος «Κύμα στην ακτή» και ο υπότιτλος του ανοιχτού μπαίνουν πλέον
  // μόνο όταν τα δύο νούμερα ΔΙΑΦΕΡΟΥΝ, δηλαδή όταν υπάρχει όντως δεύτερη ανάγνωση να ειπωθεί.
  if (!/const shoreLeads = typeof sea\.shoreHeightM === 'number' && Number\.isFinite\(sea\.shoreHeightM\)/.test(heroSource)) {
    failures.push(
      'components/BeachAnswerHero.tsx: `shoreLeads` no longer requires a finite sea.shoreHeightM. '
      + 'The «at the shore» label must never sit above the open-water number.'
    );
  }
  if (!/const shoreLeads =[\s\S]{0,220}?Math\.abs\([\s\S]{0,60}?sea\.heightM\)\s*>=\s*0\.05/.test(heroSource)) {
    failures.push(
      'components/BeachAnswerHero.tsx: `shoreLeads` no longer requires the two figures to DIFFER. '
      + 'On the ~74% of beaches where the shore reading equals the open-water measurement, the tile '
      + 'would print the same number twice and mark a measurement with a «~».'
    );
  }
  // And the open-water number must survive into the hint whenever the shore figure takes the
  // headline: it is the reading the drift warning rests on (the wind pushing a float off this
  // shore is pushing it toward exactly that sea), so it may be demoted but never removed.
  if (!/shoreCopy\.offshore\(metres\(sea\.heightM\)\)/.test(heroSource)) {
    failures.push(
      'components/BeachAnswerHero.tsx: the open-water figure is no longer shown beside the shore one. '
      + 'Demoting it to the hint is allowed; dropping it is not.'
    );
  }

  // ⚠️ ΚΑΙ ΤΙΠΟΤΑ ΔΕΝ ΜΠΑΙΝΕΙ ΜΠΡΟΣΤΑ ΤΟΥ (14/08/2026).
  //
  // «Μένει στην οθόνη» και «χωράει στην οθόνη» είναι δύο πράγματα, και η διαφορά κόστισε ήδη μία
  // φορά: ο υπότιτλος ήταν `${sea.label} · ${offshore(...)}` = «Έντονος κυματισμός · 0,7 μ.
  // ανοιχτά», 35 χαρακτήρες σε πλακίδιο ~66 px με γραμματοσειρά 8 px. Το `line-clamp-2` έκοβε
  // ΝΟΜΙΜΑ τη δεύτερη ανάγνωση έξω από το πλακίδιο — ο χρήστης έβλεπε «Έντονος κυματισμός…» και
  // ο αριθμός του ανοιχτού δεν υπήρχε πουθενά στην οθόνη.
  //
  // Καμία πύλη δεν το έπιασε: ο έλεγχος πλάτους ρωτάει «κόβεται ΛΕΞΗ;» και εδώ δεν κοβόταν λέξη —
  // κοβόταν ολόκληρη πρόταση, κανονικά, με clamp. Ο έλεγχος από πάνω ρωτάει «υπάρχει ο αριθμός
  // στον κώδικα;» και υπήρχε. Η ερώτηση που έλειπε είναι «είναι ΜΟΝΟΣ του, ώστε να χωράει;».
  //
  // Άρα: όταν ηγείται ο αριθμός της ακτής, ο υπότιτλος είναι ΜΟΝΟ ο αριθμός του ανοιχτού.
  // Ο χαρακτηρισμός της θάλασσας έχει τη θέση του στο μπλοκ της ετυμηγορίας, όχι εδώ.
  const seaHintBranch = heroSource.match(/hint:\s*shoreLeads[\s\S]{0,220}?:\s*sea\.label,/);
  if (!seaHintBranch) {
    failures.push('components/BeachAnswerHero.tsx: the sea tile hint branch was not found — it cannot be checked.');
  } else if (/\$\{sea\.label\}|sea\.label\s*\}\s*·|`\$\{[^`]*\}\s*·/.test(seaHintBranch[0])) {
    failures.push(
      'components/BeachAnswerHero.tsx: the sea tile hint puts something IN FRONT of the open-water '
      + 'figure again. At ~66px with an 8px font and line-clamp-2 the extra words push the number '
      + 'off the tile, and the reader is left with «Έντονος κυματισμός…» and no second reading — '
      + 'which is the §7δ condition broken by width instead of by design.'
    );
  }

  // The five languages must carry the new pair too — same rule as seaOpen above, same reason.
  const shoreLabelsBlock = heroSource.match(/const SHORE_LABELS[\s\S]*?\n\};/);
  if (!shoreLabelsBlock) {
    failures.push('components/BeachAnswerHero.tsx: SHORE_LABELS block not found.');
  } else {
    for (const lang of ['en', 'gr', 'de', 'it', 'fr']) {
      // ⚠️ Η ΓΡΑΜΜΗ ΔΙΑΒΑΖΕΤΑΙ ΜΕΧΡΙ ΤΟ ΤΕΛΟΣ ΤΗΣ, ΟΧΙ ΜΕΧΡΙ ΤΟ ΠΡΩΤΟ «}» (13/08/2026). Το
      // παλιό `[^}]*` έκοβε τη γραμμή στο πρώτο κλείσιμο — και μόλις μπήκε το `atShoreInline`, που
      // είναι template literal και περιέχει `}`, η πύλη ανέφερε ότι ΛΕΙΠΕΙ το `offshore` σε
      // ΚΑΙ ΤΙΣ ΠΕΝΤΕ γλώσσες ενώ ήταν όλα εκεί. Ένα ψευδώς κόκκινο δίχτυ είναι ένα σκαλί πριν
      // από ένα χαλαρωμένο δίχτυ: η επόμενη κίνηση κάποιου θα ήταν να σβήσει τον έλεγχο.
      const row = shoreLabelsBlock[0].match(new RegExp(`\\n\\s*${lang}:\\s*\\{(.*)\\},?\\s*\\n`));
      if (!row) {
        failures.push(`SHORE_LABELS: language "${lang}" is missing.`);
        continue;
      }
      const atShore = row[1].match(/\batShore:\s*'([^']*)'/);
      if (!atShore || !atShore[1].trim()) {
        failures.push(`SHORE_LABELS.${lang}: atShore is missing or empty — that language would print a bare number.`);
      }
      if (!/offshore:\s*\(v\)\s*=>/.test(row[1])) {
        failures.push(`SHORE_LABELS.${lang}: offshore note is missing — the open-water figure would lose its name.`);
      }
    }
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
// WIDENED 05/08/2026, WITHOUT WEAKENING. The prop stopped being an inline ternary when the
// calm-day verdict was added: one named value now decides what the slot holds, so the styling
// beside it cannot drift. The gate follows the value instead of the literal — it must still be
// impossible to render the hero without the live sentence reaching it. Both links are checked:
// `heroLiveSentence` is built from weatherNow.liveSentence, AND it is what feeds `explanation`.
const heroSentenceWired = /const heroLiveSentence[^;]*weatherNow\.liveSentence/s.test(detailSource)
  && /const heroExplanation\s*=\s*heroLiveSentence/.test(detailSource)
  && /explanation=\{heroExplanation\}/.test(detailSource);
if (!heroSentenceWired && !/explanation=\{[^}]*weatherNow\.liveSentence/.test(detailSource)) {
  failures.push(
    'pages/BeachDetailPage.tsx: the hero no longer receives weatherNow.liveSentence. That sentence '
    + 'is the ONLY thing on the card explaining why this beach reads better or worse than another '
    + 'with a different wave figure — and dropping it also silences the shore-incidence line below, '
    + 'because statesShoreIncidence assumes the card said it.'
  );
}
// The scale has to be APPLIED, not merely spelled: a vocabulary with no call site ships the
// original «4–5 Μπφ · Β · απάνεμη» screen (Λέσβος, 28/08/2026). And the ceiling on the words
// that promise calm has to stay at 3 — at 4 it would be the same screen again.
for (const key of ['windFeltSome', 'windFeltLot']) {
  if (!new RegExp(`shelterCopy\\.${key}`).test(detailSource)) {
    failures.push(
      `pages/BeachDetailPage.tsx: the wind tile no longer uses SHELTER_LABEL.${key}. At 4-5 Bft it `
      + 'would go back to promising «απάνεμη» beside a printed 4–5 Μπφ and a card saying «Αρκετός αέρας».'
    );
  }
}
if (!/export const SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT\s*=\s*3\b/.test(heroSource)) {
  failures.push(
    'components/BeachAnswerHero.tsx: SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT is gone or no longer 3. '
    + 'It is what keeps «απάνεμη» / «αεράκι» off a tile printing 4 Bft or more.'
  );
}
if (!/SHELTER_WORD_CALM_PROMISE_MAX_BEAUFORT/.test(detailSource)) {
  failures.push(
    'pages/BeachDetailPage.tsx: the calm-promise ceiling is no longer applied to the shelter word.'
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
    // The strong-wind form of "protected". Must exist and must NOT be the shelter word itself,
    // otherwise the ceiling below is wired to a no-op and «6 Μπφ · απάνεμη» returns.
    const strongWind = (row[1].match(/\bprotectedStrongWind:\s*'([^']*)'/) || [, ''])[1].trim();
    if (!strongWind) {
      failures.push(
        `SHELTER_LABEL.${lang}: protectedStrongWind is missing. Above ${'5'} Bft a protected shore `
        + 'must state the wind angle, not promise shelter it cannot deliver.'
      );
    } else if (strongWind === words[0]) {
      failures.push(
        `SHELTER_LABEL.${lang}: protectedStrongWind repeats the shelter word ("${strongWind}") — `
        + 'the Beaufort ceiling then changes nothing and the tile still reads "sheltered" at 6 Bft.'
      );
    }
    // The 4-5 Bft rungs (28/08/2026, Λέσβος). The tile must speak the SAME scale as the list
    // card — «Αρκετός αέρας» → «φυσάει αρκετά», «Πολύς αέρας» → «φυσάει πολύ» — so a visitor
    // who tapped a card cannot read "it blows" outside and "no wind" inside. Each rung must
    // exist, must be distinct from the other rungs, and must never BE one of the two words
    // that promise calm; otherwise «4–5 Μπφ · Β · απάνεμη» comes straight back.
    const some = (row[1].match(/\bwindFeltSome:\s*'([^']*)'/) || [, ''])[1].trim();
    const lot = (row[1].match(/\bwindFeltLot:\s*'([^']*)'/) || [, ''])[1].trim();
    for (const [key, word] of [['windFeltSome', some], ['windFeltLot', lot]]) {
      if (!word) {
        failures.push(
          `SHELTER_LABEL.${lang}: ${key} is missing. From 4 Bft the tile states how much wind is `
          + 'felt, in the same scale the list card uses — it may not fall back on a shelter promise.'
        );
      } else if (words.includes(word)) {
        failures.push(
          `SHELTER_LABEL.${lang}: ${key} repeats a geometry word ("${word}") — above 3 Bft the tile `
          + 'states how much wind is felt, never the angle: "sheltered" beside a printed 4–5 Bft is '
          + 'the Λέσβος screen again, and "head-on" is a third scale beside the number and the colour.'
        );
      }
    }
    const rungs = [some, lot, strongWind].filter(Boolean);
    if (rungs.length === 3 && new Set(rungs).size !== 3) {
      failures.push(
        `SHELTER_LABEL.${lang}: two of the three wind rungs share a word (${rungs.join(' / ')}) — `
        + '4, 5 and 6+ Bft would read identically in the tile.'
      );
    }
  }
  // The ceiling itself, and the fact that the page applies it. Both halves are load-bearing:
  // a vocabulary with no gate, or a gate with no vocabulary, ships the original bug.
  if (!/export const SHELTER_WORD_MAX_BEAUFORT\s*=\s*5\b/.test(heroSource)) {
    failures.push(
      'components/BeachAnswerHero.tsx: SHELTER_WORD_MAX_BEAUFORT is gone or no longer 5. It must '
      + 'track RELIEF_MAX_BEAUFORT (utils/conditionsFeelPhrase.ts) — same wind, same honesty.'
    );
  }
  // 27/08/2026: the ceiling reads printedBeaufortMax, not beaufortLevel — the gust RANGE
  // («5–6 Μπφ», utils/beaufortRange) put a 6 on the tile while the ceiling only saw the 5
  // (Γάνεμα #2078). The gate therefore demands BOTH halves: the ceiling compares the
  // printed maximum, and that maximum is derived from beaufortLevel and beaufortHigh —
  // otherwise a refactor could rename the variable and quietly compare something calmer.
  if (!/printedBeaufortMax\s*>\s*SHELTER_WORD_MAX_BEAUFORT/.test(detailSource)
    || !/printedBeaufortMax\s*=\s*Math\.max\(\s*beaufortLevel\s*,\s*beaufortHigh\s*\?\?\s*beaufortLevel\s*\)/.test(detailSource)
    || !/protectedStrongWind/.test(detailSource)) {
    failures.push(
      'pages/BeachDetailPage.tsx: the wind tile no longer swaps to protectedStrongWind above '
      + 'SHELTER_WORD_MAX_BEAUFORT judged on the PRINTED maximum (max of beaufortLevel and '
      + 'beaufortHigh). At a printed 6 a north-facing-away beach would read «Β · απάνεμη» '
      + 'again — geometrically true, but it tells the visitor there is no wind while there is.'
    );
  }
  if (!/wind\.shelterLabel\s*\?\s*`\$\{wind\.directionLabel\}\s*·\s*\$\{wind\.shelterLabel\}`/.test(heroSource)) {
    failures.push('components/BeachAnswerHero.tsx: the wind tile no longer renders shelterLabel beside the compass point.');
  }
  if (!/\{explanation\s*&&/.test(heroSource)) {
    failures.push('components/BeachAnswerHero.tsx: the explanation sentence is no longer rendered.');
  }
}

// ── E. THE PODIUM CARD MUST DRAW THE WORD, NOT MERELY CARRY IT ──────────────────────────────
// ADDED 13/08/2026, from a user report: Παραλία Μαραθώνα printed «1,5 μ.» on the podium card in a
// 6 Bft northerly, and Σχινιάς 4 km away printed «~0,1 μ.» the same minute. Both numbers were
// correct — the first is the grid cell 10 km offshore, the second our shore model — but the card
// said nothing about which water it meant, so the pair read as a contradiction.
//
// The word was NOT missing from the code. `cardWaveLabel` was computed correctly and handed to
// `title` (a tooltip, which does not exist on touch) and to `aria-label` (screen readers only).
// The rendered span printed `item.text` and nothing else. So on the 86% of visits that arrive on
// a phone the label had never once been drawn.
//
// This is the 11/08 lesson one step further on. That day the failure was a field that never
// REACHED the card, and the answer was to check the source rather than compare values. Here the
// value reached the card and its NAME was not painted — which value comparison cannot see either.
// Hence a source check on the two links that must both hold: the visible string is built from
// SHORE_LABELS.offshore, and the visible string is the one handed to `text`.
//
// ⚠️ 13/08/2026, ΒΡΑΔΥ — Η ΑΠΑΙΤΗΣΗ ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ ΑΠΟ ΙΣΧΥΡΟΤΕΡΗ, ΔΕΝ ΣΒΗΣΤΗΚΕ.
//
// Μέχρι σήμερα το ζητούμενο ήταν «η κάρτα, όταν δείχνει τη θάλασσα του ανοιχτού, να το γράφει».
// Τώρα η κάρτα ΔΕΝ ΔΕΙΧΝΕΙ ΠΟΤΕ τη θάλασσα του ανοιχτού — δείχνει το νερό της ακτής σε κάθε
// παραλία (βίβλος §Γ5) — οπότε η λέξη δεν έχει πια πού να μπει και η απαίτηση θα ήταν αδύνατη.
// Ό,τι φύλαγε εκείνος ο έλεγχος το φυλάει τώρα ο επόμενος, στη ρίζα: ποιο νερό διαβάζει η κάρτα.
const cardPath = path.join(root, 'components/BeachCard.tsx');
const cardSource = readFileSync(cardPath, 'utf8');

/**
 * Η ΚΑΡΤΑ ΔΕΝ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΞΑΝΑΔΕΙΞΕΙ ΤΗ ΘΑΛΑΣΣΑ ΤΟΥ ΑΝΟΙΧΤΟΥ (13/08/2026, βράδυ).
 *
 * Ο έλεγχος από πάνω φυλάει τη ΛΕΞΗ. Αυτός φυλάει κάτι δυνατότερο: ότι η κάρτα διαβάζει τον
 * αριθμό ΤΗΣ ΑΚΤΗΣ. Δύο κάρτες δίπλα-δίπλα τύπωναν «1,4 μ. ανοιχτά» και «~0,2 μ.» — δύο
 * διαφορετικά μεγέθη, καμία ένδειξη ότι είναι διαφορετικά (Μίλτος, με στιγμιότυπο). Η λύση δεν
 * ήταν δεύτερη λέξη — δοκιμάστηκε, κόπηκε ως «πολύ κείμενο στο mobile» και το validateTileFit
 * την έκοβε στα 390 px — αλλά να δείχνει η κάρτα ΠΑΝΤΑ το ίδιο μέγεθος.
 *
 * Αν κάποιος ξαναγυρίσει το `cardShoreM` στο `shoreWaveHeightM` (που μιλάει μόνο σε κλειστούς
 * όρμους), οι κάρτες ξαναρχίζουν να ανακατεύουν τα δύο μεγέθη και ΚΑΘΕ άλλος έλεγχος εδώ μένει
 * πράσινος — γιατί όλοι κοιτάζουν λέξεις, όχι ποιο νερό διαβάστηκε.
 */
// ⚠️ ΚΑΡΦΩΜΕΝΟ ΣΤΗΝ ΠΡΩΤΗ ΕΚΦΡΑΣΗ, ΟΧΙ «ΚΑΠΟΥ ΕΚΕΙ ΚΟΝΤΑ». Η πρώτη εκδοχή αυτού του ελέγχου
// ζητούσε απλώς να εμφανίζεται το `shoreDisplayWaveM` μέσα στα 200 επόμενα σημεία — και πέρασε
// ΠΡΑΣΙΝΗ σε σαμποτάζ που γύρισε τη συνθήκη στο παλιό πεδίο, επειδή το νέο επιβίωνε στην επόμενη
// γραμμή του ίδιου ternary. Ένας έλεγχος που ψάχνει αν υπάρχει μια λέξη δεν ελέγχει τι διαβάζεται.
//
// 20/08/2026 — Ο ΥΠΟΛΟΓΙΣΜΟΣ ΜΕΤΑΚΟΜΙΣΕ, Ο ΕΛΕΓΧΟΣ ΤΟΝ ΑΚΟΛΟΥΘΗΣΕ ΚΑΙ ΜΕΓΑΛΩΣΕ.
// Το ζευγάρι «Μποφόρ · μέτρα» τυπώνεται πλέον ΚΑΙ στο ταμπελάκι που ανοίγει η πινέζα, οπότε ο
// υπολογισμός βγήκε στο `utils/beachConditionsReadout` — μία πηγή για δύο επιφάνειες, αντί για
// δεύτερο αντίγραφο του κανόνα (§Κ1). Ο έλεγχος ΔΕΝ χαλάρωσε: πιάνει την ίδια έκφραση στη νέα
// της θέση ΚΑΙ απαιτεί η κάρτα να ΚΑΤΑΝΑΛΩΝΕΙ αυτή την πηγή αντί να ξαναϋπολογίζει. Έτσι φυλάει
// τώρα και το ταμπελάκι, που πριν δεν υπήρχε καν για να ελεγχθεί.
const readoutPath = path.join(root, 'utils/beachConditionsReadout.ts');
let readoutSource = '';
try {
  readoutSource = readFileSync(readoutPath, 'utf8');
} catch {
  failures.push(
    'utils/beachConditionsReadout.ts is missing. It owns the ONE reading of the shore wave that both the '
    + 'card and the map popup print; without it the two surfaces are free to disagree.'
  );
}

const readoutReadsShoreEverywhere = /const shoreM\s*=\s*typeof shoreDisplayWaveM\b/.test(readoutSource);
if (!readoutReadsShoreEverywhere) {
  failures.push(
    'utils/beachConditionsReadout.ts: the shore figure no longer reads shoreDisplayWaveM first. Every '
    + 'surface would print the open-water figure on most beaches and the shore figure on a few — two '
    + 'different quantities side by side, which is the defect reported on 13/08/2026.'
  );
}

// Και η κάρτα πρέπει να ΠΑΙΡΝΕΙ το νούμερο από εκεί. Χωρίς αυτό, κάποιος θα άφηνε τη μονή πηγή
// ανέγγιχτη και θα ξανάγραφε τον υπολογισμό μέσα στην κάρτα — και ο έλεγχος από πάνω θα έμενε
// πράσινος ενώ οι δύο επιφάνειες θα τύπωναν άλλο νούμερο.
const cardUsesReadout = /const conditionsReadout\s*=\s*buildBeachConditionsReadout\(/.test(cardSource)
  && /const cardWaveValueText\s*=\s*conditionsReadout\.waveText\b/.test(cardSource);
if (!cardUsesReadout) {
  failures.push(
    'components/BeachCard.tsx: the printed wave figure no longer comes from buildBeachConditionsReadout. '
    + 'A second copy of the rule inside the card is exactly how the card and the map pin drifted apart '
    + 'before (§Κ1, and the card-vs-pin gate of 20/08/2026).'
  );
}

/**
 * ⚠️ 22/08/2026 — Η ΑΠΑΙΤΗΣΗ ΑΝΤΙΚΑΤΑΣΤΑΘΗΚΕ ΓΙΑ ΔΕΥΤΕΡΗ ΦΟΡΑ ΑΠΟ ΙΣΧΥΡΟΤΕΡΗ, ΔΕΝ ΣΒΗΣΤΗΚΕ.
 *
 * Μέχρι σήμερα ζητούσαμε «το κελί του κύματος να ζωγραφίζει το ΝΟΥΜΕΡΟ» (`text: cardWaveText`),
 * γιατί το νούμερο ήταν αυτό που ζούσε σε `title`/`aria-label` και δεν σχεδιαζόταν ποτέ σε
 * τηλέφωνο. Από σήμερα η κάρτα δεν τυπώνει ΚΑΘΟΛΟΥ νούμερο: το ×0,5, ο εκθέτης 0,75 και το SMB
 * δεν έχουν εξωτερικό κριτή, οπότε το εκατοστό υπόσχεται ακρίβεια που δεν έχουμε, και η ίδια η
 * βίβλος λέει «ο επισκέπτης δεν διαβάζει εκατοστά, διαβάζει ΖΩΝΗ». Το κελί κρατά τη ΖΩΝΗ.
 *
 * Άρα ο έλεγχος δεν ρωτά πια «ζωγραφίζεται το νούμερο;» αλλά τρία αυστηρότερα:
 *   1. Το κελί ζωγραφίζει τη ΛΕΞΗ (`text: cardWaveWord`) — όχι σιωπή, όχι μόνο εικονίδιο.
 *   2. Η λέξη βγαίνει από ΤΟ ΙΔΙΟ readout με το νούμερο, με το νούμερο ως δίχτυ. Δεύτερο
 *      λεξιλόγιο μέσα στην κάρτα θα ξεσυγχρονιζόταν από το ταμπελάκι της πινέζας.
 *   3. Το νούμερο, όπου κι αν επιβιώνει μέσα στο κελί (title/aria), δεν κυκλοφορεί ΠΟΤΕ γυμνό:
 *      πάει πάντα μαζί με το `cardWaveLabel` του — αυτό ήταν όλο το νόημα της 13/08.
 */
const waveItemBlock = cardSource.match(/if\s*\(cardWaveText\)\s*\{[\s\S]*?\n\s*\}/);
if (!waveItemBlock) {
  failures.push('components/BeachCard.tsx: the podium wave item is no longer pushed from cardWaveText.');
} else {
  if (!/\btext:\s*cardWaveWord\b/.test(waveItemBlock[0])) {
    failures.push(
      'components/BeachCard.tsx: the podium wave chip no longer renders cardWaveWord as its visible text. '
      + 'A sea signal that lives only in title/aria-label is invisible on a phone — the exact defect this check exists for.'
    );
  }
  if (!/const cardWaveWord\s*=\s*conditionsFeel\?\.waveWord\s*\?\?\s*cardWaveValueText\b/.test(cardSource)) {
    failures.push(
      'components/BeachCard.tsx: the band word painted on the card no longer comes from the same readout as the '
      + 'metre figure (conditionsFeel.waveWord, with cardWaveValueText as the net). A second vocabulary inside the '
      + 'card is how the card and the map popup would start describing the same water differently.'
    );
  }
  // Γραμμή-γραμμή, όχι με regex πάνω σε template literals: μια έκφραση που δεν ταιριάζει ποτέ
  // είναι νεκρός έλεγχος που δείχνει πράσινος. Γι' αυτό ελέγχεται ΚΑΙ ότι το μπλοκ έχει όντως
  // ιδιότητες να διαβάσει — αν πάψει να έχει, η πύλη το λέει αντί να σωπάσει.
  const attributeLines = waveItemBlock[0]
    .split('\n')
    .filter(line => /^\s*(title|ariaLabel):/.test(line));
  if (attributeLines.length === 0) {
    failures.push(
      'components/BeachCard.tsx: the podium wave chip has neither title nor aria-label. A screen reader would '
      + 'hear the band word with nothing saying it is about the sea.'
    );
  }
  for (const line of attributeLines) {
    if (/cardWaveValueText/.test(line) && !/cardWaveLabel/.test(line)) {
      failures.push(
        `components/BeachCard.tsx: «${line.trim()}» carries the metre figure with no name beside it. `
        + 'A bare number is the 13/08/2026 defect: two cards printed «1,4 μ.» and «~0,2 μ.» for two different waters '
        + 'with nothing saying they were different.'
      );
    }
  }
}

// The rendered span must still paint `item.text`. If someone drops it back to icon-only, or moves the
// text into an attribute, every check above stays green and the card goes silent again.
if (!/\{item\.text\}/.test(cardSource)) {
  failures.push(
    'components/BeachCard.tsx: the «why» row no longer paints item.text. The wave figure and its word '
    + 'would exist in the props and never be drawn.'
  );
}

// The word must not be re-declared inside the card. §7θ imported the strings from BeachAnswerHero
// precisely so the card and the beach page cannot end up describing the same water differently;
// a second label map in here is that drift, one edit away.
if (!/import\s*\{[^}]*\bSHORE_LABELS\b[^}]*\}\s*from\s*'\.\/BeachAnswerHero'/.test(cardSource)) {
  failures.push(
    'components/BeachCard.tsx: SHORE_LABELS is no longer imported from BeachAnswerHero. The card would '
    + 'be naming the water with its own words, which is how the card and the beach page drift apart.'
  );
}
for (const key of ['atShore', 'seaOpen']) {
  if (new RegExp(`\\b${key}\\s*:\\s*['\`]`).test(cardSource)) {
    failures.push(
      `components/BeachCard.tsx: it declares its own "${key}" string. The wave labels must come from `
      + 'BeachAnswerHero — two copies of the same label is exactly the drift §7θ removed.'
    );
  }
}

// ── REPORT ──────────────────────────────────────────────────────────────────────────────────
console.log(`Cases: ${casesChecked} (open water ${openWaterCases} · near-shore/cove ${coveCases}) · languages ${LANGUAGES.length} · explanation + shelter wiring checked · podium card word checked`);

if (failures.length > 0) {
  console.error(`\nFAILED: ${failures.length} problem(s) with the open-water label.\n`);
  for (const line of failures.slice(0, 25)) console.error(`  - ${line}`);
  if (failures.length > 25) console.error(`  ...and ${failures.length - 25} more`);
  console.error('\nThe wave number is an area-grid reading. It may be labelled «ανοιχτά» only when it');
  console.error('really is that reading — never when the cove guard has swapped in our own estimate.');
  process.exit(1);
}

console.log('PASS — the wave reading names the water it came from, in all five languages.');
