#!/usr/bin/env node
/**
 * Split the two Copernicus climatology corpora into per-region chunks the app can
 * lazy-load, the same way scripts/splitBeachStories.mjs does for the editorial text.
 *
 * WHY THIS EXISTS
 * ---------------
 * data/waveClimatology.generated.json (703 KB) and data/waterClimatology.generated.json
 * (2,3 MB) are build artefacts: they carry every month, every percentile and the sample
 * counts, for 2.850 beaches. Until now they were read only by the prerender, to write
 * the "when is the sea calmest here" section into the intent guides.
 *
 * The beach page wants one sentence out of them — "today is calmer than a normal July
 * here" — and that sentence is the only thing on the page no competitor can print,
 * because it needs a decade of reanalysis per beach. Shipping 3 MB to a phone on 4G to
 * say it would be absurd, so this script keeps only what the sentence needs:
 *
 *   typical significant wave height per month  (one number, 2 decimals)
 *   median water temperature per month         (one number, 1 decimal)
 *
 * for the six months anyone swims in Greece (May–October). That is ~90 bytes per beach,
 * about 1–3 KB per region, fetched only when a beach page is actually opened.
 *
 * The percentiles, sample counts and tier labels are deliberately NOT copied. The page
 * compares one number to one number; anything richer would be a claim we have not
 * validated at beach scale — the 4,2 km cell cannot see a cove (see docs/team/06 §🔭).
 *
 * Usage: node scripts/splitBeachClimate.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const WAVE_SRC = path.join(root, 'data', 'waveClimatology.generated.json');
const WATER_SRC = path.join(root, 'data', 'waterClimatology.generated.json');
const APP_DIR = path.join(root, 'public', 'data', 'beaches', 'app');
const OUT_DIR = path.join(root, 'data', 'beachClimate');

const MONTHS = ['5', '6', '7', '8', '9', '10'];

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

/** Pull every beach id out of a region's app file: { region, island: { beaches: [...] } }. */
const beachIdsIn = (payload) => {
  const list = payload?.island?.beaches ?? payload?.beaches ?? [];
  const ids = [];
  for (const entry of Array.isArray(list) ? list : Object.values(list)) {
    if (entry && typeof entry === 'object' && entry.id !== undefined) ids.push(String(entry.id));
  }
  return ids;
};

const main = () => {
  for (const src of [WAVE_SRC, WATER_SRC]) {
    if (!fs.existsSync(src)) {
      console.error(`✗ missing ${path.relative(root, src)} — run the Copernicus build first`);
      process.exit(1);
    }
  }

  const wave = readJson(WAVE_SRC).beaches || {};
  const water = readJson(WATER_SRC).beaches || {};

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const regionFiles = fs
    .readdirSync(APP_DIR)
    .filter((f) => f.endsWith('.json') && !['index.json', 'search-index.json'].includes(f));

  let regionsWritten = 0;
  let beachesWithWave = 0;
  let beachesWithWater = 0;
  let beachesTotal = 0;

  for (const file of regionFiles) {
    const regionId = file.replace(/\.json$/, '');
    let ids;
    try {
      ids = beachIdsIn(readJson(path.join(APP_DIR, file)));
    } catch {
      continue;
    }
    if (!ids.length) continue;

    const out = {};
    for (const id of ids) {
      beachesTotal += 1;
      const entry = {};

      const waveMonths = wave[id]?.months;
      if (waveMonths) {
        const m = {};
        for (const month of MONTHS) {
          const v = waveMonths[month]?.typicalM;
          if (typeof v === 'number' && Number.isFinite(v)) m[month] = Number(v.toFixed(2));
        }
        if (Object.keys(m).length) {
          entry.wave = m;
          beachesWithWave += 1;
        }
      }

      const waterMonths = water[id]?.temperature?.months;
      if (waterMonths) {
        const m = {};
        for (const month of MONTHS) {
          const v = waterMonths[month]?.medianC;
          if (typeof v === 'number' && Number.isFinite(v)) m[month] = Number(v.toFixed(1));
        }
        if (Object.keys(m).length) {
          entry.water = m;
          beachesWithWater += 1;
        }
      }

      if (entry.wave || entry.water) out[id] = entry;
    }

    if (!Object.keys(out).length) continue;

    // Write to a temp file then rename, so a crash never leaves a half-written chunk
    // that the app would happily parse as "this region has no climatology".
    const target = path.join(OUT_DIR, `${regionId}.json`);
    const tmp = `${target}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(out), 'utf8');
    fs.renameSync(tmp, target);
    regionsWritten += 1;
  }

  const bytes = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.json'))
    .reduce((sum, f) => sum + fs.statSync(path.join(OUT_DIR, f)).size, 0);

  console.log(`✓ ${regionsWritten} regions → data/beachClimate/`);
  console.log(`  wave  ${beachesWithWave}/${beachesTotal} beaches`);
  console.log(`  water ${beachesWithWater}/${beachesTotal} beaches`);
  console.log(`  total ${(bytes / 1024).toFixed(0)} KB · avg ${(bytes / 1024 / regionsWritten).toFixed(1)} KB per region`);
};

main();
