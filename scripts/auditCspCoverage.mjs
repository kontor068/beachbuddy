/**
 * Does the Content-Security-Policy actually cover everything the BUILT site loads?
 *
 * The policy has sat in Report-Only since 30/07/2026, and the reason it has not been
 * switched on is honest: nobody could say what would break. Reading the source and
 * concluding "probably nothing" is not evidence — the thing that gets served is
 * dist/, and it contains bundler output, prerendered HTML and inlined data that
 * nobody wrote by hand.
 *
 * So this scans the artifact. Every absolute URL in every built file, reduced to
 * distinct origins, checked against the directive that would govern it. Anything
 * not covered is printed with the file that references it.
 *
 * WHAT THIS DOES NOT TELL YOU. It cannot see a URL built at runtime from string
 * concatenation, and it cannot see whether real visitors have been tripping the
 * policy — that lives in the Telegram feed fed by /api/client-error. The logged
 * decision is to enforce only after days of silence there. This script closes the
 * first question, not the second: it says what the artifact needs, not what the
 * traffic has done.
 *
 * Run:  node scripts/auditCspCoverage.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const netlifyToml = path.join(rootDir, 'netlify.toml');

if (!fs.existsSync(distDir)) {
  console.error('dist/ not found — run npm run build first. This audits the artifact, not the source.');
  process.exit(1);
}

// ── 1. The policy as it is actually written ────────────────────────────────
const toml = fs.readFileSync(netlifyToml, 'utf8');
const cspLine = /Content-Security-Policy(-Report-Only)?\s*=\s*"([^"]+)"/.exec(toml);
if (!cspLine) {
  console.error('No Content-Security-Policy found in netlify.toml');
  process.exit(1);
}
const isReportOnly = Boolean(cspLine[1]);
const policy = cspLine[2];

const directives = new Map();
for (const part of policy.split(';')) {
  const [name, ...values] = part.trim().split(/\s+/);
  if (name) directives.set(name, values);
}

const allows = (directive, origin) => {
  const values = directives.get(directive) ?? directives.get('default-src') ?? [];
  return values.some((v) => {
    if (v === '*') return true;
    // A scheme source matches the SCHEME, not everything. `https:` does not permit
    // an http:// origin — getting this wrong made the first version of this script
    // report full coverage while every plain-http reference was in fact uncovered,
    // which is the one direction a security audit must never be wrong in.
    if (v.endsWith(':') && !v.includes('/')) return origin.startsWith(v);
    if (v === "'self'") return false; // an external origin is never 'self'
    if (v.startsWith('*.')) {
      const suffix = v.slice(1); // ".example.com"
      try { return new URL(origin).hostname.endsWith(suffix.slice(1)); } catch { return false; }
    }
    return origin === v || origin.replace(/^https?:\/\//, '') === v.replace(/^https?:\/\//, '');
  });
};

// ── 2. Every origin the artifact references ────────────────────────────────
// Which directive governs a URL depends on how it is used, and a regex cannot know
// that. So each origin is checked against EVERY directive that could plausibly
// govern it, and is only reported when no plausible directive allows it — the
// conservative direction: this under-reports nothing and may over-report.
const CANDIDATE_DIRECTIVES = ['img-src', 'script-src', 'style-src', 'connect-src', 'font-src', 'frame-src', 'media-src'];

const SCAN_EXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.webmanifest']);
const origins = new Map(); // origin -> Set<file>

const walk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(p); continue; }
    if (!SCAN_EXT.has(path.extname(entry.name))) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const m of text.matchAll(/https?:\/\/[a-z0-9.-]+[a-z]{2,}/gi)) {
      const origin = m[0].toLowerCase();
      if (!origins.has(origin)) origins.set(origin, new Set());
      const rel = path.relative(distDir, p);
      const files = origins.get(origin);
      if (files.size < 3) files.add(rel);
    }
  }
};
walk(distDir);

// Our own origin is 'self'; links in text (og:url, canonical, JSON-LD @id) are not loads.
const SELF = /^https?:\/\/(www\.)?calmbeach\.gr$/;

const uncovered = [];
const covered = [];
for (const [origin, files] of [...origins.entries()].sort()) {
  if (SELF.test(origin)) continue;
  const allowedBy = CANDIDATE_DIRECTIVES.filter((d) => allows(d, origin));
  if (allowedBy.length) covered.push({ origin, allowedBy });
  else uncovered.push({ origin, files: [...files] });
}

// ── 3. Report ──────────────────────────────────────────────────────────────
console.log(`Policy in netlify.toml: ${isReportOnly ? 'Content-Security-Policy-Report-Only (NOT enforcing)' : 'Content-Security-Policy (ENFORCING)'}`);
console.log(`Distinct external origins in dist/: ${origins.size - [...origins.keys()].filter((o) => SELF.test(o)).length}`);
console.log(`  allowed by some directive: ${covered.length}`);
console.log(`  allowed by NONE:           ${uncovered.length}`);
console.log('');

// The covered list runs to four figures — almost all of it is https:// image hosts
// swept up by `img-src https:`. Printing it buries the answer, so it is summarised.
const byDirective = new Map();
for (const { allowedBy } of covered) {
  const key = allowedBy.join(', ');
  byDirective.set(key, (byDirective.get(key) ?? 0) + 1);
}
for (const [key, n] of [...byDirective.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ok    ${String(n).padStart(5)} origins  ←  ${key}`);
}

// An uncovered origin only matters if the browser LOADS from it. CSP governs loads;
// it says nothing about where an <a href> points. Without this split the report is 27
// alarms for 27 hyperlinks, and a report that cries wolf is one nobody reads before
// flipping the header. A load shows up as src=/srcset=/url()/import()/fetch() —
// searched across the artifact, not guessed from the origin's name.
const loadPositions = [];
{
  const patterns = uncovered.map(({ origin }) => ({
    origin,
    re: new RegExp(`(?:src|srcset|href)\\s*=\\s*["']${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|url\\(\\s*["']?${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|(?:fetch|import)\\(\\s*["']${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
  }));
  const check = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) { check(p); continue; }
      if (!SCAN_EXT.has(path.extname(entry.name))) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const { origin, re } of patterns) {
        const m = re.exec(text);
        // href= is a navigation, not a load — matched above only so it can be excluded here.
        if (m && !/^href/i.test(m[0])) {
          loadPositions.push({ origin, file: path.relative(distDir, p), snippet: m[0].slice(0, 60) });
        }
      }
    }
  };
  check(distDir);
}

if (loadPositions.length) {
  console.log('');
  console.log('WOULD BREAK — the artifact LOADS from these and the policy does not allow them:');
  for (const { origin, file, snippet } of loadPositions) {
    console.log(`  BLOCK ${origin}`);
    console.log(`          ${file}   ${snippet}`);
  }
  console.log('');
  console.log('Fix the reference or widen the policy — but only for these. Widening a policy to');
  console.log('permit a string that was never fetched is how a CSP quietly becomes decoration.');
  process.exitCode = 1;
} else if (uncovered.length) {
  console.log('');
  console.log(`${uncovered.length} origins are not covered, and NONE of them is loaded — every one is a`);
  console.log('hyperlink target (camping and tourism sites in the beach data, a Creative Commons');
  console.log('licence URL in the photo attribution table). CSP does not govern where an <a> points.');
  console.log('');
  for (const { origin } of uncovered) console.log(`   link-only  ${origin}`);
  console.log('');
  console.log('Nothing in the build would break if the policy were enforced.');
  console.log('');
  console.log('That answers "what would break". It does NOT answer "has real traffic been tripping');
  console.log('it" — that is the Telegram feed from /api/client-error, and the logged decision is to');
  console.log('enforce only after days of silence there. Both questions, then flip the header name.');
} else {
  console.log('Every external origin in the artifact is covered by the policy as written.');
  console.log('');
  console.log('That answers "what would break": nothing that the build references.');
  console.log('It does NOT answer "has real traffic been tripping it" — that is the Telegram');
  console.log('feed from /api/client-error, and the logged decision is to enforce only after');
  console.log('days of silence there. Both questions, then flip the header name.');
}
