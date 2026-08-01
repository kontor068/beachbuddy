/**
 * THE CARD SAYS WHERE THE WAVE CAME FROM — or says nothing at all.
 *
 * Reported from Ταυρωνίτης (Χανιά), 02/08/2026: «2 Μπφ στην πυξίδα και 1,6 μ. κύμα — στέκει;».
 * It does, and that was the whole problem: the card stated both numbers and explained neither,
 * so a correct page read like a broken one. Measured at that beach the same hour — local wind
 * 14–18 km/h making 0,16–0,22 m of its own, and 1,26 m at 5,7 s arriving from the north. About
 * 95% of the sea was made by weather that is not there.
 *
 * The beach page did have a swell section, but it only opens on Atlantic ground swell
 * (utils/swellExposure.meaningful, >= 7 s) — a bar an ordinary Aegean swell never clears. So the
 * one case the reader actually meets had no words anywhere on the page.
 *
 * This gate holds two things:
 *
 *   THE CLAUSE — present in all five languages when the reading supports it, and ABSENT the
 *   moment it does not. Loosening a threshold to explain ordinary wind chop would be inventing
 *   a cause, which is worse than the silence it replaced.
 *
 *   THE PHRASE — «από τα βόρεια», not «από τα Βόρειος». The wind tables hold a masculine
 *   adjective that agrees with «άνεμος»; the beach page reused them for a direction and printed
 *   broken Greek in the one section that already existed. French has the same trap («de l'est»,
 *   not «du est»), which is why the phrase is stored whole per language.
 *
 * Display only. No score, colour or verdict is involved, and this gate asserts about none.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(readFileSync(filename, 'utf8'), {
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

const { buildWeatherNowContent, directionFromPhrase } = require(path.join(root, 'utils/weatherNowCopy.ts'));
const { WindDirection } = require(path.join(root, 'types.ts'));
const { SEA_REFERENCE_PERIOD_S } = require(path.join(root, 'utils/waveCharacter.ts'));

const LANGS = ['en', 'gr', 'de', 'fr', 'it'];
const failures = [];
const fail = (rule, detail) => failures.push({ rule, detail });

// The measured Ταυρωνίτης reading, plus the shape of the page it appeared on.
const TAVRONITIS = {
  beachName: 'Ταυρωνίτης',
  isToday: true,
  dataReady: true,
  windDir: WindDirection.NE,
  beaufort: 2,
  waveHeightM: 1.6,
  wavePeriodS: 5.7,
  isWaveEstimate: false,
  protectedFrom: [],
  faces: [WindDirection.N],
  facingDeg: 31.7,
  canClaimWindProtection: false,
  isExposedToTodayWind: true,
  seaConditionScore: 4,
  swellHeightM: 1.26,
  swellPeriodS: 5.7,
  swellDirectionDeg: 8,
  seaTotalHeightM: 1.6,
};

const sentenceFor = (overrides, language) => (
  buildWeatherNowContent({ ...TAVRONITIS, ...overrides, language }).liveSentence
);

// ── 1. The clause is there, in every language, on the reported case.
LANGS.forEach(language => {
  const sentence = sentenceFor({}, language);
  const expectedOrigin = directionFromPhrase(TAVRONITIS.swellDirectionDeg, language);
  if (!sentence.includes(expectedOrigin)) {
    fail(
      `weatherNowCopy [${language}]: the wave's origin is missing from the live sentence`,
      `2 Bft over a 1,6 m sea, 95% of it a 5,7 s swell from the north, and the card explains nothing. Expected the sentence to contain "${expectedOrigin}". Got: "${sentence}"`
    );
  }
  if (sentence.trim().split(/[.!]/).filter(part => part.trim()).length < 2) {
    fail(
      `weatherNowCopy [${language}]: the origin clause did not survive as its own statement`,
      `The explanation is appended to the existing sentence, never replacing it — the reader needs both the wind fact and the cause. Got: "${sentence}"`
    );
  }
});

// ── 2. And it is absent whenever the reading does not support it. Each of these must stay
//       silent: a cause we cannot see is worse than no cause.
const mustStaySilent = [
  {
    label: 'ordinary short-period wind chop',
    overrides: { swellPeriodS: SEA_REFERENCE_PERIOD_S - 0.5, wavePeriodS: SEA_REFERENCE_PERIOD_S - 0.5 },
    why: `At ${SEA_REFERENCE_PERIOD_S} s and below this is the local wind-sea the app's own thresholds were calibrated on, whatever channel the model files it under.`,
  },
  {
    label: 'a swell too small to matter',
    overrides: { swellHeightM: 0.3, seaTotalHeightM: 0.35, waveHeightM: 0.35 },
    why: 'A 0,30 m swell does not need explaining; a sentence about it is noise.',
  },
  {
    label: 'a swell that is only part of the sea',
    overrides: { swellHeightM: 0.5 },
    why: 'With 0,5 m of swell inside a 1,6 m sea, most of the water was made by something else — handing the whole height to the swell would be a false explanation.',
  },
  {
    label: 'a swell with no direction',
    overrides: { swellDirectionDeg: undefined },
    why: 'The sentence names a direction. With no direction there is nothing truthful to say.',
  },
  {
    label: 'a calm sea under a light wind',
    overrides: { seaConditionScore: 9, waveHeightM: 0.1, seaTotalHeightM: 0.1, swellHeightM: 0.1 },
    why: 'That branch says the water is calm. There is no wave to account for.',
  },
];

mustStaySilent.forEach(({ label, overrides, why }) => {
  LANGS.forEach(language => {
    const sentence = sentenceFor(overrides, language);
    const origin = directionFromPhrase(overrides.swellDirectionDeg ?? TAVRONITIS.swellDirectionDeg, language);
    if (sentence.includes(origin)) {
      fail(
        `weatherNowCopy [${language}]: explains ${label}`,
        `${why} Got: "${sentence}"`
      );
    }
  });
});

// ── 3. The sheltered shore with a sea still running into it — same gap, one branch down.
LANGS.forEach(language => {
  const sentence = sentenceFor({
    beaufort: 5,
    windDir: WindDirection.N,
    protectedFrom: [WindDirection.N],
    faces: [WindDirection.S],
    facingDeg: 180,
    isExposedToTodayWind: false,
    mapExposureLevel: 'protected',
  }, language);
  const expectedOrigin = directionFromPhrase(TAVRONITIS.swellDirectionDeg, language);
  if (!sentence.includes(expectedOrigin)) {
    fail(
      `weatherNowCopy [${language}]: a lee shore with a running sea still does not say where it came from`,
      `This is the Κολιτσανή case: the shelter claim is true and a sea is running into it anyway. Expected "${expectedOrigin}". Got: "${sentence}"`
    );
  }
});

// ── 4. The phrase itself. This is the regression that was already shipped.
const COMPASS_DEGREES = [0, 45, 90, 135, 180, 225, 270, 315];
const GREEK_WIND_ADJECTIVES = /Βόρειος|Βορειοανατολικός|Ανατολικός|Νοτιοανατολικός|Νότιος|Νοτιοδυτικός|Δυτικός|Βορειοδυτικός/;

LANGS.forEach(language => {
  const phrases = COMPASS_DEGREES.map(deg => directionFromPhrase(deg, language));

  phrases.forEach((phrase, index) => {
    if (!phrase || !phrase.trim()) {
      fail(
        `directionFromPhrase [${language}]: empty phrase at ${COMPASS_DEGREES[index]}°`,
        'Every compass point must have words in every language, or a sentence loses its subject mid-way.'
      );
    }
  });

  if (new Set(phrases).size !== COMPASS_DEGREES.length) {
    fail(
      `directionFromPhrase [${language}]: two compass points share a phrase`,
      `A reader cannot tell a northerly sea from a southerly one. Got: ${JSON.stringify(phrases)}`
    );
  }

  if (language === 'gr' && phrases.some(phrase => GREEK_WIND_ADJECTIVES.test(phrase))) {
    fail(
      'directionFromPhrase [gr]: back to the masculine wind adjective',
      `«από τα Βόρειος» — the wind tables agree with «άνεμος» and cannot be reused for a direction. Got: ${JSON.stringify(phrases)}`
    );
  }
});

// The two traps that made the phrase a whole string rather than a word in a template.
if (directionFromPhrase(0, 'gr') !== 'από τα βόρεια') {
  fail('directionFromPhrase [gr]: north is not «από τα βόρεια»', `Got "${directionFromPhrase(0, 'gr')}".`);
}
if (directionFromPhrase(90, 'fr') !== "de l'est") {
  fail('directionFromPhrase [fr]: east must elide', `French takes «du nord» but «de l'est». Got "${directionFromPhrase(90, 'fr')}".`);
}

// ── 5. The caller has to hand over the swell at all. A silent unwiring is how the last
//       explanation disappeared while every gate stayed green.
const detailSource = readFileSync(path.join(root, 'pages/BeachDetailPage.tsx'), 'utf8');

/**
 * The argument list of `buildWeatherNowContent(`, by balanced parentheses. Scoped deliberately:
 * the same three swell fields are handed to assessSwellExposure three times elsewhere in this
 * file, so a plain "does the file mention swellPeriodS" test passes with the wiring cut. That
 * near-miss was caught by sabotaging it.
 */
const weatherNowCallArguments = (() => {
  const start = detailSource.indexOf('buildWeatherNowContent(');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start + 'buildWeatherNowContent'.length; i < detailSource.length; i += 1) {
    if (detailSource[i] === '(') depth += 1;
    else if (detailSource[i] === ')') {
      depth -= 1;
      if (depth === 0) return detailSource.slice(start, i + 1);
    }
  }
  return null;
})();

if (!weatherNowCallArguments) {
  fail(
    'pages/BeachDetailPage.tsx: buildWeatherNowContent is not called here any more',
    'If the card moved, move this rule with it — an unread gate is worse than none.'
  );
} else {
  ['swellHeightM', 'swellPeriodS', 'swellDirectionDeg', 'seaTotalHeightM'].forEach(field => {
    if (!new RegExp(`${field}:\\s*weatherData\\.marine\\?\\.`).test(weatherNowCallArguments)) {
      fail(
        `pages/BeachDetailPage.tsx: ${field} is no longer passed to buildWeatherNowContent`,
        'The copy silently falls back to saying nothing, which reads exactly like the defect it fixed.'
      );
    }
  });
}

if (failures.length > 0) {
  console.error(`FAILED: ${failures.length} swell-origin rule(s) broken.\n`);
  failures.forEach(({ rule, detail }) => {
    console.error(`  x ${rule}`);
    console.error(`    ${detail}\n`);
  });
  process.exit(1);
}

console.log(`PASSED: the card names where the sea came from, and stays quiet when it cannot — ${LANGS.length} languages, ${mustStaySilent.length} silence rules, 8 compass points.`);
