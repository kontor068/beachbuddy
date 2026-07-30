/**
 * For every field in the beach dataset, how many of the ~2,850 beaches actually
 * have it filled in, as a percentage. A NUMBER, not an impression — so "is field
 * X reliable enough to build a feature on" stops being a guess.
 *
 * Reads the BUILT app region files (public/data/beaches/app/*.json) — the exact
 * shape the UI renders — and walks every beach record up to depth 3, flattening
 * nested objects into dotted paths (e.g. "amenities.shower"). A field counts as
 * "present" when it exists and is not null/undefined/empty-string/empty-array.
 * Arrays and objects that ARE the leaf (e.g. "protectedFrom") count as present
 * when non-empty; this does not distinguish "false" from "present but negative"
 * for booleans — a beach with amenities.shower: false is counted as present,
 * which is correct (we know the answer, it's just "no").
 *
 * Run: node scripts/auditDataFieldCoverage.mjs
 * Writes: reports/data-quality/field-coverage.json (+ .csv)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const appDir = path.join(rootDir, 'public', 'data', 'beaches', 'app');
const outDir = path.join(rootDir, 'reports', 'data-quality');
const MAX_DEPTH = 3;

const isEmpty = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim().length === 0;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
};

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

const counts = new Map(); // path -> present count
let total = 0;

const walk = (obj, prefix, depth) => {
  for (const key of Object.keys(obj)) {
    const fieldPath = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (isPlainObject(value) && depth < MAX_DEPTH) {
      walk(value, fieldPath, depth + 1);
    } else {
      counts.set(fieldPath, (counts.get(fieldPath) || 0) + (isEmpty(value) ? 0 : 1));
    }
  }
};

const files = fs.readdirSync(appDir).filter((f) => f.endsWith('.json'));
for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(appDir, file), 'utf8'));
  const beaches = data.island?.beaches;
  if (!Array.isArray(beaches)) continue;
  for (const b of beaches) {
    total += 1;
    walk(b, '', 0);
  }
}

const rows = [...counts.entries()]
  .map(([field, count]) => ({ field, count, percent: total ? +((count / total) * 100).toFixed(1) : 0 }))
  .sort((a, b) => a.percent - b.percent || a.field.localeCompare(b.field));

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'field-coverage.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), totalBeaches: total, fields: rows }, null, 2),
  'utf8',
);
const csv = ['field,count,percent', ...rows.map((r) => `${r.field},${r.count},${r.percent}`)].join('\r\n');
fs.writeFileSync(path.join(outDir, 'field-coverage.csv'), csv, 'utf8');

console.log(`Data field coverage — ${total} beaches, ${rows.length} distinct fields\n`);
console.log('Worst 25 (lowest fill %):');
for (const r of rows.slice(0, 25)) {
  console.log(`  ${r.percent.toString().padStart(5)}%  ${r.count.toString().padStart(4)}/${total}  ${r.field}`);
}
console.log('\nBest 10 (highest fill %):');
for (const r of rows.slice(-10).reverse()) {
  console.log(`  ${r.percent.toString().padStart(5)}%  ${r.count.toString().padStart(4)}/${total}  ${r.field}`);
}
console.log('\nWrote reports/data-quality/field-coverage.json (+ .csv)');
