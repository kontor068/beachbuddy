#!/usr/bin/env node
/**
 * Builds `public/data/beaches/geo-index.json` — every beach in the country reduced to the four
 * fields "Κοντά μου" needs to rank it: its region, its id and its coordinates.
 *
 * Why it exists: to show the 60 beaches nearest the user, the app used to download the FULL beach
 * files of the 14 regions whose centroid sat within 80 km — up to 771 KB of JSON parsed on a phone
 * — and then throw almost all of it away. With this index it loads one ~90 KB file, works out the
 * exact 60 nearest beaches, and only then fetches the 2-4 regions that actually own them.
 *
 * It is also strictly more correct than the centroid shortlist it replaces: no beach can now be
 * missed because its region's centre of gravity sat just past the 80 km line, and the user's
 * landmass is derived from the true nearest beach nationally instead of within a shortlist.
 *
 * Coordinates are rounded to 5 decimals (~1 m) — enough that the ranking here is identical to the
 * one the full beach records produce, while still keeping the file small.
 *
 * Run standalone with `npm run build:geo-index`; `npm run build:beach-data` runs it last so the
 * index can never lag the dataset it describes.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BEACH_DATA_DIR = path.join(ROOT, 'public', 'data', 'beaches');
const INDEX_PATH = path.join(BEACH_DATA_DIR, 'index.json');
const SUMMARY_DIR = path.join(BEACH_DATA_DIR, 'app', 'summary');
const LEGACY_APP_DIR = path.join(BEACH_DATA_DIR, 'app');
const OUTPUT_PATH = path.join(BEACH_DATA_DIR, 'geo-index.json');

const round = (value) => Math.round(value * 1e5) / 1e5;

const readRegionBeaches = (regionId) => {
  const candidates = [
    path.join(SUMMARY_DIR, `${regionId}.json`),
    path.join(LEGACY_APP_DIR, `${regionId}.json`),
  ];

  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
    const beaches = payload?.island?.beaches;
    if (Array.isArray(beaches)) return beaches;
  }

  return null;
};

const main = () => {
  const index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
  const regions = Array.isArray(index?.regions) ? index.regions : [];
  if (regions.length === 0) {
    throw new Error(`${INDEX_PATH} lists no regions`);
  }

  const regionIds = [];
  const entries = [];
  const problems = [];

  for (const region of regions) {
    const beaches = readRegionBeaches(region.id);
    if (!beaches) {
      problems.push(`${region.id}: no beach file found`);
      continue;
    }

    const usable = beaches.filter(beach =>
      beach &&
      typeof beach.id === 'number' &&
      Number.isFinite(beach?.coordinates?.lat) &&
      Number.isFinite(beach?.coordinates?.lon)
    );

    if (usable.length !== beaches.length) {
      problems.push(`${region.id}: ${beaches.length - usable.length} beach(es) without usable coordinates`);
    }
    if (typeof region.beachCount === 'number' && region.beachCount !== beaches.length) {
      problems.push(`${region.id}: index.json says ${region.beachCount} beaches, file holds ${beaches.length}`);
    }

    const regionIdx = regionIds.push(region.id) - 1;
    for (const beach of usable) {
      entries.push([regionIdx, beach.id, round(beach.coordinates.lat), round(beach.coordinates.lon)]);
    }
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'scripts/buildBeachGeoIndex.mjs',
    // Positional rows keep the file a third of the size object rows would: [regionIndex, beachId, lat, lon].
    regions: regionIds,
    beaches: entries,
  };

  const json = `${JSON.stringify(payload)}\n`;
  fs.writeFileSync(OUTPUT_PATH, json, 'utf8');

  console.log(`geo-index: ${entries.length} beaches across ${regionIds.length} regions → ${(json.length / 1024).toFixed(0)} KB`);
  if (problems.length > 0) {
    console.warn(`geo-index: ${problems.length} data problem(s) worth a look:`);
    for (const problem of problems.slice(0, 20)) console.warn(`  - ${problem}`);
  }

  if (entries.length < 2000) {
    throw new Error(`geo-index looks truncated: only ${entries.length} beaches. Refusing to ship it.`);
  }
};

main();
