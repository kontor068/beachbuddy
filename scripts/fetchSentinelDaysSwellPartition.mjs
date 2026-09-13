#!/usr/bin/env node
/**
 * Δ11 (βήμα 1) — Η ΘΑΛΑΣΣΑ ΧΩΡΙΣΜΕΝΗ ΣΕ ΚΥΜΑ ΑΝΕΜΟΥ ΚΑΙ ΦΟΥΣΚΟΘΑΛΑΣΣΙΑ, ΓΙΑ ΤΙΣ ΜΕΡΕΣ ΤΟΥ ΔΟΡΥΦΟΡΟΥ (13/09/2026).
 *
 * Ο κριτής Sentinel-2 (.tmp/s2judge/national-days.json) έχει για κάθε μέρα μόνο ΟΛΙΚΟ κύμα [Hs, dir, T_peak] από τον
 * Copernicus. Για να ρωτήσουμε αν το «λέμε ήρεμη, σκάει» μαζεύεται στη ΜΕΙΚΤΗ θάλασσα (φουσκοθαλασσιά από άλλη
 * πόρτα απ' ό,τι το κύμα ανέμου — βίβλος §Γ81 Δ11), χρειάζεται ο χωρισμός. Ο πληρωμένος marine host της Open-Meteo
 * τον δίνει ως 92 μέρες πίσω (`past_days`), στο ΘΑΛΑΣΣΙΟ ΣΗΜΕΙΟ ΠΟΥ ΔΙΑΛΕΓΕΙ Η ΙΔΙΑ Η ΣΕΛΙΔΑ για κάθε παραλία
 * (utils/marineSamplePoints), με το μοντέλο της σελίδας (ewam) και εφεδρεία meteofrance_wave εκεί που το ewam είναι
 * στεριά. Παίρνουμε τη 09:00 UTC κάθε μέρας (η ώρα του δορυφόρου ~12:15 ώρα Ελλάδας· ο κριτής ήδη διαβάζει 09 UTC).
 *
 * Το παράθυρο μικραίνει κάθε μέρα (~90 εγγραφές/μέρα) — τρέχει ΠΡΩΤΟ. Γράφει ΜΟΝΟ στο .tmp (δεδομένα, όχι repo).
 *
 *   node scripts/fetchSentinelDaysSwellPartition.mjs [--since=2026-06-13] [--limit=N]
 *   CB_DATA_ROOT=C:/Users/Miltos/Desktop/beach  (όπου ζει το .tmp/s2judge — ένα worktree δεν το έχει)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { resolveOpenMeteoKey } from './lib/openMeteoKey.mjs';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataRoot = process.env.CB_DATA_ROOT || (existsSync(path.join(root, '.tmp/s2judge')) ? root : 'C:/Users/Miltos/Desktop/beach');
require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText, filename);
};
const { resolveBeachMarinePoints, marinePointKey } = require(path.join(root, 'utils/marineSamplePoints.ts'));

const argVal = (name, fallback) => { const hit = process.argv.find(a => a.startsWith(`${name}=`)); return hit ? hit.slice(name.length + 1) : fallback; };
const SINCE = argVal('--since', new Date(Date.now() - 91 * 86400000).toISOString().slice(0, 10));
const LIMIT = Number(argVal('--limit', '0'));
const PAST_DAYS = Math.min(92, Math.ceil((Date.now() - Date.parse(`${SINCE}T00:00:00Z`)) / 86400000) + 1);
const OUT = path.join(dataRoot, '.tmp/s2judge/swell-partition-archive.json');
const BATCH = 40;
const PACE_MS = 1200;
const VARS = 'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,wind_wave_direction,wind_wave_period';

const apiKey = await resolveOpenMeteoKey();
if (!apiKey) { console.error('Χωρίς κλειδί Open-Meteo.'); process.exit(1); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Ποιες παραλίες/μέρες χρειάζονται ──────────────────────────────────────────────────────
const nd = JSON.parse(readFileSync(path.join(dataRoot, '.tmp/s2judge/national-days.json'), 'utf8'));
const needed = new Map(); // beachId → { region, days: Set }
for (const [id, b] of Object.entries(nd.beaches || {})) {
  const days = (b.days || []).filter(d => !d.skipped && d.wave && d.day >= SINCE).map(d => d.day);
  if (days.length) needed.set(Number(id), { region: b.region, days: new Set(days) });
}
console.error(`παραλίες με μέρες δορυφόρου ≥ ${SINCE}: ${needed.size} · past_days=${PAST_DAYS}`);

// ── Θαλάσσιο σημείο κάθε παραλίας, όπως το διαλέγει η σελίδα ─────────────────────────────
const appDir = path.join(root, 'public/data/beaches/app');
const expDir = path.join(root, 'public/data/geospatial/exposure');
const byRegion = new Map();
for (const [id, info] of needed) { if (!byRegion.has(info.region)) byRegion.set(info.region, []); byRegion.get(info.region).push(id); }
const pointOfBeach = new Map(); // beachId → key
const points = new Map();       // key → {lat, lon}
for (const [regionId, ids] of byRegion) {
  let app; try { app = JSON.parse(readFileSync(path.join(appDir, `${regionId}.json`), 'utf8')); } catch { continue; }
  const profiles = {};
  try { for (const p of Object.values(JSON.parse(readFileSync(path.join(expDir, `${regionId}.json`), 'utf8')).profiles ?? {})) if (p?.beachId != null) profiles[p.beachId] = p; } catch { /* χωρίς προφίλ */ }
  const regionPoint = app.island?.coordinates;
  if (!regionPoint) continue;
  const resolution = resolveBeachMarinePoints(app.island.beaches ?? [], profiles, regionPoint);
  const regionKey = marinePointKey(regionPoint.lat, regionPoint.lon);
  for (const p of resolution.points) points.set(marinePointKey(p.lat, p.lon), { lat: p.lat, lon: p.lon });
  for (const id of ids) pointOfBeach.set(id, resolution.keyByBeachId.get(id) ?? regionKey);
}
const usedKeys = [...new Set([...pointOfBeach.values()])];
console.error(`θαλάσσια σημεία προς λήψη: ${usedKeys.length}`);

// ── Λήψη: ewam + meteofrance_wave, 09:00 UTC ανά μέρα ────────────────────────────────────
const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { generatedAt: null, since: SINCE, points: {}, beaches: {} };
const pointRows = existing.points || {};
const fetchModel = async (batchKeys, models) => {
  const lats = batchKeys.map(k => points.get(k).lat).join(','), lons = batchKeys.map(k => points.get(k).lon).join(',');
  const url = `https://customer-marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lons}&hourly=${VARS}&past_days=${PAST_DAYS}&forecast_days=1&timezone=UTC&models=${models}&apikey=${encodeURIComponent(apiKey)}`;
  for (let t = 0; t < 4; t++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
      const json = await res.json();
      if (json.error) throw new Error(json.reason);
      const rows = Array.isArray(json) ? json : [json];
      if (rows.length !== batchKeys.length) throw new Error(`${rows.length} για ${batchKeys.length}`);
      return rows;
    } catch (e) { if (t === 3) throw e; await sleep(4000 * (t + 1)); }
  }
};
const pending = usedKeys.filter(k => !pointRows[k]).slice(0, LIMIT || undefined);
let done = 0;
for (let i = 0; i < pending.length; i += BATCH) {
  const batch = pending.slice(i, i + BATCH);
  const [ewam, mf] = await Promise.all([fetchModel(batch, 'ewam'), fetchModel(batch, 'meteofrance_wave')]);
  batch.forEach((key, j) => {
    const pick = (rows) => rows[j]?.hourly;
    const h1 = pick(ewam), h2 = pick(mf);
    const out = {};
    const times = h1?.time ?? h2?.time ?? [];
    times.forEach((t, idx) => {
      if (!t.endsWith('T09:00')) return;
      const day = t.slice(0, 10);
      const take = (h, model) => {
        const hs = h?.wave_height?.[idx];
        if (typeof hs !== 'number' || hs <= 0) return null;
        return { hs, dir: h.wave_direction?.[idx] ?? null, tp: h.wave_period?.[idx] ?? null, hsw: h.swell_wave_height?.[idx] ?? null, dsw: h.swell_wave_direction?.[idx] ?? null, tsw: h.swell_wave_period?.[idx] ?? null, hww: h.wind_wave_height?.[idx] ?? null, dww: h.wind_wave_direction?.[idx] ?? null, tww: h.wind_wave_period?.[idx] ?? null, model };
      };
      out[day] = take(h1, 'ewam') ?? take(h2, 'meteofrance_wave') ?? null;
    });
    pointRows[key] = out;
  });
  done += batch.length;
  process.stderr.write(`\r  σημεία ${done}/${pending.length}   `);
  writeFileSync(OUT, JSON.stringify({ ...existing, points: pointRows }));
  await sleep(PACE_MS);
}
process.stderr.write('\n');

// ── Ανά παραλία: μόνο οι μέρες του δορυφόρου ─────────────────────────────────────────────
const beaches = {};
let records = 0, withPartition = 0;
for (const [id, info] of needed) {
  const key = pointOfBeach.get(id);
  const rows = pointRows[key];
  if (!rows) continue;
  const out = {};
  for (const day of info.days) {
    const r = rows[day];
    if (!r) continue;
    out[day] = r; records += 1;
    if (typeof r.hsw === 'number' && typeof r.dsw === 'number') withPartition += 1;
  }
  if (Object.keys(out).length) beaches[id] = { region: info.region, point: key, days: out };
}
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), since: SINCE, pastDays: PAST_DAYS, source: 'Open-Meteo marine past_days (ewam, εφεδρεία meteofrance_wave), 09:00 UTC, στο θαλάσσιο σημείο της σελίδας', pointCount: Object.keys(pointRows).length, records, withPartition, points: pointRows, beaches }));
console.log(`=== Δ11 χωρισμός θάλασσας: ${Object.keys(beaches).length} παραλίες, ${records} μέρες δορυφόρου με αρχείο, ${withPartition} με φουσκοθαλασσιά/κύμα ανέμου χωριστά → ${path.relative(dataRoot, OUT)}`);
