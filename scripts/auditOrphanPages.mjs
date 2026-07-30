/**
 * Orphan pages: URLs listed in the sitemap that no internal link, from any
 * OTHER page's rendered HTML, actually points to. Google can still discover
 * them via the sitemap alone, but an orphan page gets none of the internal
 * link equity/crawl-priority signal a linked page gets — see
 * docs/team/18-google.md §1 (crawl demand depends on perceived internal
 * linking, not just sitemap presence).
 *
 * Requires a build: run `npm run build` first.
 *
 * Run: node scripts/auditOrphanPages.mjs
 * Writes: reports/seo/orphan-pages.json
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

const sitemapPath = path.join(distDir, 'sitemap.xml');
if (!fs.existsSync(sitemapPath)) {
  console.error('dist/sitemap.xml not found.');
  process.exit(1);
}
const sitemapXml = fs.readFileSync(sitemapPath, 'utf8');
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const walkHtml = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
};

const normalize = (url) => {
  let u = url;
  if (u.startsWith('/')) u = siteUrl + u;
  if (!u.startsWith(siteUrl)) return null;
  if (!u.endsWith('/')) u += '/';
  return u.split('#')[0].split('?')[0];
};

const files = walkHtml(distDir);
const linkedFrom = new Map(); // targetUrl -> count of distinct source pages linking to it

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  const hrefs = [...body.matchAll(/<a\s[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const selfUrl = canonicalMatch ? normalize(canonicalMatch[1]) : null;
  const seen = new Set();
  for (const href of hrefs) {
    const target = normalize(href);
    if (!target || target === selfUrl || seen.has(target)) continue;
    seen.add(target);
    linkedFrom.set(target, (linkedFrom.get(target) || 0) + 1);
  }
}

const orphans = sitemapUrls.filter((u) => {
  const n = normalize(u);
  return n && n !== siteUrl + '/' && !linkedFrom.has(n);
});

fs.mkdirSync(outDir, { recursive: true });
const byPrefix = new Map();
for (const u of orphans) {
  const segPath = u.replace(siteUrl, '').replace(/^\/(el|de|fr|it)\//, '/');
  const seg = segPath.split('/').filter(Boolean)[0] || 'root';
  byPrefix.set(seg, (byPrefix.get(seg) || 0) + 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  sitemapUrlCount: sitemapUrls.length,
  orphanCount: orphans.length,
  orphanPercent: sitemapUrls.length ? +((orphans.length / sitemapUrls.length) * 100).toFixed(2) : 0,
  byTopLevelSegment: Object.fromEntries([...byPrefix.entries()].sort((a, b) => b[1] - a[1])),
  orphanUrls: orphans.slice(0, 300),
};
fs.writeFileSync(path.join(outDir, 'orphan-pages.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(`Orphan pages — ${sitemapUrls.length} sitemap URLs, ${files.length} rendered pages scanned`);
console.log(`Orphans (0 internal links found): ${orphans.length} (${report.orphanPercent}%)`);
console.log('\nBy top-level path segment:');
for (const [seg, c] of [...byPrefix.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c.toString().padStart(5)}  ${seg}`);
console.log('\nWrote reports/seo/orphan-pages.json');
