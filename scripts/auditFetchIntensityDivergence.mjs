// Wrapper: compiles scripts/auditFetchIntensityDivergence.ts with the local tsc
// (same pattern as auditNationalPins.mjs) and runs it, e.g.:
//   node scripts/auditFetchIntensityDivergence.mjs [--json .tmp/geospatial/fetch-intensity-divergence.json]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.tmp', 'fetch-intensity-divergence-build');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

if (!existsSync(tsc)) {
  throw new Error('Local TypeScript compiler not found. Run npm install first.');
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n', 'utf8');

try {
  execFileSync(process.execPath, [tsc,
    '--module', 'CommonJS',
    '--target', 'ES2020',
    '--moduleResolution', 'Node',
    '--skipLibCheck',
    '--esModuleInterop',
    '--allowJs',
    '--allowSyntheticDefaultImports',
    '--rootDir', root,
    '--outDir', outDir,
    '--noEmit', 'false',
    path.join(root, 'scripts', 'auditFetchIntensityDivergence.ts'),
  ], {
    cwd: root,
    stdio: 'inherit',
  });

  execFileSync(process.execPath, [
    path.join(outDir, 'scripts', 'auditFetchIntensityDivergence.js'),
    ...process.argv.slice(2),
  ], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
