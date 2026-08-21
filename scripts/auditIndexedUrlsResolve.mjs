/**
 * Indexed URLs: the gate for "Google ranks it, and it opens".
 *
 * Written BEFORE the 21/08/2026 redirect fix, on purpose. The Search Console
 * audit of 21/08 crossed the 4.160 URLs that actually earn impressions against
 * the built site and found 24 of them returning a plain 404 — there is no
 * catch-all in dist/_redirects, so a retired page is simply gone. Two causes,
 * both in scripts/prerenderBeachPages.mjs:
 *
 *   (a) a beach slug rename emitted its 301 for the bare English URL only, so
 *       /el|de|fr|it/beaches/{region}/{id}-{oldSlug}/ stayed dead, and
 *   (b) only the `sheltered` guide got a retirement 301; the other seven topics
 *       (sunset, family, organized, snorkeling, secluded, sandy, beachbar) had
 *       no protection at all, so the 200-340° sunset gate killed Patmos, Lipsi,
 *       Telendos and Lasithi and left 145 impressions on 404s.
 *
 * This file asserts the outcome, not the mechanism: no URL Google has actually
 * shown to somebody may fail to resolve. It must FAIL on the pre-fix build —
 * that is how we know it is not decorative. See docs/team/10-seo-specialist.md
 * (21/08) for the measurement.
 *
 * Netlify semantics replicated here, both verified in the official docs 21/08:
 *   - a non-forced rule (no `!`) does NOT apply when a real file sits at the
 *     path, so a wildcard never shadows a published page;
 *   - `:placeholder` matches exactly one path segment, `/*` matches the rest.
 *
 * A 301 pointing at a page that does not exist counts as a failure too: the
 * visitor still lands on "not found", one hop later.
 *
 * Requires a build: run `npm run build` first.
 *
 * Run: node scripts/auditIndexedUrlsResolve.mjs
 * Writes: reports/seo/indexed-urls.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const snapshotDir = path.join(rootDir, 'reports', 'snapshots');
const outDir = path.join(rootDir, 'reports', 'seo');

const SITE = 'https://calmbeach.gr';
const MAX_HOPS = 5;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/** Newest reports/snapshots/_raw-pages-*.json — the URLs Google actually served. */
const findPagesSnapshot = () => {
  if (!fs.existsSync(snapshotDir)) return null;
  const files = fs
    .readdirSync(snapshotDir)
    .filter((f) => /^_raw-pages.*\.json$/.test(f))
    .sort();
  return files.length ? path.join(snapshotDir, files[files.length - 1]) : null;
};

const normalize = (url) => {
  const withoutOrigin = url.startsWith(SITE) ? url.slice(SITE.length) : url;
  const withoutQuery = withoutOrigin.split(/[?#]/)[0];
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed || '/';
};

// ---------------------------------------------------------------------------
// Netlify _redirects, as Netlify reads it
// ---------------------------------------------------------------------------

const parseRedirects = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const parts = line.split(/\s+/);
      if (parts.length < 2) return null;
      const [rawFrom, to, ...rest] = parts;
      // A trailing `!` on the status code forces the rule over an existing file.
      const status = rest.find((p) => /^\d{3}!?$/.test(p)) || '301';
      return { from: rawFrom.replace(/!$/, ''), to, forced: status.endsWith('!') };
    })
    .filter(Boolean);

/**
 * Does `from` match `pathName`? Returns the substitutions so `to` can be built.
 * Both sides are compared without a trailing slash, because the generator emits
 * each rule in both forms and Netlify normalizes the difference away.
 */
const matchRule = (from, pathName) => {
  const rulePath = from.replace(/\/+$/, '') || '/';
  const target = pathName.replace(/\/+$/, '') || '/';

  if (rulePath.endsWith('/*')) {
    const base = rulePath.slice(0, -2);
    if (target === base) return { splat: '' };
    if (target.startsWith(`${base}/`)) return { splat: target.slice(base.length + 1) };
    return null;
  }

  const ruleSegments = rulePath.split('/');
  const targetSegments = target.split('/');
  if (ruleSegments.length !== targetSegments.length) return null;

  const placeholders = {};
  for (let i = 0; i < ruleSegments.length; i += 1) {
    const rs = ruleSegments[i];
    if (rs.startsWith(':')) {
      if (!targetSegments[i]) return null; // a placeholder needs a real segment
      placeholders[rs.slice(1)] = targetSegments[i];
      continue;
    }
    if (rs !== targetSegments[i]) return null;
  }
  return placeholders;
};

const applyRule = (to, subs) =>
  to.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(subs, name) ? subs[name] : whole,
  );

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

const fileExists = (pathName) => {
  if (pathName === '/') return fs.existsSync(path.join(distDir, 'index.html'));
  const rel = pathName.replace(/^\//, '').split('/').map(decodeURIComponent).join(path.sep);
  return (
    fs.existsSync(path.join(distDir, rel, 'index.html')) ||
    (fs.existsSync(path.join(distDir, rel)) && fs.statSync(path.join(distDir, rel)).isFile())
  );
};

/**
 * Walk a URL the way Netlify would: file first, then the first matching
 * non-forced rule, following hops until we land on a file or run out.
 */
const resolve = (startPath, rules) => {
  const chain = [];
  let current = startPath;

  for (let hop = 0; hop < MAX_HOPS; hop += 1) {
    if (fileExists(current)) {
      return { ok: true, via: chain.length ? 'redirect' : 'file', chain, final: current };
    }
    const hit = rules
      .map((rule) => ({ rule, subs: matchRule(rule.from, current) }))
      .find((candidate) => candidate.subs !== null);

    if (!hit) return { ok: false, reason: '404 — no file, no redirect', chain, final: current };

    const next = normalize(applyRule(hit.rule.to, hit.subs));
    if (chain.includes(next)) {
      return { ok: false, reason: 'redirect loop', chain, final: current };
    }
    chain.push(next);
    current = next;
  }

  return { ok: false, reason: `more than ${MAX_HOPS} redirect hops`, chain, final: current };
};

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

if (!fs.existsSync(distDir)) {
  console.error('dist/ is missing — run `npm run build` first.');
  process.exit(1);
}

const snapshotPath = findPagesSnapshot();
if (!snapshotPath) {
  // No snapshot on disk is not a failure: this gate is only as good as the data
  // it has, and a fresh clone has none. Say so loudly instead of passing quietly.
  console.log('Indexed URLs — SKIPPED: no reports/snapshots/_raw-pages-*.json on disk.');
  console.log('Run `npm run seo:snapshot` to produce one, then re-run this check.');
  process.exit(0);
}

const redirectsPath = path.join(distDir, '_redirects');
const rules = fs.existsSync(redirectsPath)
  ? parseRedirects(fs.readFileSync(redirectsPath, 'utf8'))
  : [];

const rows = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const pages = (Array.isArray(rows) ? rows : rows.pages || []).map((r) => ({
  url: Array.isArray(r.keys) ? r.keys[0] : r.url,
  impressions: r.impressions ?? 0,
  clicks: r.clicks ?? 0,
}));

const failures = [];
let redirected = 0;
for (const page of pages) {
  const pathName = normalize(page.url);
  const outcome = resolve(pathName, rules);
  if (outcome.ok) {
    if (outcome.via === 'redirect') redirected += 1;
    continue;
  }
  failures.push({
    url: pathName,
    impressions: page.impressions,
    clicks: page.clicks,
    reason: outcome.reason,
    chain: outcome.chain,
  });
}

failures.sort((a, b) => b.impressions - a.impressions);
const lostImpressions = failures.reduce((sum, f) => sum + f.impressions, 0);
const lostClicks = failures.reduce((sum, f) => sum + f.clicks, 0);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'indexed-urls.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      snapshot: path.relative(rootDir, snapshotPath).split(path.sep).join('/'),
      redirectRules: rules.length,
      urlsChecked: pages.length,
      servedDirectly: pages.length - failures.length - redirected,
      servedViaRedirect: redirected,
      failing: failures.length,
      lostImpressions,
      lostClicks,
      failures: failures.slice(0, 200),
    },
    null,
    2,
  ),
  'utf8',
);

console.log(`Indexed URLs — ${pages.length} checked against ${rules.length} redirect rules`);
console.log(`  ${pages.length - failures.length - redirected} served directly · ${redirected} via redirect`);

if (!failures.length) {
  console.log('Every URL Google has shown still resolves.');
  console.log('Wrote reports/seo/indexed-urls.json');
  process.exit(0);
}

console.log(
  `\nFAILING: ${failures.length} of ${pages.length} — ${lostImpressions} impressions and ${lostClicks} clicks land on "not found"\n`,
);
for (const f of failures.slice(0, 40)) {
  const hop = f.chain.length ? `  (via ${f.chain.join(' → ')})` : '';
  console.log(`  ${String(f.impressions).padStart(5)} impr ${String(f.clicks).padStart(3)} clk  ${f.url}${hop}`);
}
if (failures.length > 40) console.log(`  … and ${failures.length - 40} more`);
console.log('\nFix the generator in scripts/prerenderBeachPages.mjs, not this list by hand.');
console.log('Wrote reports/seo/indexed-urls.json');
process.exit(1);
