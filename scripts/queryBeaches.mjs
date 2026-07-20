// Ad-hoc SQL over the baked beach database (read-only).
//
//   node --experimental-sqlite scripts/queryBeaches.mjs "SELECT region_id, COUNT(*) n FROM beaches GROUP BY 1 ORDER BY n DESC LIMIT 10"
//   node --experimental-sqlite scripts/queryBeaches.mjs "SELECT name_gr, rating FROM beaches WHERE organized=1 AND beach_bar=1 ORDER BY rating DESC LIMIT 5"
//   node --experimental-sqlite scripts/queryBeaches.mjs "SELECT name_gr FROM beaches_fts WHERE beaches_fts MATCH 'κολυμπ*' LIMIT 5"
//
// Build the DB first with: npm run build:sqlite

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dbFile = path.join(rootDir, 'public', 'data', 'beaches.sqlite');

const sql = process.argv.slice(2).join(' ').trim();
if (!sql) {
  console.error('Usage: node --experimental-sqlite scripts/queryBeaches.mjs "<SQL>"');
  process.exit(2);
}
if (!existsSync(dbFile)) {
  console.error('Database not found. Build it first: npm run build:sqlite');
  process.exit(1);
}

const db = new DatabaseSync(dbFile, { readOnly: true });
try {
  const rows = db.prepare(sql).all();
  console.log(JSON.stringify(rows, null, 2));
  console.log(`\n(${rows.length} row${rows.length === 1 ? '' : 's'})`);
} catch (error) {
  console.error('Query error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
