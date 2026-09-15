// Renders the home page's STATIC FIRST SCREEN at build time — the landing's real Header and
// LandingHero, as HTML — for scripts/prerenderBeachPages.mjs to put into the home pages.
// Why, and how the live app takes over from it: utils/staticFirstScreen.ts.
//
// It compiles components/landing/LandingFirstScreen.tsx for Node with Vite (so the
// components are the SAME source the app ships, not a hand-copied imitation), renders one
// copy per home-page language, checks each one and writes them to OUTPUT_FILE.
// Runs after `vite build` and before the prerender, which fails if the file is missing.
//
// Every check below throws: a first screen that renders wrong must stop the build, not
// ship. A broken static copy sits on top of the real page until the hand-over, and a
// silently empty one would just bring back the slow first paint without anyone noticing.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import react from '@vitejs/plugin-react';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workDir = path.join(projectRoot, '.tmp', 'landing-first-screen');
const bundleFile = path.join(workDir, 'landing-first-screen.mjs');
// Read by scripts/prerenderBeachPages.mjs (FIRST_SCREEN_FILE) — keep the two paths in step.
const OUTPUT_FILE = path.join(workDir, 'first-screen.json');
const LANGUAGES = ['en', 'gr'];

// The live app renders the same components at the same time, and React's generated ids
// (useId) are the same in both — so the static copy's ids would collide with the live
// ones for the second or two both are in the page. Prefix them, and every attribute that
// points at an id, so a lookup by id can only ever find the live element.
const ID_PREFIX = 'cb-fs-';
const prefixIds = html => html
  .replace(/\s(id|for|aria-controls|aria-activedescendant)="([^"]+)"/g, (_, attr, value) => ` ${attr}="${ID_PREFIX}${value}"`)
  .replace(/\s(aria-labelledby|aria-describedby)="([^"]+)"/g, (_, attr, value) => (
    ` ${attr}="${value.split(/\s+/).map(id => `${ID_PREFIX}${id}`).join(' ')}"`
  ));

const count = (html, pattern) => (html.match(pattern) || []).length;

const check = (language, html) => {
  const problems = [];
  if (count(html, /<h1\b/g) !== 1) problems.push(`expected exactly one <h1>, found ${count(html, /<h1\b/g)}`);
  if (count(html, /<header\b/g) !== 1) problems.push('the header is missing');
  if (count(html, /<template data-cb-hero-slot="(morning|afternoon|evening)"/g) !== 3) problems.push('expected the three hero photo templates');
  // Must come after the hero, not beside the photo: see heroSlotScript in LandingFirstScreen.tsx.
  if (!/<\/main><script>(?:(?!<\/script>)[\s\S])*cloneNode(?:(?!<\/script>)[\s\S])*<\/script><\/div>$/.test(html)) problems.push('the photo-picking script is missing or no longer the last thing in the first screen');
  if (!/<form\b[\s\S]*<input\b/.test(html)) problems.push('the search box is missing');
  if (!html.includes('data-cb-near-me')) problems.push('the "near me" button lost its data-cb-near-me hook');
  // Starts from opacity 0: in the static copy it would hide the headline until it played.
  if (html.includes('cb-hero-rise')) problems.push('the entrance animation leaked into the static copy');
  if (/\sid="(?!cb-fs-)/.test(html)) problems.push('an id escaped the cb-fs- prefix');
  if (problems.length > 0) {
    throw new Error(`[first-screen] ${language}: ${problems.join('; ')}. See components/landing/LandingFirstScreen.tsx.`);
  }
};

const main = async () => {
  await mkdir(workDir, { recursive: true });
  await build({
    configFile: false,
    root: projectRoot,
    logLevel: 'warn',
    mode: 'production',
    plugins: [react()],
    resolve: { alias: { '@': projectRoot } },
    // lucide-react is bundled in: its CommonJS entry does not expose named exports to a
    // Node ESM import. React itself stays external (Node resolves it fine).
    ssr: { noExternal: ['lucide-react'] },
    build: {
      ssr: path.join(projectRoot, 'components', 'landing', 'LandingFirstScreen.tsx'),
      outDir: workDir,
      emptyOutDir: false,
      minify: false,
      rollupOptions: { output: { format: 'esm', entryFileNames: path.basename(bundleFile) } },
    },
  });

  const { renderLandingFirstScreen } = await import(`${pathToFileURL(bundleFile).href}?t=${Date.now()}`);
  const output = {};
  for (const language of LANGUAGES) {
    const html = prefixIds(renderLandingFirstScreen(language));
    check(language, html);
    output[language] = html;
  }
  await writeFile(OUTPUT_FILE, JSON.stringify(output), 'utf8');
  console.log(`[first-screen] rendered ${LANGUAGES.join(', ')} (${LANGUAGES.map(l => `${Math.round(output[l].length / 1024)} KB`).join(', ')}) -> ${path.relative(projectRoot, OUTPUT_FILE)}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
