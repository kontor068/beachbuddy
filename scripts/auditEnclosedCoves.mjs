// Wrapper: compiles scripts/auditEnclosedCoves.ts with the local tsc and runs it
// (same pattern as dumpRegionExposureEngine.mjs).
//   node scripts/auditEnclosedCoves.mjs --json .tmp/cove-audit.json
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.tmp', 'cove-audit-build');
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
    path.join(root, 'scripts', 'auditEnclosedCoves.ts'),
  ], { cwd: root, stdio: 'inherit' });

  execFileSync(process.execPath, [
    path.join(outDir, 'scripts', 'auditEnclosedCoves.js'),
    ...process.argv.slice(2),
  ], { cwd: root, stdio: 'inherit' });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}
