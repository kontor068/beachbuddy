// Stamp the built service worker with a unique per-deploy build id.
//
// The app's code ships in content-hashed JS chunks, but service-worker.js itself
// is usually byte-identical across deploys — so the browser never detects a new
// SW and an already-open tab keeps running the old bundle until a manual refresh.
// Injecting a unique build id (commit SHA on Netlify, else build time) changes the
// SW bytes every deploy, so the browser installs the new SW, it skipWaiting/claims,
// and the app's controllerchange handler reloads the tab into the fresh build.
//
// The same id is also stamped into dist/index.html as <meta name="cb-build">, which
// is what crash reports carry (services/errorReporter.ts). Without it, "the site is
// broken" arrives with no way to tell whether it started with the last deploy — the
// first question anyone asks. This runs BEFORE prerenderBeachPages.mjs, which builds
// every one of the ~9.500 pages from this same index.html, so they all inherit it.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const swPath = path.join('dist', 'service-worker.js');
const indexPath = path.join('dist', 'index.html');
const buildId = (process.env.COMMIT_REF || process.env.BUILD_ID || `local-${Date.now()}`)
  .toString()
  .slice(0, 16)
  .replace(/[^a-zA-Z0-9_-]/g, '');

try {
  const original = await readFile(swPath, 'utf8');

  // Fold the build id into CACHE_NAME so each deploy also rotates the runtime cache,
  // and prepend a marker comment as a guaranteed byte-level change.
  let next = original.replace(
    /const CACHE_NAME = '([^']*)';/,
    (_match, name) => `const CACHE_NAME = '${name}-${buildId}';`
  );
  next = `// build: ${buildId}\n${next}`;

  await writeFile(swPath, next, 'utf8');
  console.log(`[stamp-sw] stamped ${swPath} with build id ${buildId}`);
} catch (error) {
  // Never fail the deploy over the stamp; the app still works, it just won't
  // auto-reload open tabs for this build.
  console.warn(`[stamp-sw] skipped (${error?.message || error})`);
}

try {
  const html = await readFile(indexPath, 'utf8');
  const meta = `<meta name="cb-build" content="${buildId}" />`;
  // Replace an existing stamp rather than accumulating one per run — this script is
  // idempotent on a dist/ that was not cleaned.
  const next = /<meta name="cb-build"[^>]*>/.test(html)
    ? html.replace(/<meta name="cb-build"[^>]*>/, meta)
    : html.replace(/<head>/i, `<head>\n    ${meta}`);

  await writeFile(indexPath, next, 'utf8');
  console.log(`[stamp-sw] stamped ${indexPath} with <meta name="cb-build" content="${buildId}">`);
} catch (error) {
  // A missing build id costs us context in a crash report, never a working page.
  console.warn(`[stamp-sw] index.html build stamp skipped (${error?.message || error})`);
}
