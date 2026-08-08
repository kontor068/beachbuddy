#!/usr/bin/env node
/**
 * Auth ↔ Content-Security-Policy guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * The site serves an ENFORCING Content-Security-Policy from netlify.toml. Its
 * `connect-src` is an allow-list, so the browser silently refuses any request to a
 * host that is not on it. Nothing throws in a way a developer would notice: the
 * sign-in button just does nothing, and only in production — locally there is no
 * CSP header at all, so it works perfectly on the machine where it was written.
 *
 * That is the exact failure this project keeps having to relearn (the CSP once
 * blocked GA4 for weeks). So the rule is mechanical instead of remembered:
 *
 *   If VITE_SUPABASE_URL is set, its origin MUST be in the connect-src list.
 *
 * The check is skipped entirely when accounts are not configured, so it costs
 * nothing until the day it matters.
 *
 * WHAT IT DELIBERATELY DOES NOT REQUIRE
 *   • script-src — supabase-js is bundled from our own origin, and we use the
 *     redirect flow, not Google One Tap's remote gsi/client script.
 *   • frame-src  — no iframe is involved in the redirect flow.
 *   • img-src    — already `https:`, which covers Google avatars and the photo
 *                  bucket.
 *   • form-action — the hop to accounts.google.com is a top-level navigation,
 *     which form-action does not govern.
 *
 * It also REFUSES a wildcard. `https://*.supabase.co` would allow the browser to
 * send our users' data to every Supabase tenant on the internet, which is a
 * data-exfiltration hole dressed as convenience.
 *
 * Run standalone with:  node scripts/validateAuthCsp.mjs
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const netlifyTomlPath = path.join(rootDir, 'netlify.toml');

/** VITE_SUPABASE_URL may come from the build env or from a local .env file. */
const readConfiguredUrl = () => {
  const fromEnv = (process.env.VITE_SUPABASE_URL || '').trim();
  if (fromEnv) return { value: fromEnv, source: 'environment' };

  for (const name of ['.env.local', '.env.production', '.env']) {
    try {
      const contents = readFileSync(path.join(rootDir, name), 'utf8');
      const match = contents.match(/^\s*VITE_SUPABASE_URL\s*=\s*(.+)\s*$/m);
      if (match) {
        const value = match[1].trim().replace(/^["']|["']$/g, '');
        if (value) return { value, source: name };
      }
    } catch {
      /* file absent — normal */
    }
  }
  return { value: '', source: '' };
};

const { value: supabaseUrl, source } = readConfiguredUrl();

console.log('Auth ↔ CSP guard');

if (!supabaseUrl) {
  console.log('  Accounts are not configured (no VITE_SUPABASE_URL) — nothing to check.');
  console.log('\nOK.');
  process.exit(0);
}

let origin = '';
try {
  origin = new URL(supabaseUrl).origin;
} catch {
  console.error(`\nVITE_SUPABASE_URL is not a valid URL: ${supabaseUrl}`);
  process.exit(1);
}

const toml = readFileSync(netlifyTomlPath, 'utf8');
const cspMatch = toml.match(/^\s*Content-Security-Policy(?:-Report-Only)?\s*=\s*"([^"]+)"/m);

if (!cspMatch) {
  console.error('\nNo Content-Security-Policy found in netlify.toml. Accounts are configured but the policy that has to permit them is missing — check the header block.');
  process.exit(1);
}

const csp = cspMatch[1];
const connectSrc = (csp.match(/connect-src([^;]*)/) || [, ''])[1].trim().split(/\s+/).filter(Boolean);

const failures = [];

const wildcards = connectSrc.filter(entry => entry.includes('*') && entry.includes('supabase'));
if (wildcards.length > 0) {
  failures.push(
    `connect-src contains a Supabase WILDCARD: ${wildcards.join(', ')}\n` +
    '    That allows the browser to connect to every Supabase project on the internet,\n' +
    `    not just ours. Replace it with the exact origin: ${origin}`
  );
}

if (!connectSrc.includes(origin)) {
  failures.push(
    `connect-src does not allow ${origin}\n` +
    `    (VITE_SUPABASE_URL comes from: ${source})\n` +
    '    In production the browser will refuse every request to Supabase — sign-in, saved\n' +
    '    beaches and photo uploads all fail silently, and it works fine locally because\n' +
    '    there is no CSP header there.\n' +
    `    Fix: add ${origin} to the connect-src list in netlify.toml.`
  );
}

console.log(`  Supabase origin: ${origin} (from ${source})`);
console.log(`  connect-src entries: ${connectSrc.length}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s) found:\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log('\nOK — the policy allows exactly the Supabase project this build talks to.');
