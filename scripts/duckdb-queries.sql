-- DuckDB analytics/spatial over the SAME baked file (public/data/beaches.sqlite).
-- DuckDB is a query engine, not another copy of the data — it reads the SQLite
-- directly. Install once (single free binary: https://duckdb.org), then:
--
--   duckdb < scripts/duckdb-queries.sql
--
-- This is why "SQLite vs DuckDB" is not a fork: one portable file, two engines —
-- SQLite for transactional/point lookups, DuckDB for analytics + native spatial.

INSTALL sqlite;  LOAD sqlite;
INSTALL spatial; LOAD spatial;

ATTACH 'public/data/beaches.sqlite' AS b (TYPE sqlite);

-- 1. Amenity coverage per region (analytics DuckDB is built for)
SELECT region_id,
       COUNT(*)                              AS beaches,
       ROUND(100.0 * AVG(organized), 1)      AS pct_organized,
       ROUND(100.0 * AVG(beach_bar), 1)      AS pct_beach_bar,
       ROUND(AVG(rating), 2)                 AS avg_rating
FROM b.beaches
GROUP BY region_id
ORDER BY beaches DESC
LIMIT 10;

-- 2. Native spatial: the 5 beaches nearest Naxos town (37.10, 25.38), in km.
--    DuckDB's spatial extension does this with real geometry — no hand-rolled
--    Haversine, no SpatiaLite build.
SELECT name_gr,
       ROUND(ST_Distance_Sphere(ST_Point(lon, lat), ST_Point(25.38, 37.10)) / 1000.0, 2) AS km
FROM b.beaches
ORDER BY km
LIMIT 5;

-- 3. Sheltered + organized family beaches with a bar, best-rated first
SELECT region_id, name_gr, rating
FROM b.beaches
WHERE sheltered_local_wind = 1 AND organized = 1 AND beach_bar = 1 AND family_friendly = 1
ORDER BY rating DESC
LIMIT 10;
