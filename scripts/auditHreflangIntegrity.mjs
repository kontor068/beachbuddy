/**
 * hreflang integrity across the WHOLE build output, not a handful of sample
 * pages. For every page's <link rel="alternate" hreflang="..."> set:
 *   1. does every target URL actually exist as a file in dist/ (incl. x-default)
 *   2. is the set MUTUAL — does the target page link back to this one
 *   3. is the set COMPLETE — does every page in a cluster declare the same
 *      number of language alternates (catches a partial/broken set, the
 *      class of bug that put 5 landing pages' x-default in the dark — see
 *      docs/team/10-seo-specialist.md §4)
 *
 * This complements scripts/auditSeoPrerender.mjs's checkHreflangIntegrity,
 * which only checks target-file-exists on non-x-default links and explicitly
 * skips x-default (`if (hreflang === 'x-default') continue`). This script
 * covers x-default and adds mutuality + set-completeness, site-wide.
 *
 * Requires a build: run `npm run build` first (or use a script that already
 * chains it, e.g. `npm run seo:audit`), same precondition as auditSeoPrerender.
 *
 * Run: node scripts/auditHreflangIntegrity.mjs
 * Writes: reports/seo/hreflang-integrity.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outDir = path.join(rootDir, 'reports', 'seo');
const siteUrl = (process.env.SITE_URL || process.env.VITE_SITE_URL || 'https://calmbeach.gr').replace(/\/+$/, '');

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run `npm run build` first.');
  process.exit(1);
}

const walkHtml = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
};

const urlToDistFile = (url) => {
  if (!url.startsWith(siteUrl)) return null;
  let urlPath = url.slice(siteUrl.length);
  if (!urlPath.startsWith('/')) urlPath = '/' + urlPath;
  if (!urlPath.endsWith('/')) urlPath += '/';
  return path.join(distDir, urlPath, 'index.html');
};

const files = walkHtml(distDir);
const pages = new Map(); // selfUrl -> { file, alts: Map(hreflang -> href) }

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const selfUrl = canonicalMatch ? canonicalMatch[1] : null;
  if (!selfUrl) continue;
  const alts = new Map();
  const altRe = /<link\s+rel=["']alternate["']\s+hreflang=["']([^"']+)["']\s+href=["']([^"']+)["']/gi;
  let m;
  while ((m = altRe.exec(html))) alts.set(m[1], m[2]);
  pages.set(selfUrl, { file: path.relative(rootDir, file), alts });
}

const brokenTargets = []; // { page, hreflang, href }
const brokenXDefault = []; // { page, reason }
const nonMutual = []; // { page, hreflang, targetUrl }
const incompleteSets = []; // { page, ownCount, targetUrl, targetCount }

for (const [selfUrl, { file, alts }] of pages) {
  const xDefault = alts.get('x-default');
  if (!xDefault) {
    brokenXDefault.push({ page: selfUrl, reason: 'missing' });
  } else {
    const target = urlToDistFile(xDefault);
    if (!target || !fs.existsSync(target)) brokenXDefault.push({ page: selfUrl, reason: `target missing: ${xDefault}` });
  }

  const langAlts = [...alts.entries()].filter(([hreflang]) => hreflang !== 'x-default');
  for (const [hreflang, href] of langAlts) {
    const target = urlToDistFile(href);
    if (!target || !fs.existsSync(target)) {
      brokenTargets.push({ page: selfUrl, hreflang, href });
      continue;
    }
    const targetPage = pages.get(href);
    if (!targetPage) continue; // target file exists but wasn't parsed as a canonical page (shouldn't happen)
    const linksBack = [...targetPage.alts.values()].includes(selfUrl);
    if (!linksBack) nonMutual.push({ page: selfUrl, hreflang, targetUrl: href });
    const ownCount = langAlts.length;
    const targetCount = [...targetPage.alts.keys()].filter((h) => h !== 'x-default').length;
    if (ownCount !== targetCount) {
      incompleteSets.push({ page: selfUrl, ownCount, targetUrl: href, targetCount });
    }
  }
}

fs.mkdirSync(outDir, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  pagesChecked: pages.size,
  brokenXDefaultCount: brokenXDefault.length,
  brokenTargetsCount: brokenTargets.length,
  nonMutualCount: nonMutual.length,
  incompleteSetsCount: incompleteSets.length,
  brokenXDefault: brokenXDefault.slice(0, 200),
  brokenTargets: brokenTargets.slice(0, 200),
  nonMutual: nonMutual.slice(0, 200),
  incompleteSets: incompleteSets.slice(0, 200),
};
fs.writeFileSync(path.join(outDir, 'hreflang-integrity.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(`hreflang integrity — ${pages.size} pages checked`);
console.log(`Broken x-default:     ${brokenXDefault.length}`);
console.log(`Broken alt targets:   ${brokenTargets.length}`);
console.log(`Non-mutual alts:      ${nonMutual.length}`);
console.log(`Incomplete-set pairs: ${incompleteSets.length}`);
if (brokenXDefault.length) {
  console.log('\nBroken x-default (first 10):');
  for (const r of brokenXDefault.slice(0, 10)) console.log(`  ${r.page} — ${r.reason}`);
}
console.log('\nWrote reports/seo/hreflang-integrity.json');
