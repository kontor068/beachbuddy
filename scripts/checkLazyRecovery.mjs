// Guard: every lazily-loaded component must go through lazyWithChunkRecovery.
//
// WHY THIS EXISTS
// A bare `React.lazy(() => import('./X'))` looks harmless and is not. React reads
// `.default` off whatever the import resolves to. When the chunk does not arrive —
// a deploy landed mid-session, a phone on island 4G dropped one request — the import
// resolves to nothing and React throws from inside its own initialiser:
//
//   Chrome:  Cannot read properties of undefined (reading 'default')
//   Safari:  undefined is not an object (evaluating 's.default')
//
// The visitor gets the error screen instead of the beach, the stack names a minified
// variable, and none of it routes into utils/chunkLoadRecovery.ts — which would have
// cleared the runtime caches and reloaded once into the current build.
//
// This is not hypothetical. App.tsx wrapped every lazy component; pages/BeachDetailPage.tsx
// carried a second, unwrapped copy of the map, and on 03/08/2026 it produced exactly
// that crash on /it/beaches/lefkada/1154-afteli/ and /de/beaches/mykonos/1963-merchia/.
// One missed call site, seven weeks after the recovery helper was written.
//
// So the rule is enforced by a script rather than by remembering it.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['App.tsx', 'index.tsx', 'pages', 'components', 'src', 'hooks'];
const ALLOWED = new Set([path.normalize('utils/chunkLoadRecovery.ts')]);
const BARE_LAZY = /(?:React\.lazy|(?<![A-Za-z0-9_$.])lazy)\s*\(/g;

const collect = async (entry) => {
  const files = [];
  const walk = async (target) => {
    let entries;
    try {
      entries = await readdir(target, { withFileTypes: true });
    } catch {
      return; // a root that does not exist in this checkout is not an error
    }
    for (const item of entries) {
      const full = path.join(target, item.name);
      if (item.isDirectory()) {
        if (item.name === 'node_modules' || item.name === 'dist') continue;
        await walk(full);
      } else if (/\.(tsx|ts)$/.test(item.name)) {
        files.push(full);
      }
    }
  };

  if (/\.(tsx|ts)$/.test(entry)) {
    files.push(entry);
  } else {
    await walk(entry);
  }
  return files;
};

const offenders = [];

for (const root of ROOTS) {
  for (const file of await collect(root)) {
    if (ALLOWED.has(path.normalize(file))) continue;

    const source = await readFile(file, 'utf8');
    for (const match of source.matchAll(BARE_LAZY)) {
      const line = source.slice(0, match.index).split('\n').length;
      const text = source.split('\n')[line - 1].trim();
      offenders.push({ file, line, text });
    }
  }
}

if (offenders.length > 0) {
  console.error('\n❌ Lazy components without chunk-load recovery:\n');
  for (const { file, line, text } of offenders) {
    console.error(`   ${file}:${line}\n     ${text}`);
  }
  console.error(
    '\nUse lazyWithChunkRecovery(() => import(...), \'Name\') from utils/chunkLoadRecovery.',
    '\nA bare React.lazy turns a dropped request into a white screen with no recovery.\n'
  );
  process.exit(1);
}

console.log('✅ lazy-recovery: every lazily-loaded component routes through lazyWithChunkRecovery.');
