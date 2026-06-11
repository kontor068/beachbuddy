// Wrapper: compiles scripts/auditNationalPins.ts with the local tsc
// (same pattern as buildGeospatialExposureProfiles.mjs) and runs it with the
// given CLI arguments, e.g.:
//   node scripts/auditNationalPins.mjs --region south-aegean-milos --json .tmp/milos-dump.json
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, '.tmp', 'national-pins-build');
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
    path.join(root, 'scripts', 'auditNationalPins.ts'),
  ], {
    cwd: root,
    stdio: 'inherit',
  });

  execFileSync(process.execPath, [
    path.join(outDir, 'scripts', 'auditNationalPins.js'),
    ...process.argv.slice(2),
  ], {
    cwd: root,
    stdio: 'inherit',
  });
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

