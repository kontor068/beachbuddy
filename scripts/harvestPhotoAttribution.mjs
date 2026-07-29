#!/usr/bin/env node
/**
 * Harvest author + licence for every per-beach photo we display.
 *
 * WHY THIS EXISTS.
 *
 * `data/beachPhotosById.generated.json` stores bare image URLs and nothing else, so
 * the detail page had no author or licence to render — and the one attribution path
 * that existed (`services/beachImageService.ts`) is hard-gated to Milos. Result: CC
 * BY / BY-SA photos shown with no credit on ~2.800 beach pages. Spot-checked
 * 29/07/2026: beach 965 (Κανάλι του Έρωτα) is CC BY 3.0 by Sergey Rsavin with
 * `AttributionRequired = true`, displayed with nothing.
 *
 * The Wikimedia Commons API returns exactly the fields the licence requires, free and
 * without a key, 50 files per request. This script writes them to
 * `data/photoAttribution.generated.json`, keyed by the photo URL as stored, so the UI
 * can render a real credit instead of a bare source link.
 *
 * Flickr-hosted photos (16 of 1.068) are left out on purpose: their API needs a key,
 * and inventing an author is worse than linking the photo page. They keep the
 * source-only credit in `utils/photoCredit.ts`.
 *
 *   node scripts/harvestPhotoAttribution.mjs            # write the file
 *   node scripts/harvestPhotoAttribution.mjs --dry-run  # report only
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PHOTOS = path.join(ROOT, 'data', 'beachPhotosById.generated.json');
const OUT = path.join(ROOT, 'data', 'photoAttribution.generated.json');
const API = 'https://commons.wikimedia.org/w/api.php';
const BATCH = 50;
const dryRun = process.argv.includes('--dry-run');

/** Commons returns HTML in Artist/Credit; the licence wants a name, not markup. */
const htmlToText = (html) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** The two Commons URL shapes we store → the canonical "File:x" title. */
const commonsTitle = (url) => {
  const redirect = /Special:Redirect\/file\/([^&?]+)/.exec(url);
  if (redirect) return `File:${decodeURIComponent(redirect[1]).replace(/ /g, '_')}`;
  if (/^https?:\/\/upload\.wikimedia\.org\//i.test(url)) {
    const segments = url.split('?')[0].split('/').filter(Boolean);
    const name = url.includes('/thumb/') ? segments[segments.length - 2] : segments[segments.length - 1];
    return name ? `File:${decodeURIComponent(name)}` : null;
  }
  return null;
};

const registry = JSON.parse(fs.readFileSync(PHOTOS, 'utf8'));
const photosOf = (v) => (Array.isArray(v) ? v : [v]);
const urls = [...new Set(Object.values(registry).flatMap(photosOf))];

// title → [urls], because the same file can back more than one beach.
const byTitle = new Map();
const skipped = [];
for (const url of urls) {
  const title = commonsTitle(url);
  if (!title) { skipped.push(url); continue; }
  if (!byTitle.has(title)) byTitle.set(title, []);
  byTitle.get(title).push(url);
}

const titles = [...byTitle.keys()];
console.log(`${urls.length} photo URLs · ${titles.length} Commons files · ${skipped.length} non-Commons (left to source-only credit)`);

const out = {};
let missing = 0;

for (let i = 0; i < titles.length; i += BATCH) {
  const chunk = titles.slice(i, i + BATCH);
  const params = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'extmetadata',
    iiextmetadatafilter: 'Artist|LicenseShortName|LicenseUrl|License|AttributionRequired',
    format: 'json',
    formatversion: '2',
    titles: chunk.join('|'),
  });

  const res = await fetch(`${API}?${params}`, {
    headers: { 'User-Agent': 'CalmBeach/1.0 (https://calmbeach.gr; attribution harvest)' },
  });
  if (!res.ok) throw new Error(`Commons API ${res.status} on batch ${i / BATCH + 1}`);
  const json = await res.json();

  // formatversion=2 gives pages as an array, and normalizes titles we sent
  // (underscores/case), so map the response title back to what we asked for.
  const normalized = new Map((json.query?.normalized || []).map((n) => [n.to, n.from]));
  for (const page of json.query?.pages || []) {
    const asked = normalized.get(page.title) || page.title;
    const meta = page.imageinfo?.[0]?.extmetadata;
    const targets = byTitle.get(asked) || byTitle.get(page.title);
    if (!meta || !targets) { missing += targets?.length || 1; continue; }

    const author = htmlToText(meta.Artist?.value);
    const license = htmlToText(meta.LicenseShortName?.value);
    const licenseUrl = htmlToText(meta.LicenseUrl?.value);
    // Commons reports this as the string "true"/"false".
    const required = String(meta.AttributionRequired?.value ?? '').toLowerCase() !== 'false';

    // An entry with no author is useless for attribution — record nothing rather
    // than a credit line that names the platform and calls it the creator.
    if (!author) { missing += targets.length; continue; }

    for (const url of targets) {
      out[url] = { author, license: license || null, licenseUrl: licenseUrl || null, attributionRequired: required };
    }
  }
  process.stdout.write(`  batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(titles.length / BATCH)} → ${Object.keys(out).length} credited\r`);
}

console.log(`\n\nCredited ${Object.keys(out).length} of ${urls.length} photo URLs · ${missing} without a usable author`);
const licenses = {};
for (const v of Object.values(out)) licenses[v.license || 'unknown'] = (licenses[v.license || 'unknown'] || 0) + 1;
console.log('Licences:', Object.entries(licenses).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · '));
console.log(`Attribution required by licence: ${Object.values(out).filter((v) => v.attributionRequired).length}`);

// ---------------------------------------------------------------------------
// Shape for the client.
//
// Keyed by URL with the file page spelled out, this file was 422 KB — it would
// have shipped the photo URLs a second time inside the JS bundle, on a site
// already carrying ~3.6 MB of JavaScript. So: key by beach id (the caller always
// has it), pull the licences into a shared table (15 distinct values across
// 1.038 photos), and drop the file page — utils/photoCredit.ts already derives it
// from the photo URL. Per beach we store only [author, licenceIndex].
// ---------------------------------------------------------------------------
const licenseTable = [];
const licenseIndex = new Map();
const indexOfLicense = (license, licenseUrl, required) => {
  const key = `${license}|${licenseUrl}|${required}`;
  if (!licenseIndex.has(key)) {
    licenseIndex.set(key, licenseTable.length);
    licenseTable.push([license || '', licenseUrl || '', required ? 1 : 0]);
  }
  return licenseIndex.get(key);
};

const byBeach = {};
for (const [beachId, value] of Object.entries(registry)) {
  const credits = photosOf(value).map((url) => {
    const c = out[url];
    return c ? [c.author, indexOfLicense(c.license, c.licenseUrl, c.attributionRequired)] : null;
  });
  if (credits.some(Boolean)) byBeach[beachId] = credits;
}

const payload = {
  note: 'Generated by scripts/harvestPhotoAttribution.mjs from the Wikimedia Commons API. Do not hand-edit.',
  generatedAt: new Date().toISOString().slice(0, 10),
  licenses: licenseTable,
  byBeach,
};

console.log(`Beaches with a credit: ${Object.keys(byBeach).length} · distinct licences: ${licenseTable.length}`);

if (dryRun) {
  console.log('\n--dry-run: nothing written.');
} else {
  fs.writeFileSync(OUT, `${JSON.stringify(payload)}\n`, 'utf8');
  console.log(`\nWrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
}
