import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const reportPath = path.join(rootDir, '.tmp', 'critical-quality-report.json');
const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const args = new Set(process.argv.slice(2));
const maxAttemptsArg = process.argv.find(arg => arg.startsWith('--max-attempts='));
const maxAttempts = Math.max(1, Number(maxAttemptsArg?.split('=')[1] || (args.has('--auto') ? 3 : 1)));

const checks = [
  {
    id: 'beach-data',
    title: 'Critical beach data',
    description: 'Checks generated beach JSON for missing/invalid ids, names, Greece coordinates, duplicate ids, invalid enums, quiet + beach bar conflicts, and verified photo license/attribution gaps.',
    protects: 'Prevents broken beach records and unsafe/unclear beach facts from reaching the app.',
    failureAction: 'Fix the listed beach JSON or photo metadata. Do not invent coordinates, names, wind claims, or image rights.',
    command: process.execPath,
    args: ['scripts/validateCriticalBeachData.mjs'],
  },
  {
    id: 'shoreline-shapes',
    title: 'Shoreline thumbnails',
    description: 'Checks the committed per-beach shoreline drawings still match the beach coordinates and coastline they were built from, and that every drawing is left-to-right with the beach sitting on its own waterline.',
    protects: 'Prevents a corrected pin from leaving behind a confident-looking map of where the beach used to be.',
    failureAction: 'Run: npm run build:shorelines, then commit the regenerated public/data/coastline/shape/*.json.',
    command: process.execPath,
    args: ['scripts/validateShorelineShapes.mjs'],
  },
  {
    id: 'wind-exposure',
    title: 'Wind exposure engine',
    description: 'Runs wind exposure validation scenarios for shelter, fetch, confidence, and protected/calm label behavior.',
    protects: 'Prevents false calm/protected claims and wrong wind-shelter behavior.',
    failureAction: 'Review windProfile, exposure logic, and scenario expectations before changing user-facing claims.',
    command: process.execPath,
    args: ['scripts/validateWindExposureEngine.mjs'],
  },
  {
    id: 'marine-model-parsing',
    title: 'Marine model/parser contract',
    description: 'Checks the pinned Open-Meteo marine models agree between client and edge proxy, that every requested marine variable is parsed from a model that actually serves it, and that the bare-field fallback survives.',
    protects: 'Prevents a marine field from silently reading undefined — how the water-temperature card vanished from every beach page when a wave-only model was pinned. Nothing throws when this drifts; the data just disappears.',
    failureAction: 'Realign the MARINE_MODEL pins in services/forecast/openMeteoProvider.ts and netlify/functions/forecast.mjs with the series() lookups in services/weatherService.ts. Add --live to re-check which model serves which variable upstream.',
    command: process.execPath,
    args: ['scripts/validateMarineModelParsing.mjs'],
  },
  {
    id: 'recommendation-scenarios',
    title: 'Recommendation scenarios',
    description: 'Runs fixed weather scenarios for Milos, Paros, and Andros, including normal wind, rain, 4 Bft, and 5 Bft rough conditions.',
    protects: 'Prevents exposed or unsafe beaches from becoming top recommendations in hard weather.',
    failureAction: 'Review recommendation scoring, warnings, and no-swimming fallback behavior.',
    command: process.execPath,
    args: ['scripts/validateRecommendationScenarios.mjs'],
  },
  {
    id: 'trip-query-parsing',
    title: 'Trip query parsing',
    description: 'Parses free-text trip sentences ("θα μείνω Νάξο για 5 μέρες") over the real region list: recall in 5 languages, precision against dates/quantities/beach names with numerals, a stopword sweep, order invariance, and every region resolving from its own name.',
    protects: 'Prevents the search box from sending someone to the wrong island, inventing a day count from a date or a beach name, or matching a region on a stopword like «θα» (which scored 92 against Θάσος).',
    failureAction: 'Review utils/tripQueryParser.ts token tables and score thresholds. Never lower a threshold to make one sentence work — add the token to the tables instead.',
    command: process.execPath,
    args: ['scripts/validateTripQueryParsing.mjs'],
  },
  {
    id: 'planner-agreement',
    title: 'Trip planner agreement',
    description: 'Runs planTrip over real regions with 6-day rotating-wind forecasts: no pick outside the podium safety gate, no unbacked shelter claim, order-invariance, policy filters, Beaufort ceiling.',
    protects: 'Prevents the trip planner from naming a beach the homepage refuses, claiming shelter without evidence, or picking by JSON file order.',
    failureAction: 'Review tripPlannerService gates/ranking against services/topPickRanking and the assertions in scripts/validatePlannerAgreement.mjs.',
    command: process.execPath,
    args: ['scripts/validatePlannerAgreement.mjs', '--strict'],
  },
  {
    id: 'content-audit',
    title: 'Static content safety audit',
    description: 'Scans static copy and generated beach data for risky wording like guaranteed calm, protected, safe, ideal, or no-wave claims.',
    protects: 'Prevents static text from promising live conditions that weather data has not verified.',
    failureAction: 'Rewrite the flagged copy as cautious wording or move the claim to verified windProfile/local notes.',
    command: npmBin,
    args: ['run', 'content:audit'],
    evaluate: ({ stdout, exitCode }) => {
      if (exitCode !== 0) {
        return { ok: false, reason: `process exited with ${exitCode}` };
      }

      const match = stdout.match(/Findings:\s+\d+\s+\(high\s+(\d+),\s*medium\s+(\d+),\s*low\s+(\d+)\)/i);
      if (!match) {
        return { ok: true, reason: 'no parsable high-risk count found' };
      }

      const highCount = Number(match[1]);
      if (highCount > 0) {
        return { ok: false, reason: `content audit found ${highCount} high-risk wording finding(s)` };
      }

      return { ok: true, reason: 'no high-risk wording findings' };
    },
  },
  {
    id: 'athens-clock',
    title: 'Athens wall-clock guard',
    description: 'Scans app code for a raw new Date()/Date.now() used as "now" instead of athensNow().',
    protects: 'Prevents the viewer\'s own timezone from pointing them at the wrong forecast hour — every user must read the same Greek-time conditions.',
    failureAction: 'Use athensNow() from utils/athensTime.ts, or mark the line "athens-clock-exempt: <reason>" when it is a real instant (age, duration, id).',
    command: process.execPath,
    args: ['scripts/validateAthensClock.mjs'],
  },
  {
    id: 'lint',
    title: 'TypeScript lint/typecheck',
    description: 'Runs TypeScript without emitting files.',
    protects: 'Prevents broken imports, type errors, and obvious code integration mistakes.',
    failureAction: 'Fix the TypeScript error shown in the output.',
    command: npmBin,
    args: ['run', 'lint'],
  },
  {
    id: 'build',
    title: 'Production build',
    description: 'Builds the production Vite app.',
    protects: 'Prevents deploys that compile in dev but fail in production bundling.',
    failureAction: 'Fix the build error. Existing large chunk warnings are advisory unless Vite exits non-zero.',
    command: npmBin,
    args: ['run', 'build'],
  },
  {
    id: 'bundle-secrets',
    title: 'Bundle secret guard',
    description: 'Checks vite.config.ts still loads only VITE_-prefixed env vars and has no `define` block injecting environment values, then scans the built bundle for key-shaped literals (Google, OpenAI, GitHub, AWS, Slack, Telegram, PEM).',
    protects: 'Prevents a server-side secret from being inlined into the JavaScript every visitor downloads. The config used to do exactly this: loadEnv with an empty prefix plus define(process.env.API_KEY) would have published GEMINI_API_KEY the first time it was set in Netlify. Nothing errors when this drifts — the key just ships.',
    failureAction: "Restore loadEnv(mode, '.', 'VITE_') and remove the define block in vite.config.ts. If a key was found in dist/, revoke it first, then find what put it there.",
    command: process.execPath,
    args: ['scripts/validateBundleSecrets.mjs'],
  },
  {
    id: 'seo-audit',
    title: 'SEO prerender audit',
    description: 'Audits generated prerendered pages, sitemap, robots.txt, canonicals, hreflang links, structured data, internal links, image references, and SEO performance budgets.',
    protects: 'Prevents broken search-indexing signals from reaching production after prerender generation.',
    failureAction: 'Fix the generated SEO output, prerender routes, metadata, hreflang/canonical links, or referenced assets reported by the audit.',
    command: npmBin,
    args: ['run', 'seo:audit'],
  },
];

const printExplanation = () => {
  console.log('Beach Buddy Critical Quality Gate');
  console.log('');
  console.log('Purpose: catch critical beach data, recommendation, wording, typecheck, and build problems before deploy.');
  console.log('Rule: the gate reports problems; it does not invent or auto-correct beach facts.');
  console.log('');
  console.log('Checks:');
  checks.forEach((check, index) => {
    console.log(`${index + 1}. ${check.title}`);
    console.log(`   What it checks: ${check.description}`);
    console.log(`   Why it matters: ${check.protects}`);
    console.log(`   If it fails: ${check.failureAction}`);
  });
  console.log('');
  console.log('Commands:');
  console.log('- npm run quality:explain   Show this explanation only.');
  console.log('- npm run quality:beach-data Run only the beach/photo data validator.');
  console.log('- npm run quality:critical   Run the full gate once.');
  console.log('- npm run quality:auto       Run the full gate, retrying up to 3 times.');
  console.log('');
  console.log('Report: .tmp/critical-quality-report.json');
};

const tail = (value, maxLines = 80) => {
  const lines = String(value || '').split(/\r?\n/).filter(Boolean);
  return lines.slice(-maxLines).join('\n');
};

const runCheck = check => {
  const startedAt = new Date().toISOString();
  const result = spawnSync(check.command, check.args, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
    shell: process.platform === 'win32' && check.command.endsWith('.cmd'),
  });

  const exitCode = typeof result.status === 'number' ? result.status : 1;
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const evaluation = typeof check.evaluate === 'function'
    ? check.evaluate({ stdout, stderr, exitCode })
    : {
        ok: exitCode === 0,
        reason: exitCode === 0 ? 'passed' : `process exited with ${exitCode}`,
      };

  if (result.error) {
    evaluation.ok = false;
    evaluation.reason = result.error.message;
  }

  return {
    id: check.id,
    title: check.title,
    command: [check.command, ...check.args].join(' '),
    ok: evaluation.ok,
    reason: evaluation.reason,
    exitCode,
    startedAt,
    finishedAt: new Date().toISOString(),
    stdoutTail: tail(stdout),
    stderrTail: tail(stderr),
  };
};

const runAttempt = attempt => {
  console.log(`\nCritical quality gate attempt ${attempt}/${maxAttempts}`);
  const results = [];

  for (const check of checks) {
    process.stdout.write(`- ${check.title}: ${check.description} ... `);
    const result = runCheck(check);
    results.push(result);
    console.log(result.ok ? 'pass' : 'fail');

    if (!result.ok) {
      console.log(`  ${result.reason}`);
      console.log(`  Next step: ${check.failureAction}`);
    }
  }

  return {
    attempt,
    ok: results.every(result => result.ok),
    results,
  };
};

const main = () => {
  if (args.has('--explain')) {
    printExplanation();
    return;
  }

  printExplanation();

  const attempts = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = runAttempt(attempt);
    attempts.push(result);

    if (result.ok) {
      break;
    }

    if (attempt < maxAttempts) {
      console.log('Quality gate still failing; rerunning bounded retry.');
    }
  }

  const finalAttempt = attempts[attempts.length - 1];
  const report = {
    ok: finalAttempt.ok,
    maxAttempts,
    attempts,
    generatedAt: new Date().toISOString(),
  };

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  console.log(`\nQuality report: ${path.relative(rootDir, reportPath).replaceAll(path.sep, '/')}`);
  if (finalAttempt.ok) {
    console.log('Critical quality gate passed.');
    return;
  }

  console.log('Critical quality gate failed.');
  process.exitCode = 1;
};

main();
