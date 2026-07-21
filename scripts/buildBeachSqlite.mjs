// ─────────────────────────────────────────────────────────────────────────────
// Bake the canonical beach dataset into a single portable SQLite file.
//
//   node --experimental-sqlite scripts/buildBeachSqlite.mjs
//
// WHY: today the app reads per-region JSON (great for the current static-first
// setup). SQLite gives the SAME data a real query engine — filters, joins, geo
// range scans, full-text search — while STAYING a single portable file that lives
// on the CDN/git with zero server and zero running cost. It's the migration
// foundation: the day filters/search get heavy, the data-access seam
// (services/beachDataLoader) can read this instead of looping JSON in JS, and the
// exact same file is queryable by DuckDB (spatial/analytics) or a future backend.
//
// Uses Node 22's built-in `node:sqlite` — no native build, no npm dependency.
// Every row is validated against the canonical contract before it goes in, so a
// bad record fails the build here too (single source of truth, one more consumer).
// ─────────────────────────────────────────────────────────────────────────────

import { DatabaseSync } from 'node:sqlite';
import { readdir, readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBeachRecord } from '../core/beachContract.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summaryDir = path.join(rootDir, 'public', 'data', 'beaches', 'app', 'summary');
// Write OUTSIDE public/ so the whole-country database is a build/analysis artifact only and is
// NOT served (it used to sit at /data/beaches.sqlite — a one-request national data dump). The
// client never reads it (see sqlite-verdict): the app loads per-region JSON, and this file feeds
// queryBeaches.mjs / audits. Keeping the national dataset off the CDN raises the scraping cost.
const outDir = path.join(rootDir, 'data', 'derived');
const outFile = path.join(outDir, 'beaches.sqlite');

const bool = (v) => (v ? 1 : 0);
const jsonOrNull = (v) => (v == null ? null : JSON.stringify(v));

// Strip Greek tonos/diacritics so search is accent-insensitive ("βαγιας" → "Βαγίας").
// SQLite's FTS5 unicode61 does NOT fold the Greek tonos, so we normalise here and
// index the stripped text ourselves. Mirrors the app's accent-tolerant search.
const stripDiacritics = (s) =>
  Array.from((s || '').normalize('NFD')).filter((ch) => { const c = ch.codePointAt(0); return c < 0x300 || c > 0x36f; }).join('').normalize('NFC').toLowerCase();

async function main() {
  await mkdir(outDir, { recursive: true });
  await rm(outFile, { force: true }); // rebuild from scratch → deterministic

  const db = new DatabaseSync(outFile);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

  db.exec(`
    CREATE TABLE beaches (
      region_id     TEXT    NOT NULL,
      region_group  TEXT,
      id            INTEGER NOT NULL,
      name_en       TEXT    NOT NULL,
      name_gr       TEXT    NOT NULL,
      lat           REAL    NOT NULL,
      lon           REAL    NOT NULL,
      rating        REAL,
      accessibility TEXT,
      beach_type    TEXT,
      water_depth   TEXT,
      organized     INTEGER, beach_bar INTEGER, sunbeds INTEGER, taverna INTEGER,
      restaurant    INTEGER, parking   INTEGER, natural_shade INTEGER,
      snorkeling    INTEGER, surfing   INTEGER,
      quiet         INTEGER, remote    INTEGER, family_friendly INTEGER,
      sheltered_local_wind INTEGER,
      popularity_tier TEXT, rating_count INTEGER,
      protected_from  TEXT,   -- JSON array of compass directions
      aliases         TEXT,   -- JSON array
      PRIMARY KEY (region_id, id)
    );
    CREATE INDEX idx_beaches_region ON beaches(region_id);
    CREATE INDEX idx_beaches_rating ON beaches(rating DESC);
    CREATE INDEX idx_beaches_geo    ON beaches(lat, lon);
    -- Accent-insensitive full-text search. The indexed search column holds the
    -- tonos-stripped name_en + name_gr + aliases; name_gr is stored (UNINDEXED) for
    -- display, and region_id/beach_id let a match join back to the beaches row.
    CREATE VIRTUAL TABLE beaches_fts USING fts5(
      search, name_gr UNINDEXED, region_id UNINDEXED, beach_id UNINDEXED
    );
  `);

  const insert = db.prepare(`
    INSERT INTO beaches (
      region_id, region_group, id, name_en, name_gr, lat, lon, rating,
      accessibility, beach_type, water_depth,
      organized, beach_bar, sunbeds, taverna, restaurant, parking, natural_shade,
      snorkeling, surfing, quiet, remote, family_friendly,
      sheltered_local_wind, popularity_tier, rating_count, protected_from, aliases
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?
    )
  `);
  const insertFts = db.prepare('INSERT INTO beaches_fts (search, name_gr, region_id, beach_id) VALUES (?, ?, ?, ?)');

  const files = (await readdir(summaryDir)).filter((f) => f.endsWith('.json'));
  let inserted = 0;
  const violations = [];

  db.exec('BEGIN');
  for (const file of files) {
    const payload = JSON.parse(await readFile(path.join(summaryDir, file), 'utf8'));
    const island = payload?.island;
    if (!island || !Array.isArray(island.beaches)) continue;

    for (const b of island.beaches) {
      const { valid, errors } = validateBeachRecord(b);
      if (!valid) { violations.push({ file, id: b?.id, errors }); continue; }

      const a = b.amenities || {};
      const c = b.characteristics || {};
      const act = b.activities || {};
      const env = b.environment || {};
      insert.run(
        island.id, island.group ?? null, b.id, b.name.en, b.name.gr, b.coordinates.lat, b.coordinates.lon, b.rating ?? null,
        b.accessibility ?? null, b.beachType ?? null, b.waterDepth ?? null,
        bool(a.organized), bool(a.beachBar), bool(a.sunbeds), bool(a.taverna), bool(a.restaurant), bool(a.parking), bool(a.naturalShade),
        bool(act.snorkeling), bool(act.surfing), bool(env.quiet), bool(env.remote), bool(env.familyFriendly),
        b.shelteredFromLocalWind == null ? null : bool(b.shelteredFromLocalWind),
        b.popularity?.tier ?? null, b.popularity?.ratingCount ?? null,
        jsonOrNull(b.protectedFrom), jsonOrNull(b.aliases),
      );
      const searchText = stripDiacritics(`${b.name.en} ${b.name.gr} ${(b.aliases || []).join(' ')}`);
      insertFts.run(searchText, b.name.gr, island.id, String(b.id));
      inserted += 1;
    }
  }
  db.exec('COMMIT');
  db.exec('ANALYZE;');

  // Fail the build if any row broke the canonical contract (same rule as the JSON gate).
  if (violations.length) {
    console.error(`\n❌ ${violations.length} beach(es) failed the contract — not baked:`);
    for (const v of violations.slice(0, 20)) console.error(`   ${v.file} #${v.id}: ${v.errors.map((e) => e.code).join(', ')}`);
    db.close();
    process.exit(1);
  }

  // --- Prove it works: a few real queries over the baked DB -------------------
  const one = (sql, ...p) => db.prepare(sql).get(...p);
  const many = (sql, ...p) => db.prepare(sql).all(...p);

  const total = one('SELECT COUNT(*) n FROM beaches').n;
  const regions = one('SELECT COUNT(DISTINCT region_id) n FROM beaches').n;
  const organizedBars = one('SELECT COUNT(*) n FROM beaches WHERE organized=1 AND beach_bar=1').n;
  const sheltered = one('SELECT COUNT(*) n FROM beaches WHERE sheltered_local_wind=1').n;
  const topRegions = many('SELECT region_id, COUNT(*) n FROM beaches GROUP BY region_id ORDER BY n DESC LIMIT 5');
  // Accent-insensitive prefix search: "βαγιας" (no tonos) finds "Παραλία Βαγίας".
  const ftsHit = many("SELECT name_gr FROM beaches_fts WHERE beaches_fts MATCH 'βαγιας*' LIMIT 3");

  // Nearest-3 to a point (Naxos town ~37.10,25.38): SQL bounding-box prefilter + JS haversine.
  const [qLat, qLon] = [37.10, 25.38];
  const box = many(
    'SELECT name_gr, lat, lon FROM beaches WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?',
    qLat - 0.5, qLat + 0.5, qLon - 0.5, qLon + 0.5,
  );
  const hav = (la1, lo1, la2, lo2) => {
    const R = 6371, toR = Math.PI / 180;
    const dLa = (la2 - la1) * toR, dLo = (lo2 - lo1) * toR;
    const x = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * toR) * Math.cos(la2 * toR) * Math.sin(dLo / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  };
  const nearest = box
    .map((r) => ({ name: r.name_gr, km: hav(qLat, qLon, r.lat, r.lon) }))
    .sort((p, q) => p.km - q.km).slice(0, 3);

  db.close();

  console.log(`\n✅ Baked ${inserted} beaches → ${path.relative(rootDir, outFile).replaceAll(path.sep, '/')}`);
  console.log(`   regions: ${regions} | organized+bar: ${organizedBars} | sheltered(local wind): ${sheltered}`);
  console.log('   top regions: ' + topRegions.map((r) => `${r.region_id}(${r.n})`).join(', '));
  console.log("   FTS 'βαγιας*' (no tonos): " + ftsHit.map((r) => r.name_gr).join(', '));
  console.log('   nearest to Naxos town: ' + nearest.map((n) => `${n.name} ${n.km.toFixed(1)}km`).join(', '));
}

main().catch((err) => { console.error(err); process.exit(1); });
