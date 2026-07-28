#!/usr/bin/env node
/**
 * Guards the shoreline thumbnails against the one failure mode that would be invisible in
 * review: a beach pin gets corrected, the beach data is rebuilt, and the committed shape
 * keeps drawing the coastline of where the beach used to be. A wrong photo is obviously
 * wrong; a wrong map looks authoritative.
 *
 * Checks, per region that has a shape file:
 *   1. The source fingerprint still matches the committed beach coordinates + coastline.
 *   2. Every drawn beach id still exists in the region.
 *   3. The polyline is well-formed: parseable, in frame, left-to-right, and it passes
 *      through the fixed pin — the whole picture is a lie if the beach is not on the line.
 *
 * Usage: node scripts/validateShorelineShapes.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceFingerprint } from './buildShorelineThumbs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHAPE_DIR = path.join(ROOT, 'public', 'data', 'coastline', 'shape');
const COASTLINE_DIR = path.join(ROOT, 'public', 'data', 'coastline');
const SUMMARY_DIR = path.join(ROOT, 'public', 'data', 'beaches', 'app', 'summary');
const INDEX_PATH = path.join(ROOT, 'public', 'data', 'beaches', 'index.json');

const PIN = [100, 78];
const BOX = [200, 120];
/** The pin is a vertex by construction, so anything above rounding error is a real defect. */
const MAX_PIN_OFFSET_UNITS = 0.2;

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

const listBeaches = (summary) => {
  if (Array.isArray(summary?.island?.beaches)) return summary.island.beaches;
  if (Array.isArray(summary?.beaches)) return summary.beaches;
  return [];
};

function distanceToPolyline(points, [px, py]) {
  let best = Infinity;
  for (let i = 1; i < points.length; i += 1) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

function main() {
  if (!fs.existsSync(SHAPE_DIR)) {
    console.log('No shoreline shapes committed yet — nothing to validate.');
    return;
  }

  const index = readJson(INDEX_PATH);
  const errors = [];
  let regionsChecked = 0;
  let shapesChecked = 0;

  for (const region of index.regions) {
    const shapePath = path.join(SHAPE_DIR, `${region.id}.json`);
    if (!fs.existsSync(shapePath)) continue;

    const summaryPath = path.join(SUMMARY_DIR, `${region.id}.json`);
    const coastlinePath = path.join(COASTLINE_DIR, `${region.id}.json`);
    if (!fs.existsSync(summaryPath) || !fs.existsSync(coastlinePath)) {
      errors.push(`${region.id}: shape file exists but its source data does not`);
      continue;
    }

    const shapes = readJson(shapePath);
    const beaches = listBeaches(readJson(summaryPath));
    const coastline = readJson(coastlinePath);
    regionsChecked += 1;

    const expected = sourceFingerprint(beaches, coastline);
    if (shapes.srcHash !== expected) {
      errors.push(
        `${region.id}: stale shapes — beach coordinates or coastline changed since they were built ` +
          `(have ${shapes.srcHash ?? 'none'}, expected ${expected}). Run: npm run build:shorelines`
      );
      continue;
    }

    const beachIds = new Set(beaches.map((beach) => String(beach.id)));
    for (const [id, shape] of Object.entries(shapes.beaches ?? {})) {
      shapesChecked += 1;

      if (!beachIds.has(id)) {
        errors.push(`${region.id}#${id}: shape drawn for a beach that no longer exists`);
        continue;
      }

      const points = String(shape.s ?? '')
        .split(' ')
        .map((pair) => pair.split(',').map(Number));
      if (points.length < 3 || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
        errors.push(`${region.id}#${id}: unparseable polyline`);
        continue;
      }
      if (points.some(([x, y]) => x < -40 || x > BOX[0] + 40 || y < -60 || y > BOX[1] + 60)) {
        errors.push(`${region.id}#${id}: polyline leaves the drawable area`);
      }
      for (let i = 1; i < points.length; i += 1) {
        if (points[i][0] < points[i - 1][0]) {
          errors.push(`${region.id}#${id}: polyline is not left-to-right, the land fill would self-intersect`);
          break;
        }
      }
      const pinOffset = distanceToPolyline(points, PIN);
      if (pinOffset > MAX_PIN_OFFSET_UNITS) {
        errors.push(`${region.id}#${id}: the beach sits ${pinOffset.toFixed(2)} units off its own shoreline`);
      }
    }
  }

  // The index is what lets "Κοντά μου", saved beaches and the map hover find geometry at
  // all — those screens pass no usable region. A stale index makes the drawing vanish there
  // and nowhere else, which is close to undetectable by eye.
  const indexFile = path.join(SHAPE_DIR, 'index.json');
  if (!fs.existsSync(indexFile)) {
    errors.push('index.json missing — beaches outside a known region cannot resolve their shape. Run: npm run build:shorelines');
  } else {
    const shapeIndex = readJson(indexFile);
    const indexed = new Map();
    for (const [regionId, beachIds] of Object.entries(shapeIndex.regions ?? {})) {
      for (const beachId of beachIds) indexed.set(String(beachId), regionId);
    }

    let missing = 0;
    let mismatched = 0;
    for (const region of index.regions) {
      const shapePath = path.join(SHAPE_DIR, `${region.id}.json`);
      if (!fs.existsSync(shapePath)) continue;
      for (const id of Object.keys(readJson(shapePath).beaches ?? {})) {
        const found = indexed.get(id);
        if (!found) missing += 1;
        else if (found !== region.id) mismatched += 1;
        indexed.delete(id);
      }
    }

    if (missing > 0) errors.push(`index.json is missing ${missing} drawn beach(es)`);
    if (mismatched > 0) errors.push(`index.json points ${mismatched} beach(es) at the wrong region`);
    if (indexed.size > 0) errors.push(`index.json lists ${indexed.size} beach(es) that have no shape`);
  }

  console.log(`Shoreline shapes: ${shapesChecked} across ${regionsChecked} regions.`);

  if (errors.length > 0) {
    console.error(`\n${errors.length} problem(s):`);
    for (const error of errors.slice(0, 40)) console.error(`  - ${error}`);
    if (errors.length > 40) console.error(`  ... and ${errors.length - 40} more`);
    process.exit(1);
  }

  console.log('All shapes match their source data and pass the pin/monotonicity checks.');
}

main();
