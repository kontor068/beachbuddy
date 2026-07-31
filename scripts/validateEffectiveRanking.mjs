// Wrapper: compiles scripts/validateEffectiveRanking.ts with the local tsc and runs
// it, so the validator can call the REAL production TypeScript (assessBeachWindExposure,
// resolveDisplayWaveHeightM) instead of a re-implementation. Same pattern as
// validateMeltemiMatrix.mjs.
//
//   node scripts/validateEffectiveRanking.mjs [--dry-run] [--replay [YYYY-MM-DD]]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.tmp', 'effective-ranking-build');
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
    path.join(root, 'scripts', 'validateEffectiveRanking.ts'),
  ], { cwd: root, stdio: 'inherit' });

  execFileSync(process.execPath, [
    path.join(outDir, 'scripts', 'validateEffectiveRanking.js'),
    ...process.argv.slice(2),
  ], { cwd: root, stdio: 'inherit' });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
