// Make every NON-production deploy safe to exist alongside production.
//
// Production is the Netlify deploy of `main` (CONTEXT === 'production'). Any other
// deploy — a branch deploy (our `dev`/staging environment) or a deploy preview — is
// a place to test WITHOUT touching production. This step runs at the end of `npm run
// build` and, when the build is NOT production, stamps the built site so that:
//   1. Search engines never index it        → robots.txt Disallow + <meta noindex>
//      (a crawlable copy of the site would be duplicate content and could outrank or
//       cannibalise calmbeach.gr — a real risk for this SEO-driven project).
//   2. It is visually unmistakable           → a fixed "DEV / STAGING" ribbon.
// Google Analytics is disabled separately in services/analyticsService.ts, gated on
// VITE_APP_ENV, so a test deploy can never pollute the production GA4 property.
//
// Netlify sets CONTEXT to one of: 'production' | 'deploy-preview' | 'branch-deploy' |
// 'dev'. Locally there is no CONTEXT, so a local `npm run build` is treated as
// non-production (safe default: a local dist is never public, but if it were, it is
// marked noindex).
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const distDir = 'dist';
const context = (process.env.CONTEXT || '').trim();
const appEnv = (process.env.VITE_APP_ENV || '').trim();
const isProduction = context === 'production';

if (isProduction) {
  console.log('[deploy-guards] production build — leaving robots/index untouched.');
  process.exit(0);
}

// A human label for the ribbon: prefer VITE_APP_ENV, else map the Netlify context,
// else "dev" for a local build.
const envLabel = (appEnv || (context === 'deploy-preview' ? 'preview' : context) || 'dev')
  .toUpperCase();

const NOINDEX_META = '<meta name="robots" content="noindex, nofollow" />';

const RIBBON = `<div id="deploy-env-ribbon" style="position:fixed;top:0;left:0;z-index:2147483647;background:#b91c1c;color:#fff;font:600 11px/1.4 system-ui,sans-serif;padding:3px 10px;border-bottom-right-radius:6px;letter-spacing:.05em;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.3)">${envLabel} · not production</div>`;

/** Recursively collect every .html file under a directory. */
const collectHtml = async (dir) => {
  const out = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectHtml(full)));
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
};

const stampHtml = (html) => {
  let next = html;

  // 1) Force noindex: replace any existing robots meta, else inject into <head>.
  if (/<meta\s+name=["']robots["'][^>]*>/i.test(next)) {
    next = next.replace(/<meta\s+name=["']robots["'][^>]*>/i, NOINDEX_META);
  } else if (/<head[^>]*>/i.test(next)) {
    next = next.replace(/<head[^>]*>/i, (m) => `${m}\n    ${NOINDEX_META}`);
  }

  // 2) Inject the visible ribbon once, right after <body>.
  if (!next.includes('id="deploy-env-ribbon"') && /<body[^>]*>/i.test(next)) {
    next = next.replace(/<body[^>]*>/i, (m) => `${m}${RIBBON}`);
  }

  return next;
};

const main = async () => {
  // robots.txt — block all crawling on non-production deploys.
  const robotsPath = path.join(distDir, 'robots.txt');
  await writeFile(robotsPath, 'User-agent: *\nDisallow: /\n', 'utf8');

  // Stamp every prerendered HTML page with noindex + the ribbon.
  const htmlFiles = await collectHtml(distDir);
  let stamped = 0;
  for (const file of htmlFiles) {
    try {
      const original = await readFile(file, 'utf8');
      const next = stampHtml(original);
      if (next !== original) {
        await writeFile(file, next, 'utf8');
        stamped += 1;
      }
    } catch (error) {
      console.warn(`[deploy-guards] skipped ${file} (${error?.message || error})`);
    }
  }

  console.log(
    `[deploy-guards] non-production build (${envLabel}) — robots.txt set to Disallow, ${stamped} HTML page(s) marked noindex + ribboned.`
  );
};

main().catch((error) => {
  // Never fail a deploy over the guard; worst case the test deploy is missing a
  // noindex tag, which is caught by the robots.txt Disallow anyway.
  console.warn(`[deploy-guards] skipped (${error?.message || error})`);
});
