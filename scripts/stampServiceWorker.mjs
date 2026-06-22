// Stamp the built service worker with a unique per-deploy build id.
//
// The app's code ships in content-hashed JS chunks, but service-worker.js itself
// is usually byte-identical across deploys — so the browser never detects a new
// SW and an already-open tab keeps running the old bundle until a manual refresh.
// Injecting a unique build id (commit SHA on Netlify, else build time) changes the
// SW bytes every deploy, so the browser installs the new SW, it skipWaiting/claims,
// and the app's controllerchange handler reloads the tab into the fresh build.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const swPath = path.join('dist', 'service-worker.js');
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
