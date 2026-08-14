// Wrapper: compiles scripts/validateAccessReasonCopy.ts with the local tsc and runs it, so the
// gate measures the REAL access predicate (utils/access) and the REAL sentences
// (utils/accessReasonCopy) instead of a copy that can drift. Same pattern as
// validateConditionsFeelPhrase.mjs.
//
//   node scripts/validateAccessReasonCopy.mjs [--prove]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.tmp', 'access-reason-build');
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
    '--resolveJsonModule',
    '--rootDir', root,
    '--outDir', outDir,
    '--noEmit', 'false',
    path.join(root, 'scripts', 'validateAccessReasonCopy.ts'),
  ], { cwd: root, stdio: 'inherit' });

  execFileSync(process.execPath, [
    path.join(outDir, 'scripts', 'validateAccessReasonCopy.js'),
    ...process.argv.slice(2),
  ], { cwd: root, stdio: 'inherit' });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
