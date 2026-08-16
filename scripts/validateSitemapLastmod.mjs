/**
 * scripts/validateSitemapLastmod.mjs
 *
 * Proves the sitemap's <lastmod> still means "this page's content changed",
 * and not "a build ran".
 *
 * WHY THIS GATE EXISTS. Before 16/08/2026 every URL without an explicit date
 * got `new Date()` on every build, and every beach page inherited its REGION's
 * data-file timestamp. The 16/08 sitemap carried exactly TWO distinct dates
 * across 9.536 URLs. At the same time, URL Inspection showed 4 in 10 of our
 * pages were not in Google's index at all ("Discovered – currently not
 * indexed"). lastmod is the only crawl-priority signal we have, and we were
 * spending it on noise.
 *
 * The fix keeps a committed ledger of per-page content fingerprints
 * (data/sitemapLastmod.json). Two things silently undo it, and this gate exists
 * for both:
 *
 *   1. The ledger stops being tracked by git. Netlify builds from a clean
 *      checkout, so an untracked ledger is an EMPTY ledger there — every deploy
 *      would re-stamp all 9.536 pages with the deploy date. The build would look
 *      perfect locally and be broken in production.
 *   2. The fingerprint starts covering volatile markup. Vite renames every asset
 *      chunk when any code changes, so a fingerprint that includes <script>/<link>
 *      tags marks the whole site as modified on any code edit — the original bug,
 *      wearing a ledger as a disguise.
 *
 * Both are checked by driving the real fingerprint function, not a copy.
 */

import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitemapContentFingerprint } from '../utils/sitemapFingerprint.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const ledgerPath = path.join(projectRoot, 'data', 'sitemapLastmod.json');
const sitemapPath = path.join(projectRoot, 'dist', 'sitemap.xml');

const failures = [];
const note = (message) => console.log(`  ${message}`);

// ── 1. The ledger must be tracked by git ────────────────────────────────────
let tracked = false;
try {
  execFileSync('git', ['ls-files', '--error-unmatch', 'data/sitemapLastmod.json'], {
    cwd: projectRoot,
    stdio: 'pipe',
  });
  tracked = true;
} catch {
  tracked = false;
}
if (!tracked) {
  failures.push(
    'data/sitemapLastmod.json is NOT tracked by git. Netlify builds from a clean checkout, ' +
      'so it would start from an empty ledger and stamp every page with the deploy date. ' +
      'Run: git add data/sitemapLastmod.json'
  );
} else {
  note('ledger is tracked by git ✓');
}

// ── 2. The ledger must cover the sitemap ────────────────────────────────────
let ledger = null;
try {
  ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
} catch (error) {
  failures.push(`data/sitemapLastmod.json is missing or unreadable: ${error.message}`);
}

let sitemapXml = null;
try {
  sitemapXml = await readFile(sitemapPath, 'utf8');
} catch {
  note('dist/sitemap.xml not built — skipping coverage and date checks');
}

if (ledger && sitemapXml) {
  const entries = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod>/g)].map(
    (m) => ({ url: m[1], lastmod: m[2] })
  );
  if (entries.length === 0) failures.push('dist/sitemap.xml has no <loc>/<lastmod> pairs to check.');

  const pathOf = (url) => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  };

  let missing = 0;
  let mismatched = 0;
  const today = new Date().toISOString().slice(0, 10);
  let future = 0;

  for (const entry of entries) {
    const row = ledger[pathOf(entry.url)];
    if (typeof row !== 'string') {
      missing += 1;
      continue;
    }
    const date = row.slice(row.lastIndexOf(':') + 1);
    if (date !== entry.lastmod) mismatched += 1;
    if (entry.lastmod > today) future += 1;
  }

  if (missing > 0) {
    failures.push(
      `${missing} of ${entries.length} sitemap URLs have no ledger row — their date is invented, not measured.`
    );
  }
  if (mismatched > 0) {
    failures.push(
      `${mismatched} sitemap <lastmod> values disagree with the ledger. Something is writing dates ` +
        'outside the ledger; that is the old bug returning.'
    );
  }
  if (future > 0) failures.push(`${future} sitemap dates are in the future.`);

  if (!missing && !mismatched && !future) {
    const dates = new Set(entries.map((e) => e.lastmod));
    note(`${entries.length} URLs, all backed by the ledger, ${dates.size} distinct date(s) ✓`);
    // Not a failure: on the first build after this landed, every page legitimately
    // shares one date. It becomes informative as real edits land over time.
    if (dates.size === 1) {
      note(
        'NOTE: every page still shares one date. Expected right after the ledger was created; ' +
          'if it is still true weeks from now, the fingerprint is not discriminating.'
      );
    }
  }
}

// ── 3. The fingerprint must ignore assets and notice content ────────────────
// Driven against the real exported function, so a change to it is caught here.
const basePage = `<!doctype html><html lang="en"><head>
<title>Avali Beach, Lefkada</title>
<meta name="description" content="Sandy beach, quiet.">
<link rel="canonical" href="https://calmbeach.gr/beaches/lefkada/1147-avali/">
<link rel="stylesheet" href="/assets/index-AAAA1111.css">
<script type="module" src="/assets/index-BBBB2222.js"></script>
</head><body><main><h1>Avali Beach</h1><p>A quiet sandy shore.</p></main></body></html>`;

const swappedAssets = basePage
  .replace('index-AAAA1111.css', 'index-ZZZZ9999.css')
  .replace('index-BBBB2222.js', 'index-YYYY8888.js');
const swappedDate = `${basePage}<!-- built 2026-08-16T10:00:00.000Z -->`;
const changedTitle = basePage.replace('Avali Beach, Lefkada', 'Avali Beach, Lefkada — Weather');
const changedBody = basePage.replace('A quiet sandy shore.', 'A busy organised shore with sunbeds.');
const changedDescription = basePage.replace('Sandy beach, quiet.', 'Sandy beach, organised.');

const fp = sitemapContentFingerprint;
const base = fp(basePage);

const mustMatch = [
  ['renamed asset chunks', swappedAssets],
  ['an embedded build timestamp', swappedDate],
];
for (const [label, variant] of mustMatch) {
  if (fp(variant) !== base) {
    failures.push(
      `Fingerprint changed after ${label}. That marks all 9.536 pages as modified on any code ` +
        'edit and re-creates the bug this ledger exists to fix.'
    );
  }
}

const mustDiffer = [
  ['the title', changedTitle],
  ['the visible body text', changedBody],
  ['the meta description', changedDescription],
];
for (const [label, variant] of mustDiffer) {
  if (fp(variant) === base) {
    failures.push(`Fingerprint did NOT change after editing ${label} — it is not measuring content.`);
  }
}

if (failures.length === 0) note('fingerprint ignores assets/timestamps and tracks content ✓');

// ── Report ──────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error('\nsitemap lastmod — FAIL\n');
  for (const failure of failures) console.error(`  • ${failure}`);
  process.exit(1);
}
console.log('\nPASS — <lastmod> reflects measured content change, and the ledger survives a clean checkout.');
