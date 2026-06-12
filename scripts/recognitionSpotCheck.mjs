// Compiles and runs scripts/recognitionSpotCheck.ts (same pattern as validateWindExposureEngine.mjs).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.tmp', 'recognition-spot-check');
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, 'package.json'), '{"type":"commonjs"}\n', 'utf8');

try {
  execFileSync(process.execPath, [tsc,
    '--module', 'CommonJS', '--target', 'ES2020', '--moduleResolution', 'Node',
    '--skipLibCheck', '--esModuleInterop', '--allowJs', '--allowSyntheticDefaultImports',
    '--rootDir', root, '--outDir', outDir, '--noEmit', 'false',
    path.join(root, 'scripts', 'recognitionSpotCheck.ts'),
  ], { cwd: root, stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(outDir, 'scripts', 'recognitionSpotCheck.js')], { cwd: root, stdio: 'inherit' });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
