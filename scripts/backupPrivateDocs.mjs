/**
 * Archive the parts of this project that git cannot restore.
 *
 * This repository is public, so the project's own memory is deliberately
 * gitignored: docs/team/ (positioning, legal history, a map of our own weak
 * points) and docs/competitor-strategy.md. That means git is NOT the backup
 * here. Those files exist on exactly one disk, and if it dies the reasoning
 * behind every decision in this codebase dies with it — the code survives, the
 * "why" does not.
 *
 * Usage:
 *   node scripts/backupPrivateDocs.mjs <destination-folder> [--include-secrets]
 *
 * The destination is required and must be OUTSIDE the repository: a backup that
 * lives next to the thing it backs up is not a backup, and one inside the repo
 * is one `git add -A` away from being published.
 *
 * Credentials (.secrets/, .mcp.json, .claude/settings.local.json) are NOT
 * included unless you ask. A zip of passwords that then gets carried to a second
 * disk or a cloud drive is a new exposure, not a safeguard — decide that on
 * purpose, not by default.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Irreplaceable: gitignored, hand-written, not derivable from anything else.
const MEMORY_PATHS = [
  'docs/team',
  'docs/competitor-strategy.md',
];

// Regenerable in principle, but only by re-running long jobs against APIs whose
// free quota is this project's hard ceiling — the wave-model hour caches alone
// are ~25 minutes of Copernicus downloads. Cheap to carry, expensive to lose.
// reports/photo-coverage is deliberately absent: it is tracked in git AND 131 MB.
const EXPENSIVE_PATHS = [
  'reports/wave-model',
  'reports/wind-model',
  'reports/snapshots',
  // The high-res coastline mask every exposure-geometry rebuild depends on — and every NEW
  // beach requires a rebuild, so this will be needed again. Gitignored (34,7 MB), lives on
  // exactly one disk, and regenerating it means a ~700 MB OSM download + filter run
  // (scripts/fetchHighResLandMask.mjs). Added 05/08/2026 with the model lock: the locked
  // model's data must be as recoverable as the reasoning behind it.
  '.tmp/geospatial/greece-land-osm-split.geojson',
];

const SECRET_PATHS = [
  '.secrets',
  '.mcp.json',
  '.claude/settings.local.json',
];

const args = process.argv.slice(2);
const includeSecrets = args.includes('--include-secrets');
const dest = args.find((a) => !a.startsWith('--'));

if (!dest) {
  console.error('Usage: node scripts/backupPrivateDocs.mjs <destination-folder> [--include-secrets]');
  console.error('');
  console.error('Pick somewhere that is not this disk: another drive, a USB stick, a synced folder.');
  process.exit(1);
}

const destDir = path.resolve(dest);
const relToRoot = path.relative(rootDir, destDir);
if (relToRoot && !relToRoot.startsWith('..') && !path.isAbsolute(relToRoot)) {
  console.error(`Refusing: ${destDir} is inside the repository.`);
  console.error('A copy that dies with the original is not a backup, and one inside a public repo');
  console.error('is one `git add -A` away from being published. Choose a folder outside the repo.');
  process.exit(1);
}
if (!fs.existsSync(destDir)) {
  console.error(`Destination does not exist: ${destDir}`);
  process.exit(1);
}

const wanted = [...MEMORY_PATHS, ...EXPENSIVE_PATHS, ...(includeSecrets ? SECRET_PATHS : [])];
const present = wanted.filter((p) => fs.existsSync(path.join(rootDir, p)));
const absent = wanted.filter((p) => !present.includes(p));
if (!present.length) {
  console.error('Nothing to archive — none of the expected paths exist.');
  process.exit(1);
}

const dirSize = (target) => {
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.size;
  let total = 0;
  for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
    total += dirSize(path.join(target, entry.name));
  }
  return total;
};
const human = (bytes) => (bytes < 1024 * 1024
  ? `${Math.round(bytes / 1024)} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`);

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
// .tar.gz, not .zip: depending on which shell this runs from, `tar` resolves to
// either the GNU tar bundled with Git for Windows (no zip support at all) or the
// bsdtar in System32. gzip is the one format both write. Windows 11 Explorer
// opens it with a double-click.
const archive = path.join(destDir, `calmbeach-private-${stamp}.tar.gz`);

console.log('Archiving (git cannot restore these):');
let raw = 0;
for (const p of present) {
  const size = dirSize(path.join(rootDir, p));
  raw += size;
  console.log(`  ${p.padEnd(28)} ${human(size)}`);
}
if (absent.length) {
  console.log('');
  console.log(`Not on disk, skipped: ${absent.join(', ')}`);
}
if (!includeSecrets) {
  console.log('');
  console.log('Secrets NOT included (.secrets/, .mcp.json, settings.local.json).');
  console.log('Pass --include-secrets only if the destination is somewhere you would keep a password.');
}

// Written to stdout and saved from here rather than passed as `-f <path>`: on
// Windows, tar reads a leading `C:` as a remote host and dies with "Cannot
// connect to C" the moment the destination is on another drive — which is
// exactly where a backup belongs.
let buffer;
try {
  buffer = execFileSync('tar', ['-c', '-z', '-f', '-', ...present], {
    cwd: rootDir,
    maxBuffer: 512 * 1024 * 1024,
  });
} catch (err) {
  console.error('');
  console.error(`Archiving failed: ${err.message}`);
  process.exit(1);
}
fs.writeFileSync(archive, buffer);

const finalSize = fs.statSync(archive).size;
if (finalSize < 1024) {
  console.error(`Archive is suspiciously small (${finalSize} B) — treat it as failed, not as a backup.`);
  process.exit(1);
}

console.log('');
console.log(`✓ ${archive}`);
console.log(`  ${human(raw)} → ${human(finalSize)}`);
console.log('');
console.log('This holds commercial positioning, legal history and our own weak points.');
console.log('Keep it where you would keep a contract, not where you would keep a photo.');
