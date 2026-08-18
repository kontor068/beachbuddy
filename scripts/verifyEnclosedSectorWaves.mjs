#!/usr/bin/env node
/**
 * ΦΥΣΙΚΗ ΕΠΑΛΗΘΕΥΣΗ ΤΟΥ "ΔΑΠΕΔΟΥ 0,6"
 *
 * Ερώτημα: όταν η γεωμετρία λέει fetchKm=0 και blockedRayRatio>=0,95 σε έναν τομέα
 * (= μηδέν ανοιχτό νερό προς τα εκεί), τι λέει το πραγματικό κύμα όταν ο άνεμος
 * φυσάει ΑΠΟ αυτόν τον τομέα;
 *
 * Δείγμα:  παραλίες με τομέα fetchKm=0, ratio>=0,95, level != 'protected'
 * Έλεγχος: παραλίες της ΙΔΙΑΣ περιοχής με ΙΔΙΟ τομέα, fetchKm>=8, ratio<=0,30
 *
 * Δωρεάν endpoints, 250ms καθυστέρηση, AbortSignal.timeout(15000).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const EXPOSURE_DIR = path.join(ROOT, 'public', 'data', 'geospatial', 'exposure');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'reports', 'tmp');

const SECTOR_BEARING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
const SECTOR_HALF_WIDTH = 22.5;
const BFT4_KMH = 20; // 4 Μποφ. = 5,5 m/s = 19,8 km/h
const BFT3_KMH = 12; // 3 Μποφ. = 3,4 m/s = 12,2 km/h (δευτερεύον, για κάλυψη)
const SAMPLE_TARGET = Number(process.env.SAMPLE_TARGET || 32);
const DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Ο πιο ανοιχτός τομέας της ίδιας παραλίας — έλεγχος ΜΕΣΑ στο ίδιο κελί πλέγματος. */
function mostOpenSector(sectors) {
  let best = null;
  for (const [k, s] of Object.entries(sectors || {})) {
    if (!best || s.fetchKm > best.fetchKm) best = { key: k, fetchKm: s.fetchKm, level: s.level };
  }
  return best;
}

function angDiff(a, b) {
  let d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// ---------------------------------------------------------------- ΣΤΑΔΙΟ 1: σάρωση
function scan() {
  const files = fs.readdirSync(EXPOSURE_DIR).filter((f) => f.endsWith('.json') && f !== 'index.json');
  const stats = { files: files.length, profiles: 0, combos: 0, closed: 0, closedNotProtected: 0 };
  const treatment = [];
  const byRegion = new Map();

  for (const file of files) {
    const regionId = file.replace(/\.json$/, '');
    const data = JSON.parse(fs.readFileSync(path.join(EXPOSURE_DIR, file), 'utf8'));
    const raw = data.profiles || [];
    const profiles = Array.isArray(raw) ? raw : Object.values(raw);
    byRegion.set(regionId, profiles);
    stats.profiles += profiles.length;

    for (const p of profiles) {
      const sectors = p.sectors || {};
      for (const [key, s] of Object.entries(sectors)) {
        stats.combos++;
        const closed = s.fetchKm === 0 && (s.blockedRayRatio ?? 0) >= 0.95;
        if (!closed) continue;
        stats.closed++;
        if (s.level === 'protected') continue;
        stats.closedNotProtected++;
        treatment.push({
          regionId,
          beachId: p.beachId,
          name: p.name?.gr || p.name?.en || String(p.beachId),
          lat: p.coordinates.lat,
          lon: p.coordinates.lon,
          facingDeg: p.facingDeg,
          confidence: p.confidence,
          sector: key,
          sectorBearing: SECTOR_BEARING[key],
          level: s.level,
          intensity: s.intensity,
          onshore: s.onshore,
          fetchKm: s.fetchKm,
          blockedRayRatio: s.blockedRayRatio,
          marineSamplePoint: p.marineSamplePoint || null,
          openSector: mostOpenSector(sectors),
          fetchBySector: Object.fromEntries(Object.entries(sectors).map(([k, v]) => [k, v.fetchKm])),
        });
      }
    }
  }
  return { stats, treatment, byRegion };
}

/** Πού κάθεται το κελί του κυματικού μοντέλου σε σχέση με την παραλία. */
function bearingDeg(from, to) {
  const toRad = (d) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lon - from.lon)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lon - from.lon));
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;
}

function sectorOfBearing(deg) {
  let best = null;
  for (const [k, b] of Object.entries(SECTOR_BEARING)) {
    const d = angDiff(deg, b);
    if (!best || d < best.d) best = { k, d };
  }
  return best.k;
}

function enrichCellPlacement(b) {
  if (!b.cell) return b;
  const brg = bearingDeg({ lat: b.lat, lon: b.lon }, b.cell);
  const cellSector = sectorOfBearing(brg);
  return {
    ...b,
    cellBearingDeg: Number(brg.toFixed(1)),
    cellSector,
    cellSectorFetchKm: b.fetchBySector ? b.fetchBySector[cellSector] : null,
    cellInsideQuestionedSector: cellSector === b.sector,
  };
}

function pickSample(treatment) {
  // ένα per beachId (ο χειρότερος τομέας), ταξινομημένο κατά ένταση, γεωγραφικά απλωμένο
  const bestPerBeach = new Map();
  for (const t of treatment) {
    const prev = bestPerBeach.get(t.beachId);
    if (!prev || t.intensity > prev.intensity) bestPerBeach.set(t.beachId, t);
  }
  const all = [...bestPerBeach.values()].filter((t) => t.confidence === 'high');
  all.sort((a, b) => b.intensity - a.intensity);

  // απλώνουμε: max 3 ανά περιοχή, γεμίζουμε μέχρι τον στόχο
  const perRegion = new Map();
  const picked = [];
  // ρητή αφορμή: Λιμνιώνας Κυθήρων, τομέας W
  const forced = treatment.find((t) => t.beachId === 133 && t.sector === 'W');
  if (forced) {
    picked.push(forced);
    perRegion.set(forced.regionId, 1);
  }
  for (const cap of [2, 3, 6, 99]) {
    for (const t of all) {
      if (picked.length >= SAMPLE_TARGET) break;
      if (picked.includes(t)) continue;
      const n = perRegion.get(t.regionId) || 0;
      if (n >= cap) continue;
      perRegion.set(t.regionId, n + 1);
      picked.push(t);
    }
    if (picked.length >= SAMPLE_TARGET) break;
  }
  return picked;
}

function pickControls(sample, byRegion) {
  const controls = [];
  const used = new Set();
  for (const t of sample) {
    const cands = [];
    // 1) ίδια περιοχή
    for (const p of byRegion.get(t.regionId) || []) {
      const s = p.sectors?.[t.sector];
      if (!s) continue;
      if (s.fetchKm >= 8 && (s.blockedRayRatio ?? 1) <= 0.3 && p.confidence === 'high') {
        cands.push({ p, regionId: t.regionId, d: haversineKm(t, p.coordinates) });
      }
    }
    // 2) εθνικά, εντός 60 χλμ
    if (!cands.length) {
      for (const [rid, profiles] of byRegion) {
        for (const p of profiles) {
          const s = p.sectors?.[t.sector];
          if (!s) continue;
          if (s.fetchKm >= 8 && (s.blockedRayRatio ?? 1) <= 0.3 && p.confidence === 'high') {
            const d = haversineKm(t, p.coordinates);
            if (d <= 60) cands.push({ p, regionId: rid, d });
          }
        }
      }
    }
    cands.sort((a, b) => a.d - b.d);
    const chosen = cands.find((c) => !used.has(c.p.beachId)) || cands[0];
    if (!chosen) continue;
    used.add(chosen.p.beachId);
    const s = chosen.p.sectors[t.sector];
    controls.push({
      regionId: chosen.regionId,
      beachId: chosen.p.beachId,
      name: chosen.p.name?.gr || chosen.p.name?.en || String(chosen.p.beachId),
      lat: chosen.p.coordinates.lat,
      lon: chosen.p.coordinates.lon,
      facingDeg: chosen.p.facingDeg,
      confidence: chosen.p.confidence,
      sector: t.sector,
      sectorBearing: SECTOR_BEARING[t.sector],
      level: s.level,
      intensity: s.intensity,
      onshore: s.onshore,
      fetchKm: s.fetchKm,
      blockedRayRatio: s.blockedRayRatio,
      marineSamplePoint: chosen.p.marineSamplePoint || null,
      openSector: mostOpenSector(chosen.p.sectors),
      fetchBySector: Object.fromEntries(
        Object.entries(chosen.p.sectors).map(([k, v]) => [k, v.fetchKm])
      ),
      pairedWith: t.beachId,
      pairDistanceKm: Number(chosen.d.toFixed(1)),
    });
  }
  return controls;
}

// ---------------------------------------------------------------- ΣΤΑΔΙΟ 2: ζωντανά δεδομένα
async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.status === 429) {
        await sleep(3000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 200));
      return await res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(1500 * (attempt + 1));
    }
  }
}

const PAST_DAYS = Number(process.env.PAST_DAYS || 92);
const FCST_DAYS = Number(process.env.FCST_DAYS || 2);

async function fetchBeach(b) {
  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine?latitude=${b.lat}&longitude=${b.lon}` +
    `&hourly=wave_height,wind_wave_height,wind_wave_direction,wind_wave_period` +
    `&past_days=${PAST_DAYS}&forecast_days=${FCST_DAYS}&timezone=UTC&cell_selection=sea`;
  const windUrl =
    `https://api.open-meteo.com/v1/forecast?latitude=${b.lat}&longitude=${b.lon}` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&past_days=${PAST_DAYS}&forecast_days=${FCST_DAYS}&timezone=UTC`;

  const marine = await getJson(marineUrl);
  await sleep(DELAY_MS);
  const wind = await getJson(windUrl);
  await sleep(DELAY_MS);

  const cell = { lat: marine.latitude, lon: marine.longitude };
  const cellDistKm = Number(haversineKm(b, cell).toFixed(2));

  const wt = wind.hourly.time;
  const mIdx = new Map(marine.hourly.time.map((t, i) => [t, i]));

  const rows = [];
  for (let i = 0; i < wt.length; i++) {
    const j = mIdx.get(wt[i]);
    if (j === undefined) continue;
    const spd = wind.hourly.wind_speed_10m[i];
    const dir = wind.hourly.wind_direction_10m[i];
    const ww = marine.hourly.wind_wave_height[j];
    const wv = marine.hourly.wave_height[j];
    if (spd == null || dir == null) continue;
    rows.push({ t: wt[i], spd, dir, gust: wind.hourly.wind_gusts_10m[i], windWave: ww, wave: wv });
  }
  return { cell, cellDistKm, rows };
}

function stat(arr, key) {
  if (!arr.length) return null;
  const v = arr
    .map((r) => r[key])
    .filter((x) => x != null)
    .sort((a, b) => a - b);
  if (!v.length) return null;
  return {
    n: v.length,
    mean: Number((v.reduce((s, x) => s + x, 0) / v.length).toFixed(3)),
    median: Number(v[Math.floor(v.length / 2)].toFixed(3)),
    p90: Number(v[Math.floor(v.length * 0.9)].toFixed(3)),
    max: Number(v[v.length - 1].toFixed(3)),
    min: Number(v[0].toFixed(3)),
  };
}

function summarise(rows, b) {
  const sectorBearing = b.sectorBearing;
  const openBearing = b.openSector ? SECTOR_BEARING[b.openSector.key] : null;

  const pick = (bearing, minKmh) =>
    bearing == null
      ? []
      : rows.filter(
          (r) => r.spd >= minKmh && angDiff(r.dir, bearing) <= SECTOR_HALF_WIDTH && r.windWave != null
        );

  const in4 = pick(sectorBearing, BFT4_KMH);
  const in3 = pick(sectorBearing, BFT3_KMH);
  const open4 = pick(openBearing, BFT4_KMH);

  return {
    totalHours: rows.length,
    hoursInSector4Bft: in4.length,
    hoursInSector3Bft: in3.length,
    meanWindKmhInSector: in4.length
      ? Number((in4.reduce((s, r) => s + r.spd, 0) / in4.length).toFixed(1))
      : null,
    windWaveInSector: stat(in4, 'windWave'),
    windWaveInSector3Bft: stat(in3, 'windWave'),
    waveInSector: stat(in4, 'wave'),
    // έλεγχος ΜΕΣΑ στην ίδια παραλία / ίδιο κελί: ο πιο ανοιχτός της τομέας
    ownOpenSector: b.openSector ? b.openSector.key : null,
    ownOpenSectorFetchKm: b.openSector ? b.openSector.fetchKm : null,
    hoursOwnOpenSector4Bft: open4.length,
    windWaveOwnOpenSector: stat(open4, 'windWave'),
  };
}

/**
 * Φυσικό ταβάνι: SMB (utils/waveModel.ts:46-56) πάνω στο ΜΕΓΑΛΥΤΕΡΟ άνοιγμα που
 * έχει η παραλία σε ΟΠΟΙΑΔΗΠΟΤΕ κατεύθυνση. Πιο πάνω από αυτό δεν χωράει κύμα ανέμου.
 */
const GRAVITY = 9.80665;
const KMH_TO_MS = 1000 / 3600;
function smbWaveM(windKmh, fetchKm) {
  const windMs = Math.max(0, windKmh) * KMH_TO_MS;
  const fetchM = Math.max(0, fetchKm) * 1000;
  if (windMs < 0.5 || fetchM <= 0) return 0;
  const df = (GRAVITY * fetchM) / (windMs * windMs);
  const hs = 0.283 * ((windMs * windMs) / GRAVITY) * Math.tanh(0.0125 * Math.pow(df, 0.42));
  return Number.isFinite(hs) && hs > 0 ? Number(hs.toFixed(3)) : 0;
}

function addPhysicsCeiling(b) {
  if (!b.windWaveInSector || !b.meanWindKmhInSector) return b;
  const maxFetchAnyDirection = b.fetchBySector
    ? Math.max(...Object.values(b.fetchBySector))
    : null;
  const ceilingAnyDirectionM = maxFetchAnyDirection == null
    ? null
    : smbWaveM(b.meanWindKmhInSector, maxFetchAnyDirection);
  const ceilingQuestionedSectorM = smbWaveM(b.meanWindKmhInSector, b.fetchKm);
  return {
    ...b,
    maxFetchAnyDirectionKm: maxFetchAnyDirection,
    physicsCeilingAnyDirectionM: ceilingAnyDirectionM,
    physicsCeilingQuestionedSectorM: ceilingQuestionedSectorM,
    modelOverCeilingRatio:
      ceilingAnyDirectionM && ceilingAnyDirectionM > 0
        ? Number((b.windWaveInSector.mean / ceilingAnyDirectionM).toFixed(1))
        : null,
    modelExceedsPhysicalCeiling:
      ceilingAnyDirectionM != null && b.windWaveInSector.mean > ceilingAnyDirectionM,
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { stats, treatment, byRegion } = scan();
  console.log('=== ΣΑΡΩΣΗ ===');
  console.log(JSON.stringify(stats));

  const sample = pickSample(treatment);
  const controls = pickControls(sample, byRegion);
  console.log(`δείγμα=${sample.length} έλεγχος=${controls.length}`);

  const results = { generatedAt: new Date().toISOString(), stats, sample: [], control: [], errors: [] };

  const run = async (list, bucket, label) => {
    for (const [i, b] of list.entries()) {
      process.stdout.write(`[${label} ${i + 1}/${list.length}] ${b.name} (${b.sector}) ... `);
      try {
        const { cell, cellDistKm, rows } = await fetchBeach(b);
        const s = summarise(rows, b);
        bucket.push(addPhysicsCeiling(enrichCellPlacement({ ...b, cell, cellDistKm, ...s })));
        console.log(
          `κελί ${cellDistKm}χλμ | ώρες≥4Μπφ ${s.hoursInSector4Bft} | ` +
            `κύμα ανέμου μ.ο. ${s.windWaveInSector ? s.windWaveInSector.mean : '-'} μ. | ` +
            `ανοιχτός ${s.ownOpenSector}(${s.ownOpenSectorFetchKm}χλμ) ` +
            `${s.windWaveOwnOpenSector ? s.windWaveOwnOpenSector.mean : '-'} μ.`
        );
      } catch (err) {
        console.log('ΣΦΑΛΜΑ ' + err.message);
        results.errors.push({ beachId: b.beachId, name: b.name, error: String(err.message) });
      }
    }
  };

  await run(sample, results.sample, 'Δ');
  await run(controls, results.control, 'Ε');

  // Σύνοψη
  const agg = (arr) => {
    const vals = arr.flatMap((b) => (b.windWaveInSector ? [b.windWaveInSector.mean] : []));
    const maxes = arr.flatMap((b) => (b.windWaveInSector ? [b.windWaveInSector.max] : []));
    const n = vals.length;
    const within = arr.filter((b) => b.windWaveInSector && b.windWaveOwnOpenSector);
    return {
      beachesWithSectorHours: n,
      totalSectorHours: arr.reduce((s, b) => s + (b.hoursInSector4Bft || 0), 0),
      withinBeach: within.length
        ? {
            n: within.length,
            meanClosedSector: Number(
              (within.reduce((s, b) => s + b.windWaveInSector.mean, 0) / within.length).toFixed(3)
            ),
            meanOwnOpenSector: Number(
              (within.reduce((s, b) => s + b.windWaveOwnOpenSector.mean, 0) / within.length).toFixed(3)
            ),
          }
        : null,
      meanOfMeans: n ? Number((vals.reduce((s, x) => s + x, 0) / n).toFixed(3)) : null,
      medianOfMeans: n ? Number(vals.slice().sort((a, b) => a - b)[Math.floor(n / 2)].toFixed(3)) : null,
      meanOfMax: n ? Number((maxes.reduce((s, x) => s + x, 0) / n).toFixed(3)) : null,
      beachesUnder10cm: vals.filter((v) => v < 0.1).length,
      beachesOver30cm: vals.filter((v) => v >= 0.3).length,
      meanCellDistKm: arr.length
        ? Number((arr.reduce((s, b) => s + b.cellDistKm, 0) / arr.length).toFixed(2))
        : null,
    };
  };

  // ζευγαρωτή σύγκριση (μόνο ζεύγη όπου ΚΑΙ τα δύο έχουν ώρες τομέα)
  const byId = new Map(results.sample.map((b) => [b.beachId, b]));
  const pairs = [];
  for (const c of results.control) {
    const t = byId.get(c.pairedWith);
    if (!t || !t.windWaveInSector || !c.windWaveInSector) continue;
    pairs.push({
      sector: t.sector,
      treatment: t.name,
      treatmentId: t.beachId,
      treatmentMean: t.windWaveInSector.mean,
      treatmentCellKm: t.cellDistKm,
      control: c.name,
      controlId: c.beachId,
      controlMean: c.windWaveInSector.mean,
      controlCellKm: c.cellDistKm,
      controlFetchKm: c.fetchKm,
      delta: Number((c.windWaveInSector.mean - t.windWaveInSector.mean).toFixed(3)),
      pairDistanceKm: c.pairDistanceKm,
      sameCell: t.cell.lat === c.cell.lat && t.cell.lon === c.cell.lon,
    });
  }
  const deltas = pairs.map((p) => p.delta).sort((a, b) => a - b);
  const placement = (arr) => ({
    n: arr.length,
    cellFartherThan1km: arr.filter((b) => b.cellDistKm > 1).length,
    cellFartherThan3km: arr.filter((b) => b.cellDistKm > 3).length,
    maxCellDistKm: arr.length ? Math.max(...arr.map((b) => b.cellDistKm)) : null,
    cellInsideQuestionedSector: arr.filter((b) => b.cellInsideQuestionedSector).length,
    cellSectorFetchKmMean: arr.length
      ? Number(
          (
            arr.reduce((s, b) => s + (b.cellSectorFetchKm ?? 0), 0) / arr.length
          ).toFixed(2)
        )
      : null,
  });

  const physics = (arr) => {
    const withCeiling = arr.filter((b) => b.physicsCeilingAnyDirectionM != null);
    return {
      n: withCeiling.length,
      modelExceedsPhysicalCeiling: withCeiling.filter((b) => b.modelExceedsPhysicalCeiling).length,
      medianOverCeilingRatio: withCeiling.length
        ? withCeiling
            .map((b) => b.modelOverCeilingRatio)
            .filter((x) => x != null)
            .sort((a, b) => a - b)[Math.floor(withCeiling.length / 2)]
        : null,
    };
  };

  results.summary = {
    cellPlacement: { sample: placement(results.sample), control: placement(results.control) },
    physicsCeiling: { sample: physics(results.sample), control: physics(results.control) },
    sample: agg(results.sample),
    control: agg(results.control),
    pairs: {
      n: pairs.length,
      sameGridCell: pairs.filter((p) => p.sameCell).length,
      meanDelta: deltas.length
        ? Number((deltas.reduce((s, x) => s + x, 0) / deltas.length).toFixed(3))
        : null,
      medianDelta: deltas.length ? deltas[Math.floor(deltas.length / 2)] : null,
      controlHigherCount: deltas.filter((d) => d > 0.05).length,
      roughlyEqualCount: deltas.filter((d) => Math.abs(d) <= 0.05).length,
      treatmentHigherCount: deltas.filter((d) => d < -0.05).length,
    },
  };
  results.pairs = pairs;

  const outFile = path.join(OUT_DIR, 'enclosed-sector-wave-verification.json');
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), 'utf8');
  console.log('\n=== ΣΥΝΟΨΗ ===');
  console.log(JSON.stringify(results.summary, null, 2));
  console.log('\nΑρχείο: ' + outFile);
  if (results.errors.length) console.log('Σφάλματα: ' + results.errors.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
