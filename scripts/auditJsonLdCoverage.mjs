/**
 * JSON-LD coverage across the WHOLE build output: how many of the ~9,474 pages
 * carry structured data, broken down by schema.org @type, and which pages have
 * none — as opposed to auditSeoPrerender.mjs's checkPage(), which only asserts
 * required/recommended types on ~7 hand-picked sample URLs.
 *
 * Requires a build: run `npm run build` first.
 *
 * Run: node scripts/auditJsonLdCoverage.mjs
 * Writes: reports/seo/jsonld-coverage.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const outDir = path.join(rootDir, 'reports', 'seo');

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

const typesOf = (node) => {
  if (!node || typeof node !== 'object') return [];
  const t = node['@type'];
  if (!t) return [];
  return Array.isArray(t) ? t : [t];
};

const files = walkHtml(distDir);
const typeCounts = new Map();
let pagesWithLd = 0;
let parseFailures = [];
const zeroLdPages = [];
const categoryZero = new Map();

const categoryOf = (urlPath) => {
  const seg = urlPath.replace(/^\/(el|de|fr|it)\//, '/').split('/').filter(Boolean)[0];
  return seg || 'root';
};

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const canonicalMatch = html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  const urlPath = path.relative(distDir, path.dirname(file)).split(path.sep).join('/');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  if (blocks.length === 0) {
    zeroLdPages.push('/' + urlPath);
    const cat = categoryOf('/' + urlPath);
    categoryZero.set(cat, (categoryZero.get(cat) || 0) + 1);
    continue;
  }
  let sawAny = false;
  for (const [, raw] of blocks) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parseFailures.push(canonicalMatch ? canonicalMatch[1] : urlPath);
      continue;
    }
    const nodes = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
    for (const node of nodes) {
      for (const t of typesOf(node)) {
        typeCounts.set(t, (typeCounts.get(t) || 0) + 1);
        sawAny = true;
      }
    }
  }
  if (sawAny) pagesWithLd += 1;
  else {
    zeroLdPages.push('/' + urlPath);
    const cat = categoryOf('/' + urlPath);
    categoryZero.set(cat, (categoryZero.get(cat) || 0) + 1);
  }
}

fs.mkdirSync(outDir, { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  totalPages: files.length,
  pagesWithJsonLd: pagesWithLd,
  pagesWithoutJsonLd: files.length - pagesWithLd,
  parseFailureCount: parseFailures.length,
  parseFailures: parseFailures.slice(0, 50),
  typeCounts: Object.fromEntries([...typeCounts.entries()].sort((a, b) => b[1] - a[1])),
  zeroLdByCategory: Object.fromEntries([...categoryZero.entries()].sort((a, b) => b[1] - a[1])),
  zeroLdSample: zeroLdPages.slice(0, 100),
};
fs.writeFileSync(path.join(outDir, 'jsonld-coverage.json'), JSON.stringify(report, null, 2), 'utf8');

console.log(`JSON-LD coverage — ${files.length} pages`);
console.log(`With JSON-LD:    ${pagesWithLd} (${((pagesWithLd / files.length) * 100).toFixed(1)}%)`);
console.log(`Without:         ${files.length - pagesWithLd}`);
console.log(`Parse failures:  ${parseFailures.length}`);
console.log('\nBy @type:');
for (const [t, c] of [...typeCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c.toString().padStart(5)}  ${t}`);
console.log('\nPages without JSON-LD, by top-level path segment:');
for (const [cat, c] of [...categoryZero.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c.toString().padStart(5)}  ${cat}`);
console.log('\nWrote reports/seo/jsonld-coverage.json');
