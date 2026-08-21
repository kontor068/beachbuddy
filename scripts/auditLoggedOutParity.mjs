#!/usr/bin/env node
/**
 * Logged-out parity guard.
 *
 * WHY THIS EXISTS
 * ---------------
 * Accounts were added on the promise that the ~99% of visitors who never sign in
 * pay nothing for them: no extra download, no extra request, no change to the
 * page a crawler reads. That promise is easy to state and very easy to break by
 * accident — one `import { createClient }` at the top of a file instead of inside
 * a dynamic import, and the Supabase SDK (57 KB gzipped) is suddenly part of the
 * first load for everybody, forever, with nothing failing to announce it.
 *
 * So the promise is a check rather than an intention. Four things must hold in
 * the BUILT output:
 *
 *   1. The Supabase SDK chunk is never preloaded by the entry HTML.
 *   2. Nothing imports the SDK statically — the only reference to its chunk must
 *      be inside a dynamic `import(...)`.
 *   3. The prerendered static content (what a crawler and a no-JS visitor see)
 *      contains no account UI.
 *   4. Visitor-contributed content, when it exists, is labelled — a UGC block
 *      that renders without its "from a visitor" label would read as our own
 *      verified data, which is the one thing it must never do.
 *
 * Run standalone with:  node scripts/auditLoggedOutParity.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(rootDir, 'dist');

const failures = [];
const notes = [];

if (!existsSync(distDir)) {
  console.error('dist/ not found. Run `npm run build` first.');
  process.exit(1);
}

/* ---------------------------------------------------------------- 1: the entry HTML */

const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8');
const preloaded = [...indexHtml.matchAll(/<link[^>]+rel=["']modulepreload["'][^>]+href=["']([^"']+)["']/gi)]
  .map(match => match[1]);
const preloadedSupabase = preloaded.filter(href => /supabase/i.test(href));

if (preloadedSupabase.length > 0) {
  failures.push(
    `The entry HTML preloads the Supabase SDK: ${preloadedSupabase.join(', ')}\n` +
    '    That is ~57 KB gzipped downloaded by every visitor, including the ones who never\n' +
    '    sign in. Something now imports services/supabaseClient.ts (or the SDK) statically\n' +
    '    from a module on the entry path. Move it behind the dynamic import in\n' +
    '    services/supabaseClient.ts.'
  );
}

/* ---------------------------------------------------------------- 2: dynamic-only */

const assetsDir = path.join(distDir, 'assets');
const jsFiles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter(name => name.endsWith('.js'))
  : [];

const supabaseChunk = jsFiles.find(name => /^supabase-vendor-/.test(name));

if (!supabaseChunk) {
  notes.push('No supabase-vendor chunk in this build — accounts are not compiled in. Nothing to check.');
} else {
  for (const name of jsFiles) {
    if (name === supabaseChunk) continue;
    const contents = readFileSync(path.join(assetsDir, name), 'utf8');
    if (!contents.includes(supabaseChunk)) continue;

    // A static import compiles to `from"./chunk.js"` or `import"./chunk.js"`;
    // a dynamic one to `import("./chunk.js")`. Only the second is acceptable.
    const staticImport = new RegExp(`(?:from|import)\\s*["']\\.\\/${supabaseChunk.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}["']`);
    if (staticImport.test(contents)) {
      failures.push(
        `${name} imports the Supabase SDK STATICALLY.\n` +
        '    A static import means the chunk downloads whenever this one does, which defeats\n' +
        '    the whole point of the seam. Use `await import(...)` — see services/supabaseClient.ts.'
      );
    }
  }
}

/* ---------------------------------------------------------------- 3 + 4: the static pages */

const walkHtml = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, out);
    else if (entry.name === 'index.html') out.push(full);
  }
  return out;
};

// Markers that must never appear in prerendered static content. The auth callback
// page is exempt: it is the one page whose entire purpose is the sign-in handshake.
const ACCOUNT_MARKERS = [
  { needle: 'data-account-ui', why: 'account UI' },
  { needle: 'supabase.co', why: 'a direct Supabase URL' },
];

// ONE deliberate hole in the rule above, opened 21/08/2026 after it was found red
// against LIVE production and had been for days — silently, because this gate runs
// only in `quality:critical` and never in the build.
//
// An approved visitor photo is served straight from the PUBLIC storage bucket, and
// it is SUPPOSED to be in prerendered content: that is the last mile of the whole
// contribution pipeline, and the same gate below insists such content carries its
// "from a visitor" label. Banning the hostname outright contradicted the feature
// this gate itself protects.
//
// The hole is exactly one shape and no wider: /storage/v1/object/public/. Anything
// else on supabase.co in static content — /auth/, /rest/, a signed or private
// object — still fails, which is the protection that was actually intended.
const PUBLIC_PHOTO_URL = /https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/[^"'\s)]*/gi;

// Every locale's word for visitor-contributed content. A `data-ugc` block must
// carry one of them.
const UGC_LABELS = ['επισκέπτ', 'visitor', 'Besucher', 'visiteur', 'visitatori', 'visitatore'];

// The other honest form of the same thing. A visitor photo is captioned
// `<PhotoWord>: <name-or-visitor-phrase>` (UGC_PHOTO_WORD in prerenderBeachPages.mjs),
// so a photo credited to a named person carries no UGC_LABELS word at all — and it
// is BETTER attribution, not worse. Requiring the generic phrase would have forced
// us to strip somebody's name to satisfy a checker.
const PHOTO_CREDIT_WORDS = ['Photo:', 'Φωτογραφία:', 'Foto:'];

const pages = walkHtml(distDir);
let ugcBlocks = 0;
let checkedPages = 0;

for (const file of pages) {
  const relative = path.relative(distDir, file).replace(/\\/g, '/');
  if (relative.startsWith('auth/')) continue;
  checkedPages += 1;

  const html = readFileSync(file, 'utf8');
  // Only the prerendered content matters here — the shell's own scripts are not
  // "static content" and are identical on every page.
  const mainMatch = html.match(/<main\b[\s\S]*?<\/main>/i);
  const staticContent = mainMatch ? mainMatch[0] : '';
  if (!staticContent) continue;

  // Take the visitor photos out of the way BEFORE looking for account markers, so
  // the hostname they legitimately carry cannot masquerade as an account leak.
  const photoUrls = staticContent.match(PUBLIC_PHOTO_URL) || [];
  const contentWithoutPhotos = staticContent.replace(PUBLIC_PHOTO_URL, '');

  // Stricter than before, not looser: a page showing a visitor photo must say so in
  // its OWN static content. The data-ugc rule further down only ever covered beach
  // pages; guide pages show the same photos and were never checked at all.
  if (photoUrls.length > 0) {
    const lower = staticContent.toLowerCase();
    const saysVisitor = UGC_LABELS.some(label => lower.includes(label.toLowerCase()));
    const saysCredit = PHOTO_CREDIT_WORDS.some(word => staticContent.includes(word));
    if (!saysVisitor && !saysCredit) {
      failures.push(
        `${relative} shows a visitor photo with no credit anywhere on the page.\n` +
        '    Uncredited, a photo taken by somebody else reads as ours. The caption must name\n' +
        '    the contributor or say the photo came from a visitor — see beachUgcCardPhoto in\n' +
        '    scripts/prerenderBeachPages.mjs.'
      );
    }
  }

  for (const { needle, why } of ACCOUNT_MARKERS) {
    if (contentWithoutPhotos.includes(needle)) {
      failures.push(
        `${relative} has ${why} in its prerendered content ("${needle}").\n` +
        '    Static content is what a crawler and a visitor with no JavaScript see. Account UI\n' +
        '    belongs in the client-rendered tree only.'
      );
    }
  }

  for (const block of staticContent.match(/<[^>]+data-ugc=["']1["'][\s\S]*?<\/section>/gi) || []) {
    ugcBlocks += 1;
    const labelled = UGC_LABELS.some(label => block.toLowerCase().includes(label.toLowerCase()));
    if (!labelled) {
      failures.push(
        `${relative} renders a visitor-contributed block with no "from a visitor" label.\n` +
        '    Unlabelled, it reads as our own measured data — the one thing user content must\n' +
        '    never do. Add the locale label to the block in scripts/prerenderBeachPages.mjs.'
      );
    }
  }
}

/* ---------------------------------------------------------------- report */

console.log('Logged-out parity guard');
console.log(`  entry preloads: ${preloaded.length} (${preloadedSupabase.length} Supabase)`);
console.log(`  supabase chunk: ${supabaseChunk || 'not built'}`);
console.log(`  static pages checked: ${checkedPages}, visitor-content blocks found: ${ugcBlocks}`);
for (const note of notes) console.log(`  note: ${note}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} problem(s) found:\n`);
  for (const failure of failures) console.error(`  - ${failure}\n`);
  process.exit(1);
}

console.log('\nOK — signing out costs nothing, and no visitor content is unlabelled.');
