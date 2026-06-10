/**
 * Data acquisition for the high-resolution land mask used by the geospatial
 * exposure builder (`--land-geojson`).
 *
 * What it does:
 *   1. Downloads the OSM-derived land polygons, SPLIT variant, WGS84
 *      (https://osmdata.openstreetmap.de/data/land-polygons.html). The split
 *      variant keeps every polygon small, which is required for fast
 *      point-in-polygon tests — never feed the builder unsplit continental
 *      polygons (GSHHG full etc.).
 *   2. Extracts the zip (uses the system `tar`, which handles zip on
 *      Windows 11 and macOS; on Linux run `unzip` manually and use --skip-download).
 *   3. Stream-filters the shapefile record by record, keeping only polygons
 *      whose bbox intersects the Greece bounds used by the builder
 *      (lat 33..43, lon 18..31), and writes them incrementally as GeoJSON.
 *      Memory stays flat regardless of input size.
 *
 * Usage:
 *   node scripts/fetchHighResLandMask.mjs
 *   node scripts/fetchHighResLandMask.mjs --skip-download   # zip already on disk
 *
 * Then build with:
 *   node scripts/buildGeospatialExposureProfiles.mjs \
 *     --land-geojson .tmp/geospatial/greece-land-osm-split.geojson
 */

import { spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shapefile from 'shapefile';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const downloadUrl = 'https://osmdata.openstreetmap.de/download/land-polygons-split-4326.zip';
const workDir = path.join(root, '.tmp', 'geospatial', 'osm-land');
const zipPath = path.join(workDir, 'land-polygons-split-4326.zip');
const shpPath = path.join(workDir, 'land-polygons-split-4326', 'land_polygons.shp');
const defaultOutputPath = path.join(root, '.tmp', 'geospatial', 'greece-land-osm-split.geojson');

// Must match (or contain) `greeceBounds` in scripts/geospatialExposureProfiles.ts.
const greeceBounds = {
  minLat: 33,
  maxLat: 43,
  minLon: 18,
  maxLon: 31,
};

const parseArgValue = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

const skipDownload = process.argv.includes('--skip-download');
const outputPath = path.resolve(parseArgValue('--output') || defaultOutputPath);

const download = async () => {
  if (existsSync(zipPath) && statSync(zipPath).size > 100 * 1024 * 1024) {
    console.log(`Zip already present (${(statSync(zipPath).size / 1e6).toFixed(0)} MB), skipping download.`);
    return;
  }
  mkdirSync(workDir, { recursive: true });
  console.log(`Downloading ${downloadUrl} (~700 MB, one-time)...`);
  const response = await fetch(downloadUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  let received = 0;
  let lastLogged = 0;
  const progress = new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received - lastLogged > 100 * 1024 * 1024) {
        lastLogged = received;
        console.log(`  ...${(received / 1e6).toFixed(0)} MB`);
      }
      controller.enqueue(chunk);
    },
  });

  await pipeline(Readable.fromWeb(response.body.pipeThrough(progress)), createWriteStream(zipPath));
  console.log(`Downloaded ${(received / 1e6).toFixed(0)} MB to ${zipPath}`);
};

const extract = () => {
  if (existsSync(shpPath)) {
    console.log('Shapefile already extracted, skipping.');
    return;
  }
  console.log('Extracting zip...');
  const result = spawnSync('tar', ['-xf', zipPath, '-C', workDir], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('tar extraction failed. Extract the zip manually into .tmp/geospatial/osm-land and re-run with --skip-download.');
  }
  if (!existsSync(shpPath)) {
    throw new Error(`Expected shapefile not found after extraction: ${shpPath}`);
  }
};

const featureBboxIntersectsGreece = (geometry) => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  const scanRing = (ring) => {
    for (const [lon, lat] of ring) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
    }
  };

  if (geometry.type === 'Polygon') geometry.coordinates.forEach(scanRing);
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(polygon => polygon.forEach(scanRing));
  else return false;

  return (
    maxLat >= greeceBounds.minLat &&
    minLat <= greeceBounds.maxLat &&
    maxLon >= greeceBounds.minLon &&
    minLon <= greeceBounds.maxLon
  );
};

const filterToGreece = async () => {
  console.log('Stream-filtering land polygons to the Greece bounds...');
  mkdirSync(path.dirname(outputPath), { recursive: true });
  const out = createWriteStream(outputPath, 'utf8');
  const writeChunk = (chunk) => new Promise((resolve, reject) => {
    out.write(chunk, error => (error ? reject(error) : resolve()));
  });

  await writeChunk('{"type":"FeatureCollection","features":[\n');

  const source = await shapefile.open(shpPath);
  let scanned = 0;
  let kept = 0;

  for (;;) {
    const { done, value } = await source.read();
    if (done) break;
    scanned += 1;
    if (scanned % 100000 === 0) console.log(`  ...scanned ${scanned}, kept ${kept}`);
    if (!value?.geometry || !featureBboxIntersectsGreece(value.geometry)) continue;

    const feature = JSON.stringify({ type: 'Feature', properties: {}, geometry: value.geometry });
    await writeChunk(`${kept > 0 ? ',\n' : ''}${feature}`);
    kept += 1;
  }

  await writeChunk('\n]}\n');
  await new Promise((resolve, reject) => out.end(error => (error ? reject(error) : resolve())));

  const sizeMb = statSync(outputPath).size / 1e6;
  console.log(JSON.stringify({ scanned, kept, outputPath, sizeMb: Number(sizeMb.toFixed(1)) }, null, 2));
};

const main = async () => {
  if (!skipDownload) await download();
  extract();
  await filterToGreece();
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
