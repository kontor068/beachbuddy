#!/usr/bin/env node
/**
 * Athens-clock guard.
 *
 * Every forecast hour the app holds is Greek local time (Open-Meteo is called with
 * `timezone=auto`, i.e. the timezone of the beach, and its naive timestamps are parsed
 * in the runtime's zone). So any "now" used for a time-of-day or calendar-day decision
 * must come from `athensNow()` (utils/athensTime.ts). A raw `new Date()` / `Date.now()`
 * is the VIEWER's clock: a visitor abroad would be pointed at the wrong forecast hour,
 * get the wrong today/tomorrow default, and see best-time windows open or expire early.
 *
 * This check fails the build when app code reintroduces a raw clock. Real instants —
 * cache ages, forecast freshness, analytics timestamps, ids — are legitimate and are
 * declared either by listing the module in INSTANT_ONLY_MODULES or with an inline
 * `athens-clock-exempt: <reason>` comment on the line.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// App surfaces that render conditions. Build scripts are excluded: they run on our
// machines, in Greek time, and never render a viewer-facing "now".
const SCAN_TARGETS = ['App.tsx', 'components', 'hooks', 'pages', 'services', 'utils'];

// Modules whose Date usage is exclusively real instants (durations, ages, timestamps,
// ids) — never a time-of-day decision. Shifting those would corrupt the freshness gate.
const INSTANT_ONLY_MODULES = new Set([
  'utils/athensTime.ts',              // defines the shifted clock
  'utils/weatherFixtures.ts',         // DEV + localhost only, never reaches visitors
  'utils/chunkLoadRecovery.ts',       // reload back-off window
  'services/weatherService.ts',       // cache TTL + fetchedAt (safety-critical staleness)
  'services/analyticsService.ts',     // event timestamps + UTC day keys
  'services/legalConsent.ts',         // consent log timestamps
  'services/pageviewBeacon.ts',       // visitor-counter UTC day key
  'services/forecastVerificationService.ts', // captured-at timestamps
  'services/nationalConditions.ts',   // fetch cache TTL
  'components/InstallPrompt.tsx',     // dismissal cool-down
  // Usage-day keys + dismissal cool-down. The day key is deliberately the VIEWER's calendar
  // day — it measures their own habit of coming back, not anything about Greek forecast time.
  'components/AppRatingPrompt.tsx',
]);

const EXEMPT_MARKER = 'athens-clock-exempt';
const RAW_CLOCK = /\bnew Date\(\s*\)|\bDate\.now\(\s*\)/;

const toPosix = filePath => path.relative(rootDir, filePath).split(path.sep).join('/');

const collectFiles = target => {
  const absolute = path.join(rootDir, target);
  const stats = statSync(absolute, { throwIfNoEntry: false });
  if (!stats) return [];
  if (stats.isFile()) return /\.tsx?$/.test(absolute) ? [absolute] : [];

  return readdirSync(absolute, { withFileTypes: true }).flatMap(entry => (
    collectFiles(path.join(target, entry.name))
  ));
};

// Crude but sufficient: a match inside a line that is purely a comment is documentation.
const isCommentLine = line => {
  const trimmed = line.trim();
  return trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
};

const violations = [];

for (const target of SCAN_TARGETS) {
  for (const file of collectFiles(target)) {
    const relative = toPosix(file);
    if (INSTANT_ONLY_MODULES.has(relative)) continue;

    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    // The marker may sit on the line itself or anywhere in the comment block directly
    // above it, so a long explanation does not have to be crammed onto the code line.
    const isExempt = index => {
      if (lines[index].includes(EXEMPT_MARKER)) return true;
      for (let above = index - 1; above >= 0 && isCommentLine(lines[above]); above -= 1) {
        if (lines[above].includes(EXEMPT_MARKER)) return true;
      }
      return false;
    };

    lines.forEach((line, index) => {
      if (!RAW_CLOCK.test(line)) return;
      if (isCommentLine(line) || isExempt(index)) return;
      violations.push({ file: relative, line: index + 1, code: line.trim() });
    });
  }
}

if (violations.length > 0) {
  console.error(`Athens-clock guard: ${violations.length} raw clock use(s) in app code.\n`);
  violations.forEach(violation => {
    console.error(`  ${violation.file}:${violation.line}`);
    console.error(`    ${violation.code}`);
  });
  console.error(`
Fix: use athensNow() from utils/athensTime.ts for anything time-of-day or calendar-day
(which hour is "now", today vs tomorrow, best-time windows, day labels).
If the value is a real instant (age, duration, timestamp, id), keep the raw clock and add
an inline "${EXEMPT_MARKER}: <reason>" comment, or list the module in INSTANT_ONLY_MODULES.`);
  process.exit(1);
}

console.log('Athens-clock guard: OK — no raw viewer clock in conditions code.');
