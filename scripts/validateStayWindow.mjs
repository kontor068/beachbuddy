/**
 * Η ΑΠΑΝΤΗΣΗ ΤΟΥ ΠΑΡΑΘΥΡΟΥ ΔΕΝ ΕΙΝΑΙ ΠΟΤΕ ΠΙΟ ΗΡΕΜΗ ΑΠΟ ΤΗ ΧΕΙΡΟΤΕΡΗ ΤΟΥ ΩΡΑ — πύλη.
 *
 * When someone says "I am staying four hours", the app stops describing this moment and starts
 * describing the roughest hour they will be standing there (utils/stayWindow). That rule is one
 * function call deep, which is exactly the kind of thing that gets "simplified" into an average by
 * someone who does not know why it is there. An average is not a smaller version of this rule — it
 * is the opposite of it, and it fails in the one direction this project has decided it will not
 * fail in: telling someone the sea is calmer than it is.
 *
 * The lesson this gate is written against is dated 05/08/2026: twenty-four gates were green while
 * 840 red words sat over orange pins, because every one of them asked "are we saying it is calmer
 * than it is?" from the same angle and none asked anything else. So this one does not check that
 * the code agrees with itself. It states the invariant as a property and hunts for a
 * counter-example across every hourly tone sequence that can occur.
 *
 * SABOTAGE-TESTED IN THE FILE ITSELF. Below the real checks, the same grid is run against two
 * deliberately wrong pickers (first-hour, and calmest-hour). If either of them PASSES, the grid is
 * not discriminating and this gate is decoration — so that is a failure too. A gate that cannot
 * fail has never proved anything.
 *
 * Run: node scripts/validateStayWindow.mjs
 */
import { readFileSync } from 'node:fs';
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
  }).outputText;
  module._compile(output, filename);
};

const {
  STAY_LENGTH_HOURS,
  getStayWindowSlots,
  getStaySampleSlots,
  pickHarshestStayHour,
  pickHarshestStayHourFromReadings,
  findStayTurningPoint,
  stayWindowDegrades,
} = require(path.join(root, 'utils/stayWindow.ts'));
const { CALMNESS_ORDER, resolveConditionTone } = require(path.join(root, 'utils/suitabilityTone.ts'));

const rank = (tone) => CALMNESS_ORDER.indexOf(tone);

const failures = [];
const fail = (rule, detail) => failures.push(`${rule}: ${detail}`);

// ─────────────────────────────────────────────────────────────────────────────
// The grid: every tone sequence of length 1…5 over the four tones. 4^1+…+4^5 = 1.364 windows,
// which is every shape a sampled window can have (STAY_SAMPLE_STRIDE_HOURS caps samples at five).
// ─────────────────────────────────────────────────────────────────────────────
const sequences = [];
const build = (prefix) => {
  if (prefix.length > 0) sequences.push([...prefix]);
  if (prefix.length === 5) return;
  for (const tone of CALMNESS_ORDER) build([...prefix, tone]);
};
build([]);

const asSamples = (tones) => tones.map((tone, i) => ({ dt: 1_000 + i * 3_600, tone }));

// ── RULE 1 — the chosen hour is the roughest hour. Never calmer, not once. ───────────────────
// This is the whole feature in one line. If it can be violated, someone is told a window is fine
// because it starts fine.
let rule1Checked = 0;
for (const tones of sequences) {
  const samples = asSamples(tones);
  const dt = pickHarshestStayHour(samples);
  const chosen = samples.find(s => s.dt === dt);
  const roughest = Math.min(...samples.map(s => rank(s.tone)));
  rule1Checked += 1;
  if (!chosen) { fail('harshest-hour-exists', `[${tones.join(',')}] returned ${dt}`); continue; }
  if (rank(chosen.tone) !== roughest) {
    fail('harshest-hour-is-roughest', `[${tones.join(',')}] chose ${chosen.tone}, roughest was ${CALMNESS_ORDER[roughest]}`);
  }
}

// ── RULE 2 — ties go to the earliest hour. ──────────────────────────────────────────────────
// 54% of beach-days hold one tone all day (measureIntradayWindowSpread, 05/08/2026). On those the
// feature must be invisible: same hour, same card, same everything as before anyone touched a chip.
for (const tones of sequences) {
  const samples = asSamples(tones);
  const dt = pickHarshestStayHour(samples);
  const roughest = Math.min(...samples.map(s => rank(s.tone)));
  const firstRoughest = samples.find(s => rank(s.tone) === roughest);
  if (dt !== firstRoughest.dt) {
    fail('ties-go-earliest', `[${tones.join(',')}] chose dt ${dt}, earliest roughest was ${firstRoughest.dt}`);
  }
}

// ── RULE 3 — no stay means no window. ───────────────────────────────────────────────────────
// The untouched default must resolve to exactly one slot, or every visitor who never taps a chip
// silently gets a different app.
const slots = Array.from({ length: 9 }, (_, i) => ({ dt: 1_000 + i * 3_600 }));
if (getStayWindowSlots(slots, null).length !== 1) {
  fail('no-stay-is-one-slot', `got ${getStayWindowSlots(slots, null).length} slots`);
}
if (getStayWindowSlots([], null).length !== 0) {
  fail('no-slots-no-crash', 'empty slot list did not return empty');
}

// ── RULE 4 — the window is what was asked for, and starts now. ──────────────────────────────
for (const hours of STAY_LENGTH_HOURS) {
  const windowSlots = getStayWindowSlots(slots, hours);
  if (windowSlots.length > hours) fail('window-not-longer-than-asked', `${hours}h gave ${windowSlots.length} slots`);
  if (windowSlots[0]?.dt !== slots[0].dt) fail('window-starts-now', `${hours}h started at ${windowSlots[0]?.dt}`);
  // Late in the day there is less left than asked for, and the honest answer is what is left.
  const short = getStayWindowSlots(slots.slice(0, 2), hours);
  if (short.length !== Math.min(2, hours)) fail('window-clamps-to-day', `${hours}h on a 2-slot day gave ${short.length}`);
}

// ── RULE 5 — both ends of the window are always looked at. ──────────────────────────────────
// The last hour is where a meltemi afternoon turns. Sampling that drops it would miss precisely
// the case the feature exists for.
for (let length = 1; length <= 9; length += 1) {
  const windowSlots = slots.slice(0, length);
  const sampled = getStaySampleSlots(windowSlots);
  if (sampled[0]?.dt !== windowSlots[0].dt) fail('samples-include-first', `length ${length}`);
  if (sampled[sampled.length - 1]?.dt !== windowSlots[windowSlots.length - 1].dt) {
    fail('samples-include-last', `length ${length} ended at ${sampled[sampled.length - 1]?.dt}`);
  }
  if (new Set(sampled.map(s => s.dt)).size !== sampled.length) fail('samples-unique', `length ${length} repeated a slot`);
}

// ── RULE 6 — "it gets worse" means it actually gets worse. ──────────────────────────────────
// This drives the one sentence the card adds. A false positive puts a warning on a day that never
// turns; a false negative is the 33% of days we currently describe by their calm start.
for (const tones of sequences) {
  const samples = asSamples(tones);
  const expected = samples.some(s => rank(s.tone) < rank(samples[0].tone));
  if (stayWindowDegrades(samples) !== expected) {
    fail('degrades-is-honest', `[${tones.join(',')}] said ${stayWindowDegrades(samples)}, truth ${expected}`);
  }
  const turn = findStayTurningPoint(samples);
  const firstDifferent = samples.find(s => s.tone !== samples[0].tone);
  if (Boolean(turn) !== Boolean(firstDifferent)) {
    fail('turning-point-exists-iff-it-turns', `[${tones.join(',')}]`);
  }
  if (turn && turn.fromDt !== firstDifferent.dt) {
    fail('turning-point-is-first-change', `[${tones.join(',')}] said ${turn.fromDt}, first change ${firstDifferent.dt}`);
  }
}

// ── RULE 7 — the same promise, from the inputs the app actually hands over. ─────────────────
// Rules 1-6 drive the tone-level picker. This one drives pickHarshestStayHourFromReadings, which
// is what App calls: raw exposure/Beaufort/sea readings in, one dt out. It exists as a separate
// function because App.tsx is forbidden from resolving a tone itself, and a rule that only tested
// the inner half would leave the half the app uses uncovered.
const EXPOSURES = ['protected', 'partial', 'exposed', undefined];
const BEAUFORTS = [2, 4, 5, 6, 7];
const SEAS = [undefined, 0.3, 0.9, 1.4];
let rule7Checked = 0;
for (const exposureA of EXPOSURES) {
  for (const beaufortA of BEAUFORTS) {
    for (const seaA of SEAS) {
      for (const exposureB of EXPOSURES) {
        for (const beaufortB of BEAUFORTS) {
          const readings = [
            { dt: 1_000, exposureLevel: exposureA, beaufort: beaufortA, seaStateM: seaA },
            { dt: 4_600, exposureLevel: exposureB, beaufort: beaufortB, seaStateM: seaA },
          ];
          const dt = pickHarshestStayHourFromReadings(readings);
          rule7Checked += 1;
          const tones = readings.map(r => resolveConditionTone({
            exposureLevel: r.exposureLevel,
            beaufort: r.beaufort,
            isEnclosedCove: false,
            seaStateM: r.seaStateM,
          }));
          const roughest = Math.min(...tones.map(rank));
          const chosenIndex = readings.findIndex(r => r.dt === dt);
          if (chosenIndex === -1 || rank(tones[chosenIndex]) !== roughest) {
            fail('readings-picker-is-roughest',
              `${exposureA}/${beaufortA}/${seaA} vs ${exposureB}/${beaufortB} → ${tones[chosenIndex] ?? 'none'}, roughest ${CALMNESS_ORDER[roughest]}`);
          }
        }
      }
    }
  }
}
if (pickHarshestStayHourFromReadings([]) !== null) fail('readings-picker-empty', 'empty readings did not return null');

// ─────────────────────────────────────────────────────────────────────────────
// THE SABOTAGE. Two wrong pickers over the same grid. Both MUST be caught.
// ─────────────────────────────────────────────────────────────────────────────
const countViolations = (picker) => {
  let violations = 0;
  for (const tones of sequences) {
    const samples = asSamples(tones);
    const dt = picker(samples);
    const chosen = samples.find(s => s.dt === dt);
    const roughest = Math.min(...samples.map(s => rank(s.tone)));
    if (!chosen || rank(chosen.tone) !== roughest) violations += 1;
  }
  return violations;
};
const firstHourPicker = (samples) => samples[0].dt;
const calmestPicker = (samples) => samples.reduce((best, s) => (rank(s.tone) > rank(best.tone) ? s : best)).dt;

const firstHourViolations = countViolations(firstHourPicker);
const calmestViolations = countViolations(calmestPicker);
if (firstHourViolations === 0) fail('grid-is-blind', 'a first-hour picker passed rule 1 — the grid proves nothing');
if (calmestViolations === 0) fail('grid-is-blind', 'a calmest-hour picker passed rule 1 — the grid proves nothing');

// ─────────────────────────────────────────────────────────────────────────────
console.log('Πύλη: η απάντηση του παραθύρου = η χειρότερη ώρα του');
console.log(`  Παράθυρα ελεγμένα: ${sequences.length.toLocaleString('el-GR')} (κάθε ακολουθία 1-5 ωρών × 4 χρώματα)`);
console.log(`  Έλεγχοι κανόνα 1: ${rule1Checked.toLocaleString('el-GR')}`);
console.log(`  Έλεγχοι κανόνα 7 (πραγματικές εισόδοι App): ${rule7Checked.toLocaleString('el-GR')}`);
console.log(`  Σαμποτάζ — «πρώτη ώρα» πιάστηκε ${firstHourViolations.toLocaleString('el-GR')} φορές, `
  + `«ηρεμότερη ώρα» ${calmestViolations.toLocaleString('el-GR')} φορές`);

if (failures.length > 0) {
  console.error(`\nΑΠΕΤΥΧΕ — ${failures.length} παραβιάσεις:`);
  failures.slice(0, 20).forEach(f => console.error(`  ${f}`));
  if (failures.length > 20) console.error(`  … και άλλες ${failures.length - 20}`);
  process.exit(1);
}
console.log('\nΠΕΡΑΣΕ — καμία παραβίαση.');
