#!/usr/bin/env node
/**
 * Bundle secret guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-28 an audit found that vite.config.ts did two things which, together, were one
 * command away from publishing a private API key:
 *
 *   const env = loadEnv(mode, '.', '');            // empty prefix: loads EVERY env var
 *   define: { 'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY) }
 *
 * `define` substitutes its values into the client bundle as literals, bypassing Vite's
 * VITE_ prefix convention entirely. Nothing had leaked — only because GEMINI_API_KEY was
 * never set. The day anyone added it to the Netlify build environment (an entirely normal
 * thing to do for a "server-side" key) it would have been written into the JavaScript every
 * visitor downloads, with no warning and no error.
 *
 * Both halves were removed. This check exists so neither can come back quietly.
 *
 * WHAT IT CHECKS
 *   1. vite.config.ts still calls loadEnv with a non-empty prefix.
 *   2. vite.config.ts has no `define` block feeding it values from the env object.
 *   3. The built bundle contains no key-shaped literal (Google, OpenAI, GitHub, AWS,
 *      Slack, Telegram bot tokens, PEM private keys).
 *
 * Check 3 needs dist/, so in the critical gate this runs immediately after the build.
 * Run standalone with:  node scripts/validateBundleSecrets.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

const failures = [];
const notes = [];

/* ------------------------------------------------------------------ 1 + 2: the config */

const viteConfigPath = path.join(rootDir, 'vite.config.ts');
const viteConfig = readFileSync(viteConfigPath, 'utf8');

// Strip comments so the explanatory prose above `define:` (and in this repo there is a lot
// of it) cannot satisfy or trip the checks below.
const withoutComments = viteConfig
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1');

const loadEnvCall = withoutComments.match(/loadEnv\s*\(([^)]*)\)/);
if (!loadEnvCall) {
  notes.push('vite.config.ts no longer calls loadEnv — prefix check skipped.');
} else {
  const args = loadEnvCall[1].split(',').map(part => part.trim());
  const prefix = args[2];
  if (prefix === undefined) {
    // Vite's own default is 'VITE_', so an omitted third argument is safe.
    notes.push('loadEnv uses the default VITE_ prefix.');
  } else if (prefix === "''" || prefix === '""' || prefix === '``') {
    failures.push(
      `vite.config.ts calls loadEnv with an EMPTY prefix (${loadEnvCall[0]}).\n` +
      '    That loads every server-side secret in the build environment into `env`,\n' +
      '    where a single define/replace can inline it into the public bundle.\n' +
      "    Fix: use loadEnv(mode, '.', 'VITE_')."
    );
  }
}

const defineBlock = withoutComments.match(/\bdefine\s*:\s*\{([\s\S]*?)\}/);
if (defineBlock) {
  const body = defineBlock[1];
  const injectsEnv = /\benv\s*[.[]/.test(body) || /process\.env\b/.test(body);
  if (injectsEnv) {
    failures.push(
      'vite.config.ts has a `define` block that injects environment values into the bundle:\n' +
      `    ${body.trim().split('\n').map(l => l.trim()).join(' ')}\n` +
      '    `define` bypasses the VITE_ prefix — whatever it names becomes a public literal.\n' +
      '    Fix: delete it, or use a VITE_-prefixed variable that is meant to be public.'
    );
  }
}

/* ------------------------------------------------------------------ 2b: the service_role key

 * Accounts brought a second kind of key into the project, and the two look
 * identical to a human: Supabase issues both the anon key and the service_role key
 * as JWTs starting `eyJ`. The anon key is MEANT to ship — Row Level Security is the
 * real boundary, and the app cannot talk to Supabase without it. The service_role
 * key BYPASSES Row Level Security entirely: in a public bundle it is read/write
 * access to every user's rows, and it cannot be un-leaked by a rollback because
 * every visitor who loaded the page already has a copy.
 *
 * So a blanket "no JWTs in dist" rule would be wrong (it would ban the anon key)
 * and a blanket allow is dangerous. The check decodes each JWT payload and looks at
 * the role claim — the only thing that actually distinguishes them.
 */

const decodeJwtRole = (token) => {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const json = Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return typeof parsed?.role === 'string' ? parsed.role : null;
  } catch {
    return null; // not a JWT we can read — the generic patterns still apply
  }
};

const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

// A VITE_-prefixed name containing SERVICE_ROLE is a leak waiting for someone to
// set it: Vite ships every VITE_ variable to the browser by definition.
for (const [file, source] of [['vite.config.ts', viteConfig]]) {
  if (/VITE_[A-Z0-9_]*SERVICE_ROLE/.test(source)) {
    failures.push(
      `${file} references a VITE_…SERVICE_ROLE variable.\n` +
      '    Every VITE_ variable is compiled into the public bundle. The service_role key\n' +
      '    bypasses Row Level Security — it belongs only in the Netlify function environment,\n' +
      '    named SUPABASE_SERVICE_ROLE_KEY with no VITE_ prefix.'
    );
  }
}

/* ------------------------------------------------------------------ 3: the built bundle */

// Literals that are known-harmless and must not fail the build. These are Google's own
// documentation placeholders, which ship inside the Firebase SDK; netlify.toml omits the
// same two values from its secret scanner for the same reason.
const ALLOWED_LITERALS = [
  'AIzaSyDOCAbC123dEf456GhI789jKl012-MnO',
  'AIzaSyD-8Xy_KfR9tGvqLp0mNzE1aB2cD3eF4gH',
];

const PATTERNS = [
  { name: 'Google API key',      re: /AIza[0-9A-Za-z_-]{35}/g },
  // Supabase's newer secret format. Its public counterpart is `sb_publishable_`,
  // which is meant to ship — only the secret one is a failure.
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/g },
  { name: 'OpenAI-style key',    re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { name: 'GitHub token',        re: /\bgh[pousr]_[A-Za-z0-9]{36,}/g },
  { name: 'AWS access key id',   re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'Slack token',         re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  { name: 'Telegram bot token',  re: /\b\d{8,12}:[A-Za-z0-9_-]{35}\b/g },
  { name: 'PEM private key',     re: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/g },
];

const collectFiles = (dir, extensions, acc = []) => {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, extensions, acc);
    else if (extensions.includes(path.extname(full))) acc.push(full);
  }
  return acc;
};

let scannedFiles = 0;
if (!existsSync(distDir)) {
  notes.push('dist/ not found — bundle scan skipped. Run `npm run build` first for the full check.');
} else {
  const files = collectFiles(distDir, ['.js', '.mjs', '.css', '.html']);
  scannedFiles = files.length;
  for (const file of files) {
    const contents = readFileSync(file, 'utf8');

    for (const token of contents.match(JWT_RE) || []) {
      const role = decodeJwtRole(token);
      if (role && role !== 'anon' && role !== 'authenticated') {
        failures.push(
          `A "${role}" JWT is in the built bundle: ${path.relative(rootDir, file)}\n` +
          `    value: ${token.slice(0, 12)}…${token.slice(-4)}\n` +
          '    The service_role key bypasses Row Level Security — in a public bundle it is\n' +
          '    full read/write on every user\'s data, and a rollback cannot take it back.\n' +
          '    ROTATE IT NOW in the Supabase dashboard, then find what shipped it (a VITE_\n' +
          '    variable, a define block, or a committed .env).'
        );
      }
    }

    for (const { name, re } of PATTERNS) {
      for (const match of contents.match(re) || []) {
        if (ALLOWED_LITERALS.includes(match)) continue;
        const preview = `${match.slice(0, 8)}…${match.slice(-4)}`;
        failures.push(
          `${name} found in the built bundle: ${path.relative(rootDir, file)}\n` +
          `    value: ${preview}\n` +
          '    Anything in dist/ is downloaded by every visitor. Revoke this key, then find\n' +
          '    what put it there (a VITE_ variable, a define block, or a committed file).'
        );
      }
    }
  }
}

/* ------------------------------------------------------------------ report */

console.log('Bundle secret guard');
console.log(`  vite.config.ts: checked loadEnv prefix and define block`);
console.log(`  bundle: scanned ${scannedFiles} file(s) in dist/`);
for (const note of notes) console.log(`  note: ${note}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s) found:\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log('\nOK — no secret can reach the client bundle through the build config.');
